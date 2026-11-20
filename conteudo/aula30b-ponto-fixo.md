---
id: aula30b
numero: 30.5
modulo: 12
rotulo: 30B
titulo: Ponto fixo
subtitulo: Frações com inteiros, arredondamento e tabelas de seno
duracao: 50 min
objetivos: representar frações em ponto fixo 8.8 e 16.16; somar, multiplicar, dividir e arredondar em ponto fixo; usar tabelas de seno em ponto fixo; saber quando o ponto fixo é melhor que o coprocessador
prerequisitos: aula22; aula30
---

A [Aula 30](aula:aula30) mostrou a primeira forma de fugir do binário puro, o BCD. Esta aula mostra a segunda, que os jogos e as demos usavam o tempo todo: o **ponto fixo**, frações guardadas em inteiros comuns.

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
- Ponto fixo 8.8 é o número × 256 numa word. Soma e subtração são as do inteiro; arredondar é somar 80h.
- Produto de dois 8.8: `IMUL` e pegar os bytes do meio (DL:AH). Divisão: dividendo × 256 em DX:AX antes do `IDIV`.
- 16.16 dá mais alcance e precisão; no 8086 a multiplicação precisa de quatro `MUL`. Tabelas de seno em ponto fixo substituem cálculos caros.
- O ponto fixo era o padrão em jogos e gráficos; o 8087 era opcional e não ganhava em velocidade nessas contas.
:::
