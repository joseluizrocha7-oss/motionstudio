// ====================================================================
// LINHA DO TEMPO DE EXEMPLO (kit da motionstudio). Troque pelo filme de verdade.
// Tudo é função do tempo e preso à voz:
//   pal('<linha>', '<palavra>')  quadro em que a palavra começa (palFim: em que termina)
//   ini('<linha>', k) / fim('<linha>', k)  começo e fim da k-ésima frase da linha
//   mostra('<foto>', a, b)       a foto do app ocupa a tela de a até b (troca seca)
//   anel(caixa, a, b, {rotulo})  contorno no que a voz nomeia; toque(x, y, f) / tocarEm(foto, alvo, f)
//   cam(f0, f1, escala, yDaTela) aproxima (até 1,5x o plano-base); base(f0, f1) volta
//   passo('Título', f)           pílula do passo no alto; peca(html, x, y, a, b, opt) peça ao lado
//   marcaFinal('<linha>', {...}) a marca do fim presa à última frase
// Fotos e caixas: film/<telas>/medidas.js (T.fotos[foto].alvos[alvo] = {x, y, width, height}
// na tela de 390x844), gravado pela captura do app. Caso completo: tutorial do Aprovador
// (SKILL.md, "Caso de referência").
// ====================================================================

// ABERTURA: a marca enquanto a voz dá boas-vindas; o celular entra com a frase seguinte.
const fCel = palFim('w1', 'Produto') + 2;
M.enter('#simbolo', { at: 2, frames: 16, ease: 'snapSettle', from: { scale: 3.2, blur: 14, opacity: 0 } });
M.words('#nome', { at: 5, mech: 'rise', dist: 70, frames: 13, smear: true });
M.words('#sub', { at: Math.max(8, pal('w1', 'Boas') - 2), mech: 'rise', dist: 40, frames: 12 });
const wAb = M.wrap('#abertura');
M.kf(wAb, 'scale', [[0, 1], [fCel - 4, 1.04], [FIM, 1.04]]);
M.exit('#abertura', { at: fCel - 4, frames: 14, ease: 'accelExit', to: { y: -520, scale: .7, opacity: 0 }, hide: true });
M.kf('#celular', 'y', [[0, 1100], [fCel - 2, 1100], [fCel + 18, 0, 'softLand'], [FIM, 0]]);
M.drift('#grade', { prop: 'x', from: 0, to: -40, start: 0, end: FIM });
M.mark(fCel - 2, 'enter', 'celular');

// 1. ENTRAR
passo('Entrar', ini('e1') - 8);
const fEntrar = fim('e1') + 6;
mostra('login', 0, fEntrar + 4);
peca(`<div class="barra-endereco">app.exemplo.com</div>`, 1240, VERT ? FAIXA : 470, pal('e1', 'Entrar'), fim('e1'), VERT ? { centro: true, dx: 0, dy: 40 } : { dx: 60 });
cam(ini('e1') + 4, ini('e1') + 24, 1.3, 500);
anel(alvo('login', 'entrar'), pal('e1', 'Entrar'), fEntrar, { rotulo: 'Entrar' });
tocarEm('login', 'entrar', fEntrar, 'Entrar');
mostra('fila', fEntrar + 4, FIM);
base(fEntrar + 4, fEntrar + 24);

// FIM: o celular sai e a marca chega com a última frase.
const fSai = pal('z1', 'Boas') - 10;
M.kf('#cam', 'opacity', [[0, 1], [fSai, 1], [fSai + 16, 0, 'gentleIn'], [FIM, 0]]);
camKeys.push([fSai, { ...camAtual }]);
camKeys.push([fSai + 18, { scale: .92, x: Math.round(W / 2 * .08), y: VERT ? 300 : 160 }, 'accelExit']);
marcaFinal('z1', { sub: 'Boas-vindas!', comSub: 'Boas', comMarca: 'novo', comPulso: 'Produto' });
