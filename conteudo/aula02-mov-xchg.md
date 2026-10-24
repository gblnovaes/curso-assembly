---
id: aula02
numero: 2
modulo: 1
titulo: MOV e XCHG a fundo
subtitulo: Copiar e trocar valores entre registradores, memória e imediatos
duracao: 50 min
objetivos: conhecer todas as combinações válidas de MOV; entender por que algumas combinações não existem; declarar variáveis com DB e DW e usá-las com MOV; trocar valores com XCHG; ler o código de máquina gerado
---

## Os três tipos de operando

Toda instrução trabalha com **operandos**. No 8086 eles são de três tipos:

| Tipo | O que é | Exemplos |
|------|---------|----------|
| **Registrador** | um dos registradores da CPU | `AX`, `BL`, `SI`, `DS` |
| **Imediato** | um valor constante escrito na instrução | `10`, `0FFh`, `'A'`, `OFFSET msg` |
| **Memória** | um endereço na memória (uma variável) | `contador`, `[BX]`, `tabela[SI]` |

Com eles, `MOV` admite estas combinações:

| Destino ← Origem | Exemplo | Válido? |
|------------------|---------|---------|
| registrador ← registrador | `MOV AX, BX` | sim |
| registrador ← imediato | `MOV CX, 100` | sim |
| registrador ← memória | `MOV AX, total` | sim |
| memória ← registrador | `MOV total, AX` | sim |
| memória ← imediato | `MOV total, 0` | sim (com tamanho conhecido) |
| memória ← memória | `MOV total, parcial` | **não** |
| segmento ← registrador | `MOV DS, AX` | sim |
| segmento ← imediato | `MOV DS, 1234h` | **não** |
| segmento ← segmento | `MOV ES, DS` | **não** |
| CS ← qualquer coisa | `MOV CS, AX` | **não** |
| imediato ← qualquer coisa | `MOV 5, AX` | **não**, obviamente |

### Por que não existe memória para memória?

Porque a instrução do 8086 só tem espaço para descrever **um** operando de memória. A codificação usa um byte chamado **ModR/M**, que indica um registrador e um "registrador ou memória". Duas memórias não cabem. A solução é passar por um registrador:

```asm fragmento
        MOV  AX, parcial     ; memória -> registrador
        MOV  total, AX       ; registrador -> memória
```

### Por que não existe imediato para segmento?

Mesma história: a Intel não criou um código de operação para isso, porque mudar segmentos é raro. Por isso todo programa .EXE começa assim:

```asm fragmento
        MOV  AX, @DATA       ; imediato -> registrador geral
        MOV  DS, AX          ; registrador geral -> segmento
```

:::anos90 Erro clássico
"*Improper operand type*" era a mensagem do MASM para `MOV DS,@DATA`. Todo iniciante já viu essa linha. Aqui o montador explica o motivo e sugere a correção.
:::

## Variáveis: DB e DW

Para ter algo na memória, declaramos variáveis no segmento de dados:

```asm fragmento
.DATA
idade     DB 25          ; 1 byte com valor 25
ano       DW 1981        ; 1 word (2 bytes) com valor 1981
letra     DB 'X'         ; 1 byte com o código de 'X'
vazio     DW ?           ; 1 word sem valor inicial definido
```

- **DB** (*define byte*) reserva bytes; **DW** (*define word*) reserva words de 16 bits.
- O nome (`idade`, `ano`) vira um **rótulo**: o montador lembra em que endereço (offset) a variável começa e qual o seu tipo.
- `?` reserva o espaço sem definir valor. No simulador ele começa zerado, mas não conte com isso em um PC real.

Quando você escreve `MOV AX, ano`, o montador gera uma instrução que **lê a memória** no endereço de `ano`. O nome da variável já carrega o tamanho: `ano` é word, então a instrução lê 2 bytes.

```asm executar titulo="Variáveis com MOV"
.MODEL SMALL
.STACK 100h
.DATA
ano      DW 1981
idade    DB 25
copia    DW ?
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, ano        ; AX = 1981 (lido da memória)
        MOV  copia, AX      ; grava 1981 em "copia"
        MOV  BL, idade      ; BL = 25
        MOV  idade, 26      ; o tamanho vem da variável: grava 1 byte
        MOV  ano, 1990      ; grava 1 word

        MOV  AX, 4C00h
        INT  21h
END inicio
```

Execute e acompanhe as variáveis no painel ao lado do código. No laboratório, a aba **Variáveis** e o **dump de memória** mostram os bytes mudando.

:::atencao Tamanhos precisam combinar
`MOV AL, ano` é recusado: `ano` é word e AL é byte. Se for intencional (ler só o byte baixo), avise o montador: `MOV AL, BYTE PTR ano`. Veremos `BYTE PTR` e `WORD PTR` em detalhes no Módulo 3.
:::

## XCHG: trocar sem variável auxiliar

`XCHG` troca o conteúdo de dois operandos:

```asm executar titulo="Trocando AX e BX"
        MOV  AX, 1111h
        MOV  BX, 2222h
        XCHG AX, BX       ; agora AX = 2222h e BX = 1111h
        XCHG AL, AH       ; troca as metades: AX = 2222h (iguais!)
        MOV  CX, 0ABCDh
        XCHG CH, CL       ; CX = CDABh
```

As regras de `XCHG` são parecidas com as de `MOV`: não pode memória com memória, não pode imediato e não funciona com registradores de segmento.

Sem `XCHG`, trocar dois valores exige um terceiro lugar:

```asm fragmento
        MOV  CX, AX       ; guarda AX
        MOV  AX, BX       ; AX recebe BX
        MOV  BX, CX       ; BX recebe o AX antigo
```

:::cpu O NOP é um XCHG
`XCHG AX, reg` tem um código especial de **1 byte**: `90h + número do registrador`. `XCHG AX,BX` é `93h`. E `XCHG AX,AX`, que não faz nada, é `90h`: exatamente o código da instrução `NOP`. A Intel economizou um código de operação.
:::

## Código de máquina: o que o montador gera

Cada instrução vira de 1 a 6 bytes. Alguns exemplos reais do 8086 (veja na aba **Listagem** do laboratório):

| Instrução | Bytes | Tamanho | Ciclos |
|-----------|-------|---------|--------|
| `MOV AX, BX` | `8B C3` | 2 | 2 |
| `MOV AX, 1234h` | `B8 34 12` | 3 | 4 |
| `MOV AL, 5` | `B0 05` | 2 | 4 |
| `MOV AX, ano` | `A1 xx xx` | 3 | 10 |
| `MOV ano, 1990` | `C7 06 xx xx C6 07` | 6 | 16 |
| `XCHG AX, BX` | `93` | 1 | 3 |
| `XCHG CH, CL` | `86 E9` | 2 | 4 |

Repare: registrador com registrador é o mais rápido; memória é mais lenta e ocupa mais bytes. Guarde essa intuição para o Módulo 7.

```quiz
? Qual destas instruções é válida no 8086?
- MOV ES, DS
- MOV total, parcial
+ MOV total, AX
- MOV DS, 0B800h
> Memória ← registrador é permitido. As outras três combinações não existem no 8086.

? Depois de MOV AX,1234h e XCHG AH,AL, quanto vale AX?
- 1234h
+ 3412h
- 0000h
> XCHG AH,AL troca os dois bytes: 12h vai para AL e 34h para AH.

? Como colocar o valor 0B800h em ES?
- MOV ES, 0B800h
+ MOV AX, 0B800h e depois MOV ES, AX
- XCHG ES, 0B800h
> Não existe MOV de imediato para registrador de segmento. Passe por um registrador geral.

? A variável "ano" foi declarada com DW. Quantos bytes MOV AX,ano lê da memória?
- 1
+ 2
- 4
> DW define words de 16 bits: 2 bytes.

? O que "MOV" faz com a origem?
+ Nada: ela continua com o mesmo valor.
- Zera a origem.
- Troca com o destino.
> MOV copia. Quem troca é XCHG.
```

## Exercícios

```exercicio
id: a02-1
titulo: Troca sem XCHG
nivel: 1
proibir: XCHG
--- enunciado
**AX** e **BX** chegam com valores quaisquer. Troque os dois **sem usar XCHG**. Você pode usar **CX** como auxiliar.
--- inicial
; troque AX e BX sem XCHG
--- testes
[
 { "nome": "AX=1, BX=2", "setup": { "AX": 1, "BX": 2 }, "espera": { "AX": 2, "BX": 1 } },
 { "nome": "AX=ABCDh, BX=1234h", "setup": { "AX": 43981, "BX": 4660 }, "espera": { "AX": 4660, "BX": 43981 } }
]
--- dicas
Guarde AX em CX antes de sobrescrever AX.
--- solucao
        MOV  CX, AX
        MOV  AX, BX
        MOV  BX, CX
```

```exercicio
id: a02-2
titulo: Rotação de três registradores
nivel: 2
--- enunciado
Faça a "dança das cadeiras": o valor de **AX** vai para **BX**, o de **BX** vai para **CX** e o de **CX** vai para **AX**. Use quantas instruções precisar (dá para fazer com duas XCHG).
--- inicial
; AX -> BX, BX -> CX, CX -> AX
--- testes
[
 { "nome": "1, 2, 3", "setup": { "AX": 1, "BX": 2, "CX": 3 }, "espera": { "AX": 3, "BX": 1, "CX": 2 } },
 { "nome": "AAAAh, BBBBh, CCCCh", "setup": { "AX": 43690, "BX": 48059, "CX": 52428 }, "espera": { "AX": 52428, "BX": 43690, "CX": 48059 } }
]
--- dicas
Depois de XCHG AX,BX: AX tem o B antigo e BX tem o A antigo. Falta trocar quem?
--- solucao
        XCHG AX, BX     ; AX = B, BX = A
        XCHG AX, CX     ; AX = C, CX = B
```

```exercicio
id: a02-3
titulo: Copiando entre variáveis
nivel: 2
--- enunciado
O programa tem três variáveis word: `origem`, `destino` e `backup`. Copie o valor de `destino` para `backup` e depois copie `origem` para `destino`. Lembre: não existe MOV de memória para memória.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
origem   DW 1234h
destino  DW 0BEEFh
backup   DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "destino = 1234h, backup = BEEFh", "espera": { "mem": { "destino": 4660, "backup": 48879, "origem": 4660 } } }]
--- dicas
MOV AX,destino / MOV backup,AX
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
origem   DW 1234h
destino  DW 0BEEFh
backup   DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, destino
        MOV  backup, AX
        MOV  AX, origem
        MOV  destino, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a02-4
titulo: Inverta os bytes de uma word
nivel: 2
--- enunciado
A variável `valor` (DW) contém **1234h**. Faça com que ela passe a conter **3412h**, invertendo seus bytes.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
valor    DW 1234h
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "valor = 3412h", "espera": { "mem": { "valor": 13330 } } }]
--- dicas
Carregue em um registrador geral, troque as metades com XCHG e grave de volta.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
valor    DW 1234h
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, valor
        XCHG AH, AL
        MOV  valor, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Operandos: registrador, imediato, memória.
- MOV não faz memória→memória, imediato→segmento, segmento→segmento nem escreve em CS.
- DB declara bytes, DW declara words; o nome da variável carrega o tipo.
- XCHG troca dois operandos; `XCHG AX,reg` ocupa 1 byte.
- Registrador é mais rápido e menor que memória.
:::
