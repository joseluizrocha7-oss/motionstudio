"""Tempo de cada palavra de uma tomada do Gemini TTS (que não devolve o tempo).

O Gemini só devolve o áudio. Este script:
  1. transcreve a tomada com o faster-whisper local (modelo medium, pt), palavra a palavra;
  2. casa as palavras do ROTEIRO com as ouvidas (o texto que vale é o do roteiro);
  3. prende cada fronteira entre palavras ao silêncio medido no áudio: o Whisper
     estica a palavra por cima da pausa vizinha, e aí o entonacao.mjs acusa
     vírgula sem pausa que existe.

Grava <tomada>.words.json [{"word","start","end"}] e <tomada>.lines.json
[{"text","start","end"}] (uma linha por frase do roteiro), o formato que o
entonacao.mjs e o ouvir.py da motionstudio (scripts/) leem.

Uso: py -3 alinhar.py tomada.wav roteiro.txt [--modelo medium]
O roteiro é o texto mandado à voz; as marcas <short pause> etc. são ignoradas.

Sigla soletrada e número por extenso ("cê bê ésse" = "CBS", "dois mil e trinta e
três" = "2033") casam com a palavra do Whisper pelo normalizar.py (ao lado deste
arquivo): o tempo vem dessa palavra, repartido pelas sílabas, e não é estimado.
"""
import io, json, os, re, subprocess, sys, unicodedata
import numpy as np


def _achar_skill():
    """Pasta da skill, como o kit/_skill.mjs: variável SKILL, motionstudio.json até 6 pastas acima, perfil do usuário."""
    if os.environ.get("SKILL"):
        return os.environ["SKILL"]
    pasta = os.path.dirname(os.path.abspath(__file__))
    for _ in range(7):
        arq = os.path.join(pasta, "motionstudio.json")
        if os.path.isfile(arq):
            return json.loads(open(arq, encoding="utf-8").read().lstrip("\ufeff")).get("skill", "")
        if os.path.dirname(pasta) == pasta:
            break
        pasta = os.path.dirname(pasta)
    return os.path.join(os.path.expanduser("~"), ".claude", "skills", "motionstudio")


try:
    from normalizar import casar, trechos                  # ao lado: kit/vozes/ da skill ou vozes/ do projeto
except ImportError:
    # projeto antigo que recebeu só o alinhar.py novo: usa o normalizar.py da skill
    sys.path.append(os.path.join(_achar_skill(), "kit", "vozes"))
    try:
        from normalizar import casar, trechos
    except ImportError:
        sys.exit("alinhar.py: falta o normalizar.py. Copie kit/vozes/normalizar.py da skill para a pasta deste arquivo.")

SR = 16000


def norm(p):
    p = unicodedata.normalize("NFD", p.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", p)


def ler_texto(arq):
    texto = re.sub(r"<[^>]+>", " ", open(arq, encoding="utf-8").read())
    return re.sub(r"\s+", " ", texto).strip()


def carregar(wav):
    """Áudio em 16 kHz mono (o decode do faster-whisper quebra nesta máquina: ffmpeg direto)."""
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def transcrever(amostras, modelo):
    from faster_whisper import WhisperModel
    m = WhisperModel(modelo, device="cpu", compute_type="int8", local_files_only=True)
    segs, _ = m.transcribe(amostras, language="pt", word_timestamps=True, beam_size=2, vad_filter=False,
                           initial_prompt=None, condition_on_previous_text=False)
    return [{"p": w.word.strip(), "ini": w.start, "fim": w.end} for s in segs for w in (s.words or [])]


def silabas(t):
    """Grupos de vogais da palavra: o peso dela na hora de repartir o tempo de um grupo ("ésse" = 2, "cê" = 1)."""
    return max(1, len(re.findall(r"[aeiouy]+", norm(t))))


def alinhar(tokens, ouvidas, amostras):
    """Tempo de cada palavra do roteiro (tokens, com a pontuação colada) a partir das ouvidas [{p, ini, fim}]."""
    dur = len(amostras) / SR
    mapa = [None] * len(tokens)                            # índice da ouvida, ("est", ini, fim) ou ("grupo", k0)
    grupos = {}                                            # k0 -> [k0, k1, ini, fim]: tokens[k0:k1] são uma palavra ouvida

    def agrupar(a0, a1, b0, b1):
        grupos[a0] = [a0, a1, ouvidas[b0]["ini"], ouvidas[b1 - 1]["fim"]]
        for k in range(a0, a1):
            mapa[k] = ("grupo", a0)

    def estimar(a0, a1, b0, b1):
        """Reparte o tempo das ouvidas entre as palavras do roteiro que não casaram."""
        if a1 <= a0:
            return
        if b1 > b0:
            ini, fim = ouvidas[b0]["ini"], ouvidas[b1 - 1]["fim"]
        else:
            ini = 0.0
            for j in range(a0 - 1, -1, -1):
                if isinstance(mapa[j], int):
                    ini = ouvidas[mapa[j]]["fim"]
                    break
                if mapa[j] and mapa[j][0] == "grupo":
                    ini = grupos[mapa[j][1]][3]
                    break
            fim = ini + 0.05
        n = a1 - a0
        for k in range(n):
            mapa[a0 + k] = ("est", ini + (fim - ini) * k / n, ini + (fim - ini) * (k + 1) / n)

    # Por unidade: número por extenso e sigla soletrada contam como 1 ("dois mil e vinte e cinco" = "2025"),
    # e o "e" de dentro do número não casa com o "e" ouvido logo depois.
    for tag, a0, a1, b0, b1 in trechos(tokens, [w["p"] for w in ouvidas]):
        if tag == "equal":
            if a1 - a0 == 1 and b1 - b0 == 1:
                mapa[a0] = b0
            else:
                agrupar(a0, a1, b0, b1)
        elif tag in ("replace", "delete") and a1 > a0:
            # sigla soletrada e número por extenso: "cê bê ésse" = "CBS", "dois mil e trinta e três" = "2033"
            ia, ib = a0, b0
            for x0, x1, y0, y1 in (casar(tokens[a0:a1], [w["p"] for w in ouvidas[b0:b1]]) if b1 > b0 else []):
                estimar(ia, a0 + x0, ib, b0 + y0)
                agrupar(a0 + x0, a0 + x1, b0 + y0, b0 + y1)
                ia, ib = a0 + x1, b0 + y1
            # Trechos que não casaram nem assim: reparte o tempo das ouvidas entre as do roteiro.
            estimar(ia, a1, ib, b1)

    # Unidades: uma palavra, ou as palavras do roteiro que dizem uma palavra ouvida. [k0, k1, ini, fim, estimada]
    unidades, k = [], 0
    while k < len(tokens):
        m = mapa[k]
        if isinstance(m, int):
            unidades.append([k, k + 1, ouvidas[m]["ini"], ouvidas[m]["fim"], False])
        elif m[0] == "grupo":
            unidades.append(grupos[m[1]][:4] + [False])
        else:
            unidades.append([k, k + 1, m[1], m[2], True])
        k = unidades[-1][1]

    # Energia em janelas de 10 ms para achar o silêncio entre palavras.
    jan = SR // 100
    n = len(amostras) // jan
    rms = np.sqrt(np.mean(amostras[: n * jan].reshape(n, jan) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    fala_db = np.percentile(db, 90)
    limiar = fala_db - 32  # 32 dB abaixo do volume típico da fala conta como silêncio

    def silencio_entre(a, b):
        """Maior trecho de silêncio entre a e b (s), ou None."""
        i0, i1 = max(0, int(a * 100) - 15), min(n, int(b * 100) + 15)
        melhor, cur = None, None
        for i in range(i0, i1):
            if db[i] < limiar:
                cur = (cur[0], i + 1) if cur else (i, i + 1)
                if not melhor or (cur[1] - cur[0]) > (melhor[1] - melhor[0]):
                    melhor = cur
            else:
                cur = None
        if melhor and (melhor[1] - melhor[0]) >= 4:  # ao menos 40 ms
            return melhor[0] / 100, melhor[1] / 100
        return None

    # A fronteira de um grupo vale a do grupo inteiro: com a fatia de "cê" só, o silêncio antes da sigla
    # passava do fim da fatia e não era usado (os cartões entravam 0,3 s antes da fala, 28/10/2026).
    for i in range(len(unidades) - 1):
        a, b = unidades[i], unidades[i + 1]
        s = silencio_entre(a[3] - 0.25, b[2] + 0.25)
        if s and s[0] > a[2] + 0.06 and s[1] < b[3] - 0.06:
            a[3], b[2] = s[0], s[1]

    palavras, dentro = [], []                              # dentro: i e i + 1 são do mesmo grupo
    for k0, k1, ini, fim, estimada in unidades:
        pesos = [silabas(t) for t in tokens[k0:k1]]
        cortes = [ini] + [ini + (fim - ini) * sum(pesos[:k]) / sum(pesos) for k in range(1, len(pesos))] + [fim]
        for k, t in enumerate(tokens[k0:k1]):
            palavras.append({"word": t, "start": float(cortes[k]), "end": float(cortes[k + 1])})
            if estimada:
                palavras[-1]["est"] = True
            if k:
                dentro.append(len(palavras) - 2)
    # Dentro do grupo, cada fronteira também se prende ao silêncio que houver entre as fatias.
    for i in dentro:
        a, b = palavras[i], palavras[i + 1]
        s = silencio_entre(a["end"] - 0.25, b["start"] + 0.25)
        if s and s[0] > a["start"] + 0.06 and s[1] < b["end"] - 0.06:
            a["end"], b["start"] = s[0], s[1]
    if palavras:
        palavras[-1]["end"] = min(palavras[-1]["end"], dur)
    return palavras


def frases(palavras):
    """Linhas = frases do roteiro."""
    linhas, atual = [], []
    for p in palavras:
        atual.append(p)
        if re.search(r"[.!?…]$", p["word"]):
            linhas.append({"text": " ".join(x["word"] for x in atual), "start": atual[0]["start"], "end": atual[-1]["end"]})
            atual = []
    if atual:
        linhas.append({"text": " ".join(x["word"] for x in atual), "start": atual[0]["start"], "end": atual[-1]["end"]})
    return linhas


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    modelo = sys.argv[sys.argv.index("--modelo") + 1] if "--modelo" in sys.argv else "medium"
    wav, roteiro_arq = args[0], args[1]
    amostras = carregar(wav)
    ouvidas = transcrever(amostras, modelo)
    palavras = alinhar(ler_texto(roteiro_arq).split(" "), ouvidas, amostras)
    linhas = frases(palavras)
    base = re.sub(r"\.[a-z0-9]+$", "", wav, flags=re.I)
    json.dump(palavras, open(base + ".words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(linhas, open(base + ".lines.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ouvido = " ".join(w["p"] for w in ouvidas)
    estimadas = sum(1 for p in palavras if p.get("est"))
    print(f"{wav}: {len(amostras) / SR:.2f} s, {len(palavras)} palavras ({estimadas} estimadas), {len(linhas)} frases")
    print(f"ouvido ({modelo}): {ouvido}")


if __name__ == "__main__":
    main()
