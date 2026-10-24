---
id: aula30
numero: 30
modulo: 12
titulo: BCD e ponto fixo
subtitulo: Contas em decimal com DAA e AAM, frações com inteiros, tabelas de seno
duracao: 100 min
objetivos: representar números em BCD compactado e descompactado; corrigir somas e subtrações com DAA, DAS, AAA e AAS; somar números BCD de vários bytes; usar AAM para separar dígitos e AAD para preparar divisões; representar frações em ponto fixo 8.8 e 16.16; somar, multiplicar, dividir e arredondar em ponto fixo; usar tabelas de seno em ponto fixo; saber quando o ponto fixo é melhor que o coprocessador
---

## Duas formas de fugir do binário puro

Até agora todo número foi binário: 1994 é 07CAh, e para mostrá-lo na tela você divide por 10 várias vezes (a rotina `IMPRIMIR_NUMERO` que acompanha o curso desde a Aula 11). Esta aula apresenta duas técnicas que os programadores dos anos 80 e 90 usavam o tempo todo, cada uma resolvendo um problema diferente:

- **BCD** (*Binary Coded Decimal*): guardar cada **dígito decimal** em 4 bits. As contas ficam um pouco mais caras, mas mostrar o número é imediato e não há erro de arredondamento em decimal. Calculadoras, placares de jogos, valores em dinheiro e o relógio do PC AT usam BCD.
- **Ponto fixo**: guardar números **com fração** em inteiros comuns, combinando que alguns bits ficam depois da vírgula. As contas usam `ADD`, `IMUL` e deslocamentos, sem coprocessador. Quase todo jogo 3D e efeito gráfico do DOS foi feito assim.

## BCD: um dígito a cada 4 bits

Quatro bits guardam de 0 a 15, mas o BCD só usa de 0 a 9. Existem duas variantes:

```diagrama titulo="O número 47 em três formatos"
   binário puro:         0010 1111      = 2Fh   (32 + 15)

   BCD compactado:       0100 0111      = 47h   (um dígito em cada nibble)
                         └─4─┘└─7─┘

   BCD descompactado:    0000 0100  0000 0111   = 04h 07h   (um dígito por byte)
                                                  em AH e AL: AX = 0407h

   ASCII:                0011 0100  0011 0111   = '4' '7' = 34h 37h
                         (descompactado + 30h em cada byte)
```

O truque do BCD compactado é que, **escrito em hexadecimal, ele se lê como decimal**: 47h é "47", 1999h é "1999". Os valores A a F em um nibble são inválidos.

## Somando em BCD: ADD e depois DAA

O `ADD` não sabe nada de BCD. Somando 38h + 45h ele faz a conta binária e dá **7Dh**, que não é um BCD válido (D não é dígito). A instrução **DAA** (*Decimal Adjust after Addition*) conserta o resultado em AL:

```diagrama titulo="38 + 45 = 83 em BCD"
     38h  =  0011 1000
   + 45h  =  0100 0101
   ─────────────────────
     7Dh  =  0111 1101     ← o nibble baixo passou de 9

   DAA: nibble baixo > 9 (ou AF = 1)  → soma 06h
     7Dh + 06h = 83h       ← "83", correto
        nibble alto > 9 (ou CF = 1)   → soma 60h e liga CF
```

Por que somar 6? Porque entre 9 e 10 em decimal existem 6 valores (A a F) que o BCD pula. Somar 6 "salta" esses valores e leva o vai-um para o nibble de cima. A flag **AF** (*auxiliary carry*, o vai-um do bit 3 para o bit 4) existe justamente para o `DAA` saber se houve vai-um entre os dígitos: em 08h + 09h = 11h, o nibble baixo é 1 (não passa de 9), mas AF = 1 e o `DAA` corrige para 17h.

```asm executar titulo="BCD.ASM: DAA e DAS passo a passo"
        MOV  AL, 38h
        ADD  AL, 45h        ; AL = 7Dh (binário)
        DAA                 ; AL = 83h, CF = 0

        MOV  AL, 08h
        ADD  AL, 09h        ; AL = 11h, mas AF = 1
        DAA                 ; AL = 17h

        MOV  AL, 99h
        ADD  AL, 01h        ; AL = 9Ah
        DAA                 ; AL = 00h e CF = 1: "99 + 1 = 100", o 1 foi para CF

        MOV  AL, 52h
        SUB  AL, 17h        ; AL = 3Bh (binário)
        DAS                 ; AL = 35h: 52 − 17 = 35
```

Execute passo a passo e acompanhe AL, CF e AF. Para subtrair, o par é `SUB` + **DAS** (*Decimal Adjust after Subtraction*), que tira 6 em vez de somar.

:::atencao DAA só funciona em AL, logo depois da conta
O `DAA` olha para AL, CF e AF, e as flags precisam ser as de um `ADD` ou `ADC` feito em AL. Qualquer outra instrução no meio que mexa nas flags (um `CMP`, um `INC` em outro registrador) estraga a correção. E não existe DAA de 16 bits: números maiores se fazem byte a byte, como veremos a seguir.
:::

## BCD de vários bytes: o placar

Um placar de 6 dígitos cabe em 3 bytes BCD compactado. Para somar, faça como na soma de 32 bits da Aula 21: byte a byte, do menos significativo para o mais significativo, com `ADC` levando o vai-um. A diferença é o `DAA` depois de cada `ADC`, e é ele que produz o CF que vai para o próximo byte.

```asm executar titulo="PLACAR.ASM: somando pontos em BCD e mostrando sem dividir"
.MODEL SMALL
.STACK 100h
.DATA
; 3 bytes BCD, o byte menos significativo primeiro
placar  DB 50h, 98h, 00h    ; 009850
bonus   DB 75h, 02h, 00h    ; 000275
t_pl    DB 'Placar: $'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET bonus
        MOV  DI, OFFSET placar
        MOV  CX, 3
        CLC
@@soma: MOV  AL, [DI]
        ADC  AL, [SI]       ; soma com o vai-um do byte anterior
        DAA                 ; corrige para BCD e gera o vai-um decimal
        MOV  [DI], AL
        INC  SI             ; INC não mexe em CF
        INC  DI
        LOOP @@soma         ; LOOP também não

        MOV  AH, 09h
        MOV  DX, OFFSET t_pl
        INT  21h
        MOV  SI, OFFSET placar + 2   ; imprime do byte mais alto para o mais baixo
        MOV  CX, 3
@@mostra:
        MOV  AL, [SI]
        CALL IMPRIMIR_BCD
        DEC  SI
        LOOP @@mostra
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_BCD: imprime os dois dígitos do byte BCD em AL
IMPRIMIR_BCD PROC
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  DH, AL
        MOV  DL, AL
        MOV  CL, 4
        SHR  DL, CL         ; nibble alto
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        MOV  DL, DH
        AND  DL, 0Fh        ; nibble baixo
        ADD  DL, '0'
        INT  21h
        POP  DX
        POP  CX
        POP  AX
        RET
IMPRIMIR_BCD ENDP
END inicio
```

O programa mostra `Placar: 010125`. Repare que a impressão não tem nenhuma divisão: cada nibble já é um dígito, basta somar '0'. Para um jogo que soma pontos a cada inimigo e mostra o placar a cada quadro, isso era uma economia real: um `DIV` de 16 bits custa mais de 140 ciclos, e uma impressão binária de 6 dígitos precisaria de vários.

:::cpu Por que INC e LOOP no laço
O vai-um decimal precisa sobreviver de uma volta para a outra. `INC` e `LOOP` não alteram CF, então ele chega intacto ao próximo `ADC`. Um `ADD SI,1` no lugar do `INC SI` zeraria o CF e quebraria a soma.
:::

:::anos90 O relógio do PC AT fala BCD
O relógio com bateria do PC AT (o chip MC146818, na "CMOS") guarda hora e data em BCD. A `INT 1Ah` da BIOS, com AH = 02h, devolve as horas em CH, os minutos em CL e os segundos em DH, todos em BCD compactado: às 14:35, CH = 14h e CL = 35h. Para mostrar, basta separar os nibbles, exatamente como na `IMPRIMIR_BCD`.
:::

## BCD descompactado e ASCII: AAA e AAS

Com um dígito por byte, o par é `ADD` + **AAA** (*ASCII Adjust after Addition*). Ele corrige AL para um dígito de 0 a 9 e, se houve vai-um, soma 1 em **AH** e liga CF. O nome tem "ASCII" porque ele **ignora o nibble alto** de AL: funciona direto com os caracteres '0' a '9' (30h a 39h).

```asm fragmento
        MOV  AX, 0038h      ; AH = 0, AL = '8'
        ADD  AL, '7'        ; AL = 38h + 37h = 6Fh
        AAA                 ; AL = 05h, AH = 01h, CF = 1  →  "15"
        OR   AX, 3030h      ; AX = 3135h = '1' '5', pronto para imprimir
```

`SUB` + **AAS** faz o mesmo na subtração: corrige AL e, se houve empréstimo, tira 1 de AH. Com esse par dá para somar números de qualquer tamanho guardados como texto, dígito a dígito, sem nunca converter para binário.

## AAM: dividir por 10 com uma instrução

**AAM** (*ASCII Adjust after Multiplication*) foi feita para corrigir o resultado de um `MUL` de dois dígitos descompactados (7 × 8 = 56 → AH = 5, AL = 6). Mas o que ela faz por dentro é útil para qualquer coisa: **divide AL por 10**, põe o quociente em AH e o resto em AL.

```diagrama titulo="AAM separa os dígitos de um número de 0 a 99"
   AL = 47 (2Fh)
        │
       AAM          AH = AL / 10 = 4
        │           AL = AL mod 10 = 7
        ▼
   AX = 0407h   →   OR AX,3030h   →   AX = 3437h = '4' '7'
```

É o jeito clássico de imprimir números de **dois dígitos**: horas, minutos, segundos, dias, porcentagens. Não precisa de `DIV`, de DX zerado nem de pilha:

```asm executar titulo="TEMPO.ASM: segundos para MM:SS"
.MODEL SMALL
.STACK 100h
.DATA
total   DW 754              ; 754 segundos
t_res   DB 'Tempo: $'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AH, 09h
        MOV  DX, OFFSET t_res
        INT  21h
        MOV  AX, total
        MOV  BL, 60
        DIV  BL             ; AL = minutos (12), AH = segundos (34)
        MOV  BH, AH         ; guarda os segundos
        CALL DOIS_DIGITOS   ; imprime AL com dois dígitos
        MOV  DL, ':'
        MOV  AH, 02h
        INT  21h
        MOV  AL, BH
        CALL DOIS_DIGITOS
        MOV  AX, 4C00h
        INT  21h

; DOIS_DIGITOS: imprime AL (0 a 99) com dois dígitos, com zero à esquerda
DOIS_DIGITOS PROC
        PUSH AX
        PUSH BX
        PUSH DX
        AAM                 ; AH = dezena, AL = unidade
        OR   AX, 3030h      ; os dois viram ASCII
        MOV  BX, AX         ; guarda os dígitos em BX
        MOV  DL, BH         ; dezena primeiro
        MOV  AH, 02h
        INT  21h
        MOV  DL, BL         ; depois a unidade
        INT  21h
        POP  DX
        POP  BX
        POP  AX
        RET
DOIS_DIGITOS ENDP
END inicio
```

O resultado é `Tempo: 12:34`. Repare que os dígitos ficam em BX, e não em AL: o `INT 21h` com AH = 02h devolve AL = DL, então a unidade guardada em AL seria trocada pela dezena (a armadilha da Aula 19).

**AAD** (*ASCII Adjust before Division*) faz o caminho inverso, e **antes** da conta: transforma dois dígitos descompactados em AH e AL no valor binário (AL = AH × 10 + AL, AH = 0), pronto para um `DIV`.

```asm fragmento
        MOV  AX, 0702h      ; os dígitos "7" e "2"
        AAD                 ; AX = 0048h = 72
        MOV  BL, 9
        DIV  BL             ; AL = 8, AH = 0: 72 / 9 = 8
```

:::cpu O 10 está escondido no código
`AAM` é codificada como **D4 0A** e `AAD` como **D5 0A**: o segundo byte é a base. Nos processadores da Intel, trocar esse byte faz a instrução usar outra base (D4 10h divide por 16, separando os nibbles). Era um truque não documentado, conhecido dos programadores de demos; o montador deste curso aceita só a forma oficial, sem operando.
:::

```quiz
? Qual o valor de AL depois de MOV AL,29h / ADD AL,13h / DAA?
- 3Ch
+ 42h
- 32h
> 29h + 13h = 3Ch em binário. O nibble baixo C passa de 9, então o DAA soma 6: 3Ch + 6 = 42h, ou seja, 29 + 13 = 42.

? Por que o laço da soma BCD de vários bytes usa INC em vez de ADD SI,1?
+ Porque INC não altera CF, e o vai-um decimal precisa chegar ao próximo ADC
- Porque INC é mais rápido em memória
- Porque ADD não funciona com SI
> O DAA deixa em CF o vai-um decimal do byte. ADD SI,1 apagaria esse CF.

? O que AAM faz com AL = 63?
- AL = 6, AH = 3
+ AH = 6, AL = 3
- AX = 0063h
> AAM divide AL por 10: quociente (dezena) em AH, resto (unidade) em AL.

? Qual a vantagem principal do BCD compactado num placar de jogo?
+ Mostrar o número é imediato, sem nenhuma divisão
- Ocupa menos memória que o binário
- As somas são mais rápidas que em binário
> Cada nibble é um dígito. O BCD ocupa mais memória e soma um pouco mais devagar (por causa do DAA), mas a conversão para texto praticamente some.
```

## Ponto fixo: a vírgula imaginária

Agora o outro problema: números com fração, como 3,25 ou −0,5, sem coprocessador. A ideia é combinar que um inteiro de 16 bits representa **o número vezes 256**. Os 8 bits de cima são a parte inteira; os 8 de baixo, a fração em 256 avos. Esse formato se chama **8.8**.

```diagrama titulo="Ponto fixo 8.8 em uma word"
       AH (parte inteira)     AL (fração, em 1/256)
   ┌───────────────────────┬───────────────────────┐
   │ 0 0 0 0 0 0 1 1       │ 0 1 0 0 0 0 0 0       │   = 0340h = 832
   └───────────────────────┴───────────────────────┘
               3                  64/256 = 0,25           832 / 256 = 3,25

   1,0   = 0100h     0,5  = 0080h      0,25  = 0040h     1/256 = 0001h
   2,75  = 02C0h     −1,0 = FF00h      −0,5  = FF80h     (complemento de dois)
```

A vírgula não existe para a CPU: ela só vê um inteiro. Quem lembra onde está a vírgula é você. Isso traz uma vantagem enorme: as contas são as do inteiro.

**Somar e subtrair** é `ADD` e `SUB`, sem nada a mais: 3,25 + 1,5 = 0340h + 0180h = 04C0h = 4,75. Comparar também é `CMP` com os saltos com sinal.

**Converter**: de inteiro para 8.8, ponha o número em AH e zere AL. De 8.8 para inteiro (truncando), pegue AH. Para **arredondar**, some 0,5 (0080h) antes de pegar AH.

Uma bola caindo, com gravidade de 0,25 pixel por quadro ao quadrado, é o exemplo típico: posição e velocidade ganham fração, e as contas continuam sendo somas.

```asm executar titulo="QUEDA.ASM: física em ponto fixo 8.8"
.MODEL SMALL
.STACK 100h
.DATA
altura  DW 100 * 256        ; 100,0 em 8.8
veloc   DW 0                ; 0,0
GRAV    EQU 40h             ; 0,25 em 8.8
t_q     DB 'Quadro $'
t_a     DB ': altura $'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CX, 1
@@quadro:
        ADD  veloc, GRAV        ; v = v + g
        MOV  AX, veloc
        SUB  altura, AX         ; y = y − v
        JS   @@fim              ; passou do chão (negativo)
        MOV  AH, 09h
        MOV  DX, OFFSET t_q
        INT  21h
        MOV  AX, CX
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        MOV  DX, OFFSET t_a
        INT  21h
        MOV  AX, altura
        ADD  AX, 80h            ; arredonda (+0,5)
        MOV  AL, AH             ; parte inteira
        XOR  AH, AH
        CALL IMPRIMIR_NUMERO
        MOV  DL, 13
        MOV  AH, 02h
        INT  21h
        MOV  DL, 10
        INT  21h
        INC  CX
        JMP  @@quadro
@@fim:  MOV  AX, 4C00h
        INT  21h

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

A bola cai 0,25, depois 0,5, depois 0,75 pixel por quadro... e chega ao chão no quadro 28. Com inteiros puros, uma gravidade menor que 1 pixel por quadro seria impossível.

### Multiplicar: o resultado vem deslocado

Multiplicar dois números 8.8 multiplica também os dois fatores de 256: (a × 256) × (b × 256) = a × b × **65.536**. O resultado do `IMUL` em DX:AX é um número **16.16**, e para voltar ao 8.8 é preciso dividir por 256, isto é, deslocar 8 bits para a direita. Como 8 bits são exatamente um byte, o deslocamento é só **escolher os bytes do meio**:

```diagrama titulo="2,5 × 1,5 = 3,75 em ponto fixo 8.8"
   AX = 0280h (2,5)     BX = 0180h (1,5)

   IMUL BX   →   DX:AX = 0003h:C000h  =  3,75 × 65.536

        DH      DL      AH      AL
      ┌──────┬──────┬──────┬──────┐
      │  00  │  03  │  C0  │  00  │
      └──────┴──────┴──────┴──────┘
               └──────┬─────┘
                   resultado 8.8 = 03C0h = 3,75
                   (MOV AL,AH / MOV AH,DL)
```

```asm fragmento
; MUL88: AX = AX × BX, ambos em 8.8 com sinal
        IMUL BX             ; DX:AX = produto em 16.16
        MOV  AL, AH         ; os bytes do meio...
        MOV  AH, DL         ; ...são o resultado em 8.8
```

Três instruções além do `IMUL`, nenhum deslocamento de verdade. Funciona com sinal porque o `IMUL` já fez a parte difícil; pegar os bytes do meio equivale a um deslocamento aritmético de 8 bits, que arredonda para baixo (para −∞). Para **arredondar ao mais próximo**, some 0080h ao DX:AX antes de pegar os bytes (`ADD AX,80h` / `ADC DX,0`).

:::atencao O resultado precisa caber
Em 8.8 com sinal, a faixa vai de −128 a +127,996. 20 × 10 = 200 não cabe: o byte DH teria informação que você jogou fora. O ponto fixo troca alcance por precisão, e escolher o formato (8.8, 12.4, 16.16...) é decidir quantos bits cada um merece.
:::

### Dividir: desloque antes

Na divisão acontece o contrário: (a × 256) ÷ (b × 256) = a ÷ b, **sem** o fator 256. Para o quociente sair em 8.8, o dividendo precisa entrar multiplicado por 256 a mais, ou seja, em 32 bits:

```asm fragmento
; DIV88: AX = AX ÷ BX, ambos em 8.8 com sinal
        MOV  DX, AX
        MOV  CL, 8
        SAR  DX, CL         ; DX = parte alta de (AX × 256), com sinal
        MOV  AH, AL
        XOR  AL, AL         ; DX:AX = AX × 256
        IDIV BX             ; AX = quociente em 8.8
```

O `SAR DX,CL` estende o sinal: para AX negativo, DX recebe FFh na parte alta. Como de costume no 8086, o deslocamento de 8 bits precisa de CL.

### 16.16 e tabelas de seno

O 8.8 é preciso o bastante para cores e velocidades, mas não para rotações 3D ou coordenadas de um mundo grande. Por isso os motores 3D dos anos 90 usavam **16.16**: 32 bits, metade inteira e metade fração, em dois registradores. A soma é `ADD` + `ADC`; a multiplicação, no 8086, precisa de quatro `MUL` (cada metade por cada metade), somando os pedaços na posição certa:

```asm fragmento
; MUL1616: DX:AX = (BX:CX) × (SI:DI), sem sinal, em 16.16
; (BX = inteiro de a, CX = fração de a; SI = inteiro de b, DI = fração de b)
MUL1616 PROC
        PUSH BP
        MOV  AX, CX
        MUL  DI             ; fração × fração: só a parte alta fica
        MOV  BP, DX
        MOV  AX, CX
        MUL  SI             ; fração de a × inteiro de b
        ADD  BP, AX
        ADC  DX, 0
        MOV  CX, DX
        MOV  AX, BX
        MUL  DI             ; inteiro de a × fração de b
        ADD  BP, AX
        ADC  CX, DX
        MOV  AX, BX
        MUL  SI             ; inteiro × inteiro: só a parte baixa cabe
        ADD  CX, AX
        MOV  DX, CX         ; DX = inteiro do resultado
        MOV  AX, BP         ; AX = fração do resultado
        POP  BP
        RET
MUL1616 ENDP
```

Com 2,5 × 1,5 (BX:CX = 0002h:8000h, SI:DI = 0001h:8000h), o resultado é DX:AX = 0003h:C000h = 3,75.

Ponto fixo combina muito bem com **tabelas**. Calcular um seno com uma série de Taylor custaria milhares de ciclos; guardar os valores prontos custa alguns bytes. Uma tabela de senos em 8.8 (seno × 256) para 0°, 15°, 30°... 90°:

```asm executar titulo="SENO.ASM: pontos de um círculo com uma tabela"
.MODEL SMALL
.STACK 100h
.DATA
; seno em 8.8 (× 256) de 0, 15, 30, 45, 60, 75 e 90 graus
seno    DW 0, 66, 128, 181, 222, 247, 256
raio    DW 100
t_g     DB ' graus: y = $'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  SI, SI             ; índice na tabela (0 a 6)
@@angulo:
        MOV  AX, SI             ; graus = índice × 15
        MOV  BL, 15
        MUL  BL
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        MOV  DX, OFFSET t_g
        INT  21h
        MOV  BX, SI
        SHL  BX, 1              ; tabela de words
        MOV  AX, raio           ; inteiro
        IMUL seno[BX]           ; DX:AX = raio × seno, em 8.8
        ADD  AX, 80h            ; arredonda
        ADC  DX, 0
        MOV  AL, AH             ; parte inteira = bytes AH e DL
        MOV  AH, DL
        CALL IMPRIMIR_NUMERO
        MOV  DL, 13
        MOV  AH, 02h
        INT  21h
        MOV  DL, 10
        INT  21h
        INC  SI
        CMP  SI, 7
        JB   @@angulo
        MOV  AX, 4C00h
        INT  21h

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

Aqui o raio é um **inteiro** e o seno é 8.8: o produto já é 8.8, e a parte inteira são os bytes AH e DL. O programa mostra 0, 26, 50, 71, 87, 96 e 100, que são os valores de 100 × sen(θ) arredondados. Um jogo real usava tabelas de 256 ou 1.024 ângulos (o círculo dividido em potências de 2, para o índice "dar a volta" sozinho com um `AND`), e o cosseno saía da mesma tabela, deslocada de um quarto de volta.

:::dica Ponto fixo ou 8087?
O coprocessador 8087, assunto da [próxima aula](aula:aula31), calcula com até 80 bits e tem raiz quadrada, seno e logaritmo prontos. Mas ele era um chip **opcional**, vendido à parte, que a maioria dos PCs domésticos não tinha. E mesmo quando existia, uma multiplicação no 8087 (perto de 130 ciclos, mais a carga e a gravação dos operandos na memória) não ganhava de um `IMUL` com um par de `MOV`. Para gráficos e jogos, o ponto fixo era o padrão; o 8087 brilhava em planilhas, engenharia e CAD, onde a precisão importa mais que a velocidade.
:::

```quiz
? Quanto vale 0180h em ponto fixo 8.8?
- 1,8
+ 1,5
- 384
> 0180h = 384, e 384 / 256 = 1,5. A parte inteira é 01h e a fração é 80h = 128/256 = 0,5.

? Depois de IMUL BX com dois valores 8.8, onde está o resultado em 8.8?
- Em AX
- Em DX
+ Nos bytes do meio: DL e AH
> O produto vem em 16.16 (multiplicado por 65.536). Dividir por 256 é pegar DL:AH, descartando DH e AL.

? Como arredondar um valor 8.8 em AX para o inteiro mais próximo?
+ ADD AX,80h e depois usar AH
- Usar AL
- SHR AX,1
> 80h é 0,5 em 8.8. Somar meio antes de truncar arredonda ao mais próximo.

? Por que a divisão em ponto fixo 8.8 precisa de um dividendo de 32 bits?
+ Porque o quociente de dois 8.8 perde o fator 256; é preciso multiplicar o dividendo por 256 antes
- Porque IDIV só aceita dividendos de 32 bits
- Porque a fração fica em DX
> (a × 256) / (b × 256) = a / b, sem fração. Com o dividendo deslocado 8 bits para a esquerda, o resultado volta a ter 8 bits de fração.
```

## Exercícios

```exercicio
id: a30-1
titulo: Placar em BCD
nivel: 2
exigir: DAA
--- enunciado
**placar** e **pontos** têm 3 bytes em BCD compactado cada (6 dígitos), com o byte **menos significativo primeiro**. Some **pontos** ao **placar**, deixando o resultado em **placar**. Se passar de 999999, o placar dá a volta (o vai-um final se perde).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
placar  DB 45h, 23h, 01h    ; 012345
pontos  DB 99h, 00h, 00h    ; 000099
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; placar = placar + pontos, em BCD
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "012345 + 000099 = 012444", "espera": { "mem": { "placar": [68, 36, 1] } } },
 { "nome": "999999 + 000001 dá a volta", "setup": { "placar": [153, 153, 153], "pontos": [1, 0, 0] }, "espera": { "mem": { "placar": [0, 0, 0] } } },
 { "nome": "050505 + 049595 = 100100", "setup": { "placar": [5, 5, 5], "pontos": [149, 149, 4] }, "espera": { "mem": { "placar": [0, 1, 16] } } },
 { "nome": "000000 + 000000", "setup": { "placar": [0, 0, 0], "pontos": [0, 0, 0] }, "espera": { "mem": { "placar": [0, 0, 0] } } }]
--- dicas
É a soma de vários bytes da Aula 21, com um DAA depois de cada ADC.
Comece com CLC e use ADC em todos os bytes, inclusive no primeiro.
Avance os ponteiros com INC (não mexe em CF) e conte com LOOP.
Só DAA trabalha em AL: carregue o byte do placar em AL, some o de pontos com ADC, faça DAA e grave de volta.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
placar  DB 45h, 23h, 01h    ; 012345
pontos  DB 99h, 00h, 00h    ; 000099
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET pontos
        MOV  DI, OFFSET placar
        MOV  CX, 3
        CLC
@@soma: MOV  AL, [DI]
        ADC  AL, [SI]
        DAA
        MOV  [DI], AL
        INC  SI
        INC  DI
        LOOP @@soma
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a30-2
titulo: Dois dígitos com AAM
nivel: 1
exigir: AAM
proibir: DIV, IDIV
--- enunciado
AL chega com um número de **0 a 99**. Imprima-o com **dois dígitos**, com zero à esquerda (7 vira `07`), usando **AAM** e sem `DIV`. Lembre que a função 02h do DOS devolve em AL o caractere impresso.
--- inicial
; AL = 0..99: imprima com dois dígitos
--- testes
[{ "nome": "7 vira 07", "setup": { "AX": 7 }, "espera": { "saida": "07" } },
 { "nome": "42", "setup": { "AX": 42 }, "espera": { "saida": "42" } },
 { "nome": "99", "setup": { "AX": 99 }, "espera": { "saida": "99" } },
 { "nome": "0 vira 00", "setup": { "AX": 0 }, "espera": { "saida": "00" } },
 { "nome": "10", "setup": { "AX": 10 }, "espera": { "saida": "10" } }]
--- dicas
AAM deixa a dezena em AH e a unidade em AL. OR AX,3030h transforma os dois em ASCII.
Guarde AX num registrador que o DOS não toca (BX, por exemplo) antes de imprimir.
Imprima BH e depois BL com AH = 02h e DL.
--- solucao
; AL = 0..99: imprima com dois dígitos
        AAM
        OR   AX, 3030h
        MOV  BX, AX
        MOV  DL, BH
        MOV  AH, 02h
        INT  21h
        MOV  DL, BL
        INT  21h
```

```exercicio
id: a30-3
titulo: Multiplicação em 8.8
nivel: 2
exigir: IMUL
--- enunciado
AX e BX chegam com números **com sinal em ponto fixo 8.8**. Deixe em **AX** o produto, também em 8.8 (truncado, pegando os bytes do meio do resultado de 32 bits). Os testes garantem que o produto cabe.
--- inicial
; AX = AX × BX, em ponto fixo 8.8
--- testes
[{ "nome": "2,5 × 1,5 = 3,75", "setup": { "AX": 640, "BX": 384 }, "espera": { "AX": 960 } },
 { "nome": "−2,0 × 3,25 = −6,5", "setup": { "AX": -512, "BX": 832 }, "espera": { "AX": -1664 } },
 { "nome": "0,5 × 0,5 = 0,25", "setup": { "AX": 128, "BX": 128 }, "espera": { "AX": 64 } },
 { "nome": "−1,5 × −1,5 = 2,25", "setup": { "AX": -384, "BX": -384 }, "espera": { "AX": 576 } },
 { "nome": "10 × 0,1 (1A) = 1,015625", "setup": { "AX": 2560, "BX": 26 }, "espera": { "AX": 260 } }]
--- dicas
IMUL BX deixa o produto em DX:AX, em 16.16.
O resultado 8.8 são os bytes DL (parte inteira) e AH (fração).
MOV AL,AH e depois MOV AH,DL. A ordem importa.
--- solucao
; AX = AX × BX, em ponto fixo 8.8
        IMUL BX
        MOV  AL, AH
        MOV  AH, DL
```

```exercicio
id: a30-4
titulo: Mostrar 8.8 com duas casas
nivel: 3
--- enunciado
AX chega com um número **sem sinal em ponto fixo 8.8** (de 0 a 255,996). Imprima-o com a parte inteira, um ponto e **duas casas decimais arredondadas**: 0340h vira `3.25`, 0180h vira `1.50` e 0055h (0,332...) vira `0.33`. Cuidado com o arredondamento que "vai um": 01FFh (1,996...) deve aparecer como `2.00`. A rotina **IMPRIMIR_NUMERO** já está pronta.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL IMPRIMIR_88
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_88: imprime AX (8.8 sem sinal) com duas casas
IMPRIMIR_88 PROC
        RET
IMPRIMIR_88 ENDP

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
[{ "nome": "3,25", "setup": { "AX": 832 }, "espera": { "saida": "3.25" } },
 { "nome": "1,50", "setup": { "AX": 384 }, "espera": { "saida": "1.50" } },
 { "nome": "0,33", "setup": { "AX": 85 }, "espera": { "saida": "0.33" } },
 { "nome": "1,996 vira 2.00", "setup": { "AX": 511 }, "espera": { "saida": "2.00" } },
 { "nome": "255,00", "setup": { "AX": 65280 }, "espera": { "saida": "255.00" } },
 { "nome": "1/256 vira 0.00", "setup": { "AX": 1 }, "espera": { "saida": "0.00" } },
 { "nome": "0,50", "setup": { "AX": 128 }, "espera": { "saida": "0.50" } }]
--- dicas
Os centésimos são AL × 100 / 256. Faça MUL com 100 (o resultado cabe em AX) e pegue AH: dividir por 256 é pegar o byte de cima.
Para arredondar, some 128 (meio de 256) ao produto antes de pegar AH.
Se os centésimos derem 100, some 1 à parte inteira e use 0 centésimos.
A parte inteira (que pode ir a 256 depois do arredondamento) vai para IMPRIMIR_NUMERO com AX; os centésimos (0 a 99) saem com AAM, como no exercício anterior.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL IMPRIMIR_88
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_88: imprime AX (8.8 sem sinal) com duas casas
IMPRIMIR_88 PROC
        PUSH AX
        PUSH BX
        PUSH DX
        MOV  BL, AH
        XOR  BH, BH         ; BX = parte inteira
        MOV  DL, 100
        MUL  DL             ; AX = fração × 100
        ADD  AX, 128        ; arredonda
        MOV  AL, AH         ; AL = centésimos (0 a 100)
        CMP  AL, 100
        JB   @@ok
        INC  BX             ; "vai um" para a parte inteira
        XOR  AL, AL
@@ok:   MOV  DH, AL         ; guarda os centésimos
        MOV  AX, BX
        CALL IMPRIMIR_NUMERO
        MOV  DL, '.'
        MOV  AH, 02h
        INT  21h
        MOV  AL, DH
        AAM
        OR   AX, 3030h
        MOV  BX, AX
        MOV  DL, BH
        MOV  AH, 02h
        INT  21h
        MOV  DL, BL
        INT  21h
        POP  DX
        POP  BX
        POP  AX
        RET
IMPRIMIR_88 ENDP

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

:::resumo
- BCD compactado guarda dois dígitos por byte e se lê como decimal em hexadecimal; o descompactado guarda um dígito por byte e vira ASCII com `OR 30h`.
- `ADD`/`ADC` + `DAA` e `SUB`/`SBB` + `DAS` fazem contas em BCD compactado, só em AL. Para vários bytes, use `ADC` com `INC` e `LOOP`, que preservam CF.
- `AAA` e `AAS` corrigem somas e subtrações de um dígito (ou de caracteres ASCII), levando o vai-um para AH.
- `AAM` divide AL por 10 (dezena em AH, unidade em AL): o jeito mais curto de imprimir dois dígitos. `AAD` faz o inverso, antes de um `DIV`.
- Ponto fixo 8.8 é o número × 256 numa word. Soma e subtração são as do inteiro; arredondar é somar 80h.
- Produto de dois 8.8: `IMUL` e pegar os bytes do meio (DL:AH). Divisão: dividendo × 256 em DX:AX antes do `IDIV`.
- 16.16 dá mais alcance e precisão; no 8086 a multiplicação precisa de quatro `MUL`. Tabelas de seno em ponto fixo substituem cálculos caros.
- O ponto fixo era o padrão em jogos e gráficos; o 8087 era opcional e não ganhava em velocidade nessas contas.
:::
