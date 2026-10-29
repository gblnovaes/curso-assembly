---
id: aula52
numero: 52
modulo: 16
titulo: Conversando com o C
subtitulo: Convenções de chamada cdecl e pascal, o quadro de pilha e as regras de registradores
duracao: 75 min
objetivos: entender como um compilador C do DOS passa parâmetros e devolve resultados; montar e desmontar o quadro de pilha com BP; escrever rotinas em Assembly que um programa em C pode chamar; saber quais registradores uma rotina pode estragar e quais precisa devolver intactos; comparar as convenções cdecl e pascal
---

## Por que isso importa agora

Até aqui, cada rotina do curso combinou o próprio jeito de receber dados: uma pega o número em AX, outra o endereço em DS:SI, outra devolve o resultado no CF. Num programa só seu, isso funciona. Num programa de verdade, metade do código vem de um compilador, e o compilador não lê os seus comentários. Ele segue uma **convenção de chamada**: um contrato fixo sobre onde ficam os parâmetros, quem limpa a pilha, onde volta o resultado e quais registradores sobrevivem.

Os jogos comerciais do DOS eram quase todos assim: o grosso em C (ou Pascal), e as rotinas que precisavam de velocidade, como desenhar sprites, tocar som e ler o teclado, em Assembly. A partir do [módulo 25](avancado:aula48) o curso usa C de novo, agora em 32 bits, e a ideia é a mesma desta aula.

## O que o compilador faz com uma chamada

Pegue esta função em C, compilada no Turbo C ou no Microsoft C, modelo small:

```texto titulo="SOMA.C"
int soma(int a, int b)
{
    return a + b;
}

    ...
    x = soma(5, 7);
```

A chamada `soma(5, 7)` vira:

```asm fragmento titulo="O que o compilador gera para x = soma(5, 7)"
        MOV  AX, 7
        PUSH AX             ; o último parâmetro é empilhado primeiro
        MOV  AX, 5
        PUSH AX             ; o primeiro parâmetro fica por cima
        CALL _soma          ; o nome ganha um _ na frente
        ADD  SP, 4          ; quem chamou tira os parâmetros da pilha
        MOV  x, AX          ; o resultado volta em AX
```

São quatro regras da convenção **cdecl**, a do C:

1. Os parâmetros são empilhados **da direita para a esquerda**. Assim o primeiro fica mais perto do topo, num endereço fixo, não importa quantos venham depois. É isso que deixa o `printf` receber um número variável de parâmetros.
2. **Quem chama limpa a pilha**, com `ADD SP, n`. Só quem chamou sabe quantos parâmetros empilhou.
3. O resultado volta em **AX** (um `char` volta em AL; um `long` de 32 bits, em **DX:AX**, com a parte alta em DX).
4. O nome da função ganha um **sublinhado** na frente: `soma` vira `_soma` no .OBJ.

Cada parâmetro ocupa pelo menos uma palavra na pilha. Um `char` é empilhado como 16 bits (o 8086 não tem PUSH de 8 bits), e um `long` ocupa duas palavras.

## O quadro de pilha

Do lado da rotina, os parâmetros estão na pilha, logo acima do endereço de retorno. O jeito de chegar neles é o que você já viu na [aula 10](aula:aula10): copiar SP para BP e usar BP como base.

```asm fragmento titulo="_soma em Assembly"
_soma   PROC NEAR
        PUSH BP             ; guarda o BP de quem chamou
        MOV  BP, SP         ; BP aponta para o quadro desta chamada
        MOV  AX, [BP+4]     ; a
        ADD  AX, [BP+6]     ; b
        POP  BP
        RET                 ; cdecl: RET simples, quem chamou faz ADD SP,4
_soma   ENDP
```

```diagrama titulo="A pilha dentro de _soma (modelo small, CALL NEAR)"
   endereço       conteúdo
              ┌──────────────────┐
   BP+6       │  7  (b)          │  empilhado primeiro
   BP+4       │  5  (a)          │
   BP+2       │  retorno (IP)    │  posto pelo CALL
   BP+0  ───► │  BP antigo       │  posto pelo PUSH BP
   BP-2       │  variável local  │  se houver SUB SP,2
              └──────────────────┘
                 SP cresce para baixo ▼
```

Os números mudam com o modelo de memória. No modelo small, o CALL é NEAR e empilha só o IP, por isso o primeiro parâmetro está em `[BP+4]`. Nos modelos medium e large, as funções são FAR: o CALL empilha CS e IP, e o primeiro parâmetro passa para `[BP+6]`. Um endereço de dado também cresce: no modelo large, `char *s` é um ponteiro FAR de duas palavras (deslocamento em `[BP+6]`, segmento em `[BP+8]`), e a rotina usa `LDS SI, [BP+6]` ou `LES DI, [BP+6]`.

:::cpu Por que BP e não SP
O 8086 não aceita `[SP+4]`: SP não é registrador de base. Os registradores que servem de base num endereço são só BX e BP. BP tem uma vantagem extra: `[BP+n]` usa o segmento SS por padrão, que é justamente onde está a pilha. No 386 em 32 bits, `[ESP+4]` passa a existir, e compiladores modernos às vezes nem montam o quadro.
:::

### Variáveis locais

Uma função em C com variáveis locais reserva espaço logo abaixo do BP:

```asm fragmento titulo="int f(int n) { int t; ... }"
_f      PROC NEAR
        PUSH BP
        MOV  BP, SP
        SUB  SP, 2          ; espaço para t, em [BP-2]
        MOV  AX, [BP+4]     ; n
        MOV  [BP-2], AX     ; t = n
        ...
        MOV  SP, BP         ; descarta as locais de uma vez
        POP  BP
        RET
_f      ENDP
```

O `MOV SP, BP` no fim desfaz qualquer `SUB SP` e qualquer PUSH esquecido no meio. É por isso que a sequência "PUSH BP / MOV BP,SP / ... / MOV SP,BP / POP BP" aparece em quase toda função compilada. O 80186 ganhou duas instruções só para isso, `ENTER` e `LEAVE`, que você vai ver no [módulo 17](avancado:aula48).

```quiz
? Dentro de int f(int a, int b, int c), em cdecl, modelo small, depois de PUSH BP / MOV BP,SP, onde está c?
- [BP+4]
- [BP+6]
+ [BP+8]
- [BP-2]
> a em [BP+4], b em [BP+6], c em [BP+8]. O primeiro parâmetro fica mais perto do topo porque foi empilhado por último.

? Por que, em cdecl, quem chama faz ADD SP,n e a função termina com RET simples?
- Porque o 8086 não tem RET com operando
+ Porque só quem chamou sabe quantos parâmetros empilhou, o que permite funções como printf
- Porque assim a função fica mais rápida
> O 8086 tem RET n. O C não usa porque a função não sabe com quantos parâmetros foi chamada.
```

## Quem pode estragar o quê

A outra metade do contrato são os registradores. O compilador conta com isto, e uma rotina em Assembly que quebre a regra produz os bugs mais difíceis do DOS: o programa em C falha muito depois, numa linha que não tem nada de errado.

| Registradores | Na rotina chamada |
|---------------|-------------------|
| AX, BX, CX, DX, ES | pode usar à vontade (AX e DX levam o resultado) |
| SI, DI | precisa devolver como recebeu: o compilador guarda variáveis `register` neles |
| BP | precisa devolver: é o quadro de quem chamou |
| DS, SS | precisa devolver: no modelo small, DS = SS = o segmento de dados do programa |
| SP | precisa voltar ao valor de antes do CALL (menos os parâmetros, em pascal) |
| DF (direção) | precisa estar zerada na volta (CLD), se você usou STD |

Essa é a regra do Turbo C e do Microsoft C para o DOS. Outros compiladores usaram regras parecidas, nunca idênticas: confira sempre o manual do compilador que for ligar com o seu código.

## Um programa inteiro: C chamando Assembly

Aqui o módulo PRINC.ASM faz o papel do código que o Turbo C geraria para o `main`. O módulo MAXIMO.ASM é o seu: uma rotina que um programa em C declararia como `extern int maximo(int a, int b);`.

```asm executar titulo="PRINC (o C) chamando _maximo (o Assembly)"
;### MODULO PRINC.ASM
; o que o compilador gera para:  r = maximo(-3, 12);
        .MODEL SMALL
        .STACK 100h
        EXTRN _maximo:NEAR
        .DATA
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 12
        PUSH AX
        MOV  AX, -3
        PUSH AX
        CALL _maximo
        ADD  SP, 4          ; cdecl: quem chama limpa
        MOV  r, AX          ; r = 12
        MOV  BX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO MAXIMO.ASM
; int maximo(int a, int b): o maior dos dois, com sinal
        .MODEL SMALL
        PUBLIC _maximo
        .CODE
_maximo PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]     ; a
        CMP  AX, [BP+6]     ; compara com b
        JGE  pronto         ; int tem sinal: JGE, não JAE
        MOV  AX, [BP+6]
pronto: POP  BP
        RET
_maximo ENDP
        END
```

Rode no depurador e acompanhe SP: ele desce 4 com os dois PUSH, mais 2 com o CALL e mais 2 com o PUSH BP, e volta exatamente ao valor inicial depois do `ADD SP, 4`.

:::dica Do lado do C
No arquivo .C, basta a declaração `extern int maximo(int a, int b);` e chamar `maximo(-3, 12)`. Para gerar o programa, o Turbo C aceitava o .ASM direto: `TCC PRINC.C MAXIMO.ASM` chamava o TASM e o TLINK sozinho. O C manda no nome com sublinhado; se o seu PUBLIC for `maximo` sem `_`, o ligador reclama de "undefined symbol _maximo".
:::

## A convenção pascal

O Turbo Pascal, o Windows 3.x (as funções da API eram `FAR PASCAL`) e o OS/2 de 16 bits usavam outra convenção:

| | cdecl (C) | pascal |
|--|-----------|--------|
| Ordem dos PUSH | da direita para a esquerda | da esquerda para a direita |
| Quem limpa a pilha | quem chama (`ADD SP, n`) | a rotina (`RET n`) |
| Nome no .OBJ | `_soma` | `SOMA` (maiúsculas, sem sublinhado) |
| Número variável de parâmetros | sim | não |
| Tamanho do código | um ADD em cada chamada | um RET n só, na rotina |

Como os parâmetros são empilhados na ordem em que aparecem, em pascal o **último** parâmetro é que fica em `[BP+4]`.

```asm fragmento titulo="function SUBTRAI(a, b: integer): integer, em pascal"
SUBTRAI PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+6]     ; a (empilhado primeiro, fica mais longe)
        SUB  AX, [BP+4]     ; b
        POP  BP
        RET  4              ; a rotina tira os 4 bytes de parâmetros
SUBTRAI ENDP
```

O `RET 4` volta para quem chamou e depois soma 4 ao SP. Esquecer o número é um erro que não avisa: a rotina volta certinho, mas a pilha de quem chamou fica com duas palavras a mais, e o programa cai mais tarde, num RET que pega o endereço errado.

:::anos90 Por que o Windows usava pascal
No Windows 3.0, cada chamada de API economizava um `ADD SP, n` no programa do usuário, e com milhares de chamadas por programa isso dava quilobytes, numa época em que 640 KB era tudo. O Windows de 32 bits trocou para a convenção `stdcall`: ordem do C (direita para a esquerda) e limpeza do pascal (`RET n`). É a que a API Win32 usa até hoje.
:::

```quiz
? Em pascal, a função P(x, y, z) começa com PUSH BP / MOV BP,SP. Onde está x?
- [BP+4]
- [BP+6]
+ [BP+8]
> Em pascal, x é empilhado primeiro e fica mais longe do topo: z em [BP+4], y em [BP+6], x em [BP+8].

? Uma rotina pascal com dois parâmetros int termina com RET em vez de RET 4. O que acontece?
- O montador recusa
- A rotina volta para o endereço errado
+ A rotina volta certo, mas SP fica 4 bytes abaixo do que quem chamou espera
> O endereço de retorno está no topo, então o RET acerta. Os parâmetros ficam esquecidos na pilha.
```

## Erros que você vai cometer

- **Ordem dos parâmetros trocada.** cdecl: primeiro parâmetro em `[BP+4]`. Pascal: último parâmetro em `[BP+4]`.
- **Esquecer o sublinhado** no PUBLIC de uma rotina chamada por C.
- **Estragar SI ou DI.** O C guardava uma variável `register` ali, e ela muda de valor sem ninguém mexer.
- **`[BP+4]` no modelo large.** Com CALL FAR, o primeiro parâmetro está em `[BP+6]`.
- **Comparar `int` com JA/JB.** Em C, `int` tem sinal: use JG, JL, JGE, JLE ([aula 22](aula:aula22)). `unsigned` usa JA, JB.
- **Deixar DF ligada.** Se usou STD para copiar de trás para frente, termine com CLD: o `memcpy` do compilador conta com isso.

## Exercícios

Nos exercícios, o módulo PRINC.ASM faz o papel do código gerado pelo compilador C (ou Pascal). Ele já está pronto: escreva a rotina no outro módulo.

```exercicio
id: a52-1
titulo: int soma3(int a, int b, int c)
nivel: 1
--- enunciado
Escreva **_soma3** em cdecl: devolve em AX a soma dos três parâmetros. O PRINC já empilha os parâmetros, chama e limpa a pilha. Monte o quadro com BP.
--- inicial
;### MODULO PRINC.ASM
; r = soma3(a, b, c);
        .MODEL SMALL
        .STACK 100h
        EXTRN _soma3:NEAR
        .DATA
a       DW 1
b       DW 2
c       DW 3
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH c
        PUSH b
        PUSH a
        CALL _soma3
        ADD  SP, 6
        MOV  r, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO SOMA3.ASM
        .MODEL SMALL
        PUBLIC _soma3
        .CODE
_soma3  PROC NEAR
        ; escreva aqui
        RET
_soma3  ENDP
        END
--- testes
[{ "nome": "1 + 2 + 3", "setup": { "a": 1, "b": 2, "c": 3 }, "espera": { "mem": { "r": 6 }, "pilhaEquilibrada": true } },
 { "nome": "100 + (-30) + 5", "setup": { "a": 100, "b": -30, "c": 5 }, "espera": { "mem": { "r": 75 }, "pilhaEquilibrada": true } },
 { "nome": "1000 + 2000 + 3000", "setup": { "a": 1000, "b": 2000, "c": 3000 }, "espera": { "mem": { "r": 6000 }, "pilhaEquilibrada": true } }]
--- dicas
PUSH BP / MOV BP,SP no começo, POP BP antes do RET.
a está em [BP+4], b em [BP+6], c em [BP+8].
--- solucao
;### MODULO PRINC.ASM
; r = soma3(a, b, c);
        .MODEL SMALL
        .STACK 100h
        EXTRN _soma3:NEAR
        .DATA
a       DW 1
b       DW 2
c       DW 3
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH c
        PUSH b
        PUSH a
        CALL _soma3
        ADD  SP, 6
        MOV  r, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO SOMA3.ASM
        .MODEL SMALL
        PUBLIC _soma3
        .CODE
_soma3  PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]
        ADD  AX, [BP+6]
        ADD  AX, [BP+8]
        POP  BP
        RET
_soma3  ENDP
        END
```

```exercicio
id: a52-2
titulo: Uma função pascal
nivel: 2
--- enunciado
Agora quem chama é um programa em Turbo Pascal: `r := DIVIDE(a, b);` com a convenção pascal. Escreva **DIVIDE**, que devolve em AX o quociente de `a` por `b`, os dois sem sinal.

Lembre que, em pascal, os parâmetros são empilhados na ordem em que aparecem, e **a rotina** tira os parâmetros da pilha. O PRINC não faz `ADD SP`.
--- inicial
;### MODULO PRINC.ASM
; r := DIVIDE(a, b);   { convenção pascal }
        .MODEL SMALL
        .STACK 100h
        EXTRN DIVIDE:NEAR
        .DATA
a       DW 100
b       DW 7
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH a
        PUSH b
        CALL DIVIDE
        MOV  r, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO DIVIDE.ASM
        .MODEL SMALL
        PUBLIC DIVIDE
        .CODE
DIVIDE  PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]
        XOR  DX, DX
        DIV  WORD PTR [BP+6]
        POP  BP
        RET
DIVIDE  ENDP
        END
--- testes
[{ "nome": "100 / 7", "setup": { "a": 100, "b": 7 }, "espera": { "mem": { "r": 14 }, "pilhaEquilibrada": true } },
 { "nome": "7 / 100", "setup": { "a": 7, "b": 100 }, "espera": { "mem": { "r": 0 }, "pilhaEquilibrada": true } },
 { "nome": "60000 / 3", "setup": { "a": 60000, "b": 3 }, "espera": { "mem": { "r": 20000 }, "pilhaEquilibrada": true } }]
--- dicas
O código inicial tem dois erros: a ordem dos parâmetros e o fim da rotina.
Em pascal, o último parâmetro (b) está em [BP+4] e o primeiro (a) em [BP+6].
Termine com RET 4.
--- solucao
;### MODULO PRINC.ASM
; r := DIVIDE(a, b);   { convenção pascal }
        .MODEL SMALL
        .STACK 100h
        EXTRN DIVIDE:NEAR
        .DATA
a       DW 100
b       DW 7
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH a
        PUSH b
        CALL DIVIDE
        MOV  r, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO DIVIDE.ASM
        .MODEL SMALL
        PUBLIC DIVIDE
        .CODE
DIVIDE  PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+6]     ; a
        XOR  DX, DX
        DIV  WORD PTR [BP+4] ; b
        POP  BP
        RET  4
DIVIDE  ENDP
        END
```

```exercicio
id: a52-3
titulo: strlen sem estragar SI
nivel: 2
--- enunciado
Escreva **_strlen** em cdecl: `int strlen(char *s)` devolve em AX quantos caracteres há antes do 0 que termina a string. O ponteiro é NEAR (modelo small): um deslocamento em DS.

O código do C guarda variáveis em SI e DI. A sua rotina pode usar SI, mas tem que devolvê-lo como recebeu.
--- inicial
;### MODULO PRINC.ASM
; n = strlen(texto);
        .MODEL SMALL
        .STACK 100h
        EXTRN _strlen:NEAR
        .DATA
texto   DB 'ASSEMBLY', 0, 20 DUP (0)
n       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, OFFSET texto
        PUSH AX
        CALL _strlen
        ADD  SP, 2
        MOV  n, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO STRLEN.ASM
        .MODEL SMALL
        PUBLIC _strlen
        .CODE
_strlen PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  SI, [BP+4]
        XOR  AX, AX
conta:  CMP  BYTE PTR [SI], 0
        JE   fim
        INC  SI
        INC  AX
        JMP  conta
fim:    POP  BP
        RET
_strlen ENDP
        END
--- testes
[{ "nome": "ASSEMBLY", "setup": { "texto": "ASSEMBLY", "SI": 4660, "DI": 22136 }, "espera": { "mem": { "n": 8 }, "preservar": ["SI", "DI", "BP"], "pilhaEquilibrada": true } },
 { "nome": "string vazia", "setup": { "texto": [0], "SI": 4660, "DI": 22136 }, "espera": { "mem": { "n": 0 }, "preservar": ["SI", "DI", "BP"], "pilhaEquilibrada": true } },
 { "nome": "uma letra", "setup": { "texto": [65, 0], "SI": 1, "DI": 2 }, "espera": { "mem": { "n": 1 }, "preservar": ["SI", "DI", "BP"], "pilhaEquilibrada": true } }]
--- dicas
O contador já funciona. O problema é que SI volta mudado.
Empilhe SI depois de montar o quadro e desempilhe antes do POP BP.
Outra saída: usar BX no lugar de SI, que a rotina pode estragar.
--- solucao
;### MODULO PRINC.ASM
; n = strlen(texto);
        .MODEL SMALL
        .STACK 100h
        EXTRN _strlen:NEAR
        .DATA
texto   DB 'ASSEMBLY', 0, 20 DUP (0)
n       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, OFFSET texto
        PUSH AX
        CALL _strlen
        ADD  SP, 2
        MOV  n, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO STRLEN.ASM
        .MODEL SMALL
        PUBLIC _strlen
        .CODE
_strlen PROC NEAR
        PUSH BP
        MOV  BP, SP
        PUSH SI
        MOV  SI, [BP+4]
        XOR  AX, AX
conta:  CMP  BYTE PTR [SI], 0
        JE   fim
        INC  SI
        INC  AX
        JMP  conta
fim:    POP  SI
        POP  BP
        RET
_strlen ENDP
        END
```

```exercicio
id: a52-4
titulo: Um long em DX:AX
nivel: 2
--- enunciado
Escreva **_dobro** em cdecl: `long dobro(long x)` devolve 2·x, em 32 bits, em **DX:AX** (parte alta em DX).

Um `long` ocupa duas palavras na pilha. O compilador empilha primeiro a parte alta e depois a baixa, então a baixa fica em `[BP+4]` e a alta em `[BP+6]`. No PRINC, `PUSH WORD PTR x+2` empilha a parte alta.
--- inicial
;### MODULO PRINC.ASM
; r = dobro(x);
        .MODEL SMALL
        .STACK 100h
        EXTRN _dobro:NEAR
        .DATA
x       DD 70000
r       DD ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH WORD PTR x+2   ; parte alta
        PUSH WORD PTR x     ; parte baixa
        CALL _dobro
        ADD  SP, 4
        MOV  WORD PTR r, AX
        MOV  WORD PTR r+2, DX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO DOBRO.ASM
        .MODEL SMALL
        PUBLIC _dobro
        .CODE
_dobro  PROC NEAR
        ; escreva aqui
        RET
_dobro  ENDP
        END
--- testes
[{ "nome": "70000 · 2", "setup": { "x": [4464, 1] }, "espera": { "mem": { "r": 140000 }, "pilhaEquilibrada": true } },
 { "nome": "40000 · 2 (passa de 16 bits)", "setup": { "x": [40000, 0] }, "espera": { "mem": { "r": 80000 }, "pilhaEquilibrada": true } },
 { "nome": "1000000 · 2", "setup": { "x": [16960, 15] }, "espera": { "mem": { "r": 2000000 }, "pilhaEquilibrada": true } }]
--- dicas
Carregue a parte baixa em AX e a alta em DX.
Some cada um com ele mesmo: ADD AX,AX e depois ADC DX,DX, para levar o vai-um.
Também dá com SHL AX,1 / RCL DX,1.
--- solucao
;### MODULO PRINC.ASM
; r = dobro(x);
        .MODEL SMALL
        .STACK 100h
        EXTRN _dobro:NEAR
        .DATA
x       DD 70000
r       DD ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH WORD PTR x+2   ; parte alta
        PUSH WORD PTR x     ; parte baixa
        CALL _dobro
        ADD  SP, 4
        MOV  WORD PTR r, AX
        MOV  WORD PTR r+2, DX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO DOBRO.ASM
        .MODEL SMALL
        PUBLIC _dobro
        .CODE
_dobro  PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]     ; parte baixa
        MOV  DX, [BP+6]     ; parte alta
        ADD  AX, AX
        ADC  DX, DX
        POP  BP
        RET
_dobro  ENDP
        END
```

```exercicio
id: a52-5
titulo: Fatorial recursivo, como o C faria
nivel: 3
--- enunciado
Escreva **_fat** em cdecl, recursiva, como o compilador faria com `int fat(int n) { if (n <= 1) return 1; return n * fat(n - 1); }`.

A rotina chama a si mesma com a convenção cdecl completa: empilha `n - 1`, faz `CALL _fat`, limpa com `ADD SP, 2` e multiplica o resultado por n. Os testes vão até 8! = 40320, que cabe em 16 bits.
--- inicial
;### MODULO PRINC.ASM
; r = fat(n);
        .MODEL SMALL
        .STACK 100h
        EXTRN _fat:NEAR
        .DATA
n       DW 5
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH n
        CALL _fat
        ADD  SP, 2
        MOV  r, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO FAT.ASM
        .MODEL SMALL
        PUBLIC _fat
        .CODE
_fat    PROC NEAR
        ; escreva aqui
        MOV  AX, 1
        RET
_fat    ENDP
        END
--- testes
[{ "nome": "5! = 120", "setup": { "n": 5 }, "espera": { "mem": { "r": 120 }, "pilhaEquilibrada": true } },
 { "nome": "8! = 40320", "setup": { "n": 8 }, "espera": { "mem": { "r": 40320 }, "pilhaEquilibrada": true } },
 { "nome": "1! = 1", "setup": { "n": 1 }, "espera": { "mem": { "r": 1 }, "pilhaEquilibrada": true } },
 { "nome": "0! = 1", "setup": { "n": 0 }, "espera": { "mem": { "r": 1 }, "pilhaEquilibrada": true } }]
--- dicas
Comece com PUSH BP / MOV BP,SP e leia n de [BP+4].
Se n <= 1 (JLE, n é int com sinal), devolva 1.
Senão: MOV AX,[BP+4] / DEC AX / PUSH AX / CALL _fat / ADD SP,2. AX tem fat(n-1).
Depois, MUL WORD PTR [BP+4]: o seu n continua em [BP+4], mesmo depois da chamada, porque cada chamada tem o seu quadro.
--- solucao
;### MODULO PRINC.ASM
; r = fat(n);
        .MODEL SMALL
        .STACK 100h
        EXTRN _fat:NEAR
        .DATA
n       DW 5
r       DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        PUSH n
        CALL _fat
        ADD  SP, 2
        MOV  r, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO FAT.ASM
        .MODEL SMALL
        PUBLIC _fat
        .CODE
_fat    PROC NEAR
        PUSH BP
        MOV  BP, SP
        MOV  AX, 1
        CMP  WORD PTR [BP+4], 1
        JLE  fim            ; n <= 1: devolve 1
        MOV  AX, [BP+4]
        DEC  AX
        PUSH AX             ; fat(n - 1)
        CALL _fat
        ADD  SP, 2
        MUL  WORD PTR [BP+4] ; DX:AX = fat(n-1) * n
fim:    POP  BP
        RET
_fat    ENDP
        END
```

:::resumo
- **cdecl** (C): parâmetros da direita para a esquerda, quem chama faz `ADD SP, n`, nome com `_`, resultado em AX (ou DX:AX para `long`).
- **pascal**: parâmetros da esquerda para a direita, a rotina faz `RET n`, nome em maiúsculas.
- Quadro de pilha: `PUSH BP` / `MOV BP, SP`; no modelo small o primeiro parâmetro cdecl está em `[BP+4]`; locais em `[BP-2]`, `[BP-4]`... com `SUB SP, n`; no fim, `MOV SP, BP` / `POP BP`.
- A rotina pode estragar AX, BX, CX, DX e ES; precisa devolver SI, DI, BP, DS, SS e SP, e a flag de direção zerada.
- Nos modelos com código FAR, os parâmetros começam em `[BP+6]`.
:::
