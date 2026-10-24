---
id: aula44
numero: 44
modulo: 14
titulo: Utilitários e o disquete completo do MINIOS
subtitulo: INFO, TECLAS e SETOR conversam com a BIOS; depois, o disquete inteiro com boot, kernel, shell, utilitários e os sete jogos
duracao: 120 min
objetivos: perguntar à BIOS o que existe no PC com as INT 11h, 12h e 10h/0Fh e lendo a ROM em F000:FFF5 e F000:FFFE; descobrir se o programa roda no DOS ou no MINIOS pela função 30h; mostrar o scan code, o ASCII e o estado das teclas de controle com a INT 16h; ler um número da linha de comando no PSP e converter LBA em cilindro, cabeça e setor; ler um setor com a INT 13h e mostrá-lo em hexadecimal e texto; montar o disquete completo do MINIOS a partir dos blocos das outras aulas e entender o mapa dele setor a setor; levar a imagem para o DOSBox, o 86Box, o QEMU ou um disquete de verdade; saber o que falta para o MINIOS virar um DOS
---

## Os programas que vêm no disquete

Um sistema operacional sem programas é só um prompt piscando. O MS-DOS 1.0 vinha num disquete de 160 KB com o `COMMAND.COM` e um punhado de utilitários: `FORMAT`, `CHKDSK`, `SYS`, `DISKCOPY`, `DEBUG`, `EDLIN`. Eram eles que faziam o sistema parecer útil no primeiro dia.

O MINIOS ganha nesta aula três utilitários, todos programas externos que o shell da [aula 43](aula:aula43) roda pela função 4Bh:

| Programa | O que faz | O que ensina |
|----------|-----------|--------------|
| `INFO.COM` | mostra o que a BIOS sabe sobre o PC | INT 11h, INT 12h, INT 10h/0Fh, a ROM em F000h, a área de dados em 0040h |
| `TECLAS.COM` | mostra o código de cada tecla apertada | INT 16h funções 00h e 02h, scan code e ASCII |
| `SETOR.COM` | mostra um setor do disquete em hexadecimal | a linha de comando no PSP, LBA → CHS, INT 13h, *dump* hexadecimal |

E um arquivo de texto, o `LEIAME.TXT`, para o comando `TIPO` ter o que mostrar.

Os três utilitários têm uma propriedade importante: só usam as funções **02h, 09h e 4Ch** da INT 21h, além da BIOS. Essas funções existem no kernel do MINIOS e no DOS, então os mesmos `.COM` rodam **nos dois sistemas**. Os sete jogos das aulas 33 a 39 seguiram a mesma regra (eles usam ainda a 25h e a 35h, para trocar vetores), e é por isso que podem ir para o disquete do MINIOS sem mudar uma linha. Você pode testar cada utilitário aqui mesmo, no DOS do simulador, com o botão "Executar aqui", antes de dar boot no disquete completo.

No fim da aula montamos esse disquete: 14 arquivos, 60 setores, um sistema operacional que dá boot, mostra um prompt e roda jogos. E fechamos o curso avançado com uma conversa honesta sobre o que ainda falta para ele virar um DOS.

## INFO.COM: perguntando à BIOS

Quando o PC liga, o POST (o autoteste da BIOS) examina a máquina e guarda o que encontrou na **área de dados da BIOS**, a partir de 0040:0000 ([a área de dados, no livro](livro:cap17)). Os serviços mais antigos da BIOS só devolvem esses valores. O `INFO.COM` pergunta tudo o que dá para perguntar sem mexer no hardware.

### INT 11h: a lista de equipamentos

A **INT 11h** devolve em AX uma palavra de bits, a mesma que fica em 0040:0010h. No PC original ela vinha das chaves DIP da placa-mãe, que o dono ajustava com uma caneta ao instalar um drive ou uma placa de vídeo; no AT em diante, a BIOS monta a palavra a partir da CMOS ([equipamento e memória, no livro](livro:cap08)).

```diagrama titulo="A palavra da INT 11h (AX)"
 bit: 15 14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
     ┌─────┬──┬──┬────────┬──┬─────┬─────┬─────┬──┬──┐
     │impr.│  │jg│ seriais│  │disq.│vídeo│     │co│dq│
     └─────┴──┴──┴────────┴──┴─────┴─────┴─────┴──┴──┘
      │          │  │          │     │           │  └─ 1 = há drive de disquete
      │          │  │          │     │           └─ 1 = há coprocessador 8087
      │          │  │          │     └─ vídeo inicial: 00 = EGA/VGA, 01 = cor 40 col.,
      │          │  │          │                       10 = cor 80 col., 11 = mono
      │          │  │          └─ quantos disquetes − 1 (vale se o bit 0 = 1)
      │          │  └─ quantas portas seriais
      │          └─ 1 = há adaptador de joystick
      └─ quantas impressoras
```

Para tirar um campo do meio da palavra, o `INFO` faz o que todo programa da época fazia: desloca até o campo chegar ao bit 0 e apaga o resto com `AND`.

```asm fragmento titulo="INFO.ASM: quantos disquetes e qual vídeo"
        INT  11h
        MOV  equip, AX
        MOV  AX, equip          ; bit 0: tem disquete; bits 6-7: quantos - 1
        TEST AL, 1
        JZ   @@sem_drive
        MOV  CL, 6
        SHR  AX, CL
        AND  AX, 3
        INC  AX
        JMP  SHORT @@drives
@@sem_drive:
        XOR  AX, AX
@@drives:
        CALL ESCREVE_NUM
        ...
        MOV  BX, equip          ; bits 4-5: vídeo inicial
        MOV  CL, 4
        SHR  BX, CL
        AND  BX, 3
        SHL  BX, 1
        MOV  DX, videos[BX]     ; tabela com 4 endereços de mensagens
        CALL TEXTO
```

O vídeo inicial vira um **índice numa tabela de mensagens** (`videos DW v_ega, v_cga40, v_cga80, v_mono`), a mesma técnica da tabela de comandos do shell: em vez de quatro comparações, um `SHL BX, 1` (cada endereço tem 2 bytes) e um `MOV` indexado. O 8086 só desloca de 1 em 1 ou por CL, por isso o `MOV CL, 6` antes do `SHR`.

### INT 12h e INT 10h/0Fh

A **INT 12h** devolve em AX os KB de memória convencional (o valor de 0040:0013h), a mesma que o `MEM` do shell mostra. A **função 0Fh da INT 10h** devolve o modo de vídeo atual em AL e o número de colunas em AH ([vídeo, no livro](livro:cap03)). No prompt do MINIOS o resultado é o modo 03h com 80 colunas; rode o `INFO` logo depois de um jogo que esqueceu de voltar ao modo texto e ele vai dizer 13h com 40 colunas.

### A ROM: data e modelo

A ROM da BIOS ocupa o fim do primeiro megabyte, e os últimos 16 bytes têm um formato combinado desde o PC original de 1981:

```diagrama titulo="Os últimos 16 bytes do primeiro megabyte (F000:FFF0 a F000:FFFF)"
  F000:FFF0  ┌──────────────────────┐
             │ JMP FAR para o POST  │  a primeira instrução que a CPU executa ao ligar
  F000:FFF5  ├──────────────────────┤
             │ "mm/dd/aa" (8 bytes) │  a data da BIOS, em ASCII, no formato americano
  F000:FFFD  ├──────────────────────┤
             │ (livre)              │
  F000:FFFE  ├──────────────────────┤
             │ modelo               │  FFh = PC, FEh/FBh = XT, FDh = PCjr,
             │                      │  FCh = AT (e quase todos os 286 e 386),
             │                      │  FAh = PS/2 modelo 30, F8h = PS/2 80
  F000:FFFF  └──────────────────────┘  (o byte de checksum de alguns modelos)
```

Ler a ROM é só trocar DS e ler, como qualquer memória:

```asm fragmento titulo="INFO.ASM: lendo a data e o modelo na ROM"
        PUSH DS
        MOV  AX, 0F000h
        MOV  DS, AX
        MOV  SI, 0FFF5h         ; 8 caracteres: "mm/dd/aa"
        MOV  CX, 8
@@data: LODSB
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        LOOP @@data
        MOV  AL, DS:[0FFFEh]    ; FFh = PC, FEh = XT, FCh = AT
        POP  DS
        MOV  modelo, AL
```

Duas coisas para notar. O `INT 21h` dentro do laço funciona mesmo com DS = F000h porque a função 02h só usa DL. E o `MOV modelo, AL` vem **depois** do `POP DS`: com DS = F000h, a variável `modelo` seria procurada na ROM, e a escrita se perderia.

:::anos90 O byte que dizia quem você era
Programas e jogos dos anos 80 liam F000:FFFEh para saber em que máquina estavam: o PCjr tinha som de três vozes e vídeo de 16 cores, o AT tinha relógio e um segundo PIC, o PS/2 tinha VGA. Os fabricantes de clones copiavam o byte FCh para serem tratados como um AT, e a data da BIOS virou uma espécie de documento de identidade: a da Phoenix, a da AMI e a da Award traziam datas diferentes, e muitos programas de diagnóstico mostravam essa data na tela de abertura.
:::

### Os tiques e a pergunta "onde estou?"

A palavra em **0040:006Ch** é o contador de tiques do relógio: a INT 8 da BIOS soma 1 a cada 1/18,2 segundo ([o tempo, no livro](livro:cap07)). O `INFO` mostra a palavra de baixo; rode o programa duas vezes e veja o número crescer. No MINIOS ele é pequeno (o relógio começou a contar no boot); no DOS do simulador também.

Por último, o `INFO` pergunta à função **30h** qual é o sistema. O kernel do MINIOS responde com a versão 1.0 e, de quebra, BX = `'MI'`. O DOS devolve em BX outra coisa (o número do fabricante, o OEM), nunca `'MI'`. Assim o mesmo `.COM` sabe se está no DOS ou no MINIOS:

```asm fragmento titulo="INFO.ASM: DOS ou MINIOS?"
        MOV  AH, 30h
        INT  21h
        CMP  BX, 'IM'           ; o MINIOS responde BX = "MI"
        MOV  DX, OFFSET msg_minios
        JE   @@sis
        MOV  DX, OFFSET msg_dos
@@sis:  CALL TEXTO
```

:::cpu Por que 'IM' e não 'MI'?
O kernel grava os bytes `'M'` e `'I'`, nessa ordem, em BL e BH: BL = 'M' (4Dh) e BH = 'I' (49h), ou seja, BX = 494Dh. Uma constante de dois caracteres no MASM/TASM vira uma palavra com o **primeiro caractere no byte alto**: `'IM'` = 49h·256 + 4Dh = 494Dh. É a confusão de sempre do *little endian*: na memória os bytes ficam "MI", mas o número que eles formam se escreve "IM". Outro detalhe: o `MOV DX` entre o `CMP` e o `JE` não estraga o ZF, porque o `MOV` não altera flags.
:::

```asm executar titulo="INFO.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  INFO.ASM  -  o que a BIOS sabe sobre este PC                 ║
; ║  Curso Assembly 8086, aula 44 (utilitário do MINIOS)          ║
; ║                                                               ║
; ║  Roda no MINIOS e também no DOS: só usa INT 21h 02h/09h/4Ch,  ║
; ║  a BIOS e a memória da ROM.                                   ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

inicio:
        MOV  DX, OFFSET msg_titulo
        CALL TEXTO

        ; --- INT 11h: lista de equipamentos (bits em AX) ---
        INT  11h
        MOV  equip, AX
        MOV  DX, OFFSET msg_disquetes
        CALL TEXTO
        MOV  AX, equip          ; bit 0: tem disquete; bits 6-7: quantos - 1
        TEST AL, 1
        JZ   @@sem_drive
        MOV  CL, 6
        SHR  AX, CL
        AND  AX, 3
        INC  AX
        JMP  SHORT @@drives
@@sem_drive:
        XOR  AX, AX
@@drives:
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_video_ini
        CALL TEXTO
        MOV  BX, equip          ; bits 4-5: vídeo inicial
        MOV  CL, 4
        SHR  BX, CL
        AND  BX, 3
        SHL  BX, 1
        MOV  DX, videos[BX]
        CALL TEXTO

        ; --- INT 12h: memória convencional em KB ---
        MOV  DX, OFFSET msg_memoria
        CALL TEXTO
        INT  12h
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_kb
        CALL TEXTO

        ; --- INT 10h, AH=0Fh: modo de vídeo atual ---
        MOV  DX, OFFSET msg_modo
        CALL TEXTO
        MOV  AH, 0Fh
        INT  10h                ; AL = modo, AH = colunas
        PUSH AX
        XOR  AH, AH
        CALL ESCREVE_HEX2
        MOV  DX, OFFSET msg_colunas
        CALL TEXTO
        POP  AX
        MOV  AL, AH
        XOR  AH, AH
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_crlf
        CALL TEXTO

        ; --- a ROM: data da BIOS em F000:FFF5 e modelo em F000:FFFE ---
        MOV  DX, OFFSET msg_data_bios
        CALL TEXTO
        PUSH DS
        MOV  AX, 0F000h
        MOV  DS, AX
        MOV  SI, 0FFF5h         ; 8 caracteres: "mm/dd/aa"
        MOV  CX, 8
@@data: LODSB
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        LOOP @@data
        MOV  AL, DS:[0FFFEh]    ; FFh = PC, FEh = XT, FCh = AT
        POP  DS
        MOV  modelo, AL
        MOV  DX, OFFSET msg_modelo
        CALL TEXTO
        MOV  AL, modelo
        CALL ESCREVE_HEX2
        MOV  DX, OFFSET msg_h
        CALL TEXTO
        MOV  DX, OFFSET msg_at
        CMP  modelo, 0FCh
        JE   @@nome
        MOV  DX, OFFSET msg_xt
        CMP  modelo, 0FEh
        JE   @@nome
        MOV  DX, OFFSET msg_outro
@@nome: CALL TEXTO

        ; --- área de dados da BIOS: tiques desde a meia-noite (0040:006C) ---
        MOV  DX, OFFSET msg_tiques
        CALL TEXTO
        PUSH ES
        MOV  AX, 0040h
        MOV  ES, AX
        MOV  AX, ES:[006Ch]
        POP  ES
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_crlf
        CALL TEXTO

        ; --- quem é o sistema? INT 21h, AH=30h ---
        MOV  DX, OFFSET msg_sistema
        CALL TEXTO
        MOV  AH, 30h
        INT  21h
        CMP  BX, 'IM'           ; o MINIOS responde BX = "MI"
        MOV  DX, OFFSET msg_minios
        JE   @@sis
        MOV  DX, OFFSET msg_dos
@@sis:  CALL TEXTO

        MOV  AX, 4C00h
        INT  21h

; ---------------------------------------------------------------
TEXTO   PROC
        MOV  AH, 09h
        INT  21h
        RET
TEXTO   ENDP

ESCREVE_NUM PROC                ; AX em decimal
        MOV  BX, 10
        XOR  CX, CX
@@div:  XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        OR   AX, AX
        JNZ  @@div
@@dig:  POP  DX
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        LOOP @@dig
        RET
ESCREVE_NUM ENDP

ESCREVE_HEX2 PROC               ; AL em 2 dígitos hexadecimais
        PUSH AX
        MOV  CL, 4
        SHR  AL, CL
        CALL DIGITO_HEX
        POP  AX
        AND  AL, 0Fh
        CALL DIGITO_HEX
        RET
ESCREVE_HEX2 ENDP

DIGITO_HEX PROC
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 'A'-'9'-1
@@ok:   MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        RET
DIGITO_HEX ENDP

; ---------------------------------------------------------------
equip       DW 0
modelo      DB 0
videos      DW v_ega, v_cga40, v_cga80, v_mono
msg_titulo  DB 'INFO - o que a BIOS sabe sobre este PC', 13, 10
            DB '--------------------------------------', 13, 10, '$'
msg_disquetes DB 'Drives de disquete (INT 11h) .. $'
msg_video_ini DB 13, 10, 'Video inicial (INT 11h) ....... $'
v_ega       DB 'EGA/VGA', 13, 10, '$'
v_cga40     DB 'colorido 40 colunas', 13, 10, '$'
v_cga80     DB 'colorido 80 colunas', 13, 10, '$'
v_mono      DB 'monocromatico', 13, 10, '$'
msg_memoria DB 'Memoria (INT 12h) ............. $'
msg_kb      DB ' KB', 13, 10, '$'
msg_modo    DB 'Modo de video (INT 10h/0Fh) ... $'
msg_colunas DB 'h, colunas: $'
msg_data_bios DB 'Data da BIOS (F000:FFF5) ...... $'
msg_modelo  DB 13, 10, 'Modelo (F000:FFFE) ............ $'
msg_h       DB 'h = $'
msg_at      DB 'PC AT', 13, 10, '$'
msg_xt      DB 'PC XT', 13, 10, '$'
msg_outro   DB 'outro', 13, 10, '$'
msg_tiques  DB 'Tiques do relogio (0040:006C) . $'
msg_sistema DB 'Sistema (INT 21h/30h) ......... $'
msg_minios  DB 'MINIOS', 13, 10, '$'
msg_dos     DB 'DOS', 13, 10, '$'
msg_crlf    DB 13, 10, '$'

END inicio
```

A saída no MINIOS, no simulador:

```diagrama titulo="INFO no MINIOS"
A> INFO
INFO - o que a BIOS sabe sobre este PC
--------------------------------------
Drives de disquete (INT 11h) .. 1
Video inicial (INT 11h) ....... colorido 80 colunas
Memoria (INT 12h) ............. 640 KB
Modo de video (INT 10h/0Fh) ... 03h, colunas: 80
Data da BIOS (F000:FFF5) ...... 10/18/26
Modelo (F000:FFFE) ............ FCh = PC AT
Tiques do relogio (0040:006C) . 140
Sistema (INT 21h/30h) ......... MINIOS
```

:::dica ESCREVE_HEX2 e o truque do 'A'−'9'−1
`DIGITO_HEX` soma `'0'` ao nibble. Para 0 a 9 isso dá o dígito certo. Para 10 a 15 dá `':'` a `'?'`, os seis caracteres que vêm logo depois do `'9'` na tabela ASCII. Somar mais `'A'-'9'-1` (= 7) pula esses seis e cai em `'A'` a `'F'`. É a conversão hexadecimal mais curta sem tabela; outra, famosa, usa `ADD AL,90h / DAA / ADC AL,40h / DAA`, que você pode reconhecer em programas antigos.
:::

## TECLAS.COM: o que o teclado manda

O teclado do PC não manda letras: ele manda o **número da tecla** apertada (o *scan code*), e a BIOS, na INT 9, traduz esse número para um caractere conforme Shift, Ctrl, Alt e Caps Lock ([o teclado, no livro](livro:cap06)). A **INT 16h, função 00h** espera uma tecla e entrega as duas coisas: AH = scan code, AL = ASCII.

O `TECLAS.COM` mostra os dois para cada tecla, até você apertar ESC. Ele é o melhor jeito de entender por que os jogos das aulas 33 a 39 testam o scan code e não o ASCII: as setas, o F1 e o Home **não têm ASCII** (AL = 0), e `a` e `A` têm o mesmo scan code (1Eh), porque são a mesma tecla.

```asm fragmento titulo="TECLAS.ASM: a tecla e o que fazer com o ASCII"
@@tecla:
        XOR  AH, AH
        INT  16h                ; AH = scan code, AL = ASCII
        MOV  tecla, AX
        ...
        MOV  AL, BYTE PTR tecla
        CMP  AL, ' '            ; dá para mostrar o caractere?
        JB   @@especial
        ...                     ; mostra o caractere entre apóstrofos
@@especial:
        MOV  DX, OFFSET msg_controle    ; Enter, ESC, Tab, Ctrl+letra...
        OR   AL, AL
        JNZ  @@mostra
        MOV  DX, OFFSET msg_estendida   ; ASCII 0: seta, F1, Home...
```

| Tecla | Scan (AH) | ASCII (AL) | O TECLAS mostra |
|-------|-----------|------------|-----------------|
| `a` | 1Eh | 61h | `'a'` |
| Shift + `a` | 1Eh | 41h | `'A'` e `ShiftE` |
| Ctrl + `a` | 1Eh | 01h | (controle) e `Ctrl` |
| Enter | 1Ch | 0Dh | (controle) |
| ESC | 01h | 1Bh | (controle), e o programa termina |
| seta para cima | 48h | 00h | (tecla estendida) |
| F1 | 3Bh | 00h | (tecla estendida) |
| Alt + `a` | 1Eh | 00h | (tecla estendida) e `Alt` |

### O estado das teclas de controle

A **função 02h da INT 16h** devolve em AL o byte de estado do teclado, o mesmo de 0040:0017h. Cada bit é uma tecla de controle que está apertada (ou um modo ligado):

```diagrama titulo="O byte de estado do teclado (INT 16h, AH = 02h)"
  bit:   7      6      5      4      3     2      1        0
      ┌──────┬──────┬──────┬──────┬─────┬──────┬────────┬────────┐
      │Insert│ Caps │ Num  │Scroll│ Alt │ Ctrl │ Shift  │ Shift  │
      │ lig. │ Lock │ Lock │ Lock │     │      │esquerdo│ direito│
      └──────┴──────┴──────┴──────┴─────┴──────┴────────┴────────┘
       └──── modos (ligam e desligam) ──┘└──── apertadas agora ───┘
```

O `TECLAS` mostra só os bits 0 a 3, com um laço que anda por uma **tabela de nomes de tamanho fixo**: cada nome tem exatamente 8 bytes (contando o `$`), então o próximo nome está sempre em SI + 8, e a máscara BL anda junto, de bit em bit:

```asm fragmento titulo="TECLAS.ASM: um nome para cada bit ligado"
        MOV  AH, 02h            ; Shift, Ctrl e Alt (INT 16h, AH=02h)
        INT  16h
        MOV  estado, AL
        MOV  SI, OFFSET nomes_estado
        MOV  BL, 1              ; máscara: bit 0, depois 1, 2 e 3
@@bit:  TEST estado, BL
        JZ   @@prox
        MOV  DX, SI
        CALL TEXTO
@@prox: ADD  SI, 8
        SHL  BL, 1
        CMP  BL, 10h
        JB   @@bit
...
nomes_estado DB ' ShiftD$'
            DB ' ShiftE$'
            DB ' Ctrl  $'
            DB ' Alt   $'
```

Compare com a tabela do shell: lá os nomes têm tamanhos diferentes e terminam em zero, porque o laço precisa *comparar* nomes; aqui o laço só precisa *achar* o nome número n, e com tamanho fixo isso é uma soma.

:::atencao A função 02h diz o estado de agora
O estado é lido **depois** de a tecla chegar, não no momento em que ela foi apertada. Se você soltar o Shift muito rápido, o `TECLAS` pode mostrar `'A'` sem o `ShiftE`. A BIOS guarda o ASCII já traduzido no buffer do teclado, mas não o estado do Shift daquele instante.
:::

```asm executar titulo="TECLAS.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  TECLAS.ASM  -  mostra o código de cada tecla (INT 16h)       ║
; ║  Curso Assembly 8086, aula 44 (utilitário do MINIOS)          ║
; ║                                                               ║
; ║  Para cada tecla: o scan code (a posição física da tecla) e   ║
; ║  o código ASCII (o caractere). ESC sai.                       ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

inicio:
        MOV  DX, OFFSET msg_titulo
        CALL TEXTO
@@tecla:
        XOR  AH, AH
        INT  16h                ; AH = scan code, AL = ASCII
        MOV  tecla, AX
        MOV  DX, OFFSET msg_scan
        CALL TEXTO
        MOV  AL, BYTE PTR tecla+1
        CALL ESCREVE_HEX2
        MOV  DX, OFFSET msg_ascii
        CALL TEXTO
        MOV  AL, BYTE PTR tecla
        CALL ESCREVE_HEX2
        MOV  AL, BYTE PTR tecla
        CMP  AL, ' '            ; dá para mostrar o caractere?
        JB   @@especial
        MOV  DX, OFFSET msg_abre
        CALL TEXTO
        MOV  DL, BYTE PTR tecla
        MOV  AH, 02h
        INT  21h
        MOV  DL, 27h            ; o apóstrofo que fecha
        MOV  AH, 02h
        INT  21h
        JMP  SHORT @@estado
@@especial:
        MOV  DX, OFFSET msg_controle    ; Enter, ESC, Tab, Ctrl+letra...
        OR   AL, AL
        JNZ  @@mostra
        MOV  DX, OFFSET msg_estendida   ; ASCII 0: seta, F1, Home...
@@mostra:
        CALL TEXTO
@@estado:
        MOV  AH, 02h            ; Shift, Ctrl e Alt (INT 16h, AH=02h)
        INT  16h
        MOV  estado, AL
        MOV  SI, OFFSET nomes_estado
        MOV  BL, 1
@@bit:  TEST estado, BL
        JZ   @@prox
        MOV  DX, SI
        CALL TEXTO
@@prox: ADD  SI, 8
        SHL  BL, 1
        CMP  BL, 10h
        JB   @@bit
        MOV  DX, OFFSET msg_crlf
        CALL TEXTO
        CMP  BYTE PTR tecla, 27 ; ESC
        JNE  @@tecla
        MOV  AX, 4C00h
        INT  21h

TEXTO   PROC
        MOV  AH, 09h
        INT  21h
        RET
TEXTO   ENDP

ESCREVE_HEX2 PROC
        PUSH AX
        MOV  CL, 4
        SHR  AL, CL
        CALL DIGITO_HEX
        POP  AX
        AND  AL, 0Fh
        CALL DIGITO_HEX
        RET
ESCREVE_HEX2 ENDP

DIGITO_HEX PROC
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 'A'-'9'-1
@@ok:   MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        RET
DIGITO_HEX ENDP

tecla       DW 0
estado      DB 0
msg_titulo  DB 'TECLAS - aperte qualquer tecla (ESC sai)', 13, 10, '$'
msg_scan    DB 'scan $'
msg_ascii   DB 'h  ascii $'
msg_abre    DB "h  '$"
msg_estendida DB 'h  (tecla estendida)$'
msg_controle DB 'h  (controle)$'
; 8 bytes por nome (bits 0 a 3 do estado do teclado)
nomes_estado DB ' ShiftD$'
            DB ' ShiftE$'
            DB ' Ctrl  $'
            DB ' Alt   $'
msg_crlf    DB 13, 10, '$'

END inicio
```

## SETOR.COM: olhando o disquete por dentro

O `SETOR.COM` é o mais completo dos três. Ele lê o número de um setor na linha de comando, converte para cilindro, cabeça e setor, lê o setor pela BIOS e mostra os 512 bytes em hexadecimal e em texto, 256 de cada vez. É uma versão de bolso do `DEBUG` (com o comando `L` para ler setores) ou do Norton Disk Editor, e o jeito mais direto de ver que o diretório do MINIFS e o setor de boot são só bytes.

```diagrama titulo="O caminho do SETOR.COM"
  "SETOR 1"        PSP:80h          LE_PARAMETRO      LBA → CHS          INT 13h
  no shell  ───►  2,' ','1',13 ───►  AX = 1     ───►  C=0 H=0 S=2  ───►  buffer
                                                                          │
                     ┌────────────────────────────────────────────────────┘
                     ▼
      0000: 4B 45 52 4E 45 4C 20 20 53 59 53 04 02 00 05 00  KERNEL  SYS.....
      0010: 2C 09 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ,...............
      ...
```

### Um número na linha de comando

O shell entrega `" 1"` no PSP, em 81h, terminado por 13 ([a linha de comando, aula 26](aula:aula26)). Num `.COM`, DS já aponta para o PSP, então `[SI]` com SI = 81h lê direto a cauda. A conversão é a de sempre: para cada dígito, número = número × 10 + dígito.

```asm fragmento titulo="SETOR.ASM: LE_PARAMETRO"
LE_PARAMETRO PROC
        MOV  SI, 81h
        XOR  AX, AX
        MOV  BX, 10
@@car:  MOV  CL, [SI]
        INC  SI
        CMP  CL, ' '
        JE   @@car              ; espaços são pulados
        CMP  CL, '0'
        JB   @@fim              ; qualquer outra coisa (o 13!) termina
        CMP  CL, '9'
        JA   @@fim
        SUB  CL, '0'
        XOR  CH, CH
        MUL  BX                 ; AX = AX * 10 + dígito
        ADD  AX, CX
        JMP  @@car
@@fim:  CMP  AX, 2879           ; o último setor de 1,44 MB
        JBE  @@ok
        MOV  AX, 2879
@@ok:   RET
LE_PARAMETRO ENDP
```

O dígito vai para CX e não para BX ou DX porque o `MUL BX` usa AX e **estraga DX** (a parte alta do produto). O 13 do fim da cauda é menor que `'0'` e termina o laço sem precisar de um teste à parte. Sem número nenhum, AX = 0: `SETOR` sozinho mostra o setor de boot. E um número grande demais é limitado ao último setor do disquete, para a INT 13h não receber um cilindro que não existe. (Os espaços também são pulados no *meio* do número, então `SETOR 1 2` lê o setor 12; um desafio é corrigir isso.)

### LBA → CHS, de novo

A BIOS não entende "setor 37": ela quer **cilindro, cabeça e setor**. É a mesma conversão do setor de boot da [aula 40](aula:aula40) e do kernel da [aula 41](aula:aula41) ([o disquete, no livro](livro:cap09)):

```diagrama titulo="LBA → CHS num disquete de 1,44 MB (18 setores por trilha, 2 cabeças)"
   setor    = (LBA mod 18) + 1        os setores começam em 1!
   cabeça   = (LBA ÷ 18) mod 2
   cilindro = LBA ÷ 36

   LBA  0  →  C 0  H 0  S  1   (o setor de boot)
   LBA  1  →  C 0  H 0  S  2   (o diretório do MINIFS)
   LBA 17  →  C 0  H 0  S 18   (o último da primeira trilha)
   LBA 18  →  C 0  H 1  S  1   (vira a cabeça, mesmo cilindro)
   LBA 36  →  C 1  H 0  S  1   (agora sim, o braço anda)
   LBA 2879 → C 79 H 1  S 18   (o último do disquete)
```

```asm fragmento titulo="SETOR.ASM: a conversão com uma divisão só"
        MOV  AX, lba
        XOR  DX, DX
        MOV  CX, 18
        DIV  CX                 ; AX = LBA / 18, DX = LBA mod 18
        MOV  CL, DL
        INC  CL                 ; setor
        MOV  DH, AL
        AND  DH, 1              ; cabeça = o bit 0 do quociente
        SHR  AX, 1
        MOV  CH, AL             ; cilindro = o quociente / 2
```

Uma divisão só basta: o quociente de LBA ÷ 18 é o número da **trilha** contada desde o começo, e cada cilindro tem duas trilhas (uma por cabeça). O bit 0 da trilha é a cabeça; o resto, deslocado uma vez, é o cilindro. Os registradores já ficam onde a INT 13h os quer: CH = cilindro, CL = setor, DH = cabeça.

### Ler e mostrar

```asm fragmento titulo="SETOR.ASM: a leitura"
        XOR  DL, DL             ; drive A:
        MOV  BX, OFFSET buffer  ; ES:BX = buffer (ES = DS num .COM)
        MOV  AX, 0201h          ; AH = 02h (ler), AL = 1 setor
        INT  13h
        JNC  @@leu
        MOV  DX, OFFSET msg_erro
```

O *dump* segue o formato que todo programador da época conhecia do `DEBUG`: o deslocamento, 16 bytes em hexadecimal, e os mesmos 16 bytes como texto, com um ponto no lugar do que não dá para mostrar.

```asm fragmento titulo="SETOR.ASM: uma linha do dump"
@@linha:
        PUSH CX
        MOV  AX, SI
        SUB  AX, OFFSET buffer  ; o deslocamento dentro do setor
        CALL ESCREVE_HEX4
        MOV  DL, ':'
        CALL CARACTERE
        PUSH SI                 ; os mesmos 16 bytes vão ser lidos 2 vezes
        MOV  CX, 16
@@hex:  MOV  DL, ' '
        CALL CARACTERE
        LODSB
        CALL ESCREVE_HEX2
        LOOP @@hex
        POP  SI                 ; volta para o começo da linha
        MOV  DL, ' '
        CALL CARACTERE
        CALL CARACTERE
        MOV  CX, 16
@@txt:  LODSB
        MOV  DL, AL
        CMP  DL, ' '            ; só caracteres que dá para ver
        JB   @@ponto
        CMP  DL, 126
        JBE  @@mostra
@@ponto:
        MOV  DL, '.'
@@mostra:
        CALL CARACTERE
        LOOP @@txt
```

O `PUSH SI`/`POP SI` em volta da parte hexadecimal é o que permite ler a mesma linha duas vezes com `LODSB`. E os caracteres abaixo de 32 viram ponto por um motivo prático: um 13, 10, 7 ou 8 de verdade mandado para a tela moveria o cursor, apitaria ou apagaria, e o *dump* ficaria ilegível.

Um setor tem 512 bytes, 32 linhas de 16: não cabe numa tela de 25 linhas. O `SETOR` mostra a primeira metade e espera uma tecla (ESC desiste) antes de mostrar a segunda. O `DEBUG` mostrava 128 bytes por comando `D` pelo mesmo motivo.

O que aparece com `SETOR 1` no MINIOS é o diretório. Compare com o diagrama da entrada na [aula 43](aula:aula43): o nome com espaços, o atributo 04h do kernel, o primeiro setor (02h), o número de setores (05h) e o tamanho, 092Ch = 2348 bytes, com o byte baixo primeiro.

```diagrama titulo="SETOR 1 no MINIOS: o diretório do disquete"
A> SETOR 1
Setor 1 (cilindro/cabeca/setor = 0/0/2)
0000: 4B 45 52 4E 45 4C 20 20 53 59 53 04 02 00 05 00  KERNEL  SYS.....
0010: 2C 09 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ,...............
0020: 53 48 45 4C 4C 20 20 20 43 4F 4D 20 07 00 05 00  SHELL   COM ....
0030: 69 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00  i...............
0040: 4C 45 49 41 4D 45 20 20 54 58 54 20 0C 00 01 00  LEIAME  TXT ....
0050: 84 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0060: 49 4E 46 4F 20 20 20 20 43 4F 4D 20 0D 00 02 00  INFO    COM ....
0070: 29 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00  )...............
 ...
```

E `SETOR 0` mostra o setor de boot: começa com `FA 33 C0 8E D8`, que é `CLI` / `XOR AX,AX` / `MOV DS,AX`, as primeiras instruções do `BOOT.ASM`, e termina com `55 AA` no deslocamento 1FEh.

:::atencao No DOS do simulador não há disquete
O DOS do simulador tem um disco C: com arquivos, mas a INT 13h só lê o disquete A: no modo de boot. Por isso o "Executar aqui" abaixo mostra a conversão para CHS e depois "Erro lendo o disquete.": o tratamento de erro também precisa ser testado. Para ver os setores de verdade, dê boot no disquete completo no fim da aula e digite `SETOR 1`.
:::

```asm executar parametros="1" titulo="SETOR.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  SETOR.ASM  -  mostra um setor do disquete em hexadecimal     ║
; ║  Curso Assembly 8086, aula 44 (utilitário do MINIOS)          ║
; ║                                                               ║
; ║  Uso: SETOR n   (n = setor lógico, 0 = o setor de boot)       ║
; ║  Lê pela BIOS (INT 13h) e mostra 256 bytes por página.        ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

inicio:
        CALL LE_PARAMETRO       ; AX = número digitado depois do nome
        MOV  lba, AX
        MOV  DX, OFFSET msg_setor
        CALL TEXTO
        MOV  AX, lba
        CALL ESCREVE_NUM
        ; LBA -> CHS (como no setor de boot)
        MOV  AX, lba
        XOR  DX, DX
        MOV  CX, 18
        DIV  CX
        MOV  CL, DL
        INC  CL                 ; setor
        MOV  DH, AL
        AND  DH, 1              ; cabeça
        SHR  AX, 1
        MOV  CH, AL             ; cilindro
        PUSH CX
        PUSH DX
        MOV  DX, OFFSET msg_chs
        CALL TEXTO
        POP  DX
        POP  CX
        PUSH CX
        PUSH DX
        MOV  AL, CH
        XOR  AH, AH
        CALL ESCREVE_NUM
        MOV  DL, '/'
        CALL CARACTERE
        POP  DX
        PUSH DX
        MOV  AL, DH
        XOR  AH, AH
        CALL ESCREVE_NUM
        MOV  DL, '/'
        CALL CARACTERE
        POP  DX
        POP  CX
        PUSH CX
        PUSH DX
        MOV  AL, CL
        XOR  AH, AH
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_fecha
        CALL TEXTO
        POP  DX
        POP  CX
        XOR  DL, DL             ; drive A:
        MOV  BX, OFFSET buffer  ; ES:BX = buffer (ES = DS num .COM)
        MOV  AX, 0201h
        INT  13h
        JNC  @@leu
        MOV  DX, OFFSET msg_erro
        CALL TEXTO
        MOV  AX, 4C01h
        INT  21h
@@leu:  MOV  SI, OFFSET buffer
        CALL MOSTRA_256
        MOV  DX, OFFSET msg_mais
        CALL TEXTO
        XOR  AH, AH
        INT  16h
        CMP  AL, 27
        JE   @@fim
        CALL MOSTRA_256         ; a segunda metade
@@fim:  MOV  AX, 4C00h
        INT  21h

; LE_PARAMETRO: converte o número da linha de comando (PSP:81h) em AX
LE_PARAMETRO PROC
        MOV  SI, 81h
        XOR  AX, AX
        MOV  BX, 10
@@car:  MOV  CL, [SI]
        INC  SI
        CMP  CL, ' '
        JE   @@car
        CMP  CL, '0'
        JB   @@fim
        CMP  CL, '9'
        JA   @@fim
        SUB  CL, '0'
        XOR  CH, CH
        MUL  BX                 ; AX = AX * 10 + dígito
        ADD  AX, CX
        JMP  @@car
@@fim:  CMP  AX, 2879           ; o último setor de 1,44 MB
        JBE  @@ok
        MOV  AX, 2879
@@ok:   RET
LE_PARAMETRO ENDP

; MOSTRA_256: 16 linhas de 16 bytes: deslocamento, hexa e texto
MOSTRA_256 PROC
        MOV  CX, 16
@@linha:
        PUSH CX
        MOV  AX, SI
        SUB  AX, OFFSET buffer
        CALL ESCREVE_HEX4
        MOV  DL, ':'
        CALL CARACTERE
        PUSH SI
        MOV  CX, 16
@@hex:  MOV  DL, ' '
        CALL CARACTERE
        LODSB
        CALL ESCREVE_HEX2
        LOOP @@hex
        POP  SI
        MOV  DL, ' '
        CALL CARACTERE
        CALL CARACTERE
        MOV  CX, 16
@@txt:  LODSB
        MOV  DL, AL
        CMP  DL, ' '            ; só caracteres que dá para ver
        JB   @@ponto
        CMP  DL, 126
        JBE  @@mostra
@@ponto:
        MOV  DL, '.'
@@mostra:
        CALL CARACTERE
        LOOP @@txt
        MOV  DX, OFFSET msg_crlf
        CALL TEXTO
        POP  CX
        LOOP @@linha
        RET
MOSTRA_256 ENDP

TEXTO   PROC
        MOV  AH, 09h
        INT  21h
        RET
TEXTO   ENDP

CARACTERE PROC
        PUSH AX
        MOV  AH, 02h
        INT  21h
        POP  AX
        RET
CARACTERE ENDP

ESCREVE_NUM PROC
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX, 10
        XOR  CX, CX
@@div:  XOR  DX, DX
        DIV  BX
        PUSH DX
        INC  CX
        OR   AX, AX
        JNZ  @@div
@@dig:  POP  DX
        ADD  DL, '0'
        CALL CARACTERE
        LOOP @@dig
        POP  DX
        POP  CX
        POP  BX
        RET
ESCREVE_NUM ENDP

ESCREVE_HEX4 PROC
        PUSH AX
        MOV  AL, AH
        CALL ESCREVE_HEX2
        POP  AX
        CALL ESCREVE_HEX2
        RET
ESCREVE_HEX4 ENDP

ESCREVE_HEX2 PROC
        PUSH AX
        PUSH CX
        MOV  CL, 4
        SHR  AL, CL
        CALL DIGITO_HEX
        POP  CX
        POP  AX
        PUSH AX
        AND  AL, 0Fh
        CALL DIGITO_HEX
        POP  AX
        RET
ESCREVE_HEX2 ENDP

DIGITO_HEX PROC
        PUSH AX
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 'A'-'9'-1
@@ok:   MOV  DL, AL
        CALL CARACTERE
        POP  AX
        RET
DIGITO_HEX ENDP

lba         DW 0
msg_setor   DB 'Setor $'
msg_chs     DB ' (cilindro/cabeca/setor = $'
msg_fecha   DB ')', 13, 10, '$'
msg_erro    DB 'Erro lendo o disquete.', 13, 10, '$'
msg_mais    DB '-- qualquer tecla mostra o resto, ESC sai --', 13, 10, '$'
msg_crlf    DB 13, 10, '$'
buffer      DB 512 DUP (?)

END inicio
```

:::cpu Por que o ESCREVE_HEX2 do SETOR guarda mais registradores
Compare o `ESCREVE_HEX2` do `SETOR` com o do `INFO`: o do `SETOR` preserva AX e CX, e o `DIGITO_HEX` dele também preserva AX. No `INFO` ninguém depende desses registradores depois da chamada. No `SETOR`, o `ESCREVE_HEX2` é chamado dentro de um `LOOP` (que usa CX) e logo depois de um `LODSB` (que usa AL): se a rotina estragasse CX, o laço de 16 bytes nunca terminaria certo. É a regra de ouro de rotinas reaproveitáveis ([aula 9](aula:aula09)): preserve tudo o que não é resultado.
:::

## LEIAME.TXT: um arquivo que não é programa

O MINIOS não tem editor de texto e nem uma função para gravar arquivos. Como pôr um texto no disquete? Do mesmo jeito que os outros arquivos: montando. Um arquivo de texto é só uma sequência de bytes, e `DB` escreve bytes. O "programa" abaixo não tem nenhuma instrução: só dados, sem `ORG 100h` (o primeiro byte do arquivo é o `M`), terminando com o Ctrl+Z que o comando `TIPO` reconhece como fim de texto.

```asm titulo="LEIAME.TXT"
; Um arquivo de texto também é só uma sequência de bytes no disco:
; aqui eles são escritos com DB, e o "programa" nunca é executado.
.MODEL TINY
.CODE
        DB 'MINIOS 1.0 - o sistema operacional do Curso Assembly 8086', 13, 10
        DB 13, 10
        DB 'Este disquete tem um setor de boot, um kernel com a sua', 13, 10
        DB 'propria INT 21h, um shell e alguns programas .COM.', 13, 10
        DB 'Digite DIR para ver os arquivos e o nome de um programa', 13, 10
        DB 'para roda-lo. Os jogos voltam para o shell quando terminam.', 13, 10
        DB 13, 10
        DB 'Para entender cada peca, leia os capitulos 20 a 22 do livro', 13, 10
        DB 'da BIOS e do DOS, dentro do curso.', 13, 10
        DB 1Ah                  ; Ctrl+Z: fim do texto
END
```

Os textos do MINIOS não têm acentos de propósito: a tabela de caracteres do PC (a página de código 437) tem `é` e `ç`, mas em posições diferentes das do Windows e do Linux, e um arquivo escrito num editor moderno apareceria com símbolos estranhos no DOS. Os programas brasileiros da época ou evitavam acentos ou usavam a página 850.

## O disquete completo

Chegou a hora de juntar tudo. O bloco abaixo é o disquete do MINIOS inteiro, com 14 arquivos. Ele não repete nenhum código-fonte: cada linha `;### ARQUIVO NOME = aulaNN/TITULO` pede ao montador do curso que pegue o bloco de código com aquele título na aula indicada, monte e grave o resultado no disquete com aquele nome. O primeiro arquivo é o setor de boot; os outros vão para o diretório, na ordem em que aparecem.

Aperte "▶ Dar boot" e o simulador faz o que um PC faria: o POST, a INT 19h lendo o setor 0 para 0000:7C00, o setor de boot carregando o kernel, o kernel instalando a INT 21h e rodando o shell. Digite `AJUDA`, `DIR`, `TIPO LEIAME.TXT`, `INFO`, `SETOR 1`, `COBRA`...

```asm boot titulo="MINIOS.IMG"
;### ARQUIVO BOOT.BIN = aula40/BOOT.ASM
;### ARQUIVO KERNEL.SYS = aula41/KERNEL.ASM
;### ARQUIVO SHELL.COM = aula43/SHELL.ASM
;### ARQUIVO LEIAME.TXT = aula44/LEIAME.TXT
;### ARQUIVO INFO.COM = aula44/INFO.ASM
;### ARQUIVO TECLAS.COM = aula44/TECLAS.ASM
;### ARQUIVO SETOR.COM = aula44/SETOR.ASM
;### ARQUIVO COBRA.COM = aula33/COBRA.ASM
;### ARQUIVO PONG.COM = aula34/PONG.ASM
;### ARQUIVO INVASOR.COM = aula35/INVASOR.ASM
;### ARQUIVO BLOCOS.COM = aula36/BLOCOS.ASM
;### ARQUIVO PAREDAO.COM = aula37/PAREDAO.ASM
;### ARQUIVO SAPO.COM = aula38/SAPO.ASM
;### ARQUIVO LABIRIN.COM = aula39/LABIRIN.ASM
```

:::dica Faça o seu próprio disquete
Copie esse bloco para o laboratório e troque uma linha: `;### ARQUIVO SHELL.COM = aula43/SHELL.ASM` pode virar `;### ARQUIVO SHELL.COM` seguido do seu próprio shell, escrito ali mesmo, até a próxima linha `;### ARQUIVO`. O mesmo vale para um jogo seu ou um utilitário novo. O diretório tem 16 entradas: cabem mais dois arquivos.
:::

### O mapa do disquete, setor a setor

O formato MINIFS é o mais simples possível: setor 0 = boot, setor 1 = diretório, e cada arquivo ocupa setores **contíguos**, começando num setor novo. A tabela abaixo é o disquete como o montador do curso o gera (os números mudam um pouco se você alterar algum programa; o `DIR` sempre mostra os de verdade):

| Setores (LBA) | Arquivo | Setores | Bytes | Cilindro / cabeça / setor |
|---------------|---------|---------|-------|---------------------------|
| 0 | setor de boot (BOOT.BIN) | 1 | 512 | 0 / 0 / 1 |
| 1 | diretório | 1 | 512 | 0 / 0 / 2 |
| 2 a 6 | KERNEL.SYS | 5 | 2.348 | 0 / 0 / 3 a 7 |
| 7 a 11 | SHELL.COM | 5 | 2.153 | 0 / 0 / 8 a 12 |
| 12 | LEIAME.TXT | 1 | 388 | 0 / 0 / 13 |
| 13 e 14 | INFO.COM | 2 | 809 | 0 / 0 / 14 e 15 |
| 15 | TECLAS.COM | 1 | 302 | 0 / 0 / 16 |
| 16 e 17 | SETOR.COM | 2 | 985 | 0 / 0 / 17 e 18 |
| 18 a 25 | COBRA.COM | 8 | 3.684 | 0 / 1 / 1 a 8 |
| 26 a 29 | PONG.COM | 4 | 1.737 | 0 / 1 / 9 a 12 |
| 30 a 36 | INVASOR.COM | 7 | 3.270 | 0 / 1 / 13 a 18 e 1 / 0 / 1 |
| 37 a 41 | BLOCOS.COM | 5 | 2.497 | 1 / 0 / 2 a 6 |
| 42 a 45 | PAREDAO.COM | 4 | 2.023 | 1 / 0 / 7 a 10 |
| 46 a 51 | SAPO.COM | 6 | 2.615 | 1 / 0 / 11 a 16 |
| 52 a 59 | LABIRIN.COM | 8 | 3.810 | 1 / 0 / 17 e 18 e 1 / 1 / 1 a 6 |
| 60 a 2879 | livre | 2.820 | | |

```diagrama titulo="As primeiras quatro trilhas do disquete (cada caixa é um setor)"
 setor da trilha:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
                 ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
 cil 0, cabeça 0 │B │D │K │K │K │K │K │S │S │S │S │S │L │I │I │T │R │R │  LBA  0-17
                 ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
 cil 0, cabeça 1 │C │C │C │C │C │C │C │C │P │P │P │P │V │V │V │V │V │V │  LBA 18-35
                 ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
 cil 1, cabeça 0 │V │Q │Q │Q │Q │Q │A │A │A │A │F │F │F │F │F │F │N │N │  LBA 36-53
                 ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
 cil 1, cabeça 1 │N │N │N │N │N │N │  │  │  │  │  │  │  │  │  │  │  │  │  LBA 54-71
                 └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
  B = boot   D = diretório   K = KERNEL.SYS   S = SHELL.COM   L = LEIAME.TXT
  I = INFO   T = TECLAS   R = SETOR   C = COBRA   P = PONG   V = INVASOR
  Q = BLOCOS   A = PAREDAO   F = SAPO   N = LABIRIN       (o resto: 76 cilindros vazios)
```

O disquete inteiro do MINIOS ocupa **60 setores, 30 KB**: 2% de um disquete de 1,44 MB. O sistema operacional propriamente dito (boot, kernel e shell) cabe em 11 setores, 5,5 KB, menos do que o `COMMAND.COM` do DOS 1.0.

Repare no INVASOR e no LABIRIN: eles atravessam o fim de uma trilha. Para o kernel isso não é problema, porque ele lê **um setor por vez** e converte cada LBA para CHS separadamente. Um kernel mais rápido leria uma trilha inteira de uma vez com a INT 13h (AL = 18), mas aí teria de dividir a leitura nos limites de trilha: a BIOS de muitos PCs não passa sozinha para a cabeça seguinte, e o buffer não pode atravessar uma fronteira de 64 KB por causa do DMA ([o disquete, no livro](livro:cap09)).

:::anos90 Por que o DOS não guardava arquivos contíguos
No MINIFS um arquivo é um intervalo de setores: primeiro setor e quantidade. É rápido de ler e cabe em 4 bytes no diretório, mas um arquivo não pode crescer (o vizinho está logo depois) e apagar um arquivo no meio deixa um buraco que talvez nenhum outro arquivo caiba. O DOS resolveu isso com a **FAT**, uma tabela que diz, para cada pedaço do disco, qual é o próximo pedaço do mesmo arquivo. A conta veio na forma de fragmentação: depois de meses de uso, os arquivos ficavam espalhados pelo disco, e o `DEFRAG` do DOS 6 virou o protetor de tela mais hipnótico da década.
:::

### Uma sessão no MINIOS

Assim fica uma sessão completa no simulador, do boot ao `DESLIGA` (a hora e os tiques, claro, vão ser outros):

```diagrama titulo="Uma sessão no MINIOS"
BIOS do Curso Assembly 8086 - 640K OK
Iniciando pelo disquete A:...
MINIOS: carregando o kernel.....                    ← boot: um ponto por setor
MINIOS 1.0 - o sistema do Curso Assembly 8086
Kernel em 0800:0000, INT 20h e 21h instaladas.      ← kernel

Shell do MINIOS. Digite AJUDA para ver os comandos. ← shell

A> DIR
 Disquete A: (MINIFS)

  Nome     Ext  Tamanho       Setor
  KERNEL   SYS    2348 bytes     2  (sistema)
  SHELL    COM    2153 bytes     7
  LEIAME   TXT     388 bytes    12
  INFO     COM     809 bytes    13
  TECLAS   COM     302 bytes    15
  SETOR    COM     985 bytes    16
  COBRA    COM    3684 bytes    18
  PONG     COM    1737 bytes    26
  INVASOR  COM    3270 bytes    30
  BLOCOS   COM    2497 bytes    37
  PAREDAO  COM    2023 bytes    42
  SAPO     COM    2615 bytes    46
  LABIRIN  COM    3810 bytes    52
   13 arquivo(s), 26621 bytes

A> VER
MINIOS versao 1.0

A> HORA
Data: 19/10/2026   Hora: 00:15:24

A> eco   Ola,   Mundo!
Ola,   Mundo!

A> TECLAS
TECLAS - aperte qualquer tecla (ESC sai)
scan 1Eh  ascii 61h  'a'
scan 48h  ascii 00h  (tecla estendida)
scan 01h  ascii 1Bh  (controle)

A> COBRA                                            ← o jogo toma a tela...
                                                    ← ...e o ESC volta para cá
A> NADA
Comando ou arquivo nao encontrado: NADA.COM

A> DESLIGA
Pode desligar o computador.
```

Repare na linha de cada camada: o POST da BIOS, os pontos do setor de boot (um por setor do kernel), as duas linhas do kernel e o shell. Cada uma é um programa diferente, que você leu linha a linha nas aulas 40 a 43.

## Levando o MINIOS para fora do curso

O montador do curso faz tudo de uma vez: monta as 14 partes, cria o diretório e grava o disquete na memória. Fora do curso, com as ferramentas de 1990, cada parte vira um arquivo e uma pequena ferramenta junta tudo numa **imagem de disquete**: um arquivo de exatamente 1.474.560 bytes (2.880 setores de 512), com o setor 0 nos primeiros 512 bytes, o setor 1 nos 512 seguintes, e assim por diante.

### Montando com o TASM (ou o MASM)

1. **Os programas `.COM`** (SHELL, INFO, TECLAS, SETOR e os sete jogos): cada um com `TASM NOME.ASM` e `TLINK /t NOME.OBJ`. A opção `/t` gera um `.COM` direto (no MASM: `LINK` e depois `EXE2BIN NOME.EXE NOME.COM`). São os mesmos `.COM` que rodam no DOS.
2. **O `KERNEL.SYS`**: `TASM KERNEL.ASM`, `TLINK KERNEL.OBJ` e `EXE2BIN KERNEL.EXE KERNEL.SYS`. Como o segmento do kernel começa no deslocamento 0 e o ponto de entrada é o deslocamento 0, o `EXE2BIN` transforma o `.EXE` numa imagem binária pura, que o setor de boot carrega em 0800:0000.
3. **O `LEIAME.TXT`**: o jeito mais simples é escrever o texto num editor do DOS (o `EDIT`) e pôr um Ctrl+Z no fim; ou montar o `LEIAME.ASM` como o kernel, com o `EXE2BIN`.
4. **O setor de boot** tem um problema: o `ORG 7C00h` faz o linker gerar um `.EXE` com 7C00h bytes de zeros antes do código, e o ponto de entrada em 7C00h faz o `EXE2BIN` recusar a conversão. A ferramenta que monta o disquete resolve isso: ela lê o `BOOT.EXE`, pula o cabeçalho MZ (o tamanho do cabeçalho, em parágrafos de 16 bytes, está na palavra do deslocamento 08h) e copia os 512 bytes que começam na posição 7C00h da imagem.
5. **A ferramenta `MKDISK`**, que você escreve em Assembly, em C ou em Pascal (umas 60 linhas), faz o resto: cria o arquivo da imagem, grava os 512 bytes do boot no setor 0, monta o diretório no setor 1 (nome 8.3 sem ponto, atributo 04h para `.SYS` e 20h para os outros, primeiro setor, quantidade de setores e tamanho), copia cada arquivo a partir do setor 2, cada um começando num múltiplo de 512, e completa com zeros até 1.474.560 bytes.

```diagrama titulo="Do fonte à imagem, fora do curso"
  BOOT.ASM ──TASM/TLINK──► BOOT.EXE ──┐ (os 512 bytes em 7C00h)
  KERNEL.ASM ─TASM/TLINK/EXE2BIN──► KERNEL.SYS ─┐
  SHELL.ASM ──TASM/TLINK /t──► SHELL.COM ───────┤
  INFO.ASM, TECLAS.ASM, SETOR.ASM ──► .COM ─────┤
  COBRA.ASM ... LABIRIN.ASM ──► 7 jogos .COM ───┤
  LEIAME.TXT ───────────────────────────────────┤
                                                ▼
                                   ┌──────────────────────────┐
                                   │ MKDISK: setor 0 = boot   │
                                   │ setor 1 = diretório      │──► MINIOS.IMG
                                   │ setor 2... = arquivos    │    (1.474.560 bytes)
                                   └──────────────────────────┘
```

### Rodando a imagem

- **DOSBox**: copie o `MINIOS.IMG` para a pasta montada como C: e digite `BOOT MINIOS.IMG` no prompt do DOSBox. Ele dá boot na imagem como se fosse o drive A:. (O DOSBox foi feito para jogos; a BIOS dele é mínima, mas o MINIOS só usa o que qualquer BIOS tem.)
- **86Box** ou **PCem**: configure uma máquina (um 286 ou um 386 com uma BIOS AMI ou Award de 1990 é um ótimo palco), ponha um drive de 3½" 1,44 MB, e no menu do drive escolha a imagem. É o mais próximo de um PC de verdade: o POST, o barulho e a velocidade da época.
- **QEMU**: `qemu-system-i386 -drive file=MINIOS.IMG,format=raw,if=floppy` (ou só `-fda MINIOS.IMG` nas versões antigas). Muito rápido, ótimo para testar.
- **Um disquete de verdade**: no Linux, `dd if=MINIOS.IMG of=/dev/fd0 bs=512` (com um drive USB, o dispositivo costuma ser outro: confira com cuidado, porque o `dd` grava por cima de qualquer coisa). No Windows, o *RawWrite for Windows*. No DOS dos anos 90, o `RAWRITE.EXE` que vinha com as distribuições de Linux fazia o mesmo, ou o próprio `DEBUG`: carregar os bytes na memória e gravar com o comando `W endereço drive setor quantidade`.

:::atencao O disquete do MINIOS não é um disquete do DOS
O setor 0 do MINIOS não tem o **BPB** (*BIOS Parameter Block*), a tabela no começo do setor de boot que diz ao DOS o tamanho dos setores, da FAT e do diretório ([o DOS por dentro, no livro](livro:cap22)). Se você puser o disquete num PC com DOS ou Windows, ele vai dizer que o disco não está formatado e oferecer para formatar: não aceite, ou o MINIOS se vai. E algumas BIOS mais novas e drives USB conferem o BPB antes de dar boot num disquete; nesse caso, use um emulador.
:::

## O que falta para um DOS de verdade

O MINIOS é um sistema operacional de verdade, no sentido mais estrito: ele dá boot sozinho, gerencia o disco, carrega e roda programas, oferece chamadas de sistema por uma interrupção e devolve o controle quando eles terminam. Mas um usuário de 1985 sentiria falta de muita coisa. Cada item abaixo é um projeto, e o livro tem o mapa de cada um.

**Um sistema de arquivos FAT12.** Com a FAT, os arquivos podem crescer, ser apagados sem deixar buracos inúteis e ocupar clusters espalhados. O DOS 1.0 já usava uma FAT de 12 bits (cada entrada com 12 bits, duas entradas em 3 bytes) e o BPB no setor de boot. Implementar a FAT12 é ler a tabela, seguir a cadeia de clusters e saber desempacotar 12 bits: é o próximo passo natural do kernel ([o DOS por dentro](livro:cap22), [o disquete](livro:cap09)).

**Subdiretórios.** No DOS 2.0 um diretório virou um arquivo com entradas de 32 bytes, e o caminho `\JOGOS\COBRA.COM` passou a ser uma busca em vários níveis. Com isso vieram `CD`, `MD`, `RD` e o `$P` do `PROMPT`.

**Gravação.** O MINIOS só lê. Gravar exige criar uma entrada no diretório, achar setores livres (na FAT: entradas zeradas), gravar com a INT 13h função 03h e manter tudo coerente se a luz acabar no meio. As funções 3Ch, 3Dh, 3Fh, 40h e 3Eh do DOS ([aula 25](aula:aula25)) e os *handles* de arquivo são a interface que os programas esperariam.

**Memória dinâmica.** O MINIOS dá um segmento fixo para cada nível. O DOS mantém uma cadeia de **MCBs** (*Memory Control Blocks*) e as funções 48h, 49h e 4Ah ([aula 26](aula:aula26)): um programa recebe a memória livre, devolve o que não usa e pode pedir mais. Só assim dá para rodar um programa de 400 KB, ou dez pequenos.

**Programas residentes (TSR).** A função 31h termina o programa mas deixa um pedaço dele na memória, com os vetores apontando para lá ([aula 27](aula:aula27) e [aula 28](aula:aula28)). No MINIOS isso nem é possível: o kernel restaura os vetores a cada fim de programa, de propósito. Para ter TSRs, o kernel precisaria de memória dinâmica e de uma regra diferente para os vetores.

**Programas `.EXE`.** Um `.EXE` tem um cabeçalho MZ com uma tabela de relocação: a lista de lugares do programa onde é preciso somar o segmento em que ele foi carregado. Com isso os programas podem ter mais de 64 KB e vários segmentos. O carregador do DOS tem umas 100 linhas a mais que o do MINIOS.

**Drivers de dispositivo.** O `CONFIG.SYS` com `DEVICE=` carrega drivers que ensinam o DOS a falar com um dispositivo novo (um mouse, um CD-ROM, a memória expandida), numa interface padronizada de pedidos (*request headers*) que o kernel chama sem saber o que há do outro lado. O MINIOS fala direto com a BIOS; um DOS fala com drivers, e os drivers falam com a BIOS ou com o hardware ([o teclado](livro:cap06), [o tempo](livro:cap07), [equipamento e memória](livro:cap08)).

**E também:** Ctrl+C (INT 23h), o "Abort, Retry, Fail?" (INT 24h), o ambiente com `PATH` e `COMSPEC`, arquivos de lote, redirecionamento, um relógio do sistema que o `DATE` e o `TIME` ajustam, e a página de código para os acentos.

:::anos90 De 4.000 linhas a um império
O 86-DOS de Tim Paterson, que a Microsoft comprou em 1981 e virou o MS-DOS 1.0, tinha uns 4.000 linhas de Assembly e foi escrito em poucos meses, inspirado no CP/M. O MINIOS tem perto de 2.000 linhas contando o boot, o kernel, o shell e os utilitários. A distância entre os dois é menor do que parece: a FAT12, os *handles* e o `COMMAND.COM` com `.BAT`. O resto da história (subdiretórios no DOS 2, discos rígidos grandes no DOS 3 e 4, a memória alta no DOS 5) foi construído em cima dessa base, sempre em Assembly, sempre compatível com o programa de 1981.
:::

## Exercícios

Cada exercício isola uma rotina dos utilitários. Os que não têm `.MODEL` rodam como trecho: os registradores do teste já chegam prontos e o programa termina no fim do código.

```exercicio
id: a44-1
titulo: Um byte em hexadecimal
nivel: 1
--- enunciado
Imprima o byte em **AL** como dois dígitos hexadecimais, com letras maiúsculas e sem o `h` (por exemplo, AL = 0A5h imprime `A5`; AL = 9 imprime `09`). Use `INT 21h` com `AH = 02h` para cada dígito. É o `ESCREVE_HEX2` do `INFO` e do `SETOR`.
--- inicial
; AL = byte a imprimir em hexadecimal

--- testes
[{ "nome": "A5h", "setup": { "AL": 165 }, "espera": { "saida": "A5" } },
 { "nome": "09h (o zero da frente)", "setup": { "AL": 9 }, "espera": { "saida": "09" } },
 { "nome": "00h", "setup": { "AL": 0 }, "espera": { "saida": "00" } },
 { "nome": "FFh", "setup": { "AL": 255 }, "espera": { "saida": "FF" } },
 { "nome": "1Fh", "setup": { "AL": 31 }, "espera": { "saida": "1F" } },
 { "nome": "3Ah", "setup": { "AL": 58 }, "espera": { "saida": "3A" } }]
--- dicas
Guarde AL (num registrador ou na pilha): a função 02h estraga AL.
O nibble de cima é AL deslocado 4 bits para a direita (MOV CL,4 / SHR AL,CL). O de baixo é AL AND 0Fh.
Para cada nibble: ADD AL,'0'; se passou de '9', ADD AL,7. Depois MOV DL,AL / MOV AH,02h / INT 21h.
--- solucao
; AL = byte a imprimir em hexadecimal
        MOV  BL, AL             ; guarda o byte
        MOV  AL, BL
        MOV  CL, 4
        SHR  AL, CL             ; nibble de cima
        CALL DIGITO
        MOV  AL, BL
        AND  AL, 0Fh            ; nibble de baixo
        CALL DIGITO
        JMP  SHORT fim
DIGITO: ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 'A'-'9'-1
@@ok:   MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        RET
fim:
```

```exercicio
id: a44-2
titulo: Hora em BCD
nivel: 1
--- enunciado
A INT 1Ah (função 02h) devolve a hora do relógio em **BCD**: CH = hora, CL = minuto, DH = segundo. Os registradores já chegam com esses valores. Imprima a hora no formato `HH:MM:SS` (por exemplo, CH = 23h, CL = 59h, DH = 07h imprime `23:59:07`).

Lembre que em BCD cada nibble já é um dígito decimal: não é preciso dividir nada.
--- inicial
; CH = hora, CL = minuto, DH = segundo (em BCD)

--- testes
[{ "nome": "23:59:07", "setup": { "CH": 35, "CL": 89, "DH": 7 }, "espera": { "saida": "23:59:07" } },
 { "nome": "00:00:00", "setup": { "CH": 0, "CL": 0, "DH": 0 }, "espera": { "saida": "00:00:00" } },
 { "nome": "12:34:56", "setup": { "CH": 18, "CL": 52, "DH": 86 }, "espera": { "saida": "12:34:56" } },
 { "nome": "09:05:10", "setup": { "CH": 9, "CL": 5, "DH": 16 }, "espera": { "saida": "09:05:10" } }]
--- dicas
Escreva uma rotina que imprime o byte BCD de AL: o dígito de cima é AL SHR 4 + '0', o de baixo é (AL AND 0Fh) + '0'.
A rotina vai usar CL para o deslocamento e AH/DL para a função 02h: guarde CX e DX (na pilha ou em outros registradores, como BX e SI) antes de começar.
Imprima CH, ':', CL, ':', DH, nessa ordem.
--- solucao
; CH = hora, CL = minuto, DH = segundo (em BCD)
        MOV  BX, CX             ; BH = hora, BL = minuto
        MOV  SI, DX             ; o segundo fica no byte alto de SI
        MOV  AL, BH
        CALL BCD
        CALL DOISPT
        MOV  AL, BL
        CALL BCD
        CALL DOISPT
        MOV  AX, SI
        MOV  AL, AH
        CALL BCD
        JMP  SHORT fim
BCD:    MOV  DH, AL
        MOV  DL, AL
        MOV  CL, 4
        SHR  DL, CL
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        MOV  DL, DH
        AND  DL, 0Fh
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        RET
DOISPT: MOV  DL, ':'
        MOV  AH, 02h
        INT  21h
        RET
fim:
```

```exercicio
id: a44-3
titulo: A lista de equipamentos
nivel: 2
--- enunciado
**AX** chega com a palavra da INT 11h. Calcule, como o `INFO`:

- **BL** = quantos drives de disquete: se o bit 0 for 0, nenhum (BL = 0); se for 1, o valor dos bits 6 e 7 mais 1 (de 1 a 4);
- **BH** = o vídeo inicial: o valor dos bits 4 e 5 (0 = EGA/VGA, 1 = cor 40 colunas, 2 = cor 80 colunas, 3 = mono).

Por exemplo, AX = 0061h (bits 0, 5 e 6 ligados) dá BL = 2 e BH = 2.
--- inicial
; AX = palavra da INT 11h

--- testes
[{ "nome": "0061h: 2 drives, cor 80", "setup": { "AX": 97 }, "espera": { "BL": 2, "BH": 2 } },
 { "nome": "0020h: sem drive, cor 80", "setup": { "AX": 32 }, "espera": { "BL": 0, "BH": 2 } },
 { "nome": "00F1h: 4 drives, mono", "setup": { "AX": 241 }, "espera": { "BL": 4, "BH": 3 } },
 { "nome": "4031h: 1 drive, mono, com bits altos", "setup": { "AX": 16433 }, "espera": { "BL": 1, "BH": 3 } },
 { "nome": "C2C1h: 4 drives, EGA/VGA", "setup": { "AX": 49857 }, "espera": { "BL": 4, "BH": 0 } },
 { "nome": "0010h: sem drive, cor 40", "setup": { "AX": 16 }, "espera": { "BL": 0, "BH": 1 } }]
--- dicas
Copie AX para outro registrador antes de deslocar: você vai precisar dele duas vezes.
Vídeo: DX = AX; MOV CL,4 / SHR DX,CL / AND DL,3 / MOV BH,DL.
Drives: se TEST AL,1 der zero, BL = 0. Senão MOV CL,6 / SHR AX,CL / AND AL,3 / INC AL / MOV BL,AL.
--- solucao
; AX = palavra da INT 11h
        MOV  DX, AX
        MOV  CL, 4
        SHR  DX, CL
        AND  DL, 3
        MOV  BH, DL             ; vídeo inicial
        XOR  BL, BL
        TEST AL, 1
        JZ   fim
        MOV  CL, 6
        SHR  AX, CL
        AND  AL, 3
        INC  AL
        MOV  BL, AL             ; drives
fim:
```

```exercicio
id: a44-4
titulo: O número da linha de comando
nivel: 2
--- enunciado
Escreva o `LE_PARAMETRO` do `SETOR`: leia o número decimal da linha de comando (no PSP, a partir de 81h) e grave-o em **numero** (DW).

- Espaços antes do número são pulados.
- O número termina no primeiro caractere que não é dígito (o 13 do fim, um espaço, uma letra).
- Sem número, o resultado é 0.
- Como no `SETOR`, um número maior que 2879 (o último setor do disquete) vira 2879.

Neste programa `.EXE`, ES aponta para o PSP quando o programa começa (DS é trocado para os dados).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
numero  DW 0FFFFh
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX             ; ES continua apontando para o PSP
        MOV  SI, 81h

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "SETOR 1", "linhaComando": " 1", "espera": { "mem": { "numero": 1 } } },
 { "nome": "SETOR 37", "linhaComando": " 37", "espera": { "mem": { "numero": 37 } } },
 { "nome": "o último setor", "linhaComando": " 2879", "espera": { "mem": { "numero": 2879 } } },
 { "nome": "grande demais", "linhaComando": " 9999", "espera": { "mem": { "numero": 2879 } } },
 { "nome": "espaços antes, lixo depois", "linhaComando": "    42 xyz", "espera": { "mem": { "numero": 42 } } },
 { "nome": "termina na letra", "linhaComando": " 18a", "espera": { "mem": { "numero": 18 } } },
 { "nome": "sem número", "espera": { "mem": { "numero": 0 } } },
 { "nome": "uma palavra", "linhaComando": " boot", "espera": { "mem": { "numero": 0 } } }]
--- dicas
Leia com MOV CL,ES:[SI] e INC SI (lembre do ES: na frente: a linha está no PSP, não no DS).
Primeiro um laço que pula os espaços. Depois, enquanto CL estiver entre '0' e '9': SUB CL,'0' / XOR CH,CH / MUL BX (BX = 10) / ADD AX,CX.
MUL BX estraga DX: não guarde nada importante nele. No fim, CMP AX,2879 / JBE ok / MOV AX,2879, e MOV numero,AX.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
numero  DW 0FFFFh
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX             ; ES continua apontando para o PSP
        MOV  SI, 81h
        XOR  AX, AX
        MOV  BX, 10
@@esp:  MOV  CL, ES:[SI]
        INC  SI
        CMP  CL, ' '
        JE   @@esp
@@dig:  CMP  CL, '0'
        JB   @@fim
        CMP  CL, '9'
        JA   @@fim
        SUB  CL, '0'
        XOR  CH, CH
        MUL  BX
        ADD  AX, CX
        MOV  CL, ES:[SI]
        INC  SI
        JMP  @@dig
@@fim:  CMP  AX, 2879
        JBE  @@ok
        MOV  AX, 2879
@@ok:   MOV  numero, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a44-5
titulo: Uma linha do dump
nivel: 3
--- enunciado
Imprima os 16 bytes de **dados** como uma linha do `SETOR` (sem o deslocamento do começo):

- cada byte como **um espaço e dois dígitos hexadecimais** maiúsculos (`" 4F"`);
- depois **dois espaços**;
- depois os 16 bytes como texto: o próprio caractere se estiver entre 32 e 126, ou um **ponto** se não estiver.

Não imprima nada depois do último caractere (nem CR/LF). Por exemplo, para os bytes de `"Ola, MINIOS!"` seguidos de 00h, 0Dh, 0Ah e 7Fh:

`` 4F 6C 61 2C 20 4D 49 4E 49 4F 53 21 00 0D 0A 7F  Ola, MINIOS!....``
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
dados   DB 16 DUP (0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET dados

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "texto com controles no fim", "setup": { "dados": [79, 108, 97, 44, 32, 77, 73, 78, 73, 79, 83, 33, 0, 13, 10, 127] }, "espera": { "saida": " 4F 6C 61 2C 20 4D 49 4E 49 4F 53 21 00 0D 0A 7F  Ola, MINIOS!...." } },
 { "nome": "0 a 15", "setup": { "dados": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }, "espera": { "saida": " 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F  ................" } },
 { "nome": "o começo do diretório", "setup": { "dados": [75, 69, 82, 78, 69, 76, 32, 32, 83, 89, 83, 4, 2, 0, 5, 0] }, "espera": { "saida": " 4B 45 52 4E 45 4C 20 20 53 59 53 04 02 00 05 00  KERNEL  SYS....." } },
 { "nome": "limites 31, 32, 126, 127 e altos", "setup": { "dados": [31, 32, 126, 127, 128, 200, 255, 65, 122, 48, 57, 64, 91, 96, 123, 125] }, "espera": { "saida": " 1F 20 7E 7F 80 C8 FF 41 7A 30 39 40 5B 60 7B 7D  . ~....Az09@[`{}" } }]
--- dicas
Faça duas passagens pelos mesmos 16 bytes: guarde SI com PUSH SI antes da primeira e POP SI antes da segunda.
Para o hexadecimal, use a rotina do exercício a44-1 (guarde o byte, imprima o nibble de cima e o de baixo). Cuidado com CX: se usar LOOP, a rotina não pode estragar CX (PUSH CX / POP CX em volta do MOV CL,4).
No texto: se AL < 32 ou AL > 126 (comparações sem sinal), troque por '.'.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
dados   DB 16 DUP (0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET dados
        PUSH SI
        MOV  CX, 16
@@hex:  MOV  DL, ' '
        CALL CARACTERE
        LODSB
        CALL HEX2
        LOOP @@hex
        POP  SI
        MOV  DL, ' '
        CALL CARACTERE
        CALL CARACTERE
        MOV  CX, 16
@@txt:  LODSB
        MOV  DL, AL
        CMP  DL, ' '
        JB   @@ponto
        CMP  DL, 126
        JBE  @@mostra
@@ponto:
        MOV  DL, '.'
@@mostra:
        CALL CARACTERE
        LOOP @@txt
        MOV  AX, 4C00h
        INT  21h

CARACTERE PROC
        PUSH AX
        MOV  AH, 02h
        INT  21h
        POP  AX
        RET
CARACTERE ENDP

HEX2    PROC
        PUSH CX
        PUSH AX
        MOV  CL, 4
        SHR  AL, CL
        CALL DIGITO
        POP  AX
        AND  AL, 0Fh
        CALL DIGITO
        POP  CX
        RET
HEX2    ENDP

DIGITO  PROC
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 'A'-'9'-1
@@ok:   MOV  DL, AL
        CALL CARACTERE
        RET
DIGITO  ENDP
END inicio
```

```quiz
? O que a INT 11h devolve em AX?
- A quantidade de memória em KB
+ Uma palavra de bits com os equipamentos que o POST encontrou (disquetes, vídeo inicial, portas, coprocessador)
- O modo de vídeo atual
- O número de tiques desde a meia-noite
> É a palavra guardada em 0040:0010h. No PC original ela vinha das chaves DIP da placa-mãe. A memória é a INT 12h, o modo de vídeo é a INT 10h/0Fh e os tiques estão em 0040:006Ch.

? Por que o INFO grava `MOV modelo, AL` só depois do `POP DS`?
- Porque o MOV não funciona com DS = F000h
+ Porque com DS = F000h a variável seria procurada na ROM, e a escrita se perderia
- Porque o POP DS apaga AL
- Porque o modelo só fica pronto depois do POP
> As variáveis são acessadas relativas a DS. Enquanto DS aponta para a ROM, `modelo` é um endereço dentro da ROM, que não aceita escrita. Primeiro devolva o DS do programa.

? A tecla "seta para cima" chega pela INT 16h, função 00h, como:
- AH = 00h, AL = 48h
+ AH = 48h (o scan code), AL = 00h (sem ASCII)
- AH = 48h, AL = 18h
- AH = 1Bh, AL = 5Bh
> As teclas sem caractere (setas, F1 a F10, Home, End...) chegam com AL = 0 e o scan code em AH. Por isso os jogos testam AH, e o TECLAS mostra "(tecla estendida)".

? Qual é o cilindro, a cabeça e o setor do LBA 36 num disquete de 1,44 MB?
- C 2, H 0, S 1
- C 0, H 1, S 18
+ C 1, H 0, S 1
- C 1, H 1, S 0
> 36 ÷ 18 = 2 trilhas, resto 0: setor = 0 + 1 = 1, cabeça = 2 mod 2 = 0, cilindro = 2 ÷ 2 = 1. Os setores começam em 1, as cabeças e os cilindros em 0.

? No LE_PARAMETRO do SETOR, por que o dígito é guardado em CX e não em DX?
- Porque DX é o registrador de dados das portas
+ Porque o `MUL BX` escreve a parte alta do produto em DX
- Porque o 13 do fim está em DX
- Porque DX não pode ser somado a AX
> `MUL BX` calcula DX:AX = AX × BX. Mesmo quando o produto cabe em 16 bits, DX é zerado. Um dígito guardado em DX seria perdido a cada multiplicação.

? Por que o comando TIPO para de mostrar o LEIAME.TXT no byte 1Ah?
- Porque 1Ah é o tamanho máximo de uma linha
+ Porque 1Ah (Ctrl+Z) marca o fim de um texto desde o CP/M, e o DOS herdou o costume
- Porque o kernel grava um 1Ah em todo arquivo
- Porque 1Ah é o caractere de nova página
> O CP/M guardava os arquivos em blocos de 128 bytes e marcava com Ctrl+Z onde o texto acabava de verdade. O TYPE do DOS também parava no primeiro Ctrl+Z.

? Por que um disquete com o MINIOS aparece como "não formatado" no DOS?
- Porque o MINIOS usa setores de 1.024 bytes
- Porque a assinatura 55h AAh está errada
+ Porque o setor de boot não tem o BPB nem há uma FAT: o DOS não reconhece o sistema de arquivos MINIFS
- Porque o diretório fica no setor 0
> O DOS lê o BPB no começo do setor de boot para saber onde estão a FAT e o diretório. O MINIFS tem o seu próprio formato, que só o kernel do MINIOS conhece.

? Qual destes recursos o MINIOS já tem?
- Subdiretórios
- Gravação de arquivos
- Programas residentes (TSR)
+ Chamadas de sistema por interrupção (INT 21h) e programas que rodam outros programas (4Bh)
> O kernel do MINIOS instala a sua INT 21h com as funções básicas do DOS e a 4Bh com até dois níveis. Gravação, subdiretórios, FAT, memória dinâmica, TSRs e drivers são o que falta para um DOS.
```

## Desafios

1. **SETOR com dois números.** Faça o `SETOR` aceitar `SETOR 2 5` (5 setores a partir do 2) e corrija o `LE_PARAMETRO` para não juntar `1 2` em 12: o número termina no primeiro espaço depois de um dígito.
2. **INFO mais curioso.** Mostre também o coprocessador (bit 1 da INT 11h), as portas seriais e de impressora (bits 9 a 11 e 14 e 15) e os endereços delas, que ficam em 0040:0000 a 0040:000Fh ([a área de dados, no livro](livro:cap17)).
3. **TECLAS com todos os bits.** Mostre também Insert, Caps Lock, Num Lock e Scroll Lock (bits 4 a 7). Os nomes têm 8 bytes; a máscara vai até 80h, e o laço precisa terminar de outro jeito (com o `SHL BL,1` dando zero, por exemplo).
4. **Um editor de setor.** A partir do `SETOR`, deixe o usuário andar pelo dump com as setas e trocar um byte digitando dois dígitos hexadecimais; grave com a INT 13h função 03h. É o Norton Disk Editor em miniatura. Use só numa cópia da imagem!
5. **FAT12 de leitura.** O grande projeto: faça o kernel ler um disquete do DOS. Leia o BPB do setor 0, a FAT a partir do setor 1, o diretório raiz depois das duas cópias da FAT, e siga a cadeia de clusters de 12 bits ([o DOS por dentro](livro:cap22), [o disquete](livro:cap09)). Com isso o MINIOS passa a rodar `.COM`s de qualquer disquete do DOS.

## Fim do curso avançado

Você começou este curso movendo um número para AX. Terminou com um disquete que dá boot sozinho, com um kernel que atende a INT 21h, um shell que entende comandos, três utilitários que conversam com a BIOS e sete jogos que usam o timer, o teclado pela INT 9, a paleta da VGA e o alto-falante. Tudo em Assembly 8086, com as instruções e as ferramentas que os programadores de 1990 tinham.

O caminho do módulo 14, para revisar:

- [Aula 40](aula:aula40): o setor de boot, a INT 19h, o LBA → CHS e o salto para o kernel.
- [Aula 41](aula:aula41): o kernel, os vetores e a INT 21h própria.
- [Aula 42](aula:aula42): o diretório, a leitura de arquivos e a função 4Bh.
- [Aula 43](aula:aula43): o shell, a tabela de comandos e o COMMAND.COM.
- Esta aula: os utilitários e o disquete completo.

E os jogos que estão no disquete: a [cobra](aula:aula33), o [pong](aula:aula34), os [invasores](aula:aula35), os [blocos](aula:aula36), o [paredão](aula:aula37), o [sapo](aula:aula38) e o [labirinto](aula:aula39), sobre a base da [aula 32](aula:aula32).

## No livro

- [Sem DOS: o boot, o setor de boot e o kernel](livro:cap21): o caminho completo do POST até o shell, e o mapa da memória do MINIOS.
- [O DOS por dentro](livro:cap22): o IO.SYS, o MSDOS.SYS e o COMMAND.COM, a FAT12 e o BPB, o PSP e a 4Bh, e a comparação com o MINIOS: o mapa do que falta.
- [Boot e ROMs](livro:cap12): o POST, a INT 19h e a ROM em F000h com a data e o byte de modelo.
- [O disquete](livro:cap09): a INT 13h, a geometria de 1,44 MB, os erros e a fronteira de DMA.
- [Equipamento e memória](livro:cap08): a INT 11h e a INT 12h do INFO.
- [O teclado](livro:cap06): a INT 16h, os scan codes e o byte de estado do TECLAS.
- [O tempo](livro:cap07): os tiques em 0040:006Ch e o relógio em BCD.
- [A área de dados da BIOS](livro:cap17): onde a BIOS guarda o que o INFO mostra.

:::resumo
- Os utilitários são programas externos comuns. Como só usam a BIOS e as funções 02h, 09h e 4Ch da INT 21h, rodam no MINIOS e no DOS (os jogos também, com a 25h e a 35h).
- INFO: INT 11h (bits: disquetes nos bits 6-7 + 1, vídeo nos bits 4-5), INT 12h (KB), INT 10h/0Fh (modo e colunas), a ROM em F000:FFF5 (data) e F000:FFFE (modelo: FCh = AT), os tiques em 0040:006C, e a função 30h com BX = 'MI' para reconhecer o MINIOS.
- TECLAS: INT 16h/00h dá AH = scan code e AL = ASCII (0 nas teclas estendidas); INT 16h/02h dá o byte de estado (Shift direito, Shift esquerdo, Ctrl, Alt, e os modos nos bits 4 a 7).
- SETOR: o número vem do PSP:81h (× 10 + dígito, com o `MUL` estragando DX), LBA → CHS com uma divisão por 18, INT 13h/02h, e um dump com hexa e texto (ponto para o que não é visível).
- O disquete do MINIOS: setor 0 = boot, setor 1 = diretório, arquivos contíguos a partir do setor 2. São 60 setores ao todo. Fora do curso: TASM/TLINK para cada parte, uma ferramenta que monta a imagem de 1.474.560 bytes, e DOSBox (`BOOT`), 86Box, QEMU ou `dd` para um disquete real (sem BPB, o DOS não reconhece o disquete).
- Para virar um DOS faltam: FAT12, subdiretórios, gravação, memória dinâmica (MCBs), TSRs, `.EXE` com relocação, drivers, Ctrl+C e erros críticos, ambiente e `.BAT`.
:::
