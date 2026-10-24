---
id: aula39
numero: 39
modulo: 13
titulo: Labirinto, o comilão e os quatro fantasmas
subtitulo: Pac-Man em modo texto - mapa em bytes, inteligência por alvos, modos dispersar, perseguir e medo
duracao: 110 min
objetivos: entender as regras do Pac-Man de 1980 e o comportamento dos fantasmas; guardar o labirinto como um vetor de bytes e andar nele com tabelas de direção; implementar o túnel e a porta da casinha numa só rotina; escolher a direção de um fantasma pela menor distância até um alvo; dar personalidade a cada fantasma só trocando o alvo; controlar os modos dispersar, perseguir e medo com contadores de quadros; ver como os sete jogos do módulo compartilham as mesmas técnicas
---

## O último jogo do módulo

Os seis jogos anteriores tinham inimigos simples: a comida da cobra não foge, a raquete do computador no Pong só segue a bola, os invasores marcham em bloco, as peças do BLOCOS caem, os tijolos do PAREDÃO ficam parados e os carros do SAPO andam em faixas. O LABIRINTO tem **quatro inimigos que pensam**: cada fantasma decide, a cada cruzamento, para onde ir. E o surpreendente é que essa "inteligência" cabe em poucas dezenas de instruções. O segredo, inventado em 1980, é que cada fantasma só precisa saber **um ponto do mapa que ele quer alcançar**.

O laço, o retraço, o teclado, o vídeo direto e o som estão nos [fundamentos](aula:aula32). Aqui ficamos com o que o LABIRINTO faz de próprio, e no fim olhamos para os sete jogos juntos.

:::anos90 Namco, 1980: o Pac-Man
**Toru Iwatani** criou o **Puck-Man** para a Namco em 1980; nos Estados Unidos, distribuído pela Midway, o nome virou **Pac-Man** (temia-se que vândalos trocassem o P de "Puck" por outra letra). Iwatani queria um jogo que não fosse de tiro e que agradasse também a quem não frequentava fliperamas: o tema é **comer**. O personagem teria sido inspirado numa pizza da qual faltava uma fatia.

O grande trunfo do jogo são os fantasmas, cada um com um nome e uma personalidade: **Blinky** (vermelho, o "Shadow", que persegue), **Pinky** (rosa, o "Speedy", que embosca na frente do Pac-Man), **Inky** (ciano, o "Bashful", imprevisível) e **Clyde** (laranja, o "Pokey", que se aproxima e foge). No nosso jogo eles se chamam SOMBRA, LIGEIRA, MANHOSO e LERDO.

O Pac-Man chegou ao IBM PC em 1983, numa versão da **Atarisoft** que dava boot direto do disquete e usava os 4 cores da CGA. Durante os anos 80 e 90 vieram o Ms. Pac-Man e uma enxurrada de clones em shareware para DOS, muitos em modo texto exatamente como o nosso.
:::

## As regras do LABIRINTO

| Elemento | Como é no jogo |
|----------|----------------|
| Tela | modo texto 80 × 25; o labirinto tem **28 × 22 casas** de 2 colunas cada |
| Pontos | 204 pontinhos (10 cada) e 4 pílulas (50 cada) |
| Pílula | os fantasmas ficam azuis e fogem por **6 segundos**; comer um vale 200, 400, 800, 1.600 |
| Fantasmas | 4, com alvos diferentes; o vermelho começa fora da casinha, os outros saem um a cada 3 segundos |
| Modos | **dispersar** (7 s, cada um vai para o seu canto) e **perseguir** (20 s), alternando |
| Olhos | o fantasma comido vira um par de olhos que corre de volta para a porta da casinha e renasce |
| Túnel | a linha 10 atravessa a tela: quem sai por um lado entra pelo outro |
| Fases | comidos todos os pontos, o labirinto pisca e recomeça com fantasmas mais rápidos |
| Teclas | setas mudam a direção, P pausa, ESC volta ao título |

E, como todos os jogos do módulo, é um **.COM** que da INT 21h só usa a função 4Ch: o resto é BIOS (INT 10h, 16h e 1Ah), a porta 3DAh do retraço e o PIT. Ele vai rodar sem mudanças no MINIOS.

## A tela e o mapa

```diagrama titulo="O labirinto na tela (casa (0,0) na linha 1, coluna 12)"
 col: 12                                                        67
 lin 0  PONTOS 00040     RECORDE 00000    VIDAS ☻☻☻
     1  ████████████████████████████████████████████████████████
     2  ██ · · · · · · · · · · · ████ · · · · · · · · · · · ██
     4  ██ •   ████████   ██████████   ████ ...            • ██     • pílula (piscando)
     .  ...
     9  ██████ · ████   ██████──██████   ████ · ██████            ── porta da casinha
    10        ·         ██ Ω  Ω  Ω   ██           ·              túnel: linha 10 atravessa
     .  ...
    17  ██ •  ·  ████ · · · · ◄  · · · · ████  · • ██           ◄ o comilão
     .  ...
    22  ████████████████████████████████████████████████████████
```

O mapa é guardado como texto no fonte, uma linha de 28 caracteres para cada linha do labirinto. O próprio fonte é o editor de fases:

```asm fragmento titulo="O mapa (parte de cima)"
; # parede   . ponto   o pílula   - porta da casinha   G dentro da casinha
mapa_original DB '############################'
            DB '#............##............#'
            DB '#.####.#####.##.#####.####.#'
            DB '#o####.#####.##.#####.####o#'
            DB '#..........................#'
            ...
            DB '######.## ###--### ##.######'
            DB '      .   #GGGGGG#   .      '   ; a linha do túnel
```

Durante o jogo, o comilão come os pontos **apagando-os no mapa** (trocando `.` por espaço). Por isso o jogo trabalha numa **cópia**, `mapa`, que `NOVA_FASE` refaz a partir do original com um `REP MOVSB`:

```asm fragmento titulo="NOVA_FASE: copia o labirinto original"
        PUSH ES
        PUSH DS
        POP  ES                 ; ES aponta para os dados (estava em B800h)
        MOV  SI, OFFSET mapa_original
        MOV  DI, OFFSET mapa
        MOV  CX, LARG*ALT       ; 616 bytes
        REP  MOVSB
        POP  ES                 ; ES volta para a memória de vídeo
        MOV  restantes, 208     ; 204 pontos + 4 pílulas
```

O jogo mantém ES apontando para a tela o tempo todo, porque `STOSW` (que escreve em ES:DI) é o jeito mais rápido de desenhar. Para copiar dados de DS para DS, ES precisa mudar por um instante; o par `PUSH DS` / `POP ES` faz isso sem gastar outro registrador, já que não existe `MOV ES, DS` no 8086.

### Casa, índice e posição na tela

Três sistemas de coordenadas convivem no jogo:

```diagrama titulo="Da casa (x, y) para o mapa e para a tela"
   casa do labirinto        (x, y)         x de 0 a 27, y de 0 a 21
           │
           ├──► índice no mapa  = y × 28 + x                    (CASA_NO_MAPA)
           │
           └──► célula da tela  = linha 1 + y,  coluna 12 + 2·x   (POE_CASA)
                endereço        = linhas[1 + y] + (12 + 2·x) × 2
```

```asm fragmento titulo="CASA_NO_MAPA: BX = DH × 28 + DL"
CASA_NO_MAPA PROC
        PUSH AX
        MOV  AL, DH
        MOV  BL, LARG
        MUL  BL                 ; AX = y * 28
        MOV  BL, DL
        XOR  BH, BH
        ADD  BX, AX             ; + x
        POP  AX
        RET
CASA_NO_MAPA ENDP
```

Como no SAPO, cada casa ocupa duas colunas para ficar quase quadrada. `POE_CASA` escreve o caractere nas duas colunas, com uma exceção: um ponto ou uma pílula só aparece na primeira, para não sair "dobrado".

## Direções como números

As quatro direções são numeradas numa ordem escolhida a dedo: **0 cima, 1 esquerda, 2 baixo, 3 direita**. Com essa ordem, a direção **contrária** é sempre a direção **XOR 2** (0 ↔ 2, 1 ↔ 3). Duas tabelas transformam uma direção no passo em x e em y:

```asm fragmento titulo="As tabelas de direção"
dir_x       DB 0, -1, 0, 1      ; cima, esquerda, baixo, direita
dir_y       DB -1, 0, 1, 0
teclas_dir  DB 48h, 4Bh, 50h, 4Dh   ; scan codes das setas, na mesma ordem
```

```diagrama titulo="Direções e seus contrários"
                  0 cima (0,-1)
                      ▲
   1 esquerda ◄───── casa ─────► 3 direita
     (-1,0)           ▼            (1,0)
                  2 baixo (0,1)

   contrária = direção XOR 2:   0 ↔ 2    1 ↔ 3
```

Ler o teclado vira procurar o scan code em `teclas_dir`: a posição onde ele está **é** a direção. E dar meia-volta em todos os fantasmas é um `XOR fant_dir[BX], 2`.

## Andar no labirinto: PODE_ANDAR

Uma única rotina responde à pergunta "dá para andar daqui naquela direção?", e serve ao comilão e aos fantasmas. Ela soma o passo da direção, trata o **túnel** e consulta o mapa. A **porta da casinha** (`-`) é parede para uns e passagem para outros, então quem chama decide com AH.

```asm fragmento titulo="PODE_ANDAR: túnel, parede e porta"
; a partir da casa DL, DH, anda na direção AL. AH = 1 deixa passar pela
; porta. Devolve DX = casa nova e CF = 0, ou CF = 1 (DX sem mudar).
PODE_ANDAR PROC
        PUSH BX
        PUSH DX
        PUSH AX
        MOV  BL, AL
        XOR  BH, BH
        ADD  DL, dir_x[BX]
        ADD  DH, dir_y[BX]
        CMP  DL, 0FFh           ; túnel: saiu pela esquerda, entra pela direita
        JNE  @@dir
        MOV  DL, LARG-1
@@dir:  CMP  DL, LARG
        JB   @@olha
        XOR  DL, DL             ; e vice-versa
@@olha: CALL CASA_NO_MAPA
        MOV  AL, mapa[BX]
        CMP  AL, '#'
        JE   @@parede
        CMP  AL, '-'            ; a porta: depende de AH
        JNE  @@livre
        ...
```

O jeito como a rotina devolve DX é interessante: ela guarda o DX original na pilha. Se a casa está livre, **descarta** o DX guardado (com um `POP BX` a mais) e devolve o novo; se é parede, restaura o antigo. O resultado vem no carry, como a BIOS faz: `JC` = não dá.

## O comilão: a direção desejada

No Pac-Man, o jogador não precisa apertar a seta no instante exato do cruzamento. Ele pode apertar **antes**, e o personagem vira assim que for possível. O LABIRINTO faz isso com duas variáveis: `pac_dir` (para onde ele está indo) e `pac_quer` (o que o jogador pediu por último).

```asm fragmento titulo="MOVE_PAC: vira quando der, senão segue reto"
        MOV  AL, pac_quer       ; dá para ir para onde o jogador quer?
        XOR  AH, AH             ; (a porta da casinha é parede para ele)
        CALL PODE_ANDAR
        JC   @@reto
        MOV  pac_dir, AL        ; deu: essa vira a direção atual
        JMP  SHORT @@move
@@reto: MOV  AL, pac_dir        ; senão, continua reto...
        CALL PODE_ANDAR
        JNC  @@move
        RET                     ; ...ou fica parado na parede
```

Esse "buffer de uma direção" é o que faz o controle parecer suave. Experimente no jogo: aperte para cima no meio de um corredor e veja o comilão virar sozinho no próximo cruzamento.

`COME` olha o que havia na casa nova: ponto (10 pontos e um bipe curtinho), pílula (50 pontos e o **medo**) ou nada. Ao comer uma pílula, todos os fantasmas ativos ficam assustados e dão **meia-volta**, que é o sinal visual para o jogador de que o jogo virou.

## O relógio: quadros e contadores

O LABIRINTO conta o tempo em **quadros do retraço vertical**: 70 por segundo no modo texto da VGA. Tudo que tem duração é um contador de quadros:

| Contador | Valor | Tempo |
|----------|-------|-------|
| `pac_conta` | 8 | o comilão anda uma casa a cada 8 quadros (8,75 casas/s) |
| `fant_conta[BX]` | 9, até 6 nas fases mais altas | velocidade normal dos fantasmas |
| (medo) | 15 | assustados, eles ficam mais lentos que o comilão |
| (olhos) | 4 | os olhos voltam para casa voando |
| `medo_tempo` | 420 | 6 segundos de medo |
| `modo_tempo` | 490 / 1400 | 7 s dispersando, 20 s perseguindo |
| `saida_tempo` | 210 | um fantasma sai da casinha a cada 3 s |

Velocidade como "quadros por passo" é o jeito mais simples de ter objetos em velocidades diferentes num jogo de grade: cada um tem o seu contador, e quando ele zera, o objeto anda uma casa e o contador recomeça. É a mesma ideia dos períodos das faixas do SAPO, só que medida em quadros.

:::cpu Por que o retraço, e não o tique da BIOS?
Com 18,2 tiques por segundo, a menor diferença de velocidade possível seria grosseira: 8 tiques por passo é lento demais, 7 já muda bastante. Com 70 quadros por segundo, há muito mais degraus entre "devagar" e "rápido", e o jogo inteiro fica mais fluido. O retraço também evita o pisca-pisca dos personagens. O som, por outro lado, continua medido em tiques da INT 1Ah: as durações dos bipes não precisam de precisão.
:::

`CONTA_MODOS` cuida dos três relógios do jogo a cada quadro:

```asm fragmento titulo="CONTA_MODOS: dispersar e perseguir"
        DEC  modo_tempo         ; troca dispersa <-> caça
        JNZ  @@medo
        XOR  cacando, 1
        MOV  modo_tempo, TEMPO_CACA
        CMP  cacando, 1
        JE   @@vira
        MOV  modo_tempo, TEMPO_DISPERSA
@@vira: CALL VIRA_TODOS         ; na troca de modo, todos dão meia-volta
```

```diagrama titulo="A linha do tempo dos modos"
   segundos:  0       7                        27      34                       54
              ├ disp. ┼──────── perseguir ──────┼ disp. ┼──────── perseguir ─────┼ ...
                      ▲ meia-volta              ▲ meia-volta

   pílula:     ──────────┤ medo: 6 s (azul; branco piscando nos 2 últimos) ├──────
                         (o medo corre por cima dos modos, sem pausar o relógio deles)
```

A meia-volta na troca de modo também vem do original: é um aviso discreto ao jogador atento de que os fantasmas mudaram de comportamento.

## A inteligência dos fantasmas

Aqui está a parte mais bonita do jogo. Um fantasma nunca "planeja um caminho". A cada casa ele faz uma escolha **local**, olhando só as casas vizinhas:

1. Descobre o seu **alvo**, uma casa do mapa (pode até ser fora dele).
2. Considera as direções em que dá para andar, **menos a contrária** à que ele vinha (um fantasma nunca dá meia-volta por conta própria).
3. Para cada uma, calcula a distância entre a **casa vizinha** e o alvo.
4. Vai na direção que deixa a casa vizinha **mais perto** do alvo. Empate: vence a primeira na ordem cima, esquerda, baixo, direita.

```diagrama titulo="A escolha num cruzamento"
                              alvo ✕  (7, 1)
                   (3,2)
                    ·   dist² = 17
         (2,3)    ┌───┐    (4,3)
   proibida ◄──── │ Ω │ ────► ·   dist² = 13   ← a menor: vai para a direita
   (veio daqui)   └───┘
                    ·   dist² = 25
                   (3,4)
```

A distância é a **euclidiana ao quadrado**: (dx)² + (dy)². Não é preciso tirar a raiz, porque comparar quadrados dá a mesma ordem que comparar as distâncias. E com coordenadas de um byte, o quadrado cabe num `IMUL` de 8 bits:

```asm fragmento titulo="DISTANCIA_DX: AX = (DL − CL)² + (DH − CH)²"
DISTANCIA_DX PROC
        PUSH BX
        MOV  AL, DL
        SUB  AL, CL
        IMUL AL                 ; AX = dx² (dx com sinal: -128 a 127)
        MOV  BX, AX
        MOV  AL, DH
        SUB  AL, CH
        IMUL AL                 ; AX = dy²
        ADD  AX, BX
        POP  BX
        RET
DISTANCIA_DX ENDP
```

`IMUL` e não `MUL`, porque dx pode ser negativo: com `MUL`, −3 seria tratado como 253 e o "quadrado" seria 64.009. `IMUL AL` faz AX = AL × AL com sinal, e (−3)² = 9.

```asm fragmento titulo="ESCOLHE: testa as 4 direções e fica com a melhor"
        MOV  melhor_dist, 0FFFFh
        MOV  melhor_dir, 0FFh
        MOV  AL, fant_dir[BX]
        XOR  AL, 2
        MOV  proibida, AL       ; a direção contrária
        ...
        MOV  DI, 4              ; 4 tentativas
        MOV  AL, primeira       ; 0 normalmente; sorteada se assustado
@@dir:  AND  AL, 3
        CMP  AL, proibida
        JE   @@prox
        MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        ...                     ; (AH: pode ou não passar pela porta)
        CALL PODE_ANDAR         ; DX = casa vizinha
        JC   @@prox
        CMP  fant_medo[BX], 0
        JNE  @@pega             ; assustado: a primeira que serve
        PUSH AX
        PUSH BX
        PUSH CX
        CALL DISTANCIA_DX       ; AX = distância² da vizinha até o alvo
        MOV  SI, AX
        POP  CX
        POP  BX
        POP  AX
        CMP  SI, melhor_dist
        JAE  @@prox             ; JAE: no empate fica a que veio antes
        MOV  melhor_dist, SI
@@pega: MOV  melhor_dir, AL
        ...
@@prox: INC  AL
        DEC  DI
        JNZ  @@dir
@@fim:  MOV  AL, melhor_dir
        CMP  AL, 0FFh           ; beco sem saída: aí pode voltar
        JNE  @@ok
        MOV  AL, proibida
```

O fantasma **assustado** usa o mesmo laço, mas começa de uma direção **sorteada** (`AND AL,3` faz a contagem dar a volta de 3 para 0) e fica com a primeira que servir: um passeio aleatório pelos corredores, que é o que os fantasmas azuis fazem no fliperama. O sorteio é o gerador congruente linear (LCG) dos [fundamentos](aula:aula32), semeado com o relógio da BIOS.

:::dica Por que proibir a meia-volta?
Sem essa regra, um fantasma cujo alvo está atrás de uma parede ficaria indo e voltando entre duas casas, porque cada uma delas, vista da outra, parece "mais perto". Proibir a meia-volta obriga o fantasma a seguir em frente e dar a volta no quarteirão. A única exceção é o beco sem saída (aí não há outra escolha), e as meias-voltas forçadas pelo jogo (troca de modo e pílula).
:::

### Quatro personalidades, uma só rotina

Todos os fantasmas usam o mesmo `ESCOLHE`. O que muda é só o **alvo**, calculado por `ALVO`:

```diagrama titulo="Os alvos no modo perseguir"
   SOMBRA (vermelho)   alvo = o próprio comilão                  persegue de perto
   LIGEIRA (rosa)      alvo = 4 casas na frente do comilão       tenta cortar o caminho
   MANHOSO (ciano)     alvo = 2 × comilão − vermelho             cerca pelo outro lado
   LERDO (laranja)     alvo = o comilão, se estiver longe;       chega perto e foge
                              o seu canto, se estiver a menos de 8 casas

          V (vermelho)
            ╲
             ╲
              ◄ comilão      MANHOSO mira no ponto simétrico ao vermelho,
               ╲             com o comilão no meio: os dois juntos fecham
                ╲            o comilão entre eles.
                 ✕ alvo do ciano
```

```asm fragmento titulo="ALVO: as personalidades"
@@caca: MOV  CL, pac_x          ; vermelho: o comilão
        MOV  CH, pac_y
        CMP  BX, 1
        JB   @@fim
        JA   @@ciano
        MOV  AL, pac_dir        ; rosa: soma 4 * direção
        XOR  AH, AH
        MOV  SI, AX
        MOV  AL, dir_x[SI]
        SHL  AL, 1
        SHL  AL, 1              ; × 4
        ADD  CL, AL
        MOV  AL, dir_y[SI]
        SHL  AL, 1
        SHL  AL, 1
        ADD  CH, AL
        RET
@@ciano:
        CMP  BX, 2
        JA   @@laranja
        SHL  CL, 1              ; 2 * comilão - vermelho
        SUB  CL, fant_x[0]
        SHL  CH, 1
        SUB  CH, fant_y[0]
        RET
@@laranja:
        CALL DISTANCIA          ; AX = distância² até o comilão
        CMP  AX, 64             ; mais perto que 8 casas: foge
        JAE  @@fim
        MOV  CL, canto_x[BX]
        MOV  CH, canto_y[BX]
@@fim:  RET
```

Repare que o alvo pode cair **fora do labirinto** (4 casas à frente de um comilão encostado na parede, ou o ponto simétrico do ciano) e isso não é problema nenhum: o alvo é só um ponto para medir distâncias, não um lugar aonde o fantasma precisa chegar. No modo **dispersar**, o alvo de cada um é um canto (`canto_x`, `canto_y`), e alguns cantos ficam **fora** do mapa (y = −2), exatamente como no fliperama: como o fantasma nunca chega, ele fica rodando em volta do quarteirão daquele canto.

:::anos90 O bug da Pinky
No Pac-Man original, o alvo da Pinky quando o Pac-Man olha **para cima** não é 4 casas acima, e sim 4 acima **e 4 para a esquerda**. É um estouro de conta no código do Z80: o mesmo cálculo que o nosso faz com `dir_x` e `dir_y` era feito com um par de bytes num registrador de 16 bits, e o "vai um" do y vazava para o x. O alvo do Inky, que usa a casa 2 à frente do Pac-Man, herdou o mesmo erro. Jogadores profissionais conhecem e exploram esses detalhes até hoje. O nosso MANHOSO usa uma versão simplificada (o comilão em vez da casa 2 à frente).
:::

### Os estados de um fantasma

Cada fantasma tem um **estado** (`fant_estado`) e um indicador de medo (`fant_medo`) separado. As mudanças são poucas e cada uma acontece num único lugar do código:

```diagrama titulo="Máquina de estados do fantasma"
                 CONTA_MODOS (a cada 3 s, um sai)
    ┌──────────┐ ─────────────────────────────────► ┌──────────────────┐
    │ EM_CASA  │                                    │      ATIVO       │
    └──────────┘                                    │  medo = 0 ou 1   │
                                                    └──────────────────┘
                     chegou à porta (SAIDA_X, Y)       │            ▲
                    ┌────────────────────────────────── │ ──────────┘
                    │                                   │ ENCONTROS: comilão na mesma casa
              ┌──────────┐                              │ com medo = 1
              │  OLHOS   │ ◄────────────────────────────┘
              │ alvo:    │
              │ a porta  │      ENCONTROS com medo = 0:  pego = 1 (o comilão morre)
              └──────────┘
```

- **EM_CASA**: parado dentro da casinha; `MOVE_FANTASMAS` nem olha para ele.
- **ATIVO**: anda pelo labirinto, com ou sem medo. Sem medo, a velocidade vem de `fant_vel` (que cai a cada fase); com medo, 15 quadros por passo.
- **OLHOS**: o alvo vira a porta da casinha, a velocidade vira 4 quadros por passo e só os olhos (`°°`) aparecem. Só neste estado o fantasma pode **entrar** pela porta; ao chegar à casa logo acima dela, ele renasce como ATIVO.

`ENCONTROS` é chamado depois de cada passo, do comilão **e** de cada fantasma. Se fosse chamado só depois do comilão, um fantasma e o comilão andando um contra o outro poderiam trocar de casa no mesmo quadro e passar um "através" do outro.

```asm fragmento titulo="ENCONTROS: quem come quem"
        CMP  fant_medo[BX], 0
        JNE  @@come
        MOV  pego, 1            ; pegaram o comilão
        JMP  SHORT @@fim
@@come: MOV  fant_estado[BX], OLHOS   ; comeu o fantasma: viram olhos
        MOV  fant_medo[BX], 0
        MOV  AX, combo
        ADD  pontos, AX
        SHL  combo, 1           ; o próximo vale o dobro: 200, 400, 800, 1600
```

## Desenhar sem apagar o labirinto

Personagens andam sobre pontos que não podem sumir. O LABIRINTO resolve isso como o SAPO: para apagar um personagem, `DESENHA_CASA` redesenha a casa **a partir do mapa** (que sabe se ali há parede, ponto, pílula, porta ou nada). Depois que o fantasma sai de uma casa, o ponto que estava embaixo dele reaparece sozinho.

```asm fragmento titulo="DESENHA_CASA: o mapa vira caracteres"
        CALL CASA_NO_MAPA
        MOV  AL, mapa[BX]
        MOV  AH, parede_cor
        CMP  AL, '#'
        JNE  @@ponto
        MOV  AL, 0DBh           ; █ parede
        JMP  SHORT @@poe
@@ponto:
        MOV  AH, COR_PONTO
        CMP  AL, '.'
        JNE  @@pilula
        MOV  AL, 0FAh           ; · ponto
        ...
```

Os personagens também são caracteres da página de código 437: o comilão alterna entre um triângulo (◄ ▲ ► ▼, a boca aberta) e o ☻ (boca fechada) a cada passo; o fantasma é o Ω (EAh) na sua cor, azul quando assustado e alternando com branco nos 2 últimos segundos de medo (`TEST medo_tempo, 16` alterna a cada 16 quadros). A pílula usa o atributo **8Fh**: o bit 7 do atributo faz o caractere **piscar** sozinho, por conta da placa de vídeo, sem nenhum código ([capítulo 4 do livro](livro:cap04)).

```quiz
? Qual é a direção contrária à direção 1 (esquerda)?
- 0
- 2
+ 3
- −1
> Com a ordem 0 cima, 1 esquerda, 2 baixo, 3 direita, a contrária é direção XOR 2: 1 XOR 2 = 3 (direita).

? Por que DISTANCIA_DX usa IMUL e não MUL?
+ Porque dx e dy podem ser negativos, e IMUL eleva ao quadrado com sinal
- Porque MUL não aceita AL como operando
- Porque IMUL é mais rápido
- Para o resultado caber em AL
> Com MUL, dx = −3 seria 253 e o quadrado seria enorme. IMUL AL dá (−3)² = 9.

? Num cruzamento, duas direções deixam o fantasma à mesma distância do alvo: esquerda e direita. Qual ele escolhe?
+ Esquerda, porque vem antes na ordem de teste e a comparação usa JAE
- Direita, a última testada
- Uma sorteada
- Nenhuma: ele fica parado
> ESCOLHE só troca a melhor direção se a nova distância for estritamente menor. A ordem é cima, esquerda, baixo, direita.

? O comilão está em (10, 16) indo para a esquerda. Qual é o alvo da LIGEIRA (rosa) no modo perseguir?
- (10, 12)
+ (6, 16)
- (14, 16)
- (10, 16)
> 4 casas na frente: x + 4 × dir_x = 10 + 4 × (−1) = 6; y não muda.

? O que acontece com um fantasma comido?
- Volta direto para dentro da casinha, no mesmo quadro
+ Vira olhos, que correm para a porta da casinha e lá renascem
- Some até a próxima fase
- Fica azul por mais 6 segundos
> O estado OLHOS tem como alvo a porta e a maior velocidade do jogo; ao chegar, o fantasma volta a ATIVO.

? Por que o alvo de um fantasma pode ficar fora do labirinto?
- É um erro do jogo
+ O alvo só serve para medir distâncias; o fantasma nunca precisa chegar a ele
- Porque o mapa tem paredes de largura zero
- Para o fantasma atravessar o túnel
> No modo dispersar, um alvo fora do mapa faz o fantasma rodar em volta do quarteirão mais próximo dele.

? O que o jogo faz quando o jogador aperta uma seta para um lado onde há parede?
- Ignora a tecla
+ Guarda em pac_quer e vira assim que for possível, enquanto segue reto
- Para o comilão
- Dá meia-volta
> pac_quer é testado a cada passo; enquanto não dá para virar, o comilão continua em pac_dir.
```

## O LABIRINTO completo

Aperte **▶ Jogar**: ENTER começa, as setas mudam a direção, P pausa e ESC volta ao título (ESC de novo sai).

```asm jogo titulo="LABIRIN.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  LABIRIN.ASM  -  o comilão do labirinto (modo texto 80x25)    ║
; ║  Curso Assembly 8086, aula 39                                 ║
; ║                                                               ║
; ║  Programa .COM: TASM LABIRIN / TLINK /t LABIRIN               ║
; ║  Setas mudam a direção, P pausa, ESC sai.                     ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; O labirinto tem 28 x 22 casas; cada casa ocupa 2 colunas da tela.
; O relógio do jogo é o retraço vertical: 70 quadros por segundo.
; ---------------------------------------------------------------
LARG        EQU 28
ALT         EQU 22
TELA_LIN    EQU 1               ; a casa (0,0) fica na linha 1...
TELA_COL    EQU 12              ; ...coluna 12 da tela
FANTASMAS   EQU 4
SAIDA_X     EQU 13              ; a casa logo acima da porta da casinha
SAIDA_Y     EQU 8
PAC_X0      EQU 13              ; onde o comilão começa
PAC_Y0      EQU 16
LIN_TUNEL   EQU 10

; quadros por passo (quanto menor, mais rápido)
VEL_PAC     EQU 8
VEL_FANT    EQU 9
VEL_MEDO    EQU 15
VEL_OLHOS   EQU 4
TEMPO_MEDO  EQU 420             ; 6 segundos
TEMPO_DISPERSA EQU 490          ; 7 s espalhados pelos cantos...
TEMPO_CACA  EQU 1400            ; ...20 s caçando

; estados de um fantasma
EM_CASA     EQU 0
ATIVO       EQU 1
OLHOS       EQU 2

; direções: 0 cima, 1 esquerda, 2 baixo, 3 direita (XOR 2 = contrária)
CIMA        EQU 0
ESQUERDA    EQU 1
BAIXO       EQU 2
DIREITA     EQU 3

COR_PAREDE  EQU 01h
COR_PONTO   EQU 07h
COR_PILULA  EQU 8Fh             ; branco piscando
COR_PORTA   EQU 0Dh
COR_PAC     EQU 0Eh
COR_MEDO    EQU 09h
COR_MEDO_FIM EQU 0Fh
COR_OLHOS   EQU 0Fh

; ===============================================================
; Programa principal
; ===============================================================
inicio:
        MOV  AX, 0B800h
        MOV  ES, AX
        CLD
        CALL ESCONDE_CURSOR
        CALL SEMEIA

@@titulo:
        CALL TELA_TITULO
        CMP  AL, 27
        JE   @@sair
        CALL NOVO_JOGO
@@quadro:
        CALL ESPERA_RETRACO
        CALL LER_TECLADO
        CMP  sair_pedido, 1
        JE   @@titulo
        CMP  pausado, 1
        JE   @@quadro
        CALL SOM_ATUALIZA
        CALL CONTA_MODOS        ; dispersa/caça, medo, saída da casinha
        CALL MOVE_PAC
        CALL MOVE_FANTASMAS
        CMP  pego, 0
        JE   @@vivo
        CALL PERDE_VIDA
        CMP  vidas, 0
        JNE  @@quadro
        CALL FIM_DE_JOGO
        JMP  @@titulo
@@vivo: CMP  restantes, 0
        JNE  @@quadro
        CALL PROXIMA_FASE
        JMP  @@quadro

@@sair: CALL SOM_DESLIGA
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ===============================================================
; Partida, fases e vidas
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

; NOVA_FASE: copia o labirinto original (com todos os pontos) e recomeça
NOVA_FASE PROC
        PUSH ES
        PUSH DS
        POP  ES
        MOV  SI, OFFSET mapa_original
        MOV  DI, OFFSET mapa
        MOV  CX, LARG*ALT
        REP  MOVSB
        POP  ES
        MOV  restantes, 208     ; 204 pontos + 4 pílulas
        MOV  AL, fase           ; fantasmas mais rápidos a cada fase
        CMP  AL, 3
        JBE  @@vel
        MOV  AL, 3
@@vel:  MOV  AH, VEL_FANT
        SUB  AH, AL
        MOV  fant_vel, AH
        CALL LIMPA_TELA
        CALL DESENHA_MAPA
        CALL MOSTRA_STATUS
        CALL POSICOES_INICIAIS
        RET
NOVA_FASE ENDP

PROXIMA_FASE PROC
        MOV  CX, 8              ; o labirinto pisca: azul, branco, azul...
@@pisca:
        MOV  AL, COR_PAREDE
        TEST CL, 1
        JZ   @@cor
        MOV  AL, 0Fh
@@cor:  MOV  parede_cor, AL
        CALL DESENHA_MAPA
        PUSH CX
        MOV  CX, 20
@@espera:
        CALL ESPERA_RETRACO
        LOOP @@espera
        POP  CX
        LOOP @@pisca
        MOV  parede_cor, COR_PAREDE
        INC  fase
        CALL NOVA_FASE
        RET
PROXIMA_FASE ENDP

; POSICOES_INICIAIS: comilão embaixo, vermelho na porta, os outros na casinha
POSICOES_INICIAIS PROC
        MOV  pac_x, PAC_X0
        MOV  pac_y, PAC_Y0
        MOV  pac_dir, ESQUERDA
        MOV  pac_quer, ESQUERDA
        MOV  pac_conta, VEL_PAC
        MOV  pego, 0
        MOV  medo_tempo, 0
        MOV  modo_tempo, TEMPO_DISPERSA
        MOV  cacando, 0
        MOV  saida_tempo, 0
        XOR  BX, BX
@@fant: MOV  AL, casa_x[BX]
        MOV  fant_x[BX], AL
        MOV  fant_y[BX], LIN_TUNEL
        MOV  fant_estado[BX], EM_CASA
        MOV  fant_medo[BX], 0
        MOV  fant_dir[BX], CIMA
        MOV  fant_conta[BX], VEL_FANT
        INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
        MOV  fant_x[0], SAIDA_X ; o vermelho já começa do lado de fora
        MOV  fant_y[0], SAIDA_Y
        MOV  fant_estado[0], ATIVO
        MOV  fant_dir[0], ESQUERDA
        CALL DESENHA_PAC
        CALL DESENHA_FANTASMAS
        CALL PRONTO
        RET
POSICOES_INICIAIS ENDP

; PRONTO: "PRONTO!" no meio por 2 segundos antes de começar
PRONTO  PROC
        MOV  DH, TELA_LIN+12
        MOV  DL, TELA_COL+21
        MOV  AH, 0Eh
        MOV  SI, OFFSET txt_pronto
        CALL ESCREVE
        MOV  CX, 140
@@espera:
        CALL ESPERA_RETRACO
        LOOP @@espera
        MOV  DH, 12             ; apaga redesenhando as casas embaixo
        MOV  DL, 10
@@casa: CALL DESENHA_CASA
        INC  DL
        CMP  DL, 18
        JB   @@casa
        RET
PRONTO  ENDP

; PERDE_VIDA: o comilão gira (◄▲►▼) e some; os fantasmas voltam para casa
PERDE_VIDA PROC
        MOV  BX, 9000
        MOV  CL, 18
        CALL SOM_LIGA
        MOV  CX, 16
@@gira: PUSH CX
        MOV  BX, CX
        AND  BX, 3
        MOV  AL, giro[BX]
        MOV  AH, COR_PAC
        MOV  DL, pac_x
        MOV  DH, pac_y
        CALL POE_CASA
        MOV  CX, 6
@@espera:
        CALL ESPERA_RETRACO
        CALL SOM_ATUALIZA
        LOOP @@espera
        POP  CX
        LOOP @@gira
        DEC  vidas
        CALL MOSTRA_STATUS
        CMP  vidas, 0
        JE   @@fim
        CALL APAGA_TODOS
        CALL POSICOES_INICIAIS
@@fim:  RET
PERDE_VIDA ENDP

; APAGA_TODOS: redesenha as casas onde estão o comilão e os fantasmas
APAGA_TODOS PROC
        MOV  DL, pac_x
        MOV  DH, pac_y
        CALL DESENHA_CASA
        XOR  BX, BX
@@fant: MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        CALL DESENHA_CASA
        INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
        RET
APAGA_TODOS ENDP

; ===============================================================
; Tempos: dispersa/caça, medo e saída da casinha
; ===============================================================
CONTA_MODOS PROC
        DEC  modo_tempo         ; troca dispersa <-> caça
        JNZ  @@medo
        XOR  cacando, 1
        MOV  modo_tempo, TEMPO_CACA
        CMP  cacando, 1
        JE   @@vira
        MOV  modo_tempo, TEMPO_DISPERSA
@@vira: CALL VIRA_TODOS         ; na troca de modo, todos dão meia-volta
@@medo: CMP  medo_tempo, 0
        JE   @@saida
        DEC  medo_tempo
        JNZ  @@saida
        XOR  BX, BX             ; o medo acabou
@@calma:
        MOV  fant_medo[BX], 0
        INC  BX
        CMP  BX, FANTASMAS
        JB   @@calma
@@saida:
        INC  saida_tempo        ; um fantasma sai a cada 3 segundos
        CMP  saida_tempo, 210
        JB   @@fim
        MOV  saida_tempo, 0
        XOR  BX, BX
@@procura:
        CMP  fant_estado[BX], EM_CASA
        JE   @@solta
        INC  BX
        CMP  BX, FANTASMAS
        JB   @@procura
@@fim:  RET
@@solta:
        MOV  DL, fant_x[BX]     ; sai da casinha direto para a porta
        MOV  DH, fant_y[BX]
        CALL DESENHA_CASA
        MOV  fant_x[BX], SAIDA_X
        MOV  fant_y[BX], SAIDA_Y
        MOV  fant_estado[BX], ATIVO
        MOV  fant_dir[BX], ESQUERDA
        CALL DESENHA_FANTASMA
        RET
CONTA_MODOS ENDP

VIRA_TODOS PROC
        XOR  BX, BX
@@fant: CMP  fant_estado[BX], ATIVO
        JNE  @@prox
        XOR  fant_dir[BX], 2
@@prox: INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
        RET
VIRA_TODOS ENDP

; ===============================================================
; O comilão
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
        JNE  @@seta
        XOR  pausado, 1
        RET
@@seta: MOV  SI, OFFSET teclas_dir   ; procura o scan code na tabela
        XOR  BL, BL
@@olha: CMP  AH, [SI]
        JE   @@achou
        INC  SI
        INC  BL
        CMP  BL, 4
        JB   @@olha
        RET
@@achou:
        MOV  pac_quer, BL       ; vale assim que der para virar
        RET
LER_TECLADO ENDP

MOVE_PAC PROC
        DEC  pac_conta
        JZ   @@anda
        RET
@@anda: MOV  pac_conta, VEL_PAC
        MOV  DL, pac_x
        MOV  DH, pac_y
        MOV  AL, pac_quer       ; dá para ir para onde o jogador quer?
        XOR  AH, AH             ; (a porta da casinha é parede para ele)
        CALL PODE_ANDAR
        JC   @@reto
        MOV  pac_dir, AL
        JMP  SHORT @@move
@@reto: MOV  AL, pac_dir        ; senão, continua reto...
        CALL PODE_ANDAR
        JNC  @@move
        RET                     ; ...ou fica parado na parede
@@move: PUSH DX                 ; DX = casa nova
        MOV  DL, pac_x
        MOV  DH, pac_y
        CALL DESENHA_CASA       ; apaga o comilão da casa velha
        POP  DX
        MOV  pac_x, DL
        MOV  pac_y, DH
        CALL COME
        XOR  boca, 1            ; abre e fecha a boca
        CALL DESENHA_FANTASMAS  ; (a casa velha podia ter um fantasma)
        CALL DESENHA_PAC
        CALL ENCONTROS
        RET
MOVE_PAC ENDP

; COME: o que tinha na casa nova do comilão?
COME    PROC
        CALL CASA_NO_MAPA       ; BX = índice no mapa
        MOV  AL, mapa[BX]
        CMP  AL, '.'
        JE   @@ponto
        CMP  AL, 'o'
        JE   @@pilula
        RET
@@ponto:
        MOV  mapa[BX], ' '
        DEC  restantes
        ADD  pontos, 10
        MOV  BX, 5000           ; o "uaca" de cada ponto
        MOV  CL, 0
        CALL SOM_LIGA
        CALL MOSTRA_STATUS
        RET
@@pilula:
        MOV  mapa[BX], ' '
        DEC  restantes
        ADD  pontos, 50
        MOV  medo_tempo, TEMPO_MEDO
        MOV  combo, 200         ; o 1º fantasma comido vale 200, depois 400...
        XOR  BX, BX
@@assusta:
        CMP  fant_estado[BX], ATIVO
        JNE  @@prox
        MOV  fant_medo[BX], 1
        XOR  fant_dir[BX], 2    ; assustado, dá meia-volta
@@prox: INC  BX
        CMP  BX, FANTASMAS
        JB   @@assusta
        MOV  BX, 3000
        MOV  CL, 4
        CALL SOM_LIGA
        CALL MOSTRA_STATUS
        RET
COME    ENDP

; ===============================================================
; Os fantasmas
; ===============================================================
MOVE_FANTASMAS PROC
        XOR  BX, BX
@@fant: CMP  fant_estado[BX], EM_CASA
        JE   @@prox
        DEC  fant_conta[BX]
        JNZ  @@prox
        MOV  AL, fant_vel       ; a velocidade depende do estado
        CMP  fant_medo[BX], 0
        JE   @@olhos
        MOV  AL, VEL_MEDO
@@olhos:
        CMP  fant_estado[BX], OLHOS
        JNE  @@vel
        MOV  AL, VEL_OLHOS
@@vel:  MOV  fant_conta[BX], AL
        PUSH BX
        CALL PASSO_FANTASMA
        POP  BX
        CMP  pego, 0
        JNE  @@fim
@@prox: INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
@@fim:  RET
MOVE_FANTASMAS ENDP

; PASSO_FANTASMA: o fantasma BX escolhe a direção e anda uma casa
PASSO_FANTASMA PROC
        CALL ALVO               ; CL, CH = casa alvo
        CALL ESCOLHE            ; AL = direção
        MOV  fant_dir[BX], AL
        MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        MOV  AH, 1              ; fantasma pode passar pela porta
        CALL PODE_ANDAR         ; DX = casa nova
        JC   @@fim              ; (só se ficar preso: não acontece)
        PUSH DX
        MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        CALL DESENHA_CASA       ; apaga o fantasma (o ponto embaixo volta)
        CMP  DL, pac_x          ; estava em cima do comilão? mostra ele de novo
        JNE  @@nao_pac
        CMP  DH, pac_y
        JNE  @@nao_pac
        PUSH BX
        CALL DESENHA_PAC
        POP  BX
@@nao_pac:
        POP  DX
        MOV  fant_x[BX], DL
        MOV  fant_y[BX], DH
        CMP  fant_estado[BX], OLHOS
        JNE  @@desenha
        CMP  DL, SAIDA_X        ; os olhos chegaram na porta:
        JNE  @@desenha          ; o fantasma renasce
        CMP  DH, SAIDA_Y
        JNE  @@desenha
        MOV  fant_estado[BX], ATIVO
        MOV  fant_medo[BX], 0
@@desenha:
        CALL DESENHA_FANTASMA
        CALL ENCONTROS
@@fim:  RET
PASSO_FANTASMA ENDP

; ALVO: a casa que o fantasma BX quer alcançar (CL = x, CH = y).
; Cada um tem uma personalidade, como no fliperama:
;   0 vermelho: o próprio comilão
;   1 rosa:     4 casas na frente do comilão
;   2 ciano:    o ponto oposto ao vermelho, com o comilão no meio
;   3 laranja:  o comilão, mas foge para o canto quando chega perto
; No modo "dispersa", cada um vai para o seu canto.
ALVO    PROC
        CMP  fant_estado[BX], OLHOS
        JNE  @@vivo
        MOV  CL, SAIDA_X        ; olhos voltam para a porta
        MOV  CH, SAIDA_Y
        RET
@@vivo: MOV  CL, canto_x[BX]
        MOV  CH, canto_y[BX]
        CMP  cacando, 0
        JNE  @@caca
        RET
@@caca: MOV  CL, pac_x
        MOV  CH, pac_y
        CMP  BX, 1
        JB   @@fim              ; vermelho
        JA   @@ciano
        MOV  AL, pac_dir        ; rosa: soma 4 * direção
        XOR  AH, AH
        MOV  SI, AX
        MOV  AL, dir_x[SI]
        SHL  AL, 1
        SHL  AL, 1
        ADD  CL, AL
        MOV  AL, dir_y[SI]
        SHL  AL, 1
        SHL  AL, 1
        ADD  CH, AL
        RET
@@ciano:
        CMP  BX, 2
        JA   @@laranja
        SHL  CL, 1              ; 2 * comilão - vermelho
        SUB  CL, fant_x[0]
        SHL  CH, 1
        SUB  CH, fant_y[0]
        RET
@@laranja:
        CALL DISTANCIA          ; AX = distância² até o comilão
        CMP  AX, 64             ; mais perto que 8 casas: foge
        JAE  @@fim
        MOV  CL, canto_x[BX]
        MOV  CH, canto_y[BX]
@@fim:  RET
ALVO    ENDP

; ESCOLHE: em cada casa o fantasma testa as 4 direções (menos voltar
; para trás) e fica com a que deixa a casa seguinte mais perto do alvo.
; Assustado, ele escolhe uma direção possível ao acaso.
ESCOLHE PROC
        PUSH BX
        MOV  melhor_dist, 0FFFFh
        MOV  melhor_dir, 0FFh
        MOV  AL, fant_dir[BX]
        XOR  AL, 2
        MOV  proibida, AL       ; a direção contrária
        CMP  fant_medo[BX], 0
        JE   @@testa
        MOV  AX, 4              ; assustado: começa de uma direção sorteada
        CALL ALEATORIO
        MOV  primeira, AL
        JMP  SHORT @@inicio
@@testa:
        MOV  primeira, 0
@@inicio:
        MOV  DI, 4              ; 4 tentativas
        MOV  AL, primeira
@@dir:  AND  AL, 3
        CMP  AL, proibida
        JE   @@prox
        MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        MOV  AH, 1
        CMP  fant_estado[BX], OLHOS   ; só os olhos entram pela porta
        JE   @@porta                  ; (os outros só saem)
        CMP  DH, SAIDA_Y
        JB   @@porta
        CMP  AL, BAIXO
        JNE  @@porta
        XOR  AH, AH
@@porta:
        CALL PODE_ANDAR
        JC   @@prox
        CMP  fant_medo[BX], 0
        JNE  @@pega             ; assustado: a primeira que serve
        PUSH AX
        PUSH BX
        PUSH CX
        CALL DISTANCIA_DX       ; AX = distância² de DX até CX
        MOV  SI, AX
        POP  CX
        POP  BX
        POP  AX
        CMP  SI, melhor_dist
        JAE  @@prox
        MOV  melhor_dist, SI
@@pega: MOV  melhor_dir, AL
        CMP  fant_medo[BX], 0
        JNE  @@fim
@@prox: INC  AL
        DEC  DI
        JNZ  @@dir
@@fim:  MOV  AL, melhor_dir
        CMP  AL, 0FFh           ; beco sem saída: aí pode voltar
        JNE  @@ok
        MOV  AL, proibida
@@ok:   POP  BX
        RET
ESCOLHE ENDP

; DISTANCIA: AX = distância² entre o fantasma BX e o alvo CL, CH
DISTANCIA PROC
        MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        CALL DISTANCIA_DX
        RET
DISTANCIA ENDP

; DISTANCIA_DX: AX = (DL - CL)² + (DH - CH)². IMUL de 8 bits: o
; quadrado de um número com sinal cabe sempre em AX.
DISTANCIA_DX PROC
        PUSH BX
        MOV  AL, DL
        SUB  AL, CL
        IMUL AL                 ; AX = dx²
        MOV  BX, AX
        MOV  AL, DH
        SUB  AL, CH
        IMUL AL                 ; AX = dy²
        ADD  AX, BX
        POP  BX
        RET
DISTANCIA_DX ENDP

; ENCONTROS: o comilão está na mesma casa de algum fantasma?
ENCONTROS PROC
        PUSH BX
        XOR  BX, BX
@@fant: CMP  fant_estado[BX], ATIVO
        JNE  @@prox
        MOV  AL, fant_x[BX]
        CMP  AL, pac_x
        JNE  @@prox
        MOV  AL, fant_y[BX]
        CMP  AL, pac_y
        JNE  @@prox
        CMP  fant_medo[BX], 0
        JNE  @@come
        MOV  pego, 1            ; pegaram o comilão
        JMP  SHORT @@fim
@@come: MOV  fant_estado[BX], OLHOS   ; comeu o fantasma: viram olhos
        MOV  fant_medo[BX], 0
        MOV  AX, combo
        ADD  pontos, AX
        SHL  combo, 1           ; o próximo vale o dobro
        PUSH BX
        MOV  BX, 800
        MOV  CL, 3
        CALL SOM_LIGA
        CALL MOSTRA_STATUS
        POP  BX
        CALL DESENHA_FANTASMA
@@prox: INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
@@fim:  POP  BX
        RET
ENCONTROS ENDP

; ===============================================================
; Mapa
; ===============================================================

; PODE_ANDAR: a partir da casa DL, DH, anda na direção AL.
; AH = 1 deixa passar pela porta da casinha. Devolve DX = casa nova
; e CF = 0, ou CF = 1 (e DX sem mudar) se for parede.
PODE_ANDAR PROC
        PUSH BX
        PUSH DX
        PUSH AX
        MOV  BL, AL
        XOR  BH, BH
        ADD  DL, dir_x[BX]
        ADD  DH, dir_y[BX]
        CMP  DL, 0FFh           ; túnel: saiu pela esquerda, entra pela direita
        JNE  @@dir
        MOV  DL, LARG-1
@@dir:  CMP  DL, LARG
        JB   @@olha
        XOR  DL, DL             ; e vice-versa
@@olha: CALL CASA_NO_MAPA
        MOV  AL, mapa[BX]
        CMP  AL, '#'
        JE   @@parede
        CMP  AL, '-'
        JNE  @@livre
        POP  AX
        PUSH AX
        OR   AH, AH
        JZ   @@parede
@@livre:
        POP  AX
        POP  BX                 ; descarta o DX velho
        POP  BX
        CLC
        RET
@@parede:
        POP  AX
        POP  DX
        POP  BX
        STC
        RET
PODE_ANDAR ENDP

; CASA_NO_MAPA: BX = DH * 28 + DL
CASA_NO_MAPA PROC
        PUSH AX
        MOV  AL, DH
        MOV  BL, LARG
        MUL  BL
        MOV  BL, DL
        XOR  BH, BH
        ADD  BX, AX
        POP  AX
        RET
CASA_NO_MAPA ENDP

; ===============================================================
; Desenho
; ===============================================================

; POE_CASA: escreve AL com cor AH nas duas colunas da casa DL, DH.
; A segunda coluna recebe o mesmo caractere, a não ser que seja um
; ponto (aí fica em branco, para o ponto não sair dobrado).
POE_CASA PROC
        PUSH DX
        PUSH DI
        PUSH AX
        SHL  DL, 1
        ADD  DL, TELA_COL
        ADD  DH, TELA_LIN
        CALL POSICAO
        STOSW
        POP  AX
        PUSH AX
        CMP  AL, 0FAh           ; ponto: a outra metade é espaço
        JE   @@meio
        CMP  AL, 07h            ; pílula também
        JNE  @@igual
@@meio: MOV  AL, ' '
@@igual:
        STOSW
        POP  AX
        POP  DI
        POP  DX
        RET
POE_CASA ENDP

; DESENHA_CASA: desenha o que o mapa tem na casa DL, DH
DESENHA_CASA PROC
        PUSH AX
        PUSH BX
        CALL CASA_NO_MAPA
        MOV  AL, mapa[BX]
        MOV  AH, parede_cor
        CMP  AL, '#'
        JNE  @@ponto
        MOV  AL, 0DBh
        JMP  SHORT @@poe
@@ponto:
        MOV  AH, COR_PONTO
        CMP  AL, '.'
        JNE  @@pilula
        MOV  AL, 0FAh           ; ·
        JMP  SHORT @@poe
@@pilula:
        MOV  AH, COR_PILULA
        CMP  AL, 'o'
        JNE  @@porta
        MOV  AL, 07h            ; •
        JMP  SHORT @@poe
@@porta:
        MOV  AH, COR_PORTA
        CMP  AL, '-'
        JNE  @@vazio
        MOV  AL, 0C4h           ; ─
        JMP  SHORT @@poe
@@vazio:
        MOV  AX, 0720h
@@poe:  CALL POE_CASA
        POP  BX
        POP  AX
        RET
DESENHA_CASA ENDP

DESENHA_MAPA PROC
        XOR  DH, DH
@@linha:
        XOR  DL, DL
@@coluna:
        CALL DESENHA_CASA
        INC  DL
        CMP  DL, LARG
        JB   @@coluna
        INC  DH
        CMP  DH, ALT
        JB   @@linha
        RET
DESENHA_MAPA ENDP

; DESENHA_PAC: o comilão é ◄ ▲ ► ▼ (boca aberta) ou ☻ (boca fechada)
DESENHA_PAC PROC
        MOV  BL, pac_dir
        XOR  BH, BH
        MOV  AL, boca_aberta[BX]
        CMP  boca, 0
        JE   @@poe
        MOV  AL, 02h            ; ☻
@@poe:  MOV  AH, COR_PAC
        MOV  DL, pac_x
        MOV  DH, pac_y
        CALL POE_CASA
        RET
DESENHA_PAC ENDP

DESENHA_FANTASMAS PROC
        XOR  BX, BX
@@fant: CALL DESENHA_FANTASMA
        INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
        RET
DESENHA_FANTASMAS ENDP

; DESENHA_FANTASMA: Ω na cor dele, azul se assustado (branco piscando
; no fim do medo) ou só os olhos °° se foi comido
DESENHA_FANTASMA PROC
        PUSH BX
        MOV  AL, 0EAh           ; Ω
        MOV  AH, cor_fant[BX]
        CMP  fant_medo[BX], 0
        JE   @@olhos
        MOV  AH, COR_MEDO
        CMP  medo_tempo, 120    ; últimos 2 segundos: alterna as cores
        JA   @@olhos
        TEST medo_tempo, 16
        JZ   @@olhos
        MOV  AH, COR_MEDO_FIM
@@olhos:
        CMP  fant_estado[BX], OLHOS
        JNE  @@poe
        MOV  AX, COR_OLHOS*256 + 0F8h   ; °
@@poe:  MOV  DL, fant_x[BX]
        MOV  DH, fant_y[BX]
        CALL POE_CASA
        POP  BX
        RET
DESENHA_FANTASMA ENDP

MOSTRA_STATUS PROC
        XOR  DH, DH
        MOV  DL, TELA_COL
        MOV  AH, 07h
        MOV  SI, OFFSET txt_status
        CALL ESCREVE
        MOV  DL, TELA_COL+7
        MOV  AX, pontos
        CALL ESCREVE_NUM
        MOV  DL, TELA_COL+24
        MOV  AX, recorde
        CALL ESCREVE_NUM
        MOV  DL, TELA_COL+38    ; vidas: um ☻ para cada uma
        CALL POSICAO
        MOV  CL, vidas
        XOR  CH, CH
        MOV  AX, COR_PAC*256 + 02h
        JCXZ @@resto
        REP  STOSW
@@resto:
        MOV  CL, 5
        SUB  CL, vidas
        MOV  AX, 0720h
        REP  STOSW
        RET
MOSTRA_STATUS ENDP

TELA_TITULO PROC
        CALL LIMPA_TELA
        MOV  parede_cor, COR_PAREDE
        MOV  DH, 3
        MOV  SI, OFFSET txt_titulo
@@linha:
        MOV  DL, 22
        MOV  AH, 0Eh
        CALL ESCREVE
        INC  DH
        CMP  BYTE PTR [SI], 0
        JNE  @@linha
        XOR  BX, BX             ; os quatro fantasmas, com nome
        MOV  DH, 11
@@fant: MOV  DL, 30
        MOV  AL, 0EAh
        MOV  AH, cor_fant[BX]
        CALL POE_CEL
        MOV  DL, 33
        SHL  BX, 1
        MOV  SI, nomes[BX]
        SHR  BX, 1
        CALL ESCREVE
        ADD  DH, 2
        INC  BX
        CMP  BX, FANTASMAS
        JB   @@fant
        MOV  DH, 20
        MOV  DL, 24
        MOV  AH, 07h
        MOV  SI, OFFSET txt_teclas
        CALL ESCREVE
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
@@msg:  MOV  DH, TELA_LIN+12
        MOV  DL, TELA_COL+19
        MOV  AH, 0Ch
        MOV  SI, OFFSET txt_fim
        CALL ESCREVE
@@limpa:
        MOV  AH, 01h
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
; Tela de texto, tempo, sorteio e som
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

ESCREVE_NUM PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH DI
        XOR  DH, DH
        CALL POSICAO
        ADD  DI, 8
        MOV  BX, 10
        MOV  CX, 5
@@dig:  XOR  DX, DX
        DIV  BX
        ADD  DL, '0'
        MOV  ES:[DI], DL
        MOV  BYTE PTR ES:[DI+1], 0Fh
        SUB  DI, 2
        LOOP @@dig
        POP  DI
        POP  DX
        POP  CX
        POP  BX
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
; # parede   . ponto   o pílula   - porta da casinha   G dentro da casinha
mapa_original DB '############################'
            DB '#............##............#'
            DB '#.####.#####.##.#####.####.#'
            DB '#o####.#####.##.#####.####o#'
            DB '#..........................#'
            DB '#.####.##.########.##.####.#'
            DB '#......##....##....##......#'
            DB '######.##### ## #####.######'
            DB '######.##          ##.######'
            DB '######.## ###--### ##.######'
            DB '      .   #GGGGGG#   .      '
            DB '######.## ######## ##.######'
            DB '######.##          ##.######'
            DB '######.## ######## ##.######'
            DB '#............##............#'
            DB '#.####.#####.##.#####.####.#'
            DB '#o..##.......  .......##..o#'
            DB '###.##.##.########.##.##.###'
            DB '#......##....##....##......#'
            DB '#.##########.##.##########.#'
            DB '#..........................#'
            DB '############################'

dir_x       DB 0, -1, 0, 1      ; cima, esquerda, baixo, direita
dir_y       DB -1, 0, 1, 0
teclas_dir  DB 48h, 4Bh, 50h, 4Dh
boca_aberta DB 1Fh, 10h, 1Eh, 11h   ; ▼ ► ▲ ◄ : a ponta aponta para trás
giro        DB 1Eh, 10h, 1Fh, 11h
cor_fant    DB 0Ch, 0Dh, 0Bh, 06h   ; vermelho, rosa, ciano, laranja
casa_x      DB 13, 12, 14, 15
canto_x     DB 25, 2, 27, 0     ; cantos do modo "dispersa"
canto_y     DB -2, -2, 22, 22
nomes       DW txt_f0, txt_f1, txt_f2, txt_f3

linhas      DW  0*160,  1*160,  2*160,  3*160,  4*160,  5*160,  6*160,  7*160
            DW  8*160,  9*160, 10*160, 11*160, 12*160, 13*160, 14*160, 15*160
            DW 16*160, 17*160, 18*160, 19*160, 20*160, 21*160, 22*160, 23*160
            DW 24*160

txt_status  DB 'PONTOS          RECORDE          VIDAS', 0
txt_pronto  DB 'PRONTO!', 0
txt_fim     DB 'FIM DE JOGO', 0
txt_titulo  DB '  L  A  B  I  R  I  N  T  O', 0
            DB ' ', 0
            DB '  coma os pontos, fuja dos', 0
            DB '  fantasmas; a pilula vira', 0
            DB '  o jogo por alguns segundos', 0, 0
txt_f0      DB 'SOMBRA   (persegue)', 0
txt_f1      DB 'LIGEIRA  (embosca)', 0
txt_f2      DB 'MANHOSO  (cerca)', 0
txt_f3      DB 'LERDO    (vai e volta)', 0
txt_teclas  DB 'ENTER joga   setas   ESC sai', 0

; estado
mapa        DB LARG*ALT DUP (0)
pontos      DW 0
recorde     DW 0
vidas       DB 3
fase        DB 0
restantes   DW 0
pac_x       DB 0
pac_y       DB 0
pac_dir     DB 0
pac_quer    DB 0
pac_conta   DB 0
boca        DB 0
pego        DB 0
parede_cor  DB COR_PAREDE
fant_vel    DB VEL_FANT
fant_x      DB FANTASMAS DUP (0)
fant_y      DB FANTASMAS DUP (0)
fant_dir    DB FANTASMAS DUP (0)
fant_estado DB FANTASMAS DUP (0)
fant_medo   DB FANTASMAS DUP (0)
fant_conta  DB FANTASMAS DUP (1)
medo_tempo  DW 0
modo_tempo  DW 0
saida_tempo DW 0
cacando     DB 0
combo       DW 200
melhor_dist DW 0
melhor_dir  DB 0
proibida    DB 0
primeira    DB 0
pausado     DB 0
sair_pedido DB 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0

END inicio
```

## Exercícios

```exercicio
id: a39-1
titulo: Da casa para o mapa
nivel: 1
--- enunciado
O labirinto tem 28 casas por linha. DL chega com o x da casa e DH com o y. Devolva **BX = DH × 28 + DL**, o índice da casa no mapa. **AX** precisa voltar com o valor original.
--- inicial
; DL = x, DH = y  ->  BX = y * 28 + x  (preserve AX)
--- testes
[{ "nome": "casa (0, 0)", "setup": { "DX": 0, "AX": 4660 }, "espera": { "BX": 0, "preservar": ["AX"] } },
 { "nome": "o comilão em (13, 16)", "setup": { "DX": 4109, "AX": 4660 }, "espera": { "BX": 461, "preservar": ["AX"] } },
 { "nome": "a última casa (27, 21)", "setup": { "DX": 5403, "AX": 1 }, "espera": { "BX": 615, "preservar": ["AX"] } },
 { "nome": "linha do túnel (0, 10)", "setup": { "DX": 2560, "AX": 65535 }, "espera": { "BX": 280, "preservar": ["AX"] } }]
--- dicas
MUL de 8 bits usa AL e devolve em AX: guarde AX na pilha antes.
MOV AL,DH / MOV BL,28 / MUL BL dá AX = y × 28.
Some x: MOV BL,DL / XOR BH,BH / ADD BX,AX. Depois POP AX.
--- solucao
; DL = x, DH = y  ->  BX = y * 28 + x  (preserve AX)
        PUSH AX
        MOV  AL, DH
        MOV  BL, 28
        MUL  BL
        MOV  BL, DL
        XOR  BH, BH
        ADD  BX, AX
        POP  AX
```

```exercicio
id: a39-2
titulo: Distância ao quadrado
nivel: 2
exigir: IMUL
--- enunciado
DL, DH é uma casa e CL, CH é o alvo (os dois em bytes **com sinal**: o alvo pode estar fora do mapa, com y = −2, por exemplo). Devolva **AX = (DL − CL)² + (DH − CH)²**. BX, CX e DX precisam voltar com os valores originais.
--- inicial
; DL, DH = casa; CL, CH = alvo
; AX = (DL - CL)^2 + (DH - CH)^2
--- testes
[{ "nome": "mesma coluna, 8 casas acima", "setup": { "DX": 4109, "CX": 2061, "BX": 7 }, "espera": { "AX": 64, "preservar": ["BX", "CX", "DX"] } },
 { "nome": "cantos opostos", "setup": { "DX": 0, "CX": 5403, "BX": 7 }, "espera": { "AX": 1170, "preservar": ["BX", "CX", "DX"] } },
 { "nome": "alvo fora do mapa (25, -2)", "setup": { "DX": 1285, "CX": 65049 }, "espera": { "AX": 449, "preservar": ["CX", "DX"] } },
 { "nome": "mesma casa", "setup": { "DX": 2570, "CX": 2570 }, "espera": { "AX": 0 } },
 { "nome": "alvo à esquerda e abaixo", "setup": { "DX": 1290, "CX": 2563 }, "espera": { "AX": 74 } }]
--- dicas
MOV AL,DL / SUB AL,CL / IMUL AL dá AX = dx² (com sinal).
Guarde esse resultado em BX (empilhe o BX original antes) e faça o mesmo com DH e CH.
ADD AX,BX e restaure BX.
--- solucao
; DL, DH = casa; CL, CH = alvo
        PUSH BX
        MOV  AL, DL
        SUB  AL, CL
        IMUL AL
        MOV  BX, AX
        MOV  AL, DH
        SUB  AL, CH
        IMUL AL
        ADD  AX, BX
        POP  BX
```

```exercicio
id: a39-3
titulo: Andar pelo túnel
nivel: 2
--- enunciado
DL, DH é a casa atual e AL a direção (0 cima, 1 esquerda, 2 baixo, 3 direita). Use as tabelas `dir_x` e `dir_y` para devolver em **DL, DH** a casa vizinha naquela direção. O labirinto tem 28 colunas e um **túnel**: quem sai pela esquerda (x = −1) entra na coluna 27, e quem sai pela direita (x = 28) entra na coluna 0.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL VIZINHA
        MOV  AX, 4C00h
        INT  21h

VIZINHA PROC
        ; AL = direção; DL, DH = casa -> DL, DH = casa vizinha
        RET
VIZINHA ENDP

dir_x   DB 0, -1, 0, 1      ; cima, esquerda, baixo, direita
dir_y   DB -1, 0, 1, 0
END inicio
--- testes
[{ "nome": "para cima", "setup": { "AL": 0, "DX": 1285 }, "espera": { "DX": 1029 } },
 { "nome": "para baixo", "setup": { "AL": 2, "DX": 771 }, "espera": { "DX": 1027 } },
 { "nome": "para a direita", "setup": { "AL": 3, "DX": 2560 }, "espera": { "DX": 2561 } },
 { "nome": "túnel pela esquerda", "setup": { "AL": 1, "DX": 2560 }, "espera": { "DX": 2587 } },
 { "nome": "túnel pela direita", "setup": { "AL": 3, "DX": 2587 }, "espera": { "DX": 2560 } }]
--- dicas
MOV BL,AL / XOR BH,BH e some dir_x[BX] em DL e dir_y[BX] em DH.
Se DL ficou FFh (−1), troque por 27. Se ficou 28, troque por 0.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL VIZINHA
        MOV  AX, 4C00h
        INT  21h

VIZINHA PROC
        MOV  BL, AL
        XOR  BH, BH
        ADD  DL, dir_x[BX]
        ADD  DH, dir_y[BX]
        CMP  DL, 0FFh           ; saiu pela esquerda
        JNE  @@dir
        MOV  DL, 27
@@dir:  CMP  DL, 28             ; saiu pela direita
        JB   @@fim
        XOR  DL, DL
@@fim:  RET
VIZINHA ENDP

dir_x   DB 0, -1, 0, 1      ; cima, esquerda, baixo, direita
dir_y   DB -1, 0, 1, 0
END inicio
```

```exercicio
id: a39-4
titulo: Os alvos da rosa e do ciano
nivel: 2
--- enunciado
Calcule o alvo do fantasma BX no modo perseguir, em **CL** (x) e **CH** (y):

- **BX = 1** (LIGEIRA, rosa): 4 casas na frente do comilão: `pac_x + 4 × dir_x[pac_dir]`, `pac_y + 4 × dir_y[pac_dir]`;
- **BX = 2** (MANHOSO, ciano): o ponto simétrico ao vermelho em relação ao comilão: `2 × pac_x − fant_x0`, `2 × pac_y − fant_y0`.

Os resultados são bytes com sinal e podem cair fora do labirinto.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL ALVO
        MOV  AX, 4C00h
        INT  21h

ALVO    PROC
        ; BX = 1 (rosa) ou 2 (ciano) -> CL, CH = alvo
        RET
ALVO    ENDP

pac_x   DB 10
pac_y   DB 16
pac_dir DB 1
fant_x0 DB 13               ; o vermelho
fant_y0 DB 8
dir_x   DB 0, -1, 0, 1      ; cima, esquerda, baixo, direita
dir_y   DB -1, 0, 1, 0
END inicio
--- testes
[{ "nome": "rosa, comilão indo para a esquerda", "setup": { "BX": 1, "CX": 0, "pac_x": 10, "pac_y": 16, "pac_dir": 1 }, "espera": { "CL": 6, "CH": 16 } },
 { "nome": "rosa, comilão descendo", "setup": { "BX": 1, "CX": 0, "pac_x": 10, "pac_y": 16, "pac_dir": 2 }, "espera": { "CL": 10, "CH": 20 } },
 { "nome": "rosa, alvo fora do mapa", "setup": { "BX": 1, "CX": 0, "pac_x": 13, "pac_y": 2, "pac_dir": 0 }, "espera": { "CL": 13, "CH": 254 } },
 { "nome": "ciano", "setup": { "BX": 2, "CX": 0, "pac_x": 10, "pac_y": 16, "fant_x0": 13, "fant_y0": 8 }, "espera": { "CL": 7, "CH": 24 } },
 { "nome": "ciano com alvo negativo", "setup": { "BX": 2, "CX": 0, "pac_x": 20, "pac_y": 4, "fant_x0": 5, "fant_y0": 10 }, "espera": { "CL": 35, "CH": 254 } }]
--- dicas
Comece com CL = pac_x e CH = pac_y.
Rosa: pegue a direção em SI (MOV AL,pac_dir / XOR AH,AH / MOV SI,AX), leia dir_x[SI], multiplique por 4 com dois SHL AL,1 e some em CL. O mesmo com dir_y e CH.
Ciano: SHL CL,1 / SUB CL,fant_x0, e o mesmo para CH.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CALL ALVO
        MOV  AX, 4C00h
        INT  21h

ALVO    PROC
        MOV  CL, pac_x
        MOV  CH, pac_y
        CMP  BX, 2
        JE   @@ciano
        MOV  AL, pac_dir        ; rosa: 4 casas à frente
        XOR  AH, AH
        MOV  SI, AX
        MOV  AL, dir_x[SI]
        SHL  AL, 1
        SHL  AL, 1
        ADD  CL, AL
        MOV  AL, dir_y[SI]
        SHL  AL, 1
        SHL  AL, 1
        ADD  CH, AL
        RET
@@ciano:
        SHL  CL, 1              ; 2 * comilão - vermelho
        SUB  CL, fant_x0
        SHL  CH, 1
        SUB  CH, fant_y0
        RET
ALVO    ENDP

pac_x   DB 10
pac_y   DB 16
pac_dir DB 1
fant_x0 DB 13               ; o vermelho
fant_y0 DB 8
dir_x   DB 0, -1, 0, 1      ; cima, esquerda, baixo, direita
dir_y   DB -1, 0, 1, 0
END inicio
```

```exercicio
id: a39-5
titulo: Para onde vai o fantasma?
nivel: 3
--- enunciado
Escreva **ESCOLHE**, o cérebro do fantasma. Ele está na casa (`fx`, `fy`) andando na direção `fdir`, e o seu alvo está em **CL** (x), **CH** (y). Devolva em **AL** a direção que ele vai tomar (0 cima, 1 esquerda, 2 baixo, 3 direita):

1. teste as direções **na ordem 0, 1, 2, 3**, pulando a **contrária** a `fdir` (`fdir XOR 2`);
2. para cada direção em que a casa vizinha não é parede, calcule a distância² dela até o alvo;
3. fique com a de **menor** distância; no empate, a que veio antes;
4. se nenhuma direção servir (beco sem saída), devolva a contrária.

As rotinas **VIZINHA** (DL, DH = casa, AL = direção → DL, DH = vizinha, CF = 1 se for parede) e **DISTANCIA_DX** (AX = distância² de DL, DH até CL, CH) já estão prontas, assim como as variáveis de trabalho `melhor`, `proibida` e `resposta`. O mapa de teste tem 9 × 7 casas.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
LARG    EQU 9
inicio: CALL ESCOLHE
        MOV  AH, 4Ch
        INT  21h

ESCOLHE PROC
        ; AL = direção escolhida
        RET
ESCOLHE ENDP

; VIZINHA: DL, DH = casa, AL = direção -> DL, DH = casa vizinha,
; CF = 1 se ela for parede. Preserva AX, BX e CX.
VIZINHA PROC
        PUSH AX
        PUSH BX
        MOV  BL, AL
        XOR  BH, BH
        ADD  DL, dir_x[BX]
        ADD  DH, dir_y[BX]
        MOV  AL, DH
        MOV  BL, LARG
        MUL  BL
        MOV  BL, DL
        XOR  BH, BH
        ADD  BX, AX
        CMP  mapa[BX], '#'
        CLC
        JNE  @@fim
        STC
@@fim:  POP  BX
        POP  AX
        RET
VIZINHA ENDP

; DISTANCIA_DX: AX = (DL - CL)^2 + (DH - CH)^2. Preserva BX, CX e DX.
DISTANCIA_DX PROC
        PUSH BX
        MOV  AL, DL
        SUB  AL, CL
        IMUL AL
        MOV  BX, AX
        MOV  AL, DH
        SUB  AL, CH
        IMUL AL
        ADD  AX, BX
        POP  BX
        RET
DISTANCIA_DX ENDP

mapa    DB '#########'
        DB '#.......#'
        DB '#.#.#.#.#'
        DB '#.......#'
        DB '#.#.#.#.#'
        DB '#.###...#'
        DB '#########'
dir_x   DB 0, -1, 0, 1
dir_y   DB -1, 0, 1, 0
fx      DB 3
fy      DB 3
fdir    DB 3
melhor  DW 0
proibida DB 0
resposta DB 0
END inicio
--- testes
[{ "nome": "cruzamento: a direita fica mais perto", "setup": { "AX": 0, "fx": 3, "fy": 3, "fdir": 3, "CX": 263 }, "espera": { "AL": 3 } },
 { "nome": "empate entre esquerda e direita", "setup": { "AX": 0, "fx": 3, "fy": 3, "fdir": 0, "CX": 1283 }, "espera": { "AL": 1 } },
 { "nome": "o alvo está atrás: não pode voltar", "setup": { "AX": 0, "fx": 3, "fy": 3, "fdir": 2, "CX": 3 }, "espera": { "AL": 1 } },
 { "nome": "beco sem saída: volta", "setup": { "AX": 3, "fx": 1, "fy": 5, "fdir": 2, "CX": 263 }, "espera": { "AL": 0 } },
 { "nome": "esquina: desce", "setup": { "AX": 0, "fx": 5, "fy": 1, "fdir": 1, "CX": 1285 }, "espera": { "AL": 2 } }]
--- dicas
Comece com melhor = 0FFFFh, proibida = fdir XOR 2 e resposta = proibida (o caso do beco).
Laço com AL de 0 a 3: pule se AL = proibida; DL = fx, DH = fy, CALL VIZINHA; se CF = 1, pule.
Guarde AX na pilha, CALL DISTANCIA_DX, ponha o resultado em SI e recupere AX.
CMP SI,melhor / JAE pula (empate fica com a anterior); senão melhor = SI e resposta = AL. No fim, AL = resposta.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
LARG    EQU 9
inicio: CALL ESCOLHE
        MOV  AH, 4Ch
        INT  21h

ESCOLHE PROC
        MOV  melhor, 0FFFFh
        MOV  AL, fdir
        XOR  AL, 2
        MOV  proibida, AL
        MOV  resposta, AL       ; beco sem saída: volta
        XOR  AL, AL
@@dir:  CMP  AL, proibida
        JE   @@prox
        MOV  DL, fx
        MOV  DH, fy
        CALL VIZINHA
        JC   @@prox
        PUSH AX
        CALL DISTANCIA_DX
        MOV  SI, AX
        POP  AX
        CMP  SI, melhor
        JAE  @@prox
        MOV  melhor, SI
        MOV  resposta, AL
@@prox: INC  AL
        CMP  AL, 4
        JB   @@dir
        MOV  AL, resposta
        RET
ESCOLHE ENDP

; VIZINHA: DL, DH = casa, AL = direção -> DL, DH = casa vizinha,
; CF = 1 se ela for parede. Preserva AX, BX e CX.
VIZINHA PROC
        PUSH AX
        PUSH BX
        MOV  BL, AL
        XOR  BH, BH
        ADD  DL, dir_x[BX]
        ADD  DH, dir_y[BX]
        MOV  AL, DH
        MOV  BL, LARG
        MUL  BL
        MOV  BL, DL
        XOR  BH, BH
        ADD  BX, AX
        CMP  mapa[BX], '#'
        CLC
        JNE  @@fim
        STC
@@fim:  POP  BX
        POP  AX
        RET
VIZINHA ENDP

; DISTANCIA_DX: AX = (DL - CL)^2 + (DH - CH)^2. Preserva BX, CX e DX.
DISTANCIA_DX PROC
        PUSH BX
        MOV  AL, DL
        SUB  AL, CL
        IMUL AL
        MOV  BX, AX
        MOV  AL, DH
        SUB  AL, CH
        IMUL AL
        ADD  AX, BX
        POP  BX
        RET
DISTANCIA_DX ENDP

mapa    DB '#########'
        DB '#.......#'
        DB '#.#.#.#.#'
        DB '#.......#'
        DB '#.#.#.#.#'
        DB '#.###...#'
        DB '#########'
dir_x   DB 0, -1, 0, 1
dir_y   DB -1, 0, 1, 0
fx      DB 3
fy      DB 3
fdir    DB 3
melhor  DW 0
proibida DB 0
resposta DB 0
END inicio
```

## Desafios

1. **Fruta bônus.** Depois de 70 pontos comidos, uma fruta (o caractere ♣, 05h) aparece embaixo da casinha por 10 segundos e vale 100 pontos × (fase + 1).
2. **O alvo verdadeiro do ciano.** Troque o alvo do MANHOSO pelo do fliperama: tome a casa **2 à frente** do comilão, e o alvo é o dobro do vetor que vai do vermelho até ela.
3. **Fantasmas mais lentos no túnel.** No original, os fantasmas andam devagar na linha do túnel. Use outra velocidade quando `fant_y` for `LIN_TUNEL` e x estiver fora do miolo do labirinto.
4. **Elroy.** Quando restarem menos de 20 pontos, o vermelho acelera e passa a perseguir mesmo no modo dispersar (no fliperama, esse estado se chama "Cruise Elroy").
5. **Labirintos novos.** Desenhe um segundo labirinto do mesmo tamanho e alterne a cada fase, mantendo a casinha e o túnel nas mesmas posições (ou guardando as posições em variáveis).

## Sete jogos, as mesmas ferramentas

Com o LABIRINTO, o módulo fecha sete jogos completos. Olhando para eles juntos, dá para ver que todos foram montados com uma caixa de ferramentas pequena, e que cada um acrescenta uma ou duas ideias novas:

| Jogo | Aula | Vídeo | Relógio | Teclado | A ideia própria |
|------|------|-------|---------|---------|-----------------|
| COBRA | [33](aula:aula33) | texto, B800h | tiques (INT 1Ah) | INT 16h | fila circular com máscara para o corpo |
| PONG | [34](aula:aula34) | 13h, A000h | retraço | INT 9 própria | ponto fixo, rebote, adversário do computador |
| INVASOR | [35](aula:aula35) | 13h, A000h | retraço | INT 9 própria | formação de 55 inimigos, sprites, tiros e escudos |
| BLOCOS | [36](aula:aula36) | texto, B800h | tiques (INT 1Ah) | INT 16h | peças como bitmaps 4 × 4 em words, rotação, linhas cheias |
| PAREDÃO | [37](aula:aula37) | 13h, A000h | retraço | INT 9 própria | colisão por eixo, índice do tijolo, fases em bits |
| SAPO | [38](aula:aula38) | texto, B800h | tiques (INT 1Ah) | INT 16h | faixas como anéis com deslocamento |
| LABIRINTO | 39 | texto, B800h | retraço | INT 16h | fantasmas com alvos, modos e estados |

```diagrama titulo="A caixa de ferramentas comum"
                         ┌──────────────────────────────┐
                         │      o laço do jogo          │
                         │ espera ─► lê ─► move ─►      │
                         │ colide ─► desenha ─► repete  │
                         └──────────────┬───────────────┘
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌──────────┐
   │ TEMPO   │   │ TECLADO  │   │ VÍDEO      │   │ SOM      │   │ ACASO    │
   │ retraço │   │ INT 16h  │   │ B800h:     │   │ PIT can.2│   │ LCG      │
   │ 3DAh    │   │ ou INT 9 │   │ linha×160  │   │ porta 61h│   │ semente  │
   │ tiques  │   │ com      │   │ A000h:     │   │ desliga  │   │ do       │
   │ INT 1Ah │   │ tabela   │   │ y×320+x    │   │ por hora │   │ relógio  │
   └─────────┘   └──────────┘   └────────────┘   └──────────┘   └──────────┘
        │              │               │               │              │
        └──────────────┴───── o estado do jogo em tabelas ────────────┘
             vetores paralelos, mapas em bytes, desenhos em bits,
             constantes EQU, só o que muda é redesenhado
```

Algumas lições valem para os sete:

- **Estado em tabelas, não em código.** Pontos por fileira, períodos das faixas, alvos dos fantasmas, formas das peças: tudo isso são vetores. Mudar o jogo é mudar dados.
- **Redesenhar só o que mudou**, e reconstruir o fundo a partir do estado (o mapa do LABIRINTO, as faixas do SAPO, o tabuleiro do BLOCOS).
- **Contadores no lugar de esperas.** Nenhum jogo para para esperar um som ou um inimigo: tudo é "faltam N quadros" ou "desliga no tique T".
- **Escolher o relógio certo**: o retraço para movimento suave, o tique da BIOS quando a grade é grossa.
- **Escolher o teclado certo**: INT 16h quando cada aperto é uma ação, INT 9 própria quando importa se a tecla está apertada agora.
- **A BIOS como base e o DOS no mínimo.** Os sete usam da INT 21h só as funções 25h, 35h (vetores) e 4Ch (sair), e às vezes 02h e 09h para texto. O [capítulo 20 do livro](livro:cap20) reúne os serviços de BIOS e o hardware que eles usam.

Esse último ponto é a ponte para o próximo módulo. Se um jogo só precisa de quatro ou cinco funções do DOS, **qualquer sistema que ofereça essas funções** consegue rodá-lo. No **módulo 14** você vai construir exatamente esse sistema: o **MINIOS**, com um setor de boot que a BIOS carrega pela INT 19h ([capítulo 12](livro:cap12) e [capítulo 21](livro:cap21)), um kernel que instala a sua própria INT 21h, um sistema de arquivos simples num disquete, um shell com comandos e utilitários. E no disquete do MINIOS estarão estes sete jogos, rodando sem mudar um byte. A jornada começa na [Aula 40](aula:aula40); o [capítulo 22](livro:cap22) mostra como o DOS de verdade faz as mesmas coisas.

## No livro

- [Capítulo 3: vídeo, modos e texto](livro:cap03): o modo 03h, a memória B800h, a INT 10h para esconder o cursor e voltar ao modo texto.
- [Capítulo 4: paleta, fontes e strings](livro:cap04): os caracteres da página de código 437 e o bit de piscar do atributo, usado pelas pílulas.
- [Capítulo 6: teclado](livro:cap06): INT 16h, funções 00h e 01h, e os scan codes das setas da tabela `teclas_dir`.
- [Capítulo 7: tempo e relógios](livro:cap07): a INT 1Ah que semeia o gerador de acaso e mede os bipes.
- [Capítulo 20: a BIOS para jogos](livro:cap20): o retraço vertical (porta 3DAh), o relógio deste jogo.
- [Capítulo 21: sem DOS](livro:cap21) e [capítulo 22: o DOS por dentro](livro:cap22): o caminho do módulo 14.

:::resumo
- O LABIRINTO é um Pac-Man de 28 × 22 casas em modo texto: 204 pontos, 4 pílulas, 4 fantasmas, túnel e casinha.
- O mapa é um vetor de bytes (`#`, `.`, `o`, `-`) copiado do original a cada fase com `REP MOVSB`; comer é trocar `.` por espaço.
- As direções 0 cima, 1 esquerda, 2 baixo, 3 direita fazem da contrária um `XOR 2`; as tabelas `dir_x` e `dir_y` transformam direção em passo.
- `PODE_ANDAR` trata parede, porta (só para quem pode) e túnel, e responde no CF.
- Cada fantasma escolhe, em cada casa, a direção (sem meia-volta) que deixa a casa vizinha mais perto do seu **alvo**, pela distância² calculada com `IMUL`; assustado, escolhe ao acaso.
- As personalidades são só alvos diferentes: o comilão, 4 casas à frente, o simétrico do vermelho, ou o canto quando perto demais. No modo dispersar, cada um mira o seu canto.
- Estados EM_CASA, ATIVO e OLHOS, mais o medo; tudo cronometrado em quadros do retraço (70 por segundo).
- Os sete jogos do módulo usam a mesma caixa de ferramentas e quase nada do DOS, e por isso vão rodar no MINIOS do módulo 14.
:::
