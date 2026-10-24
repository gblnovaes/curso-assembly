/* Simuladores interativos usados dentro das aulas. */
(function () {
  'use strict';
  const { h, hex, s16, s8, realce } = window.UI;
  const Asm = window.Asm8086;
  const { Machine, runProgram } = window.Machine8086;

  const box = (titulo, ...kids) => h('div.widget', null, h('div.wt', null, '■ ' + titulo), ...kids);
  const bin = (v, n) => (v >>> 0).toString(2).padStart(n, '0');
  function parseNum(s) {
    s = String(s).trim();
    if (!s) return NaN;
    try {
      if (/^-?\d+$/.test(s)) return parseInt(s, 10);
      return Asm.parseNumber(s);
    } catch (e) { return NaN; }
  }

  // Conversor de bases com bits clicáveis
  function bases(p) {
    let bits = p.bits || 8;
    let v = p.valor || 0;
    const entrada = h('input', { type: 'text', value: String(v), title: 'Decimal (42), hexadecimal (2Ah) ou binário (101010b)' });
    const selBits = h('select', null, h('option', { value: 8 }, '8 bits (byte)'), h('option', { value: 16 }, '16 bits (word)'));
    selBits.value = bits;
    const bitsEl = h('div.bits');
    const saida = h('table.res-tab');
    const render = () => {
      const mask = bits === 8 ? 0xFF : 0xFFFF;
      v &= mask;
      bitsEl.innerHTML = '';
      for (let i = bits - 1; i >= 0; i--) {
        const b = h('span.bit' + ((v >> i) & 1 ? '.on' : '') + (i % 4 === 3 && i !== bits - 1 ? '.sep' : ''), { title: 'bit ' + i + ' vale ' + (1 << i) }, (v >> i) & 1);
        b.addEventListener('click', () => { v ^= (1 << i); entrada.value = String(v); render(); });
        bitsEl.append(b);
      }
      const sig = bits === 8 ? s8(v) : s16(v);
      saida.innerHTML = '<tr><td>Decimal sem sinal</td><td><b>' + v + '</b></td></tr>' +
        '<tr><td>Decimal com sinal</td><td><b>' + sig + '</b></td></tr>' +
        '<tr><td>Hexadecimal</td><td><b>' + hex(v, bits / 4) + 'h</b></td></tr>' +
        '<tr><td>Binário</td><td><b>' + bin(v, bits).replace(/(\d{4})(?=\d)/g, '$1 ') + 'b</b></td></tr>' +
        (bits === 8 ? '<tr><td>Caractere (CP437)</td><td><b>' + (v >= 32 ? Asm.CP437[v] : '(controle)') + '</b></td></tr>' : '<tr><td>Bytes na memória</td><td><b>' + hex(v & 0xFF, 2) + ' ' + hex(v >> 8, 2) + '</b> (little-endian)</td></tr>');
    };
    entrada.addEventListener('input', () => { const n = parseNum(entrada.value); if (!isNaN(n)) { v = n; render(); } });
    selBits.addEventListener('change', () => { bits = +selBits.value; render(); });
    render();
    return box('Conversor de bases', h('div.row', null, 'Valor:', entrada, selBits, h('span', { style: { color: 'var(--c7)' } }, 'clique nos bits para ligar/desligar')), bitsEl, saida);
  }

  // Registrador AX dividido em AH e AL
  function registrador() {
    let ax = 0x1234;
    const reg = h('select', null, ...['AX', 'BX', 'CX', 'DX'].map(r => h('option', { value: r }, r)));
    const inp = h('input', { type: 'text', value: '1234h' });
    const vis = h('div');
    const render = () => {
      const r = reg.value;
      const hi = ax >> 8, lo = ax & 0xFF;
      vis.innerHTML = '<pre class="diag" style="font-size:1em">' +
        '              ' + r + ' = ' + hex(ax) + 'h = ' + ax + '\n' +
        '  ┌───────────────────────┬───────────────────────┐\n' +
        '  │ ' + bin(hi, 8).split('').join(' ') + '       │ ' + bin(lo, 8).split('').join(' ') + '       │\n' +
        '  └───────────────────────┴───────────────────────┘\n' +
        '    bits 15..8                bits 7..0\n' +
        '    ' + r[0] + 'H = ' + hex(hi, 2) + 'h = ' + String(hi).padEnd(3) + '            ' + r[0] + 'L = ' + hex(lo, 2) + 'h = ' + lo + '\n\n' +
        '    ' + r + ' = ' + r[0] + 'H × 256 + ' + r[0] + 'L = ' + hi + ' × 256 + ' + lo + ' = ' + ax + '</pre>';
    };
    const set = () => { const n = parseNum(inp.value); if (!isNaN(n)) { ax = n & 0xFFFF; render(); } };
    inp.addEventListener('input', set);
    reg.addEventListener('change', render);
    const botao = (txt, fn) => h('button.btn', { onclick: () => { fn(); inp.value = hex(ax) + 'h'; render(); } }, txt);
    render();
    return box('Registrador de 16 bits = parte alta + parte baixa', h('div.row', null, 'Registrador', reg, 'valor', inp),
      vis, h('div.row', null, botao('INC (16 bits)', () => { ax = (ax + 1) & 0xFFFF; }), botao('INC xL', () => { ax = (ax & 0xFF00) | ((ax + 1) & 0xFF); }),
        botao('MOV xH,0', () => { ax &= 0xFF; }), botao('MOV xL,0FFh', () => { ax = (ax & 0xFF00) | 0xFF; })));
  }

  // Calculadora de FLAGS: executa a operação de verdade na CPU simulada
  function flags(p) {
    const op = h('select', null, ...['ADD', 'SUB', 'CMP', 'ADC', 'SBB', 'AND', 'OR', 'XOR', 'TEST', 'INC', 'DEC', 'NEG', 'SHL', 'SHR', 'SAR', 'IMUL', 'MUL'].map(o => h('option', null, o)));
    op.value = p.op || 'ADD';
    const tam = h('select', null, h('option', { value: 8 }, '8 bits (AL, BL)'), h('option', { value: 16 }, '16 bits (AX, BX)'));
    tam.value = p.bits || 8;
    const a = h('input', { type: 'text', value: p.a !== undefined ? String(p.a) : '7Fh' });
    const b = h('input', { type: 'text', value: p.b !== undefined ? String(p.b) : '1' });
    const cfIn = h('input', { type: 'checkbox' });
    const res = h('div');
    const calc = () => {
      const bits = +tam.value;
      const A = parseNum(a.value), B = parseNum(b.value);
      if (isNaN(A) || isNaN(B)) { res.textContent = 'Valor inválido.'; return; }
      const ra = bits === 8 ? 'AL' : 'AX', rb = bits === 8 ? 'BL' : 'BX';
      const o = op.value;
      const un = ['INC', 'DEC', 'NEG'].includes(o);
      const muls = o === 'IMUL' || o === 'MUL';
      const sh = ['SHL', 'SHR', 'SAR'].includes(o);
      const inst = un ? o + ' ' + ra : muls ? o + ' ' + rb : sh ? o + ' ' + ra + ',1' : o + ' ' + ra + ',' + rb;
      const mask = bits === 8 ? 0xFF : 0xFFFF;
      const src = 'MOV ' + ra + ',' + (A & mask) + '\nMOV ' + rb + ',' + (B & mask) + '\n' + (cfIn.checked ? 'STC' : 'CLC') + '\n' + inst;
      const r = runProgram(src);
      const m = r.machine;
      const v = muls ? (bits === 8 ? m.AX : m.DX * 65536 + m.AX) : m.getReg(ra);
      const fl = ['CF', 'ZF', 'SF', 'OF', 'PF', 'AF'];
      const sig = (x, n) => n === 8 ? s8(x) : n === 16 ? s16(x) : (x | 0);
      const rbits = muls ? bits * 2 : bits;
      let explic = [];
      const g = (f) => m.getReg(f);
      if (!muls) {
        explic.push('Resultado ' + (o === 'CMP' || o === 'TEST' ? '(descartado, só as flags ficam) ' : '') + '= ' + hex(v, rbits / 4) + 'h: sem sinal ' + v + ', com sinal ' + sig(v, rbits) + '.');
        if (['ADD', 'ADC', 'SUB', 'SBB', 'CMP', 'NEG'].includes(o)) {
          explic.push(g('CF') ? 'CF=1: sem sinal, o resultado não coube (vai-um ou empréstimo).' : 'CF=0: sem sinal, o resultado coube.');
          explic.push(g('OF') ? 'OF=1: com sinal, o resultado saiu da faixa ' + (bits === 8 ? '-128..127' : '-32768..32767') + '.' : 'OF=0: com sinal, o resultado está correto.');
        }
        if (['INC', 'DEC'].includes(o)) explic.push('INC/DEC não mexem em CF: ele continua ' + (cfIn.checked ? '1' : '0') + ' como antes.');
        if (['AND', 'OR', 'XOR', 'TEST'].includes(o)) explic.push('Operações lógicas sempre zeram CF e OF.');
      } else {
        explic.push('Produto em ' + (bits === 8 ? 'AX' : 'DX:AX') + ' = ' + (o === 'IMUL' ? sig(v, rbits) : v) + '. CF=OF=' + g('CF') + (g('CF') ? ': a metade alta é significativa.' : ': o resultado cabe na metade baixa.'));
      }
      res.innerHTML = '<pre class="asm" style="border:1px solid var(--code-frame);margin:.3em 0">' + realce(src) + '</pre>' +
        '<div class="flags-g" style="grid-template-columns:repeat(6,auto);justify-content:start">' + fl.map(f => '<span class="f' + (g(f) ? ' on' : '') + '"><span class="fn">' + f + '</span>=<span class="fv">' + g(f) + '</span></span>').join('') + '</div>' +
        '<ul>' + explic.map(e => '<li>' + e + '</li>').join('') + '</ul>';
    };
    [op, tam, a, b, cfIn].forEach(e => e.addEventListener(e.tagName === 'INPUT' && e.type === 'text' ? 'input' : 'change', calc));
    calc();
    return box('Calculadora de FLAGS (executa na CPU simulada)', h('div.row', null, op, tam, 'A =', a, 'B =', b, h('label', null, cfIn, ' CF antes = 1')), res);
  }

  // Endereço físico segmento:offset
  function endereco(p) {
    const seg = h('input', { type: 'text', value: p.seg || '1234h' });
    const off = h('input', { type: 'text', value: p.off || '0010h' });
    const res = h('div');
    const calc = () => {
      const S = parseNum(seg.value), O = parseNum(off.value);
      if (isNaN(S) || isNaN(O)) { res.textContent = 'Valor inválido.'; return; }
      const s = S & 0xFFFF, o = O & 0xFFFF;
      const fis = s * 16 + o;
      const wrap = fis & 0xFFFFF;
      const alts = [];
      for (let d = -2; d <= 2; d++) {
        const s2 = s + d, o2 = o - d * 16;
        if (d !== 0 && s2 >= 0 && s2 <= 0xFFFF && o2 >= 0 && o2 <= 0xFFFF) alts.push(hex(s2) + ':' + hex(o2));
      }
      res.innerHTML = '<pre class="diag" style="font-size:1em">' +
        '  segmento × 16   ' + hex(s) + '0h   (desloca 4 bits = acrescenta um zero hexa)\n' +
        '+ offset          ' + ' ' + hex(o) + 'h\n' +
        '  ───────────────────────\n' +
        '  endereço físico ' + hex(fis, 5) + 'h' + (fis > 0xFFFFF ? '  → passa de 1 MB! No 8086 o bit 20 se perde: ' + hex(wrap, 5) + 'h' : '') + '\n' +
        '  em decimal: ' + wrap.toLocaleString('pt-BR') + '</pre>' +
        (alts.length ? '<p>O mesmo byte também pode ser chamado de: <code>' + alts.join('</code>, <code>') + '</code> e muitos outros (até 4096 combinações).</p>' : '') +
        (wrap >= 0xB8000 && wrap < 0xB8FA0 ? '<p>Esse endereço está na <b>memória de vídeo em modo texto</b> (B800:0000 a B800:0F9F).</p>' : '') +
        (wrap < 0x400 ? '<p>Esse endereço está na <b>tabela de vetores de interrupção</b> (0000:0000 a 0000:03FF).</p>' : '');
    };
    seg.addEventListener('input', calc); off.addEventListener('input', calc);
    calc();
    return box('Calculadora de endereço físico (segmento:offset)', h('div.row', null, 'Segmento', seg, 'Offset', off), res);
  }

  // Pilha visual
  function pilha() {
    const SP0 = 0x0100;
    let sp = SP0;
    const memo = new Map();
    const regs = { AX: 0x1111, BX: 0x2222, CX: 0x3333 };
    const vis = h('div');
    const log = h('div', { style: { color: 'var(--c7)', minHeight: '1.3em' } });
    const render = () => {
      let cel = '';
      for (let a = SP0 - 2; a >= SP0 - 12; a -= 2) {
        const topo = a === sp;
        const ocup = a >= sp;
        cel += '<div class="cel' + (topo ? ' topo' : '') + (ocup ? '' : ' vazia') + '"><span class="end">SS:' + hex(a) + '</span><span class="val">' + (memo.has(a) ? hex(memo.get(a)) : '????') + '</span>' + (topo ? ' ◄ SP' : '') + '</div>';
      }
      vis.innerHTML = '<div class="pilha-vis"><div>' + cel + '<div style="color:var(--c7)">↓ a pilha cresce para endereços menores</div></div><div class="regs"><table>' +
        Object.entries(regs).map(([k, v]) => '<tr><td class="nm">' + k + '</td><td class="v">' + hex(v) + '</td></tr>').join('') +
        '<tr><td class="nm">SP</td><td class="v">' + hex(sp) + '</td></tr></table></div></div>';
    };
    const push = (r) => {
      if (sp <= SP0 - 12) { log.textContent = 'Chega! Nesta demonstração a pilha tem só 6 posições.'; return; }
      sp -= 2; memo.set(sp, regs[r]); log.textContent = 'PUSH ' + r + ': SP = SP − 2 = ' + hex(sp) + 'h; depois grava ' + hex(regs[r]) + 'h em SS:' + hex(sp) + '.';
      render();
    };
    const pop = (r) => {
      if (sp >= SP0) { log.textContent = 'POP com a pilha vazia: no 8086 real isso lê lixo e bagunça SP. Aqui recusamos.'; return; }
      regs[r] = memo.get(sp); log.textContent = 'POP ' + r + ': lê ' + hex(regs[r]) + 'h de SS:' + hex(sp) + '; depois SP = SP + 2 = ' + hex(sp + 2) + 'h. (O valor continua na memória!)';
      sp += 2; render();
    };
    render();
    return box('Pilha passo a passo', h('div.row', null, ...['AX', 'BX', 'CX'].map(r => h('button.btn', { onclick: () => push(r) }, 'PUSH ' + r)), ...['AX', 'BX', 'CX'].map(r => h('button.btn.sec', { onclick: () => pop(r) }, 'POP ' + r))), vis, log);
  }

  // Complemento de dois
  function complemento() {
    let v = 0xFB;
    const range = h('input', { type: 'range', min: -128, max: 127, value: -5, style: { width: '30ch' } });
    const res = h('div');
    const render = () => {
      const n = +range.value;
      v = n & 0xFF;
      const inv = (~(-n)) & 0xFF;
      res.innerHTML = '<pre class="diag" style="font-size:1em">' +
        '  valor com sinal:  ' + String(n).padStart(4) + '\n' +
        '  em binário:       ' + bin(v, 8) + 'b  = ' + hex(v, 2) + 'h\n' +
        '  lido sem sinal:   ' + String(v).padStart(4) + (n < 0 ? '   (= 256 − ' + (-n) + ')' : '') + '\n' +
        (n < 0 ? '\n  Como chegar em ' + n + ':\n    1. escreva +' + (-n) + ' em binário:   ' + bin(-n, 8) + '\n    2. inverta todos os bits:   ' + bin(inv, 8) + '   (NOT)\n    3. some 1:                  ' + bin(v, 8) + '   (= NEG)\n' : '') +
        '\n  bit 7 (sinal) = ' + (v >> 7) + (v >> 7 ? '  → negativo' : '  → positivo ou zero') + '</pre>';
    };
    range.addEventListener('input', render);
    render();
    return box('Complemento de dois em 8 bits', h('div.row', null, '-128', range, '127'), res);
  }

  // Comparador de tamanho e ciclos
  function comparar(p) {
    const mk = (code) => {
      const ed = window.Depurador.criarEditor(code, { mini: true });
      ed.el.style.height = (p.altura || 9) + 'em';
      ed.el.style.minHeight = '4em';
      return ed;
    };
    const A = mk(p.a || 'MOV AX,0'), B = mk(p.b || 'XOR AX,AX');
    const res = h('div');
    const medir = () => {
      const rr = [A, B].map(ed => {
        const pr = Asm.assemble(ed.valor);
        if (!pr.ok) return { erro: pr.errors[0] };
        const r = runProgram(ed.valor, { setup: p.setup });
        const bytes = pr.instrs.reduce((s, i) => s + i.size, 0);
        return { bytes, ciclos: r.machine.cycles, instr: r.machine.steps, hexs: pr.instrs.map(i => i.bytes.map(b => hex(b, 2)).join(' ')).join(' | ') };
      });
      res.innerHTML = '<table class="res-tab"><tr><th></th><th>Versão A</th><th>Versão B</th></tr>' +
        ['bytes', 'ciclos', 'instr'].map(k => '<tr><td>' + { bytes: 'Tamanho (bytes)', ciclos: 'Ciclos executados', instr: 'Instruções executadas' }[k] + '</td>' +
          rr.map((r, i) => '<td>' + (r.erro ? '<span style="color:var(--bad)">linha ' + r.erro.line + ': ' + r.erro.msg + '</span>' : '<b>' + r[k] + '</b>' + (rr[1 - i] && !rr[1 - i].erro && r[k] < rr[1 - i][k] ? ' ◄ menor' : '')) + '</td>').join('') + '</tr>').join('') +
        '<tr><td>Código de máquina</td>' + rr.map(r => '<td style="font-size:.85em">' + (r.hexs || '') + '</td>').join('') + '</tr></table>' +
        '<p style="color:var(--c7)">Ciclos do 8086 segundo a tabela da Intel. O prefetch de 6 bytes e o barramento de 8 bits do 8088 alteram o tempo real.</p>';
    };
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(28ch, 1fr))', gap: '1.5ch' } }, h('div', null, 'Versão A', A.el), h('div', null, 'Versão B', B.el));
    medir();
    return box(p.titulo || 'Compare tamanho e ciclos', grid, h('div.row', null, h('button.btn', { onclick: medir }, 'Medir de novo')), res);
  }

  const W = { bases, registrador, flags, endereco, pilha, complemento, comparar };
  window.Widgets = {
    criar(nome, params) {
      const f = W[nome];
      if (!f) return h('div.nota.atencao', null, 'Simulador desconhecido: ' + nome);
      try { return f(params || {}); } catch (e) { console.error(e); return h('div.nota.atencao', null, 'Erro no simulador ' + nome + ': ' + e.message); }
    }
  };
})();
