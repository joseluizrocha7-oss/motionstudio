import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const temporarias = [];
after(() => { for (const p of temporarias) rmSync(p, { recursive: true, force: true }); });

// Todos os arquivos e pastas de "raiz", com caminho relativo e barras normais.
function listar(raiz, rel = "") {
  return readdirSync(join(raiz, rel)).flatMap((f) => {
    const r = rel ? `${rel}/${f}` : f;
    return statSync(join(raiz, r)).isDirectory() ? [r + "/", ...listar(raiz, r)] : [r];
  });
}

test("novo-projeto: não copia __pycache__ nem .pyc para o projeto", () => {
  // Uma "skill" mínima: o novo-projeto.mjs de verdade, uma pasta vozes/ com cache do Python e o runtime/.
  const skill = mkdtempSync(join(tmpdir(), "motionstudio-novo-"));
  temporarias.push(skill);
  mkdirSync(join(skill, "kit", "vozes", "__pycache__"), { recursive: true });
  mkdirSync(join(skill, "kit", "film", "__pycache__"), { recursive: true });
  mkdirSync(join(skill, "runtime"), { recursive: true });
  copyFileSync(join(RAIZ, "kit", "novo-projeto.mjs"), join(skill, "kit", "novo-projeto.mjs"));
  writeFileSync(join(skill, "kit", "vozes", "alinhar.py"), "# alinhar\n");
  writeFileSync(join(skill, "kit", "vozes", "__pycache__", "alinhar.cpython-314.pyc"), "x");
  writeFileSync(join(skill, "kit", "vozes", "solto.pyc"), "x");
  writeFileSync(join(skill, "kit", "film", "montar-filmes.mjs"), "// montar\n");
  writeFileSync(join(skill, "kit", "film", "__pycache__", "y.pyc"), "x");
  writeFileSync(join(skill, "kit", "gerar-som.mjs"), "// som\n");
  writeFileSync(join(skill, "runtime", "motion.js"), "// motion\n");

  const destino = join(skill, "projeto ção");
  const r = spawnSync("node", [join(skill, "kit", "novo-projeto.mjs"), destino], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const copiado = listar(destino);
  assert.ok(copiado.includes("vozes/alinhar.py"), `vozes/alinhar.py faltou: ${copiado}`);
  assert.ok(copiado.includes("film/montar-filmes.mjs") && copiado.includes("gerar-som.mjs") && copiado.includes("film/runtime/motion.js"), `faltou arquivo: ${copiado}`);
  const lixo = copiado.filter((f) => /__pycache__|\.pyc$/.test(f));
  assert.deepEqual(lixo, [], "cache do Python foi para o projeto");
  assert.ok(!existsSync(join(destino, "vozes", "__pycache__")));
});
