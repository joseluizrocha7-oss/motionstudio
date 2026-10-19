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
3. **Um motor de render mais rápido, EM AVALIAÇÃO**: captura por `beginFrame`, trechos em
   paralelo, GPU. Só entra depois de provar, num trecho de filme real, a mesma imagem (com o
   desfoque de 8 fotos por quadro) em menos tempo. Até lá o render é o
   `scripts/render_partes.sh`. O candidato e a versão para testar: `LOCAL.md`.

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

**8. Render**, um formato de cada vez (dois Chromes juntos derrubam a máquina de 16 GB):
```bash
bash "$SKILL/scripts/render_partes.sh" film/index-vertical.html film/final-9x16.mp4 --dur <s> --audio film/audio/mix.wav -- --shutter 180 --subframes 8
```
Correção depois do render pronto: `scripts/trocar-trecho.sh` (renderiza só os trechos e junta
quadro a quadro). Nunca emendar sem recodificar.

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

- Medido em 16/10/2026: o Chrome do render na NVIDIA (RTX 4050) levou o mesmo tempo que na
  Intel (36 s para 60 quadros de 8 fotos) e deu a mesma imagem (47,9 dB). O gargalo é a
  captura, uma foto por vez (processador a 27%).
- Ganho de verdade: capturar em paralelo (esbarra na RAM: 16 GB, 1,3 GB livres durante um
  render; memória de 32 GB prevista para 20/10/2026) ou pelo `beginFrame` (o motor em avaliação, ver `LOCAL.md`).
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
| `scripts/` | `render.mjs`, `render_partes.sh`, `trocar-trecho.sh`, `look.py`, `lint.mjs`, `camera.mjs`, `ouvir.py`, `ler.mjs` (texto lido no MP4, pelo OCR do Windows em `ocr-windows.ps1`), `entonacao.mjs`, `pausas.mjs`, `mix.py`, `voice.py` (só as ferramentas de áudio local: `split`, `refine`, `music-fit`; a voz sai do `kit/vozes/tts.mjs`), `brand.mjs`, `fetch_logo.mjs`, `providers.sh`, `_cdp.mjs` (Chrome por CDP) |
| `runtime/` | o motor de animação (`motion.js`, API em `runtime/README.md`) |
| `references/` | o método de direção (`metodo.md`) e os guias de ofício, em inglês |
| `taste/` | os vereditos do Jose e os antes e depois (fora do git) |
| `historico/` | o porquê de cada regra local, com data e caso (fora do git) |
| `LOCAL.md`, `ORIGEM.md` | casos de cliente, caminhos, candidatos em avaliação, de onde veio cada parte e o que falta (fora do git) |
| `LICENSE`, `NOTICE` | a licença e o único lugar com as atribuições de terceiros |
