#!/usr/bin/env bash
# ACRÉSCIMO LOCAL (13/10/2026), não faz parte da skill original.
#
# render_partes.sh - render final em trechos, um de cada vez, com conferência e repetição.
#
# Nesta máquina o render de um filme inteiro falha no meio ("Unable to capture
# screenshot", "timeout after 60000ms", ou o arquivo nem é criado). Este script
# divide o filme em trechos, confere cada um pela contagem de quadros, refaz o
# que falhou (até 4 tentativas), pula o que já está pronto e junta tudo sem
# recodificar. Substitui o final.sh que era escrito à mão em cada filme.
#
# Uso:
#   bash render_partes.sh <filme.html> <saida.mp4> --dur <segundos> [--parte 5] [--fps 30] [--audio mix.wav] [-- <opções do render.mjs>]
#
#   bash "$SKILL/scripts/render_partes.sh" film/index-vertical.html film/final-9x16.mp4 --dur 23 -- --shutter 180 --subframes 16
#
#   --dur     duração do filme em segundos (a mesma do --expect do look.py)
#   --parte   tamanho de cada trecho em segundos (padrão 5)
#   --audio   mixagem para juntar no fim (sem recodificar a imagem). Sem ela, o vídeo sai mudo.
#   depois de "--" vai o que o render.mjs recebe (--shutter, --subframes, --grain); não passar --from, --to nem --audio.
#
# Os trechos ficam em <saida sem extensão>-partes/ e são apagados quando o filme sai inteiro.
# Um formato de cada vez: dois renders juntos derrubam o Chrome. Para interromper, matar a árvore
# de processos (taskkill /PID <bash> /T /F): parar só a tarefa deixa node, ffmpeg e Chrome vivos.
# Saída: 0 ok; 1 um trecho não saiu depois de 4 tentativas; 2 uso errado.
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
uso() { sed -n '4,22p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }
[ $# -ge 1 ] && { [ "$1" = "--help" ] || [ "$1" = "-h" ]; } && uso 0
[ $# -lt 2 ] && uso 2
HTML="$1"; SAIDA="$2"; shift 2
DUR=""; PARTE=5; FPS=30; AUDIO=""; EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dur) DUR="$2"; shift 2;;
    --parte) PARTE="$2"; shift 2;;
    --fps) FPS="$2"; shift 2;;
    --audio) AUDIO="$2"; shift 2;;
    --) shift; EXTRA=("$@"); break;;
    *) echo "erro: opção desconhecida $1" >&2; uso 2;;
  esac
done
[ -f "$HTML" ] || { echo "erro: não achei $HTML" >&2; exit 2; }
[ -n "$DUR" ] || { echo "erro: faltou --dur <segundos>" >&2; exit 2; }
[ -z "$AUDIO" ] || [ -f "$AUDIO" ] || { echo "erro: não achei o áudio $AUDIO" >&2; exit 2; }
for x in "${EXTRA[@]:-}"; do case "$x" in --from|--to|--audio|--still) echo "erro: $x não vai aqui (o script divide o filme sozinho)" >&2; exit 2;; esac; done

PASTA="${SAIDA%.*}-partes"; mkdir -p "$PASTA"
quadros() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$1" 2>/dev/null | tr -cd '0-9'; }
# cortes em múltiplos de --parte, sempre em quadro inteiro
mapfile -t CORTES < <(awk -v d="$DUR" -v p="$PARTE" -v f="$FPS" 'BEGIN { n = int(d * f + 0.5); k = int(p * f + 0.5); for (q = 0; q < n; q += k) printf "%d\n", q; printf "%d\n", n }')
N=$(( ${#CORTES[@]} - 1 ))
echo "$(date +%H:%M:%S) $HTML -> $SAIDA: ${CORTES[$N]} quadros em $N trechos"
: > "$PASTA/lista.txt"
for (( i = 0; i < N; i++ )); do
  qa=${CORTES[$i]}; qb=${CORTES[$((i+1))]}; esperado=$(( qb - qa )); out="$PASTA/p-$(printf %02d "$i").mp4"
  de=$(awk -v q="$qa" -v f="$FPS" 'BEGIN { printf "%.6f", q / f }'); ate=$(awk -v q="$qb" -v f="$FPS" 'BEGIN { printf "%.6f", q / f }')
  for tentativa in 1 2 3 4; do
    n=$(quadros "$out")
    if [ "${n:-0}" = "$esperado" ]; then echo "$(date +%H:%M:%S) trecho $((i+1))/$N ok ($n quadros)"; break; fi
    [ "$tentativa" -gt 1 ] && echo "$(date +%H:%M:%S) trecho $((i+1))/$N falhou (quadros: ${n:-0}, esperado $esperado), tentando de novo"
    rm -f "$out"
    node "$AQUI/render.mjs" "$HTML" "$out" --fps "$FPS" --from "$de" --to "$ate" ${EXTRA[@]+"${EXTRA[@]}"} > "$PASTA/p-$(printf %02d "$i").log" 2>&1
  done
  n=$(quadros "$out")
  [ "${n:-0}" = "$esperado" ] || { echo "$(date +%H:%M:%S) ERRO: o trecho $((i+1))/$N não saiu (quadros: ${n:-0}, esperado $esperado). Veja $PASTA/p-$(printf %02d "$i").log" >&2; exit 1; }
  echo "file 'p-$(printf %02d "$i").mp4'" >> "$PASTA/lista.txt"
done
if [ -n "$AUDIO" ]; then
  # apad: o som completa com silêncio até o fim da imagem. Sem ele, um mix uma fração de quadro mais curto que o
  # vídeo (124,95 s contra 3749 quadros = 124,967 s) fazia o -shortest cortar os 2 últimos quadros (14/10/2026).
  ffmpeg -v error -y -f concat -safe 0 -i "$PASTA/lista.txt" -i "$AUDIO" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -af apad -shortest -movflags +faststart "$SAIDA" || exit 1
else
  ffmpeg -v error -y -f concat -safe 0 -i "$PASTA/lista.txt" -c copy -movflags +faststart "$SAIDA" || exit 1
fi
total=$(quadros "$SAIDA")
[ "${total:-0}" = "${CORTES[$N]}" ] || { echo "$(date +%H:%M:%S) ERRO: o filme juntado tem ${total:-0} quadros, esperado ${CORTES[$N]}" >&2; exit 1; }
# as marcas (window.__events) de todos os trechos, sem repetição, ao lado do filme: é o arquivo que o look.py e o ouvir.py leem
node -e '
const fs = require("fs"), path = require("path"), [pasta, saida] = process.argv.slice(1), visto = new Set(), todos = [];
for (const a of fs.readdirSync(pasta).filter((x) => /^p-\d+\.mp4\.events\.json$/.test(x)).sort()) {
  let e = JSON.parse(fs.readFileSync(path.join(pasta, a), "utf8")); e = Array.isArray(e) ? e : (e.events || []);
  for (const x of e) { const k = JSON.stringify(x); if (!visto.has(k)) { visto.add(k); todos.push(x); } }
}
if (todos.length) fs.writeFileSync(saida, JSON.stringify(todos.sort((a, b) => (a.t || 0) - (b.t || 0)), null, 1));
' "$PASTA" "$SAIDA.events.json"
rm -rf "$PASTA"
echo "$(date +%H:%M:%S) pronto: $SAIDA, $total quadros$([ -n "$AUDIO" ] && echo ', com som')"
