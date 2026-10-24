---
id: aula41
numero: 41
modulo: 14
titulo: O kernel e a sua própria INT 21h
subtitulo: Mapa de memória, vetores na IVT, um quadro de registradores na pilha e uma tabela de funções
duracao: 140 min
objetivos: entender o que um kernel faz e o que ele deixa para os programas; desenhar o mapa de memória de um sistema e justificar cada endereço; instalar rotinas de interrupção escrevendo direto na tabela de vetores; escrever uma INT 21h que guarda todos os registradores num quadro na pilha e os lê e altera por BP; despachar funções por uma tabela de número e endereço; devolver resultados e erros alterando o quadro e o CF das FLAGS salvas; implementar as funções de console 01h, 02h, 07h, 08h, 09h, 0Ah e 0Bh só com a BIOS
---

## O que é um kernel

Na [aula 40](aula:aula40) o setor de boot leu um arquivo `KERNEL.SYS` para 0800:0000 e saltou para lá. Agora vamos escrever o que fica nesse endereço: o **kernel** (o "núcleo") do MINIOS.

Um kernel é o programa que **fica na memória o tempo todo** e oferece serviços aos outros programas. No MS-DOS, esse papel é do MSDOS.SYS (no PC DOS da IBM, IBMDOS.COM), e os serviços são as funções da **INT 21h** que você usa desde a [aula 14](aula:aula14). O kernel do MINIOS faz a mesma coisa em escala pequena:

- prepara a sua própria pilha e os seus dados;
- instala as rotinas da **INT 0** (divisão por zero), da **INT 20h** (fim de programa) e da **INT 21h** (os serviços);
- lê o diretório do disquete para a memória dele;
- carrega o **SHELL.COM** e passa o controle para ele.

Depois disso, o kernel não roda mais "sozinho": ele só acorda quando alguém chama a INT 21h (ou a INT 20h, ou a CPU chama a INT 0). Todo o resto do tempo, quem roda é o shell ou um programa.

```diagrama titulo="Quem chama quem"
   ┌──────────────┐  INT 21h, AH=09h   ┌──────────────┐  INT 10h, 0Eh  ┌──────┐
   │ COBRA.COM    │ ─────────────────► │ KERNEL       │ ─────────────► │ BIOS │
   │ (programa)   │ ◄───────────────── │ (INT 21h)    │ ◄───────────── │      │
   └──────────────┘      IRET          └──────────────┘     IRET       └──────┘
          │                                                              ▲
          └──────────── INT 10h, 16h, 1Ah direto, sem passar pelo kernel ┘
```

O kernel do MINIOS **não tem drivers próprios**: para escrever na tela ele chama a INT 10h, para ler o teclado a INT 16h, para ler o disco a INT 13h. Era exatamente o que o DOS fazia, através do IO.SYS: o DOS conversa com a BIOS, e os programas podem conversar com os dois. É por isso que o livro deste curso se chama "da BIOS e do DOS": o [capítulo 22](livro:cap22) mostra o DOS de verdade por dentro, e o [capítulo 21](livro:cap21) o caminho do boot ao kernel.

:::anos90 IO.SYS, MSDOS.SYS e COMMAND.COM
O MS-DOS tinha três peças, e o MINIOS imita a divisão. O setor de boot carregava o **IO.SYS** (a camada que fala com a BIOS e com os dispositivos), que carregava o **MSDOS.SYS** (o kernel, com a INT 21h), que lia o CONFIG.SYS e carregava o **COMMAND.COM** (o shell). No MINIOS, o KERNEL.SYS faz o papel dos dois .SYS, e o SHELL.COM o do COMMAND.COM. Os dois .SYS ficavam escondidos no disquete com os atributos "sistema" e "oculto": o DIR não os mostrava. No MINIFS, o atributo 04h ("sistema") vem do mesmo lugar.
:::

## O mapa de memória

Antes de escrever uma linha do kernel, é preciso decidir **onde mora cada coisa**. O 8086 tem 1 MB, mas só os primeiros 640 KB são RAM livre; acima disso ficam o vídeo e as ROMs ([capítulo 8 do livro](livro:cap08)).

```diagrama titulo="O mapa de memória do MINIOS"
  físico   segmento:offset
  00000h   0000:0000   tabela de vetores (256 × 4 bytes)
  00400h   0040:0000   área de dados da BIOS
  00500h   0000:0500   (diretório lido pelo boot; livre depois)
  07C00h   0000:7C00   setor de boot (livre depois do boot)
  08000h   0800:0000   KERNEL: código e dados
                .      ...
  17FFEh   0800:FFFE   topo da pilha do kernel
  20000h   2000:0000   SHELL: PSP (256 bytes)
  20100h   2000:0100   SHELL: código (.COM)
  30000h   3000:0000   programa nível 1 (o que o shell rodou)
  40000h   4000:0000   programa nível 2 (o que esse programa rodou)
  50000h   5000:0000   buffer do comando TIPO
  A0000h   A000:0000   memória de vídeo (modo 13h)
  B8000h   B800:0000   memória de vídeo (modo texto)
  F0000h   F000:0000   ROM da BIOS
```

Cada peça ganha **um segmento inteiro de 64 KB**. É um desperdício (o kernel tem pouco mais de 2 KB e o shell, 2 KB), mas simplifica tudo: cada programa pode usar ORG 100h, ter a pilha no fim do segmento (SP = FFFEh) e nunca encostar no vizinho. O DOS de verdade é mais econômico: ele dá a cada programa o espaço que sobra e controla os pedaços com os **MCBs**, que você viu na [aula 26](aula:aula26). O [capítulo 22 do livro](livro:cap22) compara os dois.

:::cpu Por que 0800h e não 07E0h, logo depois do boot?
Daria certo: o boot termina em 7DFFh. Mas um kernel em 0800:0000 tem o endereço físico 8000h, um número redondo que se acha fácil no depurador, e deixa 512 bytes de folga entre o boot e o kernel. Num sistema real, o kernel do DOS ficava o mais baixo possível (logo depois da área de dados) para sobrar mais memória para os programas. Um sistema didático pode escolher clareza.
:::

## Os primeiros passos do kernel

```asm fragmento titulo="KERNEL.ASM: o começo"
inicio:
        CLI
        MOV  AX, CS             ; o kernel usa o próprio segmento para tudo
        MOV  DS, AX
        MOV  SS, AX
        MOV  SP, 0FFFEh         ; pilha no fim dos 64 KB do kernel
        STI
        CLD
        MOV  drive, DL

        MOV  SI, OFFSET msg_ola
        CALL K_ESCREVE
        CALL INSTALA_VETORES
        MOV  AX, 1              ; o diretório fica no setor 1
        PUSH DS
        POP  ES
        MOV  BX, OFFSET diretorio
        CALL LE_SETOR
        MOV  SI, OFFSET msg_pronto
        CALL K_ESCREVE
        JMP  RODA_SHELL
```

O kernel faz o que todo programa faz ao começar, mas sem ninguém para ajudar: **acerta os segmentos e a pilha**. Com CS = DS = SS = 0800h, o kernel é montado como um programa de um segmento só (`KERNEL SEGMENT` / `ORG 0`), e toda variável dele é endereçada com o DS natural.

Ele lê o diretório de novo (o boot já tinha lido para 0000:0500, mas essa área pode ser usada por outros) para a variável `diretorio`, de 512 bytes, dentro do próprio segmento. A partir daí, procurar um arquivo é procurar na memória do kernel, sem ler o disco.

## Instalando vetores

A tabela de vetores fica em **0000:0000**: 256 entradas de 4 bytes, cada uma com o **offset** (word baixa) e o **segmento** (word alta) da rotina da interrupção ([aula 14](aula:aula14), [capítulo 2 do livro](livro:cap02)). Num programa do DOS, você troca um vetor com a INT 21h, AH=25h. O kernel não tem a quem pedir: ele **escreve direto na tabela**.

```asm fragmento titulo="INSTALA_VETORES"
INSTALA_VETORES PROC
        XOR  AX, AX
        MOV  ES, AX
        CLI                     ; um vetor pela metade seria um desastre
        MOV  WORD PTR ES:[00h*4], OFFSET INT00_ROTINA
        MOV  ES:[00h*4+2], CS
        MOV  WORD PTR ES:[20h*4], OFFSET INT20_ROTINA
        MOV  ES:[20h*4+2], CS
        MOV  WORD PTR ES:[21h*4], OFFSET INT21_ROTINA
        MOV  ES:[21h*4+2], CS
        STI
        RET
INSTALA_VETORES ENDP
```

- `ES:[21h*4]` é o endereço 0000:0084h. O montador calcula `21h*4` na hora: não custa nada em tempo de execução.
- O **`CLI`** é essencial para os vetores que o hardware usa. Se uma interrupção chegasse entre o `MOV` do offset e o `MOV` do segmento, a CPU saltaria para um endereço com o offset novo e o segmento velho. Nenhuma IRQ usa a INT 20h ou a 21h, mas o hábito é o mesmo para a INT 8 e a INT 9, e o kernel não economiza nesse cuidado.
- Mais tarde, a função 25h do próprio kernel faz exatamente isso, para os programas: veja `F_25` na listagem.

A **INT 0** é chamada pela própria CPU quando um `DIV` ou `IDIV` não cabe ([aula 22](aula:aula22)). A BIOS deixa ali uma rotina que não faz nada útil; a do kernel mostra "Divisao por zero!" e encerra o programa culpado com o código 255, como o DOS faz.

## A INT 21h por dentro: o quadro

O problema da INT 21h é este: ela recebe parâmetros em **qualquer registrador** (AH, AL, BX, CX, DX, DS, ES...) e devolve resultados em **qualquer registrador**, e cada função usa um conjunto diferente. Ao mesmo tempo, o código do kernel precisa de registradores para trabalhar.

A solução do kernel do MINIOS (e, com detalhes diferentes, a do próprio MS-DOS) é guardar **todos** os registradores na pilha, numa ordem fixa, logo na entrada. Esse bloco na pilha é o **quadro** (*frame*). BP aponta para ele, e cada função lê os parâmetros e escreve as respostas nele. Na saída, os `POP` devolvem tudo a quem chamou, já com as respostas.

```asm fragmento titulo="INT21_ROTINA: monta o quadro e procura a função"
INT21_ROTINA PROC FAR
        STI                     ; a INT desligou as interrupções; o teclado
        CLD                     ; e o relógio precisam delas
        PUSH BP
        PUSH DS
        PUSH ES
        PUSH DI
        PUSH SI
        PUSH DX
        PUSH CX
        PUSH BX
        PUSH AX
        MOV  BP, SP
        MOV  SI, OFFSET funcoes ; procura AH na tabela de funções
@@procura:
        MOV  AL, CS:[SI]
        CMP  AL, 0FFh           ; fim da tabela
        JE   @@invalida
        CMP  AL, AH
        JE   @@achou
        ADD  SI, 3
        JMP  @@procura
@@achou:
        MOV  AX, [BP+Q_AX]      ; refaz AX (o AL foi usado na busca)
        JMP  WORD PTR CS:[SI+1]
```

```diagrama titulo="O quadro na pilha de quem chamou (BP = SP depois dos PUSHs)"
  BP+22  FLAGS   ┐
  BP+20  CS      ├ empilhados pela própria instrução INT 21h
  BP+18  IP      ┘
  BP+16  BP
  BP+14  DS
  BP+12  ES
  BP+10  DI      empilhados pela INT21_ROTINA, nesta ordem
  BP+8   SI
  BP+6   DX
  BP+4   CX
  BP+2   BX
  BP+0   AX      ◄── BP
```

O kernel dá nomes às posições com `EQU`:

```asm fragmento titulo="Os nomes das posições do quadro"
Q_AX        EQU 0
Q_BX        EQU 2
Q_CX        EQU 4
Q_DX        EQU 6
Q_SI        EQU 8
Q_DI        EQU 10
Q_ES        EQU 12
Q_DS        EQU 14
Q_BP        EQU 16
Q_IP        EQU 18
Q_CS        EQU 20
Q_FLAGS     EQU 22
```

Agora uma função pode **ler** um parâmetro que já foi estragado (`MOV AX, [BP+Q_DS]` é o DS de quem chamou, mesmo depois de o kernel mudar o DS) e **escrever** uma resposta que só aparece na volta (`MOV [BP+Q_BX], AX` faz o BX de quem chamou valer AX depois do IRET). É a mesma ideia de parâmetros por `[BP+n]` que a [aula 10](aula:aula10) usou para procedimentos, aplicada a uma interrupção.

:::cpu O BP usa o segmento SS
`[BP+n]` é sempre lido no segmento **SS**, não no DS. Isso é o que faz o quadro funcionar: o kernel está usando a **pilha de quem chamou** (SS:SP do programa), e é nela que o quadro está. DS pode apontar para onde for. Com `[BX+n]` ou `[SI+n]`, o segmento seria o DS, e o kernel teria que acertar o DS antes.
:::

### Os dados do kernel com `CS:`

Há um detalhe sutil. Dentro da INT 21h, **DS ainda é o de quem chamou**. A função 09h precisa disso: ela escreve o texto em DS:DX, e o DS:DX é do programa. Então, para ler as variáveis do **kernel** (a tabela de funções, o nível, o código de saída), o código usa o **prefixo `CS:`**: o kernel roda com CS = 0800h, e os dados dele estão no mesmo segmento do código.

```asm fragmento titulo="Lendo dados do kernel sem mudar o DS"
        MOV  AL, CS:[SI]        ; a tabela de funções está no kernel
        ...
        MOV  AL, CS:codigo_saida
```

### A tabela de funções

Em vez de uma longa sequência de `CMP AH,01h / JE F_01 / CMP AH,02h / JE F_02...`, as funções ficam numa **tabela**: um byte com o número e uma word com o endereço da rotina. O `JMP WORD PTR CS:[SI+1]` é um **salto indireto**: salta para o endereço que está guardado na memória.

```asm fragmento titulo="A tabela: número (DB) e endereço (DW)"
funcoes     DB 01h
            DW F_01
            DB 02h
            DW F_02
            DB 07h
            DW F_08
            ...
            DB 81h
            DW F_81
            DB 0FFh             ; fim da tabela
```

Acrescentar uma função ao kernel é escrever a rotina e acrescentar 3 bytes à tabela. A 07h e a 08h apontam para a mesma rotina, porque no MINIOS não há Ctrl+C para diferenciar as duas. O DOS de verdade usa uma tabela ainda mais direta: um vetor de words indexado pelo próprio AH (`JMP tabela[BX]` com BX = AH × 2), sem procura. Para 16 funções esparsas (01h a 81h), a tabela com o número gasta menos memória.

### Saindo: o CF nas FLAGS salvas

Uma função do DOS diz "deu erro" com **CF = 1** e o código do erro em AX. Mas o kernel termina com `IRET`, e o `IRET` **restaura as FLAGS** que a instrução INT guardou. Qualquer `STC` dentro do kernel seria desfeito na volta.

A saída é mudar o **CF dentro do quadro**, na word das FLAGS salvas (bit 0):

```asm fragmento titulo="FIM_OK e FIM_ERRO"
FIM_ERRO:
        MOV  [BP+Q_AX], AX
        OR   WORD PTR [BP+Q_FLAGS], 1
        JMP  SHORT SAI_21
FIM_OK: AND  WORD PTR [BP+Q_FLAGS], 0FFFEh
SAI_21: POP  AX
        POP  BX
        POP  CX
        POP  DX
        POP  SI
        POP  DI
        POP  ES
        POP  DS
        POP  BP
        IRET
```

Toda função termina com `JMP FIM_OK` ou com AX = código e `JMP FIM_ERRO`. Os códigos são os do DOS: 1 = função inválida, 2 = arquivo não encontrado, 8 = memória insuficiente, 18 = não há mais arquivos.

```diagrama titulo="O caminho de uma chamada: MOV AH,09h / MOV DX,OFFSET msg / INT 21h"
  programa:  INT 21h ── empilha FLAGS, CS, IP; IF = 0; salta pela IVT[21h]
  kernel:    STI, 9 PUSHs, BP = SP
             procura 09h na tabela ── JMP F_09
  F_09:      escreve DS:DX até o '$' (DS ainda é o do programa)
             JMP FIM_OK ── CF = 0 no quadro
  SAI_21:    9 POPs ── IRET: tira IP, CS e as FLAGS (com o CF novo)
  programa:  continua depois do INT 21h
```

## Uma INT 60h com a mesma técnica, dentro do DOS

Para ver o quadro e a tabela funcionando sem precisar dar boot, este programa do DOS instala uma interrupção de serviço própria, a **INT 60h** (a faixa 60h a 66h ficou reservada para programas desde o PC original, como o [capítulo 2 do livro](livro:cap02) registra), com três funções, usa as três, testa uma função que não existe e devolve o vetor antigo. Execute aqui mesmo e depois abra no laboratório: pare na `SERVICO` e olhe a pilha a partir de SS:BP.

```asm executar titulo="SERVICO.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  SERVICO.ASM  -  um "mini-DOS" na INT 60h, dentro do DOS      ║
; ║  A mesma técnica do kernel do MINIOS: quadro de registradores ║
; ║  na pilha, tabela de funções e CF nas FLAGS salvas.           ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

Q_AX    EQU 0                   ; o quadro: onde cada registrador ficou
Q_BX    EQU 2
Q_CX    EQU 4
Q_DX    EQU 6
Q_SI    EQU 8
Q_DI    EQU 10
Q_ES    EQU 12
Q_DS    EQU 14
Q_BP    EQU 16
Q_IP    EQU 18
Q_CS    EQU 20
Q_FLAGS EQU 22

inicio: MOV  AX, 3560h          ; guarda o vetor 60h de antes
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET SERVICO ; e instala o nosso (DS:DX)
        MOV  AX, 2560h
        INT  21h

        MOV  AH, 01h            ; função 01h: escreve o texto DS:DX
        MOV  DX, OFFSET msg_ola
        INT  60h
        MOV  AH, 03h            ; função 03h: versão em AX
        INT  60h
        MOV  versao, AX
        MOV  AH, 01h
        MOV  DX, OFFSET msg_versao
        INT  60h
        MOV  BL, BYTE PTR versao+1      ; a versão principal (AH)
        XOR  BH, BH
        MOV  AH, 02h            ; função 02h: escreve BX em decimal
        INT  60h
        MOV  AH, 01h
        MOV  DX, OFFSET msg_ponto
        INT  60h
        MOV  BL, BYTE PTR versao        ; e a secundária (AL)
        XOR  BH, BH
        MOV  AH, 02h
        INT  60h
        MOV  AH, 07h            ; uma função que não existe
        INT  60h
        JNC  fim
        MOV  BX, AX             ; CF = 1 e AX = 1, como no DOS
        MOV  AH, 01h
        MOV  DX, OFFSET msg_erro
        INT  60h
        MOV  AH, 02h
        INT  60h
fim:    PUSH DS                 ; devolve o vetor antigo antes de sair
        LDS  DX, antigo
        MOV  AX, 2560h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

; ---------------------------------------------------------------
; A rotina da INT 60h
; ---------------------------------------------------------------
SERVICO PROC FAR
        STI
        CLD
        PUSH BP                 ; o quadro, na mesma ordem do kernel
        PUSH DS
        PUSH ES
        PUSH DI
        PUSH SI
        PUSH DX
        PUSH CX
        PUSH BX
        PUSH AX
        MOV  BP, SP             ; [BP+Q_xx] = o registrador de quem chamou
        MOV  SI, OFFSET funcoes
@@procura:
        MOV  AL, CS:[SI]
        CMP  AL, 0FFh
        JE   @@invalida
        CMP  AL, AH
        JE   @@achou
        ADD  SI, 3
        JMP  @@procura
@@achou:
        MOV  AX, [BP+Q_AX]
        JMP  WORD PTR CS:[SI+1] ; salta para a função
@@invalida:
        MOV  AX, 1              ; erro 1: função inválida
        JMP  FIM_ERRO
SERVICO ENDP

FIM_ERRO:
        MOV  [BP+Q_AX], AX
        OR   WORD PTR [BP+Q_FLAGS], 1       ; CF = 1 na volta
        JMP  SHORT SAI
FIM_OK: AND  WORD PTR [BP+Q_FLAGS], 0FFFEh  ; CF = 0 na volta
SAI:    POP  AX
        POP  BX
        POP  CX
        POP  DX
        POP  SI
        POP  DI
        POP  ES
        POP  DS
        POP  BP
        IRET

; 01h: escreve o texto DS:DX (terminado em 0) pela BIOS
F_01    PROC
        MOV  SI, DX
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        CALL CARACTERE
        JMP  @@car
@@fim:  JMP  FIM_OK
F_01    ENDP

; 02h: escreve BX em decimal
F_02    PROC
        MOV  AX, BX
        MOV  BX, 10
        XOR  CX, CX
@@div:  XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        OR   AX, AX
        JNZ  @@div
@@dig:  POP  AX
        ADD  AL, '0'
        CALL CARACTERE
        LOOP @@dig
        JMP  FIM_OK
F_02    ENDP

; 03h: versão: AH = 1, AL = 2 (escrita no quadro: é o AX da volta)
F_03    PROC
        MOV  WORD PTR [BP+Q_AX], 0102h
        JMP  FIM_OK
F_03    ENDP

CARACTERE PROC
        PUSH BX
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        POP  BX
        RET
CARACTERE ENDP

funcoes DB 01h
        DW F_01
        DB 02h
        DW F_02
        DB 03h
        DW F_03
        DB 0FFh

antigo     DD 0
versao     DW 0
msg_ola    DB 'INT 60h instalada.', 13, 10, 0
msg_versao DB 'Servico versao ', 0
msg_ponto  DB '.', 0
msg_erro   DB 13, 10, 'Funcao 07h: CF = 1, AX = ', 0
END inicio
```

## As funções de console

Com a estrutura pronta, cada função é curta. Todas falam com a BIOS.

```asm fragmento titulo="02h e 09h: escrever"
F_02 PROC
        MOV  AL, DL
        CALL K_CARACTERE
        JMP  FIM_OK
F_02 ENDP

F_09 PROC
        MOV  SI, DX
@@car:  LODSB
        CMP  AL, '$'
        JE   @@fim
        CALL K_CARACTERE
        JMP  @@car
@@fim:  JMP  FIM_OK
F_09 ENDP

K_CARACTERE PROC
        PUSH AX
        PUSH BX
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        POP  BX
        POP  AX
        RET
K_CARACTERE ENDP
```

`F_09` usa `LODSB`, que lê de **DS:SI**, com o DS de quem chamou: o texto do programa. O `$` como fim de texto é uma herança do CP/M, o sistema dos anos 70 que o DOS imitou; o curso explica isso na [aula 14](aula:aula14).

```asm fragmento titulo="01h, 08h e 0Bh: ler o teclado"
F_01 PROC
        CALL LE_TECLA
        CALL K_CARACTERE
        MOV  [BP+Q_AX], AL
        JMP  FIM_OK
F_01 ENDP

F_08 PROC
        CALL LE_TECLA
        MOV  [BP+Q_AX], AL
        JMP  FIM_OK
F_08 ENDP

F_0B PROC
        MOV  AH, 01h
        INT  16h
        MOV  AL, 0
        JZ   @@nao
        MOV  AL, 0FFh
@@nao:  MOV  [BP+Q_AX], AL
        JMP  FIM_OK
F_0B ENDP
```

Repare em `MOV [BP+Q_AX], AL`: escreve só o byte baixo da word de AX no quadro. Quem chamou recebe o caractere em AL e o **AH que tinha antes** (o número da função), exatamente como no DOS.

E por que o `STI` logo na entrada da INT 21h? A instrução INT desliga as interrupções (IF = 0). Se o kernel ficasse assim, a INT 16h esperaria uma tecla para sempre: a tecla só chega ao buffer pela IRQ 1, que é uma interrupção. O [capítulo 6 do livro](livro:cap06) mostra esse caminho em detalhe.

### A 0Ah: ler uma linha

A função mais longa do console é a **0Ah**, que o shell usa para ler os comandos. O buffer tem o formato do DOS: o primeiro byte diz quantos caracteres cabem, o segundo recebe quantos foram digitados, e o texto vem depois, terminado por 13.

```diagrama titulo="O buffer da função 0Ah"
   DS:DX ─►┌────┬────┬────┬────┬────┬────┬────┬─ ─ ─┐
           │ 20 │  3 │ 'D'│ 'I'│ 'R'│ 13 │    │     │
           └────┴────┴────┴────┴────┴────┴────┴─ ─ ─┘
            máx  lidos  texto digitado    ENTER
```

A rotina trata o **Backspace** (código 8) voltando o cursor, escrevendo um espaço e voltando de novo: o mesmo truque de qualquer terminal. Teclas de controle são ignoradas, e quando o buffer enche, as teclas comuns também, até vir o ENTER.

## Os outros serviços

- **19h** (drive atual) responde sempre 0 (A:): o MINIOS só conhece um disquete.
- **25h** e **35h** trocam e leem vetores, para os jogos instalarem a INT 9 deles. Note como a 25h pega o segmento em `[BP+Q_DS]`: o DS de quem chamou.
- **30h** (versão) responde AL = 1, AH = 0 e **BX = 'MI'**. Um programa pode chamar a 30h e olhar o BX para saber se está no MINIOS ou no DOS (no DOS, BH é o número do fabricante: 00h IBM, FFh Microsoft). O INFO.COM da [aula 44](aula:aula44) faz isso.
- **4Bh**, **4Ch**, **4Dh**, **80h** e **81h** são o assunto da [aula 42](aula:aula42): carregar programas, terminar e ler arquivos.

:::dica Por que os jogos rodam no MINIOS sem mudar nada
Os sete jogos do módulo 13 só chamam da INT 21h a 4Ch (fim), a 25h e a 35h (vetores da INT 9) e, alguns, a 02h e a 09h (texto). Tudo o mais é BIOS (INT 10h, 16h, 1Ah) ou hardware direto (B800h, A000h, as portas do PIT e do teclado). Como o kernel do MINIOS implementa essas cinco funções do mesmo jeito que o DOS, os mesmos .COM rodam nos dois. É a ideia de **interface estável**: o programa depende do contrato (o número da função, os registradores), não de quem o cumpre.
:::

## A listagem completa

O kernel inteiro tem cerca de 770 linhas e 2,3 KB. Ele não roda sozinho como um programa do DOS (ele precisa ser carregado pelo setor de boot em 0800:0000), então o bloco abaixo é só a listagem; o disquete logo depois junta o boot, o kernel e o shell para você dar boot.

```asm titulo="KERNEL.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  KERNEL.ASM  -  o núcleo do MINIOS                            ║
; ║  Curso Assembly 8086, aulas 41 e 42                           ║
; ║                                                               ║
; ║  Carregado pelo setor de boot em 0800:0000. Instala as suas   ║
; ║  próprias INT 20h e INT 21h (um "mini-DOS"), lê o diretório   ║
; ║  do disquete e roda o SHELL.COM.                              ║
; ╚══════════════════════════════════════════════════════════════╝
KERNEL SEGMENT
        ORG 0

; ---------------------------------------------------------------
; Mapa da memória do MINIOS
;   0000:0000  vetores de interrupção
;   0000:0400  área de dados da BIOS
;   0000:7C00  setor de boot (não é mais usado depois do boot)
;   0800:0000  kernel (código, dados e a pilha no fim do segmento)
;   2000:0000  shell (PSP em 2000:0000, código em 2000:0100)
;   3000:0000  programa rodado pelo shell
;   4000:0000  programa rodado por esse programa (no máximo 2 níveis)
;   A000:0000  memória de vídeo
; ---------------------------------------------------------------
SEG_SHELL   EQU 2000h
SEG_PROG    EQU 3000h           ; + 1000h por nível
MAX_NIVEIS  EQU 2
VETORES_SALVOS EQU 64           ; INT 00h a 3Fh são guardadas a cada EXEC
ENTRADAS    EQU 16
SETORES_TRILHA EQU 18
CABECAS     EQU 2

; erros devolvidos em AX com CF = 1 (os mesmos números do DOS)
ERRO_FUNCAO EQU 1
ERRO_ARQUIVO EQU 2
ERRO_MEMORIA EQU 8
ERRO_FIM    EQU 18

; o "quadro" que a INT 21h monta na pilha de quem chamou (BP aponta para ele)
Q_AX        EQU 0
Q_BX        EQU 2
Q_CX        EQU 4
Q_DX        EQU 6
Q_SI        EQU 8
Q_DI        EQU 10
Q_ES        EQU 12
Q_DS        EQU 14
Q_BP        EQU 16
Q_IP        EQU 18
Q_CS        EQU 20
Q_FLAGS     EQU 22

inicio:
        CLI
        MOV  AX, CS             ; o kernel usa o próprio segmento para tudo
        MOV  DS, AX
        MOV  SS, AX
        MOV  SP, 0FFFEh         ; pilha no fim dos 64 KB do kernel
        STI
        CLD
        MOV  drive, DL

        MOV  SI, OFFSET msg_ola
        CALL K_ESCREVE
        CALL INSTALA_VETORES
        MOV  AX, 1              ; o diretório fica no setor 1
        PUSH DS
        POP  ES
        MOV  BX, OFFSET diretorio
        CALL LE_SETOR
        MOV  SI, OFFSET msg_pronto
        CALL K_ESCREVE
        JMP  RODA_SHELL

; ===============================================================
; Vetores de interrupção
; ===============================================================

; INSTALA_VETORES: o kernel passa a atender INT 0 (divisão por zero),
; INT 20h e INT 21h. Escrever na tabela é só um MOV em 0000:(n * 4).
INSTALA_VETORES PROC
        XOR  AX, AX
        MOV  ES, AX
        CLI                     ; um vetor pela metade seria um desastre
        MOV  WORD PTR ES:[00h*4], OFFSET INT00_ROTINA
        MOV  ES:[00h*4+2], CS
        MOV  WORD PTR ES:[20h*4], OFFSET INT20_ROTINA
        MOV  ES:[20h*4+2], CS
        MOV  WORD PTR ES:[21h*4], OFFSET INT21_ROTINA
        MOV  ES:[21h*4+2], CS
        STI
        RET
INSTALA_VETORES ENDP

; INT 0: a CPU chama sozinha quando um DIV dá errado
INT00_ROTINA PROC FAR
        STI
        PUSH CS
        POP  DS
        MOV  SI, OFFSET msg_div_zero
        CALL K_ESCREVE
        MOV  AL, 0FFh           ; encerra o programa com código 255
        JMP  TERMINA
INT00_ROTINA ENDP

; INT 20h: fim de programa (o RET de um .COM cai aqui, pelo PSP)
INT20_ROTINA PROC FAR
        XOR  AL, AL
        JMP  TERMINA
INT20_ROTINA ENDP

; ===============================================================
; INT 21h: o mini-DOS
; ===============================================================
; Todos os registradores vão para a pilha, numa ordem fixa. Cada função
; lê os parâmetros e escreve as respostas nesse quadro ([BP+Q_xx]); na
; saída, os POPs devolvem tudo para quem chamou. Os dados do kernel são
; lidos com CS: na frente, porque DS ainda é o de quem chamou (a 09h,
; por exemplo, precisa do DS:DX dele).
INT21_ROTINA PROC FAR
        STI                     ; a INT desligou as interrupções; o teclado
        CLD                     ; e o relógio precisam delas
        PUSH BP
        PUSH DS
        PUSH ES
        PUSH DI
        PUSH SI
        PUSH DX
        PUSH CX
        PUSH BX
        PUSH AX
        MOV  BP, SP
        MOV  SI, OFFSET funcoes ; procura AH na tabela de funções
@@procura:
        MOV  AL, CS:[SI]
        CMP  AL, 0FFh           ; fim da tabela
        JE   @@invalida
        CMP  AL, AH
        JE   @@achou
        ADD  SI, 3
        JMP  @@procura
@@achou:
        MOV  AX, [BP+Q_AX]      ; refaz AX (o AL foi usado na busca)
        JMP  WORD PTR CS:[SI+1]
@@invalida:
        MOV  AX, ERRO_FUNCAO
        JMP  FIM_ERRO
INT21_ROTINA ENDP

; FIM_OK / FIM_ERRO: CF = 0 ou CF = 1 nas FLAGS que o IRET vai restaurar
FIM_ERRO:
        MOV  [BP+Q_AX], AX
        OR   WORD PTR [BP+Q_FLAGS], 1
        JMP  SHORT SAI_21
FIM_OK: AND  WORD PTR [BP+Q_FLAGS], 0FFFEh
SAI_21: POP  AX
        POP  BX
        POP  CX
        POP  DX
        POP  SI
        POP  DI
        POP  ES
        POP  DS
        POP  BP
        IRET

; ---- 01h: lê uma tecla e mostra (AL = caractere) ----
F_01 PROC
        CALL LE_TECLA
        CALL K_CARACTERE
        MOV  [BP+Q_AX], AL
        JMP  FIM_OK
F_01 ENDP

; ---- 02h: escreve o caractere DL ----
F_02 PROC
        MOV  AL, DL
        CALL K_CARACTERE
        JMP  FIM_OK
F_02 ENDP

; ---- 07h e 08h: lê uma tecla sem mostrar ----
F_08 PROC
        CALL LE_TECLA
        MOV  [BP+Q_AX], AL
        JMP  FIM_OK
F_08 ENDP

; ---- 09h: escreve o texto DS:DX até o '$' ----
F_09 PROC
        MOV  SI, DX
@@car:  LODSB
        CMP  AL, '$'
        JE   @@fim
        CALL K_CARACTERE
        JMP  @@car
@@fim:  JMP  FIM_OK
F_09 ENDP

; ---- 0Ah: lê uma linha em DS:DX ([DX] = máximo, [DX+1] = lidos) ----
F_0A PROC
        MOV  DI, DX
        MOV  CL, [DI]           ; CL = máximo (contando o ENTER)
        DEC  CL
        XOR  CH, CH             ; CH = quantos já foram digitados
        ADD  DI, 2
@@tecla:
        CALL LE_TECLA
        CMP  AL, 13
        JE   @@enter
        CMP  AL, 8
        JE   @@volta
        CMP  AL, ' '
        JB   @@tecla            ; ignora outras teclas de controle
        CMP  CH, CL
        JAE  @@tecla            ; buffer cheio: ignora
        MOV  [DI], AL
        INC  DI
        INC  CH
        CALL K_CARACTERE
        JMP  @@tecla
@@volta:
        OR   CH, CH
        JZ   @@tecla
        DEC  DI
        DEC  CH
        MOV  AL, 8              ; volta, apaga com espaço, volta de novo
        CALL K_CARACTERE
        MOV  AL, ' '
        CALL K_CARACTERE
        MOV  AL, 8
        CALL K_CARACTERE
        JMP  @@tecla
@@enter:
        MOV  [DI], AL           ; o 13 fica no fim, como no DOS
        MOV  SI, DX
        MOV  [SI+1], CH
        CALL K_CARACTERE
        JMP  FIM_OK
F_0A ENDP

; ---- 0Bh: tem tecla esperando? AL = 0FFh sim, 0 não ----
F_0B PROC
        MOV  AH, 01h
        INT  16h
        MOV  AL, 0
        JZ   @@nao
        MOV  AL, 0FFh
@@nao:  MOV  [BP+Q_AX], AL
        JMP  FIM_OK
F_0B ENDP

; ---- 19h: drive atual (sempre A: = 0) ----
F_19 PROC
        MOV  BYTE PTR [BP+Q_AX], 0
        JMP  FIM_OK
F_19 ENDP

; ---- 25h: vetor AL = DS:DX ----
F_25 PROC
        XOR  BX, BX
        MOV  ES, BX
        MOV  BL, AL
        SHL  BX, 1
        SHL  BX, 1              ; BX = AL * 4
        CLI
        MOV  ES:[BX], DX
        MOV  AX, [BP+Q_DS]
        MOV  ES:[BX+2], AX
        STI
        JMP  FIM_OK
F_25 ENDP

; ---- 30h: versão: AL = 1, AH = 0 (MINIOS 1.0) ----
F_30 PROC
        MOV  WORD PTR [BP+Q_AX], 0001h
        MOV  WORD PTR [BP+Q_BX], 'IM'   ; BX = "MI" (de MINIOS)
        JMP  FIM_OK
F_30 ENDP

; ---- 35h: ES:BX = vetor AL ----
F_35 PROC
        XOR  BX, BX
        MOV  ES, BX
        MOV  BL, AL
        SHL  BX, 1
        SHL  BX, 1
        MOV  AX, ES:[BX]
        MOV  [BP+Q_BX], AX
        MOV  AX, ES:[BX+2]
        MOV  [BP+Q_ES], AX
        JMP  FIM_OK
F_35 ENDP

; ---- 4Ch: termina o programa com o código AL ----
F_4C PROC
        JMP  TERMINA
F_4C ENDP

; ---- 4Dh: código de saída do último programa ----
F_4D PROC
        MOV  AL, CS:codigo_saida
        XOR  AH, AH
        MOV  [BP+Q_AX], AX
        JMP  FIM_OK
F_4D ENDP

; ---- 80h (só do MINIOS): entrada CX do diretório -> ES:DI (32 bytes) ----
F_80 PROC
        CMP  CX, ENTRADAS
        JAE  @@fim
        MOV  SI, CX
        MOV  CL, 5
        SHL  SI, CL             ; SI = CX * 32
        ADD  SI, OFFSET diretorio
        CMP  BYTE PTR CS:[SI], 0     ; nome vazio: acabou o diretório
        JE   @@fim
        PUSH CS
        POP  DS
        MOV  CX, 16
        REP  MOVSW              ; DS:SI (kernel) -> ES:DI (quem chamou)
        JMP  FIM_OK
@@fim:  MOV  AX, ERRO_FIM
        JMP  FIM_ERRO
F_80 ENDP

; ---- 81h (só do MINIOS): lê o arquivo DS:DX inteiro para ES:BX ----
;      AX = tamanho em bytes
F_81 PROC
        CALL ACHA_ARQUIVO       ; SI = entrada no diretório
        JC   @@nao
        CALL LE_ARQUIVO
        MOV  AX, CS:[SI+16]
        MOV  [BP+Q_AX], AX
        JMP  FIM_OK
@@nao:  MOV  AX, ERRO_ARQUIVO
        JMP  FIM_ERRO
F_81 ENDP

; ===============================================================
; Programas: carregar, rodar e terminar
; ===============================================================

; ---- 4Bh: roda o programa DS:DX (nome com 0 no fim). ES:BX aponta
;      para a linha de comando (tamanho, texto, 13), como no PSP.
;      O MINIOS só roda .COM: o arquivo vai para SEG:0100h e começa ali.
F_4B PROC
        CMP  CS:nivel, MAX_NIVEIS
        JB   @@cabe
        MOV  AX, ERRO_MEMORIA
        JMP  FIM_ERRO
@@cabe: CALL ACHA_ARQUIVO       ; SI = entrada (no segmento do kernel)
        JNC  @@achou
        MOV  AX, ERRO_ARQUIVO
        JMP  FIM_ERRO
@@achou:
        MOV  AL, CS:nivel       ; segmento do programa = 3000h + nível * 1000h
        XOR  AH, AH
        MOV  CL, 12
        SHL  AX, CL
        ADD  AX, SEG_PROG
        MOV  ES, AX
        MOV  BX, 100h
        CALL LE_ARQUIVO         ; o arquivo vai para ES:0100
        PUSH DS                 ; e o PSP para ES:0000, com a linha de
        MOV  SI, [BP+Q_BX]      ; comando que veio em ES:BX
        MOV  DS, [BP+Q_ES]
        CALL MONTA_PSP
        POP  DS
        CALL SALVA_VETORES
        MOV  AL, CS:nivel       ; guarda a pilha de quem chamou: é ela
        XOR  AH, AH             ; que a TERMINA vai pôr de volta
        MOV  DI, AX
        SHL  DI, 1
        MOV  CS:pilha_ss[DI], SS
        MOV  CS:pilha_sp[DI], SP
        INC  CS:nivel
        MOV  AX, ES             ; agora o programa:
        JMP  INICIA_PROGRAMA
F_4B ENDP

; INICIA_PROGRAMA: AX = segmento de um .COM já carregado. Monta a pilha
; dele (com um 0 no topo: um RET cai no INT 20h do PSP) e salta para
; AX:0100h com todos os segmentos iguais, como o DOS faz.
INICIA_PROGRAMA:
        CLI
        MOV  SS, AX
        XOR  SP, SP             ; SP = 0: o PUSH abaixo grava em FFFEh
        XOR  BX, BX
        PUSH BX                 ; a palavra 0000h no topo da pilha
        STI
        MOV  DS, AX
        MOV  ES, AX
        PUSH AX                 ; CS do programa
        MOV  AX, 100h
        PUSH AX                 ; IP = 100h
        XOR  AX, AX             ; os registradores começam zerados
        XOR  BX, BX
        XOR  CX, CX
        XOR  DX, DX
        XOR  SI, SI
        XOR  DI, DI
        XOR  BP, BP
        RETF                    ; "volta" para dentro do programa

; TERMINA: fim do programa atual com o código AL (INT 20h, 4Ch, INT 0).
; Volta para a pilha de quem fez a 4Bh (guardada no EXEC), devolve os
; vetores do jeito que estavam e sai da INT 21h dele como se a 4Bh
; tivesse acabado agora.
TERMINA PROC
        CLI
        MOV  CS:codigo_saida, AL
        CMP  CS:nivel, 0
        JNE  @@volta
        JMP  RODA_SHELL         ; o próprio shell terminou: roda de novo
@@volta:
        DEC  CS:nivel
        CALL RESTAURA_VETORES
        MOV  AL, CS:nivel
        XOR  AH, AH
        MOV  DI, AX
        SHL  DI, 1
        MOV  SS, CS:pilha_ss[DI]
        MOV  SP, CS:pilha_sp[DI]
        STI
        MOV  BP, SP             ; o quadro da INT 21h do pai está no topo
        JMP  FIM_OK
TERMINA ENDP

; RODA_SHELL: carrega o SHELL.COM e roda no nível 0
RODA_SHELL PROC
        CLI
        MOV  AX, CS
        MOV  DS, AX
        MOV  SS, AX
        MOV  SP, 0FFFEh
        STI
        MOV  nivel, 0
        MOV  DX, OFFSET nome_shell
        CALL ACHA_ARQUIVO
        JNC  @@achou
        MOV  SI, OFFSET msg_sem_shell
        CALL K_ESCREVE
        CLI
        HLT                     ; sem shell não há o que fazer
@@achou:
        MOV  AX, SEG_SHELL
        MOV  ES, AX
        MOV  BX, 100h
        CALL LE_ARQUIVO
        MOV  SI, OFFSET cmd_vazia
        CALL MONTA_PSP
        MOV  AX, SEG_SHELL
        JMP  INICIA_PROGRAMA
RODA_SHELL ENDP

; MONTA_PSP: o PSP em ES:0000 com o INT 20h e a linha de comando DS:SI
; (tamanho, texto e 13, como fica no offset 80h do PSP)
MONTA_PSP PROC
        MOV  WORD PTR ES:[0], 20CDh  ; CD 20 = INT 20h
        MOV  WORD PTR ES:[2], 0A000h ; primeiro segmento depois do programa
        MOV  DI, 80h
        MOV  CL, [SI]
        XOR  CH, CH
        CMP  CX, 126
        JBE  @@tam
        MOV  CX, 126
@@tam:  ADD  CX, 2              ; + o byte do tamanho e o 13 do fim
        REP  MOVSB
        RET
MONTA_PSP ENDP

; SALVA_VETORES / RESTAURA_VETORES: uma cópia das INT 00h a 3Fh por nível.
; Assim um jogo que troca a INT 9 e termina sem devolver não deixa o
; teclado do shell quebrado.
SALVA_VETORES PROC
        PUSH DS
        PUSH ES
        PUSH SI
        PUSH CX
        CALL VETORES_DO_NIVEL   ; DI = cópia deste nível
        PUSH CS
        POP  ES
        XOR  SI, SI
        MOV  DS, SI             ; DS:SI = 0000:0000
        MOV  CX, VETORES_SALVOS*2
        CLI
        REP  MOVSW
        STI
        POP  CX
        POP  SI
        POP  ES
        POP  DS
        RET
SALVA_VETORES ENDP

RESTAURA_VETORES PROC
        CALL VETORES_DO_NIVEL
        MOV  SI, DI
        PUSH CS
        POP  DS
        XOR  DI, DI
        MOV  ES, DI             ; ES:DI = 0000:0000
        MOV  CX, VETORES_SALVOS*2
        REP  MOVSW
        RET
RESTAURA_VETORES ENDP

; VETORES_DO_NIVEL: DI = OFFSET vetores + nível * 256
VETORES_DO_NIVEL PROC
        MOV  DI, OFFSET vetores
        MOV  AL, CS:nivel
        XOR  AH, AH
        XCHG AL, AH             ; AX = nível * 256
        ADD  DI, AX
        RET
VETORES_DO_NIVEL ENDP

; ===============================================================
; Sistema de arquivos MINIFS
; ===============================================================
; Setor 1 = diretório: 16 entradas de 32 bytes
;   +0  nome (8 letras + 3 da extensão, com espaços, sem o ponto)
;   +11 atributo (04h = arquivo do sistema)
;   +12 primeiro setor (LBA)
;   +14 número de setores
;   +16 tamanho em bytes (dword)
; Cada arquivo ocupa setores seguidos, a partir do setor 2.

; ACHA_ARQUIVO: DS:DX = nome "ARQ.EXT" com 0 no fim.
; Devolve SI = entrada no diretório (segmento do kernel) ou CF = 1.
ACHA_ARQUIVO PROC
        PUSH AX
        PUSH CX
        PUSH DI
        PUSH ES
        CALL NOME_83            ; converte para 'ARQ     EXT' em CS:nome83
        PUSH CS
        POP  ES
        MOV  SI, OFFSET diretorio
        MOV  CX, ENTRADAS
@@entrada:
        PUSH CX
        PUSH SI
        PUSH DS
        PUSH CS
        POP  DS
        MOV  DI, OFFSET nome83
        MOV  CX, 11
        REPE CMPSB
        POP  DS
        POP  SI
        POP  CX
        JE   @@achou
        ADD  SI, 32
        LOOP @@entrada
        STC
        JMP  SHORT @@fim
@@achou:
        CLC
@@fim:  POP  ES
        POP  DI
        POP  CX
        POP  AX
        RET
ACHA_ARQUIVO ENDP

; NOME_83: "cobra.com" (DS:DX) -> "COBRA   COM" (CS:nome83)
NOME_83 PROC
        PUSH AX
        PUSH CX
        PUSH SI
        PUSH DI
        PUSH ES
        PUSH CS
        POP  ES
        MOV  DI, OFFSET nome83
        MOV  AL, ' '
        MOV  CX, 11
        REP  STOSB              ; tudo espaço
        MOV  SI, DX
        MOV  DI, OFFSET nome83
        MOV  CX, 8              ; até 8 letras no nome
@@nome: LODSB
        CALL MAIUSCULA
        OR   AL, AL
        JZ   @@fim
        CMP  AL, '.'
        JE   @@ext
        JCXZ @@nome             ; nome comprido: ignora o resto
        STOSB
        DEC  CX
        JMP  @@nome
@@ext:  MOV  DI, OFFSET nome83+8
        MOV  CX, 3
@@e:    LODSB
        CALL MAIUSCULA
        OR   AL, AL
        JZ   @@fim
        STOSB
        LOOP @@e
@@fim:  POP  ES
        POP  DI
        POP  SI
        POP  CX
        POP  AX
        RET
NOME_83 ENDP

MAIUSCULA PROC
        CMP  AL, 'a'
        JB   @@fim
        CMP  AL, 'z'
        JA   @@fim
        SUB  AL, 'a'-'A'
@@fim:  RET
MAIUSCULA ENDP

; LE_ARQUIVO: lê o arquivo da entrada CS:SI para ES:BX, setor por setor
LE_ARQUIVO PROC
        PUSH AX
        PUSH BX
        PUSH CX
        MOV  AX, CS:[SI+12]     ; primeiro setor
        MOV  CX, CS:[SI+14]     ; quantos
        JCXZ @@fim
@@setor:
        CALL LE_SETOR
        INC  AX
        ADD  BX, 512
        LOOP @@setor
@@fim:  POP  CX
        POP  BX
        POP  AX
        RET
LE_ARQUIVO ENDP

; LE_SETOR: setor lógico AX para ES:BX (a mesma conta do setor de boot)
LE_SETOR PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH DI
        XOR  DX, DX
        MOV  CX, SETORES_TRILHA
        DIV  CX
        MOV  CL, DL
        INC  CL                 ; setor (1 a 18)
        MOV  DH, AL
        AND  DH, CABECAS-1      ; cabeça
        SHR  AX, 1
        MOV  CH, AL             ; cilindro
        MOV  DL, CS:drive
        MOV  DI, 3
@@tenta:
        MOV  AX, 0201h
        INT  13h
        JNC  @@ok
        XOR  AH, AH
        INT  13h
        DEC  DI
        JNZ  @@tenta
        PUSH DS
        PUSH SI
        PUSH CS
        POP  DS
        MOV  SI, OFFSET msg_erro_disco
        CALL K_ESCREVE
        POP  SI
        POP  DS
        STC
@@ok:   POP  DI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
LE_SETOR ENDP

; ===============================================================
; Console (pela BIOS)
; ===============================================================
LE_TECLA PROC
        XOR  AH, AH
        INT  16h                ; AL = ASCII, AH = scan code
        RET
LE_TECLA ENDP

; K_CARACTERE: escreve AL pela INT 10h, AH=0Eh (entende 13, 10, 8 e 7)
K_CARACTERE PROC
        PUSH AX
        PUSH BX
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        POP  BX
        POP  AX
        RET
K_CARACTERE ENDP

; K_ESCREVE: texto terminado em 0 (DS:SI)
K_ESCREVE PROC
        PUSH AX
        PUSH SI
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        CALL K_CARACTERE
        JMP  @@car
@@fim:  POP  SI
        POP  AX
        RET
K_ESCREVE ENDP

; ===============================================================
; Dados
; ===============================================================
; tabela de funções da INT 21h: número (1 byte) e endereço (1 word)
funcoes     DB 01h
            DW F_01
            DB 02h
            DW F_02
            DB 07h
            DW F_08
            DB 08h
            DW F_08
            DB 09h
            DW F_09
            DB 0Ah
            DW F_0A
            DB 0Bh
            DW F_0B
            DB 19h
            DW F_19
            DB 25h
            DW F_25
            DB 30h
            DW F_30
            DB 35h
            DW F_35
            DB 4Bh
            DW F_4B
            DB 4Ch
            DW F_4C
            DB 4Dh
            DW F_4D
            DB 80h
            DW F_80
            DB 81h
            DW F_81
            DB 0FFh             ; fim da tabela

msg_ola     DB 13, 10, 'MINIOS 1.0 - o sistema do Curso Assembly 8086', 13, 10, 0
msg_pronto  DB 'Kernel em 0800:0000, INT 20h e 21h instaladas.', 13, 10, 0
msg_sem_shell DB 'SHELL.COM nao esta no disco. Sistema parado.', 13, 10, 0
msg_div_zero DB 13, 10, 'Divisao por zero! O programa foi encerrado.', 13, 10, 0
msg_erro_disco DB 13, 10, 'Erro lendo o disquete.', 13, 10, 0
nome_shell  DB 'SHELL.COM', 0
cmd_vazia   DB 0, 13

drive       DB 0
nivel       DB 0
codigo_saida DB 0
nome83      DB 11 DUP (' ')
pilha_ss    DW MAX_NIVEIS DUP (0)
pilha_sp    DW MAX_NIVEIS DUP (0)
vetores     DB MAX_NIVEIS*VETORES_SALVOS*4 DUP (0)
diretorio   DB 512 DUP (0)
KERNEL ENDS
END inicio
```

## O disquete com o kernel

Este disquete tem o setor de boot da [aula 40](aula:aula40), este kernel, o shell da [aula 43](aula:aula43) e um programa de teste, o **OI.COM**, que só usa a INT 21h do kernel. Clique em **▶ Dar boot**, digite `DIR` e depois `OI`.

```asm boot titulo="DISCO2.IMG"
;### ARQUIVO BOOT.BIN = aula40/BOOT.ASM
;### ARQUIVO KERNEL.SYS = aula41/KERNEL.ASM
;### ARQUIVO SHELL.COM = aula43/SHELL.ASM
;### ARQUIVO OI.COM
; OI.COM: um programa comum que só conversa com a INT 21h do kernel
.MODEL TINY
.CODE
        ORG 100h
inicio: MOV  AH, 09h
        MOV  DX, OFFSET msg_oi
        INT  21h
        MOV  AH, 30h            ; quem é o sistema?
        INT  21h
        CMP  BX, 'IM'           ; o kernel do MINIOS responde BX = "MI"
        MOV  DX, OFFSET msg_minios
        JE   @@diz
        MOV  DX, OFFSET msg_dos
@@diz:  MOV  AH, 09h
        INT  21h
        MOV  AH, 09h
        MOV  DX, OFFSET msg_tecla
        INT  21h
        MOV  AH, 08h            ; espera uma tecla, sem mostrar
        INT  21h
        MOV  AX, 4C00h          ; volta para o shell
        INT  21h
msg_oi     DB 'Oi! Eu sou o OI.COM, rodando em 3000:0100.', 13, 10, '$'
msg_minios DB 'A funcao 30h diz que o sistema e o MINIOS.', 13, 10, '$'
msg_dos    DB 'A funcao 30h diz que o sistema e o DOS.', 13, 10, '$'
msg_tecla  DB 'Aperte uma tecla para voltar ao shell.', 13, 10, '$'
END inicio
```

Com o disquete rodando, abra o depurador e confira:

- em **0000:0084** (o vetor 21h) está `0800:xxxx`, o endereço da `INT21_ROTINA`;
- quando o `OI` chama a INT 21h, a pilha em 3000:FFxx tem o quadro, com o `AH=09h` em BP+1;
- depois que o `OI` termina, o vetor da INT 9 é o mesmo de antes (a [aula 42](aula:aula42) explica por quê).

## Exercícios

```exercicio
id: a41-1
titulo: Procurar na tabela de funções
nivel: 1
--- enunciado
A tabela **funcoes** tem entradas de 3 bytes: o número da função (DB) e o endereço da rotina (DW), terminando com o byte **0FFh**. Procure a função **AH** na tabela. Se achar, devolva o endereço em **BX** e **CF = 0**. Se não achar, devolva **CF = 1**.
--- inicial
        JMP  inicio
funcoes DB 01h
        DW 1111h
        DB 09h
        DW 2222h
        DB 4Ch
        DW 3333h
        DB 0FFh
inicio: ; AH = função procurada
        ; BX = endereço e CF = 0, ou CF = 1
        CLC
--- testes
[{ "nome": "função 01h", "setup": { "AX": 256, "BX": 0 }, "espera": { "BX": 4369, "CF": 0 } },
 { "nome": "função 09h", "setup": { "AX": 2304, "BX": 0 }, "espera": { "BX": 8738, "CF": 0 } },
 { "nome": "função 4Ch (a última)", "setup": { "AX": 19456, "BX": 0 }, "espera": { "BX": 13107, "CF": 0 } },
 { "nome": "função 02h não existe", "setup": { "AX": 512 }, "espera": { "CF": 1 } },
 { "nome": "função 0FFh também não (é o fim da tabela)", "setup": { "AX": 65280 }, "espera": { "CF": 1 } }]
--- dicas
Comece com SI = OFFSET funcoes. Em cada entrada, leia o número com MOV AL,[SI].
Teste o fim da tabela (0FFh) antes de comparar com AH: senão a função 0FFh "acharia" o fim.
Achou: MOV BX,[SI+1] e CLC. Não achou: ADD SI,3 e volte. No fim da tabela: STC.
--- solucao
        JMP  inicio
funcoes DB 01h
        DW 1111h
        DB 09h
        DW 2222h
        DB 4Ch
        DW 3333h
        DB 0FFh
inicio: MOV  SI, OFFSET funcoes
procura:
        MOV  AL, [SI]
        CMP  AL, 0FFh
        JE   nao_tem
        CMP  AL, AH
        JE   achou
        ADD  SI, 3
        JMP  procura
achou:  MOV  BX, [SI+1]
        CLC
        JMP  SHORT fim
nao_tem:
        STC
fim:
```

```exercicio
id: a41-2
titulo: O CF dentro do quadro
nivel: 2
--- enunciado
**quadro** tem os 12 words que a INT 21h do kernel guarda na pilha (AX, BX, CX, DX, SI, DI, ES, DS, BP, IP, CS e FLAGS, nessa ordem), e o código já faz **BP** apontar para ele.

Escreva o fim de uma função do kernel. Se **AX = 0**, a função deu certo: desligue o bit 0 (CF) das FLAGS salvas (word 11 do quadro). Se **AX ≠ 0**, AX é um código de erro: grave-o no AX salvo (word 0) e ligue o CF das FLAGS salvas. Não mexa nos outros bits das FLAGS. Use `[BP+n]`.
--- inicial
        JMP  inicio
quadro  DW 12 DUP (0)
inicio: MOV  BP, OFFSET quadro
        ; AX = 0: CF = 0 nas FLAGS salvas
        ; AX <> 0: AX salvo = AX e CF = 1 nas FLAGS salvas
--- testes
[{ "nome": "deu certo: desliga o CF", "setup": { "AX": 0, "quadro": [5, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62211] }, "espera": { "mem": { "quadro": [5, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62210] } } },
 { "nome": "deu certo e o CF já estava desligado", "setup": { "AX": 0, "quadro": [5, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62210] }, "espera": { "mem": { "quadro": [5, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62210] } } },
 { "nome": "erro 2: arquivo não encontrado", "setup": { "AX": 2, "quadro": [19200, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62210] }, "espera": { "mem": { "quadro": [2, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62211] } } },
 { "nome": "erro 8 com outras flags ligadas", "setup": { "AX": 8, "quadro": [19200, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62658] }, "espera": { "mem": { "quadro": [8, 6, 7, 8, 0, 0, 0, 0, 0, 256, 4096, 62659] } } }]
--- dicas
A word 11 do quadro fica em [BP+22]; o AX salvo, em [BP+0].
OR WORD PTR [BP+22],1 liga só o bit 0. AND WORD PTR [BP+22],0FFFEh desliga só ele.
Teste AX com OR AX,AX (ou CMP AX,0) e salte para um dos dois casos.
--- solucao
        JMP  inicio
quadro  DW 12 DUP (0)
inicio: MOV  BP, OFFSET quadro
        OR   AX, AX
        JNZ  erro
        AND  WORD PTR [BP+22], 0FFFEh
        JMP  SHORT fim
erro:   MOV  [BP+0], AX
        OR   WORD PTR [BP+22], 1
fim:
```

```exercicio
id: a41-3
titulo: A função 09h sem DOS
nivel: 2
--- enunciado
Escreva a função 09h do kernel: mostre o texto que começa em **DS:DX** até o caractere **'$'** (sem mostrar o '$'), usando só a BIOS (`INT 10h, AH=0Eh`, BX = 0007h).
--- inicial
        JMP  inicio
texto   DB 40 DUP ('$')
inicio: MOV  DX, OFFSET texto
        ; mostre DS:DX até o '$' pela INT 10h
--- testes
[{ "nome": "uma frase", "setup": { "texto": "Ola do kernel!" }, "espera": { "telaContem": "Ola do kernel!" } },
 { "nome": "outra frase", "setup": { "texto": "MINIOS 1.0" }, "espera": { "telaContem": "MINIOS 1.0" } },
 { "nome": "o '$' não aparece", "setup": { "texto": "fim" }, "espera": { "saida": "fim" } }]
--- dicas
Copie DX para SI e use LODSB (CLD antes).
Compare AL com '$' antes de escrever; se for, termine.
Para escrever: MOV AH,0Eh / MOV BX,0007h / INT 10h. AH muda a cada volta: refaça-o dentro do laço.
--- solucao
        JMP  inicio
texto   DB 40 DUP ('$')
inicio: MOV  DX, OFFSET texto
        MOV  SI, DX
        CLD
proximo:
        LODSB
        CMP  AL, '$'
        JE   fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  proximo
fim:
```

```quiz
? Por que a INT 21h do kernel guarda todos os registradores num quadro na pilha?
+ Para poder usar os registradores à vontade e ainda ler os parâmetros e escrever as respostas de quem chamou, por [BP+n]
- Porque o IRET só funciona com 9 words na pilha
- Para economizar memória
> Na saída, os POPs devolvem a quem chamou o quadro, já com as respostas que as funções escreveram nele.

? Uma função do kernel faz `STC` e depois `JMP SAI_21` (os POPs e o IRET). Quem chamou recebe CF = 1?
- Sim, o STC vale até a próxima instrução que mexer no CF
+ Não: o IRET restaura as FLAGS que a INT guardou, e o CF volta ao que era; é preciso mudar o bit 0 de [BP+Q_FLAGS]
- Só se o programa estiver no nível 0
> Por isso existem FIM_OK e FIM_ERRO, que mexem no CF dentro do quadro.

? Dentro da INT 21h, por que o kernel lê as variáveis dele com `CS:` na frente?
+ Porque DS ainda é o de quem chamou (a função 09h precisa dele), e os dados do kernel estão no segmento do código
- Porque o 8086 só lê dados com CS dentro de interrupções
- Porque DS vale 0 dentro de uma interrupção
> O kernel roda com CS = 0800h, e o segmento dele tem código e dados.

? Por que o kernel executa `STI` logo na entrada da INT 21h?
- Para permitir uma INT 21h dentro da outra
+ Porque a instrução INT desliga as interrupções, e a INT 16h (ler tecla) e o relógio dependem delas
- Porque o STI limpa o CF
> A tecla chega ao buffer pela IRQ 1. Com IF = 0, a espera da INT 16h nunca terminaria.

? Como o kernel instala o seu vetor da INT 21h?
- Chamando a INT 21h, AH=25h
+ Escrevendo o offset em 0000:0084h e o segmento em 0000:0086h, com CLI em volta
- Chamando a INT 19h
> Não há DOS para pedir. A tabela de vetores é só memória: 4 bytes por interrupção, a partir de 0000:0000.

? Por que cada peça do MINIOS ganha um segmento de 64 KB inteiro?
- Porque o 8086 não permite dois programas no mesmo segmento
+ Para simplificar: cada programa usa ORG 100h, tem a pilha no fim do seu segmento e nunca encosta no vizinho, sem precisar de MCBs
- Porque os disquetes guardam 64 KB por trilha
> O DOS de verdade divide a memória com os MCBs (aula 26). O MINIOS troca economia por clareza.

? O que o `JMP WORD PTR CS:[SI+1]` faz?
- Salta para o endereço SI+1
+ Salta para o endereço guardado na word que está em CS:SI+1 (um salto indireto)
- Chama a rotina e volta
> É o despacho pela tabela: a word depois do número da função é o endereço da rotina.
```

## Desafios

1. **Mais uma função.** Acrescente ao kernel a função **2Ah** (data) e a **2Ch** (hora), lendo o relógio da BIOS (INT 1Ah, AH=04h e 02h, em BCD: [capítulo 7 do livro](livro:cap07)) e convertendo para binário nos registradores que o DOS usa (CX = ano, DH = mês, DL = dia; CH = hora, CL = minuto, DH = segundo).
2. **Tabela direta.** Troque a tabela com procura por uma tabela de 256 words indexada por AH (`MOV BL,AH / XOR BH,BH / SHL BX,1 / JMP CS:tabela[BX]`), com as posições vazias apontando para uma rotina de erro. Compare o tamanho e a velocidade das duas.
3. **Ctrl+C.** Faça a função 01h e a 0Ah reconhecerem Ctrl+C (código 3) e chamarem a INT 23h; instale uma INT 23h no kernel que encerra o programa atual, como o DOS faz.
4. **Tela de erro.** Na INT 0, mostre também CS:IP de onde a divisão aconteceu (estão no quadro que a CPU empilhou: o kernel não montou o quadro dele nesse caso, então use `MOV BP,SP` logo na entrada).
5. **Contar chamadas.** Guarde quantas vezes cada função foi chamada (um contador por entrada da tabela) e faça uma função 82h que devolve esse número. Use-a para descobrir quais funções o COBRA.COM chama.

## No livro

- [Capítulo 2, vetores e exceções](livro:cap02): a tabela de vetores, a INT 0 e a faixa de interrupções livres para programas.
- [Capítulo 21, sem DOS](livro:cap21): o kernel instalando vetores, o mapa de memória e o caminho do boot ao shell.
- [Capítulo 22, o DOS por dentro](livro:cap22): como o MS-DOS organiza a INT 21h e a comparação função a função com o MINIOS.
- [Capítulo 3, o vídeo](livro:cap03) e [capítulo 6, o teclado](livro:cap06): a INT 10h e a INT 16h, que o kernel usa para todo o console.
- [Capítulo 8, equipamento e memória](livro:cap08): os 640 KB, a INT 12h e o que fica acima de A0000h.

:::resumo
- O kernel fica na memória e oferece serviços pela INT 21h. O do MINIOS mora em 0800:0000, com a pilha no fim do próprio segmento, e conversa com o hardware pela BIOS.
- O mapa de memória é decidido antes do código: IVT, área de dados, kernel em 0800h, shell em 2000h, programas em 3000h e 4000h, vídeo em A000h e B800h.
- Instalar um vetor sem DOS é escrever offset e segmento em 0000:(n × 4), com CLI em volta.
- A INT 21h guarda os 9 registradores num quadro na pilha de quem chamou; BP aponta para ele, e `[BP+Q_xx]` lê parâmetros e escreve respostas. Os dados do kernel são lidos com `CS:`, porque DS é de quem chamou.
- As funções são achadas numa tabela (DB número, DW endereço) e chamadas com `JMP WORD PTR CS:[SI+1]`.
- O resultado de erro vai no CF das FLAGS **salvas** (bit 0 de `[BP+Q_FLAGS]`), porque o IRET restaura as FLAGS. O código do erro vai no AX salvo.
- STI na entrada: sem interrupções, a INT 16h nunca recebe a tecla.
:::
