/*
 * Decodificador de código de máquina do 8086 do Curso Assembly 8086.
 *
 * O montador entrega ao simulador as instruções já analisadas, ligadas às linhas
 * do fonte. Mas um programa também pode executar código que não veio do montador:
 * um setor de boot que lê o kernel do disquete, um sistema operacional que carrega
 * programas na memória ou código que se modifica. Para esses casos o simulador lê
 * os bytes da memória e usa este decodificador, que produz o mesmo formato de
 * instrução do montador (mnemônico, operandos e ciclos) e o texto em MASM.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Decod8086 = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const R16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const R8 = ['AL', 'CL', 'DL', 'BL', 'AH', 'CH', 'DH', 'BH'];
  const SREG = ['ES', 'CS', 'SS', 'DS'];
  const ALU = ['ADD', 'OR', 'ADC', 'SBB', 'AND', 'SUB', 'XOR', 'CMP'];
  const JCC = ['JO', 'JNO', 'JB', 'JAE', 'JE', 'JNE', 'JBE', 'JA', 'JS', 'JNS', 'JP', 'JNP', 'JL', 'JGE', 'JLE', 'JG'];
  const SHIFTS = ['ROL', 'ROR', 'RCL', 'RCR', 'SHL', 'SHR', null, 'SAR'];
  const GRP3 = ['TEST', null, 'NOT', 'NEG', 'MUL', 'IMUL', 'DIV', 'IDIV'];
  const RM = [['BX', 'SI'], ['BX', 'DI'], ['BP', 'SI'], ['BP', 'DI'], [null, 'SI'], [null, 'DI'], ['BP', null], ['BX', null]];
  // mesmos custos de endereço efetivo que o montador usa (tabela da Intel)
  const EA_CYCLES = { '': 6, 'BX': 5, 'BP': 5, 'SI': 5, 'DI': 5, 'BP+DI': 7, 'BX+SI': 7, 'BP+SI': 8, 'BX+DI': 8 };
  const SIMPLES = {
    0x27: ['DAA', 4], 0x2F: ['DAS', 4], 0x37: ['AAA', 8], 0x3F: ['AAS', 8], 0x90: ['NOP', 3],
    0x98: ['CBW', 2], 0x99: ['CWD', 5], 0x9B: ['WAIT', 3], 0x9C: ['PUSHF', 10], 0x9D: ['POPF', 8], 0x9E: ['SAHF', 4], 0x9F: ['LAHF', 4],
    0xCE: ['INTO', 53], 0xCF: ['IRET', 24], 0xF4: ['HLT', 2], 0xF5: ['CMC', 2],
    0xF8: ['CLC', 2], 0xF9: ['STC', 2], 0xFA: ['CLI', 2], 0xFB: ['STI', 2], 0xFC: ['CLD', 2], 0xFD: ['STD', 2]
  };
  // instruções de string: [mnemônico, ciclos sem REP, ciclos por repetição]
  const STRINGS = {
    0xA4: ['MOVSB', 18, 17], 0xA5: ['MOVSW', 18, 17], 0xA6: ['CMPSB', 22, 22], 0xA7: ['CMPSW', 22, 22],
    0xAA: ['STOSB', 11, 10], 0xAB: ['STOSW', 11, 10], 0xAC: ['LODSB', 12, 13], 0xAD: ['LODSW', 12, 13], 0xAE: ['SCASB', 15, 15], 0xAF: ['SCASW', 15, 15]
  };
  const POS_8086 = {
    0x0F: 'POP CS só funcionava nos primeiros 8086 e foi retirado (no 80286 o byte 0Fh virou prefixo de instruções novas)',
    0x60: 'PUSHA (80186)', 0x61: 'POPA (80186)', 0x62: 'BOUND (80186)', 0x63: 'ARPL (80286)', 0x68: 'PUSH imediato (80186)', 0x69: 'IMUL com imediato (80186)',
    0x6A: 'PUSH imediato (80186)', 0x6B: 'IMUL com imediato (80186)', 0x6C: 'INSB (80186)', 0x6D: 'INSW (80186)', 0x6E: 'OUTSB (80186)', 0x6F: 'OUTSW (80186)',
    0xC0: 'deslocamento com contador imediato (80186)', 0xC1: 'deslocamento com contador imediato (80186)', 0xC8: 'ENTER (80186)', 0xC9: 'LEAVE (80186)'
  };

  const toS8 = (v) => (v & 0x80 ? v - 256 : v);
  // número no estilo MASM: 0 a 9 em decimal, o resto em hexadecimal com h (e um 0 na frente se começar por letra)
  function hx(v, digitos) {
    v >>>= 0;
    if (v < 10 && !digitos) return String(v);
    let s = v.toString(16).toUpperCase();
    if (digitos) s = s.padStart(digitos, '0');
    return (/^[A-F]/.test(s) ? '0' : '') + s + 'h';
  }

  /*
   * decodificar(ler, ip): ler(i) devolve o byte i a partir do início da instrução.
   * ip é o offset da instrução (para calcular o destino dos saltos relativos).
   * Devolve a instrução no formato do montador, ou { invalida: mensagem, size }.
   */
  function decodificar(ler, ip) {
    let n = 0;
    const b = () => ler(n++) & 0xFF;
    const w = () => { const lo = b(); return lo | (b() << 8); };
    let seg = null, rep = null, lock = false;
    let op;
    for (;;) {
      op = b();
      if (op === 0x26 || op === 0x2E || op === 0x36 || op === 0x3E) { seg = SREG[(op >> 3) & 3]; continue; }
      if (op === 0xF2) { rep = 'REPNE'; continue; }
      if (op === 0xF3) { rep = 'REP'; continue; }
      if (op === 0xF0) { lock = true; continue; }
      break;
      // (o laço termina no primeiro byte que não é prefixo; um número absurdo de prefixos é limitado abaixo)
    }
    if (n > 8) return { invalida: 'Prefixos demais seguidos (' + n + ' bytes).', size: n };
    const ins = { mn: '', prefix: null, ops: [], size: 0, cycles: { base: 2 }, decodificada: true };
    const segTxt = seg ? seg + ': ' : '';

    // ---------- operandos ----------
    const reg = (code, size) => ({ t: 'r', size, code, name: size === 1 ? R8[code] : R16[code] });
    const sreg = (code) => ({ t: 's', size: 2, code, name: SREG[code] });
    const imm = (v) => ({ t: 'i', v });
    let modrm = null;
    // lê o byte ModR/M e o deslocamento; devolve { mod, reg, op (operando r/m), ea (ciclos) }
    const lerModrm = (size) => {
      const m = b();
      const mod = m >> 6, rg = (m >> 3) & 7, rm = m & 7;
      if (mod === 3) { modrm = { mod, reg: rg, op: reg(rm, size), ea: 0 }; return modrm; }
      let base, index, disp = 0, ea;
      if (mod === 0 && rm === 6) { base = null; index = null; disp = w(); ea = 6; }
      else {
        [base, index] = RM[rm];
        if (mod === 1) disp = toS8(b()) & 0xFFFF;
        else if (mod === 2) disp = w();
        const chave = [base, index].filter(Boolean).join('+');
        ea = mod === 0 ? EA_CYCLES[chave] : chave.includes('+') ? EA_CYCLES[chave] + 4 : 9;
      }
      const padrao = base === 'BP' ? 'SS' : 'DS';
      if (seg && seg !== padrao) ea += 2;
      modrm = { mod, reg: rg, ea, op: { t: 'm', base, index, disp: { v: disp }, seg, size, modo: mod } };
      return modrm;
    };
    const ehMem = () => modrm && modrm.op.t === 'm';
    const fim = (mn, ops, cycles, extra) => {
      ins.mn = mn; ins.ops = ops; ins.cycles = cycles;
      if (extra) Object.assign(ins, extra);
      ins.size = n;
      ins.text = texto(ins, segTxt);
      return ins;
    };
    const invalida = (msg) => ({ invalida: msg, size: n, byte: op });

    // ---------- grupo ALU: 00-3F ----------
    if (op < 0x40 && (op & 7) < 6) {
      const mn = ALU[op >> 3];
      const isCmp = mn === 'CMP';
      const tipo = op & 7;
      if (tipo === 4) return fim(mn, [reg(0, 1), imm(b())], { base: 4 });
      if (tipo === 5) return fim(mn, [reg(0, 2), imm(w())], { base: 4 });
      const size = tipo & 1 ? 2 : 1;
      const m = lerModrm(size);
      const r = reg(m.reg, size);
      if (tipo < 2) {        // r/m, reg
        if (m.op.t === 'r') return fim(mn, [m.op, r], { base: 3 });
        return fim(mn, [m.op, r], { base: (isCmp ? 9 : 16) + m.ea, mem: isCmp ? size : size * 2 });
      }
      if (m.op.t === 'r') return fim(mn, [r, m.op], { base: 3 });
      return fim(mn, [r, m.op], { base: 9 + m.ea, mem: size });
    }
    if (op < 0x40) {
      switch (op) {
        case 0x06: case 0x0E: case 0x16: case 0x1E: return fim('PUSH', [sreg(op >> 3)], { base: 10 });
        case 0x07: case 0x17: case 0x1F: return fim('POP', [sreg(op >> 3)], { base: 8 });
      }
      if (SIMPLES[op]) return fim(SIMPLES[op][0], [], { base: SIMPLES[op][1] });
      if (POS_8086[op]) return invalida(POS_8086[op]);
    }
    if (op >= 0x40 && op < 0x60) {
      const r = reg(op & 7, 2);
      if (op < 0x48) return fim('INC', [r], { base: 2 });
      if (op < 0x50) return fim('DEC', [r], { base: 2 });
      if (op < 0x58) return fim('PUSH', [r], { base: 11 });
      return fim('POP', [r], { base: 8 });
    }
    if (op >= 0x60 && op < 0x70) return invalida(POS_8086[op] || 'instrução posterior ao 8086');
    if (op >= 0x70 && op < 0x80) {
      const rel = toS8(b());
      return fim(JCC[op & 15], [imm((ip + n + rel) & 0xFFFF)], { base: 4, taken: 16 }, { target: (ip + n + rel) & 0xFFFF });
    }
    switch (op) {
      case 0x80: case 0x81: case 0x82: case 0x83: {
        const size = op === 0x81 || op === 0x83 ? 2 : 1;
        const m = lerModrm(size);
        const mn = ALU[m.reg];
        let v;
        if (op === 0x81) v = w(); else if (op === 0x83) v = toS8(b()) & 0xFFFF; else v = b();
        const isCmp = mn === 'CMP';
        if (m.op.t === 'r') return fim(mn, [m.op, imm(v)], { base: 4 });
        return fim(mn, [m.op, imm(v)], { base: (isCmp ? 10 : 17) + m.ea, mem: isCmp ? size : size * 2 }, { ptr: true });
      }
      case 0x84: case 0x85: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        return fim('TEST', [m.op, reg(m.reg, size)], m.op.t === 'm' ? { base: 9 + m.ea, mem: size } : { base: 3 });
      }
      case 0x86: case 0x87: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        return fim('XCHG', [m.op, reg(m.reg, size)], m.op.t === 'm' ? { base: 17 + m.ea, mem: size * 2 } : { base: 4 });
      }
      case 0x88: case 0x89: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        return fim('MOV', [m.op, reg(m.reg, size)], m.op.t === 'm' ? { base: 9 + m.ea, mem: size } : { base: 2 });
      }
      case 0x8A: case 0x8B: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        return fim('MOV', [reg(m.reg, size), m.op], m.op.t === 'm' ? { base: 8 + m.ea, mem: size } : { base: 2 });
      }
      case 0x8C: {
        const m = lerModrm(2);
        if (m.reg > 3) return invalida('8Ch com registrador de segmento inexistente');
        return fim('MOV', [m.op, sreg(m.reg)], m.op.t === 'm' ? { base: 9 + m.ea, mem: 2 } : { base: 2 });
      }
      case 0x8D: {
        const m = lerModrm(2);
        if (m.op.t !== 'm') return invalida('LEA com registrador no lugar da memória');
        return fim('LEA', [reg(m.reg, 2), m.op], { base: 2 + m.ea });
      }
      case 0x8E: {
        const m = lerModrm(2);
        if (m.reg > 3) return invalida('8Eh com registrador de segmento inexistente');
        if (m.reg === 1) return invalida('MOV CS,... não é permitido');
        return fim('MOV', [sreg(m.reg), m.op], m.op.t === 'm' ? { base: 8 + m.ea, mem: 2 } : { base: 2 });
      }
      case 0x8F: {
        const m = lerModrm(2);
        if (m.reg !== 0) return invalida('8Fh com campo reg diferente de 0');
        return fim('POP', [m.op], m.op.t === 'm' ? { base: 17 + m.ea, mem: 4 } : { base: 8 }, { ptr: true });
      }
      case 0x9A: {
        const off = w(), sg = w();
        return fim('CALL', [{ t: 'farimm', segv: sg, offv: off }], { base: 28 }, { far: true, farTarget: { seg: sg, off } });
      }
      case 0xA0: case 0xA1: case 0xA2: case 0xA3: {
        const size = op & 1 ? 2 : 1, d = w();
        const mem = { t: 'm', base: null, index: null, disp: { v: d }, seg, size };
        const c = { base: 10 + (seg && seg !== 'DS' ? 2 : 0), mem: size };
        return op < 0xA2 ? fim('MOV', [reg(0, size), mem], c) : fim('MOV', [mem, reg(0, size)], c);
      }
      case 0xA8: return fim('TEST', [reg(0, 1), imm(b())], { base: 4 });
      case 0xA9: return fim('TEST', [reg(0, 2), imm(w())], { base: 4 });
      case 0xC2: case 0xCA: { const v = w(); return fim(op === 0xC2 ? 'RET' : 'RETF', [imm(v)], { base: op === 0xC2 ? 12 : 17 }, { far: op === 0xCA, retN: v }); }
      case 0xC3: case 0xCB: return fim(op === 0xC3 ? 'RET' : 'RETF', [], { base: op === 0xC3 ? 8 : 18 }, { far: op === 0xCB, retN: 0 });
      case 0xC4: case 0xC5: {
        const m = lerModrm(4);
        if (m.op.t !== 'm') return invalida((op === 0xC4 ? 'LES' : 'LDS') + ' com registrador no lugar da memória');
        return fim(op === 0xC4 ? 'LES' : 'LDS', [reg(m.reg, 2), m.op], { base: 16 + m.ea, mem: 4 });
      }
      case 0xC6: case 0xC7: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        if (m.reg !== 0) return invalida(hx(op, 2) + ' com campo reg diferente de 0');
        const v = size === 1 ? b() : w();
        return fim('MOV', [m.op, imm(v)], m.op.t === 'm' ? { base: 10 + m.ea, mem: size } : { base: 4 }, { ptr: true });
      }
      case 0xCC: return fim('INT', [imm(3)], { base: 52 }, { intNo: 3 });
      case 0xCD: { const v = b(); return fim('INT', [imm(v)], { base: 51 }, { intNo: v }); }
      case 0xD0: case 0xD1: case 0xD2: case 0xD3: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        const mn = SHIFTS[m.reg];
        if (!mn) return invalida('deslocamento com campo reg 6 (instrução não documentada)');
        if (op < 0xD2) return fim(mn, [m.op, imm(1)], m.op.t === 'm' ? { base: 15 + m.ea, mem: size * 2 } : { base: 2 }, { ptr: true });
        return fim(mn, [m.op, reg(1, 1)], m.op.t === 'm' ? { base: 20 + m.ea, perBit: 4, mem: size * 2 } : { base: 8, perBit: 4 }, { ptr: true });
      }
      case 0xD4: case 0xD5: {
        const base = b();
        if (base !== 10) return invalida((op === 0xD4 ? 'AAM' : 'AAD') + ' com base ' + base + ' (o simulador só tem a base 10)');
        return fim(op === 0xD4 ? 'AAM' : 'AAD', [], { base: op === 0xD4 ? 83 : 60 });
      }
      case 0xD7: return fim('XLAT', seg ? [{ t: 'm', base: 'BX', index: null, disp: { v: 0 }, seg, size: 1 }] : [], { base: 11 });
      case 0xE0: case 0xE1: case 0xE2: case 0xE3: {
        const rel = toS8(b()), t = (ip + n + rel) & 0xFFFF;
        const mn = ['LOOPNE', 'LOOPE', 'LOOP', 'JCXZ'][op - 0xE0];
        const cy = [[19, 5], [18, 6], [17, 5], [18, 6]][op - 0xE0];
        return fim(mn, [imm(t)], { base: cy[1], taken: cy[0] }, { target: t });
      }
      case 0xE4: case 0xE5: { const p = b(); return fim('IN', [reg(0, op & 1 ? 2 : 1), imm(p)], { base: 10 }); }
      case 0xE6: case 0xE7: { const p = b(); return fim('OUT', [imm(p), reg(0, op & 1 ? 2 : 1)], { base: 10 }); }
      case 0xE8: { const rel = w(), t = (ip + n + rel) & 0xFFFF; return fim('CALL', [imm(t)], { base: 19 }, { target: t }); }
      case 0xE9: { const rel = w(), t = (ip + n + rel) & 0xFFFF; return fim('JMP', [imm(t)], { base: 15 }, { target: t }); }
      case 0xEA: { const off = w(), sg = w(); return fim('JMP', [{ t: 'farimm', segv: sg, offv: off }], { base: 15 }, { far: true, farTarget: { seg: sg, off } }); }
      case 0xEB: { const rel = toS8(b()), t = (ip + n + rel) & 0xFFFF; return fim('JMP', [imm(t)], { base: 15 }, { target: t, curto: true }); }
      case 0xEC: case 0xED: return fim('IN', [reg(0, op & 1 ? 2 : 1), reg(2, 2)], { base: 8 });
      case 0xEE: case 0xEF: return fim('OUT', [reg(2, 2), reg(0, op & 1 ? 2 : 1)], { base: 8 });
      case 0xF6: case 0xF7: {
        const size = op & 1 ? 2 : 1, m = lerModrm(size);
        const mn = GRP3[m.reg];
        if (!mn) return invalida(hx(op, 2) + ' com campo reg 1 (instrução não documentada)');
        const isM = m.op.t === 'm';
        if (mn === 'TEST') { const v = size === 1 ? b() : w(); return fim('TEST', [m.op, imm(v)], isM ? { base: 11 + m.ea, mem: size } : { base: 5 }, { ptr: true }); }
        if (mn === 'NOT' || mn === 'NEG') return fim(mn, [m.op], isM ? { base: 16 + m.ea, mem: size * 2 } : { base: 3 }, { ptr: true });
        const tbl = {
          MUL: size === 1 ? [[70, 77], [76, 83]] : [[118, 133], [124, 139]],
          IMUL: size === 1 ? [[80, 98], [86, 104]] : [[128, 154], [134, 160]],
          DIV: size === 1 ? [[80, 90], [86, 96]] : [[144, 162], [150, 168]],
          IDIV: size === 1 ? [[101, 112], [107, 118]] : [[165, 184], [171, 190]]
        }[mn];
        const c = isM ? tbl[1] : tbl[0];
        return fim(mn, [m.op], { base: Math.round((c[0] + c[1]) / 2) + (isM ? m.ea : 0), range: isM ? [c[0] + m.ea, c[1] + m.ea] : c, mem: isM ? size : 0 }, { ptr: true });
      }
      case 0xFE: {
        const m = lerModrm(1);
        if (m.reg > 1) return invalida('FEh com campo reg ' + m.reg + ' (só existem INC e DEC de byte)');
        return fim(m.reg ? 'DEC' : 'INC', [m.op], m.op.t === 'm' ? { base: 15 + m.ea, mem: 2 } : { base: 3 }, { ptr: true });
      }
      case 0xFF: {
        const m = lerModrm(2);
        const isM = m.op.t === 'm';
        switch (m.reg) {
          case 0: case 1: return fim(m.reg ? 'DEC' : 'INC', [m.op], isM ? { base: 15 + m.ea, mem: 4 } : { base: 3 }, { ptr: true });
          case 2: return fim('CALL', [m.op], isM ? { base: 21 + m.ea, mem: 2 } : { base: 16 }, { indirect: true, ptr: true });
          case 4: return fim('JMP', [m.op], isM ? { base: 18 + m.ea, mem: 2 } : { base: 11 }, { indirect: true, ptr: true });
          case 3: case 5:
            if (!isM) return invalida((m.reg === 3 ? 'CALL' : 'JMP') + ' far indireto precisa de memória');
            m.op.size = 4;
            return fim(m.reg === 3 ? 'CALL' : 'JMP', [m.op], { base: (m.reg === 3 ? 37 : 24) + m.ea, mem: 4 }, { indirect: true, far: true, ptr: true });
          case 6: return fim('PUSH', [m.op], isM ? { base: 16 + m.ea, mem: 4 } : { base: 11 }, { ptr: true });
          default: return invalida('FFh com campo reg 7 (não existe)');
        }
      }
    }
    if (op >= 0x91 && op <= 0x97) return fim('XCHG', [reg(0, 2), reg(op & 7, 2)], { base: 3 });
    if (op >= 0xB0 && op <= 0xB7) return fim('MOV', [reg(op & 7, 1), imm(b())], { base: 4 });
    if (op >= 0xB8 && op <= 0xBF) return fim('MOV', [reg(op & 7, 2), imm(w())], { base: 4 });
    if (STRINGS[op]) {
      const [mn, c1, c2] = STRINGS[op];
      const p = rep && /^(CMPS|SCAS)/.test(mn) ? (rep === 'REP' ? 'REPE' : rep) : rep;
      ins.prefix = p || (lock ? 'LOCK' : null);
      return fim(mn, seg ? [{ t: 'm', seg }] : [], p ? { base: 9, rep: c2 } : { base: c1 });
    }
    if (SIMPLES[op]) return fim(SIMPLES[op][0], [], { base: SIMPLES[op][1] });
    if (op >= 0xD8 && op <= 0xDF) {
      lerModrm(2);
      return invalida('instrução do coprocessador 8087 (' + hx(op, 2) + '): o simulador só executa instruções do 8087 que vieram do montador');
    }
    if (POS_8086[op]) return invalida(POS_8086[op]);
    return invalida('o byte ' + hx(op, 2) + ' não é uma instrução do 8086');
  }

  // ---------- texto em sintaxe MASM ----------
  function textoOp(o, comPtr) {
    switch (o.t) {
      case 'r': case 's': return o.name;
      case 'i': return hx(o.v & 0xFFFF);
      case 'farimm': return hx(o.segv, 4) + ':' + hx(o.offv, 4);
      case 'm': {
        let s = '';
        const partes = [o.base, o.index].filter(Boolean);
        const d = o.disp.v & 0xFFFF;
        if (!partes.length) s = '[' + hx(d, 4) + ']';
        else {
          const sd = d & 0x8000 ? d - 65536 : d;
          let dt = '';
          if (o.modo === 1) dt = sd < 0 ? '-' + hx(-sd, 2) : '+' + hx(sd, 2);
          else if (o.modo === 2) dt = '+' + hx(d, 4);
          s = '[' + partes.join('+') + dt + ']';
        }
        if (o.seg) s = o.seg + ':' + s;
        if (comPtr) s = (o.size === 4 ? 'DWORD' : o.size === 1 ? 'BYTE' : 'WORD') + ' PTR ' + s;
        return s;
      }
    }
    return '?';
  }
  function texto(ins, segTxt) {
    const mn = ins.mn;
    if (/^(MOVS|CMPS|STOS|LODS|SCAS)[BW]$/.test(mn)) return (ins.prefix && ins.prefix !== 'LOCK' ? ins.prefix + ' ' : '') + segTxt + mn;
    if (mn === 'XLAT') return segTxt + 'XLAT';
    const ops = ins.ops;
    // PTR quando o tamanho não aparece em nenhum registrador
    const temReg = ops.some(o => o.t === 'r' || o.t === 's');
    const precisaPtr = ins.ptr && !temReg || (ins.indirect && ops[0] && ops[0].t === 'm');
    const partes = ops.map(o => textoOp(o, precisaPtr && o.t === 'm'));
    let t = mn + (partes.length ? ' ' + partes.join(',') : '');
    if (mn === 'JMP' && ins.curto) t = 'JMP SHORT ' + partes[0];
    return t;
  }

  return { decodificar, hx };
});
