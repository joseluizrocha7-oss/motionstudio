// Gera a música de fundo com a Lyria (API do Gemini) e grava em film/assets/musica/<nome>.mp3,
// com o pedido ao lado (<nome>.json). O gerar-som.mjs usa a faixa com --musica.
//
// Gasta o saldo pré-pago do Gemini, o mesmo dos sistemas em produção: gerar só o necessário.
// A chave GEMINI_API_KEY vem de um .env passado com --env-file.
//
//   node --env-file=<.env> gerar-trilha.mjs <nome> ["<pedido>"] [--modelo lyria-3-pro-preview]
//
// Sem pedido, usa o que o Jose aprovou de ouvido em 28/10/2026 ("musica 5 tech"), já pedindo
// uma faixa longa. Modelos: lyria-3-pro-preview faz uns 3 min com variação (o padrão);
// lyria-3-clip-preview faz 30 s, bom para amostra, mas repetido num filme longo cansa.
// Para escolher, mande ao celular do Jose 2 ou 3 amostras curtas misturadas com a voz.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PEDIDO_APROVADO = "Modern upbeat corporate tech background, light plucked synths, soft kick and claps, optimistic and energetic but subtle, around 112 bpm, instrumental made to sit under a narrator, no vocals, steady volume from start to end. Length about 3 minutes, one continuous piece with gentle variation every 30 seconds and a soft ending.";
const args = process.argv.slice(2).filter((a, i, t) => a !== "--modelo" && t[i - 1] !== "--modelo");
const [nome, pedido = PEDIDO_APROVADO] = args;
if (!nome) { console.error("uso: node --env-file=<.env> gerar-trilha.mjs <nome> [\"<pedido>\"] [--modelo lyria-3-pro-preview]"); process.exit(2); }
const i = process.argv.indexOf("--modelo");
const modelo = i > 0 ? process.argv[i + 1] : "lyria-3-pro-preview";

const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: pedido }] }] }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 500)}`); process.exit(1); }
const pasta = join(AQUI, "film", "assets", "musica");
mkdirSync(pasta, { recursive: true });
let n = 0;
for (const c of j.candidates || []) for (const p of c.content?.parts || []) {
  const d = p.inlineData || p.inline_data;
  if (d?.data) {
    const ext = { "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3" }[d.mimeType] || "bin";
    const arq = join(pasta, `${nome}${n ? "-" + n : ""}.${ext}`);
    writeFileSync(arq, Buffer.from(d.data, "base64"));
    console.log(arq, d.mimeType); n++;
  } else if (p.text) console.log("texto:", p.text.slice(0, 200));
}
if (!n) { console.error("sem áudio: " + JSON.stringify(j).slice(0, 500)); process.exit(1); }
writeFileSync(join(pasta, `${nome}.json`), JSON.stringify({ modelo, pedido }, null, 1));
