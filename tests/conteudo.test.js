// Confere todas as aulas: compila o conteúdo, monta os exemplos executáveis e
// garante que a solução de cada exercício passa no verificador.
// Uso: node tests/conteudo.test.js [aula33 ...]   (com nomes, confere só essas aulas e pula o livro)
const path = require('path');
const fs = require('fs');
const { parseLesson, buildLivro } = require('../tools/build-conteudo.js');
const Asm = require('../app/core/asm.js');
global.Asm8086 = Asm;
global.Machine8086 = require('../app/core/cpu.js');
const V = require('../app/ui/verificador.js');

const dir = path.join(__dirname, '..', 'conteudo');
const M = global.Machine8086;
const filtro = process.argv.slice(2);
let ok = 0, fail = 0;
const falha = (m) => { fail++; console.log('FALHOU: ' + m); };
const todas = fs.readdirSync(dir).filter(f => /^aula\d+.*\.md$/.test(f)).sort();
const lidas = {};
for (const f of todas) { try { lidas[f] = parseLesson(path.join(dir, f)); } catch (e) { falha(f + ': ' + e.message); } }
// discos com vários arquivos buscam o código de outras aulas (";### ARQUIVO X.COM = aula33/COBRA.ASM")
global.CURSO_CONTEUDO = { aulas: Object.values(lidas) };
for (const f of todas) {
  const a = lidas[f];
  if (!a || (filtro.length && !filtro.some(x => f.startsWith(x)))) continue;
  for (const b of a.blocks) {
    if (b.t === 'asm' && !b.soLeitura) {
      const nome = f + ' [' + (b.titulo || b.code.split('\n')[0]) + ']';
      const p = M.montarPrograma(b.code);
      if (!p.ok) falha(nome + ' não monta: ' + p.errors.map(e => (e.arquivo ? e.arquivo + ' ' : '') + 'linha ' + e.line + ': ' + e.msg).join(' | '));
      else ok++;
      // jogos e discos de boot: rodam um bom pedaço sem erro (esperando tecla é normal)
      if (p.ok && (b.jogo || b.boot)) {
        const r = M.runProgram(b.code, { maxSteps: 400000, timer: true });
        if (r.status === 'erro') falha(nome + ' dá erro ao rodar: ' + r.machine.haltReason + ' (linha ' + r.machine.curLine + ')');
        else ok++;
      }
    }
    if (b.t === 'ex') {
      const ex = b.ex;
      if (!ex.solucao) { falha(f + ' ' + ex.id + ': sem solução'); continue; }
      const r = V.verificar(ex, ex.solucao);
      if (!r.ok) falha(f + ' ' + ex.id + ': a solução não passa: ' + JSON.stringify(V.mensagens(r).filter(m => m.t !== 'ok').map(m => m.msg)));
      else ok++;
      if (ex.inicial) {
        const r2 = V.verificar(ex, ex.inicial);
        if (r2.ok) falha(f + ' ' + ex.id + ': o código inicial já passa nos testes');
        else ok++;
      }
    }
  }
}
// Livro da BIOS: compila, os links levam a aulas e capítulos que existem
// e os programas completos montam no montador do curso.
const idsAulas = Object.values(lidas);
let livro = null;
if (!filtro.length) try { livro = buildLivro(idsAulas); } catch (e) { falha('livro-bios: ' + e.message); }
if (livro) {
  const capIds = new Set(livro.capitulos.map(c => c.id));
  const aulaIds = new Set(idsAulas.map(a => a.id));
  for (const c of livro.capitulos) {
    for (const b of c.blocks) {
      if (b.html) for (const m of b.html.matchAll(/href="#(aula|livro)\/([^"\/]+)/g)) {
        if (!(m[1] === 'aula' ? aulaIds : capIds).has(m[2])) falha('livro ' + c.id + ': link quebrado #' + m[1] + '/' + m[2]);
        else ok++;
      }
      if (b.t === 'asm' && !b.soLeitura) {
        const p = Asm.assemble(b.code);
        if (!p.ok) falha('livro ' + c.id + ' [' + b.titulo + '] não monta: ' + p.errors.map(e => 'linha ' + e.line + ': ' + e.msg).join(' | '));
        else ok++;
      }
    }
    if (!c.busca.length) falha('livro ' + c.id + ': sem texto para a busca');
  }
  // as aulas que citam o livro apontam para capítulos que existem
  for (const a of idsAulas) for (const b of a.blocks) {
    const html = (b.html || '') + (b.ex ? b.ex.enunciado || '' : '');
    for (const m of html.matchAll(/href="#livro\/([^"\/]+)/g)) {
      if (!capIds.has(m[1])) falha(a.id + ': link quebrado para o livro #livro/' + m[1]); else ok++;
    }
  }
  if (livro.capitulos.length < 27) falha('livro: esperava 27 capítulos e apêndices, achei ' + livro.capitulos.length);
}

console.log(`${ok} verificações ok, ${fail} falharam`);
process.exit(fail ? 1 : 0);
