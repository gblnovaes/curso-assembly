---
id: aula63
numero: 63
modulo: 19
titulo: Segmentos de verdade, o modelo plano e a volta ao modo real
subtitulo: Limites que geram #GP, por que todo mundo usa base 0, e o unreal mode
duracao: 80 min
objetivos: ver a CPU conferir limites e tipos de segmento a cada acesso; entender por que os sistemas de 32 bits escolheram o modelo plano; voltar do modo protegido ao modo real no 386 e usar a BIOS de novo; usar o cache de descritor para acessar 4 GB a partir do modo real (unreal mode)
---

## A proteção funcionando

Com descritores de verdade, cada acesso à memória passa por três conferências:

1. **Tipo**: escrever num segmento de código, ou num de dados só de leitura, gera **#GP**. Executar código de um segmento de dados também.
2. **Limite**: um deslocamento (mais o tamanho do acesso) que passa do limite gera **#GP**, ou **#SS** se o segmento for a pilha.
3. **Privilégio**: o assunto do módulo 22.

O exemplo abaixo começa no modo **pm32**, em que a máquina do curso já criou uma IDT que relata as exceções. O programa carrega a própria GDT com um segmento de 16 bytes, um vetor de quatro dwords, e anda por ele até passar do fim:

```nasm executar modo="pm32" termina="excecao" titulo="LIMITE32.BIN: um vetor que sabe o próprio tamanho"
        bits 32
        org 100000h
        lgdt [gdtr]
        mov ax, 18h
        mov es, ax                      ; ES = só o vetor, 16 bytes
        xor ecx, ecx
.laco:  mov eax, [es:ecx*4]             ; 0, 4, 8, 12... e 16 passa do limite
        inc ecx
        jmp .laco

        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh            ; 08h: o mesmo código plano do ambiente pm32
        dq 00CF92000000FFFFh            ; 10h
        dw 000Fh                        ; 18h: limite 15 (16 bytes)
        dw vetor & 0FFFFh               ; base 15:0
        db (vetor >> 16) & 0FFh         ; base 23:16
        db 92h
        db 40h                          ; G = 0, B = 1
        db (vetor >> 24) & 0FFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
vetor:  dd 10, 20, 30, 40
```

A mensagem mostra o deslocamento 10h e o limite 0Fh. Essa era a promessa do 286: um índice errado não estraga a memória vizinha, ele para o programa na instrução culpada.

## Por que ninguém usa isso

Um segmento por vetor parece ótimo, mas na prática quase nenhum sistema de 32 bits fez assim. O OS/2 e o Windows 3.x de 16 bits usaram segmentos a sério e pagaram o preço:

- **Carregar um registrador de segmento é caro.** No 386, `mov es, ax` no modo protegido leva 18 ciclos, contra 2 de um `mov` entre registradores. Um programa que troca de segmento a cada acesso fica lento.
- **Ponteiros ficam com 48 bits** (seletor + deslocamento), e o C, como os compiladores usam, quer ponteiros que caibam num registrador.
- **A GDT tem só 8192 entradas**, pouco para um descritor por objeto.
- O 386 trouxe a **paginação** (módulo 21), que protege a memória de outro jeito, em blocos de 4 KB, sem mudar os ponteiros.

Por isso o Windows NT, o Windows 95, o Linux e os BSDs escolheram o **modelo plano**: código e dados com base 0 e limite 4 GB, e toda a proteção feita pela paginação. Os segmentos continuam existindo (a CPU exige), mas viram uma formalidade. Os únicos segmentos "de verdade" que sobraram foram FS e GS, usados para os dados de cada thread.

:::cpu O x86-64 terminou o serviço
No modo de 64 bits, a CPU ignora a base e o limite de CS, DS, ES e SS: são sempre 0 e "infinito". Só FS e GS mantêm a base. A segmentação do 286, desenhada para proteger tudo, terminou como dois registradores para variáveis de thread.
:::

## Voltando ao modo real

No 386, voltar é zerar o PE do CR0. Mas a ordem importa, porque os caches dos registradores de segmento continuam com o que estava lá:

1. Salte para um segmento de código de **16 bits** (D = 0, limite FFFFh). Se o PE for desligado com CS de 32 bits, o processador fica no modo real executando código de 32 bits.
2. Carregue DS, ES, FS, GS e SS com um descritor de dados de **64 KB**, para os caches ficarem com o limite do modo real.
3. Zere o PE do CR0.
4. Faça um salto far para um segmento do modo real (`jmp 0:real`): CS volta a ser segmento × 16.
5. Recarregue os segmentos com valores do modo real, ponha SP no lugar e volte a ligar as interrupções. A IVT em 0000:0000 e a BIOS voltam a funcionar.

```nasm executar modo="boot" titulo="VOLTA.BIN: vai ao modo protegido e volta para usar a BIOS"
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov ss, ax
        mov sp, 7C00h
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
        mov dword [0B8000h], 2F322F33h  ; '3' '2' no canto, em verde
        jmp 18h:pm16                    ; 1: código de 16 bits

        bits 16
pm16:   mov ax, 20h                     ; 2: dados de 64 KB
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov eax, cr0                    ; 3: PE = 0
        and eax, 0FFFFFFFEh
        mov cr0, eax
        jmp 0:real                      ; 4

real:   xor ax, ax                      ; 5
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov sp, 7C00h
        sti
        mov si, msg
        mov ah, 0Eh                     ; a BIOS voltou a funcionar
.laco:  lodsb
        test al, al
        jz .fim
        int 10h
        jmp .laco
.fim:   cli
        hlt

msg:    db 13, 10, 'De volta ao modo real, com a BIOS.', 0
        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh            ; 08h: código 32 bits
        dq 00CF92000000FFFFh            ; 10h: dados 4 GB
        dq 00009A000000FFFFh            ; 18h: código 16 bits, 64 KB
        dq 000092000000FFFFh            ; 20h: dados 16 bits, 64 KB
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
```

```quiz
? Por que saltar para um código de 16 bits antes de zerar o PE?
- Porque o CR0 só pode ser escrito em 16 bits
+ Porque o cache de CS continuaria dizendo "32 bits" no modo real, e o código de 16 bits seria decodificado errado
- Porque o modo real não tem CS
- Não precisa
> Zerar o PE não mexe nos caches. Com o CS de um segmento D = 1, o processador estaria no modo real decodificando instruções como de 32 bits.

? Qual foi o principal motivo para os sistemas de 32 bits usarem o modelo plano?
- O 386 não suporta mais de um segmento
+ Carregar segmentos é caro, ponteiros de 48 bits complicam o C, e a paginação protege a memória sem mudar os ponteiros
- A GDT só aceita dois descritores
- O modelo plano é mais seguro que a segmentação
> A segmentação funcionava, mas era lenta e incômoda. A paginação do 386 ofereceu proteção com ponteiros simples de 32 bits.
```

## O unreal mode

Releia o passo 2 da volta: os segmentos são carregados com descritores de 64 KB *para os caches ficarem com o limite do modo real*. E se eles ficarem com 4 GB?

No modo real, carregar DS (`mov ds, ax`) só muda a base, nunca o limite. Então, se o programa voltar ao modo real com o cache de DS dizendo "limite FFFFFFFFh", ele continua podendo usar endereços de 32 bits com DS, até o fim da memória, **de dentro do modo real**, com a BIOS e o DOS funcionando. Isso ficou conhecido como **unreal mode** (ou *flat real mode*, ou *big real mode*).

A Intel nunca documentou. Mas o HIMEM.SYS usava, vários jogos usavam para carregar dados acima de 1 MB sem um DOS extender, e as BIOSes usam até hoje no início do boot. O cenário `b_modo_protegido` dos testes da máquina do curso confere esse comportamento contra o Bochs.

```nasm executar modo="boot" titulo="UNREAL.BIN: modo real com 4 GB em DS"
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov ss, ax
        mov sp, 7C00h
        in al, 92h                      ; A20: sem ela, 200000h cairia em... 200000h mesmo,
        or al, 2                        ; mas 100000h a 1FFFFFh dariam a volta
        and al, 0FEh
        out 92h, al
        push ds
        lgdt [gdtr]
        mov eax, cr0
        or al, 1
        mov cr0, eax
        jmp $+2                         ; o 386 recomenda um salto logo depois de mudar o PE
        mov bx, 08h
        mov ds, bx                      ; cache de DS: base 0, limite 4 GB
        and al, 0FEh
        mov cr0, eax                    ; de volta ao modo real, sem salto far: CS nunca mudou
        pop ds                          ; DS = 0, mas o limite continua 4 GB
        sti

        mov esi, 200000h                ; 2 MB
        mov dword [esi], 'UNRE'
        mov dword [esi+4], 'AL!!'
        mov eax, [esi]                  ; lido de volta, do modo real
        mov ebx, [esi+4]
        mov [0B8000h - 0B8000h + 7E00h], eax   ; guarda numa área baixa para conferir
        cli
        hlt

        align 8
gdt:    dq 0
        dq 00CF92000000FFFFh            ; 08h: dados, 4 GB
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
```

Rode passo a passo: depois do segundo `mov cr0, eax` o MODO volta a ser "modo real", e mesmo assim `mov dword [esi], ...` com ESI = 200000h funciona. No .COM do módulo 18 (aula 58), a mesma instrução dava #GP.

:::atencao Frágil de propósito
O unreal mode acaba no primeiro programa que recarregar DS pelo modo protegido (um gerenciador de memória, por exemplo, ou uma interrupção de um driver que entra e sai do modo protegido). E não funciona no modo virtual 8086 do módulo 24: lá, os limites são sempre 64 KB. Era uma técnica para quem controlava a máquina inteira.
:::

## Exercícios

```exercicio
id: a63-1
titulo: Voltar e usar a BIOS
nivel: 2
maquina: 386
modo: boot
--- enunciado
O programa entra no modo protegido de 32 bits e escreve **PM** na tela. Complete a volta ao modo real e, já no modo real, use a **INT 10h, AH = 0Eh** para escrever a letra **R**. A GDT já tem os descritores de 16 bits.
--- inicial
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov ss, ax
        mov sp, 7C00h
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
        mov dword [0B8000h], 1F4D1F50h
        ; volte ao modo real e escreva R com a BIOS

        cli
        hlt
        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh            ; 08h: código 32 bits
        dq 00CF92000000FFFFh            ; 10h: dados 4 GB
        dq 00009A000000FFFFh            ; 18h: código 16 bits
        dq 000092000000FFFFh            ; 20h: dados 16 bits
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
--- testes
[{ "nome": "R escrito pela BIOS", "espera": { "tela": "R", "modoProtegido": false, "cs": 0 } }]
--- dicas
jmp 18h:pm16 / bits 16 / pm16: mov ax, 20h e carregue DS, ES, SS. Depois zere o bit 0 do CR0 e jmp 0:real.
No modo real: zere DS, ES, SS, ponha SP = 7C00h, e mov ax, 0E52h / int 10h.
--- solucao
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        mov ss, ax
        mov sp, 7C00h
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
        mov dword [0B8000h], 1F4D1F50h
        jmp 18h:pm16
        bits 16
pm16:   mov ax, 20h
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov eax, cr0
        and eax, 0FFFFFFFEh
        mov cr0, eax
        jmp 0:real
real:   xor ax, ax
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov sp, 7C00h
        mov ax, 0E52h
        int 10h
        cli
        hlt
        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh
        dq 00CF92000000FFFFh
        dq 00009A000000FFFFh
        dq 000092000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
```

```exercicio
id: a63-2
titulo: Uma cópia acima de 1 MB, do modo real
nivel: 3
maquina: 386
modo: boot
--- enunciado
Use o unreal mode: depois de preparar DS com limite de 4 GB e voltar ao modo real, copie o dword `dado` para o endereço físico **300000h** e, em seguida, leia de 300000h para `copia`. O programa precisa terminar no **modo real**. A A20 já está ligada no início.
--- inicial
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        ; prepare o unreal mode e faça a cópia

        cli
        hlt
dado:   dd 0CAFEBABEh
copia:  dd 0
        align 8
gdt:    dq 0
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
--- testes
[{ "nome": "cópia de ida e volta", "espera": { "mem": { "copia": 3405691582 }, "modoProtegido": false } },
 { "nome": "outro valor", "setup": { "dado": 305419896 }, "espera": { "mem": { "copia": 305419896 }, "modoProtegido": false } }]
--- dicas
lgdt, PE = 1, mov bx, 08h / mov ds, bx, PE = 0, e depois xor bx, bx / mov ds, bx (o limite fica).
mov esi, 300000h / mov eax, [dado] / mov [esi], eax / mov eax, [esi] / mov [copia], eax.
--- solucao
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        in al, 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        lgdt [gdtr]
        mov eax, cr0
        or al, 1
        mov cr0, eax
        mov bx, 08h
        mov ds, bx
        and al, 0FEh
        mov cr0, eax
        xor bx, bx
        mov ds, bx
        mov esi, 300000h
        mov eax, [dado]
        mov [esi], eax
        xor eax, eax
        mov eax, [esi]
        mov [copia], eax
        cli
        hlt
dado:   dd 0CAFEBABEh
copia:  dd 0
        align 8
gdt:    dq 0
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
```

:::resumo
- A CPU confere tipo e limite em cada acesso: passou do limite, #GP (ou #SS na pilha).
- Segmentos por objeto são caros e incômodos; os sistemas de 32 bits usam o **modelo plano** e protegem com paginação.
- Voltar ao modo real no 386: código de 16 bits, dados de 64 KB nos caches, PE = 0, salto far, segmentos do modo real.
- **Unreal mode**: volte com um cache de 4 GB em DS e use endereços de 32 bits no modo real. Não documentado, frágil, e muito usado.
:::
