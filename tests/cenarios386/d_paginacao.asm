; paginação: identidade nos primeiros 4 MB, um apelido, #PF com CR2 e código de erro, bits A e D
DIR equ 0x100000
TAB equ 0x101000
TAB2 equ 0x102000
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
  ; IDT só com o #PF (vetor 14)
  mov eax, pf
  mov [idt+14*8], ax
  mov word [idt+14*8+2], 0x08
  mov word [idt+14*8+4], 0x8E00
  shr eax, 16
  mov [idt+14*8+6], ax
  lidt [idtr]
  ; tabela 0: identidade de 0 a 4 MB, presente + escrita
  mov edi, TAB
  mov eax, 0x003
  mov ecx, 1024
.t:
  stosd
  add eax, 0x1000
  loop .t
  ; diretório: entrada 0 -> TAB, entrada 1 (4 a 8 MB) -> TAB2, o resto ausente
  mov edi, DIR
  xor eax, eax
  mov ecx, 1024
  rep stosd
  mov dword [DIR], TAB + 3
  mov dword [DIR+4], TAB2 + 7
  mov edi, TAB2
  mov ecx, 1024
  rep stosd
  ; 0x400000 -> físico 0x300000 (usuário, escrita); 0x401000 -> 0x301000 só leitura
  mov dword [TAB2], 0x300007
  mov dword [TAB2+4], 0x301005
  mov dword [0x300000], 0x55667788
  mov eax, DIR
  mov cr3, eax
  mov eax, cr0
  or eax, 0x80000000
  mov cr0, eax
  jmp .liga
.liga:
  T32 'pg on', 10
  mov eax, cr0
  X32 eax, 8
  mov eax, [0x400000]        ; apelido de 0x300000
  X32 eax, 8
  mov dword [0x400004], 0xAABBCCDD
  mov eax, [0x300004]
  X32 eax, 8
  mov eax, [TAB2]            ; agora com A (20h) e D (40h)
  X32 eax, 8
  mov eax, [0x401000]
  mov eax, [TAB2+4]          ; só A
  X32 eax, 8
  mov eax, [DIR+4]
  X32 eax, 8
  T32 10
  ; #PF: página ausente (leitura), entrada do diretório ausente (escrita)
  mov dword [volta], p1
  mov eax, [0x402000]
p1:
  mov dword [volta], p2
  mov dword [0x900000], 1
p2:
  ; no anel 0 do 386, escrever numa página só de leitura é permitido (o WP veio no 486)
  mov dword [0x401000], 0x12345678
  mov eax, [0x301000]
  X32 eax, 8
  ; trocar a tabela sem recarregar o CR3: o TLB ainda guarda a tradução antiga
  mov dword [TAB2], 0x305007
  mov eax, [0x400000]
  X32 eax, 8
  mov eax, cr3
  mov cr3, eax               ; esvazia o TLB
  mov eax, [0x400000]
  X32 eax, 8
  ; leitura que cruza o fim de uma página presente para uma ausente
  mov dword [volta], p3
  mov eax, [0x401FFE]
p3:
  ; desliga a paginação
  mov eax, cr0
  and eax, 0x7FFFFFFF
  mov cr0, eax
  mov eax, [0x400000]
  X32 eax, 8
  T32 10, 'fim'
  FIM

pf:
  push ebp
  mov ebp, esp
  T32 '#PF '
  X32 [ebp+4], 1
  mov eax, cr2
  X32 eax, 8
  mov eax, [volta]
  mov [ebp+8], eax
  pop ebp
  add esp, 4
  iretd

  ROTINAS32
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF
  dq 0x00CF92000000FFFF
gdtr:
  dw gdtr - gdt - 1
  dd gdt
idtr:
  dw 32*8 - 1
  dd idt
volta: dd 0
align 8
idt: times 32*8 db 0
