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

// Tomada sintética: cada frase tem uma ou mais partes (palavras de 0,5 s com 0,1 s entre elas, num tom e numa
// amplitude), com `pausa` s de silêncio entre as partes. Parte e parte separadas por 0,30 s ou mais são
// trechos diferentes para o S4.
// Espectro e amplitude diferentes entre frases: depois do nivelamento em LUFS o RMS falado ainda difere
// (a ponderação K da EBU R128 dá mais peso a 4 kHz do que a 80 Hz).
const TONS = [
  { partes: [{ palavras: "Ágata chegou aqui.", freq: 1000, amp: 0.30 }] },
  { partes: [{ palavras: "Átomo ficou lá.", freq: 4000, amp: 0.12 }] },
  { partes: [{ palavras: "Depois saiu agora.", freq: 80, amp: 0.45 }] },
  { partes: [{ palavras: "Fim da história.", freq: 2500, amp: 0.20 }] },
];
// Mesmo tom nas 4 frases; a 2ª tem uma pausa de 0,40 s no meio e a segunda metade 5,5 dB mais baixa.
// Em LUFS igual, as duas metades ficam cerca de 5 dB uma da outra: 2 trechos na mesma frase.
const PAUSA_NO_MEIO = [
  { partes: [{ palavras: "Ágata chegou aqui.", freq: 1000, amp: 0.30 }] },
  { partes: [{ palavras: "Átomo ficou", freq: 1000, amp: 0.30 }, { palavras: "lá embaixo.", freq: 1000, amp: 0.16 }], pausa: 0.4 },
  { partes: [{ palavras: "Depois saiu agora.", freq: 1000, amp: 0.20 }] },
  { partes: [{ palavras: "Fim da história.", freq: 1000, amp: 0.40 }] },
];
const textoDe = (frase) => frase.partes.map((p) => p.palavras).join(" ");

// `linhas`: quais frases formam cada linha do roteiro (padrão: uma frase por linha).
function criarProjeto(nome, frases, { linhas = frases.map((_, i) => [i]), roteiro = {} } = {}) {
  const pasta = join(base, nome);
  mkdirSync(join(pasta, "vozes", "tomadas"), { recursive: true });
  copyFileSync(join(RAIZ, "kit", "vozes", "montar.mjs"), join(pasta, "vozes", "montar.mjs"));
  writeFileSync(join(pasta, "roteiro.json"), JSON.stringify({
    titulo: "Teste", voz: {}, respiracao: 0.2, cauda: 0.12, ...roteiro,
    blocos: [{ id: "b1", linhas: linhas.map((fs, i) => ({ id: `l${i + 1}`, texto: fs.map((k) => textoDe(frases[k])).join(" ") })) }],
  }));
  const partes = [silencio(0.5)], linhasTomada = [], palavras = [], medidas = [];
  let t = 0.5;
  for (const f of frases) {
    const ini = t;
    f.partes.forEach((parte, n) => {
      if (n) { partes.push(silencio(f.pausa ?? 0.4)); t += f.pausa ?? 0.4; }
      parte.palavras.split(" ").forEach((w, i) => {
        if (i) { partes.push(silencio(0.1)); t += 0.1; }
        palavras.push({ word: w, start: +t.toFixed(3), end: +(t + 0.5).toFixed(3) });
        partes.push(tom(parte.freq, 0.5, parte.amp)); t += 0.5;
      });
    });
    linhasTomada.push({ text: textoDe(f), start: +ini.toFixed(3), end: +t.toFixed(3) });
    medidas.push({ termina_st: -6, variacao_st: 5, silabas_s: 4 });
    partes.push(silencio(1.0)); t += 1.0;
  }
  const tomadas = join(pasta, "vozes", "tomadas");
  escreverWav(join(tomadas, "b1-1.wav"), juntar(...partes));
  writeFileSync(join(tomadas, "b1-1.lines.json"), JSON.stringify(linhasTomada));
  writeFileSync(join(tomadas, "b1-1.words.json"), JSON.stringify(palavras));
  writeFileSync(join(tomadas, "b1-1.medida.json"), JSON.stringify({ linhas: medidas, sinais: [] }));
  return pasta;
}

function montar(pasta, audio, ...extra) {
  const r = spawnSync(process.execPath, [join(pasta, "vozes", "montar.mjs"), "--audio", audio, ...extra], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const saida = join(pasta, "film", audio);
  const plano = JSON.parse(readFileSync(join(saida, "vo.plano.json"), "utf8"));
  return { saida, stdout: r.stdout, plano, trechos: plano.flatMap((f) => f.trechos ?? []) };
}

// A régua do S4 (scripts/ouvir.py, "S4 mixagem enxuta"): trechos de fala = palavras com menos de 0,30 s entre
// elas; só valem os de 0,40 s ou mais; nível = RMS em dB do trecho; a diferença é a do mais alto para o mais baixo.
function reguaS4(saida, esperados) {
  const { amostras } = lerWav(join(saida, "vo.wav"));
  const falas = [];
  for (const w of JSON.parse(readFileSync(join(saida, "vo.words.json"), "utf8"))) {
    if (falas.length && w.start - falas.at(-1)[1] < 0.30) falas.at(-1)[1] = Math.max(falas.at(-1)[1], w.end);
    else falas.push([w.start, w.end]);
  }
  const niveis = falas.filter(([a, b]) => b - a >= 0.40).map(([a, b]) => rmsDb(amostras, a, b));
  assert.equal(niveis.length, esperados, `trechos que o S4 mede em ${saida}`);
  return Math.max(...niveis) - Math.min(...niveis);
}
// O número que o montar.mjs imprime como "depois" é o do S4.
const depoisImpresso = (stdout) => Number(/([\d.]+) dB depois/.exec(stdout)[1]);

test("o limite do S4 foi lido do ouvir.py", () => assert.equal(LIMITE_S4, 4));

test("só LUFS deixa as frases fora do limite do S4; com o ganho fino caem abaixo dele", () => {
  const pasta = criarProjeto("tons", TONS);
  // Controle: --fino 0 desliga o ganho fino, que é o que o montar.mjs fazia antes.
  const sem = montar(pasta, "sem-fino", "--fino", "0");
  const espalhamentoSem = reguaS4(sem.saida, 4);
  assert.ok(espalhamentoSem > LIMITE_S4, `premissa do teste: só em LUFS as frases devem variar mais que ${LIMITE_S4} dB (deu ${espalhamentoSem.toFixed(2)} dB)`);

  const com = montar(pasta, "com-fino");
  const espalhamentoCom = reguaS4(com.saida, 4);
  assert.ok(espalhamentoCom < LIMITE_S4, `depois do nivelamento: ${espalhamentoCom.toFixed(2)} dB, limite do S4 ${LIMITE_S4} dB`);
  assert.ok(espalhamentoCom < 0.5, `o ganho leva cada trecho à mediana: ${espalhamentoCom.toFixed(2)} dB`);
  assert.ok(Math.abs(depoisImpresso(com.stdout) - espalhamentoCom) < 0.2, `impresso ${depoisImpresso(com.stdout)} dB, S4 ${espalhamentoCom.toFixed(2)} dB`);

  // O plano grava os trechos do S4 de cada frase, com o RMS falado de antes e o ganho fino; o ganho respeita 4 dB.
  assert.equal(com.plano.length, 4);
  assert.equal(com.trechos.length, 4);
  for (const t of com.trechos) {
    assert.equal(typeof t.rmsFalado, "number");
    assert.ok(Math.abs(t.ganhoFino) <= 4 + 1e-9, `ganho fino do trecho de ${t.de} s: ${t.ganhoFino}`);
  }
  const rms = com.trechos.map((t) => t.rmsFalado).sort((a, b) => a - b);
  assert.ok(rms.at(-1) - rms[0] > LIMITE_S4, "o plano guarda o RMS falado de antes do ganho fino");
  assert.ok(com.trechos.some((t) => t.ganhoFino > 0.3) && com.trechos.some((t) => t.ganhoFino < -0.3), "uns sobem, outros descem");
  // Cada trecho aparece com o seu ganho na saída do comando.
  for (const f of com.plano) for (const t of f.trechos) {
    assert.match(com.stdout, new RegExp(`${f.bloco}\\s+${f.linha} f${f.frase}\\s+${t.de.toFixed(2)} a ${t.ate.toFixed(2)} s\\s+RMS falado -?[\\d.]+ dB\\s+ganho fino [+-][\\d.]+ dB`));
  }
  assert.match(com.stdout, /espalhamento do RMS falado: [\d.]+ dB antes, [\d.]+ dB depois/);
  // O ganho fino não muda os tempos: as palavras são as mesmas dos dois lados.
  assert.deepEqual(JSON.parse(readFileSync(join(com.saida, "vo.words.json"), "utf8")), JSON.parse(readFileSync(join(sem.saida, "vo.words.json"), "utf8")));
});

test("frase com pausa de 0,30 s ou mais no meio: o ganho vale por trecho, como no S4", () => {
  const pasta = criarProjeto("pausa-no-meio", PAUSA_NO_MEIO);
  const sem = montar(pasta, "sem-fino", "--fino", "0");
  const espalhamentoSem = reguaS4(sem.saida, 5);   // 3 frases de 1 trecho e 1 frase de 2 trechos
  assert.ok(espalhamentoSem > LIMITE_S4, `premissa: as 2 metades da mesma frase variam ${espalhamentoSem.toFixed(2)} dB, mais que ${LIMITE_S4} dB`);

  const com = montar(pasta, "com-fino");
  const espalhamentoCom = reguaS4(com.saida, 5);
  assert.ok(espalhamentoCom < LIMITE_S4, `depois do nivelamento: ${espalhamentoCom.toFixed(2)} dB, limite do S4 ${LIMITE_S4} dB`);
  assert.ok(espalhamentoCom < 0.5, `cada trecho na mediana: ${espalhamentoCom.toFixed(2)} dB`);
  assert.ok(Math.abs(depoisImpresso(com.stdout) - espalhamentoCom) < 0.2, `impresso ${depoisImpresso(com.stdout)} dB, S4 ${espalhamentoCom.toFixed(2)} dB`);
  // A frase 2 tem 2 trechos, com ganhos de sinais opostos.
  assert.equal(com.plano[1].trechos.length, 2);
  const [alto, baixo] = com.plano[1].trechos;
  assert.ok(alto.ganhoFino < -1 && baixo.ganhoFino > 1, `ganhos da frase 2: ${alto.ganhoFino} e ${baixo.ganhoFino} dB`);
  assert.ok(baixo.de - alto.ate >= 0.30, "a pausa entre os 2 trechos tem 0,30 s ou mais");
  // A troca de ganho acontece dentro da pausa: a pausa continua muda e as pontas dos trechos ficam inteiras.
  const { amostras } = lerWav(join(com.saida, "vo.wav"));
  assert.ok(rmsDb(amostras, alto.ate + 0.02, baixo.de - 0.02) < -100, "a pausa continua muda");
});

test("trecho que junta 2 frases (pausa entre elas abaixo de 0,30 s) recebe um ganho só", () => {
  // Respiração e cauda curtas e pausa de frase de 0,2 s: as frases 1 e 2 (mesma linha) ficam a 0,2 s uma da outra.
  const pasta = criarProjeto("junta-frases", TONS, { linhas: [[0, 1], [2], [3]], roteiro: { respiracao: 0.05, cauda: 0.05, pausas: { frase: 0.2, linha: 0.6 } } });
  const sem = montar(pasta, "sem-fino", "--fino", "0");
  const espalhamentoSem = reguaS4(sem.saida, 3);   // frases 1 e 2 formam 1 trecho
  assert.ok(espalhamentoSem > LIMITE_S4, `premissa: ${espalhamentoSem.toFixed(2)} dB só em LUFS`);
  const com = montar(pasta, "com-fino");
  const espalhamentoCom = reguaS4(com.saida, 3);
  assert.ok(espalhamentoCom < 0.5, `depois do nivelamento: ${espalhamentoCom.toFixed(2)} dB`);
  assert.ok(Math.abs(depoisImpresso(com.stdout) - espalhamentoCom) < 0.2, `impresso ${depoisImpresso(com.stdout)} dB, S4 ${espalhamentoCom.toFixed(2)} dB`);
  assert.equal(com.trechos.length, 3);
  assert.deepEqual(com.plano.map((f) => f.trechos.length), [1, 0, 1, 1], "o trecho que junta as frases 1 e 2 fica com a frase onde começa");
  assert.ok(com.trechos[0].ate - com.trechos[0].de > 3.5, "um trecho só cobre as 2 frases");
});

test("--fino limita o ganho de cada trecho", () => {
  const curto = montar(criarProjeto("fino-1", TONS), "fino-1", "--fino", "1");
  for (const t of curto.trechos) assert.ok(Math.abs(t.ganhoFino) <= 1 + 1e-9, `ganho fino do trecho de ${t.de} s: ${t.ganhoFino}`);
  assert.ok(curto.trechos.some((t) => Math.abs(t.ganhoFino) > 0.9), "algum trecho bate no limite de 1 dB");
  assert.ok(reguaS4(curto.saida, 4) > 0, "com o limite curto sobra diferença");
  assert.ok(curto.trechos.some((t) => t.limite === "máximo"));
});
