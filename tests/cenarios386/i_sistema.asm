; LDT, LAR, LSL, VERR, VERW, ARPL, SLDT, STR, SIDT, segmento conforme e expand-down
  cli
  lgdt [gdtr]
  mov eax, cr0
  or al, 1
  mov cr0, eax
  jmp 0x08:pm32
bits 32
pm32:
  mov ax, 0x10
  mov ds, ax
  mov es, ax
  mov ss, ax
  mov esp, 0x7000
  mov eax, ldt
  mov [gdt+0x18+2], ax
  shr eax, 16
  mov [gdt+0x18+4], al
  mov [gdt+0x18+7], ah
  lidt [idtr]
  mov ax, 0x18
  lldt ax
  sldt bx
  movzx ebx, bx
  X32 ebx, 4
  str bx
  movzx ebx, bx
  X32 ebx, 4
  sidt [tmp]
  movzx eax, word [tmp]
  X32 eax, 4
  T32 10
  ; um seletor da LDT (TI = 1): 0Ch = índice 1, LDT, RPL 0
  mov ax, 0x0C
  mov fs, ax
  mov eax, [fs:0]
  X32 eax, 8
  mov ax, 0x14                ; índice 2 da LDT, além do limite
  lsl ecx, ax
  setz cl
  movzx ecx, cl
  X32 ecx, 1
  T32 10
  ; LAR / LSL / VERR / VERW para cada seletor de 0 a 40h
  xor esi, esi
.l:
  mov eax, esi
  X32 eax, 2
  xor ebx, ebx
  lar ebx, esi
  pushfd
  pop eax
  and eax, 0x40
  X32 eax, 2
  X32 ebx, 8
  mov ecx, 0x77777777
  lsl ecx, esi
  X32 ecx, 8
  xor edx, edx
  verr si
  setz dl
  shl dl, 1
  verw si
  setz al
  or dl, al
  X32 edx, 1
  T32 10
  add esi, 8
  cmp esi, 0x48
  jb .l
  ; ARPL
  mov ax, 0x0010
  mov bx, 0x0003
  arpl ax, bx
  setz cl
  movzx eax, ax
  X32 eax, 4
  movzx ecx, cl
  X32 ecx, 1
  mov ax, 0x0013
  arpl ax, bx
  setz cl
  movzx ecx, cl
  X32 ecx, 1
  T32 10
  ; expand-down: limite 0FFFh, então 1000h..FFFFFh valem (B = 0, até FFFFh)
  mov ax, 0x30
  mov gs, ax
  mov dword [volta], e1
  mov eax, [gs:0x1000]
  T32 'ok1 '
  mov eax, [gs:0xFFFC]
  T32 'ok2 '
  mov eax, [gs:0x0FFF]        ; #GP: abaixo do limite
e1:
  mov dword [volta], e2
  mov eax, [gs:0xFFFE]        ; #GP: passa de FFFFh
e2:
  ; código conforme (DPL 0) chamado por JMP: CPL continua
  jmp 0x38:conforme
conforme:
  mov eax, cs
  X32 eax, 4
  T32 10, 'fim'
  FIM

gp:
  push ebp
  mov ebp, esp
  T32 '#GP '
  X32 [ebp+4], 4
  mov eax, [volta]
  mov [ebp+8], eax
  pop ebp
  add esp, 4
  iretd

  ROTINAS32
tmp: times 8 db 0
volta: dd 0
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF        ; 08 código
  dq 0x00CF92000000FFFF        ; 10 dados
  dq 0x0000820000000000 + ldt_fim - ldt - 1   ; 18 LDT
  dq 0x00CFFA000000FFFF        ; 20 código anel 3
  dq 0x0040900000001FFF        ; 28 dados só leitura
  dq 0x0000960000000FFF        ; 30 dados expand-down, 16 bits
  dq 0x00CF9E000000FFFF        ; 38 código conforme, leitura
  dq 0x00CF98000000FFFF        ; 40 código só execução
gdtr:
  dw gdtr - gdt - 1
  dd gdt
align 8
ldt:
  dq 0
  dq 0x00409200800000FF        ; LDT 1: dados, base 8000h, limite FFh
ldt_fim:
idtr:
  dw 14*8 - 1
  dd idt
align 8
idt:
  times 13*8 db 0
  dw gp, 0x08, 0x8E00, 0
