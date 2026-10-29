// LOTTIE.cor(dado, "#RRGGBB"): uma cópia do Lottie com a cor principal trocada. O original não muda.
// A cor principal é a 1ª cor de traço ou de preenchimento que não é branca. Ela é trocada em todo lugar
// onde aparece: traço e preenchimento, parados ou com chave de animação. O branco e a opacidade ficam.
// No filme, depois do ícone:
//   <script src="library/lottie/_cor.js"></script><script src="library/lottie/confirmado.js"></script>
//   M.lottie('#icone', { data: LOTTIE.cor(LOTTIE.confirmado, '#2F6FEB'), at: 40 });
(function (raiz) {
  raiz.LOTTIE = raiz.LOTTIE || {};

  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) throw new Error('LOTTIE.cor: cor inválida "' + hex + '" (use #RRGGBB)');
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  const branca = (c) => c[0] > 0.996 && c[1] > 0.996 && c[2] > 0.996;
  const igual = (a, b) => Math.abs(a[0] - b[0]) < 0.003 && Math.abs(a[1] - b[1]) < 0.003 && Math.abs(a[2] - b[2]) < 0.003;

  // Chama fn com cada cor (o array [r, g, b, a?] de 0 a 1) de traço e de preenchimento, em camadas, grupos e assets.
  function cores(no, fn) {
    if (Array.isArray(no)) { for (const x of no) cores(x, fn); return; }
    if (!no || typeof no !== 'object') return;
    if ((no.ty === 'fl' || no.ty === 'st') && no.c && no.c.k != null) {
      if (no.c.a) { for (const ch of no.c.k) { if (ch.s) fn(ch.s); if (ch.e) fn(ch.e); } }
      else fn(no.c.k);
    }
    for (const k in no) if (k !== 'c' && no[k] && typeof no[k] === 'object') cores(no[k], fn);
  }

  raiz.LOTTIE.cor = function (dado, hex) {
    if (dado == null) throw new Error('LOTTIE.cor: falta o Lottie (o .js do ícone foi carregado antes?)');
    const nova = rgb(hex);
    const copia = JSON.parse(typeof dado === 'string' ? dado : JSON.stringify(dado));
    let principal = null;
    cores(copia, (c) => { if (!principal && !branca(c)) principal = c.slice(0, 3); });
    if (!principal) throw new Error('LOTTIE.cor: o Lottie não tem cor de traço ou de preenchimento além do branco');
    cores(copia, (c) => { if (igual(c, principal)) { c[0] = nova[0]; c[1] = nova[1]; c[2] = nova[2]; } });
    return copia;
  };
})(typeof window !== 'undefined' ? window : globalThis);
