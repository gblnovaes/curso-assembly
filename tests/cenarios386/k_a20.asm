; a linha A20: com ela desligada, FFFF:0510 (100500h) dá a volta para 0000:0500
  cli
  T16 'a20', 10
  ; desliga pela porta 92h (o "A20 rápido")
  in al, 0x92
  and al, 0xFC
  out 0x92, al
  in al, 0x92
  movzx eax, al
  and al, 2
  X16 eax, 2
  call testar
  ; liga pelo controlador do teclado: comando D1h, depois o byte da porta de saída
  call esperar
  mov al, 0xD1
  out 0x64, al
  call esperar
  mov al, 0xDF
  out 0x60, al
  call esperar
  ; lê a porta de saída (comando D0h)
  mov al, 0xD0
  out 0x64, al
le_saida:
  in al, 0x64
  test al, 1
  jz le_saida
  in al, 0x60
  and eax, 2
  X16 eax, 2
  call testar
  ; desliga pela BIOS (INT 15h AX=2400h) e pergunta (2402h)
  mov ax, 0x2400
  int 0x15
  mov ax, 0x2402
  int 0x15
  movzx eax, al
  X16 eax, 2
  call testar
  mov ax, 0x2401
  int 0x15
  mov ax, 0x2402
  int 0x15
  movzx eax, al
  X16 eax, 2
  call testar
  T16 'fim'
  FIM

; escreve em FFFF:0510 e confere se 0000:0500 mudou
testar:
  push ds
  push es
  xor ax, ax
  mov ds, ax
  mov ax, 0xFFFF
  mov es, ax
  mov byte [0x500], 0x11
  mov byte [es:0x510], 0x22
  cmp byte [0x500], 0x22
  je .volta
  T16 'separados', 10
  jmp .f
.volta:
  T16 'deu a volta', 10
.f:
  pop es
  pop ds
  ret

esperar:
  in al, 0x64
  test al, 2
  jnz esperar
  ret

  ROTINAS16
