// Lista as vozes pt-BR da biblioteca do Gemini TTS (só leitura, não gera áudio).
//   node --env-file=.env conteudo/tutorial-primeiros-passos-2026-10-16/vozes/listar-vozes.mjs [male|female]
const genero = process.argv[2];
const qs = new URLSearchParams({ language_code: "pt-BR", page_size: "200" });
if (genero) qs.append("gender", genero);
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/voices?${qs}`, {
  headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
});
const j = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(j).slice(0, 500)); process.exit(1); }
for (const v of j.voices || []) {
  console.log([v.id, v.display_name, v.gender, v.pitch, v.accent, (v.persona || ""), (v.contexts || []).join("/"), (v.description || "").slice(0, 110)].join(" | "));
}
console.log(`total: ${(j.voices || []).length}${j.next_page_token ? " (há mais páginas)" : ""}`);
