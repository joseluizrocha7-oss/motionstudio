// Acha a pasta da skill motionstudio para os scripts do projeto (autoteste, tela-vazia, vozes).
// Ordem: variável SKILL; o campo "skill" do 1º motionstudio.json achado subindo de dePasta
// (a própria pasta e mais 6 acima); a pasta da skill no perfil do usuário.
// O novo-projeto.mjs grava o motionstudio.json na pasta do projeto.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function acharSkill(dePasta, env = process.env) {
  if (env.SKILL) return env.SKILL;
  let pasta = dePasta;
  for (let i = 0; i <= 6; i++) {
    const arq = join(pasta, "motionstudio.json");
    if (existsSync(arq)) {
      let dados;
      // O PowerShell 5.1 e alguns editores gravam o BOM (U+FEFF) no início; o JSON.parse não aceita.
      try { dados = JSON.parse(readFileSync(arq, "utf8").replace(/^\uFEFF/, "")); }
      catch (e) { throw new Error(`${arq} não é um JSON válido (${e.message}). Conserte o arquivo ou apague para recriar.`); }
      const skill = dados?.skill;
      if (typeof skill !== "string" || !skill) throw new Error(`${arq} não tem o campo "skill" com o caminho da skill. Conserte o arquivo ou apague para recriar.`);
      return skill;
    }
    const acima = dirname(pasta);
    if (acima === pasta) break;
    pasta = acima;
  }
  return join(homedir(), ".claude", "skills", "motionstudio");
}
