; entra no modo protegido de 32 bits, usa segmentos com base, volta ao modo real e testa o "unreal mode"
  cli
  T16 'real', 10
  smsw ax
  X16 eax, 4
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
  T32 'pm32', 10
  mov eax, cr0
  X32 eax, 8
  ; segmento de dados com base 0x20000 e limite 0xFFF
  mov ax, 0x18
  mov fs, ax
  mov dword [0x20010], 0xCAFE1234
  mov eax, [fs:0x10]
  X32 eax, 8
  mov ax, 0x18
  lsl ecx, ax
  X32 ecx, 8
  lar ecx, eax
  X32 ecx, 8
  mov ax, 0x08
  lsl ecx, ax
  X32 ecx, 8
  sgdt [tmp]
  movzx eax, word [tmp]
  X32 eax, 4
  mov eax, [tmp+2]
  X32 eax, 8
  ; segmento de 16 bits para voltar ao modo real
  jmp 0x20:pm16
bits 16
pm16:
  mov ax, 0x28
  mov ds, ax
  mov es, ax
  mov ss, ax
  T16 'pm16', 10
  mov eax, cr0
  and al, 0xFE
  mov cr0, eax
  jmp 0:real2
real2:
  xor ax, ax
  mov ss, ax
  mov es, ax
  ; DS ainda tem limite de 4 GB (unreal): acessa acima de 1 MB com endereço de 32 bits
  mov esi, 0x200000
  mov dword [esi], 0x11223344
  mov eax, [esi]
  X16 eax, 8
  mov ds, ax
  T16 'de volta', 10
  ; agora carrega DS no modo real: a base muda, o limite fica
  mov ax, 0x1000
  mov ds, ax
  xor esi, esi
  mov eax, [esi]
  X16 eax, 8
  xor ax, ax
  mov ds, ax
  pushfd
  pop eax
  X16 eax, 8
  FIM
  ROTINAS16
bits 32
  ROTINAS32
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF        ; 08: código 32 bits, base 0, 4 GB
  dq 0x00CF92000000FFFF        ; 10: dados, base 0, 4 GB
  dq 0x00409202_00000FFF       ; 18: dados, base 0x20000, limite 0xFFF
  dq 0x00009A000000FFFF        ; 20: código 16 bits, base 0, 64 KB
  dq 0x008F92000000FFFF        ; 28: dados 16 bits, limite 4 GB (para o unreal)
gdtr:
  dw gdtr - gdt - 1
  dd gdt
tmp: times 8 db 0
