// Lottie mínimo feito à mão: um círculo laranja que cresce de 10% a 100% em 30 quadros (30 fps, quadros 0 a 29).
// Vai num .js que registra a animação num global, e não num .json (escolha do projeto): um <script> comum carrega em
// file:// com ou sem --allow-file-access-from-files; um .json pediria fetch() de file://, que só funciona com essa opção.
// O filme lê LOTTIE.circulo e passa em { data }.
window.LOTTIE = window.LOTTIE || {};
LOTTIE.circulo = {
  v: "5.7.4", nm: "circulo", fr: 30, ip: 0, op: 30, w: 400, h: 400, ddd: 0, assets: [],
  layers: [{
    ddd: 0, ind: 1, ty: 4, nm: "circulo", sr: 1, ao: 0, ip: 0, op: 30, st: 0, bm: 0,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [200, 200, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: [                                    // escala linear: 10% no quadro 0, 100% no quadro 29
        { t: 0, s: [10, 10, 100], o: { x: [0, 0, 0], y: [0, 0, 0] }, i: { x: [1, 1, 1], y: [1, 1, 1] } },
        { t: 29, s: [100, 100, 100] },
      ] },
    },
    shapes: [{
      ty: "gr", nm: "disco", it: [
        { ty: "el", nm: "elipse", d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [360, 360] } },
        { ty: "fl", nm: "cor", c: { a: 0, k: [0.949, 0.329, 0.176, 1] }, o: { a: 0, k: 100 }, r: 1 },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ],
    }],
  }],
};
