---
id: aula11
numero: 11
modulo: 4
titulo: Recursão e programas DOS completos
subtitulo: Procedimentos que chamam a si mesmos e a sua própria biblioteca de rotinas
duracao: 70 min
objetivos: entender como a pilha torna a recursão possível; escrever fatorial e potência recursivos; medir quanto de pilha uma recursão consome; imprimir números decimais com IMPRIMIR_NUMERO; organizar um programa DOS completo com procedimentos reutilizáveis e código de saída
---

## Um procedimento que chama a si mesmo

Na Aula 9 vimos que o `CALL` guarda o endereço de retorno na pilha. Na Aula 10, que cada chamada pode ter o seu próprio quadro de pilha. Junte as duas coisas e surge uma consequência poderosa: **um procedimento pode chamar a si mesmo**, porque cada chamada guarda seus dados em uma região diferente da pilha. Isso é a **recursão**.

O exemplo clássico é o fatorial:

| n | n! | definição |
|---|----|-----------|
| 0 ou 1 | 1 | caso base |
| n > 1 | n × (n−1)! | caso recursivo |

Toda recursão precisa de duas partes:

1. Um **caso base**, que responde sem chamar ninguém. Sem ele, a recursão nunca termina e a pilha transborda.
2. Um **caso recursivo**, que resolve um problema menor chamando a si mesmo e combina o resultado.

```asm executar titulo="FATORIA.ASM: fatorial recursivo"
; Calcula 6! = 720 de forma recursiva.
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 6
        CALL FATORIAL       ; AX = 720 (2D0h)
        MOV  AX, 4C00h
        INT  21h

; FATORIAL: entrada AX = n; saída AX = n!  (destrói BX e DX)
FATORIAL PROC
        CMP  AX, 1
        JBE  @@base         ; n <= 1: caso base
        PUSH AX             ; guarda n desta chamada
        DEC  AX             ; AX = n - 1
        CALL FATORIAL       ; AX = (n-1)!
        POP  BX             ; BX = n desta chamada
        MUL  BX             ; DX:AX = (n-1)! * n
        RET
@@base: MOV  AX, 1
        RET
FATORIAL ENDP
END inicio
```

Execute com **▶ Executar aqui** e avance com F8 (passo a passo). Observe o painel da pilha crescer a cada `CALL` e encolher a cada `RET`.

## O que acontece na pilha

Cada chamada empilha dois words: o `n` daquela chamada (pelo `PUSH AX`) e o endereço de retorno (pelo `CALL`). No momento mais fundo, calculando `FATORIAL(1)`, a pilha guarda todas as chamadas pendentes:

```diagrama titulo="A pilha no fundo da recursão de FATORIAL(6)"
            ┌──────────────┐
            │  retorno     │  CALL do programa principal
            │  n = 6       │
            │  retorno     │  FATORIAL(6) chamou FATORIAL(5)
            │  n = 5       │
            │  retorno     │
            │  n = 4       │
            │  retorno     │
            │  n = 3       │
            │  retorno     │
            │  n = 2       │
  SP  ──►   │  retorno     │  FATORIAL(2) chamou FATORIAL(1)
            └──────────────┘
   FATORIAL(1) responde 1 e a pilha começa a ser desfeita:
   2×1=2, 3×2=6, 4×6=24, 5×24=120, 6×120=720
```

Repare na ordem: **a ida empilha, a volta calcula**. Quando FATORIAL(1) responde, cada `RET` volta para uma chamada pendente, que faz `POP BX` para recuperar o seu próprio `n` e multiplica.

:::cpu Quanto de pilha uma recursão gasta
Aqui cada nível consome 4 bytes (n + retorno). Com quadro de pilha (`PUSH BP`) e registradores salvos, facilmente passa de 10 bytes por nível. Com `.STACK 100h` (256 bytes), uma recursão com 20 bytes por nível transborda depois de uns 12 níveis. O 8086 **não avisa** quando a pilha transborda: SP simplesmente continua descendo e sobrescreve o que estiver embaixo, geralmente os seus dados. O laboratório deste curso avisa, mas um PC de verdade não.
:::

:::atencao O limite de 16 bits
`MUL BX` produz o resultado em `DX:AX`, mas o nosso fatorial devolve só AX. 8! = 40.320 ainda cabe em 16 bits; 9! = 362.880 não cabe. Toda rotina numérica tem um domínio de validade, e documentar esse domínio no comentário do procedimento é parte do trabalho.
:::

## Recursão ou laço?

Todo fatorial recursivo pode ser escrito com um laço, e no 8086 o laço quase sempre ganha: não gasta pilha nem ciclos com `CALL`/`RET` (19 + 8 ciclos por nível, no mínimo). Então para que serve a recursão?

- Para problemas **naturalmente recursivos**: percorrer árvores, diretórios e subdiretórios (como o comando `TREE` do DOS), avaliar expressões com parênteses, preencher regiões de uma imagem (o "balde de tinta" dos editores de desenho), ordenar com Quicksort.
- Para entender **como os compiladores trabalham**: em C e Pascal, cada chamada de função gera exatamente esse código.

```asm fragmento
; A versão com laço: mais rápida e sem risco para a pilha
        MOV  CX, AX         ; CX = n (n >= 1)
        MOV  AX, 1
@@laco: MUL  CX             ; AX = AX * CX
        LOOP @@laco
```

:::anos90 O Quicksort e a pilha de 2 KB
Em 1992, um programador de jogos que ordenava a lista de sprites com Quicksort recursivo descobria, no pior caso, que a recursão podia chegar a centenas de níveis. Com a pilha pequena dos programas `.COM` e `.EXE` da época, o resultado era travamento aleatório, difícil de reproduzir. O truque clássico: fazer a chamada recursiva **só para a metade menor** e tratar a maior com um laço. Assim a profundidade nunca passa de log₂(n).
:::

```quiz
? Toda recursão precisa de quê para terminar?
- De um LOOP no final
+ De um caso base que responde sem chamar a si mesmo
- De um RET n
> Sem caso base, cada chamada faz outra chamada, a pilha cresce sem parar e acaba sobrescrevendo dados ou código.

? Na rotina FATORIAL desta aula, quantos bytes de pilha cada nível de chamada consome?
- 2
+ 4
- 6
> PUSH AX empilha 2 bytes e CALL near empilha mais 2 (o IP de retorno).

? O que o 8086 faz quando a pilha transborda?
- Gera a interrupção 0
- Para a execução com uma mensagem
+ Nada: SP continua descendo e sobrescreve a memória abaixo
> O 8086 não tem proteção de memória. Só o 80286 em modo protegido passou a detectar esse tipo de erro.

? Por que FATORIAL faz POP BX depois do CALL recursivo?
+ Para recuperar o n daquela chamada, que foi empilhado antes da chamada
- Para remover o endereço de retorno
- Para equilibrar o PUSH BP
> Cada nível guarda o seu n na pilha. Depois que a chamada interna volta, o POP devolve o n certo daquele nível.

? Qual a principal desvantagem da recursão em relação a um laço no 8086?
- Ela não funciona com números grandes
- Ela exige o 80186
+ Gasta pilha e ciclos de CALL/RET a cada nível
> O laço faz o mesmo cálculo sem empilhar nada. A recursão compensa quando o problema tem forma de árvore.
```

## Imprimindo números em decimal

Até agora mostramos resultados com dígitos isolados ou em hexadecimal no depurador. Um programa de verdade precisa escrever `720` na tela. O problema: o DOS só sabe imprimir **caracteres**. Precisamos converter o número em dígitos ASCII.

O algoritmo usa divisões sucessivas por 10:

```diagrama titulo="Convertendo 720 em texto"
  720 ÷ 10 = 72  resto 0   ──► dígito '0' (o último)
   72 ÷ 10 =  7  resto 2   ──► dígito '2'
    7 ÷ 10 =  0  resto 7   ──► dígito '7' (o primeiro)
  quociente 0: fim
```

Os dígitos saem **de trás para frente**. A pilha resolve isso de graça: empilhamos cada resto e depois desempilhamos na ordem certa.

```asm executar titulo="NUMERO.ASM: IMPRIMIR_NUMERO"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 720
        CALL IMPRIMIR_NUMERO
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_NUMERO: imprime AX (0..65535) em decimal. Preserva tudo.
IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX         ; CX conta os dígitos
@@divide:
        XOR  DX, DX         ; DX:AX / BX  (DX precisa ser 0!)
        DIV  BX             ; AX = quociente, DX = resto (0..9)
        PUSH DX             ; guarda o dígito
        INC  CX
        TEST AX, AX
        JNZ  @@divide       ; continua enquanto sobrar quociente
@@mostra:
        POP  DX
        ADD  DL, '0'        ; 0..9 -> '0'..'9'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP
END inicio
```

Três detalhes que fazem essa rotina funcionar sempre:

- **`XOR DX,DX` antes de cada `DIV`.** `DIV BX` divide `DX:AX`, e não só AX. Se DX tivesse lixo, o quociente não caberia em 16 bits e o 8086 dispararia a interrupção 0 ("Divide overflow").
- **O laço testa o quociente depois de dividir**, então o número 0 imprime "0" (um dígito), e não uma string vazia.
- **CX nunca é 0 no `LOOP`**, porque pelo menos um dígito foi empilhado. Lembre da Aula 7: `LOOP` com CX=0 rodaria 65.536 vezes.

:::dica Uma rotina para a vida toda
`IMPRIMIR_NUMERO` vai aparecer em quase todos os programas daqui para frente. Guarde-a. Nos anos 90 cada programador tinha um arquivo `ROTINAS.ASM` com dezenas de procedimentos assim, incluído nos projetos com a diretiva `INCLUDE ROTINAS.ASM` do MASM e do TASM.
:::

## A versão recursiva

A mesma impressão pode ser escrita com recursão: "para imprimir 720, imprima 72 e depois o dígito 0". O caso base é um número menor que 10.

```asm executar titulo="NUMREC.ASM: impressão recursiva"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 4096
        CALL IMPRIMIR_REC
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_REC: imprime AX em decimal (destrói AX, BX e DX)
IMPRIMIR_REC PROC
        XOR  DX, DX
        MOV  BX, 10
        DIV  BX             ; AX = n / 10, DX = último dígito
        PUSH DX             ; guarda o último dígito
        TEST AX, AX
        JZ   @@escreve      ; não sobrou nada à esquerda: caso base
        CALL IMPRIMIR_REC   ; imprime os dígitos da esquerda
@@escreve:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        RET
IMPRIMIR_REC ENDP
END inicio
```

Compare as duas versões. Na primeira, a pilha guarda os dígitos de forma explícita. Na segunda, cada nível de chamada guarda um dígito, e a ordem de volta das chamadas é a ordem de impressão. É a mesma ideia, com a pilha trabalhando por baixo.

## Anatomia de um programa DOS completo

Com procedimentos, um programa assembly ganha a mesma organização de um programa em Pascal. Este é o esqueleto que vamos usar daqui para frente:

```asm executar titulo="MODELO.ASM: esqueleto de programa"
; ------------------------------------------------------------
; MODELO.ASM - esqueleto de programa DOS (.EXE, modelo SMALL)
; Monte com:  MASM MODELO;   LINK MODELO;
;        ou:  TASM MODELO    TLINK MODELO
; ------------------------------------------------------------
.MODEL SMALL
.STACK 200h

.DATA
titulo  DB 'Tabela de fatoriais', 13, 10, '$'
igual   DB '! = $'
novalin DB 13, 10, '$'

.CODE
principal PROC
        MOV  AX, @DATA      ; DS aponta para os nossos dados
        MOV  DS, AX

        MOV  DX, OFFSET titulo
        CALL ESCREVER

        MOV  CX, 1          ; n = 1..8
@@laco: MOV  AX, CX
        CALL IMPRIMIR_NUMERO
        MOV  DX, OFFSET igual
        CALL ESCREVER
        MOV  AX, CX
        CALL FATORIAL
        CALL IMPRIMIR_NUMERO
        MOV  DX, OFFSET novalin
        CALL ESCREVER
        INC  CX
        CMP  CX, 8
        JBE  @@laco

        MOV  AX, 4C00h      ; termina com código de saída 0
        INT  21h
principal ENDP

; ESCREVER: imprime a string terminada em '$' apontada por DS:DX
ESCREVER PROC
        PUSH AX
        MOV  AH, 09h
        INT  21h
        POP  AX
        RET
ESCREVER ENDP

; FATORIAL: AX = n (0..8) -> AX = n!  (preserva BX, CX e DX)
FATORIAL PROC
        PUSH BX
        PUSH DX
        CALL FAT_REC
        POP  DX
        POP  BX
        RET
FATORIAL ENDP

FAT_REC PROC
        CMP  AX, 1
        JBE  @@base
        PUSH AX
        DEC  AX
        CALL FAT_REC
        POP  BX
        MUL  BX
        RET
@@base: MOV  AX, 1
        RET
FAT_REC ENDP

; IMPRIMIR_NUMERO: imprime AX (0..65535) em decimal. Preserva tudo.
IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        TEST AX, AX
        JNZ  @@divide
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP

        END principal
```

Repare na organização:

- **Cabeçalho em comentário** com nome do arquivo, propósito e como montar. Nos anos 90 não havia controle de versão; o cabeçalho era a documentação.
- **Programa principal curto**, que só chama procedimentos.
- **Cada procedimento documenta** entrada, saída e quais registradores destrói ou preserva. Esse "contrato" é o que permite reaproveitar a rotina sem reler o código.
- **Um procedimento "embrulho"** (`FATORIAL`) que salva registradores e chama a parte recursiva (`FAT_REC`). Assim a recursão fica simples e quem chama não perde nada.
- **`END principal`** diz ao montador onde o programa começa.

## Código de saída e ERRORLEVEL

O valor de AL na chamada `AH=4Ch` é o **código de saída** do programa. O DOS o guarda e os arquivos `.BAT` podem testá-lo com `IF ERRORLEVEL`:

```asm fragmento
        MOV  AH, 4Ch
        MOV  AL, 2          ; código de saída 2
        INT  21h
```

```diagrama titulo="Usando o código de saída em um .BAT"
  @ECHO OFF
  CONFERE.EXE
  IF ERRORLEVEL 2 GOTO GRAVE
  IF ERRORLEVEL 1 GOTO AVISO
  ECHO Tudo certo!
  GOTO FIM
  :GRAVE
  ECHO Erro grave!
  :AVISO
  ...
  :FIM
```

:::atencao IF ERRORLEVEL testa "maior ou igual"
`IF ERRORLEVEL 1` é verdadeiro para 1, 2, 3... Por isso os `.BAT` sempre testavam do maior código para o menor. Por convenção, 0 significa sucesso.
:::

```quiz
? Por que IMPRIMIR_NUMERO faz XOR DX,DX antes de cada DIV BX?
- Para zerar o dígito anterior
+ Porque DIV BX divide DX:AX, e lixo em DX pode estourar o quociente
- Porque DIV só funciona com DX = 0 em qualquer caso
> DIV com operando de 16 bits divide o número de 32 bits DX:AX. Se o quociente não couber em AX, o 8086 gera a interrupção 0.

? Por que os dígitos são empilhados em vez de impressos na hora?
+ Porque as divisões por 10 produzem os dígitos do último para o primeiro
- Porque INT 21h não pode ser chamada dentro de um laço
- Para economizar registradores
> 720 gera 0, depois 2, depois 7. A pilha inverte a ordem.

? Com o laço "divide, empilha, testa quociente", o que IMPRIMIR_NUMERO imprime para AX = 0?
- Nada
+ "0"
- "65536"
> A primeira divisão acontece antes do teste, então pelo menos um dígito (0) é empilhado e CX vale 1.

? O que o valor de AL faz na chamada INT 21h com AH = 4Ch?
- Escolhe o modo de vídeo ao sair
+ É o código de saída, que um .BAT lê com IF ERRORLEVEL
- Indica quantos bytes liberar da memória
> O código de saída permite que scripts reajam ao resultado do programa. 0 é sucesso por convenção.

? Para que serve um procedimento "embrulho" como FATORIAL, que salva registradores e chama FAT_REC?
- Para tornar o código mais rápido
+ Para salvar os registradores uma vez só, sem repetir isso em cada nível da recursão
- Porque o 8086 não permite PUSH dentro de um procedimento recursivo
> Salvar BX e DX em cada nível gastaria mais pilha e ciclos. O embrulho protege quem chama, e a parte recursiva fica enxuta.
```

## Exercícios

```exercicio
id: a11-1
titulo: Soma recursiva
nivel: 2
exigir: CALL
proibir: LOOP
--- enunciado
Escreva o procedimento recursivo **SOMA_ATE**, que recebe **n** em AX e devolve em AX a soma **1 + 2 + ... + n** (e 0 quando n = 0). Use a definição recursiva: SOMA_ATE(n) = n + SOMA_ATE(n − 1). O valor de n já chega em AX quando o programa começa.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        ; AX já contém n
        CALL SOMA_ATE
        MOV  DX, AX         ; resultado em DX
        MOV  AX, 4C00h
        INT  21h

; SOMA_ATE: AX = n -> AX = 1 + 2 + ... + n
SOMA_ATE PROC
        ; seu código aqui
        RET
SOMA_ATE ENDP
END inicio
--- testes
[{ "nome": "n = 10 -> 55", "setup": { "AX": 10 }, "espera": { "DX": 55, "pilhaEquilibrada": true } },
 { "nome": "n = 1 -> 1", "setup": { "AX": 1 }, "espera": { "DX": 1, "pilhaEquilibrada": true } },
 { "nome": "n = 0 -> 0", "setup": { "AX": 0 }, "espera": { "DX": 0, "pilhaEquilibrada": true } },
 { "nome": "n = 100 -> 5050", "setup": { "AX": 100 }, "espera": { "DX": 5050, "pilhaEquilibrada": true } }]
--- dicas
O caso base é n = 0: devolva 0 (AX já vale 0, basta retornar).
No caso recursivo: PUSH AX, DEC AX, CALL SOMA_ATE, depois POP em outro registrador e some.
Cuidado com o registrador do POP: ele não pode ser AX, que guarda o resultado da chamada.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        CALL SOMA_ATE
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

SOMA_ATE PROC
        TEST AX, AX
        JZ   @@fim          ; SOMA_ATE(0) = 0
        PUSH AX             ; guarda n
        DEC  AX
        CALL SOMA_ATE       ; AX = SOMA_ATE(n-1)
        POP  BX             ; BX = n
        ADD  AX, BX
@@fim:  RET
SOMA_ATE ENDP
END inicio
```

```exercicio
id: a11-2
titulo: Imprimir um número
nivel: 2
exigir: DIV
--- enunciado
Complete **IMPRIMIR_NUMERO** para imprimir o valor de AX (0 a 65535) em decimal usando `INT 21h` com `AH=02h`. O valor chega em AX quando o programa começa. Não imprima zeros à esquerda, e o número 0 deve aparecer como **0**.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        CALL IMPRIMIR_NUMERO
        MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_NUMERO: imprime AX em decimal
IMPRIMIR_NUMERO PROC
        ; seu código aqui
        RET
IMPRIMIR_NUMERO ENDP
END inicio
--- testes
[{ "nome": "1234", "setup": { "AX": 1234 }, "espera": { "saida": "1234", "pilhaEquilibrada": true } },
 { "nome": "0", "setup": { "AX": 0 }, "espera": { "saida": "0", "pilhaEquilibrada": true } },
 { "nome": "65535", "setup": { "AX": 65535 }, "espera": { "saida": "65535", "pilhaEquilibrada": true } },
 { "nome": "10", "setup": { "AX": 10 }, "espera": { "saida": "10", "pilhaEquilibrada": true } }]
--- dicas
Divida por 10 com DIV BX (BX = 10) e lembre-se de zerar DX antes de cada divisão.
Empilhe cada resto e conte quantos dígitos empilhou em CX.
Depois, desempilhe CX vezes, some '0' e imprima com AH = 02h.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        CALL IMPRIMIR_NUMERO
        MOV  AX, 4C00h
        INT  21h

IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        TEST AX, AX
        JNZ  @@divide
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP
END inicio
```

```exercicio
id: a11-3
titulo: Potência recursiva
nivel: 3
exigir: CALL
proibir: LOOP
--- enunciado
Escreva o procedimento recursivo **POTENCIA**, que recebe a base em **BX** e o expoente em **CX** e devolve **BX elevado a CX** em AX. Use a definição: base⁰ = 1 e base^n = base × base^(n−1). Os valores chegam em BX e CX quando o programa começa, e o resultado sempre cabe em 16 bits. **BX e CX precisam ser preservados.**
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        CALL POTENCIA
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

; POTENCIA: AX = BX ^ CX  (preserva BX e CX)
POTENCIA PROC
        ; seu código aqui
        RET
POTENCIA ENDP
END inicio
--- testes
[{ "nome": "2^10 = 1024", "setup": { "BX": 2, "CX": 10 }, "espera": { "DX": 1024, "BX": 2, "CX": 10, "pilhaEquilibrada": true } },
 { "nome": "3^4 = 81", "setup": { "BX": 3, "CX": 4 }, "espera": { "DX": 81, "BX": 3, "CX": 4, "pilhaEquilibrada": true } },
 { "nome": "7^0 = 1", "setup": { "BX": 7, "CX": 0 }, "espera": { "DX": 1, "BX": 7, "CX": 0, "pilhaEquilibrada": true } },
 { "nome": "10^4 = 10000", "setup": { "BX": 10, "CX": 4 }, "espera": { "DX": 10000, "BX": 10, "CX": 4, "pilhaEquilibrada": true } }]
--- dicas
Caso base: se CX = 0, AX = 1.
No caso recursivo, salve CX, decremente, chame POTENCIA, restaure CX e multiplique AX por BX.
MUL BX destrói DX. Isso não é problema aqui, porque o programa principal só usa DX depois.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        CALL POTENCIA
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

POTENCIA PROC
        JCXZ @@base         ; expoente 0
        PUSH CX
        DEC  CX
        CALL POTENCIA       ; AX = BX ^ (CX-1)
        POP  CX
        MUL  BX             ; AX = AX * BX
        RET
@@base: MOV  AX, 1
        RET
POTENCIA ENDP
END inicio
```

:::resumo
- Recursão funciona porque cada chamada guarda seus dados (parâmetros, retorno, registradores) em uma região própria da pilha.
- Toda recursão precisa de um caso base. Cada nível consome pilha, e o 8086 não avisa quando ela transborda.
- Para imprimir em decimal: divida por 10 (com DX zerado), empilhe os restos e desempilhe somando '0'.
- Um programa DOS completo tem cabeçalho, principal curto, procedimentos com contrato documentado e `END principal`.
- AL na saída com `AH=4Ch` é o código de saída lido pelo `IF ERRORLEVEL`.
:::
