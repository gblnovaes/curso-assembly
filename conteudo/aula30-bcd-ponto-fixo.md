---
id: aula30
numero: 30
modulo: 12
titulo: BCD: contas em decimal
subtitulo: BCD compactado e descompactado, DAA, DAS, AAA, AAS, AAM e AAD
duracao: 50 min
objetivos: representar números em BCD compactado e descompactado; corrigir somas e subtrações com DAA, DAS, AAA e AAS; somar números BCD de vários bytes; usar AAM para separar dígitos e AAD para preparar divisões
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

:::resumo
- BCD compactado guarda dois dígitos por byte e se lê como decimal em hexadecimal; o descompactado guarda um dígito por byte e vira ASCII com `OR 30h`.
- `ADD`/`ADC` + `DAA` e `SUB`/`SBB` + `DAS` fazem contas em BCD compactado, só em AL. Para vários bytes, use `ADC` com `INC` e `LOOP`, que preservam CF.
- `AAA` e `AAS` corrigem somas e subtrações de um dígito (ou de caracteres ASCII), levando o vai-um para AH.
- `AAM` divide AL por 10 (dezena em AH, unidade em AL): o jeito mais curto de imprimir dois dígitos. `AAD` faz o inverso, antes de um `DIV`.
:::
