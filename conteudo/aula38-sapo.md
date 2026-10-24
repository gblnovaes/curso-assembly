---
id: aula38
numero: 38
modulo: 13
titulo: Sapo, atravessando a estrada e o rio
subtitulo: Frogger em modo texto - faixas circulares, células de 2 colunas, tocas e barra de tempo
duracao: 100 min
objetivos: entender as regras do Frogger de 1981 e como reduzi-las a tabelas; representar cada faixa como um desenho circular de 40 casas com um deslocamento; mover faixas inteiras somando 1 num byte (aritmética módulo 40); usar células de 2 colunas para ter "pixels" quadrados no modo texto; decidir a morte do sapo olhando a casa embaixo dele; medir o tempo pelos tiques da BIOS com uma barra que encolhe; ler a listagem completa do SAPO.ASM
---

## O sapo que queria chegar em casa

O jogo desta aula é diferente dos anteriores em um ponto essencial: **quase tudo na tela se move ao mesmo tempo**. São doze faixas de carros, caminhões, troncos e tartarugas, cada uma na sua velocidade e no seu sentido. Se o programa tratasse cada carro como um objeto, com posição, velocidade e desenho próprios, seriam dezenas de objetos para mover, testar e redesenhar. O SAPO resolve isso com uma ideia simples e bonita: **cada faixa é um único desenho que gira**, e mover a faixa inteira custa somar 1 num byte.

As técnicas comuns (laço do jogo, tempo, teclado, vídeo direto, som pelo PIT) estão nos [fundamentos](aula:aula32). Aqui a gente fica com o que o SAPO tem de próprio.

:::anos90 Konami, 1981: o Frogger
O **Frogger** foi criado pela Konami e chegou aos fliperamas em 1981, distribuído na América do Norte pela Sega/Gremlin. A ideia é de uma simplicidade genial: levar um sapo de baixo para cima da tela, atravessando primeiro uma estrada movimentada e depois um rio, onde ele precisa pular de tronco em tronco e de tartaruga em tartaruga até uma das **cinco tocas** do outro lado. Na estrada, encostar num carro mata; no rio, é o contrário: **cair na água** mata, e é preciso estar em cima de alguma coisa.

O Frogger foi um dos jogos mais copiados e convertidos do começo dos anos 80. A **Sierra On-Line** levou o jogo para os micros domésticos a partir de 1982, inclusive para o IBM PC, em CGA, e versões e clones continuaram aparecendo durante toda a década. Ele é um ótimo exemplo de jogo que funciona perfeitamente em **modo texto**: a tela do fliperama já era uma grade de faixas, e uma grade é exatamente o que o modo texto oferece.
:::

## As regras do SAPO

| Elemento | Como é no jogo |
|----------|----------------|
| Tela | modo texto 80 × 25, escrita direto em B800h |
| Casas | cada "casa" do jogo ocupa **2 colunas**: a linha tem 40 casas |
| Rua | 6 faixas (linhas 10 a 15) com carros e caminhões; encostar mata |
| Rio | 6 faixas (linhas 3 a 8) com troncos e tartarugas; a **água** mata, e o sapo é carregado pelo que estiver embaixo dele |
| Canteiro | linha 9, entre a rua e o rio: lugar seguro |
| Tocas | 5 tocas na linha 2; pular no muro ou numa toca já ocupada mata |
| Tempo | 30 segundos por sapo, numa barra que encolhe e fica vermelha nos últimos 10 |
| Pontos | 10 por linha nova alcançada, 50 + 10 por segundo que sobrou ao entrar numa toca, 1.000 por fase completa |
| Fases | as 5 tocas cheias passam de fase; cada fase as faixas ficam mais rápidas |
| Teclas | setas pulam uma casa, P pausa, ESC volta ao título |

Como os outros jogos do módulo, o SAPO é um **.COM** que da INT 21h só usa a função **4Ch** (sair); tudo mais é BIOS e memória de vídeo. É por isso que ele também roda no MINIOS do módulo 14.

## A tela

```diagrama titulo="A tela do SAPO (80 colunas, 25 linhas)"
 lin  coluna 0                                                              79
  0   PONTOS 00130     RECORDE 00000    VIDAS 00003   FASE 00001   (status, azul)
  1
  2   ████████  ████████  ████████  ████████  ████████  ███  muro com 5 tocas
  3   ▓▓▓▓▓▓▓▓≈≈≈≈≈≈≈≈≈≈▓▓▓▓▓▓▓▓▓▓≈≈≈≈≈≈≈≈≈≈≈▓▓▓▓▓▓▓▓≈≈≈≈≈≈   rio 1  → troncos
  4   ΘΘΘΘΘΘ≈≈≈≈≈≈≈≈ΘΘΘΘΘΘ≈≈≈≈≈≈≈≈ΘΘΘΘΘΘ≈≈≈≈≈≈≈≈≈≈ΘΘΘΘΘΘ≈≈≈   rio 2  ← tartarugas
  .   ...                                                     (6 faixas de rio)
  8   ▓▓▓▓▓▓▓▓≈≈≈≈≈≈≈≈▓▓▓▓▓▓▓▓▓▓▓▓≈≈≈≈≈≈≈≈≈≈≈≈▓▓▓▓▓▓≈≈≈≈≈≈   rio 6  ←
  9   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   canteiro (seguro)
 10   ██████              ██████                    ██████   rua 1  → caminhões
 11   ████            ████                  ████             rua 2  → carros
  .   ...                                                     (6 faixas de rua)
 15   ████          ████            ████              ████   rua 6  ←
 16   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   partida: o sapo ▐▌
 17
 18             TEMPO  ██████████████████████████████          a barra do tempo
 21                    setas pulam   P pausa   ESC sai
```

As linhas da tela são as constantes do começo do fonte. Repare que o jogo não guarda "linhas" e "colunas" do sapo, e sim **casas**: `sapo_x` vai de 0 a 39 e `sapo_y` é a própria linha da tela.

```asm fragmento titulo="As constantes da tela"
CASAS       EQU 40
FAIXAS      EQU 12              ; 6 no rio e 6 na rua
LIN_TOCAS   EQU 2               ; as 5 tocas, lá em cima
LIN_RIO     EQU 3               ; linhas 3 a 8
LIN_CANTEIRO EQU 9              ; o canteiro do meio (seguro)
LIN_RUA     EQU 10              ; linhas 10 a 15
LIN_PARTIDA EQU 16
LIN_TEMPO   EQU 18
TEMPO_MAX   EQU 60              ; meio segundo cada: 30 segundos
```

## Por que casas de 2 colunas?

Um caractere do modo texto 80 × 25 é bem mais **alto do que largo**: num monitor 4:3, cada célula tem mais ou menos a proporção 1 × 2. Se o sapo pulasse uma coluna para o lado e uma linha para cima, o pulo para cima pareceria duas vezes maior. Juntando **duas colunas numa casa**, a casa fica aproximadamente quadrada e os pulos ficam iguais nas quatro direções. O preço é a resolução horizontal cair para 40, o que ainda sobra para um Frogger.

```diagrama titulo="Uma casa = 2 células de texto"
       coluna:   2·x      2·x+1
               ┌───────┬───────┐
               │   ▐   │   ▌   │   o sapo: DEh e DDh, verde
               └───────┴───────┘
               │◄──── casa x ─────►│

   na memória de vídeo: 4 bytes   [caractere][atributo][caractere][atributo]
   endereço = linha × 160 + casa × 4
```

O sapo é desenhado com os dois **meios-blocos** da página de código 437 (▐ = DEh e ▌ = DDh), que juntos formam um bloco gordinho centrado. As faixas usam o mesmo caractere duas vezes: um carro de 2 casas vira um bloco de 4 colunas. A [Aula 23](aula:aula23) e o [capítulo de vídeo do livro](livro:cap03) explicam o formato caractere + atributo; o [capítulo 4](livro:cap04) fala da fonte da ROM, onde moram esses caracteres de desenho.

## Faixas que giram

Este é o coração do jogo. Cada faixa tem um **desenho de 40 casas** guardado como texto no fonte:

```asm fragmento titulo="Os desenhos das faixas"
; ' ' = água (rio) ou asfalto (rua), '=' tronco, 'o' tartaruga,
; '#' caminhão, '<' e '>' carros
f_rio1      DB '====     =====      ====     ======     '
f_rio2      DB 'ooo    ooo    ooo     ooo     ooo       '
...
f_rua1      DB '###       ###          ###         ##   '
f_rua2      DB '>>      >>         >>        >>         '
```

O desenho nunca muda. O que muda é um byte por faixa, o **deslocamento** (`desloc`): ele diz **qual casa do desenho aparece na coluna 0 da tela**. A casa x da tela mostra a casa `(x + desloc) mod 40` do desenho. O desenho é tratado como um **anel**: quando chega na casa 39, a seguinte é a 0 de novo.

```diagrama titulo="O desenho é um anel; o deslocamento escolhe onde a tela começa"
   desenho:  0         1         2         3
             0123456789012345678901234567890123456789
             ====     =====      ====     ======

   desloc = 0    tela: ====     =====      ====     ======
   desloc = 39   tela:  ====     =====      ====     ======      (tudo 1 casa para a direita)
   desloc = 38   tela:   ====     =====      ====     ======     (2 casas para a direita)
                         ▲
              a casa 39 do desenho (espaço) reaparece na frente: o anel deu a volta
```

**Diminuir** o deslocamento faz a faixa andar para a **direita**; aumentar faz andar para a esquerda. Mover a faixa inteira, com todos os seus troncos ou carros, é uma subtração num byte, seguida da correção para ficar entre 0 e 39:

```asm fragmento titulo="MOVE_FAIXAS: deslocamento -= direção (mod 40)"
        MOV  AL, desloc[BX]
        SUB  AL, direcao[BX]    ; direção: +1 (direita) ou -1 (esquerda)
        JNS  @@nao_neg
        ADD  AL, CASAS          ; -1 vira 39
@@nao_neg:
        CMP  AL, CASAS
        JB   @@guarda
        SUB  AL, CASAS          ; 40 vira 0
@@guarda:
        MOV  desloc[BX], AL
```

A tabela `direcao` guarda `1` ou `-1` (FFh). Subtrair FFh de um byte é o mesmo que somar 1, então a mesma instrução serve para os dois sentidos. `JNS` testa o bit de sinal do resultado: se ficou negativo (só pode ser −1), soma 40.

:::cpu Módulo sem DIV
Para manter um número entre 0 e 39 depois de somar ou subtrair 1, não é preciso dividir: basta um teste e uma correção. `DIV` de 8 bits custa uns 80 ciclos no 8086; `CMP` e `SUB` custam 4 cada. Se o tamanho do anel fosse uma potência de 2 (32 ou 64), daria para usar só `AND AL, 31`, sem teste nenhum. Muitos jogos escolhiam tamanhos assim exatamente por isso.
:::

### Cada faixa no seu ritmo

As faixas não andam todas na mesma velocidade. Cada uma tem um **período**: quantos tiques do relógio esperar entre um passo e outro. Um contador por faixa (`conta`) é decrementado a cada tique; quando chega a zero, a faixa anda uma casa e o contador recomeça.

```asm fragmento titulo="MOVE_FAIXAS: um contador por faixa"
MOVE_FAIXAS PROC
        XOR  BX, BX
@@faixa:
        DEC  conta[BX]
        JNZ  @@prox             ; ainda não é a vez desta faixa
        MOV  AL, periodo[BX]
        MOV  conta[BX], AL      ; recarrega o contador
        ...                     ; anda (desloc), carrega o sapo, redesenha
@@prox: INC  BX
        CMP  BX, FAIXAS
        JB   @@faixa
        RET
```

```diagrama titulo="Doze faixas, doze contadores"
   tique:          1   2   3   4   5   6   7   8   9  10  11  12
   faixa rua 4 (período 3):    ●           ●           ●           ●     anda a cada 3
   faixa rio 3 (período 4):        ●               ●               ●     anda a cada 4
   faixa rua 1 (período 9):                                    ●         anda a cada 9

   18,2 tiques por segundo:  período 3 = 6 casas/s, período 9 = 2 casas/s
```

Os períodos vêm da tabela `periodo_base` (de 3 a 9 tiques) e, a cada fase, `NOVA_FASE` subtrai o número da fase, com mínimo de 1: tudo fica mais rápido. É **uma** tabela de 12 bytes que define a dificuldade inteira do jogo, outro exemplo de dados no lugar de código.

:::dica Tabelas paralelas
O estado das faixas está espalhado em vários vetores do mesmo tamanho, todos indexados por BX: `desloc[BX]`, `periodo[BX]`, `conta[BX]`, `direcao[BX]`, `cor_faixa[BX]` e `desenho[BX*2]` (este é de words, por isso o `SHL BX,1`). Num programa em C seria um vetor de estruturas; em Assembly do 8086, vetores paralelos são mais simples de indexar, porque o mesmo BX serve para todos os campos de 1 byte.
:::

## Desenhar uma faixa

Desenhar a faixa é percorrer as 40 casas da tela pegando do desenho a casa `(x + desloc) mod 40`, transformar o símbolo em caractere e cor e gravar **duas vezes** com `STOSW`. O contador CL começa em `desloc` e dá a volta em 40, de novo sem divisão.

```asm fragmento titulo="DESENHA_FAIXA: 40 casas, 80 células"
        CALL LINHA_DA_FAIXA
        XOR  DL, DL
        CALL POSICAO            ; DI = começo da linha na tela
        MOV  DL, cor_faixa[BX]  ; DL = cor dos carros desta faixa
        MOV  DH, BL             ; DH = número da faixa
        MOV  CL, desloc[BX]     ; CL = casa do desenho na coluna 0
        SHL  BX, 1
        MOV  SI, desenho[BX]    ; SI = o desenho desta faixa
        MOV  CH, CASAS
@@casa: MOV  BL, CL
        XOR  BH, BH
        MOV  AL, [SI+BX]        ; o que tem nesta casa
        CALL GLIFO              ; AX = caractere e cor
        STOSW
        STOSW                   ; cada casa ocupa 2 colunas
        INC  CL
        CMP  CL, CASAS
        JB   @@seg
        XOR  CL, CL             ; deu a volta no desenho
@@seg:  DEC  CH
        JNZ  @@casa
```

`GLIFO` é a "tradução" de símbolo para célula de vídeo. O mesmo espaço vira **água** (≈ ciano sobre azul) numa faixa de rio e **asfalto** (preto) numa faixa de rua; por isso a rotina recebe em DH o número da faixa (0 a 5 é rio). Os carros (`<` e `>`) pegam a cor da tabela `cor_faixa`, uma cor por faixa, como os carrinhos coloridos do fliperama.

| Símbolo | Rio | Rua |
|---------|-----|-----|
| espaço | ≈ (F7h), 1Bh: água | espaço, 07h: asfalto |
| `=` | ▓ (B2h), 16h: tronco marrom | (não usado) |
| `o` | Θ (E9h), 1Ah: tartaruga verde | (não usado) |
| `#` | (não usado) | █ (DBh), 07h: caminhão cinza |
| `<` `>` | (não usado) | █ (DBh) na cor da faixa |

:::anos90 O mundo inteiro numa tela
Por que redesenhar a faixa inteira (160 bytes) e não só os carros que mudaram? Porque é **barato**: 80 `STOSW` numa memória de vídeo de texto são poucos milhares de ciclos, e cada faixa só anda algumas vezes por segundo. Em modo texto, a placa CGA original tinha o famoso "chuvisco" (*snow*) quando a CPU escrevia na memória de vídeo durante o traço; jogos para CGA esperavam o retraço horizontal antes de cada escrita. Placas EGA e VGA não têm esse problema, e o SAPO escreve à vontade.
:::

## O tempo do mundo: tiques da BIOS

O PAREDÃO e o LABIRINTO usam o retraço vertical (70 por segundo) como relógio. O SAPO usa o **tique da BIOS**, 18,2 por segundo, lido com a função 00h da INT 1Ah ([capítulo 7 do livro](livro:cap07)). É uma escolha natural: as faixas se movem casa a casa, e 18 passos por segundo é mais que suficiente. O laço principal fica girando, lendo o teclado o tempo todo, e só "avança o mundo" quando o tique muda:

```asm fragmento titulo="O laço do SAPO"
@@laco:
        CALL LER_TECLADO        ; o sapo pula assim que a tecla chega
        CMP  sair_pedido, 1
        JE   @@titulo
        CALL SOM_ATUALIZA
        CMP  pausado, 1
        JE   @@laco
        CALL LE_RELOGIO         ; mudou o tique?
        CMP  AX, ultimo_tique
        JE   @@laco             ; não: volta a olhar o teclado
        MOV  ultimo_tique, AX
        CALL MOVE_FAIXAS        ; um tique (1/18 s) de mundo
        CALL CONTA_TEMPO
        CALL CONFERE_SAPO       ; morreu? chegou?
        CMP  vidas, 0
        JNE  @@laco
```

```diagrama titulo="Duas velocidades no mesmo laço"
   laço girando sem parar ───────────────────────────────────────────►
      │ tecla? pula já     │ tecla? pula já     │ tecla? pula já
      │                    │                    │
   ───┴─── tique ──────────┴─── tique ──────────┴─── tique ─────────
          MOVE_FAIXAS            MOVE_FAIXAS            MOVE_FAIXAS
          CONTA_TEMPO            CONTA_TEMPO            CONTA_TEMPO
          CONFERE_SAPO           CONFERE_SAPO           CONFERE_SAPO
```

O teclado é atendido na hora, o mundo anda no ritmo do relógio. Funciona igual num 8088 de 4,77 MHz e num 486: a máquina mais rápida só dá mais voltas "vazias" no laço.

### Teclado pela INT 16h, de propósito

O PAREDÃO precisou da sua própria INT 9 porque a raquete se move **enquanto** a tecla está apertada. No SAPO, cada aperto é **um pulo**: é exatamente o comportamento da INT 16h, que entrega uma tecla por aperto (e repete se o jogador segurar, o que também faz sentido para um sapo). Então o jogo usa a BIOS como ela é: a função 01h pergunta se há tecla, sem esperar, e a 00h a retira do buffer. O scan code em AH distingue as setas, que não têm caractere ASCII. Tudo isso está no [capítulo do teclado](livro:cap06).

```asm fragmento titulo="LER_TECLADO: uma seta, um pulo"
        MOV  AH, 01h
        INT  16h                ; tem tecla? (ZF = 1: não)
        JNZ  @@tem
        RET
@@tem:  MOV  AH, 00h
        INT  16h                ; AL = ASCII, AH = scan code
        ...
        MOV  CL, sapo_x         ; CL, CH = para onde o sapo vai
        MOV  CH, sapo_y
        CMP  AH, TECLA_CIMA
        JNE  @@baixo
        DEC  CH
        JMP  SHORT @@pula
        ...
@@pula: PUSH CX
        CALL APAGA_SAPO         ; tira o sapo da casa velha
        POP  CX
        MOV  sapo_x, CL
        MOV  sapo_y, CH
        CMP  CH, melhor_y       ; linha nova mais perto das tocas: 10 pontos
        JAE  @@desenha
        MOV  melhor_y, CH
        ADD  pontos, 10
```

A pontuação por avanço usa `melhor_y`, a linha mais alta que **este** sapo já alcançou. Sem isso, o jogador ganharia pontos infinitos pulando para cima e para baixo.

:::dica OR AL, 20h: minúscula e maiúscula de uma vez
Para aceitar tanto `P` quanto `p`, o jogo faz `OR AL, 20h` antes de comparar com `'p'`. Em ASCII, maiúsculas e minúsculas diferem só no bit 5 (20h): ligar esse bit transforma qualquer letra em minúscula. Para não-letras pode dar resultados estranhos, mas aqui só interessa saber se é P.
:::

## Vivo ou morto: a casa embaixo do sapo

Como saber se um carro atropelou o sapo? Não é preciso guardar a posição de carro nenhum. Basta olhar **o que o desenho da faixa tem na casa onde o sapo está**, com a mesma conta do desenho:

```asm fragmento titulo="CASA_DO_SAPO: AL = o símbolo embaixo do sapo"
CASA_DO_SAPO PROC
        MOV  AL, sapo_x
        ADD  AL, desloc[BX]     ; casa do desenho = (sapo_x + desloc) mod 40
        CMP  AL, CASAS
        JB   @@ok
        SUB  AL, CASAS
@@ok:   PUSH BX
        PUSH SI
        SHL  BX, 1
        MOV  SI, desenho[BX]
        MOV  BL, AL
        XOR  BH, BH
        MOV  AL, [SI+BX]
        POP  SI
        POP  BX
        RET
CASA_DO_SAPO ENDP
```

A regra da morte vira duas comparações com o espaço, invertidas entre rio e rua:

| Onde | Espaço embaixo do sapo | Qualquer outra coisa |
|------|------------------------|----------------------|
| rua (faixas 6 a 11) | asfalto: vivo | carro ou caminhão: **morre** |
| rio (faixas 0 a 5) | água: **morre** | tronco ou tartaruga: vivo |

`CONFERE_SAPO` é chamada em dois momentos: depois de **cada pulo** (o sapo pode pular na frente de um carro) e a **cada tique** (um carro pode chegar até o sapo parado). Ela também cuida dos lugares seguros (canteiro e calçada), da linha das tocas e de um caso especial: o sapo que foi **carregado para fora da tela** por um tronco.

### Carregado pelo tronco

Quando uma faixa do rio anda e o sapo está nela, ele anda junto: `MOVE_FAIXAS` soma a direção da faixa em `sapo_x`. Se o tronco leva o sapo além da borda, `sapo_x` vira 40 (saiu pela direita) ou −1 (saiu pela esquerda). E aqui está um truque de 8086 que aparece o tempo todo em jogos:

```asm fragmento titulo="Um teste para os dois lados"
        CMP  sapo_x, CASAS      ; o tronco levou o sapo para fora da tela
        JAE  @@morre            ; (sapo_x = -1 vira 255: também cai aqui)
```

Como byte **sem sinal**, −1 é 255. Então "sapo_x ≥ 40, sem sinal" pega ao mesmo tempo quem passou da direita (40) e quem passou da esquerda (255). Uma comparação no lugar de duas. Você vai ver o mesmo truque nas tocas.

## As tocas

As cinco tocas ficam nas casas 3, 11, 19, 27 e 35 da linha 2 (`tocas_x`), e cada uma tem 2 casas de largura. O sapo que pula para a linha 2 entrou na toca BX se `sapo_x − tocas_x[BX]` for 0 ou 1. De novo, o teste sem sinal resolve os dois lados: se o sapo está à esquerda da toca, a subtração dá negativo, que sem sinal é um número grande, maior que 1.

```asm fragmento titulo="CHEGOU: em que toca o sapo pulou?"
        XOR  BX, BX
@@procura:
        MOV  AL, sapo_x
        SUB  AL, tocas_x[BX]    ; a toca tem 2 casas: diferença 0 ou 1
        CMP  AL, 1
        JBE  @@achou            ; sem sinal: negativo vira "muito grande"
        INC  BX
        CMP  BX, 5
        JB   @@procura
        JMP  MORRE              ; bateu no muro
@@achou:
        CMP  toca_cheia[BX], 0
        JE   @@entra
        JMP  MORRE              ; essa toca já tem sapo
@@entra:
        MOV  toca_cheia[BX], 1
        MOV  AL, tempo          ; 50 pontos + 10 por segundo que sobrou
        SHR  AL, 1
        MOV  AH, 10
        MUL  AH
        ADD  AX, 50
        ADD  pontos, AX
```

```diagrama titulo="A linha das tocas (casas)"
   casa:  0  1  2 [3  4] 5 ... 10 [11 12] 13 ... 18 [19 20] ... [27 28] ... [35 36] 37 38 39
          █  █  █  ░  ░  █      █   ░  ░   █      █   ░  ░        ░  ░        ░  ░   █  █  █
                   toca 0          toca 1            toca 2      toca 3      toca 4

   sapo_x = 12:  12 - 3 = 9 (não)   12 - 11 = 1 (sim: toca 1)
   sapo_x = 2:   2 - 3 = -1 = 255 sem sinal (não) ... nenhuma: bateu no muro
```

Com as cinco tocas cheias, o jogador ganha 1.000 pontos e `NOVA_FASE` esvazia as tocas e acelera as faixas.

## A barra do tempo

Cada sapo tem 30 segundos. O jogo conta em **meios segundos** (`tempo` começa em 60) usando o próprio tique: a cada 9 tiques (9 / 18,2 ≈ 0,49 s) `CONTA_TEMPO` diminui 1 e redesenha a barra. A barra tem um caractere por segundo, então tem `tempo / 2` blocos verdes, que ficam vermelhos quando sobram 10 segundos ou menos.

```asm fragmento titulo="MOSTRA_TEMPO: blocos cheios e o resto apagado"
        MOV  AH, 0Ah            ; verde claro
        CMP  tempo, 20
        JA   @@verde
        MOV  AH, 0Ch            ; vermelho claro nos últimos 10 segundos
@@verde:
        MOV  CL, tempo          ; cada caractere = 1 segundo = 2 unidades
        SHR  CL, 1
        XOR  CH, CH
        MOV  BX, CX
        MOV  AL, 0DBh           ; █
        JCXZ @@resto
        REP  STOSW
@@resto:
        MOV  CX, TEMPO_MAX/2    ; e apaga o que sobrou da barra velha
        SUB  CX, BX
        MOV  AX, 0720h
        JCXZ @@fim
        REP  STOSW
```

O `JCXZ` antes de cada `REP STOSW` é uma precaução importante: com CX = 0, `REP STOSW` não faz nada, mas um `LOOP` com CX = 0 daria **65.536** voltas. Aqui não seria um problema, mas o hábito de proteger contagens que podem ser zero evita muitos travamentos.

## Apagar o sapo redesenhando o cenário

O sapo não guarda "o que estava embaixo dele". Para apagá-lo, `APAGA_SAPO` simplesmente **redesenha a linha onde ele está**: a faixa, o canteiro, a calçada ou as tocas. Isso funciona porque o cenário inteiro pode ser reconstruído a partir do estado (desenhos, deslocamentos, tocas cheias).

Mas há uma armadilha: `DESENHA_FAIXA` termina redesenhando o sapo, se ele estiver naquela faixa (afinal, quando a faixa anda, ela passa por cima do sapo). Para apagar, o jogo precisa que a faixa seja desenhada **sem** o sapo. A solução é tirar o sapo do mundo por um instante:

```asm fragmento titulo="APAGA_SAPO: uma faixa sem sapo"
        MOV  AL, sapo_y
        MOV  sapo_y, 0          ; (0 = nenhuma faixa desenha o sapo)
        PUSH AX
        CALL DESENHA_FAIXA
        POP  AX
        MOV  sapo_y, AL         ; o sapo volta a existir
```

Nenhuma faixa fica na linha 0, então durante o `DESENHA_FAIXA` o sapo "não está" em lugar nenhum.

## Morrer

`MORRE` desenha um **X branco no vermelho** onde o sapo estava, toca um som grave e espera **18 tiques** (um segundo) com o mundo parado: nesse tempo só `SOM_ATUALIZA` roda. Depois apaga o sapo, tira uma vida e, se ainda houver vidas, chama `NOVO_SAPO`, que o coloca de volta na calçada com o tempo cheio. A variável `morto` impede que `CONFERE_SAPO` ou `CONTA_TEMPO` matem o mesmo sapo duas vezes durante essa espera.

```quiz
? A faixa tem `desloc = 5`. Qual casa do desenho aparece na casa 37 da tela?
- 42
+ 2
- 32
- 5
> (37 + 5) mod 40 = 42 − 40 = 2.

? A tabela `direcao` tem 1 para uma faixa. Para que lado ela anda?
+ Para a direita: o deslocamento diminui, e cada casa da tela passa a mostrar o que estava na casa à esquerda
- Para a esquerda
- Depende do período
- Ela não anda; só o sapo anda
> A casa x mostra desenho[(x + desloc) mod 40]. Com desloc − 1, a casa x mostra o que antes estava na casa x − 1: tudo se deslocou para a direita.

? Por que `CMP sapo_x, CASAS` / `JAE` pega também o sapo que saiu pela esquerda?
- Porque JAE testa o sinal
+ Porque −1 num byte sem sinal é 255, que é maior que 40
- Porque o tronco nunca vai para a esquerda
- Porque sapo_x é uma word
> JAE é uma comparação sem sinal. FFh = 255 ≥ 40, então o sapo fora da tela pelos dois lados cai no mesmo teste.

? No rio, quando o sapo morre?
- Quando encosta num tronco
+ Quando a casa do desenho embaixo dele é um espaço (água)
- Quando a faixa anda
- Nunca: o rio é seguro
> No rio a regra é invertida: estar em cima de alguma coisa (tronco, tartaruga) é seguro; espaço é água.

? Por que o SAPO lê o teclado pela INT 16h, enquanto o PAREDÃO instala a sua INT 9?
- Porque a INT 16h é mais rápida
+ Porque no SAPO cada aperto é um pulo, que é o que a INT 16h entrega; a raquete precisa saber se a tecla está apertada agora
- Porque o modo texto não tem INT 9
- Porque a INT 9 não funciona em .COM
> A INT 16h entrega caracteres, um por aperto (com repetição). Para movimento contínuo, só uma tabela de teclas apertadas mantida pela INT 9.

? Cada casa ocupa 2 colunas da tela. Por quê?
- Para economizar memória de vídeo
+ Porque o caractere é mais alto que largo; com 2 colunas a casa fica quase quadrada e os pulos ficam iguais nas 4 direções
- Porque o 8086 só escreve words
- Porque a tela tem 40 colunas
> Uma célula de texto tem proporção parecida com 1 × 2. Duas lado a lado formam um quadrado.
```

## O SAPO completo

Aperte **▶ Jogar**: ENTER começa, as setas pulam, P pausa e ESC volta ao título (ESC de novo sai).

```asm jogo titulo="SAPO.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  SAPO.ASM  -  atravesse a estrada e o rio (modo texto 80x25)  ║
; ║  Curso Assembly 8086, aula 38                                 ║
; ║                                                               ║
; ║  Programa .COM: TASM SAPO / TLINK /t SAPO                     ║
; ║  Setas pulam, P pausa, ESC sai.                               ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; A tela é dividida em "casas" de 2 colunas: 40 casas por linha.
; Cada faixa (rio ou rua) é um desenho de 40 casas que gira em volta
; de si mesmo; o deslocamento diz qual casa do desenho aparece na
; coluna 0. Mexer a faixa inteira = somar 1 no deslocamento.
; ---------------------------------------------------------------
CASAS       EQU 40
FAIXAS      EQU 12              ; 6 no rio e 6 na rua
LIN_TOCAS   EQU 2               ; as 5 tocas, lá em cima
LIN_RIO     EQU 3               ; linhas 3 a 8
LIN_CANTEIRO EQU 9              ; o canteiro do meio (seguro)
LIN_RUA     EQU 10              ; linhas 10 a 15
LIN_PARTIDA EQU 16
LIN_TEMPO   EQU 18
TEMPO_MAX   EQU 60              ; meio segundo cada: 30 segundos

COR_STATUS  EQU 1Fh
COR_AGUA    EQU 1Bh             ; ciano claro no azul
COR_TRONCO  EQU 16h             ; marrom no azul
COR_TARTA   EQU 1Ah             ; verde claro no azul
COR_CAMINHAO EQU 07h
COR_GRAMA   EQU 05h             ; magenta (a calçada roxa do fliperama)
COR_MURO    EQU 02h

TECLA_CIMA  EQU 48h
TECLA_BAIXO EQU 50h
TECLA_ESQ   EQU 4Bh
TECLA_DIR   EQU 4Dh

; ===============================================================
; Programa principal
; ===============================================================
inicio:
        MOV  AX, 0B800h
        MOV  ES, AX
        CLD
        CALL ESCONDE_CURSOR

@@titulo:
        CALL TELA_TITULO        ; AL = 27: sair
        CMP  AL, 27
        JE   @@sair
        CALL NOVO_JOGO
@@laco:
        CALL LER_TECLADO
        CMP  sair_pedido, 1
        JE   @@titulo
        CALL SOM_ATUALIZA
        CMP  pausado, 1
        JE   @@laco
        CALL LE_RELOGIO         ; mudou o tique?
        CMP  AX, ultimo_tique
        JE   @@laco
        MOV  ultimo_tique, AX
        CALL MOVE_FAIXAS        ; um tique (1/18 s) de mundo
        CALL CONTA_TEMPO
        CALL CONFERE_SAPO       ; morreu? chegou?
        CMP  vidas, 0
        JNE  @@laco
        CALL FIM_DE_JOGO
        JMP  @@titulo

@@sair: CALL SOM_DESLIGA
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ===============================================================
; Partida
; ===============================================================
NOVO_JOGO PROC
        MOV  pontos, 0
        MOV  vidas, 3
        MOV  fase, 0
        MOV  sair_pedido, 0
        MOV  pausado, 0
        CALL NOVA_FASE
        RET
NOVO_JOGO ENDP

; NOVA_FASE: tocas vazias, faixas mais rápidas a cada fase
NOVA_FASE PROC
        CALL LIMPA_TELA
        MOV  SI, OFFSET toca_cheia
        MOV  CX, 5
@@toca: MOV  BYTE PTR [SI], 0
        INC  SI
        LOOP @@toca
        XOR  BX, BX             ; período de cada faixa = base - fase
@@faixa:
        MOV  AL, periodo_base[BX]
        SUB  AL, fase
        CMP  AL, 1
        JGE  @@ok
        MOV  AL, 1
@@ok:   MOV  periodo[BX], AL
        MOV  conta[BX], AL
        INC  BX
        CMP  BX, FAIXAS
        JB   @@faixa
        CALL DESENHA_CENARIO
        CALL MOSTRA_STATUS
        CALL NOVO_SAPO
        RET
NOVA_FASE ENDP

; NOVO_SAPO: o sapo volta para a calçada de baixo, com o tempo cheio
NOVO_SAPO PROC
        MOV  sapo_x, CASAS/2
        MOV  sapo_y, LIN_PARTIDA
        MOV  melhor_y, LIN_PARTIDA
        MOV  tempo, TEMPO_MAX
        MOV  meio_seg, 9
        MOV  morto, 0
        CALL MOSTRA_TEMPO
        CALL DESENHA_SAPO
        RET
NOVO_SAPO ENDP

; ===============================================================
; Faixas
; ===============================================================

; MOVE_FAIXAS: cada faixa anda uma casa a cada "periodo" tiques.
; Se o sapo está numa faixa do rio que andou, ele anda junto.
MOVE_FAIXAS PROC
        XOR  BX, BX
@@faixa:
        DEC  conta[BX]
        JNZ  @@prox
        MOV  AL, periodo[BX]
        MOV  conta[BX], AL
        MOV  AL, desloc[BX]     ; deslocamento -= direção (mod 40)
        SUB  AL, direcao[BX]
        JNS  @@nao_neg
        ADD  AL, CASAS
@@nao_neg:
        CMP  AL, CASAS
        JB   @@guarda
        SUB  AL, CASAS
@@guarda:
        MOV  desloc[BX], AL
        CALL LINHA_DA_FAIXA     ; DH = linha da tela
        CMP  DH, sapo_y
        JNE  @@desenha
        CMP  BX, 6              ; faixa do rio: o sapo vai junto
        JAE  @@desenha
        MOV  AL, direcao[BX]
        ADD  sapo_x, AL
@@desenha:
        CALL DESENHA_FAIXA
@@prox: INC  BX
        CMP  BX, FAIXAS
        JB   @@faixa
        RET
MOVE_FAIXAS ENDP

; LINHA_DA_FAIXA: DH = linha da tela da faixa BX (0-5 rio, 6-11 rua)
LINHA_DA_FAIXA PROC
        MOV  DH, BL
        ADD  DH, LIN_RIO
        CMP  BL, 6
        JB   @@fim
        INC  DH                 ; pula o canteiro
@@fim:  RET
LINHA_DA_FAIXA ENDP

; DESENHA_FAIXA: as 40 casas da faixa BX, e o sapo se ele estiver nela
DESENHA_FAIXA PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        CALL LINHA_DA_FAIXA
        XOR  DL, DL
        CALL POSICAO            ; DI = começo da linha na tela
        MOV  DL, cor_faixa[BX]  ; DL = cor dos carros desta faixa
        MOV  DH, BL             ; DH = número da faixa
        MOV  CL, desloc[BX]     ; CL = casa do desenho na coluna 0
        SHL  BX, 1
        MOV  SI, desenho[BX]
        MOV  CH, CASAS
@@casa: MOV  BL, CL
        XOR  BH, BH
        MOV  AL, [SI+BX]        ; o que tem nesta casa
        CALL GLIFO              ; AX = caractere e cor
        STOSW
        STOSW                   ; cada casa ocupa 2 colunas
        INC  CL
        CMP  CL, CASAS
        JB   @@seg
        XOR  CL, CL             ; deu a volta no desenho
@@seg:  DEC  CH
        JNZ  @@casa
        POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        CALL LINHA_DA_FAIXA
        CMP  DH, sapo_y
        JNE  @@fim
        CALL DESENHA_SAPO       ; a faixa passou por cima: desenha de novo
@@fim:  RET
DESENHA_FAIXA ENDP

; GLIFO: transforma a casa AL do desenho em caractere e cor (AX).
; DH = faixa (0-5 é rio, onde o vazio é água), DL = cor dos carros.
GLIFO   PROC
        CMP  AL, ' '
        JNE  @@tronco
        MOV  AX, 0720h          ; rua vazia
        CMP  DH, 6
        JAE  @@fim
        MOV  AX, COR_AGUA*256 + 0F7h   ; ≈ água
        RET
@@tronco:
        CMP  AL, '='
        JNE  @@tartaruga
        MOV  AX, COR_TRONCO*256 + 0B2h ; ▓
        RET
@@tartaruga:
        CMP  AL, 'o'
        JNE  @@caminhao
        MOV  AX, COR_TARTA*256 + 0E9h  ; Θ
        RET
@@caminhao:
        CMP  AL, '#'
        JNE  @@carro
        MOV  AX, COR_CAMINHAO*256 + 0DBh
        RET
@@carro:
        MOV  AH, DL             ; < ou >: carro na cor da faixa
        MOV  AL, 0DBh
@@fim:  RET
GLIFO   ENDP

; CASA_DO_SAPO: AL = o que está na casa embaixo do sapo, na faixa BX
CASA_DO_SAPO PROC
        MOV  AL, sapo_x
        ADD  AL, desloc[BX]
        CMP  AL, CASAS
        JB   @@ok
        SUB  AL, CASAS
@@ok:   PUSH BX
        PUSH SI
        SHL  BX, 1
        MOV  SI, desenho[BX]
        MOV  BL, AL
        XOR  BH, BH
        MOV  AL, [SI+BX]
        POP  SI
        POP  BX
        RET
CASA_DO_SAPO ENDP

; ===============================================================
; O sapo
; ===============================================================
LER_TECLADO PROC
        MOV  AH, 01h
        INT  16h
        JNZ  @@tem
        RET
@@tem:  MOV  AH, 00h
        INT  16h
        CMP  AL, 27
        JNE  @@nao_esc
        MOV  sair_pedido, 1
        RET
@@nao_esc:
        OR   AL, 20h
        CMP  AL, 'p'
        JNE  @@nao_p
        XOR  pausado, 1
        RET
@@nao_p:
        CMP  pausado, 1         ; pausado, as setas não valem
        JE   @@fim
        CMP  morto, 0
        JNE  @@fim
        MOV  CL, sapo_x
        MOV  CH, sapo_y
        CMP  AH, TECLA_CIMA
        JNE  @@baixo
        DEC  CH
        JMP  SHORT @@pula
@@baixo:
        CMP  AH, TECLA_BAIXO
        JNE  @@esq
        CMP  CH, LIN_PARTIDA    ; não sai por baixo
        JAE  @@fim
        INC  CH
        JMP  SHORT @@pula
@@esq:  CMP  AH, TECLA_ESQ
        JNE  @@dir
        OR   CL, CL
        JZ   @@fim
        DEC  CL
        JMP  SHORT @@pula
@@dir:  CMP  AH, TECLA_DIR
        JNE  @@fim
        CMP  CL, CASAS-1
        JAE  @@fim
        INC  CL
@@pula: PUSH CX
        CALL APAGA_SAPO
        POP  CX
        MOV  sapo_x, CL
        MOV  sapo_y, CH
        CMP  CH, melhor_y       ; linha nova mais perto das tocas: 10 pontos
        JAE  @@desenha
        MOV  melhor_y, CH
        ADD  pontos, 10
        CALL MOSTRA_STATUS
@@desenha:
        CALL DESENHA_SAPO
        MOV  BX, 2500           ; "ploc"
        MOV  CL, 1
        CALL SOM_LIGA
        CALL CONFERE_SAPO       ; pode ter pulado na frente de um carro
@@fim:  RET
LER_TECLADO ENDP

; CONFERE_SAPO: decide se o sapo está vivo onde está
CONFERE_SAPO PROC
        CMP  morto, 0
        JNE  @@fim
        CMP  sapo_x, CASAS      ; o tronco levou o sapo para fora da tela
        JAE  @@morre            ; (sapo_x = -1 vira 255: também cai aqui)
        MOV  AL, sapo_y
        CMP  AL, LIN_TOCAS
        JE   @@toca
        CMP  AL, LIN_RIO
        JB   @@fim
        CMP  AL, LIN_CANTEIRO
        JE   @@fim              ; canteiro e calçada são seguros
        CMP  AL, LIN_PARTIDA
        JE   @@fim
        MOV  BL, AL             ; BX = faixa
        SUB  BL, LIN_RIO
        CMP  AL, LIN_CANTEIRO
        JB   @@faixa
        DEC  BL
@@faixa:
        XOR  BH, BH
        CALL CASA_DO_SAPO
        CMP  BX, 6
        JAE  @@rua
        CMP  AL, ' '            ; rio: em cima da água afunda
        JE   @@morre
        RET
@@rua:  CMP  AL, ' '            ; rua: qualquer coisa que não seja vazio atropela
        JNE  @@morre
@@fim:  RET
@@morre:
        CALL MORRE
        RET
@@toca: CALL CHEGOU
        RET
CONFERE_SAPO ENDP

; CHEGOU: o sapo pulou para a linha das tocas. Acertou uma toca vazia?
CHEGOU  PROC
        XOR  BX, BX
@@procura:
        MOV  AL, sapo_x
        SUB  AL, tocas_x[BX]    ; a toca tem 2 casas: diferença 0 ou 1
        CMP  AL, 1
        JBE  @@achou
        INC  BX
        CMP  BX, 5
        JB   @@procura
        JMP  MORRE              ; bateu no muro
@@achou:
        CMP  toca_cheia[BX], 0
        JE   @@entra
        JMP  MORRE              ; essa toca já tem sapo
@@entra:
        MOV  toca_cheia[BX], 1
        MOV  AL, tempo          ; 50 pontos + 10 por segundo que sobrou
        SHR  AL, 1
        MOV  AH, 10
        MUL  AH
        ADD  AX, 50
        ADD  pontos, AX
        MOV  BX, 1000
        MOV  CL, 6
        CALL SOM_LIGA
        CALL DESENHA_TOCAS
        MOV  SI, OFFSET toca_cheia    ; as 5 cheias? próxima fase
        MOV  CX, 5
@@confere:
        LODSB
        OR   AL, AL
        JZ   @@outro
        LOOP @@confere
        ADD  pontos, 1000
        INC  fase
        CALL NOVA_FASE
        RET
@@outro:
        CALL MOSTRA_STATUS
        CALL NOVO_SAPO
        RET
CHEGOU  ENDP

; MORRE: mostra o sapo esmagado, espera um segundo e tira uma vida
MORRE   PROC
        MOV  morto, 1
        MOV  BX, 9000
        MOV  CL, 12
        CALL SOM_LIGA
        CMP  sapo_x, CASAS
        JAE  @@espera           ; fora da tela: não há o que desenhar
        MOV  DH, sapo_y
        MOV  DL, sapo_x
        SHL  DL, 1
        MOV  AX, 4F58h          ; X branco no vermelho
        CALL POE_CEL
        INC  DL
        CALL POE_CEL
@@espera:
        MOV  CX, 18             ; um segundo, com o mundo parado
@@tique:
        CALL LE_RELOGIO
        CMP  AX, ultimo_tique
        JE   @@tique
        MOV  ultimo_tique, AX
        CALL SOM_ATUALIZA
        LOOP @@tique
        CALL APAGA_SAPO
        DEC  vidas
        CALL MOSTRA_STATUS
        CMP  vidas, 0
        JE   @@fim
        CALL NOVO_SAPO
@@fim:  RET
MORRE   ENDP

; CONTA_TEMPO: a cada 9 tiques (meio segundo) a barra encolhe
CONTA_TEMPO PROC
        CMP  morto, 0
        JNE  @@fim
        DEC  meio_seg
        JNZ  @@fim
        MOV  meio_seg, 9
        DEC  tempo
        CALL MOSTRA_TEMPO
        CMP  tempo, 0
        JNE  @@fim
        CALL MORRE              ; acabou o tempo
@@fim:  RET
CONTA_TEMPO ENDP

; DESENHA_SAPO / APAGA_SAPO: o sapo é "▐▌" verde. Para apagar, basta
; redesenhar o que estava embaixo dele (a faixa, o canteiro...).
DESENHA_SAPO PROC
        CMP  sapo_x, CASAS
        JAE  @@fim
        MOV  DH, sapo_y
        MOV  DL, sapo_x
        SHL  DL, 1
        MOV  AH, 0Ah            ; verde claro no preto...
        CMP  DH, LIN_RIO
        JB   @@cor
        CMP  DH, LIN_CANTEIRO
        JAE  @@cor
        MOV  AH, 1Ah            ; ...ou no azul, se estiver no rio
@@cor:  MOV  AL, 0DEh           ; ▐
        CALL POE_CEL
        INC  DL
        MOV  AL, 0DDh           ; ▌
        CALL POE_CEL
@@fim:  RET
DESENHA_SAPO ENDP

APAGA_SAPO PROC
        MOV  AL, sapo_y
        CMP  AL, LIN_TOCAS
        JE   @@tocas
        CMP  AL, LIN_CANTEIRO
        JE   @@calcada
        CMP  AL, LIN_PARTIDA
        JE   @@calcada
        MOV  BL, AL             ; é uma faixa: redesenha a faixa sem o sapo
        SUB  BL, LIN_RIO
        CMP  AL, LIN_CANTEIRO
        JB   @@faixa
        DEC  BL
@@faixa:
        XOR  BH, BH
        MOV  AL, sapo_y
        MOV  sapo_y, 0          ; (0 = nenhuma faixa desenha o sapo)
        PUSH AX
        CALL DESENHA_FAIXA
        POP  AX
        MOV  sapo_y, AL
        RET
@@calcada:
        MOV  DH, AL
        CALL DESENHA_CALCADA
        RET
@@tocas:
        CALL DESENHA_TOCAS
        RET
APAGA_SAPO ENDP

; ===============================================================
; Cenário
; ===============================================================
DESENHA_CENARIO PROC
        CALL DESENHA_TOCAS
        XOR  BX, BX
@@faixa:
        CALL DESENHA_FAIXA
        INC  BX
        CMP  BX, FAIXAS
        JB   @@faixa
        MOV  DH, LIN_CANTEIRO
        CALL DESENHA_CALCADA
        MOV  DH, LIN_PARTIDA
        CALL DESENHA_CALCADA
        MOV  DH, 21             ; ajuda
        MOV  DL, 17
        MOV  AH, 07h
        MOV  SI, OFFSET txt_ajuda
        CALL ESCREVE
        RET
DESENHA_CENARIO ENDP

; DESENHA_CALCADA: a linha DH inteira de ▒ roxo
DESENHA_CALCADA PROC
        XOR  DL, DL
        CALL POSICAO
        MOV  AX, COR_GRAMA*256 + 0B1h
        MOV  CX, 80
        REP  STOSW
        RET
DESENHA_CALCADA ENDP

; DESENHA_TOCAS: muro verde com 5 tocas (pretas, ou com um sapo dentro)
DESENHA_TOCAS PROC
        MOV  DH, LIN_TOCAS
        XOR  DL, DL
        CALL POSICAO
        MOV  AX, COR_MURO*256 + 0DBh
        MOV  CX, 80
        REP  STOSW
        XOR  BX, BX
@@toca: MOV  DL, tocas_x[BX]
        SHL  DL, 1
        CALL POSICAO
        MOV  AX, 0020h          ; vazia: preto
        CMP  toca_cheia[BX], 0
        JE   @@pinta
        MOV  AX, 0ADEh          ; com sapo: ▐▌ verde
@@pinta:
        STOSW
        CMP  AL, ' '
        JE   @@mesma
        MOV  AL, 0DDh
@@mesma:
        STOSW
        STOSW
        STOSW
        INC  BX
        CMP  BX, 5
        JB   @@toca
        RET
DESENHA_TOCAS ENDP

; MOSTRA_STATUS: linha 0, branco no azul
MOSTRA_STATUS PROC
        XOR  DX, DX
        MOV  AH, COR_STATUS
        MOV  SI, OFFSET txt_status
        CALL ESCREVE
        MOV  DL, 8
        MOV  AX, pontos
        CALL ESCREVE_NUM
        MOV  DL, 25
        MOV  AX, recorde
        CALL ESCREVE_NUM
        MOV  DL, 38
        MOV  AL, vidas
        XOR  AH, AH
        CALL ESCREVE_NUM
        MOV  DL, 51
        MOV  AL, fase
        XOR  AH, AH
        INC  AX
        CALL ESCREVE_NUM
        RET
MOSTRA_STATUS ENDP

; MOSTRA_TEMPO: barra de 30 casas; fica vermelha nos últimos 10 segundos
MOSTRA_TEMPO PROC
        MOV  DH, LIN_TEMPO
        MOV  DL, 10
        MOV  AH, 07h
        MOV  SI, OFFSET txt_tempo
        CALL ESCREVE
        MOV  DL, 17
        CALL POSICAO
        MOV  AH, 0Ah
        CMP  tempo, 20
        JA   @@verde
        MOV  AH, 0Ch
@@verde:
        MOV  CL, tempo          ; cada caractere = 1 segundo = 2 unidades
        SHR  CL, 1
        XOR  CH, CH
        MOV  BX, CX
        MOV  AL, 0DBh
        JCXZ @@resto
        REP  STOSW
@@resto:
        MOV  CX, TEMPO_MAX/2
        SUB  CX, BX
        MOV  AX, 0720h
        JCXZ @@fim
        REP  STOSW
@@fim:  RET
MOSTRA_TEMPO ENDP

TELA_TITULO PROC
        CALL LIMPA_TELA
        XOR  BX, BX
        MOV  sapo_y, 0          ; nenhum sapo nas faixas
@@faixa:
        CALL DESENHA_FAIXA
        INC  BX
        CMP  BX, FAIXAS
        JB   @@faixa
        MOV  DH, LIN_CANTEIRO
        CALL DESENHA_CALCADA
        MOV  DH, 7
        MOV  SI, OFFSET txt_quadro
        MOV  AH, 2Fh
@@linha:
        MOV  DL, 26
        CALL ESCREVE
        INC  DH
        CMP  BYTE PTR [SI], 0
        JNE  @@linha
@@espera:
        MOV  AH, 00h
        INT  16h
        CMP  AL, 27
        JE   @@fim
        CMP  AL, 13
        JNE  @@espera
@@fim:  RET
TELA_TITULO ENDP

FIM_DE_JOGO PROC
        MOV  AX, pontos
        CMP  AX, recorde
        JBE  @@msg
        MOV  recorde, AX
        CALL MOSTRA_STATUS
@@msg:  MOV  DH, 8
        MOV  SI, OFFSET txt_fim
        MOV  AH, 4Fh
@@linha:
        MOV  DL, 26
        CALL ESCREVE
        INC  DH
        CMP  BYTE PTR [SI], 0
        JNE  @@linha
@@limpa:
        MOV  AH, 01h            ; descarta teclas velhas
        INT  16h
        JZ   @@espera
        MOV  AH, 00h
        INT  16h
        JMP  @@limpa
@@espera:
        CALL SOM_ATUALIZA
        MOV  AH, 01h
        INT  16h
        JZ   @@espera
        MOV  AH, 00h
        INT  16h
        CMP  AL, 13
        JNE  @@espera
        RET
FIM_DE_JOGO ENDP

; ===============================================================
; Tela de texto, tempo e som (as rotinas da cobra)
; ===============================================================
POSICAO PROC
        PUSH BX
        MOV  BL, DH
        XOR  BH, BH
        SHL  BX, 1
        MOV  DI, linhas[BX]
        MOV  BL, DL
        XOR  BH, BH
        SHL  BX, 1
        ADD  DI, BX
        POP  BX
        RET
POSICAO ENDP

POE_CEL PROC
        PUSH DI
        CALL POSICAO
        MOV  ES:[DI], AX
        POP  DI
        RET
POE_CEL ENDP

ESCREVE PROC
        PUSH DI
        CALL POSICAO
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        STOSW
        JMP  @@car
@@fim:  POP  DI
        RET
ESCREVE ENDP

; ESCREVE_NUM: AX com 5 dígitos na linha 0, coluna DL (cor da barra)
ESCREVE_NUM PROC
        PUSH DX
        MOV  DH, 0
        CALL POSICAO
        ADD  DI, 8
        MOV  BX, 10
        MOV  CX, 5
@@dig:  XOR  DX, DX
        DIV  BX
        ADD  DL, '0'
        MOV  ES:[DI], DL
        MOV  BYTE PTR ES:[DI+1], COR_STATUS
        SUB  DI, 2
        LOOP @@dig
        POP  DX
        RET
ESCREVE_NUM ENDP

LIMPA_TELA PROC
        XOR  DI, DI
        MOV  AX, 0720h
        MOV  CX, 2000
        REP  STOSW
        RET
LIMPA_TELA ENDP

ESCONDE_CURSOR PROC
        MOV  AH, 01h
        MOV  CX, 2000h
        INT  10h
        RET
ESCONDE_CURSOR ENDP

LE_RELOGIO PROC
        PUSH CX
        PUSH DX
        MOV  AH, 00h
        INT  1Ah
        MOV  AX, DX
        POP  DX
        POP  CX
        RET
LE_RELOGIO ENDP

SOM_LIGA PROC
        PUSH AX
        PUSH CX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  AL, BL
        OUT  42h, AL
        MOV  AL, BH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        CALL LE_RELOGIO
        XOR  CH, CH
        ADD  AX, CX
        MOV  som_fim, AX
        MOV  som_ligado, 1
        POP  CX
        POP  AX
        RET
SOM_LIGA ENDP

SOM_ATUALIZA PROC
        CMP  som_ligado, 1
        JNE  @@fim
        PUSH AX
        CALL LE_RELOGIO
        CMP  AX, som_fim
        POP  AX
        JB   @@fim
        CALL SOM_DESLIGA
@@fim:  RET
SOM_ATUALIZA ENDP

SOM_DESLIGA PROC
        PUSH AX
        IN   AL, 61h
        AND  AL, 0FCh
        OUT  61h, AL
        MOV  som_ligado, 0
        POP  AX
        RET
SOM_DESLIGA ENDP

; ===============================================================
; Dados
; ===============================================================
; os desenhos das faixas: ' ' = água (rio) ou asfalto (rua),
; '=' tronco, 'o' tartaruga, '#' caminhão, '<' e '>' carros
f_rio1      DB '====     =====      ====     ======     '
f_rio2      DB 'ooo    ooo    ooo     ooo     ooo       '
f_rio3      DB '=======        ========        =====    '
f_rio4      DB 'oo      oo      oo      oo      oo      '
f_rio5      DB '=====    =====    =====    ====         '
f_rio6      DB '====    ======      ===     =====       '
f_rua1      DB '###       ###          ###         ##   '
f_rua2      DB '>>      >>         >>        >>         '
f_rua3      DB '<<       <<     <<        <<            '
f_rua4      DB '>>           >>           >>            '
f_rua5      DB '####          ####           ###        '
f_rua6      DB '<<     <<      <<       <<      <<      '

desenho     DW f_rio1, f_rio2, f_rio3, f_rio4, f_rio5, f_rio6
            DW f_rua1, f_rua2, f_rua3, f_rua4, f_rua5, f_rua6
direcao     DB 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1
periodo_base DB 6, 8, 4, 7, 9, 5, 9, 6, 8, 3, 7, 5
cor_faixa   DB 0, 0, 0, 0, 0, 0, 0, 0Eh, 0Dh, 0Ch, 0, 0Bh
tocas_x     DB 3, 11, 19, 27, 35

linhas      DW  0*160,  1*160,  2*160,  3*160,  4*160,  5*160,  6*160,  7*160
            DW  8*160,  9*160, 10*160, 11*160, 12*160, 13*160, 14*160, 15*160
            DW 16*160, 17*160, 18*160, 19*160, 20*160, 21*160, 22*160, 23*160
            DW 24*160

txt_status  DB ' PONTOS          RECORDE         VIDAS        FASE      '
            DB '                        ', 0
txt_tempo   DB 'TEMPO', 0
txt_ajuda   DB 'setas pulam   P pausa   ESC sai', 0
txt_quadro  DB '                            ', 0
            DB '         S  A  P  O         ', 0
            DB '                            ', 0
            DB '  leve os 5 sapos para as   ', 0
            DB '  tocas do outro lado       ', 0
            DB '                            ', 0
            DB '  ENTER joga     ESC sai    ', 0
            DB '                            ', 0, 0
txt_fim     DB '                            ', 0
            DB '        FIM DE JOGO         ', 0
            DB '     ENTER volta ao menu    ', 0
            DB '                            ', 0, 0

; estado
desloc      DB FAIXAS DUP (0)
periodo     DB FAIXAS DUP (1)
conta       DB FAIXAS DUP (1)
toca_cheia  DB 5 DUP (0)
pontos      DW 0
recorde     DW 0
vidas       DB 3
fase        DB 0
sapo_x      DB 0
sapo_y      DB 0
melhor_y    DB 0
tempo       DB 0
meio_seg    DB 9
morto       DB 0
pausado     DB 0
sair_pedido DB 0
ultimo_tique DW 0
som_fim     DW 0
som_ligado  DB 0

END inicio
```

:::dica Rotinas emprestadas
`POSICAO` (com a tabela `linhas` de linha × 160 pronta), `POE_CEL`, `ESCREVE`, `ESCREVE_NUM`, `LIMPA_TELA`, `LE_RELOGIO` e as três rotinas de som são as mesmas da cobra, com uma ou outra mudança de cor. Num projeto dos anos 90 elas estariam num arquivo `TELA.INC` incluído por todos os jogos. O montador do curso não tem `INCLUDE`, por isso cada jogo traz a sua cópia.
:::

## Exercícios

```exercicio
id: a38-1
titulo: O anel de 40 casas
nivel: 1
--- enunciado
AL chega com o deslocamento de uma faixa (0 a 39) e AH com a direção: **1** (direita) ou **−1** (FFh, esquerda). Calcule o novo deslocamento, **AL = (AL − AH) mod 40**, sempre entre 0 e 39. Não use DIV.
--- inicial
; AL = deslocamento (0 a 39), AH = direção (1 ou -1)
; AL = (AL - AH) mod 40
--- testes
[{ "nome": "5 andando para a direita", "setup": { "AL": 5, "AH": 1 }, "espera": { "AL": 4 } },
 { "nome": "0 andando para a direita dá a volta", "setup": { "AL": 0, "AH": 1 }, "espera": { "AL": 39 } },
 { "nome": "39 andando para a esquerda dá a volta", "setup": { "AL": 39, "AH": 255 }, "espera": { "AL": 0 } },
 { "nome": "10 andando para a esquerda", "setup": { "AL": 10, "AH": 255 }, "espera": { "AL": 11 } },
 { "nome": "1 para a direita", "setup": { "AL": 1, "AH": 1 }, "espera": { "AL": 0 } }]
--- dicas
SUB AL,AH faz as duas contas: subtrair −1 é somar 1.
Se o resultado ficou negativo (JNS não salta), some 40.
Se ficou 40 ou mais (CMP AL,40 / JB), subtraia 40.
--- solucao
; AL = deslocamento (0 a 39), AH = direção (1 ou -1)
        SUB  AL, AH
        JNS  nao_neg
        ADD  AL, 40
nao_neg:
        CMP  AL, 40
        JB   pronto
        SUB  AL, 40
pronto:
```

```exercicio
id: a38-2
titulo: O que está embaixo do sapo?
nivel: 2
--- enunciado
A faixa tem o desenho de 40 casas em `faixa` e o deslocamento em `desloc`. O sapo está na casa `sapo_x` da tela (0 a 39). Devolva em **AL** o símbolo do desenho que aparece embaixo dele: `faixa[(sapo_x + desloc) mod 40]`.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL CASA_DO_SAPO
        MOV  AH, 4Ch
        INT  21h

CASA_DO_SAPO PROC
        ; AL = faixa[(sapo_x + desloc) mod 40]
        RET
CASA_DO_SAPO ENDP

faixa   DB '====     =====      ====     ======     '
desloc  DB 0
sapo_x  DB 0
END inicio
--- testes
[{ "nome": "sem deslocamento, em cima do tronco", "setup": { "AX": 0, "sapo_x": 2, "desloc": 0 }, "espera": { "AL": 61 } },
 { "nome": "sem deslocamento, na água", "setup": { "AX": 0, "sapo_x": 5, "desloc": 0 }, "espera": { "AL": 32 } },
 { "nome": "deslocamento 3", "setup": { "AX": 0, "sapo_x": 2, "desloc": 3 }, "espera": { "AL": 32 } },
 { "nome": "dá a volta no anel", "setup": { "AX": 0, "sapo_x": 38, "desloc": 5 }, "espera": { "AL": 61 } },
 { "nome": "outro desenho", "setup": { "AX": 0, "faixa": "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd", "sapo_x": 39, "desloc": 39 }, "espera": { "AL": 99 } }]
--- dicas
MOV AL,sapo_x / ADD AL,desloc. Se der 40 ou mais, SUB AL,40.
Para indexar: MOV BL,AL / XOR BH,BH / MOV AL,faixa[BX].
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL CASA_DO_SAPO
        MOV  AH, 4Ch
        INT  21h

CASA_DO_SAPO PROC
        MOV  AL, sapo_x
        ADD  AL, desloc
        CMP  AL, 40
        JB   @@ok
        SUB  AL, 40
@@ok:   MOV  BL, AL
        XOR  BH, BH
        MOV  AL, faixa[BX]
        RET
CASA_DO_SAPO ENDP

faixa   DB '====     =====      ====     ======     '
desloc  DB 0
sapo_x  DB 0
END inicio
```

```exercicio
id: a38-3
titulo: Em que toca?
nivel: 2
--- enunciado
As 5 tocas começam nas casas guardadas em `tocas_x` (3, 11, 19, 27 e 35), e cada toca tem **2 casas** de largura. AL chega com a casa do sapo (0 a 39). Devolva em **BX** o número da toca em que ele caiu (0 a 4), ou **BX = 5** se ele bateu no muro.

Use o truque da aula: `AL − tocas_x[BX]` comparado **sem sinal** com 1 resolve os dois lados de uma vez.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL QUAL_TOCA
        MOV  AX, 4C00h
        INT  21h

QUAL_TOCA PROC
        ; AL = casa do sapo -> BX = toca (0 a 4) ou 5
        RET
QUAL_TOCA ENDP

tocas_x DB 3, 11, 19, 27, 35
END inicio
--- testes
[{ "nome": "primeira casa da toca 0", "setup": { "AL": 3, "BX": 9 }, "espera": { "BX": 0 } },
 { "nome": "segunda casa da toca 1", "setup": { "AL": 12, "BX": 9 }, "espera": { "BX": 1 } },
 { "nome": "toca 4", "setup": { "AL": 36, "BX": 9 }, "espera": { "BX": 4 } },
 { "nome": "muro à esquerda da toca 0", "setup": { "AL": 2, "BX": 9 }, "espera": { "BX": 5 } },
 { "nome": "muro entre tocas", "setup": { "AL": 13, "BX": 9 }, "espera": { "BX": 5 } },
 { "nome": "toca 2", "setup": { "AL": 19, "BX": 9 }, "espera": { "BX": 2 } },
 { "nome": "muro no fim", "setup": { "AL": 39, "BX": 9 }, "espera": { "BX": 5 } }]
--- dicas
Comece com BX = 0 e repita até BX chegar a 5.
Copie AL para AH, faça SUB AH,tocas_x[BX] e CMP AH,1 / JBE achou.
Se o laço terminar, BX já vale 5.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL QUAL_TOCA
        MOV  AX, 4C00h
        INT  21h

QUAL_TOCA PROC
        XOR  BX, BX
@@procura:
        MOV  AH, AL
        SUB  AH, tocas_x[BX]
        CMP  AH, 1
        JBE  @@achou            ; 0 ou 1; negativo é "muito grande"
        INC  BX
        CMP  BX, 5
        JB   @@procura
@@achou:
        RET
QUAL_TOCA ENDP

tocas_x DB 3, 11, 19, 27, 35
END inicio
```

```exercicio
id: a38-4
titulo: Girar a faixa com MOVSB
nivel: 2
exigir: MOVSB
--- enunciado
Outro jeito de animar uma faixa, usado por muitos jogos: em vez de guardar um deslocamento, **girar o próprio desenho** na memória. Gire os 40 bytes de `faixa` **uma casa para a esquerda**: cada byte vai para a posição anterior e o primeiro byte vai para o fim. Use **REP MOVSB** para mover os 39 bytes.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL GIRA
        MOV  AX, 4C00h
        INT  21h

GIRA    PROC
        ; gira faixa uma casa para a esquerda
        RET
GIRA    ENDP

faixa   DB 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd'
END inicio
--- testes
[{ "nome": "letras e números", "espera": { "mem": { "faixa": ["B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9","a","b","c","d","A"] } } },
 { "nome": "um tronco na ponta", "setup": { "faixa": "=====                                 ==" }, "espera": { "mem": { "faixa": ["=","=","=","="," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," "," ","=","=","="] } } },
 { "nome": "carros", "setup": { "faixa": ">>      >>         >>        >>         " }, "espera": { "mem": { "faixa": [">"," "," "," "," "," "," ",">",">"," "," "," "," "," "," "," "," "," ",">",">"," "," "," "," "," "," "," "," ",">",">"," "," "," "," "," "," "," "," "," ",">"] } } }]
--- dicas
Guarde o primeiro byte (MOV AL,faixa) antes de mover.
SI = OFFSET faixa + 1, DI = OFFSET faixa, CX = 39, CLD e REP MOVSB. Num .COM, ES já é igual a DS.
Depois do REP MOVSB, DI aponta exatamente para o último byte: MOV [DI],AL.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL GIRA
        MOV  AX, 4C00h
        INT  21h

GIRA    PROC
        MOV  AL, faixa          ; o primeiro vai para o fim
        MOV  SI, OFFSET faixa+1
        MOV  DI, OFFSET faixa
        MOV  CX, 39
        CLD
        REP  MOVSB
        MOV  [DI], AL
        RET
GIRA    ENDP

faixa   DB 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd'
END inicio
```

```exercicio
id: a38-5
titulo: Desenhar a faixa em células duplas
nivel: 3
exigir: STOSW
--- enunciado
Desenhe a faixa na **linha 5** da tela de texto (que começa no byte 5 × 160 = 800 de B800h). Cada uma das 40 casas ocupa **2 colunas**: a casa x da tela mostra `faixa[(x + desloc) mod 40]`, escrito **duas vezes**, com atributo **07h**. A primeira linha da rotina já põe ES em B800h.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: MOV  AX, 0B800h
        MOV  ES, AX
        CALL DESENHA
        MOV  AX, 4C00h
        INT  21h

DESENHA PROC
        ; linha 5, 40 casas de 2 colunas, atributo 07h
        RET
DESENHA ENDP

faixa   DB 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd'
desloc  DB 0
END inicio
--- testes
[{ "nome": "deslocamento 0", "setup": { "desloc": 0 }, "espera": { "video": { "400": ["A", 7], "401": ["A", 7], "402": ["B", 7], "403": ["B", 7], "450": ["Z", 7], "478": ["d", 7], "479": ["d", 7] } } },
 { "nome": "deslocamento 37: dá a volta", "setup": { "desloc": 37 }, "espera": { "video": { "400": ["b", 7], "401": ["b", 7], "402": ["c", 7], "404": ["d", 7], "406": ["A", 7], "407": ["A", 7], "479": ["a", 7] } } },
 { "nome": "deslocamento 20", "setup": { "desloc": 20 }, "espera": { "video": { "400": ["U", 7], "440": ["A", 7], "441": ["A", 7], "479": ["T", 7] } } }]
--- dicas
DI = 800, SI = OFFSET faixa, CL = desloc, CH = 40 (contador de casas), AH = 07h, CLD.
Em cada volta: MOV BL,CL / XOR BH,BH / MOV AL,[SI+BX], depois STOSW duas vezes.
INC CL; se chegou a 40, zere CL (deu a volta no desenho). DEC CH / JNZ.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: MOV  AX, 0B800h
        MOV  ES, AX
        CALL DESENHA
        MOV  AX, 4C00h
        INT  21h

DESENHA PROC
        MOV  DI, 5*160
        MOV  SI, OFFSET faixa
        MOV  CL, desloc
        MOV  CH, 40
        MOV  AH, 07h
        CLD
@@casa: MOV  BL, CL
        XOR  BH, BH
        MOV  AL, [SI+BX]
        STOSW
        STOSW                   ; a casa ocupa 2 colunas
        INC  CL
        CMP  CL, 40
        JB   @@seg
        XOR  CL, CL             ; deu a volta no desenho
@@seg:  DEC  CH
        JNZ  @@casa
        RET
DESENHA ENDP

faixa   DB 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd'
desloc  DB 0
END inicio
```

## Desafios

1. **Tartarugas que mergulham.** No Frogger original, algumas tartarugas afundam de tempos em tempos. Crie uma segunda versão do desenho de `f_rio2` (com as tartarugas trocadas por água) e alterne entre os dois desenhos a cada 2 segundos. `GLIFO` e `CASA_DO_SAPO` não precisam mudar: basta trocar o ponteiro em `desenho`.
2. **A mosca.** De vez em quando, uma mosca (um `*`) aparece numa toca vazia por alguns segundos. O sapo que entra nessa toca ganha 200 pontos.
3. **Faixas com velocidades fracionárias.** Hoje o período é inteiro (em tiques). Use um acumulador de 8 bits por faixa: a cada tique some a "velocidade" e, quando passar de 255 (CF = 1), ande uma casa. Assim dá para ter 2,5 casas por segundo.
4. **Fases desenhadas.** Guarde 3 conjuntos de desenhos e direções e troque de conjunto a cada fase, como o PAREDÃO faz com as paredes.
5. **Dois jogadores alternados.** Guarde pontos, vidas e tocas de dois jogadores e troque a cada vida perdida, como nos fliperamas.

## No livro

- [Capítulo 3: vídeo, modos e texto](livro:cap03): o modo 03h, a memória B800h, a função 01h da INT 10h que esconde o cursor (CX = 2000h).
- [Capítulo 4: paleta, fontes e strings](livro:cap04): os caracteres de desenho da página de código 437 e o bit de piscar do atributo.
- [Capítulo 6: teclado](livro:cap06): funções 00h e 01h da INT 16h, scan codes das setas e o buffer do teclado.
- [Capítulo 7: tempo e relógios](livro:cap07): o contador de tiques e a função 00h da INT 1Ah, o relógio do SAPO.
- [Capítulo 17: área de dados da BIOS](livro:cap17): onde a BIOS guarda o contador de tiques (0040:006Ch) que a INT 1Ah devolve.
- [Capítulo 20: a BIOS para jogos](livro:cap20): tempo, teclado, vídeo direto e som num só lugar.

:::resumo
- O SAPO é um Frogger em modo texto: 6 faixas de rua, 6 de rio, um canteiro, 5 tocas e uma barra de 30 segundos.
- Cada **casa** ocupa 2 colunas, para ficar quase quadrada; a linha tem 40 casas e o endereço é linha × 160 + casa × 4.
- Cada faixa é um **desenho circular de 40 casas** mais um **deslocamento**: a casa x da tela mostra `desenho[(x + desloc) mod 40]`. Mover a faixa inteira é somar ou subtrair 1 no deslocamento, com correção em vez de DIV.
- Cada faixa tem um período em tiques e um contador; o mundo anda a cada tique da BIOS (INT 1Ah), e o teclado (INT 16h) é atendido o tempo todo.
- A morte é decidida pela casa do desenho embaixo do sapo: na rua, qualquer coisa mata; no rio, a água mata. O sapo no rio é carregado pela faixa.
- Comparações **sem sinal** resolvem dois lados de uma vez: `sapo_x ≥ 40` pega 40 e −1 (255); `sapo_x − toca ≤ 1` pega só as 2 casas da toca.
- Para apagar o sapo, o jogo redesenha o cenário embaixo dele a partir do estado.
:::
