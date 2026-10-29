// _concorrencia.mjs - apoio do render-trechos.mjs. Não é um comando.
// Exporta: listarProcessos, acharRenders (e os três leitores de lista de processos), esperarMemoria, instrucaoPartes.
// Nada aqui mata processo: só lê a lista e avisa.
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// ---- ler a lista de processos (as funções de leitura são puras: texto entra, lista sai) ----

// Windows, Get-CimInstance ... | ConvertTo-Json: uma lista, ou um objeto só quando há um processo.
export function lerProcessosPowershell(texto) {
  const t = String(texto).replace(/^﻿/, '').trim();
  if (!t) return [];
  let dados;
  try { dados = JSON.parse(t); } catch (e) { throw new Error('a saída do PowerShell não é JSON: ' + e.message); }
  return (Array.isArray(dados) ? dados : [dados])
    .filter((p) => p && Number.isFinite(Number(p.ProcessId)) && typeof p.CommandLine === 'string' && p.CommandLine)
    .map((p) => ({ pid: Number(p.ProcessId), comando: p.CommandLine }));
}

// Windows, wmic ... /format:csv. Colunas em ordem alfabética: Node,CommandLine,ProcessId. A linha de comando pode ter
// vírgula, então o nó é o que vem antes da 1a vírgula e o pid é o que vem depois da última.
export function lerProcessosWmic(texto) {
  const out = [];
  for (const linha of String(texto).split(/\r*\n/)) {
    const m = /^[^,]*,(.*),(\d+)\s*$/.exec(linha);
    if (m && m[1]) out.push({ pid: Number(m[2]), comando: m[1] });
  }
  return out;
}

// POSIX, ps -eo pid,args: "  4100 node /pasta/render.mjs ...". O cabeçalho não começa por número e fica de fora.
export function lerProcessosPs(texto) {
  const out = [];
  for (const linha of String(texto).split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(linha);
    if (m) out.push({ pid: Number(m[1]), comando: m[2] });
  }
  return out;
}

// Pergunta ao sistema. Devolve { processos, erro }; erro vem preenchido quando nenhuma fonte respondeu.
export function listarProcessos(plataforma = process.platform, executar = spawnSync) {
  const fontes = plataforma === 'win32'
    ? [
      // Sem aspas duplas dentro do comando e sem a palavra "render": a linha de comando do próprio PowerShell não pode parecer um render.
      { cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance -ClassName Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"], ler: lerProcessosPowershell },
      { cmd: 'wmic', args: ['process', 'where', "name='node.exe'", 'get', 'ProcessId,CommandLine', '/format:csv'], ler: lerProcessosWmic },
    ]
    : [{ cmd: 'ps', args: ['-ww', '-eo', 'pid,args'], ler: lerProcessosPs }];
  const falhas = [];
  for (const f of fontes) {
    const r = executar(f.cmd, f.args, { encoding: 'utf8', timeout: 20000, windowsHide: true, maxBuffer: 1 << 26 });
    if (r.error || r.status !== 0) { falhas.push(`${f.cmd}: ${r.error ? r.error.message : 'código ' + r.status}`); continue; }
    try { return { processos: f.ler(r.stdout || ''), erro: null }; } catch (e) { falhas.push(`${f.cmd}: ${e.message}`); }
  }
  return { processos: [], erro: falhas.join('; ') };
}

// Só vale o node rodando render.mjs, render-trechos.mjs ou render-rapido.mjs como programa. Não contam: render_partes.sh (ele
// chama o render.mjs, que aparece sozinho), grep, teste cujo nome tem "render" e `node -e "...render.mjs..."`.
const RE_PROGRAMA = /(?:^|[\s"'\\/])render(?:-trechos|-rapido)?\.mjs(?=["'\s]|$)/;
export function ehRender(comando) {
  const m = /^\s*(?:"([^"]*)"|(\S+))/.exec(comando);
  if (!m) return false;
  if (!/^node(?:js)?(?:\.exe)?$/i.test(path.win32.basename(m[1] ?? m[2]))) return false;
  const resto = comando.slice(m[0].length);
  if (/^\s*(?:-e|-p|--eval|--print|--test|--check|-c)(?:\s|=|$)/.test(resto)) return false;
  return RE_PROGRAMA.test(resto);
}
export const acharRenders = (processos, pidAtual = process.pid) => processos.filter((p) => p.pid !== pidAtual && ehRender(p.comando));

// ---- memória ----

// Espera a memória livre chegar a `minimo` bytes. Devolve true se chegou, false se passaram `limiteMs` sem chegar.
// `aoEsperar(livre)` roda uma vez, na primeira leitura abaixo do mínimo. Limite 0 não espera.
export async function esperarMemoria({ minimo, limiteMs, livre = os.freemem, passoMs = 2000, aoEsperar = () => {}, agora = Date.now }) {
  const t0 = agora();
  let avisou = false;
  while (livre() < minimo) {
    const restante = limiteMs - (agora() - t0);
    if (restante <= 0) return false;
    if (!avisou) { aoEsperar(livre()); avisou = true; }
    await new Promise((r) => setTimeout(r, Math.max(10, Math.min(passoMs, restante))));
  }
  return true;
}

// ---- a instrução do render_partes.sh ----

const comoCaminho = (s) => String(s).replace(/\\/g, '/');   // o Git Bash lê barra normal; a invertida vira escape
const citar = (s) => (/^[A-Za-z0-9_\/.:@%+=,-]+$/.test(s) ? s : `"${s.replace(/(["$`\\])/g, '\\$1')}"`);

// O comando que o render_partes.sh precisa para fazer o mesmo filme e a mesma saída.
//   script, filme, saida, audio: caminhos. dur: segundos (o render_partes.sh exige). parte, fps: só se foram pedidos.
//   render: pares [opção, valor] que o render.mjs recebe depois do "--" (--shutter, --subframes...).
export function instrucaoPartes({ script, filme, saida, dur, parte, fps, audio, render = [] }) {
  const p = [citar(comoCaminho(script)), citar(comoCaminho(filme)), citar(comoCaminho(saida)), '--dur', String(dur)];
  if (parte !== undefined) p.push('--parte', String(parte));
  if (fps !== undefined) p.push('--fps', String(fps));
  if (audio) p.push('--audio', citar(comoCaminho(audio)));
  if (render.length) p.push('--', ...render.flatMap(([k, v]) => [k, citar(String(v))]));
  return 'bash ' + p.join(' ');
}
