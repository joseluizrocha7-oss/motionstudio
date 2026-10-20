---
name: motionstudio
description: Faz vídeo por código, com qualidade de motion designer e conferência automática. Tutorial de app com as telas de verdade (toques, gestos, simulação de iPhone, voz explicando passo a passo), comercial, promo, anúncio para rede social, vinheta de marca e vídeo de lançamento. Roteiro e voz em pt-BR (Gemini TTS 3.8 Flash, escolhido frase a frase), filme em HTML com animação presa a cada palavra, uma fonte para várias versões (longo e curto, modo escuro e claro, 9:16 e 16:9), trilha e efeitos por código e portões de imagem, texto, câmera, som e tela vazia no arquivo entregue. Usar para qualquer pedido de fazer, planejar, roteirizar, corrigir ou criticar vídeo, motion graphics, tutorial em vídeo, reels, vídeo de onboarding ou de treinamento.
---

# motionstudio

Skill de vídeo do Jose, criada em 16/10/2026. Tem três partes:

1. **A direção do filme** (ideia, mundo, cortes), as curvas de movimento medidas em 53
   filmes profissionais, o motor de animação que volta a qualquer quadro (`runtime/`) e os
   portões G0 a G5. O método completo: `references/metodo.md`.
2. **O que foi aprendido filme a filme** (13 a 19/10/2026): voz Gemini escolhida frase a
   frase, portões de câmera, som, texto e tela vazia, captura do app de verdade com API
   simulada, uma fonte para vários filmes, troca de trecho sem desencontrar voz e tela.
3. **Um motor de render mais rápido**: `scripts/render-trechos.mjs`, trechos em paralelo com a
   mesma imagem do render antigo (prova de 20/10/2026 na seção "Render"). O padrão continua o
   `scripts/render_partes.sh` até o motor novo rodar um filme inteiro com som. O `beginFrame`
   (outro motor, em avaliação) está em `LOCAL.md`.

`SKILL` = a pasta deste arquivo (`~/.claude/skills/motionstudio`). Comandos no Git Bash.
No Windows desta máquina, `python3` não existe: usar `py -3`.

**Arquivos só desta máquina (fora do git, têm nome de cliente):** `LOCAL.md` (casos de
cliente, caminhos e candidatos em avaliação), `historico/` (o porquê de cada regra, com caso
e data), `taste/verdicts.md` e `taste/edits.md` (o que o Jose aprovou e reprovou) e
`ORIGEM.md` (de onde veio cada parte e o que falta). Ler quando existirem. Nome de cliente,
de pessoa ou de projeto de terceiro vai para esses arquivos, nunca para os arquivos do git:
o repositório é público.

## Regras do Jose (valem por cima de tudo o que vier depois)

- **Formato pelo destino.** Tutorial de app para quem usa o app: 9:16 primeiro (a maioria
  assiste no celular; "vamos focar no modo 9:16"). Rede social: 9:16 e 16:9. Treinamento
  para ver no computador ou em reunião: 16:9. Destino não dito: decidir e dizer em uma linha.
- **Uma versão só de cada formato, em resolução cheia.** Nada de rascunho em meia resolução;
  confere-se por fotos (`render.mjs --still`) antes do render inteiro.
- **Qualidade não se troca por tempo.** Desfoque de movimento com 8 fotos por quadro
  (`--shutter 180 --subframes 8`); o Jose recusou cair para 4. Para acelerar, ver "Render".
- **Câmera contida.** No máximo 1,5x o plano-base; o aparelho aparece quase o tempo todo e
  a câmera chega perto só no momento-chave.
- **Som enxuto.** Frases da voz niveladas uma a uma (-20 LUFS), trilha num volume só do
  começo ao fim (uns 14 dB abaixo da voz), poucos efeitos e baixos, corte da voz só em
  silêncio medido: cada frase termina onde a tomada fica 80 ms abaixo de -50 dB, não no fim
  que o Whisper marca (ele chega cedo; com 0,12 s de cauda o "-ção" da última palavra do
  tutorial saiu cortado, "cortou seco e acabou o vídeo", Jose, 17/10). Mistura final em -16
  LUFS, com a trilha descendo nos últimos 1,6 s.
- **Fala e tela juntas.** Texto na tela diz o que a voz diz, na mesma hora; cada um leva
  `M.mark(quadro, 'fala', '<palavras>')` e o `ouvir.py` confere (S3).
- **Voz em pt-BR nativa.** Gemini TTS 3.8 Flash (`gemini-3.8-flash-tts`, pelo
  `kit/vozes/tts.mjs` e pelo `kit/vozes/gerar-tomadas.mjs`) em todo filme com voz, tutorial
  ou comercial. Para o Jose, desde 17/10, a voz é a `pt-br-podcaster-6`
  também no tutorial ("Usa a mesma voz do comercial"; ele a escolheu de ouvido entre três
  amostras para o comercial). Ela tende a terminar frase subindo: 8 tomadas nos blocos grandes,
  estilo pedindo fim descendo, pausa entre frases do roteiro. A `pt-br-training-1` foi a do
  tutorial até a rodada 4. Tomadas de cada voz numa pasta própria (`roteiro.voz.pasta`). (A voz de
  outro serviço foi reprovada por sotaque em 15/10: a voz é sempre a do Gemini.) Frase que termina em nome de botão sobe
  no fim: na `fala`, o nome vai em minúsculas, ou a frase é reescrita para terminar em verbo
  ("Toque em Reconectar quando a senha mudar."). Sigla e nome próprio na grafia de fala
  ("T.I." vira "tê í", "90" vira "noventa"). O saldo do Gemini é o mesmo dos sistemas em
  produção: gerar só o necessário.
- **pt-BR com acento em tudo e nunca travessão** (voz, tela, NOTE.md, LEIA-ME).
- **Ninguém ouviu.** Toda entrega diz que a fala foi conferida por transcrição e medida, e
  que pronúncia de nome próprio e tom só o ouvido do Jose valida.
- **Abertura, partes e fecho em vídeo para usuário novo** (gestor do cliente, 16 e 17/10):
  abrir dando boas-vindas a quem acabou de receber o acesso ("Olá! Seja bem-vindo ao novo
  [nome do aplicativo]."), dizer as partes do vídeo e separar a configuração inicial (feita uma vez) do
  uso no dia a dia ("O início está muito acelerado, sem uma segregação clara de setup inicial e
  funcionalidades de uso"). A parte se anuncia pela voz, com o app em cena e uma pílula escura
  pequena no alto ("Parte 1 de 3 · Configuração inicial"); enquanto a voz nomeia os passos, a
  tela mostra cada um. Cartela de tela inteira com o celular fora de cena, NÃO: o Jose tirou
  ("Não precisa desses menus entre as etapas do vídeo, pode ir falando enquanto apresenta a
  tela do app", 17/10).
  Fecho fluido, dizendo a quem procurar ("Aproveite seu novo aplicativo e, em caso de
  dúvidas, entre em contato com a área de Tecnologia da Informação."), com a marca.
  Sem detalhe técnico que não é passo do usuário: o "acesso salvo por 90 dias" saiu
  a pedido dele ("retirar esse trecho", 17/10).
- **Narrador em primeira pessoa e sem "app".** "Vamos configurar seu acesso", "vamos
  conectar"; nas ações, "toque em...". "Aplicativo", nunca "app" na voz ("Ele tá falando app
  ao pé da letra. Mudar para aplicativo, irá soar melhor."). Gestor do cliente, 17/10.
- **Em pé do começo ao fim.** Tutorial de app em 9:16 não pede para o usuário virar o
  celular (cada reprodutor gira o vídeo de um jeito); trecho de computador entra com o
  monitor na largura do quadro e a câmera chegando no que importa (a tabela, a tela).
- **Um tema só quando pedirem.** O Jose escolheu só o modo claro para o tutorial do
  caso de referência (16/10); a troca de tema aparece no passeio por Ajustes (o toque em Escuro deixa
  o app escuro por um instante e o toque em Claro volta).
- **Telas da versão que está em produção.** Fotografar do código da tag de produção; vídeo
  com versão antiga no topo do app foi refeito a pedido do Jose (16/10, 1.30.112 para 1.30.115).

## Que filme é

| pedido | caminho |
|---|---|
| tutorial de app, onboarding, treinamento de sistema | o kit (`kit/`), passo a passo abaixo |
| comercial, promo, anúncio, vinheta, lançamento | o método de direção: `references/metodo.md` e `references/` |
| sem tela para mostrar (produto físico, foto) | trechos gerados (Veo 3.1) e trilha (Lyria 3) pela chave do Gemini (a nota está em `historico/`, quando existir) |

## Passo a passo: tutorial de app (o caso mais comum)

**0. Caixa de ferramentas e gosto.** `bash "$SKILL/scripts/providers.sh"`; ler
`taste/verdicts.md`, `taste/edits.md` (o que o Jose aprovou e reprovou) e `LOCAL.md`,
quando existirem.

**1. Projeto.** `node "$SKILL/kit/novo-projeto.mjs" <pasta>` (em `conteudo/<tema>-<data>/`
do repositório do cliente). O kit e os comandos: `kit/LEIA-ME.md`.

**2. Roteiro** (`roteiro.json`). Blocos por passo; cada linha com `texto` (tela e voz) e,
quando precisa, `fala` (só voz). Na ordem de quem acabou de receber o acesso: boas-vindas,
entrar, conectar o que precisa, instalar, a tela principal, as ações, os detalhes, as
configurações, o fecho. Mostrar ao Jose um roteiro resumido antes de gastar com voz.

**3. Voz.** Gemini TTS 3.8 Flash (`roteiro.voz.modelo`: `gemini-3.8-flash-tts`; chave em
`GEMINI_API_KEY`, num `.env` passado com `node --env-file`). `vozes/gerar-tomadas.mjs --tomadas 6` (por bloco: a voz precisa saber de onde
vem e para onde vai) e `vozes/montar.mjs` (escolhe frase a frase pela medida, guarda a
respiração, nivela). Frase reescrita: mais tomadas com `--inicio 7`; das antigas valem as
frases que não mudaram. Versão curta com pouco tempo: `respiracao` e `cauda` menores no
roteiro. Depois `film/gerar-fala.mjs` grava os tempos (`assets/fala.js`).

**4. Telas.** Fotos do app de verdade, operado num Chromium com a API simulada e dados
fictícios, cada alvo com a sua caixa (`medidas.js`). Os dois temas do app, se ele tiver.
Modelo: `capturar.mjs` do caso de referência. Alvo que é uma frase recebe a caixa do
parágrafo inteiro (o elemento, `getByText(...)`), nunca só a das palavras: um contorno em
"Conectado como" cortando a frase no meio pareceu defeito ao Jose (16/10). E todo contorno
sai antes de a pílula do passo seguinte entrar.

**5. Filme.** `film/fonte/`: `base.html` (câmera, telas, contorno, toque, gesto, peças,
marca do fim), `iphone.js` (Safari e Tela de Início, ilustrativos), a linha do tempo e
`pe.html`. Cada mudança presa a uma palavra (`pal('e2', 'Entrar')`). `film/montar-filmes.mjs`
gera os `index-*.html` (versões, temas, 9:16 e 16:9) com a duração tirada da voz.
No 9:16 o celular é 1,75x o do 16:9; o que fica ao lado do aparelho no 16:9 vai para a faixa
de baixo, e o que precisa ficar junto do botão vai por cima do app (`z-index`).

**6. Antes do render (todos obrigatórios):**
```bash
node autoteste.mjs film/index-vertical.html          # 0 divergências
node tela-vazia.mjs film/index-vertical.html         # nenhum instante com o celular vazio
node "$SKILL/scripts/camera.mjs" film/index-vertical.html --el "#celular"   # Z1, Z2
node "$SKILL/scripts/lint.mjs" film/index-vertical.html                     # G5 (a pílula de passo acusa C1: é o desenho)
node "$SKILL/scripts/render.mjs" film/index-vertical.html --still 2,40,93 film/stills   # e OLHAR
```

**7. Som.** `node gerar-som.mjs <events.json de um --still> --total <duração>`: trilha e
efeitos por código (nada de terceiros), mistura com a voz. O toque e o sopro gravados
(`--toque`, `--ar`, sons CC0 em `kit/efeitos-gravados/`) estão em teste. Não use sem o Jose
aprovar o A/B de 19/10/2026 (`kit/efeitos-gravados/LEIA-ME.md`).

**8. Render**, um formato de cada vez:
```bash
bash "$SKILL/scripts/render_partes.sh" film/index-vertical.html film/final-9x16.mp4 --dur <s> --audio film/audio/mix.wav -- --shutter 180 --subframes 8
```
Mais rápido, com a mesma imagem (2 Chromes em paralelo, GPU fixa, trava de memória):
```bash
node "$SKILL/scripts/render-trechos.mjs" film/index-vertical.html film/final-9x16.mp4 --audio film/audio/mix.wav --shutter 180 --subframes 8
```
Ele guarda cada trecho em `film/cache-render/`. Se o filme mudar sem mudar de duração, rode o
mesmo comando: os trechos sem mudança saem do cache. Apague a pasta depois da entrega.
Correção depois do render pronto, pelo caminho antigo: `scripts/trocar-trecho.sh` (renderiza só os
trechos e junta quadro a quadro). Nunca emendar sem recodificar.

**9. Portões no arquivo que vai ser entregue:**
```bash
py -3 "$SKILL/scripts/look.py" film/final-9x16.mp4 --out film/look-9x16 --expect <s> --expect-audio
py -3 "$SKILL/scripts/ouvir.py" film/final-9x16.mp4 --roteiro film/audio/vo.txt --eventos film/final-9x16.mp4.events.json --sfx film/audio/sfx-eventos.json --motor whisper --modelo medium
node "$SKILL/scripts/ler.mjs" film/index-vertical.html film/final-9x16.mp4    # T1, T2 (1 min para 4 min de filme)
```
Olhar a folha de contato (`look-*/sheet.jpg`) quadro por quadro. Alerta do Whisper ("frases
emendadas", palavra não ouvida) se confere medindo antes de mexer: transcrever só o trecho
e medir o silêncio na narração. Para cada alerta do `ler.mjs`, abra o recorte que ele grava
(`ler-final-9x16/alerta-*.png`):
- Se o recorte mostra o defeito (texto coberto, cortado, apagado ou sem acento), corrija o
  filme e renderize o trecho de novo (`scripts/trocar-trecho.sh`).
- Se o texto está legível no recorte, o erro é do OCR. Escreva o alerta no NOTE.md, com o recorte.
- Se o texto é ilustrativo e não precisa ser lido (rótulo da Tela de Início desenhada), marque o
  elemento com `data-ler="ignorar"` na fonte (`film/fonte/`, não no `index-*.html` gerado).
  Rode o `montar-filmes.mjs` e o `ler.mjs` de novo. Não precisa renderizar: o atributo não muda a
  imagem. Diga no NOTE.md o que foi ignorado.

Rode o `ler.mjs` no filme inteiro: com `--de`/`--ate`, uma camada que apareceu antes do trecho
acusa como coberta.

**10. Entrega.** `film/NOTE.md` com os números de cada portão (e o que é real e o que é
ilustrativo), `LEIA-ME.md` do projeto (o que sai, como refazer, onde mexer), entrada em
`tarefas.md` do cliente. Dizer que ninguém ouviu.

## Portões

| portão | passa | quem mede |
|---|---|---|
| G0 o render existe | duração e som batem com o planejado | `look.py --expect --expect-audio` |
| G1 texto legível | por olho; app em tamanho de celular fica abaixo dos 4% da altura: escolha, dizer no NOTE.md | folha de contato; o T1 mede o que o OCR lê |
| G2 sem quadro vazio | nenhuma sequência de mais de 3 quadros chapados | `look.py` |
| G3 fim curto | final parado de 0,6 a 1,4 s (a marca do fim chegando com o próprio nome na última frase resolve; pulso pequeno não conta como movimento). No tutorial do Jose o fim fica com 1,8 s de marca depois da última palavra e a trilha descendo, a pedido dele ("cortou seco"): o G3 acusa e o NOTE.md diz que é escolha | `look.py` |
| G4 um herói por quadro | por olho | folha de contato |
| G5 sem cromo de página | sem rótulo de canto, contador, barra de progresso | `lint.mjs` |
| T1 texto lido | todo texto do HTML que fica parado na tela é lido pelo OCR no MP4 entregue, acento inclusive; nenhum texto passa a vida inteira debaixo de outra peça | `ler.mjs` |
| T2 texto inteiro | nenhum texto fica com pedaço fora do quadro o tempo todo | `ler.mjs` |
| Z1 câmera contida | aproximação máxima até 1,5x o plano-base | `camera.mjs` |
| Z2 objeto no quadro | metade ou mais do aparelho à vista na mediana | `camera.mjs` |
| autoteste | 0 divergências entre tocar e saltar | `kit/autoteste.mjs` |
| tela vazia | nenhum instante com o celular sem foto | `kit/tela-vazia.mjs` |
| a leitura | sem alerta em frase de impacto, pontuação com pausa | `entonacao.mjs` (o `montar.mjs` já pune) |
| S1 a S4 | fala inteira, pausas no lugar, fala e tela juntas, mistura enxuta | `ouvir.py` |

ALERTA se corrige como FAIL; alerta que é da transcrição se prova medindo e vai para o
NOTE.md com a medida.

## Render: o que acelera e o que não

Medido em 20/10/2026 num tutorial de 4 min 37 s em 9:16, com 8 fotos por quadro (o caso está em
`LOCAL.md`):

- **Onde vai o tempo.** Foto: 67 ms. Pintar sem foto: 14 ms. Ler o estado do DOM: 1,5 ms. Um
  trecho de 5 s leva de 94 a 136 s, conforme a carga da máquina.
- **A GPU muda a imagem.** Sem preferência, o Chrome sem janela usa a GPU que o Windows lista
  primeiro, e isso muda quando se liga um monitor. Intel e NVIDIA dão pixels diferentes. O
  `render-trechos.mjs` fixa a Intel (`--gpu baixo`, a dos renders até 20/10). O `render.mjs` não fixa:
  com outro monitor ligado, ele sai diferente do render anterior.
- **A foto depende do que foi pintado antes.** Uma camada que desliza fração de pixel (a grade de
  fundo, por exemplo) só é redesenhada quando andou o bastante. Pular uma subamostra, começar o trecho
  em outro ponto ou ler o estado no mesmo Chrome muda a foto (até 25 níveis, nos pontos da grade).
  Por isso o motor novo usa um Chrome limpo por trecho, os mesmos cortes de 5 s e lê o estado num
  Chrome à parte.
- **O render antigo varia sozinho em alguns quadros.** No trecho de 45 a 50 s do caso, 3 rodadas do
  `render.mjs` deram 2 resultados, com até 5 níveis de diferença na borda de um elemento animado.
  Igualdade se mede contra o mesmo render repetido, não só contra um arquivo antigo.
- **Memória.** Abaixo de 1 GB livre, o Chrome do Windows descarta cache e a foto muda (46 a 54 dB).
  Foi a causa do paralelo diferente em 20/10. O motor novo abre um Chrome por vez, só com 3 GB livres
  (`--memoria`), e refaz o trecho em que a memória livre cai abaixo de 1,5 GB.
- **Prova do `render-trechos.mjs`** (30 a 60 s do caso, 6 trechos, contra o arquivo entregue):
  - Em fila: 5 trechos idênticos quadro a quadro. No trecho de 45 a 50 s, o resultado do novo é igual,
    quadro a quadro, ao de uma das rodadas do `render.mjs`.
  - Com 2 Chromes: o mesmo. O trecho de 45 a 50 s saiu igual à outra rodada do `render.mjs`.
  - Do cache: os 6 trechos em 10 s, arquivo idêntico byte a byte.
  - O fim do filme (270 a 276,7 s, com o trecho curto de 51 quadros e o som): idêntico, com áudio.
  - Falta: um filme inteiro com som pelo motor novo. Até lá, o padrão é o `render_partes.sh`.
  - Tempo com 2 Chromes: 532 s para 30 s de filme, com 2 trechos refeitos por falta de memória. Sem
    os refeitos, uns 410 s. O antigo, na mesma carga: uns 780 s.
- **Não adotado, e por quê:**
  - Quadro parado (pular as fotos do meio, `render-rapido.mjs`): com algo deslizando fração de pixel,
    a foto muda conforme o que foi pintado antes. Num filme com a grade de fundo deslizando o tempo
    todo, nenhum quadro fica parado. O `--atalho` (1 foto quando as 8 subamostras têm o mesmo estado)
    fica em teste: o filme da prova não tinha nenhum quadro assim.
  - Cache que sobrevive a inserção (`--cenas`): da rodada 5 para a 6 do caso, 0 cenas reaproveitáveis.
    Motivos: as telas foram fotografadas de novo, a grade desliza em função da duração do filme
    inteiro, e 51 de 503 palavras andaram 381 quadros em vez de 382. Só rende em filme sem deriva de
    fundo, com inserção em quadros inteiros. Em teste.
  - Mais de 2 Chromes: com 3, a memória livre foi a 0,01 GB e um Chrome caiu. A GPU Intel usa a
    memória do sistema.
- Regra global do Jose: usar a GPU sempre que der, medindo (`~/.claude/CLAUDE.md`, seção GPU).

## Comercial, promo, anúncio: o método de direção

Ler `references/metodo.md` antes da primeira ideia: os 8 julgamentos do que é
bom, a lista do que nunca entregar (cromo de página, layout de slide, cartão genérico,
número inventado, slogan, fim de rodapé de site, filme que ninguém olhou), as 12 leis de
ofício medidas e o passo a passo (marca, ideia, mundo, roteiro, o momento mais difícil
primeiro, olhar com honestidade, som, entrega). Entrega de rede social: 9:16 e 16:9, o
mesmo filme recomposto para cada quadro (o 16:9 não é o vertical com barras). A voz do
comercial é a mesma do tutorial, Gemini TTS 3.8 Flash: o passo 5 do método diz como.

## Caso de referência

Tutorial de primeiros passos de um app de aprovação (16/10/2026), no repositório do
cliente (caminho em `LOCAL.md`; `LEIA-ME.md` e `film/NOTE.md` do projeto). Captura do
app com API simulada (`capturar.mjs`, `app/dados.mjs`), longo de 3 min 50 s e curto de
59,5 s em 9:16 nos dois temas, passeio por Ajustes, simulação do iPhone, fecho com a marca
chegando no nome.

## Arquivos

| arquivo | para |
|---|---|
| `kit/` | o projeto de tutorial (`novo-projeto.mjs` copia para a pasta do filme; `LEIA-ME.md`); `kit/efeitos-gravados/`: 3 sons CC0 em teste |
| `scripts/` | `render.mjs`, `render_partes.sh`, `render-trechos.mjs` (o render_partes em paralelo, com cache; usa `_pagina.mjs`), `trocar-trecho.sh`, `look.py`, `lint.mjs`, `camera.mjs`, `ouvir.py`, `ler.mjs` (texto lido no MP4, pelo OCR do Windows em `ocr-windows.ps1`), `entonacao.mjs`, `pausas.mjs`, `mix.py`, `voice.py` (só as ferramentas de áudio local: `split`, `refine`, `music-fit`; a voz sai do `kit/vozes/tts.mjs`), `brand.mjs`, `fetch_logo.mjs`, `providers.sh`, `_cdp.mjs` (Chrome por CDP) |
| `runtime/` | o motor de animação (`motion.js`, API em `runtime/README.md`) |
| `references/` | o método de direção (`metodo.md`) e os guias de ofício, em inglês |
| `taste/` | os vereditos do Jose e os antes e depois (fora do git) |
| `historico/` | o porquê de cada regra local, com data e caso (fora do git) |
| `LOCAL.md`, `ORIGEM.md` | casos de cliente, caminhos, candidatos em avaliação, de onde veio cada parte e o que falta (fora do git) |
| `LICENSE`, `NOTICE` | a licença e o único lugar com as atribuições de terceiros |
