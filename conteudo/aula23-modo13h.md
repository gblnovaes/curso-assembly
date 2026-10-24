---
id: aula23
numero: 23
modulo: 9
titulo: O modo gráfico 13h
subtitulo: 320 × 200 pixels, 256 cores, um byte por pixel em A000h
duracao: 90 min
objetivos: ligar e desligar o modo 13h pela INT 10h; entender como a tela fica guardada na memória a partir de A000:0000; calcular o offset de um pixel com y × 320 + x usando deslocamentos em vez de MUL; escrever pixels pela BIOS e direto na memória e comparar os custos; desenhar linhas horizontais com REP STOSB, linhas verticais e retângulos; conhecer a paleta padrão de 256 cores; escrever texto colorido no modo gráfico
---

## Saindo do modo texto

Até aqui o seu programa só desenhou **caracteres**: a tela de texto em B800h guarda 80 × 25 células, e quem transforma cada código ASCII em pontinhos é o próprio hardware de vídeo, com a fonte que ele tem na ROM. Você escolhe a letra e a cor, mas não controla os pontos.

Nos modos **gráficos** a coisa se inverte: a memória de vídeo guarda os **pontos** (pixels) e não existe mais o conceito de letra. Se quiser escrever "OLA", você mesmo, ou a BIOS, vai ter que pintar os pixels de cada letra.

A placa VGA tem vários modos gráficos, e um deles virou o favorito de quem programava jogos e demos em assembly: o **modo 13h**.

```diagrama titulo="O modo 13h em números"
  resolução ........ 320 × 200 pixels
  cores ............ 256 ao mesmo tempo (escolhidas entre 262.144)
  memória .......... 1 byte por pixel = 320 × 200 = 64.000 bytes
  endereço ......... A000:0000 até A000:F9FF
  organização ...... linear: linha 0, depois linha 1, depois linha 2...
```

O segredo do sucesso está na última linha. Nos modos da EGA e nos modos de 16 cores da VGA, cada pixel fica espalhado por quatro "planos" de memória, e escrever um único ponto exige programar registradores da placa. No modo 13h, **um byte é um pixel**: escrever o valor 4 no endereço certo pinta aquele ponto com a cor 4. E como 64.000 bytes cabem num segmento de 64 KB, a tela inteira é acessível com ES apontando para A000h, sem trocar de segmento nunca.

:::anos90 A VGA e o modo 13h
A VGA chegou em 1987 junto com os IBM PS/2 e logo virou o padrão dos PCs compatíveis. Para os jogos, o modo 13h foi uma revolução: 256 cores na tela num tempo em que a EGA mostrava 16, e uma memória tão simples que dava para desenhar com `MOV` e `STOSB`. Jogos de aventura, de corrida, de luta, e boa parte das demos da época rodavam em 320 × 200. Mais tarde, programadores descobriram como reconfigurar a placa para ter mais páginas e outras resoluções (o famoso "Mode X", popularizado por Michael Abrash), mas o 13h continuou sendo a porta de entrada de todo mundo.
:::

## Ligando e desligando o modo gráfico

Quem troca o modo de vídeo é a BIOS, pela **INT 10h, função 00h**, com o número do modo em AL:

| AX | Modo |
|----|------|
| `0013h` | gráfico 320 × 200, 256 cores |
| `0003h` | texto 80 × 25, 16 cores (o modo normal do DOS) |

Trocar de modo **limpa a tela**: no 13h, todos os 64.000 bytes viram 0 (preto). E um programa educado **sempre volta ao modo texto** antes de terminar; se não voltar, o DOS continua escrevendo o prompt numa tela gráfica e o usuário fica perdido.

O esqueleto de todo programa gráfico desta aula é este:

```asm executar titulo="PRIMEIRO.ASM: quatro pixels na tela"
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h          ; modo 13h: 320x200, 256 cores
        INT  10h

        MOV  AX, 0A000h         ; ES aponta para a memória de vídeo
        MOV  ES, AX

        MOV  BYTE PTR ES:[0], 15            ; (0, 0) branco
        MOV  BYTE PTR ES:[319], 12          ; (319, 0) vermelho claro
        MOV  BYTE PTR ES:[100*320+160], 14  ; (160, 100) amarelo, o centro
        MOV  BYTE PTR ES:[199*320+319], 10  ; (319, 199) verde claro

        MOV  AH, 00h            ; espera uma tecla para dar tempo de ver
        INT  16h

        MOV  AX, 0003h          ; volta ao modo texto
        INT  10h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Execute no laboratório e olhe a tela do usuário: quatro pontinhos, um em cada canto e um no meio. Repare que `MOV AX,0A000h` precisa do **zero na frente**: sem ele, o montador leria `A000h` como um nome de variável. E, como sempre, não existe `MOV ES,0A000h`; o valor passa por AX.

:::dica Use o laboratório e o depurador compacto
O laboratório e o "▶ Executar aqui" desenham a tela gráfica sozinhos quando o programa entra no modo 13h. Execute passo a passo (F7) e veja cada pixel aparecer. Na aba **Memória** do laboratório há o segmento A000 para ver os bytes da tela.
:::

## Onde fica o pixel (x, y)

A tela é guardada linha por linha, da esquerda para a direita e de cima para baixo. Cada linha ocupa exatamente 320 bytes:

```diagrama titulo="A tela do modo 13h na memória"
  offset      0      1      2   ...   319
            ┌──────┬──────┬──────┬───┬──────┐
  linha 0   │(0,0) │(1,0) │(2,0) │...│(319,0)│   offsets     0 a   319
            ├──────┼──────┼──────┼───┼──────┤
  linha 1   │(0,1) │(1,1) │      │...│      │   offsets   320 a   639
            ├──────┼──────┼──────┼───┼──────┤
  linha 2   │(0,2) │      │      │...│      │   offsets   640 a   959
            ├──────┴──────┴──────┴───┴──────┤
     ...    │              ...              │
            ├───────────────────────────────┤
  linha 199 │                               │   offsets 63680 a 63999
            └───────────────────────────────┘

           offset(x, y) = y × 320 + x
```

O x vai de 0 a 319 e o y de 0 a 199, com o (0, 0) no canto **superior** esquerdo: o y cresce para baixo, ao contrário do plano cartesiano da escola.

### Multiplicar por 320 sem MUL

A conta `y × 320` aparece em todo pixel desenhado, então ela precisa ser rápida. `MUL` no 8086 custa mais de 118 ciclos com um registrador de 16 bits. O truque, que você já viu de passagem na Aula 16, é decompor o 320:

```diagrama titulo="320 = 256 + 64"
  y × 320 = y × 256  +  y × 64
            ───┬───     ───┬───
               │           └─ (y × 256) ÷ 4: dois SHR de 1 bit
               └─ y < 256 cabe num byte: basta copiar o byte baixo
                  para o alto e zerar o baixo (MOV DH,DL / XOR DL,DL)
```

Com y em DX (e, portanto, em DL, já que y < 200) e x em CX:

```asm fragmento
        MOV  DH, DL         ; DX = y × 256
        XOR  DL, DL
        MOV  DI, DX         ; DI = y × 256
        SHR  DX, 1          ; DX = y × 128
        SHR  DX, 1          ; DX = y × 64
        ADD  DI, DX         ; DI = y × 320
        ADD  DI, CX         ; DI = y × 320 + x
```

Compare os dois jeitos lado a lado:

```widget comparar
{ "titulo": "DI = y × 320 + x  (y em DX, x em CX)", "a": "MOV AX, 320\nMUL DX        ; DX:AX = 320 * y\nADD AX, CX\nMOV DI, AX", "b": "MOV DH, DL    ; y * 256\nXOR DL, DL\nMOV DI, DX\nSHR DX, 1\nSHR DX, 1     ; y * 64\nADD DI, DX    ; y * 320\nADD DI, CX", "setup": { "CX": 160, "DX": 100 }, "altura": 9 }
```

Os dois calculam 32160 (o centro da tela), mas a versão com deslocamentos gasta cerca de um oitavo dos ciclos. Repare também que `MUL DX` estraga DX (recebe a parte alta do produto), mais um motivo para evitá-lo.

:::cpu Tabelas: ainda mais rápido
Muitos jogos nem faziam a conta. Guardavam uma tabela com os 200 offsets de início de linha, calculada uma vez no começo do programa:

```asm fragmento
linhas  DW 200 DUP(?)       ; linhas[y] = y * 320
        ...
        MOV  BX, DX         ; BX = y
        SHL  BX, 1          ; cada entrada tem 2 bytes
        MOV  DI, linhas[BX] ; DI = y * 320
        ADD  DI, CX
```

Troca-se memória (400 bytes) por velocidade. É o mesmo raciocínio do `XLAT` da Aula 17.
:::

## Uma rotina PSET

Juntando tudo, eis a rotina clássica que "acende" um pixel. O nome vem do comando `PSET` do BASIC, que fazia a mesma coisa (bem mais devagar):

```asm fragmento
; PSET: pinta o pixel (CX, DX) com a cor AL. Espera ES = A000h.
PSET    PROC
        PUSH DI
        PUSH DX
        MOV  DH, DL         ; DX = y * 256 (y < 200 cabe em DL)
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1          ; DX = y * 64
        ADD  DI, DX         ; DI = y * 320
        ADD  DI, CX         ; DI = y * 320 + x
        MOV  ES:[DI], AL
        POP  DX
        POP  DI
        RET
PSET    ENDP
```

Com ela dá para desenhar qualquer coisa, ponto por ponto. Este programa traça as duas diagonais de um quadrado de 200 × 200 no meio da tela:

```asm executar titulo="DIAGONAL.ASM: um X desenhado com PSET"
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX

        XOR  DX, DX             ; y = 0
@@ponto:
        MOV  CX, DX
        ADD  CX, 60             ; x = y + 60: diagonal que desce
        MOV  AL, 11             ; ciano claro
        CALL PSET
        MOV  CX, 259
        SUB  CX, DX             ; x = 259 - y: diagonal que sobe
        MOV  AL, 13             ; magenta claro
        CALL PSET
        INC  DX
        CMP  DX, 200
        JB   @@ponto

        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

PSET    PROC
        PUSH DI
        PUSH DX
        MOV  DH, DL
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, CX
        MOV  ES:[DI], AL
        POP  DX
        POP  DI
        RET
PSET    ENDP
END inicio
```

## Pixels pela BIOS

A BIOS também sabe desenhar pixels, pela **INT 10h**:

| Função | Entrada | Saída |
|--------|---------|-------|
| `AH = 0Ch` escrever pixel | AL = cor, BH = página (0), CX = x, DX = y | — |
| `AH = 0Dh` ler pixel | BH = página (0), CX = x, DX = y | AL = cor |

```asm fragmento
        MOV  AH, 0Ch        ; escrever pixel
        MOV  AL, 14         ; cor amarela
        MOV  BH, 0          ; página 0
        MOV  CX, 160        ; x
        MOV  DX, 100        ; y
        INT  10h
```

Funciona em qualquer modo gráfico, e esse é o seu ponto forte: o mesmo código serve para CGA, EGA e VGA, porque quem sabe onde fica cada pixel é a BIOS. O ponto fraco é a velocidade. Cada chamada passa por `INT` e `IRET`, salva e restaura registradores, consulta o modo atual, calcula o endereço e só então escreve o byte. Num PC real, desenhar pela BIOS era dezenas de vezes mais lento que escrever direto na memória, e uma tela cheia (64.000 pixels) levava segundos.

:::atencao Os ciclos da BIOS no simulador
No simulador, os serviços da BIOS são feitos em JavaScript e o contador de ciclos só soma o custo da própria instrução `INT` (51 ciclos). Por isso a diferença parece menor aqui do que era de verdade: a rotina da BIOS real executava dezenas de instruções a cada pixel.
:::

Regra prática da época: BIOS para trocar de modo e para um ou outro ponto; **memória direta** para tudo que precisa ser rápido.

## Linhas horizontais: REP STOSB

Os pixels de uma linha horizontal são **bytes consecutivos** na memória. Isso é exatamente o que `REP STOSB` sabe preencher: AL vai para ES:[DI], DI avança, CX vezes.

```asm fragmento
; HLINHA: linha horizontal a partir de ES:DI, CX pixels, cor AL
        CLD                 ; DI avança
        REP  STOSB
```

Para linhas compridas há o truque da Aula 17: `REP STOSW` grava dois pixels por vez (AL e AH com a mesma cor). Com 320 pixels por linha, isso corta o laço pela metade. Só é preciso cuidar do pixel que sobra quando a quantidade é ímpar.

## Linhas verticais: ADD DI, 320

Numa linha vertical, cada pixel fica **320 bytes** depois do anterior: é o mesmo x na linha de baixo.

```asm fragmento
; VLINHA: linha vertical a partir de ES:DI, CX pixels, cor AL
@@desce:
        MOV  ES:[DI], AL
        ADD  DI, 320        ; mesma coluna, próxima linha
        LOOP @@desce
```

## Retângulos

Um retângulo cheio é uma pilha de linhas horizontais. Depois de cada linha, DI está logo após o último pixel desenhado; para chegar ao começo da linha de baixo, basta somar `320 − largura`:

```diagrama titulo="Retângulo cheio de largura L"
            x                 x+L
  linha y   ██████████████████ ← REP STOSB, L pixels
            ▲                 └─ DI parou aqui: falta (320 − L) até
            │                    o começo da próxima linha
  linha y+1 ██████████████████
  linha y+2 ██████████████████
```

```asm executar titulo="RETANG.ASM: retângulos cheios"
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX

        MOV  BX, 20             ; x
        MOV  DX, 20             ; y
        MOV  CX, 120            ; largura
        MOV  SI, 70             ; altura
        MOV  AL, 1              ; azul
        CALL RETCHEIO

        MOV  BX, 100
        MOV  DX, 60
        MOV  CX, 150
        MOV  SI, 100
        MOV  AL, 4              ; vermelho
        CALL RETCHEIO

        MOV  BX, 60
        MOV  DX, 130
        MOV  CX, 80
        MOV  SI, 50
        MOV  AL, 14             ; amarelo
        CALL RETCHEIO

        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; RETCHEIO: retângulo cheio. BX = x, DX = y, CX = largura,
; SI = altura, AL = cor. Espera ES = A000h. Preserva tudo menos as flags.
RETCHEIO PROC
        PUSH CX
        PUSH DX
        PUSH DI
        PUSH SI
        MOV  DH, DL             ; DI = y * 320 + x
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, BX
        MOV  DX, 320
        SUB  DX, CX             ; DX = salto do fim de uma linha ao começo da outra
        CLD
@@linha:
        PUSH CX
        REP  STOSB              ; uma linha horizontal
        POP  CX
        ADD  DI, DX             ; desce para a próxima
        DEC  SI
        JNZ  @@linha
        POP  SI
        POP  DI
        POP  DX
        POP  CX
        RET
RETCHEIO ENDP
END inicio
```

Repare que o segundo retângulo é desenhado **por cima** do primeiro. No modo 13h não existem camadas: o que foi escrito por último é o que aparece. Desenhar em ordem, do fundo para a frente, é o jeito mais simples de fazer cenas com sobreposição (os pintores fazem o mesmo, e por isso o método se chama **algoritmo do pintor**).

Um retângulo vazado, só a moldura, é feito de duas linhas horizontais e duas verticais. Esse vai ser um dos exercícios.

## A paleta padrão

O byte de cada pixel não é uma cor: é um **índice** numa tabela de 256 cores, a **paleta**. Quando a placa desenha a tela, ela pega o byte, procura a cor naquela posição da tabela e manda para o monitor. Na próxima aula você vai trocar as cores da tabela; por enquanto, vale conhecer a paleta que a BIOS carrega ao ligar o modo 13h:

```diagrama titulo="Paleta padrão da VGA no modo 13h"
    0 a  15   as 16 cores do modo texto (mesmos números e cores!)
   16 a  31   16 tons de cinza, do preto ao branco
   32 a 103   72 cores fortes: 24 matizes do arco-íris em 3 saturações
  104 a 175   as mesmas 72, mais escuras
  176 a 247   as mesmas 72, bem escuras
  248 a 255   preto
```

As 16 primeiras são as mesmas do modo texto: 1 é azul, 4 é vermelho, 14 é amarelo, 15 é branco. Por isso os exemplos desta aula usam essas cores. Este programa mostra a paleta inteira num quadriculado de 16 × 16:

```asm executar titulo="PALETA.ASM: as 256 cores padrão"
.MODEL SMALL
.STACK 100h
.DATA
cor     DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX

        XOR  DX, DX             ; y da linha de quadradinhos
@@lin:  XOR  BX, BX             ; x
@@col:  MOV  AL, cor
        MOV  CX, 19             ; 19 x 11, deixando 1 pixel de separação
        MOV  SI, 11
        CALL RETCHEIO
        INC  cor
        ADD  BX, 20
        CMP  BX, 320
        JB   @@col
        ADD  DX, 12
        CMP  DX, 192
        JB   @@lin

        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

RETCHEIO PROC
        PUSH CX
        PUSH DX
        PUSH DI
        PUSH SI
        MOV  DH, DL
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, BX
        MOV  DX, 320
        SUB  DX, CX
        CLD
@@linha:
        PUSH CX
        REP  STOSB
        POP  CX
        ADD  DI, DX
        DEC  SI
        JNZ  @@linha
        POP  SI
        POP  DI
        POP  DX
        POP  CX
        RET
RETCHEIO ENDP
END inicio
```

## Texto no modo gráfico

O modo 13h não tem caracteres, mas a BIOS desenha letras para você com a fonte de 8 × 8 pixels que ela tem na ROM. A tela vira uma grade de **40 colunas por 25 linhas** de caracteres. Duas funções da INT 10h fazem o serviço:

- `AH = 02h` posiciona o cursor (BH = 0, DH = linha 0..24, DL = coluna 0..39).
- `AH = 0Eh` escreve o caractere de AL na posição do cursor e avança. **Em modo gráfico, BL é a cor das letras.**

A `INT 21h` (funções 02h e 09h) também funciona, porque o DOS acaba chamando a BIOS, mas aí você não escolhe a cor (no simulador, sai cinza claro).

```asm executar titulo="TEXTO13.ASM: letras coloridas no modo 13h"
.MODEL SMALL
.STACK 100h
.DATA
titulo  DB 'MODO 13h: 320x200, 256 CORES', 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h

        MOV  AH, 02h            ; cursor na linha 12, coluna 6
        MOV  BH, 0
        MOV  DH, 12
        MOV  DL, 6
        INT  10h

        LEA  SI, titulo
        MOV  BL, 32             ; primeira cor: azul forte da paleta
@@letra:
        LODSB
        OR   AL, AL             ; fim da string (0)?
        JZ   @@fim
        MOV  AH, 0Eh            ; teletipo: escreve AL com a cor BL
        INT  10h
        INC  BL                 ; cada letra numa cor do arco-íris
        JMP  @@letra
@@fim:
        MOV  AH, 00h
        INT  16h
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::dica Fontes próprias
A fonte 8 × 8 da BIOS fica na ROM; a INT 10h, AX=1130h, BH=03h devolve o endereço dela em ES:BP. Jogos e demos costumavam ignorá-la e trazer fontes próprias, desenhadas como pequenos bitmaps e copiadas para a tela com o mesmo código que desenha qualquer imagem (assunto da próxima aula).
:::

```quiz
? Em que offset do segmento A000h fica o pixel (10, 2)?
- 2 × 200 + 10 = 410
+ 2 × 320 + 10 = 650
- 10 × 320 + 2 = 3202
- 10 × 200 + 2 = 2002
> Cada linha tem 320 bytes e as linhas vêm uma depois da outra: offset = y × 320 + x.

? Por que y × 320 pode ser calculado como y × 256 + y × 64?
+ Porque 256 + 64 = 320, e multiplicar por potências de 2 é só deslocar bits
- Porque o 8086 não tem instrução de multiplicação
- Porque a tela tem 256 cores
> O 8086 tem MUL, mas ele custa mais de 100 ciclos. Multiplicar por 256 é mover o byte baixo para o alto, e por 64 são deslocamentos: tudo junto custa poucos ciclos.

? Depois de REP STOSB desenhar uma linha de 50 pixels, quanto somar a DI para chegar ao começo da linha de baixo, na mesma coluna inicial?
- 320
+ 270
- 50
- 370
> O REP STOSB já avançou DI em 50. Faltam 320 − 50 = 270 bytes para o mesmo x na linha seguinte.

? O que o byte guardado em A000:0000 representa?
- A cor RGB do pixel (0, 0)
+ O índice, na paleta, da cor do pixel (0, 0)
- O código ASCII do primeiro caractere da tela
> No modo 13h cada byte é um índice de 0 a 255 numa tabela de cores, a paleta. A cor de verdade está na tabela.

? Qual é a principal vantagem de usar a INT 10h, AH=0Ch, em vez de escrever na memória?
- É mais rápida
+ O mesmo código funciona em qualquer modo gráfico, porque a BIOS sabe onde fica cada pixel
- Ela não precisa de ES
> A BIOS esconde os detalhes de cada placa e modo. O preço é a velocidade: cada pixel vira uma chamada de interrupção inteira.
```

## Exercícios

Nos exercícios, o programa pode terminar ainda no modo gráfico (o corretor confere a memória de vídeo). No laboratório, a tela continua mostrando o desenho depois do fim.

```exercicio
id: a23-1
titulo: O pixel no lugar certo
nivel: 1
proibir: MUL, IMUL
--- enunciado
O programa liga o modo 13h e recebe **x em CX** e **y em DX**. Calcule em **DI** o offset do pixel (x, y), **sem usar MUL**, e pinte esse pixel com a cor **14** (amarelo).
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        ; CX = x, DX = y
        MOV  DI, 0              ; calcule DI = y * 320 + x

        MOV  BYTE PTR ES:[DI], 14
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "(0, 0)", "setup": { "CX": 0, "DX": 0 }, "espera": { "pixel": { "0,0": 14 }, "contaPixels": { "14": 1 } } },
 { "nome": "(160, 100), o centro", "setup": { "CX": 160, "DX": 100 }, "espera": { "pixel": { "160,100": 14 }, "contaPixels": { "14": 1 } } },
 { "nome": "(7, 1)", "setup": { "CX": 7, "DX": 1 }, "espera": { "pixel": { "7,1": 14 }, "contaPixels": { "14": 1 } } },
 { "nome": "(319, 199), o último pixel", "setup": { "CX": 319, "DX": 199 }, "espera": { "pixel": { "319,199": 14 }, "contaPixels": { "14": 1 } } }]
--- dicas
offset = y × 320 + x, e y × 320 = y × 256 + y × 64.
y é menor que 256, então está todo em DL: MOV DH,DL / XOR DL,DL deixa DX = y × 256.
Guarde y × 256 em DI, divida DX por 4 com dois SHR DX,1 (vira y × 64) e some a DI. Depois some CX.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  DH, DL             ; DX = y * 256
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1              ; DX = y * 64
        ADD  DI, DX             ; DI = y * 320
        ADD  DI, CX             ; DI = y * 320 + x
        MOV  BYTE PTR ES:[DI], 14
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a23-2
titulo: Linha horizontal
nivel: 2
exigir: STOSB|STOSW
--- enunciado
Desenhe uma linha horizontal com a cor **12** (vermelho claro) começando no pixel (**CX**, **DX**) e com **BX** pixels de comprimento, indo para a direita. Use `REP STOSB` (ou `STOSW`). Os valores já chegam nos registradores e a linha sempre cabe na tela.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        ; CX = x, DX = y, BX = comprimento

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "100 pixels a partir de (10, 5)", "setup": { "CX": 10, "DX": 5, "BX": 100 }, "espera": { "contaPixels": { "12": 100 }, "pixel": { "10,5": 12, "109,5": 12, "110,5": 0, "9,5": 0 } } },
 { "nome": "a última linha inteira", "setup": { "CX": 0, "DX": 199, "BX": 320 }, "espera": { "contaPixels": { "12": 320 }, "pixel": { "0,199": 12, "319,199": 12, "319,198": 0 } } },
 { "nome": "um pixel só em (300, 0)", "setup": { "CX": 300, "DX": 0, "BX": 1 }, "espera": { "contaPixels": { "12": 1 }, "pixel": { "300,0": 12 } } }]
--- dicas
Primeiro calcule DI = y × 320 + x, como no exercício anterior (enquanto CX ainda é x).
Depois CX vira o contador: MOV CX,BX. A cor vai em AL.
CLD e REP STOSB. Cuidado para não usar AL antes de terminar a conta do offset.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  DH, DL
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, CX             ; DI = y * 320 + x
        MOV  CX, BX             ; CX = comprimento
        MOV  AL, 12
        CLD
        REP  STOSB
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a23-3
titulo: Moldura
nivel: 2
--- enunciado
Desenhe a **moldura** (só a borda, sem preencher) de um retângulo com a cor **15**. O canto superior esquerdo é (**x0**, **y0**), a largura é **larg** e a altura é **alt**, todos em variáveis. O cálculo do offset do canto já está feito em DI. Os testes trocam os valores das variáveis, então não use números fixos.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
x0      DW 50
y0      DW 40
larg    DW 100
alt     DW 60
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  DX, y0             ; DI = y0 * 320 + x0
        MOV  DH, DL
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, x0
        MOV  AL, 15
        ; desenhe a moldura a partir de ES:DI

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "100 x 60 em (50, 40)", "espera": { "contaPixels": { "15": 316 }, "pixel": { "50,40": 15, "149,40": 15, "50,99": 15, "149,99": 15, "100,40": 15, "100,99": 15, "50,70": 15, "149,70": 15, "100,70": 0, "150,40": 0, "50,100": 0 } } },
 { "nome": "a tela inteira", "setup": { "x0": 0, "y0": 0, "larg": 320, "alt": 200 }, "espera": { "contaPixels": { "15": 1036 }, "pixel": { "0,0": 15, "319,0": 15, "0,199": 15, "319,199": 15, "160,100": 0, "1,1": 0 } } },
 { "nome": "2 x 2 em (10, 10)", "setup": { "x0": 10, "y0": 10, "larg": 2, "alt": 2 }, "espera": { "contaPixels": { "15": 4 }, "pixel": { "10,10": 15, "11,11": 15 } } }]
--- dicas
Uma moldura são quatro linhas: em cima e embaixo (horizontais, larg pixels) e dos lados (verticais, alt pixels).
A linha de cima é um REP STOSB com CX = larg. Guarde DI antes (PUSH DI) para voltar ao canto.
Para as laterais, faça um laço de alt voltas que pinta ES:[DI] e ES:[DI+BX], com BX = larg − 1, e soma 320 a DI.
Depois do laço, DI está uma linha abaixo da moldura: SUB DI,320 e desenhe a linha de baixo com REP STOSB.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
x0      DW 50
y0      DW 40
larg    DW 100
alt     DW 60
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        MOV  DX, y0
        MOV  DH, DL
        XOR  DL, DL
        MOV  DI, DX
        SHR  DX, 1
        SHR  DX, 1
        ADD  DI, DX
        ADD  DI, x0
        MOV  AL, 15
        CLD
        PUSH DI                 ; linha de cima
        MOV  CX, larg
        REP  STOSB
        POP  DI
        MOV  CX, alt            ; laterais
        MOV  BX, larg
        DEC  BX                 ; distância até a coluna da direita
@@lado: MOV  ES:[DI], AL
        MOV  ES:[DI+BX], AL
        ADD  DI, 320
        LOOP @@lado
        SUB  DI, 320            ; volta para a última linha
        MOV  CX, larg           ; linha de baixo
        REP  STOSB
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a23-4
titulo: Dezesseis faixas
nivel: 2
--- enunciado
Pinte a tela inteira com **16 faixas verticais** de 20 pixels de largura cada: a faixa da esquerda (x de 0 a 19) com a cor 0, a seguinte (x de 20 a 39) com a cor 1, e assim por diante até a cor 15 (x de 300 a 319). Todas as 200 linhas.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        XOR  DI, DI
        ; pinte as faixas

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "16 faixas de 20 pixels", "espera": { "contaPixels": { "0": 4000, "1": 4000, "7": 4000, "8": 4000, "15": 4000 }, "pixel": { "0,0": 0, "19,199": 0, "20,0": 1, "39,199": 1, "159,50": 7, "160,50": 8, "300,0": 15, "319,199": 15 } } }]
--- dicas
Como a memória é percorrida linha por linha, pense em uma linha de cada vez: 16 pedaços de 20 bytes, com cores 0, 1, 2... 15.
Um laço interno de 16 voltas faz MOV CX,20 / REP STOSB / INC AL. Ele começa com AL = 0.
Um laço externo repete isso 200 vezes. DI não precisa de ajuste: no fim de uma linha ele já está no começo da próxima.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AX, 0013h
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX
        XOR  DI, DI
        CLD
        MOV  DX, 200            ; linhas
@@lin:  XOR  AL, AL             ; cada linha começa na cor 0
        MOV  BX, 16             ; faixas por linha
@@fx:   MOV  CX, 20
        REP  STOSB
        INC  AL
        DEC  BX
        JNZ  @@fx
        DEC  DX
        JNZ  @@lin
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- O modo 13h tem 320 × 200 pixels e 256 cores. Liga com `MOV AX,0013h` / `INT 10h`; volta ao texto com `MOV AX,0003h` / `INT 10h`.
- A tela fica em A000:0000, **um byte por pixel**, linha após linha: offset = y × 320 + x. Os 64.000 bytes cabem num segmento só.
- y × 320 = y × 256 + y × 64: `MOV DH,DL` / `XOR DL,DL` e dois `SHR` fazem a conta em poucos ciclos, contra mais de 100 do `MUL`. Tabelas de offsets são ainda mais rápidas.
- A BIOS desenha pixels (`AH=0Ch`) e lê (`AH=0Dh`) em qualquer modo, mas é muito mais lenta que escrever na memória.
- Linha horizontal: `REP STOSB`. Linha vertical: `ADD DI,320` a cada pixel. Retângulo cheio: linhas horizontais pulando `320 − largura` entre uma e outra.
- O byte do pixel é um **índice na paleta**. Na paleta padrão, as cores 0 a 15 são as do modo texto e 16 a 31 são tons de cinza.
- Texto no modo 13h: 40 × 25 caracteres de 8 × 8. `INT 10h, AH=0Eh` escreve AL com a cor BL.
:::
