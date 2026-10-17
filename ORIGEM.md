# De onde veio cada parte da motionstudio

Criada em 16/10/2026, a pedido do Jose ("vamos usar o melhor dos dois e criar a nossa
skill"), a partir de:

| parte | origem | licença |
|---|---|---|
| `references/`, `runtime/`, `scripts/` (menos os listados abaixo), `taste/`, `templates/`, `examples/`, `library/`, `studies/`, `docs/` | motionmaxxing, commit `8c8ec0f` do original mais o ramo `local` desta máquina até `024b8d2`, e as alterações ainda não commitadas lá em 16/10/2026 (SKILL.md, `render_partes.sh`, `voice.py`, `taste/`) | Apache-2.0 (ver `NOTICE` para GSAP, three.js, opentype.js e Inter) |
| `scripts/camera.mjs`, `ouvir.py`, `entonacao.mjs`, `pausas.mjs`, `render_partes.sh` | feitos nesta máquina entre 13 e 15/10/2026 sobre a motionmaxxing (`historico/origem-motionmaxxing.md`) | Apache-2.0 |
| `SKILL.md` | reescrita em português em 16/10/2026; o corpo original está em `references/metodo-motionmaxxing.md` e a nota local por data em `historico/nota-local-motionmaxxing.md` | Apache-2.0 |
| `kit/` | o tutorial "Primeiros passos no Aprovador" (16/10/2026, repositório do Swipes, `conteudo/tutorial-primeiros-passos-2026-10-16/`), generalizado: voz Gemini, montagem frase a frase, filme por fonte única, simulação do iPhone, som, autoteste e sonda de tela vazia (estes dois reescritos para o `_cdp.mjs` da skill, sem Playwright) | Apache-2.0 |
| `scripts/trocar-trecho.sh` | novo em 16/10/2026, depois de a emenda sem recodificar duplicar e perder quadros | Apache-2.0 |
| motor de render | HyperFrames (github.com/heygen-com/hyperframes) EM AVALIAÇÃO; nenhum arquivo dele foi copiado | Apache-2.0 |

## O que ainda falta

- **A prova (pedido do Jose em 16/10, 23h):** gerar pela motionstudio o longo no modo claro do
  tutorial do Aprovador (cancelado na skill antiga), com as telas fotografadas de novo no app
  1.30.115 (login sem a pergunta dos 90 dias, "mín. 10 caracteres", versão certa no topo; o
  `capturar.mjs` precisa parar de esperar a janela "Manter conectado?"), e comparar com o
  longo escuro de 16/10: mesma imagem e mesmo som, só com as correções, e o tempo de máquina.
- Testar o HyperFrames como motor num trecho de filme real (tempo, imagem igual, desfoque
  com 8 fotos por quadro) e, se ganhar, escrever o adaptador; se não tiver o desfoque,
  trazer para o `render.mjs` a captura em paralelo e o `beginFrame`.
- Capturar em paralelo depois da memória de 32 GB (prevista para 20/10/2026), medindo.
- Whisper na GPU: instalar cuBLAS 12 e cuDNN 9 (ver a seção GPU do `~/.claude/CLAUDE.md`).
- Generalizar o modelo de captura do app (`capturar.mjs` do caso do Aprovador) em `kit/`.

## Como trazer novidades das originais

- **motionmaxxing:** o repositório dela fica em `~/.claude/skills/motionmaxxing` (ramos
  `upstream` e `local`). Para ver o que mudou no original: `git -C ~/.claude/skills/motionmaxxing
  fetch --filter=blob:none origin main` e `git -C ~/.claude/skills/motionmaxxing diff upstream
  FETCH_HEAD --stat`. Trazer só o que valer a pena, arquivo por arquivo, e registrar aqui.
- **HyperFrames:** `gh repo view heygen-com/hyperframes` e as notas de versão em `releases/`.
- Esta pasta é um repositório git próprio (ramo `main`); cada rodada de mudança é um commit.
  Nada é enviado para fora.
