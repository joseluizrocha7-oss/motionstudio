"""Forma comum de um trecho falado em pt-BR, para casar o roteiro com a transcrição.

O roteiro escreve como se fala ("dois mil e trinta e três", "cê bê ésse"). A
transcrição escreve como se lê ("2033", "CBS"). As 2 grafias dão a mesma forma:

  forma(["dois", "mil", "e", "trinta", "e", "três"]) == forma(["2033"]) == "2033"
  forma(["cê", "bê", "ésse"]) == forma(["CBS"]) == forma(["Cê-Bê-Ésse"]) == "cbs"

Cobre:
  - número inteiro por extenso, de zero a 999.999.999 ("cem", "cento e um", "mil",
    "dois mil e trinta e três", "um milhão e duzentos mil"), também "2 mil" e "1.500";
  - decimal: "1,5", "1.5" e "um vírgula cinco" (= "1.5", diferente de "quinze");
  - "por cento" e "%"; "R$" antes e "real"/"reais" depois de um número;
  - sigla soletrada com o nome das letras em pt-BR ("cê bê ésse", "ce be esse",
    "Cê-Bê-Ésse", "agá tê tê pê"). A sigla precisa de 2 letras "fortes": nome de letra
    com o acento dele ("tê", "pê", "ésse") ou que não é palavra comum ("bê", "ce", "agá").
    "a", "e", "o", "de" e "que" na borda ficam fora da sigla; "esse é" e "de e" não são sigla.
Não cobre: ordinal ("primeiro", "2º"), fração ("meio"), centavos ("um real e cinquenta
centavos"), hora ("dez e meia"), número romano, número com letra ("quatro gê" x "4G"),
sigla lida como palavra ("Detran") e sigla sem acento só com palavras comuns ("te pe").

Usado pelo alinhar.py (kit/vozes/, copiado para a pasta vozes/ de cada projeto) e
pelo ouvir.py (scripts/ da skill, que acha este arquivo em ../kit/vozes/).
"""
import difflib, re, unicodedata

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
DIGITO = {k: str(v) for k, v in UNIDADES.items()}         # casa decimal dita algarismo por algarismo

# Nome da letra, sem acento, em pt-BR. Letra sozinha ("C", "B") também vale como letra.
LETRAS = {"a": "a", "be": "b", "ce": "c", "de": "d", "e": "e", "efe": "f", "ge": "g", "gue": "g", "aga": "h", "i": "i", "jota": "j",
          "ca": "k", "ka": "k", "ele": "l", "eme": "m", "ene": "n", "o": "o", "pe": "p", "que": "q", "erre": "r", "re": "r",
          "esse": "s", "te": "t", "u": "u", "ve": "v", "dablio": "w", "dabliu": "w", "xis": "x", "ipsilon": "y", "ipisilon": "y", "ze": "z"}
COMUNS = {"a", "e", "o", "de", "que", "esse", "ele", "te", "pe", "ve", "ca", "re", "ze"}   # nome de letra que também é palavra
BORDA = {"a", "e", "o", "de", "que"}                       # encosta numa sigla ("a CBS", "de CRM", "e MBA") e fica fora dela
COM_ACENTO = {"á", "bê", "cê", "dê", "ê", "éfe", "gê", "agá", "cá", "éle", "ême", "êne", "ó", "ô", "pê", "quê", "érre", "rê",
              "ésse", "tê", "vê", "dáblio", "dábliu", "ípsilon", "zê"}   # o acento diz que é nome de letra


def limpar(p):
    """Minúsculas, sem acento, só letras e algarismos ("Ésse," -> "esse"; "2.033" -> "2033")."""
    p = unicodedata.normalize("NFD", str(p).lower())
    return "".join(c for c in p if c.isalnum() and unicodedata.category(c) != "Mn")


def _decimal(x):
    """"1,5" e "1.500,25" (vírgula decimal); "1.5" (ponto com 1 ou 2 algarismos depois; com 3 é milhar). Devolve "1.5"."""
    m = re.fullmatch(r"(\d{1,3}(?:\.\d{3})+|\d+),(\d+)", x)
    if m:
        return m.group(1).replace(".", "") + "." + m.group(2)
    m = re.fullmatch(r"(\d+)\.(\d{1,2})", x)
    return m.group(1) + "." + m.group(2) if m else None


def _pedacos(palavras):
    """[limpo, cru, i0, i1] por pedaço: palavras[i0:i1] deram o pedaço. "R$" e "%" se separam do número, o hífen
    separa ("Cê-Bê-Ésse") e "por cento" vira "porcento"."""
    ps = []
    for i, p in enumerate(palavras):
        s = re.sub(r"r\$", " r$ ", str(p).lower()).replace("%", " % ")
        for x in re.split(r"[\s\-\u2010\u2011\u2013\u2014]+", s):
            cru = unicodedata.normalize("NFC", x.strip(".,;:!?…\"'“”‘’()[]"))
            if cru == "r$":
                ps.append(["R$", cru, i, i + 1])
            elif cru == "%":
                ps.append(["porcento", cru, i, i + 1])
            elif _decimal(cru):
                ps.append([_decimal(cru), cru, i, i + 1])
            elif limpar(x):
                ps.append([limpar(x), cru, i, i + 1])
    saida = []
    for x in ps:
        if x[0] == "cento" and saida and saida[-1][0] == "por":
            saida[-1] = ["porcento", "por cento", saida[-1][2], x[3]]
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


def _casas(ls, j):
    """As casas depois da vírgula: algarismo por algarismo ("zero cinco" = "05") ou um número ("vinte e cinco")."""
    ds = []
    while j + len(ds) < len(ls) and ls[j + len(ds)] in DIGITO:
        ds.append(DIGITO[ls[j + len(ds)]])
    if len(ds) >= 2 or ds[:1] == ["0"]:
        return "".join(ds), j + len(ds)
    v, fim = _numero(ls, j)
    if v is not None:
        return str(v), fim
    return (ls[j], j + 1) if j < len(ls) and ls[j].isdigit() else (None, j)


def _valor(ls, i):
    """Número que começa em ls[i] (algarismos, decimal, por extenso, "um vírgula cinco"): (texto, fim) ou (None, i)."""
    if re.fullmatch(r"\d+\.\d+", ls[i]):
        return ls[i], i + 1
    v, fim = _numero(ls, i)
    if v is not None:
        txt = str(v)
    elif ls[i].isdigit():
        txt, fim = ls[i], i + 1
    else:
        return None, i
    if fim + 1 < len(ls) and ls[fim] == "virgula":
        casas, depois = _casas(ls, fim + 1)
        if casas:
            txt, fim = txt + "." + casas, depois
    return txt, fim


def _quantia(ls, i):
    """Número com "R$" antes, ou "real"/"reais" ou "por cento" depois: (forma, fim) ou (None, i)."""
    j, moeda = (i + 1, True) if ls[i] == "R$" else (i, False)
    if j >= len(ls):
        return None, i
    txt, fim = _valor(ls, j)
    if txt is None:
        return None, i
    if fim < len(ls) and ls[fim] == "porcento":
        txt, fim = txt + "porcento", fim + 1
    elif fim < len(ls) and ls[fim] in ("real", "reais"):
        moeda, fim = True, fim + 1
    return txt + ("reais" if moeda else ""), fim


def _letra(p):
    return p[0] in LETRAS or (len(p[0]) == 1 and p[0].isalpha())


def _forte(p):
    """Nome de letra que não se confunde com palavra: com o acento dele, fora de COMUNS, ou letra sozinha (menos a, e, o)."""
    return p[1] in COM_ACENTO or (_letra(p) and p[0] not in COMUNS)


def _siglas(ps, ini, fim):
    """Divide ps[ini:fim], só de nomes de letra, em [(a, z, é_sigla)]. A palavra comum da borda fica fora da sigla;
    um "e" no meio separa 2 siglas ("cê bê ésse e cê érre ême"); com menos de 2 letras fortes não há sigla."""
    def fortes(x, y):
        return sum(_forte(p) for p in ps[x:y])

    def soltas(x, y):
        return [(k, k + 1, False) for k in range(x, y)]
    a, z = ini, fim
    while a < z and ps[a][0] in BORDA and not _forte(ps[a]):
        a += 1
    while z > a and ps[z - 1][0] in BORDA and not _forte(ps[z - 1]):
        z -= 1
    if fortes(a, z) < 2:
        return soltas(ini, fim)
    for m in range(a + 1, z - 1):
        if ps[m][0] in BORDA and not _forte(ps[m]) and fortes(a, m) >= 2 and fortes(m + 1, z) >= 2:
            return soltas(ini, a) + _siglas(ps, a, m) + soltas(m, m + 1) + _siglas(ps, m + 1, z) + soltas(z, fim)
    return soltas(ini, a) + [(a, z, True)] + soltas(z, fim)


def unidades(palavras):
    """Divide as palavras em unidades: um número (com "R$", "reais", "por cento" ou "vírgula"), uma sigla soletrada ou
    uma palavra. Devolve [(i0, i1, forma)]: palavras[i0:i1] formam a unidade. Toda palavra fica numa unidade; a que
    não tem letra nem algarismo ("–") fica numa unidade de forma vazia."""
    ps = _pedacos(palavras)
    ls = [p[0] for p in ps]
    solta = lambda p: "r" if p[0] == "R$" else p[0]
    us, i = [], 0                                          # [p0, p1, forma], em índices de pedaço
    while i < len(ps):
        f, fim = _quantia(ls, i)
        if f is not None:
            us.append((i, fim, f))
            i = fim
            continue
        j = i
        while j < len(ps) and _letra(ps[j]):
            j += 1
        if j - i >= 2:
            for a, z, sigla in _siglas(ps, i, j):
                us.append((a, z, "".join(LETRAS.get(p[0], p[0]) for p in ps[a:z]) if sigla else solta(ps[a])))
            i = j
            continue
        us.append((i, i + 1, solta(ps[i])))
        i += 1
    juntas = []                                            # em índices de palavra; "Boas-vindas" deu 2 pedaços e é 1 unidade
    for p0, p1, f in us:
        i0, i1 = ps[p0][2], ps[p1 - 1][3]
        if juntas and i0 < juntas[-1][1]:
            juntas[-1] = (juntas[-1][0], max(juntas[-1][1], i1), juntas[-1][2] + f)
        else:
            juntas.append((i0, i1, f))
    saida, k = [], 0
    for i0, i1, f in juntas:
        saida += [(x, x + 1, "") for x in range(k, i0)]
        saida.append((i0, i1, f))
        k = i1
    return saida + [(x, x + 1, "") for x in range(k, len(palavras))]


def forma(palavras):
    """Forma comum de uma lista de palavras: número em algarismos, sigla soletrada em letras, tudo junto, sem espaço."""
    return "".join(f for _, _, f in unidades(palavras))


def trechos(a, b, troca=None):
    """Como o difflib.SequenceMatcher(a, b).get_opcodes(), mas por unidade: "dois mil e vinte e cinco" é uma unidade
    só, e o "e" de dentro do número não casa com o "e" ouvido logo depois. Devolve [(op, i0, i1, j0, j1)] em índices
    de palavra; cada "equal" é um par de unidades com a mesma forma. troca: aplicada à forma de uma palavra sozinha."""
    ua, ub = unidades(a), unidades(b)
    chave = lambda u: troca(u[2]) if troca and u[1] - u[0] == 1 else u[2]
    res = []
    for op, x1, x2, y1, y2 in difflib.SequenceMatcher(None, [chave(u) for u in ua], [chave(u) for u in ub], autojunk=False).get_opcodes():
        if op == "equal":
            res += [("equal",) + ua[x1 + k][:2] + ub[y1 + k][:2] for k in range(x2 - x1)]
            continue
        i0 = ua[x1][0] if x1 < len(ua) else len(a)
        j0 = ub[y1][0] if y1 < len(ub) else len(b)
        res.append((op, i0, ua[x2 - 1][1] if x2 > x1 else i0, j0, ub[y2 - 1][1] if y2 > y1 else j0))
    return res


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
