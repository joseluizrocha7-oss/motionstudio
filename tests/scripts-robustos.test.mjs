import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOOK = join(RAIZ, "scripts", "look.py");
const ENTONACAO = join(RAIZ, "scripts", "entonacao.mjs");
const PROVIDERS = join(RAIZ, "scripts", "providers.sh").replace(/\\/g, "/");
// No Windows o Python é `py -3` (o `python3` é o atalho da Microsoft Store).
const PY = process.platform === "win32" ? ["py", "-3"] : ["python3"];

// Pasta única do arquivo: cada teste cria a sua subpasta aqui dentro. Tudo com dado inventado.
const OFICINA = mkdtempSync(join(tmpdir(), "scripts-robustos-"));
after(() => rmSync(OFICINA, { recursive: true, force: true }));
const subpasta = (nome) => { const p = join(OFICINA, nome); mkdirSync(p, { recursive: true }); return p; };

// Cópia do ambiente sem as variáveis dadas (no Windows o nome não distingue maiúscula).
function ambienteSem(...nomes) {
  const sem = new Set(nomes.map((n) => n.toUpperCase()));
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !sem.has(k.toUpperCase())));
}

// ---------- item 1: look.py lê e grava JSON em UTF-8 ----------

// 1 s de vídeo sintético, o menor que o look.py aceita.
function criarFilme(pasta) {
  const filme = join(pasta, "filme.mp4");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=30:d=1",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", filme]);
  return filme;
}
// Roda o look.py no Python do Windows sem as variáveis que forçam UTF-8 (o padrão do open() fica cp1252).
function rodarLook(filme, saida) {
  return spawnSync(PY[0], [...PY.slice(1), LOOK, filme, "--out", saida],
    { encoding: "utf8", env: ambienteSem("PYTHONUTF8", "PYTHONIOENCODING") });
}

test("look.py lê o events.json com acento sem PYTHONUTF8 (Windows, cp1252)", () => {
  const pasta = subpasta("look");
  const filme = criarFilme(pasta);
  // "Á" em UTF-8 é C3 81; o byte 0x81 não existe no cp1252.
  writeFileSync(`${filme}.events.json`, JSON.stringify([{ type: "cut", t: 0.5, label: "Ágata" }]), "utf8");

  const saida = join(pasta, "look");
  const r = rodarLook(filme, saida);
  assert.equal(r.status, 0, `o look.py devia sair com 0:\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /charmap|codec/, "o look.py não pode falhar na codificação");
  assert.match(r.stdout, /cuts\s+1 from events/, "o corte do events.json devia entrar na conta");
  // O rótulo com acento volta para o cuts.txt em UTF-8.
  assert.match(readFileSync(join(saida, "cuts.txt"), "utf8"), /event cut 'Ágata'/);
  // O gates.json também é JSON válido em UTF-8.
  assert.equal(JSON.parse(readFileSync(join(saida, "gates.json"), "utf8")).film, filme);
});

test("look.py lê o events.json com BOM (PowerShell 5.1 grava assim)", () => {
  const pasta = subpasta("look-bom");
  const filme = criarFilme(pasta);
  writeFileSync(`${filme}.events.json`, "﻿" + JSON.stringify([{ type: "cut", t: 0.5, label: "Ágata" }]), "utf8");

  const saida = join(pasta, "look");
  const r = rodarLook(filme, saida);
  assert.equal(r.status, 0, `o look.py devia sair com 0:\n${r.stderr}`);
  assert.match(r.stdout, /cuts\s+1 from events/, "o corte do events.json com BOM devia entrar na conta");
  assert.match(readFileSync(join(saida, "cuts.txt"), "utf8"), /event cut 'Ágata'/);
});

test("look.py roda com o filme numa pasta com acento (o ffprobe devolve o caminho em UTF-8)", () => {
  // O ffprobe repete o caminho em format.filename; lido como cp1252, o byte 0x81 do "Á" derrubava o JSON.
  const pasta = subpasta("Ágata");
  const filme = criarFilme(pasta);
  const saida = join(pasta, "look");
  const r = rodarLook(filme, saida);
  assert.equal(r.status, 0, `o look.py devia sair com 0:\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /charmap|codec|Traceback/, "o look.py não pode falhar na codificação");
  for (const arq of ["sheet.jpg", "cuts.txt", "gates.json"]) assert.ok(existsSync(join(saida, arq)), `faltou ${arq}`);
  assert.equal(JSON.parse(readFileSync(join(saida, "gates.json"), "utf8")).film, filme);
});

// ---------- item 2: entonacao.mjs valida o .lines.json ----------

// 2,4 s de tom a 170 Hz: só serve para o ffmpeg decodificar; a medida em si não importa aqui.
function prepararVoz() {
  const pasta = subpasta("entonacao");
  const audio = join(pasta, "voz.wav");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=170:duration=2.4", audio]);
  const palavras = join(pasta, "voz.words.json");
  writeFileSync(palavras, JSON.stringify([
    { word: "Olá", start: 0.1, end: 0.5 }, { word: "mundo.", start: 0.6, end: 1.0 },
    { word: "Tudo", start: 1.3, end: 1.7 }, { word: "bem.", start: 1.8, end: 2.2 },
  ]), "utf8");
  const linhas = (nome, conteudo) => { const f = join(pasta, nome); writeFileSync(f, JSON.stringify(conteudo), "utf8"); return f; };
  return { pasta, audio, palavras, linhas };
}
const entonacao = (v, arqLinhas, arqPalavras = v.palavras) =>
  spawnSync("node", [ENTONACAO, v.audio, "--words", arqPalavras, "--lines", arqLinhas, "--json"], { encoding: "utf8", maxBuffer: 1 << 24 });

test("entonacao.mjs aceita o .lines.json do montar.mjs (text, start, end) e o do fala.js (t, a, b)", () => {
  const v = prepararVoz();
  const montar = v.linhas("montar.lines.json", [
    { text: "Olá mundo.", start: 0.1, end: 1.0 }, { text: "Tudo bem.", start: 1.3, end: 2.2 }]);
  const fala = v.linhas("fala.lines.json", [
    { t: "Olá mundo.", l: 1, a: 0.1, b: 1.0 }, { t: "Tudo bem.", l: 2, a: 1.3, b: 2.2 }]);
  const a = entonacao(v, montar);
  const b = entonacao(v, fala);
  assert.equal(a.status, 0, `formato do montar.mjs:\n${a.stderr}`);
  assert.equal(b.status, 0, `formato do fala.js:\n${b.stderr}`);
  const ja = JSON.parse(a.stdout), jb = JSON.parse(b.stdout);
  assert.deepEqual(ja.linhas.map((l) => l.texto), ["Olá mundo.", "Tudo bem."]);
  assert.deepEqual(jb.linhas, ja.linhas, "os dois formatos têm que dar a mesma medida");
});

test("entonacao.mjs sai com 1 e diz o campo e a linha quando falta texto ou tempo", () => {
  const v = prepararVoz();
  const semTexto = v.linhas("sem-texto.lines.json", [
    { text: "Olá mundo.", start: 0.1, end: 1.0 }, { start: 1.3, end: 2.2 }]);
  const r = entonacao(v, semTexto);
  assert.equal(r.status, 1, `devia sair com 1:\n${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /TypeError|at silabas|node:internal/, "o erro tem que ser uma mensagem, não a pilha");
  assert.match(r.stderr, /\[1\]/, "tem que dizer o índice da linha");
  assert.match(r.stderr, /"text"/, "tem que dizer o campo que falta");
  assert.equal(r.stdout, "", "sem medida na saída quando o arquivo está errado");

  const semFim = v.linhas("sem-fim.lines.json", [{ t: "Olá mundo.", a: 0.1 }]);
  const r2 = entonacao(v, semFim);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /\[0\]/);
  assert.match(r2.stderr, /"end"/);
  assert.doesNotMatch(r2.stderr, /"text"|"start"/, "só os campos que faltam");

  const naoLista = v.linhas("objeto.lines.json", { text: "Olá." });
  const r3 = entonacao(v, naoLista);
  assert.equal(r3.status, 1);
  assert.doesNotMatch(r3.stderr, /TypeError|node:internal/);
});

test("entonacao.mjs aceita o --words do voice.py (word, start, end), do fala.js (w, a, b) e (p, ini, fim)", () => {
  const v = prepararVoz();
  const linhas = v.linhas("ok.lines.json", [
    { text: "Olá mundo.", start: 0.1, end: 1.0 }, { text: "Tudo bem.", start: 1.3, end: 2.2 }]);
  const voice = v.linhas("voice.words.json", [
    { word: "Olá", start: 0.1, end: 0.5 }, { word: "mundo.", start: 0.6, end: 1.0 },
    { word: "Tudo", start: 1.3, end: 1.7 }, { word: "bem.", start: 1.8, end: 2.2 }]);
  const fala = v.linhas("fala.words.json", [
    { w: "Olá", l: 1, a: 0.1, b: 0.5 }, { w: "mundo.", l: 1, a: 0.6, b: 1.0 },
    { w: "Tudo", l: 2, a: 1.3, b: 1.7 }, { w: "bem.", l: 2, a: 1.8, b: 2.2 }]);
  const apelidos = v.linhas("apelidos.words.json", [
    { p: "Olá", ini: 0.1, fim: 0.5 }, { p: "mundo.", ini: 0.6, fim: 1.0 },
    { p: "Tudo", ini: 1.3, fim: 1.7 }, { p: "bem.", ini: 1.8, fim: 2.2 }]);
  const [a, b, c] = [voice, fala, apelidos].map((p) => entonacao(v, linhas, p));
  for (const r of [a, b, c]) assert.equal(r.status, 0, r.stderr);
  const ja = JSON.parse(a.stdout);
  // A vírgula e o ponto só são conferidos se as palavras forem lidas: com campo errado a lista vinha vazia e dava 0 sinais.
  assert.equal(ja.sinais.length, 1, "o ponto depois de 'mundo.' tem que contar como 1 sinal");
  assert.equal(ja.sinais[0].depois_de, "mundo.");
  assert.deepEqual(JSON.parse(b.stdout), ja, "o formato do fala.js tem que dar a mesma medida");
  assert.deepEqual(JSON.parse(c.stdout), ja, "o formato p, ini, fim tem que dar a mesma medida");
});

test("entonacao.mjs sai com 1 e diz o campo e o índice quando falta campo no --words", () => {
  const v = prepararVoz();
  const linhas = v.linhas("ok.lines.json", [{ text: "Olá mundo.", start: 0.1, end: 1.0 }]);
  const semFim = v.linhas("sem-fim.words.json", [{ w: "Olá", a: 0.1, b: 0.5 }, { w: "mundo.", a: 0.6 }]);
  const r = entonacao(v, linhas, semFim);
  assert.equal(r.status, 1, `devia sair com 1:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /palavra \[1\]/, "tem que dizer o índice da palavra");
  assert.match(r.stderr, /"end"/, "tem que dizer o campo que falta");
  assert.doesNotMatch(r.stderr, /\[0\]|"start"/, "só a palavra e o campo que faltam");
  assert.equal(r.stdout, "");

  const semTexto = v.linhas("sem-texto.words.json", [{ start: 0.1, end: 0.5 }]);
  const r2 = entonacao(v, linhas, semTexto);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /palavra \[0\]: falta "word"/);
  assert.doesNotMatch(r2.stderr, /TypeError|node:internal/);

  const objeto = v.linhas("objeto.words.json", { word: "Olá" });
  const r3 = entonacao(v, linhas, objeto);
  assert.equal(r3.status, 1);
  assert.doesNotMatch(r3.stderr, /TypeError|node:internal/);
});

// ---------- item 6: providers.sh informa GEMINI_API_KEY (só verdadeiro ou falso) ----------

// Roda o providers.sh numa pasta, com a variável do Gemini ou sem ela. Assíncrono: o script leva uns 6 s (codex e npx).
function providers(pasta, valorNoAmbiente) {
  const env = ambienteSem("GEMINI_API_KEY");
  if (valorNoAmbiente) env.GEMINI_API_KEY = valorNoAmbiente;
  return new Promise((resolve) => {
    execFile("bash", [PROVIDERS], { cwd: pasta, env, encoding: "utf8", maxBuffer: 1 << 24 },
      (_erro, stdout, stderr) => resolve({ stdout, stderr })); // o código de saída 1 só diz que falta chrome, ffmpeg ou node
  });
}

test("providers.sh diz se GEMINI_API_KEY existe no ambiente e no .env, sem mostrar o valor", async () => {
  const comEnv = subpasta("providers-com-env");
  writeFileSync(join(comEnv, ".env"), "OUTRA=1\nGEMINI_API_KEY=valor-de-teste\n", "utf8");
  const semEnv = subpasta("providers-sem-env");
  const vazio = subpasta("providers-vazio");
  // Comentário, valor vazio (com e sem aspas) e outra variável não contam como chave.
  writeFileSync(join(vazio, ".env"), "# GEMINI_API_KEY=valor-de-teste\nGEMINI_API_KEY=\nGEMINI_API_KEY=\"\"\nOUTRA=valor-de-teste\n", "utf8");
  // Arquivo salvo no Windows (CRLF), com export e aspas.
  const estilo = subpasta("providers-estilo");
  writeFileSync(join(estilo, ".env"), "export GEMINI_API_KEY='valor-de-teste'\r\n", "utf8");

  const [soArquivo, ambosOsLados, soAmbiente, nenhum, comEstilo] = await Promise.all([
    providers(comEnv), providers(comEnv, "valor-no-ambiente"), providers(semEnv, "valor-no-ambiente"), providers(vazio), providers(estilo)]);

  for (const r of [soArquivo, ambosOsLados, soAmbiente, nenhum, comEstilo]) {
    assert.doesNotMatch(r.stdout + r.stderr, /valor-de-teste|valor-no-ambiente/, "o valor da chave nunca aparece");
  }
  const g = (r) => JSON.parse(r.stdout).gemini;
  assert.deepEqual(g(soArquivo), { key: true, in_env: false, in_dotenv: true });
  assert.deepEqual(g(ambosOsLados), { key: true, in_env: true, in_dotenv: true });
  assert.deepEqual(g(soAmbiente), { key: true, in_env: true, in_dotenv: false });
  assert.deepEqual(g(nenhum), { key: false, in_env: false, in_dotenv: false });
  assert.deepEqual(g(comEstilo), { key: true, in_env: false, in_dotenv: true });
});
