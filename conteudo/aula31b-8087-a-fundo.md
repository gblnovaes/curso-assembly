---
id: aula31b
numero: 31.5
modulo: 12
rotulo: 31B
titulo: O 8087 a fundo
subtitulo: Raiz, comparações, Bhaskara, palavra de controle e exceções
duracao: 55 min
objetivos: calcular raízes com FSQRT; comparar reais com FCOM, FSTSW e SAHF; resolver uma equação do segundo grau no 8087; controlar o arredondamento com a palavra de controle; entender infinito, NaN e as exceções mascaradas
---

Na [Aula 31](aula:aula31) você aprendeu a conversar com o 8087: a pilha ST(0)..ST(7), os tipos de dados, as quatro operações e a impressão de um real. Agora vamos usar o coprocessador para valer: raízes, comparações, uma fórmula inteira (Bhaskara) e o controle fino do arredondamento e das exceções.

## Raiz quadrada: a hipotenusa

Com `FSQRT`, o teorema de Pitágoras vira cinco instruções. A pilha faz o papel das variáveis temporárias:

```asm executar titulo="HIPOT.ASM: hipotenusa de um triângulo retângulo"
.MODEL SMALL
.8087
.STACK 100h
.DATA
cat1    DW 3
cat2    DW 4
hip     DQ ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        FINIT
        FILD cat1           ; a
        FMUL ST, ST(0)      ; a²
        FILD cat2           ; b      a²
        FMUL ST, ST(0)      ; b²     a²
        FADD                ; a²+b²
        FSQRT               ; raiz
        FSTP hip            ; hip = 5,0
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Troque `cat1` e `cat2` por 1 e 1 e veja `hip` virar 1,4142135623731 na janela de variáveis.

## Comparando reais

O 8087 não mexe nas flags do 8086: ele tem as suas próprias, os **códigos de condição** C0, C1, C2 e C3, na **palavra de status**. `FCOM x` compara ST(0) com `x` e liga esses bits:

| Resultado | C3 | C2 | C0 |
|-----------|----|----|----|
| ST(0) > x | 0 | 0 | 0 |
| ST(0) < x | 0 | 0 | 1 |
| ST(0) = x | 1 | 0 | 0 |
| não comparáveis (NaN) | 1 | 1 | 1 |

Para o 8086 tomar uma decisão, a palavra de status precisa chegar às flags. O caminho no 8087 tem três passos:

```diagrama titulo="Do 8087 para as flags do 8086"
   FCOM x            compara; liga C3, C2, C0
   FSTSW status      grava a palavra de status na memória
   FWAIT
   MOV AX, status    traz para AX
   SAHF              copia AH para as flags:

   palavra de status:  B C3 TOP TOP TOP C2 C1 C0 │ exceções
                       15 14 13  12  11 10  9  8 │ 7..0
                          │              │      │
   AH → flags:            ZF (bit 6)     PF     CF (bit 0)
                                       (bit 2)
```

O desenho é proposital: C3 cai em **ZF** e C0 cai em **CF**, exatamente como uma comparação **sem sinal** do 8086. Por isso, depois do `SAHF`, use **JA, JB, JAE, JBE, JE**. Os saltos com sinal (JG, JL) não servem aqui, porque olham SF e OF, que o SAHF não traz do 8087. E se algum operando for NaN, C2 cai em PF: `JP` detecta o caso "não comparável".

| Instrução | Faz |
|-----------|-----|
| `FCOM x` / `FCOM ST(i)` | compara ST(0) com x ou ST(i) |
| `FCOMP x` | compara e desempilha uma vez |
| `FCOMPP` | compara ST(0) com ST(1) e desempilha as duas |
| `FICOM n` / `FICOMP n` | compara com um inteiro (DW ou DD) |
| `FTST` | compara ST(0) com 0,0 |
| `FSTSW status` | grava a palavra de status numa variável DW |

:::atencao FSTSW AX não existe no 8087
Em código para 286 e posteriores você vai encontrar `FSTSW AX`, que grava o status direto em AX. Essa forma só apareceu no **80287**. No 8087 o status passa obrigatoriamente pela memória, e o montador do curso recusa `FSTSW AX` explicando isso.
:::

## Bhaskara no 8087

Para juntar tudo: as raízes de ax² + bx + c = 0. O programa calcula o delta, decide com `FTST` se há raízes reais e imprime as duas com duas casas.

```asm executar titulo="BHASKARA.ASM: raízes da equação do 2º grau"
.MODEL SMALL
.8087
.STACK 100h
.DATA
coefA       DQ 1.0
coefB       DQ -5.0
coefC       DQ 6.0
quatro      DQ 4.0
dois        DQ 2.0
cem         DD 100.0
raizDelta   DQ ?
centesimos  DD ?
status      DW ?
t_x1        DB 'x1 = $'
t_x2        DB '   x2 = $'
t_nada      DB 'Delta negativo: nao ha raizes reais.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        FINIT
        ; delta = b*b - 4*a*c
        FLD  coefB
        FMUL ST, ST(0)          ; b²
        FLD  quatro
        FMUL coefA
        FMUL coefC              ; 4ac     b²
        FSUB                    ; b² - 4ac
        FTST                    ; compara o delta com 0
        FSTSW status
        FWAIT
        MOV  AX, status
        SAHF
        JAE  @@tem_raiz         ; delta >= 0  (C0 = 0)
        FSTP ST(0)              ; descarta o delta
        MOV  AH, 09h
        LEA  DX, t_nada
        INT  21h
        JMP  @@fim
@@tem_raiz:
        FSQRT
        FSTP raizDelta          ; pilha vazia
        ; x1 = (-b + raiz) / 2a
        FLD  coefB
        FCHS                    ; -b
        FADD raizDelta
        FLD  dois
        FMUL coefA              ; 2a     -b+raiz
        FDIV                    ; (-b+raiz) / 2a
        MOV  AH, 09h
        LEA  DX, t_x1
        INT  21h
        CALL IMPRIMIR_REAL
        ; x2 = (-b - raiz) / 2a
        FLD  coefB
        FCHS
        FSUB raizDelta
        FLD  dois
        FMUL coefA
        FDIV
        MOV  AH, 09h
        LEA  DX, t_x2
        INT  21h
        CALL IMPRIMIR_REAL
@@fim:  MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_REAL: imprime ST(0) com 2 casas e desempilha
IMPRIMIR_REAL PROC
        PUSH AX
        PUSH BX
        PUSH DX
        FMUL cem
        FISTP centesimos
        FWAIT
        MOV  AX, WORD PTR centesimos
        MOV  DX, WORD PTR centesimos+2
        TEST DX, DX
        JNS  @@positivo
        PUSH AX
        PUSH DX
        MOV  DL, '-'
        MOV  AH, 02h
        INT  21h
        POP  DX
        POP  AX
        NEG  DX
        NEG  AX
        SBB  DX, 0
@@positivo:
        MOV  BX, 100
        DIV  BX
        CALL IMPRIMIR_NUMERO
        PUSH DX
        MOV  DL, ','
        MOV  AH, 02h
        INT  21h
        POP  AX
        AAM
        ADD  AX, 3030h
        PUSH AX
        MOV  DL, AH
        MOV  AH, 02h
        INT  21h
        POP  AX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  DX
        POP  BX
        POP  AX
        RET
IMPRIMIR_REAL ENDP

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
```

A saída é `x1 = 3,00   x2 = 2,00`. Experimente trocar `coefC` por `7.0` (delta negativo) ou `coefB` por `-4.0` e `coefC` por `4.0` (raiz dupla). Repare em `FSTP ST(0)`: é o jeito idiomático de **descartar** o topo da pilha sem gravar em lugar nenhum.

```quiz
? Depois de FCOM x / FSTSW status / MOV AX,status / SAHF, qual salto testa "ST(0) maior que x"?
+ JA
- JG
- JC
> C3 vai para ZF e C0 vai para CF, como numa comparação sem sinal. "Maior" é CF=0 e ZF=0, que é o JA. JG olha SF e OF, que o SAHF não traz do 8087.

? O que faz FSTP ST(0)?
- Grava ST(0) em ST(0) e não muda nada
+ Desempilha o topo sem gravar o valor em lugar nenhum
- Esvazia a pilha toda
> FSTP ST(i) copia ST(0) para ST(i) e desempilha. Com i = 0, a cópia é para ele mesmo e em seguida o valor sai da pilha: um descarte.

? Por que é preciso um FWAIT antes de MOV AX,status, logo depois de FSTSW status?
+ Porque o MOV é do 8086 e não leva o WAIT automático, e o 8087 pode não ter terminado de gravar
- Porque MOV não funciona com variáveis do 8087
- Porque FSTSW desliga as interrupções
> O montador só põe o 9Bh antes de instruções do 8087. Entre FSTSW e MOV não há nenhuma, então o FWAIT explícito garante que o 8086 lê o valor já gravado.
```

## A palavra de controle e o arredondamento

`FIST`, `FISTP` e `FRNDINT` arredondam segundo o campo **RC** (*rounding control*) da **palavra de controle**, uma word de configuração do 8087:

```diagrama titulo="Palavra de controle do 8087"
   bit:  15..13  12   11 10   9  8    7    6  5  4  3  2  1  0
         ──────  ──   ─────   ────   ───   ── ── ── ── ── ── ──
         (livre) IC    RC      PC    IEM   ─  PM UM OM ZM DM IM
                       │       │      │       └─ máscaras das exceções
                       │       │      └─ máscara geral de interrupção (só 8087)
                       │       └─ precisão: 11 = 64 bits de mantissa
                       └─ arredondamento:
                            00 = ao mais próximo (empate: ao par)
                            01 = para baixo (−∞)
                            10 = para cima (+∞)
                            11 = truncar (em direção a zero)

   Depois de FINIT: 03FFh (ao mais próximo, todas as exceções mascaradas)
```

O padrão, "ao mais próximo", é o certo para contas, mas às vezes você quer **truncar**, como faz a divisão inteira da linguagem C. A receita clássica é ler a palavra, ligar os bits 10 e 11, carregar, usar, e devolver a original:

```asm fragmento titulo="Truncar com a palavra de controle"
cw_antiga   DW ?
cw_trunca   DW ?

        FSTCW cw_antiga         ; lê a palavra de controle atual
        FWAIT
        MOV   AX, cw_antiga
        OR    AX, 0C00h         ; RC = 11: truncar
        MOV   cw_trunca, AX
        FLDCW cw_trunca         ; passa a truncar
        FISTP inteiro           ; 3,9 vira 3; -3,9 vira -3
        FLDCW cw_antiga         ; volta ao arredondamento normal
```

O arredondamento ao mais próximo do 8087 desempata **ao par**: 2,5 vira 2 e 3,5 vira 4. Parece estranho, mas é de propósito: arredondar sempre os empates para cima puxa a média de muitas contas para cima, e o empate ao par distribui o erro.

## Exceções, infinito e NaN

O 8087 reconhece seis situações excepcionais, cada uma com um bit na palavra de status e uma máscara na palavra de controle:

| Bit | Exceção | Exemplo | Resultado com a máscara ligada (padrão) |
|-----|---------|---------|------------------------------------------|
| IE | operação inválida | √−1, 0÷0, pilha cheia ou vazia | NaN, o "indefinido" |
| DE | operando denormal | número pequeno demais para o formato normal | segue com precisão reduzida |
| ZE | divisão por zero | 1÷0 | ±infinito |
| OE | overflow | resultado grande demais | ±infinito |
| UE | underflow | resultado pequeno demais | zero ou denormal |
| PE | precisão | 1÷3 não é exato | o valor arredondado (acontece o tempo todo) |

Com as exceções **mascaradas**, que é o estado depois do `FINIT`, o 8087 não para: ele produz um valor especial e liga o bit no status. Um infinito continua se comportando como infinito nas contas seguintes, e um NaN "contamina" tudo o que vier depois. Se o seu resultado final sair NaN, procure a primeira conta inválida, não a última. Desmascarar uma exceção faz o 8087 pedir uma interrupção ao processador, o que no PC exige preparar um tratador; aqui vamos ficar com o comportamento padrão.

:::dica Inteiro que não cabe
`FISTP n` com `n DW` e ST(0) = 40000 não cabe em 16 bits com sinal. O 8087 liga IE e grava o **inteiro indefinido**: 8000h, o −32.768. Se aparecer um −32.768 misterioso, desconfie de um FIST estourado.
:::

## BCD direto do 8087

O formato de 80 bits em **BCD compactado** (18 dígitos decimais e um byte de sinal) existe para conversar com sistemas comerciais, que guardam valores em decimal. `FBLD` carrega um número BCD, e `FBSTP` grava ST(0) em BCD, já arredondado. No MASM, um `DT` com número **inteiro** gera justamente esse formato:

```asm fragmento titulo="Convertendo para BCD com o 8087"
valor   DT 1234             ; BCD: 34h 12h 00h ... 00h (sinal no último byte)
saida   DT ?

        FBLD  valor         ; ST(0) = 1234,0
        FIMUL dez           ; dez DW 10
        FBSTP saida         ; saida = 12340 em BCD: 40h 23h 01h 00h ...
```

Isso dá um jeito curioso de converter binário em decimal: carregue o número com `FILD`, grave com `FBSTP`, e os dígitos estão prontos, dois por byte, para virar ASCII. Na aula de BCD você vai ver como fazer o mesmo com as instruções do próprio 8086.

```quiz
? Com a palavra de controle padrão, que valor FISTP grava para ST(0) = 2,5?
+ 2
- 3
- 2,5 não pode ser gravado
> O padrão é arredondar ao mais próximo e, nos empates, ao par. Entre 2 e 3, o par é 2. Já 3,5 viraria 4.

? Qual o efeito de dividir 1,0 por 0,0 no 8087 logo depois de FINIT?
- O programa termina com "Divide overflow"
+ O resultado é +infinito e o bit ZE da palavra de status liga
- O resultado é 0
> Depois de FINIT todas as exceções estão mascaradas. O 8087 não interrompe nada: produz infinito e anota a divisão por zero no status. O "Divide overflow" é coisa do DIV do 8086.

? Que valor de palavra de controle trunca em vez de arredondar, a partir do padrão 03FFh?
- 03FCh
- 13FFh
+ 0FFFh
> RC são os bits 10 e 11. 03FFh OR 0C00h = 0FFFh: os mesmos bits de antes, com RC = 11 (truncar).
```

## Exercícios

```exercicio
id: a31-2
titulo: Hipotenusa
nivel: 2
exigir: FSQRT
--- enunciado
Os catetos de um triângulo retângulo chegam nas variáveis inteiras **cat1** e **cat2** (DW). Calcule a hipotenusa, √(cat1² + cat2²), e guarde em **hip** (DQ, real de 64 bits). No fim, a pilha do 8087 deve estar **vazia**.
--- inicial
.MODEL SMALL
.8087
.STACK 100h
.DATA
cat1    DW 3
cat2    DW 4
hip     DQ ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        FINIT
        ; hip = raiz(cat1² + cat2²)

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "3, 4 → 5", "setup": { "cat1": 3, "cat2": 4 }, "espera": { "reais": { "hip": 5 }, "st": [null] } },
 { "nome": "5, 12 → 13", "setup": { "cat1": 5, "cat2": 12 }, "espera": { "reais": { "hip": 13 }, "st": [null] } },
 { "nome": "1, 1 → √2", "setup": { "cat1": 1, "cat2": 1 }, "espera": { "reais": { "hip": 1.4142135623730951 }, "st": [null] } },
 { "nome": "300, 400 → 500", "setup": { "cat1": 300, "cat2": 400 }, "espera": { "reais": { "hip": 500 }, "st": [null] } }]
--- dicas
FILD cat1 / FMUL ST,ST(0) deixa cat1² no topo. Faça o mesmo com cat2.
Com os dois quadrados na pilha, FADD sem operandos soma e desempilha.
FSQRT tira a raiz de ST(0). FSTP hip grava e esvazia a pilha.
--- solucao
.MODEL SMALL
.8087
.STACK 100h
.DATA
cat1    DW 3
cat2    DW 4
hip     DQ ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        FINIT
        FILD cat1
        FMUL ST, ST(0)      ; a²
        FILD cat2
        FMUL ST, ST(0)      ; b²   a²
        FADD                ; a²+b²
        FSQRT
        FSTP hip
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a31-3
titulo: O maior de dois reais
nivel: 2
exigir: FCOM|FCOMP|FCOMPP, SAHF
--- enunciado
As variáveis **x** e **y** (DQ) chegam com dois números reais. Copie o maior deles para **maior** (DQ) e indique em **BL** quem venceu: **1** se x for maior, **2** se y for maior e **0** se forem iguais (nesse caso, maior = x). Compare com o 8087 e leve o resultado às flags com `FSTSW` e `SAHF`. A pilha deve terminar vazia.
--- inicial
.MODEL SMALL
.8087
.STACK 100h
.DATA
x       DQ 2.5
y       DQ -1.75
maior   DQ ?
status  DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        FINIT
        ; compare x com y, grave o maior e ponha 0, 1 ou 2 em BL

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "x = 2,5 > y = −1,75", "setup": { "x": 2.5, "y": -1.75 }, "espera": { "reais": { "maior": 2.5 }, "BL": 1, "st": [null] } },
 { "nome": "x = −1,75 < y = 2,5", "setup": { "x": -1.75, "y": 2.5 }, "espera": { "reais": { "maior": 2.5 }, "BL": 2, "st": [null] } },
 { "nome": "x = y = 3,0", "setup": { "x": 3.0, "y": 3.0 }, "espera": { "reais": { "maior": 3 }, "BL": 0, "st": [null] } },
 { "nome": "x = −3,0 < y = −1,75", "setup": { "x": -3.0, "y": -1.75 }, "espera": { "reais": { "maior": -1.75 }, "BL": 2, "st": [null] } }]
--- dicas
FLD x / FCOMP y compara x com y e já desempilha: a pilha fica vazia.
FSTSW status, FWAIT, MOV AX,status e SAHF levam C3 e C0 para ZF e CF.
Depois do SAHF, use saltos SEM sinal: JE para iguais, JA para x maior, JB para x menor. JG e JL não funcionam aqui.
Para copiar um real de uma variável para outra, passe pela pilha: FLD y / FSTP maior.
--- solucao
.MODEL SMALL
.8087
.STACK 100h
.DATA
x       DQ 2.5
y       DQ -1.75
maior   DQ ?
status  DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        FINIT
        FLD  x
        FCOMP y             ; compara x com y e desempilha
        FSTSW status
        FWAIT
        MOV  AX, status
        SAHF
        MOV  BL, 0
        JE   @@x_vence      ; iguais: maior = x, BL = 0
        MOV  BL, 1
        JA   @@x_vence
        MOV  BL, 2
        FLD  y
        JMP  @@grava
@@x_vence:
        FLD  x
@@grava:
        FSTP maior
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- `FSQRT` troca ST(0) pela sua raiz quadrada.
- Comparar: `FCOM` → `FSTSW` na memória → `FWAIT` → `MOV AX` → `SAHF` → saltos **sem sinal** (JA, JB, JE). `FSTSW AX` só existe do 80287 em diante.
- `FIST` arredonda pelo campo RC da palavra de controle (padrão: ao mais próximo, empate ao par). Para truncar, ligue os bits 10 e 11 com `FSTCW`/`FLDCW`.
- Com as exceções mascaradas (o padrão), divisão por zero dá infinito e operações inválidas dão NaN, sem interromper o programa.
:::
