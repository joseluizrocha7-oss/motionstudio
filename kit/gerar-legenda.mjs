// Legenda do filme (kit da skill motionstudio): quebra o texto do roteiro em
// pedaços de 1 ou 2 linhas e dá a cada pedaço o tempo da fala.
//
// O texto vem do roteiro (o que aparece na tela), não da fala transcrita. Os tempos vêm
// de FALA (film/assets/fala.js), que já inclui o atraso de entrada da voz (offset):
// não some o offset de novo. Todos os tempos saem em segundos do filme, em milissegundos.

const MAX_LINHA = 42;            // caracteres por linha da legenda
const MAX_PEDACO = 76;           // caracteres por pedaço (2 linhas de 42, menos a folga da quebra)
const CORTE_PONTUACAO = 30;      // só corta na pontuação se o texto até ela tem isto ou mais
const DESCONTO_PONTUACAO = 6;    // abate do custo da quebra que termina a linha 1 em pontuação
const PENALIDADE_CURTA = 8;      // soma ao custo da quebra que deixa palavra de até 2 letras no fim da linha 1

const ms = (x) => Math.round(x * 1000) / 1000;
const palavrasDe = (texto) => String(texto ?? "").split(/\s+/).filter(Boolean);
const terminaEmPontuacao = (palavra) => /[,.;:!?]$/.test(palavra);
const tamanho = (palavras) => palavras.join(" ").length;
// Palavra sem acento, caixa nem pontuação: serve só para conferir se a fala é a mesma do texto.
const chave = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Escolhe o item de menor valor; no empate fica o primeiro.
function menorPor(itens, valor) {
  return itens.reduce((m, x) => (valor(x) < valor(m) ? x : m));
}

// Um pedaço (lista de palavras) em 1 ou 2 linhas, em "\n".
function emLinhas(palavras) {
  const inteiro = palavras.join(" ");
  if (inteiro.length <= MAX_LINHA || palavras.length < 2) return inteiro;
  const opcoes = [];
  for (let k = 1; k < palavras.length; k++) {
    const l1 = palavras.slice(0, k).join(" "), l2 = palavras.slice(k).join(" ");
    const ultima = palavras[k - 1].replace(/[,.;:!?]+$/, "");
    opcoes.push({
      l1, l2, maior: Math.max(l1.length, l2.length),
      custo: Math.abs(l1.length - l2.length)
        - (terminaEmPontuacao(palavras[k - 1]) ? DESCONTO_PONTUACAO : 0)
        + (ultima.length <= 2 ? PENALIDADE_CURTA : 0),
    });
  }
  const cabem = opcoes.filter((o) => o.maior <= MAX_LINHA);
  // Sem quebra em que as 2 linhas caibam (palavra de 40 e tantas letras no meio): a que deixa a linha mais longa menor.
  const o = cabem.length ? menorPor(cabem, (x) => x.custo) : menorPor(opcoes, (x) => x.maior);
  return `${o.l1}\n${o.l2}`;
}

// Texto do roteiro em pedaços de 1 ou 2 linhas.
export function quebrarTexto(texto) {
  const palavras = palavrasDe(texto);
  const pedacos = [];
  let atual = [];
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    if (p.length > MAX_LINHA) {                       // palavra longa (endereço): pedaço sozinho
      if (atual.length) pedacos.push(atual);
      pedacos.push([p]);
      atual = [];
    } else if (!atual.length || tamanho([...atual, p]) <= MAX_PEDACO) {
      atual.push(p);
    } else {
      // Passou de 76: corta depois da última palavra com pontuação (se o texto até ela tem 30 ou mais), senão antes de p.
      let corte = atual.length;
      for (let k = atual.length - 1; k >= 0; k--) {
        if (terminaEmPontuacao(atual[k]) && tamanho(atual.slice(0, k + 1)) >= CORTE_PONTUACAO) { corte = k + 1; break; }
      }
      pedacos.push(atual.slice(0, corte));
      i -= atual.length - corte + 1;                  // o resto do pedaço e p voltam para a fila
      atual = [];
    }
  }
  if (atual.length) pedacos.push(atual);
  return pedacos.map(emLinhas);
}

// Tempo de cada pedaço. Com as palavras da fala (mesmo texto, mesmo número de palavras), vai do início
// da 1ª ao fim da última. Sem elas, reparte o tempo da frase pela quantidade de caracteres (sem o "\n").
export function temposDosPedacos(pedacos, frase, palavras) {
  const lista = pedacos.map(palavrasDe);
  const todas = lista.flat();
  if (palavras && todas.length > 0 && palavras.length === todas.length
      && todas.every((w, i) => chave(w) === chave(palavras[i].w))) {
    let i = 0;
    return pedacos.map((texto, n) => {
      const ini = palavras[i], fim = palavras[i + lista[n].length - 1];
      i += lista[n].length;
      return { a: ms(ini.a), b: ms(fim.b), texto };
    });
  }
  const pesos = pedacos.map((p) => p.replace(/\n/g, "").length);
  const soma = pesos.reduce((s, x) => s + x, 0) || 1;
  let acumulado = 0;
  return pedacos.map((texto, n) => {
    const a = frase.a + (frase.b - frase.a) * acumulado / soma;
    acumulado += pesos[n];
    const b = n === pedacos.length - 1 ? frase.b : frase.a + (frase.b - frase.a) * acumulado / soma;
    return { a: ms(a), b: ms(b), texto };
  });
}

// Estende cada legenda até durar `min` segundos, sem passar de `folga` antes da próxima. Nunca encurta.
export function ajustarDuracoes(blocos, { min = 1.0, folga = 0.05 } = {}) {
  return blocos.map((bl, i) => {
    const limite = i + 1 < blocos.length ? blocos[i + 1].a - folga : Infinity;
    return { a: ms(bl.a), b: ms(Math.max(bl.b, Math.min(bl.a + min, limite))), texto: bl.texto };
  });
}

// Legendas do filme inteiro: o texto do roteiro com o tempo da fala. A linha que o roteiro tem
// e a fala não tem (voz não gerada) fica de fora. Palavras da fala só valem quando a linha não
// tem `fala` (o texto da tela é o que a voz diz).
export function legendasDoFilme(roteiro, fala) {
  const blocos = [];
  for (const bloco of roteiro.blocos ?? []) {
    for (const linha of bloco.linhas ?? []) {
      const frases = fala.linhas.filter((f) => f.l === linha.id);
      if (!frases.length) continue;
      const frase = { a: frases[0].a, b: frases[frases.length - 1].b };
      const palavras = linha.fala ? null : (fala.palavras ?? []).filter((p) => p.l === linha.id);
      blocos.push(...temposDosPedacos(quebrarTexto(linha.texto), frase, palavras));
    }
  }
  return ajustarDuracoes(blocos);
}
