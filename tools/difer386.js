// Teste diferencial da máquina 386 do curso contra o QEMU (só para quem desenvolve; precisa de nasm e qemu-system-i386).
// Gera programas com milhares de instruções aleatórias, roda no QEMU e no simulador e compara
// registradores e flags depois de cada instrução (os flags que o 386 deixa indefinidos são ignorados).
// Uso: node tools/difer386.js [semente] [quantidade]
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const N = require('../app/core/nasm.js');
const M = require('../app/core/cpu386.js');

let semente = +(process.argv[2] || 1);
const QTD = +(process.argv[3] || 600);
const rnd = () => { semente = (semente * 1103515245 + 12345) & 0x7FFFFFFF; return semente / 0x80000000; };
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];
const valor = () => pick([0, 1, 2, 0x7F, 0x80, 0xFF, 0x100, 0x7FFF, 0x8000, 0xFFFF, 0x10000, 0x7FFFFFFF, 0x80000000, 0xFFFFFFFF, 0x12345678, 0x89ABCDEF, ri(256), ri(65536), ri(0x100000000), ri(0x100000000), ri(0x100000000)]) >>> 0;
const CF = 1, PF = 4, AF = 16, ZF = 64, SF = 128, OF = 2048, TODOS = CF | PF | AF | ZF | SF | OF;
const R = { 1: ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'], 2: ['ax', 'cx', 'dx', 'bx', 'bp', 'si', 'di'], 4: ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'] };
let rotulos = 0;
const TAM = { 1: 'byte', 2: 'word', 4: 'dword' };

function gerarTeste(bits) {
  const s = pick([1, 2, 4]);
  const r1 = pick(R[s]), r2 = pick(R[s]);
  const tipo = ri(22);
  let ins, mascara = TODOS, mem = false;
  const memOp = () => { mem = true; return TAM[s] + ' [' + (bits === 16 ? pick(['bx', 'bx+si', 'di+4', 'bp+di']) : pick(['ebx', 'ebx+esi', 'edi+4', 'ebx+esi*2'])) + ']'; };
  switch (tipo) {
    case 0: case 1: case 2: { const op = pick(['add', 'adc', 'sub', 'sbb', 'cmp', 'and', 'or', 'xor', 'test']); const b = pick([r2, String(valor() & (s === 4 ? 0xFFFFFFFF : (1 << (8 * s)) - 1)), String((ri(256) - 128))]); ins = `${op} ${r1}, ${b}`; if (['and', 'or', 'xor', 'test'].includes(op)) mascara &= ~AF; break; }
    case 3: { const op = pick(['add', 'sub', 'and', 'xor', 'adc', 'sbb', 'or', 'cmp']); ins = ri(2) ? `${op} ${memOp()}, ${r1}` : `${op} ${r1}, ${memOp()}`; if (['and', 'or', 'xor'].includes(op)) mascara &= ~AF; break; }
    case 4: { const op = pick(['inc', 'dec', 'neg', 'not']); ins = `${op} ${r1}`; break; }
    case 5: case 6: { const op = pick(['shl', 'shr', 'sar', 'rol', 'ror', 'rcl', 'rcr', 'sal']); const c = pick([1, 1, 2, 3, 7, 8, 9, 15, 16, 17, 31, 32, 33, ri(40)]); ins = `${op} ${r1}, ${c}`;
      const n = c & 31;
      if (n === 0) break;
      if (['rol', 'ror'].includes(op)) { mascara = CF | OF; if (n !== 1) mascara &= ~OF; if (n % (8 * s) === 0) mascara &= ~CF; }
      else if (['rcl', 'rcr'].includes(op)) { mascara = CF | OF; if (n !== 1) mascara &= ~OF; }
      else { mascara &= ~AF; if (n !== 1) mascara &= ~OF; if (n > 8 * s) mascara &= ~CF; if (n >= 8 * s && s < 4) mascara = 0; }
      break; }
    case 7: { const op = pick(['shl', 'shr', 'sar', 'rol', 'rcr']); ins = `mov cl, ${ri(40)}\n${op} ${r1 === 'cl' || r1 === 'cx' || r1 === 'ecx' || r1 === 'ch' ? 'dl' + '' : r1}, cl`; if (/,\s*cl$/.test(ins) && s === 1 && /^(c[lh])$/.test(r1)) ins = `mov cl, 3\n${op} bl, cl`; mascara = 0; break; }
    case 8: { const op = pick(['mul', 'imul']); ins = `${op} ${r1}`; mascara = CF | OF; break; }
    case 9: { if (s === 1) { ins = `imul ${pick(R[2])}, ${pick(R[2])}`; } else ins = pick([`imul ${r1}, ${r2}`, `imul ${r1}, ${r2}, ${ri(2000) - 1000}`, `imul ${r1}, ${valor() & 0x7FFF}`]); mascara = CF | OF; break; }
    case 10: { // div sem estouro: zera a parte alta antes
      const d = s === 1 ? 'bl' : s === 2 ? 'bx' : 'ebx';
      const hi = s === 1 ? 'ah' : s === 2 ? 'dx' : 'edx';
      ins = `mov ${d}, ${1 + ri(200)}\nmov ${hi}, 0\n${pick(['div', 'idiv'])} ${d}`; if (/idiv/.test(ins)) ins = ins.replace(`mov ${hi}, 0`, s === 1 ? 'mov ah, 0\nand al, 0x7f' : s === 2 ? 'xor dx, dx\nand ax, 0x7fff' : 'xor edx, edx\nand eax, 0x7fffffff'); mascara = 0; break; }
    case 11: { if (s === 1) { ins = `movzx ${pick(R[2])}, ${r1}`; } else ins = pick([`movzx ${pick(R[4])}, ${pick(R[2])}`, `movsx ${pick(R[4])}, ${pick(R[2])}`, `movsx ${pick(R[2])}, ${pick(R[1])}`, `movzx ${pick(R[4])}, ${pick(R[1])}`]); break; }
    case 12: { if (s === 1) { ins = `set${pick(['o', 'b', 'z', 'be', 's', 'p', 'l', 'le', 'a', 'g', 'ge', 'nz'])} ${r1}`; } else { const op = pick(['bt', 'bts', 'btr', 'btc']); ins = `${op} ${r1}, ${pick([r2, String(ri(40))])}`; mascara = CF; } break; }
    case 13: { if (s === 1) { ins = pick(['daa', 'das', 'aaa', 'aas', 'aam', 'aad', 'cbw', 'cwd', 'cwde', 'cdq', 'lahf', 'sahf', 'cmc', 'stc', 'clc']); mascara = { daa: TODOS & ~OF, das: TODOS & ~OF, aaa: AF | CF, aas: AF | CF, aam: SF | ZF | PF, aad: SF | ZF | PF }[ins] || TODOS; } else { ins = `${pick(['bsf', 'bsr'])} ${r1}, ${r2}`; ins = `or ${r2}, 1\n` + ins; mascara = ZF; } break; }
    case 14: { if (s === 1) { ins = `xchg ${r1}, ${r2}`; } else ins = `shl${pick(['d', 'd'])} ${r1}, ${r2}, ${ri(s * 8)}`.replace('shld', pick(['shld', 'shrd'])); if (/sh[lr]d/.test(ins)) { mascara &= ~(AF | OF); const n = +ins.split(',').pop(); if (n === 0) mascara = TODOS; } break; }
    case 15: { if (s === 1) ins = `lea ${pick(R[2])}, [${bits === 16 ? 'bx+si+' + ri(300) : 'ebx+esi*4+' + ri(300)}]`; else ins = `lea ${r1}, [${pick(R[4])}+${pick(R[4])}*${pick([1, 2, 4, 8])}+${ri(1000) - 500}]`; break; }
    case 16: { const op = pick(['inc', 'dec', 'neg', 'not', 'shl', 'sar']); ins = `${op} ${memOp()}${/sh|sa/.test(op) ? ', 1' : ''}`; if (/sh|sa/.test(op)) mascara &= ~AF; break; }
    case 17: { ins = `push ${pick(R[s === 1 ? 2 : s])}\npop ${pick(R[s === 1 ? 2 : s])}`; break; }
    case 18: { ins = `xchg ${memOp()}, ${r1}`; break; }
    case 19: { const cc = pick(['o', 'no', 'b', 'ae', 'e', 'ne', 'be', 'a', 's', 'ns', 'p', 'np', 'l', 'ge', 'le', 'g']); const k = ++rotulos; ins = `mov ${pick(R[2])}, 1\nj${cc} .k${k}\nmov ax, 2\n.k${k}:`; break; }
    case 20: { ins = pick(['pushf\npop ax', 'clc\nrcl eax, 1', 'stc\nsbb ecx, edx', 'std\ncld', `cmp ${r1}, ${r2}\nset${pick(['l', 'g', 'b', 'a'])} dl`]); break; }
    case 21: { ins = `mov ecx, 4\n.q${ri(1e9)}: add eax, ecx\nloop $-3`; const k = ++rotulos; ins = `mov ecx, ${1 + ri(5)}\n.v${k}: add eax, ecx\ndec ecx\njnz .v${k}`; break; }
  }
  return { ins, mascara, mem };
}

function gerarImagem(bits) {
  const testes = [];
  const linhas = [];
  for (let i = 0; i < QTD; i++) {
    const t = gerarTeste(bits);
    testes.push(t);
    const regs = ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
    for (const r of regs) linhas.push(`mov ${r}, 0x${valor().toString(16)}`);
    if (t.mem || /\[/.test(t.ins)) {
      if (bits === 16) linhas.push('mov ebx, area', 'mov esi, 8', 'mov edi, area+16', 'mov ebp, area');
      else linhas.push('mov ebx, area', 'mov esi, 8', 'mov edi, area+16');
      linhas.push(`mov dword [area], 0x${valor().toString(16)}`, `mov dword [area+4], 0x${valor().toString(16)}`, `mov dword [area+8], 0x${valor().toString(16)}`, `mov dword [area+16], 0x${valor().toString(16)}`, `mov dword [area+20], 0x${valor().toString(16)}`, `mov dword [area+24], 0x${valor().toString(16)}`);
    }
    linhas.push(`push dword 0x${(valor() & 0x8D5 | 2).toString(16)}`, 'popfd');
    linhas.push(...t.ins.split('\n'));
    linhas.push('call despeja');
  }
  const corpo = linhas.join('\n');
  const despeja = bits === 16 ? `
despeja:
  pushfd
  pushad
  mov bp, sp
  mov si, 0
.l: mov al, [ss:bp+si]
  out 0xe9, al
  inc si
  cmp si, 36
  jb .l
  mov eax, [area]
  call .d
  mov eax, [area+16]
  call .d
  popad
  popfd
  ret
.d: mov cx, 4
.m: out 0xe9, al
  shr eax, 8
  loop .m
  ret` : `
despeja:
  pushfd
  pushad
  mov esi, 0
.l: mov al, [esp+esi]
  out 0xe9, al
  inc esi
  cmp esi, 36
  jb .l
  mov eax, [area]
  call .d
  mov eax, [area+16]
  call .d
  popad
  popfd
  ret
.d: mov ecx, 4
.m: out 0xe9, al
  shr eax, 8
  loop .m
  ret`;
  const src = `;### ARQUIVO boot.asm
org 0x7c00
bits 16
  cli
  xor ax, ax
  mov ds, ax
  mov ss, ax
  mov sp, 0x7000
  mov si, dap
  mov ah, 0x42
  int 0x13
  mov ah, 0x42
  mov si, dap2
  int 0x13
${bits === 16 ? `  mov ax, 0x1000
  mov ds, ax
  mov es, ax
  mov ss, ax
  mov sp, 0xF000
  jmp 0x1000:0` : `  in al, 0x92
  or al, 2
  out 0x92, al
  lgdt [gdtr]
  mov eax, cr0
  or eax, 1
  mov cr0, eax
  jmp 0x08:pm
bits 32
pm: mov ax, 0x10
  mov ds, ax
  mov es, ax
  mov ss, ax
  mov esp, 0x90000
  jmp 0x10000`}
align 8
gdt: dq 0
  dq 0x00CF9A000000FFFF
  dq 0x00CF92000000FFFF
gdtr: dw 23
  dd gdt
dap: db 16, 0
  dw 64, 0, 0x1000
  dd 1, 0
dap2: db 16, 0
  dw 64, 0, 0x1800
  dd 65, 0
times 510-($-$$) db 0
dw 0xAA55
;### ARQUIVO teste.asm
bits ${bits}
org ${bits === 16 ? 0 : 0x10000}
${corpo}
  mov al, 0
  out 0xf4, al
  hlt
${despeja}
align 16
area: times 64 db 0
`;
  return { src, testes };
}

function compara(bits) {
  const { src, testes } = gerarImagem(bits);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'difer386-'));
  // monta com o NASM de verdade e com o do curso: os bytes precisam bater
  const partes = src.split(/^;### ARQUIVO .*$/m).slice(1);
  const nasmBins = partes.map((p, i) => { const f = path.join(tmp, 'p' + i + '.asm'); fs.writeFileSync(f, p); execFileSync('nasm', ['-f', 'bin', f, '-o', f + '.bin']); return fs.readFileSync(f + '.bin'); });
  const meu = N.montarDisco(src);
  if (!meu.ok) { console.log(meu.erros.slice(0, 5)); process.exit(1); }
  const img = Buffer.alloc(2 * 1024 * 1024);
  let p = 0;
  for (const b of nasmBins) { b.copy(img, p); p += Math.ceil(b.length / 512) * 512; }
  for (let i = 0; i < meu.arquivos.length; i++) if (!Buffer.from(meu.arquivos[i].bytes).equals(nasmBins[i])) {
    const x = Buffer.from(meu.arquivos[i].bytes), y = nasmBins[i];
    let k = 0; while (x[k] === y[k]) k++;
    const l = meu.listagem.find(l => l.arquivo === meu.arquivos[i].nome && k + meu.arquivos[i].org >= l.end && k + meu.arquivos[i].org < l.end + l.tam);
    console.log('montador difere do NASM no arquivo', i, 'byte', k, l ? src.split('\n')[l.linha - 1] : '', x.subarray(k - 2, k + 6).toString('hex'), y.subarray(k - 2, k + 6).toString('hex'));
  }
  if (bits === 16 && nasmBins[1].length > 0xF000) { console.log('código de 16 bits grande demais (' + nasmBins[1].length + ' bytes): use menos testes'); process.exit(1); }
  if (p > 129 * 512) { console.log('imagem grande demais:', p); process.exit(1); }
  const fImg = path.join(tmp, 'disco.img'); fs.writeFileSync(fImg, img);
  const fOut = path.join(tmp, 'saida.bin');
  try { execFileSync('qemu-system-i386', ['-drive', 'file=' + fImg + ',format=raw', '-debugcon', 'file:' + fOut, '-display', 'none', '-no-reboot', '-device', 'isa-debug-exit,iobase=0xf4,iosize=0x04', '-m', '16'], { timeout: 60000 }); } catch (e) { /* isa-debug-exit sai com código != 0 */ }
  const q = fs.readFileSync(fOut);
  const m = new M.Maquina({ memoria: 16 * 1024 * 1024 });
  m.carregar(img.subarray(0, 512), { modo: 'boot', disco: img });
  m.executar(50000000);
  const sim = Buffer.from(m.saida, 'latin1');
  const T = 44;
  let dif = 0;
  const nomes = ['EDI', 'ESI', 'EBP', 'ESP', 'EBX', 'EDX', 'ECX', 'EAX', 'EFLAGS', 'mem0', 'mem16'];
  for (let i = 0; i < testes.length; i++) {
    const a = q.subarray(i * T, i * T + T), b = sim.subarray(i * T, i * T + T);
    if (a.length < T || b.length < T) { console.log('teste', i, 'sem saída (qemu ' + a.length + ', simulador ' + b.length + ')', m.status, m.motivo, testes[i].ins); dif++; break; }
    for (let k = 0; k < 11; k++) {
      let x = a.readUInt32LE(k * 4), y = b.readUInt32LE(k * 4);
      if (k === 8) { x &= testes[i].mascara | 0x700; y &= testes[i].mascara | 0x700; }
      if (k === 3) continue;
      if (x !== y) { dif++; if (dif <= 12) console.log(`bits ${bits} teste ${i}: ${testes[i].ins.replace(/\n/g, ' ; ')}  ${nomes[k]} qemu=${x.toString(16)} sim=${y.toString(16)}`); }
    }
  }
  console.log(`bits ${bits}: ${testes.length} testes, ${dif} diferenças`);
  fs.rmSync(tmp, { recursive: true, force: true });
  return dif;
}
let total = 0;
total += compara(16);
total += compara(32);
process.exit(total ? 1 : 0);
