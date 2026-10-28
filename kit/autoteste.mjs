// Roda o Motion.selfTest do filme (consistência quadro a quadro: tocar em sequência e
// saltar direto para um quadro têm de dar a mesma tela). Tem de dar 0 divergências
// antes de qualquer render.
//   node autoteste.mjs film/index-vertical.html
// Usa o Chrome pelo conector da própria skill (scripts/_cdp.mjs): não precisa de Playwright.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acharSkill } from "./_skill.mjs";
const SKILL = acharSkill(path.dirname(fileURLToPath(import.meta.url)));
const { launchChrome } = await import(pathToFileURL(path.join(SKILL, "scripts", "_cdp.mjs")).href);
const arq = process.argv[2];
if (!arq) { console.error("uso: node autoteste.mjs <film/index.html>"); process.exit(2); }
const br = await launchChrome({ args: ["--allow-file-access-from-files"] });
try {
  const p = await br.newPage({ width: 1920, height: 1080 });
  const erros = [];
  p.on("Runtime.exceptionThrown", (e) => erros.push((e.exceptionDetails?.exception?.description || e.exceptionDetails?.text || "").split("\n")[0]));
  p.on("Runtime.consoleAPICalled", (e) => { const t = (e.args || []).map((a) => a.value ?? a.description ?? "").join(" "); if (/selftest|seekcheck|mismatch/i.test(t)) console.log("console:", t.slice(0, 300)); });
  await p.goto(pathToFileURL(path.resolve(arq)).href + "?selftest");
  let r = null;
  for (let i = 0; i < 600 && !r; i++) {
    r = await p.eval("window.__seekcheck ? JSON.stringify(window.__seekcheck) : null");
    if (!r) await new Promise((ok) => setTimeout(ok, 1000));
  }
  if (!r) { console.log("o selfTest não terminou em 10 minutos"); process.exitCode = 1; }
  else {
    const c = JSON.parse(r);
    console.log(JSON.stringify({ ok: c.ok, samples: c.samples, elements: c.elements, mismatches: (c.mismatches || []).slice(0, 8) }, null, 1));
    if (!c.ok) process.exitCode = 1;
  }
  if (erros.length) { console.log("erros na página:", erros.slice(0, 5)); process.exitCode = 1; }
} finally { await br.close(); }
