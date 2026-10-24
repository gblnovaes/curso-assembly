---
id: aula33
numero: 33
modulo: 13
titulo: COBRA, o jogo da cobrinha
subtitulo: Uma fila circular, a tela como mapa de colisão e um jogo completo em modo texto
duracao: 120 min
objetivos: conhecer a história do jogo da cobrinha, de Blockade ao Nibbles do QBasic; entender a arquitetura completa de um jogo em modo texto (variáveis, laço, procedimentos); guardar o corpo da cobra numa fila circular com índices mascarados; usar a própria memória de vídeo como mapa de colisão; separar a direção pedida da direção aplicada para impedir a meia-volta; sortear comida só em células vazias; acelerar o jogo com o placar; ler a listagem completa do COBRA.ASM
---

## Um jogo que cabe numa linha de texto

Poucos jogos são tão simples de explicar: você guia uma cobra que não para de andar; cada comida que ela engole a faz crescer; bater na parede ou no próprio corpo acaba a partida. E poucos jogos tiveram tantas vidas.

```diagrama titulo="A árvore genealógica da cobrinha"
  1976  Blockade (Gremlin, fliperama)        dois jogadores deixam rastros; quem bater primeiro perde
    │
  1977  Surround (Atari 2600)                 a mesma ideia no console de casa
    │
  1978  Worm (TRS-80)                         uma cobra só, contra o computador
    │
  1982  Nibbler (Rock-Ola, fliperama)         labirintos e comida: a cobra que come
    │
  1991  NIBBLES.BAS (MS-DOS 5.0, QBasic)      a cobrinha chega a todo PC com DOS
    │
  1997  Snake (Nokia 6110)                    a cobrinha vai para o bolso de milhões
```

:::anos90 NIBBLES.BAS
Quem tinha um PC com MS-DOS 5 ou 6 tinha, sem saber, um jogo da cobrinha: o arquivo **NIBBLES.BAS**, um exemplo que a Microsoft incluiu com o QBasic. Bastava digitar `QBASIC /RUN NIBBLES` para jogar em modo texto, com cobras de caracteres coloridos. Como o fonte vinha junto, uma geração inteira aprendeu a programar mexendo nele: mudando a velocidade, as cores, as fases. Um detalhe famoso: o NIBBLES calibrava a velocidade com um laço de atraso, e nos PCs mais rápidos a cobra ficava incontrolável, o problema que você aprendeu a evitar na [Aula 32](aula:aula32).
:::

A nossa versão, o **COBRA.ASM**, é um .COM de cerca de 4 KB (metade deles é a fila do corpo), em modo texto 80x25, que roda em qualquer PC desde o IBM PC original de 1981 com placa CGA. Ela usa todas as técnicas da [Aula 32](aula:aula32): laço de jogo com os tiques da BIOS, teclado sem esperar, sorteio com LCG, escrita direta em B800h e som pelo PIT. E acrescenta duas ideias que são o coração desta aula: a **fila circular** e a **tela como mapa**.

## As regras

- A cobra começa com 4 gomos no meio do campo, andando para a direita.
- As **setas** mudam a direção. Não dá para dar meia-volta (indo para a direita, a seta para a esquerda é ignorada): a cabeça bateria no próprio pescoço.
- Cada **♦** comido vale **10 pontos** e faz a cobra crescer um gomo. Uma nova comida aparece num lugar vazio sorteado.
- A cada **5 comidas**, a cobra fica mais rápida (até o limite de um passo por tique, 18 passos por segundo).
- Bater na moldura ou no próprio corpo termina a partida. O **recorde** fica guardado enquanto o programa estiver aberto.
- **P** pausa e continua; **ESC** volta à tela de título; na tela de título, **ENTER** joga e **ESC** sai para o DOS.

## A tela

```diagrama titulo="A tela do COBRA (80 x 25 em modo texto)"
  coluna: 0 1                                                                  78 79
        ┌──────────────────────────────────────────────────────────────────────────┐
  linha 0│ COBRA 1.0             Pontos: 00030           Recorde: 00000    PAUSA   │ status (1Fh)
        ├──────────────────────────────────────────────────────────────────────────┤
  linha 1│╔════════════════════════════════════════════════════════════════════════╗│ moldura
  linha 2│║                                                                        ║│ ◄─ TOPO = 2
        │║                                                                        ║│
        │║                ███████☻                                                ║│ cobra
        │║                                                                        ║│
        │║                                          ♦                             ║│ comida
        │║                                                                        ║│
  linha23│║                                                                        ║│ ◄─ BASE = 23
  linha24│╚════════════════════════════════════════════════════════════════════════╝│ moldura
        └──────────────────────────────────────────────────────────────────────────┘
          ▲                                                                        ▲
          ESQ = 1                                                            DIR = 78
```

O campo de jogo vai da linha 2 à 23 e da coluna 1 à 78: 22 × 78 = 1.716 células. As constantes `TOPO`, `BASE`, `ESQ` e `DIR` no começo do fonte dizem isso ao programa inteiro, e são usadas tanto para desenhar a moldura quanto para sortear a comida.

| Objeto | Caractere | Código CP437 | Cor (atributo) |
|--------|-----------|--------------|----------------|
| cabeça | ☻ | 02h | 0Eh, amarelo |
| corpo | █ | DBh | 0Ah, verde claro |
| comida | ♦ | 04h | 0Ch, vermelho claro |
| moldura | ╔ ═ ╗ ║ ╚ ╝ | C9h CDh BBh BAh C8h BCh | 09h, azul claro |
| linha de status | texto | | 1Fh, branco no azul |
| "PAUSA" | texto | | 9Eh, amarelo no azul, **piscando** (bit 7) |

:::cpu Os caracteres semigráficos
O conjunto de caracteres do IBM PC (a **página de código 437**) tem, além das letras, carinhas (01h, 02h), naipes de baralho (03h a 06h), setas e um bloco inteiro de linhas simples e duplas para desenhar caixas (B3h a DAh), além dos blocos cheios e sombreados (B0h a DFh). Eles estão gravados na ROM da placa de vídeo e funcionam em qualquer modo texto, sem nenhuma programação gráfica. Foi com eles que se desenharam as telas do Norton Commander, do Turbo Pascal e de centenas de jogos. O [capítulo 3 do livro](livro:cap03) fala do modo texto e o [capítulo 4](livro:cap04) das fontes.
:::

## A arquitetura

### As constantes

```asm fragmento titulo="COBRA.ASM: constantes"
TOPO        EQU 2           ; primeira linha dentro do campo
BASE        EQU 23          ; última linha dentro do campo
ESQ         EQU 1           ; primeira coluna dentro do campo
DIR         EQU 78          ; última coluna dentro do campo
MAX_CORPO   EQU 1024        ; tamanho da fila circular (potência de 2)
MASCARA     EQU MAX_CORPO-1

CAR_CABECA  EQU 2           ; ☻
CAR_CORPO   EQU 0DBh        ; █
CAR_COMIDA  EQU 4           ; ♦
...
TECLA_CIMA  EQU 48h         ; códigos de varredura (scan codes)
TECLA_BAIXO EQU 50h
TECLA_ESQ   EQU 4Bh
TECLA_DIR   EQU 4Dh
```

Constantes `EQU` não ocupam memória: o montador troca o nome pelo número em cada uso. Trocar `CAR_CORPO` por `0B1h` (▒) muda a cara da cobra no programa inteiro com uma linha.

### As variáveis

```asm fragmento titulo="COBRA.ASM: variáveis"
pontos      DW 0
recorde     DW 0
comidas     DB 0
passo       DB 4                ; tiques por passo da cobra
vivo        DB 1
pausado     DB 0
sair_pedido DB 0
dx_cobra    DB 1                ; direção atual (-1, 0 ou 1)
dy_cobra    DB 0
dx_novo     DB 1                ; direção pedida pelo teclado
dy_novo     DB 0
ultimo_tique DW 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0
cabeca      DW 0                ; índices na fila circular
cauda       DW 0
corpo       DW MAX_CORPO DUP (0)    ; posições dos gomos: DH = linha, DL = coluna
```

Repare no que **não** está aqui: não há um mapa do campo. Não há uma matriz de 22 × 78 dizendo onde está cada gomo, onde está a comida ou onde fica a parede. Essa informação já existe, de graça, num lugar que o programa precisa manter atualizado de qualquer jeito: **a própria tela**.

### Os procedimentos

```diagrama titulo="Quem chama quem"
  inicio
   ├─ ESCONDE_CURSOR, SEMEIA
   └─► @@titulo: TELA_TITULO ── ENTER ──► NOVO_JOGO
                     │                       │
                    ESC                      ▼
                     │            ┌─► @@laco: LER_TECLADO ─── ESC ──► @@titulo
                     ▼            │           │
                  @@sair          │       (pausado? pula ANDAR)
          SOM_DESLIGA, modo 03h,  │           ▼
                 INT 21h/4Ch      │         ANDAR ──── bateu ──► FIM_DE_JOGO ──► @@titulo
                                  │           │          │
                                  │           │       comeu ──► NOVA_COMIDA, SOM_LIGA,
                                  │           ▼                 MOSTRA_STATUS
                                  └─── SOM_ATUALIZA, ESPERA_PASSO

  rotinas de tela:   POSICAO, POE_CEL, LE_CEL, ESCREVE, ESCREVE_NUM,
                     LIMPA_TELA, DESENHA_MOLDURA, MOSTRA_STATUS
  tempo, sorteio, som: LE_RELOGIO, ESPERA_PASSO, SEMEIA, ALEATORIO,
                     SOM_LIGA, SOM_ATUALIZA, SOM_DESLIGA
```

O programa principal é curto e só decide **o que vem depois**; o trabalho fica nas rotinas. É a organização que você vai ver em todos os jogos do módulo.

```asm fragmento titulo="COBRA.ASM: o programa principal"
inicio:
        MOV  AX, 0B800h         ; ES aponta para a memória de vídeo
        MOV  ES, AX             ; durante o programa inteiro
        CLD
        CALL ESCONDE_CURSOR
        CALL SEMEIA             ; semente do sorteio = relógio

@@titulo:
        CALL TELA_TITULO        ; mostra o título e espera ENTER ou ESC
        CMP  AL, 27
        JE   @@sair
        CALL NOVO_JOGO
@@laco:
        CALL LER_TECLADO        ; 1. entrada
        CMP  sair_pedido, 1
        JE   @@titulo
        CMP  pausado, 1
        JE   @@espera
        CALL ANDAR              ; 2. atualização (e desenho do que mudou)
        CMP  vivo, 1
        JNE  @@morreu
@@espera:
        CALL SOM_ATUALIZA
        CALL ESPERA_PASSO       ; 3. espera o próximo passo
        JMP  @@laco
@@morreu:
        CALL FIM_DE_JOGO
        JMP  @@titulo

@@sair: CALL SOM_DESLIGA
        MOV  AX, 0003h          ; volta ao modo texto limpo
        INT  10h
        MOV  AX, 4C00h
        INT  21h
```

`ES = B800h` **durante o programa inteiro** é uma decisão de projeto: todas as rotinas de tela podem escrever com `ES:[DI]` sem salvar e restaurar segmento. Em troca, nenhuma rotina pode mexer em ES. É por isso que `LE_RELOGIO` usa a `INT 1Ah` em vez de ler 0040:006Ch.

:::dica A pausa de graça
Com o jogo pausado, o laço continua rodando: lê o teclado (para ver o P de novo), atualiza o som e espera o passo. Só o `ANDAR` é pulado. Uma pausa feita com "espera uma tecla" deixaria um bip que estivesse tocando apitar até o fim da pausa, porque ninguém chamaria `SOM_ATUALIZA`. (A palavra PAUSA pisca sozinha: quem faz isso é a placa de vídeo, por causa do bit 7 do atributo.)
:::

## Técnica 1: a fila circular

A cobra é uma **sequência de posições**: da cauda até a cabeça. A cada passo, uma posição nova entra na frente (a nova cabeça) e a posição mais velha sai de trás (a cauda). Quando a cobra come, a cauda não sai, e ela cresce um gomo. Isso é exatamente uma **fila** (*FIFO*, o primeiro a entrar é o primeiro a sair).

Mover os 1.024 elementos de um vetor a cada passo seria um desperdício. A fila circular não move nada: só dois **índices** andam.

```diagrama titulo="A fila circular corpo[] (MAX_CORPO = 1024 posições)"
   índice:   0     1     2     3     4     5    ...   1023
           ┌─────┬─────┬─────┬─────┬─────┬─────┬ ┄ ┬─────┐
   corpo:  │0C25h│0C26h│0C27h│0C28h│     │     │   │     │      DH = linha 12 (0Ch)
           └─────┴─────┴─────┴─────┴─────┴─────┴ ┄ ┴─────┘      DL = coluna 37..40
              ▲                 ▲
            cauda = 0        cabeca = 3

   um passo para a direita, sem comer:
           ┌─────┬─────┬─────┬─────┬─────┬─────┬ ┄ ┬─────┐
   corpo:  │0C25h│0C26h│0C27h│0C28h│0C29h│     │   │     │
           └─────┴─────┴─────┴─────┴─────┴─────┴ ┄ ┴─────┘
                    ▲                 ▲
                 cauda = 1         cabeca = 4        (corpo[0] é lixo agora)

   ... e quando cabeca chega a 1023, o próximo é 0 de novo:
           cabeca = (cabeca + 1) AND 1023
```

Cada elemento é uma **word** com a linha em DH e a coluna em DL, o formato que `POSICAO`, `POE_CEL` e `LE_CEL` recebem. Assim, ler uma posição do corpo e desenhar nela é `MOV DX, corpo[BX]` / `CALL POE_CEL`, sem conversão.

O "dar a volta" é o truque mais bonito da rotina. Em vez de

```asm fragmento
        INC  BX
        CMP  BX, MAX_CORPO      ; passou do fim?
        JB   @@ok
        XOR  BX, BX             ; volta ao começo
@@ok:
```

a COBRA faz

```asm fragmento
        INC  BX
        AND  BX, MASCARA        ; MASCARA = 1023 = 0000 0011 1111 1111b
```

Isso só funciona porque **1.024 é potência de 2**: 1.023 em binário são dez bits 1, e o `AND` simplesmente descarta o bit 10, que é o "1.024" que sobrou. Duas instruções, nenhum salto, e o resultado é sempre de 0 a 1.023. O buffer de teclado da BIOS, que você estudou na [Aula 28](aula:aula28), também é uma fila circular, e o [capítulo 17 do livro](livro:cap17) mostra os ponteiros dele em 0040:001Ah e 0040:001Ch.

:::atencao Índice de elemento, deslocamento de byte
`cabeca` e `cauda` contam **elementos** (0 a 1.023), mas cada elemento ocupa 2 bytes. Por isso, antes de usar o índice em `corpo[BX]`, a rotina faz `SHL BX,1`. Esquecer essa multiplicação é o erro mais comum com vetores de words: o programa lê metade de uma posição e metade da outra.
:::

Uma pergunta justa: e se a cobra crescer além de 1.024 gomos? Não cresce. O campo tem 1.716 células, mas para a cabeça alcançar a cauda numa fila de 1.024 seria preciso comer mais de 1.000 vezes. Ninguém chega lá; se chegasse, o pior que aconteceria seria a cauda "pular" para um gomo do meio.

## Técnica 2: a tela é o mapa

Para saber se a cobra bateu, o jogo precisaria perguntar: "a nova posição da cabeça é parede? É corpo? É comida?". Com um mapa em memória, seria preciso mantê-lo sincronizado com a tela a cada passo. A COBRA pergunta direto para a tela:

```asm fragmento titulo="COBRA.ASM: ANDAR (começo)"
ANDAR   PROC
        MOV  AL, dx_novo        ; a direção pedida vale a partir de agora
        MOV  dx_cobra, AL
        MOV  AL, dy_novo
        MOV  dy_cobra, AL

        MOV  BX, cabeca
        SHL  BX, 1
        MOV  DX, corpo[BX]      ; DX = posição atual da cabeça
        PUSH DX
        ADD  DL, dx_cobra
        ADD  DH, dy_cobra       ; DX = nova posição

        CALL LE_CEL             ; AL = caractere que está lá
        CMP  AL, ' '
        JE   @@livre
        CMP  AL, CAR_COMIDA
        JE   @@come
        POP  DX                 ; bateu na parede ou no corpo
        MOV  vivo, 0
        RET
```

Três possibilidades, decididas por um único byte lido de B800h:

| O que há na célula | Significa | O que o jogo faz |
|--------------------|-----------|------------------|
| `' '` (20h) | campo livre | anda: apaga a cauda, desenha a cabeça |
| `♦` (04h) | comida | come: pontos, som, comida nova, **não** apaga a cauda |
| qualquer outra coisa | moldura, corpo ou cabeça | morre |

A elegância está no "qualquer outra coisa". A moldura (═, ║, cantos) e o corpo (█) nunca são testados um a um: tudo o que não é espaço nem comida mata. Se você quiser acrescentar obstáculos no meio do campo, basta desenhá-los: o `ANDAR` não muda uma linha.

:::cpu ADD DL e ADD DH, não ADD DX
`dx_cobra` vale −1 (FFh), 0 ou 1. Somar em DL com `ADD DL, dx_cobra` faz FFh funcionar como −1: coluna 5 + FFh = 04h, com um vai-um que se perde. Se o programa somasse a palavra inteira, `ADD DX, 00FFh`, o vai-um da coluna subiria para a linha: 0C05h + 00FFh = 0D04h, e a cobra iria para a esquerda **e** para baixo. Somar byte a byte mantém linha e coluna independentes.
:::

### Andar sem comer

Quando a célula está livre, a cauda sai da fila e da tela:

```asm fragmento titulo="COBRA.ASM: ANDAR, caso @@livre"
@@livre:                        ; apaga a cauda e avança o índice dela
        PUSH DX
        MOV  BX, cauda
        SHL  BX, 1
        MOV  DX, corpo[BX]
        MOV  AL, ' '
        MOV  AH, 07h
        CALL POE_CEL
        MOV  BX, cauda
        INC  BX
        AND  BX, MASCARA        ; fila circular: volta a 0 depois do fim
        MOV  cauda, BX
        POP  DX
```

E nos dois casos (andou ou comeu), a cabeça entra na fila:

```asm fragmento titulo="COBRA.ASM: ANDAR, caso @@cabeca"
@@cabeca:                       ; a cabeça antiga vira corpo...
        MOV  CX, DX
        POP  DX
        MOV  AL, CAR_CORPO
        MOV  AH, COR_CORPO
        CALL POE_CEL
        MOV  DX, CX             ; ...e a nova cabeça entra na fila
        MOV  BX, cabeca
        INC  BX
        AND  BX, MASCARA
        MOV  cabeca, BX
        SHL  BX, 1
        MOV  corpo[BX], DX
        MOV  AL, CAR_CABECA
        MOV  AH, COR_CABECA
        CALL POE_CEL
        RET
```

Siga a pilha: lá no começo, `PUSH DX` guardou a posição **antiga** da cabeça. Aqui, `POP DX` a recupera para pintar ali um █ (a cabeça velha vira pescoço), enquanto CX segura a posição nova. Por passo, a tela recebe só **três** escritas: o espaço da cauda, o █ do pescoço e o ☻ da cabeça nova. É o "apagar e redesenhar só o que mudou" da [Aula 32](aula:aula32), levado ao mínimo.

```diagrama titulo="Um passo para a direita"
  antes:        ███☻          cauda em 37, cabeça em 40
  @@livre:       ██☻          coluna 37 vira espaço
  @@cabeca:      ███          coluna 40 vira █ (pescoço)
                 ███☻         coluna 41 recebe ☻ (cabeça nova)
```

:::atencao A ordem importa
O jogo apaga a cauda **antes** de desenhar a cabeça nova. Por isso a cobra pode andar para a célula onde a cauda estava um passo antes, como na vida real. Mas repare: o teste de colisão (`LE_CEL`) acontece **antes** de a cauda ser apagada. Se a cabeça for para a célula exata da cauda, ela ainda vê um █ lá e morre. É uma regra que muitas versões do jogo têm, por esse mesmo motivo. O desafio 4 propõe mudar isso.
:::

## Técnica 3: a direção pedida e a direção aplicada

Por que duas direções, `dx_cobra`/`dy_cobra` e `dx_novo`/`dy_novo`? Imagine uma só. A cobra anda para a direita. Entre um passo e outro (até 220 ms), o jogador aperta ↑ e, rapidinho, ←. Com uma variável só, a primeira tecla mudaria a direção para cima, e a segunda, comparada com "cima", seria aceita: a cobra viraria para a esquerda sem ter dado nenhum passo para cima, e a cabeça entraria no pescoço.

A solução é comparar sempre com a direção **em que a cobra está andando de fato** (`dx_cobra`, só atualizada no começo do `ANDAR`), e guardar o pedido em `dx_novo`:

```asm fragmento titulo="COBRA.ASM: LER_TECLADO (as setas)"
        MOV  CL, dx_cobra       ; CL, CH = direção atual (para impedir a meia-volta)
        MOV  CH, dy_cobra
        CMP  AH, TECLA_CIMA
        JE   @@cima
        ...
@@cima: CMP  CH, 1              ; descendo não pode virar para cima
        JE   @@proxima
        MOV  dx_novo, 0
        MOV  dy_novo, -1
        JMP  @@proxima
@@baixo:
        CMP  CH, -1
        JE   @@proxima
        MOV  dx_novo, 0
        MOV  dy_novo, 1
        JMP  @@proxima
```

Refaça o exemplo: a cobra anda para a direita (`dx_cobra = 1`) e chegam ↑ e ← antes do próximo passo. A ↑ é aceita e vira o pedido. A ← é comparada com `dx_cobra`, que ainda é 1, e é recusada. O pedido final fica "cima": nada de meia-volta. O preço é que o jogador que aperta duas setas muito rápido perde a segunda. Versões mais sofisticadas guardam uma **fila de pedidos** (o desafio 2).

:::cpu Por que `JNZ @@tem` / `RET` e não `JZ @@fim`?
O começo de `LER_TECLADO` tem uma volta estranha: `JNZ @@tem` seguido de `RET`, em vez do natural `JZ @@fim`. O comentário no fonte explica: o `@@fim` ficaria a mais de 127 bytes, e os saltos condicionais do 8086 só alcançam −128 a +127 bytes. Inverter a condição e pôr um `RET` no caminho é o jeito clássico de contornar (o 386 ganhou saltos condicionais de 16 bits, mas os jogos do curso rodam num 8086). Você vai ver o mesmo truque no PONG.
:::

## Técnica 4: comida só em lugar vazio

```asm fragmento titulo="COBRA.ASM: NOVA_COMIDA"
NOVA_COMIDA PROC
@@sorteia:
        MOV  AX, BASE-TOPO+1    ; linha entre TOPO e BASE
        CALL ALEATORIO
        ADD  AL, TOPO
        MOV  DH, AL
        MOV  AX, DIR-ESQ+1      ; coluna entre ESQ e DIR
        CALL ALEATORIO
        ADD  AL, ESQ
        MOV  DL, AL
        CALL LE_CEL
        CMP  AL, ' '            ; ocupada? sorteia de novo
        JNE  @@sorteia
        MOV  AL, CAR_COMIDA
        MOV  AH, COR_COMIDA
        CALL POE_CEL
        RET
NOVA_COMIDA ENDP
```

Mais uma vez a tela responde: se a célula sorteada não é espaço, sorteia outra. É o método da **rejeição**: simples e rápido enquanto o campo tem bastante espaço livre. Com a cobra ocupando 90% do campo, ele tentaria em média 10 vezes, o que ainda é nada.

Um detalhe sutil: quando a cobra come, `ANDAR` chama `NOVA_COMIDA` **antes** de desenhar a cabeça na célula da comida. Nesse momento, a célula ainda tem o ♦ antigo, então o sorteio nunca escolhe justamente o lugar onde a cabeça vai aparecer. O comentário no fonte avisa disso, porque é o tipo de coisa que um programador "arruma" sem perceber e cria um bug raríssimo.

## Técnica 5: ritmo e dificuldade

```asm fragmento titulo="COBRA.ASM: ANDAR, caso @@come"
@@come: INC  comidas
        ADD  pontos, 10
        MOV  BX, 1400           ; bip agudo curto (1193182 / 1400 = 852 Hz)
        MOV  CL, 2
        CALL SOM_LIGA
        PUSH DX
        CALL NOVA_COMIDA
        POP  DX
        ; a cada 5 comidas, a cobra fica mais rápida
        MOV  AL, comidas
        XOR  AH, AH
        MOV  CL, 5
        DIV  CL                 ; AH = comidas mod 5
        OR   AH, AH
        JNZ  @@cresce
        CMP  passo, 1
        JE   @@cresce
        DEC  passo
@@cresce:
        CALL MOSTRA_STATUS
        JMP  SHORT @@cabeca     ; ao comer, a cauda fica onde está
```

A variável `passo` é o número de tiques entre dois passos da cobra, usado por `ESPERA_PASSO`:

| Comidas | `passo` | Passos por segundo |
|---------|---------|--------------------|
| 0 a 4 | 4 | 4,5 |
| 5 a 9 | 3 | 6,1 |
| 10 a 14 | 2 | 9,1 |
| 15 ou mais | 1 | 18,2 |

O `DIV CL` de 8 bits divide AX por CL e deixa o **resto em AH**: é o "mod 5". O salto de 9 para 18 passos por segundo é brusco, e é uma limitação do relógio de 55 ms: não existe "1,5 tique". Um jogo que quisesse uma curva mais suave usaria o retraço (70 Hz) ou aceleraria o canal 0 do PIT, como na [Aula 29](aula:aula29).

## Técnica 6: textos e números na tela

As rotinas de texto escrevem direto em B800h, com `LODSB`/`STOSW`:

```asm fragmento titulo="COBRA.ASM: ESCREVE"
; ESCREVE: string terminada em 0 (DS:SI) na linha DH, coluna DL, cor AH.
; Devolve SI logo depois do 0.
ESCREVE PROC
        PUSH DI
        CALL POSICAO
@@car:  LODSB                   ; AL = próximo caractere
        OR   AL, AL
        JZ   @@fim
        STOSW                   ; ES:[DI] = AX (caractere e cor); DI += 2
        JMP  @@car
@@fim:  POP  DI
        RET
ESCREVE ENDP
```

As strings terminam em **0**, e não em `$` como as da `INT 21h`/09h: assim o texto pode conter qualquer caractere, inclusive o próprio `$`. E como `ESCREVE` devolve SI apontando para a string seguinte, a tela de título desenha o logotipo de cinco linhas com um laço que não precisa saber o endereço de cada linha:

```asm fragmento titulo="COBRA.ASM: TELA_TITULO (o logotipo)"
        MOV  SI, OFFSET titulo
        MOV  DH, 5
@@linha:
        MOV  DL, 21
        MOV  AH, 0Ah
        CALL ESCREVE            ; ESCREVE devolve SI no início da próxima string
        INC  DH
        CMP  BYTE PTR [SI], 0   ; duas strings vazias seguidas = fim do título
        JNE  @@linha
```

Os números do placar saem com 5 dígitos fixos, do último para o primeiro, dividindo por 10:

```asm fragmento titulo="COBRA.ASM: ESCREVE_NUM"
ESCREVE_NUM PROC
        ...
        CALL POSICAO
        ADD  DI, 8              ; começa pelo último dígito (4 células à direita)
        MOV  BX, 10
        MOV  CX, 5
@@dig:  XOR  DX, DX
        DIV  BX                 ; AX = AX / 10, DX = resto
        ADD  DL, '0'
        MOV  ES:[DI], DL
        MOV  BYTE PTR ES:[DI+1], COR_STATUS
        SUB  DI, 2
        LOOP @@dig
        ...
```

Escrever da direita para a esquerda evita a pilha que a `IMPRIMIR_NUMERO` das aulas anteriores usava para inverter os dígitos, e os zeros à esquerda ("00030") saem de graça, porque o laço sempre roda 5 vezes. Placar com zeros à esquerda é a estética de fliperama por excelência.

## Técnica 7: detalhes de acabamento

- **Esconder o cursor.** `INT 10h`, AH = 01h, com o bit 5 de CH ligado (CX = 2000h), desliga o cursor piscante, que senão ficaria parado no canto da tela. A troca de modo no fim o devolve. Veja o [capítulo 3 do livro](livro:cap03).
- **Limpar a tela com uma instrução.** `MOV AX,0720h` / `MOV CX,2000` / `REP STOSW` escreve 2.000 espaços cinza no preto (as 80 × 25 células). É bem mais rápido que a função 06h da `INT 10h`.
- **Jogar fora as teclas da batida.** No fim do jogo, o jogador provavelmente ainda está apertando setas. `FIM_DE_JOGO` esvazia o buffer antes de esperar a tecla que volta ao título, senão uma seta "atrasada" pularia a tela de fim na hora.
- **O recorde.** `FIM_DE_JOGO` compara `pontos` com `recorde` (`JBE`: sem sinal, porque pontos nunca são negativos) e guarda o maior. Ele vive enquanto o programa roda; gravar em arquivo seria o próximo passo (desafio 5).

```asm fragmento titulo="COBRA.ASM: FIM_DE_JOGO (a limpeza do buffer)"
@@limpa:                        ; joga fora as teclas apertadas durante a batida
        MOV  AH, 01h
        INT  16h
        JZ   @@tecla
        MOV  AH, 00h
        INT  16h
        JMP  @@limpa
@@tecla:
        MOV  AH, 00h            ; agora sim espera uma tecla
        INT  16h
        RET
```

:::anos90 Rodando no MINIOS
A COBRA só pede ao DOS a função 4Ch, para terminar. Tudo o mais é BIOS (INT 10h, 16h e 1Ah) e hardware (B800h, portas 42h, 43h e 61h). É por isso que, nas aulas 40 a 44, ela roda sem nenhuma mudança no sistema operacional que você vai escrever do zero. Os jogos de disquete de boot dos anos 80, que nem precisavam de DOS, eram escritos exatamente assim.
:::

```quiz
? Por que a fila circular da cobra tem 1.024 posições, e não 1.000?
- Porque a tela tem 1.024 células
+ Porque, sendo potência de 2, o índice dá a volta com um AND 1023, sem comparação nem salto
- Porque o 8086 só endereça vetores de potência de 2
> 1.023 = 3FFh tem os dez bits de baixo ligados; AND com ele descarta o "1.024" que sobra. Com 1.000 posições, seria preciso CMP e um salto.

? Como a COBRA sabe que a cabeça bateu no próprio corpo?
- Percorre a fila corpo[] procurando a posição da cabeça
+ Lê o caractere da tela na posição nova (LE_CEL): se não for espaço nem comida, bateu
- Mantém uma matriz de 22 × 78 bytes com 1 onde há corpo
> A memória de vídeo já é um mapa atualizado de tudo o que está no campo. Ler um byte de B800h substitui uma busca na fila.

? Por que o ANDAR soma dx_cobra em DL e dy_cobra em DH, separadamente, e não uma palavra só em DX?
+ Para o −1 (FFh) da coluna não gerar um vai-um que mude a linha
- Porque ADD DX, memória não existe
- Para ficar mais rápido
> 05h + FFh = 04h em 8 bits (o vai-um se perde). Em 16 bits, 0C05h + 00FFh = 0D04h: a linha mudaria junto.

? Para que servem dx_novo e dy_novo, além de dx_cobra e dy_cobra?
- Para guardar a direção do passo anterior, usada no desenho do pescoço
+ Para o teclado comparar sempre com a direção em que a cobra está andando de fato, e não deixar duas setas rápidas causarem uma meia-volta
- Para a pausa lembrar a direção
> O pedido fica em dx_novo; ele só vale no próximo ANDAR. A meia-volta é testada contra dx_cobra, que não muda entre os passos.

? Quando a cobra come, o que NÃO acontece naquele passo?
- A cabeça avança uma célula
- Uma nova comida é sorteada
+ A cauda ser apagada
> Sem apagar a cauda, a cobra fica um gomo maior. É todo o mecanismo de crescer.

? Com 12 comidas, quantos tiques a cobra espera entre dois passos?
- 4
- 3
+ 2
- 1
> passo começa em 4 e cai 1 nas comidas 5 e 10. Com 12, vale 2: cerca de 9 passos por segundo.

? Por que FIM_DE_JOGO esvazia o buffer do teclado antes de esperar uma tecla?
+ Porque as setas apertadas durante a batida ainda estão no buffer e pulariam a tela de fim de jogo
- Porque a INT 16h não funciona com o buffer cheio
- Para desligar o alto-falante
> O jogador estava jogando: é quase certo que haja teclas no buffer. Jogá-las fora garante que a tela de fim fique visível até um aperto novo.
```

## A listagem completa

Clique em **▶ Jogar**. ENTER começa, as setas guiam, P pausa, ESC volta ao título (e, no título, sai).

```asm jogo titulo="COBRA.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  COBRA.ASM  -  o jogo da cobrinha, em modo texto 80x25        ║
; ║  Curso Assembly 8086, aula 33                                 ║
; ║                                                               ║
; ║  Programa .COM: TASM COBRA / TLINK /t COBRA                   ║
; ║  Setas mudam a direção, P pausa, ESC sai.                     ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; Constantes
; ---------------------------------------------------------------
TOPO        EQU 2           ; primeira linha dentro do campo
BASE        EQU 23          ; última linha dentro do campo
ESQ         EQU 1           ; primeira coluna dentro do campo
DIR         EQU 78          ; última coluna dentro do campo
MAX_CORPO   EQU 1024        ; tamanho da fila circular (potência de 2)
MASCARA     EQU MAX_CORPO-1

CAR_CABECA  EQU 2           ; ☻
CAR_CORPO   EQU 0DBh        ; █
CAR_COMIDA  EQU 4           ; ♦
COR_CABECA  EQU 0Eh         ; amarelo
COR_CORPO   EQU 0Ah         ; verde claro
COR_COMIDA  EQU 0Ch         ; vermelho claro
COR_MOLDURA EQU 09h         ; azul claro
COR_STATUS  EQU 1Fh         ; branco no azul

TECLA_CIMA  EQU 48h         ; códigos de varredura (scan codes)
TECLA_BAIXO EQU 50h
TECLA_ESQ   EQU 4Bh
TECLA_DIR   EQU 4Dh

; ===============================================================
; Programa principal
; ===============================================================
inicio:
        MOV  AX, 0B800h         ; ES aponta para a memória de vídeo
        MOV  ES, AX             ; durante o programa inteiro
        CLD
        CALL ESCONDE_CURSOR
        CALL SEMEIA             ; semente do sorteio = relógio

@@titulo:
        CALL TELA_TITULO        ; mostra o título e espera ENTER ou ESC
        CMP  AL, 27
        JE   @@sair
        CALL NOVO_JOGO
@@laco:
        CALL LER_TECLADO        ; 1. entrada
        CMP  sair_pedido, 1
        JE   @@titulo
        CMP  pausado, 1
        JE   @@espera
        CALL ANDAR              ; 2. atualização (e desenho do que mudou)
        CMP  vivo, 1
        JNE  @@morreu
@@espera:
        CALL SOM_ATUALIZA
        CALL ESPERA_PASSO       ; 3. espera o próximo passo
        JMP  @@laco
@@morreu:
        CALL FIM_DE_JOGO
        JMP  @@titulo

@@sair: CALL SOM_DESLIGA
        MOV  AX, 0003h          ; volta ao modo texto limpo
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ===============================================================
; Jogo
; ===============================================================

; NOVO_JOGO: desenha o campo e põe a cobra (4 gomos) no meio
NOVO_JOGO PROC
        CALL LIMPA_TELA
        CALL DESENHA_MOLDURA
        MOV  pontos, 0
        MOV  comidas, 0
        MOV  passo, 4           ; 4 tiques por passo (~4,5 passos/s)
        MOV  vivo, 1
        MOV  pausado, 0
        MOV  sair_pedido, 0
        MOV  dx_cobra, 1        ; começa andando para a direita
        MOV  dy_cobra, 0
        MOV  dx_novo, 1
        MOV  dy_novo, 0
        ; corpo: colunas 37 a 40 na linha 12 (cauda primeiro)
        MOV  cauda, 0
        MOV  cabeca, 3
        MOV  DH, 12
        MOV  DL, 37
        XOR  BX, BX
@@gomo: MOV  corpo[BX], DX      ; cada elemento: DH = linha, DL = coluna
        MOV  AL, CAR_CORPO
        MOV  AH, COR_CORPO
        CALL POE_CEL
        INC  DL
        ADD  BX, 2
        CMP  BX, 8
        JB   @@gomo
        SUB  DL, 1              ; redesenha a cabeça
        MOV  AL, CAR_CABECA
        MOV  AH, COR_CABECA
        CALL POE_CEL
        CALL NOVA_COMIDA
        CALL MOSTRA_STATUS
        CALL LE_RELOGIO
        MOV  ultimo_tique, AX
        RET
NOVO_JOGO ENDP

; ANDAR: um passo da cobra. Usa a própria tela como mapa de colisão:
; o caractere na posição da nova cabeça diz o que há lá.
ANDAR   PROC
        MOV  AL, dx_novo        ; a direção pedida vale a partir de agora
        MOV  dx_cobra, AL
        MOV  AL, dy_novo
        MOV  dy_cobra, AL

        MOV  BX, cabeca
        SHL  BX, 1
        MOV  DX, corpo[BX]      ; DX = posição atual da cabeça
        PUSH DX
        ADD  DL, dx_cobra
        ADD  DH, dy_cobra       ; DX = nova posição

        CALL LE_CEL             ; AL = caractere que está lá
        CMP  AL, ' '
        JE   @@livre
        CMP  AL, CAR_COMIDA
        JE   @@come
        POP  DX                 ; bateu na parede ou no corpo
        MOV  vivo, 0
        RET

@@come: INC  comidas
        ADD  pontos, 10
        MOV  BX, 1400           ; bip agudo curto (1193182 / 1400 = 852 Hz)
        MOV  CL, 2
        CALL SOM_LIGA
        PUSH DX
        CALL NOVA_COMIDA        ; (a comida nova não cai em cima da cabeça:
        POP  DX                 ;  a célula ainda tem o ♦ antigo)
        ; a cada 5 comidas, a cobra fica mais rápida
        MOV  AL, comidas
        XOR  AH, AH
        MOV  CL, 5
        DIV  CL
        OR   AH, AH
        JNZ  @@cresce
        CMP  passo, 1
        JE   @@cresce
        DEC  passo
@@cresce:
        CALL MOSTRA_STATUS
        JMP  SHORT @@cabeca     ; ao comer, a cauda fica onde está

@@livre:                        ; apaga a cauda e avança o índice dela
        PUSH DX
        MOV  BX, cauda
        SHL  BX, 1
        MOV  DX, corpo[BX]
        MOV  AL, ' '
        MOV  AH, 07h
        CALL POE_CEL
        MOV  BX, cauda
        INC  BX
        AND  BX, MASCARA        ; fila circular: volta a 0 depois do fim
        MOV  cauda, BX
        POP  DX

@@cabeca:                       ; a cabeça antiga vira corpo...
        MOV  CX, DX
        POP  DX
        MOV  AL, CAR_CORPO
        MOV  AH, COR_CORPO
        CALL POE_CEL
        MOV  DX, CX             ; ...e a nova cabeça entra na fila
        MOV  BX, cabeca
        INC  BX
        AND  BX, MASCARA
        MOV  cabeca, BX
        SHL  BX, 1
        MOV  corpo[BX], DX
        MOV  AL, CAR_CABECA
        MOV  AH, COR_CABECA
        CALL POE_CEL
        RET
ANDAR   ENDP

; NOVA_COMIDA: sorteia uma célula vazia dentro do campo e põe um ♦ nela
NOVA_COMIDA PROC
@@sorteia:
        MOV  AX, BASE-TOPO+1    ; linha entre TOPO e BASE
        CALL ALEATORIO
        ADD  AL, TOPO
        MOV  DH, AL
        MOV  AX, DIR-ESQ+1      ; coluna entre ESQ e DIR
        CALL ALEATORIO
        ADD  AL, ESQ
        MOV  DL, AL
        CALL LE_CEL
        CMP  AL, ' '            ; ocupada? sorteia de novo
        JNE  @@sorteia
        MOV  AL, CAR_COMIDA
        MOV  AH, COR_COMIDA
        CALL POE_CEL
        RET
NOVA_COMIDA ENDP

; LER_TECLADO: esvazia o buffer do teclado sem esperar (INT 16h, AH=01h)
LER_TECLADO PROC
@@proxima:
        MOV  AH, 01h            ; há tecla? (ZF = 1: não há)
        INT  16h
        JNZ  @@tem
        RET                     ; (um JZ até o fim da rotina não alcançaria:
@@tem:  MOV  AH, 00h            ;  saltos condicionais só vão até 127 bytes)
        INT  16h
        CMP  AL, 27
        JE   @@esc
        CMP  AL, 'p'
        JE   @@pausa
        CMP  AL, 'P'
        JE   @@pausa
        MOV  CL, dx_cobra       ; CL, CH = direção atual (para impedir a meia-volta)
        MOV  CH, dy_cobra
        CMP  AH, TECLA_CIMA
        JE   @@cima
        CMP  AH, TECLA_BAIXO
        JE   @@baixo
        CMP  AH, TECLA_ESQ
        JE   @@esq
        CMP  AH, TECLA_DIR
        JE   @@dir
        JMP  @@proxima
@@cima: CMP  CH, 1              ; descendo não pode virar para cima
        JE   @@proxima
        MOV  dx_novo, 0
        MOV  dy_novo, -1
        JMP  @@proxima
@@baixo:
        CMP  CH, -1
        JE   @@proxima
        MOV  dx_novo, 0
        MOV  dy_novo, 1
        JMP  @@proxima
@@esq:  CMP  CL, 1
        JE   @@proxima
        MOV  dx_novo, -1
        MOV  dy_novo, 0
        JMP  @@proxima
@@dir:  CMP  CL, -1
        JE   @@proxima
        MOV  dx_novo, 1
        MOV  dy_novo, 0
        JMP  @@proxima
@@pausa:
        XOR  pausado, 1
        CALL MOSTRA_STATUS
        JMP  @@proxima
@@esc:  MOV  sair_pedido, 1
        RET
LER_TECLADO ENDP

; FIM_DE_JOGO: som de batida, atualiza o recorde e espera uma tecla
FIM_DE_JOGO PROC
        MOV  BX, 9000           ; tom grave (132 Hz)
        MOV  CL, 6
        CALL SOM_LIGA
        MOV  AX, pontos
        CMP  AX, recorde
        JBE  @@caixa
        MOV  recorde, AX
@@caixa:
        MOV  DH, 10
        MOV  DL, 28
        MOV  SI, OFFSET msg_fim1
        MOV  AH, 4Fh            ; branco no vermelho
        CALL ESCREVE
        MOV  DH, 11
        MOV  SI, OFFSET msg_fim2
        CALL ESCREVE
        MOV  DH, 12
        MOV  SI, OFFSET msg_fim3
        CALL ESCREVE
        CALL MOSTRA_STATUS
        ; espera o som acabar e meio segundo, para o jogador ver o que houve
        CALL LE_RELOGIO
        MOV  ultimo_tique, AX
@@espera:
        CALL SOM_ATUALIZA
        CALL LE_RELOGIO
        SUB  AX, ultimo_tique
        CMP  AX, 10
        JB   @@espera
        CALL SOM_DESLIGA
@@limpa:                        ; joga fora as teclas apertadas durante a batida
        MOV  AH, 01h
        INT  16h
        JZ   @@tecla
        MOV  AH, 00h
        INT  16h
        JMP  @@limpa
@@tecla:
        MOV  AH, 00h            ; agora sim espera uma tecla
        INT  16h
        RET
FIM_DE_JOGO ENDP

; TELA_TITULO: devolve em AL a tecla (13 = jogar, 27 = sair)
TELA_TITULO PROC
        CALL LIMPA_TELA
        CALL DESENHA_MOLDURA
        MOV  SI, OFFSET titulo
        MOV  DH, 5
@@linha:
        MOV  DL, 21
        MOV  AH, 0Ah
        CALL ESCREVE            ; ESCREVE devolve SI no início da próxima string
        INC  DH
        CMP  BYTE PTR [SI], 0   ; duas strings vazias seguidas = fim do título
        JNE  @@linha
        MOV  DH, 13
        MOV  DL, 24
        MOV  AH, 07h
        MOV  SI, OFFSET instr1
        CALL ESCREVE
        MOV  DH, 14
        MOV  SI, OFFSET instr2
        CALL ESCREVE
        MOV  DH, 15
        MOV  SI, OFFSET instr3
        CALL ESCREVE
        MOV  DH, 18
        MOV  DL, 27
        MOV  AH, 0Fh
        MOV  SI, OFFSET instr4
        CALL ESCREVE
        CALL MOSTRA_STATUS
@@tecla:
        MOV  AH, 00h
        INT  16h
        CMP  AL, 13
        JE   @@fim
        CMP  AL, 27
        JNE  @@tecla
@@fim:  RET
TELA_TITULO ENDP

; MOSTRA_STATUS: linha 0 com o nome, os pontos e o recorde
MOSTRA_STATUS PROC
        PUSH AX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        XOR  DI, DI             ; pinta a linha 0 inteira
        MOV  AX, COR_STATUS*256 + ' '
        MOV  CX, 80
        REP  STOSW
        XOR  DX, DX
        MOV  DL, 2
        MOV  AH, COR_STATUS
        MOV  SI, OFFSET txt_nome
        CALL ESCREVE
        MOV  DL, 30
        MOV  SI, OFFSET txt_pontos
        CALL ESCREVE
        MOV  AX, pontos
        MOV  DL, 38
        CALL ESCREVE_NUM
        MOV  DL, 52
        MOV  AH, COR_STATUS
        MOV  SI, OFFSET txt_recorde
        CALL ESCREVE
        MOV  AX, recorde
        MOV  DL, 61
        CALL ESCREVE_NUM
        CMP  pausado, 1
        JNE  @@fim
        MOV  DL, 70
        MOV  AH, 9Eh            ; amarelo piscando
        MOV  SI, OFFSET txt_pausa
        CALL ESCREVE
@@fim:  POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  AX
        RET
MOSTRA_STATUS ENDP

; ===============================================================
; Tela de texto (ES = B800h)
; ===============================================================

; POSICAO: DH = linha, DL = coluna  ->  DI = deslocamento em B800h
; Usa uma tabela de linhas em vez de MUL: 4 instruções rápidas.
POSICAO PROC
        PUSH BX
        MOV  BL, DH
        XOR  BH, BH
        SHL  BX, 1
        MOV  DI, linhas[BX]     ; DI = linha * 160
        MOV  BL, DL
        XOR  BH, BH
        SHL  BX, 1
        ADD  DI, BX             ; + coluna * 2
        POP  BX
        RET
POSICAO ENDP

; POE_CEL: escreve AL (caractere) com AH (cor) na linha DH, coluna DL
POE_CEL PROC
        PUSH DI
        CALL POSICAO
        MOV  ES:[DI], AX
        POP  DI
        RET
POE_CEL ENDP

; LE_CEL: AL = caractere na linha DH, coluna DL (AH = cor)
LE_CEL  PROC
        PUSH DI
        CALL POSICAO
        MOV  AX, ES:[DI]
        POP  DI
        RET
LE_CEL  ENDP

; ESCREVE: string terminada em 0 (DS:SI) na linha DH, coluna DL, cor AH.
; Devolve SI logo depois do 0.
ESCREVE PROC
        PUSH DI
        CALL POSICAO
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        STOSW                   ; AL = caractere, AH = cor
        JMP  @@car
@@fim:  POP  DI
        RET
ESCREVE ENDP

; ESCREVE_NUM: AX em decimal, com 5 dígitos, na linha DH, coluna DL
ESCREVE_NUM PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH DI
        CALL POSICAO
        ADD  DI, 8              ; começa pelo último dígito
        MOV  BX, 10
        MOV  CX, 5
@@dig:  XOR  DX, DX
        DIV  BX                 ; AX = AX / 10, DX = resto
        ADD  DL, '0'
        MOV  ES:[DI], DL
        MOV  BYTE PTR ES:[DI+1], COR_STATUS
        SUB  DI, 2
        LOOP @@dig
        POP  DI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
ESCREVE_NUM ENDP

; LIMPA_TELA: 2000 espaços cinza no preto, com uma instrução só
LIMPA_TELA PROC
        XOR  DI, DI
        MOV  AX, 0720h
        MOV  CX, 2000
        REP  STOSW
        RET
LIMPA_TELA ENDP

; DESENHA_MOLDURA: caixa de linhas duplas em volta do campo (linhas 1 a 24)
DESENHA_MOLDURA PROC
        MOV  AH, COR_MOLDURA
        MOV  DH, TOPO-1         ; linha de cima
        MOV  DL, ESQ-1
        MOV  AL, 0C9h           ; ╔
        CALL POE_CEL
        MOV  AL, 0CDh           ; ═
        MOV  CX, DIR-ESQ+1
@@cima: INC  DL
        CALL POE_CEL
        LOOP @@cima
        INC  DL
        MOV  AL, 0BBh           ; ╗
        CALL POE_CEL
        MOV  DH, BASE+1         ; linha de baixo
        MOV  DL, ESQ-1
        MOV  AL, 0C8h           ; ╚
        CALL POE_CEL
        MOV  AL, 0CDh
        MOV  CX, DIR-ESQ+1
@@baixo:
        INC  DL
        CALL POE_CEL
        LOOP @@baixo
        INC  DL
        MOV  AL, 0BCh           ; ╝
        CALL POE_CEL
        MOV  AL, 0BAh           ; ║ dos dois lados
        MOV  DH, TOPO
@@lados:
        MOV  DL, ESQ-1
        CALL POE_CEL
        MOV  DL, DIR+1
        CALL POE_CEL
        INC  DH
        CMP  DH, BASE
        JBE  @@lados
        RET
DESENHA_MOLDURA ENDP

; ESCONDE_CURSOR: bit 5 de CH ligado = cursor invisível (INT 10h, AH=01h)
ESCONDE_CURSOR PROC
        MOV  AH, 01h
        MOV  CX, 2000h
        INT  10h
        RET
ESCONDE_CURSOR ENDP

; ===============================================================
; Tempo, sorteio e som
; ===============================================================

; LE_RELOGIO: AX = parte baixa do contador de tiques da BIOS (18,2 por segundo)
LE_RELOGIO PROC
        PUSH CX
        PUSH DX
        MOV  AH, 00h
        INT  1Ah                ; CX:DX = tiques desde a meia-noite
        MOV  AX, DX
        POP  DX
        POP  CX
        RET
LE_RELOGIO ENDP

; ESPERA_PASSO: espera até passarem "passo" tiques desde o último passo
ESPERA_PASSO PROC
@@espera:
        CALL LE_RELOGIO
        MOV  DX, AX
        SUB  AX, ultimo_tique   ; a subtração dá certo mesmo se o contador der a volta
        MOV  CL, passo
        XOR  CH, CH
        CMP  AX, CX
        JB   @@espera
        MOV  ultimo_tique, DX
        RET
ESPERA_PASSO ENDP

; SEMEIA: a semente do sorteio vem do relógio (cada partida é diferente)
SEMEIA  PROC
        CALL LE_RELOGIO
        MOV  semente, AX
        RET
SEMEIA  ENDP

; ALEATORIO: entra AX = n, sai AX = número sorteado entre 0 e n-1.
; Gerador congruente linear: semente = semente * 25173 + 13849 (mod 65536).
; O resultado é a parte alta de semente * n (fica entre 0 e n-1 sem DIV).
ALEATORIO PROC
        PUSH BX
        PUSH DX
        MOV  BX, AX
        MOV  AX, semente
        MOV  DX, 25173
        MUL  DX
        ADD  AX, 13849
        MOV  semente, AX
        MUL  BX                 ; DX:AX = semente * n
        MOV  AX, DX             ; DX = (semente * n) / 65536
        POP  DX
        POP  BX
        RET
ALEATORIO ENDP

; SOM_LIGA: toca o divisor BX no alto-falante por CL tiques, sem parar o jogo
SOM_LIGA PROC
        PUSH AX
        MOV  AL, 0B6h           ; canal 2, byte baixo e alto, modo 3 (onda quadrada)
        OUT  43h, AL
        MOV  AL, BL
        OUT  42h, AL
        MOV  AL, BH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3              ; liga o alto-falante ao canal 2
        OUT  61h, AL
        CALL LE_RELOGIO
        XOR  CH, CH
        ADD  AX, CX
        MOV  som_fim, AX
        MOV  som_ligado, 1
        POP  AX
        RET
SOM_LIGA ENDP

; SOM_ATUALIZA: desliga o som quando o tempo dele acabou
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
linhas      DW  0*160,  1*160,  2*160,  3*160,  4*160,  5*160,  6*160,  7*160
            DW  8*160,  9*160, 10*160, 11*160, 12*160, 13*160, 14*160, 15*160
            DW 16*160, 17*160, 18*160, 19*160, 20*160, 21*160, 22*160, 23*160
            DW 24*160

titulo      DB ' ██████  ██████  ██████  ██████   █████ ', 0
            DB '██      ██    ██ ██   ██ ██   ██ ██   ██', 0
            DB '██      ██    ██ ██████  ██████  ███████', 0
            DB '██      ██    ██ ██   ██ ██   ██ ██   ██', 0
            DB ' ██████  ██████  ██████  ██   ██ ██   ██', 0
            DB 0
instr1      DB 'Use as setas para guiar a cobra.', 0
instr2      DB 'Coma os ', 4, ' para crescer e pontuar.', 0
instr3      DB 'Nao bata na parede nem em voce!', 0
instr4      DB 'ENTER joga    ESC sai', 0
txt_nome    DB 'COBRA 1.0', 0
txt_pontos  DB 'Pontos:', 0
txt_recorde DB 'Recorde:', 0
txt_pausa   DB 'PAUSA', 0
msg_fim1    DB '                        ', 0
msg_fim2    DB '     FIM DE JOGO!       ', 0
msg_fim3    DB '  (tecle para voltar)   ', 0

pontos      DW 0
recorde     DW 0
comidas     DB 0
passo       DB 4
vivo        DB 1
pausado     DB 0
sair_pedido DB 0
dx_cobra    DB 1                ; direção atual (-1, 0 ou 1)
dy_cobra    DB 0
dx_novo     DB 1                ; direção pedida pelo teclado
dy_novo     DB 0
ultimo_tique DW 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0
cabeca      DW 0                ; índices na fila circular
cauda       DW 0
corpo       DW MAX_CORPO DUP (0)    ; posições dos gomos: DH = linha, DL = coluna

END inicio
```

## Exercícios

```exercicio
id: a33-1
titulo: Avançar na fila circular
nivel: 1
proibir: CMP, DIV
exigir: AND
--- enunciado
BX chega com um índice da fila circular de **1.024** posições (0 a 1.023). Avance-o uma posição: depois de 1.023 vem 0. Sem comparações nem divisão: use a máscara.
--- inicial
; BX = índice (0 a 1023)
; avance BX uma posição na fila circular
--- testes
[{ "nome": "0 vira 1", "setup": { "BX": 0 }, "espera": { "BX": 1 } },
 { "nome": "511 vira 512", "setup": { "BX": 511 }, "espera": { "BX": 512 } },
 { "nome": "1022 vira 1023", "setup": { "BX": 1022 }, "espera": { "BX": 1023 } },
 { "nome": "1023 dá a volta para 0", "setup": { "BX": 1023 }, "espera": { "BX": 0 } }]
--- dicas
1.023 em binário são dez bits 1: 0000 0011 1111 1111b.
INC BX e depois AND BX, 1023.
--- solucao
; BX = índice (0 a 1023)
        INC  BX
        AND  BX, 1023
```

```exercicio
id: a33-2
titulo: Onde vai a cabeça
nivel: 2
--- enunciado
A fila **corpo** guarda posições (DH = linha, DL = coluna); **cabeca** é o índice (de elemento, não de byte) da cabeça. **dx_cobra** e **dy_cobra** valem −1, 0 ou 1.

Calcule em **DX** a posição da **nova** cabeça: a posição atual com dx somado à coluna e dy somado à linha. Não altere nenhuma variável.
--- inicial
        JMP  inicio
corpo    DW 8 DUP (0)
cabeca   DW 0
dx_cobra DB 1
dy_cobra DB 0
inicio: ; DX = posição da nova cabeça
--- testes
[{ "nome": "para a direita", "setup": { "corpo": [3109, 3110, 3111, 3112], "cabeca": 3, "dx_cobra": 1, "dy_cobra": 0 }, "espera": { "DX": 3113, "mem": { "cabeca": 3 } } },
 { "nome": "para cima", "setup": { "corpo": [3109, 3110, 3111, 3112], "cabeca": 3, "dx_cobra": 0, "dy_cobra": 255 }, "espera": { "DX": 2856 } },
 { "nome": "para a esquerda, na coluna 1", "setup": { "corpo": [1281], "cabeca": 0, "dx_cobra": 255, "dy_cobra": 0 }, "espera": { "DX": 1280 } },
 { "nome": "para baixo, cabeça no índice 5", "setup": { "corpo": [0, 0, 0, 0, 0, 5904], "cabeca": 5, "dx_cobra": 0, "dy_cobra": 1 }, "espera": { "DX": 6160 } }]
--- dicas
MOV BX,cabeca / SHL BX,1 (cada elemento tem 2 bytes) / MOV DX,corpo[BX].
Some byte a byte: ADD DL,dx_cobra e ADD DH,dy_cobra.
Não some a palavra inteira: o vai-um do −1 na coluna mudaria a linha.
--- solucao
        JMP  inicio
corpo    DW 8 DUP (0)
cabeca   DW 0
dx_cobra DB 1
dy_cobra DB 0
inicio: ; DX = posição da nova cabeça
        MOV  BX, cabeca
        SHL  BX, 1
        MOV  DX, corpo[BX]
        ADD  DL, dx_cobra
        ADD  DH, dy_cobra
```

```exercicio
id: a33-3
titulo: Sem meia-volta
nivel: 3
--- enunciado
AH chega com o scan code de uma tecla. Se for uma seta (↑ 48h, ↓ 50h, ← 4Bh, → 4Dh), grave a direção pedida em **dx_novo** e **dy_novo** (−1, 0 ou 1)... **a não ser** que ela seja o contrário da direção atual (**dx_cobra**, **dy_cobra**): indo para a direita, ← é ignorada; descendo, ↑ é ignorada, e assim por diante. Outras teclas não mudam nada.
--- inicial
        JMP  inicio
dx_cobra DB 1
dy_cobra DB 0
dx_novo  DB 1
dy_novo  DB 0
inicio: ; AH = scan code
--- testes
[{ "nome": "indo para a direita, ← é ignorada", "setup": { "AX": 19200, "dx_cobra": 1, "dy_cobra": 0, "dx_novo": 1, "dy_novo": 0 }, "espera": { "mem": { "dx_novo": 1, "dy_novo": 0 } } },
 { "nome": "indo para a direita, ↑ vale", "setup": { "AX": 18432, "dx_cobra": 1, "dy_cobra": 0, "dx_novo": 1, "dy_novo": 0 }, "espera": { "mem": { "dx_novo": 0, "dy_novo": 255 } } },
 { "nome": "subindo, ↓ é ignorada", "setup": { "AX": 20480, "dx_cobra": 0, "dy_cobra": 255, "dx_novo": 0, "dy_novo": 255 }, "espera": { "mem": { "dx_novo": 0, "dy_novo": 255 } } },
 { "nome": "subindo, → vale", "setup": { "AX": 19712, "dx_cobra": 0, "dy_cobra": 255, "dx_novo": 0, "dy_novo": 255 }, "espera": { "mem": { "dx_novo": 1, "dy_novo": 0 } } },
 { "nome": "indo para a esquerda, ↓ vale", "setup": { "AX": 20480, "dx_cobra": 255, "dy_cobra": 0, "dx_novo": 255, "dy_novo": 0 }, "espera": { "mem": { "dx_novo": 0, "dy_novo": 1 } } },
 { "nome": "descendo, Enter não muda nada", "setup": { "AX": 7181, "dx_cobra": 0, "dy_cobra": 1, "dx_novo": 0, "dy_novo": 1 }, "espera": { "mem": { "dx_novo": 0, "dy_novo": 1 } } }]
--- dicas
Copie a direção atual: MOV CL,dx_cobra / MOV CH,dy_cobra.
Para ↑: se CH = 1 (descendo), ignore. Senão, dx_novo = 0 e dy_novo = −1.
As outras três setas são iguais, trocando o teste (↓: CH = −1; ←: CL = 1; →: CL = −1).
--- solucao
        JMP  inicio
dx_cobra DB 1
dy_cobra DB 0
dx_novo  DB 1
dy_novo  DB 0
inicio: ; AH = scan code
        MOV  CL, dx_cobra
        MOV  CH, dy_cobra
        CMP  AH, 48h
        JE   @@cima
        CMP  AH, 50h
        JE   @@baixo
        CMP  AH, 4Bh
        JE   @@esq
        CMP  AH, 4Dh
        JE   @@dir
        JMP  SHORT @@fim
@@cima: CMP  CH, 1
        JE   @@fim
        MOV  dx_novo, 0
        MOV  dy_novo, -1
        JMP  SHORT @@fim
@@baixo:
        CMP  CH, -1
        JE   @@fim
        MOV  dx_novo, 0
        MOV  dy_novo, 1
        JMP  SHORT @@fim
@@esq:  CMP  CL, 1
        JE   @@fim
        MOV  dx_novo, -1
        MOV  dy_novo, 0
        JMP  SHORT @@fim
@@dir:  CMP  CL, -1
        JE   @@fim
        MOV  dx_novo, 1
        MOV  dy_novo, 0
@@fim:
```

```exercicio
id: a33-4
titulo: Mais rápido a cada 5
nivel: 2
--- enunciado
A cobra acabou de comer: **comidas** já foi incrementada. Se **comidas** for múltiplo de 5 e **passo** for maior que 1, diminua **passo** em 1. Nos outros casos, não mude nada.
--- inicial
        JMP  inicio
comidas DB 0
passo   DB 4
inicio: ; acelere a cobra a cada 5 comidas
--- testes
[{ "nome": "5 comidas: passo 4 vira 3", "setup": { "comidas": 5, "passo": 4 }, "espera": { "mem": { "passo": 3 } } },
 { "nome": "7 comidas: nada muda", "setup": { "comidas": 7, "passo": 4 }, "espera": { "mem": { "passo": 4 } } },
 { "nome": "15 comidas: passo 2 vira 1", "setup": { "comidas": 15, "passo": 2 }, "espera": { "mem": { "passo": 1 } } },
 { "nome": "20 comidas: passo 1 não baixa", "setup": { "comidas": 20, "passo": 1 }, "espera": { "mem": { "passo": 1 } } },
 { "nome": "255 comidas: múltiplo de 5", "setup": { "comidas": 255, "passo": 3 }, "espera": { "mem": { "passo": 2 } } }]
--- dicas
MOV AL,comidas / XOR AH,AH / MOV CL,5 / DIV CL: o resto fica em AH.
Se AH não for zero, pule para o fim. Se passo for 1, também.
DEC passo funciona direto na memória.
--- solucao
        JMP  inicio
comidas DB 0
passo   DB 4
inicio: ; acelere a cobra a cada 5 comidas
        MOV  AL, comidas
        XOR  AH, AH
        MOV  CL, 5
        DIV  CL
        OR   AH, AH
        JNZ  @@fim
        CMP  passo, 1
        JE   @@fim
        DEC  passo
@@fim:
```

```exercicio
id: a33-5
titulo: Placar de 5 dígitos
nivel: 2
exigir: DIV
--- enunciado
Escreva o número **AX** (0 a 65.535) com **5 dígitos**, com zeros à esquerda, na **linha 0**, a partir da **coluna 38** da tela de texto (B800h), com o atributo **1Fh** (branco no azul) em cada dígito. Por exemplo, 30 vira `00030` nas colunas 38 a 42.
--- inicial
; AX = número a mostrar
; escreva 5 dígitos em B800h, linha 0, colunas 38 a 42, atributo 1Fh
--- testes
[{ "nome": "30", "setup": { "AX": 30 }, "espera": { "video": { "38": ["0", 31], "39": ["0", 31], "40": ["0", 31], "41": ["3", 31], "42": ["0", 31] } } },
 { "nome": "65535", "setup": { "AX": 65535 }, "espera": { "video": { "38": ["6", 31], "39": ["5", 31], "40": ["5", 31], "41": ["3", 31], "42": ["5", 31] } } },
 { "nome": "0", "setup": { "AX": 0 }, "espera": { "video": { "38": ["0", 31], "39": ["0", 31], "40": ["0", 31], "41": ["0", 31], "42": ["0", 31] } } },
 { "nome": "12345", "setup": { "AX": 12345 }, "espera": { "video": { "38": ["1", 31], "39": ["2", 31], "40": ["3", 31], "41": ["4", 31], "42": ["5", 31] } } }]
--- dicas
ES = B800h (passe por um registrador que não seja AX). A coluna 42 da linha 0 fica no deslocamento 42 × 2 = 84.
Comece em DI = 84 e ande para a esquerda (SUB DI,2), 5 vezes.
Em cada volta: XOR DX,DX / DIV BX (BX = 10). O resto, em DL, mais '0' é o dígito.
Grave o dígito em ES:[DI] e o atributo em ES:[DI+1] (com BYTE PTR).
--- solucao
; AX = número a mostrar
        MOV  BX, 0B800h
        MOV  ES, BX
        MOV  DI, 42*2
        MOV  BX, 10
        MOV  CX, 5
@@dig:  XOR  DX, DX
        DIV  BX
        ADD  DL, '0'
        MOV  ES:[DI], DL
        MOV  BYTE PTR ES:[DI+1], 1Fh
        SUB  DI, 2
        LOOP @@dig
```

## Desafios

1. **Paredes no meio.** Desenhe alguns blocos de moldura (por exemplo, uma barra ║ vertical no centro) em `NOVO_JOGO`. Graças à tela como mapa, `ANDAR` já trata as paredes novas sem nenhuma mudança. Depois crie fases: a cada 10 comidas, um desenho diferente.
2. **Fila de pedidos.** Troque `dx_novo`/`dy_novo` por uma pequena fila circular de 4 direções. Cada seta aceita entra na fila (comparada com a última direção da fila, não com a atual); cada `ANDAR` tira uma. Assim, ↑ e ← rápidas viram dois passos, e nenhuma se perde.
3. **Dois jogadores.** Uma segunda cobra com W, A, S, D, como no Blockade original. Vai precisar de uma segunda fila e de uma regra para quando as cabeças se encontram. Como as duas cobras viram com toques isolados, a `INT 16h` ainda dá conta; mas se os dois jogadores apertarem ao mesmo tempo, experimente trocar pela tabela de teclas da [Aula 32](aula:aula32).
4. **Andar sobre a própria cauda.** Faça a cobra poder entrar na célula de onde a cauda acaba de sair (sem comer). Dica: no caso em que `LE_CEL` acha um █, confira se a posição é igual a `corpo[cauda]`.
5. **Recorde em disco.** Grave o recorde num arquivo COBRA.REC (INT 21h, 3Ch, 40h e 3Eh, da [Aula 25](aula:aula25)) e leia-o no começo. Atenção: isso quebra a compatibilidade com o MINIOS, que não tem funções de arquivo. Que tal só gravar se o DOS responder à função 30h (versão)?

## No livro

- [Capítulo 20, A BIOS para jogos](livro:cap20): o laço do jogo, o tempo e o som que a COBRA usa.
- [Capítulo 3, vídeo I](livro:cap03): o modo texto, a memória B800h, o atributo e o cursor (INT 10h, AH = 01h).
- [Capítulo 6, teclado](livro:cap06): INT 16h, funções 00h e 01h, e os scan codes das setas.
- [Capítulo 7, tempo](livro:cap07): INT 1Ah e o contador de tiques.
- [Capítulo 17, área de dados da BIOS](livro:cap17): o buffer circular do teclado, primo da fila da cobra.

:::resumo
- O jogo da cobrinha vem de **Blockade** (1976), passou pelo **NIBBLES.BAS** do QBasic (1991) e chegou aos celulares Nokia (1997).
- O corpo da cobra é uma **fila circular** de posições (DH = linha, DL = coluna). A cada passo, a cabeça entra e a cauda sai; ao comer, a cauda fica. Com tamanho potência de 2, o índice dá a volta com `AND MASCARA`. Lembre do `SHL BX,1` para passar de índice a deslocamento de words.
- A **tela é o mapa**: `LE_CEL` na posição nova diz se é espaço (anda), comida (come) ou qualquer outra coisa (morre). Paredes novas não exigem código novo.
- Some dx e dy **byte a byte** (DL e DH), para o −1 não contaminar a linha.
- A direção **pedida** (`dx_novo`) é separada da **aplicada** (`dx_cobra`): a meia-volta é testada contra a aplicada.
- Comida nova por **rejeição**: sorteia até achar um espaço.
- Velocidade em tiques por passo, diminuída a cada 5 comidas (`DIV` de 8 bits, resto em AH).
- Só três células mudam por passo: a cauda, o pescoço e a cabeça.
- A COBRA só usa do DOS a função 4Ch: roda também no MINIOS.
:::
