---
id: aula06
numero: 6
modulo: 3
titulo: Modos de endereçamento
subtitulo: Todas as formas de dizer ao 8086 onde está um dado
duracao: 60 min
objetivos: conhecer os modos imediato, registrador, direto, indireto, baseado, indexado e baseado-indexado; saber quais combinações de registradores são válidas no 8086; entender offset, OFFSET e LEA; saber qual segmento é usado por padrão
---

## Endereço efetivo

Quando uma instrução acessa a memória, ela precisa de um endereço. No 8086 esse endereço tem duas partes: o **segmento** (normalmente DS) e o **offset**, a posição dentro do segmento. Nesta aula vamos nos concentrar no offset. O offset calculado por uma instrução se chama **endereço efetivo** (EA, *effective address*).

O 8086 calcula o EA somando até três partes, todas opcionais:

```diagrama titulo="A fórmula do endereço efetivo"
        ┌────────┐     ┌────────┐     ┌───────────────┐
  EA =  │  BASE  │  +  │ ÍNDICE │  +  │ DESLOCAMENTO  │
        │ BX  BP │     │ SI  DI │     │ número fixo   │
        └────────┘     └────────┘     │ (8 ou 16 bits)│
                                      └───────────────┘
```

Toda forma de acessar a memória no 8086 é uma combinação dessas três partes. Cada combinação tem um nome:

| Modo | Forma | Exemplo | EA |
|------|-------|---------|----|
| Direto | [desloc] | `MOV AX, total` ou `MOV AX, [0200h]` | o próprio deslocamento |
| Indireto por registrador | [BX], [SI], [DI], [BP] | `MOV AL, [SI]` | valor do registrador |
| Baseado | [BX+desloc], [BP+desloc] | `MOV AX, [BP+4]` | base + desloc |
| Indexado | [SI+desloc], [DI+desloc] | `MOV AL, tabela[SI]` | índice + desloc |
| Baseado-indexado | [BX+SI], [BP+DI]... | `MOV AL, [BX+SI]` | base + índice |
| Baseado-indexado com deslocamento | [BX+SI+desloc] | `MOV AX, tabela[BX+DI+2]` | base + índice + desloc |

E existem os dois modos que **não** acessam memória: **imediato** (`MOV AX, 5`) e **registrador** (`MOV AX, BX`).

## As combinações válidas

Esta é a regra que mais pega iniciantes: no 8086, **só BX, BP, SI e DI** podem aparecer entre colchetes, e no máximo **um de cada grupo**:

- no máximo uma **base**: BX ou BP;
- no máximo um **índice**: SI ou DI.

| Válido | Inválido | Por quê |
|--------|----------|---------|
| `[BX]` | `[AX]` | AX não pode endereçar memória |
| `[BX+SI]` | `[SI+DI]` | dois índices |
| `[BP+DI+6]` | `[BX+BP]` | duas bases |
| `[SI-2]` | `[CX+4]` | CX não pode endereçar memória |
| `[BX+SI+100h]` | `[SI*2]` | escala só existe a partir do 80386 |

Ao todo são **8 combinações de registradores** (cada uma com ou sem deslocamento) e mais o endereço direto. Elas cabem exatamente nos 3 bits do campo *r/m* do byte ModR/M:

```diagrama titulo="Campo r/m da codificação 8086"
  r/m   000      001      010      011      100   101   110          111
  EA    BX+SI    BX+DI    BP+SI    BP+DI    SI    DI    BP (*)       BX
  (*) sem deslocamento, 110 significa endereço direto [desloc16]
```

:::anos90 Por que AX não pode?
Transistores custavam caro em 1978. A Intel escolheu quatro registradores para endereçar e codificou as combinações em 3 bits. Programadores dos anos 80 aprendiam a manter ponteiros em BX, SI e DI e contas em AX, CX e DX. O 80386 finalmente permitiu qualquer registrador de 32 bits entre colchetes, como `[EAX+ECX*4]`.
:::

## Segmento padrão

O endereço efetivo é um offset; falta o segmento. A CPU escolhe sozinha:

- se a forma usa **BP**, o segmento padrão é **SS** (a pilha);
- em todos os outros casos, é **DS** (os dados).

Você pode trocar o segmento com um **prefixo de segmento**: `MOV AX, ES:[BX]` lê de ES em vez de DS. O prefixo custa 1 byte e 2 ciclos.

O motivo de BP usar SS é que ele foi projetado para acessar **parâmetros na pilha** (Aula 10). Lembre-se disso: `MOV AX,[BP]` lê da pilha, não dos dados!

## OFFSET e LEA

Um nome de variável como `tabela` representa o **conteúdo** da memória naquele endereço. Para obter o **endereço** (o offset), há dois caminhos:

```asm fragmento
        MOV  BX, OFFSET tabela   ; o montador calcula o offset: imediato
        LEA  BX, tabela          ; a CPU calcula o endereço efetivo
```

Para uma variável simples os dois dão o mesmo resultado. A diferença aparece quando há registradores no meio: `LEA SI, [BX+4]` calcula BX + 4 em tempo de execução, coisa que `OFFSET` não faz (o montador não sabe quanto BX vai valer).

:::dica LEA como calculadora
`LEA` não acessa memória: ela só faz a soma do endereço efetivo e guarda o resultado. Por isso dá para usá-la para contas: `LEA AX, [BX+SI+10]` calcula AX = BX + SI + 10 em uma instrução, sem mexer nas flags.
:::

## Vendo tudo funcionar

O programa abaixo acessa a mesma tabela de vários jeitos. Execute passo a passo e acompanhe AX e os registradores de endereço:

```asm executar titulo="ENDERECOS.ASM"
.MODEL SMALL
.STACK 100h
.DATA
tabela  DW 1000, 2000, 3000, 4000, 5000
letras  DB 'ABCDEFGH'
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, tabela        ; direto: 1º elemento (1000)
        MOV  AX, tabela+2      ; direto com deslocamento: 2º elemento (2000)

        LEA  BX, tabela        ; BX = endereço da tabela
        MOV  AX, [BX]          ; indireto: 1000
        MOV  AX, [BX+4]        ; baseado: 3º elemento (3000)

        MOV  SI, 6             ; 4º elemento está 6 bytes à frente
        MOV  AX, tabela[SI]    ; indexado: 4000
        MOV  AX, [BX+SI+2]     ; baseado-indexado: 5000

        MOV  DI, 3
        MOV  AL, letras[DI]    ; byte: 'D'

        MOV  AX, 4C00h
        INT  21h
END inicio
```

Repare que cada elemento de `tabela` ocupa **2 bytes** (DW). O terceiro elemento está no deslocamento **4**, não 2. Em Assembly não existe "índice de vetor": você calcula o deslocamento em bytes.

```diagrama titulo="A tabela na memória"
  offset:   +0    +1    +2    +3    +4    +5    +6    +7    +8    +9
          ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
  bytes:  │ E8h │ 03h │ D0h │ 07h │ B8h │ 0Bh │ A0h │ 0Fh │ 88h │ 13h │
          └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
  words:  └─1000─┘    └─2000─┘    └─3000─┘    └─4000─┘    └─5000─┘
```

## Custo de cada modo

Calcular o endereço efetivo custa ciclos, e o custo depende do modo:

| Modo | Ciclos extras (EA) |
|------|---------------------|
| `[desloc]` | 6 |
| `[BX]`, `[SI]`, `[DI]`, `[BP]` | 5 |
| `[BX+desloc]`, `[SI+desloc]`... | 9 |
| `[BX+SI]`, `[BP+DI]` | 7 |
| `[BX+DI]`, `[BP+SI]` | 8 |
| `[BX+SI+desloc]`, `[BP+DI+desloc]` | 11 |
| `[BX+DI+desloc]`, `[BP+SI+desloc]` | 12 |

`MOV AX,[BX]` leva 8 + 5 = 13 ciclos; `MOV AX,[BX+SI+2]` leva 8 + 11 = 19. Em um laço que roda milhares de vezes, essa diferença conta. O Módulo 7 volta nisso.

```quiz
? Qual endereçamento é válido no 8086?
- [AX+SI]
- [SI+DI]
+ [BP+SI+4]
- [BX+BP]
> Uma base (BP) e um índice (SI) mais deslocamento. Os outros usam registradores proibidos ou combinações repetidas.

? Qual o segmento padrão de MOV AX,[BP+2]?
- DS
+ SS
- ES
> Formas que usam BP acessam a pilha (SS) por padrão.

? Em "lista DW 10,20,30,40", em que offset relativo está o valor 30?
- 2
+ 4
- 3
> Cada word ocupa 2 bytes: 10 em +0, 20 em +2, 30 em +4.

? Qual a diferença entre MOV AX,dados e LEA AX,dados?
+ MOV lê o conteúdo da variável; LEA carrega o endereço dela.
- Nenhuma.
- LEA lê dois bytes, MOV lê um.
> LEA calcula o endereço efetivo sem acessar a memória.

? Qual instrução calcula AX = BX + DI + 3 sem alterar as flags?
- ADD AX, BX+DI+3
+ LEA AX, [BX+DI+3]
- MOV AX, [BX+DI+3]
> LEA faz a soma do endereço efetivo. MOV leria a memória nesse endereço.
```

## Exercícios

```exercicio
id: a06-1
titulo: O terceiro elemento
nivel: 1
--- enunciado
Coloque em **AX** o **terceiro** elemento do vetor `numeros` usando **BX** apontando para o início do vetor e um deslocamento.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
numeros DW 11, 22, 33, 44, 55
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  BX, numeros
        MOV  AX, [BX]        ; isto é o primeiro elemento

        MOV  AH, 4Ch
        INT  21h
END inicio
--- testes
[{ "nome": "AX = 33 ao chegar no fim", "espera": { "AL": 33 } }]
--- dicas
O terceiro elemento está 4 bytes depois do primeiro.
Cuidado: MOV AH,4Ch muda AH, por isso o teste confere só AL.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
numeros DW 11, 22, 33, 44, 55
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  BX, numeros
        MOV  AX, [BX+4]

        MOV  AH, 4Ch
        INT  21h
END inicio
```

```exercicio
id: a06-2
titulo: Soma sem laço
nivel: 2
--- enunciado
Some os 4 elementos do vetor `v` (words) e grave o resultado na variável `soma`. Use **SI** como ponteiro, sem laço (escreva as 4 somas).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
v     DW 100, 250, 75, 1000
soma  DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "soma = 1425", "espera": { "mem": { "soma": 1425 } } }]
--- dicas
LEA SI,v e depois ADD AX,[SI], ADD AX,[SI+2]...
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v     DW 100, 250, 75, 1000
soma  DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, v
        MOV  AX, [SI]
        ADD  AX, [SI+2]
        ADD  AX, [SI+4]
        ADD  AX, [SI+6]
        MOV  soma, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a06-3
titulo: Matriz 3x3
nivel: 3
--- enunciado
A matriz `m` tem 3 linhas e 3 colunas de **bytes**, guardada linha por linha. Coloque em **DL** o elemento da **linha 2, coluna 1** (contando a partir de 0) usando o modo **baseado-indexado**: BX aponta para o início da linha e SI é a coluna.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
m   DB 1, 2, 3
    DB 4, 5, 6
    DB 7, 8, 9
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; DL = m[2][1]

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "DL = 8", "espera": { "DL": 8 } }]
--- dicas
A linha 2 começa 2 × 3 = 6 bytes depois de m.
LEA BX,m / ADD BX,6 / MOV SI,1 / MOV DL,[BX+SI]
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
m   DB 1, 2, 3
    DB 4, 5, 6
    DB 7, 8, 9
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  BX, m
        ADD  BX, 6          ; início da linha 2
        MOV  SI, 1          ; coluna 1
        MOV  DL, [BX+SI]

        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a06-4
titulo: LEA como calculadora
nivel: 2
proibir: ADD, SUB, INC
--- enunciado
Calcule **AX = BX + SI + 100** usando **uma única** instrução, sem ADD, SUB nem INC.
--- inicial
; AX = BX + SI + 100
--- testes
[
 { "nome": "BX=1, SI=2", "setup": { "BX": 1, "SI": 2 }, "espera": { "AX": 103 } },
 { "nome": "BX=1000, SI=234", "setup": { "BX": 1000, "SI": 234 }, "espera": { "AX": 1334 } }
]
--- dicas
LEA calcula endereços efetivos.
--- solucao
        LEA  AX, [BX+SI+100]
```

:::resumo
- EA = base (BX ou BP) + índice (SI ou DI) + deslocamento; cada parte é opcional.
- Só BX, BP, SI e DI vão entre colchetes, no máximo uma base e um índice.
- Com BP o segmento padrão é SS; nos demais, DS. Prefixos (`ES:`) trocam o segmento.
- `OFFSET var` é calculado pelo montador; `LEA` calcula na hora e serve até para somas.
- Vetores de words: o elemento i está no deslocamento 2 × i.
:::
