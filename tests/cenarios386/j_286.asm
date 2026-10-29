; o jeito do 286: LMSW para entrar no modo protegido de 16 bits, descritores de 286
; (os dois bytes de cima zerados), a pilha e os segmentos de 64 KB. As macros de saída usam EAX (386).
  cli
  lgdt [gdtr]
  smsw ax
  or ax, 1
  lmsw ax                    ; o 286 entra assim; voltar ao modo real só com reset
  jmp 0x08:pm16
pm16:
  mov ax, 0x10
  mov ds, ax
  mov es, ax
  mov ax, 0x18
  mov ss, ax
  mov sp, 0x0800
  T16 'pm16 286', 10
  smsw ax
  X16 eax, 4
  mov word [es:0], 0x1234
  push word [es:0]
  pop bx
  X16 ebx, 4
  ; ES com base 20000h (limite FFFFh)
  mov ax, 0x20
  mov es, ax
  mov word [es:0xFFFE], 0xBEEF
  mov bx, [es:0xFFFE]
  X16 ebx, 4
  mov ax, 0x10
  mov es, ax
  mov bx, [0xFFFE]           ; DS tem base 0: outro lugar
  X16 ebx, 4
  ; LMSW não desliga o PE: continua no modo protegido
  smsw ax
  and ax, 0xFFFE
  lmsw ax
  smsw ax
  X16 eax, 4
  T16 10, 'fim'
  FIM
  ROTINAS16
align 8
gdt:
  dq 0
  dq 0x00009A000000FFFF      ; 08 código, base 0, 64 KB
  dq 0x000092000000FFFF      ; 10 dados, base 0, 64 KB
  dq 0x0000920700000FFF      ; 18 pilha, base 70000h, 4 KB
  dq 0x000092020000FFFF      ; 20 dados, base 20000h
gdtr:
  dw gdtr - gdt - 1
  dd gdt
