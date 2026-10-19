// Trilha, efeitos e mixagem do filme (kit da skill motionstudio).
//
//   node conteudo/tutorial-primeiros-passos-2026-10-16/gerar-som.mjs [eventos.json]
//
// Lê os eventos que o render grava ao lado do vídeo (toques, gestos, a marca
// final), sintetiza a trilha e os efeitos (trilha.mjs, sem amostra de
// terceiros) e mistura com a narração (film/audio/vo.wav, que começa em
// FALA.offset). Uma trilha num volume só do começo ao fim, uns 14 dB abaixo da
// voz; poucos efeitos, baixos. A trilha desce nos últimos 1,6 s.
//
// Efeito gravado no lugar do sintetizado (opção, em teste desde 19/10/2026):
//   --toque pop-hand | mouse-click-2     o toque na tela
//   --ar fast-whoosh                     o celular entrando e a lista arrastada
// Os sons ficam em efeitos-gravados/ (domínio público, CC0). Sem a opção, tudo sintetizado.
import { execFileSync, spawnSync } from "node:child_process";
// Sonoridade integrada de um arquivo (EBU R128).
function lufsDe(arq) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
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
  else if (e.type === "enter" && e.label === "celular") efeitos.push({ tipo: "ar", t: t - 0.1 });
  else if (e.type === "enter" && e.label === "marca final") efeitos.push({ tipo: "assinatura", t: t + 0.25 });
}
efeitos.sort((a, b) => a.t - b.t);
const contagem = {};
for (const e of efeitos) contagem[e.tipo] = (contagem[e.tipo] || 0) + 1;
console.log(`efeitos: ${efeitos.length}`, contagem);
import("node:fs").then(({ writeFileSync }) => writeFileSync(join(AUDIO, "sfx-eventos.json"), JSON.stringify(efeitos.map((e) => ({ t: +e.t.toFixed(3), sfx: troca[e.tipo] || e.tipo, gain: 0 })), null, 1)));

const trilha = join(AUDIO, "trilha.wav"), fx = join(AUDIO, "efeitos.wav");
gerarAudio({ total: TOTAL, tempos: { cenas: { marca: { inicio: 1.2 } } }, efeitos, arquivoTrilha: trilha, arquivoEfeitos: fx, troca });
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
  `[1]volume=${(-31.5 - lufsDe(trilha)).toFixed(2)}dB[m];` +
  `[2]volume=0.9[e];` +
  `[v][m][e]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.8:level=0,atrim=0:${TOTAL},afade=t=out:st=${(TOTAL - 1.6).toFixed(2)}:d=1.6[s]`,   // a trilha desce no fim, sem cortar seco (Jose, 17/10)
  "-map", "[s]", "-ar", "48000", "-c:a", "pcm_s16le", join(AUDIO, "mix.wav"),
]);
const medida = execFileSync("ffmpeg", ["-hide_banner", "-i", join(AUDIO, "mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).toString();
console.log("mix.wav pronto");
