/* Livro da BIOS: sumário, leitura dos capítulos e busca no texto inteiro. */
(function () {
  'use strict';
  const { h, janela, store, escHtml } = window.UI;
  const L = window.CURSO_LIVRO || { partes: [], capitulos: [] };
  const caps = L.capitulos;

  // ---------------- busca ----------------
  // Texto normalizado (minúsculas, sem acentos) e, para cada caractere dele,
  // a posição no texto original, para marcar o trecho encontrado.
  function normalizar(s) {
    let t = '';
    const mapa = [];
    for (let i = 0; i < s.length; i++) {
      const d = s[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const c of d) { t += c; mapa.push(i); }
    }
    mapa.push(s.length);
    return { t, mapa };
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // "AH=4FH" também acha "AH = 4FH"
  const termoRe = (t) => escRe(t).replace(/([=,:])/g, '\\s*$1\\s*');
  const VAZIAS = new Set('a o e as os de da do das dos em na no nas nos um uma com por para que se ao'.split(' '));
  function preparar(q) {
    const n = normalizar(q.trim()).t.replace(/\s*([=,:])\s*/g, '$1');
    const palavras = n.split(/\s+/).filter(Boolean);
    // "buffer do teclado": o "do" só conta na frase inteira
    let termos = palavras.filter(t => !VAZIAS.has(t));
    if (!termos.length) termos = palavras;
    if (!termos.length) return null;
    // termos curtos só no começo de uma palavra ("ah" não acha "trabalho")
    const re = (t) => (t.length <= 2 ? '(?<![a-z0-9])' : '') + termoRe(t);
    return {
      termos: termos.map(t => new RegExp(re(t), 'g')),
      frase: palavras.length > 1 ? new RegExp(palavras.map(termoRe).join('\\s+'), 'g') : null,
      todos: new RegExp(termos.slice().sort((a, b) => b.length - a.length).map(re).join('|'), 'g')
    };
  }
  const conta = (re, s, max) => { re.lastIndex = 0; let n = 0; while (n < max && re.exec(s)) n++; return n; };

  let indice = null;
  function montarIndice() {
    if (indice) return indice;
    indice = [];
    for (const c of caps) for (const s of c.busca) {
      indice.push({ cap: c, sec: s, nt: normalizar(s.titulo).t, n: normalizar(s.texto) });
    }
    return indice;
  }

  function buscar(q) {
    const p = preparar(q);
    if (!p) return [];
    const res = [];
    for (const e of montarIndice()) {
      let pontos = 0, ok = true;
      for (const re of p.termos) {
        const nt = conta(re, e.nt, 3), nx = conta(re, e.n.t, 8);
        if (!nt && !nx) { ok = false; break; }
        pontos += nt * 12 + nx;
      }
      if (!ok) continue;
      if (p.frase) pontos += conta(p.frase, e.nt, 2) * 40 + conta(p.frase, e.n.t, 5) * 6;
      if (!e.sec.id) pontos -= 2; // a abertura do capítulo perde para a seção específica
      res.push({ e, pontos });
    }
    res.sort((a, b) => b.pontos - a.pontos || caps.indexOf(a.e.cap) - caps.indexOf(b.e.cap));
    return res.map(r => Object.assign(r, { p }));
  }

  // Trecho do texto em volta da primeira ocorrência, com os termos marcados
  function trecho(e, p) {
    const txt = e.sec.texto;
    let ini = -1;
    for (const re of [p.frase, p.todos]) {
      if (!re || ini >= 0) continue;
      re.lastIndex = 0;
      const m = re.exec(e.n.t);
      if (m) ini = e.n.mapa[m.index];
    }
    if (ini < 0) ini = 0;
    let a = Math.max(0, ini - 70), b = Math.min(txt.length, ini + 170);
    if (a > 0) { const sp = txt.indexOf(' ', a); if (sp >= 0 && sp < ini) a = sp + 1; }
    if (b < txt.length) { const sp = txt.lastIndexOf(' ', b); if (sp > ini) b = sp; }
    return (a > 0 ? '… ' : '') + marcar(txt.slice(a, b), p.todos) + (b < txt.length ? ' …' : '');
  }
  function marcar(s, re) {
    const n = normalizar(s);
    let out = '', ult = 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(n.t))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      const i = n.mapa[m.index], f = n.mapa[m.index + m[0].length];
      out += escHtml(s.slice(ult, i)) + '<mark>' + escHtml(s.slice(i, f)) + '</mark>';
      ult = f;
    }
    return out + escHtml(s.slice(ult));
  }
  // Marca os termos nos nós de texto do capítulo aberto
  function marcarNoDom(raiz, re) {
    const nos = [];
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) nos.push(w.currentNode);
    let primeiro = null;
    for (const no of nos) {
      if (no.parentElement.closest('button, .cbar')) continue;
      const s = no.nodeValue;
      const html = marcar(s, re);
      if (html === escHtml(s)) continue;
      const tmp = document.createElement('span');
      tmp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.append(tmp.firstChild);
      if (!primeiro) primeiro = frag.querySelector('mark');
      no.replaceWith(frag);
    }
    return primeiro;
  }

  // ---------------- nomes ----------------
  const parteDe = (c) => L.partes.find(p => p.id === c.parte);
  function rotulo(c) {
    if (c.id === 'sumario') return 'Sumário e como usar';
    return c.parte === 'apendices' ? c.titulo : c.numero + '. ' + c.titulo;
  }
  function nomeCurto(c) {
    if (c.id === 'sumario') return 'Sumário';
    if (c.parte === 'apendices') return c.titulo.split(' · ')[0];
    return 'Cap. ' + c.numero;
  }

  function criar() {
    const aulas = (window.CURSO_CONTEUDO || { aulas: [] }).aulas;
    let atual = store.get('ultimoCapitulo', 'sumario');
    let consulta = '';
    let destaque = null;

    const busca = h('input.ref-busca.livro-busca', { type: 'search', placeholder: 'Buscar no livro…', title: 'Busca em todos os capítulos e apêndices (ex.: INT 16H, AH=02H, 40:6C, scan code)' });
    const lista = h('div');
    const wIndice = janela('LIVRO.IDX', 'indice', [busca, lista]);
    const wLeitura = janela('BIOS.TXT', 'leitura', null);
    const view = h('div.view#v-livro', null, wIndice, wLeitura);

    function indiceLateral() {
      lista.innerHTML = '';
      const item = (c) => h('div.aula-it' + (c.id === atual && !consulta ? '.atual' : ''), { onclick: () => { location.hash = '#livro/' + c.id; }, title: c.titulo },
        h('span.chk', null, c.parte === 'apendices' ? c.titulo.replace(/^Apêndice (\w).*$/, '$1.') : c.id === 'sumario' ? '≡' : c.numero + '.'),
        h('span.tt', null, c.id === 'sumario' ? 'Sumário e como usar' : c.parte === 'apendices' ? c.titulo.replace(/^Apêndice \w · /, '') : c.titulo));
      const sum = caps.find(c => c.id === 'sumario');
      if (sum) lista.append(h('div.mod', null, item(sum)));
      for (const p of L.partes) {
        const cs = caps.filter(c => c.parte === p.id);
        const m = h('div.mod' + (cs.length ? '' : '.futuro'));
        m.append(h('div.mt', null, p.romano ? h('span.n', null, p.romano + '.') : null, h('span', null, p.titulo)));
        if (!cs.length) m.append(h('div.em-breve', null, '(em preparação) capítulos 20 em diante'));
        cs.forEach(c => m.append(item(c)));
        lista.append(m);
      }
      const at = lista.querySelector('.atual');
      if (at) {
        const r = at.getBoundingClientRect(), pr = wIndice.corpo.getBoundingClientRect();
        if (r.top < pr.top || r.bottom > pr.bottom) at.scrollIntoView({ block: 'center' });
      }
    }

    function capitulo(id, secao, manterBusca) {
      const c = caps.find(x => x.id === id) || caps[0];
      if (!c) return;
      const mudou = c.id !== atual || !wLeitura.corpo.querySelector('.livro-cap');
      atual = c.id;
      consulta = '';
      if (!destaque && !manterBusca) busca.value = '';
      store.set('ultimoCapitulo', c.id);
      const vis = store.get('livroVisitados', {});
      if (!vis[c.id]) { vis[c.id] = 1; store.set('livroVisitados', vis); }
      wLeitura.setTitulo(c.id === 'sumario' ? 'BIOS.TXT' : (c.parte === 'apendices' ? 'APEND' + c.id.slice(2) : 'CAP' + String(c.numero).padStart(2, '0')) + '.TXT');
      if (mudou || destaque) {
        wLeitura.corpo.innerHTML = '';
        const el = h('div.aula.livro-cap');
        const p = parteDe(c);
        el.append(h('div.cab', null,
          h('div.num', null, 'Livro da BIOS' + (p ? ' · ' + (p.romano ? 'Parte ' + p.romano + ' · ' : '') + p.titulo : '') + (c.parte !== 'apendices' && c.numero ? ' · Capítulo ' + c.numero : '')),
          h('h1', null, c.titulo)));
        const rel = c.aulas.map(a => aulas.find(x => x.id === a)).filter(Boolean);
        if (rel.length) el.append(h('div.objetivos', null, h('div.tt', null, 'Aulas do curso ligadas a este capítulo:'),
          h('ul', { html: rel.map(a => '<li><a href="#aula/' + a.id + '">Aula ' + a.numero + ': ' + escHtml(a.titulo) + '</a></li>').join('') })));
        if (c.secoes.length > 3) {
          const d = h('details.livro-secoes', null, h('summary', null, 'Seções deste capítulo (' + c.secoes.length + ')'),
            h('ul', { html: c.secoes.map(s => '<li><a href="#livro/' + c.id + '/' + s.id + '">' + escHtml(s.titulo) + '</a></li>').join('') }));
          el.append(d);
        }
        window.Aula.renderBlocos(el, { id: 'livro-' + c.id, numero: c.numero, titulo: c.titulo }, c.blocks);
        const i = caps.indexOf(c), ant = caps[i - 1], prox = caps[i + 1];
        el.append(h('div.livro-nav', null,
          ant ? h('button.btn.sec', { onclick: () => { location.hash = '#livro/' + ant.id; } }, '◄ ' + nomeCurto(ant)) : null,
          h('button.btn.sec', { onclick: () => { location.hash = '#livro/sumario'; } }, 'Sumário'),
          prox ? h('button.btn', { onclick: () => { location.hash = '#livro/' + prox.id; } }, nomeCurto(prox) + ': ' + prox.titulo.replace(/^Apêndice \w · /, '') + ' ►') : null));
        wLeitura.corpo.append(el);
      }
      let alvo = secao ? wLeitura.corpo.querySelector('[id="' + secao.replace(/"/g, '') + '"]') : null;
      if (destaque) {
        const m = marcarNoDom(wLeitura.corpo.querySelector('.livro-cap'), destaque);
        if (!alvo && m) alvo = m;
        destaque = null;
      }
      if (alvo) {
        alvo.scrollIntoView({ block: alvo.tagName === 'MARK' ? 'center' : 'start' });
        alvo.classList.add('alvo');
        setTimeout(() => alvo.classList.remove('alvo'), 1600);
      } else if (mudou) wLeitura.corpo.scrollTop = 0;
      indiceLateral();
    }

    function resultados(q) {
      consulta = q;
      wLeitura.setTitulo('BUSCA.TXT');
      wLeitura.corpo.innerHTML = '';
      const el = h('div.aula.livro-res');
      const rs = buscar(q);
      el.append(h('div.cab', null, h('div.num', null, 'Livro da BIOS · busca'), h('h1', null, rs.length ? rs.length + ' trecho' + (rs.length > 1 ? 's' : '') + ' para "' + q + '"' : 'Nada encontrado para "' + q + '"')));
      if (!rs.length) el.append(h('p', { html: 'Tente outra grafia ou um termo mais curto. Exemplos: <code>INT 13H</code>, <code>AH=02H</code>, <code>40:6C</code>, <code>scan code</code>, <code>Ctrl-Break</code>, <code>DMA</code>.' }));
      const MAX = 80;
      rs.slice(0, MAX).forEach(({ e, p }) => {
        const dest = '#livro/' + e.cap.id + (e.sec.id ? '/' + e.sec.id : '');
        el.append(h('div.res-busca', {
          onclick: () => { destaque = p.frase && conta(p.frase, e.n.t, 1) ? p.frase : p.todos; history.replaceState(null, '', '#livro/busca/' + encodeURIComponent(q)); location.hash = dest; }
        },
          h('div.rt', { html: '<span class="rc">' + escHtml(nomeCurto(e.cap)) + '</span> ' + marcar(e.sec.id ? e.sec.titulo : e.cap.titulo, p.todos) }),
          h('div.rx', { html: trecho(e, p) })));
      });
      if (rs.length > MAX) el.append(h('p', null, 'Mostrando os ' + MAX + ' trechos mais relevantes. Acrescente palavras para refinar a busca.'));
      wLeitura.corpo.append(el);
      wLeitura.corpo.scrollTop = 0;
      indiceLateral();
    }

    let tm = null;
    busca.addEventListener('input', () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const q = busca.value.trim();
        if (q.length < 2) { if (consulta) { consulta = ''; history.replaceState(null, '', '#livro/' + atual); capitulo(atual); } return; }
        history.replaceState(null, '', '#livro/busca/' + encodeURIComponent(q));
        resultados(q);
      }, 160);
    });
    busca.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const r = wLeitura.corpo.querySelector('.res-busca'); if (r) r.click(); }
      else if (e.key === 'Escape' && busca.value) { e.stopPropagation(); busca.value = ''; busca.dispatchEvent(new Event('input')); }
    });

    return {
      view,
      focarBusca() { busca.focus(); setTimeout(() => busca.focus(), 30); },
      mostrar(arg, resto) {
        if (arg === 'busca') {
          const q = decodeURIComponent((resto || []).join('/'));
          if (q) busca.value = q;
          if (q.trim().length >= 2) resultados(q.trim());
          else { if (!wLeitura.corpo.querySelector('.livro-cap')) capitulo(atual, null, true); this.focarBusca(); }
          return;
        }
        capitulo(arg || atual, resto && resto[0] ? decodeURIComponent(resto[0]) : null);
      }
    };
  }

  // capítulos que complementam uma aula (para o rodapé das aulas)
  const paraAula = (id) => caps.filter(c => c.aulas.includes(id));

  window.Livro = { criar, paraAula, rotulo, capitulos: caps };
})();
