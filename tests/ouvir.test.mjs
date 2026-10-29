// O ouvir.py (S1 a S4), o alinhar.py e a normalização que os 2 usam (kit/vozes/normalizar.py).
// Sem áudio de API: listas de palavras sintéticas e WAV sintético. O Python roda por `py -3`.
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const AMBIENTE = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };

// Roda um trecho de Python com `dados` (JSON) na entrada e devolve o JSON que ele imprime.
function py(codigo, dados = null) {
  const prefixo = "import sys, json\nsys.path[:0] = ['scripts', 'kit/vozes']\n" +
    "dados = json.loads(sys.stdin.buffer.read().decode('utf-8') or 'null')\n" +
    "def saida(x):\n    sys.stdout.buffer.write(json.dumps(x, ensure_ascii=False).encode('utf-8'))\n";
  const r = spawnSync("py", ["-3", "-c", prefixo + codigo], { cwd: RAIZ, input: JSON.stringify(dados), encoding: "utf8", env: AMBIENTE, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`py -3 saiu com ${r.status}:\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

// ---------------------------------------------------------------- normalizar.py: número e sigla
// Número por extenso em pt-BR, de 0 a 9999, como o roteiro escreve para a voz.
const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze",
  "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function ate999(n) {
  if (n === 100) return "cem";
  const partes = [];
  const c = Math.floor(n / 100), r = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? " e " + UNIDADES[r % 10] : ""));
  return partes.join(" e ");
}
function extenso(n) {
  if (n === 0) return "zero";
  const m = Math.floor(n / 1000), r = n % 1000, partes = [];
  if (m) partes.push(m === 1 ? "mil" : ate999(m) + " mil");
  if (r) partes.push((m && (r < 100 || r % 100 === 0) ? "e " : "") + ate999(r));
  return partes.join(" ");
}

test("extenso do teste escreve como o roteiro", () => {
  assert.equal(extenso(2033), "dois mil e trinta e três");
  assert.equal(extenso(2340), "dois mil trezentos e quarenta");
  assert.equal(extenso(1100), "mil e cem");
  assert.equal(extenso(101), "cento e um");
});

test("forma: de 0 a 9999 por extenso dá o número em algarismos", () => {
  const nums = Array.from({ length: 10000 }, (_, n) => n);
  const res = py("from normalizar import forma\nsaida([forma(t.split()) for t in dados])", nums.map(extenso));
  const erradas = nums.filter((n) => res[n] !== String(n)).map((n) => `${extenso(n)} -> ${res[n]}`);
  assert.deepEqual(erradas.slice(0, 10), []);
});

test("forma: número, sigla e por cento casam com o que a transcrição escreve", () => {
  const pares = [
    ["dois mil e trinta e três", "2033"], ["vinte e cinco", "25"], ["cem", "100"], ["cento e um", "101"], ["mil", "1000"],
    ["dois mil", "2000"], ["mil e quinhentos", "1.500"], ["quatorze", "14"], ["duzentas e duas", "202"], ["zero", "0"],
    ["cem mil", "100.000"], ["um milhão e duzentos mil", "1.200.000"], ["dois milhões", "2 milhões"], ["dois mil", "2 mil"],
    ["vinte e cinco por cento", "25%"], ["Meta de dois mil e trinta e três,", "Meta de 2033,"],
    ["cê bê ésse", "CBS"], ["ce be esse", "CBS"], ["cê bê ésse", "C B S"], ["cê bê ésse", "C.B.S."], ["ême bê á.", "MBA."],
    ["cê érre ême", "CRM"], ["agá tê tê pê", "HTTP"], ["dáblio dáblio dáblio", "WWW"], ["jota pê ême", "JPM"],
    ["éfe gê quê", "FGQ"], ["xis ípsilon zê", "XYZ"], ["á bê cê", "ABC"], ["ó éle êne", "OLN"], ["u vê cá", "UVK"],
  ];
  const res = py("from normalizar import forma\nsaida([[forma(a.split()), forma(b.split())] for a, b in dados])", pares);
  pares.forEach(([a, b], k) => assert.equal(res[k][0], res[k][1], `"${a}" x "${b}": ${res[k][0]} x ${res[k][1]}`));
});

test("forma: o que não é número nem sigla fica como estava", () => {
  const res = py("from normalizar import forma\nsaida([forma(t.split()) for t in dados])",
    ["dois e três", "vinte e onze", "esse produto", "que bom", "Boas-vindas", "um", "a"]);
  assert.deepEqual(res, ["2e3", "20e11", "esseproduto", "quebom", "boasvindas", "1", "a"]);
});

test("casar: acha os grupos que dizem a mesma coisa", () => {
  const res = py("from normalizar import casar\nsaida([casar(a.split(), b.split()) for a, b in dados])", [
    ["cê bê ésse e cê érre ême", "CBS e CRM"],
    ["dois mil e trinta e três chegou", "2033 chegou"],
    ["palavra sem par", "outra coisa"],
  ]);
  assert.deepEqual(res[0], [[0, 3, 0, 1], [3, 4, 1, 2], [4, 7, 2, 3]]);
  assert.deepEqual(res[1], [[0, 6, 0, 1], [6, 7, 1, 2]]);
  assert.deepEqual(res[2], []);
});

test("casar aceita a forma alternativa de um trecho (o texto da tela)", () => {
  const res = py("from normalizar import casar, forma\nsaida(casar(['Lumécsa', 'chegou'], ['Lumexa', 'chegou'], {(0, 1): {forma(['Lumexa'])}}))");
  assert.deepEqual(res, [[0, 1, 0, 1], [1, 2, 1, 2]]);
});

// ---------------------------------------------------------------- ouvir.py S1 e S3: número, sigla e texto da tela
// Transcrição como o Whisper escreve: algarismo e sigla junta.
const OUVIDAS = ["O", "plano", "de", "2033", "usa", "CBS.", "Pedidos", "no", "CBS", "e", "no", "CRM."].map((p, k) => ({ p, de: k, ate: k + 0.8 }));
const ROTEIRO_FALA = "O plano de dois mil e trinta e três usa cê bê ésse.\nPedidos no cê bê ésse e no cê érre ême.\n";
const ROTEIRO_JSON = { blocos: [
  { id: "a", linhas: [{ id: "a1", texto: "O plano de 2033 usa CBS.", fala: "O plano de dois mil e trinta e três usa cê bê ésse." }] },
  { id: "b", linhas: [{ id: "b1", texto: "Pedidos no CBS e no CRM.", fala: "Pedidos no cê bê ésse e no cê érre ême." }, { id: "b2", texto: "Xyra.", fala: "Zaira." }] },
] };
// Grava o roteiro num arquivo temporário (.txt ou .json), lê com o ler_roteiro e alinha com as palavras ouvidas.
const ALINHAR = `import os, tempfile, ouvir
pasta = tempfile.mkdtemp()
arq = os.path.join(pasta, "roteiro" + dados["ext"])
open(arq, "w", encoding="utf-8").write(dados["roteiro"])
rot = ouvir.ler_roteiro(arq)
r = ouvir.alinhar(rot, dados["pal"], {})
`;

test("S1: número por extenso e sigla soletrada contam como ouvidos", () => {
  const res = py(ALINHAR + "saida({'faltaram': [rot[i]['p'] for i in r[1]], 'sobraram': [dados['pal'][j]['p'] for j in r[2] if j not in r[0].values()], 'pares': {rot[i]['p'] + str(i): j for i, j in r[0].items()}})",
    { ext: ".txt", roteiro: ROTEIRO_FALA, pal: OUVIDAS });
  assert.deepEqual(res.faltaram, []);
  assert.deepEqual(res.sobraram, []);
  assert.equal(res.pares.dois3, 3);                    // "dois" ... "três" -> "2033"
  assert.equal(res.pares["três8"], 3);
  assert.equal(res.pares["cê10"], 5);                  // "cê bê ésse" -> "CBS."
  assert.equal(res.pares["ésse12"], 5);
  assert.equal(res.pares["ême22"], 11);                // "cê érre ême" -> "CRM."
});

test("S1: com o roteiro.json, a palavra da tela também vale", () => {
  const pal = [...OUVIDAS, { p: "Xyra.", de: 12, ate: 12.8 }];
  const comTela = py(ALINHAR + "saida([rot[i]['p'] for i in r[1]])", { ext: ".json", roteiro: JSON.stringify(ROTEIRO_JSON), pal });
  assert.deepEqual(comTela, []);
  const soFala = py(ALINHAR + "saida([rot[i]['p'] for i in r[1]])", { ext: ".txt", roteiro: ROTEIRO_FALA + "Zaira.\n", pal });
  assert.deepEqual(soFala, ["Zaira"]);              // sem o texto da tela, "Zaira" x "Xyra" segue acusado
});

test("ler_roteiro: o roteiro.json dá as mesmas palavras que o vo.txt do montar.mjs", () => {
  const vo = ROTEIRO_JSON.blocos.map((b) => b.linhas.map((l) => l.fala || l.texto).join(" ")).join("\n");
  const res = py(`import os, tempfile, ouvir
pasta = tempfile.mkdtemp()
saidas = []
for ext, txt in (('.json', dados['json']), ('.txt', dados['vo'])):
    arq = os.path.join(pasta, 'r' + ext)
    open(arq, 'w', encoding='utf-8').write(txt)
    saidas.append([(x['p'], x['n'], x['sinal'], x['pausa'], bool(x.get('quebra'))) for x in ouvir.ler_roteiro(arq)])
saida(saidas)`, { json: JSON.stringify(ROTEIRO_JSON), vo });
  assert.deepEqual(res[0], res[1]);
});

test("S3: a marca com o começo da fala acha a palavra pelo roteiro e pela forma", () => {
  const res = py(ALINHAR + `pares = r[0]
saida({a: sorted(ouvir.achar_fala(a, rot, dados['pal'], pares, {})) for a in ('Dois mil', 'cê bê ésse', 'CBS', 'cê érre ême', 'Zaira', 'Xyra', 'nada disso')})`,
  { ext: ".json", roteiro: JSON.stringify(ROTEIRO_JSON), pal: [...OUVIDAS, { p: "Xyra.", de: 12, ate: 12.8 }] });
  assert.deepEqual(res["Dois mil"], [3]);            // começo de "dois mil e trinta e três" = começo de "2033"
  assert.deepEqual(res["cê bê ésse"], [5, 8]);
  assert.deepEqual(res.CBS, [5, 8]);
  assert.deepEqual(res["cê érre ême"], [11]);
  assert.deepEqual(res.Zaira, [12]);
  assert.deepEqual(res.Xyra, [12]);
  assert.deepEqual(res["nada disso"], []);
});

// ---------------------------------------------------------------- ouvir.py inteiro, num WAV sintético
// Cada palavra é um trecho de ruído no tempo real dela. A transcrição fica guardada na pasta --out com a
// impressão digital do som, como o ouvir.py grava: ele lê de lá e não chama o Whisper.
// "Xyra" começa aos 6,21 s, depois de 0,81 s de silêncio, mas a transcrição estica a palavra até 5,43 s.
const SONS = [["O", 0.3, 0.4], ["plano", 0.45, 0.8], ["de", 0.85, 0.95], ["2033", 1.0, 1.9], ["usa", 1.95, 2.2], ["CBS.", 2.25, 3.0],
  ["Tudo", 3.5, 3.75], ["certo", 3.8, 4.1], ["para", 4.15, 4.35], ["começar?", 4.4, 5.4], ["Xyra.", 6.21, 6.9]];
const TRANSCRITO = SONS.map(([p, de, ate]) => ({ p, de: p === "Xyra." ? 5.43 : de, ate }));
const ROTEIRO_FILME = { blocos: [
  { id: "a", linhas: [{ id: "a1", texto: "O plano de 2033 usa CBS.", fala: "O plano de dois mil e trinta e três usa cê bê ésse." }] },
  { id: "b", linhas: [{ id: "b1", texto: "Tudo certo para começar?" }, { id: "b2", texto: "Xyra.", fala: "Zaira." }] },
] };
const MARCAS = { events: [{ type: "fala", label: "Dois mil", t: 1.05 }, { type: "fala", label: "cê bê ésse", t: 2.3 }, { type: "fala", label: "Zaira", t: 6.25 }] };

// trilha: ruído 24 dB abaixo das palavras, no filme inteiro (no vão, o nível da trilha no lugar do silêncio).
// vo: o roteiro vai como o vo.txt do montar.mjs (só a fala), sem o texto da tela.
// efeito: instante de um efeito de 0,2 s no vão, no nível da fala, listado no --sfx.
function ouvirFilme({ trilha = false, vo = false, marcas = MARCAS, efeito = null } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), "ouvir ção "));
  try {
    const wav = join(pasta, "filme.wav"), out = join(pasta, "ouvir"), rot = join(pasta, vo ? "vo.txt" : "roteiro.json"), ev = join(pasta, "filme.events.json");
    const sfx = join(pasta, "sfx-eventos.json");
    const roteiro = vo ? ROTEIRO_FILME.blocos.map((b) => b.linhas.map((l) => l.fala || l.texto).join(" ")).join("\n") : ROTEIRO_FILME;
    if (efeito !== null) writeFileSync(sfx, JSON.stringify([{ t: efeito, sfx: "efeito.wav", gain: 0 }]));
    py(`import os, wave, hashlib, numpy as np, ouvir
sr, rng = 48000, np.random.default_rng(7)
x = np.zeros(int(7.5 * sr))
if dados["trilha"]:
    x += rng.normal(0, 0.1 * 10 ** (-24 / 20), len(x))
sons = dados["sons"] + ([["efeito", dados["efeito"], dados["efeito"] + 0.2]] if dados["efeito"] is not None else [])
for _, de, ate in sons:
    x[int(de * sr):int(ate * sr)] += rng.normal(0, 0.1, int(ate * sr) - int(de * sr))
with wave.open(dados["wav"], "wb") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
rot = dados["roteiro"]
open(dados["rot"], "w", encoding="utf-8").write(rot if isinstance(rot, str) else json.dumps(rot, ensure_ascii=False))
open(dados["ev"], "w", encoding="utf-8").write(json.dumps(dados["marcas"], ensure_ascii=False))
tmp = dados["wav"] + ".16k.wav"
ouvir.extrair(dados["wav"], tmp)
marca = hashlib.md5(open(tmp, "rb").read()).hexdigest()[:16]
os.remove(tmp)
os.makedirs(dados["out"], exist_ok=True)
open(os.path.join(dados["out"], "transcricao-whisper-medium-%s.json" % marca), "w", encoding="utf-8").write(json.dumps(dados["pal"], ensure_ascii=False))
saida(marca)`, { trilha, sons: SONS, pal: TRANSCRITO, wav, out, rot, ev, roteiro, marcas, efeito });
    const r = spawnSync("py", ["-3", join(RAIZ, "scripts", "ouvir.py"), wav, "--roteiro", rot, "--eventos", ev, "--motor", "whisper",
      "--modelo", "medium", "--out", out, "--json", ...(efeito !== null ? ["--sfx", sfx] : [])], { encoding: "utf8", env: AMBIENTE, maxBuffer: 1 << 26 });
    assert.ok(r.status === 0 || r.status === 1, `ouvir.py saiu com ${r.status}:\n${r.stderr}`);
    return JSON.parse(r.stdout);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

test("ouvir.py: S1 passa com número e sigla, e as marcas de S3 acham \"Dois mil\" e \"cê bê ésse\"", () => {
  const s = ouvirFilme();
  assert.equal(s.portoes.S1, "PASS", s.alertas.S1.join("\n"));
  const ligados = Object.fromEntries(s.medidas.S3.ligados.map((l) => [l.fala, l]));
  assert.equal(ligados["Dois mil"].ouvida, 1);
  assert.equal(ligados["cê bê ésse"].ouvida, 2.25);
  assert.deepEqual(s.alertas.S3.filter((a) => /Dois mil|cê bê ésse/.test(a)), []);
});

// ---------------------------------------------------------------- ouvir.py S2 e S3: a palavra esticada pela pausa
for (const trilha of [false, true]) {
  test(`ouvir.py: depois de 0,81 s ${trilha ? "só com trilha" : "de silêncio"}, o começo de "Xyra" vem da energia (S2 e S3 passam)`, () => {
    const s = ouvirFilme({ trilha });
    assert.equal(s.portoes.S2, "PASS", s.alertas.S2.join("\n"));
    assert.equal(s.portoes.S3, "PASS", s.alertas.S3.join("\n"));
    const pela = s.medidas.S2.inicio_pela_energia;
    assert.equal(pela.length, 1, JSON.stringify(pela));            // só a palavra esticada muda; "Sua" e "a" ficam
    assert.equal(pela[0].palavra, "Xyra.");
    assert.equal(pela[0].transcricao, 5.43);
    assert.ok(Math.abs(pela[0].energia - 6.21) <= 0.02, `começo pela energia ${pela[0].energia}`);
    assert.ok(Math.abs(pela[0].vao - 0.81) <= 0.04, `vão ${pela[0].vao}`);
    const zaira = s.medidas.S3.ligados.find((l) => l.fala === "Zaira");
    assert.ok(Math.abs(zaira.dif - 0.04) <= 0.02, `tela x fala ${zaira.dif}`);
  });
}

test("ouvir.py: a palavra que não casou com o roteiro também começa pela energia, pela pontuação da transcrição", () => {
  // só a fala ("Zaira"): a palavra ouvida "Xyra." não casa com o roteiro, mas vem depois de "pronta?"
  const s = ouvirFilme({ vo: true, marcas: { events: [{ type: "fala", label: "Xyra", t: 6.25 }] } });
  assert.equal(s.portoes.S1, "ALERTA");                                   // "Zaira" x "Xyra" segue acusado
  assert.equal(s.portoes.S3, "PASS", s.alertas.S3.join("\n"));
  assert.deepEqual(s.medidas.S2.inicio_pela_energia.map((x) => x.palavra), ["Xyra."]);
  assert.ok(Math.abs(s.medidas.S3.ligados[0].dif - 0.04) <= 0.02, `tela x fala ${s.medidas.S3.ligados[0].dif}`);
});

test("inicio_pela_energia não mexe quando o começo da palavra já tem som ou o vão é curto", () => {
  const res = py(`import numpy as np, ouvir
env = np.full(300, -20.0)              # 3 s de fala, janelas de 10 ms
env[100:105] = -70.0                   # vão de 0,05 s entre 1,00 e 1,05 s
a, b = {"de": 0.2, "ate": 1.0}, {"de": 1.02, "ate": 2.0}
curto = ouvir.inicio_pela_energia(env, a, b)
env2 = np.full(300, -20.0); env2[100:181] = -70.0      # vão de 0,81 s, mas a transcrição já começa no som
com_som = ouvir.inicio_pela_energia(env2, a, {"de": 1.85, "ate": 2.5})
esticada = ouvir.inicio_pela_energia(env2, a, {"de": 1.03, "ate": 2.5})
saida([curto, com_som, [round(x, 2) for x in esticada]])`);
  assert.deepEqual(res, [null, null, [1.81, 0.81]]);
});

// ---------------------------------------------------------------- alinhar.py: sigla e número tiram o tempo do Whisper
// O som: ruído no tempo real de cada palavra (16 kHz), silêncio no resto. As ouvidas: o que o Whisper devolve.
// "CBS" soa de 0,92 a 1,50 s, mas o Whisper começa a palavra aos 0,62 s, por cima do silêncio depois de "de".
const SONS_TOMADA = [[0.0, 0.5], [0.5, 0.62], [0.92, 1.5], [1.55, 1.65], [1.65, 1.75], [1.75, 2.4], [2.9, 3.1], [3.1, 3.15], [3.2, 4.4], [4.6, 5.1]];
const OUVIDAS_TOMADA = [["Pedidos", 0.0, 0.5], ["no", 0.5, 0.62], ["CBS", 0.62, 1.5], ["e", 1.55, 1.65], ["no", 1.65, 1.75], ["CRM.", 1.75, 2.4],
  ["Meta", 2.9, 3.1], ["de", 3.1, 3.15], ["2033,", 3.2, 4.4], ["fechada.", 4.6, 5.1]].map(([p, ini, fim]) => ({ p, ini, fim }));
const FALA_TOMADA = "Pedidos no cê bê ésse e no cê érre ême. Meta de dois mil e trinta e três, fechada.";
const ALINHAR_TOMADA = `import numpy as np, alinhar
sr, rng = alinhar.SR, np.random.default_rng(3)
x = np.zeros(int(5.5 * sr), dtype=np.float32)
for de, ate in dados["sons"]:
    x[int(de * sr):int(ate * sr)] = rng.normal(0, 0.1, int(ate * sr) - int(de * sr))
pal = alinhar.alinhar(dados["fala"].split(" "), dados["ouvidas"], x)
saida([{**p, "start": round(p["start"], 3), "end": round(p["end"], 3)} for p in pal])`;

test("alinhar.py: sigla soletrada e número por extenso tiram o tempo da palavra do Whisper, sem estimar", () => {
  const pal = py(ALINHAR_TOMADA, { sons: SONS_TOMADA, ouvidas: OUVIDAS_TOMADA, fala: FALA_TOMADA });
  assert.deepEqual(pal.filter((p) => p.est).map((p) => p.word), []);
  const w = Object.fromEntries(pal.map((p, k) => [p.word + k, p]));
  assert.equal(w["cê2"].start, 0.92);                 // o começo da sigla vem do silêncio medido, não da fatia de 0,62 s
  assert.equal(w["ésse4"].end, 1.5);
  assert.equal(w["cê2"].end, w["bê3"].start);         // as letras dividem o tempo da palavra, pelo número de sílabas
  assert.ok(w["ésse4"].end - w["ésse4"].start > w["cê2"].end - w["cê2"].start);
  assert.equal(w["cê7"].start, 1.75);
  assert.equal(w["ême.9"].end, 2.4);
  assert.equal(w["dois12"].start, 3.2);
  assert.equal(w["três,17"].end, 4.4);
  assert.deepEqual(pal.map((p) => p.word), FALA_TOMADA.split(" "));
});

test("alinhar.py: palavra que não casa nem pela forma segue estimada", () => {
  const ouvidas = OUVIDAS_TOMADA.map((o) => (o.p === "CBS" ? { ...o, p: "Cobras" } : o));
  const pal = py(ALINHAR_TOMADA, { sons: SONS_TOMADA, ouvidas, fala: FALA_TOMADA });
  assert.deepEqual(pal.filter((p) => p.est).map((p) => p.word), ["cê", "bê", "ésse"]);
});

// De onde o alinhar.py importou o normalizar.py, rodando de `pasta` (sem o kit/vozes da skill no caminho).
function normalizarDe(pasta, env = AMBIENTE) {
  const r = spawnSync("py", ["-3", "-c", "import sys; sys.path.insert(0, sys.argv[1]); import alinhar, normalizar; print(normalizar.__file__)", join(pasta, "vozes")],
    { cwd: pasta, encoding: "utf8", env });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

test("alinhar.py acha o normalizar.py na pasta vozes/ do projeto criado pelo novo-projeto.mjs", () => {
  const pasta = mkdtempSync(join(tmpdir(), "projeto ção "));
  try {
    const r = spawnSync(process.execPath, [join(RAIZ, "kit", "novo-projeto.mjs"), pasta], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(normalizarDe(pasta).toLowerCase(), join(pasta, "vozes", "normalizar.py").toLowerCase());
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test("alinhar.py sem o normalizar.py ao lado usa o da skill, pelo motionstudio.json", () => {
  const pasta = mkdtempSync(join(tmpdir(), "projeto antigo "));
  try {
    mkdirSync(join(pasta, "vozes"));
    copyFileSync(join(RAIZ, "kit", "vozes", "alinhar.py"), join(pasta, "vozes", "alinhar.py"));
    writeFileSync(join(pasta, "motionstudio.json"), "\uFEFF" + JSON.stringify({ skill: RAIZ }));
    const { SKILL, ...semSkill } = AMBIENTE;
    assert.equal(normalizarDe(pasta, semSkill).toLowerCase(), join(RAIZ, "kit", "vozes", "normalizar.py").toLowerCase());
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- Rodada 1: dinheiro, decimal e palavra comum
test("forma: dinheiro, decimal e sigla com hífen casam com a transcrição", () => {
  const pares = [
    ["mil e quinhentos reais", "R$ 1.500"], ["trinta e dois reais", "R$ 32"], ["trinta e dois reais", "R$32"], ["um real", "R$ 1"],
    ["um vírgula cinco", "1,5"], ["dois vírgula cinco por cento", "2,5%"], ["um vírgula vinte e cinco", "1,25"], ["um vírgula zero cinco", "1,05"],
    ["mil e quinhentos vírgula cinco", "1.500,5"], ["um vírgula cinco", "1.5"],
    ["Cê-Bê-Ésse", "CBS"], ["cê bê ésse", "CBS"], ["ce be esse", "CBS"], ["cê érre ême", "CRM"], ["a cê bê ésse e o", "a CBS e o"],
  ];
  const res = py("from normalizar import forma\nsaida([[forma(a.split()), forma(b.split())] for a, b in dados])", pares);
  pares.forEach(([a, b], k) => assert.equal(res[k][0], res[k][1], `"${a}" x "${b}": ${res[k][0]} x ${res[k][1]}`));
});

test("forma: palavra comum não vira sigla, e decimal não vira inteiro", () => {
  const pares = [["esse é", "se"], ["ele é", "le"], ["de e", "de"], ["Veja esse é o plano", "Veja se o plano"],
    ["quinze", "1,5"], ["um vírgula cinco", "15"], ["mil e quinhentos", "1,5"], ["trinta e dois", "R$ 32"]];
  const res = py("from normalizar import forma\nsaida([[forma(a.split()), forma(b.split())] for a, b in dados])", pares);
  pares.forEach(([a, b], k) => assert.notEqual(res[k][0], res[k][1], `"${a}" x "${b}" não podiam casar: ${res[k][0]}`));
  assert.deepEqual(py("from normalizar import forma\nsaida([forma(['1.500']), forma(['2.033']), forma(['1.5'])])"), ["1500", "2033", "1.5"]);
});

// Número com "e" dentro, seguido de outro "e": o "e" ouvido não pode casar com o "e" de dentro do número.
const CASOS_E = [
  ["Metas de dois mil e vinte e cinco e dois mil e trinta e três.", "Metas de 2025 e 2033."],
  ["De vinte e cinco por cento e trinta por cento.", "De 25% e 30%."],
  ["De cinquenta e dois e quarenta e cinco.", "De 52 e 45."],
  ["Em dois mil e trinta e três e cê bê ésse.", "Em 2033 e CBS."],
];
const ALINHAR_CASOS = `import os, tempfile, ouvir
saidas = []
for rot_txt, ouv in dados:
    arq = os.path.join(tempfile.mkdtemp(), "r.txt")
    open(arq, "w", encoding="utf-8").write(rot_txt)
    rot = ouvir.ler_roteiro(arq)
    pal = [{"p": p, "de": k, "ate": k + 0.8} for k, p in enumerate(ouv.split())]
    r = ouvir.alinhar(rot, pal, {})
    saidas.append({"faltaram": [rot[i]["p"] for i in r[1]], "sobraram": [pal[j]["p"] for j in r[2] if j not in r[0].values()]})
saida(saidas)`;

test("S1: número com \"e\" dentro seguido de outro \"e\" não acusa falta", () => {
  const res = py(ALINHAR_CASOS, CASOS_E);
  CASOS_E.forEach(([rot], k) => assert.deepEqual(res[k], { faltaram: [], sobraram: [] }, rot));
});

test("S1: dinheiro por extenso casa com R$; \"esse é\" segue diferente de \"se\"", () => {
  const casos = [["Custa mil e quinhentos reais.", "Custa R$ 1.500."], ["Custa trinta e dois reais.", "Custa R$ 32."], ["Veja esse é o plano.", "Veja se o plano."]];
  const res = py(ALINHAR_CASOS, casos);
  assert.deepEqual(res[0], { faltaram: [], sobraram: [] });
  assert.deepEqual(res[1], { faltaram: [], sobraram: [] });
  assert.notDeepEqual(res[2], { faltaram: [], sobraram: [] });
});

test("alinhar.py: número com \"e\" dentro seguido de outro \"e\" não sai estimado", () => {
  const res = py(`import numpy as np, alinhar
saidas = []
for fala, ouv in dados:
    ouvidas = [{"p": p, "ini": k * 0.5, "fim": k * 0.5 + 0.45} for k, p in enumerate(ouv.split())]
    x = np.random.default_rng(5).normal(0, 0.1, int((len(ouvidas) * 0.5 + 0.5) * alinhar.SR)).astype(np.float32)
    saidas.append([p["word"] for p in alinhar.alinhar(fala.split(" "), ouvidas, x) if p.get("est")])
saida(saidas)`, CASOS_E);
  CASOS_E.forEach(([fala], k) => assert.deepEqual(res[k], [], fala));
});

// Nível em dB por janela de 10 ms: fala a -20 dB, vão de 1,00 a 1,81 s, a transcrição começa "Xyra" aos 1,03 s.
const ENERGIA = `import numpy as np, ouvir
def env(vao):
    e = np.full(300, -20.0)
    e[100:181] = vao
    return e
a, b = {"de": 0.2, "ate": 1.0}, {"de": 1.03, "ate": 2.5}
trilha = np.array([-50.0 if (k // 6) % 2 else -38.0 for k in range(81)])   # 12 dB de oscilação, trechos de 60 ms
batida = np.full(81, -50.0); batida[40:43] = -35.0                          # 30 ms, 15 dB acima da trilha
efeito = np.full(81, -50.0); efeito[40:60] = -22.0                          # 0,2 s no nível da fala, aos 1,40 s
mascara = np.zeros(300, bool); mascara[137:175] = True                      # o --sfx diz: efeito aos 1,40 s
r = lambda x: None if x is None else [round(v, 2) for v in x]
saida({"silencio": r(ouvir.inicio_pela_energia(env(-70.0), a, b)),
       "trilha": r(ouvir.inicio_pela_energia(env(trilha), a, b)),
       "batida": r(ouvir.inicio_pela_energia(env(batida), a, b)),
       "efeito": r(ouvir.inicio_pela_energia(env(efeito), a, b, efeito=mascara))})`;

test("inicio_pela_energia: batida curta e trilha que oscila não puxam o começo; efeito do --sfx devolve o tempo da transcrição", () => {
  const res = py(ENERGIA);
  assert.deepEqual(res.silencio, [1.81, 0.81]);
  assert.deepEqual(res.trilha, [1.81, 0.78]);                          // o vão conta do último som longo (a subida da trilha aos 1,03 s)
  assert.deepEqual(res.batida, [1.81, 0.81]);
  assert.equal(res.efeito, null);
});

test("ouvir.py: efeito do --sfx no vão não vira começo da fala", () => {
  const s = ouvirFilme({ efeito: 5.8 });
  assert.deepEqual(s.medidas.S2.inicio_pela_energia, []);              // sem medida confiável, fica o tempo da transcrição
  assert.equal(s.medidas.S3.ligados.find((l) => l.fala === "Zaira").ouvida, 5.43);
  assert.equal(s.medidas.S4.efeitos, 1);
});
