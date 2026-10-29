#!/usr/bin/env node
// Gera os ícones animados da biblioteca (library/lottie/<nome>.js) a partir das formas abaixo.
// Mude aqui, não nos .js: eles são reescritos a cada rodada.
//   node library/lottie/_gerar.mjs            (grava nesta pasta)
//   node library/lottie/_gerar.mjs <pasta>    (grava em outra pasta; o teste usa para comparar)
// Cada .js registra o Lottie em window.LOTTIE.<nome>, e não em um .json (escolha do projeto): um <script> comum carrega em
// file:// com ou sem --allow-file-access-from-files; um .json pediria fetch() de file://, que só funciona com essa opção.
// Regras do conjunto: quadro de 200 x 200, 30 qps, 30 quadros (0 a 29), uma camada só.
// Traço de 12 com ponta e junta redondas, cantos arredondados, uma cor só (COR).
// O quadro 0 é vazio (opacidade 0): é ele que aparece antes do `at` do M.lottie.
// Entrada de 20 a 28 quadros: o traço se desenha (trim path), a escala passa de 104% e assenta em 100%.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = process.argv[2] || dirname(fileURLToPath(import.meta.url));
const TAM = 200, FPS = 30, QUADROS = 30, TRACO = 12;
const COR = "#24221F";   // a tinta do kit; no filme, troque com LOTTIE.cor(LOTTIE.<nome>, "#RRGGBB")

// Curvas (x1, y1, x2, y2), como no cubic-bezier do CSS. Nenhuma linear.
const CURVA = {
  entra: [0.33, 0, 0.67, 1],   // a opacidade do começo
  sai: [0.33, 1, 0.68, 1],     // arranca rápido e freia até parar (a escala até 104%)
  vaivem: [0.45, 0, 0.55, 1],  // ida e volta suave (104% para 100%, o balanço)
  traco: [0.45, 0, 0.2, 1],    // o traço que se desenha: ganha velocidade e assenta devagar
};

const r2 = (n) => Math.round(n * 100) / 100;
const fixo = (k) => ({ a: 0, k });
const rgba = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1].map((v) => Math.round(v * 1e4) / 1e4); };

// Propriedade animada. chaves = [[quadro, valor, curva do trecho que começa nesta chave], ...].
function anima(chaves) {
  return { a: 1, k: chaves.map(([t, v, c], i) => {
    const s = Array.isArray(v) ? v : [v];
    if (i === chaves.length - 1) return { t, s };
    const [x1, y1, x2, y2] = CURVA[c || "traco"];
    const n = s.length;
    return { t, s, o: { x: Array(n).fill(x1), y: Array(n).fill(y1) }, i: { x: Array(n).fill(x2), y: Array(n).fill(y2) } };
  }) };
}

// Caminho do Lottie. pts = [[x, y, ix, iy, ox, oy], ...], alças relativas ao ponto.
function caminho(pts, fechado) {
  return { a: 0, k: { c: fechado, v: pts.map((p) => [r2(p[0]), r2(p[1])]),
    i: pts.map((p) => [r2(p[2] || 0), r2(p[3] || 0)]), o: pts.map((p) => [r2(p[4] || 0), r2(p[5] || 0)]) } };
}

// Círculo de raio r: começa no alto e anda no sentido do relógio.
function circulo(r) {
  const k = r * 0.5523;
  return caminho([[0, -r, -k, 0, k, 0], [r, 0, 0, -k, 0, k], [0, r, k, 0, -k, 0], [-r, 0, 0, k, 0, -k]], true);
}

// Polígono com cantos arredondados por arco de círculo. cantos = [[x, y, raio], ...].
// meio = i: o caminho começa no meio do lado que chega ao canto i (o 50% do traço fica no lado oposto,
// se a forma for simétrica). Aberto: o primeiro e o último ponto são as pontas, sem arredondar.
function poligono(cantos, { fechado = true, meio = null } = {}) {
  const n = cantos.length, pts = [];
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l, l]; };
  const ordem = [...Array(n).keys()].map((j) => (meio == null ? j : (meio + j) % n));
  if (meio != null) { const a = cantos[(meio - 1 + n) % n], b = cantos[meio]; pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
  for (const i of ordem) {
    const c = cantos[i], raio = c[2] || 0;
    if (!raio || (!fechado && (i === 0 || i === n - 1))) { pts.push([c[0], c[1]]); continue; }
    const [ux, uy, la] = unit(c, cantos[(i - 1 + n) % n]), [wx, wy, lb] = unit(c, cantos[(i + 1) % n]);
    const alfa = Math.acos(Math.max(-1, Math.min(1, ux * wx + uy * wy)));   // ângulo de dentro do canto
    const d = Math.min(raio / Math.tan(alfa / 2), la / 2, lb / 2);           // onde o arco encosta em cada lado
    const rho = d * Math.tan(alfa / 2), h = (4 / 3) * Math.tan((Math.PI - alfa) / 4) * rho;   // alça de um arco de círculo
    pts.push([c[0] + ux * d, c[1] + uy * d, 0, 0, -ux * h, -uy * h]);
    pts.push([c[0] + wx * d, c[1] + wy * d, -wx * h, -wy * h, 0, 0]);
  }
  return caminho(pts, fechado);
}

const tr = (o = {}) => ({ ty: "tr", nm: "transformação", p: o.p || fixo([0, 0]), a: o.a || fixo([0, 0]), s: o.s || fixo([100, 100]),
  r: o.r || fixo(0), o: fixo(100), sk: fixo(0), sa: fixo(0) });

// Um traço que se desenha. desenho = { e: chaves } (de uma ponta à outra) ou { s, e } (do meio para as pontas).
function traco(nm, forma, desenho, grupo = {}) {
  return { ty: "gr", nm, bm: 0, it: [
    { ty: "sh", nm: "forma", ks: forma },
    { ty: "tm", nm: "desenho", s: desenho.s ? anima(desenho.s) : fixo(0), e: anima(desenho.e), o: fixo(0), m: 1 },
    { ty: "st", nm: "traço", c: fixo(rgba(COR)), o: fixo(100), w: fixo(TRACO), lc: 2, lj: 2, ml: 4, bm: 0 },
    tr(grupo),
  ] };
}
// Do meio do caminho para as duas pontas, entre os quadros a e b.
const doMeio = (a, b) => ({ s: [[a, 50], [b, 0]], e: [[a, 50], [b, 100]] });
const deAte = (a, b) => ({ e: [[a, 0], [b, 100]] });

// O que todo ícone faz: aparece no quadro 1 a 3 e passa de 104% antes de assentar em 100%.
function camada(nm, grupos) {
  return { ddd: 0, ind: 1, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: QUADROS, st: 0, bm: 0,
    ks: {
      o: anima([[0, 0, "entra"], [3, 100]]),
      r: fixo(0),
      p: fixo([TAM / 2, TAM / 2, 0]),
      a: fixo([0, 0, 0]),
      s: anima([[0, [86, 86, 100], "sai"], [13, [104, 104, 100], "vaivem"], [23, [100, 100, 100]]]),
    },
    shapes: grupos };
}

const ICONES = {
  confirmado: {
    sobre: "um círculo que se desenha a partir do alto e o visto por dentro, que se desenha depois",
    grupos: [
      traco("círculo", circulo(64), deAte(0, 15)),
      traco("visto", poligono([[-28, 1], [-9, 20], [28, -17]], { fechado: false }), deAte(9, 20)),
    ],
  },
  alerta: {
    sobre: "um triângulo que se desenha da ponta para a base, o traço do ponto de exclamação descendo e o ponto que salta; tudo balança de leve sobre a base",
    grupos: [{ ty: "gr", nm: "alerta", bm: 0, it: [
      traco("triângulo", poligono([[0, -62, 12], [70, 56, 12], [-70, 56, 12]], { meio: 2 }), doMeio(0, 16)),
      traco("traço do ponto", poligono([[0, -20], [0, 8]], { fechado: false }), deAte(9, 17)),
      { ty: "gr", nm: "ponto", bm: 0, it: [
        { ty: "el", nm: "disco", d: 1, p: fixo([0, 0]), s: fixo([13, 13]) },
        { ty: "fl", nm: "preenchimento", c: fixo(rgba(COR)), o: fixo(100), r: 1, bm: 0 },
        tr({ p: fixo([0, 30]), s: anima([[14, [0, 0], "sai"], [19, [125, 125], "vaivem"], [24, [100, 100]]]) }),
      ] },
      tr({ a: fixo([0, 56]), p: fixo([0, 56]), r: anima([[12, 0, "vaivem"], [17, -6, "vaivem"], [21, 4, "vaivem"], [25, -1.5, "vaivem"], [28, 0]]) }),
    ] }],
  },
  dinheiro: {
    sobre: "uma moeda que se desenha a partir do alto, o S do cifrão que se desenha de cima para baixo e a barra que cresce do meio",
    grupos: [
      traco("moeda", circulo(64), deAte(0, 15)),
      traco("S", caminho([
        [25.6, -25.6], [-12.8, -25.6, 0, 0, -7.07, 0], [-25.6, -12.8, 0, -7.07, 0, 7.07], [-12.8, 0, -7.07, 0, 0, 0],
        [12.8, 0, 0, 0, 7.07, 0], [25.6, 12.8, 0, -7.07, 0, 7.07], [12.8, 25.6, 7.07, 0, 0, 0], [-25.6, 25.6],
      ], false), deAte(7, 20)),
      traco("barra", poligono([[0, -38.4], [0, 38.4]], { fechado: false }), doMeio(12, 22)),
    ],
  },
  email: {
    sobre: "um envelope que se desenha do alto para baixo pelos dois lados e a aba que se abre da ponta para os lados",
    grupos: [
      traco("envelope", poligono([[-70, -50, 16], [70, -50, 16], [70, 50, 16], [-70, 50, 16]], { meio: 3 }), doMeio(0, 16)),
      traco("aba", poligono([[-70, -28], [0, 12, 10], [70, -28]], { fechado: false }), doMeio(9, 20)),
    ],
  },
  documento: {
    sobre: "uma folha com a ponta dobrada que se desenha a partir da dobra, a dobra e três linhas de texto que entram uma depois da outra",
    grupos: [
      traco("folha", poligono([[20, -66], [-52, -66, 12], [-52, 66, 12], [52, 66, 12], [52, -34]]), deAte(0, 16)),
      traco("dobra", poligono([[20, -66], [20, -34, 8], [52, -34]], { fechado: false }), deAte(12, 19)),
      traco("linha 1", poligono([[-26, -20], [-2, -20]], { fechado: false }), deAte(11, 18)),
      traco("linha 2", poligono([[-26, 6], [26, 6]], { fechado: false }), deAte(14, 21)),
      traco("linha 3", poligono([[-26, 32], [26, 32]], { fechado: false }), deAte(17, 24)),
    ],
  },
};

for (const [nome, { sobre, grupos }] of Object.entries(ICONES)) {
  const dado = { v: "5.7.4", nm: nome, fr: FPS, ip: 0, op: QUADROS, w: TAM, h: TAM, ddd: 0, assets: [], layers: [camada(nome, grupos)] };
  const js = `// Ícone animado "${nome}": ${sobre}.\n`
    + `// Gerado por _gerar.mjs (mude lá e rode de novo). ${TAM} x ${TAM}, ${FPS} qps, quadros 0 a ${QUADROS - 1}, cor ${COR}.\n`
    + `// No filme: M.lottie('#icone', { data: LOTTIE.cor(LOTTIE.${nome}, '#RRGGBB'), at: <quadro> }) (LOTTIE.cor vem de _cor.js).\n`
    + `window.LOTTIE = window.LOTTIE || {};\nLOTTIE.${nome} = ${JSON.stringify(dado)};\n`;
  writeFileSync(join(AQUI, `${nome}.js`), js);
  console.log(`${nome}.js  ${js.length} bytes`);
}
