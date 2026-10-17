// Gera uma tomada de narração com o Gemini TTS (Interactions API) e grava WAV.
// Gasta o saldo pré-pago da API Gemini (o mesmo dos sistemas em produção):
// gerar só o necessário.
//   node --env-file=.env tts.mjs --texto "..." --saida arquivo.wav [--voz pt-br-training-1] [--estilo "..."] [--modelo gemini-3.8-flash-tts]
import { writeFileSync, readFileSync } from "node:fs";

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const texto = arg("texto") ?? (arg("arquivo") ? readFileSync(arg("arquivo"), "utf8").trim() : null);
const saida = arg("saida");
const voz = arg("voz", "pt-br-training-1");
const modelo = arg("modelo", "gemini-3.8-flash-tts");
const estilo = arg("estilo");
if (!texto || !saida) { console.error("uso: --texto ... --saida ..."); process.exit(1); }

const conteudo = { type: "text", text: texto };
if (estilo) conteudo.annotations = [{ type: "speech_metadata", style: estilo }];
const corpo = {
  model: modelo,
  input: [{ type: "user_input", content: [conteudo] }],
  response_format: { type: "audio" },
  generation_config: { speech_config: [{ voice: voz }] },
};
const t0 = Date.now();
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
  method: "POST",
  headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});
const j = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(j).slice(0, 800)); process.exit(1); }
const audios = (j.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).filter((c) => c.type === "audio");
if (!audios.length) { console.error("sem áudio na resposta:", JSON.stringify(j).slice(0, 800)); process.exit(1); }
const buf = Buffer.from(audios[audios.length - 1].data, "base64");
writeFileSync(saida, buf);
const uso = j.usage || j.usage_metadata || null;
console.log(`ok: ${saida} (${(buf.length / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s)${uso ? " uso " + JSON.stringify(uso) : ""}`);
