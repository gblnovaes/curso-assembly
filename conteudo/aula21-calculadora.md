---
id: aula21
numero: 21
modulo: 8
titulo: Projeto, a calculadora de 32 bits
subtitulo: MUL e DIV a fundo, aritmética de precisão múltipla e IMPRIMIR_U32
duracao: 90 min
objetivos: dominar as formas de 8 e 16 bits de MUL e DIV e onde ficam os resultados; evitar o "Divide overflow" verificando o divisor antes; somar, subtrair e deslocar números de 32 bits com ADC, SBB e RCL; dividir um número de 32 bits em duas etapas; imprimir números de 32 bits com IMPRIMIR_U32; montar uma calculadora completa
---

## MUL e DIV, a tabela completa

Você já usou `MUL` e `DIV` várias vezes. Agora vamos olhar todas as formas, porque é aqui que mora a maioria dos erros de aritmética:

| Instrução | Operando | Faz | Resultado |
|-----------|----------|-----|-----------|
| `MUL r/m8` | byte | AL × operando | **AX** (16 bits) |
| `MUL r/m16` | word | AX × operando | **DX:AX** (32 bits) |
| `DIV r/m8` | byte | AX ÷ operando | quociente em **AL**, resto em **AH** |
| `DIV r/m16` | word | DX:AX ÷ operando | quociente em **AX**, resto em **DX** |

Três regras que evitam horas de depuração:

1. **O operando nunca é imediato.** `MUL 10` não existe no 8086. Coloque o 10 num registrador.
2. **`MUL` de 16 bits sempre destrói DX**, mesmo quando o resultado cabe em AX.
3. **`DIV` sempre usa o dobro do tamanho do operando como dividendo.** `DIV BX` divide DX:AX, então DX precisa estar certo (normalmente zero). `DIV BL` divide AX inteiro, então AH também precisa estar certo.

```diagrama titulo="Onde ficam os operandos"
  MUL BL:   AL  ×  BL  ──►  AH:AL            DIV BL:   AH:AL  ÷ BL ──► AL quociente
                                                                       AH resto
  MUL BX:   AX  ×  BX  ──►  DX:AX            DIV BX:   DX:AX  ÷ BX ──► AX quociente
                                                                       DX resto
```

### Quanto custa

| Instrução | Ciclos (registrador) |
|-----------|----------------------|
| `MUL r8` | 70 a 77 |
| `MUL r16` | 118 a 133 |
| `DIV r8` | 80 a 90 |
| `DIV r16` | 144 a 162 |

Uma única divisão de 16 bits custa tanto quanto umas 50 somas. É por isso que a Aula 16 insistiu em trocar multiplicações e divisões por deslocamentos sempre que possível.

## O Divide overflow e como evitá-lo

O `DIV` gera a **interrupção 0** em dois casos:

- o divisor é **zero**;
- o quociente **não cabe** no registrador de destino (AL ou AX).

O segundo caso pega muita gente. `DIV BL` com AX = 1000 e BL = 2 dá quociente 500, que não cabe em AL, e o programa morre com "Divide overflow", mesmo sem nenhuma divisão por zero.

A regra para verificar **antes** de dividir: na divisão de 16 bits, o quociente cabe em AX **se e somente se DX < divisor** (sem sinal). Na de 8 bits, se AH < divisor.

```asm fragmento
; divide DX:AX por BX com segurança. CF = 1 se a divisão é impossível.
        CMP  DX, BX         ; DX >= BX? (cobre também BX = 0)
        JAE  @@erro
        DIV  BX             ; agora é garantido
```

Repare que essa única comparação também pega a divisão por zero: se BX = 0, qualquer DX é ≥ BX.

:::cpu Por que DX < divisor garante
O quociente de DX:AX ÷ BX cabe em 16 bits quando DX:AX < BX × 65.536, ou seja, quando DX:AX < BX:0000. Comparar os 32 bits com BX:0000 é o mesmo que comparar DX com BX: se DX < BX, o número inteiro é menor. Uma comparação de 16 bits resolve uma pergunta de 32.
:::

## Aritmética de 32 bits

Com registradores de 16 bits, números maiores ocupam **dois registradores** (ou duas words na memória). A convenção é usar **DX:AX**, com DX na parte alta. Na memória, a parte baixa vem primeiro (little-endian), e a diretiva `DD` declara 32 bits:

```asm fragmento
grande  DD 123456           ; na memória: 40h E2h 01h 00h (1E240h)
        MOV  AX, WORD PTR grande       ; parte baixa: E240h
        MOV  DX, WORD PTR grande+2     ; parte alta:  0001h
```

As instruções com **carry** encadeiam as operações:

| Operação | Parte baixa | Parte alta |
|----------|-------------|------------|
| Somar CX:BX a DX:AX | `ADD AX, BX` | `ADC DX, CX` (soma o vai-um) |
| Subtrair CX:BX de DX:AX | `SUB AX, BX` | `SBB DX, CX` (subtrai o empréstimo) |
| Deslocar DX:AX 1 bit à esquerda | `SHL AX, 1` | `RCL DX, 1` (entra o bit que saiu de AX) |
| Deslocar DX:AX 1 bit à direita | `SHR DX, 1` (a alta primeiro!) | `RCR AX, 1` |

```diagrama titulo="RCL: o carry como ponte"
  SHL AX,1:   CF ◄── [ AX ] ◄── 0         o bit 15 de AX vai para CF
  RCL DX,1:   CF ◄── [ DX ] ◄── CF        o CF anterior entra no bit 0 de DX

  juntos: CF ◄── [ DX | AX ] ◄── 0        um deslocamento de 32 bits
```

O mesmo padrão escala para 48, 64 ou 128 bits: a primeira operação sem carry, todas as seguintes com carry. Era assim que programas de criptografia, calculadoras científicas e o *Fractint* (o famoso gerador de fractais) faziam contas de alta precisão no 8086.

## Dividindo 32 bits por 16: a divisão longa

`DIV BX` divide DX:AX, mas o quociente precisa caber em 16 bits. E se quisermos dividir 4.000.000 por 10? O quociente (400.000) não cabe. A solução é a mesma da divisão longa do papel: **dividir uma "casa" de cada vez**, levando o resto para a próxima.

```diagrama titulo="Divisão longa: DX:AX ÷ BX em duas etapas"
  número = ALTA : BAIXA     (duas words)

  etapa 1:  0    : ALTA   ÷ BX  ──►  quociente alto, resto r
  etapa 2:  r    : BAIXA  ÷ BX  ──►  quociente baixo, resto final

  como r < BX, a etapa 2 nunca estoura!
```

```asm fragmento
; DIV32: DX:AX ÷ BX -> DX:AX = quociente (32 bits), CX = resto
        MOV  CX, AX         ; guarda a parte baixa
        MOV  AX, DX
        XOR  DX, DX         ; etapa 1: 0:ALTA ÷ BX
        DIV  BX             ; AX = quociente alto, DX = resto
        XCHG AX, CX         ; CX = quociente alto, AX = parte baixa
        DIV  BX             ; etapa 2: resto:BAIXA ÷ BX
        XCHG CX, DX         ; DX = quociente alto, CX = resto
```

## IMPRIMIR_U32

Com a divisão longa, imprimir 32 bits fica igual ao `IMPRIMIR_NUMERO` da Aula 11: dividir por 10 até o quociente zerar, empilhando os restos. A diferença é que cada "divisão por 10" agora é a divisão em duas etapas, e o teste de fim olha as duas metades do quociente.

```asm executar titulo="U32.ASM: imprimindo números de 32 bits"
.MODEL SMALL
.STACK 100h
.DATA
populacao DD 4000000000         ; maior que 65535!
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, WORD PTR populacao
        MOV  DX, WORD PTR populacao+2
        CALL IMPRIMIR_U32
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_U32: imprime DX:AX (0..4294967295) em decimal. Preserva tudo.
IMPRIMIR_U32 PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  BX, 10
        XOR  SI, SI             ; SI conta os dígitos
@@divide:
        MOV  CX, AX             ; guarda a parte baixa
        MOV  AX, DX
        XOR  DX, DX
        DIV  BX                 ; AX = alta / 10, DX = resto
        XCHG AX, CX             ; CX = quociente alto, AX = parte baixa
        DIV  BX                 ; AX = quociente baixo, DX = dígito
        PUSH DX                 ; guarda o dígito
        INC  SI
        MOV  DX, CX             ; DX:AX = quociente completo
        MOV  CX, DX
        OR   CX, AX             ; quociente = 0?
        JNZ  @@divide
        MOV  CX, SI
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_U32 ENDP
END inicio
```

Repare no teste de fim: `MOV CX,DX` / `OR CX,AX` liga ZF só se **as duas metades** forem zero, sem estragar DX:AX.

```quiz
? Onde fica o resultado de MUL BX?
- Em AX
+ Em DX:AX
- Em BX:AX
> Multiplicar duas words pode dar até 32 bits: a parte alta vai para DX e a baixa para AX.

? DIV BL com AX = 1000 e BL = 2: o que acontece?
- AL = 500, AH = 0
+ Divide overflow: o quociente 500 não cabe em AL
- AX = 500
> A divisão de 8 bits põe o quociente em AL, que só vai até 255.

? Qual comparação garante que DIV BX não vai estourar?
+ DX < BX (sem sinal)
- AX < BX
- BX ≠ 0
> Se DX < BX, o quociente cabe em 16 bits. E BX = 0 também falha nesse teste, então ele cobre a divisão por zero.

? Para somar dois números de 32 bits, qual instrução vai na parte alta?
- ADD
+ ADC
- SBB
> ADC soma também o vai-um que a parte baixa produziu.

? Para deslocar DX:AX um bit para a esquerda, qual a sequência?
- SHL DX,1 / SHL AX,1
+ SHL AX,1 / RCL DX,1
- RCL AX,1 / SHL DX,1
> O bit que sai do topo de AX vai para CF, e o RCL o coloca no bit 0 de DX.
```

## A calculadora

Agora juntamos tudo: a leitura com validação da Aula 19, as quatro operações e a impressão de 32 bits. A soma e a multiplicação podem passar de 65.535, então o resultado é sempre impresso como 32 bits. A subtração trata resultado negativo imprimindo o sinal, e a divisão mostra o resto e recusa a divisão por zero.

```asm executar titulo="CALC.ASM: calculadora de 32 bits"
; ------------------------------------------------------------
; CALC.ASM - calculadora: A op B, com A e B de 0 a 65535
; ------------------------------------------------------------
.MODEL SMALL
.STACK 200h
.DATA
p_a     DB 13, 10, 'Primeiro numero: $'
p_op    DB 13, 10, 'Operacao (+ - * /): $'
p_b     DB 13, 10, 'Segundo numero: $'
igual   DB 13, 10, '= $'
t_resto DB ' resto $'
t_zero  DB 13, 10, 'Erro: divisao por zero!$'
t_inval DB 13, 10, 'Entrada invalida, digite de novo.$'
buf     DB 7, ?, 7 DUP(?)
a       DW 0
b       DW 0
op      DB 0
.CODE
principal PROC
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  DX, OFFSET p_a
        CALL LER_NUMERO
        MOV  a, AX
@@le_op:
        MOV  DX, OFFSET p_op
        MOV  AH, 09h
        INT  21h
        MOV  AH, 01h            ; lê a operação com eco
        INT  21h
        CMP  AL, '+'
        JE   @@op_ok
        CMP  AL, '-'
        JE   @@op_ok
        CMP  AL, '*'
        JE   @@op_ok
        CMP  AL, '/'
        JNE  @@le_op
@@op_ok:
        MOV  op, AL
        MOV  DX, OFFSET p_b
        CALL LER_NUMERO
        MOV  b, AX

        MOV  AX, a
        MOV  BX, b
        CMP  op, '+'
        JE   @@soma
        CMP  op, '-'
        JE   @@subtrai
        CMP  op, '*'
        JE   @@multiplica

        ; divisão
        TEST BX, BX
        JZ   @@por_zero
        XOR  DX, DX
        DIV  BX                 ; AX = quociente, DX = resto
        PUSH DX
        CALL MOSTRA_IGUAL
        XOR  DX, DX
        CALL IMPRIMIR_U32
        MOV  DX, OFFSET t_resto
        MOV  AH, 09h
        INT  21h
        POP  AX
        XOR  DX, DX
        CALL IMPRIMIR_U32
        JMP  @@fim
@@por_zero:
        MOV  DX, OFFSET t_zero
        MOV  AH, 09h
        INT  21h
        JMP  @@fim
@@soma:
        XOR  DX, DX
        ADD  AX, BX
        ADC  DX, 0              ; vai-um para a parte alta
        JMP  @@mostra
@@subtrai:
        XOR  DX, DX
        SUB  AX, BX
        JAE  @@mostra           ; sem empréstimo: resultado >= 0
        NEG  AX                 ; |a - b|
        PUSH AX
        CALL MOSTRA_IGUAL
        MOV  DL, '-'
        MOV  AH, 02h
        INT  21h
        POP  AX
        XOR  DX, DX
        CALL IMPRIMIR_U32
        JMP  @@fim
@@multiplica:
        MUL  BX                 ; DX:AX = a * b
@@mostra:
        CALL MOSTRA_IGUAL
        CALL IMPRIMIR_U32
@@fim:  MOV  AX, 4C00h
        INT  21h
principal ENDP

; MOSTRA_IGUAL: imprime a linha "= ". Preserva tudo.
MOSTRA_IGUAL PROC
        PUSH AX
        PUSH DX
        MOV  DX, OFFSET igual
        MOV  AH, 09h
        INT  21h
        POP  DX
        POP  AX
        RET
MOSTRA_IGUAL ENDP

; LER_NUMERO: mostra a pergunta em DS:DX e lê um número de 0 a 65535.
; Repete até a entrada ser válida. Devolve AX.
LER_NUMERO PROC
        PUSH DX
        PUSH SI
@@pergunta:
        PUSH DX
        MOV  AH, 09h
        INT  21h
        MOV  DX, OFFSET buf
        MOV  AH, 0Ah
        INT  21h
        POP  DX
        MOV  SI, OFFSET buf
        CALL CONVERTER
        JNC  @@ok
        PUSH DX
        MOV  DX, OFFSET t_inval
        MOV  AH, 09h
        INT  21h
        POP  DX
        JMP  @@pergunta
@@ok:   POP  SI
        POP  DX
        RET
LER_NUMERO ENDP

; CONVERTER: SI = buffer 0Ah -> AX = número, CF = 1 se inválido (Aula 19)
CONVERTER PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        XOR  AX, AX
        MOV  CL, [SI+1]
        XOR  CH, CH
        JCXZ @@erro
        ADD  SI, 2
        MOV  BX, 10
@@laco: MOV  DL, [SI]
        CMP  DL, '0'
        JB   @@erro
        CMP  DL, '9'
        JA   @@erro
        PUSH DX
        MUL  BX
        POP  DX
        JC   @@erro
        SUB  DL, '0'
        ADD  AL, DL
        ADC  AH, 0
        JC   @@erro
        INC  SI
        LOOP @@laco
        CLC
        JMP  @@sai
@@erro: STC
@@sai:  POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
CONVERTER ENDP

; IMPRIMIR_U32: imprime DX:AX em decimal. Preserva tudo.
IMPRIMIR_U32 PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  BX, 10
        XOR  SI, SI
@@divide:
        MOV  CX, AX
        MOV  AX, DX
        XOR  DX, DX
        DIV  BX
        XCHG AX, CX
        DIV  BX
        PUSH DX
        INC  SI
        MOV  DX, CX
        MOV  CX, DX
        OR   CX, AX
        JNZ  @@divide
        MOV  CX, SI
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_U32 ENDP

        END principal
```

Experimente no laboratório: `65535 * 65535` (dá 4.294.836.225), `100 - 250`, `1000 / 7` e `5 / 0`.

:::anos90 Calculadoras de verdade usavam BCD
Somar e multiplicar inteiros é a parte fácil. Para valores com casas decimais, como dinheiro, o binário traz um problema: 0,1 não tem representação exata em binário, e os arredondamentos aparecem na tela. Por isso calculadoras, sistemas bancários e planilhas da época guardavam os números em **BCD** (decimal codificado em binário), um dígito decimal por nibble. O 8086 tem instruções feitas para isso, como `DAA` e `AAA`, assunto da [aula 30](aula:aula30).
:::

## Exercícios

```exercicio
id: a21-1
titulo: IMPRIMIR_U32
nivel: 3
exigir: DIV
--- enunciado
Escreva **IMPRIMIR_U32**, que imprime em decimal o número de 32 bits sem sinal em **DX:AX** (de 0 a 4.294.967.295). Os valores chegam em DX e AX quando o programa começa.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL IMPRIMIR_U32
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_U32: imprime DX:AX em decimal
IMPRIMIR_U32 PROC
        ; seu código aqui
        RET
IMPRIMIR_U32 ENDP
END inicio
--- testes
[{ "nome": "0", "setup": { "DX": 0, "AX": 0 }, "espera": { "saida": "0", "pilhaEquilibrada": true } },
 { "nome": "65536", "setup": { "DX": 1, "AX": 0 }, "espera": { "saida": "65536" } },
 { "nome": "1234567", "setup": { "DX": 18, "AX": 54919 }, "espera": { "saida": "1234567" } },
 { "nome": "4294967295", "setup": { "DX": 65535, "AX": 65535 }, "espera": { "saida": "4294967295" } },
 { "nome": "100000", "setup": { "DX": 1, "AX": 34464 }, "espera": { "saida": "100000" } }]
--- dicas
Cada dígito é o resto de uma divisão por 10 do número de 32 bits, feita em duas etapas (divisão longa).
Etapa 1: divida 0:DX por 10 (o resto r fica em DX). Etapa 2: divida r:AX por 10. Guarde o quociente alto da etapa 1 em outro registrador.
Empilhe cada resto e conte os dígitos; pare quando as duas metades do quociente forem zero.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL IMPRIMIR_U32
        MOV  AX, 4C00h
        INT  21h

IMPRIMIR_U32 PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  BX, 10
        XOR  SI, SI
@@divide:
        MOV  CX, AX
        MOV  AX, DX
        XOR  DX, DX
        DIV  BX
        XCHG AX, CX
        DIV  BX
        PUSH DX
        INC  SI
        MOV  DX, CX
        MOV  CX, DX
        OR   CX, AX
        JNZ  @@divide
        MOV  CX, SI
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_U32 ENDP
END inicio
```

```exercicio
id: a21-2
titulo: Soma de 32 bits
nivel: 2
--- enunciado
Some os números de 32 bits **a** e **b** e guarde o resultado em **c**. Se a soma passar de 32 bits, coloque **1** em **estouro** (senão, 0).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
a       DD 100000
b       DD 250000
c       DD 0
estouro DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "100000 + 250000 = 350000", "espera": { "mem": { "c": [22320, 5], "estouro": 0 } } },
 { "nome": "FFFFh + 1 (vai-um entre as metades)", "setup": { "a": [65535, 0], "b": [1, 0] }, "espera": { "mem": { "c": [0, 1], "estouro": 0 } } },
 { "nome": "estouro de 32 bits", "setup": { "a": [65535, 65535], "b": [2, 0] }, "espera": { "mem": { "c": [1, 0], "estouro": 1 } } }]
--- dicas
As partes baixas estão em WORD PTR a e WORD PTR b; as altas em WORD PTR a+2 e WORD PTR b+2.
ADD nas partes baixas, ADC nas altas. O CF que sobra depois do ADC indica o estouro.
MOV não altera as flags: grave as duas metades de c antes de testar CF, ou use ADC estouro,0.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
a       DD 100000
b       DD 250000
c       DD 0
estouro DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, WORD PTR a
        MOV  DX, WORD PTR a+2
        ADD  AX, WORD PTR b
        ADC  DX, WORD PTR b+2
        MOV  WORD PTR c, AX
        MOV  WORD PTR c+2, DX
        MOV  estouro, 0
        ADC  estouro, 0     ; CF do último ADC
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a21-3
titulo: Divisão segura
nivel: 2
--- enunciado
Escreva **DIVIDIR**: divide **DX:AX** por **BX**. Se a divisão for possível, devolva o quociente em AX, o resto em DX e **CF = 0**. Se o divisor for zero **ou** o quociente não couber em 16 bits, **não execute o DIV**: devolva **CF = 1**. Os valores chegam em DX, AX e BX quando o programa começa.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
quoc    DW 0
resto   DW 0
erro    DB 0
.CODE
inicio: PUSH AX
        MOV  AX, @DATA
        MOV  DS, AX
        POP  AX
        CALL DIVIDIR
        MOV  quoc, AX
        MOV  resto, DX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

; DIVIDIR: DX:AX / BX -> AX = quociente, DX = resto, CF = 1 se impossível
DIVIDIR PROC
        DIV  BX
        RET
DIVIDIR ENDP
END inicio
--- testes
[{ "nome": "1000 / 7", "setup": { "DX": 0, "AX": 1000, "BX": 7 }, "espera": { "mem": { "quoc": 142, "resto": 6, "erro": 0 } } },
 { "nome": "1000000 / 100", "setup": { "DX": 15, "AX": 16960, "BX": 100 }, "espera": { "mem": { "quoc": 10000, "resto": 0, "erro": 0 } } },
 { "nome": "divisão por zero", "setup": { "DX": 0, "AX": 5, "BX": 0 }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "quociente grande demais", "setup": { "DX": 2, "AX": 0, "BX": 2 }, "espera": { "mem": { "erro": 1 } } }]
--- dicas
Uma comparação resolve os dois casos de erro: o DIV é seguro quando DX < BX (sem sinal).
CMP DX,BX / JAE erro. No caminho de sucesso, DIV BX e CLC; no de erro, STC.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
quoc    DW 0
resto   DW 0
erro    DB 0
.CODE
inicio: PUSH AX
        MOV  AX, @DATA
        MOV  DS, AX
        POP  AX
        CALL DIVIDIR
        MOV  quoc, AX
        MOV  resto, DX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

DIVIDIR PROC
        CMP  DX, BX
        JAE  @@erro         ; divisor zero ou quociente grande
        DIV  BX
        CLC
        RET
@@erro: STC
        RET
DIVIDIR ENDP
END inicio
```

```exercicio
id: a21-4
titulo: Vezes 10 em 32 bits
nivel: 3
proibir: MUL, IMUL
--- enunciado
Multiplique o número de 32 bits em **DX:AX** por **10**, sem MUL, deixando o resultado em **DX:AX** (os testes cabem em 32 bits). Use x × 10 = x × 8 + x × 2, com deslocamentos de 32 bits (`SHL`/`RCL`) e soma de 32 bits (`ADD`/`ADC`). Pode usar BX e CX.
--- inicial
; DX:AX = DX:AX * 10
--- testes
[{ "nome": "7 × 10", "setup": { "DX": 0, "AX": 7 }, "espera": { "DX": 0, "AX": 70 } },
 { "nome": "10000 × 10 = 100000", "setup": { "DX": 0, "AX": 10000 }, "espera": { "DX": 1, "AX": 34464 } },
 { "nome": "1234567 × 10 = 12345670", "setup": { "DX": 18, "AX": 54919 }, "espera": { "DX": 188, "AX": 24902 } },
 { "nome": "400000000 × 10", "setup": { "DX": 6103, "AX": 33792 }, "espera": { "DX": 61035, "AX": 10240 } }]
--- dicas
Deslocar DX:AX 1 bit à esquerda: SHL AX,1 / RCL DX,1.
Desloque uma vez (×2) e guarde em CX:BX. Desloque mais duas vezes (×8).
Some CX:BX: ADD AX,BX / ADC DX,CX.
--- solucao
; DX:AX = DX:AX * 10
        SHL  AX, 1
        RCL  DX, 1          ; x2
        MOV  BX, AX
        MOV  CX, DX         ; CX:BX = x2
        SHL  AX, 1
        RCL  DX, 1          ; x4
        SHL  AX, 1
        RCL  DX, 1          ; x8
        ADD  AX, BX
        ADC  DX, CX         ; x8 + x2 = x10
```

:::resumo
- `MUL` de 8 bits: AL × op → AX. De 16: AX × op → DX:AX (DX sempre destruído). Sem operando imediato.
- `DIV` de 8 bits: AX ÷ op → AL, AH. De 16: DX:AX ÷ op → AX, DX. Antes de dividir, garanta DX < divisor (pega também o zero).
- 32 bits em DX:AX: `ADD`/`ADC`, `SUB`/`SBB`, `SHL`/`RCL`, `SHR`/`RCR`. Primeira operação sem carry, as seguintes com.
- Divisão longa: divida a parte alta, leve o resto para a divisão da parte baixa. É a base de `IMPRIMIR_U32`.
:::
