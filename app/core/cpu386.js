/*
 * Máquina 386 da trilha avançada do Curso Assembly.
 *
 * Um PC com um 80386: registradores de 32 bits, modo real, modo protegido
 * (segmentação com descritores, GDT, LDT, IDT, anéis de privilégio, portas de
 * chamada, TSS e troca de tarefas por hardware), paginação de dois níveis e o
 * modo virtual 8086. Em volta da CPU: memória de 8 MB com a linha A20, PIC
 * 8259 duplo, PIT 8253, teclado 8042, tela de texto em B8000h, porta serial,
 * porta de depuração E9h, CMOS e um disco ATA. A BIOS e um DOS mínimo (para
 * programas .COM) são implementados em JavaScript, como no simulador do 8086.
 *
 * É um arquivo separado do cpu.js: o curso do 8086 não usa nada daqui.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Maquina386 = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------- constantes ----------------
  const CF = 1 << 0, PF = 1 << 2, AF = 1 << 4, ZF = 1 << 6, SF = 1 << 7, TF = 1 << 8, IF = 1 << 9, DF = 1 << 10, OF = 1 << 11;
  const IOPL = 3 << 12, NT = 1 << 14, RF = 1 << 16, VM = 1 << 17;
  const FLAGS_386 = 0x37FD5;   // bits que existem no 386 (sem AC e ID, que vieram com o 486 e o Pentium)
  const ES = 0, CS = 1, SS = 2, DS = 3, FS = 4, GS = 5;
  const NOMES_SEG = ['ES', 'CS', 'SS', 'DS', 'FS', 'GS'];
  const NOMES32 = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'];
  const NOMES16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const NOMES8 = ['AL', 'CL', 'DL', 'BL', 'AH', 'CH', 'DH', 'BH'];
  const BIOS_STUB = 0xFE000;          // F000:E000 + 4n: "código" da BIOS para a interrupção n
  const AMBIENTE_EXC = 0xFF000;       // modo pm32: o ambiente registra exceções que o programa não tratou
  const MEM_PADRAO = 8 * 1024 * 1024;
  const PIT_HZ = 1193182;

  const EXCECOES = {
    0: ['#DE', 'erro de divisão', 'DIV ou IDIV por zero, ou um quociente que não cabe no registrador'],
    1: ['#DB', 'depuração', 'passo a passo (TF) ou ponto de parada'],
    3: ['#BP', 'ponto de parada', 'a instrução INT3'],
    4: ['#OF', 'estouro', 'INTO com OF ligada'],
    5: ['#BR', 'fora dos limites', 'BOUND com o índice fora da faixa'],
    6: ['#UD', 'instrução inválida', 'bytes que não formam uma instrução do 386 (ou instrução de outro processador)'],
    7: ['#NM', 'coprocessador ausente', 'instrução de ponto flutuante sem 387'],
    8: ['#DF', 'falha dupla', 'uma exceção aconteceu enquanto o processador tentava entregar outra'],
    10: ['#TS', 'TSS inválido', 'erro ao carregar um segmento de estado de tarefa'],
    11: ['#NP', 'segmento ausente', 'um descritor com o bit P zerado'],
    12: ['#SS', 'falha na pilha', 'pilha fora do limite ou seletor de pilha inválido'],
    13: ['#GP', 'proteção geral', 'acesso fora do limite, seletor inválido, instrução privilegiada no anel errado e afins'],
    14: ['#PF', 'falha de página', 'página ausente ou acesso que a página não permite'],
    16: ['#MF', 'erro do coprocessador', '']
  };

  class Excecao {
    constructor(vetor, codigo, motivo) { this.vetor = vetor; this.codigo = codigo; this.motivo = motivo || ''; }
  }
  class Parada {
    constructor(status, motivo) { this.status = status; this.motivo = motivo; }
  }

  const hex = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n || 8, '0');
  const MASK = { 1: 0xFF, 2: 0xFFFF, 4: 0xFFFFFFFF };
  const SINAL = { 1: 0x80, 2: 0x8000, 4: 0x80000000 };
  const paridade = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { let b = i, p = 1; while (b) { p ^= b & 1; b >>= 1; } paridade[i] = p; }
  const sx8 = (v) => (v << 24) >> 24;
  const sx16 = (v) => (v << 16) >> 16;
  const sx = (v, s) => s === 1 ? sx8(v) : s === 2 ? sx16(v) : v | 0;

  // ---------------- teclado: ASCII -> scan code (conjunto 1) ----------------
  const SCAN = {};
  ('1234567890-=').split('').forEach((c, i) => { SCAN[c] = 0x02 + i; });
  ('qwertyuiop[]').split('').forEach((c, i) => { SCAN[c] = 0x10 + i; });
  ("asdfghjkl;'`").split('').forEach((c, i) => { SCAN[c] = 0x1E + i; });
  ('\\zxcvbnm,./').split('').forEach((c, i) => { SCAN[c] = 0x2B + i; });
  const SHIFT_DE = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '~': '`', '|': '\\', '<': ',', '>': '.', '?': '/' };
  function teclaDe(ch) {
    if (ch === '\r' || ch === '\n') return { ascii: 13, scan: 0x1C };
    if (ch === ' ') return { ascii: 32, scan: 0x39 };
    if (ch === '\b') return { ascii: 8, scan: 0x0E };
    if (ch === '\t') return { ascii: 9, scan: 0x0F };
    if (ch === '\u001b') return { ascii: 27, scan: 0x01 };
    const lower = ch.toLowerCase();
    if (SCAN[lower] !== undefined) return { ascii: ch.charCodeAt(0), scan: SCAN[lower], shift: ch !== lower };
    if (SHIFT_DE[ch]) return { ascii: ch.charCodeAt(0), scan: SCAN[SHIFT_DE[ch]], shift: true };
    return { ascii: ch.charCodeAt(0) & 0xFF, scan: 0 };
  }
  const ESPECIAIS = { ESC: [27, 0x01], ENTER: [13, 0x1C], TAB: [9, 0x0F], CIMA: [0, 0x48], BAIXO: [0, 0x50], ESQUERDA: [0, 0x4B], DIREITA: [0, 0x4D], F1: [0, 0x3B], F2: [0, 0x3C], F10: [0, 0x44], ESPACO: [32, 0x39] };
  function teclasDe(texto) {
    const r = [];
    const re = /\{(\w+)\}|([\s\S])/g;
    let m;
    while ((m = re.exec(texto || ''))) {
      if (m[1] && ESPECIAIS[m[1].toUpperCase()]) { const [a, s] = ESPECIAIS[m[1].toUpperCase()]; r.push({ ascii: a, scan: s }); }
      else r.push(teclaDe(m[0]));
    }
    return r;
  }

  // ---------------- dispositivos ----------------
  class PIC {
    constructor(base) { this.base = base; this.imr = 0xFF; this.irr = 0; this.isr = 0; this.icw = 0; this.icw4 = false; this.lerISR = false; this.autoEoi = false; }
    escrever(porta, v) {
      if ((porta & 1) === 0) {
        if (v & 0x10) { this.icw = 2; this.icw4 = !!(v & 1); this.imr = 0; this.isr = 0; this.irr = 0; return; }   // ICW1
        if (v & 0x08) { this.lerISR = (v & 3) === 3; return; }   // OCW3
        if ((v & 0xE0) === 0x20) { for (let i = 0; i < 8; i++) if (this.isr & (1 << i)) { this.isr &= ~(1 << i); break; } return; }   // EOI comum
        if ((v & 0xE0) === 0x60) { this.isr &= ~(1 << (v & 7)); return; }   // EOI específico
        return;
      }
      if (this.icw === 2) { this.base = v & 0xF8; this.icw = 3; return; }
      if (this.icw === 3) { this.icw = this.icw4 ? 4 : 0; return; }
      if (this.icw === 4) { this.autoEoi = !!(v & 2); this.icw = 0; return; }
      this.imr = v & 0xFF;
    }
    ler(porta) {
      if ((porta & 1) === 0) return this.lerISR ? this.isr : this.irr;
      return this.imr;
    }
    pendente() {   // IRQ de maior prioridade pedida, não mascarada e acima das que estão em serviço
      const req = this.irr & ~this.imr;
      for (let i = 0; i < 8; i++) {
        if (this.isr & (1 << i)) return -1;
        if (req & (1 << i)) return i;
      }
      return -1;
    }
  }

  // ---------------- a máquina ----------------
  class Maquina {
    constructor(opts) {
      this.opts = Object.assign({ memoria: MEM_PADRAO, mips: 20 }, opts || {});
      this.mem = new Uint8Array(this.opts.memoria);
      this.r = new Uint32Array(8);
      this.disco = this.opts.disco || new Uint8Array(512 * 2880);
      this.saida = '';
      this.eventos = [];
      this.reset();
    }

    reset() {
      this.mem.fill(0);
      this.r.fill(0);
      this.eip = 0;
      this.flags = 0x2;
      this.seg = [];
      for (let i = 0; i < 6; i++) this.seg.push({ sel: 0, base: 0, limit: 0xFFFF, tipo: 0x13, dpl: 0, big: false, presente: true, valido: true, s: true });
      this.cr0 = 0x10; this.cr2 = 0; this.cr3 = 0;
      this.dr = new Uint32Array(8);
      this.gdtr = { base: 0, limit: 0xFFFF };
      this.idtr = { base: 0, limit: 0x3FF };
      this.ldtr = { sel: 0, base: 0, limit: 0, valido: false };
      this.tr = { sel: 0, base: 0, limit: 0, tipo: 0, valido: false };
      this.cpl = 0;
      this.a20 = false;
      this.tlb = new Map();
      this.status = 'pronto';
      this.motivo = '';
      this.passos = 0;
      this.saida = '';
      this.eventos = [];
      this.inibirInt = false;
      this.hltEspera = false;
      this.tela = { modo: 3, cursor: 0, crtcIndice: 0 };
      this.telaMudou = true;
      this.picM = new PIC(0x08); this.picE = new PIC(0x70);
      this.pit = { reload: 0x10000, modo: 3, lsb: null, acesso: 3, latch: null };
      this.proxTick = this.periodoTimer();
      this.kbd = { fila: [], saida: null, cmd: null, porta: 0xDF, buffer: [], habilitado: true, shift: false };
      this.teclas = [];   // teclas de teste ainda não "digitadas"
      this.cmos = { indice: 0 };
      this.serial = { lcr: 0, ier: 0, dll: 1 };
      this.ata = { setor: 0, cont: 1, cmd: 0, buf: null, pos: 0, status: 0x50, drive: 0xE0, lba: [0, 0, 0, 0], escrevendo: false };
      this.harness = null;
      this.biosTicks = 0;
      this.excecaoEmEntrega = 0;
    }

    periodoTimer() { return Math.max(200, Math.round(this.pit.reload * this.opts.mips * 1e6 / PIT_HZ)); }

    defSeg(i, campos) { this.seg[i] = Object.assign({}, this.seg[i], campos); }
    // estado no início da instrução: uma falha (fault) volta tudo para cá
    foto() { this.eipInicio = this.eip; this.regsInicio = this.r.slice(); this.segsInicio = this.seg.slice(); this.flagsInicio = this.flags; this.cplInicio = this.cpl; }
    restaurar() { this.eip = this.eipInicio; this.r.set(this.regsInicio); this.seg = this.segsInicio.slice(); this.flags = this.flagsInicio; this.cpl = this.cplInicio; }

    // ---------------- registradores ----------------
    get eax() { return this.r[0]; }
    get pe() { return (this.cr0 & 1) === 1; }
    get pg() { return (this.cr0 & 0x80000000) !== 0; }
    get v86() { return (this.flags & VM) !== 0; }
    get8(i) { return i < 4 ? this.r[i] & 0xFF : (this.r[i - 4] >>> 8) & 0xFF; }
    set8(i, v) {
      if (i < 4) this.r[i] = (this.r[i] & 0xFFFFFF00) | (v & 0xFF);
      else this.r[i - 4] = (this.r[i - 4] & 0xFFFF00FF) | ((v & 0xFF) << 8);
    }
    get16(i) { return this.r[i] & 0xFFFF; }
    set16(i, v) { this.r[i] = (this.r[i] & 0xFFFF0000) | (v & 0xFFFF); }
    getR(s, i) { return s === 1 ? this.get8(i) : s === 2 ? this.r[i] & 0xFFFF : this.r[i]; }
    setR(s, i, v) { if (s === 1) this.set8(i, v); else if (s === 2) this.set16(i, v); else this.r[i] = v >>> 0; }

    lerRegistrador(nome) {
      const n = nome.toUpperCase();
      let i;
      if ((i = NOMES32.indexOf(n)) >= 0) return this.r[i];
      if ((i = NOMES16.indexOf(n)) >= 0) return this.r[i] & 0xFFFF;
      if ((i = NOMES8.indexOf(n)) >= 0) return this.get8(i);
      if ((i = NOMES_SEG.indexOf(n)) >= 0) return this.seg[i].sel;
      if (n === 'EIP') return this.eip;
      if (n === 'IP') return this.eip & 0xFFFF;
      if (n === 'EFLAGS' || n === 'FLAGS') return this.flags;
      if (n === 'CR0') return this.cr0; if (n === 'CR2') return this.cr2; if (n === 'CR3') return this.cr3;
      if (n === 'CPL') return this.cpl;
      if (n === 'IOPL') return (this.flags >> 12) & 3;
      if (n === 'TR') return this.tr.sel; if (n === 'LDTR') return this.ldtr.sel;
      const fl = { CF, PF, AF, ZF, SF, TF, IF, DF, OF, NT, VM, RF }[n];
      if (fl) return (this.flags & fl) ? 1 : 0;
      throw new Error('Registrador desconhecido: ' + nome);
    }
    escreverRegistrador(nome, v) {
      const n = nome.toUpperCase();
      let i;
      if ((i = NOMES32.indexOf(n)) >= 0) { this.r[i] = v >>> 0; return; }
      if ((i = NOMES16.indexOf(n)) >= 0) { this.set16(i, v); return; }
      if ((i = NOMES8.indexOf(n)) >= 0) { this.set8(i, v); return; }
      const fl = { CF, PF, AF, ZF, SF, TF, IF, DF, OF }[n];
      if (fl) { this.setFlag(fl, !!v); return; }
      if ((i = NOMES_SEG.indexOf(n)) >= 0 && !this.pe) { this.defSeg(i, { sel: v & 0xFFFF, base: (v & 0xFFFF) << 4 }); return; }
      throw new Error('Registrador desconhecido: ' + nome);
    }
    flag(f) { return (this.flags & f) !== 0; }
    setFlag(f, on) { if (on) this.flags |= f; else this.flags &= ~f; }

    // ---------------- memória física ----------------
    fisico(a) {
      if (!this.a20) a &= ~0x100000;
      return a >>> 0;
    }
    lerFis8(a) { a = this.fisico(a); return a < this.mem.length ? this.mem[a] : 0xFF; }
    escFis8(a, v) {
      a = this.fisico(a);
      if (a >= this.mem.length || (a >= 0xF0000 && a < 0x100000)) return;   // fora da RAM ou ROM da BIOS
      this.mem[a] = v;
      if (a >= 0xB8000 && a < 0xC0000) this.telaMudou = true;
    }
    lerFis16(a) { return this.lerFis8(a) | (this.lerFis8(a + 1) << 8); }
    lerFis32(a) { return (this.lerFis8(a) | (this.lerFis8(a + 1) << 8) | (this.lerFis8(a + 2) << 16) | (this.lerFis8(a + 3) << 24)) >>> 0; }
    escFis16(a, v) { this.escFis8(a, v & 0xFF); this.escFis8(a + 1, (v >>> 8) & 0xFF); }
    escFis32(a, v) { for (let i = 0; i < 4; i++) this.escFis8(a + i, (v >>> (8 * i)) & 0xFF); }

    // ---------------- paginação ----------------
    // traduz um endereço linear; usuario = acesso feito no anel 3
    traduzir(lin, escrita, usuario) {
      lin >>>= 0;
      if (!this.pg) return lin;
      const pag = lin >>> 12;
      const t = this.tlb.get(pag);
      if (t && (!escrita || t.sujo) && (!usuario || t.us) && (!escrita || !usuario || t.rw)) return (t.fis | (lin & 0xFFF)) >>> 0;
      const dirEnd = ((this.cr3 & 0xFFFFF000) + ((lin >>> 22) << 2)) >>> 0;
      const pde = this.lerFis32(dirEnd);
      const erro = (p) => {
        this.cr2 = lin;
        throw new Excecao(14, (p ? 1 : 0) | (escrita ? 2 : 0) | (usuario ? 4 : 0),
          (p ? 'a página existe, mas não permite este acesso' : 'a página não está presente') + ' (endereço linear ' + hex(lin) + (p ? '' : ', ' + (pde & 1 ? 'entrada da tabela de páginas' : 'entrada do diretório') + ' com P=0') + ')');
      };
      if (!(pde & 1)) erro(false);
      const tabEnd = ((pde & 0xFFFFF000) + (((lin >>> 12) & 0x3FF) << 2)) >>> 0;
      const pte = this.lerFis32(tabEnd);
      if (!(pte & 1)) erro(false);
      const us = !!(pde & 4) && !!(pte & 4);
      const rw = !!(pde & 2) && !!(pte & 2);
      if (usuario && !us) erro(true);
      if (usuario && escrita && !rw) erro(true);   // no 386, o anel 0 escreve mesmo em página só de leitura (o bit WP veio no 486)
      if (!(pde & 0x20)) this.escFis32(dirEnd, pde | 0x20);
      let novo = pte | 0x20;
      if (escrita) novo |= 0x40;
      if (novo !== pte) this.escFis32(tabEnd, novo);
      const fis = (pte & 0xFFFFF000) >>> 0;
      this.tlb.set(pag, { fis, us, rw, sujo: escrita || !!(pte & 0x40) });
      return (fis | (lin & 0xFFF)) >>> 0;
    }
    limparTLB() { this.tlb.clear(); }

    // acesso linear (com paginação), byte a byte quando cruza página
    lerLin(lin, n, usuario) {
      lin >>>= 0;
      if ((lin & 0xFFF) + n <= 0x1000) {
        const f = this.traduzir(lin, false, usuario);
        return n === 1 ? this.lerFis8(f) : n === 2 ? this.lerFis16(f) : this.lerFis32(f);
      }
      let v = 0;
      for (let i = 0; i < n; i++) v += this.lerFis8(this.traduzir(lin + i, false, usuario)) * Math.pow(2, 8 * i);
      return v >>> 0;
    }
    escLin(lin, n, v, usuario) {
      lin >>>= 0;
      if ((lin & 0xFFF) + n <= 0x1000) {
        const f = this.traduzir(lin, true, usuario);
        if (n === 1) this.escFis8(f, v & 0xFF); else if (n === 2) this.escFis16(f, v); else this.escFis32(f, v);
        return;
      }
      const fs = [];
      for (let i = 0; i < n; i++) fs.push(this.traduzir(lin + i, true, usuario));   // todas as páginas antes de escrever
      for (let i = 0; i < n; i++) this.escFis8(fs[i], (v >>> (8 * i)) & 0xFF);
    }

    // ---------------- segmentação ----------------
    // endereço linear de seg:off, com as verificações do modo protegido
    linear(s, off, n, escrita) {
      const d = this.seg[s];
      off >>>= 0;
      if (this.pe && !this.v86) {
        if (!d.valido) throw new Excecao(s === SS ? 12 : 13, 0, 'o registrador ' + NOMES_SEG[s] + ' tem o seletor nulo');
        if (escrita && (d.tipo & 0x18) !== 0x10) throw new Excecao(13, 0, 'escrita num segmento de código (' + NOMES_SEG[s] + ' = ' + hex(d.sel, 4) + ')');
        if (escrita && (d.tipo & 0x1A) === 0x10) throw new Excecao(13, 0, 'escrita num segmento de dados só de leitura (' + NOMES_SEG[s] + ' = ' + hex(d.sel, 4) + ')');
        if (!escrita && (d.tipo & 0x1A) === 0x18) throw new Excecao(13, 0, 'leitura de um segmento de código que só permite execução');
      }
      const fim = off + n - 1;
      if ((d.tipo & 0x1C) === 0x14 && this.pe && !this.v86) {   // dados expand-down
        const sup = d.big ? 0xFFFFFFFF : 0xFFFF;
        if (off <= d.limit || fim > sup) throw new Excecao(s === SS ? 12 : 13, 0, 'acesso fora do segmento expand-down ' + NOMES_SEG[s]);
      } else if (fim > d.limit) {
        throw new Excecao(s === SS ? 12 : 13, 0, 'deslocamento ' + hex(off) + ' passa do limite ' + hex(d.limit) + ' do segmento ' + NOMES_SEG[s] + (this.pe ? '' : ' (no modo real, o limite é FFFFh)'));
      }
      return (d.base + off) >>> 0;
    }
    ler(s, off, n) { return this.lerLin(this.linear(s, off, n, false), n, this.cpl === 3); }
    escrever(s, off, n, v) { this.escLin(this.linear(s, off, n, true), n, v, this.cpl === 3); }

    // descritor na GDT ou LDT
    lerDescritor(sel, erroVetor) {
      const ti = sel & 4, idx = sel & 0xFFF8;
      const tab = ti ? this.ldtr : this.gdtr;
      if (ti && !this.ldtr.valido) throw new Excecao(erroVetor || 13, sel & 0xFFFC, 'o seletor ' + hex(sel, 4) + ' aponta para a LDT, mas nenhuma LDT foi carregada');
      if (idx + 7 > tab.limit) throw new Excecao(erroVetor || 13, sel & 0xFFFC, 'o seletor ' + hex(sel, 4) + ' passa do fim da ' + (ti ? 'LDT' : 'GDT') + ' (limite ' + hex(tab.limit, 4) + ')');
      const end = (tab.base + idx) >>> 0;
      const lo = this.lerLin(end, 4, false), hi = this.lerLin(end + 4, 4, false);
      return Object.assign(decodificarDescritor(lo, hi), { end });
    }
    marcarAcessado(d) {
      if (d.s && !(d.tipo & 1)) this.escLin(d.end + 5, 1, (d.acesso | 1) & 0xFF, false);
    }

    // carrega um registrador de segmento (MOV, POP, LDS...)
    carregarSeg(s, sel) {
      sel &= 0xFFFF;
      if (!this.pe || this.v86) {
        if (this.v86) this.defSeg(s, { sel, base: sel << 4, valido: true, limit: 0xFFFF, tipo: s === CS ? 0x1B : 0x13, dpl: 3, big: false, presente: true, s: true });
        else this.defSeg(s, { sel, base: sel << 4, valido: true });
        return;
      }
      const rpl = sel & 3;
      if ((sel & 0xFFFC) === 0) {
        if (s === SS) throw new Excecao(13, 0, 'SS não pode receber o seletor nulo');
        if (s === CS) throw new Excecao(13, 0, 'CS não pode receber o seletor nulo');
        this.defSeg(s, { sel, base: 0, limit: 0, valido: false, tipo: 0, dpl: 0, big: false });
        return;
      }
      const ds = this.lerDescritor(sel);
      if (s === SS) {
        if (!ds.s || (ds.tipo & 0x1A) !== 0x12) throw new Excecao(13, sel & 0xFFFC, 'SS precisa de um segmento de dados com escrita, e o seletor ' + hex(sel, 4) + ' é ' + nomeTipo(ds));
        if (rpl !== this.cpl || ds.dpl !== this.cpl) throw new Excecao(13, sel & 0xFFFC, 'a pilha precisa ter RPL e DPL iguais ao anel atual (CPL ' + this.cpl + '), mas o seletor ' + hex(sel, 4) + ' tem RPL ' + rpl + ' e DPL ' + ds.dpl);
        if (!ds.presente) throw new Excecao(12, sel & 0xFFFC, 'o segmento de pilha ' + hex(sel, 4) + ' não está presente (P=0)');
      } else {
        if (!ds.s || (ds.tipo & 0x1A) === 0x18) throw new Excecao(13, sel & 0xFFFC, NOMES_SEG[s] + ' precisa de um segmento de dados (ou de código com leitura), e o seletor ' + hex(sel, 4) + ' é ' + nomeTipo(ds));
        const conforme = (ds.tipo & 0x1C) === 0x1C;
        if (!conforme && Math.max(this.cpl, rpl) > ds.dpl) throw new Excecao(13, sel & 0xFFFC, 'privilégio insuficiente: o segmento ' + hex(sel, 4) + ' tem DPL ' + ds.dpl + ', mas o código roda no anel ' + this.cpl + ' com RPL ' + rpl);
        if (!ds.presente) throw new Excecao(11, sel & 0xFFFC, 'o segmento ' + hex(sel, 4) + ' não está presente (P=0)');
      }
      this.marcarAcessado(ds);
      this.defSeg(s, { sel, base: ds.base, limit: ds.limit, tipo: ds.tipo, dpl: ds.dpl, big: ds.big, presente: ds.presente, valido: true, s: true });
    }
    // CS a partir de um descritor já conferido
    carregarCS(sel, ds, cpl) {
      this.defSeg(CS, { sel: (sel & 0xFFFC) | cpl, base: ds.base, limit: ds.limit, tipo: ds.tipo, dpl: ds.dpl, big: ds.big, presente: true, valido: true, s: true });
      this.cpl = cpl;
      this.marcarAcessado(ds);
    }

    // ---------------- pilha ----------------
    get spMask() { return this.seg[SS].big ? 0xFFFFFFFF : 0xFFFF; }
    getSP() { return this.seg[SS].big ? this.r[4] : this.r[4] & 0xFFFF; }
    setSP(v) { if (this.seg[SS].big) this.r[4] = v >>> 0; else this.set16(4, v); }
    empilhar(n, v) {
      const sp = (this.getSP() - n) & this.spMask;
      this.escrever(SS, sp >>> 0, n, v);
      this.setSP(sp);
    }
    desempilhar(n) {
      const sp = this.getSP();
      const v = this.ler(SS, sp, n);
      this.setSP((sp + n) & this.spMask);
      return v;
    }

    // ---------------- execução ----------------
    executar(max, pontos) {
      let n = 0;
      while (n < max) {
        this.passo();
        n++;
        if (this.status !== 'executando') break;
        if (pontos && pontos.size && pontos.has(this.linearEIP())) { this.status = 'pausa'; break; }
      }
      return this.status;
    }
    linearEIP() { return (this.seg[CS].base + this.eip) >>> 0; }

    passo() {
      if (this.status === 'terminado' || this.status === 'erro' || this.status === 'excecao') return this.status;
      try {
        if (this.status === 'aguardando') {
          if (!this.kbd.buffer.length && !this.teclas.length && !this.kbd.fila.length) return this.status;
          this.status = 'executando';
        }
        this.status = 'executando';
        this.foto();
        this.digitarTeclas();
        // timer
        if (this.passos >= this.proxTick) {
          this.picM.irr |= 1;
          this.proxTick = this.passos + this.periodoTimer();
        }
        if (this.kbd.saida === null && this.kbd.fila.length) { this.kbd.saida = this.kbd.fila.shift(); this.picM.irr |= 2; }
        // interrupção externa
        if (this.flag(IF) && !this.inibirInt) {
          const v = this.aceitarIRQ();
          if (v >= 0) { this.hltEspera = false; this.interromper(v, { externa: true }); this.passos++; return this.status; }
        }
        this.inibirInt = false;
        if (this.hltEspera) {
          if (!this.flag(IF)) throw new Parada('terminado', 'A CPU parou com HLT e as interrupções desligadas (CLI): fim do programa.');
          const irq0 = !(this.picM.imr & 1), irq1 = !(this.picM.imr & 2);
          if (irq0) { this.passos = Math.max(this.passos + 1, this.proxTick); return this.status; }
          if (irq1 && (this.teclas.length || this.kbd.fila.length)) { this.passos++; return this.status; }
          if (irq1 && this.opts.esperarTeclado) { this.status = 'aguardando'; return this.status; }
          throw new Parada('terminado', 'A CPU parou com HLT e nenhuma interrupção vai acordá-la: fim do programa.');
        }
        // BIOS e ambiente
        const lin = this.linearEIP();
        if ((!this.pe || this.v86) && lin >= BIOS_STUB && lin < BIOS_STUB + 0x400 && (lin & 3) === 0) {
          this.passos++;
          return this.servicoBIOS((lin - BIOS_STUB) >> 2);
        }
        if (this.harness && this.pe && !this.v86 && lin >= AMBIENTE_EXC && lin < AMBIENTE_EXC + 0x100 * 8) {
          const vet = (lin - AMBIENTE_EXC) >> 3;
          throw new Parada('excecao', this.descreverNaoTratada(vet));
        }
        this.instrucao();
        this.passos++;
      } catch (e) {
        if (e instanceof Parada) { this.status = e.status; this.motivo = e.motivo; if (e.status !== 'aguardando') this.nota(e.status === 'terminado' ? 'fim' : 'erro', e.motivo); return this.status; }
        if (!(e instanceof Excecao)) throw e;
        this.passos++;
        this.restaurar();
        try { this.entregarExcecao(e); }
        catch (e2) { if (!(e2 instanceof Parada)) throw e2; this.status = e2.status; this.motivo = e2.motivo; this.nota('erro', e2.motivo); }
      }
      return this.status;
    }

    nota(tipo, texto) {
      this.eventos.push({ tipo, texto, passo: this.passos });
      if (this.eventos.length > 200) this.eventos.shift();
    }

    entregarExcecao(e) {
      const [sig, nome] = EXCECOES[e.vetor] || ['#' + e.vetor, 'exceção'];
      const temCodigo = [8, 10, 11, 12, 13, 14, 17].includes(e.vetor) && this.pe;
      const local = hex(this.seg[CS].sel, 4) + ':' + hex(this.eip, this.pe && this.seg[CS].big ? 8 : 4);
      this.nota('excecao', sig + (temCodigo ? '(' + hex(e.codigo, 4) + ')' : '') + ' ' + nome + ' em ' + local + (e.motivo ? ': ' + e.motivo : ''));
      this.ultimaExcecao = { vetor: e.vetor, codigo: e.codigo, motivo: e.motivo, local, cr2: this.cr2 };
      if (this.excecaoEmEntrega >= 2 || (this.excecaoEmEntrega === 1 && e.vetor === 8)) {
        this.excecaoEmEntrega = 0;
        this.status = 'erro';
        this.motivo = 'Falha tripla: uma exceção aconteceu enquanto o processador tentava entregar a falha dupla. Num PC de verdade, a máquina reinicia. ' + this.dicaFalhaTripla(e);
        this.nota('erro', this.motivo);
        return;
      }
      const nivel = this.excecaoEmEntrega;
      this.excecaoEmEntrega++;
      this.restaurar();
      try {
        if (nivel === 1) this.interromper(8, { excecao: true, codigo: 0 });
        else this.interromper(e.vetor, { excecao: true, codigo: temCodigo ? e.codigo : undefined });
        this.excecaoEmEntrega = 0;
      } catch (e2) {
        if (!(e2 instanceof Excecao)) { this.excecaoEmEntrega = 0; throw e2; }
        this.entregarExcecao(nivel === 0 ? new Excecao(8, 0, 'ao entregar ' + sig + ': ' + (e2.motivo || '')) : e2);
      }
    }
    dicaFalhaTripla() {
      if (!this.pe) return '';
      if (this.idtr.limit < 8 * 14) return 'A IDT tem limite ' + hex(this.idtr.limit, 4) + ': ela não tem entradas para as exceções. Carregou a IDT com LIDT?';
      return 'Confira a IDT (entradas presentes, seletor de código certo) e a pilha do anel 0.';
    }
    descreverNaoTratada(vet) {
      const ex = this.ultimaExcecao;
      const [sig, nome, causa] = EXCECOES[vet] || ['#' + vet, 'interrupção ' + vet, ''];
      if (ex && ex.vetor === vet) return 'Exceção ' + sig + ' (' + nome + ') em ' + ex.local + (ex.motivo ? ': ' + ex.motivo : causa ? ': ' + causa : '') + '. O programa não instalou uma rotina para ela.';
      return 'Interrupção ' + vet + ' sem rotina instalada pelo programa.';
    }

    aceitarIRQ() {
      let irq = this.picM.pendente();
      if (irq < 0) return -1;
      if (irq === 2) {
        const e = this.picE.pendente();
        if (e < 0) return -1;
        this.picE.irr &= ~(1 << e); if (!this.picE.autoEoi) this.picE.isr |= 1 << e;
        this.picM.irr &= ~4; if (!this.picM.autoEoi) this.picM.isr |= 4;
        return this.picE.base + e;
      }
      this.picM.irr &= ~(1 << irq);
      if (!this.picM.autoEoi) this.picM.isr |= 1 << irq;
      if (irq === 1) { /* o dado fica na porta 60h até ser lido */ }
      return this.picM.base + irq;
    }

    // ---------------- interrupções e exceções ----------------
    interromper(vet, o) {
      o = o || {};
      if (!this.pe) {
        if ((vet * 4 + 3) > this.idtr.limit) throw new Excecao(13, 0, 'vetor ' + vet + ' passa do limite da tabela de interrupções');
        this.empilhar(2, this.flags & 0xFFFF);
        this.empilhar(2, this.seg[CS].sel);
        this.empilhar(2, this.eip & 0xFFFF);
        const end = this.idtr.base + vet * 4;
        const ip = this.lerLin(end, 2, false), cs = this.lerLin(end + 2, 2, false);
        // exceção no modo real sem rotina do programa: a da BIOS só faria IRET e a instrução
        // se repetiria para sempre (e os vetores 8 a 0Fh são das IRQs), então a máquina para e explica
        if (o.excecao && this.idtr.base === 0 && cs === 0xF000 && ip === ((0xE000 + vet * 4) & 0xFFFF)) {
          this.setSP((this.getSP() + 6) & 0xFFFF);
          throw new Parada('excecao', this.descreverNaoTratada(vet) + ' No modo real, o vetor ' + hex(vet, 2) + 'h ainda aponta para a BIOS' + (vet >= 8 && vet <= 15 ? ', que o usa para a IRQ ' + (vet - 8) : '') + ': num PC de verdade, a instrução se repetiria para sempre.');
        }
        this.carregarSeg(CS, cs);
        this.eip = ip;
        this.flags &= ~(IF | TF);
        return;
      }
      if (this.harness && this.harness.idtNativa && (vet * 8 + 7) > this.idtr.limit) {
        throw new Parada('excecao', this.descreverNaoTratada(vet));
      }
      // modo protegido (e v86)
      const erroIdt = vet * 8 + 2 + (o.externa ? 1 : 0);
      if (o.software && this.v86 && ((this.flags >> 12) & 3) < 3) throw new Excecao(13, 0, 'INT ' + vet + ' no modo v86 com IOPL ' + ((this.flags >> 12) & 3) + ': o monitor do kernel precisa emular a interrupção');
      if (vet * 8 + 7 > this.idtr.limit) throw new Excecao(13, erroIdt, 'o vetor ' + vet + ' passa do limite da IDT (' + hex(this.idtr.limit, 4) + ')');
      const end = (this.idtr.base + vet * 8) >>> 0;
      const lo = this.lerLin(end, 4, false), hi = this.lerLin(end + 4, 4, false);
      const tipo = (hi >>> 8) & 0x1F, dpl = (hi >>> 13) & 3, presente = !!(hi & 0x8000);
      const tiposValidos = [0x05, 0x06, 0x07, 0x0E, 0x0F];
      if (!tiposValidos.includes(tipo)) throw new Excecao(13, erroIdt, 'a entrada ' + vet + ' da IDT não é uma porta de interrupção, de exceção ou de tarefa (tipo ' + tipo.toString(16) + 'h)');
      if (o.software && dpl < this.cpl) throw new Excecao(13, erroIdt, 'INT ' + vet + ' no anel ' + this.cpl + ', mas a porta na IDT tem DPL ' + dpl + ' (só código com privilégio igual ou maior pode chamá-la)');
      if (!presente) throw new Excecao(11, erroIdt, 'a entrada ' + vet + ' da IDT não está presente (P=0)');
      if (tipo === 0x05) {
        this.trocarTarefa((lo >>> 16) & 0xFFFF, 'int', o.codigo);
        return;
      }
      const g32 = (tipo & 8) !== 0, armadilha = (tipo & 1) !== 0;
      const sel = (lo >>> 16) & 0xFFFF;
      const off = g32 ? ((lo & 0xFFFF) | (hi & 0xFFFF0000)) >>> 0 : lo & 0xFFFF;
      if ((sel & 0xFFFC) === 0) throw new Excecao(13, (o.externa ? 1 : 0), 'a entrada ' + vet + ' da IDT tem seletor de código nulo');
      const dc = this.lerDescritor(sel);
      if (!dc.s || !(dc.tipo & 8)) throw new Excecao(13, sel & 0xFFFC, 'o seletor ' + hex(sel, 4) + ' da entrada ' + vet + ' da IDT não é de código');
      if (dc.dpl > this.cpl) throw new Excecao(13, sel & 0xFFFC, 'a rotina da interrupção ' + vet + ' tem DPL ' + dc.dpl + ', menos privilegiada que o código interrompido (anel ' + this.cpl + ')');
      if (!dc.presente) throw new Excecao(11, sel & 0xFFFC, 'o segmento de código da rotina ' + vet + ' não está presente');
      const conforme = (dc.tipo & 4) !== 0;
      const vindoV86 = this.v86;
      const flagsAntes = this.flags;
      const tam = g32 ? 4 : 2;
      if (!conforme && dc.dpl < this.cpl) {
        // troca de anel: pilha nova vem do TSS
        const novoCpl = dc.dpl;
        const { ss: nss, esp: nesp } = this.pilhaDoTSS(novoCpl);
        const velhoSS = this.seg[SS].sel, velhoESP = this.r[4];
        const segsV86 = vindoV86 ? [ES, DS, FS, GS].map(s => this.seg[s].sel) : null;
        if (vindoV86 && novoCpl !== 0) throw new Excecao(13, sel & 0xFFFC, 'do modo v86 a interrupção precisa ir para o anel 0');
        const dss = this.lerDescritor(nss, 10);
        if ((nss & 3) !== novoCpl || dss.dpl !== novoCpl || !dss.s || (dss.tipo & 0x1A) !== 0x12) throw new Excecao(10, nss & 0xFFFC, 'a pilha do anel ' + novoCpl + ' no TSS (SS' + novoCpl + ' = ' + hex(nss, 4) + ') não é um segmento de dados com escrita de DPL ' + novoCpl);
        if (!dss.presente) throw new Excecao(12, nss & 0xFFFC, 'a pilha do anel ' + novoCpl + ' não está presente');
        this.flags &= ~VM;
        this.cpl = novoCpl;
        this.defSeg(SS, { sel: nss, base: dss.base, limit: dss.limit, tipo: dss.tipo, dpl: dss.dpl, big: dss.big, presente: true, valido: true, s: true });
        this.r[4] = nesp;
        if (vindoV86) {
          for (const s of [GS, FS, DS, ES]) this.empilhar(tam, segsV86[[ES, DS, FS, GS].indexOf(s)]);
          for (const s of [ES, DS, FS, GS]) this.defSeg(s, { sel: 0, base: 0, limit: 0, valido: false, tipo: 0, dpl: 0, big: false });
        }
        this.empilhar(tam, velhoSS);
        this.empilhar(tam, velhoESP);
      } else {
        if (vindoV86) throw new Excecao(13, sel & 0xFFFC, 'do modo v86 a interrupção precisa ir para o anel 0, com um segmento não conforme');
      }
      this.empilhar(tam, g32 ? flagsAntes : flagsAntes & 0xFFFF);
      this.empilhar(tam, this.seg[CS].sel);
      this.empilhar(tam, this.eip);
      if (o.codigo !== undefined) this.empilhar(tam, o.codigo);
      this.carregarCS(sel, dc, conforme ? this.cpl : dc.dpl);
      this.eip = off;
      this.flags &= ~(TF | NT | RF | VM);
      if (!armadilha) this.flags &= ~IF;
    }

    pilhaDoTSS(anel) {
      if (!this.tr.valido) throw new Excecao(10, 0, 'a troca de anel precisa da pilha do anel ' + anel + ' no TSS, mas nenhum TSS foi carregado (LTR)');
      if (this.tr.tipo === 0x9 || this.tr.tipo === 0xB) {
        const off = 4 + anel * 8;
        if (off + 5 > this.tr.limit) throw new Excecao(10, this.tr.sel & 0xFFFC, 'o TSS é pequeno demais para guardar a pilha do anel ' + anel);
        return { esp: this.lerLin(this.tr.base + off, 4, false), ss: this.lerLin(this.tr.base + off + 4, 2, false) };
      }
      const off = 2 + anel * 4;
      return { esp: this.lerLin(this.tr.base + off, 2, false), ss: this.lerLin(this.tr.base + off + 2, 2, false) };
    }

    // ---------------- troca de tarefas por hardware ----------------
    trocarTarefa(sel, motivo, codigoErro) {
      const d = this.lerDescritor(sel, 10);
      let tss = d, tssSel = sel;
      if (d.s || ![0x1, 0x3, 0x9, 0xB].includes(d.tipo)) {
        throw new Excecao(13, sel & 0xFFFC, 'o seletor ' + hex(sel, 4) + ' não é um TSS (é ' + nomeTipo(d) + ')');
      }
      if (!(d.tipo & 8)) throw new Excecao(13, sel & 0xFFFC, 'TSS de 16 bits (do 286): este simulador só troca tarefas com TSS de 32 bits');
      const ocupado = (d.tipo & 2) !== 0;
      if (motivo === 'iret' ? !ocupado : ocupado) throw new Excecao(13, sel & 0xFFFC, motivo === 'iret' ? 'IRET voltaria para uma tarefa que não está ocupada' : 'a tarefa ' + hex(sel, 4) + ' já está ocupada (busy): uma tarefa não pode chamar a si mesma nem ser reentrada');
      if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'o TSS ' + hex(sel, 4) + ' não está presente');
      if (d.limit < 0x67) throw new Excecao(10, sel & 0xFFFC, 'o TSS ' + hex(sel, 4) + ' tem limite ' + hex(d.limit, 4) + ', menor que os 104 bytes (67h) de um TSS de 32 bits');
      if (!this.tr.valido) throw new Excecao(10, 0, 'troca de tarefa sem um TSS atual: carregue o primeiro com LTR');
      // salva o estado atual no TSS atual
      const b = this.tr.base;
      const w32 = (o, v) => this.escLin(b + o, 4, v, false);
      const w16 = (o, v) => this.escLin(b + o, 2, v, false);
      let flagsSalvos = this.flags;
      if (motivo === 'iret') flagsSalvos &= ~NT;
      w32(0x20, this.eip); w32(0x24, flagsSalvos);
      for (let i = 0; i < 8; i++) w32(0x28 + i * 4, this.r[i]);
      for (let i = 0; i < 6; i++) w16(0x48 + i * 4, this.seg[i].sel);
      // busy do atual
      if (motivo === 'jmp' || motivo === 'iret') this.marcarBusy(this.tr.sel, false);
      // carrega o novo
      const nb = tss.base;
      const r32 = (o) => this.lerLin(nb + o, 4, false), r16 = (o) => this.lerLin(nb + o, 2, false);
      if (motivo === 'call' || motivo === 'int') this.escLin(nb, 2, this.tr.sel, false);   // elo de volta
      if (motivo !== 'iret') this.marcarBusy(tssSel, true);
      const velhoTR = this.tr.sel;
      this.tr = { sel: tssSel, base: tss.base, limit: tss.limit, tipo: tss.tipo | 2, valido: true };
      if (motivo === 'iret') this.tr.tipo = tss.tipo;
      const ncr3 = r32(0x1C), neip = r32(0x20);
      let nflags = r32(0x24);
      const regs = []; for (let i = 0; i < 8; i++) regs.push(r32(0x28 + i * 4));
      const segs = []; for (let i = 0; i < 6; i++) segs.push(r16(0x48 + i * 4));
      const nldt = r16(0x60);
      if (this.pg) { this.cr3 = ncr3; this.limparTLB(); }
      if (motivo === 'call' || motivo === 'int') nflags |= NT;
      this.flags = (nflags & FLAGS_386) | 2;
      this.eip = neip;
      this.r.set(regs);
      this.cr0 |= 8;   // TS
      // LDT
      if ((nldt & 0xFFFC) === 0) this.ldtr = { sel: nldt, base: 0, limit: 0, valido: false };
      else {
        const dl = this.lerDescritor(nldt & ~4, 10);
        if (dl.s || dl.tipo !== 2) throw new Excecao(10, nldt & 0xFFFC, 'o campo LDT do TSS (' + hex(nldt, 4) + ') não aponta para um descritor de LDT');
        this.ldtr = { sel: nldt, base: dl.base, limit: dl.limit, valido: true };
      }
      // segmentos
      if (this.flags & VM) {
        this.cpl = 3;
        for (let i = 0; i < 6; i++) this.defSeg(i, { sel: segs[i], base: segs[i] << 4, limit: 0xFFFF, tipo: i === CS ? 0x1B : 0x13, dpl: 3, big: false, presente: true, valido: true, s: true });
      } else {
        const csSel = segs[CS];
        const dc = this.lerDescritor(csSel, 10);
        if (!dc.s || !(dc.tipo & 8)) throw new Excecao(10, csSel & 0xFFFC, 'o CS salvo no TSS novo (' + hex(csSel, 4) + ') não é de código');
        this.carregarCS(csSel, dc, csSel & 3);
        for (const s of [SS, DS, ES, FS, GS]) this.carregarSeg(s, segs[s]);
      }
      if (codigoErro !== undefined) this.empilhar(this.seg[CS].big ? 4 : 2, codigoErro);
      this.nota('tarefa', 'troca de tarefa (' + motivo + '): TSS ' + hex(velhoTR, 4) + ' → ' + hex(tssSel, 4));
    }
    marcarBusy(sel, ocupado) {
      const end = (this.gdtr.base + (sel & 0xFFF8) + 5) >>> 0;
      const ac = this.lerLin(end, 1, false);
      this.escLin(end, 1, ocupado ? ac | 2 : ac & ~2, false);
    }

    // ---------------- busca de bytes da instrução ----------------
    f8() {
      const cs = this.seg[CS];
      if (this.ip > cs.limit) throw new Excecao(13, 0, 'EIP ' + hex(this.ip) + ' passou do limite ' + hex(cs.limit) + ' do segmento de código');
      const lin = (cs.base + this.ip) >>> 0;
      this.ip = (this.ip + 1) >>> 0;
      if (!this.osCodigo32) this.ip &= 0xFFFF;
      return this.lerLin(lin, 1, this.cpl === 3);
    }
    f16() { const a = this.f8(); return a | (this.f8() << 8); }
    f32() { const a = this.f16(); return (a | (this.f16() << 16)) >>> 0; }
    fimm(s) { return s === 1 ? this.f8() : s === 2 ? this.f16() : this.f32(); }

    // ---------------- ModRM ----------------
    modrm() {
      const b = this.f8();
      const mod = b >> 6, reg = (b >> 3) & 7, rm = b & 7;
      const m = { mod, reg, rm, ehReg: mod === 3, seg: DS, off: 0 };
      if (mod === 3) return m;
      if (this.asize === 2) {
        let off = 0;
        switch (rm) {
          case 0: off = this.get16(3) + this.get16(6); break;
          case 1: off = this.get16(3) + this.get16(7); break;
          case 2: off = this.get16(5) + this.get16(6); m.seg = SS; break;
          case 3: off = this.get16(5) + this.get16(7); m.seg = SS; break;
          case 4: off = this.get16(6); break;
          case 5: off = this.get16(7); break;
          case 6: if (mod === 0) off = this.f16(); else { off = this.get16(5); m.seg = SS; } break;
          case 7: off = this.get16(3); break;
        }
        if (mod === 1) off += sx8(this.f8());
        else if (mod === 2) off += this.f16();
        m.off = off & 0xFFFF;
      } else {
        let off = 0;
        if (rm === 4) {
          const sib = this.f8();
          const esc = sib >> 6, idx = (sib >> 3) & 7, base = sib & 7;
          if (base === 5 && mod === 0) off = this.f32();
          else { off = this.r[base]; if (base === 4 || base === 5) m.seg = SS; }
          if (idx !== 4) off += this.r[idx] * (1 << esc);
        } else if (rm === 5 && mod === 0) off = this.f32();
        else { off = this.r[rm]; if (rm === 5) m.seg = SS; }
        if (mod === 1) off += sx8(this.f8());
        else if (mod === 2) off += this.f32() | 0;
        m.off = off >>> 0;
      }
      if (this.segOver !== null) m.seg = this.segOver;
      return m;
    }
    lerRM(m, s) { return m.ehReg ? this.getR(s, m.rm) : this.ler(m.seg, m.off, s); }
    escRM(m, s, v) { if (m.ehReg) this.setR(s, m.rm, v); else this.escrever(m.seg, m.off, s, v); }

    // ---------------- flags ----------------
    flagsLogica(r, s) {
      r = (r & MASK[s]) >>> 0;
      let f = this.flags & ~(CF | PF | AF | ZF | SF | OF);
      if (r === 0) f |= ZF;
      if (r & SINAL[s]) f |= SF;
      if (paridade[r & 0xFF]) f |= PF;
      this.flags = f;
      return r >>> 0;
    }
    alu(op, a, b, s) {
      const mask = MASK[s], sb = SINAL[s];
      let r, f = this.flags & ~(CF | PF | AF | ZF | SF | OF);
      const c = this.flags & CF ? 1 : 0;
      switch (op) {
        case 0: case 2: {   // ADD, ADC
          const cin = op === 2 ? c : 0;
          const t = a + b + cin;
          r = t % (mask + 1);
          if (t > mask) f |= CF;
          if (((a ^ r) & (b ^ r) & sb) !== 0) f |= OF;
          if ((a ^ b ^ r) & 0x10) f |= AF;
          break;
        }
        case 3: case 5: case 7: {   // SBB, SUB, CMP
          const cin = op === 3 ? c : 0;
          const t = a - b - cin;
          r = t < 0 ? t + mask + 1 : t;
          if (t < 0) f |= CF;
          if (((a ^ b) & (a ^ r) & sb) !== 0) f |= OF;
          if ((a ^ b ^ r) & 0x10) f |= AF;
          break;
        }
        case 1: r = (a | b) >>> 0; break;
        case 4: r = (a & b) >>> 0; break;
        case 6: r = (a ^ b) >>> 0; break;
      }
      r = r >>> 0;
      if (s < 4) r &= mask;
      if (r === 0) f |= ZF;
      if (r & sb) f |= SF;
      if (paridade[r & 0xFF]) f |= PF;
      this.flags = f;
      return r;
    }
    incdec(v, s, dec) {
      const cf = this.flags & CF;
      const r = this.alu(dec ? 5 : 0, v, 1, s);
      this.flags = (this.flags & ~CF) | cf;
      return r;
    }
    deslocar(op, v, cnt, s) {
      cnt &= 0x1F;
      if (!cnt) return v;
      const bits = s * 8, mask = MASK[s], sb = SINAL[s];
      let r = v >>> 0, cf = this.flags & CF ? 1 : 0, of = 0;
      switch (op) {
        case 0: { const n = cnt % bits; r = n ? ((v << n) | (v >>> (bits - n))) & mask : v; cf = r & 1; of = ((r & sb) ? 1 : 0) ^ cf; break; }   // ROL
        case 1: { const n = cnt % bits; r = n ? ((v >>> n) | (v << (bits - n))) & mask : v; cf = (r & sb) ? 1 : 0; of = ((r >>> (bits - 1)) ^ (r >>> (bits - 2))) & 1; break; }   // ROR
        case 2: { for (let i = 0; i < cnt; i++) { const out = (r & sb) ? 1 : 0; r = ((r * 2) + cf) % (mask + 1); cf = out; } of = ((r & sb) ? 1 : 0) ^ cf; break; }   // RCL
        case 3: { of = ((r & sb) ? 1 : 0) ^ cf; for (let i = 0; i < cnt; i++) { const out = r & 1; r = (r >>> 1) | (cf ? sb : 0); cf = out; } break; }   // RCR
        case 4: case 6: {   // SHL
          if (s === 4) { r = (v << cnt) >>> 0; cf = (v >>> (32 - cnt)) & 1; }
          else { cf = cnt <= bits ? (Math.floor(v / Math.pow(2, bits - cnt)) & 1) : 0; r = cnt < bits ? (v * Math.pow(2, cnt)) % (mask + 1) : 0; }
          of = ((r & sb) ? 1 : 0) ^ cf; break;
        }
        case 5: { cf = (v >>> (cnt - 1)) & 1; r = cnt < 32 ? v >>> cnt : 0; of = (v & sb) ? 1 : 0; break; }   // SHR
        case 7: { const sv = sx(v, s); cf = (sv >> (cnt - 1)) & 1; r = (sv >> Math.min(cnt, 31)) & mask; of = 0; break; }   // SAR
      }
      r = (r & mask) >>> 0;
      if (op >= 4) {
        let f = this.flags & ~(CF | PF | ZF | SF | OF | AF);
        if (r === 0) f |= ZF;
        if (r & sb) f |= SF;
        if (paridade[r & 0xFF]) f |= PF;
        this.flags = f;
      }
      this.setFlag(CF, !!cf);
      this.setFlag(OF, !!of);
      return r;
    }
    condicao(cc) {
      const f = this.flags;
      let v;
      switch (cc >> 1) {
        case 0: v = f & OF; break;
        case 1: v = f & CF; break;
        case 2: v = f & ZF; break;
        case 3: v = (f & CF) || (f & ZF); break;
        case 4: v = f & SF; break;
        case 5: v = f & PF; break;
        case 6: v = !!(f & SF) !== !!(f & OF); break;
        case 7: v = (f & ZF) || (!!(f & SF) !== !!(f & OF)); break;
      }
      return (cc & 1) ? !v : !!v;
    }

    // ---------------- privilégio ----------------
    exigirAnel0(nome) {
      if (this.v86) throw new Excecao(13, 0, nome + ' é privilegiada e não roda no modo v86');
      if (this.pe && this.cpl !== 0) throw new Excecao(13, 0, nome + ' é privilegiada: só roda no anel 0, e o código está no anel ' + this.cpl);
    }
    iopl() { return (this.flags >> 12) & 3; }
    exigirIOPL(nome) {
      if (this.v86 && this.iopl() < 3) throw new Excecao(13, 0, nome + ' no modo v86 com IOPL ' + this.iopl() + ': o monitor precisa emular');
      if (this.pe && !this.v86 && this.cpl > this.iopl()) throw new Excecao(13, 0, nome + ' no anel ' + this.cpl + ' exige IOPL >= ' + this.cpl + ' (IOPL atual: ' + this.iopl() + ')');
    }
    conferirPorta(porta, n) {
      if (!this.pe) return;
      if (!this.v86 && this.cpl <= this.iopl()) return;
      // mapa de bits de E/S do TSS
      const nega = () => { throw new Excecao(13, 0, 'a porta ' + hex(porta, 4) + ' não está liberada para o anel ' + this.cpl + (this.v86 ? ' (modo v86)' : '') + ': IOPL ' + this.iopl() + ' e o mapa de E/S do TSS não libera'); };
      if (!this.tr.valido || !(this.tr.tipo & 8) || this.tr.limit < 0x67) nega();
      const baseMapa = this.lerLin(this.tr.base + 0x66, 2, false);
      for (let p = porta; p < porta + n; p++) {
        const off = baseMapa + (p >> 3);
        if (off > this.tr.limit) nega();
        if (this.lerLin(this.tr.base + off, 1, false) & (1 << (p & 7))) nega();
      }
    }
    // POPF/IRET: o que cada anel pode mudar nos flags
    aplicarFlags(v, s) {
      let mascara = s === 2 ? FLAGS_386 & 0xFFFF : FLAGS_386;   // os bits reservados (1, 3, 5, 15) não mudam
      mascara &= ~(VM | RF);
      if (this.pe || this.v86) {
        if (this.cpl > 0 || this.v86) mascara &= ~IOPL;
        if (this.cpl > this.iopl() && !this.v86) mascara &= ~IF;
      }
      this.flags = ((this.flags & ~mascara) | (v & mascara) | 2) >>> 0;
    }

    // ---------------- a instrução ----------------
    instrucao() {
      const padrao32 = this.pe && !this.v86 && this.seg[CS].big;
      this.osCodigo32 = padrao32;
      this.ip = this.eip;
      this.segOver = null;
      let rep = 0, os = padrao32 ? 4 : 2, as = padrao32 ? 4 : 2;
      let op;
      for (let n = 0; ; n++) {
        if (n > 14) throw new Excecao(13, 0, 'instrução com mais de 15 bytes de prefixo');
        op = this.f8();
        if (op === 0x66) { os = padrao32 ? 2 : 4; continue; }
        if (op === 0x67) { as = padrao32 ? 2 : 4; continue; }
        if (op === 0xF3 || op === 0xF2) { rep = op; continue; }
        if (op === 0xF0) continue;
        if (op === 0x26 || op === 0x2E || op === 0x36 || op === 0x3E) { this.segOver = (op >> 3) & 3; continue; }
        if (op === 0x64) { this.segOver = FS; continue; }
        if (op === 0x65) { this.segOver = GS; continue; }
        break;
      }
      this.os = os; this.asize = as; this.rep = rep;
      const tf = this.flag(TF);
      this.executarOpcode(op, os, as, rep);
      this.eip = this.ip >>> 0;
      if (!(this.pe && !this.v86 && this.seg[CS].big)) this.eip &= 0xFFFF;
      if (tf && this.flag(TF)) this.interromper(1, { excecao: true });
    }

    saltar(alvo, os) { this.ip = os === 2 ? alvo & 0xFFFF : alvo >>> 0; }

    executarOpcode(op, os, as, rep) {
      const s8 = 1;
      // ALU 00-3F
      if (op < 0x40 && (op & 7) < 6) {
        const k = op >> 3, forma = op & 7;
        if (forma < 4) {
          const s = forma & 1 ? os : 1;
          const m = this.modrm();
          if (forma < 2) {
            const a = this.lerRM(m, s), b = this.getR(s, m.reg);
            const r = this.alu(k, a, b, s);
            if (k !== 7) this.escRM(m, s, r);
          } else {
            const a = this.getR(s, m.reg), b = this.lerRM(m, s);
            const r = this.alu(k, a, b, s);
            if (k !== 7) this.setR(s, m.reg, r);
          }
        } else {
          const s = forma === 4 ? 1 : os;
          const b = this.fimm(s);
          const r = this.alu(k, this.getR(s, 0), b, s);
          if (k !== 7) this.setR(s, 0, r);
        }
        return;
      }
      switch (op) {
        case 0x06: case 0x0E: case 0x16: case 0x1E: this.empilhar(os, this.seg[op >> 3].sel); return;
        case 0x07: case 0x17: case 0x1F: {
          const s = op >> 3;
          const sp = this.getSP();
          const v = this.ler(SS, sp, os) & 0xFFFF;
          this.carregarSeg(s, v);
          this.setSP((sp + os) & this.spMask);
          if (s === SS) this.inibirInt = true;
          return;
        }
        case 0x0F: return this.opcode0F(os, as, rep);
        case 0x27: case 0x2F: case 0x37: case 0x3F: return this.bcd(op);
        case 0xD4: { const b = this.f8(); if (!b) throw new Excecao(0, 0, 'AAM com base 0'); const al = this.get8(0); this.set8(4, Math.floor(al / b)); this.set8(0, al % b); this.flagsLogica(this.get8(0), 1); return; }
        case 0xD5: { const b = this.f8(); const v = (this.get8(0) + this.get8(4) * b) & 0xFF; this.set16(0, v); this.flagsLogica(v, 1); return; }
      }
      if (op >= 0x40 && op <= 0x4F) { const i = op & 7; this.setR(os, i, this.incdec(this.getR(os, i), os, op >= 0x48)); return; }
      if (op >= 0x50 && op <= 0x57) { const i = op & 7; const v = i === 4 ? this.getR(os, 4) : this.getR(os, i); this.empilhar(os, v); return; }
      if (op >= 0x58 && op <= 0x5F) { const v = this.desempilhar(os); this.setR(os, op & 7, v); return; }
      if (op >= 0x70 && op <= 0x7F) { const d = sx8(this.f8()); if (this.condicao(op & 15)) this.saltar(this.ip + d, os); return; }
      if (op >= 0x91 && op <= 0x97) { const i = op & 7; const a = this.getR(os, 0); this.setR(os, 0, this.getR(os, i)); this.setR(os, i, a); return; }
      if (op >= 0xB0 && op <= 0xB7) { this.set8(op & 7, this.f8()); return; }
      if (op >= 0xB8 && op <= 0xBF) { this.setR(os, op & 7, this.fimm(os)); return; }
      if (op >= 0xD8 && op <= 0xDF) { this.modrm(); throw new Excecao(7, 0, 'instrução de ponto flutuante, e esta máquina não tem o coprocessador 387'); }
      switch (op) {
        case 0x60: {   // PUSHA
          const sp = this.getR(os, 4);
          for (const i of [0, 1, 2, 3]) this.empilhar(os, this.getR(os, i));
          this.empilhar(os, sp);
          for (const i of [5, 6, 7]) this.empilhar(os, this.getR(os, i));
          return;
        }
        case 0x61: {   // POPA
          for (const i of [7, 6, 5]) this.setR(os, i, this.desempilhar(os));
          this.desempilhar(os);
          for (const i of [3, 2, 1, 0]) this.setR(os, i, this.desempilhar(os));
          return;
        }
        case 0x62: {   // BOUND
          const m = this.modrm();
          if (m.ehReg) throw new Excecao(6, 0, 'BOUND precisa de um operando na memória');
          const v = sx(this.getR(os, m.reg), os);
          const lo = sx(this.ler(m.seg, m.off, os), os), hi = sx(this.ler(m.seg, (m.off + os) >>> 0, os), os);
          if (v < lo || v > hi) throw new Excecao(5, 0, 'índice ' + v + ' fora da faixa ' + lo + '..' + hi);
          return;
        }
        case 0x63: {   // ARPL
          if (!this.pe || this.v86) throw new Excecao(6, 0, 'ARPL só existe no modo protegido');
          const m = this.modrm();
          const d = this.lerRM(m, 2), src = this.get16(m.reg);
          if ((d & 3) < (src & 3)) { this.escRM(m, 2, (d & ~3) | (src & 3)); this.setFlag(ZF, true); } else this.setFlag(ZF, false);
          return;
        }
        case 0x68: this.empilhar(os, this.fimm(os)); return;
        case 0x6A: this.empilhar(os, (sx8(this.f8()) & MASK[os]) >>> 0); return;
        case 0x69: case 0x6B: {
          const m = this.modrm();
          const a = sx(this.lerRM(m, os), os);
          const b = op === 0x6B ? sx8(this.f8()) : sx(this.fimm(os), os);
          this.setR(os, m.reg, this.imulFlags(a, b, os));
          return;
        }
        case 0x6C: case 0x6D: case 0x6E: case 0x6F: return this.stringES(op, os, as, rep);
        case 0x80: case 0x81: case 0x82: case 0x83: {
          const s = op === 0x81 || op === 0x83 ? os : 1;
          const m = this.modrm();
          const b = op === 0x81 ? this.fimm(os) : op === 0x83 ? (sx8(this.f8()) & MASK[os]) >>> 0 : this.f8();
          const r = this.alu(m.reg, this.lerRM(m, s), b, s);
          if (m.reg !== 7) this.escRM(m, s, r);
          return;
        }
        case 0x84: case 0x85: { const s = op === 0x84 ? 1 : os; const m = this.modrm(); this.alu(4, this.lerRM(m, s), this.getR(s, m.reg), s); return; }
        case 0x86: case 0x87: { const s = op === 0x86 ? 1 : os; const m = this.modrm(); const a = this.lerRM(m, s); this.escRM(m, s, this.getR(s, m.reg)); this.setR(s, m.reg, a); return; }
        case 0x88: case 0x89: { const s = op === 0x88 ? 1 : os; const m = this.modrm(); this.escRM(m, s, this.getR(s, m.reg)); return; }
        case 0x8A: case 0x8B: { const s = op === 0x8A ? 1 : os; const m = this.modrm(); this.setR(s, m.reg, this.lerRM(m, s)); return; }
        case 0x8C: {
          const m = this.modrm();
          if (m.reg > 5) throw new Excecao(6, 0, 'registrador de segmento inexistente');
          const v = this.seg[m.reg].sel;
          if (m.ehReg) this.setR(os, m.rm, v); else this.escrever(m.seg, m.off, 2, v);
          return;
        }
        case 0x8D: { const m = this.modrm(); if (m.ehReg) throw new Excecao(6, 0, 'LEA precisa de um endereço de memória'); this.setR(os, m.reg, m.off); return; }
        case 0x8E: {
          const m = this.modrm();
          if (m.reg === CS || m.reg > 5) throw new Excecao(6, 0, 'MOV para CS não existe');
          this.carregarSeg(m.reg, this.lerRM(m, 2));
          if (m.reg === SS) this.inibirInt = true;
          return;
        }
        case 0x8F: { const m = this.modrm(); const v = this.desempilhar(os); this.escRM(m, os, v); return; }
        case 0x90: return;
        case 0x98: if (os === 2) this.set16(0, sx8(this.get8(0))); else this.r[0] = sx16(this.r[0] & 0xFFFF) >>> 0; return;
        case 0x99: if (os === 2) this.set16(2, (this.r[0] & 0x8000) ? 0xFFFF : 0); else this.r[2] = (this.r[0] & 0x80000000) ? 0xFFFFFFFF : 0; return;
        case 0x9A: { const off = this.fimm(os), sel = this.f16(); return this.chamarFar(sel, off, os, true); }
        case 0x9B: return;
        case 0x9C: {   // PUSHF
          this.exigirIOPLv86('PUSHF');
          this.empilhar(os, os === 2 ? this.flags & 0xFFFF : this.flags & ~(VM | RF));
          return;
        }
        case 0x9D: {   // POPF
          this.exigirIOPLv86('POPF');
          const v = this.desempilhar(os);
          this.aplicarFlags(v, os);
          return;
        }
        case 0x9E: this.flags = (this.flags & ~0xD5) | (this.get8(4) & 0xD5) | 2; return;
        case 0x9F: this.set8(4, this.flags & 0xFF); return;
        case 0xA0: case 0xA1: case 0xA2: case 0xA3: {
          const s = op & 1 ? os : 1;
          const off = as === 4 ? this.f32() : this.f16();
          const sg = this.segOver !== null ? this.segOver : DS;
          if (op < 0xA2) this.setR(s, 0, this.ler(sg, off, s)); else this.escrever(sg, off, s, this.getR(s, 0));
          return;
        }
        case 0xA4: case 0xA5: case 0xA6: case 0xA7: case 0xAA: case 0xAB: case 0xAC: case 0xAD: case 0xAE: case 0xAF:
          return this.string(op, os, as, rep);
        case 0xA8: this.alu(4, this.get8(0), this.f8(), 1); return;
        case 0xA9: this.alu(4, this.getR(os, 0), this.fimm(os), os); return;
        case 0xC0: case 0xC1: case 0xD0: case 0xD1: case 0xD2: case 0xD3: {
          const s = op & 1 ? os : 1;
          const m = this.modrm();
          const cnt = op <= 0xC1 ? this.f8() : op <= 0xD1 ? 1 : this.get8(1);
          const v = this.lerRM(m, s);
          if ((cnt & 0x1F) === 0) return;
          this.escRM(m, s, this.deslocar(m.reg, v, cnt, s));
          return;
        }
        case 0xC2: case 0xC3: {
          const n = op === 0xC2 ? this.f16() : 0;
          const v = this.desempilhar(os);
          this.saltar(v, os);
          if (n) this.setSP((this.getSP() + n) & this.spMask);
          return;
        }
        case 0xC4: case 0xC5: {
          const m = this.modrm();
          if (m.ehReg) throw new Excecao(6, 0, (op === 0xC4 ? 'LES' : 'LDS') + ' precisa de um ponteiro na memória');
          const off = this.ler(m.seg, m.off, os), sel = this.ler(m.seg, (m.off + os) >>> 0, 2);
          this.carregarSeg(op === 0xC4 ? ES : DS, sel);
          this.setR(os, m.reg, off);
          return;
        }
        case 0xC6: case 0xC7: { const s = op === 0xC6 ? 1 : os; const m = this.modrm(); this.escRM(m, s, this.fimm(s)); return; }
        case 0xC8: {   // ENTER
          const tam = this.f16(), nivel = this.f8() & 31;
          this.empilhar(os, this.getR(os, 5));
          const quadro = this.getSP();
          if (nivel > 0) {
            let bp = this.getR(as === 4 && this.seg[SS].big ? 4 : 2, 5);
            for (let i = 1; i < nivel; i++) {
              bp = (bp - os) & this.spMask;
              this.empilhar(os, this.ler(SS, bp, os));
            }
            this.empilhar(os, quadro);
          }
          this.setR(os, 5, quadro);
          this.setSP((this.getSP() - tam) & this.spMask);
          return;
        }
        case 0xC9: {   // LEAVE
          this.setSP(this.seg[SS].big ? this.r[5] : this.r[5] & 0xFFFF);
          this.setR(os, 5, this.desempilhar(os));
          return;
        }
        case 0xCA: case 0xCB: { const n = op === 0xCA ? this.f16() : 0; return this.retornarFar(os, n); }
        case 0xCC: this.interromperSoft(3, true); return;
        case 0xCD: { const v = this.f8(); this.interromperSoft(v, false); return; }
        case 0xCE: if (this.flag(OF)) this.interromperSoft(4, true); return;
        case 0xCF: return this.iret(os);
        case 0xD6: throw new Excecao(6, 0, 'opcode D6h não é uma instrução documentada do 386');
        case 0xD7: { const off = as === 4 ? (this.r[3] + this.get8(0)) >>> 0 : (this.get16(3) + this.get8(0)) & 0xFFFF; this.set8(0, this.ler(this.segOver !== null ? this.segOver : DS, off, 1)); return; }
        case 0xE0: case 0xE1: case 0xE2: case 0xE3: {
          const d = sx8(this.f8());
          let salta;
          if (op === 0xE3) salta = (as === 4 ? this.r[1] : this.get16(1)) === 0;
          else {
            const c = ((as === 4 ? this.r[1] : this.get16(1)) - 1) >>> 0;
            if (as === 4) this.r[1] = c; else this.set16(1, c);
            const cz = as === 4 ? c !== 0 : (c & 0xFFFF) !== 0;
            salta = op === 0xE2 ? cz : op === 0xE1 ? cz && this.flag(ZF) : cz && !this.flag(ZF);
          }
          if (salta) this.saltar(this.ip + d, os);
          return;
        }
        case 0xE4: case 0xE5: { const p = this.f8(); const s = op === 0xE4 ? 1 : os; this.conferirPorta(p, s); this.setR(s, 0, this.entrada(p, s)); return; }
        case 0xE6: case 0xE7: { const p = this.f8(); const s = op === 0xE6 ? 1 : os; this.conferirPorta(p, s); this.saidaPorta(p, s, this.getR(s, 0)); return; }
        case 0xEC: case 0xED: { const p = this.get16(2); const s = op === 0xEC ? 1 : os; this.conferirPorta(p, s); this.setR(s, 0, this.entrada(p, s)); return; }
        case 0xEE: case 0xEF: { const p = this.get16(2); const s = op === 0xEE ? 1 : os; this.conferirPorta(p, s); this.saidaPorta(p, s, this.getR(s, 0)); return; }
        case 0xE8: { const d = os === 4 ? this.f32() | 0 : sx16(this.f16()); this.empilhar(os, this.ip); this.saltar(this.ip + d, os); return; }
        case 0xE9: { const d = os === 4 ? this.f32() | 0 : sx16(this.f16()); this.saltar(this.ip + d, os); return; }
        case 0xEA: { const off = this.fimm(os), sel = this.f16(); return this.chamarFar(sel, off, os, false); }
        case 0xEB: { const d = sx8(this.f8()); this.saltar(this.ip + d, os); return; }
        case 0xF1: throw new Excecao(6, 0, 'opcode F1h não é uma instrução documentada');
        case 0xF4: {
          this.exigirAnel0('HLT');
          this.hltEspera = true;
          return;
        }
        case 0xF5: this.flags ^= CF; return;
        case 0xF6: case 0xF7: return this.grupo3(op === 0xF6 ? 1 : os);
        case 0xF8: this.flags &= ~CF; return;
        case 0xF9: this.flags |= CF; return;
        case 0xFA: this.exigirIOPL('CLI'); this.flags &= ~IF; return;
        case 0xFB: this.exigirIOPL('STI'); if (!this.flag(IF)) this.inibirInt = true; this.flags |= IF; return;
        case 0xFC: this.flags &= ~DF; return;
        case 0xFD: this.flags |= DF; return;
        case 0xFE: case 0xFF: return this.grupo45(op === 0xFE ? 1 : os, op);
      }
      throw new Excecao(6, 0, 'opcode ' + hex(op, 2) + 'h não é uma instrução do 386');
    }

    exigirIOPLv86(nome) {
      if (this.v86 && this.iopl() < 3) throw new Excecao(13, 0, nome + ' no modo v86 com IOPL ' + this.iopl() + ': o monitor do kernel precisa emular');
    }

    interromperSoft(vet, armadilha) {
      if (this.v86 && this.iopl() < 3) throw new Excecao(13, 0, 'INT ' + vet + ' no modo v86 com IOPL ' + this.iopl() + ': o monitor do kernel precisa emular a interrupção');
      this.eip = this.ip;
      this.interromper(vet, { software: true });
      this.ip = this.eip;
    }

    imulFlags(a, b, s) {
      const p = BigInt(a) * BigInt(b);
      const r = Number(BigInt.asUintN(s * 8, p));
      const ext = BigInt.asIntN(s * 8, p) === p;
      this.setFlag(CF, !ext); this.setFlag(OF, !ext);
      return r;
    }

    grupo3(s) {
      const m = this.modrm();
      switch (m.reg) {
        case 0: case 1: { const v = this.lerRM(m, s); this.alu(4, v, this.fimm(s), s); return; }
        case 2: this.escRM(m, s, ((~this.lerRM(m, s)) & MASK[s]) >>> 0); return;
        case 3: { const v = this.lerRM(m, s); const r = this.alu(5, 0, v, s); this.escRM(m, s, r); this.setFlag(CF, v !== 0); return; }
        case 4: case 5: {   // MUL, IMUL
          const v = this.lerRM(m, s);
          if (s === 1) {
            const r = m.reg === 4 ? this.get8(0) * v : sx8(this.get8(0)) * sx8(v);
            this.set16(0, r);
            const alta = m.reg === 4 ? (r & 0xFF00) !== 0 : sx8(r & 0xFF) !== r;
            this.setFlag(CF, alta); this.setFlag(OF, alta);
          } else {
            const a = m.reg === 4 ? BigInt(this.getR(s, 0)) : BigInt(sx(this.getR(s, 0), s));
            const b = m.reg === 4 ? BigInt(v) : BigInt(sx(v, s));
            const p = a * b, bits = BigInt(s * 8);
            const lo = Number(BigInt.asUintN(s * 8, p)), hi = Number(BigInt.asUintN(s * 8, p >> bits));
            this.setR(s, 0, lo); this.setR(s, 2, hi);
            const alta = m.reg === 4 ? hi !== 0 : BigInt.asIntN(s * 8, p) !== p;
            this.setFlag(CF, alta); this.setFlag(OF, alta);
          }
          return;
        }
        case 6: case 7: {   // DIV, IDIV
          const v = this.lerRM(m, s);
          if (v === 0) throw new Excecao(0, 0, 'divisão por zero');
          const sinal = m.reg === 7;
          let dividendo;
          if (s === 1) dividendo = sinal ? BigInt(sx16(this.get16(0))) : BigInt(this.get16(0));
          else {
            const hi = BigInt(this.getR(s, 2)), lo = BigInt(this.getR(s, 0)), bits = BigInt(s * 8);
            dividendo = (hi << bits) | lo;
            if (sinal) dividendo = BigInt.asIntN(s * 16, dividendo);
          }
          const div = sinal ? BigInt(sx(v, s)) : BigInt(v);
          const q = dividendo / div, r = dividendo % div;
          const cabe = sinal ? BigInt.asIntN(s * 8, q) === q : BigInt.asUintN(s * 8, q) === q;
          if (!cabe) throw new Excecao(0, 0, 'o quociente ' + q + ' não cabe em ' + s * 8 + ' bits');
          if (s === 1) { this.set8(0, Number(BigInt.asUintN(8, q))); this.set8(4, Number(BigInt.asUintN(8, r))); }
          else { this.setR(s, 0, Number(BigInt.asUintN(s * 8, q))); this.setR(s, 2, Number(BigInt.asUintN(s * 8, r))); }
          return;
        }
      }
    }

    grupo45(s, op) {
      const m = this.modrm();
      if (op === 0xFE && m.reg > 1) throw new Excecao(6, 0, 'opcode FE com extensão ' + m.reg + ' não existe');
      switch (m.reg) {
        case 0: case 1: this.escRM(m, s, this.incdec(this.lerRM(m, s), s, m.reg === 1)); return;
        case 2: { const v = this.lerRM(m, s); this.empilhar(s, this.ip); this.saltar(v, s); return; }
        case 3: case 5: {
          if (m.ehReg) throw new Excecao(6, 0, 'salto far indireto precisa de um ponteiro na memória');
          const off = this.ler(m.seg, m.off, s), sel = this.ler(m.seg, (m.off + s) >>> 0, 2);
          return this.chamarFar(sel, off, s, m.reg === 3);
        }
        case 4: { const v = this.lerRM(m, s); this.saltar(v, s); return; }
        case 6: this.empilhar(s, this.lerRM(m, s)); return;
      }
      throw new Excecao(6, 0, 'opcode FF com extensão 7 não existe');
    }

    bcd(op) {
      let al = this.get8(0);
      const cf = this.flag(CF), af = this.flag(AF);
      if (op === 0x27 || op === 0x2F) {   // DAA, DAS
        let ncf = false, naf = false;
        const velho = al;
        if ((al & 0xF) > 9 || af) { al = op === 0x27 ? al + 6 : al - 6; naf = true; ncf = cf || (op === 0x27 ? al > 0xFF : al < 0); }
        if (velho > 0x99 || cf) { al = op === 0x27 ? al + 0x60 : al - 0x60; ncf = true; }
        this.flagsLogica(al & 0xFF, 1);
        this.set8(0, al & 0xFF);
        this.setFlag(CF, ncf); this.setFlag(AF, naf);
        return;
      }
      if ((al & 0xF) > 9 || af) {   // AAA, AAS
        if (op === 0x37) { this.set16(0, this.get16(0) + 0x106); } else { this.set16(0, this.get16(0) - 6); this.set8(4, this.get8(4) - 1); }
        this.setFlag(AF, true); this.setFlag(CF, true);
      } else { this.setFlag(AF, false); this.setFlag(CF, false); }
      this.set8(0, this.get8(0) & 0x0F);
    }

    // ---------------- instruções de string ----------------
    string(op, os, as, rep) {
      const s = op & 1 ? os : 1;
      const delta = this.flag(DF) ? -s : s;
      const srcSeg = this.segOver !== null ? this.segOver : DS;
      const idx = (i) => as === 4 ? this.r[i] : this.get16(i);
      const setIdx = (i, v) => { if (as === 4) this.r[i] = v >>> 0; else this.set16(i, v); };
      const cont = () => as === 4 ? this.r[1] : this.get16(1);
      const tipo = op & 0xFE;
      let limite = 4096;
      for (;;) {
        if (rep && cont() === 0) return;
        switch (tipo) {
          case 0xA4: this.escrever(ES, idx(7), s, this.ler(srcSeg, idx(6), s)); setIdx(6, idx(6) + delta); setIdx(7, idx(7) + delta); break;
          case 0xA6: { const a = this.ler(srcSeg, idx(6), s), b = this.ler(ES, idx(7), s); this.alu(7, a, b, s); setIdx(6, idx(6) + delta); setIdx(7, idx(7) + delta); break; }
          case 0xAA: this.escrever(ES, idx(7), s, this.getR(s, 0)); setIdx(7, idx(7) + delta); break;
          case 0xAC: this.setR(s, 0, this.ler(srcSeg, idx(6), s)); setIdx(6, idx(6) + delta); break;
          case 0xAE: { const b = this.ler(ES, idx(7), s); this.alu(7, this.getR(s, 0), b, s); setIdx(7, idx(7) + delta); break; }
        }
        if (!rep) return;
        setIdx(1, cont() - 1);
        if ((tipo === 0xA6 || tipo === 0xAE) && ((rep === 0xF3) !== this.flag(ZF))) return;
        if (cont() === 0) return;
        if (--limite === 0) { this.ip = this.eipInicio; return; }   // continua no próximo passo (deixa as interrupções entrarem)
      }
    }
    stringES(op, os, as, rep) {
      const s = op & 1 ? os : 1;
      const delta = this.flag(DF) ? -s : s;
      const idx = (i) => as === 4 ? this.r[i] : this.get16(i);
      const setIdx = (i, v) => { if (as === 4) this.r[i] = v >>> 0; else this.set16(i, v); };
      const cont = () => as === 4 ? this.r[1] : this.get16(1);
      const porta = this.get16(2);
      this.conferirPorta(porta, s);
      let limite = 4096;
      for (;;) {
        if (rep && cont() === 0) return;
        if (op <= 0x6D) { this.escrever(ES, idx(7), s, this.entrada(porta, s)); setIdx(7, idx(7) + delta); }
        else { this.saidaPorta(porta, s, this.ler(this.segOver !== null ? this.segOver : DS, idx(6), s)); setIdx(6, idx(6) + delta); }
        if (!rep) return;
        setIdx(1, cont() - 1);
        if (cont() === 0) return;
        if (--limite === 0) { this.ip = this.eipInicio; return; }
      }
    }

    // ---------------- 0F xx ----------------
    opcode0F(os, as, rep) {
      const op = this.f8();
      if (op >= 0x80 && op <= 0x8F) {
        const d = os === 4 ? this.f32() | 0 : sx16(this.f16());
        if (this.condicao(op & 15)) this.saltar(this.ip + d, os);
        return;
      }
      if (op >= 0x90 && op <= 0x9F) { const m = this.modrm(); this.escRM(m, 1, this.condicao(op & 15) ? 1 : 0); return; }
      switch (op) {
        case 0x00: return this.grupo6(os);
        case 0x01: return this.grupo7(os);
        case 0x02: case 0x03: {   // LAR, LSL
          if (!this.pe || this.v86) throw new Excecao(6, 0, (op === 2 ? 'LAR' : 'LSL') + ' só existe no modo protegido');
          const m = this.modrm();
          const sel = this.lerRM(m, 2);
          const d = this.descritorSeVisivel(sel, op === 2 ? 'lar' : 'lsl');
          if (!d) { this.setFlag(ZF, false); return; }
          this.setFlag(ZF, true);
          if (op === 2) this.setR(os, m.reg, (d.hi & (os === 4 ? 0x00FFFF00 : 0xFF00)) >>> 0);
          else this.setR(os, m.reg, d.limit);
          return;
        }
        case 0x06: this.exigirAnel0('CLTS'); this.cr0 &= ~8; return;
        case 0x20: case 0x22: {   // MOV CRn
          this.exigirAnel0('MOV CR');
          const b = this.f8(); const crn = (b >> 3) & 7, rg = b & 7;
          if (op === 0x20) {
            const v = crn === 0 ? this.cr0 : crn === 2 ? this.cr2 : crn === 3 ? this.cr3 : null;
            if (v === null) throw new Excecao(6, 0, 'CR' + crn + ' não existe no 386');
            this.r[rg] = v >>> 0;
          } else {
            const v = this.r[rg];
            if (crn === 0) {
              if ((v & 0x80000000) && !(v & 1)) throw new Excecao(13, 0, 'ligar a paginação (PG) com o modo protegido (PE) desligado não é permitido');
              const mudouPG = ((v ^ this.cr0) & 0x80000000) !== 0;
              const entrouPM = !(this.cr0 & 1) && (v & 1);
              const saiuPM = (this.cr0 & 1) && !(v & 1);
              this.cr0 = (v & 0x8000001F) | 0x10;
              if (mudouPG) this.limparTLB();
              if (entrouPM) { this.cpl = 0; this.nota('cpu', 'CR0.PE = 1: o processador está no modo protegido (CS ainda tem o valor antigo até o salto far).'); }
              if (saiuPM) this.nota('cpu', 'CR0.PE = 0: de volta ao modo real.');
              if (mudouPG) this.nota('cpu', (v & 0x80000000) ? 'CR0.PG = 1: paginação ligada (diretório em ' + hex(this.cr3) + ').' : 'Paginação desligada.');
            } else if (crn === 2) this.cr2 = v;
            else if (crn === 3) { this.cr3 = v & 0xFFFFF018; this.limparTLB(); }
            else throw new Excecao(6, 0, 'CR' + crn + ' não existe no 386');
          }
          return;
        }
        case 0x21: case 0x23: {
          this.exigirAnel0('MOV DR');
          const b = this.f8(); const n = (b >> 3) & 7, rg = b & 7;
          if (op === 0x21) this.r[rg] = this.dr[n]; else this.dr[n] = this.r[rg];
          return;
        }
        case 0x24: case 0x26: { this.exigirAnel0('MOV TR'); const b = this.f8(); if (op === 0x24) this.r[b & 7] = 0; return; }
        case 0xA0: case 0xA8: this.empilhar(os, this.seg[op === 0xA0 ? FS : GS].sel); return;
        case 0xA1: case 0xA9: {
          const s = op === 0xA1 ? FS : GS;
          const sp = this.getSP();
          const v = this.ler(SS, sp, os) & 0xFFFF;
          this.carregarSeg(s, v);
          this.setSP((sp + os) & this.spMask);
          return;
        }
        case 0xA3: case 0xAB: case 0xB3: case 0xBB: case 0xBA: return this.bitTest(op, os, as);
        case 0xA4: case 0xA5: case 0xAC: case 0xAD: {   // SHLD, SHRD
          const m = this.modrm();
          const cnt = (op & 1 ? this.get8(1) : this.f8()) & 0x1F;
          if (!cnt) return;
          const d = this.lerRM(m, os), src = this.getR(os, m.reg);
          const bits = os * 8;
          const esq = op < 0xAC;
          const total = (BigInt(d) << BigInt(bits)) | BigInt(src);
          let r, cf;
          if (esq) {
            const big = (BigInt(d) << BigInt(bits)) | BigInt(src);
            r = Number(BigInt.asUintN(bits, big >> BigInt(bits - cnt)));
            cf = Number((BigInt(d) >> BigInt(bits - cnt)) & 1n);
          } else {
            const big = (BigInt(src) << BigInt(bits)) | BigInt(d);
            r = Number(BigInt.asUintN(bits, big >> BigInt(cnt)));
            cf = Number((BigInt(d) >> BigInt(cnt - 1)) & 1n);
          }
          void total;
          this.flagsLogica(r, os);
          this.setFlag(CF, !!cf);
          this.setFlag(OF, ((r ^ d) & SINAL[os]) !== 0);
          this.escRM(m, os, r);
          return;
        }
        case 0xAF: { const m = this.modrm(); this.setR(os, m.reg, this.imulFlags(sx(this.getR(os, m.reg), os), sx(this.lerRM(m, os), os), os)); return; }
        case 0xB2: case 0xB4: case 0xB5: {
          const m = this.modrm();
          if (m.ehReg) throw new Excecao(6, 0, 'precisa de um ponteiro na memória');
          const off = this.ler(m.seg, m.off, os), sel = this.ler(m.seg, (m.off + os) >>> 0, 2);
          const s = op === 0xB2 ? SS : op === 0xB4 ? FS : GS;
          this.carregarSeg(s, sel);
          this.setR(os, m.reg, off);
          if (s === SS) this.inibirInt = true;
          return;
        }
        case 0xB6: case 0xB7: case 0xBE: case 0xBF: {
          const m = this.modrm();
          const ts = op & 1 ? 2 : 1;
          const v = this.lerRM(m, ts);
          this.setR(os, m.reg, op >= 0xBE ? (sx(v, ts) & MASK[os]) >>> 0 : v);
          return;
        }
        case 0xBC: case 0xBD: {
          const m = this.modrm();
          const v = this.lerRM(m, os);
          if (v === 0) { this.setFlag(ZF, true); return; }
          this.setFlag(ZF, false);
          let i;
          if (op === 0xBC) { i = 0; while (!((v >>> i) & 1)) i++; }
          else { i = os * 8 - 1; while (!((v >>> i) & 1)) i--; }
          this.setR(os, m.reg, i);
          return;
        }
      }
      throw new Excecao(6, 0, 'opcode 0F ' + hex(op, 2) + 'h não existe no 386' + ({ 0xA2: ' (CPUID veio depois, no 486 e no Pentium)', 0x31: ' (RDTSC veio com o Pentium)', 0x08: ' (INVD é do 486)', 0x09: ' (WBINVD é do 486)', 0xB0: ' (CMPXCHG é do 486)', 0xB1: ' (CMPXCHG é do 486)', 0xC0: ' (XADD é do 486)', 0xC1: ' (XADD é do 486)', 0x0B: ' (UD2 é do Pentium Pro)' }[op] || (op >= 0xC8 && op <= 0xCF ? ' (BSWAP é do 486)' : '')));
    }

    bitTest(op, os, as) {
      const m = this.modrm();
      let bit, k;
      if (op === 0xBA) { k = m.reg; if (k < 4) throw new Excecao(6, 0, '0F BA com extensão ' + k + ' não existe'); bit = this.f8(); }
      else { k = { 0xA3: 4, 0xAB: 5, 0xB3: 6, 0xBB: 7 }[op]; bit = this.getR(os, m.reg); }
      if (m.ehReg) {
        const n = bit & (os * 8 - 1);
        const v = this.getR(os, m.rm);
        this.setFlag(CF, ((v >>> n) & 1) === 1);
        if (k === 4) return;
        const r = k === 5 ? v | (1 << n) : k === 6 ? v & ~(1 << n) : v ^ (1 << n);
        this.setR(os, m.rm, r >>> 0);
        return;
      }
      // na memória, o deslocamento do bit pode sair da palavra (só com registrador)
      let off = m.off;
      let n = bit;
      if (op !== 0xBA) { const sv = sx(bit, os); off = (off + Math.floor(sv / 8)) >>> 0; n = ((sv % 8) + 8) % 8; }
      else { off = (off + ((n & (os * 8 - 1)) >> 3)) >>> 0; n = n & 7; }
      if (as === 2) off &= 0xFFFF;
      const v = this.ler(m.seg, off, 1);
      this.setFlag(CF, ((v >> n) & 1) === 1);
      if (k === 4) return;
      const r = k === 5 ? v | (1 << n) : k === 6 ? v & ~(1 << n) : v ^ (1 << n);
      this.escrever(m.seg, off, 1, r & 0xFF);
    }

    descritorSeVisivel(sel, quem) {
      if ((sel & 0xFFFC) === 0) return null;
      let d;
      try { d = this.lerDescritor(sel); } catch (e) { if (e instanceof Excecao) return null; throw e; }
      const hi = this.lerLin(d.end + 4, 4, false);
      d.hi = hi;
      const conforme = d.s && (d.tipo & 0x1C) === 0x1C;
      if (!conforme && (d.dpl < this.cpl || d.dpl < (sel & 3))) return null;
      if (!d.s) {
        const validos = quem === 'lsl' ? [1, 2, 3, 9, 0xB] : [1, 2, 3, 4, 5, 9, 0xB, 0xC];
        if (!validos.includes(d.tipo & 0xF)) return null;
      }
      return d;
    }

    grupo6(os) {
      if (!this.pe || this.v86) throw new Excecao(6, 0, 'SLDT, STR, LLDT, LTR, VERR e VERW só existem no modo protegido');
      const m = this.modrm();
      switch (m.reg) {
        case 0: if (m.ehReg) this.setR(os, m.rm, this.ldtr.sel); else this.escrever(m.seg, m.off, 2, this.ldtr.sel); return;
        case 1: if (m.ehReg) this.setR(os, m.rm, this.tr.sel); else this.escrever(m.seg, m.off, 2, this.tr.sel); return;
        case 2: {   // LLDT
          this.exigirAnel0('LLDT');
          const sel = this.lerRM(m, 2);
          if ((sel & 0xFFFC) === 0) { this.ldtr = { sel, base: 0, limit: 0, valido: false }; return; }
          if (sel & 4) throw new Excecao(13, sel & 0xFFFC, 'o descritor da LDT precisa estar na GDT (TI = 0)');
          const d = this.lerDescritor(sel);
          if (d.s || d.tipo !== 2) throw new Excecao(13, sel & 0xFFFC, 'LLDT ' + hex(sel, 4) + ': o descritor não é de LDT (é ' + nomeTipo(d) + ')');
          if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'a LDT ' + hex(sel, 4) + ' não está presente');
          this.ldtr = { sel, base: d.base, limit: d.limit, valido: true };
          this.nota('cpu', 'LDT carregada: seletor ' + hex(sel, 4) + ', base ' + hex(d.base) + ', limite ' + hex(d.limit));
          return;
        }
        case 3: {   // LTR
          this.exigirAnel0('LTR');
          const sel = this.lerRM(m, 2);
          if ((sel & 0xFFFC) === 0) throw new Excecao(13, 0, 'LTR com o seletor nulo');
          if (sel & 4) throw new Excecao(13, sel & 0xFFFC, 'o TSS precisa estar na GDT (TI = 0)');
          const d = this.lerDescritor(sel);
          if (d.s || (d.tipo !== 1 && d.tipo !== 9)) throw new Excecao(13, sel & 0xFFFC, 'LTR ' + hex(sel, 4) + ': o descritor não é um TSS disponível (é ' + nomeTipo(d) + ')' + (d.tipo === 0xB ? '. Ele já está marcado como ocupado (busy).' : ''));
          if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'o TSS ' + hex(sel, 4) + ' não está presente');
          this.marcarBusy(sel, true);
          this.tr = { sel, base: d.base, limit: d.limit, tipo: d.tipo | 2, valido: true };
          this.nota('cpu', 'TSS carregado (LTR ' + hex(sel, 4) + '): base ' + hex(d.base) + ', limite ' + hex(d.limit));
          return;
        }
        case 4: case 5: {   // VERR, VERW
          const sel = this.lerRM(m, 2);
          const d = this.descritorSeVisivel(sel, 'ver');
          let ok = !!d && d.s;
          if (ok) ok = m.reg === 4 ? ((d.tipo & 0x18) === 0x10 || (d.tipo & 0x1A) === 0x1A) : (d.tipo & 0x1A) === 0x12;
          this.setFlag(ZF, ok);
          return;
        }
      }
      throw new Excecao(6, 0, '0F 00 com extensão ' + m.reg + ' não existe');
    }

    grupo7(os) {
      const m = this.modrm();
      switch (m.reg) {
        case 0: case 1: {   // SGDT, SIDT
          if (m.ehReg) throw new Excecao(6, 0, 'SGDT/SIDT precisam de um endereço de memória');
          const t = m.reg === 0 ? this.gdtr : this.idtr;
          this.escrever(m.seg, m.off, 2, t.limit);
          this.escrever(m.seg, (m.off + 2) >>> 0, 4, os === 2 ? (t.base & 0x00FFFFFF) | 0 : t.base);
          return;
        }
        case 2: case 3: {   // LGDT, LIDT
          this.exigirAnel0(m.reg === 2 ? 'LGDT' : 'LIDT');
          if (m.ehReg) throw new Excecao(6, 0, 'LGDT/LIDT precisam de um endereço de memória');
          const limit = this.ler(m.seg, m.off, 2);
          let base = this.ler(m.seg, (m.off + 2) >>> 0, 4);
          if (os === 2) base &= 0x00FFFFFF;
          const t = { base: base >>> 0, limit };
          if (m.reg === 2) { this.gdtr = t; this.nota('cpu', 'GDT carregada: base ' + hex(t.base) + ', limite ' + hex(limit, 4) + ' (' + Math.floor((limit + 1) / 8) + ' descritores)'); }
          else { this.idtr = t; this.nota('cpu', 'IDT carregada: base ' + hex(t.base) + ', limite ' + hex(limit, 4) + (this.pe || true ? ' (' + Math.floor((limit + 1) / 8) + ' entradas de 8 bytes no modo protegido)' : '')); }
          return;
        }
        case 4: { const v = this.cr0 & 0xFFFF; if (m.ehReg) this.setR(os, m.rm, os === 4 ? this.cr0 : v); else this.escrever(m.seg, m.off, 2, v); return; }   // SMSW
        case 6: {   // LMSW: só PE, MP, EM, TS; não desliga PE
          this.exigirAnel0('LMSW');
          const v = this.lerRM(m, 2);
          const pe = (this.cr0 & 1) | (v & 1);
          if (!(this.cr0 & 1) && (v & 1)) { this.cpl = 0; this.nota('cpu', 'LMSW ligou o modo protegido (PE = 1), como num 286.'); }
          this.cr0 = (this.cr0 & ~0xF) | (v & 0xE) | pe;
          return;
        }
        case 7: throw new Excecao(6, 0, 'INVLPG não existe no 386 (veio com o 486). No 386, recarregue o CR3 para limpar a TLB.');
      }
      throw new Excecao(6, 0, '0F 01 com extensão ' + m.reg + ' não existe');
    }

    // ---------------- saltos e retornos far ----------------
    chamarFar(sel, off, os, call) {
      if (!this.pe || this.v86) {
        if (call) { this.empilhar(os, this.seg[CS].sel); this.empilhar(os, this.ip); }
        this.carregarSeg(CS, sel);
        this.saltar(off, os);
        return;
      }
      if ((sel & 0xFFFC) === 0) throw new Excecao(13, 0, (call ? 'CALL' : 'JMP') + ' far para o seletor nulo');
      const d = this.lerDescritor(sel);
      const rpl = sel & 3;
      if (d.s) {
        if (!(d.tipo & 8)) throw new Excecao(13, sel & 0xFFFC, 'o seletor ' + hex(sel, 4) + ' é de dados, não de código: um salto far precisa de um segmento de código');
        const conforme = (d.tipo & 4) !== 0;
        if (conforme ? d.dpl > this.cpl : (rpl > this.cpl || d.dpl !== this.cpl)) throw new Excecao(13, sel & 0xFFFC, 'salto far para ' + hex(sel, 4) + ' (DPL ' + d.dpl + ') a partir do anel ' + this.cpl + ': para mudar de anel é preciso uma porta de chamada, uma interrupção ou um IRET/RETF');
        if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'o segmento de código ' + hex(sel, 4) + ' não está presente');
        if (off > d.limit) throw new Excecao(13, 0, 'o destino ' + hex(off) + ' passa do limite do segmento ' + hex(sel, 4));
        if (call) { this.empilhar(os, this.seg[CS].sel); this.empilhar(os, this.ip); }
        this.carregarCS(sel, d, this.cpl);
        this.saltar(off, os);
        if (!this.osCodigo32 && d.big) this.nota('cpu', 'CS = ' + hex(sel, 4) + ': agora o código roda em 32 bits.');
        return;
      }
      // sistema
      if (d.tipo === 0x9 || d.tipo === 0x1 || d.tipo === 0x5) {
        if (d.dpl < this.cpl || d.dpl < rpl) throw new Excecao(13, sel & 0xFFFC, 'sem privilégio para usar o TSS/porta de tarefa ' + hex(sel, 4));
        this.eip = this.ip;
        if (d.tipo === 0x5) {
          if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'a porta de tarefa não está presente');
          const alvo = (this.lerLin(d.end, 4, false) >>> 16) & 0xFFFF;
          this.trocarTarefa(alvo, call ? 'call' : 'jmp');
        } else this.trocarTarefa(sel, call ? 'call' : 'jmp');
        this.ip = this.eip;
        return;
      }
      if (d.tipo === 0xB || d.tipo === 0x3) throw new Excecao(13, sel & 0xFFFC, 'a tarefa ' + hex(sel, 4) + ' está ocupada (busy)');
      if (d.tipo !== 0xC && d.tipo !== 0x4) throw new Excecao(13, sel & 0xFFFC, 'salto far para um descritor de sistema que não é porta: ' + nomeTipo(d));
      // porta de chamada
      if (d.dpl < this.cpl || d.dpl < rpl) throw new Excecao(13, sel & 0xFFFC, 'a porta de chamada ' + hex(sel, 4) + ' tem DPL ' + d.dpl + ': o anel ' + this.cpl + ' não pode usá-la');
      if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'a porta de chamada ' + hex(sel, 4) + ' não está presente');
      const lo = this.lerLin(d.end, 4, false), hi = this.lerLin(d.end + 4, 4, false);
      const g32 = d.tipo === 0xC;
      const csSel = (lo >>> 16) & 0xFFFF;
      const destino = g32 ? ((lo & 0xFFFF) | (hi & 0xFFFF0000)) >>> 0 : lo & 0xFFFF;
      const nparam = hi & 0x1F;
      const dc = this.lerDescritor(csSel);
      if (!dc.s || !(dc.tipo & 8)) throw new Excecao(13, csSel & 0xFFFC, 'a porta de chamada aponta para ' + hex(csSel, 4) + ', que não é de código');
      if (dc.dpl > this.cpl) throw new Excecao(13, csSel & 0xFFFC, 'a porta de chamada leva a um código menos privilegiado');
      if (!dc.presente) throw new Excecao(11, csSel & 0xFFFC, 'o código de destino da porta não está presente');
      const conforme = (dc.tipo & 4) !== 0;
      const tam = g32 ? 4 : 2;
      if (call && !conforme && dc.dpl < this.cpl) {
        const novo = dc.dpl;
        const { ss: nss, esp: nesp } = this.pilhaDoTSS(novo);
        const velhoSS = this.seg[SS].sel, velhoESP = this.getSP();
        const params = [];
        for (let i = 0; i < nparam; i++) params.push(this.ler(SS, (velhoESP + i * tam) & this.spMask, tam));
        const dss = this.lerDescritor(nss, 10);
        if ((nss & 3) !== novo || dss.dpl !== novo || !dss.s || (dss.tipo & 0x1A) !== 0x12) throw new Excecao(10, nss & 0xFFFC, 'a pilha do anel ' + novo + ' no TSS não serve');
        this.cpl = novo;
        this.defSeg(SS, { sel: nss, base: dss.base, limit: dss.limit, tipo: dss.tipo, dpl: dss.dpl, big: dss.big, presente: true, valido: true, s: true });
        this.r[4] = nesp;
        this.empilhar(tam, velhoSS);
        this.empilhar(tam, velhoESP);
        for (let i = nparam - 1; i >= 0; i--) this.empilhar(tam, params[i]);
        this.empilhar(tam, this.seg[CS].sel);
        this.empilhar(tam, this.ip);
        this.carregarCS(csSel, dc, novo);
      } else {
        if (!call && !conforme && dc.dpl !== this.cpl) throw new Excecao(13, csSel & 0xFFFC, 'JMP por porta de chamada não muda de anel');
        if (call) { this.empilhar(tam, this.seg[CS].sel); this.empilhar(tam, this.ip); }
        this.carregarCS(csSel, dc, this.cpl);
      }
      this.ip = destino;
    }

    retornarFar(os, n) {
      if (!this.pe || this.v86) {
        const ip = this.desempilhar(os), cs = this.desempilhar(os) & 0xFFFF;
        this.carregarSeg(CS, cs);
        this.saltar(ip, os);
        if (n) this.setSP((this.getSP() + n) & this.spMask);
        return;
      }
      const sp = this.getSP();
      const novoEIP = this.ler(SS, sp, os), sel = this.ler(SS, (sp + os) & this.spMask, 2);
      const rpl = sel & 3;
      if (rpl < this.cpl) throw new Excecao(13, sel & 0xFFFC, 'RETF não pode voltar para um anel mais privilegiado (RPL ' + rpl + ', anel atual ' + this.cpl + ')');
      const d = this.lerDescritor(sel);
      if (!d.s || !(d.tipo & 8)) throw new Excecao(13, sel & 0xFFFC, 'RETF para ' + hex(sel, 4) + ', que não é segmento de código');
      if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'o código de volta não está presente');
      if (rpl === this.cpl) {
        this.setSP((sp + 2 * os + n) & this.spMask);
        this.carregarCS(sel, d, this.cpl);
        this.saltar(novoEIP, os);
        return;
      }
      // volta para anel menos privilegiado
      const base = (sp + 2 * os + n) & this.spMask;
      const novoESP = this.ler(SS, base, os), novoSS = this.ler(SS, (base + os) & this.spMask, 2);
      this.carregarCS(sel, d, rpl);
      this.carregarSegRet(novoSS, novoESP, os, n);
      this.saltar(novoEIP, os);
    }
    carregarSegRet(nss, nesp, os, n) {
      this.carregarSeg(SS, nss);
      this.setSP(((os === 2 ? nesp & 0xFFFF : nesp) + (n || 0)) >>> 0);
      // segmentos de dados mais privilegiados que o anel novo viram nulos
      for (const s of [ES, DS, FS, GS]) {
        const d = this.seg[s];
        if (!d.valido) continue;
        const conforme = (d.tipo & 0x1C) === 0x1C;
        if (!conforme && d.dpl < this.cpl) this.defSeg(s, { sel: 0, base: 0, limit: 0, valido: false });
      }
    }

    iret(os) {
      if (!this.pe) {
        const ip = this.desempilhar(os), cs = this.desempilhar(os) & 0xFFFF, fl = this.desempilhar(os);
        this.carregarSeg(CS, cs);
        this.saltar(ip, os);
        this.aplicarFlags(fl, os);
        return;
      }
      if (this.v86) {
        if (this.iopl() < 3) throw new Excecao(13, 0, 'IRET no modo v86 com IOPL ' + this.iopl() + ': o monitor precisa emular');
        const ip = this.desempilhar(os), cs = this.desempilhar(os) & 0xFFFF, fl = this.desempilhar(os);
        this.carregarSeg(CS, cs);
        this.saltar(ip, os);
        this.aplicarFlags(fl, os);
        return;
      }
      if (this.flag(NT)) {
        const volta = this.lerLin(this.tr.base, 2, false);
        this.eip = this.ip;
        this.trocarTarefa(volta, 'iret');
        this.ip = this.eip;
        return;
      }
      const sp = this.getSP();
      const novoEIP = this.ler(SS, sp, os), sel = this.ler(SS, (sp + os) & this.spMask, 2), fl = this.ler(SS, (sp + 2 * os) & this.spMask, os);
      if (os === 4 && (fl & VM) && this.cpl === 0) {
        // volta para o modo v86
        const b = (sp + 12) & this.spMask;
        const r = (i) => this.ler(SS, (b + 4 * i) & this.spMask, 4);
        const nesp = r(0), nss = r(1) & 0xFFFF, nes = r(2) & 0xFFFF, nds = r(3) & 0xFFFF, nfs = r(4) & 0xFFFF, ngs = r(5) & 0xFFFF;
        this.flags = ((fl & FLAGS_386) | 2) >>> 0;
        this.cpl = 3;
        const segs = [nes, sel & 0xFFFF, nss, nds, nfs, ngs];
        for (let i = 0; i < 6; i++) this.defSeg(i, { sel: segs[i], base: segs[i] << 4, limit: 0xFFFF, tipo: i === CS ? 0x1B : 0x13, dpl: 3, big: false, presente: true, valido: true, s: true });
        this.r[4] = nesp & 0xFFFF;
        this.ip = novoEIP & 0xFFFF;
        this.nota('cpu', 'IRET para o modo v86: o código passa a rodar como num 8086, em ' + hex(segs[1], 4) + ':' + hex(this.ip, 4));
        return;
      }
      const rpl = sel & 3;
      if (rpl < this.cpl) throw new Excecao(13, sel & 0xFFFC, 'IRET não pode voltar para um anel mais privilegiado');
      const d = this.lerDescritor(sel);
      if (!d.s || !(d.tipo & 8)) throw new Excecao(13, sel & 0xFFFC, 'IRET para ' + hex(sel, 4) + ', que não é segmento de código');
      if (!d.presente) throw new Excecao(11, sel & 0xFFFC, 'o código de volta não está presente');
      const cplAntes = this.cpl;
      if (rpl === this.cpl) {
        this.setSP((sp + 3 * os) & this.spMask);
        this.carregarCS(sel, d, this.cpl);
        this.saltar(novoEIP, os);
        this.aplicarFlagsIret(fl, os, cplAntes);
        return;
      }
      const b = (sp + 3 * os) & this.spMask;
      const nesp = this.ler(SS, b, os), nss = this.ler(SS, (b + os) & this.spMask, 2);
      this.carregarCS(sel, d, rpl);
      this.aplicarFlagsIret(fl, os, cplAntes);
      this.carregarSegRet(nss, nesp, os, 0);
      this.saltar(novoEIP, os);
    }
    aplicarFlagsIret(v, s, cplAntes) {
      let mascara = s === 2 ? FLAGS_386 & 0xFFFF : FLAGS_386;   // os bits reservados (1, 3, 5, 15) não mudam
      mascara &= ~(VM | RF);
      if (cplAntes > 0) mascara &= ~IOPL;
      if (cplAntes > this.iopl()) mascara &= ~IF;
      this.flags = ((this.flags & ~mascara) | (v & mascara) | 2) >>> 0;
    }

    // ---------------- portas de E/S ----------------
    entrada(p, s) {
      if (p === 0x1F0) return this.ataLer(s);
      if (s > 1) { let v = 0; for (let i = 0; i < s; i++) v |= this.entrada8(p + i) << (8 * i); return v >>> 0; }
      return this.entrada8(p, 0);
    }
    saidaPorta(p, s, v) {
      if (p === 0x1F0 && s > 1) { this.ataEscrever(v, s); return; }
      if (s > 1) { for (let i = 0; i < s; i++) this.saida8(p + i, (v >>> (8 * i)) & 0xFF); return; }
      this.saida8(p, v & 0xFF);
    }
    entrada8(p) {
      switch (p) {
        case 0x20: case 0x21: return this.picM.ler(p);
        case 0xA0: case 0xA1: return this.picE.ler(p);
        case 0x40: {
          const restante = Math.max(0, this.proxTick - this.passos);
          const v = Math.floor(restante / this.periodoTimer() * this.pit.reload) & 0xFFFF;
          if (this.pit.leituraAlta) { this.pit.leituraAlta = false; return (v >> 8) & 0xFF; }
          this.pit.leituraAlta = true; return v & 0xFF;
        }
        case 0x60: { const v = this.kbd.saida === null ? (this.kbd.ultimo || 0) : this.kbd.saida; this.kbd.ultimo = v; this.kbd.saida = null; return v; }
        case 0x61: return 0x20;
        case 0x64: return (this.kbd.saida !== null || this.kbd.fila.length ? 1 : 0) | 0x14;
        case 0x71: return this.lerCMOS();
        case 0x92: return this.a20 ? 2 : 0;
        case 0x3DA: return (this.passos & 0x400) ? 9 : 0;
        case 0x3D5: return this.tela.crtcIndice === 0x0E ? (this.tela.cursor >> 8) & 0xFF : this.tela.crtcIndice === 0x0F ? this.tela.cursor & 0xFF : 0;
        case 0x3FD: return 0x60;
        case 0x3F8: return 0;
        case 0x1F7: case 0x3F6: return this.ata.status;
        case 0x1F0: return this.ataLer(1);
        case 0x1F1: return 0;
        case 0x1F2: return this.ata.cont & 0xFF;
        case 0x1F3: case 0x1F4: case 0x1F5: return this.ata.lba[p - 0x1F3];
        case 0x1F6: return this.ata.drive;
      }
      return 0xFF;
    }
    saida8(p, v) {
      switch (p) {
        case 0x20: case 0x21: this.picM.escrever(p, v); return;
        case 0xA0: case 0xA1: this.picE.escrever(p, v); return;
        case 0x43: { const canal = v >> 6; if (canal === 0) { this.pit.acesso = (v >> 4) & 3; this.pit.lsb = null; this.pit.modo = (v >> 1) & 7; } return; }
        case 0x40: {
          if (this.pit.acesso === 3) {
            if (this.pit.lsb === null) { this.pit.lsb = v; return; }
            this.pit.reload = (this.pit.lsb | (v << 8)) || 0x10000; this.pit.lsb = null;
          } else if (this.pit.acesso === 1) this.pit.reload = v || 0x10000;
          else this.pit.reload = (v << 8) || 0x10000;
          this.proxTick = this.passos + this.periodoTimer();
          this.nota('dispositivo', 'PIT canal 0 = ' + this.pit.reload + ' (' + (PIT_HZ / this.pit.reload).toFixed(1) + ' interrupções por segundo)');
          return;
        }
        case 0x60: {
          if (this.kbd.cmd === 0xD1) { this.mudarA20(!!(v & 2), 'controlador do teclado (comando D1h)'); this.kbd.cmd = null; return; }
          this.kbd.cmd = null;
          return;
        }
        case 0x64: {
          if (v === 0xD1) this.kbd.cmd = 0xD1;
          else if (v === 0xD0) { this.kbd.fila.unshift(this.a20 ? 0xDF : 0xDD); }
          else if (v === 0xDD) this.mudarA20(false, 'comando DDh do 8042');
          else if (v === 0xDF) this.mudarA20(true, 'comando DFh do 8042');
          else if (v === 0xFE) throw new Parada('terminado', 'O programa reiniciou o PC (comando FEh no controlador do teclado).');
          return;
        }
        case 0x70: this.cmos.indice = v & 0x7F; return;
        case 0x92: {
          this.mudarA20(!!(v & 2), 'porta 92h (A20 rápida)');
          if (v & 1) throw new Parada('terminado', 'O programa reiniciou o PC pela porta 92h.');
          return;
        }
        case 0xE9: this.escreverSaida(String.fromCharCode(v)); return;
        case 0x3F8: if (!(this.serial.lcr & 0x80)) this.escreverSaida(String.fromCharCode(v)); return;
        case 0x3FB: this.serial.lcr = v; return;
        case 0x3D4: this.tela.crtcIndice = v; return;
        case 0x3D5:
          if (this.tela.crtcIndice === 0x0E) this.tela.cursor = (this.tela.cursor & 0xFF) | (v << 8);
          else if (this.tela.crtcIndice === 0x0F) this.tela.cursor = (this.tela.cursor & 0xFF00) | v;
          this.telaMudou = true;
          return;
        case 0xF4: throw new Parada('terminado', 'O programa terminou pela porta F4h (código ' + v + ').');
        case 0x1F2: this.ata.cont = v; return;
        case 0x1F3: case 0x1F4: case 0x1F5: this.ata.lba[p - 0x1F3] = v; return;
        case 0x1F6: this.ata.drive = v; return;
        case 0x1F7: this.ataComando(v); return;
      }
    }
    mudarA20(on, como) {
      if (on !== this.a20) this.nota('dispositivo', 'Linha A20 ' + (on ? 'ligada' : 'desligada') + ' (' + como + ')' + (on ? ': os endereços acima de 1 MB deixam de dar a volta.' : ''));
      this.a20 = on;
    }
    escreverSaida(t) {
      this.saida += t;
      if (this.saida.length > 200000) this.saida = this.saida.slice(-100000);
      if (this.aoEscrever) this.aoEscrever(t);
    }
    lerCMOS() {
      const i = this.cmos.indice;
      const d = new Date();
      const bcd = (v) => ((Math.floor(v / 10) << 4) | (v % 10));
      switch (i) {
        case 0x00: return bcd(d.getSeconds()); case 0x02: return bcd(d.getMinutes()); case 0x04: return bcd(d.getHours());
        case 0x07: return bcd(d.getDate()); case 0x08: return bcd(d.getMonth() + 1); case 0x09: return bcd(d.getFullYear() % 100);
        case 0x0A: return 0x26; case 0x0B: return 0x02; case 0x0D: return 0x80;
        case 0x15: return 0x80; case 0x16: return 0x02;
        case 0x17: case 0x30: { const kb = (this.mem.length - 0x100000) / 1024; return kb & 0xFF; }
        case 0x18: case 0x31: { const kb = (this.mem.length - 0x100000) / 1024; return (kb >> 8) & 0xFF; }
      }
      return 0;
    }
    // disco ATA (só PIO, LBA28)
    ataComando(v) {
      const a = this.ata;
      const lba = a.lba[0] | (a.lba[1] << 8) | (a.lba[2] << 16) | ((a.drive & 0x0F) << 24);
      if (v === 0x20 || v === 0x30) {
        a.setor = lba; a.restantes = a.cont || 256; a.escrevendo = v === 0x30; a.pos = 0;
        a.buf = a.escrevendo ? new Uint8Array(512) : this.disco.slice(lba * 512, lba * 512 + 512);
        if (lba * 512 >= this.disco.length) { a.status = 0x41; return; }
        a.status = 0x58;   // DRQ
        if (!a.escrevendo) this.picE.irr |= 0x40;
      } else if (v === 0xEC) {
        a.buf = new Uint8Array(512);
        const setores = this.disco.length / 512;
        a.buf[120] = setores & 0xFF; a.buf[121] = (setores >> 8) & 0xFF; a.buf[122] = (setores >> 16) & 0xFF; a.buf[123] = (setores >> 24) & 0xFF;
        a.restantes = 1; a.pos = 0; a.escrevendo = false; a.status = 0x58;
      } else if (v === 0xE7) a.status = 0x50;
    }
    ataLer(s) {
      const a = this.ata;
      if (!a.buf || a.escrevendo) return 0;
      let v = 0;
      for (let i = 0; i < s; i++) v |= a.buf[a.pos++] << (8 * i);
      if (a.pos >= 512) {
        a.restantes--;
        if (a.restantes > 0) { a.setor++; a.buf = this.disco.slice(a.setor * 512, a.setor * 512 + 512); a.pos = 0; this.picE.irr |= 0x40; }
        else { a.buf = null; a.status = 0x50; }
      }
      return v >>> 0;
    }
    ataEscrever(v, s) {
      const a = this.ata;
      if (!a.buf || !a.escrevendo) return;
      for (let i = 0; i < s; i++) a.buf[a.pos++] = (v >>> (8 * i)) & 0xFF;
      if (a.pos >= 512) {
        if (a.setor * 512 < this.disco.length) this.disco.set(a.buf, a.setor * 512);
        a.restantes--; a.setor++; a.pos = 0;
        if (a.restantes <= 0) { a.buf = null; a.status = 0x50; }
        this.picE.irr |= 0x40;
      }
    }

    // ---------------- teclado ----------------
    teclar(texto) { for (const t of teclasDe(texto)) this.teclas.push(t); if (this.status === 'aguardando') this.status = 'executando'; }
    // as teclas de teste chegam ao controlador uma de cada vez
    digitarTeclas() {
      if (!this.teclas.length) return;
      if (this.biosTeclado()) { while (this.teclas.length) this.kbd.buffer.push(this.teclas.shift()); return; }
      if (this.kbd.fila.length || this.kbd.saida !== null) return;
      const t = this.teclas.shift();
      if (t.shift) this.kbd.fila.push(0x2A);
      this.kbd.fila.push(t.scan, t.scan | 0x80);
      if (t.shift) this.kbd.fila.push(0xAA);
    }
    // a BIOS cuida do teclado enquanto o vetor 9 for o dela (modo real) e o modo protegido estiver desligado
    biosTeclado() {
      if (this.pe) return false;
      const ip = this.lerFis16(9 * 4), cs = this.lerFis16(9 * 4 + 2);
      return (cs << 4) + ip === BIOS_STUB + 9 * 4;
    }

    // ---------------- BIOS e DOS (em JavaScript) ----------------
    instalarBIOS() {
      for (let i = 0; i < 256; i++) {
        this.mem[BIOS_STUB + i * 4] = 0xCF;   // IRET, caso alguém salte para cá sem passar pelo simulador
        this.mem[i * 4] = (0xE000 + i * 4) & 0xFF; this.mem[i * 4 + 1] = ((0xE000 + i * 4) >> 8) & 0xFF;
        this.mem[i * 4 + 2] = 0x00; this.mem[i * 4 + 3] = 0xF0;
      }
      // área de dados da BIOS
      const w16 = (a, v) => { this.mem[a] = v & 0xFF; this.mem[a + 1] = (v >> 8) & 0xFF; };
      w16(0x400, 0x3F8); w16(0x410, 0x0021); w16(0x413, 639); this.mem[0x449] = 3; w16(0x44A, 80); w16(0x463, 0x3D4); this.mem[0x484] = 24;
      // tela limpa
      for (let i = 0; i < 80 * 25; i++) { this.mem[0xB8000 + i * 2] = 0x20; this.mem[0xB8000 + i * 2 + 1] = 0x07; }
      this.picM.base = 0x08; this.picE.base = 0x70;
      this.picM.imr = 0xB8; this.picE.imr = 0x9F;
      this.a20 = false;
    }

    servicoBIOS(n) {
      // o vetor n foi chamado por INT (ou por IRQ); a pilha tem IP, CS, FLAGS
      const sp = this.getSP();
      const retIP = this.ler(SS, sp, 2), retCS = this.ler(SS, (sp + 2) & 0xFFFF, 2), retFlags = this.ler(SS, (sp + 4) & 0xFFFF, 2);
      let r;
      try { r = this.bios(n, retFlags); }
      catch (e) {
        // o programa terminou dentro do serviço: os registradores ficam como estavam no INT
        if (e instanceof Parada && e.status === 'terminado') { this.setSP((sp + 6) & 0xFFFF); this.carregarSeg(CS, retCS); this.eip = retIP; }
        throw e;
      }
      if (r === 'espera') { this.status = this.opts.esperarTeclado ? 'aguardando' : 'aguardando'; return this.status; }
      if (this.status !== 'executando') return this.status;
      // IRET, mas com os flags que a BIOS quer devolver (CF, ZF)
      this.setSP((sp + 6) & 0xFFFF);
      this.carregarSeg(CS, retCS);
      this.eip = retIP;
      const manter = CF | ZF;
      const novos = this.biosFlags !== undefined ? this.biosFlags : retFlags;
      this.flags = ((this.flags & 0xFFFF0000) | ((retFlags & ~manter) | (novos & manter) | 2)) >>> 0;
      this.biosFlags = undefined;
      return this.status;
    }
    biosCF(on, retFlags) { this.biosFlags = on ? retFlags | CF : retFlags & ~CF; }

    bios(n, retFlags) {
      const ah = this.get8(4), al = this.get8(0);
      switch (n) {
        case 0x08: {   // IRQ 0
          this.biosTicks = (this.biosTicks + 1) >>> 0;
          const t = this.lerFis32(0x46C) + 1; this.escFis32(0x46C, t >>> 0);
          this.picM.escrever(0x20, 0x20);
          return;
        }
        case 0x09: {   // IRQ 1: a BIOS lê o scan code e guarda a tecla
          const sc = this.entrada8(0x60);
          if (sc === 0x2A || sc === 0x36) this.kbd.shift = true;
          else if (sc === 0xAA || sc === 0xB6) this.kbd.shift = false;
          else if (!(sc & 0x80)) this.kbd.buffer.push({ ascii: 0, scan: sc });
          this.picM.escrever(0x20, 0x20);
          return;
        }
        case 0x10: return this.biosVideo(ah, al);
        case 0x11: this.set16(0, 0x0021); return;
        case 0x12: this.set16(0, 639); return;
        case 0x13: return this.biosDisco(ah, al, retFlags);
        case 0x14: this.set8(4, 0x80); return;
        case 0x15: return this.biosSistema(ah, al, retFlags);
        case 0x16: return this.biosTecladoInt(ah, retFlags);
        case 0x17: this.set8(4, 0x80); return;
        case 0x18: case 0x19: throw new Parada('terminado', 'INT ' + hex(n, 2) + 'h: o programa pediu para reiniciar a máquina.');
        case 0x1A: if (ah === 0) { const t = this.lerFis32(0x46C); this.set16(2, t & 0xFFFF); this.set16(1, t >>> 16); this.set8(0, 0); } return;
        case 0x20: throw new Parada('terminado', 'Fim do programa (INT 20h).');
        case 0x21: return this.dos(ah, al);
        case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x76: case 0x77:
          this.picE.escrever(0xA0, 0x20); this.picM.escrever(0x20, 0x20); return;
        case 0x0A: case 0x0B: case 0x0C: case 0x0D: case 0x0E: case 0x0F:
          this.picM.escrever(0x20, 0x20); return;
      }
      if (n < 0x08 || (n >= 0x22 && n < 0x70) || n > 0x77) {
        if (n <= 7) {
          const nomes = ['divisão por zero', 'passo a passo', 'NMI', 'ponto de parada (INT3)', 'estouro (INTO)', 'BOUND fora da faixa / Print Screen', 'opcode inválido', 'coprocessador ausente'];
          throw new Parada('erro', 'Interrupção ' + n + ' (' + nomes[n] + ') chegou à BIOS: no modo real ninguém tratou ' + (n === 0 ? 'a divisão inválida.' : n === 6 ? 'a instrução inválida. O código saltou para dados ou usou uma instrução que não existe neste processador?' : 'o evento.'));
        }
      }
    }

    biosVideo(ah, al) {
      const pos = () => this.tela.cursor;
      const setPos = (p) => { this.tela.cursor = p; const lin = Math.floor(p / 80), col = p % 80; this.mem[0x450] = col; this.mem[0x451] = lin; this.telaMudou = true; };
      switch (ah) {
        case 0x00: { for (let i = 0; i < 80 * 25; i++) { this.mem[0xB8000 + i * 2] = 0x20; this.mem[0xB8000 + i * 2 + 1] = 0x07; } setPos(0); this.tela.modo = al & 0x7F; this.mem[0x449] = this.tela.modo; return; }
        case 0x01: return;
        case 0x02: setPos(Math.min(24, this.get8(6)) * 80 + Math.min(79, this.get8(2))); return;
        case 0x03: { const p = pos(); this.set8(6, Math.floor(p / 80)); this.set8(2, p % 80); this.set16(1, 0x0607); return; }
        case 0x05: return;
        case 0x06: case 0x07: {
          const n = al, attr = this.get8(7), l0 = this.get8(5), c0 = this.get8(1), l1 = Math.min(24, this.get8(6)), c1 = Math.min(79, this.get8(2));
          const cel = (l, c) => 0xB8000 + (l * 80 + c) * 2;
          const altura = l1 - l0 + 1;
          for (let l = 0; l < altura; l++) {
            const dst = ah === 6 ? l0 + l : l1 - l;
            const src = ah === 6 ? dst + n : dst - n;
            for (let c = c0; c <= c1; c++) {
              if (n === 0 || n >= altura || src < l0 || src > l1) { this.mem[cel(dst, c)] = 0x20; this.mem[cel(dst, c) + 1] = attr; }
              else { this.mem[cel(dst, c)] = this.mem[cel(src, c)]; this.mem[cel(dst, c) + 1] = this.mem[cel(src, c) + 1]; }
            }
          }
          this.telaMudou = true;
          return;
        }
        case 0x08: { const p = pos() * 2; this.set8(0, this.mem[0xB8000 + p]); this.set8(4, this.mem[0xB8000 + p + 1]); return; }
        case 0x09: case 0x0A: {
          let p = pos();
          for (let i = 0; i < Math.max(1, this.get16(1)) && p < 2000; i++, p++) { this.mem[0xB8000 + p * 2] = al; if (ah === 9) this.mem[0xB8000 + p * 2 + 1] = this.get8(3); }
          this.telaMudou = true;
          return;
        }
        case 0x0E: this.teletipo(al); return;
        case 0x0F: this.set8(0, this.tela.modo); this.set8(4, 80); this.set8(7, 0); return;
        case 0x12: this.set8(7, 0); this.set8(3, 3); return;
        case 0x13: {
          let off = this.get16(5);
          for (let i = 0; i < this.get16(1); i++) this.teletipo(this.ler(ES, off++ & 0xFFFF, 1));
          return;
        }
      }
    }
    teletipo(c) {
      let p = this.tela.cursor;
      this.escreverSaida(c === 13 ? '' : String.fromCharCode(c));
      if (c === 13) p -= p % 80;
      else if (c === 10) p += 80;
      else if (c === 8) { if (p % 80) p--; }
      else if (c === 7) { /* bipe */ }
      else { this.mem[0xB8000 + p * 2] = c; p++; }
      if (p >= 2000) {
        this.mem.copyWithin(0xB8000, 0xB8000 + 160, 0xB8000 + 4000);
        for (let i = 0; i < 80; i++) { this.mem[0xB8000 + 3840 + i * 2] = 0x20; this.mem[0xB8000 + 3841 + i * 2] = 0x07; }
        p -= 80;
      }
      this.tela.cursor = p;
      this.mem[0x450] = p % 80; this.mem[0x451] = Math.floor(p / 80);
      this.telaMudou = true;
    }
    biosDisco(ah, al, retFlags) {
      const dl = this.get8(2);
      const geo = { cab: 16, spt: 63 };
      const ok = () => { this.set8(4, 0); this.biosCF(false, retFlags); };
      const falha = (cod) => { this.set8(4, cod); this.biosCF(true, retFlags); };
      if (dl !== 0x80 && ah !== 0x00) return falha(0x01);
      switch (ah) {
        case 0x00: return ok();
        case 0x02: case 0x03: {
          const cx = this.get16(1);
          const cil = ((cx >> 8) & 0xFF) | ((cx & 0xC0) << 2), setor = cx & 0x3F, cab = this.get8(6);
          if (!setor || setor > geo.spt) return falha(0x04);
          const lba = (cil * geo.cab + cab) * geo.spt + setor - 1;
          return this.transferirDisco(lba, al, ES, this.get16(3), ah === 3, retFlags);
        }
        case 0x08: {
          const total = this.disco.length / 512;
          const cils = Math.max(1, Math.floor(total / (geo.cab * geo.spt)));
          this.set8(6, geo.cab - 1); this.set16(1, (((cils - 1) & 0xFF) << 8) | (((cils - 1) >> 2) & 0xC0) | geo.spt); this.set8(2, 1);
          return ok();
        }
        case 0x15: this.set8(4, 3); this.biosCF(false, retFlags); return;
        case 0x41: if (this.get16(3) === 0x55AA) { this.set16(3, 0xAA55); this.set8(4, 0x21); this.set16(1, 1); this.biosCF(false, retFlags); return; } return falha(1);
        case 0x42: case 0x43: {
          const off = this.get16(6);
          const n = this.ler(DS, off + 2, 2), boff = this.ler(DS, off + 4, 2), bseg = this.ler(DS, off + 6, 2), lba = this.ler(DS, off + 8, 4);
          const salvo = this.seg[ES].sel;
          this.carregarSeg(ES, bseg);
          this.transferirDisco(lba, n, ES, boff, ah === 0x43, retFlags);
          this.carregarSeg(ES, salvo);
          return;
        }
      }
      return falha(0x01);
    }
    transferirDisco(lba, n, s, off, escrita, retFlags) {
      if ((lba + n) * 512 > this.disco.length) { this.set8(4, 0x04); this.biosCF(true, retFlags); return; }
      for (let i = 0; i < n * 512; i++) {
        const lin = (this.seg[s].base + ((off + i) & 0xFFFF)) >>> 0;
        if (escrita) this.disco[lba * 512 + i] = this.lerLin(lin, 1, false);
        else this.escLin(lin, 1, this.disco[lba * 512 + i], false);
      }
      this.set8(0, n); this.set8(4, 0); this.biosCF(false, retFlags);
      this.nota('dispositivo', 'BIOS: ' + (escrita ? 'gravou ' : 'leu ') + n + ' setor(es) a partir do setor LBA ' + lba + (escrita ? '' : ' para ' + hex(this.seg[s].sel, 4) + ':' + hex(off, 4)));
    }
    biosSistema(ah, al, retFlags) {
      const ax = this.get16(0);
      if (ax === 0x2400) { this.mudarA20(false, 'INT 15h, AX=2400h'); this.set8(4, 0); this.biosCF(false, retFlags); return; }
      if (ax === 0x2401) { this.mudarA20(true, 'INT 15h, AX=2401h'); this.set8(4, 0); this.biosCF(false, retFlags); return; }
      if (ax === 0x2402) { this.set8(0, this.a20 ? 1 : 0); this.set8(4, 0); this.biosCF(false, retFlags); return; }
      if (ax === 0x2403) { this.set16(3, 3); this.set8(4, 0); this.biosCF(false, retFlags); return; }
      if (ah === 0x88) { this.set16(0, Math.min(0xFFFF, (this.mem.length - 0x100000) / 1024)); this.biosCF(false, retFlags); return; }
      if (ax === 0xE801) {
        const kb = (this.mem.length - 0x100000) / 1024;
        const ate16 = Math.min(kb, 15 * 1024), acima = Math.max(0, (kb - 15 * 1024) / 64);
        this.set16(0, ate16); this.set16(3, acima); this.set16(1, ate16); this.set16(2, acima); this.biosCF(false, retFlags); return;
      }
      if (ax === 0xE820 && this.r[2] === 0x534D4150) {
        const mapa = [[0, 0x9FC00, 1], [0x9FC00, 0x400, 2], [0xF0000, 0x10000, 2], [0x100000, this.mem.length - 0x100000, 1]];
        const i = this.r[3];
        if (i >= mapa.length) { this.biosCF(true, retFlags); return; }
        const [base, tam, tipo] = mapa[i];
        const di = this.get16(7);
        this.escrever(ES, di, 4, base); this.escrever(ES, di + 4, 4, 0); this.escrever(ES, di + 8, 4, tam); this.escrever(ES, di + 12, 4, 0); this.escrever(ES, di + 16, 4, tipo);
        this.r[0] = 0x534D4150; this.r[1] = 20; this.r[3] = i + 1 < mapa.length ? i + 1 : 0;
        this.biosCF(false, retFlags);
        return;
      }
      if (ah === 0x86) { this.biosCF(false, retFlags); return; }
      this.set8(4, 0x86); this.biosCF(true, retFlags);
    }
    biosTecladoInt(ah, retFlags) {
      const b = this.kbd.buffer;
      if (!b.length && this.teclas.length) { while (this.teclas.length) b.push(this.teclas.shift()); }
      switch (ah) {
        case 0x00: case 0x10: {
          if (!b.length) {
            if (this.opts.esperarTeclado) return 'espera';
            throw new Parada('terminado', 'O programa esperou uma tecla (INT 16h) e não há mais teclas no teste.');
          }
          const t = b.shift();
          this.set8(0, t.ascii); this.set8(4, t.scan);
          return;
        }
        case 0x01: case 0x11: {
          const zf = !b.length;
          if (!zf) { this.set8(0, b[0].ascii); this.set8(4, b[0].scan); }
          this.biosFlags = zf ? retFlags | ZF : retFlags & ~ZF;
          return;
        }
        case 0x02: this.set8(0, this.kbd.shift ? 2 : 0); return;
      }
    }

    // DOS mínimo, para programas .COM
    dos(ah, al) {
      const b = this.kbd.buffer;
      const lerTecla = () => {
        if (!b.length && this.teclas.length) while (this.teclas.length) b.push(this.teclas.shift());
        if (!b.length) { if (this.opts.esperarTeclado) return null; throw new Parada('terminado', 'O programa esperou uma tecla (INT 21h) e não há mais teclas no teste.'); }
        return b.shift();
      };
      switch (ah) {
        case 0x01: { const t = lerTecla(); if (!t) return 'espera'; this.set8(0, t.ascii); this.teletipo(t.ascii); return; }
        case 0x02: this.teletipo(this.get8(2)); return;
        case 0x06: if (this.get8(2) !== 0xFF) { this.teletipo(this.get8(2)); return; } if (!b.length && !this.teclas.length) { this.biosFlags = this.ler(SS, (this.getSP() + 4) & 0xFFFF, 2) | ZF; this.set8(0, 0); return; } { const t = lerTecla(); this.set8(0, t.ascii); this.biosFlags = this.ler(SS, (this.getSP() + 4) & 0xFFFF, 2) & ~ZF; } return;
        case 0x07: case 0x08: { const t = lerTecla(); if (!t) return 'espera'; this.set8(0, t.ascii); return; }
        case 0x09: {
          let off = this.get16(2);
          for (let i = 0; i < 4096; i++) { const c = this.ler(DS, off & 0xFFFF, 1); if (c === 0x24) return; this.teletipo(c); off++; }
          throw new Parada('erro', 'INT 21h, AH=09h: a string não terminou com "$" em 4 KB. Faltou o $ no fim?');
        }
        case 0x25: { const v = al; this.escFis16(v * 4, this.get16(2)); this.escFis16(v * 4 + 2, this.seg[DS].sel); return; }
        case 0x30: this.set16(0, 0x0005); this.set16(3, 0); return;
        case 0x35: { const v = al; this.set16(3, this.lerFis16(v * 4)); this.carregarSeg(ES, this.lerFis16(v * 4 + 2)); return; }
        case 0x4C: this.codigoSaida = al; throw new Parada('terminado', 'Fim do programa (INT 21h, AH=4Ch), código ' + al + '.');
        case 0x00: throw new Parada('terminado', 'Fim do programa (INT 21h, AH=00h).');
      }
      throw new Parada('erro', 'INT 21h, AH=' + hex(ah, 2) + 'h: este DOS mínimo da máquina 386 só tem as funções 01h, 02h, 06h, 07h, 08h, 09h, 25h, 30h, 35h e 4Ch.');
    }

    // ---------------- carregar programas ----------------
    // modo 'com': .COM no DOS; 'boot': setor de boot no disco; 'pm32': já no modo protegido de 32 bits, código em org
    carregar(bytes, opts) {
      opts = opts || {};
      this.reset();
      const modo = opts.modo || 'com';
      this.modo = modo;
      this.instalarBIOS();
      if (opts.disco) { this.disco = new Uint8Array(Math.max(opts.disco.length, 512 * 2880)); this.disco.set(opts.disco); }
      if (modo === 'com') {
        const seg = 0x0700;
        const base = seg << 4;
        this.mem[base] = 0xCD; this.mem[base + 1] = 0x20;   // INT 20h no início do PSP
        this.mem[base + 2] = 0x00; this.mem[base + 3] = 0xA0;
        const cmd = opts.linhaComando || '';
        this.mem[base + 0x80] = cmd.length; for (let i = 0; i < cmd.length; i++) this.mem[base + 0x81 + i] = cmd.charCodeAt(i); this.mem[base + 0x81 + cmd.length] = 13;
        if (bytes.length > 0xFF00) throw new Error('programa .COM grande demais');
        this.mem.set(bytes, base + 0x100);
        for (let s = 0; s < 6; s++) this.carregarSeg(s, seg);
        this.r[4] = 0xFFFE; this.mem[base + 0xFFFE] = 0; this.mem[base + 0xFFFF] = 0;
        this.eip = 0x100;
        this.flags = 0x202;
      } else if (modo === 'boot') {
        if (!opts.disco) { this.disco = new Uint8Array(512 * 2880); this.disco.set(bytes); }
        this.mem.set(this.disco.subarray(0, 512), 0x7C00);
        for (let s = 0; s < 6; s++) this.carregarSeg(s, 0);
        this.r[4] = 0x7C00;
        this.r[2] = 0x80;
        this.eip = 0x7C00;
        this.flags = 0x202;
        if (this.mem[0x7DFE] !== 0x55 || this.mem[0x7DFF] !== 0xAA) this.nota('aviso', 'O setor de boot não termina com a assinatura 55h AAh (dw 0xAA55 nos bytes 510 e 511). Uma BIOS de verdade não daria boot por este disco.');
      } else if (modo === 'pm32') {
        this.prepararPM32(bytes, opts);
      } else throw new Error('modo desconhecido: ' + modo);
      this.status = 'executando';
    }

    // Ambiente "pm32": o que um carregador como o GRUB deixa pronto. GDT plana em 0x500
    // (08h = código anel 0, 10h = dados anel 0, 1Bh = código anel 3, 23h = dados anel 3),
    // A20 ligada, interrupções desligadas, IDT que só registra exceções.
    prepararPM32(bytes, opts) {
      const org = opts.org !== undefined ? opts.org : 0x100000;
      this.harness = { idtNativa: true };
      this.a20 = true;
      const gdt = [[0, 0], [0x0000FFFF, 0x00CF9A00], [0x0000FFFF, 0x00CF9200], [0x0000FFFF, 0x00CFFA00], [0x0000FFFF, 0x00CFF200]];
      gdt.forEach(([lo, hi], i) => { this.escFis32(0x500 + i * 8, lo); this.escFis32(0x504 + i * 8, hi); });
      this.gdtr = { base: 0x500, limit: gdt.length * 8 - 1 };
      // IDT do ambiente: cada vetor leva a AMBIENTE_EXC + 8*n, onde o simulador relata a exceção
      const idt = 0x800;
      for (let v = 0; v < 256; v++) {
        const alvo = AMBIENTE_EXC + v * 8;
        this.escFis32(idt + v * 8, (0x08 << 16) | (alvo & 0xFFFF));
        this.escFis32(idt + v * 8 + 4, (alvo & 0xFFFF0000) | 0x8E00);
      }
      this.idtr = { base: idt, limit: 256 * 8 - 1 };
      this.harness.idtBase = idt;
      this.cr0 = 0x11;
      this.cpl = 0;
      this.mem.set(bytes, org);
      const ds = { s: true, tipo: 0x13, dpl: 0, big: true, presente: true, base: 0, limit: 0xFFFFFFFF };
      for (let s = 0; s < 6; s++) {
        const cod = s === CS;
        this.defSeg(s, { sel: cod ? 0x08 : 0x10, base: 0, limit: 0xFFFFFFFF, tipo: cod ? 0x1B : 0x13, dpl: 0, big: true, presente: true, valido: true, s: true });
      }
      void ds;
      this.r[4] = opts.pilha || 0x90000;
      this.eip = org;
      this.flags = 0x2;
      this.picM.base = 0x20; this.picE.base = 0x28;
      this.picM.imr = 0xFF; this.picE.imr = 0xFF;
    }

    // ---------------- para a interface ----------------
    textoTela() {
      const linhas = [];
      for (let l = 0; l < 25; l++) {
        let s = '';
        for (let c = 0; c < 80; c++) { const ch = this.mem[0xB8000 + (l * 80 + c) * 2]; s += ch >= 32 && ch < 127 ? String.fromCharCode(ch) : ch === 0 ? ' ' : String.fromCharCode(ch); }
        linhas.push(s.replace(/\s+$/, ''));
      }
      return linhas.join('\n').replace(/\n+$/, '');
    }
    descritoresGDT(max) {
      const r = [];
      const n = Math.min(max || 16, Math.floor((this.gdtr.limit + 1) / 8));
      for (let i = 0; i < n; i++) {
        const end = this.gdtr.base + i * 8;
        let lo, hi;
        try { lo = this.lerLin(end, 4, false); hi = this.lerLin(end + 4, 4, false); } catch (e) { break; }
        r.push(Object.assign({ indice: i, seletor: i * 8, lo, hi }, decodificarDescritor(lo, hi)));
      }
      return r;
    }
  }

  function decodificarDescritor(lo, hi) {
    const base = ((lo >>> 16) | ((hi & 0xFF) << 16) | (hi & 0xFF000000)) >>> 0;
    let limit = (lo & 0xFFFF) | (hi & 0x000F0000);
    const g = !!(hi & 0x00800000);
    if (g) limit = ((limit << 12) | 0xFFF) >>> 0;
    const acesso = (hi >>> 8) & 0xFF;
    const s = !!(acesso & 0x10);
    return { base, limit, g, big: !!(hi & 0x00400000), acesso, presente: !!(acesso & 0x80), dpl: (acesso >> 5) & 3, s, tipo: s ? (acesso & 0x1F) : (acesso & 0x0F) };
  }
  function nomeTipo(d) {
    if (!d.s) return ({ 1: 'TSS de 16 bits', 2: 'LDT', 3: 'TSS de 16 bits ocupado', 4: 'porta de chamada de 16 bits', 5: 'porta de tarefa', 6: 'porta de interrupção de 16 bits', 7: 'porta de exceção de 16 bits', 9: 'TSS de 32 bits', 0xB: 'TSS de 32 bits ocupado', 0xC: 'porta de chamada de 32 bits', 0xE: 'porta de interrupção de 32 bits', 0xF: 'porta de exceção de 32 bits' })[d.tipo] || 'descritor de sistema reservado (tipo ' + d.tipo + ')';
    if (d.tipo & 8) return 'código' + (d.tipo & 2 ? ' com leitura' : ' só de execução') + (d.tipo & 4 ? ', conforme' : '');
    return 'dados' + (d.tipo & 2 ? ' com escrita' : ' só de leitura') + (d.tipo & 4 ? ', expand-down' : '');
  }

  // roda um programa do jeito que os exercícios rodam
  function rodar(bytes, opts) {
    const m = new Maquina(opts);
    m.carregar(bytes, opts);
    if (opts && opts.setup) for (const k of Object.keys(opts.setup)) { try { m.escreverRegistrador(k, opts.setup[k]); } catch (e) { /* variável: tratada por quem chama */ } }
    if (opts && opts.entrada) m.teclar(opts.entrada);
    m.executar((opts && opts.maxPassos) || 5000000);
    return m;
  }

  return { Maquina, Excecao, rodar, decodificarDescritor, nomeTipo, teclasDe, EXCECOES, hex, CF, PF, AF, ZF, SF, TF, IF, DF, OF, NT, VM, NOMES32, NOMES_SEG, AMBIENTE_EXC };
});
