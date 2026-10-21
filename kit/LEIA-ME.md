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
# 6. Som (a lista de eventos sai do --still acima):
node $P/gerar-som.mjs $P/film/stills/events.json --total <duração do montar-filmes>
# 7. Render e portões (um formato de cada vez):
bash $SKILL/scripts/render_partes.sh $P/film/index-vertical.html $P/film/final-9x16.mp4 --dur <s> --audio $P/film/audio/mix.wav -- --shutter 180 --subframes 8
py -3 $SKILL/scripts/look.py $P/film/final-9x16.mp4 --out $P/film/look-9x16 --expect <s> --expect-audio
py -3 $SKILL/scripts/ouvir.py $P/film/final-9x16.mp4 --roteiro $P/film/audio/vo.txt --eventos $P/film/final-9x16.mp4.events.json --sfx $P/film/audio/sfx-eventos.json --motor whisper --modelo medium
node $SKILL/scripts/ler.mjs $P/film/index-vertical.html $P/film/final-9x16.mp4
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
| volume da trilha e dos efeitos | `gerar-som.mjs` (trilha -31,5 LUFS, voz -16) |
| toque e sopro gravados no lugar dos sintetizados (em teste) | `gerar-som.mjs --toque pop-hand --ar fast-whoosh`; ver `efeitos-gravados/LEIA-ME.md` |
| um texto que não precisa ser lido no T1 (ilustrativo) | `data-ler="ignorar"` no elemento; dizer no NOTE.md |

## O que cada peça faz

- `vozes/tts.mjs`: um pedido ao Gemini TTS 3.8 Flash (Interactions API, `gemini-3.8-flash-tts`).
- `vozes/gerar-tomadas.mjs`: N tomadas por bloco, alinha pelo Whisper (`alinhar.py`) e mede a entonação.
- `vozes/montar.mjs`: escolhe frase a frase (termina no ar, monótona, corrida, vírgula sem pausa, palavra não reconhecida), corta guardando a respiração, nivela em -20 LUFS e emenda com as pausas do roteiro.
- `film/gerar-fala.mjs`: `assets/fala.js` (frases e palavras em segundos do filme) e a duração sugerida.
- `film/fonte/base.html`: `pal()`, `mostra()`, `anel()`, `toque()`, `gesto()`, `peca()`, `cam()`, `passo()`, `marcaFinal()`; 9:16 e 16:9 pela mesma fonte.
- `film/fonte/iphone.js`: Safari, folha de Compartilhar, "Adicionar à Tela de Início" e Tela de Início desenhados (ilustrativo; dizer no NOTE.md).
- `gerar-som.mjs` e `trilha.mjs`: trilha e efeitos sintetizados, mixagem com a voz, trilha descendo nos últimos 1,6 s.
- `efeitos-gravados/`: 3 sons em domínio público (CC0) para o A/B do toque e do sopro; origem e licença no LEIA-ME de lá.
- `autoteste.mjs` e `tela-vazia.mjs`: as duas conferências que o `look.py` não faz.
