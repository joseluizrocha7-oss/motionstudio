#!/usr/bin/env node
// ACRÉSCIMO LOCAL (13/10/2026), não faz parte da skill original.
//
// Mede quanto a câmera chega perto ao longo do filme e quanto do objeto filmado
// cabe no quadro. Existe porque o usuário reprovou dois filmes por isso e os
// dois tinham passado em todos os portões: "o zoom ficou muito forte" (Reels
// 9:16, macro de 4x e de 1,6x) e "parece que ficou o zoom do modo vertical
// dentro do modo wide" (16:9, a câmera morando dentro da tela do app).
// A versão que ele aceitou tem plano-base de 0,90 e chega no máximo a 1,20 (1,34x).
//
// Uso:
//   node camera.mjs film/index-vertical.html [--el ".fone"] [--max 1.5] [--corte 0.5]
//                   [--fps 30] [--passo 2] [--width W --height H] [--json]
//
//   --el       o OBJETO que a câmera filma (o aparelho, a tela, a peça), não o palco.
//              Sem a opção, procura [data-camera] e depois #cam.
//   --max      até quantas vezes o plano mais fechado pode passar do plano-base (padrão 1,5)
//   --corte    fração mínima do objeto dentro do quadro, na mediana do filme (padrão 0,5)
//   --passo    mede um quadro a cada N (padrão 2)
//
// O tamanho do objeto sai da cadeia de transformações dele até a raiz (o que a
// câmera, a inclinação e o palco fazem juntos), quadro a quadro, com o filme
// levado a cada instante pelo mesmo contrato do render.mjs (__seek, __timelines, gsap).
//
// Portões (saída 1 se algum der ALERTA):
//   Z1 câmera contida     plano mais fechado / plano-base <= --max
//   Z2 o objeto no quadro mediana da fração do objeto dentro do quadro >= --corte
// ALERTA se resolve reduzindo a aproximação. Plano fechado acima do limite só
// quando o usuário pediu para aquele filme: aí roda com --max e o NOTE.md diz.
// Saída 2: não achou o objeto ou o filme não tem duração.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChrome, parseArgs, die, helpFrom } from './_cdp.mjs';

const { pos, opt } = parseArgs(process.argv.slice(2), {
  help: 'bool', el: 's', max: 's', corte: 's', fps: 's', passo: 's', width: 's', height: 's', json: 'bool',
});
if (opt.help || !pos[0]) { console.log(helpFrom(import.meta.url)); process.exit(opt.help ? 0 : 2); }
const src = pos[0];
if (!/^(https?|file):/i.test(src) && !fs.existsSync(src)) die(`não achei o filme: ${src}`, 2);
const url = /^(https?|file):/i.test(src) ? src : pathToFileURL(path.resolve(src)).href;
const n = (v, d) => (v === undefined ? d : Number(v));
const fps = n(opt.fps, 30), passo = Math.max(1, Math.round(n(opt.passo, 2))), limite = n(opt.max, 1.5), corte = n(opt.corte, 0.5);
if (![fps, limite, corte].every(Number.isFinite)) die('--fps, --max e --corte são números', 2);

// o quadro vem do <meta name="viewport"> do próprio filme (1080x1920 no vertical), salvo --width/--height
let W = n(opt.width, 0), H = n(opt.height, 0);
if ((!W || !H) && fs.existsSync(src)) {
  const m = /<meta[^>]+name=["']viewport["'][^>]*content=["'][^"']*width=(\d+)[^"']*height=(\d+)/i.exec(fs.readFileSync(src, 'utf8'));
  if (m) { W = W || Number(m[1]); H = H || Number(m[2]); }
}
W = W || 1920; H = H || 1080;

const NA_PAGINA = `(() => {
  window.__camSeek = async (t) => {
    const tls = window.__timelines && typeof window.__timelines === 'object' ? window.__timelines : null;
    if (typeof window.__seek === 'function') await window.__seek(t);
    else if (tls && Object.keys(tls).length) {
      for (const k of Object.keys(tls).sort((a, b) => (a === 'main') - (b === 'main'))) { const tl = tls[k]; if (tl && tl.seek) { if (tl.pause) tl.pause(); tl.seek(t, false); } }
    } else if (window.gsap && gsap.globalTimeline) { gsap.globalTimeline.pause(); gsap.globalTimeline.seek(t, false); }
    await new Promise((r) => requestAnimationFrame(r));
  };
  window.__camDur = () => {
    const main = document.querySelector('[data-composition-id="main"]'), tls = window.__timelines;
    if (typeof window.__duration === 'number') return window.__duration;
    if (main && parseFloat(main.getAttribute('data-duration')) > 0) return parseFloat(main.getAttribute('data-duration'));
    if (tls && tls.main && tls.main.duration) return tls.main.duration();
    return window.gsap && gsap.globalTimeline ? gsap.globalTimeline.duration() : 0;
  };
  window.__camMede = (sel, W, H) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    let m = new DOMMatrix(), visivel = true;
    for (let no = el; no && no.nodeType === 1; no = no.parentElement) {
      const cs = getComputedStyle(no);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) visivel = false;
      let k = new DOMMatrix(cs.transform === 'none' ? '' : cs.transform);
      if (cs.scale && cs.scale !== 'none') { const p = cs.scale.split(' ').map(Number); k = new DOMMatrix().scale(p[0], p[1] === undefined ? p[0] : p[1]).multiply(k); }
      m = k.multiply(m);
    }
    // a inclinação em 3D encurta um dos eixos; o outro guarda o tamanho de verdade
    const s = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
    const r = el.getBoundingClientRect(), area = r.width * r.height;
    const dentro = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
    return { s, visivel, dentro: area > 0 ? dentro / area : 0, larg: r.width / W, alt: r.height / H };
  };
  return true;
})()`;

const mediana = (v) => { const o = [...v].sort((a, b) => a - b), i = o.length >> 1; return o.length % 2 ? o[i] : (o[i - 1] + o[i]) / 2; };
const br = (x, c = 2) => x.toFixed(c).replace('.', ',');

const browser = await launchChrome({ args: ['--allow-file-access-from-files'] });
let saida = 0;
try {
  const page = await browser.newPage({ width: W, height: H, scale: 1 });
  await page.goto(url, { timeout: 45000 });
  await page.eval(`(async () => { try { await document.fonts.ready; } catch (e) {} if (window.__ready && window.__ready.then) await window.__ready; else if (typeof window.__ready === 'function') await window.__ready(); })()`, { timeout: 120000 });
  await page.eval(NA_PAGINA);
  const sel = opt.el || await page.eval(`document.querySelector('[data-camera]') ? '[data-camera]' : (document.querySelector('#cam') ? '#cam' : '')`);
  if (!sel) die('não achei o objeto da câmera: marque o elemento filmado com data-camera ou passe --el "<seletor>"', 2);
  const dur = await page.eval('window.__camDur()');
  if (!(dur > 0)) die('o filme não informa a duração (window.__duration, data-duration ou __timelines.main)', 2);
  const total = Math.round(dur * fps), serie = [];
  for (let f = 0; f < total; f += passo) {
    await page.eval(`window.__camSeek(${f / fps})`);
    const r = await page.eval(`window.__camMede(${JSON.stringify(sel)}, ${W}, ${H})`);
    if (!r) die(`o seletor ${sel} não achou nada no quadro ${f}`, 2);
    if (r.visivel && r.s > 0) serie.push({ f, t: f / fps, ...r });
  }
  if (!serie.length) die(`${sel} nunca aparece no filme`, 2);

  const base = mediana(serie.map((x) => x.s)), pico = serie.reduce((a, b) => (b.s > a.s ? b : a)), minimo = serie.reduce((a, b) => (b.s < a.s ? b : a));
  const razao = pico.s / base, dentro = mediana(serie.map((x) => x.dentro));
  // aproximações: trechos seguidos em que o plano passa de 8% acima do plano-base
  const aprox = [];
  for (const x of serie) {
    if (x.s > base * 1.08) { const u = aprox[aprox.length - 1]; if (u && x.f - u.ate <= passo) { u.ate = x.f; if (x.s > u.pico) u.pico = x.s; } else aprox.push({ de: x.f, ate: x.f, pico: x.s }); }
  }
  // a aproximação mais rápida: quanto o plano cresce em meio segundo
  const janela = Math.max(1, Math.round((fps / 2) / passo)); let rapida = { k: 1, t: 0 };
  for (let i = 0; i + janela < serie.length; i++) { const k = serie[i + janela].s / serie[i].s; if (k > rapida.k) rapida = { k, t: serie[i].t }; }
  const fechado = serie.filter((x) => x.dentro < corte).length / serie.length;

  const c1 = razao <= limite + 1e-9, c2 = dentro >= corte - 1e-9;
  const res = {
    filme: src, objeto: sel, quadro: [W, H], duracao: dur, amostras: serie.length,
    plano_base: +base.toFixed(4), plano_mais_fechado: +pico.s.toFixed(4), em: +pico.t.toFixed(2), plano_mais_aberto: +minimo.s.toFixed(4),
    razao: +razao.toFixed(3), limite, aproximacoes: aprox.map((a) => ({ de: +(a.de / fps).toFixed(2), ate: +(a.ate / fps).toFixed(2), vezes: +(a.pico / base).toFixed(3) })),
    mais_rapida: { vezes_em_meio_segundo: +rapida.k.toFixed(3), em: +rapida.t.toFixed(2) },
    objeto_no_quadro: +dentro.toFixed(3), corte, parte_do_filme_em_plano_cortado: +fechado.toFixed(3),
    Z1: c1 ? 'PASS' : 'ALERTA', Z2: c2 ? 'PASS' : 'ALERTA',
  };
  if (opt.json) console.log(JSON.stringify(res, null, 1));
  else {
    console.log(`CÂMERA  ${path.basename(src)}  objeto ${sel}  quadro ${W}x${H}  ${br(dur)} s, ${serie.length} amostras`);
    console.log(`  plano-base (mediana do filme)  ${br(base, 3)}`);
    console.log(`  plano mais fechado             ${br(pico.s, 3)} aos ${br(pico.t)} s  (${br(razao)}x o plano-base)`);
    console.log(`  plano mais aberto              ${br(minimo.s, 3)} aos ${br(minimo.t)} s`);
    console.log(`  aproximação mais rápida        ${br(rapida.k)}x em meio segundo, aos ${br(rapida.t)} s`);
    console.log(`  objeto dentro do quadro        ${Math.round(dentro * 100)}% na mediana; ${Math.round(fechado * 100)}% do filme com menos de ${Math.round(corte * 100)}% dele à vista`);
    if (aprox.length) console.log('  aproximações: ' + aprox.map((a) => `${br(a.de / fps, 1)} a ${br(a.ate / fps, 1)} s (${br(a.pico / base)}x)`).join('; '));
    console.log('PORTÕES DE CÂMERA');
    console.log(`  Z1 câmera contida      ${c1 ? 'PASS  ' : 'ALERTA'}  ${br(razao)}x, limite ${br(limite)}x (reprovados: 4x e 1,6x; aceito: 1,34x)`);
    console.log(`  Z2 o objeto no quadro  ${c2 ? 'PASS  ' : 'ALERTA'}  ${Math.round(dentro * 100)}% do objeto à vista na mediana, mínimo ${Math.round(corte * 100)}%`);
    if (!c1) console.log('  -> reduzir a aproximação: plano fechado acima do limite só com pedido do usuário para este filme (--max).');
    if (!c2) console.log('  -> a câmera mora dentro do objeto: abrir o plano-base até o objeto caber, e aproximar só no momento-chave.');
  }
  saida = c1 && c2 ? 0 : 1;
} finally { await browser.close(); }
process.exit(saida);
