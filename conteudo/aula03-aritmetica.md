---
id: aula03
numero: 3
modulo: 1
titulo: Aritmética: INC, DEC, ADD, SUB, ADC e SBB
subtitulo: Somar e subtrair em 8, 16 e 32 bits
duracao: 55 min
objetivos: somar e subtrair com ADD e SUB; incrementar e decrementar com INC e DEC; entender o que acontece quando o resultado não cabe (a "volta" do contador); somar números de 32 bits com ADC e SBB; multiplicar por constantes pequenas usando só somas
---

## ADD e SUB

As duas instruções aritméticas mais simples têm a mesma forma de `MOV`:

```asm fragmento
        ADD  destino, origem    ; destino = destino + origem
        SUB  destino, origem    ; destino = destino - origem
```

O resultado **substitui o destino**. Não existe uma instrução "C = A + B" com três operandos: se você quer preservar o valor original, copie antes.

As combinações válidas são as mesmas de `MOV` (sem os registradores de segmento): registrador com registrador, com imediato ou com memória, e memória com registrador ou imediato. Memória com memória, de novo, não existe.

```asm executar titulo="Contas simples"
        MOV  AX, 100
        ADD  AX, 50      ; AX = 150
        MOV  BX, 30
        SUB  AX, BX      ; AX = 120
        ADD  BX, BX      ; BX = 60 (dobrou)
        MOV  CL, 200
        ADD  CL, 100     ; CL = 44 ! (300 não cabe em 8 bits)
```

A última linha merece atenção.

## Quando o resultado não cabe

Um registrador de 8 bits vai de 0 a 255. O que acontece com 200 + 100 = 300? O 8086 faz a conta com todos os bits, mas só guarda os **8 bits de baixo**:

```diagrama titulo="200 + 100 em 8 bits"
       1100 1000      (200)
   +   0110 0100      (100)
   ─────────────
     1 0010 1100      (300 em 9 bits)
     │ └───┬───┘
     │     └── fica em CL: 0010 1100 = 44
     └──────── o bit que "sobrou" vai para a flag CF (carry)
```

O resultado **dá a volta**, como um hodômetro de carro: depois de 255 vem 0. Em 16 bits, depois de 65.535 (FFFFh) vem 0. Isso não é um erro da CPU: é aritmética **módulo 256** (ou módulo 65.536). O bit que sobra não se perde por completo: ele fica na flag **CF** (*carry*, vai-um), que você vai estudar na próxima aula.

O mesmo vale para a subtração: em 8 bits, 5 − 10 dá 251 (= 256 − 5) e CF indica que houve "empréstimo".

## INC e DEC

Somar e subtrair 1 é tão comum que existe uma instrução para cada:

```asm fragmento
        INC  CX          ; CX = CX + 1
        DEC  BYTE PTR [BX] ; byte na memória = byte - 1
```

`INC` e `DEC` têm duas vantagens sobre `ADD reg,1`:

- `INC` de um registrador de 16 bits ocupa **1 byte** (contra 3 de `ADD AX,1`) e leva 2 ciclos.
- `INC` e `DEC` **não alteram a flag CF**. Isso parece um detalhe, mas permite usar `INC` como contador no meio de contas de vários bytes que dependem de CF. Voltaremos a isso.

## Somando números maiores que 16 bits: ADC

E se você precisar somar números de 32 bits, como 100.000 + 200.000? Nenhum registrador do 8086 tem 32 bits, mas você pode guardar cada número em **dois** registradores: a convenção é usar **DX:AX**, com DX como metade alta e AX como metade baixa.

Para somar, some primeiro as metades baixas. Se der vai-um, ele precisa entrar na soma das metades altas. É exatamente o que `ADC` (*add with carry*) faz:

```asm fragmento
        ADC  destino, origem    ; destino = destino + origem + CF
```

```asm executar titulo="Soma de 32 bits: 100000 + 200000"
; DX:AX = 100000 = 0001 86A0h
; CX:BX = 200000 = 0003 0D40h
        MOV  DX, 0001h
        MOV  AX, 86A0h
        MOV  CX, 0003h
        MOV  BX, 0D40h

        ADD  AX, BX      ; soma as partes baixas; o vai-um vai para CF
        ADC  DX, CX      ; soma as partes altas + CF
; resultado: DX:AX = 0004 93E0h = 300000
```

Execute e confira: 86A0h + 0D40h = 93E0h sem vai-um, e 1 + 3 = 4. Agora experimente trocar `AX` para `0F000h`: a soma baixa estoura, CF fica 1, e o `ADC` soma esse 1 na parte alta.

Do mesmo jeito, `SBB` (*subtract with borrow*) subtrai considerando o empréstimo: `SUB` nas partes baixas, `SBB` nas altas.

:::anos90 32 bits em uma máquina de 16
Placares de jogos, tamanhos de arquivo e contadores de tempo passavam de 65.535 o tempo todo. Por isso os programadores dos anos 80 usavam pares de registradores e `ADC`/`SBB` com naturalidade. O próprio DOS devolve tamanhos de arquivo em pares de registradores (como CX:DX), e o contador de tempo da BIOS é um número de 32 bits em CX:DX.
:::

## Multiplicar por constante só com somas

Multiplicar é caro no 8086 (`MUL` leva mais de 100 ciclos). Para constantes pequenas, somas resolvem:

```asm executar titulo="AX vezes 5 sem MUL"
        MOV  AX, 7
        MOV  BX, AX      ; BX = x
        ADD  AX, AX      ; AX = 2x
        ADD  AX, AX      ; AX = 4x
        ADD  AX, BX      ; AX = 5x  -> 35
```

Somar um registrador consigo mesmo dobra o valor. Com duplicações e somas dá para multiplicar por qualquer constante. No Módulo 7 vamos fazer isso ainda mais rápido com deslocamentos (`SHL`).

## NEG: trocar o sinal

Para completar, `NEG destino` calcula `0 − destino`. Por enquanto, pense nela como "trocar o sinal": `NEG` de 5 dá −5. A Aula 22 explica como o 8086 representa números negativos.

```quiz
? Depois de MOV AL,250 e ADD AL,10, quanto vale AL?
- 260
+ 4
- 255
> 260 não cabe em 8 bits. Sobra 260 − 256 = 4, e CF fica 1.

? Qual a principal diferença entre INC AX e ADD AX,1?
- INC é mais lento.
+ INC não altera a flag CF (e ocupa menos bytes).
- ADD não funciona com 1.
> INC e DEC preservam CF. INC AX ocupa 1 byte; ADD AX,1 ocupa 3.

? Para somar dois números de 32 bits em DX:AX e CX:BX, a sequência correta é:
- ADC AX,BX e depois ADD DX,CX
+ ADD AX,BX e depois ADC DX,CX
- ADD DX,CX e depois ADD AX,BX
> Primeiro as partes baixas com ADD (gera o vai-um em CF); depois as altas com ADC, que soma CF.

? Qual instrução calcula AX = AX × 3 sem MUL, supondo BX = AX?
- ADD AX, 3
+ ADD AX, AX e depois ADD AX, BX
- INC AX três vezes
> AX + AX = 2x; somando BX (que é x) dá 3x.

? Qual destas é inválida?
- ADD AX, total
- SUB total, 5
+ ADD total, parcial
> Duas memórias na mesma instrução não existem no 8086.
```

## Exercícios

```exercicio
id: a03-1
titulo: Expressão simples
nivel: 1
--- enunciado
**AX** e **BX** chegam com valores. Calcule **DX = AX + BX − 5**, sem alterar AX e BX.
--- inicial
; DX = AX + BX - 5
--- testes
[
 { "nome": "10 + 20 - 5", "setup": { "AX": 10, "BX": 20 }, "espera": { "DX": 25, "AX": 10, "BX": 20 } },
 { "nome": "1000 + 2345 - 5", "setup": { "AX": 1000, "BX": 2345 }, "espera": { "DX": 3340, "AX": 1000, "BX": 2345 } }
]
--- dicas
Comece copiando AX para DX. Depois some BX a DX e subtraia 5.
--- solucao
        MOV  DX, AX
        ADD  DX, BX
        SUB  DX, 5
```

```exercicio
id: a03-2
titulo: Vezes 10 com somas
nivel: 2
proibir: MUL, IMUL
--- enunciado
Multiplique **AX** por **10** usando apenas `MOV` e `ADD` (sem MUL). O resultado fica em AX. Os valores de teste cabem em 16 bits.
--- inicial
; AX = AX * 10
--- testes
[
 { "nome": "7 x 10", "setup": { "AX": 7 }, "espera": { "AX": 70 } },
 { "nome": "123 x 10", "setup": { "AX": 123 }, "espera": { "AX": 1230 } },
 { "nome": "6553 x 10", "setup": { "AX": 6553 }, "espera": { "AX": 65530 } }
]
--- dicas
10x = 8x + 2x.
Dobre AX uma vez e guarde (2x). Dobre mais duas vezes (8x) e some o que guardou.
--- solucao
        ADD  AX, AX      ; 2x
        MOV  BX, AX      ; guarda 2x
        ADD  AX, AX      ; 4x
        ADD  AX, AX      ; 8x
        ADD  AX, BX      ; 10x
```

```exercicio
id: a03-3
titulo: Soma de 32 bits
nivel: 2
--- enunciado
Some o número de 32 bits em **CX:BX** ao número em **DX:AX**. O resultado fica em **DX:AX**.
--- inicial
; DX:AX = DX:AX + CX:BX
--- testes
[
 { "nome": "100000 + 200000", "setup": { "DX": 1, "AX": 34464, "CX": 3, "BX": 3392 }, "espera": { "DX": 4, "AX": 37856 } },
 { "nome": "0001FFFFh + 1 (vai-um)", "setup": { "DX": 1, "AX": 65535, "CX": 0, "BX": 1 }, "espera": { "DX": 2, "AX": 0 } },
 { "nome": "1234F000h + 00012000h", "setup": { "DX": 4660, "AX": 61440, "CX": 1, "BX": 8192 }, "espera": { "DX": 4662, "AX": 4096 } }
]
--- dicas
ADD nas partes baixas, ADC nas altas.
--- solucao
        ADD  AX, BX
        ADC  DX, CX
```

```exercicio
id: a03-4
titulo: Subtração de 32 bits
nivel: 3
--- enunciado
Subtraia **CX:BX** de **DX:AX** (DX:AX = DX:AX − CX:BX). Use `SUB` e `SBB`.
--- inicial
; DX:AX = DX:AX - CX:BX
--- testes
[
 { "nome": "300000 - 200000", "setup": { "DX": 4, "AX": 37856, "CX": 3, "BX": 3392 }, "espera": { "DX": 1, "AX": 34464 } },
 { "nome": "00020000h - 1 (empréstimo)", "setup": { "DX": 2, "AX": 0, "CX": 0, "BX": 1 }, "espera": { "DX": 1, "AX": 65535 } }
]
--- dicas
É igual à soma, trocando ADD por SUB e ADC por SBB.
--- solucao
        SUB  AX, BX
        SBB  DX, CX
```

:::resumo
- `ADD` e `SUB` guardam o resultado no destino; não existe memória com memória.
- Resultados que não cabem dão a volta (módulo 256 ou 65.536) e o bit extra vai para CF.
- `INC`/`DEC` somam/subtraem 1 sem alterar CF.
- Números de 32 bits: par DX:AX; `ADD`+`ADC` para somar, `SUB`+`SBB` para subtrair.
- Somar um valor a ele mesmo dobra: base para multiplicar por constantes.
:::
