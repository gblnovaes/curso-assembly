---
id: aula35
numero: 35
modulo: 13
titulo: Invasores do espaço
subtitulo: Sprites de 1 bit, uma formação de 55 que acelera, colisão pela cor do pixel e escudos que se desgastam
duracao: 150 min
objetivos: entender as regras e a história do Space Invaders e por que ele foi feito do jeito que foi; guardar desenhos com 1 bit por pixel e desenhá-los em qualquer cor com uma rotina só; organizar 55 inimigos com um vetor de "vivos" e um canto de referência em vez de 55 posições; fazer a formação acelerar quando os invasores morrem; descobrir em que o tiro bateu lendo a cor do pixel na memória de vídeo; transformar uma posição na tela no índice do invasor atingido; manter vários objetos (3 bombas, disco, explosão) em vagas fixas; desgastar escudos apagando só os pixels da cor deles; montar o placar e as telas com a BIOS no modo 13h
---

## O jogo que esvaziou os fliperamas de tudo o resto

Em 1978 a japonesa **Taito** pôs nos bares um gabinete chamado *Space Invaders*. Era obra de um homem só, **Tomohiro Nishikado**, que desenhou o jogo, os desenhos dos alienígenas e até a placa de circuito. A ideia cabe numa frase: uma formação de alienígenas desce marchando, de um lado para o outro, e você, com um canhão que só anda na horizontal, precisa derrubá-los antes que eles cheguem ao chão.

O que fez do jogo um fenômeno não foi a ideia, mas a **tensão**. Os alienígenas marcham ao som de quatro notas graves, *tum, tum, tum, tum*, e a cada invasor que morre a marcha fica um pouco mais rápida. Quando sobra o último, ele atravessa a tela correndo, e o coração do jogador acompanha a música.

:::anos90 Um defeito que virou regra
A aceleração não foi planejada. A placa do *Space Invaders* tinha um **Intel 8080** a 2 MHz, e redesenhar 55 alienígenas era trabalho demais para ele: a formação andava devagar porque o processador não dava conta. Conforme os alienígenas morriam, sobrava menos para desenhar e a marcha ficava mais rápida. Nishikado percebeu que aquilo deixava o jogo emocionante e manteve. Quase todo clone desde então **imita de propósito** o que era uma limitação do hardware, e o nosso não é exceção.
:::

O jogo virou uma febre no Japão (conta a lenda, provavelmente exagerada, que faltaram moedas de 100 ienes no país) e no mundo inteiro: a Midway o fabricou nos Estados Unidos, e a versão do **Atari 2600**, de 1980, foi o primeiro jogo de fliperama licenciado para um console, multiplicando as vendas do aparelho. No PC, ao longo dos anos 80 e 90, apareceram dezenas de versões, quase todas *shareware*: em CGA de 4 cores, em EGA, depois em VGA. Era o primeiro "jogo de verdade" que muito programador escrevia, porque usa quase todas as técnicas de um jogo de ação e cabe num fim de semana.

:::anos90 Tela preta e branca com celofane
O monitor do gabinete original era **monocromático**. As "cores" vinham de tiras de celofane coladas no vidro: verde na faixa de baixo (onde ficam o canhão e os escudos), vermelho no alto (onde passa o disco voador). Por isso um tiro muda de cor quando atravessa a tela. A memória de vídeo tinha **1 bit por pixel**, 256 × 224 pontos, 7 KB ao todo. Guarde isso: nós vamos guardar os desenhos do mesmo jeito.
:::

## As regras do nosso INVASOR

O `INVASOR.ASM` desta aula segue o original de perto:

- **55 invasores** em 5 linhas de 11. A linha de cima é de "lulas" (30 pontos), as duas do meio de "caranguejos" (20) e as duas de baixo de "polvos" (10). Cada tipo tem dois desenhos que se alternam a cada passo: eles "mexem as pernas".
- A formação anda de lado; quando a borda de um invasor encosta na margem da tela, ela **desce 8 pixels** e muda de sentido.
- Quanto menos invasores, **mais depressa** ela anda.
- Você tem **um tiro por vez**: só pode atirar de novo quando o anterior acertar algo ou sair da tela.
- Os invasores soltam até **3 bombas** ao mesmo tempo.
- Quatro **escudos** verdes protegem o canhão. Tiros e bombas arrancam pedaços deles.
- De vez em quando passa um **disco voador** no alto. Ele vale 50, 100, 150 ou 300 pontos.
- Você tem **3 vidas**. O jogo acaba quando elas acabam ou quando os invasores chegam à altura do canhão. Se você limpar a tela, vem uma **nova onda**, que começa um pouco mais baixo.

Teclas: **setas** movem o canhão, **Espaço** atira, **Esc** volta ao menu (e, no menu, sai).

```diagrama titulo="A tela do INVASOR (320 × 200, modo 13h)"
  y
  0 ┌────────────────────────────────────────────────────────┐
    │PONTOS 00060  RECORDE 00000       VIDAS 3               │ ← placar (linha 0 de texto)
 12 │                     ▄██▄    ← disco voador (DISCO_Y)    │
 32 │   ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆      lulas      (30)          │ ← fy (cresce 8 a cada descida)
 44 │   ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲      caranguejos (20)          │
 56 │   ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲                                │
 68 │   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■      polvos     (10)          │
 80 │   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■                                │
    │   ↑ fx      │ bomba (até 3)                            │
    │   16 px entre colunas, 12 px entre linhas              │
150 │    ▟██▙        ▟██▙        ▟██▙        ▟██▙            │ ← escudos (ESCUDO_Y)
    │                    │ tiro                              │
180 │                   ▄█▄                                  │ ← canhão (JOG_Y)
190 │════════════════════════════════════════════════════════│ ← chão (CHAO_Y)
199 └────────────────────────────────────────────────────────┘
```

## O que vem da aula 32, e o que é deste jogo

O esqueleto é o mesmo de todos os jogos do módulo, explicado em [Fundamentos da programação de jogos](aula:aula32): um **laço de quadros** sincronizado com o **retraço vertical** da VGA, a **nossa INT 9** que mantém um vetor `teclas[128]` com o estado de cada tecla, o gerador de números **LCG**, o **som** pelo canal 2 do PIT com duração medida em tiques e escrita **direta na memória de vídeo**. As rotinas `NOVA_INT9`, `INSTALA_TECLADO`, `ESPERA_SOLTAR`, `ALEATORIO`, `SOM_LIGA` e companhia são as mesmas do [Pong](aula:aula34), copiadas sem mudança.

Como os outros jogos, o INVASOR é um programa **.COM** que, do DOS, só usa as funções `25h` e `35h` (trocar e ler vetores de interrupção) e `4Ch` (terminar) da `INT 21h`. O resto é BIOS (`INT 10h` para o modo e o texto, `INT 1Ah` para o relógio) e hardware. Por isso ele roda também no sistema operacional que vamos construir no módulo 14, a partir da [aula 40](aula:aula40).

Esta aula se concentra no que o INVASOR tem de **próprio**:

| Técnica | Onde | Por quê |
|---------|------|---------|
| sprites de 1 bit por pixel | `SPRITE` e os desenhos `inv1_a`... | 6 vezes menos memória, qualquer cor, apagar = desenhar com cor 0 |
| paleta com uma cor por tipo de objeto | `PROGRAMA_PALETA`, cores 32 a 41 | a cor do pixel diz o que existe ali |
| formação com canto de referência | `fx`, `fy`, `vivo[55]` | mover 55 invasores = mudar 2 números |
| marcha que acelera | `MOVE_FORMACAO`, `conta_passo` | o efeito do original, agora de propósito |
| colisão pela cor do pixel | `OLHA_COLUNA` | um teste em vez de 55 + 8 + 1 |
| posição → índice | `MATA_INVASOR` | descobrir quem morreu sem procurar |
| vagas fixas de objetos | `bomba_ativa[3]`, disco, explosão | nada de alocação dinâmica |
| escudos que são só pixels | `MORDE_ESCUDO` | a tela é a estrutura de dados |

## As variáveis do jogo

Todo o estado cabe em pouco mais de 300 bytes. Vale a pena olhar a lista inteira antes do código, porque ela já conta como o jogo pensa:

```asm fragmento titulo="Estado do jogo (fim do INVASOR.ASM)"
pontos      DW 0
recorde     DW 0
vidas       DB 3
onda        DB 0
morreu      DB 0
invadiu     DB 0
vivo        DB TOTAL_INV DUP (1)   ; 1 = invasor vivo
vivos       DB TOTAL_INV
fx          DW 40               ; canto da formação (invasor 0)
fy          DW 32
passo       DW PASSO_X          ; +3 anda para a direita, -3 para a esquerda
anim        DB 0
conta_passo DB 1
...
jog_x       DW 0
tiro_ativo  DB 0
tiro_x      DW 0
tiro_y      DW 0
bomba_ativa DW MAX_BOMBAS DUP (0)
bomba_x     DW MAX_BOMBAS DUP (0)
bomba_y     DW MAX_BOMBAS DUP (0)
bomba_conta DB 70
disco_ativo DB 0
...
teclas      DB 128 DUP (0)
```

Repare no que **não** existe: não há uma lista com a posição de cada invasor, nem um mapa dos escudos. Os 55 invasores são descritos por `fx`, `fy` e o vetor `vivo`; os escudos existem **só na memória de vídeo**. Menos estado significa menos coisas para manter sincronizadas, e em Assembly isso é ouro.

```diagrama titulo="Os 55 invasores: um canto e um vetor de 55 bytes"
   vivo[]  (índice = linha × 11 + coluna)

            coluna: 0   1   2   3   4   5   6   7   8   9   10
   linha 0  (lula)   0   1   2   3   4   5   6   7   8   9   10
   linha 1  (carang) 11  12  13  14  15  16  17  18  19  20  21
   linha 2  (carang) 22  23  24  25  26  27  28  29  30  31  32
   linha 3  (polvo)  33  34  35  36  37  38  39  40  41  42  43
   linha 4  (polvo)  44  45  46  47  48  49  50  51  52  53  54

   posição na tela do invasor (linha, coluna):
        x = fx + coluna × 16        (ESPACO_X)
        y = fy + linha  × 12        (ESPACO_Y)
```

## O laço principal

O programa começa ligando o modo 13h, apontando **ES para A000h** de uma vez por todas (todas as rotinas gráficas contam com isso), programando a paleta, instalando o teclado e semeando o sorteio com o relógio. Depois é o laço de sempre, com um `CALL` para cada "sistema" do jogo:

```asm fragmento titulo="O laço de quadros"
@@menu: CALL TELA_TITULO        ; CF = 1: o jogador quer sair
        JC   @@sair
        CALL NOVA_PARTIDA
@@quadro:
        CALL ESPERA_RETRACO
        CALL MOVE_JOGADOR
        CALL MOVE_TIRO
        CALL MOVE_BOMBAS
        CALL MOVE_FORMACAO
        CALL SOLTA_BOMBA
        CALL MOVE_DISCO
        CALL ATUALIZA_EXPLOSAO
        CALL SOM_ATUALIZA
        CMP  morreu, 0
        JE   @@vivo
        CALL PERDE_VIDA
@@vivo: CMP  teclas[SC_ESC], 1
        JE   @@desistiu
        CMP  invadiu, 0
        JNE  @@acabou
        CMP  vidas, 0
        JE   @@acabou
        CMP  vivos, 0
        JNE  @@quadro
        CALL PROXIMA_ONDA
        JMP  @@quadro
```

```diagrama titulo="Um quadro (1/70 de segundo)"
   ESPERA_RETRACO ──► o feixe acabou de chegar ao pé da tela: hora de desenhar
         │
   MOVE_JOGADOR      setas → jog_x ± 2, apaga e redesenha o canhão
   MOVE_TIRO         dispara ou sobe 4 pixels; olha a cor do que há à frente
   MOVE_BOMBAS       cada bomba ativa desce 2 pixels; olha a cor à frente
   MOVE_FORMACAO     a cada conta_passo quadros: apaga 55, anda, desenha 55
   SOLTA_BOMBA       a cada 15..54 quadros: sorteia uma coluna, solta bomba
   MOVE_DISCO        conta para aparecer; voa 1 pixel a cada 2 quadros
   ATUALIZA_EXPLOSAO apaga a explosão quando o tempo dela acaba
   SOM_ATUALIZA      desliga o alto-falante quando o tempo da nota acaba
         │
   morreu? ──► PERDE_VIDA (animação de 1,4 s, tira bombas e tiro)
   Esc? invadiu? sem vidas? ──► FIM_DE_JOGO / menu
   vivos = 0? ──► PROXIMA_ONDA
         └──────────► volta para ESPERA_RETRACO
```

Três detalhes importam aqui.

**O ritmo é o do retraço.** Uma VGA no modo 13h desenha a tela **70 vezes por segundo**, e `ESPERA_RETRACO` segura o laço até o começo do próximo retraço. Assim toda velocidade do jogo é medida em "pixels por quadro": o canhão anda 2, o tiro sobe 4, as bombas descem 2. Num 386 ou num Pentium o jogo anda igual. O preço é que o quadro inteiro (mover tudo e redesenhar) precisa caber em 1/70 s, e é por isso que o jogo nunca redesenha a tela inteira.

**Quem detecta não é quem resolve.** `MOVE_BOMBAS` descobre que uma bomba acertou o canhão, mas não trata a morte: só liga a variável `morreu`. Quem chama `PERDE_VIDA` é o laço principal, depois que todos os sistemas terminaram o seu quadro. Se a morte fosse tratada lá dentro, no meio do laço das bombas, `PERDE_VIDA` apagaria as outras bombas enquanto `MOVE_BOMBAS` ainda está percorrendo o vetor delas. O mesmo vale para `invadiu`.

**ES nunca muda.** Como todas as rotinas gráficas escrevem em `ES:[DI]`, carregar ES uma vez no começo economiza um `PUSH ES`/`MOV ES`/`POP ES` em cada uma. As únicas exceções seriam rotinas que usam `STOSB` em dados do programa, e o INVASOR não tem nenhuma.

## Sprites de 1 bit por pixel

No modo 13h cada pixel é um byte. Um invasor de 12 × 8 guardado "do jeito da tela" ocuparia 96 bytes por desenho, e um tipo de invasor tem 2 desenhos. O INVASOR guarda cada **linha do desenho numa word**, 1 bit por pixel: o bit 15 é o pixel da esquerda, o bit 14 o seguinte, e assim por diante. Um desenho de até 16 pixels de largura e 8 de altura ocupa **16 bytes**.

```asm fragmento titulo="A lula, quadro 1"
inv1_a     DW 0000011000000000b   ; .....##
           DW 0000111100000000b   ; ....####
           DW 0001111110000000b   ; ...######
           DW 0011011011000000b   ; ..##.##.##
           DW 0011111111000000b   ; ..########
           DW 0000100100000000b   ; ....#..#
           DW 0001011010000000b   ; ...#.##.#
           DW 0010100101000000b   ; ..#.#..#.#
```

O montador aceita números binários com o sufixo `b`, então o desenho fica **visível no fonte**: os 1 são o alienígena. O comentário ao lado repete a figura com `#` para quem lê depressa. (Os desenhos desta aula foram feitos à mão numa grade de pixels e convertidos em `DW` por um script pequeno, como se fazia com papel quadriculado.)

Guardar o desenho assim tem três vantagens, e as três eram decisivas em 1990:

1. **Memória.** 16 bytes em vez de 96. Os 13 desenhos do jogo (3 tipos × 2 quadros, canhão, 2 quadros da explosão do canhão, explosão, disco e as 2 metades do escudo) cabem em menos de 250 bytes.
2. **Qualquer cor.** O desenho não tem cor; quem escolhe é quem chama. A mesma lula sai magenta no jogo e pode sair de outra cor na tela de título.
3. **Apagar é desenhar com a cor 0.** A mesma rotina, chamada com `AL = 0`, apaga exatamente os pixels que desenhou e mais nenhum. Os bits 0 do desenho não são tocados: são **transparentes**.

### A rotina SPRITE

```asm fragmento titulo="SPRITE: desenha um desenho de 1 bit"
; SI = desenho (uma word por linha, bit 15 = pixel da esquerda),
; BX = x, DX = y, AL = cor, CL = número de linhas.
; Bits 0 ficam transparentes; com AL = 0 a mesma rotina apaga o desenho.
SPRITE  PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        PUSH BP
        CALL ENDERECO
        XOR  CH, CH
@@linha:
        MOV  BP, DI             ; BP = começo da linha na tela
        MOV  DX, [SI]           ; DX = os 16 pixels da linha
        ADD  SI, 2
@@pixel:
        SHL  DX, 1              ; o próximo pixel sai no CF
        JNC  @@vazio
        MOV  ES:[DI], AL
@@vazio:
        INC  DI
        OR   DX, DX             ; acabaram os bits 1 da linha?
        JNZ  @@pixel
        MOV  DI, BP
        ADD  DI, 320
        LOOP @@linha
        ...
```

O coração é o par `SHL DX,1` / `JNC`: cada deslocamento empurra o bit mais alto para o **carry**, e o carry diz se aquele pixel é aceso. A word vai esvaziando pela esquerda.

O truque de velocidade é o `OR DX,DX / JNZ @@pixel`. Em vez de contar 16 pixels, a rotina para assim que **não sobra nenhum bit 1** na word. A lula tem no máximo 10 pixels de largura e as suas linhas acabam cedo: a primeira linha (`0000011000000000b`) termina depois de 7 voltas em vez de 16. Em média o laço roda metade das vezes. Isso também quer dizer que os **bits 0 à direita não custam nada**: desenhos estreitos são de graça.

`BP` guarda o começo da linha na tela para o salto de linha ser simples: volta ao começo e soma 320. `BP` é usado como registrador comum aqui; ele só tem significado especial (segmento SS) quando aparece entre colchetes.

```diagrama titulo="Uma linha da lula indo para a tela"
   DX = 0011011011000000b       DI aponta para (x, y)

   SHL DX,1 → CF=0  pixel x+0  não toca          DX = 0110110110000000b
   SHL DX,1 → CF=0  pixel x+1  não toca          DX = 1101101100000000b
   SHL DX,1 → CF=1  pixel x+2  ES:[DI] = AL      DX = 1011011000000000b
   SHL DX,1 → CF=1  pixel x+3  ES:[DI] = AL      DX = 0110110000000000b
   SHL DX,1 → CF=0  pixel x+4  não toca
     ...
   SHL DX,1 → CF=1  pixel x+9  ES:[DI] = AL      DX = 0000000000000000b
                                                  └─ OR DX,DX = 0: fim da linha
```

:::cpu Por que não 1 byte por pixel, que seria mais rápido?
Seria um `MOVSB` por pixel (ou `REP MOVSB` por linha) em vez de um `SHL` e um salto. Mas aí não haveria transparência (o retângulo inteiro do desenho seria copiado, inclusive o fundo preto, apagando o que estivesse atrás) e cada cor precisaria do seu próprio desenho. Jogos comerciais da época usavam desenhos de 1 byte por pixel com uma **cor transparente** (normalmente 0) e testavam cada byte; outros geravam **código** para cada sprite, uma sequência de `MOV ES:[DI+n],AL` só para os pixels acesos, a técnica dos *compiled sprites*. Para um jogo de desenhos pequenos e de uma cor só, como este, o bit por pixel é o melhor equilíbrio entre tamanho, simplicidade e velocidade.
:::

### ENDERECO sem MUL

```asm fragmento titulo="ENDERECO: DI = y × 320 + x"
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL             ; DX = y * 256
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1              ; DI = y * 64
        ADD  DI, DX
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP
```

É a conta da [aula 23](aula:aula23): 320 = 256 + 64. `MUL` de 16 bits custava mais de 120 ciclos no 8088; os seis `SHL` e as trocas de byte custam pouco mais de 20. Como `ENDERECO` é chamada para cada sprite, retângulo e teste de colisão, a diferença aparece. (Seis `SHL DI,1` seguidos é mais rápido no 8086 do que `MOV CL,6 / SHL DI,CL`, que gasta 8 + 4 × 6 ciclos.)

### A paleta: uma cor por tipo de coisa

O jogo programa as cores **32 a 41** da paleta direto no DAC da VGA (portas 3C8h e 3C9h, como na [aula 24](aula:aula24) e no [capítulo de paleta do livro](livro:cap04)):

```asm fragmento titulo="PROGRAMA_PALETA e a tabela de cores"
PROGRAMA_PALETA PROC
        MOV  DX, 3C8h
        MOV  AL, COR_LULA
        OUT  DX, AL
        INC  DX
        MOV  SI, OFFSET paleta
        MOV  CX, 10*3
@@cor:  LODSB
        OUT  DX, AL
        LOOP @@cor
        RET
PROGRAMA_PALETA ENDP

paleta      DB 63,20,63         ; 32 lula: magenta
            DB 20,63,63         ; 33 caranguejo: ciano
            DB 63,63,20         ; 34 polvo: amarelo
            DB 10,48,10         ; 35 escudo: verde
            DB 20,63,20         ; 36 canhão: verde claro
            DB 63,63,63         ; 37 tiro: branco
            DB 63,40,40         ; 38 bomba: rosa
            DB 63,10,10         ; 39 disco: vermelho
            DB 63,40,0          ; 40 explosão: laranja
            DB 20,48,20         ; 41 chão
```

Por que não usar as 16 cores padrão (0 a 15), que já existem? Porque o placar, escrito pela BIOS, usa as cores 7, 14 e 15. Se o escudo fosse a cor 2 da paleta padrão e uma letra também usasse a 2, o jogo não saberia distinguir uma da outra. Com uma faixa de cores **só nossa**, a cor de um pixel vira uma **etiqueta**: 35 é escudo, 36 é canhão, 39 é disco. E as cores podem até ser **iguais na tela** e diferentes na memória: o chão (41) e o escudo (35) são parecidos de propósito, mas o jogo nunca confunde os dois.

Isso prepara a técnica mais interessante do jogo.

## Colisão pela cor do pixel

O tiro sobe 4 pixels por quadro. Em que ele bateu? A resposta "de livro" seria comparar o retângulo do tiro com o de cada um dos 55 invasores, cada escudo e o disco. O INVASOR faz outra coisa: **olha a tela**. Antes de desenhar o tiro na posição nova, ele lê os 4 pixels que o tiro vai ocupar e vê se algum já está aceso.

```asm fragmento titulo="OLHA_COLUNA"
; OLHA_COLUNA: procura um pixel aceso na coluna BX, de DX para baixo,
; em CX linhas. Devolve AL = cor achada (0 = nada) e DX = linha dela.
OLHA_COLUNA PROC
        PUSH CX
        PUSH DI
        CALL ENDERECO
@@olha: MOV  AL, ES:[DI]
        OR   AL, AL
        JNZ  @@fim
        ADD  DI, 320
        INC  DX
        LOOP @@olha
@@fim:  POP  DI
        POP  CX
        RET
OLHA_COLUNA ENDP
```

E o tiro decide o que fazer conforme a cor:

```asm fragmento titulo="MOVE_TIRO: o tiro em voo"
@@voa:  CALL APAGA_TIRO
        SUB  tiro_y, TIRO_VEL
        CMP  tiro_y, TOPO
        JGE  @@olha
        MOV  tiro_ativo, 0      ; saiu por cima
@@fim:  RET
@@olha: MOV  BX, tiro_x         ; tem alguma coisa onde o tiro vai ficar?
        MOV  DX, tiro_y
        MOV  CX, 4
        CALL OLHA_COLUNA        ; AL = cor achada, DX = linha dela
        CMP  AL, COR_LULA
        JB   @@desenha          ; nada (0) ou cor que não interessa
        CMP  AL, COR_POLVO
        JBE  @@invasor
        CMP  AL, COR_ESCUDO
        JE   @@escudo
        CMP  AL, COR_DISCO
        JE   @@disco
@@desenha:
        MOV  AL, COR_TIRO
        CALL PINTA_TIRO
        RET
```

As três cores de invasor são **vizinhas** (32, 33, 34) de propósito: um `CMP`/`JB` e um `CMP`/`JBE` testam "é um invasor qualquer". Cores que não interessam ao tiro (uma bomba, a explosão, o chão) são simplesmente ignoradas: o tiro passa por cima e, no quadro seguinte, quem as apagar ou redesenhar resolve.

Por que o tiro é **apagado antes** de olhar? Porque senão ele acharia a si mesmo: os pixels do quadro anterior ainda estão na tela, e são da cor 37. A ordem é sempre apagar, mover, olhar, desenhar.

:::anos90 A tela como banco de dados
Testar colisão olhando a memória de vídeo era comum nos anos 70 e 80, quando a CPU não tinha tempo para comparar retângulos. O próprio *Space Invaders* original detectava os acertos do tiro conferindo os bits que já estavam acesos na memória de vídeo ao desenhá-lo. Tem limitações: só funciona se cada tipo de objeto tiver uma cor própria, o resultado depende da **ordem** em que as coisas são desenhadas, e um objeto rápido pode "pular" um fino sem tocá-lo. O tiro anda 4 pixels por quadro e é por isso que `OLHA_COLUNA` olha **as 4 linhas** que ele percorreu, e não só a nova ponta.
:::

O mesmo `OLHA_COLUNA` serve às bombas, que olham para baixo:

```asm fragmento titulo="MOVE_BOMBAS: o que a bomba encontrou"
        MOV  BX, bomba_x[DI]
        MOV  DX, bomba_y[DI]
        MOV  CX, 4
        CALL OLHA_COLUNA
        CMP  AL, COR_ESCUDO
        JE   @@escudo
        CMP  AL, COR_JOG
        JE   @@jogador
        MOV  AL, COR_BOMBA
        CALL PINTA_BOMBA
        JMP  SHORT @@prox
@@escudo:
        CALL MORDE_ESCUDO
        JMP  SHORT @@some
@@jogador:
        MOV  morreu, 1          ; quem cuida disso é o laço principal
@@some: MOV  bomba_ativa[DI], 0
```

Uma bomba que encontra um **invasor** (a formação desceu sobre ela) ou um **tiro** passa por cima: não há `CMP` para essas cores. No original o tiro e a bomba podiam se anular; fica como desafio.

## De um pixel ao invasor atingido

O tiro achou a cor 33 no pixel (BX, DX). Mas qual dos 22 caranguejos foi? Aqui a formação regular paga o seu preço de volta: a posição diz o índice, sem procurar.

```asm fragmento titulo="MATA_INVASOR: coluna e linha a partir do pixel"
MATA_INVASOR PROC
        MOV  AX, BX
        SUB  AX, fx
        MOV  CL, 4
        SHR  AX, CL             ; AX = coluna (0-10)
        MOV  col_alvo, AL
        MOV  AX, DX
        SUB  AX, fy
        MOV  CL, ESPACO_Y
        DIV  CL                 ; AL = linha (0-4)
        MOV  lin_alvo, AL
        MOV  BL, AL
        MOV  AL, COLUNAS_INV
        MUL  BL                 ; AX = linha * 11
        ADD  AL, col_alvo
        MOV  BX, AX
        MOV  vivo[BX], 0        ; morreu
        DEC  vivos
```

```diagrama titulo="Do pixel ao índice"
   fx = 40, fy = 32, o tiro achou a cor 33 em (93, 49)

   coluna = (93 − 40) ÷ 16 = 53 ÷ 16 = 3      (SHR 4: ESPACO_X é potência de 2)
   linha  = (49 − 32) ÷ 12 = 17 ÷ 12 = 1      (DIV: 12 não é potência de 2)
   índice = 1 × 11 + 3 = 14                   → vivo[14] = 0

        40  56  72  88  104
   32   ┌───┬───┬───┬───┐       cada célula: 16 × 12
        │ 0 │ 1 │ 2 │ 3 │       o desenho ocupa 12 × 8 no canto dela
   44   ├───┼───┼───┼───┤
        │11 │12 │13 │14 │ ← (93, 49) cai aqui
   56   └───┴───┴───┴───┘
```

O espaço entre colunas é **16** justamente para a divisão virar um `SHR AX,4`. O espaço entre linhas é 12, porque 16 deixaria a formação alta demais para a tela, e aí vai um `DIV` de 8 bits (que só acontece quando um tiro acerta, não a cada quadro). Como o pixel achado é sempre um pixel **aceso de um invasor**, ele está dentro do desenho de 12 × 8, e a divisão nunca cai no vão entre dois invasores.

Depois o resto da rotina soma os pontos pela linha (`pontos_linha` = 30, 20, 20, 10, 10), apaga o invasor desenhando o seu sprite com a cor 0 (o quadro certo de animação: `anim` diz se é o primeiro ou o segundo) e põe uma explosão no lugar.

:::dica Tabelas em vez de IFs
Três tabelas indexadas pela linha (`spr_linha`, `cor_linha`, `pontos_linha`) fazem o trabalho de uma cadeia de `CMP`. Para saber os pontos da linha 3: `MOV BX,3 / SHL BX,1 / MOV AX,pontos_linha[BX]`. Mudar o jogo (lulas valendo 50, uma linha a mais) é mexer em dados, não em código.
:::

## A formação que marcha e acelera

Mover os 55 invasores é mudar `fx` e `fy`. O difícil é o resto: saber quando a formação bateu na borda, desenhar a animação e acelerar. É o trabalho de `MOVE_FORMACAO`.

```asm fragmento titulo="MOVE_FORMACAO: o ritmo"
MOVE_FORMACAO PROC
        DEC  conta_passo
        JZ   @@anda
        RET
@@anda: MOV  AL, vivos
        SHR  AL, 1
        SHR  AL, 1
        ADD  AL, 2
        MOV  conta_passo, AL    ; próximo passo em 2 + vivos/4 quadros
```

A formação não anda a cada quadro: ela espera `conta_passo` quadros. Esse intervalo é **2 + vivos ÷ 4**:

| Vivos | Intervalo (quadros) | Passos por segundo | Velocidade (3 px por passo) |
|-------|--------------------|--------------------|------------------------------|
| 55 | 15 | 4,7 | 14 px/s |
| 30 | 9 | 7,8 | 23 px/s |
| 10 | 4 | 17,5 | 52 px/s |
| 1 | 2 | 35 | 105 px/s |

Com 55 invasores a marcha é lenta e pesada; o último corre a tela inteira em 3 segundos. É o efeito do original, agora por uma conta e não por falta de CPU. A nota da marcha (`NOTA_MARCHA`) toca **a cada passo**, então a música acelera junto, sem nenhum código a mais.

### Bater na borda

```asm fragmento titulo="MOVE_FORMACAO: borda, descida e virada"
        CALL BORDAS             ; BX = x da esquerda, DX = x da direita
        XOR  DI, DI             ; DI = quanto desce (0 ou DESCIDA)
        MOV  CX, passo          ; CX = quanto anda de lado
        OR   CX, CX
        JS   @@para_esq
        ADD  DX, CX
        CMP  DX, 320-MARGEM
        JLE  @@move
        JMP  SHORT @@vira
@@para_esq:
        ADD  BX, CX
        CMP  BX, MARGEM
        JGE  @@move
@@vira: NEG  passo              ; bateu na borda: desce e muda de lado
        XOR  CX, CX
        MOV  DI, DESCIDA
```

`passo` vale +3 ou −3. O sinal (`OR CX,CX / JS`) diz para que lado a formação vai; `NEG passo` vira o sentido. Num passo de virada ela não anda de lado: só desce 8 pixels.

A borda **não** é `fx`. Se toda a coluna da esquerda morreu, a formação precisa ir mais longe para a esquerda antes de bater, como no original. `BORDAS` procura a primeira e a última **coluna com alguém vivo**, e também a **linha viva mais de baixo** (para saber quando os invasores chegaram ao canhão):

```asm fragmento titulo="BORDAS: a primeira coluna com alguém vivo"
        XOR  BX, BX             ; procura da esquerda para a direita
@@c1:   MOV  SI, BX
        MOV  CX, LINHAS_INV
@@l1:   CMP  vivo[SI], 0
        JNE  @@achou1
        ADD  SI, COLUNAS_INV
        LOOP @@l1
        INC  BX
        CMP  BX, COLUNAS_INV
        JB   @@c1
@@achou1:
        MOV  col_min, BL
```

Andar **por coluna** num vetor guardado **por linha** é somar 11 ao índice: `ADD SI,COLUNAS_INV`. A busca da direita é igual, de trás para a frente; a da linha mais baixa olha o vetor do último índice para o primeiro e divide o primeiro vivo achado por 11.

### Apagar e redesenhar

```asm fragmento titulo="MOVE_FORMACAO: o passo propriamente dito"
@@move: PUSH CX
        PUSH DI
        XOR  AL, AL             ; apaga todos (com o quadro atual)
        CALL DESENHA_FORMACAO
        POP  DI
        POP  CX
        ADD  fx, CX
        ADD  fy, DI
        XOR  anim, 1            ; troca o quadro da animação
        MOV  AL, 1
        CALL DESENHA_FORMACAO   ; e desenha de novo
        CALL NOTA_MARCHA
```

A técnica é a mais simples que existe: **apagar tudo na posição velha** (desenhando com a cor 0, graças ao sprite de 1 bit) e **desenhar tudo na posição nova**. O apagamento usa o quadro de animação **atual**; só depois `anim` troca. Se a ordem fosse outra, o apagamento usaria o desenho errado e sobrariam "pernas" na tela.

`DESENHA_FORMACAO` percorre as 5 linhas e as 11 colunas, escolhendo o desenho de cada linha pela tabela `spr_linha` e somando 16 bytes ao ponteiro quando `anim` = 1 (o segundo quadro fica logo depois do primeiro na memória: `inv1_b` vem 8 words depois de `inv1_a`):

```asm fragmento titulo="DESENHA_FORMACAO: o desenho de cada linha"
@@cor:  SHL  BX, 1
        MOV  SI, spr_linha[BX]
        CMP  anim, 0
        JE   @@quadro
        ADD  SI, 16             ; o segundo quadro vem logo depois (8 words)
@@quadro:
        MOV  BX, fx
        MOV  CH, COLUNAS_INV
@@coluna:
        CMP  vivo[DI], 0
        JE   @@prox
        MOV  CL, ALT_INV
        CALL SPRITE
@@prox: INC  DI
        ADD  BX, ESPACO_X
        DEC  CH
        JNZ  @@coluna
```

:::cpu E o double buffer?
Jogos mais novos desenham o quadro inteiro numa área de memória fora da tela e copiam os 64.000 bytes para A000h de uma vez, sem nenhum "piscar". Num 286 de 12 MHz com uma placa VGA de 8 bits, essa cópia sozinha leva perto de um quadro inteiro; num 8088, vários. O jeito da época era redesenhar **só o que muda** (a técnica dos "retângulos sujos") e fazê-lo logo depois do retraço, quando o feixe está longe. Aqui, o que muda num passo da formação são 55 sprites de 8 linhas: umas 4.000 escritas de pixel no pior caso, e mesmo assim só a cada vários quadros.
:::

### A marcha

```asm fragmento titulo="NOTA_MARCHA: tum, tum, tum, tum"
NOTA_MARCHA PROC
        MOV  BL, nota
        INC  nota
        AND  BX, 3
        SHL  BX, 1
        MOV  BX, notas_marcha[BX]
        MOV  CL, 1
        CALL SOM_LIGA
        RET
NOTA_MARCHA ENDP

notas_marcha DW 12175, 13715, 14551, 16345
```

Os números já são **divisores do PIT** (1.193.182 ÷ 12.175 ≈ 98 Hz, depois 87, 82 e 73 Hz): quatro notas graves que descem, como no original. `AND BX,3` faz o contador `nota` dar a volta em 4 sem `CMP`. O `AND BX,3` também zera BH, que `MOV BL,nota` deixou com lixo. `SOM_LIGA` não espera a nota acabar: ela anota quando desligar (`som_fim`) e volta, e `SOM_ATUALIZA`, chamada todo quadro, desliga o alto-falante na hora certa. É a técnica de [som sem parar o jogo](aula:aula32) da aula 32, sobre o canal 2 do PIT da [aula 29](aula:aula29).

## Vagas fixas: bombas, disco e explosão

Um jogo moderno criaria e destruiria objetos à vontade. Em Assembly de 1990, sem `malloc`, a solução é ter um número **fixo de vagas** e uma marca de "ocupada" em cada uma. O INVASOR tem 3 vagas de bomba, 1 de disco, 1 de tiro e 1 de explosão.

```diagrama titulo="As três vagas de bomba (vetores paralelos de words)"
                 vaga 0     vaga 1     vaga 2
   DI =            0          2          4
   bomba_ativa  [  1     |    0     |    1    ]
   bomba_x      [ 141    |    ?     |   205   ]
   bomba_y      [ 103    |    ?     |   161   ]

   MAX_BOMBAS*2 = 6: o laço termina quando DI chega a 6
```

O índice `DI` anda de 2 em 2 porque os três vetores são de **words**, e assim `bomba_x[DI]`, `bomba_y[DI]` e `bomba_ativa[DI]` falam da mesma bomba sem multiplicar nada. (`bomba_ativa` poderia ser um byte, mas sendo word ela usa o mesmo índice das outras duas.)

### Quem solta a bomba

```asm fragmento titulo="SOLTA_BOMBA: sorteio, vaga e atirador"
SOLTA_BOMBA PROC
        DEC  bomba_conta
        JZ   @@sorteia
        RET
@@sorteia:
        MOV  AX, 40
        CALL ALEATORIO
        ADD  AL, 15
        MOV  bomba_conta, AL    ; próxima em 15 a 54 quadros
        XOR  DI, DI             ; DI = vaga (0, 2 ou 4)
@@vaga: CMP  bomba_ativa[DI], 0
        JE   @@achou_vaga
        ADD  DI, 2
        CMP  DI, MAX_BOMBAS*2
        JB   @@vaga
        RET                     ; as três estão caindo
@@achou_vaga:
        MOV  AX, COLUNAS_INV
        CALL ALEATORIO          ; AX = coluna
        MOV  BX, AX
        MOV  SI, AX
        ADD  SI, (LINHAS_INV-1)*COLUNAS_INV
        MOV  CX, LINHAS_INV     ; sobe procurando alguém vivo
@@busca:
        CMP  vivo[SI], 0
        JNE  @@achou
        SUB  SI, COLUNAS_INV
        LOOP @@busca
        RET                     ; coluna vazia: fica para a próxima
```

Três ideias juntas. **Intervalo sorteado**: `ALEATORIO` (o LCG da [aula 32](aula:aula32)) com AX = 40 devolve de 0 a 39, então a próxima bomba vem em 15 a 54 quadros, sem ritmo previsível. **Procura de vaga**: se as três estão ocupadas, desiste. **Quem atira é o de baixo**: sorteada a coluna, a busca sobe da linha 4 até achar alguém vivo, porque um invasor não atira através do colega da frente. Se a coluna está vazia, simplesmente não sai bomba dessa vez (e o sorteio seguinte tenta de novo). Repare que `CX`, que contava as linhas de 5 para 1, depois do `DEC CX` é exatamente a linha do atirador.

:::anos90 As bombas que miram
No original as bombas não são todas sorteadas: um dos três tipos de projétil é solto da coluna que está **logo acima do canhão**. É por isso que ficar parado é perigoso. Para imitar, basta trocar o sorteio da coluna por `(jog_x − fx) ÷ 16` de vez em quando; ver os desafios.
:::

### O disco voador

```asm fragmento titulo="MOVE_DISCO: aparecer, voar e sumir"
MOVE_DISCO PROC
        CMP  disco_ativo, 0
        JNE  @@voa
        DEC  disco_conta
        JNZ  @@fim
        MOV  AX, 600            ; o próximo vem em 600 a 1199 quadros
        CALL ALEATORIO
        ADD  AX, 600
        MOV  disco_conta, AX
        MOV  disco_ativo, 1
        MOV  disco_x, 0
        MOV  disco_dir, 1
        MOV  AX, 2              ; cara ou coroa: de que lado ele vem
        CALL ALEATORIO
        OR   AX, AX
        JZ   @@desenha
        MOV  disco_x, 320-16
        MOV  disco_dir, -1
        JMP  SHORT @@desenha
@@voa:  XOR  disco_fase, 1      ; anda um pixel a cada dois quadros
        JZ   @@fim
```

O disco aparece a cada 9 a 17 segundos (600 a 1.199 quadros a 70 por segundo), entra pela esquerda ou pela direita e anda **meio pixel por quadro**. Como não existe meio pixel, `disco_fase` alterna entre 0 e 1 com `XOR` e o disco só anda quando ela vira 1: um quadro sim, outro não. É a forma mais barata de ter velocidades fracionárias (a aula de [ponto fixo](aula:aula30) mostra a forma geral).

O prêmio é sorteado da tabela `premio_disco` (50, 100, 150, 300).

:::anos90 O tiro número 23
No gabinete original o prêmio do disco não era sorteado: dependia de **quantos tiros** o jogador tinha dado. Os jogadores descobriram que o 23º tiro, e depois a cada 15, valia 300 pontos, e passaram a contar os tiros de cabeça. Aleatório de verdade era caro para um 8080; uma tabela percorrida em sequência parecia aleatória para quem não sabia.
:::

### Uma explosão de cada vez

```asm fragmento titulo="EXPLODE e ATUALIZA_EXPLOSAO"
EXPLODE PROC
        CMP  expl_tempo, 0      ; só existe uma explosão por vez:
        JE   @@nova             ; se ainda há outra na tela, apaga
        PUSH BX
        PUSH DX
        CALL APAGA_EXPLOSAO
        POP  DX
        POP  BX
@@nova:
        MOV  expl_x, BX
        MOV  expl_y, DX
        MOV  expl_tempo, 10
        ...

ATUALIZA_EXPLOSAO PROC
        CMP  expl_tempo, 0
        JE   @@fim
        DEC  expl_tempo
        JNZ  @@fim
        CALL APAGA_EXPLOSAO     ; o tempo dela acabou
@@fim:  RET
```

A explosão é um sprite com um **cronômetro** em quadros: 10 quadros (1/7 de segundo) e ela some. Uma só vaga é suficiente, porque só existe um tiro; se um segundo acerto vier antes de a primeira sumir, ela é apagada na hora. É um padrão que aparece em todo jogo: um objeto com tempo de vida, decrementado no laço principal.

## Escudos feitos só de pixels

Os escudos são a parte mais elegante do jogo, e a mais curta. Eles são desenhados uma vez, no começo da onda, e depois **nenhuma variável** guarda o seu formato. Quando um tiro ou uma bomba acerta um escudo, `MORDE_ESCUDO` arranca um pedaço de 3 × 4 pixels em volta do ponto de impacto, apagando **só os pixels da cor do escudo**:

```asm fragmento titulo="MORDE_ESCUDO"
MORDE_ESCUDO PROC
        PUSH DI                 ; MOVE_BOMBAS usa DI como índice
        DEC  BX
        DEC  DX
        CALL ENDERECO           ; DI = canto do pedaço
        MOV  DX, 4              ; 4 linhas
@@linha:
        MOV  CX, 3              ; de 3 pixels
@@pixel:
        CMP  BYTE PTR ES:[DI], COR_ESCUDO
        JNE  @@prox
        MOV  BYTE PTR ES:[DI], 0
@@prox: INC  DI
        LOOP @@pixel
        ADD  DI, 320-3
        DEC  DX
        JNZ  @@linha
```

```diagrama titulo="Um escudo depois de algumas mordidas"
   antes                         depois de 2 tiros e 1 bomba
   ....#######.......            ....###...#.......
   ...##########.....            ...####...###.....
   ..############....            ..#####...####....     ← bomba
   .##############...            .#########...#....
   ################..            ##########...##...     ← tiros
   ################..            ##########...##...
   ...                           ...

   O próximo tiro que passar pelo buraco não acha a cor 35:
   ele atravessa. Ninguém precisou guardar onde está o buraco.
```

Esta é a recompensa da colisão por cor: o buraco **é** a ausência de pixels verdes, e o próximo `OLHA_COLUNA` já o enxerga. O teste `CMP ... COR_ESCUDO` impede que a mordida apague um invasor que esteja passando por cima do escudo (nas ondas mais baixas, a formação chega lá).

O escudo tem 22 pixels de largura e uma word só guarda 16, então ele é desenhado em **duas metades** de 11 pixels, `escudo_e` e `escudo_d`, a segunda 11 pixels à direita da primeira. É uma limitação da rotina `SPRITE` contornada nos dados, sem complicar o código.

:::atencao O PUSH DI não é enfeite
`MOVE_BOMBAS` chama `MORDE_ESCUDO` de dentro do laço das bombas, com `DI` = índice da vaga. `MORDE_ESCUDO` usa `DI` como ponteiro na tela. Sem o `PUSH DI`/`POP DI`, a volta para o laço das bombas teria DI = algum endereço da tela, e `bomba_ativa[DI]` apontaria para um lugar qualquer da memória. Quando você reaproveita uma rotina em outro contexto, confira o que ela estraga.
:::

## O canhão, as vidas e as ondas

`MOVE_JOGADOR` lê `teclas[SC_ESQ]` e `teclas[SC_DIR]` (os dois podem estar apertados juntos e se anulam), limita `jog_x` às margens e só redesenha se a posição mudou. Ficar parado não custa nada.

O tiro só sai se não houver outro no ar (`tiro_ativo = 0`). Segurar o Espaço atira de novo assim que o anterior termina, porque o jogo olha o **estado** da tecla, não o evento de apertar.

Quando uma bomba acerta, `PERDE_VIDA` toca um som grave, tira as bombas e o tiro e anima a explosão do canhão alternando dois desenhos (`canhao_x1` e `canhao_x2`) 24 vezes, 4 quadros cada: perto de um segundo e meio. Durante esse tempo o jogo inteiro para, como no fliperama. Repare no laço de espera:

```asm fragmento titulo="PERDE_VIDA: esperar sem travar o som"
        MOV  CX, 4
@@quadros:
        CALL ESPERA_RETRACO
        CALL SOM_ATUALIZA
        LOOP @@quadros
```

Mesmo parado, o jogo continua chamando `SOM_ATUALIZA`, senão o som da morte nunca desligaria. Toda espera longa de um jogo precisa continuar atendendo o que é "de tempo real".

Quando `vivos` chega a zero, `PROXIMA_ONDA` espera um segundo (70 quadros), incrementa `onda` e chama `NOVA_ONDA`, que redesenha tudo com a formação começando `onda × 8` pixels mais baixo (no máximo 32). Os escudos também voltam inteiros.

## Placar e telas com a BIOS

No modo 13h a função **0Eh da INT 10h** (teletipo) escreve caracteres de 8 × 8 pixels, e em modo gráfico o registrador **BL** é a cor da letra ([capítulo de vídeo do livro](livro:cap03)). A tela de 320 × 200 vira uma grade de 40 × 25 caracteres, e `INT 10h / AH = 02h` posiciona o cursor nela. O INVASOR usa isso para todo texto: o placar, a tela de título e o "FIM DE JOGO".

```asm fragmento titulo="ESCREVE_TXT e o número de 5 dígitos"
ESCREVE_TXT PROC
        MOV  AH, 02h
        XOR  BH, BH
        INT  10h
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE_TXT ENDP

; em ESCREVE_NUM:
        MOV  BX, 10
        MOV  CX, 5
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX                 ; os restos saem de trás para a frente
        LOOP @@divide
```

Dois cuidados. O teletipo da BIOS **só acende os pixels da letra**, sem apagar o fundo da célula, então trocar "00060" por "00080" deixaria um borrão de 6 e 8 sobrepostos. Por isso `ESCREVE_NUM` pinta um retângulo preto de 5 × 8 por 8 pixels antes de escrever. E o número sai sempre com **5 dígitos** (zeros à esquerda), como nos fliperamas: o laço divide 5 vezes por 10, sem parar quando o quociente zera.

:::dica BIOS para texto, memória direta para o resto
A BIOS é lenta para desenhar (cada caractere passa por várias camadas de código), mas o placar só muda quando alguém marca ponto. Usar a BIOS ali poupa uma fonte de letras inteira no programa. Já os sprites, que mudam todo quadro, vão direto para A000h. Escolher a ferramenta conforme a frequência é a regra de ouro da otimização ([aula 16](aula:aula16)).
:::

A tela de título desenha a tabela de pontos com os próprios sprites do jogo, usando quatro pequenas tabelas paralelas (`spr_titulo`, `cor_titulo`, `alt_titulo`, `txt_valores`) percorridas com `DI` de 2 em 2. As tabelas de bytes têm um 0 entre cada valor (`DB COR_DISCO, 0, COR_LULA, 0...`) justamente para que o mesmo `DI` sirva para elas e para as de words.

## Erros que você vai cometer (e o jogo evita)

:::atencao Apagar com o desenho errado
Apagar um sprite é desenhá-lo de novo com a cor 0, **com o mesmo desenho e a mesma posição** que foram usados para pintá-lo. Trocar `anim`, `fx` ou `jog_x` antes de apagar deixa restos na tela. Toda rotina de movimento do jogo segue a ordem: apagar → mudar a variável → desenhar.
:::

:::atencao Uma cor nova que colide com as antigas
Se você inventar um objeto novo (um segundo tipo de tiro, um bônus que cai) e pintá-lo com uma cor já usada, `OLHA_COLUNA` vai confundi-lo com outra coisa. Cada tipo de objeto precisa da sua cor na paleta, e as comparações de `MOVE_TIRO` e `MOVE_BOMBAS` precisam saber dela.
:::

:::atencao Devolver o teclado
O jogo troca a INT 9 por uma rotina que não chama a da BIOS. Se ele terminar sem `RESTAURA_TECLADO`, o DOS não recebe mais nenhuma tecla: só resta reiniciar o PC. Por isso existe uma única saída do programa (`@@sair`), que desliga o som, devolve o vetor e volta ao modo texto ([teclado no livro](livro:cap06)).
:::

```quiz
? Quantos bytes ocupa um desenho de 16 × 8 pixels guardado com 1 bit por pixel?
- 128
+ 16
- 8
> Uma word (2 bytes) por linha, 8 linhas: 16 bytes. Com 1 byte por pixel seriam 128.

? Como a rotina SPRITE apaga um invasor?
- Escrevendo um retângulo preto do tamanho do desenho
+ Desenhando o mesmo sprite com AL = 0: só os pixels acesos do desenho voltam a ser pretos
- Com XOR na memória de vídeo
> Os bits 0 do desenho não são tocados nem ao desenhar nem ao apagar, então o que está ao lado do invasor fica intacto.

? Por que o laço de pixels da SPRITE termina com OR DX,DX / JNZ em vez de contar 16 pixels?
+ Para parar assim que não sobra nenhum pixel aceso na linha, poupando as voltas da direita
- Porque LOOP não pode ser usado dentro de outro LOOP
- Para tratar desenhos com mais de 16 pixels
> Os desenhos têm 12 ou 13 pixels de largura e muitas linhas acabam antes disso. Quando DX vira 0, o resto da linha é transparente.

? O tiro achou a cor 34 no pixel (130, 70), com fx = 50 e fy = 34. Qual o índice em vivo[]?
- 25
+ 38
- 41
> Coluna = (130 − 50) ÷ 16 = 5; linha = (70 − 34) ÷ 12 = 3; índice = 3 × 11 + 5 = 38. Cor 34 é um polvo, e polvos estão nas linhas 3 e 4: confere.

? Por que o espaço entre colunas da formação é 16 pixels?
+ Para a divisão pelo espaço virar SHR AX,4 em vez de DIV
- Porque um sprite tem 16 bits
- Porque a tela tem 320 pixels
> Dividir por uma potência de 2 é deslocar. Entre linhas o espaço é 12, e ali o jogo paga um DIV.

? Com 20 invasores vivos, a cada quantos quadros a formação dá um passo?
- 5
+ 7
- 20
> 2 + 20 ÷ 4 = 2 + 5 = 7 quadros.

? Por que MOVE_BOMBAS só liga a variável morreu em vez de chamar PERDE_VIDA na hora?
+ Porque PERDE_VIDA mexe nas bombas e no tiro, e isso estragaria o laço que ainda está percorrendo as bombas
- Porque um CALL dentro de um laço não é permitido
- Para economizar pilha
> Detectar e resolver em momentos diferentes evita mudar as estruturas de dados no meio de um laço que as percorre.

? Como o jogo sabe que existe um buraco num escudo?
- Uma matriz de bits guarda o formato de cada escudo
- Cada escudo tem um contador de acertos
+ Não sabe: o buraco é a ausência de pixels da cor 35 na tela, e OLHA_COLUNA simplesmente não acha nada ali
> A memória de vídeo é a única estrutura de dados dos escudos.
```

## A listagem completa

Aperte **▶ Jogar** para rodar em tela grande. No menu, Espaço começa e Esc sai; no jogo, as setas movem e o Espaço atira. Leia o fonte com calma: cada rotina tem um comentário que diz o que recebe e o que devolve.

```asm jogo titulo="INVASOR.ASM"
; ╔═══════════════════════════════════════════════════════════════╗
; ║  INVASOR.ASM  -  invasores do espaço no modo 13h (320x200)     ║
; ║  Curso Assembly 8086, aula 35                                  ║
; ║                                                                ║
; ║  Programa .COM: TASM INVASOR / TLINK /t INVASOR                ║
; ║  Setas movem o canhão, ESPAÇO atira, ESC volta ao menu.        ║
; ╚═══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; Constantes
; ---------------------------------------------------------------
LINHAS_INV  EQU 5               ; a formação tem 5 linhas
COLUNAS_INV EQU 11              ; de 11 invasores
TOTAL_INV   EQU LINHAS_INV*COLUNAS_INV
ESPACO_X    EQU 16              ; distância entre invasores (pixels)
ESPACO_Y    EQU 12
LARG_INV    EQU 12              ; tamanho do desenho de um invasor
ALT_INV     EQU 8
PASSO_X     EQU 3               ; quanto a formação anda de lado
DESCIDA     EQU 8               ; e quanto desce ao bater na borda
MARGEM      EQU 4

TOPO        EQU 10              ; o tiro some acima desta linha
DISCO_Y     EQU 12
ESCUDO_Y    EQU 150
JOG_Y       EQU 180
CHAO_Y      EQU 190
LARG_JOG    EQU 13
JOG_MIN     EQU MARGEM
JOG_MAX     EQU 320-LARG_JOG-MARGEM
TIRO_VEL    EQU 4
BOMBA_VEL   EQU 2
MAX_BOMBAS  EQU 3

; cores: a paleta de 32 a 41 é programada no começo (aula 24). Cada
; tipo de objeto tem uma cor só dele, e é assim que o jogo descobre
; em que o tiro bateu: olhando a cor do pixel na memória de vídeo.
COR_LULA    EQU 32
COR_CARANG  EQU 33
COR_POLVO   EQU 34
COR_ESCUDO  EQU 35
COR_JOG     EQU 36
COR_TIRO    EQU 37
COR_BOMBA   EQU 38
COR_DISCO   EQU 39
COR_EXPL    EQU 40
COR_CHAO    EQU 41

SC_ESC      EQU 01h
SC_ESPACO   EQU 39h
SC_ESQ      EQU 4Bh
SC_DIR      EQU 4Dh

; ===============================================================
; Programa principal
; ===============================================================
inicio:
        CLD
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX             ; ES fica apontando para o vídeo o tempo todo
        CALL PROGRAMA_PALETA
        CALL INSTALA_TECLADO
        CALL SEMEIA

@@menu: CALL TELA_TITULO        ; CF = 1: o jogador quer sair
        JC   @@sair
        CALL NOVA_PARTIDA
@@quadro:
        CALL ESPERA_RETRACO
        CALL MOVE_JOGADOR
        CALL MOVE_TIRO
        CALL MOVE_BOMBAS
        CALL MOVE_FORMACAO
        CALL SOLTA_BOMBA
        CALL MOVE_DISCO
        CALL ATUALIZA_EXPLOSAO
        CALL SOM_ATUALIZA
        CMP  morreu, 0
        JE   @@vivo
        CALL PERDE_VIDA
@@vivo: CMP  teclas[SC_ESC], 1
        JE   @@desistiu
        CMP  invadiu, 0
        JNE  @@acabou
        CMP  vidas, 0
        JE   @@acabou
        CMP  vivos, 0
        JNE  @@quadro
        CALL PROXIMA_ONDA
        JMP  @@quadro
@@acabou:
        CALL FIM_DE_JOGO
        JMP  @@menu
@@desistiu:
        CALL ESPERA_SOLTAR
        JMP  @@menu

@@sair: CALL SOM_DESLIGA
        CALL RESTAURA_TECLADO
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ===============================================================
; Partida e ondas
; ===============================================================
NOVA_PARTIDA PROC
        MOV  pontos, 0
        MOV  vidas, 3
        MOV  onda, 0
        CALL NOVA_ONDA
        RET
NOVA_PARTIDA ENDP

; NOVA_ONDA: monta a tela de uma onda (cada onda começa um pouco mais baixo)
NOVA_ONDA PROC
        CALL LIMPA_TELA
        MOV  SI, OFFSET vivo    ; todos os 55 voltam à vida
        MOV  CX, TOTAL_INV
@@vivo: MOV  BYTE PTR [SI], 1
        INC  SI
        LOOP @@vivo
        MOV  vivos, TOTAL_INV
        MOV  fx, 40
        MOV  AL, onda
        CMP  AL, 4
        JBE  @@desce
        MOV  AL, 4
@@desce:
        MOV  CL, 3
        SHL  AL, CL             ; 8 pixels mais baixo por onda (até 4 ondas)
        XOR  AH, AH
        ADD  AX, 32
        MOV  fy, AX
        MOV  passo, PASSO_X
        MOV  anim, 0
        MOV  conta_passo, 1
        MOV  tiro_ativo, 0
        MOV  bomba_ativa[0], 0
        MOV  bomba_ativa[2], 0
        MOV  bomba_ativa[4], 0
        MOV  disco_ativo, 0
        MOV  disco_conta, 900
        MOV  bomba_conta, 70
        MOV  expl_tempo, 0
        MOV  invadiu, 0
        MOV  morreu, 0
        MOV  jog_x, 160-LARG_JOG/2
        CALL DESENHA_ESCUDOS
        MOV  AL, COR_CHAO
        XOR  BX, BX
        MOV  DX, CHAO_Y
        MOV  CX, 320
        MOV  SI, 1
        CALL RETANGULO
        CALL DESENHA_JOGADOR
        MOV  AL, 1
        CALL DESENHA_FORMACAO
        CALL MOSTRA_PLACAR
        RET
NOVA_ONDA ENDP

PROXIMA_ONDA PROC
        MOV  CX, 70             ; um segundo de respiro
@@espera:
        CALL ESPERA_RETRACO
        CALL ATUALIZA_EXPLOSAO
        CALL SOM_ATUALIZA
        LOOP @@espera
        INC  onda
        CALL NOVA_ONDA
        RET
PROXIMA_ONDA ENDP

; ===============================================================
; O canhão do jogador
; ===============================================================
MOVE_JOGADOR PROC
        MOV  AX, jog_x
        CMP  teclas[SC_ESQ], 1
        JNE  @@dir
        SUB  AX, 2
@@dir:  CMP  teclas[SC_DIR], 1
        JNE  @@limita
        ADD  AX, 2
@@limita:
        CMP  AX, JOG_MIN
        JGE  @@max
        MOV  AX, JOG_MIN
@@max:  CMP  AX, JOG_MAX
        JLE  @@ok
        MOV  AX, JOG_MAX
@@ok:   CMP  AX, jog_x
        JE   @@fim              ; não mexeu: nada a redesenhar
        PUSH AX
        XOR  AL, AL             ; apaga na posição velha...
        CALL SPRITE_JOGADOR
        POP  AX
        MOV  jog_x, AX
        CALL DESENHA_JOGADOR    ; ...e desenha na nova
@@fim:  RET
MOVE_JOGADOR ENDP

DESENHA_JOGADOR PROC
        MOV  AL, COR_JOG
        CALL SPRITE_JOGADOR
        RET
DESENHA_JOGADOR ENDP

; SPRITE_JOGADOR: desenha o canhão na cor AL (0 apaga)
SPRITE_JOGADOR PROC
        MOV  SI, OFFSET canhao
        MOV  BX, jog_x
        MOV  DX, JOG_Y
        MOV  CL, 8
        CALL SPRITE
        RET
SPRITE_JOGADOR ENDP

; PERDE_VIDA: uma bomba acertou o canhão
PERDE_VIDA PROC
        MOV  morreu, 0
        DEC  vidas
        CALL MOSTRA_PLACAR
        MOV  BX, 9000           ; som grave e comprido
        MOV  CL, 12
        CALL SOM_LIGA
        CALL TIRA_BOMBAS
        CMP  tiro_ativo, 0
        JE   @@anima
        CALL APAGA_TIRO
        MOV  tiro_ativo, 0
@@anima:
        MOV  DI, 24             ; 24 trocas de quadro, 4 quadros cada
@@troca:
        MOV  SI, OFFSET canhao_x1
        TEST DI, 1
        JZ   @@desenha
        MOV  SI, OFFSET canhao_x2
@@desenha:
        PUSH SI
        MOV  AL, 0              ; apaga o que estiver lá
        MOV  BX, jog_x
        MOV  DX, JOG_Y
        MOV  CX, LARG_JOG
        PUSH SI
        MOV  SI, 8
        CALL RETANGULO
        POP  SI
        MOV  AL, COR_JOG
        MOV  CL, 8
        CALL SPRITE
        POP  SI
        MOV  CX, 4
@@quadros:
        CALL ESPERA_RETRACO
        CALL SOM_ATUALIZA
        LOOP @@quadros
        DEC  DI
        JNZ  @@troca
        MOV  AL, 0              ; apaga os destroços
        MOV  BX, jog_x
        MOV  DX, JOG_Y
        MOV  CX, LARG_JOG
        MOV  SI, 8
        CALL RETANGULO
        CMP  vidas, 0
        JE   @@fim
        MOV  jog_x, 160-LARG_JOG/2
        CALL DESENHA_JOGADOR
@@fim:  RET
PERDE_VIDA ENDP

; ===============================================================
; O tiro do jogador (só um de cada vez, como no fliperama)
; ===============================================================
MOVE_TIRO PROC
        CMP  tiro_ativo, 0
        JNE  @@voa
        CMP  teclas[SC_ESPACO], 1
        JNE  @@fim
        MOV  AX, jog_x          ; dispara do bico do canhão
        ADD  AX, LARG_JOG/2
        MOV  tiro_x, AX
        MOV  tiro_y, JOG_Y-5
        MOV  tiro_ativo, 1
        MOV  BX, 1200
        MOV  CL, 1
        CALL SOM_LIGA
        JMP  SHORT @@desenha
@@voa:  CALL APAGA_TIRO
        SUB  tiro_y, TIRO_VEL
        CMP  tiro_y, TOPO
        JGE  @@olha
        MOV  tiro_ativo, 0      ; saiu por cima
@@fim:  RET
@@olha: MOV  BX, tiro_x         ; tem alguma coisa onde o tiro vai ficar?
        MOV  DX, tiro_y
        MOV  CX, 4
        CALL OLHA_COLUNA        ; AL = cor achada, DX = linha dela
        CMP  AL, COR_LULA
        JB   @@desenha          ; nada (0) ou cor que não interessa
        CMP  AL, COR_POLVO
        JBE  @@invasor
        CMP  AL, COR_ESCUDO
        JE   @@escudo
        CMP  AL, COR_DISCO
        JE   @@disco
@@desenha:
        MOV  AL, COR_TIRO
        CALL PINTA_TIRO
        RET
@@invasor:
        MOV  tiro_ativo, 0
        CALL MATA_INVASOR
        RET
@@escudo:
        MOV  tiro_ativo, 0
        CALL MORDE_ESCUDO
        RET
@@disco:
        MOV  tiro_ativo, 0
        CALL ACERTA_DISCO
        RET
MOVE_TIRO ENDP

APAGA_TIRO PROC
        XOR  AL, AL
        CALL PINTA_TIRO
        RET
APAGA_TIRO ENDP

; PINTA_TIRO: o tiro é um risco de 1x4 pixels na cor AL
PINTA_TIRO PROC
        MOV  BX, tiro_x
        MOV  DX, tiro_y
        MOV  CX, 1
        MOV  SI, 4
        CALL RETANGULO
        RET
PINTA_TIRO ENDP

; MATA_INVASOR: o tiro achou a cor de um invasor no pixel (BX, DX).
; Coluna = (x - fx) / 16 e linha = (y - fy) / 12: a posição na tela diz
; qual dos 55 foi atingido, sem precisar testar um por um.
MATA_INVASOR PROC
        MOV  AX, BX
        SUB  AX, fx
        MOV  CL, 4
        SHR  AX, CL             ; AX = coluna (0-10)
        MOV  col_alvo, AL
        MOV  AX, DX
        SUB  AX, fy
        MOV  CL, ESPACO_Y
        DIV  CL                 ; AL = linha (0-4)
        MOV  lin_alvo, AL
        MOV  BL, AL
        MOV  AL, COLUNAS_INV
        MUL  BL                 ; AX = linha * 11
        ADD  AL, col_alvo
        MOV  BX, AX
        MOV  vivo[BX], 0        ; morreu
        DEC  vivos
        MOV  BL, lin_alvo       ; pontos conforme a linha
        XOR  BH, BH
        SHL  BX, 1
        MOV  AX, pontos_linha[BX]
        ADD  pontos, AX
        MOV  SI, spr_linha[BX]  ; o desenho certo, para apagar
        CMP  anim, 0
        JE   @@quadro
        ADD  SI, 16
@@quadro:
        MOV  AL, col_alvo       ; BX = fx + coluna * 16
        XOR  AH, AH
        MOV  CL, 4
        SHL  AX, CL
        ADD  AX, fx
        MOV  BX, AX
        MOV  AL, lin_alvo       ; DX = fy + linha * 12
        MOV  CL, ESPACO_Y
        MUL  CL
        ADD  AX, fy
        MOV  DX, AX
        XOR  AL, AL
        MOV  CL, ALT_INV
        CALL SPRITE             ; apaga o invasor
        CALL EXPLODE            ; e põe a explosão no lugar dele
        MOV  BX, 6000
        MOV  CL, 2
        CALL SOM_LIGA
        CALL MOSTRA_PLACAR
        RET
MATA_INVASOR ENDP

; EXPLODE: desenha a explosão em (BX, DX); ela some sozinha depois
EXPLODE PROC
        CMP  expl_tempo, 0      ; só existe uma explosão por vez:
        JE   @@nova             ; se ainda há outra na tela, apaga
        PUSH BX
        PUSH DX
        CALL APAGA_EXPLOSAO
        POP  DX
        POP  BX
@@nova:
        MOV  expl_x, BX
        MOV  expl_y, DX
        MOV  expl_tempo, 10
        MOV  AL, COR_EXPL
        MOV  SI, OFFSET explosao
        MOV  CL, 8
        CALL SPRITE
        RET
EXPLODE ENDP

ATUALIZA_EXPLOSAO PROC
        CMP  expl_tempo, 0
        JE   @@fim
        DEC  expl_tempo
        JNZ  @@fim
        CALL APAGA_EXPLOSAO     ; o tempo dela acabou
@@fim:  RET
ATUALIZA_EXPLOSAO ENDP

APAGA_EXPLOSAO PROC
        MOV  expl_tempo, 0
        XOR  AL, AL
        MOV  BX, expl_x
        MOV  DX, expl_y
        MOV  SI, OFFSET explosao
        MOV  CL, 8
        CALL SPRITE
        RET
APAGA_EXPLOSAO ENDP

; MORDE_ESCUDO: tira um pedaço de 3x4 pixels do escudo em volta de (BX, DX).
; Só apaga pixels da cor do escudo, para não estragar mais nada.
MORDE_ESCUDO PROC
        PUSH DI                 ; MOVE_BOMBAS usa DI como índice
        DEC  BX
        DEC  DX
        CALL ENDERECO           ; DI = canto do pedaço
        MOV  DX, 4              ; 4 linhas
@@linha:
        MOV  CX, 3              ; de 3 pixels
@@pixel:
        CMP  BYTE PTR ES:[DI], COR_ESCUDO
        JNE  @@prox
        MOV  BYTE PTR ES:[DI], 0
@@prox: INC  DI
        LOOP @@pixel
        ADD  DI, 320-3
        DEC  DX
        JNZ  @@linha
        MOV  BX, 3000
        MOV  CL, 1
        CALL SOM_LIGA
        POP  DI
        RET
MORDE_ESCUDO ENDP

; ===============================================================
; A formação de invasores
; ===============================================================

; MOVE_FORMACAO: a cada "conta_passo" quadros a formação anda um passo.
; Quanto menos invasores, mais curto o intervalo: no fim eles correm.
MOVE_FORMACAO PROC
        DEC  conta_passo
        JZ   @@anda
        RET
@@anda: MOV  AL, vivos
        SHR  AL, 1
        SHR  AL, 1
        ADD  AL, 2
        MOV  conta_passo, AL    ; próximo passo em 2 + vivos/4 quadros
        CALL BORDAS             ; BX = x da esquerda, DX = x da direita
        XOR  DI, DI             ; DI = quanto desce (0 ou DESCIDA)
        MOV  CX, passo          ; CX = quanto anda de lado
        OR   CX, CX
        JS   @@para_esq
        ADD  DX, CX
        CMP  DX, 320-MARGEM
        JLE  @@move
        JMP  SHORT @@vira
@@para_esq:
        ADD  BX, CX
        CMP  BX, MARGEM
        JGE  @@move
@@vira: NEG  passo              ; bateu na borda: desce e muda de lado
        XOR  CX, CX
        MOV  DI, DESCIDA
@@move: PUSH CX
        PUSH DI
        XOR  AL, AL             ; apaga todos (com o quadro atual)
        CALL DESENHA_FORMACAO
        POP  DI
        POP  CX
        ADD  fx, CX
        ADD  fy, DI
        XOR  anim, 1            ; troca o quadro da animação
        MOV  AL, 1
        CALL DESENHA_FORMACAO   ; e desenha de novo
        CALL NOTA_MARCHA
        MOV  AL, lin_max        ; chegaram no chão do canhão?
        MOV  CL, ESPACO_Y
        MUL  CL
        ADD  AX, fy
        ADD  AX, ALT_INV
        CMP  AX, JOG_Y
        JL   @@fim
        MOV  invadiu, 1
@@fim:  RET
MOVE_FORMACAO ENDP

; BORDAS: acha a primeira e a última coluna com alguém vivo e a linha
; viva mais de baixo. Devolve BX = x da borda esquerda, DX = x da direita.
BORDAS  PROC
        XOR  BX, BX             ; procura da esquerda para a direita
@@c1:   MOV  SI, BX
        MOV  CX, LINHAS_INV
@@l1:   CMP  vivo[SI], 0
        JNE  @@achou1
        ADD  SI, COLUNAS_INV
        LOOP @@l1
        INC  BX
        CMP  BX, COLUNAS_INV
        JB   @@c1
@@achou1:
        MOV  col_min, BL
        MOV  BX, COLUNAS_INV-1  ; e da direita para a esquerda
@@c2:   MOV  SI, BX
        MOV  CX, LINHAS_INV
@@l2:   CMP  vivo[SI], 0
        JNE  @@achou2
        ADD  SI, COLUNAS_INV
        LOOP @@l2
        DEC  BX
        JNS  @@c2
        XOR  BX, BX
@@achou2:
        MOV  col_max, BL
        MOV  SI, TOTAL_INV-1    ; a linha mais de baixo com alguém vivo
@@l3:   CMP  vivo[SI], 0
        JNE  @@achou3
        DEC  SI
        JNS  @@l3
        XOR  SI, SI
@@achou3:
        MOV  AX, SI
        MOV  CL, COLUNAS_INV
        DIV  CL
        MOV  lin_max, AL
        MOV  CL, 4              ; esquerda = fx + col_min * 16
        MOV  BL, col_min
        XOR  BH, BH
        SHL  BX, CL
        ADD  BX, fx
        MOV  DL, col_max        ; direita = fx + col_max * 16 + 12
        XOR  DH, DH
        SHL  DX, CL
        ADD  DX, fx
        ADD  DX, LARG_INV
        RET
BORDAS  ENDP

; DESENHA_FORMACAO: AL = 0 apaga todos os vivos; senão desenha cada
; linha na sua cor. O quadro da animação (anim) escolhe o desenho.
DESENHA_FORMACAO PROC
        MOV  cor_modo, AL
        XOR  DI, DI             ; DI = índice em vivo[] (0 a 54)
        MOV  DX, fy
        XOR  AH, AH             ; AH = linha (0 a 4)
@@linha:
        MOV  BL, AH
        XOR  BH, BH
        MOV  AL, cor_modo
        OR   AL, AL
        JZ   @@cor
        MOV  AL, cor_linha[BX]
@@cor:  SHL  BX, 1
        MOV  SI, spr_linha[BX]
        CMP  anim, 0
        JE   @@quadro
        ADD  SI, 16             ; o segundo quadro vem logo depois (8 words)
@@quadro:
        MOV  BX, fx
        MOV  CH, COLUNAS_INV
@@coluna:
        CMP  vivo[DI], 0
        JE   @@prox
        MOV  CL, ALT_INV
        CALL SPRITE
@@prox: INC  DI
        ADD  BX, ESPACO_X
        DEC  CH
        JNZ  @@coluna
        ADD  DX, ESPACO_Y
        INC  AH
        CMP  AH, LINHAS_INV
        JB   @@linha
        RET
DESENHA_FORMACAO ENDP

; NOTA_MARCHA: as quatro notas graves que tocam a cada passo
NOTA_MARCHA PROC
        MOV  BL, nota
        INC  nota
        AND  BX, 3
        SHL  BX, 1
        MOV  BX, notas_marcha[BX]
        MOV  CL, 1
        CALL SOM_LIGA
        RET
NOTA_MARCHA ENDP

; ===============================================================
; Bombas dos invasores
; ===============================================================

; SOLTA_BOMBA: de tempos em tempos, um invasor da fila de baixo de uma
; coluna sorteada solta uma bomba (se houver vaga entre as 3).
SOLTA_BOMBA PROC
        DEC  bomba_conta
        JZ   @@sorteia
        RET
@@sorteia:
        MOV  AX, 40
        CALL ALEATORIO
        ADD  AL, 15
        MOV  bomba_conta, AL    ; próxima em 15 a 54 quadros
        XOR  DI, DI             ; DI = vaga (0, 2 ou 4)
@@vaga: CMP  bomba_ativa[DI], 0
        JE   @@achou_vaga
        ADD  DI, 2
        CMP  DI, MAX_BOMBAS*2
        JB   @@vaga
        RET                     ; as três estão caindo
@@achou_vaga:
        MOV  AX, COLUNAS_INV
        CALL ALEATORIO          ; AX = coluna
        MOV  BX, AX
        MOV  SI, AX
        ADD  SI, (LINHAS_INV-1)*COLUNAS_INV
        MOV  CX, LINHAS_INV     ; sobe procurando alguém vivo
@@busca:
        CMP  vivo[SI], 0
        JNE  @@achou
        SUB  SI, COLUNAS_INV
        LOOP @@busca
        RET                     ; coluna vazia: fica para a próxima
@@achou:
        DEC  CX                 ; CX = linha do invasor
        MOV  AX, CX
        MOV  CL, ESPACO_Y
        MUL  CL
        ADD  AX, fy
        ADD  AX, ALT_INV+1
        MOV  bomba_y[DI], AX    ; logo abaixo do invasor
        MOV  CL, 4
        SHL  BX, CL
        ADD  BX, fx
        ADD  BX, LARG_INV/2
        MOV  bomba_x[DI], BX
        MOV  bomba_ativa[DI], 1
        MOV  AL, COR_BOMBA
        CALL PINTA_BOMBA
        RET
SOLTA_BOMBA ENDP

MOVE_BOMBAS PROC
        XOR  DI, DI
@@bomba:
        CMP  bomba_ativa[DI], 0
        JE   @@prox
        XOR  AL, AL
        CALL PINTA_BOMBA        ; apaga
        ADD  bomba_y[DI], BOMBA_VEL
        CMP  bomba_y[DI], CHAO_Y-4
        JG   @@some             ; chegou no chão
        MOV  BX, bomba_x[DI]
        MOV  DX, bomba_y[DI]
        MOV  CX, 4
        CALL OLHA_COLUNA
        CMP  AL, COR_ESCUDO
        JE   @@escudo
        CMP  AL, COR_JOG
        JE   @@jogador
        MOV  AL, COR_BOMBA
        CALL PINTA_BOMBA
        JMP  SHORT @@prox
@@escudo:
        CALL MORDE_ESCUDO
        JMP  SHORT @@some
@@jogador:
        MOV  morreu, 1          ; quem cuida disso é o laço principal
@@some: MOV  bomba_ativa[DI], 0
@@prox: ADD  DI, 2
        CMP  DI, MAX_BOMBAS*2
        JB   @@bomba
        RET
MOVE_BOMBAS ENDP

; PINTA_BOMBA: a bomba DI é um risco de 1x4 na cor AL
PINTA_BOMBA PROC
        MOV  BX, bomba_x[DI]
        MOV  DX, bomba_y[DI]
        MOV  CX, 1
        MOV  SI, 4
        CALL RETANGULO
        RET
PINTA_BOMBA ENDP

; TIRA_BOMBAS: apaga as bombas que estão caindo (o jogador morreu)
TIRA_BOMBAS PROC
        XOR  DI, DI
@@bomba:
        CMP  bomba_ativa[DI], 0
        JE   @@prox
        XOR  AL, AL
        CALL PINTA_BOMBA
        MOV  bomba_ativa[DI], 0
@@prox: ADD  DI, 2
        CMP  DI, MAX_BOMBAS*2
        JB   @@bomba
        RET
TIRA_BOMBAS ENDP

; ===============================================================
; O disco voador misterioso
; ===============================================================
MOVE_DISCO PROC
        CMP  disco_ativo, 0
        JNE  @@voa
        DEC  disco_conta
        JNZ  @@fim
        MOV  AX, 600            ; o próximo vem em 600 a 1199 quadros
        CALL ALEATORIO
        ADD  AX, 600
        MOV  disco_conta, AX
        MOV  disco_ativo, 1
        MOV  disco_x, 0
        MOV  disco_dir, 1
        MOV  AX, 2              ; cara ou coroa: de que lado ele vem
        CALL ALEATORIO
        OR   AX, AX
        JZ   @@desenha
        MOV  disco_x, 320-16
        MOV  disco_dir, -1
        JMP  SHORT @@desenha
@@voa:  XOR  disco_fase, 1      ; anda um pixel a cada dois quadros
        JZ   @@fim
        XOR  AL, AL
        CALL PINTA_DISCO
        MOV  AX, disco_dir
        ADD  disco_x, AX
        CMP  disco_x, 0
        JL   @@saiu
        CMP  disco_x, 320-16
        JG   @@saiu
@@desenha:
        MOV  AL, COR_DISCO
        CALL PINTA_DISCO
@@fim:  RET
@@saiu: MOV  disco_ativo, 0
        RET
MOVE_DISCO ENDP

PINTA_DISCO PROC
        MOV  SI, OFFSET disco
        MOV  BX, disco_x
        MOV  DX, DISCO_Y
        MOV  CL, 7
        CALL SPRITE
        RET
PINTA_DISCO ENDP

; ACERTA_DISCO: vale 50, 100, 150 ou 300 pontos (sorteado)
ACERTA_DISCO PROC
        XOR  AL, AL
        CALL PINTA_DISCO
        MOV  disco_ativo, 0
        MOV  AX, 4
        CALL ALEATORIO
        MOV  BX, AX
        SHL  BX, 1
        MOV  AX, premio_disco[BX]
        ADD  pontos, AX
        MOV  BX, disco_x
        ADD  BX, 2
        MOV  DX, DISCO_Y
        CALL EXPLODE
        MOV  BX, 800
        MOV  CL, 4
        CALL SOM_LIGA
        CALL MOSTRA_PLACAR
        RET
ACERTA_DISCO ENDP

; ===============================================================
; Escudos, placar e telas
; ===============================================================
DESENHA_ESCUDOS PROC
        XOR  DI, DI
@@escudo:
        MOV  BX, escudos_x[DI]
        MOV  DX, ESCUDO_Y
        MOV  AL, COR_ESCUDO
        MOV  CL, 16
        MOV  SI, OFFSET escudo_e   ; 22 pixels não cabem numa word:
        CALL SPRITE                ; o escudo é desenhado em duas metades
        ADD  BX, 11
        MOV  SI, OFFSET escudo_d
        CALL SPRITE
        ADD  DI, 2
        CMP  DI, 8
        JB   @@escudo
        RET
DESENHA_ESCUDOS ENDP

; MOSTRA_PLACAR: PONTOS 00000  RECORDE 00000  VIDAS 3 (linha 0 de texto)
MOSTRA_PLACAR PROC
        MOV  DH, 0
        MOV  DL, 0
        MOV  BL, 7
        MOV  SI, OFFSET txt_placar
        CALL ESCREVE_TXT
        MOV  AX, pontos
        MOV  DL, 7
        CALL ESCREVE_NUM
        MOV  AX, recorde
        MOV  DL, 21
        CALL ESCREVE_NUM
        MOV  AL, 0              ; apaga o número de vidas antigo
        MOV  BX, 34*8
        MOV  DX, 0
        MOV  CX, 8
        MOV  SI, 8
        CALL RETANGULO
        MOV  DH, 0
        MOV  DL, 34
        MOV  AH, 02h
        XOR  BH, BH
        INT  10h
        MOV  AL, vidas
        ADD  AL, '0'
        MOV  BL, COR_JOG
        MOV  AH, 0Eh
        INT  10h
        RET
MOSTRA_PLACAR ENDP

; ESCREVE_NUM: AX com 5 dígitos na linha 0, coluna DL, em branco
ESCREVE_NUM PROC
        PUSH AX
        PUSH DX
        MOV  AL, 0              ; apaga os dígitos velhos (o BIOS só pinta
        MOV  BL, DL             ; os pixels acesos da letra)
        XOR  BH, BH
        MOV  CL, 3
        SHL  BX, CL
        XOR  DX, DX
        MOV  CX, 5*8
        MOV  SI, 8
        CALL RETANGULO
        POP  DX
        MOV  AH, 02h
        XOR  BH, BH
        MOV  DH, 0
        INT  10h
        POP  AX
        MOV  BX, 10
        MOV  CX, 5
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX                 ; os restos saem de trás para a frente
        LOOP @@divide
        MOV  CX, 5
@@mostra:
        POP  AX
        ADD  AL, '0'
        MOV  BL, 15
        MOV  AH, 0Eh
        INT  10h
        LOOP @@mostra
        RET
ESCREVE_NUM ENDP

TELA_TITULO PROC
        CALL SOM_DESLIGA
        CALL LIMPA_TELA
        MOV  DH, 3
        MOV  DL, 11
        MOV  BL, 15
        MOV  SI, OFFSET txt_titulo
        CALL ESCREVE_TXT
        MOV  DH, 6
        MOV  DL, 10
        MOV  BL, 7
        MOV  SI, OFFSET txt_tabela
        CALL ESCREVE_TXT
        MOV  DH, 9              ; um de cada, com o valor
        MOV  DI, 0
@@tabela:
        MOV  DL, 18
        MOV  BL, 7
        MOV  SI, txt_valores[DI]
        PUSH DX
        CALL ESCREVE_TXT
        POP  DX
        MOV  SI, spr_titulo[DI]
        MOV  AL, cor_titulo[DI]
        MOV  CL, alt_titulo[DI]
        MOV  BX, 18*8-24        ; desenho à esquerda do texto
        PUSH DX
        MOV  DL, DH
        XOR  DH, DH
        SHL  DX, 1
        SHL  DX, 1
        SHL  DX, 1              ; linha de texto * 8 = y
        CALL SPRITE
        POP  DX
        ADD  DH, 2
        ADD  DI, 2
        CMP  DI, 8
        JB   @@tabela
        MOV  DH, 19
        MOV  DL, 10
        MOV  BL, 14
        MOV  SI, OFFSET txt_comeca
        CALL ESCREVE_TXT
        MOV  DH, 21
        MOV  DL, 7
        MOV  BL, 7
        MOV  SI, OFFSET txt_teclas
        CALL ESCREVE_TXT
        MOV  DH, 23
        MOV  DL, 16
        MOV  SI, OFFSET txt_sair
        CALL ESCREVE_TXT
        CALL ESPERA_SOLTAR
@@espera:
        CMP  teclas[SC_ESPACO], 1
        JE   @@joga
        CMP  teclas[SC_ESC], 1
        JNE  @@espera
        STC
        RET
@@joga: CALL ESPERA_SOLTAR
        CLC
        RET
TELA_TITULO ENDP

FIM_DE_JOGO PROC
        MOV  AX, pontos
        CMP  AX, recorde
        JBE  @@caixa
        MOV  recorde, AX
@@caixa:
        MOV  AL, COR_DISCO      ; uma caixa vermelha com o miolo preto
        MOV  BX, 64
        MOV  DX, 76
        MOV  CX, 192
        MOV  SI, 44
        CALL RETANGULO
        XOR  AL, AL
        MOV  BX, 66
        MOV  DX, 78
        MOV  CX, 188
        MOV  SI, 40
        CALL RETANGULO
        MOV  DH, 10
        MOV  DL, 14
        MOV  BL, 15
        MOV  SI, OFFSET txt_fim
        CALL ESCREVE_TXT
        MOV  DH, 12
        MOV  DL, 10
        MOV  BL, 7
        MOV  SI, OFFSET txt_volta
        CALL ESCREVE_TXT
        CALL MOSTRA_PLACAR
        CALL ESPERA_SOLTAR
@@espera:
        CALL SOM_ATUALIZA
        CMP  teclas[SC_ESPACO], 1
        JNE  @@espera
        CALL ESPERA_SOLTAR
        RET
FIM_DE_JOGO ENDP

; ===============================================================
; Rotinas gráficas
; ===============================================================

; ENDERECO: DI = DX * 320 + BX (y * 256 + y * 64 + x, sem MUL)
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL             ; DX = y * 256
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1              ; DI = y * 64
        ADD  DI, DX
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP

; SPRITE: desenha um desenho de 1 bit por pixel.
; SI = desenho (uma word por linha, bit 15 = pixel da esquerda),
; BX = x, DX = y, AL = cor, CL = número de linhas.
; Bits 0 ficam transparentes; com AL = 0 a mesma rotina apaga o desenho.
SPRITE  PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        PUSH BP
        CALL ENDERECO
        XOR  CH, CH
@@linha:
        MOV  BP, DI             ; BP = começo da linha na tela
        MOV  DX, [SI]           ; DX = os 16 pixels da linha
        ADD  SI, 2
@@pixel:
        SHL  DX, 1              ; o próximo pixel sai no CF
        JNC  @@vazio
        MOV  ES:[DI], AL
@@vazio:
        INC  DI
        OR   DX, DX             ; acabaram os bits 1 da linha?
        JNZ  @@pixel
        MOV  DI, BP
        ADD  DI, 320
        LOOP @@linha
        POP  BP
        POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
SPRITE  ENDP

; RETANGULO: CX x SI pixels na cor AL a partir de (BX, DX)
RETANGULO PROC
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        CALL ENDERECO
        MOV  DX, CX
@@linha:
        MOV  CX, DX
        REP  STOSB
        SUB  DI, DX
        ADD  DI, 320
        DEC  SI
        JNZ  @@linha
        POP  DI
        POP  SI
        POP  DX
        POP  CX
        RET
RETANGULO ENDP

; OLHA_COLUNA: procura um pixel aceso na coluna BX, de DX para baixo,
; em CX linhas. Devolve AL = cor achada (0 = nada) e DX = linha dela.
OLHA_COLUNA PROC
        PUSH CX
        PUSH DI
        CALL ENDERECO
@@olha: MOV  AL, ES:[DI]
        OR   AL, AL
        JNZ  @@fim
        ADD  DI, 320
        INC  DX
        LOOP @@olha
@@fim:  POP  DI
        POP  CX
        RET
OLHA_COLUNA ENDP

LIMPA_TELA PROC
        XOR  DI, DI
        XOR  AX, AX
        MOV  CX, 32000
        REP  STOSW
        RET
LIMPA_TELA ENDP

; PROGRAMA_PALETA: cores 32 a 41 (porta 3C8h = índice, 3C9h = R, G, B)
PROGRAMA_PALETA PROC
        MOV  DX, 3C8h
        MOV  AL, COR_LULA
        OUT  DX, AL
        INC  DX
        MOV  SI, OFFSET paleta
        MOV  CX, 10*3
@@cor:  LODSB
        OUT  DX, AL
        LOOP @@cor
        RET
PROGRAMA_PALETA ENDP

ESPERA_RETRACO PROC
        PUSH AX
        PUSH DX
        MOV  DX, 3DAh
@@fora: IN   AL, DX
        TEST AL, 8
        JNZ  @@fora
@@dentro:
        IN   AL, DX
        TEST AL, 8
        JZ   @@dentro
        POP  DX
        POP  AX
        RET
ESPERA_RETRACO ENDP

; ESCREVE_TXT: texto terminado em 0 (SI) na linha DH, coluna DL, cor BL
ESCREVE_TXT PROC
        MOV  AH, 02h
        XOR  BH, BH
        INT  10h
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE_TXT ENDP

; ===============================================================
; Teclado (INT 9), tempo, sorteio e som - as mesmas rotinas do Pong
; ===============================================================
NOVA_INT9 PROC FAR
        PUSH AX
        PUSH BX
        IN   AL, 60h
        MOV  BL, AL
        AND  BX, 007Fh
        SHL  AL, 1
        CMC
        MOV  AL, 0
        ADC  AL, 0
        MOV  CS:teclas[BX], AL
        MOV  AL, 20h
        OUT  20h, AL
        POP  BX
        POP  AX
        IRET
NOVA_INT9 ENDP

INSTALA_TECLADO PROC
        PUSH ES
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR int9_antiga, BX
        MOV  WORD PTR int9_antiga+2, ES
        POP  ES
        MOV  AX, 2509h
        MOV  DX, OFFSET NOVA_INT9
        INT  21h
        RET
INSTALA_TECLADO ENDP

RESTAURA_TECLADO PROC
        PUSH DS
        LDS  DX, int9_antiga
        MOV  AX, 2509h
        INT  21h
        POP  DS
        RET
RESTAURA_TECLADO ENDP

ESPERA_SOLTAR PROC
@@de_novo:
        MOV  SI, OFFSET teclas
        MOV  CX, 128
@@olha: LODSB
        OR   AL, AL
        JNZ  @@de_novo
        LOOP @@olha
        RET
ESPERA_SOLTAR ENDP

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

SEMEIA  PROC
        CALL LE_RELOGIO
        MOV  semente, AX
        RET
SEMEIA  ENDP

; ALEATORIO: AX = número de 0 a AX-1
ALEATORIO PROC
        PUSH BX
        PUSH DX
        MOV  BX, AX
        MOV  AX, semente
        MOV  DX, 25173
        MUL  DX
        ADD  AX, 13849
        MOV  semente, AX
        MUL  BX
        MOV  AX, DX
        POP  DX
        POP  BX
        RET
ALEATORIO ENDP

; SOM_LIGA: BX = divisor do PIT, CL = duração em tiques
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
        INC  AX
        MOV  som_fim, AX
        MOV  som_ligado, 1
        POP  CX
        POP  AX
        RET
SOM_LIGA ENDP

SOM_ATUALIZA PROC
        CMP  som_ligado, 1
        JNE  @@fim
        CALL LE_RELOGIO
        CMP  AX, som_fim
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
paleta      DB 63,20,63         ; 32 lula: magenta
            DB 20,63,63         ; 33 caranguejo: ciano
            DB 63,63,20         ; 34 polvo: amarelo
            DB 10,48,10         ; 35 escudo: verde
            DB 20,63,20         ; 36 canhão: verde claro
            DB 63,63,63         ; 37 tiro: branco
            DB 63,40,40         ; 38 bomba: rosa
            DB 63,10,10         ; 39 disco: vermelho
            DB 63,40,0          ; 40 explosão: laranja
            DB 20,48,20         ; 41 chão

; por linha da formação: desenho, cor e pontos
spr_linha   DW inv1_a, inv2_a, inv2_a, inv3_a, inv3_a
cor_linha   DB COR_LULA, COR_CARANG, COR_CARANG, COR_POLVO, COR_POLVO
pontos_linha DW 30, 20, 20, 10, 10
premio_disco DW 50, 100, 150, 300
notas_marcha DW 12175, 13715, 14551, 16345
escudos_x   DW 29, 109, 189, 269

; tela de título: desenho, cor, altura e texto de cada tipo
spr_titulo  DW disco, inv1_a, inv2_a, inv3_a
cor_titulo  DB COR_DISCO, 0, COR_LULA, 0, COR_CARANG, 0, COR_POLVO, 0
alt_titulo  DB 7, 0, 8, 0, 8, 0, 8, 0
txt_valores DW txt_v_disco, txt_v_lula, txt_v_carang, txt_v_polvo

txt_titulo  DB 'I N V A S O R E S', 0
txt_tabela  DB '* TABELA DE PONTOS *', 0
txt_v_disco DB '= ? MISTERIO', 0
txt_v_lula  DB '= 30 PONTOS', 0
txt_v_carang DB '= 20 PONTOS', 0
txt_v_polvo DB '= 10 PONTOS', 0
txt_comeca  DB 'ESPACO comeca o jogo', 0
txt_teclas  DB 'setas movem, ESPACO atira', 0
txt_sair    DB 'ESC sai', 0
txt_placar  DB 'PONTOS       RECORDE       VIDAS', 0
txt_fim     DB 'FIM DE JOGO', 0
txt_volta   DB 'ESPACO volta ao menu', 0

; estado do jogo
pontos      DW 0
recorde     DW 0
vidas       DB 3
onda        DB 0
morreu      DB 0
invadiu     DB 0
vivo        DB TOTAL_INV DUP (1)   ; 1 = invasor vivo
vivos       DB TOTAL_INV
fx          DW 40               ; canto da formação (invasor 0)
fy          DW 32
passo       DW PASSO_X          ; +3 anda para a direita, -3 para a esquerda
anim        DB 0
conta_passo DB 1
cor_modo    DB 0
col_min     DB 0
col_max     DB 0
lin_max     DB 0
col_alvo    DB 0
lin_alvo    DB 0
nota        DB 0
jog_x       DW 0
tiro_ativo  DB 0
tiro_x      DW 0
tiro_y      DW 0
bomba_ativa DW MAX_BOMBAS DUP (0)
bomba_x     DW MAX_BOMBAS DUP (0)
bomba_y     DW MAX_BOMBAS DUP (0)
bomba_conta DB 70
disco_ativo DB 0
disco_fase  DB 0
disco_x     DW 0
disco_dir   DW 1
disco_conta DW 900
expl_tempo  DB 0
expl_x      DW 0
expl_y      DW 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0
int9_antiga DD 0
teclas      DB 128 DUP (0)

; desenhos (gerados à mão, um bit por pixel)
; invasor de cima (lula), quadro 1
inv1_a     DW 0000011000000000b   ; .....##
           DW 0000111100000000b   ; ....####
           DW 0001111110000000b   ; ...######
           DW 0011011011000000b   ; ..##.##.##
           DW 0011111111000000b   ; ..########
           DW 0000100100000000b   ; ....#..#
           DW 0001011010000000b   ; ...#.##.#
           DW 0010100101000000b   ; ..#.#..#.#
; lula, quadro 2
inv1_b     DW 0000011000000000b   ; .....##
           DW 0000111100000000b   ; ....####
           DW 0001111110000000b   ; ...######
           DW 0011011011000000b   ; ..##.##.##
           DW 0011111111000000b   ; ..########
           DW 0001011010000000b   ; ...#.##.#
           DW 0010000001000000b   ; ..#......#
           DW 0001000010000000b   ; ...#....#
; caranguejo, quadro 1
inv2_a     DW 0010000010000000b   ; ..#.....#
           DW 0001000100000000b   ; ...#...#
           DW 0011111110000000b   ; ..#######
           DW 0110111011000000b   ; .##.###.##
           DW 1111111111100000b   ; ###########
           DW 1011111110100000b   ; #.#######.#
           DW 1010000010100000b   ; #.#.....#.#
           DW 0001101100000000b   ; ...##.##
; caranguejo, quadro 2
inv2_b     DW 0010000010000000b   ; ..#.....#
           DW 1001000100100000b   ; #..#...#..#
           DW 1011111110100000b   ; #.#######.#
           DW 1110111011100000b   ; ###.###.###
           DW 1111111111100000b   ; ###########
           DW 0111111111000000b   ; .#########
           DW 0010000010000000b   ; ..#.....#
           DW 0100000001000000b   ; .#.......#
; polvo, quadro 1
inv3_a     DW 0000111100000000b   ; ....####
           DW 0111111111100000b   ; .##########
           DW 1111111111110000b   ; ############
           DW 1110011001110000b   ; ###..##..###
           DW 1111111111110000b   ; ############
           DW 0001100110000000b   ; ...##..##
           DW 0011011011000000b   ; ..##.##.##
           DW 1100000000110000b   ; ##........##
; polvo, quadro 2
inv3_b     DW 0000111100000000b   ; ....####
           DW 0111111111100000b   ; .##########
           DW 1111111111110000b   ; ############
           DW 1110011001110000b   ; ###..##..###
           DW 1111111111110000b   ; ############
           DW 0011100111000000b   ; ..###..###
           DW 0110011001100000b   ; .##..##..##
           DW 0011000011000000b   ; ..##....##
; o canhão do jogador (13x8)
canhao     DW 0000001000000000b   ; ......#
           DW 0000011100000000b   ; .....###
           DW 0000011100000000b   ; .....###
           DW 0111111111110000b   ; .###########
           DW 1111111111111000b   ; #############
           DW 1111111111111000b   ; #############
           DW 1111111111111000b   ; #############
           DW 1111111111111000b   ; #############
; canhão explodindo, quadro 1
canhao_x1  DW 0000010000000000b   ; .....#
           DW 0010000010000000b   ; ..#.....#
           DW 0000010010100000b   ; .....#..#.#
           DW 0010111100000000b   ; ..#.####
           DW 0101111110010000b   ; .#.######..#
           DW 0001111111000000b   ; ...#######
           DW 0011111111101000b   ; ..#########.#
           DW 1111111111111000b   ; #############
; canhão explodindo, quadro 2
canhao_x2  DW 1000001001000000b   ; #.....#..#
           DW 0000010000010000b   ; .....#.....#
           DW 0010001010000000b   ; ..#...#.#
           DW 1000100100010000b   ; #...#..#...#
           DW 0001010110100000b   ; ...#.#.##.#
           DW 0011111111110000b   ; ..##########
           DW 0111101111110000b   ; .####.######
           DW 1111111111111000b   ; #############
; invasor explodindo
explosao   DW 0000100010000000b   ; ....#...#
           DW 0100010100100000b   ; .#...#.#..#
           DW 0010000001000000b   ; ..#......#
           DW 0001000010000000b   ; ...#....#
           DW 1100000000110000b   ; ##........##
           DW 0001000010000000b   ; ...#....#
           DW 0010010001000000b   ; ..#..#...#
           DW 0100100100100000b   ; .#..#..#..#
; disco voador (16x7)
disco      DW 0000011111100000b   ; .....######
           DW 0001111111111000b   ; ...##########
           DW 0011111111111100b   ; ..############
           DW 0110110110110110b   ; .##.##.##.##.##
           DW 1111111111111111b   ; ################
           DW 0011100110011100b   ; ..###..##..###
           DW 0001000000001000b   ; ...#........#
; metade esquerda do escudo (11x16)
escudo_e   DW 0000111111100000b   ; ....#######
           DW 0001111111100000b   ; ...########
           DW 0011111111100000b   ; ..#########
           DW 0111111111100000b   ; .##########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111100000000b   ; ########
           DW 1111111000000000b   ; #######
           DW 1111110000000000b   ; ######
           DW 1111110000000000b   ; ######
; metade direita do escudo
escudo_d   DW 1111111000000000b   ; #######
           DW 1111111100000000b   ; ########
           DW 1111111110000000b   ; #########
           DW 1111111111000000b   ; ##########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 1111111111100000b   ; ###########
           DW 0001111111100000b   ; ...########
           DW 0000111111100000b   ; ....#######
           DW 0000011111100000b   ; .....######
           DW 0000011111100000b   ; .....######

END inicio
```

## Exercícios

Cada exercício isola uma rotina do jogo. Quando terminar, compare com o fonte acima: você terá reescrito o coração do INVASOR.

```exercicio
id: a35-1
titulo: Quem levou o tiro?
nivel: 1
--- enunciado
O tiro achou a cor de um invasor no pixel (**BX**, **DX**). O canto da formação está nas variáveis **fx** e **fy**. As colunas ficam a **16** pixels uma da outra e as linhas a **12**, com **11** invasores por linha. Calcule o índice do invasor atingido em `vivo[]` (linha × 11 + coluna) e grave-o na variável **alvo**. Use um deslocamento para dividir por 16.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
fx      DW 40
fy      DW 32
alvo    DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; BX = x, DX = y do pixel atingido
        ; calcule alvo = linha * 11 + coluna

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "o primeiro invasor, no canto", "setup": { "BX": 40, "DX": 32 }, "espera": { "mem": { "alvo": 0 } } },
 { "nome": "o último (linha 4, coluna 10)", "setup": { "BX": 205, "DX": 83 }, "espera": { "mem": { "alvo": 54 } } },
 { "nome": "formação deslocada: linha 2, coluna 3", "setup": { "fx": 100, "fy": 50, "BX": 159, "DX": 81 }, "espera": { "mem": { "alvo": 25 } } },
 { "nome": "linha 1, coluna 5", "setup": { "fx": 7, "fy": 60, "BX": 87, "DX": 72 }, "espera": { "mem": { "alvo": 16 } } },
 { "nome": "o exemplo da aula", "setup": { "BX": 93, "DX": 49 }, "espera": { "mem": { "alvo": 14 } } }]
--- dicas
Coluna: MOV AX,BX / SUB AX,fx / MOV CL,4 / SHR AX,CL.
Linha: MOV AX,DX / SUB AX,fy e depois DIV por um registrador de 8 bits com 12: o quociente fica em AL.
Guarde a coluna num registrador que a conta da linha não estraga (BL, por exemplo) antes de calcular a linha.
Linha × 11: MOV CL,11 / MUL CL deixa o resultado em AX. Some a coluna e grave AL em alvo.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
fx      DW 40
fy      DW 32
alvo    DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, BX
        SUB  AX, fx
        MOV  CL, 4
        SHR  AX, CL             ; coluna
        MOV  BL, AL
        MOV  AX, DX
        SUB  AX, fy
        MOV  CL, 12
        DIV  CL                 ; AL = linha
        MOV  CL, 11
        MUL  CL                 ; AX = linha * 11
        ADD  AL, BL
        MOV  alvo, AL
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a35-2
titulo: Um sprite de 1 bit
nivel: 2
exigir: SHL|RCL
--- enunciado
Escreva a rotina **SPRITE**: SI aponta para um desenho com **uma word por linha** (o bit 15 é o pixel da esquerda), BX = x, DX = y, AL = cor e CL = número de linhas. Para cada bit 1, pinte o pixel correspondente com a cor AL; os bits 0 **não** podem ser tocados. ES já aponta para A000h e a rotina **ENDERECO** (DI = DX × 320 + BX) está pronta. O programa principal lê a posição, a cor e a altura das variáveis e chama a sua rotina. Os testes trocam o desenho.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
desenho DW 0000011000000000b   ; .....##
        DW 0000111100000000b   ; ....####
        DW 0001111110000000b   ; ...######
        DW 0011011011000000b   ; ..##.##.##
        DW 0011111111000000b   ; ..########
        DW 0000100100000000b   ; ....#..#
        DW 0001011010000000b   ; ...#.##.#
        DW 0010100101000000b   ; ..#.#..#.#
px      DW 10
py      DW 20
cor     DB 32
alt     DB 8
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  SI, OFFSET desenho
        MOV  BX, px
        MOV  DX, py
        MOV  AL, cor
        MOV  CL, alt
        CALL SPRITE
        MOV  AX, 4C00h
        INT  21h

; ENDERECO: DI = DX * 320 + BX
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        ADD  DI, DX
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP

; SPRITE: SI = desenho, BX = x, DX = y, AL = cor, CL = linhas
SPRITE  PROC
        ; desenhe aqui
        RET
SPRITE  ENDP
END inicio
--- testes
[{ "nome": "a lula em (10, 20)", "espera": { "contaPixels": { "32": 36 }, "pixel": { "15,20": 32, "16,20": 32, "14,20": 0, "12,27": 32, "13,27": 0, "19,27": 32, "10,23": 0, "12,23": 32 } } },
 { "nome": "um bloco 16 × 2 no canto de baixo", "setup": { "desenho": [65535, 65535], "px": 304, "py": 198, "cor": 5, "alt": 2 }, "espera": { "contaPixels": { "5": 32 }, "pixel": { "304,198": 5, "319,199": 5, "303,198": 0 } } },
 { "nome": "só o bit 0: o pixel x + 15", "setup": { "desenho": [1], "px": 0, "py": 0, "cor": 9, "alt": 1 }, "espera": { "contaPixels": { "9": 1 }, "pixel": { "15,0": 9, "0,0": 0 } } },
 { "nome": "uma diagonal de 3 linhas", "setup": { "desenho": [32768, 16384, 8192], "px": 100, "py": 100, "cor": 14, "alt": 3 }, "espera": { "contaPixels": { "14": 3 }, "pixel": { "100,100": 14, "101,101": 14, "102,102": 14, "100,101": 0 } } }]
--- dicas
Guarde os registradores que vai estragar (BX, CX, DX, SI, DI) e chame ENDERECO para ter DI = canto do desenho.
Para cada linha: carregue a word em DX (MOV DX,[SI] / ADD SI,2) e guarde o começo da linha (por exemplo em BP).
Para cada pixel: SHL DX,1 joga o bit da esquerda no CF. JNC pula a escrita; senão MOV ES:[DI],AL. Depois INC DI.
Repita 16 vezes (ou até DX virar 0). Depois volte ao começo da linha, some 320 e passe para a próxima. CL conta as linhas (XOR CH,CH e LOOP).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
desenho DW 0000011000000000b   ; .....##
        DW 0000111100000000b   ; ....####
        DW 0001111110000000b   ; ...######
        DW 0011011011000000b   ; ..##.##.##
        DW 0011111111000000b   ; ..########
        DW 0000100100000000b   ; ....#..#
        DW 0001011010000000b   ; ...#.##.#
        DW 0010100101000000b   ; ..#.#..#.#
px      DW 10
py      DW 20
cor     DB 32
alt     DB 8
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  SI, OFFSET desenho
        MOV  BX, px
        MOV  DX, py
        MOV  AL, cor
        MOV  CL, alt
        CALL SPRITE
        MOV  AX, 4C00h
        INT  21h

; ENDERECO: DI = DX * 320 + BX
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        ADD  DI, DX
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP

; SPRITE: SI = desenho, BX = x, DX = y, AL = cor, CL = linhas
SPRITE  PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        PUSH BP
        CALL ENDERECO
        XOR  CH, CH
@@linha:
        MOV  BP, DI
        MOV  DX, [SI]
        ADD  SI, 2
@@pixel:
        SHL  DX, 1
        JNC  @@vazio
        MOV  ES:[DI], AL
@@vazio:
        INC  DI
        OR   DX, DX
        JNZ  @@pixel
        MOV  DI, BP
        ADD  DI, 320
        LOOP @@linha
        POP  BP
        POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
SPRITE  ENDP
END inicio
```

```exercicio
id: a35-3
titulo: Morder o escudo
nivel: 2
--- enunciado
O programa desenha um "escudo" de 20 × 10 pixels da cor **35** em (100, 100), com um pixel da cor **40** (a ponta de um invasor) no meio dele, e chama **MORDE_ESCUDO** com o ponto de impacto em (**BX**, **DX**). Escreva a rotina: ela deve apagar (pintar com 0) os pixels **da cor 35** num retângulo de **3 × 4** pixels cujo canto superior esquerdo é (BX − 1, DX − 1). Pixels de outras cores ficam como estão. A rotina **ENDERECO** está pronta e ES aponta para A000h.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
mx      DW 110
my      DW 105
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        CLD
        MOV  BX, 100            ; o escudo: 20 x 10 da cor 35
        MOV  DX, 100
        CALL ENDERECO
        MOV  AL, 35
        MOV  SI, 10
@@ret:  MOV  CX, 20
        REP  STOSB
        ADD  DI, 300
        DEC  SI
        JNZ  @@ret
        MOV  BYTE PTR ES:[105*320+110], 40
        MOV  BX, mx
        MOV  DX, my
        CALL MORDE_ESCUDO
        MOV  AX, 4C00h
        INT  21h

; ENDERECO: DI = DX * 320 + BX
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        ADD  DI, DX
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP

; MORDE_ESCUDO: apaga a cor 35 em 3 x 4 pixels a partir de (BX-1, DX-1)
MORDE_ESCUDO PROC
        RET
MORDE_ESCUDO ENDP
END inicio
--- testes
[{ "nome": "no meio, onde há um invasor", "espera": { "contaPixels": { "35": 188, "40": 1 }, "pixel": { "109,104": 0, "111,107": 0, "110,105": 40, "112,105": 35, "110,108": 35, "109,103": 35, "108,104": 35 } } },
 { "nome": "no canto de cima", "setup": { "mx": 100, "my": 100 }, "espera": { "contaPixels": { "35": 193, "40": 1 }, "pixel": { "100,100": 0, "101,102": 0, "102,100": 35, "100,103": 35 } } },
 { "nome": "no canto de baixo", "setup": { "mx": 119, "my": 109 }, "espera": { "contaPixels": { "35": 195 }, "pixel": { "118,108": 0, "119,109": 0, "117,109": 35, "119,107": 35 } } },
 { "nome": "longe do escudo", "setup": { "mx": 200, "my": 50 }, "espera": { "contaPixels": { "35": 199, "40": 1 } } }]
--- dicas
DEC BX e DEC DX levam ao canto do pedaço; CALL ENDERECO dá DI.
Dois laços: 4 linhas de 3 pixels. Use DX para contar as linhas (ele já foi usado) e CX para os pixels.
Para cada pixel: CMP BYTE PTR ES:[DI],35 / JNE pula / MOV BYTE PTR ES:[DI],0. Depois INC DI.
No fim de cada linha, DI anda 3 pixels: some 320 − 3 para chegar ao começo da linha de baixo.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
mx      DW 110
my      DW 105
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        CLD
        MOV  BX, 100            ; o escudo: 20 x 10 da cor 35
        MOV  DX, 100
        CALL ENDERECO
        MOV  AL, 35
        MOV  SI, 10
@@ret:  MOV  CX, 20
        REP  STOSB
        ADD  DI, 300
        DEC  SI
        JNZ  @@ret
        MOV  BYTE PTR ES:[105*320+110], 40
        MOV  BX, mx
        MOV  DX, my
        CALL MORDE_ESCUDO
        MOV  AX, 4C00h
        INT  21h

; ENDERECO: DI = DX * 320 + BX
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        ADD  DI, DX
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP

; MORDE_ESCUDO: apaga a cor 35 em 3 x 4 pixels a partir de (BX-1, DX-1)
MORDE_ESCUDO PROC
        PUSH DI
        DEC  BX
        DEC  DX
        CALL ENDERECO
        MOV  DX, 4
@@linha:
        MOV  CX, 3
@@pixel:
        CMP  BYTE PTR ES:[DI], 35
        JNE  @@prox
        MOV  BYTE PTR ES:[DI], 0
@@prox: INC  DI
        LOOP @@pixel
        ADD  DI, 320-3
        DEC  DX
        JNZ  @@linha
        POP  DI
        RET
MORDE_ESCUDO ENDP
END inicio
```

```exercicio
id: a35-4
titulo: As bordas da formação
nivel: 3
--- enunciado
O vetor **vivo** tem 55 bytes (5 linhas de 11, índice = linha × 11 + coluna; 1 = vivo, 0 = morto). Escreva **BORDAS**, que grava em **col_min** a primeira coluna (da esquerda) que tem pelo menos um invasor vivo, em **col_max** a última, e em **lin_max** a linha mais de baixo que tem alguém vivo. Sempre há pelo menos um vivo.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
vivo    DB 55 DUP (1)
col_min DB 0
col_max DB 0
lin_max DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        CALL BORDAS
        MOV  AX, 4C00h
        INT  21h

BORDAS  PROC
        RET
BORDAS  ENDP
END inicio
--- testes
[{ "nome": "todos vivos", "espera": { "mem": { "col_min": 0, "col_max": 10, "lin_max": 4 } } },
 { "nome": "colunas 0, 1 e 10 e a linha de baixo mortas", "setup": { "vivo": [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, "espera": { "mem": { "col_min": 2, "col_max": 9, "lin_max": 3 } } },
 { "nome": "só um, na linha 2 coluna 5", "setup": { "vivo": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, "espera": { "mem": { "col_min": 5, "col_max": 5, "lin_max": 2 } } },
 { "nome": "dois cantos opostos", "setup": { "vivo": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }, "espera": { "mem": { "col_min": 0, "col_max": 10, "lin_max": 4 } } }]
--- dicas
Para olhar uma coluna c inteira: SI = c e some 11 a SI cinco vezes, testando vivo[SI] a cada vez.
col_min: tente c = 0, 1, 2... até achar uma coluna com alguém vivo. col_max: o mesmo de c = 10 para baixo.
lin_max: percorra vivo de trás para a frente (SI = 54, 53...) até achar um vivo; a linha é SI ÷ 11 (DIV com um divisor de 8 bits, o quociente fica em AL).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
vivo    DB 55 DUP (1)
col_min DB 0
col_max DB 0
lin_max DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        CALL BORDAS
        MOV  AX, 4C00h
        INT  21h

BORDAS  PROC
        XOR  BX, BX             ; da esquerda para a direita
@@c1:   MOV  SI, BX
        MOV  CX, 5
@@l1:   CMP  vivo[SI], 0
        JNE  @@achou1
        ADD  SI, 11
        LOOP @@l1
        INC  BX
        CMP  BX, 11
        JB   @@c1
@@achou1:
        MOV  col_min, BL
        MOV  BX, 10             ; da direita para a esquerda
@@c2:   MOV  SI, BX
        MOV  CX, 5
@@l2:   CMP  vivo[SI], 0
        JNE  @@achou2
        ADD  SI, 11
        LOOP @@l2
        DEC  BX
        JNS  @@c2
        XOR  BX, BX
@@achou2:
        MOV  col_max, BL
        MOV  SI, 54             ; o último vivo do vetor
@@l3:   CMP  vivo[SI], 0
        JNE  @@achou3
        DEC  SI
        JNS  @@l3
        XOR  SI, SI
@@achou3:
        MOV  AX, SI
        MOV  CL, 11
        DIV  CL
        MOV  lin_max, AL
        RET
BORDAS  ENDP
END inicio
```

## Desafios

Sem verificador: abra o `INVASOR.ASM` no laboratório e mude o jogo.

1. **Bombas que miram.** Em uma de cada três bombas, em vez de sortear a coluna, use a coluna que está acima do canhão: `(jog_x + 6 − fx) ÷ 16`, limitada a 0..10. Cuidado com o caso de o canhão estar fora da formação (resultado negativo ou maior que 10).
2. **Tiro contra bomba.** Faça o tiro e a bomba se anularem quando se encontram: em `MOVE_TIRO`, trate a cor `COR_BOMBA` procurando qual das 3 vagas tem `bomba_x` igual a `tiro_x` e uma `bomba_y` perto, e apague as duas.
3. **Vida extra.** Ganhe uma vida aos 1.500 pontos (uma vez só). Onde fica o teste para não dar a vida duas vezes? Toque uma nota aguda para avisar.
4. **Prêmio do disco à moda antiga.** Conte os tiros dados e faça o disco valer 300 no 23º tiro e a cada 15 depois disso, como no gabinete; nos outros, 50, 100 ou 150 por uma tabela percorrida em sequência.
5. **Escudo de verdade.** Hoje a mordida é sempre um retângulo 3 × 4. Use um pequeno sprite de 1 bit irregular para a mordida (com `AL = 0`, mas apagando só a cor do escudo) e veja os escudos ficarem com buracos mais naturais.

## No livro

O INVASOR usa a BIOS para pouca coisa, mas cada uma tem o seu capítulo:

- [Vídeo I: modos, cursor e teletipo](livro:cap03): a `INT 10h` função 00h (modo 13h), 02h (cursor) e 0Eh (teletipo, com a cor em BL nos modos gráficos).
- [Vídeo II: paleta e DAC](livro:cap04): as portas 3C8h/3C9h e as funções de paleta da `INT 10h` que o jogo dispensa escrevendo direto no DAC.
- [Teclado](livro:cap06): a `INT 09h`, a porta 60h e os scan codes de aperto e soltura que alimentam o vetor `teclas`.
- [Tempo](livro:cap07): a `INT 1Ah` função 00h que dá a semente do sorteio e mede a duração dos sons.
- [Vetores e IRQs](livro:cap02): por que a nossa INT 9 manda o EOI (`OUT 20h,AL`) ao PIC.
- [A BIOS para jogos](livro:cap20): retraço vertical (porta 3DAh), teclado direto, som pelo PIT e vídeo direto, reunidos do ponto de vista de quem escreve um jogo.
- [Diretrizes de compatibilidade](livro:cap19): por que restaurar o vetor da INT 9 e o modo de vídeo antes de sair.

:::resumo
- *Space Invaders* (Taito, 1978) acelerava por limitação do hardware; o nosso imita com `conta_passo = 2 + vivos ÷ 4`.
- Sprites de 1 bit por pixel: uma word por linha, bit 15 à esquerda. `SHL DX,1` / `JNC` desenha; os bits 0 são transparentes; desenhar com cor 0 apaga; `OR DX,DX` encerra a linha cedo.
- Uma faixa própria da paleta (32 a 41) dá a cada tipo de objeto uma cor única, e a cor do pixel vira etiqueta.
- Colisão pela cor: apague o objeto, mova, olhe os pixels do caminho (`OLHA_COLUNA`) e decida pela cor achada.
- A formação é `fx`, `fy` e `vivo[55]`. Do pixel atingido sai o índice: coluna = (x − fx) ÷ 16 (um `SHR`), linha = (y − fy) ÷ 12, índice = linha × 11 + coluna.
- As bordas da formação são as das colunas com alguém vivo (`BORDAS`), e a linha viva mais baixa decide a invasão.
- Objetos que aparecem e somem ficam em vagas fixas com uma marca de ativo (3 bombas, disco, tiro, explosão com cronômetro).
- Os escudos só existem na tela: `MORDE_ESCUDO` apaga apenas pixels da cor 35.
- Detectar (ligar `morreu`) e resolver (`PERDE_VIDA` no laço principal) em momentos diferentes evita estragar laços em andamento.
- Texto pela BIOS (teletipo, cor em BL), apagando o fundo antes; sprites direto em A000h.
:::
