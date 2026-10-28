// Legenda do filme (kit da skill motionstudio): quebra o texto do roteiro em
// pedaços de 1 ou 2 linhas e dá a cada pedaço o tempo da fala.
//
// O texto vem do roteiro (o que aparece na tela), não da fala transcrita. Os tempos vêm
// de FALA (film/assets/fala.js), que já inclui o atraso de entrada da voz (offset):
// não some o offset de novo. Todos os tempos saem em segundos do filme, em milissegundos.
//
// Comando (a partir da pasta do projeto):
//   node gerar-legenda.mjs [--roteiro roteiro.json] [--fala film/assets/fala.js] [--saida film/legenda-<formato>.srt] [--formato 16x9|9x16]
//
// A saída padrão leva o formato no nome (film/legenda-16x9.srt, film/legenda-9x16.srt): os 2 formatos
// não se sobrescrevem. As opções vão com espaço (--formato 9x16), nunca com "=". Opção desconhecida,
// opção sem valor e resultado com 0 blocos saem com código 1.

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

// Limites por formato, em caracteres. maxPedaco = 2 linhas cheias menos 8 de folga da quebra.
// 16x9: a linha de 42 ocupa cerca de metade dos 1920 px. 9x16: Inter Bold 54 em 1080 px com margens de 80
// deixa 920 px de texto. Medido com libass (ffmpeg), texto pt-BR com muitos M, W, ç e ã: cabem até 36
// caracteres numa linha; 32 é isso menos 10% de folga.
export const LIMITES = {
  "16x9": { maxLinha: 42, maxPedaco: 76 },
  "9x16": { maxLinha: 32, maxPedaco: 56 },
};
const CORTE_PONTUACAO = 30;      // só corta na pontuação se o texto até ela tem isto ou mais
const DESCONTO_PONTUACAO = 6;    // abate do custo da quebra que termina a linha 1 em pontuação
const PENALIDADE_CURTA = 8;      // soma ao custo da quebra que deixa palavra de até 2 letras no fim da linha 1
const DIVISOR_SOBRA = 3;         // o último pedaço de uma frase longa tem ao menos maxPedaco / 3 caracteres (senão refaz o corte)
const PREFIXOS_UNIDOS = ["R$", "US$", "€", "nº"];   // vão sempre na mesma linha do número que vem depois
const NBSP = "\u00A0";           // espaço sem quebra: une o prefixo à palavra durante a quebra; sai como espaço comum

const ms = (x) => Math.round(x * 1000) / 1000;
// Palavras como vêm no texto (a fala também separa só por espaço).
const palavrasSoltas = (texto) => String(texto ?? "").split(/\s+/).filter(Boolean);
// Palavras para quebrar: o prefixo ("R$", "nº"...) já vem unido à palavra seguinte por um NBSP.
function palavrasDe(texto) {
  const soltas = palavrasSoltas(texto), unidas = [];
  for (let i = 0; i < soltas.length; i++) {
    const prefixo = PREFIXOS_UNIDOS.some((p) => p.toLowerCase() === soltas[i].toLowerCase());
    unidas.push(prefixo && i + 1 < soltas.length ? `${soltas[i]}${NBSP}${soltas[++i]}` : soltas[i]);
  }
  return unidas;
}
const terminaEmPontuacao = (palavra) => /[,.;:!?]$/.test(palavra);
const tamanho = (palavras) => palavras.join(" ").length;
// Palavra sem acento, caixa nem pontuação: serve só para conferir se a fala é a mesma do texto.
const chave = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Escolhe o item de menor valor; no empate fica o primeiro.
function menorPor(itens, valor) {
  return itens.reduce((m, x) => (valor(x) < valor(m) ? x : m));
}

// Custo de partir a lista de palavras em duas, com k palavras na 1ª parte: partes de tamanho parecido,
// pontuação no fim da 1ª, sem palavra curta (até 2 letras) no fim dela. Menor é melhor.
function custoDaQuebra(palavras, k) {
  const ultima = palavras[k - 1];
  return Math.abs(tamanho(palavras.slice(0, k)) - tamanho(palavras.slice(k)))
    - (terminaEmPontuacao(ultima) ? DESCONTO_PONTUACAO : 0)
    + (ultima.replace(/[,.;:!?]+$/, "").length <= 2 ? PENALIDADE_CURTA : 0);
}

// Um pedaço (lista de palavras) em 1 ou 2 linhas, em "\n".
function emLinhas(palavras, maxLinha) {
  const inteiro = palavras.join(" ");
  if (inteiro.length <= maxLinha || palavras.length < 2) return inteiro;
  const opcoes = [];
  for (let k = 1; k < palavras.length; k++) {
    const l1 = palavras.slice(0, k).join(" "), l2 = palavras.slice(k).join(" ");
    opcoes.push({ l1, l2, maior: Math.max(l1.length, l2.length), custo: custoDaQuebra(palavras, k) });
  }
  const cabem = opcoes.filter((o) => o.maior <= maxLinha);
  // Sem quebra em que as 2 linhas caibam (palavra de 40 e tantas letras no meio): a que deixa a linha mais longa menor.
  const o = cabem.length ? menorPor(cabem, (x) => x.custo) : menorPor(opcoes, (x) => x.maior);
  return `${o.l1}\n${o.l2}`;
}

// Texto do roteiro em pedaços de 1 ou 2 linhas, dentro dos limites do formato (padrão 16x9).
export function quebrarTexto(texto, limites = LIMITES["16x9"]) {
  const { maxLinha, maxPedaco } = limites;
  const palavras = palavrasDe(texto);
  const pedacos = [];
  let atual = [];
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    if (p.length > maxLinha) {                       // palavra longa (endereço): pedaço sozinho
      if (atual.length) pedacos.push(atual);
      pedacos.push([p]);
      atual = [];
    } else if (!atual.length || tamanho([...atual, p]) <= maxPedaco) {
      atual.push(p);
    } else {
      // Passou do maxPedaco: corta depois da última palavra com pontuação (se o texto até ela tem 30 ou mais), senão antes de p.
      let corte = atual.length;
      for (let k = atual.length - 1; k >= 0; k--) {
        if (terminaEmPontuacao(atual[k]) && tamanho(atual.slice(0, k + 1)) >= CORTE_PONTUACAO) { corte = k + 1; break; }
      }
      // Se o que sobra do texto é curto (1 ou 2 palavras sozinhas na tela), refaz o corte sobre o pedaço atual + a sobra:
      // entre as quebras em que a 2ª parte cabe no maxPedaco, a de menor custo. (A 1ª parte sempre cabe: é parte do pedaço atual.)
      if (tamanho([...atual.slice(corte), ...palavras.slice(i)]) < Math.floor(maxPedaco / DIVISOR_SOBRA)) {
        const todo = [...atual, ...palavras.slice(i)];
        const cortes = [];
        for (let k = 1; k <= atual.length; k++) if (tamanho(todo.slice(k)) <= maxPedaco) cortes.push(k);
        corte = menorPor(cortes, (k) => custoDaQuebra(todo, k));
      }
      pedacos.push(atual.slice(0, corte));
      i -= atual.length - corte + 1;                  // o resto do pedaço e p voltam para a fila
      atual = [];
    }
  }
  if (atual.length) pedacos.push(atual);
  return pedacos.map((p) => emLinhas(p, maxLinha).replaceAll(NBSP, " "));
}

// Tempo de cada pedaço. Com as palavras da fala (mesmo texto, mesmo número de palavras), vai do início
// da 1ª ao fim da última. Sem elas, reparte o tempo da frase pela quantidade de caracteres (sem o "\n").
export function temposDosPedacos(pedacos, frase, palavras) {
  const lista = pedacos.map(palavrasSoltas);   // a fala separa só por espaço: "R$ 600,00" são 2 palavras
  const todas = lista.flat();
  if (palavras && todas.length > 0 && palavras.length === todas.length
      && todas.every((w, i) => chave(w) === chave(palavras[i].w))) {
    let i = 0;
    return pedacos.map((texto, n) => {
      const ini = palavras[i], fim = palavras[i + lista[n].length - 1];
      i += lista[n].length;
      return { a: ms(ini.a), b: ms(fim.b), texto };
    });
  }
  const pesos = pedacos.map((p) => p.replace(/\n/g, "").length);
  const soma = pesos.reduce((s, x) => s + x, 0) || 1;
  let acumulado = 0;
  return pedacos.map((texto, n) => {
    const a = frase.a + (frase.b - frase.a) * acumulado / soma;
    acumulado += pesos[n];
    const b = n === pedacos.length - 1 ? frase.b : frase.a + (frase.b - frase.a) * acumulado / soma;
    return { a: ms(a), b: ms(b), texto };
  });
}

// Estende cada legenda até durar `min` segundos, sem passar de `folga` antes da próxima. Nunca encurta.
export function ajustarDuracoes(blocos, { min = 1.0, folga = 0.05 } = {}) {
  return blocos.map((bl, i) => {
    const limite = i + 1 < blocos.length ? blocos[i + 1].a - folga : Infinity;
    return { a: ms(bl.a), b: ms(Math.max(bl.b, Math.min(bl.a + min, limite))), texto: bl.texto };
  });
}

// Legendas do filme inteiro: o texto do roteiro com o tempo da fala. A linha que o roteiro tem
// e a fala não tem (voz não gerada) fica de fora. Palavras da fala só valem quando a linha não
// tem `fala` (o texto da tela é o que a voz diz). O formato define o tamanho máximo da linha.
export function legendasDoFilme(roteiro, fala, { formato = "16x9" } = {}) {
  const limites = LIMITES[formato];
  if (!limites) throw new Error(`formato inválido: "${formato}" (use ${Object.keys(LIMITES).join(" ou ")})`);
  const blocos = [];
  for (const bloco of roteiro.blocos ?? []) {
    for (const linha of bloco.linhas ?? []) {
      const frases = fala.linhas.filter((f) => f.l === linha.id);
      if (!frases.length) continue;
      const frase = { a: frases[0].a, b: frases[frases.length - 1].b };
      const palavras = linha.fala ? null : (fala.palavras ?? []).filter((p) => p.l === linha.id);
      blocos.push(...temposDosPedacos(quebrarTexto(linha.texto, limites), frase, palavras));
    }
  }
  return ajustarDuracoes(blocos);
}

// ---------- .srt ----------

const dois = (n) => String(n).padStart(2, "0");

// Segundos em "HH:MM:SS,mmm".
function tempoSrt(s) {
  const t = Math.round(s * 1000);
  return `${dois(Math.floor(t / 3600000))}:${dois(Math.floor(t / 60000) % 60)}:${dois(Math.floor(t / 1000) % 60)},${String(t % 1000).padStart(3, "0")}`;
}

export function paraSrt(blocos) {
  return blocos.map((b, i) => `${i + 1}\n${tempoSrt(b.a)} --> ${tempoSrt(b.b)}\n${b.texto}\n\n`).join("");
}

// O inverso de paraSrt. Aceita \r\n e BOM; o número do bloco é ignorado.
export function lerSrt(texto) {
  const segundos = (t) => {
    const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/.exec(t.trim());
    if (!m) throw new Error(`tempo de legenda inválido: "${t.trim()}"`);
    return ms(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000);
  };
  return texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().split(/\n{2,}/).filter(Boolean).map((bloco) => {
    const linhas = bloco.split("\n");
    const i = linhas.findIndex((l) => l.includes("-->"));
    if (i < 0) throw new Error(`bloco de legenda sem tempo: "${linhas[0]}"`);
    const [a, b] = linhas[i].split("-->");
    return { a: segundos(a), b: segundos(b), texto: linhas.slice(i + 1).join("\n") };
  });
}

// ---------- .ass ----------

// Por formato: resolução do vídeo, tamanho da fonte e margem de baixo (em pixels da resolução).
const FORMATOS_ASS = {
  "16x9": { largura: 1920, altura: 1080, fonte: 40, margemV: 30 },
  "9x16": { largura: 1080, altura: 1920, fonte: 54, margemV: 260 },
};
const MARGEM_LATERAL = 80;

// Segundos em "H:MM:SS.cc" (centésimos).
function tempoAss(s) {
  const c = Math.round(s * 100);
  return `${Math.floor(c / 360000)}:${dois(Math.floor(c / 6000) % 60)}:${dois(Math.floor(c / 100) % 60)}.${dois(c % 100)}`;
}

// "#RRGGBB" em "BBGGRR" (a ordem do ASS).
function bgr(cor) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(cor));
  if (!m) throw new Error(`cor inválida: "${cor}" (use #RRGGBB)`);
  return `${m[3]}${m[2]}${m[1]}`.toUpperCase();
}

// Cor do ASS: &HAABBGGRR. AA = 00 é opaco; FF é transparente.
const corAss = (cor, opacidade = 1) =>
  `&H${Math.round((1 - opacidade) * 255).toString(16).toUpperCase().padStart(2, "0")}${bgr(cor)}`;

export function paraAss(blocos, estilo) {
  const f = FORMATOS_ASS[estilo?.formato];
  if (!f) throw new Error(`formato inválido: "${estilo?.formato}" (use 16x9 ou 9x16)`);
  const { corTexto = "#FFFFFF", corCaixa = "#111111", opacidadeCaixa = 0.85, margemEsq = MARGEM_LATERAL, margemDir = MARGEM_LATERAL } = estilo;
  if (!(opacidadeCaixa >= 0 && opacidadeCaixa <= 1)) throw new Error(`opacidadeCaixa fora de 0 a 1: ${opacidadeCaixa}`);
  const caixa = corAss(corCaixa, opacidadeCaixa);
  // BorderStyle 3 desenha a caixa com OutlineColour; Outline 14 é a folga dela em volta do texto.
  const estiloLegenda = ["Legenda", "Inter Variable", f.fonte, corAss(corTexto), corAss(corTexto), caixa, caixa,
    -1, 0, 0, 0, 100, 100, 0, 0, 3, 14, 0, 2, margemEsq, margemDir, f.margemV, 1].join(",");
  const falas = blocos.map((b) =>
    `Dialogue: 0,${tempoAss(b.a)},${tempoAss(b.b)},Legenda,,0,0,0,,${b.texto.replace(/\n/g, "\\N")}`);
  return [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${f.largura}`, `PlayResY: ${f.altura}`, "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: ${estiloLegenda}`, "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...falas, "",
  ].join("\n");
}

// ---------- fala.js e comando ----------

// Lê o `window.FALA = {...}` do fala.js (o mesmo recorte do gerar-som.mjs).
export function lerFala(arquivo) {
  const t = readFileSync(arquivo, "utf8");
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j < i) throw new Error(`${arquivo}: não achei o objeto FALA`);
  return JSON.parse(t.slice(i, j + 1));
}

const OPCOES = ["roteiro", "fala", "saida", "formato"];
const USO = "uso: node gerar-legenda.mjs [--roteiro roteiro.json] [--fala film/assets/fala.js] [--saida film/legenda-<formato>.srt] [--formato 16x9|9x16]";

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
  const opcoes = lerArgumentos(argv);
  const formato = opcoes.formato ?? "16x9";
  if (!LIMITES[formato]) throw new Error(`formato inválido: "${formato}" (use ${Object.keys(LIMITES).join(" ou ")})`);
  const arqRoteiro = opcoes.roteiro ?? "roteiro.json", arqFala = opcoes.fala ?? "film/assets/fala.js";
  const saida = opcoes.saida ?? `film/legenda-${formato}.srt`;
  const roteiro = JSON.parse(readFileSync(arqRoteiro, "utf8").replace(/^\uFEFF/, ""));
  const fala = lerFala(arqFala);
  const blocos = legendasDoFilme(roteiro, fala, { formato });
  if (!blocos.length) {
    throw new Error(`0 blocos: nenhuma linha de ${arqRoteiro} tem fala em ${arqFala}. Confira se o "l" da fala é o "id" da linha do roteiro. Nada foi gravado.`);
  }
  mkdirSync(dirname(saida), { recursive: true });
  writeFileSync(saida, paraSrt(blocos), "utf8");
  console.log(`legenda: ${blocos.length} blocos em ${saida}`);
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
  catch (e) { console.error(`legenda: ${e.message}`); process.exit(1); }
}
