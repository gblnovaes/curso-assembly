/* Utilidades de interface: criação de elementos, armazenamento, som e realce de sintaxe. */
(function () {
  'use strict';

  function h(tag, attrs, ...kids) {
    const parts = tag.split(/(?=[.#])/);
    const el = document.createElement(parts[0] || 'div');
    for (const p of parts.slice(1)) {
      if (p[0] === '.') el.classList.add(p.slice(1)); else el.id = p.slice(1);
    }
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) {
      if (k === null || k === undefined || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }

  // Janela no estilo Turbo Vision
  function janela(titulo, cls, corpo, opts) {
    opts = opts || {};
    const w = h('div.win' + (cls ? '.' + cls.split(' ').join('.') : ''));
    const t = h('div.titulo', null, h('span', null, titulo));
    if (opts.fechar) t.prepend(h('span.fechar', { onclick: opts.fechar, title: 'Fechar' }, '[■]'));
    w.append(t);
    const c = h('div.corpo');
    if (corpo) c.append(...[].concat(corpo));
    w.append(c);
    w.corpo = c;
    w.setTitulo = (s) => { t.querySelector('span:last-child').textContent = s; };
    return w;
  }

  // Armazenamento local (pode falhar em modo privado)
  const KEY = 'curso8086';
  let cache = null;
  const store = {
    load() {
      if (cache) return cache;
      try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cache = {}; }
      return cache;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(cache || {})); } catch (e) { /* ignora */ } },
    get(k, d) { const s = this.load(); return s[k] === undefined ? d : s[k]; },
    set(k, v) { this.load()[k] = v; this.save(); },
    reset() { cache = {}; this.save(); }
  };

  // Alto-falante do PC (onda quadrada)
  const som = {
    ctx: null, osc: null, gain: null,
    ativo() { return store.get('opcoes', {}).som !== false; },
    init() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;
        this.gain.connect(this.ctx.destination);
        this.osc = this.ctx.createOscillator();
        this.osc.type = 'square';
        this.osc.connect(this.gain);
        this.osc.start();
        return true;
      } catch (e) { return false; }
    },
    tom(freq) {
      if (!this.ativo() || !this.init()) return;
      if (freq > 20 && freq < 20000) { this.osc.frequency.setValueAtTime(freq, this.ctx.currentTime); this.gain.gain.setValueAtTime(0.04, this.ctx.currentTime); }
      else this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    },
    bip(freq, ms) {
      if (!this.ativo() || !this.init()) return;
      this.tom(freq || 800);
      setTimeout(() => this.tom(0), ms || 120);
    }
  };

  // Realce de sintaxe Assembly
  const Asm = window.Asm8086;
  const REGS = new Set([...Asm.REG16, ...Asm.REG8, ...Asm.SREG]);
  const DIRS = new Set(['DB', 'DW', 'DD', 'EQU', 'PROC', 'ENDP', 'SEGMENT', 'ENDS', 'END', 'ASSUME', 'ORG', 'PTR', 'BYTE', 'WORD', 'DWORD',
    'OFFSET', 'SEG', 'DUP', 'NEAR', 'FAR', 'SHORT', 'LABEL', 'EVEN', 'ALIGN', 'LENGTH', 'SIZE', 'TYPE', 'MOD', '@DATA', '@CODE', 'STACK', 'PUBLIC', 'PARA', 'TITLE', 'LOCALS',
    'DQ', 'DT', 'MACRO', 'ENDM', 'LOCAL', 'EXITM', 'PURGE', 'REPT', 'IRP', 'IRPC', 'IF', 'IFE', 'IFDEF', 'IFNDEF', 'IFB', 'IFNB',
    'IFIDN', 'IFIDNI', 'IFDIF', 'IFDIFI', 'IF1', 'IF2', 'ELSE', 'ELSEIF', 'ENDIF', 'STRUC', 'EQ', 'NE', 'LT', 'LE', 'GT', 'GE', 'LENGTHOF', 'SIZEOF']);
  function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function realceLinha(line) {
    let out = '';
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === ';') { out += '<span class="k-com">' + escHtml(line.slice(i)) + '</span>'; break; }
      if (c === '\'' || c === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== c) j++;
        out += '<span class="k-str">' + escHtml(line.slice(i, j + 1)) + '</span>';
        i = j + 1; continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i; while (j < line.length && /[0-9A-Za-z]/.test(line[j])) j++;
        out += '<span class="k-num">' + escHtml(line.slice(i, j)) + '</span>';
        i = j; continue;
      }
      if (/[A-Za-z_@$?.]/.test(c)) {
        let j = i; while (j < line.length && /[\w@$?.]/.test(line[j])) j++;
        const w = line.slice(i, j), u = w.toUpperCase();
        let cls = '';
        if (line[j] === ':' && !REGS.has(u)) cls = 'k-lbl';
        else if (REGS.has(u)) cls = 'k-reg';
        else if (/^\.(MODEL|STACK|DATA\??|CODE|STARTUP|EXIT|8086|8087|[1-5]86|LALL|SALL|XALL|LIST|XLIST)$/.test(u) || DIRS.has(u)) cls = 'k-dir';
        else if (Asm.KNOWN_MNEMONICS.has(u) || ['REP', 'REPE', 'REPNE', 'REPZ', 'REPNZ', 'LOCK'].includes(u)) cls = 'k-ins';
        out += cls ? '<span class="' + cls + '">' + escHtml(w) + '</span>' : escHtml(w);
        i = j; continue;
      }
      out += escHtml(c);
      i++;
    }
    return out;
  }
  function realce(code) { return code.split('\n').map(realceLinha).join('\n'); }

  function hex(v, n) { return (v >>> 0).toString(16).toUpperCase().padStart(n || 4, '0'); }
  function s16(v) { return v & 0x8000 ? v - 0x10000 : v; }
  function s8(v) { return v & 0x80 ? v - 0x100 : v; }

  function baixarArquivo(nome, texto) {
    const a = h('a', { href: URL.createObjectURL(new Blob([texto], { type: 'text/plain' })), download: nome });
    document.body.append(a); a.click(); a.remove();
  }
  function abrirArquivo(cb) {
    const inp = h('input', { type: 'file', accept: '.asm,.txt,.inc', style: { display: 'none' } });
    inp.addEventListener('change', () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => cb(f.name, String(r.result));
      r.readAsText(f, 'utf-8');
    });
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  }

  window.UI = { h, janela, store, som, realce, realceLinha, escHtml, hex, s16, s8, baixarArquivo, abrirArquivo };
})();
