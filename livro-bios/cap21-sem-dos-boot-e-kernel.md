---
id: cap21
numero: 21
parte: 7
titulo: "Sem DOS: o setor de boot e o kernel"
aulas: aula40; aula41; aula42
---

# Capítulo 21 · Sem DOS: o setor de boot e o kernel

> **Neste capítulo:** o que existe na máquina quando não há sistema operacional (a BIOS, a
> tabela de vetores e a área de dados, e nada mais); como a `INT 19H` carrega o setor de boot em
> `0000:7C00` e as regras para as suas primeiras instruções; o bloco de parâmetros (BPB) de um
> disquete do DOS e o MINIFS, o sistema de arquivos mínimo do curso; a `INT 13H` na prática
> (LBA para CHS, novas tentativas, fronteira de DMA); como carregar um kernel e saltar para ele;
> o kernel do MINIOS instalando as suas `INT 20H` e `21H`; o mapa de memória do MINIOS; e como
> desligar e reiniciar.
>
> **Antes de ler:** [Aula 40, O setor de boot](../conteudo/aula40-boot.md),
> [Aula 41, O kernel](../conteudo/aula41-kernel.md) e
> [Aula 42, Arquivos e EXEC](../conteudo/aula42-arquivos-e-exec.md). Do livro, o
> [Capítulo 12](cap12-boot-e-roms.md) (POST e `INT 19H`) e o [Capítulo 9](cap09-disquete.md)
> (a `INT 13H` do disquete).

## 21.1 Quando não há DOS

Todos os programas das aulas 1 a 39 rodam "dentro" do DOS: ele carregou o programa, montou o
PSP, apontou os registradores de segmento e oferece a `INT 21H`. No instante em que a BIOS
entrega o controle ao setor de boot, nada disso existe ainda. O que há na memória é só o que o
POST deixou:

```
 00000H ┌──────────────────────────────┐
        │ IVT: 256 vetores de 4 bytes   │  00H a 1FH apontam para a BIOS;
 00400H ├──────────────────────────────┤  20H a 2FH (os do DOS) estão vazios
        │ área de dados da BIOS (40:xx) │  equipamento, teclado, vídeo, tiques, disquete
 00500H ├──────────────────────────────┤
        │ livre                         │  (o MINIOS lê o diretório para 0000:0500)
 07C00H ├──────────────────────────────┤
        │ setor de boot (512 bytes)     │  ◄── CS:IP
 07E00H ├──────────────────────────────┤
        │ livre até o topo (INT 12H)    │  normalmente 640 KB
 A0000H ├──────────────────────────────┤
        │ vídeo, ROMs, BIOS             │
 FFFFFH └──────────────────────────────┘
```

| Existe | Não existe |
|---|---|
| `INT 10H` (vídeo), `INT 16H` (teclado), `INT 13H` (disco), `INT 1AH` (relógio), `INT 11H`, `12H`, `15H`, `19H` | `INT 21H`, `INT 20H`, `INT 27H`, `INT 2FH` |
| a IVT e a área de dados em `40:00` | arquivos, diretórios, nomes: só setores numerados |
| toda a memória convencional, sem dono | PSP, linha de comando, ambiente, MCBs, `.EXE` |
| `INT 08H` e `INT 09H` funcionando (relógio e teclado) | Ctrl-C, tratamento de erro crítico, `Divide overflow` |

Um programa que chama `INT 21H` nesse momento salta para o endereço que estiver no vetor 21H:
zero, ou lixo. A partir daqui, cada serviço que o DOS daria precisa ser escrito, e é isso que
as aulas 40 a 44 fazem com o **MINIOS**.

## 21.2 INT 19H e o setor de boot em 0000:7C00

No fim do POST, a `INT 19H` lê o **primeiro setor** do disquete (cilindro 0, cabeça 0, setor 1)
para o endereço físico `7C00H` e confere os dois últimos bytes: `55H` no offset 510 e `AAH` no
511 (a palavra `AA55H`; as primeiras BIOS da IBM não conferiam a assinatura em disquetes, mas
as posteriores e os compatíveis conferem). Com a assinatura certa, salta para lá com **`DL` = unidade** de onde o
setor veio (`00H` para o drive A:, `80H` para o primeiro disco fixo). Sem ela, tenta o próximo
dispositivo ou vai para a `INT 18H` ([Capítulo 12](cap12-boot-e-roms.md)).

O resto do estado não é garantido, e daí vêm as regras de todo setor de boot:

1. **A pilha primeiro.** `SS:SP` é o que a BIOS estava usando, e ninguém promete onde fica nem
   quanto espaço tem. Troque-a antes de qualquer `CALL`, entre `CLI` e `STI` (o 8086 já protege
   a instrução seguinte a um `MOV SS`, mas algumas CPUs antigas tinham um defeito nisso; o `CLI`
   não custa nada). `SS = 0` com `SP = 7C00H` põe a pilha logo abaixo do código, crescendo para
   baixo, longe dele.
2. **Os segmentos.** `DS` e `ES` podem valer qualquer coisa. Com `ORG 7C00H` e `DS = ES = 0`, os
   offsets que o montador calcula (`7Cxxh`) são os endereços de verdade.
3. **CS:IP.** Quase todas as BIOS saltam para `0000:7C00`, mas algumas usam `07C0:0000`, que é
   o mesmo endereço físico com outro par segmento:offset. Um código com `ORG 7C00H` que só usa
   saltos relativos (`JMP`, `CALL`, `Jcc` curtos e próximos) funciona com os dois; quem usa
   endereços absolutos de código (tabelas de saltos, `JMP` indireto) normaliza com um salto
   distante para `0000:7C??` logo no começo.
4. **DL.** Guarde-o numa variável antes que alguma conta use `DX`.
5. **CLD.** O flag de direção também não é garantido; as instruções de string dependem dele.

```asm fragmento titulo="As primeiras instruções do BOOT.ASM do MINIOS"
BOOT SEGMENT
        ORG 7C00h
inicio:
        CLI                     ; ninguém interrompe enquanto a pilha muda
        XOR  AX, AX
        MOV  DS, AX             ; tudo no segmento 0: os endereços abaixo
        MOV  ES, AX             ; (7Cxxh) já são os de verdade
        MOV  SS, AX
        MOV  SP, 7C00h          ; a pilha cresce para baixo, longe do código
        STI
        CLD
        MOV  drive, DL          ; a BIOS disse de qual drive viemos
```

```asm fragmento titulo="Normalizar CS:IP para 0000:7C00 (se a BIOS pulou para 07C0:0000)"
        DB   0EAh               ; JMP FAR codificado à mão:
        DW   OFFSET normal      ; offset (7C05h)
        DW   0000h              ; segmento
normal: ; daqui em diante, CS = 0000h com certeza
```

O setor termina com a assinatura, no lugar certo, qualquer que seja o tamanho do código:

```asm fragmento titulo="O fim de todo setor de boot do curso"
        ORG 7DFEh               ; os dois últimos bytes do setor:
        DW  0AA55h              ; a assinatura que a BIOS procura (55h AAh)
BOOT ENDS
END inicio
```

Se o código passar de 510 bytes, o `ORG 7DFEh` volta para trás e a assinatura é gravada por
cima do fim do código, sem aviso: confira o tamanho na listagem. Quinhentos e dez bytes parecem pouco, e são: por isso todo sistema de verdade tem
um setor de boot que só sabe **carregar um programa maior**.

## 21.3 Um boot em dois estágios

O programa abaixo é um disquete completo. O primeiro segmento é o setor de boot; o segundo, com
`ORG 0`, vai para o setor seguinte do disquete (LBA 1 = cilindro 0, cabeça 0, setor 2). O boot lê
esse setor para `0800:0000` com a `INT 13H`, salta para lá, e o segundo estágio instala uma
`INT 21H` de uma função só, a `09H`, e a usa.

```asm titulo="DOISEST.ASM: setor de boot que carrega um segundo estágio" boot
BOOT SEGMENT
        ORG 7C00h
inicio:
        CLI
        XOR  AX, AX
        MOV  DS, AX
        MOV  ES, AX
        MOV  SS, AX
        MOV  SP, 7C00h
        STI
        CLD
        MOV  drive, DL
        MOV  SI, OFFSET msg_boot
        CALL ESCREVE
        MOV  AX, 0800h          ; ES:BX = 0800:0000 (8000h físico)
        MOV  ES, AX
        XOR  BX, BX
        MOV  DI, 3              ; três tentativas
tenta:  MOV  AX, 0201h          ; AH = 02h (ler), AL = 1 setor
        MOV  CX, 0002h          ; CH = cilindro 0, CL = setor 2
        XOR  DH, DH             ; cabeça 0
        MOV  DL, drive
        INT  13h
        JNC  lido
        XOR  AH, AH             ; erro: reinicia a controladora e tenta de novo
        INT  13h
        DEC  DI
        JNZ  tenta
        MOV  SI, OFFSET msg_erro
        CALL ESCREVE
        CLI
        HLT
lido:   MOV  DL, drive          ; o segundo estágio também quer saber
        DB   0EAh               ; JMP FAR 0800:0000
        DW   0000h, 0800h

ESCREVE PROC                    ; texto DS:SI terminado em 0, pela INT 10h
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE ENDP

drive    DB 0
msg_boot DB 'Setor de boot: lendo o segundo estagio...', 13, 10, 0
msg_erro DB 'Erro lendo o disquete.', 0
        ORG 7DFEh
        DW  0AA55h
BOOT ENDS

ESTAGIO2 SEGMENT
        ORG 0
dois:   MOV  AX, CS             ; CS = 0800h: dados e pilha no mesmo segmento
        MOV  DS, AX
        CLI
        MOV  SS, AX
        MOV  SP, 0FFFEh
        STI
        XOR  AX, AX             ; o vetor 21h passa a ser nosso
        MOV  ES, AX
        CLI
        MOV  WORD PTR ES:[21h*4], OFFSET MINI21
        MOV  ES:[21h*4+2], CS
        STI
        MOV  DX, OFFSET msg_dois
        MOV  AH, 09h
        INT  21h                ; agora existe!
        XOR  AH, AH
        INT  16h                ; espera uma tecla...
        INT  19h                ; ...e dá boot de novo

; MINI21: só a função 09h (texto DS:DX até o '$')
MINI21  PROC FAR
        STI
        CMP  AH, 09h
        JNE  @@fim
        PUSH AX
        PUSH BX
        PUSH SI
        MOV  SI, DX
@@car:  LODSB
        CMP  AL, '$'
        JE   @@sai
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  @@car
@@sai:  POP  SI
        POP  BX
        POP  AX
@@fim:  IRET
MINI21  ENDP

msg_dois DB 'Segundo estagio em 0800:0000, com a sua propria INT 21h.', 13, 10
         DB 'Aperte uma tecla para dar boot de novo.$'
ESTAGIO2 ENDS
END inicio
```

Três detalhes merecem atenção. O salto distante é montado à mão (`DB 0EAH` e as duas palavras),
porque o rótulo `dois` está em outro segmento, que só passa a existir na memória depois da
leitura. O segundo estágio refaz `DS` e a pilha com o **próprio** `CS`, como fará o kernel do
MINIOS. E o vetor 21H é escrito diretamente na tabela (`0000:0084`), entre `CLI` e `STI`, porque
ainda não existe uma `INT 21H, AH=25H` para fazer isso.

## 21.4 O BPB de um disquete do DOS, e por que o MINIOS não usa

Um disquete formatado pelo DOS começa com um salto (`EB xx 90`) por cima de uma tabela, o **BPB**
(*BIOS Parameter Block*), que descreve a geometria do disco e o formato do sistema de arquivos.
O DOS confia nela para saber onde estão a FAT e o diretório:

| Offset | Tamanho | Campo | 1,44 MB |
|---|---|---|---|
| `00H` | 3 | salto para o código (`EB 3C 90`) | |
| `03H` | 8 | nome do fabricante (OEM), como `MSDOS5.0` | |
| `0BH` | 2 | bytes por setor | 512 |
| `0DH` | 1 | setores por *cluster* | 1 |
| `0EH` | 2 | setores reservados (o de boot incluído) | 1 |
| `10H` | 1 | número de FATs | 2 |
| `11H` | 2 | entradas no diretório raiz | 224 |
| `13H` | 2 | total de setores (se cabe em 16 bits) | 2880 |
| `15H` | 1 | descritor de mídia | `F0H` |
| `16H` | 2 | setores por FAT | 9 |
| `18H` | 2 | setores por trilha | 18 |
| `1AH` | 2 | cabeças | 2 |
| `1CH` | 4 | setores ocultos (antes da partição) | 0 |
| `20H` | 4 | total de setores (32 bits) | 0 |
| `24H` | 1 | número da unidade (DOS 4+) | `00H` |
| `26H` | 1 | assinatura do bloco estendido | `29H` |
| `27H` | 4 | número de série do volume | |
| `2BH` | 11 | rótulo do volume | |
| `36H` | 8 | tipo, só informativo (`FAT12   `) | |

O código de boot começa depois disso, no offset `3EH`. O [Capítulo 22](cap22-o-dos-por-dentro.md)
mostra o que o setor de boot do DOS faz com esses números.

O MINIOS **não tem BPB**: o primeiro byte do seu setor de boot já é o `CLI`. A geometria
(18 setores por trilha, 2 cabeças) está em constantes no código, e o sistema de arquivos é o
**MINIFS**, pensado para caber em poucas linhas de Assembly:

```
 setor 0      setor de boot (BOOT.ASM)
 setor 1      diretório: 16 entradas de 32 bytes
                +0   nome 8.3 sem o ponto, com espaços ("KERNEL  SYS")
                +11  atributo (04h = arquivo do sistema; 20h nos demais)
                +12  primeiro setor (LBA), uma palavra
                +14  número de setores, uma palavra
                +16  tamanho em bytes, palavra dupla
                +20  livres (zeros)
 setor 2...   os arquivos, cada um em setores seguidos, começando num setor novo
```

Sem FAT, não há *clusters* nem encadeamento: um arquivo é um trecho contínuo de setores, e lê-lo
é um laço de `INT 13H` do primeiro ao último. O preço é que nada pode crescer nem ser apagado sem
reorganizar o disco, e só cabem 16 arquivos. Um disquete MINIFS também não é legível pelo DOS
(nem o contrário): o DOS leria o setor 0 procurando um BPB que não existe.

Os 32 bytes da entrada foram escolhidos de propósito com o tamanho da entrada de diretório do
DOS, e o nome 8.3 fica no mesmo lugar; o [Capítulo 22](cap22-o-dos-por-dentro.md) compara as
duas campo a campo.

## 21.5 INT 13H na prática

### De LBA para CHS

Os programas pensam em setores numerados de 0 em diante (**LBA**, endereço lógico); a
`INT 13H, AH=02H` do disquete só entende **cilindro, cabeça e setor** (CHS), com o setor contado
**a partir de 1** ([Capítulo 9](cap09-disquete.md)). Num disquete de 1,44 MB (18 setores por
trilha, 2 cabeças):

```
 setor    = LBA mod 18 + 1
 cabeça   = (LBA / 18) mod 2
 cilindro = LBA / 36
```

O MINIOS faz a conta com um único `DIV` por 18: o resto dá o setor, e o quociente (o número da
trilha, contando as duas faces) dá a cabeça no bit 0 e o cilindro no resto:

```asm fragmento titulo="LE_SETOR do MINIOS: lê o setor lógico AX para ES:BX, com 3 tentativas"
LE_SETOR PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH DI
        XOR  DX, DX
        MOV  CX, SETORES_TRILHA ; 18
        DIV  CX                 ; AX = LBA / 18, DX = LBA mod 18
        MOV  CL, DL
        INC  CL                 ; CL = setor (1 a 18)
        MOV  DH, AL
        AND  DH, CABECAS-1      ; DH = cabeça (bit 0 da trilha)
        SHR  AX, 1
        MOV  CH, AL             ; CH = cilindro
        MOV  DL, drive
        MOV  DI, 3              ; tentativas
@@tenta:
        MOV  AX, 0201h          ; AH = 02h (ler), AL = 1 setor
        INT  13h
        JNC  @@ok
        XOR  AH, AH             ; deu erro: reinicia a controladora...
        INT  13h
        DEC  DI                 ; ...e tenta de novo
        JNZ  @@tenta
        MOV  SI, OFFSET msg_erro_disco
        JMP  ERRO
@@ok:   POP  DI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
LE_SETOR ENDP
```

Como `CH` tem 8 bits e o disquete tem 80 cilindros, a conta basta. Num disco fixo, o cilindro tem
10 bits e os dois de cima vão nos bits 6 e 7 de `CL` ([Capítulo 10](cap10-disco-fixo.md)).

### Novas tentativas

A primeira leitura de um disquete frequentemente falha: o motor ainda está ganhando velocidade,
ou a cabeça ainda não sabe em que trilha está. A receita da IBM é **reiniciar e tentar de novo**,
pelo menos três vezes: `AH=00H` (reset) recalibra a controladora e devolve a cabeça ao cilindro
0. Só depois de três falhas o erro é real. O MINIOS segue a receita no setor de boot e no kernel.

### A fronteira de DMA

A controladora de disquete transfere os dados por **DMA**, e o controlador de DMA do PC só sabe
contar dentro de uma página de 64 KB: um buffer que **atravessa um múltiplo de `10000H` físico**
falha com o erro `09H` (*DMA boundary*), mesmo que o disco esteja perfeito. O MINIOS escapa do
problema de graça: lê **um setor por vez**, e todos os seus buffers começam em endereços físicos
múltiplos de 512 (`8000H`, `20100H`, `30100H`...). Como 64 KB é múltiplo de 512, um setor de 512
bytes alinhado nunca cruza a fronteira. Quem lê vários setores de uma vez precisa conferir:
`(endereço físico mod 10000H) + bytes ≤ 10000H`.

Ler um setor por vez tem outra vantagem: a `AH=02H` de muitas BIOS não passa de uma trilha para
a seguinte, então um pedido de vários setores precisa parar no setor 18 de qualquer jeito.

## 21.6 Carregar o kernel e saltar para ele

O setor de boot do MINIOS faz, em ordem:

```
 1. pilha em 0000:7C00, DS = ES = 0, guarda DL
 2. lê o setor 1 (diretório) para 0000:0500
 3. procura 'KERNEL  SYS' nas 16 entradas (REPE CMPSB de 11 bytes)
 4. lê os setores do kernel, um por um, para 0800:0000, 0800:0200, ... (um ponto por setor)
 5. DL = unidade, e salta para 0800:0000
```

O salto distante é feito com a pilha: empilha o segmento e o offset e executa `RETF`, que os
desempilha para `CS` e `IP` como se voltasse de uma chamada distante que nunca existiu:

```asm fragmento titulo="Achar o kernel no diretório e saltar para 0800:0000"
        MOV  SI, DIRETORIO      ; 0500h: 16 entradas de 32 bytes
        MOV  CX, ENTRADAS
@@procura:
        PUSH CX
        PUSH SI
        MOV  DI, OFFSET nome_kernel   ; 'KERNEL  SYS'
        MOV  CX, 11
        REPE CMPSB              ; compara DS:SI com ES:DI (os dois no seg. 0)
        POP  SI
        POP  CX
        JE   @@achou
        ADD  SI, 32
        LOOP @@procura
        ; ... "KERNEL.SYS nao esta no disco" ...
@@achou:
        MOV  AX, [SI+12]        ; primeiro setor do arquivo
        MOV  CX, [SI+14]        ; quantos setores
        ; ... laço: LE_SETOR, INC AX, ADD BX,512 ...
        MOV  DL, drive          ; o kernel também quer saber o drive
        MOV  AX, SEG_KERNEL     ; 0800h
        PUSH AX                 ; CS
        XOR  AX, AX
        PUSH AX                 ; IP
        RETF
```

`RETF` e `DB 0EAH` (o `JMP FAR` direto, como em `DOISEST.ASM`) fazem a mesma coisa. O `RETF`
serve quando o destino só é conhecido durante a execução; o `JMP FAR` direto, quando é uma
constante. Em MASM também se escreve `JMP DWORD PTR [ponteiro]`, com o destino guardado numa
palavra dupla.

Por que `0800:0000`? É o físico `8000H`: acima do setor de boot (`7C00H` a `7DFFH`), do
diretório em `0500H` e da pilha do boot, que cresce para baixo a partir de `7C00H`. Nada que o
boot ainda usa é sobrescrito enquanto o kernel chega.

## 21.7 O kernel instala os seus vetores

A primeira coisa que o kernel faz é parar de depender do setor de boot: `DS` e `SS` passam a ser
o seu próprio `CS`, e a pilha vai para o fim dos seus 64 KB (`SP = 0FFFEH`). Depois ele assume
três interrupções escrevendo direto na IVT, no endereço `0000:(n × 4)`:

```asm fragmento titulo="INSTALA_VETORES do KERNEL.ASM"
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

O `CLI` é essencial: se uma interrupção chegasse entre a escrita do offset e a do segmento, e
alguém chamasse aquele vetor, a CPU saltaria para o offset novo no segmento velho. Para a
`INT 21H` isso não aconteceria (ninguém a chama sozinho), mas o hábito é o mesmo para qualquer
vetor, inclusive os de hardware, como a `INT 09H` dos jogos.

- **INT 00H** (divisão por zero): sem DOS, um `DIV` errado salta para o que estiver no vetor 0.
  O kernel mostra "Divisao por zero!" e encerra o programa com código 255.
- **INT 20H** (fim de programa): o `RET` de um `.COM` cai no `INT 20H` do PSP e chega aqui.
- **INT 21H**: o "mini-DOS". A rotina empilha todos os registradores numa ordem fixa, aponta `BP`
  para esse **quadro** e procura `AH` numa tabela de funções (`DB número` / `DW rotina`). Cada
  função lê os parâmetros e escreve as respostas no quadro (`[BP+Q_AX]`, `[BP+Q_BX]`...); na
  saída, os `POP`s devolvem tudo a quem chamou.

Duas técnicas da `INT 21H` do kernel valem para qualquer tratador de interrupção que imite o DOS:

1. **`STI` logo na entrada.** A `INT` desligou as interrupções, e funções como `01H` e `0AH`
   esperam o teclado, que precisa da IRQ 1. Sem o `STI`, a máquina trava esperando uma tecla que
   nunca chega ao buffer.
2. **Devolver o `CF` pelas FLAGS empilhadas.** O `IRET` restaura as FLAGS de quem chamou, então
   um `STC` dentro da rotina se perderia. O kernel liga ou desliga o bit 0 da palavra de FLAGS
   **na pilha** (`OR WORD PTR [BP+Q_FLAGS], 1` ou `AND ..., 0FFFEH`) antes do `IRET`. A outra
   saída é a do gancho de teclado do [Capítulo 20](cap20-bios-para-jogos.md): `RETF 2`, que
   descarta as FLAGS da pilha.

Os dados do kernel são lidos com o prefixo `CS:`, porque dentro da `INT 21H` o `DS` ainda é o de
quem chamou (a função `09H` precisa justamente do `DS:DX` dele). As funções implementadas e a
comparação com o DOS estão no [Capítulo 22](cap22-o-dos-por-dentro.md).

## 21.8 O mapa de memória do MINIOS

```
 0000:0000  vetores de interrupção (INT 00h, 20h e 21h apontam para o kernel)
 0000:0400  área de dados da BIOS
 0000:0500  diretório lido pelo setor de boot
 0000:7C00  setor de boot (não é mais usado depois do boot)
 0800:0000  kernel: código, dados, cópia do diretório e a pilha no fim do segmento
 2000:0000  PSP do shell             2000:0100  SHELL.COM
 3000:0000  PSP do programa          3000:0100  programa rodado pelo shell
 4000:0000  PSP do programa          4000:0100  programa rodado por esse programa
 5000:0000  buffer do comando TIPO do shell
 A000:0000  memória de vídeo
```

Cada programa ganha um segmento de 64 KB inteiro, como um `.COM` no DOS: `CS = DS = ES = SS`,
código em `0100H` e a pilha no fim do segmento. Não há gerenciador de memória: o segmento de cada
nível é fixo (`3000H + nível × 1000H`), e no máximo **dois** programas podem estar rodando um
dentro do outro acima do shell; um terceiro `EXEC` devolve o erro 8 ("memória insuficiente").

## 21.9 EXEC sem DOS: rodar um programa e voltar

A [Aula 42](../conteudo/aula42-arquivos-e-exec.md) acrescenta ao kernel a função `4BH`, que roda
um `.COM`. É o trecho mais delicado do MINIOS, porque o kernel precisa **sair de uma `INT 21H`
para dentro de outro programa** e, quando ele terminar, **voltar para dentro da mesma `INT 21H`**:

```
 shell: INT 21h, AH=4Bh ─► kernel F_4B:
                            1. acha o arquivo e o lê para 3000:0100
                            2. monta o PSP em 3000:0000 (CD 20, topo, linha de comando em 80h)
                            3. salva os vetores 00h a 3Fh deste nível
                            4. guarda SS:SP do shell (com o quadro da INT 21h no topo)
                            5. INICIA_PROGRAMA: SS = DS = ES = 3000h, SP = FFFEh com 0000h
                               no topo, registradores zerados, RETF para 3000:0100
 programa roda ... INT 20h, INT 21h AH=4Ch ou divisão por zero
                         ─► TERMINA:
                            1. guarda o código de saída (AL) para a 4Dh
                            2. restaura os vetores 00h a 3Fh
                            3. volta para o SS:SP guardado no passo 4
                            4. BP = SP e sai por FIM_OK: os POPs e o IRET do quadro do shell
 shell: ... continua depois do INT 21h, com CF = 0
```

A palavra `0000H` no topo da pilha do programa é o mesmo truque do DOS: um `.COM` que termina com
`RET` desempilha `IP = 0000H` e executa o `INT 20H` que está no offset 0 do PSP. A cópia dos
vetores (64 vetores × 4 bytes por nível) é uma rede de proteção que o DOS não tem: um jogo que
trocou a `INT 09H` e saiu sem devolvê-la não deixa o shell sem teclado.

## 21.10 Desligar e reiniciar

**Desligar.** Um PC dos anos 80 não se desliga por software; o melhor que um sistema faz é parar
a CPU e dizer "pode desligar". `HLT` para a CPU **até a próxima interrupção**: com as
interrupções ligadas, o relógio a acorda 18 vezes por segundo, e ela continua dali. Para parar
de vez, `CLI` antes:

```asm fragmento titulo="DESLIGA do shell do MINIOS"
CMD_DESLIGA PROC
        MOV  DX, OFFSET msg_desliga     ; 'Pode desligar o computador.'
        CALL TEXTO
        CLI                     ; sem interrupções, o HLT para de vez
        HLT
CMD_DESLIGA ENDP
```

(Só o NMI ainda acordaria a CPU; o kernel do MINIOS faz o mesmo `CLI` / `HLT` quando não encontra
o `SHELL.COM`.) O `HLT` com interrupções ligadas é útil em outro lugar: num laço de espera, ele
economiza energia e, num emulador, tempo de CPU do computador hospedeiro.

**Reiniciar.** Há dois caminhos:

| | `INT 19H` | `JMP FFFF:0000` |
|---|---|---|
| O que roda | só o carregador: lê o setor de boot de novo | o POST inteiro, como no Ctrl-Alt-Del |
| Vetores e memória | ficam como estavam (os do kernel antigo continuam lá) | reinstalados pelo POST |
| Teste de memória | não há | pulado se `40:72 = 1234H` |
| Uso no curso | comando `REINICIA` do shell e o "tente de novo" do boot | [Capítulo 12](cap12-boot-e-roms.md) |

A `INT 19H` é suficiente para o MINIOS porque o novo boot reinstala as `INT 00H`, `20H` e `21H`
de qualquer jeito. Ela é arriscada quando programas residentes ou placas trocaram vetores que o
POST normalmente inicializaria; por isso a IBM recomenda o salto para `FFFF:0000` como reinício
de verdade.

## 21.11 No simulador do curso

Um bloco com `boot` ganha o botão "▶ Dar boot": o simulador liga um PC **sem DOS**, escreve a
mensagem da BIOS, lê o setor 0 do disquete para `0000:7C00` e salta para lá com `CS:IP =
0000:7C00`, `DL = 00H` e a pilha da BIOS em `0030:0100`. `DOISEST.ASM` roda assim.

- **O disquete.** Num fonte comum, cada segmento começa num setor novo, na ordem em que aparece
  (o setor de boot primeiro). Num fonte com marcadores `;### ARQUIVO NOME.EXT`, cada parte é
  montada sozinha e o disco sai no formato MINIFS da seção 21.4, com o diretório preenchido;
  é assim que a [Aula 44](../conteudo/aula44-utilitarios.md) monta o disco completo do MINIOS.
- **A assinatura.** Sem `55H AAH` nos bytes 510 e 511 do setor 0, a "BIOS" se recusa a dar boot.
- **A INT 13H** tem as funções `00H` a `04H`, `08H` e `15H` a `18H`, só no drive A: (`DL = 0`), e
  avisa em três casos que num PC real dariam erro: setor fora da geometria de 1,44 MB, leitura que
  passa do setor 18 da trilha e buffer que cruza uma fronteira de 64 KB (o erro `09H` de DMA).
- **INT 21H, 20H e 27H** param a máquina com uma explicação enquanto o vetor ainda aponta para a
  BIOS: é preciso instalá-las antes. O mesmo vale para a divisão por zero (`INT 00H`).
- **INT 19H** lê o setor de boot de novo e recomeça; **INT 18H** mostra "nenhum sistema para
  iniciar". **INT 1AH** (`AH=02H` e `04H`, a hora e a data em BCD) e **INT 12H** funcionam; o
  comando `HORA` do shell usa as duas primeiras.
- **CLI + HLT** encerra a simulação; **HLT** com interrupções ligadas espera a próxima IRQ.

No depurador, os símbolos de cada arquivo aparecem como `KERNEL:NOME`, `SHELL:NOME` e assim por
diante, e o código lido do disquete é reconhecido pelos bytes, então dá para seguir o boot passo a
passo do `CLI` do setor 0 até o prompt do shell.

## 21.12 Exercícios

1. Modifique `DOISEST.ASM` para que o segundo estágio tenha dois setores (acrescente texto até
   passar de 512 bytes) e o boot leia os dois, um por vez, com `ADD BX, 512` entre as leituras.
   O que acontece se você só ler o primeiro?
2. Converta à mão os LBA 17, 18, 35 e 36 para CHS e confira com a conta do `LE_SETOR`. Qual é o
   último LBA de um disquete de 1,44 MB, e qual o seu CHS?
3. Um programa quer ler 8 setores de uma vez para `1000:F000`. Calcule o endereço físico e diga
   se a leitura cruza uma fronteira de DMA. Escolha um buffer de 8 setores que não cruze.
4. Acrescente ao `MINI21` do `DOISEST.ASM` a função `02H` (escreve `DL`) e devolva `CF = 1` para
   qualquer outra função, alterando as FLAGS empilhadas como o kernel do MINIOS faz.
5. Por que o setor de boot do MINIOS pode usar `REPE CMPSB` com `DS:SI` no diretório e `ES:DI` no
   próprio código sem trocar nenhum registrador de segmento? O que mudaria se a BIOS tivesse
   saltado para `07C0:0000`?
6. Escreva um setor de boot que mostre quantos KB de memória a `INT 12H` informa e o byte de
   equipamento da `INT 11H`, e depois desligue a máquina com `CLI` / `HLT`.

## Resumo

- Sem DOS só existem a BIOS, a IVT e a área de dados; `INT 21H` e tudo o que ela oferece
  precisam ser escritos pelo próprio sistema.
- A `INT 19H` lê o setor 0 para `0000:7C00`, confere `55H AAH` no fim e salta com `DL` = unidade.
  O setor de boot começa trocando a pilha, zerando os segmentos, `CLD` e guardando `DL`.
- Disquetes do DOS têm um BPB no começo do setor 0; o MINIOS usa o MINIFS: diretório de 16
  entradas de 32 bytes no setor 1 e arquivos contíguos a partir do setor 2.
- `INT 13H` pede CHS: `setor = LBA mod 18 + 1`, `cabeça = (LBA / 18) mod 2`, `cilindro = LBA / 36`;
  três tentativas com reset; buffers que não cruzam 64 KB físicos.
- O boot carrega o kernel em `0800:0000` e salta com `RETF` (ou `JMP FAR`); o kernel instala
  `INT 00H`, `20H` e `21H` direto na IVT entre `CLI` e `STI`.
- O MINIOS põe o shell em `2000:0100` e os programas em `3000H` e `4000H`; `CLI` + `HLT` desliga,
  `INT 19H` ou `JMP FFFF:0000` reinicia.
