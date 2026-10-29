// Confere a máquina 386 da trilha avançada (app/core/cpu386.js) sem precisar de emulador:
// os cenários de tests/cenarios386 precisam escrever na porta E9h o mesmo que o Bochs escreveu
// (gravado em NOME.esperado por tools/cenarios386.js), e alguns programas curtos nos modos com e pm32.
// Uso: node tests/cpu386.test.js
const fs = require('fs'), path = require('path');
const N = require('../app/core/nasm.js');
const M = require('../app/core/cpu386.js');
const { fonte } = require('./cenarios386/comum.js');

let ok = 0, fail = 0;
const confere = (nome, cond, msg) => { if (cond) ok++; else { fail++; console.log('FALHOU: ' + nome + (msg ? ': ' + msg : '')); } };

const DIR = path.join(__dirname, 'cenarios386');
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.asm')).sort()) {
  const nome = f.replace(/\.asm$/, '');
  const r = N.montarDisco(fonte(fs.readFileSync(path.join(DIR, f), 'utf8')));
  if (!r.ok) { confere(nome, false, 'não monta: ' + r.erros[0].msg); continue; }
  const img = new Uint8Array(16 * 63 * 512 * 2);
  let p = 0;
  for (const a of r.arquivos) { img.set(a.bytes, p); p += Math.ceil(a.bytes.length / 512) * 512; }
  const m = new M.Maquina({ memoria: 16 * 1024 * 1024 });
  m.carregar(img.subarray(0, 512), { modo: 'boot', disco: img });
  m.executar(20000000);
  const esp = fs.readFileSync(path.join(DIR, nome + '.esperado'), 'latin1');
  let k = 0; while (k < esp.length && esp[k] === m.saida[k]) k++;
  confere('cenário ' + nome, m.saida === esp, 'difere do Bochs no caractere ' + k + ': ' + JSON.stringify(m.saida.slice(k, k + 60)) + ' em vez de ' + JSON.stringify(esp.slice(k, k + 60)) + ' (' + m.status + ' ' + m.motivo + ')');
}

function roda(src, opts) {
  const r = N.montar(src);
  if (!r.ok) throw new Error(r.erros[0].msg);
  return M.rodar(r.bytes, opts);
}
// .COM com INT 21h e aritmética de 32 bits
let m = roda(`org 100h
mov ah, 9
mov dx, msg
int 21h
mov eax, 0x12345678
mov ebx, 0x10
mul ebx
mov ax, 4C07h
int 21h
msg db 'Ola 386$'`, { modo: 'com' });
confere('com', m.status === 'terminado' && m.saida === 'Ola 386' && m.r[2] === 1, m.status + ' ' + m.saida);
// pm32: seletor inválido vira #GP não tratado, com explicação
m = roda('bits 32\norg 0x100000\nmov ax, 0x38\nmov ds, ax\nhlt', { modo: 'pm32' });
confere('pm32 #GP', m.status === 'excecao' && m.ultimaExcecao.vetor === 13 && m.ultimaExcecao.codigo === 0x38 && /GDT/.test(m.motivo), m.status + ' ' + m.motivo);
// pm32: HLT com IF = 0 termina
m = roda('bits 32\nmov eax, 5\ncli\nhlt', { modo: 'pm32' });
confere('pm32 hlt', m.status === 'terminado' && m.r[0] === 5, m.status + ' ' + m.motivo);
// instrução do 486 é recusada com explicação
m = roda('bits 32\ncpu 486\nbswap eax\nhlt', { modo: 'pm32' });
confere('486', m.status === 'excecao' && m.ultimaExcecao.vetor === 6 && /486/.test(m.motivo), m.status + ' ' + m.motivo);
// tela de texto
m = roda('bits 32\nmov dword [0xB8000], 0x074B074F\ncli\nhlt', { modo: 'pm32' });
confere('tela', m.textoTela().startsWith('OK'), JSON.stringify(m.textoTela().slice(0, 10)));

console.log(`cpu386: ${ok} verificações ok, ${fail} falharam`);
process.exit(fail ? 1 : 0);
