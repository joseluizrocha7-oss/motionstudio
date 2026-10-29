// M.render e o modo ?previa do runtime, no Chrome (scripts/_cdp.mjs), sobre o examples/relogio.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchChrome } from "../scripts/_cdp.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXEMPLO = pathToFileURL(join(RAIZ, "examples", "relogio", "index.html")).href;

let br;
before(async () => { br = await launchChrome({ args: ["--allow-file-access-from-files"] }); });
after(async () => { await br?.close(); });

// Abre o exemplo (com o sufixo de endereço dado) e espera o window.__ready.
// Não usa o goto() do _cdp.mjs: o timer de 30 s dele seguraria o processo do teste depois do fim.
async function abrir(sufixo = "", { largura = 1920, altura = 1080 } = {}) {
  const p = await br.newPage({ width: largura, height: altura });
  const erros = [];
  p.on("Runtime.exceptionThrown", (e) => erros.push((e.exceptionDetails?.exception?.description || e.exceptionDetails?.text || "").split("\n")[0]));
  const carregou = new Promise((ok) => { const off = p.on("Page.loadEventFired", () => { off(); ok(); }); });
  await p.send("Page.navigate", { url: EXEMPLO + sufixo });
  await carregou;
  await p.eval("window.__ready");
  return { p, erros };
}

// ---------- M.render (item 16) ----------

test("M.render: o autoteste do exemplo dá 0 divergências", { timeout: 60000 }, async () => {
  // O mesmo que o kit/autoteste.mjs faz: abre com ?selftest e lê o window.__seekcheck.
  const { p, erros } = await abrir("?selftest");
  const c = await p.eval("window.__seekcheck");
  await p.close();
  assert.ok(c, "o selfTest não rodou");
  assert.equal(c.mismatches.length, 0, JSON.stringify(c.mismatches.slice(0, 3)));
  assert.equal(c.ok, true);
  assert.ok(c.elements > 5, `elementos comparados: ${c.elements}`);
  assert.deepEqual(erros, []);
});

test("M.render: o desenhista recebe t contínuo e o quadro a cada seek", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir();
  const r = await p.eval(`(() => {
    const leitura = document.getElementById('leitura'), arco = document.getElementById('arco');
    const ler = t => { window.__seek(t); return { texto: leitura.textContent, quadro: leitura.dataset.quadro, arco: arco.getAttribute('stroke-dashoffset') }; };
    return { a: ler(1.5), b: ler(1.51), c: ler(0.2), d: ler(1.5) };
  })()`);
  await p.close();
  assert.deepEqual([r.a.texto, r.a.quadro], ["1,50 s", "45"]);
  assert.deepEqual([r.b.texto, r.b.quadro], ["1,50 s", "45"], "1,51 s ainda é o quadro 45");
  assert.notEqual(r.b.arco, r.a.arco, "o arco anda com o t contínuo, entre dois quadros");
  assert.deepEqual([r.c.texto, r.c.quadro], ["0,20 s", "6"]);
  assert.deepEqual(r.d, r.a, "voltar ao mesmo t dá o mesmo desenho");
  assert.deepEqual(erros, []);
});

test("M.render recusa o que não é função", { timeout: 30000 }, async () => {
  const { p } = await abrir();
  const msg = await p.eval("(() => { try { Motion.last.render(42); return 'aceitou'; } catch (e) { return e.message; } })()");
  await p.close();
  assert.match(msg, /^Motion\.render: /);
});

test("M.render { heavy: true } pula os quadros que o selfTest não fotografa; o padrão roda sempre", { timeout: 30000 }, async () => {
  const { p } = await abrir();
  const r = await p.eval(`(() => {
    const M = Motion.last, vistos = { leve: [], pesado: [] };
    window.__seek(0);                                 // o aquecimento do primeiro seek (quadro final) fica antes dos desenhistas
    M.render((t, fr) => vistos.leve.push(fr));
    M.render((t, fr) => vistos.pesado.push(fr), { heavy: true });
    window.__mdSnap = false; window.__seek(1);       // o selfTest passa por este quadro sem fotografar
    window.__mdSnap = true; window.__seek(2);        // e fotografa este
    delete window.__mdSnap; window.__seek(3);        // fora do selfTest (render.mjs, prévia)
    return { leve: [...new Set(vistos.leve)], pesado: [...new Set(vistos.pesado)] };
  })()`);
  await p.close();
  assert.deepEqual(r.leve, [30, 60, 90]);
  assert.deepEqual(r.pesado, [60, 90]);
});

test("o selfTest acusa um desenhista que guarda estado entre quadros", { timeout: 30000 }, async () => {
  const { p } = await abrir();
  const r = await p.eval(`(() => {
    const el = document.createElement('div'); document.getElementById('main').appendChild(el);
    let n = 0; Motion.last.render(() => { el.textContent = String(++n); });   // errado de propósito: depende de quantas vezes rodou
    const c = Motion.selfTest(Motion.last, { samples: 6 });
    return { ok: c.ok, divergencias: c.mismatches.length };
  })()`);
  await p.close();
  assert.equal(r.ok, false);
  assert.ok(r.divergencias > 0);
});
