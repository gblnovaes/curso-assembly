---
id: cap22
numero: 22
parte: 7
titulo: "O DOS por dentro (e o MINIOS)"
aulas: aula25; aula26; aula41; aula42; aula43; aula44
---

# Capítulo 22 · O DOS por dentro (e o MINIOS)

> **Neste capítulo:** como o MS-DOS dá boot (do setor com BPB ao `COMMAND.COM`); o sistema de
> arquivos FAT12 em visão geral, com a entrada de diretório do DOS ao lado da do MINIFS; o PSP de
> 256 bytes campo a campo; o `EXEC` (`4BH`), o fim de programa (`4CH`) e o código de saída
> (`4DH`); os blocos de controle de memória; as interrupções do DOS de `20H` a `2FH`; o
> `COMMAND.COM`; e uma tabela que compara o DOS com o kernel do MINIOS, função a função.
>
> **Antes de ler:** [Aula 25, Arquivos com handles](../conteudo/aula25-arquivos.md),
> [Aula 26, PSP, linha de comando e memória](../conteudo/aula26-psp-memoria.md) e as aulas do
> MINIOS: [41](../conteudo/aula41-kernel.md), [42](../conteudo/aula42-arquivos-e-exec.md),
> [43](../conteudo/aula43-shell.md) e [44](../conteudo/aula44-utilitarios.md). Do livro, o
> [Capítulo 21](cap21-sem-dos-boot-e-kernel.md), que mostra o boot e o kernel do MINIOS.

## 22.1 Como o MS-DOS dá boot

O MINIOS tem três peças: setor de boot, `KERNEL.SYS` e `SHELL.COM`. O MS-DOS tem as mesmas três,
com uma etapa de configuração no meio:

```
 INT 19h ──► setor de boot (com BPB)
               calcula onde está o diretório raiz a partir do BPB,
               confere se as duas primeiras entradas são IO.SYS e MSDOS.SYS
               (IBMBIO.COM e IBMDOS.COM no PC DOS), carrega o começo do IO.SYS
               em 0070:0000 e salta para lá
                 │
                 ▼
             IO.SYS (IBMBIO.COM): a interface com a BIOS
               controladores residentes CON, AUX, PRN, CLOCK$ e os discos;
               o SYSINIT, que carrega o MSDOS.SYS
                 │
                 ▼
             MSDOS.SYS (IBMDOS.COM): o núcleo
               INT 20h a 2Fh, arquivos, memória, processos
                 │
                 ▼
             SYSINIT lê o CONFIG.SYS: FILES=, BUFFERS=, DEVICE= (carrega mais
             controladores, como ANSI.SYS e HIMEM.SYS), SHELL=
                 │
                 ▼
             EXEC do COMMAND.COM (ou do SHELL=), que roda o AUTOEXEC.BAT e mostra
             o prompt A>
```

A divisão em dois arquivos de sistema é a que a IBM e a Microsoft usaram até o DOS 6: o
`IO.SYS` concentra o que depende da máquina (é ele que fala com a BIOS), e o `MSDOS.SYS` é o mesmo
em qualquer compatível. As duas primeiras entradas do diretório, e (até o DOS 3.3) os primeiros
setores da área de dados em sequência, eram reservadas para eles: é por isso que um disquete
"de sistema" precisava do comando `SYS`, que os gravava no lugar certo, e não de um simples `COPY`.

| | MS-DOS | MINIOS |
|---|---|---|
| Setor de boot | BPB, carrega `IO.SYS` em `0070:0000` | sem BPB, carrega `KERNEL.SYS` em `0800:0000` |
| Núcleo | `IO.SYS` + `MSDOS.SYS` | `KERNEL.SYS` (um arquivo, fala direto com a BIOS) |
| Configuração | `CONFIG.SYS` | nenhuma |
| Interpretador | `COMMAND.COM` + `AUTOEXEC.BAT` | `SHELL.COM` |

## 22.2 FAT12 em visão geral

O DOS divide o disquete em quatro áreas, nas posições que o BPB descreve
([Capítulo 21](cap21-sem-dos-boot-e-kernel.md), seção 21.4). Num disquete de 1,44 MB:

| Setores (LBA) | Área | Conta pelo BPB |
|---|---|---|
| 0 | setor de boot | setores reservados = 1 |
| 1 a 9 | FAT 1 | 9 setores por FAT |
| 10 a 18 | FAT 2 (cópia de segurança) | número de FATs = 2 |
| 19 a 32 | diretório raiz | 224 entradas × 32 bytes / 512 = 14 setores |
| 33 a 2879 | área de dados | o resto, em *clusters* |

A área de dados é dividida em **clusters** (aqui, 1 setor cada), numerados a partir de **2**:
o cluster `n` começa no LBA `33 + (n − 2) × setores_por_cluster`. Um arquivo é uma **lista
encadeada** de clusters: a entrada de diretório diz o primeiro, e a **FAT** (*File Allocation
Table*) diz, para cada cluster, qual é o seguinte. Na FAT12, cada entrada tem 12 bits:

| Valor | Significado |
|---|---|
| `000H` | cluster livre |
| `002H` a `FEFH` | o próximo cluster do arquivo |
| `FF7H` | cluster defeituoso |
| `FF8H` a `FFFH` | último cluster do arquivo |

Duas entradas de 12 bits ocupam 3 bytes. A entrada `n` começa no byte `n × 3 / 2` da FAT; se `n`
é par, ela é os 12 bits **baixos** da palavra lida ali; se é ímpar, os 12 bits **altos**:

```asm fragmento titulo="Próximo cluster na FAT12 (AX = cluster atual, FAT carregada em DS:fat)"
        MOV  BX, AX
        SHR  BX, 1
        ADD  BX, AX             ; BX = n × 3 / 2
        MOV  DX, WORD PTR fat[BX]
        TEST AL, 1              ; n é ímpar?
        JZ   par
        MOV  CL, 4
        SHR  DX, CL             ; ímpar: os 12 bits de cima
        JMP  SHORT pronto
par:    AND  DX, 0FFFh          ; par: os 12 bits de baixo
pronto: MOV  AX, DX             ; AX = próximo cluster (>= 0FF8h: acabou)
```

As duas cópias da FAT existem porque um setor estragado ali perde o disco inteiro; o `CHKDSK`
compara as duas. O MINIFS troca tudo isso por "um arquivo = setores seguidos", que cabe num laço
de 6 instruções e não permite fragmentação, crescimento nem apagar sem reorganizar.

### A entrada de diretório, lado a lado

| Offset | DOS (32 bytes) | MINIFS (32 bytes) |
|---|---|---|
| `00H` | nome, 8 caracteres com espaços (`00H` = fim do diretório; `E5H` = apagado) | nome, 8 caracteres com espaços (`00H` = entrada vazia, fim) |
| `08H` | extensão, 3 caracteres | extensão, 3 caracteres |
| `0BH` | atributo: `01H` só leitura, `02H` oculto, `04H` sistema, `08H` rótulo de volume, `10H` diretório, `20H` arquivo (modificado) | atributo: `04H` para `.SYS`, `20H` para os demais |
| `0CH` | reservado (10 bytes) | primeiro setor (LBA), palavra |
| `0EH` | | número de setores, palavra |
| `10H` | | tamanho em bytes, palavra dupla |
| `14H` | | livre (12 bytes) |
| `16H` | hora: bits 15–11 hora, 10–5 minuto, 4–0 segundos ÷ 2 | |
| `18H` | data: bits 15–9 ano − 1980, 8–5 mês, 4–0 dia | |
| `1AH` | primeiro cluster, palavra | |
| `1CH` | tamanho em bytes, palavra dupla | |

O nome 8.3 sem o ponto (`"KERNEL  SYS"`), o atributo no byte 11 e o tamanho em palavra dupla são
herança direta do DOS; a diferença está no "onde fica": o DOS guarda um cluster e segue a FAT, o
MINIFS guarda o primeiro setor e quantos são. O `DIR` do shell do MINIOS, que pede as entradas ao
kernel com a função `80H`, é a mesma ideia da `4EH`/`4FH` do DOS (procurar o primeiro e o próximo
arquivo), e devolve o mesmo erro, 18 ("não há mais arquivos"), quando acaba.

## 22.3 O PSP, campo a campo

Antes de rodar um programa, o DOS monta na frente dele um **PSP** (*Program Segment Prefix*) de
256 bytes. Num `.COM`, o PSP está no offset 0 do mesmo segmento, e o código começa em `100H`;
num `.EXE`, `DS` e `ES` apontam para o PSP na entrada ([Aula 26](../conteudo/aula26-psp-memoria.md)).

| Offset | Bytes | Conteúdo |
|---|---|---|
| `00H` | 2 | `CD 20`: a instrução `INT 20H` (o `RET` de um `.COM` cai aqui) |
| `02H` | 2 | segmento do primeiro parágrafo **depois** da memória do programa |
| `04H` | 1 | reservado |
| `05H` | 5 | `CALL FAR` para o despachante de funções (compatibilidade com o CP/M) |
| `0AH` | 4 | cópia do vetor `INT 22H` (endereço de término) |
| `0EH` | 4 | cópia do vetor `INT 23H` (Ctrl-C) |
| `12H` | 4 | cópia do vetor `INT 24H` (erro crítico) |
| `16H` | 2 | segmento do PSP do pai (não documentado, mas estável) |
| `18H` | 20 | tabela de arquivos do processo (JFT): um byte por handle, `FFH` = livre; 0 a 4 são `CON`, `CON`, `CON`, `AUX`, `PRN` |
| `2CH` | 2 | segmento do bloco de **ambiente** (`PATH=...`, `COMSPEC=...`) |
| `2EH` | 4 | `SS:SP` do programa na última chamada ao DOS |
| `32H` | 2 | tamanho da JFT (DOS 3.3+) |
| `34H` | 4 | ponteiro para a JFT (DOS 3.3+) |
| `38H` | 24 | reservados |
| `50H` | 3 | `INT 21H` + `RETF` (`CD 21 CB`), para chamar o DOS com `CALL FAR` |
| `53H` | 9 | reservados |
| `5CH` | 16 | FCB padrão 1, com o primeiro parâmetro já analisado |
| `6CH` | 20 | FCB padrão 2 (sobrepõe parte do 1 se este for aberto) |
| `80H` | 1 | tamanho da cauda de comando |
| `81H` | 127 | a cauda de comando, terminada por `0DH`; também a DTA padrão |

O DOS restaura os vetores `22H`, `23H` e `24H` a partir das cópias em `0AH`, `0EH` e `12H` quando
o programa termina. É assim que um programa pode instalar o seu próprio tratador de Ctrl-C sem
precisar devolvê-lo. Nenhum outro vetor é restaurado: um programa que troca a `INT 09H` e esquece
de devolvê-la deixa o DOS sem teclado ([Capítulo 20](cap20-bios-para-jogos.md), seção 20.8).

O PSP do MINIOS (`MONTA_PSP` no kernel) tem só o que os programas do curso usam: `CD 20` em `00H`,
`A000H` em `02H` e a cauda de comando em `80H`. O resto do segmento não é inicializado.

O programa a seguir usa apenas funções que os dois sistemas têm (`02H`, `09H`, `30H` e `4CH`),
então roda no DOS e no MINIOS. Ele descobre em qual está pela função `30H`: o MINIOS devolve
`AX = 0001H` (versão 1.0) e `BX = 'IM'`, que na memória fica `"MI"`; o DOS 5 devolve em `BH` o
código do fabricante (`00H` IBM, `FFH` Microsoft).

```asm titulo="PSPVER.ASM: qual sistema, e o que há no PSP" parametros="A B C"
.MODEL TINY
.CODE
        ORG 100h

inicio:
        MOV  AH, 30h            ; versão: AL = principal, AH = secundária
        INT  21h
        MOV  DX, OFFSET msg_dos
        CMP  BX, 'IM'           ; assinatura do MINIOS
        JNE  @@nome
        MOV  DX, OFFSET msg_minios
@@nome: CALL TEXTO
        PUSH AX
        CALL DECIMAL            ; AL
        MOV  DL, '.'
        CALL CARAC
        POP  AX
        MOV  AL, AH
        CALL DECIMAL
        MOV  DX, OFFSET msg_psp ; o PSP é o começo deste segmento
        CALL TEXTO
        MOV  AX, CS
        CALL HEX16
        MOV  DX, OFFSET msg_00
        CALL TEXTO
        MOV  AL, DS:[0000h]     ; deve ser CD 20 (INT 20h)
        CALL HEX8
        MOV  DL, ' '
        CALL CARAC
        MOV  AL, DS:[0001h]
        CALL HEX8
        MOV  DX, OFFSET msg_02
        CALL TEXTO
        MOV  AX, DS:[0002h]     ; topo da memória do programa
        CALL HEX16
        MOV  DX, OFFSET msg_2c
        CALL TEXTO
        MOV  AX, DS:[002Ch]     ; ambiente (o MINIOS não preenche)
        CALL HEX16
        MOV  DX, OFFSET msg_80
        CALL TEXTO
        MOV  CL, DS:[0080h]     ; cauda de comando: tamanho e texto
        XOR  CH, CH
        MOV  AL, CL
        CALL DECIMAL
        MOV  DX, OFFSET msg_aspas
        CALL TEXTO
        MOV  SI, 81h
        JCXZ @@fim_cauda
@@cauda:
        LODSB
        MOV  DL, AL
        CALL CARAC
        LOOP @@cauda
@@fim_cauda:
        MOV  DL, '"'
        CALL CARAC
        MOV  AX, 4C00h
        INT  21h

TEXTO   PROC                    ; DS:DX até o '$'
        PUSH AX
        MOV  AH, 09h
        INT  21h
        POP  AX
        RET
TEXTO   ENDP

CARAC   PROC                    ; DL (preserva AX)
        PUSH AX
        MOV  AH, 02h
        INT  21h
        POP  AX
        RET
CARAC   ENDP

DECIMAL PROC                    ; AL de 0 a 99, sem zero à esquerda
        PUSH AX
        PUSH DX
        XOR  AH, AH
        MOV  DL, 10
        DIV  DL                 ; AL = dezenas, AH = unidades
        OR   AL, AL
        JZ   @@unid
        MOV  DL, AL
        ADD  DL, '0'
        CALL CARAC
@@unid: MOV  DL, AH
        ADD  DL, '0'
        CALL CARAC
        POP  DX
        POP  AX
        RET
DECIMAL ENDP

HEX16   PROC                    ; AX em 4 dígitos
        PUSH AX
        MOV  AL, AH
        CALL HEX8
        POP  AX
        CALL HEX8
        RET
HEX16   ENDP

HEX8    PROC                    ; AL em 2 dígitos
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  DH, AL
        MOV  CL, 4
        SHR  AL, CL
        CALL DIGITO
        MOV  AL, DH
        AND  AL, 0Fh
        CALL DIGITO
        POP  DX
        POP  CX
        POP  AX
        RET
HEX8    ENDP

DIGITO  PROC
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@poe
        ADD  AL, 7
@@poe:  MOV  DL, AL
        CALL CARAC
        RET
DIGITO  ENDP

msg_dos     DB 'Sistema: DOS $'
msg_minios  DB 'Sistema: MINIOS $'
msg_psp     DB 13, 10, 'PSP em $'
msg_00      DB 'h', 13, 10, '  00h: $'
msg_02      DB 13, 10, '  02h (topo): $'
msg_2c      DB 'h', 13, 10, '  2Ch (ambiente): $'
msg_80      DB 'h', 13, 10, '  80h (cauda): $'
msg_aspas   DB ' bytes "$'
END inicio
```

No DOS, a saída mostra `CD 20`, o topo `A000H` (o programa ganhou toda a memória) e a cauda
`" A B C"`, com o espaço que separa o nome do programa dos parâmetros. No MINIOS, rodado como
`PSPVER A B C` pelo shell, o segmento é `3000H` e a cauda é a mesma, porque o shell monta a linha
de comando "como o DOS faz", com o espaço na frente.

## 22.4 EXEC, fim de programa e código de saída

### INT 21H, AH=4BH · EXEC

| Entrada | Significado |
|---|---|
| `AL` | `00H` carregar e executar; `01H` carregar sem executar (depuradores); `03H` carregar um *overlay* |
| `DS:DX` | nome do arquivo, ASCIIZ, com a extensão (`.COM` ou `.EXE`) |
| `ES:BX` | bloco de parâmetros: `+00H` segmento do ambiente (0 = cópia do pai); `+02H` ponteiro para a cauda de comando; `+06H` e `+0AH` ponteiros para os dois FCBs |
| Saída | `CF = 0`: o filho já terminou; `CF = 1`: `AX` = erro (2 arquivo não encontrado, 8 memória insuficiente, 0BH formato inválido) |

O DOS aloca um bloco de memória para o filho, monta o PSP, carrega o `.COM` em `100H` ou o
`.EXE` aplicando as realocações do cabeçalho, e salta para ele. Dois cuidados do lado de quem
chama:

1. **Liberar memória antes.** Um `.COM` recebe **toda** a memória livre, então um `EXEC` falha com
   o erro 8 até que o programa encolha o próprio bloco com a função `4AH` (`ES` = PSP, `BX` = novo
   tamanho em parágrafos; [Aula 26](../conteudo/aula26-psp-memoria.md)).
2. **Guardar a pilha.** O DOS 2.x destrói todos os registradores, inclusive `SS:SP`, na volta do
   `EXEC`. Programas da época guardavam `SS` e `SP` em variáveis de código (`CS:`) antes da chamada
   e os restauravam logo depois.

```asm fragmento titulo="Rodar COMMAND.COM /C DIR a partir de um .COM"
        MOV  SP, OFFSET pilha_fim       ; pilha pequena, dentro do programa
        MOV  BX, OFFSET fim_programa + 15
        MOV  CL, 4
        SHR  BX, CL             ; BX = parágrafos que o programa usa
        MOV  AH, 4Ah            ; ES = PSP (já é, num .COM)
        INT  21h
        MOV  param+4, CS        ; os três ponteiros apontam para o nosso
        MOV  param+8, CS        ; segmento (a cauda e os FCBs do PSP)
        MOV  param+12, CS
        MOV  CS:guarda_sp, SP
        MOV  DX, OFFSET comspec ; 'C:\COMMAND.COM', 0
        MOV  BX, OFFSET param   ; ES:BX = bloco de parâmetros
        MOV  AX, 4B00h
        INT  21h
        CLI
        MOV  AX, CS             ; no DOS 2.x, só CS:IP sobreviveu
        MOV  SS, AX
        MOV  SP, CS:guarda_sp
        STI
        ; ...
cauda   DB 7, ' /C DIR', 13     ; tamanho, texto, 0Dh
param   DW 0                    ; ambiente: uma cópia do nosso
        DW OFFSET cauda, 0      ; cauda de comando
        DW 5Ch, 0, 6Ch, 0       ; FCBs: os do nosso PSP
```

O EXEC do MINIOS é bem mais simples ([Capítulo 21](cap21-sem-dos-boot-e-kernel.md), seção 21.9):
só `.COM`, `ES:BX` aponta **direto** para a cauda (sem bloco de parâmetros), o segmento é fixo
(`3000H` ou `4000H`), não há memória para liberar e a pilha de quem chamou volta intacta.

### AH=4CH e AH=4DH · Terminar e ler o código de saída

`AH=4CH` termina com o código de saída em `AL`. O DOS fecha os arquivos que o programa deixou
abertos, libera a memória dele, restaura `INT 22H`, `23H` e `24H` a partir do PSP e continua no
endereço de término (a `INT 22H`), que é o ponto logo depois do `INT 21H` do `EXEC` do pai. O pai
então pode chamar `AH=4DH` uma vez: `AL` = código de saída, `AH` = como terminou (`00H` normal,
`01H` Ctrl-C, `02H` erro crítico, `03H` residente com `31H`). É o `ERRORLEVEL` dos arquivos `.BAT`.

No MINIOS, `INT 20H`, `4CH` e a divisão por zero (código 255) passam pela mesma rotina `TERMINA`,
que restaura os vetores `00H` a `3FH` e a pilha do pai; `4DH` devolve o código com `AH = 0`. Não
há arquivos abertos para fechar, porque o MINIOS não tem handles.

## 22.5 Blocos de controle de memória

O DOS anota cada bloco de memória num cabeçalho de 16 bytes, o **MCB** (*Memory Control Block*),
no parágrafo imediatamente anterior ao bloco: byte `00H` = `'M'` (há outro depois) ou `'Z'` (o
último); `01H` = segmento do PSP dono (`0000H` = livre); `03H` = tamanho em parágrafos; no DOS 4
em diante, `08H` = nome do dono, 8 caracteres. Os blocos formam uma cadeia: o próximo MCB fica em
`MCB + 1 + tamanho`. As funções `48H` (alocar), `49H` (liberar) e `4AH` (redimensionar) mexem
nessa cadeia; a função não documentada `52H` dá, em `ES:[BX−2]`, o segmento do primeiro MCB. A
[Aula 26](../conteudo/aula26-psp-memoria.md) percorre a cadeia. O MINIOS não tem MCBs: o mapa
de memória é fixo, um segmento de 64 KB por nível de programa.

## 22.6 As interrupções do DOS

| INT | Nome | O que faz | MINIOS |
|---|---|---|---|
| `20H` | término | encerra o programa; `CS` precisa ser o PSP (por isso o `CD 20` no PSP funciona) | sim |
| `21H` | serviços | quase tudo: console, arquivos, memória, processos, data e hora | 16 funções |
| `22H` | endereço de término | não é chamada: o vetor guarda para onde o DOS volta quando o programa termina | não |
| `23H` | Ctrl-C | chamada quando o DOS percebe Ctrl-C ou Ctrl-Break numa função de console; `IRET` continua, `RETF` com `CF = 1` encerra | não |
| `24H` | erro crítico | chamada em erro de disco ou dispositivo; devolve em `AL` o que fazer (o famoso "Abort, Retry, Ignore, Fail?") | não |
| `25H` / `26H` | leitura / gravação absoluta | setores lógicos de uma unidade, por cima do sistema de arquivos | não |
| `27H` | fica residente | termina deixando `CS:0000` até `CS:DX` na memória (a antecessora da `31H`) | não |
| `28H` | ocioso | o DOS a chama enquanto espera tecla; TSRs aproveitam para chamar o DOS com segurança | não |
| `2FH` | multiplexadora | `AH` = número do programa, `AL = 00H` pergunta "está instalado?" (PRINT, SHARE, HIMEM, TSRs da [Aula 27](../conteudo/aula27-tsr.md)) | não |

## 22.7 O COMMAND.COM

O interpretador de comandos do DOS é um programa comum, carregado pelo `EXEC`, dividido em três
partes:

- **Residente:** fica no fundo da memória. Tem os tratadores de `INT 22H`, `23H` e `24H` e o
  código que recarrega a parte transiente.
- **Transiente:** fica no **topo** da memória e é a parte que lê comandos, executa os internos e
  roda os externos. Um programa grande pode escrever por cima dela; na volta, a parte residente
  confere um *checksum* e, se ela foi estragada, a relê do disco pelo caminho em `COMSPEC=` (daí
  o "Insert disk with COMMAND.COM" dos sistemas de disquete).
- **Inicialização:** roda uma vez, executa o `AUTOEXEC.BAT` e é descartada.

Os comandos **internos** (`DIR`, `COPY`, `DEL`, `TYPE`, `CD`, `MD`, `SET`, `PATH`, `PROMPT`,
`ECHO`, `VER`, `CLS`...) estão dentro do `COMMAND.COM`. Qualquer outro nome é **externo**: o
`COMMAND.COM` procura `NOME.COM`, `NOME.EXE` e `NOME.BAT`, nessa ordem, no diretório atual e depois
em cada diretório do `PATH`, e roda o que achar com o `EXEC` (ou interpreta, se for `.BAT`).

O shell do MINIOS ([Aula 43](../conteudo/aula43-shell.md)) segue o mesmo desenho, em miniatura:
uma tabela de internos (`AJUDA`, `?`, `DIR`, `TIPO`, `LIMPA`, `VER`, `MEM`, `HORA`, `ECO`,
`REINICIA`, `DESLIGA`), cada um com o endereço da sua rotina, e, para qualquer outro nome,
`NOME.COM` pelo `4BH`. Não há `PATH`, `.EXE`, `.BAT` nem parte transiente: o shell inteiro fica
em `2000H`, longe dos programas, e quando ele mesmo termina o kernel simplesmente o carrega de
novo.

## 22.8 DOS × MINIOS, função a função

O kernel do MINIOS implementa 16 funções da `INT 21H`, procurando `AH` numa tabela; qualquer outra
devolve `CF = 1` e `AX = 1` ("função inválida"), o mesmo código do DOS. Os erros 2, 8 e 18 também
são os do DOS.

| AH | DOS | MINIOS |
|---|---|---|
| `01H` | lê tecla com eco; confere Ctrl-C | `INT 16H` e eco pela `INT 10H, AH=0EH`; sem Ctrl-C |
| `02H` | escreve `DL`; confere Ctrl-C; passa por redirecionamento | `INT 10H, AH=0EH` |
| `07H` | lê tecla sem eco e sem Ctrl-C | igual à `08H` |
| `08H` | lê tecla sem eco, com Ctrl-C | `INT 16H, AH=00H` |
| `09H` | escreve `DS:DX` até o `$` | caractere por caractere pela `INT 10H` |
| `0AH` | lê uma linha em `DS:DX` com edição (F1, F3, Esc, modelo da linha anterior) | só aceita caracteres imprimíveis e Backspace; o `0DH` fica no fim, como no DOS |
| `0BH` | há tecla? `AL = FFH` ou `00H` | `INT 16H, AH=01H` |
| `19H` | unidade atual (`0` = A:) | sempre `0` |
| `25H` | `DS:DX` vira o vetor `AL` | escrita direta na IVT, entre `CLI` e `STI` |
| `30H` | versão: `AL` principal, `AH` secundária, `BH` fabricante | `AX = 0001H` (1.0), `BX = 'IM'` |
| `35H` | `ES:BX` = vetor `AL` | leitura direta da IVT |
| `4BH` | EXEC: `.COM` e `.EXE`, bloco de parâmetros em `ES:BX`, memória alocada | só `.COM`, `ES:BX` = cauda; segmento `3000H` ou `4000H`; erro 8 no terceiro nível |
| `4CH` | termina com `AL`; fecha arquivos, libera memória | termina com `AL`; restaura os vetores `00H`–`3FH` |
| `4DH` | `AL` = código, `AH` = tipo de término | `AL` = código, `AH = 0` |
| `80H` | — (no DOS: `4EH`/`4FH` procuram arquivos) | só do MINIOS: copia a entrada `CX` do diretório (32 bytes) para `ES:DI`; `CF = 1`, `AX = 18` quando acabou |
| `81H` | — (no DOS: `3DH` abrir, `3FH` ler, `3EH` fechar) | só do MINIOS: lê o arquivo inteiro `DS:DX` para `ES:BX`; `AX` = tamanho |

As duas funções próprias usam números de `80H` em diante de propósito: o DOS nunca usou essa faixa,
então um programa que as chame no DOS só recebe um erro, e não outra função por engano.

A tabela também explica quais programas do curso rodam nos dois sistemas: os jogos das aulas 33
a 39 só pedem ao DOS `25H`, `35H` e `4CH` (o resto é BIOS e hardware), e os utilitários da
[Aula 44](../conteudo/aula44-utilitarios.md) se limitam a `02H`, `09H`, `30H` e `4CH`. Já um programa da
[Aula 25](../conteudo/aula25-arquivos.md), que abre arquivos com `3DH`, recebe "função inválida"
no MINIOS: para isso o kernel precisaria de handles, de uma tabela de arquivos abertos e de um
jeito de gravar no MINIFS, que é exatamente o caminho que levou do DOS 1.0 ao 2.0.

## 22.9 No simulador do curso

Programas comuns rodam num "DOS" simulado: o PSP tem `CD 20` em `00H`, o topo `A000H` em `02H`, o
PSP do pai em `16H`, a JFT em `18H` com os cinco handles padrão, o ambiente em `2CH`, a cauda em
`80H` (o atributo `parametros` dos blocos a preenche) e uma cadeia de MCBs. A função `30H` devolve
a versão 5.0 com `BX = 0`. `4BH` e `4DH` não existem nesse modo: rodar um programa de dentro de
outro só no MINIOS, dando boot no disco da [Aula 44](../conteudo/aula44-utilitarios.md).

`PSPVER.ASM` roda no laboratório com os parâmetros `A B C` e mostra "Sistema: DOS 5.0". Para vê-lo
dizer "MINIOS 1.0", acrescente-o ao disco do MINIOS com uma linha `;### ARQUIVO PSPVER.COM` e rode
`PSPVER A B C` no shell.

## 22.10 Exercícios

1. Num disquete de 1,44 MB, em que LBA começa o cluster 2? E o cluster 100? Um arquivo de 1500
   bytes ocupa quantos clusters, e quantos bytes desperdiça?
2. Decodifique à mão a FAT12 cujos primeiros bytes são `F0 FF FF 03 40 00 FF 0F 00`: quais são as
   entradas 0 a 5? Qual arquivo começa no cluster 2 e onde termina?
3. Converta a hora `7A2FH` e a data `2D49H` de uma entrada de diretório do DOS para hh:mm:ss e
   dd/mm/aaaa.
4. Estenda `PSPVER.ASM` para mostrar também o PSP do pai (`16H`) e os 5 primeiros bytes da JFT.
   O que aparece no MINIOS, e por quê?
5. Escreva para o MINIOS um `DIRLONGO.COM` que usa a função `80H` para listar os arquivos com o
   primeiro e o último setor de cada um, e diz quantos setores do disquete ainda estão livres
   depois do último arquivo.
6. Planeje (sem escrever o código inteiro) uma função `3DH`/`3FH`/`3EH` para o kernel do MINIOS:
   onde guardar a tabela de arquivos abertos, o que cada handle precisa lembrar e quais funções
   existentes do kernel você reaproveitaria.

## Resumo

- O MS-DOS dá boot em cadeia: setor de boot com BPB → `IO.SYS` (`IBMBIO.COM`) → `MSDOS.SYS`
  (`IBMDOS.COM`) → `CONFIG.SYS` → `COMMAND.COM` → `AUTOEXEC.BAT`. O MINIOS faz boot → kernel →
  shell.
- FAT12: boot, duas FATs, diretório raiz e área de dados; um arquivo é uma cadeia de clusters na
  FAT, com entradas de 12 bits. O MINIFS guarda só o primeiro setor e quantos são.
- O PSP tem 256 bytes: `INT 20H` em `00H`, topo em `02H`, cópias de `22H`/`23H`/`24H`, JFT em
  `18H`, ambiente em `2CH`, cauda de comando em `80H`.
- `4BH` roda um filho (libere memória antes), `4CH` termina com um código, `4DH` o lê; o DOS
  restaura só `22H`, `23H` e `24H`, o MINIOS restaura os vetores `00H` a `3FH`.
- As interrupções do DOS vão de `20H` a `2FH`; o MINIOS implementa `20H` e 16 funções da `21H`,
  incluindo as próprias `80H` (diretório) e `81H` (carregar arquivo).
