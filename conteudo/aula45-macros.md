---
id: aula45
numero: 45
modulo: 15
titulo: Macros e montagem condicional
subtitulo: Ensinando o montador a escrever código por você
duracao: 90 min
objetivos: entender que uma macro é uma substituição de texto feita pelo montador, antes de gerar qualquer byte; escrever macros com parâmetros e rótulos LOCAL; comparar macro e PROC em bytes e ciclos; usar &, % e <...> nos argumentos; gerar código e tabelas com REPT, IRP e IRPC; montar versões diferentes do mesmo fonte com IF, IFDEF, IFB e IFIDN
---

## Escrevendo a mesma coisa pela décima vez

Depois de 44 aulas, você já digitou muitas vezes estas três linhas:

```asm fragmento
        MOV  DX, OFFSET mensagem
        MOV  AH, 09h
        INT  21h
```

Um programa de verdade tem dezenas delas. Dá para colocar o trecho num `PROC` e fazer `CALL`, mas aí a mensagem precisa ir num registrador antes, e você continua escrevendo duas linhas por mensagem. O MASM e o TASM têm outra saída: a **macro**. Você dá um nome a um pedaço de código, e o montador copia esse pedaço no lugar de cada uso do nome, trocando os parâmetros.

```asm fragmento
ESCREVA MACRO texto             ; definição: nada é gerado aqui
        MOV  DX, OFFSET texto
        MOV  AH, 09h
        INT  21h
ENDM

        ESCREVA ola             ; vira as três instruções, com "ola"
        ESCREVA tchau           ; e de novo, com "tchau"
```

A palavra mais importante desta aula é **texto**. Uma macro não existe para a CPU: quem trabalha é o montador, que lê a definição, guarda as linhas e, a cada chamada, cola essas linhas no fonte com os parâmetros trocados, como um "localizar e substituir" automático. Só depois disso ele monta as instruções. A CPU recebe as três instruções repetidas e nunca fica sabendo que houve uma macro.

```diagrama titulo="O que o montador faz com uma macro"
  o que você escreve                 o que o montador monta
  ──────────────────────────        ──────────────────────────────
  ESCREVA MACRO texto       ─┐
    MOV DX,OFFSET texto      │ guardado,
    MOV AH,09h               │ nenhum byte
    INT 21h                  │
  ENDM                      ─┘

  ESCREVA ola               ───►    MOV DX,OFFSET ola
                                    MOV AH,09h
                                    INT 21h
  ESCREVA tchau             ───►    MOV DX,OFFSET tchau
                                    MOV AH,09h
                                    INT 21h
```

## A primeira macro

O programa abaixo define duas macros: `ESCREVA`, para mostrar um texto terminado em `$`, e `FIM`, para encerrar o programa com um código de saída. Execute passo a passo com **F7** e repare que o destaque fica parado na linha da chamada enquanto as três instruções rodam: todas elas "nasceram" naquela linha. Abra o programa no laboratório e olhe a aba **CPU**: lá aparecem as instruções de verdade, já expandidas.

```asm executar titulo="MACRO1.ASM: a primeira macro"
.MODEL SMALL
.STACK 100h

ESCREVA MACRO texto
        MOV  DX, OFFSET texto
        MOV  AH, 09h
        INT  21h
ENDM

FIM     MACRO codigo
        MOV  AH, 4Ch
        MOV  AL, codigo
        INT  21h
ENDM

.DATA
ola     DB 'Ola! Este texto veio de uma macro.', 13, 10, '$'
tchau   DB 'E este tambem, com outro parametro.', 13, 10, '$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ESCREVA ola
        ESCREVA tchau
        FIM  0
END inicio
```

Algumas regras que valem para toda macro:

- A definição começa com `nome MACRO parâmetros` e termina com `ENDM`. Ela precisa aparecer **antes** do primeiro uso, porque o montador lê o fonte de cima para baixo. Por isso as macros costumam ficar no começo do arquivo.
- Os parâmetros são separados por vírgula. Na chamada, os argumentos também, e cada um troca o parâmetro da mesma posição. Um argumento que falta vira texto vazio.
- A troca é feita **palavra por palavra**: `texto` é trocado, mas `textos` ou `contexto` não. Dentro de aspas nada é trocado, a não ser com o operador `&`, que veremos adiante.
- Um erro dentro da macro aparece na linha da chamada, com a nota "na expansão da macro ESCREVA". O erro de verdade está no texto que a macro gerou.

:::cpu A CPU não vê a macro
Abra a listagem (aba **Listagem** do laboratório): na linha `ESCREVA ola` aparecem os bytes `BA 00 00 B4 09 CD 21`, sete bytes das três instruções. Na linha da definição, nenhum byte. Uma macro não ocupa memória quando é definida e ocupa memória **toda vez** que é usada. É a diferença central em relação ao `PROC`.
:::

## Macro ou PROC?

As duas formas evitam repetir o fonte, mas geram programas muito diferentes:

| | Macro | PROC + CALL |
|---|---|---|
| Quem faz o trabalho | o montador, antes de montar | a CPU, durante a execução |
| Código gerado | uma cópia em cada uso | uma cópia só |
| Custo em tempo | nenhum além das instruções | `CALL` (19 ciclos) + `RET` (16) a cada uso |
| Parâmetros | qualquer texto: registrador, variável, número, até uma instrução | precisam ir em registradores ou na pilha |
| Rótulos dentro | precisam de `LOCAL` | normais |
| Depuração | o passo a passo fica na linha da chamada | entra no procedimento |

A regra prática da época era: **macro para trechos curtos e muito usados** (duas a cinco instruções, como a chamada de um serviço do DOS), **PROC para tudo que é grande**. Uma macro de 40 bytes usada 30 vezes custa 1.200 bytes, quase dois setores de disquete; o mesmo código num `PROC` custa 40 bytes mais 3 por `CALL`.

Compare as duas versões de uma rotina que dobra AX e soma 1, usada três vezes:

```widget comparar
{ "titulo": "Macro (cópias) x PROC (CALL e RET)", "a": "DOBRA1 MACRO\n SHL AX,1\n INC AX\nENDM\n DOBRA1\n DOBRA1\n DOBRA1", "b": " CALL dobra\n CALL dobra\n CALL dobra\n JMP fim\ndobra: SHL AX,1\n INC AX\n RET\nfim: NOP", "setup": { "AX": 1 }, "altura": 9 }
```

A macro ganha em ciclos com folga e, aqui, até em bytes, porque o corpo é minúsculo. Faça a conta para um corpo de 20 bytes e veja o `PROC` ganhar.

:::atencao Uma macro esconde o que ela estraga
`ESCREVA ola` parece inocente, mas muda **AH e DX**. Quem lê só a chamada não vê isso. Em programas de verdade, escreva no comentário da macro quais registradores ela altera, ou faça a macro salvar e restaurar o que usa com `PUSH` e `POP`.
:::

## Parâmetros são texto

Como a troca é textual, o argumento pode ser qualquer coisa que faça sentido no lugar do parâmetro: um registrador, uma variável, uma constante, uma expressão com colchetes.

```asm fragmento
ZERA    MACRO destino           ; ZERA AX, ZERA contador, ZERA [BX+2]
        MOV  destino, 0
ENDM

        ZERA AX                 ; MOV AX, 0
        ZERA contador           ; MOV contador, 0
        ZERA WORD PTR [BX+2]    ; MOV WORD PTR [BX+2], 0
```

Repare no último: `ZERA [BX+2]` geraria `MOV [BX+2],0`, que o montador recusa porque não sabe se é byte ou word. A macro não pensa por você: ela só cola o texto, e o erro aparece como se você tivesse escrito a instrução à mão.

Quando o argumento tem vírgulas ou espaços, envolva-o com `<` e `>`. O montador tira os sinais e passa o conteúdo inteiro como um argumento só:

```asm fragmento
TABELA  MACRO nome, valores
nome    DB valores
ENDM

        TABELA primos, <2, 3, 5, 7, 11>    ; primos DB 2, 3, 5, 7, 11
```

## Rótulos dentro de macros: LOCAL

Esta macro guarda em `destino` o maior de dois valores sem sinal:

```asm fragmento
MAIOR   MACRO destino, fonte
        CMP  destino, fonte
        JAE  pronto
        MOV  destino, fonte
pronto:
ENDM
```

Use uma vez e funciona. Use duas, e o montador reclama: `Símbolo "PRONTO" definido mais de uma vez`. Cada expansão cola o rótulo `pronto:` de novo. A solução é a diretiva `LOCAL`, logo depois da linha `MACRO`. Ela troca cada nome listado por um nome novo a cada expansão: `??0000`, `??0001`, `??0002`...

```asm executar titulo="LOCAL.ASM: o maior de quatro números"
MAIOR   MACRO destino, fonte
        LOCAL pronto
        CMP  destino, fonte
        JAE  pronto
        MOV  destino, fonte
pronto:
ENDM

        MOV  AX, 12
        MOV  BX, 40
        MOV  CX, 7
        MOV  DX, 33
        MAIOR AX, BX            ; ??0000
        MAIOR AX, CX            ; ??0001
        MAIOR AX, DX            ; ??0002: no fim, AX = 40
```

:::dica Onde estão os rótulos ??0000
No laboratório, a aba **Variáveis** e a desmontagem na aba **CPU** mostram os endereços, mas os nomes `??nnnn` são internos. É por isso que o MASM escolheu o prefixo `??`: ninguém usaria um nome assim de propósito.
:::

## Os operadores &, % e !

### & cola texto ao parâmetro

Às vezes o parâmetro é só **parte** de um nome. `msg_&n` com `n = 2` vira `msg_2`. O `&` marca onde o nome do parâmetro termina e some no resultado. Dentro de aspas, ele é a única forma de trocar um parâmetro: `'Erro &n&'` vira `'Erro 2'`.

```asm executar titulo="AMPERSAND.ASM: escolhendo a mensagem pelo número"
.MODEL SMALL
.STACK 100h

MOSTRA  MACRO n
        MOV  DX, OFFSET msg_&n
        MOV  AH, 09h
        INT  21h
ENDM

.DATA
msg_1   DB 'um ', '$'
msg_2   DB 'dois ', '$'
msg_3   DB 'tres', 13, 10, '$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOSTRA 3
        MOSTRA 1
        MOSTRA 2
        MOV  AX, 4C00h
        INT  21h
END inicio
```

### % passa o valor de uma expressão

Normalmente o argumento é passado como está: `MOSTRA 1+1` colaria `msg_1+1`, que não existe. Com `%` antes do argumento, o montador calcula a expressão (que precisa ser constante) e passa o número: `MOSTRA %1+1` vira `MOSTRA 2`.

### ! protege um caractere

Dentro de `<...>`, um `!` faz o caractere seguinte valer literalmente: `<a!>b>` é o texto `a>b`. Quase nunca é preciso.

## Repetições: REPT, IRP e IRPC

Três diretivas repetem um bloco **sem** precisar definir uma macro com nome. Todas terminam com `ENDM`.

| Diretiva | Repete | Exemplo |
|---|---|---|
| `REPT n` | n vezes | `REPT 4` / `SHL AX,1` / `ENDM` vira quatro `SHL AX,1` |
| `IRP p,<a,b,c>` | uma vez para cada item, com `p` trocado pelo item | `IRP r,<AX,BX,CX>` / `PUSH r` / `ENDM` |
| `IRPC p,texto` | uma vez para cada caractere | `IRPC c,123` / `ADD AX,c` / `ENDM` |

O `REPT` é perfeito para **tabelas calculadas na montagem**. Um nome definido com `=` pode ser redefinido, e cada linha usa o valor do momento em que foi lida: é um contador que anda junto com a repetição.

```asm executar titulo="TABELAS.ASM: quadrados e potências de 2 sem digitar nenhum"
.MODEL SMALL
.STACK 100h
.DATA
quadrados LABEL WORD
i = 0
REPT 16
        DW   i*i
        i = i + 1
ENDM

potencias LABEL WORD
p = 1
REPT 16
        DW   p
        p = p SHL 1
ENDM
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CX, quadrados+2*12     ; CX = 12² = 144
        MOV  BX, potencias+2*10     ; BX = 2^10 = 1024
        MOV  AX, 4C00h
        INT  21h
END inicio
```

`quadrados LABEL WORD` dá um nome e um tipo ao endereço onde a tabela começa, já que o `REPT` gera várias linhas `DW` sem nome. Olhe a aba **Variáveis** depois de executar: 16 words prontas, e nenhuma digitada à mão.

:::atencao EQU não serve de contador
`i EQU 0` não pode ser redefinido. Para um contador de montagem use sempre `=`.
:::

O `IRP` resolve um incômodo antigo: salvar e restaurar vários registradores na ordem certa.

```asm fragmento
SALVA   MACRO
        IRP  r, <AX, BX, CX, DX, SI, DI>
        PUSH r
        ENDM
ENDM

RESTAURA MACRO                  ; ordem inversa: a pilha é LIFO
        IRP  r, <DI, SI, DX, CX, BX, AX>
        POP  r
        ENDM
ENDM
```

:::cpu Nada disso existe no 80186
O 80186 ganhou `PUSHA` e `POPA`, que salvam todos os registradores numa instrução só. No 8086, a macro `SALVA` é a forma de ter a mesma comodidade no fonte. O custo continua o mesmo de antes: um `PUSH` de 11 ciclos e um `POP` de 8 por registrador.
:::

## Montagem condicional

Às vezes você quer **duas versões** do mesmo programa: uma com mensagens de depuração e outra sem, uma para .COM e outra para .EXE, uma que usa o 8087 e outra que não. As diretivas `IF` escolhem, na hora da montagem, quais linhas entram:

```asm fragmento
DEPURA  EQU 1                   ; troque para 0 na versão final

        IF DEPURA
        ESCREVA msg_depuracao   ; só entra se DEPURA for diferente de 0
        ENDIF
```

As linhas do lado falso do `IF` **não são montadas**: não geram bytes nem erros (a não ser de estrutura, como um `ENDIF` faltando). A expressão precisa ser **constante** no ponto em que o `IF` aparece. Rótulos que ainda vão ser definidos mais à frente não servem.

| Diretiva | Monta o bloco se... |
|---|---|
| `IF expr` / `IFE expr` | a expressão é diferente de 0 / igual a 0 |
| `IFDEF nome` / `IFNDEF nome` | o símbolo (ou macro) já foi definido / ainda não |
| `IFB <arg>` / `IFNB <arg>` | o argumento está vazio / não está |
| `IFIDN <a>,<b>` / `IFDIF <a>,<b>` | os dois textos são iguais / diferentes (`IFIDNI` e `IFDIFI` ignoram maiúsculas) |
| `ELSE` | o bloco anterior não foi montado |
| `ENDIF` | fecha o `IF` |

Para escrever as condições existem os operadores `EQ`, `NE`, `LT`, `LE`, `GT` e `GE`. Eles valem `0FFFFh` (verdadeiro) ou `0` (falso), e podem ser combinados com `AND`, `OR` e `NOT`: `IF (VERSAO GE 2) AND DEPURA`.

### IF dentro de macros

A montagem condicional fica realmente poderosa dentro de macros, porque a condição pode olhar os **argumentos**:

```asm executar titulo="CONDICIONAL.ASM: macros que se adaptam ao argumento"
; CARREGA reg, valor: escolhe a forma mais curta
CARREGA MACRO reg, valor
        IFB <valor>
        XOR  reg, reg           ; sem valor: zera (2 bytes)
        ELSE
        IF valor EQ 0
        XOR  reg, reg           ; zero também: 2 bytes em vez de 3
        ELSE
        MOV  reg, valor
        ENDIF
        ENDIF
ENDM

; EMPILHA reg: não faz nada com AX (por exemplo, porque AX é o retorno)
EMPILHA MACRO reg
        IFDIFI <reg>, <AX>
        PUSH reg
        ENDIF
ENDM

        CARREGA AX              ; XOR AX,AX
        CARREGA BX, 0           ; XOR BX,BX
        CARREGA CX, 1234h       ; MOV CX,1234h
        EMPILHA AX              ; nada
        EMPILHA BX              ; PUSH BX
        POP  DX
```

Veja na aba **Listagem** do laboratório os bytes de cada chamada: `CARREGA BX, 0` gera `33 DB` (2 bytes), e `EMPILHA AX` não gera nada.

### EXITM e macros que chamam macros

`EXITM` encerra a expansão na hora, ignorando o resto do corpo. Uma macro pode chamar outra, e até a si mesma, desde que alguma condição pare a recursão. O exemplo clássico calcula um fatorial **montando** uma multiplicação por fator:

```asm executar titulo="FATORIAL.ASM: recursão na hora da montagem"
FAT     MACRO n
        IF n LE 1
        MOV  AX, 1
        EXITM
        ENDIF
        FAT  %n-1               ; primeiro gera o código de (n-1)!
        MOV  BX, n
        MUL  BX                 ; depois multiplica por n
ENDM

        FAT  6                  ; AX = 720
```

`FAT 6` expande para `FAT 5`, que expande para `FAT 4`... até `FAT 1`, que gera `MOV AX,1`. O `%n-1` é indispensável: sem ele, o argumento seria o texto `6-1`, depois `6-1-1`, e assim por diante (funcionaria nas contas do `IF`, mas a listagem ficaria ilegível). Se a condição de parada falhar, o montador desiste depois de 40 níveis com uma mensagem clara, em vez de ficar preso.

:::anos90 Bibliotecas de macros
Todo programador de MASM tinha o seu arquivo `MACROS.INC`, incluído no começo de cada programa com `INCLUDE MACROS.INC`. Os livros da época, como os de Peter Norton e Ray Duncan, traziam páginas de macros para os serviços do DOS (`@DosCall`, `@Exit`, `@PrintStr`). O MASM 5.1 vinha com `DOS.INC` e `BIOS.INC`, e o MASM 6 foi além, com `.IF`, `.WHILE` e `INVOKE`, que fazem o montador parecer uma linguagem de alto nível. No simulador do curso não há arquivos para incluir: cole as macros no começo do programa.
:::

## Montagem condicional sem macro: duas versões do mesmo programa

Um último exemplo, que junta tudo: um programa que pode ser montado como .COM ou como .EXE trocando uma constante. Mude `COMO_COM` para 1 e execute de novo.

```asm executar titulo="VERSOES.ASM: um fonte, dois formatos"
COMO_COM EQU 0

        IF COMO_COM
.MODEL TINY
.CODE
        ORG  100h
inicio: JMP  comeco
        ELSE
.MODEL SMALL
.STACK 100h
.DATA
        ENDIF

msg     DB 'Montado como '
        IF COMO_COM
        DB '.COM', 13, 10, '$'
        ELSE
        DB '.EXE', 13, 10, '$'
.CODE
inicio:
        ENDIF

comeco:
        IFE COMO_COM
        MOV  AX, @DATA          ; só um .EXE precisa ajustar DS
        MOV  DS, AX
        ENDIF
        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```quiz
? O que acontece com o código de uma macro que foi definida mas nunca chamada?
- Ele é montado uma vez, como um PROC
+ Nada: a definição não gera nenhum byte
- Ele fica no fim do segmento de código
> A definição só ensina o montador. Bytes aparecem a cada chamada, e só nela.

? Uma macro com um rótulo dentro foi chamada duas vezes, e o montador acusou "símbolo definido mais de uma vez". Como resolver?
- Trocando a macro por REPT
+ Declarando o rótulo com LOCAL logo depois da linha MACRO
- Usando um rótulo @@
> LOCAL dá um nome novo (??0000, ??0001...) ao rótulo em cada expansão.

? A macro `ZERA MACRO d` / `MOV d,0` foi chamada como `ZERA [SI]`. O que acontece?
- O montador escolhe word, porque é o padrão
- A macro gera MOV BYTE PTR [SI],0
+ Erro de tamanho: a instrução gerada é MOV [SI],0, sem BYTE PTR nem WORD PTR
> A macro só cola texto. A instrução gerada tem os mesmos problemas que teria se você a tivesse digitado.

? Qual a diferença entre `MOSTRA 1+1` e `MOSTRA %1+1`?
+ O primeiro passa o texto "1+1"; o segundo passa o valor 2
- Nenhuma: o montador sempre calcula expressões
- O segundo é um comentário
> % pede ao montador que calcule a expressão (constante) e passe o número como texto.

? Por que o contador de um REPT é definido com `=` e não com EQU?
- Porque EQU é mais lento
+ Porque um nome definido com = pode ser redefinido, e cada linha usa o valor daquele momento
- Porque EQU não aceita multiplicação
> EQU define uma constante que não muda. O = permite i = i + 1 dentro da repetição.

? Num programa de 30 chamadas a uma rotina de 40 bytes, por que um PROC costuma ser melhor que uma macro?
- Porque o CALL é mais rápido que o código copiado
+ Porque a macro copiaria 40 bytes 30 vezes (1.200 bytes), e o PROC ocupa 40 bytes mais 3 por CALL
- Porque macros não podem ter mais de 10 linhas
> Macro troca memória por velocidade. Para corpos grandes, a memória pesa mais.
```

## Exercícios

```exercicio
id: a45-1
titulo: A macro MAIOR
nivel: 1
--- enunciado
O programa já chama a macro `MAIOR` três vezes para deixar em AX o maior de AX, BX, CX e DX (sem sinal). Escreva o **corpo** da macro: se `fonte` for maior que `destino`, copie `fonte` para `destino`.

Como a macro é usada três vezes, o rótulo de dentro dela precisa ser `LOCAL`.
--- inicial
MAIOR   MACRO destino, fonte
        ; escreva aqui: CMP, um salto e um MOV
ENDM

        MAIOR AX, BX
        MAIOR AX, CX
        MAIOR AX, DX
--- testes
[{ "nome": "o maior está em BX", "setup": { "AX": 10, "BX": 50, "CX": 20, "DX": 30 }, "espera": { "AX": 50, "BX": 50 } },
 { "nome": "o maior está em DX", "setup": { "AX": 1, "BX": 2, "CX": 3, "DX": 60000 }, "espera": { "AX": 60000 } },
 { "nome": "o maior já está em AX", "setup": { "AX": 900, "BX": 100, "CX": 899, "DX": 0 }, "espera": { "AX": 900 } },
 { "nome": "sem sinal: 8000h é grande", "setup": { "AX": 5, "BX": 32768, "CX": 7, "DX": 9 }, "espera": { "AX": 32768 } }]
--- dicas
O corpo tem quatro linhas: LOCAL, CMP destino,fonte, um salto condicional e MOV destino,fonte, mais o rótulo.
Sem sinal, "maior ou igual" é JAE. Se destino >= fonte, salte o MOV.
A segunda linha da macro deve ser LOCAL pronto (ou o nome que você der ao rótulo).
--- solucao
MAIOR   MACRO destino, fonte
        LOCAL pronto
        CMP  destino, fonte
        JAE  pronto
        MOV  destino, fonte
pronto:
ENDM

        MAIOR AX, BX
        MAIOR AX, CX
        MAIOR AX, DX
```

```exercicio
id: a45-2
titulo: Tabela de cubos com REPT
nivel: 2
--- enunciado
Preencha a tabela `cubos` com os cubos de 0 a 9 (0, 1, 8, 27, ..., 729), uma word para cada, **gerada pelo montador** com `REPT` e um contador definido com `=`.

O código do programa não precisa fazer nada além de terminar: o teste confere a memória.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
cubos   DW 10 DUP(0)            ; troque por um REPT
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "cubos de 0 a 9", "espera": { "mem": { "cubos": [0, 1, 8, 27, 64, 125, 216, 343, 512, 729] } } }]
--- dicas
Comece com cubos LABEL WORD, para o nome apontar para o início da tabela.
Depois: n = 0, REPT 10, DW n*n*n, n = n + 1, ENDM.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
cubos   LABEL WORD
n = 0
REPT 10
        DW   n*n*n
        n = n + 1
ENDM
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a45-3
titulo: PREENCHE com valor padrão
nivel: 3
--- enunciado
Escreva a macro `PREENCHE n, valor`, que grava `n` bytes iguais a `valor` a partir de ES:DI (DI avança, como no `STOSB`). Se `valor` não for informado, ela deve gravar **zeros**.

O programa já chama `PREENCHE 4, '*'` e depois `PREENCHE 3`. Com o buffer cheio de `x`, ele deve terminar com `****` seguido de três zeros e do resto dos `x`.
--- inicial
.MODEL SMALL
.STACK 100h

PREENCHE MACRO n, valor
        ; use IFB <valor> para escolher entre valor e 0
ENDM

.DATA
buf     DB 10 DUP('x')
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        CLD
        MOV  DI, OFFSET buf
        PREENCHE 4, '*'
        PREENCHE 3
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "4 asteriscos e 3 zeros", "espera": { "mem": { "buf": [42, 42, 42, 42, 0, 0, 0, 120, 120, 120] } } },
 { "nome": "buffer começando diferente", "setup": { "buf": "abcdefghij" }, "espera": { "mem": { "buf": [42, 42, 42, 42, 0, 0, 0, 104, 105, 106] } } }]
--- dicas
O trabalho é MOV CX,n / REP STOSB, com AL valendo o byte a gravar.
Antes disso: IFB <valor> / MOV AL,0 / ELSE / MOV AL,valor / ENDIF.
Os sinais < e > em volta de valor são obrigatórios no IFB.
--- solucao
.MODEL SMALL
.STACK 100h

PREENCHE MACRO n, valor
        IFB  <valor>
        MOV  AL, 0
        ELSE
        MOV  AL, valor
        ENDIF
        MOV  CX, n
        REP  STOSB
ENDM

.DATA
buf     DB 10 DUP('x')
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        CLD
        MOV  DI, OFFSET buf
        PREENCHE 4, '*'
        PREENCHE 3
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## No livro

O [Capítulo 19](livro:cap19) do livro da BIOS reúne as diretrizes de compatibilidade da IBM. Muitas delas, como "não dependa da velocidade do processador" e "use os serviços em vez dos endereços", eram justamente o que as bibliotecas de macros da época tentavam padronizar.

:::resumo
- Uma **macro** é texto: o montador guarda o corpo entre `MACRO` e `ENDM` e cola uma cópia, com os parâmetros trocados, em cada chamada. A definição não gera bytes; cada chamada gera todos.
- **Macro** para trechos curtos e frequentes (sem `CALL`/`RET`, mais rápida, mais bytes); **PROC** para rotinas grandes.
- Rótulos dentro de macros precisam de **LOCAL**, que gera nomes únicos (`??0000`...).
- `&` cola o parâmetro a outro texto (e funciona dentro de aspas), `%expr` passa o valor calculado, `<...>` agrupa um argumento com vírgulas.
- **REPT n**, **IRP p,<lista>** e **IRPC p,texto** repetem um bloco. Com um contador definido com `=`, geram tabelas na montagem.
- **IF/IFE/IFDEF/IFNDEF/IFB/IFNB/IFIDN/IFDIF**, com `ELSE` e `ENDIF`, escolhem as linhas montadas. `EQ`, `NE`, `LT`, `LE`, `GT` e `GE` comparam constantes. `EXITM` encerra uma expansão.
- Documente quais registradores cada macro altera: quem lê a chamada não vê.
:::
