/* Aplicativo: menus, navegação, tela de boot, início, progresso e opções. */
(function () {
  'use strict';
  const { h, janela, store, som } = window.UI;
  const C = window.CURSO_CONTEUDO;
  const aulas = C.aulas;
  const modulos = C.modulos;

  const App = {};
  window.App = App;
  let lab = null, ref = null, livro = null;
  let aulaAtual = store.get('ultimaAula', aulas[0] && aulas[0].id);

  // ---------------- opções / temas ----------------
  function aplicarOpcoes() {
    const o = store.get('opcoes', {});
    const r = document.documentElement;
    if (o.tema && o.tema !== 'borland') r.dataset.tema = o.tema; else delete r.dataset.tema;
    r.dataset.fonte = o.fonte || 'vt323';
    r.dataset.crt = o.crt ? 'sim' : 'nao';
    r.style.setProperty('--fs', o.fonte === 'sistema' ? (o.tamanho ? Math.round(o.tamanho * 0.72) : 15) + 'px' : (o.tamanho || 21) + 'px');
    r.style.setProperty('--code-fs', o.fonte === 'sistema' ? (o.tamanho ? Math.round(o.tamanho * 0.68) : 14) + 'px' : ((o.tamanho || 21) - 1) + 'px');
  }

  // ---------------- diálogos ----------------
  App.dialogo = function (titulo, conteudo, botoes) {
    const fundo = h('div.dlg-fundo');
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    const bts = h('div.botoes');
    for (const [txt, fn] of botoes || [['OK', null]]) bts.append(h('button.btn', { onclick: () => { fechar(); if (fn) fn(); } }, txt));
    const w = janela(titulo, 'dlg cinza', [].concat(conteudo, bts));
    fundo.append(w);
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', esc, true);
    document.body.append(fundo);
    const b = bts.querySelector('button'); if (b) b.focus();
    return fechar;
  };
  App.confirmar = (msg, fn) => App.dialogo('Confirmação', h('p', null, msg), [['Sim', fn], ['Não', null]]);
  App.status = function (msg) {
    const el = document.querySelector('#status .msg');
    if (el) { el.textContent = msg; clearTimeout(App._st); App._st = setTimeout(() => { el.textContent = dicaStatus(); }, 6000); }
  };
  function dicaStatus() {
    const v = location.hash.split('/')[0];
    if (v === '#lab') return 'F9 executa · F7 passo · F2 breakpoint · clique na tela para digitar';
    if (v === '#aula') return 'Ctrl+→ próxima aula · ▶ Executar aqui roda o código passo a passo';
    if (v === '#livro') return 'Ctrl+F busca no livro · os programas completos rodam com ▶ Executar aqui';
    return 'Curso Assembly 8086 · MASM/TASM · DOS 16 bits';
  }

  // ---------------- progresso ----------------
  function progressoAula(a) {
    const exs = a.blocks.filter(b => b.t === 'ex').map(b => b.ex.id);
    const st = store.get('exercicios', {});
    const feitos = exs.filter(id => st[id] && st[id].ok).length;
    const quizzes = a.blocks.filter(b => b.t === 'quiz');
    const qd = store.get('quiz', {});
    let qTot = 0, qResp = 0, qOk = 0;
    quizzes.forEach((b, i) => { qTot += b.qs.length; const r = qd[a.id + ':q' + i] || {}; qResp += Object.keys(r).length; qOk += Object.values(r).filter(Boolean).length; });
    const lidas = store.get('lidas', {});
    const concluida = (exs.length === 0 || feitos === exs.length) && qResp === qTot && (lidas[a.id] || qTot + exs.length > 0);
    return { exs: exs.length, feitos, qTot, qResp, qOk, lida: !!lidas[a.id], concluida: concluida && (lidas[a.id] || exs.length + qTot > 0) };
  }
  App.registrarExercicio = function (id, ok, codigo) {
    const t = store.get('exercicios', {});
    const prev = t[id] || {};
    t[id] = Object.assign(prev, { codigo, ok: prev.ok || ok, tentativas: (prev.tentativas || 0) + 1 });
    store.set('exercicios', t);
    App.atualizarIndice();
  };

  // ---------------- índice ----------------
  let indiceEl;
  App.atualizarIndice = function () {
    if (!indiceEl) return;
    indiceEl.innerHTML = '';
    for (const mod of modulos) {
      const as = aulas.filter(a => a.modulo === mod.id);
      const m = h('div.mod' + (as.length ? '' : '.futuro'));
      m.append(h('div.mt', null, h('span.n', null, mod.id + '.'), h('span', null, mod.titulo)));
      if (!as.length) m.append(h('div.em-breve', null, '(em breve) ' + (mod.descricao || '')));
      for (const a of as) {
        const p = progressoAula(a);
        const chk = p.concluida ? '[√]' : (p.lida || p.feitos || p.qResp) ? '[·]' : '[ ]';
        const it = h('div.aula-it' + (a.id === aulaAtual ? '.atual' : ''), { onclick: () => { location.hash = '#aula/' + a.id; }, title: a.titulo }, h('span.chk', null, chk), h('span.tt', null, a.numero + '. ' + a.titulo));
        m.append(it);
      }
      indiceEl.append(m);
    }
    const at = indiceEl.querySelector('.atual');
    if (at) {
      const r = at.getBoundingClientRect(), p = indiceEl.parentElement.getBoundingClientRect();
      if (r.top < p.top || r.bottom > p.bottom) at.scrollIntoView({ block: 'center' });
    }
  };

  // ---------------- aulas ----------------
  let wLeitura;
  App.mostrarAula = function (id, manterScroll) {
    const a = aulas.find(x => x.id === id) || aulas[0];
    if (!a) return;
    const scroll = wLeitura.corpo.scrollTop;
    aulaAtual = a.id;
    store.set('ultimaAula', a.id);
    wLeitura.setTitulo('AULA' + String(a.numero).padStart(2, '0') + '.TXT');
    wLeitura.corpo.innerHTML = '';
    const el = window.Aula.renderAula(a, modulos);
    const caps = window.Livro ? window.Livro.paraAula(a.id) : [];
    if (caps.length) el.append(h('div.objetivos.livro-ligado', null, h('div.tt', null, 'Para ir além, no Livro da BIOS:'),
      h('ul', { html: caps.map(c => '<li><a href="#livro/' + c.id + '">' + window.UI.escHtml(window.Livro.rotulo(c)) + '</a></li>').join('') })));
    const idx = aulas.indexOf(a);
    const ant = aulas[idx - 1], prox = aulas[idx + 1];
    const lidas = store.get('lidas', {});
    el.append(h('div', { style: { marginTop: '2em', borderTop: '2px solid var(--win-frame)', paddingTop: '.8em', display: 'flex', flexWrap: 'wrap', alignItems: 'center' } },
      ant ? h('button.btn.sec', { onclick: () => { location.hash = '#aula/' + ant.id; } }, '◄ ' + ant.numero + '. ' + ant.titulo) : null,
      h('button.btn', {
        onclick: () => { const l = store.get('lidas', {}); l[a.id] = !l[a.id]; store.set('lidas', l); App.mostrarAula(a.id, true); App.atualizarIndice(); }
      }, lidas[a.id] ? '√ Aula marcada como lida' : 'Marcar como lida'),
      prox ? h('button.btn', { onclick: () => { const l = store.get('lidas', {}); l[a.id] = true; store.set('lidas', l); location.hash = '#aula/' + prox.id; } }, prox.numero + '. ' + prox.titulo + ' ►') : null));
    wLeitura.corpo.append(el);
    wLeitura.corpo.scrollTop = manterScroll ? scroll : 0;
    App.atualizarIndice();
  };

  App.abrirNoLab = function (codigo, opts) {
    lab.carregar(codigo, opts || {});
    location.hash = '#lab';
  };
  App.abrirExemplo = function (id) {
    const ex = EXEMPLOS.find(e => e.id === id);
    if (ex) lab.carregar(ex.codigo, { titulo: ex.arquivo });
  };

  // exemplos do laboratório: todos os blocos de código completos das aulas
  const EXEMPLOS = [];
  for (const a of aulas) {
    let n = 0;
    for (const b of a.blocks) if (b.t === 'asm' && /END\s+\w+/i.test(b.code) && /\.MODEL|SEGMENT/i.test(b.code)) {
      n++;
      EXEMPLOS.push({ id: a.id + '-' + n, aula: a, titulo: 'Aula ' + a.numero + ': ' + (b.titulo || 'exemplo ' + n), codigo: b.code, arquivo: (b.titulo || 'A' + a.numero + 'EX' + n).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) + '.ASM' });
    }
  }

  // ---------------- início ----------------
  function telaInicio() {
    const w = janela('BEM-VINDO.TXT', '', null);
    const logo = h('div.logo', null,
      ' █████╗ ███████╗███████╗███████╗███╗   ███╗██████╗ ██╗  ██╗   ██╗\n' +
      '██╔══██╗██╔════╝██╔════╝██╔════╝████╗ ████║██╔══██╗██║  ╚██╗ ██╔╝\n' +
      '███████║███████╗███████╗█████╗  ██╔████╔██║██████╔╝██║   ╚████╔╝ \n' +
      '██╔══██║╚════██║╚════██║██╔══╝  ██║╚██╔╝██║██╔══██╗██║    ╚██╔╝  \n' +
      '██║  ██║███████║███████║███████╗██║ ╚═╝ ██║██████╔╝███████╗██║   \n' +
      '╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝   \n' +
      '                  ░▒▓█  I N T E L   8 0 8 6  █▓▒░');
    logo.style.fontFamily = "'DejaVu Sans Mono', 'Consolas', monospace";
    const cont = h('div');
    w.corpo.append(logo, cont);
    w.render = () => {
      cont.innerHTML = '';
      const total = aulas.length;
      const concl = aulas.filter(a => progressoAula(a).concluida).length;
      const exT = aulas.reduce((s, a) => s + progressoAula(a).exs, 0);
      const exF = aulas.reduce((s, a) => s + progressoAula(a).feitos, 0);
      const a = aulas.find(x => x.id === aulaAtual) || aulas[0];
      const prox = aulas.find(x => !progressoAula(x).concluida) || a;
      cont.append(h('div.inicio-grid', null,
        h('div', null,
          h('h3', null, 'Programe como em 1990.'),
          h('p', null, 'Um curso interativo de Assembly para o processador Intel 8086, o coração do IBM PC. Você vai escrever programas reais em sintaxe MASM/TASM, executá-los em um 8086 simulado com DOS e BIOS, e acompanhar cada registrador, flag e byte da memória, como os programadores faziam com o DEBUG e o Turbo Debugger.'),
          h('div.cartao', null,
            h('div', { style: { color: 'var(--head2)' } }, 'Continue de onde parou:'),
            h('div', null, 'Aula ' + a.numero + ': ' + a.titulo),
            h('div', { style: { marginTop: '.5em' } },
              h('button.btn', { onclick: () => { location.hash = '#aula/' + a.id; } }, '► Continuar'),
              prox !== a ? h('button.btn.sec', { onclick: () => { location.hash = '#aula/' + prox.id; } }, 'Próxima pendente: ' + prox.numero) : null,
              h('button.btn.sec', { onclick: () => { location.hash = '#lab'; } }, 'Laboratório'),
              h('button.btn.sec', { onclick: () => { location.hash = '#livro'; } }, 'Livro da BIOS')))),
        h('div', null,
          h('h3', null, 'Seu progresso'),
          h('div', null, 'Aulas concluídas: ' + concl + ' de ' + total),
          h('div.barra-prog', null, h('i', { style: { width: (100 * concl / Math.max(1, total)) + '%' } })),
          h('div', null, 'Exercícios resolvidos: ' + exF + ' de ' + exT),
          h('div.barra-prog', null, h('i', { style: { width: (100 * exF / Math.max(1, exT)) + '%' } })),
          h('h3', { style: { marginTop: '.8em' } }, 'Como usar'),
          h('ul', { style: { paddingLeft: '2ch', margin: 0 }, html: '<li>F3 Aulas · F4 Laboratório · F5 Livro da BIOS · F6 Referência</li><li>Nos códigos das aulas, use <b>▶ Executar aqui</b></li><li>No laboratório: F9 executa, F7 passo a passo</li><li>F10 abre o menu; Opções muda cores e fonte</li>' }))));
    };
    return w;
  }

  function telaProgresso() {
    const w = janela('PROGRESSO.DAT', '', null);
    w.render = () => {
      w.corpo.innerHTML = '';
      const linhas = aulas.map(a => {
        const p = progressoAula(a);
        const td = (rot, v) => '<td data-label="' + rot + '"><div>' + v + '</div></td>';
        return '<tr>' + td('Aula', '<a href="#aula/' + a.id + '">' + (p.concluida ? '√ ' : '') + a.numero + '. ' + a.titulo + '</a>') + td('Lida', p.lida ? 'sim' : '—') + td('Quiz', p.qTot ? p.qOk + '/' + p.qTot + (p.qResp < p.qTot ? ' (' + (p.qTot - p.qResp) + ' sem resposta)' : '') : '—') + td('Exercícios', p.exs ? p.feitos + '/' + p.exs : '—') + '</tr>';
      }).join('');
      const div = h('div.aula', { style: { maxWidth: 'none' } });
      div.innerHTML = '<h2>Progresso por aula</h2><div class="tabela ref-tab"><table><thead><tr><th>Aula</th><th>Lida</th><th>Quiz</th><th>Exercícios</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
        '<p>Uma aula fica concluída quando todos os quizzes foram respondidos e todos os exercícios foram resolvidos. O progresso fica salvo neste computador.</p>';
      div.append(
        h('button.btn.sec', { onclick: () => { const dados = JSON.stringify(store.load(), null, 1); window.UI.baixarArquivo('progresso-curso8086.json', dados); } }, 'Exportar progresso'),
        h('button.btn.sec', {
          onclick: () => window.UI.abrirArquivo((n, txt) => {
            try { const d = JSON.parse(txt); localStorage.setItem('curso8086', JSON.stringify(d)); location.reload(); } catch (e) { App.dialogo('Erro', h('p', null, 'Arquivo inválido.')); }
          })
        }, 'Importar progresso'),
        h('button.btn.perigo', { onclick: () => App.confirmar('Apagar todo o progresso (quizzes, exercícios e código salvo)?', () => { const o = store.get('opcoes', {}); store.reset(); store.set('opcoes', o); location.reload(); }) }, 'Zerar progresso'));
      w.corpo.append(div);
    };
    return w;
  }

  function opcoes() {
    const o = Object.assign({ tema: 'borland', fonte: 'vt323', tamanho: 21, crt: false, som: true, boot: true }, store.get('opcoes', {}));
    const sel = (nome, ops) => { const s = h('select', null, ...ops.map(([v, t]) => h('option', { value: v, selected: String(o[nome]) === String(v) }, t))); s.addEventListener('change', () => { o[nome] = s.value; store.set('opcoes', o); aplicarOpcoes(); }); return s; };
    const chk = (nome, txt) => { const c = h('input', { type: 'checkbox' }); c.checked = !!o[nome]; c.addEventListener('change', () => { o[nome] = c.checked; store.set('opcoes', o); aplicarOpcoes(); }); return h('label', null, c, txt); };
    const tam = sel('tamanho', [[17, 'Pequeno'], [19, 'Médio'], [21, 'Normal'], [24, 'Grande'], [27, 'Enorme']]);
    tam.addEventListener('change', () => { o.tamanho = +tam.value; store.set('opcoes', o); aplicarOpcoes(); });
    App.dialogo('Opções', [
      h('label', null, 'Cores:', sel('tema', [['borland', 'Azul Borland (Turbo Pascal / Turbo C)'], ['preto', 'Preto VGA'], ['fosforo', 'Monitor de fósforo verde'], ['ambar', 'Monitor âmbar']])),
      h('label', null, 'Fonte:', sel('fonte', [['vt323', 'Terminal retrô (VT323)'], ['sistema', 'Monoespaçada do sistema (leitura longa)']])),
      h('label', null, 'Tamanho do texto:', tam),
      chk('crt', ' Efeito de tubo CRT (linhas de varredura)'),
      chk('som', ' Som do alto-falante do PC'),
      chk('boot', ' Mostrar a tela de boot ao abrir')
    ], [['Fechar', null]]);
  }

  function sobre() {
    App.dialogo('Sobre', [
      h('pre', { style: { margin: 0, whiteSpace: 'pre-wrap' } },
        'CURSO ASSEMBLY 8086  versão 1.0\n\n' +
        aulas.length + ' aulas · ' + aulas.reduce((s, a) => s + a.blocks.filter(b => b.t === 'ex').length, 0) + ' exercícios · conteúdo de ' + C.geradoEm + '\n\n' +
        'Simulador 8086 com montador MASM/TASM, DOS (INT 21h)\ne BIOS (INT 10h/16h/1Ah) escritos em JavaScript.\n\n' +
        'Fonte VT323 (Peter Hull) sob licença SIL OFL 1.1.\n' +
        'As aulas ficam em conteudo/*.md e podem ser ampliadas.')
    ]);
  }

  function ajuda() {
    App.dialogo('Ajuda', h('div', { style: { maxWidth: '72ch' }, html:
      '<p><b>Navegação:</b> F3 Aulas, F4 Laboratório, F5 Livro da BIOS, F6 Referência, F10 menu. Ctrl+→ e Ctrl+← trocam de aula.</p>' +
      '<p><b>Livro da BIOS:</b> guia de referência e tutorial das interrupções da BIOS do IBM PC e do PS/2, com 22 capítulos e 4 apêndices. Digite na caixa de busca do índice (ou Ctrl+F) para procurar em todo o livro; os links levam às aulas do curso e vice-versa.</p>' +
      '<p><b>Nas aulas:</b> cada código tem <b>▶ Executar aqui</b> (depurador compacto, passo a passo) e <b>Laboratório</b> (depurador completo). Os exercícios são corrigidos automaticamente: o seu código roda no 8086 simulado e o resultado é conferido.</p>' +
      '<p><b>No laboratório:</b> F9 executar, F7 passo, F8 passo por cima, F4 até o cursor, F2 breakpoint, Ctrl+F2 reiniciar, Alt+F5 tela grande. Clique na tela do usuário para digitar quando o programa pedir.</p>' +
      '<p><b>O simulador:</b> executa o conjunto de instruções do 8086 original, com 1 MB de memória, tela de texto em B800h, IVT real, timer (IRQ0/INT 08h) e PIC. Instruções de processadores posteriores são recusadas com uma explicação.</p>'
    }));
  }

  // ---------------- menus ----------------
  const MENUS = [
    ['≡', [['Sobre…', sobre], ['Opções…', opcoes]]],
    ['~A~rquivo', [['Novo programa', () => { location.hash = '#lab'; lab.novo(); }], ['Abrir .ASM…', () => { location.hash = '#lab'; lab.abrir(); }], ['Salvar .ASM', () => lab.salvar()], null, ['Tela inicial', () => { location.hash = '#inicio'; }]]],
    ['A~u~las', () => aulas.map(a => [a.numero + '. ' + a.titulo, () => { location.hash = '#aula/' + a.id; }])],
    ['~L~aboratório', () => [['Abrir laboratório', () => { location.hash = '#lab'; }, 'F4'], ['Executar', () => { location.hash = '#lab'; lab.motor.executar(); }, 'F9'], ['Passo', () => { location.hash = '#lab'; lab.motor.passo(); }, 'F7'], ['Reiniciar', () => { location.hash = '#lab'; lab.motor.reiniciar(); }, 'Ctrl+F2'], ['Tela do usuário', () => { location.hash = '#lab'; lab.telaCheia(); }, 'Alt+F5'], null,
      ...EXEMPLOS.slice(0, 40).map(e => [e.titulo, () => { lab.carregar(e.codigo, { titulo: e.arquivo }); location.hash = '#lab'; }])]],
    ['Livro\u00a0~B~IOS', () => [['Buscar no livro…', () => { location.hash = '#livro/busca'; }, 'Ctrl+F'], null,
      ...window.Livro.capitulos.map(c => [window.Livro.rotulo(c), () => { location.hash = '#livro/' + c.id; }, c.id === 'sumario' ? 'F5' : null])]],
    ['~R~eferência', [['Livro da BIOS', () => { location.hash = '#livro'; }, 'F5'], null, ['Instruções', () => { location.hash = '#ref/instr'; }, 'F6'], ['INT 21h (DOS)', () => { location.hash = '#ref/int21'; }], ['BIOS', () => { location.hash = '#ref/bios'; }], ['Endereçamento e ciclos', () => { location.hash = '#ref/ciclos'; }], ['Tabela ASCII', () => { location.hash = '#ref/ascii'; }], ['Atalhos de teclado', () => { location.hash = '#ref/atalhos'; }]]],
    ['~P~rogresso', [['Ver progresso', () => { location.hash = '#progresso'; }]]],
    ['~O~pções', [['Cores, fonte e som…', opcoes]]],
    ['A~j~uda', [['Ajuda', ajuda, 'F1'], ['Sobre…', sobre]]]
  ];
  let menuAberto = null;
  function fecharMenu() { if (menuAberto) { menuAberto.el.classList.remove('aberto'); menuAberto.dd.remove(); menuAberto = null; } }
  function abrirMenu(mi, itens) {
    fecharMenu();
    const lista = typeof itens === 'function' ? itens() : itens;
    const dd = h('div.dd');
    if (lista.length > 22) { dd.style.maxHeight = '70vh'; dd.style.overflowY = 'auto'; }
    for (const it of lista) {
      if (!it) { dd.append(h('div.sep')); continue; }
      dd.append(h('div.op', { onclick: (e) => { e.stopPropagation(); fecharMenu(); it[1](); } }, h('span', null, it[0]), it[2] ? h('span.atalho', null, it[2]) : null));
    }
    mi.append(dd);
    // em janelas estreitas o menu não pode sair pela direita
    const sobra = dd.getBoundingClientRect().right - (window.innerWidth - 8);
    if (sobra > 0) dd.style.left = -Math.min(sobra, mi.getBoundingClientRect().left) + 'px';
    mi.classList.add('aberto');
    menuAberto = { el: mi, dd };
  }
  function montarMenus(bar) {
    MENUS.forEach(([rot, itens], i) => {
      const html = rot.replace(/~(.)~/g, '<span class="hk">$1</span>');
      const mi = h('div.mi', { html });
      mi.addEventListener('click', (e) => { e.stopPropagation(); if (menuAberto && menuAberto.el === mi) fecharMenu(); else abrirMenu(mi, itens); });
      mi.addEventListener('mouseenter', () => { if (menuAberto && menuAberto.el !== mi) abrirMenu(mi, itens); });
      mi.dataset.idx = i;
      bar.append(mi);
    });
    bar.append(h('div.esp'));
    const rel = h('div.relogio');
    const tick = () => { const d = new Date(); rel.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    tick(); setInterval(tick, 10000);
    bar.append(rel);
    document.addEventListener('click', fecharMenu);
  }

  // ---------------- roteamento ----------------
  const views = {};
  function rota() {
    const [v, arg, ...resto] = location.hash.replace(/^#/, '').split('/');
    const nome = ({ aula: 'aulas', lab: 'lab', ref: 'ref', progresso: 'prog', livro: 'livro' })[v] || 'inicio';
    for (const k of Object.keys(views)) views[k].classList.toggle('ativo', k === nome);
    if (nome === 'aulas') { if (arg !== aulaAtual || !wLeitura.corpo.firstChild) App.mostrarAula(arg || aulaAtual); }
    if (nome === 'inicio') views.inicio.firstChild.render();
    if (nome === 'prog') views.prog.firstChild.render();
    if (nome === 'ref') ref.mostrar(arg);
    if (nome === 'livro') livro.mostrar(arg, resto);
    if (nome === 'lab') lab.render('aba');
    document.querySelector('#status .msg').textContent = dicaStatus();
  }

  function montarStatus(st) {
    const k = (tecla, txt, fn) => h('span.k', { onclick: fn }, h('b', null, tecla), ' ' + txt);
    st.append(
      k('F1', 'Ajuda', ajuda), k('F3', 'Aulas', () => { location.hash = '#aula/' + aulaAtual; }), k('F4', 'Laboratório', () => { location.hash = '#lab'; }),
      k('F5', 'Livro BIOS', () => { location.hash = '#livro'; }), k('F6', 'Referência', () => { location.hash = '#ref'; }), k('F10', 'Menu', () => { abrirMenu(document.querySelector('#menubar .mi[data-idx="1"]'), MENUS[1][1]); }),
      h('span.msg', null, ''));
  }

  function teclado(e) {
    if (document.querySelector('.dlg-fundo')) return;
    const naLab = location.hash.startsWith('#lab');
    if (naLab && lab.teclado(e)) { e.preventDefault(); return; }
    if (e.key === 'F1') { e.preventDefault(); ajuda(); }
    else if (e.key === 'F3') { e.preventDefault(); location.hash = '#aula/' + aulaAtual; }
    else if (e.key === 'F4' && !naLab) { e.preventDefault(); location.hash = '#lab'; }
    else if (e.key === 'F5' && !naLab && !e.altKey && !e.ctrlKey) { e.preventDefault(); location.hash = '#livro'; }
    else if (e.key === 'F6') { e.preventDefault(); location.hash = '#ref'; }
    else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'f' && !naLab && (!/TEXTAREA|INPUT/.test(document.activeElement.tagName) || document.activeElement.classList.contains('livro-busca'))) { e.preventDefault(); if (!location.hash.startsWith('#livro')) { location.hash = '#livro/busca'; rota(); } livro.focarBusca(); }
    else if (e.key === 'F10') { e.preventDefault(); if (menuAberto) fecharMenu(); else abrirMenu(document.querySelector('#menubar .mi[data-idx="1"]'), MENUS[1][1]); }
    else if (e.key === 'Escape' && menuAberto) fecharMenu();
    else if (e.ctrlKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && location.hash.startsWith('#aula') && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) {
      const i = aulas.findIndex(a => a.id === aulaAtual) + (e.key === 'ArrowRight' ? 1 : -1);
      if (aulas[i]) { e.preventDefault(); location.hash = '#aula/' + aulas[i].id; }
    }
  }

  // ---------------- boot ----------------
  function boot(fim) {
    const o = store.get('opcoes', {});
    if (o.boot === false || /[?&]semboot/.test(location.search)) { fim(); return; }
    const el = h('div#boot');
    const pular = h('div.pular', null, 'pressione qualquer tecla para pular');
    document.body.append(el);
    let acabou = false;
    const terminar = () => { if (acabou) return; acabou = true; el.remove(); document.removeEventListener('keydown', terminar); fim(); };
    el.addEventListener('click', terminar);
    document.addEventListener('keydown', terminar);
    const linhas = [
      ['<span class="bw">CURSO BIOS (C) 1981-1990  Versão 8086/4.77</span>', 250],
      ['Processador: Intel 8086 @ 4,77 MHz        Coprocessador: não instalado', 200],
      ['', 0],
      ['MEM', 0],
      ['', 200],
      ['Detectando unidades...', 300],
      ['  Unidade A: 360K 5¼"     Unidade C: 20 MB', 250],
      ['', 0],
      ['Iniciando MS-DOS...', 450],
      ['', 0],
      ['C:\\>CD \\CURSO', 300],
      ['C:\\CURSO>CURSO.EXE', 350]
    ];
    let i = 0, buf = '';
    const prox = () => {
      if (acabou) return;
      if (i >= linhas.length) { setTimeout(terminar, 350); return; }
      const [txt, ms] = linhas[i++];
      if (txt === 'MEM') {
        let k = 0;
        const cont = () => {
          if (acabou) return;
          k += 32;
          el.innerHTML = buf + 'Teste de memória: <span class="by">' + String(Math.min(k, 640)).padStart(3) + 'K</span>' + (k >= 640 ? ' OK' : '') + '\n' + '<span class="cursor">_</span>';
          el.append(pular);
          if (k < 640) setTimeout(cont, 22); else { buf += 'Teste de memória: <span class="by">640K</span> OK\n'; som.bip(1000, 60); setTimeout(prox, 150); }
        };
        cont();
        return;
      }
      buf += txt + '\n';
      el.innerHTML = buf + '<span class="cursor">_</span>';
      el.append(pular);
      setTimeout(prox, ms);
    };
    prox();
  }

  // ---------------- inicialização ----------------
  App.iniciar = function () {
    aplicarOpcoes();
    const app = document.getElementById('app');
    const bar = h('div#menubar');
    const main = h('div#main');
    const st = h('div#status');
    app.append(bar, main, st);
    document.body.append(h('div#crt'));
    montarMenus(bar);
    montarStatus(st);

    views.inicio = h('div.view#v-inicio', null, telaInicio());
    indiceEl = h('div');
    const wIndice = janela('ÍNDICE', 'indice', indiceEl);
    wLeitura = janela('AULA.TXT', 'leitura', null);
    views.aulas = h('div.view#v-aulas', null, wIndice, wLeitura);
    views.lab = h('div.view#v-lab');
    ref = window.Referencia.criar();
    views.ref = h('div.view#v-ref', null, janela('REFERENCIA.HLP', 'ref', ref.el));
    livro = window.Livro.criar();
    views.livro = livro.view;
    views.prog = h('div.view#v-prog', null, telaProgresso());
    for (const v of Object.values(views)) main.append(v);
    lab = new window.Depurador.Laboratorio(views.lab, App);
    for (const e of EXEMPLOS) lab.selExemplo.append(h('option', { value: e.id }, e.titulo));
    lab.selExemplo.prepend(h('option', { value: '' }, 'Exemplos das aulas…'));
    lab.selExemplo.value = '';

    window.addEventListener('hashchange', rota);
    document.addEventListener('keydown', teclado);
    boot(() => { rota(); });
  };

  document.addEventListener('DOMContentLoaded', App.iniciar);
})();
