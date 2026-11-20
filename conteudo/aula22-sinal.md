---
id: aula22
numero: 22
modulo: 8
titulo: Aritmética com sinal
subtitulo: Complemento de dois, CF contra OF, NEG, CBW/CWD, IMUL e IDIV
duracao: 55 min
objetivos: representar números negativos em complemento de dois; distinguir o estouro sem sinal (CF) do estouro com sinal (OF); usar NEG e entender o caso especial de 8000h; estender o sinal com CBW e CWD; multiplicar e dividir com sinal usando IMUL e IDIV; conhecer o estouro de -32768 / -1 e as particularidades do IDIV no 8086
prerequisitos: aula04; aula21
---

## Bits não têm sinal; você é que decide

Uma word guarda 16 bits, e só. O padrão `1111 1111 1111 1111` (FFFFh) pode ser **65.535** ou **−1**: depende de como **você** o interpreta. O processador não guarda essa informação em lugar nenhum. O que ele faz é calcular as flags para as duas interpretações ao mesmo tempo, e você escolhe quais flags olhar.

Até aqui quase tudo foi **sem sinal**. Nesta aula vamos aprender o outro lado: como os negativos são representados, quais instruções e saltos usar e onde estão as armadilhas.

## Complemento de dois

O 8086 representa números negativos em **complemento de dois**. Para obter −x a partir de x:

1. Inverta todos os bits (é o `NOT`, o "complemento de um").
2. Some 1.

```diagrama titulo="Calculando −5 em 8 bits"
   5         = 0000 0101   (05h)
   NOT 5     = 1111 1010   (FAh)
   + 1       = 1111 1011   (FBh)  =  −5

  conferindo: −5 + 5 = 1111 1011 + 0000 0101 = 1 0000 0000
                                               └─ o 9º bit se perde: 0000 0000
```

O truque funciona porque a aritmética de 8 bits é **circular**: depois de FFh vem 00h. Andar 251 passos para frente no círculo dá no mesmo que andar 5 para trás.

```diagrama titulo="O círculo dos bytes"
                     00h (0)
            FFh (−1)    │    01h (1)
       FEh (−2)         │         02h (2)
                        │
   C0h (−64)  ──────────┼──────────  40h (64)
                        │
       81h (−127)       │         7Eh (126)
            80h (−128)  │  7Fh (127)
                   a "costura" entre 7Fh e 80h:
                   é aqui que o estouro com sinal acontece
```

| Bits | Faixa sem sinal | Faixa com sinal |
|------|-----------------|-----------------|
| 8 | 0 a 255 | −128 a 127 |
| 16 | 0 a 65.535 | −32.768 a 32.767 |
| 32 | 0 a 4.294.967.295 | −2.147.483.648 a 2.147.483.647 |

Três propriedades importantes:

- **O bit mais alto é o sinal**: 1 = negativo. É o bit que vai para **SF**.
- **Somar e subtrair funciona igual** para com e sem sinal. É por isso que existe um só `ADD` e um só `SUB`. Só a multiplicação e a divisão precisam de versões diferentes.
- **A faixa é assimétrica**: existe −128, mas não existe +128. Guarde isso, vai importar.

Brinque com o simulador abaixo: digite um número e veja os bits, a inversão e o +1.

```widget complemento
{}
```

## CF contra OF: dois tipos de estouro

Depois de uma soma ou subtração, o processador liga duas flags diferentes para indicar que o resultado "não coube":

- **CF** (carry): estouro **sem sinal**. O resultado passou de 255 (ou 65.535) ou ficou abaixo de 0.
- **OF** (overflow): estouro **com sinal**. O resultado passou de 127 (ou 32.767) ou ficou abaixo de −128 (ou −32.768).

| Operação (8 bits) | Sem sinal | Com sinal | CF | OF |
|-------------------|-----------|-----------|----|----|
| `7Fh + 01h = 80h` | 127 + 1 = 128 ✓ | 127 + 1 = −128 ✗ | 0 | **1** |
| `FFh + 01h = 00h` | 255 + 1 = 0 ✗ | −1 + 1 = 0 ✓ | **1** | 0 |
| `80h + 80h = 00h` | 128 + 128 = 0 ✗ | −128 + −128 = 0 ✗ | **1** | **1** |
| `40h + 30h = 70h` | 64 + 48 = 112 ✓ | 64 + 48 = 112 ✓ | 0 | 0 |

A regra do OF numa soma: ele liga quando você soma **dois números de mesmo sinal** e o resultado tem **sinal diferente**. Somar um positivo com um negativo nunca estoura.

Experimente na calculadora de flags. Ela executa a instrução de verdade na CPU simulada:

```widget flags
{ "op": "ADD", "bits": 8, "a": "7Fh", "b": "1" }
```

:::dica Qual flag olhar
Se os seus números são sem sinal, olhe **CF** e use os saltos **JA, JB, JAE, JBE, JC**. Se são com sinal, olhe **OF** e **SF** e use **JG, JL, JGE, JLE, JO, JS**. Misturar os dois é o bug da temperatura da Aula 20.
:::

### Os saltos com sinal

| Salto | Condição (flags) | Significado após `CMP a, b` |
|-------|------------------|----------------------------|
| `JG` / `JNLE` | ZF = 0 e SF = OF | a > b |
| `JGE` / `JNL` | SF = OF | a ≥ b |
| `JL` / `JNGE` | SF ≠ OF | a < b |
| `JLE` / `JNG` | ZF = 1 ou SF ≠ OF | a ≤ b |
| `JO` / `JNO` | OF = 1 / OF = 0 | estourou / não estourou |
| `JS` / `JNS` | SF = 1 / SF = 0 | negativo / não negativo |

Por que **SF = OF** significa "maior ou igual"? O `CMP` calcula a − b. Se não houve estouro (OF = 0), o sinal do resultado (SF) diz a verdade: SF = 0 significa a − b ≥ 0. Se houve estouro (OF = 1), o sinal saiu **invertido**, então SF = 1 é que significa a ≥ b. Nos dois casos: a ≥ b quando SF = OF.

:::cpu INTO: a interrupção do estouro
O 8086 tem a instrução `INTO` (Interrupt on Overflow), de um byte: se OF = 1, ela executa `INT 4`. Um compilador que quisesse verificar estouros podia colocar um `INTO` depois de cada conta: custa só 4 ciclos quando não há estouro, e um único byte de código.
:::

```quiz
? Qual o valor de FEh interpretado como número de 8 bits com sinal?
- 254
+ −2
- −126
> FEh = 1111 1110. Invertendo dá 0000 0001, mais 1 dá 2. Então FEh é −2. Sem sinal, seria 254.

? Depois de ADD AL,BL com AL = 7Fh e BL = 01h, quais flags ficam ligadas?
- CF
+ OF e SF
- CF e ZF
> 127 + 1 = 128 não cabe em um byte com sinal (OF = 1), e o resultado 80h tem o bit de sinal ligado (SF = 1). Sem sinal, 128 cabe, então CF = 0.

? Por que existe um único ADD para números com e sem sinal?
+ Porque em complemento de dois a soma bit a bit dá o resultado certo nas duas interpretações
- Porque o 8086 não suporta números com sinal na soma
- Porque ADD converte o resultado automaticamente
> Só as flags mudam de significado: CF para sem sinal, OF para com sinal.

? Depois de CMP AX,BX, qual salto usar para "se AX < BX" com números com sinal?
- JB
+ JL
- JS
> JB compara sem sinal. JL testa SF ≠ OF, que é o "menor" com sinal.

? Qual a faixa de uma word com sinal?
- −32.767 a 32.767
+ −32.768 a 32.767
- −65.535 a 65.535
> A faixa é assimétrica: há um negativo a mais, porque o zero ocupa uma das posições "positivas".
```

## NEG e o caso de 8000h

`NEG` troca o sinal: calcula 0 − operando. Ele é o "inverte e soma 1" em uma instrução.

```asm fragmento
        MOV  AX, 5
        NEG  AX             ; AX = FFFBh (−5), CF = 1
        NEG  AX             ; AX = 0005h, CF = 1
```

As flags de `NEG` têm detalhes próprios: **CF = 1 sempre que o operando não era zero** (porque 0 − x "pede emprestado") e **OF = 1 em um único caso**: quando o operando é o menor negativo.

Lembra que a faixa é assimétrica? −32.768 (8000h) não tem um positivo correspondente. O que `NEG` faz com ele?

```diagrama titulo="NEG 8000h"
   8000h      = 1000 0000 0000 0000   (−32.768)
   NOT        = 0111 1111 1111 1111
   + 1        = 1000 0000 0000 0000   = 8000h de novo!

   −(−32.768) = 32.768, que não cabe em 16 bits com sinal: OF = 1
```

O mesmo vale para 80h em 8 bits. Uma rotina de **valor absoluto** que só faz `NEG` nos negativos devolve um número "negativo" para −32.768. Às vezes isso não importa, às vezes é um bug sério; o exercício 1 trata disso.

:::atencao O truque que salva a impressão
Se você imprime um número com sinal fazendo "se negativo, imprime '−' e faz NEG" e depois chama a rotina **sem sinal** (`IMPRIMIR_NUMERO`), o caso 8000h funciona por acaso: NEG devolve 8000h, que **sem sinal** é exatamente 32.768. É assim que quase todas as rotinas de impressão da época tratavam o −32.768 sem nenhum código especial.
:::

## Estendendo o sinal: CBW e CWD

Para converter um byte em word **sem sinal**, basta zerar a parte alta (`XOR AH,AH`). Com sinal não: −5 em 8 bits é FBh, e em 16 bits é **FFFBh**. A parte alta precisa ser preenchida com cópias do bit de sinal. Isso é a **extensão de sinal**:

| Instrução | Faz | Exemplo |
|-----------|-----|---------|
| `CBW` | estende AL para AX (AH = cópias do bit 7 de AL) | AL = FBh → AX = FFFBh |
| `CWD` | estende AX para DX:AX (DX = cópias do bit 15 de AX) | AX = FFFBh → DX:AX = FFFFh:FFFBh |

Ambas ocupam **1 byte** e não alteram nenhuma flag. Elas existem principalmente para preparar o dividendo do `IDIV`, como veremos agora.

## IMUL e IDIV

Multiplicação e divisão dão resultados diferentes para com e sem sinal, então existem instruções separadas. As formas são idênticas às de `MUL` e `DIV`:

| Instrução | Faz | Resultado |
|-----------|-----|-----------|
| `IMUL r/m8` | AL × op | AX |
| `IMUL r/m16` | AX × op | DX:AX |
| `IDIV r/m8` | AX ÷ op | AL quociente, AH resto |
| `IDIV r/m16` | DX:AX ÷ op | AX quociente, DX resto |

```diagrama titulo="MUL contra IMUL com os mesmos bits"
  AL = FFh, BL = 02h

  MUL BL:   255 × 2  =  510  =  AX = 01FEh
  IMUL BL:  −1 × 2   =  −2   =  AX = FFFEh
```

:::atencao No 8086, IMUL tem um operando só
Você vai ver em livros e na internet `IMUL AX,BX,10` ou `IMUL CX,5`. Essas formas foram criadas no **80186** e no **80386**. No 8086 só existe `IMUL op`, com o resultado em AX ou DX:AX. O montador deste curso recusa as outras formas para você não se acostumar com elas.
:::

Depois de `IMUL`, **CF e OF** ficam ligados quando a parte alta do resultado **não é** só a extensão de sinal da parte baixa. Em outras palavras: CF = OF = 0 significa "o resultado cabe em AX (ou AL) com sinal".

### Preparando o IDIV

Com `DIV`, o dividendo de 16 bits pedia `XOR DX,DX`. Com `IDIV` isso é um **erro**: se AX é negativo, DX precisa ser FFFFh. O certo é `CWD`:

```asm fragmento
        MOV  AX, -7
        CWD                 ; DX:AX = −7 em 32 bits (DX = FFFFh)
        MOV  BX, 2
        IDIV BX             ; AX = −3, DX = −1
```

Repare no resultado: **−7 ÷ 2 = −3, resto −1**. O `IDIV` arredonda o quociente **em direção a zero** e o resto fica com o **sinal do dividendo**. Sempre vale: dividendo = quociente × divisor + resto (−3 × 2 + (−1) = −7).

| Dividendo ÷ divisor | Quociente | Resto |
|---------------------|-----------|-------|
| 7 ÷ 2 | 3 | 1 |
| −7 ÷ 2 | −3 | −1 |
| 7 ÷ −2 | −3 | 1 |
| −7 ÷ −2 | 3 | −1 |

:::atencao SAR não é IDIV
Na Aula 16 trocamos divisões por potências de 2 por deslocamentos. Com sinal, `SAR` arredonda **para baixo** (para −∞): `SAR` de −7 por 1 bit dá **−4**, enquanto `IDIV` por 2 dá **−3**. Para números positivos os dois concordam. Para negativos, trocar um pelo outro muda o resultado.
:::

### O estouro de −32.768 ÷ −1

Assim como no `DIV`, o `IDIV` gera a **interrupção 0** quando o divisor é zero ou quando o quociente não cabe. E existe um caso que pega quase todo mundo:

```diagrama titulo="A divisão impossível"
   −32.768 ÷ −1 = +32.768

   +32.768 não cabe em uma word com sinal (máximo 32.767)
   → "Divide overflow", mesmo sem nenhuma divisão por zero
```

É a mesma assimetria do `NEG 8000h`, agora disfarçada de divisão. Uma calculadora que aceita −32.768 e deixa o usuário dividir por −1 trava. Em 8 bits, o caso é −128 ÷ −1.

:::cpu Uma particularidade do 8086
No 8086 e no 8088, o `IDIV` aceita quocientes só até **−32.767** (ou −127 em 8 bits). Um quociente exatamente igual a −32.768 também gera a interrupção 0, por exemplo −32.768 ÷ 1. O 80286 corrigiu isso, e a partir dele −32.768 passou a ser um quociente válido. O simulador deste curso reproduz o comportamento do 8086. Para escrever código que funcione em qualquer PC, trate −32.768 como caso especial antes de dividir.
:::

```quiz
? Qual instrução prepara corretamente DX:AX para IDIV BX quando AX pode ser negativo?
- XOR DX,DX
+ CWD
- CBW
> CWD copia o bit de sinal de AX para todos os bits de DX. XOR DX,DX transformaria −7 em 65.529.

? Quanto dá −7 ÷ 2 com IDIV?
+ Quociente −3, resto −1
- Quociente −4, resto 1
- Quociente −3, resto 1
> IDIV arredonda em direção a zero e o resto tem o sinal do dividendo. Quem dá −4 é o SAR.

? O que NEG faz com AX = 8000h?
- AX = 7FFFh
+ AX continua 8000h e OF = 1
- AX = 0 e CF = 1
> +32.768 não existe em 16 bits com sinal. NEG devolve o próprio 8000h e sinaliza o estouro em OF.

? Por que −32.768 ÷ −1 gera "Divide overflow"?
- Porque o divisor é negativo
+ Porque o resultado, +32.768, não cabe em uma word com sinal
- Porque IDIV não aceita dividendo negativo
> A faixa com sinal vai até 32.767. Mesmo sem divisão por zero, o quociente não cabe.

? Qual destas instruções existe no 8086?
- IMUL AX, BX, 10
- IMUL CX, 5
+ IMUL BX
> As formas com dois e três operandos são do 80186 e do 80386. No 8086 o IMUL tem um operando só.
```

## Exercícios

```exercicio
id: a22-1
titulo: Valor absoluto
nivel: 2
--- enunciado
AX chega com um número **com sinal**. Deixe em AX o seu **valor absoluto**. Se o valor absoluto não puder ser representado (o caso de −32.768), deixe AX como está e coloque **BX = 1**; nos outros casos, **BX = 0**.
--- inicial
; AX = |AX|, BX = 1 se impossível
--- testes
[{ "nome": "|−5| = 5", "setup": { "AX": -5 }, "espera": { "AX": 5, "BX": 0 } },
 { "nome": "|7| = 7", "setup": { "AX": 7 }, "espera": { "AX": 7, "BX": 0 } },
 { "nome": "|0| = 0", "setup": { "AX": 0 }, "espera": { "AX": 0, "BX": 0 } },
 { "nome": "|−32767| = 32767", "setup": { "AX": -32767 }, "espera": { "AX": 32767, "BX": 0 } },
 { "nome": "−32768 é impossível", "setup": { "AX": -32768, "BX": 0 }, "espera": { "AX": 32768, "BX": 1 } }]
--- dicas
TEST AX,AX e JNS pulam os não negativos.
Depois de NEG, OF = 1 só no caso de 8000h. Use JNO.
Zere BX no começo com MOV ou XOR, antes do teste (XOR mexe nas flags).
--- solucao
; AX = |AX|, BX = 1 se impossível
        XOR  BX, BX
        TEST AX, AX
        JNS  @@fim          ; já é positivo ou zero
        NEG  AX
        JNO  @@fim          ; OF = 1 só para 8000h
        INC  BX
@@fim:
```

```exercicio
id: a22-4
titulo: Divisão com sinal à prova de falhas
nivel: 3
exigir: IDIV
--- enunciado
Divida **AX** por **BX**, ambos **com sinal**, e guarde o quociente em **quoc** e o resto em **resto**. Antes de dividir, detecte os casos que fariam o **8086** gerar "Divide overflow" e, neles, coloque **erro = 1** sem executar o IDIV: divisor zero e dividendo **−32.768** com divisor **−1** ou **1** (no 8086 o quociente −32.768 também estoura). Os valores chegam em AX e BX quando o programa começa.
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
        ; AX / BX com sinal

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "−7 / 2 = −3 resto −1", "setup": { "AX": -7, "BX": 2 }, "espera": { "mem": { "quoc": -3, "resto": -1, "erro": 0 } } },
 { "nome": "7 / −2 = −3 resto 1", "setup": { "AX": 7, "BX": -2 }, "espera": { "mem": { "quoc": -3, "resto": 1, "erro": 0 } } },
 { "nome": "−32768 / 2 = −16384", "setup": { "AX": -32768, "BX": 2 }, "espera": { "mem": { "quoc": -16384, "resto": 0, "erro": 0 } } },
 { "nome": "100 / 0: erro", "setup": { "AX": 100, "BX": 0 }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "−32768 / −1: erro", "setup": { "AX": -32768, "BX": -1 }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "−32768 / 1: erro no 8086", "setup": { "AX": -32768, "BX": 1 }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "−32767 / −1 = 32767", "setup": { "AX": -32767, "BX": -1 }, "espera": { "mem": { "quoc": 32767, "resto": 0, "erro": 0 } } }]
--- dicas
Teste BX = 0 primeiro.
Depois: se AX = 8000h, verifique se BX = 1 ou BX = −1 (FFFFh).
Para dividir: CWD (nunca XOR DX,DX aqui) e IDIV BX. Quociente em AX, resto em DX.
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
        TEST BX, BX
        JZ   @@erro             ; divisor zero
        CMP  AX, 8000h
        JNE  @@divide
        CMP  BX, 1
        JE   @@erro             ; quociente -32768: estoura no 8086
        CMP  BX, -1
        JE   @@erro             ; quociente +32768: não existe
@@divide:
        CWD
        IDIV BX
        MOV  quoc, AX
        MOV  resto, DX
        JMP  @@fim
@@erro: MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Complemento de dois: −x = NOT x + 1. O bit mais alto é o sinal; a faixa é assimétrica (−32.768 a 32.767).
- `ADD` e `SUB` servem para os dois mundos. **CF** sinaliza estouro sem sinal; **OF**, estouro com sinal.
- Saltos sem sinal: JA, JB, JAE, JBE. Com sinal: JG, JL, JGE, JLE (testam SF = OF), além de JO e JS.
- `NEG 8000h` devolve 8000h com OF = 1. Na impressão, tratar o resultado como sem sinal resolve o caso.
- `CBW` e `CWD` estendem o sinal. Antes de `IDIV`, use `CWD`, nunca `XOR DX,DX`.
- `IMUL` e `IDIV` têm um operando só no 8086. `IDIV` arredonda em direção a zero; o resto tem o sinal do dividendo.
- −32.768 ÷ −1 estoura (e, no 8086, qualquer quociente −32.768 também). Verifique antes de dividir.
:::
