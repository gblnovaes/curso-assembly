---
id: aula18
numero: 18
modulo: 8
titulo: Projeto, o analisador de vetores
subtitulo: Juntando tudo em um programa de verdade, procedimento por procedimento
duracao: 90 min
objetivos: planejar um programa maior dividindo-o em procedimentos com contratos claros; percorrer vetores para achar máximo, mínimo, soma e média; somar com 32 bits usando ADC; ordenar um vetor com o bubble sort; montar um relatório na tela e um gráfico de barras em modo texto
---

## O projeto

Até aqui cada aula ensinou uma peça. Agora vamos juntar as peças em um programa completo, do jeito que um programador dos anos 90 faria: primeiro o plano, depois os procedimentos, um de cada vez, testados isoladamente, e só no fim o programa principal.

O **ANALISA.EXE** recebe um vetor de words sem sinal e mostra:

```diagrama titulo="A saída que queremos"
  ANALISADOR DE VETORES v1.0
  ──────────────────────────
  Elementos: 10
  Maior....: 2048
  Menor....: 3
  Soma.....: 5076
  Media....: 507
  Pares....: 6

  Grafico (1 bloco = 128):
  ▐
  ▐█████████
  ▐
  ...
```

## Passo 1: o plano

Antes de escrever uma linha, decida **quais procedimentos** existem e **qual o contrato** de cada um. Todos recebem o vetor do mesmo jeito: **SI** aponta para o primeiro elemento e **CX** tem a quantidade.

| Procedimento | Entrada | Saída | Preserva |
|--------------|---------|-------|----------|
| `MAXIMO` | SI, CX | AX = maior | SI, CX |
| `MINIMO` | SI, CX | AX = menor | SI, CX |
| `SOMA32` | SI, CX | DX:AX = soma | SI, CX |
| `CONTA_PARES` | SI, CX | AX = quantidade de pares | SI, CX |
| `IMPRIMIR_NUMERO` | AX | imprime em decimal | tudo |
| `ESCREVER` | DX = string com `$` | imprime | tudo |

Esse planejamento era feito no papel, muitas vezes num caderno quadriculado. Ele evita o pior defeito de programas assembly grandes: procedimentos que estragam registradores uns dos outros.

:::dica Contrato padronizado
Quando todos os procedimentos de um projeto recebem os parâmetros nos mesmos registradores, o programa principal fica previsível e quase não precisa mover dados. As bibliotecas da época, como a da *Borland* para o Turbo Pascal, eram consistentes justamente por isso.
:::

## Passo 2: máximo e mínimo

O algoritmo do máximo: comece supondo que o primeiro elemento é o maior; percorra os demais e troque o candidato sempre que achar um maior.

```asm fragmento
; MAXIMO: SI = vetor, CX = n (n >= 1) -> AX = maior (sem sinal)
MAXIMO  PROC
        PUSH SI
        PUSH CX
        MOV  AX, [SI]       ; candidato: o primeiro
        DEC  CX
        JZ   @@fim          ; vetor de 1 elemento
@@laco: ADD  SI, 2
        CMP  [SI], AX
        JBE  @@nao          ; sem sinal: JBE / JA
        MOV  AX, [SI]       ; achou um maior
@@nao:  LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
MAXIMO  ENDP
```

Repare no `JZ @@fim` depois do `DEC CX`: se o vetor tem 1 elemento, CX vira 0, e um `LOOP` com CX = 0 daria 65.536 voltas (Aula 7). O `MINIMO` é igual, trocando `JBE` por `JAE`.

:::atencao Sem sinal ou com sinal?
Usamos `JBE`/`JA` porque os nossos valores são **sem sinal** (0 a 65.535). Se o vetor tivesse números negativos, seria `JLE`/`JG`. Com a comparação errada, −1 (FFFFh) vira o "maior" número do vetor. A Aula 22 trata dos números com sinal.
:::

## Passo 3: soma com 32 bits

Dez words de até 65.535 podem somar até 655.350, que não cabe em 16 bits. A solução é acumular em **DX:AX** e usar o **ADC** (soma com o vai-um) para propagar o carry para a parte alta:

```asm fragmento
; SOMA32: SI = vetor, CX = n -> DX:AX = soma
SOMA32  PROC
        PUSH SI
        PUSH CX
        XOR  AX, AX
        XOR  DX, DX
        JCXZ @@fim          ; vetor vazio: soma 0
@@laco: ADD  AX, [SI]       ; soma a parte baixa
        ADC  DX, 0          ; CF = 1? soma 1 na parte alta
        ADD  SI, 2
        LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
SOMA32  ENDP
```

`JCXZ` (salta se CX = 0) é a proteção certa antes de um laço com `LOOP` quando o tamanho pode ser zero.

## Passo 4: média e pares

A média é a soma dividida por n. Como a soma já está em **DX:AX**, ela é exatamente o dividendo que o `DIV` de 16 bits espera:

```asm fragmento
        CALL SOMA32         ; DX:AX = soma
        DIV  CX             ; AX = soma / n, DX = resto
```

Esse `DIV` só é seguro porque a média de valores de 16 bits sempre cabe em 16 bits. Se n fosse 0, o `DIV` geraria a interrupção 0 ("Divide overflow").

Para contar os pares, basta olhar o bit 0: `TEST word, 1` liga ZF quando o número é par, sem alterar o valor.

## Passo 5: o programa completo

```asm executar titulo="ANALISA.ASM: o analisador de vetores"
; ------------------------------------------------------------
; ANALISA.ASM - Analisador de vetores v1.0
; Mostra maior, menor, soma, média, pares e um gráfico.
; ------------------------------------------------------------
.MODEL SMALL
.STACK 200h
.DATA
dados   DW 37, 1200, 5, 980, 64, 512, 3, 77, 2048, 150
N       EQU ($ - dados) / 2
tit     DB 'ANALISADOR DE VETORES v1.0', 13, 10
        DB 26 DUP(196), 13, 10, '$'
t_n     DB 'Elementos: $'
t_max   DB 13, 10, 'Maior....: $'
t_min   DB 13, 10, 'Menor....: $'
t_soma  DB 13, 10, 'Soma.....: $'
t_med   DB 13, 10, 'Media....: $'
t_par   DB 13, 10, 'Pares....: $'
t_graf  DB 13, 10, 13, 10, 'Grafico (1 bloco = 128):$'
novalin DB 13, 10, '$'

.CODE
principal PROC
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET dados
        MOV  CX, N

        MOV  DX, OFFSET tit
        CALL ESCREVER
        MOV  DX, OFFSET t_n
        CALL ESCREVER
        MOV  AX, CX
        CALL IMPRIMIR_NUMERO

        MOV  DX, OFFSET t_max
        CALL ESCREVER
        CALL MAXIMO
        CALL IMPRIMIR_NUMERO

        MOV  DX, OFFSET t_min
        CALL ESCREVER
        CALL MINIMO
        CALL IMPRIMIR_NUMERO

        MOV  DX, OFFSET t_soma
        CALL ESCREVER
        CALL SOMA32         ; cabe em 16 bits neste exemplo
        CALL IMPRIMIR_NUMERO

        MOV  DX, OFFSET t_med
        CALL ESCREVER
        CALL SOMA32
        DIV  CX             ; AX = média
        CALL IMPRIMIR_NUMERO

        MOV  DX, OFFSET t_par
        CALL ESCREVER
        CALL CONTA_PARES
        CALL IMPRIMIR_NUMERO

        MOV  DX, OFFSET t_graf
        CALL ESCREVER
        CALL GRAFICO

        MOV  AX, 4C00h
        INT  21h
principal ENDP

; MAXIMO: SI = vetor, CX = n (n >= 1) -> AX = maior. Preserva SI, CX.
MAXIMO  PROC
        PUSH SI
        PUSH CX
        MOV  AX, [SI]
        DEC  CX
        JZ   @@fim
@@laco: ADD  SI, 2
        CMP  [SI], AX
        JBE  @@nao
        MOV  AX, [SI]
@@nao:  LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
MAXIMO  ENDP

; MINIMO: SI = vetor, CX = n (n >= 1) -> AX = menor. Preserva SI, CX.
MINIMO  PROC
        PUSH SI
        PUSH CX
        MOV  AX, [SI]
        DEC  CX
        JZ   @@fim
@@laco: ADD  SI, 2
        CMP  [SI], AX
        JAE  @@nao
        MOV  AX, [SI]
@@nao:  LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
MINIMO  ENDP

; SOMA32: SI = vetor, CX = n -> DX:AX = soma. Preserva SI, CX.
SOMA32  PROC
        PUSH SI
        PUSH CX
        XOR  AX, AX
        XOR  DX, DX
        JCXZ @@fim
@@laco: ADD  AX, [SI]
        ADC  DX, 0
        ADD  SI, 2
        LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
SOMA32  ENDP

; CONTA_PARES: SI = vetor, CX = n -> AX = quantos são pares. Preserva SI, CX.
CONTA_PARES PROC
        PUSH SI
        PUSH CX
        XOR  AX, AX
        JCXZ @@fim
@@laco: TEST WORD PTR [SI], 1
        JNZ  @@impar
        INC  AX
@@impar:
        ADD  SI, 2
        LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
CONTA_PARES ENDP

; GRAFICO: uma linha por elemento, valor/128 blocos. Preserva tudo.
GRAFICO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        CLD
@@linha:
        MOV  DX, OFFSET novalin
        CALL ESCREVER
        MOV  AH, 02h
        MOV  DL, 222        ; '▐': o eixo
        INT  21h
        LODSW               ; AX = valor, SI += 2
        PUSH CX
        MOV  CL, 7
        SHR  AX, CL         ; AX = valor / 128
        MOV  CX, AX
        JCXZ @@vazio
        MOV  AH, 02h
        MOV  DL, 219        ; '█'
@@bloco:
        INT  21h
        LOOP @@bloco
@@vazio:
        POP  CX
        LOOP @@linha
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
GRAFICO ENDP

; ESCREVER: imprime a string com '$' em DS:DX. Preserva tudo.
ESCREVER PROC
        PUSH AX
        MOV  AH, 09h
        INT  21h
        POP  AX
        RET
ESCREVER ENDP

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

Rode no laboratório e depois **mude os dados**: acrescente valores, tire valores, coloque um vetor de um elemento só. A linha `N EQU ($ - dados) / 2` calcula o tamanho sozinha, então nenhuma outra linha precisa mudar.

:::anos90 Os caracteres de desenho do CP437
O gráfico usa os caracteres 219 (█) e 222 (▐) da **página de código 437**, a tabela de caracteres original do IBM PC. Ela tinha linhas simples e duplas (┌─┐ ╔═╗), blocos (░▒▓█) e símbolos, e era com ela que se desenhavam as janelas do *Norton Commander*, do *Turbo Pascal* e das telas de BBS. A aba **ASCII** da Referência mostra a tabela inteira.
:::

```quiz
? Por que MAXIMO faz JZ @@fim logo depois do DEC CX?
- Para pular o primeiro elemento
+ Para não entrar no LOOP com CX = 0, o que daria 65.536 voltas
- Porque DEC não altera ZF
> Com um vetor de 1 elemento, CX vira 0 depois do DEC. DEC altera ZF (só não altera CF).

? Para que serve o ADC DX,0 em SOMA32?
+ Para somar o vai-um da parte baixa (CF) na parte alta
- Para zerar DX
- Para converter a soma em decimal
> ADC soma o operando mais CF. Com operando 0, ele só propaga o carry.

? Por que DIV CX pode ser usado logo depois de SOMA32 para obter a média?
- Porque DIV CX divide só AX
+ Porque SOMA32 deixa a soma em DX:AX, que é o dividendo de 32 bits do DIV de 16 bits
- Porque CX sempre é 10
> E como a média de words cabe em 16 bits, o quociente nunca estoura (desde que n não seja 0).

? Qual comparação MINIMO usa para valores sem sinal?
- JL / JGE
+ JB / JAE
- JS / JNS
> Above/Below são para sem sinal; Greater/Less para com sinal.

? O que a linha N EQU ($ - dados) / 2 calcula?
- O endereço do fim de dados
+ O número de words declaradas em dados
- O tamanho de dados em bytes
> $ é o endereço atual. A diferença dá os bytes, e dividir por 2 dá as words.
```

## Ordenando: o bubble sort

O **bubble sort** compara cada par de vizinhos e troca os dois se estiverem fora de ordem. Depois de uma passada completa, o maior elemento "borbulhou" até o fim. Repetindo n − 1 passadas, o vetor fica ordenado.

```diagrama titulo="Uma passada do bubble sort"
  [ 5  3  8  1 ]   5 > 3? troca
  [ 3  5  8  1 ]   5 > 8? não
  [ 3  5  8  1 ]   8 > 1? troca
  [ 3  5  1  8 ]   o 8 chegou ao fim; a próxima passada vai até o 1
```

É um algoritmo lento para vetores grandes (cerca de n² comparações), mas curto, fácil de acertar e bom o bastante para dezenas de elementos. Nos anos 90 ele ordenava placares de recordes, listas de arquivos e menus. Para milhares de itens, usava-se o Quicksort ou o Shell sort.

Uma melhoria simples: se uma passada inteira não fez nenhuma troca, o vetor já está ordenado e dá para parar mais cedo.

## Exercícios

```exercicio
id: a18-1
titulo: Maior e menor de uma vez
nivel: 2
--- enunciado
Escreva o procedimento **MAXMIN**, que percorre o vetor **uma vez só** e devolve o **maior** valor em **AX** e o **menor** em **BX** (valores sem sinal). SI aponta para o vetor e CX tem a quantidade (pelo menos 1). O programa principal guarda os resultados em **maior** e **menor**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
vetor   DW 500, 20, 7000, 3, 999, 42, 65000, 128
maior   DW 0
menor   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET vetor
        MOV  CX, 8
        CALL MAXMIN
        MOV  maior, AX
        MOV  menor, BX
        MOV  AX, 4C00h
        INT  21h

; MAXMIN: SI = vetor, CX = n -> AX = maior, BX = menor
MAXMIN  PROC
        ; seu código aqui
        RET
MAXMIN  ENDP
END inicio
--- testes
[{ "nome": "vetor original", "espera": { "mem": { "maior": 65000, "menor": 3 }, "pilhaEquilibrada": true } },
 { "nome": "crescente", "setup": { "vetor": [1, 2, 3, 4, 5, 6, 7, 8] }, "espera": { "mem": { "maior": 8, "menor": 1 } } },
 { "nome": "decrescente", "setup": { "vetor": [800, 700, 600, 500, 400, 300, 200, 100] }, "espera": { "mem": { "maior": 800, "menor": 100 } } },
 { "nome": "todos iguais", "setup": { "vetor": [9, 9, 9, 9, 9, 9, 9, 9] }, "espera": { "mem": { "maior": 9, "menor": 9 } } }]
--- dicas
Comece com AX = BX = primeiro elemento.
No laço, compare [SI] com AX (JBE para não trocar) e com BX (JAE para não trocar).
Cuidado com o DEC CX antes do laço: com 1 elemento, CX vira 0.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
vetor   DW 500, 20, 7000, 3, 999, 42, 65000, 128
maior   DW 0
menor   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET vetor
        MOV  CX, 8
        CALL MAXMIN
        MOV  maior, AX
        MOV  menor, BX
        MOV  AX, 4C00h
        INT  21h

MAXMIN  PROC
        PUSH SI
        PUSH CX
        MOV  AX, [SI]
        MOV  BX, AX
        DEC  CX
        JZ   @@fim
@@laco: ADD  SI, 2
        MOV  DX, [SI]
        CMP  DX, AX
        JBE  @@naomaior
        MOV  AX, DX
@@naomaior:
        CMP  DX, BX
        JAE  @@naomenor
        MOV  BX, DX
@@naomenor:
        LOOP @@laco
@@fim:  POP  CX
        POP  SI
        RET
MAXMIN  ENDP
END inicio
```

```exercicio
id: a18-2
titulo: Acima da média
nivel: 2
--- enunciado
Calcule a **média inteira** dos 8 valores de **vetor** (soma dividida por 8, descartando o resto) e guarde em **media**. Depois conte quantos valores são **estritamente maiores** que a média e guarde em **acima**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
vetor   DW 10, 20, 30, 40, 50, 60, 70, 80
media   DW 0
acima   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "10..80: média 45, 4 acima", "espera": { "mem": { "media": 45, "acima": 4 } } },
 { "nome": "um valor grande", "setup": { "vetor": [1, 1, 1, 1, 1, 1, 1, 993] }, "espera": { "mem": { "media": 125, "acima": 1 } } },
 { "nome": "todos iguais", "setup": { "vetor": [7, 7, 7, 7, 7, 7, 7, 7] }, "espera": { "mem": { "media": 7, "acima": 0 } } },
 { "nome": "soma maior que 65535", "setup": { "vetor": [60000, 60000, 60000, 60000, 0, 0, 0, 0] }, "espera": { "mem": { "media": 30000, "acima": 4 } } }]
--- dicas
Some em DX:AX com ADD e ADC, como em SOMA32: o último teste passa de 65.535.
Divida por 8 com DIV (BX = 8) ou deslocando DX:AX 3 bits para a direita.
Num segundo laço, compare cada valor com a média usando JBE para pular os que não são maiores.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
vetor   DW 10, 20, 30, 40, 50, 60, 70, 80
media   DW 0
acima   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; soma em DX:AX
        XOR  AX, AX
        XOR  DX, DX
        MOV  SI, OFFSET vetor
        MOV  CX, 8
@@soma: ADD  AX, [SI]
        ADC  DX, 0
        ADD  SI, 2
        LOOP @@soma
        MOV  BX, 8
        DIV  BX             ; AX = média
        MOV  media, AX
        ; conta os maiores que a média
        XOR  DX, DX
        MOV  SI, OFFSET vetor
        MOV  CX, 8
@@conta:
        CMP  [SI], AX
        JBE  @@nao
        INC  DX
@@nao:  ADD  SI, 2
        LOOP @@conta
        MOV  acima, DX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a18-3
titulo: Bubble sort
nivel: 3
--- enunciado
Escreva o procedimento **ORDENAR**, que coloca as **8 words** de **vetor** em ordem **crescente** (sem sinal) usando o bubble sort. SI aponta para o vetor e CX tem a quantidade.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
vetor   DW 42, 7, 1999, 3, 512, 64, 1, 300
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET vetor
        MOV  CX, 8
        CALL ORDENAR
        MOV  AX, 4C00h
        INT  21h

; ORDENAR: SI = vetor, CX = n -> vetor em ordem crescente
ORDENAR PROC
        ; seu código aqui
        RET
ORDENAR ENDP
END inicio
--- testes
[{ "nome": "vetor original", "espera": { "mem": { "vetor": [1, 3, 7, 42, 64, 300, 512, 1999] }, "pilhaEquilibrada": true } },
 { "nome": "já ordenado", "setup": { "vetor": [1, 2, 3, 4, 5, 6, 7, 8] }, "espera": { "mem": { "vetor": [1, 2, 3, 4, 5, 6, 7, 8] } } },
 { "nome": "ordem inversa", "setup": { "vetor": [8, 7, 6, 5, 4, 3, 2, 1] }, "espera": { "mem": { "vetor": [1, 2, 3, 4, 5, 6, 7, 8] } } },
 { "nome": "com repetidos e valores altos", "setup": { "vetor": [65535, 5, 5, 40000, 0, 5, 65535, 1] }, "espera": { "mem": { "vetor": [0, 1, 5, 5, 5, 40000, 65535, 65535] } } }]
--- dicas
Laço externo: n − 1 passadas. Laço interno: compara [BX] com [BX+2] e troca se [BX] > [BX+2].
Para trocar duas words da memória: MOV AX,[BX] / XCHG AX,[BX+2] / MOV [BX],AX.
Os dois laços usam contadores: guarde o externo com PUSH CX antes de começar o interno.
Use JBE para não trocar: os valores são sem sinal.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
vetor   DW 42, 7, 1999, 3, 512, 64, 1, 300
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET vetor
        MOV  CX, 8
        CALL ORDENAR
        MOV  AX, 4C00h
        INT  21h

ORDENAR PROC
        PUSH AX
        PUSH BX
        PUSH CX
        DEC  CX             ; n - 1 passadas
        JZ   @@fim
@@externo:
        PUSH CX             ; comparações nesta passada = CX
        MOV  BX, SI
@@interno:
        MOV  AX, [BX]
        CMP  AX, [BX+2]
        JBE  @@ok
        XCHG AX, [BX+2]     ; troca os vizinhos
        MOV  [BX], AX
@@ok:   ADD  BX, 2
        LOOP @@interno
        POP  CX
        LOOP @@externo
@@fim:  POP  CX
        POP  BX
        POP  AX
        RET
ORDENAR ENDP
END inicio
```

:::resumo
- Planeje antes: liste os procedimentos e o contrato de cada um (entrada, saída, o que preserva).
- Máximo e mínimo: comece pelo primeiro elemento e troque o candidato; proteja o `LOOP` contra CX = 0.
- Somas grandes: acumule em DX:AX com `ADD` e `ADC`. `JCXZ` protege laços de tamanho possivelmente zero.
- DX:AX é o dividendo do `DIV` de 16 bits: a média sai direto da soma de 32 bits.
- Bubble sort: compare vizinhos e troque; n − 1 passadas. Use JA/JB para sem sinal e JG/JL para com sinal.
:::
