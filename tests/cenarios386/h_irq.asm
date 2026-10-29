; interrupções de hardware no modo protegido: PIC reprogramado (IRQ 0-7 em 20h-27h), PIT, EOI
  cli
  ; reprograma os dois PICs
  mov al, 0x11
  out 0x20, al
  out 0xA0, al
  mov al, 0x20
  out 0x21, al
  mov al, 0x28
  out 0xA1, al
  mov al, 4
  out 0x21, al
  mov al, 2
  out 0xA1, al
  mov al, 1
  out 0x21, al
  out 0xA1, al
  mov al, 0xFE                ; só a IRQ 0
  out 0x21, al
  mov al, 0xFF
  out 0xA1, al
  in al, 0x21
  X16 eax, 2
  ; PIT canal 0, modo 2, divisor 11932 (100 Hz)
  mov al, 0x34
  out 0x43, al
  mov ax, 11932
  out 0x40, al
  mov al, ah
  out 0x40, al
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
  mov eax, irq0
  mov [idt+0x20*8], ax
  mov word [idt+0x20*8+2], 0x08
  mov word [idt+0x20*8+4], 0x8E00
  shr eax, 16
  mov [idt+0x20*8+6], ax
  lidt [idtr]
  T32 'pm', 10
  sti
.espera:
  hlt
  cmp dword [ticks], 5
  jb .espera
  cli
  T32 'ticks: '
  X32 [ticks], 2
  ; ISR do PIC: lê com OCW3
  mov al, 0x0B
  out 0x20, al
  in al, 0x20
  movzx eax, al
  X32 eax, 2
  ; IRQ pendente com IF = 0: espera um tique sem STI e confere o IRR
  mov ecx, 2000000
.l:
  mov al, 0x0A
  out 0x20, al
  in al, 0x20
  test al, 1
  loopz .l
  movzx eax, al
  and al, 1
  X32 eax, 2
  T32 10, 'fim'
  FIM

irq0:
  push eax
  inc dword [ticks]
  mov al, 0x0B
  out 0x20, al
  in al, 0x20                  ; ISR com a IRQ 0 em serviço
  cmp dword [ticks], 1
  jne .n
  movzx eax, al
  X32 eax, 2
.n:
  mov al, 0x20
  out 0x20, al                 ; EOI
  pop eax
  iretd

bits 16
  ROTINAS16
bits 32
  ROTINAS32
ticks: dd 0
align 8
gdt:
  dq 0
  dq 0x00CF9A000000FFFF
  dq 0x00CF92000000FFFF
gdtr:
  dw gdtr - gdt - 1
  dd gdt
idtr:
  dw 0x30*8 - 1
  dd idt
align 8
idt: times 0x30*8 db 0
