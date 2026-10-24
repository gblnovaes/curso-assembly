---
id: aula46
numero: 46
modulo: 15
titulo: Estruturas: STRUC e campos
subtitulo: Registros com nome, como o struct do C e o record do Pascal
duracao: 75 min
objetivos: declarar uma estrutura com STRUC e entender que cada campo é só um deslocamento; criar variáveis e vetores de estruturas com valores padrão e valores próprios; acessar campos com var.campo, [BX].campo e [BX+ESTRUT.campo]; usar SIZE e TYPE para andar num vetor de estruturas; descrever com STRUC as estruturas do DOS, como o PSP e a DTA
---

## Dados que andam juntos

Na [aula 26](aula:aula26) você leu a linha de comando com `ES:[80h]` e listou arquivos olhando a DTA em `[dta+1Eh]`. Na [aula 10](aula:aula10), os parâmetros estavam em `[BP+4]` e `[BP+6]`. Esses números funcionam, mas não dizem nada a quem lê. E se o formato mudar (um campo novo no meio), todos os deslocamentos depois dele mudam também, espalhados pelo programa.

Muitos dados têm essa cara de **ficha**: um aluno tem nome, nota e faltas; um ponto tem X e Y; um inimigo de um jogo tem posição, velocidade e vida. Linguagens de alto nível chamam isso de `struct` (C) ou `record` (Pascal). No MASM, é a diretiva **STRUC**.

```asm fragmento
PONTO   STRUC
X       DW ?                    ; deslocamento 0
Y       DW ?                    ; deslocamento 2
COR     DB 15                   ; deslocamento 4 (valor padrão 15)
PONTO   ENDS                    ; tamanho total: 5 bytes
```

Uma declaração `STRUC` **não reserva memória**. Ela ensina ao montador um formato, como uma planta de casa. O montador anota três coisas:

- cada **campo** vira uma constante com o seu deslocamento a partir do começo: `X = 0`, `Y = 2`, `COR = 4`;
- cada campo tem um **tipo** (byte, word, dword) que vem do `DB`, `DW` ou `DD`;
- a estrutura tem um **tamanho**: `SIZE PONTO` (ou `TYPE PONTO`) vale 5.

```diagrama titulo="A planta PONTO e duas casas construídas com ela"
             deslocamento   0    1    2    3    4
                          ┌────┬────┬────┬────┬────┐
  PONTO (só a planta)     │    X    │    Y    │COR │   SIZE PONTO = 5
                          └────┴────┴────┴────┴────┘
  p1 PONTO <10,20,4>      │ 0A   00 │ 14   00 │ 04 │   p1.Y = endereço de p1 + 2
  p2 PONTO <>             │ 00   00 │ 00   00 │ 0F │   valores padrão (? vira 0)
```

## Criando variáveis

Uma variável do tipo estrutura usa o nome da estrutura no lugar do `DB`/`DW`, com os valores entre `<` e `>`:

| Declaração | O que gera |
|---|---|
| `p1 PONTO <10, 20, 4>` | X = 10, Y = 20, COR = 4 |
| `p2 PONTO <>` | todos os valores padrão da declaração |
| `p3 PONTO <, 50>` | X padrão, Y = 50, COR padrão (vírgula vazia = padrão) |
| `trilha PONTO 100 DUP(<>)` | um vetor de 100 pontos, 500 bytes |

Um campo de texto, como `NOME DB '        '`, pode receber um texto mais curto (`<'Ana'>`). No montador do curso, o que sobra é completado com espaços quando o valor padrão é um texto e com zeros nos outros casos. Um texto maior que o campo é um erro.

## Lendo e escrevendo campos

Um campo é só um número (o deslocamento), mas o montador entende várias formas de escrevê-lo:

| Forma | Significa | Exemplo |
|---|---|---|
| `var.campo` | endereço de `var` + deslocamento do campo | `MOV AX, p1.Y` |
| `[BX].campo` | `[BX + deslocamento]`: a estrutura apontada por BX | `MOV AL, [BX].COR` |
| `var[SI].campo` | elemento de um vetor, com SI = índice × tamanho | `MOV AX, trilha[SI].X` |
| `[BX + ESTRUT.campo]` | o mesmo que `[BX].campo`, escrito com o nome da estrutura | `MOV DX, [BX + PONTO.Y]` |
| `ESTRUT.campo` (sem colchetes) | só o número do deslocamento | `MOV AX, PONTO.Y` (AX = 2) |

O mais útil é que **o tipo do campo dá o tamanho do operando**. `MOV [BX].COR, 9` grava um byte sem você escrever `BYTE PTR`, porque `COR` foi declarado com `DB`. E `MOV AL, p1.X` é um erro de tamanho, como seria com uma variável `DW` comum.

:::cpu Campos não custam nada
`MOV AL, [BX].COR` vira `MOV AL, [BX+4]`, o mesmo código de máquina de sempre: `8A 47 04`. O campo é resolvido pelo montador e entra como o deslocamento do endereçamento. Um detalhe de otimização: deslocamentos de -128 a 127 ocupam 1 byte na instrução, e os maiores ocupam 2. Numa estrutura grande, coloque os campos mais usados no começo.
:::

O programa abaixo cria dois pontos, lê e altera campos e mostra o valor de `SIZE`:

```asm executar titulo="PONTOS.ASM: campos com nome"
.MODEL SMALL
.STACK 100h

PONTO   STRUC
X       DW ?
Y       DW ?
COR     DB 15
PONTO   ENDS

.DATA
p1      PONTO <10, 20, 4>
p2      PONTO <>
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, p1.X           ; AX = 10
        ADD  AX, p1.Y           ; AX = 30
        MOV  p2.X, AX           ; p2.X = 30

        MOV  BX, OFFSET p2      ; BX aponta para p2
        MOV  [BX].Y, 99         ; word, pelo tipo de Y
        MOV  [BX].COR, 2        ; byte, pelo tipo de COR
        MOV  CL, p1.COR         ; CL = 4
        MOV  DX, SIZE PONTO     ; DX = 5

        MOV  AH, 4Ch
        INT  21h
END inicio
```

Depois de executar, olhe a aba **Variáveis** do laboratório: `p1` e `p2` aparecem como blocos de 5 bytes, e `X`, `Y` e `COR` como as constantes 0, 2 e 4.

## Vetores de estruturas

Um vetor de estruturas é um bloco de fichas iguais, uma depois da outra. O elemento `i` começa em `i × SIZE ESTRUT`. Há duas formas de andar por ele:

1. **Ponteiro que avança**: BX aponta para o elemento atual, e `ADD BX, SIZE ESTRUT` pula para o próximo. É a forma mais simples e a mais rápida.
2. **Índice multiplicado**: para pegar o elemento `i` direto, calcule `i × SIZE`. Se o tamanho for uma potência de 2, a multiplicação vira deslocamentos (`SHL`), como na [aula 16](aula:aula16).

:::dica Arredonde o tamanho para uma potência de 2
Uma estrutura de 14 bytes obriga a usar `MUL` (118 a 133 ciclos no 8086) para achar um elemento. Com 2 bytes de folga no fim, ela tem 16 bytes, e quatro `SHL` resolvem (8 ciclos). Os programadores de jogos faziam isso o tempo todo: um campo `livre` no fim da estrutura é memória bem gasta.
:::

O programa a seguir guarda uma turma de cinco alunos, cada um numa ficha de 16 bytes, mostra a lista e depois o melhor aluno. O vetor é percorrido com BX apontando para a ficha atual.

```asm executar titulo="TURMA.ASM: um vetor de fichas"
.MODEL SMALL
.STACK 100h

ALUNO   STRUC
NOME    DB '            '       ; 12 caracteres
FIMNOME DB '$'
NOTA    DB 0
FALTAS  DB 0
LIVRE   DB 0                    ; folga: 16 bytes no total
ALUNO   ENDS

QTD     EQU 5

.DATA
turma   ALUNO <'Ana', , 9, 2>
        ALUNO <'Bruno', , 7, 0>
        ALUNO <'Carla', , 10, 1>
        ALUNO <'Daniel', , 6, 5>
        ALUNO <'Elisa', , 8, 0>
titulo  DB 'NOME         NOTA', 13, 10, '$'
melhor  DB 13, 10, 'Melhor nota: $'
nl      DB 13, 10, '$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET titulo
        MOV  AH, 09h
        INT  21h

        MOV  BX, OFFSET turma
        MOV  CX, QTD
        XOR  SI, SI             ; SI = ficha com a maior nota até agora
        XOR  DH, DH             ; DH = maior nota
lista:  PUSH DX
        LEA  DX, [BX].NOME      ; o nome termina no '$' de FIMNOME
        MOV  AH, 09h
        INT  21h
        MOV  DL, ' '
        MOV  AH, 02h
        INT  21h
        MOV  AL, [BX].NOTA
        CALL NUMERO
        MOV  DX, OFFSET nl
        MOV  AH, 09h
        INT  21h
        POP  DX
        MOV  AL, [BX].NOTA
        CMP  AL, DH
        JBE  proximo
        MOV  DH, AL
        MOV  SI, BX
proximo:
        ADD  BX, SIZE ALUNO     ; próxima ficha
        LOOP lista

        MOV  DX, OFFSET melhor
        MOV  AH, 09h
        INT  21h
        LEA  DX, [SI].NOME
        INT  21h
        MOV  AX, 4C00h
        INT  21h

; NUMERO: mostra AL (0 a 99) com dois dígitos
NUMERO  PROC
        AAM                     ; AH = dezenas, AL = unidades
        ADD  AX, 3030h
        PUSH AX
        MOV  DL, AH
        MOV  AH, 02h
        INT  21h
        POP  AX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        RET
NUMERO  ENDP
END inicio
```

Repare nas fichas: `<'Ana', , 9, 2>` deixa `FIMNOME` com o valor padrão (`'$'`), e o nome curto é completado com espaços. Por isso `LEA DX,[BX].NOME` e a função 09h mostram o nome com 12 caracteres, alinhando a coluna das notas.

## As estruturas do DOS com nome

As estruturas que o DOS e a BIOS usam ficam muito mais legíveis com `STRUC`. Este é o começo do PSP da [aula 26](aula:aula26), com os campos nos deslocamentos certos. Os campos sem nome (`DB n DUP(?)`) só ocupam espaço:

```asm executar titulo="PSPSTRUC.ASM: a linha de comando lida pelo nome do campo" parametros="ARQUIVO.TXT /V"
.MODEL SMALL
.STACK 100h

PSP     STRUC
INT20   DW ?                    ; 00h: CD 20
TOPO    DW ?                    ; 02h: fim da memória do programa
        DB 28h DUP(?)           ; 04h a 2Bh
AMBIENTE DW ?                   ; 2Ch: segmento do ambiente
        DB 52h DUP(?)           ; 2Eh a 7Fh
TAMCMD  DB ?                    ; 80h: tamanho da linha de comando
CMD     DB 127 DUP(?)           ; 81h: o texto
PSP     ENDS

.CODE
inicio: XOR  BX, BX             ; ES:BX = início do PSP
        MOV  CL, ES:[BX].TAMCMD
        XOR  CH, CH
        LEA  SI, [BX].CMD
        JCXZ fim
mostra: MOV  DL, ES:[SI]
        MOV  AH, 02h
        INT  21h
        INC  SI
        LOOP mostra
fim:    MOV  AX, ES:[BX].TOPO   ; AX = A000h (640 KB)
        MOV  AX, 4C00h
        INT  21h
END inicio
```

A DTA, que as funções 4Eh e 4Fh preenchem, fica assim:

```asm fragmento
DTA     STRUC
        DB 21 DUP(?)            ; 00h: reservado para o DOS continuar a busca
ATRIB   DB ?                    ; 15h: atributos do arquivo
HORA    DW ?                    ; 16h
DATAARQ DW ?                    ; 18h
TAMANHO DD ?                    ; 1Ah: tamanho em bytes (32 bits)
NOMEARQ DB 13 DUP(?)            ; 1Eh: nome ASCIIZ
DTA     ENDS

minhadta DTA <>
        ...
        MOV  AX, WORD PTR minhadta.TAMANHO     ; parte baixa do tamanho
        LEA  DX, minhadta.NOMEARQ               ; em vez de [dta+1Eh]
```

:::anos90 STRUC e a programação para Windows
Quando o Windows 3.0 virou febre em 1990, muita gente ainda programava em Assembly. O arquivo `WINDOWS.INC` declarava com `STRUC` as estruturas da API (`WNDCLASS`, `MSG`, `RECT`, `PAINTSTRUCT`), espelhando o `WINDOWS.H` do C. Quem lia um livro de programação Windows em C conseguia traduzir campo por campo. O mesmo valeu, anos depois, para os cabeçalhos do DirectX nos jogos em Assembly.
:::

## Estruturas e macros juntas

Macros e estruturas combinam bem: a macro esconde a sintaxe da instância e confere os argumentos.

```asm fragmento
NOVO_ALUNO MACRO nome, nota
        IFB  <nota>
        ALUNO <nome>            ; sem nota: valor padrão 0
        ELSE
        ALUNO <nome, , nota>
        ENDIF
ENDM

        NOVO_ALUNO 'Fabio', 7
        NOVO_ALUNO 'Gabi'
```

```quiz
? Quantos bytes a declaração `PONTO STRUC ... PONTO ENDS` reserva na memória?
+ Nenhum: ela só descreve o formato
- O tamanho da estrutura
- 2 bytes por campo
> Só as instâncias (p1 PONTO <...>) reservam memória.

? Em `ALUNO STRUC` com `NOME DB 12 DUP(?)` e `NOTA DB ?`, quanto vale `ALUNO.NOTA`?
- 1
+ 12
- 13
> Cada campo vale o seu deslocamento a partir do começo: NOTA vem depois dos 12 bytes do nome.

? Por que `MOV [BX].COR, 9` não precisa de BYTE PTR quando COR foi declarado com DB?
+ Porque o tipo do campo define o tamanho do operando
- Porque o 9 cabe em um byte
- Porque BX sempre aponta para bytes
> Sem o campo, MOV [BX],9 seria ambíguo. O campo diz que é um byte.

? Uma estrutura tem 12 bytes e você quer chegar ao elemento i de um vetor dela. Qual mudança deixa esse cálculo mais rápido no 8086?
- Usar DD em todos os campos
+ Aumentar a estrutura para 16 bytes, para multiplicar por SHL
- Trocar BX por SI
> Com tamanho potência de 2, i × 16 são quatro SHL, muito mais baratos que um MUL.

? O que significa a vírgula vazia em `p3 PONTO <, 50>`?
- Que X vale 0
+ Que X fica com o valor padrão da declaração
- É um erro de sintaxe
> Valores omitidos ou vazios usam o padrão do campo; ? vira 0.
```

## Exercícios

```exercicio
id: a46-1
titulo: Área do retângulo
nivel: 1
--- enunciado
Calcule a área do retângulo `r` (`LARG × ALT`) e guarde no campo `AREA` dele. Acesse os campos pelo nome (`r.LARG`...). O resultado cabe em 16 bits.
--- inicial
.MODEL SMALL
.STACK 100h

RETANGULO STRUC
LARG    DW ?
ALT     DW ?
AREA    DW 0
RETANGULO ENDS

.DATA
r       RETANGULO <5, 7>
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; calcule r.AREA aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "5 x 7", "espera": { "mem": { "r": [5, 7, 35] } } },
 { "nome": "120 x 300", "setup": { "r": [120, 300, 0] }, "espera": { "mem": { "r": [120, 300, 36000] } } },
 { "nome": "largura zero", "setup": { "r": [0, 999, 1] }, "espera": { "mem": { "r": [0, 999, 0] } } }]
--- dicas
MOV AX, r.LARG / MUL r.ALT deixa o produto em DX:AX.
Guarde AX com MOV r.AREA, AX.
--- solucao
.MODEL SMALL
.STACK 100h

RETANGULO STRUC
LARG    DW ?
ALT     DW ?
AREA    DW 0
RETANGULO ENDS

.DATA
r       RETANGULO <5, 7>
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, r.LARG
        MUL  r.ALT
        MOV  r.AREA, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a46-2
titulo: Total da compra
nivel: 2
--- enunciado
O vetor `itens` tem 5 fichas `ITEM` com `PRECO` e `QTD`. Calcule a soma de `PRECO × QTD` de todos os itens e guarde em `total`. O total cabe em 16 bits.

Ande pelo vetor com um registrador base e `SIZE ITEM`.
--- inicial
.MODEL SMALL
.STACK 100h

ITEM    STRUC
PRECO   DW ?
QTD     DW ?
ITEM    ENDS

.DATA
itens   ITEM <10, 2>, <3, 5>, <100, 1>, <7, 0>, <1, 9>
total   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "os itens do programa", "espera": { "mem": { "total": 144 } } },
 { "nome": "outros preços", "setup": { "itens": [1, 1, 2, 2, 3, 3, 4, 4, 5, 5] }, "espera": { "mem": { "total": 55 } } },
 { "nome": "tudo zero", "setup": { "itens": [0, 5, 0, 6, 0, 7, 0, 8, 0, 9] }, "espera": { "mem": { "total": 0 } } }]
--- dicas
BX = OFFSET itens, CX = 5 e um acumulador (SI, por exemplo) zerado.
No laço: MOV AX,[BX].PRECO / MUL [BX].QTD / ADD SI,AX / ADD BX,SIZE ITEM / LOOP.
Cuidado: MUL estraga DX, então não use DX como acumulador.
--- solucao
.MODEL SMALL
.STACK 100h

ITEM    STRUC
PRECO   DW ?
QTD     DW ?
ITEM    ENDS

.DATA
itens   ITEM <10, 2>, <3, 5>, <100, 1>, <7, 0>, <1, 9>
total   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, OFFSET itens
        MOV  CX, 5
        XOR  SI, SI
soma:   MOV  AX, [BX].PRECO
        MUL  [BX].QTD
        ADD  SI, AX
        ADD  BX, SIZE ITEM
        LOOP soma
        MOV  total, SI
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a46-3
titulo: Pontos acima da diagonal
nivel: 2
--- enunciado
O vetor `pts` tem 6 pontos (`X` e `Y`, **com sinal**). Conte quantos estão acima da diagonal, isto é, têm `Y > X`, e guarde a contagem em `conta`.
--- inicial
.MODEL SMALL
.STACK 100h

PONTO   STRUC
X       DW ?
Y       DW ?
PONTO   ENDS

.DATA
pts     PONTO <1, 5>, <5, 1>, <-3, -2>, <0, 0>, <-10, 4>, <7, 6>
conta   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "os pontos do programa", "espera": { "mem": { "conta": 3 } } },
 { "nome": "nenhum acima", "setup": { "pts": [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6] }, "espera": { "mem": { "conta": 0 } } },
 { "nome": "todos acima, com negativos", "setup": { "pts": [-5, -4, -100, 0, 0, 1, 30000, 30001, -32768, 32767, 9, 10] }, "espera": { "mem": { "conta": 6 } } }]
--- dicas
Com sinal, "maior" é JG (e "menor ou igual" é JLE).
Compare: MOV AX,[BX].Y / CMP AX,[BX].X / JLE nao_conta / INC conta.
Avance com ADD BX,SIZE PONTO, seis vezes.
--- solucao
.MODEL SMALL
.STACK 100h

PONTO   STRUC
X       DW ?
Y       DW ?
PONTO   ENDS

.DATA
pts     PONTO <1, 5>, <5, 1>, <-3, -2>, <0, 0>, <-10, 4>, <7, 6>
conta   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, OFFSET pts
        MOV  CX, 6
olha:   MOV  AX, [BX].Y
        CMP  AX, [BX].X
        JLE  proximo
        INC  conta
proximo:
        ADD  BX, SIZE PONTO
        LOOP olha
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## No livro

O [Capítulo 17](livro:cap17) descreve a área de dados da BIOS em 0040:0000, campo por campo: um ótimo exercício é escrever uma `STRUC` para ela. O [Capítulo 22](livro:cap22) mostra as estruturas internas do DOS (PSP, MCB, entrada de diretório), todas candidatas a uma `STRUC`.

:::resumo
- `nome STRUC ... nome ENDS` descreve um formato: cada campo vira uma constante com o seu **deslocamento** e tem o **tipo** do `DB`/`DW`/`DD`. A declaração não reserva memória.
- `var nome <v1, , v3>` cria uma instância; valores vazios ficam com o padrão. `n DUP(<>)` cria um vetor.
- Acesse com `var.campo`, `[BX].campo`, `var[SI].campo` ou `[BX+ESTRUT.campo]`. O tipo do campo define o tamanho do operando.
- `SIZE ESTRUT` é o tamanho da ficha: use `ADD BX, SIZE ESTRUT` para andar no vetor. Tamanhos potência de 2 deixam o índice barato.
- Campos não custam nada na execução: viram o deslocamento do endereçamento.
- As estruturas do DOS (PSP, DTA, MCB) ficam muito mais legíveis com `STRUC`.
:::
