#!/usr/bin/env python3
"""medir-musica.py - mede o andamento (BPM), a fase da batida e o tom de uma faixa de música.

Feito para a faixa da Lyria que o gerar-som.mjs põe no filme: o modo comercial afina os
efeitos no tom medido e grava a grade das batidas. Só numpy; o ffmpeg decodifica o arquivo.

Uso:
  py -3 medir-musica.py <arquivo> [--inicio 0] [--dur 0] [--bpm-min 60] [--bpm-max 200]

  --inicio, --dur        o trecho medido, em segundos (--dur 0 = até o fim)
  --bpm-min, --bpm-max   a faixa de andamento procurada

Saída: JSON no stdout.
  bpm              andamento, em batidas por minuto
  batida_s         duração de uma batida (60 / bpm), em segundos
  primeira_batida  instante da primeira batida da grade, de 0 a batida_s, contado de --inicio:
                   a batida k cai em primeira_batida + k * batida_s. É a pulsação, não o
                   primeiro tempo do compasso.
  forca_batida     0 a 1: quanto a faixa se repete no período da batida. Abaixo de 0,3 a grade
                   não é confiável (faixa sem percussão, por exemplo).
  andamento_incerto  true quando um rival a 2:1, 1:2, 4:3, 3:4, 3:2 ou 2:3 do andamento chega a
                   85 % da nota do vencedor (batida dobrada, pela metade ou pontuada)
  rival_bpm, rival_razao  o rival mais forte e a nota dele sobre a do vencedor (0 a 1)
  tom, modo        a tônica (C, C#, Db, D ... B, com a grafia usual do tom) e "maior" ou "menor"
  nome             o tom em português ("Lá menor", "Si bemol maior")
  tonica_hz        a tônica na 4ª oitava (Lá = 440 Hz)
  correlacao       a correlação do cromagrama com o perfil do tom (-1 a 1)
  segundo          o 2º tom mais provável e a correlação dele
  incerto          true quando o 1º e o 2º tom ficam a menos de 0,05 de correlação
  cromagrama       energia de cada classe de altura (C a B), a maior = 1
  tolerancias      as tolerâncias abaixo

Método:
  andamento  envelope de ataques linear: a magnitude do espectro em faixas de 1/4 de oitava
             (40 Hz a 10 kHz), só o que sobe de um quadro para o outro, soma das faixas. O golpe
             forte (bumbo, caixa) pesa mais que a semicolcheia do chimbal e do arpejo.
             Autocorrelação desse envelope, com preferência por 120 BPM (log-normal, 1 oitava de
             desvio). O rival mais forte nas razões métricas sai em rival_bpm.
  fase       envelope de ataques linear, em janela curta (23 ms, passo de 2,9 ms), com cada faixa
             dividida pela média dela. Ajuste fino por pente: o período (passos de 0,05 BPM e
             depois 0,005 BPM, até 3 % do aproximado) e a fase (passos de 1 ms) em que a soma do
             envelope na grade é máxima.
  tom        cromagrama: energia do espectro somada por classe de altura, de 65 a 2100 Hz, depois
             da mediana de 1,4 s no tempo (o que dura pouco, como bumbo e palma, sai). Comparado
             por correlação com os perfis de Krumhansl e Kessler (1982) nos 24 tons.

Tolerâncias (medidas com sinais sintéticos nos testes; em música de verdade, confira de ouvido):
  bpm +-0,5; primeira_batida +-0,015 s (meio quadro a 30 fps); tom e modo exatos.
  Medido em 29/10/2026, só com sinais sintéticos:
  - batida pop (bumbo, palma, chimbal em colcheia, acorde) de 84 a 140 BPM, 39 casos: todos
    certos, erro até 0,011 BPM e 5,0 ms, tom certo em todos;
  - cliques de 84 a 174 BPM (84 e 90 com contratempo a -6 dB), 44 casos: todos certos, até
    0,01 BPM e 1,7 ms. Saem com andamento_incerto os de 160 e 174 (rival na metade, que também
    é uma pulsação válida) e 2 dos 4 de 84;
  - balada a 76 BPM com semicolcheia de chimbal e arpejo, bumbo no 1, no "a" do 2 e no 3:
    76,0 BPM, rival 101,3 a 0,29. Batida de 124 BPM com bumbo em todo tempo: 124,0;
  - acordes de 6 harmônicos em 8 tons: tom e modo certos em todos.
Limites conhecidos:
  - com andamento_incerto: true, confira de ouvido. Para forçar um dos dois, passe --bpm-min e
    --bpm-max numa faixa que tem o certo e não tem o outro (mediu 140 com rival 70: --bpm-max 100);
  - pulsação lenta com contratempo forte pode sair dobrada SEM aviso: cliques a 60 BPM com
    contratempo a -6 dB medem 120 (rival 60 a 0,72). Cliques a 70 medem 140 com aviso. Em música
    lenta, passe --bpm-max abaixo do dobro do andamento esperado;
  - eco pontuado forte puxa o andamento para 4/3: a trilha de código do kit (100 BPM) mede 133,
    com andamento_incerto (o rival apontado é 175, não 100). O tom dela sai certo (Ré maior);
  - música sem percussão: forca_batida baixa e grade sem valor.

Saída 0 = medido; 1 = erro de leitura; 2 = erro de uso.
"""
import argparse, io, json, subprocess, sys

import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SR = 22050
N_ANDAMENTO, HOP_ANDAMENTO = 1024, 256                 # 46 ms, passo de 11,6 ms
N_FASE, HOP_FASE = 512, 64                             # 23 ms, passo de 2,9 ms
# Envelope linear com janela de Hann: o ataque seco dá o máximo com o centro da janela N/4 antes
# dele, e a diferença entre dois quadros fica no meio deles (HOP/2). Soma-se isto ao tempo.
ATRASO_FASE = (N_FASE / 4 - HOP_FASE / 2) / SR
N_TOM, HOP_TOM = 16384, 2048                           # cromagrama: 1,35 Hz por faixa (separa as notas graves), passo de 93 ms
MEDIANA_TOM = 15                                       # quadros na mediana do cromagrama (1,4 s)
TOLERANCIAS = {"bpm": 0.5, "primeira_batida_s": 0.015, "tom": "exato", "modo": "exato"}
RIVAL_PERTO = 0.85                                     # rival com 85 % da nota do vencedor: andamento_incerto

# Grafia usual de cada tom (Si bemol maior, Sol sustenido menor), com o nome em português.
NOMES = {"maior": ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"],
         "menor": ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"]}
LETRA_PT = {"C": "Dó", "D": "Ré", "E": "Mi", "F": "Fá", "G": "Sol", "A": "Lá", "B": "Si"}
# Krumhansl e Kessler (1982): peso de cada classe de altura num tom, a tônica no índice 0.
PERFIL = {
    "maior": np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]),
    "menor": np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]),
}


def falha(msg, cod=1):
    print("erro: " + msg, file=sys.stderr)
    sys.exit(cod)


def nome_pt(classe, modo):
    n = NOMES[modo][classe]
    acidente = {"#": " sustenido", "b": " bemol"}.get(n[1:], "")
    return "%s%s %s" % (LETRA_PT[n[0]], acidente, modo)


def ler(arq, inicio, dur):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(inicio), "-i", arq] + (["-t", str(dur)] if dur > 0 else []) + ["-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode:
        falha("o ffmpeg não leu %s: %s" % (arq, r.stderr.decode("utf-8", "replace").strip()[:300]))
    x = np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
    if len(x) < SR:
        falha("menos de 1 s de áudio em %s" % arq)
    return x


def faixas(x, n_fft, hop):
    """Energia por faixa de 1/4 de oitava (40 Hz a 10 kHz), um quadro a cada hop (janela centrada)."""
    pad = np.concatenate([np.zeros(n_fft // 2), x, np.zeros(n_fft // 2)])
    n = 1 + (len(pad) - n_fft) // hop
    jan = np.hanning(n_fft)
    f = np.fft.rfftfreq(n_fft, 1 / SR)
    bordas = 40 * 2 ** (np.arange(0, np.log2(10000 / 40) * 4 + 1) / 4)
    grupos = [(f >= a) & (f < b) for a, b in zip(bordas[:-1], bordas[1:])]
    grupos = [g for g in grupos if g.any()]
    partes = []
    for ini in range(0, n, 4096):
        idx = np.arange(ini, min(n, ini + 4096))[:, None] * hop + np.arange(n_fft)[None, :]
        P = np.abs(np.fft.rfft(pad[idx] * jan, axis=1)) ** 2
        partes.append(np.stack([P[:, g].sum(axis=1) for g in grupos], axis=1))
    return np.vstack(partes)


def so_o_que_sobe(o, hop):
    """Tira a média local (0,5 s) e fica só com o que passa dela."""
    w = max(1, int(0.5 * SR / hop))
    return np.maximum(0.0, o - np.convolve(o, np.ones(w) / w, mode="same"))


def envelope_andamento(x):
    # Magnitude linear, sem igualar as faixas: o golpe forte (bumbo, caixa) pesa mais que o
    # chimbal e o arpejo. Em dB, a semicolcheia uniforme empatava todos os múltiplos dela, e a
    # preferência por 120 BPM escolhia 3/4 da batida (76 BPM saía 101).
    B = np.sqrt(faixas(x, N_ANDAMENTO, HOP_ANDAMENTO))
    o = np.concatenate([[0.0], np.maximum(0.0, np.diff(B, axis=0)).sum(axis=1)])
    return so_o_que_sobe(o, HOP_ANDAMENTO)


def envelope_fase(x):
    B = np.sqrt(faixas(x, N_FASE, HOP_FASE))           # magnitude: o atraso do máximo não depende do volume
    B = B / (B.mean(axis=0) + 1e-3 * B.mean() + 1e-12)
    o = np.concatenate([[0.0], np.maximum(0.0, np.diff(B, axis=0)).sum(axis=1)])
    return so_o_que_sobe(o, HOP_FASE)


def suavizar(o, sigma):
    k = np.arange(-int(4 * sigma), int(4 * sigma) + 1)
    g = np.exp(-0.5 * (k / sigma) ** 2)
    return np.convolve(o, g / g.sum(), mode="same")


def andamento(o, fps, bpm_min, bpm_max):
    """BPM aproximado, força da batida e o rival mais forte numa razão métrica (BPM, nota/nota do vencedor).

    Pela autocorrelação com preferência por 120 BPM. Rival: o melhor candidato em 2, 1/2, 4/3, 3/4,
    3/2 ou 2/3 vezes o andamento escolhido (batida dobrada, pela metade ou pontuada)."""
    v = o - o.mean()
    n = len(v)
    F = np.fft.rfft(v, 2 * n)
    ac = np.fft.irfft(F * np.conj(F))[:n]
    if ac[0] <= 0:
        return None, 0.0, None, 0.0
    ac = ac / ac[0]
    lo, hi = int(np.ceil(60 / bpm_max * fps)), min(n - 1, int(60 / bpm_min * fps))
    if hi <= lo:
        return None, 0.0, None, 0.0
    lags = np.arange(lo, hi + 1)
    nota = ac[lo:hi + 1] * np.exp(-0.5 * np.log2(60 * fps / lags / 120) ** 2)
    j = int(np.argmax(nota))
    k = lags[j]
    rival, razao = None, 0.0
    if nota[j] > 0:
        for r in (2, 1 / 2, 4 / 3, 3 / 4, 3 / 2, 2 / 3):
            a, b = max(lo, int(np.floor(k / r - 2))), min(hi, int(np.ceil(k / r + 2)))
            if a > b:
                continue
            jr = a - lo + int(np.argmax(nota[a - lo:b - lo + 1]))
            if nota[jr] / nota[j] > razao:
                razao, rival = float(nota[jr] / nota[j]), 60 * fps / lags[jr]
    return 60 * fps / k, float(max(0.0, ac[k])), rival, razao


def pente(o, fps, bpms):
    """O período (entre os bpms dados) e a fase (passo 1 ms) de maior soma do envelope na grade."""
    quadros = np.arange(len(o))
    melhor = (-1.0, float(bpms[0]), 0.0)
    for bpm in bpms:
        P = 60 * fps / bpm
        nb = int((len(o) - 1 - P) // P) + 1
        if nb < 2:
            continue
        fases = np.arange(0, P, 0.001 * fps)
        s = np.interp(fases[:, None] + P * np.arange(nb)[None, :], quadros, o).mean(axis=1)
        j = int(np.argmax(s))
        if s[j] > melhor[0]:
            melhor = (float(s[j]), float(bpm), float(fases[j]))
    return melhor[1], melhor[2]


def tom(x):
    jan = np.hanning(N_TOM)
    f = np.fft.rfftfreq(N_TOM, 1 / SR)
    sel = (f >= 65) & (f <= 2100)
    classe = np.round(69 + 12 * np.log2(f[sel] / 440)).astype(int) % 12
    if len(x) < N_TOM:
        x = np.concatenate([x, np.zeros(N_TOM - len(x))])
    S = np.stack([np.abs(np.fft.rfft(x[i:i + N_TOM] * jan))[sel] for i in range(0, len(x) - N_TOM + 1, HOP_TOM)])
    # Só o que se sustenta: a mediana no tempo (1,4 s) de cada faixa de frequência. Bumbo, palma e
    # chimbal duram pouco e somem da mediana; o bumbo que desce de 110 a 50 Hz puxaria a terça.
    k = min(MEDIANA_TOM, len(S))
    if k > 1:
        borda = np.pad(S, ((k // 2, k - 1 - k // 2), (0, 0)), mode="edge")
        S = np.vstack([np.median(np.lib.stride_tricks.sliding_window_view(borda[i:i + 256 + k - 1], k, axis=0), axis=-1)
                       for i in range(0, len(S), 256)])
    croma = np.bincount(np.tile(classe, len(S)), weights=(S ** 2).ravel(), minlength=12)
    tons = []
    for modo, perfil in PERFIL.items():
        for r in range(12):
            tons.append((float(np.corrcoef(croma, np.roll(perfil, r))[0, 1]), r, modo))
    tons.sort(reverse=True)
    return tons, croma


def main():
    ap = argparse.ArgumentParser(description="Mede andamento, fase da batida e tom de uma faixa de música.")
    ap.add_argument("arquivo")
    ap.add_argument("--inicio", type=float, default=0.0)
    ap.add_argument("--dur", type=float, default=0.0)
    ap.add_argument("--bpm-min", type=float, default=60.0)
    ap.add_argument("--bpm-max", type=float, default=200.0)
    o = ap.parse_args()
    if not (0 < o.bpm_min < o.bpm_max):
        falha("--bpm-min tem que ser maior que 0 e menor que --bpm-max", 2)
    x = ler(o.arquivo, o.inicio, o.dur)
    res = {"arquivo": o.arquivo, "inicio": o.inicio, "duracao": round(len(x) / SR, 3)}

    bpm0, forca, rival0, razao = andamento(suavizar(envelope_andamento(x), 1.0), SR / HOP_ANDAMENTO, o.bpm_min, o.bpm_max)
    if bpm0:
        fps = SR / HOP_FASE
        env = suavizar(envelope_fase(x), 2.0)

        def fino(aprox):
            b, _ = pente(env, fps, np.arange(aprox * 0.97, aprox * 1.03, 0.05))
            return pente(env, fps, np.arange(b - 0.1, b + 0.1, 0.005))
        bpm, fase = fino(bpm0)
        batida = 60 / bpm
        incerto = razao >= RIVAL_PERTO
        res.update({"bpm": round(bpm, 2), "batida_s": round(batida, 4),
                    "primeira_batida": round((fase / fps + ATRASO_FASE) % batida, 4), "forca_batida": round(forca, 3),
                    "andamento_incerto": bool(incerto),
                    "rival_bpm": round(fino(rival0)[0] if incerto else rival0, 2) if rival0 else None,
                    "rival_razao": round(razao, 3)})
    else:
        res.update({"bpm": None, "batida_s": None, "primeira_batida": None, "forca_batida": 0.0,
                    "andamento_incerto": True, "rival_bpm": None, "rival_razao": 0.0})

    tons, croma = tom(x)
    (c1, r1, m1), (c2, r2, m2) = tons[0], tons[1]
    res.update({"tom": NOMES[m1][r1], "modo": m1, "nome": nome_pt(r1, m1),
                "tonica_hz": round(440 * 2 ** ((r1 - 9) / 12), 2), "correlacao": round(c1, 3),
                "segundo": {"tom": NOMES[m2][r2], "modo": m2, "nome": nome_pt(r2, m2), "correlacao": round(c2, 3)},
                "incerto": bool(c1 - c2 < 0.05),
                "cromagrama": [round(float(v), 4) for v in croma / (croma.max() or 1)],
                "tolerancias": TOLERANCIAS})
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
