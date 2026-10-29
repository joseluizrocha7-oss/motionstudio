#!/usr/bin/env node
// ACRÉSCIMO LOCAL (13/10/2026), não faz parte da skill original.
//
// Mede a entonação de uma narração, linha a linha: a altura da voz (F0), quanto
// ela varia, como cada linha termina, o ritmo e as pausas. Existe porque quem
// monta o filme não ouve o resultado, e a primeira narração feita assim foi
// reprovada pelo usuário por entonação ("a entonação da voz/fala não está
// adequada", 13/10/2026, taste/verdicts.md).
//
// Uso:
//   node entonacao.mjs audio/vo.mp3 [--words audio/vo.words.json] [--lines audio/vo.lines.json] [--json]
//
// Sem --words e --lines, procura <audio sem extensão>.words.json e .lines.json
// (os arquivos que o `voice.py vo` grava). Só precisa do ffmpeg.
//
// O .lines.json é uma lista de linhas em um destes dois formatos:
//   montar.mjs   { text, start, end }
//   fala.js      { t, a, b }
// Se faltar um campo, o script sai com código 1 e diz qual campo e qual linha
// (índice a partir de 0), antes de decodificar o áudio.
//
// O que os números querem dizer (voz feminina ou masculina, tanto faz: tudo é
// relativo à mediana da própria fala, em semitons):
//   variação < 2 st numa linha        fala monótona
//   afirmação que termina > -2 st     a voz não desceu no ponto final: a frase fica "no ar"
//   mais de 6,8 sílabas por segundo   corrido para gancho, lema ou chamada
//   pausa < 0,25 s entre linhas       as ideias emendam
//   sinal de pontuação sem pausa      "fala como se não tivesse pontuação"
//                                     (vírgula < 0,12 s, dois-pontos < 0,18 s, ponto < 0,30 s)
// É medida, não ouvido: serve para escolher entre tomadas e para não entregar
// o defeito óbvio. Diga sempre ao usuário que ninguém ouviu.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const audio = args.find((a) => !a.startsWith("--"));
if (!audio) {
  console.error("uso: node entonacao.mjs <audio> [--words x.words.json] [--lines x.lines.json] [--json]");
  process.exit(2);
}
const opcao = (nome) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : undefined; };
const base = audio.replace(/\.[a-z0-9]+$/i, "");
const arqPalavras = opcao("words") || `${base}.words.json`;
const arqLinhas = opcao("lines") || `${base}.lines.json`;
if (!existsSync(arqPalavras)) {
  console.error(`faltou o tempo das palavras (${arqPalavras}). É o arquivo que o voice.py vo grava.`);
  process.exit(2);
}
const palavras = JSON.parse(readFileSync(arqPalavras, "utf8")).map((w) => ({ p: w.word ?? w.p, ini: w.start ?? w.ini, fim: w.end ?? w.fim }));

// As linhas do roteiro, nos dois formatos. Valida tudo antes de decodificar o
// áudio: arquivo errado falha na hora, com o campo e o índice da linha.
function lerLinhas(arq) {
  const falha = (msg) => { console.error(msg); process.exit(1); };
  let bruto;
  try { bruto = JSON.parse(readFileSync(arq, "utf8")); } catch (e) { falha(`não deu para ler ${arq}: ${e.message}`); }
  if (!Array.isArray(bruto)) falha(`${arq} tem que ser uma lista de linhas ({ text, start, end } ou { t, a, b }).`);
  const erros = [];
  const linhas = bruto.map((l, i) => {
    const o = l && typeof l === "object" ? l : {};
    const texto = o.text ?? o.t, ini = o.start ?? o.a, fim = o.end ?? o.b;
    const faltam = [];
    if (typeof texto !== "string" || !texto.trim()) faltam.push('"text" (ou "t")');
    if (!Number.isFinite(ini)) faltam.push('"start" (ou "a")');
    if (!Number.isFinite(fim)) faltam.push('"end" (ou "b")');
    if (faltam.length) erros.push(`linha [${i}]: falta ${faltam.join(", ")}`);
    return { texto, ini, fim };
  });
  if (erros.length) {
    const mostrar = erros.slice(0, 10);
    if (erros.length > mostrar.length) mostrar.push(`... e mais ${erros.length - mostrar.length}`);
    falha(`${arq} tem linha com campo faltando (aceito: text, start, end do montar.mjs ou t, a, b do fala.js):\n  ${mostrar.join("\n  ")}`);
  }
  return linhas;
}
const linhasDoRoteiro = existsSync(arqLinhas) ? lerLinhas(arqLinhas) : null;

const TAXA = 16000, PASSO = 160, JANELA = 480;
const bruto = execFileSync("ffmpeg", ["-v", "error", "-i", audio, "-f", "f32le", "-ac", "1", "-ar", String(TAXA), "-"], { maxBuffer: 1 << 28 });
const x = new Float32Array(bruto.buffer.slice(bruto.byteOffset, bruto.byteOffset + bruto.byteLength));

// YIN (de Cheveigné e Kawahara, 2002). Duas passadas: a primeira acha a
// região da voz, a segunda aperta a faixa em volta dela para não cair em
// erro de oitava.
function contorno(f0Min, f0Max) {
  const tauMin = Math.floor(TAXA / f0Max), tauMax = Math.ceil(TAXA / f0Min);
  let pico = 0;
  for (let i = 0; i < x.length; i++) pico = Math.max(pico, Math.abs(x[i]));
  const limiar = pico * 0.02;
  const q = [];
  const d = new Float64Array(tauMax + 2), n = new Float64Array(tauMax + 2);
  for (let ini = 0; ini + JANELA + tauMax + 2 < x.length; ini += PASSO) {
    let e = 0;
    for (let j = 0; j < JANELA; j++) e += x[ini + j] * x[ini + j];
    const t = (ini + JANELA / 2) / TAXA;
    if (Math.sqrt(e / JANELA) < limiar) { q.push({ t, f0: 0 }); continue; }
    let soma = 0;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      let s = 0;
      for (let j = 0; j < JANELA; j++) { const dif = x[ini + j] - x[ini + j + tau]; s += dif * dif; }
      d[tau] = s; soma += s; n[tau] = soma > 0 ? (s * tau) / soma : 1;
    }
    let melhor = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (n[tau] < 0.15) { while (tau + 1 <= tauMax && n[tau + 1] < n[tau]) tau++; melhor = tau; break; }
    }
    if (melhor < 0) { q.push({ t, f0: 0 }); continue; }
    const a = n[melhor - 1], b = n[melhor], c = n[melhor + 1];
    const desloc = a + c - 2 * b !== 0 ? (0.5 * (a - c)) / (a + c - 2 * b) : 0;
    const f0 = TAXA / (melhor + desloc);
    q.push({ t, f0: f0 >= f0Min && f0 <= f0Max ? f0 : 0 });
  }
  for (let i = 2; i < q.length - 2; i++) {
    const viz = [q[i - 2], q[i - 1], q[i + 1], q[i + 2]].map((v) => v.f0).filter(Boolean).sort((a, b) => a - b);
    if (!q[i].f0 || viz.length < 3) continue;
    const med = viz[Math.floor(viz.length / 2)];
    if (q[i].f0 > med * 1.6 || q[i].f0 < med / 1.6) q[i].f0 = 0;
  }
  return q;
}
const mediana = (v) => { if (!v.length) return 0; const o = [...v].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; };
const percentil = (v, p) => { if (!v.length) return 0; const o = [...v].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))]; };
const st = (f, ref) => 12 * Math.log2(f / ref);
const desvio = (v) => { if (v.length < 2) return 0; const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };
const silabas = (t) => (t.toLowerCase().match(/[aeiouyáéíóúâêôãõàü]+/g) || []).length;

const grosso = mediana(contorno(70, 450).map((v) => v.f0).filter(Boolean)) || 180;
const q = contorno(grosso / 1.9, grosso * 1.9);
const REF = mediana(q.map((v) => v.f0).filter(Boolean));

// as unidades: as linhas do roteiro, se houver; senão, as frases pela pontuação
let unidades;
if (linhasDoRoteiro) {
  unidades = linhasDoRoteiro;
} else {
  unidades = [];
  let atual = [];
  for (const w of palavras) { atual.push(w); if (/[.!?:]$/.test(w.p)) { unidades.push(atual); atual = []; } }
  if (atual.length) unidades.push(atual);
  unidades = unidades.map((ws) => ({ texto: ws.map((w) => w.p).join(" "), ini: ws[0].ini, fim: ws.at(-1).fim }));
}

const alertas = [];
const medidas = unidades.map((u, k) => {
  const voz = q.filter((v) => v.t >= u.ini - 0.02 && v.t <= u.fim + 0.08 && v.f0);
  const f0s = voz.map((v) => v.f0);
  const med = mediana(f0s) || REF;
  const cauda = voz.filter((v) => v.t >= (voz.at(-1)?.t ?? u.fim) - 0.22).map((v) => v.f0);
  const termina = cauda.length ? st(mediana(cauda), med) : 0;
  const variacao = desvio(f0s.map((f) => st(f, med)));
  const ritmo = silabas(u.texto) / Math.max(0.2, u.fim - u.ini);
  const pausa = unidades[k + 1] ? unidades[k + 1].ini - u.fim : null;
  const dentro = palavras.filter((w) => w.ini >= u.ini - 0.05 && w.fim <= u.fim + 0.05 && String(w.p).replace(/[^\p{L}]/gu, "").length > 2);
  const enfase = dentro.map((w) => { const f = q.filter((v) => v.t >= w.ini && v.t <= w.fim && v.f0).map((v) => v.f0); return { p: String(w.p).replace(/[.,:!?]/g, ""), pico: f.length ? st(percentil(f, 90), med) : -99 }; })
    .sort((a, b) => b.pico - a.pico).slice(0, 2).map((w) => w.p);
  const curto = u.texto.trim().slice(0, 60);
  if (variacao < 2 && silabas(u.texto) > 3) alertas.push(`monótona (${variacao.toFixed(1)} st): "${curto}"`);
  if (/[.!]$/.test(u.texto.trim()) && termina > -2) alertas.push(`termina no ar (${termina.toFixed(1)} st): "${curto}"`);
  if (ritmo > 6.8) alertas.push(`corrida (${ritmo.toFixed(1)} síl/s): "${curto}"`);
  if (pausa != null && pausa < 0.25) alertas.push(`emenda na seguinte (pausa de ${pausa.toFixed(2)} s): "${curto}"`);
  return { texto: u.texto, variacao_st: +variacao.toFixed(2), termina_st: +termina.toFixed(1), silabas_s: +ritmo.toFixed(1), pausa_depois: pausa == null ? null : +pausa.toFixed(2), enfase };
});
// A pontuação DENTRO da linha (acréscimo de 13/10/2026 à noite). Uma narração
// passou em tudo acima e o usuário reprovou: "ela fala como se não tivesse
// pontuação". Linha com vírgula era lida de um fôlego só, e a medida só olhava
// a pausa entre uma linha e outra. Agora cada sinal é conferido pelo tempo das
// palavras: quanto silêncio veio depois dele.
const PISO = { virgula: 0.12, doisPontos: 0.18, ponto: 0.3 };
const sinais = [];
for (let i = 0; i < palavras.length - 1; i++) {
  const p = String(palavras[i].p).trim();
  const tipo = /[.!?…]["')\]]*$/.test(p) ? "ponto" : /[:;]$/.test(p) ? "doisPontos" : /,$/.test(p) ? "virgula" : null;
  if (!tipo) continue;
  const pausa = palavras[i + 1].ini - palavras[i].fim;
  const curta = pausa < PISO[tipo];
  sinais.push({ depois_de: p, antes_de: String(palavras[i + 1].p), tipo, pausa: +pausa.toFixed(2), curta });
  if (curta) alertas.push(`pontuação sem pausa (${pausa.toFixed(2)} s depois de "${p}", antes de "${palavras[i + 1].p}")`);
}
const semPausa = sinais.filter((s) => s.curta).length;

const todos = q.map((v) => v.f0).filter(Boolean).map((f) => st(f, REF));
const geral = { mediana_hz: Math.round(REF), variacao_st: +desvio(todos).toFixed(2), faixa_st: +(percentil(todos, 90) - percentil(todos, 10)).toFixed(1), linhas: medidas.length, sinais: sinais.length, sinais_sem_pausa: semPausa, alertas: alertas.length };

if (args.includes("--json")) {
  console.log(JSON.stringify({ geral, linhas: medidas, sinais, alertas }, null, 1));
} else {
  console.log(`ENTONAÇÃO de ${audio}: mediana ${geral.mediana_hz} Hz | variação ${geral.variacao_st} st | faixa (10 a 90%) ${geral.faixa_st} st`);
  for (const m of medidas) console.log(`  var ${String(m.variacao_st).padStart(4)} st | termina ${String(m.termina_st).padStart(5)} st | ${String(m.silabas_s).padStart(4)} síl/s | pausa ${m.pausa_depois ?? "  - "} | ênfase: ${m.enfase.join(", ").padEnd(22)} | ${m.texto.trim().slice(0, 66)}`);
  console.log(`PONTUAÇÃO: ${sinais.length} sinais dentro da fala, ${semPausa} sem pausa (pisos: vírgula ${PISO.virgula} s, dois-pontos ${PISO.doisPontos} s, ponto ${PISO.ponto} s).${semPausa ? " Corrigir no som com scripts/pausas.mjs, sem gerar de novo." : ""}`);
  console.log(alertas.length ? `\nALERTAS (${alertas.length}):\n  ` + alertas.join("\n  ") : "\nSem alerta de entonação.");
  console.log("\nMedida, não ouvido. Diga ao usuário que ninguém ouviu a narração.");
}
