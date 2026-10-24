---
id: aula29
numero: 29
modulo: 12
titulo: O timer 8253 e o alto-falante
subtitulo: Portas 40h a 43h, divisores, notas musicais, timer acelerado e medição de tempo
duracao: 90 min
objetivos: entender os três canais do PIT 8253 e a palavra de controle da porta 43h; calcular divisores com uma divisão de 32 bits; tocar notas e melodias no alto-falante pelo canal 2 e pela porta 61h; esperar um tempo exato contando os ticks da BIOS; acelerar o canal 0 sem estragar o relógio do DOS; medir o tempo de um trecho de código com o comando de latch; ler o teclado direto da porta 60h
---

## Um cristal, três contadores

Dentro do IBM PC existe um cristal de **14,31818 MHz** (quatro vezes a frequência de cor da TV americana, o que barateava o vídeo CGA). Dividido por 3, ele vira o clock de 4,77 MHz do 8088. Dividido por 12, vira **1.193.182 Hz**, a entrada de um chip pequeno e onipresente: o **8253 PIT** (*Programmable Interval Timer*). O PC AT trocou o 8253 pelo 8254, que é compatível.

O PIT tem **três contadores de 16 bits** independentes. Cada um recebe aqueles 1.193.182 pulsos por segundo, conta de um valor inicial (o **divisor**) até zero e recomeça. A cada volta completa, a saída do canal muda de estado. A frequência da saída é simplesmente:

```diagrama titulo="A regra de ouro do PIT"
                    1.193.182
   frequência  =  ─────────────          divisor de 1 a 65.536
                     divisor              (o valor 0 vale 65.536)

   divisor 65.536  →  18,2 Hz      (o relógio do DOS)
   divisor  2.711  →  440 Hz       (o lá da afinação)
   divisor  1.193  →  1.000 Hz
```

Cada canal tem um trabalho fixo no PC:

| Canal | Porta | Ligado a | Uso |
|-------|-------|----------|-----|
| 0 | 40h | IRQ 0 do PIC (INT 8) | o "tique" do relógio: 18,2 vezes por segundo |
| 1 | 41h | circuito de refresh da memória (PC/XT) | **não mexa**: a memória dinâmica precisa dele |
| 2 | 42h | alto-falante, através da porta 61h | gerar tons |
| controle | 43h | todos | a palavra de controle diz qual canal e como programar |

Na [Aula 15](aula:aula15) você usou o canal 0 sem saber: a `INT 8` que a BIOS trata e a `INT 1Ch` que você enganchou chegam 18,2 vezes por segundo porque a BIOS programa o canal 0 com o maior divisor possível.

:::cpu Por que 18,2 e não um número redondo?
1.193.182 ÷ 65.536 = 18,2065 Hz. A IBM escolheu o divisor máximo para ter o mínimo de interrupções (cada uma rouba tempo da CPU) e aceitou um número "torto". Por isso um dia tem 1.573.040 ticks (1800B0h): a BIOS conta até esse valor na palavra dupla em **0040:006Ch** e zera à meia-noite.
:::

## A palavra de controle (porta 43h)

Antes de mudar um divisor, você escreve na porta **43h** um byte que diz o que vai fazer:

```diagrama titulo="Palavra de controle do 8253"
    bit:   7   6   5   4   3   2   1   0
         ┌───────┬───────┬───────────┬───┐
         │  SC   │  RW   │   MODO    │BCD│
         └───────┴───────┴───────────┴───┘
   SC  (canal): 00 = canal 0, 01 = canal 1, 10 = canal 2
   RW  (acesso): 00 = latch (congela a contagem para ler)
                 01 = só o byte baixo
                 10 = só o byte alto
                 11 = byte baixo e depois o alto
   MODO: 010 = modo 2 (gerador de pulsos)
         011 = modo 3 (onda quadrada)
   BCD:  0 = contagem binária (sempre use 0)

   36h = 00 11 011 0  →  canal 0, baixo+alto, modo 3
   B6h = 10 11 011 0  →  canal 2, baixo+alto, modo 3
```

Depois da palavra de controle, o divisor vai pela porta do canal, **byte baixo primeiro**:

```asm fragmento
        MOV  AL, 0B6h       ; canal 2, baixo e alto, modo 3 (onda quadrada)
        OUT  43h, AL
        MOV  AX, 2711       ; divisor para 440 Hz
        OUT  42h, AL        ; byte baixo
        MOV  AL, AH
        OUT  42h, AL        ; byte alto: agora o canal 2 recomeça com o novo valor
```

:::atencao OUT só aceita AL, AX e portas até 255 imediatas
`OUT 42h,AH` não existe: o 8086 só faz `OUT` a partir de AL ou AX. Por isso o `MOV AL,AH` entre as duas escritas. E para portas acima de FFh (como as da paleta da VGA, a partir de 3C8h) a porta precisa estar em DX.
:::

Os modos que importam no PC são dois. O **modo 3** gera uma **onda quadrada**: a saída fica metade do tempo em 1 e metade em 0, perfeita para som. O **modo 2** gera um pulso curto a cada volta, bom para interrupções e para medir tempo. A BIOS usa o modo 3 no canal 0 e no canal 2.

## Fazendo barulho: o alto-falante

O alto-falante do PC é o dispositivo de som mais simples possível: um alto-falante ligado a um único bit. Dois bits da porta **61h** (que pertence ao chip 8255 de periféricos) o controlam:

```diagrama titulo="Porta 61h e o alto-falante"
                    bit 0 (gate)              bit 1 (dados)
                        │                         │
   1,19 MHz ──► [ canal 2 do PIT ] ──saída──► [ AND ] ──► amplificador ──► alto-falante

   bit 0 = 1: o canal 2 conta (sem isso ele fica parado)
   bit 1 = 1: a saída do canal 2 chega ao alto-falante
   os dois ligados (OR AL,3): o tom do divisor toca
```

Os outros bits da porta 61h controlam outras coisas (no PC/XT, por exemplo, o teclado e a paridade da memória). Por isso **nunca escreva um valor fixo**: leia, mude só os dois bits e escreva de volta.

```asm fragmento
        IN   AL, 61h
        OR   AL, 3          ; liga o gate e o alto-falante
        OUT  61h, AL
        ; ... o som continua sozinho, sem a CPU fazer nada ...
        IN   AL, 61h
        AND  AL, 0FCh       ; desliga os bits 0 e 1 (1111 1100)
        OUT  61h, AL
```

Repare na beleza: depois de ligado, **o PIT toca sozinho**. A CPU fica livre para fazer outra coisa, e o som só para quando você desliga os bits.

## Calculando o divisor: uma divisão de 32 bits

O divisor é 1.193.182 ÷ frequência. Mas 1.193.182 não cabe em 16 bits: é **0012h:34DEh** em 32 bits. Isso é exatamente o que `DIV` de 16 bits sabe fazer, com o dividendo em DX:AX (você viu na [Aula 21](aula:aula21)):

```asm fragmento
; BX = frequência em Hz  →  AX = divisor
        MOV  DX, 0012h
        MOV  AX, 34DEh      ; DX:AX = 1.193.182
        DIV  BX             ; AX = 1.193.182 / BX
```

:::atencao A frequência mínima é 19 Hz
O quociente precisa caber em AX. Com BX = 18, o resultado seria 66.287, maior que 65.535: o `DIV` gera a interrupção 0 e o programa morre com *Divide overflow*. Frequências abaixo de 19 Hz não são tons audíveis mesmo, então verifique antes de dividir.
:::

As notas da escala, na oitava do dó central:

| Nota | Frequência | Divisor |
|------|-----------|---------|
| dó (C4) | 262 Hz | 4.554 |
| ré (D4) | 294 Hz | 4.058 |
| mi (E4) | 330 Hz | 3.615 |
| fá (F4) | 349 Hz | 3.418 |
| sol (G4) | 392 Hz | 3.043 |
| lá (A4) | 440 Hz | 2.711 |
| si (B4) | 494 Hz | 2.415 |
| dó (C5) | 523 Hz | 2.281 |

Cada oitava acima dobra a frequência (e corta o divisor pela metade).

## Esperando um tempo exato

Para tocar uma nota por meio segundo, é preciso **esperar** meio segundo. Um laço vazio de 10.000 voltas não serve: ele demora um tempo num 8088 de 4,77 MHz e um décimo disso num 386. A solução que funciona em qualquer PC é contar os **ticks da BIOS** na palavra em **0040:006Ch**, que a `INT 8` incrementa 18,2 vezes por segundo:

```asm fragmento
; ESPERAR: espera CX ticks (1 tick = 1/18,2 s, cerca de 55 ms)
ESPERAR PROC
        PUSH AX
        PUSH BX
        PUSH ES
        MOV  AX, 40h
        MOV  ES, AX
        MOV  BX, ES:[6Ch]   ; tick em que começamos
@@laco: MOV  AX, ES:[6Ch]
        SUB  AX, BX         ; quantos ticks já passaram
        CMP  AX, CX
        JB   @@laco
        POP  ES
        POP  BX
        POP  AX
        RET
ESPERAR ENDP
```

O truque do `SUB` é calcular **quanto passou** em vez de comparar com um "tick final". Assim a conta continua certa mesmo quando o contador dá a volta (a subtração de 16 bits é circular, como você viu na aula de complemento de dois).

:::dica Interrupções ligadas
A espera só termina se a `INT 8` estiver acontecendo. Se o seu código fizer `CLI` e esquecer o `STI`, o tick nunca muda e o programa trava. No simulador, o timer está ligado no laboratório e nos exemplos; nos exercícios que dependem dele, o enunciado avisa.
:::

Juntando tudo: uma nota de meio segundo (9 ticks).

```asm executar titulo="NOTA.ASM: um lá de 440 Hz por meio segundo"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AL, 0B6h       ; canal 2, baixo e alto, modo 3
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh      ; DX:AX = 1.193.182
        MOV  BX, 440
        DIV  BX             ; AX = divisor (2711)
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL

        IN   AL, 61h        ; liga o alto-falante
        OR   AL, 3
        OUT  61h, AL

        MOV  CX, 9          ; 9 ticks = meio segundo
        CALL ESPERAR

        IN   AL, 61h        ; desliga
        AND  AL, 0FCh
        OUT  61h, AL

        MOV  AX, 4C00h
        INT  21h

ESPERAR PROC
        PUSH AX
        PUSH BX
        PUSH ES
        MOV  AX, 40h
        MOV  ES, AX
        MOV  BX, ES:[6Ch]
@@laco: MOV  AX, ES:[6Ch]
        SUB  AX, BX
        CMP  AX, CX
        JB   @@laco
        POP  ES
        POP  BX
        POP  AX
        RET
ESPERAR ENDP
END inicio
```

Rode no laboratório com o som do computador ligado: o simulador toca de verdade o tom que o canal 2 está gerando.

:::atencao Sempre desligue o alto-falante
Se o programa terminar (ou travar) com os bits 0 e 1 da porta 61h ligados, o tom continua tocando **depois** que você volta ao DOS, até alguém reiniciar o PC ou outro programa desligar. Quem usou PC nos anos 90 lembra de um ou outro jogo que travava e deixava um apito eterno no ar.
:::

## Uma melodia

Com uma tabela de notas e durações, tocar música vira um laço. Este é o começo da *Ode à Alegria*, de Beethoven:

```asm executar titulo="MUSICA.ASM: Ode à Alegria no alto-falante"
.MODEL SMALL
.STACK 100h
.DATA
; pares (frequência, duração em ticks); frequência 0 termina
musica  DW 330,4, 330,4, 349,4, 392,4, 392,4, 349,4, 330,4, 294,4
        DW 262,4, 262,4, 294,4, 330,4, 330,6, 294,2, 294,8
        DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET musica
        CLD
@@nota: LODSW               ; AX = frequência
        TEST AX, AX
        JZ   @@fim
        MOV  BX, AX
        LODSW
        MOV  CX, AX         ; CX = duração
        CALL TOCAR
        DEC  CX             ; o último tick fica em silêncio,
        CALL ESPERAR        ; para separar notas iguais
        CALL SILENCIO
        MOV  CX, 1
        CALL ESPERAR
        JMP  @@nota
@@fim:  CALL SILENCIO
        MOV  AX, 4C00h
        INT  21h

; TOCAR: liga o alto-falante na frequência BX (19 Hz ou mais)
TOCAR   PROC
        PUSH AX
        PUSH DX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        POP  DX
        POP  AX
        RET
TOCAR   ENDP

; SILENCIO: desliga o alto-falante sem mexer nos outros bits da porta 61h
SILENCIO PROC
        PUSH AX
        IN   AL, 61h
        AND  AL, 0FCh
        OUT  61h, AL
        POP  AX
        RET
SILENCIO ENDP

; ESPERAR: espera CX ticks da BIOS
ESPERAR PROC
        PUSH AX
        PUSH BX
        PUSH ES
        MOV  AX, 40h
        MOV  ES, AX
        MOV  BX, ES:[6Ch]
@@laco: MOV  AX, ES:[6Ch]
        SUB  AX, BX
        CMP  AX, CX
        JB   @@laco
        POP  ES
        POP  BX
        POP  AX
        RET
ESPERAR ENDP
END inicio
```

A pausa de um tick entre as notas não é enfeite: sem ela, duas notas iguais seguidas viram uma nota só, comprida.

:::anos90 Música com um bit
O alto-falante só sabe ficar "ligado" ou "desligado", e mesmo assim os programadores tiraram muito dele. Uma técnica comum nos jogos era alternar notas muito depressa, várias por décimo de segundo, para dar a ilusão de acordes. Outra, bem mais ousada, era ligar e desligar o alto-falante milhares de vezes por segundo com larguras de pulso diferentes, tocando som digitalizado (vozes, até música) num hardware que nunca foi feito para isso. Custava quase toda a CPU, mas funcionava. Quando as placas de som ficaram baratas, o alto-falante voltou a ser só o "bip" da BIOS.
:::

```quiz
? Qual divisor faz o canal 2 tocar 1.000 Hz?
- 1.000
+ 1.193
- 65.536
> Divisor = 1.193.182 ÷ 1.000 = 1.193 (a parte fracionária se perde no DIV).

? Por que o divisor vai para o canal em duas escritas de OUT na mesma porta?
+ Porque a porta é de 8 bits e a palavra de controle pediu byte baixo e depois byte alto
- Porque o canal 2 tem dois contadores
- Porque OUT de 16 bits não existe no 8086
> Com RW = 11 na palavra de controle, o 8253 espera o byte baixo e depois o alto, na mesma porta. OUT DX,AX existe, mas escreveria nas portas 42h e 43h.

? O que acontece se você fizer MOV AL,3 / OUT 61h,AL para ligar o som?
- Funciona igual a OR AL,3
+ Liga o som, mas zera os outros bits da porta 61h, que controlam outros circuitos
- O 8086 não permite escrever na porta 61h
> A porta 61h é compartilhada. Leia, mude só os bits 0 e 1, e escreva de volta.

? Por que contar os ticks da BIOS em vez de um laço vazio de atraso?
+ Porque os ticks têm a mesma duração em qualquer PC; o laço depende da velocidade da CPU
- Porque o laço vazio não funciona no 8086
- Porque os ticks são mais precisos que 1 microssegundo
> Um tick dura sempre cerca de 55 ms. O laço vazio fica mais rápido em cada geração de processador, um bug clássico dos jogos da época.
```

## Acelerando o canal 0

Um tick de 55 ms é grosso demais para muita coisa: um jogo que quer atualizar a música 70 vezes por segundo, ou um programa que quer medir milissegundos. A saída é reprogramar o **canal 0** com um divisor menor, para a `INT 8` acontecer mais vezes.

Mas cuidado: a `INT 8` da BIOS conta o relógio do DOS e desliga o motor do disquete depois de alguns segundos. Se ela for chamada 4 vezes mais depressa, o relógio do DOS anda 4 vezes mais rápido. A solução clássica:

1. Instalar a sua própria `INT 8`.
2. Programar o canal 0 com um divisor N vezes menor.
3. Na sua rotina, fazer o seu trabalho e chamar a `INT 8` antiga **só a cada N vezes**. Nas outras, mandar você mesmo o EOI para o PIC.
4. No fim, devolver o divisor 0 (65.536) e o vetor original.

```asm executar titulo="TURBO.ASM: timer 4 vezes mais rápido, relógio do DOS intacto"
.MODEL SMALL
.STACK 100h
.DATA
antigo8 DD ?
rapidas DW 0                ; quantas vezes a nossa INT 8 rodou
fracao  DB 0
inicio_t DW ?
t_rap   DB 'Interrupcoes rapidas: $'
t_bios  DB 13, 10, 'Ticks da BIOS:       $'
.CODE
; nossa INT 8: chamada 72,8 vezes por segundo
NOVO8   PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        INC  rapidas
        INC  fracao
        TEST fracao, 3          ; uma em cada quatro vezes...
        JNZ  @@so_eoi
        PUSHF                   ; ...chama a INT 8 da BIOS (simula um INT)
        CALL antigo8            ; ela conta o relógio e manda o EOI
        JMP  @@sai
@@so_eoi:
        MOV  AL, 20h            ; nas outras, o EOI é nosso
        OUT  20h, AL
@@sai:  POP  DS
        POP  AX
        IRET
NOVO8   ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3508h          ; guarda o vetor da INT 8
        INT  21h
        MOV  WORD PTR antigo8, BX
        MOV  WORD PTR antigo8+2, ES
        PUSH DS
        MOV  AX, SEG NOVO8
        MOV  DS, AX
        MOV  DX, OFFSET NOVO8
        MOV  AX, 2508h
        INT  21h
        POP  DS

        CLI
        MOV  AL, 36h            ; canal 0, baixo e alto, modo 3
        OUT  43h, AL
        MOV  AX, 16384          ; 65.536 / 4
        OUT  40h, AL
        MOV  AL, AH
        OUT  40h, AL
        STI

        MOV  AX, 40h            ; espera 5 ticks da BIOS
        MOV  ES, AX
        MOV  BX, ES:[6Ch]
        MOV  inicio_t, BX
@@espera:
        MOV  AX, ES:[6Ch]
        SUB  AX, BX
        CMP  AX, 5
        JB   @@espera

        CLI
        MOV  AL, 36h            ; devolve o divisor original (0 = 65.536)
        OUT  43h, AL
        XOR  AL, AL
        OUT  40h, AL
        OUT  40h, AL
        PUSH DS
        LDS  DX, antigo8        ; devolve o vetor original
        MOV  AX, 2508h
        INT  21h
        POP  DS
        STI

        MOV  AH, 09h
        MOV  DX, OFFSET t_rap
        INT  21h
        MOV  AX, rapidas
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        MOV  DX, OFFSET t_bios
        INT  21h
        MOV  AX, ES:[6Ch]
        SUB  AX, inicio_t
        CALL IMPRIMIR_NUMERO
        MOV  AX, 4C00h
        INT  21h

IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        TEST AX, AX
        JNZ  @@divide
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP
END inicio
```

Em 5 ticks da BIOS, a nossa rotina roda cerca de 20 vezes. O relógio do DOS continua certo porque a BIOS só vê uma em cada quatro interrupções.

:::cpu PUSHF + CALL FAR = INT
Para chamar uma rotina de interrupção como se fosse um `INT`, a pilha precisa ter FLAGS, CS e IP, porque ela termina com `IRET`. `PUSHF` empilha as flags e `CALL DWORD PTR` empilha CS e IP: o `IRET` da BIOS desempilha os três e volta para depois do `CALL`. É a mesma técnica de encadeamento da Aula 15.
:::

:::atencao Um divisor por vez, com as interrupções desligadas
Entre o byte baixo e o byte alto, o canal está "meio programado". Se uma interrupção chegar no meio e alguém mexer no PIT (a BIOS ou outro programa residente), a sequência se embaralha. Por isso o `CLI` / `STI` em volta das escritas.
:::

## Medindo tempo com o latch

Os ticks dão a resolução de 55 ms. O próprio contador do canal 0, que desce de 65.536 a 0 a cada tick, dá resolução de **0,838 microssegundo** (1 / 1.193.182 s). Ler o contador "andando" é arriscado: entre a leitura do byte baixo e a do alto ele muda. Por isso existe o comando de **latch**: a palavra de controle com RW = 00 congela uma cópia da contagem, e as duas leituras seguintes devolvem essa cópia.

```asm fragmento
; LER_PIT: AX = contagem atual do canal 0
LER_PIT PROC
        MOV  AL, 00h        ; canal 0, RW = 00: latch
        OUT  43h, AL
        IN   AL, 40h        ; byte baixo da cópia congelada
        MOV  AH, AL
        IN   AL, 40h        ; byte alto
        XCHG AH, AL         ; AX = alto:baixo
        RET
LER_PIT ENDP
```

No **modo 3**, o 8253 desce a contagem de 2 em 2, o que complica a conta. Por isso as ferramentas de medição da época, como o "Zen Timer" que Michael Abrash publicou nos seus livros de otimização, reprogramavam o canal 0 no **modo 2** (palavra 34h), em que a contagem desce de 1 em 1, e o devolviam ao modo 3 no fim.

```asm executar titulo="MEDIR.ASM: quanto tempo leva um laço de 100 voltas?"
.MODEL SMALL
.STACK 100h
.DATA
antes   DW ?
t_cont  DB 'Contagens do PIT: $'
t_us    DB ' (cerca de $'
t_fim   DB ' microssegundos)$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        CLI
        MOV  AL, 34h        ; canal 0 no modo 2, para contar de 1 em 1
        OUT  43h, AL
        XOR  AL, AL         ; divisor 0 = 65.536 (o relógio continua igual)
        OUT  40h, AL
        OUT  40h, AL
        STI

        CALL LER_PIT
        MOV  antes, AX
        MOV  CX, 100        ; o trecho que vamos medir
@@laco: LOOP @@laco
        CALL LER_PIT
        MOV  BX, antes
        SUB  BX, AX         ; o contador desce: antes - depois

        CLI
        MOV  AL, 36h        ; devolve o modo 3
        OUT  43h, AL
        XOR  AL, AL
        OUT  40h, AL
        OUT  40h, AL
        STI

        MOV  AH, 09h
        MOV  DX, OFFSET t_cont
        INT  21h
        MOV  AX, BX
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        MOV  DX, OFFSET t_us
        INT  21h
        MOV  AX, BX         ; microssegundos = contagens * 838 / 1000
        MOV  CX, 838
        MUL  CX
        MOV  CX, 1000
        DIV  CX
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        MOV  DX, OFFSET t_fim
        INT  21h
        MOV  AX, 4C00h
        INT  21h

LER_PIT PROC
        MOV  AL, 00h
        OUT  43h, AL
        IN   AL, 40h
        MOV  AH, AL
        IN   AL, 40h
        XCHG AH, AL
        RET
LER_PIT ENDP

IMPRIMIR_NUMERO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        TEST AX, AX
        JNZ  @@divide
@@mostra:
        POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@mostra
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
IMPRIMIR_NUMERO ENDP
END inicio
```

O laço de 100 `LOOP` gasta cerca de 1.700 ciclos (17 por volta, como você contou na [Aula 17](aula:aula17)). Somando o `CALL`, o `OUT` e os `IN` da própria medição, o programa mostra umas 440 contagens do PIT, perto de 370 microssegundos a 4,77 MHz. Para descontar esse custo fixo, as ferramentas de medição mediam também um trecho vazio e subtraíam. No simulador, o contador desce 1 a cada 4 ciclos da CPU, que é a relação real entre os dois clocks do PC original.

:::dica Meça várias vezes
Uma interrupção que chega no meio da medição soma o tempo dela ao seu. Profissionais mediam o mesmo trecho várias vezes e ficavam com o menor valor, ou desligavam as interrupções durante a medida (por pouco tempo: menos de um tick, ou o relógio atrasa).
:::

## O teclado pela porta 60h

O teclado também é hardware direto. Cada tecla apertada manda um **scan code** que fica na porta **60h**, e a soltura manda o mesmo código com o bit 7 ligado (Esc = 01h ao apertar, 81h ao soltar). Normalmente a `INT 9` da BIOS lê essa porta e traduz para ASCII, mas um programa pode simplesmente olhar a porta:

```asm executar titulo="PORTA60.ASM: espera o Esc lendo o hardware" entrada="{ESC}"
.MODEL SMALL
.STACK 100h
.DATA
t_aviso DB 'Aperte Esc...$'
t_ok    DB 13, 10, 'Esc detectado na porta 60h.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AH, 09h
        MOV  DX, OFFSET t_aviso
        INT  21h
@@espera:
        IN   AL, 60h        ; último scan code do teclado
        CMP  AL, 01h        ; Esc apertado?
        JNE  @@espera
        MOV  AH, 0          ; tira o Esc do buffer da BIOS
        INT  16h
        MOV  AH, 09h
        MOV  DX, OFFSET t_ok
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Os jogos usavam essa ideia para saber se **várias** teclas estão apertadas ao mesmo tempo, coisa que a `INT 16h` não diz. Na [Aula 28](aula:aula28) você vai enganchar a `INT 9` e tratar o teclado por completo.

:::atencao O buffer continua enchendo
Ler a porta 60h não impede a BIOS de também tratar a tecla. Se o programa ignorar o buffer, ele enche e a BIOS começa a apitar a cada tecla. Por isso o `INT 16h` depois do laço.
:::

```quiz
? Por que a nossa INT 8 acelerada só chama a INT 8 da BIOS a cada quatro vezes?
+ Para o relógio do DOS e os ticks em 0040:006Ch continuarem andando a 18,2 Hz
- Porque a BIOS não aceita ser chamada mais de 18 vezes por segundo
- Para economizar memória da pilha
> A INT 8 da BIOS soma 1 tick a cada chamada. Chamando-a só em uma de cada quatro, o relógio não percebe a aceleração.

? Nas três vezes em que não chama a BIOS, o que a rotina precisa fazer antes do IRET?
- Nada
+ Mandar o EOI (MOV AL,20h / OUT 20h,AL)
- Desligar o alto-falante
> Sem o EOI, o PIC acha que a IRQ 0 ainda está sendo atendida e não manda mais nenhuma interrupção do timer.

? Para que serve o comando de latch (palavra de controle com RW = 00)?
+ Congelar uma cópia da contagem para ler os dois bytes sem que ela mude no meio
- Parar o canal 0 até a próxima escrita
- Ligar o alto-falante
> O contador continua descendo; só a cópia lida fica parada até você ler os dois bytes.

? Qual o scan code que a porta 60h mostra quando o Esc é solto?
- 01h
+ 81h
- 1Bh
> A soltura liga o bit 7: 01h + 80h = 81h. 1Bh é o código ASCII do Esc, que só existe depois da tradução da BIOS.
```

## Exercícios

Os exercícios conferem o que o seu programa deixou no PIT e na porta 61h, e quais frequências o alto-falante tocou.

```exercicio
id: a29-1
titulo: Toque uma nota
nivel: 1
exigir: OUT
--- enunciado
BX chega com uma frequência entre 19 e 20.000 Hz. Programe o **canal 2** do PIT (modo 3) com o divisor certo e **ligue** o alto-falante, deixando-o tocando quando o programa terminar.
--- inicial
; BX = frequência em Hz
; programe o canal 2 e ligue o alto-falante
--- testes
[{ "nome": "lá de 440 Hz", "setup": { "BX": 440 }, "espera": { "portas": { "pit2": 2711, "61": 3 }, "notas": [440] } },
 { "nome": "1.000 Hz", "setup": { "BX": 1000 }, "espera": { "portas": { "pit2": 1193, "61": 3 }, "notas": [1000] } },
 { "nome": "dó de 262 Hz", "setup": { "BX": 262 }, "espera": { "portas": { "pit2": 4554, "61": 3 }, "notas": [262] } }]
--- dicas
A palavra de controle do canal 2, byte baixo e alto, modo 3, é B6h, na porta 43h.
O divisor é 1.193.182 / BX: DX = 0012h, AX = 34DEh, DIV BX.
Mande AL e depois AH (via MOV AL,AH) para a porta 42h.
Para ligar: IN AL,61h / OR AL,3 / OUT 61h,AL.
--- solucao
; BX = frequência em Hz
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
```

```exercicio
id: a29-2
titulo: Bipe com duração
nivel: 2
timer: sim
--- enunciado
Toque a frequência BX durante **CX ticks** da BIOS e depois **desligue** o alto-falante. No fim, **DX** deve conter quantos ticks passaram entre ligar e desligar o som (que deve ser exatamente CX). A rotina **TOCAR** (liga o som na frequência BX) já está pronta.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL TOCAR
        ; espere CX ticks, desligue o som e deixe em DX os ticks passados
        MOV  AX, 4C00h
        INT  21h

; TOCAR: liga o alto-falante na frequência BX
TOCAR   PROC
        PUSH AX
        PUSH DX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        POP  DX
        POP  AX
        RET
TOCAR   ENDP
END inicio
--- testes
[{ "nome": "880 Hz por 2 ticks", "setup": { "BX": 880, "CX": 2 }, "espera": { "notas": [880], "portas": { "61": 0 }, "DX": 2 } },
 { "nome": "330 Hz por 3 ticks", "setup": { "BX": 330, "CX": 3 }, "espera": { "notas": [330], "portas": { "61": 0 }, "DX": 3 } },
 { "nome": "1.000 Hz por 1 tick", "setup": { "BX": 1000, "CX": 1 }, "espera": { "notas": [1000], "portas": { "61": 0 }, "DX": 1 } }]
--- dicas
Os ticks estão na word em 0040:006Ch. Carregue ES com 40h (via AX).
Guarde o tick inicial num registrador e repita: tick atual − inicial, compare com CX, JB volta.
O resultado da subtração, quando o laço termina, já é o DX pedido.
Para desligar: IN AL,61h / AND AL,0FCh / OUT 61h,AL. Cuidado para não estragar DX depois.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: CALL TOCAR
        MOV  AX, 40h
        MOV  ES, AX
        MOV  BX, ES:[6Ch]   ; tick inicial
@@espera:
        MOV  DX, ES:[6Ch]
        SUB  DX, BX
        CMP  DX, CX
        JB   @@espera
        IN   AL, 61h
        AND  AL, 0FCh
        OUT  61h, AL
        MOV  AX, 4C00h
        INT  21h

; TOCAR: liga o alto-falante na frequência BX
TOCAR   PROC
        PUSH AX
        PUSH DX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        POP  DX
        POP  AX
        RET
TOCAR   ENDP
END inicio
```

```exercicio
id: a29-3
titulo: Tocador de músicas
nivel: 2
timer: sim
--- enunciado
A variável **musica** tem uma lista de frequências (words) terminada por **0**. Toque cada uma durante **2 ticks**, na ordem, e deixe o alto-falante **desligado** no fim (também quando a lista estiver vazia). As rotinas **TOCAR**, **SILENCIO** e **ESPERAR** já estão prontas.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
musica  DW 262, 330, 392, 523, 0
        DW 16 DUP(0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; toque a música aqui
        MOV  AX, 4C00h
        INT  21h

; TOCAR: liga o alto-falante na frequência BX
TOCAR   PROC
        PUSH AX
        PUSH DX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        POP  DX
        POP  AX
        RET
TOCAR   ENDP

; SILENCIO: desliga o alto-falante
SILENCIO PROC
        PUSH AX
        IN   AL, 61h
        AND  AL, 0FCh
        OUT  61h, AL
        POP  AX
        RET
SILENCIO ENDP

; ESPERAR: espera CX ticks da BIOS
ESPERAR PROC
        PUSH AX
        PUSH BX
        PUSH ES
        MOV  AX, 40h
        MOV  ES, AX
        MOV  BX, ES:[6Ch]
@@laco: MOV  AX, ES:[6Ch]
        SUB  AX, BX
        CMP  AX, CX
        JB   @@laco
        POP  ES
        POP  BX
        POP  AX
        RET
ESPERAR ENDP
END inicio
--- testes
[{ "nome": "arpejo de dó", "espera": { "notas": [262, 330, 392, 523], "portas": { "61": 0 } } },
 { "nome": "outra melodia", "setup": { "musica": [440, 494, 440, 392, 0] }, "espera": { "notas": [440, 494, 440, 392], "portas": { "61": 0 } } },
 { "nome": "lista vazia", "setup": { "musica": [0] }, "espera": { "notas": [], "portas": { "61": 0 } } }]
--- dicas
SI = OFFSET musica, CLD e LODSW em laço. Se AX = 0, acabou.
Para cada nota: MOV BX,AX / CALL TOCAR / MOV CX,2 / CALL ESPERAR.
Só chame SILENCIO depois do laço (ou depois de cada nota, tanto faz).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
musica  DW 262, 330, 392, 523, 0
        DW 16 DUP(0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET musica
        CLD
@@nota: LODSW
        TEST AX, AX
        JZ   @@fim
        MOV  BX, AX
        CALL TOCAR
        MOV  CX, 2
        CALL ESPERAR
        JMP  @@nota
@@fim:  CALL SILENCIO
        MOV  AX, 4C00h
        INT  21h

; TOCAR: liga o alto-falante na frequência BX
TOCAR   PROC
        PUSH AX
        PUSH DX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
        OUT  42h, AL
        MOV  AL, AH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        POP  DX
        POP  AX
        RET
TOCAR   ENDP

; SILENCIO: desliga o alto-falante
SILENCIO PROC
        PUSH AX
        IN   AL, 61h
        AND  AL, 0FCh
        OUT  61h, AL
        POP  AX
        RET
SILENCIO ENDP

; ESPERAR: espera CX ticks da BIOS
ESPERAR PROC
        PUSH AX
        PUSH BX
        PUSH ES
        MOV  AX, 40h
        MOV  ES, AX
        MOV  BX, ES:[6Ch]
@@laco: MOV  AX, ES:[6Ch]
        SUB  AX, BX
        CMP  AX, CX
        JB   @@laco
        POP  ES
        POP  BX
        POP  AX
        RET
ESPERAR ENDP
END inicio
```

```exercicio
id: a29-4
titulo: Timer sob medida
nivel: 2
exigir: OUT
--- enunciado
BX chega com a frequência desejada para a interrupção do timer (IRQ 0), em Hz. Programe o **canal 0** em modo 3 (palavra 36h) com o divisor 1.193.182 / BX. Se BX for **menor que 19**, a divisão estouraria: nesse caso programe o divisor mais lento possível, **0** (que vale 65.536).
--- inicial
; BX = interrupções por segundo desejadas
; programe o canal 0 do PIT
--- testes
[{ "nome": "100 Hz", "setup": { "BX": 100 }, "espera": { "portas": { "pit0": 11931 } } },
 { "nome": "1.000 Hz", "setup": { "BX": 1000 }, "espera": { "portas": { "pit0": 1193 } } },
 { "nome": "60 Hz", "setup": { "BX": 60 }, "espera": { "portas": { "pit0": 19886 } } },
 { "nome": "19 Hz ainda cabe", "setup": { "BX": 19 }, "espera": { "portas": { "pit0": 62799 } } },
 { "nome": "18 Hz: divisor 0", "setup": { "BX": 18 }, "espera": { "portas": { "pit0": 65536 } } },
 { "nome": "1 Hz: divisor 0", "setup": { "BX": 1 }, "espera": { "portas": { "pit0": 65536 } } }]
--- dicas
Compare BX com 19 antes de dividir. Se for menor, use AX = 0 como divisor e pule o DIV.
O canal 0 usa a porta 40h. A palavra de controle 36h vai para a porta 43h.
Faça as escritas entre CLI e STI.
--- solucao
; BX = interrupções por segundo desejadas
        XOR  AX, AX         ; divisor 0 = 65.536
        CMP  BX, 19
        JB   @@programa
        MOV  DX, 0012h
        MOV  AX, 34DEh
        DIV  BX
@@programa:
        CLI
        MOV  CX, AX
        MOV  AL, 36h
        OUT  43h, AL
        MOV  AL, CL
        OUT  40h, AL
        MOV  AL, CH
        OUT  40h, AL
        STI
```

:::resumo
- O PIT 8253 recebe 1.193.182 Hz e tem três canais: 0 (IRQ 0, 18,2 Hz), 1 (refresh da memória, não mexa) e 2 (alto-falante).
- Frequência = 1.193.182 ÷ divisor. O divisor se calcula com `DIV` de 32 bits (DX:AX = 0012h:34DEh) e só cabe para frequências de 19 Hz para cima.
- Programe com a palavra de controle na porta 43h (36h para o canal 0, B6h para o canal 2) e o divisor na porta do canal, byte baixo primeiro.
- Os bits 0 e 1 da porta 61h ligam o alto-falante. Leia, mude só esses bits e escreva de volta. Sempre desligue antes de sair.
- Espere tempos com os ticks em 0040:006Ch, calculando "quanto passou" com `SUB`.
- Para acelerar o canal 0, instale a sua INT 8, chame a da BIOS só a cada N vezes e mande o EOI nas outras. Restaure divisor e vetor no fim.
- O comando de latch congela a contagem para leituras precisas; no modo 2 ela desce de 1 em 1.
- A porta 60h mostra o último scan code; a soltura liga o bit 7.
:::
