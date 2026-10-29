import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  acharRenders, esperarMemoria, instrucaoPartes, lerProcessosPowershell, lerProcessosPs, lerProcessosWmic, listarProcessos,
} from "../scripts/_concorrencia.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const RENDER = join(RAIZ, "scripts", "render.mjs");
const TRECHOS = join(RAIZ, "scripts", "render-trechos.mjs");
const FILME = join(RAIZ, "examples", "selftest", "index.html");

const pastas = [];
const novaPasta = () => { const p = mkdtempSync(join(tmpdir(), "motionstudio-opcoes-")); pastas.push(p); return p; };
after(() => { for (const p of pastas) rmSync(p, { recursive: true, force: true }); });

// ---- item 8: ler a lista de processos ----

// Saída de exemplo (inventada) de cada fonte. O CommandLine do Windows traz as aspas do jeito que o processo foi aberto.
const POWERSHELL = JSON.stringify([
  { ProcessId: 4100, CommandLine: '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\ana\\filmes\\Átomo\\scripts\\render.mjs" film\\index.html out.mp4 --shutter 180' },
  { ProcessId: 4200, CommandLine: 'node C:/skill/scripts/render-trechos.mjs film/index.html final.mp4 --subframes 8' },
  { ProcessId: 4300, CommandLine: '"C:\\Program Files\\nodejs\\node.exe" --test tests\\render-opcoes.test.mjs' },
  { ProcessId: 4400, CommandLine: 'node scripts/lint.mjs film/index.html' },
  { ProcessId: 4500, CommandLine: 'node -e "require(\'child_process\').exec(\'render.mjs\')"' },
  { ProcessId: 4600, CommandLine: null },
]);
const POWERSHELL_UM = JSON.stringify({ ProcessId: 7, CommandLine: 'node render.mjs a.html b.mp4' });

const WMIC = [
  "",
  "Node,CommandLine,ProcessId",
  'MAQ01,"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\ana\\filmes\\Átomo\\scripts\\render.mjs" film\\index.html out.mp4,4100',
  "MAQ01,node C:/skill/scripts/render-trechos.mjs film/index.html final,v2.mp4 --parte 5,4200",
  "MAQ01,node scripts/lint.mjs film/index.html,4400",
  "",
].join("\r\r\n");

const PS = [
  "    PID COMMAND",
  "      1 /sbin/init",
  "   4100 /usr/bin/node /home/ana/filmes/atomo/scripts/render.mjs film/index.html out.mp4",
  "   4200 node scripts/render-trechos.mjs film/index.html final.mp4 --trabalhos 2",
  "   4300 bash scripts/render_partes.sh film/index.html final.mp4 --dur 23",
  "   4400 grep render.mjs",
  "   4500 /usr/bin/node scripts/lint.mjs film/index.html",
].join("\n");

test("lê a lista do PowerShell (vários processos, um só e vazio)", () => {
  const lista = lerProcessosPowershell(POWERSHELL);
  assert.equal(lista.length, 5, "o processo sem linha de comando fica de fora");
  assert.deepEqual(lista[0], { pid: 4100, comando: '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\ana\\filmes\\Átomo\\scripts\\render.mjs" film\\index.html out.mp4 --shutter 180' });
  assert.deepEqual(lerProcessosPowershell(POWERSHELL_UM), [{ pid: 7, comando: "node render.mjs a.html b.mp4" }]);
  assert.deepEqual(lerProcessosPowershell(""), []);
  assert.deepEqual(lerProcessosPowershell("\uFEFF" + POWERSHELL_UM), [{ pid: 7, comando: "node render.mjs a.html b.mp4" }], "aceita o BOM");
  assert.throws(() => lerProcessosPowershell("isto não é JSON"), /JSON/);
});

test("lê a lista do wmic (CSV com vírgula dentro da linha de comando)", () => {
  const lista = lerProcessosWmic(WMIC);
  assert.deepEqual(lista.map((p) => p.pid), [4100, 4200, 4400]);
  assert.equal(lista[1].comando, "node C:/skill/scripts/render-trechos.mjs film/index.html final,v2.mp4 --parte 5");
  assert.match(lista[0].comando, /^"C:\\Program Files\\nodejs\\node\.exe" .*render\.mjs/);
});

test("lê a lista do ps (cabeçalho e linhas)", () => {
  const lista = lerProcessosPs(PS);
  assert.deepEqual(lista.map((p) => p.pid), [1, 4100, 4200, 4300, 4400, 4500]);
  assert.equal(lista[1].comando, "/usr/bin/node /home/ana/filmes/atomo/scripts/render.mjs film/index.html out.mp4");
});

test("acha só o node rodando render.mjs ou render-trechos.mjs e tira o processo atual", () => {
  const ps = acharRenders(lerProcessosPs(PS), 999);
  assert.deepEqual(ps.map((p) => p.pid), [4100, 4200], "render_partes.sh, grep e lint não contam");
  const eu = acharRenders(lerProcessosPs(PS), 4100);
  assert.deepEqual(eu.map((p) => p.pid), [4200], "o pid atual sai da lista");

  const win = acharRenders(lerProcessosPowershell(POWERSHELL), 999);
  assert.deepEqual(win.map((p) => p.pid), [4100, 4200], "pasta com espaço e acento, teste do node e node -e não contam");

  const wm = acharRenders(lerProcessosWmic(WMIC), 999);
  assert.deepEqual(wm.map((p) => p.pid), [4100, 4200]);
});

test("a lista do sistema acha um render de verdade e o pid atual não aparece", async () => {
  // Um "render" de mentira: só dorme. O nome do arquivo é o que conta para o detector.
  const pasta = novaPasta();
  const falso = join(pasta, "render.mjs");
  writeFileSync(falso, "setTimeout(() => {}, 30000);\n", "utf8");
  const filho = spawn(process.execPath, [falso, "film.html", "saida.mp4"], { stdio: "ignore" });
  try {
    let achados = [];
    for (let i = 0; i < 40 && !achados.some((p) => p.pid === filho.pid); i++) {
      const { processos, erro } = listarProcessos();
      assert.ok(!erro, `não consegui listar os processos: ${erro}`);
      achados = acharRenders(processos, process.pid);
      if (!achados.some((p) => p.pid === filho.pid)) await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(achados.some((p) => p.pid === filho.pid), "o render de mentira tem que aparecer");
    assert.ok(!achados.some((p) => p.pid === process.pid), "o processo do teste não pode aparecer");
    assert.match(achados.find((p) => p.pid === filho.pid).comando, /render\.mjs/);
  } finally { filho.kill(); }
});

// ---- item 8: a instrução do render_partes.sh ----

test("a instrução do render_partes.sh leva o filme, a saída, --dur, as opções do script e as do render.mjs", () => {
  const cmd = instrucaoPartes({
    script: "C:\\skill\\scripts\\render_partes.sh", filme: "C:\\filmes\\meu filme\\index.html", saida: "C:\\filmes\\final.mp4",
    dur: 23, parte: "5", fps: "30", audio: "C:\\filmes\\mix.wav", render: [["--shutter", "180"], ["--subframes", "8"]],
  });
  assert.equal(cmd, 'bash C:/skill/scripts/render_partes.sh "C:/filmes/meu filme/index.html" C:/filmes/final.mp4 --dur 23 --parte 5 --fps 30 --audio C:/filmes/mix.wav -- --shutter 180 --subframes 8');
  const minimo = instrucaoPartes({ script: "/s/render_partes.sh", filme: "f.html", saida: "o.mp4", dur: 0.2, render: [] });
  assert.equal(minimo, "bash /s/render_partes.sh f.html o.mp4 --dur 0.2", "sem opção do render.mjs não leva o --");
});

// ---- item 8: esperar a memória ----

test("esperarMemoria devolve true na hora quando a memória basta e não avisa", async () => {
  let avisos = 0;
  const ok = await esperarMemoria({ minimo: 3e9, limiteMs: 1000, livre: () => 4e9, aoEsperar: () => { avisos++; } });
  assert.equal(ok, true);
  assert.equal(avisos, 0);
});

test("esperarMemoria espera a memória subir, avisa uma vez e devolve true", async () => {
  const leituras = [1e9, 1e9, 2e9, 5e9];
  let i = 0, avisos = 0;
  const ok = await esperarMemoria({ minimo: 3e9, limiteMs: 5000, passoMs: 10, livre: () => leituras[Math.min(i++, leituras.length - 1)], aoEsperar: () => { avisos++; } });
  assert.equal(ok, true);
  assert.equal(avisos, 1);
});

test("esperarMemoria devolve false quando o tempo-limite passa", async () => {
  const t0 = Date.now();
  const ok = await esperarMemoria({ minimo: 3e9, limiteMs: 120, passoMs: 20, livre: () => 1e9 });
  assert.equal(ok, false);
  assert.ok(Date.now() - t0 >= 100, "esperou perto do limite");
  assert.ok(Date.now() - t0 < 3000, "não esperou muito além do limite");
  assert.equal(await esperarMemoria({ minimo: 3e9, limiteMs: 0, livre: () => 1e9 }), false, "limite 0 não espera");
});

test("render-trechos sai com código 3 e a instrução do render_partes.sh quando a memória não chega", () => {
  const pasta = novaPasta();
  const saida = join(pasta, "final.mp4");
  const r = spawnSync(process.execPath, [TRECHOS, FILME, saida, "--dur", "0.2", "--shutter", "180", "--subframes", "4",
    "--memoria", "100000", "--esperar-memoria", "0.02", "--sem-cache"], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 3, `código de saída (stderr: ${r.stderr})`);
  assert.match(r.stderr, /memória livre não chegou/);
  const esperado = instrucaoPartes({ script: join(RAIZ, "scripts", "render_partes.sh"), filme: FILME, saida, dur: 0.2, render: [["--shutter", "180"], ["--subframes", "4"]] });
  assert.ok(r.stderr.includes(esperado), `a instrução tem que estar na saída:\n${esperado}\n---\n${r.stderr}`);
  assert.ok(!existsSync(saida), "não pode ter gravado o filme");
  assert.ok(!existsSync(join(pasta, "final-trechos")), "a pasta de trabalho some");
});

test("render-trechos recusa --esperar-memoria que não é número ou é negativo", () => {
  for (const v of ["abc", "-1"]) {
    const r = spawnSync(process.execPath, [TRECHOS, FILME, join(novaPasta(), "x.mp4"), "--esperar-memoria", v], { encoding: "utf8" });
    assert.equal(r.status, 2, `--esperar-memoria ${v}: ${r.stderr}`);
    assert.match(r.stderr, /--esperar-memoria/);
  }
});
