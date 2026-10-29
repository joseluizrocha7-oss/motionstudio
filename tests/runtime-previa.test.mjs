// M.render e o modo ?previa do runtime, no Chrome (scripts/_cdp.mjs), sobre o examples/relogio.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchChrome } from "../scripts/_cdp.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXEMPLO = pathToFileURL(join(RAIZ, "examples", "relogio", "index.html")).href;
const TEMP = mkdtempSync(join(tmpdir(), "runtime-previa-"));

let br;
before(async () => { br = await launchChrome({ args: ["--allow-file-access-from-files"] }); });
after(async () => { await br?.close(); rmSync(TEMP, { recursive: true, force: true }); });

// Abre o exemplo (ou outro endereço), com o sufixo dado, e espera o window.__ready.
// Não usa o goto() do _cdp.mjs: o timer de 30 s dele seguraria o processo do teste depois do fim.
async function abrir(sufixo = "", { largura = 1920, altura = 1080, url = EXEMPLO } = {}) {
  const p = await br.newPage({ width: largura, height: altura });
  const erros = [];
  p.on("Runtime.exceptionThrown", (e) => erros.push((e.exceptionDetails?.exception?.description || e.exceptionDetails?.text || "").split("\n")[0]));
  const carregou = new Promise((ok) => { const off = p.on("Page.loadEventFired", () => { off(); ok(); }); });
  await p.send("Page.navigate", { url: url + sufixo });
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

// ---------- ?previa (item 14) ----------

// Espera a prévia montar (ela monta depois do window.__ready); false se não montar em 3 s.
const esperarPrevia = (p) => p.eval("new Promise(r => { let n = 0; const f = () => document.getElementById('md-previa') ? r(true) : ++n > 150 ? r(false) : setTimeout(f, 20); f(); })");
// Espera ms milissegundos dentro da página (os quadros da prévia andam por requestAnimationFrame).
const esperar = (p, ms) => p.eval(`new Promise(r => setTimeout(r, ${ms}))`);
// Lê o que a prévia e o M.render do exemplo mostram agora.
const LER = `(() => { const a = document.getElementById('md-previa-audio'), l = document.getElementById('leitura');
  return { quadro: +l.dataset.quadro, leitura: l.textContent, hora: document.getElementById('md-previa-hora').textContent,
    botao: document.getElementById('md-previa-tocar').textContent, som: document.getElementById('md-previa-som').textContent,
    audio: a ? { t: a.currentTime, parado: a.paused } : null }; })()`;
// Lê a prévia (LER) a cada 20 ms até a condição valer sobre a leitura "s", no máximo 5 s. Devolve a leitura que valeu
// (a última, se o prazo acabou: aí a asserção do teste falha com ela). Prova movimento sem depender da velocidade da máquina.
const ate = (p, cond, ms = 5000) => p.eval(`new Promise(r => {
  const ler = () => ${LER}, ok = s => ${cond}, t0 = performance.now();
  const f = () => { const s = ler(); if (ok(s) || performance.now() - t0 > ${ms}) r(s); else setTimeout(f, 20); };
  f();
})`);

test("?previa: o quadro cabe na janela e os controles ficam embaixo", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir("?previa", { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  const r = await p.eval(`(() => {
    const ret = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    const faixa = document.getElementById('md-previa-tempo'), a = document.getElementById('md-previa-audio');
    return { tocar: document.getElementById('md-previa-tocar').textContent, recomecar: document.getElementById('md-previa-recomecar').textContent,
      faixa: [faixa.type, +faixa.min, +faixa.max], hora: document.getElementById('md-previa-hora').textContent,
      audio: a && a.tagName === 'AUDIO' ? a.src : null, palco: ret('main'), barra: ret('md-previa') };
  })()`);
  await p.close();
  assert.deepEqual([r.tocar, r.recomecar], ["Reproduzir", "Recomeçar"]);
  assert.deepEqual(r.faixa, ["range", 0, 4]);
  assert.equal(r.hora, "0,00 / 4,00 s · quadro 0");
  assert.ok(r.audio && r.audio.endsWith("/examples/relogio/audio/mix.wav"), `áudio: ${r.audio}`);
  const { palco, barra } = r;
  assert.ok(palco.w < 1280 && Math.abs(palco.w / palco.h - 16 / 9) < 0.01, `o palco reduzido mantém 16:9: ${palco.w}x${palco.h}`);
  assert.ok(palco.x >= 0 && palco.x + palco.w <= 1280 && palco.y >= 0, `o palco cabe na largura: ${JSON.stringify(palco)}`);
  assert.ok(Math.abs(palco.x - (1280 - palco.x - palco.w)) <= 1, `o palco fica no centro: ${palco.x}`);
  assert.ok(palco.y + palco.h <= barra.y, `o palco fica acima da barra: ${palco.y + palco.h} > ${barra.y}`);
  assert.ok(barra.y + barra.h <= 720 && barra.w === 1280, `a barra fica embaixo, na largura toda: ${JSON.stringify(barra)}`);
  assert.deepEqual(erros, []);
});

test("?previa: a busca por tempo leva o filme e o áudio ao tempo pedido", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir("?previa", { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  await p.eval("(() => { const f = document.getElementById('md-previa-tempo'); f.value = '2.5'; f.dispatchEvent(new Event('input', { bubbles: true })); })()");
  const a = await p.eval(LER);
  const tecla = (code, shift = false) => p.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: '${code}', shiftKey: ${shift}, bubbles: true }))`);
  await tecla("ArrowRight");
  const b = await p.eval(LER);
  await tecla("ArrowLeft"); await tecla("ArrowLeft");
  const c = await p.eval(LER);
  await tecla("ArrowLeft", true);
  const d = await p.eval(LER);
  await p.close();
  assert.deepEqual([a.quadro, a.leitura, a.hora], [75, "2,50 s", "2,50 / 4,00 s · quadro 75"], "o M.render desenhou o tempo pedido");
  assert.ok(Math.abs(a.audio.t - 2.5) < 0.01, `o áudio foi junto: ${a.audio.t}`);
  assert.equal(b.quadro, 76, "seta para a direita: um quadro adiante");
  assert.equal(c.quadro, 74, "seta para a esquerda: um quadro atrás");
  assert.equal(d.quadro, 44, "Shift + seta: um segundo atrás");
  assert.ok(Math.abs(d.audio.t - 44 / 30) < 0.01, `o áudio segue a seta: ${d.audio.t}`);
  assert.deepEqual(erros, []);
});

test("?previa: reproduzir anda o filme no relógio do áudio; pausar para os dois", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir("?previa", { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  assert.equal(await p.eval("new Promise(r => { const a = document.getElementById('md-previa-audio'); a.readyState >= 1 ? r(true) : (a.onloadedmetadata = () => r(true), a.onerror = () => r(false)); })"), true, "o audio/mix.wav do exemplo não carregou");
  await p.eval("document.getElementById('md-previa-tocar').click()");
  // Espera a condição, não um tempo fixo: o teste prova que o filme anda junto com o áudio, qualquer que seja a velocidade da máquina.
  const a = await ate(p, "s.quadro >= 9 && Math.abs(s.quadro / 30 - s.audio.t) < 0.15");
  // O áudio é o relógio: se ele pula, o filme vai atrás (o relógio da página não pularia: ficaria 1,5 s para trás).
  await p.eval("document.getElementById('md-previa-audio').currentTime = 2");
  const b = await ate(p, "s.audio.t >= 2 && Math.abs(s.quadro / 30 - s.audio.t) < 0.15");
  await p.eval("document.getElementById('md-previa-tocar').click()");
  const c = await p.eval(LER);
  await esperar(p, 300);
  const d = await p.eval(LER);
  await p.close();
  assert.equal(a.botao, "Pausar");
  assert.equal(a.audio.parado, false, "o áudio está tocando");
  assert.ok(a.quadro >= 9, `o filme andou: quadro ${a.quadro}`);
  assert.ok(Math.abs(a.quadro / 30 - a.audio.t) < 0.15, `filme e áudio juntos: ${a.quadro / 30} e ${a.audio.t}`);
  assert.ok(b.quadro >= 60 && Math.abs(b.quadro / 30 - b.audio.t) < 0.15, `o filme seguiu o pulo do áudio para 2 s: quadro ${b.quadro}, áudio em ${b.audio.t}`);
  assert.equal(c.botao, "Reproduzir");
  assert.equal(c.audio.parado, true, "pausar para o áudio");
  assert.equal(d.quadro, c.quadro, "pausado, o filme não anda");
  assert.deepEqual(erros, []);
});

test("?previa com áudio que não existe: avisa e toca no relógio da página", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir("?previa&audio=nao-existe.wav", { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  assert.equal(await p.eval("new Promise(r => { let n = 0; const f = () => /sem áudio/.test(document.getElementById('md-previa-som').textContent) ? r(true) : ++n > 150 ? r(false) : setTimeout(f, 20); f(); })"), true, "não avisou da falta do áudio");
  const a = await p.eval(LER);
  await p.eval("document.getElementById('md-previa-tocar').click()");
  const b = await ate(p, "s.quadro >= 6");
  await p.eval("document.getElementById('md-previa-tocar').click()");
  await p.close();
  assert.match(a.som, /nao-existe\.wav/);
  assert.ok(b.quadro >= 6, `sem áudio, o filme anda pelo relógio da página: quadro ${b.quadro}`);
  assert.deepEqual(erros, []);
});

// WAV mudo (PCM 16 bits, mono, 8 kHz) de s segundos, gravado na pasta temporária; devolve o endereço file://.
function wavMudo(nome, s) {
  const n = Math.round(8000 * s) * 2, b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n, 40);
  const arq = join(TEMP, nome + ".wav");
  writeFileSync(arq, b);
  return pathToFileURL(arq).href;
}

test("?previa: áudio mais curto que o filme passa o relógio para a página; no fim, para; tocar de novo recomeça", { timeout: 30000 }, async () => {
  const curto = wavMudo("curto", 0.4);
  const { p, erros } = await abrir("?previa&audio=" + encodeURIComponent(curto), { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  assert.equal(await p.eval("new Promise(r => { const a = document.getElementById('md-previa-audio'); a.readyState >= 1 ? r(true) : (a.onloadedmetadata = () => r(true), a.onerror = () => r(false)); })"), true, "o WAV curto não carregou");
  await p.eval("document.getElementById('md-previa-tocar').click()");
  const ac = await ate(p, "s.quadro >= 24");
  const fim = await p.eval("document.getElementById('md-previa-audio').ended");
  // perto do fim: tocar até o último quadro e parar
  await p.eval("document.getElementById('md-previa-tocar').click()");
  await p.eval("(() => { const f = document.getElementById('md-previa-tempo'); f.value = '3.8'; f.dispatchEvent(new Event('input')); })()");
  await p.eval("document.getElementById('md-previa-tocar').click()");
  const b = await ate(p, "s.botao === 'Reproduzir' && s.quadro === 120");
  const c = await p.eval("(() => { document.getElementById('md-previa-tocar').click(); return " + LER + "; })()");      // tocar de novo, parado no fim; lido no mesmo instante
  await p.eval("document.getElementById('md-previa-tocar').click()");
  await p.close();
  assert.equal(fim, true, "o áudio de 0,4 s acabou");
  assert.ok(ac.quadro >= 24, `depois do fim do áudio, o filme seguiu pelo relógio da página: quadro ${ac.quadro}`);
  assert.deepEqual([b.botao, b.quadro], ["Reproduzir", 120], "no fim do filme, para no último instante");
  assert.ok(c.quadro <= 3 && c.botao === "Pausar", `tocar no fim recomeça do zero: quadro ${c.quadro}`);
  assert.deepEqual(erros, []);
});

// Gestos na página (a prévia escuta o window). O jump é síncrono: gesto e leitura no mesmo eval mostram o que ele deixou, sem corrida com o relógio.
const TOCAR = "document.getElementById('md-previa-tocar').click()";
const TECLA = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: '${code}', bubbles: true }))`;
const FAIXA = (v) => `(() => { const f = document.getElementById('md-previa-tempo'); f.value = '${v}'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const gestoELe = (p, gesto) => p.eval(`(() => { ${gesto}; return ${LER}; })()`);
const audioPronto = (p) => p.eval("new Promise(r => { const a = document.getElementById('md-previa-audio'); a.readyState >= 1 ? r(true) : (a.onloadedmetadata = () => r(true), a.onerror = () => r(false)); })");

test("?previa: End, a faixa no máximo e a seta no último quadro, tocando, param no fim em vez de recomeçar o filme", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir("?previa", { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  assert.equal(await audioPronto(p), true, "o audio/mix.wav do exemplo não carregou");
  const resultados = [];
  for (const como of ["End", "faixa no máximo", "seta no último quadro"]) {
    let gesto;
    if (como === "seta no último quadro") {                 // parado no penúltimo quadro, toca e aperta a seta no mesmo instante
      await p.eval(FAIXA(3.9667));
      gesto = TOCAR + "; " + TECLA("ArrowRight");
    } else {
      await p.eval(TOCAR);                                  // tocando no meio do filme
      await ate(p, "s.quadro >= 3 && s.botao === 'Pausar'");
      gesto = como === "End" ? TECLA("End") : FAIXA(4);
    }
    const a = await gestoELe(p, gesto);                     // no mesmo instante do gesto
    await esperar(p, 300);                                  // se o filme tivesse recomeçado, já estaria andando
    const b = await p.eval(LER);
    resultados.push([como, a.botao, a.quadro, b.botao, b.quadro]);
    await p.eval(TECLA("Home"));                            // volta ao começo, parado, para a próxima volta
  }
  await p.close();
  assert.deepEqual(resultados, [
    ["End", "Reproduzir", 120, "Reproduzir", 120],
    ["faixa no máximo", "Reproduzir", 120, "Reproduzir", 120],
    ["seta no último quadro", "Reproduzir", 120, "Reproduzir", 120],
  ]);
  assert.deepEqual(erros, []);
});

test("?previa: áudio que acaba com a aba escondida entrega o filme ao relógio da página no fim do áudio, sem repetir o final mudo", { timeout: 30000 }, async () => {
  const curto = wavMudo("curto-escondido", 0.4);
  const { p, erros } = await abrir("?previa&audio=" + encodeURIComponent(curto), { largura: 1280, altura: 720 });
  assert.equal(await esperarPrevia(p), true, "a prévia não montou");
  assert.equal(await audioPronto(p), true, "o WAV curto não carregou");
  await p.eval(TOCAR);
  await ate(p, "s.quadro >= 2 && s.audio.t < 0.35");        // tocando, ainda dentro do áudio
  // Aba escondida: o Chrome para o requestAnimationFrame. A página de teste guarda os pedidos em vez de rodá-los.
  await p.eval("(() => { window.__raf = window.requestAnimationFrame; window.__fila = []; window.requestAnimationFrame = f => { window.__fila.push(f); return 0; }; })()");
  assert.equal(await p.eval("new Promise(r => { const a = document.getElementById('md-previa-audio'), t0 = performance.now(); const f = () => a.ended ? r(true) : performance.now() - t0 > 5000 ? r(false) : setTimeout(f, 20); f(); })"), true, "o áudio de 0,4 s não acabou");
  // A aba volta: o primeiro quadro depois da volta tem que estar no fim do áudio (0,4 s = quadro 12), não no último quadro mostrado antes de esconder.
  const quadro = await p.eval(`new Promise(r => {
    const raf = window.__raf, fila = window.__fila.splice(0); window.requestAnimationFrame = raf;
    fila.forEach(f => raf(f));
    raf(() => r(+document.getElementById('leitura').dataset.quadro));
  })`);
  await p.eval(TOCAR);                                        // pausa
  await p.close();
  assert.ok(quadro >= 11, `depois da volta o filme está no quadro ${quadro}; o áudio acabou em 0,4 s (quadro 12)`);
  assert.deepEqual(erros, []);
});

// Filme mínimo de 2 s numa pasta temporária, com o runtime pelo caminho absoluto e a opção preview dada.
function filmeMinimo(nome, preview) {
  const rt = pathToFileURL(join(RAIZ, "runtime")).href, arq = join(TEMP, nome + ".html");
  writeFileSync(arq, `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="main" style="position:absolute;left:0;top:0;width:640px;height:360px;background:#EDEBE6"></div>
<script src="${rt}/vendor/gsap.min.js"></script><script src="${rt}/motion.js"></script>
<script>const M = Motion.film({ fps: 30, duration: 2, width: 640, height: 360, preview: ${JSON.stringify(preview)} }); window.__ready = Motion.loaded();</script>
</body></html>`);
  return pathToFileURL(arq).href;
}

test("?previa: preview.audio no Motion.film escolhe o áudio, false tira o áudio, e ?audio= vale mais", { timeout: 30000 }, async () => {
  const outro = filmeMinimo("outro", { audio: "som/outro.wav" }), mudo = filmeMinimo("mudo", { audio: false });
  const ler = async (url, sufixo) => {
    const { p, erros } = await abrir(sufixo, { url, largura: 800, altura: 600 });
    assert.equal(await esperarPrevia(p), true, "a prévia não montou");
    const r = await p.eval("(() => { const a = document.getElementById('md-previa-audio'); return { src: a ? a.src : null, audios: document.querySelectorAll('audio').length, som: document.getElementById('md-previa-som').textContent }; })()");
    await p.close();
    assert.deepEqual(erros, []);
    return r;
  };
  const a = await ler(outro, "?previa"), b = await ler(mudo, "?previa"), c = await ler(outro, "?previa&audio=trilha.wav");
  assert.ok(a.src.endsWith("/som/outro.wav"), a.src);
  assert.deepEqual([b.src, b.audios, b.som], [null, 0, "sem áudio"]);
  assert.ok(c.src.endsWith("/trilha.wav"), c.src);
});

test("sem ?previa a página não muda", { timeout: 30000 }, async () => {
  const { p, erros } = await abrir();
  await esperar(p, 300);                                   // a prévia montaria logo depois do __ready
  const r = await p.eval(`(() => { const m = document.getElementById('main'), b = m.getBoundingClientRect();
    return { previa: document.querySelectorAll('[id^="md-previa"]').length, audios: document.querySelectorAll('audio').length,
      pai: m.parentElement === document.body, palco: [b.left, b.top, b.width, b.height], corpo: getComputedStyle(document.body).width }; })()`);
  await p.close();
  assert.deepEqual(r, { previa: 0, audios: 0, pai: true, palco: [0, 0, 1920, 1080], corpo: "1920px" });
  assert.deepEqual(erros, []);
});
