import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PASTA = join(dirname(fileURLToPath(import.meta.url)), "..", "library", "lottie");
const ICONES = readdirSync(PASTA).filter((f) => f.endsWith(".js") && !f.startsWith("_")).map((f) => f.slice(0, -3));

// Carrega os .js como o navegador: window é o objeto global, e cada .js registra o seu Lottie em window.LOTTIE.
function carregar(...arquivos) {
  const ctx = vm.createContext({});
  ctx.window = ctx;
  for (const a of arquivos) vm.runInContext(readFileSync(join(PASTA, a), "utf8"), ctx);
  return ctx.LOTTIE;
}
// Todos os nós de um objeto, em profundidade.
function* nos(x) {
  if (Array.isArray(x)) { for (const y of x) yield* nos(y); return; }
  if (!x || typeof x !== "object") return;
  yield x;
  for (const k in x) yield* nos(x[k]);
}
const cores = (dado) => [...nos(dado)].filter((n) => n.ty === "fl" || n.ty === "st").flatMap((n) => (n.c.a ? n.c.k.map((ch) => ch.s) : [n.c.k]));
const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

test("a biblioteca tem os 5 ícones", () => {
  for (const n of ["confirmado", "alerta", "dinheiro", "email", "documento"]) assert.ok(ICONES.includes(n), n);
});

test("cada ícone segue as regras do conjunto", () => {
  const L = carregar(...ICONES.map((n) => n + ".js"));
  for (const n of ICONES) {
    const d = L[n];
    assert.ok(d, `LOTTIE.${n} registrado`);
    assert.deepEqual([d.fr, d.ip, d.op, d.w, d.h, d.layers.length], [30, 0, 30, 200, 200, 1], n);
    const ks = d.layers[0].ks;
    assert.equal(ks.o.k[0].s[0], 0, `${n}: o quadro 0 é vazio (opacidade 0)`);
    const tracos = [...nos(d)].filter((x) => x.ty === "st");
    assert.ok(tracos.length > 0, n);
    for (const st of tracos) assert.deepEqual([st.w.k, st.lc, st.lj], [12, 2, 2], `${n}: traço de 12, ponta e junta redondas`);
    assert.deepEqual([...new Set(cores(d).map(hex))], ["#24221F"], `${n}: uma cor só`);
    // nenhuma chave linear: toda chave com curva tem alça diferente da reta
    for (const x of nos(d)) if (x.o && x.i && Array.isArray(x.o.x)) assert.ok(!(x.o.x[0] === x.o.y[0] && x.i.x[0] === x.i.y[0]), `${n}: chave linear no quadro ${x.t}`);
  }
});

test("cada ícone tem a sua linha no LICENCAS.md", () => {
  const lic = readFileSync(join(PASTA, "LICENCAS.md"), "utf8");
  for (const n of ICONES) assert.match(lic, new RegExp("\\| `" + n + "\\.js` \\| feito à mão"), n);
});

test("dinheiro e documento creditam a Lucide, e o LICENCAS.md traz o texto da licença dela", () => {
  const lic = readFileSync(join(PASTA, "LICENCAS.md"), "utf8");
  for (const [n, icone] of [["dinheiro", "circle-dollar-sign"], ["documento", "file-text"]]) {
    const linha = lic.split("\n").find((l) => l.startsWith("| `" + n + ".js`"));
    assert.ok(linha && linha.includes("Lucide") && linha.includes("https://lucide.dev/icons/" + icone) && linha.includes("ISC"), `${n}: ${linha}`);
  }
  assert.ok(!/nenhum veio de banco de ícones/i.test(lic), "a frase antiga, que negava a Lucide, voltou");
  assert.match(lic, /Copyright \(c\) 20\d\d Lucide Icons and Contributors/);
  assert.match(lic, /Permission to use, copy, modify, and\/or distribute this software/);   // o ISC
  assert.match(lic, /Copyright \(c\) 2013-present Cole Bemis/);                              // o aviso do Feather (MIT)
  assert.match(lic, /lucide-icons\/lucide\/[0-9a-f]{40}\/LICENSE/);                          // o commit fixo de onde o texto veio
  const aviso = readFileSync(join(PASTA, "..", "..", "NOTICE"), "utf8");
  assert.match(aviso, /Lucide[^\n]*dinheiro\.js e documento\.js/);
});

test("os .js da pasta são os que o _gerar.mjs grava", () => {
  const tmp = mkdtempSync(join(tmpdir(), "lottie-"));
  execFileSync(process.execPath, [join(PASTA, "_gerar.mjs"), tmp]);
  for (const n of ICONES) assert.equal(readFileSync(join(PASTA, n + ".js"), "utf8"), readFileSync(join(tmp, n + ".js"), "utf8"), `${n}.js mudou à mão: mude o _gerar.mjs`);
});

test("LOTTIE.cor troca a cor principal em traço, preenchimento e chave de animação", () => {
  const L = carregar("_cor.js", "alerta.js");
  const antes = JSON.stringify(L.alerta);
  const azul = L.cor(L.alerta, "#2f6feb");
  assert.deepEqual([...new Set(cores(azul).map(hex))], ["#2F6FEB"]);
  assert.equal(JSON.stringify(L.alerta), antes, "o original não muda");
  assert.notEqual(azul, L.alerta);

  const dado = { layers: [{ shapes: [{ ty: "gr", it: [
    { ty: "st", c: { a: 1, k: [{ t: 0, s: [0.1, 0.2, 0.3, 1] }, { t: 9, s: [0.1, 0.2, 0.3, 1] }] } },
    { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] } },
    { ty: "fl", c: { a: 0, k: [0.1, 0.2, 0.3, 0.5] } },
  ] }] }] };
  const v = JSON.parse(JSON.stringify(L.cor(JSON.stringify(dado), "FF0000")));   // arrays do vm têm outro protótipo
  const it = v.layers[0].shapes[0].it;
  assert.deepEqual(it[0].c.k.map((ch) => ch.s), [[1, 0, 0, 1], [1, 0, 0, 1]], "chave de animação");
  assert.deepEqual(it[1].c.k, [1, 1, 1, 1], "o branco fica");
  assert.deepEqual(it[2].c.k, [1, 0, 0, 0.5], "a opacidade fica");
});

test("LOTTIE.cor recusa cor inválida e Lottie sem cor", () => {
  const L = carregar("_cor.js", "email.js");
  assert.throws(() => L.cor(L.email, "azul"), /cor inválida/);
  assert.throws(() => L.cor(L.email, "#12345"), /cor inválida/);
  assert.throws(() => L.cor(undefined, "#123456"), /falta o Lottie/);
  assert.throws(() => L.cor({ layers: [] }, "#123456"), /não tem cor/);
});
