---
id: aula67
numero: 67
modulo: 20
titulo: O PIC 8259 e as interrupções de hardware
subtitulo: Remapeamento, EOI, tratador de teclado e timer
duracao: 70 min
objetivos: entender o problema de conflito dos IRQs com os vetores de exceção; remapear o PIC 8259 para liberar os vetores 0-31; escrever um tratador de IRQ mínimo com EOI; capturar o tick do timer (IRQ 0) e a tecla do teclado (IRQ 1) no modo protegido
---

## O problema dos IRQs em modo protegido

No modo real, o PIC 8259 mapeia os IRQs de hardware para os vetores de interrupção:
- IRQ 0–7 → vetores **8–15** (PIC mestre)
- IRQ 8–15 → vetores **112–119** (PIC escravo)

No modo protegido, os vetores 0–31 são exceções da Intel. O timer (IRQ 0) dispara o vetor 8, que é a **#DF (falha dupla)** — a CPU fica confusa achando que está tratando uma exceção de sistema. Para evitar isso, todo sistema operacional de 32 bits **remapeia o PIC** logo depois de entrar no modo protegido, movendo os IRQs para vetores acima de 31.

## O PIC 8259

O PC tem dois chips PIC 8259 em cascata:
- **PIC mestre**: portas `20h` (comando) e `21h` (dados/máscara)
- **PIC escravo**: portas `A0h` (comando) e `A1h` (dados/máscara)

O IRQ 2 do mestre é ligado ao escravo (cascade). Os outros:
- Mestre: IRQ0=timer, IRQ1=teclado, IRQ3=COM2, IRQ4=COM1, IRQ5=LPT2, IRQ6=floppy, IRQ7=LPT1
- Escravo: IRQ8=RTC, IRQ12=PS/2 mouse, IRQ14=IDE primário, IRQ15=IDE secundário

## Remapeamento

Para mover o PIC mestre para o vetor `20h` (32) e o escravo para o `28h` (40):

```nasm fragmento titulo="Remapeamento do PIC 8259 para vetores 20h e 28h"
        ; ICW1: início de inicialização
        mov al, 11h         ; ICW1: edge triggered, cascade, ICW4 necessário
        out 20h, al         ; para o mestre
        out 0A0h, al        ; para o escravo

        ; ICW2: vetor base
        mov al, 20h         ; IRQ0-7 → vetores 20h-27h
        out 21h, al
        mov al, 28h         ; IRQ8-15 → vetores 28h-2Fh
        out 0A1h, al

        ; ICW3: cascata (bit 2 do mestre, ID do escravo = 2)
        mov al, 04h         ; mestre: IRQ2 é a linha de cascade
        out 21h, al
        mov al, 02h         ; escravo: ID = 2
        out 0A1h, al

        ; ICW4: modo 8086
        mov al, 01h
        out 21h, al
        out 0A1h, al

        ; mascarar tudo exceto IRQ0 (timer) e IRQ1 (teclado)
        mov al, 11111100b   ; 0 = ligado; bit 0 = IRQ0, bit 1 = IRQ1
        out 21h, al         ; desligar IRQ2-7 no mestre
        mov al, 11111111b
        out 0A1h, al        ; desligar todos os IRQs do escravo
```

## O EOI (End of Interrupt)

Após tratar um IRQ, o tratador **deve** enviar um EOI ao PIC. Sem isso, o PIC não vai mandar mais interrupções do mesmo IRQ:

```nasm fragmento titulo="EOI ao final de cada tratador de IRQ"
        ; para IRQs 0-7 (PIC mestre):
        mov al, 20h
        out 20h, al         ; EOI para o PIC mestre

        ; para IRQs 8-15 (PIC escravo):
        ; precisam de EOI para o escravo E para o mestre:
        mov al, 20h
        out 0A0h, al        ; EOI para o PIC escravo
        out 20h, al         ; EOI para o PIC mestre
```

## Timer (IRQ 0) e teclado (IRQ 1)

```nasm executar modo="pm32" titulo="IRQ.BIN: contando ticks do timer com STI"
        bits 32
        org 100000h

        lidt [idtr]

        ; remapear PIC
        mov al, 11h
        out 20h, al
        out 0A0h, al
        mov al, 20h         ; mestre: vetores 20h+
        out 21h, al
        mov al, 28h         ; escravo: vetores 28h+
        out 0A1h, al
        mov al, 04h
        out 21h, al
        mov al, 02h
        out 0A1h, al
        mov al, 01h
        out 21h, al
        out 0A1h, al
        mov al, 11111110b   ; só IRQ0 (timer) ligado
        out 21h, al
        mov al, 11111111b
        out 0A1h, al

        sti                 ; habilitar interrupções
        ; aguardar 10 ticks (~0.5 segundos a 18 Hz)
.loop:  cmp dword [ticks], 10
        jb .loop

        ; mostrar '!' na tela
        mov byte [0B8000h], '!'
        mov byte [0B8001h], 0Fh
        cli
        hlt

timer_handler:              ; vetor 20h = IRQ 0
        inc dword [ticks]
        mov al, 20h
        out 20h, al         ; EOI
        iret

ticks: dd 0

        align 8
idt:    times 0x20 * 8 db 0     ; vetores 0-31 ausentes
        ; vetor 20h = IRQ 0 (timer)
        dw timer_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw timer_handler >> 16
        times (256 - 0x21) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::anos90 O timer do PC
O timer 8254 dispara a 18,2 Hz (período de 54,9 ms) no DOS. O Linux configurava a 100 Hz; kernels modernos usam 250 Hz ou mais. Na máquina 386 o timer dispara 18 vezes por segundo, assim como no hardware original.
:::

## Capturando o teclado

```nasm executar modo="pm32" entrada="abc" titulo="KBD.BIN: lendo scancodes no modo protegido"
        bits 32
        org 100000h

        lidt [idtr]

        ; remapear PIC (mesma sequência)
        mov al, 11h
        out 20h, al
        out 0A0h, al
        mov al, 20h
        out 21h, al
        mov al, 28h
        out 0A1h, al
        mov al, 04h
        out 21h, al
        mov al, 02h
        out 0A1h, al
        mov al, 01h
        out 21h, al
        out 0A1h, al
        mov al, 11111101b   ; só IRQ1 (teclado) ligado
        out 21h, al
        mov al, 11111111b
        out 0A1h, al

        sti
        ; aguardar 3 scancodes
.loop:  cmp byte [numScans], 3
        jb .loop

        cli
        hlt

kbd_handler:                ; vetor 21h = IRQ 1
        in al, 60h          ; ler scancode do controlador de teclado
        mov bl, [numScans]
        movzx ebx, bl
        mov [scans + ebx], al
        inc byte [numScans]
        mov al, 20h
        out 20h, al         ; EOI mestre
        iret

numScans: db 0
scans:    times 4 db 0

        align 8
idt:    times 0x20 * 8 db 0
        times 8 db 0        ; vetor 20h (timer) - não tratado
        ; vetor 21h = IRQ 1 (teclado)
        dw kbd_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw kbd_handler >> 16
        times (256 - 0x22) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

```quiz
? Por que o PIC 8259 precisa ser remapeado ao entrar no modo protegido?
+ Porque os IRQs 0-7 estão mapeados para os vetores 8-15, que a Intel reserva para exceções do processador
- Porque o PIC não funciona no modo protegido sem remapeamento
- Para melhorar o desempenho das interrupções
- Porque o modo protegido usa DPL 0 para interrupções

? O que acontece se o tratador de IRQ 0 (timer, vetor 20h após remapeamento) terminar sem enviar EOI?
- O timer para de funcionar permanentemente
+ O PIC não envia mais o sinal do IRQ 0; o timer continua gerando pulsos mas a CPU para de receber o vetor 20h
- O sistema reinicia
- Nada; o EOI é opcional

? Um IRQ do escravo (ex.: IRQ 14, IDE) precisa de quantos EOIs?
- Um, para o escravo apenas
+ Dois: um para o PIC escravo (porta A0h) e um para o PIC mestre (porta 20h)
- Nenhum; o hardware faz automaticamente
- Três
```

## Exercícios

```exercicio
id: a67-1
titulo: Remapear o PIC e contar ticks
nivel: 2
maquina: 386
modo: pm32
maxPassos: 15000000
--- enunciado
Remapeie o PIC para mestre em `20h` e escravo em `28h` (use a sequência ICW1-ICW4 da aula). Habilite apenas o IRQ 0 (timer) no mestre (máscara `FEh`). Instale um tratador no vetor `20h` que incrementa `ticks` e manda EOI ao mestre. Habilite interrupções com `STI`. Aguarde até `ticks >= 10` (loop com `cmp`), depois faça `CLI/HLT`.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        ; remapeie o PIC aqui
        ; instale o tratador e habilite interrupções

.loop:  cmp dword [ticks], 10
        jb .loop
        cli
        hlt

timer_handler:
        ; incremente ticks e envie EOI
        iret

ticks: dd 0

        align 8
idt:    times 0x20 * 8 db 0
        ; coloque o gate do vetor 20h aqui
        times (256 - 0x21) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "ticks >= 10", "espera": { "mem": { "ticks": 10 } } }]
--- dicas
ICW: out 20h, 11h / out A0h, 11h / out 21h, 20h / out A1h, 28h / out 21h, 04h / out A1h, 02h / out 21h, 01h / out A1h, 01h.
Máscara: out 21h, 0FEh / out A1h, 0FFh. STI. Loop: cmp dword [ticks], 10 / jb .loop.
Gate: dw timer_handler & 0FFFFh / dw 08h / db 0 / db 8Eh / dw timer_handler >> 16.
Handler: inc dword [ticks] / mov al, 20h / out 20h, al / iret.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        mov al, 11h
        out 20h, al
        out 0A0h, al
        mov al, 20h
        out 21h, al
        mov al, 28h
        out 0A1h, al
        mov al, 04h
        out 21h, al
        mov al, 02h
        out 0A1h, al
        mov al, 01h
        out 21h, al
        out 0A1h, al
        mov al, 0FEh
        out 21h, al
        mov al, 0FFh
        out 0A1h, al

        sti

.loop:  cmp dword [ticks], 10
        jb .loop
        cli
        hlt

timer_handler:
        inc dword [ticks]
        mov al, 20h
        out 20h, al
        iret

ticks: dd 0

        align 8
idt:    times 0x20 * 8 db 0
        dw timer_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw timer_handler >> 16
        times (256 - 0x21) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

```exercicio
id: a67-2
titulo: Tratador de teclado que captura um scancode
nivel: 3
maquina: 386
modo: pm32
maxPassos: 15000000
--- enunciado
Remapeie o PIC. Habilite apenas o IRQ 1 (teclado) no mestre (máscara `FDh`). Instale um tratador no vetor `21h` que lê o scancode da porta `60h`. Se o bit 7 estiver zerado (tecla pressionada), salve em `scancode`; se estiver ligado (tecla solta), ignore. Mande EOI e retorne. Habilite interrupções. Aguarde até `scancode != 0`, depois faça `CLI/HLT`.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        ; remapeie o PIC e configure para IRQ1 apenas

        sti
.loop:  cmp byte [scancode], 0
        je .loop
        cli
        hlt

kbd_handler:
        ; leia porta 60h; se bit7=0, salve em scancode; EOI e retorne
        iret

scancode: db 0

        align 8
idt:    times 0x20 * 8 db 0
        times 1 * 8 db 0    ; vetor 20h (timer) ausente
        ; coloque o gate do vetor 21h aqui
        times (256 - 0x22) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "scancode capturado", "espera": { "mem": { "scancode": [1] } }, "entrada": "{ESC}" }]
--- dicas
Remapeamento: mesmo que o exercício anterior. Máscara mestre: 0FDh (só bit 1 desligado = IRQ1 ligado).
Gate vetor 21h: dw kbd_handler & 0FFFFh / dw 08h / db 0 / db 8Eh / dw kbd_handler >> 16.
Handler: in al, 60h / test al, 80h / jnz .skip / mov [scancode], al / .skip: mov al, 20h / out 20h, al / iret.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        mov al, 11h
        out 20h, al
        out 0A0h, al
        mov al, 20h
        out 21h, al
        mov al, 28h
        out 0A1h, al
        mov al, 04h
        out 21h, al
        mov al, 02h
        out 0A1h, al
        mov al, 01h
        out 21h, al
        out 0A1h, al
        mov al, 0FDh
        out 21h, al
        mov al, 0FFh
        out 0A1h, al

        sti

.loop:  cmp byte [scancode], 0
        je .loop
        cli
        hlt

kbd_handler:
        in al, 60h
        test al, 80h        ; bit 7 = tecla solta (break code)?
        jnz .skip
        mov [scancode], al
.skip:  mov al, 20h
        out 20h, al
        iret

scancode: db 0

        align 8
idt:    times 0x20 * 8 db 0
        times 1 * 8 db 0
        dw kbd_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw kbd_handler >> 16
        times (256 - 0x22) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::resumo
- No modo real, os IRQs 0-7 usam os vetores 8-15, que conflitam com exceções do processador no modo protegido.
- Remapear o PIC 8259 move os IRQs para vetores a partir de 32 (ou 0x20).
- A sequência de inicialização é ICW1 → ICW2 → ICW3 → ICW4 para cada PIC.
- Todo tratador de IRQ deve enviar EOI (byte 20h para a porta 20h) ao PIC mestre. IRQs do escravo precisam de EOI para ambos.
- O timer (IRQ 0) dispara a 18,2 Hz; o teclado (IRQ 1) envia scancodes pela porta 60h.
:::
