// Monta a narração final a partir das tomadas: escolhe, FRASE A FRASE, a
// melhor tomada de cada bloco pela medida (como terminou, variação, ritmo,
// pausas de pontuação, palavras que o Whisper não reconheceu), corta cada
// frase guardando a respiração antes dela, nivela o volume frase a frase e
// emenda com pausas fixas. Não gasta nada: só lê as tomadas já pagas.
//
// Saída em ../film/audio/: vo.wav, vo.words.json, vo.lines.json (uma linha
// por frase) e vo.plano.json (de onde veio cada frase e onde ela ficou).
//
//   node montar.mjs [--forcar entrar:2=3,...]   (frase 2 do bloco entrar da tomada 3)
import { execFileSync, spawnSync } from "node:child_process";
const require_spawn = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8" }); return (r.stderr || "") + (r.stdout || ""); };
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const argR = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const ROTEIRO = JSON.parse(readFileSync(join(AQUI, "..", argR("roteiro", "roteiro.json")), "utf8"));
const TOMADAS = join(AQUI, "tomadas");
const SAIDA = join(AQUI, "..", "film", argR("audio", "audio"));
const TMP = join(AQUI, argR("audio", "audio") === "audio" ? "tmp" : "tmp-" + argR("audio", "audio"));
mkdirSync(SAIDA, { recursive: true });
mkdirSync(TMP, { recursive: true });

const PAUSA = { frase: 0.42, pergunta: 0.34, linha: 0.6, bloco: 1.15 };
const SR = 48000;
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
    // Frase reescrita depois da tomada: só ela sai; as outras frases da tomada continuam valendo.
    const antiga = linhas.map((l, i) => norm(l.text) !== norm(esperadas[i] || ""));
    if (linhas.length !== esperadas.length || antiga.every(Boolean)) { console.log(`  ${bloco.id}-${n}: frases não batem com o roteiro, fora`); continue; }
    if (antiga.some(Boolean)) console.log(`  ${bloco.id}-${n}: frase(s) ${antiga.map((a, i) => (a ? i + 1 : 0)).filter(Boolean).join(", ")} com texto antigo, fora`);
    for (let s = 0; s < linhas.length; s++) {
      if (antiga[s]) continue;
      const l = linhas[s], m = medida.linhas[s] || {};
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
      const anterior = linhas[s - 1], seguinte = linhas[s + 1];
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
let t = 0;
const pecas = [];
const palavrasFinais = [], linhasFinais = [];
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
  const ganho = ALVO_DB - Number(mI[1]);
  const peca = join(TMP, `p${String(i).padStart(3, "0")}.wav`);
  ffmpeg(["-ss", ini.toFixed(3), "-to", fim.toFixed(3), "-i", wav, "-af", `volume=${ganho.toFixed(2)}dB,afade=t=in:d=0.02,afade=t=out:st=${(fim - ini - 0.03).toFixed(3)}:d=0.03`, "-ar", String(SR), "-ac", "1", peca]);
  const desloc = t - ini;
  for (const p of f.palavras) palavrasFinais.push({ word: p.word, start: +(p.start + desloc).toFixed(3), end: +(p.end + desloc).toFixed(3), linha: f.linha, bloco: f.bloco });
  linhasFinais.push({ text: f.texto, start: +(f.ini + desloc).toFixed(3), end: +(f.fim + desloc).toFixed(3), linha: f.linha, bloco: f.bloco });
  f.noFilme = { ini: +(f.ini + desloc).toFixed(3), fim: +(f.fim + desloc).toFixed(3) };
  t += fim - ini;
  pecas.push(peca);
  const prox = plano[i + 1];
  if (prox) {
    // Pausas: do roteiro (`pausas` geral; `pausaDepois` e `pausaFrase` por bloco), senão as de PAUSA.
    const P = { ...PAUSA, ...(ROTEIRO.pausas || {}) };
    const blocoAtual = ROTEIRO.blocos.find((b) => b.id === f.bloco) || {};
    const gap = prox.bloco !== f.bloco ? (blocoAtual.pausaDepois ?? P.bloco)
      : prox.linha !== f.linha ? (blocoAtual.pausaFrase ?? P.linha)
      : /\?$/.test(f.texto) ? P.pergunta : (blocoAtual.pausaFrase ?? P.frase);
    // A respiração da próxima já entra na peça dela: a pausa conta só o silêncio entre as duas.
    const preProx = Math.max(0, Math.min(RESP, prox.livreAntes - 0.06));
    const silencio = Math.max(0.05, gap - pos - preProx);
    const s = join(TMP, `s${String(i).padStart(3, "0")}.wav`);
    ffmpeg(["-f", "lavfi", "-i", `anullsrc=r=${SR}:cl=mono`, "-t", silencio.toFixed(3), s]);
    pecas.push(s);
    t += silencio;
  }
}
const lista = join(TMP, "lista.txt");
writeFileSync(lista, pecas.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ffmpeg(["-f", "concat", "-safe", "0", "-i", lista, "-c", "pcm_s16le", join(SAIDA, "vo.wav")]);
writeFileSync(join(SAIDA, "vo.words.json"), JSON.stringify(palavrasFinais, null, 1));
writeFileSync(join(SAIDA, "vo.lines.json"), JSON.stringify(linhasFinais, null, 1));
writeFileSync(join(SAIDA, "vo.plano.json"), JSON.stringify(plano.map(({ palavras, ...r }) => r), null, 1));
writeFileSync(join(SAIDA, "vo.txt"), ROTEIRO.blocos.map((b) => b.linhas.map((l) => l.fala || l.texto).join(" ")).join("\n"));

for (const f of plano) console.log(`${f.bloco.padEnd(10)} ${f.linha} f${f.frase} tomada ${f.tomada} pena ${f.pena}${f.motivos.length ? " (" + f.motivos.join("; ") + ")" : ""} | alt ${f.alternativas.join(" ")}`);
console.log(`\nvo.wav: ${t.toFixed(2)} s, ${plano.length} frases`);
