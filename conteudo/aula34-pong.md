---
id: aula34
numero: 34
modulo: 13
titulo: PONG, tênis de mesa no modo 13h
subtitulo: Teclado pela INT 9, ponto fixo, física da bola, um adversário de silício e 70 quadros por segundo
duracao: 120 min
objetivos: conhecer a história do Pong e por que ele mudou a indústria; organizar um jogo de ação no modo 13h sincronizado com o retraço vertical; ler dois jogadores ao mesmo tempo com uma INT 9 própria; guardar posição e velocidade da bola em ponto fixo de 1/16 de pixel; detectar a colisão da bola com as raquetes e calcular o ângulo do rebote; escrever um adversário controlado pelo computador; desenhar retângulos com recorte e dígitos grandes guardados em bits; ler a listagem completa do PONG.ASM
---

## O jogo que abriu os fliperamas

Em 1972, Nolan Bushnell acabava de fundar a Atari e deu ao engenheiro Allan Alcorn um "exercício de treinamento": fazer um jogo de tênis de mesa para a televisão. Bushnell tinha visto o *Table Tennis* do **Magnavox Odyssey**, o primeiro console doméstico, criado por Ralph Baer. Alcorn caprichou: dividiu a raquete em oito partes, para a bola sair com ângulos diferentes conforme o ponto de impacto, e fez a bola acelerar durante a troca de bolas. O protótipo foi instalado num bar da Califórnia, o Andy Capp's Tavern. Dias depois, o dono ligou dizendo que a máquina tinha quebrado. Não tinha: a caixa de moedas estava tão cheia que travara o mecanismo.

```diagrama titulo="De Tennis for Two ao PONG.ASM"
  1958  Tennis for Two (W. Higinbotham)    um osciloscópio num laboratório americano
    │
  1972  Odyssey: Table Tennis (Magnavox)   o primeiro console de casa, sem processador
    │
  1972  PONG (Atari, fliperama)            a máquina que lotou de moedas
    │
  1975  Home Pong (Atari / Sears)          um chip dedicado ligado à TV da sala
    │
  1976  AY-3-8500 (General Instrument)     "Pong num chip": centenas de clones pelo mundo
    │
  1990  PONG.ASM                           o mesmo jogo, agora em software, num PC
```

O Pong original **não tinha processador**: era um circuito de dezenas de chips TTL, contadores e portas lógicas que geravam o sinal de vídeo diretamente. A posição da bola era o estado de dois contadores; a "física" era fiação. Fazer o mesmo jogo em software, como vamos fazer, é refazer em instruções o que aqueles circuitos faziam em paralelo, 60 vezes por segundo.

:::anos90 O "Olá, mundo" dos jogos
Nos anos 90, quase todo programador que queria aprender a fazer jogos começava por um Pong. É o jogo mais simples que tem tudo: animação, física, colisão, placar, som, dois jogadores e, se quiser, um adversário artificial. As revistas de programação publicavam versões em BASIC, Pascal e Assembly; os cursos de computação usavam como trabalho de fim de semestre. No Brasil, os consoles "Telejogo" da Philco/Ford (1977), clones do Pong feitos com o chip AY-3-8500, foram o primeiro videogame de muita gente.
:::

## As regras

- Dois jogadores, cada um com uma raquete vertical: o **jogador 1** à esquerda (**W** sobe, **S** desce), o **jogador 2** à direita (**setas**), ou o **computador**.
- A bola quica nas linhas de cima e de baixo. Se passar por uma raquete e sair da tela, é **ponto** do outro.
- A bola sai mais inclinada quanto mais longe do centro da raquete ela bater, e acelera um pouco a cada rebatida.
- Quem leva o gol recebe o saque. Antes de cada saque, a bola espera parada por 0,7 s.
- Ganha quem fizer **7 pontos**. No menu, **1** joga contra o computador, **2** joga a dois, **ESC** sai; durante o jogo, ESC volta ao menu.

## A tela

```diagrama titulo="A tela do PONG (320 x 200, modo 13h)"
   x: 0   12            132       159       176                 304      319
 y  0 ┌──────────────────┬──┬──────┊──────┬──┬──────────────────────────────┐
    1 │                  │ 3│      ┊      │ 1│  placar: dígitos 12 x 10     │
   14 ╞══════════════════╧══╧══════╪══════╧══╧══════════════════════════════╡ linha (cor 8)
   16 │                            ╎                                         │ ◄ CAMPO_TOPO
      │   █                        ╎                               █         │
      │   █ raquete 1              ╎       ■ bola 4 x 4  raquete 2 █         │
      │   █ 4 x 32, cor 11         ╎                   4 x 32, cor 14        │
      │   █                        ╎ rede: traços 2 x 6            █         │
      │                            ╎                                         │
  196 ╞════════════════════════════╧═════════════════════════════════════════╡ ◄ CAMPO_BASE
  199 └──────────────────────────────────────────────────────────────────────┘
```

| Objeto | Tamanho | Posição | Cor |
|--------|---------|---------|-----|
| raquete 1 | 4 x 32 | x = 12 (`RAQ1_X`) | 11, ciano claro |
| raquete 2 | 4 x 32 | x = 304 (`RAQ2_X` = 320 − 12 − 4) | 14, amarelo |
| bola | 4 x 4 | onde estiver | 15, branco |
| linhas e rede | 320 x 2, e traços 2 x 6 | y = 14, y = 196, x = 159 | 8, cinza escuro |
| placar | dígitos de 12 x 10 | x = 132 e x = 176, y = 1 | a cor da raquete de cada um |

As cores são as 16 primeiras da paleta padrão do modo 13h, que repetem as cores do modo texto ([Aula 23](aula:aula23)). O PONG não mexe na paleta.

## A arquitetura

### Constantes que descrevem o mundo

```asm fragmento titulo="PONG.ASM: constantes"
LARG_TELA   EQU 320
ALT_TELA    EQU 200
CAMPO_TOPO  EQU 16              ; abaixo do placar
CAMPO_BASE  EQU 196             ; acima da linha de baixo
RAQ_ALT     EQU 32
RAQ_LARG    EQU 4
RAQ1_X      EQU 12              ; coluna da raquete da esquerda
RAQ2_X      EQU LARG_TELA-12-RAQ_LARG
RAQ_VEL     EQU 3               ; pixels por quadro
BOLA_TAM    EQU 4
PONTOS_VITORIA EQU 7
FRAC        EQU 16              ; 4 bits de fração: 1 pixel = 16 unidades
```

Repare em `RAQ2_X EQU LARG_TELA-12-RAQ_LARG`: o montador faz a conta. E em todo o código aparecem expressões como `(CAMPO_BASE-BOLA_TAM)*FRAC` ou `(CAMPO_TOPO+CAMPO_BASE-RAQ_ALT)/2`. Elas são calculadas **na montagem** e viram um número só na instrução: custam zero ciclos. Mudar o tamanho da raquete é mudar uma linha.

### As variáveis

```asm fragmento titulo="PONG.ASM: variáveis"
jogadores   DB 1                ; 1 = contra o computador, 2 = dois jogadores
vencedor    DB 0                ; 0 = ainda jogando
saque       DB 1                ; 1 = a bola sai para a direita
pontos1     DB 0
pontos2     DB 0
pausa_saque DB 0                ; quadros que a bola ainda espera
raq1_y      DW 0                ; onde as raquetes estão (pixels)
raq2_y      DW 0
raq1_desenhada DW 0             ; onde elas foram desenhadas
raq2_desenhada DW 0
bola_x      DW 0                ; posição e velocidade em 1/16 de pixel
bola_y      DW 0
bola_vx     DW 0
bola_vy     DW 0
bola_xd     DW 0                ; onde a bola foi desenhada (pixels)
bola_yd     DW 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0
int9_antiga DD 0
teclas      DB 128 DUP (0)      ; 1 = tecla apertada agora
```

Três grupos merecem atenção: a posição **lógica** de cada objeto (`raq1_y`, `bola_x`) separada da posição **desenhada** (`raq1_desenhada`, `bola_xd`); a bola inteira em unidades de **1/16 de pixel**; e a tabela `teclas`, preenchida por uma `INT 9` própria.

### O programa e o laço

```asm fragmento titulo="PONG.ASM: programa principal"
inicio:
        CLD
        MOV  AX, 0013h          ; modo 13h
        INT  10h
        MOV  AX, 0A000h         ; ES = memória de vídeo
        MOV  ES, AX
        CALL INSTALA_TECLADO    ; agora o teclado é nosso (INT 9)
        CALL SEMEIA

@@menu: CALL TELA_MENU          ; AL = 1 ou 2 jogadores, 0 = sair
        OR   AL, AL
        JZ   @@sair
        MOV  jogadores, AL
        CALL NOVA_PARTIDA
@@quadro:
        CALL ESPERA_RETRACO     ; 70 quadros por segundo, sem cintilação
        CALL APAGA_OBJETOS
        CALL MOVE_RAQUETES
        CALL MOVE_BOLA
        CALL DESENHA_OBJETOS
        CALL SOM_ATUALIZA
        CMP  teclas[SC_ESC], 1
        JE   @@desistiu
        CMP  vencedor, 0
        JE   @@quadro
        CALL MOSTRA_VENCEDOR
        JMP  @@menu
@@desistiu:
        CALL ESPERA_SOLTAR      ; senão o ESC ainda apertado sairia do menu também
        JMP  @@menu

@@sair: CALL SOM_DESLIGA
        CALL RESTAURA_TECLADO
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h
```

```diagrama titulo="Um quadro do PONG (1/70 de segundo)"
  retraço ─┐                                                      ┌─ próximo retraço
           ▼                                                      ▼
  ─────────┬──────────┬───────────────┬───────────┬──────────────┬─────────────
  ESPERA_  │ APAGA_   │ MOVE_RAQUETES │ MOVE_BOLA │ DESENHA_     │ (sobra: o
  RETRACO  │ OBJETOS  │ (teclas[])    │ (física)  │ OBJETOS      │  laço volta
           │ fundo    │               │ gols, som │ cores        │  e espera)
  ─────────┴──────────┴───────────────┴───────────┴──────────────┴─────────────
           └─ o feixe está voltando: tudo o que for desenhado aqui ─┘
              aparece inteiro no próximo quadro
```

```diagrama titulo="Quem chama quem"
  inicio ── INSTALA_TECLADO, SEMEIA
    └─► @@menu: TELA_MENU ── ESC ──► @@sair: SOM_DESLIGA, RESTAURA_TECLADO, modo 03h
          │                                       
          ▼ 1 ou 2
        NOVA_PARTIDA ── LIMPA_TELA, DESENHA_CAMPO, DESENHA_PLACAR, SACA
          │
        @@quadro: ESPERA_RETRACO
                  APAGA_OBJETOS ── RETANGULO, DESENHA_REDE
                  MOVE_RAQUETES ── LIMITA_RAQUETE, CEREBRO
                  MOVE_BOLA ────── ACERTOU, BIP_PAREDE, SOM_LIGA,
                                   DESENHA_PLACAR (DIGITO_GRANDE), SACA
                  DESENHA_OBJETOS ── RETANGULO
                  SOM_ATUALIZA
          │ vencedor ≠ 0
        MOSTRA_VENCEDOR ── ESCREVE_TXT, ESPERA_SOLTAR ──► @@menu
```

## Técnica 1: dois jogadores, um teclado

O PONG a dois exige o que a `INT 16h` não dá: saber que W **e** a seta para cima estão apertadas **ao mesmo tempo**, e continuar sabendo enquanto elas estiverem apertadas. A solução é a `INT 9` com tabela de teclas que você estudou na [Aula 32](aula:aula32):

```asm fragmento titulo="PONG.ASM: NOVA_INT9"
NOVA_INT9 PROC FAR
        PUSH AX
        PUSH BX
        IN   AL, 60h            ; código da tecla
        MOV  BL, AL
        AND  BX, 007Fh          ; BX = número da tecla
        SHL  AL, 1              ; CF = bit 7 (1 = soltou)
        CMC                     ; CF = 1 se apertou
        MOV  AL, 0
        ADC  AL, 0              ; AL = 1 (apertada) ou 0 (solta)
        MOV  CS:teclas[BX], AL  ; CS: aqui DS pode ser qualquer coisa
        MOV  AL, 20h            ; fim de interrupção para o PIC
        OUT  20h, AL
        POP  BX
        POP  AX
        IRET
NOVA_INT9 ENDP
```

Repare em `MOV AL, 0` no meio do truque: não é `XOR AL, AL`, que seria mais curto, porque o `XOR` **zera o CF** e destruiria o resultado do `CMC`. O `MOV` não mexe nas flags.

Com a tabela pronta, mover as raquetes é perguntar o estado de quatro teclas:

```asm fragmento titulo="PONG.ASM: MOVE_RAQUETES"
MOVE_RAQUETES PROC
        MOV  AX, raq1_y
        CMP  teclas[SC_W], 1
        JNE  @@j1b
        SUB  AX, RAQ_VEL
@@j1b:  CMP  teclas[SC_S], 1
        JNE  @@j1f
        ADD  AX, RAQ_VEL
@@j1f:  CALL LIMITA_RAQUETE
        MOV  raq1_y, AX

        MOV  AX, raq2_y
        CMP  jogadores, 2
        JE   @@humano
        CALL CEREBRO            ; o computador decide
        JMP  SHORT @@j2f
@@humano:
        CMP  teclas[SC_CIMA], 1
        JNE  @@j2b
        SUB  AX, RAQ_VEL
@@j2b:  CMP  teclas[SC_BAIXO], 1
        JNE  @@j2f
        ADD  AX, RAQ_VEL
@@j2f:  CALL LIMITA_RAQUETE
        MOV  raq2_y, AX
        RET
MOVE_RAQUETES ENDP
```

Com W e S apertadas juntas, a raquete sobe 3 e desce 3: fica parada, como deveria. E `LIMITA_RAQUETE` usa saltos **com sinal** (`JGE`, `JLE`), porque `raq1_y − 3` pode dar negativo se a raquete estiver no topo:

```asm fragmento titulo="PONG.ASM: LIMITA_RAQUETE"
LIMITA_RAQUETE PROC
        CMP  AX, CAMPO_TOPO
        JGE  @@baixo
        MOV  AX, CAMPO_TOPO
@@baixo:
        CMP  AX, CAMPO_BASE-RAQ_ALT
        JLE  @@ok
        MOV  AX, CAMPO_BASE-RAQ_ALT
@@ok:   RET
LIMITA_RAQUETE ENDP
```

### Esperar soltar

A tabela diz se uma tecla **está** apertada, não se **foi** apertada agora. Isso cria um problema sutil: o jogador aperta ESC para desistir, o jogo volta ao menu... e o menu, que também sai com ESC, vê a tecla ainda apertada e fecha o programa. A solução é esperar todas as teclas serem soltas antes de mudar de tela:

```asm fragmento titulo="PONG.ASM: ESPERA_SOLTAR"
ESPERA_SOLTAR PROC
@@de_novo:
        MOV  SI, OFFSET teclas
        MOV  CX, 128
@@olha: LODSB
        OR   AL, AL
        JNZ  @@de_novo          ; alguma apertada: recomeça a varredura
        LOOP @@olha
        RET
ESPERA_SOLTAR ENDP
```

Este laço só termina porque a `INT 9` continua chegando durante ele e zerando as entradas da tabela. É um laço que espera o hardware mudar a memória por baixo dele, como o `ESPERA_PASSO` da COBRA espera a `INT 8` mudar o relógio.

:::atencao Teclas "presas" em 0E0h
Nos teclados de 101 teclas, as setas do bloco separado mandam um prefixo **E0h** antes do código (E0h 48h para a seta para cima). A nossa `INT 9` trata o E0h como uma tecla qualquer: E0h tem o bit 7 ligado, então ela grava 0 em `teclas[60h]`, que nenhuma tecla real usa. O código seguinte, 48h, marca a seta normalmente. É um tratamento pobre, mas suficiente: a única consequência é que as setas do bloco separado e as do teclado numérico viram a mesma tecla. O [capítulo 6 do livro](livro:cap06) explica os prefixos.
:::

## Técnica 2: ponto fixo, a bola em 1/16 de pixel

A bola precisa de velocidades que não são números inteiros de pixels. Uma bola que sobe 1 pixel a cada 2 pixels para o lado tem inclinação 1/2; uma que sobe 1 a cada 3, inclinação 1/3. Com inteiros, só daria para ter 0, 1, 2... pixels por quadro, e os ângulos seriam poucos e feios.

O 8087 da [Aula 31](aula:aula31) resolveria, mas quase nenhum PC de 1990 tinha um. A solução dos jogos era o **ponto fixo** que você viu na [Aula 30](aula:aula30): guardar todas as posições multiplicadas por uma constante. No PONG, a constante é `FRAC = 16`: os 4 bits de baixo de `bola_x` são a fração do pixel.

```diagrama titulo="bola_x em ponto fixo 12.4"
   bit: 15                              4   3   2   1   0
       ┌───────────────────────────────┬───────────────┐
       │  parte inteira (pixels)       │ fração (1/16) │
       └───────────────────────────────┴───────────────┘

   bola_x = 2528 = 1001 1110 0000b  →  158 pixels + 0/16
   bola_vy = 6  = 0000 0000 0110b   →  6/16 de pixel por quadro (0,375)
   bola_vx = 32 = 0000 0010 0000b   →  2 pixels por quadro

   pixel  = bola_x SAR 4       (posição em pixels para desenhar)
   bola_x = pixel  SHL 4       (de pixels para 1/16)
```

Somar posição e velocidade continua sendo um `ADD` comum, e só na hora de desenhar a fração é jogada fora com um deslocamento de 4 bits:

```asm fragmento titulo="PONG.ASM: MOVE_BOLA (horizontal)"
        MOV  AX, bola_x         ; horizontal
        ADD  AX, bola_vx
        MOV  bola_x, AX
        MOV  CL, 4
        SAR  AX, CL             ; AX = x em pixels (SAR: x pode ser negativo)
```

:::cpu SAR e SHR
`SHR` (deslocamento lógico) põe zeros à esquerda; `SAR` (aritmético) copia o bit de sinal. Para −32 (FFE0h): `SHR` por 4 dá 0FFEh = 4.094, `SAR` dá FFFEh = −2. A bola pode sair da tela pela esquerda e ficar com x **negativo** antes de o gol ser marcado; por isso a conversão de x usa `SAR`. Já `bola_y` nunca fica negativa (a bola quica antes), e o código usa `SHR`, que dá o mesmo resultado para positivos.
:::

Com 16 unidades por pixel e 70 quadros por segundo, a bola começa com `bola_vx = 2*FRAC` (2 pixels por quadro, 140 pixels por segundo: atravessa a tela em pouco mais de 2 segundos) e uma inclinação sorteada entre −16 e +16 unidades (até 1 pixel vertical por quadro):

```asm fragmento titulo="PONG.ASM: SACA"
SACA    PROC
        MOV  bola_x, (LARG_TELA/2-BOLA_TAM/2)*FRAC
        MOV  AX, CAMPO_BASE-CAMPO_TOPO-40
        CALL ALEATORIO
        ADD  AX, CAMPO_TOPO+20
        MOV  CL, 4
        SHL  AX, CL             ; pixels -> 1/16 de pixel
        MOV  bola_y, AX
        MOV  AX, 2*FRAC         ; 2 pixels por quadro na horizontal
        CMP  saque, 1
        JE   @@dir
        NEG  AX
@@dir:  MOV  bola_vx, AX
        MOV  AX, 33             ; vertical entre -16 e +16 (até 1 pixel por quadro)
        CALL ALEATORIO
        SUB  AX, 16
        MOV  bola_vy, AX
        MOV  pausa_saque, 50    ; a bola espera 50 quadros (~0,7 s)
        RET
SACA    ENDP
```

`ALEATORIO` é o LCG da [Aula 32](aula:aula32): sorteia de 0 a 32, e `SUB AX,16` desloca para −16 a +16. A altura do saque também é sorteada, longe 20 pixels das bordas.

## Técnica 3: a física da bola

### Quicar em cima e em baixo

```asm fragmento titulo="PONG.ASM: MOVE_BOLA (vertical)"
@@anda: MOV  AX, bola_y         ; vertical: quica no topo e na base
        ADD  AX, bola_vy
        CMP  AX, CAMPO_TOPO*FRAC
        JGE  @@nao_topo
        MOV  AX, CAMPO_TOPO*FRAC
        NEG  bola_vy
        CALL BIP_PAREDE
@@nao_topo:
        CMP  AX, (CAMPO_BASE-BOLA_TAM)*FRAC
        JLE  @@nao_base
        MOV  AX, (CAMPO_BASE-BOLA_TAM)*FRAC
        NEG  bola_vy
        CALL BIP_PAREDE
@@nao_base:
        MOV  bola_y, AX
```

Quicar é só **trocar o sinal** da velocidade vertical com `NEG`. E a bola é "empurrada" de volta para a borda (`MOV AX, CAMPO_TOPO*FRAC`), senão, com uma velocidade grande, ela poderia ficar um quadro do lado de fora e quicar de novo no quadro seguinte, presa na parede.

### A raquete pegou?

Indo para a direita, a bola pode estar em três situações em relação à raquete 2:

```diagrama titulo="A bola chegando à raquete 2"
                                    RAQ2_X−BOLA_TAM   RAQ2_X           320
                                          │             │               │
   ... ■ ──►        ainda longe           │  ■ zona de  │  ■ passou:    │ ■ saiu:
                    (JL @@sai)            │  contato    │  não volta    │ GOL
                                          │  ACERTOU?   │  mais (JG)    │ (pontos1+1)
```

```asm fragmento titulo="PONG.ASM: MOVE_BOLA (indo para a direita)"
        CMP  AX, RAQ2_X-BOLA_TAM
        JL   @@sai
        CMP  AX, RAQ2_X
        JG   @@gol_direita
        MOV  BX, raq2_y
        CALL ACERTOU            ; CF = 1 se a raquete pegou a bola
        JNC  @@sai
        MOV  bola_x, (RAQ2_X-BOLA_TAM)*FRAC
        JMP  SHORT @@rebate
@@gol_direita:
        CMP  AX, LARG_TELA
        JL   @@sai
        INC  pontos1            ; a bola saiu pela direita: ponto do jogador 1
        MOV  saque, 0           ; quem tomou o gol recebe o saque
        JMP  SHORT @@gol
@@sai:  RET                     ; (um RET no meio: o @@fim lá embaixo
                                ;  fica longe demais para um JL)
```

O teste vertical fica em `ACERTOU`, que devolve a resposta no **CF**, uma convenção que a própria BIOS usa (CF = 1 é "erro" na INT 13h, por exemplo) e que é barata: `STC`/`CLC` para dar a resposta, `JC`/`JNC` para ler.

```asm fragmento titulo="PONG.ASM: ACERTOU"
; ACERTOU: BX = y da raquete. Se a bola está na altura dela, CF = 1 e
; DX = (centro da bola) - (centro da raquete), em pixels.
ACERTOU PROC
        MOV  DX, bola_y
        MOV  CL, 4
        SHR  DX, CL
        ADD  DX, BOLA_TAM/2     ; centro da bola
        MOV  AX, BX
        SUB  AX, BOLA_TAM/2
        CMP  DX, AX             ; acima da raquete?
        JL   @@errou
        ADD  AX, RAQ_ALT+BOLA_TAM
        CMP  DX, AX             ; abaixo?
        JG   @@errou
        SUB  DX, BX
        SUB  DX, RAQ_ALT/2
        STC
        RET
@@errou:
        CLC
        RET
ACERTOU ENDP
```

A raquete vai de `y` a `y + 32`; a bola, de 4 pixels, ainda "pega" se o centro dela estiver até 2 pixels além de cada ponta. Por isso a faixa testada vai de `y − 2` a `y + 34`, e a distância devolvida em DX vai de −18 a +18.

### O ângulo da rebatida

A ideia de Allan Alcorn em 1972 continua sendo o que faz o Pong ser um jogo, e não só uma bola quicando: **onde** a bola bate na raquete decide **para onde** ela vai.

```diagrama titulo="O ponto de impacto decide o ângulo"
                    DX = −18 ┐  ↖  sai bem inclinada para cima (vy = −36/16)
                             │
                    DX = −8  │  ↖  um pouco para cima
        raquete              │
                    DX =  0  │  ←  reto (vy = 0)
                             │
                    DX = +8  │  ↙  um pouco para baixo
                    DX = +18 ┘  ↙  bem inclinada para baixo (vy = +36/16)
```

```asm fragmento titulo="PONG.ASM: MOVE_BOLA (@@rebate)"
@@rebate:
        ; inverte a direção horizontal e acelera um pouco (até 5 pixels/quadro)
        MOV  AX, bola_vx
        NEG  AX
        CMP  AX, 0
        JL   @@neg
        CMP  AX, 5*FRAC
        JGE  @@vel_ok
        ADD  AX, 2
        JMP  SHORT @@vel_ok
@@neg:  CMP  AX, -5*FRAC
        JLE  @@vel_ok
        SUB  AX, 2
@@vel_ok:
        MOV  bola_vx, AX
        ; o ângulo depende de onde a bola bateu: DX = distância ao centro (-18..18)
        MOV  AX, DX
        SHL  AX, 1              ; vy = distância * 2 (em 1/16 de pixel)
        MOV  bola_vy, AX
        MOV  BX, 1600           ; tom agudo
        MOV  CL, 1
        CALL SOM_LIGA
@@fim:  RET
```

Três decisões em poucas linhas:

- **`NEG`** inverte a direção horizontal.
- **Acelerar** soma 2/16 de pixel ao módulo da velocidade, até o teto de 5 pixels por quadro (350 por segundo). A partir de 2 pixels por quadro, são 24 rebatidas até o máximo: uma troca de bolas longa fica cada vez mais tensa, exatamente como no original.
- **`vy = distância × 2`**: a velocidade vertical **não depende** da que a bola tinha. Isso dá ao jogador controle total do ângulo, e é uma escolha de jogo, não de física. Uma bola "realista" que só refletisse o ângulo de chegada seria muito menos divertida.

A bola é posta encostada na raquete (`MOV bola_x, (RAQ2_X-BOLA_TAM)*FRAC`) antes do rebate, pelo mesmo motivo do quique: evitar que ela fique "dentro" da raquete e rebata de novo no quadro seguinte.

### Gol, saque e vitória

```asm fragmento titulo="PONG.ASM: MOVE_BOLA (@@gol)"
@@gol:  MOV  BX, 4000           ; tom grave
        MOV  CL, 8
        CALL SOM_LIGA
        CALL DESENHA_PLACAR
        MOV  AL, PONTOS_VITORIA
        CMP  pontos1, AL
        JE   @@venceu1
        CMP  pontos2, AL
        JE   @@venceu2
        CALL SACA
        RET
```

`MOVE_BOLA` não decide o que acontece depois da vitória: só anota `vencedor`. Quem lê essa variável é o laço principal, que então chama `MOSTRA_VENCEDOR`. Essa separação (a física muda o **estado**; o laço decide o **fluxo**) mantém cada rotina simples.

E a pausa do saque é um contador de quadros no topo de `MOVE_BOLA`:

```asm fragmento titulo="PONG.ASM: MOVE_BOLA (começo)"
MOVE_BOLA PROC
        CMP  pausa_saque, 0
        JE   @@anda
        DEC  pausa_saque
        RET
```

Com o laço preso ao retraço, contar 50 quadros é esperar 50/70 de segundo, sem relógio nenhum. Enquanto isso, as raquetes continuam se mexendo, porque o laço nunca parou.

## Técnica 4: o adversário

Um adversário perfeito seria trivial: `raq2_y = bola_y − 16`, e a raquete do computador nunca erraria. Um adversário **divertido** precisa errar às vezes. O `CEREBRO` do PONG tem três limitações de propósito:

```asm fragmento titulo="PONG.ASM: CEREBRO"
; CEREBRO: o computador segue a bola, mas só quando ela vem para o lado
; dele, e mais devagar que o jogador. Entra e sai com AX = y da raquete 2.
CEREBRO PROC
        CMP  bola_vx, 0
        JLE  @@fim              ; a bola está indo embora: descansa
        MOV  BX, bola_y
        MOV  CL, 4
        SHR  BX, CL             ; centro da bola, em pixels
        ADD  BX, BOLA_TAM/2
        MOV  DX, AX
        ADD  DX, RAQ_ALT/2      ; centro da raquete
        SUB  BX, DX             ; BX = distância (positivo: bola mais abaixo)
        CMP  BX, 4
        JG   @@desce
        CMP  BX, -4
        JL   @@sobe
@@fim:  RET
@@desce:
        ADD  AX, RAQ_VEL-1
        RET
@@sobe: SUB  AX, RAQ_VEL-1
        RET
CEREBRO ENDP
```

1. **Só reage quando a bola vem.** Com a bola indo embora, a raquete fica onde está. Depois de uma rebatida bem inclinada, ela pode estar longe demais quando a bola voltar.
2. **É mais lenta.** Anda 2 pixels por quadro (`RAQ_VEL-1`); o jogador anda 3. Uma bola rápida e bem inclinada passa.
3. **Tem uma zona morta.** Se o centro da bola estiver a até 4 pixels do centro da raquete, ela não se mexe. Isso evita que a raquete trema e, de quebra, faz a bola bater um pouco fora do centro, saindo com ângulo.

O resultado é um adversário que ganha de quem está aprendendo e perde para quem descobre o truque: rebater com a ponta da raquete. É o mesmo tipo de "inteligência" de quase todos os jogos dos anos 80: poucas regras simples, escolhidas para serem **vencíveis**.

## Técnica 5: desenhar só o que mudou, no modo 13h

### Posição lógica e posição desenhada

```asm fragmento titulo="PONG.ASM: APAGA_OBJETOS e DESENHA_OBJETOS"
APAGA_OBJETOS PROC
        MOV  AL, COR_FUNDO
        MOV  BX, RAQ1_X
        MOV  DX, raq1_desenhada
        MOV  CX, RAQ_LARG
        MOV  SI, RAQ_ALT
        CALL RETANGULO
        ...
        MOV  BX, bola_xd
        MOV  DX, bola_yd
        MOV  CX, BOLA_TAM
        MOV  SI, BOLA_TAM
        CALL RETANGULO
        CALL DESENHA_REDE       ; a bola pode ter apagado um pedaço da rede
        RET
APAGA_OBJETOS ENDP

DESENHA_OBJETOS PROC
        MOV  AL, COR_RAQ1
        MOV  BX, RAQ1_X
        MOV  DX, raq1_y
        MOV  raq1_desenhada, DX ; anota onde desenhou
        ...
```

Apagar usa as posições **desenhadas** (o que de fato está na tela); desenhar usa as posições **lógicas** e as anota como desenhadas. Assim, nenhum resto de raquete fica na tela, mesmo que a posição tenha sido corrigida por `LIMITA_RAQUETE` ou que a bola tenha sido reposicionada no saque.

A **rede** é o único pedaço de cenário que a bola atravessa. Pintar a bola de preto deixaria um buraco nos traços; a solução preguiçosa e eficiente é redesenhar a rede inteira a cada quadro, logo depois de apagar. São 15 traços de 12 pixels: menos trabalho do que descobrir qual deles a bola tocou.

### RETANGULO com recorte

Toda a imagem do PONG, exceto o texto, é feita de retângulos: raquetes, bola, linhas, traços da rede e até os "pixels gordos" dos dígitos do placar. A rotina tem um detalhe que as versões das aulas 23 e 24 não tinham: o **recorte** (*clipping*).

```asm fragmento titulo="PONG.ASM: RETANGULO (o recorte)"
RETANGULO PROC
        ...
        OR   BX, BX             ; x negativo: corta a parte da esquerda
        JNS  @@x_ok
        ADD  CX, BX             ; largura -= quanto ficou de fora
        JLE  @@fim              ; nada visível
        XOR  BX, BX
@@x_ok: MOV  DI, BX
        ADD  DI, CX
        SUB  DI, LARG_TELA      ; passou da direita?
        JLE  @@larg_ok
        SUB  CX, DI
        JLE  @@fim
@@larg_ok:
        MOV  DI, DX             ; DI = y * 320 + x  (320 = 256 + 64)
        MOV  DH, DL
        XOR  DL, DL             ; DX = y * 256
        SHL  DI, 1
        ...                     ; seis SHL DI,1: DI = y * 64
        ADD  DI, DX
        ADD  DI, BX
        MOV  DX, CX             ; DX = largura
@@linha:
        MOV  CX, DX
        REP  STOSB
        SUB  DI, DX
        ADD  DI, LARG_TELA
        DEC  SI
        JNZ  @@linha
```

Sem o recorte, uma bola em x = −3 seria desenhada em −3 + y × 320, ou seja, nos **últimos pixels da linha de cima**, do outro lado da tela. E uma bola em x = 318 escreveria 2 pixels no começo da linha de baixo. No modo 13h a memória é contínua: sair pela direita é entrar pela esquerda, uma linha abaixo. O recorte só precisa ser horizontal, porque a bola nunca sai por cima nem por baixo.

```diagrama titulo="Por que recortar"
   sem recorte, bola em x = 318:             com recorte:
   linha y   ...............■■│               linha y   ...............■■│
   linha y+1 ■■...............│ ◄ lixo       linha y+1 .................│
```

### Dígitos grandes guardados em bits

A `INT 10h` desenha texto no modo 13h, mas com letras de 8 x 8, pequenas para um placar de fliperama. O PONG desenha os números com uma **fonte própria** de 3 x 5 "pixels gordos", cada um com 4 x 2 pixels de verdade. Cada dígito cabe numa word: 5 linhas de 3 bits = 15 bits.

```diagrama titulo="O dígito 2 na fonte do PONG"
   DW 1110011111001110b

   bits:  111 001 111 100 111 0      (o último bit sobra)
          ───────────────────
   linha 1: ###                      cada # vira um retângulo 4 x 2
   linha 2: ..#                      cada . vira um retângulo 4 x 2 preto
   linha 3: ###
   linha 4: #..                      resultado: 12 x 10 pixels
   linha 5: ###
```

```asm fragmento titulo="PONG.ASM: DIGITO_GRANDE (o laço)"
        MOV  BP, fonte_digitos[SI]  ; BP = os 15 bits do dígito
        MOV  DX, 1              ; y da primeira linha
        MOV  DI, 5              ; 5 linhas
@@linha:
        PUSH BX
        MOV  CH, 3              ; 3 colunas
@@coluna:
        SHL  BP, 1              ; o bit mais alto sai em CF
        MOV  AL, COR_FUNDO
        JNC  @@pinta
        MOV  AL, cor_digito
@@pinta:
        ...
        CALL RETANGULO          ; 4 x 2 pixels
        ...
        ADD  BX, 4
        DEC  CH
        JNZ  @@coluna
        POP  BX
        ADD  DX, 2
        DEC  DI
        JNZ  @@linha
```

O mesmo `SHL` que joga o bit no CF, usado no sprite do INVASOR, aqui escolhe entre duas cores. Pintar os bits 0 de preto (em vez de deixá-los transparentes) apaga o dígito anterior de graça. Dez dígitos inteiros em 20 bytes: é assim que os jogos de 8 bits guardavam fontes.

### Texto pela BIOS no modo gráfico

Para o menu e a mensagem de vitória, o PONG usa a `INT 10h` com AH = 0Eh (escrever como teletipo). No modo gráfico, **BL é a cor da letra**: a BIOS desenha o caractere pixel a pixel, com a fonte 8 x 8 da ROM. É lento (centenas de ciclos por letra), mas só acontece fora do laço do jogo, onde o tempo não importa. A grade de texto no modo 13h é de 40 x 25 caracteres. O [capítulo 3 do livro](livro:cap03) descreve as funções 02h e 0Eh.

```asm fragmento titulo="PONG.ASM: ESCREVE_TXT"
ESCREVE_TXT PROC
        MOV  AH, 02h            ; posiciona o cursor
        XOR  BH, BH
        INT  10h
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh            ; no modo gráfico, BL é a cor da letra
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE_TXT ENDP
```

## Técnica 6: som e saída

Os sons são os da [Aula 32](aula:aula32), três divisores com durações diferentes:

| Evento | Divisor | Frequência | Duração |
|--------|---------|-----------|---------|
| bola na raquete | 1.600 | 746 Hz | 1 tique (+1) |
| bola na parede | 2.400 | 497 Hz | 1 tique (+1) |
| gol | 4.000 | 298 Hz | 8 tiques (+1) |

O "+1" é o `INC AX` que o PONG acrescentou ao `SOM_LIGA` da COBRA: com um tique só, um bip disparado logo antes da virada do relógio duraria quase nada. Somando 1, o som dura **pelo menos** um tique inteiro.

A saída devolve as quatro coisas que o jogo mudou, na ordem certa: alto-falante, `INT 9`, modo de vídeo, e só então `INT 21h`/4Ch. Nenhuma outra parte do programa termina; até o ESC durante a partida volta ao menu, e só o ESC do menu chega a `@@sair`.

:::anos90 Rodando no MINIOS
O PONG pede ao DOS só três coisas: ler e trocar o vetor da INT 9 (35h e 25h) e terminar (4Ch). É exatamente o que o MINIOS, o sistema que você vai escrever nas aulas 40 a 44, oferece. O jogo roda nele sem uma linha de diferença.
:::

```quiz
? Por que o PONG não usa a INT 16h para ler as raquetes?
- Porque a INT 16h não funciona no modo 13h
+ Porque ela não diz que duas teclas estão apertadas ao mesmo tempo, e a repetição automática faria a raquete andar aos trancos
- Porque a INT 16h é lenta demais para 70 quadros por segundo
> O buffer da BIOS guarda a sequência de teclas digitadas, não o estado do teclado. A tabela preenchida pela INT 9 diz, a cada quadro, quais teclas estão apertadas.

? bola_x vale 2536. Em que pixel a bola é desenhada?
- 2536
+ 158
- 159
> 2536 / 16 = 158,5. O SAR por 4 descarta a fração: a bola fica no pixel 158 até bola_x chegar a 2544.

? Por que a conversão de bola_x para pixels usa SAR e não SHR?
+ Porque bola_x pode ficar negativo quando a bola sai pela esquerda, e SAR preserva o sinal
- Porque SAR é mais rápido
- Porque SHR não aceita CL
> −32 SAR 4 = −2; −32 SHR 4 = 4.094. Com SHR, a bola que sai pela esquerda apareceria do lado direito.

? A bola bate na raquete 10 pixels abaixo do centro (DX = 10). Qual será bola_vy?
- 10
+ 20, ou seja, 20/16 de pixel por quadro para baixo
- −20
- a mesma de antes, com o sinal trocado
> vy = DX × 2, em 1/16 de pixel. A velocidade vertical antiga é ignorada: quem decide o ângulo é o ponto de impacto.

? No truque SHL AL,1 / CMC / MOV AL,0 / ADC AL,0, por que MOV AL,0 e não XOR AL,AL?
- Porque XOR AL,AL não existe
+ Porque XOR zera o CF, que guarda a resposta; MOV não mexe nas flags
- Porque MOV é mais curto
> XOR AL,AL é 1 byte menor, mas apagaria o CF que o CMC acabou de preparar.

? Por que o PONG redesenha a rede a cada quadro?
+ Porque apagar a bola pintando de preto pode abrir um buraco nos traços da rede
- Porque a rede pisca
- Porque a paleta muda a cada quadro
> O fundo não é liso onde está a rede. Redesenhar os 15 traços é mais barato que descobrir qual deles a bola tocou.

? Quais destas são limitações propositais do CEREBRO?
- Ele sorteia se vai rebater ou não
+ Só segue a bola quando ela vem, anda mais devagar que o jogador e tem uma zona morta de 4 pixels
- Ele só lê a posição da bola uma vez por segundo
> Três regras simples tornam o adversário vencível, sem nenhum sorteio.

? O que aconteceria se RETANGULO não recortasse a bola em x = 318?
- O 8086 geraria uma exceção
+ Os 2 pixels que sobram apareceriam no começo da linha de baixo, do outro lado da tela
- Nada: a placa VGA corta sozinha
> A memória do modo 13h é uma tira contínua de 64.000 bytes; o fim de uma linha emenda no começo da seguinte.
```

## A listagem completa

Clique em **▶ Jogar**. No menu, **1** joga contra o computador e **2** a dois. Jogador 1: **W** e **S**. Jogador 2: **setas**. ESC volta ao menu (e, no menu, sai).

```asm jogo titulo="PONG.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  PONG.ASM  -  tênis de mesa no modo 13h (320x200, 256 cores)  ║
; ║  Curso Assembly 8086, aula 34                                 ║
; ║                                                               ║
; ║  Programa .COM: TASM PONG / TLINK /t PONG                     ║
; ║  Jogador 1: W e S.   Jogador 2: setas (ou o computador).      ║
; ║  ESC sai.                                                     ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; Constantes (posições em pixels; a bola usa 1/16 de pixel)
; ---------------------------------------------------------------
LARG_TELA   EQU 320
ALT_TELA    EQU 200
CAMPO_TOPO  EQU 16              ; abaixo do placar
CAMPO_BASE  EQU 196             ; acima da linha de baixo
RAQ_ALT     EQU 32
RAQ_LARG    EQU 4
RAQ1_X      EQU 12              ; coluna da raquete da esquerda
RAQ2_X      EQU LARG_TELA-12-RAQ_LARG
RAQ_VEL     EQU 3               ; pixels por quadro
BOLA_TAM    EQU 4
PONTOS_VITORIA EQU 7
FRAC        EQU 16              ; 4 bits de fração: 1 pixel = 16 unidades

COR_FUNDO   EQU 0
COR_LINHA   EQU 8               ; cinza escuro
COR_RAQ1    EQU 11              ; ciano claro
COR_RAQ2    EQU 14              ; amarelo
COR_BOLA    EQU 15              ; branco
COR_PLACAR  EQU 7

; códigos de varredura (o que chega na porta 60h)
SC_ESC      EQU 01h
SC_1        EQU 02h
SC_2        EQU 03h
SC_W        EQU 11h
SC_S        EQU 1Fh
SC_CIMA     EQU 48h
SC_BAIXO    EQU 50h
SC_ESPACO   EQU 39h

; ===============================================================
; Programa principal
; ===============================================================
inicio:
        CLD
        MOV  AX, 0013h          ; modo 13h
        INT  10h
        MOV  AX, 0A000h         ; ES = memória de vídeo
        MOV  ES, AX
        CALL INSTALA_TECLADO    ; agora o teclado é nosso (INT 9)
        CALL SEMEIA

@@menu: CALL TELA_MENU          ; AL = 1 ou 2 jogadores, 0 = sair
        OR   AL, AL
        JZ   @@sair
        MOV  jogadores, AL
        CALL NOVA_PARTIDA
@@quadro:
        CALL ESPERA_RETRACO     ; 70 quadros por segundo, sem cintilação
        CALL APAGA_OBJETOS
        CALL MOVE_RAQUETES
        CALL MOVE_BOLA
        CALL DESENHA_OBJETOS
        CALL SOM_ATUALIZA
        CMP  teclas[SC_ESC], 1
        JE   @@desistiu
        CMP  vencedor, 0
        JE   @@quadro
        CALL MOSTRA_VENCEDOR
        JMP  @@menu
@@desistiu:
        CALL ESPERA_SOLTAR      ; senão o ESC ainda apertado sairia do menu também
        JMP  @@menu

@@sair: CALL SOM_DESLIGA
        CALL RESTAURA_TECLADO
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ===============================================================
; Teclado: uma rotina na INT 9 guarda o estado de cada tecla
; ===============================================================

; Com a INT 16h, o jogo só sabe a última tecla digitada. Com dois
; jogadores, W e seta para cima podem estar apertadas ao mesmo tempo:
; o jeito é ler a porta 60h a cada interrupção e anotar "apertada"
; (código < 80h) ou "solta" (código + 80h) numa tabela de 128 bytes.
NOVA_INT9 PROC FAR
        PUSH AX
        PUSH BX
        IN   AL, 60h            ; código da tecla
        MOV  BL, AL
        AND  BX, 007Fh          ; BX = número da tecla
        SHL  AL, 1              ; CF = bit 7 (1 = soltou)
        CMC                     ; CF = 1 se apertou
        MOV  AL, 0
        ADC  AL, 0              ; AL = 1 (apertada) ou 0 (solta)
        MOV  CS:teclas[BX], AL  ; CS: aqui DS pode ser qualquer coisa
        MOV  AL, 20h            ; fim de interrupção para o PIC
        OUT  20h, AL
        POP  BX
        POP  AX
        IRET
NOVA_INT9 ENDP

INSTALA_TECLADO PROC
        MOV  AX, 3509h          ; guarda o vetor antigo (ES:BX)
        PUSH ES
        INT  21h
        MOV  WORD PTR int9_antiga, BX
        MOV  WORD PTR int9_antiga+2, ES
        POP  ES
        MOV  AX, 2509h          ; DS:DX = nova rotina
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

; ESPERA_SOLTAR: espera todas as teclas serem soltas
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

; ===============================================================
; Partida
; ===============================================================
NOVA_PARTIDA PROC
        CALL LIMPA_TELA
        MOV  pontos1, 0
        MOV  pontos2, 0
        MOV  vencedor, 0
        MOV  raq1_y, (CAMPO_TOPO+CAMPO_BASE-RAQ_ALT)/2
        MOV  raq2_y, (CAMPO_TOPO+CAMPO_BASE-RAQ_ALT)/2
        CALL DESENHA_CAMPO
        CALL DESENHA_PLACAR
        MOV  saque, 1           ; quem saca vai para a direita
        CALL SACA
        CALL DESENHA_OBJETOS
        RET
NOVA_PARTIDA ENDP

; SACA: bola no meio, indo para o lado de "saque", com ângulo sorteado
SACA    PROC
        MOV  bola_x, (LARG_TELA/2-BOLA_TAM/2)*FRAC
        MOV  AX, CAMPO_BASE-CAMPO_TOPO-40
        CALL ALEATORIO
        ADD  AX, CAMPO_TOPO+20
        MOV  CL, 4
        SHL  AX, CL             ; pixels -> 1/16 de pixel
        MOV  bola_y, AX
        MOV  AX, 2*FRAC         ; 2 pixels por quadro na horizontal
        CMP  saque, 1
        JE   @@dir
        NEG  AX
@@dir:  MOV  bola_vx, AX
        MOV  AX, 33             ; vertical entre -16 e +16 (até 1 pixel por quadro)
        CALL ALEATORIO
        SUB  AX, 16
        MOV  bola_vy, AX
        MOV  pausa_saque, 50    ; a bola espera 50 quadros (~0,7 s)
        RET
SACA    ENDP

; MOVE_RAQUETES: jogador 1 com W/S; jogador 2 com as setas ou o computador
MOVE_RAQUETES PROC
        MOV  AX, raq1_y
        CMP  teclas[SC_W], 1
        JNE  @@j1b
        SUB  AX, RAQ_VEL
@@j1b:  CMP  teclas[SC_S], 1
        JNE  @@j1f
        ADD  AX, RAQ_VEL
@@j1f:  CALL LIMITA_RAQUETE
        MOV  raq1_y, AX

        MOV  AX, raq2_y
        CMP  jogadores, 2
        JE   @@humano
        CALL CEREBRO            ; o computador decide
        JMP  SHORT @@j2f
@@humano:
        CMP  teclas[SC_CIMA], 1
        JNE  @@j2b
        SUB  AX, RAQ_VEL
@@j2b:  CMP  teclas[SC_BAIXO], 1
        JNE  @@j2f
        ADD  AX, RAQ_VEL
@@j2f:  CALL LIMITA_RAQUETE
        MOV  raq2_y, AX
        RET
MOVE_RAQUETES ENDP

; LIMITA_RAQUETE: mantém AX (y da raquete) dentro do campo
LIMITA_RAQUETE PROC
        CMP  AX, CAMPO_TOPO
        JGE  @@baixo
        MOV  AX, CAMPO_TOPO
@@baixo:
        CMP  AX, CAMPO_BASE-RAQ_ALT
        JLE  @@ok
        MOV  AX, CAMPO_BASE-RAQ_ALT
@@ok:   RET
LIMITA_RAQUETE ENDP

; CEREBRO: o computador segue a bola, mas só quando ela vem para o lado
; dele, e mais devagar que o jogador. Entra e sai com AX = y da raquete 2.
CEREBRO PROC
        CMP  bola_vx, 0
        JLE  @@fim              ; a bola está indo embora: descansa
        MOV  BX, bola_y
        MOV  CL, 4
        SHR  BX, CL             ; centro da bola, em pixels
        ADD  BX, BOLA_TAM/2
        MOV  DX, AX
        ADD  DX, RAQ_ALT/2      ; centro da raquete
        SUB  BX, DX             ; BX = distância (positivo: bola mais abaixo)
        CMP  BX, 4
        JG   @@desce
        CMP  BX, -4
        JL   @@sobe
@@fim:  RET
@@desce:
        ADD  AX, RAQ_VEL-1
        RET
@@sobe: SUB  AX, RAQ_VEL-1
        RET
CEREBRO ENDP

; MOVE_BOLA: física da bola (paredes, raquetes e gols)
MOVE_BOLA PROC
        CMP  pausa_saque, 0
        JE   @@anda
        DEC  pausa_saque
        RET
@@anda: MOV  AX, bola_y         ; vertical: quica no topo e na base
        ADD  AX, bola_vy
        CMP  AX, CAMPO_TOPO*FRAC
        JGE  @@nao_topo
        MOV  AX, CAMPO_TOPO*FRAC
        NEG  bola_vy
        CALL BIP_PAREDE
@@nao_topo:
        CMP  AX, (CAMPO_BASE-BOLA_TAM)*FRAC
        JLE  @@nao_base
        MOV  AX, (CAMPO_BASE-BOLA_TAM)*FRAC
        NEG  bola_vy
        CALL BIP_PAREDE
@@nao_base:
        MOV  bola_y, AX

        MOV  AX, bola_x         ; horizontal
        ADD  AX, bola_vx
        MOV  bola_x, AX
        MOV  CL, 4
        SAR  AX, CL             ; AX = x em pixels (SAR: x pode ser negativo)
        CMP  bola_vx, 0
        JL   @@para_esq

        ; indo para a direita: encostou na raquete 2?
        CMP  AX, RAQ2_X-BOLA_TAM
        JL   @@sai
        CMP  AX, RAQ2_X
        JG   @@gol_direita
        MOV  BX, raq2_y
        CALL ACERTOU            ; CF = 1 se a raquete pegou a bola
        JNC  @@sai
        MOV  bola_x, (RAQ2_X-BOLA_TAM)*FRAC
        JMP  SHORT @@rebate
@@gol_direita:
        CMP  AX, LARG_TELA
        JL   @@sai
        INC  pontos1            ; a bola saiu pela direita: ponto do jogador 1
        MOV  saque, 0           ; quem tomou o gol recebe o saque
        JMP  SHORT @@gol
@@sai:  RET                     ; (um RET no meio: o @@fim lá embaixo
                                ;  fica longe demais para um JL)

@@para_esq:
        CMP  AX, RAQ1_X+RAQ_LARG
        JG   @@fim
        CMP  AX, RAQ1_X
        JL   @@gol_esquerda
        MOV  BX, raq1_y
        CALL ACERTOU
        JNC  @@fim
        MOV  bola_x, (RAQ1_X+RAQ_LARG)*FRAC
        JMP  SHORT @@rebate
@@gol_esquerda:
        CMP  AX, -BOLA_TAM*2    ; (x negativo vira número grande sem sinal;
        JG   @@fim              ;  por isso as comparações aqui são com sinal)
        INC  pontos2
        MOV  saque, 1

@@gol:  MOV  BX, 4000           ; tom grave
        MOV  CL, 8
        CALL SOM_LIGA
        CALL DESENHA_PLACAR
        MOV  AL, PONTOS_VITORIA
        CMP  pontos1, AL
        JE   @@venceu1
        CMP  pontos2, AL
        JE   @@venceu2
        CALL SACA
        RET
@@venceu1:
        MOV  vencedor, 1
        RET
@@venceu2:
        MOV  vencedor, 2
        RET

@@rebate:
        ; inverte a direção horizontal e acelera um pouco (até 5 pixels/quadro)
        MOV  AX, bola_vx
        NEG  AX
        CMP  AX, 0
        JL   @@neg
        CMP  AX, 5*FRAC
        JGE  @@vel_ok
        ADD  AX, 2
        JMP  SHORT @@vel_ok
@@neg:  CMP  AX, -5*FRAC
        JLE  @@vel_ok
        SUB  AX, 2
@@vel_ok:
        MOV  bola_vx, AX
        ; o ângulo depende de onde a bola bateu: DX = distância ao centro (-18..18)
        MOV  AX, DX
        SHL  AX, 1              ; vy = distância * 2 (em 1/16 de pixel)
        MOV  bola_vy, AX
        MOV  BX, 1600           ; tom agudo
        MOV  CL, 1
        CALL SOM_LIGA
@@fim:  RET
MOVE_BOLA ENDP

; ACERTOU: BX = y da raquete. Se a bola está na altura dela, CF = 1 e
; DX = (centro da bola) - (centro da raquete), em pixels.
ACERTOU PROC
        MOV  DX, bola_y
        MOV  CL, 4
        SHR  DX, CL
        ADD  DX, BOLA_TAM/2     ; centro da bola
        MOV  AX, BX
        SUB  AX, BOLA_TAM/2
        CMP  DX, AX             ; acima da raquete?
        JL   @@errou
        ADD  AX, RAQ_ALT+BOLA_TAM
        CMP  DX, AX             ; abaixo?
        JG   @@errou
        SUB  DX, BX
        SUB  DX, RAQ_ALT/2
        STC
        RET
@@errou:
        CLC
        RET
ACERTOU ENDP

BIP_PAREDE PROC
        PUSH AX
        PUSH BX
        PUSH CX
        MOV  BX, 2400
        MOV  CL, 1
        CALL SOM_LIGA
        POP  CX
        POP  BX
        POP  AX
        RET
BIP_PAREDE ENDP

; ===============================================================
; Desenho
; ===============================================================

; APAGA_OBJETOS / DESENHA_OBJETOS: cada quadro apaga a bola e as raquetes
; nas posições antigas e desenha nas novas. Como isso acontece logo depois
; do retraço vertical, o feixe nunca pega a tela pela metade.
APAGA_OBJETOS PROC
        MOV  AL, COR_FUNDO
        MOV  BX, RAQ1_X
        MOV  DX, raq1_desenhada
        MOV  CX, RAQ_LARG
        MOV  SI, RAQ_ALT
        CALL RETANGULO
        MOV  BX, RAQ2_X
        MOV  DX, raq2_desenhada
        CALL RETANGULO
        MOV  BX, bola_xd
        MOV  DX, bola_yd
        MOV  CX, BOLA_TAM
        MOV  SI, BOLA_TAM
        CALL RETANGULO
        CALL DESENHA_REDE       ; a bola pode ter apagado um pedaço da rede
        RET
APAGA_OBJETOS ENDP

DESENHA_OBJETOS PROC
        MOV  AL, COR_RAQ1
        MOV  BX, RAQ1_X
        MOV  DX, raq1_y
        MOV  raq1_desenhada, DX
        MOV  CX, RAQ_LARG
        MOV  SI, RAQ_ALT
        CALL RETANGULO
        MOV  AL, COR_RAQ2
        MOV  BX, RAQ2_X
        MOV  DX, raq2_y
        MOV  raq2_desenhada, DX
        CALL RETANGULO
        MOV  BX, bola_x
        MOV  CL, 4
        SAR  BX, CL
        MOV  DX, bola_y
        SHR  DX, CL
        MOV  bola_xd, BX
        MOV  bola_yd, DX
        MOV  AL, COR_BOLA
        MOV  CX, BOLA_TAM
        MOV  SI, BOLA_TAM
        CALL RETANGULO
        RET
DESENHA_OBJETOS ENDP

; RETANGULO: pinta CX x SI pixels com a cor AL a partir de (BX, DX).
; Pedaços fora da tela (x < 0 ou x > 319) são cortados.
RETANGULO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        OR   BX, BX             ; x negativo: corta a parte da esquerda
        JNS  @@x_ok
        ADD  CX, BX
        JLE  @@fim
        XOR  BX, BX
@@x_ok: MOV  DI, BX
        ADD  DI, CX
        SUB  DI, LARG_TELA      ; passou da direita?
        JLE  @@larg_ok
        SUB  CX, DI
        JLE  @@fim
@@larg_ok:
        MOV  DI, DX             ; DI = y * 320 + x  (320 = 256 + 64)
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
        MOV  DX, CX             ; DX = largura
@@linha:
        MOV  CX, DX
        REP  STOSB
        SUB  DI, DX
        ADD  DI, LARG_TELA
        DEC  SI
        JNZ  @@linha
@@fim:  POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
RETANGULO ENDP

LIMPA_TELA PROC
        XOR  DI, DI
        MOV  AX, COR_FUNDO*257
        MOV  CX, 32000
        REP  STOSW
        RET
LIMPA_TELA ENDP

DESENHA_CAMPO PROC
        MOV  AL, COR_LINHA      ; linhas de cima e de baixo
        XOR  BX, BX
        MOV  DX, CAMPO_TOPO-2
        MOV  CX, LARG_TELA
        MOV  SI, 2
        CALL RETANGULO
        MOV  DX, CAMPO_BASE
        CALL RETANGULO
        CALL DESENHA_REDE
        RET
DESENHA_CAMPO ENDP

; DESENHA_REDE: a linha tracejada do meio (2 x 6 pixels a cada 12)
DESENHA_REDE PROC
        MOV  AL, COR_LINHA
        MOV  BX, LARG_TELA/2-1
        MOV  DX, CAMPO_TOPO+2
        MOV  CX, 2
        MOV  SI, 6
@@traco:
        CALL RETANGULO
        ADD  DX, 12
        CMP  DX, CAMPO_BASE-6
        JB   @@traco
        RET
DESENHA_REDE ENDP

; DESENHA_PLACAR: os dois números com dígitos grandes (fonte 3x5)
DESENHA_PLACAR PROC
        MOV  AL, COR_FUNDO      ; apaga o placar antigo
        XOR  BX, BX
        XOR  DX, DX
        MOV  CX, LARG_TELA
        MOV  SI, CAMPO_TOPO-2
        CALL RETANGULO
        MOV  AL, pontos1
        MOV  BX, LARG_TELA/2-28
        MOV  AH, COR_RAQ1
        CALL DIGITO_GRANDE
        MOV  AL, pontos2
        MOV  BX, LARG_TELA/2+16
        MOV  AH, COR_RAQ2
        CALL DIGITO_GRANDE
        RET
DESENHA_PLACAR ENDP

; DIGITO_GRANDE: desenha o dígito AL (0-9) na cor AH, com o canto em (BX, 1).
; Cada dígito é uma figura de 3x5 "pixels gordos" de 4x2 pixels de verdade,
; guardada em 15 bits (5 linhas de 3 bits) na tabela fonte_digitos.
DIGITO_GRANDE PROC
        MOV  cor_digito, AH     ; guarda a cor: AX vai ser usado como índice
        XOR  AH, AH
        MOV  SI, AX
        SHL  SI, 1              ; cada dígito ocupa uma word
        MOV  BP, fonte_digitos[SI]  ; BP = os 15 bits do dígito
        MOV  DX, 1              ; y da primeira linha
        MOV  DI, 5              ; 5 linhas
@@linha:
        PUSH BX
        MOV  CH, 3              ; 3 colunas
@@coluna:
        SHL  BP, 1              ; o bit mais alto sai em CF
        MOV  AL, COR_FUNDO
        JNC  @@pinta
        MOV  AL, cor_digito
@@pinta:
        PUSH CX
        PUSH SI
        PUSH DI
        MOV  CX, 4
        MOV  SI, 2
        CALL RETANGULO
        POP  DI
        POP  SI
        POP  CX
        ADD  BX, 4
        DEC  CH
        JNZ  @@coluna
        POP  BX
        ADD  DX, 2
        DEC  DI
        JNZ  @@linha
        RET
DIGITO_GRANDE ENDP

; ESPERA_RETRACO: espera o começo de um retraço vertical (aula 24)
ESPERA_RETRACO PROC
        MOV  DX, 3DAh
@@fora: IN   AL, DX
        TEST AL, 8
        JNZ  @@fora
@@dentro:
        IN   AL, DX
        TEST AL, 8
        JZ   @@dentro
        RET
ESPERA_RETRACO ENDP

; ESCREVE_TXT: string terminada em 0 (SI) na linha DH, coluna DL (40x25), cor BL
ESCREVE_TXT PROC
        MOV  AH, 02h            ; posiciona o cursor
        XOR  BH, BH
        INT  10h
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh            ; no modo gráfico, BL é a cor da letra
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE_TXT ENDP

; TELA_MENU: AL = 1 ou 2 (jogadores) ou 0 (ESC)
TELA_MENU PROC
        CALL SOM_DESLIGA
        CALL LIMPA_TELA
        MOV  DH, 4
        MOV  DL, 17
        MOV  BL, 15
        MOV  SI, OFFSET txt_titulo
        CALL ESCREVE_TXT
        MOV  DH, 10
        MOV  DL, 9
        MOV  BL, COR_RAQ1
        MOV  SI, OFFSET txt_um
        CALL ESCREVE_TXT
        MOV  DH, 12
        MOV  DL, 9
        MOV  BL, COR_RAQ2
        MOV  SI, OFFSET txt_dois
        CALL ESCREVE_TXT
        MOV  DH, 16
        MOV  DL, 6
        MOV  BL, 7
        MOV  SI, OFFSET txt_teclas1
        CALL ESCREVE_TXT
        MOV  DH, 17
        MOV  DL, 6
        MOV  SI, OFFSET txt_teclas2
        CALL ESCREVE_TXT
        MOV  DH, 21
        MOV  DL, 13
        MOV  SI, OFFSET txt_sair
        CALL ESCREVE_TXT
        CALL ESPERA_SOLTAR
@@espera:
        MOV  AL, 1
        CMP  teclas[SC_1], 1
        JE   @@fim
        MOV  AL, 2
        CMP  teclas[SC_2], 1
        JE   @@fim
        XOR  AL, AL
        CMP  teclas[SC_ESC], 1
        JNE  @@espera
@@fim:  PUSH AX
        CALL ESPERA_SOLTAR
        POP  AX
        RET
TELA_MENU ENDP

MOSTRA_VENCEDOR PROC
        MOV  DH, 9
        MOV  DL, 12
        MOV  BL, COR_RAQ1
        MOV  SI, OFFSET txt_venceu1
        CMP  vencedor, 1
        JE   @@msg
        MOV  BL, COR_RAQ2
        MOV  SI, OFFSET txt_venceu2
        CMP  jogadores, 2
        JE   @@msg
        MOV  SI, OFFSET txt_venceu_pc
@@msg:  CALL ESCREVE_TXT
        MOV  DH, 11
        MOV  DL, 10
        MOV  BL, 7
        MOV  SI, OFFSET txt_espaco
        CALL ESCREVE_TXT
@@espera:
        CALL SOM_ATUALIZA
        CMP  teclas[SC_ESPACO], 1
        JNE  @@espera
        CALL ESPERA_SOLTAR
        RET
MOSTRA_VENCEDOR ENDP

; ===============================================================
; Tempo, sorteio e som (as mesmas rotinas da cobra)
; ===============================================================
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

SOM_LIGA PROC
        PUSH AX
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
        INC  AX                 ; pelo menos um tique inteiro
        MOV  som_fim, AX
        MOV  som_ligado, 1
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
; dígitos 3x5: cada linha usa 3 bits; os 15 bits ficam no alto da word
fonte_digitos DW 1111011011011110b   ; 0  ### #.# #.# #.# ###
              DW 0101100100101110b   ; 1  .#. ##. .#. .#. ###
              DW 1110011111001110b   ; 2  ### ..# ### #.. ###
              DW 1110011110011110b   ; 3  ### ..# ### ..# ###
              DW 1011011110010010b   ; 4  #.# #.# ### ..# ..#
              DW 1111001110011110b   ; 5  ### #.. ### ..# ###
              DW 1111001111011110b   ; 6  ### #.. ### #.# ###
              DW 1110010100100100b   ; 7  ### ..# .#. .#. .#.
              DW 1111011111011110b   ; 8  ### #.# ### #.# ###
              DW 1111011110011110b   ; 9  ### #.# ### ..# ###
cor_digito  DB 15

txt_titulo  DB 'P O N G', 0
txt_um      DB '1 - contra o computador', 0
txt_dois    DB '2 - dois jogadores', 0
txt_teclas1 DB 'Jogador 1: W sobe, S desce', 0
txt_teclas2 DB 'Jogador 2: setas', 0
txt_sair    DB 'ESC sai', 0
txt_venceu1 DB 'JOGADOR 1 VENCEU!', 0
txt_venceu2 DB 'JOGADOR 2 VENCEU!', 0
txt_venceu_pc DB 'O COMPUTADOR VENCEU', 0
txt_espaco  DB 'ESPACO volta ao menu', 0

jogadores   DB 1
vencedor    DB 0
saque       DB 1
pontos1     DB 0
pontos2     DB 0
pausa_saque DB 0
raq1_y      DW 0
raq2_y      DW 0
raq1_desenhada DW 0
raq2_desenhada DW 0
bola_x      DW 0                ; posição e velocidade em 1/16 de pixel
bola_y      DW 0
bola_vx     DW 0
bola_vy     DW 0
bola_xd     DW 0                ; onde a bola foi desenhada (pixels)
bola_yd     DW 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0
int9_antiga DD 0
teclas      DB 128 DUP (0)      ; 1 = tecla apertada agora

END inicio
```

## Exercícios

```exercicio
id: a34-1
titulo: Limitar a raquete
nivel: 1
--- enunciado
AX chega com o y de uma raquete, que pode ter ficado **negativo** ou grande demais depois de um movimento. Prenda AX entre **16** (o topo do campo) e **164** (196 − 32, o mais baixo possível para uma raquete de 32 pixels).
--- inicial
; AX = y da raquete (com sinal)
; prenda AX entre 16 e 164
--- testes
[{ "nome": "dentro: 100 continua 100", "setup": { "AX": 100 }, "espera": { "AX": 100 } },
 { "nome": "13 vira 16", "setup": { "AX": 13 }, "espera": { "AX": 16 } },
 { "nome": "negativo (-2) vira 16", "setup": { "AX": -2 }, "espera": { "AX": 16 } },
 { "nome": "167 vira 164", "setup": { "AX": 167 }, "espera": { "AX": 164 } },
 { "nome": "164 continua 164", "setup": { "AX": 164 }, "espera": { "AX": 164 } }]
--- dicas
Compare com 16 e, se for menor, troque. Depois compare com 164 e, se for maior, troque.
Use saltos com sinal (JGE, JLE): −2 sem sinal é 65.534, que é "maior que 164".
--- solucao
; AX = y da raquete (com sinal)
        CMP  AX, 16
        JGE  @@baixo
        MOV  AX, 16
@@baixo:
        CMP  AX, 164
        JLE  @@ok
        MOV  AX, 164
@@ok:
```

```exercicio
id: a34-2
titulo: Endereço sem MUL
nivel: 2
proibir: MUL, IMUL
--- enunciado
Calcule em **DI** o deslocamento do pixel (**BX**, **DX**) = (x, y) no modo 13h: `y × 320 + x`. Sem `MUL`: 320 = 256 + 64. **BX** e **DX** precisam terminar com os valores de entrada.
--- inicial
; BX = x (0 a 319), DX = y (0 a 199)
; DI = y * 320 + x
--- testes
[{ "nome": "(0, 0)", "setup": { "BX": 0, "DX": 0, "DI": 5 }, "espera": { "DI": 0, "preservar": ["BX", "DX"] } },
 { "nome": "(100, 50)", "setup": { "BX": 100, "DX": 50 }, "espera": { "DI": 16100, "preservar": ["BX", "DX"] } },
 { "nome": "(5, 1)", "setup": { "BX": 5, "DX": 1 }, "espera": { "DI": 325, "preservar": ["BX", "DX"] } },
 { "nome": "(319, 199)", "setup": { "BX": 319, "DX": 199 }, "espera": { "DI": 63999, "preservar": ["BX", "DX"] } }]
--- dicas
y × 256: copie y para um registrador e mova o byte baixo para o alto (MOV AH,DL / XOR AL,AL, com AX livre).
y × 64: MOV DI,DX e seis SHL DI,1 (ou MOV CL,6 / SHL DI,CL).
Some os dois e o x. Use PUSH/POP se precisar mexer em DX.
--- solucao
; BX = x (0 a 319), DX = y (0 a 199)
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
```

```exercicio
id: a34-3
titulo: Rebater e acelerar
nivel: 2
--- enunciado
A bola acabou de bater numa raquete. Inverta **bola_vx** (que está em 1/16 de pixel) e aumente o módulo dela em **2**, a não ser que o módulo já tenha chegado a **80** (5 pixels por quadro): nesse caso, só inverta.

Exemplos: 32 vira −34; −32 vira 34; 80 vira −80.
--- inicial
        JMP  inicio
bola_vx DW 32
inicio: ; inverta e acelere bola_vx
--- testes
[{ "nome": "32 vira -34", "setup": { "bola_vx": 32 }, "espera": { "mem": { "bola_vx": -34 } } },
 { "nome": "-32 vira 34", "setup": { "bola_vx": -32 }, "espera": { "mem": { "bola_vx": 34 } } },
 { "nome": "80 só inverte", "setup": { "bola_vx": 80 }, "espera": { "mem": { "bola_vx": -80 } } },
 { "nome": "-80 só inverte", "setup": { "bola_vx": -80 }, "espera": { "mem": { "bola_vx": 80 } } },
 { "nome": "-79 vira 81", "setup": { "bola_vx": -79 }, "espera": { "mem": { "bola_vx": 81 } } }]
--- dicas
MOV AX,bola_vx / NEG AX. Agora AX tem a direção nova.
Se AX for positivo: se for menor que 80, some 2. Se for negativo: se for maior que −80, subtraia 2.
Comparações com sinal (JL, JGE, JLE). No fim, MOV bola_vx,AX.
--- solucao
        JMP  inicio
bola_vx DW 32
inicio: ; inverta e acelere bola_vx
        MOV  AX, bola_vx
        NEG  AX
        CMP  AX, 0
        JL   @@neg
        CMP  AX, 80
        JGE  @@ok
        ADD  AX, 2
        JMP  SHORT @@ok
@@neg:  CMP  AX, -80
        JLE  @@ok
        SUB  AX, 2
@@ok:   MOV  bola_vx, AX
```

```exercicio
id: a34-4
titulo: A raquete pegou?
nivel: 3
--- enunciado
**BX** = y do topo de uma raquete de **32** pixels; **bola_y** = y do topo da bola de **4** pixels, em **1/16 de pixel**.

Calcule o centro da bola em pixels: `c = bola_y / 16 + 2`. A raquete pega a bola se `BX − 2 ≤ c ≤ BX + 34` (comparações com sinal). Se pegar, devolva **CF = 1** e **DX = c − BX − 16** (a distância ao centro da raquete). Se não pegar, **CF = 0**.
--- inicial
        JMP  inicio
bola_y  DW 0
inicio: ; BX = y da raquete
        ; CF = 1 e DX = distância se pegou, CF = 0 se não
--- testes
[{ "nome": "no meio, um pouco acima", "setup": { "BX": 80, "bola_y": 1440 }, "espera": { "CF": 1, "DX": -4 } },
 { "nome": "bem acima: errou", "setup": { "BX": 80, "bola_y": 640, "DX": 0 }, "espera": { "CF": 0 } },
 { "nome": "bem abaixo: errou", "setup": { "BX": 80, "bola_y": 1920 }, "espera": { "CF": 0 } },
 { "nome": "raspando na ponta de cima", "setup": { "BX": 80, "bola_y": 1216 }, "espera": { "CF": 1, "DX": -18 } },
 { "nome": "na ponta de baixo", "setup": { "BX": 80, "bola_y": 1760 }, "espera": { "CF": 1, "DX": 16 } },
 { "nome": "um pixel além da ponta de cima", "setup": { "BX": 80, "bola_y": 1200 }, "espera": { "CF": 0 } },
 { "nome": "raquete no topo do campo", "setup": { "BX": 16, "bola_y": 256 }, "espera": { "CF": 1, "DX": -14 } }]
--- dicas
MOV DX,bola_y / MOV CL,4 / SHR DX,CL / ADD DX,2: DX = centro da bola.
MOV AX,BX / SUB AX,2 / CMP DX,AX / JL errou. Depois ADD AX,36 / CMP DX,AX / JG errou.
Acertou: SUB DX,BX / SUB DX,16 / STC. Errou: CLC. Os SUB mexem no CF, por isso o STC vem por último.
--- solucao
        JMP  inicio
bola_y  DW 0
inicio: ; BX = y da raquete
        MOV  DX, bola_y
        MOV  CL, 4
        SHR  DX, CL
        ADD  DX, 2
        MOV  AX, BX
        SUB  AX, 2
        CMP  DX, AX
        JL   @@errou
        ADD  AX, 36
        CMP  DX, AX
        JG   @@errou
        SUB  DX, BX
        SUB  DX, 16
        STC
        JMP  SHORT @@fim
@@errou:
        CLC
@@fim:
```

```exercicio
id: a34-5
titulo: O cérebro do computador
nivel: 3
--- enunciado
Escreva o adversário do PONG. **AX** = y do topo da raquete 2 (32 pixels de altura). **bola_vx** = velocidade horizontal da bola; **bola_y** = y do topo da bola (4 pixels de altura), em 1/16 de pixel.

- Se **bola_vx ≤ 0** (a bola está indo embora), AX não muda.
- Senão, calcule `d = (bola_y / 16 + 2) − (AX + 16)`. Se **d > 4**, some **2** a AX; se **d < −4**, subtraia **2**; senão, AX não muda.
--- inicial
        JMP  inicio
bola_vx DW 32
bola_y  DW 0
inicio: ; AX = y da raquete 2
--- testes
[{ "nome": "bola indo embora: descansa", "setup": { "AX": 80, "bola_vx": -32, "bola_y": 2400 }, "espera": { "AX": 80 } },
 { "nome": "bola parada na horizontal: descansa", "setup": { "AX": 80, "bola_vx": 0, "bola_y": 2400 }, "espera": { "AX": 80 } },
 { "nome": "bola vindo, mais abaixo: desce", "setup": { "AX": 80, "bola_vx": 32, "bola_y": 2400 }, "espera": { "AX": 82 } },
 { "nome": "bola vindo, mais acima: sobe", "setup": { "AX": 80, "bola_vx": 32, "bola_y": 320 }, "espera": { "AX": 78 } },
 { "nome": "na zona morta: fica", "setup": { "AX": 80, "bola_vx": 32, "bola_y": 1520 }, "espera": { "AX": 80 } },
 { "nome": "d = 5: desce", "setup": { "AX": 80, "bola_vx": 48, "bola_y": 1584 }, "espera": { "AX": 82 } }]
--- dicas
CMP bola_vx,0 / JLE fim (com sinal!).
BX = bola_y SHR 4 + 2; DX = AX + 16; SUB BX,DX.
CMP BX,4 / JG desce. CMP BX,−4 / JL sobe. Em desce: ADD AX,2; em sobe: SUB AX,2.
--- solucao
        JMP  inicio
bola_vx DW 32
bola_y  DW 0
inicio: ; AX = y da raquete 2
        CMP  bola_vx, 0
        JLE  @@fim
        MOV  BX, bola_y
        MOV  CL, 4
        SHR  BX, CL
        ADD  BX, 2
        MOV  DX, AX
        ADD  DX, 16
        SUB  BX, DX
        CMP  BX, 4
        JG   @@desce
        CMP  BX, -4
        JL   @@sobe
        JMP  SHORT @@fim
@@desce:
        ADD  AX, 2
        JMP  SHORT @@fim
@@sobe: SUB  AX, 2
@@fim:
```

## Desafios

1. **O "efeito".** Faça a velocidade da raquete no momento do impacto somar alguma coisa a `bola_vy`: rebater com a raquete subindo puxa a bola para cima. Vai precisar guardar o y da raquete no quadro anterior.
2. **Níveis de dificuldade.** No menu, ofereça três adversários: troque `RAQ_VEL-1` por uma variável (1, 2 ou 3) e a zona morta de 4 por outra. Com velocidade 3 e zona 0, o computador fica quase imbatível. Por que "quase"?
3. **Pausa.** Com P (scan code 19h), congele a partida. Cuidado: a tecla fica "apertada" na tabela por vários quadros; use a detecção de borda do QUADRADO da [Aula 32](aula:aula32).
4. **Rastro da bola.** Em vez de apagar a bola de preto, pinte-a com a cor 8 e, em DESENHA_OBJETOS, desenhe a nova. Depois use a paleta ([Aula 24](aula:aula24)) para que o rastro escureça aos poucos.
5. **Quatro paredes.** Transforme o PONG num jogo de squash: tire a raquete 2, faça a bola quicar na parede da direita e conte quantas vezes o jogador 1 rebate antes de errar. Mostre o recorde com `DIGITO_GRANDE`.

## No livro

- [Capítulo 20, A BIOS para jogos](livro:cap20): retraço vertical, INT 9 para jogos, som pelo PIT e vídeo direto, as quatro peças do PONG.
- [Capítulo 6, teclado](livro:cap06): a INT 09h da BIOS, a porta 60h, os códigos de aperto e soltura e o prefixo E0h.
- [Capítulo 2, vetores e IRQs](livro:cap02): a IRQ 1, o PIC 8259 e o EOI.
- [Capítulo 3, vídeo I](livro:cap03): o modo 13h, a INT 10h e o texto no modo gráfico (funções 02h e 0Eh).
- [Capítulo 7, tempo](livro:cap07): a INT 1Ah, que mede a duração dos sons.

:::resumo
- **Pong** (Atari, 1972) era um circuito sem processador; refazê-lo em software é o "Olá, mundo" dos jogos.
- O laço espera o **retraço**, apaga, move, desenha e atualiza o som: 70 quadros por segundo, sem cintilação, na mesma velocidade em qualquer PC.
- Dois jogadores exigem a **INT 9 própria** com tabela de teclas. `ESPERA_SOLTAR` evita que uma tecla ainda apertada passe para a próxima tela.
- A bola vive em **ponto fixo 12.4** (1/16 de pixel): `ADD` para mover, `SAR` por 4 para desenhar (x pode ser negativo).
- Quicar é `NEG` na velocidade, com a bola reposta na borda. `ACERTOU` devolve a resposta no **CF**. O **ponto de impacto** decide `vy`, e cada rebatida acelera até 5 pixels por quadro.
- O **CEREBRO** é vencível de propósito: só reage com a bola vindo, é mais lento e tem zona morta.
- Posição **lógica** separada da posição **desenhada**; a rede é redesenhada a cada quadro; `RETANGULO` **recorta** na horizontal; dígitos de 3 x 5 em 15 bits por word.
- Do DOS, só 25h, 35h e 4Ch: o PONG roda também no MINIOS.
:::
