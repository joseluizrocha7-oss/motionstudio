# Efeitos gravados (opção do kit, em teste)

Três sons gravados, em domínio público (CC0 1.0), para trocar dois efeitos sintetizados do
`trilha.mjs`. O padrão continua sintetizado. Um gravado só vira padrão depois que o Jose
aprovar de ouvido.

| arquivo | troca | uso no `gerar-som.mjs` |
|---|---|---|
| `pop-hand.wav` | `pop` (o toque na tela) | `--toque pop-hand` |
| `mouse-click-2.wav` | `pop` (o toque na tela) | `--toque mouse-click-2` |
| `fast-whoosh.wav` | `ar` (celular entrando, lista arrastada) | `--ar fast-whoosh` |

O `trilha.mjs` põe o pico de cada som gravado no instante do pico do sintetizado que ele troca.
O sopro sintetizado cresce devagar e tem o pico 0,3 s depois do evento. O `trilha.mjs` também dá
ao gravado a mesma energia do sintetizado na janela de 0,4 s em que o gravado toca. Assim a
comparação é de timbre, não de volume.

## A/B de 19/10/2026 (esperando o ouvido do Jose)

Os três vídeos têm a mesma imagem do tutorial "Primeiros passos no Aprovador" (longo, claro) e
três trechos com toque e sopro (10 a 16 s, 68 a 90 s, 165 a 178 s). Estão no repositório do
Swipes, em `conteudo/tutorial-primeiros-passos-2026-10-16/film/conferir/ab-efeitos-2026-10-19/`:

1. `ab-1-atual-sintetizado.mp4`: o som entregue, igual byte a byte ao `mix.wav` do projeto.
2. `ab-2-gravado-pop-hand.mp4`: `--toque pop-hand --ar fast-whoosh`.
3. `ab-3-gravado-clique.mp4`: `--toque mouse-click-2 --ar fast-whoosh`.

Se o Jose escolher um gravado, ele vira o padrão no `gerar-som.mjs`. A escolha e a frase dele vão
para `taste/verdicts.md`.

## Origem

- Woven SFX, <https://github.com/woven-video/woven-sfx>, pasta `sounds/`, commit
  `521b446db682a3cae9ae1647e94bbdc312cd9a3a`. Baixados da origem em 19/10/2026, sem mudança.
- Achados pelo editonny (<https://github.com/soumatheusgomes/editonny>), que traz 35 sons da
  mesma origem. Os três daqui foram conferidos contra a origem pelo SHA-256:

```
02fed9196bc33a569ab3ddbdcc5d8b3c323346df6fb32e24b23930f990fc1cd5  pop-hand.wav
144ff9b54529dd3763c269b5bac545891ea761303830f323d8e8bb64d13df867  mouse-click-2.wav
87da86fc4da1eb53583c486cc2d40905ef38f413b64eed7852168c945f0c45b5  fast-whoosh.wav
```

## Licença

CC0 1.0 Universal (domínio público). O texto da origem está em `SOUNDS_LICENSE`. Pode usar em
filme de cliente, comercial ou não, sem pedir licença e sem crédito. O crédito é opcional:
"Efeitos sonoros: Woven SFX (CC0)".
