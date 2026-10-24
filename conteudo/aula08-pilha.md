---
id: aula08
numero: 8
modulo: 4
titulo: A pilha: PUSH e POP
subtitulo: A estrutura que faz procedimentos, interrupções e recursão funcionarem
duracao: 50 min
objetivos: entender a pilha como estrutura LIFO na memória; saber exatamente o que PUSH e POP fazem com SP; salvar e restaurar registradores; manter a pilha equilibrada; usar PUSHF e POPF
---

## Uma pilha de pratos

A **pilha** (*stack*) é uma área de memória usada como uma pilha de pratos: o último que entra é o primeiro que sai (**LIFO**, *last in, first out*). Você só mexe no prato de cima.

No 8086 a pilha fica no segmento **SS**, e o registrador **SP** aponta sempre para o **topo**: o último valor empilhado. Uma particularidade importante: a pilha **cresce para baixo**, em direção a endereços menores.

```diagrama titulo="A pilha na memória"
  endereço alto   SS:0100  ┌──────────┐  <- SP inicial (pilha vazia)
                  SS:00FE  │  valor 1 │  <- 1º PUSH
                  SS:00FC  │  valor 2 │  <- 2º PUSH
                  SS:00FA  │  valor 3 │  <- SP agora (topo)
                  SS:00F8  │   livre  │
                     ...   │   livre  │  a pilha cresce para baixo
  endereço baixo  SS:0000  └──────────┘
```

No programa .EXE, a diretiva `.STACK 100h` reserva 256 bytes de pilha, e o DOS já inicializa SS e SP quando carrega o programa. Você não precisa configurar nada.

## PUSH e POP

| Instrução | O que faz, na ordem |
|-----------|---------------------|
| `PUSH origem` | 1. SP = SP − 2  2. grava a word em SS:[SP] |
| `POP destino` | 1. lê a word de SS:[SP] para o destino  2. SP = SP + 2 |

Regras do 8086:

- A pilha trabalha **só com words** (16 bits). `PUSH AL` não existe.
- A origem de `PUSH` pode ser registrador de 16 bits, registrador de segmento ou memória (`PUSH WORD PTR [BX]`).
- **`PUSH 5` não existe no 8086**: empilhar um imediato só apareceu no 80186. Use `MOV AX,5` e `PUSH AX`.
- `POP CS` não é permitido.

Experimente o simulador de pilha. Empilhe AX, BX e CX e desempilhe em outra ordem:

```widget pilha
```

Repare que `POP` **não apaga** o valor da memória: ele só move SP. O valor antigo fica lá até ser sobrescrito por outro `PUSH`.

## Salvar e restaurar registradores

O uso mais comum da pilha é guardar registradores temporariamente:

```asm executar titulo="Guardando registradores"
        MOV  AX, 1111h
        MOV  BX, 2222h
        PUSH AX          ; guarda AX
        PUSH BX          ; guarda BX
        MOV  AX, 0       ; usa AX e BX para outra coisa
        MOV  BX, 0
        POP  BX          ; restaura na ordem INVERSA
        POP  AX          ; AX = 1111h, BX = 2222h
```

A ordem dos `POP` é **inversa** à dos `PUSH`. Se você inverter, os valores voltam trocados. Isso às vezes é usado de propósito: `PUSH AX` / `PUSH BX` / `POP AX` / `POP BX` troca AX e BX (mas `XCHG` é mais rápido).

## A pilha precisa ficar equilibrada

Cada `PUSH` precisa de um `POP` correspondente antes de o programa sair do trecho que empilhou. Se sobrar um valor, ou faltar, o próximo `POP` (ou o próximo `RET`, na Aula 9) vai pegar o valor errado, e o programa provavelmente vai travar.

:::atencao Pilha desequilibrada
É o bug que mais travava PCs nos anos 80: um `PUSH` dentro de um `if` sem o `POP` correspondente no `else`. A CPU não avisa nada. No simulador, olhe a janela **Pilha SS:SP** do laboratório: o SP no fim de um trecho deve ser igual ao do começo. Os exercícios desta aula conferem isso.
:::

## Copiando segmentos pela pilha

Lembra que `MOV ES,DS` não existe? A pilha resolve em duas instruções, sem gastar um registrador geral:

```asm fragmento
        PUSH DS
        POP  ES          ; ES = DS
```

## PUSHF e POPF

`PUSHF` empilha o registrador de FLAGS inteiro e `POPF` o restaura. Uso típico: preservar as flags em volta de um trecho que as altera, ou alterar uma flag que não tem instrução própria (como TF):

```asm fragmento
        PUSHF               ; empilha FLAGS
        POP  AX             ; AX = FLAGS
        OR   AX, 0100h      ; liga o bit 8 (TF)
        PUSH AX
        POPF                ; FLAGS = AX: modo passo a passo ligado
```

:::cpu PUSH SP no 8086
Um detalhe que só os especialistas conhecem: no 8086, `PUSH SP` empilha o valor de SP **já decrementado**. A partir do 80286 a Intel mudou isso para empilhar o valor antigo. Programas de detecção de CPU dos anos 90 usavam exatamente essa diferença para saber se estavam em um 8086 ou num 286. O simulador reproduz o comportamento do 8086.
:::

## Invertendo uma string com a pilha

Como a pilha devolve as coisas ao contrário, ela inverte sequências naturalmente:

```asm executar titulo="INVERTE.ASM"
.MODEL SMALL
.STACK 100h
.DATA
texto   DB 'ROMA'
TAM     EQU 4
saida   DB TAM DUP(?), 13, 10, '$'
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, texto
        MOV  CX, TAM
empilha:
        MOV  AL, [SI]       ; PUSH só aceita words:
        PUSH AX             ; empilhamos AX inteiro (o caractere está em AL)
        INC  SI
        LOOP empilha

        LEA  DI, saida
        MOV  CX, TAM
desempilha:
        POP  AX
        MOV  [DI], AL
        INC  DI
        LOOP desempilha

        MOV  AH, 09h
        LEA  DX, saida
        INT  21h            ; AMOR
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```quiz
? SP = 0100h. Depois de PUSH AX, quanto vale SP?
- 0102h
+ 00FEh
- 0101h
> PUSH primeiro subtrai 2 de SP e depois grava: 0100h − 2 = 00FEh.

? Qual destas instruções existe no 8086?
- PUSH 10
- PUSH AL
+ PUSH DS
> PUSH aceita registradores de 16 bits, de segmento e memória. Imediato só no 80186; registradores de 8 bits nunca.

? PUSH AX, PUSH BX, POP AX, POP BX. O que aconteceu?
+ AX e BX foram trocados.
- Nada mudou.
- AX e BX ficaram iguais.
> O último empilhado (BX) sai primeiro e vai para AX; depois o valor de AX vai para BX.

? Depois de POP, o valor desempilhado é apagado da memória?
- Sim, vira zero.
+ Não, só SP muda; o valor fica até ser sobrescrito.
> POP só lê e ajusta SP.

? Como copiar DS para ES sem usar outro registrador?
- MOV ES, DS
+ PUSH DS e POP ES
- XCHG ES, DS
> Não há MOV nem XCHG entre registradores de segmento, mas a pilha faz a cópia.
```

## Exercícios

```exercicio
id: a08-1
titulo: Inverta três registradores
nivel: 1
exigir: PUSH
proibir: XCHG, MOV
--- enunciado
Usando **só PUSH e POP**, faça AX receber o valor de CX, e CX receber o de AX (BX fica igual). A pilha precisa terminar equilibrada.
--- inicial
; inverta AX e CX usando a pilha
--- testes
[
 { "nome": "1,2,3 -> 3,2,1", "setup": { "AX": 1, "BX": 2, "CX": 3 }, "espera": { "AX": 3, "BX": 2, "CX": 1, "pilhaEquilibrada": true } },
 { "nome": "outros valores", "setup": { "AX": 4660, "BX": 22136, "CX": 39612 }, "espera": { "AX": 39612, "BX": 22136, "CX": 4660, "pilhaEquilibrada": true } }
]
--- dicas
Empilhe AX, BX e CX. Desempilhe primeiro para AX.
--- solucao
        PUSH AX
        PUSH BX
        PUSH CX
        POP  AX
        POP  BX
        POP  CX
```

```exercicio
id: a08-2
titulo: Preserve os registradores
nivel: 2
--- enunciado
O trecho entre os comentários usa **BX**, **CX** e **SI** como rascunho para somar o vetor. Envolva esse trecho com PUSH e POP de forma que **BX, CX e SI terminem com os valores que tinham no início**. AX deve ficar com a soma (60).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
v       DW 10, 20, 30
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, 1111h
        MOV  CX, 2222h
        MOV  SI, 3333h

        ; --- trecho que estraga BX, CX e SI ---
        XOR  AX, AX
        LEA  SI, v
        MOV  CX, 3
soma:   MOV  BX, [SI]
        ADD  AX, BX
        ADD  SI, 2
        LOOP soma
        ; --- fim do trecho ---

        MOV  DX, AX         ; guarda a soma
        MOV  AH, 4Ch
        INT  21h
END inicio
--- testes
[{ "nome": "soma em DX e registradores preservados", "espera": { "DX": 60, "BX": 4369, "CX": 8738, "SI": 13107, "pilhaEquilibrada": true } }]
--- dicas
Três PUSH antes do trecho, três POP depois, na ordem inversa.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v       DW 10, 20, 30
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, 1111h
        MOV  CX, 2222h
        MOV  SI, 3333h

        PUSH BX
        PUSH CX
        PUSH SI
        XOR  AX, AX
        LEA  SI, v
        MOV  CX, 3
soma:   MOV  BX, [SI]
        ADD  AX, BX
        ADD  SI, 2
        LOOP soma
        POP  SI
        POP  CX
        POP  BX

        MOV  DX, AX
        MOV  AH, 4Ch
        INT  21h
END inicio
```

```exercicio
id: a08-3
titulo: ES aponta para os dados
nivel: 1
proibir: MOV
--- enunciado
Faça **ES** ficar igual a **DS** sem usar `MOV`.
--- inicial
; ES = DS
--- testes
[{ "nome": "ES = DS", "setup": { "DS": 4660, "ES": 0 }, "espera": { "ES": 4660, "pilhaEquilibrada": true } }]
--- solucao
        PUSH DS
        POP  ES
```

```exercicio
id: a08-4
titulo: Palíndromo
nivel: 3
--- enunciado
Verifique se a string `pal` (de tamanho `TAM`) é um palíndromo (igual de trás para frente), usando a pilha: empilhe todos os caracteres e depois compare cada um desempilhado com a string do início ao fim. Coloque **AX = 1** se for palíndromo e **AX = 0** se não for. A pilha precisa terminar equilibrada **mesmo quando a comparação falha no meio**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
pal     DB 'ARARA'
TAM     EQU 5
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui: AX = 1 ou 0

        MOV  BX, AX
        MOV  AH, 4Ch
        INT  21h
END inicio
--- testes
[{ "nome": "ARARA é palíndromo", "espera": { "BX": 1, "pilhaEquilibrada": true } }]
--- dicas
No segundo laço, conte em DX quantos caracteres bateram. Desempilhe sempre todos (sem sair no meio).
No fim, AX = 1 se DX = TAM.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
pal     DB 'ARARA'
TAM     EQU 5
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, pal
        MOV  CX, TAM
emp:    MOV  AL, [SI]
        PUSH AX
        INC  SI
        LOOP emp

        LEA  SI, pal
        MOV  CX, TAM
        XOR  DX, DX
compara:
        POP  AX
        CMP  AL, [SI]
        JNE  difere
        INC  DX
difere: INC  SI
        LOOP compara

        XOR  AX, AX
        CMP  DX, TAM
        JNE  fim
        MOV  AX, 1
fim:
        MOV  BX, AX
        MOV  AH, 4Ch
        INT  21h
END inicio
```

:::resumo
- A pilha fica em SS, cresce para baixo e SP aponta para o topo.
- `PUSH`: SP −= 2 e grava. `POP`: lê e SP += 2. Só words; sem imediato no 8086.
- Restaure na ordem inversa e mantenha a pilha equilibrada.
- `PUSH DS` / `POP ES` copia segmentos; `PUSHF` / `POPF` salvam as flags.
:::
