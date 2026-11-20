---
id: aula18c
numero: 18.6
rotulo: 18C
modulo: 8
titulo: Estruturas de dados: fila circular e lista ligada
subtitulo: O buffer do teclado da BIOS e as listas que crescem sem mover nada
duracao: 75 min
objetivos: implementar uma fila circular com índices que dão a volta usando AND; reconhecer a fila circular no buffer de teclado da BIOS; percorrer uma lista ligada seguindo ponteiros; inserir e remover nós de uma lista ligada sem mover os outros
prerequisitos: aula10; aula18b
---

## Dados com forma

Até aqui os dados viveram em **vetores**: elementos lado a lado, acessados por índice. O vetor é ótimo para ler, mas ruim para mudar. Tirar o primeiro elemento obriga a mover todos os outros uma casa, e inserir no meio também. Esta aula mostra duas estruturas que resolvem isso, as duas usadas o tempo todo pelo próprio PC:

- a **fila circular** (*ring buffer*): quem entra primeiro sai primeiro, sem nunca mover nada;
- a **lista ligada**: cada elemento diz onde está o próximo, então inserir e remover é só trocar ponteiros.

## A fila circular

Uma fila tem duas pontas: entra-se pelo **fim** e sai-se pelo **início**. Num vetor comum, os dois índices só andariam para a frente e logo passariam do fim do espaço. A ideia da fila circular é deixar os índices **darem a volta**: depois da última posição vem a posição 0 de novo.

```diagrama titulo="Fila circular de 8 posições"
  posição:   0   1   2   3   4   5   6   7
           ┌───┬───┬───┬───┬───┬───┬───┬───┐
           │   │   │ C │ D │ E │   │   │   │      ini = 2 (próximo a sair)
           └───┴───┴───┴───┴───┴───┴───┴───┘      fim = 5 (próxima vaga)
                     ▲           ▲
                    ini         fim
  entra F: grava em 5, fim = 6       sai: lê a posição 2 (C), ini = 3
  quando fim chega a 8, volta a 0: fim = (fim + 1) AND 7
```

Se o tamanho for uma **potência de 2**, a volta sai de graça: com 8 posições, `(índice + 1) AND 7` vai de 7 para 0. É a máscara da [Aula 5B](aula:aula05b) fazendo o papel de um "resto da divisão por 8", sem `DIV`.

A fila está **vazia** quando `ini = fim`. E ela está **cheia** quando avançar `fim` o faria encostar em `ini`; por isso uma fila de 8 posições guarda no máximo 7 elementos (a posição que sobra é o que distingue cheia de vazia).

```asm executar titulo="FILA.ASM: entra A, B, C; sai A; entra D"
.MODEL SMALL
.STACK 100h
.DATA
fila    DB 8 DUP('.')
ini     DW 0
fim     DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AL, 'A'
        CALL ENFILEIRA
        MOV  AL, 'B'
        CALL ENFILEIRA
        MOV  AL, 'C'
        CALL ENFILEIRA
        CALL DESENFILEIRA    ; AL = 'A'
        MOV  AL, 'D'
        CALL ENFILEIRA       ; fila: . B C D . . . .  (ini = 1, fim = 4)
        MOV  AX, 4C00h
        INT  21h

; ENFILEIRA: põe AL no fim (sem testar se está cheia)
ENFILEIRA PROC
        PUSH BX
        MOV  BX, fim
        MOV  fila[BX], AL
        INC  BX
        AND  BX, 7           ; dá a volta depois da posição 7
        MOV  fim, BX
        POP  BX
        RET
ENFILEIRA ENDP

; DESENFILEIRA: tira do início para AL (sem testar se está vazia)
DESENFILEIRA PROC
        PUSH BX
        MOV  BX, ini
        MOV  AL, fila[BX]
        INC  BX
        AND  BX, 7
        MOV  ini, BX
        POP  BX
        RET
DESENFILEIRA ENDP
END inicio
```

Rode no laboratório (F4) e olhe `fila`, `ini` e `fim` na janela de memória: o 'A' continua lá na posição 0, mas não faz mais parte da fila, porque `ini` já passou dele. Na fila circular, **sair não apaga nada**: só anda o índice.

:::anos90 O buffer do teclado é uma fila circular
Cada tecla apertada passa pela INT 9 da BIOS, que guarda o código num buffer de 16 words em 0040:001Eh. Os ponteiros de início e fim ficam em 0040:001Ah e 0040:001Ch. A INT 16h tira as teclas pelo início; a INT 9 põe pelo fim. Quando o buffer enchia (15 teclas sem ninguém ler), a BIOS fazia aquele **bipe** famoso. O [Livro da BIOS](livro:cap06) descreve esse buffer em detalhes.
:::

## A lista ligada

Numa lista ligada, cada elemento (um **nó**) guarda o dado e o **endereço do próximo nó**. Os nós podem estar em qualquer lugar da memória e em qualquer ordem; o que define a sequência são os ponteiros. Um ponteiro 0 marca o fim.

```diagrama titulo="Uma lista com três nós (offset +0 = valor, +2 = próximo)"
  cabeca ──► ┌──────┬──────┐    ┌──────┬──────┐    ┌──────┬──────┐
             │  10  │  ●───┼──► │  20  │  ●───┼──► │  30  │  0   │
             └──────┴──────┘    └──────┴──────┘    └──────┴──────┘
               n1                 n2                 n3
```

Em Assembly, um nó é só um par de words. `DW 20, n3` guarda o valor 20 e o offset de `n3`. Para andar na lista, carregue o ponteiro num registrador-base e siga o campo `próximo`:

```asm executar titulo="LISTA.ASM: soma os valores de uma lista ligada"
.MODEL SMALL
.STACK 100h
.DATA
cabeca  DW n1
n3      DW 30, 0             ; os nós não precisam estar em ordem
n1      DW 10, n2
n2      DW 20, n3
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX          ; soma
        MOV  BX, cabeca      ; BX aponta para o primeiro nó
prox:   CMP  BX, 0
        JE   fim             ; ponteiro 0: acabou
        ADD  AX, [BX]        ; campo valor   (+0)
        MOV  BX, [BX+2]      ; campo próximo (+2)
        JMP  prox
fim:    MOV  DX, AX          ; DX = 60
        MOV  AX, 4C00h
        INT  21h
END inicio
```

A linha `MOV BX, [BX+2]` é o coração de toda lista ligada: o ponteiro vira o endereço do próximo nó. É o `p = p->proximo` do C.

### Inserir e remover sem mover nada

Para **inserir um nó no começo**, bastam duas atribuições: o novo nó aponta para o antigo primeiro, e a cabeça passa a apontar para o novo.

```asm fragmento
; insere o nó "novo" no começo da lista
        MOV  AX, cabeca
        MOV  novo+2, AX          ; novo.proximo = cabeca
        MOV  cabeca, OFFSET novo ; cabeca = &novo
```

Para **remover o primeiro**, a cabeça pula para o segundo: `MOV BX, cabeca` / `MOV AX, [BX+2]` / `MOV cabeca, AX`. Remover do meio é o mesmo truque, aplicado ao campo `próximo` do nó anterior. Nenhum outro nó sai do lugar, e é isso que torna a lista ligada boa para dados que mudam o tempo todo.

:::dica O DOS usa listas ligadas
A cadeia de blocos de memória do DOS (os MCBs da [Aula 26](aula:aula26)) é uma lista: cada bloco diz o próprio tamanho, e o próximo bloco começa logo depois. Os *device drivers* também formam uma lista, cada um com um ponteiro *far* para o seguinte.
:::

:::atencao Cuidado com o ponteiro 0
Esquecer de testar o fim da lista faz o programa seguir o ponteiro 0 e ler DS:0000 como se fosse um nó, e daí para qualquer lugar. Nos anos 90 isso era o clássico travamento sem mensagem nenhuma.
:::

```quiz
? Numa fila circular de 8 posições, como o índice 7 vira 0 depois de avançar?
- Com DIV por 8
+ Com INC e depois AND 7
- Com SHL 3
> 7 + 1 = 8 = 1000b; AND 0111b dá 0. Funciona porque 8 é potência de 2.

? Quando uma fila circular está vazia?
+ Quando ini = fim
- Quando ini = 0
- Quando o primeiro byte é 0
> Os dois índices se alcançaram: não sobra nada entre eles.

? Na lista ligada da aula, o que MOV BX, [BX+2] faz?
- Soma 2 a BX.
+ Faz BX apontar para o próximo nó.
- Lê o valor do nó.
> O campo +2 de cada nó guarda o offset do próximo.

? Qual é a vantagem da lista ligada sobre o vetor?
- Ler o elemento i é mais rápido.
+ Inserir e remover não move os outros elementos.
- Ocupa menos memória.
> Em troca, achar o elemento i exige percorrer a lista desde o começo, e cada nó gasta uma word a mais com o ponteiro.
```

## Exercícios

```exercicio
id: a18c-1
titulo: A fila que dá a volta
nivel: 2
exigir: CALL
--- enunciado
Escreva os procedimentos **ENFILEIRA** (põe AL no fim da fila) e **DESENFILEIRA** (tira do início para AL) para a fila circular de **8 posições** `fila`, com os índices `ini` e `fim`. Os dois preservam todos os registradores, menos AL na DESENFILEIRA. O programa principal já está pronto: ele enfileira os 3 primeiros caracteres de `entrada`, tira e imprime 2, enfileira mais 6 (os índices dão a volta) e tira e imprime os 7 que sobraram.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
entrada DB 'ABCDEFGHI'
fila    DB 8 DUP(0)
ini     DW 0
fim     DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        LEA  SI, entrada
        MOV  CX, 3
e1:     MOV  AL, [SI]
        INC  SI
        CALL ENFILEIRA
        LOOP e1
        MOV  CX, 2
s1:     CALL DESENFILEIRA
        CALL MOSTRA
        LOOP s1
        MOV  CX, 6
e2:     MOV  AL, [SI]
        INC  SI
        CALL ENFILEIRA
        LOOP e2
        MOV  CX, 7
s2:     CALL DESENFILEIRA
        CALL MOSTRA
        LOOP s2
        MOV  AX, 4C00h
        INT  21h

MOSTRA  PROC                 ; imprime AL
        PUSH AX
        PUSH DX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  DX
        POP  AX
        RET
MOSTRA  ENDP

ENFILEIRA PROC
        ; seu código aqui
        RET
ENFILEIRA ENDP

DESENFILEIRA PROC
        ; seu código aqui
        RET
DESENFILEIRA ENDP
END inicio
--- testes
[
 { "nome": "ABCDEFGHI sai na mesma ordem", "espera": { "saida": "ABCDEFGHI", "pilhaEquilibrada": true } },
 { "nome": "outra entrada", "setup": { "entrada": "123456789" }, "espera": { "saida": "123456789", "mem": { "ini": 1, "fim": 1 }, "pilhaEquilibrada": true } }
]
--- dicas
Use BX como índice: MOV BX,fim / MOV fila[BX],AL / INC BX / AND BX,7 / MOV fim,BX. Salve BX com PUSH/POP.
A DESENFILEIRA é igual, lendo fila[BX] para AL e andando com ini.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
entrada DB 'ABCDEFGHI'
fila    DB 8 DUP(0)
ini     DW 0
fim     DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        LEA  SI, entrada
        MOV  CX, 3
e1:     MOV  AL, [SI]
        INC  SI
        CALL ENFILEIRA
        LOOP e1
        MOV  CX, 2
s1:     CALL DESENFILEIRA
        CALL MOSTRA
        LOOP s1
        MOV  CX, 6
e2:     MOV  AL, [SI]
        INC  SI
        CALL ENFILEIRA
        LOOP e2
        MOV  CX, 7
s2:     CALL DESENFILEIRA
        CALL MOSTRA
        LOOP s2
        MOV  AX, 4C00h
        INT  21h

MOSTRA  PROC
        PUSH AX
        PUSH DX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  DX
        POP  AX
        RET
MOSTRA  ENDP

ENFILEIRA PROC
        PUSH BX
        MOV  BX, fim
        MOV  fila[BX], AL
        INC  BX
        AND  BX, 7
        MOV  fim, BX
        POP  BX
        RET
ENFILEIRA ENDP

DESENFILEIRA PROC
        PUSH BX
        MOV  BX, ini
        MOV  AL, fila[BX]
        INC  BX
        AND  BX, 7
        MOV  ini, BX
        POP  BX
        RET
DESENFILEIRA ENDP
END inicio
```

```exercicio
id: a18c-2
titulo: O maior da lista
nivel: 2
--- enunciado
Percorra a lista ligada que começa em `cabeca` (cada nó: valor na word +0, próximo na word +2, fim com ponteiro 0) e grave em `maior` o **maior valor** (sem sinal). A lista tem pelo menos um nó.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
cabeca  DW n1
n4      DW 7, 0
n2      DW 300, n3
n1      DW 25, n2
n3      DW 41, n4
maior   DW 0
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
 { "nome": "25, 300, 41, 7", "espera": { "mem": { "maior": 300 } } },
 { "nome": "o maior no último nó", "setup": { "n4": [9999] }, "espera": { "mem": { "maior": 9999 } } },
 { "nome": "o maior no primeiro nó", "setup": { "n1": [65535], "n2": [1] }, "espera": { "mem": { "maior": 65535 } } },
 { "nome": "todos zero", "setup": { "n1": [0], "n2": [0], "n3": [0], "n4": [0] }, "espera": { "mem": { "maior": 0 } } }
]
--- dicas
BX = cabeca. Enquanto BX não for 0: compare [BX] com o maior até agora; depois MOV BX,[BX+2].
Comece o maior com 0 e use JBE/JA (sem sinal).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
cabeca  DW n1
n4      DW 7, 0
n2      DW 300, n3
n1      DW 25, n2
n3      DW 41, n4
maior   DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        MOV  BX, cabeca
prox:   CMP  BX, 0
        JE   fim
        CMP  [BX], AX
        JBE  segue
        MOV  AX, [BX]
segue:  MOV  BX, [BX+2]
        JMP  prox
fim:    MOV  maior, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a18c-3
titulo: Fura-fila na lista
nivel: 3
--- enunciado
Insira o nó `novo` no **começo** da lista e depois remova da lista o nó `n2` (que hoje é o segundo da lista original). Não mova nenhum nó de lugar: só troque ponteiros. O resto do programa conta os nós e soma os valores, para conferir.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
cabeca  DW n1
n1      DW 10, n2
n2      DW 20, n3
n3      DW 30, 0
novo    DW 5, 0
total   DW 0
soma    DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX

        ; seu código aqui: insira "novo" no começo e tire "n2"

        ; confere: conta os nós e soma os valores
        XOR  CX, CX
        XOR  AX, AX
        MOV  BX, cabeca
conta:  CMP  BX, 0
        JE   pronto
        INC  CX
        ADD  AX, [BX]
        MOV  BX, [BX+2]
        JMP  conta
pronto: MOV  total, CX
        MOV  soma, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[
 { "nome": "5 -> 10 -> 30", "espera": { "mem": { "total": 3, "soma": 45 } } },
 { "nome": "outros valores", "setup": { "novo": [1000], "n1": [1], "n2": [999], "n3": [3] }, "espera": { "mem": { "total": 3, "soma": 1004 } } }
]
--- dicas
Inserir: novo+2 recebe o valor antigo de cabeca; cabeca recebe OFFSET novo.
Remover n2: o nó anterior a ele é n1, então o próximo de n1 (n1+2) passa a ser o próximo de n2 (n2+2). Passe por um registrador, porque não existe MOV de memória para memória.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
cabeca  DW n1
n1      DW 10, n2
n2      DW 20, n3
n3      DW 30, 0
novo    DW 5, 0
total   DW 0
soma    DW 0
.CODE
inicio:
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, cabeca
        MOV  novo+2, AX
        MOV  cabeca, OFFSET novo
        MOV  AX, n2+2
        MOV  n1+2, AX
        XOR  CX, CX
        XOR  AX, AX
        MOV  BX, cabeca
conta:  CMP  BX, 0
        JE   pronto
        INC  CX
        ADD  AX, [BX]
        MOV  BX, [BX+2]
        JMP  conta
pronto: MOV  total, CX
        MOV  soma, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Fila circular: entra pelo fim, sai pelo início; os índices andam com `INC` e `AND (tamanho − 1)` quando o tamanho é potência de 2.
- Vazia quando `ini = fim`; cheia quando avançar `fim` encostaria em `ini` (uma posição fica sempre livre).
- O buffer de teclado da BIOS (0040:001Eh) é uma fila circular de 16 words.
- Lista ligada: cada nó guarda o valor e o endereço do próximo; ponteiro 0 marca o fim. `MOV BX, [BX+2]` anda para o próximo.
- Inserir no começo: `novo.proximo = cabeca` e `cabeca = &novo`. Remover: o anterior passa a apontar para o seguinte. Nada sai do lugar.
:::
