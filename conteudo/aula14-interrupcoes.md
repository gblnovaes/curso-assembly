---
id: aula14
numero: 14
modulo: 6
titulo: Interrupções, IVT, DOS e BIOS
subtitulo: O que acontece de verdade quando você escreve INT 21h
duracao: 75 min
objetivos: entender o mecanismo de INT e IRET passo a passo; ler e interpretar a tabela de vetores de interrupção (IVT); diferenciar interrupções de software, de hardware e exceções da CPU; usar os serviços de teclado e vídeo do DOS e da BIOS; escolher entre DOS, BIOS e acesso direto ao hardware
---

## Uma chamada que não precisa saber o endereço

Desde a Aula 0 você usa `INT 21h` para imprimir e terminar programas. Mas o que é essa instrução? Ela é parecida com um `CALL far`, com uma diferença fundamental: **o endereço de destino não está no seu programa**. Ele está em uma tabela no começo da memória, a **tabela de vetores de interrupção** (IVT, Interrupt Vector Table).

Isso resolve um problema sério de 1981: o DOS e a BIOS mudam de versão, e o endereço das rotinas muda junto. Se os programas chamassem `CALL F000:E123` diretamente, quebrariam a cada versão. Com `INT 21h`, o programa diz "quero o serviço número 21h" e a tabela diz onde ele está **hoje**.

## A tabela de vetores (IVT)

A IVT ocupa os primeiros **1.024 bytes** da memória (0000:0000 a 0000:03FF): **256 vetores** de 4 bytes cada. Cada vetor é um ponteiro far: offset primeiro, segmento depois.

```diagrama titulo="A IVT no começo da memória"
  endereço    conteúdo                   vetor
  0000:0000   offset  | segmento         INT 00h  (divisão por zero)
  0000:0004   offset  | segmento         INT 01h  (passo a passo)
  0000:0008   offset  | segmento         INT 02h  (NMI)
  0000:000C   offset  | segmento         INT 03h  (breakpoint)
     ...
  0000:0020   offset  | segmento         INT 08h  (timer, IRQ 0)
  0000:0024   offset  | segmento         INT 09h  (teclado, IRQ 1)
     ...
  0000:0040   offset  | segmento         INT 10h  (vídeo da BIOS)
     ...
  0000:0084   offset  | segmento         INT 21h  (DOS)
     ...
  0000:03FC   offset  | segmento         INT FFh

  endereço do vetor n = n × 4
```

O vetor da `INT 21h` está em 21h × 4 = **84h**. Abra o laboratório, vá na aba **IVT** do painel de inspeção e veja os vetores do nosso PC simulado.

## O que INT n faz, passo a passo

```diagrama titulo="INT n e IRET"
  INT n                                  IRET
  ─────                                  ────
  1. PUSH FLAGS                          1. POP IP
  2. IF = 0 e TF = 0                     2. POP CS
  3. PUSH CS                             3. POP FLAGS
  4. PUSH IP (próxima instrução)
  5. IP = [0000:n×4]
     CS = [0000:n×4 + 2]

  custo: 51 ciclos                       custo: 24 ciclos
```

Três diferenças em relação ao `CALL far`:

- O `INT` **empilha as flags** antes do endereço de retorno. Por isso a rotina termina com **`IRET`**, que desempilha as flags também, e não com `RETF`.
- O `INT` **desliga IF** (as interrupções de hardware) e TF (o passo a passo). A rotina começa protegida e decide se quer religar com `STI`.
- O destino vem da memória, então **qualquer programa pode mudar o vetor** e "sequestrar" a interrupção. Esse é o assunto da próxima aula.

Execute no laboratório o programa abaixo passo a passo. No `INT 21h`, observe a pilha receber 3 words (FLAGS, CS e IP).

```asm executar titulo="VETOR.ASM: lendo a IVT"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        ; jeito 1: ler a IVT direto da memória
        XOR  AX, AX
        MOV  ES, AX             ; ES = 0000h
        MOV  BX, ES:[21h*4]     ; offset da rotina da INT 21h
        MOV  DX, ES:[21h*4+2]   ; segmento

        ; jeito 2: pedir ao DOS (AH = 35h, AL = número)
        MOV  AX, 3521h
        INT  21h                ; devolve ES:BX
        MOV  CX, ES             ; CX deve ser igual a DX

        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::dica Prefira AH = 35h e AH = 25h
Ler a IVT diretamente funciona, mas o jeito "educado" é pedir ao DOS: `AH=35h` lê um vetor (resultado em ES:BX) e `AH=25h` grava um vetor (DS:DX = nova rotina). Alguns programas residentes e gerenciadores de memória vigiavam essas funções, e o DOS garante a escrita atômica do vetor.
:::

## Três tipos de interrupção

| Tipo | Quem dispara | Exemplos |
|------|--------------|----------|
| **De software** | a instrução `INT n` | `INT 21h` (DOS), `INT 10h` (vídeo), `INT 16h` (teclado) |
| **De hardware** | um dispositivo, por um pino da CPU | timer (`INT 08h`), teclado (`INT 09h`), disco, porta serial |
| **Exceções** | a própria CPU | `INT 00h` divisão, `INT 01h` passo a passo, `INT 03h` breakpoint, `INT 04h` (`INTO`) estouro |

As interrupções de hardware são o assunto da Aula 15. As exceções você já conhece: quando um `DIV` estoura, a CPU executa sozinha um `INT 00h`, e a rotina padrão do DOS imprime "Divide overflow" e encerra o programa.

:::cpu INT 3 tem só um byte
Quase todo `INT n` ocupa 2 bytes (CDh e o número). O `INT 3` tem uma codificação especial de **um byte só**: CCh. Assim um depurador como o `DEBUG.COM` ou o *Turbo Debugger* pode trocar o primeiro byte de **qualquer** instrução por CCh para criar um ponto de parada, e depois restaurar o byte original. É assim que funcionavam os breakpoints.
:::

## As camadas: DOS, BIOS e hardware

```diagrama titulo="Quem chama quem"
  ┌───────────────────────────────────────────┐
  │ seu programa                              │
  └───────┬──────────────────┬────────────┬───┘
          │ INT 21h          │ INT 10h    │ MOV ES:[DI],AX
          ▼                  │ INT 16h    │ IN / OUT
  ┌───────────────┐          │            │
  │ DOS           │──────────┤            │
  │ arquivos,     │ INT 10h  ▼            │
  │ memória,      │  ┌───────────────┐    │
  │ processos     │  │ BIOS (ROM)    │    │
  └───────────────┘  │ vídeo, teclado│    │
                     │ disco, relógio│    │
                     └───────┬───────┘    │
                             ▼            ▼
                  ┌──────────────────────────────┐
                  │ hardware: placa de vídeo,     │
                  │ controlador de teclado, PIT   │
                  └──────────────────────────────┘
```

- O **DOS** (`INT 21h`) é portável e entende redirecionamento: `PROGRAMA > SAIDA.TXT` captura o que você imprime com `AH=09h`. É o mais lento.
- A **BIOS** (`INT 10h`, `16h`, `13h`, `1Ah`) fala com o hardware do PC, com controle fino (cor, posição do cursor, scan code das teclas). Não respeita redirecionamento.
- O **acesso direto** (B800h, portas de E/S) é o mais rápido e o mais frágil: depende do hardware exato.

```quiz
? Em que endereço está o vetor da INT 10h?
- 0000:0010
+ 0000:0040
- 0000:0100
> Cada vetor ocupa 4 bytes: 10h × 4 = 40h.

? O que INT empilha que o CALL far não empilha?
+ O registrador FLAGS
- O registrador DS
- O número da interrupção
> INT empilha FLAGS, CS e IP. Por isso a rotina termina com IRET, que restaura as três coisas.

? O que acontece com a flag IF quando uma INT é executada?
- Nada
- Fica 1
+ Fica 0: as interrupções de hardware ficam desligadas durante a rotina
> A rotina começa protegida. Se quiser aceitar outras interrupções, ela executa STI.

? Por que INT 3 tem uma codificação de um byte só (CCh)?
- Para ser mais rápida
+ Para que um depurador possa substituir o primeiro byte de qualquer instrução por um breakpoint
- Porque INT 3 não tem vetor na IVT
> Uma instrução de 2 bytes não caberia no lugar de uma instrução de 1 byte, como INC AX.

? Qual camada respeita o redirecionamento PROGRAMA > SAIDA.TXT?
+ O DOS (INT 21h)
- A BIOS (INT 10h)
- A escrita direta em B800h
> Só o DOS sabe que a saída padrão foi redirecionada para um arquivo.
```

## Teclado pelo DOS

O DOS tem várias funções de leitura de teclado. Todas esperam uma tecla se nenhuma foi pressionada e devolvem o caractere em **AL**:

| AH | Função | Eco na tela | Ctrl+C interrompe |
|----|--------|-------------|-------------------|
| `01h` | ler caractere | sim | sim |
| `07h` | ler caractere | não | não |
| `08h` | ler caractere | não | sim |
| `0Bh` | há tecla esperando? (AL = FFh se sim, 00h se não) | | |
| `0Ah` | ler uma linha inteira (veremos na Aula 19) | sim | sim |

```asm executar titulo="ECO.ASM: lendo teclas pelo DOS"
; Lê teclas e mostra cada uma entre colchetes. ESC termina.
.MODEL SMALL
.STACK 100h
.CODE
inicio:
@@le:   MOV  AH, 08h        ; ler sem eco
        INT  21h            ; AL = caractere
        CMP  AL, 27         ; ESC?
        JE   @@fim
        MOV  BL, AL         ; guarda o caractere
        MOV  AH, 02h
        MOV  DL, '['
        INT  21h
        MOV  DL, BL
        INT  21h
        MOV  DL, ']'
        INT  21h
        JMP  @@le
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

Clique na tela do usuário no laboratório (ou use o painel do miniexecutor) e digite. Quando o programa espera uma tecla, o estado fica **aguardando**.

## Teclado pela BIOS: INT 16h

A BIOS dá mais informação: além do caractere ASCII em AL, devolve o **scan code** em AH, o número físico da tecla. Isso é essencial para as teclas que não têm ASCII, como as setas e as teclas de função:

| AH | Função |
|----|--------|
| `00h` | espera uma tecla. AH = scan code, AL = ASCII (0 nas teclas especiais) |
| `01h` | consulta sem esperar. ZF = 1 se não há tecla; senão AX como acima, mas a tecla continua no buffer |
| `02h` | estado das teclas Shift, Ctrl, Alt, Caps Lock em AL |

| Tecla | Scan code (AH) | AL |
|-------|----------------|----|
| ↑ | 48h | 00h |
| ↓ | 50h | 00h |
| ← | 4Bh | 00h |
| → | 4Dh | 00h |
| F1 | 3Bh | 00h |
| Enter | 1Ch | 0Dh |
| Esc | 01h | 1Bh |
| A | 1Eh | 41h ou 61h |

```asm executar titulo="SETAS.ASM: movendo um caractere com as setas"
; Move um smile pela tela com as setas. ESC termina.
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  DH, 12             ; linha
        MOV  DL, 40             ; coluna
@@desenha:
        MOV  AH, 02h            ; posiciona o cursor (BIOS)
        MOV  BH, 0              ; página 0
        INT  10h
        MOV  AX, 0901h          ; AH = 09h, AL = 01h (smile)
        MOV  BX, 000Eh          ; página 0, amarelo
        MOV  CX, 1
        INT  10h
        MOV  AH, 00h            ; espera uma tecla
        INT  16h
        PUSH AX
        MOV  AX, 0920h          ; apaga o smile antigo
        MOV  BX, 0007h
        MOV  CX, 1
        INT  10h
        POP  AX
        CMP  AH, 01h            ; ESC
        JE   @@fim
        CMP  AH, 48h            ; seta para cima
        JNE  @@n1
        DEC  DH
@@n1:   CMP  AH, 50h            ; seta para baixo
        JNE  @@n2
        INC  DH
@@n2:   CMP  AH, 4Bh            ; seta para a esquerda
        JNE  @@n3
        DEC  DL
@@n3:   CMP  AH, 4Dh            ; seta para a direita
        JNE  @@desenha
        INC  DL
        JMP  @@desenha
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

Abra no laboratório, clique na tela do usuário e use as setas. Repare que não testamos os limites da tela: se o smile sair por um lado, a BIOS fica com coordenadas inválidas. Que tal corrigir isso?

## Vídeo pela BIOS: INT 10h

| AH | Função | Parâmetros |
|----|--------|------------|
| `00h` | muda o modo de vídeo (e limpa a tela) | AL = modo (03h = texto 80 × 25 colorido) |
| `02h` | posiciona o cursor | BH = página, DH = linha, DL = coluna |
| `03h` | lê a posição do cursor | BH = página → DH, DL |
| `06h` | rola uma janela para cima (AL = 0 limpa) | AL = linhas, BH = atributo, CH,CL = canto superior, DH,DL = canto inferior |
| `09h` | escreve caractere com atributo, sem mover o cursor | AL = caractere, BL = atributo, BH = página, CX = repetições |
| `0Eh` | escreve caractere como "teletipo", movendo o cursor | AL = caractere |

A função 06h é a forma clássica de limpar uma área da tela, por exemplo para desenhar uma janela:

```asm executar titulo="JANELA.ASM: limpando uma área com a INT 10h"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 0600h          ; rolar, AL = 0: limpar
        MOV  BH, 1Fh            ; branco sobre azul
        MOV  CX, 0505h          ; canto superior: linha 5, coluna 5
        MOV  DX, 1048h          ; canto inferior: linha 16, coluna 72
        INT  10h

        MOV  AH, 02h            ; cursor na linha 6, coluna 7
        MOV  BH, 0
        MOV  DX, 0607h
        INT  10h
        MOV  AX, 0E41h          ; teletipo: 'A'
        INT  10h
        MOV  AL, 'S'
        INT  10h
        MOV  AL, 'M'
        INT  10h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## Data e hora

| Chamada | Devolve |
|---------|---------|
| `INT 21h`, `AH=2Ah` | CX = ano, DH = mês, DL = dia, AL = dia da semana (0 = domingo) |
| `INT 21h`, `AH=2Ch` | CH = hora, CL = minuto, DH = segundo, DL = centésimos |
| `INT 1Ah`, `AH=00h` | CX:DX = tiques do timer desde a meia-noite (18,2 por segundo) |

Os **tiques** do `INT 1Ah` são a forma clássica de medir tempo em jogos e demos: o timer do PC dispara 18,2 vezes por segundo, e a BIOS conta cada disparo no endereço 0040:006C. Na próxima aula veremos de onde vem esse número.

:::anos90 A lista de interrupções de Ralf Brown
Nenhum manual oficial documentava tudo. A referência que todo programador DOS tinha era a **Ralf Brown's Interrupt List**, um arquivo de texto gigantesco, distribuído por BBS e depois pela internet, mantido de 1989 a 2000. Ela listava cada função de cada interrupção, incluindo as não documentadas do DOS e as de centenas de programas residentes. A aba **Referência** deste curso traz um resumo das funções que o nosso PC simulado implementa.
:::

## Exercícios

```exercicio
id: a14-1
titulo: A próxima letra
nivel: 1
exigir: INT
--- enunciado
Leia uma letra do teclado **sem eco** (`INT 21h`, `AH=08h`) e imprima a **letra seguinte** do alfabeto (`AH=02h`). Por exemplo, a tecla **a** imprime **b**. Não é preciso tratar o **z**.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "a -> b", "entrada": "a", "espera": { "saida": "b" } },
 { "nome": "M -> N", "entrada": "M", "espera": { "saida": "N" } },
 { "nome": "x -> y", "entrada": "x", "espera": { "saida": "y" } }]
--- dicas
Depois do INT 21h com AH = 08h, o caractere está em AL.
Para imprimir com AH = 02h, o caractere precisa estar em DL.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AH, 08h
        INT  21h
        INC  AL
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a14-2
titulo: Estrela na posição certa
nivel: 2
exigir: INT
--- enunciado
Usando só a BIOS (`INT 10h`), posicione o cursor na **linha 5, coluna 10** e escreva um `*` **vermelho claro** (atributo 0Ch) com a função **09h**.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        ; posicione o cursor e escreva o caractere

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "* vermelho em (5,10)", "espera": { "video": { "410": ["*", 12] } } }]
--- dicas
AH = 02h, BH = 0, DH = 5, DL = 10, INT 10h.
AH = 09h, AL = '*', BH = 0, BL = 0Ch, CX = 1, INT 10h.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AH, 02h
        MOV  BH, 0
        MOV  DH, 5
        MOV  DL, 10
        INT  10h
        MOV  AH, 09h
        MOV  AL, '*'
        MOV  BL, 0Ch
        MOV  CX, 1
        INT  10h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a14-3
titulo: O vetor de dois jeitos
nivel: 2
--- enunciado
Leia o vetor da **INT 10h** de dois jeitos: primeiro pedindo ao DOS (`AH=35h`), guardando o resultado em **v_off** e **v_seg**; depois lendo a IVT diretamente na memória, guardando em **d_off** e **d_seg**. Os dois pares precisam ser iguais.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
v_off   DW 0
v_seg   DW 0
d_off   DW 0
d_seg   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "os dois jeitos dão F000:E040", "espera": { "mem": { "v_off": 57408, "v_seg": 61440, "d_off": 57408, "d_seg": 61440 } } }]
--- dicas
MOV AX,3510h / INT 21h devolve o vetor em ES:BX.
O vetor 10h fica em 0000:0040 (offset) e 0000:0042 (segmento).
Use ES = 0 para ler a IVT, mas guarde as variáveis com DS, que aponta para os dados.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
v_off   DW 0
v_seg   DW 0
d_off   DW 0
d_seg   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3510h
        INT  21h
        MOV  v_off, BX
        MOV  v_seg, ES
        XOR  AX, AX
        MOV  ES, AX
        MOV  AX, ES:[10h*4]
        MOV  d_off, AX
        MOV  AX, ES:[10h*4+2]
        MOV  d_seg, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a14-4
titulo: Contando teclas
nivel: 2
exigir: INT
--- enunciado
Leia teclas com a BIOS (`INT 16h`, `AH=00h`) até o usuário pressionar **Enter** e deixe em **BX** quantas teclas foram digitadas **antes** do Enter. O Enter tem scan code 1Ch e ASCII 0Dh.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        XOR  BX, BX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "abc⏎ = 3", "entrada": "abc\r", "espera": { "BX": 3 } },
 { "nome": "⏎ = 0", "entrada": "\r", "espera": { "BX": 0 } },
 { "nome": "Assembly 8086⏎ = 13", "entrada": "Assembly 8086\r", "espera": { "BX": 13 } }]
--- dicas
Um laço: MOV AH,00h / INT 16h / CMP AL,0Dh / JE fim / INC BX / JMP laço.
Lembre que a INT 16h devolve dados em AX: o MOV AH,00h precisa estar dentro do laço.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        XOR  BX, BX
@@laco: MOV  AH, 00h
        INT  16h
        CMP  AL, 0Dh
        JE   @@fim
        INC  BX
        JMP  @@laco
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- `INT n` empilha FLAGS, CS e IP, desliga IF e TF e salta para o endereço guardado no vetor n da IVT. `IRET` desfaz tudo.
- A IVT tem 256 vetores de 4 bytes (offset, segmento) em 0000:0000. O vetor n está em n × 4.
- `AH=35h` lê um vetor (ES:BX) e `AH=25h` grava um vetor (DS:DX).
- Interrupções de software (`INT`), de hardware (dispositivos) e exceções (divisão, passo a passo, breakpoint).
- DOS: portável e redirecionável. BIOS: controle do hardware (cursor, cor, scan codes). Direto: rápido e frágil.
- `INT 16h` devolve scan code em AH e ASCII em AL; as teclas especiais têm AL = 0.
:::
