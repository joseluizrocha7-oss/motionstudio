import assert from "node:assert/strict";
import test from "node:test";
import { quebrarTexto, temposDosPedacos, ajustarDuracoes, legendasDoFilme, LIMITES, paraSrt, lerSrt, paraAss } from "../kit/gerar-legenda.mjs";

test("quebrarTexto equilibra 2 linhas", () => {
  assert.deepEqual(quebrarTexto("Boas-vindas ao fluxo completo do sistema da empresa!"),
    ["Boas-vindas ao fluxo completo\ndo sistema da empresa!"]);
});
test("quebrarTexto corta na pontuação e não deixa palavra curta no fim da linha", () => {
  assert.deepEqual(quebrarTexto("Para a operadora que não manda arquivo, o Lançar em lote mostra as parcelas do mês, e marcamos as que vieram no demonstrativo."),
    ["Para a operadora que não manda arquivo,", "o Lançar em lote mostra\nas parcelas do mês,", "e marcamos as que vieram no demonstrativo."]);
});
test("quebrarTexto deixa palavra longa sozinha", () => {
  assert.deepEqual(quebrarTexto("Acesse https://exemplo.com.br/um/caminho/muito/longo/para/o/teste agora"),
    ["Acesse", "https://exemplo.com.br/um/caminho/muito/longo/para/o/teste", "agora"]);
});
test("quebrarTexto mantém frase curta", () => assert.deepEqual(quebrarTexto("Curta."), ["Curta."]));
test("temposDosPedacos usa o tempo das palavras", () => {
  const p = [{ w: "um", a: 1, b: 1.5 }, { w: "dois", a: 1.6, b: 2 }, { w: "três", a: 2.1, b: 3 }, { w: "quatro", a: 3.2, b: 5 }];
  assert.deepEqual(temposDosPedacos(["um dois", "três quatro"], { a: 1, b: 5 }, p),
    [{ a: 1, b: 2, texto: "um dois" }, { a: 2.1, b: 5, texto: "três quatro" }]);
});
test("temposDosPedacos reparte pelas letras sem palavras", () => {
  assert.deepEqual(temposDosPedacos(["abcde", "abcdefghijklmno"], { a: 10, b: 20 }, null),
    [{ a: 10, b: 12.5, texto: "abcde" }, { a: 12.5, b: 20, texto: "abcdefghijklmno" }]);
});
test("ajustarDuracoes estende até 1 s sem passar do próximo", () => {
  assert.deepEqual(ajustarDuracoes([{ a: 0, b: 0.4, texto: "a" }, { a: 0.5, b: 2, texto: "b" }, { a: 5, b: 5.2, texto: "c" }]),
    [{ a: 0, b: 0.45, texto: "a" }, { a: 0.5, b: 2, texto: "b" }, { a: 5, b: 6, texto: "c" }]);
});
const roteiro = { blocos: [{ linhas: [
  { id: "x1", texto: "O CRM chega.", fala: "O cê érre ême chega." },
  { id: "x2", texto: "Fim." },
] }] };
test("legendasDoFilme usa o texto quando a fala difere", () => {
  const fala = { offset: 0.4, linhas: [{ l: "x1", a: 1, b: 3, t: "O cê érre ême chega." }, { l: "x2", a: 3.5, b: 4.6, t: "Fim." }],
    palavras: [{ l: "x2", w: "Fim.", a: 3.5, b: 4.6 }] };
  assert.deepEqual(legendasDoFilme(roteiro, fala), [{ a: 1, b: 3, texto: "O CRM chega." }, { a: 3.5, b: 4.6, texto: "Fim." }]);
});
test("legendasDoFilme pula a linha que não está na fala", () => {
  const fala = { offset: 0.4, linhas: [{ l: "x2", a: 3.5, b: 4.6, t: "Fim." }], palavras: [] };
  assert.deepEqual(legendasDoFilme(roteiro, fala), [{ a: 3.5, b: 4.6, texto: "Fim." }]);
});

// Casos de borda além do plano.
test("temposDosPedacos reparte pelas letras quando as palavras não batem com o texto", () => {
  const dif = [{ w: "um", a: 1, b: 1.5 }, { w: "dois", a: 1.6, b: 2 }];   // mesmo número de palavras, texto diferente
  assert.deepEqual(temposDosPedacos(["um", "tres"], { a: 0, b: 6 }, dif),
    [{ a: 0, b: 2, texto: "um" }, { a: 2, b: 6, texto: "tres" }]);
  const mais = [{ w: "abc", a: 1, b: 2 }, { w: "def", a: 2, b: 3 }, { w: "ghi", a: 3, b: 4 }];   // número de palavras diferente
  assert.deepEqual(temposDosPedacos(["abc", "defghi"], { a: 0, b: 12 }, mais),
    [{ a: 0, b: 4, texto: "abc" }, { a: 4, b: 12, texto: "defghi" }]);
});
test("legendasDoFilme junta as frases da fala com o mesmo l", () => {
  const r = { blocos: [{ linhas: [{ id: "y1", texto: "Um dois. Três quatro." }] }] };
  const fala = { offset: 0, linhas: [{ l: "y1", a: 2, b: 3, t: "Um dois." }, { l: "y1", a: 3.5, b: 5, t: "Três quatro." }], palavras: [] };
  assert.deepEqual(legendasDoFilme(r, fala), [{ a: 2, b: 5, texto: "Um dois. Três quatro." }]);
});
test("quebrarTexto não perde palavra quando nenhuma quebra cabe em 42", () => {
  const t = `${"a".repeat(10)} ${"b".repeat(42)} ${"c".repeat(22)}`;
  const saida = quebrarTexto(t).join("\n").split(/\s+/);
  assert.deepEqual(saida, t.split(" "));
});

test("paraSrt numera e formata o tempo", () => {
  assert.equal(paraSrt([{ a: 1.5, b: 3.25, texto: "Olá\nmundo" }]), "1\n00:00:01,500 --> 00:00:03,250\nOlá\nmundo\n\n");
});
test("lerSrt desfaz paraSrt, também com CRLF", () => {
  const b = [{ a: 61.5, b: 62.25, texto: "R$ 600,00 menos\nR$ 500,00" }];
  assert.deepEqual(lerSrt(paraSrt(b).replace(/\n/g, "\r\n")), b);
});
test("paraAss no 16x9 usa 1920x1080 e a cor da caixa", () => {
  const s = paraAss([{ a: 0, b: 1, texto: "a\nb" }], { formato: "16x9", corCaixa: "#032B6B" });
  assert.match(s, /PlayResX: 1920/); assert.match(s, /PlayResY: 1080/);
  assert.match(s, /&H266B2B03/);                       // #032B6B com 85% de opacidade
  assert.match(s, /Dialogue: 0,0:00:00\.00,0:00:01\.00,Legenda,,0,0,0,,a\\Nb/);
});
test("paraAss no 9x16 usa 1080x1920 e margem de 260", () => {
  const s = paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "9x16" });
  assert.match(s, /PlayResX: 1080/); assert.match(s, /PlayResY: 1920/); assert.match(s, /,260,/);
});

const maiorLinha = (blocos) => Math.max(...blocos.flatMap((b) => b.texto.split("\n").map((l) => l.length)));
test("quebrarTexto com o limite do 9x16 quebra frase de 41 caracteres em linhas de até 32", () => {
  const t = "O cliente recebe a proposta e assina hoje";
  assert.equal(t.length, 41);
  assert.deepEqual(quebrarTexto(t), [t]);                                         // 16x9: cabe em 1 linha
  const q = quebrarTexto(t, LIMITES["9x16"]);
  assert.equal(q.length, 1);
  assert.ok(maiorLinha(q.map((texto) => ({ texto }))) <= LIMITES["9x16"].maxLinha);
  assert.equal(q[0].replace("\n", " "), t);                                       // só trocou um espaço por quebra
});
test("legendasDoFilme no 9x16 não passa de 32 caracteres por linha e no 16x9 passa de 32", () => {
  const texto = "Para a operadora que não manda arquivo, o Lançar em lote mostra as parcelas do mês e marcamos as que vieram no demonstrativo.";
  const r = { blocos: [{ linhas: [{ id: "l1", texto }] }] };
  const fala = { offset: 0, linhas: [{ l: "l1", a: 1, b: 9, t: texto }], palavras: [] };
  assert.ok(maiorLinha(legendasDoFilme(r, fala, { formato: "9x16" })) <= LIMITES["9x16"].maxLinha);
  assert.ok(maiorLinha(legendasDoFilme(r, fala, { formato: "16x9" })) > LIMITES["9x16"].maxLinha);
  assert.deepEqual(legendasDoFilme(r, fala), legendasDoFilme(r, fala, { formato: "16x9" }));   // 16x9 é o padrão
});
test("legendasDoFilme recusa formato desconhecido", () => {
  assert.throws(() => legendasDoFilme({ blocos: [] }, { linhas: [] }, { formato: "4x3" }), /formato inválido: "4x3"/);
});
