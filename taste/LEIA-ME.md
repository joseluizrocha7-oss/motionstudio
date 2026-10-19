# taste/: os vereditos de quem usa a skill

Aqui ficam dois arquivos que o agente lê no passo 0, antes de qualquer filme:

| arquivo | o que guarda |
|---|---|
| `verdicts.md` | O que o dono da skill aprovou e reprovou, com a frase dele e a data |
| `edits.md` | Os antes e depois: o que mudou num filme e por quê |

Os dois ficam fora do git: citam clientes e filmes de clientes. Quem clonar a skill começa
com os dois vazios. Para registrar um veredito, acrescente no fim de `verdicts.md` a frase
de quem pediu o filme, a data, o filme e o que mudou. O `scripts/blind_review.py` gera um
veredito pronto para colar.
