---
id: aula57
numero: 57
modulo: 18
titulo: Registradores de 32 bits no modo real
subtitulo: EAX a EDI, os prefixos 66h e 67h, e contas que não cabem em 16 bits
duracao: 75 min
objetivos: conhecer os registradores de 32 bits do 386 e como eles contêm os de 16 e de 8; entender o prefixo de tamanho de operando (66h) e quando o montador o põe; somar, multiplicar e dividir com 32 bits num programa do DOS; estender valores com MOVZX, MOVSX, CWDE e CDQ; escrever um número de 32 bits em decimal
---

## O 386 por dentro

Em 1985 a Intel lançou o **80386**. Por fora, ele roda tudo o que o 8086 e o 286 rodavam, no mesmo modo real, com os mesmos segmentos. Por dentro, é uma máquina de 32 bits: os registradores, a unidade aritmética e os endereços têm 32 bits, e o modo protegido ganhou paginação e o modo virtual 8086.

E o melhor para um programador do DOS: **os registradores de 32 bits funcionam no modo real.** Um .COM pode usar EAX, somar números de 4 bilhões e multiplicar 32 × 32 bits, só não pode passar do limite de 64 KB de cada segmento.

```diagrama titulo="EAX contém AX, que contém AH e AL"
 31                    16 15        8 7         0
+------------------------+-----------+-----------+
|   (sem nome próprio)   |    AH     |    AL     |
+------------------------+-----------+-----------+
                         |<------- AX ---------->|
|<-------------------- EAX --------------------->|
```

O mesmo vale para EBX, ECX e EDX. ESI, EDI, EBP e ESP contêm SI, DI, BP e SP (sem metades de 8 bits). O contador de programa virou **EIP** e os flags viraram **EFLAGS**. Não existe nome para a metade de cima: para chegar nela, desloque (`shr eax, 16`) ou gire (`rol eax, 16`).

Escrever em AX não muda a metade de cima de EAX. Isso pega muita gente:

```nasm executar titulo="METADE.COM: AX e EAX"
        org 100h
        mov eax, 12345678h
        mov ax, 0ABCDh          ; EAX = 1234ABCDh: a metade de cima ficou
        mov [r1], eax
        mov al, 0EFh            ; EAX = 1234ABEFh
        mov [r2], eax
        rol eax, 16             ; troca as metades: ABEF1234h
        mov [r3], eax
        mov ax, 4C00h
        int 21h
r1:     dd 0
r2:     dd 0
r3:     dd 0
```

Rode passo a passo e veja EAX mudar no painel.

## O prefixo 66h

Como o mesmo opcode serve para 16 e para 32 bits? O 386 tem um "tamanho padrão" que depende do modo: **16 bits no modo real** (e nos segmentos de código de 16 bits). Para uma instrução usar o outro tamanho, ela leva o byte **66h** na frente, o *prefixo de tamanho de operando*.

| Instrução | Em código de 16 bits | Em código de 32 bits |
|---|---|---|
| `mov ax, bx` | `89 D8` | `66 89 D8` |
| `mov eax, ebx` | `66 89 D8` | `89 D8` |
| `mov eax, 1` | `66 B8 01 00 00 00` | `B8 01 00 00 00` |
| `inc cx` | `41` | `66 41` |

O montador põe o prefixo sozinho: você escreve `eax` e ele sabe. Mas o prefixo custa um byte e, no 386, um ciclo a mais. Num programa de 16 bits cheio de contas de 32, isso soma.

Existe um segundo prefixo, **67h**, de *tamanho de endereço*. Ele aparece quando um endereço usa registradores de 32 bits, como `mov al, [esi]`. É o assunto da próxima aula.

:::cpu Por que 66h?
Os prefixos do 8086 (segmento, REP, LOCK) ocupavam alguns códigos de operação. A Intel precisava de dois bytes livres para os prefixos novos e achou 66h e 67h, que no 8086 eram cópias não documentadas de outras instruções. Um 8086 que encontra 66h faz outra coisa, sem erro nenhum. Por isso um programa que usa registradores de 32 bits precisa conferir antes se está num 386 (aula 60).
:::

## Contas de 32 bits

`add`, `sub`, `and`, `cmp`... funcionam com 32 bits como funcionavam com 16. A multiplicação e a divisão seguem o padrão de sempre, um tamanho acima:

| Instrução | Faz |
|---|---|
| `mul ebx` | EDX:EAX = EAX × EBX (sem sinal) |
| `imul ebx` | o mesmo, com sinal |
| `div ebx` | EAX = EDX:EAX ÷ EBX, EDX = resto |
| `idiv ebx` | o mesmo, com sinal |

O par **EDX:EAX** é um número de 64 bits, com a parte alta em EDX. Antes de um `div ebx`, zere EDX (sem sinal) ou use `cdq` (com sinal), como se fazia `xor dx, dx` ou `cwd` antes de um `div bx`.

Escrever um número de 32 bits em decimal é o mesmo algoritmo da aula sobre números, com registradores maiores: divida por 10 até sobrar zero, empilhando os restos.

```nasm executar titulo="FATOR32.COM: 12! = 479.001.600"
        org 100h
        mov eax, 1
        mov ecx, 12
.mult:  mul ecx                 ; EDX:EAX = EAX * ECX; 12! ainda cabe em EAX
        loop .mult
        call escreve_dec
        mov ax, 4C00h
        int 21h

; escreve EAX em decimal (sem sinal)
escreve_dec:
        mov ebx, 10
        xor cx, cx
.div:   xor edx, edx
        div ebx                 ; EAX = EAX / 10, EDX = algarismo
        push dx
        inc cx
        test eax, eax
        jnz .div
.esc:   pop dx
        add dl, '0'
        mov ah, 2
        int 21h
        loop .esc
        ret
```

Repare que o laço de multiplicação usa `loop`, que no modo real conta com **CX**, não ECX. Funciona porque 12 cabe em CX, mas é uma armadilha: `mov ecx, 70000` seguido de `loop` só olha os 16 bits de baixo. O tamanho do contador do LOOP segue o tamanho de **endereço**, não o de operando.

```quiz
? Depois de mov eax, 0FFFFFFFFh e mov ax, 1, quanto vale EAX?
- 00000001h
+ FFFF0001h
- 0001FFFFh
- FFFFFFFFh
> Escrever em AX troca só os 16 bits de baixo. A metade de cima continua FFFFh.

? Em código de 16 bits, o que diferencia mov eax, ebx de mov ax, bx na memória?
- Um opcode diferente
+ O byte 66h na frente; o resto é igual
- O byte 67h na frente
- Nada: o 386 adivinha o tamanho
> 66h é o prefixo de tamanho de operando: troca 16 por 32 bits (ou o contrário, em código de 32 bits).
```

## Estendendo valores: MOVZX, MOVSX, CWDE e CDQ

Muitas vezes um byte ou uma palavra precisa virar um valor de 32 bits. O 386 trouxe duas instruções para isso, que leem de registrador ou de memória:

- `movzx eax, byte [x]`: estende com **zeros** (para números sem sinal).
- `movsx eax, byte [x]`: estende com o **bit de sinal** (para números com sinal): FFh vira FFFFFFFFh (−1).

As antigas `cbw` (AL → AX) e `cwd` (AX → DX:AX) ganharam irmãs: **`cwde`** (AX → EAX, com sinal) e **`cdq`** (EAX → EDX:EAX, com sinal, a preparação para `idiv`).

```nasm executar titulo="ESTENDE.COM: o mesmo byte, dois valores"
        org 100h
        movzx eax, byte [b]     ; 000000F6h = 246
        mov [sem_sinal], eax
        movsx eax, byte [b]     ; FFFFFFF6h = -10
        mov [com_sinal], eax
        cdq                     ; EDX = FFFFFFFFh
        mov ebx, 3
        idiv ebx                ; -10 / 3 = -3, resto -1
        mov [quoc], eax
        mov [resto], edx
        mov ax, 4C00h
        int 21h
b:          db 0F6h
sem_sinal:  dd 0
com_sinal:  dd 0
quoc:       dd 0
resto:      dd 0
```

:::dica A BIOS e o DOS não estragam a metade de cima
A BIOS e o DOS foram escritos para o 8086 e só mexem em registradores de 16 bits. Na prática, a metade de cima de EAX, EBX etc. sobrevive a um `int 21h`. Não há garantia escrita, mas todo programa de 32 bits do DOS contou com isso, e os DOS extenders também. O que não sobrevive é o que a função devolve: `int 21h` com AH = 9 devolve AL = 24h, por exemplo.
:::

## Exercícios

```exercicio
id: a57-1
titulo: Somar um vetor de dwords
nivel: 1
maquina: 386
modo: com
--- enunciado
`vetor` tem **8 números de 32 bits** sem sinal. Guarde a soma em `total` (32 bits). A soma cabe em 32 bits.
--- inicial
        org 100h
        ; total = soma dos 8 dwords de vetor

        mov ax, 4C00h
        int 21h
vetor:  dd 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000
total:  dd 0
--- testes
[{ "nome": "100000 a 800000", "espera": { "mem": { "total": 3600000 } } },
 { "nome": "números grandes", "setup": { "vetor": [0, 0, 0, 64, 0, 0, 0, 64, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 15] }, "espera": { "mem": { "total": 2415919104 } } }]
--- dicas
Some em EAX: xor eax, eax, depois add eax, [si] com SI avançando de 4 em 4.
mov [total], eax no fim. Use CX = 8 como contador.
--- solucao
        org 100h
        xor eax, eax
        mov si, vetor
        mov cx, 8
.laco:  add eax, [si]
        add si, 4
        loop .laco
        mov [total], eax
        mov ax, 4C00h
        int 21h
vetor:  dd 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000
total:  dd 0
```

```exercicio
id: a57-2
titulo: Escrever um número de 32 bits
nivel: 2
maquina: 386
modo: com
--- enunciado
Escreva na tela, em decimal, o número de 32 bits sem sinal que está em `numero`, usando a função 2 do DOS (um caractere em DL). Sem zeros à esquerda: zero se escreve "0".
--- inicial
        org 100h
        mov eax, [numero]
        ; escreva EAX em decimal

        mov ax, 4C00h
        int 21h
numero: dd 4000000000
--- testes
[{ "nome": "4000000000", "espera": { "saida": "4000000000" } },
 { "nome": "o maior: 4294967295", "setup": { "numero": 4294967295 }, "espera": { "saida": "4294967295" } },
 { "nome": "zero", "setup": { "numero": 0 }, "espera": { "saida": "0" } },
 { "nome": "65536", "setup": { "numero": 65536 }, "espera": { "saida": "65536" } }]
--- dicas
Divida EDX:EAX por 10 com EDX = 0 antes de cada div: o resto (em EDX) é o algarismo da direita. Empilhe e conte.
Use um laço do-while (testa depois de dividir), assim o zero vira "0".
--- solucao
        org 100h
        mov eax, [numero]
        mov ebx, 10
        xor cx, cx
.div:   xor edx, edx
        div ebx
        push dx
        inc cx
        test eax, eax
        jnz .div
.esc:   pop dx
        add dl, '0'
        mov ah, 2
        int 21h
        loop .esc
        mov ax, 4C00h
        int 21h
numero: dd 4000000000
```

```exercicio
id: a57-3
titulo: 32 × 32 = 64 bits
nivel: 2
maquina: 386
modo: com
exigir: MUL
--- enunciado
Multiplique os dois números de 32 bits sem sinal `a` e `b` e guarde o produto de **64 bits** em `prod_baixo` (os 32 bits de baixo) e `prod_alto` (os de cima).
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
a:          dd 100000
b:          dd 300000
prod_baixo: dd 0
prod_alto:  dd 0
--- testes
[{ "nome": "100000 x 300000", "espera": { "mem": { "prod_baixo": 4230196224, "prod_alto": 6 } } },
 { "nome": "FFFFFFFFh x FFFFFFFFh", "setup": { "a": 4294967295, "b": 4294967295 }, "espera": { "mem": { "prod_baixo": 1, "prod_alto": 4294967294 } } },
 { "nome": "pequeno", "setup": { "a": 7, "b": 6 }, "espera": { "mem": { "prod_baixo": 42, "prod_alto": 0 } } }]
--- dicas
mov eax, [a] / mul dword [b]: o produto fica em EDX:EAX.
O NASM precisa do dword em mul dword [b], porque a memória sozinha não diz o tamanho.
--- solucao
        org 100h
        mov eax, [a]
        mul dword [b]
        mov [prod_baixo], eax
        mov [prod_alto], edx
        mov ax, 4C00h
        int 21h
a:          dd 100000
b:          dd 300000
prod_baixo: dd 0
prod_alto:  dd 0
```

```exercicio
id: a57-4
titulo: Média de bytes com sinal
nivel: 2
maquina: 386
modo: com
exigir: MOVSX
--- enunciado
`temp` tem **10 temperaturas** em bytes com sinal (de −128 a 127). Calcule a soma em 32 bits com sinal em `soma` e a média (soma ÷ 10, truncada em direção a zero, como o IDIV faz) em `media`, também 32 bits.
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
temp:   db 20, 22, -5, -10, 31, 15, 0, -2, 8, 11
soma:   dd 0
media:  dd 0
--- testes
[{ "nome": "temperaturas mistas", "espera": { "mem": { "soma": 90, "media": 9 } } },
 { "nome": "todas negativas", "setup": { "temp": [246, 246, 246, 246, 246, 246, 246, 246, 246, 241] }, "espera": { "mem": { "soma": -105, "media": -10 } } },
 { "nome": "extremos", "setup": { "temp": [128, 128, 128, 128, 128, 127, 127, 127, 127, 127] }, "espera": { "mem": { "soma": -5, "media": 0 } } }]
--- dicas
movsx eax, byte [si] estende cada byte com o sinal; some em EBX.
Para a média: mov eax, ebx / cdq / mov ecx, 10 / idiv ecx.
--- solucao
        org 100h
        xor ebx, ebx
        mov si, temp
        mov cx, 10
.laco:  movsx eax, byte [si]
        add ebx, eax
        inc si
        loop .laco
        mov [soma], ebx
        mov eax, ebx
        cdq
        mov ecx, 10
        idiv ecx
        mov [media], eax
        mov ax, 4C00h
        int 21h
temp:   db 20, 22, -5, -10, 31, 15, 0, -2, 8, 11
soma:   dd 0
media:  dd 0
```

:::resumo
- O 386 tem EAX, EBX, ECX, EDX, ESI, EDI, EBP, ESP, EIP e EFLAGS, e eles funcionam no modo real.
- AX é a metade de baixo de EAX; escrever em AX não muda a de cima.
- No código de 16 bits, uma instrução de 32 bits leva o prefixo **66h**. O montador põe sozinho.
- `mul`/`div` de 32 bits usam **EDX:EAX**. Zere EDX ou use `cdq` antes de dividir.
- `movzx` estende com zeros, `movsx` com o sinal; `cwde` e `cdq` são as versões de 32 bits de `cbw` e `cwd`.
- `loop` conta com CX no código de 16 bits, mesmo que você tenha posto o valor em ECX.
:::
