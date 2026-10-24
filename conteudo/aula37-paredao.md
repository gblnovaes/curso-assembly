---
id: aula37
numero: 37
modulo: 13
titulo: Paredão, a parede de tijolos
subtitulo: Breakout no modo 13h - ponto fixo, colisão por eixo, ângulo pela raquete e fases desenhadas em bits
duracao: 100 min
objetivos: entender as regras do Breakout de 1976 e como elas viram estado na memória; guardar a posição da bola em ponto fixo (1/16 de pixel) e converter com SAR; achar o tijolo de um pixel com uma divisão e uma multiplicação; resolver a colisão um eixo de cada vez e rebater com NEG; calcular o ângulo da bola pelo ponto onde ela bate na raquete; montar fases a partir de desenhos guardados em bits; ler a listagem completa do PAREDAO.ASM
---

## Uma parede, uma bola e uma raquete

O jogo desta aula é o mais "físico" do módulo: uma bola quica entre as paredes, o teto e uma raquete controlada pelo jogador, e cada tijolo que ela toca desaparece. Parece pouco, mas o Breakout tem todos os problemas clássicos de um jogo de ação: **movimento com velocidades fracionárias**, **colisão contra muitos objetos**, **resposta à colisão** (para onde a bola vai depois de bater?) e um pouco de **design de fases**.

Você já viu o laço do jogo, o relógio pelo retraço vertical, a INT 9 própria, o vídeo direto em A000h e o som pelo PIT nos [fundamentos](aula:aula32). Nesta aula a gente para em cima do que o PAREDÃO faz de próprio. O fonte inteiro, pronto para jogar, está no fim da aula.

:::anos90 Atari, 1976: o Breakout e os dois Steves
Depois do sucesso do Pong, a Atari queria um jogo de raquete para **um** jogador. Nolan Bushnell e Steve Bristow desenharam a ideia, e o protótipo do hardware foi feito por **Steve Wozniak**, que na época trabalhava na HP e fazia bicos para a Atari junto com o amigo **Steve Jobs**, então funcionário da empresa. A lenda diz que Wozniak montou a placa em quatro noites com pouquíssimos chips; o projeto era tão enxuto que os engenheiros da Atari não conseguiram fabricá-lo e refizeram tudo. O fliperama saiu em 1976 com um monitor **preto e branco** e tiras de celofane colorido coladas na tela: é por isso que as fileiras do Breakout têm cores fixas (vermelho, laranja, verde, amarelo), exatamente como no nosso jogo.

As regras do original também estão aqui: tijolos de cima valem mais (7, 5, 3 e 1 ponto) e a bola **acelera no 4º e no 12º toque**. Wozniak gostou tanto do jogo que escreveu uma versão em BASIC para o Apple II, o "Little Brick Out", e disse depois que as cores do Apple II existiam em boa parte para que o Breakout ficasse bonito.

Dez anos depois, o **Arkanoid** (Taito, 1986) trocou a raquete por uma nave, a "Vaus", e acrescentou cápsulas de poder (laser, bola que gruda, raquete larga), tijolos que precisam de vários toques e dezenas de fases desenhadas à mão. Ele foi convertido para os micros da época, inclusive o PC, e no começo dos anos 90 os disquetes de shareware estavam cheios de clones do Breakout e do Arkanoid em CGA, EGA e VGA.
:::

## As regras do PAREDÃO

| Elemento | Como é no jogo |
|----------|----------------|
| Tela | modo **13h**, 320 × 200 com 256 cores (veja a [Aula 23](aula:aula23)) |
| Parede | **13 colunas × 8 fileiras** de tijolos de **24 × 8** pixels |
| Pontos | fileiras de cima para baixo: vermelho 7, laranja 5, verde 3, amarelo 1 |
| Raquete | 32 × 4 pixels na linha y = 184, anda 4 pixels por quadro |
| Bola | 3 × 3 pixels, começa a 2 pixels por quadro na vertical |
| Aceleração | +0,5 pixel por quadro no 4º e no 12º tijolo quebrado |
| Ângulo | depende de onde a bola bate na raquete: no centro sobe reta, nas pontas sai inclinada |
| Vidas | 3; a bola que passa da raquete custa uma |
| Fases | 3 desenhos de parede (cheia, pirâmide, xadrez) que se repetem |
| Teclas | setas movem, ESPAÇO lança a bola, ESC volta ao título |

Como os outros jogos do módulo, o PAREDÃO é um programa **.COM** que só usa da INT 21h as funções **25h e 35h** (trocar e ler o vetor da INT 9) e **4Ch** (sair). Todo o resto (vídeo, tempo, teclado, som) é BIOS ou hardware. Isso não é por acaso: é o que permite que ele rode também no MINIOS, o sistema operacional que a gente vai construir no módulo 14.

## A tela

```diagrama titulo="O campo do PAREDÃO em coordenadas de pixel"
 x:  0   4                                                     315 316 319
 y   ┌───────────────────────────────────────────────────────────────┐
 0   │ PONTOS 16          VIDAS 3     FASE 1     (texto, linha 0)   │  y 0-7
     │                                                               │
12   ████████████████████ teto (cor 8) ██████████████████████████████  y 12-15
16   ██ ┌─ o campo da bola começa aqui (TETO = 16) ──────────────┐ ██
     ██ │                                                         │ ██
32   ██ │▓▓▓▓▓▓▓│▓▓▓▓▓▓▓│ ... 13 tijolos de 24 x 8 ... │▓▓▓▓▓▓▓│ ██  fileiras 0-1  vermelho  7
48   ██ │▓▓▓▓▓▓▓│▓▓▓▓▓▓▓│                               │▓▓▓▓▓▓▓│ ██  fileiras 2-3  laranja   5
64   ██ │▓▓▓▓▓▓▓│▓▓▓▓▓▓▓│                               │▓▓▓▓▓▓▓│ ██  fileiras 4-5  verde     3
80   ██ │▓▓▓▓▓▓▓│▓▓▓▓▓▓▓│                               │▓▓▓▓▓▓▓│ ██  fileiras 6-7  amarelo   1
96   ██ │                                                         │ ██
     ██ │                      ■  bola 3 x 3 (cor 15)             │ ██
     ██ │                                                         │ ██
184  ██ │                 ▀▀▀▀▀▀▀▀  raquete 32 x 4 (cor 11)       │ ██
     ██ │                                                         │ ██
200  ┴┴─┴─────────── passou daqui: perdeu a bola ─────────────────┴─┴┴
```

As contas que definem a parede ficam todas em constantes no começo do fonte. Repare como elas se encaixam: 13 tijolos × 24 pixels = **312**, exatamente a largura entre as paredes (de x = 4 a x = 315). Cada tijolo é pintado com 23 × 7 pixels; a última coluna e a última linha ficam pretas, e é esse "rejunte" de um pixel que separa visualmente um tijolo do outro, sem custar nenhuma lógica a mais.

```asm fragmento titulo="As constantes da parede"
PAREDE_ESQ  EQU 4               ; o campo vai de x = 4 a 315
PAREDE_DIR  EQU 316
TETO        EQU 16              ; e de y = 16 para baixo
COLUNAS     EQU 13              ; 13 x 8 tijolos de 24 x 8 pixels
FILEIRAS    EQU 8
TIJ_LARG    EQU 24
TIJ_ALT     EQU 8
TIJ_TOPO    EQU 32              ; y da primeira fileira
RAQ_Y       EQU 184
RAQ_LARG    EQU 32
BOLA        EQU 3               ; a bola tem 3 x 3 pixels
FRAC        EQU 16              ; posição da bola em 1/16 de pixel
```

:::dica Por que constantes EQU e não números soltos?
Se um dia você quiser tijolos de 16 × 6 ou uma raquete mais larga, muda uma linha. O montador faz as contas (`PAREDE_DIR-RAQ_LARG`, `FILEIRAS*TIJ_ALT`) na hora de montar: nenhum ciclo é gasto em tempo de execução. Lembre só que constante e variável não podem ter o mesmo nome no montador do curso (ele não diferencia maiúsculas): por isso a constante é `RAQ_LARG` e a variável é `raq_x`.
:::

## O laço principal

O PAREDÃO segue o esqueleto que você viu nos [fundamentos](aula:aula32): um quadro por retraço vertical. No modo 13h a VGA desenha **70 quadros por segundo**, então tudo no jogo é medido em "por quadro": a raquete anda 4 pixels por quadro (280 pixels por segundo), a bola começa a 2 pixels por quadro.

```asm fragmento titulo="O laço do jogo"
@@quadro:
        CALL ESPERA_RETRACO     ; 1/70 s: o feixe acabou de chegar embaixo
        CALL APAGA_OBJETOS      ; tira a raquete e a bola da posição velha
        CALL MOVE_RAQUETE
        CALL MOVE_BOLA          ; aqui moram as colisões
        CALL DESENHA_OBJETOS    ; e desenha nas posições novas
        CALL SOM_ATUALIZA       ; desliga o bipe quando passar a hora
        CMP  teclas[SC_ESC], 1
        JE   @@desistiu
        CMP  vidas, 0
        JE   @@perdeu
        CMP  restantes, 0       ; acabaram os tijolos?
        JNE  @@quadro
        CALL PROXIMA_FASE
        JMP  @@quadro
```

A ordem **apagar → mover → desenhar** logo depois do retraço é o que evita o pisca-pisca: a VGA está desenhando a borda de baixo e voltando para o topo, e nesse intervalo o programa troca os poucos pixels que mudam. Os tijolos não são redesenhados a cada quadro: eles só mudam quando um quebra, e aí `QUEBRA` apaga só aquele tijolo. Redesenhar a tela inteira 70 vezes por segundo, num 8088 de 4,77 MHz, seria impossível; trocar só o que mudou é o segredo de quase todo jogo de PC da época.

```diagrama titulo="Um quadro do PAREDÃO (1/70 de segundo)"
   retraço ──► apaga raquete e bola ──► move raquete (setas)
                                              │
                                              ▼
              ┌──────────────────── move bola ────────────────────┐
              │ eixo x: anda; bateu na parede? vira; tijolo? quebra│
              │ eixo y: anda; teto? vira; caiu? perde a bola;      │
              │         raquete? sobe com ângulo; tijolo? quebra   │
              └────────────────────────────────────────────────────┘
                                              │
                                              ▼
   desenha raquete e bola ──► som ──► ESC? vidas? tijolos? ──► próximo quadro
```

## A bola em ponto fixo

Uma bola que só anda em pixels inteiros só tem poucas direções possíveis: (1, 1), (2, 1), (1, 2)... e uma velocidade de "2 e meio" pixels por quadro é impossível. A solução dos jogos dos anos 80 e 90 é o **ponto fixo** que você viu na [Aula 30](aula:aula30): a posição e a velocidade da bola são guardadas em **dezesseis avos de pixel**. A bola em x = 100 tem `bola_x = 1600`; uma velocidade de 2,5 pixels por quadro é `40`.

```diagrama titulo="bola_x em ponto fixo 12.4"
   bit: 15                         4 3       0
        ┌─────────────────────────┬──────────┐
        │   pixel inteiro (0-319) │ fração   │     bola_x = 1613 = 100 + 13/16
        └─────────────────────────┴──────────┘
           1613 SAR 4 = 100  →  é o pixel que se desenha
```

Para desenhar e para testar colisões, o jogo precisa do pixel inteiro: basta deslocar 4 bits para a direita. O detalhe importante é usar **SAR** e não SHR. Durante uma colisão a bola pode estar, por um instante, um pouco à esquerda de x = 0 ou acima de y = 0, e então a posição é negativa. `SAR` copia o bit de sinal e mantém o número negativo; `SHR` transformaria −3 num pixel lá perto de 4.000.

```asm fragmento titulo="BOLA_PIXELS: de 1/16 de pixel para pixel"
BOLA_PIXELS PROC
        MOV  CL, 4
        MOV  BX, bola_x
        SAR  BX, CL             ; BX = x em pixels (com sinal)
        MOV  DX, bola_y
        SAR  DX, CL             ; DX = y em pixels
        RET
BOLA_PIXELS ENDP
```

:::cpu SAR com CL custa caro no 8088
`SAR reg,CL` gasta 8 + 4 ciclos por bit no 8086: 24 ciclos para 4 bits. Quatro `SAR reg,1` seguidos gastam 8 ciclos (mais 8 bytes de código). Num jogo que chama `BOLA_PIXELS` três ou quatro vezes por quadro, a diferença é desprezível; num laço que desenha milhares de pixels, não seria. Escolha a forma que deixa o código mais claro onde o tempo não importa.
:::

## Colisão: um eixo de cada vez

O problema mais famoso do Breakout é este: a bola bateu num tijolo. Ela deve inverter a velocidade **horizontal** (bateu de lado) ou a **vertical** (bateu por baixo ou por cima)? Calcular o ponto exato de impacto exigiria geometria com frações. A solução clássica, usada aqui, é muito mais simples: **mover a bola um eixo de cada vez**.

1. Soma `bola_vx` em x. Se a bola, na posição nova, encostou numa parede ou num tijolo, foi um choque **horizontal**: inverte `bola_vx`.
2. Depois soma `bola_vy` em y. Se agora encostou em algo, o choque foi **vertical**: inverte `bola_vy`.

```diagrama titulo="Por que separar os eixos resolve o problema"
     bola chegando de baixo, pela diagonal
                                          ┌───────────┐
              passo em x: ■──►  livre     │  tijolo   │
                                          └───────────┘
              passo em y: ■                   ▲
                          │ entra no tijolo ──┘    → inverte vy (bateu por baixo)

     bola chegando de lado
         ┌───────────┐
         │  tijolo   │ ◄──■  passo em x já encosta → inverte vx (bateu de lado)
         └───────────┘
```

Como a bola anda no máximo 3 pixels por quadro e o tijolo tem 8 de altura e 24 de largura, ela nunca "atravessa" um tijolo inteiro de um quadro para o outro. Essa é uma regra importante em jogos com colisão por posição: **o objeto não pode andar, em um passo, mais do que a espessura do que ele deveria acertar**. Por isso a aceleração do PAREDÃO para em 3 pixels por quadro.

E para saber se encostou, não é preciso testar a bola inteira: basta olhar os **dois cantos da borda da frente**. Indo para a direita, a borda da frente é a coluna x + 2 (a bola tem 3 pixels); indo para a esquerda, é a coluna x. Os dois cantos são o de cima (y) e o de baixo (y + 2).

```asm fragmento titulo="MOVE_BOLA: o eixo x"
        MOV  AX, bola_x
        ADD  AX, bola_vx
        MOV  bola_x, AX
        CALL BOLA_PIXELS        ; BX = x, DX = y em pixels
        CMP  BX, PAREDE_ESQ     ; bateu na parede da esquerda?
        JGE  @@nao_esq
        MOV  bola_x, PAREDE_ESQ*FRAC   ; encosta a bola na parede
        CALL VIRA_X                    ; NEG bola_vx e um bipe
        JMP  SHORT @@eixo_y
@@nao_esq:
        CMP  BX, PAREDE_DIR-BOLA       ; e na da direita?
        JLE  @@nao_dir
        MOV  bola_x, (PAREDE_DIR-BOLA)*FRAC
        CALL VIRA_X
        JMP  SHORT @@eixo_y
@@nao_dir:
        CMP  bola_vx, 0         ; a borda da frente da bola
        JL   @@frente_x
        ADD  BX, BOLA-1
@@frente_x:
        CALL TIJOLO_EM          ; o canto de cima...
        JC   @@bateu_x
        ADD  DX, BOLA-1
        CALL TIJOLO_EM          ; ...ou o de baixo
        JNC  @@eixo_y
@@bateu_x:
        CALL QUEBRA
        NEG  bola_vx            ; o rebote é só trocar o sinal
```

Dois detalhes que fazem diferença:

- Quando bate na parede, a bola é **encostada** de volta (`MOV bola_x, PAREDE_ESQ*FRAC`) antes de inverter. Sem isso, uma bola que entrou 2 pixels na parede poderia, no quadro seguinte, ainda estar dentro dela, inverter de novo e ficar presa tremendo.
- O rebote em si é uma única instrução: **NEG** troca o sinal da velocidade. +24 vira −24 (FFE8h em complemento de dois, como na [Aula 22](aula:aula22)), e a bola volta pelo mesmo ângulo.

O eixo y é igual, com três casos a mais: o **teto** (inverte), o **chão** (y ≥ 200: perdeu a bola) e a **raquete**, que só é testada quando a bola está descendo.

:::atencao Comparações com sinal
Posições e velocidades aqui podem ser negativas, então as comparações usam **JL, JG, JLE, JGE** (com sinal) e não JB/JA. `CMP bola_vx, 0` seguido de `JL` pergunta "a bola vai para a esquerda?". Com `JB`, nenhum número seria "abaixo de zero" e a bola sempre olharia a borda errada. Já `TIJOLO_EM` usa `JB` de propósito, como você vai ver.
:::

## Que tijolo está neste pixel?

A parede é guardada como um vetor de **104 bytes** (13 × 8), `tijolos`, um byte por tijolo: 1 = inteiro, 0 = quebrado. O índice do tijolo da fileira f e coluna c é `f × 13 + c`. Para saber se um pixel (x, y) está dentro de um tijolo, a rotina faz o caminho inverso:

```diagrama titulo="Do pixel ao índice do tijolo"
   coluna  = (x - 4)  / 24        (0 a 12)
   fileira = (y - 32) / 8         (0 a 7)       ÷8 é só SHR 3
   índice  = fileira × 13 + coluna

   exemplo: pixel (100, 50)
       coluna  = 96 / 24 = 4
       fileira = 18 / 8  = 2
       índice  = 2 × 13 + 4 = 30      → tijolos[30]
```

```asm fragmento titulo="TIJOLO_EM: CF = 1 se o pixel (BX, DX) está num tijolo inteiro"
TIJOLO_EM PROC
        PUSH AX
        PUSH BX
        PUSH DX
        SUB  DX, TIJ_TOPO
        JB   @@nao              ; acima da parede
        CMP  DX, FILEIRAS*TIJ_ALT
        JAE  @@nao              ; abaixo
        SUB  BX, PAREDE_ESQ
        JB   @@nao
        MOV  AX, BX
        MOV  BL, TIJ_LARG
        DIV  BL                 ; AL = coluna
        CMP  AL, COLUNAS
        JAE  @@nao
        MOV  BL, AL
        MOV  AX, DX
        MOV  CL, 3
        SHR  AX, CL             ; fileira = y / 8
        MOV  AH, COLUNAS
        MUL  AH                 ; AX = fileira * 13
        XOR  BH, BH
        ADD  AX, BX
        MOV  SI, AX
        CMP  tijolos[SI], 0
        JE   @@nao
        STC
        JMP  SHORT @@fim
@@nao:  CLC
@@fim:  POP  DX
        POP  BX
        POP  AX
        RET
TIJOLO_EM ENDP
```

Repare no truque de `SUB DX, TIJ_TOPO` seguido de `JB`: a subtração já serve de comparação. Se y era menor que 32, a conta "pede emprestado" e liga o CF, e `JB` (que é o mesmo que JC) sai. Se não saiu, DX já é a distância até o topo da parede, pronta para a divisão. Duas perguntas e uma conta em duas instruções.

Por que dividir por 24 com `DIV` e por 8 com `SHR`? Porque 8 é potência de 2 e 24 não. `DIV` de 8 bits custa uns 80 ciclos no 8086; numa rotina chamada no máximo quatro vezes por quadro, não faz falta otimizar. Uma alternativa da época seria uma **tabela** de 312 bytes com a coluna de cada x: memória em troca de tempo, como a tabela `linhas` dos jogos de modo texto.

O resultado vem no **carry flag**, a convenção da BIOS e do DOS: CF = 1 é "sim" (ou erro, no DOS). Quem chama testa com `JC`/`JNC`, sem gastar um registrador com a resposta.

## Quebrar um tijolo

`QUEBRA` recebe em SI o índice achado por `TIJOLO_EM` e faz tudo o que acontece quando a bola acerta: zera o byte, diminui `restantes`, soma os pontos, toca a nota da fileira, apaga o tijolo da tela e decide se a bola acelera.

```asm fragmento titulo="QUEBRA: pontos, som e aceleração"
        MOV  tijolos[SI], 0
        DEC  restantes
        MOV  AX, SI             ; fileira e coluna de volta
        MOV  BL, COLUNAS
        DIV  BL                 ; AL = fileira, AH = coluna
        ...
        MOV  AL, pontos_fileira[BX]    ; 7, 7, 5, 5, 3, 3, 1, 1
        ...
        INC  toques             ; a bola acelera no 4º e no 12º toque
        CMP  toques, 4
        JE   @@acelera
        CMP  toques, 12
        JNE  @@fim
@@acelera:
        ADD  velocidade, 8      ; + meio pixel por quadro
        MOV  AX, velocidade
        CMP  bola_vy, 0
        JG   @@desce
        NEG  AX                 ; mantém o sentido em que a bola ia
@@desce:
        MOV  bola_vy, AX
```

O caminho de volta, do índice para (fileira, coluna), é uma única `DIV`: o quociente é a fileira e o **resto** é a coluna. É o inverso exato de `fileira × 13 + coluna`, e AH e AL saem prontos para `PINTA_TIJOLO`.

As três tabelas por fileira (`cores_fileira`, `pontos_fileira`, `notas_fileira`) são um exemplo de **dados no lugar de código**: em vez de uma cadeia de `CMP` para decidir "fileira 0 ou 1 vale 7, 2 ou 3 vale 5...", o jogo indexa um vetor. Mudar a pontuação é mudar um byte.

## O ângulo pela raquete

Se a raquete só invertesse `bola_vy`, a bola repetiria o mesmo caminho para sempre e o jogador não teria controle nenhum. No Breakout, **onde** a bola bate na raquete decide para onde ela vai: no centro ela sobe quase reta; perto das pontas sai bem inclinada. O PAREDÃO calcula a distância entre o centro da bola e o centro da raquete e usa essa distância como a nova velocidade horizontal.

```diagrama titulo="A velocidade horizontal depende do ponto de contato"
                 vx = -34    vx = -16     vx = 0     vx = +16    vx = +34
                    ↖          ↖           ↑           ↗          ↗
                 ┌────────────────────────────────────────────────────┐
     raquete:    │ -17      -8            0            +8        +17 │
                 └────────────────────────────────────────────────────┘
                  ponta esquerda        centro           ponta direita

   distância = (x da bola + 1) - (raq_x + 16)        de -17 a +17
   vx        = distância × 2     (em 1/16 de pixel: de -2,1 a +2,1 px por quadro)
   vy        = -velocidade       (sempre para cima)
```

```asm fragmento titulo="RAQUETE: o ângulo do rebote"
        ; distância do centro da bola ao centro da raquete: -17 a +17
        MOV  AX, BX
        ADD  AX, BOLA/2
        SUB  AX, raq_x
        SUB  AX, RAQ_LARG/2
        SHL  AX, 1              ; vx = distância * 2 (em 1/16 de pixel)
        MOV  bola_vx, AX
        MOV  AX, velocidade
        NEG  AX
        MOV  bola_vy, AX        ; sempre para cima
        MOV  bola_y, (RAQ_Y-BOLA)*FRAC   ; desgruda da raquete
```

`SHL AX,1` funciona também com números negativos: −17 × 2 = −34, porque deslocar para a esquerda é multiplicar por 2 em complemento de dois enquanto o resultado couber. Repare que a velocidade **vertical** não muda com o ângulo: a bola sempre leva o mesmo tempo para subir até a parede, e o jogo fica previsível no ritmo e variado na direção. Um jogo mais "realista" normalizaria o vetor para a velocidade total ser constante; o Breakout original não fazia isso, e o nosso também não.

:::dica A bola grudada
Enquanto `presa` vale 1, `MOVE_BOLA` só chama `GRUDA_BOLA`, que copia o x da raquete para a bola. É assim no começo de cada vida: o jogador escolhe onde lançar e aperta ESPAÇO. A cápsula "catch" do Arkanoid é exatamente esse estado, ligado de novo quando a bola toca a raquete.
:::

## Fases desenhadas em bits

As três paredes do jogo ocupam só **48 bytes**: cada fileira é uma word em que cada bit diz se há tijolo. Como são 13 colunas, sobram 3 bits; o bit 12 é a coluna 0 e o bit 0 é a coluna 12, e o desenho no fonte fica **parecido com a parede de verdade**:

```asm fragmento titulo="A pirâmide da fase 2"
            DW 0000001000000b, 0000011100000b, 0000111110000b, 0001111111000b
            DW 0011111111100b, 0111111111110b, 1111111111111b, 1111111111111b
```

`MONTA_FASE` escolhe o desenho com `fase mod 3` (uma `DIV` por 3, usando o resto em AH) e "desembrulha" cada word nos 13 bytes da fileira. O truque é empurrar os bits para fora pela esquerda com `SHL`: o bit que sai cai no **carry flag**, e `JNC` decide se aquele tijolo existe.

```asm fragmento titulo="MONTA_FASE: de bits para bytes"
@@fileira:
        LODSW                   ; AX = desenho da fileira
        PUSH CX
        MOV  CL, 3
        SHL  AX, CL             ; bit 12 vai para o bit 15
        MOV  CX, COLUNAS
@@coluna:
        SHL  AX, 1              ; o bit da coluna cai no CF
        MOV  BYTE PTR tijolos[DI], 0
        JNC  @@prox             ; (MOV não mexe nas flags)
        MOV  BYTE PTR tijolos[DI], 1
        INC  restantes
@@prox: INC  DI
        LOOP @@coluna
        POP  CX
        LOOP @@fileira
```

O `MOV` entre o `SHL` e o `JNC` não estraga o carry: no 8086, **MOV nunca altera flags**. Esse tipo de intercalação era comum para aproveitar o tempo e economizar um salto. E o `PUSH CX`/`POP CX` em volta do laço interno é o jeito de ter dois `LOOP` aninhados com um só registrador contador.

:::anos90 Fases em disquete
Jogos como o Arkanoid de PC tinham dezenas de fases. Guardar cada uma como uma tela pronta seria impensável num disquete de 360 KB; guardar como bits ou como uma lista de códigos de tijolo (cor e dureza) cabia em poucos bytes por fase. Muitos jogos shareware tinham inclusive um **editor de fases**, e os fãs trocavam arquivos de fases pelas BBS.
:::

## Desenhar retângulos no modo 13h

Tudo no PAREDÃO é retângulo: tijolos, raquete, bola, paredes, até a faixa do placar sendo apagada. Uma única rotina, `RETANGULO`, faz todos eles, a mesma usada no Invasores. Ela recebe a cor em AL, o canto em BX (x) e DX (y), a largura em CX e a altura em SI.

```asm fragmento titulo="ENDERECO e RETANGULO"
; ENDERECO: DI = y * 320 + x   (y * 320 = y * 256 + y * 64)
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL             ; DX = y * 256
        XOR  DL, DL
        SHL  DI, 1              ; seis SHL de 1 = y * 64
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        SHL  DI, 1
        ADD  DI, DX             ; y * 64 + y * 256
        ADD  DI, BX
        POP  DX
        RET
ENDERECO ENDP

RETANGULO PROC
        ...
        CALL ENDERECO
        MOV  DX, CX             ; DX = largura
@@linha:
        MOV  CX, DX
        REP  STOSB              ; uma linha do retângulo
        SUB  DI, DX             ; volta ao começo da linha...
        ADD  DI, 320            ; ...e desce uma
        DEC  SI
        JNZ  @@linha
        ...
```

A multiplicação por 320 sem `MUL` é o truque clássico do modo 13h: 320 = 256 + 64. Multiplicar por 256 é só mover o byte baixo para o alto (`MOV DH,DL` / `XOR DL,DL`), e por 64 são seis deslocamentos. No 8088, isso é várias vezes mais rápido que um `MUL` de 16 bits (118 a 133 ciclos). O [capítulo de vídeo do livro](livro:cap03) descreve o modo 13h e a função 00h da INT 10h que o liga; o [capítulo 20](livro:cap20) mostra por que os jogos escreviam direto em A000h em vez de usar a função 0Ch (um pixel por chamada de BIOS).

## Texto no modo gráfico

O placar usa a própria BIOS: no modo 13h, a função **0Eh da INT 10h** (teletipo) desenha os caracteres da fonte da ROM, 8 × 8 pixels, na cor que vai em BL. A tela vira uma grade de 40 × 25 caracteres. É lento (cada letra é uma chamada de interrupção que pinta 64 pixels), mas o placar só muda quando um tijolo quebra.

```asm fragmento titulo="ESCREVE_TXT: posiciona o cursor e escreve uma string terminada em 0"
ESCREVE_TXT PROC
        MOV  AH, 02h            ; cursor na linha DH, coluna DL
        XOR  BH, BH
        INT  10h
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh            ; teletipo: AL = caractere, BL = cor
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE_TXT ENDP
```

`MOSTRA_PLACAR` apaga primeiro uma faixa de 320 × 8 pixels com `RETANGULO` (senão, ao trocar "100" por "99" sobraria um zero) e depois escreve os textos e os números. `ESCREVE_NUM` é a conversão de binário para decimal por divisões sucessivas que você conhece desde a [Aula 21](aula:aula21): divide por 10, empilha o resto, repete até o quociente ser zero e desempilha imprimindo.

## Teclado: a tabela de teclas apertadas

O PAREDÃO precisa saber se a seta **está apertada** em cada quadro, não se ela "foi digitada". A INT 16h do [capítulo do teclado](livro:cap06) entrega caracteres com repetição automática, depois de um atraso: a raquete andaria aos trancos. Por isso o jogo instala a sua própria **INT 9**, que mantém uma tabela de 128 bytes, um por scan code: 1 enquanto a tecla está apertada, 0 depois que ela é solta.

```asm fragmento titulo="NOVA_INT9: um byte por tecla"
NOVA_INT9 PROC FAR
        PUSH AX
        PUSH BX
        IN   AL, 60h            ; scan code: bit 7 = 1 se a tecla foi solta
        MOV  BL, AL
        AND  BX, 007Fh          ; BX = o código sem o bit 7
        SHL  AL, 1              ; bit 7 vai para o CF
        CMC                     ; CF = 1 se apertou
        MOV  AL, 0
        ADC  AL, 0              ; AL = CF
        MOV  CS:teclas[BX], AL
        MOV  AL, 20h            ; EOI para o PIC
        OUT  20h, AL
        POP  BX
        POP  AX
        IRET
NOVA_INT9 ENDP
```

A sequência `SHL` / `CMC` / `MOV AL,0` / `ADC AL,0` transforma o bit 7 do scan code (1 = soltou) em 0 ou 1 sem nenhum salto. O `CS:` antes de `teclas` existe porque a interrupção pode chegar a qualquer momento, com DS apontando para qualquer lugar; num .COM o código e os dados estão no mesmo segmento, então CS serve. Os [fundamentos](aula:aula32) e o [capítulo 20 do livro](livro:cap20) explicam a instalação com as funções 35h e 25h da INT 21h e por que é obrigatório devolver o vetor antigo antes de sair.

Com a tabela, mover a raquete é trivial e as duas setas podem estar apertadas ao mesmo tempo (uma cancela a outra):

```asm fragmento titulo="MOVE_RAQUETE"
        MOV  AX, raq_x
        CMP  teclas[SC_ESQ], 1
        JNE  @@dir
        SUB  AX, RAQ_VEL
@@dir:  CMP  teclas[SC_DIR], 1
        JNE  @@limita
        ADD  AX, RAQ_VEL
@@limita:                       ; e não deixa passar das paredes
        CMP  AX, PAREDE_ESQ
        JGE  @@max
        MOV  AX, PAREDE_ESQ
@@max:  CMP  AX, PAREDE_DIR-RAQ_LARG
        JLE  @@ok
        MOV  AX, PAREDE_DIR-RAQ_LARG
@@ok:   MOV  raq_x, AX
```

`ESPERA_SOLTAR` é o complemento: espera todas as 128 entradas da tabela voltarem a zero. Sem ela, o mesmo ESPAÇO que começou o jogo na tela de título lançaria a bola no primeiro quadro.

## Som que não para o jogo

Cada evento tem um bipe: parede (divisor 2400), raquete (4000), cada fileira de tijolos a sua nota (de 1200 a 2400) e um som grave e longo quando a bola cai (9000). O jogo não pode parar para esperar um som terminar, então `SOM_LIGA` programa o canal 2 do PIT, liga o alto-falante e **anota a hora de desligar** (o tique atual da BIOS mais CL tiques). A cada quadro, `SOM_ATUALIZA` compara o relógio com essa hora e desliga quando passar. É o mesmo esquema do [PIT na Aula 29](aula:aula29), sem nenhuma espera.

```diagrama titulo="Um bipe sem travar o jogo"
  quadro:   1     2     3     4     5     6 ...  (70 por segundo)
  tique:    ├─────────────── 1 tique da BIOS (55 ms) ──────────┤
            │                                                   │
  SOM_LIGA ─┘ liga o som, som_fim = tique + CL + 1              │
  SOM_ATUALIZA em cada quadro: tique < som_fim? deixa tocando   │
                                       tique ≥ som_fim? desliga ┘
```

O relógio é lido com a função 00h da INT 1Ah, descrita no [capítulo de tempo do livro](livro:cap07).

```quiz
? A posição da bola é guardada em 1/16 de pixel. Por que `BOLA_PIXELS` usa SAR e não SHR?
- SAR é mais rápido que SHR no 8086
+ A posição pode ficar negativa por um instante e SAR preserva o sinal
- SHR não aceita deslocamento por CL
- Para arredondar para o pixel mais próximo
> SAR copia o bit 15 nos bits que entram pela esquerda. Com SHR, um x de −3 pixels viraria um número enorme e a bola seria desenhada fora do lugar.

? Por que mover a bola um eixo de cada vez?
- Porque o 8086 não soma duas words na mesma instrução
+ Para saber se o choque foi horizontal ou vertical sem calcular o ponto de impacto
- Para a bola andar mais devagar
- Para gastar menos memória de vídeo
> Se a colisão aparece no passo de x, foi de lado: inverte vx. Se aparece no passo de y, foi por cima ou por baixo: inverte vy.

? Qual é o índice em `tijolos` do tijolo que contém o pixel (200, 70)?
- 47
+ 60
- 64
- 104
> Coluna = (200 − 4) / 24 = 8; fileira = (70 − 32) / 8 = 4; índice = 4 × 13 + 8 = 60.

? A bola bate na raquete exatamente no centro. O que acontece?
+ Sobe reta: vx fica 0
- Volta pelo mesmo ângulo em que chegou
- Sai com o ângulo máximo para a direita
- Acelera
> A distância entre o centro da bola e o da raquete é 0, então vx = 0 × 2 = 0, e vy = −velocidade.

? O que impede a bola de atravessar um tijolo sem bater?
- A rotina TIJOLO_EM testa todos os 104 tijolos
+ A bola anda no máximo 3 pixels por quadro, menos que a altura do tijolo (8)
- A INT 9 interrompe a bola
- O retraço vertical
> Colisão por posição só funciona se o passo for menor que a espessura do alvo. Por isso a aceleração para em 3 pixels por quadro.

? `MONTA_FASE` faz `SHL AX,1`, depois `MOV BYTE PTR tijolos[DI],0` e só então `JNC`. Isso funciona?
+ Sim: MOV não altera nenhuma flag
- Não: o MOV zera o CF
- Só se DI for par
- Só no 80286
> No 8086, MOV, PUSH, POP, LEA, XCHG e os saltos não mexem nas flags. O CF do SHL chega intacto ao JNC.
```

## Ideias que vêm do fliperama

Algumas regras do Breakout original ficaram de fora do PAREDÃO para manter o código curto, e são boas extensões (veja os desafios no fim):

- No original, a bola também acelera quando acerta a **primeira fileira laranja** e a **primeira vermelha**, não só por contagem de toques.
- Quando a bola bate no **teto** pela primeira vez, a raquete **encolhe pela metade**. É o que torna a segunda metade da parede tão difícil.
- O Breakout tinha só duas paredes por partida; o Arkanoid introduziu fases com desenhos, tijolos de vários toques (prateados) e indestrutíveis (dourados).

## O PAREDÃO completo

Aperte **▶ Jogar**: ESPAÇO começa e lança a bola, as setas movem a raquete, ESC volta para o título (e ESC de novo sai).

```asm jogo titulo="PAREDAO.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  PAREDAO.ASM  -  derrube a parede de tijolos (modo 13h)       ║
; ║  Curso Assembly 8086, aula 37                                 ║
; ║                                                               ║
; ║  Programa .COM: TASM PAREDAO / TLINK /t PAREDAO               ║
; ║  Setas movem a raquete, ESPAÇO lança a bola, ESC sai.         ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; Constantes
; ---------------------------------------------------------------
PAREDE_ESQ  EQU 4               ; o campo vai de x = 4 a 315
PAREDE_DIR  EQU 316
TETO        EQU 16              ; e de y = 16 para baixo
COLUNAS     EQU 13              ; 13 x 8 tijolos de 24 x 8 pixels
FILEIRAS    EQU 8
TIJ_LARG    EQU 24
TIJ_ALT     EQU 8
TIJ_TOPO    EQU 32              ; y da primeira fileira
RAQ_Y       EQU 184
RAQ_LARG    EQU 32
RAQ_ALT     EQU 4
RAQ_VEL     EQU 4
BOLA        EQU 3               ; a bola tem 3 x 3 pixels
FRAC        EQU 16              ; posição da bola em 1/16 de pixel

COR_PAREDE  EQU 8
COR_RAQ     EQU 11
COR_BOLA    EQU 15

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
        MOV  ES, AX
        CALL INSTALA_TECLADO

@@menu: CALL TELA_TITULO        ; CF = 1: sair
        JC   @@sair
        CALL NOVA_PARTIDA
@@quadro:
        CALL ESPERA_RETRACO
        CALL APAGA_OBJETOS
        CALL MOVE_RAQUETE
        CALL MOVE_BOLA
        CALL DESENHA_OBJETOS
        CALL SOM_ATUALIZA
        CMP  teclas[SC_ESC], 1
        JE   @@desistiu
        CMP  vidas, 0
        JE   @@perdeu
        CMP  restantes, 0
        JNE  @@quadro
        CALL PROXIMA_FASE
        JMP  @@quadro
@@perdeu:
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
; Partida e fases
; ===============================================================
NOVA_PARTIDA PROC
        MOV  pontos, 0
        MOV  vidas, 3
        MOV  fase, 0
        CALL MONTA_FASE
        RET
NOVA_PARTIDA ENDP

; MONTA_FASE: a parede da fase atual sai de uma tabela de desenhos.
; Cada fileira é uma word: o bit 12 é a coluna 0 ... o bit 0 é a 12.
MONTA_FASE PROC
        CALL LIMPA_TELA
        MOV  AL, fase
        MOV  BL, 3              ; são 3 desenhos, que se repetem
        XOR  AH, AH
        DIV  BL                 ; AH = fase mod 3
        MOV  AL, AH
        MOV  BL, FILEIRAS*2
        MUL  BL
        MOV  SI, OFFSET desenhos
        ADD  SI, AX             ; SI = as 8 words do desenho
        XOR  DI, DI             ; DI = índice em tijolos[]
        MOV  restantes, 0
        MOV  CX, FILEIRAS
@@fileira:
        LODSW
        PUSH CX
        MOV  CL, 3
        SHL  AX, CL             ; bit 12 vai para o bit 15
        MOV  CX, COLUNAS
@@coluna:
        SHL  AX, 1
        MOV  BYTE PTR tijolos[DI], 0
        JNC  @@prox
        MOV  BYTE PTR tijolos[DI], 1
        INC  restantes
@@prox: INC  DI
        LOOP @@coluna
        POP  CX
        LOOP @@fileira
        CALL DESENHA_PAREDES
        CALL DESENHA_TIJOLOS
        CALL MOSTRA_PLACAR
        MOV  raq_x, 160-RAQ_LARG/2
        MOV  raq_desenhada, 160-RAQ_LARG/2
        MOV  velocidade, 2*FRAC
        MOV  toques, 0
        CALL PREPARA_SAQUE
        RET
MONTA_FASE ENDP

PROXIMA_FASE PROC
        MOV  CX, 70
@@espera:
        CALL ESPERA_RETRACO
        CALL SOM_ATUALIZA
        LOOP @@espera
        INC  fase
        CALL MONTA_FASE
        RET
PROXIMA_FASE ENDP

; PREPARA_SAQUE: a bola fica grudada na raquete até apertar ESPAÇO
PREPARA_SAQUE PROC
        MOV  presa, 1
        MOV  bola_vx, FRAC      ; sai para a direita, para cima
        MOV  AX, velocidade
        NEG  AX
        MOV  bola_vy, AX
        CALL GRUDA_BOLA
        RET
PREPARA_SAQUE ENDP

GRUDA_BOLA PROC
        MOV  AX, raq_x
        ADD  AX, RAQ_LARG/2-1
        MOV  CL, 4
        SHL  AX, CL
        MOV  bola_x, AX
        MOV  bola_y, (RAQ_Y-BOLA-1)*FRAC
        RET
GRUDA_BOLA ENDP

; ===============================================================
; Movimento
; ===============================================================
MOVE_RAQUETE PROC
        MOV  AX, raq_x
        CMP  teclas[SC_ESQ], 1
        JNE  @@dir
        SUB  AX, RAQ_VEL
@@dir:  CMP  teclas[SC_DIR], 1
        JNE  @@limita
        ADD  AX, RAQ_VEL
@@limita:
        CMP  AX, PAREDE_ESQ
        JGE  @@max
        MOV  AX, PAREDE_ESQ
@@max:  CMP  AX, PAREDE_DIR-RAQ_LARG
        JLE  @@ok
        MOV  AX, PAREDE_DIR-RAQ_LARG
@@ok:   MOV  raq_x, AX
        RET
MOVE_RAQUETE ENDP

; MOVE_BOLA: um eixo de cada vez. Primeiro anda em x e vê se bateu
; (parede ou tijolo: inverte vx); depois anda em y e faz o mesmo.
; Separar os eixos resolve sozinho a pergunta "bateu de lado ou por baixo?".
MOVE_BOLA PROC
        CMP  presa, 0
        JE   @@solta
        CALL GRUDA_BOLA
        CMP  teclas[SC_ESPACO], 1
        JNE  @@fim
        MOV  presa, 0
@@fim:  RET
@@solta:
        ; ---- eixo x ----
        MOV  AX, bola_x
        ADD  AX, bola_vx
        MOV  bola_x, AX
        CALL BOLA_PIXELS        ; BX = x, DX = y em pixels
        CMP  BX, PAREDE_ESQ
        JGE  @@nao_esq
        MOV  bola_x, PAREDE_ESQ*FRAC
        CALL VIRA_X
        JMP  SHORT @@eixo_y
@@nao_esq:
        CMP  BX, PAREDE_DIR-BOLA
        JLE  @@nao_dir
        MOV  bola_x, (PAREDE_DIR-BOLA)*FRAC
        CALL VIRA_X
        JMP  SHORT @@eixo_y
@@nao_dir:
        CMP  bola_vx, 0         ; a borda da frente da bola
        JL   @@frente_x
        ADD  BX, BOLA-1
@@frente_x:
        CALL TIJOLO_EM          ; o canto de cima...
        JC   @@bateu_x
        ADD  DX, BOLA-1
        CALL TIJOLO_EM          ; ...ou o de baixo
        JNC  @@eixo_y
@@bateu_x:
        CALL QUEBRA
        NEG  bola_vx
        ; ---- eixo y ----
@@eixo_y:
        MOV  AX, bola_y
        ADD  AX, bola_vy
        MOV  bola_y, AX
        CALL BOLA_PIXELS
        CMP  DX, TETO
        JGE  @@nao_teto
        MOV  bola_y, TETO*FRAC
        NEG  bola_vy
        CALL BIP_PAREDE
        RET
@@nao_teto:
        CMP  DX, 200            ; caiu lá embaixo?
        JL   @@nao_caiu
        JMP  PERDE_BOLA
@@nao_caiu:
        CMP  bola_vy, 0
        JL   @@subindo
        CALL RAQUETE            ; descendo: pode ser a raquete
        JNC  @@frente_y
        RET
@@subindo:
@@frente_y:
        CMP  bola_vy, 0
        JL   @@cima
        ADD  DX, BOLA-1
@@cima: CALL TIJOLO_EM          ; canto esquerdo...
        JC   @@bateu_y
        ADD  BX, BOLA-1
        CALL TIJOLO_EM          ; ...ou direito
        JNC  @@pronto
@@bateu_y:
        CALL QUEBRA
        NEG  bola_vy
@@pronto:
        RET
MOVE_BOLA ENDP

VIRA_X  PROC
        NEG  bola_vx
        CALL BIP_PAREDE
        RET
VIRA_X  ENDP

; BOLA_PIXELS: BX = x e DX = y da bola em pixels (SAR guarda o sinal)
BOLA_PIXELS PROC
        MOV  CL, 4
        MOV  BX, bola_x
        SAR  BX, CL
        MOV  DX, bola_y
        SAR  DX, CL
        RET
BOLA_PIXELS ENDP

; RAQUETE: a bola (BX, DX em pixels) desceu até a raquete? Se sim, ela
; volta para cima com um ângulo que depende de onde bateu: CF = 1.
RAQUETE PROC
        MOV  AX, DX
        ADD  AX, BOLA-1         ; parte de baixo da bola
        CMP  AX, RAQ_Y
        JL   @@nao
        CMP  AX, RAQ_Y+RAQ_ALT
        JGE  @@nao              ; já passou da raquete
        MOV  AX, BX
        ADD  AX, BOLA-1
        CMP  AX, raq_x          ; à esquerda dela?
        JL   @@nao
        MOV  AX, raq_x
        ADD  AX, RAQ_LARG
        CMP  BX, AX             ; à direita?
        JGE  @@nao
        ; distância do centro da bola ao centro da raquete: -17 a +17
        MOV  AX, BX
        ADD  AX, BOLA/2
        SUB  AX, raq_x
        SUB  AX, RAQ_LARG/2
        SHL  AX, 1              ; vx = distância * 2 (em 1/16 de pixel)
        MOV  bola_vx, AX
        MOV  AX, velocidade
        NEG  AX
        MOV  bola_vy, AX        ; sempre para cima
        MOV  bola_y, (RAQ_Y-BOLA)*FRAC
        MOV  BX, 4000
        MOV  CL, 1
        CALL SOM_LIGA
        STC
        RET
@@nao:  CLC
        RET
RAQUETE ENDP

; TIJOLO_EM: o pixel (BX, DX) está dentro de um tijolo inteiro?
; CF = 1 e SI = índice dele em tijolos[]. BX e DX não mudam.
TIJOLO_EM PROC
        PUSH AX
        PUSH BX
        PUSH DX
        SUB  DX, TIJ_TOPO
        JB   @@nao              ; acima da parede
        CMP  DX, FILEIRAS*TIJ_ALT
        JAE  @@nao              ; abaixo
        SUB  BX, PAREDE_ESQ
        JB   @@nao
        MOV  AX, BX
        MOV  BL, TIJ_LARG
        DIV  BL                 ; AL = coluna
        CMP  AL, COLUNAS
        JAE  @@nao
        MOV  BL, AL
        MOV  AX, DX
        MOV  CL, 3
        SHR  AX, CL             ; fileira = y / 8
        MOV  AH, COLUNAS
        MUL  AH                 ; AX = fileira * 13
        XOR  BH, BH
        ADD  AX, BX
        MOV  SI, AX
        CMP  tijolos[SI], 0
        JE   @@nao
        STC
        JMP  SHORT @@fim
@@nao:  CLC
@@fim:  POP  DX
        POP  BX
        POP  AX
        RET
TIJOLO_EM ENDP

; QUEBRA: tira o tijolo SI, apaga, soma os pontos e acelera a bola
QUEBRA  PROC
        PUSH BX
        PUSH DX
        MOV  tijolos[SI], 0
        DEC  restantes
        MOV  AX, SI             ; fileira e coluna de volta
        MOV  BL, COLUNAS
        DIV  BL                 ; AL = fileira, AH = coluna
        PUSH AX
        MOV  BL, AL
        XOR  BH, BH
        MOV  AL, pontos_fileira[BX]
        XOR  AH, AH
        ADD  pontos, AX
        SHL  BX, 1
        MOV  BX, notas_fileira[BX]   ; cada fileira tem a sua nota
        MOV  CL, 1
        CALL SOM_LIGA
        POP  AX
        XOR  CL, CL             ; cor 0: apaga
        CALL PINTA_TIJOLO
        CALL MOSTRA_PLACAR
        INC  toques             ; a bola acelera no 4º e no 12º toque
        CMP  toques, 4
        JE   @@acelera
        CMP  toques, 12
        JNE  @@fim
@@acelera:
        ADD  velocidade, 8
        MOV  AX, velocidade
        CMP  bola_vy, 0
        JG   @@desce
        NEG  AX
@@desce:
        MOV  bola_vy, AX
@@fim:  POP  DX
        POP  BX
        RET
QUEBRA  ENDP

; PERDE_BOLA: a bola passou da raquete
PERDE_BOLA PROC
        DEC  vidas
        CALL MOSTRA_PLACAR
        MOV  BX, 9000
        MOV  CL, 8
        CALL SOM_LIGA
        CMP  vidas, 0
        JE   @@fim
        MOV  velocidade, 2*FRAC
        MOV  toques, 0
        CALL PREPARA_SAQUE
@@fim:  RET
PERDE_BOLA ENDP

BIP_PAREDE PROC
        PUSH BX
        PUSH CX
        MOV  BX, 2400
        MOV  CL, 1
        CALL SOM_LIGA
        POP  CX
        POP  BX
        RET
BIP_PAREDE ENDP

; ===============================================================
; Desenho
; ===============================================================
APAGA_OBJETOS PROC
        XOR  AL, AL
        MOV  BX, raq_desenhada
        MOV  DX, RAQ_Y
        MOV  CX, RAQ_LARG
        MOV  SI, RAQ_ALT
        CALL RETANGULO
        MOV  BX, bola_xd
        MOV  DX, bola_yd
        MOV  CX, BOLA
        MOV  SI, BOLA
        CALL RETANGULO
        RET
APAGA_OBJETOS ENDP

DESENHA_OBJETOS PROC
        MOV  AL, COR_RAQ
        MOV  BX, raq_x
        MOV  raq_desenhada, BX
        MOV  DX, RAQ_Y
        MOV  CX, RAQ_LARG
        MOV  SI, RAQ_ALT
        CALL RETANGULO
        CMP  vidas, 0           ; sem vidas, não há bola
        JE   @@fim
        CALL BOLA_PIXELS
        CMP  DX, 200-BOLA       ; caindo para fora da tela: não desenha
        JG   @@fim
        MOV  bola_xd, BX
        MOV  bola_yd, DX
        MOV  AL, COR_BOLA
        MOV  CX, BOLA
        MOV  SI, BOLA
        CALL RETANGULO
@@fim:  RET
DESENHA_OBJETOS ENDP

; PINTA_TIJOLO: AL = fileira, AH = coluna, CL = 0 apaga, senão usa a
; cor da fileira. O tijolo tem 23 x 7: a última coluna e a última
; linha ficam pretas, e é isso que separa um tijolo do outro.
PINTA_TIJOLO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        MOV  DI, AX             ; guarda fileira e coluna
        MOV  BL, AL
        XOR  BH, BH
        OR   CL, CL
        JZ   @@cor
        MOV  CL, cores_fileira[BX]
@@cor:  MOV  AL, TIJ_ALT        ; y = topo + fileira * 8
        MUL  BL
        ADD  AX, TIJ_TOPO
        MOV  DX, AX
        MOV  AX, DI
        MOV  AL, AH             ; x = esquerda + coluna * 24
        MOV  BL, TIJ_LARG
        MUL  BL
        ADD  AX, PAREDE_ESQ
        MOV  BX, AX
        MOV  AL, CL
        MOV  CX, TIJ_LARG-1
        MOV  SI, TIJ_ALT-1
        CALL RETANGULO
        POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
PINTA_TIJOLO ENDP

DESENHA_TIJOLOS PROC
        XOR  SI, SI
        XOR  AX, AX             ; AL = fileira, AH = coluna
@@tijolo:
        CMP  tijolos[SI], 0
        JE   @@prox
        MOV  CL, 1
        CALL PINTA_TIJOLO
@@prox: INC  SI
        INC  AH
        CMP  AH, COLUNAS
        JB   @@tijolo
        XOR  AH, AH
        INC  AL
        CMP  AL, FILEIRAS
        JB   @@tijolo
        RET
DESENHA_TIJOLOS ENDP

DESENHA_PAREDES PROC
        MOV  AL, COR_PAREDE
        XOR  BX, BX             ; esquerda
        MOV  DX, TETO-4
        MOV  CX, PAREDE_ESQ
        MOV  SI, 200-TETO+4
        CALL RETANGULO
        MOV  BX, PAREDE_DIR     ; direita
        CALL RETANGULO
        XOR  BX, BX             ; teto
        MOV  CX, 320
        MOV  SI, 4
        CALL RETANGULO
        RET
DESENHA_PAREDES ENDP

; MOSTRA_PLACAR: PONTOS 00000   VIDAS 3   FASE 1
MOSTRA_PLACAR PROC
        XOR  AL, AL             ; apaga a linha 0 de texto
        XOR  BX, BX
        XOR  DX, DX
        MOV  CX, 320
        MOV  SI, 8
        CALL RETANGULO
        MOV  DH, 0
        MOV  DL, 1
        MOV  BL, 7
        MOV  SI, OFFSET txt_pontos
        CALL ESCREVE_TXT
        MOV  AX, pontos
        CALL ESCREVE_NUM
        MOV  DH, 0              ; (ESCREVE_NUM estragou o DX)
        MOV  DL, 17
        MOV  BL, 7
        MOV  SI, OFFSET txt_vidas
        CALL ESCREVE_TXT
        MOV  AL, vidas
        XOR  AH, AH
        CALL ESCREVE_NUM
        MOV  DH, 0
        MOV  DL, 29
        MOV  BL, 7
        MOV  SI, OFFSET txt_fase
        CALL ESCREVE_TXT
        MOV  AL, fase
        XOR  AH, AH
        INC  AX
        CALL ESCREVE_NUM
        RET
MOSTRA_PLACAR ENDP

; ESCREVE_NUM: AX em decimal, sem zeros à esquerda, onde está o cursor
ESCREVE_NUM PROC
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        OR   AX, AX
        JNZ  @@divide
@@mostra:
        POP  AX
        ADD  AL, '0'
        MOV  AH, 0Eh
        MOV  BX, 000Fh          ; página 0, branco
        INT  10h
        LOOP @@mostra
        RET
ESCREVE_NUM ENDP

TELA_TITULO PROC
        CALL SOM_DESLIGA
        CALL LIMPA_TELA
        XOR  AX, AX             ; uma fileira de cada cor como enfeite
@@enfeite:
        MOV  CL, 1
        CALL PINTA_TIJOLO
        INC  AH
        CMP  AH, COLUNAS
        JB   @@enfeite
        XOR  AH, AH
        INC  AL
        CMP  AL, 2
        JB   @@enfeite
        MOV  DH, 8
        MOV  DL, 12
        MOV  BL, 15
        MOV  SI, OFFSET txt_titulo
        CALL ESCREVE_TXT
        MOV  DH, 13
        MOV  DL, 10
        MOV  BL, 14
        MOV  SI, OFFSET txt_comeca
        CALL ESCREVE_TXT
        MOV  DH, 15
        MOV  DL, 6
        MOV  BL, 7
        MOV  SI, OFFSET txt_teclas
        CALL ESCREVE_TXT
        MOV  DH, 17
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
        JBE  @@msg
        MOV  recorde, AX
@@msg:  MOV  DH, 21
        MOV  DL, 14
        MOV  BL, 12
        MOV  SI, OFFSET txt_fim
        CALL ESCREVE_TXT
        MOV  DH, 23
        MOV  DL, 8
        MOV  BL, 7
        MOV  SI, OFFSET txt_recorde
        CALL ESCREVE_TXT
        MOV  AX, recorde
        CALL ESCREVE_NUM
        CALL ESPERA_SOLTAR
@@espera:
        CALL SOM_ATUALIZA
        CMP  teclas[SC_ESPACO], 1
        JNE  @@espera
        CALL ESPERA_SOLTAR
        RET
FIM_DE_JOGO ENDP

; ===============================================================
; Rotinas gráficas (as mesmas do Invasores)
; ===============================================================
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

LIMPA_TELA PROC
        XOR  DI, DI
        XOR  AX, AX
        MOV  CX, 32000
        REP  STOSW
        RET
LIMPA_TELA ENDP

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
; Teclado (INT 9) e som
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
; três paredes (13 bits por fileira; 1 = tijolo)
desenhos    DW 1111111111111b, 1111111111111b, 1111111111111b, 1111111111111b
            DW 1111111111111b, 1111111111111b, 1111111111111b, 1111111111111b
            DW 0000001000000b, 0000011100000b, 0000111110000b, 0001111111000b
            DW 0011111111100b, 0111111111110b, 1111111111111b, 1111111111111b
            DW 1010101010101b, 0101010101010b, 1010101010101b, 0101010101010b
            DW 1010101010101b, 0101010101010b, 1010101010101b, 0101010101010b
cores_fileira DB 12, 12, 6, 6, 10, 10, 14, 14  ; vermelho, laranja, verde, amarelo
pontos_fileira DB 7, 7, 5, 5, 3, 3, 1, 1
notas_fileira DW 1200, 1300, 1500, 1600, 1800, 2000, 2200, 2400

txt_titulo  DB 'P A R E D A O', 0
txt_comeca  DB 'ESPACO comeca o jogo', 0
txt_teclas  DB 'setas movem, ESPACO lanca', 0
txt_sair    DB 'ESC sai', 0
txt_pontos  DB 'PONTOS ', 0
txt_vidas   DB 'VIDAS ', 0
txt_fase    DB 'FASE ', 0
txt_fim     DB 'FIM DE JOGO', 0
txt_recorde DB 'ESPACO volta  RECORDE ', 0

pontos      DW 0
recorde     DW 0
vidas       DB 3
fase        DB 0
restantes   DW 0                ; tijolos que faltam
toques      DB 0
presa       DB 1                ; 1 = bola grudada na raquete
velocidade  DW 2*FRAC           ; velocidade vertical (1/16 de pixel)
raq_x       DW 0
raq_desenhada DW 0
bola_x      DW 0
bola_y      DW 0
bola_vx     DW 0
bola_vy     DW 0
bola_xd     DW 0
bola_yd     DW 0
som_fim     DW 0
som_ligado  DB 0
int9_antiga DD 0
tijolos     DB COLUNAS*FILEIRAS DUP (0)
teclas      DB 128 DUP (0)

END inicio
```

:::dica Como ler a listagem
Comece pelo laço em `inicio` e siga as chamadas: `MONTA_FASE` (a parede), `MOVE_BOLA` (o coração do jogo), `RAQUETE`, `TIJOLO_EM` e `QUEBRA`. As rotinas gráficas, de teclado e de som são praticamente as mesmas dos outros jogos do módulo: copiar rotinas testadas de um jogo para o outro era exatamente o que os programadores da época faziam, com uma pasta de "bibliotecas" no disquete.
:::

## Exercícios

```exercicio
id: a37-1
titulo: Rebote nas paredes
nivel: 1
exigir: NEG
--- enunciado
Complete **ANDA_X**: some `bola_vx` em `bola_x` (as duas em **1/16 de pixel**, com sinal). Depois veja o x da bola em pixels (`bola_x` deslocado 4 bits com sinal):

- se for **menor que 4** (a parede esquerda), encoste a bola em `bola_x = 4 × 16` e inverta `bola_vx`;
- se for **maior que 313** (316 − 3, a parede direita menos a bola), encoste em `bola_x = 313 × 16` e inverta `bola_vx`;
- senão, deixe como está.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
PAREDE_ESQ  EQU 4
PAREDE_DIR  EQU 316
BOLA        EQU 3
inicio: CALL ANDA_X
        MOV  AX, 4C00h
        INT  21h

ANDA_X  PROC
        ; seu código aqui
        RET
ANDA_X  ENDP

bola_x  DW 100*16
bola_vx DW 16
END inicio
--- testes
[{ "nome": "no meio do campo, só anda", "setup": { "bola_x": 1600, "bola_vx": 16 }, "espera": { "mem": { "bola_x": 1616, "bola_vx": 16 } } },
 { "nome": "andando para a esquerda, sem bater", "setup": { "bola_x": 1600, "bola_vx": -40 }, "espera": { "mem": { "bola_x": 1560, "bola_vx": -40 } } },
 { "nome": "bate na parede esquerda", "setup": { "bola_x": 69, "bola_vx": -20 }, "espera": { "mem": { "bola_x": 64, "bola_vx": 20 } } },
 { "nome": "atravessa o zero (fica negativo)", "setup": { "bola_x": 70, "bola_vx": -80 }, "espera": { "mem": { "bola_x": 64, "bola_vx": 80 } } },
 { "nome": "bate na parede direita", "setup": { "bola_x": 5008, "bola_vx": 24 }, "espera": { "mem": { "bola_x": 5008, "bola_vx": -24 } } },
 { "nome": "encosta sem passar da direita", "setup": { "bola_x": 4990, "bola_vx": 18 }, "espera": { "mem": { "bola_x": 5008, "bola_vx": 18 } } }]
--- dicas
Some com MOV AX,bola_x / ADD AX,bola_vx / MOV bola_x,AX.
Para ter o pixel: MOV CL,4 e SAR AX,CL. SAR, e não SHR, porque a posição pode ficar negativa.
Compare com JGE e JLE (com sinal). Na parede: MOV bola_x,PAREDE_ESQ*16 e NEG bola_vx.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
PAREDE_ESQ  EQU 4
PAREDE_DIR  EQU 316
BOLA        EQU 3
inicio: CALL ANDA_X
        MOV  AX, 4C00h
        INT  21h

ANDA_X  PROC
        MOV  AX, bola_x
        ADD  AX, bola_vx
        MOV  bola_x, AX
        MOV  CL, 4
        SAR  AX, CL             ; AX = x em pixels
        CMP  AX, PAREDE_ESQ
        JGE  @@direita
        MOV  bola_x, PAREDE_ESQ*16
        NEG  bola_vx
        RET
@@direita:
        CMP  AX, PAREDE_DIR-BOLA
        JLE  @@fim
        MOV  bola_x, (PAREDE_DIR-BOLA)*16
        NEG  bola_vx
@@fim:  RET
ANDA_X  ENDP

bola_x  DW 100*16
bola_vx DW 16
END inicio
```

```exercicio
id: a37-2
titulo: Que tijolo é este?
nivel: 2
--- enunciado
BX e DX chegam com um pixel (x, y) da tela. A parede de tijolos tem **13 colunas × 8 fileiras** de tijolos de **24 × 8** pixels; o canto de cima à esquerda do tijolo 0 fica em (4, 32), então a parede ocupa x de 4 a 315 e y de 32 a 95.

Se o pixel está dentro da parede, devolva **SI = fileira × 13 + coluna** e **CF = 1**. Se está fora, devolva **CF = 0** (SI pode ser qualquer coisa). **BX e DX** precisam voltar com os valores originais. Não importa se o tijolo está inteiro ou quebrado: aqui só interessa o índice.
--- inicial
; BX = x, DX = y (pixels)
; devolva SI = índice do tijolo e CF = 1, ou CF = 0 se estiver fora
--- testes
[{ "nome": "canto do tijolo 0", "setup": { "BX": 4, "DX": 32 }, "espera": { "SI": 0, "CF": 1, "BX": 4, "DX": 32 } },
 { "nome": "(100, 50): fileira 2, coluna 4", "setup": { "BX": 100, "DX": 50 }, "espera": { "SI": 30, "CF": 1, "BX": 100, "DX": 50 } },
 { "nome": "último pixel da parede", "setup": { "BX": 315, "DX": 95 }, "espera": { "SI": 103, "CF": 1, "BX": 315, "DX": 95 } },
 { "nome": "(200, 70)", "setup": { "BX": 200, "DX": 70 }, "espera": { "SI": 60, "CF": 1 } },
 { "nome": "à esquerda da parede", "setup": { "BX": 2, "DX": 50 }, "espera": { "CF": 0, "BX": 2, "DX": 50 } },
 { "nome": "acima", "setup": { "BX": 100, "DX": 31 }, "espera": { "CF": 0, "BX": 100, "DX": 31 } },
 { "nome": "abaixo", "setup": { "BX": 100, "DX": 96 }, "espera": { "CF": 0, "DX": 96 } },
 { "nome": "à direita", "setup": { "BX": 316, "DX": 40 }, "espera": { "CF": 0, "BX": 316 } }]
--- dicas
Guarde BX e DX na pilha logo no começo e devolva no fim (POP não mexe nas flags).
SUB DX,32 seguido de JB já descobre "acima da parede". Depois compare DX com 64 (JAE: abaixo).
Coluna: SUB BX,4 / MOV AX,BX / MOV BL,24 / DIV BL (AL = coluna; confira se é menor que 13). Fileira: DX dividido por 8 com SHR.
Monte SI = fileira × 13 + coluna (MUL de 8 bits) e termine com STC; nos casos de fora, CLC.
--- solucao
; BX = x, DX = y (pixels)
        PUSH AX
        PUSH BX
        PUSH DX
        SUB  DX, 32
        JB   fora               ; acima
        CMP  DX, 64
        JAE  fora               ; abaixo
        SUB  BX, 4
        JB   fora               ; à esquerda
        MOV  AX, BX
        MOV  BL, 24
        DIV  BL                 ; AL = coluna
        CMP  AL, 13
        JAE  fora               ; à direita
        MOV  BL, AL
        MOV  AX, DX
        MOV  CL, 3
        SHR  AX, CL             ; AL = fileira
        MOV  AH, 13
        MUL  AH                 ; AX = fileira * 13
        XOR  BH, BH
        ADD  AX, BX
        MOV  SI, AX
        STC
        JMP  SHORT pronto
fora:   CLC
pronto: POP  DX
        POP  BX
        POP  AX
```

```exercicio
id: a37-3
titulo: Colisão de retângulos
nivel: 2
--- enunciado
Dois retângulos são dados pelo canto de cima à esquerda, largura e altura: o primeiro em `r1x, r1y, r1l, r1a` e o segundo em `r2x, r2y, r2l, r2a` (words). Complete **COLIDE** para devolver **AL = 1** se eles se sobrepõem (têm pelo menos um pixel em comum) e **AL = 0** se não.

Dois retângulos **não** se sobrepõem quando um termina antes do outro começar, em qualquer eixo: `r1x + r1l <= r2x`, ou `r2x + r2l <= r1x`, e o mesmo em y. Retângulos que só **encostam** (o primeiro termina na coluna 14 e o segundo começa na 15) não colidem.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL COLIDE
        MOV  AH, 4Ch
        INT  21h

COLIDE  PROC
        ; AL = 1 se os retângulos se sobrepõem, 0 se não
        RET
COLIDE  ENDP

r1x     DW 0
r1y     DW 0
r1l     DW 0
r1a     DW 0
r2x     DW 0
r2y     DW 0
r2l     DW 0
r2a     DW 0
END inicio
--- testes
[{ "nome": "a bola entra no tijolo", "setup": { "AX": 0, "r1x": 100, "r1y": 50, "r1l": 3, "r1a": 3, "r2x": 100, "r2y": 48, "r2l": 23, "r2a": 7 }, "espera": { "AL": 1 } },
 { "nome": "só encostam de lado", "setup": { "AX": 1, "r1x": 10, "r1y": 10, "r1l": 5, "r1a": 5, "r2x": 15, "r2y": 10, "r2l": 5, "r2a": 5 }, "espera": { "AL": 0 } },
 { "nome": "separados na vertical", "setup": { "AX": 1, "r1x": 10, "r1y": 10, "r1l": 5, "r1a": 5, "r2x": 12, "r2y": 30, "r2l": 5, "r2a": 5 }, "espera": { "AL": 0 } },
 { "nome": "um dentro do outro", "setup": { "AX": 0, "r1x": 0, "r1y": 0, "r1l": 100, "r1a": 100, "r2x": 40, "r2y": 40, "r2l": 3, "r2a": 3 }, "espera": { "AL": 1 } },
 { "nome": "só um canto em comum", "setup": { "AX": 0, "r1x": 10, "r1y": 10, "r1l": 5, "r1a": 5, "r2x": 14, "r2y": 14, "r2l": 5, "r2a": 5 }, "espera": { "AL": 1 } },
 { "nome": "o segundo à esquerda do primeiro", "setup": { "AX": 1, "r1x": 50, "r1y": 10, "r1l": 5, "r1a": 5, "r2x": 10, "r2y": 10, "r2l": 5, "r2a": 5 }, "espera": { "AL": 0 } },
 { "nome": "encostam por baixo", "setup": { "AX": 1, "r1x": 10, "r1y": 10, "r1l": 5, "r1a": 5, "r2x": 10, "r2y": 15, "r2l": 5, "r2a": 5 }, "espera": { "AL": 0 } }]
--- dicas
Comece com AL = 0 e saia (RET) assim que achar um eixo em que eles estão separados.
Exemplo para x: MOV BX,r2x / ADD BX,r2l / CMP r1x,BX / JGE fim (o primeiro começa depois do fim do segundo).
São quatro testes iguais: r1 depois de r2 em x, r2 depois de r1 em x, e os dois em y. Passou pelos quatro? AL = 1.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL COLIDE
        MOV  AH, 4Ch
        INT  21h

COLIDE  PROC
        XOR  AL, AL
        MOV  BX, r2x
        ADD  BX, r2l
        CMP  r1x, BX            ; r1 começa depois do fim de r2?
        JGE  @@fim
        MOV  BX, r1x
        ADD  BX, r1l
        CMP  r2x, BX            ; r2 começa depois do fim de r1?
        JGE  @@fim
        MOV  BX, r2y
        ADD  BX, r2a
        CMP  r1y, BX
        JGE  @@fim
        MOV  BX, r1y
        ADD  BX, r1a
        CMP  r2y, BX
        JGE  @@fim
        MOV  AL, 1              ; nenhum eixo separa: colidem
@@fim:  RET
COLIDE  ENDP

r1x     DW 0
r1y     DW 0
r1l     DW 0
r1a     DW 0
r2x     DW 0
r2y     DW 0
r2l     DW 0
r2a     DW 0
END inicio
```

```exercicio
id: a37-4
titulo: O ângulo da raquete
nivel: 2
--- enunciado
A bola (3 × 3 pixels) acabou de bater na raquete (32 pixels de largura). BX tem o **x da bola em pixels** (a coluna da esquerda) e `raq_x` tem o x da raquete. Calcule a nova velocidade da bola, em 1/16 de pixel:

- `bola_vx` = (BX + 1 − raq_x − 16) × 2, isto é, o dobro da distância entre o centro da bola e o centro da raquete (pode ser negativa);
- `bola_vy` = −`velocidade` (a bola sempre volta para cima).
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL ANGULO
        MOV  AX, 4C00h
        INT  21h

ANGULO  PROC
        ; BX = x da bola (pixels)
        RET
ANGULO  ENDP

raq_x      DW 100
velocidade DW 32
bola_vx    DW 0
bola_vy    DW 32
END inicio
--- testes
[{ "nome": "no centro: sobe reta", "setup": { "BX": 115, "raq_x": 100, "velocidade": 32, "bola_vx": 7 }, "espera": { "mem": { "bola_vx": 0, "bola_vy": -32 } } },
 { "nome": "ponta esquerda", "setup": { "BX": 98, "raq_x": 100, "velocidade": 32 }, "espera": { "mem": { "bola_vx": -34, "bola_vy": -32 } } },
 { "nome": "ponta direita", "setup": { "BX": 131, "raq_x": 100, "velocidade": 40 }, "espera": { "mem": { "bola_vx": 32, "bola_vy": -40 } } },
 { "nome": "um pouco à esquerda", "setup": { "BX": 207, "raq_x": 200, "velocidade": 48 }, "espera": { "mem": { "bola_vx": -16, "bola_vy": -48 } } }]
--- dicas
MOV AX,BX / INC AX / SUB AX,raq_x / SUB AX,16 dá a distância com sinal.
SHL AX,1 dobra também números negativos (em complemento de dois).
Para vy: MOV AX,velocidade / NEG AX / MOV bola_vy,AX.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL ANGULO
        MOV  AX, 4C00h
        INT  21h

ANGULO  PROC
        MOV  AX, BX
        INC  AX                 ; centro da bola
        SUB  AX, raq_x
        SUB  AX, 16             ; menos o centro da raquete
        SHL  AX, 1
        MOV  bola_vx, AX
        MOV  AX, velocidade
        NEG  AX
        MOV  bola_vy, AX
        RET
ANGULO  ENDP

raq_x      DW 100
velocidade DW 32
bola_vx    DW 0
bola_vy    DW 32
END inicio
```

```exercicio
id: a37-5
titulo: Uma fileira a partir de bits
nivel: 3
--- enunciado
AX chega com o desenho de uma fileira: o **bit 12 é a coluna 0**, o bit 11 a coluna 1, ..., o **bit 0 é a coluna 12**. Os bits 13 a 15 devem ser ignorados. Preencha os 13 bytes de `fileira` com **1** onde há tijolo e **0** onde não há, e devolva em **DX** quantos tijolos a fileira tem.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL MONTA
        MOV  AX, 4C00h
        INT  21h

MONTA   PROC
        ; AX = desenho da fileira
        RET
MONTA   ENDP

fileira DB 13 DUP (9)
END inicio
--- testes
[{ "nome": "fileira cheia", "setup": { "AX": 8191 }, "espera": { "mem": { "fileira": [1,1,1,1,1,1,1,1,1,1,1,1,1] }, "DX": 13 } },
 { "nome": "fileira vazia", "setup": { "AX": 0 }, "espera": { "mem": { "fileira": [0,0,0,0,0,0,0,0,0,0,0,0,0] }, "DX": 0 } },
 { "nome": "xadrez 1010101010101b", "setup": { "AX": 5461 }, "espera": { "mem": { "fileira": [1,0,1,0,1,0,1,0,1,0,1,0,1] }, "DX": 7 } },
 { "nome": "topo da pirâmide 0000001000000b", "setup": { "AX": 64 }, "espera": { "mem": { "fileira": [0,0,0,0,0,0,1,0,0,0,0,0,0] }, "DX": 1 } },
 { "nome": "bits 13 a 15 ligados não contam", "setup": { "AX": 57345 }, "espera": { "mem": { "fileira": [0,0,0,0,0,0,0,0,0,0,0,0,1] }, "DX": 1 } }]
--- dicas
Desloque AX 3 bits para a esquerda: o bit 12 vira o bit 15 e os bits 13 a 15 somem.
Em um laço de 13 voltas: SHL AX,1 joga o próximo bit no CF.
MOV BYTE PTR [DI],0 não mexe no CF; depois JNC pula, ou então MOV BYTE PTR [DI],1 e INC DX.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL MONTA
        MOV  AX, 4C00h
        INT  21h

MONTA   PROC
        MOV  DI, OFFSET fileira
        XOR  DX, DX
        MOV  CL, 3
        SHL  AX, CL             ; bit 12 vai para o bit 15
        MOV  CX, 13
@@coluna:
        SHL  AX, 1              ; o bit da coluna cai no CF
        MOV  BYTE PTR [DI], 0
        JNC  @@prox
        MOV  BYTE PTR [DI], 1
        INC  DX
@@prox: INC  DI
        LOOP @@coluna
        RET
MONTA   ENDP

fileira DB 13 DUP (9)
END inicio
```

## Desafios

Sem verificador: modifique o PAREDÃO no laboratório e jogue.

1. **Raquete que encolhe.** Como no Breakout de 1976: na primeira vez que a bola bater no teto, a raquete passa a ter 16 pixels. Cuidado: `RAQ_LARG` é constante; você vai precisar de uma variável `raq_larg` e trocar todos os lugares que usam a largura (inclusive o cálculo do ângulo, que passa a usar metade da largura).
2. **Tijolos duros.** Mude `tijolos` para guardar quantos toques faltam (1 a 3) em vez de 0/1, e pinte cada tijolo com uma cor diferente conforme os toques. Os desenhos das fases podem virar bytes em vez de bits.
3. **Aceleração por fileira.** A bola também acelera na primeira vez que acertar uma fileira laranja e na primeira vez que acertar uma vermelha (guarde dois indicadores).
4. **Cápsula de vida.** Quando um tijolo amarelo especial quebrar, solte uma cápsula de 8 × 4 pixels que cai 1 pixel por quadro. Se ela tocar a raquete (use a rotina de colisão de retângulos do exercício 3), ganha uma vida.
5. **Fase 4.** Desenhe uma quarta parede (um coração, as letras do seu nome...) e mude o `DIV` por 3 para 4.

## No livro

- [Capítulo 3: vídeo, modos e texto](livro:cap03): a função 00h da INT 10h que liga o modo 13h e a volta para o 03h; as funções 02h e 0Eh que o placar usa.
- [Capítulo 6: teclado](livro:cap06): os scan codes, o bit 7 de "tecla solta" e por que a INT 16h não serve para ação contínua.
- [Capítulo 7: tempo e relógios](livro:cap07): a INT 1Ah, função 00h, usada para medir a duração dos bipes.
- [Capítulo 2: vetores e exceções](livro:cap02): a tabela de vetores e a IRQ 1 que vira INT 9.
- [Capítulo 20: a BIOS para jogos](livro:cap20): retraço vertical, teclado direto pela INT 9, som pelo PIT e vídeo direto, reunidos.

:::resumo
- O PAREDÃO é um Breakout de 13 × 8 tijolos de 24 × 8 pixels no modo 13h, com três desenhos de parede, aceleração no 4º e no 12º toque e pontos por fileira (7, 5, 3, 1), como o original da Atari.
- A bola anda em **ponto fixo 12.4** (1/16 de pixel); `SAR` converte para pixels preservando o sinal.
- A colisão é feita **um eixo de cada vez**: se bate no passo de x, inverte vx; no passo de y, inverte vy. O rebote é um `NEG`. O passo máximo (3 pixels) é menor que a espessura do tijolo, para a bola nunca atravessá-lo.
- O tijolo de um pixel sai de duas divisões: coluna = (x − 4) / 24, fileira = (y − 32) / 8, índice = fileira × 13 + coluna; a volta é uma `DIV` por 13 (quociente = fileira, resto = coluna).
- O ângulo do rebote na raquete é proporcional à distância entre o centro da bola e o centro da raquete.
- As fases são desenhos de bits: `SHL` joga cada bit no CF e `JNC` decide se há tijolo.
- Só o que muda é redesenhado, logo depois do retraço; o teclado é uma tabela mantida por uma INT 9 própria e o som é desligado por hora marcada, sem esperas.
:::
