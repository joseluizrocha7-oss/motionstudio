import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { escreverWav, juntar, lerWav, rmsDb, silencio, tom } from "./_voz-sintetica.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = mkdtempSync(join(tmpdir(), "motionstudio-montar-"));
after(() => rmSync(base, { recursive: true, force: true }));

// O limite do S4 vem do próprio ouvir.py: se ele mudar, o teste muda junto.
const LIMITE_S4 = Number(/^VOLUME_ENTRE_FRASES\s*=\s*([\d.]+)/m.exec(readFileSync(join(RAIZ, "scripts", "ouvir.py"), "utf8"))?.[1]);

// Uma tomada com 4 frases de 1,7 s (3 palavras de 0,5 s com 0,1 s entre elas). O tom de cada frase muda de região do
// espectro e a amplitude também: depois do nivelamento em LUFS, o RMS da parte falada ainda difere entre frases
// (a ponderação K da EBU R128 dá mais peso a 4 kHz do que a 80 Hz).
const FRASES = [
  { texto: "Ágata chegou aqui.", freq: 1000, amp: 0.30 },
  { texto: "Átomo ficou lá.", freq: 4000, amp: 0.12 },
  { texto: "Depois saiu agora.", freq: 80, amp: 0.45 },
  { texto: "Fim da história.", freq: 2500, amp: 0.20 },
];

function criarProjeto() {
  const pasta = join(base, "projeto");
  mkdirSync(join(pasta, "vozes", "tomadas"), { recursive: true });
  copyFileSync(join(RAIZ, "kit", "vozes", "montar.mjs"), join(pasta, "vozes", "montar.mjs"));
  writeFileSync(join(pasta, "roteiro.json"), JSON.stringify({
    titulo: "Teste", voz: {}, respiracao: 0.2, cauda: 0.12,
    blocos: [{ id: "b1", linhas: FRASES.map((f, i) => ({ id: `l${i + 1}`, texto: f.texto })) }],
  }));
  const partes = [silencio(0.5)], linhas = [], palavras = [], medidas = [];
  let t = 0.5;
  for (const f of FRASES) {
    const ini = t;
    f.texto.split(" ").forEach((w, i) => {
      if (i) { partes.push(silencio(0.1)); t += 0.1; }
      palavras.push({ word: w, start: +t.toFixed(3), end: +(t + 0.5).toFixed(3) });
      partes.push(tom(f.freq, 0.5, f.amp)); t += 0.5;
    });
    linhas.push({ text: f.texto, start: +ini.toFixed(3), end: +t.toFixed(3) });
    medidas.push({ termina_st: -6, variacao_st: 5, silabas_s: 4 });
    partes.push(silencio(1.0)); t += 1.0;
  }
  const tomadas = join(pasta, "vozes", "tomadas");
  escreverWav(join(tomadas, "b1-1.wav"), juntar(...partes));
  writeFileSync(join(tomadas, "b1-1.lines.json"), JSON.stringify(linhas));
  writeFileSync(join(tomadas, "b1-1.words.json"), JSON.stringify(palavras));
  writeFileSync(join(tomadas, "b1-1.medida.json"), JSON.stringify({ linhas: medidas, sinais: [] }));
  return pasta;
}
const pasta = criarProjeto();

function montar(audio, ...extra) {
  const r = spawnSync(process.execPath, [join(pasta, "vozes", "montar.mjs"), "--audio", audio, ...extra], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const saida = join(pasta, "film", audio);
  return { saida, stdout: r.stdout, plano: JSON.parse(readFileSync(join(saida, "vo.plano.json"), "utf8")) };
}

// A régua do S4 (scripts/ouvir.py, "S4 mixagem enxuta"): trechos de fala = palavras com menos de 0,30 s entre
// elas; só valem os de 0,40 s ou mais; nível = RMS em dB do trecho; a diferença é a do mais alto para o mais baixo.
function reguaS4(saida) {
  const { amostras } = lerWav(join(saida, "vo.wav"));
  const falas = [];
  for (const w of JSON.parse(readFileSync(join(saida, "vo.words.json"), "utf8"))) {
    if (falas.length && w.start - falas.at(-1)[1] < 0.30) falas.at(-1)[1] = Math.max(falas.at(-1)[1], w.end);
    else falas.push([w.start, w.end]);
  }
  const niveis = falas.filter(([a, b]) => b - a >= 0.40).map(([a, b]) => rmsDb(amostras, a, b));
  assert.equal(niveis.length, FRASES.length, "uma fala medida por frase");
  return Math.max(...niveis) - Math.min(...niveis);
}

test("o limite do S4 foi lido do ouvir.py", () => assert.equal(LIMITE_S4, 4));

test("só LUFS deixa as frases fora do limite do S4; com o ganho por linha caem abaixo dele", () => {
  // Controle: --fino 0 desliga o ganho por linha, que é o que o montar.mjs fazia antes.
  const sem = montar("sem-fino", "--fino", "0");
  const espalhamentoSem = reguaS4(sem.saida);
  assert.ok(espalhamentoSem > LIMITE_S4, `premissa do teste: só em LUFS as frases devem variar mais que ${LIMITE_S4} dB (deu ${espalhamentoSem.toFixed(2)} dB)`);

  const com = montar("com-fino");
  const espalhamentoCom = reguaS4(com.saida);
  assert.ok(espalhamentoCom < LIMITE_S4, `depois do nivelamento: ${espalhamentoCom.toFixed(2)} dB, limite do S4 ${LIMITE_S4} dB`);
  assert.ok(espalhamentoCom < 0.5, `o ganho leva cada frase à mediana: ${espalhamentoCom.toFixed(2)} dB`);

  // O plano grava o RMS falado e o ganho de cada frase; o ganho respeita o limite padrão de 4 dB.
  assert.equal(com.plano.length, FRASES.length);
  for (const f of com.plano) {
    assert.equal(typeof f.rmsFalado, "number");
    assert.ok(Math.abs(f.ganhoFino) <= 4 + 1e-9, `ganho fino de ${f.linha}: ${f.ganhoFino}`);
  }
  const rms = com.plano.map((f) => f.rmsFalado).sort((a, b) => a - b);
  assert.ok(rms.at(-1) - rms[0] > LIMITE_S4, "o plano guarda o RMS falado de antes do ganho fino");
  assert.ok(com.plano.some((f) => f.ganhoFino > 0.3) && com.plano.some((f) => f.ganhoFino < -0.3), "umas sobem, outras descem");
  // Cada frase aparece com o seu ganho na saída do comando.
  for (const f of com.plano) assert.match(com.stdout, new RegExp(`${f.bloco}\\s+${f.linha} f${f.frase}\\s+RMS falado -?[\\d.]+ dB\\s+ganho fino [+-][\\d.]+ dB`));
  assert.match(com.stdout, /espalhamento do RMS falado: [\d.]+ dB antes, [\d.]+ dB depois/);
  // O ganho fino não muda os tempos: as palavras são as mesmas dos dois lados.
  assert.deepEqual(JSON.parse(readFileSync(join(com.saida, "vo.words.json"), "utf8")), JSON.parse(readFileSync(join(sem.saida, "vo.words.json"), "utf8")));
});

test("--fino limita o ganho de cada frase", () => {
  const curto = montar("fino-1", "--fino", "1");
  for (const f of curto.plano) assert.ok(Math.abs(f.ganhoFino) <= 1 + 1e-9, `ganho fino de ${f.linha}: ${f.ganhoFino}`);
  assert.ok(curto.plano.some((f) => Math.abs(f.ganhoFino) > 0.9), "alguma frase bate no limite de 1 dB");
  assert.ok(reguaS4(curto.saida) > 0, "com o limite curto sobra diferença");
});
