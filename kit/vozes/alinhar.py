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
"""
import difflib, io, json, re, subprocess, sys, unicodedata
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
modelo = sys.argv[sys.argv.index("--modelo") + 1] if "--modelo" in sys.argv else "medium"
wav, roteiro_arq = args[0], args[1]
roteiro = open(roteiro_arq, encoding="utf-8").read()
texto = re.sub(r"<[^>]+>", " ", roteiro)
texto = re.sub(r"\s+", " ", texto).strip()

def norm(p):
    p = unicodedata.normalize("NFD", p.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", p)

# Áudio em 16 kHz mono (o decode do faster-whisper quebra nesta máquina: ffmpeg direto).
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                     capture_output=True, check=True).stdout
amostras = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
dur = len(amostras) / 16000

from faster_whisper import WhisperModel
m = WhisperModel(modelo, device="cpu", compute_type="int8", local_files_only=True)
segs, _ = m.transcribe(amostras, language="pt", word_timestamps=True, beam_size=2, vad_filter=False,
                       initial_prompt=None, condition_on_previous_text=False)
ouvidas = [{"p": w.word.strip(), "ini": w.start, "fim": w.end} for s in segs for w in (s.words or [])]

# Palavras do roteiro (com a pontuação colada, que é o que o entonacao lê).
tokens = texto.split(" ")
alvo = [norm(t) for t in tokens]
fonte = [norm(w["p"]) for w in ouvidas]
mapa = [None] * len(tokens)
sm = difflib.SequenceMatcher(a=alvo, b=fonte, autojunk=False)
for bloco in sm.get_matching_blocks():
    for k in range(bloco.size):
        mapa[bloco.a + k] = bloco.b + k
# Trechos que não casaram palavra a palavra: reparte o tempo das ouvidas entre as do roteiro.
for tag, a0, a1, b0, b1 in sm.get_opcodes():
    if tag in ("replace", "delete") and a1 > a0:
        if b1 > b0:
            ini, fim = ouvidas[b0]["ini"], ouvidas[b1 - 1]["fim"]
        else:
            ant = next((mapa[j] for j in range(a0 - 1, -1, -1) if isinstance(mapa[j], int)), None)
            ini = ouvidas[ant]["fim"] if ant is not None else 0.0
            fim = ini + 0.05
        n = a1 - a0
        for k in range(n):
            mapa[a0 + k] = ("est", ini + (fim - ini) * k / n, ini + (fim - ini) * (k + 1) / n)

palavras = []
for i, t in enumerate(tokens):
    if isinstance(mapa[i], int):
        w = ouvidas[mapa[i]]
        palavras.append({"word": t, "start": float(w["ini"]), "end": float(w["fim"])})
    else:
        _, ini, fim = mapa[i]
        palavras.append({"word": t, "start": float(ini), "end": float(fim), "est": True})

# Energia em janelas de 10 ms para achar o silêncio entre palavras.
jan = 160
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

for i in range(len(palavras) - 1):
    a, b = palavras[i], palavras[i + 1]
    s = silencio_entre(a["end"] - 0.25, b["start"] + 0.25)
    if s and s[0] > a["start"] + 0.06 and s[1] < b["end"] - 0.06:
        a["end"], b["start"] = s[0], s[1]
if palavras:
    palavras[-1]["end"] = min(palavras[-1]["end"], dur)

# Linhas = frases do roteiro.
linhas, atual = [], []
for p in palavras:
    atual.append(p)
    if re.search(r"[.!?…]$", p["word"]):
        linhas.append({"text": " ".join(x["word"] for x in atual), "start": atual[0]["start"], "end": atual[-1]["end"]})
        atual = []
if atual:
    linhas.append({"text": " ".join(x["word"] for x in atual), "start": atual[0]["start"], "end": atual[-1]["end"]})

base = re.sub(r"\.[a-z0-9]+$", "", wav, flags=re.I)
json.dump(palavras, open(base + ".words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(linhas, open(base + ".lines.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
ouvido = " ".join(w["p"] for w in ouvidas)
estimadas = sum(1 for p in palavras if p.get("est"))
print(f"{wav}: {dur:.2f} s, {len(palavras)} palavras ({estimadas} estimadas), {len(linhas)} frases")
print(f"ouvido ({modelo}): {ouvido}")
