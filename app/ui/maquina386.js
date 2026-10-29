/* Painel da máquina 386 (trilha avançada): monta código NASM com o montador do curso,
   roda na máquina 386 e mostra a tela de texto, os registradores de 32 bits, os
   registradores de controle, a GDT e os eventos (exceções, troca de modo, paginação). */
(function () {
  'use strict';
  const { h, escHtml } = window.UI;
  const N = window.Nasm386, M = window.Maquina386;
  const hex = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n || 8, '0');

  // ---------------- realce de sintaxe NASM ----------------
  const REGS = new Set([...N.R8, ...N.R16, ...N.R32, ...N.SREG].map(x => x.toUpperCase()).concat(['CR0', 'CR2', 'CR3', 'CR4', 'DR0', 'DR1', 'DR2', 'DR3', 'DR6', 'DR7']));
  const MNEM = new Set([...N.MNEMONICOS].map(x => x.toUpperCase()));
  const DIRS = new Set(['DB', 'DW', 'DD', 'DQ', 'RESB', 'RESW', 'RESD', 'RESQ', 'TIMES', 'EQU', 'ORG', 'BITS', 'USE16', 'USE32', 'ALIGN', 'ALIGNB',
    'SECTION', 'SEGMENT', 'GLOBAL', 'CPU', 'STRUC', 'ENDSTRUC', 'BYTE', 'WORD', 'DWORD', 'QWORD', 'SHORT', 'NEAR', 'FAR', 'STRICT', 'TO']);
  function realceLinha(line) {
    let out = '', i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === ';') { out += '<span class="k-com">' + escHtml(line.slice(i)) + '</span>'; break; }
      if (c === '\'' || c === '"' || c === '`') {
        let j = i + 1;
        while (j < line.length && line[j] !== c) j++;
        out += '<span class="k-str">' + escHtml(line.slice(i, j + 1)) + '</span>';
        i = j + 1; continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i; while (j < line.length && /[0-9A-Za-z_]/.test(line[j])) j++;
        out += '<span class="k-num">' + escHtml(line.slice(i, j)) + '</span>';
        i = j; continue;
      }
      if (c === '%') {
        let j = i + 1; while (j < line.length && /[\w%]/.test(line[j])) j++;
        out += '<span class="k-dir">' + escHtml(line.slice(i, j)) + '</span>';
        i = j; continue;
      }
      if (/[A-Za-z_@$?.]/.test(c)) {
        let j = i; while (j < line.length && /[\w@$?.#]/.test(line[j])) j++;
        const w = line.slice(i, j), u = w.toUpperCase();
        let cls = '';
        if (line[j] === ':' && !REGS.has(u)) cls = 'k-lbl';
        else if (REGS.has(u)) cls = 'k-reg';
        else if (DIRS.has(u) || u === '$' || u === '$$') cls = 'k-dir';
        else if (MNEM.has(u) || /^(REP|REPE|REPNE|REPZ|REPNZ|LOCK|O16|O32|A16|A32)$/.test(u)) cls = 'k-ins';
        out += cls ? '<span class="' + cls + '">' + escHtml(w) + '</span>' : escHtml(w);
        i = j; continue;
      }
      out += escHtml(c);
      i++;
    }
    return out;
  }
  function realce(code) { return code.split('\n').map(realceLinha).join('\n'); }

  function montar(codigo) { return N.temArquivos(codigo) ? N.montarDisco(codigo) : N.montar(codigo); }

  // ---------------- painel ----------------
  class Painel386 {
    constructor(codigo, opts) {
      this.opts = opts || {};
      this.codigo = codigo;
      this.modo = this.opts.modo || 'com';
      this.preCod = h('pre.asm');
      this.regs = h('div.regs');
      this.sist = h('div.regs', { style: { marginTop: '.3em' } });
      this.gdt = h('div.lista-mono', { style: { marginTop: '.3em', fontSize: '.9em' } });
      this.saida = h('div.saida');
      this.cv = h('canvas.tela.mini-gfx', { tabindex: '0', title: 'Tela do PC (80×25). Clique aqui para digitar no teclado do programa.' });
      this.tela = new window.Tela(this.cv);
      this.cv.addEventListener('keydown', (e) => {
        const k = window.Depurador.teclaDoEvento(e);
        if (k) { e.preventDefault(); this.tecla(k[0], k[1]); }
      });
      this.ev = h('div');
      this.st = h('span.st');
      this.entrada = h('input', { type: 'text', placeholder: 'teclado do programa…', title: 'O que você digitar aqui vai para o teclado do programa. Enter envia.' });
      this.entrada.addEventListener('keydown', (e) => {
        const k = window.Depurador.teclaDoEvento(e);
        if (k) { e.preventDefault(); this.tecla(k[0], k[1]); if (k[0] === 13) this.entrada.value = ''; else if (k[0] === 8) this.entrada.value = this.entrada.value.slice(0, -1); else if (k[0]) this.entrada.value += e.key; }
      });
      const btn = (txt, fn, titulo) => h('button.btn', { onclick: fn, title: titulo || '' }, txt);
      this.el = h('div.mini-dbg.m386', null,
        h('div.linhas', null,
          h('div', null, this.preCod, h('div', { style: { color: 'var(--head2)', marginTop: '.3em' } }, 'Saída (INT 21h, porta E9h, serial):'), this.saida),
          h('div', null, this.regs, this.sist, this.gdt)),
        this.cv, this.ev,
        h('div.ctl', null,
          btn('► Passo', () => { this.parar(); this.passo(); }, 'Executa uma instrução'),
          btn('►► Executar', () => this.executar(2000), 'Executa animado'),
          btn('» Rápido', () => this.executar(200000), 'Executa na velocidade máxima'),
          btn('■ Pausar', () => { this.parar(); this.render(); }),
          btn('↺ Reiniciar', () => { this.parar(); this.reiniciar(); }),
          this.entrada, this.st));
      this.reiniciar();
    }

    reiniciar() {
      this.prog = montar(this.codigo);
      this.m = null;
      if (!this.prog.ok) { this.render(); return; }
      const m = this.m = new M.Maquina({ memoria: 8 * 1024 * 1024, esperarTeclado: true });
      const opts = { modo: this.modo, org: this.opts.org ? +this.opts.org : undefined };
      if (this.prog.arquivos) opts.disco = this.prog.bytes;
      try { m.carregar(this.prog.arquivos && this.modo !== 'boot' ? this.prog.arquivos[0].bytes : this.prog.bytes, opts); }
      catch (e) { m.status = 'erro'; m.motivo = e.message; }
      if (this.opts.entrada) m.teclar(this.opts.entrada);
      // endereço -> linha do código-fonte
      this.mapa = new Map();
      const desloc = this.modo === 'com' ? 0x7000 : 0;
      for (const l of this.prog.listagem) if (l.tam && !this.mapa.has(l.end + desloc)) this.mapa.set(l.end + desloc, l.linha);
      this.antes = null;
      this.tela.invalidar();
      this.render('inicio');
    }

    tecla(ascii, scan) {
      if (!this.m) return;
      this.m.teclas.push({ ascii, scan });
      if (this.m.status === 'aguardando') { this.m.status = 'executando'; if (!this.timer) this.executar(2000); }
    }

    linhaAtual() {
      const m = this.m;
      if (!m) return 0;
      return this.mapa.get(m.linearEIP()) || this.mapa.get(m.eip) || 0;
    }

    passo() {
      if (!this.m || this.fim()) return;
      this.antes = this.m.r.slice();
      this.m.passo();
      this.render('passo');
    }
    fim() { return ['terminado', 'erro', 'excecao'].includes(this.m.status); }
    executar(porQuadro) {
      if (!this.m) return;
      this.parar();
      this.antes = null;
      const quadro = () => {
        if (!this.m || this.fim() || this.m.status === 'aguardando' || this.m.status === 'pausa') { this.timer = null; this.render('fim'); return; }
        this.m.executar(porQuadro);
        this.render('rodando');
        this.timer = requestAnimationFrame(quadro);
      };
      if (this.m.status === 'pausa') this.m.status = 'executando';
      this.timer = requestAnimationFrame(quadro);
    }
    parar() { if (this.timer) cancelAnimationFrame(this.timer); this.timer = null; }

    render(tipo) {
      const m = this.m, p = this.prog;
      if (!p.ok) {
        this.preCod.innerHTML = realce(this.codigo);
        this.ev.innerHTML = p.erros.map(e => '<div class="ev erro">' + (e.arquivo ? e.arquivo + ', ' : '') + 'Linha ' + e.linha + ': ' + escHtml(e.msg) + '</div>').join('');
        this.regs.innerHTML = this.sist.innerHTML = this.gdt.innerHTML = '';
        return;
      }
      const cur = this.fim() ? 0 : this.linhaAtual();
      this.preCod.innerHTML = this.codigo.split('\n').map((l, i) => i + 1 === cur ? '<span class="cur">' + realceLinha(l || ' ') + '</span>' : realceLinha(l)).join('\n');
      if (cur && tipo !== 'rodando') {
        const el = this.preCod.querySelector('.cur');
        if (el) { const top = el.offsetTop - this.preCod.offsetTop; if (top < this.preCod.scrollTop || top > this.preCod.scrollTop + this.preCod.clientHeight - 30) this.preCod.scrollTop = top - 40; }
      }
      // registradores gerais
      const a = this.antes;
      const rc = (nm, v, n, mud) => '<span class="rc"><span class="nm">' + nm + '</span> <span class="' + (mud ? 'mud' : 'v') + '">' + hex(v, n) + '</span></span>';
      let r = '';
      M.NOMES32.forEach((nm, i) => { r += rc(nm, m.r[i], 8, a && a[i] !== m.r[i]); });
      r += rc('EIP', m.eip, 8) + '<br>';
      M.NOMES_SEG.forEach((nm, i) => { r += rc(nm, m.seg[i].sel, 4); });
      const F = [['C', M.CF], ['P', M.PF], ['A', M.AF], ['Z', M.ZF], ['S', M.SF], ['T', M.TF], ['I', M.IF], ['D', M.DF], ['O', M.OF], ['NT', M.NT], ['VM', M.VM]];
      r += '<br><span class="nm">EFLAGS</span> <span class="v">' + hex(m.flags, 8) + '</span> ' + F.map(([n, b]) => '<span class="' + (m.flags & b ? 'v' : 'dim') + '">' + n + '</span>').join(' ') + ' <span class="nm">IOPL</span> <span class="v">' + ((m.flags >> 12) & 3) + '</span>';
      this.regs.innerHTML = r;
      // sistema
      const modoTxt = !m.pe ? 'modo real' : m.v86 ? 'modo virtual 8086' : 'modo protegido' + (m.seg[1].big ? ' 32 bits' : ' 16 bits');
      let s = '<span class="rc"><span class="nm">MODO</span> <span class="v">' + modoTxt + (m.pg ? ', paginação' : '') + '</span></span><span class="rc"><span class="nm">CPL</span> <span class="v">' + m.cpl + '</span></span><span class="rc"><span class="nm">A20</span> <span class="v">' + (m.a20 ? 'ligada' : 'desligada') + '</span></span><br>';
      s += rc('CR0', m.cr0, 8) + rc('CR2', m.cr2, 8) + rc('CR3', m.cr3, 8) + '<br>';
      s += '<span class="rc"><span class="nm">GDTR</span> <span class="v">' + hex(m.gdtr.base, 8) + ':' + hex(m.gdtr.limit, 4) + '</span></span>';
      s += '<span class="rc"><span class="nm">IDTR</span> <span class="v">' + hex(m.idtr.base, 8) + ':' + hex(m.idtr.limit, 4) + '</span></span>';
      s += rc('TR', m.tr.sel, 4) + rc('LDTR', m.ldtr.sel, 4);
      if (m.pe) s += '<br>' + M.NOMES_SEG.map((nm, i) => { const g = m.seg[i]; return '<span class="rc"><span class="nm">' + nm + '</span> <span class="dim">base ' + hex(g.base, 8) + ' lim ' + hex(g.limit, 8) + '</span></span>'; }).join('');
      this.sist.innerHTML = s;
      // GDT
      if (m.pe && m.gdtr.limit > 7) {
        let g = '<span class="ad">GDT</span>\n';
        for (const d of m.descritoresGDT(10)) {
          if (!d.indice) { g += '<span class="as">' + hex(0, 4) + ' (nulo)</span>\n'; continue; }
          g += hex(d.seletor, 4) + ' ' + (d.presente ? '' : '[ausente] ') + 'base ' + hex(d.base, 8) + ' lim ' + hex(d.limit, 8) + ' DPL' + d.dpl + ' ' + escHtml(M.nomeTipo(d)) + (d.s && (d.tipo & 8) ? (d.big ? ', 32 bits' : ', 16 bits') : '') + '\n';
        }
        this.gdt.innerHTML = g;
      } else this.gdt.innerHTML = '';
      this.saida.textContent = m.saida || '';
      const cpos = m.tela.cursor;
      this.tela.desenhar(m.mem, { row: Math.floor(cpos / 80), col: cpos % 80 }, true, null);
      const evs = m.eventos.filter(e => e.tipo !== 'fim').slice(-4).map(e => '<div class="ev' + (e.tipo === 'excecao' || e.tipo === 'erro' ? ' erro' : '') + '">' + escHtml(e.texto) + '</div>').join('');
      let fim = '';
      if (m.status === 'terminado') fim = '<div class="ev">■ ' + escHtml(m.motivo || 'Programa terminou.') + '</div>';
      else if (m.status === 'excecao' || m.status === 'erro') fim = '<div class="ev erro">■ ' + escHtml(m.motivo || '') + '</div>';
      this.ev.innerHTML = evs + fim;
      this.st.innerHTML = m.status === 'aguardando' ? '<span class="aguardando">Aguardando teclado: digite na caixa ao lado ou clique na tela</span>' : 'Instruções: ' + m.passos.toLocaleString('pt-BR');
    }
  }

  window.Maquina386UI = { Painel386, realce, realceLinha, montar };
})();
