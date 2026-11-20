// Teste de fumaça da interface: abre o app num Chromium de verdade (Playwright) e confere
// que as telas principais funcionam sem erro no console.
// Uso: npm run test:ui   (precisa do pacote playwright e de um Chromium; não faz parte do npm test)
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('playwright não está instalado: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const URL = 'file://' + path.join(__dirname, '..', 'app', 'index.html') + '?semboot';
let ok = 0, fail = 0;
const confere = (cond, msg) => { if (cond) ok++; else { fail++; console.log('FALHOU: ' + msg); } };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const ir = async (hash, espera = 250) => { await page.goto(URL + hash); await page.waitForTimeout(espera); };
  const semErros = (onde) => { confere(!erros.length, onde + ': erros no console: ' + erros.join(' | ')); erros.length = 0; };

  // 1. tela inicial
  await ir('', 600);
  confere(await page.locator('#menubar').count() === 1, 'a barra de menus aparece');
  semErros('início');

  // 2. todas as aulas do curso base renderizam, com título e cabeçalho
  const aulas = await page.evaluate(() => window.CURSO_CONTEUDO.aulas.map(a => ({ id: a.id, rotulo: a.rotulo || String(a.numero) })));
  for (const a of aulas) {
    await page.evaluate((id) => { location.hash = '#aula/' + id; }, a.id);
    await page.waitForTimeout(60);
    const num = await page.locator('.aula .cab .num').first().textContent().catch(() => '');
    confere(num.includes('Aula ' + a.rotulo), a.id + ': cabeçalho "Aula ' + a.rotulo + '" (veio "' + num + '")');
  }
  semErros('aulas');

  // 3. "Executar aqui" roda um exemplo
  await ir('#aula/aula03', 400);
  await page.locator('button', { hasText: 'Executar aqui' }).first().click();
  await page.waitForTimeout(400);
  semErros('executar aqui');

  // 4. resolver um exercício copiando a solução para o editor e verificando
  await ir('#aula/aula05b', 400);
  const ex = page.locator('.exercicio').first();
  await ex.locator('button', { hasText: 'Solução' }).click();
  await page.locator('.dlg-fundo button', { hasText: 'Sim' }).click();
  await page.locator('.dlg-fundo button', { hasText: 'Copiar para o editor' }).click();
  await ex.locator('button', { hasText: 'Verificar' }).click();
  await page.waitForTimeout(300);
  confere(await ex.locator('.estado.ok').count() === 1, 'o exercício a05b-1 fica resolvido com a solução');
  semErros('exercício');

  // 5. o simulador de bits responde à troca de operação
  const w = page.locator('.widget', { hasText: 'Bits lado a lado' });
  await w.locator('select').first().selectOption('SHL');
  confere((await w.textContent()).includes('SHL AL'), 'o simulador de bits mostra SHL');
  semErros('simulador de bits');

  // 5b. "preveja antes de executar": resposta certa fica verde
  await ir('#aula/aula05', 400);
  const pv = page.locator('.previsao').first();
  const ins = pv.locator('input');
  await ins.nth(0).fill('-2');
  await ins.nth(1).fill('22');
  await pv.locator('button', { hasText: 'Conferir' }).click();
  confere(await pv.locator('.r-ok').count() === 2, 'a previsão da aula 5 aceita AX = -2 e BX = 22');
  semErros('previsão');

  // 6. busca unificada: acha aulas e o livro
  await ir('#livro/busca/' + encodeURIComponent('complemento de dois'), 800);
  const rotulos = await page.$$eval('.res-busca .rc', e => e.map(x => x.textContent));
  confere(rotulos.some(r => r.startsWith('Aula')), 'a busca encontra aulas');
  confere(rotulos.some(r => !r.startsWith('Aula')), 'a busca encontra o livro');
  await page.locator('.res-busca').first().click();
  await page.waitForTimeout(400);
  confere(page.url().includes('#aula/') || page.url().includes('#livro/'), 'o resultado da busca abre o trecho');
  semErros('busca');

  // 7. pré-requisitos e progresso
  await ir('#aula/aula07', 400);
  confere(await page.locator('.prereq li').count() >= 1, 'a aula 7 mostra os pré-requisitos');
  await ir('#progresso', 400);
  confere((await page.locator('#v-prog').textContent()).includes('5B.'), 'a tela de progresso lista a aula 5B');
  semErros('progresso');

  // 8. visual moderno e migração do progresso das aulas divididas (página nova, com o progresso antigo gravado antes do app carregar)
  const p2 = await browser.newPage();
  await p2.addInitScript(() => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    localStorage.setItem('curso8086', JSON.stringify({ quiz: { 'aula31:q2': { 0: true } }, lidas: { aula30: true }, opcoes: { visual: 'moderno' } }));
  });
  await p2.goto(URL + '#aula/aula31b');
  await p2.waitForTimeout(500);
  const salvo = await p2.evaluate(() => JSON.parse(localStorage.getItem('curso8086') || '{}'));
  confere(salvo.quiz && salvo.quiz['aula31b:q1'] && !salvo.quiz['aula31:q2'], 'o quiz 3 da aula 31 foi para a 31B');
  confere(salvo.lidas && salvo.lidas.aula30b, 'a leitura da 30 vale para a 30B');
  confere(await p2.evaluate(() => document.documentElement.dataset.visual) === 'moderno', 'visual moderno aplicado');
  await p2.close();
  semErros('migração');

  await browser.close();
  console.log(`interface: ${ok} verificações ok, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FALHOU: ' + e.message); process.exit(1); });
