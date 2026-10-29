---
id: aula64
numero: 64
modulo: 19
titulo: O carregador em dois estágios
subtitulo: Boot sector, segundo estágio em disco e salto para o kernel
duracao: 70 min
objetivos: entender por que um boot sector de 512 bytes não é suficiente; usar INT 13h AH=42h para carregar setores do disco para a memória; escrever um segundo estágio que lê o kernel, entra no modo protegido e salta para ele; montar disco múltiplo com marcadores `;### ARQUIVO`
---

## Por que dois estágios?

O boot sector tem 512 bytes — menos 2 da assinatura, menos o código de carregamento. Isso não é suficiente para uma GDT, uma IDT, a iniciação do modo protegido, a leitura de um sistema de arquivos e o carregamento do kernel. A solução tradicional é o **carregador em dois estágios**:

```diagrama titulo="Sequência de boot de dois estágios"
┌────────────┐  INT 13h   ┌──────────────────┐  INT 13h  ┌────────────┐  jmp PM  ┌────────┐
│ boot sector│ ─────────► │ segundo estágio  │ ─────────►│   kernel  │ ────────►│  PM32  │
│   setor 0  │  lê st.2   │  setores 1-3     │ lê kernel │ setor 4   │          │ A000h  │
└────────────┘            └──────────────────┘           └────────────┘          └────────┘
  7C00h                     8000h (modo real)              A000h (modo real)
```

- **Estágio 1 (boot sector)**: sabe ler o disco (INT 13h) e carrega o estágio 2 para um endereço fixo.
- **Estágio 2**: pode ter vários KB; faz tudo o que cabe num loader: lê o kernel **ainda no modo real** (quando a BIOS ainda está disponível), depois entra no modo protegido e salta para o kernel.
- **Kernel**: o sistema operacional de verdade.

:::cpu Por que ler o kernel no modo real?
A INT 13h é uma função da BIOS. A BIOS só funciona no modo real (os vetores de interrupção na tabela IVT apontam para rotinas de 16 bits que assumem que CS, DS, etc. têm caches do modo real). Depois do salto far que entra no modo protegido, a BIOS desaparece. Por isso o estágio 2 lê o kernel do disco com INT 13h **antes** do LGDT e do mov cr0.
:::

## INT 13h extendido (AH=42h)

A BIOS antiga usava CHS (cilindro/cabeça/setor), que trava em 8 GB. O INT 13h extendido usa **LBA de 64 bits** e um pacote de disco de 16 bytes:

```nasm fragmento titulo="Pacote de disco para INT 13h AH=42h"
pacote: db 10h        ; tamanho do pacote (sempre 10h)
        db 0          ; reservado, sempre 0
        dw 4          ; número de setores a ler
        dw 8000h      ; offset do buffer de destino
        dw 0000h      ; segmento do buffer (0000:8000 = linear 8000h)
        dq 1          ; LBA de 64 bits: primeiro setor a ler (setor 1 = logo após o boot sector)
```

Para ler: `mov si, pacote` / `mov ah, 42h` / `mov dl, 80h` / `int 13h`. O CF fica ligado em caso de erro.

## O disco multi-arquivo

No NASM do curso, o marcador `;### ARQUIVO nome.ext` separa o conteúdo do disco em arquivos. Cada arquivo começa num novo setor (512 bytes, preenchido com zeros). Assim, um disco com quatro arquivos fica:

```
Setor 0: BOOT.BIN    (512 bytes: o boot sector, deve terminar com 55h AAh)
Setor 1: STAGE2.BIN  (começo do segundo estágio)
Setor 2: STAGE2.BIN  (continuação — preenche até 3 setores com times)
Setor 3: STAGE2.BIN  (fim, times 3*512-($ - $$) db 0)
Setor 4: KERNEL.BIN  (o kernel em modo protegido, org 0A000h)
```

O boot sector lê setores 1-3 (o segundo estágio). O segundo estágio lê setor 4 (o kernel) para A000h usando outra chamada INT 13h, ainda no modo real. Depois entra no PM e pula para A000h.

## O programa completo

```nasm executar modo="boot" titulo="TWOSTAGE.BIN: boot de dois estágios com kernel simples"
;### ARQUIVO BOOT.BIN
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov ss, ax
        mov sp, 7C00h

        ; ler setores 1-3 para 0000:8000h (o segundo estágio)
        mov si, pacote1
        mov ah, 42h
        mov dl, 80h
        int 13h
        jc .erro

        jmp 0000h:8000h         ; pular para o segundo estágio

.erro:  mov ah, 0Eh
        mov al, 'E'
        int 10h
        hlt

pacote1: db 10h, 0
         dw 3                   ; 3 setores
         dw 8000h, 0000h        ; destino: 0000:8000h
         dq 1                   ; LBA 1

        times 510 - ($ - $$) db 0
        dw 0AA55h

;### ARQUIVO STAGE2.BIN
        bits 16
        org 8000h

        ; 1) ler o kernel (setor 4) para 0000:A000h, ainda no modo real
        mov si, pacoteK
        mov ah, 42h
        mov dl, 80h
        int 13h

        ; 2) ligar A20
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al

        ; 3) carregar GDT e entrar no modo protegido
        lgdt [gdtr]
        mov eax, cr0
        or eax, 1
        mov cr0, eax
        jmp 08h:pm32

        bits 32
pm32:   mov ax, 10h
        mov ds, ax
        mov es, ax
        mov fs, ax
        mov gs, ax
        mov ss, ax
        mov esp, 90000h

        ; 4) pular para o kernel em A000h (carregado no passo 1)
        jmp 0A000h

pacoteK: db 10h, 0
         dw 1                   ; 1 setor
         dw 0A000h, 0000h       ; destino: 0000:A000h
         dq 4                   ; LBA 4 = quinto setor do disco

        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh     ; 08h: código 32 bits, 4 GB
        dq 00CF92000000FFFFh     ; 10h: dados, 4 GB
gdtr:   dw gdtr - gdt - 1
        dd gdt

        times (3 * 512) - ($ - $$) db 0

;### ARQUIVO KERNEL.BIN
        bits 32
        org 0A000h               ; carregado em 0000:A000h pelo segundo estágio

        mov esi, mensagem
        mov edi, 0B8000h + (12 * 80 + 28) * 2
        mov ah, 2Fh              ; fundo verde escuro, texto branco
.laco:  lodsb
        test al, al
        jz .fim
        stosw
        jmp .laco
.fim:   cli
        hlt

mensagem: db 'Kernel de dois estagios!', 0

        times 512 - ($ - $$) db 0
```

Siga o painel: depois do primeiro INT 13h, a memória em 8000h tem o código do segundo estágio. Depois do segundo INT 13h (ainda no modo real, dentro do segundo estágio), a memória em A000h tem o kernel. O salto far para `08h:pm32` é o mesmo da aula 62.

## A fragmento que lê antes de entrar no PM

A parte crítica do estágio 2 é a ordem: primeiro INT 13h, depois LGDT:

```nasm fragmento titulo="Estágio 2: ordem correta das operações"
        bits 16
        ; 1) ler kernel do disco enquanto a BIOS ainda funciona
        mov si, pkt
        mov ah, 42h
        mov dl, 80h
        int 13h

        ; 2) A20, LGDT, CR0, salto far
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        lgdt [gdtr]
        mov eax, cr0
        or eax, 1
        mov cr0, eax
        jmp 08h:kernel32

        bits 32
kernel32:
        mov ax, 10h             ; recarregar segmentos
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov esp, 90000h
        jmp 0A000h              ; executar o kernel
```

```quiz
? Por que o segundo estágio lê o kernel do disco ANTES de entrar no modo protegido?
+ Porque a INT 13h é uma função da BIOS, que só funciona no modo real de 16 bits
- Porque o modo protegido não acessa o disco
- Para economizar memória
- Para não precisar de GDT

? O boot sector leu 3 setores para 0000:8000h. O segundo estágio está em 3 setores a partir do setor 1. Em qual setor do disco está o kernel?
- Setor 3
+ Setor 4
- Setor 1
- Setor 0
> Os setores 1, 2 e 3 contêm o segundo estágio. O kernel começa no setor 4 (contando de 0).

? Um boot sector correto deve terminar com os bytes 55h AAh nas posições 510 e 511. O NASM garante isso com qual diretiva?
- org 7C00h
- db 0x55, 0xAA
+ times 510 - ($ - $$) db 0 seguido de dw 0AA55h
- align 512
> A diretiva times preenche o espaço até a posição 510, e dw 0AA55h coloca os dois bytes finais na ordem little-endian correta (55h primeiro, AAh depois).
```

## Exercícios

```exercicio
id: a64-1
titulo: Boot sector que carrega o segundo estágio
nivel: 2
maquina: 386
modo: boot
--- enunciado
O disco tem dois arquivos: `BOOT.BIN` (setor 0) e `MSG.BIN` (setor 1). O `BOOT.BIN` deve usar `INT 13h AH=42h` com o `pacote` já declarado para ler 1 setor a partir do LBA 1 para `0000:8000h`, e depois pular para `0000:8000h`. O `MSG.BIN` (já pronto) escreve **OK** na tela diretamente em `B800:0000` e faz `cli/hlt`.
--- inicial
;### ARQUIVO BOOT.BIN
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        ; use int 13h com o pacote abaixo para ler setor 1 para 8000h
        ; depois pule para 0000h:8000h

pacote: db 10h, 0
        dw 1
        dw 8000h, 0000h
        dq 1

        times 510 - ($ - $$) db 0
        dw 0AA55h

;### ARQUIVO MSG.BIN
        bits 16
        org 8000h
        mov ax, 0B800h
        mov es, ax
        xor di, di
        mov si, msg
.laco:  lodsb
        test al, al
        jz .fim
        mov ah, 07h
        stosw
        jmp .laco
.fim:   cli
        hlt
msg:    db 'OK', 0
        times 512 - ($ - $$) db 0
--- testes
[{ "nome": "OK na tela", "espera": { "tela": "OK" } }]
--- dicas
mov si, pacote / mov ah, 42h / mov dl, 80h / int 13h. Depois jmp 0000h:8000h.
--- solucao
;### ARQUIVO BOOT.BIN
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov si, pacote
        mov ah, 42h
        mov dl, 80h
        int 13h
        jmp 0000h:8000h

pacote: db 10h, 0
        dw 1
        dw 8000h, 0000h
        dq 1

        times 510 - ($ - $$) db 0
        dw 0AA55h

;### ARQUIVO MSG.BIN
        bits 16
        org 8000h
        mov ax, 0B800h
        mov es, ax
        xor di, di
        mov si, msg
.laco:  lodsb
        test al, al
        jz .fim
        mov ah, 07h
        stosw
        jmp .laco
.fim:   cli
        hlt
msg:    db 'OK', 0
        times 512 - ($ - $$) db 0
```

```exercicio
id: a64-2
titulo: Segundo estágio carrega kernel e entra no PM
nivel: 3
maquina: 386
modo: boot
--- enunciado
O disco tem três arquivos. O `BOOT.BIN` (já pronto) lê 2 setores (LBA 1–2) para `0000:8000h` e pula para lá. O `STAGE2.BIN` (2 setores, org `8000h`) deve: (1) ler 1 setor do LBA 3 para `0000:A000h` com `INT 13h AH=42h`; (2) ligar A20 pela porta 92h; (3) carregar a GDT já declarada com `LGDT`; (4) ligar o PE em CR0 e fazer o salto far para `pm32`; (5) em `pm32` (bits 32), recarregar DS, ES, SS com `10h`, colocar `ESP` em `90000h` e pular para `0A000h`. O `KERNEL.BIN` (1 setor, org `0A000h`, já pronto) escreve **PM** na tela e faz `cli/hlt`.
--- inicial
;### ARQUIVO BOOT.BIN
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov si, pkt1
        mov ah, 42h
        mov dl, 80h
        int 13h
        jmp 0000h:8000h
pkt1:   db 10h, 0
        dw 2
        dw 8000h, 0000h
        dq 1
        times 510 - ($ - $$) db 0
        dw 0AA55h

;### ARQUIVO STAGE2.BIN
        bits 16
        org 8000h
        ; complete aqui: leia kernel para A000h, A20, LGDT, PM, salto far

        bits 32
pm32:   ; complete aqui: recarregue segmentos, ESP=90000h, jmp 0A000h
        cli
        hlt

        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times (2 * 512) - ($ - $$) db 0

;### ARQUIVO KERNEL.BIN
        bits 32
        org 0A000h
        mov dword [0B8000h], 1F4D1F50h
        cli
        hlt
        times 512 - ($ - $$) db 0
--- testes
[{ "nome": "PM na tela, modo protegido, segmentos certos", "espera": { "tela": "PM", "modoProtegido": true, "ds": 16, "esp": 589824 } }]
--- dicas
STAGE2 (bits 16): mov si, pktK / mov ah, 42h / mov dl, 80h / int 13h.
Depois: in al, 92h / or al, 2 / and al, 0FEh / out 92h, al.
Depois: lgdt [gdtr] / mov eax, cr0 / or eax, 1 / mov cr0, eax / jmp 08h:pm32.
pm32 (bits 32): mov ax, 10h / mov ds, ax / mov es, ax / mov ss, ax / mov esp, 90000h / jmp 0A000h.
Declare pktK com: db 10h, 0 / dw 1 / dw 0A000h, 0000h / dq 3.
--- solucao
;### ARQUIVO BOOT.BIN
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov si, pkt1
        mov ah, 42h
        mov dl, 80h
        int 13h
        jmp 0000h:8000h
pkt1:   db 10h, 0
        dw 2
        dw 8000h, 0000h
        dq 1
        times 510 - ($ - $$) db 0
        dw 0AA55h

;### ARQUIVO STAGE2.BIN
        bits 16
        org 8000h
        mov si, pktK
        mov ah, 42h
        mov dl, 80h
        int 13h
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        lgdt [gdtr]
        mov eax, cr0
        or eax, 1
        mov cr0, eax
        jmp 08h:pm32

        bits 32
pm32:   mov ax, 10h
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov esp, 90000h
        jmp 0A000h

pktK:   db 10h, 0
        dw 1
        dw 0A000h, 0000h
        dq 3

        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times (2 * 512) - ($ - $$) db 0

;### ARQUIVO KERNEL.BIN
        bits 32
        org 0A000h
        mov dword [0B8000h], 1F4D1F50h
        cli
        hlt
        times 512 - ($ - $$) db 0
```

:::resumo
- O boot sector (512 bytes) carrega um segundo estágio maior do disco e pula para ele.
- INT 13h AH=42h lê setores via LBA de 64 bits, usando um pacote de 16 bytes apontado por SI.
- O segundo estágio lê o kernel **no modo real** (antes do LGDT), porque a INT 13h é BIOS e só funciona em 16 bits.
- O marcador `;### ARQUIVO nome` divide um fonte NASM em múltiplos arquivos no disco.
- GRUB funciona exatamente assim: stage 1 (512 B), stage 1.5 no espaço pós-MBR e stage 2 no sistema de arquivos.
:::
