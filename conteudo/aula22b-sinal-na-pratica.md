---
id: aula22b
numero: 22.5
modulo: 8
rotulo: 22B
titulo: Aritmética com sinal na prática
subtitulo: Imprimir, ler e calcular com números negativos
duracao: 50 min
objetivos: imprimir números com sinal de 16 e 32 bits; negar um número de 32 bits com NEG e SBB; ler números negativos digitados; montar a calculadora com sinal da faixa −999 a 999
prerequisitos: aula22
---

Na [Aula 22](aula:aula22) você viu como o 8086 representa os negativos e quais instruções e saltos usar com eles. Agora vamos colocar isso para trabalhar: imprimir e ler números com sinal e terminar a calculadora da [Aula 21](aula:aula21) com números negativos.

## Imprimindo e lendo números com sinal

Com o que já temos, imprimir com sinal é simples: se o número é negativo, imprima o `-`, faça `NEG` e chame a rotina sem sinal. E para 32 bits, o `NEG` de DX:AX usa um truque de três instruções:

```asm fragmento
; NEG de 32 bits em DX:AX
        NEG  DX             ; nega a parte alta
        NEG  AX             ; nega a parte baixa: CF = 1 se AX != 0
        SBB  DX, 0          ; corrige a alta quando a baixa não era zero
```

Para ler, acrescentamos ao conversor da Aula 19 o teste de um `-` no começo: se houver, converta o resto normalmente e faça `NEG` no final.

## A calculadora com sinal

A calculadora abaixo aceita números de **−999 a 999**. Com essa faixa, somas e subtrações cabem em 16 bits, o produto (até 998.001) cabe em 32 bits com sinal e a divisão nunca estoura. O resultado é sempre impresso como 32 bits com sinal.

```asm executar titulo="CALCS.ASM: calculadora com sinal"
; ------------------------------------------------------------
; CALCS.ASM - calculadora com sinal, operandos de -999 a 999
; ------------------------------------------------------------
.MODEL SMALL
.STACK 200h
.DATA
p_a     DB 13, 10, 'Primeiro numero (-999 a 999): $'
p_op    DB 13, 10, 'Operacao (+ - * /): $'
p_b     DB 13, 10, 'Segundo numero (-999 a 999): $'
igual   DB 13, 10, '= $'
t_resto DB ' resto $'
t_zero  DB 13, 10, 'Erro: divisao por zero!$'
t_inval DB 13, 10, 'Entrada invalida.$'
buf     DB 6, ?, 6 DUP(?)
a       DW 0
b       DW 0
op      DB 0
.CODE
principal PROC
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET p_a
        CALL LER_SINAL
        MOV  a, AX
@@le_op:
        MOV  DX, OFFSET p_op
        MOV  AH, 09h
        INT  21h
        MOV  AH, 01h
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
        CALL LER_SINAL
        MOV  b, AX

        MOV  AX, a
        MOV  BX, b
        CMP  op, '+'
        JNE  @@n_soma
        ADD  AX, BX
        CWD                     ; resultado em DX:AX com sinal
        JMP  @@mostra
@@n_soma:
        CMP  op, '-'
        JNE  @@n_sub
        SUB  AX, BX
        CWD
        JMP  @@mostra
@@n_sub:
        CMP  op, '*'
        JNE  @@divide
        IMUL BX                 ; DX:AX = a * b
        JMP  @@mostra
@@divide:
        TEST BX, BX
        JZ   @@por_zero
        CWD                     ; dividendo com sinal em DX:AX
        IDIV BX                 ; AX = quociente, DX = resto
        PUSH DX
        CWD
        CALL MOSTRA_IGUAL
        CALL IMPRIMIR_S32       ; quociente
        MOV  DX, OFFSET t_resto
        MOV  AH, 09h
        INT  21h
        POP  AX
        CWD
        CALL IMPRIMIR_S32       ; resto
        JMP  @@fim
@@por_zero:
        MOV  DX, OFFSET t_zero
        MOV  AH, 09h
        INT  21h
        JMP  @@fim
@@mostra:
        CALL MOSTRA_IGUAL
        CALL IMPRIMIR_S32
@@fim:  MOV  AX, 4C00h
        INT  21h
principal ENDP

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

; LER_SINAL: mostra a pergunta em DS:DX e lê um número de -999 a 999.
LER_SINAL PROC
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
        CALL CONVERTER_SINAL
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
LER_SINAL ENDP

; CONVERTER_SINAL: SI = buffer 0Ah -> AX = número (-999 a 999), CF = 1 se inválido
CONVERTER_SINAL PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  CL, [SI+1]
        XOR  CH, CH
        ADD  SI, 2
        XOR  BX, BX             ; BX = 1 se negativo
        JCXZ @@erro
        CMP  BYTE PTR [SI], '-'
        JNE  @@digitos
        INC  BX
        INC  SI
        DEC  CX
        JZ   @@erro             ; só o sinal
@@digitos:
        CMP  CX, 3
        JA   @@erro             ; no máximo 3 dígitos
        XOR  AX, AX
@@laco: MOV  DL, [SI]
        CMP  DL, '0'
        JB   @@erro
        CMP  DL, '9'
        JA   @@erro
        SUB  DL, '0'
        XOR  DH, DH
        PUSH DX
        MOV  DX, 10
        MUL  DX                 ; AX = AX * 10 (no máximo 990)
        POP  DX
        ADD  AX, DX
        INC  SI
        LOOP @@laco
        TEST BX, BX
        JZ   @@ok
        NEG  AX
@@ok:   CLC
        JMP  @@sai
@@erro: STC
@@sai:  POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
CONVERTER_SINAL ENDP

; IMPRIMIR_S32: imprime DX:AX com sinal. Preserva tudo.
IMPRIMIR_S32 PROC
        PUSH AX
        PUSH DX
        TEST DX, DX
        JNS  @@positivo
        PUSH AX
        PUSH DX
        MOV  DL, '-'
        MOV  AH, 02h
        INT  21h
        POP  DX
        POP  AX
        NEG  DX                 ; NEG de 32 bits
        NEG  AX
        SBB  DX, 0
@@positivo:
        CALL IMPRIMIR_U32
        POP  DX
        POP  AX
        RET
IMPRIMIR_S32 ENDP

; IMPRIMIR_U32: imprime DX:AX sem sinal. Preserva tudo. (Aula 21)
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

Teste no laboratório: `-999 * 999`, `-7 / 2`, `7 / -2`, `-500 - 600` e `12 / 0`.

:::anos90 O jogo que andava para trás
Bugs de sinal eram uma fonte inesgotável de comportamentos bizarros. Um contador de pontos declarado com sinal virava negativo depois de 32.767 pontos; uma coordenada sem sinal comparada com `JL` fazia o personagem atravessar a parede esquerda e reaparecer do outro lado do mapa. Muitos "truques" e *glitches* famosos de jogos da época nasceram exatamente de um `JB` onde deveria haver um `JL`, ou vice-versa.
:::

```quiz
? Para imprimir AX = −42 com uma rotina que só sabe imprimir sem sinal, o que fazer?
- Chamar a rotina direto: ela imprime 65494, que é o mesmo número.
+ Imprimir o '-', fazer NEG AX (AX = 42) e chamar a rotina.
- Fazer CBW antes de chamar a rotina.
> Primeiro o sinal, depois o valor absoluto. A rotina sem sinal imprime 42.

? Qual sequência nega o número de 32 bits em DX:AX?
- NEG AX e depois NEG DX
+ NEG DX, NEG AX e SBB DX, 0
- NEG DX e depois ADC AX, 0
> NEG AX liga CF quando AX não era zero; o SBB desconta esse empréstimo da parte alta.

? Por que a calculadora aceita só números de −999 a 999?
- Porque o 8086 não lê números maiores.
+ Para que nenhuma conta estoure: até o produto cabe em 32 bits com sinal.
- Porque IDIV só divide números de 3 dígitos.
> 999 × 999 = 998.001, que cabe em DX:AX. Limitar a entrada é mais simples que tratar cada estouro.
```

## Exercícios

```exercicio
id: a22-2
titulo: Imprimir com sinal
nivel: 2
exigir: NEG
--- enunciado
Escreva **IMPRIMIR_SINAL**, que imprime AX como número **com sinal** (−32.768 a 32.767). Os negativos começam com `-`. A rotina **IMPRIMIR_NUMERO** (sem sinal) já está pronta. AX chega com o valor quando o programa começa.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL IMPRIMIR_SINAL
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_SINAL: imprime AX com sinal
IMPRIMIR_SINAL PROC
        CALL IMPRIMIR_NUMERO
        RET
IMPRIMIR_SINAL ENDP

; IMPRIMIR_NUMERO: imprime AX (0..65535) em decimal. Preserva tudo.
IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        TEST AX, AX
        JNZ  @@divide
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP
END inicio
--- testes
[{ "nome": "−150", "setup": { "AX": -150 }, "espera": { "saida": "-150", "pilhaEquilibrada": true } },
 { "nome": "0", "setup": { "AX": 0 }, "espera": { "saida": "0" } },
 { "nome": "32767", "setup": { "AX": 32767 }, "espera": { "saida": "32767" } },
 { "nome": "−32768", "setup": { "AX": -32768 }, "espera": { "saida": "-32768" } },
 { "nome": "−1", "setup": { "AX": -1 }, "espera": { "saida": "-1" } }]
--- dicas
Se AX for negativo (TEST AX,AX / JNS), imprima '-' com AH = 02h. Cuidado: isso usa AH e DL, então salve AX antes.
Depois faça NEG AX e chame IMPRIMIR_NUMERO. O caso −32.768 funciona sozinho: por quê?
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL IMPRIMIR_SINAL
        MOV  AX, 4C00h
        INT  21h

IMPRIMIR_SINAL PROC
        PUSH AX
        PUSH DX
        TEST AX, AX
        JNS  @@positivo
        PUSH AX
        MOV  DL, '-'
        MOV  AH, 02h
        INT  21h
        POP  AX
        NEG  AX             ; 8000h continua 8000h = 32768 sem sinal
@@positivo:
        CALL IMPRIMIR_NUMERO
        POP  DX
        POP  AX
        RET
IMPRIMIR_SINAL ENDP

IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        TEST AX, AX
        JNZ  @@divide
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP
END inicio
```

```exercicio
id: a22-3
titulo: Lendo com sinal
nivel: 3
--- enunciado
Escreva **CONVERTER_SINAL**: SI aponta para um buffer da função 0Ah já preenchido. O texto pode começar com `-` e deve ter de **1 a 3 dígitos**. Devolva o número (−999 a 999) em **AX** com **CF = 0**, ou **CF = 1** se o texto for inválido (vazio, só o sinal, mais de 3 dígitos ou caractere que não é dígito). O programa principal guarda o resultado em **valor** e **erro**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
buf     DB 6, 3, '-45', 13, 0, 0
valor   DW 0
erro    DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET buf
        CALL CONVERTER_SINAL
        MOV  valor, AX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

; CONVERTER_SINAL: SI = buffer 0Ah -> AX (-999..999), CF = 1 se inválido
CONVERTER_SINAL PROC
        ; seu código aqui
        RET
CONVERTER_SINAL ENDP
END inicio
--- testes
[{ "nome": "−45", "espera": { "mem": { "valor": -45, "erro": 0 } } },
 { "nome": "999", "setup": { "buf": "\u0006\u0003999\r" }, "espera": { "mem": { "valor": 999, "erro": 0 } } },
 { "nome": "−999", "setup": { "buf": "\u0006\u0004-999\r" }, "espera": { "mem": { "valor": -999, "erro": 0 } } },
 { "nome": "0", "setup": { "buf": "\u0006\u00010\r" }, "espera": { "mem": { "valor": 0, "erro": 0 } } },
 { "nome": "1000 é inválido", "setup": { "buf": "\u0006\u00041000\r" }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "só o sinal é inválido", "setup": { "buf": "\u0006\u0001-\r" }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "1-2 é inválido", "setup": { "buf": "\u0006\u00031-2\r" }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "vazio é inválido", "setup": { "buf": "\u0006\u0000\r" }, "espera": { "mem": { "erro": 1 } } }]
--- dicas
CX = [SI+1]; os caracteres começam em SI+2. Se o primeiro for '-', marque o sinal num registrador, avance SI e decremente CX.
Depois do sinal, CX precisa estar entre 1 e 3.
Converta os dígitos como na Aula 19 e, se havia sinal, faça NEG AX no fim.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
buf     DB 6, 3, '-45', 13, 0, 0
valor   DW 0
erro    DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET buf
        CALL CONVERTER_SINAL
        MOV  valor, AX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

CONVERTER_SINAL PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  CL, [SI+1]
        XOR  CH, CH
        ADD  SI, 2
        XOR  BX, BX
        JCXZ @@erro
        CMP  BYTE PTR [SI], '-'
        JNE  @@digitos
        INC  BX
        INC  SI
        DEC  CX
        JZ   @@erro
@@digitos:
        CMP  CX, 3
        JA   @@erro
        XOR  AX, AX
@@laco: MOV  DL, [SI]
        CMP  DL, '0'
        JB   @@erro
        CMP  DL, '9'
        JA   @@erro
        SUB  DL, '0'
        XOR  DH, DH
        PUSH DX
        MOV  DX, 10
        MUL  DX
        POP  DX
        ADD  AX, DX
        INC  SI
        LOOP @@laco
        TEST BX, BX
        JZ   @@ok
        NEG  AX
@@ok:   CLC
        JMP  @@sai
@@erro: STC
@@sai:  POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
CONVERTER_SINAL ENDP
END inicio
```

```exercicio
id: a22-5
titulo: O coração da calculadora
nivel: 3
--- enunciado
Escreva **CALCULAR**: recebe **a** em AX, **b** em BX (ambos de −999 a 999) e a operação em **CL** (`+`, `-`, `*` ou `/`). Devolva o resultado **com sinal em 32 bits** em **DX:AX** e **CF = 0**. Na divisão, devolva o quociente (estendido para 32 bits). Se a operação for `/` e b = 0, devolva **CF = 1**. Os valores chegam em AX, BX e CX quando o programa começa.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
r_lo    DW 0
r_hi    DW 0
erro    DB 0
.CODE
inicio: PUSH AX
        MOV  AX, @DATA
        MOV  DS, AX
        POP  AX
        CALL CALCULAR
        MOV  r_lo, AX
        MOV  r_hi, DX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

; CALCULAR: AX = a, BX = b, CL = operação -> DX:AX = resultado, CF = 1 se erro
CALCULAR PROC
        ; seu código aqui
        RET
CALCULAR ENDP
END inicio
--- testes
[{ "nome": "999 * −999 = −998001", "setup": { "AX": 999, "BX": -999, "CX": 42 }, "espera": { "mem": { "r_lo": 50575, "r_hi": 65520, "erro": 0 } } },
 { "nome": "−999 − 999 = −1998", "setup": { "AX": -999, "BX": 999, "CX": 45 }, "espera": { "mem": { "r_lo": 63538, "r_hi": 65535, "erro": 0 } } },
 { "nome": "−500 + 167 = −333", "setup": { "AX": -500, "BX": 167, "CX": 43 }, "espera": { "mem": { "r_lo": 65203, "r_hi": 65535, "erro": 0 } } },
 { "nome": "999 * 999 = 998001", "setup": { "AX": 999, "BX": 999, "CX": 42 }, "espera": { "mem": { "r_lo": 14961, "r_hi": 15, "erro": 0 } } },
 { "nome": "−17 / 3 = −5", "setup": { "AX": -17, "BX": 3, "CX": 47 }, "espera": { "mem": { "r_lo": 65531, "r_hi": 65535, "erro": 0 } } },
 { "nome": "8 / 0: erro", "setup": { "AX": 8, "BX": 0, "CX": 47 }, "espera": { "mem": { "erro": 1 } } }]
--- dicas
Compare CL com cada operação ('+' = 43, '-' = 45, '*' = 42, '/' = 47).
Soma e subtração cabem em 16 bits: faça a conta em AX e estenda com CWD.
Multiplicação: IMUL BX já devolve DX:AX. Divisão: CWD, IDIV BX, e depois CWD de novo para estender o quociente.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
r_lo    DW 0
r_hi    DW 0
erro    DB 0
.CODE
inicio: PUSH AX
        MOV  AX, @DATA
        MOV  DS, AX
        POP  AX
        CALL CALCULAR
        MOV  r_lo, AX
        MOV  r_hi, DX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

CALCULAR PROC
        CMP  CL, '+'
        JNE  @@n_soma
        ADD  AX, BX
        JMP  @@estende
@@n_soma:
        CMP  CL, '-'
        JNE  @@n_sub
        SUB  AX, BX
        JMP  @@estende
@@n_sub:
        CMP  CL, '*'
        JNE  @@divide
        IMUL BX             ; DX:AX = a * b
        CLC
        RET
@@divide:
        TEST BX, BX
        JZ   @@erro
        CWD
        IDIV BX             ; AX = quociente
@@estende:
        CWD                 ; DX:AX = AX com sinal
        CLC
        RET
@@erro: STC
        RET
CALCULAR ENDP
END inicio
```

## Revisão do módulo 8

Antes de seguir, confira se o módulo "Projetos, depuração e aritmética com sinal" ficou firme. As perguntas misturam assuntos de todas as aulas do módulo (e algumas dos anteriores).

```quiz
? Um .EXE imprime lixo em vez da mensagem. Qual é o suspeito número um?
+ Faltou MOV AX,@DATA / MOV DS,AX no começo.
- O texto não terminou com 0.
- A mensagem tem acento.
> No começo de um .EXE, DS aponta para o PSP, não para os dados.

? O que acontece quando o quociente de um DIV não cabe no destino?
- O quociente é truncado.
+ O processador dispara a INT 0 (Divide overflow).
- CF fica 1 e o programa continua.
> Divisão por zero e quociente grande demais caem na mesma interrupção.

? Antes de IDIV BX com o dividendo em AX, o que fazer?
- XOR DX, DX
+ CWD
- CBW
> CWD estende o sinal de AX para DX. Zerar DX transformaria um negativo em um positivo enorme.

? Como −1 fica guardado em 16 bits?
- 8001h
+ FFFFh
- 0001h com um bit de sinal à parte
> Complemento de dois: NOT 1 + 1 = FFFFh.

? Para saltar quando AX < BX, tratando os dois como números com sinal, depois de CMP AX,BX:
- JB
+ JL
- JC
> JL olha SF e OF (com sinal). JB olha CF (sem sinal).
```

Para fechar, um desafio sem dicas. Use o laboratório (F4) para depurar à vontade.

```exercicio
id: a22b-d1
titulo: Mínimo, máximo e amplitude com sinal
nivel: 3
desafio: sim
--- enunciado
O vetor `v` tem **6 words com sinal** (de −30.000 a 30.000). Coloque o **menor** em **BX**, o **maior** em **DX** e a **amplitude** (maior − menor, que cabe em 16 bits sem sinal) em **CX**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
v       DW 5, -3, 100, 0, -200, 7
N       EQU 6
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[
 { "nome": "5, -3, 100, 0, -200, 7", "espera": { "BX": 65336, "DX": 100, "CX": 300 } },
 { "nome": "todos -1", "setup": { "v": [-1, -1, -1, -1, -1, -1] }, "espera": { "BX": 65535, "DX": 65535, "CX": 0 } },
 { "nome": "30000 e -30000", "setup": { "v": [30000, -30000, 0, 0, 0, 0] }, "espera": { "BX": 35536, "DX": 30000, "CX": 60000 } },
 { "nome": "1 a 6", "setup": { "v": [1, 2, 3, 4, 5, 6] }, "espera": { "BX": 1, "DX": 6, "CX": 5 } }
]
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v       DW 5, -3, 100, 0, -200, 7
N       EQU 6
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        LEA  SI, v
        MOV  BX, [SI]
        MOV  DX, [SI]
        MOV  CX, N
laco:   MOV  AX, [SI]
        CMP  AX, BX
        JGE  nmin
        MOV  BX, AX
nmin:   CMP  AX, DX
        JLE  nmax
        MOV  DX, AX
nmax:   ADD  SI, 2
        LOOP laco
        MOV  CX, DX
        SUB  CX, BX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Imprimir com sinal: se o número for negativo, imprima o `-`, faça `NEG` e chame a rotina sem sinal (até 8000h funciona, tratado como sem sinal).
- `NEG` de 32 bits em DX:AX: `NEG DX` / `NEG AX` / `SBB DX, 0`.
- Ler com sinal: aceite um `-` no começo, converta o resto como sem sinal e faça `NEG` no final.
- Escolha a faixa dos dados para que nenhuma conta estoure: com −999 a 999, até o produto cabe em 32 bits com sinal.
:::
