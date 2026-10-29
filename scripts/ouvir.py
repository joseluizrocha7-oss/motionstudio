#!/usr/bin/env python3
# ACRÉSCIMO LOCAL (13/10/2026), não faz parte da skill original.
"""ouvir.py - confere o SOM do arquivo final, por transcrição e por medida.

Quem monta o filme não ouve o resultado. Dos seis filmes que o usuário reprovou
até 13/10/2026, quatro foram por som, e todos tinham passado nos portões G0-G5:
narração mal cortada (o "Na" de "Na empresa" grudado na frase anterior), frases
em volumes diferentes, 114 efeitos em 22 s, trilha subindo e descendo a cada
fala, e o balão entrando em outro instante que a fala dele. Este script roda no
arquivo que vai ser entregue (o mp4 com som, ou a mixagem) e transforma essas
correções em portões.

Uso:
  py -3 ouvir.py film/final-9x16.mp4 --roteiro film/vo.txt
        [--eventos film/final-9x16.mp4.events.json] [--sfx film/events.json]
        [--motor scribe|whisper] [--modelo medium] [--lingua pt] [--igual lumina=lumena]
        [--out film/ouvir] [--json] [--refazer]

  --roteiro  o texto da narração como foi mandado para a voz (film/audio/vo.txt), ou o
             roteiro.json do kit: com ele, a linha que tem "fala" aceita também as
             palavras do "texto" (o que está na tela). Marcas de pausa (<break .../>) e
             direção entre colchetes são ignoradas na comparação e contam como pausa
             combinada. Número por extenso e sigla soletrada casam com a grafia da
             transcrição: "dois mil e trinta e três" = "2033", "cê bê ésse" = "CBS"
             (o que fica de fora está em kit/vozes/normalizar.py).
  --eventos  o .events.json que o render.mjs grava ao lado do vídeo. Cada texto que tem
             de entrar junto com uma fala ganha, no filme, uma marca do tipo "fala" no
             quadro em que ele entra, com o começo da frase que se ouve naquele instante:
               M.mark(F.bemvinda, 'fala', 'Você assinou');     // o balão "Plano ativo!" entra com "Você assinou o plano"
             (um evento com o campo "fala" vale igual). As palavras que o M.words põe na
             tela (tipo "word") são conferidas sozinhas e saem como aviso, sem portão.
  --sfx      a lista de efeitos da mixagem (a do mix.py --events: [{"t","sfx","gain"}])
  --motor    scribe = ElevenLabs Scribe (precisa da chave, custa centavos);
             whisper = faster-whisper local (grátis; o tempo de cada palavra tem folga
             maior, então S2 e S3 usam limites mais largos; o modelo small erra palavra).
             Padrão: scribe se houver chave, senão whisper.
  --igual    grafias que valem como a mesma palavra (a transcrição escreve "Complan").
             Pode repetir.

Portões (saída 1 se algum der ALERTA; 2 = erro de uso; 3 = sem transcrição):
  S1 fala inteira         toda palavra do roteiro foi ouvida, na ordem, e nada a mais
  S2 pausas no lugar      nenhuma pausa no meio de uma frase; nenhuma frase emendada na seguinte
  S3 fala e tela juntas   cada evento com "fala" entra de 0,25 s antes a 0,12 s depois da palavra
  S4 mixagem enxuta       frases no mesmo volume, trilha abaixo da voz, poucos efeitos

O que este script NÃO enxerga: a trilha abaixando debaixo de cada fala (--duck). Com a voz
por cima não dá para separar a trilha na mixagem pronta; uma medida pelo grave foi testada e
descartada (a voz e os efeitos também têm energia ali). Isso se evita na origem: o mix.py
avisa quando recebe --duck. Também não julga tom, emoção nem pronúncia.

É medida, não ouvido. Diga sempre ao usuário que ninguém ouviu: a pronúncia de
nome próprio e o tom da voz só o ouvido dele valida.
"""
import argparse, difflib, functools, hashlib, io, json, math, os, re, subprocess, sys, tempfile, unicodedata, urllib.error, urllib.request, uuid

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# número por extenso e sigla soletrada: o mesmo módulo do alinhar.py, em kit/vozes/ da skill
sys.path.insert(1, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "kit", "vozes"))
from normalizar import casar, forma

PAUSA_NO_MEIO = {"scribe": 0.35, "whisper": 0.50}     # s sem fala entre duas palavras da mesma frase
EMENDA = {"scribe": 0.22, "whisper": 0.15}            # s mínimos depois de ponto, interrogação ou exclamação
JANELA_TELA = {"scribe": (-0.25, 0.12), "whisper": (-0.35, 0.25)}   # texto na tela em relação à fala (s): 0 a 2 quadros antes, mais a folga da transcrição
VOLUME_ENTRE_FRASES = 4.0                             # dB entre a frase mais alta e a mais baixa, medido na mixagem
TRILHA_ABAIXO = 8.0                                   # dB mínimos entre os trechos com fala e os vãos só com trilha
EFEITOS_POR_10S = 12.0                                # 17 em 23 s foi aceito (7,4); 114 em 22 s foi reprovado (52)


def br(x, c=2):
    return ("%.*f" % (c, x)).replace(".", ",")


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if c.isalnum())


def falha(msg, cod=2):
    print("erro: " + msg, file=sys.stderr)
    sys.exit(cod)


# ---------------------------------------------------------------- áudio
def extrair(arq, destino, sr=16000):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", arq, "-vn", "-ac", "1", "-ar", str(sr), destino], capture_output=True)
    if r.returncode or not os.path.isfile(destino) or os.path.getsize(destino) < 2000:
        erro = r.stderr.decode("utf-8", "replace")
        falha("%s não tem faixa de som: junte a mixagem antes de conferir" % arq if "does not contain any stream" in erro
              else "não consegui tirar o áudio de %s (%s)" % (arq, erro.strip()[:200]), 3)


def amostras(arq, sr=48000):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", arq, "-vn", "-ac", "1", "-ar", str(sr)] + ["-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32), sr


# ---------------------------------------------------------------- transcrição
def scribe(wav, lingua, chave):
    lim = "----ouvir" + uuid.uuid4().hex
    corpo = b""
    for k, v in (("model_id", "scribe_v1"), ("language_code", lingua), ("timestamps_granularity", "word")):
        corpo += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (lim, k, v)).encode()
    corpo += ("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n" % lim).encode()
    corpo += open(wav, "rb").read() + ("\r\n--%s--\r\n" % lim).encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=corpo, method="POST",
                                 headers={"xi-api-key": chave, "Content-Type": "multipart/form-data; boundary=" + lim, "User-Agent": "motionstudio/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        falha("ElevenLabs Scribe HTTP %d: %s" % (e.code, e.read().decode("utf-8", "replace")[:300]), 3)
    except urllib.error.URLError as e:
        falha("sem rede para a ElevenLabs (%s); rode com --motor whisper" % e.reason, 3)
    return [{"p": w["text"], "de": float(w["start"]), "ate": float(w["end"])} for w in d.get("words", []) if w.get("type", "word") == "word"]


def whisper(wav, lingua, modelo):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        falha("faster-whisper não está instalado (py -3 -m pip install faster-whisper) e não há chave para o Scribe", 3)
    m = WhisperModel(modelo, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(wav, language=lingua, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
    return [{"p": w.word.strip(), "de": float(w.start), "ate": float(w.end)} for s in segs for w in (s.words or []) if w.word.strip()]


def ajustar_ao_som(pal, wav):
    """Aperta o começo e o fim de cada palavra contra a energia do som: a transcrição costuma esticar a palavra por cima do silêncio vizinho."""
    import numpy as np
    a, sr = amostras(wav, 16000)
    if not len(a):
        return pal
    n = int(sr * 0.01)
    env = np.sqrt(np.convolve(a.astype(np.float64) ** 2, np.ones(n) / n, mode="same"))
    piso = max(10 ** (-48 / 20), float(np.percentile(env, 95)) * 10 ** (-28 / 20))
    for w in pal:
        i, j = int(w["de"] * sr), min(len(env) - 1, int(w["ate"] * sr))
        if j <= i:
            continue
        alto = np.nonzero(env[i:j] > piso)[0]
        if len(alto):
            w["de"], w["ate"] = (i + alto[0]) / sr, (i + alto[-1]) / sr
    return pal


# ---------------------------------------------------------------- roteiro
def _limpar_roteiro(txt):
    txt = txt.replace("\ufeff", "")
    txt = re.sub(r"<break[^>]*>", " ⏸ ", txt)             # pausa combinada
    txt = re.sub(r"\[[^\]]*\]", " ", txt)                  # direção entre colchetes (v3 e v4)
    return re.sub(r"<[^>]+>", " ", txt)


def _palavras(linha, itens):
    """Põe em itens as palavras de uma linha do roteiro: {p, n, sinal: '' | ',' | '.' , pausa: bool} por palavra."""
    for bruto in linha.split():
        if bruto == "⏸":
            if itens:
                itens[-1]["pausa"] = True
            continue
        n = norm(bruto)
        if not n:
            if itens and re.search(r"[.!?…]", bruto):
                itens[-1]["sinal"] = "."
            elif itens and re.search(r"[,;:–—-]", bruto) and itens[-1]["sinal"] != ".":
                itens[-1]["sinal"] = ","
            continue
        fim = re.search(r"[.!?…]+[\"'”’)]*$", bruto)
        meio = re.search(r"[,;:]+[\"'”’)]*$", bruto)
        itens.append({"p": bruto.strip("\"'“”‘’()").rstrip(".,;:!?…"), "bruto": bruto, "n": n, "sinal": "." if fim else ("," if meio else ""), "pausa": False})


def _texto_da_tela(itens, ini, fim, tela):
    """Linha com "fala" diferente do "texto": o trecho da fala que difere ganha a forma do texto como alternativa.
    itens[i]["alt"] = [(i1, forma)]: itens[i:i1] também vale como `forma`."""
    t = [p for p in _limpar_roteiro(tela).split() if norm(p)]
    f = [x["n"] for x in itens[ini:fim]]
    for op, f0, f1, t0, t1 in difflib.SequenceMatcher(None, f, [norm(p) for p in t], autojunk=False).get_opcodes():
        if op == "replace":
            itens[ini + f0].setdefault("alt", []).append((ini + f1, forma(t[t0:t1])))


def ler_roteiro(arq):
    txt = io.open(arq, encoding="utf-8").read().replace("\ufeff", "")
    itens = []
    if arq.lower().endswith(".json"):
        # o roteiro.json do kit: cada bloco vira uma linha, como no vo.txt que o montar.mjs grava
        try:
            dados = json.loads(txt)
        except ValueError as e:
            falha("%s não é um JSON válido (%s)" % (arq, e))
        blocos = dados.get("blocos") if isinstance(dados, dict) else None
        if not isinstance(blocos, list) or not blocos:
            falha("%s precisa de blocos[].linhas[], cada linha com \"texto\" (e \"fala\", se a voz diz outra coisa): o formato do kit/roteiro.json" % arq)
        for bloco in blocos:
            tem = False
            for l in bloco.get("linhas", []):
                fala, tela = l.get("fala") or l.get("texto") or "", l.get("texto") or ""
                linha, ini = _limpar_roteiro(fala), len(itens)
                _palavras(linha, itens)
                tem = tem or bool(linha.split())
                if l.get("fala") and tela and tela != fala:
                    _texto_da_tela(itens, ini, len(itens), tela)
            if itens and tem:
                itens[-1]["quebra"] = True                 # fim do bloco vale como fim de frase
        return itens
    for linha in _limpar_roteiro(txt).splitlines():
        _palavras(linha, itens)
        if itens and linha.split():
            itens[-1]["quebra"] = True                     # fim de linha do roteiro vale como fim de frase
    return itens


@functools.lru_cache(maxsize=None)
def _forma(palavras):
    return forma(list(palavras))


def alinhar(rot, pal, iguais):
    """Casa cada palavra do roteiro com a palavra ouvida. Devolve (pares, faltaram, sobraram, parecidas, equivalentes).

    equivalentes: trechos que dizem o mesmo com outra grafia ("dois mil e trinta e três" = "2033",
    "cê bê ésse" = "CBS") ou com a palavra da tela (o "texto" de uma linha com "fala" no roteiro.json)."""
    troca = lambda n: iguais.get(n, n)
    a, b = [troca(x["n"]) for x in rot], [troca(norm(x["p"])) for x in pal]
    pares, faltaram, sobraram, parecidas, equivalentes = {}, [], [], [], []

    def resto(i1, i2, j1, j2):
        """O trecho que não casou nem pela forma: palavra parecida, palavras juntas ou falta."""
        if i2 - i1 == j2 - j1:
            for k in range(i2 - i1):
                if difflib.SequenceMatcher(None, a[i1 + k], b[j1 + k]).ratio() >= 0.72:
                    pares[i1 + k] = j1 + k
                    parecidas.append((rot[i1 + k]["p"], pal[j1 + k]["p"]))
                else:
                    faltaram.append(i1 + k); sobraram.append(j1 + k)
        # trechos de tamanhos diferentes: "WhatsApp" x "whats app". Juntas dão a mesma palavra?
        elif i2 > i1 and j2 > j1 and difflib.SequenceMatcher(None, "".join(a[i1:i2]), "".join(b[j1:j2])).ratio() >= 0.8:
            for k in range(i1, i2):
                pares[k] = min(j1 + (k - i1), j2 - 1)
            parecidas.append((" ".join(x["p"] for x in rot[i1:i2]), " ".join(x["p"] for x in pal[j1:j2])))
        else:
            faltaram.extend(range(i1, i2)); sobraram.extend(range(j1, j2))

    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                pares[i1 + k] = j1 + k
            continue
        # a mesma coisa em outra grafia: número por extenso, sigla soletrada, palavra da tela
        alt = {}
        for k in range(i1, i2):
            for k1, f in rot[k].get("alt", ()):
                if k1 <= i2:
                    alt.setdefault((k - i1, k1 - i1), set()).add(f)
        ouvidas = [pal[j]["p"] if b[j] == norm(pal[j]["p"]) else b[j] for j in range(j1, j2)]
        ia, ja = i1, j1
        for x0, x1, y0, y1 in casar([x["p"] for x in rot[i1:i2]], ouvidas, alt):
            resto(ia, i1 + x0, ja, j1 + y0)
            for k in range(x1 - x0):
                pares[i1 + x0 + k] = j1 + y0 + k * (y1 - y0) // (x1 - x0)
            equivalentes.append((" ".join(x["p"] for x in rot[i1 + x0:i1 + x1]), " ".join(x["p"] for x in pal[j1 + y0:j1 + y1])))
            ia, ja = i1 + x1, j1 + y1
        resto(ia, i2, ja, j2)
    return pares, faltaram, sobraram, parecidas, equivalentes


def achar_fala(alvo, rot, pal, pares, iguais):
    """Onde se ouve o começo de `alvo` (o texto de uma marca 'fala'): os inícios possíveis, em s.

    Procura na transcrição (a mesma palavra, ou a mesma forma: "cê bê ésse" = "CBS") e no roteiro
    alinhado: "Dois mil" é o começo de "dois mil e trinta e três", que a transcrição escreveu "2033"."""
    troca = lambda n: iguais.get(n, n)
    palavras = [p for p in str(alvo).split() if norm(p)]
    alvo_n = [troca(norm(p)) for p in palavras]
    if not alvo_n:
        return []
    f_alvo, cand = forma(palavras), set()
    ouv = [troca(norm(x["p"])) for x in pal]
    for j in range(len(pal)):
        jan = ouv[j:j + len(alvo_n)]
        if jan == alvo_n or (len(alvo_n) == 1 and difflib.SequenceMatcher(None, jan[0], alvo_n[0]).ratio() >= 0.8) \
                or any(_forma(tuple(x["p"] for x in pal[j:j + k])) == f_alvo for k in range(1, min(12, len(pal) - j) + 1)):
            cand.add(pal[j]["de"])
    ro = [troca(x["n"]) for x in rot]
    for i in range(len(rot)):
        if i not in pares:
            continue
        if ro[i:i + len(alvo_n)] == alvo_n or any(f == f_alvo for _, f in rot[i].get("alt", ())) \
                or any(_forma(tuple(x["p"] for x in rot[i:i + k])) == f_alvo for k in range(1, min(12, len(rot) - i) + 1)):
            cand.add(pal[pares[i]]["de"])
    return sorted(cand)


# ---------------------------------------------------------------- medidas
def db(x):
    import numpy as np
    return 20 * math.log10(max(1e-6, float(np.sqrt((x.astype(np.float64) ** 2).mean())))) if len(x) else -120.0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("arquivo"); ap.add_argument("--roteiro", required=True); ap.add_argument("--eventos"); ap.add_argument("--sfx")
    ap.add_argument("--motor", choices=("scribe", "whisper")); ap.add_argument("--modelo", default="medium"); ap.add_argument("--lingua", default="pt")
    ap.add_argument("--igual", action="append", default=[]); ap.add_argument("--out"); ap.add_argument("--json", action="store_true"); ap.add_argument("--refazer", action="store_true")
    o = ap.parse_args()
    for arq in (o.arquivo, o.roteiro, o.eventos, o.sfx):
        if arq and not os.path.isfile(arq):
            falha("não achei " + arq)
    pasta = o.out or os.path.join(os.path.dirname(os.path.abspath(o.arquivo)), "ouvir")
    os.makedirs(pasta, exist_ok=True)
    iguais = {}
    for par in o.igual:
        if "=" not in par:
            falha("--igual é no formato roteiro=transcrito, ex.: lumina=lumena")
        x, y = (norm(p) for p in par.split("=", 1))
        iguais[y] = x

    chave = None
    if o.motor != "whisper":
        try:
            import voice
            chave = voice.get_key(required=False)
        except Exception:
            chave = os.environ.get("ELEVENLABS_API_KEY")
    motor = o.motor or ("scribe" if chave else "whisper")
    if motor == "scribe" and not chave:
        falha("sem chave da ElevenLabs para o Scribe; rode com --motor whisper", 3)

    # transcrição, guardada pela impressão digital do som: rodar de novo não paga de novo
    wav = os.path.join(tempfile.gettempdir(), "ouvir-%s.wav" % uuid.uuid4().hex[:10])
    extrair(o.arquivo, wav)
    try:
        marca = hashlib.md5(open(wav, "rb").read()).hexdigest()[:16]
        guarda = os.path.join(pasta, "transcricao-%s-%s.json" % (motor if motor == "scribe" else "whisper-" + o.modelo, marca))
        if os.path.isfile(guarda) and not o.refazer:
            pal = json.load(io.open(guarda, encoding="utf-8"))
        else:
            pal = scribe(wav, o.lingua, chave) if motor == "scribe" else whisper(wav, o.lingua, o.modelo)
            pal = ajustar_ao_som(pal, wav)
            json.dump(pal, io.open(guarda, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    finally:
        try:
            os.remove(wav)
        except OSError:
            pass
    if not pal:
        falha("a transcrição voltou vazia: o arquivo tem fala?", 3)

    rot = ler_roteiro(o.roteiro)
    if not rot:
        falha("o roteiro está vazio")
    pares, faltaram, sobraram, parecidas, equivalentes = alinhar(rot, pal, iguais)
    alertas, res = {"S1": [], "S2": [], "S3": [], "S4": []}, {}

    # ---- S1 fala inteira
    grupos = []
    for i in sorted(faltaram):
        if grupos and i == grupos[-1][-1] + 1:
            grupos[-1].append(i)
        else:
            grupos.append([i])
    for g in grupos:
        pal_g = [rot[i]["p"] for i in g]
        trecho = " ".join(pal_g) if len(g) <= 8 else " ".join(pal_g[:5]) + " ... " + " ".join(pal_g[-3:])
        alertas["S1"].append("não ouvi \"%s\"%s (depois de \"%s\")" % (trecho, " (%d palavras seguidas)" % len(g) if len(g) > 1 else "",
                             " ".join(x["p"] for x in rot[max(0, g[0] - 3):g[0]]) or "o começo"))
    for j in sobraram:
        if not any(j == jj for jj in pares.values()):
            alertas["S1"].append("ouvi \"%s\" aos %s s, que não está no roteiro" % (pal[j]["p"], br(pal[j]["de"])))
    res["S1"] = {"palavras_do_roteiro": len(rot), "ouvidas": len(pares), "parecidas": parecidas, "equivalentes": equivalentes}

    # ---- S2 pausas no lugar
    pausas = []
    for i in range(len(rot) - 1):
        if i not in pares or i + 1 not in pares or pares[i + 1] <= pares[i]:
            continue
        a, b = pal[pares[i]], pal[pares[i + 1]]
        vao = b["de"] - a["ate"]
        fim_de_frase = rot[i]["sinal"] == "." or rot[i].get("quebra")
        combinada = rot[i]["pausa"] or rot[i]["sinal"] or rot[i].get("quebra")
        pausas.append({"depois_de": rot[i]["p"], "antes_de": rot[i + 1]["p"], "t": round(a["ate"], 2), "s": round(vao, 2), "sinal": rot[i]["sinal"] or ("⏸" if rot[i]["pausa"] else "")})
        if not combinada and vao >= PAUSA_NO_MEIO[motor]:
            alertas["S2"].append("pausa de %s s no meio da frase, entre \"%s\" e \"%s\" (aos %s s): corte ou emenda no lugar errado?" % (br(vao), rot[i]["p"], rot[i + 1]["p"], br(a["ate"])))
        if fim_de_frase and vao < EMENDA[motor]:
            alertas["S2"].append("frases emendadas: só %s s entre \"%s\" e \"%s\" (aos %s s)" % (br(max(0, vao)), rot[i]["p"], rot[i + 1]["p"], br(a["ate"])))
    res["S2"] = {"pausas": pausas}

    # ---- S3 fala e tela juntas
    ligados, avisos = [], []
    if o.eventos:
        ev = json.load(io.open(o.eventos, encoding="utf-8"))
        ev = ev.get("events", ev) if isinstance(ev, dict) else ev
        for e in ev:
            if e.get("type") == "word" and norm(str(e.get("label", ""))):          # palavra de M.words: aviso, sem portão
                w_n, t = iguais.get(norm(e["label"]), norm(e["label"])), float(e["t"])
                perto = [x["de"] for x in pal if iguais.get(norm(x["p"]), norm(x["p"])) == w_n and abs(x["de"] - t) <= 1.5]
                if perto:
                    d = t - min(perto, key=lambda x: abs(x - t))
                    if not (JANELA_TELA[motor][0] <= d <= JANELA_TELA[motor][1]):
                        avisos.append("a palavra \"%s\" entra na tela aos %s s e é ouvida %s s %s" % (e["label"], br(t), br(abs(d)), "antes" if d > 0 else "depois"))
                continue
            alvo = e.get("fala") or (e.get("label") if e.get("type") == "fala" else None)
            if not alvo:
                continue
            t = float(e["t"])
            cand = achar_fala(alvo, rot, pal, pares, iguais)
            if not cand:
                alertas["S3"].append("a marca dos %s s espera \"%s\", que não ouvi na narração" % (br(t), alvo))
                continue
            ouv = min(cand, key=lambda x: abs(x - t))
            d = t - ouv
            ligados.append({"tela": e.get("label", "") if e.get("fala") else "", "fala": alvo, "entra": round(t, 2), "ouvida": round(ouv, 2), "dif": round(d, 2)})
            if not (JANELA_TELA[motor][0] <= d <= JANELA_TELA[motor][1]):
                alertas["S3"].append("o texto entra aos %s s e \"%s\" é ouvida aos %s s (%s%s s): %s" % (
                    br(t), alvo, br(ouv), "+" if d > 0 else "", br(d), "a tela chega atrasada" if d > 0 else "a tela chega cedo demais"))
    res["S3"] = {"ligados": ligados, "avisos": avisos}

    # ---- S4 mixagem enxuta
    mix, sr = amostras(o.arquivo)
    dur = len(mix) / sr
    falas = []                                             # trechos de fala: palavras com menos de 0,30 s entre elas
    for w in pal:
        if falas and w["de"] - falas[-1][1] < 0.30:
            falas[-1][1] = max(falas[-1][1], w["ate"])
        else:
            falas.append([w["de"], w["ate"]])
    niveis = [(a, b, db(mix[int(a * sr):int(b * sr)])) for a, b in falas if b - a >= 0.40]
    sfx_t = []
    if o.sfx:
        lista = json.load(io.open(o.sfx, encoding="utf-8"))
        sfx_t = [float(x["t"]) for x in lista if "t" in x]
        nomes = [os.path.basename(str(x.get("sfx", ""))) for x in lista]
    vaos = [(falas[i][1] + 0.10, falas[i + 1][0] - 0.10) for i in range(len(falas) - 1)]
    vaos = [(a, b) for a, b in vaos if b - a >= 0.20 and not any(a - 0.45 < t < b for t in sfx_t)]
    m4 = {"duracao": round(dur, 2)}
    if len(niveis) >= 2:
        alto, baixo = max(niveis, key=lambda x: x[2]), min(niveis, key=lambda x: x[2])
        m4["volume_entre_frases_db"] = round(alto[2] - baixo[2], 1)
        if alto[2] - baixo[2] > VOLUME_ENTRE_FRASES:
            alertas["S4"].append("as frases variam %s dB entre si (a dos %s s é a mais alta, a dos %s s a mais baixa): nivelar frase a frase" % (br(alto[2] - baixo[2], 1), br(alto[0], 1), br(baixo[0], 1)))
    if vaos and niveis:
        import numpy as np
        f = float(np.mean([n for _, _, n in niveis])); t = float(np.mean([db(mix[int(a * sr):int(b * sr)]) for a, b in vaos]))
        m4["trilha_abaixo_da_fala_db"] = round(f - t, 1); m4["vaos_medidos"] = len(vaos)
        if f - t < TRILHA_ABAIXO:
            alertas["S4"].append("nos vãos entre as frases a trilha fica só %s dB abaixo da fala: alta demais, ou sobe e desce a cada frase" % br(f - t, 1))
    if o.sfx:
        por10 = len(sfx_t) / max(dur, 1e-6) * 10
        m4["efeitos"] = len(sfx_t); m4["efeitos_por_10s"] = round(por10, 1)
        if sfx_t:
            mais = max(set(nomes), key=nomes.count)
            m4["efeito_mais_repetido"] = [mais, nomes.count(mais)]
        if por10 > EFEITOS_POR_10S:
            alertas["S4"].append("%d efeitos em %s s (%s a cada 10 s; %d são \"%s\"): tirar até sobrar o que marca um momento" % (len(sfx_t), br(dur, 1), br(por10, 1), nomes.count(mais), mais))
    res["S4"] = m4

    estado = {k: ("ALERTA" if v else "PASS") for k, v in alertas.items()}
    if not o.eventos or not ligados and not alertas["S3"]:
        estado["S3"] = "NÃO MEDIDO"
    saida = {"arquivo": o.arquivo, "motor": motor if motor == "scribe" else "whisper-" + o.modelo, "portoes": estado, "alertas": alertas, "medidas": res,
             "transcrito": " ".join(w["p"] for w in pal)}
    json.dump(saida, io.open(os.path.join(pasta, "ouvir.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if o.json:
        print(json.dumps(saida, ensure_ascii=False, indent=1))
    else:
        print("SOM  %s  %s s  transcrito por %s (ninguém ouviu: é medida)" % (os.path.basename(o.arquivo), br(dur), saida["motor"]))
        print("  TRANSCRITO: " + saida["transcrito"])
        print("  ROTEIRO:    " + " ".join(x["bruto"] for x in rot))
        for a, b in parecidas:
            print("  grafia: o roteiro diz \"%s\" e a transcrição escreveu \"%s\" (conferir a pronúncia de ouvido)" % (a, b))
        if equivalentes:
            print("  outra grafia, mesma fala: " + "; ".join("\"%s\" = \"%s\"" % (a, b) for a, b in equivalentes[:8]) + (" e mais %d" % (len(equivalentes) - 8) if len(equivalentes) > 8 else ""))
        longas = sorted(pausas, key=lambda p: -p["s"])[:4]
        if longas:
            print("  pausas mais longas: " + "; ".join("%s s depois de \"%s\"%s" % (br(p["s"]), p["depois_de"], " " + p["sinal"] if p["sinal"] else " (sem sinal)") for p in longas))
        for l in ligados:
            print("  tela x fala: texto aos %6s s; \"%s\" ouvida aos %6s s  (%s%s)%s" % (br(l["entra"]), l["fala"], br(l["ouvida"]), "+" if l["dif"] > 0 else "", br(l["dif"]), "  " + l["tela"][:40] if l["tela"] else ""))
        for a in avisos[:12]:
            print("  aviso (sem portão): " + a)
        print("PORTÕES DE SOM")
        linha = {
            "S1": "%d de %d palavras do roteiro ouvidas, na ordem" % (len(pares), len(rot)),
            "S2": "%d pausas medidas entre palavras" % len(pausas),
            "S3": ("%d textos ligados a uma fala, de %s a %s s" % (len(ligados), br(min(l["dif"] for l in ligados)), br(max(l["dif"] for l in ligados)))) if ligados
                  else "nenhuma marca do tipo \"fala\" no filme" + ("" if o.eventos else " (faltou --eventos)"),
            "S4": "; ".join(x for x in (
                "frases dentro de %s dB" % br(m4["volume_entre_frases_db"], 1) if "volume_entre_frases_db" in m4 else "",
                "trilha %s dB abaixo da fala" % br(m4["trilha_abaixo_da_fala_db"], 1) if "trilha_abaixo_da_fala_db" in m4 else "sem vão livre para medir a trilha",
                "%d efeitos (%s a cada 10 s)" % (m4["efeitos"], br(m4["efeitos_por_10s"], 1)) if "efeitos" in m4 else "efeitos não contados (faltou --sfx)") if x),
        }
        nome = {"S1": "fala inteira", "S2": "pausas no lugar", "S3": "fala e tela juntas", "S4": "mixagem enxuta"}
        for k in ("S1", "S2", "S3", "S4"):
            print("  %s %-19s %-10s  %s" % (k, nome[k], estado[k], linha[k]))
            for a in alertas[k]:
                print("       -> " + a)
    sys.exit(1 if any(alertas.values()) else 0)


if __name__ == "__main__":
    main()
