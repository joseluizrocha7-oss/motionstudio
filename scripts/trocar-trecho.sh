#!/usr/bin/env bash
# trocar-trecho.sh: troca trechos de um filme já renderizado por trechos renderizados de
# novo (correção de um momento, fim novo), sem renderizar o filme inteiro.
#
# Por que existe (16/10/2026, tutorial do caso de referência): emendar sem recodificar (concat do
# ffmpeg com inpoint/outpoint nos quadros-chave) duplicou 2 quadros em cada emenda e perdeu
# outros no fim (6.914 e 6.910 quadros onde deviam ser 6.912). Este script renderiza cada
# trecho com render.mjs, junta DECODIFICANDO (trim por número de quadro + concat) e
# recodifica uma vez (x264 crf 14, praticamente sem perda), conferindo a contagem.
#
# Uso (Git Bash):
#   bash trocar-trecho.sh <filme.html> <entrada.mp4> <saida.mp4> --dur <s> [--audio mix.wav] \
#        [--fps 30] TRECHO [TRECHO...] [-- <opções do render.mjs, ex.: --shutter 180 --subframes 8>]
#   TRECHO = de:ate em segundos; "fim" vale a duração (ex.: 105:110 145:155 215:fim)
#
# A entrada pode ser mais curta que --dur (fim novo mais longo): o último trecho cobre até o fim.
# Sem --audio, o som da entrada é copiado (só serve se a voz não mudou).
set -eu
AQUI="$(cd "$(dirname "$0")" && pwd)"
[ $# -lt 3 ] && { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
HTML="$1"; ENTRADA="$2"; SAIDA="$3"; shift 3
DUR=""; FPS=30; AUDIO=""; TRECHOS=(); EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dur) DUR="$2"; shift 2;;
    --fps) FPS="$2"; shift 2;;
    --audio) AUDIO="$2"; shift 2;;
    --) shift; EXTRA=("$@"); break;;
    *:*) TRECHOS+=("$1"); shift;;
    *) echo "opção desconhecida: $1" >&2; exit 2;;
  esac
done
[ -n "$DUR" ] && [ ${#TRECHOS[@]} -gt 0 ] || { echo "faltam --dur e pelo menos um trecho" >&2; exit 2; }
quadros() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$1"; }
q() { node -e "console.log(Math.round(($1)*$FPS))"; }
PASTA="$(dirname "$SAIDA")/$(basename "${SAIDA%.*}")-trechos"; mkdir -p "$PASTA"
TOTAL=$(q "$DUR")
# Renderiza cada trecho e monta a lista de pedaços em quadros: entrada[a,b) e trecho k.
ENTRADAS=(-i "$ENTRADA"); FILTRO=""; ROTULOS=""; n=0; cursor=0; idx=1
for t in "${TRECHOS[@]}"; do
  de="${t%%:*}"; ate="${t##*:}"; [ "$ate" = "fim" ] && ate="$DUR"
  qa=$(q "$de"); qb=$(q "$ate")
  arq="$PASTA/trecho-$de-$ate.mp4"
  if [ ! -f "$arq" ] || [ "$(quadros "$arq")" != "$((qb - qa))" ]; then
    node "$AQUI/render.mjs" "$HTML" "$arq" --fps "$FPS" --from "$de" --to "$ate" "${EXTRA[@]}" > /dev/null
  fi
  nq=$(quadros "$arq"); [ "$nq" = "$((qb - qa))" ] || { echo "trecho $t saiu com $nq quadros, esperado $((qb - qa))" >&2; exit 1; }
  if [ "$qa" -gt "$cursor" ]; then
    FILTRO+="[0:v]trim=start_frame=$cursor:end_frame=$qa,setpts=PTS-STARTPTS[p$n];"; ROTULOS+="[p$n]"; n=$((n+1))
  fi
  ENTRADAS+=(-i "$arq")
  FILTRO+="[$idx:v]setpts=PTS-STARTPTS[p$n];"; ROTULOS+="[p$n]"; n=$((n+1)); idx=$((idx+1))
  cursor=$qb
  echo "trecho $de-$ate s: $nq quadros"
done
if [ "$cursor" -lt "$TOTAL" ]; then
  FILTRO+="[0:v]trim=start_frame=$cursor:end_frame=$TOTAL,setpts=PTS-STARTPTS[p$n];"; ROTULOS+="[p$n]"; n=$((n+1))
fi
FILTRO+="${ROTULOS}concat=n=$n:v=1:a=0[v]"
if [ -n "$AUDIO" ]; then ENTRADAS+=(-i "$AUDIO"); MAPA_A="$idx:a"; else MAPA_A="0:a"; fi
ffmpeg -hide_banner -loglevel error -y "${ENTRADAS[@]}" -filter_complex "$FILTRO" -map "[v]" -map "$MAPA_A" \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -r "$FPS" \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$SAIDA"
nf=$(quadros "$SAIDA")
echo "$SAIDA: $nf quadros (esperado $TOTAL)"
[ "$nf" = "$TOTAL" ] || { echo "contagem errada: conferir antes de entregar" >&2; exit 1; }
echo "trechos guardados em $PASTA (apagar depois de conferir)"
