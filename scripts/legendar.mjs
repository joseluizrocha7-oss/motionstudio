// Grava a legenda (.srt) dentro do MP4 com o ffmpeg e o libass, sem renderizar o filme de novo.
// O vídeo é recodificado (libx264, como no render); o áudio é copiado.
//
// Comando:
//   node legendar.mjs <video.mp4> <legenda.srt> <saida.mp4> [--formato 16x9|9x16] [--estilo contorno|caixa]
//                     [--cor-contorno #RRGGBB] [--cor-caixa #RRGGBB] [--margem-esq N] [--margem-dir N]
//
// O estilo padrão é "contorno": letra branca com borda preta e sombra suave, sem caixa. "caixa" põe uma faixa
// atrás do texto (para filmagem de câmera ou fundo cheio de detalhe). --cor-contorno só vale com contorno e
// --cor-caixa só vale com caixa; o par errado sai com código 1.
//
// O formato sai do tamanho do vídeo (ffprobe): paisagem = 16x9, retrato = 9x16. O --formato é opcional; se vier
// e não bater com o vídeo, o comando para. O .srt precisa ter sido gerado para o mesmo formato: o limite de
// caracteres por linha muda (16x9 = 42; 9x16 = 32). Linha maior que o limite, .srt sem legenda e vídeo
// quadrado saem com código 1.
//
// Caminho do Windows: o filtro ass não aceita bem "C:\...", espaço nem acento. Por isso o ffmpeg roda
// numa pasta temporária (cwd) com o legenda.ass e a fonte, e o filtro usa só nomes relativos.
// Os caminhos do vídeo e da saída vão como argumentos do ffmpeg, nunca dentro do filtro.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITES, lerSrt, paraAss } from "../kit/gerar-legenda.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = join(AQUI, "..", "runtime", "hero3d", "fonts", "Inter-Bold-Latin.ttf");
const USO = "uso: node legendar.mjs <video.mp4> <legenda.srt> <saida.mp4> [--formato 16x9|9x16] [--estilo contorno|caixa] [--cor-contorno #RRGGBB] [--cor-caixa #RRGGBB] [--margem-esq N] [--margem-dir N]";
const OPCOES = ["formato", "estilo", "cor-contorno", "cor-caixa", "margem-esq", "margem-dir"];
const ESTILOS = ["contorno", "caixa"];

// Separa os 3 caminhos (sem --) das opções (--nome valor).
function lerArgumentos(argv) {
  const posicionais = [], opcoes = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) { posicionais.push(argv[i]); continue; }
    const nome = argv[i].slice(2);
    if (!OPCOES.includes(nome)) throw new Error(`opção desconhecida: ${argv[i]}\n${USO}`);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) throw new Error(`falta o valor de ${argv[i]}`);
    opcoes[nome] = argv[++i];
  }
  if (posicionais.length !== 3) throw new Error(USO);
  return { posicionais, opcoes };
}

// Margem lateral em pixels: número maior ou igual a 0.
function margem(nome, valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${nome} inválido: "${valor}" (use um número de pixels, 0 ou mais)`);
  return n;
}

// Lê a largura e a altura do vídeo com o ffprobe e devolve o formato: paisagem = "16x9", retrato = "9x16".
function formatoDoVideo(video) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
    "-of", "json", video], { encoding: "utf8" });
  if (r.error) throw new Error(`não consegui rodar o ffprobe: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`o ffprobe não leu ${video} (código ${r.status}): ${(r.stderr ?? "").trim()}`);
  let fluxo;
  try { fluxo = JSON.parse(r.stdout).streams?.[0]; } catch { fluxo = null; }
  const { width: l, height: a } = fluxo ?? {};
  if (!(l > 0 && a > 0)) throw new Error(`${video} não tem trilha de vídeo com largura e altura`);
  if (l === a) throw new Error(`o vídeo é quadrado (${l}x${a}): a legenda só existe para 16x9 (paisagem) e 9x16 (retrato)`);
  return { tamanho: `${l}x${a}`, formato: l > a ? "16x9" : "9x16" };
}

function legendar(argv) {
  const { posicionais, opcoes } = lerArgumentos(argv);
  // Caminhos absolutos: o ffmpeg roda em outra pasta (cwd), então os relativos quebrariam.
  const [video, srt, saida] = posicionais.map((p) => resolve(p));
  for (const arq of [video, srt]) if (!existsSync(arq)) throw new Error(`não achei ${arq}`);

  if (opcoes.formato !== undefined && !LIMITES[opcoes.formato]) {
    throw new Error(`formato inválido: "${opcoes.formato}" (use ${Object.keys(LIMITES).join(" ou ")})`);
  }
  const tipo = opcoes.estilo ?? "contorno";
  if (!ESTILOS.includes(tipo)) throw new Error(`estilo inválido: "${tipo}" (use ${ESTILOS.join(" ou ")})`);
  if (opcoes["cor-caixa"] !== undefined && tipo !== "caixa") {
    throw new Error("--cor-caixa só vale com --estilo caixa. No estilo contorno (o padrão) a cor da borda é a --cor-contorno.");
  }
  if (opcoes["cor-contorno"] !== undefined && tipo !== "contorno") {
    throw new Error("--cor-contorno só vale com --estilo contorno. No estilo caixa a cor da faixa é a --cor-caixa.");
  }
  const blocos = lerSrt(readFileSync(srt, "utf8"));
  if (!blocos.length) throw new Error(`${srt} não tem nenhuma legenda (0 blocos)`);

  const { tamanho, formato } = formatoDoVideo(video);
  if (opcoes.formato !== undefined && opcoes.formato !== formato) {
    throw new Error(`o --formato ${opcoes.formato} não bate com o vídeo: ele tem ${tamanho} (${formato}). Tire o --formato: o legendar.mjs tira o formato do tamanho do vídeo.`);
  }
  // O .srt vem do gerar-legenda.mjs, que quebra a linha no limite do formato. Linha maior = .srt de outro formato (ou palavra longa).
  const { maxLinha } = LIMITES[formato];
  blocos.forEach((b, i) => {
    const longa = b.texto.split("\n").find((l) => l.length > maxLinha);
    if (longa !== undefined) {
      throw new Error(`a linha do bloco ${i + 1} do .srt tem ${longa.length} caracteres e o limite do ${formato} é ${maxLinha}: "${longa}". ` +
        `O vídeo é ${formato}. Gere o .srt com o --formato certo (node gerar-legenda.mjs --formato ${formato}) ou encurte a palavra longa no roteiro.`);
    }
  });

  const estilo = { formato, tipo };
  if (opcoes["cor-contorno"] !== undefined) estilo.corContorno = opcoes["cor-contorno"];
  if (opcoes["cor-caixa"] !== undefined) estilo.corCaixa = opcoes["cor-caixa"];
  if (opcoes["margem-esq"] !== undefined) estilo.margemEsq = margem("margem-esq", opcoes["margem-esq"]);
  if (opcoes["margem-dir"] !== undefined) estilo.margemDir = margem("margem-dir", opcoes["margem-dir"]);
  const ass = paraAss(blocos, estilo);

  const pasta = mkdtempSync(join(tmpdir(), "legendar-"));
  try {
    writeFileSync(join(pasta, "legenda.ass"), ass, "utf8");
    copyFileSync(FONTE, join(pasta, "Inter-Bold-Latin.ttf"));
    const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", video,
      "-vf", "ass=legenda.ass:fontsdir=.",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "copy", "-movflags", "+faststart", saida], { cwd: pasta, stdio: ["ignore", "inherit", "inherit"] });
    if (r.error) throw new Error(`não consegui rodar o ffmpeg: ${r.error.message}`);
    if (r.status !== 0) throw new Error(`o ffmpeg falhou (código ${r.status})`);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
  console.log(`legendado: ${saida}`);
}

try { legendar(process.argv.slice(2)); }
catch (e) { console.error(`legendar: ${e.message}`); process.exit(1); }
