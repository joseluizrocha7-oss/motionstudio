import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { paraAss } from "../kit/gerar-legenda.mjs";

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
test("legendar tira o formato do vídeo: linha de 40 caracteres num 1080x1920 sem --formato (limite 28) sai com código 1", () => {
  const longa = "abcdefghij".repeat(4);
  assert.equal(longa.length, 40);
  const r = legendarCom(videoPreto("1080x1920"), srtDe(longa));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stderr.includes(longa), `a mensagem tem que citar a linha: ${r.stderr}`);
  assert.match(r.stderr, /limite do 9x16 é 28/);
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

// ---------- --cor-texto ----------

// No Git Bash, "--cor-texto #032B6B" sem aspas perde a cor (o # abre um comentário): o argumento fica sem valor.
test("legendar: cor sem valor (o # sem aspas do Git Bash) manda pôr a cor entre aspas", () => {
  for (const opcao of ["--cor-texto", "--cor-contorno", "--cor-caixa"]) {
    const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), [opcao]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, new RegExp(`falta o valor de ${opcao}`));
    assert.ok(r.stderr.includes('ponha a cor entre aspas: "#RRGGBB"'), r.stderr);
    assert.ok(!existsSync(r.saida), "não pode gravar a saída");
  }
  const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--cor-texto", "--estilo", "caixa"]);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes('ponha a cor entre aspas: "#RRGGBB"'), r.stderr);
  // As outras opções sem valor seguem com a mensagem curta.
  const m = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--margem-esq"]);
  assert.equal(m.status, 1);
  assert.match(m.stderr, /falta o valor de --margem-esq/);
  assert.ok(!m.stderr.includes("aspas"), m.stderr);
});

test("legendar recusa --cor-texto inválido", () => {
  const r = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--cor-texto", "azul"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /^legendar: /);
  assert.match(r.stderr, /cor inválida: "azul"/);
  assert.ok(!existsSync(r.saida), "não pode gravar a saída");
});
test("legendar: --cor-texto troca a cor da letra (cinza 808080 sobre preto: o máximo da faixa cai de 255 para perto de 128)", () => {
  const padrao = legendarCom(videoPreto("1920x1080"), srtDe("Teste de legenda"));
  const cinza = legendarCom(videoPreto("1920x1080"), srtDe("Teste de legenda"), ["--cor-texto", "#808080"]);
  assert.equal(padrao.status, 0, padrao.stdout + padrao.stderr);
  assert.equal(cinza.status, 0, cinza.stdout + cinza.stderr);
  const a = lerFaixa(padrao.saida, 0.4), b = lerFaixa(cinza.saida, 0.4);
  assert.ok(a.maximo > 200, `padrão: letra branca, máximo da faixa devia passar de 200: ${a.maximo}`);
  assert.ok(b.maximo > 100 && b.maximo < 170, `--cor-texto #808080: máximo da faixa devia ficar perto de 128: ${b.maximo}`);
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
  // Medido em 28/10/2026 (cinza 128, fonte 40, faixa 1920x200, pixels abaixo de 90): contorno = 5253 pixels (só a
  // borda e a sombra das letras), média 127,8; caixa = 25715 pixels (a faixa inteira), média 123,0.
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

// ---------- WrapStyle 2: o libass não quebra a linha que o kit já quebrou ----------

// Altura (em pixels) da tinta escura (< 70) do contorno de uma legenda 9x16 desenhada num quadro cinza 1080x1920, pelo libass,
// do mesmo jeito do legendar.mjs: pasta temporária com o legenda.ass e a fonte, filtro só com nomes relativos.
function alturaDaTinta9x16(ass) {
  const pasta = mkdtempSync(join(tmpdir(), "legendar-wrap-"));
  try {
    writeFileSync(join(pasta, "legenda.ass"), ass, "utf8");
    copyFileSync(join(RAIZ, "runtime", "hero3d", "fonts", "Inter-Bold-Latin.ttf"), join(pasta, "Inter-Bold-Latin.ttf"));
    const bytes = execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=0x808080:s=1080x1920:r=1:d=1",
      "-vf", "ass=legenda.ass:fontsdir=.", "-frames:v", "1", "-pix_fmt", "gray", "-f", "rawvideo", "-"], { cwd: pasta, maxBuffer: 1 << 26 });
    assert.equal(bytes.length, 1080 * 1920);
    let y0 = 1920, y1 = -1;
    for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) if (bytes[y * 1080 + x] < 70) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
    return y1 - y0 + 1;
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}
test("paraAss com WrapStyle 2: o libass mantém 1 linha mesmo quando a linha passa dos 920 px úteis do 9x16 (sem a opção, ela virava 2)", () => {
  // 38 caracteres largos (M, W, ç, ã): medido em 28/10/2026, passam dos 920 px e o libass, sem WrapStyle 2, quebra em 2 linhas.
  const larga = "Mamãe Wilma Município Mudança Comissão";
  const ass = paraAss([{ a: 0, b: 1, texto: larga }], { formato: "9x16" });
  const com = alturaDaTinta9x16(ass);
  const sem = alturaDaTinta9x16(ass.replace("WrapStyle: 2\n", ""));
  assert.ok(sem > 90, `sem WrapStyle 2 o libass devia quebrar a linha larga em 2 (altura ~104): ${sem}`);
  assert.ok(com < 70, `com WrapStyle 2 a linha devia ficar inteira (altura ~50): ${com}`);
  // E a quebra que o kit põe continua valendo: o texto com 2 linhas dá 2 linhas.
  const duas = alturaDaTinta9x16(paraAss([{ a: 0, b: 1, texto: "Primeira linha\nSegunda linha" }], { formato: "9x16" }));
  assert.ok(duas > 90, `a quebra do kit devia dar 2 linhas: ${duas}`);
});

// ---------- --margem-baixo: a legenda do 9x16 sobe para dentro da área segura ----------

// Faixa vertical (y0 a y1) e horizontal (x0 a x1) da tinta branca (> 128) de um quadro 1080x1920 do vídeo no instante t.
// Em fundo preto o contorno e a sombra (pretos) não aparecem: sobra só a letra.
function quadroCinza1080x1920(video, t) {
  const bytes = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 26 });
  assert.equal(bytes.length, 1080 * 1920, "o quadro tem que ter 1080x1920 bytes em cinza");
  return bytes;
}
function tintaBranca(video, t) {
  const bytes = quadroCinza1080x1920(video, t);
  let y0 = Infinity, y1 = -1, x0 = Infinity, x1 = -1;
  for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) {
    if (bytes[y * 1080 + x] > 128) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  assert.ok(y1 >= 0, "o quadro não tem nenhuma tinta branca: a legenda não apareceu");
  return { y0, y1, x0, x1 };
}

test("legendar --margem-baixo 500 num 1080x1920: a tinta da legenda sobe 240 px e fica na faixa pedida (y 1312 a 1420), dentro da área segura 250 a 1500", () => {
  const srt = srtDe("Legenda na área segura");   // 1 linha, 22 caracteres
  const padrao = legendarCom(videoPreto("1080x1920"), srt);
  const alta = legendarCom(videoPreto("1080x1920"), srt, ["--margem-baixo", "500"]);
  assert.equal(padrao.status, 0, padrao.stdout + padrao.stderr);
  assert.equal(alta.status, 0, alta.stdout + alta.stderr);
  const a = tintaBranca(padrao.saida, 0.4), b = tintaBranca(alta.saida, 0.4);
  // Sem a opção a legenda fica onde sempre ficou: a caixa de texto acaba em y 1660 (1920 - 260), fora da área de 250 a 1500.
  assert.ok(a.y1 <= 1660 && a.y1 > 1500, `padrão: a tinta devia acabar entre 1500 e 1660: ${a.y1}`);
  // Com 500, a caixa de texto acaba em y 1420 (1920 - 500). Uma linha tem menos de 2 vezes a fonte (54 px) de altura.
  assert.ok(b.y1 <= 1420, `--margem-baixo 500: a tinta não pode passar de y 1420: ${b.y1}`);
  assert.ok(b.y0 >= 1420 - 2 * 54, `--margem-baixo 500: a tinta devia começar abaixo de y 1312: ${b.y0}`);
  assert.ok(b.y0 >= 250 && b.y1 <= 1500, `a legenda tem que caber na área segura 250 a 1500: ${b.y0} a ${b.y1}`);
  // Só a margem mudou: a mesma legenda subiu 500 - 260 = 240 px (±1 de arredondamento do libass), no mesmo lugar na horizontal.
  assert.ok(Math.abs((a.y1 - b.y1) - 240) <= 1, `a tinta devia subir 240 px: ${a.y1 - b.y1}`);
  assert.ok(Math.abs((a.y0 - b.y0) - 240) <= 1, `o topo da tinta devia subir 240 px: ${a.y0 - b.y0}`);
  assert.equal(a.x0, b.x0); assert.equal(a.x1, b.x1);
  assert.ok(Math.abs((a.x0 + a.x1) / 2 - 540) <= 2, `a legenda segue centrada: ${(a.x0 + a.x1) / 2}`);
});

test("legendar --margem-baixo 420 com bloco de 2 linhas segue valendo: o pé da legenda fica em y 1500, dentro da área segura", () => {
  const r = legendarCom(videoPreto("1080x1920"), srtDe("Primeira linha", "Segunda linha"), ["--margem-baixo", "420"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const t = tintaBranca(r.saida, 0.4);
  assert.ok(t.y0 >= 250 && t.y1 <= 1500, `a legenda de 2 linhas devia caber em y 250 a 1500: ${t.y0} a ${t.y1}`);
  assert.ok(t.y1 > 1500 - 24, `o pé da tinta devia ficar perto de y 1500 (a descida da letra deixa uns 12 px): ${t.y1}`);
});

test("legendar --margem-baixo recusa valor que não é número inteiro de pixels (código 1, nada gravado)", () => {
  // 420.5 e 0.5: o libass corta a fração (420.5 sai igual a 420 no quadro), então a opção só aceita inteiro.
  for (const ruim of ["abc", "-5", "", "  ", "1e999", "NaN", "420.5", "0.5"]) {
    const r = legendarCom(videoPreto("1080x1920"), srtDe("Teste curto"), ["--margem-baixo", ruim]);
    assert.equal(r.status, 1, `${JSON.stringify(ruim)}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /^legendar: /);
    assert.ok(r.stderr.includes(`--margem-baixo inválido: "${ruim}"`), `${JSON.stringify(ruim)}: ${r.stderr}`);
    assert.match(r.stderr, /número inteiro de pixels/);
    assert.ok(!existsSync(r.saida), "não pode gravar a saída");
  }
});
test("legendar: as margens laterais também só aceitam inteiro (mesma regra, o libass corta a fração)", () => {
  for (const opcao of ["--margem-esq", "--margem-dir"]) {
    const r = legendarCom(videoPreto("1080x1920"), srtDe("Teste curto"), [opcao, "80.5"]);
    assert.equal(r.status, 1, `${opcao}: ${r.stdout}${r.stderr}`);
    assert.ok(r.stderr.includes(`${opcao} inválido: "80.5"`), r.stderr);
    assert.ok(!existsSync(r.saida), "não pode gravar a saída");
  }
});
test("legendar --margem-baixo recusa margem em que o maior bloco do .srt não cabe no quadro (margem + linhas x fonte + contorno >= altura)", () => {
  const duas = srtDe("Primeira linha", "Segunda linha");
  // 1080x1920, 2 linhas, contorno: 1920 - 2 x 54 - 2,7 = 1809,3, então a margem máxima é 1809. Medido: com 1850 a tinta ia de y 0 a 68 (1ª linha cortada).
  const corta = legendarCom(videoPreto("1080x1920"), duas, ["--margem-baixo", "1850"]);
  assert.equal(corta.status, 1, corta.stdout + corta.stderr);
  assert.match(corta.stderr, /^legendar: /);
  assert.match(corta.stderr, /--margem-baixo 1850 não cabe/);
  assert.match(corta.stderr, /o maior bloco do \.srt tem 2 linhas/);
  assert.match(corta.stderr, /estilo contorno/);
  assert.match(corta.stderr, /margem máxima no 9x16 é 1809 px/);
  assert.match(corta.stderr, /Use 1809 ou menos/);
  assert.ok(!existsSync(corta.saida), "não pode gravar a saída");
  // Na fronteira: 1810 é recusado e 1809 passa, com a tinta inteira dentro do quadro (começa abaixo de y 3 = 1920 - 1809 - 2 x 54).
  assert.equal(legendarCom(videoPreto("1080x1920"), duas, ["--margem-baixo", "1810"]).status, 1);
  const limite = legendarCom(videoPreto("1080x1920"), duas, ["--margem-baixo", "1809"]);
  assert.equal(limite.status, 0, limite.stdout + limite.stderr);
  const t = tintaBranca(limite.saida, 0.4);
  assert.ok(t.y0 >= 3, `a tinta de 2 linhas na margem 1809 devia ficar abaixo de y 3: ${t.y0}`);
});
test("legendar --margem-baixo vale para o maior bloco do .srt: a mesma margem passa com 1 linha e não passa com 2", () => {
  const uma = legendarCom(videoPreto("1080x1920"), srtDe("Teste curto"), ["--margem-baixo", "1850"]);
  assert.equal(uma.status, 0, uma.stdout + uma.stderr);   // 1 linha: 1920 - 54 - 2,7 = 1863,3
  assert.ok(tintaBranca(uma.saida, 0.4).y0 >= 1920 - 1850 - 54, "a tinta de 1 linha cabe no quadro");
  const mistoSrt = "1\n00:00:00,000 --> 00:00:00,400\nUma linha\n\n2\n00:00:00,400 --> 00:00:00,800\nDuas\nlinhas\n";
  const misto = legendarCom(videoPreto("1080x1920"), mistoSrt, ["--margem-baixo", "1850"]);
  assert.equal(misto.status, 1, misto.stdout + misto.stderr);
  assert.match(misto.stderr, /o maior bloco do \.srt tem 2 linhas/);
  const tres = legendarCom(videoPreto("1080x1920"), srtDe("a", "b", "c"), ["--margem-baixo", "1750"]);   // 1750 + 3 x 54 + 2,7 = 1914,7 passa; 1760 não
  assert.equal(tres.status, 0, tres.stdout + tres.stderr);
  const quatro = legendarCom(videoPreto("1080x1920"), srtDe("a", "b", "c", "d"), ["--margem-baixo", "1750"]);   // 1750 + 4 x 54 = 1966
  assert.equal(quatro.status, 1);
  assert.match(quatro.stderr, /tem 4 linhas/);
  const um = legendarCom(videoPreto("1080x1920"), srtDe("Teste curto"), ["--margem-baixo", "1864"]);
  assert.equal(um.status, 1);
  assert.match(um.stderr, /tem 1 linha e/);                                      // singular
  assert.match(um.stderr, /Use 1863 ou menos/);
});
test("legendar --margem-baixo: no estilo caixa a folga de 14 px conta, e no 16x9 o limite é o da grade 1920x1080", () => {
  // caixa: 1920 - 2 x 54 - 14 = 1798, então a margem máxima é 1797.
  const caixa = legendarCom(videoPreto("1080x1920"), srtDe("Primeira linha", "Segunda linha"), ["--estilo", "caixa", "--margem-baixo", "1798"]);
  assert.equal(caixa.status, 1, caixa.stdout + caixa.stderr);
  assert.match(caixa.stderr, /estilo caixa/);
  assert.match(caixa.stderr, /Use 1797 ou menos/);
  // 16x9: fonte 40 e contorno 2: 1080 - 40 - 2 = 1038, então a margem máxima de 1 linha é 1037.
  const p = legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--margem-baixo", "1038"]);
  assert.equal(p.status, 1, p.stdout + p.stderr);
  assert.match(p.stderr, /margem máxima no 16x9 é 1037 px/);
  assert.equal(legendarCom(videoPreto("1920x1080"), srtDe("Teste curto"), ["--margem-baixo", "1080"]).status, 1);
});

// O bloco de N linhas ocupa N x fonte acima da margem. Medido em 29/10/2026 no libass (Inter Bold, fonte 54): 4 linhas "HHH" na margem
// 260 têm a tinta em y 1455, 1509, 1563 e 1617 (passo de 54 = a fonte); a caixa (estilo caixa, 2 linhas, margem 500) vai de y 1298 a 1433,
// ou seja, 14 px acima do topo do bloco (1420 - 2 x 54 = 1312) e 14 px abaixo do pé (1420). É a medida que a recusa acima usa.
test("legendar: o passo entre as linhas é a fonte (54 px) e a caixa passa 14 px acima e abaixo do bloco", () => {
  const quatro = legendarCom(videoPreto("1080x1920"), srtDe("HHH", "HHH", "HHH", "HHH"));
  assert.equal(quatro.status, 0, quatro.stdout + quatro.stderr);
  const bytes = quadroCinza1080x1920(quatro.saida, 0.4);
  const topos = [];
  let dentro = false;
  for (let y = 0; y < 1920; y++) {
    let tem = false;
    for (let x = 0; x < 1080; x++) if (bytes[y * 1080 + x] > 128) { tem = true; break; }
    if (tem && !dentro) topos.push(y);
    dentro = tem;
  }
  assert.equal(topos.length, 4, `4 linhas de tinta: ${topos}`);
  for (let i = 1; i < 4; i++) assert.ok(Math.abs(topos[i] - topos[i - 1] - 54) <= 1, `passo entre as linhas ${i - 1} e ${i}: ${topos[i] - topos[i - 1]}`);
  const topoDoBloco = 1920 - 260 - 4 * 54;                                       // 1444
  assert.ok(topos[0] >= topoDoBloco && topos[0] <= topoDoBloco + 16, `a tinta da 1ª linha começa logo abaixo do topo do bloco (${topoDoBloco}): ${topos[0]}`);
  // Caixa: pixels escuros (< 60) em fundo cinza.
  const cinza = join(OFICINA, "cinza-1080x1920.mp4");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=0x808080:s=1080x1920:d=1:r=10",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", cinza]);
  const c = legendarCom(cinza, srtDe("HHH", "HHH"), ["--estilo", "caixa", "--margem-baixo", "500"]);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  const q = quadroCinza1080x1920(c.saida, 0.4);
  let y0 = Infinity, y1 = -1;
  for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) if (q[y * 1080 + x] < 60) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  assert.ok(Math.abs(y0 - (1920 - 500 - 2 * 54 - 14)) <= 2, `topo da caixa devia ficar 14 px acima do bloco (y 1298): ${y0}`);
  assert.ok(Math.abs(y1 - (1920 - 500 + 14)) <= 2, `pé da caixa devia ficar 14 px abaixo da margem (y 1434): ${y1}`);
});
test("legendar --margem-baixo sem valor sai com código 1 (e a opção aparece no uso)", () => {
  const r = legendarCom(videoPreto("1080x1920"), srtDe("Teste curto"), ["--margem-baixo"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /falta o valor de --margem-baixo/);
  assert.ok(!r.stderr.includes("aspas"), r.stderr);
  const sem = spawnSync(process.execPath, [LEGENDAR], { encoding: "utf8" });
  assert.equal(sem.status, 1);
  assert.match(sem.stderr, /\[--margem-baixo N\]/);
});
