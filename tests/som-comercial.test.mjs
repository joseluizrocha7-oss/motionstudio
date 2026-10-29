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
