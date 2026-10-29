// Põe a narração montada no tempo das cenas, para filme de tempo fixo (comercial, promo, anúncio).
// O gerar-fala.mjs aceita um atraso só (a voz inteira anda junto). Aqui cada linha do roteiro
// começa num segundo do filme que você escolhe, e o corte cai no meio do silêncio entre as linhas.
//
//   node posicionar-voz.mjs [--tempos ../tempos.json] [--duracao 30] [--audio audio]
//                           [--saida-audio audio-filme] [--saida fala.js]
//
// Lê a voz montada pelo vozes/montar.mjs (<audio>/vo.wav, vo.lines.json, vo.words.json) e grava:
//   - <saida-audio>/vo.wav, vo.lines.json, vo.words.json e vo.posicao.json (o plano de cada linha);
//   - assets/<saida> (fala.js) com offset 0, no mesmo formato do gerar-fala.mjs: os tempos já são do filme.
// Todos os caminhos são relativos à pasta film/ (onde este script mora), como no gerar-fala.mjs.
// Para mixar essa voz: node gerar-som.mjs ... --audio audio-filme --total <duração do filme>.
//
// tempos.json fica ao lado do roteiro.json. A chave é o "id" da linha do roteiro. O valor é o segundo
// do filme em que a fala da linha COMEÇA (a primeira palavra, não a respiração antes dela):
//
//   {
//     "_nota": "chave que começa com _ é comentário e o script ignora",
//     "a1": 0.2,
//     "a2": 3.45,
//     "z1": { "inicio": 25.95, "fim": 29.5 }
//   }
//
//   - número: o segundo em que a linha começa a falar.
//   - { "inicio": s, "fim": s }: o mesmo, mais o fim da cena. O script para se a fala passar dele.
//   - Toda linha da voz precisa de um tempo, e todo tempo precisa de uma linha na voz.
//   - As linhas seguem a ordem do roteiro. Uma linha que começa antes de a anterior terminar é erro.
//
// O corte de cada linha fica no meio do silêncio entre ela e as vizinhas (a montagem já deixou a
// respiração antes e a cauda depois de cada frase). Dentro de uma linha com 2 frases, a pausa
// entre elas não muda.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SR = 48000;
const ANTES_DA_PRIMEIRA = 0.25;   // respiração guardada antes da primeira linha (s)
const DEPOIS_DA_ULTIMA = 0.35;    // cauda guardada depois da última linha (s)
const FADE = 0.012;               // rampa nas pontas do corte (s); o corte está no silêncio
const FOLGA_DO_FIM = 1.4;         // sem --duracao: o filme acaba 1,4 s depois da última fala (como o gerar-fala.mjs)
const TOLERANCIA = 1e-6;
const s2 = (x) => String(+x.toFixed(2));

// Valida o tempos.json. Devolve { id: { inicio, fim } } (fim = null quando não há).
export function lerTempos(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error('tempos.json tem que ser um objeto {"id da linha": segundos}');
  const tempos = {};
  for (const [id, v] of Object.entries(obj)) {
    if (id.startsWith("_")) continue;
    const forma = v !== null && typeof v === "object" && !Array.isArray(v);
    const inicio = forma ? v.inicio : v, fim = forma ? v.fim : undefined;
    if (typeof inicio !== "number" || !Number.isFinite(inicio) || inicio < 0) {
      throw new Error(`tempos.json: "${id}" precisa de um número de segundos maior ou igual a 0 (ou { "inicio": s, "fim": s })`);
    }
    if (fim !== undefined && (typeof fim !== "number" || !Number.isFinite(fim) || fim <= inicio)) {
      throw new Error(`tempos.json: "${id}": o fim (${fim}) tem que ser um número depois do início (${inicio})`);
    }
    tempos[id] = { inicio, fim: fim ?? null };
  }
  if (!Object.keys(tempos).length) throw new Error("tempos.json está vazio");
  return tempos;
}

// Uma faixa por linha do roteiro, na ordem da voz: uma linha pode ter 2 frases (vo.lines.json tem uma entrada por frase).
export function faixasDaVoz(linhas) {
  const porId = new Map();
  for (const l of linhas) {
    if (l.linha === undefined) throw new Error('vo.lines.json: tem frase sem o campo "linha" (a voz vem do vozes/montar.mjs?)');
    const id = String(l.linha);
    const f = porId.get(id) ?? { id, ini: Infinity, fim: -Infinity };
    f.ini = Math.min(f.ini, l.start);
    f.fim = Math.max(f.fim, l.end);
    porId.set(id, f);
  }
  return [...porId.values()].sort((a, b) => a.ini - b.ini);
}

// Calcula onde cada linha vai e quanto de silêncio leva de cada lado. Falha com todos os problemas de uma vez.
// total = duração da voz montada (s); duracao = duração do filme (s).
export function planejar(faixas, tempos, { total, duracao }) {
  const ids = faixas.map((f) => f.id);
  const faltam = ids.filter((id) => !(id in tempos));
  if (faltam.length) throw new Error(`tempos.json não tem tempo para: ${faltam.join(", ")}`);
  const sobram = Object.keys(tempos).filter((id) => !ids.includes(id));
  if (sobram.length) throw new Error(`tempos.json tem linha que não está na voz: ${sobram.join(", ")} (linhas da voz: ${ids.join(", ")})`);

  const p = faixas.map((f) => {
    const { inicio, fim: cena } = tempos[f.id];
    const desloc = inicio - f.ini;
    return { linha: f.id, ini: f.ini, fim: f.fim, inicio, desloc, fimFilme: f.fim + desloc, cena };
  });
  const problemas = [];
  p.forEach((x, i) => {
    const ant = p[i - 1];
    if (ant && x.ini < ant.fim - TOLERANCIA) problemas.push(`vo.lines.json: ${x.linha} começa antes de ${ant.linha} terminar. Monte a voz de novo.`);
    if (ant && x.inicio < ant.fimFilme - TOLERANCIA) {
      problemas.push(`${x.linha} começa em ${s2(x.inicio)} s, antes de ${ant.linha} terminar (${s2(ant.fimFilme)} s). ` +
        `${ant.linha} vem antes no roteiro: ponha ${x.linha} em ${s2(ant.fimFilme)} s ou depois, ou comece ${ant.linha} mais cedo.`);
    }
    if (x.cena !== null && x.fimFilme > x.cena + TOLERANCIA) {
      problemas.push(`${x.linha} termina em ${s2(x.fimFilme)} s e a cena acaba em ${s2(x.cena)} s: comece ${x.linha} pelo menos ${s2(x.fimFilme - x.cena)} s mais cedo, ou encurte a frase.`);
    }
    if (x.fimFilme > duracao + TOLERANCIA) problemas.push(`${x.linha} termina em ${s2(x.fimFilme)} s e o filme acaba em ${s2(duracao)} s: aumente --duracao ou comece ${x.linha} mais cedo.`);
  });
  if (problemas.length) throw new Error(problemas.join("\n"));

  // Silêncio de cada lado: metade do vão entre as linhas na voz, e no máximo a metade do vão no filme.
  p.forEach((x, i) => {
    const ant = p[i - 1], prox = p[i + 1];
    const naVozAntes = ant ? (x.ini - ant.fim) / 2 : Math.min(ANTES_DA_PRIMEIRA, x.ini);
    const naVozDepois = prox ? (prox.ini - x.fim) / 2 : Math.min(DEPOIS_DA_ULTIMA, total - x.fim);
    const noFilmeAntes = ant ? (x.inicio - ant.fimFilme) / 2 : x.inicio;
    const noFilmeDepois = prox ? (prox.inicio - x.fimFilme) / 2 : duracao - x.fimFilme;
    x.antes = Math.max(0, Math.min(naVozAntes, noFilmeAntes));
    x.depois = Math.max(0, Math.min(naVozDepois, noFilmeDepois));
  });
  return p;
}

// PCM de 16 bits, mono, 48 kHz, lido por qualquer arquivo que o ffmpeg entenda.
function lerPcm(arquivo) {
  const bruto = execFileSync("ffmpeg", ["-v", "error", "-i", arquivo, "-f", "s16le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  return new Int16Array(bruto.buffer.slice(bruto.byteOffset, bruto.byteOffset + bruto.length - (bruto.length % 2)));
}

function gravarPcm(arquivo, pcm) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s16le", arquivo],
    { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength) });
}

const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, "utf8").replace(/^﻿/, ""));
const r3 = (x) => Math.round(x * 1000) / 1000;

// Corta cada linha da voz montada, põe no segundo pedido e grava o áudio, os JSON e o fala.js.
export function posicionar({ entrada, saidaAudio, arquivoTempos, saidaFala, duracao }) {
  const lerEm = (nome) => join(entrada, nome);
  for (const nome of ["vo.wav", "vo.lines.json", "vo.words.json"]) {
    if (!existsSync(lerEm(nome))) throw new Error(`não achei ${lerEm(nome)}: rode vozes/montar.mjs antes`);
  }
  if (!existsSync(arquivoTempos)) throw new Error(`não achei ${arquivoTempos}: crie o tempos.json (formato no começo de posicionar-voz.mjs)`);
  if (resolve(saidaAudio) === resolve(entrada)) throw new Error("--saida-audio não pode ser a pasta de --audio: o vo.wav montado seria sobrescrito");

  const linhas = lerJson(lerEm("vo.lines.json")), palavras = lerJson(lerEm("vo.words.json"));
  const fonte = lerPcm(lerEm("vo.wav"));
  const total = fonte.length / SR;
  const faixas = faixasDaVoz(linhas);
  const tempos = lerTempos(lerJson(arquivoTempos));
  // Sem --duracao, o filme acaba FOLGA_DO_FIM depois da última fala.
  const plano = planejar(faixas, tempos, { total, duracao: duracao ?? Infinity });
  const filmeDur = duracao ?? Math.max(...plano.map((x) => x.fimFilme)) + FOLGA_DO_FIM;

  const saida = new Int16Array(Math.round(filmeDur * SR));
  const rampa = Math.round(FADE * SR);
  for (const x of plano) {
    const a = Math.round((x.ini - x.antes) * SR), b = Math.round((x.fim + x.depois) * SR);
    const destino = Math.round((x.inicio - x.antes) * SR);
    for (let i = a; i < b; i++) {
      const k = i - a, n = b - a, j = destino + k;
      if (j < 0 || j >= saida.length || i < 0 || i >= fonte.length) continue;
      const g = Math.min(1, k / rampa, (n - 1 - k) / rampa);
      saida[j] = Math.max(-32768, Math.min(32767, saida[j] + Math.round(fonte[i] * g)));
    }
  }

  const desloc = Object.fromEntries(plano.map((x) => [x.linha, x.desloc]));
  const FALA = {
    offset: 0,
    linhas: linhas.map((l) => ({ t: l.text, l: l.linha, a: r3(l.start + desloc[l.linha]), b: r3(l.end + desloc[l.linha]) })),
    palavras: palavras.map((w) => {
      if (!(w.linha in desloc)) throw new Error(`vo.words.json: a palavra "${w.word}" é da linha "${w.linha}", que não está em vo.lines.json`);
      return { w: w.word, l: w.linha, a: r3(w.start + desloc[w.linha]), b: r3(w.end + desloc[w.linha]) };
    }),
  };

  mkdirSync(saidaAudio, { recursive: true });
  mkdirSync(dirname(saidaFala), { recursive: true });
  gravarPcm(join(saidaAudio, "vo.wav"), saida);
  writeFileSync(join(saidaAudio, "vo.lines.json"), JSON.stringify(linhas.map((l) => ({ ...l, start: r3(l.start + desloc[l.linha]), end: r3(l.end + desloc[l.linha]) })), null, 1));
  writeFileSync(join(saidaAudio, "vo.words.json"), JSON.stringify(palavras.map((w) => ({ ...w, start: r3(w.start + desloc[w.linha]), end: r3(w.end + desloc[w.linha]) })), null, 1));
  const resumo = plano.map((x) => ({ linha: x.linha, fala: [r3(x.inicio), r3(x.fimFilme)], deslocamento: r3(x.desloc), silencioAntes: r3(x.antes), silencioDepois: r3(x.depois), fimDaCena: x.cena }));
  writeFileSync(join(saidaAudio, "vo.posicao.json"), JSON.stringify(resumo, null, 1));
  writeFileSync(saidaFala,
    `// Gerado por posicionar-voz.mjs a partir de ${basename(entrada)}/vo.lines.json e vo.words.json (vozes/montar.mjs) e do tempos.json. Offset 0: os tempos já são do filme.\n` +
    `window.FALA = ${JSON.stringify(FALA)};\n`);
  return { plano: resumo, fala: FALA, duracao: filmeDur, audio: join(saidaAudio, "vo.wav"), saidaFala };
}

// ---------- comando ----------
const OPCOES = ["tempos", "duracao", "audio", "saida-audio", "saida"];
const USO = "uso: node posicionar-voz.mjs [--tempos ../tempos.json] [--duracao 30] [--audio audio] [--saida-audio audio-filme] [--saida fala.js]";

// Só aceita `--nome valor` (com espaço). Opção desconhecida, `--nome=valor`, valor que falta e argumento solto dão erro.
function lerArgumentos(argv) {
  const opcoes = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`argumento inesperado: ${argv[i]}\n${USO}`);
    const nome = argv[i].slice(2);
    if (nome.includes("=")) throw new Error(`escreva ${argv[i].replace("=", " ")} (com espaço, sem "=")\n${USO}`);
    if (!OPCOES.includes(nome)) throw new Error(`opção desconhecida: ${argv[i]}\n${USO}`);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) throw new Error(`falta o valor de ${argv[i]}`);
    opcoes[nome] = argv[++i];
  }
  return opcoes;
}

function comando(argv) {
  const AQUI = dirname(fileURLToPath(import.meta.url));
  const o = lerArgumentos(argv);
  const duracao = o.duracao === undefined ? undefined : Number(o.duracao);
  if (duracao !== undefined && !(duracao > 0)) throw new Error(`--duracao precisa de um número de segundos maior que 0 (veio "${o.duracao}")`);
  const r = posicionar({
    entrada: resolve(AQUI, o.audio ?? "audio"),
    saidaAudio: resolve(AQUI, o["saida-audio"] ?? "audio-filme"),
    arquivoTempos: resolve(AQUI, o.tempos ?? "../tempos.json"),
    saidaFala: resolve(AQUI, "assets", o.saida ?? "fala.js"),
    duracao,
  });
  for (const x of r.plano) {
    console.log(`  ${String(x.linha).padEnd(8)} fala de ${x.fala[0].toFixed(2)} a ${x.fala[1].toFixed(2)} s` +
      (x.fimDaCena === null ? "" : ` (a cena acaba em ${x.fimDaCena} s)`));
  }
  const fimVoz = Math.max(...r.fala.linhas.map((l) => l.b));
  console.log(`${r.audio}: ${r.duracao.toFixed(2)} s`);
  console.log(`${r.saidaFala}: ${r.fala.linhas.length} frases, ${r.fala.palavras.length} palavras; offset 0; voz termina em ${fimVoz.toFixed(2)} s`);
}

// Só roda como comando. O Node resolve atalhos (junction) no arquivo principal; o realpath faz o mesmo no argv.
function executadoComoComando() {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (executadoComoComando()) {
  try { comando(process.argv.slice(2)); }
  catch (e) { console.error(`posicionar-voz: ${e.message}`); process.exit(1); }
}
