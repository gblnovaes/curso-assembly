---
id: aula07
numero: 7
modulo: 3
titulo: Vetores, LOOP, BYTE PTR e WORD PTR
subtitulo: Percorrendo a memória com laços
duracao: 65 min
objetivos: declarar vetores com DUP e strings com DB; percorrer vetores de bytes e de words com ponteiros; usar LOOP e entender a armadilha de CX = 0; usar BYTE PTR e WORD PTR quando o tamanho é ambíguo; ver o little-endian na prática
---

## Declarando vetores

Um vetor em Assembly é só uma sequência de valores na memória com um nome no começo. Algumas formas de declarar:

```asm fragmento
.DATA
primos   DB 2, 3, 5, 7, 11, 13        ; 6 bytes
pontos   DW 100, 2500, 40000          ; 3 words (6 bytes)
zeros    DB 50 DUP(0)                 ; 50 bytes valendo 0
buffer   DW 20 DUP(?)                 ; 20 words sem valor definido
padrao   DB 3 DUP(1, 2)               ; 1,2,1,2,1,2
nome     DB 'TURBO', 0                ; string terminada em zero (estilo C)
msg      DB 'Pronto!', 13, 10, '$'    ; string para INT 21h/09h
```

- `n DUP(valor)` repete o valor n vezes. Pode ter vários valores dentro e até um DUP dentro de outro.
- Strings entre aspas viram um byte por caractere.
- O terminador depende de quem vai ler: o DOS (função 09h) usa `$`; rotinas no estilo C usam o byte 0.

Para saber o tamanho, use os operadores do montador: `LENGTH primos` dá 6 (elementos) e `SIZE pontos` dá 6 (bytes). Outra técnica clássica usa `$`, que significa "o endereço atual":

```asm fragmento
msg      DB 'Ola!'
TAM_MSG  EQU $ - msg                  ; = 4: endereço atual menos o início
```

`EQU` cria uma **constante** com nome. Ela não ocupa memória: o montador substitui o nome pelo valor.

## Percorrendo um vetor de bytes

O padrão para percorrer um vetor tem quatro partes: um **ponteiro** para o elemento atual, um **contador** de quantos faltam, o **trabalho** com o elemento, e o **avanço** do ponteiro.

```asm executar titulo="SOMABYTE.ASM: soma de um vetor de bytes"
.MODEL SMALL
.STACK 100h
.DATA
notas   DB 7, 9, 5, 10, 8, 6
N       EQU 6
total   DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, notas      ; ponteiro
        MOV  CX, N          ; contador
        XOR  AX, AX         ; acumulador = 0
proximo:
        ADD  AL, [SI]       ; trabalho: soma o byte atual em AL
        ADC  AH, 0          ; e o vai-um em AH (a soma pode passar de 255)
        INC  SI             ; avanço: 1 byte
        DEC  CX
        JNZ  proximo

        MOV  total, AX      ; 45

        MOV  AX, 4C00h
        INT  21h
END inicio
```

Repare no truque do `ADC AH,0`: somamos bytes em AL, mas o total pode passar de 255. O vai-um de cada soma entra em AH. Assim AX acumula uma soma de 16 bits a partir de bytes.

## LOOP

A dupla `DEC CX` + `JNZ` é tão comum que o 8086 tem uma instrução para ela:

```asm fragmento
        LOOP rotulo     ; CX = CX - 1; se CX != 0, salta para rotulo
```

`LOOP` sempre usa **CX** (não dá para escolher outro registrador), é um salto curto (−128 a +127 bytes) e **não altera nenhuma flag**, nem mesmo ZF. O laço acima ficaria:

```asm fragmento
proximo:
        ADD  AL, [SI]
        ADC  AH, 0
        INC  SI
        LOOP proximo
```

:::atencao A armadilha do CX = 0
`LOOP` **primeiro decrementa** e **depois** testa. Se CX entrar no laço valendo 0, o decremento produz FFFFh, que não é zero, e o laço roda **65.536 vezes**! Se o tamanho puder ser zero, proteja o laço com `JCXZ`, que salta se CX = 0:

```asm fragmento
        JCXZ fim_laco       ; vetor vazio: não entra
proximo:
        ...
        LOOP proximo
fim_laco:
```

O simulador avisa quando um LOOP começa com CX = 0.
:::

Existem ainda `LOOPE`/`LOOPZ` (continua enquanto CX ≠ 0 **e** ZF = 1) e `LOOPNE`/`LOOPNZ` (enquanto CX ≠ 0 **e** ZF = 0), úteis para buscas.

## Vetores de words

Com words, o ponteiro avança **2** a cada elemento:

```asm executar titulo="MAIOR.ASM: maior elemento de um vetor de words"
.MODEL SMALL
.STACK 100h
.DATA
dados   DW 120, 4500, 87, 30000, 999
N       EQU 5
maior   DW ?
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, dados
        MOV  AX, [SI]       ; o primeiro é o maior até agora
        MOV  CX, N-1        ; faltam N-1 elementos
volta:
        ADD  SI, 2          ; próximo elemento (2 bytes)
        CMP  [SI], AX
        JBE  nao_e_maior    ; sem sinal
        MOV  AX, [SI]
nao_e_maior:
        LOOP volta
        MOV  maior, AX      ; 30000

        MOV  AX, 4C00h
        INT  21h
END inicio
```

## BYTE PTR e WORD PTR

Quando a instrução tem um registrador, o tamanho é óbvio: `MOV [BX], AL` grava 1 byte. Mas em `MOV [BX], 5` não há registrador. São 1 ou 2 bytes? O montador não sabe e reclama: *tamanho ambíguo*. Você precisa dizer:

```asm fragmento
        MOV  BYTE PTR [BX], 5     ; grava 1 byte: 05
        MOV  WORD PTR [BX], 5     ; grava 2 bytes: 05 00
        INC  WORD PTR [SI]        ; incrementa uma word na memória
        ADD  BYTE PTR [DI+2], 10
```

O mesmo operador serve para **acessar uma variável com outro tamanho**:

```asm fragmento
valor   DW 1234h
...
        MOV  AL, BYTE PTR valor      ; AL = 34h (o byte baixo)
        MOV  AH, BYTE PTR valor+1    ; AH = 12h (o byte alto)
```

## Little-endian na prática

Lembra da Aula 0? As words ficam na memória com o byte baixo primeiro. Veja acontecer:

```asm executar titulo="Little-endian"
.MODEL SMALL
.STACK 100h
.DATA
w       DW 0ABCDh
b       DB 2 DUP(0)
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  AL, BYTE PTR w      ; AL = CDh (primeiro byte na memória)
        MOV  AH, BYTE PTR w+1    ; AH = ABh
        MOV  WORD PTR b, 1234h   ; grava 34h em b e 12h em b+1

        MOV  AX, 4C00h
        INT  21h
END inicio
```

Abra no laboratório e olhe o dump de memória: você verá `CD AB 34 12`.

## Strings como vetores de bytes

Uma string é um vetor de bytes com códigos de caracteres. Transformar letras minúsculas em maiúsculas é só subtrair 32 (20h) de cada byte entre 'a' e 'z':

```asm executar titulo="MAIUSC.ASM"
.MODEL SMALL
.STACK 100h
.DATA
texto   DB 'programando em assembly!$'
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, texto
proximo:
        MOV  AL, [SI]
        CMP  AL, '$'
        JE   imprime         ; fim da string
        CMP  AL, 'a'
        JB   seguinte        ; antes de 'a': não é minúscula
        CMP  AL, 'z'
        JA   seguinte        ; depois de 'z': também não
        SUB  BYTE PTR [SI], 20h
seguinte:
        INC  SI
        JMP  proximo
imprime:
        MOV  AH, 09h
        LEA  DX, texto
        INT  21h

        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::anos90 A tabela ASCII
Na tabela ASCII, 'A' é 41h e 'a' é 61h: a diferença é exatamente o bit 5 (20h). Programadores espertos trocavam o `SUB` por `AND BYTE PTR [SI], 0DFh`, que desliga o bit 5. A tabela completa do PC (CP437), com os caracteres de moldura e acentos, está na **Referência** (F6).
:::

```quiz
? Quantos bytes ocupa "tab DW 10 DUP(0)"?
- 10
+ 20
- 2
> 10 words de 2 bytes cada: 20 bytes.

? CX = 0 ao chegar em um laço com LOOP no final. Quantas vezes o laço roda?
- 0
- 1
+ 65.536
> LOOP decrementa antes de testar: 0 − 1 = FFFFh, e o laço continua até CX voltar a 0.

? Por que "MOV [BX], 7" é recusado?
+ O montador não sabe se é para gravar 1 ou 2 bytes.
- Não se pode gravar imediato na memória.
- BX não pode endereçar memória.
> Falta o tamanho: use BYTE PTR ou WORD PTR.

? Em "v DW 1234h", o que MOV AL, BYTE PTR v coloca em AL?
- 12h
+ 34h
- 1234h
> Little-endian: o primeiro byte da word é o menos significativo, 34h.

? LOOP altera ZF?
- Sim, ZF = 1 quando CX chega a zero.
+ Não, LOOP não altera nenhuma flag.
> Diferente de DEC CX, o LOOP não mexe nas flags.
```

## Exercícios

```exercicio
id: a07-1
titulo: Conte as ocorrências
nivel: 2
exigir: LOOP
--- enunciado
Conte quantas vezes o byte **5** aparece no vetor `v` e grave o resultado em `conta` (word). Use `LOOP`.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
v       DB 5, 1, 5, 7, 5, 0, 2, 5, 9, 5
N       EQU 10
conta   DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "conta = 5", "espera": { "mem": { "conta": 5 } } }]
--- dicas
SI aponta para v, CX = N, BX conta. Compare BYTE PTR [SI] com 5.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v       DB 5, 1, 5, 7, 5, 0, 2, 5, 9, 5
N       EQU 10
conta   DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, v
        MOV  CX, N
        XOR  BX, BX
volta:
        CMP  BYTE PTR [SI], 5
        JNE  nao
        INC  BX
nao:
        INC  SI
        LOOP volta
        MOV  conta, BX

        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a07-2
titulo: Preencha de 1 a 10
nivel: 2
--- enunciado
O vetor `tab` tem 10 words. Preencha-o com os valores **1, 2, 3, ..., 10**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
tab     DW 10 DUP(0)
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "tab = 1..10", "espera": { "mem": { "tab": [1,2,3,4,5,6,7,8,9,10] } } }]
--- dicas
Use AX como valor (começa em 1) e SI como ponteiro; avance SI de 2 em 2.
MOV [SI],AX grava uma word porque AX tem 16 bits.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
tab     DW 10 DUP(0)
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, tab
        MOV  AX, 1
        MOV  CX, 10
volta:
        MOV  [SI], AX
        INC  AX
        ADD  SI, 2
        LOOP volta

        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a07-3
titulo: Inverta a string
nivel: 3
--- enunciado
Inverta **no lugar** a string `palavra` (sem o `$`): "ASSEMBLY" deve virar "YLBMESSA". Use dois ponteiros, um no começo e outro no fim, trocando os bytes até eles se cruzarem.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
palavra DB 'ASSEMBLY$'
TAM     EQU 8
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AH, 09h
        LEA  DX, palavra
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "imprime YLBMESSA", "espera": { "saida": "YLBMESSA", "mem": { "palavra": ["Y","L","B","M","E","S","S","A"] } } }]
--- dicas
SI = início, DI = início + TAM − 1.
Enquanto SI < DI: troque [SI] e [DI] passando por AL e AH, INC SI, DEC DI.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
palavra DB 'ASSEMBLY$'
TAM     EQU 8
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, palavra
        LEA  DI, palavra+TAM-1
troca:
        CMP  SI, DI
        JAE  pronto
        MOV  AL, [SI]
        MOV  AH, [DI]
        MOV  [SI], AH
        MOV  [DI], AL
        INC  SI
        DEC  DI
        JMP  troca
pronto:
        MOV  AH, 09h
        LEA  DX, palavra
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a07-4
titulo: Some só os pares
nivel: 3
--- enunciado
Some apenas os elementos **pares** do vetor de words `w` e grave em `soma`. Um número é par quando seu bit 0 é zero: `TEST AX,1` liga ZF se AX for par.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
w       DW 10, 3, 8, 7, 100, 21, 6
N       EQU 7
soma    DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "soma = 124", "espera": { "mem": { "soma": 124 } } }]
--- dicas
Carregue cada elemento em AX, teste com TEST AX,1 e pule a soma se der ímpar (JNZ).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
w       DW 10, 3, 8, 7, 100, 21, 6
N       EQU 7
soma    DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  SI, w
        MOV  CX, N
        XOR  BX, BX
volta:
        MOV  AX, [SI]
        TEST AX, 1
        JNZ  impar
        ADD  BX, AX
impar:
        ADD  SI, 2
        LOOP volta
        MOV  soma, BX

        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- `DB`/`DW` com listas, `DUP` para repetir, strings entre aspas; `EQU` para constantes; `$ - inicio` mede tamanho.
- Padrão de laço: ponteiro, contador, trabalho, avanço (1 para bytes, 2 para words).
- `LOOP` = `DEC CX` + `JNZ`, sem alterar flags; com CX = 0 roda 65.536 vezes; use `JCXZ`.
- `BYTE PTR`/`WORD PTR` resolvem tamanhos ambíguos e permitem ler partes de variáveis.
- Strings: compare com caracteres (`'a'`, `'$'`) e altere byte a byte.
:::
