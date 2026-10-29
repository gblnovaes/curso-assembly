// Montador NASM da trilha avançada x NASM 2.16 de verdade.
// tests/nasm-esperado.txt guarda o binário que o NASM gerou para tests/nasm-corpus.asm
// (regenerar com: nasm -f bin tests/nasm-corpus.asm -o c.bin e gravar o binário em hexadecimal neste arquivo)
const fs = require('fs'), path = require('path');
const N = require('../app/core/nasm.js');
const fonte = fs.readFileSync(path.join(__dirname, 'nasm-corpus.asm'), 'utf8');
const esperado = Buffer.from(fs.readFileSync(path.join(__dirname, 'nasm-esperado.txt'), 'utf8').replace(/\s+/g, ''), 'hex');
let falhas = 0;
const r = N.montar(fonte);
if (!r.ok) { console.log('FALHOU: o corpus não monta:', r.erros.slice(0, 5)); process.exit(1); }
const meu = Buffer.from(r.bytes);
if (!meu.equals(esperado)) {
  let i = 0; while (i < meu.length && meu[i] === esperado[i]) i++;
  const linha = r.listagem.find(l => i >= l.end - r.org && i < l.end - r.org + l.tam);
  const linhas = fonte.split('\n');
  console.log('FALHOU: difere do NASM no byte ' + i + (linha ? ' (linha ' + linha.linha + ': ' + linhas[linha.linha - 1].trim() + ')' : '') +
    '\n  NASM: ' + esperado.subarray(Math.max(0, i - 4), i + 8).toString('hex') + '\n  aqui: ' + meu.subarray(Math.max(0, i - 4), i + 8).toString('hex') + '  (tamanhos ' + esperado.length + ' e ' + meu.length + ')');
  falhas++;
}

// erros didáticos: o montador recusa o que o NASM recusa, com uma explicação
const recusas = [
  ['mov [bx], 5', 'tamanho'], ['mov ax, bl', 'mesmo tamanho'], ['mov cs, ax', 'CS'], ['push byte 5', 'bytes'],
  ['mov ax, [bx+bp]', '16 bits'], ['mov ax, word ptr [bx]', 'PTR'], ['mov si, offset msg\nmsg: db 0', 'OFFSET'],
  ['cpu 286\nmov eax, 1', '80386'], ['cpu 8086\nshl ax, 4', '80186'], ['cpu 186\nlgdt [0]', '80286'],
  ['times 600 nop\ntimes 510-($-$$) db 0', 'negativo'], ['jmp short x\ntimes 200 nop\nx:', 'curto'],
  ['mov ax, es:[bx]', 'colchetes'], ['x: dw 1\nx: dw 2', 'mais de uma vez'], ['mov ax, [nada]', 'não definido'],
  ['loop x\ntimes 300 nop\nx:', 'LOOP só alcança'], ['%macro m 2\nadd %1, %2\n%endmacro\nm ax', 'espera 2'],
];
for (const [src, trecho] of recusas) {
  const x = N.montar(src);
  const msg = x.erros.map(e => e.msg).join(' | ');
  if (x.ok || !msg.toLowerCase().includes(trecho.toLowerCase())) { console.log('FALHOU: deveria recusar com "' + trecho + '": ' + JSON.stringify(src) + ' -> ' + (x.ok ? 'montou' : msg)); falhas++; }
}

// disco com vários arquivos
const d = N.montarDisco(';### ARQUIVO boot.asm\norg 0x7c00\njmp $\ntimes 510-($-$$) db 0\ndw 0xAA55\n;### ARQUIVO kernel.asm\norg 0x1000\nmov ax, 1\n');
if (!d.ok || d.bytes.length !== 1024 || d.bytes[510] !== 0x55 || d.bytes[512] !== 0xB8 || d.arquivos[1].setor !== 1) { console.log('FALHOU: montarDisco', d.erros); falhas++; }

console.log('nasm: ' + meu.length + ' bytes do corpus conferidos com o NASM, ' + recusas.length + ' recusas, ' + (falhas ? falhas + ' falharam' : 'tudo certo'));
process.exit(falhas ? 1 : 0);
