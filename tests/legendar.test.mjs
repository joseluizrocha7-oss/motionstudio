import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEGENDAR = join(RAIZ, "scripts", "legendar.mjs");

// Média, máximo e quantidade de pixels escuros (< 90) da faixa de baixo (1920x200, em cinza cru) do quadro no instante t.
function lerFaixa(video, t) {
  const bytes = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1",
    "-vf", "crop=1920:200:0:860", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 26 });
  assert.equal(bytes.length, 1920 * 200, "o quadro tem que ter 1920x200 bytes em cinza");
  return { media: bytes.reduce((s, b) => s + b, 0) / bytes.length, maximo: bytes.reduce((m, b) => (b > m ? b : m), 0),
    escuros: bytes.reduce((n, b) => n + (b < 90 ? 1 : 0), 0) };
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
    // sai 0 no cinza cru, não 16); com legenda (contorno, o padrão) a média é 1,84 e o máximo é 255 (texto branco);
    // com --estilo caixa a média é 2,45. A média é baixa porque o texto ocupa pouco da faixa; o "> 10" do plano
    // não vale para este estilo.
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

// ---------- recusas (não codificam: o erro vem antes do ffmpeg) ----------

// Vídeos pretos de 1 s, criados uma vez por arquivo de teste (preset ultrafast: é só o cenário do teste).
const OFICINA = mkdtempSync(join(tmpdir(), "legendar-teste-"));
const videos = {};
function videoPreto(tamanho) {
  if (!videos[tamanho]) {
    const arq = join(OFICINA, `preto-${tamanho}.mp4`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=black:s=${tamanho}:d=1:r=10`,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", arq]);
    videos[tamanho] = arq;
  }
  return videos[tamanho];
}
after(() => rmSync(OFICINA, { recursive: true, force: true }));

// Roda o legendar.mjs; devolve { status, stderr, stdout, saida }.
function legendarCom(video, conteudoSrt, extras = []) {
  const srt = join(OFICINA, `l-${Math.random().toString(36).slice(2)}.srt`);
  const saida = join(OFICINA, `s-${Math.random().toString(36).slice(2)}.mp4`);
  writeFileSync(srt, conteudoSrt, "utf8");
  const r = spawnSync(process.execPath, [LEGENDAR, video, srt, saida, ...extras], { encoding: "utf8" });
  return { ...r, saida };
}
const srtDe = (...linhas) => `1\n00:00:00,000 --> 00:00:00,800\n${linhas.join("\n")}\n`;

test("legendar recusa --formato diferente do vídeo (9x16 num vídeo 1920x1080)", () => {
  const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--formato", "9x16"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /^legendar: /);
  assert.match(r.stderr, /1920x1080/);
  assert.match(r.stderr, /16x9/);
  assert.match(r.stderr, /--formato 9x16/);
  assert.ok(!existsSync(r.saida), "não pode gravar a saída");
});
test("legendar recusa --formato inválido", () => {
  const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--formato", "4x3"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /formato inválido: "4x3"/);
});
test("legendar tira o formato do vídeo: linha de 40 caracteres num 1080x1920 sem --formato (limite 32) sai com código 1", () => {
  const longa = "abcdefghij".repeat(4);
  assert.equal(longa.length, 40);
  const r = legendarCom(videoPreto("1080x1920"), srtDe(longa));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stderr.includes(longa), `a mensagem tem que citar a linha: ${r.stderr}`);
  assert.match(r.stderr, /32/);
  assert.match(r.stderr, /9x16/);
  assert.match(r.stderr, /--formato/);
  assert.match(r.stderr, /roteiro/);
  assert.ok(!existsSync(r.saida), "não pode gravar a saída");
});
test("legendar usa o limite do 16x9 (42) num vídeo paisagem: linha de 50 recusada", () => {
  const r = legendarCom(videoPreto("1920x1080"), srtDe("a".repeat(50)));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /50 caracteres/);
  assert.match(r.stderr, /limite do 16x9 é 42/);
});
test("legendar recusa .srt sem nenhuma legenda (vazio, só espaço, só BOM)", () => {
  for (const conteudo of ["", "\n\n", "\uFEFF\n"]) {
    const r = legendarCom(videoPreto("1080x1920"), conteudo);
    assert.equal(r.status, 1, JSON.stringify(conteudo));
    assert.match(r.stderr, /0 blocos/);
    assert.ok(!existsSync(r.saida));
  }
});
test("legendar recusa vídeo quadrado: nenhum formato serve", () => {
  const r = legendarCom(videoPreto("1080x1080"), srtDe("Teste curto"));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /quadrado/);
});

// ---------- --estilo, --cor-contorno e --cor-caixa: os pares errados saem antes do ffmpeg ----------

test("legendar recusa --estilo desconhecido", () => {
  const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--estilo", "borda"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /^legendar: /);
  assert.match(r.stderr, /estilo inválido: "borda"/);
  assert.match(r.stderr, /contorno/); assert.match(r.stderr, /caixa/);
  assert.ok(!existsSync(r.saida), "não pode gravar a saída");
});
test("legendar recusa --cor-caixa sem --estilo caixa (o padrão é contorno)", () => {
  for (const extras of [["--cor-caixa", "#032B6B"], ["--estilo", "contorno", "--cor-caixa", "#032B6B"]]) {
    const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), extras);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /--cor-caixa só vale com --estilo caixa/);
    assert.match(r.stderr, /--cor-contorno/);
    assert.ok(!existsSync(r.saida), "não pode gravar a saída");
  }
});
test("legendar recusa --cor-contorno com --estilo caixa", () => {
  const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--estilo", "caixa", "--cor-contorno", "#032B6B"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /--cor-contorno só vale com --estilo contorno/);
  assert.match(r.stderr, /--cor-caixa/);
  assert.ok(!existsSync(r.saida), "não pode gravar a saída");
});
test("legendar recusa cor inválida no --cor-contorno e no --cor-caixa", () => {
  let r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--cor-contorno", "azul"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /cor inválida: "azul"/);
  r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--estilo", "caixa", "--cor-caixa", "#12345"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /cor inválida: "#12345"/);
});

// ---------- o estilo no quadro: contorno (padrão) não escurece o fundo, caixa escurece ----------

// Fundo cinza 1920x1080 de 1 s: a faixa de baixo mostra se há caixa (escurece em volta do texto) ou só contorno.
test("legendar: o padrão (contorno) deixa o fundo cinza como está; --estilo caixa escurece a faixa", () => {
  const cinza = join(OFICINA, "cinza-1920x1080.mp4");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=0x808080:s=1920x1080:d=1:r=10",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", cinza]);
  const srt = srtDe("Teste de legenda sem caixa");
  const semCaixa = legendarCom(cinza, srt);
  const comCaixa = legendarCom(cinza, srt, ["--estilo", "caixa"]);
  assert.equal(semCaixa.status, 0, semCaixa.stdout + semCaixa.stderr);
  assert.equal(comCaixa.status, 0, comCaixa.stdout + comCaixa.stderr);
  const a = lerFaixa(semCaixa.saida, 0.4), b = lerFaixa(comCaixa.saida, 0.4);
  // Medido em 28/10/2026 (cinza 128, fonte 40, faixa 1920x200, pixels abaixo de 90): contorno = 5482 pixels (só a
  // borda e a sombra das letras), média 127,6; caixa = 25715 pixels (a faixa inteira), média 123,0.
  assert.ok(a.media > 120, `contorno: a média da faixa devia ficar perto do cinza 128 do fundo: ${a.media}`);
  assert.ok(a.escuros > 0, "contorno: a borda preta das letras tem que aparecer");
  assert.ok(b.escuros > 2 * a.escuros, `caixa: devia ter mais de 2 x os pixels escuros do contorno (${a.escuros}): ${b.escuros}`);
});

// ---------- a legenda num vídeo retrato (única codificação nova: 1 s, 1080x1920) ----------

test("legendar grava a legenda num vídeo 1080x1920 quando o --formato 9x16 bate com o vídeo", () => {
  const r = legendarCom(videoPreto("1080x1920"), srtDe("Linha curta do teste", "com duas linhas"), ["--formato", "9x16"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /legendado: /);
  const tam = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
    "-of", "csv=s=x:p=0", r.saida], { encoding: "utf8" }).trim();
  assert.equal(tam, "1080x1920");
});
