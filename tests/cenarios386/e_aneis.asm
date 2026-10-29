; anéis de privilégio: TSS com a pilha do anel 0, IRET para o anel 3, chamada de sistema
; pela INT 30h, porta de chamada com parâmetro, #GP de instrução privilegiada, IOPL e mapa de E/S
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
  ; IDT: 13 (#GP), 14 (#PF) e 30h (chamada de sistema, DPL 3)
  mov eax, gp
  mov ebx, 13
  mov dx, 0x8E00
  call porta
  mov eax, sistema
  mov ebx, 0x30
  mov dx, 0xEE00
  call porta
  lidt [idtr]
  ; descritor da TSS
  mov eax, tss
  mov [gdt_tss+2], ax
  shr eax, 16
  mov [gdt_tss+4], al
  mov [gdt_tss+7], ah
  ; porta de chamada 38h -> servico, 1 parâmetro, DPL 3
  mov eax, servico
  mov [gdt_cg], ax
  shr eax, 16
  mov [gdt_cg+6], ax
  mov dword [tss+4], 0x6000          ; ESP0
  mov dword [tss+8], 0x10            ; SS0
  mov word [tss+102], iomapa - tss   ; mapa de E/S
  mov ax, 0x28
  ltr ax
  str ax
  X32 eax, 4
  T32 'anel 0', 10
  ; IRET para o anel 3: SS, ESP, EFLAGS, CS, EIP
  push dword 0x23
  push dword 0x5000
  push dword 0x0002                  ; IOPL 0, IF 0
  push dword 0x1B
  push dword anel3
  iretd

anel3:
  mov ax, 0x23
  mov ds, ax
  mov es, ax
  mov esi, msg3
  mov eax, 1
  int 0x30                           ; escreve a mensagem
  mov eax, cs
  mov ebx, eax
  mov eax, 2
  int 0x30                           ; escreve EBX
  mov al, 'E'
  out 0xe9, al                       ; permitido pelo mapa de E/S
  mov al, 10
  out 0xe9, al
  push dword 0x1234
  call 0x33:0                        ; porta de chamada (RPL 3)
  mov ebx, eax
  mov eax, 2
  int 0x30
  mov ebx, esp
  mov eax, 2
  int 0x30
  mov dword [volta], r1
  cli                                ; #GP: IOPL 0
r1:
  mov dword [volta], r2
  out 0x80, al                       ; #GP: porta 80h fora do mapa
r2:
  mov dword [volta], r3
  mov eax, cr0                       ; #GP: só no anel 0
r3:
  mov dword [volta], r4
  mov eax, [0x80000000]              ; #GP(0): além do limite do segmento do anel 3
r4:
  mov dword [volta], r5
  mov ax, 0x10
  mov ds, ax                         ; #GP(10h): DPL 0 < CPL 3
r5:
  mov dword [volta], r6
  int 0x31                           ; #GP(18Ah): porta com DPL 0
r6:
  mov eax, 3
  int 0x30                           ; volta ao anel 0 e termina

; ---- anel 0 ----
sistema:
  push ds
  push ebp
  mov bp, 0x10
  mov ds, bp
  cmp eax, 1
  jne .n2
  mov ebp, esi
.l:
  mov al, [ebp]
  inc ebp
  test al, al
  jz .fim
  out 0xe9, al
  jmp .l
.n2:
  cmp eax, 2
  jne .n3
  X32 ebx, 8
  jmp .fim
.n3:
  T32 10, 'sistema: ESP0 '
  mov eax, esp
  X32 eax, 8
  mov ebp, esp
  X32 [ebp+12], 4                    ; CS do anel 3 empilhado
  X32 [ebp+24], 4                    ; SS do anel 3
  X32 [ebp+20], 8                    ; ESP do anel 3
  T32 10, 'fim'
  FIM
.fim:
  pop ebp
  pop ds
  iretd

servico:                             ; pela porta de chamada: anel 0, parâmetro copiado
  mov eax, cs
  shl eax, 16
  mov ax, [esp+8]                    ; o parâmetro
  retf 4

gp:
  push ebp
  mov ebp, esp
  push ds
  push eax
  mov ax, 0x10
  mov ds, ax
  T32 '#GP '
  X32 [ebp+4], 4
  mov eax, [volta]
  mov [ebp+8], eax
  pop eax
  pop ds
  pop ebp
  add esp, 4
  iretd

; EAX = endereço, EBX = vetor, DX = tipo
porta:
  mov [idt+ebx*8], ax
  mov word [idt+ebx*8+2], 0x08
  mov [idt+ebx*8+4], dx
  shr eax, 16
  mov [idt+ebx*8+6], ax
  ret

  ROTINAS32
msg3: db 'anel 3: ', 0
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF          ; 08 código anel 0
  dq 0x00CF92000000FFFF          ; 10 dados anel 0
  dq 0x00C7FA000000FFFF          ; 18 código anel 3, limite 7FFFFh páginas (até 7FFFFFFFh)
  dq 0x00C7F2000000FFFF          ; 20 dados anel 3
gdt_tss:
  dq 0x0000890000000000 + (tss_fim - tss - 1)  ; 28 TSS de 32 bits
gdt_cg:
  dq 0x0000EC0100080000          ; 30 porta de chamada, DPL 3, 1 parâmetro -> 08:servico
  dq 0
gdtr:
  dw gdtr - gdt - 1
  dd gdt
idtr:
  dw 0x32*8 - 1
  dd idt
volta: dd 0
align 4
tss: times 104 db 0
iomapa:
  times 0xE9/8 db 0xFF
  db ~(1 << (0xE9 % 8)) & 0xFF   ; porta E9h liberada
  times 8 db 0xFF
  db 0xFF
tss_fim:
align 8
idt: times 0x32*8 db 0
