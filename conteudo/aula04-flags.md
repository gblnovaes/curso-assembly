---
id: aula04
numero: 4
modulo: 2
titulo: O registrador de FLAGS
subtitulo: CF, ZF, SF, OF, PF, AF e as flags de controle
duracao: 60 min
objetivos: saber o que cada flag significa e quando ela muda; distinguir estouro sem sinal (CF) de estouro com sinal (OF); prever as flags depois de ADD, SUB, INC, DEC e operações lógicas; ligar e desligar flags com STC, CLC, CMC, STD, CLD, STI e CLI
---

## Um registrador feito de bits soltos

Depois de cada conta, a CPU anota algumas informações sobre o resultado: "deu zero?", "ficou negativo?", "estourou?". Cada informação é um bit no registrador **FLAGS** (sinalizadores). Os saltos condicionais, que você vai ver na próxima aula, consultam esses bits para decidir se pulam ou não. É assim que um programa Assembly toma decisões.

```diagrama titulo="O registrador FLAGS do 8086 (16 bits)"
 bit:  15 14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
      ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
      │ 1│ 1│ 1│ 1│OF│DF│IF│TF│SF│ZF│ 0│AF│ 0│PF│ 1│CF│
      └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
                    └──┬──┘ └┬┘ └────────── estado ──────────┘
                   controle  │   (resultado da última conta)
                             └ controle
```

Há dois grupos:

- **Flags de estado** (CF, PF, AF, ZF, SF, OF): descrevem o resultado da última operação aritmética ou lógica.
- **Flags de controle** (DF, IF, TF): mudam o comportamento da CPU. Só mudam quando você manda.

## As flags de estado

| Flag | Nome | Fica 1 quando... |
|------|------|------------------|
| **CF** | Carry (vai-um) | o resultado **sem sinal** não coube: houve vai-um na soma ou empréstimo na subtração |
| **ZF** | Zero | o resultado é **zero** |
| **SF** | Sign (sinal) | o bit mais alto do resultado é 1 (resultado **negativo**, se for número com sinal) |
| **OF** | Overflow | o resultado **com sinal** não coube: dois positivos deram negativo, ou dois negativos deram positivo |
| **PF** | Parity (paridade) | o **byte baixo** do resultado tem um número **par** de bits 1 |
| **AF** | Auxiliary (auxiliar) | houve vai-um do bit 3 para o bit 4 (usada em aritmética BCD) |

### ZF: deu zero?

A mais simples e a mais usada:

```asm executar titulo="ZF"
        MOV  CX, 3
        DEC  CX          ; CX = 2, ZF = 0
        DEC  CX          ; CX = 1, ZF = 0
        DEC  CX          ; CX = 0, ZF = 1  <- deu zero!
        SUB  AX, AX      ; AX = 0, ZF = 1 (um jeito de zerar AX)
```

### CF: o estouro dos números sem sinal

Se você interpreta os bits como números **sem sinal** (0 a 255, 0 a 65.535), CF indica que a conta saiu da faixa:

- na **soma**, CF = 1 se houve vai-um para fora do registrador;
- na **subtração**, CF = 1 se o subtraendo era **maior** que o minuendo (houve "empréstimo"). Isso é muito útil: `SUB AX,BX` com CF = 1 significa que AX era menor que BX.

### SF e OF: o mundo dos números com sinal

O 8086 representa números negativos em **complemento de dois** (detalhes na Aula 22). Em 8 bits, os valores de 80h a FFh são lidos como −128 a −1, e o bit 7 indica o sinal. Para a CPU, os bits são só bits: **é você que decide** se um registrador tem um número com ou sem sinal. A CPU calcula as flags para as duas interpretações ao mesmo tempo:

- **CF** responde: "se fosse sem sinal, estourou?"
- **OF** responde: "se fosse com sinal, estourou?"
- **SF** é só uma cópia do bit mais alto: "se fosse com sinal, é negativo?"

O exemplo clássico é 127 + 1 em 8 bits:

```diagrama titulo="7Fh + 01h = 80h"
  sem sinal:  127 +  1 = 128    -> cabe em 0..255     -> CF = 0
  com sinal:  127 +  1 = -128 ! -> 128 não cabe em -128..127 -> OF = 1
  bit 7 do resultado (80h = 1000 0000) = 1             -> SF = 1
```

E o contrário, FFh + 01h:

```diagrama titulo="FFh + 01h = 00h"
  sem sinal:  255 +  1 = 0 !    -> estourou          -> CF = 1
  com sinal:   -1 +  1 = 0      -> correto           -> OF = 0
  resultado zero                                     -> ZF = 1
```

:::dica Regra prática para OF
Na soma, OF = 1 quando os dois operandos têm o **mesmo sinal** e o resultado tem sinal **diferente**. Na subtração, quando os operandos têm sinais **diferentes** e o resultado tem o sinal do subtraendo. Somar um positivo com um negativo **nunca** dá overflow.
:::

Use a calculadora abaixo. Ela executa a operação na CPU simulada e explica cada flag. Experimente 7Fh + 1, FFh + 1, 80h − 1, 5 − 10, e também INC e DEC com "CF antes = 1".

```widget flags
{ "op": "ADD", "a": "7Fh", "b": "1", "bits": 8 }
```

### PF e AF

**PF** conta os bits 1 do byte baixo do resultado e fica 1 se a quantidade for par. Vem dos tempos em que se verificava erros de transmissão em comunicação serial. Hoje quase ninguém usa.

**AF** indica vai-um do nibble baixo para o alto (do bit 3 para o 4). Ela existe para as instruções de ajuste decimal (`DAA`, `AAA`), usadas com números em BCD. Também é rara.

## Quem altera o quê

Nem toda instrução mexe nas flags. Esta tabela é para consultar sempre (a aba **Referência** tem a lista completa, com F6):

| Instrução | CF | ZF | SF | OF | Observação |
|-----------|----|----|----|----|------------|
| `MOV`, `XCHG`, `LEA`, `PUSH`, `POP` | – | – | – | – | não alteram nenhuma flag |
| `ADD`, `ADC`, `SUB`, `SBB`, `CMP`, `NEG` | ✓ | ✓ | ✓ | ✓ | todas as de estado |
| `INC`, `DEC` | – | ✓ | ✓ | ✓ | **preservam CF** |
| `AND`, `OR`, `XOR`, `TEST` | 0 | ✓ | ✓ | 0 | CF e OF sempre zeram |
| `NOT` | – | – | – | – | não altera flags |
| `LOOP`, `JMP`, `Jcc`, `CALL`, `RET` | – | – | – | – | saltos não alteram flags |

:::atencao MOV não altera flags
Um erro comum é achar que `MOV AX,0` liga ZF. Não liga. As flags continuam com o valor da última conta. Se você precisa das flags de um valor que acabou de carregar, compare-o (`CMP AX,0`) ou teste-o (`TEST AX,AX` ou `OR AX,AX`).
:::

## As flags de controle

| Flag | Nome | Para que serve | Liga | Desliga |
|------|------|----------------|------|---------|
| **DF** | Direction | 0: instruções de string avançam; 1: recuam | `STD` | `CLD` |
| **IF** | Interrupt | 1: a CPU aceita interrupções de hardware (teclado, timer) | `STI` | `CLI` |
| **TF** | Trap | 1: a CPU executa passo a passo, gerando INT 1 após cada instrução | (via pilha) | (via pilha) |

E para a flag CF existem três instruções próprias: `STC` (liga), `CLC` (desliga) e `CMC` (inverte). Elas são úteis para **devolver sucesso ou erro** de um procedimento: o DOS faz exatamente isso, e o Módulo 8 também.

:::anos90 Turbo Debugger
No Turbo Debugger as flags apareciam numa coluna estreita à direita: `c=0 z=1 s=0 o=0 p=1 a=0 i=1 d=0`. Ler essa coluna depois de cada F7 era o pão de cada dia. No DEBUG do DOS elas apareciam como siglas: `NV UP EI PL ZR NA PE NC`, em que `ZR` significa zero e `NZ` não zero, `CY` carry e `NC` sem carry, e assim por diante.
:::

## Lendo e gravando FLAGS inteiro

Não há `MOV AX, FLAGS`. Para ler ou gravar o registrador todo, use a pilha: `PUSHF` empilha FLAGS, `POPF` desempilha. E `LAHF`/`SAHF` copiam o byte baixo de FLAGS para AH e vice-versa. Veremos a pilha no Módulo 4.

```quiz
? Depois de MOV AL,80h e ADD AL,80h, quais flags ficam ligadas?
- Só CF
- Só ZF
+ CF, ZF e OF
- SF e OF
> 80h + 80h = 100h: AL fica 00h (ZF=1), o vai-um vai para CF (CF=1) e, com sinal, −128 + −128 = −256, que não cabe (OF=1).

? Qual instrução NÃO altera CF?
- ADD AX,1
+ INC AX
- SUB AX,1
> INC e DEC preservam CF.

? MOV AX,0 liga ZF?
- Sim, porque AX ficou zero.
+ Não, MOV não altera nenhuma flag.
> Para atualizar ZF de acordo com AX use, por exemplo, TEST AX,AX.

? Depois de SUB AX,BX, CF = 1. O que isso diz sobre os valores originais (sem sinal)?
+ AX era menor que BX.
- AX era maior que BX.
- AX era igual a BX.
> Na subtração, CF = 1 indica empréstimo: o minuendo (AX) era menor que o subtraendo (BX).

? Em 8 bits, 100 + 50 = 150. Como ficam CF e OF?
- CF=1, OF=0
+ CF=0, OF=1
- CF=1, OF=1
> Sem sinal, 150 cabe em 0..255 (CF=0). Com sinal, dois positivos deram 150, que passa de 127: o resultado é lido como −106 (OF=1).
```

## Exercícios

```exercicio
id: a04-1
titulo: Ligue CF e ZF juntas
nivel: 1
--- enunciado
Escreva uma soma de **8 bits** com `MOV` e `ADD` em **AL** que termine com **CF = 1** e **ZF = 1** ao mesmo tempo.
--- inicial
        MOV  AL, 0
        ADD  AL, 0
--- testes
[{ "nome": "CF=1, ZF=1 e AL=0", "espera": { "CF": 1, "ZF": 1, "AL": 0 } }]
--- dicas
Para dar zero e vai-um ao mesmo tempo, a soma precisa dar exatamente 256.
--- solucao
        MOV  AL, 0FFh
        ADD  AL, 1
```

```exercicio
id: a04-2
titulo: Overflow sem carry
nivel: 2
--- enunciado
Faça uma soma de **16 bits** em **AX** que termine com **OF = 1** e **CF = 0**.
--- inicial
        MOV  AX, 0
        ADD  AX, 0
--- testes
[{ "nome": "OF=1 e CF=0", "espera": { "OF": 1, "CF": 0 } }]
--- dicas
Some dois positivos (de 0 a 7FFFh) cujo resultado passe de 7FFFh.
--- solucao
        MOV  AX, 7FFFh
        ADD  AX, 1
```

```exercicio
id: a04-3
titulo: INC preserva o carry
nivel: 2
--- enunciado
Prove que `INC` não mexe em CF: termine o programa com **CF = 1**, **ZF = 1** e **BL = 0**, sendo que a **última** instrução precisa ser `INC BL`.
--- inicial
        MOV  BL, 0
        INC  BL
--- testes
[{ "nome": "CF=1, ZF=1, BL=0", "espera": { "CF": 1, "ZF": 1, "BL": 0 } }]
--- dicas
Para INC BL dar zero, BL precisa valer FFh antes.
CF precisa estar ligada antes do INC: STC liga CF.
--- solucao
        MOV  BL, 0FFh
        STC
        INC  BL
```

```exercicio
id: a04-4
titulo: Sinal negativo sem overflow
nivel: 2
--- enunciado
Faça uma **subtração** de 8 bits em **AL** que deixe **SF = 1**, **OF = 0** e **CF = 1**. Pense: que conta sem sinal pede empréstimo e, com sinal, dá um negativo correto?
--- inicial
        MOV  AL, 0
        SUB  AL, 0
--- testes
[{ "nome": "SF=1, OF=0, CF=1", "espera": { "SF": 1, "OF": 0, "CF": 1 } }]
--- dicas
3 − 5 com sinal dá −2, que é FEh. Sem sinal, 3 < 5 pede empréstimo.
--- solucao
        MOV  AL, 3
        SUB  AL, 5
```

:::resumo
- ZF: resultado zero. SF: bit alto do resultado. PF: paridade do byte baixo. AF: vai-um do bit 3.
- CF: estouro **sem sinal** (vai-um ou empréstimo). OF: estouro **com sinal**.
- MOV, XCHG, LEA, PUSH, POP, NOT e saltos não alteram flags. INC/DEC não alteram CF. Lógicas zeram CF e OF.
- STC/CLC/CMC controlam CF; STD/CLD controlam DF; STI/CLI controlam IF.
:::
