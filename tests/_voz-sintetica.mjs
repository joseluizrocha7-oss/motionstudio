// Voz sintética para os testes de voz (posicionar-voz e montar): tons no lugar de fala, sem API.
// Não é teste (o nome não termina em .test.mjs): a suíte `node --test "tests/*.test.mjs"` não o roda.
import { readFileSync, writeFileSync } from "node:fs";

export const SR = 48000;

// WAV de 16 bits, mono, a partir de amostras entre -1 e 1.
export function escreverWav(arquivo, amostras, sr = SR) {
  const dados = Buffer.alloc(amostras.length * 2);
  for (let i = 0; i < amostras.length; i++) dados.writeInt16LE(Math.round(Math.max(-1, Math.min(1, amostras[i])) * 32767), i * 2);
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0); cab.writeUInt32LE(36 + dados.length, 4); cab.write("WAVE", 8);
  cab.write("fmt ", 12); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(sr, 24); cab.writeUInt32LE(sr * 2, 28); cab.writeUInt16LE(2, 32); cab.writeUInt16LE(16, 34);
  cab.write("data", 36); cab.writeUInt32LE(dados.length, 40);
  writeFileSync(arquivo, Buffer.concat([cab, dados]));
}

// Lê um WAV de 16 bits (percorre os blocos: o ffmpeg põe um bloco LIST antes do data).
export function lerWav(arquivo) {
  const b = readFileSync(arquivo);
  let sr = SR, canais = 1;
  for (let p = 12; p + 8 <= b.length;) {
    const nome = b.toString("latin1", p, p + 4), tam = b.readUInt32LE(p + 4);
    if (nome === "fmt ") { canais = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12); }
    if (nome === "data") {
      const n = Math.floor(Math.min(tam, b.length - p - 8) / 2 / canais);
      const amostras = new Float32Array(n);
      for (let i = 0; i < n; i++) amostras[i] = b.readInt16LE(p + 8 + i * 2 * canais) / 32768;
      return { sr, amostras };
    }
    p += 8 + tam + (tam % 2);
  }
  throw new Error(`${arquivo}: não achei o bloco data`);
}

export const silencio = (seg, sr = SR) => new Float32Array(Math.round(seg * sr));

// Tom com rampa de 5 ms nas pontas (sem clique); `rampa` em segundos (0 = pontas cheias).
export function tom(freq, seg, amp = 0.3, sr = SR, rampa = 0.005) {
  const n = Math.round(seg * sr), r = Math.max(1, Math.round(rampa * sr)), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr) * Math.min(1, i / r, (n - 1 - i) / r);
  return x;
}

export function juntar(...partes) {
  const x = new Float32Array(partes.reduce((s, p) => s + p.length, 0));
  let k = 0;
  for (const p of partes) { x.set(p, k); k += p.length; }
  return x;
}

// RMS em dB de [a, b) segundos, como o db() do ouvir.py (piso de 1e-6).
export function rmsDb(x, a, b, sr = SR) {
  const i = Math.round(a * sr), j = Math.min(x.length, Math.round(b * sr));
  let s = 0;
  for (let k = i; k < j; k++) s += x[k] * x[k];
  return 20 * Math.log10(Math.max(1e-6, Math.sqrt(s / Math.max(1, j - i))));
}

// Primeiro e último instante com energia: janelas de 5 ms acima do limiar de RMS (linear).
export function limitesPorEnergia(x, desde, ate, sr = SR, limiar = 0.02) {
  const j = Math.round(0.005 * sr);
  let ini = null, fim = null;
  for (let k = Math.round(desde * sr); k + j <= Math.min(x.length, Math.round(ate * sr)); k += j) {
    let s = 0;
    for (let i = k; i < k + j; i++) s += x[i] * x[i];
    if (Math.sqrt(s / j) > limiar) { if (ini === null) ini = k / sr; fim = (k + j) / sr; }
  }
  return { ini, fim };
}

// Frequência estimada pelos cruzamentos de zero em [a, b).
export function frequenciaEm(x, a, b, sr = SR) {
  const i = Math.round(a * sr), j = Math.round(b * sr);
  let c = 0;
  for (let k = i + 1; k < j; k++) if (x[k - 1] < 0 !== x[k] < 0) c++;
  return c / 2 / ((j - i) / sr);
}
