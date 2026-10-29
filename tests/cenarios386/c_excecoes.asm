; IDT com as exceções 0 a 17: cada uma mostra o vetor, o código de erro e onde aconteceu
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
  ; monta a IDT: vetor v -> stub v
  xor ecx, ecx
.idt:
  mov eax, ecx
  imul eax, eax, stub1 - stub0
  add eax, stub0
  mov [idt+ecx*8], ax
  mov word [idt+ecx*8+2], 0x08
  mov word [idt+ecx*8+4], 0x8E00
  shr eax, 16
  mov [idt+ecx*8+6], ax
  inc ecx
  cmp ecx, 32
  jb .idt
  lidt [idtr]
  T32 'idt ok', 10

  mov dword [volta], t1
  xor edx, edx
  mov eax, 1
  xor ebx, ebx
  div ebx                    ; #DE
t1:
  mov dword [volta], t2
  mov eax, 0x80000000
  cdq
  mov ebx, -1
  idiv ebx                   ; #DE (quociente não cabe)
t2:
  mov dword [volta], t3
  mov ax, 0x40
  mov ds, ax                 ; #GP(40h): além do limite da GDT
t3:
  mov dword [volta], t4
  mov ax, 0x18
  mov ds, ax                 ; #NP(18h): descritor não presente
t4:
  mov dword [volta], t5
  mov ax, 0x08
  mov ds, ax                 ; código não pode ser lido? este é legível: carrega
  mov ax, 0x10
  mov ds, ax
  mov dword [cs:t5], 0       ; #GP(0): escrever no segmento de código
t5:
  mov dword [volta], t6
  int3                       ; #BP: armadilha, EIP já depois do INT3
t6:
  mov dword [volta], t7
  mov al, 0x7F
  add al, 1                  ; OF = 1
  into                       ; #OF
t7:
  mov dword [volta], t8
  mov eax, 50
  bound eax, [limites]       ; #BR
t8:
  mov dword [volta], t9
  db 0x8E, 0xC8              ; mov cs, ax: #UD
t9:
  mov dword [volta], t10
  mov ax, 0x20
  mov ss, ax                 ; #GP(20h): SS precisa ser dados com escrita
t10:
  mov dword [volta], t11
  mov ax, 0x28
  mov es, ax                 ; segmento pequeno (limite 0xFF)
  mov eax, [es:0x100]        ; #GP(0): além do limite
t11:
  mov dword [volta], t12
  int 0x40                   ; #GP(0x202): vetor além do limite da IDT
t12:
  mov dword [volta], t13
  mov ax, 0x33               ; seletor com RPL 3 em SS no anel 0
  mov ss, ax                 ; #GP(30h)
t13:
  mov ax, 0x10
  mov ss, ax
  mov esp, 0x7000
  mov dword [volta], t14
  mov eax, cr0
  or al, 8                   ; TS = 1
  mov cr0, eax
  mov ax, 0
  mov ds, ax                 ; nulo em DS é permitido
  mov eax, [0]               ; #GP(0): usar o seletor nulo
t14:
  mov ax, 0x10
  mov ds, ax
  clts
  mov eax, cr0
  X32 eax, 8
  T32 10, 'fim', 10
  FIM

; stubs: os vetores com código de erro (8, 10-14, 17) já o têm na pilha
%assign v 0
%rep 32
%if v == 8 || (v >= 10 && v <= 14) || v == 17
  align 16
stub %+ v:
  push dword v
  jmp comum
%else
  align 16
stub %+ v:
  push dword 0
  push dword v
  jmp comum
%endif
%assign v v+1
%endrep

comum:
  push ebp
  mov ebp, esp
  push ds
  push eax
  mov ax, 0x10
  mov ds, ax
  T32 'V'
  X32 [ebp+4], 2
  T32 'E'
  X32 [ebp+8], 4
  mov eax, [ebp+12]
  sub eax, pm32
  T32 '@'
  X32 eax, 4
  T32 '|'
  mov eax, [volta]
  mov [ebp+12], eax
  pop eax
  pop ds
  pop ebp
  add esp, 8
  iretd

  ROTINAS32
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF        ; 08 código
  dq 0x00CF92000000FFFF        ; 10 dados
  dq 0x00CF12000000FFFF        ; 18 dados, ausente (P = 0)
  dq 0x00CF9A000000FFFF        ; 20 código (não serve de pilha)
  dq 0x00409200000000FF        ; 28 dados, limite 0xFF
  dq 0x0040920000000FFF        ; 30 dados, limite 0xFFF
gdtr:
  dw gdtr - gdt - 1
  dd gdt
idtr:
  dw 32*8 - 1
  dd idt
volta: dd 0
limites: dd 0, 10
align 8
idt: times 32*8 db 0
