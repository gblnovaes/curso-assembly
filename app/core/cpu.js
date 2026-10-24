/*
 * Máquina 8086 do Curso Assembly 8086: CPU, memória de 1 MB, tela de texto em
 * B800h, teclado, PIC/timer simplificados e serviços do DOS (INT 21h) e da
 * BIOS (INT 10h, 16h, 1Ah) implementados em JavaScript.
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const mod = factory(node ? require('./asm.js') : root.Asm8086, node ? require('./fonte8x8.js') : root.Fonte8x8, node ? require('./decod.js') : root.Decod8086);
  if (node) module.exports = mod;
  else root.Machine8086 = mod;
})(typeof self !== 'undefined' ? self : this, function (Asm, FONTE, Decod) {
  'use strict';

  const CF = 0x0001, PF = 0x0004, AF = 0x0010, ZF = 0x0040, SF = 0x0080, TF = 0x0100, IF = 0x0200, DF = 0x0400, OF = 0x0800;
  const FLAG_BITS = { CF, PF, AF, ZF, SF, TF, IF, DF, OF };
  const R16 = { AX: 0, CX: 1, DX: 2, BX: 3, SP: 4, BP: 5, SI: 6, DI: 7 };
  const SR = { ES: 0, CS: 1, SS: 2, DS: 3 };
  const BIOS_SEG = 0xF000;
  const STUB_BASE = 0xE000;   // F000:E000 + n*4 = código "da BIOS" para a interrupção n
  const VIDEO = 0xB8000;
  const VGA = 0xA0000;
  const IDLE_OFF = 0xE800;    // F000:E800 = "prompt do DOS" depois de um TSR
  const DOS_SEG = 0x0060;     // dados e pilha do "DOS" (InDOS, pilha do prompt)
  const ENV_SEG = 0x0680;     // bloco de ambiente do programa
  const MCB_INICIO = 0x067F;  // primeiro MCB da cadeia
  const MEM_TOPO = 0xA000;    // 640 KB
  const PIT_HZ = 1193182;     // relógio do 8253: 1,19 MHz
  const DISQUETE = { trilhas: 80, cabecas: 2, setores: 18, bytes: 1474560 };   // 3½" de 1,44 MB
  const TABELA_DISQUETE = 0xEFC7;  // F000:EFC7 = tabela de parâmetros do disquete (INT 1Eh)
  const ERROS_DOS = { 1: 'função inválida', 2: 'arquivo não encontrado', 3: 'caminho não encontrado', 4: 'handles esgotados', 5: 'acesso negado', 6: 'handle inválido', 7: 'blocos de memória destruídos', 8: 'memória insuficiente', 9: 'endereço de bloco inválido', 12: 'código de acesso inválido', 18: 'não há mais arquivos', 25: 'erro de posicionamento' };

  // Paleta padrão da VGA (256 cores, componentes de 0 a 63)
  function paletaPadrao() {
    const p = new Uint8Array(768);
    const ega = ['000', '00a', '0a0', '0aa', 'a00', 'a0a', 'a50', 'aaa', '555', '55f', '5f5', '5ff', 'f55', 'f5f', 'ff5', 'fff'];
    const v = { 0: 0, 5: 21, a: 42, f: 63 };
    ega.forEach((c, i) => { for (let k = 0; k < 3; k++) p[i * 3 + k] = v[c[k]]; });
    const cinza = [0, 5, 8, 11, 14, 17, 20, 24, 28, 32, 36, 40, 45, 50, 56, 63];
    cinza.forEach((g, i) => { p[(16 + i) * 3] = p[(16 + i) * 3 + 1] = p[(16 + i) * 3 + 2] = g; });
    let n = 32;
    for (const [alto, minimos] of [[63, [0, 31, 45]], [28, [0, 14, 20]], [16, [0, 8, 11]]]) {
      for (const lo of minimos) {
        const passo = [0, 1, 2, 3, 4].map(k => Math.round(lo + (alto - lo) * k / 4));
        // 24 matizes: azul -> magenta -> vermelho -> amarelo -> verde -> ciano -> azul
        const seq = [];
        for (let k = 0; k < 4; k++) seq.push([passo[k], lo, alto]);
        for (let k = 4; k > 0; k--) seq.push([alto, lo, passo[k]]);
        for (let k = 0; k < 4; k++) seq.push([alto, passo[k], lo]);
        for (let k = 4; k > 0; k--) seq.push([passo[k], alto, lo]);
        for (let k = 0; k < 4; k++) seq.push([lo, alto, passo[k]]);
        for (let k = 4; k > 0; k--) seq.push([lo, passo[k], alto]);
        for (const [r, g, b] of seq) { p[n * 3] = r; p[n * 3 + 1] = g; p[n * 3 + 2] = b; n++; }
      }
    }
    return p;
  }
  const PALETA_PADRAO = paletaPadrao();
  const PARITY = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { let b = i, c = 0; while (b) { c += b & 1; b >>= 1; } PARITY[i] = (c & 1) ? 0 : 1; }

  const hex = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');

  class Machine {
    constructor(opts) {
      this.opts = Object.assign({ timer: false, timerInterval: 3000, mhz: 4.77 }, opts || {});
      this.mem = new Uint8Array(0x100000);
      this.tocado = new Uint8Array(0x100000);   // 1 = byte escrito durante a execução (pode virar código)
      this.mhz = this.opts.mhz;
      this.timerCiclos = false;                 // true: IRQ 0 pelo tempo (ciclos), como num PC de verdade
      this.r = new Uint16Array(8);
      this.s = new Uint16Array(4);
      this.ip = 0;
      this.flags = 0xF202;
      this.keys = [];
      this.onBeep = null;
      this.onSound = null;
      this.onOutput = null;
      this.prog = null;
      this.disco = this.opts.disco || new Map();   // arquivos do "disco C:", sobrevivem ao reset
      this.reset();
    }

    // ---------------- registradores ----------------
    get AX() { return this.r[0]; } set AX(v) { this.r[0] = v; }
    get CX() { return this.r[1]; } set CX(v) { this.r[1] = v; }
    get DX() { return this.r[2]; } set DX(v) { this.r[2] = v; }
    get BX() { return this.r[3]; } set BX(v) { this.r[3] = v; }
    get SP() { return this.r[4]; } set SP(v) { this.r[4] = v; }
    get BP() { return this.r[5]; } set BP(v) { this.r[5] = v; }
    get SI() { return this.r[6]; } set SI(v) { this.r[6] = v; }
    get DI() { return this.r[7]; } set DI(v) { this.r[7] = v; }
    get ES() { return this.s[0]; } set ES(v) { this.s[0] = v; }
    get CS() { return this.s[1]; } set CS(v) { this.s[1] = v; }
    get SS() { return this.s[2]; } set SS(v) { this.s[2] = v; }
    get DS() { return this.s[3]; } set DS(v) { this.s[3] = v; }
    get AL() { return this.r[0] & 0xFF; } set AL(v) { this.r[0] = (this.r[0] & 0xFF00) | (v & 0xFF); }
    get AH() { return this.r[0] >> 8; } set AH(v) { this.r[0] = (this.r[0] & 0xFF) | ((v & 0xFF) << 8); }
    get BL() { return this.r[3] & 0xFF; } get BH() { return this.r[3] >> 8; }
    get CL() { return this.r[1] & 0xFF; } get CH() { return this.r[1] >> 8; }
    get DL() { return this.r[2] & 0xFF; } get DH() { return this.r[2] >> 8; }
    getR8(c) { return c < 4 ? this.r[c] & 0xFF : this.r[c - 4] >> 8; }
    setR8(c, v) {
      v &= 0xFF;
      if (c < 4) this.r[c] = (this.r[c] & 0xFF00) | v;
      else this.r[c - 4] = (this.r[c - 4] & 0x00FF) | (v << 8);
    }
    getReg(name) {
      name = name.toUpperCase();
      if (R16[name] !== undefined) return this.r[R16[name]];
      if (SR[name] !== undefined) return this.s[SR[name]];
      const i8 = Asm.REG8.indexOf(name);
      if (i8 >= 0) return this.getR8(i8);
      if (name === 'IP') return this.ip;
      if (name === 'FLAGS') return this.flags;
      if (FLAG_BITS[name]) return (this.flags & FLAG_BITS[name]) ? 1 : 0;
      throw new Error('Registrador desconhecido: ' + name);
    }
    setReg(name, v) {
      name = name.toUpperCase();
      if (R16[name] !== undefined) { this.r[R16[name]] = v; return; }
      if (SR[name] !== undefined) { this.s[SR[name]] = v; return; }
      const i8 = Asm.REG8.indexOf(name);
      if (i8 >= 0) { this.setR8(i8, v); return; }
      if (name === 'IP') { this.ip = v & 0xFFFF; return; }
      if (name === 'FLAGS') { this.flags = (v & 0x0FD5) | 0xF002; return; }
      if (FLAG_BITS[name]) { this.setFlag(FLAG_BITS[name], !!v); return; }
      throw new Error('Registrador desconhecido: ' + name);
    }
    flag(f) { return (this.flags & f) !== 0; }
    setFlag(f, on) { if (on) this.flags |= f; else this.flags &= ~f; }

    // ---------------- memória ----------------
    rb(seg, off) { return this.mem[((seg << 4) + (off & 0xFFFF)) & 0xFFFFF]; }
    wb(seg, off, v) {
      const a = ((seg << 4) + (off & 0xFFFF)) & 0xFFFFF;
      if (a >= 0xF0000) return; // ROM da BIOS
      this.mem[a] = v & 0xFF;
      this.tocado[a] = 1;
      if (a >= VIDEO && a < VIDEO + 4000) { this.screenDirty = true; this.escreveuVideo = true; }
      else if (a >= VGA && a < VGA + 64000) this.gfxDirty = true;
    }
    rw(seg, off) {
      if (off & 1) this.extraCycles += 4;
      return this.rb(seg, off) | (this.rb(seg, (off + 1) & 0xFFFF) << 8);
    }
    ww(seg, off, v) {
      if (off & 1) this.extraCycles += 4;
      this.wb(seg, off, v & 0xFF);
      this.wb(seg, (off + 1) & 0xFFFF, (v >> 8) & 0xFF);
    }
    readPhys(addr, n) { const out = []; for (let i = 0; i < n; i++) out.push(this.mem[(addr + i) & 0xFFFFF]); return out; }
    push(v) { this.SP = (this.SP - 2) & 0xFFFF; this.ww(this.SS, this.SP, v); }
    pop() { const v = this.rw(this.SS, this.SP); this.SP = (this.SP + 2) & 0xFFFF; return v; }

    // ---------------- inicialização ----------------
    reset() {
      this.mem.fill(0);
      this.tocado.fill(0);
      this.decodCache = new Map();
      this.modo = 'dos';
      this.porOffset = null; this.segFonte = null;
      this.hltEspera = false;
      this.r.fill(0); this.s.fill(0);
      this.ip = 0; this.flags = 0xF202;
      this.halted = false; this.status = 'pronto';
      this.exitCode = null; this.haltReason = null;
      this.cycles = 0; this.steps = 0; this.extraCycles = 0;
      this.events = []; this.warned = new Set();
      this.output = '';
      this.keys = [];
      this.lineInput = null;
      this.waiting = null;
      this.pic = { isr: 0, imr: 0 };
      this.timerCount = 0;
      this.ports = { 0x61: 0, pit2: 0, lastScan: 0 };
      this.pit = [0, 1, 2].map(() => ({ reload: 65536, acesso: 3, lo: null, latch: null, lerAlto: false, modo: 3 }));
      this.timerInterval = this.opts.timerInterval;
      this.soundLog = [];
      this.kbdQueue = []; this.kbdLatch = null; this.lastKbdIrq = -1000;
      this.videoMode = 3;
      this.dac = new Uint8Array(PALETA_PADRAO);
      this.dacW = 0; this.dacR = 0; this.dacC = 0; this.dacRC = 0;
      this.gfxDirty = true;
      this.escreveuVideo = false; this.usou13h = false;
      this.fpuReset();
      this.handles = [{ tipo: 'con', modo: 0 }, { tipo: 'con', modo: 1 }, { tipo: 'con', modo: 1 }, { tipo: 'nul', modo: 2 }, { tipo: 'nul', modo: 1 }];
      this.conBuf = [];
      this.busca = null;
      this.residente = null; this.residenteAvisado = false;
      this.mcbs = [];
      this.instrMap = new Map();
      this.screenDirty = true;
      this.callDepth = 0;
      this.lastWrite = null;
      // IVT apontando para os "stubs" da BIOS (cada um é um IRET em F000:E000+n*4)
      for (let n = 0; n < 256; n++) {
        const off = STUB_BASE + n * 4;
        this.mem[n * 4] = off & 0xFF; this.mem[n * 4 + 1] = off >> 8;
        this.mem[n * 4 + 2] = BIOS_SEG & 0xFF; this.mem[n * 4 + 3] = BIOS_SEG >> 8;
        this.mem[BIOS_SEG * 16 + off] = 0xCF; // IRET
      }
      // BIOS Data Area
      this.mem[0x449] = 3;           // modo de vídeo
      this.mem[0x44A] = 80;          // colunas
      this.mem[0x413] = 0x80; this.mem[0x414] = 0x02; // 640 KB
      this.mem[0x410] = 0x23;        // equipamento: 1 drive de disquete, 8087, vídeo 80x25 colorido
      this.mem[0x463] = 0xD4; this.mem[0x464] = 0x03; // porta do CRTC (3D4h)
      this.mem[0x484] = 24;          // linhas da tela - 1
      // ROM: data da BIOS em F000:FFF5, byte de modelo em F000:FFFE (FCh = PC AT) e a tabela do disquete
      for (let i = 0; i < 8; i++) this.mem[0xFFFF5 + i] = '10/18/26'.charCodeAt(i);
      this.mem[0xFFFFE] = 0xFC;
      [0xAF, 0x02, 0x25, 0x02, 0x12, 0x1B, 0xFF, 0x6C, 0xF6, 0x0F, 0x08].forEach((b, i) => { this.mem[BIOS_SEG * 16 + TABELA_DISQUETE + i] = b; });
      this.setVec(0x1E, BIOS_SEG, TABELA_DISQUETE);
      this.mem[0x465] = 0x29;        // modo da CGA/VGA: bit 5 = atributo 80h pisca
      this.mem[0x460] = 0x07; this.mem[0x461] = 0x06; // formato do cursor (linhas 6 a 7)
      // fonte 8x8 na ROM: caracteres 0-127 em F000:FA6E (como na BIOS do PC), 128-255 apontados pela INT 1Fh
      for (let i = 0; i < 2048; i++) this.mem[(i < 1024 ? 0xFFA6E : 0xFF66E - 1024) + i] = FONTE[i];
      this.setVec(0x1F, BIOS_SEG, 0xF66E); this.setVec(0x43, BIOS_SEG, 0xFA6E);
      // "prompt do DOS" (usado depois de um TSR)
      this.instrMap.set(BIOS_SEG * 16 + IDLE_OFF, { line: 0, mn: 'DOSIDLE', ops: [], size: 0, bytes: [0xEB, 0xFE], seg: BIOS_SEG, off: IDLE_OFF, phys: BIOS_SEG * 16 + IDLE_OFF, cycles: { base: 10 }, text: 'C:\\> (DOS esperando comandos)', synthetic: true });
      this.clearScreen(0x07);
      this.setCursor(0, 0);
    }

    load(prog) {
      this.reset();
      this.prog = prog;
      if (!prog.ok) { this.halted = true; this.status = 'erro'; this.haltReason = 'O programa tem erros de montagem.'; return; }
      const psp = prog.pspSeg;
      // PSP: INT 20h no offset 0, linha de comando vazia
      this.mem[psp * 16] = 0xCD; this.mem[psp * 16 + 1] = 0x20;
      this.mem[psp * 16 + 2] = 0x00; this.mem[psp * 16 + 3] = 0xA0; // topo da memória A000h
      this.mem[psp * 16 + 0x80] = 0; this.mem[psp * 16 + 0x81] = 0x0D;
      this.mem[psp * 16 + 0x2C] = ENV_SEG & 0xFF; this.mem[psp * 16 + 0x2D] = ENV_SEG >> 8;
      this.mem[psp * 16 + 0x16] = 0x50; this.mem[psp * 16 + 0x17] = 0x00;   // PSP do pai (COMMAND.COM)
      this.mem[psp * 16 + 0x32] = 20; this.mem[psp * 16 + 0x34] = 0x18; this.mem[psp * 16 + 0x35] = 0; this.mem[psp * 16 + 0x36] = psp & 0xFF; this.mem[psp * 16 + 0x37] = psp >> 8;
      for (let i = 0; i < 20; i++) this.mem[psp * 16 + 0x18 + i] = i < 5 ? [1, 1, 1, 0, 2][i] : 0xFF;
      const amb = 'COMSPEC=C:\\COMMAND.COM\0PATH=C:\\DOS;C:\\TASM\0PROMPT=$P$G\0\0\u0001\0C:\\CURSO\\' + (prog.model === 'tiny' ? 'PROGRAMA.COM' : 'PROGRAMA.EXE') + '\0';
      for (let i = 0; i < amb.length; i++) this.mem[ENV_SEG * 16 + i] = amb.charCodeAt(i);
      this.mcbs = [{ seg: MCB_INICIO, size: psp - ENV_SEG - 1, dono: psp, nome: '' }, { seg: psp - 1, size: MEM_TOPO - psp, dono: psp, nome: 'PROGRAMA' }];
      this.gravarMCBs();
      this.dta = { seg: psp, off: 0x80 };
      this.instrMap.set(psp * 16, {
        line: 0, mn: 'INT', ops: [{ t: 'i', v: 0x20 }], size: 2, bytes: [0xCD, 0x20], seg: psp, off: 0,
        phys: psp * 16, cycles: { base: 51 }, intNo: 0x20, text: 'INT 20h  ; (PSP: fim do programa .COM)', synthetic: true
      });
      for (const blk of prog.image) for (let i = 0; i < blk.bytes.length; i++) this.mem[(blk.addr + i) & 0xFFFFF] = blk.bytes[i];
      for (const ins of prog.instrs) this.instrMap.set(ins.phys, ins);
      this.indexarFonte(prog);
      this.ES = psp; this.DS = psp;
      this.CS = prog.entry ? prog.entry.seg : psp;
      this.ip = prog.entry ? prog.entry.off : 0x100;
      this.SS = prog.stack.seg; this.SP = prog.stack.sp;
      if (prog.model === 'tiny') { this.SS = psp; this.SP = 0xFFFE; this.mem[psp * 16 + 0xFFFE] = 0; this.mem[psp * 16 + 0xFFFF] = 0; }
      this.initial = { sp: this.SP, ss: this.SS };
      this.snippet = prog.model === 'tiny' && !prog.explicitModel;
      this.status = 'pronto';
    }

    setLinhaComando(txt) {
      if (!this.prog || !this.prog.ok) return;
      const psp = this.prog.pspSeg * 16;
      const t = String(txt || '').slice(0, 126);
      const s = t && !t.startsWith(' ') ? ' ' + t : t;
      const b = Array.from(s.slice(0, 126), ch => Asm.cp437(ch));
      this.mem[psp + 0x80] = b.length;
      b.forEach((c, i) => { this.mem[psp + 0x81 + i] = c; });
      this.mem[psp + 0x81 + b.length] = 0x0D;
      // FCBs em 5Ch e 6Ch com os dois primeiros parâmetros (como o COMMAND.COM faz)
      const params = s.trim().split(/\s+/).filter(Boolean);
      [0x5C, 0x6C].forEach((o, k) => {
        this.mem[psp + o] = 0;
        const p = (params[k] || '').toUpperCase().replace(/^[A-Z]:/, '');
        const [n, e] = p.split('.');
        for (let i = 0; i < 8; i++) this.mem[psp + o + 1 + i] = (n && i < n.length) ? n.charCodeAt(i) : 0x20;
        for (let i = 0; i < 3; i++) this.mem[psp + o + 9 + i] = (e && i < e.length) ? e.charCodeAt(i) : 0x20;
      });
    }

    // ---------------- modo de boot: um PC sem DOS, com um disquete no drive A: ----------------
    // O programa montado vira a imagem de um disquete de 1,44 MB (cada segmento do fonte começa
    // num setor novo, na ordem em que aparece). A BIOS lê o setor 0 para 0000:7C00 e salta para lá.
    loadBoot(prog, disquete) {
      this.reset();
      this.prog = prog;
      if (!prog.ok) { this.halted = true; this.status = 'erro'; this.haltReason = 'O programa tem erros de montagem.'; return; }
      this.modo = 'boot';
      this.opts.timer = true;
      const img = disquete || prog.disquete || montarDisquete(prog);
      if (img.erro) { this.halt(img.erro, 'erro'); this.note('erro', img.erro); return; }
      this.disquete = img.dados; this.mapaDisquete = img.mapa;
      this.indexarFonte(prog);
      // as variáveis de cada segmento vão para onde o código dele rodar (veja relocarSimbolos)
      for (const sm of Object.values(prog.symbols)) if (sm.seg !== undefined && sm.segFonte === undefined) sm.segFonte = sm.chave !== undefined ? sm.chave : sm.seg;
      this.ultimoSegFonte = null; this.segFonte = new Map();
      this.printStr('BIOS do Curso Assembly 8086 - 640K OK\r\nIniciando pelo disquete A:...\r\n');
      this.output = '';
      this.bootDisquete();
      this.initial = { sp: this.SP, ss: this.SS };
      this.snippet = false;
      if (!this.halted) this.status = 'pronto';
    }
    bootDisquete() {
      this._redirected = true;
      const d = this.disquete;
      if (!d) { this.halt('INT 19h: não há disquete no drive A:.', 'erro'); return; }
      if (d[510] !== 0x55 || d[511] !== 0xAA) {
        this.printStr('Disco nao inicializavel. O setor 0 precisa terminar com 55h AAh.\r\n');
        this.halt('O setor 0 do disquete não termina com a assinatura 55h AAh: a BIOS não o considera um setor de boot.', 'erro');
        return;
      }
      for (let i = 0; i < 512; i++) { this.mem[0x7C00 + i] = d[i]; this.tocado[0x7C00 + i] = 1; }
      this.decodCache.clear();
      this.CS = 0; this.ip = 0x7C00;
      this.DS = 0; this.ES = 0; this.SS = 0x0030; this.SP = 0x0100;   // a pilha que a BIOS do IBM PC usa no boot
      this.AX = 0xAA55; this.BX = 0; this.CX = 0; this.DX = 0;   // DL = 0: drive de onde veio o boot
      this.SI = 0; this.DI = 0; this.BP = 0;
      this.flags = 0xF202;
      this.pic.isr = 0; this.callDepth = 0; this.hltEspera = false;
      this.mem[0x441] = 0;
    }

    // ---------------- eventos e avisos ----------------
    note(type, msg, key) {
      if (key) { if (this.warned.has(key)) return; this.warned.add(key); }
      this.events.push({ type, msg, step: this.steps, line: this.curLine });
    }
    halt(reason, status) {
      this.halted = true;
      this.status = status || 'terminado';
      this.haltReason = reason;
    }

    // ---------------- vídeo ----------------
    getCursor() { return { col: this.mem[0x450], row: this.mem[0x451] }; }
    setCursor(row, col) { this.mem[0x450] = col; this.mem[0x451] = row; }
    clearScreen(attr) {
      for (let i = 0; i < 2000; i++) { this.mem[VIDEO + i * 2] = 0x20; this.mem[VIDEO + i * 2 + 1] = attr; }
      this.screenDirty = true;
    }
    scrollUp(lines, attr, r1 = 0, c1 = 0, r2 = 24, c2 = 79) {
      const h = r2 - r1 + 1;
      if (lines === 0 || lines >= h) {
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { this.mem[VIDEO + (r * 80 + c) * 2] = 0x20; this.mem[VIDEO + (r * 80 + c) * 2 + 1] = attr; }
      } else {
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
          const src = r + lines;
          const d = VIDEO + (r * 80 + c) * 2;
          if (src <= r2) { this.mem[d] = this.mem[VIDEO + (src * 80 + c) * 2]; this.mem[d + 1] = this.mem[VIDEO + (src * 80 + c) * 2 + 1]; }
          else { this.mem[d] = 0x20; this.mem[d + 1] = attr; }
        }
      }
      this.screenDirty = true;
    }
    scrollDown(lines, attr, r1, c1, r2, c2) {
      const h = r2 - r1 + 1;
      if (lines === 0 || lines >= h) return this.scrollUp(0, attr, r1, c1, r2, c2);
      for (let r = r2; r >= r1; r--) for (let c = c1; c <= c2; c++) {
        const src = r - lines;
        const d = VIDEO + (r * 80 + c) * 2;
        if (src >= r1) { this.mem[d] = this.mem[VIDEO + (src * 80 + c) * 2]; this.mem[d + 1] = this.mem[VIDEO + (src * 80 + c) * 2 + 1]; }
        else { this.mem[d] = 0x20; this.mem[d + 1] = attr; }
      }
      this.screenDirty = true;
    }
    teletype(ch, attr, cor) {
      let { row, col } = this.getCursor();
      ch &= 0xFF;
      this.output += ch === 13 ? '\r' : ch === 10 ? '\n' : ch === 8 ? '\b' : ch === 7 ? '' : Asm.CP437[ch];
      if (this.onOutput) this.onOutput(ch);
      if (this.videoMode === 0x13) return this.teletypeGfx(ch, cor === undefined ? 7 : cor);
      switch (ch) {
        case 7: if (this.onBeep) this.onBeep(); return;
        case 8: if (col > 0) col--; break;
        case 9: col = (col + 8) & ~7; break;
        case 10: row++; break;
        case 13: col = 0; break;
        default: {
          const a = VIDEO + (row * 80 + col) * 2;
          this.mem[a] = ch;
          if (attr !== undefined) this.mem[a + 1] = attr;
          col++;
        }
      }
      if (col >= 80) { col = 0; row++; }
      if (row >= 25) { this.scrollUp(1, 0x07); row = 24; }
      this.setCursor(row, col);
      this.screenDirty = true;
    }
    // ---------------- modo 13h (320x200, 256 cores) ----------------
    setMode(al) {
      const modo = al & 0x7F, limpar = !(al & 0x80);
      if (modo === 0x13) {
        this.videoMode = 0x13; this.usou13h = true;
        this.mem[0x449] = 0x13; this.mem[0x44A] = 40;
        if (limpar) this.mem.fill(0, VGA, VGA + 65536);
        this.dac.set(PALETA_PADRAO);
        this.setCursor(0, 0); this.gfxDirty = true; this.screenDirty = true;
        return;
      }
      if (modo !== 3 && modo !== 2 && modo !== 7) this.note('aviso', 'Modo de vídeo ' + hex(modo, 2) + 'h não é emulado: o simulador tem o texto 80x25 (modo 3) e o gráfico 320x200 com 256 cores (modo 13h).', 'mode' + modo);
      this.videoMode = 3;
      this.mem[0x449] = 3; this.mem[0x44A] = 80;
      if (limpar) this.clearScreen(0x07);
      this.setCursor(0, 0); this.screenDirty = true;
    }
    pixel(x, y) { return this.mem[VGA + y * 320 + x]; }
    desenharChar(ch, col, row, cor, fundo) {
      if (col < 0 || col > 39 || row < 0 || row > 24) return;
      for (let l = 0; l < 8; l++) {
        const bits = FONTE[ch * 8 + l];
        const base = VGA + (row * 8 + l) * 320 + col * 8;
        for (let b = 0; b < 8; b++) {
          if (bits & (0x80 >> b)) this.mem[base + b] = (cor & 0x80) ? this.mem[base + b] ^ (cor & 0x7F) : cor;
          else if (fundo !== undefined) this.mem[base + b] = fundo;
        }
      }
      this.gfxDirty = true;
    }
    teletypeGfx(ch, cor) {
      let { row, col } = this.getCursor();
      switch (ch) {
        case 7: if (this.onBeep) this.onBeep(); return;
        case 8: if (col > 0) col--; break;
        case 9: col = (col + 8) & ~7; break;
        case 10: row++; break;
        case 13: col = 0; break;
        default: this.desenharChar(ch, col, row, cor, 0); col++;
      }
      if (col >= 40) { col = 0; row++; }
      if (row >= 25) { this.mem.copyWithin(VGA, VGA + 320 * 8, VGA + 64000); this.mem.fill(0, VGA + 64000 - 320 * 8, VGA + 64000); row = 24; }
      this.setCursor(row, col);
      this.gfxDirty = true;
    }

    printStr(s) { for (const c of s) this.teletype(Asm.cp437(c)); }
    screenText() {
      const lines = [];
      for (let r = 0; r < 25; r++) {
        let l = '';
        for (let c = 0; c < 80; c++) l += Asm.CP437[this.mem[VIDEO + (r * 80 + c) * 2]] || ' ';
        lines.push(l.replace(/\s+$/, ''));
      }
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      return lines.join('\n');
    }
    outputText() {
      // transcrição normalizada: \r\n -> \n, \r sozinho volta ao início da linha
      let out = '', line = '';
      let col = 0;
      const lines = [];
      for (const ch of this.output) {
        if (ch === '\n') { lines.push(line); line = ''; col = 0; continue; }
        if (ch === '\r') { col = 0; continue; }
        if (ch === '\b') { if (col > 0) col--; continue; }
        line = line.slice(0, col) + ch + line.slice(col + 1);
        col++;
      }
      lines.push(line);
      out = lines.map(l => l.replace(/\s+$/, '')).join('\n');
      return out.replace(/\n+$/, '');
    }

    // ---------------- teclado ----------------
    pushKey(ascii, scan, digitada) {
      ascii &= 0xFF; scan = (scan === undefined ? scanDe(String.fromCharCode(ascii)) : scan) & 0xFF;
      if (this.isDefaultVector(9) && !this.kbdQueue.length) {
        // a BIOS cuida da tecla na hora: vai direto para o buffer
        this.keys.push(digitada ? { ascii, scan, digitada } : { ascii, scan });
        this.ports.lastScan = scan; this.kbdNovo = true; this.hltEspera = false;
        return;
      }
      // o programa instalou um tratador na INT 9: a tecla chega pela IRQ 1 (aperto e depois soltura)
      this.kbdQueue.push({ ascii, scan }, { ascii: 0, scan: scan | 0x80, solta: true });
    }
    typeString(s) {
      const ESPECIAIS = { ESC: [27, 0x01], ENTER: [13, 0x1C], TAB: [9, 0x0F], ESPACO: [32, 0x39], CIMA: [0, 0x48], BAIXO: [0, 0x50], ESQUERDA: [0, 0x4B], DIREITA: [0, 0x4D], HOME: [0, 0x47], END: [0, 0x4F], PGUP: [0, 0x49], PGDN: [0, 0x51], INS: [0, 0x52], DEL: [0, 0x53] };
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const m = ch === '{' ? /^\{([A-Z0-9]+)\}/.exec(s.slice(i)) : null;
        if (m && (ESPECIAIS[m[1]] || /^F([1-9]|10)$/.test(m[1]))) {
          const k = ESPECIAIS[m[1]] || [0, 0x3A + parseInt(m[1].slice(1), 10)];
          this.pushKey(k[0], k[1], true); i += m[0].length - 1; continue;
        }
        if (ch === '\n' || ch === '\r') this.pushKey(13, 0x1C, true);
        else if (ch === '\b') this.pushKey(8, 0x0E, true);
        else if (ch === '\x1b') this.pushKey(27, 0x01, true);
        else this.pushKey(Asm.cp437(ch), scanDe(ch), true);
      }
    }
    // teclado de verdade (laboratório e jogos): aperto e soltura separados
    pressionarTecla(ascii, scan) {
      ascii &= 0xFF; scan &= 0x7F;
      if (this.isDefaultVector(9) && !this.kbdQueue.length) { this.keys.push({ ascii, scan }); this.ports.lastScan = scan; this.kbdNovo = true; this.hltEspera = false; return; }
      this.kbdQueue.push({ ascii, scan });
    }
    soltarTecla(scan) {
      scan = (scan & 0x7F) | 0x80;
      if (this.isDefaultVector(9) && !this.kbdQueue.length) { this.ports.lastScan = scan; this.kbdNovo = true; return; }
      this.kbdQueue.push({ ascii: 0, scan, solta: true });
    }
    // entrega a próxima tecla da fila pela IRQ 1 (só quando a INT 9 foi trocada pelo programa)
    pollKbd() {
      if (this.isDefaultVector(9)) {
        for (const k of this.kbdQueue) { if (!k.solta) this.keys.push({ ascii: k.ascii, scan: k.scan }); this.ports.lastScan = k.scan; this.kbdNovo = true; }
        this.kbdQueue = [];
        return false;
      }
      if (!this.flag(IF) || (this.pic.isr & 3) || (this.pic.imr & 2)) return false;
      if (this.steps - this.lastKbdIrq < 150 && !this.waiting) return false;
      const k = this.kbdQueue.shift();
      this.kbdLatch = k; this.ports.lastScan = k.scan; this.kbdNovo = true;
      this.lastKbdIrq = this.steps;
      this.pic.isr |= 2;
      this.waiting = null;
      this._csBefore = this.CS; this._ipBefore = this.ip; this._redirected = false; this._retIp = this.ip;
      this.interrupt(9, this.ip);
      this.cycles += 61;
      return true;
    }

    // ---------------- endereçamento ----------------
    ea(op) {
      let off = op.disp ? op.disp.v : 0;
      if (op.base) off += this.r[R16[op.base]];
      if (op.index) off += this.r[R16[op.index]];
      off &= 0xFFFF;
      const segName = op.seg || (op.base === 'BP' ? 'SS' : 'DS');
      if (segName === 'DS' && op.relocHint && this.prog && this.prog.model === 'small' && this.DS === this.prog.pspSeg) {
        this.note('aviso', 'DS ainda aponta para o PSP (' + hex(this.DS, 4) + 'h), não para os seus dados. Faltou MOV AX,@DATA / MOV DS,AX no início?', 'ds-psp');
      }
      return { seg: this.s[SR[segName]], off, segName };
    }
    rd(op, size) {
      switch (op.t) {
        case 'r': return size === 1 || op.size === 1 ? this.getR8(op.code) : this.r[op.code];
        case 's': return this.s[op.code];
        case 'i': return op.v & (size === 1 ? 0xFF : 0xFFFF);
        case 'm': { const a = this.ea(op); return size === 1 ? this.rb(a.seg, a.off) : this.rw(a.seg, a.off); }
      }
      throw new Error('operando inválido');
    }
    wr(op, size, v) {
      switch (op.t) {
        case 'r': if (op.size === 1) this.setR8(op.code, v); else this.r[op.code] = v & 0xFFFF; return;
        case 's': this.s[op.code] = v & 0xFFFF; return;
        case 'm': {
          const a = this.ea(op);
          this.lastWrite = { seg: a.seg, off: a.off, size };
          if (size === 1) this.wb(a.seg, a.off, v); else this.ww(a.seg, a.off, v);
          return;
        }
      }
      throw new Error('destino inválido');
    }

    // ---------------- flags ----------------
    szp(r, size) {
      const mask = size === 1 ? 0xFF : 0xFFFF, sign = size === 1 ? 0x80 : 0x8000;
      r &= mask;
      this.setFlag(ZF, r === 0);
      this.setFlag(SF, (r & sign) !== 0);
      this.setFlag(PF, PARITY[r & 0xFF] === 1);
    }
    add(a, b, c, size) {
      const mask = size === 1 ? 0xFF : 0xFFFF, sign = size === 1 ? 0x80 : 0x8000;
      const r = a + b + c;
      this.setFlag(CF, r > mask);
      this.setFlag(OF, ((a ^ r) & (b ^ r) & sign) !== 0);
      this.setFlag(AF, ((a ^ b ^ r) & 0x10) !== 0);
      this.szp(r, size);
      return r & mask;
    }
    sub(a, b, c, size) {
      const mask = size === 1 ? 0xFF : 0xFFFF, sign = size === 1 ? 0x80 : 0x8000;
      const r = a - b - c;
      this.setFlag(CF, r < 0);
      this.setFlag(OF, ((a ^ b) & (a ^ r) & sign) !== 0);
      this.setFlag(AF, ((a ^ b ^ r) & 0x10) !== 0);
      this.szp(r, size);
      return r & mask;
    }
    logic(r, size) {
      this.setFlag(CF, false); this.setFlag(OF, false); this.setFlag(AF, false);
      this.szp(r, size);
      return r & (size === 1 ? 0xFF : 0xFFFF);
    }

    // ---------------- interrupções ----------------
    setVec(n, seg, off) { this.mem[n * 4] = off & 0xFF; this.mem[n * 4 + 1] = off >> 8; this.mem[n * 4 + 2] = seg & 0xFF; this.mem[n * 4 + 3] = seg >> 8; }
    vector(n) { return { seg: this.mem[n * 4 + 2] | (this.mem[n * 4 + 3] << 8), off: this.mem[n * 4] | (this.mem[n * 4 + 1] << 8) }; }
    isDefaultVector(n) { const v = this.vector(n); return v.seg === BIOS_SEG && v.off === STUB_BASE + n * 4; }
    interrupt(n, nextIp) {
      // nextIp: endereço de retorno
      if (this.isDefaultVector(n)) {
        // serviço nativo (DOS/BIOS em JavaScript), executado de forma atômica
        this.nativeCtx = 'atomic';
        const r = this.native(n);
        this.nativeCtx = null;
        if (r === 'wait') return 'wait';
        if (!this.halted && this.ip === this._ipBefore && this.CS === this._csBefore && !this._redirected) this.ip = nextIp;
        return 'ok';
      }
      this.push(this.flags);
      this.setFlag(IF, false); this.setFlag(TF, false);
      this.push(this.CS);
      this.push(nextIp);
      const v = this.vector(n);
      this.CS = v.seg; this.ip = v.off;
      this.callDepth++;
      return 'ok';
    }
    // altera FLAGS de retorno dentro de um serviço nativo
    setRetFlag(f, on) {
      if (this.nativeCtx === 'stub') {
        const off = (this.SP + 4) & 0xFFFF;
        let fl = this.rw(this.SS, off);
        fl = on ? fl | f : fl & ~f;
        this.ww(this.SS, off, fl);
      } else this.setFlag(f, on);
    }

    native(n) {
      if (this.modo === 'boot') {
        // sem DOS: só existe a BIOS. A INT 21h (e a 20h) só funcionam se o kernel instalar as suas rotinas
        if (n === 0x20 || n === 0x21 || n === 0x27) {
          this.halt('Não há DOS na memória: o programa chamou a INT ' + hex(n, 2) + 'h' + (n === 0x21 ? ' (AH=' + hex(this.AH, 2) + 'h)' : '') + ', mas depois do boot só existe a BIOS. O kernel precisa instalar a sua própria rotina nesse vetor antes (o vetor ainda aponta para a BIOS).', 'erro');
          this.note('erro', this.haltReason);
          return 'ok';
        }
        if (n === 0x00) {
          this.halt('Exceção de divisão (INT 0): divisor zero ou quociente grande demais, e ninguém instalou uma rotina na INT 0. Sem DOS, é o kernel que precisa tratar essa exceção.', 'erro');
          this.note('erro', this.haltReason);
          return 'ok';
        }
      }
      switch (n) {
        case 0x00:
          this.printStr('\r\nDivide overflow\r\n');
          this.note('erro', 'Exceção de divisão (INT 0): divisor zero ou quociente grande demais para o registrador de destino.');
          this.halt('Divide overflow: o DOS encerrou o programa (divisão por zero ou quociente que não cabe no destino).', 'erro');
          return 'ok';
        case 0x01: return 'ok';
        case 0x03:
          this.halt('INT 3 (breakpoint) atingido.', 'pausa');
          this.halted = false; this.breakHit = true;
          return 'ok';
        case 0x04: return 'ok';
        case 0x05: return 'ok';
        case 0x08: {
          this.tiqueBIOS();
          this.pic.isr &= ~1;
          if (!this.isDefaultVector(0x1C)) {
            // chama o gancho do usuário (INT 1Ch) como a BIOS faria
            const ret = this.ip;
            this._redirected = true;
            this.push(this.flags); this.setFlag(IF, false); this.setFlag(TF, false);
            this.push(this.CS); this.push(this.nativeCtx === 'atomic' ? this._retIp : ret);
            const v = this.vector(0x1C); this.CS = v.seg; this.ip = v.off;
          }
          return 'ok';
        }
        case 0x09: {
          // BIOS do teclado: guarda a tecla lida da porta 60h no buffer e manda o EOI
          const k = this.kbdLatch;
          if (k && !k.solta && k.scan !== 0x2A && k.scan !== 0x1D && k.scan !== 0x38) this.keys.push({ ascii: k.ascii, scan: k.scan });
          this.kbdLatch = null;
          this.pic.isr &= ~2;
          return 'ok';
        }
        case 0x1C: case 0x28: case 0x2F: return 'ok';
        case 0x10: return this.int10();
        case 0x11: this.AX = this.mem[0x410] | (this.mem[0x411] << 8); return 'ok';
        case 0x12: this.AX = this.mem[0x413] | (this.mem[0x414] << 8); return 'ok';
        case 0x13: return this.int13();
        case 0x15: return this.int15();
        case 0x16: return this.int16();
        case 0x18:
          this.printStr('\r\nNenhum sistema para iniciar (INT 18h). No IBM PC original, aqui entrava o BASIC da ROM.\r\n');
          this.halt('INT 18h: a BIOS não achou um sistema para dar boot.', 'erro');
          return 'ok';
        case 0x19:
          // reinício a quente: a BIOS lê de novo o setor de boot
          this.bootDisquete();
          return 'ok';
        case 0x1A: {
          const bcd = (v) => ((Math.floor(v / 10) % 10) << 4) | (v % 10);
          const d = new Date();
          if (this.AH === 0) {
            const t = this.mem[0x46C] | (this.mem[0x46D] << 8) | (this.mem[0x46E] << 16) | (this.mem[0x46F] << 24);
            this.CX = (t >>> 16) & 0xFFFF; this.DX = t & 0xFFFF; this.AL = this.mem[0x470]; this.mem[0x470] = 0;
          } else if (this.AH === 1) {
            this.mem[0x46C] = this.DX & 0xFF; this.mem[0x46D] = this.DX >> 8; this.mem[0x46E] = this.CX & 0xFF; this.mem[0x46F] = this.CX >> 8;
          } else if (this.AH === 2) {   // relógio de tempo real (RTC), em BCD
            this.CX = (bcd(d.getHours()) << 8) | bcd(d.getMinutes()); this.DH = bcd(d.getSeconds()); this.DL = 0; this.setRetFlag(CF, false);
          } else if (this.AH === 4) {
            this.CX = (bcd(Math.floor(d.getFullYear() / 100)) << 8) | bcd(d.getFullYear() % 100); this.DH = bcd(d.getMonth() + 1); this.DL = bcd(d.getDate()); this.setRetFlag(CF, false);
          } else if (this.AH === 3 || this.AH === 5) this.setRetFlag(CF, false);
          return 'ok';
        }
        case 0x20: this.exitCode = 0; this.halt('Programa terminou com INT 20h.', 'terminado'); return 'ok';
        case 0x21: return this.int21();
        default:
          this.note('aviso', 'INT ' + hex(n, 2) + 'h não tem serviço no simulador; nada foi feito.', 'int' + n);
          return 'ok';
      }
    }

    readKey() { return this.keys.length ? this.keys.shift() : null; }

    int10() {
      const ah = this.AH;
      switch (ah) {
        case 0x00: this.setMode(this.AL); return 'ok';
        case 0x01: this.mem[0x461] = this.CH; this.mem[0x460] = this.CL; this.screenDirty = true; return 'ok';   // CH bit 5 = cursor invisível
        case 0x05: case 0x0B: return 'ok';
        case 0x13: return this.int10escreveTexto();
        case 0x02: this.setCursor(Math.min(this.DH, 24), Math.min(this.DL, this.videoMode === 0x13 ? 39 : 79)); this.screenDirty = true; return 'ok';
        case 0x03: { const c = this.getCursor(); this.DX = (c.row << 8) | c.col; this.CX = 0x0607; return 'ok'; }
        case 0x06: case 0x07: {
          if (this.videoMode === 0x13) {
            if (this.AL === 0) { this.mem.fill(this.BH, VGA, VGA + 64000); this.gfxDirty = true; }
            else this.note('aviso', 'Rolagem de janela (INT 10h, AH=' + hex(ah, 2) + 'h) no modo 13h: o simulador só limpa a tela (AL=0).', 'scroll13');
            return 'ok';
          }
          const r1 = this.CH, c1 = this.CL, r2 = Math.min(this.DH, 24), c2 = Math.min(this.DL, 79);
          if (ah === 6) this.scrollUp(this.AL, this.BH, r1, c1, r2, c2); else this.scrollDown(this.AL, this.BH, r1, c1, r2, c2);
          return 'ok';
        }
        case 0x08: { const c = this.getCursor(); const a = VIDEO + (c.row * 80 + c.col) * 2; this.AL = this.mem[a]; this.AH = this.mem[a + 1]; return 'ok'; }
        case 0x09: case 0x0A: {
          const c = this.getCursor();
          if (this.videoMode === 0x13) { for (let i = 0; i < this.CX && c.col + i < 40; i++) this.desenharChar(this.AL, c.col + i, c.row, this.BL, 0); return 'ok'; }
          let p = c.row * 80 + c.col;
          for (let i = 0; i < this.CX && p < 2000; i++, p++) {
            this.mem[VIDEO + p * 2] = this.AL;
            if (ah === 9) this.mem[VIDEO + p * 2 + 1] = this.BL;
          }
          this.screenDirty = true; return 'ok';
        }
        case 0x0C:
          if (this.videoMode === 0x13 && this.CX < 320 && this.DX < 200) {
            const a = VGA + this.DX * 320 + this.CX;
            this.mem[a] = (this.AL & 0x80) ? this.mem[a] ^ (this.AL & 0x7F) : this.AL; this.gfxDirty = true;
          }
          return 'ok';
        case 0x0D: if (this.videoMode === 0x13 && this.CX < 320 && this.DX < 200) this.AL = this.pixel(this.CX, this.DX); return 'ok';
        case 0x0E: this.teletype(this.AL, undefined, this.BL); return 'ok';
        case 0x0F: this.AL = this.videoMode; this.AH = this.videoMode === 0x13 ? 40 : 80; this.r[3] &= 0x00FF; return 'ok';
        case 0x10: {
          const al = this.AL;
          if (al === 0x10) { const i = this.BX & 0xFF; this.dac[i * 3] = this.DH & 63; this.dac[i * 3 + 1] = this.CH & 63; this.dac[i * 3 + 2] = this.CL & 63; this.gfxDirty = true; }
          else if (al === 0x15) { const i = this.BX & 0xFF; this.DH = this.dac[i * 3]; this.r[1] = (this.dac[i * 3 + 1] << 8) | this.dac[i * 3 + 2]; }
          else if (al === 0x12 || al === 0x17) {
            for (let k = 0; k < this.CX; k++) for (let c = 0; c < 3; c++) {
              const i = ((this.BX + k) & 0xFF) * 3 + c, off = (this.DX + k * 3 + c) & 0xFFFF;
              if (al === 0x12) this.dac[i] = this.rb(this.ES, off) & 63; else this.wb(this.ES, off, this.dac[i]);
            }
            this.gfxDirty = true;
          } else if (al === 0x03) {   // BL = 0: o bit 7 do atributo vira fundo claro; BL = 1: pisca
            this.mem[0x465] = this.BL ? this.mem[0x465] | 0x20 : this.mem[0x465] & ~0x20; this.screenDirty = true;
          } else if (al === 0x00 || al === 0x01 || al === 0x02) {
            // registradores de paleta do controlador de atributos e cor da borda: não alteram a imagem no simulador
          } else this.note('aviso', 'INT 10h, AH=10h, AL=' + hex(al, 2) + 'h não implementada (há 03h, 10h, 12h, 15h e 17h).', '1010-' + al);
          return 'ok';
        }
        case 0x11:
          if (this.AL === 0x30) { this.ES = BIOS_SEG; this.BP = this.BH === 3 ? 0xFA6E : 0xF66E; this.CX = 8; this.DL = 24; return 'ok'; }
          this.note('aviso', 'INT 10h, AH=11h (fontes) só tem AL=30h no simulador.', '1011'); return 'ok';
        default: this.note('aviso', 'INT 10h função AH=' + hex(ah, 2) + 'h não implementada no simulador.', '10-' + ah); return 'ok';
      }
    }

    // INT 10h, AH=13h: escreve uma string (ES:BP, CX caracteres) na linha DH, coluna DL
    int10escreveTexto() {
      const modo = this.AL, attrs = modo & 2;
      const salvo = this.getCursor();
      let row = this.DH, col = this.DL, off = this.BP;
      for (let i = 0; i < this.CX; i++) {
        const ch = this.rb(this.ES, off); off = (off + 1) & 0xFFFF;
        let at = this.BL;
        if (attrs) { at = this.rb(this.ES, off); off = (off + 1) & 0xFFFF; }
        if (ch === 13) { col = 0; continue; }
        if (ch === 10) { row++; continue; }
        if (this.videoMode === 0x13) this.desenharChar(ch, col, row, at, 0);
        else if (row < 25) { const a = VIDEO + (row * 80 + col) * 2; this.mem[a] = ch; this.mem[a + 1] = at; }
        if (++col >= (this.videoMode === 0x13 ? 40 : 80)) { col = 0; row++; }
      }
      if (modo & 1) this.setCursor(Math.min(row, 24), col); else this.setCursor(salvo.row, salvo.col);
      this.screenDirty = true;
      return 'ok';
    }

    // ---------------- disquete: INT 13h ----------------
    int13() {
      const ah = this.AH, dl = this.DL;
      const fim = (st, extra) => {
        this.mem[0x441] = st;
        this.AH = st; this.setRetFlag(CF, st !== 0);
        if (extra) extra();
        return 'ok';
      };
      if (ah === 0x00) return fim(0);
      if (ah === 0x01) { this.AL = 0; return fim(this.mem[0x441]); }
      if (dl !== 0 || !this.disquete) {
        if (ah === 0x15) { this.AH = 0; this.setRetFlag(CF, false); return 'ok'; }   // "não há drive"
        this.note('aviso', 'INT 13h no drive ' + hex(dl, 2) + 'h: o simulador só tem o disquete A: (DL = 0)' + (this.disquete ? '' : ', e só no modo de boot') + '.', 'int13-' + dl);
        return fim(dl >= 0x80 ? 0x01 : 0x80);
      }
      const D = DISQUETE;
      switch (ah) {
        case 0x02: case 0x03: case 0x04: {
          const n = this.AL, setor = this.CL & 63, cil = this.CH | ((this.CL & 0xC0) << 2), cab = this.DH;
          if (n === 0 || setor === 0 || setor > D.setores || cab >= D.cabecas || cil >= D.trilhas) {
            this.note('aviso', 'INT 13h: setor inexistente (cilindro ' + cil + ', cabeça ' + cab + ', setor ' + setor + ', ' + n + ' setor(es)). Num disquete de 1,44 MB há 80 cilindros, 2 cabeças e os setores vão de 1 a 18.', 'int13-chs');
            return fim(0x04, () => { this.AL = 0; });
          }
          if (setor + n - 1 > D.setores) {
            this.note('aviso', 'INT 13h: a leitura de ' + n + ' setores a partir do setor ' + setor + ' passa do fim da trilha (setor 18). Leia um setor por vez, ou só até o fim da trilha.', 'int13-trilha');
            return fim(0x04, () => { this.AL = 0; });
          }
          const fis = (this.ES * 16 + this.BX) & 0xFFFFF;
          if (ah !== 0x04 && (fis >> 16) !== ((fis + n * 512 - 1) >> 16)) {
            this.note('aviso', 'INT 13h: o buffer ' + hex(this.ES, 4) + ':' + hex(this.BX, 4) + ' com ' + n * 512 + ' bytes atravessa uma fronteira de 64 KB (erro 09h, fronteira de DMA). Escolha um buffer que não cruze um múltiplo de 10000h.', 'int13-dma');
            return fim(0x09, () => { this.AL = 0; });
          }
          const lba = (cil * D.cabecas + cab) * D.setores + setor - 1;
          for (let i = 0; i < n * 512; i++) {
            const a = (fis + i) & 0xFFFFF;
            if (ah === 0x02) { if (a < 0xF0000) { this.mem[a] = this.disquete[lba * 512 + i]; this.tocado[a] = 1; } }
            else if (ah === 0x03) this.disquete[lba * 512 + i] = this.mem[a];
          }
          if (ah === 0x02) { this.screenDirty = true; this.gfxDirty = true; }
          if (ah === 0x03 && this.onDisquete) this.onDisquete();
          this.cycles += 2000 * n;
          return fim(0, () => { this.AL = n; });
        }
        case 0x08:
          return fim(0, () => { this.AL = 0; this.BX = 0x0004; this.CX = ((D.trilhas - 1) << 8) | D.setores; this.DX = ((D.cabecas - 1) << 8) | 1; this.ES = BIOS_SEG; this.DI = TABELA_DISQUETE; });
        case 0x15: this.AH = 0x02; this.setRetFlag(CF, false); return 'ok';   // disquete com sinal de troca
        case 0x16: case 0x17: case 0x18: return fim(0);
        default:
          this.note('aviso', 'INT 13h, AH=' + hex(ah, 2) + 'h não implementada no simulador (há 00h a 04h, 08h, 15h a 18h).', '13-' + ah);
          return fim(0x01);
      }
    }
    int15() {
      switch (this.AH) {
        case 0x88: this.AX = 0; this.setRetFlag(CF, false); return 'ok';   // sem memória estendida
        case 0x86: { const us = this.CX * 65536 + this.DX; this.cycles += Math.round(us * this.mhz); this.setRetFlag(CF, false); return 'ok'; }
        case 0x4F: this.setRetFlag(CF, true); return 'ok';
        default: this.AH = 0x86; this.setRetFlag(CF, true); return 'ok';   // função não suportada
      }
    }

    int16() {
      switch (this.AH) {
        case 0x00: case 0x10: {
          const k = this.readKey();
          if (!k) return 'wait';
          this.AL = k.ascii; this.AH = k.scan; return 'ok';
        }
        case 0x01: case 0x11: {
          if (this.keys.length) { const k = this.keys[0]; this.AL = k.ascii; this.AH = k.scan; this.setRetFlag(ZF, false); }
          else this.setRetFlag(ZF, true);
          return 'ok';
        }
        case 0x02: case 0x12: this.AL = this.mem[0x417]; return 'ok';
        case 0x05:   // põe uma tecla no buffer (CH = scan, CL = ASCII)
          if (this.keys.length >= 15) { this.AL = 1; return 'ok'; }
          this.keys.push({ ascii: this.CL, scan: this.CH }); this.AL = 0; return 'ok';
        default: return 'ok';
      }
    }

    int21() {
      const ah = this.AH;
      this._ahErro = ah;
      switch (ah) {
        case 0x00: this.exitCode = 0; this.halt('Programa terminou (INT 21h, AH=00h).', 'terminado'); return 'ok';
        case 0x01: {
          const k = this.readKey(); if (!k) return 'wait';
          this.AL = k.ascii;
          if (k.ascii === 13) this.teletype(13); else if (k.ascii) this.teletype(k.ascii);
          return 'ok';
        }
        case 0x02: this.teletype(this.DL); this.AL = this.DL; return 'ok';
        case 0x06:
          if (this.DL === 0xFF) {
            const k = this.readKey();
            if (k) { this.AL = k.ascii; this.setRetFlag(ZF, false); } else { this.AL = 0; this.setRetFlag(ZF, true); }
          } else { this.teletype(this.DL); this.AL = this.DL; }
          return 'ok';
        case 0x07: case 0x08: { const k = this.readKey(); if (!k) return 'wait'; this.AL = k.ascii; return 'ok'; }
        case 0x09: {
          let off = this.DX, n = 0;
          for (;;) {
            const c = this.rb(this.DS, off);
            if (c === 0x24) break;
            this.teletype(c);
            off = (off + 1) & 0xFFFF;
            if (++n > 4000) { this.note('erro', 'INT 21h/09h imprimiu 4000 caracteres sem achar "$". A string termina com $? DS:DX aponta para ela?'); this.halt('String sem terminador $.', 'erro'); return 'ok'; }
          }
          this.AL = 0x24; return 'ok';
        }
        case 0x0A: return this.bufferedInput();
        case 0x0B: this.AL = this.keys.length ? 0xFF : 0x00; return 'ok';
        case 0x0C: {
          if (!this.flushed) { this.keys = []; this.flushed = true; }
          const fn = this.AL;
          if ([0x01, 0x06, 0x07, 0x08, 0x0A].includes(fn)) {
            this.AH = fn;
            const r = this.int21();
            this.AH = 0x0C;
            if (r !== 'wait') this.flushed = false;
            return r;
          }
          this.flushed = false;
          return 'ok';
        }
        case 0x19: this.AL = 2; return 'ok';
        case 0x25: { const n = this.AL; this.mem[n * 4] = this.DX & 0xFF; this.mem[n * 4 + 1] = this.DX >> 8; this.mem[n * 4 + 2] = this.DS & 0xFF; this.mem[n * 4 + 3] = this.DS >> 8; return 'ok'; }
        case 0x2A: { const d = new Date(); this.CX = d.getFullYear(); this.DH = d.getMonth() + 1; this.setR8(2, d.getDate()); this.AL = d.getDay(); return 'ok'; }
        case 0x2C: { const d = new Date(); this.setR8(5, d.getHours()); this.setR8(1, d.getMinutes()); this.setR8(6, d.getSeconds()); this.setR8(2, Math.floor(d.getMilliseconds() / 10)); return 'ok'; }
        case 0x30: this.AX = 0x0005; this.BX = 0; this.CX = 0; return 'ok';
        case 0x0E: this.AL = 5; return 'ok';
        case 0x1A: this.dta = { seg: this.DS, off: this.DX }; return 'ok';
        case 0x2F: this.ES = this.dta.seg; this.BX = this.dta.off; return 'ok';
        case 0x34: this.ES = DOS_SEG; this.BX = 0x0500; return 'ok';
        case 0x36: if (this.DL > 3) { this.AX = 0xFFFF; return 'ok'; } this.AX = 4; this.BX = 9000; this.CX = 512; this.DX = 10000; return 'ok';
        case 0x3B: { const n = this.lerNome(this.DS, this.DX).toUpperCase(); return n === '\\' || n === 'C:\\' || n === '.' ? this.dosOk() : this.dosErro(3); }
        case 0x39: case 0x3A: this.note('aviso', 'O disco do simulador não tem subdiretórios (INT 21h, AH=' + hex(ah, 2) + 'h).', 'dir'); return this.dosErro(5);
        case 0x47: this.wb(this.DS, this.SI, 0); return this.dosOk(0x0100);
        case 0x3C: case 0x3D: case 0x3E: case 0x3F: case 0x40: case 0x41: case 0x42: case 0x43: case 0x44: case 0x45: case 0x46: case 0x4E: case 0x4F: case 0x56:
          return this.dosArquivo(ah);
        case 0x48: case 0x49: case 0x4A: return this.dosMemoria(ah);
        case 0x51: case 0x62: this.BX = this.prog ? this.prog.pspSeg : 0; return 'ok';
        case 0x35: { const v = this.vector(this.AL); this.ES = v.seg; this.BX = v.off; return 'ok'; }
        case 0x4C: this.exitCode = this.AL; this.halt('Programa terminou normalmente (INT 21h, AH=4Ch), código de saída ' + this.AL + '.', 'terminado'); return 'ok';
        case 0x31: this.terminarResidente(this.DX); return 'ok';
        default:
          this.note('aviso', 'INT 21h função AH=' + hex(ah, 2) + 'h não implementada no simulador.', '21-' + ah);
          this.setRetFlag(CF, true); this.AX = 1;
          return 'ok';
      }
    }
    set DH(v) { this.setR8(6, v); }
    set DL(v) { this.setR8(2, v); }

    bufferedInput() {
      const seg = this.DS, off = this.DX;
      const max = this.rb(seg, off);
      if (!this.lineInput) this.lineInput = { chars: [] };
      const li = this.lineInput;
      if (max === 0) { this.lineInput = null; return 'ok'; }
      for (;;) {
        const k = this.readKey();
        if (!k) return 'wait';
        if (k.ascii === 13) {
          for (let i = 0; i < li.chars.length; i++) this.wb(seg, off + 2 + i, li.chars[i]);
          this.wb(seg, off + 2 + li.chars.length, 13);
          this.wb(seg, off + 1, li.chars.length);
          this.teletype(13);
          this.lineInput = null;
          return 'ok';
        }
        if (k.ascii === 8) {
          if (li.chars.length) { li.chars.pop(); this.teletype(8); this.teletype(32); this.teletype(8); }
          continue;
        }
        if (k.ascii === 0) continue;
        if (li.chars.length >= max - 1) { if (this.onBeep) this.onBeep(); continue; }
        li.chars.push(k.ascii);
        this.teletype(k.ascii);
      }
    }

    // ---------------- portas ----------------
    portIn(port, size) {
      if (size === 2) return this.portIn(port, 1) | (this.portIn(port + 1, 1) << 8);
      switch (port) {
        case 0x21: return this.pic.imr;
        case 0x20: return this.pic.isr;
        case 0x40: case 0x41: case 0x42: {
          const c = this.pit[port - 0x40];
          const v = c.latch !== null ? c.latch : this.contagemPIT(port - 0x40);
          const r = c.lerAlto ? (v >> 8) & 0xFF : v & 0xFF;
          if (c.lerAlto || c.acesso === 1 || c.acesso === 2) c.latch = null;
          if (c.acesso === 3) c.lerAlto = !c.lerAlto;
          return c.acesso === 2 ? (v >> 8) & 0xFF : r;
        }
        case 0x60: this.kbdNovo = false; return this.ports.lastScan;
        case 0x61: return this.ports[0x61];
        case 0x64: return 0x14 | (this.kbdNovo ? 1 : 0);
        case 0x3C7: return 3;
        case 0x3C8: return this.dacW;
        case 0x3C9: { const v = this.dac[this.dacR * 3 + this.dacRC]; if (++this.dacRC === 3) { this.dacRC = 0; this.dacR = (this.dacR + 1) & 0xFF; } return v; }
        case 0x3DA: { const q = this.quadro(), f = this.cycles % q; return (f < q * 0.0587 ? 0x09 : 0) | ((f % (q / 227)) < q / 1136 ? 1 : 0); }
        default: return 0xFF;
      }
    }
    portOut(port, v, size) {
      if (size === 2) { this.portOut(port, v & 0xFF, 1); this.portOut(port + 1, (v >> 8) & 0xFF, 1); return; }
      v &= 0xFF;
      switch (port) {
        case 0x20:
          if (v === 0x20) { for (let b = 0; b < 8; b++) if (this.pic.isr & (1 << b)) { this.pic.isr &= ~(1 << b); break; } }
          return;
        case 0x21: this.pic.imr = v; return;
        case 0x43: {
          const ch = v >> 6;
          if (ch === 3) return;
          const c = this.pit[ch];
          const acc = (v >> 4) & 3;
          if (acc === 0) { c.latch = this.contagemPIT(ch); c.lerAlto = false; return; }
          c.acesso = acc; c.modo = (v >> 1) & 7; c.lo = null; c.lerAlto = false; c.latch = null;
          return;
        }
        case 0x40: case 0x41: case 0x42: {
          const ch = port - 0x40, c = this.pit[ch];
          let novo = null;
          if (c.acesso === 1) novo = v;
          else if (c.acesso === 2) novo = v << 8;
          else if (c.lo === null) { c.lo = v; return; }
          else { novo = c.lo | (v << 8); c.lo = null; }
          c.reload = novo || 65536;
          if (ch === 0) this.timerInterval = Math.max(20, Math.round(this.opts.timerInterval * c.reload / 65536));
          if (ch === 2) { this.ports.pit2 = c.reload; this.soundUpdate(); }
          return;
        }
        case 0x61: this.ports[0x61] = v; this.soundUpdate(); return;
        case 0x3C7: this.dacR = v; this.dacRC = 0; return;
        case 0x3C8: this.dacW = v; this.dacC = 0; return;
        case 0x3C9:
          this.dac[this.dacW * 3 + this.dacC] = v & 63;
          if (++this.dacC === 3) { this.dacC = 0; this.dacW = (this.dacW + 1) & 0xFF; }
          this.gfxDirty = true;
          return;
        default: return;
      }
    }
    contagemPIT(ch) {
      const c = this.pit[ch];
      const t = Math.floor(this.cycles * PIT_HZ / (this.mhz * 1e6));   // o PIT conta a 1,19 MHz (um quarto do clock do 8088 de 4,77 MHz)
      return (c.reload - (t % c.reload)) & 0xFFFF;
    }
    soundUpdate() {
      const on = (this.ports[0x61] & 3) === 3 && this.ports.pit2 > 0;
      const f = on ? 1193182 / this.ports.pit2 : 0;
      const ult = this.soundLog[this.soundLog.length - 1];
      if (!ult || Math.abs(ult.freq - f) > 0.01) this.soundLog.push({ freq: f, ciclo: this.cycles });
      if (this.onSound) this.onSound(f);
    }

    // ---------------- execução ----------------
    currentInstr() { const i = this.instrucaoEm(this.CS, this.ip); return i && !i.invalida ? i : null; }

    // ---------------- busca da instrução ----------------
    // As instruções do montador ficam em instrMap. Se a memória daquele endereço foi escrita
    // durante a execução (código carregado do disco, programa colocado por cima, código que
    // se modifica), os bytes são decodificados de novo a partir da memória.
    indexarFonte(prog) {
      this.porOffset = new Map();
      for (const ins of prog.instrs) {
        if (!this.porOffset.has(ins.off)) this.porOffset.set(ins.off, []);
        this.porOffset.get(ins.off).push(ins);
      }
    }
    bytesConferem(ins, seg, off) {
      const b = ins.bytes, base = seg << 4;
      for (let i = 0; i < b.length; i++) if (this.mem[(base + ((off + i) & 0xFFFF)) & 0xFFFFF] !== b[i]) return false;
      return true;
    }
    instrucaoEm(seg, off) {
      const phys = ((seg << 4) + off) & 0xFFFFF;
      const ins = this.instrMap.get(phys);
      if (ins && (ins.synthetic || this.bytesConferem(ins, seg, off))) return ins;
      if (!this.tocado[phys]) return null;   // ninguém escreveu nada aqui: não é código
      let d = this.decodCache.get(phys);
      if (d && d.seg === seg && this.bytesConferem(d, seg, off)) return d;
      d = this.decodificarEm(seg, off);
      this.decodCache.set(phys, d);
      return d;
    }
    decodificarEm(seg, off) {
      const base = seg << 4;
      const ler = (i) => this.mem[(base + ((off + i) & 0xFFFF)) & 0xFFFFF];
      const d = Decod.decodificar(ler, off);
      d.seg = seg; d.off = off; d.phys = (base + off) & 0xFFFFF;
      d.bytes = [];
      for (let i = 0; i < d.size; i++) d.bytes.push(ler(i));
      d.line = 0;
      // o código veio do fonte (por exemplo, o kernel lido do disquete)? acha a linha pelos bytes
      const cands = !d.invalida && this.porOffset && this.porOffset.get(off);
      if (cands) {
        const iguais = cands.filter(c => !c.synthetic && c.bytes.length === d.size && c.bytes.every((x, i) => x === d.bytes[i]));
        // vários arquivos podem ter o mesmo código no mesmo offset: prefere o que já está rodando neste segmento
        const ch = (x) => x.chave !== undefined ? x.chave : x.seg;
        const c = (iguais.length > 1 && this.segFonte && iguais.find(x => this.segFonte.get(ch(x)) === seg)) ||
          iguais.find(x => ch(x) === this.ultimoSegFonte) || iguais[0];
        if (c) { d.line = c.line; d.fonte = c; }
      }
      return d;
    }
    // o código do segmento "base" (no fonte) está rodando em CS: as variáveis dele moram lá
    relocarSimbolos(base, cs) {
      this.ultimoSegFonte = base;
      if (!this.segFonte) this.segFonte = new Map();
      if (this.segFonte.get(base) === cs || !this.prog) return;
      this.segFonte.set(base, cs);
      for (const s of Object.values(this.prog.symbols)) if (s.segFonte === base) { s.seg = cs; s.phys = (cs * 16 + s.off) & 0xFFFFF; }
    }
    // o contador de tiques da BIOS em 0040:006C (o que a INT 8 padrão faz a cada tique)
    tiqueBIOS() {
      let t = this.mem[0x46C] | (this.mem[0x46D] << 8) | (this.mem[0x46E] << 16);
      t++;
      if (t >= 0x1800B0) { t = 0; this.mem[0x470] = 1; }   // meia-noite: 1.573.040 tiques por dia
      this.mem[0x46C] = t & 0xFF; this.mem[0x46D] = (t >> 8) & 0xFF; this.mem[0x46E] = (t >> 16) & 0xFF;
    }
    // esperando uma tecla em tempo real: o relógio continua andando (se ninguém trocou a INT 8 nem a 1Ch)
    ocioso(alvo) {
      if (!this.timerCiclos || !this.opts.timer || this.waiting !== 'tecla' || !(alvo > this.cycles)) return;
      if (!this.isDefaultVector(8) || !this.isDefaultVector(0x1C)) return;
      if (this.proxTick === undefined) this.proxTick = this.cycles + this.periodoTimer();
      while (this.proxTick <= alvo) { this.tiqueBIOS(); this.proxTick += this.periodoTimer(); }
      this.cycles = alvo;
    }
    periodoTimer() { return this.pit[0].reload * this.mhz * 1e6 / PIT_HZ; }
    quadro() { return Math.round(this.mhz * 1e6 / 70); }   // ciclos por quadro de vídeo (70 Hz)

    step() {
      if (this.halted) return this.status;
      this.breakHit = false;
      // teclas de teste ainda não lidas: se o programa instalou uma INT 9, elas passam a chegar pela IRQ 1
      if (this.keys.length && this.keys[0].digitada && !this.isDefaultVector(9)) {
        const rest = this.keys.filter(k => k.digitada);
        this.keys = this.keys.filter(k => !k.digitada);
        for (const k of rest) this.kbdQueue.push({ ascii: k.ascii, scan: k.scan }, { ascii: 0, scan: k.scan | 0x80, solta: true });
      }
      if (this.kbdQueue.length && this.pollKbd()) { this.hltEspera = false; return this.status = 'executando'; }
      // HLT: a CPU está parada esperando uma interrupção; o tempo corre até o próximo tique
      if (this.hltEspera) {
        if (this.timerCiclos) this.cycles = Math.max(this.cycles, Math.ceil(this.proxTick || 0));
        else this.timerTick = this.timerInterval;
      }
      // interrupção do timer (IRQ0)
      if (this.opts.timer && !this.waiting) {
        let disparar;
        if (this.timerCiclos) {
          if (this.proxTick === undefined || this.proxTick < this.cycles - 20 * this.periodoTimer()) this.proxTick = this.cycles + this.periodoTimer();
          disparar = this.cycles >= this.proxTick;
        } else { this.timerTick = (this.timerTick || 0) + 1; disparar = this.timerTick >= this.timerInterval; }
        if (disparar) {
          if (this.flag(IF) && !(this.pic.isr & 1) && !(this.pic.imr & 1)) {
            this.timerTick = 0;
            if (this.timerCiclos) this.proxTick += this.periodoTimer();
            this.hltEspera = false;
            this.pic.isr |= 1;
            this._csBefore = this.CS; this._ipBefore = this.ip; this._redirected = false; this._retIp = this.ip;
            this.interrupt(8, this.ip);
            if (!this.isDefaultVector(8) || this._redirected) { this.cycles += 61; return this.status = 'executando'; }
          }
        }
      }
      if (this.hltEspera) { this.steps++; this.cycles += 64; return this.status = 'executando'; }
      const phys = ((this.CS << 4) + this.ip) & 0xFFFFF;
      // código "da BIOS": stub de interrupção alcançado por CALL/JMP far (encadeamento)
      if (this.CS === BIOS_SEG && this.ip >= STUB_BASE && this.ip < STUB_BASE + 1024 && (this.ip & 3) === 0) {
        const n = (this.ip - STUB_BASE) >> 2;
        this.nativeCtx = 'stub';
        this._redirected = false;
        const r = this.native(n);
        this.nativeCtx = null;
        if (r === 'wait') { this.waiting = 'tecla'; return this.status = 'aguardando'; }
        this.waiting = null;
        if (!this.halted && !this._redirected) {
          this.ip = this.pop(); this.CS = this.pop(); this.flags = (this.pop() & 0x0FD5) | 0xF002;
          if (this.callDepth > 0) this.callDepth--;
        }
        this.steps++; this.cycles += 24;
        return this.halted ? this.status : (this.status = 'executando');
      }
      const ins = this.instrucaoEm(this.CS, this.ip);
      if (!ins) {
        if (this.snippet && this.prog && phys >= this.prog.codeEnd - 0 && this.CS === this.prog.pspSeg) {
          this.halt('Fim do trecho de código.', 'terminado');
          return this.status;
        }
        const isData = this.modo !== 'boot' && this.prog && phys >= this.prog.loadStart && phys < this.prog.loadEnd;
        this.halt('A CPU chegou em ' + hex(this.CS, 4) + ':' + hex(this.ip, 4) + ', onde não há instrução' +
          (isData ? ' (são dados!). Faltou encerrar o programa com MOV AH,4Ch / INT 21h, ou um salto foi para o lugar errado?'
            : this.modo === 'boot' ? ': nada foi carregado nesse endereço. Faltou ler esse código do disquete (INT 13h, AH=02h) ou o salto foi para o segmento errado?'
            : '. O programa saltou para fora do código.'), 'erro');
        this.note('erro', this.haltReason);
        return this.status;
      }
      if (ins.invalida) {
        this.halt('Em ' + hex(this.CS, 4) + ':' + hex(this.ip, 4) + ' os bytes não formam uma instrução do 8086: ' + ins.invalida + '. O programa saltou para dados ou para o lugar errado?', 'erro');
        this.note('erro', this.haltReason);
        return this.status;
      }
      if (ins.decodificada && ins.bytes[0] === 0 && ins.bytes[1] === 0) {
        this.halt('A CPU chegou em ' + hex(this.CS, 4) + ':' + hex(this.ip, 4) + ', onde a memória está zerada (00 00 seria ADD [BX+SI],AL). O programa saltou para fora do código?', 'erro');
        this.note('erro', this.haltReason);
        return this.status;
      }
      if (ins.fonte) {
        const ch = ins.fonte.chave !== undefined ? ins.fonte.chave : ins.fonte.seg;
        if (ch !== this.ultimoSegFonte || !this.segFonte || this.segFonte.get(ch) !== this.CS) this.relocarSimbolos(ch, this.CS);
      }
      this.curLine = ins.line;
      const tf = this.flag(TF);
      this.extraCycles = 0;
      const r = this.exec(ins);
      if (r === 'wait') { this.waiting = 'tecla'; return this.status = 'aguardando'; }
      this.waiting = null;
      this.steps++;
      this.cycles += this.extraCycles;
      if (tf && !this.halted) this.interrupt(1, this.ip);
      if (this.breakHit) return this.status = 'pausa';
      return this.halted ? this.status : (this.status = 'executando');
    }

    run(maxSteps, breakpoints) {
      let n = 0;
      let st = this.status;
      while (n < maxSteps) {
        st = this.step();
        n++;
        if (st !== 'executando') break;
        // acabou de ficar residente (AH=31h): devolve o controle para quem chamou (runProgram digita as teclas de depois)
        if (this.residente && !this.residenteAvisado) { this.residenteAvisado = true; break; }
        if (breakpoints && breakpoints.size) {
          const ins = this.currentInstr();
          if (ins && breakpoints.has(ins.line)) { st = this.status = 'breakpoint'; break; }
        }
      }
      return st;
    }

    exec(ins) {
      const next = (this.ip + ins.size) & 0xFFFF;
      const c = ins.cycles || { base: 2 };
      let cyc = c.base;
      const ops = ins.ops;
      const a = ops[0], b = ops[1];
      const sizeOf = () => (a && (a.t === 'r' || a.t === 's')) ? a.size : (b && (b.t === 'r' || b.t === 's')) ? b.size : (a && a.size) || 2;
      let jumped = false;
      const jump = (t) => { this.ip = t & 0xFFFF; jumped = true; };
      const mn = ins.mn;

      if (ins.fpu) { this.execFPU(ins); if (this.halted) return 'ok'; this.ip = next; this.cycles += cyc; return 'ok'; }
      switch (mn) {
        case 'MOV': { const s = sizeOf(); this.wr(a, s, this.rd(b, s)); break; }
        case 'XCHG': { const s = sizeOf(); const x = this.rd(a, s), y = this.rd(b, s); this.wr(a, s, y); this.wr(b, s, x); break; }
        case 'LEA': this.r[a.code] = b.t === 'i' ? b.v & 0xFFFF : this.ea(b).off; break;
        case 'LDS': case 'LES': {
          const e = this.ea(b);
          this.r[a.code] = this.rw(e.seg, e.off);
          const sv = this.rw(e.seg, (e.off + 2) & 0xFFFF);
          if (mn === 'LDS') this.DS = sv; else this.ES = sv;
          break;
        }
        case 'PUSH': {
          if (a.t === 'r' && a.code === 4) { this.SP = (this.SP - 2) & 0xFFFF; this.ww(this.SS, this.SP, this.SP); } // 8086 empilha SP já decrementado
          else this.push(this.rd(a, 2));
          break;
        }
        case 'POP': { const v = this.pop(); this.wr(a, 2, v); break; }
        case 'PUSHF': this.push(this.flags | 0xF000); break;
        case 'POPF': this.flags = (this.pop() & 0x0FD5) | 0xF002; break;
        case 'LAHF': this.AH = this.flags & 0xD5; break;
        case 'SAHF': this.flags = (this.flags & 0xFF00) | (this.AH & 0xD5) | 0x02; break;
        case 'ADD': case 'ADC': case 'SUB': case 'SBB': case 'CMP': case 'AND': case 'OR': case 'XOR': {
          const s = sizeOf();
          const x = this.rd(a, s), y = this.rd(b, s);
          let r;
          switch (mn) {
            case 'ADD': r = this.add(x, y, 0, s); break;
            case 'ADC': r = this.add(x, y, this.flag(CF) ? 1 : 0, s); break;
            case 'SUB': case 'CMP': r = this.sub(x, y, 0, s); break;
            case 'SBB': r = this.sub(x, y, this.flag(CF) ? 1 : 0, s); break;
            case 'AND': r = this.logic(x & y, s); break;
            case 'OR': r = this.logic(x | y, s); break;
            case 'XOR': r = this.logic(x ^ y, s); break;
          }
          if (mn !== 'CMP') this.wr(a, s, r);
          break;
        }
        case 'TEST': { const s = sizeOf(); this.logic(this.rd(a, s) & this.rd(b, s), s); break; }
        case 'INC': case 'DEC': {
          const s = sizeOf();
          const cf = this.flag(CF);
          const r = mn === 'INC' ? this.add(this.rd(a, s), 1, 0, s) : this.sub(this.rd(a, s), 1, 0, s);
          this.setFlag(CF, cf);
          this.wr(a, s, r);
          break;
        }
        case 'NEG': {
          const s = sizeOf();
          const x = this.rd(a, s);
          const r = this.sub(0, x, 0, s);
          this.setFlag(CF, x !== 0);
          this.wr(a, s, r);
          break;
        }
        case 'NOT': { const s = sizeOf(); this.wr(a, s, ~this.rd(a, s)); break; }
        case 'MUL': case 'IMUL': {
          const s = sizeOf();
          const src = this.rd(a, s);
          if (s === 1) {
            let r;
            if (mn === 'MUL') { r = this.AL * src; this.AX = r; const hi = this.AH !== 0; this.setFlag(CF, hi); this.setFlag(OF, hi); }
            else {
              r = ((this.AL << 24) >> 24) * ((src << 24) >> 24);
              this.AX = r & 0xFFFF;
              const ext = r >= -128 && r <= 127;
              this.setFlag(CF, !ext); this.setFlag(OF, !ext);
            }
          } else {
            if (mn === 'MUL') {
              const r = this.AX * src;
              this.AX = r & 0xFFFF; this.DX = Math.floor(r / 65536) & 0xFFFF;
              const hi = this.DX !== 0; this.setFlag(CF, hi); this.setFlag(OF, hi);
            } else {
              const r = ((this.AX << 16) >> 16) * ((src << 16) >> 16);
              const u = r < 0 ? r + 0x100000000 : r;
              this.AX = u & 0xFFFF; this.DX = Math.floor(u / 65536) & 0xFFFF;
              const ext = r >= -32768 && r <= 32767;
              this.setFlag(CF, !ext); this.setFlag(OF, !ext);
            }
          }
          break;
        }
        case 'DIV': case 'IDIV': {
          const s = sizeOf();
          const src = this.rd(a, s);
          let fault = src === 0;
          if (!fault) {
            if (s === 1) {
              if (mn === 'DIV') {
                const q = Math.floor(this.AX / src), rm = this.AX % src;
                if (q > 0xFF) fault = true; else { this.AL = q; this.AH = rm; }
              } else {
                const dvd = (this.AX << 16) >> 16, dvs = (src << 24) >> 24;
                const q = Math.trunc(dvd / dvs), rm = dvd - q * dvs;
                if (q > 127 || q < -127) fault = true; else { this.AL = q & 0xFF; this.AH = rm & 0xFF; }
              }
            } else {
              const u = this.DX * 65536 + this.AX;
              if (mn === 'DIV') {
                const q = Math.floor(u / src), rm = u % src;
                if (q > 0xFFFF) fault = true; else { this.AX = q; this.DX = rm; }
              } else {
                const dvd = u >= 0x80000000 ? u - 0x100000000 : u, dvs = (src << 16) >> 16;
                const q = Math.trunc(dvd / dvs), rm = dvd - q * dvs;
                if (q > 32767 || q < -32767) fault = true; else { this.AX = q & 0xFFFF; this.DX = rm & 0xFFFF; }
              }
            }
          }
          if (fault) {
            this.note('erro', src === 0 ? mn + ' por zero na linha ' + ins.line + ': a CPU gera a interrupção 0 (Divide overflow).'
              : mn + ' na linha ' + ins.line + ': o quociente não cabe em ' + (s === 1 ? 'AL' : 'AX') + '. A CPU gera a interrupção 0.' + (s === 2 && mn === 'DIV' ? ' Lembre de zerar DX antes de DIV de 16 bits (XOR DX,DX).' : s === 2 ? ' Lembre de estender o sinal com CWD antes de IDIV.' : ''));
            this.cycles += cyc;
            this.ip = next;
            this._csBefore = this.CS; this._ipBefore = this.ip; this._redirected = false;
            this.interrupt(0, next);
            return 'ok';
          }
          break;
        }
        case 'CBW': this.AH = (this.AL & 0x80) ? 0xFF : 0; break;
        case 'CWD': this.DX = (this.AX & 0x8000) ? 0xFFFF : 0; break;
        case 'ROL': case 'ROR': case 'RCL': case 'RCR': case 'SHL': case 'SAL': case 'SHR': case 'SAR': {
          const s = a.t === 'r' ? a.size : a.size;
          const bits = s * 8, mask = s === 1 ? 0xFF : 0xFFFF, sign = s === 1 ? 0x80 : 0x8000;
          const count = b.t === 'r' ? this.CL : 1;
          if (b.t === 'r') cyc += (c.perBit || 4) * count;
          if (count === 0) break;
          let v = this.rd(a, s);
          const orig = v;
          let cf = this.flag(CF);
          for (let i = 0; i < count; i++) {
            switch (mn) {
              case 'ROL': cf = (v & sign) !== 0; v = ((v << 1) | (cf ? 1 : 0)) & mask; break;
              case 'ROR': cf = (v & 1) !== 0; v = (v >> 1) | (cf ? sign : 0); break;
              case 'RCL': { const o = (v & sign) !== 0; v = ((v << 1) | (cf ? 1 : 0)) & mask; cf = o; break; }
              case 'RCR': { const o = (v & 1) !== 0; v = (v >> 1) | (cf ? sign : 0); cf = o; break; }
              case 'SHL': case 'SAL': cf = (v & sign) !== 0; v = (v << 1) & mask; break;
              case 'SHR': cf = (v & 1) !== 0; v = v >> 1; break;
              case 'SAR': cf = (v & 1) !== 0; v = (v >> 1) | (v & sign); break;
            }
          }
          this.setFlag(CF, cf);
          const msb = (v & sign) !== 0;
          switch (mn) {
            case 'ROL': case 'RCL': case 'SHL': case 'SAL': this.setFlag(OF, msb !== cf); break;
            case 'ROR': case 'RCR': this.setFlag(OF, msb !== ((v & (sign >> 1)) !== 0)); break;
            case 'SHR': this.setFlag(OF, (orig & sign) !== 0); break;
            case 'SAR': this.setFlag(OF, false); break;
          }
          if (mn === 'SHL' || mn === 'SAL' || mn === 'SHR' || mn === 'SAR') { this.szp(v, s); this.setFlag(AF, false); }
          this.wr(a, s, v);
          break;
        }
        case 'JMP':
          if (ins.indirect) {
            if (ins.far) { const e = this.ea(a); const off = this.rw(e.seg, e.off), sg = this.rw(e.seg, (e.off + 2) & 0xFFFF); this.CS = sg; jump(off); }
            else jump(this.rd(a, 2));
          } else if (ins.far) { this.CS = ins.farTarget.seg; jump(ins.farTarget.off); }
          else jump(ins.target);
          break;
        case 'CALL': {
          let tSeg = this.CS, tOff;
          let far = ins.far;
          if (ins.indirect) {
            if (far) { const e = this.ea(a); tOff = this.rw(e.seg, e.off); tSeg = this.rw(e.seg, (e.off + 2) & 0xFFFF); }
            else tOff = this.rd(a, 2);
          } else if (far) { tSeg = ins.farTarget.seg; tOff = ins.farTarget.off; }
          else tOff = ins.target;
          if (far) this.push(this.CS);
          this.push(next);
          this.CS = tSeg; jump(tOff);
          this.callDepth++;
          break;
        }
        case 'RET': case 'RETN': case 'RETF': {
          const ip = this.pop();
          if (ins.far) this.CS = this.pop();
          this.SP = (this.SP + (ins.retN || 0)) & 0xFFFF;
          jump(ip);
          if (this.callDepth > 0) this.callDepth--;
          else if (this.prog && this.prog.model !== 'tiny' && this.modo !== 'boot' && !ins.far) {
            this.note('aviso', 'RET na linha ' + ins.line + ' sem CALL correspondente: o endereço de retorno veio de dados da pilha (' + hex(ip, 4) + 'h). Programas .EXE devem terminar com MOV AH,4Ch / INT 21h.', 'ret-orfao');
          }
          break;
        }
        case 'INT': case 'INTO': {
          const n = mn === 'INTO' ? 4 : ins.intNo;
          if (mn === 'INTO' && !this.flag(OF)) { cyc = 4; break; }
          this._csBefore = this.CS; this._ipBefore = this.ip; this._redirected = false; this._retIp = next;
          const r = this.interrupt(n, next);
          if (r === 'wait') return 'wait';
          this.cycles += cyc;
          return 'ok';
        }
        case 'IRET':
          jump(this.pop()); this.CS = this.pop(); this.flags = (this.pop() & 0x0FD5) | 0xF002;
          if (this.callDepth > 0) this.callDepth--;
          break;
        case 'LOOP': case 'LOOPE': case 'LOOPZ': case 'LOOPNE': case 'LOOPNZ': {
          if (this.CX === 0) this.note('aviso', 'LOOP na linha ' + ins.line + ' começou com CX=0: CX vira FFFFh e o laço roda 65.536 vezes. Use JCXZ antes do laço para evitar.', 'loop0-' + ins.line);
          this.CX = (this.CX - 1) & 0xFFFF;
          let take = this.CX !== 0;
          if (mn === 'LOOPE' || mn === 'LOOPZ') take = take && this.flag(ZF);
          if (mn === 'LOOPNE' || mn === 'LOOPNZ') take = take && !this.flag(ZF);
          if (take) { jump(ins.target); cyc = c.taken; }
          break;
        }
        case 'JCXZ': if (this.CX === 0) { jump(ins.target); cyc = c.taken; } break;
        case 'CLC': this.setFlag(CF, false); break;
        case 'STC': this.setFlag(CF, true); break;
        case 'CMC': this.setFlag(CF, !this.flag(CF)); break;
        case 'CLD': this.setFlag(DF, false); break;
        case 'STD': this.setFlag(DF, true); break;
        case 'CLI': this.setFlag(IF, false); break;
        case 'STI': this.setFlag(IF, true); break;
        case 'NOP': case 'WAIT': case 'FWAIT': break;
        case 'DOSIDLE': this.dosIdle(); this.cycles += 10; return 'ok';
        case 'HLT':
          if (this.modo === 'boot') {
            // sem DOS, HLT é a CPU dormindo até a próxima interrupção (ou parando de vez, se IF = 0)
            if (!this.flag(IF)) { this.halt('CLI + HLT: a CPU parou (com as interrupções desligadas, nada mais a acorda). É o jeito clássico de desligar o sistema.', 'terminado'); break; }
            this.hltEspera = true; break;
          }
          this.halt('HLT: a CPU parou e espera uma interrupção. No simulador, o programa é encerrado.', 'terminado');
          this.note('aviso', 'HLT executado na linha ' + ins.line + '. Programas DOS devem terminar com MOV AH,4Ch / INT 21h.');
          break;
        case 'XLAT': case 'XLATB': {
          const segName = (a && a.seg) || 'DS';
          this.AL = this.rb(this.s[SR[segName]], (this.BX + this.AL) & 0xFFFF);
          break;
        }
        case 'IN': {
          const port = b.t === 'r' ? this.DX : b.v;
          const s = a.size;
          const v = this.portIn(port, s);
          if (s === 1) this.AL = v; else this.AX = v;
          break;
        }
        case 'OUT': {
          const port = a.t === 'r' ? this.DX : a.v;
          this.portOut(port, b.size === 1 ? this.AL : this.AX, b.size);
          break;
        }
        case 'DAA': {
          const al = this.AL, cf = this.flag(CF);
          let v = al, ncf = false;
          if ((al & 0x0F) > 9 || this.flag(AF)) { v += 6; this.setFlag(AF, true); ncf = cf || v > 0xFF; } else this.setFlag(AF, false);
          if (al > 0x99 || cf) { v += 0x60; ncf = true; }
          this.AL = v; this.setFlag(CF, ncf); this.szp(v, 1); break;
        }
        case 'DAS': {
          const al = this.AL, cf = this.flag(CF);
          let v = al, ncf = false;
          if ((al & 0x0F) > 9 || this.flag(AF)) { v -= 6; this.setFlag(AF, true); ncf = cf || al < 6; } else this.setFlag(AF, false);
          if (al > 0x99 || cf) { v -= 0x60; ncf = true; }
          this.AL = v & 0xFF; this.setFlag(CF, ncf); this.szp(v, 1); break;
        }
        case 'AAA': case 'AAS': {
          if ((this.AL & 0x0F) > 9 || this.flag(AF)) {
            if (mn === 'AAA') { this.AX = (this.AX + 0x106) & 0xFFFF; } else { this.AL = this.AL - 6; this.AH = this.AH - 1; }
            this.setFlag(AF, true); this.setFlag(CF, true);
          } else { this.setFlag(AF, false); this.setFlag(CF, false); }
          this.AL = this.AL & 0x0F; break;
        }
        case 'AAM': {
          const al = this.AL; this.AH = Math.floor(al / 10); this.AL = al % 10; this.szp(this.AL, 1); break;
        }
        case 'AAD': { this.AL = (this.AH * 10 + this.AL) & 0xFF; this.AH = 0; this.szp(this.AL, 1); break; }
        default:
          if (/^(MOVS|CMPS|STOS|LODS|SCAS)[BW]$/.test(mn)) { cyc = this.stringOp(ins, c); break; }
          this.halt('Instrução não implementada no simulador: ' + mn, 'erro');
          return 'ok';
      }
      if (!jumped) this.ip = next;
      this.cycles += cyc;
      // verificação de pilha
      if (this.prog && this.prog.stack && this.prog.stack.bottom !== undefined && this.SS === this.prog.stack.seg && this.SP < this.prog.stack.bottom && this.prog.model === 'small') {
        this.note('aviso', 'Estouro de pilha: SP (' + hex(this.SP, 4) + 'h) passou do início da área de pilha e está sobrescrevendo seus dados. Recursão sem fim ou PUSH sem POP?', 'stack-ovf');
      }
      return 'ok';
    }

    stringOp(ins, c) {
      const mn = ins.mn;
      const w = mn.endsWith('W') ? 2 : 1;
      const d = this.flag(DF) ? -w : w;
      const srcSegName = (ins.ops[0] && ins.ops[0].seg) || 'DS';
      const srcSeg = this.s[SR[srcSegName]];
      const rep = ins.prefix;
      const once = () => {
        switch (mn.slice(0, 4)) {
          case 'MOVS': {
            const v = w === 1 ? this.rb(srcSeg, this.SI) : this.rw(srcSeg, this.SI);
            if (w === 1) this.wb(this.ES, this.DI, v); else this.ww(this.ES, this.DI, v);
            this.SI = (this.SI + d) & 0xFFFF; this.DI = (this.DI + d) & 0xFFFF; break;
          }
          case 'STOS':
            if (w === 1) this.wb(this.ES, this.DI, this.AL); else this.ww(this.ES, this.DI, this.AX);
            this.DI = (this.DI + d) & 0xFFFF; break;
          case 'LODS':
            if (w === 1) this.AL = this.rb(srcSeg, this.SI); else this.AX = this.rw(srcSeg, this.SI);
            this.SI = (this.SI + d) & 0xFFFF; break;
          case 'CMPS': {
            const x = w === 1 ? this.rb(srcSeg, this.SI) : this.rw(srcSeg, this.SI);
            const y = w === 1 ? this.rb(this.ES, this.DI) : this.rw(this.ES, this.DI);
            this.sub(x, y, 0, w);
            this.SI = (this.SI + d) & 0xFFFF; this.DI = (this.DI + d) & 0xFFFF; break;
          }
          case 'SCAS': {
            const y = w === 1 ? this.rb(this.ES, this.DI) : this.rw(this.ES, this.DI);
            this.sub(w === 1 ? this.AL : this.AX, y, 0, w);
            this.DI = (this.DI + d) & 0xFFFF; break;
          }
        }
      };
      if (!rep || rep === 'LOCK') { once(); return c.base; }
      let n = 0;
      const cond = /^(CMPS|SCAS)/.test(mn);
      while (this.CX !== 0) {
        once();
        this.CX = (this.CX - 1) & 0xFFFF;
        n++;
        if (cond) {
          if ((rep === 'REPE' || rep === 'REPZ' || rep === 'REP') && !this.flag(ZF)) break;
          if ((rep === 'REPNE' || rep === 'REPNZ') && this.flag(ZF)) break;
        }
        if (n > 70000) break;
      }
      return c.base + (c.rep || 17) * n;
    }

    // ---------------- DOS: resultado das funções ----------------
    dosOk(ax) { this.setRetFlag(CF, false); if (ax !== undefined) this.AX = ax & 0xFFFF; return 'ok'; }
    dosErro(cod) {
      this.setRetFlag(CF, true); this.AX = cod;
      if (cod !== 18) this.note('info', 'INT 21h, AH=' + hex(this._ahErro || 0, 2) + 'h devolveu o erro ' + cod + ' (' + (ERROS_DOS[cod] || '?') + '): CF=1, AX=' + cod + '.');
      return 'ok';
    }
    lerNome(seg, off) {
      let s = '';
      for (let i = 0; i < 128; i++) { const c = this.rb(seg, (off + i) & 0xFFFF); if (!c) break; s += String.fromCharCode(c); }
      return s;
    }
    // nome no disco: maiúsculas, sem "C:\"; devolve null se o nome não for 8.3 válido
    nomeArquivo(s) {
      let n = s.trim().toUpperCase();
      if (/^[A-Z]:/.test(n)) { if (n[0] !== 'C') return { erro: 3 }; n = n.slice(2); }
      if (n.startsWith('\\')) n = n.slice(1);
      if (n.includes('\\')) return { erro: 3 };
      if (['CON', 'NUL', 'PRN', 'AUX'].includes(n.replace(/\..*$/, ''))) return { dispositivo: n.replace(/\..*$/, '') };
      const m = /^([A-Z0-9_$~!#%&\-{}()@'`^]{1,8})(?:\.([A-Z0-9_$~!#%&\-{}()@'`^]{0,3}))?$/.exec(n);
      if (!m) return { erro: 3 };
      return { nome: m[1] + (m[2] ? '.' + m[2] : '') };
    }
    novoHandle(h) {
      for (let i = 0; i < 20; i++) if (!this.handles[i]) { this.handles[i] = h; return i; }
      return -1;
    }
    dosArquivo(ah) {
      this._ahErro = ah;
      const H = this.handles;
      switch (ah) {
        case 0x3C: case 0x3D: {
          const r = this.nomeArquivo(this.lerNome(this.DS, this.DX));
          if (r.erro) return this.dosErro(r.erro);
          const modo = ah === 0x3C ? 2 : this.AL & 7;
          if (modo > 2) return this.dosErro(12);
          let h;
          if (r.dispositivo) h = { tipo: r.dispositivo === 'CON' ? 'con' : 'nul', modo };
          else {
            let f = this.disco.get(r.nome);
            if (ah === 0x3D && !f) return this.dosErro(2);
            if (f && (f.attr & 1) && (ah === 0x3C || modo !== 0)) return this.dosErro(5);
            if (ah === 0x3C) { f = { dados: [], attr: this.CX & 0x27 }; this.disco.set(r.nome, f); }
            h = { tipo: 'arq', nome: r.nome, arq: f, pos: 0, modo };
          }
          const n = this.novoHandle(h);
          if (n < 0) return this.dosErro(4);
          return this.dosOk(n);
        }
        case 0x3E: {
          if (!H[this.BX]) return this.dosErro(6);
          H[this.BX] = null; return this.dosOk();
        }
        case 0x3F: {
          const h = H[this.BX];
          if (!h) return this.dosErro(6);
          if (h.modo === 1) return this.dosErro(5);
          const n = this.CX;
          if (h.tipo === 'nul') return this.dosOk(0);
          if (h.tipo === 'con') {
            // console: lê uma linha inteira (com eco) e entrega até CX bytes, terminando em CR LF
            if (!this.conBuf.length) {
              if (!this.lineInput) this.lineInput = { chars: [] };
              const li = this.lineInput;
              for (;;) {
                const k = this.readKey();
                if (!k) return 'wait';
                if (k.ascii === 13) { this.teletype(13); this.teletype(10); this.conBuf = li.chars.concat([13, 10]); this.lineInput = null; break; }
                if (k.ascii === 8) { if (li.chars.length) { li.chars.pop(); this.teletype(8); this.teletype(32); this.teletype(8); } continue; }
                if (k.ascii === 0) continue;
                if (li.chars.length >= 127) continue;
                li.chars.push(k.ascii); this.teletype(k.ascii);
              }
            }
            const parte = this.conBuf.splice(0, n);
            parte.forEach((c, i) => this.wb(this.DS, (this.DX + i) & 0xFFFF, c));
            return this.dosOk(parte.length);
          }
          const d = h.arq.dados;
          const qtd = Math.max(0, Math.min(n, d.length - h.pos));
          for (let i = 0; i < qtd; i++) this.wb(this.DS, (this.DX + i) & 0xFFFF, d[h.pos + i]);
          h.pos += qtd;
          this.cycles += qtd * 2;
          return this.dosOk(qtd);
        }
        case 0x40: {
          const h = H[this.BX];
          if (!h) return this.dosErro(6);
          if (h.modo === 0) return this.dosErro(5);
          const n = this.CX;
          if (h.tipo === 'nul') return this.dosOk(n);
          if (h.tipo === 'con') { for (let i = 0; i < n; i++) this.teletype(this.rb(this.DS, (this.DX + i) & 0xFFFF)); return this.dosOk(n); }
          const d = h.arq.dados;
          if (n === 0) { d.length = h.pos; return this.dosOk(0); }
          while (d.length < h.pos) d.push(0);
          for (let i = 0; i < n; i++) d[h.pos + i] = this.rb(this.DS, (this.DX + i) & 0xFFFF);
          h.pos += n;
          this.cycles += n * 2;
          if (this.onDisco) this.onDisco();
          return this.dosOk(n);
        }
        case 0x41: {
          const r = this.nomeArquivo(this.lerNome(this.DS, this.DX));
          if (r.erro || r.dispositivo) return this.dosErro(r.erro || 5);
          const f = this.disco.get(r.nome);
          if (!f) return this.dosErro(2);
          if (f.attr & 1) return this.dosErro(5);
          this.disco.delete(r.nome);
          if (this.onDisco) this.onDisco();
          return this.dosOk();
        }
        case 0x42: {
          const h = H[this.BX];
          if (!h) return this.dosErro(6);
          if (this.AL > 2) return this.dosErro(1);
          let desl = ((this.CX << 16) | this.DX) | 0;
          const tam = h.tipo === 'arq' ? h.arq.dados.length : 0;
          const base = this.AL === 0 ? 0 : this.AL === 1 ? (h.pos || 0) : tam;
          if (this.AL === 0) desl = desl >>> 0;
          const pos = base + desl;
          if (pos < 0) return this.dosErro(25);
          if (h.tipo === 'arq') h.pos = pos;
          this.DX = (pos >>> 16) & 0xFFFF;
          return this.dosOk(pos & 0xFFFF);
        }
        case 0x43: {
          const r = this.nomeArquivo(this.lerNome(this.DS, this.DX));
          if (r.erro) return this.dosErro(r.erro);
          const f = r.nome && this.disco.get(r.nome);
          if (!f) return this.dosErro(2);
          if (this.AL === 0) { this.CX = f.attr; return this.dosOk(); }
          f.attr = this.CX & 0x27; return this.dosOk();
        }
        case 0x44: {
          const h = H[this.BX];
          if (!h) return this.dosErro(6);
          if (this.AL !== 0) return this.dosErro(1);
          this.DX = h.tipo === 'con' ? (this.BX === 0 ? 0x80D3 : 0x80D3) : h.tipo === 'nul' ? 0x8084 : 0x0002;
          return this.dosOk();
        }
        case 0x45: {
          const h = H[this.BX];
          if (!h) return this.dosErro(6);
          const n = this.novoHandle(h);
          return n < 0 ? this.dosErro(4) : this.dosOk(n);
        }
        case 0x46: {
          const h = H[this.BX];
          if (!h || this.CX >= 20) return this.dosErro(6);
          H[this.CX] = h; return this.dosOk();
        }
        case 0x56: {
          const a = this.nomeArquivo(this.lerNome(this.DS, this.DX)), b = this.nomeArquivo(this.lerNome(this.ES, this.DI));
          if (a.erro || b.erro || a.dispositivo || b.dispositivo) return this.dosErro(a.erro || b.erro || 5);
          const f = this.disco.get(a.nome);
          if (!f) return this.dosErro(2);
          if (this.disco.has(b.nome)) return this.dosErro(5);
          this.disco.delete(a.nome); this.disco.set(b.nome, f);
          if (this.onDisco) this.onDisco();
          return this.dosOk();
        }
        case 0x4E: case 0x4F: {
          if (ah === 0x4E) {
            const padrao = this.lerNome(this.DS, this.DX).toUpperCase().replace(/^C:/, '').replace(/^\\/, '');
            const [pn, pe] = padrao.includes('.') ? padrao.split('.') : [padrao, padrao === '*' ? '*' : ''];
            const casa = (p, t, len) => {
              p = (p.replace(/\*.*$/, (m) => '?'.repeat(len)) + ' '.repeat(len)).slice(0, len);
              t = (t + ' '.repeat(len)).slice(0, len);
              for (let i = 0; i < len; i++) if (p[i] !== '?' && p[i] !== t[i]) return false;
              return true;
            };
            const lista = [...this.disco.keys()].sort().filter(nome => {
              const [n, e] = nome.includes('.') ? nome.split('.') : [nome, ''];
              const f = this.disco.get(nome);
              return casa(pn, n, 8) && casa(pe || '', e, 3) && (!(f.attr & 6) || (this.CX & f.attr & 6));
            });
            this.busca = { lista, i: 0 };
          }
          if (!this.busca || this.busca.i >= this.busca.lista.length) return this.dosErro(18);
          const nome = this.busca.lista[this.busca.i++];
          const f = this.disco.get(nome);
          const { seg, off } = this.dta;
          this.wb(seg, off + 0x15, f.attr);
          this.ww(seg, off + 0x16, (12 << 11) | (0 << 5));                     // 12:00
          this.ww(seg, off + 0x18, ((1994 - 1980) << 9) | (6 << 5) | 15);     // 15/06/1994
          this.ww(seg, off + 0x1A, f.dados.length & 0xFFFF); this.ww(seg, off + 0x1C, f.dados.length >>> 16);
          for (let i = 0; i < 13; i++) this.wb(seg, off + 0x1E + i, i < nome.length ? nome.charCodeAt(i) : 0);
          return this.dosOk(0);
        }
      }
      return this.dosErro(1);
    }

    // ---------------- DOS: memória (cadeia de MCBs) ----------------
    gravarMCBs() {
      this.mcbs.sort((a, b) => a.seg - b.seg);
      this.mcbs.forEach((b, i) => {
        const a = b.seg * 16;
        this.mem[a] = i === this.mcbs.length - 1 ? 0x5A : 0x4D;   // 'Z' no último bloco, 'M' nos outros
        this.mem[a + 1] = b.dono & 0xFF; this.mem[a + 2] = b.dono >> 8;
        this.mem[a + 3] = b.size & 0xFF; this.mem[a + 4] = b.size >> 8;
        for (let k = 0; k < 8; k++) this.mem[a + 8 + k] = k < b.nome.length ? b.nome.charCodeAt(k) : 0;
      });
    }
    juntarLivres() {
      for (let i = 0; i < this.mcbs.length - 1;) {
        const a = this.mcbs[i], b = this.mcbs[i + 1];
        if (!a.dono && !b.dono) { a.size += 1 + b.size; this.mcbs.splice(i + 1, 1); } else i++;
      }
    }
    redimensionar(bloco, novo) {
      const i = this.mcbs.indexOf(bloco), prox = this.mcbs[i + 1];
      if (novo <= bloco.size) {
        if (novo < bloco.size) { this.mcbs.splice(i + 1, 0, { seg: bloco.seg + 1 + novo, size: bloco.size - novo - 1, dono: 0, nome: '' }); bloco.size = novo; }
        this.juntarLivres(); this.gravarMCBs();
        return true;
      }
      const max = bloco.size + (prox && !prox.dono ? 1 + prox.size : 0);
      if (novo > max) return max;
      this.mcbs.splice(i + 1, 1);
      if (novo < max) this.mcbs.splice(i + 1, 0, { seg: bloco.seg + 1 + novo, size: max - novo - 1, dono: 0, nome: '' });
      bloco.size = novo;
      this.gravarMCBs();
      return true;
    }
    dosMemoria(ah) {
      this._ahErro = ah;
      const dono = this.residente ? this.residente.psp : (this.prog ? this.prog.pspSeg : 0x700);
      if (ah === 0x48) {
        const pedido = this.BX;
        const livre = this.mcbs.find(b => !b.dono && b.size >= pedido);
        if (!livre) { this.dosErro(8); this.BX = this.mcbs.reduce((m, b) => b.dono ? m : Math.max(m, b.size), 0); return 'ok'; }
        livre.dono = dono;
        this.redimensionar(livre, pedido);
        return this.dosOk(livre.seg + 1);
      }
      const bloco = this.mcbs.find(b => b.seg + 1 === this.ES);
      if (!bloco || !bloco.dono) return this.dosErro(9);
      if (ah === 0x49) { bloco.dono = 0; bloco.nome = ''; this.juntarLivres(); this.gravarMCBs(); return this.dosOk(); }
      const r = this.redimensionar(bloco, this.BX);
      if (r !== true) { this.dosErro(8); this.BX = r; return 'ok'; }
      return this.dosOk();
    }

    // ---------------- TSR: termina e fica residente ----------------
    terminarResidente(paras) {
      const psp = this.prog ? this.prog.pspSeg : 0x700;
      const bloco = this.mcbs.find(b => b.seg + 1 === psp);
      paras = Math.max(paras, 6);
      if (bloco) this.redimensionar(bloco, Math.min(paras, bloco.size));
      this.exitCode = this.AL;
      this.residente = { psp, paras, passo: this.steps };
      this.note('info', 'Programa residente: ' + paras + ' parágrafos (' + paras * 16 + ' bytes) ficaram na memória. O DOS voltou ao prompt; as interrupções que o programa instalou continuam funcionando.');
      this.entrarNoPrompt();
    }
    entrarNoPrompt() {
      this.CS = BIOS_SEG; this.ip = IDLE_OFF;
      this.SS = DOS_SEG; this.SP = 0x0400;
      this.DS = DOS_SEG; this.ES = DOS_SEG;
      this.setFlag(IF, true); this.setFlag(DF, false);
      this.opts.timer = true;
      this.callDepth = 0;
      this.status = 'executando';
      this.printStr('\r\nC:\\CURSO>');
    }
    dosIdle() {
      // COMMAND.COM esperando um comando: ecoa o que for digitado e chama a INT 28h (ociosidade do DOS)
      const k = this.readKey();
      if (k) {
        if (k.ascii === 13) this.printStr('\r\nComando ou nome de arquivo inválido\r\n\r\nC:\\CURSO>');
        else if (k.ascii === 8) { const c = this.getCursor(); if (c.col > 9) { this.teletype(8); this.teletype(32); this.teletype(8); } }
        else if (k.ascii >= 32) this.teletype(k.ascii);
      }
      if (!this.isDefaultVector(0x28) && (this.steps & 63) === 0) {
        this._csBefore = this.CS; this._ipBefore = this.ip; this._redirected = false; this._retIp = this.ip;
        this.interrupt(0x28, this.ip);
      }
    }

    // ---------------- coprocessador 8087 ----------------
    fpuReset() {
      this.fpu = { r: new Float64Array(8), tag: new Uint8Array(8).fill(3), top: 0, sw: 0, cw: 0x03FF, usado: this.fpu ? this.fpu.usado : false };
    }
    fpuSW() { const f = this.fpu; return (f.sw & ~0x3800) | (f.top << 11); }
    fpuErro(bit, msg) {
      this.fpu.sw |= bit | (this.fpu.cw & bit ? 0 : 0x80);
      if (msg) this.note('aviso', msg, 'fpu-' + bit + '-' + this.curLine);
    }
    fget(i) {
      const f = this.fpu, p = (f.top + i) & 7;
      if (f.tag[p] === 3) { this.fpuErro(1, 'Linha ' + this.curLine + ': ST(' + i + ') está vazio (pilha do 8087 sem valores suficientes). O resultado vira "indefinido" (NaN).'); return NaN; }
      return f.r[p];
    }
    fset(i, v) { const f = this.fpu, p = (f.top + i) & 7; f.r[p] = v; f.tag[p] = 0; }
    fpush(v) {
      const f = this.fpu;
      f.top = (f.top - 1) & 7;
      if (f.tag[f.top] !== 3) { this.fpuErro(1, 'Linha ' + this.curLine + ': estouro da pilha do 8087 (mais de 8 valores). Faltou um FSTP ou FFREE?'); v = NaN; }
      f.r[f.top] = v; f.tag[f.top] = 0;
    }
    fpop() { const f = this.fpu; f.tag[f.top] = 3; f.top = (f.top + 1) & 7; }
    arred(v) {
      switch ((this.fpu.cw >> 10) & 3) {
        case 0: { const r = Math.round(v); return (Math.abs(v % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r; }   // ao par mais próximo
        case 1: return Math.floor(v);
        case 2: return Math.ceil(v);
        default: return Math.trunc(v);
      }
    }
    fmemLer(tipo, e) {
      const b = (n) => { const out = []; for (let i = 0; i < n; i++) out.push(this.rb(e.seg, (e.off + i) & 0xFFFF)); return out; };
      switch (tipo) {
        case 'f32': return Asm.Real.de32(b(4));
        case 'f64': return Asm.Real.de64(b(8));
        case 'f80': return Asm.Real.de80(b(10));
        case 'i16': { const v = this.rw(e.seg, e.off); return (v << 16) >> 16; }
        case 'i32': { const x = b(4); return (x[0] | (x[1] << 8) | (x[2] << 16) | (x[3] << 24)); }
        case 'i64': { const x = b(8); let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(x[i]); return Number(BigInt.asIntN(64, v)); }
        case 'bcd': return Asm.Real.debcd(b(10));
      }
      return NaN;
    }
    fmemGravar(tipo, e, v) {
      let bytes;
      const inteiro = (bits) => {
        const lim = 2 ** (bits - 1);
        let n = this.arred(v);
        if (!Number.isFinite(n) || n >= lim || n < -lim) { this.fpuErro(1, 'Linha ' + this.curLine + ': o valor ' + v + ' não cabe num inteiro de ' + bits + ' bits; o 8087 grava o "inteiro indefinido".'); n = -lim; }
        if (n !== v) this.fpu.sw |= 0x20;
        let x = BigInt.asUintN(bits, BigInt(n));
        const out = []; for (let i = 0; i < bits / 8; i++) { out.push(Number(x & 0xFFn)); x >>= 8n; }
        return out;
      };
      switch (tipo) {
        case 'f32': bytes = Asm.Real.f32(v); break;
        case 'f64': bytes = Asm.Real.f64(v); break;
        case 'f80': bytes = Asm.Real.f80(v); break;
        case 'i16': bytes = inteiro(16); break;
        case 'i32': bytes = inteiro(32); break;
        case 'i64': bytes = inteiro(64); break;
        case 'bcd': {
          const n = this.arred(v);
          if (!Number.isFinite(n) || Math.abs(n) > 999999999999999999) { this.fpuErro(1, 'Linha ' + this.curLine + ': valor grande demais para BCD de 18 dígitos.'); bytes = [0, 0, 0, 0, 0, 0, 0, 0, 0xC0, 0xFF].reverse(); }
          else bytes = Asm.Real.bcd(n);
          break;
        }
      }
      this.lastWrite = { seg: e.seg, off: e.off, size: bytes.length };
      bytes.forEach((x, i) => this.wb(e.seg, (e.off + i) & 0xFFFF, x));
    }
    fcompara(a, b) {
      const f = this.fpu;
      f.sw &= ~(0x4000 | 0x400 | 0x100);
      if (Number.isNaN(a) || Number.isNaN(b)) { f.sw |= 0x4000 | 0x400 | 0x100; this.fpuErro(1); }
      else if (a < b) f.sw |= 0x100;
      else if (a === b) f.sw |= 0x4000;
    }
    execFPU(ins) {
      const d = ins.fpu, f = this.fpu, op = d.op;
      f.usado = true;
      const mem = () => this.ea(ins.ops[0]);
      switch (d.k) {
        case 'ld':
          if (d.mem) this.fpush(this.fmemLer(d.mem, mem()));
          else { const v = this.fget(d.st); this.fpush(v); }
          return;
        case 'st': {
          const v = this.fget(0);
          if (d.mem) this.fmemGravar(d.mem, mem(), v);
          else this.fset(d.st, v);
          if (d.pop) this.fpop();
          return;
        }
        case 'arit': case 'com': {
          const src = d.src.mem ? this.fmemLer(d.src.mem, mem()) : this.fget(d.src.st);
          if (d.k === 'com') {
            this.fcompara(this.fget(0), src);
            if (d.pop) this.fpop();
            if (op === 'FCOMPP') this.fpop();
            return;
          }
          const a = this.fget(d.dest);
          let r;
          switch (d.f) {
            case 'ADD': r = a + src; break;
            case 'MUL': r = a * src; break;
            case 'SUB': r = a - src; break;
            case 'SUBR': r = src - a; break;
            case 'DIV': case 'DIVR': {
              const [x, y] = d.f === 'DIV' ? [a, src] : [src, a];
              if (y === 0 && x !== 0 && !Number.isNaN(x)) this.fpuErro(4, 'Linha ' + this.curLine + ': divisão por zero no 8087. Com a exceção mascarada (padrão), o resultado é infinito.');
              if (y === 0 && x === 0) this.fpuErro(1, 'Linha ' + this.curLine + ': 0/0 no 8087 dá "indefinido" (NaN).');
              r = x / y; break;
            }
          }
          this.fset(d.dest, r);
          if (d.pop) this.fpop();
          return;
        }
        case 'xch': { const a = this.fget(0), b = this.fget(d.st); this.fset(0, b); this.fset(d.st, a); return; }
        case 'free': f.tag[(f.top + d.st) & 7] = 3; return;
        case 'ldcw': f.cw = this.rw(mem().seg, mem().off); return;
        case 'stcw': { const e = mem(); this.ww(e.seg, e.off, f.cw); this.lastWrite = { seg: e.seg, off: e.off, size: 2 }; return; }
        case 'stsw': { const e = mem(); this.ww(e.seg, e.off, this.fpuSW()); this.lastWrite = { seg: e.seg, off: e.off, size: 2 }; return; }
      }
      switch (op) {
        case 'FINIT': case 'FNINIT': this.fpuReset(); f.usado = true; this.fpu.usado = true; return;
        case 'FCLEX': case 'FNCLEX': f.sw &= 0x7F00; return;
        case 'FENI': case 'FNENI': f.cw &= ~0x80; return;
        case 'FDISI': case 'FNDISI': f.cw |= 0x80; return;
        case 'FLDZ': this.fpush(0); return;
        case 'FLD1': this.fpush(1); return;
        case 'FLDPI': this.fpush(Math.PI); return;
        case 'FLDL2T': this.fpush(Math.log2(10)); return;
        case 'FLDL2E': this.fpush(Math.LOG2E); return;
        case 'FLDLG2': this.fpush(Math.log10(2)); return;
        case 'FLDLN2': this.fpush(Math.LN2); return;
        case 'FCHS': this.fset(0, -this.fget(0)); return;
        case 'FABS': this.fset(0, Math.abs(this.fget(0))); return;
        case 'FSQRT': { const v = this.fget(0); if (v < 0) this.fpuErro(1, 'Linha ' + this.curLine + ': raiz quadrada de número negativo dá "indefinido" (NaN).'); this.fset(0, Math.sqrt(v)); return; }
        case 'FRNDINT': this.fset(0, this.arred(this.fget(0))); return;
        case 'FTST': this.fcompara(this.fget(0), 0); return;
        case 'FXAM': {
          const v = this.fget(0), p = (f.top) & 7;
          f.sw &= ~(0x4000 | 0x400 | 0x200 | 0x100);
          if (v < 0 || Object.is(v, -0)) f.sw |= 0x200;
          if (f.tag[p] === 3) f.sw |= 0x4000 | 0x100;
          else if (Number.isNaN(v)) f.sw |= 0x100;
          else if (!Number.isFinite(v)) f.sw |= 0x400 | 0x100;
          else if (v === 0) f.sw |= 0x4000;
          else f.sw |= 0x400;
          return;
        }
        case 'FSCALE': this.fset(0, this.fget(0) * Math.pow(2, Math.trunc(this.fget(1)))); return;
        case 'FPREM': {
          const a = this.fget(0), b = this.fget(1);
          const q = Math.trunc(a / b);
          this.fset(0, a - q * b);
          f.sw &= ~(0x4000 | 0x400 | 0x200 | 0x100);
          const qa = Math.abs(q);
          if (qa & 4) f.sw |= 0x100; if (qa & 2) f.sw |= 0x4000; if (qa & 1) f.sw |= 0x200;
          return;
        }
        case 'FXTRACT': {
          const v = this.fget(0);
          if (v === 0 || !Number.isFinite(v)) { this.fset(0, -Infinity); this.fpush(v); return; }
          const e = Math.floor(Math.log2(Math.abs(v)));
          this.fset(0, e); this.fpush(v / Math.pow(2, e));
          return;
        }
        case 'FPTAN': { const v = this.fget(0); this.fset(0, Math.tan(v)); this.fpush(1); return; }
        case 'FPATAN': { const x = this.fget(0), y = this.fget(1); this.fset(1, Math.atan2(y, x)); this.fpop(); return; }
        case 'F2XM1': this.fset(0, Math.pow(2, this.fget(0)) - 1); return;
        case 'FYL2X': { const x = this.fget(0), y = this.fget(1); this.fset(1, y * Math.log2(x)); this.fpop(); return; }
        case 'FYL2XP1': { const x = this.fget(0), y = this.fget(1); this.fset(1, y * Math.log2(x + 1)); this.fpop(); return; }
        case 'FDECSTP': f.top = (f.top - 1) & 7; return;
        case 'FINCSTP': f.top = (f.top + 1) & 7; return;
        case 'FNOP': return;
        case 'FCOMPP': this.fcompara(this.fget(0), this.fget(1)); this.fpop(); this.fpop(); return;
      }
      this.halt('Instrução do 8087 não implementada no simulador: ' + op, 'erro');
    }
    fpuPilha() {
      const f = this.fpu, out = [];
      for (let i = 0; i < 8; i++) { const p = (f.top + i) & 7; out.push(f.tag[p] === 3 ? null : f.r[p]); }
      return out;
    }

    // ---------------- inspeção ----------------
    snapshot() {
      return {
        AX: this.AX, BX: this.BX, CX: this.CX, DX: this.DX, SI: this.SI, DI: this.DI, BP: this.BP, SP: this.SP,
        CS: this.CS, DS: this.DS, ES: this.ES, SS: this.SS, IP: this.ip, FLAGS: this.flags
      };
    }
    readSymbol(name, type) {
      const s = this.prog && this.prog.symbols[name.toUpperCase()];
      if (!s) throw new Error('Variável não encontrada: ' + name);
      const size = type || (typeof s.type === 'number' ? s.type : 2);
      const base = s.seg * 16 + s.off;
      if (size === 1) return this.mem[base & 0xFFFFF];
      if (size === 4) return (this.mem[base] | (this.mem[base + 1] << 8) | (this.mem[base + 2] << 16) | (this.mem[base + 3] << 24)) >>> 0;
      return this.mem[base & 0xFFFFF] | (this.mem[(base + 1) & 0xFFFFF] << 8);
    }
  }

  const JCC_COND = {
    JO: m => m.flag(OF), JNO: m => !m.flag(OF),
    JB: m => m.flag(CF), JC: m => m.flag(CF), JNAE: m => m.flag(CF),
    JAE: m => !m.flag(CF), JNB: m => !m.flag(CF), JNC: m => !m.flag(CF),
    JE: m => m.flag(ZF), JZ: m => m.flag(ZF), JNE: m => !m.flag(ZF), JNZ: m => !m.flag(ZF),
    JBE: m => m.flag(CF) || m.flag(ZF), JNA: m => m.flag(CF) || m.flag(ZF),
    JA: m => !m.flag(CF) && !m.flag(ZF), JNBE: m => !m.flag(CF) && !m.flag(ZF),
    JS: m => m.flag(SF), JNS: m => !m.flag(SF), JP: m => m.flag(PF), JPE: m => m.flag(PF), JNP: m => !m.flag(PF), JPO: m => !m.flag(PF),
    JL: m => m.flag(SF) !== m.flag(OF), JNGE: m => m.flag(SF) !== m.flag(OF),
    JGE: m => m.flag(SF) === m.flag(OF), JNL: m => m.flag(SF) === m.flag(OF),
    JLE: m => m.flag(ZF) || m.flag(SF) !== m.flag(OF), JNG: m => m.flag(ZF) || m.flag(SF) !== m.flag(OF),
    JG: m => !m.flag(ZF) && m.flag(SF) === m.flag(OF), JNLE: m => !m.flag(ZF) && m.flag(SF) === m.flag(OF)
  };

  // saltos condicionais: adiciona ao exec via protótipo
  const baseExec = Machine.prototype.exec;
  Machine.prototype.exec = function (ins) {
    const cond = JCC_COND[ins.mn];
    if (cond) {
      const c = ins.cycles;
      if (cond(this)) { this.ip = ins.target & 0xFFFF; this.cycles += c.taken; }
      else { this.ip = (this.ip + ins.size) & 0xFFFF; this.cycles += c.base; }
      return 'ok';
    }
    return baseExec.call(this, ins);
  };

  // Executa um programa até o fim, sem interface (usado pelos exercícios)
  // scan codes do teclado americano (conjunto 1), para INT 16h devolver AH realista
  const SCAN_LINHAS = [['1234567890-=', 0x02], ['qwertyuiop[]', 0x10], ["asdfghjkl;'`", 0x1E], ['\\zxcvbnm,./', 0x2B]];
  const SCAN_SHIFT = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '~': '`', '|': '\\', '<': ',', '>': '.', '?': '/' };
  function scanDe(ch) {
    if (ch === ' ') return 0x39;
    if (ch === '\t') return 0x0F;
    const c = SCAN_SHIFT[ch] || ch.toLowerCase();
    for (const [linha, base] of SCAN_LINHAS) { const i = linha.indexOf(c); if (i >= 0) return base + i; }
    return 0;
  }

  // ---------------- imagem do disquete ----------------
  // conteúdo de cada segmento: do primeiro byte gerado até o fim do segmento (o ORG inicial não ocupa o disco)
  function conteudoSegmentos(prog) {
    const out = [];
    for (const sg of prog.segments) {
      const base = sg.base * 16;
      const blocos = prog.image.filter(b => b.bytes.length && b.addr >= base && b.addr < base + sg.size);
      if (!blocos.length) continue;
      const inicio = Math.min(...blocos.map(b => b.addr)) - base;
      out.push({ nome: sg.name, inicio, bytes: sg.size - inicio, base, blocos });
    }
    return out;
  }
  function byteDoSegmento(c, off) {
    for (const b of c.blocos) { const i = c.base + c.inicio + off - b.addr; if (i >= 0 && i < b.bytes.length) return b.bytes[i]; }
    return 0;
  }
  // um programa é um disquete de boot quando o primeiro segmento tem 512 bytes ou mais e o setor termina com 55h AAh
  function ehDisquete(prog) {
    if (prog && prog.disquete) return true;
    if (!prog || !prog.ok || prog.model === 'small' || prog.multiarquivo) return false;
    const c = conteudoSegmentos(prog)[0];
    return !!c && c.bytes >= 512 && byteDoSegmento(c, 510) === 0x55 && byteDoSegmento(c, 511) === 0xAA;
  }
  function montarDisquete(prog) {
    const dados = new Uint8Array(DISQUETE.bytes);
    const mapa = [];
    let lba = 0;
    for (const c of conteudoSegmentos(prog)) {
      const setores = Math.ceil(c.bytes / 512);
      if ((lba + setores) * 512 > DISQUETE.bytes) return { erro: 'O programa não cabe num disquete de 1,44 MB.' };
      for (const b of c.blocos) dados.set(b.bytes, lba * 512 + (b.addr - c.base - c.inicio));
      mapa.push({ nome: c.nome, lba, setores, bytes: c.bytes, org: c.inicio });
      lba += setores;
    }
    return { dados, mapa };
  }

  // ---------------- disco com vários arquivos (MINIFS) ----------------
  // Um fonte pode trazer vários programas, cada um começando numa linha
  //   ;### ARQUIVO NOME.EXT
  // e indo até o próximo marcador. Cada parte é um programa completo (com seu END),
  // montado separadamente; o primeiro é o setor de boot. Uma parte também pode vir
  // de um bloco de código de uma aula:  ;### ARQUIVO COBRA.COM = aula33/COBRA.ASM
  // O disco gerado: setor 0 = boot, setor 1 = diretório (16 entradas de 32 bytes),
  // e os arquivos a partir do setor 2, cada um começando num setor novo.
  const RE_ARQUIVO = /^\s*;###\s*ARQUIVO\s+([^\s=]+)\s*(?:=\s*(\S+))?/i;
  const MINIFS = { entradas: 16, tamEntrada: 32, setorDiretorio: 1, primeiroSetor: 2 };

  function partesDoFonte(source) {
    const linhas = String(source).replace(/\r\n/g, '\n').split('\n');
    const partes = [];
    linhas.forEach((l, i) => {
      const m = RE_ARQUIVO.exec(l);
      if (m) partes.push({ nome: m[1].toUpperCase(), ref: m[2] || null, linha: i + 1, ini: i, fim: linhas.length });
    });
    for (let k = 0; k + 1 < partes.length; k++) partes[k].fim = partes[k + 1].ini;
    return partes.length ? { linhas, partes } : null;
  }

  function resolverPadrao(ref) {
    const raiz = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {};
    const curso = raiz.CURSO_CONTEUDO;
    if (!curso) return null;
    const [aulaRef, titulo] = ref.split('/');
    const aula = curso.aulas.find(a => a.id === aulaRef || a.id.startsWith(aulaRef + '-') || ('aula' + String(a.numero).padStart(2, '0')) === aulaRef);
    if (!aula) return null;
    const blocos = aula.blocks.filter(b => b.t === 'asm');
    const b = titulo ? blocos.find(x => (x.titulo || '').toUpperCase() === titulo.toUpperCase()) : blocos[0];
    return b ? b.code : null;
  }

  function nome83(nome) {
    const [n, e] = nome.split('.');
    return ((n || '').slice(0, 8).padEnd(8, ' ') + (e || '').slice(0, 3).padEnd(3, ' ')).toUpperCase();
  }

  // bytes de um arquivo: a imagem de memória do programa, do primeiro ao último byte gerado
  function imagemDoArquivo(prog) {
    const blocos = prog.image.filter(b => b.bytes.length);
    if (!blocos.length) return { bytes: new Uint8Array(0), org: 0 };
    const ini = Math.min(...blocos.map(b => b.addr)), fim = Math.max(...blocos.map(b => b.addr + b.bytes.length));
    const bytes = new Uint8Array(fim - ini);
    for (const b of blocos) bytes.set(b.bytes, b.addr - ini);
    const sg = prog.segments.find(x => ini >= x.base * 16 && ini < x.base * 16 + Math.max(x.size, 1));
    return { bytes, org: sg ? ini - sg.base * 16 : 0 };
  }

  function montarMiniFS(partes) {
    const dados = new Uint8Array(DISQUETE.bytes);
    const mapa = [];
    const boot = partes[0];
    const c = conteudoSegmentos(boot.prog)[0];
    if (!c || c.bytes !== 512 || byteDoSegmento(c, 510) !== 0x55 || byteDoSegmento(c, 511) !== 0xAA)
      return { erro: 'O primeiro arquivo do disco (' + boot.nome + ') é o setor de boot: precisa ter exatamente 512 bytes e terminar com 55h AAh (ORG 7C00h ... ORG 7DFEh / DW 0AA55h).' };
    for (let i = 0; i < 512; i++) dados[i] = byteDoSegmento(c, i);
    mapa.push({ nome: boot.nome + ' (setor de boot)', lba: 0, setores: 1, bytes: 512, org: c.inicio });
    mapa.push({ nome: '(diretório)', lba: MINIFS.setorDiretorio, setores: 1, bytes: 512, org: 0 });
    if (partes.length - 1 > MINIFS.entradas) return { erro: 'O diretório do MINIFS só tem ' + MINIFS.entradas + ' entradas.' };
    let lba = MINIFS.primeiroSetor;
    partes.slice(1).forEach((p, k) => {
      const img = imagemDoArquivo(p.prog);
      const setores = Math.max(1, Math.ceil(img.bytes.length / 512));
      if ((lba + setores) * 512 > DISQUETE.bytes) { mapa.erro = 'Os arquivos não cabem num disquete de 1,44 MB.'; return; }
      dados.set(img.bytes, lba * 512);
      const e = MINIFS.setorDiretorio * 512 + k * MINIFS.tamEntrada;
      const n = nome83(p.nome);
      for (let i = 0; i < 11; i++) dados[e + i] = n.charCodeAt(i);
      dados[e + 11] = /\.SYS$/.test(p.nome) ? 0x04 : 0x20;          // atributo: 04h = sistema
      dados[e + 12] = lba & 0xFF; dados[e + 13] = lba >> 8;            // primeiro setor
      dados[e + 14] = setores & 0xFF; dados[e + 15] = setores >> 8;    // quantos setores
      const t = img.bytes.length;                                       // tamanho em bytes (dword)
      dados[e + 16] = t & 0xFF; dados[e + 17] = (t >> 8) & 0xFF; dados[e + 18] = (t >> 16) & 0xFF; dados[e + 19] = 0;
      mapa.push({ nome: p.nome, lba, setores, bytes: t, org: img.org });
      lba += setores;
    });
    if (mapa.erro) return { erro: mapa.erro };
    return { dados, mapa, minifs: true };
  }

  // montarPrograma: igual ao Asm.assemble para um fonte comum; com marcadores ;### ARQUIVO
  // monta cada parte e junta tudo num disquete MINIFS.
  function montarPrograma(source, opts) {
    opts = opts || {};
    const div = partesDoFonte(source);
    if (!div) return Asm.assemble(source);
    const { linhas, partes } = div;
    const resolver = opts.resolver || resolverPadrao;
    const errors = [], warnings = [], instrs = [], listing = [], symbols = {}, contagem = {};
    partes.forEach((p, idx) => {
      let fonte, deFora = false;
      if (p.ref) {
        fonte = resolver(p.ref);
        if (fonte == null) { errors.push({ line: p.linha, msg: p.nome + ': não achei o código "' + p.ref + '" (use aulaNN/TÍTULO DO BLOCO).' }); return; }
        deFora = true;
      } else {
        fonte = linhas.map((l, i) => (i > p.ini && i < p.fim ? l : '')).join('\n');
      }
      const pr = Asm.assemble(fonte);
      p.prog = pr;
      const linhaDe = (n) => (deFora ? p.linha : n);
      for (const e of pr.errors) errors.push({ line: linhaDe(e.line), msg: '[' + p.nome + (deFora ? ', linha ' + e.line : '') + '] ' + e.msg });
      for (const w of pr.warnings || []) warnings.push(Object.assign({}, w, { line: linhaDe(w.line) }));
      const chave = (seg) => idx + ':' + seg;
      for (const ins of pr.instrs) { ins.chave = chave(ins.seg); ins.arquivo = p.nome; if (deFora) ins.line = p.linha; instrs.push(ins); }
      for (const l of pr.listing || []) { if (deFora) l.line = p.linha; listing.push(l); }
      const base = p.nome.split('.')[0];
      for (const k of Object.keys(pr.symbols)) {
        const sm = pr.symbols[k];
        if (sm.seg !== undefined) sm.chave = chave(sm.seg);
        sm.arquivo = p.nome;
        symbols[base + ':' + k] = sm;
        contagem[k] = (contagem[k] || 0) + 1;
        symbols['\u0000' + k] = sm;
      }
    });
    // nomes que só existem num arquivo também valem sem o prefixo
    for (const k of Object.keys(symbols)) if (k[0] === '\u0000') { const n = k.slice(1); if (contagem[n] === 1) symbols[n] = symbols[k]; delete symbols[k]; }
    const prog = {
      ok: errors.length === 0, errors: errors.sort((a, b) => a.line - b.line), warnings,
      model: 'tiny', explicitModel: true, pspSeg: (partes[0].prog && partes[0].prog.pspSeg) || 0x700,
      segments: [], image: [], instrs, listing: listing.sort((a, b) => a.line - b.line), entry: null,
      stack: { seg: 0, sp: 0 }, symbols, codeEnd: 0, loadStart: 0, loadEnd: 0, lines: linhas,
      multiarquivo: true, partes: partes.map(p => ({ nome: p.nome, linha: p.linha, ref: p.ref }))
    };
    if (prog.ok) {
      const img = montarMiniFS(partes);
      if (img.erro) { prog.ok = false; prog.errors.push({ line: partes[0].linha, msg: img.erro }); }
      else prog.disquete = img;
    }
    return prog;
  }

  function runProgram(source, opts) {
    opts = opts || {};
    const prog = montarPrograma(source, opts);
    const disco = new Map();
    for (const nome of Object.keys(opts.arquivos || {})) {
      const c = opts.arquivos[nome];
      disco.set(nome.toUpperCase(), { dados: typeof c === 'string' ? Array.from(c, ch => Asm.cp437(ch)) : c.slice(), attr: 0x20 });
    }
    const m = new Machine({ timer: !!opts.timer, disco });
    if (!prog.ok) return { prog, machine: m, status: 'erro-montagem' };
    if (ehDisquete(prog)) m.loadBoot(prog); else m.load(prog);
    if (opts.linhaComando !== undefined) m.setLinhaComando(opts.linhaComando);
    if (opts.setup) for (const k of Object.keys(opts.setup)) {
      try { m.setReg(k, opts.setup[k]); } catch (e) { /* símbolo de memória */
        const s = prog.symbols[k.toUpperCase()];
        if (s && (s.type === 8 || s.type === 10 || (s.type === 4 && typeof opts.setup[k] === 'number' && !Number.isInteger(opts.setup[k])))) {
          // número real numa variável DD/DQ/DT
          const b = s.type === 4 ? Asm.Real.f32(opts.setup[k]) : s.type === 8 ? Asm.Real.f64(opts.setup[k]) : Asm.Real.f80(opts.setup[k]);
          b.forEach((x, i) => { m.mem[s.seg * 16 + s.off + i] = x; });
        } else if (s) { const base = s.seg * 16 + s.off; let v = opts.setup[k]; if (typeof v === 'string') v = Array.from(v, ch => ch.charCodeAt(0)); if (Array.isArray(v)) v.forEach((x, i) => { if (s.type === 1) m.mem[base + i] = x & 0xFF; else { m.mem[base + 2 * i] = x & 0xFF; m.mem[base + 2 * i + 1] = (x >> 8) & 0xFF; } }); else if (s.type === 1) m.mem[base] = v & 0xFF; else { m.mem[base] = v & 0xFF; m.mem[base + 1] = (v >> 8) & 0xFF; } }
      }
    }
    if (opts.input) m.typeString(opts.input);
    const max = opts.maxSteps || 2000000;
    const res = opts.residente || {};
    let st;
    let tsrVisto = false;
    while (m.steps < max) {
      if (m.residente && !tsrVisto) { tsrVisto = true; if (res.entrada) m.typeString(res.entrada); }
      if (m.residente && m.steps - m.residente.passo >= (res.passos || 0)) { st = 'residente'; break; }
      const lote = m.residente ? Math.min(10000, (res.passos || 0) - (m.steps - m.residente.passo)) : 10000;
      st = m.run(Math.max(1, lote));
      if (st === 'aguardando') { if (m.kbdQueue.length) continue; st = 'aguardando'; break; }
      if (st === 'pausa') continue;
      if (st !== 'executando') break;
    }
    if (m.steps >= max && !m.halted && st !== 'residente') st = 'tempo-esgotado';
    return { prog, machine: m, status: st };
  }

  return { Machine, runProgram, FLAG_BITS, hex, BIOS_SEG, STUB_BASE, VIDEO, VGA, scanDe, PALETA_PADRAO, ehDisquete, montarDisquete, DISQUETE, montarPrograma, partesDoFonte, MINIFS };
});
