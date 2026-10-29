import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const KIT = join(RAIZ, "kit");
const SR = 48000;
const temporarias = [];
after(() => { for (const p of temporarias) rmSync(p, { recursive: true, force: true }); });

// WAV PCM de 16 bits a partir de canais em Float32Array (todos do mesmo tamanho).
function gravarWav(arq, canais, sr = SR) {
  const n = canais[0].length, c = canais.length;
  const dados = Buffer.alloc(n * c * 2);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) dados.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(canais[k][i] * 32767))), (i * c + k) * 2);
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0); cab.writeUInt32LE(36 + dados.length, 4); cab.write("WAVEfmt ", 8);
  cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(c, 22);
  cab.writeUInt32LE(sr, 24); cab.writeUInt32LE(sr * c * 2, 28); cab.writeUInt16LE(c * 2, 32); cab.writeUInt16LE(16, 34);
  cab.write("data", 36); cab.writeUInt32LE(dados.length, 40);
  writeFileSync(arq, Buffer.concat([cab, dados]));
}

// "Voz" inventada: tom de 150 Hz com harmônicos e sílabas de 4 por segundo, nos trechos dados (s).
function vozSintetica(dur, trechos) {
  const v = new Float32Array(Math.round(dur * SR));
  for (const [a, b] of trechos) for (let i = Math.round(a * SR); i < Math.min(v.length, Math.round(b * SR)); i++) {
    const t = i / SR, silaba = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * (t - a)) ** 2;
    v[i] = 0.25 * silaba * (Math.sin(2 * Math.PI * 150 * t) + 0.5 * Math.sin(2 * Math.PI * 300 * t) + 0.3 * Math.sin(2 * Math.PI * 450 * t + 1));
  }
  return v;
}

// Pasta de projeto como a do novo-projeto.mjs: os .mjs do kit, os efeitos gravados, a voz e o fala.js.
function projeto({ voz = true } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "motionstudio-som-"));
  temporarias.push(raiz);
  const p = join(raiz, "projeto ção");
  mkdirSync(join(p, "film", "audio"), { recursive: true });
  mkdirSync(join(p, "film", "assets", "musica"), { recursive: true });
  for (const f of readdirSync(KIT)) if (f.endsWith(".mjs")) copyFileSync(join(KIT, f), join(p, f));
  cpSync(join(KIT, "efeitos-gravados"), join(p, "efeitos-gravados"), { recursive: true });
  writeFileSync(join(p, "motionstudio.json"), JSON.stringify({ skill: RAIZ }));
  writeFileSync(join(p, "film", "assets", "fala.js"), 'window.FALA = {"offset": 0.4, "linhas": [], "palavras": []};\n');
  if (voz) gravarWav(join(p, "film", "audio", "vo.wav"), [vozSintetica(6, [[0.1, 1.9], [2.6, 4.4], [5.0, 5.8]])]);
  return p;
}

const sha = (arq) => createHash("sha256").update(readFileSync(arq)).digest("hex");
const rodar = (p, args) => {
  const r = spawnSync("node", [join(p, "gerar-som.mjs"), ...args], { encoding: "utf8", env: { ...process.env, SKILL: RAIZ } });
  assert.equal(r.status, 0, `gerar-som.mjs saiu com ${r.status}:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};

// ---------------------------------------------------------------- modo de tutorial (não pode mudar)

const EVENTOS_TUTORIAL = [
  { t: 0.6, frame: 18, type: "enter", label: "celular" },
  { t: 1.5, frame: 45, type: "press", label: "botão" },
  { t: 2.4, frame: 72, type: "whip", label: "gesto aprovar" },
  { t: 3.3, frame: 99, type: "whip", label: "lista-arrasto" },
  { t: 4.1, frame: 123, type: "whip", label: "gesto reprovar" },
  { t: 4.8, frame: 144, type: "whip", label: "pular" },
  { t: 5.5, frame: 165, type: "enter", label: "marca final" },
  { t: 6.0, frame: 180, type: "show", label: "sem efeito" },
];

// Registrado em 29/10/2026 com o gerar-som.mjs de antes do modo comercial (commit a8090ae), Node 24.
// A lista de efeitos e os WAV gravados pelo trilha.mjs só dependem do JavaScript.
const SFX_TUTORIAL = [
  { t: 0.2, sfx: "sino", gain: 0 }, { t: 0.5, sfx: "ar", gain: 0 }, { t: 1.49, sfx: "pop", gain: 0 },
  { t: 2.52, sfx: "aprovar", gain: 0 }, { t: 3.3, sfx: "ar", gain: 0 }, { t: 4.22, sfx: "reprovar", gain: 0 },
  { t: 4.92, sfx: "pular", gain: 0 }, { t: 5.75, sfx: "assinatura", gain: 0 },
];
const SHA_TUTORIAL = {
  trilha: "8136bdc15ca54c5c53e93789b9d81e2ade15dd21e3f23a06774035a99694e489",
  efeitos: "dfd1f61adbc686a77fadbead7a6a67c4f900a19cf599f5b934d30c4e66bc50cb",
};
// O mix.wav e os efeitos gravados (44,1 kHz, reamostrados) passam pelo ffmpeg: o hash só vale na versão do registro.
const FFMPEG_DO_REGISTRO = "ffmpeg version 9.0.2-full_build-www.gyan.dev";
const SHA_FFMPEG = {
  mix: "e48417659c1673e7c9f846c0e1e02bef6d8814ba89ee1a0902084ec4c628b6c1",
  efeitosGravados: "0c3237cfd9d53a90000ac629e9b4c668265014f91cfb7088fcbd7b94c373c2f1",
  mixGravados: "c1f8dcc501d46b5fa37d6407cc80af0eebbd69cf89936d82369263e305d693b7",
};
const mesmoFfmpeg = execFileSync("ffmpeg", ["-version"], { encoding: "utf8" }).split("\n")[0].startsWith(FFMPEG_DO_REGISTRO);

test("modo de tutorial: mesma lista de efeitos e mesmos WAV de antes do modo comercial", () => {
  const p = projeto();
  const ev = join(p, "film", "eventos.json");
  writeFileSync(ev, JSON.stringify(EVENTOS_TUTORIAL));
  rodar(p, [ev, "--total", "8"]);
  const audio = join(p, "film", "audio");
  assert.deepEqual(JSON.parse(readFileSync(join(audio, "sfx-eventos.json"), "utf8")), SFX_TUTORIAL);
  assert.equal(sha(join(audio, "trilha.wav")), SHA_TUTORIAL.trilha);
  assert.equal(sha(join(audio, "efeitos.wav")), SHA_TUTORIAL.efeitos);
  if (mesmoFfmpeg) assert.equal(sha(join(audio, "mix.wav")), SHA_FFMPEG.mix);
});

test("modo de tutorial com efeitos gravados: mesma saída de antes", () => {
  const p = projeto();
  const ev = join(p, "film", "eventos.json");
  writeFileSync(ev, JSON.stringify(EVENTOS_TUTORIAL));
  rodar(p, [ev, "--total", "8", "--toque", "pop-hand", "--ar", "fast-whoosh"]);
  const audio = join(p, "film", "audio");
  const nomes = JSON.parse(readFileSync(join(audio, "sfx-eventos.json"), "utf8")).map((e) => e.sfx);
  assert.deepEqual(nomes, ["sino", "fast-whoosh", "pop-hand", "aprovar", "fast-whoosh", "reprovar", "pular", "assinatura"]);
  if (mesmoFfmpeg) {
    assert.equal(sha(join(audio, "efeitos.wav")), SHA_FFMPEG.efeitosGravados);
    assert.equal(sha(join(audio, "mix.wav")), SHA_FFMPEG.mixGravados);
  }
});

// ---------------------------------------------------------------- medir-musica.py

const MEDIR = join(RAIZ, "scripts", "medir-musica.py");
const PY = process.platform === "win32" ? ["py", ["-3"]] : ["python3", []];
// As tolerâncias ficam aqui, não na saída do script: se o script afrouxar a dele, o teste acusa.
const TOL_BPM = 0.5, TOL_FASE = 0.015;
function medir(arq, extra = []) {
  const r = spawnSync(PY[0], [...PY[1], MEDIR, arq, ...extra], { encoding: "utf8" });
  assert.equal(r.status, 0, `medir-musica.py saiu com ${r.status}: ${r.stderr}`);
  const m = JSON.parse(r.stdout);
  assert.equal(m.tolerancias.bpm, TOL_BPM, "o script declara outra tolerância de andamento");
  assert.equal(m.tolerancias.primeira_batida_s, TOL_FASE, "o script declara outra tolerância de fase");
  assert.equal(typeof m.andamento_incerto, "boolean");
  return m;
}
const hzMidi = (m) => 440 * 2 ** ((m - 69) / 12);

// Acorde parado com notas de 6 harmônicos (1/n), a tônica no grave, 6 s.
function acorde(midis, dur = 6, sr = SR) {
  const x = new Float32Array(Math.round(dur * sr));
  for (const m of midis) {
    const f = hzMidi(m);
    for (let i = 0; i < x.length; i++) {
      const t = i / sr;
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * t + h) / h;
      x[i] += 0.08 * s * Math.min(1, t / 0.05);
    }
  }
  return x;
}

// Cliques de 4 ms (ruído de semente fixa que cai rápido) a cada batida, desde a primeira; contratempo opcional.
function cliques({ bpm, primeira, dur = 12, contratempo = 0, sr = SR }) {
  const x = new Float32Array(Math.round(dur * sr));
  let s = 12345;
  const ruido = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
  const bater = (t0, forca) => {
    const i0 = Math.round(t0 * sr);
    for (let k = 0; k < Math.round(0.004 * sr) && i0 + k < x.length; k++) x[i0 + k] += forca * ruido() * Math.exp(-k / (0.001 * sr));
  };
  const b = 60 / bpm;
  for (let t = primeira; t < dur - 0.01; t += b) {
    bater(t, 0.8);
    if (contratempo && t + b / 2 < dur - 0.01) bater(t + b / 2, 0.8 * contratempo);
  }
  return x;
}

// Batida de música pop inventada: bumbo no 1 e no 3, palma no 2 e no 4, chimbal em colcheia
// (o do contratempo mais forte) e um acorde de Lá menor por baixo.
function batidaPop({ bpm, primeira, dur = 16, sr = SR }) {
  const x = acorde([45, 57, 60, 64], dur, sr).map((v) => v * 0.4);
  let s = 777;
  const ruido = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
  const n = Math.round(0.4 * sr);
  const bumbo = Float32Array.from({ length: n }, (_, k) => { const t = k / sr; return Math.sin(2 * Math.PI * (50 * t + 1.8 * (1 - Math.exp(-t / 0.03)))) * Math.exp(-t / 0.12); });
  const palma = Float32Array.from({ length: n }, (_, k) => 0.5 * ruido() * Math.exp(-k / sr / 0.05));
  let ant = 0;
  const chimbal = Float32Array.from({ length: n }, (_, k) => { const r = 0.25 * ruido() * Math.exp(-k / sr / 0.01); const d = r - ant; ant = r; return d; });
  const por = (som, t0, g) => { const i0 = Math.round(t0 * sr); for (let k = 0; k < som.length && i0 + k < x.length; k++) x[i0 + k] += g * som[k]; };
  const b = 60 / bpm;
  for (let k = 0, t = primeira; t < dur - 0.5; k++, t += b) {
    if (k % 2 === 0) por(bumbo, t, 0.9); else por(palma, t, 0.7);
    por(chimbal, t, 0.3); por(chimbal, t + b / 2, 0.6);
  }
  return x;
}

// Balada em Ré maior (Ré, Lá, Si m, Sol), arpejo e chimbal em semicolcheia, bumbo no 1, no "a"
// do 2 e no 3, caixa no 2 e no 4, tudo humanizado (semente fixa). Porte da sonda da revisão.
function balada({ bpm, primeira, dur = 30, sr = SR }) {
  const x = new Float32Array(Math.round(dur * sr));
  let s = 4242;
  const u = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const hum = (d) => d * normal();
  const por = (som, t0, g) => { const i0 = Math.round(t0 * sr); for (let k = Math.max(0, -i0); k < som.length && i0 + k < x.length; k++) x[i0 + k] += g * som[k]; };
  const tom = (m, d, harm, queda, ataque) => {
    const f = hzMidi(m), n = Math.round(d * sr), fases = Array.from({ length: harm }, () => u() * 6.28);
    return Float32Array.from({ length: n }, (_, k) => {
      const t = k / sr;
      let v = 0;
      for (let h = 1; h <= harm; h++) if (f * h < sr / 2) v += Math.sin(2 * Math.PI * f * h * t + fases[h - 1]) / h;
      return v * Math.min(1, t / ataque) * (queda ? Math.exp(-t / queda) : Math.min(1, (d - t) / 0.05));
    });
  };
  const bumbo = () => Float32Array.from({ length: Math.round(0.35 * sr) }, (_, k) => { const t = k / sr; return Math.sin(2 * Math.PI * (50 * t + 2.8 * (1 - Math.exp(-t / 0.04)))) * Math.exp(-t / 0.15); });
  const caixa = () => Float32Array.from({ length: Math.round(0.25 * sr) }, (_, k) => { const t = k / sr; return 0.6 * normal() * Math.exp(-t / 0.07) + 0.5 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t / 0.05); });
  const chimbal = () => { let ant = 0; return Float32Array.from({ length: Math.round(0.2 * sr) }, (_, k) => { const r = normal(), d = r - ant; ant = r; return 0.4 * d * Math.exp(-k / sr / 0.02); }); };
  const acordes = [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [55, 59, 62, 67]], raizes = [38, 33, 35, 31];
  const b = 60 / bpm;
  for (let k = 0, t = primeira; t < dur - 1; k++, t += b) {
    const compasso = Math.floor(k / 4) % 4, pos = k % 4;
    if (pos === 0 || pos === 2) por(bumbo(), t + hum(0.005), 0.9);
    if (pos === 1) por(bumbo(), t + 0.75 * b + hum(0.005), 0.6);
    if (pos === 1 || pos === 3) por(caixa(), t + hum(0.006), 0.6);
    for (let q = 0; q < 4; q++) por(chimbal(), t + (q * b) / 4 + hum(0.004), 0.12 * (q % 2 ? 0.9 : 1.3));
    for (let q = 0; q < 4; q++) por(tom(acordes[compasso][(pos * 4 + q) % 4], 0.6, 6, 0.25, 0.003), t + (q * b) / 4 + hum(0.004), 0.12);
    if (pos === 0) por(tom(raizes[compasso], 4 * b, 4, 0, 0.02), t, 0.25);
  }
  const pico = x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  return x.map((v) => (v / pico) * 0.8);
}

function pasta() {
  const p = mkdtempSync(join(tmpdir(), "motionstudio-musica-"));
  temporarias.push(p);
  return p;
}

test("medir-musica: acorde de Lá menor com a tônica no grave", () => {
  const arq = join(pasta(), "lá menor.wav");
  gravarWav(arq, [acorde([45, 57, 60, 64])]);              // Lá2, Lá3, Dó4, Mi4
  const m = medir(arq);
  assert.equal(`${m.tom} ${m.modo}`, "A menor", JSON.stringify(m));
  assert.equal(m.nome, "Lá menor");
  assert.equal(m.tonica_hz, 440);
});

test("medir-musica: acorde de Mi maior com a tônica no grave", () => {
  const arq = join(pasta(), "mi maior.wav");
  gravarWav(arq, [acorde([40, 52, 56, 59])]);              // Mi2, Mi3, Sol#3, Si3
  const m = medir(arq);
  assert.equal(`${m.tom} ${m.modo}`, "E maior", JSON.stringify(m));
});

test("medir-musica: cliques a 112 BPM com a primeira batida em 0,37 s", () => {
  const arq = join(pasta(), "cliques.wav");
  gravarWav(arq, [cliques({ bpm: 112, primeira: 0.37 })]);
  const m = medir(arq);
  assert.ok(Math.abs(m.bpm - 112) <= TOL_BPM, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.37) <= TOL_FASE, `primeira batida ${m.primeira_batida}`);
  assert.ok(m.forca_batida > 0.3, `força da batida ${m.forca_batida}`);
});

test("medir-musica: cliques a 90 BPM com contratempo mais fraco não dobram o andamento", () => {
  const arq = join(pasta(), "cliques 90.wav");
  gravarWav(arq, [cliques({ bpm: 90, primeira: 0.05, contratempo: 0.5 })]);
  const m = medir(arq);
  assert.ok(Math.abs(m.bpm - 90) <= TOL_BPM, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.05) <= TOL_FASE, `primeira batida ${m.primeira_batida}`);
});

test("medir-musica: batida pop a 104 BPM em Lá menor (bumbo, palma e chimbal em colcheia)", () => {
  const arq = join(pasta(), "pop.wav");
  gravarWav(arq, [batidaPop({ bpm: 104, primeira: 0.21 })]);
  const m = medir(arq);
  assert.ok(Math.abs(m.bpm - 104) <= TOL_BPM, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.21) <= TOL_FASE, `primeira batida ${m.primeira_batida}`);
  assert.equal(`${m.tom} ${m.modo}`, "A menor");
});

test("medir-musica: balada a 76 BPM com semicolcheias não sai em 101 (3/4 da batida)", () => {
  const arq = join(pasta(), "balada.wav");
  gravarWav(arq, [balada({ bpm: 76, primeira: 0.12 })]);
  const m = medir(arq);
  assert.ok(Math.abs(m.bpm - 76) <= TOL_BPM, `bpm ${m.bpm} (rival ${m.rival_bpm}, incerto ${m.andamento_incerto})`);
  assert.ok(Math.abs(m.primeira_batida - 0.12) <= TOL_FASE, `primeira batida ${m.primeira_batida}`);
  assert.equal(`${m.tom} ${m.modo}`, "D maior");
});

test("medir-musica: cliques a 70 BPM com contratempo forte saem certos ou com andamento_incerto", () => {
  const arq = join(pasta(), "cliques 70.wav");
  gravarWav(arq, [cliques({ bpm: 70, primeira: 0.13, contratempo: 0.5 })]);
  const m = medir(arq);
  const certo = Math.abs(m.bpm - 70) <= TOL_BPM;
  assert.ok(certo || (m.andamento_incerto && Math.abs(m.rival_bpm - 70) <= 2), `bpm ${m.bpm}, rival ${m.rival_bpm}, incerto ${m.andamento_incerto}`);
});

test("medir-musica: --inicio conta a fase a partir do trecho medido", () => {
  const arq = join(pasta(), "cliques trecho.wav");
  gravarWav(arq, [cliques({ bpm: 120, primeira: 0.1, dur: 10 })]);
  const m = medir(arq, ["--inicio", "1.3", "--dur", "8"]);       // batidas em 0,1 + 0,5k; contadas de 1,3 s: 0,3
  assert.ok(Math.abs(m.bpm - 120) <= TOL_BPM, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.3) <= TOL_FASE, `primeira batida ${m.primeira_batida}`);
});

// ---------------------------------------------------------------- modo comercial

const comercial = () => import("../kit/som-comercial.mjs");

// Eventos como o render grava: M.mark(quadro, tipo, rótulo). Rótulos inventados.
const EVENTOS_COMERCIAL = [
  { t: 0.3, frame: 9, type: "som", label: "abertura" },
  { t: 1.0, frame: 30, type: "enter", label: "#sigla-um" },
  { t: 1.8, frame: 54, type: "enter", label: "#sigla-dois" },
  { t: 2.2, frame: 66, type: "show", label: "#sigla-dois" },        // outro tipo: a regra de "enter" não pega
  { t: 4.2, frame: 126, type: "nota", label: "Ágata" },
  { t: 5.0, frame: 150, type: "virada", label: "" },               // M.mark(f, 'virada'): sem rótulo, vale o tipo
];
const MAPA_COMERCIAL = {
  efeitos: [
    { rotulo: "^abertura$", efeito: "impacto" },
    { tipo: "enter", rotulo: "^#sigla", efeito: "pinca", graus: [5], subir: 2, ganho: -3 },
    { rotulo: "^agata$", efeito: "sino" },                           // sem acento casa com "Ágata"
    { rotulo: "^virada$", efeito: "assinatura", desvio: 0.05 },
    { rotulo: "^nunca$", efeito: "pop" },
  ],
  pausa: { t: 3.0, dur: 0.2 },
};

test("comercial: plano de efeitos por rótulo, afinado em Lá menor", async () => {
  const { planoComercial } = await comercial();
  const { efeitos, semEvento } = planoComercial(EVENTOS_COMERCIAL, MAPA_COMERCIAL, { classe: 9, modo: "menor" });
  assert.deepEqual(efeitos.map((e) => [e.t, e.efeito, e.ganho, e.notas.join(" ")]), [
    [0.3, "impacto", 0, "A2"],
    [1.0, "pinca", -3, "E5"],
    [1.8, "pinca", -3, "G5"],                                        // subir 2: do 5º grau para o 7º
    [4.2, "sino", 0, "A5 C6 E6"],
    [5.05, "assinatura", 0, "E2 A4 E5 A5 C6"],
  ]);
  assert.deepEqual(efeitos.map((e) => e.evento), ["som abertura", "enter #sigla-um", "enter #sigla-dois", "nota Ágata", "virada"]);
  assert.deepEqual(semEvento, [4]);
});

test("comercial: em Ré maior os efeitos tonais têm as notas dos efeitos do kit", async () => {
  const { planoComercial } = await comercial();
  const ev = [{ t: 1, type: "a", label: "" }, { t: 2, type: "b", label: "" }];
  const { efeitos } = planoComercial(ev, { efeitos: [{ tipo: "a", efeito: "sino" }, { tipo: "b", efeito: "assinatura" }] }, { classe: 2, modo: "maior" });
  const perto = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.1);
  assert.ok(perto(efeitos[0].hz, [1174.7, 1480, 1760]), `sino ${efeitos[0].hz}`);                // o "sino" do trilha.mjs
  assert.ok(perto(efeitos[1].hz, [110, 587.3, 880, 1174.7, 1480]), `assinatura ${efeitos[1].hz}`); // a "assinatura" do trilha.mjs
});

test("comercial: lerTom aceita letra, sustenido, bemol e nome em português", async () => {
  const { lerTom } = await comercial();
  assert.deepEqual(["A", "Bb", "F#", "lá", "Si bemol", "Dó sustenido", "eb"].map(lerTom), [9, 10, 6, 9, 10, 1, 3]);
  assert.throws(() => lerTom("H"), /tom/);
});

test("comercial: o mapa com erro diz qual regra e qual campo", async () => {
  const { validarMapa } = await comercial();
  assert.throws(() => validarMapa({ efeitos: [{ rotulo: "x", efeito: "sino", ganhos: -3 }] }), /regra 1.*"ganhos"/);
  assert.throws(() => validarMapa({ efeitos: [{ rotulo: "x", efeito: "trovão" }] }), /regra 1.*"trovão".*sino/);
  assert.throws(() => validarMapa({ efeitos: [{ efeito: "sino" }] }), /regra 1.*rotulo.*tipo/);
  assert.throws(() => validarMapa({ efeitos: [{ rotulo: "x", efeito: "pop", graus: [1] }] }), /regra 1.*graus.*tonal/);
  assert.throws(() => validarMapa({ efeitos: [{ rotulo: "(", efeito: "sino" }] }), /regra 1.*rotulo/);
  assert.throws(() => validarMapa({ efeitos: [] }), /efeitos/);
  assert.throws(() => validarMapa({ efeitos: [{ rotulo: "x", efeito: "sino" }], pausa: { dur: 0.2 } }), /pausa/);
});

test("comercial: palavra do M.words (enter e word no mesmo quadro) leva um efeito só, e o subir anda uma vez", async () => {
  const { planoComercial } = await comercial();
  // runtime/motion.js grava, para cada palavra, enter e word com o mesmo rótulo e o mesmo quadro.
  const ev = [
    { t: 1, frame: 30, type: "enter", label: "Átomo" }, { t: 1, frame: 30, type: "word", label: "Átomo" },
    { t: 2, frame: 60, type: "word", label: "Ágata" }, { t: 2, frame: 60, type: "enter", label: "Ágata" },
    { t: 3, frame: 90, type: "exit", label: "Átomo" },                                    // outro quadro: outro efeito
  ];
  const { efeitos } = planoComercial(ev, { efeitos: [{ rotulo: "^(atomo|agata)$", efeito: "sino", graus: [1], subir: 1 }] }, { classe: 9, modo: "menor" });
  assert.deepEqual(efeitos.map((e) => [e.t, e.evento, e.notas.join(" ")]), [[1, "enter Átomo", "A5"], [2, "enter Ágata", "B5"], [3, "exit Átomo", "C6"]]);
});

test("comercial: arpejo longo não é cortado na faixa curta do efeito", async () => {
  const { planoComercial, sintetizar } = await comercial();
  const graus = Array.from({ length: 16 }, (_, i) => i + 1);
  const { efeitos } = planoComercial([{ t: 0.5, type: "a", label: "" }], { efeitos: [{ tipo: "a", efeito: "pinca", graus, arpejo: 0.5 }] }, { classe: 2, modo: "maior" });
  const fx = sintetizar(efeitos, 10);
  const pico = (a, b) => { let m = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) m = Math.max(m, Math.abs(fx.e[i])); return m; };
  assert.ok(pico(8.0, 8.2) > 0.01, `a 16ª nota (8,0 s) sumiu: pico ${pico(8.0, 8.2)}`);
});

test("comercial: nota abaixo de 20 Hz é recusada com a regra e o conserto", async () => {
  const { planoComercial } = await comercial();
  const ev = [{ t: 1, type: "a", label: "" }];
  const la = { classe: 9, modo: "menor" };
  assert.throws(() => planoComercial(ev, { efeitos: [{ tipo: "a", efeito: "assinatura", oitava: 3 }] }, la), /regra 1.*20 Hz.*oitava/);
  assert.throws(() => planoComercial(ev, { efeitos: [{ tipo: "a", efeito: "impacto", oitava: 1 }] }, la), /regra 1.*20 Hz/);
  assert.throws(() => planoComercial(ev, { efeitos: [{ tipo: "a", efeito: "sino", graus: [-40] }] }, la), /regra 1.*20 Hz/);      // 14,6 Hz
  assert.throws(() => planoComercial(ev, { efeitos: [{ tipo: "a", efeito: "sino", graus: [40] }] }, la), /regra 1.*12000 Hz/);
  assert.equal(planoComercial(ev, { efeitos: [{ tipo: "a", efeito: "impacto", oitava: 2 }] }, la).efeitos[0].notas[0], "A1");   // 55 Hz descendo a 27,5
});

test("comercial: projeto antigo (sem som-comercial.mjs ou com o trilha.mjs sem export) recebe o que copiar", () => {
  for (const estrago of ["sem módulo", "trilha antigo"]) {
    const p = projeto({ voz: false });
    if (estrago === "sem módulo") rmSync(join(p, "som-comercial.mjs"));
    else writeFileSync(join(p, "trilha.mjs"), readFileSync(join(p, "trilha.mjs"), "utf8").replace(/\nexport \{[^}]*\};\s*$/, "\n"));
    writeFileSync(join(p, "sons.json"), JSON.stringify({ efeitos: [{ rotulo: "x", efeito: "sino" }] }));
    const r = spawnSync("node", [join(p, "gerar-som.mjs"), "--comercial", "sons.json", "--total", "5", "--sem-voz"], { encoding: "utf8" });
    assert.equal(r.status, 1, `${estrago}: saiu com ${r.status}`);
    assert.match(r.stderr, /som-comercial\.mjs.*trilha\.mjs/s, `${estrago}: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /at .*node:internal|ERR_MODULE_NOT_FOUND|SyntaxError/, `${estrago}: erro cru do Node`);
  }
});

test("comercial: opção numérica inválida sai com 1 e diz qual", () => {
  const p = projeto({ voz: false });
  writeFileSync(join(p, "eventos.json"), "[]");
  writeFileSync(join(p, "sons.json"), JSON.stringify({ efeitos: [{ rotulo: "x", efeito: "sino" }] }));
  const casos = [
    [["--total", "abc"], /--total/], [["--total", "-3"], /--total/], [["--total", "5", "--fps", "0"], /--fps/],
    [["--total", "5", "--abaixo", "dez"], /--abaixo/], [["--total", "5", "--musica-inicio", "-1"], /--musica-inicio/],
    [["--total", "5", "--pausa", "9"], /--pausa/], [["--total", "5", "--pausa", "2", "--pausa-dur", "3"], /--pausa-dur/],
    [["--total", "5", "--voz-inicio", "x"], /--voz-inicio/],
  ];
  for (const [extra, erro] of casos) {
    const r = spawnSync("node", [join(p, "gerar-som.mjs"), join(p, "eventos.json"), "--comercial", "sons.json", "--sem-voz", ...extra], { encoding: "utf8" });
    assert.equal(r.status, 1, `${extra.join(" ")}: saiu com ${r.status}`);
    assert.match(r.stderr, erro, `${extra.join(" ")}: ${r.stderr}`);
  }
});

// Lê um WAV (16 bits) e devolve a média dos canais por amostra.
function lerWav(arq) {
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", arq, "-ac", "1", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
const rmsDb = (x, a, b, sr = SR) => {
  let s = 0;
  const i0 = Math.round(a * sr), i1 = Math.round(b * sr);
  for (let i = i0; i < i1; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / (i1 - i0) + 1e-20);
};
// Energia na frequência f (Goertzel com janela de Hann) entre a e b segundos.
function potencia(x, a, b, f, sr = SR) {
  const i0 = Math.round(a * sr), n = Math.round((b - a) * sr), c = 2 * Math.cos((2 * Math.PI * f) / sr);
  let s1 = 0, s2 = 0;
  for (let k = 0; k < n; k++) {
    const s = x[i0 + k] * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1))) + c * s1 - s2;
    s2 = s1; s1 = s;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}
function sonoridade(arq) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
  return Number(/I:\s+(-?[\d.]+) LUFS/.exec(r.stderr.slice(r.stderr.lastIndexOf("Summary")))[1]);
}

test("comercial: música medida (Lá menor, 120 BPM), efeitos nos rótulos, pausa e -16 LUFS", () => {
  const p = projeto();
  const ev = join(p, "film", "eventos.json");
  writeFileSync(ev, JSON.stringify(EVENTOS_COMERCIAL));
  writeFileSync(join(p, "sons.json"), JSON.stringify(MAPA_COMERCIAL));
  // Música inventada: acorde de Lá menor e cliques a 120 BPM desde 0,25 s, 7 s, estéreo.
  const m = acorde([45, 57, 60, 64], 7);
  const c = cliques({ bpm: 120, primeira: 0.25, dur: 7 });
  const musica = m.map((v, i) => 0.6 * v + c[i]);
  gravarWav(join(p, "film", "assets", "musica", "teste.wav"), [musica, musica]);

  const saida = rodar(p, [ev, "--comercial", "sons.json", "--total", "6", "--musica", "assets/musica/teste.wav"]);
  assert.match(saida, /Lá menor/);
  const audio = join(p, "film", "audio");

  const medida = JSON.parse(readFileSync(join(audio, "musica-medida.json"), "utf8"));
  assert.equal(`${medida.tom} ${medida.modo}`, "A menor");
  assert.ok(Math.abs(medida.bpm - 120) <= 0.5, `bpm ${medida.bpm}`);

  const sfx = JSON.parse(readFileSync(join(audio, "sfx-eventos.json"), "utf8"));
  assert.deepEqual(sfx.map((e) => [e.t, e.sfx, e.gain]), [[0.3, "impacto", 0], [1, "pinca", -3], [1.8, "pinca", -3], [4.2, "sino", 0], [5.05, "assinatura", 0]]);
  assert.deepEqual(sfx.map((e) => e.notas.join(" ")), ["A2", "E5", "G5", "A5 C6 E6", "E2 A4 E5 A5 C6"]);

  // Os efeitos começam nos instantes do plano: silêncio antes do 1º, e nada entre o fim das siglas e o sino.
  const fx = lerWav(join(audio, "efeitos.wav"));
  assert.ok(rmsDb(fx, 0, 0.29) < -90, `efeitos.wav antes de 0,3 s: ${rmsDb(fx, 0, 0.29)} dB`);
  assert.ok(rmsDb(fx, 0.3, 0.35) > -40, `efeitos.wav logo depois de 0,3 s: ${rmsDb(fx, 0.3, 0.35)} dB`);
  assert.ok(rmsDb(fx, 3.4, 4.19) < -70, `efeitos.wav antes do sino (4,2 s): ${rmsDb(fx, 3.4, 4.19)} dB`);
  assert.ok(rmsDb(fx, 4.2, 4.25) > -45, `efeitos.wav logo depois do sino: ${rmsDb(fx, 4.2, 4.25)} dB`);
  // O sino toca Lá5, Dó6 e Mi6 no WAV: cada nota com 10 vezes a energia do semitom de cada lado.
  for (const f of [880, 1046.5, 1318.5]) {
    const nota = potencia(fx, 4.21, 4.41, f);
    const vizinho = Math.max(potencia(fx, 4.21, 4.41, f * 2 ** (-1 / 12)), potencia(fx, 4.21, 4.41, f * 2 ** (1 / 12)));
    assert.ok(nota > 10 * vizinho, `${f} Hz no sino: ${nota.toExponential(2)} contra ${vizinho.toExponential(2)} do semitom ao lado`);
  }

  // A mistura: -16 LUFS (±1), 6 s, 48 kHz estéreo; na pausa (2,8 a 3,0 s, sem voz nem efeito) a música some.
  const mix = join(audio, "mix.wav");
  const lufs = sonoridade(mix);
  assert.ok(Math.abs(lufs + 16) <= 1, `mix.wav em ${lufs} LUFS`);
  const info = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "json", mix], { encoding: "utf8" });
  const j = JSON.parse(info);
  assert.equal(Number(j.streams[0].sample_rate), 48000);
  assert.equal(j.streams[0].channels, 2);
  assert.ok(Math.abs(Number(j.format.duration) - 6) < 0.01, `duração ${j.format.duration}`);
  const x = lerWav(mix);
  const antes = rmsDb(x, 2.45, 2.75), pausa = rmsDb(x, 2.83, 2.97);
  assert.ok(antes - pausa > 20, `a pausa devia ficar 20 dB abaixo da música: ${antes.toFixed(1)} contra ${pausa.toFixed(1)} dB`);
  // A régua do S4 (RMS da fala contra o vão só com música): medido 24,3 dB; o S4 pede 8. Folga para o peso K do LUFS.
  const fala = rmsDb(x, 3.1, 4.1);
  assert.ok(fala - antes >= 15, `a música devia ficar uns 20 dB sob a fala: ${fala.toFixed(1)} contra ${antes.toFixed(1)} dB`);
});

test("comercial: sem --musica usa a trilha de código em Ré maior", () => {
  const p = projeto();
  const ev = join(p, "film", "eventos.json");
  writeFileSync(ev, JSON.stringify([{ t: 0.5, frame: 15, type: "enter", label: "título" }, { t: 2.5, frame: 75, type: "enter", label: "marca" }]));
  writeFileSync(join(p, "sons.json"), JSON.stringify({ efeitos: [{ rotulo: "^titulo$", efeito: "sino" }, { rotulo: "^marca$", efeito: "assinatura" }] }));
  const saida = rodar(p, [ev, "--comercial", join(p, "sons.json"), "--total", "5"]);
  assert.match(saida, /Ré maior/);
  const audio = join(p, "film", "audio");
  assert.ok(existsSync(join(audio, "trilha.wav")));
  const sfx = JSON.parse(readFileSync(join(audio, "sfx-eventos.json"), "utf8"));
  assert.deepEqual(sfx.map((e) => e.notas.join(" ")), ["D6 F#6 A6", "A2 D5 A5 D6 F#6"]);
  const lufs = sonoridade(join(audio, "mix.wav"));
  assert.ok(Math.abs(lufs + 16) <= 1, `mix.wav em ${lufs} LUFS`);
});
