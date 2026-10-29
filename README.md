<div align="center">

# motionstudio

**Vídeo por código, com qualidade de motion designer e conferência automática.**

Uma skill para agentes de IA (Claude Code e qualquer agente que leia uma pasta com `SKILL.md`).
Ela faz tutorial de app, comercial, anúncio, vinheta e vídeo de lançamento em pt-BR, com a voz
do Gemini TTS 3.8 Flash, e confere o arquivo entregue antes de dizer que terminou.

<br>

[![Skill](https://img.shields.io/badge/skill-SKILL.md-111111?style=flat-square)](SKILL.md)
[![Voz](https://img.shields.io/badge/voz-Gemini%20TTS%203.8%20Flash-1A73E8?style=flat-square)](#voz-gemini-tts-38-flash)
[![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square)](#requisitos)
[![Render](https://img.shields.io/badge/render-Chrome%20%2B%20ffmpeg-4285F4?style=flat-square)](#requisitos)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-Apache--2.0-blue?style=flat-square)](LICENSE)

[O que ela faz](#o-que-ela-faz) · [Voz](#voz-gemini-tts-38-flash) · [Como funciona](#como-funciona) · [Portões](#portões) · [Instalação](#instalação) · [Como pedir](#como-pedir) · [Arquivos](#mapa-do-repositório) · [Limites](#limites-conhecidos)

</div>

<br>

## O que ela faz

| pedido | o que sai |
|---|---|
| Tutorial de app, onboarding, treinamento de sistema | Vídeo com as telas reais do app, toques, gestos, simulação do iPhone e voz que explica passo a passo |
| Comercial, promo, anúncio para rede social | Filme com uma ideia, um mundo com luz e textura, movimento medido e corte no movimento |
| Vinheta de marca, vídeo de lançamento | Peça curta de tipografia e marca, com fim curto e a marca chegando com o próprio nome |
| Corrigir ou criticar um vídeo | Os portões rodados no arquivo, a lista do que falha e a correção |

O que é igual em todos:

- **Roteiro e voz em pt-BR.** A voz sai do Gemini TTS 3.8 Flash. O agente gera várias tomadas e escolhe frase a frase, pela medida.
- **Filme em HTML.** Cada animação fica presa a uma palavra da voz. O render é quadro a quadro, pelo Chrome e pelo ffmpeg.
- **Uma fonte, várias versões.** Longo e curto, modo escuro e claro, 9:16 e 16:9 saem da mesma fonte, só por configuração.
- **Trilha e efeitos por código.** Por padrão, nada de banco de música ou de efeitos.
- **Legenda, quando a voz sai do kit.** Com o `roteiro.json` e o `fala.js` do kit, o `kit/gerar-legenda.mjs` faz o `.srt` com o texto do roteiro e o tempo da fala (`film/legenda-16x9.srt` ou `film/legenda-9x16.srt`). O `scripts/legendar.mjs` grava esse `.srt` num segundo MP4, legendado, para quem assiste sem som. O `legendar.mjs` tira o formato do tamanho do vídeo. A legenda sai sem caixa, com contorno preto e sombra suave: serve para tutorial de tela, comercial, promo e vinheta com fundo limpo. Em filmagem de câmera ou fundo com muito detalhe, use `--estilo caixa`. `--cor-contorno` e `--cor-caixa` trocam a cor, cada uma só no seu estilo, e `--cor-texto` troca a cor da letra (em filme claro, letra escura com contorno branco separa melhor). No 9x16 a linha é mais curta: gere o `.srt` com o `--formato` do vídeo.
- **Conferência no arquivo entregue.** Imagem, texto, câmera, som e tela vazia são medidos por script. O agente nunca certifica o filme só pelo olho.

## Voz: Gemini TTS 3.8 Flash

Toda narração da skill sai do modelo `gemini-3.8-flash-tts`, pela Interactions API do Gemini
(`POST https://generativelanguage.googleapis.com/v1beta/interactions`).

| peça | o que faz |
|---|---|
| [`kit/vozes/tts.mjs`](kit/vozes/tts.mjs) | Um pedido ao Gemini TTS: texto, voz e estilo de leitura. Grava um WAV. |
| [`kit/vozes/gerar-tomadas.mjs`](kit/vozes/gerar-tomadas.mjs) | N tomadas por bloco do roteiro. A voz recebe o bloco inteiro: assim sabe de onde a frase vem e para onde vai. |
| [`kit/vozes/alinhar.py`](kit/vozes/alinhar.py) | O tempo de cada palavra. O Gemini não devolve esse tempo; o Whisper local mede, e o texto que vale é o do roteiro. |
| [`kit/vozes/montar.mjs`](kit/vozes/montar.mjs) | Escolhe a melhor tomada de cada frase, guarda a respiração, nivela em -20 LUFS e emenda com as pausas do roteiro. |
| [`kit/vozes/listar-vozes.mjs`](kit/vozes/listar-vozes.mjs) | Lista as vozes pt-BR disponíveis. Só leitura, não gera áudio. |

Configuração no `roteiro.json` do projeto:

```json
"voz": { "id": "pt-br-podcaster-6", "modelo": "gemini-3.8-flash-tts" }
```

Uma tomada avulsa:

```bash
node --env-file=.env kit/vozes/tts.mjs --texto "Toque em Entrar." --saida tomada.wav \
  --voz pt-br-training-1 --estilo "Instrutor calmo, ritmo tranquilo, fim de frase descendo."
```

Regras da voz:

1. Ponha a chave em `GEMINI_API_KEY`, num `.env` fora do repositório. Passe o arquivo com `node --env-file=<arquivo>`.
2. Gere só o necessário: cada tomada gasta saldo da API.
3. Se a frase termina em nome de botão, escreva o nome em minúsculas na `fala`. Ou reescreva a frase para terminar em verbo. Nome de botão no fim tende a subir o tom.
4. Escreva sigla e número como se fala: "T.I." vira "tê í", "90" vira "noventa".
5. A transcrição confere a fala, mas não valida pronúncia de nome próprio nem tom. Isso pede ouvido humano, e a entrega diz isso.

## Como funciona

O caminho do tutorial de app, o caso mais comum:

1. **Projeto.** `node kit/novo-projeto.mjs <pasta>` copia o kit para a pasta do filme.
2. **Roteiro.** Blocos por passo, na ordem de quem acabou de receber o acesso: boas-vindas, entrar, configurar, usar no dia a dia, fecho.
3. **Voz.** Tomadas no Gemini TTS 3.8 Flash, escolha frase a frase e tempo de cada palavra (seção acima).
4. **Telas.** Fotos do app de verdade, operado num Chromium com API simulada e dados fictícios. Cada alvo de toque leva a sua caixa medida.
5. **Filme.** `film/fonte/` vira os `index-*.html` de cada versão. Cada mudança na tela fica presa a uma palavra (`pal('e2', 'Entrar')`).
6. **Conferência antes do render.** Autoteste, tela vazia, câmera, lint e fotos de quadros escolhidos.
7. **Som.** Trilha e efeitos sintetizados, misturados com a voz em -16 LUFS.
8. **Render.** Um formato por vez, em resolução cheia, com desfoque de movimento de 8 fotos por quadro.
9. **Portões no MP4 entregue.** Folha de contato, transcrição da fala e leitura do texto por OCR.
10. **Entrega.** `film/NOTE.md` com os números de cada portão, `LEIA-ME.md` do projeto e a legenda (`.srt` e o MP4 legendado).

Os comandos de cada passo estão em [`kit/LEIA-ME.md`](kit/LEIA-ME.md). As regras completas estão em [`SKILL.md`](SKILL.md).

Comercial, promo e vinheta seguem o método de direção em [`references/metodo.md`](references/metodo.md): a ideia, o mundo, o roteiro, o momento mais difícil primeiro, o som e a entrega.

## Portões

Um portão que falha se corrige. Um alerta que vem de erro da transcrição se prova medindo e vai para o `NOTE.md` com a medida.

| portão | passa quando | quem mede |
|---|---|---|
| G0 o render existe | Duração e som batem com o planejado | `look.py` |
| G1 texto legível | O texto se lê na folha de contato | olho; o T1 mede o que o OCR lê |
| G2 sem quadro vazio | Nenhuma sequência de mais de 3 quadros parados | `look.py` |
| G3 fim curto | Final parado de 0,6 a 1,4 s | `look.py` |
| G4 um herói por quadro | Um foco por quadro | olho, na folha de contato |
| G5 sem cromo de página | Sem rótulo de canto, contador ou barra de progresso | `lint.mjs` |
| T1 texto lido | Todo texto parado do HTML é lido pelo OCR no MP4, acento incluído | `ler.mjs` |
| T2 texto inteiro | Nenhum texto fica com pedaço fora do quadro | `ler.mjs` |
| Z1 câmera contida | Aproximação máxima de 1,5x o plano-base | `camera.mjs` |
| Z2 objeto no quadro | Metade ou mais do aparelho à vista na mediana | `camera.mjs` |
| autoteste | 0 divergências entre tocar e saltar para um quadro | `kit/autoteste.mjs` |
| tela vazia | Nenhum instante com o celular sem foto | `kit/tela-vazia.mjs` |
| leitura | Sem alerta em frase de impacto e pausa onde há pontuação | `entonacao.mjs` |
| S1 a S4 | Fala inteira, pausas no lugar, fala e tela juntas, mistura enxuta | `ouvir.py` |

## Requisitos

- **Node 22 ou mais novo.**
- **Python 3** com `numpy` e `faster-whisper` (alinhamento da voz e conferência da fala). No Windows, chame com `py -3`.
- **ffmpeg** no PATH.
- **Google Chrome** (render e captura, por CDP).
- **Chave do Gemini** em `GEMINI_API_KEY` (voz).
- **Windows** para o `ler.mjs`: ele usa o OCR do próprio Windows (`scripts/ocr-windows.ps1`). No Windows, rode os comandos no Git Bash.
- Opcional: Codex CLI com geração de imagem (`scripts/imagegen.py`), para superfícies geradas no comercial.

## Instalação

**Claude Code**

```bash
git clone https://github.com/joseluizrocha7-oss/motionstudio ~/.claude/skills/motionstudio
bash ~/.claude/skills/motionstudio/scripts/providers.sh     # confere Chrome, ffmpeg, Python e disco; não instala nada
```

**Claude Code, pelo `npx skills add`.** O CLI [`skills`](https://www.npmjs.com/package/skills) copia a skill para o projeto. Use a versão `1.7.1`, a que foi testada. Rode na pasta do projeto:

```bash
npx -y skills@1.7.1 add joseluizrocha7-oss/motionstudio --agent claude-code --skill motionstudio --copy -y
```

O comando cria `.claude/skills/motionstudio/` e um `skills-lock.json` na pasta atual. O `--copy` grava os arquivos de verdade, não atalhos. Sem o `-y`, o CLI faz perguntas.

Para instalar em todos os projetos, acrescente `-g`:

```bash
npx -y skills@1.7.1 add joseluizrocha7-oss/motionstudio --agent claude-code --skill motionstudio --copy -g -y
```

Este comando vem do `--help` do CLI e não foi testado. Ele grava em `~/.claude/skills/motionstudio`. Se você já clonou a skill nessa pasta, não rode: a cópia ocupa o lugar do clone.

**O que a cópia não traz.** `LOCAL.md`, `historico/` e `taste/` (menos o `taste/LEIA-ME.md`) são da máquina do dono da skill e ficam fora do git. Quem instala começa sem eles. O `taste/LEIA-ME.md` explica como registrar os seus vereditos.

**Como os scripts acham a skill.** O `kit/novo-projeto.mjs` copia os scripts do kit para o projeto e grava ali o `motionstudio.json`:

```json
{ "skill": "/caminho/da/pasta/.claude/skills/motionstudio" }
```

O caminho é absoluto e aponta para a skill que rodou o `novo-projeto.mjs`. O `autoteste.mjs`, o `tela-vazia.mjs` e a voz (`vozes/gerar-tomadas.mjs`) procuram a skill nesta ordem:

1. A variável de ambiente `SKILL`, se existir.
2. O primeiro `motionstudio.json` que achar, na pasta do script e em até 6 pastas acima.
3. `~/.claude/skills/motionstudio`.

Para usar outra cópia da skill, defina a variável. Ela vale mais que o `motionstudio.json`:

```bash
export SKILL=/caminho/da/outra/skill
```

Se você mover o projeto para outra máquina, edite o caminho no `motionstudio.json`. Também serve apagar o arquivo e rodar o `novo-projeto.mjs` da skill nova na mesma pasta: ele só recria o que falta.

**Outros agentes.** A skill é uma pasta com `SKILL.md` na raiz. Aponte o agente para a pasta (ou copie para a pasta de skills dele) e dê acesso ao terminal.

## Como pedir

No Claude Code, use `/motionstudio` ou peça em linguagem normal.

> /motionstudio faça um tutorial de primeiros passos do nosso app em 9:16, com voz. Quero ver o roteiro resumido antes de gastar com a voz.

> /motionstudio um anúncio de 20 s para o site https://exemplo.com.br, em 9:16 e 16:9.

> /motionstudio aqui está o `final.mp4` e o `index.html`. Rode os portões, diga o que falha e corrija.

O que você recebe:

| arquivo | o que é |
|---|---|
| `film/final-9x16.mp4`, `film/final-16x9.mp4` | O filme, com som |
| `film/legenda-16x9.srt`, `film/legenda-9x16.srt`, `film/final-*-legendado.mp4` | A legenda e o MP4 com ela gravada, para quem assiste sem som |
| `film/index-*.html` | A fonte editável, reproduzível quadro a quadro |
| `film/NOTE.md` | O relato: o que é real e o que é ilustrativo, os números de cada portão e o que ainda falta |
| `LEIA-ME.md` do projeto | O que sai, como refazer e onde mexer |

## Mapa do repositório

| pasta ou arquivo | para |
|---|---|
| [`SKILL.md`](SKILL.md) | As regras que o agente segue, o passo a passo e os portões |
| [`kit/`](kit/) | O projeto de tutorial de app: roteiro, voz, filme por fonte única, som, autoteste e tela vazia |
| [`kit/vozes/`](kit/vozes/) | A voz: Gemini TTS 3.8 Flash, alinhamento e montagem frase a frase |
| [`scripts/`](scripts/) | Render, portões e ferramentas: `render.mjs`, `render_partes.sh`, `trocar-trecho.sh`, `look.py`, `lint.mjs`, `camera.mjs`, `ouvir.py`, `ler.mjs`, `entonacao.mjs`, `pausas.mjs`, `mix.py`, `sync.mjs`, `brand.mjs`, `legendar.mjs`, `providers.sh` |
| [`runtime/`](runtime/) | O motor de animação que volta a qualquer quadro (`motion.js`; API em `runtime/README.md`) |
| [`references/`](references/) | O método de direção e os guias de ofício (movimento, tipografia, mundo, som, câmera), em inglês |
| [`library/`](library/) | Precedentes de movimento por tipo de momento (`moments.jsonl`) e ícones animados feitos à mão para as peças do painel (`lottie/`, com `LICENCAS.md`) |
| [`templates/`](templates/), [`examples/`](examples/) | Ponto de partida de um filme e exemplos que rodam |
| [`taste/`](taste/) | Lugar dos vereditos do dono da skill (o que aprovou e reprovou); ficam fora do git |
| [`NOTICE`](NOTICE), [`LICENSE`](LICENSE) | Atribuições e licenças |

## Limites conhecidos

- **Ninguém ouviu.** A fala é conferida por transcrição e medida. Pronúncia de nome próprio e tom só o ouvido humano valida.
- **O render é lento.** A captura tira uma foto por vez, e a GPU não acelera esse passo. Medido: 36 s para 60 quadros com 8 fotos cada. Um filme de 4 minutos leva cerca de 1 h 10 min.
- **Um formato por vez.** Dois Chromes de render juntos esgotam uma máquina de 16 GB.
- **O `ler.mjs` só roda no Windows.** Em outro sistema, o T1 e o T2 ficam sem conferência, e o `NOTE.md` diz isso.
- **A simulação do iPhone é ilustrativa.** O Safari e a Tela de Início são desenhados. O `NOTE.md` diz o que é foto real e o que é desenho.
- **Um portão que passa é o piso, não o gosto.** Os scripts dão números. A escolha do que é bom continua com quem pediu o filme.

## Licença

Apache License 2.0 ([`LICENSE`](LICENSE)). As obras e os componentes de terceiros incluídos, cada um com a própria licença, estão listados em [`NOTICE`](NOTICE).
