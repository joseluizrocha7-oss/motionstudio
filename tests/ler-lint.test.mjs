import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
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
  assert.deepEqual(cortados, ["jaçã agora", "Ágata jaçã", "Átomo cortado", "ATOMO CBS jaçã agora"].sort(),
    `os 4 cortes de verdade têm que ser acusados: ${cortados}`);
  assert.equal(saida.portoes.T2, "ALERTA");
});
