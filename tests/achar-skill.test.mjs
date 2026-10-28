import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acharSkill } from "../kit/_skill.mjs";

const PADRAO = join(homedir(), ".claude", "skills", "motionstudio");

test("acharSkill prefere a variável SKILL", () => assert.equal(acharSkill("/qualquer", { SKILL: "/x/skill" }), "/x/skill"));

test("acharSkill lê o motionstudio.json da pasta de cima", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj ç ")); mkdirSync(join(raiz, "vozes"));
  writeFileSync(join(raiz, "motionstudio.json"), JSON.stringify({ skill: "/instalada/aqui" }));
  assert.equal(acharSkill(join(raiz, "vozes"), {}), "/instalada/aqui");
});

test("acharSkill lê o motionstudio.json da própria pasta", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj-"));
  writeFileSync(join(raiz, "motionstudio.json"), JSON.stringify({ skill: "/na/raiz" }));
  assert.equal(acharSkill(raiz, {}), "/na/raiz");
});

test("acharSkill sobe até 6 pastas e não mais", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj-"));
  writeFileSync(join(raiz, "motionstudio.json"), JSON.stringify({ skill: "/longe" }));
  const seis = join(raiz, "a", "b", "c", "d", "e", "f");
  mkdirSync(seis, { recursive: true });
  assert.equal(acharSkill(seis, {}), "/longe");
  const sete = join(seis, "g");
  mkdirSync(sete);
  assert.equal(acharSkill(sete, {}), PADRAO);
});

test("acharSkill: a variável SKILL vence o motionstudio.json", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj-"));
  writeFileSync(join(raiz, "motionstudio.json"), JSON.stringify({ skill: "/do/json" }));
  assert.equal(acharSkill(raiz, { SKILL: "/da/variavel" }), "/da/variavel");
});

test("acharSkill cai na pasta do usuário", () => {
  const solta = mkdtempSync(join(tmpdir(), "solta-"));
  assert.equal(acharSkill(solta, {}), PADRAO);
});

test("acharSkill acusa motionstudio.json com JSON inválido, citando o arquivo", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj-"));
  const arq = join(raiz, "motionstudio.json");
  writeFileSync(arq, "{ isto não é json");
  assert.throws(() => acharSkill(raiz, {}), (e) => e.message.includes(arq));
});

test("acharSkill acusa motionstudio.json sem o campo skill em texto, citando o arquivo", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj-"));
  const arq = join(raiz, "motionstudio.json");
  writeFileSync(arq, JSON.stringify({ skill: 42 }));
  assert.throws(() => acharSkill(raiz, {}), (e) => e.message.includes(arq));
  writeFileSync(arq, JSON.stringify({ outro: "x" }));
  assert.throws(() => acharSkill(raiz, {}), (e) => e.message.includes(arq));
});

test("novo-projeto grava o motionstudio.json e não sobrescreve o que já existe", () => {
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
  const projeto = join(mkdtempSync(join(tmpdir(), "novo ç ")), "meu filme");
  execFileSync(process.execPath, [join(RAIZ, "kit", "novo-projeto.mjs"), projeto]);
  const arq = join(projeto, "motionstudio.json");
  assert.equal(JSON.parse(readFileSync(arq, "utf8")).skill, RAIZ);
  assert.ok(existsSync(join(projeto, "_skill.mjs")), "o _skill.mjs vai junto para o projeto");
  assert.equal(acharSkill(join(projeto, "vozes"), {}), RAIZ);
  writeFileSync(arq, JSON.stringify({ skill: "/outra" }));
  execFileSync(process.execPath, [join(RAIZ, "kit", "novo-projeto.mjs"), projeto]);
  assert.equal(JSON.parse(readFileSync(arq, "utf8")).skill, "/outra");
});

test("acharSkill lê o motionstudio.json gravado com BOM (PowerShell 5.1)", () => {
  const raiz = mkdtempSync(join(tmpdir(), "proj-"));
  writeFileSync(join(raiz, "motionstudio.json"), "\uFEFF" + JSON.stringify({ skill: "/com/bom" }), "utf8");
  assert.equal(acharSkill(raiz, {}), "/com/bom");
});
