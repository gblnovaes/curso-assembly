// Gera o corpus de instruções usado em tests/nasm.test.js (montador do curso x NASM de verdade).
// Uso: node tools/corpus-nasm.js > tests/nasm-corpus.asm
const L = [];
const out = (s) => L.push(s);
const R8 = ['al', 'cl', 'dh', 'bh'], R16 = ['ax', 'cx', 'bx', 'sp', 'bp', 'si', 'di'], R32 = ['eax', 'ecx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const M16 = ['[bx]', '[bp]', '[si]', '[di]', '[bx+si]', '[bx+di]', '[bp+si]', '[bp+di+4]', '[bx+127]', '[bx+128]', '[bp-128]', '[bp-129]', '[si+0x1234]', '[0x1234]', '[es:bx]', '[cs:0x10]', '[ss:bp+2]', '[dados]', '[dados+bx]'];
const M32 = ['[eax]', '[ebp]', '[esp]', '[esp+4]', '[ebp-4]', '[eax+ecx]', '[eax+esp]', '[ebx+ecx*2]', '[ebx+esi*4+8]', '[edi*8+0x100]', '[ecx*2]', '[edx*1]', '[eax+ebx*8-200]', '[ebp+edi*4]', '[0x12345678]', '[fs:eax]', '[gs:0x10]', '[dados]', '[ebx+dados]', '[esi+1000]'];
const imms = ['0', '1', '-1', '127', '128', '-128', '-129', '255', '0x1234', '-300'];
for (const bits of [16, 32]) {
  out('bits ' + bits);
  out('cpu 586');
  const M = bits === 16 ? M16.concat(['[eax]', '[ebx+ecx*4]']) : M32.concat(['[bx]', '[bp+si+2]']);
  for (const op of ['add', 'or', 'adc', 'sbb', 'and', 'sub', 'xor', 'cmp', 'mov', 'test']) {
    for (const [rs, sz] of [[R8, 'byte'], [R16, 'word'], [R32, 'dword']]) {
      out(`${op} ${rs[0]}, ${rs[1]}`); out(`${op} ${rs[2]}, ${rs[0]}`);
      for (const m of M.slice(0, 8)) { out(`${op} ${rs[1]}, ${m}`); out(`${op} ${m}, ${rs[2]}`); }
      for (const i of imms) { if (sz === 'byte' && (+i > 255 || +i < -128 || i === '0x1234' || i === '-300')) continue; out(`${op} ${rs[0]}, ${i}`); out(`${op} ${rs[1]}, ${i}`); out(`${op} ${sz} ${M[3]}, ${i}`); }
    }
    out(`${op} al, [dados]`); out(`${op} ax, [dados]`); out(`${op} eax, [dados]`); out(`${op} [dados], al`); out(`${op} [dados], eax`);
  }
  for (const m of M) { out('lea ax, ' + m); out('lea eax, ' + m); out('mov [dados], ax'); out('mov ' + m.replace('[', 'dword [') + ', 7'); }
  for (const s of ['es', 'cs', 'ss', 'ds', 'fs', 'gs']) { out('mov ax, ' + s); out('mov eax, ' + s); out('mov [dados], ' + s); out('push ' + s); if (s !== 'cs') { out('mov ' + s + ', ax'); out('mov ' + s + ', [dados]'); out('pop ' + s); } }
  for (const c of ['cr0', 'cr2', 'cr3']) { out('mov eax, ' + c); out('mov ' + c + ', ebx'); }
  out('mov eax, dr7'); out('mov dr0, ecx');
  for (const op of ['inc', 'dec', 'not', 'neg', 'mul', 'div', 'idiv', 'imul']) { for (const r of ['al', 'bh', 'cx', 'si', 'eax', 'edi']) out(`${op} ${r}`); out(`${op} byte [dados]`); out(`${op} word [bx]`); out(`${op} dword [ebx+4]`); }
  out('imul ax, bx'); out('imul eax, [dados]'); out('imul cx, dx, 5'); out('imul cx, dx, 500'); out('imul eax, 10'); out('imul esi, [ebx], -3');
  for (const op of ['rol', 'ror', 'rcl', 'rcr', 'shl', 'sal', 'shr', 'sar']) { out(`${op} al, 1`); out(`${op} bx, cl`); out(`${op} ecx, 4`); out(`${op} word [dados], 1`); out(`${op} byte [bx], cl`); out(`${op} dword [eax], 31`); }
  out('shld ax, bx, 4'); out('shrd eax, edx, cl'); out('shld [dados], ecx, 1');
  for (const op of ['bt', 'bts', 'btr', 'btc']) { out(`${op} ax, bx`); out(`${op} eax, 5`); out(`${op} dword [dados], ecx`); out(`${op} word [bx], 3`); }
  out('bsf ax, bx'); out('bsr eax, [dados]');
  out('movzx ax, bl'); out('movzx eax, bx'); out('movzx eax, byte [dados]'); out('movzx ecx, word [ebx]'); out('movsx ax, al'); out('movsx edx, word [si]');
  for (const cc of ['o', 'no', 'b', 'ae', 'e', 'ne', 'be', 'a', 's', 'ns', 'p', 'np', 'l', 'ge', 'le', 'g', 'c', 'z', 'nz']) { out(`set${cc} al`); out(`set${cc} byte [dados]`); }
  for (const r of ['ax', 'bx', 'eax', 'ebp']) { out('push ' + r); out('pop ' + r); }
  out('push word [dados]'); out('push dword [dados]'); out('pop word [bx]'); out('pop dword [eax]');
  for (const i of ['0', '5', '-5', '127', '128', '0x1234', '-1']) { out('push ' + i); out('push word ' + i); out('push dword ' + i); }
  out('push dados');
  for (const x of ['pusha', 'popa', 'pushad', 'popad', 'pushaw', 'popaw', 'pushf', 'popf', 'pushfd', 'popfd', 'iret', 'iretd', 'iretw', 'leave', 'clts', 'cbw', 'cwde', 'cwd', 'cdq', 'nop', 'hlt', 'cli', 'sti', 'cld', 'std', 'clc', 'stc', 'cmc', 'lahf', 'sahf', 'int3', 'into', 'xlatb', 'aaa', 'aas', 'daa', 'das', 'aam', 'aad', 'cpuid', 'wbinvd', 'invd'])
    out(x);
  for (const x of ['movsb', 'movsw', 'movsd', 'cmpsb', 'cmpsw', 'cmpsd', 'stosb', 'stosw', 'stosd', 'lodsb', 'lodsw', 'lodsd', 'scasb', 'scasw', 'scasd', 'insb', 'insw', 'insd', 'outsb', 'outsw', 'outsd']) { out(x); out('rep ' + x); }
  out('repne scasb'); out('repe cmpsw');
  out('xchg ax, bx'); out('xchg bx, ax'); out('xchg cx, dx'); out('xchg al, ah'); out('xchg eax, esi'); out('xchg [dados], bx'); out('xchg ecx, [ebx]');
  out('lds si, [dados]'); out('les di, [bx]'); out('lss esp, [dados]'); out('lfs ax, [dados]'); out('lgs ebx, [eax]');
  out('enter 16, 0'); out('enter 8, 1'); out('bound ax, [dados]'); out('bound eax, [ebx]');
  out('in al, 0x60'); out('in ax, dx'); out('in eax, dx'); out('out 0x20, al'); out('out dx, ax'); out('out dx, eax');
  out('int 0x10'); out('int 3'); out('ret'); out('ret 4'); out('retf'); out('retf 8');
  out('lgdt [dados]'); out('lidt [ebx]'); out('sgdt [dados]'); out('sidt [bx]'); out('lmsw ax'); out('smsw ax'); out('smsw [dados]'); out('lldt ax'); out('sldt [dados]'); out('ltr bx'); out('str ax'); out('verr ax'); out('verw [dados]');
  out('lar ax, bx'); out('lsl eax, [dados]'); out('arpl [dados], ax'); out('invlpg [eax]'); out('bswap eax'); out('cmpxchg [dados], ecx'); out('xadd al, bl');
  out('jmp 0x08:0x1000'); out('jmp dword 0x08:0x12345'); out('call 0x1000:0x20'); out('jmp ax'); out('jmp eax'); out('jmp [dados]'); out('jmp word [bx]'); out('jmp dword [ebx]'); out('call bx'); out('call [dados]'); out('call far [dados]'); out('jmp far [bx]');
  out('alvo' + bits + ':');
  out(`loop alvo${bits}`); out(`loope alvo${bits}`); out(`loopne alvo${bits}`); out(`jcxz alvo${bits}`); out(`jecxz alvo${bits}`); out(`jmp short alvo${bits}`);
  for (const cc of ['o', 'b', 'e', 'ne', 'a', 'l', 'g', 'z', 'c']) { out(`j${cc} alvo${bits}`); out(`j${cc} longe${bits}`); out(`j${cc} near alvo${bits}`); }
  out(`jmp alvo${bits}`); out(`jmp longe${bits}`); out(`jmp near alvo${bits}`); out(`call alvo${bits}`); out(`call longe${bits}`);
  out('times 200 nop');
  out('longe' + bits + ':');
  out(`jmp $`); out(`jmp $+2`); out(`jnz $-10`);
}
out('dados: dw 0x1234, 5');
out('db 1, 2, "texto", 0, \'x\'');
out('dd 0x12345678, dados, dados+4');
out('dw "ab", "c"');
out('dq 0x00CF9A000000FFFF');
out('align 16');
out('align 8, db 0');
out('resb 3');
out('times 4 db 0xAA');
out('meio equ $ - dados');
out('dw meio');
out('struc PONTO');
out('.x: resw 1');
out('.y: resw 1');
out('endstruc');
out('mov ax, PONTO.y');
out('mov ax, PONTO_size');
out('mov ax, [bx+PONTO.y]');
out('%macro somar 2');
out('  add %1, %2');
out('%%aqui: jmp %%aqui');
out('%endmacro');
out('somar ax, 5');
out('somar ebx, ecx');
out('%assign i 0');
out('%rep 4');
out('  db i * 3');
out('%assign i i + 1');
out('%endrep');
out('%define PORTA 0x3F8');
out('mov dx, PORTA + 5');
out('principal:');
out('.laco: dec cx');
out('jnz .laco');
out('outro:');
out('.laco: jmp .laco');
out('jmp principal.laco');
console.log(L.join('\n'));
