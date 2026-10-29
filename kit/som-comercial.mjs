// Modo comercial do gerar-som.mjs (kit da skill motionstudio).
//
//   node gerar-som.mjs <eventos.json> --comercial <mapa.json> --total <s>
//        [--musica assets/musica/<faixa>.mp3] [--musica-inicio 0] [--abaixo 20]
//        [--tom A --modo menor] [--pausa <s>] [--pausa-dur 0.2]
//        [--voz audio/vo.wav] [--voz-inicio <s>] [--sem-voz] [--audio audio] [--fala fala.js] [--fps 30]
//
// Efeitos presos aos eventos rotulados do filme (os M.mark que o render grava em
// <mp4>.events.json ou film/stills/events.json), escolhidos por um mapa de rótulo para efeito.
// Os efeitos tonais tocam notas da escala do tom da música: o tom vem de --tom, da medida da
// faixa (scripts/medir-musica.py) ou, sem --musica, da trilha de código (Ré maior).
// Mixagem: voz em -16 LUFS; música 20 dB abaixo (--abaixo), com uma pausa curta opcional e
// descida nos últimos 1,6 s; efeitos no volume do mapa; a mistura em -16 LUFS em 2 passadas
// (loudnorm do ffmpeg: a 1ª mede, a 2ª aplica), pico real até -1,5 dBTP.
// Grava em film/<audio>/: efeitos.wav, musica.wav ou trilha.wav, musica-medida.json,
// sfx-eventos.json (a lista do --sfx do ouvir.py) e mix.wav (48 kHz, estéreo).
//
// O mapa (JSON, UTF-8). Toda regra que casa com um evento põe um efeito nele; duas regras no
// mesmo evento somam dois efeitos. Eventos com o mesmo rótulo no mesmo quadro contam como um só
// (o M.words grava enter e word para cada palavra; vale o enter), então o "subir" anda uma vez
// por palavra. Campo que começa com "_" é comentário.
//   {
//     "efeitos": [
//       { "rotulo": "^abertura$", "efeito": "impacto" },
//       { "tipo": "enter", "rotulo": "^#sigla", "efeito": "pinca", "graus": [5], "subir": 2, "ganho": -3 },
//       { "rotulo": "^ano ", "efeito": "sino", "graus": [8], "subir": 1 },
//       { "rotulo": "^marca$", "efeito": "assinatura", "desvio": 0.05 }
//     ],
//     "pausa": { "rotulo": "^virada$", "dur": 0.2 }
//   }
//   rotulo  expressão regular comparada com o rótulo do evento (3º argumento do M.mark), sem
//           acento e sem diferença de maiúscula. Evento sem rótulo usa o tipo.
//   tipo    o tipo do evento, exato (enter, press, ou o 2º argumento do M.mark). A regra
//           precisa de rotulo, de tipo ou dos dois.
//   efeito  tonais: sino, pinca, sustenta, impacto, assinatura. Do kit, sem nota: pop, ar,
//           cortina. Gravados (efeitos-gravados/): pop-hand, mouse-click-2, fast-whoosh.
//   ganho   dB sobre o volume padrão do efeito (padrão 0; o padrão é o do tutorial).
//   desvio  segundos somados ao instante do evento (padrão 0; negativo adianta).
//   Só nos tonais:
//   graus   graus da escala do tom: 1 = tônica, 3 = terça, 5 = quinta, 8 = tônica uma oitava
//           acima. Em tom menor, a escala é a menor natural.
//   oitava  o registro: 5 = a tônica mais perto do Ré 5 (de Sol sustenido 4 a Sol 5). A nota
//           que soa fica entre 20 Hz e 12 kHz (o impacto e o grave da assinatura descem até a
//           metade da frequência); fora disso o mapa dá erro com a regra.
//   subir   a cada evento seguinte da mesma regra, os graus sobem esse número de passos.
//   arpejo  segundos entre uma nota e a seguinte.
//   dur     duração de cada nota, em segundos.
//   pausa   opcional: a música some nos "dur" segundos (padrão 0,2) antes do instante e volta
//           nele. O instante vem de "t" (s) ou do 1º evento que casa com "rotulo"/"tipo".
//           --pausa <s> e --pausa-dur valem mais que o mapa.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { acharSkill } from "./_skill.mjs";
import { SR, novaFaixa, somar, gravarWav, nota, sopro, trilha, EFEITO, trocaDe, colar } from "./trilha.mjs";

const VOZ_LUFS = -16, LUFS_FINAL = -16, PICO_REAL = -1.5;
const EFEITOS_POR_10S = 12;                            // o limite do S4 no ouvir.py
const DESCIDA = 1.6;                                   // a música desce nos últimos 1,6 s
const RAMPA = 0.015;                                   // a pausa entra e sai em 15 ms, sem estalo
const FREQ_MIN = 20, FREQ_MAX = 12000;                 // nota de efeito tonal: dentro do que se ouve e longe de 24 kHz (metade de 48 kHz)
export const TOM_DA_TRILHA = { classe: 2, modo: "maior" };   // a trilha de código: Ré maior, 100 BPM, ritmo desde 1,2 s

// Os tonais repetem os timbres do trilha.mjs, que é afinado em Ré maior: em Ré maior, "sino" e
// "assinatura" tocam as mesmas notas dos efeitos de mesmo nome do tutorial.
const TONAIS = {
  sino: { graus: [1, 3, 5], oitava: 6, arpejo: 0.065, dur: 1.2 },
  pinca: { graus: [5], oitava: 5, arpejo: 0.075, dur: 0.45 },
  sustenta: { graus: [5], oitava: 4, arpejo: 0, dur: 1.5 },
  impacto: { graus: [1], oitava: 3, arpejo: 0, dur: 1.3 },
  assinatura: { graus: [1, 5, 8, 10], oitava: 5, arpejo: 0.05, dur: 3.2 },
};
const DO_KIT = ["pop", "ar", "cortina"];
const GRAVADOS = { "pop-hand": "pop", "mouse-click-2": "pop", "fast-whoosh": "ar" };   // cada gravado no volume e no pico do sintetizado que ele troca
const TIPOS = [...Object.keys(TONAIS), ...DO_KIT, ...Object.keys(GRAVADOS)];
const CAMPOS = ["rotulo", "tipo", "efeito", "ganho", "desvio", "graus", "oitava", "subir", "arpejo", "dur"];
const SO_TONAIS = ["graus", "oitava", "subir", "arpejo", "dur"];

const ESCALA = { maior: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10] };
const SUSTENIDOS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BEMOIS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
// Grafia usual do tom (a mesma do medir-musica.py) e nome em português.
const NOME_DO_TOM = { maior: ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"], menor: ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"] };
const LETRA_PT = { C: "Dó", D: "Ré", E: "Mi", F: "Fá", G: "Sol", A: "Lá", B: "Si" };

const semAcento = (s) => String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "");
const br = (x, c = 1) => Number(x).toFixed(c).replace(".", ",");
const hzMidi = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------------------------------------------------------------- tom e notas

// "A", "Bb", "F#", "lá", "Si bemol" -> classe de altura (0 = Dó ... 11 = Si).
export function lerTom(s) {
  const t = semAcento(s).toLowerCase().trim().replace(/\s+/g, " ");
  const m = /^(do|re|mi|fa|sol|la|si|[a-g]) ?(#|b|sustenido|bemol)?$/.exec(t);
  if (!m) throw new Error(`tom "${s}" não reconhecido: use C, C#, Db ... B ou Dó, Ré sustenido, Si bemol`);
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 }[m[1]];
  const acidente = { "#": 1, sustenido: 1, b: -1, bemol: -1 }[m[2]] ?? 0;
  return (((base + acidente) % 12) + 12) % 12;
}
function lerModo(s) {
  const m = semAcento(s).toLowerCase().trim();
  if (m !== "maior" && m !== "menor") throw new Error(`--modo "${s}": use maior ou menor`);
  return m;
}
export function nomeDoTom(tom) {
  const n = NOME_DO_TOM[tom.modo][tom.classe];
  return `${LETRA_PT[n[0]]}${{ "#": " sustenido", b: " bemol" }[n.slice(1)] || ""} ${tom.modo}`;
}
// A tônica da oitava n: a mais perto do Ré n (de 6 semitons abaixo a 5 acima). Assim os efeitos
// ficam no registro em que foram desenhados, qualquer que seja o tom.
function tonica(tom, oitava) {
  let st = (((tom.classe - 2) % 12) + 12) % 12;
  if (st > 5) st -= 12;
  return 12 * (oitava + 1) + 2 + st;
}
function midiDoGrau(tom, grau, oitava) {
  const i = grau - 1;
  return tonica(tom, oitava) + ESCALA[tom.modo][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
}
function nomeDaNota(midi, tom) {
  const sustenido = (tom.modo === "maior" ? [0, 7, 2, 9, 4, 11, 6] : [9, 4, 11, 6, 1, 8]).includes(tom.classe);
  return (sustenido ? SUSTENIDOS : BEMOIS)[midi % 12] + (Math.floor(midi / 12) - 1);
}

// ---------------------------------------------------------------- mapa e plano

export function validarMapa(mapa) {
  if (!mapa || typeof mapa !== "object" || !Array.isArray(mapa.efeitos) || !mapa.efeitos.length) throw new Error('o mapa precisa de "efeitos": uma lista de regras (rótulo -> efeito)');
  for (const k of Object.keys(mapa)) if (k !== "efeitos" && k !== "pausa" && !k.startsWith("_")) throw new Error(`mapa: campo desconhecido "${k}" (campos: efeitos, pausa)`);
  const numero = (onde, k, v, cond = () => true) => { if (v != null && !(typeof v === "number" && Number.isFinite(v) && cond(v))) throw new Error(`${onde}: "${k}" inválido (${JSON.stringify(v)})`); };
  const casamento = (onde, r) => {
    if (r.rotulo == null && r.tipo == null) throw new Error(`${onde}: falta "rotulo" ou "tipo" (com qual evento a regra casa)`);
    if (r.tipo != null && typeof r.tipo !== "string") throw new Error(`${onde}: "tipo" tem que ser texto`);
    if (r.rotulo != null) {
      if (typeof r.rotulo !== "string") throw new Error(`${onde}: "rotulo" tem que ser texto (expressão regular)`);
      try { new RegExp(semAcento(r.rotulo), "i"); } catch (e) { throw new Error(`${onde}: "rotulo" não é uma expressão regular válida (${e.message})`); }
    }
  };
  mapa.efeitos.forEach((r, i) => {
    const onde = `regra ${i + 1}`;
    if (!r || typeof r !== "object") throw new Error(`${onde}: tem que ser um objeto`);
    for (const k of Object.keys(r)) if (!CAMPOS.includes(k) && !k.startsWith("_")) throw new Error(`${onde}: campo desconhecido "${k}" (campos: ${CAMPOS.join(", ")})`);
    casamento(onde, r);
    if (!TIPOS.includes(r.efeito)) throw new Error(`${onde}: efeito "${r.efeito}" não existe (use ${TIPOS.join(", ")})`);
    if (!TONAIS[r.efeito]) for (const k of SO_TONAIS) if (r[k] != null) throw new Error(`${onde}: "${k}" só vale para efeito tonal (${Object.keys(TONAIS).join(", ")})`);
    numero(onde, "ganho", r.ganho, (v) => v <= 24);
    numero(onde, "desvio", r.desvio);
    numero(onde, "oitava", r.oitava, (v) => Number.isInteger(v) && v >= 1 && v <= 8);
    numero(onde, "subir", r.subir, Number.isInteger);
    numero(onde, "arpejo", r.arpejo, (v) => v >= 0);
    numero(onde, "dur", r.dur, (v) => v > 0 && v <= 20);
    if (r.graus != null && !(Array.isArray(r.graus) && r.graus.length && r.graus.every(Number.isInteger))) throw new Error(`${onde}: "graus" tem que ser uma lista de números inteiros (1 = tônica)`);
  });
  if (mapa.pausa != null) {
    const p = mapa.pausa;
    if (!p || typeof p !== "object") throw new Error('"pausa" tem que ser um objeto');
    for (const k of Object.keys(p)) if (!["t", "rotulo", "tipo", "dur"].includes(k) && !k.startsWith("_")) throw new Error(`pausa: campo desconhecido "${k}" (campos: t, rotulo, tipo, dur)`);
    if (p.t == null) casamento("pausa", p);
    numero("pausa", "t", p.t, (v) => v >= 0);
    numero("pausa", "dur", p.dur, (v) => v > 0 && v <= 2);
  }
  return mapa;
}

function listaDeEventos(eventos, fps) {
  const lista = Array.isArray(eventos) ? eventos : eventos?.events;
  if (!Array.isArray(lista)) throw new Error("o arquivo de eventos não tem uma lista de eventos");
  const primeiroEnter = (e) => (e.type === "enter" ? 0 : 1);
  return lista.filter((e) => e && typeof e === "object").map((e) => ({ ...e, t: e.t ?? e.frame / fps })).filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t || primeiroEnter(a) - primeiroEnter(b));
}
function casa(r, e) {
  if (r.tipo != null && e.type !== r.tipo) return false;
  return r.rotulo == null || new RegExp(semAcento(r.rotulo), "i").test(semAcento(e.label || e.type || ""));
}

// Um efeito por instante que casa com cada regra, em ordem de tempo.
// tom = { classe: 0..11, modo: "maior" | "menor" }. Devolve { efeitos, semEvento } (semEvento: índices das regras sem evento).
export function planoComercial(eventos, mapa, tom, { fps = 30 } = {}) {
  validarMapa(mapa);
  const lista = listaDeEventos(eventos, fps);
  const efeitos = [], semEvento = [];
  mapa.efeitos.forEach((r, ri) => {
    let k = 0;
    const vistos = new Set();                          // quadro + rótulo: o enter e o word da mesma palavra
    for (const e of lista) {
      if (!casa(r, e)) continue;
      const chave = `${e.frame ?? Math.round(e.t * fps)}|${e.label || e.type || ""}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const ef = { t: +(e.t + (r.desvio ?? 0)).toFixed(4), efeito: r.efeito, ganho: r.ganho ?? 0, evento: [e.type, e.label].filter(Boolean).join(" "), regra: ri, notas: [], hz: [] };
      const padrao = TONAIS[r.efeito];
      if (padrao) {
        const oitava = r.oitava ?? padrao.oitava;
        const midis = (r.graus ?? padrao.graus).map((g) => midiDoGrau(tom, g + (r.subir ?? 0) * k, oitava));
        if (r.efeito === "assinatura") midis.unshift(midiDoGrau(tom, 5, oitava - 3));    // o grave que desce: a quinta, como no tutorial
        const hz = midis.map(hzMidi);
        // impacto e o grave da assinatura descem até a metade da frequência
        const soando = r.efeito === "impacto" ? hz.map((f) => f / 2) : r.efeito === "assinatura" ? [hz[0] / 2, ...hz.slice(1)] : hz;
        if (Math.min(...soando) < FREQ_MIN) throw new Error(`regra ${ri + 1}: a nota mais grave fica em ${br(Math.min(...soando))} Hz, abaixo de ${FREQ_MIN} Hz, em ${nomeDoTom(tom)}: suba "oitava" ou os "graus"`);
        if (Math.max(...hz) > FREQ_MAX) throw new Error(`regra ${ri + 1}: a nota mais aguda fica em ${br(Math.max(...hz), 0)} Hz, acima de ${FREQ_MAX} Hz: desça "oitava", "graus" ou "subir"`);
        Object.assign(ef, { notas: midis.map((m) => nomeDaNota(m, tom)), hz, arpejo: r.arpejo ?? padrao.arpejo, dur: r.dur ?? padrao.dur });
      }
      efeitos.push(ef);
      k++;
    }
    if (!k) semEvento.push(ri);
  });
  efeitos.sort((a, b) => a.t - b.t || a.regra - b.regra);
  return { efeitos, semEvento };
}

export function instanteDaPausa(pausa, eventos, fps = 30) {
  if (pausa.t != null) return pausa.t;
  const e = listaDeEventos(eventos, fps).find((x) => casa(pausa, x));
  if (!e) throw new Error(`pausa: nenhum evento casa com ${JSON.stringify({ rotulo: pausa.rotulo, tipo: pausa.tipo })}`);
  return e.t;
}

// ---------------------------------------------------------------- síntese

// Nota que cresce devagar e some (prepara um momento): par de senoides a ±5 cents, como a cama da trilha.
function crescer(fx, t0, { f, dur, forca, pan = 0 }) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (const cents of [-5, 5]) {
    const w = (2 * Math.PI * f * 2 ** (cents / 1200)) / SR;
    for (let k = 0; k < n; k++) {
      const p = k / n, s = p / 0.75;
      const env = p < 0.75 ? s * s * (3 - 2 * s) : Math.cos((Math.PI / 2) * ((p - 0.75) / 0.25)) ** 2;
      const x = w * k;
      somar(fx, i0 + k, (Math.sin(x) + 0.26 * Math.sin(2 * x) + 0.08 * Math.sin(3 * x)) * env * forca * 0.5, pan);
    }
  }
}

const abrir = (k, n, largura) => (n > 1 ? -largura + (2 * largura * k) / (n - 1) : 0);
const trocas = new Map();
function tocar(fx, t, e, i) {
  const hz = e.hz;
  switch (e.efeito) {
    case "sino":
      hz.forEach((f, k) => nota(fx, t + k * e.arpejo, { f, dur: e.dur, queda: 0.35 * e.dur, forca: 0.062, pan: abrir(k, hz.length, 0.3), brilho: 0.12 }));
      break;
    case "pinca":
      hz.forEach((f, k) => nota(fx, t + k * e.arpejo, { f, dur: e.dur, queda: e.dur / 3, forca: 0.1, pan: abrir(k, hz.length, 0.25), brilho: 0.2 }));
      break;
    case "sustenta":
      hz.forEach((f, k) => crescer(fx, t + k * e.arpejo, { f, dur: e.dur, forca: 0.05, pan: abrir(k, hz.length, 0.3) }));
      break;
    case "impacto":
      hz.forEach((f, k) => nota(fx, t + k * e.arpejo, { f, f2: f / 2, dur: e.dur, queda: 0.32 * e.dur, forca: 0.26, brilho: 0 }));
      break;
    case "assinatura": {
      const [grave, ...sinos] = hz;
      nota(fx, t, { f: grave, f2: grave / 2, dur: 1.3, queda: 0.42, forca: 0.26, brilho: 0 });
      sopro(fx, t - 0.25, { dur: 0.9, forca: 0.11, de: 300, pico: 2600, ate: 900, semente: 71 });
      sinos.forEach((f, k) => nota(fx, t + 0.12 + k * e.arpejo, { f, dur: e.dur, queda: 0.344 * e.dur, forca: 0.05, pan: abrir(k, sinos.length, 0.45), brilho: 0.1 }));
      break;
    }
    default:
      if (GRAVADOS[e.efeito]) {
        if (!trocas.has(e.efeito)) trocas.set(e.efeito, trocaDe(e.efeito, GRAVADOS[e.efeito]));
        const tr = trocas.get(e.efeito);
        colar(fx, t + tr.atraso, tr.som, tr.ganho);
      } else EFEITO[e.efeito](fx, t, i);
  }
}

// Todos os efeitos numa faixa estéreo de "total" segundos. Cada efeito é desenhado numa faixa
// curta e somado com o ganho dele.
export function sintetizar(efeitos, total) {
  const fx = novaFaixa(total);
  const ANTES = 0.5;                                   // a assinatura sopra 0,25 s antes do instante
  efeitos.forEach((e, i) => {
    const ini = Math.floor((e.t - ANTES) * SR);
    const cauda = (e.dur ?? 0) + (e.arpejo ?? 0) * Math.max(0, e.hz.length - 1) + 0.12;   // última nota (a assinatura entra 0,12 s depois) mais a duração dela
    const loc = novaFaixa(ANTES + Math.max(6, cauda + 1));
    tocar(loc, e.t - ini / SR, e, i);
    const g = 10 ** (e.ganho / 20);
    for (let k = 0; k < loc.n; k++) {
      const j = ini + k;
      if (j < 0 || j >= fx.n) continue;
      fx.e[j] += g * loc.e[k];
      fx.d[j] += g * loc.d[k];
    }
  });
  return fx;
}

// ---------------------------------------------------------------- áudio (ffmpeg)

function lufsDe(arq) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const s = r.stderr || "";
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(s.slice(s.lastIndexOf("Summary")));
  if (!m) throw new Error(`não li a sonoridade de ${arq} (arquivo mudo?)`);
  return Number(m[1]);
}
// Amostras em float, 48 kHz, com "canais" canais, cortadas ou completadas até n quadros.
function ler(arq, canais, n) {
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", arq, "-f", "f32le", "-ac", String(canais), "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  const v = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  if (n == null) return v;
  const out = new Float32Array(n * canais);
  out.set(v.subarray(0, Math.min(v.length, out.length)));
  return out;
}
// A faixa desde "inicio", repetida com 4 s de transição até cobrir o filme (como no tutorial).
function montarMusica(arq, inicio, total, saida) {
  if (!existsSync(arq)) throw new Error(`música não encontrada: ${arq}`);
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq], { encoding: "utf8" }));
  const util = dur - inicio;
  if (!(util > 1)) throw new Error(`--musica-inicio ${inicio} deixa menos de 1 s da faixa (${br(dur)} s)`);
  const X = Math.min(4, util / 4);
  const vezes = util >= total ? 1 : 1 + Math.ceil((total - util) / (util - X));
  const entradas = Array.from({ length: vezes }, () => ["-ss", String(inicio), "-i", arq]).flat();
  let filtro = Array.from({ length: vezes }, (_, i) => `[${i}]aresample=${SR},aformat=channel_layouts=stereo[f${i}];`).join("");
  let ultimo = "f0";
  for (let i = 1; i < vezes; i++) { filtro += `[${ultimo}][f${i}]acrossfade=d=${X}:c1=tri:c2=tri[x${i}];`; ultimo = `x${i}`; }
  filtro += `[${ultimo}]atrim=0:${total},asetpts=N/SR/TB,afade=t=in:d=0.01[o]`;
  execFileSync("ffmpeg", ["-v", "error", "-y", ...entradas, "-filter_complex", filtro, "-map", "[o]", "-ar", String(SR), "-c:a", "pcm_s16le", saida]);
  return { dur, vezes };
}
function medirMusica(arq, pastaDoProjeto) {
  const script = join(acharSkill(pastaDoProjeto), "scripts", "medir-musica.py");
  if (!existsSync(script)) throw new Error(`não achei ${script}: confira o motionstudio.json do projeto ou passe --tom e --modo`);
  const [cmd, antes] = process.platform === "win32" ? ["py", ["-3"]] : ["python3", []];
  const r = spawnSync(cmd, [...antes, script, arq], { encoding: "utf8", maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error(`medir-musica.py falhou: ${(r.stderr || r.error?.message || "").trim().slice(0, 400)}`);
  return JSON.parse(r.stdout);
}
const jsonDoFim = (s) => JSON.parse(s.slice(s.lastIndexOf("{"), s.lastIndexOf("}") + 1));

// -16 LUFS em 2 passadas: a 1ª mede, a 2ª aplica o ganho (linear quando o pico real deixa).
function normalizar(mix, saida) {
  const bruto = Buffer.from(mix.buffer, mix.byteOffset, mix.byteLength);
  const entrada = ["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "pipe:0"];
  const alvo = `I=${LUFS_FINAL}:TP=${PICO_REAL}:LRA=20`;
  const p1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...entrada, "-af", `loudnorm=${alvo}:print_format=json`, "-f", "null", "-"], { input: bruto, encoding: "utf8", maxBuffer: 1 << 28 });
  if (p1.status !== 0) throw new Error(`loudnorm (medida) falhou: ${(p1.stderr || "").slice(-400)}`);
  const m = jsonDoFim(p1.stderr);
  if (!Number.isFinite(Number(m.input_i))) throw new Error("a mistura está muda: nada para normalizar");
  const filtro = `loudnorm=${alvo}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
  const p2 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-y", ...entrada, "-af", filtro, "-ar", String(SR), "-c:a", "pcm_s16le", saida], { input: bruto, encoding: "utf8", maxBuffer: 1 << 28 });
  if (p2.status !== 0) throw new Error(`loudnorm (aplicação) falhou: ${(p2.stderr || "").slice(-400)}`);
  return { entrada: Number(m.input_i), tipo: jsonDoFim(p2.stderr).normalization_type };
}
function medidaFinal(arq) {
  const s = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 }).stderr || "";
  const resumo = s.slice(s.lastIndexOf("Summary"));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(resumo)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(resumo)?.[1]) };
}
function offsetDaFala(arq) {
  if (!existsSync(arq)) return 0;
  const js = readFileSync(arq, "utf8");
  return Number(JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1)).offset) || 0;
}

// ---------------------------------------------------------------- o modo comercial

export async function modoComercial(pastaDoProjeto, args) {
  const opcao = (n, p) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] != null ? args[i + 1] : p; };
  const tem = (n) => args.includes(`--${n}`);
  const FILM = join(pastaDoProjeto, "film");
  const AUDIO = join(FILM, opcao("audio", "audio"));
  mkdirSync(AUDIO, { recursive: true });
  const lerJson = (arq, o) => {
    if (!existsSync(arq)) throw new Error(`${o} não encontrado: ${arq}`);
    try { return JSON.parse(readFileSync(arq, "utf8").replace(/^\uFEFF/, "")); }
    catch (e) { throw new Error(`${o} não é um JSON válido (${arq}): ${e.message}`); }
  };

  // Opção numérica: ausente = padrão; texto que não é número ou fora da faixa = erro com o nome dela.
  const numero = (n, padrao, min, max, faixa) => {
    const bruto = opcao(n);
    if (bruto == null) return padrao;
    const v = Number(bruto);
    if (bruto.trim() === "" || !Number.isFinite(v) || v < min || v > max) throw new Error(`--${n} "${bruto}" inválido: use um número ${faixa}`);
    return v;
  };
  if (opcao("total") == null) throw new Error("--total <s> é obrigatório no modo comercial (a duração do filme)");
  const TOTAL = numero("total", null, 0.1, 3600, "de 0,1 a 3600 (a duração do filme, em segundos)");
  const FPS = numero("fps", 30, 1, 240, "de 1 a 240");
  const ABAIXO = numero("abaixo", 20, 0, 60, "de 0 a 60 (dB da música sob a voz)");
  const INICIO_MUSICA = numero("musica-inicio", 0, 0, 36000, "de 0 em diante (segundos)");
  const PAUSA = numero("pausa", null, 0, TOTAL, `de 0 a ${br(TOTAL)} (o instante em que a música volta, dentro do filme)`);
  const PAUSA_DUR = numero("pausa-dur", null, 0.001, 2, "maior que 0 e até 2 (segundos, o mesmo limite do mapa)");
  const INICIO_VOZ = numero("voz-inicio", null, -TOTAL, TOTAL, `de -${br(TOTAL)} a ${br(TOTAL)} (segundos)`);
  const N = Math.round(TOTAL * SR);

  const argMapa = opcao("comercial");
  if (!argMapa || argMapa.startsWith("--")) throw new Error("--comercial pede o arquivo do mapa (JSON): --comercial sons.json");
  const arqMapa = isAbsolute(argMapa) || existsSync(argMapa) ? resolve(argMapa) : join(pastaDoProjeto, argMapa);
  const mapa = validarMapa(lerJson(arqMapa, "o mapa"));
  const arqEventos = args[0] && !args[0].startsWith("--") ? args[0] : join(FILM, "stills", "events.json");
  const eventos = lerJson(arqEventos, "o arquivo de eventos");
  const tPausa = PAUSA ?? (mapa.pausa ? instanteDaPausa(mapa.pausa, eventos, FPS) : null);
  if (tPausa != null && (tPausa < 0 || tPausa > TOTAL)) throw new Error(`pausa: o instante ${br(tPausa, 2)} s fica fora do filme (0 a ${br(TOTAL)} s)`);
  const dPausa = PAUSA_DUR ?? mapa.pausa?.dur ?? 0.2;

  // 1. A música e o tom
  const MUSICA = opcao("musica");
  let cama, tom, fonte, medida = null;
  if (MUSICA) {
    cama = join(AUDIO, "musica.wav");
    const { dur, vezes } = montarMusica(join(FILM, MUSICA), INICIO_MUSICA, TOTAL, cama);
    console.log(`música: ${MUSICA}, ${br(dur)} s, ${vezes} vez(es), desde ${br(INICIO_MUSICA, 2)} s`);
    try {
      medida = medirMusica(cama, pastaDoProjeto);
      writeFileSync(join(AUDIO, "musica-medida.json"), JSON.stringify(medida, null, 1));
    } catch (e) {
      if (!opcao("tom")) throw e;
      console.log(`aviso: ${e.message}`);
    }
  }
  if (opcao("tom")) { tom = { classe: lerTom(opcao("tom")), modo: lerModo(opcao("modo", "maior")) }; fonte = "de --tom"; }
  else if (medida) { tom = { classe: lerTom(medida.tom), modo: medida.modo }; fonte = `medido na música, correlação ${br(medida.correlacao, 2)}`; }
  else { tom = TOM_DA_TRILHA; fonte = "a trilha de código"; }
  console.log(`tom: ${nomeDoTom(tom)} (${fonte})`);
  if (medida && !opcao("tom") && medida.incerto) console.log(`aviso: tom incerto, o 2º é ${medida.segundo.nome} (${br(medida.segundo.correlacao, 2)}): confira de ouvido ou passe --tom e --modo`);
  if (medida?.bpm) console.log(`andamento: ${br(medida.bpm, 2)} BPM; batidas em ${br(medida.primeira_batida, 3)} + k × ${br(medida.batida_s, 3)} s (força ${br(medida.forca_batida, 2)})`);

  // 2. Os efeitos
  const { efeitos, semEvento } = planoComercial(eventos, mapa, tom, { fps: FPS });
  for (const i of semEvento) console.log(`aviso: a regra ${i + 1} (${JSON.stringify(mapa.efeitos[i])}) não casou com nenhum evento`);
  const fora = efeitos.filter((e) => e.t < 0 || e.t >= TOTAL);
  if (fora.length) console.log(`aviso: ${fora.length} efeito(s) fora do filme (0 a ${br(TOTAL)} s): ${fora.map((e) => `${e.efeito} em ${br(e.t, 2)} s`).join(", ")}`);
  const contagem = {};
  for (const e of efeitos) contagem[e.efeito] = (contagem[e.efeito] || 0) + 1;
  console.log(`efeitos: ${efeitos.length}`, contagem);
  const por10 = (efeitos.length / TOTAL) * 10;
  if (por10 > EFEITOS_POR_10S) console.log(`aviso: ${br(por10)} efeitos a cada 10 s; o S4 do ouvir.py acusa acima de ${EFEITOS_POR_10S}`);
  writeFileSync(join(AUDIO, "sfx-eventos.json"), JSON.stringify(efeitos.map((e) => ({ t: +e.t.toFixed(3), sfx: e.efeito, gain: e.ganho, evento: e.evento, notas: e.notas })), null, 1));
  const arqEfeitos = join(AUDIO, "efeitos.wav");
  gravarWav(arqEfeitos, sintetizar(efeitos, TOTAL));
  if (!MUSICA) {
    cama = join(AUDIO, "trilha.wav");
    const assinatura = efeitos.find((e) => e.efeito === "assinatura")?.t ?? TOTAL - 8;
    gravarWav(cama, trilha({ total: TOTAL, inicioDoRitmo: 1.2, inicioDaAssinatura: assinatura }));
    writeFileSync(join(AUDIO, "musica-medida.json"), JSON.stringify({ fonte: "trilha de código (trilha.mjs)", bpm: 100, batida_s: 0.6, primeira_batida: 0, tom: "D", modo: "maior", nome: "Ré maior" }, null, 1));
  }

  // 3. A mixagem
  const mix = new Float32Array(N * 2);
  if (!tem("sem-voz")) {
    const voz = opcao("voz") ? join(FILM, opcao("voz")) : join(AUDIO, "vo.wav");
    if (!existsSync(voz)) throw new Error(`sem a voz ${voz}: passe --voz <arquivo dentro de film/> ou --sem-voz`);
    const inicio = INICIO_VOZ ?? offsetDaFala(join(FILM, "assets", opcao("fala", "fala.js")));
    const medidaVoz = lufsDe(voz), gv = 10 ** ((VOZ_LUFS - medidaVoz) / 20), i0 = Math.round(inicio * SR);
    const v = ler(voz, 1);
    for (let k = Math.max(0, -i0); k < v.length && i0 + k < N; k++) { mix[2 * (i0 + k)] += v[k] * gv; mix[2 * (i0 + k) + 1] += v[k] * gv; }
    console.log(`voz: ${relative(pastaDoProjeto, voz)} desde ${br(inicio, 2)} s, ${br(medidaVoz)} LUFS, levada a ${VOZ_LUFS}`);
  }
  const m = ler(cama, 2, N), medidaMusica = lufsDe(cama), gm = 10 ** ((VOZ_LUFS - ABAIXO - medidaMusica) / 20);
  const [a, b] = tPausa != null ? [tPausa - dPausa, tPausa] : [Infinity, Infinity];
  const desce = TOTAL - DESCIDA;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let g = gm;
    if (t > a - RAMPA && t < b + RAMPA) g *= t < a ? (a - t) / RAMPA : t > b ? (t - b) / RAMPA : 0;
    if (t > desce) g *= Math.cos((Math.PI / 2) * Math.min(1, (t - desce) / DESCIDA)) ** 2;
    mix[2 * i] += m[2 * i] * g;
    mix[2 * i + 1] += m[2 * i + 1] * g;
  }
  console.log(`música: ${br(medidaMusica)} LUFS, ganho ${br(20 * Math.log10(gm))} dB (${ABAIXO} dB sob a voz)${tPausa != null ? `; pausa de ${br(a, 2)} a ${br(b, 2)} s` : ""}`);
  const f = ler(arqEfeitos, 2, N);
  for (let i = 0; i < N * 2; i++) mix[i] += f[i];

  // 4. -16 LUFS em 2 passadas
  const arqMix = join(AUDIO, "mix.wav");
  const n = normalizar(mix, arqMix);
  const fim = medidaFinal(arqMix);
  console.log(`mix.wav: ${br(fim.I)} LUFS, pico real ${br(fim.TP)} dBTP (entrada ${br(n.entrada)} LUFS, normalização ${n.tipo === "linear" ? "linear" : "dinâmica"})`);
  if (Math.abs(fim.I - LUFS_FINAL) > 1) console.log(`aviso: a mistura ficou ${br(fim.I - LUFS_FINAL)} LU longe de ${LUFS_FINAL} LUFS`);
}
