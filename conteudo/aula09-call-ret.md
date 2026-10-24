---
id: aula09
numero: 9
modulo: 4
titulo: CALL e RET: procedimentos
subtitulo: Sub-rotinas, endereço de retorno e chamadas near e far
duracao: 55 min
objetivos: escrever procedimentos com PROC e ENDP; entender exatamente o que CALL e RET fazem com a pilha; distinguir chamadas near e far; usar RET n; passar dados por registradores e preservar o que não é resultado
---

## Por que procedimentos

Imagine imprimir um número em decimal em dez lugares diferentes do programa. Copiar o mesmo código dez vezes desperdiça memória (e em 1985 memória era cara) e espalha os bugs. A solução é escrever o código **uma vez**, como um **procedimento** (ou sub-rotina), e **chamá-lo** de onde for preciso.

```asm fragmento
IMPRIME_CHAR PROC          ; início do procedimento
        MOV  AH, 02h
        INT  21h
        RET                ; volta para quem chamou
IMPRIME_CHAR ENDP          ; fim do procedimento
...
        MOV  DL, 'A'
        CALL IMPRIME_CHAR  ; chama
        MOV  DL, 'B'
        CALL IMPRIME_CHAR  ; chama de novo
```

`PROC` e `ENDP` são diretivas: marcam o começo e o fim e dão nome ao procedimento. O trabalho de verdade é das instruções `CALL` e `RET`.

## O que CALL e RET fazem

O segredo é a pilha. Quando a CPU executa `CALL`, ela precisa lembrar **para onde voltar**: o endereço da instrução seguinte ao `CALL`. Ela guarda esse endereço **na pilha**.

| Instrução | O que faz |
|-----------|-----------|
| `CALL proc` (near) | 1. empilha IP (o endereço da próxima instrução)  2. IP = endereço de proc |
| `RET` (near) | 1. desempilha para IP  2. a execução continua de onde parou |

```diagrama titulo="CALL e RET passo a passo"
  endereço  instrução                  pilha depois         IP depois
  0100      MOV DL,'A'
  0102      CALL IMPRIME   ─────────►  SS:00FE = 0105  ───►  0200
  0105      MOV DL,'B'     ◄────┐
            ...                 │
  0200   IMPRIME: MOV AH,02h    │
  0202      INT 21h             │
  0204      RET  ───────────────┘      (desempilha 0105) ──► 0105
```

Abra este exemplo no laboratório, use **F7** e observe a janela de pilha durante o `CALL` e o `RET`:

```asm executar titulo="CHAMADA.ASM"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  DL, 'O'
        CALL IMPRIME_CHAR
        MOV  DL, 'K'
        CALL IMPRIME_CHAR
        MOV  AX, 4C00h
        INT  21h

IMPRIME_CHAR PROC
        PUSH AX            ; preserva AX (INT 21h/02h altera AL e usamos AH)
        MOV  AH, 02h
        INT  21h
        POP  AX
        RET
IMPRIME_CHAR ENDP
END inicio
```

Repare no `MOV AX,4C00h` **antes** do procedimento: o programa precisa terminar antes de "cair" dentro do código da sub-rotina. Procedimentos costumam ficar depois do código principal, ou antes do rótulo de início.

:::atencao A pilha e o RET
O `RET` desempilha **o que estiver no topo** e salta para lá, sem conferir nada. Se o procedimento fez um `PUSH` a mais, o `RET` vai usar esse valor como endereço de retorno e o programa vai pular para um lugar aleatório. É por isso que equilibrar a pilha (Aula 8) é tão importante dentro de procedimentos.
:::

## Passando dados por registradores

A forma mais simples (e mais rápida) de passar informação para um procedimento é por **registradores**. Cada procedimento deve documentar o seu "contrato":

```asm fragmento
; ------------------------------------------------
; DOBRO: multiplica um número por 2
; Entrada: AX = número
; Saída:   AX = número * 2
; Altera:  só AX e as flags
; ------------------------------------------------
DOBRO   PROC
        ADD  AX, AX
        RET
DOBRO   ENDP
```

### Quem preserva o quê

Uma regra de boa educação em Assembly: um procedimento **não deve estragar** registradores que não fazem parte do seu resultado. Se precisar deles como rascunho, salve na entrada e restaure na saída:

```asm fragmento
CONTA_ZEROS PROC        ; Entrada: SI = vetor, CX = tamanho. Saída: AX
        PUSH CX         ; vamos estragar CX e SI: preserva
        PUSH SI
        XOR  AX, AX
@@laco: CMP  BYTE PTR [SI], 0
        JNE  @@nao
        INC  AX
@@nao:  INC  SI
        LOOP @@laco
        POP  SI
        POP  CX
        RET
CONTA_ZEROS ENDP
```

:::dica Rótulos locais com @@
No TASM, rótulos que começam com `@@` são **locais** ao procedimento: você pode ter um `@@laco` em cada PROC sem conflito. O simulador aceita essa convenção, muito usada nos anos 90.
:::

## Chamadas aninhadas

Um procedimento pode chamar outro. Cada `CALL` empilha um endereço de retorno, e cada `RET` desempilha o seu, na ordem certa, graças ao LIFO:

```asm executar titulo="ANINHADO.ASM"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 3
        CALL QUADRUPLO      ; AX = 12
        MOV  AX, 4C00h
        INT  21h

QUADRUPLO PROC
        CALL DOBRO          ; pilha: [retorno do main][retorno do QUADRUPLO]
        CALL DOBRO
        RET
QUADRUPLO ENDP

DOBRO   PROC
        ADD  AX, AX
        RET
DOBRO   ENDP
END inicio
```

Para ver o valor de AX no fim, pare antes do `MOV AX,4C00h` (no laboratório, coloque o cursor na linha e use **F4**). E use **F8** (passo por cima) para executar um `CALL` inteiro de uma vez.

## Near e far

Até aqui, todas as chamadas foram **near** (próximas): o procedimento está no **mesmo segmento** de código, então basta empilhar e trocar o IP.

Quando o procedimento está em **outro segmento**, a chamada é **far** (distante): a CPU precisa trocar CS e IP. Ela empilha **CS e depois IP**, e o retorno far (`RETF`) desempilha os dois:

| | CALL near | CALL far |
|-|-----------|----------|
| empilha | IP (2 bytes) | CS e IP (4 bytes) |
| tamanho da instrução | 3 bytes | 5 bytes |
| ciclos | 19 | 28 |
| retorno | `RET` (C3h), 8 ciclos | `RETF` (CBh), 18 ciclos |

Você declara o tipo no `PROC`: `NOME PROC NEAR` (padrão no modelo SMALL) ou `NOME PROC FAR`. O montador então gera o `CALL` e o `RET` do tipo certo.

:::anos90 Modelos de memória
Os modelos do MASM e do TASM (TINY, SMALL, MEDIUM, COMPACT, LARGE, HUGE) existiam justamente por causa disso. No SMALL, todo o código cabe em um segmento de 64 KB e as chamadas são near. Programas maiores que 64 KB de código, como os grandes processadores de texto e planilhas da época, usavam os modelos MEDIUM ou LARGE, com chamadas far por toda parte.
:::

## RET n

`RET` aceita um número: `RET 4` desempilha o endereço de retorno e **depois soma 4 a SP**, descartando 4 bytes extras da pilha. Isso serve para limpar parâmetros que o chamador empilhou antes do `CALL`. É o assunto da próxima aula.

```quiz
? O que CALL near empilha?
- CS e IP
+ O endereço da instrução seguinte ao CALL (IP)
- O endereço do procedimento
> O endereço de retorno é o IP da instrução que vem depois do CALL.

? Um procedimento faz PUSH BX e esquece o POP antes do RET. O que acontece?
- Nada, o RET corrige.
+ O RET usa o valor de BX como endereço de retorno e o programa pula para um lugar errado.
- O montador acusa erro.
> O RET desempilha o topo, seja ele qual for.

? Quantos bytes um CALL far empilha?
- 2
+ 4
- 6
> CS e IP: duas words.

? Qual a vantagem de rótulos @@ no TASM?
+ São locais ao PROC, então podem se repetir em procedimentos diferentes.
- Ocupam menos memória.
- São mais rápidos.
> Rótulos com @@ ficam restritos ao procedimento em que aparecem.

? Por que colocamos MOV AX,4C00h / INT 21h antes dos procedimentos?
+ Para o programa terminar antes de cair no código dos procedimentos.
- Porque o DOS exige.
- Para inicializar a pilha.
> Sem isso a CPU continua em linha reta e executa o procedimento sem ter sido chamada, terminando com um RET sem CALL.
```

## Exercícios

```exercicio
id: a09-1
titulo: Procedimento TRIPLO
nivel: 1
exigir: CALL
--- enunciado
Escreva o procedimento **TRIPLO**, que recebe um número em **AX** e devolve o triplo em **AX**, sem alterar nenhum outro registrador. O programa principal já o chama.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 7
        MOV  BX, 1234h
        CALL TRIPLO
        MOV  DX, AX         ; DX = 21
        MOV  AX, 4C00h
        INT  21h

TRIPLO  PROC
        ; seu código aqui
        RET
TRIPLO  ENDP
END inicio
--- testes
[{ "nome": "DX = 21 e BX intacto", "espera": { "DX": 21, "BX": 4660, "pilhaEquilibrada": true } }]
--- dicas
Se usar BX como rascunho, salve-o com PUSH BX no começo e restaure com POP BX antes do RET.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 7
        MOV  BX, 1234h
        CALL TRIPLO
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

TRIPLO  PROC
        PUSH BX
        MOV  BX, AX
        ADD  AX, AX
        ADD  AX, BX
        POP  BX
        RET
TRIPLO  ENDP
END inicio
```

```exercicio
id: a09-2
titulo: Imprime uma linha de asteriscos
nivel: 2
exigir: CALL
--- enunciado
Escreva o procedimento **LINHA**, que imprime **CX** asteriscos seguidos de uma quebra de linha (13, 10). O procedimento deve preservar todos os registradores que usar. O programa principal imprime um triângulo com linhas de 1, 2 e 3 asteriscos.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  CX, 1
        CALL LINHA
        MOV  CX, 2
        CALL LINHA
        MOV  CX, 3
        CALL LINHA
        MOV  AX, 4C00h
        INT  21h

LINHA   PROC
        ; imprima CX asteriscos e depois 13, 10
        RET
LINHA   ENDP
END inicio
--- testes
[{ "nome": "triângulo", "espera": { "saida": "*\n**\n***", "pilhaEquilibrada": true } }]
--- dicas
INT 21h com AH = 02h imprime o caractere em DL.
Salve AX, CX e DX na entrada; LOOP usa CX como contador.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  CX, 1
        CALL LINHA
        MOV  CX, 2
        CALL LINHA
        MOV  CX, 3
        CALL LINHA
        MOV  AX, 4C00h
        INT  21h

LINHA   PROC
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  AH, 02h
        MOV  DL, '*'
@@ast:  INT  21h
        LOOP @@ast
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        POP  DX
        POP  CX
        POP  AX
        RET
LINHA   ENDP
END inicio
```

```exercicio
id: a09-3
titulo: Máximo de um vetor como procedimento
nivel: 3
--- enunciado
Escreva o procedimento **MAXIMO**: recebe em **SI** o endereço de um vetor de words e em **CX** o número de elementos (CX ≥ 1), e devolve em **AX** o maior elemento (sem sinal). SI e CX devem voltar intactos. O programa chama MAXIMO para dois vetores.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
a       DW 5, 80, 12, 33
b       DW 900, 2, 901, 0, 77, 15
ma      DW 0
mb      DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        LEA  SI, a
        MOV  CX, 4
        CALL MAXIMO
        MOV  ma, AX
        LEA  SI, b
        MOV  CX, 6
        CALL MAXIMO
        MOV  mb, AX
        MOV  AX, 4C00h
        INT  21h

MAXIMO  PROC
        ; seu código aqui
        RET
MAXIMO  ENDP
END inicio
--- testes
[{ "nome": "máximos 80 e 901", "espera": { "mem": { "ma": 80, "mb": 901 }, "pilhaEquilibrada": true } }]
--- dicas
Salve SI e CX. Comece com AX = [SI] e compare com os demais.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
a       DW 5, 80, 12, 33
b       DW 900, 2, 901, 0, 77, 15
ma      DW 0
mb      DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        LEA  SI, a
        MOV  CX, 4
        CALL MAXIMO
        MOV  ma, AX
        LEA  SI, b
        MOV  CX, 6
        CALL MAXIMO
        MOV  mb, AX
        MOV  AX, 4C00h
        INT  21h

MAXIMO  PROC
        PUSH CX
        PUSH SI
        MOV  AX, [SI]
@@prox: CMP  [SI], AX
        JBE  @@nao
        MOV  AX, [SI]
@@nao:  ADD  SI, 2
        LOOP @@prox
        POP  SI
        POP  CX
        RET
MAXIMO  ENDP
END inicio
```

:::resumo
- `PROC`/`ENDP` delimitam o procedimento; `CALL` empilha o retorno e salta; `RET` desempilha e volta.
- Near: empilha IP. Far: empilha CS e IP; `RETF` desempilha os dois.
- Documente entradas, saídas e o que é alterado; preserve o resto com PUSH/POP.
- Termine o programa principal antes do código dos procedimentos.
- `@@rotulo` é local ao PROC (estilo TASM).
:::
