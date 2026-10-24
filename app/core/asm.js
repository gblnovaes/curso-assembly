/*
 * Montador 8086 (subconjunto MASM/TASM) do Curso Assembly 8086.
 *
 * Gera código de máquina real do 8086 (bytes, tamanhos e ciclos) a partir de
 * sintaxe Intel no estilo MASM 5/TASM. Recusa instruções e endereçamentos que
 * só existem em processadores posteriores, explicando o motivo em português.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Asm8086 = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const REG8 = ['AL', 'CL', 'DL', 'BL', 'AH', 'CH', 'DH', 'BH'];
  const SREG = ['ES', 'CS', 'SS', 'DS'];
  const REG32 = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'EBP', 'ESP', 'FS', 'GS'];

  const JCC = {
    JO: 0x70, JNO: 0x71, JB: 0x72, JC: 0x72, JNAE: 0x72, JAE: 0x73, JNB: 0x73, JNC: 0x73,
    JE: 0x74, JZ: 0x74, JNE: 0x75, JNZ: 0x75, JBE: 0x76, JNA: 0x76, JA: 0x77, JNBE: 0x77,
    JS: 0x78, JNS: 0x79, JP: 0x7A, JPE: 0x7A, JNP: 0x7B, JPO: 0x7B, JL: 0x7C, JNGE: 0x7C,
    JGE: 0x7D, JNL: 0x7D, JLE: 0x7E, JNG: 0x7E, JG: 0x7F, JNLE: 0x7F
  };
  const LOOPS = { LOOPNE: 0xE0, LOOPNZ: 0xE0, LOOPE: 0xE1, LOOPZ: 0xE1, LOOP: 0xE2, JCXZ: 0xE3 };
  const ALU = { ADD: 0, OR: 1, ADC: 2, SBB: 3, AND: 4, SUB: 5, XOR: 6, CMP: 7 };
  const SHIFTS = { ROL: 0, ROR: 1, RCL: 2, RCR: 3, SHL: 4, SAL: 4, SHR: 5, SAR: 7 };
  const GRP3 = { NOT: 2, NEG: 3, MUL: 4, IMUL: 5, DIV: 6, IDIV: 7 };
  const SINGLE = {
    CBW: 0x98, CWD: 0x99, PUSHF: 0x9C, POPF: 0x9D, SAHF: 0x9E, LAHF: 0x9F,
    MOVSB: 0xA4, MOVSW: 0xA5, CMPSB: 0xA6, CMPSW: 0xA7, STOSB: 0xAA, STOSW: 0xAB,
    LODSB: 0xAC, LODSW: 0xAD, SCASB: 0xAE, SCASW: 0xAF, XLAT: 0xD7, XLATB: 0xD7,
    HLT: 0xF4, CMC: 0xF5, CLC: 0xF8, STC: 0xF9, CLI: 0xFA, STI: 0xFB, CLD: 0xFC, STD: 0xFD,
    NOP: 0x90, WAIT: 0x9B, DAA: 0x27, DAS: 0x2F, AAA: 0x37, AAS: 0x3F, INTO: 0xCE, IRET: 0xCF
  };
  // Coprocessador 8087: instruções sem operandos [bytes, espera (o MASM põe WAIT antes), ciclos]
  const FPU_NOOP = {
    FINIT: [[0xDB, 0xE3], 1, 5], FNINIT: [[0xDB, 0xE3], 0, 5], FCLEX: [[0xDB, 0xE2], 1, 5], FNCLEX: [[0xDB, 0xE2], 0, 5],
    FENI: [[0xDB, 0xE0], 1, 5], FNENI: [[0xDB, 0xE0], 0, 5], FDISI: [[0xDB, 0xE1], 1, 5], FNDISI: [[0xDB, 0xE1], 0, 5],
    FLDZ: [[0xD9, 0xEE], 1, 14], FLD1: [[0xD9, 0xE8], 1, 18], FLDPI: [[0xD9, 0xEB], 1, 19], FLDL2T: [[0xD9, 0xE9], 1, 19],
    FLDL2E: [[0xD9, 0xEA], 1, 18], FLDLG2: [[0xD9, 0xEC], 1, 21], FLDLN2: [[0xD9, 0xED], 1, 20],
    FCHS: [[0xD9, 0xE0], 1, 15], FABS: [[0xD9, 0xE1], 1, 14], FTST: [[0xD9, 0xE4], 1, 42], FXAM: [[0xD9, 0xE5], 1, 17],
    F2XM1: [[0xD9, 0xF0], 1, 500], FYL2X: [[0xD9, 0xF1], 1, 950], FPTAN: [[0xD9, 0xF2], 1, 450], FPATAN: [[0xD9, 0xF3], 1, 650],
    FXTRACT: [[0xD9, 0xF4], 1, 50], FDECSTP: [[0xD9, 0xF6], 1, 9], FINCSTP: [[0xD9, 0xF7], 1, 9], FPREM: [[0xD9, 0xF8], 1, 125],
    FYL2XP1: [[0xD9, 0xF9], 1, 850], FSQRT: [[0xD9, 0xFA], 1, 183], FRNDINT: [[0xD9, 0xFC], 1, 45], FSCALE: [[0xD9, 0xFD], 1, 35],
    FNOP: [[0xD9, 0xD0], 1, 13], FCOMPP: [[0xDE, 0xD9], 1, 50]
  };
  // FADD...FDIVR: campo reg do ModR/M
  const FPU_ARIT = { FADD: 0, FMUL: 1, FCOM: 2, FCOMP: 3, FSUB: 4, FSUBR: 5, FDIV: 6, FDIVR: 7 };
  const FPU_ARITP = { FADDP: 0, FMULP: 1, FSUBP: 4, FSUBRP: 5, FDIVP: 6, FDIVRP: 7 };
  const FPU_INT = { FIADD: 0, FIMUL: 1, FICOM: 2, FICOMP: 3, FISUB: 4, FISUBR: 5, FIDIV: 6, FIDIVR: 7 };
  const FPU_OUTROS = ['FLD', 'FILD', 'FBLD', 'FST', 'FSTP', 'FIST', 'FISTP', 'FBSTP', 'FXCH', 'FFREE', 'FLDCW', 'FSTCW', 'FNSTCW', 'FSTSW', 'FNSTSW', 'FWAIT'];
  const FPU_NOMES = ['ADD', 'MUL', 'COM', 'COMP', 'SUB', 'SUBR', 'DIV', 'DIVR'];
  const PREFIXES = { REP: 0xF3, REPE: 0xF3, REPZ: 0xF3, REPNE: 0xF2, REPNZ: 0xF2, LOCK: 0xF0 };
  const SEG_PREFIX = { ES: 0x26, CS: 0x2E, SS: 0x36, DS: 0x3E };
  const RM_TABLE = { 'BX+SI': 0, 'BX+DI': 1, 'BP+SI': 2, 'BP+DI': 3, 'SI': 4, 'DI': 5, 'BP': 6, 'BX': 7 };
  const EA_CYCLES = { '': 6, 'BX': 5, 'BP': 5, 'SI': 5, 'DI': 5, 'BP+DI': 7, 'BX+SI': 7, 'BP+SI': 8, 'BX+DI': 8 };
  const sizeName = s => s === 1 ? 'byte (8 bits)' : s === 2 ? 'word (16 bits)' : 'dword (32 bits)';

  // Instruções que não existem no 8086 original: explicação didática.
  const POS_8086 = {
    PUSHA: '80186', POPA: '80186', ENTER: '80186', LEAVE: '80186', BOUND: '80186',
    INSB: '80186', INSW: '80186', OUTSB: '80186', OUTSW: '80186',
    MOVZX: '80386', MOVSX: '80386', PUSHAD: '80386', POPAD: '80386', CDQ: '80386',
    CWDE: '80386', JECXZ: '80386', SHLD: '80386', SHRD: '80386', BSF: '80386', BSR: '80386',
    BT: '80386', BTS: '80386', BTR: '80386', BTC: '80386', SETE: '80386', SETNE: '80386',
    LOOPD: '80386', IRETD: '80386', PUSHFD: '80386', POPFD: '80386',
    BSWAP: '80486', XADD: '80486', CMPXCHG: '80486', CPUID: 'Pentium', RDTSC: 'Pentium',
    CMOVE: 'Pentium Pro', CMOVNE: 'Pentium Pro', SYSCALL: 'x86-64',
    FSIN: '80387', FCOS: '80387', FSINCOS: '80387', FPREM1: '80387', FUCOM: '80387', FUCOMP: '80387', FUCOMPP: '80387',
    FSETPM: '80287', FCMOVE: 'Pentium Pro', FCOMI: 'Pentium Pro', FISTTP: 'Pentium 4'
  };

  const KNOWN_MNEMONICS = new Set([
    'MOV', 'XCHG', 'LEA', 'LDS', 'LES', 'PUSH', 'POP', 'INC', 'DEC', 'TEST', 'JMP', 'CALL',
    'RET', 'RETN', 'RETF', 'INT', 'IN', 'OUT', 'AAM', 'AAD', 'MOVS', 'CMPS', 'STOS', 'LODS', 'SCAS',
    ...Object.keys(JCC), ...Object.keys(LOOPS), ...Object.keys(ALU), ...Object.keys(SHIFTS),
    ...Object.keys(GRP3), ...Object.keys(SINGLE), ...Object.keys(FPU_NOOP), ...Object.keys(FPU_ARIT),
    ...Object.keys(FPU_ARITP), ...Object.keys(FPU_INT), ...FPU_OUTROS
  ]);

  class AsmError extends Error {
    constructor(msg) { super(msg); this.asm = true; }
  }

  // ------------------------------------------------------------------
  // Utilidades léxicas
  // ------------------------------------------------------------------
  function stripComment(line) {
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === q) q = null; }
      else if (c === '\'' || c === '"') q = c;
      else if (c === ';') return line.slice(0, i);
    }
    return line;
  }

  function splitTopLevel(s, sep) {
    const out = [];
    let depth = 0, q = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '\'' || c === '"') { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim() !== '' || out.length) out.push(cur.trim());
    return out;
  }

  function tokenize(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '\'' || c === '"') {
        let j = i + 1, str = '';
        while (j < s.length) {
          if (s[j] === c) {
            if (s[j + 1] === c) { str += c; j += 2; continue; }
            break;
          }
          str += s[j++];
        }
        if (j >= s.length) throw new AsmError('String sem aspas de fechamento: ' + s.slice(i));
        toks.push({ t: 'str', v: str });
        i = j + 1;
        continue;
      }
      if (/[0-9]/.test(c)) {
        const real = /^[0-9]+\.[0-9]*(?:[Ee][+-]?[0-9]+)?/.exec(s.slice(i));
        if (real) { toks.push({ t: 'num', v: parseFloat(real[0]), real: true }); i += real[0].length; continue; }
        let j = i;
        while (j < s.length && /[0-9A-Za-z]/.test(s[j])) j++;
        toks.push({ t: 'num', v: parseNumber(s.slice(i, j)) });
        i = j;
        continue;
      }
      if (/[A-Za-z_@$?.]/.test(c)) {
        let j = i;
        while (j < s.length && /[\w@$?.]/.test(s[j])) j++;
        const w = s.slice(i, j);
        if (w === '$') toks.push({ t: 'dollar' });
        else toks.push({ t: 'id', v: w.toUpperCase(), raw: w });
        i = j;
        continue;
      }
      if ('+-*/()[]:,'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
      throw new AsmError('Caractere inesperado "' + c + '"');
    }
    return toks;
  }

  function parseNumber(w) {
    const u = w.toUpperCase();
    let m;
    if ((m = /^([0-9][0-9A-F]*)H$/.exec(u))) return parseInt(m[1], 16);
    if ((m = /^([01]+)B$/.exec(u))) return parseInt(m[1], 2);
    if ((m = /^([0-7]+)[OQ]$/.exec(u))) return parseInt(m[1], 8);
    if ((m = /^([0-9]+)D?$/.exec(u))) return parseInt(m[1], 10);
    if (/^0X[0-9A-F]+$/.test(u)) throw new AsmError('"' + w + '": o MASM não usa 0x. Escreva em hexadecimal com sufixo H, por exemplo 0' + u.slice(2) + 'h.');
    if (/^[0-9A-F]+$/.test(u)) throw new AsmError('Número "' + w + '" inválido. Hexadecimal precisa do sufixo H (ex.: ' + w + 'h).');
    throw new AsmError('Número inválido: ' + w);
  }

  const toS16 = v => { v &= 0xFFFF; return v & 0x8000 ? v - 0x10000 : v; };

  // ------------------------------------------------------------------
  // Números reais do 8087: 32, 64 e 80 bits (little-endian)
  // ------------------------------------------------------------------
  const Real = {
    f32(v) { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, v, true); return [0, 1, 2, 3].map(i => dv.getUint8(i)); },
    f64(v) { const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, v, true); return [0, 1, 2, 3, 4, 5, 6, 7].map(i => dv.getUint8(i)); },
    f80(v) {
      const out = new Array(10).fill(0);
      const neg = v < 0 || Object.is(v, -0);
      let e, mant;
      if (Number.isNaN(v)) { e = 0x7FFF; mant = 0xC000000000000000n; }
      else if (!Number.isFinite(v)) { e = 0x7FFF; mant = 0x8000000000000000n; }
      else if (v === 0) { e = 0; mant = 0n; }
      else {
        const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, Math.abs(v));
        let ex = (dv.getUint16(0) >> 4) & 0x7FF;
        let m = (BigInt(dv.getUint32(0) & 0xFFFFF) << 32n) | BigInt(dv.getUint32(4));
        if (ex === 0) { ex = 1; while (!(m & (1n << 52n))) { m <<= 1n; ex--; } } else m |= 1n << 52n;
        e = ex - 1023 + 16383; mant = m << 11n;
      }
      for (let i = 0; i < 8; i++) out[i] = Number((mant >> BigInt(8 * i)) & 0xFFn);
      out[8] = e & 0xFF; out[9] = ((e >> 8) & 0x7F) | (neg ? 0x80 : 0);
      return out;
    },
    de32(b) { const dv = new DataView(new ArrayBuffer(4)); b.forEach((x, i) => dv.setUint8(i, x)); return dv.getFloat32(0, true); },
    de64(b) { const dv = new DataView(new ArrayBuffer(8)); b.forEach((x, i) => dv.setUint8(i, x)); return dv.getFloat64(0, true); },
    de80(b) {
      let mant = 0n;
      for (let i = 7; i >= 0; i--) mant = (mant << 8n) | BigInt(b[i]);
      const e = b[8] | ((b[9] & 0x7F) << 8), neg = (b[9] & 0x80) !== 0;
      let v;
      if (e === 0x7FFF) v = (mant & 0x7FFFFFFFFFFFFFFFn) ? NaN : Infinity;
      else if (mant === 0n) v = 0;
      else v = Number(mant) * Math.pow(2, e - 16383 - 63);
      return neg ? -v : v;
    },
    // BCD compactado de 10 bytes (18 dígitos + sinal), como o DT inteiro do MASM e o FBSTP
    bcd(v) {
      const out = new Array(10).fill(0);
      let n = BigInt(Math.trunc(Math.abs(v)));
      for (let i = 0; i < 9; i++) { const lo = Number(n % 10n); n /= 10n; const hi = Number(n % 10n); n /= 10n; out[i] = lo | (hi << 4); }
      out[9] = v < 0 ? 0x80 : 0;
      return out;
    },
    debcd(b) {
      let v = 0;
      for (let i = 8; i >= 0; i--) v = v * 100 + (b[i] >> 4) * 10 + (b[i] & 15);
      return (b[9] & 0x80) ? -v : v;
    }
  };
  const hex = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');

  // ------------------------------------------------------------------
  // Expressões
  // ------------------------------------------------------------------
  // Resultado: { v: número, reloc: depende de endereço, unknown: símbolo ainda sem valor }
  function evalExpr(toks, ctx) {
    let pos = 0;
    const peek = () => toks[pos];
    const isOp = (v) => toks[pos] && toks[pos].t === 'op' && toks[pos].v === v;
    const isId = (v) => toks[pos] && toks[pos].t === 'id' && toks[pos].v === v;

    function primary() {
      const t = toks[pos];
      if (!t) throw new AsmError('Expressão incompleta');
      if (t.t === 'num') { pos++; return { v: t.v, reloc: false, unknown: false, real: !!t.real }; }
      if (t.t === 'str') {
        pos++;
        if (t.v.length === 1) return { v: t.v.charCodeAt(0), reloc: false, unknown: false };
        if (t.v.length === 2) return { v: (t.v.charCodeAt(0) << 8) | t.v.charCodeAt(1), reloc: false, unknown: false };
        throw new AsmError('String longa demais para um valor numérico: \'' + t.v + '\'');
      }
      if (t.t === 'dollar') { pos++; return { v: ctx.here, reloc: true, unknown: false }; }
      if (t.t === 'op' && t.v === '(') {
        pos++;
        const r = additive();
        if (!isOp(')')) throw new AsmError('Falta ")" na expressão');
        pos++;
        return r;
      }
      if (t.t === 'op' && t.v === '-') { pos++; const r = primary(); return { v: -r.v, reloc: r.reloc, unknown: r.unknown, real: r.real }; }
      if (t.t === 'op' && t.v === '+') { pos++; return primary(); }
      if (t.t === 'id') {
        pos++;
        switch (t.v) {
          case 'OFFSET': {
            const r = primary();
            return { v: r.v, reloc: r.reloc, unknown: r.unknown };
          }
          case 'SEG': {
            const n = toks[pos++];
            if (!n || n.t !== 'id') throw new AsmError('SEG precisa de um nome');
            return ctx.segOf(n.v);
          }
          case 'LENGTH': case 'LENGTHOF': case 'SIZE': case 'SIZEOF': case 'TYPE': {
            const n = toks[pos++];
            if (!n || n.t !== 'id') throw new AsmError(t.v + ' precisa de um nome de variável');
            return ctx.attr(t.v, n.v);
          }
          case 'LOW': { const r = primary(); return { v: r.v & 0xFF, reloc: false, unknown: r.unknown }; }
          case 'HIGH': { const r = primary(); return { v: (r.v >> 8) & 0xFF, reloc: false, unknown: r.unknown }; }
          case 'NOT': { const r = primary(); return { v: ~r.v & 0xFFFF, reloc: false, unknown: r.unknown }; }
        }
        return ctx.sym(t.v);
      }
      throw new AsmError('Símbolo inesperado na expressão');
    }
    function multiplicative() {
      let l = primary();
      for (;;) {
        if (isOp('*') || isOp('/') || isId('MOD') || isId('SHL') || isId('SHR')) {
          const op = toks[pos++].v;
          const r = primary();
          let v;
          const real = l.real || r.real;
          if (op === '*') v = l.v * r.v;
          else if (op === 'SHL') v = l.v << r.v;
          else if (op === 'SHR') v = l.v >>> r.v;
          else {
            if (r.v === 0 && !r.unknown) throw new AsmError('Divisão por zero em expressão constante');
            v = op === '/' ? (real ? l.v / r.v : Math.trunc(l.v / (r.v || 1))) : l.v % (r.v || 1);
          }
          l = { v, reloc: false, unknown: l.unknown || r.unknown, real };
        } else return l;
      }
    }
    function additive() {
      let l = multiplicative();
      for (;;) {
        if (isOp('+') || isOp('-')) {
          const op = toks[pos++].v;
          const r = multiplicative();
          if (op === '+') l = { v: l.v + r.v, reloc: l.reloc || r.reloc, unknown: l.unknown || r.unknown, real: l.real || r.real };
          else l = { v: l.v - r.v, reloc: l.reloc && !r.reloc, unknown: l.unknown || r.unknown, real: l.real || r.real };
        } else if (isId('AND') || isId('OR') || isId('XOR')) {
          const op = toks[pos++].v;
          const r = multiplicative();
          const v = op === 'AND' ? l.v & r.v : op === 'OR' ? l.v | r.v : l.v ^ r.v;
          l = { v, reloc: false, unknown: l.unknown || r.unknown };
        } else return l;
      }
    }
    const r = additive();
    if (pos < toks.length) throw new AsmError('Sobrou texto na expressão: ' + toksToStr(toks.slice(pos)));
    return r;
  }

  function toksToStr(toks) {
    return toks.map(t => t.t === 'num' ? String(t.v) : t.t === 'str' ? '\'' + t.v + '\'' : t.t === 'dollar' ? '$' : t.raw || t.v).join(' ');
  }

  // ------------------------------------------------------------------
  // Montador
  // ------------------------------------------------------------------
  function assemble(source, opts) {
    opts = opts || {};
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const errors = [];
    const warnings = [];
    const symbols = new Map();   // NOME -> símbolo
    const textEqu = new Map();   // NOME -> tokens (EQU de texto)
    const segments = [];         // { name, kind, stmts, size, base(paragraph) }
    const segByName = new Map();
    const procs = [];
    let model = null;
    let stackSize = null;
    let endLabel = null;
    let explicitModel = false;
    let curSeg = null;
    let curProc = null;
    const procStack = [];
    let stmts = [];

    const err = (line, msg) => errors.push({ line, msg });
    const warn = (line, msg) => warnings.push({ line, msg });

    function getSeg(name, kind) {
      let s = segByName.get(name);
      if (!s) {
        s = { name, kind, stmts: [], size: 0, base: 0, org: 0 };
        segByName.set(name, s);
        segments.push(s);
      }
      return s;
    }
    function ensureSeg(line) {
      if (!curSeg) {
        // Sem diretivas de segmento: programa "tiny" (estilo .COM / DEBUG)
        curSeg = getSeg('_TEXT', 'code');
        if (!model) { model = 'tiny'; curSeg.org = 0x100; }
      }
      return curSeg;
    }
    function scopedName(name) {
      if (name.startsWith('@@') && curProc) return curProc.name + '.' + name;
      return name;
    }
    function define(line, name, sym) {
      const key = scopedName(name);
      if (REG16.includes(name) || REG8.includes(name) || SREG.includes(name) || name === 'ST') {
        err(line, '"' + name + '" é um registrador e não pode ser usado como nome.'); return null;
      }
      if (KNOWN_MNEMONICS.has(name) && sym.kind !== 'proc') {
        err(line, '"' + name + '" é uma instrução e não pode ser usado como nome.'); return null;
      }
      if (symbols.has(key)) { err(line, 'Símbolo "' + name + '" definido mais de uma vez.'); return null; }
      sym.name = key; sym.line = line;
      symbols.set(key, sym);
      return sym;
    }

    // ---------------- Passo 1: análise sintática ----------------
    for (let li = 0; li < lines.length; li++) {
      const lineNo = li + 1;
      let text = stripComment(lines[li]).trim();
      if (!text) continue;
      try {
        // Rótulo "nome:" no início da linha
        let m = /^([A-Za-z_@$?][\w@$?]*)\s*::?(?!\S*\[)/.exec(text);
        if (m && !SREG.includes(m[1].toUpperCase())) {
          const name = m[1].toUpperCase();
          const seg = ensureSeg(lineNo);
          const stmt = { kind: 'label', line: lineNo, seg };
          define(lineNo, name, { kind: 'label', seg, stmt, type: 'near' });
          stmt.sym = name;
          seg.stmts.push(stmt);
          text = text.slice(m[0].length).trim();
          if (!text) continue;
        }
        // NOME = expr
        if ((m = /^([A-Za-z_@$?][\w@$?]*)\s*=\s*(.+)$/.exec(text))) {
          const name = m[1].toUpperCase();
          const toks = tokenize(m[2]);
          let s = symbols.get(name);
          if (!s) s = define(lineNo, name, { kind: 'const', toks, redefinable: true });
          else if (s.kind === 'const' && s.redefinable) s.toks = toks;
          else err(lineNo, 'Símbolo "' + name + '" já definido.');
          continue;
        }
        const words = text.split(/\s+/);
        const w1 = words[0].toUpperCase();
        const w2 = (words[1] || '').toUpperCase();
        const restAfter = (n) => text.replace(/^\S+/, '').trim().replace(n === 2 ? /^\S+/ : /^/, '').trim();

        // Diretivas com nome
        const DIRS = ['DB', 'DW', 'DD', 'DQ', 'DT'];
        if (DIRS.includes(w2) || DIRS.includes(w1)) {
          const named = DIRS.includes(w2);
          const dir = named ? w2 : w1;
          const seg = ensureSeg(lineNo);
          const unit = { DB: 1, DW: 2, DD: 4, DQ: 8, DT: 10 }[dir];
          const items = splitTopLevel(named ? restAfter(2) : restAfter(1), ',');
          if (!items.length || items[0] === '') { err(lineNo, dir + ' sem valores. Use ? para reservar sem valor inicial.'); continue; }
          const stmt = { kind: 'data', line: lineNo, seg, unit, items: items.map(parseDataItem) };
          if (named) {
            const name = words[0].toUpperCase();
            define(lineNo, name, { kind: 'var', seg, stmt, type: unit });
            stmt.sym = name;
          }
          seg.stmts.push(stmt);
          continue;
        }
        if (w2 === 'EQU') {
          const name = words[0].toUpperCase();
          const valText = restAfter(2);
          const toks = tokenize(valText);
          const isText = /\[|\bPTR\b/i.test(valText) || (toks.length === 1 && toks[0].t === 'id' &&
            (REG16.includes(toks[0].v) || REG8.includes(toks[0].v) || SREG.includes(toks[0].v)));
          if (isText) {
            if (textEqu.has(name)) err(lineNo, 'Símbolo "' + name + '" definido mais de uma vez.');
            textEqu.set(name, toks);
          } else define(lineNo, name, { kind: 'const', toks, seg: curSeg, here: null, stmtIndex: null, eqStmt: true });
          // guarda posição para $ dentro de EQU
          if (!isText) {
            const seg = curSeg;
            const stmt = { kind: 'equ', line: lineNo, seg, sym: name };
            if (seg) seg.stmts.push(stmt);
            symbols.get(name).stmt = stmt;
          }
          continue;
        }
        if (w2 === 'PROC') {
          const name = words[0].toUpperCase();
          const seg = ensureSeg(lineNo);
          const dist = (words[2] || '').toUpperCase() === 'FAR' ? 'far' : 'near';
          const stmt = { kind: 'label', line: lineNo, seg };
          const sym = define(lineNo, name, { kind: 'proc', seg, stmt, type: dist });
          stmt.sym = name;
          seg.stmts.push(stmt);
          curProc = { name, dist, line: lineNo };
          procStack.push(curProc);
          procs.push(curProc);
          void sym;
          continue;
        }
        if (w2 === 'ENDP') {
          const name = words[0].toUpperCase();
          if (!curProc) err(lineNo, 'ENDP sem PROC correspondente.');
          else if (curProc.name !== name) err(lineNo, 'ENDP de "' + name + '" mas o PROC aberto é "' + curProc.name + '".');
          procStack.pop();
          curProc = procStack[procStack.length - 1] || null;
          continue;
        }
        if (w2 === 'LABEL') {
          const name = words[0].toUpperCase();
          const seg = ensureSeg(lineNo);
          const ty = (words[2] || '').toUpperCase();
          const type = { BYTE: 1, WORD: 2, DWORD: 4, QWORD: 8, TBYTE: 10, FAR: 'far' }[ty] || 'near';
          const stmt = { kind: 'label', line: lineNo, seg };
          define(lineNo, name, { kind: typeof type === 'number' ? 'var' : 'label', seg, stmt, type });
          stmt.sym = name;
          seg.stmts.push(stmt);
          continue;
        }
        if (w2 === 'SEGMENT') {
          const name = words[0].toUpperCase();
          const attrs = text.toUpperCase();
          const kind = /\bSTACK\b/.test(attrs) ? 'stack' : (/CODE|TEXT|CODIGO|PROG/.test(name) ? 'code' : 'data');
          curSeg = getSeg(name, kind);
          if (!model) model = 'segments';
          if (!symbols.has(name)) symbols.set(name, { kind: 'segment', seg: curSeg, name });
          continue;
        }
        if (w2 === 'ENDS') { curSeg = null; continue; }
        if (w2 === 'MACRO') { err(lineNo, 'Macros (MACRO/ENDM) não são suportadas por este montador: escreva o código direto ou use um PROC.'); continue; }

        // Diretivas com ponto
        if (w1.startsWith('.')) {
          switch (w1) {
            case '.MODEL':
              model = (w2 || 'SMALL').toLowerCase();
              explicitModel = true;
              if (!['tiny', 'small'].includes(model)) warn(lineNo, 'Modelo ' + w2 + ' tratado como SMALL pelo simulador.');
              if (model !== 'tiny') model = 'small';
              break;
            case '.STACK': stackSize = words[1] ? evalExpr(tokenize(restAfter(1)), constCtx()).v : 1024; break;
            case '.DATA': case '.DATA?': curSeg = getSeg('_DATA', 'data'); if (!model) model = 'small'; break;
            case '.CODE': curSeg = getSeg('_TEXT', 'code'); if (!model) model = 'small'; break;
            case '.STARTUP': {
              const seg = ensureSeg(lineNo);
              warn(lineNo, '.STARTUP gera MOV AX,@DATA / MOV DS,AX automaticamente.');
              const st = { kind: 'label', line: lineNo, seg, startup: true };
              seg.stmts.push(st);
              seg.stmts.push(parseInstr('MOV AX,@DATA', lineNo, seg));
              seg.stmts.push(parseInstr('MOV DS,AX', lineNo, seg));
              endLabel = endLabel || '@STARTUP';
              symbols.set('@STARTUP', { kind: 'label', seg, stmt: st, type: 'near', name: '@STARTUP' });
              st.sym = '@STARTUP';
              break;
            }
            case '.EXIT': {
              const seg = ensureSeg(lineNo);
              seg.stmts.push(parseInstr('MOV AH,4Ch', lineNo, seg));
              seg.stmts.push(parseInstr('INT 21h', lineNo, seg));
              break;
            }
            case '.8086': case '.8087': break;
            case '.186': case '.286': case '.386': case '.486': case '.586':
              err(lineNo, w1 + ' habilita instruções de processadores posteriores. Este curso é sobre o 8086 original: remova a diretiva.'); break;
            default: warn(lineNo, 'Diretiva ' + w1 + ' ignorada pelo simulador.');
          }
          continue;
        }
        switch (w1) {
          case 'END': endLabel = w2 || null; li = lines.length; continue;
          case 'ASSUME': case 'TITLE': case 'PAGE': case 'SUBTTL': case 'NAME': case 'PUBLIC': case 'EXTRN': case 'DOSSEG': case '%OUT':
            continue;
          case 'LOCALS': case 'JUMPS': case 'IDEAL': case 'MASM':
            if (w1 === 'JUMPS') warn(lineNo, 'JUMPS ignorado: aqui os saltos condicionais continuam curtos, como no 8086 real.');
            continue;
          case 'INCLUDE': err(lineNo, 'INCLUDE não é suportado no simulador: cole o conteúdo do arquivo aqui.'); continue;
          case 'ORG': {
            const seg = ensureSeg(lineNo);
            seg.stmts.push({ kind: 'org', line: lineNo, seg, toks: tokenize(restAfter(1)) });
            continue;
          }
          case 'EVEN': case 'ALIGN': {
            const seg = ensureSeg(lineNo);
            const n = w1 === 'EVEN' ? 2 : evalExpr(tokenize(restAfter(1)), constCtx()).v;
            seg.stmts.push({ kind: 'align', line: lineNo, seg, n });
            continue;
          }
        }
        const seg = ensureSeg(lineNo);
        if (seg.kind === 'stack') { err(lineNo, 'Instrução dentro do segmento de pilha.'); continue; }
        const st = parseInstr(text, lineNo, seg);
        st.proc = curProc;
        seg.stmts.push(st);
      } catch (e) {
        if (e.asm) err(lineNo, e.message); else throw e;
      }
    }
    if (curProc) err(curProc.line, 'PROC "' + curProc.name + '" sem ENDP.');

    function constCtx() {
      return {
        here: 0,
        sym: (n) => {
          const s = symbols.get(n);
          if (s && s.kind === 'const') return evalExpr(s.toks, constCtx());
          throw new AsmError('"' + n + '" precisa ser uma constante já definida.');
        },
        segOf: () => { throw new AsmError('SEG não permitido aqui'); },
        attr: () => { throw new AsmError('Operador não permitido aqui'); }
      };
    }

    function parseDataItem(s) {
      const m = /^(.+?)\s+DUP\s*\((.*)\)$/i.exec(s);
      if (m) return { dup: tokenize(m[1]), items: splitTopLevel(m[2], ',').map(parseDataItem) };
      if (s === '?') return { q: true };
      const toks = tokenize(s);
      if (toks.length === 1 && toks[0].t === 'str' && toks[0].v.length > 2) return { str: toks[0].v };
      if (toks.length === 1 && toks[0].t === 'str') return { str: toks[0].v, small: true, toks };
      return { toks };
    }

    function parseInstr(text, lineNo, seg) {
      let words = text.split(/\s+/);
      let prefix = null;
      let mn = words[0].toUpperCase();
      let rest = text.slice(words[0].length).trim();
      if (PREFIXES[mn] !== undefined) {
        prefix = mn;
        if (!rest) throw new AsmError(mn + ' precisa vir antes de uma instrução de string (ex.: REP MOVSB).');
        words = rest.split(/\s+/);
        mn = words[0].toUpperCase();
        rest = rest.slice(words[0].length).trim();
      }
      if (POS_8086[mn]) throw new AsmError(mn + ' não existe no 8086: só apareceu no ' + POS_8086[mn] + '.' + hintFor(mn));
      if (!KNOWN_MNEMONICS.has(mn)) {
        if (/^(E[ABCD]X|E[SD]I|E[BS]P)$/.test(mn)) throw new AsmError('Registradores de 32 bits não existem no 8086.');
        throw new AsmError('Instrução desconhecida: ' + mn + '.');
      }
      const ops = rest ? splitTopLevel(rest, ',') : [];
      return { kind: 'instr', line: lineNo, seg, mn, prefix, rawOps: ops, text };
    }

    function hintFor(mn) {
      switch (mn) {
        case 'PUSHA': return ' No 8086, empilhe cada registrador: PUSH AX, PUSH BX, ...';
        case 'POPA': return ' No 8086, desempilhe cada registrador na ordem inversa.';
        case 'ENTER': return ' No 8086 use PUSH BP / MOV BP,SP / SUB SP,n.';
        case 'LEAVE': return ' No 8086 use MOV SP,BP / POP BP.';
        case 'MOVZX': return ' No 8086 use MOV AL,... seguido de MOV AH,0 (ou XOR AH,AH).';
        case 'MOVSX': return ' No 8086 use MOV AL,... seguido de CBW.';
        case 'CDQ': case 'CWDE': return ' No 8086 existem CBW (AL→AX) e CWD (AX→DX:AX).';
        default: return '';
      }
    }

    if (!model) model = 'tiny';
    if (model === 'tiny' && !segByName.size) getSeg('_TEXT', 'code').org = 0x100;
    if (model === 'tiny') {
      // Tudo em um segmento só (CS=DS=ES=SS)
      const code = getSeg('_TEXT', 'code');
      if (code.org === 0) code.org = 0x100;
      for (const s of segments) if (s !== code && s.stmts.length) { code.stmts.push(...s.stmts); s.stmts.forEach(st => st.seg = code); s.stmts = []; }
    }

    // ---------------- Classificação de operandos ----------------
    const textEquExpand = (toks, depth) => {
      if (depth > 10) throw new AsmError('EQU recursivo demais');
      const out = [];
      for (const t of toks) {
        if (t.t === 'id' && textEqu.has(t.v)) out.push(...textEquExpand(textEqu.get(t.v), depth + 1));
        else out.push(t);
      }
      return out;
    };

    function lookup(name, stmt) {
      if (name.startsWith('@@') && stmt.proc) return symbols.get(stmt.proc.name + '.' + name);
      return symbols.get(name);
    }

    function classifyOperand(raw, stmt) {
      let toks = textEquExpand(tokenize(raw), 0);
      const op = { size: 0, seg: null, dist: null };
      // prefixos de tamanho / distância
      for (;;) {
        const a = toks[0], b = toks[1];
        if (a && a.t === 'id' && b && b.t === 'id' && b.v === 'PTR') {
          const map = { BYTE: 1, WORD: 2, DWORD: 4, QWORD: 8, TBYTE: 10, NEAR: 'near', FAR: 'far' };
          if (map[a.v] === undefined) throw new AsmError('Tipo desconhecido em PTR: ' + a.v);
          if (typeof map[a.v] === 'number') op.size = map[a.v]; else op.dist = map[a.v];
          op.ptr = true;
          toks = toks.slice(2);
          continue;
        }
        if (a && a.t === 'id' && a.v === 'SHORT') { op.dist = 'short'; toks = toks.slice(1); continue; }
        if (a && a.t === 'id' && SREG.includes(a.v) && b && b.t === 'op' && b.v === ':' && toks.length > 2) {
          op.seg = a.v; toks = toks.slice(2); continue;
        }
        if (a && a.t === 'id' && REG32.includes(a.v)) throw new AsmError('Registradores de 32 bits (' + a.v + ') não existem no 8086.');
        break;
      }
      if (!toks.length) throw new AsmError('Operando vazio');
      if (toks[0].t === 'id' && toks[0].v === 'ST') {
        if (toks.length === 1) return Object.assign(op, { t: 'st', i: 0, name: 'ST' });
        if (toks.length === 4 && toks[1].v === '(' && toks[2].t === 'num' && toks[3].v === ')' && toks[2].v >= 0 && toks[2].v <= 7) return Object.assign(op, { t: 'st', i: toks[2].v, name: 'ST(' + toks[2].v + ')' });
        throw new AsmError('Registrador do 8087 inválido: use ST, ST(0) ... ST(7).');
      }
      if (toks.length === 1 && toks[0].t === 'id') {
        const v = toks[0].v;
        if (REG16.includes(v)) return Object.assign(op, { t: 'r', size: 2, code: REG16.indexOf(v), name: v, explicitSize: op.size });
        if (REG8.includes(v)) return Object.assign(op, { t: 'r', size: 1, code: REG8.indexOf(v), name: v, explicitSize: op.size });
        if (SREG.includes(v)) return Object.assign(op, { t: 's', size: 2, code: SREG.indexOf(v), name: v });
      }
      // é memória?
      let isMem = false;
      let prev = null;
      for (const t of toks) {
        if (t.t === 'op' && t.v === '[') isMem = true;
        if (t.t === 'id') {
          const s = lookup(t.v, stmt);
          const guarded = prev && prev.t === 'id' && ['OFFSET', 'SEG', 'LENGTH', 'SIZE', 'TYPE', 'LENGTHOF', 'SIZEOF'].includes(prev.v);
          if (s && s.kind === 'var' && !guarded) isMem = true;
          if (REG16.includes(t.v) || REG8.includes(t.v)) {
            if (!isMem && !toks.some(x => x.t === 'op' && x.v === '[')) throw new AsmError('Registrador "' + t.v + '" usado em expressão. Para acessar memória, use colchetes: [' + t.v + '].');
          }
        }
        prev = t;
      }
      if (op.ptr && op.size && !isMem) {
        // BYTE PTR em imediato puro (ex.: PUSH WORD PTR 5) - trata como tamanho
        return Object.assign(op, { t: 'i', toks, sizeHint: op.size });
      }
      if (!isMem) {
        // imediato ou alvo de salto
        if (toks.length === 3 && toks[1].t === 'op' && toks[1].v === ':') {
          return Object.assign(op, { t: 'farimm', segToks: [toks[0]], offToks: [toks[2]] });
        }
        return Object.assign(op, { t: 'i', toks });
      }
      // memória: achata [ ] em +
      const flat = [];
      let depthParen = 0;
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t.t === 'op' && t.v === '[') {
          if (flat.length && !(flat[flat.length - 1].t === 'op' && ['+', '-', '('].includes(flat[flat.length - 1].v))) flat.push({ t: 'op', v: '+' });
          continue;
        }
        if (t.t === 'op' && t.v === ']') continue;
        if (t.t === 'op' && t.v === '(') depthParen++;
        if (t.t === 'op' && t.v === ')') depthParen--;
        if (t.t === 'op' && t.v === ':' ) {
          // override no meio: var ES:[DI]? aceita "ES:" antes de colchete já tratado
          throw new AsmError('Uso de ":" inesperado no operando. Escreva o segmento antes: ES:[DI].');
        }
        flat.push(t);
      }
      void depthParen;
      // separa termos de nível superior
      const terms = [];
      let cur = [], sign = '+', d = 0;
      for (const t of flat) {
        if (t.t === 'op' && (t.v === '(')) d++;
        if (t.t === 'op' && (t.v === ')')) d--;
        if (d === 0 && t.t === 'op' && (t.v === '+' || t.v === '-')) {
          if (cur.length) terms.push({ sign, toks: cur });
          else if (t.v === '-') { sign = sign === '-' ? '+' : '-'; continue; }
          cur = []; sign = t.v; continue;
        }
        cur.push(t);
      }
      if (cur.length) terms.push({ sign, toks: cur });
      let base = null, index = null;
      const dispToks = [];
      let symType = 0, reloc = false;
      for (const term of terms) {
        const regTok = term.toks.find(t => t.t === 'id' && (REG16.includes(t.v) || REG8.includes(t.v) || SREG.includes(t.v)));
        if (regTok) {
          const r = regTok.v;
          if (term.toks.length > 1) {
            if (term.toks.some(t => t.t === 'op' && t.v === '*')) throw new AsmError('Escala como [' + r + '*2] só existe a partir do 80386. No 8086, multiplique o índice antes (SHL ' + r + ',1).');
            throw new AsmError('Expressão inválida com registrador ' + r + '.');
          }
          if (term.sign === '-') throw new AsmError('Não dá para subtrair um registrador no endereçamento ([... - ' + r + ']).');
          if (r === 'BX' || r === 'BP') {
            if (base) throw new AsmError('[' + base + '+' + r + '] não existe no 8086: só pode haver um registrador base (BX ou BP) e um índice (SI ou DI).');
            base = r;
          } else if (r === 'SI' || r === 'DI') {
            if (index) throw new AsmError('[' + index + '+' + r + '] não existe no 8086: só pode haver um índice (SI ou DI), combinado com BX ou BP.');
            index = r;
          } else {
            throw new AsmError('[' + r + '] não é um endereçamento válido no 8086. Só BX, BP, SI e DI podem apontar para memória.' + (r === 'AX' ? ' Copie para BX: MOV BX,AX e use [BX].' : ''));
          }
          continue;
        }
        for (const t of term.toks) {
          if (t.t === 'id') {
            const s = lookup(t.v, stmt);
            if (s && s.kind === 'var' && !symType) symType = s.type;
            if (s && (s.kind === 'var' || s.kind === 'label' || s.kind === 'proc')) reloc = true;
          }
        }
        if (dispToks.length || term.sign === '-') dispToks.push({ t: 'op', v: term.sign });
        dispToks.push({ t: 'op', v: '(' }, ...term.toks, { t: 'op', v: ')' });
      }
      return Object.assign(op, { t: 'm', base, index, dispToks, symSize: symType, relocHint: reloc, size: op.size || (symType && symType <= 10 ? symType : 0) });
    }

    for (const seg of segments) {
      for (const st of seg.stmts) {
        if (st.kind !== 'instr') continue;
        try {
          st.ops = st.rawOps.map(r => classifyOperand(r, st));
        } catch (e) {
          if (e.asm) { err(st.line, e.message); st.bad = true; } else throw e;
        }
      }
    }

    // ---------------- Layout (iterativo) ----------------
    // bases de segmento (parágrafos)
    const PSP_SEG = 0x0700;
    function layoutSegments() {
      if (model === 'tiny') {
        const code = getSeg('_TEXT', 'code');
        code.base = PSP_SEG;
        return;
      }
      let para = PSP_SEG + 0x10;
      const order = model === 'small'
        ? [...segments.filter(s => s.kind === 'code'), ...segments.filter(s => s.kind === 'data'), ...segments.filter(s => s.kind === 'stack')]
        : segments;
      for (const s of order) {
        s.base = para;
        para += Math.ceil(Math.max(s.size, 1) / 16);
      }
      if (model === 'small') {
        // DGROUP: dados + pilha compartilham o mesmo segmento
        const data = segByName.get('_DATA');
        if (data) dgroupBase = data.base;
        else dgroupBase = para;
      }
    }
    let dgroupBase = 0;

    function symValue(name, stmt, here) {
      const s = lookup(name, stmt);
      if (!s) {
        if (name === '@DATA') {
          if (model === 'tiny') return { v: PSP_SEG, reloc: false, unknown: false, seg: true };
          return { v: dgroupBase, reloc: false, unknown: false, seg: true };
        }
        if (name === '@CODE') return { v: getSeg('_TEXT', 'code').base, reloc: false, unknown: false, seg: true };
        if (pass > 0) throw new AsmError('Símbolo não definido: ' + name + '.');
        return { v: 0, reloc: true, unknown: true };
      }
      if (s.kind === 'const') {
        if (s.evaluating) throw new AsmError('Definição circular em ' + name);
        s.evaluating = true;
        try {
          const ctx = exprCtx(s.stmt || stmt, s.stmt && s.stmt.offset !== undefined ? s.stmt.offset : here);
          return evalExpr(s.toks, ctx);
        } finally { s.evaluating = false; }
      }
      if (s.kind === 'segment') return { v: s.seg.base, reloc: false, unknown: false, seg: true };
      const off = s.stmt.offset;
      if (off === undefined) return { v: 0, reloc: true, unknown: true };
      // offsets de dados no modelo small são relativos a DGROUP
      return { v: off + groupAdjust(s.seg), reloc: true, unknown: false };
    }
    function groupAdjust(seg) {
      if (model === 'small' && (seg.kind === 'data' || seg.kind === 'stack')) return (seg.base - dgroupBase) * 16;
      return 0;
    }
    function exprCtx(stmt, here) {
      return {
        here: (here || 0) + (stmt && stmt.seg ? groupAdjust(stmt.seg) : 0),
        sym: (n) => symValue(n, stmt, here),
        segOf: (n) => {
          const s = lookup(n, stmt);
          if (!s || !s.seg) {
            if (pass > 0) throw new AsmError('SEG de símbolo desconhecido: ' + n);
            return { v: 0, reloc: false, unknown: true };
          }
          if (model === 'small' && (s.seg.kind === 'data' || s.seg.kind === 'stack')) return { v: dgroupBase, reloc: false, unknown: false };
          return { v: s.seg.base, reloc: false, unknown: false };
        },
        attr: (op, n) => {
          const s = lookup(n, stmt);
          if (!s) { if (pass > 0) throw new AsmError('Símbolo desconhecido: ' + n); return { v: 1, reloc: false, unknown: true }; }
          const type = typeof s.type === 'number' ? s.type : (s.type === 'far' ? 0xFFFE : 0xFFFF);
          const count = s.stmt && s.stmt.kind === 'data' ? (s.stmt.count || 1) : 1;
          if (op === 'TYPE') return { v: type, reloc: false, unknown: false };
          if (op === 'LENGTH' || op === 'LENGTHOF') return { v: count, reloc: false, unknown: false };
          return { v: count * type, reloc: false, unknown: false };
        }
      };
    }

    let pass = 0;
    let changed = true;
    for (pass = 0; pass < 12 && changed; pass++) {
      // pass 0 tolera símbolos desconhecidos
      changed = false;
      if (pass > 0) {
        layoutSegments();
      }
      for (const seg of segments) {
        let off = seg.org || 0;
        for (const st of seg.stmts) {
          if (st.offset !== off) { if (st.offset !== undefined) changed = true; st.offset = off; }
          let size = 0;
          st.err = null;
          try {
            size = sizeOf(st, seg, off);
          } catch (e) {
            if (!e.asm) throw e;
            if (pass > 0) { st.err = e.message; } else size = st.lastSize || 0;
          }
          if (st.lastSize !== size) { changed = true; st.lastSize = size; }
          off += size;
        }
        if (seg.size !== off) { changed = true; seg.size = off; }
      }
      if (pass === 0) { changed = true; layoutSegments(); }
    }
    pass = 99;

    function sizeOf(st, seg, off) {
      switch (st.kind) {
        case 'label': case 'equ': return 0;
        case 'org': {
          const v = evalExpr(st.toks, exprCtx(st, off)).v - groupAdjust(seg);
          return Math.max(0, v - off);
        }
        case 'align': return (st.n - (off % st.n)) % st.n;
        case 'data': {
          const bytes = dataBytes(st, off, true);
          return bytes.length;
        }
        case 'instr': {
          if (st.bad) return 0;
          const enc = encode(st, off, true);
          return enc.bytes.length;
        }
      }
      return 0;
    }

    function dataBytes(st, off, sizing) {
      const out = [];
      let count = 0;
      const ctx = exprCtx(st, off);
      const emit = (item) => {
        if (item.dup) {
          const n = evalExpr(item.dup, ctx);
          if (n.unknown && !sizing) throw new AsmError('Contador de DUP desconhecido');
          if (n.v < 0 || n.v > 65535) throw new AsmError('Contador de DUP inválido: ' + n.v);
          for (let k = 0; k < n.v; k++) item.items.forEach(emit);
          return;
        }
        if (item.q) { for (let k = 0; k < st.unit; k++) out.push(0); count++; return; }
        if (item.str !== undefined && st.unit > 2) throw new AsmError('Strings não podem ser definidas com ' + (st.unit === 4 ? 'DD' : st.unit === 8 ? 'DQ' : 'DT') + '.');
        if (item.str !== undefined && !item.small) {
          if (st.unit !== 1) throw new AsmError('Strings longas só são permitidas em DB.');
          for (const ch of item.str) out.push(cp437(ch)); count += item.str.length; return;
        }
        if (item.str !== undefined && st.unit === 1) {
          for (const ch of item.str) out.push(cp437(ch)); count += item.str.length; return;
        }
        let r;
        try { r = evalExpr(item.toks, ctx); }
        catch (e) { if (sizing && pass === 0) r = { v: 0 }; else throw e; }
        let v = r.v;
        if (r.real && st.unit < 4) throw new AsmError('Números reais (com ponto decimal) só podem ser definidos com DD, DQ ou DT.');
        if (st.unit === 1) {
          if (!r.unknown && (v < -128 || v > 255)) throw new AsmError('Valor ' + v + ' não cabe em um byte (DB aceita de -128 a 255).');
          out.push(v & 0xFF);
        } else if (st.unit === 2) {
          if (!r.unknown && (v < -32768 || v > 65535)) throw new AsmError('Valor ' + v + ' não cabe em uma word (DW aceita de -32768 a 65535).');
          out.push(v & 0xFF, (v >> 8) & 0xFF);
        } else if (st.unit === 8) {
          if (r.real) out.push(...Real.f64(v));
          else { let b = BigInt.asUintN(64, BigInt(Math.trunc(v))); for (let k = 0; k < 8; k++) { out.push(Number(b & 0xFFn)); b >>= 8n; } }
        } else if (st.unit === 10) {
          if (r.real) out.push(...Real.f80(v));
          else { if (Math.abs(v) > 999999999999999999) throw new AsmError('DT inteiro vira BCD de 18 dígitos: valor grande demais.'); out.push(...Real.bcd(v)); }
        } else if (r.real) {
          out.push(...Real.f32(v));
        } else {
          // DD: número de 32 bits ou ponteiro far para rótulo
          const idTok = item.toks.length === 1 && item.toks[0].t === 'id' ? lookup(item.toks[0].v, st) : null;
          if (idTok && idTok.seg && idTok.kind !== 'const') {
            const segv = model === 'small' && idTok.seg.kind !== 'code' ? dgroupBase : idTok.seg.base;
            out.push(v & 0xFF, (v >> 8) & 0xFF, segv & 0xFF, (segv >> 8) & 0xFF);
          } else {
            v = v >>> 0;
            out.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
          }
        }
        count++;
      };
      st.items.forEach(emit);
      st.count = count;
      return out;
    }

    // ---------------- Codificação ----------------
    function evalOp(op, st, here) {
      const ctx = exprCtx(st, here);
      if (op.t === 'm') {
        let disp = { v: 0, reloc: false, unknown: false };
        if (op.dispToks.length) disp = evalExpr(op.dispToks, ctx);
        return Object.assign({}, op, { disp: { v: disp.v & 0xFFFF, reloc: disp.reloc || op.relocHint, unknown: disp.unknown } });
      }
      if (op.t === 'i') {
        const r = evalExpr(op.toks, ctx);
        // tipo do símbolo quando é rótulo (para CALL/JMP)
        let symKind = null, symDist = null, symSegBase = null;
        if (op.toks.length === 1 && op.toks[0].t === 'id') {
          const s = lookup(op.toks[0].v, st);
          if (s) { symKind = s.kind; symDist = s.type; symSegBase = s.seg ? s.seg.base : null; }
        }
        return Object.assign({}, op, { v: r.v, reloc: r.reloc, unknown: r.unknown, symKind, symDist, symSegBase, isSeg: !!r.seg });
      }
      if (op.t === 'farimm') {
        const s = evalExpr(op.segToks, ctx), o = evalExpr(op.offToks, ctx);
        return Object.assign({}, op, { segv: s.v & 0xFFFF, offv: o.v & 0xFFFF, unknown: s.unknown || o.unknown });
      }
      return op;
    }


    function modrm(op, regField) {
      if (op.t === 'r' || op.t === 's') return { bytes: [0xC0 | (regField << 3) | op.code], ea: 0, prefix: [] };
      const key = [op.base, op.index].filter(Boolean).join('+');
      const prefix = [];
      const defSeg = op.base === 'BP' ? 'SS' : 'DS';
      if (op.seg && op.seg !== defSeg) prefix.push(SEG_PREFIX[op.seg]);
      const d = op.disp.v & 0xFFFF;
      const sd = toS16(d);
      let ea;
      if (!key) {
        ea = 6;
        return { bytes: [(regField << 3) | 6, d & 0xFF, d >> 8], ea: ea + (op.seg && op.seg !== defSeg ? 2 : 0), prefix };
      }
      const rm = RM_TABLE[key];
      let mod, disp = [];
      if (op.disp.reloc || op.disp.unknown) { mod = 2; disp = [d & 0xFF, d >> 8]; }
      else if (d === 0 && key !== 'BP') mod = 0;
      else if (sd >= -128 && sd <= 127) { mod = 1; disp = [d & 0xFF]; }
      else { mod = 2; disp = [d & 0xFF, d >> 8]; }
      ea = EA_CYCLES[key];
      if (mod !== 0) ea = key.includes('+') ? ea + 4 : 9;
      if (op.seg && op.seg !== defSeg) ea += 2;
      return { bytes: [(mod << 6) | (regField << 3) | rm, ...disp], ea, prefix };
    }

    function immBytes(v, size) {
      v &= 0xFFFF;
      return size === 1 ? [v & 0xFF] : [v & 0xFF, v >> 8];
    }
    function fitsS8(i) { if (i.reloc || i.unknown) return false; const s = toS16(i.v); return s >= -128 && s <= 127; }
    function checkImm(i, size) {
      if (i.unknown) return;
      if (size === 1 && (i.v < -128 || i.v > 255)) throw new AsmError('O valor ' + i.v + ' não cabe em 8 bits (use um registrador de 16 bits).');
      if (size === 2 && (i.v < -32768 || i.v > 65535)) throw new AsmError('O valor ' + i.v + ' não cabe em 16 bits.');
    }

    function operandSize(a, b, mn) {
      // resolve o tamanho de uma operação de dois operandos
      const sa = a.t === 'r' || a.t === 's' ? a.size : a.t === 'm' ? a.size : 0;
      const sb = b ? (b.t === 'r' || b.t === 's' ? b.size : b.t === 'm' ? b.size : 0) : 0;
      if (a.t === 'm' && b && b.t === 'r' && a.size && a.size !== b.size && !a.ptr) {
        throw new AsmError('Tamanhos diferentes: a variável é ' + sizeName(a.size) + ' e ' + b.name + ' é ' + sizeName(b.size) + '. Use ' + (b.size === 1 ? 'BYTE' : 'WORD') + ' PTR se for intencional.');
      }
      if (b && b.t === 'm' && a.t === 'r' && b.size && b.size !== a.size && !b.ptr) {
        throw new AsmError('Tamanhos diferentes: ' + a.name + ' é ' + sizeName(a.size) + ' e a variável é ' + sizeName(b.size) + '. Use ' + (a.size === 1 ? 'BYTE' : 'WORD') + ' PTR se for intencional.');
      }
      if (sa && sb && sa !== sb && (a.t !== 'm' || !a.ptr) && (b.t !== 'm' || !b.ptr)) {
        throw new AsmError('Os operandos de ' + mn + ' têm tamanhos diferentes (' + sizeName(sa) + ' e ' + sizeName(sb) + ').');
      }
      if (sa && sb && sa !== sb) throw new AsmError('Os operandos de ' + mn + ' têm tamanhos diferentes (' + sizeName(sa) + ' e ' + sizeName(sb) + ').');
      const s = sa || sb;
      if (!s) throw new AsmError('Tamanho ambíguo em ' + mn + ': o montador não sabe se é byte ou word. Use BYTE PTR ou WORD PTR.');
      if (s === 4) throw new AsmError('Operandos de 32 bits (DWORD) não existem no 8086. Trabalhe em duas words.');
      return s;
    }

    function encode(st, here, sizing) {
      const mn = st.mn;
      const ops = st.ops.map(o => evalOp(o, st, here));
      const out = { bytes: [], cycles: null, info: {} };
      const pre = [];
      if (st.prefix) {
        if (!/^(MOVS[BW]|STOS[BW]|LODS[BW]|CMPS[BW]|SCAS[BW])$/.test(mn) && st.prefix !== 'LOCK') {
          throw new AsmError(st.prefix + ' só funciona com instruções de string (MOVSB, STOSW, CMPSB...).');
        }
        if ((st.prefix === 'REPE' || st.prefix === 'REPZ' || st.prefix === 'REPNE' || st.prefix === 'REPNZ') && !/^(CMPS|SCAS)/.test(mn)) {
          warn(st.line, st.prefix + ' com ' + mn + ' funciona como REP (a condição de ZF só vale para CMPS/SCAS).');
        }
        pre.push(PREFIXES[st.prefix]);
      }
      const n = ops.length;
      const need = (k) => { if (n !== k) throw new AsmError(mn + ' precisa de ' + (k === 0 ? 'nenhum operando' : k === 1 ? '1 operando' : k + ' operandos') + '.'); };
      const emitRM = (opc, rmOp, reg, extra) => {
        const m = modrm(rmOp, reg);
        out.bytes = [...pre, ...m.prefix, ...opc, ...m.bytes, ...(extra || [])];
        return m.ea;
      };
      const C = (c) => { out.cycles = c; };
      const [a, b] = ops;

      if (mn[0] === 'F' && (FPU_NOOP[mn] || FPU_ARIT[mn] !== undefined || FPU_ARITP[mn] !== undefined || FPU_INT[mn] !== undefined || FPU_OUTROS.includes(mn))) {
        return encodeFPU(mn, ops, out, pre);
      }

      if (SINGLE[mn] !== undefined) {
        if (mn === 'XLAT' || mn === 'XLATB') {
          let prefix = [];
          if (n === 1 && a.t === 'm' && a.seg && a.seg !== 'DS') prefix = [SEG_PREFIX[a.seg]];
          else if (n > 1) need(0);
          out.bytes = [...pre, ...prefix, 0xD7]; C({ base: 11 }); return out;
        }
        need(0);
        out.bytes = [...pre, SINGLE[mn]];
        const cyc = { CBW: 2, CWD: 5, PUSHF: 10, POPF: 8, SAHF: 4, LAHF: 4, HLT: 2, CMC: 2, CLC: 2, STC: 2, CLI: 2, STI: 2, CLD: 2, STD: 2, NOP: 3, WAIT: 3, DAA: 4, DAS: 4, AAA: 8, AAS: 8, INTO: 53, IRET: 24 };
        const strc = { MOVSB: [18, 17], MOVSW: [18, 17], CMPSB: [22, 22], CMPSW: [22, 22], STOSB: [11, 10], STOSW: [11, 10], LODSB: [12, 13], LODSW: [12, 13], SCASB: [15, 15], SCASW: [15, 15] };
        if (strc[mn]) C(st.prefix ? { base: 9, rep: strc[mn][1] } : { base: strc[mn][0] });
        else C({ base: cyc[mn] || 2 });
        return out;
      }

      switch (mn) {
        case 'MOV': {
          need(2);
          if (a.t === 'i' || a.t === 'farimm') throw new AsmError('O destino de MOV não pode ser um valor imediato.');
          if (a.t === 'm' && b.t === 'm') throw new AsmError('MOV memória, memória não existe no 8086. Passe por um registrador: MOV AX,origem / MOV destino,AX.');
          if (a.t === 's') {
            if (a.name === 'CS') throw new AsmError('MOV CS,... não é permitido: CS só muda com JMP/CALL/RET/INT far.');
            if (b.t === 'i') throw new AsmError('Não existe MOV ' + a.name + ',imediato no 8086. Use um registrador: MOV AX,valor / MOV ' + a.name + ',AX.');
            if (b.t === 's') throw new AsmError('Não existe MOV entre registradores de segmento. Use AX como intermediário (ou PUSH/POP).');
            if (b.t === 'r' && b.size !== 2) throw new AsmError('Registradores de segmento têm 16 bits; use um registrador de 16 bits.');
            const ea = emitRM([0x8E], b, a.code);
            C({ base: b.t === 'r' ? 2 : 8 + ea, mem: b.t === 'm' ? 2 : 0 }); return out;
          }
          if (b.t === 's') {
            if (a.t === 'r' && a.size !== 2) throw new AsmError('Registradores de segmento têm 16 bits; use um registrador de 16 bits.');
            const ea = emitRM([0x8C], a, b.code);
            C({ base: a.t === 'r' ? 2 : 9 + ea, mem: a.t === 'm' ? 2 : 0 }); return out;
          }
          if (b.t === 'i') {
            if (b.isSeg && a.t === 'r' && a.size === 1) throw new AsmError('Endereço de segmento tem 16 bits.');
            const s = a.t === 'r' ? a.size : operandSize(a, null, mn);
            checkImm(b, s);
            if (a.t === 'r') { out.bytes = [...pre, (s === 1 ? 0xB0 : 0xB8) + a.code, ...immBytes(b.v, s)]; C({ base: 4 }); return out; }
            const ea = emitRM([s === 1 ? 0xC6 : 0xC7], a, 0, immBytes(b.v, s));
            C({ base: 10 + ea, mem: s }); return out;
          }
          const s = operandSize(a, b, mn);
          // acumulador <-> endereço direto
          if (a.t === 'r' && a.code === 0 && b.t === 'm' && !b.base && !b.index) {
            const m = modrm(b, 0);
            out.bytes = [...pre, ...m.prefix, s === 1 ? 0xA0 : 0xA1, b.disp.v & 0xFF, (b.disp.v >> 8) & 0xFF];
            C({ base: 10 + (m.prefix.length ? 2 : 0), mem: s }); return out;
          }
          if (b.t === 'r' && b.code === 0 && a.t === 'm' && !a.base && !a.index) {
            const m = modrm(a, 0);
            out.bytes = [...pre, ...m.prefix, s === 1 ? 0xA2 : 0xA3, a.disp.v & 0xFF, (a.disp.v >> 8) & 0xFF];
            C({ base: 10 + (m.prefix.length ? 2 : 0), mem: s }); return out;
          }
          if (b.t === 'r' && a.t === 'r') { emitRM([s === 1 ? 0x8A : 0x8B], b, a.code); C({ base: 2 }); return out; }
          if (b.t === 'r') { const ea = emitRM([s === 1 ? 0x88 : 0x89], a, b.code); C({ base: a.t === 'r' ? 2 : 9 + ea, mem: a.t === 'm' ? s : 0 }); return out; }
          const ea = emitRM([s === 1 ? 0x8A : 0x8B], b, a.code); C({ base: 8 + ea, mem: s }); return out;
        }
        case 'XCHG': {
          need(2);
          if (a.t === 'm' && b.t === 'm') throw new AsmError('XCHG memória, memória não existe no 8086.');
          if (a.t === 'i' || b.t === 'i') throw new AsmError('XCHG não aceita valores imediatos.');
          if (a.t === 's' || b.t === 's') throw new AsmError('XCHG não funciona com registradores de segmento.');
          const s = operandSize(a, b, mn);
          if (s === 2 && a.t === 'r' && b.t === 'r' && (a.code === 0 || b.code === 0)) {
            out.bytes = [...pre, 0x90 + (a.code === 0 ? b.code : a.code)]; C({ base: 3 }); return out;
          }
          const [rm, r] = a.t === 'm' ? [a, b] : [b, a];
          const ea = emitRM([s === 1 ? 0x86 : 0x87], rm, r.code);
          C({ base: rm.t === 'm' ? 17 + ea : 4, mem: rm.t === 'm' ? s * 2 : 0 }); return out;
        }
        case 'LEA': case 'LDS': case 'LES': {
          need(2);
          if (a.t !== 'r' || a.size !== 2) throw new AsmError(mn + ' precisa de um registrador de 16 bits como destino.');
          if (mn === 'LEA' && b.t === 'i' && (b.symKind === 'label' || b.symKind === 'proc')) {
            const m = modrm({ t: 'm', base: null, index: null, disp: { v: b.v & 0xFFFF, reloc: true } }, a.code);
            out.bytes = [...pre, 0x8D, ...m.bytes]; C({ base: 2 + m.ea }); return out;
          }
          if (b.t !== 'm') throw new AsmError(mn + ' precisa de um operando de memória (ex.: ' + mn + ' SI,[BX+4] ou ' + mn + ' DX,variavel).');
          const ea = emitRM([mn === 'LEA' ? 0x8D : mn === 'LDS' ? 0xC5 : 0xC4], b, a.code);
          C({ base: mn === 'LEA' ? 2 + ea : 16 + ea, mem: mn === 'LEA' ? 0 : 4 }); return out;
        }
        case 'PUSH': case 'POP': {
          need(1);
          const push = mn === 'PUSH';
          if (a.t === 'i') throw new AsmError((push ? 'PUSH imediato só existe a partir do 80186. No 8086: MOV AX,valor / PUSH AX.' : 'POP precisa de um destino.'));
          if (a.t === 'r') {
            if (a.size !== 2) throw new AsmError(mn + ' só trabalha com 16 bits: use ' + REG16[a.code & 3] + ' em vez de ' + a.name + '.');
            out.bytes = [...pre, (push ? 0x50 : 0x58) + a.code]; C({ base: push ? 11 : 8 }); return out;
          }
          if (a.t === 's') {
            if (!push && a.name === 'CS') throw new AsmError('POP CS não é permitido (CS só muda com saltos/retornos far).');
            out.bytes = [...pre, (a.code << 3) | (push ? 0x06 : 0x07)]; C({ base: push ? 10 : 8 }); return out;
          }
          if (a.size === 1) throw new AsmError(mn + ' só trabalha com words (16 bits).');
          const ea = push ? emitRM([0xFF], a, 6) : emitRM([0x8F], a, 0);
          C({ base: (push ? 16 : 17) + ea, mem: 4 }); return out;
        }
        case 'INC': case 'DEC': {
          need(1);
          if (a.t === 'i') throw new AsmError(mn + ' precisa de um registrador ou memória.');
          if (a.t === 's') throw new AsmError(mn + ' não funciona com registradores de segmento.');
          if (a.t === 'r' && a.size === 2) { out.bytes = [...pre, (mn === 'INC' ? 0x40 : 0x48) + a.code]; C({ base: 2 }); return out; }
          const s = operandSize(a, null, mn);
          const ea = emitRM([s === 1 ? 0xFE : 0xFF], a, mn === 'INC' ? 0 : 1);
          C({ base: a.t === 'r' ? 3 : 15 + ea, mem: a.t === 'm' ? s * 2 : 0 }); return out;
        }
        case 'TEST': {
          need(2);
          if (a.t === 'i') throw new AsmError('O primeiro operando de TEST não pode ser imediato.');
          if (a.t === 'm' && b.t === 'm') throw new AsmError('TEST memória, memória não existe.');
          if (b.t === 'i') {
            const s = a.t === 'r' ? a.size : operandSize(a, null, mn);
            checkImm(b, s);
            if (a.t === 'r' && a.code === 0) { out.bytes = [...pre, s === 1 ? 0xA8 : 0xA9, ...immBytes(b.v, s)]; C({ base: 4 }); return out; }
            const ea = emitRM([s === 1 ? 0xF6 : 0xF7], a, 0, immBytes(b.v, s));
            C({ base: a.t === 'r' ? 5 : 11 + ea, mem: a.t === 'm' ? s : 0 }); return out;
          }
          const s = operandSize(a, b, mn);
          const [rm, r] = b.t === 'r' ? [a, b] : [b, a];
          const ea = emitRM([s === 1 ? 0x84 : 0x85], rm, r.code);
          C({ base: rm.t === 'm' ? 9 + ea : 3, mem: rm.t === 'm' ? s : 0 }); return out;
        }
      }

      if (ALU[mn] !== undefined) {
        need(2);
        const nn = ALU[mn];
        if (a.t === 'i') throw new AsmError('O destino de ' + mn + ' não pode ser um valor imediato.');
        if (a.t === 's' || b.t === 's') throw new AsmError(mn + ' não funciona com registradores de segmento.');
        if (a.t === 'm' && b.t === 'm') throw new AsmError(mn + ' memória, memória não existe no 8086. Carregue um dos valores em um registrador.');
        const isCmp = mn === 'CMP';
        if (b.t === 'i') {
          const s = a.t === 'r' ? a.size : operandSize(a, null, mn);
          checkImm(b, s);
          if (a.t === 'r' && a.code === 0) {
            out.bytes = [...pre, nn * 8 + (s === 1 ? 4 : 5), ...immBytes(b.v, s)]; C({ base: 4 }); return out;
          }
          let opc, imm;
          if (s === 1) { opc = 0x80; imm = immBytes(b.v, 1); }
          else if (fitsS8(b)) { opc = 0x83; imm = [b.v & 0xFF]; }
          else { opc = 0x81; imm = immBytes(b.v, 2); }
          const ea = emitRM([opc], a, nn, imm);
          C({ base: a.t === 'r' ? 4 : (isCmp ? 10 : 17) + ea, mem: a.t === 'm' ? (isCmp ? s : s * 2) : 0 }); return out;
        }
        const s = operandSize(a, b, mn);
        if (b.t === 'r' && a.t === 'r') { emitRM([nn * 8 + (s === 1 ? 2 : 3)], b, a.code); C({ base: 3 }); return out; }
        if (b.t === 'r') {
          const ea = emitRM([nn * 8 + (s === 1 ? 0 : 1)], a, b.code);
          C({ base: a.t === 'r' ? 3 : (isCmp ? 9 : 16) + ea, mem: a.t === 'm' ? (isCmp ? s : s * 2) : 0 }); return out;
        }
        const ea = emitRM([nn * 8 + (s === 1 ? 2 : 3)], b, a.code);
        C({ base: 9 + ea, mem: s }); return out;
      }

      if (SHIFTS[mn] !== undefined) {
        need(2);
        if (a.t === 'i' || a.t === 's') throw new AsmError(mn + ' precisa de um registrador ou memória como destino.');
        const s = a.t === 'r' ? a.size : operandSize(a, null, mn);
        if (b.t === 'r' && b.name === 'CL') {
          const ea = emitRM([s === 1 ? 0xD2 : 0xD3], a, SHIFTS[mn]);
          C({ base: a.t === 'r' ? 8 : 20 + ea, perBit: 4, mem: a.t === 'm' ? s * 2 : 0 }); return out;
        }
        if (b.t === 'i' && !b.unknown && b.v === 1) {
          const ea = emitRM([s === 1 ? 0xD0 : 0xD1], a, SHIFTS[mn]);
          C({ base: a.t === 'r' ? 2 : 15 + ea, mem: a.t === 'm' ? s * 2 : 0 }); return out;
        }
        if (b.t === 'i') throw new AsmError(mn + ' ' + (a.name || 'destino') + ',' + b.v + ' não existe no 8086: o deslocamento imediato maior que 1 só surgiu no 80186. Use ' + mn + ' ' + (a.name || '...') + ',1 repetido ou MOV CL,' + b.v + ' / ' + mn + ' ' + (a.name || '...') + ',CL.');
        throw new AsmError('A contagem de ' + mn + ' deve ser 1 ou CL.');
      }

      if (GRP3[mn] !== undefined) {
        if (mn === 'IMUL' && n > 1) throw new AsmError('IMUL com ' + n + ' operandos só existe a partir do ' + (n === 3 ? '80186' : '80186/80386') + '. No 8086, IMUL tem um operando: IMUL BX faz DX:AX = AX * BX.');
        need(1);
        if (a.t === 'i') throw new AsmError(mn + ' não aceita imediato no 8086. Coloque o valor em um registrador (ex.: MOV BX,10 / ' + mn + ' BX).');
        if (a.t === 's') throw new AsmError(mn + ' não funciona com registradores de segmento.');
        const s = a.t === 'r' ? a.size : operandSize(a, null, mn);
        const ea = emitRM([s === 1 ? 0xF6 : 0xF7], a, GRP3[mn]);
        const isM = a.t === 'm';
        const tbl = {
          NOT: [3, 16], NEG: [3, 16],
          MUL: s === 1 ? [[70, 77], [76, 83]] : [[118, 133], [124, 139]],
          IMUL: s === 1 ? [[80, 98], [86, 104]] : [[128, 154], [134, 160]],
          DIV: s === 1 ? [[80, 90], [86, 96]] : [[144, 162], [150, 168]],
          IDIV: s === 1 ? [[101, 112], [107, 118]] : [[165, 184], [171, 190]]
        }[mn];
        let c = isM ? tbl[1] : tbl[0];
        if (Array.isArray(c)) C({ base: Math.round((c[0] + c[1]) / 2) + (isM ? ea : 0), range: isM ? [c[0] + ea, c[1] + ea] : c, mem: isM ? s : 0 });
        else C({ base: c + (isM ? ea : 0), mem: isM ? s * 2 : 0 });
        return out;
      }

      if (JCC[mn] !== undefined || LOOPS[mn] !== undefined) {
        need(1);
        if (a.t !== 'i') throw new AsmError(mn + ' precisa de um rótulo como destino.');
        if (a.symKind && a.symKind !== 'label' && a.symKind !== 'proc') throw new AsmError(mn + ': "' + toksToStr(a.toks) + '" não é um rótulo de código.');
        const target = a.v & 0xFFFF;
        const rel = target - (here + 2);
        if (!sizing && pass > 0 && !a.unknown && (rel < -128 || rel > 127)) {
          throw new AsmError(mn + ' está longe demais do destino (' + rel + ' bytes). No 8086 saltos condicionais e LOOP só alcançam -128..+127 bytes. Inverta a condição e use JMP: por exemplo, ' + invertJcc(mn) + ' pula_aqui / JMP destino / pula_aqui:');
        }
        out.bytes = [...pre, JCC[mn] !== undefined ? JCC[mn] : LOOPS[mn], rel & 0xFF];
        out.target = target;
        const cy = { LOOP: [17, 5], LOOPE: [18, 6], LOOPZ: [18, 6], LOOPNE: [19, 5], LOOPNZ: [19, 5], JCXZ: [18, 6] }[mn] || [16, 4];
        C({ base: cy[1], taken: cy[0] });
        return out;
      }

      switch (mn) {
        case 'JMP': case 'CALL': {
          need(1);
          const isCall = mn === 'CALL';
          if (a.t === 'r') {
            if (a.size !== 2 || a.t === 's') throw new AsmError(mn + ' indireto precisa de um registrador de 16 bits.');
            emitRM([0xFF], a, isCall ? 2 : 4); C({ base: isCall ? 16 : 11 }); out.indirect = true; return out;
          }
          if (a.t === 's') throw new AsmError(mn + ' não aceita registrador de segmento.');
          if (a.t === 'm') {
            const far = a.dist === 'far' || a.size === 4;
            const ea = emitRM([0xFF], a, isCall ? (far ? 3 : 2) : (far ? 5 : 4));
            C({ base: (isCall ? (far ? 37 : 21) : (far ? 24 : 18)) + ea, mem: far ? 4 : 2 });
            out.indirect = true; out.far = far; return out;
          }
          if (a.t === 'farimm') {
            out.bytes = [...pre, isCall ? 0x9A : 0xEA, a.offv & 0xFF, a.offv >> 8, a.segv & 0xFF, a.segv >> 8];
            out.far = true; out.farTarget = { seg: a.segv, off: a.offv };
            C({ base: isCall ? 28 : 15 }); return out;
          }
          const target = a.v & 0xFFFF;
          const tseg = a.symSegBase;
          const crossSeg = tseg !== null && tseg !== st.seg.base;
          const far = a.dist === 'far' || (a.dist !== 'near' && a.dist !== 'short' && (a.symDist === 'far' || crossSeg));
          if (far) {
            const segv = a.symSegBase !== null ? a.symSegBase : 0;
            out.bytes = [...pre, isCall ? 0x9A : 0xEA, target & 0xFF, target >> 8, segv & 0xFF, segv >> 8];
            out.far = true; out.farTarget = { seg: segv, off: target };
            C({ base: isCall ? 28 : 15 }); return out;
          }
          if (a.symKind === 'var' || a.symKind === 'const') throw new AsmError(mn + ' precisa de um rótulo ou procedimento.');
          if (isCall) {
            const rel = target - (here + 3);
            out.bytes = [...pre, 0xE8, rel & 0xFF, (rel >> 8) & 0xFF]; out.target = target; C({ base: 19 }); return out;
          }
          // JMP: curto quando possível (monótono: uma vez near, sempre near)
          const relS = target - (here + 2);
          if (a.dist === 'short') {
            if (!sizing && pass > 0 && (relS < -128 || relS > 127)) throw new AsmError('JMP SHORT fora do alcance (' + relS + ' bytes).');
            out.bytes = [...pre, 0xEB, relS & 0xFF];
          } else {
            if (!st.near && !a.unknown && (relS < -128 || relS > 127)) st.near = true;
            if (a.unknown && pass === 0) st.near = false;
            if (st.near) { const rel = target - (here + 3); out.bytes = [...pre, 0xE9, rel & 0xFF, (rel >> 8) & 0xFF]; }
            else out.bytes = [...pre, 0xEB, relS & 0xFF];
          }
          out.target = target; C({ base: 15 }); return out;
        }
        case 'RET': case 'RETN': case 'RETF': {
          if (n > 1) need(1);
          const far = mn === 'RETF' || (mn === 'RET' && st.proc && st.proc.dist === 'far');
          if (n === 1) {
            if (a.t !== 'i') throw new AsmError(mn + ' n precisa de um número.');
            out.bytes = [...pre, far ? 0xCA : 0xC2, a.v & 0xFF, (a.v >> 8) & 0xFF]; C({ base: far ? 17 : 12 });
          } else { out.bytes = [...pre, far ? 0xCB : 0xC3]; C({ base: far ? 18 : 8 }); }
          out.far = far; out.retN = n === 1 ? a.v & 0xFFFF : 0;
          return out;
        }
        case 'INT': {
          need(1);
          if (a.t !== 'i') throw new AsmError('INT precisa de um número (ex.: INT 21h).');
          if (!a.unknown && (a.v < 0 || a.v > 255)) throw new AsmError('Número de interrupção deve estar entre 0 e 255.');
          if (a.v === 3) { out.bytes = [...pre, 0xCC]; C({ base: 52 }); }
          else { out.bytes = [...pre, 0xCD, a.v & 0xFF]; C({ base: 51 }); }
          out.intNo = a.v & 0xFF; return out;
        }
        case 'AAM': case 'AAD': {
          if (n > 0) throw new AsmError(mn + ' sem operandos no 8086 (a base é sempre 10).');
          out.bytes = [...pre, mn === 'AAM' ? 0xD4 : 0xD5, 0x0A]; C({ base: mn === 'AAM' ? 83 : 60 }); return out;
        }
        case 'IN': case 'OUT': {
          need(2);
          const [acc, port] = mn === 'IN' ? [a, b] : [b, a];
          if (acc.t !== 'r' || acc.code !== 0) throw new AsmError(mn + ' só funciona com AL ou AX.');
          if (port.t === 'r' && port.name === 'DX') { out.bytes = [...pre, (mn === 'IN' ? 0xEC : 0xEE) + (acc.size === 2 ? 1 : 0)]; C({ base: 8 }); return out; }
          if (port.t === 'i') {
            if (port.v < 0 || port.v > 255) throw new AsmError('Porta imediata deve ser 0-255; para portas maiores use DX.');
            out.bytes = [...pre, (mn === 'IN' ? 0xE4 : 0xE6) + (acc.size === 2 ? 1 : 0), port.v & 0xFF]; C({ base: 10 }); return out;
          }
          throw new AsmError('A porta de ' + mn + ' deve ser um número de 0 a 255 ou DX.');
        }
        case 'MOVS': case 'CMPS': case 'STOS': case 'LODS': case 'SCAS':
          throw new AsmError('Use a forma com sufixo: ' + mn + 'B (bytes) ou ' + mn + 'W (words).');
      }
      throw new AsmError('Instrução não suportada: ' + mn);
    }

    // ---------------- 8087 ----------------
    function encodeFPU(mn, ops, out, pre) {
      if (pre.length) throw new AsmError('Prefixos REP não se aplicam ao 8087.');
      const n = ops.length;
      const [a, b] = ops;
      const W = mn.startsWith('FN') ? [] : [0x9B]; // o MASM coloca FWAIT antes de cada instrução do 8087
      const desc = { op: mn };
      const memSize = (op, sizes, nomes) => {
        if (!op.size) throw new AsmError(mn + ': tamanho do operando desconhecido. Use ' + nomes + ' PTR.');
        if (!sizes.includes(op.size)) throw new AsmError(mn + ' não aceita operando de ' + op.size + ' bytes (aceita ' + nomes + ').' + (op.size === 2 && /^F(LD|STP?)$/.test(mn) ? ' Para inteiros, use ' + mn.replace('F', 'FI') + '.' : ''));
        return op.size;
      };
      const mem = (opc, reg, op, cyc) => {
        const m = modrm(op, reg);
        out.bytes = [...W, ...m.prefix, opc, ...m.bytes];
        out.cycles = { base: cyc + m.ea, mem: op.size };
      };
      const regf = (b1, b2, cyc) => { out.bytes = [...W, b1, b2]; out.cycles = { base: cyc }; };
      const isST = (o) => o && o.t === 'st';
      const nomeT = { 2: 'WORD', 4: 'DWORD', 8: 'QWORD', 10: 'TBYTE' };
      out.fpu = desc;
      if (FPU_NOOP[mn]) {
        if (n) throw new AsmError(mn + ' não tem operandos.');
        const [bytes, wait, cyc] = FPU_NOOP[mn];
        out.bytes = [...(wait ? [0x9B] : []), ...bytes]; out.cycles = { base: cyc };
        return out;
      }
      if (mn === 'FWAIT') { if (n) throw new AsmError('FWAIT não tem operandos.'); out.bytes = [0x9B]; out.cycles = { base: 3 }; delete out.fpu; out.wait = true; return out; }
      if (FPU_ARIT[mn] !== undefined) {
        const r = FPU_ARIT[mn];
        const cmp = r === 2 || r === 3;
        const cyc = { 0: 85, 1: 130, 2: 45, 3: 47, 4: 85, 5: 87, 6: 198, 7: 199 }[r];
        desc.k = cmp ? 'com' : 'arit'; desc.f = FPU_NOMES[r]; desc.pop = r === 3 ? 1 : 0;
        if (n === 0) {
          if (cmp) { regf(0xD8, 0xD0 + r * 8 + 1, cyc); desc.src = { st: 1 }; return out; }
          // FADD sem operandos = FADDP ST(1),ST
          const rr = r === 4 ? 5 : r === 5 ? 4 : r === 6 ? 7 : r === 7 ? 6 : r;
          regf(0xDE, 0xC0 + rr * 8 + 1, cyc); desc.dest = 1; desc.src = { st: 0 }; desc.pop = 1; return out;
        }
        if (n === 1) {
          if (isST(a)) {
            regf(0xD8, 0xC0 + r * 8 + a.i, cyc); desc.dest = 0; desc.src = { st: a.i }; return out;
          }
          if (a.t !== 'm') throw new AsmError(mn + ' aceita ST(i) ou uma variável real (DD/DQ).');
          const s = memSize(a, [4, 8], 'DWORD (real de 32 bits) ou QWORD (real de 64 bits)');
          mem(s === 4 ? 0xD8 : 0xDC, r, a, cyc + (s === 4 ? 20 : 25));
          desc.dest = 0; desc.src = { mem: s === 4 ? 'f32' : 'f64' }; return out;
        }
        if (n !== 2 || !isST(a) || !isST(b)) throw new AsmError(mn + ' com dois operandos precisa de registradores do 8087: ' + mn + ' ST,ST(i) ou ' + mn + ' ST(i),ST.');
        if (cmp) throw new AsmError(mn + ' compara sempre com ST: escreva ' + mn + ' ST(i).');
        if (a.i === 0) { regf(0xD8, 0xC0 + r * 8 + b.i, cyc); desc.dest = 0; desc.src = { st: b.i }; return out; }
        if (b.i !== 0) throw new AsmError('Um dos operandos de ' + mn + ' precisa ser ST (o topo da pilha).');
        const rr = r === 4 ? 5 : r === 5 ? 4 : r === 6 ? 7 : r === 7 ? 6 : r; // codificação invertida do DC
        regf(0xDC, 0xC0 + rr * 8 + a.i, cyc); desc.dest = a.i; desc.src = { st: 0 }; return out;
      }
      if (FPU_ARITP[mn] !== undefined) {
        const r = FPU_ARITP[mn];
        const cyc = { 0: 90, 1: 134, 4: 90, 5: 90, 6: 202, 7: 203 }[r];
        let i = 1;
        if (n === 2) {
          if (!isST(a) || !isST(b) || b.i !== 0) throw new AsmError(mn + ' tem a forma ' + mn + ' ST(i),ST.');
          i = a.i;
        } else if (n !== 0) throw new AsmError(mn + ' tem a forma ' + mn + ' ST(i),ST (ou sem operandos, para ST(1)).');
        const rr = r === 4 ? 5 : r === 5 ? 4 : r === 6 ? 7 : r === 7 ? 6 : r;
        regf(0xDE, 0xC0 + rr * 8 + i, cyc);
        desc.k = 'arit'; desc.f = FPU_NOMES[r]; desc.dest = i; desc.src = { st: 0 }; desc.pop = 1;
        return out;
      }
      if (FPU_INT[mn] !== undefined) {
        const r = FPU_INT[mn];
        if (n !== 1 || a.t !== 'm') throw new AsmError(mn + ' precisa de uma variável inteira (DW ou DD).');
        const s = memSize(a, [2, 4], 'WORD ou DWORD');
        const cyc = { 0: 120, 1: 136, 2: 80, 3: 82, 4: 120, 5: 120, 6: 230, 7: 230 }[r];
        mem(s === 2 ? 0xDE : 0xDA, r, a, cyc);
        desc.k = r === 2 || r === 3 ? 'com' : 'arit'; desc.f = FPU_NOMES[r]; desc.dest = 0; desc.src = { mem: s === 2 ? 'i16' : 'i32' }; desc.pop = r === 3 ? 1 : 0;
        return out;
      }
      const need1 = () => { if (n !== 1) throw new AsmError(mn + ' precisa de 1 operando.'); };
      switch (mn) {
        case 'FLD': case 'FST': case 'FSTP': {
          need1();
          desc.k = mn === 'FLD' ? 'ld' : 'st'; desc.pop = mn === 'FSTP' ? 1 : 0;
          if (isST(a)) {
            if (mn === 'FLD') regf(0xD9, 0xC0 + a.i, 20); else regf(0xDD, (mn === 'FST' ? 0xD0 : 0xD8) + a.i, mn === 'FST' ? 18 : 20);
            desc.st = a.i; return out;
          }
          if (a.t !== 'm') throw new AsmError(mn + ' precisa de ST(i) ou de uma variável real.');
          const s = memSize(a, mn === 'FST' ? [4, 8] : [4, 8, 10], mn === 'FST' ? 'DWORD ou QWORD' : 'DWORD, QWORD ou TBYTE');
          const reg = mn === 'FLD' ? 0 : mn === 'FST' ? 2 : 3;
          if (s === 10) mem(0xDB, mn === 'FLD' ? 5 : 7, a, mn === 'FLD' ? 57 : 55);
          else mem(s === 4 ? 0xD9 : 0xDD, reg, a, mn === 'FLD' ? (s === 4 ? 45 : 50) : (s === 4 ? 87 : 100) + desc.pop * 2);
          desc.mem = s === 4 ? 'f32' : s === 8 ? 'f64' : 'f80';
          return out;
        }
        case 'FILD': case 'FIST': case 'FISTP': {
          need1();
          if (a.t !== 'm') throw new AsmError(mn + ' precisa de uma variável inteira (' + (mn === 'FIST' ? 'DW ou DD' : 'DW, DD ou DQ') + ').');
          const s = memSize(a, mn === 'FIST' ? [2, 4] : [2, 4, 8], mn === 'FIST' ? 'WORD ou DWORD' : 'WORD, DWORD ou QWORD');
          desc.k = mn === 'FILD' ? 'ld' : 'st'; desc.pop = mn === 'FISTP' ? 1 : 0;
          desc.mem = s === 2 ? 'i16' : s === 4 ? 'i32' : 'i64';
          if (mn === 'FILD') mem(s === 4 ? 0xDB : 0xDF, s === 8 ? 5 : 0, a, s === 2 ? 50 : s === 4 ? 56 : 64);
          else if (s === 8) mem(0xDF, 7, a, 100);
          else mem(s === 2 ? 0xDF : 0xDB, mn === 'FIST' ? 2 : 3, a, s === 2 ? 86 : 88);
          return out;
        }
        case 'FBLD': case 'FBSTP': {
          need1();
          if (a.t !== 'm') throw new AsmError(mn + ' precisa de uma variável de 10 bytes (DT).');
          memSize(a, [10], 'TBYTE');
          mem(0xDF, mn === 'FBLD' ? 4 : 6, a, mn === 'FBLD' ? 300 : 530);
          desc.k = mn === 'FBLD' ? 'ld' : 'st'; desc.mem = 'bcd'; desc.pop = mn === 'FBSTP' ? 1 : 0;
          return out;
        }
        case 'FXCH': case 'FFREE': {
          let i = 1;
          if (n === 1 && isST(a)) i = a.i;
          else if (n === 2 && mn === 'FXCH' && isST(a) && isST(b) && a.i === 0) i = b.i;
          else if (n !== 0 || mn === 'FFREE') throw new AsmError(mn + ' precisa de um registrador ST(i).');
          if (mn === 'FXCH') regf(0xD9, 0xC8 + i, 12); else regf(0xDD, 0xC0 + i, 11);
          desc.k = mn === 'FXCH' ? 'xch' : 'free'; desc.st = i;
          return out;
        }
        case 'FLDCW': case 'FSTCW': case 'FNSTCW': case 'FSTSW': case 'FNSTSW': {
          need1();
          if (a.t === 'r' && a.name === 'AX' && /STSW/.test(mn)) throw new AsmError(mn + ' AX só existe a partir do 80287. No 8087, grave numa variável e leia de lá: ' + mn + ' status / MOV AX,status.');
          if (a.t !== 'm') throw new AsmError(mn + ' precisa de uma variável de 16 bits (DW).');
          if (a.size && a.size !== 2) throw new AsmError(mn + ' trabalha com uma word (DW).');
          const w = mn.startsWith('FN') || mn === 'FLDCW' ? (mn === 'FLDCW' ? [0x9B] : []) : [0x9B];
          const m = modrm(a, mn === 'FLDCW' ? 5 : 7);
          out.bytes = [...w, ...m.prefix, /STSW/.test(mn) ? 0xDD : 0xD9, ...m.bytes];
          out.cycles = { base: (mn === 'FLDCW' ? 10 : 15) + m.ea, mem: 2 };
          desc.k = mn === 'FLDCW' ? 'ldcw' : /STSW/.test(mn) ? 'stsw' : 'stcw';
          return out;
        }
      }
      throw new AsmError('Instrução do 8087 não suportada: ' + mn);
    }

    function invertJcc(mn) {
      const inv = { JE: 'JNE', JZ: 'JNZ', JNE: 'JE', JNZ: 'JZ', JA: 'JBE', JBE: 'JA', JB: 'JAE', JAE: 'JB', JC: 'JNC', JNC: 'JC', JG: 'JLE', JLE: 'JG', JL: 'JGE', JGE: 'JL', JS: 'JNS', JNS: 'JS', JO: 'JNO', JNO: 'JO', JP: 'JNP', JNP: 'JP', JNA: 'JA', JNB: 'JB', JNG: 'JG', JNL: 'JL' };
      return inv[mn] || 'Jcc invertido';
    }

    // ---------------- Emissão final ----------------
    const image = [];      // { addr(físico), bytes }
    const instrs = [];
    const listing = [];
    if (!errors.length) {
      layoutSegments();
      for (const seg of segments) {
        for (const st of seg.stmts) {
          const physBase = seg.base * 16;
          try {
            if (st.err) throw new AsmError(st.err);
            if (st.kind === 'data') {
              const bytes = dataBytes(st, st.offset, false);
              image.push({ addr: physBase + st.offset, bytes });
              listing.push({ line: st.line, seg: seg.base, off: st.offset, bytes, kind: 'data' });
            } else if (st.kind === 'instr' && !st.bad) {
              const enc = encode(st, st.offset, false);
              if (enc.bytes.length !== st.lastSize) throw new AsmError('Erro interno de layout (tamanho mudou).');
              image.push({ addr: physBase + st.offset, bytes: enc.bytes });
              const ops = st.ops.map(o => evalOp(o, st, st.offset));
              const ins = {
                line: st.line, mn: st.mn, prefix: st.prefix, ops, size: enc.bytes.length, bytes: enc.bytes,
                seg: seg.base, off: st.offset, phys: (physBase + st.offset) & 0xFFFFF, cycles: enc.cycles,
                target: enc.target, far: enc.far, farTarget: enc.farTarget, retN: enc.retN, indirect: enc.indirect,
                intNo: enc.intNo, text: st.text, fpu: enc.fpu
              };
              instrs.push(ins);
              listing.push({ line: st.line, seg: seg.base, off: st.offset, bytes: enc.bytes, kind: 'instr' });
            } else if (st.kind === 'label' || st.kind === 'equ') {
              listing.push({ line: st.line, seg: seg.base, off: st.offset, bytes: [], kind: st.kind });
            }
          } catch (e) {
            if (e.asm) err(st.line, e.message); else throw e;
          }
        }
      }
    }

    // ponto de entrada
    let entry = null;
    const codeSeg = segByName.get('_TEXT') || segments.find(s => s.kind === 'code') || segments[0];
    if (!errors.length) {
      if (endLabel) {
        const s = symbols.get(endLabel);
        if (!s || !s.stmt) err(lines.length, 'END ' + endLabel + ': rótulo de início não encontrado.');
        else entry = { seg: s.seg.base, off: s.stmt.offset };
      } else if (codeSeg) {
        entry = { seg: codeSeg.base, off: codeSeg.org || 0 };
        if (model !== 'tiny') warn(lines.length, 'Falta "END rotulo" no fim do programa; a execução começa no início do segmento de código.');
      }
    }
    if (model === 'small' && !errors.length) {
      const dataSeg = segByName.get('_DATA');
      void dataSeg;
    }

    // tamanho da pilha e DGROUP
    let stack;
    if (model === 'tiny') stack = { seg: PSP_SEG, sp: 0xFFFE };
    else {
      const ss = segments.find(s => s.kind === 'stack');
      const st = stackSize !== null ? stackSize : (ss ? ss.size : 0);
      if (model === 'small') {
        const dataEnd = segments.filter(s => s.kind === 'data').reduce((m, s) => Math.max(m, (s.base - dgroupBase) * 16 + s.size), 0);
        const stackOff = Math.ceil(dataEnd / 16) * 16;
        stack = { seg: dgroupBase, sp: (stackOff + (st || 1024)) & 0xFFFF, bottom: stackOff, size: st || 1024 };
        if (stackSize === null) warn(1, 'Sem .STACK: usando pilha de 1024 bytes.');
      } else if (ss) stack = { seg: ss.base, sp: ss.size & 0xFFFF, bottom: 0, size: ss.size };
      else { stack = { seg: (codeSeg ? codeSeg.base : PSP_SEG), sp: 0xFFFE }; warn(1, 'Nenhum segmento de pilha definido.'); }
    }

    // tabela de símbolos pública
    const symTable = {};
    for (const [k, s] of symbols) {
      if (!s.stmt && s.kind !== 'const') continue;
      try {
        if (s.kind === 'const') { symTable[k] = { kind: 'const', value: symValue(k, null, 0).v }; continue; }
        if (s.stmt.offset === undefined) continue;
        const segv = model === 'small' && s.seg.kind !== 'code' ? dgroupBase : s.seg.base;
        symTable[k] = {
          kind: s.kind, type: s.type, seg: segv, off: s.stmt.offset + groupAdjust(s.seg),
          phys: (s.seg.base * 16 + s.stmt.offset) & 0xFFFFF, count: s.stmt.count || 1, line: s.line
        };
      } catch (e) { /* ignora */ }
    }

    const minAddr = segments.length ? Math.min(...segments.map(s => s.base)) : PSP_SEG;
    const maxEnd = segments.length ? Math.max(...segments.map(s => s.base * 16 + s.size)) : 0;

    return {
      ok: errors.length === 0,
      errors: errors.sort((x, y) => x.line - y.line),
      warnings,
      model,
      explicitModel,
      pspSeg: PSP_SEG,
      dgroup: model === 'tiny' ? PSP_SEG : dgroupBase,
      segments: segments.map(s => ({ name: s.name, kind: s.kind, base: s.base, size: s.size, org: s.org })),
      image, instrs, listing, entry, stack,
      symbols: symTable,
      codeEnd: codeSeg ? codeSeg.base * 16 + codeSeg.size : 0,
      loadStart: minAddr * 16, loadEnd: maxEnd,
      lines
    };
  }

  // Conversão Unicode -> CP437 (para strings em DB)
  const CP437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  const CP437_MAP = new Map();
  for (let i = 0; i < 256; i++) CP437_MAP.set(CP437[i], i);
  // caracteres portugueses sem equivalente direto no CP437
  const EXTRA = { 'ã': 'a', 'õ': 'o', 'Ã': 'A', 'Õ': 'O', 'Á': 'A', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Â': 'A', 'Ê': 'E', 'Ô': 'O', 'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U' };
  function cp437(ch) {
    if (CP437_MAP.has(ch)) {
      const c = CP437_MAP.get(ch);
      return c;
    }
    if (EXTRA[ch]) return EXTRA[ch].charCodeAt(0);
    const code = ch.charCodeAt(0);
    return code < 256 ? code : 0x3F;
  }

  return { assemble, CP437, cp437, REG16, REG8, SREG, hex, parseNumber, POS_8086, KNOWN_MNEMONICS, Real };
});
