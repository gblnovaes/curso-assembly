---
id: cap20
numero: 20
parte: 7
titulo: "A BIOS para jogos"
aulas: aula32; aula33; aula34; aula35; aula36; aula37; aula38; aula39
---

# Capítulo 20 · A BIOS para jogos

> **Neste capítulo:** o que a BIOS oferece a um jogo e onde ela é lenta ou limitada demais; o
> tempo (o tique em `40:6C`, `INT 1AH`, `INT 1CH`, o canal 0 do PIT acelerado sem estragar o
> relógio e o retraço na porta `3DAH`); o teclado (`INT 16H` sem bloquear, o buffer em
> `40:1A`/`40:1C`, uma `INT 09H` própria com tabela de teclas e a `INT 15H, AH=4FH`); o vídeo
> (`INT 10H` só para trocar de modo, escrita direta em `B800H` e `A000H`, paleta, cursor e
> páginas); o som sem travar o jogo; números aleatórios; o joystick; e a lista do que restaurar
> na saída. No fim, uma tabela mostra o que cada jogo do curso usa.
>
> **Antes de ler:** [Aula 32, Fundamentos de jogos](../conteudo/aula32-jogos-fundamentos.md),
> [Aula 24, Paleta, retraço e animação](../conteudo/aula24-paleta-animacao.md),
> [Aula 28, O teclado por dentro](../conteudo/aula28-tsr-teclado.md) e
> [Aula 29, O timer 8253 e o alto-falante](../conteudo/aula29-pit-som.md).

## 20.1 O que a BIOS faz por um jogo, e o que ela não faz

Um jogo de ação tem um laço que se repete dezenas de vezes por segundo: **ler a entrada**,
**atualizar** o mundo, **desenhar** o que mudou e **esperar** o próximo quadro. A BIOS tem uma
função para quase cada uma dessas etapas, mas foi pensada para programas que escrevem texto e
esperam o usuário, não para 70 quadros por segundo.

| Etapa | O que a BIOS oferece | Por que um jogo vai além |
|---|---|---|
| Entrada | `INT 16H`: a próxima tecla do buffer | só uma tecla por vez, com repetição automática lenta; não diz quais teclas estão **apertadas agora** |
| Tempo | tique de ~55 ms em `40:6C` | 18,2 Hz é pouco para movimento suave |
| Vídeo | `INT 10H`: modo, cursor, caractere, pixel | `AH=0CH` desenha **um** pixel com centenas de ciclos de sobrecarga; escrever na memória de vídeo é dezenas de vezes mais rápido |
| Som | nada além do bipe do caractere 7 | o canal 2 do PIT toca qualquer nota |
| Espera | `INT 15H, AH=86H` (só AT e posteriores) | trava o programa inteiro; o jogo precisa continuar enquanto espera |

A regra dos jogos do curso: **a BIOS prepara e arruma** (modo, cursor, relógio, teclas quando uma
por vez basta) e **o laço principal vai direto ao hardware**. Ir ao hardware custa compatibilidade
([Capítulo 19](cap19-diretrizes-e-compatibilidade.md)): só onde a velocidade exige, e deixando
tudo como estava ao sair.

## 20.2 Tempo

### O tique da BIOS: 40:6C e INT 1AH

A `INT 08H` da BIOS soma 1 na palavra dupla `40:6C` cerca de 18,2 vezes por segundo
([Capítulo 7](cap07-tempo-e-relogios.md)). Para um jogo, só a **palavra baixa** interessa: ela
dá a volta a cada hora, e a subtração sem sinal continua certa mesmo na volta
(`0003H - FFFEH = 0005H`).

Os jogos do curso leem o contador com `INT 1AH, AH=00H` (rotina `LE_RELOGIO`, que devolve `DX`
em `AX`) e medem intervalos guardando o tique do último passo: `ESPERA_PASSO` da cobra repete
`LE_RELOGIO` / `SUB AX, ultimo_tique` até a diferença chegar ao número de tiques do passo.

> **INT 1AH ou 40:6C?** A `INT 1AH, AH=00H` **zera o flag de meia-noite** (`40:70`) e o devolve
> em `AL`; quem a chama e ignora `AL` faz o DOS perder a virada do dia. Num jogo que roda por
> minutos isso quase nunca acontece, mas ler `40:6C` diretamente evita o problema e é mais
> rápido. O esqueleto da seção 20.9 faz assim.

### INT 1CH: o gancho de cada tique

Trabalho **periódico** (a próxima nota de uma música, o tempo da partida) pode ir num gancho da
`INT 1CH`, com as regras do Capítulo 7 (curta, `CS:`, sem `INT 21H`, encadeando o vetor anterior).
Nenhum jogo do curso precisa dela; ela aparece no relógio residente da [Aula 27](../conteudo/aula27-tsr.md).

### Mais tiques: o canal 0 do PIT acelerado

O tique de 55 ms vem do divisor 65536 no canal 0 do PIT. Com o divisor 16384, a `INT 08H`
acontece 4 vezes mais (72,8 Hz); com 19886, perto de 60 Hz. O problema é que a BIOS
continua somando 1 em `40:6C` a cada interrupção, e o relógio do DOS adiantaria 4 vezes. A
solução clássica é a sua rotina tomar a `INT 08H` e só **passar a vez** para a rotina original
uma vez a cada 4 interrupções; nas outras, ela mesma manda o fim de interrupção (EOI) ao PIC:

```asm fragmento titulo="Canal 0 a 72,8 Hz sem adiantar o relógio do DOS"
FATOR   EQU 4                   ; 65536 / 4 = 16384
        ; (antes: AH=35h guarda o vetor da INT 8 em int8_antiga; AH=25h instala NOVA_INT8)
        CLI
        MOV  AL, 36h            ; canal 0, byte baixo e alto, modo 3
        OUT  43h, AL
        MOV  AX, 65536/FATOR
        OUT  40h, AL
        MOV  AL, AH
        OUT  40h, AL
        STI
        ; ... o jogo roda; na saída: 36h, 00h, 00h (divisor 65536) e só então AH=25h ...

NOVA_INT8 PROC FAR
        INC  CS:rapidos         ; o relógio do jogo: 72,8 por segundo
        DEC  CS:resta
        JZ   @@da_bios          ; a cada FATOR tiques, um é da BIOS
        PUSH AX
        MOV  AL, 20h            ; EOI: nós atendemos esta interrupção
        OUT  20h, AL
        POP  AX
        IRET
@@da_bios:
        MOV  CS:resta, FATOR
        JMP  CS:int8_antiga     ; a BIOS soma 40:6C, chama a 1Ch e manda o EOI
NOVA_INT8 ENDP
```

Assim `rapidos` anda 4 vezes mais rápido que `40:6C`, e a hora do DOS continua certa depois
que o programa sai. Duas regras: troque o vetor **antes** de acelerar o PIT e
devolva o divisor **antes** de devolver o vetor; senão, por um instante, a BIOS recebe
interrupções rápidas demais. A [Aula 29](../conteudo/aula29-pit-som.md) faz a mesma conta na
seção "Acelerando o canal 0".

### O retraço vertical: a porta 3DAH

O monitor redesenha a tela de cima para baixo 60 ou 70 vezes por segundo (70 Hz nos modos 3 e
13H da VGA). Entre um quadro e outro, o feixe volta ao topo: é o **retraço vertical**, sinalizado
pelo **bit 3** da porta de status `3DAH` (em adaptadores monocromáticos, `3BAH`). Mexer na tela ou
na paleta durante o retraço evita a cintilação e, de quebra, dá ao jogo um relógio de 70 Hz:

```asm fragmento titulo="ESPERA_RETRACO, a mesma em pong, invasores, paredão e labirinto"
ESPERA_RETRACO PROC
        MOV  DX, 3DAh
@@fora: IN   AL, DX
        TEST AL, 8
        JNZ  @@fora             ; se já está no retraço, espera ele acabar...
@@dentro:
        IN   AL, DX
        TEST AL, 8
        JZ   @@dentro           ; ...e então espera o começo do próximo
        RET
ESPERA_RETRACO ENDP
```

O primeiro laço garante **um quadro por chamada**. Contar o tempo em quadros tem um custo: num
monitor de 60 Hz o jogo fica 15% mais lento.

## 20.3 Teclado

### INT 16H sem bloquear

`INT 16H, AH=00H` espera uma tecla: num jogo, o mundo pararia até o jogador apertar algo. A saída
é perguntar antes com `AH=01H`, que só **espia** o buffer: `ZF=1` se está vazio; `ZF=0` com a
tecla em `AX`, sem retirá-la. A cobra, os blocos, o sapo e o labirinto perguntam com `AH=01H`
e, só quando há tecla, a retiram com `AH=00H`, num laço que esvazia o buffer (a rotina `TECLADO`
do esqueleto da seção 20.9 é igual).

As setas chegam com `AL=00H` e o *scan code* em `AH` (`48H`, `50H`, `4BH`, `4DH`). Ler **todas**
as teclas pendentes a cada passo evita que o jogo fique atrasado em relação aos dedos.

### O buffer em 40:1A e 40:1C

O buffer de teclado da BIOS é uma fila circular de 16 palavras (ASCII e *scan code*) em
`40:1E` a `40:3D`. O ponteiro de **leitura** (cabeça) fica em `40:1A` e o de **escrita** (cauda)
em `40:1C`, os dois como offsets relativos ao segmento `0040H`; fila vazia é cabeça igual a
cauda. Como uma posição fica sempre livre, cabem 15 teclas; a 16ª ganha um bipe. No AT e
posteriores, `40:80` e `40:82` guardam o começo e o fim do buffer, que pode ser movido
([Capítulo 6](cap06-teclado.md) e [Capítulo 17](cap17-area-de-dados-da-bios.md)).

Esvaziar o buffer de uma vez (antes de uma tela de "fim de jogo", para que as teclas apertadas
na batida não a pulem) é só igualar os ponteiros: com `DS = 0040H`, entre `CLI` e `STI`,
`MOV AX, DS:[001CH]` e `MOV DS:[001AH], AX`. A cobra faz o mesmo com um laço de `INT 16H`
(`AH=01H`/`AH=00H` até esvaziar), o jeito que funciona em qualquer BIOS e em qualquer simulador.

### Uma INT 09H própria: a tabela de teclas

`INT 16H` responde "qual foi a última tecla digitada?". Um jogo de dois jogadores precisa de
outra pergunta: "**quais teclas estão apertadas agora?**" No Pong, `W` e a seta para cima podem
estar apertadas ao mesmo tempo; com o buffer, a repetição automática de uma esconderia a outra.

O teclado manda um *scan code* a cada **aperto** (`01H` a `58H`) e outro a cada **soltura** (o
mesmo código com o bit 7 ligado). Cada byte gera a IRQ 1, ou seja, a `INT 09H`. A rotina do jogo
lê a porta `60H`, anota numa tabela de 128 bytes se a tecla ficou apertada ou solta e manda o
EOI (`20H` na porta `20H`):

```asm titulo="TECLAS9.ASM: a tabela de teclas de pong, invasores e paredão" jogo
.MODEL TINY
.CODE
        ORG 100h
SC_ESC  EQU 01h

inicio:
        MOV  AX, 3509h          ; guarda o vetor antigo (ES:BX)
        INT  21h
        MOV  WORD PTR int9_antiga, BX
        MOV  WORD PTR int9_antiga+2, ES
        MOV  AX, 2509h          ; DS:DX = nova rotina
        MOV  DX, OFFSET NOVA_INT9
        INT  21h
        MOV  AX, 0B800h
        MOV  ES, AX
        CLD
laco:   MOV  SI, OFFSET vigiadas
        MOV  DI, 2*(12*80+30)   ; linha 12, coluna 30
@@prox: LODSB                   ; AL = scan code vigiado
        OR   AL, AL
        JZ   @@fim_lista
        MOV  BL, AL
        XOR  BH, BH
        MOV  AH, 07h            ; cinza: solta
        CMP  teclas[BX], 0
        JE   @@pinta
        MOV  AH, 70h            ; invertida: apertada agora
@@pinta:
        LODSB                   ; AL = símbolo da tecla
        STOSW
        MOV  AX, 0720h          ; um espaço entre as teclas
        STOSW
        JMP  @@prox
@@fim_lista:
        CMP  teclas[SC_ESC], 0
        JE   laco
        PUSH DS                 ; devolve a INT 9 da BIOS
        LDS  DX, int9_antiga
        MOV  AX, 2509h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

; Aperto: código < 80h. Soltura: código + 80h. teclas[código] = 1 ou 0.
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

; pares (scan code, símbolo) e um 0 no fim
vigiadas    DB 48h, 18h, 50h, 19h, 4Bh, 1Bh, 4Dh, 1Ah
            DB 11h, 'W', 1Fh, 'S', 39h, '_', 0
int9_antiga DD 0
teclas      DB 128 DUP (0)      ; 1 = tecla apertada agora
END inicio
```

Aperte várias setas juntas: cada uma acende independentemente. Três detalhes:

- **Teclas estendidas.** As setas do bloco cinza mandam um prefixo `E0H` antes do código. Como
  `E0H` tem o bit 7 ligado, a rotina o entende como "soltou a tecla `60H`", que não existe; o
  byte seguinte (`48H`, por exemplo) acende a mesma posição das setas do teclado numérico.
- **PC e XT.** Nesses modelos a BIOS, depois de ler `60H`, pulsa o bit 7 da porta `61H` para
  reconhecer o byte; no AT e no PS/2 o 8042 dispensa isso. Os jogos do curso não pulsam; muitos
  jogos da época pulsavam sempre, preservando os outros bits da `61H`.
- **O que deixa de funcionar.** Sem a rotina da BIOS, nada entra no buffer (`INT 16H` não vê
  nenhuma tecla), os estados de Shift, Ctrl e Alt em `40:17` param de mudar e Ctrl-Alt-Del,
  Ctrl-Break e Pause não fazem nada. Para um jogo, é exatamente o que se quer; por isso mesmo a
  INT 9 original tem de voltar **em qualquer saída**, inclusive na de erro.

### Encadear ou não a INT 9 original

| | Não encadear (jogos do curso) | Encadear (`PUSHF` + `CALL FAR` na antiga) |
|---|---|---|
| EOI | a sua rotina manda | a BIOS manda; a sua não pode mandar outro |
| Buffer | fica vazio | enche: esvazie com `INT 16H` a cada quadro, ou ele bipa |
| Shift, Ctrl-Alt-Del, Pause | não funcionam | funcionam |
| Custo | mínimo | a rotina inteira da BIOS a cada byte |

Encadeando, a rotina lê `60H` antes de chamar a antiga e não manda EOI, como os TSRs da
[Aula 28](../conteudo/aula28-tsr-teclado.md).

### INT 15H, AH=4FH: espiar sem substituir

Do AT (BIOS de 10/06/85) em diante, a rotina de `INT 09H` da BIOS chama `INT 15H` com
`AH=4FH`, `AL` = *scan code* e `CF=1` para cada byte lido. Um programa que enganchou a
`INT 15H` pode **trocar** `AL` (mapear uma tecla em outra) ou devolver `CF=0` para que a BIOS
**descarte** o byte. Isso permite montar a tabela de teclas sem tirar a INT 9 da BIOS:

```asm fragmento titulo="Tabela de teclas pela INT 15H, AH=4FH (AT e posteriores)"
NOVA_INT15 PROC FAR
        CMP  AH, 4Fh
        JNE  @@outra
        ; ... anota AL em CS:teclas, como a NOVA_INT9, preservando AX e BX ...
        STC                     ; CF = 1: a BIOS segue com a tecla normalmente
        RETF 2                  ; volta sem restaurar FLAGS: o CF chega à BIOS
@@outra:
        JMP  CS:int15_antiga
NOVA_INT15 ENDP
```

Antes de depender dela, confira o bit 4 do byte de recursos devolvido por `INT 15H, AH=C0H`
("a INT 09H chama a INT 15H, AH=4FH"; [Capítulo 8](cap08-equipamento-e-memoria.md)). Num PC
ou XT, o gancho simplesmente nunca é chamado. Os detalhes estão no
[Capítulo 6](cap06-teclado.md).

## 20.4 Vídeo

### INT 10H para trocar de modo, e quase só

Os jogos do curso chamam a `INT 10H` em poucos lugares:

| Chamada | Para quê |
|---|---|
| `AX=0013H` / `AX=0003H` | entrar no modo gráfico 320×200×256 / voltar ao texto 80×25 (limpa a tela, reinicia a paleta e o cursor) |
| `AH=0FH` | descobrir o modo atual (`AL`) para devolvê-lo na saída |
| `AH=01H`, `CX=2000H` | esconder o cursor: o bit 5 de `CH` ligado desliga o cursor |
| `AH=02H` + `AH=0EH` | escrever menus e placares, mesmo no modo 13H (em 13H, `BL` é a cor da letra) |

O resto, cada célula e cada pixel que se move, é escrita direta na memória.

### Texto: B800H

No modo 3, a tela é uma matriz de 25 × 80 palavras em `B800:0000`: o byte par é o caractere e
o ímpar o atributo (fundo nos bits 4 a 6, frente nos bits 0 a 3, bit 7 piscar ou fundo claro).
A célula da linha `l` e coluna `c` fica no offset `(l × 80 + c) × 2`. A cobra evita o `MUL` com
uma tabela `linhas DW 0*160, 1*160, ...`; o esqueleto da seção 20.9 usa `MUL` por clareza.

### Gráficos: A000H e o modo 13H

No modo 13H, cada pixel é um byte (o índice da cor) em `A000:0000`, linha após linha, 320
bytes por linha: o pixel `(x, y)` fica no offset `y × 320 + x`. Como 320 = 256 + 64, a
multiplicação vira dois deslocamentos, com `CL` como manda o 8086:

```asm fragmento titulo="DI = y × 320 + x, sem MUL (BX = x, DX = y)"
        MOV  DI, DX
        MOV  CL, 8
        SHL  DI, CL             ; DI = y × 256
        MOV  CL, 6
        SHL  DX, CL             ; DX = y × 64
        ADD  DI, DX
        ADD  DI, BX             ; + x
        MOV  ES:[DI], AL        ; AL = cor (ES = A000h)
```

Com `ES` fixo em `A000H` durante o jogo inteiro (pong, invasores e paredão fazem isso), um
retângulo é um `REP STOSB` por linha.

### A paleta: o DAC

No modo 13H, o índice de cada pixel passa pelo DAC da VGA, que guarda para cada um dos 256
índices três intensidades de 6 bits (0 a 63). Para trocar cores, escreve-se o índice na porta
`3C8H` e depois R, G e B na porta `3C9H`; o índice avança sozinho a cada três bytes, então uma
tabela inteira vai num laço (é o `PROGRAMA_PALETA` dos invasores, que define as cores 32 a 41).
Para ler, o índice vai na porta `3C7H` e as três leituras vêm da `3C9H`.

A BIOS faz o mesmo com `INT 10H, AH=10H` ([Capítulo 4](cap04-video-paleta-fontes-strings.md)):
`AL=10H` define um registrador (`BX` = índice, `DH`, `CH`, `CL` = R, G, B), `AL=12H` define um
bloco (`BX` = primeiro, `CX` = quantos, `ES:DX` = tabela de 3 bytes por cor), `AL=15H` e `17H`
leem. Para carregar a paleta uma vez, no começo, a BIOS é a escolha compatível; para animar
cores a cada quadro, as portas são mais rápidas.

Um *fade* (escurecer a tela aos poucos) é isso a cada quadro: espera o retraço, diminui em 1
cada intensidade diferente de zero numa cópia da paleta e manda a cópia inteira pelo `3C9H`;
em 64 quadros, qualquer cor chega ao preto.

### Páginas de vídeo

No texto de 80 colunas, cada **página** ocupa 4 KB, a página `n` começa em `B800:(n × 1000H)` e
`INT 10H, AH=05H` (`AL` = página) escolhe a visível (4 páginas no CGA, 8 no EGA e na VGA): desenhar
na escondida e trocar no retraço é o **buffer duplo** mais barato. O modo 13H não tem páginas; o
buffer duplo é um segmento de RAM copiado para `A000H` com `REP MOVSW`
([Aula 24](../conteudo/aula24-paleta-animacao.md)). Os jogos do curso apagam e redesenham só o
que mudou, logo depois do retraço.

## 20.5 Som sem travar o jogo

O alto-falante toca a onda quadrada do **canal 2 do PIT** quando os bits 0 (porta do canal 2) e
1 (dados do alto-falante) da porta `61H` estão ligados. A nota é o divisor
`1.193.180 / frequência` (440 Hz → 2712). O erro clássico é tocar, esperar e desligar: a espera
congela o jogo. Os jogos do curso **ligam e anotam a hora de desligar**: `SOM_LIGA` programa o
canal 2 (`0B6H` na porta `43H`, divisor em `42H`, byte baixo e depois o alto), liga os bits 0 e 1
da `61H` e guarda em `som_fim` o tique atual mais a duração em `CL`; o laço principal chama
`SOM_ATUALIZA` a cada passo, e ela desliga o som quando o prazo passa. As três rotinas estão no
esqueleto da seção 20.9, quase iguais às dos sete jogos.

Repare no `IN`/`OR`/`OUT` da porta `61H`: os outros bits controlam a paridade, o teclado do XT
e outras coisas, e precisam ficar como estavam. Nos jogos, `SOM_ATUALIZA` compara com
`CMP AX, som_fim` / `JB`, que erra se o contador der a volta bem no meio de um som (uma vez por
hora, no máximo um som que não desliga até o próximo); o esqueleto compara pela subtração.

Uma **música** é a mesma ideia com uma fila de pares (divisor, duração): quando o prazo vence,
`SOM_ATUALIZA` toca a próxima nota (ou uma rotina de `INT 1CH`, para não depender do laço).

## 20.6 Números aleatórios

Os jogos do curso usam um **gerador congruente linear** de 16 bits,
`semente = semente × 25173 + 13849 (mod 65536)`, e tiram o número de `0` a `n−1` da **parte alta**
de `semente × n` (o `DX` do `MUL`), sem divisão. A parte alta é melhor que `semente mod n`
porque os bits baixos desse gerador repetem com período curto (o bit 0 só alterna). A rotina
`ALEATORIO` (entra `AX = n`, sai `AX` entre 0 e `n−1`) está no esqueleto da seção 20.9.

A **semente** vem do relógio (`SEMEIA` copia a palavra baixa de `INT 1AH, AH=00H`), então cada
partida é diferente. Melhor ainda: semear quando o jogador aperta a tecla do título (o tempo de
reação é imprevisível), misturando a contagem do canal 0 do PIT (latch `00H` na `43H`, duas
leituras da `40H`).

## 20.7 Joystick

Nenhum jogo do curso usa joystick, mas o AT e o PS/2 têm a `INT 15H, AH=84H`
([Capítulo 13](cap13-int15-servicos.md)): com `DX=0000H` lê os botões (`AL`, bits 4 a 7); com
`DX=0001H`, as posições (`AX`, `BX` = X e Y do joystick A; `CX`, `DX` = do B); `CF=1` = sem
adaptador de jogos.

Por baixo, a placa de jogos responde na porta `201H`: escrever qualquer valor dispara quatro
temporizadores, e os bits 0 a 3 da leitura ficam em 1 por um tempo proporcional à posição de
cada eixo; os bits 4 a 7 são os botões, **0 = apertado**. Contar quanto tempo o bit leva para
cair depende da velocidade da CPU, por isso todo jogo da época tinha uma tela de "calibrar o
joystick". Um laço desses precisa de limite: sem joystick, a porta devolve `FFH` para sempre.

## 20.8 Antes de sair: restaure tudo

Um jogo mexe em muita coisa que o DOS e os outros programas usam. A lista do que devolver, na
ordem:

1. **Som:** bits 0 e 1 da porta `61H` desligados (`SOM_DESLIGA`). Um alto-falante esquecido
   ligado continua apitando no prompt.
2. **PIT:** se o canal 0 foi acelerado, divisor `0` (65536) no modo 3 (`36H` na porta `43H`)
   **antes** de devolver a `INT 08H`.
3. **Vetores:** `INT 09H`, `08H`, `1CH`, `15H`, com `INT 21H, AH=25H` e os valores salvos com
   `AH=35H`. Faça isso em todos os caminhos de saída, inclusive no de erro.
4. **Teclado:** esvazie o buffer, para que as teclas do jogo não apareçam no prompt; e espere o
   ESC ser solto, se a próxima tela também reage ao ESC (o `ESPERA_SOLTAR` do pong).
5. **Vídeo:** de volta ao modo anterior (`AH=00H` com o modo lido por `AH=0FH`, ou simplesmente
   `AX=0003H`). Trocar de modo também devolve a paleta padrão e o formato do cursor.

> **No MINIOS, uma rede de proteção.** O kernel do MINIOS guarda uma cópia dos vetores 00H a 3FH
> a cada `EXEC` e a restaura quando o programa termina; um jogo que sai sem devolver a INT 9 não
> deixa o shell sem teclado ([Capítulo 21](cap21-sem-dos-boot-e-kernel.md)). O DOS não faz isso:
> ele só restaura as `INT 22H`, `23H` e `24H` ([Capítulo 22](cap22-o-dos-por-dentro.md)).

## 20.9 Um esqueleto de jogo em modo texto

O programa abaixo junta as peças das seções anteriores num jogo mínimo: o jogador (`☺`) anda com
as setas, o alvo (`*`) muda de lugar a cada 2 segundos e pegá-lo dá um bipe que não para nada.
Ele lê os tiques em `40:6C`, o teclado com `INT 16H, AH=01H`, escreve direto em `B800H` e
devolve o modo de vídeo e o alto-falante na saída. As rotinas `ALEATORIO`, `SOM_LIGA`,
`SOM_ATUALIZA` e `SOM_DESLIGA` são as dos jogos do curso, com `TIQUES` no lugar de `LE_RELOGIO`.

```asm titulo="ESQUELETO.ASM: laço de jogo com tiques, teclado sem esperar e som" jogo
.MODEL TINY
.CODE
        ORG 100h
FUGA    EQU 36                  ; tiques até o alvo mudar de lugar (~2 s)

inicio:
        CLD
        MOV  AX, 0003h          ; texto 80x25, tela limpa
        INT  10h
        MOV  AH, 01h            ; cursor invisível (bit 5 de CH)
        MOV  CX, 2000h
        INT  10h
        MOV  AX, 0B800h
        MOV  ES, AX
        CALL TIQUES
        MOV  semente, AX        ; cada partida é diferente
        MOV  AX, 0E01h          ; ☺ amarelo
        CALL JOGADOR
        CALL NOVO_ALVO
laco:   CALL TECLADO            ; 1. entrada, sem esperar
        CMP  sair, 1
        JE   fim
        CALL SOM_ATUALIZA       ; 2. o som desliga sozinho
        CALL TIQUES             ; 3. o alvo foge de tempos em tempos
        SUB  AX, ultimo
        CMP  AX, FUGA
        JB   laco
        CALL NOVO_ALVO
        JMP  laco
fim:    CALL SOM_DESLIGA
        MOV  AX, 0003h          ; trocar de modo devolve cursor e paleta
        INT  10h
        MOV  AX, 4C00h
        INT  21h

TIQUES  PROC                    ; AX = palavra baixa de 40:6C
        PUSH DS
        MOV  AX, 0040h
        MOV  DS, AX
        MOV  AX, DS:[006Ch]
        POP  DS
        RET
TIQUES  ENDP

; TECLADO: trata todas as teclas que estão no buffer
TECLADO PROC
@@prox: MOV  AH, 01h
        INT  16h
        JNZ  @@tem
        RET
@@tem:  MOV  AH, 00h
        INT  16h
        CMP  AL, 27
        JNE  @@seta
        MOV  sair, 1
        RET
@@seta: MOV  BX, 0720h          ; apaga o jogador (AH ainda é o scan code)
        XCHG AX, BX
        CALL JOGADOR
        XCHG AX, BX
        CMP  AH, 48h
        JNE  @@b
        CMP  jog_lin, 0
        JE   @@b
        DEC  jog_lin
@@b:    CMP  AH, 50h
        JNE  @@e
        CMP  jog_lin, 24
        JAE  @@e
        INC  jog_lin
@@e:    CMP  AH, 4Bh
        JNE  @@d
        CMP  jog_col, 0
        JE   @@d
        DEC  jog_col
@@d:    CMP  AH, 4Dh
        JNE  @@anda
        CMP  jog_col, 79
        JAE  @@anda
        INC  jog_col
@@anda: MOV  AX, 0E01h
        CALL JOGADOR
        MOV  AX, WORD PTR jog_lin   ; pegou o alvo? (linha e coluna de uma vez)
        CMP  AX, WORD PTR alvo_lin
        JNE  @@prox
        MOV  BX, 1356           ; 1193180 / 880 Hz
        MOV  CL, 2              ; por dois tiques
        CALL SOM_LIGA
        CALL NOVO_ALVO
        JMP  @@prox
TECLADO ENDP

; NOVO_ALVO: apaga o alvo velho, sorteia uma casa livre e desenha
NOVO_ALVO PROC
        MOV  AX, WORD PTR alvo_lin
        CMP  AX, WORD PTR jog_lin
        JE   @@sorteia          ; o jogador está em cima: não apaga
        MOV  DX, AX
        MOV  AX, 0720h
        CALL POE
@@sorteia:
        MOV  AX, 25
        CALL ALEATORIO
        MOV  alvo_lin, AL
        MOV  AX, 80
        CALL ALEATORIO
        MOV  alvo_col, AL
        MOV  AX, WORD PTR alvo_lin
        CMP  AX, WORD PTR jog_lin
        JE   @@sorteia          ; caiu em cima do jogador: de novo
        MOV  DX, AX
        MOV  AX, 0C2Ah          ; * vermelho
        CALL POE
        CALL TIQUES
        MOV  ultimo, AX         ; o prazo da fuga recomeça
        RET
NOVO_ALVO ENDP

JOGADOR PROC                    ; AX = caractere e cor na casa do jogador
        MOV  DX, WORD PTR jog_lin
POE:    PUSH AX                 ; POE: AX na linha DL, coluna DH
        MOV  AL, 80
        MUL  DL                 ; AX = linha × 80
        MOV  DL, DH
        XOR  DH, DH
        ADD  AX, DX             ; + coluna
        SHL  AX, 1              ; × 2 bytes por célula
        MOV  DI, AX
        POP  AX
        STOSW
        RET
JOGADOR ENDP

ALEATORIO PROC                  ; entra AX = n, sai AX entre 0 e n-1
        PUSH BX
        PUSH DX
        MOV  BX, AX
        MOV  AX, semente
        MOV  DX, 25173
        MUL  DX
        ADD  AX, 13849          ; semente = semente × 25173 + 13849
        MOV  semente, AX
        MUL  BX                 ; DX = (semente × n) / 65536
        MOV  AX, DX
        POP  DX
        POP  BX
        RET
ALEATORIO ENDP

SOM_LIGA PROC                   ; divisor BX por CL tiques
        MOV  AL, 0B6h           ; canal 2, byte baixo e alto, modo 3
        OUT  43h, AL
        MOV  AL, BL
        OUT  42h, AL
        MOV  AL, BH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3              ; liga o alto-falante ao canal 2
        OUT  61h, AL
        CALL TIQUES
        XOR  CH, CH
        ADD  AX, CX
        MOV  som_fim, AX
        MOV  som_ligado, 1
        RET
SOM_LIGA ENDP

SOM_ATUALIZA PROC
        CMP  som_ligado, 1
        JNE  @@fim
        CALL TIQUES
        SUB  AX, som_fim        ; à prova da volta do contador
        JS   @@fim              ; ainda não chegou o prazo
        CALL SOM_DESLIGA
@@fim:  RET
SOM_ATUALIZA ENDP

SOM_DESLIGA PROC
        IN   AL, 61h
        AND  AL, 0FCh           ; só os bits 0 e 1
        OUT  61h, AL
        MOV  som_ligado, 0
        RET
SOM_DESLIGA ENDP

sair        DB 0
jog_lin     DB 12               ; linha e coluna juntas: uma word compara as duas
jog_col     DB 40
alvo_lin    DB 0
alvo_col    DB 0
semente     DW 1
ultimo      DW 0
som_fim     DW 0
som_ligado  DB 0
END inicio
```

Cada parte do laço é **curta e volta logo**: nenhuma rotina espera nada, e por isso o jogo
responde às teclas enquanto o som toca e o alvo conta o seu tempo. Linha e coluna ficam em bytes
vizinhos, e `CMP AX, WORD PTR alvo_lin` confere as duas de uma vez; `POE` é um ponto de entrada no
meio de `JOGADOR`. `SOM_ATUALIZA` compara pela subtração (`JS`), certa mesmo na volta do contador.

## 20.10 O que cada jogo do curso usa

| Jogo | Aula | Vídeo | Teclado | Relógio do jogo | Paleta | Som | Sorteio |
|---|---|---|---|---|---|---|---|
| Cobra | [33](../conteudo/aula33-cobra.md) | texto, `B800H`, cursor escondido | `INT 16H` 01H/00H | tiques (`INT 1AH`) | padrão | canal 2 | sim |
| Pong | [34](../conteudo/aula34-pong.md) | modo 13H, `A000H` | `INT 09H` própria | retraço `3DAH` | padrão | canal 2 | sim |
| Invasores | [35](../conteudo/aula35-invasores.md) | modo 13H, `A000H` | `INT 09H` própria | retraço `3DAH` | DAC, cores 32 a 41 | canal 2 | sim |
| Blocos | [36](../conteudo/aula36-blocos.md) | texto, `B800H`, cursor escondido | `INT 16H` 01H/00H | tiques (`INT 1AH`) | padrão | canal 2 | sim |
| Paredão | [37](../conteudo/aula37-paredao.md) | modo 13H, `A000H` | `INT 09H` própria | retraço `3DAH` | padrão | canal 2 | não |
| Sapo | [38](../conteudo/aula38-sapo.md) | texto, `B800H`, cursor escondido | `INT 16H` 01H/00H | tiques (`INT 1AH`) | padrão | canal 2 | não |
| Labirinto | [39](../conteudo/aula39-labirinto.md) | texto, `B800H`, cursor escondido | `INT 16H` 01H/00H | retraço `3DAH` | padrão | canal 2 | sim |

Todos são `.COM` (`.MODEL TINY`), desligam o som e voltam ao modo 3 antes do `AH=4CH`, e os que
trocam a `INT 09H` a devolvem com `AH=25H`. Nenhum reprograma o canal 0 nem usa a `INT 1CH`. Os
três com `INT 09H` própria são os que precisam de **teclas seguradas**: duas raquetes ao mesmo
tempo, o canhão que anda enquanto atira, a raquete do paredão.

## 20.11 No simulador do curso

Funcionam: `INT 10H` com `AH=00H`, `01H` (o bit 5 de `CH` esconde o cursor), `02H`, `0EH`,
`0FH` e `AH=10H` com `AL=10H`, `12H`, `15H` e `17H`; a memória de vídeo `B800H` e `A000H`; o
DAC pelas portas `3C7H`, `3C8H` e `3C9H`; o retraço na porta `3DAH` (bit 3), simulado a 70 Hz;
o canal 2 do PIT com a porta `61H` (o laboratório toca o som de verdade); o canal 0 com
qualquer divisor (a `INT 08H` passa a acontecer na proporção certa); `40:6C`, `INT 1AH, AH=00H`
e a `INT 1CH`; `INT 16H` com `AH=00H`, `01H`, `02H` e `05H`; e uma `INT 09H` própria, que passa
a receber pela IRQ 1 os códigos de aperto e de soltura lidos na porta `60H`.

O botão "▶ Jogar" roda `TECLAS9.ASM` e `ESQUELETO.ASM` em tela grande, em tempo real e com o
teclado do computador.

Diferenças: o buffer do teclado do simulador não fica na área de dados, então ler ou igualar
`40:1A` e `40:1C` não tem efeito (use o laço de `INT 16H`); `INT 10H, AH=05H` não troca de
página (só a página 0 aparece); `INT 15H, AH=4FH` não é chamada pela INT 9 simulada, e
`AH=84H` devolve `CF=1`, como num PC sem adaptador de jogos; a porta `201H` lê sempre `FFH`.

## 20.12 Exercícios

1. Mude o esqueleto para usar a tabela de `TECLAS9.ASM` e mover o jogador **enquanto** a seta
   estiver apertada, uma casa a cada 2 tiques, devolvendo o vetor na saída.
2. Complete o fragmento do canal 0 acelerado num `RELOGIO4.ASM` com um asterisco que anda uma
   coluna a cada mudança de `rapidos`, e compare com um que anda a cada tique da BIOS.
3. Por que o `JS` do `SOM_ATUALIZA` do esqueleto falharia para um som de mais de 32.767 tiques?
4. Escreva uma `TOCA_MUSICA` não bloqueante: uma tabela `DW divisor, duração` terminada em 0 e
   um índice; `SOM_ATUALIZA` passa para a próxima nota quando o prazo vence. Toque as quatro
   primeiras notas do "Parabéns" (Dó, Dó, Ré, Dó) enquanto o jogador anda.
5. No modo 13H, desenhe 16 faixas com as cores 0 a 15 e escureça-as com um *fade* pelas portas
   do DAC; depois faça o caminho inverso, voltando a paleta original lida com
   `INT 10H, AX=1017H`.

## Resumo

- A BIOS é usada para preparar e arrumar: trocar de modo (`INT 10H, AH=00H`), esconder o cursor
  (`AH=01H`, `CX=2000H`), ler o relógio e, nos jogos de uma tecla por vez, o teclado
  (`INT 16H, AH=01H` para espiar sem esperar).
- O laço do jogo vai direto ao hardware: `B800H` e `A000H` para desenhar, `3C8H`/`3C9H` para a
  paleta, `3DAH` para sincronizar com o retraço, `42H`/`43H`/`61H` para o som.
- Tempo: o tique de `40:6C` (18,2 Hz) com subtração sem sinal, o retraço (70 Hz) ou o canal 0
  acelerado, encadeando a `INT 08H` original uma vez a cada N para o relógio do DOS não adiantar.
- Teclas seguradas pedem uma `INT 09H` própria: porta `60H`, tabela de 128 bytes, EOI na porta
  `20H`; ou, no AT e posteriores, o gancho `INT 15H, AH=4FH`.
- Som e esperas nunca travam o laço: liga-se o som e anota-se o prazo.
- Antes de sair: som, PIT, vetores, buffer do teclado e modo de vídeo voltam ao que eram.
