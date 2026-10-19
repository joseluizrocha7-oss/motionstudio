// ====================================================================
// Instalação no iPhone: SIMULAÇÃO ILUSTRATIVA do Safari e da Tela de Início.
// O app não tem como fotografar a interface do iOS; isto é desenhado aqui,
// nas proporções do iPhone (390 x 844 pontos), com os textos que o iOS mostra
// em português. A página aberta no Safari é a foto de verdade do app visto num
// iPhone (iphone-ajustes.png), e o app que abre no fim também (iphone-fila.png).
// O ícone é o "UM" do app sobre fundo branco (ver NOTE.md: o arquivo real é
// transparente e o iOS o pintaria de preto).
// ====================================================================
const CLARO = /claro/.test(PASTA);
(() => {
  const css = `
  #safari { position: absolute; left: 0; top: 0; width: 390px; height: 844px; z-index: 70; overflow: hidden; font-family: var(--font); }
  #safari .pg { position: absolute; left: 0; top: 0; width: 390px; }
  #safari .status { position: absolute; left: 0; top: 0; width: 390px; height: 50px; display: flex; justify-content: space-between; align-items: center; padding: 6px 30px 0 44px; font-size: 16px; font-weight: 600; }
  #safari .status svg { height: 13px; margin-left: 6px; }
  #safari .ilha { position: absolute; left: 134px; top: 11px; width: 122px; height: 36px; border-radius: 18px; background: #000; z-index: 90; }
  #safari .barra { position: absolute; left: 0; top: 736px; width: 390px; height: 108px; border-top: 0.5px solid var(--ios-sep); background: var(--ios-barra); }
  #safari .end { position: absolute; left: 12px; top: 8px; width: 366px; height: 46px; border-radius: 13px; background: var(--ios-campo); display: flex; align-items: center; justify-content: space-between; padding: 0 14px; font-size: 16px; }
  #safari .end .url { display: flex; align-items: center; gap: 6px; font-size: 15.5px; }
  #safari .ferr { position: absolute; left: 0; top: 62px; width: 390px; height: 30px; display: flex; justify-content: space-around; align-items: center; }
  #safari .ferr svg { width: 26px; height: 26px; }
  #safari .home-ind { position: absolute; left: 128px; top: 830px; width: 134px; height: 5px; border-radius: 3px; background: var(--ios-texto); z-index: 91; }
  #safari .folha { position: absolute; left: 0; top: 300px; width: 390px; height: 560px; border-radius: 14px 14px 0 0; background: var(--ios-fundo); box-shadow: 0 -10px 30px rgba(0,0,0,.25); }
  #safari .folha .cab { position: absolute; left: 16px; top: 16px; width: 358px; height: 56px; display: flex; align-items: center; gap: 12px; }
  #safari .folha .cab .t { display: flex; flex-direction: column; gap: 2px; }
  #safari .folha .cab .t b { font-size: 16px; font-weight: 600; }
  #safari .folha .cab .t span { font-size: 13px; color: var(--ios-texto2); }
  #safari .folha .x { position: absolute; right: 16px; top: 28px; width: 30px; height: 30px; border-radius: 15px; background: var(--ios-campo); display: flex; align-items: center; justify-content: center; font-size: 15px; color: var(--ios-texto2); }
  #safari .alvos { position: absolute; left: 0; top: 92px; width: 390px; height: 96px; display: flex; justify-content: space-around; padding: 0 8px; }
  #safari .alvos div { display: flex; flex-direction: column; align-items: center; gap: 7px; font-size: 11.5px; color: var(--ios-texto); width: 76px; }
  #safari .alvos i { width: 60px; height: 60px; border-radius: 30px; display: block; }
  #safari .grupo { position: absolute; left: 16px; width: 358px; border-radius: 12px; background: var(--ios-linha); overflow: hidden; }
  #safari .grupo div { height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font-size: 16px; border-bottom: 0.5px solid var(--ios-sep); }
  #safari .grupo div:last-child { border-bottom: 0; }
  #safari .grupo svg { width: 22px; height: 22px; }
  #safari .adic { position: absolute; left: 0; top: 0; width: 390px; height: 844px; background: var(--ios-fundo); }
  #safari .adic .nav { position: absolute; left: 0; top: 56px; width: 390px; height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 16px; font-size: 16.5px; }
  #safari .adic .nav b { font-weight: 600; color: var(--ios-texto); font-size: 16.5px; }
  #safari .adic .nav span { color: var(--ios-azul); }
  #safari .adic .nav .ok { font-weight: 600; }
  #safari .adic .card { position: absolute; left: 16px; top: 120px; width: 358px; height: 96px; border-radius: 12px; background: var(--ios-linha); display: flex; align-items: center; gap: 14px; padding: 0 16px; }
  #safari .adic .card .n { display: flex; flex-direction: column; gap: 8px; flex: 1; }
  #safari .adic .card .n b { font-size: 17px; font-weight: 500; padding-bottom: 8px; border-bottom: 0.5px solid var(--ios-sep); }
  #safari .adic .card .n span { font-size: 13px; color: var(--ios-texto2); }
  #safari .adic p { position: absolute; left: 32px; top: 228px; width: 326px; font-size: 13px; line-height: 18px; color: var(--ios-texto2); margin: 0; }
  #safari .ic { width: 60px; height: 60px; border-radius: 14px; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 0.5px rgba(0,0,0,.12); overflow: hidden; }
  #safari .ic img { width: 46px; height: 46px; }
  #safari .inicio { position: absolute; left: 0; top: 0; width: 390px; height: 844px; background: linear-gradient(160deg, #2f5c8f 0%, #5a78b8 45%, #8e6fb8 100%); }
  #safari .inicio .status { color: #fff; }
  #safari .app { position: absolute; width: 76px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.35); }
  #safari .app .gl { width: 62px; height: 62px; border-radius: 15px; display: flex; align-items: center; justify-content: center; }
  #safari .app .gl i { display: block; width: 26px; height: 26px; border-radius: 6px; background: rgba(255,255,255,.85); }
  #safari .app .gl i.o { border-radius: 13px; }
  #safari .app .ic { width: 62px; height: 62px; border-radius: 15px; }
  #safari .dock { position: absolute; left: 12px; top: 738px; width: 366px; height: 92px; border-radius: 30px; background: rgba(255,255,255,.22); }
  #safari .abre { position: absolute; left: 0; top: 0; width: 390px; }
  .ios-claro { --ios-fundo: #f2f2f7; --ios-linha: #ffffff; --ios-barra: rgba(249,249,249,.95); --ios-campo: rgba(118,118,128,.14); --ios-texto: #000; --ios-texto2: #6e6e73; --ios-sep: rgba(60,60,67,.22); --ios-azul: #007aff; color: #000; }
  .ios-escuro { --ios-fundo: #1c1c1e; --ios-linha: #2c2c2e; --ios-barra: rgba(22,22,24,.95); --ios-campo: rgba(118,118,128,.26); --ios-texto: #fff; --ios-texto2: #98989f; --ios-sep: rgba(84,84,88,.6); --ios-azul: #0a84ff; color: #fff; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

const SVG = {
  sinal: (c) => `<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="${c}"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${c}"/></svg>`,
  wifi: (c) => `<svg viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z" fill="${c}"/><path d="M3.4 6.8a6.6 6.6 0 0 1 9.2 0l-1.5 1.5a4.5 4.5 0 0 0-6.2 0z" fill="${c}"/><path d="M1.2 4.6a9.7 9.7 0 0 1 13.6 0l-1.5 1.5a7.6 7.6 0 0 0-10.6 0z" fill="${c}"/></svg>`,
  bateria: (c) => `<svg viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="${c}" opacity=".45"/><rect x="2" y="2" width="18" height="9" rx="2" fill="${c}"/><rect x="24.5" y="4.5" width="1.6" height="4" rx=".8" fill="${c}" opacity=".45"/></svg>`,
  voltar: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4 7 12l8 8"/></svg>`,
  avancar: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".35"><path d="m9 4 8 8-8 8"/></svg>`,
  compartilhar: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16"/><path d="M12 2.5v12M8 6.5l4-4 4 4"/></svg>`,
  livro: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7.5 4.5 3.5 4.5v14c4 0 6.5.5 8.5 2 2-1.5 4.5-2 8.5-2v-14c-4 0-6.5.5-8.5 2zM12 6.5v14"/></svg>`,
  abas: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"><rect x="7" y="3" width="13" height="13" rx="2.5"/><path d="M17 20H6.5A2.5 2.5 0 0 1 4 17.5V7"/></svg>`,
  cadeado: (c) => `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${c}" stroke-width="2.4"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>`,
  recarregar: (c) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"><path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v5h-5"/></svg>`,
  copiar: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  oculos: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 14h4M3 13l2-6M21 13l-2-6"/></svg>`,
  estrela: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>`,
  mais: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`,
  lupa: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg>`,
};

// o: { a, compartilhar, telaInicio, adicionar, icone, abrir, b } (quadros)
function simularIphone(o) {
  const cor = CLARO ? '#000' : '#fff';
  const azul = CLARO ? '#007aff' : '#0a84ff';
  const status = (c) => `<div class="status" style="color:${c}"><span>9:45</span><span>${SVG.sinal(c)}${SVG.wifi(c)}${SVG.bateria(c)}</span></div>`;
  const icone = `<div class="ic"><img src="${PASTA}/../assets/icone-app.png" alt=""></div>`;
  const APPS = [
    ['Câmera', '#6b7280,#374151', 'o'], ['Fotos', '#fbbf24,#f43f5e', 'o'], ['Mapas', '#34d399,#3b82f6', ''], ['Clima', '#60a5fa,#2563eb', 'o'],
    ['Relógio', '#1f2937,#111827', 'o'], ['Calendário', '#f9fafb,#e5e7eb', ''], ['Notas', '#fde68a,#facc15', ''], ['Lembretes', '#f3f4f6,#d1d5db', 'o'],
    ['Ajustes', '#9ca3af,#6b7280', 'o'], ['Arquivos', '#93c5fd,#3b82f6', ''],
  ];
  const col = (i) => 7 + (i % 4) * 94, lin = (i) => 66 + Math.floor(i / 4) * 102;
  const apps = APPS.map(([n, g, f], i) => `<div class="app" style="left:${col(i)}px;top:${lin(i)}px"><div class="gl" style="background:linear-gradient(160deg,${g})"><i class="${f}"></i></div><span>${n}</span></div>`).join('');
  const NOVO = 10;
  const dock = ['#34d399,#059669', '#60a5fa,#2563eb', '#f9fafb,#d1d5db', '#4ade80,#16a34a'].map((g, i) =>
    `<div class="app" style="left:${7 + i * 94}px;top:753px"><div class="gl" style="background:linear-gradient(160deg,${g})"><i class="${i % 2 ? 'o' : ''}"></i></div></div>`).join('');
  const s = document.createElement('div');
  s.id = 'safari';
  s.className = CLARO ? 'ios-claro' : 'ios-escuro';
  s.innerHTML = `
    <img class="pg" src="${PASTA}/iphone-ajustes.png" alt="">
    ${status(cor)}
    <div class="barra">
      <div class="end"><span>aA</span><span class="url">${SVG.cadeado(cor)}${URL_APP}</span>${SVG.recarregar(cor)}</div>
      <div class="ferr">${SVG.voltar(azul)}${SVG.avancar(azul)}<span id="sf-comp">${SVG.compartilhar(azul)}</span>${SVG.livro(azul)}${SVG.abas(azul)}</div>
    </div>
    <div class="folha" id="sf-folha">
      <div class="cab">${icone}<div class="t"><b>${NOME}</b><span>${URL_APP}</span></div></div>
      <div class="x">✕</div>
      <div class="alvos"><div><i style="background:linear-gradient(160deg,#60a5fa,#2563eb)"></i>AirDrop</div><div><i style="background:linear-gradient(160deg,#4ade80,#16a34a)"></i>Mensagens</div><div><i style="background:linear-gradient(160deg,#7dd3fc,#0284c7)"></i>Mail</div><div><i style="background:linear-gradient(160deg,#fde68a,#f59e0b)"></i>Notas</div></div>
      <div class="grupo" style="top:200px"><div>Copiar${SVG.copiar(cor)}</div><div>Adicionar à Lista de Leitura${SVG.oculos(cor)}</div><div>Adicionar aos Favoritos${SVG.estrela(cor)}</div><div id="sf-linha-inicio">Adicionar à Tela de Início${SVG.mais(cor)}</div><div>Buscar na Página${SVG.lupa(cor)}</div></div>
    </div>
    <div class="adic" id="sf-adic">
      ${status(cor)}
      <div class="nav"><span>Cancelar</span><b>Adicionar à Tela de Início</b><span class="ok" id="sf-ok">Adicionar</span></div>
      <div class="card">${icone}<div class="n"><b>${NOME}</b><span>${URL_APP}</span></div></div>
      <p>Um ícone será adicionado à Tela de Início para que você possa acessar rapidamente este site.</p>
    </div>
    <div class="inicio" id="sf-inicio">
      ${status('#fff')}
      ${apps}
      <div class="app" id="sf-novo" style="left:${col(NOVO)}px;top:${lin(NOVO)}px">${icone}<span>${NOME}</span></div>
      <div class="dock"></div>${dock}
    </div>
    <img class="abre" id="sf-abre" src="${PASTA}/iphone-fila.png" alt="">
    <div class="ilha"></div>
    <div class="home-ind" style="background:${CLARO ? '#000' : '#fff'}"></div>`;
  tela.appendChild(s);
  const q = (sel) => s.querySelector(sel);
  // O Safari entra e sai em corte seco, como a troca de app no celular.
  M.kf(s, 'autoAlpha', [[0, 0], [o.a, 0], [o.a, 1], [o.b, 1], [o.b, 0], [FIM, 0]]);
  // Folha de compartilhar: sobe com o toque em Compartilhar.
  const folha = q('#sf-folha');
  M.kf(folha, 'y', [[0, 600], [o.compartilhar + 2, 600], [o.compartilhar + 14, 0, 'softLand'], [FIM, 0]]);
  M.kf(folha, 'autoAlpha', [[0, 0], [o.compartilhar + 2, 0], [o.compartilhar + 2, 1], [o.telaInicio + 16, 1], [o.telaInicio + 16, 0], [FIM, 0]]);
  // "Adicionar à Tela de Início": a janela sobe por cima.
  const adic = q('#sf-adic');
  M.kf(adic, 'y', [[0, 844], [o.telaInicio + 3, 844], [o.telaInicio + 16, 0, 'softLand'], [FIM, 0]]);
  M.kf(adic, 'autoAlpha', [[0, 0], [o.telaInicio + 3, 0], [o.telaInicio + 3, 1], [o.adicionar + 8, 1], [o.adicionar + 8, 0], [FIM, 0]]);
  // Tela de Início, e o ícone novo chegando.
  const inicio = q('#sf-inicio');
  M.kf(inicio, 'autoAlpha', [[0, 0], [o.adicionar + 8, 0], [o.adicionar + 8, 1], [FIM, 1]]);
  const novo = q('#sf-novo');
  M.kf(novo, 'opacity', [[0, 0], [o.icone, 0], [o.icone + 6, 1, 'softInOut'], [FIM, 1]]);
  M.kf(novo, 'scale', [[0, 1.5], [o.icone, 1.5], [o.icone + 12, 1, 'softLand'], [FIM, 1]]);
  // Toque no ícone: o app abre a partir dele.
  const abre = q('#sf-abre');
  const cx = col(NOVO) + 38, cy = lin(NOVO) + 31;
  abre.style.transformOrigin = `${cx}px ${cy}px`;
  M.kf(abre, 'autoAlpha', [[0, 0], [o.abrir + 2, 0], [o.abrir + 2, 1], [FIM, 1]]);
  M.kf(abre, 'scale', [[0, .16], [o.abrir + 2, .16], [o.abrir + 16, 1, 'softLand'], [FIM, 1]]);
  // Contornos e toques nos pontos que a voz nomeia.
  const at = (sel) => { const el = q(sel); const r = el.getBoundingClientRect(); const b = s.getBoundingClientRect(); return { el, r, b }; };
  void at;
  anel({ x: 177, y: 795, width: 36, height: 36 }, o.compartilhar - 16, o.compartilhar, { pai: s, pad: 4, raio: 12, rotulo: 'Compartilhar' });
  toque(195, 813, o.compartilhar, { pai: s, rotulo: 'Compartilhar' });
  anel({ x: 16, y: 650, width: 358, height: 50 }, o.telaInicio - 18, o.telaInicio, { pai: s, pad: 2, raio: 12, rotulo: 'Adicionar à Tela de Início' });
  toque(195, 675, o.telaInicio, { pai: s, rotulo: 'Adicionar à Tela de Início' });
  anel({ x: 300, y: 64, width: 78, height: 28 }, o.adicionar - 14, o.adicionar, { pai: s, pad: 4, raio: 10, rotulo: 'Adicionar' });
  toque(339, 78, o.adicionar, { pai: s, rotulo: 'Adicionar' });
  anel({ x: col(NOVO) + 7, y: lin(NOVO), width: 62, height: 62 }, o.icone + 10, o.abrir, { pai: s, pad: 4, raio: 18, rotulo: `ícone do ${NOME}` });
  toque(cx, cy, o.abrir, { pai: s, rotulo: `abre o ${NOME}` });
}
