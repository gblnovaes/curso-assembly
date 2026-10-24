/* Correção automática de exercícios: roda o código do aluno no simulador e confere os resultados. */
(function (root) {
  'use strict';
  const Asm = root.Asm8086 || (typeof require === 'function' ? require('../core/asm.js') : null);
  const M = root.Machine8086 || (typeof require === 'function' ? require('../core/cpu.js') : null);

  const hex = (v, n) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
  const R8 = ['AL', 'AH', 'BL', 'BH', 'CL', 'CH', 'DL', 'DH'];
  const R16 = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'BP', 'SP', 'CS', 'DS', 'ES', 'SS', 'IP'];
  const FL = ['CF', 'ZF', 'SF', 'OF', 'PF', 'AF', 'DF', 'IF', 'TF'];

  function fmt(v, bits) {
    const n = bits === 8 ? v & 0xFF : v & 0xFFFF;
    const sig = bits === 8 ? (n & 0x80 ? n - 256 : n) : (n & 0x8000 ? n - 65536 : n);
    return n + ' (' + hex(n, bits / 4) + 'h' + (sig < 0 ? ', com sinal ' + sig : '') + ')';
  }
  const norm = (v, bits) => bits === 8 ? v & 0xFF : bits === 1 ? (v ? 1 : 0) : v & 0xFFFF;

  function verificar(ex, codigo) {
    const res = { ok: false, erros: [], testes: [], estatico: [] };
    const prog = M.montarPrograma ? M.montarPrograma(codigo) : Asm.assemble(codigo);
    if (!prog.ok) {
      res.erros = prog.errors.map(e => 'Linha ' + e.line + ': ' + e.msg);
      return res;
    }
    const usados = new Set(prog.instrs.flatMap(i => [i.mn, i.prefix].filter(Boolean)));
    let estaticoOk = true;
    for (const p of ex.proibir || []) if (usados.has(p)) { res.estatico.push({ ok: false, msg: 'O exercício proíbe a instrução ' + p + '.' }); estaticoOk = false; }
    for (const p of ex.exigir || []) {
      const alternativas = p.split('|');
      if (!alternativas.some(a => usados.has(a))) { res.estatico.push({ ok: false, msg: 'O exercício pede que você use ' + alternativas.join(' ou ') + '.' }); estaticoOk = false; }
    }
    const bytes = prog.instrs.reduce((s, i) => s + i.size, 0);
    if (ex.maxBytes) {
      const ok = bytes <= ex.maxBytes;
      res.estatico.push({ ok, msg: 'Tamanho do código: ' + bytes + ' bytes (limite ' + ex.maxBytes + ').' });
      if (!ok) estaticoOk = false;
    }
    let todos = true;
    for (let k = 0; k < ex.testes.length; k++) {
      const t = ex.testes[k];
      const r = { nome: t.nome || ('Teste ' + (k + 1)), ok: true, msgs: [] };
      const run = M.runProgram(codigo, { setup: t.setup, input: t.entrada, timer: !!ex.timer, maxSteps: ex.maxPassos || 3000000, arquivos: t.arquivos, linhaComando: t.linhaComando, residente: t.residente, mouse: t.mouse });
      const m = run.machine;
      const esp = t.espera || {};
      const statusEsperado = esp.status || 'terminado';
      if (run.status === 'tempo-esgotado') { r.ok = false; r.msgs.push('O programa não terminou (laço infinito?).'); }
      else if (run.status === 'aguardando' && statusEsperado !== 'aguardando') { r.ok = false; r.msgs.push('O programa ficou esperando teclado' + (t.entrada ? ' depois de ler a entrada "' + t.entrada.replace(/\r/g, '⏎') + '"' : '') + '.'); }
      else if (run.status !== statusEsperado && !(statusEsperado === 'terminado' && run.status === 'executando')) {
        r.ok = false;
        r.msgs.push(run.status === 'erro' ? 'Erro na execução: ' + m.haltReason
          : statusEsperado === 'residente' ? 'O programa deveria terminar e ficar residente (INT 21h, AH=31h).'
          : run.status === 'residente' ? 'O programa ficou residente (AH=31h), mas devia terminar normalmente.'
          : 'O programa terminou com estado "' + run.status + '", esperado "' + statusEsperado + '".');
      }
      for (const key of Object.keys(esp)) {
        const exp = esp[key];
        const K = key.toUpperCase();
        if (R16.includes(K) || R8.includes(K) || FL.includes(K)) {
          const bits = R8.includes(K) ? 8 : FL.includes(K) ? 1 : 16;
          const got = norm(m.getReg(K), bits), want = norm(exp, bits);
          if (got !== want) { r.ok = false; r.msgs.push(K + ' deveria ser ' + (bits === 1 ? want : fmt(want, bits)) + ', mas ficou ' + (bits === 1 ? got : fmt(got, bits)) + '.'); }
        } else if (key === 'mem') {
          for (const nome of Object.keys(exp)) {
            // run.prog: no modo de boot as variáveis vão para o segmento onde o código rodou
            const s = (run.prog || prog).symbols[nome.toUpperCase()];
            if (!s) { r.ok = false; r.msgs.push('Variável "' + nome + '" não existe no programa. Não renomeie as variáveis do enunciado.'); continue; }
            const vals = Array.isArray(exp[nome]) ? exp[nome] : [exp[nome]];
            // DD lido como inteiro de 32 bits, a não ser que a lista tenha mais itens que a variável (aí são words)
            const tam = s.type === 1 ? 1 : s.type === 4 && vals.length <= (s.count || 1) ? 4 : 2;
            const base = s.seg * 16 + s.off;
            const got = vals.map((_, i) => tam === 1 ? m.mem[base + i] : tam === 4 ? (m.mem[base + 4 * i] | (m.mem[base + 4 * i + 1] << 8) | (m.mem[base + 4 * i + 2] << 16) | (m.mem[base + 4 * i + 3] << 24)) >>> 0 : m.mem[base + 2 * i] | (m.mem[base + 2 * i + 1] << 8));
            const want = vals.map(v => typeof v === 'string' ? v.charCodeAt(0) : tam === 4 ? v >>> 0 : norm(v, tam * 8));
            if (got.some((g, i) => g !== want[i])) {
              r.ok = false;
              const f1 = (v) => tam === 4 ? v + ' (' + hex(v, 8) + 'h)' : fmt(v, tam * 8);
              r.msgs.push(nome + ' deveria ser ' + (vals.length > 1 ? '[' + want.join(', ') + ']' : f1(want[0])) + ', mas ficou ' + (vals.length > 1 ? '[' + got.join(', ') + ']' : f1(got[0])) + '.');
            }
          }
        } else if (key === 'reais') {
          for (const nome of Object.keys(exp)) {
            const s = prog.symbols[nome.toUpperCase()];
            if (!s) { r.ok = false; r.msgs.push('Variável "' + nome + '" não existe no programa.'); continue; }
            const tipo = s.type === 4 ? 'f32' : s.type === 8 ? 'f64' : s.type === 10 ? 'f80' : null;
            if (!tipo) { r.ok = false; r.msgs.push(nome + ' precisa ser um número real (DD, DQ ou DT).'); continue; }
            const got = m.fmemLer(tipo, { seg: s.seg, off: s.off });
            const [want, tol] = Array.isArray(exp[nome]) ? exp[nome] : [exp[nome], tipo === 'f32' ? 1e-5 : 1e-9];
            if (!(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)))) { r.ok = false; r.msgs.push(nome + ' deveria ser ' + want + ', mas ficou ' + got + '.'); }
          }
        } else if (key === 'st') {
          const pilha = m.fpuPilha();
          exp.forEach((want, i) => {
            const got = pilha[i];
            const ok = want === null ? got === null : got !== null && Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
            if (!ok) { r.ok = false; r.msgs.push('ST(' + i + ') deveria ' + (want === null ? 'estar vazio' : 'ser ' + want) + ', mas ' + (got === null ? 'está vazio' : 'é ' + got) + '.'); }
          });
        } else if (key === 'modoVideo') {
          if (m.videoMode !== exp) { r.ok = false; r.msgs.push('O modo de vídeo no fim deveria ser ' + hex(exp, 2) + 'h, mas é ' + hex(m.videoMode, 2) + 'h.'); }
        } else if (key === 'pixel') {
          for (const pos of Object.keys(exp)) {
            const [x, y] = pos.split(',').map(Number);
            const got = m.mem[0xA0000 + y * 320 + x];
            if (got !== exp[pos]) { r.ok = false; r.msgs.push('O pixel (' + x + ',' + y + ') deveria ter a cor ' + exp[pos] + ', mas tem ' + got + '.'); }
          }
        } else if (key === 'contaPixels') {
          for (const cor of Object.keys(exp)) {
            let n = 0; const c = +cor;
            for (let i = 0; i < 64000; i++) if (m.mem[0xA0000 + i] === c) n++;
            if (n !== exp[cor]) { r.ok = false; r.msgs.push('Deveria haver ' + exp[cor] + ' pixels da cor ' + c + ' na tela, mas há ' + n + '.'); }
          }
        } else if (key === 'paleta') {
          for (const idx of Object.keys(exp)) {
            const got = Array.from(m.dac.slice(+idx * 3, +idx * 3 + 3)), want = exp[idx];
            if (got.some((g, i) => g !== want[i])) { r.ok = false; r.msgs.push('A cor ' + idx + ' da paleta deveria ser (' + want.join(', ') + '), mas é (' + got.join(', ') + ').'); }
          }
        } else if (key === 'arquivos') {
          for (const nome of Object.keys(exp)) {
            const f = m.disco.get(nome.toUpperCase());
            const want = exp[nome];
            if (want === null) { if (f) { r.ok = false; r.msgs.push('O arquivo ' + nome + ' não deveria existir no fim.'); } continue; }
            if (!f) { r.ok = false; r.msgs.push('O arquivo ' + nome + ' deveria existir no disco, mas não foi criado.'); continue; }
            const wb = typeof want === 'string' ? Array.from(want, ch => Asm.cp437(ch)) : want;
            if (f.dados.length !== wb.length || f.dados.some((b, i) => b !== wb[i])) {
              const vis = (a) => '"' + a.slice(0, 60).map(b => b === 13 ? '\r' : b === 10 ? '\n' : b < 32 || b > 126 ? '·' : String.fromCharCode(b)).join('') + (a.length > 60 ? '…' : '') + '"';
              r.ok = false; r.msgs.push('O conteúdo de ' + nome + ' deveria ser ' + vis(wb) + ' (' + wb.length + ' bytes), mas é ' + vis(f.dados) + ' (' + f.dados.length + ' bytes).');
            }
          }
        } else if (key === 'arquivosFechados') {
          const abertos = m.handles.slice(5).filter(h => h && h.tipo === 'arq').length;
          if (abertos) { r.ok = false; r.msgs.push(abertos + ' arquivo(s) ficaram abertos: feche com INT 21h, AH=3Eh.'); }
        } else if (key === 'mouseSemRotina') {
          if (exp && m.mouse && m.mouse.rotina) { r.ok = false; r.msgs.push('A rotina do mouse ficou instalada: antes de sair, desinstale com AX=0Ch e CX=0 (senão o driver chama um código que não existe mais).'); }
        } else if (key === 'portas') {
          const val = { pit0: m.pit[0].reload, pit2: m.pit[2].reload, '61': m.ports[0x61] & 3, imr: m.pic.imr };
          for (const p of Object.keys(exp)) if (val[p] !== exp[p]) { r.ok = false; r.msgs.push((p === 'pit0' ? 'O divisor do canal 0 do PIT' : p === 'pit2' ? 'O divisor do canal 2 do PIT (alto-falante)' : p === '61' ? 'Os bits 0 e 1 da porta 61h' : 'A máscara do PIC (porta 21h)') + ' deveria ser ' + exp[p] + ', mas é ' + val[p] + '.'); }
        } else if (key === 'notas') {
          const seq = [];
          for (const e of m.soundLog) { const f = Math.round(e.freq); if (f && seq[seq.length - 1] !== f) seq.push(f); }
          const ok = seq.length === exp.length && exp.every((f, i) => Math.abs(seq[i] - f) <= f * 0.01 + 1);
          if (!ok) { r.ok = false; r.msgs.push('O alto-falante deveria tocar ' + exp.join(', ') + ' Hz, mas tocou ' + (seq.length ? seq.join(', ') + ' Hz' : 'nada') + '.'); }
        } else if (key === 'saida') {
          const got = m.outputText().trim(), want = String(exp).trim();
          if (got !== want) { r.ok = false; r.msgs.push('A saída deveria ser "' + want.replace(/\n/g, '⏎') + '", mas foi "' + got.replace(/\n/g, '⏎') + '".'); }
        } else if (key === 'saidaContem') {
          const got = m.outputText();
          for (const w of [].concat(exp)) if (!got.includes(w)) { r.ok = false; r.msgs.push('A saída deveria conter "' + w + '". Saída: "' + got.replace(/\n/g, '⏎').slice(0, 120) + '".'); }
        } else if (key === 'telaContem') {
          const got = m.screenText();
          for (const w of [].concat(exp)) if (!got.includes(w)) { r.ok = false; r.msgs.push('A tela deveria mostrar "' + w + '".'); }
        } else if (key === 'video') {
          // { "0": ["O", 30] } -> célula 0 com caractere O e atributo 1Eh
          for (const pos of Object.keys(exp)) {
            const [ch, at] = exp[pos];
            const a = 0xB8000 + (+pos) * 2;
            const gc = m.mem[a], ga = m.mem[a + 1];
            const wc = typeof ch === 'string' ? ch.charCodeAt(0) : ch;
            if (gc !== wc || (at !== undefined && ga !== at)) { r.ok = false; r.msgs.push('Na posição ' + pos + ' da tela (linha ' + Math.floor(pos / 80) + ', coluna ' + (pos % 80) + ') deveria estar "' + String.fromCharCode(wc) + '"' + (at !== undefined ? ' com atributo ' + hex(at, 2) + 'h' : '') + ', mas está "' + String.fromCharCode(gc) + '" com atributo ' + hex(ga, 2) + 'h.'); }
          }
        } else if (key === 'pilhaEquilibrada') {
          if (m.SP !== m.initial.sp) { r.ok = false; r.msgs.push('A pilha terminou desequilibrada: SP = ' + hex(m.SP, 4) + 'h, deveria voltar a ' + hex(m.initial.sp, 4) + 'h (PUSH sem POP?).'); }
        } else if (key === 'preservar') {
          for (const reg of [].concat(exp)) {
            const want = t.setup && t.setup[reg] !== undefined ? norm(t.setup[reg], 16) : 0;
            const got = m.getReg(reg);
            if (got !== want) { r.ok = false; r.msgs.push(reg + ' deveria ter sido preservado (' + hex(want, 4) + 'h), mas mudou para ' + hex(got, 4) + 'h.'); }
          }
        } else if (key === 'maxCiclos') {
          if (m.cycles > exp) { r.ok = false; r.msgs.push('Gastou ' + m.cycles + ' ciclos; o limite é ' + exp + '.'); }
          else r.msgs.push('Ciclos: ' + m.cycles + ' (limite ' + exp + ').');
        } else if (key === 'status' || key === 'codigoSaida') {
          if (key === 'codigoSaida' && m.exitCode !== exp) { r.ok = false; r.msgs.push('Código de saída deveria ser ' + exp + ', mas foi ' + m.exitCode + '.'); }
        }
      }
      if (ex.maxCiclos && m.cycles > ex.maxCiclos) { r.ok = false; r.msgs.push('Gastou ' + m.cycles + ' ciclos; o limite é ' + ex.maxCiclos + '.'); }
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

  const api = { verificar, mensagens };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Verificador = api;
})(typeof self !== 'undefined' ? self : this);
