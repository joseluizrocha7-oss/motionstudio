// _pagina.mjs - código que roda DENTRO da página do filme, para o render-trechos.mjs. Não é CLI.
//
// __mdPrepare, __mdInfo e __mdFrame são os mesmos do render.mjs (cópia fiel; o render antigo
// continua com a dele). Novo (20/10/2026):
//   __mdEstados(lista de tempos)  hash do estado visual em cada tempo, sem pintar
//
// Estado visual = o que pinta e muda com o tempo: atributos e texto de cada elemento VISÍVEL
// (style, class, src...), valor de campo, CSS dentro de <style>, animações CSS em andamento,
// vídeo e canvas (estes dois entram com o próprio tempo: nunca se repetem).
// Fica de fora o que não pinta: elemento com visibility:hidden ou display:none no style (o
// autoAlpha e o show/hide do Motion), <script>, <title> e <meta>. Assim, uma cena tem o mesmo
// estado num filme que ganhou um passo novo (os elementos do passo novo estão escondidos nela).
// Também fica de fora a rolagem de elementos por scrollTop (o Motion não usa).
export const PAGE_LIB = `(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const vids = () => [...document.querySelectorAll('video')];
  window.__mdPrepare = async () => {
    const out = [];
    try { await document.fonts.ready; } catch (e) {}
    await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => out.push('image failed: ' + (i.currentSrc || i.src))) : null)));
    await Promise.all(vids().map((v) => v.readyState >= 2 ? 0 : new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', () => { out.push('video failed: ' + v.currentSrc); r(); }, { once: true }); setTimeout(r, 8000); })));
    if (window.__ready && typeof window.__ready.then === 'function') await window.__ready;
    else if (typeof window.__ready === 'function') await window.__ready();
    for (const m of document.querySelectorAll('video,audio')) { m.muted = true; m.volume = 0; try { m.pause(); } catch (e) {} }
    return out;
  };
  window.__mdInfo = () => {
    const main = document.querySelector('[data-composition-id="main"]');
    const tls = window.__timelines && typeof window.__timelines === 'object' ? window.__timelines : null;
    let d = null, how = null;
    if (typeof window.__duration === 'number') { d = window.__duration; how = 'window.__duration'; }
    else if (main && parseFloat(main.getAttribute('data-duration')) > 0) { d = parseFloat(main.getAttribute('data-duration')); how = 'data-duration'; }
    else if (tls && tls.main && typeof tls.main.duration === 'function') { d = tls.main.duration(); how = '__timelines.main.duration()'; }
    else if (window.gsap && gsap.globalTimeline) { d = gsap.globalTimeline.duration(); how = 'gsap.globalTimeline.duration()'; }
    const strat = typeof window.__seek === 'function' ? '__seek' : (tls && Object.keys(tls).length ? '__timelines' : (window.gsap && gsap.globalTimeline ? 'gsap.globalTimeline' : 'none'));
    return { duration: d, durationFrom: how, strategy: strat, timelines: tls ? Object.keys(tls) : [],
      width: main ? parseInt(main.getAttribute('data-width')) || null : null, height: main ? parseInt(main.getAttribute('data-height')) || null : null,
      videos: vids().length };
  };
  window.__mdFrame = async (t) => {
    if (typeof window.__seek === 'function') { await window.__seek(t); }
    else if (window.__timelines && typeof window.__timelines === 'object' && Object.keys(window.__timelines).length) {
      const names = Object.keys(window.__timelines).sort((a, b) => (a === 'main') - (b === 'main'));
      for (const n of names) { const tl = window.__timelines[n]; if (tl && typeof tl.seek === 'function') { if (tl.pause) tl.pause(); tl.seek(t, false); } }
    } else if (window.gsap && gsap.globalTimeline) { gsap.globalTimeline.pause(); gsap.globalTimeline.seek(t, false); }
    for (const a of document.getAnimations ? document.getAnimations() : []) {
      if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) continue;
      try { a.pause(); a.currentTime = t * 1000; } catch (e) {}
    }
    for (const m of document.querySelectorAll('audio')) { m.muted = true; try { m.pause(); } catch (e) {} }
    await Promise.all(vids().map(async (v) => {
      v.muted = true; try { v.pause(); } catch (e) {}
      const dur = isFinite(v.duration) ? v.duration : 1e9;
      const target = Math.min(Math.max(0, t - (parseFloat(v.dataset.start) || 0) + (parseFloat(v.dataset.mediaStart) || 0)), Math.max(0, dur - 0.001));
      if (Math.abs(v.currentTime - target) < 0.0005 && !v.seeking) return;
      await new Promise((res) => { const to = setTimeout(res, 3000); v.addEventListener('seeked', () => { clearTimeout(to); res(); }, { once: true }); v.currentTime = target; });
      if (v.requestVideoFrameCallback) await new Promise((r) => { const to = setTimeout(r, 150); v.requestVideoFrameCallback(() => { clearTimeout(to); r(); }); });
    }));
    await raf2();
    return true;
  };

  // A busca do __mdFrame, sem esperar vídeo nem pintar (só para ler o estado).
  const busca = async (t) => {
    if (typeof window.__seek === 'function') { await window.__seek(t); }
    else if (window.__timelines && typeof window.__timelines === 'object' && Object.keys(window.__timelines).length) {
      const names = Object.keys(window.__timelines).sort((a, b) => (a === 'main') - (b === 'main'));
      for (const n of names) { const tl = window.__timelines[n]; if (tl && typeof tl.seek === 'function') { if (tl.pause) tl.pause(); tl.seek(t, false); } }
    } else if (window.gsap && gsap.globalTimeline) { gsap.globalTimeline.pause(); gsap.globalTimeline.seek(t, false); }
    for (const a of document.getAnimations ? document.getAnimations() : []) {
      if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) continue;
      try { a.pause(); a.currentTime = t * 1000; } catch (e) {}
    }
  };

  // ---- estado visual: uma linha por elemento visível, na ordem do documento ----
  const PULA = new Set(['SCRIPT', 'TITLE', 'META', 'NOSCRIPT', 'TEMPLATE', 'BASE']);
  const TEMPO = new Set(['CANVAS', 'VIDEO', 'IFRAME', 'OBJECT', 'EMBED', 'animate', 'animateTransform', 'animateMotion', 'set']);
  const estado = (t) => {
    const out = [];
    const de = document.documentElement;
    let raiz = 'HTML';
    for (const a of de.attributes) raiz += ' ' + a.name + '=' + a.value;
    out.push(raiz);
    const walk = (el, oculto) => {
      const tg = el.tagName;
      if (PULA.has(tg)) return;
      const st = el.style;
      if (st && st.display === 'none') return;
      const v = st ? st.visibility : '';
      const esc = v === 'hidden' || v === 'collapse' ? true : v === 'visible' ? false : oculto;
      if (!esc) {
        let s = tg;
        for (const a of el.attributes) s += ' ' + a.name + '=' + a.value;
        if (tg === 'IMG') s += ' @' + el.currentSrc + (el.complete ? '' : ' (carregando)');
        else if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') s += ' valor=' + el.value + (el.checked ? ' marcado' : '');
        else if (TEMPO.has(tg)) s += ' tempo=' + t;
        let txt = '';
        for (const n of el.childNodes) if (n.nodeType === 3) txt += n.nodeValue + '\\u0001';
        if (txt) s += ' texto=' + txt;
        out.push(s);
      }
      for (const c of el.children) walk(c, esc);
    };
    for (const c of de.children) walk(c, false);
    if (document.scrollingElement && (document.scrollingElement.scrollTop || document.scrollingElement.scrollLeft)) out.push('ROLAGEM ' + document.scrollingElement.scrollTop + ',' + document.scrollingElement.scrollLeft);
    for (const a of document.getAnimations ? document.getAnimations() : []) out.push('ANIM ' + a.currentTime + ' ' + a.playState + ' ' + (a.effect && a.effect.target ? (a.effect.target.id || a.effect.target.tagName) : ''));
    return out;
  };
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const enc = new TextEncoder();
  window.__mdEstados = async (ts) => {
    const r = [];
    for (const t of ts) { await busca(t); r.push(hex(await crypto.subtle.digest('SHA-1', enc.encode(estado(t).join('\\n'))))); }
    return r;
  };
  return true;
})()`;

// Página de teste para a impressão digital do Chrome: degradê, sombra, texto, desfoque e
// deslocamento fracionário. Se o Chrome trocar de caminho de desenho (GPU para software, outro
// driver, outra versão), a foto muda e o cache não mistura trechos dos dois caminhos.
export const PAGINA_TESTE = (W, H) => 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#f3f0e8">
<div style="position:absolute;left:-40px;top:-40px;width:${W + 80}px;height:${H + 80}px;background-image:radial-gradient(rgba(46,42,36,.13) 1.6px,transparent 1.9px);background-size:34px 34px;transform:translate3d(-3.37px,0,0)"></div>
<div style="position:absolute;left:100.3px;top:200.7px;width:400px;height:300px;border-radius:40px;background:linear-gradient(135deg,#e41c2c,#1fa45a);box-shadow:0 40px 80px -30px rgba(40,30,10,.45);transform:scale(1.37) rotate(3deg);opacity:.83"></div>
<div style="position:absolute;left:80px;top:700px;font:600 64px system-ui,sans-serif;color:#24221f;transform:translateX(.37px)">Ação rápida 123</div>
<div style="position:absolute;left:300px;top:900px;width:200px;height:200px;filter:blur(6px);background:#24221f;border-radius:50%"></div>
<div style="position:absolute;left:600px;top:400px;width:300px;height:300px;border-radius:50%;background:radial-gradient(ellipse 60% 70% at 50% 52%,rgba(255,255,255,.85),rgba(255,255,255,0) 70%),#121316;transform:translate3d(.43px,.21px,0) scale(1.013)"></div>
</body></html>`);
