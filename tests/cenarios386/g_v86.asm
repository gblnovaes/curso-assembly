; modo virtual 8086: um monitor no anel 0 roda um programa de 16 bits. Com IOPL 0, INT, CLI,
; STI, PUSHF e POPF causam #GP e o monitor os emula; com IOPL 3 a INT vai direto pela IDT.
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
  mov eax, gp
  mov ebx, 13
  mov dx, 0x8E00
  call porta
  mov eax, int21
  mov ebx, 0x21
  mov dx, 0xEE00                       ; DPL 3: usada pela INT 21h do v86 com IOPL 3
  call porta
  lidt [idtr]
  mov eax, tss
  mov [gdt+0x18+2], ax
  shr eax, 16
  mov [gdt+0x18+4], al
  mov [gdt+0x18+7], ah
  mov dword [tss+4], 0x6000
  mov dword [tss+8], 0x10
  mov word [tss+102], 104              ; sem mapa de E/S
  mov ax, 0x18
  ltr ax
  T32 'monitor', 10
  ; copia o programa v86 para 2000:0000
  mov esi, prog16
  mov edi, 0x20000
  mov ecx, prog16_fim - prog16
  rep movsb
  ; primeira rodada: IOPL 0
  mov dword [eflv86], 0x00020002
  call rodar
  T32 10, 'IOPL 3', 10
  mov dword [eflv86], 0x00023002
  call rodar
  T32 10, 'fim'
  FIM

rodar:
  mov [espMonitor], esp
  push dword 0x2000                    ; GS
  push dword 0x2000                    ; FS
  push dword 0x2000                    ; DS
  push dword 0x2000                    ; ES
  push dword 0x2000                    ; SS
  push dword 0xFFFE                    ; SP
  push dword [eflv86]                  ; EFLAGS com VM = 1
  push dword 0x2000                    ; CS
  push dword 0                         ; IP
  iretd
saiuV86:
  mov ax, 0x10
  mov ds, ax
  mov es, ax
  mov esp, [espMonitor]
  ret

; #GP vindo do v86: olha a instrução em CS:IP
gp:
  push ebp
  mov ebp, esp
  push eax
  push ebx
  push esi
  push ds
  mov ax, 0x10
  mov ds, ax
  test dword [ebp+16], 0x20000         ; veio do v86?
  jz .nao
  movzx esi, word [ebp+12]             ; CS
  shl esi, 4
  movzx eax, word [ebp+8]              ; IP
  add esi, eax
  mov al, [esi]
  cmp al, 0xCD
  je .int
  cmp al, 0xFA
  je .cli
  cmp al, 0xFB
  je .sti
  cmp al, 0x9C
  je .pushf
  T32 '?op '
  X32 eax, 2
  jmp saiuV86
.int:
  mov al, [esi+1]
  add word [ebp+8], 2
  cmp al, 0x20
  je .int20
  movzx ebx, byte [ebp+20+4]           ; AH? não: os registradores gerais estão nos nossos
  mov ebx, [ebp-4]                     ; EAX salvo
  call servico21
  jmp .volta
.int20:
  T32 '[int 20h] '
  jmp saiuV86
.cli:
  T32 '[cli] '
  inc word [ebp+8]
  jmp .volta
.sti:
  T32 '[sti] '
  inc word [ebp+8]
  jmp .volta
.pushf:
  T32 '[pushf] '
  inc word [ebp+8]
  ; empilha FLAGS na pilha do v86 (SS:SP do quadro)
  movzx esi, word [ebp+24]             ; SS
  shl esi, 4
  sub word [ebp+20], 2
  movzx eax, word [ebp+20]
  add esi, eax
  mov ax, [ebp+16]
  mov [esi], ax
  jmp .volta
.nao:
  T32 '#GP fora do v86'
  FIM
.volta:
  pop ds
  pop esi
  pop ebx
  pop eax
  pop ebp
  add esp, 4
  iretd

; INT 21h direta (IOPL 3): a CPU empilha também GS, FS, DS, ES do v86 e zera os registradores
int21:
  push ebp
  mov ebp, esp
  push ds
  push eax
  mov bx, 0x10
  mov ds, bx
  mov ebx, eax
  T32 '<'
  X32 [ebp+20], 4                      ; SS do v86
  mov ax, ds
  call servico21
  mov ax, fs
  movzx eax, ax
  X32 eax, 4
  T32 '> '
  pop eax
  pop ds
  pop ebp
  iretd

; EBX = EAX do v86 (AH = função, DL = caractere em EDX)
servico21:
  push eax
  mov eax, ebx
  shr eax, 8
  cmp al, 2
  jne .f
  mov al, dl
  out 0xe9, al
.f:
  pop eax
  ret

porta:
  mov [idt+ebx*8], ax
  mov word [idt+ebx*8+2], 0x08
  mov [idt+ebx*8+4], dx
  shr eax, 16
  mov [idt+ebx*8+6], ax
  ret

  ROTINAS32

; ---- o programa de 16 bits, rodando em 2000:0000 ----
bits 16
prog16:
  mov ah, 2
  mov dl, 'v'
  int 0x21
  mov dl, '8'
  int 0x21
  mov dl, '6'
  int 0x21
  cli
  sti
  pushf
  pop ax
  mov bx, 0x1234
  mov cx, 4
.l:
  rol bx, 4
  mov dl, bl
  and dl, 15
  add dl, 'A'
  mov ah, 2
  int 0x21
  loop .l
  int 0x20
prog16_fim:

bits 32
espMonitor: dd 0
eflv86: dd 0
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF
  dq 0x00CF92000000FFFF
  dq 0x0000890000000067
gdtr:
  dw gdtr - gdt - 1
  dd gdt
idtr:
  dw 0x22*8 - 1
  dd idt
align 4
tss: times 104 db 0
align 8
idt: times 0x22*8 db 0
