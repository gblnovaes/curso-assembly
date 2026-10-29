; troca de tarefas por hardware: JMP para uma TSS, CALL com elo de volta e NT, IRET de volta,
; porta de tarefa na IDT, bit "ocupada" no descritor e CR0.TS
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
  ; descritores das TSS A (28h) e B (30h)
  mov eax, tssA
  mov edi, gdt + 0x28
  call base
  mov eax, tssB
  mov edi, gdt + 0x30
  call base
  ; TSS B começa em tarefaB, com pilha própria
  mov dword [tssB+32], tarefaB        ; EIP
  mov dword [tssB+36], 0x0002         ; EFLAGS
  mov dword [tssB+56], 0x5000         ; ESP
  mov dword [tssB+40], 0xB0B0B0B0     ; EAX
  mov word [tssB+72], 0x10            ; ES
  mov word [tssB+76], 0x08            ; CS
  mov word [tssB+80], 0x10            ; SS
  mov word [tssB+84], 0x10            ; DS
  mov word [tssB+88], 0x10            ; FS
  mov word [tssB+92], 0x10            ; GS
  ; IDT: vetor 40h é uma porta de tarefa para a TSS B
  mov word [idt+0x40*8+2], 0x30
  mov word [idt+0x40*8+4], 0x8500
  lidt [idtr]
  mov ax, 0x28
  ltr ax
  call tipos
  T32 'A: jmp', 10
  mov eax, 0xAAAA0001
  jmp 0x30:0                          ; troca para B
voltouA:
  T32 'A: voltou, EAX='
  X32 eax, 8
  call tipos
  mov eax, cr0
  X32 eax, 8
  clts
  T32 10, 'A: call', 10
  mov eax, 0xAAAA0002
  call 0x30:0                         ; B roda com NT = 1 e elo para A
  T32 'A: depois do call, EAX='
  X32 eax, 8
  call tipos
  T32 10, 'A: int 40h', 10
  int 0x40
  T32 'A: depois da int', 10
  call tipos
  pushfd
  pop eax
  X32 eax, 8
  T32 10, 'fim'
  FIM

tarefaB:
  T32 'B: EAX='
  X32 eax, 8
  call tipos
  pushfd
  pop eax
  X32 eax, 8
  movzx eax, word [tssB]              ; elo de volta
  X32 eax, 4
  T32 10
  cmp byte [vez], 0
  jne .iret
  inc byte [vez]
  mov eax, 0xB0B00001
  jmp 0x28:0                          ; volta para A (A não está ocupada: foi um JMP)
.iret:
  mov eax, 0xB0B00002
  iretd                               ; NT = 1: volta pelo elo
  jmp tarefaB                         ; a próxima entrada em B continua daqui

; EDI = descritor, EAX = base
base:
  mov [edi+2], ax
  shr eax, 16
  mov [edi+4], al
  mov [edi+7], ah
  ret
; escreve o tipo (byte de acesso) das duas TSS
tipos:
  T32 '['
  movzx eax, byte [gdt+0x28+5]
  X32 eax, 2
  movzx eax, byte [gdt+0x30+5]
  X32 eax, 2
  T32 '] '
  ret

  ROTINAS32
vez: db 0
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF
  dq 0x00CF92000000FFFF
  dq 0
  dq 0
  dq 0x0000890000000067               ; 28 TSS A
  dq 0x0000890000000067               ; 30 TSS B
gdtr:
  dw gdtr - gdt - 1
  dd gdt
idtr:
  dw 0x41*8 - 1
  dd idt
align 4
tssA: times 104 db 0
tssB: times 104 db 0
align 8
idt: times 0x41*8 db 0
