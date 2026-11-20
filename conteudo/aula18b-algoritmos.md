---
id: aula18b
numero: 18.3
rotulo: 18B
modulo: 8
titulo: Algoritmos clássicos em Assembly
subtitulo: Busca linear e binária, ordenação por inserção e impressão em hexadecimal
duracao: 75 min
objetivos: procurar um valor num vetor com busca linear; procurar num vetor ordenado com busca binária e entender por que ela é tão mais rápida; ordenar com o algoritmo de inserção; imprimir números em hexadecimal com deslocamentos e uma tabela
prerequisitos: aula05b; aula18
---

## Do bubble sort em diante

Na [Aula 18](aula:aula18) o analisador de vetores ordenou os dados com o *bubble sort*, o algoritmo mais simples que existe. Ele funciona, mas compara tudo com tudo. Esta aula traz três ferramentas que aparecem em todo programa de verdade: procurar um valor (do jeito ingênuo e do jeito esperto), ordenar melhor e mostrar números em hexadecimal, o formato preferido de quem programa em Assembly.

Todos os exemplos usam vetores de **words sem sinal**. Para words, o elemento *i* fica no offset *i* × 2, e a [Aula 5B](aula:aula05b) mostrou o jeito barato de multiplicar por 2: `SHL reg, 1`.

## Busca linear

A busca mais simples olha os elementos um por um até achar o valor ou chegar ao fim. A convenção que vamos usar é devolver o **índice** encontrado em DX, ou **FFFFh** (−1) quando o valor não está no vetor.

```asm executar titulo="LINEAR.ASM: onde está o 33?"
.MODEL SMALL
.STACK 100h
.DATA
v       DW 5, 80, 12, 33, 7, 0
N       EQU 6
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 33          ; valor procurado
        LEA  SI, v
        MOV  CX, N
        XOR  DX, DX          ; índice atual
prox:   CMP  [SI], AX
        JE   achou
        ADD  SI, 2
        INC  DX
        LOOP prox
        MOV  DX, 0FFFFh      ; não achou
achou:  MOV  AX, 4C00h       ; DX = 3
        INT  21h
END inicio
```

O custo cresce junto com o vetor: com 1.000 elementos, procurar um valor que não existe faz 1.000 comparações. Para um vetor bagunçado não há jeito melhor. Mas se o vetor estiver **ordenado**, dá para fazer muito menos.

## Busca binária

É o jeito como se procura uma palavra no dicionário: abre no meio, vê se a palavra vem antes ou depois e descarta a metade errada. A cada passo, metade do que sobrou sai da busca.

```diagrama titulo="Procurando 41 em 16 elementos ordenados"
 índice:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
 valor:   2  5  8 12 16 23 27 30 33 38 41 45 50 56 61 70
 passo 1  ini=0, fim=15, meio=7 (30)  -> 41 é maior: ini = 8
 passo 2  ini=8, fim=15, meio=11 (45) -> 41 é menor: fim = 10
 passo 3  ini=8, fim=10, meio=9 (38)  -> 41 é maior: ini = 10
 passo 4  ini=10, fim=10, meio=10 (41) -> achou!
```

Com 16 elementos bastam 4 passos; com 1.000, uns 10; com 65.000, 16. É a diferença entre 65.000 comparações e 16.

```asm executar titulo="BINARIA.ASM: busca binária em words ordenadas"
.MODEL SMALL
.STACK 100h
.DATA
v       DW 2, 5, 8, 12, 16, 23, 27, 30, 33, 38, 41, 45, 50, 56, 61, 70
N       EQU 16
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 41          ; valor procurado
        XOR  SI, SI          ; SI = ini
        MOV  DI, N - 1       ; DI = fim
passo:  CMP  SI, DI
        JG   naoachou        ; ini passou de fim: não está lá
        MOV  BX, SI
        ADD  BX, DI
        SHR  BX, 1           ; BX = meio = (ini + fim) / 2
        MOV  DX, BX          ; guarda o índice
        SHL  BX, 1           ; vira offset de word
        CMP  AX, v[BX]
        JE   fim
        JB   esquerda
        MOV  SI, DX          ; maior: ini = meio + 1
        INC  SI
        JMP  passo
esquerda:
        MOV  DI, DX          ; menor: fim = meio - 1
        DEC  DI
        JMP  passo
naoachou:
        MOV  DX, 0FFFFh
fim:    MOV  AX, 4C00h       ; DX = 10
        INT  21h
END inicio
```

Repare em três detalhes:

- `v[BX]` é o modo baseado com deslocamento da [Aula 6](aula:aula06): o endereço é `v + BX`.
- A comparação do valor usa `JB` (sem sinal), mas `CMP SI, DI` usa `JG` (com sinal). Quando o valor é menor que o primeiro elemento, `fim` vira −1, e precisamos que −1 seja menor que 0.
- `(ini + fim) / 2` não estoura aqui porque os índices são pequenos. Com índices perto de 65.535, a soma passaria de 16 bits; o jeito seguro é `ini + (fim − ini) / 2`.

:::atencao Só funciona com o vetor ordenado
Num vetor fora de ordem, a busca binária descarta a metade errada e responde "não achei" para um valor que está lá. Ordenar custa caro, então a busca binária compensa quando se procura muitas vezes no mesmo vetor.
:::

## Ordenação por inserção

É o jeito como se arruma um punhado de cartas na mão: pegue a próxima carta e empurre para a direita as que são maiores, até abrir o espaço certo para ela.

```diagrama titulo="Inserção, passo a passo"
 início:          [5] 2 4 1 3
 insere 2:        [2 5] 4 1 3      (5 anda uma casa)
 insere 4:        [2 4 5] 1 3      (5 anda)
 insere 1:        [1 2 4 5] 3      (5, 4 e 2 andam)
 insere 3:        [1 2 3 4 5]      (5 e 4 andam)
```

```asm executar titulo="INSERCAO.ASM: ordena bytes em ordem crescente"
.MODEL SMALL
.STACK 100h
.DATA
v       DB 5, 2, 4, 1, 3
N       EQU 5
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, 1           ; i = 1: o elemento 0 já está "ordenado"
externo:
        CMP  SI, N
        JAE  pronto
        MOV  AL, v[SI]       ; a carta da vez
        MOV  DI, SI          ; j = i
interno:
        CMP  DI, 0
        JE   coloca
        MOV  BL, v[DI-1]
        CMP  BL, AL
        JBE  coloca          ; o da esquerda já é menor ou igual: achou o lugar
        MOV  v[DI], BL       ; empurra o maior para a direita
        DEC  DI
        JMP  interno
coloca: MOV  v[DI], AL
        INC  SI
        JMP  externo
pronto: MOV  AX, 4C00h       ; v = 1, 2, 3, 4, 5
        INT  21h
END inicio
```

O pior caso da inserção (vetor de trás para a frente) é tão lento quanto o bubble sort, mas num vetor **quase ordenado** ela é quase linear: cada carta anda pouco ou nada. Por isso ela é usada para vetores pequenos e para terminar o trabalho de algoritmos mais sofisticados, como o *quicksort*.

## Imprimindo em hexadecimal

Imprimir em decimal exige divisões ([Aula 11](aula:aula11)). Em hexadecimal basta separar os bits: cada dígito é um **nibble** de 4 bits. Gire a word 4 casas para a esquerda, e o nibble de cima vem para baixo; `AND 0Fh` isola o nibble, e uma tabela traduz o número 0 a 15 no caractere certo.

```asm executar titulo="HEX.ASM: imprime uma word em hexadecimal"
.MODEL SMALL
.STACK 100h
.DATA
digitos DB '0123456789ABCDEF'
valor   DW 0BEEFh
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, valor
        MOV  CX, 4           ; 4 dígitos
digito: PUSH CX
        MOV  CL, 4
        ROL  BX, CL          ; o nibble de cima vai para baixo
        POP  CX
        MOV  SI, BX
        AND  SI, 0Fh         ; SI = 0..15
        MOV  DL, digitos[SI] ; traduz pela tabela
        MOV  AH, 02h
        INT  21h
        LOOP digito
        MOV  AX, 4C00h
        INT  21h
END inicio
```

A saída é `BEEF`. Depois de quatro giros de 4 casas, BX volta ao valor original, porque girar 16 casas é dar a volta completa.

:::dica Sem tabela
Também dá para converter sem tabela: some `'0'` ao nibble e, se passar de `'9'`, some mais 7 (a distância entre `'9'` e `'A'` na tabela ASCII). A tabela é mais clara; a conta economiza 16 bytes.
:::

:::anos90 Por que hexadecimal
O DEBUG.COM, o Turbo Debugger, as listagens do MASM e os manuais da BIOS mostravam tudo em hexadecimal. Um programador da época lia `B800`, `CD 21` e `4C00` sem pensar. Uma rotina de imprimir em hex era a primeira coisa que se escrevia para depurar um programa novo.
:::

```quiz
? Qual é a condição para usar a busca binária?
- O vetor ter um número par de elementos.
+ O vetor estar ordenado.
- O valor procurado estar no vetor.
> A busca descarta uma metade com base na ordem. Sem ordem, ela descarta a metade errada.

? Quantos passos, no máximo, a busca binária precisa para 1.000 elementos?
- 500
- 100
+ Uns 10
> Cada passo corta pela metade: 2¹⁰ = 1.024 já cobre 1.000 elementos.

? Num vetor que já está quase ordenado, como se sai a ordenação por inserção?
+ Muito bem: cada elemento anda pouco ou nada.
- Muito mal: é o pior caso dela.
- Igual ao bubble sort.
> O laço interno para logo na primeira comparação quando o elemento já está no lugar.

? Como se pega o dígito hexadecimal de cima de BX?
- AND BX, 0F000h e pronto
+ Girar BX 4 casas para a esquerda (ROL) e fazer AND 0Fh numa cópia
- Dividir BX por 10
> A rotação traz o nibble de cima para os bits 0 a 3 sem perder os outros.
```

## Exercícios

```exercicio
id: a18b-1
titulo: Busca linear
nivel: 1
--- enunciado
Procure `alvo` no vetor de words `w` (8 elementos) e grave em `pos` o índice da **primeira** ocorrência, ou **FFFFh** se o valor não estiver lá.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
w       DW 4, 8, 15, 16, 23, 42, 15, 0
N       EQU 8
alvo    DW 15
pos     DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[
 { "nome": "15 aparece primeiro no índice 2", "espera": { "mem": { "pos": 2 } } },
 { "nome": "o último", "setup": { "alvo": 0 }, "espera": { "mem": { "pos": 7 } } },
 { "nome": "o primeiro", "setup": { "alvo": 4 }, "espera": { "mem": { "pos": 0 } } },
 { "nome": "não está lá", "setup": { "alvo": 99 }, "espera": { "mem": { "pos": 65535 } } }
]
--- dicas
Compare cada elemento com o alvo (que você pode levar para AX) e conte o índice num registrador.
Se o LOOP terminar sem achar, grave 0FFFFh.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
w       DW 4, 8, 15, 16, 23, 42, 15, 0
N       EQU 8
alvo    DW 15
pos     DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, alvo
        LEA  SI, w
        MOV  CX, N
        XOR  DX, DX
prox:   CMP  [SI], AX
        JE   achou
        ADD  SI, 2
        INC  DX
        LOOP prox
        MOV  DX, 0FFFFh
achou:  MOV  pos, DX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a18b-2
titulo: Busca binária com pressa
nivel: 3
maxCiclos: 900
--- enunciado
O vetor `v` tem **64 words em ordem crescente**. Grave em `pos` o índice de `alvo`, ou **FFFFh** se ele não estiver lá. A busca linear é lenta demais: o programa inteiro precisa caber em **900 ciclos** (nem `REPNE SCASW` é tão rápido).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
; 0, 3, 6, ..., 189: o elemento i vale 3 * i
v       DW 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45
        DW 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93
        DW 96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 135, 138, 141
        DW 144, 147, 150, 153, 156, 159, 162, 165, 168, 171, 174, 177, 180, 183, 186, 189
N       EQU 64
alvo    DW 189
pos     DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, alvo
        LEA  SI, v
        MOV  CX, N
        XOR  DX, DX
prox:   CMP  [SI], AX
        JE   achou
        ADD  SI, 2
        INC  DX
        LOOP prox
        MOV  DX, 0FFFFh
achou:  MOV  pos, DX
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[
 { "nome": "o último (189)", "espera": { "mem": { "pos": 63 } } },
 { "nome": "o primeiro (0)", "setup": { "alvo": 0 }, "espera": { "mem": { "pos": 0 } } },
 { "nome": "no meio (96)", "setup": { "alvo": 96 }, "espera": { "mem": { "pos": 32 } } },
 { "nome": "100 não está lá", "setup": { "alvo": 100 }, "espera": { "mem": { "pos": 65535 } } },
 { "nome": "maior que todos", "setup": { "alvo": 500 }, "espera": { "mem": { "pos": 65535 } } }
]
--- dicas
Use ini em SI e fim em DI, como no BINARIA.ASM da aula. O meio é (ini + fim) / 2 com SHR.
Lembre de transformar o índice do meio em offset (SHL 1) antes de ler v[BX], e compare SI com DI usando salto com sinal (JG).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v       DW 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45
        DW 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93
        DW 96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 135, 138, 141
        DW 144, 147, 150, 153, 156, 159, 162, 165, 168, 171, 174, 177, 180, 183, 186, 189
N       EQU 64
alvo    DW 189
pos     DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, alvo
        XOR  SI, SI
        MOV  DI, N - 1
passo:  CMP  SI, DI
        JG   naoachou
        MOV  BX, SI
        ADD  BX, DI
        SHR  BX, 1
        MOV  DX, BX
        SHL  BX, 1
        CMP  AX, v[BX]
        JE   fim
        JB   esquerda
        MOV  SI, DX
        INC  SI
        JMP  passo
esquerda:
        MOV  DI, DX
        DEC  DI
        JMP  passo
naoachou:
        MOV  DX, 0FFFFh
fim:    MOV  pos, DX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a18b-3
titulo: Ordenação por inserção
nivel: 2
--- enunciado
Ordene em ordem **crescente** (sem sinal) os 8 bytes do vetor `v`, usando o algoritmo de inserção.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
v       DB 9, 3, 7, 1, 8, 2, 6, 4
N       EQU 8
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[
 { "nome": "9, 3, 7, 1, 8, 2, 6, 4", "espera": { "mem": { "v": [1, 2, 3, 4, 6, 7, 8, 9] } } },
 { "nome": "de trás para a frente", "setup": { "v": [8, 7, 6, 5, 4, 3, 2, 1] }, "espera": { "mem": { "v": [1, 2, 3, 4, 5, 6, 7, 8] } } },
 { "nome": "já ordenado", "setup": { "v": [1, 2, 3, 4, 5, 6, 7, 8] }, "espera": { "mem": { "v": [1, 2, 3, 4, 5, 6, 7, 8] } } },
 { "nome": "repetidos e 255", "setup": { "v": [255, 0, 5, 5, 255, 1, 0, 5] }, "espera": { "mem": { "v": [0, 0, 1, 5, 5, 5, 255, 255] } } }
]
--- dicas
Siga o INSERCAO.ASM da aula: SI percorre de 1 a N−1; AL guarda o elemento da vez; DI anda para a esquerda empurrando os maiores.
Compare com JBE (sem sinal), senão 255 vira −1 e vai parar no começo.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v       DB 9, 3, 7, 1, 8, 2, 6, 4
N       EQU 8
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, 1
externo:
        CMP  SI, N
        JAE  pronto
        MOV  AL, v[SI]
        MOV  DI, SI
interno:
        CMP  DI, 0
        JE   coloca
        MOV  BL, v[DI-1]
        CMP  BL, AL
        JBE  coloca
        MOV  v[DI], BL
        DEC  DI
        JMP  interno
coloca: MOV  v[DI], AL
        INC  SI
        JMP  externo
pronto: MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a18b-4
titulo: Mostre AX em hexadecimal
nivel: 2
--- enunciado
**AX** traz um valor. Imprima os **4 dígitos hexadecimais** de AX (com as letras A a F maiúsculas, sem o `h`), usando a função 02h da INT 21h. Faça a conversão sem tabela: dígito + `'0'`, e mais 7 se passar de `'9'`.
--- inicial
; imprime AX em hexadecimal, 4 dígitos
--- testes
[
 { "nome": "BEEFh", "setup": { "AX": 48879 }, "espera": { "saida": "BEEF" } },
 { "nome": "0000h", "setup": { "AX": 0 }, "espera": { "saida": "0000" } },
 { "nome": "1A2Fh", "setup": { "AX": 6703 }, "espera": { "saida": "1A2F" } },
 { "nome": "09F0h", "setup": { "AX": 2544 }, "espera": { "saida": "09F0" } }
]
--- dicas
Copie AX para BX logo no começo, porque a INT 21h usa AH.
Repita 4 vezes: gire BX 4 casas (ROL com CL), copie BL para DL, AND DL,0Fh, ADD DL,'0'; se DL passar de '9' (CMP DL,'9' / JBE), some 7. Use outro registrador como contador, porque CL é o contador do giro.
--- solucao
        MOV  BX, AX
        MOV  DH, 4
        MOV  CL, 4
digito: ROL  BX, CL
        MOV  DL, BL
        AND  DL, 0Fh
        ADD  DL, '0'
        CMP  DL, '9'
        JBE  imprime
        ADD  DL, 7
imprime:
        MOV  AH, 02h
        INT  21h
        DEC  DH
        JNZ  digito
```

:::resumo
- Busca linear: compare um por um; devolva o índice ou FFFFh. Custa até N comparações.
- Busca binária: só em vetor ordenado; compare com o meio e descarte metade. Custa uns log₂ N passos (16 para 65.000 elementos).
- Em vetores de words, o índice vira offset com `SHL reg, 1`, e `v[BX]` lê o elemento.
- Inserção: cada elemento anda para a esquerda até o lugar certo. Excelente para vetores pequenos ou quase ordenados.
- Hexadecimal: `ROL` de 4 casas traz o próximo nibble, `AND 0Fh` o isola, e uma tabela (ou + `'0'` e + 7) o vira caractere.
:::
