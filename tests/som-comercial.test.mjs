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
function medir(arq, extra = []) {
  const r = spawnSync(PY[0], [...PY[1], MEDIR, arq, ...extra], { encoding: "utf8" });
  assert.equal(r.status, 0, `medir-musica.py saiu com ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
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
  assert.ok(Math.abs(m.bpm - 112) <= m.tolerancias.bpm, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.37) <= m.tolerancias.primeira_batida_s, `primeira batida ${m.primeira_batida}`);
  assert.ok(m.forca_batida > 0.3, `força da batida ${m.forca_batida}`);
});

test("medir-musica: cliques a 90 BPM com contratempo mais fraco não dobram o andamento", () => {
  const arq = join(pasta(), "cliques 90.wav");
  gravarWav(arq, [cliques({ bpm: 90, primeira: 0.05, contratempo: 0.5 })]);
  const m = medir(arq);
  assert.ok(Math.abs(m.bpm - 90) <= m.tolerancias.bpm, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.05) <= m.tolerancias.primeira_batida_s, `primeira batida ${m.primeira_batida}`);
});

test("medir-musica: batida pop a 104 BPM em Lá menor (bumbo, palma e chimbal em colcheia)", () => {
  const arq = join(pasta(), "pop.wav");
  gravarWav(arq, [batidaPop({ bpm: 104, primeira: 0.21 })]);
  const m = medir(arq);
  assert.ok(Math.abs(m.bpm - 104) <= m.tolerancias.bpm, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.21) <= m.tolerancias.primeira_batida_s, `primeira batida ${m.primeira_batida}`);
  assert.equal(`${m.tom} ${m.modo}`, "A menor");
});

test("medir-musica: --inicio conta a fase a partir do trecho medido", () => {
  const arq = join(pasta(), "cliques trecho.wav");
  gravarWav(arq, [cliques({ bpm: 120, primeira: 0.1, dur: 10 })]);
  const m = medir(arq, ["--inicio", "1.3", "--dur", "8"]);       // batidas em 0,1 + 0,5k; contadas de 1,3 s: 0,3
  assert.ok(Math.abs(m.bpm - 120) <= m.tolerancias.bpm, `bpm ${m.bpm}`);
  assert.ok(Math.abs(m.primeira_batida - 0.3) <= m.tolerancias.primeira_batida_s, `primeira batida ${m.primeira_batida}`);
});
