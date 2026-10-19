#!/usr/bin/env node
// ACRÉSCIMO LOCAL (13/10/2026), não faz parte da skill original.
//
// Garante a pausa depois de cada sinal de pontuação numa narração JÁ GERADA,
// sem gastar crédito: alonga o silêncio onde a voz emendou. Existe porque o
// usuário reprovou uma narração dizendo "ela fala como se não tivesse
// pontuação" (taste/verdicts.md): a voz lia a linha com vírgulas
// de um fôlego só, e gerar de novo não garante que a pausa venha.
//
// Uso:
//   node pausas.mjs audio/vo.mp3 [--out audio/vo-ritmo.mp3]
//        [--words audio/vo.words.json] [--lines audio/vo.lines.json]
//        [--virgula .2] [--dois-pontos .28] [--ponto .42] [--pergunta .48]
//
// Grava o som novo e, ao lado dele, <out>.words.json e <out>.lines.json com os
// tempos já deslocados: são esses que seguem para o `voice.py split`, o
// `sync.mjs` e o `mix.py`. O original (o que foi pago) não é tocado.
//
// Só alonga, nunca encurta. O silêncio entra no ponto mais quieto entre as duas
// palavras, com rampa de 6 ms de cada lado, pra não estalar. Depois de rodar,
// conferir com `entonacao.mjs` no arquivo novo: a linha PONTUAÇÃO tem de dar 0
// sinais sem pausa. Medida, não ouvido: diga ao usuário que ninguém ouviu.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const audio = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
if (!audio) {
  console.error("uso: node pausas.mjs <audio> [--out saida.mp3] [--words x.words.json] [--lines x.lines.json] [--virgula .2] [--dois-pontos .28] [--ponto .42] [--pergunta .48]");
  process.exit(2);
}
const opcao = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const semExt = (f) => f.replace(/\.[a-z0-9]+$/i, "");
const saida = opcao("out", `${semExt(audio)}-ritmo.${audio.split(".").pop()}`);
const arqPalavras = opcao("words", `${semExt(audio)}.words.json`);
const arqLinhas = opcao("lines", `${semExt(audio)}.lines.json`);
if (saida === audio) { console.error("--out não pode ser o próprio arquivo de entrada: o original pago fica como está."); process.exit(2); }
if (!existsSync(arqPalavras)) { console.error(`faltou o tempo das palavras (${arqPalavras}). É o arquivo que o voice.py vo grava.`); process.exit(2); }

const PISO = {
  virgula: Number(opcao("virgula", 0.2)),
  doisPontos: Number(opcao("dois-pontos", 0.28)),
  ponto: Number(opcao("ponto", 0.42)),
  pergunta: Number(opcao("pergunta", 0.48)),
};
const tipoDe = (p) => {
  const s = String(p).trim().replace(/["')\]]+$/, "");
  if (/\?$/.test(s)) return "pergunta";
  if (/[.!…]$/.test(s)) return "ponto";
  if (/[:;]$/.test(s)) return "doisPontos";
  if (/,$/.test(s)) return "virgula";
  return null;
};

const TAXA = 44100;
const amostra = (s) => Math.round(s * TAXA);
const bruto = execFileSync("ffmpeg", ["-v", "error", "-i", audio, "-f", "f32le", "-ac", "1", "-ar", String(TAXA), "-"], { maxBuffer: 1 << 29 });
const x = new Float32Array(bruto.buffer.slice(bruto.byteOffset, bruto.byteOffset + bruto.byteLength));
const palavras = JSON.parse(readFileSync(arqPalavras, "utf8"));

// O instante mais quieto entre dois tempos: o tempo que a ElevenLabs dá a cada
// palavra erra por dezenas de milissegundos, o volume não.
function maisQuieto(de, ate) {
  const janela = amostra(0.012);
  const ini = Math.max(0, amostra(de)), fim = Math.min(x.length - janela, amostra(ate));
  let melhor = Math.max(0, Math.min(ini, x.length - 1)), menor = Infinity;
  for (let p = ini; p <= fim; p += amostra(0.004)) {
    let e = 0;
    for (let j = 0; j < janela; j++) e += x[p + j] * x[p + j];
    if (e < menor) { menor = e; melhor = p + (janela >> 1); }
  }
  return melhor;
}
function rampa(v, noInicio) {
  const m = Math.min(amostra(0.006), v.length);
  for (let i = 0; i < m; i++) { const g = i / m; if (noInicio) v[i] *= g; else v[v.length - 1 - i] *= g; }
  return v;
}

const cortes = []; // { palavra: índice da palavra ANTES da pausa, soma: segundos inseridos }
const pedacos = [];
let pos = 0;
const feitos = [];
for (let i = 0; i < palavras.length - 1; i++) {
  const w = palavras[i], prox = palavras[i + 1];
  const tipo = tipoDe(w.word);
  if (!tipo) continue;
  const pausa = prox.start - w.end;
  const falta = PISO[tipo] - pausa;
  if (falta < 0.02) continue;
  const p = maisQuieto(w.end - 0.03, prox.start + 0.03);
  if (p <= pos) continue;
  pedacos.push(rampa(x.slice(pos, p), false), new Float32Array(amostra(falta)));
  pos = p;
  cortes.push({ palavra: i, soma: amostra(falta) / TAXA });
  feitos.push(`${tipo.padEnd(10)} ${pausa.toFixed(2)} -> ${PISO[tipo].toFixed(2)} s  depois de "${w.word}"`);
}
const resto = x.slice(pos);
pedacos.push(cortes.length ? rampa(resto, true) : resto);
// todo trecho que vem depois de um silêncio inserido entra com rampa
for (let k = 2; k < pedacos.length - 1; k += 2) rampa(pedacos[k], true);
const som = new Float32Array(pedacos.reduce((s, p) => s + p.length, 0));
let o = 0;
for (const p of pedacos) { som.set(p, o); o += p.length; }

const wav = saida.toLowerCase().endsWith(".wav");
const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "f32le", "-ar", String(TAXA), "-ac", "1", "-i", "-", ...(wav ? ["-c:a", "pcm_s16le"] : ["-c:a", "libmp3lame", "-b:a", "192k"]), saida], {
  input: Buffer.from(som.buffer, som.byteOffset, som.byteLength), maxBuffer: 1 << 29,
});
if (r.status !== 0) { console.error(`ffmpeg não gravou ${saida}: ${r.stderr}`); process.exit(1); }

// Os tempos andam junto, contados por palavra e não por relógio: a pausa
// inserida depois da palavra i desloca a i+1 em diante, e só elas. (Pelo
// relógio dava errado quando o ponto mais quieto caía alguns milissegundos
// antes do fim marcado da palavra.)
const antesDe = new Array(palavras.length).fill(0);
{
  let soma = 0, c = 0;
  for (let i = 0; i < palavras.length; i++) {
    antesDe[i] = soma;
    if (c < cortes.length && cortes[c].palavra === i) { soma += cortes[c].soma; c++; }
  }
}
const arred = (n) => Math.round(n * 1000) / 1000;
const novasPalavras = palavras.map((w, i) => {
  const n = { ...w };
  for (const campo of ["start", "end", "raw_start", "raw_end"]) if (typeof n[campo] === "number") n[campo] = arred(n[campo] + antesDe[i]);
  return n;
});
writeFileSync(`${semExt(saida)}.words.json`, JSON.stringify(novasPalavras, null, 1) + "\n");
if (existsSync(arqLinhas)) {
  const linhas = JSON.parse(readFileSync(arqLinhas, "utf8")).map((l) => {
    // a linha começa na sua primeira palavra e termina na última
    let primeira = palavras.findIndex((w) => w.start >= l.start - 0.06);
    if (primeira < 0) primeira = palavras.length - 1;
    let ultima = primeira;
    for (let i = primeira; i < palavras.length && palavras[i].end <= l.end + 0.06; i++) ultima = i;
    const n = { ...l };
    for (const campo of ["start", "raw_start"]) if (typeof n[campo] === "number") n[campo] = arred(n[campo] + antesDe[primeira]);
    for (const campo of ["end", "raw_end"]) if (typeof n[campo] === "number") n[campo] = arred(n[campo] + antesDe[ultima]);
    return n;
  });
  writeFileSync(`${semExt(saida)}.lines.json`, JSON.stringify(linhas, null, 1) + "\n");
}

const total = cortes.reduce((s, c) => s + c.soma, 0);
console.log(`PAUSAS em ${audio}: ${feitos.length} alongadas, ${total.toFixed(2)} s a mais (${(x.length / TAXA).toFixed(2)} -> ${(som.length / TAXA).toFixed(2)} s).`);
for (const f of feitos) console.log("  " + f);
console.log(`Gravado: ${saida}, ${semExt(saida)}.words.json${existsSync(arqLinhas) ? `, ${semExt(saida)}.lines.json` : ""}`);
console.log("Daqui em diante use os arquivos novos. Confira com entonacao.mjs: a linha PONTUAÇÃO tem de dar 0 sinais sem pausa.");
