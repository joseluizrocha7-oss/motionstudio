#!/usr/bin/env node
// ACRÉSCIMO LOCAL (19/10/2026), não faz parte da skill original.
// ler.mjs - confere o TEXTO do arquivo final: todo texto que o filme põe na tela é lido no vídeo entregue.
//
// O G1 (texto legível) era só por olho, e a marca 'fala' do ouvir.py diz o que o código declarou, não o que
// saiu na imagem. Este portão percorre o filme no Chrome, anota cada texto do HTML que fica inteiro e parado
// na tela, tira do MP4 entregue o quadro do meio do trecho mais longo em que ele fica parado, passa o OCR do
// Windows (pt-BR, embutido, sem instalar nada: ocr-windows.ps1) e procura o texto ali. Pega texto coberto
// por outra peça, cortado pela borda, miúdo ou apagado demais para ler, e acento trocado por quadradinho.
//
// Uso:
//   node ler.mjs <film/index-vertical.html> <film/final-9x16.mp4> [--passo 0.2] [--de s] [--ate s]
//        [--desde s] [--minimo 0.85] [--escala 2] [--out pasta] [--json]
//
//   --passo   de quanto em quanto tempo olhar o HTML (s). Texto que nunca fica parado 2 passos seguidos
//             não entra (contado como "passou em movimento").
//   --de/--ate  só este trecho do filme (s).
//   --desde   o MP4 começa no segundo s do filme (render feito com --from s). Padrão 0.
//   --minimo  quanto do texto o OCR precisa achar (0 a 1, por letras, com acento). Padrão 0.85.
//   --escala  ampliação antes do OCR (texto miúdo lê melhor ampliado). Padrão 2.
//   --out     pasta dos recortes e do ler.json. Padrão: ler-<nome do mp4>/ ao lado do MP4.
//
// No HTML, data-ler="ignorar" num elemento tira ele e o que tem dentro da conferência (texto ilustrativo
// que não precisa ser lido, como os rótulos miúdos da Tela de Início). Dizer no NOTE.md o que foi ignorado.
// O texto que está dentro das fotos do app não é do HTML e não é conferido aqui (é a tela de verdade).
//
// Portões (saída 1 se algum der ALERTA; 2 = erro de uso):
//   T1 texto lido     cada texto parado na tela é achado pelo OCR no quadro do MP4 entregue (no quadro inteiro ou
//                     numa segunda leitura do recorte ampliado). Texto que nunca fica à vista (sempre com outra
//                     peça por cima, no todo ou em parte) também alerta. Rodar o filme inteiro: com --de/--ate, uma
//                     camada que apareceu antes do trecho e depois foi coberta acusa sem ser defeito.
//   T2 texto inteiro  nenhum texto fica com pedaço fora do quadro durante todo o tempo em que aparece
//
// Diz o que o OCR leu; não diz se o texto é bonito, nem se o tamanho é o ideal. Falha é para olhar o recorte
// (a pasta de saída guarda um por alerta) antes de mexer: o OCR também erra, e o erro dele se prova no
// recorte e vai para o NOTE.md.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { launchChrome, parseArgs, die, helpFrom } from './_cdp.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HELP = helpFrom(import.meta.url);
const { pos, opt } = parseArgs(process.argv.slice(2), {
  help: 'bool', passo: 's', de: 's', ate: 's', desde: 's', minimo: 's', escala: 's', out: 's', json: 'bool',
});
if (opt.help || pos.length < 2) { console.log(HELP); process.exit(opt.help ? 0 : 2); }
const num = (v, d) => { if (v === undefined) return d; const n = Number(v); if (!Number.isFinite(n)) die(`número inválido: ${v}`, 2); return n; };
const [html, mp4] = pos.map((p) => path.resolve(p));
for (const a of [html, mp4]) if (!fs.existsSync(a)) die(`não achei ${a}`, 2);
const PASSO = num(opt.passo, 0.2), DESDE = num(opt.desde, 0), MINIMO = num(opt.minimo, 0.85), ESCALA = num(opt.escala, 2);
const OUT = path.resolve(opt.out || path.join(path.dirname(mp4), 'ler-' + path.basename(mp4, path.extname(mp4))));
fs.mkdirSync(OUT, { recursive: true });
const br = (n, d = 2) => String(Number(n.toFixed(d))).replace('.', ',');

// ---- o vídeo: tamanho, quadros por segundo e duração mandam (é o arquivo entregue)
const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', mp4], { encoding: 'utf8' });
if (pr.status !== 0) die('ffprobe falhou: ' + pr.stderr, 2);
const info = JSON.parse(pr.stdout), st = info.streams[0];
const W = st.width, H = st.height, FPS = (([a, b]) => a / b)(st.r_frame_rate.split('/').map(Number)), DUR_MP4 = Number(info.format.duration);

// ---- página: o mesmo contrato de salto do render.mjs (__seek, __timelines, gsap) e o levantamento dos textos
const LIB = `(() => {
  window.__lerSalto = async (t) => {
    if (typeof window.__seek === 'function') await window.__seek(t);
    else if (window.__timelines && Object.keys(window.__timelines).length) {
      for (const n of Object.keys(window.__timelines).sort((a, b) => (a === 'main') - (b === 'main'))) { const tl = window.__timelines[n]; if (tl && tl.seek) { if (tl.pause) tl.pause(); tl.seek(t, false); } }
    } else if (window.gsap && gsap.globalTimeline) { gsap.globalTimeline.pause(); gsap.globalTimeline.seek(t, false); }
    for (const a of document.getAnimations ? document.getAnimations() : []) { try { a.pause(); a.currentTime = t * 1000; } catch (e) {} }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  window.__lerDuracao = () => {
    const main = document.querySelector('[data-composition-id="main"]');
    if (typeof window.__duration === 'number') return window.__duration;
    if (typeof DUR === 'number') return DUR;
    if (main && parseFloat(main.getAttribute('data-duration')) > 0) return parseFloat(main.getAttribute('data-duration'));
    if (window.__timelines && window.__timelines.main) return window.__timelines.main.duration();
    if (window.gsap) return gsap.globalTimeline.duration();
    return null;
  };
  const ids = new WeakMap(); let prox = 1;
  const idDe = (el) => { if (!ids.has(el)) ids.set(el, prox++); return ids.get(el); };
  const caixa = (el) => { let e = el; while (e && e !== document.body) { const d = getComputedStyle(e).display; if (d !== 'inline' && d !== 'contents') return e; e = e.parentElement; } return document.body; };
  // Coberto: a peça por cima do texto pinta alguma coisa (fundo, imagem, vídeo, canvas, svg) e é de outro ramo.
  // O pointer-events vai forçado para todo elemento entrar no teste de ponto. Só vale aqui, não muda o desenho.
  const pe = document.createElement('style'); pe.textContent = '* { pointer-events: auto !important; }'; document.head.appendChild(pe);
  const opacidade = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const pinta = (el) => {
    if (/^(IMG|VIDEO|CANVAS|svg|IFRAME)$/.test(el.tagName)) return true;
    const c = getComputedStyle(el);
    return !/rgba\\([^)]*,\\s*0\\)$|transparent/.test(c.backgroundColor) || c.backgroundImage !== 'none';
  };
  const nome = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
  const coberturaDe = (cx, x0, y0, x1, y1, VW, VH) => {
    const pts = [[.5, .5], [.2, .5], [.8, .5], [.5, .25], [.5, .75]].map(([a, b]) => [x0 + (x1 - x0) * a, y0 + (y1 - y0) * b]).filter(([x, y]) => x >= 0 && y >= 0 && x < VW && y < VH);
    let n = 0; const quem = new Map();
    for (const [x, y] of pts) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (cx === el || cx.contains(el) || el.contains(cx)) break;            // chegou no texto antes de qualquer peça por cima
        if (pinta(el) && opacidade(el) >= 0.3) { n++; quem.set(nome(el), (quem.get(nome(el)) || 0) + 1); break; }
      }
    }
    return n ? { n, de: pts.length, por: [...quem.entries()].sort((a, b) => b[1] - a[1])[0][0] } : null;   // n de 5 pontos cobertos
  };
  window.__lerTextos = () => {
    const VW = innerWidth, VH = innerHeight, blocos = new Map();
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const txt = n.data.replace(/\\s+/g, ' ');
      if (!txt.trim()) continue;
      const pai = n.parentElement;
      if (!pai || pai.closest('script,style,noscript,template,[data-ler="ignorar"]')) continue;
      const cs = getComputedStyle(pai);
      if (cs.visibility === 'hidden' || cs.color === 'transparent' || /rgba\\([^)]*,\\s*0\\)$/.test(cs.color)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rs = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rs.length) continue;
      let op = 1; for (let e = pai; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.02) continue;
      let x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top)), x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom));
      let recortado = false;                                       // pedaço escondido por um pai com overflow
      for (let e = pai.parentElement; e && e !== document.documentElement; e = e.parentElement) {
        const c = getComputedStyle(e);
        if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
        const b = e.getBoundingClientRect();
        if (x0 < b.left - 1 || y0 < b.top - 1 || x1 > b.right + 1 || y1 > b.bottom + 1) recortado = true;
        x0 = Math.max(x0, b.left); y0 = Math.max(y0, b.top); x1 = Math.min(x1, b.right); y1 = Math.min(y1, b.bottom);
        if (x1 <= x0 || y1 <= y0) break;
      }
      if (x1 <= x0 || y1 <= y0) continue;
      const fora = x0 < -1 || y0 < -1 || x1 > VW + 1 || y1 > VH + 1;
      if (x1 <= 0 || y1 <= 0 || x0 >= VW || y0 >= VH) continue;
      const cx = caixa(pai), k = idDe(cx);
      const alt = rs.map((r) => r.height).sort((a, b) => a - b)[rs.length >> 1];
      const b = blocos.get(k);
      if (!b) blocos.set(k, { k, cx, texto: txt, x0, y0, x1, y1, alt, op, fora, recortado });
      else { b.texto += txt; b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1); b.alt = Math.min(b.alt, alt); b.op = Math.min(b.op, op); b.fora = b.fora || fora; b.recortado = b.recortado || recortado; }
    }
    return [...blocos.values()].map(({ cx, ...b }) => ({ ...b, texto: b.texto.replace(/\\s+/g, ' ').trim(),
      coberto: coberturaDe(cx, Math.max(0, b.x0), Math.max(0, b.y0), Math.min(VW, b.x1), Math.min(VH, b.y1), VW, VH) })).filter((b) => b.texto);
  };
  return true;
})()`;

const navegador = await launchChrome({ args: ['--allow-file-access-from-files'], width: W, height: H });
let amostras = [], DUR;
try {
  const p = await navegador.newPage({ width: W, height: H });
  await p.goto(pathToFileURL(html).href, { timeout: 45000 });
  await p.eval(LIB);
  for (let i = 0; i < 120; i++) {                                  // o motor do filme pode demorar a se instalar
    if (await p.eval("(typeof window.__seek === 'function' && !!window.__ready) || (typeof window.__seek !== 'function' && document.readyState === 'complete' && !!(window.__timelines || window.gsap))")) break;
    await new Promise((ok) => setTimeout(ok, 500));
  }
  await p.eval('(async () => { try { await document.fonts.ready; } catch (e) {} if (window.__ready && window.__ready.then) await window.__ready; await Promise.all([...document.images].map((i) => i.decode ? i.decode().catch(() => 0) : 0)); })()', { timeout: 120000 });
  DUR = (await p.eval('window.__lerDuracao()')) ?? (DUR_MP4 + DESDE);
  const de = num(opt.de, DESDE), ate = Math.min(num(opt.ate, DUR), DESDE + DUR_MP4 - 1 / FPS);
  amostras = await p.eval(`(async () => {
    const out = [];
    for (let i = 0; ; i++) {
      const t = Math.round((${de} + i * ${PASSO}) * ${FPS}) / ${FPS};
      if (t > ${ate} + 1e-6) break;
      await window.__lerSalto(t);
      out.push({ t, blocos: window.__lerTextos() });
    }
    return out;
  })()`, { timeout: 1800000 });
} finally { await navegador.close(); }

// ---- cada texto: o trecho mais longo em que fica inteiro, opaco e parado; o quadro do meio dele
const mesmoLugar = (a, b) => Math.abs(a.x0 - b.x0) <= 3 && Math.abs(a.y0 - b.y0) <= 3 && Math.abs(a.x1 - b.x1) <= 3 && Math.abs(a.y1 - b.y1) <= 3;
const textos = new Map();                      // chave = caixa + texto
amostras.forEach((a, i) => { for (const b of a.blocos) { const c = b.k + '|' + b.texto; if (!textos.has(c)) textos.set(c, { texto: b.texto, vezes: [] }); textos.get(c).vezes.push({ i, b }); } });
const conferir = [], cortados = [], cobertos = [];
let emMovimento = 0;
for (const [, tx] of textos) {
  const opacos = tx.vezes.filter((v) => v.b.op >= 0.98);
  // T2: opaco por meio segundo ou mais e sempre com pedaço fora do quadro ou escondido pelo pai (o palco #main
  // recorta o que passa da borda, então texto saindo do quadro aparece como recortado pelo pai)
  if (opacos.length * PASSO >= 0.5 && opacos.every((v) => v.b.fora || v.b.recortado)) {
    cortados.push({ texto: tx.texto, de: amostras[opacos[0].i].t, ate: amostras[opacos.at(-1).i].t });
    continue;
  }
  const bons = opacos.filter((v) => !v.b.fora && !v.b.recortado && !v.b.coberto);
  const sob = opacos.filter((v) => !v.b.fora && !v.b.recortado && v.b.coberto);
  if (!bons.length && sob.length * PASSO >= 0.5) {                 // opaco e inteiro no quadro, mas sempre com outra peça por cima
    const conta = new Map(); for (const v of sob) conta.set(v.b.coberto.por, (conta.get(v.b.coberto.por) || 0) + 1);
    // Nunca fica à vista na vida inteira dele: entrou já coberto (a tarja do teste, o preço atrás da cabeça da modelo).
    // Camada antiga que sobra no HTML não cai aqui, porque apareceu antes de ser coberta. Por isso rodar o filme inteiro.
    cobertos.push({ texto: tx.texto, de: amostras[sob[0].i].t, ate: amostras[sob.at(-1).i].t, por: [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0],
      inteiro: sob.every((v) => v.b.coberto.n === v.b.coberto.de) });
    continue;
  }
  let melhor = [], atual = [];
  for (const v of bons) {
    const u = atual.at(-1);
    if (u && v.i === u.i + 1 && mesmoLugar(u.b, v.b)) atual.push(v); else atual = [v];
    if (atual.length > melhor.length) melhor = atual.slice();
  }
  if (melhor.length < 2) { emMovimento++; continue; }                 // nunca ficou inteiro, opaco e parado por 2 olhadas
  const v = melhor[(melhor.length - 1) >> 1];
  conferir.push({ texto: tx.texto, i: v.i, t: amostras[v.i].t, b: v.b, parado: melhor.length * PASSO });
}

// ---- quadros do MP4 e OCR (uma chamada só ao PowerShell)
const quadros = [...new Set(conferir.map((c) => c.i))].sort((a, b) => a - b);
const pngDe = (i) => path.join(OUT, `q-${amostras[i].t.toFixed(2)}.png`);
for (const i of quadros) {
  const tv = amostras[i].t - DESDE;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', tv.toFixed(4), '-i', mp4, '-frames:v', '1', pngDe(i)], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(pngDe(i))) die(`ffmpeg não tirou o quadro de ${br(amostras[i].t)} s: ${r.stderr}`);
}
const lista = path.join(OUT, 'quadros.txt'), lido = path.join(OUT, 'ocr.json');
fs.writeFileSync(lista, quadros.map(pngDe).join('\n') + '\n', 'utf8');
if (quadros.length) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(AQUI, 'ocr-windows.ps1'), '-Lista', lista, '-Saida', lido, '-Escala', String(ESCALA)], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) die('OCR do Windows falhou: ' + (r.stderr || r.stdout));
}
const ocr = quadros.length ? JSON.parse(fs.readFileSync(lido, 'utf8').replace(/^\uFEFF/, '')) : [];
const ocrDe = new Map(quadros.map((i, j) => [i, ocr[j]]));

// ---- comparação: as palavras lidas vão para o texto do HTML que as contém; quanto do texto esperado foi achado
const norm = (s) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const semAcento = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
function achado(esperado, lidoTxt) {                            // 1 - menor distância de edição a um trecho do lido / tamanho do esperado
  const a = esperado, b = lidoTxt;
  if (!a.length) return 1;
  let ant = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = cur;
  }
  return 1 - Math.min(...ant) / a.length;
}
// Nota por letras e, à parte, o acento palavra a palavra: "Configuracao" tem 2 letras erradas em 20 e passaria
// no mínimo, mas acento perdido (ou trocado por quadradinho) é defeito em pt-BR.
function avaliar(texto, lidoTxt) {
  const e = norm(texto), l = norm(lidoTxt), nota = achado(e, l);
  const lidas = new Set(l.split(' ')), lidasSem = new Set(semAcento(l).split(' '));
  const semAcentoNoVideo = e.split(' ').filter((p) => p !== semAcento(p) && !lidas.has(p) && lidasSem.has(semAcento(p)));
  let estado = 'LIDO';
  if (nota < MINIMO) estado = achado(semAcento(e), semAcento(l)) >= MINIMO ? 'ACENTO' : (l ? 'DIVERGE' : 'ILEGÍVEL');
  else if (semAcentoNoVideo.length) estado = 'ACENTO';
  return { nota, estado, semAcentoNoVideo };
}
const resultados = [];
for (const c of conferir) {
  const q = ocrDe.get(c.i), blocosAqui = amostras[c.i].blocos.filter((b) => b.op >= 0.5 && !(b.coberto && b.coberto.n === b.coberto.de));
  const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
  const margem = Math.max(6, c.b.alt * 0.35);
  const dentro = (b, w, m) => { const cx = w.x + w.w / 2, cy = w.y + w.h / 2; return cx >= b.x0 - m && cx <= b.x1 + m && cy >= b.y0 - m && cy <= b.y1 + m; };
  const palavras = [];
  for (const l of q?.linhas || []) for (const w of l.palavras) {
    if (!dentro(c.b, w, margem)) continue;
    // a palavra é de outro texto só se ele for bem menor e também a contiver (o "9:45" de três barras empilhadas conta para as três)
    if (!blocosAqui.some((b) => b.k !== c.b.k && area(b) < area(c.b) * 0.8 && dentro(b, w, Math.max(6, b.alt * 0.35)))) palavras.push(w);
  }
  palavras.sort((a, b) => (Math.abs(a.y - b.y) < Math.max(a.h, b.h) * 0.6 ? a.x - b.x : a.y - b.y));
  const lidoTxt = palavras.map((w) => w.texto).join(' ');
  const { nota, estado } = avaliar(c.texto, lidoTxt);
  resultados.push({ texto: c.texto, t: Number(c.t.toFixed(3)), lido: lidoTxt, nota: Number(nota.toFixed(3)), estado, altura_pct: Number((c.b.alt / H * 100).toFixed(2)), parado_s: Number(c.parado.toFixed(2)),
    caixa: [c.b.x0, c.b.y0, c.b.x1, c.b.y1].map((v) => Math.round(v)), i: c.i, alt: c.b.alt });
}

// Segunda leitura: no quadro inteiro o OCR do Windows às vezes pula uma fileira de texto nítido (os rótulos da
// Tela de Início, 19/10/2026). No recorte ampliado 3x ele lê. Só alerta o que falha nas duas leituras.
const recortar = (r, m, arq) => {
  const [x0, y0, x1, y1] = r.caixa, x = Math.max(0, x0 - m), y = Math.max(0, y0 - m), w = Math.min(W, x1 + m) - x, h = Math.min(H, y1 + m) - y;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', pngDe(r.i), '-vf', `crop=${Math.round(w)}:${Math.round(h)}:${Math.round(x)}:${Math.round(y)}`, arq]);
  return arq;
};
const duvida = resultados.filter((r) => !['LIDO', 'CURTO'].includes(r.estado));
if (duvida.length) {
  const arqs = duvida.map((r, j) => recortar(r, Math.max(24, Math.round(r.alt)), path.join(OUT, `segunda-${j}.png`)));
  const l2 = path.join(OUT, 'segunda.txt'), o2 = path.join(OUT, 'ocr-segunda.json');
  fs.writeFileSync(l2, arqs.join('\n') + '\n', 'utf8');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(AQUI, 'ocr-windows.ps1'), '-Lista', l2, '-Saida', o2, '-Escala', '3'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) die('OCR do Windows falhou na segunda leitura: ' + (r.stderr || r.stdout));
  const o = JSON.parse(fs.readFileSync(o2, 'utf8').replace(/^FEFF/, ''));
  duvida.forEach((res, j) => {
    const lido2 = (o[j]?.linhas || []).map((l) => l.texto).join(' ');
    const a = avaliar(res.texto, lido2);
    if (a.estado === 'LIDO' || a.nota > res.nota) {                // a segunda leitura desfaz o alerta se ler tudo, acento inclusive
      res.lido = lido2; res.nota = Number(a.nota.toFixed(3)); res.estado = a.estado; res.segunda_leitura = true;
    }
  });
  for (const a of arqs) { try { fs.unlinkSync(a); } catch {} }
}
// O OCR do Windows não lê texto de menos de 3 letras que não forma palavra (o "1" da bolinha do passo, o "aA" do
// Safari), nem no recorte ampliado. Esse texto sai como não conferido, não como alerta.
for (const r of resultados) { const n = norm(r.texto).replace(/ /g, '').length; if (n === 0 || (n < 3 && r.estado !== 'LIDO')) r.estado = 'CURTO'; }   // só símbolo (✕ →) também

// recorte de cada alerta, para olhar antes de mexer
let nRec = 0;
for (const r of resultados.filter((x) => !['LIDO', 'CURTO'].includes(x.estado))) {
  r.recorte = recortar(r, 24, path.join(OUT, `alerta-${String(++nRec).padStart(2, '0')}-${r.t.toFixed(2)}s.png`));
}
for (const i of quadros) { try { fs.unlinkSync(pngDe(i)); } catch {} }
for (const r of resultados) { delete r.i; delete r.alt; }

const falhas = resultados.filter((r) => !['LIDO', 'CURTO'].includes(r.estado)), curtos = resultados.filter((r) => r.estado === 'CURTO');
const estado = { T1: falhas.length || cobertos.length ? 'ALERTA' : (resultados.length > curtos.length ? 'PASS' : 'NÃO MEDIDO'), T2: cortados.length ? 'ALERTA' : 'PASS' };
const medidos = resultados.filter((r) => r.estado !== 'CURTO'), menor = medidos.length ? Math.min(...medidos.map((r) => r.altura_pct)) : null;
const saida = { arquivo: mp4, html, quadro: `${W}x${H}`, passo_s: PASSO, minimo: MINIMO, portoes: estado, textos: resultados, cobertos, cortados, passou_em_movimento: emMovimento, menor_altura_pct: menor };
fs.writeFileSync(path.join(OUT, 'ler.json'), JSON.stringify(saida, null, 1), 'utf8');
if (opt.json) console.log(JSON.stringify(saida, null, 1));
else {
  console.log(`TEXTO  ${path.basename(mp4)}  ${W}x${H}  ${amostras.length} instantes olhados de ${br(PASSO)} em ${br(PASSO)} s (OCR do Windows, pt-BR; é medida, não olho)`);
  for (const r of falhas) console.log(`  ${r.estado.padEnd(8)} aos ${br(r.t).padStart(6)} s  esperado "${r.texto}"  lido "${r.lido}"  (${Math.round(r.nota * 100)}%, linha de ${br(r.altura_pct)}% da altura)  ${path.basename(r.recorte)}`);
  for (const c of cobertos) console.log(`  COBERTO  de ${br(c.de)} a ${br(c.ate)} s  "${c.texto}" fica o tempo todo ${c.inteiro ? 'inteiro' : 'com um pedaço'} debaixo de ${c.por}. Se for de propósito, marque data-ler="ignorar" e diga no NOTE.md.`);
  for (const c of cortados) console.log(`  CORTADO  de ${br(c.de)} a ${br(c.ate)} s  "${c.texto}" fica com pedaço fora do quadro o tempo todo`);
  console.log('PORTÕES DE TEXTO');
  const conferidos = resultados.length - curtos.length;
  const fora = [emMovimento ? `${emMovimento} nunca ficaram inteiros, opacos e parados` : '',
    curtos.length ? `${curtos.length} curtos demais para o OCR (${[...new Set(curtos.map((r) => r.texto))].join(' ')})` : ''].filter(Boolean);
  console.log(`  T1 texto lido      ${estado.T1.padEnd(10)}  ${conferidos - falhas.length} de ${conferidos} textos lidos no MP4` + (cobertos.length ? `, ${cobertos.length} nunca à vista` : '') +
    (menor !== null ? `; o menor tem linha de ${br(menor)}% da altura` : '') + (fora.length ? `; não conferidos: ${fora.join(' e ')}` : ''));
  console.log(`  T2 texto inteiro   ${estado.T2.padEnd(10)}  ${cortados.length ? cortados.length + ' com pedaço fora do quadro' : 'nenhum texto com pedaço fora do quadro'}`);
  console.log(`  detalhes: ${path.join(OUT, 'ler.json')}`);
}
process.exitCode = falhas.length || cobertos.length || cortados.length ? 1 : 0;
