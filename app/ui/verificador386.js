/* Correção automática dos exercícios da máquina 386 (trilha avançada): monta com o
   montador NASM do curso, roda na máquina 386 e confere registradores, memória, saída e exceções. */
(function (root) {
  'use strict';
  const N = root.Nasm386 || (typeof require === 'function' ? require('../core/nasm.js') : null);
  const M = root.Maquina386 || (typeof require === 'function' ? require('../core/cpu386.js') : null);

  const hex = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
  const R32 = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'EBP', 'ESP'];
  const R16 = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'BP', 'SP', 'CS', 'DS', 'ES', 'SS', 'FS', 'GS', 'IP', 'TR', 'LDTR'];
  const R8 = ['AL', 'AH', 'BL', 'BH', 'CL', 'CH', 'DL', 'DH'];
  const FL = ['CF', 'ZF', 'SF', 'OF', 'PF', 'AF', 'DF', 'IF', 'TF', 'NT', 'VM'];
  const OUTROS = ['EIP', 'EFLAGS', 'CR0', 'CR2', 'CR3', 'CPL', 'IOPL'];
  const SIG = { '#DE': 0, '#DB': 1, '#BP': 3, '#OF': 4, '#BR': 5, '#UD': 6, '#NM': 7, '#DF': 8, '#TS': 10, '#NP': 11, '#SS': 12, '#GP': 13, '#PF': 14 };

  function bitsDe(K) { return R8.includes(K) ? 8 : R16.includes(K) ? 16 : FL.includes(K) ? 1 : 32; }
  function fmt(v, bits) {
    if (bits === 1) return String(v ? 1 : 0);
    const n = bits === 8 ? v & 0xFF : bits === 16 ? v & 0xFFFF : v >>> 0;
    const lim = Math.pow(2, bits);
    const sig = n >= lim / 2 ? n - lim : n;
    return n + ' (' + hex(n, bits / 4) + 'h' + (sig < 0 ? ', com sinal ' + sig : '') + ')';
  }
  const norm = (v, bits) => bits === 1 ? (v ? 1 : 0) : bits === 8 ? v & 0xFF : bits === 16 ? v & 0xFFFF : v >>> 0;

  function montar(codigo) {
    return N.temArquivos(codigo) ? N.montarDisco(codigo) : N.montar(codigo);
  }

  // "rotulo", "rotulo:b", "rotulo:w", "rotulo:d" -> endereço linear e tamanho
  function enderecoDe(prog, chave, modo) {
    const m = /^(.*?)(?::([bwd]))?$/.exec(chave);
    const nome = m[1], tam = { b: 1, w: 2, d: 4 }[m[2]] || 4;
    if (prog.simbolos[nome] === undefined) return null;
    let end = prog.simbolos[nome];
    if (modo === 'com') end += 0x7000;
    return { end, tam, nome };
  }

  function preparar(ex, codigo, t) {
    const prog = montar(codigo);
    if (!prog.ok) return { prog };
    const modo = ex.modo || 'com';
    const m = new M.Maquina({ memoria: 8 * 1024 * 1024 });
    const opts = { modo, org: ex.org !== undefined ? +ex.org : undefined };
    if (prog.arquivos) opts.disco = prog.bytes;
    m.carregar(prog.arquivos && modo !== 'boot' ? prog.arquivos[0].bytes : prog.bytes, opts);
    const espInicial = m.r[4];
    const naoAchados = [];
    const s = (t && t.setup) || {};
    for (const k of Object.keys(s)) {
      try { m.escreverRegistrador(k, s[k]); continue; } catch (e) { /* é memória */ }
      const a = enderecoDe(prog, k, modo);
      if (!a) { naoAchados.push(k); continue; }
      const v = s[k];
      const bytes = typeof v === 'string' ? Array.from(v, c => c.charCodeAt(0)) : Array.isArray(v) ? v : null;
      if (bytes) bytes.forEach((b, i) => m.escFis8(a.end + i, b & 0xFF));
      else for (let i = 0; i < a.tam; i++) m.escFis8(a.end + i, Math.floor((v >>> 0) / Math.pow(2, 8 * i)) & 0xFF);
    }
    if (t && t.entrada) m.teclar(t.entrada);
    return { prog, m, espInicial, naoAchados, modo };
  }

  function verificar(ex, codigo) {
    const res = { ok: false, erros: [], testes: [], estatico: [] };
    const prog0 = montar(codigo);
    if (!prog0.ok) {
      res.erros = prog0.erros.map(e => 'Linha ' + e.linha + ': ' + e.msg);
      return res;
    }
    const usados = new Set();
    for (const l of codigo.split('\n')) {
      // o mnemônico, depois do rótulo e dos prefixos (rep, lock, cs, o32...)
      const mm = /^\s*(?:[\w.@$?]+:)?\s*((?:(?:rep|repe|repz|repne|repnz|lock|[c-gs]s|o16|o32|a16|a32)\s+)*)([a-z]\w*)\b/i.exec(l.replace(/;.*$/, ''));
      if (mm) { usados.add(mm[2].toUpperCase()); for (const p of mm[1].trim().split(/\s+/)) if (p) usados.add(p.toUpperCase()); }
    }
    let estaticoOk = true;
    for (const p of ex.proibir || []) if (usados.has(p)) { res.estatico.push({ ok: false, msg: 'O exercício proíbe a instrução ' + p + '.' }); estaticoOk = false; }
    for (const p of ex.exigir || []) {
      const alt = p.split('|');
      if (!alt.some(a => usados.has(a))) { res.estatico.push({ ok: false, msg: 'O exercício pede que você use ' + alt.join(' ou ') + '.' }); estaticoOk = false; }
    }
    if (ex.maxBytes) {
      const n = prog0.arquivos ? prog0.arquivos.reduce((s, a) => s + a.bytes.length, 0) : prog0.bytes.length;
      const ok = n <= ex.maxBytes;
      res.estatico.push({ ok, msg: 'Tamanho do binário: ' + n + ' bytes (limite ' + ex.maxBytes + ').' });
      if (!ok) estaticoOk = false;
    }
    let todos = true;
    for (let k = 0; k < ex.testes.length; k++) {
      const t = ex.testes[k];
      const r = { nome: t.nome || ('Teste ' + (k + 1)), ok: true, msgs: [] };
      const { m, espInicial, naoAchados, modo, prog } = preparar(ex, codigo, t);
      for (const n of naoAchados) { r.ok = false; r.msgs.push('O teste precisa do rótulo "' + n + '", que não existe no programa.'); }
      m.executar(ex.maxPassos || 5000000);
      const esp = t.espera || {};
      let statusEsp = esp.status || (esp.excecao !== undefined ? 'excecao' : 'terminado');
      if (m.status === 'executando') { r.ok = false; r.msgs.push('O programa não terminou em ' + (ex.maxPassos || 5000000) + ' instruções (laço infinito?). Para terminar, use ' + (modo === 'com' ? 'INT 21h com AH=4Ch' : 'CLI e HLT') + '.'); }
      else if (m.status !== statusEsp) {
        r.ok = false;
        if (m.status === 'excecao') r.msgs.push(m.motivo);
        else if (m.status === 'erro') r.msgs.push('Erro: ' + m.motivo);
        else if (statusEsp === 'excecao') r.msgs.push('Era para acontecer a exceção ' + esp.excecao + ', mas o programa terminou normalmente.');
        else r.msgs.push('O programa terminou com estado "' + m.status + '"' + (m.motivo ? ' (' + m.motivo + ')' : '') + ', esperado "' + statusEsp + '".');
      }
      if (esp.excecao !== undefined && m.status === 'excecao') {
        const vet = typeof esp.excecao === 'string' ? SIG[esp.excecao.toUpperCase()] : esp.excecao;
        const ult = m.ultimaExcecao;
        if (!ult || ult.vetor !== vet) { r.ok = false; r.msgs.push('Era para acontecer a exceção ' + esp.excecao + ', mas aconteceu: ' + m.motivo); }
        else r.msgs.push('Aconteceu ' + esp.excecao + ', como esperado.');
      }
      for (const key of Object.keys(esp)) {
        const exp = esp[key];
        const K = key.toUpperCase();
        if (R32.includes(K) || R16.includes(K) || R8.includes(K) || FL.includes(K) || OUTROS.includes(K)) {
          const bits = bitsDe(K);
          const got = norm(m.lerRegistrador(K), bits), want = norm(exp, bits);
          if (got !== want) { r.ok = false; r.msgs.push(K + ' deveria ser ' + fmt(want, bits) + ', mas ficou ' + fmt(got, bits) + '.'); }
        } else if (key === 'mem') {
          for (const nome of Object.keys(exp)) {
            const a = enderecoDe(prog, nome, modo);
            if (!a) { r.ok = false; r.msgs.push('O rótulo "' + nome.replace(/:.$/, '') + '" não existe no programa.'); continue; }
            const want = exp[nome];
            if (typeof want === 'string' || Array.isArray(want)) {
              const arr = typeof want === 'string' ? Array.from(want, c => c.charCodeAt(0)) : want;
              const got = arr.map((_, i) => m.lerFis8(a.end + i));
              if (got.some((v, i) => v !== (arr[i] & 0xFF))) { r.ok = false; r.msgs.push(a.nome + ' deveria conter ' + (typeof want === 'string' ? '"' + want + '"' : '[' + arr.join(', ') + ']') + ', mas contém ' + (typeof want === 'string' ? '"' + got.map(c => String.fromCharCode(c)).join('') + '"' : '[' + got.join(', ') + ']') + '.'); }
            } else {
              let got = 0;
              for (let i = a.tam - 1; i >= 0; i--) got = got * 256 + m.lerFis8(a.end + i);
              const bits = a.tam * 8;
              if (norm(got, bits) !== norm(want, bits)) { r.ok = false; r.msgs.push(a.nome + ' deveria ser ' + fmt(norm(want, bits), bits) + ', mas ficou ' + fmt(got, bits) + '.'); }
            }
          }
        } else if (key === 'saida') {
          if (m.saida !== exp) { r.ok = false; r.msgs.push('Saída esperada: "' + exp.replace(/\n/g, '⏎') + '"; saída do programa: "' + m.saida.replace(/\r/g, '').replace(/\n/g, '⏎') + '".'); }
        } else if (key === 'saidaContem') {
          for (const s of [].concat(exp)) if (!m.saida.includes(s)) { r.ok = false; r.msgs.push('A saída deveria conter "' + s + '".'); }
        } else if (key === 'tela') {
          const txt = m.textoTela();
          for (const s of [].concat(exp)) if (!txt.includes(s)) { r.ok = false; r.msgs.push('A tela deveria mostrar "' + s + '".'); }
        } else if (key === 'modoProtegido') {
          if (m.pe !== !!exp) { r.ok = false; r.msgs.push(exp ? 'O processador deveria estar no modo protegido (CR0.PE = 1).' : 'O processador deveria ter voltado ao modo real.'); }
        } else if (key === 'paginacao') {
          if (m.pg !== !!exp) { r.ok = false; r.msgs.push(exp ? 'A paginação deveria estar ligada (CR0.PG = 1).' : 'A paginação deveria estar desligada.'); }
        } else if (key === 'a20') {
          if (m.a20 !== !!exp) { r.ok = false; r.msgs.push(exp ? 'A linha A20 deveria estar ligada.' : 'A linha A20 deveria estar desligada.'); }
        } else if (key === 'pilhaEquilibrada') {
          if ((m.r[4] >>> 0) !== (espInicial >>> 0) && exp) { r.ok = false; r.msgs.push('A pilha não voltou ao lugar: ESP começou em ' + hex(espInicial, 8) + 'h e terminou em ' + hex(m.r[4], 8) + 'h.'); }
        } else if (key === 'preservar') {
          for (const rg of exp) {
            const K2 = rg.toUpperCase(), bits = bitsDe(K2);
            const want = norm((t.setup && t.setup[rg] !== undefined) ? t.setup[rg] : 0, bits);
            const got = norm(m.lerRegistrador(K2), bits);
            if (got !== want) { r.ok = false; r.msgs.push(K2 + ' precisava voltar a ' + fmt(want, bits) + ', mas ficou ' + fmt(got, bits) + '.'); }
          }
        } else if (key === 'eventos') {
          const txt = m.eventos.map(e => e.texto).join('\n');
          for (const s of [].concat(exp)) if (!txt.includes(s)) { r.ok = false; r.msgs.push('Esperava o evento "' + s + '".'); }
        } else if (['status', 'excecao'].includes(key)) { /* acima */ }
        else { r.ok = false; r.msgs.push('(teste com chave desconhecida: ' + key + ')'); }
      }
      if (!r.ok && m.status === 'terminado' && m.eventos.some(e => e.tipo === 'excecao') && !r.msgs.some(x => /exceção/i.test(x))) {
        const ex1 = m.eventos.filter(e => e.tipo === 'excecao').slice(-1)[0];
        r.msgs.push('(Durante a execução aconteceu: ' + ex1.texto + ')');
      }
      if (!r.ok) todos = false;
      res.testes.push(r);
    }
    res.ok = todos && estaticoOk;
    return res;
  }

  function mensagens(r) {
    const out = [];
    if (r.erros.length) { out.push({ t: 'erro', msg: 'O programa tem erros de montagem:' }); r.erros.forEach(e => out.push({ t: 'erro', msg: e, line: +(/Linha (\d+)/.exec(e) || [])[1] })); return out; }
    for (const s of r.estatico) out.push({ t: s.ok ? 'ok' : 'erro', msg: (s.ok ? '√ ' : '× ') + s.msg });
    for (const t of r.testes) {
      out.push({ t: t.ok ? 'ok' : 'erro', msg: (t.ok ? '√ ' : '× ') + t.nome });
      for (const m of t.msgs) out.push({ t: t.ok ? 'info' : 'aviso', msg: '   ' + m });
    }
    out.push({ t: r.ok ? 'ok' : 'erro', msg: r.ok ? '■ Exercício resolvido!' : '■ Ainda não está certo. Ajuste e verifique de novo.' });
    return out;
  }

  const api = { verificar, mensagens, montar, preparar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Verificador386 = api;
})(typeof self !== 'undefined' ? self : this);
