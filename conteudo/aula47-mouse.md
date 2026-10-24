---
id: aula47
numero: 47
modulo: 15
titulo: O mouse: a INT 33h
subtitulo: Posição, botões, cursor e a rotina de eventos do driver
duracao: 90 min
objetivos: detectar o driver do mouse e entender a diferença entre driver e BIOS; converter as coordenadas virtuais 640x200 para células de texto e pixels do modo 13h; mostrar e esconder o cursor respeitando o contador; ler posição e botões por consulta e contar cliques sem perder nenhum; limitar a área e posicionar o cursor; instalar uma rotina de eventos com AX=0Ch e desinstalá-la ao sair; escrever um programa de pintura no modo 13h
---

## Um rato no PC

O mouse chegou ao PC em 1983, com o **Microsoft Mouse**, uma caixinha de dois botões verdes que vinha com um disquete. No disquete estava o que importa para nós: o **driver**, um programa residente (`MOUSE.COM` ou `MOUSE.SYS`) que conversa com o hardware do mouse e oferece aos programas uma interface simples pela **INT 33h**.

Essa interface virou o padrão de fato. Logitech, Genius, Mouse Systems: todos os fabricantes vendiam drivers que imitavam a INT 33h da Microsoft, função por função. Um programa escrito para ela funciona com qualquer mouse, serial, de barramento ou PS/2.

```diagrama titulo="Quem fala com quem"
  seu programa                   INT 33h, AX = função
       │                         (posição na tela, botões, cursor)
       ▼
  driver do mouse (MOUSE.COM)    TSR: guarda a posição, desenha o cursor,
       │                         chama a sua rotina de eventos
       ▼
  hardware: porta serial (IRQ 4), placa de barramento ou porta PS/2 (IRQ 12)
            no PS/2, por meio da BIOS: INT 15h, AH=C2h (Capítulo 15 do livro)
```

O [Capítulo 15](livro:cap15) do livro mostra a camada de baixo, a BIOS do PS/2. Nesta aula ficamos na camada de cima, que é a que quase todo programa usava. O simulador do curso tem um driver compatível com o da Microsoft: na tela do programa (no laboratório, no "Executar aqui" e no "Jogar"), mexa o mouse e clique.

## Existe um mouse? (AX = 00h)

A primeira chamada de todo programa é o **reset do driver**: `AX = 0` e `INT 33h`. Ela coloca o driver no estado inicial (cursor escondido, no meio da tela, limites da tela inteira) e responde:

- **AX = FFFFh** se há mouse e driver; **AX = 0000h** se não há.
- **BX** = número de botões (2 no mouse da Microsoft, 3 no da Logitech).

:::atencao Sem driver, a INT 33h pode apontar para o nada
Num PC sem driver, o vetor da INT 33h pode ser **zero** (0000:0000), e chamá-lo salta para a tabela de vetores: o PC trava. Programas cuidadosos olhavam o vetor antes, com a função 35h do DOS (ES:BX = 0000:0000 ou apontando para um `IRET` significa "sem driver"). No DOS 6 o vetor já vinha apontando para um `IRET`, e o `AX = 0` voltava intacto, o que também se lê como "sem mouse".
:::

```asm executar titulo="DETECTA.ASM: há um mouse?"
.MODEL SMALL
.STACK 100h
.DATA
sim     DB 'Mouse encontrado, com $'
botoes  DB ' botoes.', 13, 10, '$'
nao     DB 'Nenhum driver de mouse.', 13, 10, '$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX             ; função 0: reset
        INT  33h
        CMP  AX, 0FFFFh
        JNE  sem
        PUSH BX                 ; BX = botões
        MOV  DX, OFFSET sim
        MOV  AH, 09h
        INT  21h
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        MOV  DX, OFFSET botoes
        JMP  SHORT mostra
sem:    MOV  DX, OFFSET nao
mostra: MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## Coordenadas virtuais

O driver não trabalha com colunas nem com pixels. Ele usa uma tela **virtual** que, nos modos mais comuns, tem 640 pontos de largura e 200 de altura, e converte isso para o modo de vídeo atual:

| Modo | X (CX) | Y (DX) | Para converter |
|---|---|---|---|
| Texto 80×25 | 0 a 639, de 8 em 8 | 0 a 199, de 8 em 8 | coluna = X / 8, linha = Y / 8 |
| Gráfico 13h (320×200) | 0 a 639, de 1 em 1 | 0 a 199 | pixel x = X / 2, pixel y = Y |

O detalhe do modo 13h pegou muita gente: o X vai até **639**, não 319. Os drivers da época foram feitos para os modos CGA de 640 pontos e não mudaram quando o VGA apareceu. Todo programa de modo 13h faz `SHR CX,1` depois de ler a posição.

```diagrama titulo="Do mouse para a tela no modo texto"
   X virtual:  0    8    16   24  ...  632      (CX)
               │    │    │    │        │
   coluna:     0    1    2    3   ...  79       coluna = CX / 8  (SHR por 3)

   Y virtual:  0    8    16  ...  192           (DX)
   linha:      0    1    2   ...  24            linha = DX / 8
```

No 8086, dividir por 8 é `MOV CL,3` e `SHR AX,CL`: `SHR AX,3` só existe a partir do 80186.

## O cursor: mostrar e esconder (AX = 01h e 02h)

Depois do reset, o cursor está **escondido**. `AX = 1` mostra, `AX = 2` esconde. Esses dois serviços têm uma regra que surpreende: eles são **contados**. O driver guarda um contador que começa em -1 (escondido). Cada `AX = 1` soma 1 (até 0), cada `AX = 2` subtrai 1, e o cursor só aparece quando o contador vale 0.

```diagrama titulo="O contador do cursor"
  reset         contador = -1   escondido
  AX=1          contador =  0   visível
  AX=2          contador = -1   escondido
  AX=2          contador = -2   escondido
  AX=1          contador = -1   ainda escondido!
  AX=1          contador =  0   visível
```

Isso permite que rotinas aninhadas escondam e mostrem o cursor sem se preocupar com o estado de quem as chamou, desde que cada `AX = 2` tenha o seu `AX = 1`.

### Por que esconder o cursor antes de desenhar

O driver de verdade desenha o cursor **dentro da memória de vídeo**. No modo texto, ele inverte o atributo da célula onde o mouse está; no modo gráfico, guarda os pixels que estão embaixo da seta e desenha a seta por cima. Quando o mouse se move, ele devolve o que tinha guardado.

Se o seu programa escreve na tela exatamente onde está o cursor, o driver não sabe. Quando o mouse sair dali, ele "devolve" o fundo antigo por cima do que você desenhou, e fica um buraco ou uma mancha. A regra de ouro: **esconda o cursor (AX=2), desenhe, mostre de novo (AX=1)**.

:::cpu E no simulador?
O simulador desenha o cursor por cima da imagem, sem tocar na memória de vídeo, então o defeito não aparece aqui. Mas os programas desta aula seguem a regra do mesmo jeito, porque num PC de verdade (ou no DOSBox) ela faz diferença.
:::

## Lendo a posição e os botões (AX = 03h)

`AX = 3` devolve o estado **neste instante**:

- **BX** = botões apertados: bit 0 = esquerdo, bit 1 = direito, bit 2 = meio.
- **CX** = X, **DX** = Y, em coordenadas virtuais.

Um laço que chama `AX = 3` sem parar é a forma mais simples de usar o mouse: o mesmo modelo de "consulta" (*polling*) que usamos com o teclado na [aula 32](aula:aula32). O programa abaixo mostra, no canto da tela, a coluna e a linha em que o mouse está. Execute, mexa o mouse sobre a tela do programa e aperte o **botão direito** para sair.

```asm executar titulo="ONDE.ASM: coluna e linha do mouse"
.MODEL SMALL
.STACK 100h
.DATA
txtcol  DB 'Coluna $'
txtlin  DB '  Linha $'
ajuda   DB 'Mexa o mouse. Botao direito sai.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0003h          ; modo texto limpo
        INT  10h
        MOV  DX, 0200h          ; linha 2, coluna 0
        CALL CURSOR
        MOV  DX, OFFSET ajuda
        MOV  AH, 09h
        INT  21h

        XOR  AX, AX             ; reset do driver
        INT  33h
        CMP  AX, 0FFFFh
        JNE  fim
        MOV  AX, 1              ; mostra o cursor
        INT  33h

laco:   MOV  AX, 3              ; BX = botões, CX = x, DX = y
        INT  33h
        TEST BX, 2              ; botão direito?
        JNZ  sai
        MOV  AX, CX             ; AX = x (antes de usar CL!)
        MOV  CL, 3
        SHR  AX, CL             ; coluna = x / 8
        SHR  DX, CL             ; linha = y / 8
        MOV  BX, DX             ; BX = linha
        PUSH AX
        MOV  AX, 2              ; esconde o cursor para escrever
        INT  33h
        XOR  DX, DX
        CALL CURSOR             ; canto superior esquerdo
        MOV  DX, OFFSET txtcol
        MOV  AH, 09h
        INT  21h
        POP  AX
        CALL DOIS               ; coluna com dois dígitos
        MOV  DX, OFFSET txtlin
        MOV  AH, 09h
        INT  21h
        MOV  AX, BX
        CALL DOIS
        MOV  AX, 1              ; mostra de novo
        INT  33h
        JMP  laco

sai:    MOV  AX, 2
        INT  33h
fim:    MOV  AX, 4C00h
        INT  21h

; CURSOR: põe o cursor de texto em DH = linha, DL = coluna
CURSOR  PROC
        MOV  AH, 02h
        XOR  BH, BH
        INT  10h
        RET
CURSOR  ENDP

; DOIS: mostra AL (0 a 99) com dois dígitos (preserva BX)
DOIS    PROC
        AAM
        ADD  AX, 3030h
        PUSH AX
        MOV  DL, AH
        MOV  AH, 02h
        INT  21h
        POP  AX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        RET
DOIS    ENDP
END inicio
```

Repare que `CURSOR` usa BH, e `DOIS` não estraga BX: a linha fica guardada em BX enquanto a coluna é mostrada.

## Cliques que não se perdem (AX = 05h e 06h)

O laço com `AX = 3` tem um defeito: se o usuário apertar e soltar o botão **entre duas consultas**, o clique some. Num programa que demora para redesenhar a tela, isso acontece.

Para isso o driver conta os cliques. `AX = 5` com **BX = botão** (0 esquerdo, 1 direito, 2 meio) devolve:

- **BX** = quantas vezes o botão foi **apertado** desde a última chamada de `AX = 5` para ele (e zera a contagem);
- **CX, DX** = onde estava o mouse no último aperto;
- **AX** = o estado atual dos botões, como o BX do `AX = 3`.

`AX = 6` faz o mesmo para as **solturas**. Um botão de interface ("OK", "Cancelar") deve reagir à soltura, como no Windows: assim o usuário pode desistir arrastando o mouse para fora antes de soltar.

```asm fragmento
espera: MOV  AX, 5              ; quantos apertos do botão esquerdo?
        XOR  BX, BX             ; BX = 0: botão esquerdo
        INT  33h
        OR   BX, BX
        JZ   espera             ; nenhum: continua esperando
        ; houve pelo menos um clique, em CX, DX
```

## Limites e posição (AX = 04h, 07h e 08h)

- `AX = 4`: move o cursor para **CX, DX**. Útil para começar com o mouse em cima do botão padrão de uma caixa de diálogo.
- `AX = 7`: limita o X entre **CX** (mínimo) e **DX** (máximo).
- `AX = 8`: limita o Y entre **CX** e **DX**.

Um jogo de raquete pode prender o mouse numa faixa horizontal: `AX = 8` com `CX = DX = 184` deixa só o X livre, e o mouse vira um controle de uma dimensão.

`AX = 0Bh` devolve em CX e DX quanto o mouse andou desde a última chamada, em **mickeys** (a unidade do sensor, normalmente 1/200 de polegada), mesmo quando o cursor está parado num limite. Jogos que giram a câmera usam o movimento, e não a posição.

:::anos90 Mickey
O nome da unidade de movimento é uma piada interna da Microsoft: o rato mais famoso do mundo. A razão entre mickeys e pontos da tela (8 mickeys por 8 pontos na horizontal, 16 por 8 na vertical, no padrão) é ajustável com `AX = 0Fh`, e era isso que os utilitários de "velocidade do mouse" mudavam.
:::

## A rotina de eventos (AX = 0Ch)

Consultar o mouse num laço funciona, mas obriga o programa a perguntar o tempo todo. A outra forma é pedir ao driver que **chame uma rotina sua** quando algo acontecer, como uma interrupção feita sob medida. É a função **0Ch**:

- **CX** = máscara de eventos que interessam;
- **ES:DX** = endereço da rotina, que precisa ser **FAR** (termina com `RETF`).

| Bit da máscara | Evento |
|---|---|
| 0 (1) | o mouse se moveu |
| 1 (2) | botão esquerdo apertado |
| 2 (4) | botão esquerdo solto |
| 3 (8) | botão direito apertado |
| 4 (16) | botão direito solto |
| 5 e 6 (32, 64) | botão do meio apertado / solto |

Quando um evento da máscara acontece, o driver (de dentro da interrupção do hardware do mouse) salva todos os registradores e chama a sua rotina com:

- **AX** = os bits dos eventos que aconteceram;
- **BX** = botões; **CX, DX** = posição; **SI, DI** = movimento em mickeys;
- **DS** = o segmento de dados **do driver**, não o seu.

Na volta, o driver restaura todos os registradores. Por isso a rotina pode usar qualquer registrador, mas precisa carregar o próprio DS para mexer nas suas variáveis.

:::atencao As regras de uma rotina de interrupção valem aqui
A rotina roda **no meio de qualquer coisa**: o programa principal pode estar no meio de uma instrução de string ou de uma chamada ao DOS. As regras são as mesmas da [aula 15](aula:aula15) e da [aula 27](aula:aula27): seja rápido, não chame o DOS (a INT 21h não é reentrante), e de preferência só anote o que aconteceu em variáveis que o programa principal vai olhar.

E, principalmente: **desinstale a rotina antes de sair**, com `AX = 0Ch` e `CX = 0` (ou com um reset, `AX = 0`). O driver é residente e continua lá depois que o seu programa termina. Se ele chamar uma rotina que estava num programa que já saiu, ele salta para o código do próximo programa carregado naquela memória, e o PC trava no primeiro movimento do mouse.
:::

```asm executar titulo="EVENTOS.ASM: o driver chama a rotina a cada clique"
.MODEL SMALL
.STACK 100h
.DATA
cliques DW 0                    ; contados pela rotina
ultimo  DW 0
msg     DB 'Clique com o botao esquerdo 5 vezes...', 13, 10, '$'
pronto  DB 'Cinco cliques! Rotina desinstalada.', 13, 10, '$'
.CODE
; chamada pelo driver: AX = eventos, BX = botões, CX = x, DX = y, DS = driver
NOCLIQUE PROC FAR
        MOV  AX, @DATA          ; os registradores serão restaurados pelo driver
        MOV  DS, AX
        INC  cliques
        MOV  ultimo, CX
        RET                     ; num PROC FAR, o RET é um RETF
NOCLIQUE ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        XOR  AX, AX
        INT  33h
        CMP  AX, 0FFFFh
        JNE  fim
        MOV  AX, 1
        INT  33h

        MOV  AX, 0Ch            ; instala a rotina
        MOV  CX, 2              ; só "botão esquerdo apertado"
        PUSH CS
        POP  ES                 ; ES:DX = CS:NOCLIQUE
        MOV  DX, OFFSET NOCLIQUE
        INT  33h

espera: CMP  cliques, 5         ; o programa só olha a variável
        JB   espera

        MOV  AX, 0Ch            ; desinstala: CX = 0
        XOR  CX, CX
        INT  33h
        MOV  AX, 2
        INT  33h
        MOV  DX, OFFSET pronto
        MOV  AH, 09h
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

Execute com **F9** no laboratório e clique na tela do programa: o laço `espera` fica rodando sozinho, e cada clique entra pela rotina. Rode passo a passo depois de um clique para ver o salto para `NOCLIQUE` e a volta para o meio do laço.

## Projeto: um programa de pintura

Para fechar, um programa de pintura no modo 13h, no espírito dos primeiros *paint* do PC. A barra do alto tem as 16 primeiras cores da paleta: clique numa delas para escolher. Com o botão esquerdo apertado, você pinta; o botão direito limpa a tela; **Esc** sai.

```asm jogo titulo="PINTA.ASM: pintura no modo 13h"
.MODEL SMALL
.STACK 200h

ESCONDE MACRO
        MOV  AX, 2
        INT  33h
ENDM
MOSTRA  MACRO
        MOV  AX, 1
        INT  33h
ENDM

BARRA   EQU 12                  ; altura da barra de cores

.DATA
cor     DB 15
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        CLD

        XOR  AX, AX
        INT  33h
        CMP  AX, 0FFFFh
        JNE  sair
        MOV  AX, 8              ; o pincel não entra na barra
        XOR  CX, CX
        MOV  DX, 199
        INT  33h
        CALL PALETA
        MOSTRA

laco:   MOV  AH, 01h            ; tecla?
        INT  16h
        JZ   rato
        MOV  AH, 00h
        INT  16h
        CMP  AL, 27
        JE   sair
rato:   MOV  AX, 3
        INT  33h                ; BX = botões, CX = x (0-639), DX = y
        SHR  CX, 1              ; x do modo 13h
        TEST BX, 2
        JNZ  limpa
        TEST BX, 1
        JZ   laco
        CMP  DX, BARRA
        JB   escolhe
        ESCONDE
        CALL PINCEL
        MOSTRA
        JMP  laco

escolhe:                        ; cor = x / 20
        MOV  AX, CX
        MOV  BL, 20
        DIV  BL
        MOV  cor, AL
        CALL PALETA             ; marca a cor escolhida
        JMP  laco

limpa:  ESCONDE
        MOV  DI, BARRA*320
        MOV  CX, (200-BARRA)*320/2
        XOR  AX, AX
        REP  STOSW
        MOSTRA
        JMP  laco

sair:   XOR  AX, AX             ; reset: cursor e rotinas desligados
        INT  33h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; PINCEL: quadrado 3x3 da cor atual com o canto em (CX, DX)
PINCEL  PROC
        CMP  CX, 317
        JBE  x_ok
        MOV  CX, 317
x_ok:   CMP  DX, 197
        JBE  y_ok
        MOV  DX, 197
y_ok:   MOV  AX, 320
        MUL  DX                 ; AX = y * 320 (DX é zerado)
        ADD  AX, CX
        MOV  DI, AX
        MOV  AL, cor
        MOV  DX, 3              ; três linhas
linha:  STOSB
        STOSB
        STOSB
        ADD  DI, 320-3
        DEC  DX
        JNZ  linha
        RET
PINCEL  ENDP

; PALETA: 16 quadrados de 20x10 com as cores 0 a 15, e um traço sob a cor atual
PALETA  PROC
        ESCONDE
        XOR  DI, DI
        MOV  DX, 10             ; 10 linhas
p_lin:  XOR  AL, AL             ; cor do primeiro quadrado
        MOV  BX, 16
p_quad: MOV  CX, 20
        REP  STOSB
        INC  AL
        DEC  BX
        JNZ  p_quad
        DEC  DX
        JNZ  p_lin
        MOV  DI, 10*320         ; linhas 10 e 11: o marcador
        MOV  CX, 2*320/2
        XOR  AX, AX
        REP  STOSW
        MOV  AL, cor
        MOV  AH, 20
        MUL  AH                 ; AX = cor * 20
        ADD  AX, 10*320
        MOV  DI, AX
        MOV  AL, 15
        MOV  CX, 20
        REP  STOSB
        MOSTRA
        RET
PALETA  ENDP
END inicio
```

Algumas escolhas que valem comentar:

- As macros `ESCONDE` e `MOSTRA` da [aula 45](aula:aula45) deixam o laço legível. São duas instruções cada: o caso típico de macro.
- `AX = 8` limita o Y de 0 a 199, mas a barra de cores precisa do mouse, então o limite aqui é a tela inteira. Troque para `CX = BARRA` e veja o mouse parar de entrar na barra (e o programa perder a escolha de cores).
- `PINCEL` usa `MUL` para calcular `y × 320`, a forma mais curta de escrever. A [aula 23](aula:aula23) mostra a versão com deslocamentos, bem mais rápida.
- Se você arrastar o mouse depressa, o traço sai pontilhado: entre duas consultas, o mouse andou mais que 3 pixels. Os programas de pintura de verdade guardam o ponto anterior e desenham uma **linha** até o novo (o algoritmo de Bresenham).

```quiz
? Depois de `XOR AX,AX` e `INT 33h`, o que indica que há um mouse?
+ AX = FFFFh
- AX = 0
- CF = 0
> O reset devolve FFFFh em AX (e o número de botões em BX) quando há driver e mouse.

? No modo 13h, o driver devolveu CX = 500. Em que coluna de pixel está o mouse?
- 500
+ 250
- 62
> No modo 13h o X virtual vai de 0 a 639: divida por 2.

? Um programa chamou AX=2 duas vezes e depois AX=1 uma vez. O cursor está visível?
- Sim, AX=1 sempre mostra
+ Não: o contador está em -2 depois dos dois AX=2, e um AX=1 o leva a -1
- Depende do modo de vídeo
> Mostrar e esconder são contados. Só com o contador em 0 o cursor aparece.

? Por que um laço com AX=3 pode perder cliques?
+ Porque um aperto e uma soltura podem acontecer entre duas consultas
- Porque a função 3 só funciona no modo texto
- Porque o driver zera os botões a cada chamada
> AX=3 é uma foto do momento. AX=5 e AX=6 contam apertos e solturas desde a última chamada.

? Dentro da rotina instalada com AX=0Ch, para que serve carregar DS?
- Para devolver o valor ao driver
+ Porque o driver chama a rotina com DS apontando para os dados dele, não para os seus
- Não precisa: DS é sempre o do programa
> Os registradores são restaurados na volta, mas na entrada DS é o do driver.

? O que acontece se o programa terminar sem desinstalar a rotina do mouse?
- Nada: o DOS desinstala sozinho
+ O driver, que é residente, continua chamando aquele endereço, onde agora há outra coisa
- O cursor some
> O DOS não sabe da rotina. Desinstale com AX=0Ch e CX=0, ou com um reset (AX=0).
```

## Exercícios

```exercicio
id: a47-1
titulo: Onde foi o clique?
nivel: 1
--- enunciado
Espere o **botão esquerdo** ser apertado e guarde a **coluna** e a **linha** de texto onde o mouse estava em `col` e `lin` (bytes). O programa já faz o reset do driver.

Use `AX = 3` num laço até o bit 0 de BX ligar, e converta: coluna = X / 8, linha = Y / 8.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
col     DB 0
lin     DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        INT  33h
        ; espere o clique e calcule col e lin

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "clique em (100, 50)", "mouse": [[100, 50, 0], [100, 50, 1]], "espera": { "mem": { "col": 12, "lin": 6 } } },
 { "nome": "canto inferior direito", "mouse": [[639, 199, 0], [639, 199, 1]], "espera": { "mem": { "col": 79, "lin": 24 } } },
 { "nome": "o direito não conta", "mouse": [[16, 16, 2], [16, 16, 0], [40, 8, 1]], "espera": { "mem": { "col": 5, "lin": 1 } } }]
--- dicas
O laço: MOV AX,3 / INT 33h / TEST BX,1 / JZ volta.
Para dividir por 8 no 8086: MOV AX,CX / MOV CL,3 / SHR AX,CL. Faça a conta do Y antes de estragar CL... ou guarde CX antes.
Guarde só o byte baixo: MOV col,AL.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
col     DB 0
lin     DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        INT  33h
espera: MOV  AX, 3
        INT  33h
        TEST BX, 1
        JZ   espera
        MOV  AX, CX
        MOV  CL, 3
        SHR  AX, CL
        MOV  col, AL
        SHR  DX, CL
        MOV  lin, DL
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a47-2
titulo: Contador de cliques
nivel: 2
--- enunciado
Conte quantas vezes o **botão esquerdo** foi apertado até o **botão direito** ser apertado, e guarde a contagem em `cliques`. Não perca nenhum clique: use `AX = 5` (contagem de apertos) para o botão esquerdo.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
cliques DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        INT  33h
laco:   MOV  AX, 3
        INT  33h
        TEST BX, 2              ; direito: sai
        JZ   laco
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "três cliques", "mouse": [[10, 10, 1], [10, 10, 0], [20, 10, 1], [20, 10, 0], [30, 10, 1], [30, 10, 0], [30, 10, 2]], "espera": { "mem": { "cliques": 3 } } },
 { "nome": "nenhum clique", "mouse": [[50, 50, 0], [60, 60, 2]], "espera": { "mem": { "cliques": 0 } } },
 { "nome": "segurando o esquerdo enquanto mexe", "mouse": [[0, 0, 1], [80, 0, 1], [160, 0, 1], [160, 0, 0], [8, 8, 1], [8, 8, 0], [8, 8, 2]], "espera": { "mem": { "cliques": 2 } } }]
--- dicas
Dentro do laço, antes de olhar o direito: MOV AX,5 / XOR BX,BX / INT 33h / ADD cliques,BX.
O AX = 5 devolve em AX o estado atual dos botões: dá para testar o direito ali mesmo (TEST AX,2).
Arrastar com o botão apertado não é um novo aperto: a contagem do driver já cuida disso.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
cliques DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        INT  33h
laco:   MOV  AX, 5
        XOR  BX, BX             ; botão esquerdo
        INT  33h
        ADD  cliques, BX        ; apertos desde a última vez
        TEST AX, 2              ; AX = botões agora
        JZ   laco
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a47-3
titulo: A rotina de eventos
nivel: 3
maxPassos: 300000
--- enunciado
Instale uma rotina de eventos (`AX = 0Ch`) para o evento **botão esquerdo apertado**. A rotina deve guardar X / 2 (o X do modo 13h) em `px`, o Y em `py` e ligar `pronto` (1). O programa fica no modo texto, então X e Y chegam em múltiplos de 8.

O programa principal já espera `pronto`. Depois disso, ele precisa **desinstalar a rotina** (`AX = 0Ch` com `CX = 0`) e terminar.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
px      DW 0
py      DW 0
pronto  DB 0
.CODE
ROTINA  PROC FAR
        ; DS aqui é o do driver!
        RET
ROTINA  ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        INT  33h
        ; instale a rotina aqui

espera: CMP  pronto, 1
        JNE  espera
        ; desinstale a rotina aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "clique em (200, 80)", "mouse": [[200, 80, 0], [200, 80, 1]], "espera": { "mem": { "px": 100, "py": 80, "pronto": 1 }, "mouseSemRotina": true } },
 { "nome": "mexer não dispara", "mouse": [[10, 10, 0], [600, 150, 0], [601, 199, 1]], "espera": { "mem": { "px": 300, "py": 192, "pronto": 1 }, "mouseSemRotina": true } }]
--- dicas
Instalar: MOV AX,0Ch / MOV CX,2 / PUSH CS / POP ES / MOV DX,OFFSET ROTINA / INT 33h.
Na rotina: MOV AX,@DATA / MOV DS,AX (o driver restaura tudo na volta), SHR CX,1, e grave px, py e pronto.
Desinstalar: MOV AX,0Ch / XOR CX,CX / INT 33h.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
px      DW 0
py      DW 0
pronto  DB 0
.CODE
ROTINA  PROC FAR
        MOV  AX, @DATA
        MOV  DS, AX
        SHR  CX, 1
        MOV  px, CX
        MOV  py, DX
        MOV  pronto, 1
        RET
ROTINA  ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        XOR  AX, AX
        INT  33h
        MOV  AX, 0Ch
        MOV  CX, 2
        PUSH CS
        POP  ES
        MOV  DX, OFFSET ROTINA
        INT  33h
espera: CMP  pronto, 1
        JNE  espera
        MOV  AX, 0Ch
        XOR  CX, CX
        INT  33h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## No livro

O [Capítulo 15](livro:cap15) desce um nível: a BIOS do mouse do PS/2 (`INT 15h, AH=C2h`), que o driver usa por baixo, com os pacotes de 3 bytes e a rotina que recebe os dados pela pilha. O [Capítulo 20](livro:cap20) reúne os serviços da BIOS mais usados em jogos.

:::resumo
- O **driver** do mouse é um TSR que oferece a **INT 33h**; a BIOS do PS/2 (INT 15h, AH=C2h) é a camada de baixo.
- **AX=0**: reset; AX = FFFFh se há mouse, BX = botões. Sempre a primeira chamada.
- Coordenadas **virtuais** de 640×200: no texto, coluna = X/8 e linha = Y/8; no **13h, pixel = X/2**.
- **AX=1/2** mostram e escondem o cursor, **com contador**. Esconda antes de desenhar e mostre depois.
- **AX=3**: botões em BX (bit 0 esquerdo, bit 1 direito), posição em CX, DX. **AX=5/6** contam apertos e solturas sem perder nenhum.
- **AX=4** posiciona, **AX=7/8** limitam, **AX=0Bh** dá o movimento em mickeys.
- **AX=0Ch** instala uma rotina FAR chamada a cada evento da máscara, com DS do driver. Seja rápido, não chame o DOS e **desinstale antes de sair** (CX=0).
:::
