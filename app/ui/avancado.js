/* Trilha avançada (386 e modo protegido): índice e leitura próprios, à parte do curso principal.
   O conteúdo vem de app/conteudo386.js (conteudo-386/*.md). Enquanto está em construção, a
   trilha só aparece com a opção "Mostrar a trilha avançada" ligada ou com ?avancado na URL. */
(function () {
  'use strict';
  const { h, janela, store } = window.UI;
  const T = window.CURSO_386 || { modulos: [], aulas: [] };
  const aulas = T.aulas, modulos = T.modulos;

  function ativa() {
    return !!store.get('opcoes', {}).avancado || /[?&]avancado\b/.test(location.search);
  }

  function criar(App) {
    let aulaAtual = store.get('ultimaAula386', aulas[0] && aulas[0].id);
    const indiceEl = h('div');
    const wIndice = janela('AVANÇADO', 'indice', indiceEl);
    const wLeitura = janela('AULA.TXT', 'leitura', null);
    const view = h('div.view#v-avancado', null, wIndice, wLeitura);

    function atualizarIndice() {
      indiceEl.innerHTML = '';
      indiceEl.append(h('div.em-breve', null, 'Trilha em construção: 386, modo protegido e sistemas operacionais.'));
      for (const mod of modulos) {
        const as = aulas.filter(a => a.modulo === mod.id);
        const m = h('div.mod' + (as.length ? '' : '.futuro'));
        m.append(h('div.mt', null, h('span.n', null, mod.id + '.'), h('span', null, mod.titulo)));
        if (!as.length) m.append(h('div.em-breve', null, '(em breve) ' + (mod.descricao || '')));
        for (const a of as) {
          const p = App.progressoAula(a);
          const chk = p.concluida ? '[√]' : (p.lida || p.feitos || p.qResp) ? '[·]' : '[ ]';
          m.append(h('div.aula-it' + (a.id === aulaAtual ? '.atual' : ''), { onclick: () => { location.hash = '#avancado/' + a.id; }, title: a.titulo },
            h('span.chk', null, chk), h('span.tt', null, a.numero + '. ' + a.titulo)));
        }
        indiceEl.append(m);
      }
    }

    function mostrar(id, manterScroll) {
      const a = aulas.find(x => x.id === id) || aulas.find(x => x.id === aulaAtual) || aulas[0];
      wLeitura.corpo.innerHTML = '';
      if (!a) { wLeitura.corpo.append(h('p', null, 'Ainda não há aulas nesta trilha.')); atualizarIndice(); return; }
      const scroll = wLeitura.corpo.scrollTop;
      aulaAtual = a.id;
      store.set('ultimaAula386', a.id);
      wLeitura.setTitulo('AULA' + String(a.numero).padStart(2, '0') + '.TXT');
      const el = window.Aula.renderAula(a, modulos);
      const idx = aulas.indexOf(a);
      const ant = aulas[idx - 1], prox = aulas[idx + 1];
      const lidas = store.get('lidas', {});
      el.append(h('div', { style: { marginTop: '2em', borderTop: '2px solid var(--win-frame)', paddingTop: '.8em', display: 'flex', flexWrap: 'wrap', alignItems: 'center' } },
        ant ? h('button.btn.sec', { onclick: () => { location.hash = '#avancado/' + ant.id; } }, '◄ ' + ant.numero + '. ' + ant.titulo) : null,
        h('button.btn', {
          onclick: () => { const l = store.get('lidas', {}); l[a.id] = !l[a.id]; store.set('lidas', l); mostrar(a.id, true); }
        }, lidas[a.id] ? '√ Aula marcada como lida' : 'Marcar como lida'),
        prox ? h('button.btn', { onclick: () => { const l = store.get('lidas', {}); l[a.id] = true; store.set('lidas', l); location.hash = '#avancado/' + prox.id; } }, prox.numero + '. ' + prox.titulo + ' ►') : null));
      wLeitura.corpo.append(el);
      wLeitura.corpo.scrollTop = manterScroll ? scroll : 0;
      atualizarIndice();
    }

    function itensMenu() {
      return aulas.length ? aulas.map(a => [a.numero + '. ' + a.titulo, () => { location.hash = '#avancado/' + a.id; }])
        : [['(ainda sem aulas)', () => { location.hash = '#avancado'; }]];
    }

    return { view, mostrar, atualizarIndice, itensMenu, aulaAtual: () => aulaAtual };
  }

  window.Avancado = { criar, ativa, aulas, modulos };
})();
