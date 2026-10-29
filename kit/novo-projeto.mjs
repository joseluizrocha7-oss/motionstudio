// Cria a pasta de um filme novo com o kit da motionstudio:
//   node ~/.claude/skills/motionstudio/kit/novo-projeto.mjs <pasta-do-projeto>
//
// <pasta>/
//   motionstudio.json     onde está a skill (autoteste, tela-vazia e vozes leem daqui; _skill.mjs acha)
//   roteiro.json          o que a voz diz (texto = tela e voz; fala = só voz), por bloco
//   vozes/                tomadas da voz (Gemini TTS), alinhamento (Whisper) e montagem frase a frase
//   gerar-trilha.mjs      a música de fundo pela Lyria 3 Pro (film/assets/musica/)
//   gerar-som.mjs         a música (--musica) ou a trilha de código, os efeitos e a mixagem
//   autoteste.mjs         Motion.selfTest do filme (0 divergências antes de renderizar)
//   tela-vazia.mjs        sonda de celular sem foto (o G2 não vê)
//   film/fonte/           base.html, iphone.js, pe.html e a linha do tempo (longo.js)
//   film/montar-filmes.mjs  gera os index-*.html (versões, temas, 9:16 e 16:9)
//   film/gerar-fala.mjs   tempos da voz para o filme (assets/fala.js)
//   film/runtime/         o motor de animação (cópia de runtime/ da skill)
//   film/assets/, film/telas/   símbolo da marca, fotos do app e medidas.js
// Não sobrescreve nada que já exista.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(KIT, "..");
const destino = process.argv[2] && resolve(process.argv[2]);
if (!destino) { console.error("uso: node novo-projeto.mjs <pasta-do-projeto>"); process.exit(2); }

const copiados = [];
const cacheDoPython = (nome) => nome === "__pycache__" || nome.endsWith(".pyc");   // fica na máquina de quem rodou o Python
function copiar(de, para) {
  if (statSync(de).isDirectory()) {
    mkdirSync(para, { recursive: true });
    for (const f of readdirSync(de)) if (!cacheDoPython(f)) copiar(join(de, f), join(para, f));
  } else if (!existsSync(para)) { cpSync(de, para); copiados.push(para); }
}
for (const f of readdirSync(KIT)) if (f !== "novo-projeto.mjs" && f !== "LEIA-ME.md" && !cacheDoPython(f)) copiar(join(KIT, f), join(destino, f));
copiar(join(SKILL, "runtime"), join(destino, "film", "runtime"));
for (const d of ["film/assets", "film/telas", "vozes/tomadas"]) mkdirSync(join(destino, d), { recursive: true });
// Os scripts do projeto (autoteste, tela-vazia, vozes) acham a skill por este arquivo.
const ligacao = join(destino, "motionstudio.json");
if (!existsSync(ligacao)) { writeFileSync(ligacao, JSON.stringify({ skill: SKILL }, null, 2) + "\n"); copiados.push(ligacao); }
console.log(`${copiados.length} arquivos em ${destino}`);
console.log(`Próximo passo: o roteiro (roteiro.json) e o passo a passo do kit em ${join(SKILL, "kit", "LEIA-ME.md")}`);
