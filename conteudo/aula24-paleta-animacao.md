---
id: aula24
numero: 24
modulo: 9
titulo: Paleta, retraço e animação
subtitulo: o DAC da VGA, o retraço vertical, double buffer e sprites
duracao: 100 min
objetivos: trocar as 256 cores da paleta pelas portas 3C8h e 3C9h e ler cores pela 3C7h; usar as funções de paleta da INT 10h; montar degradês; animar a tela girando a paleta; sincronizar o desenho com o retraço vertical pela porta 3DAh; desenhar fora da tela num buffer e copiá-lo com REP MOVSW (double buffer); desenhar sprites com cor transparente
---

## A paleta: 256 cores escolhidas entre 262.144

Na aula passada você viu que o byte de cada pixel é um **índice** numa tabela de cores. Essa tabela fica dentro da placa VGA, num chip chamado **DAC** (Digital-to-Analog Converter), que transforma números em tensões para o monitor. O DAC tem 256 registradores de cor, e cada um guarda três componentes: **vermelho**, **verde** e **azul** (R, G e B), cada um com **6 bits**, de 0 a 63.

```diagrama titulo="Do byte na memória à cor no monitor"
  memória A000h          DAC (paleta)                      monitor
  ┌────────────┐        ┌─────┬────┬────┬────┐
  │ pixel = 4  │──────► │ cor │ R  │ G  │ B  │
  └────────────┘        ├─────┼────┼────┼────┤
                        │  0  │  0 │  0 │  0 │
                        │  1  │  0 │  0 │ 42 │
                        │  ...│    │    │    │
                        │  4  │ 42 │  0 │  0 │ ───► vermelho
                        │  ...│    │    │    │
                        │ 255 │  0 │  0 │  0 │
                        └─────┴────┴────┴────┘
         6 bits por componente: 64 × 64 × 64 = 262.144 cores possíveis
```

A consequência é poderosa: **trocar uma cor da paleta muda, na hora, todos os pixels que usam aquele índice**, sem tocar em um único byte da memória de vídeo. Escrever 3 bytes no DAC pode mudar a tela inteira.

## Programando o DAC pelas portas

O DAC é acessado por três portas de E/S:

| Porta | Uso |
|-------|-----|
| `3C8h` | escreva aqui o **número da cor** que vai ser **alterada** |
| `3C9h` | escreva os três componentes, nesta ordem: R, G, B |
| `3C7h` | escreva aqui o número da cor que vai ser **lida**; depois leia R, G e B na 3C9h |

O detalhe que economiza trabalho: depois do terceiro componente, o índice **avança sozinho** para a cor seguinte. Para carregar uma faixa de cores, basta indicar a primeira e mandar os componentes em sequência.

Como os números de porta são maiores que 255, é preciso usar DX (`OUT 3C8h,AL` não existe; o `OUT` com número imediato só alcança as portas 0 a 255):

```asm fragmento
        MOV  DX, 3C8h       ; vamos alterar...
        MOV  AL, 1          ; ...a cor número 1
        OUT  DX, AL
        INC  DX             ; DX = 3C9h, a porta dos componentes
        MOV  AL, 63         ; R
        OUT  DX, AL
        MOV  AL, 32         ; G
        OUT  DX, AL
        XOR  AL, AL         ; B
        OUT  DX, AL         ; a cor 1 agora é laranja (e o índice já foi para 2)
```

:::atencao São 6 bits, não 8
Os valores vão de **0 a 63**. Quem vem de programas modernos, com componentes de 0 a 255, costuma mandar 255 e se assusta: o DAC só usa os 6 bits baixos, e 255 vira 63, mas 128 vira 0! Para converter um valor de 0 a 255, divida por 4 (`SHR AL,1` duas vezes).
:::

Ler funciona do mesmo jeito, com a porta 3C7h no lugar da 3C8h:

```asm fragmento
        MOV  DX, 3C7h       ; vamos ler...
        MOV  AL, 4          ; ...a cor número 4
        OUT  DX, AL
        MOV  DX, 3C9h
        IN   AL, DX         ; R
        MOV  BL, AL
        IN   AL, DX         ; G
        MOV  BH, AL
        IN   AL, DX         ; B
```

## Um degradê

Com o autoincremento, montar um degradê é um laço curto. Este programa faz as cores 0 a 63 irem do azul ao vermelho (R = i, G = 0, B = 63 − i) e pinta uma faixa de 3 linhas com cada uma:

```asm executar titulo="DEGRADE.ASM: do azul ao vermelho"
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h

        MOV  DX, 3C8h           ; começa a escrever na cor 0
        XOR  AL, AL
        OUT  DX, AL
        INC  DX                 ; 3C9h
        XOR  BL, BL             ; BL = i
@@cor:  MOV  AL, BL
        OUT  DX, AL             ; R = i
        XOR  AL, AL
        OUT  DX, AL             ; G = 0
        MOV  AL, 63
        SUB  AL, BL
        OUT  DX, AL             ; B = 63 - i
        INC  BL
        CMP  BL, 64
        JB   @@cor

        MOV  AX, 0A000h         ; uma faixa de 3 linhas (960 pixels) por cor
        MOV  ES, AX
        XOR  DI, DI
        XOR  AL, AL
        CLD
@@faixa:
        MOV  CX, 960
        REP  STOSB
        INC  AL
        CMP  AL, 64
        JB   @@faixa

        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Repare que a cor 0 também mudou (virou azul puro): é ela que pinta o "fundo" de toda a tela, até as linhas de baixo, que ninguém desenhou.

## A paleta pela BIOS

A INT 10h, **função 10h**, faz o mesmo trabalho com registradores, sem você tocar nas portas:

| AX | Faz | Entrada |
|----|-----|---------|
| `1010h` | muda uma cor | BX = número da cor, DH = R, CH = G, CL = B |
| `1012h` | muda um bloco de cores | BX = primeira cor, CX = quantas, ES:DX = tabela com R, G, B, R, G, B... |
| `1015h` | lê uma cor | BX = número; devolve DH = R, CH = G, CL = B |
| `1017h` | lê um bloco | BX = primeira, CX = quantas, ES:DX = onde gravar |

```asm fragmento
.DATA
cores   DB 63, 0, 0         ; vermelho
        DB 0, 63, 0         ; verde
        DB 0, 0, 63         ; azul
.CODE
        ...
        PUSH DS
        POP  ES             ; ES:DX aponta para a tabela
        LEA  DX, cores
        MOV  BX, 100        ; cores 100, 101 e 102
        MOV  CX, 3
        MOV  AX, 1012h
        INT  10h
```

A forma do bloco (`1012h`) é especialmente cômoda para carregar uma paleta inteira guardada num arquivo de imagem, por exemplo. As portas continuam sendo o caminho mais rápido e o único que funciona dentro de uma rotina de interrupção sem medo, mas para carregar a paleta uma vez, no começo do programa, a BIOS serve muito bem.

## O retraço vertical

O monitor de tubo desenha a imagem com um feixe de elétrons que varre a tela linha por linha, de cima para baixo, cerca de **70 vezes por segundo** no modo 13h. Quando chega ao fim da última linha, o feixe é desligado e volta ao canto superior esquerdo. Esse intervalo de volta é o **retraço vertical** (*vertical retrace*).

```diagrama titulo="Um quadro de vídeo"
   ┌──────────────────────────────┐ ◄─┐
   │ ───────────────────────────► │   │
   │ ───────────────────────────► │   │ o feixe desenha as linhas:
   │ ───────────────────────────► │   │ a placa está LENDO a memória
   │            ...               │   │
   │ ───────────────────────────► │   │
   └──────────────────────────────┘ ◄─┘
              │      ▲
              └──────┘  retraço: o feixe volta para cima, nada é desenhado
                        (porta 3DAh, bit 3 = 1)
```

Se o programa muda a memória de vídeo ou a paleta **enquanto o feixe está desenhando**, a parte de cima do quadro mostra a imagem velha e a de baixo, a nova. O resultado é um "rasgo" horizontal na imagem, ou cores piscando. A solução é esperar o retraço e fazer as mudanças nele.

A porta **3DAh** (registrador de status da VGA) diz em que momento estamos: o **bit 3** fica em 1 durante o retraço vertical. A espera clássica tem duas etapas:

```asm fragmento
; ESPERA_VR: espera o começo de um retraço vertical
ESPERA_VR PROC
        PUSH AX
        PUSH DX
        MOV  DX, 3DAh
@@fora: IN   AL, DX         ; 1. se já estamos no meio de um retraço,
        TEST AL, 8          ;    espera ele acabar...
        JNZ  @@fora
@@dentro:
        IN   AL, DX         ; 2. ...e então espera o próximo começar
        TEST AL, 8
        JZ   @@dentro
        POP  DX
        POP  AX
        RET
ESPERA_VR ENDP
```

Por que duas etapas? Se o programa chegasse aqui já no fim de um retraço, só a segunda espera sairia imediatamente, e ele teria quase nada de tempo antes de o feixe recomeçar. Esperando primeiro o retraço atual acabar, você garante que vai pegar um retraço **desde o começo**.

:::cpu Um relógio de graça
Como o retraço acontece a uma frequência fixa, `ESPERA_VR` também serve de **relógio**: um laço que espera o retraço a cada volta roda na mesma velocidade em qualquer PC com VGA, rápido ou lento. Muitos jogos usavam isso para não "voar" em máquinas mais novas. No simulador, um quadro dura 68.182 ciclos (4,77 MHz ÷ 70).
:::

## Animação pela paleta

Agora junte as duas ideias. Desenhe a tela **uma vez só**, com faixas diagonais que usam as cores 64 a 127, e depois, a cada retraço, **gire a paleta**: a cor 64 recebe o valor que era da 65, a 65 o da 66, e a última recebe o da primeira. Nenhum pixel é redesenhado, mas as faixas parecem correr pela tela.

```asm executar titulo="GIRA.ASM: animação girando a paleta (aperte uma tecla para sair)"
.MODEL SMALL
.STACK 100h
.DATA
pal     DB 64*3 DUP(?)          ; R, G, B das cores 64 a 127
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h

        ; monta 64 cores com R, G e B em "ondas" defasadas (um arco-íris que fecha o ciclo)
        LEA  DI, pal
        XOR  BL, BL             ; BL = i
@@monta:
        MOV  AL, BL
        CALL ONDA
        MOV  [DI], AL           ; R = onda(i)
        MOV  AL, BL
        ADD  AL, 21
        CALL ONDA
        MOV  [DI+1], AL         ; G = onda(i + 21)
        MOV  AL, BL
        ADD  AL, 42
        CALL ONDA
        MOV  [DI+2], AL         ; B = onda(i + 42)
        ADD  DI, 3
        INC  BL
        CMP  BL, 64
        JB   @@monta
        CALL CARREGA

        ; desenha uma vez: cor do pixel = 64 + ((x + y) AND 63)
        MOV  AX, 0A000h
        MOV  ES, AX
        XOR  DI, DI
        CLD
        XOR  DX, DX             ; y
@@lin:  XOR  CX, CX             ; x
@@px:   MOV  AL, CL
        ADD  AL, DL
        AND  AL, 63
        ADD  AL, 64
        STOSB
        INC  CX
        CMP  CX, 320
        JB   @@px
        INC  DX
        CMP  DX, 200
        JB   @@lin

        ; laço da animação: gira a tabela e recarrega no retraço
        PUSH DS
        POP  ES                 ; MOVSB abaixo copia dentro de DS
@@quadro:
        MOV  AL, pal            ; guarda a primeira cor
        MOV  AH, pal+1
        MOV  BL, pal+2
        LEA  DI, pal            ; desloca as outras 63 cores uma posição para trás
        LEA  SI, pal+3
        MOV  CX, 63*3
        REP  MOVSB
        MOV  [DI], AL           ; e a primeira vai para o fim
        MOV  [DI+1], AH
        MOV  [DI+2], BL
        CALL ESPERA_VR
        CALL CARREGA
        MOV  AH, 01h            ; alguma tecla?
        INT  16h
        JZ   @@quadro

        MOV  AH, 00h            ; consome a tecla
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ONDA: AL = 0..63 -> AL = 0..62..0 (sobe e desce, um "triângulo")
ONDA    PROC
        AND  AL, 63
        CMP  AL, 32
        JB   @@sobe
        NEG  AL
        ADD  AL, 63             ; AL = 63 - AL
@@sobe: SHL  AL, 1
        RET
ONDA    ENDP

; CARREGA: copia a tabela pal para as cores 64 a 127 do DAC
CARREGA PROC
        PUSH AX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  DX, 3C8h
        MOV  AL, 64
        OUT  DX, AL
        INC  DX
        LEA  SI, pal
        MOV  CX, 64*3
@@comp: LODSB
        OUT  DX, AL
        LOOP @@comp
        POP  SI
        POP  DX
        POP  CX
        POP  AX
        RET
CARREGA ENDP

ESPERA_VR PROC
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
ESPERA_VR ENDP
END inicio
```

Cada quadro custa 192 `OUT`s e uma cópia de 189 bytes, quase nada perto de redesenhar 64.000 pixels. Repare que `OUTSB`, que mandaria a tabela para a porta com um `REP` só, não existe no 8086 (chegou no 80186); por isso o laço `LODSB` / `OUT` / `LOOP`.

:::anos90 Fogo, água e plasma
A rotação de paleta foi um dos truques mais usados da época. Cachoeiras, lava, luzes piscando em painéis, letreiros com brilho correndo: muitas vezes nada disso era redesenhado, só as cores giravam. As demos levaram a ideia ao extremo nos efeitos de "plasma" e de "fogo", em que a paleta é cuidadosamente escolhida para que pequenas mudanças nos índices pareçam movimento contínuo. Como o PC era lento para redesenhar a tela inteira a cada quadro, mudar 768 bytes de paleta em vez de 64.000 de imagem era a diferença entre uma animação suave e uma apresentação de slides.
:::

## Double buffer: desenhar fora da tela

Para animações de verdade, com objetos se movendo, é preciso redesenhar. O problema: se você apaga o objeto e o desenha de novo na posição nova **direto na tela**, o feixe pode passar no meio do caminho e mostrar a tela com o objeto apagado. A imagem pisca.

A técnica do **double buffer** resolve isso: monte o quadro inteiro numa área de 64.000 bytes da memória comum (o *buffer*), longe dos olhos do usuário, e só então copie tudo de uma vez para A000h, de preferência logo depois do retraço.

```diagrama titulo="Double buffer"
   ┌──────────────┐  1. limpa e desenha     ┌──────────────┐
   │   buffer     │ ◄────────────────────── │   programa   │
   │ (64.000 B na │                          └──────────────┘
   │ memória RAM) │  2. espera o retraço
   └──────┬───────┘  3. REP MOVSW (32.000 words)
          ▼
   ┌──────────────┐
   │  A000:0000   │  o usuário só vê quadros prontos
   └──────────────┘
```

Onde arrumar 64.000 bytes? Eles não cabem junto com os dados do programa (o segmento `.DATA` tem no máximo 64 KB, e a pilha mora lá). O jeito certo é **pedir memória ao DOS**: a função `AH=48h` da INT 21h devolve em AX o segmento de um bloco novo, com o tamanho pedido em BX, em parágrafos (64.000 ÷ 16 = 4.000). Só que um programa `.EXE` começa dono de toda a memória livre, e antes é preciso devolver a sobra com `AH=4Ah`. Esse ritual é assunto da Aula 26; por enquanto, use as linhas prontas do exemplo.

```asm executar titulo="DUPLO.ASM: um quadrado andando com double buffer"
.MODEL SMALL
.STACK 200h
.DATA
buffer  DW ?                    ; segmento do buffer de 64.000 bytes
x       DW 0                    ; posição do quadrado
semmem  DB 'Memoria insuficiente.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        ; devolve ao DOS a memória que o programa não usa (veja a Aula 26)
        MOV  BX, SS             ; o programa vai do PSP (ES) até o fim da pilha
        MOV  AX, ES
        SUB  BX, AX
        MOV  AX, SP
        MOV  CL, 4
        SHR  AX, CL
        ADD  BX, AX
        INC  BX                 ; BX = tamanho do programa em parágrafos
        MOV  AH, 4Ah
        INT  21h
        ; pede 4000 parágrafos (64.000 bytes) para o buffer
        MOV  AH, 48h
        MOV  BX, 4000
        INT  21h
        JC   @@erro
        MOV  buffer, AX

        MOV  AX, 0013h
        INT  10h
        CLD
@@quadro:
        MOV  ES, buffer         ; 1. desenha no buffer
        XOR  DI, DI
        MOV  AX, 0101h          ;    fundo azul, dois pixels por STOSW
        MOV  CX, 32000
        REP  STOSW
        MOV  DI, 80*320         ;    quadrado 40x40 na linha 80, coluna x
        ADD  DI, x
        MOV  AL, 14
        MOV  DX, 40
@@q:    MOV  CX, 40
        REP  STOSB
        ADD  DI, 320-40
        DEC  DX
        JNZ  @@q

        CALL ESPERA_VR          ; 2. espera o retraço
        PUSH DS                 ; 3. copia o buffer inteiro para a tela
        MOV  DS, buffer
        XOR  SI, SI
        MOV  AX, 0A000h
        MOV  ES, AX
        XOR  DI, DI
        MOV  CX, 32000
        REP  MOVSW
        POP  DS

        ADD  x, 4
        CMP  x, 280
        JBE  @@quadro

        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  ES, buffer         ; devolve o buffer ao DOS
        MOV  AH, 49h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
@@erro: LEA  DX, semmem
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C01h
        INT  21h

ESPERA_VR PROC
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
ESPERA_VR ENDP
END inicio
```

Repare em `MOV DS,buffer` **dentro** do trecho entre `PUSH DS` e `POP DS`: a variável `buffer` é lida enquanto DS ainda aponta para os dados; depois disso, DS aponta para o buffer e nenhuma variável do programa pode ser usada até o `POP DS`.

:::atencao O preço da cópia no 8086
`REP MOVSW` copia uma word a cada 17 ciclos: 32.000 words são mais de 540.000 ciclos, cerca de um nono de segundo a 4,77 MHz, ou uns oito quadros de vídeo. Num 8086 de verdade, com uma placa VGA no barramento lento de 8 bits, ficava ainda pior. Por isso o double buffer de tela inteira só ficou comum nos 386 e 486. Nas máquinas lentas, a saída era copiar só os retângulos que mudaram ("retângulos sujos"), ou desenhar com cuidado direto na tela, logo depois do retraço.
:::

## Sprites e transparência

Um **sprite** é uma pequena imagem que se move pela tela: o personagem, um inimigo, o cursor do mouse. Guardado na memória, ele é só um retângulo de bytes, linha por linha, como uma mini tela 13h.

Mas sprites raramente são retangulares. Para que o fundo apareça em volta da figura, reserva-se uma cor como **transparente**, quase sempre a cor **0**: na hora de desenhar, os pixels com 0 são pulados.

```asm executar titulo="SPRITE.ASM: carinhas sobre um fundo listrado"
.MODEL SMALL
.STACK 100h
.DATA
; 8x8 pixels. 0 = transparente; 16 é preto (na paleta padrão, cinza 0)
carinha DB  0, 0,14,14,14,14, 0, 0
        DB  0,14,14,14,14,14,14, 0
        DB 14,14,16,14,14,16,14,14
        DB 14,14,14,14,14,14,14,14
        DB 14,16,14,14,14,14,16,14
        DB 14,14,16,16,16,16,14,14
        DB  0,14,14,14,14,14,14, 0
        DB  0, 0,14,14,14,14, 0, 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX

        XOR  DI, DI             ; fundo: listras verticais azuis e verdes de 4 pixels
        CLD
        MOV  DX, 200
@@lin:  MOV  BX, 40
@@lis:  MOV  AX, 0101h
        STOSW
        STOSW
        MOV  AX, 0202h
        STOSW
        STOSW
        DEC  BX
        JNZ  @@lis
        DEC  DX
        JNZ  @@lin

        MOV  BX, 10             ; uma fileira de carinhas descendo em diagonal
        MOV  DX, 20
@@uma:  LEA  SI, carinha
        CALL SPRITE
        ADD  BX, 30
        ADD  DX, 15
        CMP  BX, 300
        JB   @@uma

        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; SPRITE: desenha 8x8 bytes de DS:SI em (BX, DX), pulando a cor 0.
; Espera ES = A000h. Preserva os registradores.
SPRITE  PROC
        PUSH AX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        MOV  DH, DL             ; DI = y * 320 + x
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, BX
        MOV  DX, 8              ; linhas do sprite
@@lin:  MOV  CX, 8              ; pixels por linha
@@px:   LODSB
        OR   AL, AL             ; transparente?
        JZ   @@pula
        MOV  ES:[DI], AL
@@pula: INC  DI
        LOOP @@px
        ADD  DI, 320-8          ; começo da próxima linha do sprite
        DEC  DX
        JNZ  @@lin
        POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  AX
        RET
SPRITE  ENDP
END inicio
```

Como a cor 0 virou "transparente", ela não pode mais ser usada para pintar o preto dentro do sprite. Os olhos da carinha usam a cor **16**, que na paleta padrão também é preta (é o primeiro tom da escala de cinzas). Esse tipo de truque com cores repetidas era comum: o desenhista sabia de antemão quais índices o programador reservava.

:::dica Mover um sprite sem estragar o fundo
Para mover um sprite sem redesenhar o cenário todo, os jogos guardavam o pedaço do fundo que ia ficar embaixo dele antes de desenhar (um `MOVSB` da tela para um buffer de 64 bytes) e o devolviam antes de desenhar na posição nova. Com double buffer, nem isso é preciso: o quadro inteiro é refeito a cada vez.
:::

```quiz
? Quais valores cada componente (R, G, B) de uma cor do DAC aceita?
- 0 a 255
+ 0 a 63
- 0 a 15
- 0 a 7
> O DAC da VGA tem 6 bits por componente: 64 níveis de cada, 262.144 combinações.

? Depois de OUT 3C8h com o índice 10 e três OUT na 3C9h, o que acontece se você mandar mais três valores para a 3C9h?
- Eles sobrescrevem a cor 10
+ Eles vão para a cor 11, porque o índice avança sozinho
- Nada: é preciso escrever o índice de novo
> O autoincremento do DAC permite carregar uma faixa inteira de cores com um laço simples.

? Por que não se pode escrever OUT 3C9h, AL?
+ Porque a forma com número imediato só alcança as portas de 0 a 255; acima disso, a porta vai em DX
- Porque a porta 3C9h só aceita words
- Porque OUT só funciona com AX
> OUT imediato tem um byte para a porta. Para 3C8h, 3C9h e 3DAh, use MOV DX,porta / OUT DX,AL.

? O que indica o bit 3 da porta 3DAh?
- Que uma tecla foi pressionada
+ Que o monitor está no retraço vertical, quando nada é desenhado
- Que a paleta foi alterada
> Mudanças feitas durante o retraço não aparecem pela metade na tela.

? Por que o double buffer evita que a animação pisque?
- Porque o buffer é mais rápido que a memória de vídeo
+ Porque o quadro é montado longe da tela e o usuário só vê quadros completos
- Porque ele dobra a resolução
> Apagar e redesenhar direto na tela deixa o feixe flagrar o quadro pela metade. No buffer, ninguém vê o trabalho em andamento.

? Num sprite com cor transparente 0, como desenhar um pixel preto?
- Não é possível
+ Usando outro índice cuja cor também seja preta, como o 16 da paleta padrão
- Usando a cor 255 sempre
> O índice 0 passou a significar "não desenhe". Qualquer outro índice com R = G = B = 0 serve como preto.
```

## Exercícios

```exercicio
id: a24-1
titulo: Degradê azul
nivel: 1
exigir: OUT
--- enunciado
Depois de ligar o modo 13h, programe as cores **0 a 63** da paleta para um degradê do preto ao azul: a cor *i* deve ficar com R = 0, G = 0 e B = *i*. Use as portas do DAC.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        ; programe as cores 0 a 63

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "cores 0 a 63", "espera": { "paleta": { "0": [0, 0, 0], "1": [0, 0, 1], "14": [0, 0, 14], "32": [0, 0, 32], "63": [0, 0, 63] } } }]
--- dicas
Escreva 0 na porta 3C8h (a primeira cor) e depois mande os componentes para a 3C9h, sempre por DX.
O índice avança sozinho a cada três valores. Um laço de 64 voltas manda 0, 0 e i.
Guarde i num registrador que não seja AL (por exemplo BL), porque AL é usado pelo OUT.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  DX, 3C8h
        XOR  AL, AL
        OUT  DX, AL             ; começa na cor 0
        INC  DX                 ; 3C9h
        XOR  BL, BL
@@cor:  XOR  AL, AL
        OUT  DX, AL             ; R = 0
        OUT  DX, AL             ; G = 0
        MOV  AL, BL
        OUT  DX, AL             ; B = i
        INC  BL
        CMP  BL, 64
        JB   @@cor
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a24-2
titulo: O negativo de uma cor
nivel: 2
exigir: IN
--- enunciado
A variável **cor** guarda o número de uma cor da paleta. Leia os três componentes dessa cor no DAC e grave de volta, na mesma cor, o **negativo**: 63 − R, 63 − G e 63 − B. A paleta é a padrão do modo 13h (por exemplo, a cor 4 é R = 42, G = 0, B = 0 e deve virar 21, 63, 63).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
cor     DB 4
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        ; leia a cor e grave o negativo

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "cor 4 (vermelho)", "espera": { "paleta": { "4": [21, 63, 63], "5": [42, 0, 42] } } },
 { "nome": "cor 15 (branco)", "setup": { "cor": 15 }, "espera": { "paleta": { "15": [0, 0, 0] } } },
 { "nome": "cor 20 (cinza)", "setup": { "cor": 20 }, "espera": { "paleta": { "20": [49, 49, 49], "4": [42, 0, 0] } } }]
--- dicas
Para ler: escreva o número da cor na porta 3C7h e leia R, G e B, nesta ordem, com três IN AL,DX na porta 3C9h.
Guarde os três valores em registradores livres (BL, BH e CL, por exemplo) antes de escrever qualquer coisa.
Para gravar: número da cor na 3C8h e três OUT na 3C9h. Para calcular 63 − x: MOV AL,63 / SUB AL,x.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
cor     DB 4
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  DX, 3C7h           ; vamos ler a cor
        MOV  AL, cor
        OUT  DX, AL
        MOV  DX, 3C9h
        IN   AL, DX
        MOV  BL, AL             ; R
        IN   AL, DX
        MOV  BH, AL             ; G
        IN   AL, DX
        MOV  CL, AL             ; B
        MOV  DX, 3C8h           ; vamos escrever na mesma cor
        MOV  AL, cor
        OUT  DX, AL
        INC  DX
        MOV  AL, 63
        SUB  AL, BL
        OUT  DX, AL
        MOV  AL, 63
        SUB  AL, BH
        OUT  DX, AL
        MOV  AL, 63
        SUB  AL, CL
        OUT  DX, AL
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a24-3
titulo: Sprite transparente
nivel: 2
--- enunciado
A tela já está pintada com a cor 2 (verde). Desenhe o sprite **fig**, de **4 × 4** pixels, com o canto superior esquerdo em (**px**, **py**). Os pixels de cor **0** são transparentes: nesses lugares o verde do fundo tem que continuar aparecendo.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
fig     DB 0, 9, 9, 0
        DB 9,15,15, 9
        DB 9,15,15, 9
        DB 0, 9, 9, 0
px      DW 10
py      DW 20
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        XOR  DI, DI             ; fundo verde
        MOV  AL, 2
        MOV  CX, 64000
        CLD
        REP  STOSB
        ; desenhe fig em (px, py)

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "em (10, 20)", "espera": { "contaPixels": { "9": 8, "15": 4, "2": 63988 }, "pixel": { "10,20": 2, "11,20": 9, "12,20": 9, "13,20": 2, "10,21": 9, "11,21": 15, "12,22": 15, "13,22": 9, "10,23": 2, "11,23": 9, "13,23": 2 } } },
 { "nome": "no canto (316, 196)", "setup": { "px": 316, "py": 196 }, "espera": { "contaPixels": { "9": 8, "15": 4 }, "pixel": { "316,196": 2, "317,196": 9, "318,198": 15, "319,199": 2, "319,198": 9 } } }]
--- dicas
Calcule DI = py × 320 + px como na Aula 23 e aponte SI para fig.
Para cada uma das 4 linhas, um laço de 4 pixels: LODSB, teste se AL é 0 (OR AL,AL / JZ) e, se não for, MOV ES:[DI],AL. Em qualquer caso, INC DI.
No fim de cada linha, ADD DI,320-4 para chegar ao começo da linha de baixo.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
fig     DB 0, 9, 9, 0
        DB 9,15,15, 9
        DB 9,15,15, 9
        DB 0, 9, 9, 0
px      DW 10
py      DW 20
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        XOR  DI, DI
        MOV  AL, 2
        MOV  CX, 64000
        CLD
        REP  STOSB
        MOV  DX, py             ; DI = py * 320 + px
        MOV  DH, DL
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, px
        LEA  SI, fig
        MOV  DX, 4              ; linhas
@@lin:  MOV  CX, 4              ; pixels por linha
@@px:   LODSB
        OR   AL, AL
        JZ   @@pula             ; 0 = transparente
        MOV  ES:[DI], AL
@@pula: INC  DI
        LOOP @@px
        ADD  DI, 320-4
        DEC  DX
        JNZ  @@lin
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a24-4
titulo: Do buffer para a tela
nivel: 2
exigir: MOVSW|MOVSB
--- enunciado
O programa já pede um buffer de 64.000 bytes ao DOS (o segmento fica na variável **buffer**) e desenha nele um quadro: fundo cor 5 com um retângulo cor 14. Mas nada aparece, porque ninguém copiou o buffer para a tela! Escreva a cópia do buffer inteiro para A000:0000 usando instruções de string. Depois da cópia, o programa devolve o buffer ao DOS.
--- inicial
.MODEL SMALL
.STACK 200h
.DATA
buffer  DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, SS             ; encolhe o programa e pede o buffer
        MOV  AX, ES
        SUB  BX, AX
        MOV  AX, SP
        MOV  CL, 4
        SHR  AX, CL
        ADD  BX, AX
        INC  BX
        MOV  AH, 4Ah
        INT  21h
        MOV  AH, 48h
        MOV  BX, 4000
        INT  21h
        MOV  buffer, AX
        MOV  AX, 0013h
        INT  10h
        MOV  ES, buffer         ; desenha o quadro no buffer
        XOR  DI, DI
        MOV  AL, 5
        MOV  CX, 64000
        CLD
        REP  STOSB
        MOV  DI, 50*320+100     ; retângulo 100x50 em (100, 50)
        MOV  AL, 14
        MOV  DX, 50
@@ret:  MOV  CX, 100
        REP  STOSB
        ADD  DI, 220
        DEC  DX
        JNZ  @@ret
        ; copie o buffer para a tela

        MOV  ES, buffer         ; devolve o buffer
        MOV  AH, 49h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "o quadro aparece", "espera": { "contaPixels": { "5": 59000, "14": 5000 }, "pixel": { "0,0": 5, "319,199": 5, "100,50": 14, "199,99": 14, "200,99": 5, "100,100": 5 } } }]
--- dicas
A origem de MOVSW é DS:SI e o destino é ES:DI. Faça DS = buffer, SI = 0, ES = A000h e DI = 0.
Leia a variável buffer antes de trocar DS (depois da troca, as variáveis ficam inacessíveis). Guarde DS com PUSH DS antes e restaure com POP DS depois.
São 64.000 bytes, ou 32.000 words: MOV CX,32000 / REP MOVSW (com CLD).
--- solucao
.MODEL SMALL
.STACK 200h
.DATA
buffer  DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, SS
        MOV  AX, ES
        SUB  BX, AX
        MOV  AX, SP
        MOV  CL, 4
        SHR  AX, CL
        ADD  BX, AX
        INC  BX
        MOV  AH, 4Ah
        INT  21h
        MOV  AH, 48h
        MOV  BX, 4000
        INT  21h
        MOV  buffer, AX
        MOV  AX, 0013h
        INT  10h
        MOV  ES, buffer
        XOR  DI, DI
        MOV  AL, 5
        MOV  CX, 64000
        CLD
        REP  STOSB
        MOV  DI, 50*320+100
        MOV  AL, 14
        MOV  DX, 50
@@ret:  MOV  CX, 100
        REP  STOSB
        ADD  DI, 220
        DEC  DX
        JNZ  @@ret
        PUSH DS                 ; cópia: DS:SI = buffer:0 -> ES:DI = A000:0
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  DS, buffer
        XOR  SI, SI
        XOR  DI, DI
        MOV  CX, 32000
        REP  MOVSW
        POP  DS
        MOV  ES, buffer
        MOV  AH, 49h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- O byte do pixel é um índice no **DAC**, a paleta de 256 cores da VGA, com R, G e B de **6 bits** (0 a 63). Mudar uma cor muda na hora todos os pixels que a usam.
- Escrever: número da cor na porta **3C8h** e R, G, B na **3C9h**; o índice avança sozinho. Ler: número na **3C7h** e três `IN` na 3C9h. Portas acima de 255 exigem DX.
- A INT 10h, AX = 1010h, 1012h, 1015h e 1017h, faz o mesmo pela BIOS, uma cor ou um bloco por vez.
- O bit 3 da porta **3DAh** indica o **retraço vertical**. Espere ele acabar e depois começar, e só então mexa na tela ou na paleta.
- Girar a paleta anima a tela inteira sem redesenhar nenhum pixel.
- **Double buffer**: desenhe num bloco de 64.000 bytes pedido ao DOS e copie com `REP MOVSW` (32.000 words) depois do retraço. No 8086 a cópia é cara; nas máquinas lentas copiavam-se só as áreas que mudaram.
- **Sprites** são retângulos de bytes; a cor 0 costuma ser transparente e é pulada na hora de desenhar.
:::
