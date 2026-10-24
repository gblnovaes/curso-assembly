---
id: aula32
numero: 32
modulo: 13
titulo: Fundamentos de jogos em DOS
subtitulo: O laço do jogo, tempo, teclado, sorteio, vídeo direto e som sem travar
duracao: 120 min
objetivos: montar o laço de um jogo (entrada, atualização, desenho, espera); medir o tempo pelos tiques da BIOS e pelo retraço vertical; ler o teclado sem bloquear pela INT 16h; instalar uma INT 9 própria com uma tabela de teclas apertadas; sortear números com um gerador congruente linear; desenhar direto na memória de vídeo em B800h e A000h, apagando e redesenhando; tocar efeitos sonoros pelo PIT sem parar o jogo; sair limpo, devolvendo vídeo, vetores e alto-falante
---

## Um programa que não espera por você

Todos os programas que você escreveu até aqui seguem um roteiro: pedem alguma coisa, **esperam** a resposta, calculam, mostram e terminam. Um jogo é o contrário. A bola continua andando se você não apertar nada; os invasores continuam descendo enquanto você pensa; a cobra não para para esperar a sua decisão. O jogo é um programa que **nunca espera** pelo jogador, mas está sempre pronto para ouvi-lo.

Neste módulo você vai ler e entender sete jogos completos, escritos em Assembly como se escrevia em 1990:

| Aula | Jogo | Modo de vídeo | O que ensina de novo |
|------|------|---------------|----------------------|
| [33](aula:aula33) | COBRA | texto 80x25 | fila circular, a tela como mapa de colisão |
| [34](aula:aula34) | PONG | 13h | INT 9 própria, ponto fixo, física simples, retraço |
| [35](aula:aula35) | INVASOR | 13h | sprites de 1 bit, formação, tiros e bombas |
| [36](aula:aula36) | BLOCOS | texto | peças que giram, tabuleiro em memória, linhas cheias |
| [37](aula:aula37) | PAREDÃO | 13h | tijolos, rebote com ângulo, fases |
| [38](aula:aula38) | SAPO | texto | faixas que rolam, objetos que carregam o jogador |
| [39](aula:aula39) | LABIRINTO | texto | mapa em tabela, fantasmas com "inteligência" |

Antes de qualquer um deles, esta aula junta as peças que **todos** usam: o laço do jogo, o relógio, o teclado, o sorteio, a memória de vídeo, o som e a saída limpa. Cada técnica aparece com um trecho tirado dos jogos, para você reconhecê-la depois. No fim, um jogo mínimo, o **QUADRADO.ASM**, junta tudo em menos de 300 linhas.

:::anos90 Por que Assembly?
No começo dos anos 90 a maioria dos jogos de PC ainda tinha as partes críticas, e às vezes o jogo inteiro, em Assembly. Um 286 de 12 MHz executava uns 2 milhões de instruções por segundo; a 70 quadros por segundo, sobram menos de 30.000 instruções por quadro para ler o teclado, mover tudo, testar colisões, desenhar e tocar o som. Compiladores C da época geravam código bem maior e mais lento, e cada ciclo contava. As revistas traziam listagens para digitar, e os programadores trocavam rotinas em BBSs: "um PSET rápido", "um gerador de números aleatórios que não repete", "uma INT 9 para jogos".
:::

Os sete jogos são programas **.COM** que usam do DOS apenas a `INT 21h` com AH = 02h, 09h, 25h, 35h e 4Ch. Tudo o mais é BIOS ou hardware direto. Isso não é acaso: é o que permite que eles rodem também no pequeno sistema operacional que você vai construir nas aulas 40 a 44, o MINIOS, que só implementa essas funções.

## O laço do jogo

Todo jogo, do Pong de 1972 aos jogos de hoje, tem no coração o mesmo laço de quatro passos:

```diagrama titulo="O laço do jogo"
            ┌──────────────────────────────────────────┐
            ▼                                          │
   ┌─────────────────┐                                 │
   │ 1. ENTRADA      │  o jogador apertou alguma coisa? │
   │    (sem esperar)│  anota, mas não para            │
   └────────┬────────┘                                 │
            ▼                                          │
   ┌─────────────────┐                                 │
   │ 2. ATUALIZAÇÃO  │  move tudo um passo, testa      │
   │                 │  colisões, conta pontos         │
   └────────┬────────┘                                 │
            ▼                                          │
   ┌─────────────────┐                                 │
   │ 3. DESENHO      │  apaga o que saiu do lugar,     │
   │                 │  desenha na posição nova        │
   └────────┬────────┘                                 │
            ▼                                          │
   ┌─────────────────┐                                 │
   │ 4. ESPERA       │  segura até a hora do próximo   │
   │                 │  passo (tique ou retraço)       │
   └────────┬────────┘                                 │
            └──────────────────────────────────────────┘
                     sai do laço: ESC, fim de jogo
```

Cada volta do laço é um **quadro** (*frame*) ou um **passo**. O passo 4 é o que dá ritmo ao jogo: sem ele, o laço rodaria tão depressa quanto a CPU permitisse, e o jogo ficaria rápido num 386 e lento num XT.

O laço principal da COBRA é quase o diagrama escrito em Assembly:

```asm fragmento titulo="COBRA.ASM: o laço principal"
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
```

E o do PONG, que roda a 70 quadros por segundo, tem a ordem um pouco diferente: espera primeiro, para que o desenho aconteça logo depois do retraço vertical (você vai ver por quê):

```asm fragmento titulo="PONG.ASM: o laço principal"
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
```

Repare que nenhuma rotina dentro do laço **espera** por nada além do passo 4. Ler o teclado não espera tecla; tocar um som não espera o som acabar. Essa é a regra de ouro: **só um lugar do laço pode esperar**.

Aqui está o laço mais simples possível, em modo texto. Um ☻ anda pela linha 12 a um passo por tique do relógio; qualquer tecla inverte o sentido; ESC termina (e ele também termina sozinho depois de bater duas vezes nas bordas):

```asm executar titulo="LACO.ASM: entrada, atualização, desenho, espera"
; LACO.ASM - o esqueleto de todo jogo: entrada, atualização, desenho, espera
.MODEL TINY
.CODE
        ORG 100h
inicio:
        MOV  AX, 0003h          ; modo texto 80x25 (e tela limpa)
        INT  10h
        MOV  AX, 0B800h
        MOV  ES, AX             ; ES = memória de vídeo do modo texto
        MOV  AH, 00h            ; marca o tique inicial
        INT  1Ah
        MOV  ultimo, DX

@@laco: ; ---- 1. entrada: há tecla? (não espera) ----
        MOV  AH, 01h
        INT  16h
        JZ   @@atualiza         ; ZF = 1: buffer vazio, segue o jogo
        MOV  AH, 00h            ; tira a tecla do buffer
        INT  16h
        CMP  AL, 27             ; ESC termina
        JE   @@fim
        NEG  passo              ; qualquer outra tecla inverte o sentido

@@atualiza: ; ---- 2. atualização ----
        MOV  BX, coluna
        SHL  BX, 1
        MOV  WORD PTR ES:[12*160+BX], 0720h  ; apaga na posição antiga
        MOV  AX, coluna
        ADD  AX, passo
        CMP  AX, 0              ; bateu na borda? volta
        JL   @@vira
        CMP  AX, 79
        JG   @@vira
        MOV  coluna, AX
        JMP  SHORT @@desenha
@@vira: NEG  passo
        INC  voltas
        CMP  voltas, 2          ; depois de bater duas vezes, acaba sozinho
        JE   @@fim

@@desenha: ; ---- 3. desenho ----
        MOV  BX, coluna
        SHL  BX, 1
        MOV  WORD PTR ES:[12*160+BX], 0E02h  ; ☻ amarelo

@@espera: ; ---- 4. espera o próximo tique (1/18,2 s) ----
        MOV  AH, 00h
        INT  1Ah
        CMP  DX, ultimo
        JE   @@espera
        MOV  ultimo, DX
        JMP  @@laco

@@fim:  MOV  AX, 4C00h
        INT  21h

coluna  DW 40
passo   DW 1
voltas  DB 0
ultimo  DW 0
END inicio
```

:::dica .MODEL TINY e ORG 100h
Os jogos deste módulo são programas .COM: código, dados e pilha num segmento só, com CS = DS = ES = SS ao começar, e o código a partir do deslocamento 100h (antes dele fica o PSP, como você viu na [Aula 26](aula:aula26)). Por isso não há `MOV AX,@DATA`: o DS já aponta para as variáveis. Os dados ficam **depois** do código, onde a execução nunca chega. No TASM da época, `TASM COBRA` seguido de `TLINK /t COBRA` gerava o COBRA.COM.
:::

## Medindo o tempo

Um jogo precisa de duas coisas do relógio: **ritmo** (quantos passos por segundo) e, às vezes, **duração** (quanto tempo um som toca, quanto dura a pausa do saque). Em 1990 havia dois relógios confiáveis em qualquer PC.

### Os tiques da BIOS: 18,2 por segundo

Você conheceu o primeiro na [Aula 29](aula:aula29): o canal 0 do PIT gera a IRQ 0 cerca de 18,2 vezes por segundo, e a `INT 8` da BIOS soma 1 na palavra dupla em **0040:006Ch**. Há dois jeitos de ler esse contador:

```asm fragmento titulo="Dois jeitos de ler os tiques"
; direto na área de dados da BIOS (livro, capítulo 17)
        MOV  AX, 40h
        MOV  ES, AX
        MOV  AX, ES:[6Ch]       ; parte baixa do contador

; pela INT 1Ah, AH = 00h (livro, capítulo 7)
        MOV  AH, 00h
        INT  1Ah                ; CX:DX = tiques desde a meia-noite
```

Os jogos do curso usam a `INT 1Ah`. Ela custa umas dezenas de ciclos a mais, mas não obriga a mexer em ES, que nos jogos fica apontando para a memória de vídeo **o tempo todo**. A rotina é sempre a mesma:

```asm fragmento titulo="COBRA.ASM: LE_RELOGIO e ESPERA_PASSO"
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
```

Dois detalhes que valem ouro:

- **"Quanto passou" em vez de "até quando".** `SUB AX, ultimo_tique` dá o número de tiques desde o último passo, e a conta continua certa quando a parte baixa do contador passa de FFFFh para 0000h (a subtração de 16 bits é circular). Comparar com um "tique final" calculado antes quebraria nessa hora.
- **Anotar o tique em que o passo começou** (`MOV ultimo_tique, DX`), não somar `passo` ao anterior. Se o jogo atrasar um pouco, ele não tenta "recuperar" passos acumulados.

Com `passo = 4`, a cobra anda 18,2 ÷ 4 ≈ 4,5 casas por segundo; com `passo = 1`, 18,2. A resolução de 55 ms é grossa para ação rápida, mas perfeita para jogos de passo, como a cobra, os blocos e o sapo.

:::cpu Meia-noite
A BIOS zera o contador quando ele chega a 1.573.040 (1800B0h) tiques e liga uma flag em 0040:0070h. A parte baixa, que é o que os jogos usam, não passa de FFFFh para 0 nessa hora: ela pula de 00AFh para 0000h. A subtração dá um número enorme, a espera termina na hora, e no máximo um passo sai mais curto. Para um jogo, é perfeitamente aceitável. O [capítulo 7 do livro](livro:cap07) conta o resto da história.
:::

### O retraço vertical: 70 por segundo

O segundo relógio é a própria placa de vídeo. Na [Aula 24](aula:aula24) você viu que o bit 3 da porta **3DAh** fica em 1 enquanto o feixe do monitor volta do canto de baixo para o de cima, cerca de **70 vezes por segundo** no modo 13h. Esperar o começo de cada retraço dá um relógio mais fino que os tiques, e de quebra elimina a cintilação: tudo o que você desenhar logo depois do retraço aparece inteiro no próximo quadro.

```asm fragmento titulo="PONG.ASM: ESPERA_RETRACO"
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
```

| Relógio | Frequência | Onde se lê | Bom para |
|---------|-----------|------------|----------|
| tiques da BIOS | 18,2 Hz | INT 1Ah ou 0040:006Ch | jogos de passo, durações de som, pausas |
| retraço vertical | 70 Hz (60 Hz em alguns modos) | porta 3DAh, bit 3 | animação suave, ação |
| canal 0 acelerado | o que você programar | sua própria INT 8 | música, tempo fino (Aula 29) |

:::atencao O laço vazio de atraso
O pior relógio é um laço de atraso: `MOV CX,5000` / `@@a: LOOP @@a`. Ele dura um tempo num XT e um vigésimo disso num 486. Muitos jogos dos anos 80 ficaram injogáveis nos PCs mais novos por isso, e alguns PCs tinham um botão **Turbo** no gabinete justamente para desacelerar a máquina e salvar esses jogos. O retraço e os tiques têm a mesma duração em qualquer PC.
:::

## O teclado sem esperar

### INT 16h, AH = 01h: há tecla?

A `INT 16h` com AH = 00h, que você usa desde a [Aula 14](aula:aula14), **espera** uma tecla, o que é proibido dentro do laço. A função irmã, AH = 01h, só **espia** o buffer da BIOS:

| Chamada | Se há tecla | Se o buffer está vazio |
|---------|-------------|------------------------|
| `INT 16h`, AH = 00h | AH = scan code, AL = ASCII, tira do buffer | **espera** |
| `INT 16h`, AH = 01h | ZF = 0, AX = a tecla, **deixa** no buffer | ZF = 1, volta na hora |

A combinação das duas lê sem bloquear. A COBRA vai além e **esvazia** o buffer a cada passo, para o jogador poder apertar duas setas seguidas entre um passo e outro:

```asm fragmento titulo="COBRA.ASM: LER_TECLADO (começo)"
LER_TECLADO PROC
@@proxima:
        MOV  AH, 01h            ; há tecla? (ZF = 1: não há)
        INT  16h
        JNZ  @@tem
        RET
@@tem:  MOV  AH, 00h            ; tira a tecla do buffer
        INT  16h
        CMP  AL, 27
        JE   @@esc
        ...
        CMP  AH, TECLA_CIMA     ; setas: AL = 0, o que importa é o scan code
        JE   @@cima
```

As setas não têm código ASCII: chegam com AL = 0 (ou E0h no teclado expandido) e o **scan code** em AH: 48h para cima, 50h para baixo, 4Bh para a esquerda e 4Dh para a direita. O [capítulo 6 do livro](livro:cap06) tem a tabela completa e todas as funções da `INT 16h`.

Esse jeito serve muito bem para jogos de **passo**: cada aperto vira um comando. Mas ele tem dois defeitos para jogos de **ação**:

1. **Uma tecla por vez.** O buffer guarda a sequência de teclas digitadas, não o estado do teclado. No PONG, o jogador 1 segura W enquanto o jogador 2 segura a seta para cima: a BIOS só repete a última tecla apertada, e a outra raquete para.
2. **A repetição automática.** Segurando uma tecla, a BIOS gera o primeiro caractere, espera meio segundo, e só então começa a repetir. Uma nave controlada assim dá um passo, para, e depois desliza.

### Uma INT 9 própria: a tabela de teclas

A solução clássica é tomar o teclado da BIOS. Como você viu na [Aula 28](aula:aula28), cada aperto **e** cada soltura geram a IRQ 1, que chama a `INT 9`. O código que chega na porta **60h** tem o bit 7 em 0 no aperto e em 1 na soltura. Um jogo instala a sua própria `INT 9`, que só anota numa tabela de 128 bytes se cada tecla está apertada agora:

```diagrama titulo="A tabela de teclas"
   porta 60h        nossa INT 9               teclas[] (128 bytes)
                                         índice: 00 01 ... 11 ... 1F ... 48 ... 50
   11h (W desce) ──► teclas[11h] = 1     valor:   0  0      1      0      1      0
   48h (↑ desce) ──► teclas[48h] = 1
   91h (W sobe)  ──► teclas[11h] = 0             o laço do jogo só pergunta:
                                                 CMP teclas[SC_W], 1
```

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

Cada linha tem um porquê:

- **`PUSH`/`POP` de tudo o que muda.** A interrupção chega no meio de qualquer instrução do jogo; se ela estragar AX, o jogo estraga junto.
- **`IN AL, 60h`.** Lê o código do teclado. No PC/XT, a BIOS também pulsava o bit 7 da porta 61h para "confirmar" a leitura; no AT, o controlador 8042 faz isso sozinho. Os jogos do curso, como muitos da época, pulam esse passo.
- **O truque `SHL`/`CMC`/`ADC`.** Transforma o bit 7 em 0 ou 1 sem nenhum salto: `SHL AL,1` joga o bit 7 no CF, `CMC` inverte, `ADC AL,0` soma o CF a zero. A [Aula 17](aula:aula17) explica por que fugir de saltos era uma obsessão.
- **`CS:teclas[BX]`.** Dentro de uma rotina de interrupção você **não sabe** o que há em DS: a interrupção pode ter chegado durante uma chamada à BIOS ou ao DOS que mudou o DS. Num .COM, a tabela fica no mesmo segmento do código, então o prefixo de segmento `CS:` sempre acerta. É a mesma ideia da [Aula 15](aula:aula15).
- **O EOI.** `MOV AL,20h` / `OUT 20h,AL` avisa o controlador de interrupções 8259 que a IRQ 1 foi atendida. Sem isso, o PIC considera a IRQ 1 ainda em atendimento e bloqueia ela e todas as de prioridade menor (IRQ 2 a 7): o teclado morre na segunda tecla. Quem mandaria o EOI seria a INT 9 da BIOS, mas ela não é chamada.
- **Não chama a INT 9 antiga.** As teclas nunca chegam ao buffer da BIOS. Isso é de propósito: com a BIOS de fora, não há bip de buffer cheio nem Ctrl+C. O preço é que, enquanto essa rotina estiver instalada, `INT 16h` e `INT 21h` de leitura de teclado ficam esperando para sempre.

Instalar e desinstalar usa as funções do DOS que você conhece da [Aula 15](aula:aula15): **35h** (ler um vetor) e **25h** (gravar um vetor).

```asm fragmento titulo="PONG.ASM: INSTALA_TECLADO e RESTAURA_TECLADO"
INSTALA_TECLADO PROC
        MOV  AX, 3509h          ; guarda o vetor antigo (ES:BX)
        PUSH ES                 ; (a INT 21h/35h estraga o ES, que é o vídeo)
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
        LDS  DX, int9_antiga    ; DS:DX = o vetor guardado
        MOV  AX, 2509h
        INT  21h
        POP  DS
        RET
RESTAURA_TECLADO ENDP
```

:::atencao Devolva o vetor em TODA saída
Se o programa terminar com a `INT 9` apontando para dentro dele, o DOS reaproveita aquela memória para o próximo programa, e a próxima tecla apertada salta para o meio de um código qualquer. O PC trava, e só o botão de reset resolve. Por isso todo jogo tem um único caminho de saída que passa por `RESTAURA_TECLADO`, e nenhum `INT 21h/4Ch` espalhado pelo meio do código.
:::

:::cpu Por que não CLI em volta da instalação?
Gravar um vetor são duas palavras (deslocamento e segmento). Se a IRQ 1 chegasse entre as duas escritas, a CPU saltaria para um endereço meio novo, meio velho. A função 25h do DOS faz a gravação com as interrupções desligadas, e é por isso que os programas bem-comportados usam o DOS em vez de escrever direto na tabela de vetores em 0000:0024h. Quem escreve direto precisa de `CLI`/`STI` em volta. O [capítulo 2 do livro](livro:cap02) tem a tabela de vetores completa.
:::

## Números aleatórios

Onde cai a próxima comida da cobra? Para que lado sai a bola no saque? Qual invasor solta a próxima bomba? O 8086 não tem instrução de sorteio, e a BIOS também não. Os jogos usam um **gerador congruente linear** (LCG, *linear congruential generator*), a fórmula mais simples que produz números com cara de acaso:

```diagrama titulo="Gerador congruente linear"
   semente(nova) = semente(velha) × 25173 + 13849      (mod 65536)

   1 → 39022 → 61087 → 20196 → 45005 → 3882 → ...   (só repete depois de 65.536 números)
```

O "mod 65536" sai de graça: é só ficar com a palavra baixa do `MUL`. Os números 25173 e 13849 não são mágicos, mas obedecem às regras que garantem o período completo de 65.536 (a constante somada é ímpar; o multiplicador menos 1 é múltiplo de 4).

O sorteio de um número **entre 0 e n−1** tem um truque bonito: em vez de dividir e ficar com o resto (lento, e com um viés para os números pequenos), multiplica-se a semente por n e fica-se com a **parte alta** do resultado. Como a semente vai de 0 a 65.535, `semente × n ÷ 65.536` vai de 0 a n−1, e o `MUL` de 16 bits já entrega essa divisão pronta em DX:

```asm fragmento titulo="COBRA.ASM: ALEATORIO"
; ALEATORIO: entra AX = n, sai AX = número sorteado entre 0 e n-1.
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
```

Os bits baixos de um LCG são fracos (o bit 0 simplesmente alterna 0, 1, 0, 1...). Por isso usar `AND AX, 7` para sortear de 0 a 7 seria uma péssima ideia, e a parte alta da multiplicação é a escolha certa: ela usa os bits **altos**, os melhores.

A **semente** inicial vem do relógio, senão toda partida seria igual:

```asm fragmento titulo="COBRA.ASM: SEMEIA"
SEMEIA  PROC
        CALL LE_RELOGIO         ; tiques desde a meia-noite
        MOV  semente, AX
        RET
SEMEIA  ENDP
```

:::anos90 O acaso que se repete
Uma semente fixa tem uma utilidade: a partida sai **sempre igual**. Vários jogos de fliperama e de console usavam isso de propósito, e jogadores decoravam os "padrões" dos inimigos. Nos PCs, gravar só a semente e as teclas apertadas era o jeito de guardar uma "demonstração" do jogo em poucos bytes: o jogo roda de novo e tudo acontece igual.
:::

## Desenhando direto na memória de vídeo

A BIOS sabe escrever um caractere (`INT 10h`, AH = 09h) e um pixel (AH = 0Ch), e o [capítulo 3 do livro](livro:cap03) mostra todas essas funções. Mas cada chamada custa centenas de ciclos. Um jogo escreve **direto** na memória da placa de vídeo, que fica no espaço de endereços da CPU como se fosse memória comum.

### Modo texto: B800h

No modo texto 80x25 colorido, a tela começa em **B800:0000**. Cada célula ocupa **2 bytes**: o caractere e o atributo (a cor). Uma linha tem 80 células, portanto 160 bytes:

```diagrama titulo="A tela de texto em B800h"
   coluna:    0         1         2              79
            ┌────┬────┬────┬────┬────┬────┬ ┄ ┬────┬────┐
  linha 0   │car │cor │car │cor │car │cor │   │car │cor │  bytes 0 a 159
            ├────┼────┼────┼────┼────┼────┼ ┄ ┼────┼────┤
  linha 1   │    │    │    │    │    │    │   │    │    │  bytes 160 a 319
            └────┴────┴────┴────┴────┴────┴ ┄ ┴────┴────┘

   deslocamento = linha × 160 + coluna × 2

   atributo:  bit 7    bits 6-4     bits 3-0
             piscar    cor do fundo  cor da letra     ex.: 1Fh = branco no azul
```

`MOV ES:[DI], AX` com AL = caractere e AH = cor escreve uma célula inteira de uma vez. A multiplicação por 160 é cara no 8086 (`MUL` de 16 bits leva mais de 100 ciclos), e a COBRA a troca por uma **tabela de linhas** pré-calculada:

```asm fragmento titulo="COBRA.ASM: POSICAO, POE_CEL e LE_CEL"
; POSICAO: DH = linha, DL = coluna  ->  DI = deslocamento em B800h
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

POE_CEL PROC                    ; escreve AL (caractere) com AH (cor)
        PUSH DI
        CALL POSICAO
        MOV  ES:[DI], AX
        POP  DI
        RET
POE_CEL ENDP

LE_CEL  PROC                    ; AL = caractere, AH = cor
        PUSH DI
        CALL POSICAO
        MOV  AX, ES:[DI]
        POP  DI
        RET
LE_CEL  ENDP

linhas  DW  0*160,  1*160,  2*160, ... 24*160
```

`LE_CEL` é tão importante quanto `POE_CEL`: a memória de vídeo também pode ser **lida**, e a cobra a usa como mapa de colisão. Você vai ver isso na [Aula 33](aula:aula33).

### Modo 13h: A000h

No modo 13h ([Aula 23](aula:aula23)), cada pixel é **um byte** com o número da cor, e a tela de 320 x 200 começa em **A000:0000**. O deslocamento do pixel (x, y) é `y × 320 + x`. Os jogos gráficos evitam o `MUL` com uma decomposição clássica: 320 = 256 + 64, e multiplicar por potências de 2 é só deslocar.

```asm fragmento titulo="INVASOR.ASM: ENDERECO"
; ENDERECO: DI = DX * 320 + BX (y * 256 + y * 64 + x, sem MUL)
ENDERECO PROC
        PUSH DX
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL             ; DX = y * 256 (só trocar de byte!)
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

Seis `SHL DI,1` custam 12 ciclos; `MOV CL,6` / `SHL DI,CL` custaria 4 + 8 + 4×6 = 36. No 8086, deslocar por CL paga 4 ciclos **por bit**, e para poucos bits a repetição da instrução simples ganha.

### Apagar e redesenhar

Redesenhar a tela inteira a cada quadro seria caro: 64.000 bytes no modo 13h, mais de 32.000 ciclos só de `REP STOSW`, e ainda pisca. Os jogos da época desenhavam só **o que mudou**: apagam cada objeto na posição antiga (pintando com a cor do fundo) e o desenham na nova.

```diagrama titulo="Apagar e redesenhar"
   quadro N                      quadro N+1
   ┌──────────────────┐          ┌──────────────────┐
   │   ■              │  apaga   │                  │  desenha   ┌──────────────────┐
   │                  │ ───────► │                  │ ─────────► │     ■            │
   └──────────────────┘ (fundo)  └──────────────────┘ (cor)      └──────────────────┘
     guarda onde                                                   guarda onde
     desenhou                                                      desenhou agora
```

Detalhe essencial do PONG: ele guarda **onde desenhou** cada objeto (`raq1_desenhada`, `bola_xd`...) separado de **onde o objeto está** (`raq1_y`, `bola_x`). Assim o apagamento acerta mesmo que a posição tenha mudado várias vezes desde o último desenho.

A COBRA leva a ideia ao extremo: a cada passo, só **duas** células mudam de verdade (a cauda vira espaço e a nova cabeça aparece), e mais uma muda de desenho (a cabeça antiga vira corpo). Três escritas de 2 bytes por passo.

### Sprites

Um **sprite** é um desenho pequeno que se move por cima do cenário: a nave, o invasor, o tiro. O INVASOR guarda os desenhos com **1 bit por pixel**, uma palavra por linha, e a rotina `SPRITE` pinta só os bits 1, deixando os 0 **transparentes**:

```asm fragmento titulo="INVASOR.ASM: SPRITE"
; SI = desenho (uma word por linha, bit 15 = pixel da esquerda),
; BX = x, DX = y, AL = cor, CL = número de linhas.
; Bits 0 ficam transparentes; com AL = 0 a mesma rotina apaga o desenho.
SPRITE  PROC
        ...
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

```diagrama titulo="A lula do INVASOR (inv1_a), 1 bit por pixel"
   DW 0000011000000000b      .....##.........
   DW 0000111100000000b      ....####........
   DW 0001111110000000b      ...######.......
   DW 0011011011000000b      ..##.##.##......
   DW 0011111111000000b      ..########......
   DW 0000100100000000b      ....#..#........
   DW 0001011010000000b      ...#.##.#.......
   DW 0010100101000000b      ..#.#..#.#......
```

O `OR DX,DX` / `JNZ` encerra a linha assim que os bits 1 acabam: um desenho de 12 pixels de largura não gasta tempo com os 4 bits vazios da direita. E o comentário diz a melhor parte: **chamar a mesma rotina com AL = 0 apaga** o sprite, porque pinta de preto exatamente os pixels que ele ocupava.

:::dica Fundo preto facilita tudo
Apagar "pintando com a cor do fundo" só funciona se o fundo for liso. Por isso os jogos simples da época têm fundo preto. Com um cenário desenhado por trás, seria preciso guardar os pixels de baixo antes de desenhar o sprite e devolvê-los depois, ou desenhar o quadro inteiro numa tela fora da vista (o *double buffer* da [Aula 24](aula:aula24)) e copiá-la de uma vez.
:::

## Som sem travar

Na [Aula 29](aula:aula29) você tocou notas com `TOCAR`, `ESPERAR` e `SILENCIO`. Num jogo, o `ESPERAR` é proibido: um "plim" de 100 ms congelaria a bola por 100 ms. O truque é o mesmo do laço: **ligar** o som, anotar **quando** ele deve acabar, e deixar que o laço desligue na hora certa.

```asm fragmento titulo="COBRA.ASM: SOM_LIGA, SOM_ATUALIZA e SOM_DESLIGA"
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
        MOV  som_fim, AX        ; o tique em que o som deve parar
        MOV  som_ligado, 1
        POP  AX
        RET
SOM_LIGA ENDP

SOM_ATUALIZA PROC               ; chamada uma vez por volta do laço
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
        AND  AL, 0FCh           ; só os bits 0 e 1: o resto da porta 61h é de outros
        OUT  61h, AL
        MOV  som_ligado, 0
        POP  AX
        RET
SOM_DESLIGA ENDP
```

Os jogos passam o **divisor** pronto em BX, não a frequência: `MOV BX, 1400` é um bip de 1.193.182 ÷ 1.400 ≈ 852 Hz. Isso poupa o `DIV` (mais de 140 ciclos) e é o que as listagens da época faziam, com uma tabela de divisores no lugar da tabela de notas.

```diagrama titulo="O som acontece em paralelo ao laço"
  tique:     100    101    102    103    104
  laço:   ┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃     (o jogo nunca para)
             ▲                    ▲
          SOM_LIGA             SOM_ATUALIZA vê tique ≥ som_fim
          som_fim = 103        e desliga
  PIT:       ╔════════════════════╗
             ║ onda quadrada      ║  o canal 2 toca sozinho, sem a CPU
             ╚════════════════════╝
```

Um som novo pode chegar com outro ainda tocando: `SOM_LIGA` simplesmente reprograma o divisor e o prazo, e o novo "atropela" o velho. Para jogos simples, um canal de efeitos é suficiente. O [capítulo 20 do livro](livro:cap20) mostra também como tocar uma música de fundo pela própria `INT 8`.

:::atencao A comparação "até quando" do som
`SOM_ATUALIZA` compara `AX` com `som_fim` (o "até quando" que a seção de tempo mandou evitar). Aqui o risco foi aceito: se o contador der a volta no meio de um bip, o som dura no máximo um tique a menos. Para um efeito de 100 ms, ninguém percebe. Para uma espera de verdade, use sempre a subtração.
:::

## Saindo limpo

Um jogo mexe em quatro coisas que pertencem ao sistema: o modo de vídeo, o vetor da INT 9, o alto-falante e, às vezes, o cursor ou a paleta. Tudo precisa voltar ao que era, **em todas as saídas**:

```asm fragmento titulo="PONG.ASM: a única saída do programa"
@@sair: CALL SOM_DESLIGA        ; 1. silêncio (senão o apito continua no DOS)
        CALL RESTAURA_TECLADO   ; 2. a INT 9 da BIOS de volta
        MOV  AX, 0003h          ; 3. modo texto 80x25 (limpa a tela e a paleta)
        INT  10h
        MOV  AX, 4C00h          ; 4. só então, volta ao DOS
        INT  21h
```

| O que o jogo mudou | Como devolver | Se esquecer |
|--------------------|---------------|-------------|
| modo de vídeo (13h) | `INT 10h`, AX = 0003h | o prompt do DOS aparece em 320x200, ilegível |
| vetor da INT 9 | `INT 21h`, AX = 2509h, com o vetor guardado | o PC trava na primeira tecla |
| alto-falante | porta 61h, bits 0 e 1 em 0 | um apito eterno no DOS |
| cursor escondido (INT 10h, AH = 01h) | a troca de modo devolve o cursor normal | o prompt sem cursor |
| canal 0 do PIT acelerado | divisor 0 na porta 40h | o relógio do DOS dispara |

A troca de modo com `INT 10h` resolve de uma vez a tela, o cursor e a paleta: a BIOS reprograma tudo. Por isso até a COBRA, que nunca sai do modo texto, termina com `MOV AX,0003h` / `INT 10h`.

## QUADRADO.ASM: um jogo de 300 linhas

Hora de juntar tudo. O QUADRADO não tem objetivo, nem pontos, nem fim, mas tem **todas** as peças de um jogo de ação: modo 13h, uma `INT 9` com tabela de teclas (ele anda na diagonal com duas setas apertadas), o retraço como relógio, apagar e redesenhar, o LCG (ESPAÇO sorteia outra cor), um bip pelo PIT quando encosta na borda, e a saída limpa no ESC.

```diagrama titulo="Estrutura do QUADRADO.ASM"
   inicio ── modo 13h, ES = A000h, INSTALA_TECLADO, semente
     │
     ├─► @@quadro: ESPERA_RETRACO → APAGA → ATUALIZA → DESENHA → SOM_ATUALIZA
     │             └────────── enquanto teclas[ESC] = 0 ──────────┘
     │
     └─► saída: SOM_DESLIGA, RESTAURA_TECLADO, modo 03h, INT 21h/4Ch

   ATUALIZA ── teclas[←→↑↓] → px, py ── bordas? BATEU (SOM_LIGA)
            └─ teclas[ESPAÇO] (só na descida) → ALEATORIO → cor
```

Clique em **▶ Jogar** para abrir a tela grande. Use as setas (experimente duas ao mesmo tempo), ESPAÇO e ESC.

```asm jogo titulo="QUADRADO.ASM"
; QUADRADO.ASM - o menor jogo possível: um quadrado que anda com as setas
; Modo 13h, teclado pela INT 9 própria, retraço vertical, som pelo PIT.
; Setas movem (até na diagonal), ESPAÇO sorteia outra cor, ESC sai.
.MODEL TINY
.CODE
        ORG 100h

LADO        EQU 16              ; o quadrado tem 16 x 16 pixels
VEL         EQU 2               ; pixels por quadro
MAX_X       EQU 320-LADO
MAX_Y       EQU 200-LADO
SC_ESC      EQU 01h
SC_ESPACO   EQU 39h
SC_CIMA     EQU 48h
SC_BAIXO    EQU 50h
SC_ESQ      EQU 4Bh
SC_DIR      EQU 4Dh

inicio:
        CLD
        MOV  AX, 0013h          ; modo 13h: 320 x 200, 256 cores
        INT  10h
        MOV  AX, 0A000h
        MOV  ES, AX             ; ES = memória de vídeo, o tempo todo
        CALL INSTALA_TECLADO
        MOV  AH, 00h            ; semente do sorteio = relógio da BIOS
        INT  1Ah
        MOV  semente, DX
        CALL DESENHA            ; primeiro quadro

@@quadro:                       ; ===== o laço do jogo =====
        CALL ESPERA_RETRACO     ; 4. espera (70 vezes por segundo)
        CALL APAGA              ;    apaga na posição antiga...
        CALL ATUALIZA           ; 1 e 2. lê a tabela de teclas e move
        CALL DESENHA            ; 3. ...e desenha na nova
        CALL SOM_ATUALIZA       ;    desliga o bip quando o tempo dele acaba
        CMP  teclas[SC_ESC], 1
        JNE  @@quadro

        CALL SOM_DESLIGA        ; ===== saída limpa =====
        CALL RESTAURA_TECLADO
        MOV  AX, 0003h          ; volta ao modo texto
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ATUALIZA: soma a velocidade de cada tecla apertada e limita às bordas
ATUALIZA PROC
        MOV  AX, px
        MOV  BX, py
        CMP  teclas[SC_ESQ], 1
        JNE  @@d
        SUB  AX, VEL
@@d:    CMP  teclas[SC_DIR], 1
        JNE  @@c
        ADD  AX, VEL
@@c:    CMP  teclas[SC_CIMA], 1
        JNE  @@b
        SUB  BX, VEL
@@b:    CMP  teclas[SC_BAIXO], 1
        JNE  @@limita
        ADD  BX, VEL
@@limita:                       ; comparações com sinal: AX pode ter ficado negativo
        CMP  AX, 0
        JGE  @@x1
        XOR  AX, AX
        CALL BATEU
@@x1:   CMP  AX, MAX_X
        JLE  @@y0
        MOV  AX, MAX_X
        CALL BATEU
@@y0:   CMP  BX, 0
        JGE  @@y1
        XOR  BX, BX
        CALL BATEU
@@y1:   CMP  BX, MAX_Y
        JLE  @@guarda
        MOV  BX, MAX_Y
        CALL BATEU
@@guarda:
        MOV  px, AX
        MOV  py, BX
        CMP  teclas[SC_ESPACO], 1 ; ESPAÇO: cor nova, uma vez por aperto
        JNE  @@solto
        CMP  espaco_antes, 1
        JE   @@fim
        MOV  espaco_antes, 1
        MOV  AX, 15             ; cor sorteada entre 1 e 15
        CALL ALEATORIO
        INC  AL
        MOV  cor, AL
        RET
@@solto:
        MOV  espaco_antes, 0
@@fim:  RET
ATUALIZA ENDP

; BATEU: bip curto quando o quadrado encosta na borda
BATEU   PROC
        PUSH BX
        MOV  BX, 3000           ; divisor 3000 = 398 Hz
        CALL SOM_LIGA
        POP  BX
        RET
BATEU   ENDP

; APAGA e DESENHA: o mesmo retângulo, na cor do fundo ou na cor do quadrado
APAGA   PROC
        XOR  AL, AL
        MOV  BX, px
        MOV  DX, py
        JMP  SHORT PINTA
APAGA   ENDP

DESENHA PROC
        MOV  AL, cor
        MOV  BX, px
        MOV  DX, py
        JMP  SHORT PINTA
DESENHA ENDP

; PINTA: quadrado LADO x LADO na cor AL, canto em (BX, DX)
PINTA   PROC
        MOV  DI, DX             ; DI = y * 320 + x, sem MUL:
        MOV  DH, DL             ; y * 256 ...
        XOR  DL, DL
        MOV  CL, 6
        SHL  DI, CL             ; ... + y * 64
        ADD  DI, DX
        ADD  DI, BX
        MOV  DX, LADO
@@linha:
        MOV  CX, LADO
        REP  STOSB              ; uma linha do quadrado
        ADD  DI, 320-LADO       ; desce para a linha de baixo
        DEC  DX
        JNZ  @@linha
        RET
PINTA   ENDP

; ESPERA_RETRACO: espera o feixe começar a voltar para o topo da tela
ESPERA_RETRACO PROC
        MOV  DX, 3DAh
@@fora: IN   AL, DX             ; se já estamos num retraço, deixa acabar
        TEST AL, 8
        JNZ  @@fora
@@dentro:
        IN   AL, DX             ; agora espera o próximo começar
        TEST AL, 8
        JZ   @@dentro
        RET
ESPERA_RETRACO ENDP

; NOVA_INT9: anota em teclas[] se cada tecla está apertada (1) ou solta (0)
NOVA_INT9 PROC FAR
        PUSH AX
        PUSH BX
        IN   AL, 60h            ; scan code: bit 7 = 1 quando a tecla é solta
        MOV  BL, AL
        AND  BX, 007Fh          ; BX = número da tecla (0 a 127)
        MOV  AH, 1
        TEST AL, 80h
        JZ   @@anota
        XOR  AH, AH
@@anota:
        MOV  CS:teclas[BX], AH  ; CS: não sabemos quanto vale DS aqui
        MOV  AL, 20h            ; EOI: avisa o PIC que acabamos
        OUT  20h, AL
        POP  BX
        POP  AX
        IRET
NOVA_INT9 ENDP

INSTALA_TECLADO PROC
        PUSH ES
        MOV  AX, 3509h          ; ES:BX = vetor antigo da INT 9
        INT  21h
        MOV  WORD PTR int9_antiga, BX
        MOV  WORD PTR int9_antiga+2, ES
        POP  ES
        MOV  AX, 2509h          ; DS:DX = a nossa rotina
        MOV  DX, OFFSET NOVA_INT9
        INT  21h
        RET
INSTALA_TECLADO ENDP

RESTAURA_TECLADO PROC
        PUSH DS
        LDS  DX, int9_antiga    ; DS:DX = vetor antigo
        MOV  AX, 2509h
        INT  21h
        POP  DS
        RET
RESTAURA_TECLADO ENDP

; ALEATORIO: AX = n  ->  AX = sorteio entre 0 e n-1 (LCG)
ALEATORIO PROC
        PUSH BX
        PUSH DX
        MOV  BX, AX
        MOV  AX, semente
        MOV  DX, 25173
        MUL  DX
        ADD  AX, 13849          ; semente = semente * 25173 + 13849
        MOV  semente, AX
        MUL  BX
        MOV  AX, DX             ; parte alta de semente * n
        POP  DX
        POP  BX
        RET
ALEATORIO ENDP

; SOM_LIGA: toca o divisor BX por cerca de 2 tiques, sem parar o jogo
SOM_LIGA PROC
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  AL, 0B6h           ; canal 2, byte baixo e alto, onda quadrada
        OUT  43h, AL
        MOV  AL, BL
        OUT  42h, AL
        MOV  AL, BH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3              ; liga o alto-falante
        OUT  61h, AL
        MOV  AH, 00h
        INT  1Ah                ; DX = tiques agora
        ADD  DX, 2
        MOV  som_fim, DX        ; anota quando desligar
        MOV  som_ligado, 1
        POP  DX
        POP  CX
        POP  AX
        RET
SOM_LIGA ENDP

SOM_ATUALIZA PROC
        CMP  som_ligado, 1
        JNE  @@fim
        MOV  AH, 00h
        INT  1Ah
        CMP  DX, som_fim
        JB   @@fim
        CALL SOM_DESLIGA
@@fim:  RET
SOM_ATUALIZA ENDP

SOM_DESLIGA PROC
        IN   AL, 61h
        AND  AL, 0FCh           ; desliga só os bits 0 e 1
        OUT  61h, AL
        MOV  som_ligado, 0
        RET
SOM_DESLIGA ENDP

px          DW 152              ; canto do quadrado, em pixels
py          DW 92
cor         DB 14
espaco_antes DB 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0
int9_antiga DD 0
teclas      DB 128 DUP (0)

END inicio
```

Algumas escolhas do QUADRADO que você vai reencontrar nos jogos grandes:

- **A ordem apagar → mover → desenhar** dentro do mesmo quadro, logo depois do retraço. O quadrado nunca fica "meio apagado" na tela enquanto o feixe passa.
- **Comparações com sinal nas bordas** (`JGE`, `JLE`). Com x = 0 e a seta para a esquerda, `SUB AX,2` dá −2, que sem sinal seria 65.534 e passaria por "muito à direita".
- **`espaco_antes`**: a tabela diz se a tecla **está** apertada, não se **acabou de ser** apertada. Sem essa variável, segurar o ESPAÇO sortearia 70 cores por segundo. É a detecção de **borda** (a passagem de 0 para 1), o mesmo problema que o PONG resolve com `ESPERA_SOLTAR`.
- **Deslocamento por CL em PINTA.** Aqui o autor preferiu `MOV CL,6` / `SHL DI,CL` (curto) aos seis `SHL DI,1` (rápido) do INVASOR. Para um quadrado por quadro, a diferença não importa.

```quiz
? Qual é o único passo do laço do jogo que pode esperar?
- A entrada: o jogo espera o jogador apertar uma tecla
- O desenho: espera o feixe terminar a tela
+ A espera do fim do laço (tique ou retraço), que dá o ritmo
- Nenhum: um jogo nunca espera
> Ler o teclado, tocar som e desenhar não podem esperar. Só o passo 4 segura o laço, e é ele que faz o jogo ter a mesma velocidade em qualquer PC.

? A INT 16h com AH = 01h encontrou uma tecla. O que acontece com ela?
- É tirada do buffer e devolvida em AX
+ Continua no buffer; ZF = 0 e AX mostra qual é. Para tirá-la, chame AH = 00h
- É descartada
> A função 01h só espia. Se você não chamar a 00h depois, a mesma tecla aparece de novo na próxima volta do laço.

? Na rotina NOVA_INT9, por que `MOV CS:teclas[BX], AL` e não `MOV teclas[BX], AL`?
- Porque a tabela de teclas fica na memória de vídeo
+ Porque, dentro da interrupção, DS pode estar apontando para qualquer lugar; num .COM, CS sempre aponta para o segmento das variáveis
- Porque o 8086 não aceita índice com DS
> A IRQ 1 chega no meio de qualquer coisa, inclusive de uma chamada ao DOS que mudou DS. O prefixo CS: usa um segmento que, com certeza, é o do programa.

? Um jogo instalou uma INT 9 própria e termina com INT 21h/4Ch sem restaurar o vetor. O que acontece?
- Nada: o DOS restaura todos os vetores no fim do programa
+ A próxima tecla salta para uma memória que já não é do jogo, e o PC trava
- O teclado volta a funcionar depois de um tique
> O DOS só restaura os vetores 22h, 23h e 24h (guardados no PSP). O resto é responsabilidade do programa.

? Para sortear de 0 a n−1, por que os jogos usam a parte alta de semente × n em vez de semente AND (n−1)?
- Porque AND não funciona com números ímpares
+ Porque os bits baixos de um LCG são fracos (o bit 0 só alterna); a parte alta usa os bits altos e funciona para qualquer n
- Porque MUL é mais rápido que AND
> AND só serviria para n potência de 2 e usaria justamente os piores bits. A parte alta do produto dá números de 0 a n−1 para qualquer n, sem DIV.

? Por que o deslocamento no modo texto é linha × 160 + coluna × 2?
+ Cada linha tem 80 células de 2 bytes (caractere e atributo)
- Porque a tela tem 160 colunas
- Porque B800h × 2 = 160
> 80 células × 2 bytes = 160 bytes por linha. O caractere fica no byte par e a cor no ímpar.

? O SOM_LIGA de um jogo calcula `som_fim` e volta na hora. Quem desliga o alto-falante?
- O próprio PIT, quando a contagem acaba
- A BIOS, no próximo tique
+ SOM_ATUALIZA, chamada a cada volta do laço, quando o relógio passa de som_fim
> O canal 2 toca para sempre se ninguém mexer na porta 61h. O laço confere o prazo e desliga na hora certa, sem nunca parar o jogo.
```

## Exercícios

Cada exercício isola uma rotina dos jogos. Os que usam variáveis começam com `JMP inicio` para pular os dados.

```exercicio
id: a32-1
titulo: ENDERECO_TELA
nivel: 1
--- enunciado
No modo texto 80x25, a célula da **linha DH**, **coluna DL** fica no deslocamento `linha × 160 + coluna × 2` a partir de B800h.

Calcule esse deslocamento em **DI**. DX não pode mudar (as rotinas de desenho da COBRA chamam esta várias vezes com o mesmo DX).
--- inicial
; DH = linha (0 a 24), DL = coluna (0 a 79)
; calcule DI = DH * 160 + DL * 2
--- testes
[{ "nome": "canto de cima (0, 0)", "setup": { "DX": 0, "DI": 1 }, "espera": { "DI": 0, "preservar": ["DX"] } },
 { "nome": "meio da tela (12, 40)", "setup": { "DX": 3112 }, "espera": { "DI": 2000, "preservar": ["DX"] } },
 { "nome": "última célula (24, 79)", "setup": { "DX": 6223 }, "espera": { "DI": 3998, "preservar": ["DX"] } },
 { "nome": "linha 1, coluna 0", "setup": { "DX": 256 }, "espera": { "DI": 160, "preservar": ["DX"] } },
 { "nome": "linha 0, coluna 5", "setup": { "DX": 5 }, "espera": { "DI": 10, "preservar": ["DX"] } }]
--- dicas
Copie a linha para um registrador de 16 bits: MOV AL,DH / MOV AH,160 / MUL AH deixa AX = linha × 160.
Ou sem MUL: linha × 160 = linha × 128 + linha × 32.
Some coluna × 2: MOV BL,DL / XOR BH,BH / SHL BX,1 / ADD AX,BX. No fim, MOV DI,AX.
Cuidado: MUL de 16 bits estraga DX. MUL de 8 bits (MUL AH ou MUL BL) só mexe em AX.
--- solucao
; DH = linha (0 a 24), DL = coluna (0 a 79)
        MOV  AL, DH
        MOV  AH, 160
        MUL  AH                 ; AX = linha * 160 (MUL de 8 bits não mexe em DX)
        MOV  DI, AX
        MOV  BL, DL
        XOR  BH, BH
        SHL  BX, 1              ; coluna * 2
        ADD  DI, BX
```

```exercicio
id: a32-2
titulo: ALEATORIO
nivel: 2
exigir: MUL
--- enunciado
Escreva o gerador de números aleatórios dos jogos. AX chega com **n** (1 a 65.535). Faça:

1. `semente = semente × 25173 + 13849`, só a palavra baixa (mod 65.536), e guarde de volta em **semente**;
2. devolva em **AX** a **parte alta** do produto `semente(nova) × n`, que é um número entre 0 e n−1.
--- inicial
        JMP  inicio
semente DW 1
inicio: ; AX = n
        ; atualize a semente e devolva em AX um número entre 0 e n-1
--- testes
[{ "nome": "semente 1, n = 100", "setup": { "semente": 1, "AX": 100 }, "espera": { "AX": 59, "mem": { "semente": 39022 } } },
 { "nome": "semente 65535, n = 6 (um dado)", "setup": { "semente": 65535, "AX": 6 }, "espera": { "AX": 4, "mem": { "semente": 54212 } } },
 { "nome": "semente 0, n = 320", "setup": { "semente": 0, "AX": 320 }, "espera": { "AX": 67, "mem": { "semente": 13849 } } },
 { "nome": "n = 1 sempre dá 0", "setup": { "semente": 40000, "AX": 1 }, "espera": { "AX": 0, "mem": { "semente": 38745 } } }]
--- dicas
Guarde n em BX antes de tudo: o MUL usa AX.
MOV AX,semente / MOV DX,25173 / MUL DX: a palavra baixa do produto fica em AX (ignore DX).
ADD AX,13849 e MOV semente,AX.
MUL BX: DX:AX = semente × n. A resposta é DX: MOV AX,DX.
--- solucao
        JMP  inicio
semente DW 1
inicio: ; AX = n
        MOV  BX, AX
        MOV  AX, semente
        MOV  DX, 25173
        MUL  DX
        ADD  AX, 13849
        MOV  semente, AX
        MUL  BX
        MOV  AX, DX
```

```exercicio
id: a32-3
titulo: LER_DIRECAO
nivel: 2
--- enunciado
AH chega com o **scan code** de uma tecla. Transforme as setas numa direção, em **DL** (dx, o passo horizontal) e **DH** (dy, o passo vertical), com −1 = 0FFh:

| Tecla | Scan code | DL (dx) | DH (dy) |
|-------|-----------|---------|---------|
| ↑ | 48h | 0 | −1 |
| ↓ | 50h | 0 | 1 |
| ← | 4Bh | −1 | 0 |
| → | 4Dh | 1 | 0 |
| qualquer outra | | 0 | 0 |
--- inicial
; AH = scan code
; DL = dx, DH = dy
--- testes
[{ "nome": "seta para cima", "setup": { "AX": 18432, "DX": 4660 }, "espera": { "DL": 0, "DH": -1 } },
 { "nome": "seta para baixo", "setup": { "AX": 20480, "DX": 4660 }, "espera": { "DL": 0, "DH": 1 } },
 { "nome": "seta para a esquerda", "setup": { "AX": 19200, "DX": 4660 }, "espera": { "DL": -1, "DH": 0 } },
 { "nome": "seta para a direita", "setup": { "AX": 19712, "DX": 4660 }, "espera": { "DL": 1, "DH": 0 } },
 { "nome": "Enter (1Ch) não é direção", "setup": { "AX": 7181, "DX": 4660 }, "espera": { "DX": 0 } }]
--- dicas
Comece com XOR DX,DX: assim "qualquer outra" já está pronta.
Uma série de CMP AH,48h / JE @@cima ... e, em cada rótulo, MOV DH,-1 (ou MOV DL,1...) seguido de um salto para o fim.
Uma alternativa sem tantos saltos: uma tabela de 4 entradas e um laço que procura o scan code nela.
--- solucao
; AH = scan code
        XOR  DX, DX
        CMP  AH, 48h
        JE   @@cima
        CMP  AH, 50h
        JE   @@baixo
        CMP  AH, 4Bh
        JE   @@esq
        CMP  AH, 4Dh
        JNE  @@fim
        MOV  DL, 1
        JMP  SHORT @@fim
@@cima: MOV  DH, -1
        JMP  SHORT @@fim
@@baixo:
        MOV  DH, 1
        JMP  SHORT @@fim
@@esq:  MOV  DL, -1
@@fim:
```

```exercicio
id: a32-4
titulo: Tecla sem esperar
nivel: 1
exigir: INT
--- enunciado
O código inicial lê uma tecla com `INT 16h`, AH = 00h, e por isso **trava** quando ninguém aperta nada: num jogo, tudo pararia.

Corrija: se houver tecla no buffer, tire-a e deixe o código **ASCII** em **AL**; se não houver, deixe **AL = 0** e termine na hora.
--- inicial
        MOV  AH, 00h            ; espera uma tecla (trava o jogo!)
        INT  16h
--- testes
[{ "nome": "buffer vazio: não pode esperar", "setup": { "AX": 4369 }, "espera": { "AL": 0 } },
 { "nome": "tecla a", "entrada": "a", "espera": { "AL": 97 } },
 { "nome": "ESC", "entrada": "{ESC}", "espera": { "AL": 27 } },
 { "nome": "duas teclas: lê só a primeira", "entrada": "xy", "espera": { "AL": 120 } }]
--- dicas
INT 16h com AH = 01h não espera: ZF = 1 quando o buffer está vazio.
Se ZF = 1, zere AL e pule para o fim. Senão, chame a INT 16h de novo com AH = 00h para tirar a tecla.
--- solucao
        MOV  AH, 01h            ; há tecla?
        INT  16h
        JZ   @@nada
        MOV  AH, 00h            ; há: tira do buffer
        INT  16h
        JMP  SHORT @@fim
@@nada: XOR  AL, AL
@@fim:
```

```exercicio
id: a32-5
titulo: Bloco no modo 13h
nivel: 3
proibir: MUL, IMUL
exigir: STOSB|STOSW
--- enunciado
Pinte um **quadrado** de **CX × CX** pixels na cor **AL**, com o canto de cima à esquerda em (**BX**, **DX**) = (x, y), direto na memória do modo 13h (segmento A000h, deslocamento `y × 320 + x`).

Sem `MUL`: use 320 = 256 + 64. Não é preciso trocar o modo de vídeo: o verificador olha a memória A000h.
--- inicial
; AL = cor, BX = x, DX = y, CX = lado
; pinte o quadrado em A000h
--- testes
[{ "nome": "4 x 4 vermelho em (10, 20)", "setup": { "AX": 4, "BX": 10, "DX": 20, "CX": 4 }, "espera": { "contaPixels": { "4": 16 }, "pixel": { "10,20": 4, "13,23": 4, "14,20": 0, "10,24": 0, "9,20": 0 } } },
 { "nome": "16 x 16 amarelo em (152, 92)", "setup": { "AX": 14, "BX": 152, "DX": 92, "CX": 16 }, "espera": { "contaPixels": { "14": 256 }, "pixel": { "152,92": 14, "167,107": 14, "168,107": 0 } } },
 { "nome": "1 x 1 no último pixel", "setup": { "AX": 15, "BX": 319, "DX": 199, "CX": 1 }, "espera": { "contaPixels": { "15": 1 }, "pixel": { "319,199": 15 } } }]
--- dicas
Não existe MOV ES,0A000h: passe por um registrador que não seja AX (AL tem a cor), como MOV SI,0A000h / MOV ES,SI.
DI = y × 64 (seis SHL DI,1 ou SHL DI,CL) + y × 256 (MOV DH,DL / XOR DL,DL) + x.
Guarde o lado num registrador livre (por exemplo BP). Para cada linha: MOV CX,BP / REP STOSB / ADD DI,320 / SUB DI,BP.
--- solucao
; AL = cor, BX = x, DX = y, CX = lado
        MOV  SI, 0A000h
        MOV  ES, SI
        CLD
        MOV  BP, CX             ; BP = lado
        MOV  DI, DX
        MOV  DH, DL
        XOR  DL, DL             ; DX = y * 256
        MOV  CL, 6
        SHL  DI, CL             ; DI = y * 64
        ADD  DI, DX
        ADD  DI, BX
        MOV  DX, BP             ; DX = linhas que faltam
@@linha:
        MOV  CX, BP
        REP  STOSB
        ADD  DI, 320
        SUB  DI, BP
        DEC  DX
        JNZ  @@linha
```

```exercicio
id: a32-6
titulo: Tabela de teclas
nivel: 2
--- enunciado
Escreva o miolo de uma `INT 9` para jogos. AL chega com o byte lido da porta 60h. Os 7 bits de baixo são o número da tecla; o bit 7 diz se ela foi **solta** (1) ou **apertada** (0).

Grave em **teclas[número]** o valor **1** se a tecla foi apertada ou **0** se foi solta.
--- inicial
        JMP  inicio
teclas  DB 128 DUP (0)
inicio: ; AL = código da porta 60h
        ; atualize teclas[AL AND 7Fh]
--- testes
[{ "nome": "W apertada (11h)", "setup": { "AX": 17 }, "espera": { "mem": { "teclas": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0] } } },
 { "nome": "ESC apertado (01h)", "setup": { "AX": 1 }, "espera": { "mem": { "teclas": [0,1,0] } } },
 { "nome": "W solta (91h)", "setup": { "AX": 145, "teclas": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] }, "espera": { "mem": { "teclas": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1] } } },
 { "nome": "seta para cima solta (C8h)", "setup": { "AX": 200, "teclas": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1] }, "espera": { "mem": { "teclas": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1] } } }]
--- dicas
O número da tecla: MOV BL,AL / AND BX,7Fh (assim BH fica 0 e BX serve de índice).
Para o valor: TEST AL,80h. Se der zero (JZ), a tecla foi apertada: grave 1. Senão grave 0.
Uma saída sem salto: SHL AL,1 (bit 7 no CF) / CMC / MOV AL,0 / ADC AL,0, como no PONG.
--- solucao
        JMP  inicio
teclas  DB 128 DUP (0)
inicio: ; AL = código da porta 60h
        MOV  BL, AL
        AND  BX, 007Fh
        MOV  AH, 1
        TEST AL, 80h
        JZ   @@grava
        XOR  AH, AH
@@grava:
        MOV  teclas[BX], AH
```

## Desafios

Ideias para levar o QUADRADO adiante. Não há verificador: rode no laboratório e jogue.

1. **Rastro.** Comente a chamada a `APAGA` e veja o quadrado pintar a tela. Depois faça o rastro mudar de cor sozinho a cada quadro (use a variável `cor` como contador).
2. **Inércia.** Em vez de mover 2 pixels enquanto a seta está apertada, guarde uma velocidade `vx`, `vy` que aumenta com a seta e diminui aos poucos sem ela. O quadrado vira uma nave que desliza.
3. **Comida.** Sorteie com `ALEATORIO` um pixel de cor diferente na tela. Quando o quadrado passar por cima, toque um bip agudo, conte um ponto e sorteie outro. Você acaba de inventar um jogo.
4. **Dois jogadores.** Um segundo quadrado controlado por W, A, S e D (scan codes 11h, 1Eh, 1Fh e 20h). A tabela de teclas deixa os dois andarem ao mesmo tempo; com a `INT 16h`, seria impossível.
5. **Relógio de tiques.** Troque `ESPERA_RETRACO` por uma espera de 1 tique da BIOS e compare a suavidade. Depois experimente esperar dois retraços por quadro (35 quadros por segundo).

## No livro

As técnicas desta aula se apoiam diretamente na BIOS. Para ir mais fundo:

- [Capítulo 20, A BIOS para jogos](livro:cap20): o capítulo feito para este módulo, com tempo, retraço, teclado pela INT 9, som pelo PIT e vídeo direto.
- [Capítulo 6, teclado](livro:cap06): INT 09h, INT 16h e a tabela completa de scan codes.
- [Capítulo 7, tempo](livro:cap07): INT 08h, INT 1Ch e INT 1Ah; o contador de tiques e a meia-noite.
- [Capítulo 3, vídeo I](livro:cap03): os modos de vídeo, a INT 10h, o cursor e por que os jogos pulam a BIOS para desenhar.
- [Capítulo 17, área de dados da BIOS](livro:cap17): o que há em 0040:006Ch, 0040:001Ah e vizinhanças.
- [Capítulo 2, vetores](livro:cap02): a tabela de vetores, as IRQs e o PIC.

:::resumo
- Todo jogo é um laço: **entrada** sem esperar, **atualização**, **desenho** do que mudou e **espera** do próximo passo. Só o passo 4 pode esperar.
- O ritmo vem dos **tiques da BIOS** (INT 1Ah ou 0040:006Ch, 18,2 Hz) ou do **retraço vertical** (porta 3DAh, bit 3, 70 Hz). Meça "quanto passou" com `SUB`; nunca use laço vazio de atraso.
- `INT 16h`/01h espia o buffer sem esperar (ZF = 1: vazio); a 00h tira a tecla. Para várias teclas ao mesmo tempo, uma **INT 9 própria** lê a porta 60h, anota 1 ou 0 numa tabela de 128 bytes (com `CS:`), manda o EOI (20h na porta 20h) e não chama a BIOS.
- Guarde o vetor antigo com INT 21h/35h e devolva com 25h em **toda** saída.
- Números aleatórios: LCG `semente × 25173 + 13849`, e a **parte alta** de `semente × n` para sortear de 0 a n−1. Semente inicial = relógio.
- Vídeo direto: texto em **B800h** (linha × 160 + coluna × 2, caractere e cor), modo 13h em **A000h** (y × 320 + x = y × 256 + y × 64 + x). Apague na posição antiga e desenhe na nova; sprites de 1 bit por pixel com transparência.
- Som sem travar: programe o canal 2 e ligue a porta 61h, anote o tique de fim, e deixe o laço desligar.
- Saída limpa: alto-falante desligado, vetores devolvidos, modo 03h, e só então `INT 21h`/4Ch.
:::
