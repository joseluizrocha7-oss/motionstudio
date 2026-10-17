// Cópia de conteudo/video-comercial-2026-10-12/gerar-trilha.mjs (16/10/2026): a mesma
// trilha sintetizada e os mesmos efeitos, sem amostra de terceiros.
// Sintetiza a trilha de fundo e os efeitos sonoros do vídeo comercial.
//
// Tudo sai de conta, sem amostra de terceiros e sem rede: não há licença de
// música pra acertar depois. Quem chama é o renderizar.mjs, que passa a
// duração do vídeo, o início de cada cena e os instantes dos efeitos anotados
// pela composição (window.EFEITOS).
//
// Uma faixa licenciada substitui a trilha sem mexer aqui: basta salvar em
// audio/trilha.mp3. Os efeitos continuam sendo os sintetizados.

import { writeFileSync } from "node:fs";

const SR = 48000;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Ré maior, andamento de 100 bpm: D, Bm7, Gmaj7, A. Um acorde a cada 8 s.
const ACORDES = [
  [38, 50, 57, 62, 66, 69],
  [35, 47, 54, 62, 66, 69],
  [43, 50, 55, 62, 66, 71],
  [45, 52, 57, 61, 64, 69],
];
const COMPASSO = 8;
const CAUDA = 2.6;
const COLCHEIA = 0.3;

// Ruído reprodutível: a mesma trilha sai em toda renderização.
function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function novaFaixa(total) {
  const n = Math.ceil(total * SR);
  return { n, e: new Float32Array(n), d: new Float32Array(n) };
}

function somar(faixa, i, valor, pan) {
  if (i < 0 || i >= faixa.n) return;
  faixa.e[i] += valor * (1 - pan) * 0.5 * 1.4142;
  faixa.d[i] += valor * (1 + pan) * 0.5 * 1.4142;
}

function gravarWav(arquivo, faixa) {
  const dados = Buffer.alloc(faixa.n * 4);
  for (let i = 0; i < faixa.n; i++) {
    // Limitador suave: nada estoura, e pico alto não vira estalo.
    dados.writeInt16LE(Math.round(Math.tanh(faixa.e[i]) * 32767), i * 4);
    dados.writeInt16LE(Math.round(Math.tanh(faixa.d[i]) * 32767), i * 4 + 2);
  }
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0); cab.writeUInt32LE(36 + dados.length, 4); cab.write("WAVEfmt ", 8);
  cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(2, 22);
  cab.writeUInt32LE(SR, 24); cab.writeUInt32LE(SR * 4, 28); cab.writeUInt16LE(4, 32); cab.writeUInt16LE(16, 34);
  cab.write("data", 36); cab.writeUInt32LE(dados.length, 40);
  writeFileSync(arquivo, Buffer.concat([cab, dados]));
}

// ---------- Trilha ----------

function trilha({ total, inicioDoRitmo, inicioDaAssinatura }) {
  const faixa = novaFaixa(total);
  const acaso = sorteio(20261012);

  // Os acordes andam de 8 em 8 s e a assinatura final cai na tônica: o
  // acorde antes dela é o A, pra resolver em D.
  const trechos = [];
  for (let t = 0; t < inicioDaAssinatura - 3; t += COMPASSO) trechos.push({ t0: t });
  trechos.forEach((tr, i) => {
    tr.fim = i + 1 < trechos.length ? trechos[i + 1].t0 : inicioDaAssinatura;
    tr.acorde = (((3 - (trechos.length - 1 - i)) % 4) + 4) % 4;
  });
  trechos.push({ t0: inicioDaAssinatura, fim: total, acorde: 0 });
  const acordeEm = (t) => (trechos.find((tr) => t >= tr.t0 && t < tr.fim) || trechos[trechos.length - 1]).acorde;

  // Cama: cada nota é um par de senoides levemente desafinadas, que respira.
  for (const tr of trechos) {
    const dur = tr.fim - tr.t0;
    ACORDES[tr.acorde].forEach((midi, j) => {
      const ganho = (j === 0 ? 0.2 : j === 1 ? 0.15 : 0.1) * (midi > 66 ? 0.8 : 1);
      const pan = j === 0 ? 0 : (j % 2 ? 1 : -1) * (0.12 + 0.09 * j);
      const lfo = 0.09 + acaso() * 0.09;
      const faseLfo = acaso() * 6.283;
      for (const cents of [-5, 5]) {
        const w = (2 * Math.PI * hz(midi) * 2 ** (cents / 1200)) / SR;
        const fase = acaso() * 6.283;
        const i0 = Math.floor(tr.t0 * SR);
        const i1 = Math.min(faixa.n, Math.floor((tr.fim + CAUDA) * SR));
        for (let i = i0; i < i1; i++) {
          const t = (i - i0) / SR;
          let env = t < 2.2 ? Math.sin((Math.PI / 2) * (t / 2.2)) ** 2 : 1;
          if (t > dur) env *= Math.cos((Math.PI / 2) * ((t - dur) / CAUDA)) ** 2;
          const x = w * (i - i0) + fase;
          const onda = j === 0 ? Math.sin(x) + 0.15 * Math.sin(2 * x) : Math.sin(x) + 0.26 * Math.sin(2 * x) + 0.08 * Math.sin(3 * x);
          const tremolo = 1 + 0.14 * Math.sin(2 * Math.PI * lfo * (i / SR) + faseLfo);
          somar(faixa, i, onda * env * ganho * tremolo * 0.5, pan);
        }
      }
    });
  }

  // Ritmo: entra com a marca e sai na assinatura. Um dedilhado em colcheias
  // com eco, mais um pulso grave a cada dois tempos.
  const passo = [1, 0, 0.7, 0.85, 0, 0.75, 0, 0.6];
  const desenho = [2, 4, 3, 5, 4, 3, 5, 4];
  const dedilhar = (t0, midi, forca, pan) => {
    const w = (2 * Math.PI * hz(midi)) / SR;
    const i0 = Math.floor(t0 * SR);
    const fim = Math.floor(0.9 * SR);
    for (let k = 0; k < fim; k++) {
      const t = k / SR;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.2);
      const onda = Math.sin(w * k) + 0.4 * Math.sin(2 * w * k) * Math.exp(-t / 0.06);
      somar(faixa, i0 + k, onda * env * forca, pan);
    }
  };
  let n = 0;
  for (let t = inicioDoRitmo; t < inicioDaAssinatura - 0.2; t += COLCHEIA, n++) {
    const forca = passo[n % 8];
    // O ritmo cresce nos primeiros segundos em vez de entrar de uma vez.
    const subida = Math.min(1, (t - inicioDoRitmo) / 4);
    if (forca) {
      const midi = ACORDES[acordeEm(t)][desenho[n % 8]] + 12;
      const pan = n % 2 ? 0.38 : -0.38;
      dedilhar(t, midi, 0.055 * forca * subida, pan);
      dedilhar(t + COLCHEIA * 1.5, midi, 0.024 * forca * subida, -pan);
      dedilhar(t + COLCHEIA * 3, midi, 0.011 * forca * subida, pan);
    }
    if (n % 4 === 0) {
      const f = hz(ACORDES[acordeEm(t)][0]);
      const i0 = Math.floor(t * SR);
      for (let k = 0; k < 0.5 * SR; k++) {
        const tt = k / SR;
        const env = Math.min(1, tt / 0.006) * Math.exp(-tt / 0.16);
        somar(faixa, i0 + k, Math.sin(2 * Math.PI * f * tt * (1 + 0.25 * Math.exp(-tt / 0.03))) * env * 0.11 * subida, 0);
      }
    }
  }

  // Entra e sai sem corte seco.
  for (let i = 0; i < faixa.n; i++) {
    const t = i / SR;
    const g = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (total - t) / 2.4));
    faixa.e[i] *= g;
    faixa.d[i] *= g;
  }
  return faixa;
}

// ---------- Efeitos ----------

function sopro(faixa, t0, { dur, forca, de, pico, ate, semente }) {
  // Ruído passando por um filtro passa-faixa que abre e fecha: o "whoosh".
  const acaso = sorteio(semente);
  let baixo = 0;
  let faixaMedia = 0;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const fc = p < 0.5 ? de + (pico - de) * (p * 2) ** 1.5 : pico + (ate - pico) * ((p - 0.5) * 2) ** 0.8;
    const f = 2 * Math.sin((Math.PI * fc) / SR);
    const alto = acaso() * 2 - 1 - baixo - 0.9 * faixaMedia;
    faixaMedia += f * alto;
    baixo += f * faixaMedia;
    const env = Math.sin(Math.PI * p) ** 1.6;
    somar(faixa, i0 + k, faixaMedia * env * forca, -0.75 + 1.5 * p);
  }
}

function nota(faixa, t0, { f, f2 = f, dur, queda, forca, pan = 0, brilho = 0.2 }) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  let fase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    fase += (2 * Math.PI * (f + (f2 - f) * Math.min(1, t / 0.06))) / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / queda);
    somar(faixa, i0 + k, (Math.sin(fase) + brilho * Math.sin(2 * fase)) * env * forca, pan);
  }
}

const EFEITO = {
  cortina: (fx, t, i) => sopro(fx, t, { dur: 1.0, forca: 0.2, de: 260, pico: 3400, ate: 480, semente: 11 + i }),
  ar: (fx, t, i) => sopro(fx, t, { dur: 0.6, forca: 0.085, de: 480, pico: 2100, ate: 700, semente: 37 + i }),
  pop: (fx, t) => nota(fx, t, { f: 500, f2: 780, dur: 0.16, queda: 0.045, forca: 0.085 }),
  aprovar: (fx, t) => {
    nota(fx, t, { f: 880, dur: 0.3, queda: 0.09, forca: 0.1, pan: 0.25 });
    nota(fx, t + 0.075, { f: 1318.5, dur: 0.45, queda: 0.15, forca: 0.11, pan: 0.25 });
  },
  reprovar: (fx, t) => {
    nota(fx, t, { f: 587.3, dur: 0.3, queda: 0.09, forca: 0.1, pan: -0.25 });
    nota(fx, t + 0.075, { f: 440, dur: 0.45, queda: 0.16, forca: 0.11, pan: -0.25 });
  },
  pular: (fx, t) => nota(fx, t, { f: 784, f2: 987.8, dur: 0.4, queda: 0.13, forca: 0.095 }),
  leitura: (fx, t) => {
    [1760, 2093, 2637, 2349, 3136, 2637, 3520, 2794, 3136, 3951].forEach((f, k) =>
      nota(fx, t + k * 0.165, { f, dur: 0.2, queda: 0.05, forca: 0.028, pan: k % 2 ? 0.5 : -0.5, brilho: 0 }),
    );
  },
  sino: (fx, t) => {
    [1174.7, 1480, 1760].forEach((f, k) =>
      nota(fx, t + k * 0.065, { f, dur: 1.2, queda: 0.42, forca: 0.062, pan: -0.3 + 0.3 * k, brilho: 0.12 }),
    );
  },
  assinatura: (fx, t) => {
    nota(fx, t, { f: 110, f2: 55, dur: 1.3, queda: 0.42, forca: 0.26, brilho: 0 });
    sopro(fx, t - 0.25, { dur: 0.9, forca: 0.11, de: 300, pico: 2600, ate: 900, semente: 71 });
    [587.3, 880, 1174.7, 1480].forEach((f, k) =>
      nota(fx, t + 0.12 + k * 0.05, { f, dur: 3.2, queda: 1.1, forca: 0.05, pan: -0.45 + 0.3 * k, brilho: 0.1 }),
    );
  },
};

export function gerarAudio({ total, tempos, efeitos, arquivoTrilha, arquivoEfeitos }) {
  const assinatura = efeitos.find((e) => e.tipo === "assinatura")?.t ?? total - 8;
  gravarWav(arquivoTrilha, trilha({ total, inicioDoRitmo: tempos.cenas.marca.inicio, inicioDaAssinatura: assinatura }));

  const fx = novaFaixa(total);
  efeitos.forEach((e, i) => {
    if (!EFEITO[e.tipo]) throw new Error(`Efeito sem som definido: ${e.tipo}`);
    EFEITO[e.tipo](fx, e.t, i);
  });
  gravarWav(arquivoEfeitos, fx);
}
