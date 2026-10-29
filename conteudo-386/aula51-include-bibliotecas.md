---
id: aula51
numero: 51
modulo: 16
titulo: INCLUDE e bibliotecas
subtitulo: Arquivos de definições, guardas de inclusão e o .LIB
duracao: 60 min
objetivos: usar INCLUDE para compartilhar constantes, macros e estruturas entre módulos; proteger um .INC contra inclusão dupla; entender o que é uma biblioteca .LIB e por que o ligador só pega o que precisa; organizar uma biblioteca de rotinas própria
---

## INCLUDE: colar um arquivo na hora de montar

Na aula anterior, cada módulo era montado sozinho e só conhecia os nomes de fora pelo `EXTRN`. Mas há coisas que **todos** os módulos precisam conhecer igual: o código de cor do texto, o tamanho de um registro, a macro que encerra o programa. Copiar essas linhas em cada arquivo funciona até o dia em que alguém muda uma cópia e esquece as outras.

A diretiva `INCLUDE NOME.INC` resolve isso. No ponto em que ela aparece, o montador lê o arquivo NOME.INC e monta as linhas dele como se estivessem escritas ali. É o mesmo que o `#include` do C faz.

```diagrama titulo="INCLUDE é só texto"
  PRINC.ASM                         o que o montador vê
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ .MODEL SMALL            │       │ .MODEL SMALL            │
  │ INCLUDE CORES.INC  ─────┼──┐    │ BRANCO   EQU 0Fh        │
  │ .CODE                   │  └──► │ AMARELO  EQU 0Eh        │
  │ MOV BL, AMARELO         │       │ .CODE                   │
  └─────────────────────────┘       │ MOV BL, AMARELO         │
                                    └─────────────────────────┘
```

O que costuma ir para um .INC:

- **constantes** (`EQU`): portas, códigos de função, cores, tamanhos;
- **macros**: `SAIR`, `IMPRIME`, `EMPILHA_TUDO` ([aula 45](aula:aula45));
- **estruturas** (`STRUC`): o formato de um registro que vários módulos leem ([aula 46](aula:aula46));
- **declarações EXTRN** de um módulo de rotinas, para quem vai usá-lo.

E o que **não** vai: código e variáveis. Se um .INC com `contador DW 0` for incluído em dois módulos, cada um ganha a sua cópia da variável, e as duas nunca vão concordar.

:::cpu INCLUDE e EXTRN não são a mesma coisa
O `INCLUDE` copia **texto** antes de montar: tudo o que está no .INC passa a existir dentro do módulo. O `EXTRN` declara um nome que existe **em outro .OBJ**: o módulo não ganha nada, só uma promessa que o ligador vai cumprir. Uma constante pode vir dos dois jeitos (EQU num .INC ou EXTRN ABS), mas uma variável compartilhada precisa do segundo.
:::

## Um .INC como interface

O jeito organizado de oferecer um módulo de rotinas é acompanhá-lo de um .INC com tudo o que quem usa precisa saber: os EXTRN das rotinas e as constantes que elas usam. Quem quer as rotinas só escreve uma linha.

```asm executar titulo="TELA.ASM: um módulo e a sua interface"
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE TELA.INC
        .DATA
ola     DB 'Ola, modulos!', 0
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET ola
        MOV  BL, AMARELO
        CALL escreve        ; rotina do módulo TELA
        SAIR 0
        END  inicio
;### MODULO TELA.ASM
        .MODEL SMALL
        PUBLIC escreve
        .CODE
; escreve: mostra a string terminada em 0 em DS:SI, com o atributo BL
escreve PROC
        PUSH AX
        PUSH BX
        PUSH CX
proximo:
        LODSB
        OR   AL, AL
        JZ   fim
        MOV  AH, 09h        ; INT 10h, 09h: caractere com atributo
        MOV  BH, 0
        MOV  CX, 1
        INT  10h
        MOV  AH, 0Eh        ; avança o cursor escrevendo o mesmo caractere
        INT  10h
        JMP  proximo
fim:    POP  CX
        POP  BX
        POP  AX
        RET
escreve ENDP
        END
;### INCLUIR TELA.INC
; Interface do módulo TELA: inclua este arquivo para usar as rotinas.
        EXTRN escreve:NEAR
BRANCO  EQU 0Fh
AMARELO EQU 0Eh
SAIR    MACRO codigo
        MOV  AX, 4C00h + codigo
        INT  21h
        ENDM
```

O módulo TELA.ASM não inclui o TELA.INC: ele não precisa dos EXTRN de si mesmo. No MASM 6 havia uma diretiva para esse caso, `EXTERNDEF`, que vira PUBLIC no módulo que define o nome e EXTRN nos outros, e permitia um .INC só para todo mundo.

## Guardas de inclusão

Os .INC também incluem outros .INC. TELA.INC pode precisar de CORES.INC, e o programa principal pode incluir os dois. Aí as constantes de CORES.INC são definidas duas vezes, e o montador recusa: "Símbolo AMARELO definido mais de uma vez".

A solução é a mesma do C: o arquivo marca que já foi lido e, na segunda vez, pula o próprio conteúdo.

```asm fragmento titulo="CORES.INC com guarda"
IFNDEF CORES_INC        ; primeira vez: o nome ainda não existe
CORES_INC EQU 1
BRANCO    EQU 0Fh
AMARELO   EQU 0Eh
ENDIF                   ; da segunda vez em diante, nada é montado
```

Escolha um nome que só esse arquivo usa: o nome do arquivo com `_INC` no fim é a convenção mais comum.

```quiz
? Um .INC tem a linha "buffer DB 80 DUP (0)" e é incluído em três módulos. Quantos buffers o programa tem?
- Um, compartilhado
+ Três, um em cada módulo
- Nenhum: INCLUDE não aceita dados
> INCLUDE copia o texto. Cada módulo monta a sua própria cópia da variável. Para compartilhar, defina no módulo dono e use PUBLIC e EXTRN.

? Para que serve IFNDEF CORES_INC no começo de CORES.INC?
- Para o arquivo só ser incluído por módulos que já definiram CORES_INC
+ Para o conteúdo ser montado só na primeira vez que o arquivo é incluído
- Para avisar quando o arquivo não existe
> Na primeira inclusão o nome não existe e o bloco é montado, definindo CORES_INC. Nas seguintes, o IFNDEF é falso.
```

## Bibliotecas: o .LIB

Quando uma empresa tinha cinquenta rotinas prontas, ninguém queria escrever cinquenta nomes de .OBJ no comando do LINK. Os .OBJ eram juntados num arquivo só, uma **biblioteca** (.LIB), com o LIB da Microsoft ou o TLIB da Borland:

```texto titulo="Criar e usar uma biblioteca"
  TLIB MINHA.LIB +TELA.OBJ +NUMEROS.OBJ +ARQUIVO.OBJ
  TLINK PRINC.OBJ,,,MINHA.LIB
```

A diferença para passar os .OBJ direto é importante: o ligador **só tira da biblioteca os módulos que resolvem algum EXTRN**. Se o programa usa `escreve` e nada de NUMEROS.OBJ, o código de NUMEROS não entra no .EXE.

```diagrama titulo="O ligador e a biblioteca"
  PRINC.OBJ precisa de: escreve, imprime_num
                │
                ▼
  MINHA.LIB ┌─────────────┬───────────────┬──────────────┐
            │ TELA.OBJ    │ NUMEROS.OBJ   │ ARQUIVO.OBJ  │
            │  escreve ✓  │  imprime_num ✓│  abre        │
            └─────────────┴───────────────┴──────────────┘
                   entra          entra          fica de fora
```

A unidade é o **módulo inteiro**: se TELA.OBJ tem dez rotinas e o programa usa uma, as dez entram. Por isso as bibliotecas do Turbo C e do Microsoft C tinham quase uma função por arquivo-fonte: `printf` não puxava `scanf` junto.

:::anos90 A biblioteca do compilador
Todo programa em C do DOS era ligado com uma biblioteca do compilador (CS.LIB no Turbo C, para o modelo small) e com um módulo de partida, C0S.OBJ, que preparava a pilha, os segmentos e a linha de comando antes de chamar o `main`. O "Hello, world" em C tinha uns 6 KB; quase tudo era o `printf` e o que ele puxava da biblioteca. O mesmo programa em Assembly tinha 23 bytes.
:::

## Erros que você vai cometer

- **Variável dentro de .INC.** Vira uma cópia por módulo. Variável compartilhada é PUBLIC num módulo e EXTRN nos outros.
- **Esquecer a guarda.** Funciona até o dia em que dois .INC se incluem.
- **Incluir os EXTRN no próprio módulo dono.** O MASM 5 recusa um nome declarado EXTRN e depois definido. Separe a interface de quem usa da implementação.
- **Achar que um .INC é montado sozinho.** Um .INC não vira .OBJ. Erros dentro dele aparecem nas linhas do módulo que o incluiu.

## Exercícios

```exercicio
id: a51-1
titulo: Uma macro na biblioteca
nivel: 1
--- enunciado
O programa usa a macro **SAIR**, que ainda não existe. Escreva-a no arquivo **DOS.INC**: `SAIR codigo` encerra o programa com a INT 21h, função 4Ch, e o código de saída no AL.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE DOS.INC
        .CODE
inicio: MOV  BX, 5
        SAIR 3
        END  inicio
;### INCLUIR DOS.INC
; escreva aqui a macro SAIR
--- testes
[{ "nome": "termina com código 3", "espera": { "codigoSaida": 3, "BX": 5 } }]
--- dicas
SAIR MACRO codigo ... ENDM.
Dentro: MOV AH,4Ch / MOV AL,codigo / INT 21h.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE DOS.INC
        .CODE
inicio: MOV  BX, 5
        SAIR 3
        END  inicio
;### INCLUIR DOS.INC
SAIR    MACRO codigo
        MOV  AH, 4Ch
        MOV  AL, codigo
        INT  21h
        ENDM
```

```exercicio
id: a51-2
titulo: A guarda de inclusão
nivel: 2
--- enunciado
O programa inclui **CORES.INC** e **TELA.INC**, mas TELA.INC também inclui CORES.INC, e o montador reclama que as cores foram definidas duas vezes. Coloque uma guarda em **CORES.INC** para que o conteúdo seja montado uma vez só. Não mexa nos outros arquivos.

O programa deixa AMARELO em AL e a cor de fundo em AH.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE CORES.INC
        INCLUDE TELA.INC
        .CODE
inicio: MOV  AL, AMARELO
        MOV  AH, FUNDO
        MOV  BX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### INCLUIR CORES.INC
BRANCO  EQU 0Fh
AMARELO EQU 0Eh
AZUL    EQU 01h
;### INCLUIR TELA.INC
        INCLUDE CORES.INC
FUNDO   EQU AZUL
--- testes
[{ "nome": "BX = 010Eh (fundo azul, texto amarelo)", "espera": { "BX": 270 } }]
--- dicas
Envolva o conteúdo de CORES.INC com IFNDEF CORES_INC ... ENDIF.
Logo depois do IFNDEF, defina CORES_INC EQU 1.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE CORES.INC
        INCLUDE TELA.INC
        .CODE
inicio: MOV  AL, AMARELO
        MOV  AH, FUNDO
        MOV  BX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### INCLUIR CORES.INC
IFNDEF CORES_INC
CORES_INC EQU 1
BRANCO  EQU 0Fh
AMARELO EQU 0Eh
AZUL    EQU 01h
ENDIF
;### INCLUIR TELA.INC
        INCLUDE CORES.INC
FUNDO   EQU AZUL
```

```exercicio
id: a51-3
titulo: Uma estrutura em dois módulos
nivel: 2
--- enunciado
**PONTO.INC** define a estrutura PONTO (campos **x** e **y**, words). O módulo principal tem dois pontos e chama **distancia**, do módulo GEO.ASM, com SI apontando para o primeiro e DI para o segundo.

Escreva a rotina pública **distancia** em GEO.ASM: ela devolve em **AX** a distância "de táxi" entre os pontos, `|x1 − x2| + |y1 − y2|`. Use os campos da estrutura (`[SI].x`), não deslocamentos fixos. As coordenadas são positivas e menores que 10000.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE PONTO.INC
        EXTRN distancia:NEAR
        .DATA
p1      PONTO <>
p2      PONTO <>
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET p1
        MOV  DI, OFFSET p2
        CALL distancia
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO GEO.ASM
        .MODEL SMALL
        INCLUDE PONTO.INC
        .CODE
        ; escreva aqui a rotina pública distancia
        END
;### INCLUIR PONTO.INC
PONTO   STRUC
x       DW 0
y       DW 0
PONTO   ENDS
--- testes
[{ "nome": "(3,4) e (10,1) = 10", "setup": { "p1": [3, 4], "p2": [10, 1] }, "espera": { "CX": 10 } },
 { "nome": "(10,1) e (3,4) = 10", "setup": { "p1": [10, 1], "p2": [3, 4] }, "espera": { "CX": 10 } },
 { "nome": "o mesmo ponto = 0", "setup": { "p1": [7, 7], "p2": [7, 7] }, "espera": { "CX": 0 } },
 { "nome": "(0,500) e (200,0) = 700", "setup": { "p1": [0, 500], "p2": [200, 0] }, "espera": { "CX": 700 } }]
--- dicas
PUBLIC distancia no começo de GEO.ASM.
Para |a − b|: MOV AX,[SI].x / SUB AX,[DI].x / JNS positivo / NEG AX.
Calcule a parte de y em outro registrador (por exemplo BX) e some no fim.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        INCLUDE PONTO.INC
        EXTRN distancia:NEAR
        .DATA
p1      PONTO <>
p2      PONTO <>
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET p1
        MOV  DI, OFFSET p2
        CALL distancia
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO GEO.ASM
        .MODEL SMALL
        INCLUDE PONTO.INC
        PUBLIC distancia
        .CODE
distancia PROC
        PUSH BX
        MOV  AX, [SI].x
        SUB  AX, [DI].x
        JNS  dx_ok
        NEG  AX
dx_ok:  MOV  BX, [SI].y
        SUB  BX, [DI].y
        JNS  dy_ok
        NEG  BX
dy_ok:  ADD  AX, BX
        POP  BX
        RET
distancia ENDP
        END
;### INCLUIR PONTO.INC
PONTO   STRUC
x       DW 0
y       DW 0
PONTO   ENDS
```

```exercicio
id: a51-4
titulo: A rotina de números da biblioteca
nivel: 3
--- enunciado
Escreva o módulo **NUMEROS.ASM** com a rotina pública **imprime_num**: ela escreve **AX** em decimal, sem sinal, com a INT 21h, função 02h. A rotina precisa **preservar todos os registradores** que usar: o programa principal confia que AX, BX, CX e DX continuam iguais depois da chamada.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN imprime_num:NEAR
        .CODE
inicio: MOV  BX, 0
        MOV  AX, BX
        CALL imprime_num
        CALL espaco
        MOV  AX, 7
        CALL imprime_num
        CALL espaco
        MOV  AX, 65535
        CALL imprime_num
        MOV  BX, AX         ; BX = 65535 se AX foi preservado
        MOV  AX, 4C00h
        INT  21h
espaco: MOV  AH, 02h
        MOV  DL, ' '
        INT  21h
        RET
        END  inicio
;### MODULO NUMEROS.ASM
        .MODEL SMALL
        .CODE
        ; escreva aqui a rotina pública imprime_num
        END
--- testes
[{ "nome": "0 7 65535", "espera": { "saida": "0 7 65535", "BX": 65535 } }]
--- dicas
Divida AX por 10 até sobrar zero, empilhando os restos (DIV com DX = 0 antes).
Depois desempilhe e escreva cada dígito somando '0'. Conte os dígitos em CX.
Comece com PUSH AX / PUSH BX / PUSH CX / PUSH DX e termine com os POP na ordem inversa.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN imprime_num:NEAR
        .CODE
inicio: MOV  BX, 0
        MOV  AX, BX
        CALL imprime_num
        CALL espaco
        MOV  AX, 7
        CALL imprime_num
        CALL espaco
        MOV  AX, 65535
        CALL imprime_num
        MOV  BX, AX         ; BX = 65535 se AX foi preservado
        MOV  AX, 4C00h
        INT  21h
espaco: MOV  AH, 02h
        MOV  DL, ' '
        INT  21h
        RET
        END  inicio
;### MODULO NUMEROS.ASM
        .MODEL SMALL
        PUBLIC imprime_num
        .CODE
imprime_num PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
divide: XOR  DX, DX
        DIV  BX             ; AX = AX / 10, DX = resto
        PUSH DX
        INC  CX
        OR   AX, AX
        JNZ  divide
escreve:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP escreve
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
imprime_num ENDP
        END
```

:::resumo
- `INCLUDE NOME.INC` copia o texto do arquivo naquele ponto: bom para constantes, macros, estruturas e EXTRN.
- Variáveis não vão em .INC: cada módulo ganharia uma cópia.
- Guarda de inclusão: `IFNDEF NOME_INC` / `NOME_INC EQU 1` / ... / `ENDIF`.
- Uma biblioteca .LIB é um pacote de .OBJ; o ligador só tira dela os módulos que resolvem algum EXTRN.
- Neste curso, `;### INCLUIR NOME.INC` cria o arquivo que o INCLUDE lê.
:::
