import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { faixasDaVoz, lerTempos, planejar } from "../kit/film/posicionar-voz.mjs";
import { escreverWav, frequenciaEm, juntar, lerWav, limitesPorEnergia, rmsDb, silencio, SR, tom } from "./_voz-sintetica.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(RAIZ, "kit", "film", "posicionar-voz.mjs");
const base = mkdtempSync(join(tmpdir(), "motionstudio-posicionar-"));
after(() => rmSync(base, { recursive: true, force: true }));

// Voz montada sintética (o que o vozes/montar.mjs grava): um tom por linha, 1,0 s de silêncio entre linhas.
//   a1  440 Hz   0,50 a 1,28 s   uma frase
//   a2  660 Hz   2,28 a 4,72 s   duas frases, com 0,30 s de silêncio entre elas
//   a3  880 Hz   5,72 a 6,32 s   uma frase
function criarVoz(rampa = 0.005) {
  const partes = [], linhas = [], palavras = [];
  let t = 0;
  const sil = (s) => { partes.push(silencio(s)); t += s; };
  const frase = (linha, freq, texto, duracoes) => {
    const ini = t;
    texto.split(" ").forEach((w, i) => {
      if (i) sil(0.08);
      palavras.push({ word: w, start: +t.toFixed(3), end: +(t + duracoes[i]).toFixed(3), linha, bloco: "b" });
      partes.push(tom(freq, duracoes[i], 0.3, SR, rampa)); t += duracoes[i];
    });
    linhas.push({ text: texto, start: +ini.toFixed(3), end: +t.toFixed(3), linha, bloco: "b" });
  };
  sil(0.5); frase("a1", 440, "Ágata chegou", [0.35, 0.35]);
  sil(1.0); frase("a2", 660, "Átomo ficou aqui", [0.4, 0.4, 0.3]); sil(0.3); frase("a2", 660, "Depois saiu", [0.4, 0.4]);
  sil(1.0); frase("a3", 880, "Fim", [0.6]);
  sil(0.5);
  return { x: juntar(...partes), linhas, palavras };
}

// Projeto no formato do novo-projeto.mjs: <pasta>/film/posicionar-voz.mjs e <pasta>/film/audio/.
function criarProjeto(nome, tempos, rampa) {
  const pasta = join(base, nome);
  mkdirSync(join(pasta, "film", "audio"), { recursive: true });
  mkdirSync(join(pasta, "film", "assets"), { recursive: true });
  copyFileSync(SCRIPT, join(pasta, "film", "posicionar-voz.mjs"));
  const voz = criarVoz(rampa);
  escreverWav(join(pasta, "film", "audio", "vo.wav"), voz.x);
  writeFileSync(join(pasta, "film", "audio", "vo.lines.json"), JSON.stringify(voz.linhas));
  writeFileSync(join(pasta, "film", "audio", "vo.words.json"), JSON.stringify(voz.palavras));
  writeFileSync(join(pasta, "tempos.json"), JSON.stringify(tempos));
  return { pasta, voz };
}
const rodar = (pasta, ...args) => spawnSync(process.execPath, [join(pasta, "film", "posicionar-voz.mjs"), ...args], { encoding: "utf8" });
const lerFala = (arq) => { const t = readFileSync(arq, "utf8"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };

const TEMPOS = { _nota: "comentário", a1: 0.2, a2: 3.5, a3: { inicio: 7.0, fim: 9.0 } };

test("cada linha começa no tempo pedido, medido pela energia do áudio posicionado", () => {
  const { pasta } = criarProjeto("tempos-certos", TEMPOS);
  const r = rodar(pasta, "--duracao", "10");
  assert.equal(r.status, 0, r.stderr);
  const { sr, amostras } = lerWav(join(pasta, "film", "audio-filme", "vo.wav"));
  assert.equal(sr, SR);
  assert.equal(amostras.length, 10 * SR, "a duração é a pedida");
  // a1: 0,78 s de fala; a2: 2,44 s (as duas frases e o silêncio entre elas); a3: 0,60 s.
  const a1 = limitesPorEnergia(amostras, 0, 2), a2 = limitesPorEnergia(amostras, 2, 6.5), a3 = limitesPorEnergia(amostras, 6.5, 10);
  const perto = (v, esperado, rotulo) => assert.ok(Math.abs(v - esperado) < 0.015, `${rotulo}: ${v} s, esperado ${esperado} s`);
  perto(a1.ini, 0.2, "início de a1"); perto(a1.fim, 0.98, "fim de a1");
  perto(a2.ini, 3.5, "início de a2"); perto(a2.fim, 5.94, "fim de a2");
  perto(a3.ini, 7.0, "início de a3"); perto(a3.fim, 7.6, "fim de a3");
  // Cada tom foi para o lugar da sua linha (medido dentro de uma palavra), e o vão entre as linhas ficou mudo.
  assert.ok(Math.abs(frequenciaEm(amostras, 0.25, 0.5) - 440) < 15);
  assert.ok(Math.abs(frequenciaEm(amostras, 3.55, 3.85) - 660) < 15);
  assert.ok(Math.abs(frequenciaEm(amostras, 7.1, 7.5) - 880) < 15);
  assert.ok(rmsDb(amostras, 1.1, 3.4) < -100 && rmsDb(amostras, 6.1, 6.9) < -100 && rmsDb(amostras, 7.7, 10) < -100, "silêncio entre as linhas");
});

test("fala.js sai com offset 0 e os tempos de linhas e palavras já deslocados", () => {
  const { pasta, voz } = criarProjeto("fala-js", TEMPOS);
  const r = rodar(pasta, "--duracao", "10");
  assert.equal(r.status, 0, r.stderr);
  const fala = lerFala(join(pasta, "film", "assets", "fala.js"));
  assert.equal(fala.offset, 0);
  const desloc = { a1: 0.2 - 0.5, a2: 3.5 - 2.28, a3: 7.0 - 5.72 };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  assert.deepEqual(fala.linhas, voz.linhas.map((l) => ({ t: l.text, l: l.linha, a: r3(l.start + desloc[l.linha]), b: r3(l.end + desloc[l.linha]) })));
  assert.deepEqual(fala.palavras, voz.palavras.map((p) => ({ w: p.word, l: p.linha, a: r3(p.start + desloc[p.linha]), b: r3(p.end + desloc[p.linha]) })));
  assert.equal(fala.linhas.length, 4);
  assert.equal(fala.palavras.length, 8);
  assert.deepEqual(fala.linhas[0], { t: "Ágata chegou", l: "a1", a: 0.2, b: 0.98 });
  // As palavras caem em cima da energia do áudio: a primeira palavra de a2 começa onde o tom começa.
  const { amostras } = lerWav(join(pasta, "film", "audio-filme", "vo.wav"));
  const primeira = fala.palavras.find((p) => p.l === "a2");
  assert.ok(Math.abs(limitesPorEnergia(amostras, 2, 6).ini - primeira.a) < 0.015);
  // Os JSON posicionados ficam ao lado do áudio, para o gerar-legenda e o gerar-som lerem.
  const linhasFilme = JSON.parse(readFileSync(join(pasta, "film", "audio-filme", "vo.lines.json"), "utf8"));
  assert.equal(linhasFilme[2].start, 5.06);   // 3,84 s na voz (2ª frase de a2) mais 1,22 s de deslocamento
  assert.equal(linhasFilme[0].start, 0.2);
  assert.equal(linhasFilme[0].bloco, "b", "os outros campos passam");
});

test("sobreposição: a linha seguinte começa antes de a anterior terminar", () => {
  const { pasta } = criarProjeto("sobrepoe", { a1: 0.2, a2: 0.6, a3: 7 });
  const r = rodar(pasta, "--duracao", "10");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a2 começa em 0\.6 s, antes de a1 terminar \(0\.98 s\)/);
  assert.ok(!existsSync(join(pasta, "film", "audio-filme", "vo.wav")), "nada gravado");
  assert.ok(!existsSync(join(pasta, "film", "assets", "fala.js")), "nada gravado");
});

function plano(tempos, opcoes = { duracao: 10 }) {
  const { voz } = { voz: criarVoz() };
  return planejar(faixasDaVoz(voz.linhas), lerTempos(tempos), { total: voz.x.length / SR, ...opcoes });
}

test("planejar: linha fora da ordem do roteiro também falha, mesmo sem sobrepor", () => {
  assert.throws(() => plano({ a1: 5, a2: 1, a3: 8 }), /a2 começa em 1 s, antes de a1 terminar \(5\.78 s\)/);
});
test("planejar: aceita a linha que começa no instante em que a anterior termina", () => {
  assert.doesNotThrow(() => plano({ a1: 0.2, a2: 0.98, a3: 7 }));
});
test("planejar: linha da voz sem tempo, e tempo sem linha na voz", () => {
  assert.throws(() => plano({ a1: 0.2, a2: 3.5 }), /não tem tempo para: a3/);
  assert.throws(() => plano({ a1: 0.2, a2: 3.5, a3: 7, a4: 8 }), /linha que não está na voz: a4 \(linhas da voz: a1, a2, a3\)/);
});
test("planejar: fim da cena e fim do filme", () => {
  assert.throws(() => plano({ a1: 0.2, a2: { inicio: 3.5, fim: 5 }, a3: 7 }), /a2 termina em 5\.94 s e a cena acaba em 5 s/);
  assert.throws(() => plano({ a1: 0.2, a2: 3.5, a3: 9.7 }), /a3 termina em 10\.3 s e o filme acaba em 10 s/);
});
test("planejar: junta todos os problemas numa mensagem só", () => {
  try { plano({ a1: 0.2, a2: 0.5, a3: 9.7 }); assert.fail("devia falhar"); } catch (e) {
    assert.match(e.message, /a2 começa em 0\.5 s/);
    assert.match(e.message, /a3 termina em 10\.3 s/);
  }
});
test("lerTempos recusa valor que não é número, início negativo e fim antes do início", () => {
  assert.throws(() => lerTempos({ a1: "0.2" }), /"a1" precisa de um número de segundos/);
  assert.throws(() => lerTempos({ a1: -1 }), /"a1" precisa de um número de segundos/);
  assert.throws(() => lerTempos({ a1: { inicio: 4, fim: 3 } }), /"a1": o fim .* depois do início/);
  assert.throws(() => lerTempos([1, 2]), /tem que ser um objeto/);
  assert.throws(() => lerTempos({ _so: "comentário" }), /está vazio/);
});
test("planejar: corte no meio do silêncio entre as linhas, limitado pelo vão do filme", () => {
  const p = plano({ a1: 0.2, a2: 3.5, a3: 7 });
  // Vão de 1,0 s na voz: meio segundo de cada lado. Primeira linha: no máximo 0,25 s antes; última: 0,35 s depois.
  assert.deepEqual(p.map((x) => [x.linha, +x.antes.toFixed(3), +x.depois.toFixed(3)]), [["a1", 0.2, 0.5], ["a2", 0.5, 0.5], ["a3", 0.5, 0.35]]);
  // a1 e a2 a 0,40 s uma da outra no filme: cada uma fica com a metade do vão (0,20 s).
  const apertado = plano({ a1: 0.2, a2: 1.38, a3: 7 });
  assert.deepEqual(apertado.slice(0, 2).map((x) => [+x.antes.toFixed(3), +x.depois.toFixed(3)]), [[0.2, 0.2], [0.2, 0.5]]);
});

// Tom de 0,3 de amplitude: RMS de -13,5 dB. Pontas cheias (sem rampa própria) mostram se o corte apaga fala.
for (const [rotulo, a2] of [["encostadas", 0.98], ["10 ms uma da outra", 0.99]]) {
  test(`a rampa de 12 ms não apaga fala quando as linhas estão ${rotulo}`, () => {
    const { pasta } = criarProjeto(`rampa-${a2}`, { a1: 0.2, a2, a3: 7 }, 0);
    const r = rodar(pasta, "--duracao", "10");
    assert.equal(r.status, 0, r.stderr);
    const { amostras } = lerWav(join(pasta, "film", "audio-filme", "vo.wav"));
    const alvo = 20 * Math.log10(0.3 / Math.SQRT2);
    const fimA1 = rmsDb(amostras, 0.97, 0.98), inicioA2 = rmsDb(amostras, a2, a2 + 0.01);
    assert.ok(Math.abs(fimA1 - alvo) < 0.3, `últimos 10 ms de a1: ${fimA1.toFixed(2)} dB, esperado ${alvo.toFixed(2)} dB`);
    assert.ok(Math.abs(inicioA2 - alvo) < 0.3, `primeiros 10 ms de a2: ${inicioA2.toFixed(2)} dB, esperado ${alvo.toFixed(2)} dB`);
  });
}
