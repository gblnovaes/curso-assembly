/*
 * Montador NASM (subconjunto) da trilha avançada do Curso Assembly.
 *
 * Monta código de 16 e 32 bits do 8086 ao 386 (e algumas instruções do 486 e
 * do Pentium), na sintaxe do NASM, gerando um binário puro, como "nasm -f bin".
 * As escolhas de codificação seguem as do NASM 2.16 (conferidas em
 * tests/nasm.test.js), para que os bytes mostrados nas aulas batam com os do
 * montador de verdade. As mensagens de erro explicam o problema em português.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Nasm386 = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const R8 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
  const R16 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
  const R32 = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
  const SREG = ['es', 'cs', 'ss', 'ds', 'fs', 'gs'];
  const CC = { o: 0, no: 1, b: 2, c: 2, nae: 2, nb: 3, nc: 3, ae: 3, e: 4, z: 4, ne: 5, nz: 5, be: 6, na: 6, nbe: 7, a: 7, s: 8, ns: 9, p: 10, pe: 10, np: 11, po: 11, l: 12, nge: 12, nl: 13, ge: 13, le: 14, ng: 14, nle: 15, g: 15 };
  const TAMANHOS = { byte: 1, word: 2, dword: 4, qword: 8, tword: 10 };
  const NOME_TAM = { 1: 'byte', 2: 'word', 4: 'dword', 8: 'qword' };
  const CPUS = { 8086: 0, 186: 1, 286: 2, 386: 3, 486: 4, 586: 5, pentium: 5, 686: 6, ppro: 6, p6: 6 };
  const NOME_CPU = ['8086', '80186', '80286', '80386', '80486', 'Pentium', 'Pentium Pro'];

  class ErroNasm extends Error {
    constructor(msg) { super(msg); this.nasm = true; }
  }
  class Indefinido extends Error {
    constructor(nome) { super('símbolo indefinido: ' + nome); this.nome = nome; }
  }

  function regInfo(nome) {
    nome = nome.toLowerCase();
    let i, m;
    if ((i = R8.indexOf(nome)) >= 0) return { t: 'reg', k: 'gp', size: 1, code: i, name: nome };
    if ((i = R16.indexOf(nome)) >= 0) return { t: 'reg', k: 'gp', size: 2, code: i, name: nome };
    if ((i = R32.indexOf(nome)) >= 0) return { t: 'reg', k: 'gp', size: 4, code: i, name: nome };
    if ((i = SREG.indexOf(nome)) >= 0) return { t: 'reg', k: 'seg', size: 2, code: i, name: nome };
    if ((m = /^cr([0-4])$/.exec(nome))) return { t: 'reg', k: 'cr', size: 4, code: +m[1], name: nome };
    if ((m = /^dr([0-7])$/.exec(nome))) return { t: 'reg', k: 'dr', size: 4, code: +m[1], name: nome };
    if ((m = /^tr([3-7])$/.exec(nome))) return { t: 'reg', k: 'tr', size: 4, code: +m[1], name: nome };
    return null;
  }

  // ---------------- expressões ----------------
  function lerNumero(s) {
    const t = s.replace(/_/g, '').toLowerCase();
    let m;
    if ((m = /^0[xh]([0-9a-f]+)$/.exec(t))) return parseInt(m[1], 16);
    if ((m = /^\$([0-9][0-9a-f]*)$/.exec(t))) return parseInt(m[1], 16);
    if ((m = /^([0-9][0-9a-f]*)h$/.exec(t))) return parseInt(m[1], 16);
    if ((m = /^0[by]([01]+)$/.exec(t))) return parseInt(m[1], 2);
    if ((m = /^([01]+)[by]$/.exec(t))) return parseInt(m[1], 2);
    if ((m = /^0[oq]([0-7]+)$/.exec(t))) return parseInt(m[1], 8);
    if ((m = /^([0-7]+)[oq]$/.exec(t))) return parseInt(m[1], 8);
    if ((m = /^0d([0-9]+)$/.exec(t))) return parseInt(m[1], 10);
    if ((m = /^([0-9]+)d?$/.exec(t))) return parseInt(m[1], 10);
    return null;
  }

  function tokenizar(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'" || c === '"' || c === '`') {
        const j = s.indexOf(c, i + 1);
        if (j < 0) throw new ErroNasm('Texto sem as aspas de fechamento: ' + s.slice(i));
        toks.push({ t: 'str', v: s.slice(i + 1, j) });
        i = j + 1; continue;
      }
      if (c === '$' && s[i + 1] === '$') { toks.push({ t: 'id', v: '$$' }); i += 2; continue; }
      if (c === '$' && /[0-9]/.test(s[i + 1] || '')) {
        const m = /^\$[0-9a-fA-F_]+/.exec(s.slice(i));
        toks.push({ t: 'num', v: lerNumero(m[0]) }); i += m[0].length; continue;
      }
      if (c === '$' && !/[\w.?@]/.test(s[i + 1] || '')) { toks.push({ t: 'id', v: '$' }); i++; continue; }
      if (/[0-9]/.test(c)) {
        const m = /^[0-9][0-9a-zA-Z_]*/.exec(s.slice(i));
        const v = lerNumero(m[0]);
        if (v === null || Number.isNaN(v)) throw new ErroNasm('Número inválido: ' + m[0]);
        toks.push({ t: 'num', v }); i += m[0].length; continue;
      }
      if (/[A-Za-z_.?@$]/.test(c)) {
        const m = /^[A-Za-z_.?@$][\w.?@$#~]*/.exec(s.slice(i));
        toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue;
      }
      const dois = s.slice(i, i + 2);
      if (['<<', '>>', '//', '%%', '==', '!=', '<=', '>=', '&&', '||', '<>'].includes(dois)) { toks.push({ t: 'op', v: dois }); i += 2; continue; }
      if ('+-*/%&|^~!()[]:,<>='.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
      throw new ErroNasm('Caractere inesperado: "' + c + '"');
    }
    return toks;
  }

  function strValor(s) {
    let v = 0;
    for (let i = Math.min(s.length, 4) - 1; i >= 0; i--) v = v * 256 + (s.charCodeAt(i) & 0xFF);
    return v;
  }

  // Analisador de expressões (precedência do NASM)
  function analisarExpr(toks) {
    let p = 0;
    const peek = () => toks[p];
    const isOp = (v) => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    const niveis = [['||'], ['&&'], ['==', '!=', '<>', '<', '>', '<=', '>=', '='], ['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*', '/', '//', '%', '%%']];
    function bin(n) {
      if (n >= niveis.length) return unario();
      let e = bin(n + 1);
      while (toks[p] && toks[p].t === 'op' && niveis[n].includes(toks[p].v)) {
        const op = toks[p++].v;
        e = { t: 'bin', op, a: e, b: bin(n + 1) };
      }
      return e;
    }
    function unario() {
      if (isOp('-') || isOp('+') || isOp('~') || isOp('!')) { const op = toks[p++].v; return { t: 'un', op, a: unario() }; }
      return prim();
    }
    function prim() {
      const t = peek();
      if (!t) throw new ErroNasm('Expressão incompleta.');
      if (t.t === 'num') { p++; return { t: 'num', v: t.v }; }
      if (t.t === 'str') { p++; return { t: 'num', v: strValor(t.v) }; }
      if (t.t === 'id') { p++; return { t: 'sym', v: t.v }; }
      if (isOp('(')) {
        p++;
        const e = bin(0);
        if (!isOp(')')) throw new ErroNasm('Falta fechar o parêntese.');
        p++;
        return e;
      }
      throw new ErroNasm('Esperava um número ou nome, mas veio "' + t.v + '".');
    }
    const e = bin(0);
    if (p < toks.length) throw new ErroNasm('Sobrou "' + toks.slice(p).map(t => t.t === 'str' ? "'" + t.v + "'" : t.v).join(' ') + '" na expressão.');
    return e;
  }

  function avaliar(e, ctx) {
    switch (e.t) {
      case 'num': return e.v;
      case 'sym': return ctx.simbolo(e.v);
      case 'un': {
        const a = avaliar(e.a, ctx);
        return e.op === '-' ? -a : e.op === '+' ? a : e.op === '~' ? ~a : (a ? 0 : 1);
      }
      case 'bin': {
        const a = avaliar(e.a, ctx), b = avaliar(e.b, ctx);
        switch (e.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': case '//': if (b === 0) { if (ctx.final) throw new ErroNasm('Divisão por zero na expressão.'); return 0; } return e.op === '/' ? Math.floor(Math.abs(a) / Math.abs(b)) * (Math.sign(a) * Math.sign(b) || 1) : Math.trunc(a / b);
          case '%': case '%%': if (b === 0) { if (ctx.final) throw new ErroNasm('Divisão por zero na expressão.'); return 0; } return a % b;
          case '&': return Number(BigInt.asUintN(64, BigInt(Math.trunc(a))) & BigInt.asUintN(64, BigInt(Math.trunc(b))));
          case '|': return Number(BigInt.asUintN(64, BigInt(Math.trunc(a))) | BigInt.asUintN(64, BigInt(Math.trunc(b))));
          case '^': return Number(BigInt.asUintN(64, BigInt(Math.trunc(a))) ^ BigInt.asUintN(64, BigInt(Math.trunc(b))));
          case '<<': return a * Math.pow(2, b);
          case '>>': return Math.floor(a / Math.pow(2, b));
          case '==': case '=': return a === b ? 1 : 0;
          case '!=': case '<>': return a !== b ? 1 : 0;
          case '<': return a < b ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
          case '&&': return a && b ? 1 : 0;
          case '||': return a || b ? 1 : 0;
        }
      }
    }
    throw new ErroNasm('Expressão inválida.');
  }

  function temSimbolo(e, nome) {
    if (!e) return false;
    if (e.t === 'sym') return nome ? e.v === nome : true;
    return temSimbolo(e.a, nome) || temSimbolo(e.b, nome);
  }

  // ---------------- texto: comentários e vírgulas ----------------
  function semComentario(l) {
    let q = null;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') q = c;
      else if (c === ';') return l.slice(0, i);
    }
    return l;
  }
  function separarVirgulas(s) {
    const r = [];
    let prof = 0, q = null, ini = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') q = c;
      else if (c === '(' || c === '[') prof++;
      else if (c === ')' || c === ']') prof--;
      else if (c === ',' && prof === 0) { r.push(s.slice(ini, i).trim()); ini = i + 1; }
    }
    const ult = s.slice(ini).trim();
    if (ult || r.length) r.push(ult);
    return r;
  }

  // ---------------- pré-processador (%define, %assign, %macro, %rep, %if) ----------------
  function preprocessar(fonte, erros) {
    const linhas = fonte.replace(/\r\n?/g, '\n').split('\n');
    const saida = [];
    const defines = new Map();
    const macros = new Map();
    let contMacro = 0;

    // %+ cola dois pedaços num nome só: stub %+ v  ->  stub3 (quando v vale 3)
    const colar = (txt) => txt.indexOf('%+') < 0 ? txt : txt.replace(/\s*%\+\s*/g, '');
    const substituirDefines = (txt) => colar(substituirDefines0(txt));
    const substituirDefines0 = (txt) => {
      if (!defines.size) return txt;
      let out = '', q = null;
      for (let i = 0; i < txt.length;) {
        const c = txt[i];
        if (q) { out += c; if (c === q) q = null; i++; continue; }
        if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
        if (c === ';') { out += txt.slice(i); break; }
        const m = /^[A-Za-z_.?@][\w.?@$#~]*/.exec(txt.slice(i));
        if (m && (i === 0 || !/[\w.?@$#~%]/.test(txt[i - 1]))) {
          out += defines.has(m[0]) ? defines.get(m[0]) : m[0];
          i += m[0].length; continue;
        }
        out += c; i++;
      }
      return out;
    };
    const valorPre = (txt, linha) => {
      const e = analisarExpr(tokenizar(substituirDefines(txt)));
      return avaliar(e, { final: true, simbolo: (n) => { throw new ErroNasm('Em ' + linha + ' só valem números e nomes de %assign/%define, e "' + n + '" não é um deles.'); } });
    };

    function processar(lista, profundidade) {
      if (profundidade > 40) throw new ErroNasm('Macros ou %rep aninhados fundo demais (uma macro chama a si mesma?).');
      const pilhaIf = [];
      const ativo = () => pilhaIf.every(x => x.ativo);
      for (let i = 0; i < lista.length; i++) {
        const { texto, linha } = lista[i];
        const t = semComentario(texto).trim();
        const dir = /^%(\w+)\b\s*(.*)$/.exec(t);
        try {
          if (dir) {
            const d = dir[1].toLowerCase(), resto = dir[2].trim();
            if (d === 'if' || d === 'ifdef' || d === 'ifndef') {
              if (!ativo()) { pilhaIf.push({ ativo: false, feito: true }); continue; }
              const v = d === 'if' ? !!valorPre(resto, '%if') : (d === 'ifdef') === defines.has(resto.split(/\s+/)[0]);
              pilhaIf.push({ ativo: v, feito: v }); continue;
            }
            if (d === 'elif') { const top = pilhaIf[pilhaIf.length - 1]; if (!top) throw new ErroNasm('%elif sem %if.'); const pai = pilhaIf.slice(0, -1).every(x => x.ativo); if (top.feito || !pai) top.ativo = false; else { top.ativo = !!valorPre(resto, '%elif'); top.feito = top.ativo; } continue; }
            if (d === 'else') { const top = pilhaIf[pilhaIf.length - 1]; if (!top) throw new ErroNasm('%else sem %if.'); const pai = pilhaIf.slice(0, -1).every(x => x.ativo); top.ativo = pai && !top.feito; top.feito = true; continue; }
            if (d === 'endif') { if (!pilhaIf.length) throw new ErroNasm('%endif sem %if.'); pilhaIf.pop(); continue; }
          }
          if (!ativo()) continue;
          if (dir) {
            const d = dir[1].toLowerCase(), resto = dir[2].trim();
            if (d === 'define' || d === 'xdefine') {
              const m = /^([A-Za-z_.?@][\w.?@$#~]*)\s*(.*)$/.exec(resto);
              if (!m) throw new ErroNasm('%define precisa de um nome.');
              defines.set(m[1], d === 'xdefine' ? substituirDefines(m[2]) : m[2]);
              continue;
            }
            if (d === 'undef') { defines.delete(resto); continue; }
            if (d === 'assign') {
              const m = /^([A-Za-z_.?@][\w.?@$#~]*)\s+(.*)$/.exec(resto);
              if (!m) throw new ErroNasm('%assign precisa de um nome e um valor.');
              defines.set(m[1], String(valorPre(m[2], '%assign')));
              continue;
            }
            if (d === 'rep') {
              const n = valorPre(resto, '%rep');
              const corpo = [];
              let prof = 1, j = i + 1;
              for (; j < lista.length; j++) {
                const tj = semComentario(lista[j].texto).trim().toLowerCase();
                if (/^%rep\b/.test(tj)) prof++;
                else if (/^%endrep\b/.test(tj) && --prof === 0) break;
                corpo.push(lista[j]);
              }
              if (j >= lista.length) throw new ErroNasm('%rep sem %endrep.');
              if (n > 100000) throw new ErroNasm('%rep ' + n + ' repete demais.');
              for (let k = 0; k < n; k++) { const r = processar(corpo, profundidade + 1); if (r === 'exitrep') break; }
              i = j; continue;
            }
            if (d === 'exitrep') return 'exitrep';
            if (d === 'macro') {
              const m = /^([A-Za-z_.?@][\w.?@$#~]*)\s+(\d+)(?:-(\d+|\*))?(\+)?\s*$/.exec(resto);
              if (!m) throw new ErroNasm('%macro precisa do nome e do número de parâmetros: %macro nome 2');
              const corpo = [];
              let j = i + 1;
              for (; j < lista.length; j++) {
                if (/^%endmacro\b/i.test(semComentario(lista[j].texto).trim())) break;
                corpo.push(lista[j].texto);
              }
              if (j >= lista.length) throw new ErroNasm('%macro ' + m[1] + ' sem %endmacro.');
              macros.set(m[1].toLowerCase(), { nome: m[1], min: +m[2], max: m[3] === '*' ? Infinity : m[3] ? +m[3] : +m[2], guloso: !!m[4], corpo });
              i = j; continue;
            }
            if (d === 'endmacro') throw new ErroNasm('%endmacro sem %macro.');
            if (d === 'endrep') throw new ErroNasm('%endrep sem %rep.');
            if (d === 'include') throw new ErroNasm('%include não está disponível aqui: cole o conteúdo do arquivo no lugar.');
            if (d === 'error') throw new ErroNasm(resto.replace(/^["']|["']$/g, ''));
            throw new ErroNasm('Diretiva desconhecida: %' + dir[1]);
          }
          // chamada de macro?
          const txt = substituirDefines(texto);
          const mm = /^\s*(?:([A-Za-z_.?@][\w.?@$#~]*:)\s*)?([A-Za-z_.?@][\w.?@$#~]*)\b(.*)$/.exec(semComentario(txt));
          if (mm && macros.has(mm[2].toLowerCase())) {
            const mac = macros.get(mm[2].toLowerCase());
            let args = mm[3].trim() ? separarVirgulas(mm[3].trim()) : [];
            // %macro nome 1+ : o último parâmetro leva o resto da linha, com vírgulas e tudo
            if (mac.guloso && args.length > mac.max) args = args.slice(0, mac.max - 1).concat([args.slice(mac.max - 1).join(', ')]);
            if (args.length < mac.min || args.length > mac.max) throw new ErroNasm('A macro ' + mac.nome + ' espera ' + (mac.min === mac.max ? mac.min : mac.min + ' ou mais') + ' parâmetro(s), mas recebeu ' + args.length + '.');
            const id = ++contMacro;
            if (mm[1]) saida.push({ texto: mm[1], linha });
            const corpo = mac.corpo.map(l => ({
              texto: l.replace(/%%([\w.?@$#~]+)/g, '..@' + id + '.$1').replace(/%\{?(\d+)\}?/g, (_, n) => n === '0' ? String(args.length) : (args[+n - 1] !== undefined ? args[+n - 1] : '')),
              linha
            }));
            processar(corpo, profundidade + 1);
            continue;
          }
          saida.push({ texto: txt, linha });
        } catch (e) {
          if (!e.nasm) throw e;
          erros.push({ linha, msg: e.message });
        }
      }
      if (pilhaIf.length) erros.push({ linha: lista.length ? lista[lista.length - 1].linha : 1, msg: '%if sem %endif.' });
      return null;
    }
    const lista = linhas.map((texto, i) => ({ texto, linha: i + 1 }));
    // %macro e %rep são tratados aqui; erros de bloco sem fim também
    try { processar(lista, 0); } catch (e) { if (!e.nasm) throw e; erros.push({ linha: 1, msg: e.message }); }
    return saida;
  }

  // ---------------- operandos ----------------
  function analisarOperando(txt) {
    let s = txt.trim();
    const o = { txt };
    // palavras de tamanho e distância
    for (;;) {
      const m = /^(byte|word|dword|qword|tword|short|near|far|strict|to)\b\s*/i.exec(s);
      if (!m) break;
      const w = m[1].toLowerCase();
      if (TAMANHOS[w]) o.size = TAMANHOS[w];
      else if (w === 'short' || w === 'near' || w === 'far') o.dist = w;
      else if (w === 'strict') o.strict = true;
      s = s.slice(m[0].length);
    }
    if (/^(es|cs|ss|ds|fs|gs)\s*:\s*\[/i.test(s)) throw new ErroNasm('No NASM, o segmento vai dentro dos colchetes: [' + s.replace(/\s*:\s*\[/, ':').replace(/\]$/, '') + ']');
    if (s.startsWith('[')) {
      if (!s.endsWith(']')) throw new ErroNasm('Falta o "]" no operando ' + txt);
      return Object.assign(o, analisarMem(s.slice(1, -1)));
    }
    const r = regInfo(s);
    if (r) { if (o.size && o.size !== r.size) throw new ErroNasm('"' + txt + '": ' + r.name + ' tem ' + r.size * 8 + ' bits.'); return Object.assign(r, { txt }); }
    // seg:off imediato (salto far)
    const partes = dividirDoisPontos(s);
    if (partes) return Object.assign(o, { t: 'far', seg: analisarExpr(tokenizar(partes[0])), off: analisarExpr(tokenizar(partes[1])) });
    o.t = 'imm';
    o.e = analisarExpr(tokenizar(s));
    return o;
  }
  function dividirDoisPontos(s) {
    let q = null, prof = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"') q = c;
      else if (c === '(') prof++;
      else if (c === ')') prof--;
      else if (c === ':' && prof === 0) return [s.slice(0, i), s.slice(i + 1)];
    }
    return null;
  }

  function analisarMem(dentro) {
    let s = dentro.trim();
    const mem = { t: 'mem', seg: null, base: null, index: null, scale: 1, disp: null };
    let m;
    for (;;) {
      m = /^(byte|word|dword|qword|nosplit|abs|rel)\b\s*/i.exec(s);
      if (!m) break;
      if (m[1].toLowerCase() === 'nosplit') mem.nosplit = true;
      else if (TAMANHOS[m[1].toLowerCase()]) mem.dispSize = TAMANHOS[m[1].toLowerCase()];
      s = s.slice(m[0].length);
    }
    if ((m = /^(es|cs|ss|ds|fs|gs)\s*:\s*/i.exec(s))) { mem.seg = SREG.indexOf(m[1].toLowerCase()); s = s.slice(m[0].length); }
    // termos separados por + e - no nível de cima
    const termos = [];
    let ini = 0, prof = 0, sinal = '+';
    for (let i = 0; i <= s.length; i++) {
      const c = s[i];
      if (c === '(') prof++;
      else if (c === ')') prof--;
      if (i === s.length || ((c === '+' || c === '-') && prof === 0 && i > ini && !/[*\/]\s*$/.test(s.slice(ini, i)))) {
        const t = s.slice(ini, i).trim();
        if (t) termos.push({ sinal, t });
        else if (i < s.length) { sinal = c === '-' ? (sinal === '-' ? '+' : '-') : sinal; ini = i + 1; continue; }
        if (i < s.length) { sinal = c; ini = i + 1; }
      }
    }
    const disp = [];
    for (const { sinal: sg, t } of termos) {
      const r = regInfo(t);
      let mi;
      if (r) {
        if (r.k !== 'gp' || r.size === 1) throw new ErroNasm('"' + t + '" não serve para endereçar a memória.');
        if (sg === '-') throw new ErroNasm('Não dá para subtrair um registrador num endereço: [' + dentro + ']');
        if (!mem.base) mem.base = r; else if (!mem.index) mem.index = r; else throw new ErroNasm('Registradores demais no endereço [' + dentro + ']');
        continue;
      }
      if ((mi = /^(\w+)\s*\*\s*(.+)$/.exec(t)) && regInfo(mi[1]) || (mi = /^(.+?)\s*\*\s*(\w+)$/.exec(t)) && regInfo(mi[2])) {
        const rr = regInfo(mi[1]) || regInfo(mi[2]);
        const k = regInfo(mi[1]) ? mi[2] : mi[1];
        if (sg === '-') throw new ErroNasm('Não dá para subtrair um registrador num endereço: [' + dentro + ']');
        const esc = avaliar(analisarExpr(tokenizar(k)), { final: true, simbolo: () => { throw new ErroNasm('A escala precisa ser um número: [' + dentro + ']'); } });
        if (mem.index) throw new ErroNasm('Só um registrador pode ser multiplicado: [' + dentro + ']');
        mem.index = rr; mem.scale = esc;
        continue;
      }
      disp.push((sg === '-' ? '-(' : '+(') + t + ')');
    }
    if (disp.length) mem.disp = analisarExpr(tokenizar(disp.join('')));
    return mem;
  }

  // ---------------- tabelas de instruções ----------------
  const ALU = { add: 0, or: 1, adc: 2, sbb: 3, and: 4, sub: 5, xor: 6, cmp: 7 };
  const SHIFT = { rol: 0, ror: 1, rcl: 2, rcr: 3, shl: 4, sal: 4, shr: 5, sar: 7 };
  const GRUPO3 = { not: 2, neg: 3, mul: 4, div: 6, idiv: 7 };
  const BT = { bt: 4, bts: 5, btr: 6, btc: 7 };
  // instruções sem operandos: [bytes, cpu mínima, tamanho do operando ou 0]
  const SIMPLES = {
    nop: [[0x90], 0], hlt: [[0xF4], 0], clc: [[0xF8], 0], stc: [[0xF9], 0], cmc: [[0xF5], 0], cld: [[0xFC], 0], std: [[0xFD], 0],
    cli: [[0xFA], 0], sti: [[0xFB], 0], lahf: [[0x9F], 0], sahf: [[0x9E], 0], int3: [[0xCC], 0], into: [[0xCE], 0], wait: [[0x9B], 0], fwait: [[0x9B], 0],
    xlat: [[0xD7], 0], xlatb: [[0xD7], 0], aaa: [[0x37], 0], aas: [[0x3F], 0], daa: [[0x27], 0], das: [[0x2F], 0],
    cbw: [[0x98], 0, 2], cwde: [[0x98], 3, 4], cwd: [[0x99], 0, 2], cdq: [[0x99], 3, 4],
    pusha: [[0x60], 1, -1], popa: [[0x61], 1, -1], pushaw: [[0x60], 1, 2], popaw: [[0x61], 1, 2], pushad: [[0x60], 3, 4], popad: [[0x61], 3, 4],
    pushf: [[0x9C], 0, -1], popf: [[0x9D], 0, -1], pushfw: [[0x9C], 0, 2], popfw: [[0x9D], 0, 2], pushfd: [[0x9C], 3, 4], popfd: [[0x9D], 3, 4],
    iret: [[0xCF], 0, -1], iretw: [[0xCF], 0, 2], iretd: [[0xCF], 3, 4], leave: [[0xC9], 1], clts: [[0x0F, 0x06], 2],
    movsb: [[0xA4], 0], movsw: [[0xA5], 0, 2], movsd: [[0xA5], 3, 4], cmpsb: [[0xA6], 0], cmpsw: [[0xA7], 0, 2], cmpsd: [[0xA7], 3, 4],
    stosb: [[0xAA], 0], stosw: [[0xAB], 0, 2], stosd: [[0xAB], 3, 4], lodsb: [[0xAC], 0], lodsw: [[0xAD], 0, 2], lodsd: [[0xAD], 3, 4],
    scasb: [[0xAE], 0], scasw: [[0xAF], 0, 2], scasd: [[0xAF], 3, 4], insb: [[0x6C], 1], insw: [[0x6D], 1, 2], insd: [[0x6D], 3, 4],
    outsb: [[0x6E], 1], outsw: [[0x6F], 1, 2], outsd: [[0x6F], 3, 4],
    cpuid: [[0x0F, 0xA2], 5], wbinvd: [[0x0F, 0x09], 4], invd: [[0x0F, 0x08], 4], rdtsc: [[0x0F, 0x31], 5], rdmsr: [[0x0F, 0x32], 5], wrmsr: [[0x0F, 0x30], 5],
    ud2: [[0x0F, 0x0B], 6]
  };
  const PREFIXOS = { rep: 0xF3, repe: 0xF3, repz: 0xF3, repne: 0xF2, repnz: 0xF2, lock: 0xF0, o16: 'o16', o32: 'o32', a16: 'a16', a32: 'a32', es: 's0', cs: 's1', ss: 's2', ds: 's3', fs: 's4', gs: 's5' };
  const DADOS = { db: 1, dw: 2, dd: 4, dq: 8 };
  const RES = { resb: 1, resw: 2, resd: 4, resq: 8 };

  const MNEMONICOS = new Set([
    ...Object.keys(ALU), ...Object.keys(SHIFT), ...Object.keys(GRUPO3), ...Object.keys(BT), ...Object.keys(SIMPLES),
    'mov', 'test', 'xchg', 'inc', 'dec', 'imul', 'shld', 'shrd', 'bsf', 'bsr', 'movzx', 'movsx', 'jmp', 'call', 'ret', 'retn', 'retf',
    'loop', 'loope', 'loopz', 'loopne', 'loopnz', 'jcxz', 'jecxz', 'int', 'push', 'pop', 'lea', 'lds', 'les', 'lss', 'lfs', 'lgs',
    'enter', 'bound', 'in', 'out', 'aam', 'aad', 'lgdt', 'sgdt', 'lidt', 'sidt', 'lmsw', 'smsw', 'invlpg', 'lldt', 'sldt', 'ltr', 'str',
    'verr', 'verw', 'lar', 'lsl', 'arpl', 'bswap', 'cmpxchg', 'xadd',
    ...Object.keys(CC).map(c => 'j' + c), ...Object.keys(CC).map(c => 'set' + c)
  ]);

  // ---------------- montador ----------------
  function montar(fonte, opts) {
    opts = opts || {};
    const erros = [], avisos = [];
    const linhasPre = preprocessar(fonte, erros);

    // 1) análise das linhas em comandos
    const cmds = [];
    let ultimoGlobal = '';
    let strucAtual = null;
    const nomeLocal = (n) => {
      if (n.startsWith('..@')) return n;
      if (n.startsWith('.')) {
        if (strucAtual) return strucAtual + n;
        return ultimoGlobal + n;
      }
      return n;
    };
    for (const { texto, linha } of linhasPre) {
      let s = semComentario(texto).trim();
      if (!s) continue;
      try {
        // [bits 32], [org 7c00h]
        const col = /^\[\s*(\w+)\s+([^\]]*)\]$/.exec(s);
        if (col) s = col[1] + ' ' + col[2];
        const cmd = { linha };
        // rótulo
        let m = /^([A-Za-z_.?@$][\w.?@$#~]*)\s*:(?!:)\s*(.*)$/.exec(s);
        if (m && !regInfo(m[1]) && !/^(es|cs|ss|ds|fs|gs)$/i.test(m[1])) {
          cmd.label = m[1].replace(/^\$/, ''); s = m[2];
        } else {
          m = /^([A-Za-z_.?@$][\w.?@$#~]*)\s+(equ|db|dw|dd|dq|resb|resw|resd|resq|times)\b\s*(.*)$/i.exec(s);
          if (m && !MNEMONICOS.has(m[1].toLowerCase()) && !PREFIXOS[m[1].toLowerCase()]) { cmd.label = m[1].replace(/^\$/, ''); s = m[2] + ' ' + m[3]; }
          else {
            m = /^([A-Za-z_.?@$][\w.?@$#~]*)$/.exec(s);
            if (m && !MNEMONICOS.has(m[1].toLowerCase()) && !/^(bits|org|align|alignb|section|segment|global|extern|cpu|struc|endstruc|use16|use32|absolute)$/i.test(m[1])) {
              cmd.label = m[1].replace(/^\$/, ''); s = '';
              avisos.push({ linha, msg: 'Rótulo "' + m[1] + '" sem dois-pontos. O NASM aceita, mas avisa: se era para ser uma instrução, o nome está errado.' });
            }
          }
        }
        if (cmd.label) {
          const ehLocal = cmd.label.startsWith('.') && !cmd.label.startsWith('..@');
          if (!ehLocal && !strucAtual && !cmd.label.startsWith('..@')) ultimoGlobal = cmd.label;
          cmd.label = nomeLocal(cmd.label);
        }
        cmd.escopo = strucAtual || ultimoGlobal;
        s = s.trim();
        if (!s) { if (cmd.label) cmds.push(cmd); continue; }
        // times n ...
        if ((m = /^times\s+(.+)$/i.exec(s))) {
          const resto = m[1];
          // a expressão vai até a primeira palavra que é instrução ou diretiva
          const toks = resto.split(/\s+/);
          let k = 1;
          while (k < toks.length && !MNEMONICOS.has(toks[k].toLowerCase()) && !DADOS[toks[k].toLowerCase()] && !RES[toks[k].toLowerCase()] && !PREFIXOS[toks[k].toLowerCase()]) k++;
          if (k >= toks.length) throw new ErroNasm('times precisa de uma instrução ou de um db/dw/dd depois do número.');
          const idx = resto.indexOf(toks[k], toks.slice(0, k).join(' ').length);
          cmd.times = analisarExpr(tokenizar(resto.slice(0, idx)));
          s = resto.slice(idx);
        }
        const pm = /^(\S+)\s*(.*)$/.exec(s);
        let op = pm[1].toLowerCase(), args = pm[2].trim();
        // prefixos
        cmd.prefixos = [];
        while (PREFIXOS[op] && args) {
          cmd.prefixos.push(op);
          const p2 = /^(\S+)\s*(.*)$/.exec(args);
          op = p2[1].toLowerCase(); args = p2[2].trim();
        }
        if (PREFIXOS[op] && !args) { cmd.prefixos.push(op); op = ''; }
        cmd.op = op;
        if (op === 'equ') {
          if (!cmd.label) throw new ErroNasm('equ precisa de um nome antes: NOME equ valor');
          cmd.kind = 'equ'; cmd.e = analisarExpr(tokenizar(args));
        } else if (DADOS[op]) {
          cmd.kind = 'dados'; cmd.size = DADOS[op];
          cmd.itens = separarVirgulas(args).map(a => {
            if (!a) throw new ErroNasm(op + ' com item vazio.');
            if (/^(['"`])/.test(a)) {
              const t = tokenizar(a);
              if (t.length === 1 && t[0].t === 'str') return { str: t[0].v };
            }
            if (a === '?') throw new ErroNasm('No NASM não existe "?" para valor indefinido: use 0 ou resb/resw/resd.');
            if (op === 'dq' && /^(0x[0-9a-f_]+|[0-9][0-9a-f_]*h)$/i.test(a)) return { big: BigInt('0x' + a.replace(/^0x|h$/gi, '').replace(/_/g, '')) };
            return { e: analisarExpr(tokenizar(a)) };
          });
        } else if (RES[op]) {
          cmd.kind = 'res'; cmd.size = RES[op]; cmd.e = analisarExpr(tokenizar(args));
        } else if (op === 'bits' || op === 'use16' || op === 'use32') {
          cmd.kind = 'bits'; cmd.v = op === 'use16' ? 16 : op === 'use32' ? 32 : +args;
          if (cmd.v !== 16 && cmd.v !== 32) throw new ErroNasm('bits aceita 16 ou 32 aqui' + (cmd.v === 64 ? ' (o modo de 64 bits fica para depois do 386).' : '.'));
        } else if (op === 'org') {
          cmd.kind = 'org'; cmd.e = analisarExpr(tokenizar(args));
        } else if (op === 'align' || op === 'alignb') {
          const a = separarVirgulas(args);
          cmd.kind = 'align'; cmd.e = analisarExpr(tokenizar(a[0]));
          cmd.fill = op === 'alignb' ? 0 : 0x90;
          if (a[1]) { const mf = /^db\s+(.+)$/i.exec(a[1]); if (!mf) throw new ErroNasm('align: o preenchimento é "db valor", como em align 4, db 0'); cmd.fill = avaliar(analisarExpr(tokenizar(mf[1])), { final: true, simbolo: () => 0 }) & 0xFF; }
        } else if (op === 'section' || op === 'segment' || op === 'global' || op === 'default') {
          cmd.kind = 'nada';
        } else if (op === 'extern') {
          throw new ErroNasm('extern não existe num binário puro: aqui tudo precisa estar no mesmo arquivo. (Com um ligador, como no módulo 26, extern volta a fazer sentido.)');
        } else if (op === 'cpu') {
          const n = args.toLowerCase().replace(/^i/, '');
          if (CPUS[n] === undefined) throw new ErroNasm('cpu desconhecida: ' + args + '. Use 8086, 186, 286, 386, 486 ou 586.');
          cmd.kind = 'cpu'; cmd.v = CPUS[n];
        } else if (op === 'struc') {
          if (strucAtual) throw new ErroNasm('struc dentro de struc.');
          cmd.kind = 'struc'; cmd.nome = args.trim(); strucAtual = cmd.nome; ultimoGlobal = cmd.nome;
        } else if (op === 'endstruc') {
          if (!strucAtual) throw new ErroNasm('endstruc sem struc.');
          cmd.kind = 'endstruc'; cmd.nome = strucAtual; strucAtual = null;
        } else if (op === 'istruc' || op === 'at' || op === 'iend') {
          throw new ErroNasm(op + ' não é aceito aqui: declare os campos com db/dw/dd na ordem.');
        } else if (op === 'absolute') {
          throw new ErroNasm('absolute não é aceito aqui: use struc/endstruc ou equ.');
        } else if (op === '') {
          cmd.kind = 'instr'; cmd.op = '';
        } else {
          if (!MNEMONICOS.has(op)) {
            throw new ErroNasm('Instrução desconhecida: "' + pm[1] + '"' + (/^(proc|endp|assume|model|ends)$/i.test(op) || /^\./.test(op) ? '. Isso é do MASM; no NASM não existe.' : /^(offset|ptr)$/i.test(op) ? '' : '.'));
          }
          cmd.kind = 'instr';
          const brutos = args ? separarVirgulas(args) : [];
          for (const o of brutos) if (/\bptr\b/i.test(o)) throw new ErroNasm('"PTR" é do MASM. No NASM escreva só o tamanho: byte [x], word [x], dword [x].');
          for (const o of brutos) if (/^offset\b/i.test(o.trim())) throw new ErroNasm('"OFFSET" é do MASM. No NASM o nome sozinho já é o endereço: mov si, msg');
          cmd.ops = brutos.map(analisarOperando);
        }
        cmds.push(cmd);
      } catch (e) {
        if (!e.nasm) throw e;
        erros.push({ linha, msg: e.message });
      }
    }
    if (strucAtual) erros.push({ linha: linhasPre.length ? linhasPre[linhasPre.length - 1].linha : 1, msg: 'struc ' + strucAtual + ' sem endstruc.' });
    if (erros.length) return { ok: false, erros, avisos, bytes: new Uint8Array(0), listagem: [], simbolos: {} };

    // 2) passadas até os endereços pararem de mudar
    let anterior = new Map();
    let simbolos = new Map();
    let saida = null, listagem = null, org = 0, origemDefinida = false;
    let errosPassada = [];
    for (let passada = 0; passada < 60; passada++) {
      const final = passada > 0 && saida === 'final';
      simbolos = new Map();
      let mudou = false, cresceu = false, desconhecido = false;
      let pc = 0, bits = opts.bits || 16, cpu = 6;
      let strucPc = null;
      org = 0; origemDefinida = false;
      const bytes = [];
      listagem = [];
      errosPassada = [];
      const definir = (nome, v, cmd) => {
        if (simbolos.has(nome)) { errosPassada.push({ linha: cmd.linha, msg: 'O nome "' + nome + '" foi definido mais de uma vez.' }); return; }
        simbolos.set(nome, v);
        if (anterior.get(nome) !== v) mudou = true;
      };
      for (const cmd of cmds) {
        const pcIni = pc;
        const aqui = strucPc !== null ? strucPc : org + pc;
        const ctx = {
          final, bits, cpu, aqui, inicio: org, cmd,
          simbolo: (n) => {
            if (n === '$') return aqui;
            if (n === '$$') return org;
            const nome = n.startsWith('.') && !n.startsWith('..@') ? (cmd.escopo || '') + n : n;
            if (simbolos.has(nome)) return simbolos.get(nome);
            if (anterior.has(nome)) { if (!final) ctx.incerto = true; return anterior.get(nome); }
            if (final) throw new ErroNasm('Símbolo não definido: "' + n + '"' + (regInfo(n) ? '' : /^[A-Z]/.test(n) && [...simbolos.keys()].some(k => k.toLowerCase() === nome.toLowerCase()) ? ' (no NASM, maiúsculas e minúsculas são diferentes nos rótulos)' : '') + '.');
            ctx.incerto = true; desconhecido = true;
            return 0;
          }
        };
        try {
          if (cmd.label && cmd.kind !== 'equ') {
            definir(cmd.label, aqui, cmd);
          }
          // o escopo dos rótulos locais (.x) é o último rótulo global antes do comando
          switch (cmd.kind) {
            case undefined: break;
            case 'equ': {
              const v = avaliar(cmd.e, ctx);
              definir(cmd.label, v, cmd);
              break;
            }
            case 'bits': bits = cmd.v; break;
            case 'cpu': cpu = cmd.v; break;
            case 'nada': break;
            case 'org': {
              if (pc > 0) throw new ErroNasm('org precisa vir antes de qualquer código ou dado.');
              if (origemDefinida) throw new ErroNasm('Só pode haver um org no arquivo.');
              org = avaliar(cmd.e, ctx); origemDefinida = true; break;
            }
            case 'struc': definir(cmd.nome, 0, cmd); strucPc = 0; break;
            case 'endstruc': definir(cmd.nome + '_size', strucPc, cmd); strucPc = null; break;
            case 'align': {
              const n = avaliar(cmd.e, ctx);
              if (n <= 0 || (n & (n - 1))) throw new ErroNasm('align precisa de uma potência de 2.');
              if (strucPc !== null) { strucPc = Math.ceil(strucPc / n) * n; break; }
              while ((org + pc) % n) { bytes.push(cmd.fill); pc++; }
              break;
            }
            default: {
              let vezes = 1;
              if (cmd.times) {
                vezes = avaliar(cmd.times, ctx);
                if (vezes < 0) {
                  if (final) throw new ErroNasm('times com valor negativo (' + vezes + '): o código antes desta linha passou do tamanho. Num setor de boot, isso quer dizer mais de 510 bytes de código e dados.');
                  vezes = 0;
                }
                if (vezes > 4 * 1024 * 1024) throw new ErroNasm('times ' + vezes + ' é grande demais.');
              }
              let parte = null;
              if (cmd.kind === 'res') {
                const n = avaliar(cmd.e, ctx) * cmd.size * vezes;
                if (strucPc !== null) { strucPc += n; break; }
                parte = new Array(n).fill(0);
                vezes = 1;
              } else if (strucPc !== null) {
                throw new ErroNasm('Dentro de struc só valem resb/resw/resd/resq.');
              } else {
                parte = [];
                for (let k = 0; k < vezes; k++) {
                  ctx.aqui = org + pc + parte.length;
                  const b = cmd.kind === 'dados' ? codificarDados(cmd, ctx) : codificar(cmd, ctx);
                  if (ctx.cresceu) cresceu = true;
                  for (const x of b) parte.push(x);
                  if (cmd.kind === 'instr' && !cmd.times) break;
                }
              }
              for (const x of parte) bytes.push(x);
              pc += parte.length;
            }
          }
        } catch (e) {
          if (!e.nasm) throw e;
          errosPassada.push({ linha: cmd.linha, msg: e.message });
        }
        if (cmd.kind !== 'equ' && cmd.kind !== undefined || cmd.label) listagem.push({ linha: cmd.linha, end: org + pcIni, tam: pc - pcIni });
      }
      if (final && !cresceu) { saida = bytes; break; }
      if (final) { saida = null; anterior = simbolos; continue; }
      const estavel = !mudou && !cresceu && !desconhecido;
      anterior = simbolos;
      if (estavel || passada >= 50) saida = 'final';
    }
    for (const cmd of cmds) delete cmd.escopo;
    if (errosPassada.length) return { ok: false, erros: errosPassada.sort((a, b) => a.linha - b.linha), avisos, bytes: new Uint8Array(0), listagem: [], simbolos: {} };
    const out = Uint8Array.from(saida);
    for (const l of listagem) l.bytes = out.subarray(l.end - org, l.end - org + l.tam);
    const tab = {};
    for (const [k, v] of simbolos) tab[k] = v;
    return { ok: true, erros: [], avisos, bytes: out, org, listagem, simbolos: tab };
  }

  function bytesDe(v, n) {
    const r = [];
    if (typeof v === 'bigint') { for (let i = 0; i < n; i++) { r.push(Number(v & 0xFFn)); v >>= 8n; } return r; }
    v = Math.trunc(v);
    if (n === 8) return bytesDe(BigInt.asUintN(64, BigInt(v)), 8);
    for (let i = 0; i < n; i++) { r.push(((v % 256) + 256) % 256); v = Math.floor(v / 256); }
    return r;
  }
  function cabe(v, n, ctx, comSinal) {
    if (n === 8) return true;
    const lim = Math.pow(2, n * 8);
    return comSinal ? (v >= -lim / 2 && v < lim / 2) : (v >= -lim / 2 && v < lim);
  }
  // o valor visto como número com sinal do tamanho do operando (65535 numa word é -1)
  function assinado(v, n) {
    if (n >= 4 && (v < -2147483648 || v > 4294967295)) return v;
    const lim = Math.pow(2, n * 8);
    const m = ((v % lim) + lim) % lim;
    return m >= lim / 2 ? m - lim : m;
  }
  function exigirCabe(v, n, ctx, oQue) {
    if (ctx.final && !cabe(v, n, ctx)) throw new ErroNasm((oQue || 'O valor') + ' ' + v + ' não cabe em ' + n * 8 + ' bits.');
  }

  function codificarDados(cmd, ctx) {
    const out = [];
    for (const it of cmd.itens) {
      if (it.str !== undefined) {
        const cs = Array.from(it.str, ch => ch.charCodeAt(0) & 0xFF);
        for (const c of cs) out.push(c);
        if (cmd.size > 1) { const pad = (cmd.size - cs.length % cmd.size) % cmd.size; for (let i = 0; i < pad; i++) out.push(0); }
      } else if (it.big !== undefined) {
        for (const b of bytesDe(it.big, 8)) out.push(b);
      } else {
        const v = avaliar(it.e, ctx);
        if (cmd.size < 8) exigirCabe(v, cmd.size, ctx);
        for (const b of bytesDe(v, cmd.size)) out.push(b);
      }
    }
    return out;
  }

  // ---------------- codificação das instruções ----------------
  function codificar(cmd, ctx) {
    ctx.cresceu = false;
    const ops = cmd.ops || [];
    const op = cmd.op;
    const e = new Emissor(cmd, ctx);
    for (const p of cmd.prefixos || []) {
      if (p === 'o16') e.osize = 2; else if (p === 'o32') { e.osize = 4; e.precisa(3, 'o32'); }
      else if (p === 'a16') e.asizeForcado = 16; else if (p === 'a32') { e.asizeForcado = 32; e.precisa(3, 'a32'); }
      else if (typeof PREFIXOS[p] === 'string') { e.seg = +PREFIXOS[p][1]; if (e.seg > 3) e.precisa(3, p); }
      else e.prefixosRep.push(PREFIXOS[p]);
    }
    if (op === '') return e.fim([]);
    const n = ops.length;
    const [a, b, c] = ops;
    const quantos = (...ns) => { if (!ns.includes(n)) throw new ErroNasm(op + ' espera ' + ns.join(' ou ') + ' operando(s), mas recebeu ' + n + '.'); };
    const err = (msg) => { throw new ErroNasm(msg); };
    const gp = (o) => o && o.t === 'reg' && o.k === 'gp';
    const mem = (o) => o && o.t === 'mem';
    const rm = (o) => gp(o) || mem(o);
    const imm = (o) => o && o.t === 'imm';
    const acc = (o) => gp(o) && o.code === 0;

    if (SIMPLES[op]) {
      quantos(0);
      const [bs, nivel, tam] = SIMPLES[op];
      e.precisa(nivel, op);
      if (tam === -1) e.opsize(ctx.bits / 8); else if (tam) e.opsize(tam);
      return e.fim(bs);
    }
    if (ALU[op] !== undefined) {
      quantos(2);
      const k = ALU[op];
      if (gp(a) && gp(b)) { e.mesmo(a, b); e.opsize(a.size); return e.fim([k * 8 + (a.size === 1 ? 0 : 1)], e.modrmReg(a, b.code)); }
      if (gp(a) && mem(b)) { e.opsize(e.tam(a, b)); return e.fim([k * 8 + (a.size === 1 ? 2 : 3)], e.modrm(b, a.code)); }
      if (mem(a) && gp(b)) { e.opsize(e.tam(b, a)); return e.fim([k * 8 + (b.size === 1 ? 0 : 1)], e.modrm(a, b.code)); }
      if (rm(a) && imm(b)) {
        const t = e.tam(a, null, b);
        e.opsize(t);
        const v = e.val(b.e);
        if (t === 1) { exigirCabe(v, 1, ctx); return acc(a) ? e.fim([k * 8 + 4], bytesDe(v, 1)) : e.fim([0x80], e.rmQualquer(a, k), bytesDe(v, 1)); }
        exigirCabe(v, t, ctx);
        if (!b.strict && e.pequeno('imm', cabe(assinado(v, t), 1, ctx, true))) return e.fim([0x83], e.rmQualquer(a, k), bytesDe(v, 1));
        if (acc(a)) return e.fim([k * 8 + 5], bytesDe(v, t));
        return e.fim([0x81], e.rmQualquer(a, k), bytesDe(v, t));
      }
      err('Combinação de operandos inválida para ' + op + '.');
    }
    switch (op) {
      case 'mov': {
        quantos(2);
        if (a.t === 'reg' && (a.k === 'cr' || a.k === 'dr' || a.k === 'tr')) {
          if (!gp(b) || b.size !== 4) err('mov ' + a.name + ' só aceita um registrador de 32 bits: mov ' + a.name + ', eax');
          e.precisa(3, 'mov ' + a.name);
          return e.fim([0x0F, a.k === 'cr' ? 0x22 : a.k === 'dr' ? 0x23 : 0x26], [0xC0 | (a.code << 3) | b.code]);
        }
        if (b.t === 'reg' && (b.k === 'cr' || b.k === 'dr' || b.k === 'tr')) {
          if (!gp(a) || a.size !== 4) err('mov ..., ' + b.name + ' só aceita um registrador de 32 bits como destino: mov eax, ' + b.name);
          e.precisa(3, 'mov ' + b.name);
          return e.fim([0x0F, b.k === 'cr' ? 0x20 : b.k === 'dr' ? 0x21 : 0x24], [0xC0 | (b.code << 3) | a.code]);
        }
        if (a.t === 'reg' && a.k === 'seg') {
          if (a.code === 1) err('mov cs, ... não existe: CS só muda com um salto far (jmp seg:off), um call far ou um retf.');
          if (a.code > 3) e.precisa(3, a.name);
          if (gp(b)) { if (b.size === 1) err('mov ' + a.name + ' precisa de um registrador de 16 bits.'); return e.fim([0x8E], [0xC0 | (a.code << 3) | b.code]); }
          if (mem(b)) { if (b.size && b.size !== 2) err('mov ' + a.name + ' lê uma word da memória.'); return e.fim([0x8E], e.modrm(b, a.code)); }
          if (imm(b)) err('Não existe mov de um número direto para um registrador de segmento. Passe por outro registrador: mov ax, ' + b.txt.trim() + ' / mov ' + a.name + ', ax');
          err('mov ' + a.name + ', ' + b.txt.trim() + ' não existe. De segmento para segmento, passe por um registrador geral.');
        }
        if (b.t === 'reg' && b.k === 'seg') {
          if (b.code > 3) e.precisa(3, b.name);
          if (gp(a)) { if (a.size === 1) err('Um registrador de segmento tem 16 bits.'); e.opsize(a.size); return e.fim([0x8C], [0xC0 | (b.code << 3) | a.code]); }
          if (mem(a)) { if (a.size && a.size !== 2) err('mov para a memória de um registrador de segmento grava uma word.'); return e.fim([0x8C], e.modrm(a, b.code)); }
          err('Combinação de operandos inválida para mov.');
        }
        if (gp(a) && gp(b)) { e.mesmo(a, b); e.opsize(a.size); return e.fim([a.size === 1 ? 0x88 : 0x89], e.modrmReg(a, b.code)); }
        if (gp(a) && mem(b)) {
          const t = e.tam(a, b); e.opsize(t);
          if (acc(a) && e.direto(b)) return e.fim([t === 1 ? 0xA0 : 0xA1], e.moffs(b));
          return e.fim([t === 1 ? 0x8A : 0x8B], e.modrm(b, a.code));
        }
        if (mem(a) && gp(b)) {
          const t = e.tam(b, a); e.opsize(t);
          if (acc(b) && e.direto(a)) return e.fim([t === 1 ? 0xA2 : 0xA3], e.moffs(a));
          return e.fim([t === 1 ? 0x88 : 0x89], e.modrm(a, b.code));
        }
        if (gp(a) && imm(b)) {
          e.opsize(a.size);
          const v = e.val(b.e); exigirCabe(v, a.size, ctx);
          return e.fim([(a.size === 1 ? 0xB0 : 0xB8) + a.code], bytesDe(v, a.size));
        }
        if (mem(a) && imm(b)) {
          const t = e.tam(null, a, b); e.opsize(t);
          const v = e.val(b.e); exigirCabe(v, t, ctx);
          return e.fim([t === 1 ? 0xC6 : 0xC7], e.modrm(a, 0), bytesDe(v, t));
        }
        if (imm(a)) err('O destino do mov não pode ser um número. Para gravar na memória, use colchetes: mov [' + a.txt.trim() + '], ...');
        err('Combinação de operandos inválida para mov.');
        break;
      }
      case 'test': {
        quantos(2);
        if (gp(a) && gp(b)) { e.mesmo(a, b); e.opsize(a.size); return e.fim([a.size === 1 ? 0x84 : 0x85], e.modrmReg(a, b.code)); }
        if (mem(a) && gp(b)) { const t = e.tam(b, a); e.opsize(t); return e.fim([t === 1 ? 0x84 : 0x85], e.modrm(a, b.code)); }
        if (gp(a) && mem(b)) { const t = e.tam(a, b); e.opsize(t); return e.fim([t === 1 ? 0x84 : 0x85], e.modrm(b, a.code)); }
        if (rm(a) && imm(b)) {
          const t = e.tam(a, null, b); e.opsize(t);
          const v = e.val(b.e); exigirCabe(v, t, ctx);
          if (acc(a)) return e.fim([t === 1 ? 0xA8 : 0xA9], bytesDe(v, t));
          return e.fim([t === 1 ? 0xF6 : 0xF7], e.rmQualquer(a, 0), bytesDe(v, t));
        }
        err('Combinação de operandos inválida para test.');
        break;
      }
      case 'xchg': {
        quantos(2);
        if (gp(a) && gp(b)) {
          e.mesmo(a, b); e.opsize(a.size);
          if (a.size > 1 && (a.code === 0 || b.code === 0)) {
            const r = a.code === 0 ? b.code : a.code;
            if (r === 0 && a.size === 4 && ctx.bits === 32) return e.fim([0x90]);
            return e.fim([0x90 + r]);
          }
          return e.fim([a.size === 1 ? 0x86 : 0x87], [0xC0 | (a.code << 3) | b.code]);
        }
        if (gp(a) && mem(b)) { const t = e.tam(a, b); e.opsize(t); return e.fim([t === 1 ? 0x86 : 0x87], e.modrm(b, a.code)); }
        if (mem(a) && gp(b)) { const t = e.tam(b, a); e.opsize(t); return e.fim([t === 1 ? 0x86 : 0x87], e.modrm(a, b.code)); }
        err('xchg troca dois registradores ou um registrador com a memória.');
        break;
      }
      case 'inc': case 'dec': {
        quantos(1);
        const k = op === 'inc' ? 0 : 1;
        if (gp(a) && a.size > 1) { e.opsize(a.size); return e.fim([(op === 'inc' ? 0x40 : 0x48) + a.code]); }
        if (rm(a)) { const t = e.tam(a); e.opsize(t); return e.fim([t === 1 ? 0xFE : 0xFF], e.rmQualquer(a, k)); }
        err(op + ' precisa de um registrador ou de uma posição de memória.');
        break;
      }
      case 'not': case 'neg': case 'mul': case 'div': case 'idiv': {
        quantos(1);
        if (!rm(a)) err(op + ' precisa de um registrador ou de uma posição de memória' + (imm(a) ? ' (não aceita número)' : '') + '.');
        const t = e.tam(a); e.opsize(t);
        return e.fim([t === 1 ? 0xF6 : 0xF7], e.rmQualquer(a, GRUPO3[op]));
      }
      case 'imul': {
        quantos(1, 2, 3);
        if (n === 1) { if (!rm(a)) err('imul com um operando precisa de registrador ou memória.'); const t = e.tam(a); e.opsize(t); return e.fim([t === 1 ? 0xF6 : 0xF7], e.rmQualquer(a, 5)); }
        if (n === 2 && gp(a) && rm(b)) {
          e.precisa(3, 'imul de dois operandos'); if (a.size === 1) err('imul de dois operandos não tem versão de 8 bits.');
          if (gp(b)) e.mesmo(a, b);
          e.opsize(a.size); return e.fim([0x0F, 0xAF], e.rmQualquer(b, a.code));
        }
        const fonte = n === 2 ? a : b, im = n === 2 ? b : c;
        if (!gp(a) || !rm(fonte) || !imm(im)) err('Formas do imul: imul r/m; imul reg, r/m; imul reg, r/m, número.');
        if (a.size === 1) err('imul com número não tem versão de 8 bits.');
        e.precisa(1, 'imul com número');
        if (gp(fonte)) e.mesmo(a, fonte);
        e.opsize(a.size);
        const v = e.val(im.e); exigirCabe(v, a.size, ctx);
        if (!im.strict && e.pequeno('imm', cabe(assinado(v, a.size), 1, ctx, true))) return e.fim([0x6B], e.rmQualquer(fonte, a.code), bytesDe(v, 1));
        return e.fim([0x69], e.rmQualquer(fonte, a.code), bytesDe(v, a.size));
      }
      case 'shld': case 'shrd': {
        quantos(3);
        e.precisa(3, op);
        if (!rm(a) || !gp(b) || b.size === 1) err(op + ' r/m, reg, cl|número');
        e.opsize(b.size);
        if (gp(c) && c.name === 'cl') return e.fim([0x0F, op === 'shld' ? 0xA5 : 0xAD], e.rmQualquer(a, b.code));
        if (imm(c)) return e.fim([0x0F, op === 'shld' ? 0xA4 : 0xAC], e.rmQualquer(a, b.code), bytesDe(e.val(c.e), 1));
        err('O terceiro operando de ' + op + ' é CL ou um número.');
        break;
      }
      case 'bsf': case 'bsr': {
        quantos(2); e.precisa(3, op);
        if (!gp(a) || a.size === 1 || !rm(b)) err(op + ' reg16/32, r/m');
        e.opsize(a.size); return e.fim([0x0F, op === 'bsf' ? 0xBC : 0xBD], e.rmQualquer(b, a.code));
      }
      case 'movzx': case 'movsx': {
        quantos(2); e.precisa(3, op);
        if (!gp(a) || a.size === 1) err(op + ': o destino é um registrador de 16 ou 32 bits.');
        const tf = gp(b) ? b.size : b.size;
        if (!rm(b)) err(op + ': a origem é registrador ou memória.');
        if (!tf) err(op + ': diga o tamanho da origem: ' + op + ' ' + a.name + ', byte [...] ou word [...].');
        if (tf >= a.size) err(op + ' estende um valor menor: a origem precisa ser menor que ' + a.name + '.');
        e.opsize(a.size);
        return e.fim([0x0F, (op === 'movzx' ? 0xB6 : 0xBE) + (tf === 2 ? 1 : 0)], e.rmQualquer(b, a.code));
      }
      case 'ret': case 'retn': case 'retf': {
        quantos(0, 1);
        const far = op === 'retf';
        if (n === 0) return e.fim([far ? 0xCB : 0xC3]);
        const v = e.val(a.e); exigirCabe(v, 2, ctx);
        return e.fim([far ? 0xCA : 0xC2], bytesDe(v, 2));
      }
      case 'int': {
        quantos(1);
        if (!imm(a)) err('int precisa do número da interrupção.');
        const v = e.val(a.e); exigirCabe(v, 1, ctx, 'O número da interrupção');
        return e.fim([0xCD], bytesDe(v, 1));
      }
      case 'aam': case 'aad': {
        quantos(0, 1);
        const v = n ? e.val(a.e) : 10;
        return e.fim([op === 'aam' ? 0xD4 : 0xD5], bytesDe(v, 1));
      }
      case 'push': case 'pop': {
        quantos(1);
        const pop = op === 'pop';
        if (gp(a)) { if (a.size === 1) err(op + ' trabalha com 16 ou 32 bits, não com ' + a.name + '.'); e.opsize(a.size); return e.fim([(pop ? 0x58 : 0x50) + a.code]); }
        if (a.t === 'reg' && a.k === 'seg') {
          if (pop && a.code === 1) err('pop cs não existe: CS só muda com salto far, call far, retf ou iret.');
          if (a.code < 4) return e.fim([[0x06, 0x0E, 0x16, 0x1E][a.code] + (pop ? 1 : 0)]);
          e.precisa(3, a.name);
          return e.fim([0x0F, (a.code === 4 ? 0xA0 : 0xA8) + (pop ? 1 : 0)]);
        }
        if (mem(a)) {
          if (!a.size) err(op + ' na memória: diga o tamanho, ' + op + ' word [...] ou ' + op + ' dword [...].');
          if (a.size === 1) err('A pilha não guarda bytes: use word ou dword.');
          e.opsize(a.size); return e.fim([pop ? 0x8F : 0xFF], e.modrm(a, pop ? 0 : 6));
        }
        if (imm(a) && !pop) {
          e.precisa(1, 'push de número');
          const t = a.size || ctx.bits / 8;
          if (t === 1) err('A pilha não guarda bytes.');
          e.opsize(t);
          const v = e.val(a.e); exigirCabe(v, t, ctx);
          if (!a.strict && e.pequeno('imm', cabe(assinado(v, t), 1, ctx, true))) return e.fim([0x6A], bytesDe(v, 1));
          return e.fim([0x68], bytesDe(v, t));
        }
        err('Operando inválido para ' + op + '.');
        break;
      }
      case 'lea': {
        quantos(2);
        if (!gp(a) || a.size === 1 || !mem(b)) err('lea reg16/32, [endereço]');
        e.opsize(a.size); return e.fim([0x8D], e.modrm(b, a.code));
      }
      case 'lds': case 'les': case 'lss': case 'lfs': case 'lgs': {
        quantos(2);
        if (!gp(a) || a.size === 1 || !mem(b)) err(op + ' reg16/32, [ponteiro far]');
        if (op !== 'lds' && op !== 'les') e.precisa(3, op);
        e.opsize(a.size);
        const cod = { lds: [0xC5], les: [0xC4], lss: [0x0F, 0xB2], lfs: [0x0F, 0xB4], lgs: [0x0F, 0xB5] }[op];
        return e.fim(cod, e.modrm(b, a.code));
      }
      case 'enter': {
        quantos(2); e.precisa(1, 'enter');
        return e.fim([0xC8], bytesDe(e.val(a.e), 2), bytesDe(e.val(b.e), 1));
      }
      case 'bound': {
        quantos(2); e.precisa(1, 'bound');
        if (!gp(a) || a.size === 1 || !mem(b)) err('bound reg16/32, [limites]');
        e.opsize(a.size); return e.fim([0x62], e.modrm(b, a.code));
      }
      case 'in': {
        quantos(2);
        if (!acc(a)) err('in lê sempre para AL, AX ou EAX: in al, dx');
        e.opsize(a.size);
        if (gp(b) && b.name === 'dx') return e.fim([a.size === 1 ? 0xEC : 0xED]);
        if (imm(b)) { const v = e.val(b.e); if (ctx.final && (v < 0 || v > 255)) err('Com número, in só alcança as portas 0 a 255. Para portas maiores, ponha o número em DX: mov dx, ' + v + ' / in ' + a.name + ', dx'); return e.fim([a.size === 1 ? 0xE4 : 0xE5], bytesDe(v, 1)); }
        err('A porta do in é um número (até 255) ou DX.');
        break;
      }
      case 'out': {
        quantos(2);
        if (!acc(b)) err('out escreve sempre AL, AX ou EAX: out dx, al');
        e.opsize(b.size);
        if (gp(a) && a.name === 'dx') return e.fim([b.size === 1 ? 0xEE : 0xEF]);
        if (imm(a)) { const v = e.val(a.e); if (ctx.final && (v < 0 || v > 255)) err('Com número, out só alcança as portas 0 a 255. Para portas maiores, use DX.'); return e.fim([b.size === 1 ? 0xE6 : 0xE7], bytesDe(v, 1)); }
        err('A porta do out é um número (até 255) ou DX.');
        break;
      }
      case 'lgdt': case 'sgdt': case 'lidt': case 'sidt': case 'invlpg': {
        quantos(1);
        if (!mem(a)) err(op + ' precisa de um endereço de memória: ' + op + ' [' + a.txt.trim() + ']');
        e.precisa(op === 'invlpg' ? 4 : 2, op);
        return e.fim([0x0F, 0x01], e.modrm(a, { sgdt: 0, sidt: 1, lgdt: 2, lidt: 3, invlpg: 7 }[op]));
      }
      case 'lmsw': case 'smsw': {
        quantos(1); e.precisa(2, op);
        if (!rm(a)) err(op + ' precisa de registrador ou memória.');
        if (gp(a) && op === 'smsw') e.opsize(a.size);
        return e.fim([0x0F, 0x01], e.rmQualquer(a, op === 'lmsw' ? 6 : 4));
      }
      case 'lldt': case 'sldt': case 'ltr': case 'str': case 'verr': case 'verw': {
        quantos(1); e.precisa(2, op);
        if (!rm(a)) err(op + ' precisa de registrador ou memória.');
        if (gp(a) && (op === 'sldt' || op === 'str')) e.opsize(a.size);
        return e.fim([0x0F, 0x00], e.rmQualquer(a, { sldt: 0, str: 1, lldt: 2, ltr: 3, verr: 4, verw: 5 }[op]));
      }
      case 'lar': case 'lsl': {
        quantos(2); e.precisa(2, op);
        if (!gp(a) || a.size === 1 || !rm(b)) err(op + ' reg, r/m16');
        e.opsize(a.size); return e.fim([0x0F, op === 'lar' ? 0x02 : 0x03], e.rmQualquer(b, a.code));
      }
      case 'arpl': {
        quantos(2); e.precisa(2, op);
        if (!rm(a) || !gp(b) || b.size !== 2) err('arpl r/m16, reg16');
        return e.fim([0x63], e.rmQualquer(a, b.code));
      }
      case 'bswap': {
        quantos(1); e.precisa(4, op);
        if (!gp(a) || a.size !== 4) err('bswap trabalha com um registrador de 32 bits.');
        e.opsize(4); return e.fim([0x0F, 0xC8 + a.code]);
      }
      case 'cmpxchg': case 'xadd': {
        quantos(2); e.precisa(4, op);
        if (!rm(a) || !gp(b)) err(op + ' r/m, reg');
        const t = e.tam(b, mem(a) ? a : null); e.opsize(t);
        return e.fim([0x0F, (op === 'cmpxchg' ? 0xB0 : 0xC0) + (t === 1 ? 0 : 1)], e.rmQualquer(a, b.code));
      }
      case 'jmp': case 'call': {
        quantos(1);
        const call = op === 'call';
        if (a.t === 'far') {
          const t = a.size || ctx.bits / 8;
          e.opsize(t);
          const off = e.val(a.off), seg = e.val(a.seg);
          exigirCabe(off, t, ctx, 'O deslocamento'); exigirCabe(seg, 2, ctx, 'O segmento');
          return e.fim([call ? 0x9A : 0xEA], bytesDe(off, t), bytesDe(seg, 2));
        }
        if (rm(a) && (a.t === 'mem' || a.dist !== 'far')) {
          if (a.dist === 'far') {
            if (!mem(a)) err(op + ' far precisa de um ponteiro na memória.');
            return e.fim([0xFF], e.modrm(a, call ? 3 : 5));
          }
          const t = gp(a) ? a.size : (a.size || ctx.bits / 8);
          if (t === 1) err(op + ' para um endereço de 8 bits não existe.');
          e.opsize(t);
          return e.fim([0xFF], e.rmQualquer(a, call ? 2 : 4));
        }
        if (!imm(a)) err('Destino inválido para ' + op + '.');
        const alvo = e.val(a.e);
        const t = a.size || ctx.bits / 8;
        if (call) {
          if (a.dist === 'short') err('call short não existe.');
          e.opsize(t);
          const len = e.prefixos().length + 1 + t;
          const rel = alvo - (ctx.aqui + len);
          return e.fim([0xE8], bytesDe(rel, t));
        }
        // jmp: curto se der
        const relCurto = alvo - (ctx.aqui + e.prefixos().length + 2);
        if (a.dist === 'short' || (a.dist !== 'near' && !a.size && e.pequeno('salto', cabe(relCurto, 1, ctx, true)))) {
          if (ctx.final && !cabe(relCurto, 1, ctx, true)) err('Salto curto longe demais: o destino está a ' + relCurto + ' bytes (o limite é -128 a 127).');
          return e.fim([0xEB], bytesDe(relCurto, 1));
        }
        e.opsize(t);
        const rel = alvo - (ctx.aqui + e.prefixos().length + 1 + t);
        return e.fim([0xE9], bytesDe(rel, t));
      }
      case 'loop': case 'loope': case 'loopz': case 'loopne': case 'loopnz': case 'jcxz': case 'jecxz': {
        quantos(1, 2);
        if (n === 2) {
          if (!gp(b) || b.size === 1) err(op + ' alvo, cx|ecx');
          if (b.size * 8 !== ctx.bits) e.asizeForcado = b.size * 8;
        }
        if (op === 'jecxz') { e.precisa(3, op); if (ctx.bits === 16) e.asizeForcado = 32; }
        if (op === 'jcxz' && ctx.bits === 32) e.asizeForcado = 16;
        if (!imm(a)) err(op + ' precisa de um rótulo.');
        const cod = { loop: 0xE2, loope: 0xE1, loopz: 0xE1, loopne: 0xE0, loopnz: 0xE0, jcxz: 0xE3, jecxz: 0xE3 }[op];
        const alvo = e.val(a.e);
        const rel = alvo - (ctx.aqui + e.prefixos().length + 2);
        if (ctx.final && !cabe(rel, 1, ctx, true)) err(op + ' só alcança 128 bytes para trás ou 127 para frente; o destino está a ' + rel + '. Troque por dec/jnz (ou jcc com salto near).');
        return e.fim([cod], bytesDe(rel, 1));
      }
    }
    // jcc e setcc
    let m;
    if ((m = /^j(\w+)$/.exec(op)) && CC[m[1]] !== undefined) {
      quantos(1);
      if (!imm(a)) err(op + ' precisa de um rótulo.');
      const cc = CC[m[1]];
      const alvo = e.val(a.e);
      const relCurto = alvo - (ctx.aqui + e.prefixos().length + 2);
      const podeNear = ctx.cpu >= 3;
      if (a.dist === 'short' || (a.dist !== 'near' && (e.pequeno('salto', cabe(relCurto, 1, ctx, true)) || !podeNear))) {
        if (ctx.final && !cabe(relCurto, 1, ctx, true)) err(podeNear
          ? 'Salto curto longe demais: o destino está a ' + relCurto + ' bytes (o limite é -128 a 127).'
          : 'Salto condicional longe demais (' + relCurto + ' bytes). Antes do 386 só existe o salto condicional curto: inverta a condição e pule um jmp.');
        return e.fim([0x70 + cc], bytesDe(relCurto, 1));
      }
      e.precisa(3, 'salto condicional near');
      const t = a.size || ctx.bits / 8;
      e.opsize(t);
      const rel = alvo - (ctx.aqui + e.prefixos().length + 2 + t);
      return e.fim([0x0F, 0x80 + cc], bytesDe(rel, t));
    }
    if ((m = /^set(\w+)$/.exec(op)) && CC[m[1]] !== undefined) {
      quantos(1); e.precisa(3, op);
      if (!rm(a) || (gp(a) && a.size !== 1) || (mem(a) && a.size && a.size !== 1)) err(op + ' grava um byte: ' + op + ' al ou ' + op + ' byte [...]');
      return e.fim([0x0F, 0x90 + CC[m[1]]], e.rmQualquer(a, 0));
    }
    if (SHIFT[op] !== undefined) {
      quantos(2);
      if (!rm(a)) err(op + ' precisa de registrador ou memória.');
      const t = e.tam(a); e.opsize(t);
      const k = SHIFT[op];
      if (gp(b) && b.name === 'cl') return e.fim([t === 1 ? 0xD2 : 0xD3], e.rmQualquer(a, k));
      if (imm(b)) {
        const v = e.val(b.e);
        if (v === 1 && !b.strict) return e.fim([t === 1 ? 0xD0 : 0xD1], e.rmQualquer(a, k));
        if (ctx.cpu < 1) err('No 8086, ' + op + ' só desloca 1 ou CL posições. "' + op + ' ' + a.txt.trim() + ', ' + v + '" apareceu no 80186.');
        exigirCabe(v, 1, ctx);
        return e.fim([t === 1 ? 0xC0 : 0xC1], e.rmQualquer(a, k), bytesDe(v, 1));
      }
      err('O segundo operando de ' + op + ' é 1, CL ou um número.');
    }
    if (BT[op] !== undefined) {
      quantos(2); e.precisa(3, op);
      if (!rm(a)) err(op + ' precisa de registrador ou memória.');
      if (gp(b)) { if (b.size === 1) err(op + ' não tem versão de 8 bits.'); e.opsize(b.size); return e.fim([0x0F, 0xA3 + (BT[op] - 4) * 8], e.rmQualquer(a, b.code)); }
      if (imm(b)) { const t = e.tam(a); if (t === 1) err(op + ' não tem versão de 8 bits.'); e.opsize(t); return e.fim([0x0F, 0xBA], e.rmQualquer(a, BT[op]), bytesDe(e.val(b.e), 1)); }
      err('O segundo operando de ' + op + ' é um registrador ou um número.');
    }
    err('Instrução desconhecida: ' + op);
  }

  class Emissor {
    constructor(cmd, ctx) {
      this.cmd = cmd; this.ctx = ctx;
      this.osize = 0; this.asize = 0; this.asizeForcado = 0; this.seg = null; this.prefixosRep = [];
      cmd.grande = cmd.grande || {};
    }
    precisa(nivel, oQue) {
      if (this.ctx.cpu < nivel) throw new ErroNasm('"' + oQue + '" só existe a partir do ' + NOME_CPU[nivel] + ', e este código pediu cpu ' + NOME_CPU[this.ctx.cpu] + '.');
    }
    opsize(t) {
      if (t === 4) this.precisa(3, 'registradores e operandos de 32 bits');
      this.osize = t;
    }
    val(expr) { return avaliar(expr, this.ctx); }
    // grow-only: a forma pequena vale até a primeira vez que o valor conhecido não couber
    pequeno(chave, cabeAgora) {
      const g = this.cmd.grande;
      if (g[chave]) return false;
      if (!cabeAgora && !this.ctx.incerto) { g[chave] = true; this.ctx.cresceu = true; return false; }
      if (!cabeAgora && this.ctx.final) { g[chave] = true; this.ctx.cresceu = true; return false; }
      return cabeAgora || this.ctx.incerto;
    }
    mesmo(a, b) {
      if (a.size !== b.size) throw new ErroNasm('Os dois operandos precisam ter o mesmo tamanho: ' + a.name + ' tem ' + a.size * 8 + ' bits e ' + b.name + ' tem ' + b.size * 8 + '.');
    }
    tam(x, y, im) {
      const reg = [x, y].find(o => o && o.t === 'reg'), m = [x, y].find(o => o && o.t === 'mem');
      const o = reg || m;
      if (reg) {
        if (m && m.size && m.size !== reg.size) throw new ErroNasm('Tamanhos diferentes: ' + reg.name + ' tem ' + reg.size * 8 + ' bits, mas a memória foi marcada como ' + NOME_TAM[m.size] + '.');
        return reg.size;
      }
      if (o && o.size) return o.size;
      if (im && im.size && (o.t === 'mem')) return im.size;
      throw new ErroNasm('O NASM não sabe o tamanho da operação: diga se é byte, word ou dword, como em "' + this.cmd.op + ' word ' + (o ? o.txt.trim() : '') + ', ...". (No NASM, o nome de uma variável não guarda o tipo.)');
    }
    direto(m) { return !m.base && !m.index; }
    dispByte(v) { if (this.ctx.final && !cabe(v, 1, this.ctx, true)) throw new ErroNasm('O deslocamento ' + v + ' não cabe em um byte com sinal ([byte ...] pede de -128 a 127).'); }
    moffs(m) {
      const as = this.asizeMem(m);
      const v = m.disp ? this.val(m.disp) : 0;
      if (m.seg !== null) this.seg = m.seg;
      return bytesDe(v, as / 8);
    }
    asizeMem(m) {
      const r = m.base || m.index;
      // [dword 1234h] sem registradores pede endereço de 32 bits; [word ...], de 16
      let as = this.asizeForcado || (r ? r.size * 8 : (m.dispSize === 2 || m.dispSize === 4) ? m.dispSize * 8 : this.ctx.bits);
      if (m.base && m.index && m.base.size !== m.index.size) throw new ErroNasm('Não dá para misturar registradores de 16 e de 32 bits no mesmo endereço.');
      if (as === 32) this.precisa(3, 'endereços com registradores de 32 bits');
      this.asize = as;
      return as;
    }
    modrmReg(dst, regField) { return [0xC0 | (regField << 3) | dst.code]; }
    rmQualquer(o, regField) { return o.t === 'reg' ? [0xC0 | (regField << 3) | o.code] : this.modrm(o, regField); }
    modrm(m, regField) {
      if (m.seg !== null) this.seg = m.seg;
      const as = this.asizeMem(m);
      let disp = m.disp ? this.val(m.disp) : 0;
      const temDisp = !!m.disp;
      const r = regField << 3;
      if (as === 16) {
        if (m.index && m.scale !== 1) throw new ErroNasm('Escala (*' + m.scale + ') só existe com registradores de 32 bits.');
        const ns = [m.base, m.index].filter(Boolean).map(x => x.name).sort().join('+');
        const tab = { 'bx+si': 0, 'bx+di': 1, 'bp+si': 2, 'bp+di': 3, 'si': 4, 'di': 5, 'bp': 6, 'bx': 7 };
        if (ns === '') { this.exigir16(disp); return [r | 6, ...bytesDe(disp, 2)]; }
        const rmv = tab[ns];
        if (rmv === undefined) throw new ErroNasm('Endereço de 16 bits inválido: [' + ns.replace('+', '+') + ']. Em 16 bits só valem BX ou BP, somados ou não a SI ou DI, mais um deslocamento. Com registradores de 32 bits (386) vale qualquer combinação.');
        if (m.dispSize === 1) { this.dispByte(disp); return [0x40 | r | rmv, ...bytesDe(disp, 1)]; }
        if (m.dispSize === 2) return [0x80 | r | rmv, ...bytesDe(disp, 2)];
        if (!temDisp && rmv !== 6) return [r | rmv];
        if (this.pequeno('disp', cabe(disp, 1, this.ctx, true)) && (temDisp || rmv === 6)) return [0x40 | r | rmv, ...bytesDe(disp, 1)];
        this.exigir16(disp);
        return [0x80 | r | rmv, ...bytesDe(disp, 2)];
      }
      // 32 bits
      let base = m.base, index = m.index, scale = m.scale;
      if (![1, 2, 4, 8].includes(scale)) throw new ErroNasm('A escala só pode ser 1, 2, 4 ou 8.');
      if (base && !index && m.base === m.index) { /* nada */ }
      if (!base && index && !m.nosplit) {
        if (scale === 1) { base = index; index = null; }
        else if (scale === 2) { base = index; scale = 1; }
      }
      if (index && index.code === 4) {
        if (scale !== 1 || !base) throw new ErroNasm('ESP não pode ser registrador de índice.');
        const t = base; base = index; index = t;
        if (index.code === 4) throw new ErroNasm('ESP não pode ser registrador de índice.');
      }
      if (!base && !index) return [r | 5, ...bytesDe(disp, 4)];
      const sc = { 1: 0, 2: 1, 4: 2, 8: 3 }[scale];
      if (!index && base.code !== 4) {
        if (m.dispSize === 1) { this.dispByte(disp); return [0x40 | r | base.code, ...bytesDe(disp, 1)]; }
        if (m.dispSize === 4) return [0x80 | r | base.code, ...bytesDe(disp, 4)];
        if (!temDisp && base.code !== 5) return [r | base.code];
        if (this.pequeno('disp', cabe(disp, 1, this.ctx, true))) return [0x40 | r | base.code, ...bytesDe(disp, 1)];
        return [0x80 | r | base.code, ...bytesDe(disp, 4)];
      }
      const sib = (sc << 6) | ((index ? index.code : 4) << 3);
      if (!base) return [r | 4, sib | 5, ...bytesDe(disp, 4)];
      if (m.dispSize === 1) { this.dispByte(disp); return [0x44 | r, sib | base.code, ...bytesDe(disp, 1)]; }
      if (m.dispSize === 4) return [0x84 | r, sib | base.code, ...bytesDe(disp, 4)];
      if (!temDisp && base.code !== 5) return [r | 4, sib | base.code];
      if (this.pequeno('disp', cabe(disp, 1, this.ctx, true))) return [0x44 | r, sib | base.code, ...bytesDe(disp, 1)];
      return [0x84 | r, sib | base.code, ...bytesDe(disp, 4)];
    }
    exigir16(v) { if (this.ctx.final && !cabe(v, 2, this.ctx)) throw new ErroNasm('Endereço ' + v + ' não cabe em 16 bits.'); }
    prefixos() {
      const p = [];
      if (this.seg !== null && this.seg !== undefined) p.push([0x26, 0x2E, 0x36, 0x3E, 0x64, 0x65][this.seg]);
      if (this.osize > 1 && this.osize * 8 !== this.ctx.bits) p.push(0x66);
      if (this.asize && this.asize !== this.ctx.bits) p.push(0x67);
      else if (this.asizeForcado && this.asizeForcado !== this.ctx.bits) p.push(0x67);
      return [...this.prefixosRep, ...p];
    }
    fim(...partes) {
      const corpo = [].concat(...partes);
      return [...this.prefixos(), ...corpo];
    }
  }

  // Monta vários arquivos de um disco: ";### ARQUIVO nome" separa. Cada um vira setores seguidos.
  const RE_ARQ = /^\s*;###\s*ARQUIVO\s+(\S+)/i;
  function temArquivos(fonte) { return fonte.split('\n').some(l => RE_ARQ.test(l)); }
  function montarDisco(fonte, opts) {
    const linhas = fonte.replace(/\r\n?/g, '\n').split('\n');
    const arqs = [];
    for (let i = 0; i < linhas.length; i++) {
      const m = RE_ARQ.exec(linhas[i]);
      if (m) arqs.push({ nome: m[1], ini: i + 1, linhas: [] });
      else if (arqs.length) arqs[arqs.length - 1].linhas.push(linhas[i]);
      else if (linhas[i].trim() && !/^\s*;/.test(linhas[i])) return { ok: false, erros: [{ linha: i + 1, msg: 'Com ;### ARQUIVO, todo o código precisa estar dentro de algum arquivo.' }], avisos: [], arquivos: [] };
    }
    const res = { ok: true, erros: [], avisos: [], arquivos: [], listagem: [], simbolos: {} };
    let setor = 0;
    const imagem = [];
    for (const a of arqs) {
      // linhas em branco no lugar das outras, para os números de linha baterem com o bloco inteiro
      const texto = new Array(a.ini).fill('').concat(a.linhas).join('\n');
      const r = montar(texto, opts);
      for (const e of r.erros) res.erros.push({ linha: e.linha, msg: a.nome + ': ' + e.msg });
      for (const w of r.avisos) res.avisos.push({ linha: w.linha, msg: a.nome + ': ' + w.msg });
      if (!r.ok) { res.ok = false; continue; }
      const nset = Math.max(1, Math.ceil(r.bytes.length / 512));
      res.arquivos.push({ nome: a.nome, setor, setores: nset, bytes: r.bytes, org: r.org, simbolos: r.simbolos });
      for (const l of r.listagem) res.listagem.push(Object.assign({ arquivo: a.nome }, l));
      for (const k of Object.keys(r.simbolos)) if (res.simbolos[k] === undefined) res.simbolos[k] = r.simbolos[k];
      const buf = new Uint8Array(nset * 512); buf.set(r.bytes);
      imagem.push(buf);
      setor += nset;
    }
    const total = imagem.reduce((s, b) => s + b.length, 0);
    res.bytes = new Uint8Array(total);
    let p = 0;
    for (const b of imagem) { res.bytes.set(b, p); p += b.length; }
    return res;
  }

  return { montar, montarDisco, temArquivos, preprocessar, regInfo, R8, R16, R32, SREG, CC, MNEMONICOS };
});
