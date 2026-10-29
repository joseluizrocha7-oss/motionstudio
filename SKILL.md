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
- **Som enxuto.** Frases da voz niveladas uma a uma (-20 LUFS, mais um ganho fino por trecho de fala, passo 3), música num volume só do
  começo ao fim (**20 dB abaixo da voz**), poucos efeitos e baixos, corte da voz só em
  silêncio medido: cada frase termina onde a tomada fica 80 ms abaixo de -50 dB, não no fim
  que o Whisper marca (ele chega cedo; com 0,12 s de cauda o "-ção" da última palavra do
  tutorial saiu cortado, "cortou seco e acabou o vídeo", Jose, 17/10). Mistura final em -16
  LUFS, com a trilha descendo nos últimos 1,6 s.
- **Música da Lyria, não de código** (desde 28/10/2026). A trilha sintetizada por código
  (4 acordes, 15,5 dB sob a voz) o Jose achou "chata". Ouvindo 5 amostras na mesma abertura,
  escolheu uma faixa tech animada da Lyria 3 Pro, "uns 30% mais baixa" (20 dB sob a voz).
  Gerar com `kit/gerar-trilha.mjs` (o pedido aprovado é o padrão; faixa de uns 3 min, que
  o `gerar-som.mjs --musica` repete com transição; a de 30 s repetida cansa). Música nova
  ou outro gosto: amostras curtas misturadas com a voz, mandadas ao celular, antes do render.
- **Fala e tela juntas.** Texto na tela diz o que a voz diz, na mesma hora; cada um leva
  `M.mark(quadro, 'fala', '<palavras>')` e o `ouvir.py` confere (S3).
- **Voz em pt-BR nativa.** Gemini TTS 3.8 Flash (`gemini-3.8-flash-tts`, pelo
  `kit/vozes/tts.mjs` e pelo `kit/vozes/gerar-tomadas.mjs`) em todo filme com voz, tutorial
  ou comercial. Para o Jose, desde 17/10, a voz é a `pt-br-podcaster-6`
  também no tutorial ("Usa a mesma voz do comercial"; ele a escolheu de ouvido entre três
  amostras para o comercial). Ela tende a terminar frase subindo: 8 tomadas nos blocos grandes,
  estilo pedindo fim descendo, pausa entre frases do roteiro. A `pt-br-training-1` foi a do
  tutorial até a rodada 4. **Estilo dinâmico** desde 28/10/2026: o calmo ficou lento para ele
  ("pode deixar a narração mais dinamica e que prende a atenção"); de 3 estilos na mesma
  abertura escolheu o dinâmico, e no filme pronto disse "ficou muito boa essa dinamica". O
  estilo está em `kit/roteiro.json` (e é o padrão do `gerar-tomadas.mjs`), com pausas de
  0,28 s entre frases, 0,4 s entre linhas, 0,8 s entre blocos e respiração de 0,2 s: a fala
  fica uns 15% mais curta que a calma. Ele sobe mais no fim da frase: 6 tomadas por bloco e
  mais 6 nos blocos com fim acima de +1 semitom. Tomadas de cada voz e estilo numa pasta própria (`roteiro.voz.pasta`). (A voz de
  outro serviço foi reprovada por sotaque em 15/10: a voz é sempre a do Gemini.) Frase que termina em nome de botão sobe
  no fim: na `fala`, o nome vai em minúsculas, ou a frase é reescrita para terminar em verbo
  ("Toque em Reconectar quando a senha mudar."). Sigla e nome próprio na grafia de fala
  ("T.I." vira "tê í", "90" vira "noventa"). O saldo do Gemini é o mesmo dos sistemas em
  produção: gerar só o necessário.
- **Nome próprio de marca: `fala` fonética, confirmada antes de gerar tomada.** O TTS lê a
  marca pela grafia. Marca que se diz de outro jeito (nome estrangeiro, letra que muda de som)
  sai errada. No roteiro, a linha com a marca leva `fala` com a grafia fonética: o `texto` fica
  "Quíron" e a `fala` fica "Kíron". Mostre a grafia ao Jose e espere a confirmação antes de gastar a
  primeira tomada. Depois da voz, faça a transcrição livre: transcreva as tomadas sem passar o
  roteiro (Whisper puro) e leia como ele escreveu a marca. É o teste da pronúncia. Num caso,
  3 de 6 tomadas saíram com a pronúncia errada: escolha as tomadas pela transcrição.
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
| comercial, promo, anúncio, vinheta, lançamento | o método de direção: `references/metodo.md` e `references/`; voz em cenas de tempo fixo: seção "Voz num filme que não é tutorial" |
| sem tela para mostrar (produto físico, foto) | trechos gerados (Veo 3.1) e trilha (Lyria 3) pela chave do Gemini (a nota está em `historico/`, quando existir) |

## Passo a passo: tutorial de app (o caso mais comum)

**0. Caixa de ferramentas e gosto.** `bash "$SKILL/scripts/providers.sh"`; ler
`taste/verdicts.md`, `taste/edits.md` (o que o Jose aprovou e reprovou) e `LOCAL.md`,
quando existirem.

A voz e a música dependem da `GEMINI_API_KEY`. O `providers.sh` mostra `gemini.key`,
`gemini.in_env` e `gemini.in_dotenv` (verdadeiro ou falso; o valor nunca aparece). Rode na
pasta que tem o `.env`, a raiz do repositório do cliente. Ele só lê o `./.env` da pasta atual.
Valor vazio ou linha comentada conta como falso. Com `gemini.key` falso, pare antes de
planejar a voz e peça ao Jose a chave no `.env` do próprio repositório do cliente. Não aponte
`--env-file` para o `.env` de outro projeto: o modo automático bloqueia como "Credential
Exploration".

**1. Projeto.** `node "$SKILL/kit/novo-projeto.mjs" <pasta>` (em `conteudo/<tema>-<data>/`
do repositório do cliente). O kit e os comandos: `kit/LEIA-ME.md`.

**2. Roteiro** (`roteiro.json`). Blocos por passo; cada linha com `texto` (tela e voz) e,
quando precisa, `fala` (só voz). Na ordem de quem acabou de receber o acesso: boas-vindas,
entrar, conectar o que precisa, instalar, a tela principal, as ações, os detalhes, as
configurações, o fecho. Mostrar ao Jose um roteiro resumido antes de gastar com voz. Marca que
se diz diferente da grafia leva `fala` fonética, confirmada por ele (regra "Nome próprio de marca").

**3. Voz.** Gemini TTS 3.8 Flash (`roteiro.voz.modelo`: `gemini-3.8-flash-tts`; chave em
`GEMINI_API_KEY`, num `.env` do repositório do cliente passado com `node --env-file`, nunca o de outro projeto). `vozes/gerar-tomadas.mjs --tomadas 6` (por bloco: a voz precisa saber de onde
vem e para onde vai) e `vozes/montar.mjs` (escolhe frase a frase pela medida, guarda a
respiração, nivela). Frase reescrita: mais tomadas com `--inicio 7`; das antigas valem as
frases que não mudaram. Versão curta com pouco tempo: `respiracao` e `cauda` menores no
roteiro. Depois `film/gerar-fala.mjs` grava os tempos (`assets/fala.js`). Filme de cenas com
tempo fixo (comercial, promo): no lugar dele, `film/posicionar-voz.mjs` (seção "Voz num filme que
não é tutorial").

O `montar.mjs` nivela em dois passos. Primeiro em LUFS, frase a frase. Depois dá um ganho fino a
cada trecho de fala, até a mediana do RMS da parte falada: é a régua do S4 do `ouvir.py`. Trecho
é o conjunto de palavras com menos de 0,30 s entre si, e só os de 0,40 s ou mais contam. O ganho
vai até 4 dB (`--fino N`; `--fino 0` desliga) e até o pico de -1 dBFS. Ele troca no meio da
pausa entre dois trechos. A saída mostra o RMS falado e o ganho de cada trecho, e o espalhamento antes
e depois. O número "depois" é o do S4, que acusa acima de 4,0 dB. Trecho "limitado pelo máximo":
regrave a tomada ou suba o `--fino`. Projeto criado antes de 29/10/2026 tem o `montar.mjs` antigo
(o `novo-projeto.mjs` não sobrescreve nada): copie o da skill para `vozes/`.

**4. Telas.** Fotos do app de verdade, operado num Chromium com a API simulada e dados
fictícios, cada alvo com a sua caixa (`medidas.js`). Os dois temas do app, se ele tiver.
Modelo: `capturar.mjs` do caso de referência. Alvo que é uma frase recebe a caixa do
parágrafo inteiro (o elemento, `getByText(...)`), nunca só a das palavras: um anel de destaque em
"Conectado como" cortando a frase no meio pareceu defeito ao Jose (16/10). E todo anel de destaque
sai antes de a pílula do passo seguinte entrar.

**5. Filme.** `film/fonte/`: `base.html` (câmera, telas, anel de destaque, toque, gesto, peças,
marca do fim), `iphone.js` (Safari e Tela de Início, ilustrativos), a linha do tempo e
`pe.html`. Cada mudança presa a uma palavra (`pal('e2', 'Entrar')`). `film/montar-filmes.mjs`
gera os `index-*.html` (versões, temas, 9:16 e 16:9) com a duração tirada da voz.
No 9:16 o celular é 1,75x o do 16:9; o que fica ao lado do aparelho no 16:9 vai para a faixa
de baixo, e o que precisa ficar junto do botão vai por cima do app (`z-index`).

**Desenho próprio no relógio do filme.** Algo que nenhuma chamada `M.*` cobre (arco SVG, gráfico,
partículas num canvas 2D, legenda desenhada na página) usa `M.render(fn, { heavy })`. Ele
substitui o setter num objeto tweenado em `M.tl`. A `fn(t, quadro)` redesenha do zero a cada seek,
pode rodar mais de uma vez por seek e nunca guarda estado entre chamadas: o autoteste acusa. Use
`t` (segundos, contínuo) para movimento e `quadro` (inteiro) para texto e degrau. `heavy: true`
vale só para desenho caro em canvas: o autoteste pula os quadros que não fotografa. Exemplo que
roda: `examples/relogio/index.html`. A API está em `runtime/README.md`. Projeto criado antes de
29/10/2026 tem um `film/runtime/` antigo: copie `runtime/motion.js` da skill para ele.

**Ícone animado numa peça.** `library/lottie/` tem 5 ícones feitos à mão: `confirmado`, `alerta`,
`dinheiro`, `email` e `documento`. Use no máximo 1 ícone por peça do painel. O ícone entra 5 quadros
depois da peça que a voz nomeia (`at: a + 5`). Peça que a voz não nomeia fica sem ícone.
1. Copie o `_cor.js` e o `.js` do ícone, de `$SKILL/library/lottie/`, para `film/assets/`.
2. Carregue os dois no `film/fonte/base.html`, depois do `motion.js`.
3. Rode `node film/montar-filmes.mjs` de novo: ele refaz os `index-*.html` com o `base.html` novo.
4. Na linha do tempo, ponha um `<canvas>` na peça e chame o `M.lottie`:
```js
const ACENTO = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim();
const el = peca('<canvas width="112" height="112" style="width:56px;height:56px"></canvas>Pagamento confirmado', x, y, a, b, { classe: 'nota' });
M.lottie(el.querySelector('canvas'), { data: LOTTIE.cor(LOTTIE.confirmado, ACENTO), at: a + 5 });
```
O `LOTTIE.cor` devolve uma cópia do ícone na cor de acento do filme (a `--acento`). O ícone começa
5 quadros depois da peça, quando ela está quase pousada. Ele se desenha em uns 25 quadros e para no último.
Dê ao canvas o dobro do tamanho de tela (`width="112"` para 56 px): o traço sai liso. Ícone de
banco de ícones só entra com licença comercial conferida, numa linha do `library/lottie/LICENCAS.md`.
Projeto criado antes do `M.lottie` tem um `film/runtime/` antigo, porque o `novo-projeto.mjs` não
sobrescreve nada. Copie `runtime/motion.js` e `runtime/vendor/dotlottie-web/` da skill para o
`film/runtime/` desse projeto.
Exemplo que roda: `examples/lottie-painel/index.html`.

**6. Antes do render (todos obrigatórios):**
```bash
node "$SKILL/scripts/erros.mjs" film/index-vertical.html   # sem exceção
node autoteste.mjs film/index-vertical.html          # 0 divergências
node tela-vazia.mjs film/index-vertical.html         # nenhum instante com o celular vazio
node "$SKILL/scripts/camera.mjs" film/index-vertical.html --el "#celular"   # Z1, Z2
node "$SKILL/scripts/lint.mjs" film/index-vertical.html                     # G5 (a pílula de passo acusa C1: é o desenho)
node "$SKILL/scripts/render.mjs" film/index-vertical.html --still 2,40,93 film/stills --limpar   # e OLHAR
```
Rode o `erros.mjs` antes do autoteste: com exceção na página, o autoteste espera 10 minutos.

O `--limpar` apaga só os `still_*.png` da pasta antes de gravar. Ele não toca em outros arquivos,
em subpastas nem no `events.json`, e escreve quantas fotos apagou. Use em toda rodada de fotos: a
folha de conferência não mistura rodadas, e o `rm -rf` (que o modo automático recusa) fica
desnecessário. Sem `--still`, o `render.mjs` recusa a opção.

O `lint.mjs` tem a regra F1 (WARN: não derruba o G5). Ela confere a fonte que o Chrome usou de
verdade contra as `@font-face` carregadas. F1 acusa o texto que pediu uma `@font-face` e saiu em
fonte do sistema, no todo ou em parte: `font-family` inválido, arquivo da fonte que não carrega ou
glifo que a fonte não tem. Nome de família com algarismo, espaço ou símbolo vai entre aspas. No
SVG: `font-family="'Source Serif 4'"`. No CSS: `font-family: "Source Serif 4", serif`. Sem
aspas, o Chrome descarta a declaração sem avisar e o texto cai na fonte herdada. Limites:
- Só a primeira família da pilha conta como pedida: `Arial, "Fonte Web"` pede Arial. Para pedir
  a fonte web, ponha a web primeiro.
- Emoji, bandeira e keycap saem na fonte de emoji de propósito e não contam como glifo que falta.
- Elemento com um `<span>` de outra fonte não recebe o aviso de glifo parcial. O `<span>` é
  avaliado sozinho se ele mesmo pediu uma `@font-face`.
- O nome inválido é lido de `<style>`, `style=""` e do atributo SVG, não do atalho `font:` nem de
  `<link rel=stylesheet>`. Texto desenhado em `<canvas>` ou imagem o lint não vê.
- O aviso sai uma vez por elemento.

O `camera.mjs` mede o objeto filmado (`--el`). Filme sem aparelho filmado (tipografia e marca,
sem celular nem tela de app) não tem o que passar em `--el`. Nele, Z1 e Z2 não se aplicam. Escreva isso
no NOTE.md. A regra "Câmera contida" (no máximo 1,5x o plano-base) continua: meça o maior zoom
do filme e escreva o número.

**7. Som.** Música: `node --env-file=<.env> gerar-trilha.mjs <nome>` (Lyria 3 Pro, o pedido
aprovado; grava em `film/assets/musica/`). Depois
`node gerar-som.mjs <events.json de um --still> --total <duração> --musica assets/musica/<nome>.mp3`:
a música 20 dB sob a voz (`--abaixo`), efeitos por código e a mistura. Sem `--musica`, a
trilha de código (só se não houver saldo no Gemini). O toque e o sopro gravados
(`--toque`, `--ar`, sons CC0 em `kit/efeitos-gravados/`) estão em teste. Não use sem o Jose
aprovar o A/B de 19/10/2026 (`kit/efeitos-gravados/LEIA-ME.md`).

**Ver com som antes do render.** Abra o filme no Chrome com `?previa` no endereço
(`file:///<projeto>/film/index-vertical.html?previa`). Aparecem o quadro reduzido, os controles
embaixo (Reproduzir/Pausar, Recomeçar, faixa de tempo, hora e quadro) e o `audio/mix.wav` ao
lado da página. O `currentTime` do áudio dita o tempo do filme, então imagem e som não se
separam. Teclas: Espaço, setas (1 quadro), Shift + setas (1 s), Home e End. Outro som:
`?previa&audio=audio/mix-v2.wav`, ou `preview: { audio }` no `Motion.film` (`false` tira o som).
Voz posicionada por cena: `?previa&audio=audio-filme/mix.wav`. Use antes do render final e para
mostrar ao Jose. Não use uma página com `<iframe>`: em `file://` ela não alcança o `__seek` do
filme no Chrome. Filme com 3D ou Lottie pede o Chrome aberto com `--allow-file-access-from-files`,
ou um servidor local. O `render.mjs`, o `autoteste.mjs` e o `erros.mjs` nunca abrem esse modo.

**8. Render**, um formato de cada vez:
```bash
bash "$SKILL/scripts/render_partes.sh" film/index-vertical.html film/final-9x16.mp4 --dur <s> --audio film/audio/mix.wav -- --shutter 180 --subframes 8
```
Mais rápido, com a mesma imagem (2 Chromes em paralelo, GPU fixa, trava de memória):
```bash
node "$SKILL/scripts/render-trechos.mjs" film/index-vertical.html film/final-9x16.mp4 --audio film/audio/mix.wav --shutter 180 --subframes 8
```
Ele guarda cada trecho em `film/cache-render/`. Se o filme mudar sem mudar de duração, rode o
mesmo comando: os trechos sem mudança saem do cache. Apague a pasta depois da entrega. Diga ao
Jose a hora prevista de término no começo do render (um trecho de 5 s leva de 94 a 136 s).

**Outro render na máquina.** Dois renders juntos disputam a memória e derrubam o Chrome. No
início, o `render-trechos.mjs` lista os processos. Para cada `render.mjs`, `render-trechos.mjs` ou
`render-rapido.mjs` vivo, avisa o pid e a linha de comando. Ele não mata nada. Com o aviso na tela,
espere o outro terminar. A espera por memória livre (`--memoria`, padrão 3 GB) tem fim:
`--esperar-memoria MIN` (padrão 10 minutos, aceita fração, 0 não espera). O script sai com
**código 3** (0 ok, 1 falha, 2 uso errado) em 2 casos: a espera passou do tempo, ou o mesmo trecho
falhou 4 vezes com a memória baixa. A última linha da saída é o comando do `render_partes.sh`
para o mesmo filme e a mesma saída. Rode esse comando, ou pergunte ao Jose: o script não troca de
motor sozinho. O
`render_partes.sh` roda um Chrome por vez, sem cache e sem fixar a GPU, e não tem `--de` nem
`--ate`. Os pixels saem um pouco diferentes dos do `render-trechos.mjs`. Caso: comercial de 30 s
em 9:16, com outra sessão renderizando ao mesmo tempo. O trecho falhou 4 vezes, com 1,43 a 1,50 GB
livres. O `render_partes.sh` terminou em 11 min 43 s.
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

O T2 mede a tinta das letras (acento, cedilha, til e a descendente do "j" entram na conta), não a
caixa da fonte, que é maior. Título em máscara `overflow: hidden` com a tinta inteira não acusa
mais. Letra cortada de verdade acusa "CORTADO". Na Inter Bold, o acento de maiúscula sobe 0,95 em
e a descendente do "j" desce 0,22 em: máscara de 1 linha com "Á" e "j" pede cerca de 1,17 em de
altura. Com `line-height: 1`, as duas saem da máscara (9 px e 8 px a 100 px), e o T2 acusa com
razão. Use `line-height` de 1,2 ou mais, ou `padding` na máscara. Título só em maiúsculas cabe com
`line-height` apertado (0,85). Limites:
- Texto com `rotate`, `skew`, espelho vertical, 3D ou `writing-mode` vertical volta à regra da
  caixa da fonte. Ela acusa a mais, nunca a menos: título girado com a tinta inteira numa máscara
  justa ainda acusa. Olhe o recorte.
- Justificação, fonte de reserva na linha e escala diferente nos dois eixos também voltam à regra
  da caixa.
- Só a vertical é refinada. `text-transform: capitalize` e `font-variant` não entram na conta.

**10. Entrega.** `film/NOTE.md` com os números de cada portão (e o que é real e o que é
ilustrativo), `LEIA-ME.md` do projeto (o que sai, como refazer, onde mexer), entrada em
`tarefas.md` do cliente. Dizer que ninguém ouviu.

A legenda sai em toda entrega. O `.srt` sai de `node gerar-legenda.mjs --formato 16x9`, rodado na
pasta do projeto: ele usa o texto do `roteiro.json` e o tempo de `film/assets/fala.js`. O MP4
legendado (`scripts/legendar.mjs`) é um 2º arquivo, para quem assiste sem som. O MP4 sem legenda
continua sendo o filme.
```bash
node gerar-legenda.mjs --formato 16x9                   # film/legenda-16x9.srt (com --formato 9x16: film/legenda-9x16.srt)
node "$SKILL/scripts/legendar.mjs" film/final-16x9.mp4 film/legenda-16x9.srt film/final-16x9-legendado.mp4
```
O `legendar.mjs` tira o formato do tamanho do vídeo (paisagem = 16x9, retrato = 9x16). Se o `.srt` tem
linha maior que o limite desse formato (28 caracteres no 9x16; 42 no 16x9), ele para com erro: gere o
`.srt` com o `--formato` do vídeo. As opções do `gerar-legenda.mjs` vão com espaço (`--formato 9x16`);
opção desconhecida ou resultado sem nenhuma legenda sai com erro. Se o app ocupa só parte do quadro, `--margem-esq` e
`--margem-dir` põem a legenda embaixo dele.

**Legenda no 9:16 de Reels.** O padrão do 9x16 deixa 260 px embaixo: a legenda de 2 linhas fica
em y 1530 a 1660. O roteiro de Reels reserva y 250 a 1500, então a legenda cai fora da área
segura. Suba com `--margem-baixo N`, a distância em pixels inteiros entre o pé da legenda e a
borda de baixo. Filme 9:16 que vai para Reels ou Stories leva essa opção ou o `legenda.js`
(abaixo); não deixe a legenda no padrão.
```bash
node "$SKILL/scripts/legendar.mjs" film/final-9x16.mp4 film/legenda-9x16.srt film/final-9x16-legendado.mp4 --margem-baixo 420   # pé da legenda em y 1500
```
- A unidade é a grade do `.ass`: 1080x1920 no 9x16 e 1920x1080 no 16x9. Num vídeo de outro
  tamanho, o libass escala a grade. Padrão sem a opção: 30 no 16x9 e 260 no 9x16.
- Valor decimal (420.5), negativo ou vazio sai com código 1. As margens laterais também só aceitam
  inteiro.
- Margem em que o maior bloco do `.srt` não cabe no quadro também sai com código 1, e a mensagem
  diz o máximo. No 9x16 com contorno, o máximo é 1863 com 1 linha, 1809 com 2 e 1755 com 3. Sem
  essa recusa, o bloco passaria do topo e a 1ª linha sairia do quadro.
- Com `--estilo caixa`, a caixa vai uns 14 px abaixo do pé do texto. Some 14 à margem para manter
  a caixa acima da linha segura.

**Legenda que o filme desenha.** Use quando a legenda pede estilo próprio (fonte da marca,
animação) ou quando o filme não pode ser recodificado. Grave um `.js` no lugar do `.srt`. A
extensão `.js` do `--saida` liga o modo; qualquer outra extensão grava `.srt`.
```bash
node gerar-legenda.mjs --formato 9x16 --saida film/assets/legenda.js
```
O arquivo tem `window.LEGENDA = [{a, b, texto}]`: `a` e `b` em segundos do filme, `texto` com `\n`
entre as linhas. São os blocos do `.srt` do mesmo formato (o texto da tela, o tempo da fala). Faça
um `.js` por formato, porque a quebra de linha muda (`legenda-9x16.js` e `legenda-16x9.js`). Rode
de novo quando o roteiro ou a voz mudar. O comando recusa `--saida` igual ao roteiro ou ao
`fala.js`. No filme, cada bloco aparece no relógio dele com `M.show`:
```js
// CSS: #legenda { position: absolute; left: 80px; right: 80px; bottom: 420px; height: 0 }
//      .leg { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; white-space: pre-line }
const host = document.getElementById('legenda');          // dentro do #main; carregue assets/legenda.js antes
for (const b of window.LEGENDA) {
  const el = document.createElement('div');
  el.className = 'leg';
  el.textContent = b.texto;                               // textContent: o texto da tela nunca vira HTML
  host.appendChild(el);
  M.show(el, Math.round(b.a * M.fps), Math.round(b.b * M.fps));
}
```
O `white-space: pre-line` é obrigatório: sem ele o `\n` some. A altura da legenda vem do `bottom`
do CSS, não do `--margem-baixo`. Cada bloco gera um evento `show` no `.events.json`: o `look.py`
lê como corte, e isso não é erro. Não queime o `.srt` em cima de um filme que já desenha a legenda.

O padrão é a legenda sem caixa: letra branca com contorno preto fino e sombra suave (`--estilo contorno`).
O contorno é fino e as letras levam um espaço extra, para as vizinhas não se juntarem.
Escolha o estilo pelo tipo de vídeo:
- **contorno (padrão):** tutorial de tela, comercial, promo e vinheta, com fundo de motion design limpo.
- **caixa (`--estilo caixa`):** filmagem de câmera, fundo com muito detalhe, ou quadro em que o contorno
  não separa a letra do fundo. Olhe os quadros antes de decidir.

`--cor-contorno "#RRGGBB"` troca a cor do contorno e só vale com contorno. `--cor-caixa "#RRGGBB"` troca a cor
da caixa e só vale com caixa. O par errado sai com código 1. `--cor-texto "#RRGGBB"` troca a cor da letra,
nos 2 estilos. Ponha a cor sempre entre aspas: no Git Bash, o `#` sem aspas abre um comentário e o shell corta
o resto da linha. Em filme claro (app claro, fundo claro), letra escura com contorno branco separa melhor do
que letra branca: `--cor-texto "#0B2A66" --cor-contorno "#FFFFFF"`. Olhe 3 ou 4 quadros do legendado: legenda
inteira, com acento, sem cobrir o anel de destaque que a voz está nomeando.

## Portões

| portão | passa | quem mede |
|---|---|---|
| G0 o render existe | duração e som batem com o planejado | `look.py --expect --expect-audio` |
| G1 texto legível | por olho; app em tamanho de celular fica abaixo dos 4% da altura: escolha, dizer no NOTE.md | folha de contato; o T1 mede o que o OCR lê |
| G2 sem quadro vazio | nenhuma sequência de mais de 3 quadros chapados | `look.py` |
| G3 fim curto | final parado de 0,6 a 1,4 s (a marca do fim chegando com o próprio nome na última frase resolve; pulso pequeno não conta como movimento). No tutorial do Jose o fim fica com 1,8 s de marca depois da última palavra e a trilha descendo, a pedido dele ("cortou seco"): o G3 acusa e o NOTE.md diz que é escolha | `look.py` |
| G4 um herói por quadro | por olho | folha de contato |
| G5 sem cromo de página | sem rótulo de canto, contador, barra de progresso | `lint.mjs` |
| F1 fonte usada | o texto sai na fonte que pediu (aviso WARN, não derruba o G5) | `lint.mjs` |
| T1 texto lido | todo texto do HTML que fica parado na tela é lido pelo OCR no MP4 entregue, acento inclusive; nenhum texto passa a vida inteira debaixo de outra peça | `ler.mjs` |
| T2 texto inteiro | nenhum texto fica com pedaço fora do quadro o tempo todo; conta a tinta das letras, não a caixa da fonte | `ler.mjs` |
| Z1 câmera contida | aproximação máxima até 1,5x o plano-base; não se aplica em filme sem aparelho filmado | `camera.mjs` |
| Z2 objeto no quadro | metade ou mais do aparelho à vista na mediana; não se aplica em filme sem aparelho filmado | `camera.mjs` |
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
- **Codificação final: NVENC contra x264, e o x264 ficou** (medido em 28 e 29/10/2026, no mesmo
  vídeo de 30 s, 2 rodadas):
  - x264 `-preset medium -crf 18` (o padrão do `render.mjs`): 5,4 s, 7,3 MB, SSIM 0,99832.
  - NVENC `p7`, `cq 19`: 3,7 s, 29,0 MB, SSIM 0,99911.
  - Reprova pela regra de adoção do `~/.claude/notas/gpu.md`: SSIM igual ou maior, tempo de até a
    metade do x264 e tamanho de até o dobro. A qualidade passa. O NVENC levou 0,68 do tempo do
    x264 e o arquivo saiu 4 vezes maior.
  - O gargalo é a captura (cada foto leva 67 ms), não a codificação. Trocar o codificador não
    acelera o render.
- Regra global do Jose: usar a GPU sempre que der, medindo (`~/.claude/CLAUDE.md`, seção GPU).

## Comercial, promo, anúncio: o método de direção

Ler `references/metodo.md` antes da primeira ideia: os 8 julgamentos do que é
bom, a lista do que nunca entregar (cromo de página, layout de slide, cartão genérico,
número inventado, slogan, fim de rodapé de site, filme que ninguém olhou), as 12 leis de
ofício medidas e o passo a passo (marca, ideia, mundo, roteiro, o momento mais difícil
primeiro, olhar com honestidade, som, entrega). Entrega de rede social: 9:16 e 16:9, o
mesmo filme recomposto para cada quadro (o 16:9 não é o vertical com barras). A voz do
comercial é a mesma do tutorial, Gemini TTS 3.8 Flash: o passo 5 do método diz como.

### Filme feito de filmagem, não de movimento sintético

Vale quando a imagem é vídeo de verdade (gerado ou filmado) e o HTML carrega só texto,
máscaras e marca. Aprendido em 20/10/2026, num comercial de fábrica de massas.

- **Renderize na cadência da filmagem, não em 30.** Cena a 24 qps num filme a 30 faz cada
  quinto quadro repetir, e isso aparece como tranco em movimento lento de câmera. Rodar o
  filme a 24 qps dá um quadro de origem para cada quadro de saída: fluidez máxima, nada
  inventado, e 20% menos quadro para renderizar. Reamostrar com `minterpolate` é pior —
  inventa quadro e custa caro. Confira a cadência da origem
  (`ffprobe -show_entries stream=r_frame_rate`) antes de escolher a do filme.
  **Armadilha:** `render_partes.sh` tem `--fps` próprio, com 30 no padrão, e **ignora** o
  `fps` declarado no `Motion.film()`. Sem passar `--fps 24` o filme sai a 30 e o tranco
  volta inteiro. Confira no arquivo pronto (`ffprobe ... r_frame_rate`), não no código:
  em 20/10/2026 isso custou um render inteiro.
- **Sem obturador.** A regra das 8 fotos por quadro existe para movimento sintético. A
  filmagem já traz o próprio borrão, e o método manda escolher **uma** gramática de borrão
  por filme. Empilhar as duas borra duas vezes e ainda multiplica o render por 8 em cima
  de busca de vídeo, que é o passo mais lento do renderizador.
- **Gere a filmagem já na proporção de entrega.** Cena gerada em 16:9 e recortada para
  9:16 deixa 405 px de largura num 1280x720: 2,67x de ampliação, visivelmente mole. Gerar
  de novo em 9:16 custa o mesmo que a primeira vez. **Decida os formatos antes de gerar o
  primeiro segundo de imagem**, não só antes do primeiro quadro do filme.
- **Meça se a imagem cobre o filme antes de gravar a voz.** Some a duração das cenas e
  compare com a narração planejada. Faltando imagem, as saídas são encurtar o roteiro,
  gerar mais cena ou repetir plano com outro enquadramento. Descobrir isso depois da voz
  pronta custa refazer roteiro.
- O renderizador já segue `<video>` sozinho: põe `currentTime = t - data-start` e espera
  o `seeked` a cada quadro. Não precisa de adaptador.

### Voz num filme que não é tutorial

`kit/vozes/gerar-tomadas.mjs` e `montar.mjs` leem o `roteiro.json` em `join(AQUI, "..")`,
isto é, na pasta **acima da pasta `vozes`**. Para usá-los fora do kit, copie `kit/vozes/` para
`<projeto>/vozes/` **e** `kit/_skill.mjs` para `<projeto>/_skill.mjs` (o `gerar-tomadas.mjs` importa
`../_skill.mjs` para achar a skill). Ponha o `roteiro.json` ao lado da pasta `vozes`. Se a skill não está
em `~/.claude/skills/motionstudio`, defina a variável `SKILL`. O caminho do método (passo 5,
`tts.mjs` direto) gera uma tomada só; o do kit gera várias e escolhe por medida, que é o
padrão de qualidade deste usuário.

**Cenas de tempo fixo (comercial, promo, anúncio).** O `gerar-fala.mjs` aceita um atraso só, e
a voz inteira anda junto. Quando cada cena começa num segundo marcado, use o
`film/posicionar-voz.mjs`. No tutorial, a voz manda no filme e o `gerar-fala.mjs` continua valendo.
1. Dê um `id` a cada linha do `roteiro.json` (`abertura`, `meio`, `fecho`). Marca difícil de ler
   leva `fala` fonética (regra "Nome próprio de marca").
2. Gere e monte a voz: `gerar-tomadas.mjs --tomadas 6` e `montar.mjs` (passo 3).
3. Crie o `tempos.json` ao lado do `roteiro.json`. A chave é o `id` da linha. O valor é o segundo
   do filme em que a primeira palavra começa, não a respiração antes dela:
```json
{
  "_nota": "chave que começa com _ é comentário",
  "abertura": 0.5,
  "meio": 6,
  "fecho": { "inicio": 14, "fim": 17 }
}
```
   `{ "inicio", "fim" }` acrescenta o fim da cena: o script para se a fala passar dele. Ponha o
   início 0,2 a 0,3 s depois da troca de cena, para a fala não colar nela.
4. Copie `kit/film/posicionar-voz.mjs` para `<projeto>/film/` (o `novo-projeto.mjs` já o copia). Rode,
   na pasta do projeto: `node film/posicionar-voz.mjs --duracao <duração do filme em s>`.
   O script corta cada linha no meio do silêncio entre as linhas e a põe no segundo do
   `tempos.json`. A rampa de 12 ms nas pontas cabe no silêncio e nunca apaga fala. Ele grava:
   - `film/audio-filme/vo.wav` (com a duração do filme), `vo.lines.json`, `vo.words.json` e
     `vo.posicao.json` (o plano de cada linha);
   - `film/assets/fala.js` com `offset: 0`, porque os tempos já são do filme.

   Opções (caminhos relativos à pasta `film/`): `--tempos` (padrão `../tempos.json`), `--audio`
   (padrão `audio`), `--saida-audio` (padrão `audio-filme`) e `--saida` (padrão `fala.js`). Sem
   `--duracao`, o filme acaba 1,4 s depois da última fala. `--saida-audio` igual a `--audio` é
   recusado: sobrescreveria o `vo.wav` montado.
5. O script recusa: linha sem tempo, tempo sem linha, linha que começa antes de a anterior
   terminar, fala que passa do fim da cena ou do filme. Ele lista todos os problemas, sai com
   código 1 e não grava nada. Corrija o `tempos.json` ou encurte a frase.
6. Em `film/montar-filmes.mjs`, ponha `dur: <s>` na linha do filme em `FILMES`: a duração tirada
   da última fala não serve em filme de tempo fixo. Rode o `montar-filmes.mjs`.
7. Som: `node gerar-som.mjs <events.json> --audio audio-filme --total <s> --musica ...`. A
   mixagem sai em `film/audio-filme/mix.wav`: passe esse caminho ao `render_partes.sh --audio` e
   ao `?previa&audio=`. Passe `film/audio-filme/sfx-eventos.json` ao `ouvir.py --sfx`. O
   `--roteiro` do `ouvir.py` continua `film/audio/vo.txt`.
8. A legenda (`gerar-legenda.mjs`) lê o `fala.js` já posicionado: não some offset. Para medir a
   entonação, rode `node "$SKILL/scripts/entonacao.mjs" film/audio-filme/vo.wav`: ele acha o
   `vo.words.json` e o `vo.lines.json` ao lado do áudio.
9. Rode o `ouvir.py`. Se o S4 acusar variação entre frases, veja o espalhamento que o
   `montar.mjs` imprimiu.

O `entonacao.mjs` aceita o `--lines` em dois formatos: `{ text, start, end }` (o `montar.mjs` e o
`voice.py`) e `{ t, a, b }` (os campos de `FALA.linhas`, no `fala.js`). O `--words` aceita
`{ word, start, end }` (o `voice.py`), `{ w, a, b }` (os campos de `FALA.palavras`) e
`{ p, ini, fim }`. Campo faltando ou texto vazio: o script sai com código 1. Ele diz o campo e o
índice do item (a partir de 0) e não decodifica o áudio.

## Caso de referência

Tutorial de primeiros passos de um app de aprovação (16/10/2026), no repositório do
cliente (caminho em `LOCAL.md`; `LEIA-ME.md` e `film/NOTE.md` do projeto). Captura do
app com API simulada (`capturar.mjs`, `app/dados.mjs`), longo de 3 min 50 s e curto de
59,5 s em 9:16 nos dois temas, passeio por Ajustes, simulação do iPhone, fecho com a marca
chegando no nome.

## Arquivos

| arquivo | para |
|---|---|
| `kit/` | o projeto de tutorial (`novo-projeto.mjs` copia para a pasta do filme; `LEIA-ME.md`); `kit/film/posicionar-voz.mjs`: a voz no segundo de cada cena, para filme de tempo fixo; `kit/efeitos-gravados/`: 3 sons CC0 em teste |
| `scripts/` | `render.mjs`, `render_partes.sh`, `render-trechos.mjs` (o render_partes em paralelo, com cache; usa `_pagina.mjs`), `trocar-trecho.sh`, `look.py`, `lint.mjs`, `camera.mjs`, `ouvir.py`, `ler.mjs` (texto lido no MP4, pelo OCR do Windows em `ocr-windows.ps1`), `erros.mjs` (as exceções da página, antes do autoteste), `entonacao.mjs`, `pausas.mjs`, `mix.py`, `legendar.mjs` (grava o `.srt` no MP4 com o ffmpeg; `--margem-baixo` sobe a legenda no 9:16), `voice.py` (só as ferramentas de áudio local: `split`, `refine`, `music-fit`; a voz sai do `kit/vozes/tts.mjs`), `brand.mjs`, `fetch_logo.mjs`, `providers.sh`, `_cdp.mjs` (Chrome por CDP) |
| `runtime/` | o motor de animação (`motion.js`, API em `runtime/README.md`; `M.render` e o modo `?previa` incluídos) |
| `library/` | `moments.jsonl` (precedentes de movimento) e `lottie/` (5 ícones animados feitos à mão, `_cor.js` com o `LOTTIE.cor`, `_gerar.mjs` que grava os ícones e `LICENCAS.md`) |
| `references/` | o método de direção (`metodo.md`) e os guias de ofício, em inglês |
| `taste/` | os vereditos do Jose e os antes e depois (fora do git) |
| `historico/` | o porquê de cada regra local, com data e caso (fora do git) |
| `LOCAL.md`, `ORIGEM.md` | casos de cliente, caminhos, candidatos em avaliação, de onde veio cada parte e o que falta (fora do git) |
| `LICENSE`, `NOTICE` | a licença e o único lugar com as atribuições de terceiros |
