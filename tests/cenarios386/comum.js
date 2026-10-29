// Moldura dos cenários de sistema da máquina 386 (tests/cenarios386/*.asm).
// Cada cenário começa no modo real, em 0000:8000h, carregado por um setor de boot
// comum (INT 13h AH=42h). Tudo o que ele escreve na porta E9h é comparado com o QEMU.
// Macros: T16/T32 'texto' (escreve o texto), X16/X32 valor, dígitos (escreve em hexa),
// FIM (escreve ~~ e desliga o PC). ROTINAS16 e ROTINAS32 põem as rotinas de 16 e de 32 bits no código.
const BOOT = `;### ARQUIVO boot.bin
bits 16
org 0x7c00
  cli
  xor ax, ax
  mov ds, ax
  mov es, ax
  mov ss, ax
  mov sp, 0x7c00
  mov si, dap
  mov ah, 0x42
  int 0x13
  jc .erro
  jmp 0:0x8000
.erro:
  mov al, '!'
  out 0xe9, al
  out 0xf4, al
  hlt
dap: db 16, 0
  dw 64
  dw 0x8000, 0
  dd 1, 0
times 510-($-$$) db 0
dw 0xaa55
;### ARQUIVO prog.bin
`;

const MACROS = `%macro T16 1+
  call _txt16
  db %1, 0
%endmacro
%macro T32 1+
  call _txt32
  db %1, 0
%endmacro
%macro X16 2
  push eax
  push cx
  mov eax, %1
  mov cl, %2
  call _hex16
  pop cx
  pop eax
%endmacro
%macro X32 2
  push eax
  push ecx
  mov eax, %1
  mov cl, %2
  call _hex32
  pop ecx
  pop eax
%endmacro
%macro FIM 0
  mov al, '~'
  out 0xe9, al
  out 0xe9, al
  mov al, 0
  out 0xf4, al
  cli
  hlt
%endmacro
%macro ROTINAS16 0
_txt16:
  push bp
  mov bp, sp
  push si
  push ax
  mov si, [bp+2]
.l:
  cs lodsb
  test al, al
  jz .f
  out 0xe9, al
  jmp .l
.f:
  mov [bp+2], si
  pop ax
  pop si
  pop bp
  ret
_hex16:
  push ebx
  push dx
  mov ebx, eax
  mov dl, cl
  mov cl, 8
  sub cl, dl
  shl cl, 2
  shl ebx, cl
.d:
  rol ebx, 4
  mov al, bl
  and al, 15
  add al, '0'
  cmp al, '9'
  jbe .e
  add al, 7
.e:
  out 0xe9, al
  dec dl
  jnz .d
  mov al, ' '
  out 0xe9, al
  pop dx
  pop ebx
  ret
%endmacro
%macro ROTINAS32 0
_txt32:
  push ebp
  mov ebp, esp
  push esi
  push eax
  mov esi, [ebp+4]
.l:
  cs lodsb
  test al, al
  jz .f
  out 0xe9, al
  jmp .l
.f:
  mov [ebp+4], esi
  pop eax
  pop esi
  pop ebp
  ret
_hex32:
  push ebx
  push edx
  mov ebx, eax
  mov dl, cl
  mov cl, 8
  sub cl, dl
  shl cl, 2
  shl ebx, cl
.d:
  rol ebx, 4
  mov al, bl
  and al, 15
  add al, '0'
  cmp al, '9'
  jbe .e
  add al, 7
.e:
  out 0xe9, al
  dec dl
  jnz .d
  mov al, ' '
  out 0xe9, al
  pop edx
  pop ebx
  ret
%endmacro
bits 16
org 0x8000
`;

function fonte(cenario) { return BOOT + MACROS + cenario; }
module.exports = { fonte, BOOT, MACROS };
