// Gera tomadas da narração por BLOCO (um passo do tutorial por pedido, para a
// voz saber de onde vem e para onde vai), alinha cada uma pelo Whisper e mede
// a entonação. Não escolhe: grava tomadas/<bloco>-<n>.wav, .words.json,
// .lines.json e .medida.json, e imprime um placar por bloco.
//
// Gasta o saldo pré-pago da API Gemini (o mesmo dos sistemas em produção).
// Tomada que já existe não é gerada de novo.
//
//   node --env-file=../../../.env gerar-tomadas.mjs [--tomadas 3] [--blocos entrar,protheus] [--modelo-whisper small]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const argR = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const ROTEIRO = JSON.parse(readFileSync(join(AQUI, "..", argR("roteiro", "roteiro.json")), "utf8"));
// Uma pasta de tomadas por voz (roteiro.voz.pasta): o montar.mjs nunca mistura duas vozes.
const TOMADAS = join(AQUI, ROTEIRO.voz.pasta || "tomadas");
const SKILL = process.env.SKILL || join(homedir(), ".claude", "skills", "motionstudio");
const ENTONACAO = join(SKILL, "scripts", "entonacao.mjs");
mkdirSync(TOMADAS, { recursive: true });

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const quantas = Number(arg("tomadas", "3"));
const inicio = Number(arg("inicio", "1"));
const filtro = arg("blocos") ? new Set(arg("blocos").split(",")) : null;
const modeloWhisper = arg("modelo-whisper", "small");
const estilo = arg("estilo", "Calm, clear and warm Brazilian Portuguese instructional narrator explaining an app step by step to a colleague. Unhurried, natural pauses at every comma and period, sentences end with a settled falling tone.");

const falaDoBloco = (b) => b.linhas.map((l) => l.fala || l.texto).join(" ");

async function gerar(texto, saida) {
  const corpo = {
    model: ROTEIRO.voz.modelo,
    input: [{ type: "user_input", content: [{ type: "text", text: texto, annotations: [{ type: "speech_metadata", style: estilo }] }] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: ROTEIRO.voz.id }] },
  };
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const audios = (j.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).filter((c) => c.type === "audio");
      if (audios.length) { writeFileSync(saida, Buffer.from(audios[audios.length - 1].data, "base64")); return; }
    }
    console.log(`  falhou (${r.status}) ${JSON.stringify(j).slice(0, 200)}; tentativa ${tentativa}`);
    if (r.status === 402) throw new Error("Saldo da API Gemini zerado: os sistemas em produção também param. Parando.");
  }
  throw new Error(`não gerou ${saida}`);
}

const blocos = ROTEIRO.blocos.filter((b) => !filtro || filtro.has(b.id));
// Gera em paralelo (3 por vez), mede em sequência (o Whisper pesa).
const fila = [];
for (const b of blocos) for (let n = inicio; n < inicio + quantas; n++) fila.push({ b, n });
let i = 0;
await Promise.all([0, 1, 2].map(async () => {
  while (i < fila.length) {
    const { b, n } = fila[i++];
    const wav = join(TOMADAS, `${b.id}-${n}.wav`);
    writeFileSync(join(TOMADAS, `${b.id}.txt`), falaDoBloco(b));
    if (existsSync(wav)) continue;
    await gerar(falaDoBloco(b), wav);
    console.log(`gerada ${b.id}-${n}`);
  }
}));

for (const { b, n } of fila) {
  const base = join(TOMADAS, `${b.id}-${n}`);
  if (!existsSync(`${base}.medida.json`)) {
    execFileSync("py", ["-3", join(AQUI, "alinhar.py"), `${base}.wav`, join(TOMADAS, `${b.id}.txt`), "--modelo", modeloWhisper], { stdio: "ignore" });
    const json = execFileSync("node", [ENTONACAO, `${base}.wav`, "--json"], { encoding: "utf8" });
    writeFileSync(`${base}.medida.json`, json);
  }
}

// Placar: alertas por tomada (menos é melhor) e duração.
for (const b of blocos) {
  console.log(`\n${b.id}`);
  for (let n = inicio; n < inicio + quantas; n++) {
    const base = join(TOMADAS, `${b.id}-${n}`);
    let m = {};
    try { m = JSON.parse(readFileSync(`${base}.medida.json`, "utf8")); } catch { /* sem medida */ }
    const alertas = m.alertas || m.ALERTAS || [];
    const linhas = JSON.parse(readFileSync(`${base}.lines.json`, "utf8"));
    const dur = linhas.length ? linhas[linhas.length - 1].end : 0;
    console.log(`  tomada ${n}: ${dur.toFixed(1)} s | ${alertas.length} alerta(s)${alertas.length ? ": " + alertas.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" | ").slice(0, 400) : ""}`);
  }
}
