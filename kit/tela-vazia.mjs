// Procura instantes em que a tela do celular fica sem nenhuma foto inteira do app (fica o
// fundo preto do #tela). O G2 do look.py não vê: o chão em volta conta como imagem.
// No tutorial do caso de referência (16/10/2026) a folha de contato mostrou 1,2 s de celular preto
// antes da busca; esta sonda achou mais um, de 0,2 s. Rodar em todo filme de tela de app.
//   node tela-vazia.mjs film/index-vertical.html [--de 2.5] [--ate <s>]
// Usa o Chrome pelo conector da própria skill (scripts/_cdp.mjs): não precisa de Playwright.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acharSkill } from "./_skill.mjs";
const SKILL = acharSkill(path.dirname(fileURLToPath(import.meta.url)));
const { launchChrome } = await import(pathToFileURL(path.join(SKILL, "scripts", "_cdp.mjs")).href);
const arq = process.argv[2];
if (!arq) { console.error("uso: node tela-vazia.mjs <film/index.html> [--de s] [--ate s]"); process.exit(2); }
const opcao = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? Number(process.argv[i + 1]) : p; };
const br = await launchChrome({ args: ["--allow-file-access-from-files"], width: 1080, height: 1920 });
try {
  const p = await br.newPage({ width: 1080, height: 1920 });
  await p.goto(pathToFileURL(path.resolve(arq)).href);
  for (let i = 0; i < 120; i++) { if (await p.eval("typeof window.__seek === 'function' && !!window.__ready")) break; await new Promise((ok) => setTimeout(ok, 500)); }
  await p.eval("window.__ready");
  const dur = await p.eval("DUR");
  // padrão: do celular já na tela até 12 s antes do fim (o fecho costuma não ter celular)
  const de = opcao("de", 2.5), ate = opcao("ate", dur - 12);
  const vazios = await p.eval(`(async () => {
    const tela = document.getElementById("tela"), vazios = [];
    const vis = (el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && cs.display !== "none"; };
    for (let t = ${de}; t <= ${ate}; t += 0.1) {
      await window.__seek(Number(t.toFixed(2)));
      let cheia = false;
      for (const el of tela.children) {
        if (!vis(el)) continue;
        if ((el.matches("img.camada") || el.id === "tour" || el.id === "safari" || el.matches(".recorte")) && el.offsetWidth >= 380 && el.offsetHeight >= 800) { cheia = true; break; }
      }
      if (!cheia) vazios.push(Number(t.toFixed(2)));
    }
    return vazios;
  })()`, { timeout: 600000 });
  const trechos = [];
  for (const t of vazios) { const u = trechos[trechos.length - 1]; if (u && t - u[1] < 0.15) u[1] = t; else trechos.push([t, t]); }
  console.log(trechos.length ? trechos.map(([a, b]) => `tela vazia de ${a.toFixed(1)} a ${b.toFixed(1)} s`).join("\n") : `nenhum instante com a tela vazia entre ${de} e ${ate} s`);
  if (trechos.length) process.exitCode = 1;
} finally { await br.close(); }
