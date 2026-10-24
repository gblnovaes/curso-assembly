/* Editor, motor de execução, laboratório (estilo Turbo Debugger) e depurador compacto das aulas. */
(function () {
  'use strict';
  const { h, janela, realce, realceLinha, hex, s16, s8, store, som, escHtml } = window.UI;
  const Asm = window.Asm8086;
  const { Machine } = window.Machine8086;

  // ------------------------------------------------------------------
  // Disco C: virtual, compartilhado por todo o curso e salvo no computador do aluno
  // ------------------------------------------------------------------
  const ARQUIVOS_EXEMPLO = {
    'LEIAME.TXT': 'Disco C: do Curso Assembly 8086.\r\nOs arquivos daqui podem ser lidos e gravados pelos seus programas\r\ncom as funcoes de arquivo do DOS (INT 21h, AH=3Ch a 42h).\r\n',
    'POEMA.TXT': 'No meio do caminho tinha uma pedra\r\ntinha uma pedra no meio do caminho\r\ntinha uma pedra\r\nno meio do caminho tinha uma pedra.\r\n',
    'NUMEROS.TXT': '12\r\n7\r\n30\r\n5\r\n46\r\n',
    'CONFIG.SYS': 'FILES=20\r\nBUFFERS=30\r\nDEVICE=C:\\DOS\\HIMEM.SYS\r\nDOS=HIGH\r\n'
  };
  const Disco = {
    mapa: null,
    obter() {
      if (this.mapa) return this.mapa;
      this.mapa = new Map();
      const salvo = store.get('disco', null);
      const src = salvo || Object.fromEntries(Object.entries(ARQUIVOS_EXEMPLO).map(([n, t]) => [n, { dados: Array.from(t, c => Asm.cp437(c)), attr: 0x20 }]));
      for (const n of Object.keys(src)) this.mapa.set(n, { dados: src[n].dados.slice(), attr: src[n].attr || 0x20 });
      return this.mapa;
    },
    salvar() {
      clearTimeout(this._t);
      this._t = setTimeout(() => { const o = {}; for (const [n, f] of this.obter()) o[n] = { dados: f.dados, attr: f.attr }; store.set('disco', o); }, 300);
    },
    restaurar() {
      const m = this.obter();
      for (const [n, t] of Object.entries(ARQUIVOS_EXEMPLO)) m.set(n, { dados: Array.from(t, c => Asm.cp437(c)), attr: 0x20 });
      this.salvar();
    },
    texto(f) { return f.dados.map(b => b === 13 ? '' : b === 10 ? '\n' : b === 9 ? '\t' : Asm.CP437[b] || '?').join(''); }
  };

  const FLAGS_INFO = [
    ['CF', 0x0001, 'Carry (vai-um): estouro em operações SEM sinal; recebe o bit que sai em deslocamentos.'],
    ['ZF', 0x0040, 'Zero: o resultado foi zero.'],
    ['SF', 0x0080, 'Sinal: cópia do bit mais alto do resultado (1 = negativo, se interpretado com sinal).'],
    ['OF', 0x0800, 'Overflow: estouro em operações COM sinal (complemento de dois).'],
    ['PF', 0x0004, 'Paridade: o byte baixo do resultado tem quantidade PAR de bits 1.'],
    ['AF', 0x0010, 'Auxiliar: vai-um do bit 3 para o bit 4 (usado em BCD).'],
    ['DF', 0x0400, 'Direção: 0 = instruções de string avançam (CLD), 1 = recuam (STD).'],
    ['IF', 0x0200, 'Interrupções: 1 = a CPU aceita interrupções de hardware (STI/CLI).'],
    ['TF', 0x0100, 'Trap: 1 = execução passo a passo (gera INT 1 após cada instrução).']
  ];

  // ------------------------------------------------------------------
  // Editor com realce de sintaxe
  // ------------------------------------------------------------------
  function criarEditor(codigo, opts) {
    opts = opts || {};
    const gutter = h('div.gutter');
    const pre = h('pre');
    const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off' });
    const linhaAtual = h('div.linha-atual');
    const area = h('div.area', null, linhaAtual, pre, ta);
    const el = h('div.editor' + (opts.mini ? '.mini' : ''), null, gutter, area);
    let bps = new Set(), erros = new Set(), atual = 0;
    const lh = () => parseFloat(getComputedStyle(ta).lineHeight) || 20;

    function atualizar() {
      pre.innerHTML = realce(ta.value) + '\n\n';
      const n = ta.value.split('\n').length;
      let g = '';
      for (let i = 1; i <= n; i++) g += '<div class="' + (bps.has(i) ? 'bp' : '') + (erros.has(i) ? ' erro' : '') + '">' + (bps.has(i) ? '●' : i) + '</div>';
      gutter.innerHTML = g + '<div></div><div></div>';
      sincronizar();
    }
    function sincronizar() {
      pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
      if (atual > 0) {
        linhaAtual.style.display = 'block';
        linhaAtual.style.top = (4 + (atual - 1) * lh() - ta.scrollTop) + 'px';
      } else linhaAtual.style.display = 'none';
    }
    ta.addEventListener('input', () => { atualizar(); if (opts.onChange) opts.onChange(ta.value); });
    ta.addEventListener('scroll', sincronizar);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const s = ta.selectionStart, f = ta.selectionEnd;
        ta.setRangeText('\t', s, f, 'end');
        atualizar(); if (opts.onChange) opts.onChange(ta.value);
      }
    });
    gutter.addEventListener('click', (e) => {
      const r = gutter.getBoundingClientRect();
      const linha = Math.floor((e.clientY - r.top - 4 + gutter.scrollTop) / lh()) + 1;
      if (opts.onGutter && linha >= 1) opts.onGutter(linha);
    });
    ta.value = codigo || '';
    atualizar();
    return {
      el, ta,
      get valor() { return ta.value; },
      set valor(v) { ta.value = v; atualizar(); },
      setBps(s) { bps = s; atualizar(); },
      setErros(s) { erros = s; atualizar(); },
      setAtual(l, rolar) {
        atual = l || 0;
        if (rolar && atual) {
          const y = (atual - 1) * lh();
          if (y < ta.scrollTop + lh() || y > ta.scrollTop + ta.clientHeight - 2 * lh()) ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
        }
        sincronizar();
      },
      irPara(l) {
        const linhas = ta.value.split('\n');
        let pos = 0; for (let i = 0; i < l - 1 && i < linhas.length; i++) pos += linhas[i].length + 1;
        ta.focus(); ta.setSelectionRange(pos, pos + (linhas[l - 1] || '').length);
        ta.scrollTop = Math.max(0, (l - 1) * lh() - ta.clientHeight / 3);
        sincronizar();
      },
      linhaDoCursor() { return ta.value.slice(0, ta.selectionStart).split('\n').length; },
      atualizar
    };
  }

  // ------------------------------------------------------------------
  // Motor: monta, carrega e executa um programa
  // ------------------------------------------------------------------
  class Motor {
    constructor(opts) {
      this.opts = opts || {};
      this.fonte = '';
      this.sujo = true;
      this.prog = null;
      this.m = new Machine({ timer: true, timerInterval: 3000, disco: Disco.obter() });
      this.m.onDisco = () => { Disco.salvar(); if (this.opts.onDisco) this.opts.onDisco(); };
      this.parametros = this.opts.parametros || '';
      this.m.onBeep = () => som.bip(880, 120);
      this.m.onSound = (f) => som.tom(f);
      this.rodando = false;
      this.velocidade = 'rapida';
      this.bps = new Set();
      this.antes = null;
      this.flagsAntes = 0;
    }
    setFonte(src) { if (src !== this.fonte) { this.fonte = src; this.sujo = true; } }
    montar() {
      // um fonte com marcadores ;### ARQUIVO vira um disquete com vários arquivos (MINIFS)
      this.prog = window.Machine8086.montarPrograma(this.fonte);
      // programa que é um disquete de boot (setor 0 com 55h AAh): o PC liga sem DOS e dá boot por ele
      this.boot = window.Machine8086.ehDisquete(this.prog);
      if (this.boot) this.m.loadBoot(this.prog); else this.m.load(this.prog);
      if (this.parametros) this.m.setLinhaComando(this.parametros);
      this.sujo = false;
      this.antes = this.m.snapshot();
      this.flagsAntes = this.m.flags;
      this.eventosVistos = 0;
      return this.prog;
    }
    garantir() {
      if (this.sujo || !this.prog) { this.montar(); this.emitir('montado'); }
      return this.prog.ok;
    }
    reiniciar() { this.pausar(); som.tom(0); this.montar(); this.emitir('montado'); }
    emitir(tipo) { if (this.opts.onUpdate) this.opts.onUpdate(tipo); }
    marcar() { this.antes = this.m.snapshot(); this.flagsAntes = this.m.flags; }
    passo() {
      if (!this.garantir()) return;
      if (this.m.halted) { this.emitir('fim'); return; }
      this.marcar();
      const st = this.m.step();
      this.emitir(st === 'aguardando' ? 'aguardando' : 'passo');
      if (st === 'aguardando' && !this.rodando) this.esperarTecla();
    }
    passoPorCima() {
      if (!this.garantir()) return;
      const ins = this.m.currentInstr();
      if (ins && (ins.mn === 'CALL' || (ins.mn === 'INT' && !this.m.isDefaultVector(ins.intNo)))) {
        this.alvo = { cs: this.m.CS, ip: (this.m.ip + ins.size) & 0xFFFF, sp: this.m.SP };
        this.executar();
      } else this.passo();
    }
    ateCursor(linha) { this.alvoLinha = linha; this.executar(); }
    esperarTecla() {
      // continua quando uma tecla chegar
      this.esperando = true;
      this.emitir('aguardando');
    }
    // teclado físico (laboratório e jogos): o aperto e a soltura chegam separados
    apertar(ascii, scan) {
      this.m.pressionarTecla(ascii, scan);
      if (this.m.status === 'aguardando' && !this.rodando) { this.marcar(); const st = this.m.step(); this.emitir(st === 'aguardando' ? 'aguardando' : 'passo'); }
    }
    soltar(scan) { this.m.soltarTecla(scan); }
    // mouse da tela do programa (INT 33h)
    mouse(x, y, btn) {
      if (!this.m.mouse.usado) return;
      this.m.mouseEvento(x, y, btn);
      if (this.m.status === 'aguardando' && !this.rodando && this.m.mouse.eventos.length) { this.marcar(); const st = this.m.step(); this.emitir(st === 'aguardando' ? 'aguardando' : 'passo'); }
    }
    tecla(ascii, scan) {
      this.m.pushKey(ascii, scan);
      if (this.m.status === 'aguardando' && !this.rodando) {
        this.marcar();
        const st = this.m.step();
        this.emitir(st === 'aguardando' ? 'aguardando' : 'passo');
      }
    }
    executar() {
      if (!this.garantir()) return;
      if (this.m.halted) { this.emitir('fim'); return; }
      if (this.rodando) return;
      this.rodando = true;
      this.marcar();
      this.emitir('rodando');
      let acumulado = 0, ultimo = performance.now();
      const laco = (agora) => {
        if (!this.rodando) return;
        const dt = Math.min(100, agora - ultimo); ultimo = agora;
        let orcamento;
        // em tempo real (4,77 MHz ou 25 MHz) o orçamento é em ciclos, e o timer do PC segue o relógio
        const tempoReal = this.velocidade === 'real' || this.velocidade === 'turbo';
        const m = this.m;
        m.timerCiclos = tempoReal;
        m.mhz = this.velocidade === 'turbo' ? 25 : 4.77;
        let alvoCiclos = Infinity;
        if (this.velocidade === 'lenta') { acumulado += dt * 3 / 1000; orcamento = Math.floor(acumulado); acumulado -= orcamento; }
        else if (this.velocidade === 'media') { acumulado += dt * 40 / 1000; orcamento = Math.floor(acumulado); acumulado -= orcamento; }
        else if (tempoReal) { orcamento = 4e6; alvoCiclos = m.cycles + Math.round(dt * m.mhz * 1000); }
        else orcamento = 40000;
        const t0 = performance.now();
        let parar = false;
        const vigiar = this.alvo || this.alvoLinha || this.bps.size;
        for (let i = 0; i < orcamento; i++) {
          if (m.cycles >= alvoCiclos) break;
          if (this.velocidade === 'lenta' || this.velocidade === 'media') this.marcar();
          const st = m.step();
          if (st === 'aguardando') { if (tempoReal) m.ocioso(alvoCiclos); break; }
          if (st !== 'executando') { parar = true; break; }
          if (vigiar) {
            const ins = m.currentInstr();
            if (this.alvo && m.CS === this.alvo.cs && m.ip === this.alvo.ip && m.SP >= this.alvo.sp) { parar = true; break; }
            if (ins && this.alvoLinha && ins.line === this.alvoLinha) { parar = true; break; }
            if (ins && this.bps.has(ins.line)) { parar = true; m.status = 'breakpoint'; break; }
          }
          if ((i & 1023) === 1023 && performance.now() - t0 > 14) break;
        }
        if (parar) { this.pausar(); this.emitir(this.m.halted ? 'fim' : 'pausa'); return; }
        this.emitir(this.m.status === 'aguardando' ? 'aguardando' : 'rodando');
        requestAnimationFrame(laco);
      };
      requestAnimationFrame(laco);
    }
    pausar() {
      const estava = this.rodando;
      this.rodando = false; this.alvo = null; this.alvoLinha = null;
      if (estava) this.emitir('pausa');
    }
    novosEventos() {
      const ev = this.m.events.slice(this.eventosVistos || 0);
      this.eventosVistos = this.m.events.length;
      return ev;
    }
  }

  // ------------------------------------------------------------------
  // Renderizadores de painéis
  // ------------------------------------------------------------------
  function htmlRegs(m, antes, compacto) {
    const s = m.snapshot();
    const mud = (k) => antes && antes[k] !== s[k] ? ' mud' : '';
    if (compacto) {
      const regs = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'BP', 'SP', 'IP'];
      return regs.map(k => '<span class="rc"><span class="nm">' + k + '</span>=<span class="v' + mud(k) + '" title="' + k + ' = ' + s[k] + (s[k] & 0x8000 ? ' (com sinal: ' + s16(s[k]) + ')' : '') + '">' + hex(s[k]) + '</span></span>').join(' ');
    }
    let t = '<table>';
    for (const k of ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'BP', 'SP']) {
      const v = s[k];
      let extra = '';
      if (['AX', 'BX', 'CX', 'DX'].includes(k)) extra = '<span class="dim">' + k[0] + 'H=</span>' + hex(v >> 8, 2) + ' <span class="dim">' + k[0] + 'L=</span>' + hex(v & 0xFF, 2);
      t += '<tr><td class="nm">' + k + '</td><td class="v' + mud(k) + '">' + hex(v) + '</td><td class="dim">' + String(v).padStart(5) + '</td><td class="dim">' + String(s16(v)).padStart(6) + '</td><td>' + extra + '</td></tr>';
    }
    t += '</table><table style="margin-top:.3em"><tr>';
    for (const k of ['CS', 'DS', 'ES', 'SS']) t += '<td class="nm">' + k + '</td><td class="v' + mud(k) + '">' + hex(s[k]) + '</td>';
    t += '</tr><tr><td class="nm">IP</td><td class="v' + mud('IP') + '">' + hex(s.IP) + '</td><td class="nm" colspan="2">FLAGS</td><td class="v' + mud('FLAGS') + '">' + hex(s.FLAGS) + '</td></tr></table>';
    return '<div class="regs">' + t + '</div>';
  }
  function htmlFlags(m, flagsAntes) {
    return '<div class="flags-g">' + FLAGS_INFO.map(([n, bit, d]) => {
      const on = (m.flags & bit) !== 0;
      const mud = flagsAntes !== null && ((flagsAntes ^ m.flags) & bit) ? ' mud' : '';
      return '<span class="f' + (on ? ' on' : '') + mud + '" title="' + escHtml(d) + '"><span class="fn">' + n + '</span>=<span class="fv">' + (on ? 1 : 0) + '</span></span>';
    }).join('') + '</div>';
  }
  function htmlPilha(m, linhas) {
    const out = [];
    const base = m.initial ? m.initial.sp : 0;
    let start = (m.SP - 4) & 0xFFFF;
    for (let i = 0; i < linhas; i++) {
      const off = (start + i * 2) & 0xFFFF;
      const v = m.rb(m.SS, off) | (m.rb(m.SS, off + 1) << 8);
      let mk = '';
      if (off === m.SP) mk += ' ◄SP';
      if (off === m.BP && m.BP !== 0) mk += ' ◄BP';
      if (off === base) mk += ' (base)';
      const linha = '<span class="ad">' + hex(off) + '</span> ' + hex(v) + mk;
      out.push(off === m.SP ? '<span class="sp">' + linha + '</span>' : off < m.SP ? '<span class="as">' + linha + '</span>' : linha);
      if (base && off >= base - 2 && i > 4) break;
    }
    return '<div class="lista-mono">' + out.join('\n') + '</div>';
  }
  function htmlMemoria(m, seg, off, linhas, porLinha = 16) {
    const out = [];
    const lw = m.lastWrite;
    for (let r = 0; r < linhas; r++) {
      const o = (off + r * porLinha) & 0xFFFF;
      let hx = '', asc = '';
      for (let c = 0; c < porLinha; c++) {
        const oo = (o + c) & 0xFFFF;
        const b = m.rb(seg, oo);
        const w = lw && lw.seg === seg && oo >= lw.off && oo < lw.off + lw.size;
        hx += (w ? '<span class="w">' + hex(b, 2) + '</span>' : hex(b, 2)) + (c === 7 && porLinha > 8 ? '-' : ' ');
        asc += b >= 32 && b < 127 ? escHtml(String.fromCharCode(b)) : '.';
      }
      out.push('<span class="ad">' + hex(seg) + ':' + hex(o) + '</span> ' + hx + ' <span class="as">' + asc + '</span>');
    }
    return '<div class="lista-mono">' + out.join('\n') + '</div>';
  }
  function htmlVariaveis(m) {
    const p = m.prog;
    if (!p || !p.ok) return '';
    const vs = Object.entries(p.symbols).filter(([, s]) => s.kind === 'var').sort((a, b) => a[1].off - b[1].off);
    if (!vs.length) return '<span class="dim">Nenhuma variável (DB/DW) definida.</span>';
    return '<div class="lista-mono vars">' + vs.slice(0, 60).map(([n, s]) => {
      const base = s.seg * 16 + s.off;
      if (s.type === 8 || s.type === 10) {
        const vals = [];
        for (let i = 0; i < Math.min(s.count || 1, 4); i++) vals.push(fmtReal(m.fmemLer(s.type === 8 ? 'f64' : 'f80', { seg: s.seg, off: s.off + i * s.type })));
        return '<span class="vn">' + escHtml(n.padEnd(10)) + '</span> ' + (s.type === 8 ? 'DQ' : 'DT') + ' ' + hex(s.off) + ': ' + vals.join(' ') + ((s.count || 1) > 4 ? ' …' : '');
      }
      const tam = s.type === 1 ? 1 : s.type === 4 ? 4 : 2;
      const cnt = Math.min(s.count || 1, tam === 1 ? 16 : 8);
      const vals = [];
      for (let i = 0; i < cnt; i++) {
        const a = base + i * tam;
        const v = tam === 1 ? m.mem[a] : tam === 2 ? m.mem[a] | (m.mem[a + 1] << 8) : (m.mem[a] | (m.mem[a + 1] << 8) | (m.mem[a + 2] << 16) | (m.mem[a + 3] << 24)) >>> 0;
        let real = '';
        if (tam === 4 && cnt === 1) { const r = m.fmemLer('f32', { seg: s.seg, off: s.off }); const a = Math.abs(r); if (Number.isFinite(r) && a >= 1e-4 && a < 1e9) real = ' / real ' + fmtReal(+r.toPrecision(7)); }
        vals.push(tam === 1 ? hex(v, 2) : hex(v, tam * 2) + (cnt === 1 ? ' (' + v + (tam === 2 && v & 0x8000 ? ' / ' + s16(v) : '') + real + ')' : ''));
      }
      let txt = '';
      if (tam === 1 && (s.count || 1) > 1) {
        txt = ' "' + Array.from(m.mem.slice(base, base + Math.min(s.count, 24))).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '·').join('') + '"';
      }
      return '<span class="vn">' + escHtml(n.padEnd(10)) + '</span> ' + (tam === 1 ? 'DB' : tam === 2 ? 'DW' : 'DD') + ' ' + hex(s.off) + ': ' + vals.join(' ') + ((s.count || 1) > cnt ? ' …' : '') + escHtml(txt);
    }).join('\n') + '</div>';
  }
  function fmtReal(v) {
    if (v === null || v === undefined) return 'vazio';
    if (Number.isNaN(v)) return 'NaN (indefinido)';
    if (!Number.isFinite(v)) return v < 0 ? '-infinito' : '+infinito';
    const a = Math.abs(v);
    return (a !== 0 && (a < 1e-6 || a >= 1e15) ? v.toExponential(10) : String(+v.toPrecision(15))).replace('.', ',');
  }
  function htmlFPU(m) {
    const f = m.fpu, sw = m.fpuSW(), cw = f.cw;
    const pilha = m.fpuPilha();
    const b = (v, n) => (v >> n) & 1;
    const cel = (i) => { const v = pilha[i]; const t = v === null ? 'vazio' : fmtReal(v); return 'ST(' + i + ') ' + (v === null ? '<span class="dim">' + t.padEnd(22) + '</span>' : escHtml(t.padEnd(22))); };
    // 8 células em duas colunas (ST0-3 | ST4-7) que viram uma só quando o painel é estreito
    const linhas = ['<div class="fpu-st">' + [0, 1, 2, 3, 4, 5, 6, 7].map(i => '<div>' + cel(i) + '</div>').join('') + '</div>'];
    const rc = ['ao mais próximo', 'para baixo', 'para cima', 'truncar'][(cw >> 10) & 3];
    const exc = [['IE', 0, 'operação inválida'], ['DE', 1, 'denormal'], ['ZE', 2, 'divisão por zero'], ['OE', 3, 'overflow'], ['UE', 4, 'underflow'], ['PE', 5, 'precisão']]
      .filter(([, n]) => b(sw, n)).map(([s, , d]) => s + ' (' + d + ')');
    const bl = (...ps) => '<div class="fpu-l">' + ps.map(p => '<span>' + p + '</span>').join('') + '</div>';
    return '<div class="lista-mono fpu-painel">' + linhas.join('') +
      bl('Status  ' + hex(sw) + 'h', 'C3=' + b(sw, 14) + ' C2=' + b(sw, 10) + ' C1=' + b(sw, 9) + ' C0=' + b(sw, 8), 'TOP=' + ((sw >> 11) & 7)) +
      bl('Exceções: ' + (exc.length ? exc.join(', ') : 'nenhuma')) +
      bl('Controle ' + hex(cw) + 'h', 'arredondamento: ' + rc, 'máscaras: ' + hex(cw & 0x3F, 2) + 'h') +
      (f.usado ? '' : bl('<span class="dim">O programa ainda não usou o 8087.</span>')) + '</div>';
  }
  function htmlListagem(prog) {
    if (!prog || !prog.ok) return '';
    const porLinha = new Map();
    for (const l of prog.listing) { if (!porLinha.has(l.line)) porLinha.set(l.line, []); porLinha.get(l.line).push(l); }
    const out = [];
    prog.lines.forEach((src, i) => {
      const ls = porLinha.get(i + 1);
      let pre = ''.padEnd(25);
      if (ls && ls.length) {
        const l = ls[0];
        const bytes = ls.flatMap(x => x.bytes);
        const bs = bytes.slice(0, 6).map(b => hex(b, 2)).join('') + (bytes.length > 6 ? '+' : '');
        pre = (hex(l.seg) + ':' + hex(l.off) + ' ' + bs).padEnd(25);
      }
      out.push('<span class="ad">' + String(i + 1).padStart(4) + '</span> <span class="as">' + escHtml(pre) + '</span>' + realceLinha(src));
    });
    return out.join('\n');
  }

  // janela "CPU" do Turbo Debugger: desmonta a memória a partir de CS:IP (o que a CPU vai executar de fato)
  function htmlDesmontagem(m, n) {
    const out = [];
    let seg = m.CS, off = m.ip;
    for (let k = 0; k < n; k++) {
      const ins = m.instrucaoEm(seg, off) || m.decodificarEm(seg, off);
      const bytes = (ins.bytes || []).slice(0, 6).map(b => hex(b, 2)).join('');
      const txt = ins.invalida ? '??? (' + ins.invalida + ')' : (ins.decodificada ? ins.text : ins.text.replace(/\s*;.*$/, ''));
      const linha = ins.line ? '<span class="dim">' + String(ins.line).padStart(4) + '</span>' : '    ';
      const cur = k === 0 && !m.halted;
      out.push((cur ? '<span class="cur">►' : ' ') + hex(seg) + ':' + hex(off) + ' ' + escHtml(bytes.padEnd(13)) + ' ' + escHtml(txt) + (cur ? '</span>' : '') + '  ' + linha);
      off = (off + Math.max(1, ins.size || 1)) & 0xFFFF;
    }
    return '<div class="lista-mono">' + out.join('\n') + '</div><div class="dim">Desmontagem da memória em CS:IP. O número à direita é a linha do fonte, quando os bytes vieram do seu programa.</div>';
  }

  function teclaDoEvento(e) {
    const SCAN = { Enter: [13, 0x1C], Escape: [27, 0x01], Backspace: [8, 0x0E], Tab: [9, 0x0F], ArrowUp: [0, 0x48], ArrowDown: [0, 0x50], ArrowLeft: [0, 0x4B], ArrowRight: [0, 0x4D], Home: [0, 0x47], End: [0, 0x4F], PageUp: [0, 0x49], PageDown: [0, 0x51], Insert: [0, 0x52], Delete: [0, 0x53] };
    if (SCAN[e.key]) return SCAN[e.key];
    if (/^F([1-9]|10)$/.test(e.key) && e.shiftKey) return [0, 0x3A + parseInt(e.key.slice(1), 10)];
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey) return [Asm.cp437(e.key), window.Machine8086.scanDe(e.key)];
    if (e.key.length === 1 && e.ctrlKey && /[a-z]/i.test(e.key)) return [e.key.toUpperCase().charCodeAt(0) - 64, 0];
    return null;
  }

  // ------------------------------------------------------------------
  // Depurador compacto (dentro das aulas)
  // ------------------------------------------------------------------
  class MiniDepurador {
    constructor(codigo, opts) {
      this.opts = opts || {};
      this.motor = new Motor({ onUpdate: (t) => this.render(t), parametros: this.opts.parametros });
      this.motor.setFonte(codigo);
      this.motor.velocidade = 'media';
      this.cv = h('canvas.tela.mini-gfx', { tabindex: '0', title: 'Tela do programa. Clique aqui para digitar no teclado do programa.', style: { display: 'none' } });
      this.telaG = new window.Tela(this.cv);
      this.telaG.ligarMouse((x, y, b) => this.motor.mouse(x, y, b));
      this.cv.addEventListener('keydown', (e) => { const k = teclaDoEvento(e); if (k) { e.preventDefault(); this.motor.tecla(k[0], k[1]); } });
      this.fpuEl = h('div.lista-mono', { style: { display: 'none', margin: '.3em 0' } });
      this.codigo = codigo;
      const preCod = this.preCod = h('pre.asm');
      this.regs = h('div.regs');
      this.flags = h('div');
      this.vars = h('div');
      this.saida = h('div.saida');
      this.st = h('span.st');
      this.ev = h('div');
      this.entrada = h('input', { type: 'text', placeholder: 'teclado do programa…', title: 'O que você digitar aqui vai para o teclado do programa. Enter envia.' });
      this.entrada.addEventListener('keydown', (e) => {
        const k = teclaDoEvento(e);
        if (k) { e.preventDefault(); this.motor.tecla(k[0], k[1]); if (k[0] === 13) this.entrada.value = ''; else if (k[0] === 8) this.entrada.value = this.entrada.value.slice(0, -1); else if (k[0]) this.entrada.value += e.key; }
      });
      const btn = (txt, hk, fn, titulo) => h('button.btn', { onclick: fn, title: titulo || '' }, txt);
      this.el = h('div.mini-dbg', null,
        h('div.linhas', null,
          h('div', null, preCod),
          h('div', null, this.regs, h('div', { style: { margin: '.3em 0' } }, this.flags), this.vars, this.fpuEl, h('div', { style: { color: 'var(--head2)', marginTop: '.3em' } }, 'Saída do programa:'), this.saida, this.cv)),
        this.ev,
        h('div.ctl', null,
          btn('► Passo', 'F7', () => this.motor.passo(), 'Executa uma instrução'),
          btn('►► Executar', 'F9', () => { this.motor.velocidade = 'media'; this.motor.executar(); }, 'Executa animado até o fim'),
          btn('» Rápido', '', () => { this.motor.velocidade = 'rapida'; this.motor.executar(); }, 'Executa na velocidade máxima'),
          btn('■ Pausar', '', () => this.motor.pausar()),
          btn('↺ Reiniciar', '', () => this.motor.reiniciar()),
          this.entrada,
          this.st));
      this.motor.montar();
      this.render('montado');
    }
    render(tipo) {
      const m = this.motor.m, p = this.motor.prog;
      if (!p.ok) {
        this.preCod.innerHTML = realce(this.codigo);
        this.ev.innerHTML = p.errors.map(e => '<div class="ev erro">Linha ' + e.line + ': ' + escHtml(e.msg) + '</div>').join('');
        return;
      }
      const ins = m.halted ? null : m.currentInstr();
      const cur = ins ? ins.line : 0;
      this.preCod.innerHTML = this.codigo.split('\n').map((l, i) => i + 1 === cur ? '<span class="cur">' + realceLinha(l || ' ') + '</span>' : realceLinha(l)).join('\n');
      if (cur) {
        const el = this.preCod.querySelector('.cur');
        if (el && (tipo === 'passo' || tipo === 'pausa' || this.motor.velocidade !== 'rapida')) {
          const top = el.offsetTop - this.preCod.offsetTop;
          if (top < this.preCod.scrollTop || top > this.preCod.scrollTop + this.preCod.clientHeight - 30) this.preCod.scrollTop = top - 40;
        }
      }
      this.regs.innerHTML = htmlRegs(m, this.motor.antes, true);
      this.flags.innerHTML = htmlFlags(m, this.motor.flagsAntes);
      this.vars.innerHTML = htmlVariaveis(m);
      this.saida.textContent = m.outputText() || '';
      if (m.videoMode === 0x13 || m.escreveuVideo || m.mouse.usado || this.cv.style.display !== 'none') {
        this.cv.style.display = '';
        // depois que um programa gráfico volta ao modo texto e termina, mostra o último quadro do modo 13h
        if (m.halted && m.usou13h && m.videoMode !== 0x13 && !m.escreveuVideo) this.telaG.desenharVGA(m.mem, m.dac);
        else this.telaG.desenhar(m.mem, m.getCursor(), false, m);
      }
      if (m.fpu.usado) {
        this.fpuEl.style.display = '';
        const p = m.fpuPilha(); let n = 8; while (n > 0 && p[n - 1] === null) n--;
        this.fpuEl.innerHTML = '<span style="color:var(--head2)">8087:</span> ' + (n ? p.slice(0, n).map((v, i) => 'ST(' + i + ')=' + escHtml(fmtReal(v))).join('  ') : 'pilha vazia');
      }
      const evs = m.events.slice(-3).map(e => '<div class="ev' + (e.type === 'erro' ? ' erro' : '') + '">' + escHtml(e.msg) + '</div>').join('');
      let fim = '';
      if (m.halted) fim = '<div class="ev' + (m.status === 'erro' ? ' erro' : '') + '">■ ' + escHtml(m.haltReason || '') + '</div>';
      this.ev.innerHTML = evs + fim;
      const status = m.status === 'aguardando' ? '<span class="aguardando">Aguardando teclado: digite na caixa ao lado</span>' :
        'Instruções: ' + m.steps + ' · Ciclos: ' + m.cycles.toLocaleString('pt-BR');
      this.st.innerHTML = status;
      if (m.status === 'aguardando' && document.activeElement !== this.entrada && tipo === 'aguardando') this.entrada.focus({ preventScroll: true });
    }
  }

  // ------------------------------------------------------------------
  // Jogador: roda um jogo (ou dá boot num disquete) em tela grande, em tempo real,
  // com o teclado de verdade (aperto e soltura) e o som do alto-falante
  // ------------------------------------------------------------------
  class Jogador {
    constructor(codigo, opts) {
      this.opts = opts || {};
      this.motor = new Motor({ onUpdate: (t) => this.estado(t) });
      this.motor.velocidade = store.get('jogo-velocidade', 'turbo');
      this.motor.setFonte(codigo);
      this.cv = h('canvas.tela', { tabindex: '0', title: 'Clique aqui e use o teclado' });
      this.cv.style.cssText = 'width:min(96vw,133vh,1280px);height:auto;aspect-ratio:4/3;background:#000';
      this.tela = new window.Tela(this.cv);
      this.tela.ligarMouse((x, y, b) => this.motor.mouse(x, y, b));
      this.msg = h('span', { style: { flex: 1, color: '#AAA' } }, '');
      const sel = h('select', { title: 'Velocidade do PC' }, h('option', { value: 'real' }, 'IBM PC XT (4,77 MHz)'), h('option', { value: 'turbo' }, 'PC 386 (25 MHz)'));
      sel.value = this.motor.velocidade;
      sel.addEventListener('change', () => { this.motor.velocidade = sel.value; store.set('jogo-velocidade', sel.value); this.cv.focus(); });
      const bt = (t, fn, tt) => h('button.btn.sec', { style: { margin: '0 0 0 1ch', boxShadow: 'none' }, onclick: fn, title: tt || '' }, t);
      const barra = h('div', { style: { display: 'flex', alignItems: 'center', gap: '1ch', width: 'min(96vw,133vh,1280px)', color: '#FFF', padding: '.3em 0', flexWrap: 'wrap' } },
        h('b', null, this.opts.titulo || 'JOGO'), this.msg, sel,
        bt('↺ Reiniciar', () => this.iniciar(), 'Monta e começa de novo'),
        bt('Laboratório', () => { const c = this.motor.fonte; this.fechar(); window.App.abrirNoLab(c, { titulo: this.opts.arquivo || 'JOGO.ASM' }); }, 'Abrir o código no laboratório'),
        bt('✕ Fechar', () => this.fechar(), 'Fechar (Alt+F5)'));
      this.fundo = h('div.dlg-fundo', { style: { background: '#000', flexDirection: 'column' } }, barra, this.cv);
      const teclas = (e, solta) => {
        if (e.key === 'F5' && e.altKey) { e.preventDefault(); this.fechar(); return; }
        if (/^F\d+$/.test(e.key) && !e.shiftKey && !solta && e.key !== 'F1' && e.key !== 'F2') return;
        const k = teclaDoEvento(e);
        if (!k) return;
        e.preventDefault(); e.stopPropagation();
        if (solta) { if (k[1]) this.motor.soltar(k[1]); } else this.motor.apertar(k[0], k[1]);
      };
      this.cv.addEventListener('keydown', (e) => teclas(e, false));
      this.cv.addEventListener('keyup', (e) => teclas(e, true));
      document.body.append(this.fundo);
      const loop = () => {
        if (!this.fundo.isConnected) return;
        const m = this.motor.m;
        this.tela.desenhar(m.mem, m.getCursor(), true, m);
        this.raf = requestAnimationFrame(loop);
      };
      this.iniciar();
      loop();
    }
    iniciar() {
      this.motor.pausar(); som.tom(0);
      const p = this.motor.montar();
      this.tela.invalidar();
      if (!p.ok) { this.msg.textContent = 'Erro de montagem na linha ' + p.errors[0].line + ': ' + p.errors[0].msg; return; }
      this.msg.textContent = (this.motor.boot ? 'Dando boot pelo disquete A:. ' : '') + 'Clique na tela e jogue com o teclado. Alt+F5 fecha.';
      this.motor.executar();
      this.cv.focus();
    }
    estado(tipo) {
      const m = this.motor.m;
      if (tipo === 'fim' || (tipo === 'pausa' && m.halted)) this.msg.textContent = '■ ' + (m.haltReason || 'Fim.') + '  (↺ Reiniciar joga de novo)';
    }
    fechar() {
      this.motor.pausar(); som.tom(0);
      cancelAnimationFrame(this.raf);
      this.fundo.remove();
    }
  }

  // ------------------------------------------------------------------
  // Laboratório (tela inteira)
  // ------------------------------------------------------------------
  class Laboratorio {
    constructor(raiz, app) {
      this.app = app;
      this.raiz = raiz;
      this.motor = new Motor({ onUpdate: (t) => this.render(t), onDisco: () => { if (this.abaInf === 'disco') this.renderInferior(); }, parametros: store.get('lab-parametros', '') });
      this.motor.velocidade = store.get('lab-velocidade', 'media');
      this.aba = 'editor';
      this.abaInf = 'memoria';
      this.memSeg = 'DS'; this.memOff = 0;
      this.exercicio = null;
      this.construir();
      const salvo = store.get('lab-codigo', null);
      this.carregar(salvo || EXEMPLO_INICIAL, { titulo: store.get('lab-titulo', 'PROGRAMA.ASM'), manterBps: false });
      this.timerTela();
    }
    construir() {
      const ed = this.editor = criarEditor('', {
        onChange: (v) => { this.motor.setFonte(v); store.set('lab-codigo', v); this.marcarAlterado(); },
        onGutter: (l) => this.alternarBp(l)
      });
      this.listagem = h('pre.asm', { style: { flex: 1, overflow: 'auto', border: '2px solid var(--code-frame)', background: 'var(--code-bg)', display: 'none' } });
      this.selExemplo = h('select', { title: 'Programas de exemplo' });
      this.selExemplo.addEventListener('change', () => {
        const v = this.selExemplo.value; this.selExemplo.value = '';
        if (v && window.App) window.App.abrirExemplo(v);
      });
      const tab = (id, txt) => { const t = h('span.tab', { onclick: () => this.mudarAba(id) }, txt); t.dataset.aba = id; return t; };
      this.exPainel = h('div.ex-painel', { style: { display: 'none' } });
      this.tabs = h('div.lab-tabs', null, tab('editor', 'Editor'), tab('listagem', 'Listagem'), h('span.esp'), this.selExemplo,
        h('button.btn.sec', { style: { margin: '0 0 0 1ch', boxShadow: 'none' }, onclick: () => this.novo(), title: 'Novo programa' }, 'Novo'),
        h('button.btn.sec', { style: { margin: '0 0 0 1ch', boxShadow: 'none' }, onclick: () => this.abrir(), title: 'Abrir arquivo .ASM' }, 'Abrir'),
        h('button.btn.sec', { style: { margin: '0 0 0 1ch', boxShadow: 'none' }, onclick: () => this.salvar(), title: 'Salvar como arquivo .ASM' }, 'Salvar'));
      this.wCodigo = janela('PROGRAMA.ASM', 'lab-codigo', [this.exPainel, this.tabs, ed.el, this.listagem]);

      this.inf = h('div');
      const tabInf = (id, txt) => { const t = h('span.tab', { onclick: () => { this.abaInf = id; this.render('aba'); } }, txt); t.dataset.aba = id; return t; };
      this.memCtl = h('div.mem-ctl');
      this.tabsInf = h('div.lab-tabs', null, tabInf('memoria', 'Memória'), tabInf('variaveis', 'Variáveis'), tabInf('mensagens', 'Mensagens'), tabInf('cpu', 'CPU'), tabInf('ivt', 'Vetores (IVT)'), tabInf('fpu', '8087'), tabInf('disco', 'Discos'));
      window.addEventListener('resize', () => { if (this.abaInf === 'memoria' && this.inf.isConnected) this.renderInferior(); });
      this.wInf = janela('Inspeção', 'lab-mem', [this.tabsInf, this.memCtl, this.inf]);
      this.wInf.style.height = '12.5em'; this.wInf.style.flex = 'none';

      this.regsEl = h('div');
      this.flagsEl = h('div');
      this.pilhaEl = h('div');
      this.canvas = h('canvas.tela', { tabindex: '0', title: 'Tela do programa (80x25). Clique aqui para digitar no teclado do programa.' });
      this.tela = new window.Tela(this.canvas);
      this.tela.ligarMouse((x, y, b) => this.motor.mouse(x, y, b));
      this.canvas.addEventListener('keydown', (e) => {
        if (/^F\d+$/.test(e.key) && !e.shiftKey) return;
        const k = teclaDoEvento(e);
        if (k) { e.preventDefault(); e.stopPropagation(); this.motor.apertar(k[0], k[1]); }
      });
      this.canvas.addEventListener('keyup', (e) => { const k = teclaDoEvento(e); if (k && k[1]) { e.preventDefault(); this.motor.soltar(k[1]); } });
      this.canvas.addEventListener('dblclick', () => this.telaCheia());
      const wRegs = janela('Registradores', '', this.regsEl);
      const wFlags = janela('Flags', '', this.flagsEl);
      const wPilha = janela('Pilha SS:SP', '', this.pilhaEl);
      wPilha.classList.add('lab-pilha'); wRegs.classList.add('lab-regs'); wFlags.classList.add('lab-flags');
      this.wTela = janela('Tela do usuário', 'lab-tela', this.canvas);

      this.stats = h('span.stats');
      const b = (txt, tecla, fn, titulo) => h('button.btn', { onclick: fn, title: titulo }, h('span.hk', null, tecla), ' ' + txt);
      this.selVel = h('select', { title: 'Velocidade da execução (F9)' },
        h('option', { value: 'lenta' }, 'Lenta (3/s)'), h('option', { value: 'media' }, 'Animada (40/s)'),
        h('option', { value: 'real' }, '8086 real (4,77 MHz)'), h('option', { value: 'turbo' }, 'PC rápido (25 MHz)'), h('option', { value: 'rapida' }, 'Máxima'));
      this.selVel.value = this.motor.velocidade;
      this.selVel.addEventListener('change', () => { this.motor.velocidade = this.selVel.value; store.set('lab-velocidade', this.selVel.value); });
      this.inParam = h('input.param', { type: 'text', value: this.motor.parametros, placeholder: 'parâmetros', title: 'Linha de comando do programa (vai para o PSP, em 80h). Vale na próxima execução.' });
      this.inParam.addEventListener('change', () => { this.motor.parametros = this.inParam.value; store.set('lab-parametros', this.inParam.value); this.motor.sujo = true; });
      this.btnVerif = h('button.btn', { onclick: () => this.verificarExercicio(), style: { display: 'none' }, title: 'Verifica o exercício (F5)' }, h('span.hk', null, 'F5'), ' Verificar');
      const barra = h('div.lab-barra', null,
        b('Executar', 'F9', () => this.motor.executar(), 'Executa o programa (F9)'),
        b('Passo', 'F7', () => this.motor.passo(), 'Executa uma instrução, entrando em CALL/INT (F7)'),
        b('Passo por cima', 'F8', () => this.motor.passoPorCima(), 'Executa uma instrução; CALL roda inteiro (F8)'),
        b('Até o cursor', 'F4', () => this.motor.ateCursor(this.editor.linhaDoCursor()), 'Executa até a linha do cursor (F4)'),
        b('Pausar', 'Esc', () => this.motor.pausar(), 'Pausa a execução (Esc)'),
        b('Reiniciar', 'Ctrl+F2', () => this.motor.reiniciar(), 'Monta e recarrega o programa (Ctrl+F2)'),
        this.btnVerif, this.selVel, this.inParam, this.stats);

      const esq = h('div.lab-esq', null, this.wCodigo, this.wInf);
      const dir = h('div.lab-dir', null, wRegs, wPilha, wFlags, this.wTela);
      this.raiz.append(h('div.lab-top', null, esq, dir), barra);
    }
    mudarAba(id) {
      this.aba = id;
      this.editor.el.style.display = id === 'editor' ? 'flex' : 'none';
      this.listagem.style.display = id === 'listagem' ? 'block' : 'none';
      if (id === 'listagem') { this.motor.garantir(); this.listagem.innerHTML = htmlListagem(this.motor.prog); }
      this.tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('ativo', t.dataset.aba === id));
    }
    carregar(codigo, opts) {
      opts = opts || {};
      this.motor.pausar();
      this.editor.valor = codigo;
      this.motor.setFonte(codigo);
      store.set('lab-codigo', codigo);
      this.titulo = opts.titulo || 'PROGRAMA.ASM';
      store.set('lab-titulo', this.titulo);
      this.wCodigo.setTitulo(this.titulo);
      if (!opts.manterBps) { this.motor.bps = new Set(); this.editor.setBps(this.motor.bps); }
      if (opts.parametros !== undefined) { this.motor.parametros = opts.parametros || ''; this.inParam.value = this.motor.parametros; store.set('lab-parametros', this.motor.parametros); }
      this.exercicio = opts.exercicio || null;
      this.exPainel.style.display = this.exercicio ? 'block' : 'none';
      this.btnVerif.style.display = this.exercicio ? '' : 'none';
      if (this.exercicio) {
        this.exPainel.innerHTML = '';
        this.exPainel.append(h('div.et', null, '■ Exercício: ' + this.exercicio.titulo + '  '), h('div', { html: this.exercicio.enunciado }));
      }
      this.mudarAba('editor');
      this.motor.montar();
      this.mensagensExtra = [];
      this.render('montado');
    }
    marcarAlterado() {
      if (!this.motor.rodando) { this.estadoAlterado = true; this.renderStats(); }
    }
    alternarBp(l) {
      if (this.motor.bps.has(l)) this.motor.bps.delete(l); else this.motor.bps.add(l);
      this.editor.setBps(this.motor.bps);
    }
    novo() {
      this.carregar(MODELO_NOVO, { titulo: 'NOVO.ASM' });
    }
    abrir() { window.UI.abrirArquivo((nome, txt) => this.carregar(txt, { titulo: nome.toUpperCase() })); }
    salvar() { window.UI.baixarArquivo(this.titulo.toLowerCase().endsWith('.asm') ? this.titulo : 'programa.asm', this.editor.valor); }
    telaCheia() {
      const cv = h('canvas.tela', { tabindex: '0', style: { width: 'min(96vw, 160vh)', height: 'auto' } });
      const t = new window.Tela(cv);
      t.ligarMouse((x, y, b) => this.motor.mouse(x, y, b));
      const fundo = h('div.dlg-fundo', { style: { background: '#000' } }, cv);
      const fechar = () => { cancelAnimationFrame(raf); fundo.remove(); };
      let raf;
      const loop = () => { const m = this.motor.m; t.desenhar(m.mem, m.getCursor(), true, m); raf = requestAnimationFrame(loop); };
      cv.addEventListener('keydown', (e) => {
        if (e.key === 'F5' && e.altKey) { e.preventDefault(); fechar(); return; }
        if (e.key === 'Escape' && !this.motor.rodando && this.motor.m.status !== 'aguardando') { fechar(); return; }
        const k = teclaDoEvento(e);
        if (k) { e.preventDefault(); this.motor.apertar(k[0], k[1]); }
      });
      cv.addEventListener('keyup', (e) => { const k = teclaDoEvento(e); if (k && k[1]) { e.preventDefault(); this.motor.soltar(k[1]); } });
      fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
      document.body.append(fundo); cv.focus(); loop();
      this.app.status('Tela do usuário: Alt+F5 ou clique fora para voltar.');
    }
    timerTela() {
      const loop = () => {
        if (this.raiz.offsetParent !== null) {
          const m = this.motor.m;
          this.tela.desenhar(m.mem, m.getCursor(), m.status === 'aguardando' || m.status === 'executando', m);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    teclado(e) {
      // atalhos do laboratório (chamados pelo app)
      const k = e.key;
      if (k === 'F9' && !e.ctrlKey) { this.motor.executar(); return true; }
      if (k === 'F9' && e.ctrlKey) { this.motor.reiniciar(); this.motor.executar(); return true; }
      if (k === 'F7') { this.motor.passo(); return true; }
      if (k === 'F8') { this.motor.passoPorCima(); return true; }
      if (k === 'F4') { this.motor.ateCursor(this.editor.linhaDoCursor()); return true; }
      if (k === 'F2' && e.ctrlKey) { this.motor.reiniciar(); return true; }
      if (k === 'F2') { this.alternarBp(this.editor.linhaDoCursor()); return true; }
      if (k === 'F5' && e.altKey) { this.telaCheia(); return true; }
      if (k === 'F5' && this.exercicio) { this.verificarExercicio(); return true; }
      if (k === 'Escape' && this.motor.rodando) { this.motor.pausar(); return true; }
      return false;
    }
    verificarExercicio() {
      if (!this.exercicio) return;
      const r = window.Verificador.verificar(this.exercicio, this.editor.valor);
      this.mensagensExtra = window.Verificador.mensagens(r);
      this.abaInf = 'mensagens';
      window.App.registrarExercicio(this.exercicio.id, r.ok, this.editor.valor);
      this.render('aba');
      if (r.ok) som.bip(1200, 90); else som.bip(220, 200);
      this.app.status(r.ok ? 'Exercício correto!' : 'Ainda não: veja as mensagens.');
    }
    renderStats() {
      const m = this.motor.m, p = this.motor.prog;
      const bytes = p && p.ok ? p.instrs.reduce((s, i) => s + (i.synthetic ? 0 : i.size), 0) : 0;
      const tempo = m.cycles / (4.77e6) * 1000;
      const st = this.motor.rodando ? (m.status === 'aguardando' ? '<span class="aguardando">TECLADO</span>' : 'RODANDO') :
        m.halted ? (m.status === 'erro' ? 'ERRO' : 'FIM') : (this.motor.sujo ? 'EDITADO' : 'PARADO');
      this.stats.innerHTML = st + ' │ Instr: ' + m.steps.toLocaleString('pt-BR') + ' │ Ciclos: ' + m.cycles.toLocaleString('pt-BR') +
        ' (' + (tempo < 1 ? tempo.toFixed(3) : tempo.toFixed(1)).replace('.', ',') + ' ms a 4,77 MHz) │ Código: ' + bytes + ' bytes';
    }
    render(tipo) {
      const m = this.motor.m, p = this.motor.prog;
      if (!p) return;
      // linha atual
      const ins = !m.halted && p.ok ? m.currentInstr() : null;
      const seguir = tipo !== 'rodando' || this.motor.velocidade !== 'rapida';
      if (seguir || tipo === 'pausa' || tipo === 'fim') this.editor.setAtual(ins && !ins.synthetic ? ins.line : 0, true);
      this.editor.setErros(new Set(p.ok ? [] : p.errors.map(e => e.line)));
      if (tipo === 'rodando' && this.motor.velocidade === 'rapida' && (this._ultimoRender || 0) > performance.now() - 120) { this.renderStats(); return; }
      this._ultimoRender = performance.now();
      this.regsEl.innerHTML = htmlRegs(m, this.motor.antes, false);
      this.flagsEl.innerHTML = htmlFlags(m, this.motor.flagsAntes);
      this.pilhaEl.innerHTML = htmlPilha(m, 16);
      // mensagens
      if (tipo === 'montado') {
        this.mensagens = [];
        if (!p.ok) { this.abaInf = 'mensagens'; for (const e of p.errors) this.mensagens.push({ t: 'erro', msg: 'Linha ' + e.line + ': ' + e.msg, line: e.line }); }
        else if (this.motor.boot) this.mensagens.push({ t: 'ok', msg: 'Montado como disquete de boot: ' + (m.mapaDisquete || []).map(e => e.nome + ' no setor ' + e.lba + (e.setores > 1 ? ' (' + e.setores + ' setores)' : '')).join(', ') + '. O PC liga sem DOS: a BIOS carrega o setor 0 em 0000:7C00 e salta para lá. Veja a aba Discos.' });
        else this.mensagens.push({ t: 'ok', msg: 'Montado: ' + p.instrs.length + ' instruções, modelo ' + p.model.toUpperCase() + ', entrada em ' + hex(p.entry.seg) + ':' + hex(p.entry.off) + '.' });
        for (const w of p.warnings) this.mensagens.push({ t: 'aviso', msg: 'Linha ' + w.line + ': ' + w.msg, line: w.line });
      }
      for (const e of this.motor.novosEventos()) this.mensagens.push({ t: e.type === 'erro' ? 'erro' : 'aviso', msg: (e.line ? 'Linha ' + e.line + ': ' : '') + e.msg, line: e.line });
      if (tipo === 'fim' && m.haltReason) { this.mensagens.push({ t: m.status === 'erro' ? 'erro' : 'info', msg: '■ ' + m.haltReason }); if (m.status === 'erro') this.abaInf = 'mensagens'; }
      if (tipo === 'pausa' && m.status === 'breakpoint') this.app.status('Parado no breakpoint (linha ' + (ins ? ins.line : '?') + ').');
      if (tipo === 'aguardando') { this.app.status('O programa está esperando o teclado: clique na tela do usuário e digite.'); if (document.activeElement !== this.editor.ta) this.canvas.focus({ preventScroll: true }); }
      this.renderInferior();
      this.renderStats();
      if (this.aba === 'listagem' && tipo === 'montado') this.listagem.innerHTML = htmlListagem(p);
    }
    renderInferior() {
      const m = this.motor.m;
      this.tabsInf.querySelectorAll('.tab').forEach(t => t.classList.toggle('ativo', t.dataset.aba === this.abaInf));
      this.memCtl.innerHTML = '';
      this.memCtl.style.display = this.abaInf === 'memoria' ? 'flex' : 'none';
      if (this.abaInf === 'memoria') {
        const sel = h('select', null, ...['DS', 'ES', 'SS', 'CS', 'B800', 'A000', '0000', '0040'].map(s => h('option', { value: s, selected: s === this.memSeg }, s === 'B800' ? 'B800 (texto)' : s === 'A000' ? 'A000 (VGA 13h)' : s === '0000' ? '0000 (IVT)' : s === '0040' ? '0040 (BIOS)' : s)));
        sel.addEventListener('change', () => { this.memSeg = sel.value; this.memOff = 0; this.renderInferior(); });
        const off = h('input', { type: 'text', value: hex(this.memOff), title: 'Offset em hexadecimal' });
        off.addEventListener('change', () => { const v = parseInt(off.value, 16); if (!isNaN(v)) { this.memOff = v & 0xFFF0; this.renderInferior(); } });
        const nav = (d) => h('button.btn.sec', { style: { margin: 0, boxShadow: 'none' }, onclick: () => { this.memOff = (this.memOff + d) & 0xFFFF; this.renderInferior(); } }, d > 0 ? '▼' : '▲');
        this.memCtl.append('Segmento', sel, 'Offset', off, nav(-0x40), nav(0x40));
        const segv = /^[0-9A-F]{4}$/.test(this.memSeg) ? parseInt(this.memSeg, 16) : m.getReg(this.memSeg);
        // painel estreito (celular): menos bytes por linha e mais linhas, para caber sem rolagem lateral
        const cx = this.inf.closest('.corpo') || this.inf;
        for (const n of [16, 8, 4]) {
          this.inf.innerHTML = htmlMemoria(m, segv, this.memOff, 96 / n, n);
          if (!cx.clientWidth || cx.scrollWidth <= cx.clientWidth) break;
        }
      } else if (this.abaInf === 'variaveis') this.inf.innerHTML = htmlVariaveis(m);
      else if (this.abaInf === 'ivt') {
        const linhas = [];
        for (const n of [0, 1, 3, 8, 9, 0x10, 0x13, 0x16, 0x19, 0x1A, 0x1C, 0x20, 0x21, 0x28, 0x2F, 0x60, 0x61]) {
          const v = m.vector(n);
          linhas.push('INT ' + hex(n, 2) + 'h  0000:' + hex(n * 4) + '  →  ' + hex(v.seg) + ':' + hex(v.off) + (m.isDefaultVector(n) ? '  (BIOS/DOS)' : '  ◄ alterado pelo programa'));
        }
        this.inf.innerHTML = '<div class="lista-mono">' + linhas.join('\n') + '</div>' + (m.residente ? '<div class="dim">Programa residente: ' + m.residente.paras + ' parágrafos mantidos na memória (segmento ' + hex(m.residente.psp) + 'h).</div>' : '');
      } else if (this.abaInf === 'cpu') {
        this.inf.innerHTML = htmlDesmontagem(m, 14);
      } else if (this.abaInf === 'fpu') {
        this.inf.innerHTML = htmlFPU(m);
      } else if (this.abaInf === 'disco') {
        this.renderDisco();
      } else {
        const all = (this.mensagens || []).concat(this.mensagensExtra || []);
        this.inf.innerHTML = '';
        const box = h('div.msgs');
        for (const msg of all.slice(-60)) {
          const d = h('div.m.' + msg.t, null, msg.msg);
          if (msg.line) d.addEventListener('click', () => { this.mudarAba('editor'); this.editor.irPara(msg.line); });
          box.append(d);
        }
        this.inf.append(box);
        this.inf.parentElement.scrollTop = 1e9;
      }
    }
  }

  Laboratorio.prototype.renderDisco = function () {
    const d = Disco.obter();
    this.inf.innerHTML = '';
    const mm = this.motor.m;
    if (mm.modo === 'boot' && mm.mapaDisquete) {
      const t = h('div.lista-mono.disco');
      t.append(h('div.dim', null, ' Disquete A: (1,44 MB, 80 cilindros, 2 cabeças, 18 setores por trilha) feito com os segmentos do programa:'));
      for (const e of mm.mapaDisquete) {
        const chs = (lba) => { const c = Math.floor(lba / 36), r = lba % 36; return 'C' + c + ' H' + Math.floor(r / 18) + ' S' + (r % 18 + 1); };
        t.append(h('div', null, ' ' + e.nome.padEnd(10) + ' setor ' + String(e.lba).padStart(4) + (e.setores > 1 ? '-' + String(e.lba + e.setores - 1).padEnd(4) : '     ') + ' (' + chs(e.lba) + ')  ' + String(e.bytes).padStart(6) + ' bytes, ORG ' + hex(e.org) + 'h'));
      }
      t.append(h('div.dim', null, ' O disquete é refeito a cada montagem. O drive C: abaixo não existe para um programa sem DOS.'));
      this.inf.append(t);
    }
    const lista = h('div.lista-mono.disco');
    const nomes = [...d.keys()].sort();
    lista.append(h('div.dim', null, ' Volume C: do curso — ' + nomes.length + ' arquivo(s)'));
    for (const n of nomes) {
      const f = d.get(n);
      const [base, ext] = n.split('.');
      const linha = h('div.arq', null,
        h('span', null, ' ' + base.padEnd(8) + ' ' + (ext || '').padEnd(3) + ' ' + String(f.dados.length).padStart(7) + ' bytes' + (f.attr & 1 ? '  (somente leitura)' : '') + '  '),
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); this.editarArquivo(n); } }, 'ver/editar'), ' ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.App.confirmar('Apagar ' + n + '?', () => { d.delete(n); Disco.salvar(); this.renderInferior(); }); } }, 'apagar'));
      lista.append(linha);
    }
    lista.append(h('div', { style: { marginTop: '.4em' } },
      h('button.btn.sec', { style: { boxShadow: 'none' }, onclick: () => this.editarArquivo(null) }, 'Novo arquivo'),
      h('button.btn.sec', { style: { boxShadow: 'none' }, onclick: () => { Disco.restaurar(); this.renderInferior(); } }, 'Restaurar arquivos de exemplo')));
    this.inf.append(lista);
  };
  Laboratorio.prototype.editarArquivo = function (nome) {
    const d = Disco.obter();
    const f = nome ? d.get(nome) : null;
    const inNome = h('input', { type: 'text', value: nome || 'NOVO.TXT', style: { width: '14ch' } });
    const ta = h('textarea', { spellcheck: 'false', style: { width: 'min(70ch, 80vw)', height: '14em', background: '#000', color: '#ccc', fontFamily: 'var(--font)', fontSize: 'var(--code-fs)' } });
    ta.value = f ? Disco.texto(f) : '';
    window.App.dialogo(nome ? 'Arquivo ' + nome : 'Novo arquivo', [h('div', null, 'Nome (8.3): ', inNome), ta, h('div.dim', null, 'Cada quebra de linha é gravada como CR LF (0Dh 0Ah), como no DOS.')], [['Salvar', () => {
      const n = inNome.value.trim().toUpperCase();
      if (!/^[A-Z0-9_$~!#%&\-]{1,8}(\.[A-Z0-9_$~!#%&\-]{0,3})?$/.test(n)) { window.App.status('Nome inválido: use até 8 letras, ponto e até 3 letras (ex.: DADOS.TXT).'); return; }
      const dados = [];
      for (const ch of ta.value.replace(/\r\n?/g, '\n')) { if (ch === '\n') dados.push(13, 10); else dados.push(Asm.cp437(ch)); }
      if (nome && nome !== n) d.delete(nome);
      d.set(n, { dados, attr: f ? f.attr : 0x20 });
      Disco.salvar(); this.abaInf = 'disco'; this.renderInferior();
    }], ['Cancelar', null]]);
  };

  const EXEMPLO_INICIAL = `; ============================================
;  OLA.ASM - seu primeiro programa .EXE
;  F9 executa, F7 executa passo a passo.
; ============================================
.MODEL SMALL
.STACK 100h

.DATA
mensagem DB 'Ola, mundo do 8086!', 13, 10, '$'

.CODE
inicio:
        MOV  AX, @DATA      ; endereço do segmento de dados
        MOV  DS, AX         ; DS precisa apontar para os dados

        MOV  AH, 09h        ; função 09h do DOS: imprimir string
        LEA  DX, mensagem   ; DS:DX aponta para o texto
        INT  21h

        MOV  AX, 4C00h      ; função 4Ch: terminar (código 0)
        INT  21h
END inicio
`;
  const MODELO_NOVO = `.MODEL SMALL
.STACK 100h

.DATA

.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
`;

  window.Depurador = { criarEditor, Motor, MiniDepurador, Laboratorio, Jogador, htmlRegs, htmlFlags, teclaDoEvento, FLAGS_INFO, Disco, fmtReal };
})();
