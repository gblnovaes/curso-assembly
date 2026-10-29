/* Renderização das aulas: texto, código executável, quizzes, exercícios e simuladores. */
(function () {
  'use strict';
  const { h, realce, store, som, escHtml } = window.UI;

  function blocoCodigo(b, aula) {
    const pre = h('pre.asm', { html: realce(b.code) });
    const wrap = h('div.codigo');
    let mini = null;
    const bar = h('div.cbar', null, h('span.tt', null, b.titulo || 'Assembly 8086'),
      h('button', { onclick: () => { navigator.clipboard && navigator.clipboard.writeText(b.code); window.App.status('Código copiado.'); }, title: 'Copiar o código' }, 'Copiar'),
      (b.jogo || b.boot) ? h('button.jogar', { onclick: () => new window.Depurador.Jogador(b.code, { titulo: b.titulo || 'JOGO', arquivo: (b.titulo || 'JOGO').toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 8) + '.ASM' }), title: b.boot ? 'Liga um PC sem DOS e dá boot por este disquete, em tela grande' : 'Joga em tela grande, em tempo real, com o teclado' }, b.boot ? '▶ Dar boot' : '▶ Jogar') : null,
      h('button', { onclick: () => window.App.abrirNoLab(b.code, { titulo: (b.titulo || ('AULA' + aula.numero)).toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 8) + '.ASM', parametros: b.parametros }), title: 'Abrir no laboratório (depurador completo)' }, 'Laboratório'),
      b.soLeitura ? null : h('button', {
        onclick: () => {
          if (mini) { mini.el.remove(); mini = null; return; }
          mini = new window.Depurador.MiniDepurador(b.code, { parametros: b.parametros });
          wrap.after(mini.el);
        }, title: 'Executa aqui mesmo, passo a passo'
      }, '▶ Executar aqui'));
    wrap.append(bar, pre);
    return wrap;
  }

  // Código NASM da trilha avançada: roda na máquina 386
  function blocoNasm(b) {
    const U = window.Maquina386UI;
    const pre = h('pre.asm', { html: U.realce(b.code) });
    const wrap = h('div.codigo');
    let painel = null;
    const bar = h('div.cbar', null, h('span.tt', null, b.titulo || 'NASM · 386'),
      h('button', { onclick: () => { navigator.clipboard && navigator.clipboard.writeText(b.code); window.App.status('Código copiado.'); }, title: 'Copiar o código' }, 'Copiar'),
      b.soLeitura ? null : h('button', {
        onclick: () => {
          if (painel) { painel.parar(); painel.el.remove(); painel = null; return; }
          painel = new U.Painel386(b.code, { modo: b.modo, org: b.org, entrada: b.entrada });
          wrap.after(painel.el);
        }, title: 'Executa aqui mesmo, na máquina 386 do curso'
      }, '▶ Executar aqui'));
    wrap.append(bar, pre);
    return wrap;
  }

  function blocoQuiz(b, aula, idx) {
    const key = aula.id + ':q' + idx;
    const salvo = store.get('quiz', {})[key] || {};
    const el = h('div.quiz', null, h('div.qt', null, '?? Quiz: teste seu entendimento'));
    const placar = h('div.placar');
    const atualizarPlacar = () => {
      const r = store.get('quiz', {})[key] || {};
      const resp = Object.keys(r).length, certas = Object.values(r).filter(Boolean).length;
      placar.textContent = resp === b.qs.length ? 'Resultado: ' + certas + ' de ' + b.qs.length + (certas === b.qs.length ? ' — perfeito!' : '. Releia as explicações acima.') : resp + ' de ' + b.qs.length + ' respondidas.';
    };
    b.qs.forEach((q, qi) => {
      const qEl = h('div.q', null, h('div.enun', { html: (qi + 1) + '. ' + q.q }));
      const ops = q.ops.map((o, oi) => h('button.op', { html: '<span class="mk">' + String.fromCharCode(97 + oi) + ')</span>' + o.t }));
      const exp = h('div.exp', { html: q.exp, style: { display: 'none' } });
      const responder = (oi, silencioso) => {
        ops.forEach((btn, k) => {
          btn.disabled = true;
          if (q.ops[k].ok) btn.classList.add('certa');
          if (k === oi && !q.ops[k].ok) btn.classList.add('errada');
        });
        if (q.exp) exp.style.display = 'block';
        if (!silencioso) {
          const tudo = store.get('quiz', {});
          tudo[key] = tudo[key] || {};
          tudo[key][qi] = q.ops[oi].ok;
          store.set('quiz', tudo);
          som.bip(q.ops[oi].ok ? 1200 : 200, q.ops[oi].ok ? 60 : 180);
          atualizarPlacar();
          window.App.atualizarIndice();
        }
      };
      ops.forEach((btn, oi) => btn.addEventListener('click', () => responder(oi)));
      if (salvo[qi] !== undefined) responder(q.ops.findIndex(o => o.ok === salvo[qi]) >= 0 ? q.ops.findIndex(o => o.ok === salvo[qi]) : 0, true);
      qEl.append(...ops, exp);
      el.append(qEl);
    });
    el.append(placar, h('button.btn.sec', {
      onclick: () => { const t = store.get('quiz', {}); delete t[key]; store.set('quiz', t); window.App.mostrarAula(aula.id, true); }, style: { marginTop: '.5em' }
    }, 'Refazer quiz'));
    atualizarPlacar();
    return el;
  }

  function blocoExercicio(b, aula) {
    const ex = b.ex;
    const e386 = ex.maquina === '386';
    const V = e386 ? window.Verificador386 : window.Verificador;
    const rl = e386 ? window.Maquina386UI.realce : realce;
    let painel = null;
    const estado = () => store.get('exercicios', {})[ex.id] || {};
    const st = estado();
    const ed = window.Depurador.criarEditor(st.codigo || ex.inicial || '', {
      mini: true, realce: e386 ? rl : undefined, onChange: (v) => { const t = store.get('exercicios', {}); t[ex.id] = Object.assign(t[ex.id] || {}, { codigo: v }); store.set('exercicios', t); }
    });
    const linhas = (st.codigo || ex.inicial || '').split('\n').length;
    ed.el.style.height = Math.min(26, Math.max(8, linhas + 2)) * 1.15 + 'em';
    ed.el.style.minHeight = '6em';
    const res = h('div.resultado');
    const badge = h('span.estado' + (st.ok ? '.ok' : ''), null, st.ok ? '√ resolvido' : '');
    const dicas = h('div');
    let nDica = 0;
    const regras = [];
    if (ex.proibir) regras.push('proibido usar: ' + ex.proibir.join(', '));
    if (ex.exigir) regras.push('obrigatório usar: ' + ex.exigir.map(x => x.replace('|', ' ou ')).join(', '));
    if (ex.maxBytes) regras.push('no máximo ' + ex.maxBytes + ' bytes de código');
    if (ex.maxCiclos) regras.push('no máximo ' + ex.maxCiclos + ' ciclos');
    const verificar = () => {
      const r = V.verificar(ex, ed.valor);
      res.innerHTML = '';
      for (const msg of V.mensagens(r)) {
        const d = h('div', { class: msg.t === 'ok' ? 'r-ok' : msg.t === 'erro' ? 'r-bad' : '' }, msg.msg);
        if (msg.line) { d.style.cursor = 'pointer'; d.addEventListener('click', () => ed.irPara(msg.line)); }
        res.append(d);
      }
      window.App.registrarExercicio(ex.id, r.ok, ed.valor);
      badge.textContent = (estado().ok ? '√ resolvido' : '');
      badge.classList.toggle('ok', !!estado().ok);
      som.bip(r.ok ? 1200 : 220, r.ok ? 90 : 200);
    };
    const el = h('div.exercicio', null,
      h('div.et', null, h('span', null, '■ Exercício ' + ex.id.replace(/^.*?-/, '') + ': ' + ex.titulo), h('span.nivel', null, '★'.repeat(ex.nivel || 1) + '☆'.repeat(3 - (ex.nivel || 1))), badge),
      h('div', { html: ex.enunciado || '' }),
      regras.length ? h('div.regras', null, 'Regras: ' + regras.join('; ') + '.') : null,
      ed.el,
      h('div.acoes', null,
        h('button.btn', { onclick: verificar }, '√ Verificar'),
        e386 ? h('button.btn.sec', {
          onclick: () => {
            if (painel) { painel.parar(); painel.el.remove(); }
            painel = new window.Maquina386UI.Painel386(ed.valor, { modo: ex.modo, org: ex.org });
            res.before(painel.el);
          }, title: 'Roda o seu código na máquina 386, passo a passo'
        }, '▶ Rodar na máquina 386') :
        h('button.btn.sec', { onclick: () => window.App.abrirNoLab(ed.valor, { titulo: ex.id.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '.ASM', exercicio: ex }) }, 'Depurar no laboratório'),
        ex.dicas && ex.dicas.length ? h('button.btn.sec', {
          onclick: () => {
            if (nDica < ex.dicas.length) { dicas.append(h('div.dica-box', { html: 'Dica ' + (nDica + 1) + ': ' + ex.dicas[nDica] })); nDica++; }
            else window.App.status('Não há mais dicas.');
          }
        }, 'Dica') : null,
        h('button.btn.sec', {
          onclick: () => {
            if (!ex.inicial) return;
            window.App.confirmar('Voltar ao código inicial do exercício? Seu código atual será perdido.', () => { ed.valor = ex.inicial; const t = store.get('exercicios', {}); if (t[ex.id]) delete t[ex.id].codigo; store.set('exercicios', t); });
          }
        }, 'Recomeçar'),
        ex.solucao ? h('button.btn.sec', {
          onclick: () => window.App.confirmar(estado().ok ? 'Ver a solução de referência?' : 'Tem certeza? Tentar mais um pouco ensina muito. Ver a solução mesmo assim?', () => {
            window.App.dialogo('Solução: ' + ex.titulo, h('pre.asm', { html: rl(ex.solucao), style: { maxHeight: '60vh', overflow: 'auto' } }),
              [['Copiar para o editor', () => { ed.valor = ex.solucao; }], ['Fechar', null]]);
          })
        }, 'Solução') : null),
      dicas, res);
    return el;
  }

  // Blocos de uma aula (ou de um capítulo do livro) dentro de el
  function renderBlocos(el, aula, blocks) {
    let qi = 0;
    for (const b of blocks) {
      switch (b.t) {
        case 'html': el.append(h('div', { html: b.html })); break;
        case 'asm': el.append(blocoCodigo(b, aula)); break;
        case 'nasm': el.append(blocoNasm(b)); break;
        case 'quiz': el.append(blocoQuiz(b, aula, qi++)); break;
        case 'ex': el.append(blocoExercicio(b, aula)); break;
        case 'widget': el.append(window.Widgets.criar(b.nome, b.params)); break;
        case 'diagrama':
          if (b.titulo) el.append(h('div.diag-t', null, b.titulo));
          el.append(h('pre.diag', null, b.text)); break;
        case 'nota': {
          const rot = { dica: 'DICA', atencao: 'ATENÇÃO', anos90: 'NOS ANOS 90', cpu: aula.modulo >= 17 ? 'POR DENTRO DO 386' : 'POR DENTRO DO 8086', resumo: 'RESUMO' }[b.tipo] || b.tipo.toUpperCase();
          el.append(h('div.nota.' + b.tipo, null, h('div.nt', { html: '[ ' + rot + (b.titulo ? ': ' + b.titulo : '') + ' ]' }), h('div', { html: b.html })));
          break;
        }
      }
    }
    el.querySelectorAll('pre.asm-hl').forEach(p => { p.innerHTML = realce(p.textContent); });
  }

  function renderAula(aula, modulos) {
    const mod = modulos.find(m => m.id === aula.modulo) || {};
    const el = h('div.aula');
    el.append(h('div.cab', null,
      h('div.num', null, 'Módulo ' + aula.modulo + ' · ' + (mod.titulo || '') + ' · Aula ' + aula.numero + (aula.duracao ? ' · ' + aula.duracao : '')),
      h('h1', null, aula.titulo),
      aula.subtitulo ? h('div.sub', null, aula.subtitulo) : null));
    if (aula.objetivos.length) el.append(h('div.objetivos', null, h('div.tt', null, 'Nesta aula você vai:'), h('ul', { html: aula.objetivos.map(o => '<li>' + o + '</li>').join('') })));
    renderBlocos(el, aula, aula.blocks);
    return el;
  }

  window.Aula = { renderAula, renderBlocos };
})();
