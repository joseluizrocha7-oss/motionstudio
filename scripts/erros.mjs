#!/usr/bin/env node
// Abre o filme no Chrome e mostra as exceções da página, sem rodar o selfTest.
// Rode antes do autoteste: se a linha do tempo lança exceção, o autoteste.mjs espera
// 10 minutos antes de desistir (aconteceu em 28/10/2026). Este comando responde em 6 s.
//
// Comando:
//   node erros.mjs <film/index.html>
//
// Espera 6 s depois do load. Sem exceção, imprime "sem exceção" e sai com código 0.
// Com exceção (erro não tratado ou promessa rejeitada sem tratamento), imprime cada uma
// e sai com código 1. Abre com --allow-file-access-from-files, como o render.mjs.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchChrome } from "./_cdp.mjs";

const arq = process.argv[2];
if (!arq) { console.error("uso: node erros.mjs <film/index.html>"); process.exit(2); }
const url = /^(https?|file):/i.test(arq) ? arq : existsSync(arq) ? pathToFileURL(path.resolve(arq)).href : null;
if (!url) { console.error(`erro: arquivo não encontrado: ${arq}`); process.exit(2); }

const br = await launchChrome({ args: ["--allow-file-access-from-files"] });
try {
  const p = await br.newPage({ width: 1920, height: 1080 });
  const erros = [];
  p.on("Runtime.exceptionThrown", (e) => erros.push((e.exceptionDetails?.exception?.description || e.exceptionDetails?.text || "").split("\n").slice(0, 3).join(" | ")));
  await p.goto(url);
  await new Promise((ok) => setTimeout(ok, 6000));
  console.log(erros.length ? erros.join("\n") : "sem exceção");
  if (erros.length) process.exitCode = 1;
} finally { await br.close(); }
process.exit(process.exitCode ?? 0);   // sem isto, o timer de 30 s do goto() do _cdp.mjs segura o processo depois do fim
