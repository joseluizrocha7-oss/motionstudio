// Monta a narração final a partir das tomadas: escolhe, FRASE A FRASE, a
// melhor tomada de cada bloco pela medida (como terminou, variação, ritmo,
// pausas de pontuação, palavras que o Whisper não reconheceu), corta cada
// frase guardando a respiração antes dela, nivela o volume frase a frase (em
// LUFS e, depois, pela régua do portão S4 do ouvir.py: um ganho fino por trecho
// de fala até a mediana do RMS da parte falada) e emenda com pausas fixas. Não
// gasta nada: só lê as tomadas já pagas.
//
// Saída em ../film/audio/: vo.wav, vo.words.json, vo.lines.json (uma linha
// por frase) e vo.plano.json (de onde veio cada frase, onde ela ficou e o
// nível dela: ganhoLufs e, em trechos, o RMS falado e o ganho fino de cada
// trecho que o S4 vê, com os segundos no vo.wav).
//
//   node montar.mjs [--forcar entrar:2=3,...] [--fino 4]
//     --forcar  a frase 2 do bloco entrar vem da tomada 3
//     --fino    limite do ganho fino por trecho, em dB (padrão 4; 0 desliga o ganho fino)
import { execFileSync, spawnSync } from "node:child_process";
const require_spawn = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8" }); return (r.stderr || "") + (r.stdout || ""); };
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const argR = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const ROTEIRO = JSON.parse(readFileSync(join(AQUI, "..", argR("roteiro", "roteiro.json")), "utf8"));
// Uma pasta de tomadas por voz (roteiro.voz.pasta): o montar.mjs nunca mistura duas vozes.
const TOMADAS = join(AQUI, ROTEIRO.voz.pasta || "tomadas");
const SAIDA = join(AQUI, "..", "film", argR("audio", "audio"));
const TMP = join(AQUI, argR("audio", "audio") === "audio" ? "tmp" : "tmp-" + argR("audio", "audio"));
mkdirSync(SAIDA, { recursive: true });
mkdirSync(TMP, { recursive: true });

const PAUSA = { frase: 0.42, pergunta: 0.34, linha: 0.6, bloco: 1.15 };
const SR = 48000;
const FINO_MAX = Number(argR("fino", "4"));   // dB: quanto o ganho fino pode subir ou descer cada trecho
if (!Number.isFinite(FINO_MAX) || FINO_MAX < 0) throw new Error(`--fino precisa de um número de dB maior ou igual a 0 (veio "${argR("fino", "")}")`);
const PICO_MAX_DB = -1;                       // dBFS: o ganho fino nunca leva o pico do trecho acima disto
const LIMITE_S4 = 4.0;                        // dB: VOLUME_ENTRE_FRASES do scripts/ouvir.py (só para o aviso no fim)
const forcar = {};
const iF = process.argv.indexOf("--forcar");
if (iF > 0) for (const par of process.argv[iF + 1].split(",")) { const [k, v] = par.split("="); forcar[k] = Number(v); }

const frasesDe = (texto) => texto.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function ffmpeg(args) { return execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" }); }
function rmsDbFalado(wav, ini, fim) {
  // Volume da parte falada: RMS das janelas de 50 ms acima de -45 dB.
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(ini), "-to", String(fim), "-i", wav, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 28 });
  const n = Math.floor(raw.length / 2), j = 800;
  const dbs = [];
  for (let k = 0; k + j <= n; k += j) {
    let s = 0;
    for (let i = k; i < k + j; i++) { const v = raw.readInt16LE(i * 2) / 32768; s += v * v; }
    const db = 10 * Math.log10(s / j + 1e-12);
    if (db > -45) dbs.push(db);
  }
  if (!dbs.length) return -60;
  const lin = dbs.reduce((a, d) => a + 10 ** (d / 10), 0) / dbs.length;
  return 10 * Math.log10(lin);
}

const plano = [];
for (const bloco of ROTEIRO.blocos) {
  const fala = bloco.linhas.map((l) => l.fala || l.texto).join(" ");
  const esperadas = frasesDe(fala);
  // A que linha do roteiro cada frase pertence.
  const linhaDaFrase = [];
  for (const l of bloco.linhas) for (const _ of frasesDe(l.fala || l.texto)) linhaDaFrase.push(l.id);
  const tomadas = readdirSync(TOMADAS).filter((f) => f.startsWith(`${bloco.id}-`) && f.endsWith(".medida.json")).map((f) => Number(f.slice(bloco.id.length + 1).split(".")[0])).sort((a, b) => a - b);
  const candidatas = {};
  for (const n of tomadas) {
    const base = join(TOMADAS, `${bloco.id}-${n}`);
    const linhas = JSON.parse(readFileSync(`${base}.lines.json`, "utf8"));
    const palavras = JSON.parse(readFileSync(`${base}.words.json`, "utf8"));
    const medida = JSON.parse(readFileSync(`${base}.medida.json`, "utf8"));
    // Cada frase da tomada vale para a frase do roteiro com o MESMO texto, em qualquer posição:
    // frase reescrita, tirada ou posta no meio do bloco (rodada 4) não invalida as outras.
    const usadas = new Set();
    const destino = linhas.map((l) => { const k = esperadas.findIndex((e, j) => !usadas.has(j) && norm(e) === norm(l.text)); if (k >= 0) usadas.add(k); return k; });
    if (destino.every((k) => k < 0)) { console.log(`  ${bloco.id}-${n}: nenhuma frase bate com o roteiro, fora`); continue; }
    if (destino.some((k) => k < 0)) console.log(`  ${bloco.id}-${n}: frase(s) ${destino.map((k, i) => (k < 0 ? i + 1 : 0)).filter(Boolean).join(", ")} com texto antigo, fora`);
    for (let i = 0; i < linhas.length; i++) {
      const s = destino[i];
      if (s < 0) continue;
      const l = linhas[i], m = medida.linhas[i] || {};
      const pergunta = /\?$/.test(l.text.trim());
      let pena = 0;
      const motivos = [];
      if (!pergunta && typeof m.termina_st === "number" && m.termina_st > -2) { pena += (m.termina_st + 2) * 0.8; motivos.push(`termina ${m.termina_st}`); }
      if (typeof m.variacao_st === "number" && m.variacao_st < 2) { pena += (2 - m.variacao_st) * 2; motivos.push(`monótona ${m.variacao_st}`); }
      if (typeof m.silabas_s === "number" && m.silabas_s > 6.6) { pena += (m.silabas_s - 6.6) * 2.5; motivos.push(`corrida ${m.silabas_s}`); }
      for (const sinal of medida.sinais || []) {
        const w = palavras.find((p) => p.word === sinal.depois_de && p.start >= l.start - 0.01 && p.end <= l.end + 0.01);
        if (w && sinal.curta && sinal.tipo !== "ponto") { pena += 1.6; motivos.push(`sem pausa após "${sinal.depois_de}"`); }
      }
      const estimadas = palavras.filter((p) => p.est && p.start >= l.start - 0.01 && p.end <= l.end + 0.01).length;
      if (estimadas) { pena += estimadas * 3; motivos.push(`${estimadas} palavra(s) não reconhecida(s)`); }
      const anterior = linhas[i - 1], seguinte = linhas[i + 1];
      (candidatas[s] ||= []).push({ n, s, pena, motivos, ini: l.start, fim: l.end, texto: l.text,
        livreAntes: anterior ? l.start - anterior.end : l.start, livreDepois: seguinte ? seguinte.start - l.end : 9,
        palavras: palavras.filter((p) => p.start >= l.start - 0.01 && p.end <= l.end + 0.01) });
    }
  }
  let anterior = null;
  for (let s = 0; s < esperadas.length; s++) {
    const lista = (candidatas[s] || []).map((c) => ({ ...c, total: c.pena + (anterior !== null && c.n !== anterior ? 0.4 : 0) })).sort((a, b) => a.total - b.total);
    if (!lista.length) throw new Error(`Nenhuma tomada válida para a frase ${s + 1} do bloco ${bloco.id}`);
    const chave = `${bloco.id}:${s + 1}`;
    const escolhida = forcar[chave] ? lista.find((c) => c.n === forcar[chave]) : lista[0];
    anterior = escolhida.n;
    plano.push({ bloco: bloco.id, linha: linhaDaFrase[s], frase: s + 1, tomada: escolhida.n, pena: Number(escolhida.pena.toFixed(2)), motivos: escolhida.motivos, texto: escolhida.texto,
      ini: escolhida.ini, fim: escolhida.fim, livreAntes: escolhida.livreAntes, livreDepois: escolhida.livreDepois, palavras: escolhida.palavras,
      alternativas: lista.slice(1, 4).map((c) => `${c.n}:${c.pena.toFixed(1)}`) });
  }
}

// Corta, nivela e emenda.
const ALVO_DB = -20;   // LUFS de cada frase
// Quanto se guarda antes (a respiração) e depois de cada frase. O roteiro pode encurtar
// (`respiracao`, `cauda`): a versão de 1 minuto precisa de vãos menores que 0,49 s.
const RESP = ROTEIRO.respiracao ?? 0.32, CAUDA = ROTEIRO.cauda ?? 0.12;
// O fim da frase pelo Whisper chega cedo: em "Tecnologia da Informação." a voz seguia 0,28 s
// depois dele e a cauda de 0,12 s cortou o "-ção" ("cortou seco", Jose, 17/10). O fim de cada
// frase passa a ser o silêncio medido na tomada: o primeiro trecho de 80 ms abaixo de -50 dB
// depois do fim do Whisper, sem passar da próxima frase da tomada nem de 0,8 s.
function fimReal(wav, fim, livre) {
  const ate = Math.min(fim + 0.8, fim + livre - 0.06);
  if (ate <= fim) return fim;
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", fim.toFixed(3), "-to", ate.toFixed(3), "-i", wav, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 26 });
  const n = Math.floor(raw.length / 2), j = 160;   // janelas de 10 ms
  let quietas = 0;
  for (let k = 0; k + j <= n; k += j) {
    let s = 0;
    for (let i = k; i < k + j; i++) { const v = raw.readInt16LE(i * 2) / 32768; s += v * v; }
    if (10 * Math.log10(s / j + 1e-12) < -50) { if (++quietas === 8) return fim + (k + j) / 16000 - 0.08; } else quietas = 0;
  }
  return ate;
}
for (const f of plano) {
  const real = fimReal(join(TOMADAS, `${f.bloco}-${f.tomada}.wav`), f.fim, f.livreDepois);
  f.estendido = +(real - f.fim).toFixed(3);
  f.livreDepois -= real - f.fim;
  f.fim = real;
}
const longas = plano.filter((f) => f.estendido > CAUDA);
console.log(`fim pelo silêncio: ${longas.length} de ${plano.length} frases iam além da cauda de ${CAUDA} s (até +${Math.max(0, ...plano.map((f) => f.estendido)).toFixed(2)} s)`);

function lerFloat(arq) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", arq, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length - (raw.length % 4)));
}

// Passo 1: corta cada frase e nivela em LUFS. A peça fica em ponto flutuante (sem arredondar nem cortar
// o pico) em f.x até o ganho fino.
for (let i = 0; i < plano.length; i++) {
  const f = plano[i];
  const wav = join(TOMADAS, `${f.bloco}-${f.tomada}.wav`);
  const pre = Math.max(0, Math.min(RESP, f.livreAntes - 0.06));
  const pos = Math.max(0, Math.min(CAUDA, f.livreDepois - 0.06));
  const ini = Math.max(0, f.ini - pre), fim = f.fim + pos;
  // Ganho pela sonoridade da frase (EBU R128), não pelo RMS: é o que o ouvido compara.
  // A medida EBU precisa de blocos de 0,4 s: frase curta ("Errou?") é medida numa janela de
  // pelo menos 0,8 s em volta dela (o silêncio ao lado fica abaixo do limiar e não conta).
  const folga = Math.max(0, (0.8 - (f.fim - f.ini)) / 2);
  const r = require_spawn("ffmpeg", ["-hide_banner", "-nostats", "-ss", String(Math.max(0, f.ini - folga)), "-to", String(f.fim + folga), "-i", wav, "-af", "ebur128", "-f", "null", "-"]);
  const mI = /I:\s+(-?[\d.]+) LUFS/.exec(r.slice(r.lastIndexOf("Summary")));
  if (!mI || Number(mI[1]) < -60) throw new Error(`não li a sonoridade da frase ${f.bloco}:${f.frase}`);
  f.ganhoLufs = +(ALVO_DB - Number(mI[1])).toFixed(2);
  f.corte = { ini, fim, pos };
  f.bruta = join(TMP, `b${String(i).padStart(3, "0")}.wav`);
  ffmpeg(["-ss", ini.toFixed(3), "-to", fim.toFixed(3), "-i", wav, "-af", `volume=${f.ganhoLufs.toFixed(2)}dB,afade=t=in:d=0.02,afade=t=out:st=${(fim - ini - 0.03).toFixed(3)}:d=0.03`, "-ar", String(SR), "-ac", "1", "-c:a", "pcm_f32le", f.bruta]);
  f.x = lerFloat(f.bruta);
}

// Linha do tempo: onde cada peça cai no vo.wav (f.comeca) e quanto silêncio vem depois dela. Não depende do
// ganho, então dá para medir o nível no tempo final, que é o que o S4 vê.
let t = 0;
for (let i = 0; i < plano.length; i++) {
  const f = plano[i];
  const { ini, fim, pos } = f.corte;
  f.comeca = t;
  f.desloc = t - ini;
  t += fim - ini;
  const prox = plano[i + 1];
  f.silencio = null;
  if (prox) {
    // Pausas: do roteiro (`pausas` geral; `pausaDepois` e `pausaFrase` por bloco), senão as de PAUSA.
    const P = { ...PAUSA, ...(ROTEIRO.pausas || {}) };
    const blocoAtual = ROTEIRO.blocos.find((b) => b.id === f.bloco) || {};
    const gap = prox.bloco !== f.bloco ? (blocoAtual.pausaDepois ?? P.bloco)
      : prox.linha !== f.linha ? (blocoAtual.pausaFrase ?? P.linha)
      : /\?$/.test(f.texto) ? P.pergunta : (blocoAtual.pausaFrase ?? P.frase);
    // A respiração da próxima já entra na peça dela: a pausa conta só o silêncio entre as duas.
    const preProx = Math.max(0, Math.min(RESP, prox.livreAntes - 0.06));
    f.silencio = Math.max(0.05, gap - pos - preProx);
    t += f.silencio;
  }
}

// Passo 2: ganho fino pela régua do portão S4 do ouvir.py. O LUFS iguala o que o ouvido compara, mas o S4 mede o
// RMS da parte falada, e em LUFS igual ele pode passar de 4 dB entre frases. O S4 compara TRECHOS: palavras com menos
// de 0,30 s entre elas formam um trecho, e só valem os de 0,40 s ou mais (uma frase com pausa de 0,30 s ou mais no meio
// tem 2 trechos; frases com menos de 0,30 s entre elas formam um trecho só). Aqui os trechos saem das palavras no tempo
// final do vo.wav, igual ao S4. Cada trecho ganha o ajuste que leva o RMS dele à mediana dos trechos, limitado a
// ±FINO_MAX dB e ao pico de PICO_MAX_DB. O ganho muda no meio da pausa entre dois trechos, numa rampa de RAMPA_FINO s.
const RAMPA_FINO = 0.04;
const palavrasNoFilme = plano.flatMap((f) => f.palavras.map((p) => ({ de: p.start + f.desloc, ate: p.end + f.desloc, frase: f })));
const trechos = [];
for (const p of palavrasNoFilme) {
  const ult = trechos[trechos.length - 1];
  if (ult && p.de - ult.ate < 0.30) ult.ate = Math.max(ult.ate, p.ate);
  else trechos.push({ de: p.de, ate: p.ate, frase: p.frase });
}
// Passa por cada trecho de [a, b) do filme nas peças que ele cobre: o que ficar fora das peças é silêncio (energia 0).
function paraAmostras(a, b, fn) {
  for (const f of plano) {
    const lo = Math.max(a, f.comeca), hi = Math.min(b, f.comeca + f.x.length / SR);
    if (hi <= lo) continue;
    fn(f.x, Math.max(0, Math.round((lo - f.comeca) * SR)), Math.min(f.x.length, Math.round((hi - f.comeca) * SR)));
  }
}
// Fronteira entre o trecho k e o k+1: o meio da pausa.
const fronteira = trechos.slice(1).map((tr, k) => (trechos[k].ate + tr.de) / 2);
trechos.forEach((tr, k) => {
  tr.medido = tr.ate - tr.de >= 0.40;
  tr.rms = null;
  if (tr.medido) {
    let soma = 0;
    paraAmostras(tr.de, tr.ate, (x, i, j) => { for (let n = i; n < j; n++) soma += x[n] * x[n]; });
    tr.rms = 20 * Math.log10(Math.max(1e-6, Math.sqrt(soma / Math.max(1, Math.round((tr.ate - tr.de) * SR)))));
  }
  // Pico da região do trecho (do meio da pausa anterior ao meio da pausa seguinte): o ganho não pode estourá-lo.
  let pico = 0;
  paraAmostras(k ? fronteira[k - 1] : -Infinity, k < fronteira.length ? fronteira[k] : Infinity, (x, i, j) => { for (let n = i; n < j; n++) pico = Math.max(pico, Math.abs(x[n])); });
  tr.picoDb = 20 * Math.log10(Math.max(1e-6, pico));
});
const medidos = trechos.filter((tr) => tr.medido).map((tr) => tr.rms).sort((a, b) => a - b);
const mediana = medidos.length ? (medidos[(medidos.length - 1) >> 1] + medidos[medidos.length >> 1]) / 2 : null;
for (const tr of trechos) {
  tr.ganho = 0;
  tr.limite = null;
  if (mediana === null || !tr.medido || FINO_MAX === 0) continue;
  const pedido = mediana - tr.rms;
  let g = Math.max(-FINO_MAX, Math.min(FINO_MAX, pedido));
  if (g !== pedido) tr.limite = "máximo";
  const cabe = Math.max(0, PICO_MAX_DB - tr.picoDb);
  if (g > cabe) { g = cabe; tr.limite = "pico"; }
  tr.ganho = +g.toFixed(2);
}
// Trecho curto (o S4 não mede) fica com o ganho do trecho medido mais perto, o anterior primeiro.
trechos.forEach((tr, k) => {
  if (tr.medido) return;
  const antes = trechos.slice(0, k).reverse().find((o) => o.medido), depois = trechos.slice(k + 1).find((o) => o.medido);
  tr.ganho = (antes ?? depois)?.ganho ?? 0;
  tr.herdado = true;
});
const espalhamento = (valores) => (valores.length ? Math.max(...valores) - Math.min(...valores) : 0);
const espalhamentoAntes = espalhamento(trechos.filter((tr) => tr.medido).map((tr) => tr.rms));
const espalhamentoDepois = espalhamento(trechos.filter((tr) => tr.medido).map((tr) => tr.rms + tr.ganho));
for (const f of plano) f.trechos = [];
for (const tr of trechos) {
  tr.frase.trechos.push({ de: +tr.de.toFixed(3), ate: +tr.ate.toFixed(3), rmsFalado: tr.rms === null ? null : +tr.rms.toFixed(2),
    ganhoFino: tr.ganho, picoDb: +tr.picoDb.toFixed(2), limite: tr.limite, ...(tr.herdado ? { herdado: true } : {}) });
}

// Ganho da peça amostra a amostra: o do trecho da região, com rampa linear de RAMPA_FINO s em cada fronteira.
const ganhoLinear = trechos.length ? trechos.map((tr) => 10 ** (tr.ganho / 20)) : [1];
function aplicarGanhoFino(f) {
  const y = new Float32Array(f.x.length);
  const meia = RAMPA_FINO / 2;
  let k = 0;
  for (let n = 0; n < y.length; n++) {
    const u = f.comeca + n / SR;
    while (k < fronteira.length && u >= fronteira[k]) k++;
    let g = ganhoLinear[k];
    if (k > 0 && u < fronteira[k - 1] + meia) g = ganhoLinear[k - 1] + (ganhoLinear[k] - ganhoLinear[k - 1]) * ((u - (fronteira[k - 1] - meia)) / RAMPA_FINO);
    else if (k < fronteira.length && u >= fronteira[k] - meia) g = ganhoLinear[k] + (ganhoLinear[k + 1] - ganhoLinear[k]) * ((u - (fronteira[k] - meia)) / RAMPA_FINO);
    y[n] = f.x[n] * g;
  }
  return y;
}

const pecas = [];
const palavrasFinais = [], linhasFinais = [];
for (let i = 0; i < plano.length; i++) {
  const f = plano[i];
  const peca = join(TMP, `p${String(i).padStart(3, "0")}.wav`);
  const y = aplicarGanhoFino(f);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s16le", peca], { input: Buffer.from(y.buffer) });
  const desloc = f.desloc;
  for (const p of f.palavras) palavrasFinais.push({ word: p.word, start: +(p.start + desloc).toFixed(3), end: +(p.end + desloc).toFixed(3), linha: f.linha, bloco: f.bloco });
  linhasFinais.push({ text: f.texto, start: +(f.ini + desloc).toFixed(3), end: +(f.fim + desloc).toFixed(3), linha: f.linha, bloco: f.bloco });
  f.noFilme = { ini: +(f.ini + desloc).toFixed(3), fim: +(f.fim + desloc).toFixed(3) };
  pecas.push(peca);
  if (f.silencio !== null) {
    const s = join(TMP, `s${String(i).padStart(3, "0")}.wav`);
    ffmpeg(["-f", "lavfi", "-i", `anullsrc=r=${SR}:cl=mono`, "-t", f.silencio.toFixed(3), s]);
    pecas.push(s);
  }
}
const lista = join(TMP, "lista.txt");
writeFileSync(lista, pecas.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ffmpeg(["-f", "concat", "-safe", "0", "-i", lista, "-c", "pcm_s16le", join(SAIDA, "vo.wav")]);
writeFileSync(join(SAIDA, "vo.words.json"), JSON.stringify(palavrasFinais, null, 1));
writeFileSync(join(SAIDA, "vo.lines.json"), JSON.stringify(linhasFinais, null, 1));
writeFileSync(join(SAIDA, "vo.plano.json"), JSON.stringify(plano.map(({ palavras, bruta, corte, x, comeca, desloc, silencio, ...r }) => r), null, 1));
writeFileSync(join(SAIDA, "vo.txt"), ROTEIRO.blocos.map((b) => b.linhas.map((l) => l.fala || l.texto).join(" ")).join("\n"));

for (const f of plano) console.log(`${f.bloco.padEnd(10)} ${f.linha} f${f.frase} tomada ${f.tomada} pena ${f.pena}${f.motivos.length ? " (" + f.motivos.join("; ") + ")" : ""} | alt ${f.alternativas.join(" ")}`);

// Ganho fino por trecho (régua do S4), na frase onde o trecho começa: segundos no vo.wav, RMS falado de antes, ganho
// aplicado e o limite que segurou o ganho.
const sinal = (x) => (x >= 0 ? "+" : "-") + Math.abs(x).toFixed(1);
console.log(`\nganho fino pela régua do S4 (RMS falado até a mediana de ${mediana === null ? "-" : mediana.toFixed(1)} dB; no máximo ±${FINO_MAX} dB e pico até ${PICO_MAX_DB} dBFS):`);
for (const f of plano) {
  for (const tr of f.trechos) {
    const nivel = tr.rmsFalado === null ? "(menos de 0,40 s: o S4 não mede)" : `RMS falado ${tr.rmsFalado.toFixed(1)} dB`;
    console.log(`${f.bloco.padEnd(10)} ${f.linha} f${f.frase}  ${tr.de.toFixed(2)} a ${tr.ate.toFixed(2)} s  ${nivel}  ganho fino ${sinal(tr.ganhoFino)} dB${tr.limite ? ` (limitado pelo ${tr.limite})` : ""}`);
  }
}
console.log(`espalhamento do RMS falado: ${espalhamentoAntes.toFixed(1)} dB antes, ${espalhamentoDepois.toFixed(1)} dB depois (o S4 acusa acima de ${LIMITE_S4.toFixed(1)} dB)`);
console.log(`\nvo.wav: ${t.toFixed(2)} s, ${plano.length} frases`);
