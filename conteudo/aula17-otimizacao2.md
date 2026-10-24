---
id: aula17
numero: 17
modulo: 7
titulo: Otimização 2, laços e memória
subtitulo: LOOP contra DEC/JNZ, a fila de pré-busca, alinhamento e desenrolamento
duracao: 75 min
objetivos: comparar LOOP com DEC/JNZ no 8086 e saber por que a resposta mudou nos processadores seguintes; organizar saltos para que o caso comum não salte; entender a fila de pré-busca (prefetch queue) e por que código curto pode ser mais rápido; alinhar dados com EVEN; desenrolar laços; trocar laços inteiros por instruções de string
---

## Onde o tempo realmente vai

Na aula passada otimizamos instruções isoladas. Mas o tempo de um programa está nos **laços**: uma instrução que economiza 5 ciclos dentro de um laço de 10.000 voltas economiza 50.000. Nesta aula olhamos o laço como um todo: o custo de dar a volta, o custo dos saltos, o custo da memória e o que o processador faz enquanto você não está olhando.

## LOOP ou DEC CX / JNZ?

Existem dois jeitos clássicos de fechar um laço com contador:

```widget comparar
{ "titulo": "100 voltas de um laço vazio", "a": "        MOV  CX, 100\n@@l:    LOOP @@l", "b": "        MOV  CX, 100\n@@l:    DEC  CX\n        JNZ  @@l", "altura": 6 }
```

| | Bytes | Ciclos ao voltar | Ciclos ao sair |
|-|-------|------------------|----------------|
| `LOOP rótulo` | 2 | 17 | 5 |
| `DEC CX` + `JNZ rótulo` | 1 + 2 | 2 + 16 = 18 | 2 + 4 = 6 |

No 8086, **`LOOP` ganha**: um ciclo mais rápido e um byte menor. E ele tem outra vantagem: não altera as flags, então o corpo do laço pode testar uma flag calculada antes.

:::anos90 A virada do 486
No 80486 a história se inverteu: `LOOP` passou a custar 6 ou 7 ciclos, enquanto `DEC CX` e `JNZ` custavam 1 e 3. Os guias de otimização para 486 e Pentium passaram a mandar "nunca use LOOP". Muitos programadores levaram esse conselho de volta para o 8086, onde ele é errado. Moral: **otimização depende do processador**. Sempre meça no alvo.
:::

DEC/JNZ continua útil quando o contador não é CX ou quando você precisa dele para outra coisa: `DEC SI` / `JNZ` funciona com qualquer registrador.

## Saltos condicionais: não salte no caso comum

Todo salto condicional custa **16 ciclos quando salta** e **4 quando não salta**. Saltar esvazia a fila de pré-busca (já explicamos), e o processador precisa buscar as instruções do destino do zero.

Por isso, organize o código para que o **caso mais frequente siga reto**:

```asm fragmento
; Contar espaços numa string: a maioria dos caracteres NÃO é espaço.

; Ruim: salta no caso comum (16 ciclos quase sempre)
@@l1:   LODSB
        CMP  AL, ' '
        JNE  @@proximo      ; quase sempre salta
        INC  DX
@@proximo:
        LOOP @@l1

; Melhor: só salta no caso raro
@@l2:   LODSB
        CMP  AL, ' '
        JE   @@espaco       ; quase nunca salta: 4 ciclos
@@volta:
        LOOP @@l2
        JMP  @@fim
@@espaco:
        INC  DX
        JMP  @@volta
```

A segunda versão é mais feia e mais longa, mas em uma string com 10% de espaços ela economiza perto de 8 ciclos por caractere, já descontando os dois saltos extras dos espaços. Use esse tipo de truque só nos laços críticos.

## A fila de pré-busca

O 8086 é dividido em duas unidades que trabalham ao mesmo tempo:

```diagrama titulo="As duas unidades do 8086"
  ┌──────────────────────────┐       ┌─────────────────────────┐
  │ BIU (Bus Interface Unit) │       │ EU (Execution Unit)     │
  │                          │ fila  │                         │
  │ busca bytes de código ──►│ de 6  │──► decodifica e executa │
  │ lê e grava a memória     │ bytes │    (os ciclos da tabela)│
  └──────────┬───────────────┘       └─────────────────────────┘
             │ barramento: 4 ciclos por acesso
             ▼
          memória
```

Enquanto a EU executa uma instrução, a BIU aproveita o barramento livre para **buscar as próximas instruções** e guardá-las numa fila de 6 bytes (4 bytes no 8088). Os ciclos da tabela da Intel assumem que a instrução já está na fila.

Mas a fila esvazia quando:

- o programa **salta** (a fila é descartada e recomeça no destino);
- uma sequência de instruções **rápidas e longas** consome bytes mais depressa do que o barramento consegue buscar;
- instruções que acessam muito a **memória** disputam o barramento com a busca.

Nesses casos, a CPU fica parada esperando bytes, e o tempo real passa dos números da tabela.

:::cpu O ciclo-por-byte do 8088
No 8088, com barramento de 8 bits, cada byte de código custa 4 ciclos para ser buscado. Uma sequência de `SHL AX,1` (2 bytes, 2 ciclos na tabela) na prática roda a **8 ciclos** cada, porque a busca não acompanha. Michael Abrash chamava isso de "o ciclo-comedor" (*cycle-eater*) da fila de pré-busca. Regra prática para o 8088: **conte os bytes, multiplique por 4** e compare com os ciclos da tabela; o maior dos dois é o custo real. Código curto é código rápido.
:::

O simulador deste curso usa os ciclos da tabela (a visão da EU), então não mostra esse efeito. Mas ele é a razão de tantos programadores da época preferirem a versão **menor** de uma rotina quando as duas tinham ciclos parecidos.

## Alinhamento: a diretiva EVEN

Na aula passada vimos que ler uma word de um endereço **ímpar** custa 4 ciclos a mais. Para uma instrução que lê **e** grava (como `INC word`), são 8 ciclos a mais. A diretiva **`EVEN`** avança o endereço atual até o próximo número par, inserindo um byte se necessário:

```asm executar titulo="ALINHA.ASM: o custo de uma word desalinhada"
.MODEL SMALL
.STACK 100h
.DATA
flag    DB 1                ; 1 byte: o próximo endereço é ímpar!
        EVEN                ; experimente apagar esta linha
contador DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CX, 1000
@@laco: INC  contador       ; lê e grava uma word
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Rode no laboratório e anote os ciclos. Depois apague a linha `EVEN` e rode de novo: o laço fica **8.000 ciclos** mais lento, só por causa de um byte de diferença na posição da variável.

`EVEN` também funciona no segmento de código, onde insere um `NOP`: alinhar o **destino de um salto** muito usado faz a busca do primeiro word de instruções ser mais eficiente no 8086.

:::dica Organize os dados por tamanho
Em vez de espalhar `EVEN`, declare primeiro as words e depois os bytes. Assim todas as words ficam alinhadas sem desperdiçar nenhum byte, e os bytes vêm no fim, onde o alinhamento não importa.
:::

```quiz
? No 8086, qual fecha um laço mais depressa: LOOP ou DEC CX / JNZ?
+ LOOP: 17 ciclos contra 18, e 2 bytes contra 3
- DEC CX / JNZ: 3 ciclos contra 17
- Os dois custam exatamente o mesmo
> No 8086, DEC de registrador de 16 bits custa 2 e JNZ que salta custa 16. A vantagem de DEC/JNZ só apareceu no 486.

? Quanto custa um salto condicional que NÃO salta no 8086?
- 16 ciclos
+ 4 ciclos
- 0 ciclos
> Saltar custa 16 porque a fila de pré-busca é descartada. Não saltar custa só 4.

? O que a BIU do 8086 faz enquanto a EU executa?
- Nada, espera a EU terminar
+ Busca as próximas instruções e as guarda na fila de pré-busca
- Calcula o endereço efetivo
> As duas unidades trabalham em paralelo. A fila tem 6 bytes no 8086 e 4 no 8088.

? Para que serve a diretiva EVEN?
- Para arredondar números para par
+ Para alinhar a próxima variável ou instrução em um endereço par
- Para dividir o segmento em duas partes
> Words em endereço ímpar custam 4 ciclos a mais por acesso no 8086.

? Por que, no 8088, uma sequência de instruções curtas e rápidas pode rodar mais devagar que a tabela indica?
+ Porque a busca de cada byte custa 4 ciclos e a fila de pré-busca esvazia
- Porque o 8088 não tem fila de pré-busca
- Porque instruções curtas não podem ser executadas em sequência
> Com barramento de 8 bits, buscar o código vira o gargalo. Daí a regra prática de contar 4 ciclos por byte.
```

## Desenrolando laços

Todo laço paga um "pedágio" a cada volta: o `LOOP` (17 ciclos). Se o corpo do laço é curto, o pedágio pode custar mais que o trabalho! A solução é **desenrolar**: repetir o corpo várias vezes dentro de cada volta e dar menos voltas.

```widget comparar
{ "titulo": "Somar 8 words de DS:SI em DX", "a": "        XOR  DX, DX\n        MOV  CX, 8\n@@l:    LODSW\n        ADD  DX, AX\n        LOOP @@l", "b": "        XOR  DX, DX\n        MOV  CX, 4\n@@l:    LODSW\n        ADD  DX, AX\n        LODSW\n        ADD  DX, AX\n        LOOP @@l", "altura": 10 }
```

Desenrolar duas vezes corta o número de `LOOP` pela metade. Com quatro vezes, corta para um quarto. O custo é código maior, e o número de elementos precisa ser múltiplo do fator (ou é preciso tratar a sobra à parte, como fizemos com `MOVSB` depois de `REP MOVSW` na Aula 13).

:::anos90 O Duff's Device
Em 1983, Tom Duff, da Lucasfilm, precisava copiar dados para um registrador de hardware o mais rápido possível em C. Ele desenrolou o laço 8 vezes e, para tratar a sobra, fez algo que ninguém achava que fosse C válido: **um `switch` que salta para o meio de um `do-while`**. O "Duff's Device" virou lenda. Em assembly, o mesmo truque é natural: salte para dentro do corpo desenrolado no ponto que trata a sobra, e deixe o resto do laço cuidar dos múltiplos de 8.
:::

## O laço que não é laço: instruções de string

O desenrolamento máximo é não ter laço nenhum. As instruções de string com `REP` fazem o laço **dentro do processador**, sem buscar instruções a cada volta:

| Preencher 1.000 words | Ciclos (aprox.) |
|-----------------------|-----------------|
| `MOV [DI],AX` / `ADD DI,2` / `LOOP` | 1.000 × (14 + 4 + 17) = 35.000 |
| o mesmo, desenrolado 4 vezes | 1.000 × 18 + 250 × 17 = 22.250 |
| `REP STOSW` | 9 + 1.000 × 10 = 10.009 |

Sempre que um laço for "copiar", "preencher", "procurar" ou "comparar", a primeira pergunta deve ser: dá para fazer com uma instrução de string?

## Tabelas: trocando cálculo por memória

O último grande truque da época: se um cálculo caro tem poucas entradas possíveis, **calcule tudo antes** e guarde numa tabela. A instrução `XLAT` foi feita para isso: ela faz `AL = [BX + AL]` em 11 ciclos.

```asm executar titulo="XLAT.ASM: convertendo nibbles em hexadecimal com tabela"
.MODEL SMALL
.STACK 100h
.DATA
digitos DB '0123456789ABCDEF'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, OFFSET digitos
        MOV  DX, 0BEEFh         ; número a imprimir
        MOV  CX, 4              ; 4 dígitos hexadecimais
@@laco: PUSH CX
        MOV  CL, 4
        ROL  DX, CL             ; traz o nibble mais alto para baixo
        POP  CX
        MOV  AL, DL
        AND  AL, 0Fh            ; AL = 0..15
        XLAT                    ; AL = digitos[AL]
        PUSH DX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  DX
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Os jogos usavam tabelas para tudo: seno e cosseno pré-calculados (em ponto fixo), os 200 offsets de linha do modo 13h, tabelas de cores para escurecer a paleta. Em uma máquina sem coprocessador matemático, uma tabela de 256 bytes valia ouro.

## Exercícios

```exercicio
id: a17-1
titulo: Preenchimento relâmpago
nivel: 2
maxCiclos: 11000
--- enunciado
Preencha as **1.000 words** a partir de **buffer** com o valor **0A0Dh**. O código inicial funciona, mas gasta mais de 35.000 ciclos. Faça o programa inteiro caber em **11.000 ciclos**. A variável **guarda**, logo depois das 1.000 words, não pode mudar.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
buffer  DW 999 DUP(0)
ultimo  DW 0
guarda  DW 1234h
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DI, OFFSET buffer
        MOV  AX, 0A0Dh
        MOV  CX, 1000
@@laco: MOV  [DI], AX
        ADD  DI, 2
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "1000 words preenchidas e guarda intacta", "espera": { "mem": { "buffer": [2573, 2573, 2573, 2573], "ultimo": 2573, "guarda": 4660 } } }]
--- dicas
REP STOSW grava AX em ES:[DI] CX vezes.
Lembre de fazer ES = DS e CLD.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
buffer  DW 999 DUP(0)
ultimo  DW 0
guarda  DW 1234h
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  DI, OFFSET buffer
        MOV  AX, 0A0Dh
        MOV  CX, 1000
        CLD
        REP  STOSW
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a17-2
titulo: Soma acelerada
nivel: 3
maxCiclos: 3000
--- enunciado
O programa soma as **100 words** de **tabela** e guarda o total em **soma**. Ele está correto, mas gasta mais de 5.700 ciclos. Otimize para no máximo **3.000 ciclos**. Ideias: acumular em registrador em vez de na memória, `LODSW`, e desenrolar o laço.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
tabela  DW 100 DUP(3)
soma    DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET tabela
        MOV  CX, 100
@@laco: MOV  AX, [SI]
        ADD  soma, AX       ; acumula na memória: caro!
        ADD  SI, 2
        DEC  CX
        JNZ  @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "100 × 3 = 300", "espera": { "mem": { "soma": 300 } } },
 { "nome": "valores diferentes", "setup": { "tabela": [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10] }, "espera": { "mem": { "soma": 45280 } } }]
--- dicas
Acumule em DX e grave em soma uma vez só, no fim.
LODSW lê [SI] em AX e avança SI em 2, em 12 ciclos (lembre do CLD).
Só trocar para registrador e LODSW ainda dá uns 3.200 ciclos. Desenrole: 50 voltas com dois LODSW / ADD cada.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
tabela  DW 100 DUP(3)
soma    DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET tabela
        XOR  DX, DX
        MOV  CX, 50         ; 100 words, 2 por volta
        CLD
@@laco: LODSW
        ADD  DX, AX
        LODSW
        ADD  DX, AX
        LOOP @@laco
        MOV  soma, DX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a17-3
titulo: Um byte de diferença
nivel: 1
maxCiclos: 39000
--- enunciado
Este laço incrementa **contador** 1.000 vezes e gasta uns 46.000 ciclos. Sem mudar nenhuma instrução do código, só mexendo nas **declarações de dados**, faça ele caber em **39.000 ciclos**. As duas variáveis precisam continuar existindo.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
ativo    DB 1
contador DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CX, 1000
@@laco: INC  contador
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "contador = 1000", "espera": { "mem": { "contador": 1000, "ativo": 1 } } }]
--- dicas
Em que endereço está contador? Veja na aba Variáveis do laboratório.
Uma word em endereço ímpar custa 4 ciclos a mais por acesso, e INC lê e grava.
Use EVEN antes de contador, ou declare contador antes de ativo.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
ativo    DB 1
         EVEN
contador DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CX, 1000
@@laco: INC  contador
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- No 8086, `LOOP` (17 ciclos, 2 bytes) é mais rápido que `DEC CX`/`JNZ` (18, 3 bytes). No 486 isso se inverteu: meça no processador-alvo.
- Saltos condicionais custam 16 ao saltar e 4 ao seguir: faça o caso comum seguir reto.
- A fila de pré-busca busca instruções em paralelo; saltos a esvaziam. No 8088, conte 4 ciclos por byte de código.
- `EVEN` alinha words e destinos de salto em endereços pares.
- Desenrole laços curtos, troque laços por `REP` e troque cálculos repetidos por tabelas (`XLAT`).
:::
