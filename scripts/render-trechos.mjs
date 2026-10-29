#!/usr/bin/env node
// render-trechos.mjs - o render_partes.sh com trechos em paralelo, GPU fixa, trava de memória e cache por
// conteúdo. Prova em 20/10/2026 (30 s de filme real, ver SKILL.md): trecho a trecho, o mesmo arquivo do
// render antigo, quadro a quadro, nos trechos em que o próprio render antigo se repete; no trecho em que o
// antigo varia sozinho (até 5 níveis na borda de um elemento animado), cada resultado do novo é um resultado
// do antigo.
//
// Uso (as mesmas opções do render_partes.sh, sem o "--" no meio):
//   node render-trechos.mjs <filme.html> <saida.mp4> [--audio mix.wav] [--dur S] --shutter 180 --subframes 8
//
//   --dur S          duração em segundos (padrão: a do filme, window.__duration)
//   --audio WAV      mixagem para juntar no fim (sem recodificar a imagem)
//   --trabalhos N    Chromes renderizando ao mesmo tempo, um trecho cada (padrão 2)
//   --gpu baixo      GPU do Chrome: baixo (Intel, padrão), alto (NVIDIA) ou sistema (o Windows escolhe;
//                    muda com o monitor ligado). Cada GPU dá pixels um pouco diferentes.
//   --memoria GB     memória livre para abrir mais um Chrome (padrão 3); trecho em que a livre cai abaixo de
//                    1,5 GB é refeito
//   --esperar-memoria MIN  tempo máximo, em minutos, esperando a memória livre chegar a --memoria para abrir um Chrome
//                    (padrão 10; aceita fração; 0 = não espera). Passou do tempo: o script não renderiza, sai com
//                    código 3 e escreve o comando do render_partes.sh para o mesmo filme e a mesma saída
//   --cache DIR      pasta do cache de trechos (padrão: cache-render/ ao lado do filme)
//   --sem-cache      não lê nem grava o cache
//   --atalho         EM TESTE, não provado: quadro com as 8 subamostras no mesmo estado leva 1 foto (ver abaixo)
//   --parte 5        tamanho de cada trecho em segundos (o mesmo --parte do render_partes.sh)
//   --de S --ate S   só os trechos entre esses tempos (para prova); use múltiplos de --parte
//   --planejar       só lê os estados e diz quantos trechos sairiam do cache; grava <saida>.plano.json
//   --cenas          EM TESTE, não provado. Corta onde o conteúdo manda (cenas de 2 a 10 s), não a cada 5 s. Assim um trecho
//                    inserido no meio do filme só invalida as cenas em volta. NÃO dá o mesmo arquivo do
//                    render_partes.sh: cada cena é igual ao render.mjs daquela cena, mas os cortes mudam
//                    a história do Chrome nos quadros parados logo depois de cada corte (ver abaixo).
//   e as do render.mjs: --fps --width --height --scale --shutter --subframes --crf --preset --grain --grain-seed --format
//
// Por que é igual ao render antigo, e por que não dá para pular mais (medido em 20/10/2026):
//  - Cada trecho é renderizado como o render.mjs faz: um Chrome limpo, o filme aberto, o quadro 0 pintado e
//    depois TODAS as subamostras do trecho pintadas em ordem. A foto de um quadro depende do que o Chrome pintou
//    antes: uma camada que desliza fração de pixel (a grade de fundo, por exemplo) só é redesenhada quando
//    andou o bastante desde o último desenho. Pular uma subamostra, mudar o começo do trecho ou ler o estado
//    no mesmo Chrome muda a foto (de 3 a 25 níveis, nos pontos da grade). Por isso: Chrome limpo por trecho,
//    trechos no mesmo lugar do render_partes.sh, leitura de estado num Chrome à parte.
//  - Atalho (--atalho, EM TESTE): quadro cujas 8 subamostras têm o MESMO estado (nada mudou no DOM) leva 1 foto e as 8 posições
//    a recebem; as outras 7 são só pintadas (14 ms cada, contra 81 ms de uma foto). Sem mudança no DOM, o
//    Chrome não desenha nada novo, e a foto é a mesma. Quadro com qualquer mudança, até fração de pixel,
//    leva as 8 fotos.
//  - Cache: a chave do trecho é o hash do estado de cada subamostra (atributos, texto e CSS de cada elemento,
//    lidos sem pintar), do quadro 0 (que o trecho pinta antes), do conteúdo das imagens, fontes e CSS que o
//    filme carrega, das opções, do Chrome (versão, GPU e a foto de uma página de teste) e do ffmpeg. Trecho
//    com a mesma chave sai do cache, mesmo que o filme tenha mudado em outro lugar. O código do filme não
//    entra: o efeito dele está nos estados.
//  - Paralelo: cada Chrome confere o caminho de desenho (GPU ou software) antes e depois do trecho; se mudou,
//    o trecho é refeito. Um Chrome que cai da GPU para o software desenha diferente (46 a 58 dB).
//
// Saída: <saida.mp4>, <saida.mp4>.events.json e <saida.mp4>.render.json (as medidas).
// Início: se achar outro render.mjs, render-trechos.mjs ou render-rapido.mjs vivo na máquina, avisa com a linha de
// comando de cada um (dois renders juntos disputam memória e derrubam o Chrome). Não mata nada.
// Código de saída: 0 ok, 1 falha, 2 uso errado, 3 memória livre insuficiente (a mensagem traz o comando do render_partes.sh).
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { launchChrome, parseArgs, die, helpFrom } from './_cdp.mjs';
import { PAGE_LIB, PAGINA_TESTE } from './_pagina.mjs';
import { acharRenders, esperarMemoria, instrucaoPartes, listarProcessos } from './_concorrencia.mjs';

const MOTOR = 'render-trechos 1';
const HELP = helpFrom(import.meta.url);
const { pos, opt } = parseArgs(process.argv.slice(2), {
  help: 'bool', fps: 's', width: 's', height: 's', dur: 's', de: 's', ate: 's', audio: 's', crf: 's', preset: 's', scale: 's',
  format: 's', shutter: 's', subframes: 's', grain: 's', 'grain-seed': 's', trabalhos: 's', cache: 's', 'sem-cache': 'bool',
  atalho: 'bool', parte: 's', planejar: 'bool', cenas: 'bool', memoria: 's', 'esperar-memoria': 's', gpu: 's',
});
if (opt.help || pos.length < 2) { console.log(HELP); process.exit(opt.help ? 0 : 2); }
const num = (v, d, name) => { if (v === undefined) return d; const n = Number(v); if (!Number.isFinite(n)) die(`--${name} precisa ser um número`, 2); return n; };
const fps = num(opt.fps, 30, 'fps'), scale = num(opt.scale, 1, 'scale'), crf = num(opt.crf, 18, 'crf');
const format = opt.format || 'jpeg';
if (!['jpeg', 'png'].includes(format)) die('--format é jpeg ou png', 2);
const shutterOn = opt.shutter !== undefined;
const shutter = shutterOn ? num(opt.shutter, 180, 'shutter') : 0;
if (shutterOn && !(shutter > 0 && shutter <= 360)) die('--shutter é um ângulo, 0 < ângulo <= 360', 2);
if (opt.subframes !== undefined && !shutterOn) die('--subframes precisa de --shutter', 2);
const sub = shutterOn ? Math.round(num(opt.subframes, 8, 'subframes')) : 1;
if (shutterOn && (sub < 2 || sub > 32)) die('--subframes vai de 2 a 32 (8 recomendado)', 2);
const grain = opt.grain !== undefined ? num(opt.grain, 0, 'grain') : 0;
const grainSeed = Math.round(num(opt['grain-seed'], 7, 'grain-seed'));
const trabalhos = Math.max(1, Math.round(num(opt.trabalhos, 2, 'trabalhos')));
const parteS = num(opt.parte, 5, 'parte');
const memAbrir = num(opt.memoria, 3, 'memoria') * 1e9;   // GB livres para abrir mais um Chrome
const esperarMin = num(opt['esperar-memoria'], 10, 'esperar-memoria');   // minutos esperando memória para abrir um Chrome
if (esperarMin < 0) die('--esperar-memoria não pode ser negativo', 2);
const MEM_TRECHO = 1.5e9;                                 // abaixo disso durante o trecho, ele é refeito
// GPU fixa (20/10/2026): sem preferência, o Chrome sem janela desenha na GPU que o Windows lista primeiro, e
// isso muda quando se liga um monitor. Intel e NVIDIA dão pixels diferentes. "baixo" = a GPU de baixo consumo
// (a Intel nesta máquina, a mesma dos renders até 20/10), "alto" = a NVIDIA, "sistema" = o que o Windows escolher.
const gpu = opt.gpu || 'baixo';
if (!['baixo', 'alto', 'sistema'].includes(gpu)) die('--gpu é baixo, alto ou sistema', 2);
const GPU_ARGS = gpu === 'baixo' ? ['--force_low_power_gpu'] : gpu === 'alto' ? ['--force_high_performance_gpu'] : [];
const atalho = !!opt.atalho;   // em teste: o filme da prova (20/10/2026) não tinha nenhum quadro assim
const src = pos[0];
if (!fs.existsSync(src)) die(`não achei ${src}`, 2);
const url = pathToFileURL(path.resolve(src)).href;
const saida = path.resolve(pos[1]);
if (opt.audio && !fs.existsSync(opt.audio)) die(`não achei o áudio ${opt.audio}`, 2);
const usaCache = !opt['sem-cache'];
const pastaCache = path.resolve(opt.cache || path.join(path.dirname(path.resolve(src)), 'cache-render'));
const pastaTrab = saida.replace(/\.[^.\\/]+$/, '') + '-trechos';
const QUAL = 92;

const hora = () => new Date().toTimeString().slice(0, 8);
const log = (s) => console.error(`${hora()} ${s}`);
const sha1 = (...partes) => { const h = crypto.createHash('sha1'); for (const p of partes) h.update(typeof p === 'string' ? p : Buffer.from(p)); return h.digest('hex'); };
const quadros = (f, contar = true) => { const r = spawnSync('ffprobe', ['-v', 'error', ...(contar ? ['-count_frames'] : []), '-select_streams', 'v:0', '-show_entries', `stream=${contar ? 'nb_read_frames' : 'nb_frames'}`, '-of', 'csv=p=0', f], { encoding: 'utf8' }); return parseInt((r.stdout || '').replace(/\D/g, ''), 10) || 0; };
const roda = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', (d) => { e += d; }); p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg falhou (' + c + '): ' + e.slice(-600))))); });

// ---- a mesma cadeia de ffmpeg do render.mjs ----
const head = shutterOn ? `format=gbrp16le,tmix=frames=${sub},select=eq(mod(n\\,${sub})\\,${sub - 1}),setpts=PTS-STARTPTS` : 'format=gbrp';
const tail = grain > 0 ? `,noise=c0s=${Math.max(1, Math.round(grain * 100))}:c0f=t+u:c0_seed=${grainSeed}` : '';
const VF = head + ',scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd+full_chroma_int,format=yuv420p' + tail;
const COR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// ---- erros da página ----
const erros = new Map();
const addErr = (s) => { s = String(s).slice(0, 300); erros.set(s, (erros.get(s) || 0) + 1); };
const recursos = new Set();

// Abre um Chrome com o filme, do jeito do render.mjs (mesmos passos, na mesma ordem).
async function abre({ coletar = false } = {}) {
  const br = await launchChrome({ args: ['--allow-file-access-from-files', ...GPU_ARGS] });
  let W = opt.width ? num(opt.width, 0, 'width') : null, H = opt.height ? num(opt.height, 0, 'height') : null;
  const page = await br.newPage({ width: W || 1920, height: H || 1080, scale });
  await page.send('Log.enable');
  if (coletar) {
    await page.send('Network.enable').catch(() => {});
    page.on('Network.requestWillBeSent', (p) => { if (p.request && /^file:/i.test(p.request.url) && p.type !== 'Document' && p.type !== 'Script') recursos.add(p.request.url); });
  }
  page.on('Runtime.exceptionThrown', (p) => addErr('exception: ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').split('\n')[0]));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') addErr('console.error: ' + (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ')); });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') addErr(`${p.entry.source}: ${p.entry.text} ${p.entry.url || ''}`); });
  page.on('Page.javascriptDialogOpening', () => page.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}));
  const ok = await page.goto(url, { timeout: 45000 });
  if (!ok) addErr('o evento load não chegou em 45 s');
  await page.eval(PAGE_LIB);
  const prep = await page.eval('window.__mdPrepare()', { timeout: 60000 });
  for (const p of prep) addErr(p);
  const info = await page.eval('window.__mdInfo()');
  W = W || info.width || 1920; H = H || info.height || 1080;
  await page.setViewport(W, H, scale);
  await page.eval('window.__mdFrame(0)');   // como o render.mjs: o quadro 0 pintado uma vez antes do trecho
  const caminho = async () => {
    const i = await br.cdp.send('SystemInfo.getInfo', {}, undefined, 20000);
    const f = i.gpu.featureStatus || {};
    return `${f.gpu_compositing}/${f.rasterization} ${(i.gpu.devices || []).filter((d) => d.active !== false).map((d) => d.deviceString).join('+')}`;
  };
  return { br, page, info, W, H, caminho };
}

let durFilme = 0, JQ = 150;
const cenas = !!opt.cenas;
const span = shutterOn ? shutter / 360 / fps : 0;
// Os tempos das subamostras do quadro g. Trechos: a MESMA conta do render.mjs num trecho do render_partes.sh
// (o --from do trecho com 6 casas, mais i/fps, mais o meio da fatia do obturador; bit a bit igual).
// Cenas: g/fps mais o meio da fatia, que não depende de onde a cena começa.
function tempos(g) {
  if (cenas) return Array.from({ length: sub }, (_, k) => Math.min(g / fps + (shutterOn ? ((k + 0.5) / sub) * span : 0), durFilme));
  const qa = Math.floor(g / JQ) * JQ, i = g - qa;
  const t0 = Number((qa / fps).toFixed(6));
  return Array.from({ length: sub }, (_, k) => Math.min(t0 + i / fps + (shutterOn ? ((k + 0.5) / sub) * span : 0), durFilme));
}

(async () => {
  const inicio = Date.now();
  if (!opt.planejar) {
    const { processos, erro } = listarProcessos();
    if (erro) log(`aviso: não consegui listar os processos (${erro}); não sei se há outro render na máquina`);
    const outros = acharRenders(processos);
    for (const p of outros) log(`aviso: outro render está vivo (pid ${p.pid}): ${p.comando.slice(0, 400)}`);
    if (outros.length) log(`aviso: renders juntos disputam a memória. Este espera até ${esperarMin} min por ${(memAbrir / 1e9).toFixed(1)} GB livres (--esperar-memoria) e depois sai com o comando do render_partes.sh.`);
  }
  fs.mkdirSync(pastaTrab, { recursive: true });
  if (usaCache) fs.mkdirSync(pastaCache, { recursive: true });
  const ffv = (spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout || '').split('\n')[0];

  // 1. Chrome dos estados (à parte: buscar sem pintar muda a história do Chrome)
  const E = await abre({ coletar: true });
  const { info, W, H } = E;
  const total = opt.dur !== undefined ? num(opt.dur, 0, 'dur') : info.duration;
  if (!(total > 0)) die('não sei a duração: passe --dur');
  durFilme = info.duration > 0 ? info.duration : total;   // o render.mjs limita o tempo pela duração do filme
  JQ = Math.max(1, Math.round(parteS * fps));
  const nTot = Math.round(total * fps);
  const f0 = Math.round(num(opt.de, 0, 'de') * fps), f1 = Math.min(nTot, Math.round(num(opt.ate, total, 'ate') * fps));
  if (!(f1 > f0)) die('trecho vazio');
  if (!cenas && f0 % JQ !== 0) log(`aviso: --de não cai no começo de um trecho de ${parteS} s; o primeiro trecho sai diferente do render_partes.sh`);
  const caminho0 = await E.caminho();
  const teste = await E.br.newPage({ width: W, height: H, scale });
  await teste.goto(PAGINA_TESTE(W, H), { timeout: 30000 });
  await teste.eval('document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))');
  const digital = sha1(await teste.shot({ format, quality: QUAL }));
  await teste.close();
  log(`${src}: ${W}x${H}, ${total} s, quadros ${f0} a ${f1}, ${sub} subamostras, ${E.br.version}, ${caminho0}`);

  // 2. estados de todas as subamostras e do quadro 0 (o trecho pinta o 0 antes de começar)
  const tE = Date.now();
  const LOTE = 15, H8 = new Array(f1 - f0);
  const h0 = (await E.page.eval(`window.__mdEstados([0])`))[0];
  for (let a = f0; a < f1; a += LOTE) {
    const b = Math.min(f1, a + LOTE), ts = [];
    for (let g = a; g < b; g++) ts.push(...tempos(g));
    const hs = await E.page.eval(`window.__mdEstados(${JSON.stringify(ts)})`, { timeout: 120000 });
    for (let g = a; g < b; g++) H8[g - f0] = hs.slice((g - a) * sub, (g - a + 1) * sub);
  }
  let eventos = null;
  try { eventos = await E.page.eval('(() => { const e = window.__events; if (typeof e === "function") return JSON.stringify(e()); return Array.isArray(e) ? JSON.stringify(e) : null; })()'); } catch (e) { addErr('não li window.__events: ' + e.message); }
  try { await E.br.close(); } catch {}
  const msEstados = Date.now() - tE;
  const iguais = H8.map((h) => h.every((x) => x === h[0]));
  log(`estados de ${(f1 - f0) * sub} subamostras em ${(msEstados / 1000).toFixed(0)} s; ${iguais.filter(Boolean).length} quadros com as ${sub} subamostras no mesmo estado`);

  // chave global: tudo o que muda os pixels e não está no estado
  const arqs = [...recursos].map((u) => { try { return fileURLToPath(u.split('#')[0].split('?')[0]); } catch { return null; } }).filter((f) => f && fs.existsSync(f)).sort();
  const conteudo = arqs.map((f) => sha1(fs.readFileSync(f)) + ' ' + path.basename(f)).join('\n');
  const chaveGlobal = sha1(MOTOR, cenas ? 'cenas' : 'trechos', `${W}x${H}@${scale} fps${fps} sh${shutter} sub${sub} ${format}${QUAL} crf${crf} ${opt.preset || 'medium'} grain${grain}/${grainSeed}`,
    E.br.version, caminho0, digital, ffv, h0, conteudo);

  // 3. os cortes e o que já está no cache. Trechos: os mesmos cortes do render_partes.sh. Cenas: corte
  //    pelo conteúdo (o hash do estado da 1a subamostra decide; de 2 a 10 s, média de 5 s), que cai no
  //    mesmo lugar da cena quando ela só mudou de lugar no tempo.
  const cortes = [];
  if (cenas) {
    const MIN = Math.round(2 * fps), MAX = Math.round(10 * fps), MOD = Math.round(3 * fps);
    let ini = f0;
    for (let g = f0 + 1; g < f1; g++) {
      const len = g - ini;
      if ((len >= MIN && parseInt(H8[g - f0][0].slice(0, 8), 16) % MOD === 0) || len >= MAX) { cortes.push([ini, g]); ini = g; }
    }
    cortes.push([ini, f1]);
  } else {
    for (let q = Math.floor(f0 / JQ) * JQ; q < f1; q += JQ) cortes.push([Math.max(q, f0), Math.min(q + JQ, f1)]);
  }
  const trechos = cortes.map(([a, b], i) => {
    const hs = []; for (let g = a; g < b; g++) hs.push(H8[g - f0].join(','));
    return { a, b, i, chave: sha1(chaveGlobal, cenas ? `${b - a}` : `${a % JQ} ${b - a}`, hs.join(';')) };
  });
  const arqTrecho = (t) => (usaCache ? path.join(pastaCache, t.chave + '.mp4') : path.join(pastaTrab, `p-${String(t.i).padStart(3, '0')}.mp4`));
  const noCache = (t) => {
    if (!usaCache) return false;
    const m = arqTrecho(t), j = m.replace(/\.mp4$/, '.json');
    if (!fs.existsSync(m) || !fs.existsSync(j)) return false;
    try { return JSON.parse(fs.readFileSync(j, 'utf8')).quadros === t.b - t.a && quadros(m, false) === t.b - t.a; } catch { return false; }
  };
  const vistos = new Set();
  const fila = trechos.filter((t) => { if (noCache(t) || vistos.has(t.chave)) return false; vistos.add(t.chave); return true; });
  const qFila = fila.reduce((s, t) => s + t.b - t.a, 0);
  log(`${trechos.length} ${cenas ? 'cenas' : `trechos de ${parteS} s`}; ${trechos.length - fila.length} do cache (${((f1 - f0 - qFila) / fps).toFixed(1)} s), ${fila.length} para renderizar (${(qFila / fps).toFixed(1)} s) com ${Math.min(trabalhos, fila.length || 1)} Chrome(s)`);
  if (opt.planejar) {
    fs.writeFileSync(saida + '.plano.json', JSON.stringify({ filme: path.resolve(src), cenas, quadros: f1 - f0, s_estados: +(msEstados / 1000).toFixed(1),
      quadros_identicos: iguais.filter(Boolean).length, trechos: trechos.map((t) => ({ de: t.a, ate: t.b, chave: t.chave, no_cache: !fila.includes(t) })) }, null, 1));
    fs.rmSync(pastaTrab, { recursive: true, force: true });
    log(`plano gravado em ${saida}.plano.json`);
    return;
  }

  // 4. render: um Chrome limpo por trecho, como o render.mjs.
  // Memória (20/10/2026): com 3 Chromes abrindo juntos, a memória livre foi a 0,01 GB e 2 de 6 trechos saíram
  // diferentes do render antigo. Abaixo de ~1 GB livre o Chrome do Windows entra em "pressão de memória" e
  // descarta cache, e a foto muda. Por isso: um Chrome abre por vez, só com --memoria GB livres, e o trecho
  // em que a memória livre caiu abaixo de 1,5 GB é jogado fora e refeito.
  const est = { fotos: 0, quadros: 0, atalhos: 0, refeitos: 0, minLivre: Infinity };
  // Memória que não chega não se resolve com outra tentativa: sai com código 3 e o comando do render_partes.sh (um Chrome
  // por vez), com o mesmo filme e a mesma saída. O script não troca de motor sozinho.
  const REPASSA = ['width', 'height', 'scale', 'shutter', 'subframes', 'crf', 'preset', 'format', 'grain', 'grain-seed'];
  const comandoPartes = () => instrucaoPartes({
    script: path.join(path.dirname(fileURLToPath(import.meta.url)), 'render_partes.sh'), filme: path.resolve(src), saida, dur: total,
    parte: opt.parte, fps: opt.fps, audio: opt.audio ? path.resolve(opt.audio) : undefined,
    render: REPASSA.filter((k) => opt[k] !== undefined).map((k) => [`--${k}`, opt[k]]),
  });
  const semDeAte = opt.de !== undefined || opt.ate !== undefined ? '\n  (o render_partes.sh renderiza o filme todo: não tem --de nem --ate)' : '';
  const erroMemoria = (msg) => Object.assign(new Error(`${msg}. Rode o filme com o render_partes.sh (um Chrome por vez):\n  ${comandoPartes()}${semDeAte}`), { codigo: 3 });
  let portao = Promise.resolve();
  const abreComMemoria = () => {
    const p = portao.then(async () => {
      const chegou = await esperarMemoria({ minimo: memAbrir, limiteMs: esperarMin * 60000,
        aoEsperar: (livre) => log(`esperando memória: ${(livre / 1e9).toFixed(1)} GB livres, preciso de ${(memAbrir / 1e9).toFixed(1)} para abrir mais um Chrome (até ${esperarMin} min)`) });
      if (!chegou) throw erroMemoria(`a memória livre não chegou a ${(memAbrir / 1e9).toFixed(1)} GB em ${esperarMin} min (agora ${(os.freemem() / 1e9).toFixed(1)} GB). Provável causa: outro render na máquina`);
      return abre();
    });
    portao = p.catch(() => {});
    return p;
  };
  async function renderTrecho(t) {
    const n = t.b - t.a;
    const fim = arqTrecho(t), tmp = fim + `.${process.pid}.tmp.mp4`;
    let minLivre = os.freemem();
    const amostra = setInterval(() => { minLivre = Math.min(minLivre, os.freemem()); }, 250);
    let C = null;
    try {
      C = await abreComMemoria();
      if (C.W !== W || C.H !== H) throw new Error('o filme abriu em outro tamanho');
      if (await C.caminho() !== caminho0) throw new Error(`o Chrome abriu desenhando por outro caminho (${await C.caminho()})`);
      const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', format === 'png' ? 'png' : 'mjpeg', '-i', '-',
        '-vf', VF, '-c:v', 'libx264', '-preset', opt.preset || 'medium', '-crf', String(crf), '-r', String(fps), ...COR, '-movflags', '+faststart', '-f', 'mp4', tmp], { stdio: ['pipe', 'ignore', 'pipe'] });
      let ffErr = '', ffFim = null;
      ff.stderr.on('data', (d) => { ffErr += d; });
      const ffSai = new Promise((r) => ff.on('close', (k) => { ffFim = k; r(k); }));
      ff.stdin.on('error', () => {});
      const escreve = async (buf) => { if (ffFim !== null) throw new Error('ffmpeg saiu antes: ' + ffErr.slice(-400)); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); };
      let fotos = 0, atalhos = 0;
      try {
        for (let g = t.a; g < t.b; g++) {
          if (minLivre < MEM_TRECHO) throw Object.assign(new Error(`a memória livre caiu a ${(minLivre / 1e9).toFixed(2)} GB no quadro ${g} (abaixo de ${(MEM_TRECHO / 1e9).toFixed(1)} GB o Chrome descarta cache e a foto muda)`), { memoria: true });
          const ts = tempos(g);
          if (atalho && iguais[g - f0]) {
            // as 8 subamostras com o mesmo estado: 1 foto; as outras só pintadas, na mesma ordem do render antigo
            await C.page.eval(`window.__mdFrame(${ts[0]})`, { timeout: 30000 });
            const buf = await C.page.shot({ format, quality: QUAL }); fotos++; atalhos++;
            await escreve(buf);
            for (let k = 1; k < sub; k++) { await C.page.eval(`window.__mdFrame(${ts[k]})`, { timeout: 30000 }); await escreve(buf); }
          } else {
            for (let k = 0; k < sub; k++) { await C.page.eval(`window.__mdFrame(${ts[k]})`, { timeout: 30000 }); await escreve(await C.page.shot({ format, quality: QUAL })); fotos++; }
          }
        }
        if (await C.caminho() !== caminho0) throw new Error('o Chrome mudou de caminho de desenho durante o trecho');
        minLivre = Math.min(minLivre, os.freemem());
        if (minLivre < MEM_TRECHO) throw Object.assign(new Error(`a memória livre caiu a ${(minLivre / 1e9).toFixed(2)} GB durante o trecho (abaixo de ${(MEM_TRECHO / 1e9).toFixed(1)} GB o Chrome descarta cache e a foto muda)`), { memoria: true });
        ff.stdin.end();
        if (await ffSai !== 0) throw new Error('ffmpeg falhou: ' + ffErr.slice(-400));
      } catch (e) { try { ff.stdin.destroy(); ff.kill(); } catch {} await ffSai.catch(() => {}); throw e; }
      const nq = quadros(tmp);
      if (nq !== n) throw new Error(`o trecho saiu com ${nq} quadros, esperado ${n}`);
      fs.renameSync(tmp, fim);
      fs.writeFileSync(fim.replace(/\.mp4$/, '.json'), JSON.stringify({ quadros: n, filme: path.resolve(src), de: t.a / fps, ate: t.b / fps, fotos, atalhos, memoria_livre_min_gb: +(minLivre / 1e9).toFixed(2), criado: new Date().toISOString() }, null, 1));
      est.fotos += fotos; est.atalhos += atalhos; est.quadros += n; est.minLivre = Math.min(est.minLivre, minLivre);
      return { fotos, atalhos, minLivre };
    } finally {
      clearInterval(amostra);
      try { fs.rmSync(tmp, { force: true }); } catch {}
      try { await C?.br.close(); } catch {}
    }
  }
  const tR = Date.now();
  let feitos = 0;
  const totalFila = fila.length;
  await Promise.all(Array.from({ length: Math.min(trabalhos, fila.length) }, async () => {
    while (fila.length) {
      const t = fila.shift();
      for (let tentativa = 1; ; tentativa++) {
        const t1 = Date.now();
        try {
          const r = await renderTrecho(t);
          feitos++;
          log(`trecho ${t.i + 1}/${trechos.length} (${(t.a / fps).toFixed(1)} a ${(t.b / fps).toFixed(1)} s) em ${((Date.now() - t1) / 1000).toFixed(0)} s, ${r.fotos} fotos${r.atalhos ? `, ${r.atalhos} quadros idênticos` : ''}, memória livre mínima ${(r.minLivre / 1e9).toFixed(1)} GB  [${feitos}/${totalFila}]`);
          break;
        } catch (e) {
          if (e.codigo === 3) throw e;   // a memória não chegou a tempo: não há tentativa a repetir
          est.refeitos++;
          if (tentativa >= 4) {
            const falha = new Error(`o trecho ${t.i + 1} não saiu em 4 tentativas: ${e.message.split('\n')[0]}`);
            // Caso de 29/10/2026: 4 falhas no mesmo trecho com a memória livre entre 1,43 e 1,50 GB, outro render na máquina.
            if (e.memoria) { falha.message += `\nA memória livre ficou baixa nas 4 tentativas. Rode o filme com o render_partes.sh (um Chrome por vez):\n  ${comandoPartes()}${semDeAte}`; falha.codigo = 3; }
            throw falha;
          }
          log(`trecho ${t.i + 1} falhou (${e.message.split('\n')[0]}), tentativa ${tentativa + 1}`);
        }
      }
    }
  }));
  const msRender = Date.now() - tR;

  // 5. junta os trechos (arquivos inteiros, cada um começando num quadro-chave) e o som, como o render_partes.sh
  const tF = Date.now();
  const lista = path.join(pastaTrab, 'lista.txt');
  fs.writeFileSync(lista, trechos.map((t) => `file '${arqTrecho(t).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  if (opt.audio) {
    // apad: o som completa com silêncio até o fim da imagem (render_partes.sh, 14/10/2026)
    const ss = f0 > 0 ? ['-ss', String(f0 / fps)] : [];
    await roda(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, ...ss, '-i', opt.audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', 'apad', '-shortest', '-movflags', '+faststart', saida]);
  } else {
    await roda(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', saida]);
  }
  const nFinal = quadros(saida);
  if (nFinal !== f1 - f0) throw new Error(`o filme juntado tem ${nFinal} quadros, esperado ${f1 - f0}`);
  if (eventos) {
    let arr = JSON.parse(eventos);
    if (Array.isArray(arr)) {
      arr = arr.map((e) => (e && typeof e === 'object' ? { ...e, ...(e.frame === undefined && typeof e.t === 'number' ? { frame: Math.round(e.t * fps) } : {}) } : e)).sort((x, y) => (x?.t ?? 0) - (y?.t ?? 0));
      fs.writeFileSync(saida + '.events.json', JSON.stringify(arr, null, 1));
    }
  }
  fs.rmSync(pastaTrab, { recursive: true, force: true });
  const rel = {
    filme: path.resolve(src), saida, quadros: f1 - f0, cenas, trabalhos, atalho, cache: usaCache ? pastaCache : null,
    trechos: trechos.length, trechos_do_cache: trechos.length - feitos, trechos_renderizados: feitos, segundos_renderizados: +(est.quadros / fps).toFixed(2),
    fotos: est.fotos, fotos_do_render_antigo: est.quadros * sub, quadros_identicos: est.atalhos, trechos_refeitos: est.refeitos, memoria_livre_min_gb: +(est.minLivre / 1e9).toFixed(2),
    s_estados: +(msEstados / 1000).toFixed(1), s_render: +(msRender / 1000).toFixed(1), s_juntar: +((Date.now() - tF) / 1000).toFixed(1), s_total: +((Date.now() - inicio) / 1000).toFixed(1),
    chrome: E.br.version, caminho: caminho0,
  };
  fs.writeFileSync(saida + '.render.json', JSON.stringify(rel, null, 1));
  log(`pronto: ${saida}, ${nFinal} quadros${opt.audio ? ', com som' : ''}`);
  log(`trechos: ${rel.trechos} (${rel.trechos_do_cache} do cache, ${rel.trechos_renderizados} renderizados, ${rel.segundos_renderizados} s de filme); fotos: ${rel.fotos} de ${rel.fotos_do_render_antigo}; tempo: estados ${rel.s_estados} s, render ${rel.s_render} s, juntar ${rel.s_juntar} s, total ${rel.s_total} s`);
  console.log(saida);
})().catch((e) => {
  console.error(`${hora()} erro: ${e.message}`); process.exitCode = e.codigo || 1;
  if (e.codigo === 3) fs.rmSync(pastaTrab, { recursive: true, force: true });
})
  .finally(() => {
    if (erros.size) { console.error(`\nerros do console da página (${erros.size} distintos):`); [...erros].slice(0, 20).forEach(([k, v]) => console.error(`  ${v > 1 ? `[x${v}] ` : ''}${k}`)); }
    process.exit(process.exitCode || 0);
  });
