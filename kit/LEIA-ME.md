# Kit de tutorial de app (motionstudio)

Pasta de um filme de tutorial: o que copiar, a ordem dos comandos e onde mexer. Criar com:

```bash
node ~/.claude/skills/motionstudio/kit/novo-projeto.mjs conteudo/<tema>-<data>
```

## A ordem

```bash
P=conteudo/<tema>-<data>; SKILL=~/.claude/skills/motionstudio
# 0. Caixa de ferramentas. Rode na pasta que tem o .env (a raiz do repositório do cliente): gemini.key tem que ser true.
#    A chave vem do .env do repositório do cliente. Não aponte --env-file para o .env de outro projeto: o modo automático bloqueia.
bash $SKILL/scripts/providers.sh
# 1. Roteiro: editar $P/roteiro.json (blocos, linhas, texto/fala, pausas). Marca que se diz diferente da grafia leva fala fonética,
#    confirmada pelo Jose antes de gerar tomada.
# 2. Telas do app: script de captura do projeto (modelo: capturar.mjs do caso de referência),
#    gravando $P/film/telas/*.png e medidas.js. Símbolo da marca em $P/film/assets/simbolo.png.
#    Cada foto grava `barra`, o retângulo da barra de navegação do app quando ela está à vista e por
#    cima de tudo (conferir com document.elementFromPoint; janela por cima dela ou barra escondida:
#    sem `barra`). O alvo() leva esse limite e o anel() corta o contorno no topo da barra. Alvo de
#    bloco que continua atrás da barra: medir só a parte à vista (até o último elemento visível).
# 3. Voz (gasta o saldo do Gemini; a chave vem do .env do repositório do cliente):
cd $P/vozes && node --env-file=<.env com GEMINI_API_KEY> gerar-tomadas.mjs --tomadas 6 && node montar.mjs && cd -
# 4. Tempos da voz para o filme e os filmes:
node $P/film/gerar-fala.mjs && node $P/film/montar-filmes.mjs
# 4b. Filme de cenas com tempo fixo (comercial, promo): no lugar do gerar-fala.mjs, ponha cada linha no segundo da cena.
#    $P/tempos.json = { "<id da linha>": segundo, ... }; ponha `dur: <s>` na linha do filme em FILMES (montar-filmes.mjs).
#    node $P/film/posicionar-voz.mjs --duracao <s> && node $P/film/montar-filmes.mjs   # voz em film/audio-filme/, fala.js com offset 0
# 5. Conferências antes do render. O erros.mjs vem primeiro: com exceção na página, o autoteste espera 10 minutos.
node $SKILL/scripts/erros.mjs $P/film/index-vertical.html
node $P/autoteste.mjs $P/film/index-vertical.html
node $P/tela-vazia.mjs $P/film/index-vertical.html
node $SKILL/scripts/camera.mjs $P/film/index-vertical.html --el "#celular"   # só com aparelho filmado: sem ele, Z1 e Z2 não se aplicam
node $SKILL/scripts/render.mjs $P/film/index-vertical.html --still 2,40,93 $P/film/stills --limpar   # --limpar apaga os still_*.png antigos
# 6. Som (a lista de eventos sai do --still acima). A música: Lyria 3 Pro, o pedido aprovado em 28/10/2026.
node --env-file=<.env com GEMINI_API_KEY> $P/gerar-trilha.mjs tech
node $P/gerar-som.mjs $P/film/stills/events.json --total <duração do montar-filmes> --musica assets/musica/tech.mp3   # voz posicionada (4b): acrescente --audio audio-filme
#    Comercial, promo, vinheta: efeitos presos a eventos rotulados (M.mark) e afinados no tom da música. Troque a linha acima por:
#    node $P/gerar-som.mjs $P/film/stills/events.json --comercial $P/sons.json --total <s> --musica assets/musica/tech.mp3   # formato do sons.json abaixo
#    Ver com som antes do render: abrir $P/film/index-vertical.html?previa no Chrome (toca audio/mix.wav no mesmo relógio; voz posicionada: ?previa&audio=audio-filme/mix.wav).
# 7. Render e portões (um formato de cada vez). Outro render vivo ou pouca memória: o render-trechos.mjs (SKILL.md, passo 8) avisa e sai
#    com código 3 e o comando do render_partes.sh abaixo.
bash $SKILL/scripts/render_partes.sh $P/film/index-vertical.html $P/film/final-9x16.mp4 --dur <s> --audio $P/film/audio/mix.wav -- --shutter 180 --subframes 8
py -3 $SKILL/scripts/look.py $P/film/final-9x16.mp4 --out $P/film/look-9x16 --expect <s> --expect-audio
#    ouvir.py: com --roteiro $P/roteiro.json no lugar do vo.txt, a linha com fala diferente do texto casa número por extenso, sigla soletrada e o texto da tela.
py -3 $SKILL/scripts/ouvir.py $P/film/final-9x16.mp4 --roteiro $P/film/audio/vo.txt --eventos $P/film/final-9x16.mp4.events.json --sfx $P/film/audio/sfx-eventos.json --motor whisper --modelo medium
node $SKILL/scripts/ler.mjs $P/film/index-vertical.html $P/film/final-9x16.mp4
# 8. Legenda, em toda entrega. O legendar.mjs tira o formato do tamanho do vídeo (retrato = 9x16): gere o .srt com o --formato do vídeo.
#    O padrão é sem caixa (contorno preto e sombra suave). Para filmagem de câmera ou fundo cheio de detalhe: --estilo caixa.
#    No 9x16 de Reels, acrescente --margem-baixo 420 ao legendar.mjs (o padrão deixa 260 px embaixo, fora da área segura).
#    Legenda que o filme desenha: gerar-legenda.mjs --formato 9x16 --saida film/assets/legenda.js (grava window.LEGENDA no lugar do .srt).
cd $P && node gerar-legenda.mjs --formato 9x16 && cd -        # film/legenda-9x16.srt: texto do roteiro, tempo da fala
node $SKILL/scripts/legendar.mjs $P/film/final-9x16.mp4 $P/film/legenda-9x16.srt $P/film/final-9x16-legendado.mp4   # 2º arquivo, para quem assiste sem som
```

## Onde mexer

| quero mudar | arquivo |
|---|---|
| o que a voz fala | `roteiro.json`; depois voz, tempos, filmes e render |
| a pronúncia de uma marca | `fala` fonética na linha do `roteiro.json` (`texto` "Quíron", `fala` "Kíron"); o Jose confirma a grafia antes de gerar tomada; depois, transcrever as tomadas sem o roteiro e ler como a marca saiu |
| o segundo em que cada linha fala (filme de tempo fixo) | `tempos.json` ao lado do `roteiro.json` (o `id` da linha e o segundo em que ela começa; `{ "inicio": s, "fim": s }` acrescenta o fim da cena); depois `node film/posicionar-voz.mjs --duracao <s>`, `dur: <s>` na linha do filme em `FILMES` e `--audio audio-filme --total <s>` no `gerar-som.mjs` |
| os efeitos do comercial (rótulo para efeito) | `sons.json` e `gerar-som.mjs --comercial sons.json --total <s>` (formato em "O mapa dos efeitos", abaixo); marcar o momento no filme com `M.mark(F.abertura, 'som', 'abertura')` |
| o tom ou o andamento da música no comercial | `gerar-som.mjs --comercial ... --tom A --modo menor` (troca o tom medido); `py -3 $SKILL/scripts/medir-musica.py <faixa> [--inicio s] [--dur s] [--bpm-min N --bpm-max N]` mede à parte |
| a música sumir por um instante | `gerar-som.mjs --comercial ... --pausa <s> --pausa-dur 0.2` (ou `pausa` no mapa); a música some antes do instante e volta nele |
| o que o ouvir.py compara com a fala | `py -3 $SKILL/scripts/ouvir.py ... --roteiro $P/roteiro.json` (aceita o `texto` da tela e casa número por extenso e sigla soletrada com a transcrição); o limite do que casa está em `vozes/normalizar.py` |
| o limite do ganho fino de volume entre trechos de fala | `node vozes/montar.mjs --fino N` (padrão 4 dB; 0 desliga); a saída mostra o RMS falado e o ganho de cada trecho |
| forçar uma tomada numa frase | `node vozes/montar.mjs --forcar <bloco>:<frase>=<tomada>` |
| pausas e respiração (versão curta) | `pausas`, `respiracao`, `cauda` no roteiro |
| o que acontece na tela e quando | `film/fonte/<linha>.js` (exemplo: `longo.js`) |
| nome, endereço do app no Safari, versões, temas, formatos, folga do fim | o topo de `film/montar-filmes.mjs` |
| estilo, câmera, toque, contorno, marca do fim | `film/fonte/base.html` (no 9:16: `K` e `CEL`) |
| o que muda de tamanho no 9:16 | `CSS_VERTICAL` em `film/montar-filmes.mjs` |
| a música | `gerar-trilha.mjs` (pedido e modelo) e `--musica` no `gerar-som.mjs` |
| volume da música e dos efeitos | `gerar-som.mjs --abaixo 20` (a música 20 dB sob a voz, que fica em -16 LUFS) |
| o texto da legenda | `texto` no `roteiro.json` (a legenda mostra o `texto`, nunca a `fala`); depois `gerar-legenda.mjs` e `legendar.mjs` |
| o tamanho da linha da legenda | `LIMITES` no `gerar-legenda.mjs` do projeto (16x9 = 42 caracteres por linha, 9x16 = 28) e o mesmo valor no `kit/gerar-legenda.mjs` da skill, porque o `legendar.mjs` recusa linha maior que o `LIMITES` da skill; depois gerar o `.srt` de novo. Projeto criado antes de 28/10/2026 tem 9x16 = 32 e `maxPedaco` 56: troque para 28 e 48 |
| a fonte, a margem de baixo padrão, a espessura do contorno e o espaço entre as letras da legenda no MP4 | `FORMATOS_ASS` no `kit/gerar-legenda.mjs` da skill, não na cópia do projeto: o `legendar.mjs` lê o da skill, e a mudança vale para todos os projetos. A margem de baixo de um MP4 só: `legendar.mjs --margem-baixo N` |
| a legenda dentro da área segura do Reels (9:16) | `legendar.mjs --margem-baixo 420` (pixels inteiros da grade 1080x1920; o pé da legenda sobe para y 1500; padrão 260 no 9x16 e 30 no 16x9). Recusa a margem em que o maior bloco do `.srt` não cabe. No 9x16 com contorno, o máximo é 1863 com 1 linha, 1809 com 2 e 1755 com 3. Com `--estilo caixa`, some 14 à margem |
| a legenda desenhada pelo filme, no lugar da gravada no MP4 | `node gerar-legenda.mjs --formato 9x16 --saida film/assets/legenda.js` (a extensão `.js` liga o modo; grava `window.LEGENDA = [{a, b, texto}]`); um arquivo por formato; o filme mostra cada bloco com `M.show` (exemplo no SKILL.md, passo 10) |
| o estilo da legenda no MP4: com ou sem caixa | `legendar.mjs --estilo contorno` (padrão, sem caixa: tutorial de tela, comercial, promo, vinheta) ou `--estilo caixa` (filmagem de câmera, fundo com muito detalhe, quadro em que o contorno não separa a letra) |
| a cor da letra, do contorno ou da caixa e a posição da legenda no MP4 | `legendar.mjs --cor-texto "#RRGGBB"` (a letra; em filme claro, escura com `--cor-contorno "#FFFFFF"`), `--cor-contorno "#RRGGBB"` (só com contorno), `--cor-caixa "#RRGGBB"` (só com caixa), `--margem-esq N --margem-dir N` (app que ocupa só parte do quadro); ponha a cor entre aspas, porque no Git Bash o `#` sem aspas abre um comentário |
| o estilo da voz | `estilo` no `roteiro.json` (o dinâmico é o padrão desde 28/10/2026) |
| toque e sopro gravados no lugar dos sintetizados (em teste) | `gerar-som.mjs --toque pop-hand --ar fast-whoosh`; ver `efeitos-gravados/LEIA-ME.md` |
| um texto que não precisa ser lido no T1 (ilustrativo) | `data-ler="ignorar"` no elemento; dizer no NOTE.md |
| um desenho que nenhuma chamada `M.*` cobre (arco SVG, gráfico, canvas 2D) | `M.render((t, quadro) => ...)` em `film/fonte/<linha>.js`; a função redesenha do zero a cada seek e não guarda estado; `{ heavy: true }` só para canvas caro; exemplo em `examples/relogio/index.html` |
| ver o filme com som antes do render | abrir `film/index-<versão>.html?previa` no Chrome (quadro reduzido, controles e `audio/mix.wav` no mesmo relógio); outro som: `?previa&audio=audio-filme/mix.wav` ou `preview: { audio }` no `Motion.film`; o render nunca abre esse modo |
| um projeto criado antes de 29/10/2026 | copiar da skill: `kit/vozes/montar.mjs` para `vozes/` (ganho fino), `kit/vozes/alinhar.py` e `kit/vozes/normalizar.py` para `vozes/` (sigla e número com o tempo do Whisper), `kit/som-comercial.mjs` e `kit/trilha.mjs` para a pasta do projeto (`--comercial`), `kit/film/posicionar-voz.mjs` para `film/`, `kit/gerar-legenda.mjs` para a pasta do projeto (modo `.js`; refaça nele a mudança de `LIMITES`, se houver) e `runtime/motion.js` para `film/runtime/` (`M.render` e `?previa`); o `novo-projeto.mjs` não sobrescreve nada |
| um ícone animado numa peça (no máximo 1 por peça; entra 5 quadros depois da peça que a voz nomeia) | 1. copiar `_cor.js` e o ícone de `$SKILL/library/lottie/` para `film/assets/`; 2. carregar os dois no `film/fonte/base.html`; 3. rodar `node $P/film/montar-filmes.mjs` de novo; 4. pôr o `M.lottie` em `film/fonte/<linha>.js` (exemplo no SKILL.md, passo 5). Projeto criado antes do `M.lottie`: copiar `runtime/motion.js` e `runtime/vendor/dotlottie-web/` da skill para o `film/runtime/` do projeto (o `novo-projeto.mjs` não sobrescreve nada) |

## O mapa dos efeitos (modo comercial do `gerar-som.mjs`)

O `sons.json` fica na pasta do projeto, em UTF-8. Campo que começa com `_` é comentário. Campo desconhecido é erro.

```json
{
  "efeitos": [
    { "rotulo": "^abertura$", "efeito": "impacto" },
    { "tipo": "enter", "rotulo": "^#destaque", "efeito": "pinca", "graus": [5], "subir": 2, "ganho": -3 },
    { "rotulo": "^numero ", "efeito": "sino", "graus": [8], "subir": 1 },
    { "rotulo": "^selo$", "efeito": "assinatura", "desvio": 0.05 }
  ],
  "pausa": { "rotulo": "^virada$", "dur": 0.2 }
}
```

| campo | o que faz |
|---|---|
| `rotulo` | expressão regular comparada com o rótulo do evento (3º argumento do `M.mark`), sem acento e sem diferença de maiúscula; evento sem rótulo usa o tipo |
| `tipo` | tipo do evento, exato (`enter`, `press`, o 2º argumento do `M.mark`); a regra precisa de `rotulo`, de `tipo` ou dos dois |
| `efeito` | tonais: `sino`, `pinca`, `sustenta`, `impacto`, `assinatura`; do kit: `pop`, `ar`, `cortina`; gravados: `pop-hand`, `mouse-click-2`, `fast-whoosh` |
| `ganho`, `desvio` | dB sobre o volume padrão do efeito (padrão 0); segundos somados ao instante do evento (padrão 0) |
| `graus`, `oitava`, `subir`, `arpejo`, `dur` | só nos tonais: graus da escala do tom (1 tônica, 3 terça, 5 quinta, 8 tônica acima; menor natural em tom menor), registro (5 = a tônica mais perto do Ré 5), passos que os graus sobem a cada evento seguinte da regra, segundos entre as notas e duração de cada nota. A nota que soa fica entre 20 Hz e 12 kHz; fora disso o mapa dá erro com a regra |
| `pausa` | a música some nos `dur` s (padrão 0,2) antes do instante e volta nele; o instante vem de `t` (s) ou do 1º evento de `rotulo`/`tipo`; `--pausa` e `--pausa-dur` valem mais que o mapa |

Regras do casamento:

- Toda regra que casa com um evento põe um efeito nele. Duas regras no mesmo evento somam dois efeitos.
- Eventos com o mesmo rótulo no mesmo quadro contam como um só: o `M.words` grava `enter` e `word` para cada palavra, e vale o `enter`. O `subir` anda um passo por palavra.
- Saem como aviso no log: regra sem evento, efeito fora do filme, tom incerto e mais de 12 efeitos a cada 10 s (o limite do S4).

Opções do `gerar-som.mjs --comercial <mapa>`:

| opção | padrão |
|---|---|
| `--total <s>` | obrigatória; a duração do filme (0,1 a 3600) |
| `--musica <arquivo>` e `--musica-inicio <s>` | sem música, usa a trilha de código (Ré maior); a faixa repete com transição de 4 s |
| `--abaixo <dB>` | 20 (a música 20 dB sob a voz; 0 a 60). Em vinheta sem voz, use menos |
| `--tom <nota> --modo maior\|menor` | o tom medido na música; aceita C, C#, Db, Dó, Ré sustenido, Si bemol |
| `--pausa <s>` e `--pausa-dur <s>` | a do mapa; `--pausa-dur` vai até 2 s |
| `--voz <arquivo>`, `--voz-inicio <s>`, `--sem-voz` | `<audio>/vo.wav` e o `offset` do `fala.js` |
| `--audio <pasta>`, `--fala <arquivo>`, `--fps <n>` | `audio`, `fala.js`, 30 |

Saídas em `film/audio/` (ou na pasta do `--audio`): `mix.wav` (-16 LUFS em 2 passadas, pico real até -1,5 dBTP, 48 kHz, estéreo), `efeitos.wav`, `musica.wav` (ou `trilha.wav`), `musica-medida.json` e `sfx-eventos.json`. O `sfx-eventos.json` vai no `--sfx` do `ouvir.py`. Valor de opção inválido sai com erro e o nome da opção.

O `medir-musica.py` dá `bpm`, `batida_s`, `primeira_batida`, `tom` e `modo`, com tolerância de 0,5 BPM, 15 ms e tom exato. Limites:

- Com `andamento_incerto: true` (ou `incerto: true` no tom), confira de ouvido. Para forçar o andamento, passe `--bpm-min` e `--bpm-max` numa faixa que tem o certo e não tem o `rival_bpm`.
- Música lenta com contratempo forte pode sair dobrada sem aviso (60 BPM mediu 120). Passe `--bpm-max` abaixo do dobro do esperado.
- Eco pontuado forte puxa o andamento para 4/3. Música sem percussão deixa `forca_batida` baixa e a grade sem valor.
- A medida foi conferida só com sinais sintéticos. Nenhuma faixa da Lyria foi medida e ninguém ouviu os efeitos.

## O que cada peça faz

- `vozes/tts.mjs`: um pedido ao Gemini TTS 3.8 Flash (Interactions API, `gemini-3.8-flash-tts`).
- `vozes/gerar-tomadas.mjs`: N tomadas por bloco, alinha pelo Whisper (`alinhar.py`) e mede a entonação.
- `vozes/alinhar.py` e `vozes/normalizar.py`: o tempo de cada palavra. Sigla soletrada e número por extenso ("cê bê ésse", "dois mil e trinta e três") pegam o tempo da palavra do Whisper. Não saem estimados. O `normalizar.py` cobre inteiros de 0 a 999.999.999, "por cento", "R$" e "reais", decimal e sigla com o nome das letras com acento. Ele não cobre ordinal, fração, centavos, hora, número romano, "4G" nem sigla lida como palavra. O `ouvir.py` usa o mesmo módulo.
- `vozes/montar.mjs`: escolhe frase a frase (termina no ar, monótona, corrida, vírgula sem pausa, palavra não reconhecida), corta guardando a respiração, nivela em -20 LUFS e emenda com as pausas do roteiro. Depois dá um ganho fino a cada trecho de fala, até a mediana do RMS falado (a régua do S4): até 4 dB e pico de -1 dBFS, com a troca de ganho no meio da pausa entre dois trechos.
- `film/gerar-fala.mjs`: `assets/fala.js` (frases e palavras em segundos do filme) e a duração sugerida.
- `film/posicionar-voz.mjs`: para filme de tempo fixo. Põe cada linha da voz montada no segundo do `tempos.json` e corta no meio do silêncio entre as linhas. Grava `film/audio-filme/vo.wav` (mais `vo.lines.json`, `vo.words.json` e `vo.posicao.json`) e `assets/fala.js` com offset 0. Opções: `--tempos`, `--duracao`, `--audio`, `--saida-audio`, `--saida`. Recusa linha sem tempo, linhas que se sobrepõem e fala que passa do fim da cena ou do filme. Lista tudo, sai com código 1 e não grava nada.
- `film/fonte/base.html`: `pal()`, `mostra()`, `anel()`, `toque()`, `gesto()`, `peca()`, `cam()`, `passo()`, `marcaFinal()`; 9:16 e 16:9 pela mesma fonte.
- `film/fonte/iphone.js`: Safari, folha de Compartilhar, "Adicionar à Tela de Início" e Tela de Início desenhados (ilustrativo; dizer no NOTE.md).
- `gerar-trilha.mjs`: a música de fundo pela Lyria (API do Gemini), em `film/assets/musica/`.
- `som-comercial.mjs`: o modo `--comercial` do `gerar-som.mjs`. Lê o mapa dos efeitos e afina os efeitos tonais no tom da música (medido por `scripts/medir-musica.py`). Fecha a mistura em -16 LUFS em 2 passadas. Usa os timbres do `trilha.mjs` (que exporta `EFEITO`, `nota` e outros).
- `gerar-som.mjs` e `trilha.mjs`: efeitos sintetizados, a música (`--musica`, repetida com transição) ou a trilha de código, mixagem com a voz, tudo descendo nos últimos 1,6 s.
- `efeitos-gravados/`: 3 sons em domínio público (CC0) para o A/B do toque e do sopro; origem e licença no LEIA-ME de lá.
- `gerar-legenda.mjs`: `film/legenda-<formato>.srt` (`legenda-16x9.srt` ou `legenda-9x16.srt`) com o texto do roteiro (quebrado em 1 ou 2 linhas) e o tempo da fala; o `scripts/legendar.mjs` grava esse `.srt` no MP4 com o ffmpeg, sem renderizar de novo. A legenda sai sem caixa (letra branca com contorno e sombra); `--estilo caixa` põe a faixa de volta. Com `--saida` terminando em `.js`, grava `window.LEGENDA` (os mesmos blocos) para o filme desenhar.
- `autoteste.mjs` e `tela-vazia.mjs`: as duas conferências que o `look.py` não faz.
