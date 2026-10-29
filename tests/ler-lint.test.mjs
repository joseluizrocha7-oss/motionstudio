import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(RAIZ, "tests", "fixtures");
const LER = join(RAIZ, "scripts", "ler.mjs");
const LINT = join(RAIZ, "scripts", "lint.mjs");

const OFICINA = mkdtempSync(join(tmpdir(), "ler-lint-teste-"));
after(() => rmSync(OFICINA, { recursive: true, force: true }));

// O ler.mjs termina o trabalho e fica 8 a 45 s esperando os processos filhos do Chrome soltarem o cano de erro
// (o lint.mjs chama process.exit e não tem esse atraso). O teste lê o ler.json assim que ele aparece e encerra o processo.
function rodarLer(args, saida) {
  return new Promise((resolve, reject) => {
    const filho = spawn("node", [LER, ...args, "--out", saida], { stdio: ["ignore", "ignore", "pipe"] });
    let erro = "";
    filho.stderr.on("data", (d) => { erro += d; });
    const arquivo = join(saida, "ler.json");
    const encerrar = (fim, valor) => { clearInterval(relogio); clearTimeout(limite); filho.kill(); fim(valor); };
    const relogio = setInterval(() => { try { encerrar(resolve, JSON.parse(readFileSync(arquivo, "utf8"))); } catch { /* ainda não gravou */ } }, 150);
    const limite = setTimeout(() => encerrar(reject, new Error(`o ler.mjs não gravou o ler.json em 60 s: ${erro}`)), 60000);
    filho.on("exit", (codigo) => { if (codigo !== null && codigo >= 2) encerrar(reject, new Error(`o ler.mjs saiu com erro ${codigo}: ${erro}`)); });
  });
}

// ---------- ler.mjs T2: texto inteiro (item 5) ----------

// O T2 compara a caixa da fonte (subida mais descida, 85 px com a Inter em 70 px) com o pai overflow:hidden.
// Com a tinta inteira dentro da máscara, a sobra da caixa não pode acusar. Corte de verdade continua acusado.
// O OCR do Windows só roda para os textos não acusados; o vídeo é preto de propósito (o T1 alerta e não importa aqui).
test("ler T2: título em máscara com a tinta inteira não acusa; corte de verdade acusa", { skip: process.platform !== "win32" && "o OCR do ler.mjs é do Windows" }, async () => {
  const mp4 = join(OFICINA, "preto-960x540.mp4");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=black:s=960x540:d=1:r=10",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", mp4]);
  const saida = await rodarLer([join(FIXTURES, "ler-mascara.html"), mp4, "--passo", "0.2", "--ate", "0.8"], join(OFICINA, "ler-saida"));
  const cortados = saida.cortados.map((c) => c.texto).sort();

  // Tinta inteira: a caixa da fonte passa da máscara (12 px em "ATOMO CBS", 8 px em "Mágica jaçã"), a tinta não.
  for (const inteiro of ["ATOMO CBS", "Mágica jaçã"]) {
    assert.ok(!cortados.includes(inteiro), `"${inteiro}" tem a tinta inteira na máscara e foi acusado: ${cortados}`);
  }
  // Mesma regra em 2 linhas (a tinta de cada linha é medida com o texto da linha) e na borda do quadro (sem pai com overflow).
  for (const inteiro of ["ATOMO CBS AGORA FIM", "ATOMO FIM"]) {
    assert.ok(!cortados.includes(inteiro), `"${inteiro}" tem a tinta inteira e foi acusado: ${cortados}`);
  }
  // Corte de verdade: acento e descendente fora, metade fora, só a descendente fora (4 px) e a descendente da última de 2 linhas.
  // Texto girado: com giro a refinação pela tinta não vale (a folga de cima e a de baixo trocam de lugar, a escala sai
  // errada) e o T2 volta à regra da caixa. Girado 180 graus a descendente sai 3 px em cima; a refinação dava falso negativo.
  assert.deepEqual(cortados, ["jaçã agora", "Ágata jaçã", "Átomo cortado", "ATOMO CBS jaçã agora", "Mágica jaçã 180", "ATOMO CBS 90"].sort(),
    `os 6 cortes de verdade (4 em pé, 2 girados) têm que ser acusados: ${cortados}`);
  assert.equal(saida.portoes.T2, "ALERTA");
});

// ---------- lint.mjs F1: fonte usada de verdade (item 17) ----------

// A fixture tem 7 textos (ver o comentário no HTML). O lint abre a página no Chrome, pergunta ao CDP qual fonte
// cada texto usou (CSS.getPlatformFontsForNode) e compara com as @font-face da página.
function rodarLint(arquivo) {
  const r = spawnSync("node", [LINT, arquivo, "--json", "--times", "0.5"], { encoding: "utf8", maxBuffer: 1 << 26 });
  assert.ok(r.stdout, `o lint.mjs não escreveu o JSON (saída ${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout);
}
// O snippet é <tag#id.classe> "texto": acha o elemento pelo id.
const achar = (hits, id) => hits.find((h) => new RegExp(`#${id}[.>]`).test(h.snippet));

test("lint F1: nome de fonte com algarismo sem aspas acusa; com aspas não", () => {
  const saida = rodarLint(join(FIXTURES, "lint-fonte.html"));
  const f1 = saida.rules.find((r) => r.id === "F1");
  assert.ok(f1, "o lint não tem a regra F1 (fonte usada)");
  assert.equal(f1.status, "WARN", "F1 é um aviso: não derruba o portão G5");
  assert.ok(!saida.failed.includes("F1"));
  const hits = f1.hits;
  const lista = hits.map((h) => h.snippet).join(" | ");

  // SVG: font-family="Teste 4" sem aspas é inválido (o "4"); com aspas vale.
  assert.ok(achar(hits, "svg-sem-aspas"), `o texto SVG sem aspas devia ser acusado: ${lista}`);
  assert.ok(!achar(hits, "svg-com-aspas"), `o texto SVG com aspas não devia ser acusado: ${lista}`);

  // HTML: a mesma armadilha numa regra do <style>; o arquivo da fonte que não carrega; o glifo que a fonte não tem.
  assert.ok(achar(hits, "html-sem-aspas"), `o texto HTML sem aspas (regra do <style>) devia ser acusado: ${lista}`);
  assert.ok(achar(hits, "html-inline"), `o texto HTML sem aspas (style inline) devia ser acusado: ${lista}`);
  assert.ok(achar(hits, "html-quebrada"), `a @font-face quebrada devia ser acusada: ${lista}`);
  assert.ok(achar(hits, "html-seta"), `o glifo que a fonte não tem devia ser acusado: ${lista}`);
  // A @font-face com o nome sem aspas é descartada inteira; o aviso não tem elemento.
  assert.ok(hits.some((h) => h.snippet === "@font-face" && /"Face 6"/.test(h.note)), `a @font-face "Face 6" sem aspas devia ser acusada: ${lista}`);
  // Sem alarme falso: fonte com aspas e @font-face carregada, e fonte do sistema pedida de propósito.
  assert.ok(!achar(hits, "html-ok"), `o texto HTML com aspas não devia ser acusado: ${lista}`);
  assert.ok(!achar(hits, "html-arial"), `Arial pedida sem @font-face não devia ser acusada: ${lista}`);
  assert.equal(hits.length, 6, `só os 6 avisos esperados: ${lista}`);
});

test("lint F1: a mensagem está em pt-BR e nomeia o elemento, o que foi pedido e a fonte usada", () => {
  const saida = rodarLint(join(FIXTURES, "lint-fonte.html"));
  const hits = saida.rules.find((r) => r.id === "F1")?.hits ?? [];

  const svg = achar(hits, "svg-sem-aspas");
  assert.ok(svg, "falta o aviso do texto SVG sem aspas");
  assert.match(svg.snippet, /^<text#svg-sem-aspas>/, "nomeia o elemento");
  assert.match(svg.note, /font-family inválido/);
  assert.match(svg.note, /"Teste 4"/, "diz o nome pedido");
  assert.match(svg.note, /aspas/, "diz a correção");
  assert.match(svg.note, /saiu em \S/, "diz a fonte usada");

  const quebrada = achar(hits, "html-quebrada");
  assert.ok(quebrada, "falta o aviso da @font-face quebrada");
  assert.match(quebrada.note, /"Falha 5"/);
  assert.match(quebrada.note, /status error/, "diz que a @font-face não carregou");
  assert.match(quebrada.note, /saiu em \S/);

  const seta = achar(hits, "html-seta");
  assert.ok(seta, "falta o aviso do glifo sem fonte");
  assert.match(seta.note, /não tem 1 dos \d+ glifos/, "diz quantos glifos a fonte não tem");
  assert.match(seta.note, /o que faltou saiu em \S/, "diz a fonte usada no lugar");
});
