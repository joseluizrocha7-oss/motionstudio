// Tempos da fala para o filme: lê a narração montada (vozes/montar.mjs) e grava
// assets/<saida>, que o filme carrega como window.FALA (frases e palavras, em
// segundos do filme, já com o atraso de entrada da voz).
//
//   node gerar-fala.mjs [--audio audio] [--saida fala.js] [--offset 0.4]
//
// Imprime a duração sugerida para o filme: fim da voz + 1,4 s (a marca final
// chega com a última palavra e respira até o último quadro).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const opcao = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const AUDIO = join(AQUI, opcao("audio", "audio"));
const SAIDA = opcao("saida", "fala.js");
const OFF = Number(opcao("offset", "0.4"));
const r2 = (x) => Math.round(x * 100) / 100;

const linhas = JSON.parse(readFileSync(join(AUDIO, "vo.lines.json"), "utf8"));
const palavras = JSON.parse(readFileSync(join(AUDIO, "vo.words.json"), "utf8"));
const FALA = {
  offset: OFF,
  linhas: linhas.map((l) => ({ t: l.text, l: l.linha, a: r2(l.start + OFF), b: r2(l.end + OFF) })),
  palavras: palavras.map((p) => ({ w: p.word, l: p.linha, a: r2(p.start + OFF), b: r2(p.end + OFF) })),
};
const fimVoz = Math.max(...FALA.linhas.map((l) => l.b));
writeFileSync(join(AQUI, "assets", SAIDA),
  `// Gerado por gerar-fala.mjs a partir de ${opcao("audio", "audio")}/vo.lines.json e vo.words.json (vozes/montar.mjs). Voz começa em ${OFF} s.\n` +
  `window.FALA = ${JSON.stringify(FALA)};\n`);
console.log(`assets/${SAIDA}: ${FALA.linhas.length} frases, ${FALA.palavras.length} palavras; voz termina em ${fimVoz.toFixed(2)} s; duração sugerida ${(fimVoz + 1.4).toFixed(1)} s`);
