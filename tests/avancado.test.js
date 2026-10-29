// Confere a trilha avançada (conteudo-386/): compila as aulas, monta os exemplos,
// garante que a solução de cada exercício passa e o código inicial não, e que os
// links levam a aulas que existem. Os ids não podem repetir os do curso principal.
// Uso: node tests/avancado.test.js
const path = require('path');
const fs = require('fs');
const { lerTrilha, SRC_AV, buildLivro } = require('../tools/build-conteudo.js');
const Asm = require('../app/core/asm.js');
global.Asm8086 = Asm;
global.Machine8086 = require('../app/core/cpu.js');
const V0 = require('../app/ui/verificador.js');
const N = require('../app/core/nasm.js');
const M386 = require('../app/core/cpu386.js');
const V386 = require('../app/ui/verificador386.js');

const M = global.Machine8086;
let ok = 0, fail = 0;
const falha = (m) => { fail++; console.log('FALHOU: ' + m); };

// o curso principal entra primeiro: os ids dele ficam reservados
const ids = new Set(), exIds = new Set();
let principal = [], trilha = [], modulos = [];
try { principal = lerTrilha(path.join(__dirname, '..', 'conteudo'), ids, exIds); } catch (e) { falha('conteudo/: ' + e.message); }
try {
  trilha = lerTrilha(SRC_AV, ids, exIds);
  modulos = JSON.parse(fs.readFileSync(path.join(SRC_AV, 'modulos.json'), 'utf8'));
} catch (e) { falha('conteudo-386/: ' + e.message); }
global.CURSO_CONTEUDO = { aulas: principal.concat(trilha) };

const modIds = new Set(modulos.map(m => m.id));
const idsPrincipal = new Set(principal.map(a => a.id));
const idsTrilha = new Set(trilha.map(a => a.id));
let caps = null;
try { const l = buildLivro(principal); caps = l && new Set(l.capitulos.map(c => c.id)); } catch (e) { falha('livro-bios: ' + e.message); }

for (const a of trilha) {
  if (!modIds.has(a.modulo)) falha(a.id + ': módulo ' + a.modulo + ' não existe'); else ok++;
  for (const b of a.blocks) {
    const html = (b.html || '') + (b.ex ? b.ex.enunciado || '' : '');
    for (const m of html.matchAll(/href="#(aula|avancado|livro)\/([^"\/]+)/g)) {
      const alvo = m[1] === 'aula' ? idsPrincipal : m[1] === 'avancado' ? idsTrilha : caps;
      if (alvo && !alvo.has(m[2])) falha(a.id + ': link quebrado #' + m[1] + '/' + m[2]); else ok++;
    }
    if (b.t === 'asm' && !b.soLeitura) {
      const nome = a.id + ' [' + (b.titulo || b.code.split('\n')[0]) + ']';
      const p = M.montarPrograma(b.code);
      if (!p.ok) falha(nome + ' não monta: ' + p.errors.map(e => 'linha ' + e.line + ': ' + e.msg).join(' | '));
      else ok++;
    }
    if (b.t === 'nasm' && !b.soLeitura) {
      // exemplo NASM: monta e, se for executável, roda na máquina 386 até o fim
      const nome = a.id + ' [' + (b.titulo || b.code.split('\n')[0]) + ']';
      const p = N.temArquivos(b.code) ? N.montarDisco(b.code) : N.montar(b.code);
      if (!p.ok) { falha(nome + ' não monta: ' + p.erros.map(e => 'linha ' + e.linha + ': ' + e.msg).join(' | ')); continue; }
      ok++;
      if (b.run) {
        const m = new M386.Maquina({ memoria: 8 * 1024 * 1024 });
        const opts = { modo: b.modo || 'com', org: b.org ? +b.org : undefined };
        if (p.arquivos) opts.disco = p.bytes;
        m.carregar(p.arquivos && opts.modo !== 'boot' ? p.arquivos[0].bytes : p.bytes, opts);
        if (b.entrada) m.teclar(b.entrada);
        m.executar(20000000);
        const fim = b.termina || 'terminado';
        if (m.status !== fim) falha(nome + ': terminou com "' + m.status + '" (' + m.motivo + '), esperado "' + fim + '"');
        else ok++;
      }
    }
    if (b.t === 'ex') {
      const ex = b.ex;
      const V = ex.maquina === '386' ? V386 : V0;
      if (!ex.solucao) { falha(a.id + ' ' + ex.id + ': sem solução'); continue; }
      const r = V.verificar(ex, ex.solucao);
      if (!r.ok) falha(a.id + ' ' + ex.id + ': a solução não passa: ' + JSON.stringify(V.mensagens(r).filter(m => m.t !== 'ok').map(m => m.msg)));
      else ok++;
      if (ex.inicial) {
        const r2 = V.verificar(ex, ex.inicial);
        if (r2.ok) falha(a.id + ' ' + ex.id + ': o código inicial já passa nos testes');
        else ok++;
      }
    }
  }
}
if (trilha.length && Math.min(...trilha.map(a => a.numero)) <= Math.max(...principal.map(a => a.numero))) falha('a trilha avançada deve continuar a numeração do curso principal');

console.log(`trilha avançada: ${trilha.length} aulas, ${ok} verificações ok, ${fail} falharam`);
process.exit(fail ? 1 : 0);
