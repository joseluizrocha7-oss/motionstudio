import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { quebrarTexto, temposDosPedacos, ajustarDuracoes, legendasDoFilme, LIMITES, paraSrt, lerSrt, paraAss, paraJs, lerFala, margemBaixoMaxima } from "../kit/gerar-legenda.mjs";

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
// Campos da linha "Style:" por nome (a ordem é a do "Format:" do próprio .ass).
function campos(ass) {
  const nomes = /^Format: (Name, Fontname.*)$/m.exec(ass)[1].split(", ");
  const valores = /^Style: (.*)$/m.exec(ass)[1].split(",");
  assert.equal(valores.length, nomes.length, "a linha Style tem que ter um valor por campo do Format");
  return Object.fromEntries(nomes.map((n, i) => [n, valores[i]]));
}

test("paraAss no 16x9 usa 1920x1080 e a cor da caixa (tipo caixa)", () => {
  const s = paraAss([{ a: 0, b: 1, texto: "a\nb" }], { formato: "16x9", tipo: "caixa", corCaixa: "#032B6B" });
  assert.match(s, /PlayResX: 1920/); assert.match(s, /PlayResY: 1080/);
  assert.match(s, /&H266B2B03/);                       // #032B6B com 85% de opacidade
  assert.match(s, /Dialogue: 0,0:00:00\.00,0:00:01\.00,Legenda,,0,0,0,,a\\Nb/);
});
test("paraAss tipo caixa: BorderStyle 3, Outline 14, Shadow 0 e a caixa na OutlineColour e na BackColour", () => {
  const c = campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9", tipo: "caixa" }));
  assert.equal(c.BorderStyle, "3"); assert.equal(c.Outline, "14"); assert.equal(c.Shadow, "0");
  assert.equal(c.PrimaryColour, "&H00FFFFFF");
  assert.equal(c.OutlineColour, "&H26111111");         // #111111 com 85% de opacidade
  assert.equal(c.BackColour, "&H26111111");
});
test("paraAss sem tipo é contorno: BorderStyle 1, texto branco, contorno preto opaco e sombra suave", () => {
  const c = campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9" }));
  assert.equal(c.BorderStyle, "1");
  assert.equal(c.PrimaryColour, "&H00FFFFFF");
  assert.equal(c.OutlineColour, "&H00000000");         // preto, opaco
  assert.equal(c.BackColour, "&H80000000");            // sombra: preto a cerca de 50%
  assert.deepEqual(campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9", tipo: "contorno" })), c);
});
test("paraAss contorno: corTexto e corContorno entram na ordem BGR do ASS; a caixa não aparece", () => {
  const s = paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9", tipo: "contorno", corTexto: "#FFEE00", corContorno: "#032B6B" });
  const c = campos(s);
  assert.equal(c.PrimaryColour, "&H0000EEFF");
  assert.equal(c.OutlineColour, "&H006B2B03");         // #032B6B opaco
  assert.equal(c.BorderStyle, "1");
  assert.ok(!s.includes("&H266B2B03"), "não sobra cor de caixa");
});
test("paraAss contorno: contorno, sombra e espaço entre letras por formato (16x9 = 2, 1 e 1,5; 9x16 = 2,7, 1,35 e 2); a margem e a fonte seguem iguais", () => {
  const c16 = campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9" }));
  assert.equal(c16.Outline, "2"); assert.equal(c16.Shadow, "1"); assert.equal(c16.Spacing, "1.5");
  assert.equal(c16.Fontsize, "40"); assert.equal(c16.MarginV, "30");
  const c9 = campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "9x16" }));
  assert.equal(c9.Outline, "2.7"); assert.equal(c9.Shadow, "1.35"); assert.equal(c9.Spacing, "2");
  assert.equal(c9.Fontsize, "54"); assert.equal(c9.MarginV, "260");
});
test("paraAss contorno: borda suave (blur) no começo de cada fala; a caixa não leva", () => {
  const blocos = [{ a: 0, b: 1, texto: "a\nb" }, { a: 1, b: 2, texto: "c" }];
  const textos = (ass) => ass.split("\n").filter((l) => l.startsWith("Dialogue:")).map((l) => l.split(",,0,0,0,,")[1]);
  assert.deepEqual(textos(paraAss(blocos, { formato: "16x9" })), ["{\\blur0.8}a\\Nb", "{\\blur0.8}c"]);
  assert.deepEqual(textos(paraAss(blocos, { formato: "9x16" })), ["{\\blur1.1}a\\Nb", "{\\blur1.1}c"]);
  const caixa = paraAss(blocos, { formato: "16x9", tipo: "caixa" });
  assert.deepEqual(textos(caixa), ["a\\Nb", "c"]);       // a caixa fica como era: sem blur e sem espaço extra
  assert.equal(campos(caixa).Spacing, "0");
});
test("paraAss recusa tipo desconhecido e cor inválida do contorno", () => {
  assert.throws(() => paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9", tipo: "borda" }), /tipo.*"borda".*contorno.*caixa/);
  assert.throws(() => paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "16x9", corContorno: "azul" }), /cor inválida: "azul"/);
});
test("paraAss põe WrapStyle 2 no [Script Info] nos 2 formatos e nos 2 tipos (o libass não requebra a linha do kit)", () => {
  for (const formato of ["16x9", "9x16"]) {
    for (const tipo of ["contorno", "caixa"]) {
      const s = paraAss([{ a: 0, b: 1, texto: "a\nb" }], { formato, tipo });
      const info = s.slice(s.indexOf("[Script Info]"), s.indexOf("[V4+ Styles]"));
      assert.match(info, /^WrapStyle: 2$/m, `${formato} ${tipo}`);
    }
  }
});
test("paraAss no 9x16 usa 1080x1920 e margem de 260", () => {
  const s = paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "9x16" });
  assert.match(s, /PlayResX: 1080/); assert.match(s, /PlayResY: 1920/); assert.match(s, /,260,/);
});
test("paraAss: margemBaixo chega ao MarginV da linha Style, nos 2 formatos e nos 2 tipos; sem ela o padrão fica (30 e 260)", () => {
  for (const [formato, padrao] of [["16x9", "30"], ["9x16", "260"]]) {
    for (const tipo of ["contorno", "caixa"]) {
      const b = [{ a: 0, b: 1, texto: "a" }];
      assert.equal(campos(paraAss(b, { formato, tipo, margemBaixo: 500 })).MarginV, "500", `${formato} ${tipo}`);
      assert.equal(campos(paraAss(b, { formato, tipo })).MarginV, padrao, `${formato} ${tipo}: o padrão não muda`);
    }
  }
  // 0 é margem válida (texto colado na borda) e não cai no padrão.
  assert.equal(campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "9x16", margemBaixo: 0 })).MarginV, "0");
  // A margem de baixo não mexe nas outras: lateral, fonte e alinhamento seguem iguais.
  const c = campos(paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "9x16", margemBaixo: 420 }));
  assert.equal(c.MarginL, "80"); assert.equal(c.MarginR, "80"); assert.equal(c.Fontsize, "54"); assert.equal(c.Alignment, "2");
});
test("paraAss recusa margemBaixo que não é número inteiro de pixels (0 ou mais)", () => {
  for (const ruim of [-1, NaN, Infinity, "500", "", null, 420.5, 0.5]) {
    assert.throws(() => paraAss([{ a: 0, b: 1, texto: "a" }], { formato: "9x16", margemBaixo: ruim }), /margemBaixo inválida.*número inteiro de pixels/, String(ruim));
  }
});
test("margemBaixoMaxima: a maior margem inteira em que o bloco cabe no quadro (linhas x fonte + contorno ou folga da caixa < altura da grade)", () => {
  // 9x16: fonte 54, contorno 2,7, grade 1920. 1 linha: 1920 - 54 - 2,7 = 1863,3; 2 linhas: 1809,3; 3: 1755,3.
  assert.equal(margemBaixoMaxima("9x16", "contorno", 1), 1863);
  assert.equal(margemBaixoMaxima("9x16", "contorno", 2), 1809);
  assert.equal(margemBaixoMaxima("9x16", "contorno", 3), 1755);
  // caixa: folga de 14 px (número inteiro: a margem tem que ficar abaixo de 1798, então 1797).
  assert.equal(margemBaixoMaxima("9x16", "caixa", 2), 1797);
  // 16x9: fonte 40, contorno 2, grade 1080: 1080 - 40 - 2 = 1038, então 1037.
  assert.equal(margemBaixoMaxima("16x9", "contorno", 1), 1037);
  // A margem máxima + o bloco cabe; um pixel a mais não: 1809 + 108 + 2,7 < 1920 <= 1810 + 108 + 2,7.
  assert.ok(1809 + 2 * 54 + 2.7 < 1920 && 1810 + 2 * 54 + 2.7 >= 1920);
  assert.throws(() => margemBaixoMaxima("4x3", "contorno", 1), /formato inválido: "4x3"/);
  assert.throws(() => margemBaixoMaxima("9x16", "borda", 1), /tipo de legenda inválido: "borda"/);
});

const maiorLinha = (blocos) => Math.max(...blocos.flatMap((b) => b.texto.split("\n").map((l) => l.length)));
test("quebrarTexto com o limite do 9x16 quebra frase de 41 caracteres em linhas de até 28", () => {
  const t = "O cliente recebe a proposta e assina hoje";
  assert.equal(t.length, 41);
  assert.deepEqual(quebrarTexto(t), [t]);                                         // 16x9: cabe em 1 linha
  const q = quebrarTexto(t, LIMITES["9x16"]);
  assert.equal(q.length, 1);
  assert.ok(maiorLinha(q.map((texto) => ({ texto }))) <= LIMITES["9x16"].maxLinha);
  assert.equal(q[0].replace("\n", " "), t);                                       // só trocou um espaço por quebra
});
test("legendasDoFilme no 9x16 não passa de 28 caracteres por linha e no 16x9 passa de 28", () => {
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

// Sem palavra sozinha no fim da frase: o último pedaço não fica com menos de 1/3 do maxPedaco.
const compridoDe = (pedaco) => pedaco.replace(/\n/g, " ").length;
const palavrasDos = (pedacos) => pedacos.join(" ").split(/\s+/);
test("quebrarTexto no 16x9 não deixa 1 palavra sozinha no fim da frase", () => {
  const t = "O painel mostra cada pedido novo da loja e avisa o cliente quando a entrega chega.";
  assert.equal(t.length, 82);                                                      // o corte guloso em 76 deixaria só "chega."
  const q = quebrarTexto(t);
  assert.equal(q.length, 2);
  for (const p of q) assert.ok(compridoDe(p) >= 25, `pedaço curto: "${p}"`);
  assert.deepEqual(palavrasDos(q), t.split(" "));                                  // nenhuma palavra se perdeu
  for (const p of q) assert.ok(p.split("\n").every((l) => l.length <= LIMITES["16x9"].maxLinha));
});
test("quebrarTexto no 9x16 não deixa palavra sozinha no fim da frase", () => {
  const t = "O aplicativo mostra cada pedido novo da loja e confirma.";
  assert.equal(t.length, 56);                                                      // o corte guloso em 48 deixaria só "confirma."
  const q = quebrarTexto(t, LIMITES["9x16"]);
  assert.equal(q.length, 2);
  for (const p of q) assert.ok(compridoDe(p) >= 16, `pedaço curto: "${p}"`);
  assert.deepEqual(palavrasDos(q), t.split(" "));
  for (const p of q) assert.ok(p.split("\n").every((l) => l.length <= LIMITES["9x16"].maxLinha));
});
test("quebrarTexto refaz o corte também quando o corte era na pontuação", () => {
  const t = "Primeiro o sistema confere todos os lançamentos pendentes do mês anterior, depois fecha tudo agora.";
  const q = quebrarTexto(t);                                                       // o corte na vírgula deixaria 24 caracteres
  assert.equal(q.length, 2);
  for (const p of q) assert.ok(compridoDe(p) >= 25, `pedaço curto: "${p}"`);
  assert.deepEqual(palavrasDos(q), t.split(" "));
});

// "R$" fica na mesma linha do número, em pedaço e em linha; o tempo continua pelas palavras da fala.
const semPrefixoNoFim = (pedacos) => pedacos.every((p) => p.split("\n").every((l) => !/(R\$|US\$|€|nº)$/.test(l)));
test("quebrarTexto no 16x9 não separa R$ do valor (quebra de linha)", () => {
  const t = "Feche o pedido e anote a dívida de R$ 600,00 em aberto no sistema da loja.";
  const q = quebrarTexto(t);
  assert.ok(semPrefixoNoFim(q), `R$ ficou no fim da linha: ${JSON.stringify(q)}`);
  assert.ok(q.join(" ").includes("R$ 600,00"), "o texto sai com espaço comum, não com NBSP");
  assert.ok(!q.join("").includes("\u00A0"), "nenhum NBSP no texto de saída");
  assert.deepEqual(palavrasDos(q), t.split(" "));
});
test("quebrarTexto no 9x16 não separa R$ do valor (quebra de pedaço)", () => {
  for (const t of ["Confira o extrato do mês e anote o total de R$ 600,00 em aberto no sistema.",
    "O cliente recebe a proposta e paga o total de R$ 600,00 em aberto no sistema."]) {
    const q = quebrarTexto(t, LIMITES["9x16"]);
    assert.ok(semPrefixoNoFim(q), `R$ ficou no fim: ${JSON.stringify(q)}`);
    assert.ok(q.some((p) => p.includes("R$ 600,00")), `R$ e o valor na mesma linha: ${JSON.stringify(q)}`);
    assert.ok(!q.join("").includes("\u00A0"));
    assert.deepEqual(palavrasDos(q), t.split(" "));
    for (const p of q) assert.ok(p.split("\n").every((l) => l.length <= LIMITES["9x16"].maxLinha));
  }
});
test("quebrarTexto une US$, € e nº ao número; prefixo no fim do texto fica como está", () => {
  const t = "Confira o extrato do mês e anote o total de US$ 600,00 em aberto no sistema.";
  assert.ok(semPrefixoNoFim(quebrarTexto(t, LIMITES["9x16"])));
  assert.ok(quebrarTexto(t, LIMITES["9x16"]).some((p) => p.includes("US$ 600,00")));
  const u = "Confira o extrato do mês e anote o total de € 600,00 em aberto no sistema.";
  assert.ok(quebrarTexto(u, LIMITES["9x16"]).some((p) => p.includes("€ 600,00")));
  const n = "O cliente recebe a proposta e paga o total de nº 1234 em aberto no sistema.";
  assert.ok(semPrefixoNoFim(quebrarTexto(n, LIMITES["9x16"])));
  assert.ok(quebrarTexto(n, LIMITES["9x16"]).some((p) => p.includes("nº 1234")));
  assert.deepEqual(quebrarTexto("Total em R$"), ["Total em R$"]);
});
test("legendasDoFilme com R$ ainda usa o tempo das palavras, não o das letras", () => {
  // Um texto por formato: nos 2 a quebra sem a união do R$ separaria o prefixo do valor.
  const textos = { "16x9": "Feche o pedido e anote a dívida de R$ 600,00 em aberto no sistema da loja.",
    "9x16": "Confira o extrato do mês e anote o total de R$ 600,00 em aberto no sistema." };
  for (const formato of ["16x9", "9x16"]) {
    const texto = textos[formato];
    const ws = texto.split(" ");
    // 1 s por palavra, com um vão de 1 s antes de cada uma: reparto por letras não daria estes tempos.
    const palavras = ws.map((w, i) => ({ l: "p1", w, a: 10 + i * 2, b: 11 + i * 2 }));
    const r = { blocos: [{ linhas: [{ id: "p1", texto }] }] };
    const fala = { offset: 0, linhas: [{ l: "p1", a: 10, b: 11 + (ws.length - 1) * 2, t: texto }], palavras };
    const blocos = legendasDoFilme(r, fala, { formato });
    const ini = new Set(palavras.map((p) => p.a)), fim = new Set(palavras.map((p) => p.b));
    for (const b of blocos) assert.ok(ini.has(b.a) && fim.has(b.b), `${formato}: tempo fora das palavras: ${JSON.stringify(b)}`);
    assert.equal(blocos[0].a, 10);
    assert.equal(blocos.at(-1).b, 11 + (ws.length - 1) * 2);
    assert.ok(blocos.some((b) => b.texto.includes("R$ 600,00")));
  }
  // temposDosPedacos direto: os pedaços já saem com espaço comum, e "R$" e "600,00" contam 2 palavras da fala.
  const p3 = [{ w: "Valor", a: 1, b: 2 }, { w: "R$", a: 2, b: 2.5 }, { w: "600,00", a: 2.6, b: 4 }];
  assert.deepEqual(temposDosPedacos(["Valor R$ 600,00"], { a: 0, b: 9 }, p3), [{ a: 1, b: 4, texto: "Valor R$ 600,00" }]);
});

test("paraAss usa a fonte Inter Variable", () => {
  for (const formato of ["16x9", "9x16"]) {
    const s = paraAss([{ a: 0, b: 1, texto: "a" }], { formato });
    assert.match(s, /^Style: Legenda,Inter Variable,/m);
  }
});

// Comando: roda o gerar-legenda.mjs de verdade, numa pasta de projeto inventada.
const GERAR = join(dirname(fileURLToPath(import.meta.url)), "..", "kit", "gerar-legenda.mjs");
function projetoInventado({ falaIds = ["a1"] } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), "legenda-cli-"));
  mkdirSync(join(pasta, "film", "assets"), { recursive: true });
  writeFileSync(join(pasta, "roteiro.json"), JSON.stringify({ blocos: [{ linhas: [{ id: "a1", texto: "Olá, este é um teste de legenda." }] }] }));
  const fala = { offset: 0, linhas: falaIds.map((l, i) => ({ l, a: 1 + i * 3, b: 3 + i * 3, t: "Olá." })), palavras: [] };
  writeFileSync(join(pasta, "film", "assets", "fala.js"), `window.FALA = ${JSON.stringify(fala)};\n`);
  return pasta;
}
const rodar = (pasta, args) => spawnSync(process.execPath, [GERAR, ...args], { cwd: pasta, encoding: "utf8" });

test("gerar-legenda: a saída padrão leva o formato no nome", () => {
  const pasta = projetoInventado();
  try {
    let r = rodar(pasta, []);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(pasta, "film", "legenda-16x9.srt")));
    r = rodar(pasta, ["--formato", "9x16"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(pasta, "film", "legenda-9x16.srt")));
    assert.ok(!existsSync(join(pasta, "film", "legenda.srt")), "o nome antigo não existe mais");
    assert.match(r.stdout, /legenda: 1 blocos em film\/legenda-9x16\.srt/);
    // --saida explícito vale mais que o padrão.
    r = rodar(pasta, ["--saida", "outra/pasta/x.srt"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(pasta, "outra", "pasta", "x.srt")));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
test("gerar-legenda recusa opção desconhecida, --x=y, valor que falta e argumento solto (código 1, nada gravado)", () => {
  const pasta = projetoInventado();
  try {
    const casos = [
      [["--format", "9x16"], /opção desconhecida: --format/],
      [["--formato=9x16"], /--formato 9x16/],
      [["--formato"], /falta o valor de --formato/],
      [["--formato", "--saida", "x.srt"], /falta o valor de --formato/],
      [["9x16"], /argumento inesperado: 9x16/],
      [["--formato", "4x3"], /formato inválido: "4x3"/],
    ];
    for (const [args, erro] of casos) {
      const r = rodar(pasta, args);
      assert.equal(r.status, 1, `${args.join(" ")}: saiu com ${r.status}`);
      assert.match(r.stderr, erro, args.join(" "));
      assert.match(r.stderr, /^legenda: /);
    }
    assert.ok(!existsSync(join(pasta, "film", "legenda-16x9.srt")), "nenhum .srt foi gravado");
    assert.ok(!existsSync(join(pasta, "film", "legenda-9x16.srt")), "nenhum .srt foi gravado");
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
test("gerar-legenda sai com código 1 e não grava nada quando a fala não casa com o roteiro (0 blocos)", () => {
  const pasta = projetoInventado({ falaIds: ["outro-id"] });
  try {
    const r = rodar(pasta, []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /0 blocos/);
    assert.ok(!existsSync(join(pasta, "film", "legenda-16x9.srt")), "não pode gravar .srt vazio");
    assert.doesNotMatch(r.stdout, /blocos em/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

// ---------- modo .js: o filme desenha a legenda (--saida film/assets/legenda.js) ----------

// Roda o conteúdo de um legenda.js como o navegador roda: devolve o window que o arquivo preencheu.
// O objeto vem de outro contexto do vm (outro Object e outro Array): a cópia por JSON deixa o deepEqual comparar.
function janelaDe(codigo) {
  new vm.Script(codigo);                                   // erro de sintaxe estoura aqui
  const window = {};
  vm.runInNewContext(codigo, { window });
  assert.ok(Array.isArray(window.LEGENDA), "o arquivo tem que pôr uma lista em window.LEGENDA");
  return { LEGENDA: JSON.parse(JSON.stringify(window.LEGENDA)) };
}

test("paraJs grava window.LEGENDA com a, b e texto (\"\\n\" entre as linhas), em JS válido", () => {
  const blocos = [{ a: 1.5, b: 3.25, texto: "Olá, \"mundo\"\nda legenda \\ barra" }, { a: 4, b: 5.125, texto: "Fim." }];
  const codigo = paraJs(blocos, { formato: "9x16" });
  assert.ok(codigo.endsWith("\n"), "termina com quebra de linha");
  assert.match(codigo, /^\/\/ Gerado por gerar-legenda\.mjs \(formato 9x16\)/);
  assert.deepEqual(janelaDe(codigo).LEGENDA, blocos);       // o mesmo conteúdo, com a quebra "\n" de verdade no texto
  assert.ok(codigo.includes('"texto":"Olá, \\"mundo\\"\\nda legenda'), "a quebra de linha vai escapada, 1 bloco por linha do arquivo");
  assert.equal(codigo.split("\n").filter((l) => l.startsWith("  {")).length, 2);
});

// Projeto inventado com 2 linhas: a 1ª tem texto longo (vira vários pedaços e muda de formato para formato) e palavras com tempo; a 2ª tem "fala" própria.
function projetoComTexto() {
  const pasta = mkdtempSync(join(tmpdir(), "legenda-js-"));
  mkdirSync(join(pasta, "film", "assets"), { recursive: true });
  const texto = "Para quem manda a fatura, o painel mostra \"cada\" parcela do mês, e marca as que vieram no extrato do banco.";
  const roteiro = { blocos: [{ linhas: [{ id: "p1", texto }, { id: "p2", texto: "A CBS entra em 2033.", fala: "A cê bê ésse entra em dois mil e trinta e três." }] }] };
  const palavras = texto.split(" ").map((w, i) => ({ l: "p1", w, a: 2 + i * 0.5, b: 2.4 + i * 0.5 }));
  const fala = { offset: 0, linhas: [{ l: "p1", a: 2, b: 2.4 + (palavras.length - 1) * 0.5, t: texto }, { l: "p2", a: 30, b: 34, t: "A cê bê ésse entra em dois mil e trinta e três." }], palavras };
  writeFileSync(join(pasta, "roteiro.json"), JSON.stringify(roteiro));
  writeFileSync(join(pasta, "film", "assets", "fala.js"), `window.FALA = ${JSON.stringify(fala)};\n`);
  return pasta;
}

test("gerar-legenda --saida film/assets/legenda.js grava o .js com os mesmos blocos do .srt do mesmo formato", () => {
  const pasta = projetoComTexto();
  try {
    const porFormato = {};
    for (const formato of ["9x16", "16x9"]) {
      const js = rodar(pasta, ["--formato", formato, "--saida", `film/assets/legenda-${formato}.js`]);
      assert.equal(js.status, 0, js.stderr);
      const srt = rodar(pasta, ["--formato", formato]);
      assert.equal(srt.status, 0, srt.stderr);
      const doJs = janelaDe(readFileSync(join(pasta, "film", "assets", `legenda-${formato}.js`), "utf8")).LEGENDA;
      const doSrt = lerSrt(readFileSync(join(pasta, "film", `legenda-${formato}.srt`), "utf8"));
      assert.deepEqual(doJs, doSrt, `${formato}: o .js e o .srt têm que ter os mesmos blocos`);
      assert.match(js.stdout, new RegExp(`legenda: ${doJs.length} blocos em film/assets/legenda-${formato}\\.js`));
      porFormato[formato] = doJs;
    }
    // O 9x16 quebra em linhas de até 28 caracteres e em mais pedaços; o 16x9 em até 42. Cada formato tem o seu .js.
    const b9 = porFormato["9x16"], b16 = porFormato["16x9"];
    assert.ok(b9.length > b16.length, `o 9x16 devia ter mais pedaços (${b9.length}) que o 16x9 (${b16.length})`);
    assert.ok(maiorLinha(b9) <= LIMITES["9x16"].maxLinha && maiorLinha(b16) > LIMITES["9x16"].maxLinha);
    assert.ok(b9.some((b) => b.texto.includes("\n")), "o 9x16 tem pedaço de 2 linhas: texto com \\n");
    // Texto da tela (CBS e 2033), não a fala soletrada, e tempo da linha sem palavras (1 pedaço).
    const ultimo = b9.at(-1);
    assert.equal(ultimo.texto, "A CBS entra em 2033.");
    assert.deepEqual([ultimo.a, ultimo.b], [30, 34]);
    // Tempo pelas palavras da fala: o 1º pedaço começa na 1ª palavra (2 s).
    assert.equal(b9[0].a, 2);
    assert.ok(b9[0].texto.startsWith("Para quem manda a fatura,"));
    assert.ok(b9.some((b) => b.texto.includes('"cada"')), "as aspas do roteiro chegam ao .js");
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test("gerar-legenda --saida .js: o formato padrão é 16x9, a extensão vale em maiúscula e cria a pasta", () => {
  const pasta = projetoComTexto();
  try {
    const r = rodar(pasta, ["--saida", "novo/dir/LEGENDA.JS"]);
    assert.equal(r.status, 0, r.stderr);
    const codigo = readFileSync(join(pasta, "novo", "dir", "LEGENDA.JS"), "utf8");
    assert.match(codigo, /\(formato 16x9\)/);
    assert.deepEqual(janelaDe(codigo).LEGENDA, legendasDoFilme(
      JSON.parse(readFileSync(join(pasta, "roteiro.json"), "utf8")), lerFala(join(pasta, "film", "assets", "fala.js")), { formato: "16x9" }));
    assert.ok(!existsSync(join(pasta, "film", "legenda-16x9.srt")), "no modo .js não grava o .srt");
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test("gerar-legenda no modo .js: 0 blocos sai com código 1 e não grava nada", () => {
  const pasta = projetoInventado({ falaIds: ["outro-id"] });
  try {
    const r = rodar(pasta, ["--saida", "film/assets/legenda.js"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^legenda: /);
    assert.match(r.stderr, /0 blocos/);
    assert.ok(!existsSync(join(pasta, "film", "assets", "legenda.js")), "não pode gravar .js vazio");
    assert.doesNotMatch(r.stdout, /blocos em/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test("gerar-legenda recusa --saida que seria o próprio fala.js ou roteiro.json (o modo .js grava ao lado do fala.js)", () => {
  const pasta = projetoComTexto();
  try {
    const fala = readFileSync(join(pasta, "film", "assets", "fala.js"), "utf8");
    const roteiro = readFileSync(join(pasta, "roteiro.json"), "utf8");
    for (const saida of ["film/assets/fala.js", "./film/assets/../assets/fala.js", "roteiro.json"]) {
      const r = rodar(pasta, ["--saida", saida]);
      assert.equal(r.status, 1, `${saida}: ${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /^legenda: /);
      assert.match(r.stderr, /é o mesmo arquivo do (roteiro|fala) e sobrescreveria a entrada/);
    }
    assert.equal(readFileSync(join(pasta, "film", "assets", "fala.js"), "utf8"), fala, "o fala.js não pode mudar");
    assert.equal(readFileSync(join(pasta, "roteiro.json"), "utf8"), roteiro, "o roteiro.json não pode mudar");
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test("gerar-legenda não tem opção --js: o modo vem da extensão do --saida (opção desconhecida sai com código 1)", () => {
  const pasta = projetoComTexto();
  try {
    const r = rodar(pasta, ["--js", "film/assets/legenda.js"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /opção desconhecida: --js/);
    assert.ok(!existsSync(join(pasta, "film", "assets", "legenda.js")));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
