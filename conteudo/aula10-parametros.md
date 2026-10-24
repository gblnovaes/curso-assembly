---
id: aula10
numero: 10
modulo: 4
titulo: Parâmetros, BP e variáveis locais
subtitulo: O quadro de pilha (stack frame) dos compiladores dos anos 90
duracao: 65 min
objetivos: passar parâmetros pela pilha; montar o quadro de pilha com PUSH BP / MOV BP,SP; acessar parâmetros com [BP+n] e variáveis locais com [BP-n]; limpar a pilha com RET n ou ADD SP,n; conhecer as convenções Pascal e C
---

## Por que passar parâmetros pela pilha

Passar dados em registradores é rápido, mas tem limites: são poucos registradores, e se um procedimento chama outro, eles se atropelam. Os compiladores de Pascal e C dos anos 80 e 90 resolviam isso de um jeito padronizado: o chamador **empilha os parâmetros** e depois faz o `CALL`.

```asm fragmento
; equivalente a  SOMA(10, 20)
        MOV  AX, 20
        PUSH AX          ; 2º parâmetro
        MOV  AX, 10
        PUSH AX          ; 1º parâmetro
        CALL SOMA        ; empilha o retorno
```

Dentro de `SOMA`, a pilha fica assim:

```diagrama titulo="A pilha logo depois do CALL"
            ┌──────────────┐
  SP+4  ──► │      20      │  2º parâmetro
            ├──────────────┤
  SP+2  ──► │      10      │  1º parâmetro
            ├──────────────┤
  SP    ──► │   retorno    │  empilhado pelo CALL
            └──────────────┘
```

O problema: não dá para escrever `[SP+2]`, porque **SP não pode ser usado entre colchetes** no 8086. E mesmo que desse, SP muda a cada `PUSH` dentro do procedimento. A solução é o **BP**.

## O quadro de pilha (stack frame)

Todo procedimento que recebe parâmetros pela pilha começa e termina com o mesmo ritual:

```asm fragmento
SOMA    PROC
        PUSH BP          ; 1. salva o BP de quem chamou
        MOV  BP, SP      ; 2. BP aponta para o topo atual: referência fixa
        ...
        MOV  AX, [BP+4]  ; 1º parâmetro
        ADD  AX, [BP+6]  ; 2º parâmetro
        ...
        POP  BP          ; 3. restaura o BP de quem chamou
        RET  4           ; 4. volta e descarta 4 bytes de parâmetros
SOMA    ENDP
```

Depois do `PUSH BP` e do `MOV BP,SP`, a pilha é esta:

```diagrama titulo="Quadro de pilha com BP"
            ┌──────────────┐
  BP+6  ──► │      20      │  2º parâmetro
  BP+4  ──► │      10      │  1º parâmetro
  BP+2  ──► │   retorno    │
  BP    ──► │   BP antigo  │  <- SP = BP
            └──────────────┘
```

Lembra da Aula 6? Endereços com BP usam o segmento **SS** por padrão. Ou seja, `[BP+4]` lê **da pilha**, exatamente o que queremos. Essa foi a intenção da Intel ao criar o BP.

:::cpu ENTER e LEAVE
O 80186 criou as instruções `ENTER` e `LEAVE` para montar e desmontar o quadro de pilha. **Elas não existem no 8086**: aqui escrevemos o ritual à mão, como os compiladores para o PC original faziam.
:::

## Limpando os parâmetros: RET n

Depois que o procedimento volta, os parâmetros ainda estão na pilha. Alguém precisa retirá-los:

- **O chamado limpa** com `RET n`: o `RET 4` desempilha o retorno e soma 4 a SP. É a **convenção Pascal**, usada também pela API do Windows 3.x.
- **O chamador limpa** com `ADD SP, n` depois do `CALL`. É a **convenção C**. Ela permite funções com número variável de parâmetros, como `printf`: só quem chamou sabe quantos empilhou.

| | Convenção Pascal | Convenção C |
|-|------------------|-------------|
| Ordem dos PUSH | da esquerda para a direita | da direita para a esquerda |
| Quem limpa | o procedimento (`RET n`) | o chamador (`ADD SP,n`) |
| Parâmetros variáveis | não | sim |

Neste curso usamos a ordem do C (o 1º parâmetro fica em `[BP+4]`) e limpamos com `RET n`, que é o mais comum em Assembly puro. O importante é ser **consistente** e documentar.

## Programa completo

```asm executar titulo="PARAMS.ASM"
.MODEL SMALL
.STACK 100h
.DATA
resultado DW ?
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 20
        PUSH AX
        MOV  AX, 10
        PUSH AX
        CALL SOMA           ; AX = 30, e a pilha volta equilibrada
        MOV  resultado, AX

        MOV  AX, 4C00h
        INT  21h

; SOMA(a, b): devolve a + b em AX
; [BP+4] = a, [BP+6] = b
SOMA    PROC
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]
        ADD  AX, [BP+6]
        POP  BP
        RET  4
SOMA    ENDP
END inicio
```

No laboratório, use F7 e observe as janelas de pilha e registradores. Repare que BP fica marcado na pilha.

## Nomes para os parâmetros

`[BP+4]` e `[BP+6]` são pouco legíveis. Use `EQU` de texto para dar nomes:

```asm fragmento
A_PARAM EQU [BP+4]
B_PARAM EQU [BP+6]
...
        MOV  AX, A_PARAM
        ADD  AX, B_PARAM
```

O montador substitui o nome pelo texto. Ficou bem mais claro.

## Variáveis locais

Às vezes o procedimento precisa de memória temporária só para ele. A pilha também resolve: depois do `MOV BP,SP`, **reserve espaço** descendo SP:

```asm fragmento
PROC_COM_LOCAIS PROC
        PUSH BP
        MOV  BP, SP
        SUB  SP, 4           ; 2 words de variáveis locais
        ...
        MOV  WORD PTR [BP-2], 0    ; 1ª local
        MOV  WORD PTR [BP-4], 1    ; 2ª local
        ...
        MOV  SP, BP          ; descarta as locais
        POP  BP
        RET
PROC_COM_LOCAIS ENDP
```

```diagrama titulo="Quadro completo: parâmetros acima, locais abaixo"
  BP+6  ──► │  parâmetro 2 │
  BP+4  ──► │  parâmetro 1 │
  BP+2  ──► │   retorno    │
  BP    ──► │   BP antigo  │
  BP-2  ──► │   local 1    │
  BP-4  ──► │   local 2    │  <- SP
```

Parâmetros ficam em deslocamentos **positivos** a partir de BP; locais, em **negativos**. O `MOV SP,BP` no fim descarta todas as locais de uma vez, e depois o `POP BP` e o `RET` funcionam normalmente.

:::anos90 Turbo Pascal e Turbo C
Se você desmontasse um programa compilado pelo Turbo Pascal ou pelo Turbo C, veria exatamente esse ritual no começo de cada função: `PUSH BP / MOV BP,SP / SUB SP,n`. Quem programava em Assembly e queria chamar ou ser chamado por código Pascal ou C precisava seguir as mesmas regras. Os parâmetros `VAR` do Pascal e os ponteiros do C eram passados como **endereços** na pilha.
:::

## Parâmetros por referência

Até aqui passamos **valores**. Para o procedimento alterar uma variável de quem chamou, passe o **endereço** dela (como os parâmetros `VAR` do Pascal):

```asm executar titulo="TROCA.ASM: parâmetros por referência"
.MODEL SMALL
.STACK 100h
.DATA
x       DW 111
y       DW 222
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        LEA  AX, y
        PUSH AX             ; endereço de y
        LEA  AX, x
        PUSH AX             ; endereço de x
        CALL TROCA          ; agora x = 222 e y = 111

        MOV  AX, 4C00h
        INT  21h

; TROCA(&a, &b): troca os valores apontados
TROCA   PROC
        PUSH BP
        MOV  BP, SP
        PUSH BX
        PUSH SI
        MOV  BX, [BP+4]     ; BX = endereço de a
        MOV  SI, [BP+6]     ; SI = endereço de b
        MOV  AX, [BX]
        XCHG AX, [SI]
        MOV  [BX], AX
        POP  SI
        POP  BX
        POP  BP
        RET  4
TROCA   ENDP
END inicio
```

Atenção: dentro de `TROCA`, `[BX]` e `[SI]` usam o segmento **DS** (só BP usa SS). É por isso que os endereços dos dados funcionam.

```quiz
? Depois de PUSH BP / MOV BP,SP em um procedimento near, onde está o 1º parâmetro (o último empilhado antes do CALL)?
- [BP+2]
+ [BP+4]
- [BP-2]
> [BP] é o BP antigo, [BP+2] é o endereço de retorno e [BP+4] é o último parâmetro empilhado.

? Por que não usamos [SP+4] para ler os parâmetros?
+ SP não pode ser usado entre colchetes no 8086, e ele muda a cada PUSH.
- Porque SP aponta para o segmento de dados.
- Porque [SP+4] é mais lento.
> Só BX, BP, SI e DI endereçam memória. BP é a referência fixa do quadro.

? Um procedimento recebe 3 parâmetros de 1 word cada. Na convenção Pascal, como ele retorna?
- RET
- RET 3
+ RET 6
> 3 words = 6 bytes para descartar.

? Onde ficam as variáveis locais em relação a BP?
- Em deslocamentos positivos
+ Em deslocamentos negativos
> Elas ficam abaixo do BP antigo, depois do SUB SP,n.

? Qual instrução descarta todas as variáveis locais antes do POP BP?
+ MOV SP, BP
- POP SP
- ADD BP, SP
> Como BP aponta para onde SP estava antes do SUB, copiar BP para SP desfaz a reserva.
```

## Exercícios

```exercicio
id: a10-1
titulo: Soma de três parâmetros
nivel: 2
--- enunciado
Escreva o procedimento **SOMA3(a, b, c)**, que recebe três words pela pilha e devolve **a + b + c** em **AX**, limpando os parâmetros com `RET n`. O programa principal chama SOMA3(100, 20, 3).
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 3
        PUSH AX             ; c
        MOV  AX, 20
        PUSH AX             ; b
        MOV  AX, 100
        PUSH AX             ; a
        CALL SOMA3
        MOV  DX, AX         ; DX = 123
        MOV  AX, 4C00h
        INT  21h

SOMA3   PROC
        ; seu código aqui
        RET
SOMA3   ENDP
END inicio
--- testes
[{ "nome": "DX = 123 e pilha equilibrada", "espera": { "DX": 123, "pilhaEquilibrada": true } }]
--- dicas
a está em [BP+4], b em [BP+6] e c em [BP+8].
São 3 words: RET 6.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 3
        PUSH AX
        MOV  AX, 20
        PUSH AX
        MOV  AX, 100
        PUSH AX
        CALL SOMA3
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

SOMA3   PROC
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]
        ADD  AX, [BP+6]
        ADD  AX, [BP+8]
        POP  BP
        RET  6
SOMA3   ENDP
END inicio
```

```exercicio
id: a10-2
titulo: Convenção C
nivel: 2
--- enunciado
O procedimento **SUBTRAI(a, b)** já está pronto e devolve **a − b** em AX, mas ele termina com um `RET` simples (convenção C). Escreva o código do programa principal que chama **SUBTRAI(50, 8)** e **limpa a pilha depois** com `ADD SP,n`. Guarde o resultado em **DX**.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        ; chame SUBTRAI(50, 8) e guarde o resultado em DX

        MOV  AX, 4C00h
        INT  21h

; SUBTRAI(a, b) = a - b   (convenção C: quem chama limpa a pilha)
SUBTRAI PROC
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]
        SUB  AX, [BP+6]
        POP  BP
        RET
SUBTRAI ENDP
END inicio
--- testes
[{ "nome": "DX = 42 e pilha equilibrada", "espera": { "DX": 42, "pilhaEquilibrada": true } }]
--- dicas
Empilhe b primeiro e a depois, para a ficar em [BP+4].
Depois do CALL, ADD SP,4.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 8
        PUSH AX
        MOV  AX, 50
        PUSH AX
        CALL SUBTRAI
        ADD  SP, 4
        MOV  DX, AX

        MOV  AX, 4C00h
        INT  21h

SUBTRAI PROC
        PUSH BP
        MOV  BP, SP
        MOV  AX, [BP+4]
        SUB  AX, [BP+6]
        POP  BP
        RET
SUBTRAI ENDP
END inicio
```

```exercicio
id: a10-3
titulo: Variável local
nivel: 3
--- enunciado
Complete **SOMA_QUADRADOS(n)**: devolve em AX a soma 1² + 2² + ... + n², para n de 1 a 20. Use uma **variável local** em `[BP-2]` como acumulador (não use registradores para acumular). Para o quadrado use `MUL` (AX = AX × operando, o resultado cabe em AX). O procedimento deve preservar BX, CX e DX.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 10
        PUSH AX
        CALL SOMA_QUADRADOS
        MOV  SI, AX          ; SI = 385
        MOV  AX, 4C00h
        INT  21h

SOMA_QUADRADOS PROC
        PUSH BP
        MOV  BP, SP
        ; reserve a local, faça o laço, devolva em AX
        POP  BP
        RET  2
SOMA_QUADRADOS ENDP
END inicio
--- testes
[{ "nome": "n = 10 dá 385", "setup": { "BX": 4369, "CX": 8738, "DX": 13107 }, "espera": { "SI": 385, "preservar": ["BX", "CX", "DX"], "pilhaEquilibrada": true } }]
--- dicas
SUB SP,2 e MOV WORD PTR [BP-2],0 para iniciar o acumulador.
CX = n (de [BP+4]); para cada CX: AX = CX, MUL CX, ADD [BP-2],AX. MUL altera DX!
No fim: MOV AX,[BP-2], restaure os registradores e faça MOV SP,BP antes do POP BP.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 10
        PUSH AX
        CALL SOMA_QUADRADOS
        MOV  SI, AX
        MOV  AX, 4C00h
        INT  21h

SOMA_QUADRADOS PROC
        PUSH BP
        MOV  BP, SP
        SUB  SP, 2
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  WORD PTR [BP-2], 0
        MOV  CX, [BP+4]
@@laco: MOV  AX, CX
        MUL  CX
        ADD  [BP-2], AX
        LOOP @@laco
        MOV  AX, [BP-2]
        POP  DX
        POP  CX
        POP  BX
        MOV  SP, BP
        POP  BP
        RET  2
SOMA_QUADRADOS ENDP
END inicio
```

:::resumo
- O chamador empilha os parâmetros e faz `CALL`; o procedimento monta o quadro com `PUSH BP` / `MOV BP,SP`.
- Parâmetros em `[BP+4]`, `[BP+6]`...; locais em `[BP-2]`, `[BP-4]`... depois de `SUB SP,n`.
- Desmontar: `MOV SP,BP` / `POP BP` / `RET n`.
- Pascal: o procedimento limpa com `RET n`. C: o chamador limpa com `ADD SP,n`.
- Para alterar variáveis do chamador, passe endereços (por referência).
:::
