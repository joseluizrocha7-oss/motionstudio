# Kit de tutorial de app (motionstudio)

Pasta de um filme de tutorial: o que copiar, a ordem dos comandos e onde mexer. Criar com:

```bash
node ~/.claude/skills/motionstudio/kit/novo-projeto.mjs conteudo/<tema>-<data>
```

## A ordem

```bash
P=conteudo/<tema>-<data>; SKILL=~/.claude/skills/motionstudio
# 1. Roteiro: editar $P/roteiro.json (blocos, linhas, texto/fala, pausas).
# 2. Telas do app: script de captura do projeto (modelo: capturar.mjs do caso de referência),
#    gravando $P/film/telas/*.png e medidas.js. Símbolo da marca em $P/film/assets/simbolo.png.
#    Cada foto grava `barra`, o retângulo da barra de navegação do app quando ela está à vista e por
#    cima de tudo (conferir com document.elementFromPoint; janela por cima dela ou barra escondida:
#    sem `barra`). O alvo() leva esse limite e o anel() corta o contorno no topo da barra. Alvo de
#    bloco que continua atrás da barra: medir só a parte à vista (até o último elemento visível).
# 3. Voz (gasta o saldo do Gemini; a chave vem do .env indicado):
cd $P/vozes && node --env-file=<.env com GEMINI_API_KEY> gerar-tomadas.mjs --tomadas 6 && node montar.mjs && cd -
# 4. Tempos da voz para o filme e os filmes:
node $P/film/gerar-fala.mjs && node $P/film/montar-filmes.mjs
# 5. Conferências antes do render:
node $P/autoteste.mjs $P/film/index-vertical.html
node $P/tela-vazia.mjs $P/film/index-vertical.html
node $SKILL/scripts/camera.mjs $P/film/index-vertical.html --el "#celular"
node $SKILL/scripts/render.mjs $P/film/index-vertical.html --still 2,40,93 $P/film/stills
# 6. Som (a lista de eventos sai do --still acima). A música: Lyria 3 Pro, o pedido aprovado em 28/10/2026.
node --env-file=<.env com GEMINI_API_KEY> $P/gerar-trilha.mjs tech
node $P/gerar-som.mjs $P/film/stills/events.json --total <duração do montar-filmes> --musica assets/musica/tech.mp3
# 7. Render e portões (um formato de cada vez):
bash $SKILL/scripts/render_partes.sh $P/film/index-vertical.html $P/film/final-9x16.mp4 --dur <s> --audio $P/film/audio/mix.wav -- --shutter 180 --subframes 8
py -3 $SKILL/scripts/look.py $P/film/final-9x16.mp4 --out $P/film/look-9x16 --expect <s> --expect-audio
py -3 $SKILL/scripts/ouvir.py $P/film/final-9x16.mp4 --roteiro $P/film/audio/vo.txt --eventos $P/film/final-9x16.mp4.events.json --sfx $P/film/audio/sfx-eventos.json --motor whisper --modelo medium
node $SKILL/scripts/ler.mjs $P/film/index-vertical.html $P/film/final-9x16.mp4
# 8. Legenda, em toda entrega. O legendar.mjs tira o formato do tamanho do vídeo (retrato = 9x16): gere o .srt com o --formato do vídeo.
#    O padrão é sem caixa (contorno preto e sombra suave). Para filmagem de câmera ou fundo cheio de detalhe: --estilo caixa.
cd $P && node gerar-legenda.mjs --formato 9x16 && cd -        # film/legenda-9x16.srt: texto do roteiro, tempo da fala
node $SKILL/scripts/legendar.mjs $P/film/final-9x16.mp4 $P/film/legenda-9x16.srt $P/film/final-9x16-legendado.mp4   # 2º arquivo, para quem assiste sem som
```

## Onde mexer

| quero mudar | arquivo |
|---|---|
| o que a voz fala | `roteiro.json`; depois voz, tempos, filmes e render |
| forçar uma tomada numa frase | `node vozes/montar.mjs --forcar <bloco>:<frase>=<tomada>` |
| pausas e respiração (versão curta) | `pausas`, `respiracao`, `cauda` no roteiro |
| o que acontece na tela e quando | `film/fonte/<linha>.js` (exemplo: `longo.js`) |
| nome, endereço do app no Safari, versões, temas, formatos, folga do fim | o topo de `film/montar-filmes.mjs` |
| estilo, câmera, toque, contorno, marca do fim | `film/fonte/base.html` (no 9:16: `K` e `CEL`) |
| o que muda de tamanho no 9:16 | `CSS_VERTICAL` em `film/montar-filmes.mjs` |
| a música | `gerar-trilha.mjs` (pedido e modelo) e `--musica` no `gerar-som.mjs` |
| volume da música e dos efeitos | `gerar-som.mjs --abaixo 20` (a música 20 dB sob a voz, que fica em -16 LUFS) |
| o texto da legenda | `texto` no `roteiro.json` (a legenda mostra o `texto`, nunca a `fala`); depois `gerar-legenda.mjs` e `legendar.mjs` |
| o tamanho da linha da legenda | `LIMITES` no `gerar-legenda.mjs` do projeto (16x9 = 42 caracteres por linha, 9x16 = 32) e o mesmo valor no `kit/gerar-legenda.mjs` da skill, porque o `legendar.mjs` recusa linha maior que o `LIMITES` da skill; depois gerar o `.srt` de novo |
| a fonte, a margem de baixo e a espessura do contorno da legenda no MP4 | `FORMATOS_ASS` no `kit/gerar-legenda.mjs` da skill, não na cópia do projeto: o `legendar.mjs` lê o da skill, e a mudança vale para todos os projetos |
| o estilo da legenda no MP4: com ou sem caixa | `legendar.mjs --estilo contorno` (padrão, sem caixa: tutorial de tela, comercial, promo, vinheta) ou `--estilo caixa` (filmagem de câmera, fundo com muito detalhe, quadro em que o contorno não separa a letra) |
| a cor do contorno ou da caixa e a posição da legenda no MP4 | `legendar.mjs --cor-contorno #RRGGBB` (só com contorno), `--cor-caixa #RRGGBB` (só com caixa), `--margem-esq N --margem-dir N` (app que ocupa só parte do quadro) |
| o estilo da voz | `estilo` no `roteiro.json` (o dinâmico é o padrão desde 28/10/2026) |
| toque e sopro gravados no lugar dos sintetizados (em teste) | `gerar-som.mjs --toque pop-hand --ar fast-whoosh`; ver `efeitos-gravados/LEIA-ME.md` |
| um texto que não precisa ser lido no T1 (ilustrativo) | `data-ler="ignorar"` no elemento; dizer no NOTE.md |

## O que cada peça faz

- `vozes/tts.mjs`: um pedido ao Gemini TTS 3.8 Flash (Interactions API, `gemini-3.8-flash-tts`).
- `vozes/gerar-tomadas.mjs`: N tomadas por bloco, alinha pelo Whisper (`alinhar.py`) e mede a entonação.
- `vozes/montar.mjs`: escolhe frase a frase (termina no ar, monótona, corrida, vírgula sem pausa, palavra não reconhecida), corta guardando a respiração, nivela em -20 LUFS e emenda com as pausas do roteiro.
- `film/gerar-fala.mjs`: `assets/fala.js` (frases e palavras em segundos do filme) e a duração sugerida.
- `film/fonte/base.html`: `pal()`, `mostra()`, `anel()`, `toque()`, `gesto()`, `peca()`, `cam()`, `passo()`, `marcaFinal()`; 9:16 e 16:9 pela mesma fonte.
- `film/fonte/iphone.js`: Safari, folha de Compartilhar, "Adicionar à Tela de Início" e Tela de Início desenhados (ilustrativo; dizer no NOTE.md).
- `gerar-trilha.mjs`: a música de fundo pela Lyria (API do Gemini), em `film/assets/musica/`.
- `gerar-som.mjs` e `trilha.mjs`: efeitos sintetizados, a música (`--musica`, repetida com transição) ou a trilha de código, mixagem com a voz, tudo descendo nos últimos 1,6 s.
- `efeitos-gravados/`: 3 sons em domínio público (CC0) para o A/B do toque e do sopro; origem e licença no LEIA-ME de lá.
- `gerar-legenda.mjs`: `film/legenda-<formato>.srt` (`legenda-16x9.srt` ou `legenda-9x16.srt`) com o texto do roteiro (quebrado em 1 ou 2 linhas) e o tempo da fala; o `scripts/legendar.mjs` grava esse `.srt` no MP4 com o ffmpeg, sem renderizar de novo. A legenda sai sem caixa (letra branca com contorno e sombra); `--estilo caixa` põe a faixa de volta.
- `autoteste.mjs` e `tela-vazia.mjs`: as duas conferências que o `look.py` não faz.
