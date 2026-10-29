"""Forma comum de um trecho falado em pt-BR, para casar o roteiro com a transcrição.

O roteiro escreve como se fala ("dois mil e trinta e três", "cê bê ésse"). A
transcrição escreve como se lê ("2033", "CBS"). As 2 grafias dão a mesma forma:

  forma(["dois", "mil", "e", "trinta", "e", "três"]) == forma(["2033"]) == "2033"
  forma(["cê", "bê", "ésse"]) == forma(["CBS"]) == forma(["C.B.S."]) == "cbs"

Cobre:
  - número inteiro por extenso, de zero a 999.999.999 ("cem", "cento e um", "mil",
    "dois mil e trinta e três", "um milhão e duzentos mil"), também "2 mil" e "1.500";
  - "por cento" e "%";
  - sigla soletrada com o nome das letras em pt-BR, com e sem acento ("cê bê ésse",
    "ce be esse", "agá tê tê pê"), a partir de 2 letras seguidas.
Não cobre: ordinal ("primeiro", "2º"), decimal e fração ("um vírgula cinco",
"meio"), dinheiro ("R$ 30", "trinta reais"), hora ("dez e meia"), número romano,
número com letra ("quatro gê" x "4G") e sigla lida como palavra ("Detran").

Usado pelo alinhar.py (kit/vozes/, copiado para a pasta vozes/ de cada projeto) e
pelo ouvir.py (scripts/ da skill, que acha este arquivo em ../kit/vozes/).
"""
import unicodedata

UNIDADES = {"zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9}
DEZ_A_DEZENOVE = {"dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14, "quinze": 15, "dezesseis": 16,
                  "dezasseis": 16, "dezessete": 17, "dezassete": 17, "dezoito": 18, "dezenove": 19, "dezanove": 19}
DEZENAS = {"vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90}
CENTENAS = {"cento": 100, "duzentos": 200, "trezentos": 300, "quatrocentos": 400, "quinhentos": 500, "seiscentos": 600,
            "setecentos": 700, "oitocentos": 800, "novecentos": 900}
CENTENAS.update({k[:-2] + "as": v for k, v in CENTENAS.items() if k.endswith("os")})       # duzentas, trezentas...
MULTIPLOS = {"mil": 10 ** 3, "milhao": 10 ** 6, "milhoes": 10 ** 6, "bilhao": 10 ** 9, "bilhoes": 10 ** 9}

# palavra -> (valor, casa mais alta, casa mais baixa): depois de uma palavra só vem outra de casa mais baixa.
# "cem" ocupa até a casa da unidade: nada vem depois dele, só "mil".
NUMERO = {}
NUMERO.update({k: (v, 0, 0) for k, v in UNIDADES.items()})
NUMERO.update({k: (v, 1, 0) for k, v in DEZ_A_DEZENOVE.items()})
NUMERO.update({k: (v, 1, 1) for k, v in DEZENAS.items()})
NUMERO.update({k: (v, 2, 2) for k, v in CENTENAS.items()})
NUMERO["cem"] = (100, 2, 0)

# Nome da letra, sem acento, em pt-BR. Letra sozinha ("C", "B") também vale como letra.
LETRAS = {"a": "a", "be": "b", "ce": "c", "de": "d", "e": "e", "efe": "f", "ge": "g", "gue": "g", "aga": "h", "i": "i", "jota": "j",
          "ca": "k", "ka": "k", "ele": "l", "eme": "m", "ene": "n", "o": "o", "pe": "p", "que": "q", "erre": "r", "re": "r",
          "esse": "s", "te": "t", "u": "u", "ve": "v", "dablio": "w", "dabliu": "w", "xis": "x", "ipsilon": "y", "ipisilon": "y", "ze": "z"}


def limpar(p):
    """Minúsculas, sem acento, só letras e algarismos ("Ésse," -> "esse"; "2.033" -> "2033")."""
    p = unicodedata.normalize("NFD", str(p).lower())
    return "".join(c for c in p if c.isalnum() and unicodedata.category(c) != "Mn")


def _pedacos(palavras):
    """Limpa as palavras; "25%" vira "25" e "porcento", e "por cento" vira "porcento"."""
    ps = []
    for p in palavras:
        for x in str(p).replace("%", " porcento ").split():
            x = limpar(x)
            if x:
                ps.append(x)
    saida = []
    for x in ps:
        if x == "cento" and saida and saida[-1] == "por":
            saida[-1] = "porcento"
        else:
            saida.append(x)
    return saida


def _numero(ps, i):
    """Lê o número por extenso que começa em ps[i]. Devolve (valor, fim) ou (None, i)."""
    total, grupo, base, ultimo_mult, e_antes = 0, None, None, None, False
    j, fim, valor = i, i, None
    while j < len(ps):
        p = ps[j]
        if p == "e":                                        # "e" só liga 2 partes do mesmo número
            if j == i or e_antes:
                break
            e_antes = True
            j += 1
            continue
        if p in NUMERO:
            v, topo, baixo = NUMERO[p]
            if v == 0:                                      # "zero" só sozinho
                if j == i:
                    return 0, j + 1
                break
            if grupo is None:
                if j > i and ultimo_mult is None:
                    break
                grupo, base = v, baixo
            else:
                if not e_antes or topo >= base:             # "vinte e cinco" sim; "dois e três" não
                    break
                grupo, base = grupo + v, baixo
        elif p in MULTIPLOS:
            m = MULTIPLOS[p]
            if e_antes or (ultimo_mult is not None and m >= ultimo_mult):
                break
            total += (grupo if grupo is not None else 1) * m
            grupo, base, ultimo_mult = None, None, m
        elif p.isdigit() and j == i and j + 1 < len(ps) and ps[j + 1] in MULTIPLOS and int(p) < 1000:
            grupo, base = int(p), 0                         # "2 mil", "1 milhão"
            j += 1
            continue
        else:
            break
        e_antes = False
        j += 1
        fim, valor = j, total + (grupo or 0)
    return (valor, fim) if fim > i else (None, i)


def forma(palavras):
    """Forma comum de uma lista de palavras: número em algarismos, sigla soletrada em letras, tudo junto, sem espaço."""
    ps = _pedacos(palavras)
    saida, i = [], 0
    while i < len(ps):
        v, fim = _numero(ps, i)
        if v is not None:
            saida.append(str(v))
            i = fim
            continue
        j = i
        while j < len(ps) and (ps[j] in LETRAS or (len(ps[j]) == 1 and ps[j].isalpha())):
            j += 1
        if j - i >= 2:                                      # sigla: 2 ou mais nomes de letra seguidos
            saida.append("".join(LETRAS.get(x, x) for x in ps[i:j]))
            i = j
            continue
        saida.append(ps[i])
        i += 1
    return "".join(saida)


def casar(a, b, alternativas=None, maximo=12):
    """Casa trechos de a (palavras do roteiro) com trechos de b (palavras ouvidas) que têm a mesma forma.

    a e b são os pedaços que não casaram palavra a palavra. alternativas: {(i0, i1): {forma, ...}},
    outras formas aceitas para a[i0:i1] (o texto da tela de uma fala diferente). Devolve, em ordem,
    [(i0, i1, j0, j1)] com forma(a[i0:i1]) == forma(b[j0:j1]); entre 2 candidatos, o que começa
    antes em b e depois o mais curto.
    """
    alternativas = alternativas or {}
    em_b = {}
    for j0 in range(len(b)):
        for j1 in range(j0 + 1, min(len(b), j0 + maximo) + 1):
            f = forma(b[j0:j1])
            if f:
                em_b.setdefault(f, []).append((j0, j1))
    res, i, j = [], 0, 0
    while i < len(a):
        melhor = None
        for i1 in range(i + 1, min(len(a), i + maximo) + 1):
            formas = {forma(a[i:i1])} | set(alternativas.get((i, i1), ()))
            for f in formas:
                for j0, j1 in em_b.get(f, ()) if f else ():
                    cand = (j0, (i1 - i) + (j1 - j0), i, i1, j1)
                    if j0 >= j and (melhor is None or cand < melhor):
                        melhor = cand
        if melhor:
            j0, _, i0, i1, j1 = melhor
            res.append((i0, i1, j0, j1))
            i, j = i1, j1
        else:
            i += 1
    return res
