---
id: aula56
numero: 56
modulo: 17
titulo: A linha A20 e a HMA
subtitulo: O 21º fio de endereço, o controlador do teclado e os 64 KB a mais do DOS
duracao: 70 min
objetivos: explicar por que o endereço FFFF:0010 dá a volta no 8086 e não no 286; testar se a linha A20 está ligada; ligar e desligar a A20 pelo controlador do teclado, pela porta 92h e pela BIOS; saber o que é a HMA e como o DOS=HIGH a usava; perguntar à BIOS quanta memória estendida existe
---

## Um endereço que passa de 1 MB

No modo real, o endereço é segmento × 16 + deslocamento. O maior possível é **FFFF:FFFF** = FFFF0h + FFFFh = **10FFEFh**, quase 64 KB acima de 1 MB. No 8086, com 20 fios de endereço (A0 a A19), o bit 20 simplesmente se perde, e o endereço "dá a volta": FFFF:0010 vira 00000h.

Alguns programas dependiam disso. O exemplo clássico é o próprio DOS: para manter compatibilidade com o CP/M, um .COM podia chamar o DOS com um `call 5` no PSP, e o salto que estava ali usava a volta para cair no lugar certo. Compiladores e programas espertos também usavam FFFF:xxxx como um jeito de apontar para o começo da memória.

O 286 tinha 24 fios. No modo real, FFFF:0010 passou a ser o endereço 100000h de verdade, o primeiro byte acima de 1 MB, e esses programas quebraram. A solução da IBM no AT foi uma gambiarra de hardware: uma porta lógica no fio **A20**, controlada por um pino livre do chip do teclado, o 8042. Com a porta fechada, o fio A20 fica sempre em 0 e o 286 se comporta como um 8086. Com ela aberta, a memória acima de 1 MB aparece.

```diagrama titulo="O mesmo endereço com a A20 desligada e ligada"
FFFF:0010  ->  FFFF0h + 0010h = 100000h

A20 desligada:  1 0000 0000 0000 0000 0000  ->  bit 20 forçado a 0  ->  00000h
A20 ligada:     1 0000 0000 0000 0000 0000  ->  100000h (memória estendida)
```

## Testando a A20

O teste é simples: escreva um byte em FFFF:0510 (100500h) e veja se 0000:0500 mudou. Se mudou, os dois endereços são o mesmo byte e a A20 está desligada. A posição 0000:0500 é a área de dados do DOS, livre para uso temporário.

```nasm executar titulo="A20.COM: a volta do endereço, ao vivo"
        org 100h
        call testa              ; a máquina do curso liga com a A20 desligada
        in al, 92h              ; liga pela porta 92h
        or al, 2
        and al, 0FEh            ; o bit 0 reseta o PC: nunca escreva 1 nele
        out 92h, al
        call testa
        mov ax, 4C00h
        int 21h

; escreve em FFFF:0510 e confere 0000:0500
testa:  push ds
        push es
        xor ax, ax
        mov ds, ax
        dec ax                  ; AX = FFFFh
        mov es, ax
        mov byte [0500h], 11h
        mov byte [es:0510h], 22h
        cmp byte [0500h], 22h
        pop es
        pop ds
        mov dx, desligada
        je .msg
        mov dx, ligada
.msg:   mov ah, 9
        int 21h
        ret

desligada: db 'A20 desligada: FFFF:0510 deu a volta para 0000:0500', 13, 10, '$'
ligada:    db 'A20 ligada: FFFF:0510 e 0000:0500 sao bytes diferentes', 13, 10, '$'
```

Repare que, depois do `pop ds`, o `cmp` já foi feito: POP não muda flags, então o `je` ainda usa o resultado da comparação.

:::atencao Nos emuladores de hoje
A máquina do curso liga com a A20 **desligada**, como um PC dos anos 90 antes do HIMEM.SYS. A BIOS do QEMU e do Bochs (a SeaBIOS) já entrega o controle com a A20 **ligada**. Um carregador de verdade nunca supõe: ele testa e, se precisar, liga.
:::

## Três jeitos de ligar

**1. O controlador do teclado (o jeito original do AT).** O 8042 tem uma "porta de saída" cujo bit 1 é a A20 (e o bit 0, o reset da CPU). Para escrever nela: espere o 8042 poder receber (bit 1 da porta 64h em 0), mande o comando **D1h** para a porta 64h, espere de novo e mande o novo valor para a porta 60h: **DFh** liga, **DDh** desliga. É lento (o 8042 é um microcontrolador separado) e cheio de esperas.

```nasm fragmento titulo="Ligando a A20 pelo 8042"
liga_a20:
        call espera_8042
        mov al, 0D1h            ; "vou escrever na porta de saída"
        out 64h, al
        call espera_8042
        mov al, 0DFh            ; bit 1 = A20 ligada, bit 0 = 1 (não resetar)
        out 60h, al
        call espera_8042
        ret
espera_8042:
        in al, 64h
        test al, 2              ; buffer de entrada ainda cheio?
        jnz espera_8042
        ret
```

**2. A porta 92h ("Fast A20").** Os PS/2 da IBM puseram o controle numa porta própria, a **92h**: bit 1 = A20. É instantâneo, e quase todo PC depois de 1990 tem. Cuidado com o bit 0: escrever 1 nele reseta o PC.

**3. A BIOS.** BIOSes mais novas têm a **INT 15h, AX=2401h** (liga), **2400h** (desliga), **2402h** (pergunta o estado, em AL) e **2403h** (quais métodos existem). Com CF = 1 na volta, a função não existe e é preciso tentar os outros métodos.

Um carregador robusto, como o do Linux, tenta nesta ordem: testa; BIOS; testa; 8042; testa; porta 92h; testa.

```quiz
? Com a A20 desligada, que endereço físico é FFFF:0020?
- 100010h
+ 000010h
- 0FFFF0h
- 0FFF20h
> FFFF0h + 20h = 100010h, que tem o bit 20 ligado. Com a A20 desligada o bit é forçado a 0: 000010h.

? Por que o teste da A20 escreve dois valores diferentes nos dois endereços?
- Para não estragar a tabela de interrupções
+ Se os dois endereços forem o mesmo byte, a segunda escrita muda o que se lê no primeiro
- Porque a A20 só funciona com 22h
- Para ligar a A20
> Escrever 11h em 0000:0500 e 22h em FFFF:0510 e depois ler 0000:0500: se vier 22h, é o mesmo byte, e a A20 está desligada.
```

## A HMA: 64 KB de presente

Com a A20 ligada, o segmento FFFFh do modo real enxerga de 100000h a 10FFEFh: **65.520 bytes** acima de 1 MB, acessíveis sem sair do modo real. Esse pedaço se chama **HMA** (*high memory area*).

Para o DOS, cujo limite eram os 640 KB da memória convencional, 64 KB a mais faziam diferença. O **HIMEM.SYS** (o gerenciador de memória estendida, padrão XMS) liga a A20 e administra a HMA. Com a linha `DOS=HIGH` no CONFIG.SYS, o DOS 5 em diante punha boa parte de si mesmo lá. O comando MEM mostrava a mensagem "MS-DOS is resident in the high memory area".

```nasm executar titulo="HMA.COM: guardando e lendo um texto acima de 1 MB"
        org 100h
        in al, 92h              ; liga a A20
        or al, 2
        and al, 0FEh
        out 92h, al
        mov ax, 0FFFFh
        mov es, ax
        mov di, 10h             ; FFFF:0010 = 100000h, o começo da HMA
        mov si, texto
        mov cx, fim - texto
        cld
        rep movsb               ; copia para cima de 1 MB
        push es
        pop ds                  ; DS = FFFFh
        mov dx, 10h             ; e escreve de lá
        mov ah, 9
        int 21h
        mov ax, 4C00h
        int 21h
texto:  db 'Este texto foi lido de 100000h, acima de 1 MB', 13, 10, '$'
fim:
```

:::anos90 A guerra da memória
Nos anos 90, configurar o CONFIG.SYS e o AUTOEXEC.BAT para sobrar memória convencional era um esporte. Um jogo como o *Wing Commander* ou o *Ultima VII* pedia 600 KB livres, e cada driver (mouse, CD-ROM, som) comia um pedaço. `DEVICE=HIMEM.SYS`, `DOS=HIGH,UMB`, `DEVICE=EMM386.EXE NOEMS` e `DEVICEHIGH=` eram as armas. O MEMMAKER do DOS 6 tentava fazer isso sozinho. O EMM386 é um programa do módulo 24: ele roda o DOS inteiro dentro do modo virtual 8086.
:::

## Quanta memória existe acima de 1 MB?

A memória além do primeiro megabyte se chama **memória estendida**. Para saber quanto existe, pergunte à BIOS:

- **INT 15h, AH=88h**: devolve em AX o número de KB acima de 1 MB (no máximo 64 MB, o que cabe em 16 bits).
- **INT 15h, AX=E801h**: AX = KB entre 1 MB e 16 MB, BX = blocos de 64 KB acima de 16 MB.
- **INT 15h, EAX=E820h**: o mapa completo, com cada faixa de endereços e se é RAM, reservada ou ACPI. É o que os sistemas modernos usam, e você vai usar no módulo 26.

```nasm executar titulo="MEMEXT.COM: pergunta à BIOS"
        org 100h
        mov ah, 88h
        int 15h                 ; AX = KB de memória estendida
        mov [kb], ax
        ; escreve AX em decimal
        mov bx, 10
        xor cx, cx
.div:   xor dx, dx
        div bx
        push dx
        inc cx
        test ax, ax
        jnz .div
.esc:   pop dx
        add dl, '0'
        mov ah, 2
        int 21h
        loop .esc
        mov dx, msg
        mov ah, 9
        int 21h
        mov ax, 4C00h
        int 21h
kb:     dw 0
msg:    db ' KB acima de 1 MB', 13, 10, '$'
```

A máquina do curso tem 8 MB, então a resposta é 7168 KB (8 × 1024 − 1024).

## Exercícios

```exercicio
id: a56-1
titulo: Testar a A20 antes e depois
nivel: 2
maquina: 386
modo: com
--- enunciado
Escreva a rotina **teste_a20**: devolve **AX = 1** se a A20 está ligada e **AX = 0** se está desligada, sem mudar DS nem ES para quem chamou. O programa principal já chama a rotina, liga a A20 pela porta 92h e chama de novo.
--- inicial
        org 100h
        call teste_a20
        mov [antes], ax
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        call teste_a20
        mov [depois], ax
        mov ax, 4C00h
        int 21h

teste_a20:
        mov ax, 0
        ret

antes:  dw 0FFFFh
depois: dw 0FFFFh
--- testes
[{ "nome": "desligada e depois ligada", "espera": { "mem": { "antes:w": 0, "depois:w": 1 }, "a20": true, "ds": 1792, "es": 1792 } }]
--- dicas
Use DS = 0 e ES = FFFFh. Escreva um valor em [0500h] e outro em [es:0510h], depois compare [0500h] com o segundo valor.
Guarde DS e ES com push no começo e restaure com pop antes do ret.
--- solucao
        org 100h
        call teste_a20
        mov [antes], ax
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        call teste_a20
        mov [depois], ax
        mov ax, 4C00h
        int 21h

teste_a20:
        push ds
        push es
        xor ax, ax
        mov ds, ax
        dec ax
        mov es, ax
        mov byte [0500h], 11h
        mov byte [es:0510h], 22h
        xor ax, ax
        cmp byte [0500h], 22h
        je .fim
        inc ax
.fim:   pop es
        pop ds
        ret

antes:  dw 0FFFFh
depois: dw 0FFFFh
```

```exercicio
id: a56-2
titulo: Ligar a A20 pelo controlador do teclado
nivel: 2
maquina: 386
modo: com
exigir: OUT
proibir: INT
--- enunciado
Ligue a A20 do jeito do PC AT: pelo 8042, com o comando **D1h** e o valor **DFh**, esperando o controlador antes de cada escrita. Não vale usar a porta 92h nem a BIOS. O programa termina sozinho no fim com `out 0F4h, al` (a porta que desliga a máquina do curso), porque o exercício proíbe INT.
--- inicial
        org 100h
        ; ligue a A20 pelo 8042

        out 0F4h, al            ; fim
--- testes
[{ "nome": "A20 ligada", "espera": { "a20": true } }]
--- dicas
Espera: in al, 64h / test al, 2 / jnz (repete).
Sequência: espera, mov al, 0D1h / out 64h, al, espera, mov al, 0DFh / out 60h, al, espera.
--- solucao
        org 100h
        call espera
        mov al, 0D1h
        out 64h, al
        call espera
        mov al, 0DFh
        out 60h, al
        call espera
        out 0F4h, al
espera: in al, 64h
        test al, 2
        jnz espera
        ret
```

:::resumo
- FFFF:0010 é 100000h. No 8086 o bit 20 se perde e o endereço dá a volta; no 286 e depois, isso depende da **linha A20**.
- Teste: escreva valores diferentes em 0000:0500 e FFFF:0510 e compare.
- Três jeitos de ligar: 8042 (D1h + DFh), porta 92h (bit 1; nunca o bit 0) e INT 15h AX=2401h.
- A **HMA** são os 65.520 bytes de FFFF:0010 a FFFF:FFFF, usados pelo DOS=HIGH.
- INT 15h AH=88h, E801h e E820h dizem quanta memória estendida existe.
:::
