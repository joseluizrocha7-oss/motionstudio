import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEGENDAR = join(RAIZ, "scripts", "legendar.mjs");

// Média e máximo dos bytes da faixa de baixo (1920x200, em cinza cru) do quadro no instante t.
function lerFaixa(video, t) {
  const bytes = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1",
    "-vf", "crop=1920:200:0:860", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 26 });
  assert.equal(bytes.length, 1920 * 200, "o quadro tem que ter 1920x200 bytes em cinza");
  return { media: bytes.reduce((s, b) => s + b, 0) / bytes.length, maximo: bytes.reduce((m, b) => (b > m ? b : m), 0) };
}

test("legendar grava a legenda num caminho com espaço e acento", () => {
  const pasta = join(mkdtempSync(join(tmpdir(), "motionstudio-")), "teste legenda ção");
  mkdirSync(pasta, { recursive: true });
  try {
    const entrada = join(pasta, "entrada preta.mp4");
    const srt = join(pasta, "legenda ção.srt");
    const saida = join(pasta, "saída legendada.mp4");
    // 3 s de vídeo preto 1920x1080 com áudio mudo.
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=black:s=1920x1080:d=3:r=30",
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", entrada]);
    writeFileSync(srt, "1\n00:00:00,500 --> 00:00:02,500\nTeste de legenda\n", "utf8");

    const r = execFileSync("node", [LEGENDAR, entrada, srt, saida], { encoding: "utf8" });
    assert.match(r, /legendado: /);

    // Medido em 28/10/2026 (fonte 40 em 1920x1080, faixa 1920x200): sem legenda a média é 0,0000 (o preto
    // sai 0 no cinza cru, não 16); com legenda a média é 2,45 e o máximo é 255 (texto branco). A média é
    // baixa porque o texto ocupa pouco da faixa; o "> 10" do plano não vale para este estilo.
    // Por isso: sem legenda < 0,5 (preto medido + 0,5) e com legenda >= 3 x o sem + 1.
    const com = lerFaixa(saida, 1.5);
    const sem = lerFaixa(saida, 2.9);
    assert.ok(sem.media < 0.5, `sem legenda (2,9 s) a média da faixa devia ficar abaixo de 0,5: ${sem.media}`);
    assert.ok(com.media >= 3 * sem.media + 1, `com legenda (1,5 s) a média da faixa devia ser pelo menos 3 x a de sem legenda + 1: ${com.media}`);
    assert.ok(com.maximo > 200, `com legenda (1,5 s) devia haver pixel de texto branco na faixa: máximo ${com.maximo}`);

    const duracao = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", saida], { encoding: "utf8" }));
    assert.ok(Math.abs(duracao - 3) <= 0.05, `duração da saída: ${duracao}`);
  } finally {
    rmSync(dirname(pasta), { recursive: true, force: true });
  }
});
