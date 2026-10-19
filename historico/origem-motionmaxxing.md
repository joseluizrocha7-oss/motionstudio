# De onde veio esta cópia

- Repositório: https://github.com/Tejashmakwana/motionmaxxing (licença Apache-2.0)
- Versão instalada: commit `8c8ec0f2a6f6c9a0da15cd24f7b1298ab298368c`, de 06/10/2026
- Instalada em 13/10/2026, por cópia (o mesmo que `install.sh --copy`: sem a pasta `.git` e sem `docs/media`)

O `install.sh` do repositório não foi usado: ele exige `python3` e acha o
Chrome só em caminhos de macOS e Linux, então nesta máquina recusa instalar.

## O que foi conferido antes de instalar

Leitura do `install.sh`, do `scripts/providers.sh`, do `SKILL.md` inteiro e
uma varredura nos demais scripts e textos. O que os scripts fazem:

- abrem o Chrome em modo sem janela, com perfil temporário próprio (não usam o perfil do usuário);
- chamam `ffmpeg` e `ffprobe`;
- falam com `api.elevenlabs.io` (voz, efeitos e música, com a chave do usuário), `api.svgl.app` e `cdn.jsdelivr.net` (logos), e com o site da marca que for pedido;
- `imagegen.py` chama o `codex` da máquina para gerar imagem (usa a conta do usuário).

Não achei envio de dado para outro lugar, instrução escondida nem comando destrutivo.

## O que foi mudado nesta cópia

Só uma nota no topo do `SKILL.md` ("Nota local desta máquina"), com os dois
ajustes que o Windows exige. (Era assim na instalação; desde a noite de
13/10/2026 a pasta está sob git, ver "Como atualizar" no fim.)

## O que foi mudado nesta cópia, por data

Em 13/10/2026, depois de o Jose reprovar a narração de um vídeo por entonação:

- `scripts/voice.py`: no `vo`, `--stability`, `--similarity` e `--style` deixaram de ter padrão fixo (0,5 / 0,75 / 0). Sem a opção, o script lê os ajustes da própria voz na ElevenLabs e usa estabilidade no máximo 0,35 e estilo no mínimo 0,3, e imprime o que usou. As três mudanças estão marcadas com `LOCAL CHANGE (2026-10-13)`.
- `scripts/entonacao.mjs`: novo. Mede a entonação da narração linha a linha e lista os alertas.
- `scripts/entonacao.mjs`, na mesma noite: passou a conferir a pausa depois de cada vírgula, dois-pontos e ponto DENTRO da linha (o filme da SM STORE foi reprovado por "falar como se não tivesse pontuação" tendo passado na medida).
- `scripts/pausas.mjs`: novo. Alonga o silêncio depois de cada sinal de pontuação no som já gerado e grava os tempos deslocados.
- `SKILL.md`: a nota local do topo ganhou o item da voz.
- `taste/verdicts.md` e `taste/edits.md`: o veredito do Jose e o antes e depois medidos.

Em 13/10/2026, depois do primeiro filme feito com ela (Swipes "22% acima") e de o Jose reprovar a versão 16:9:

- `SKILL.md`: a nota local do topo ganhou os três tropeços do runtime e dos scripts e o item do formato (vertical para rede social, render em três partes).
- `taste/verdicts.md` e `taste/edits.md`: o veredito do Jose sobre o enquadramento e o antes e depois.

Em 13/10/2026, a pedido do Jose ("não precisa criar duas versoes a leve e a final, cria apenas a versão da melhor resolução, o que é bom criar sempre é a versão 9:16 e 16:9"):

- `SKILL.md`, nota local: item novo "Entrega" e, no item "Formato", a linha do 16:9.
- `SKILL.md`, corpo: os passos 6, 7, 8 e 9 e a linha "Format" dos padrões foram alterados no próprio texto, marcados com `LOCAL CHANGE (2026-10-13)`. Dois arquivos por filme (`index-vertical.html`, `index-horizontal.html`), um render por formato em resolução cheia, sem `draft.mp4`, e o som juntado com `ffmpeg -c:v copy` em vez de um segundo render.
- `taste/verdicts.md`: o pedido, com a data.

Em 13/10/2026, à noite, na revisão da skill inteira (pergunta do Jose: "pode ser melhorada além do que já melhoramos?"). O ponto de partida: os seis filmes que ele reprovou tinham passado em todos os portões G0-G5, e as duas correções do Reels da Conplan nem estavam registradas aqui.

- `scripts/camera.mjs`: novo. Mede o quanto a câmera chega perto e quanto do objeto filmado cabe no quadro (portões Z1 e Z2). Testado no Reels aprovado (1,34x, PASS), na câmera da versão reprovada refeita numa cópia (4,46x, ALERTA) e no exemplo `examples/phone` da própria skill (Z2 ALERTA).
- `scripts/ouvir.py`: novo. Transcreve o arquivo final e confere fala, pausas, sincronia entre fala e tela e mixagem (portões S1 a S4). Testado no Reels aprovado (os quatro PASS) e num áudio com os defeitos das versões reprovadas refeitos de propósito (os quatro ALERTA).
- `scripts/render_partes.sh`: novo. O render inteiro em trechos, com conferência e repetição. Substitui o `final.sh` escrito à mão em cada filme.
- `scripts/voice.py`: o `split` passou a nivelar o volume das frases (`--no-level` desliga); a chave da ElevenLabs passou a ser procurada também no `.env` das pastas acima, e ali só vale linha que cite a ElevenLabs.
- `scripts/_cdp.mjs` e `scripts/providers.sh`: acham o Chrome no Windows; o `providers.sh` acha o Python (`py -3`) e a chave nas pastas acima.
- `SKILL.md`: nota local (portões desta máquina, câmera contida, som enxuto, fala e tela juntas, os dois recursos de pausa), tabela nova em "Gates" e os passos 5 a 9, tudo marcado com `LOCAL CHANGE (2026-10-13)`.
- `references/tools.md`: seção "Local additions" no fim.
- `taste/verdicts.md` e `taste/edits.md`: os dois vereditos do Reels da Conplan, que tinham ficado só na memória daquele projeto, e a contagem das reprovações contra os portões.

## Como atualizar sem perder o que é daqui

> A pasta `~/.claude/skills/motionmaxxing` foi excluída em 19/10/2026. Os comandos abaixo
> valem para a cópia em `~/.claude/backups/regras-2026-10-19/motionmaxxing.tar.gz`, depois
> de extraída.

A pasta é um repositório git desde 13/10/2026. O ramo `upstream` é o commit `8c8ec0f` do repositório original; o ramo `local` é ele mais as mudanças desta máquina, um commit por rodada. A pasta `docs/media` (vídeos de demonstração) nunca foi instalada e fica fora, por `sparse-checkout`.

- Ver o que é daqui: `git -C ~/.claude/skills/motionmaxxing diff --stat upstream local`.
- Trazer uma versão nova do original: `git fetch --filter=blob:none origin main`, depois `git branch -f upstream FETCH_HEAD` e `git merge upstream` no ramo `local`. Onde o original tiver mexido no mesmo trecho, o git mostra o conflito em vez de apagar a mudança local.
- Desfazer uma rodada: `git revert <commit>`.
- Nada é enviado para fora: não há `push` configurado para este uso, e o repositório original é de outra pessoa.

Na mesma noite, depois do teste do texto (dois agentes sem contexto, um com o `SKILL.md` de antes e outro com o de depois, o mesmo roteiro com quatro armadilhas já reprovadas):

- Com o texto de antes, o agente manteve o macro de 3x, manteve a trilha abaixando 9 dB a cada fala, manteve a narração dizendo outra coisa que os balões e não transcreveu o arquivo final. Com o de depois, mudou os quatro e rodou `camera.mjs`, `render_partes.sh` e `ouvir.py`. É uma amostra de cada, não uma estatística.
- O agente do texto novo apontou quatro trechos ambíguos, corrigidos no `SKILL.md`: o que conta como "pedido do usuário" para passar do limite da câmera, a ordem entre a foto e a medição, dizer na entrega o que foi mudado no roteiro, e o que o S4 não enxerga.
- `scripts/mix.py`: avisa quando recebe `--duck`. Uma medida da trilha pelo grave foi testada no `ouvir.py` e tirada, porque deu o sinal trocado no filme de teste (a voz e os efeitos também têm energia ali).
