// Trilha, efeitos e mixagem do filme (kit da skill motionstudio).
//
//   node conteudo/tutorial-primeiros-passos-2026-10-16/gerar-som.mjs [eventos.json]
//
// Lê os eventos que o render grava ao lado do vídeo (toques, gestos, a marca
// final), sintetiza a trilha e os efeitos (trilha.mjs, sem amostra de
// terceiros) e mistura com a narração (film/audio/vo.wav, que começa em
// FALA.offset). Uma trilha num volume só do começo ao fim, 20 dB abaixo da
// voz (--abaixo); poucos efeitos, baixos. A trilha desce nos últimos 1,6 s.
//
// Música pronta no lugar da sintetizada (o padrão desde 28/10/2026: o Jose achou "chata" a
// trilha de código e escolheu de ouvido uma faixa tech da Lyria 3 Pro, gerada por
// gerar-trilha.mjs, "uns 30% mais baixa" que a de 15,5 dB):
//   --musica assets/musica/<faixa>.mp3 [--abaixo 20]
// A faixa se repete com 4 s de transição até cobrir o filme.
//
// Efeito gravado no lugar do sintetizado (opção, em teste desde 19/10/2026):
//   --toque pop-hand | mouse-click-2     o toque na tela
//   --ar fast-whoosh                     o celular entrando e a lista arrastada
// Os sons ficam em efeitos-gravados/ (domínio público, CC0). Sem a opção, tudo sintetizado.
//
// Modo comercial (desde 29/10/2026): efeitos por evento rotulado (M.mark), escolhidos num mapa
// de rótulo para efeito e afinados no tom medido da música; música 20 dB sob a voz, pausa curta
// opcional e a mistura em -16 LUFS em 2 passadas. Opções e formato do mapa em som-comercial.mjs.
//   --comercial sons.json --total <s> [--musica assets/musica/<faixa>.mp3] [--pausa <s>]
// Sem --comercial, nada muda no modo de tutorial abaixo.
import { execFileSync, spawnSync } from "node:child_process";
// Sonoridade integrada de um arquivo (EBU R128).
function lufsDe(arq) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const s = (r.stderr || "");
  const mI = /I:\s+(-?[\d.]+) LUFS/.exec(s.slice(s.lastIndexOf("Summary")));
  if (!mI) throw new Error(`não li a sonoridade de ${arq}`);
  return Number(mI[1]);
}
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarAudio } from "./trilha.mjs";

// Versão curta: node gerar-som.mjs <eventos> --audio audio-curto --fala fala-curto.js --total 59.4
const AQUI = dirname(fileURLToPath(import.meta.url));
const opcao = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
// Opção que o script não conhece (erro de digitação, ou do modo comercial num gerar-som.mjs antigo) sai com 1; antes era ignorada.
const OPCOES = ["audio", "fala", "total", "toque", "ar", "musica", "abaixo",                                    // tutorial
  "comercial", "musica-inicio", "tom", "modo", "pausa", "pausa-dur", "voz", "voz-inicio", "sem-voz", "fps"];   // comercial
const desconhecida = process.argv.slice(2).find((a) => a.startsWith("--") && !OPCOES.includes(a.slice(2)));
if (desconhecida) {
  console.error(`erro: opção ${desconhecida} desconhecida. Opções: ${OPCOES.map((o) => "--" + o).join(", ")}`);
  process.exit(1);
}
if (process.argv.includes("--comercial")) {
  let modoComercial;
  try { ({ modoComercial } = await import("./som-comercial.mjs")); }
  catch (e) {
    // Projeto criado antes de 29/10/2026: sem som-comercial.mjs, com o trilha.mjs sem a linha de export, ou (antes de 28/10) sem _skill.mjs.
    if (e.code !== "ERR_MODULE_NOT_FOUND" && !/does not provide an export/.test(e.message)) throw e;
    let kit = "a pasta kit/ da skill";
    try { kit = join((await import("./_skill.mjs")).acharSkill(AQUI), "kit"); } catch { /* projeto sem _skill.mjs */ }
    console.error(`erro: o modo comercial precisa de som-comercial.mjs, de _skill.mjs e do trilha.mjs novo (com a linha de export) na pasta do projeto. Copie os 3 arquivos de ${kit} para ${AQUI}. O modo de tutorial funciona sem eles. (${e.message.split("\n")[0]})`);
    process.exit(1);
  }
  try { await modoComercial(AQUI, process.argv.slice(2)); }
  catch (e) { console.error(`erro: ${e.message}`); process.exit(1); }
  process.exit(0);
}
const AUDIO = join(AQUI, "film", opcao("audio", "audio"));
const argEventos = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : join(AQUI, "film", "stills", "events.json");
const eventos = JSON.parse(readFileSync(argEventos, "utf8"));
const fala = readFileSync(join(AQUI, "film", "assets", opcao("fala", "fala.js")), "utf8");
const OFFSET = JSON.parse(fala.slice(fala.indexOf("{"), fala.lastIndexOf("}") + 1)).offset;
const TOTAL = Number(opcao("total", "179.5"));
const troca = {};
if (opcao("toque")) troca.pop = opcao("toque");
if (opcao("ar")) troca.ar = opcao("ar");

const efeitos = [{ tipo: "sino", t: 0.2 }];
for (const e of eventos) {
  const t = e.t ?? e.frame / 30;
  if (e.type === "press") efeitos.push({ tipo: "pop", t: t - 0.01 });
  else if (e.type === "whip" && /aprovar$/.test(e.label) && /gesto/.test(e.label)) efeitos.push({ tipo: "aprovar", t: t + 0.12 });
  else if (e.type === "whip" && /reprovar$/.test(e.label) && /gesto/.test(e.label)) efeitos.push({ tipo: "reprovar", t: t + 0.12 });
  else if (e.type === "whip" && /pular$/.test(e.label)) efeitos.push({ tipo: "pular", t: t + 0.12 });
  else if (e.type === "whip" && /lista-arrasto/.test(e.label)) efeitos.push({ tipo: "ar", t });
  else if (e.type === "enter" && (e.label === "celular" || e.label === "janela")) efeitos.push({ tipo: "ar", t: t - 0.1 });   // celular no 9:16, janela do computador no 16:9
  else if (e.type === "enter" && e.label === "marca final") efeitos.push({ tipo: "assinatura", t: t + 0.25 });
}
efeitos.sort((a, b) => a.t - b.t);
const contagem = {};
for (const e of efeitos) contagem[e.tipo] = (contagem[e.tipo] || 0) + 1;
console.log(`efeitos: ${efeitos.length}`, contagem);
import("node:fs").then(({ writeFileSync }) => writeFileSync(join(AUDIO, "sfx-eventos.json"), JSON.stringify(efeitos.map((e) => ({ t: +e.t.toFixed(3), sfx: troca[e.tipo] || e.tipo, gain: 0 })), null, 1)));

let trilha = join(AUDIO, "trilha.wav");
const fx = join(AUDIO, "efeitos.wav");
gerarAudio({ total: TOTAL, tempos: { cenas: { marca: { inicio: 1.2 } } }, efeitos, arquivoTrilha: trilha, arquivoEfeitos: fx, troca });
const MUSICA = opcao("musica", null);
const ABAIXO = Number(opcao("abaixo", "20"));
if (MUSICA) {
  const arq = join(AQUI, "film", MUSICA);
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq], { encoding: "utf8" }));
  const X = 4;
  const vezes = Math.max(1, Math.ceil((TOTAL - X) / (dur - X)));
  const entradas = Array.from({ length: vezes }, () => ["-i", arq]).flat();
  let filtro = Array.from({ length: vezes }, (_, i) => `[${i}]aresample=48000,aformat=channel_layouts=stereo[f${i}];`).join("");
  let ultimo = "f0";
  for (let i = 1; i < vezes; i++) { filtro += `[${ultimo}][f${i}]acrossfade=d=${X}:c1=tri:c2=tri[x${i}];`; ultimo = `x${i}`; }
  filtro += `[${ultimo}]atrim=0:${TOTAL},asetpts=N/SR/TB,afade=t=in:d=1[o]`;
  trilha = join(AUDIO, "musica.wav");
  execFileSync("ffmpeg", ["-v", "error", "-y", ...entradas, "-filter_complex", filtro, "-map", "[o]", "-c:a", "pcm_s16le", trilha]);
  console.log(`música: ${MUSICA}, ${dur.toFixed(1)} s, ${vezes} vez(es)`);
}
console.log(`trilha ${ABAIXO} dB sob a voz`);
if (Object.keys(troca).length) console.log("efeitos gravados:", troca);

// Mixagem: cada faixa nivelada antes (voz -16 LUFS, trilha -30, efeitos com
// ganho fixo), soma sem normalizar e limitador no fim.
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
const atraso = Math.round(OFFSET * 1000);
const VO = join(AUDIO, "vo.wav");
ff([
  "-i", VO, "-i", trilha, "-i", fx,
  "-filter_complex",
  `[0]aresample=48000,aformat=channel_layouts=stereo,volume=${(-16 - lufsDe(VO)).toFixed(2)}dB,adelay=${atraso}|${atraso},apad[v];` +
  `[1]volume=${(-16 - ABAIXO - lufsDe(trilha)).toFixed(2)}dB[m];` +
  `[2]volume=0.9[e];` +
  `[v][m][e]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.8:level=0,atrim=0:${TOTAL},afade=t=out:st=${(TOTAL - 1.6).toFixed(2)}:d=1.6[s]`,   // a trilha desce no fim, sem cortar seco (Jose, 17/10)
  "-map", "[s]", "-ar", "48000", "-c:a", "pcm_s16le", join(AUDIO, "mix.wav"),
]);
const medida = execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-i", join(AUDIO, "mix.wav"), "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).toString();
console.log("mix.wav pronto");
