// Monta os filmes (HTML) a partir das peças em fonte/:
//   fonte/base.html   cabeça, estilos e as funções comuns (câmera, telas, contorno, toque, gesto, marca do fim)
//   fonte/iphone.js   a simulação do Safari e da Tela de Início do iPhone (opcional)
//   fonte/<linha>.js  a linha do tempo de cada versão (ex.: longo.js, curto.js)
//   fonte/pe.html     o fechamento (câmera, janelas, autoteste)
//
//   node montar-filmes.mjs                       (todos)
//   node montar-filmes.mjs index-vertical.html   (só os nomeados)
//
// Uma fonte, vários filmes: versão (linha do tempo), tema (pasta de telas) e formato
// (9:16 ou 16:9) são só configuração. Não editar os index-*.html à mão.
// Kit da skill motionstudio; o caso completo está em SKILL.md, "Caso de referência".
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- Configuração do filme ----------
const NOME = "Produto";             // o nome que aparece na marca (abertura e fim)
const URL_APP = "app.exemplo.com.br"; // o endereço que a simulação do Safari mostra (fonte/iphone.js)
const SUB = "Boas-vindas!";         // a linha embaixo da marca na abertura
const LINHAS = ["longo"];           // fonte/<nome>.js de cada versão
const FILMES = [
  // arq, titulo, telas (pasta das fotos), fala (assets/<arquivo> de gerar-fala.mjs), linha, vert (9:16)
  { arq: "index-vertical.html", titulo: `${NOME}: tutorial`, telas: "telas", fala: "fala.js", linha: "longo", vert: true },
  { arq: "index.html", titulo: `${NOME}: tutorial (16:9)`, telas: "telas", fala: "fala.js", linha: "longo" },
];
// Folga depois da última palavra: a marca do fim respira e o G3 (final parado de 0,6 a 1,4 s) passa.
const FOLGA_FIM = 0.7;
// 9:16 (1080x1920): o que muda de tamanho e de lugar. A geometria do celular e da câmera está em base.html (VERT, K, CEL).
const CSS_VERTICAL = `
#grade { width: 1320px; height: 2160px; }
#abertura { top: 760px !important; }
#fim { top: 850px !important; }
.marca img { width: 170px; }
.marca .nome { font-size: 84px; }
.pilula { top: 64px; }
.pilula span { height: 84px; padding: 0 40px 0 16px; border-radius: 42px; gap: 18px; font-size: 38px; }
.pilula b { width: 54px; height: 54px; font-size: 27px; }
.peca { font-size: 38px; z-index: 5; }
.barra-endereco { height: 92px; padding: 0 36px; border-radius: 46px; gap: 18px; font-size: 36px; }
.barra-endereco svg { width: 32px; height: 32px; }
.gesto { height: 88px; padding: 0 36px; border-radius: 44px; }
.gesto i { font-size: 48px; }
.nota { height: 76px; padding: 0 30px; border-radius: 38px; font-size: 34px; }
.nota svg { width: 30px; height: 30px; }
.planta { height: 76px; padding: 0 28px 0 18px; border-radius: 38px; gap: 16px; font-size: 34px; }
.planta svg { width: 44px; height: 31px; }
#monitor { left: 110px; top: 640px; }`;
// ---------- Fim da configuração ----------

const AQUI = dirname(fileURLToPath(import.meta.url));
const ler = (f) => readFileSync(join(AQUI, "fonte", f), "utf8");
const base = ler("base.html"), pe = ler("pe.html");
const iphone = existsSync(join(AQUI, "fonte", "iphone.js")) ? ler("iphone.js") : "";
const linha = Object.fromEntries(LINHAS.map((l) => [l, ler(`${l}.js`)]));
const durDe = (fala) => {
  const s = readFileSync(join(AQUI, "assets", fala), "utf8");
  const F = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
  return Math.round((Math.max(...F.linhas.map((l) => l.b)) + FOLGA_FIM) * 10) / 10;
};

const pedidos = process.argv.slice(2);
for (const f of FILMES) {
  if (pedidos.length && !pedidos.includes(f.arq)) continue;
  const dur = f.dur ?? durDe(f.fala);
  const troca = {
    TITULO: f.titulo, TELAS: f.telas, FALA: f.fala, DUR: String(dur), SUB: f.sub ?? SUB, NOME, URL_APP,
    W: f.vert ? "1080" : "1920", H: f.vert ? "1920" : "1080", VERT: String(!!f.vert), CSS_FORMATO: f.vert ? CSS_VERTICAL : "",
  };
  let html = base.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in troca)) throw new Error(`marcador {{${k}}} sem valor`); return troca[k]; });
  html += iphone + "\n" + linha[f.linha] + "\n" + pe;
  // Filme sem o computador no fim: o monitor some.
  if (f.semMonitor) html = html.replace("#monitor { position: absolute;", "#monitor { display: none; position: absolute;");
  writeFileSync(join(AQUI, f.arq), html);
  console.log(`${f.arq}: ${f.titulo}, ${dur} s, ${troca.W}x${troca.H}, telas em ${f.telas}/`);
}
