// Grava a legenda (.srt) dentro do MP4 com o ffmpeg e o libass, sem renderizar o filme de novo.
// O vídeo é recodificado (libx264, como no render); o áudio é copiado.
//
// Comando:
//   node legendar.mjs <video.mp4> <legenda.srt> <saida.mp4> [--formato 16x9|9x16] [--cor-caixa #RRGGBB] [--margem-esq N] [--margem-dir N]
//
// Use o mesmo --formato que gerou o .srt: o limite de caracteres por linha muda (16x9 = 42; 9x16 = 32).
//
// Caminho do Windows: o filtro ass não aceita bem "C:\...", espaço nem acento. Por isso o ffmpeg roda
// numa pasta temporária (cwd) com o legenda.ass e a fonte, e o filtro usa só nomes relativos.
// Os caminhos do vídeo e da saída vão como argumentos do ffmpeg, nunca dentro do filtro.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lerSrt, paraAss } from "../kit/gerar-legenda.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = join(AQUI, "..", "runtime", "hero3d", "fonts", "Inter-Bold-Latin.ttf");
const USO = "uso: node legendar.mjs <video.mp4> <legenda.srt> <saida.mp4> [--formato 16x9|9x16] [--cor-caixa #RRGGBB] [--margem-esq N] [--margem-dir N]";
const OPCOES = ["formato", "cor-caixa", "margem-esq", "margem-dir"];

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

function legendar(argv) {
  const { posicionais, opcoes } = lerArgumentos(argv);
  // Caminhos absolutos: o ffmpeg roda em outra pasta (cwd), então os relativos quebrariam.
  const [video, srt, saida] = posicionais.map((p) => resolve(p));
  for (const arq of [video, srt]) if (!existsSync(arq)) throw new Error(`não achei ${arq}`);

  const estilo = { formato: opcoes.formato ?? "16x9" };
  if (opcoes["cor-caixa"] !== undefined) estilo.corCaixa = opcoes["cor-caixa"];
  if (opcoes["margem-esq"] !== undefined) estilo.margemEsq = margem("margem-esq", opcoes["margem-esq"]);
  if (opcoes["margem-dir"] !== undefined) estilo.margemDir = margem("margem-dir", opcoes["margem-dir"]);
  const ass = paraAss(lerSrt(readFileSync(srt, "utf8")), estilo);

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
