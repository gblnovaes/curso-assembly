---
id: aula40
numero: 40
modulo: 14
titulo: Do botão de ligar ao setor de boot
subtitulo: POST, INT 19h, 0000:7C00, a assinatura 55AAh e a INT 13h lendo o resto do sistema
duracao: 130 min
objetivos: entender o que acontece entre ligar o PC e o primeiro byte de um sistema operacional rodar; saber o que a BIOS garante (e o que não garante) quando salta para 0000:7C00; escrever setores de boot que rodam sem DOS, falando só com a BIOS; ler setores do disquete com a INT 13h, convertendo LBA em cilindro, cabeça e setor; tentar de novo quando o disquete falha; entender o diretório do MINIFS e o setor de boot do MINIOS, que acha e carrega o kernel
---

## Um PC sem nada

Até aqui, todo programa do curso rodou **em cima do DOS**. Alguém já tinha carregado o programa na memória, montado o PSP, apontado DS e SS, e deixado a INT 21h pronta para escrever na tela, ler o teclado e abrir arquivos. Nos sete jogos do módulo 13, o DOS quase não apareceu, mas estava lá: foi ele que leu o COBRA.COM do disco e saltou para o byte 100h.

Neste módulo vamos tirar o DOS da frente e construir o nosso próprio sistema, o **MINIOS**: um setor de boot, um kernel com a sua própria INT 21h, um sistema de arquivos simples, um interpretador de comandos e alguns utilitários. No fim, os sete jogos vão rodar nele, sem mudar uma linha, porque eles só pedem ao "DOS" as funções que o nosso kernel também vai oferecer.

```diagrama titulo="O módulo 14: o MINIOS, peça por peça"
  aula 40  BOOT.BIN    setor 0    a BIOS carrega; ele acha e carrega o kernel
  aula 41  KERNEL.SYS  0800:0000  instala a INT 20h e a INT 21h
  aula 42  MINIFS+EXEC            diretório, ler arquivo, carregar um .COM
  aula 43  SHELL.COM   2000:0100  lê comandos: DIR, TIPO, HORA... ou roda X.COM
  aula 44  utilitários e o disquete completo, com os 7 jogos
```

O ponto de partida é o momento em que não existe nada além da **BIOS**. É exatamente o assunto do [capítulo 12 do livro](livro:cap12) (inicialização, ROMs e INT 19h) e do [capítulo 21](livro:cap21) (a vida sem DOS). Leia os dois junto com esta aula: o livro traz os detalhes de cada modelo de PC que aqui ficam de fora.

## Do botão ao setor de boot

Quando o PC é ligado, o 8086 começa a executar em **FFFF:0000**, 16 bytes antes do fim do primeiro megabyte. Ali há uma ROM, e nela um `JMP FAR` para o começo da BIOS. Daí em diante:

```diagrama titulo="Do botão ao primeiro byte do sistema"
  liga ──► CPU em FFFF:0000 ──► JMP para a BIOS (F000:E05B no PC original)
             │
             ▼
  POST: testa a CPU, a ROM (soma), a RAM, o PIC, o PIT, o DMA, o vídeo...
             │   "640K OK"
             ▼
  monta a IVT (0000:0000), a área de dados (0040:0000), procura ROMs
  de adaptadores (C000:0000 em diante, assinatura 55AAh) e as chama
             │
             ▼
  INT 19h: tenta o drive A:, depois o disco C:
             │  lê o setor 0 (cilindro 0, cabeça 0, setor 1)
             │  para 0000:7C00 e confere a assinatura 55AAh
             ▼
  JMP 0000:7C00   com DL = drive do boot (00h = A:, 80h = C:)
```

- **POST** (*Power-On Self Test*) é o teste de tudo. Os bipes do PC ao ligar, e os códigos de erro como "301" (teclado) ou "601" (disquete), vêm dele.
- A BIOS monta a **tabela de vetores** (IVT) com as rotinas dela (INT 10h, 13h, 16h, 1Ah...) e preenche a **área de dados** em 0040:0000 (o [capítulo 17](livro:cap17) lista cada byte).
- A **INT 19h**, o carregador de *bootstrap*, lê **um setor** do disco para **0000:7C00** e salta para ele. É só isso: 512 bytes. O que esse setor fizer depois é problema dele.

:::anos90 "Non-system disk or disk error"
Quem usou um PC nos anos 80 e 90 conhece a mensagem. Você esquecia um disquete de dados no drive A:, ligava o PC, e a BIOS lia o setor de boot do disquete. O setor de boot que o FORMAT gravava em todo disquete procurava o IO.SYS; não achava; mostrava "Non-System disk or disk error / Replace and press any key when ready". Era um setor de boot como os desta aula, só que o seu único trabalho era reclamar. E foi exatamente por esse caminho que os primeiros vírus se espalharam: o **Brain**, de 1986, se escondia no setor de boot dos disquetes e rodava antes do DOS.
:::

### Por que 7C00h?

O IBM PC original podia vir com apenas 32 KB de memória (0000h a 7FFFh). A equipe da BIOS quis carregar o setor de boot o mais alto possível dentro desses 32 KB, para deixar a memória baixa livre para o sistema que ele fosse carregar, e ainda sobrar espaço para a pilha e os dados do boot. 32 KB menos 1 KB = 7C00h. O número ficou, e todo PC compatível desde 1981 carrega o setor de boot no mesmo lugar.

## O que a BIOS garante

Quando o seu código começa a rodar em 7C00h, você sabe **muito pouco**:

| Garantido | Não garantido |
|---|---|
| O setor está em 0000:7C00 (físico 07C00h) | Que CS seja 0000h: algumas BIOS saltam para 07C0:0000 |
| DL = drive do boot (00h, 80h...) | O valor de DS, ES e SS |
| A IVT e a área de dados prontas | Onde está a pilha, ou quanto espaço ela tem |
| INT 10h, 13h, 16h, 1Ah, 19h funcionando | Nenhuma INT 21h: não existe DOS |
| A memória de 0000:0500 a 9FFFF livre (exceto 7C00h) | O estado das flags de direção e de interrupção |

Por isso todo setor de boot começa do mesmo jeito: **acerta os segmentos e a pilha antes de qualquer outra coisa**.

```asm fragmento titulo="O começo de todo setor de boot"
inicio: CLI                     ; ninguém interrompe enquanto a pilha muda
        XOR  AX, AX
        MOV  DS, AX             ; tudo no segmento 0: os endereços 7Cxxh
        MOV  ES, AX             ;  que o montador calculou já valem
        MOV  SS, AX
        MOV  SP, 7C00h          ; a pilha cresce para baixo, longe do código
        STI
        CLD
```

- **`ORG 7C00h`** faz o montador calcular os endereços dos rótulos a partir de 7C00h. Com DS = 0, `MOV SI, OFFSET mensagem` aponta para o lugar certo da memória.
- **`CLI` em volta da troca de SS e SP**: se uma interrupção chegasse entre `MOV SS` e `MOV SP`, a CPU empilharia FLAGS, CS e IP numa pilha pela metade. O 8086 já bloqueia interrupções por uma instrução depois de `MOV SS`, mas os primeiros 8088 tinham um defeito nisso, e o `CLI` deixa a intenção clara.
- **SP = 7C00h**: a pilha cresce para baixo, de 7BFFh em direção a 0500h. São quase 30 KB, muito mais do que um boot precisa, e nunca encosta no código.
- **`CLD`**: ninguém prometeu DF = 0, e `LODSB` precisa dele.

:::cpu CS:IP pode ser 0000:7C00 ou 07C0:0000
Os dois apontam para o mesmo endereço físico (0 × 16 + 7C00h = 07C0h × 16 + 0). O código acima não depende disso porque só usa saltos curtos e próximos (que são relativos ao IP) e endereços de dados com DS = 0. Se o seu boot fizer um `JMP` indireto ou uma tabela de endereços de código, o IP importa: aí é comum começar com um `JMP FAR 0000:7C05h` para fixar CS = 0. A [aula 12](aula:aula12) mostra por que vários segmento:offset dão o mesmo endereço.
:::

## A assinatura e o tamanho

A BIOS só salta para o setor se os **dois últimos bytes** forem **55h e AAh**. É assim que ela distingue um disco com sistema de um disquete apagado (que estaria cheio de F6h ou 00h). Em MASM, o fim de todo setor de boot é:

```asm fragmento titulo="Os últimos 2 dos 512 bytes"
        ORG 7DFEh               ; pula até o byte 510 do setor (7C00h + 1FEh)
        DW  0AA55h              ; little-endian: 55h no byte 510, AAh no 511
```

O `ORG 7DFEh` **preenche** o espaço entre o fim do código e o byte 510. Se o código passar de 510 bytes, o `ORG` voltaria para trás, e o montador do curso avisa. O setor inteiro precisa ter **exatamente 512 bytes**: é a unidade que a INT 13h lê.

## O primeiro sistema: OLÁ

Este é o menor "sistema operacional" possível: ele escreve uma mensagem pela BIOS e desliga a CPU. Clique em **▶ Dar boot**: o simulador liga um PC sem DOS, mostra a mensagem da BIOS, lê este setor para 7C00h e salta.

```asm boot titulo="OLA.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  OLA.ASM  -  o menor sistema operacional do mundo             ║
; ║  Um setor de boot que escreve uma mensagem e desliga a CPU.   ║
; ╚══════════════════════════════════════════════════════════════╝
OLA     SEGMENT
        ORG 7C00h               ; a BIOS carrega o setor em 0000:7C00

inicio: XOR  AX, AX
        MOV  DS, AX             ; DS = 0: os OFFSETs (7Cxxh) valem como estão
        MOV  SS, AX
        MOV  SP, 7C00h          ; pilha logo abaixo do código
        CLD
        MOV  SI, OFFSET mensagem
proximo:
        LODSB                   ; AL = [DS:SI], SI = SI + 1
        OR   AL, AL             ; o zero marca o fim do texto
        JZ   parado
        MOV  AH, 0Eh            ; INT 10h, AH=0Eh: escreve como um teletipo
        MOV  BX, 0007h          ; página 0, cor cinza
        INT  10h
        JMP  proximo
parado: CLI                     ; ninguém mais interrompe...
        HLT                     ; ...e a CPU para de vez

mensagem DB 'Ola! Este PC nao tem DOS: so a BIOS e eu.', 13, 10
         DB 'Eu sou um setor de boot de 512 bytes.', 13, 10, 0

        ORG 7DFEh               ; pula até os 2 últimos bytes do setor
        DW  0AA55h              ; a assinatura: 55h, AAh
OLA     ENDS
END inicio
```

Repare em três coisas:

1. **Não há `.MODEL` nem `INT 21h`.** O programa é um `SEGMENT` com `ORG 7C00h`. Uma `INT 21h` aqui pararia o simulador com um erro: a entrada 21h da IVT está vazia, porque ninguém instalou um DOS.
2. **A tela é da BIOS.** `INT 10h, AH=0Eh` (o "teletipo") escreve o caractere de AL na posição do cursor, anda o cursor e entende 13 (volta ao começo da linha) e 10 (desce uma linha). O [capítulo 3 do livro](livro:cap03) descreve a função e as outras 15 do vídeo.
3. **`CLI` + `HLT` desliga.** `HLT` para a CPU até a próxima interrupção; com as interrupções desligadas, ela nunca vem. Num PC real, a máquina fica parada até alguém apertar o reset. No simulador, num disquete de boot, essa é a forma de "desligar" o sistema.

:::atencao HLT no DOS e HLT no boot
Num programa do DOS, o simulador trata `HLT` como fim de programa. Num disquete de boot, `HLT` com as interrupções ligadas **espera** a próxima interrupção (o tique do timer, 18,2 vezes por segundo, ou uma tecla), como num PC de verdade. O kernel do MINIOS usa isso para não gastar CPU à toa enquanto espera.
:::

## Um boot que conversa

O segundo setor de boot lê o teclado pela **INT 16h** e mostra as teclas. ESC chama a **INT 19h**, que lê o setor de boot de novo e recomeça tudo, como um "reset" sem desligar.

```asm boot titulo="TECLA.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  TECLA.ASM  -  um setor de boot que conversa                  ║
; ║  Mostra as teclas digitadas. ESC dá boot de novo (INT 19h).   ║
; ╚══════════════════════════════════════════════════════════════╝
BOOT    SEGMENT
        ORG 7C00h

inicio: CLI
        XOR  AX, AX
        MOV  DS, AX
        MOV  SS, AX
        MOV  SP, 7C00h
        STI                     ; a INT 16h precisa das interrupções ligadas
        CLD
        MOV  [drive], DL        ; a BIOS diz de onde veio o boot
        MOV  SI, OFFSET titulo
        CALL ESCREVE
        MOV  AL, [drive]        ; mostra o drive: 0 = A:, 80h = C:
        CALL HEXA
        MOV  SI, OFFSET pede
        CALL ESCREVE
tecla:  XOR  AH, AH             ; INT 16h, AH=00h: espera uma tecla
        INT  16h
        CMP  AL, 27             ; ESC?
        JE   reinicia
        CMP  AL, 13             ; ENTER pula linha
        JNE  mostra
        MOV  SI, OFFSET crlf
        CALL ESCREVE
        JMP  tecla
mostra: MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  tecla
reinicia:
        MOV  SI, OFFSET tchau
        CALL ESCREVE
        INT  19h                ; lê o setor de boot de novo e salta para ele

ESCREVE PROC                    ; texto terminado em 0, em DS:SI
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE ENDP

HEXA    PROC                    ; AL em 2 dígitos hexadecimais
        PUSH AX
        MOV  CL, 4
        SHR  AL, CL
        CALL DIGITO
        POP  AX
        AND  AL, 0Fh
DIGITO: ADD  AL, '0'            ; (cai aqui também para o segundo dígito)
        CMP  AL, '9'
        JBE  @@sai
        ADD  AL, 7              ; 'A' - '9' - 1
@@sai:  MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        RET
HEXA    ENDP

drive   DB 0
titulo  DB 'Boot pelo drive ', 0
pede    DB 'h. Digite (ESC reinicia):', 13, 10, 0
crlf    DB 13, 10, 0
tchau   DB 13, 10, 'INT 19h: boot de novo...', 13, 10, 0

        ORG 7DFEh
        DW  0AA55h
BOOT    ENDS
END inicio
```

- O **`STI`** depois de acertar a pilha é obrigatório: a INT 16h espera a tecla com as interrupções ligadas, porque é a IRQ 1 (INT 09h) que coloca as teclas no buffer. Com `CLI`, a espera nunca terminaria. O [capítulo 6 do livro](livro:cap06) mostra o caminho da tecla, da porta 60h ao buffer em 40:1Eh.
- O valor de **DL** que a BIOS deixou é guardado na primeira oportunidade: qualquer `INT` pode estragar DL.
- `HEXA` mostra o truque de "cair" de uma rotina na outra: o segundo dígito é tratado pelo mesmo código, sem um `CALL`, economizando bytes. Num setor de boot, onde só há 510 bytes, esse tipo de economia era comum.

## Lendo o resto do disco: INT 13h

Um setor de boot sozinho não vai longe. O trabalho dele é **ler mais setores**: o kernel, o sistema de arquivos, o que for. Quem lê setores é a **INT 13h**, o serviço de disco da BIOS ([capítulo 9 do livro](livro:cap09), o disquete).

```diagrama titulo="INT 13h, AH = 02h: ler setores"
  entrada:  AH = 02h          AL = quantos setores
            CH = cilindro     CL = setor (começa em 1!)
            DH = cabeça       DL = drive (00h = A:, 80h = C:)
            ES:BX = onde gravar
  saída:    CF = 0 deu certo, AL = setores lidos
            CF = 1 erro, AH = código (80h = drive não respondeu,
                   04h = setor não encontrado, ...)
```

A BIOS não conhece "o setor 5 do disco". Ela fala a língua da controladora: **cilindro** (a trilha, contando de fora para dentro), **cabeça** (o lado do disquete) e **setor** (a posição na trilha). Um disquete de 1,44 MB tem 80 cilindros, 2 cabeças e 18 setores por trilha: 80 × 2 × 18 = 2 880 setores de 512 bytes.

```asm boot titulo="LEITOR.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  LEITOR.ASM  -  o setor de boot lê o setor seguinte           ║
; ║  O segmento TEXTO vai para o setor 1 do disquete. O boot o    ║
; ║  lê pela INT 13h para 0000:0600 e mostra o que tem lá.        ║
; ╚══════════════════════════════════════════════════════════════╝
BOOT    SEGMENT
        ORG 7C00h

BUFFER  EQU 0600h               ; onde o setor lido vai parar

inicio: CLI
        XOR  AX, AX
        MOV  DS, AX
        MOV  ES, AX             ; INT 13h grava em ES:BX
        MOV  SS, AX
        MOV  SP, 7C00h
        STI
        CLD
        MOV  [drive], DL
        MOV  DI, 3              ; 3 tentativas: disquetes falham, e o
le:     MOV  AX, 0201h          ;  motor pode não ter girado ainda
        MOV  CX, 0002h          ; CH = cilindro 0, CL = setor 2 (o 1 é o boot)
        XOR  DH, DH             ; cabeça 0
        MOV  DL, [drive]
        MOV  BX, BUFFER         ; ES:BX = 0000:0600
        INT  13h                ; AH=02h: ler AL setores
        JNC  leu
        XOR  AH, AH             ; AH=00h: reinicia a controladora
        INT  13h
        DEC  DI
        JNZ  le
        MOV  SI, OFFSET falhou
        JMP  SHORT mostra
leu:    MOV  SI, BUFFER         ; o texto lido do disco
mostra: LODSB
        OR   AL, AL
        JZ   fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  mostra
fim:    CLI
        HLT

drive   DB 0
falhou  DB 'Erro lendo o setor 2.', 0

        ORG 7DFEh
        DW  0AA55h
BOOT    ENDS

; tudo daqui para baixo vai para o setor seguinte do disquete
TEXTO   SEGMENT
        ORG 0
        DB 'Este texto nao estava na memoria: estava no setor 2', 13, 10
        DB '(cilindro 0, cabeca 0), e o setor de boot o leu pela', 13, 10
        DB 'INT 13h. E assim que um boot carrega um sistema.', 13, 10, 0
TEXTO   ENDS
END inicio
```

Este disquete tem **dois segmentos**. O primeiro, `BOOT`, é o setor de boot. O segundo, `TEXTO`, o simulador grava no setor seguinte do disquete (cilindro 0, cabeça 0, **setor 2**), e o boot o lê para 0000:0600. A área de 0500h a 7BFFh é memória livre, e 0600h fica longe da pilha.

### Por que tentar três vezes

Disquetes falham. O motor do drive leva meio segundo para chegar à velocidade certa, e a primeira leitura depois de ligar o motor pode dar erro. A recomendação da IBM, repetida no [capítulo 9 do livro](livro:cap09), é: **em caso de erro, reinicie a controladora (`AH=00h`) e tente de novo, até três vezes**. Só depois disso o erro é real.

### De LBA para CHS

Pensar em cilindros e cabeças é desconfortável. É mais simples numerar os setores do disco de 0 a 2 879, o **endereço lógico** (*Logical Block Address*, LBA), e converter na hora de chamar a BIOS. Os setores vão enchendo a trilha (18 por trilha), depois a outra cabeça (o outro lado do disquete), depois o cilindro seguinte:

```diagrama titulo="LBA → cilindro, cabeça, setor (18 setores, 2 cabeças)"
  LBA   0 ..  17   →  cilindro 0, cabeça 0, setores 1..18
  LBA  18 ..  35   →  cilindro 0, cabeça 1, setores 1..18
  LBA  36 ..  53   →  cilindro 1, cabeça 0, setores 1..18
  ...
  LBA 2879         →  cilindro 79, cabeça 1, setor 18

  setor    = LBA mod 18 + 1
  cabeça   = (LBA / 18) mod 2
  cilindro = LBA / 36           (= (LBA / 18) / 2)
```

Uma divisão por 18 dá as duas coisas de uma vez: o resto (DX) é o setor menos 1, e o quociente (AX) é o número da trilha "corrida". Dessa trilha, o bit 0 é a cabeça e o resto (deslocado uma vez) é o cilindro:

```asm fragmento titulo="LE_SETOR: a conversão (do BOOT.ASM do MINIOS)"
        XOR  DX, DX
        MOV  CX, SETORES_TRILHA
        DIV  CX                 ; AX = LBA / 18, DX = LBA mod 18
        MOV  CL, DL
        INC  CL                 ; CL = setor
        MOV  DH, AL
        AND  DH, CABECAS-1      ; DH = cabeça
        SHR  AX, 1
        MOV  CH, AL             ; CH = cilindro
```

`AND DH, CABECAS-1` (com `CABECAS` = 2, é `AND DH,1`) é o resto da divisão por 2, e `SHR AX,1` é o quociente. Os exercícios 1 e 2 pedem as duas conversões.

:::cpu Os 10 bits do cilindro
Nos discos rígidos, o cilindro pode passar de 255. A INT 13h então usa os **bits 6 e 7 de CL** como os bits 8 e 9 do cilindro, e o setor fica só com os bits 0 a 5 (até 63). É o famoso limite de 1024 cilindros × 255 cabeças × 63 setores = 8 GB, que os PCs dos anos 90 conheceram bem. Num disquete, com 80 cilindros, nada disso aparece. O [capítulo 10 do livro](livro:cap10) explica a conta.
:::

## O MINIFS: um diretório num setor

Para achar o kernel, o boot precisa saber **onde** ele está no disco. O DOS usa o sistema de arquivos FAT12, com tabelas de alocação, diretório raiz e clusters (o [capítulo 22 do livro](livro:cap22) faz um passeio por ele). Ler FAT12 num setor de boot é possível (o do DOS faz isso), mas toma quase todo o espaço. O MINIOS usa um formato bem mais simples, o **MINIFS**:

```diagrama titulo="O disquete do MINIOS"
  LBA 0      setor de boot (BOOT.BIN), 512 bytes, termina em 55AAh
  LBA 1      diretório: 16 entradas de 32 bytes
  LBA 2...   os arquivos, um atrás do outro, cada um começando num
             setor novo

  uma entrada do diretório (32 bytes):
   0        11  12    14    16          20                    31
  ┌───────────┬──┬─────┬─────┬───────────┬──────────────────────┐
  │KERNEL  SYS│04│ 0002│ 0004│ 0000 0710 │ (livre)              │
  └───────────┴──┴─────┴─────┴───────────┴──────────────────────┘
   nome 8 + 3  │  1º    nº de  tamanho em
   sem o ponto │  setor setores bytes (dword)
           atributo (04h = sistema, 20h = arquivo comum)
           entrada livre: nome começando com 0
```

- O nome fica no formato **8.3 do DOS, sem o ponto**: 8 caracteres de nome e 3 de extensão, completados com espaços. `KERNEL.SYS` vira `'KERNEL  SYS'`, e `COBRA.COM` vira `'COBRA   COM'`. Assim, comparar nomes é comparar 11 bytes, sem se preocupar com o ponto nem com o tamanho do nome.
- Cada arquivo ocupa setores **seguidos**. Como o MINIOS não grava arquivos, não há fragmentação: basta saber o primeiro setor e quantos são.
- O diretório cabe num setor e o boot o lê de uma vez, para 0000:0500.

O simulador monta esse disquete para você a partir de um bloco com várias partes, uma por arquivo, separadas por linhas `;### ARQUIVO NOME.EXT` (o laboratório também aceita esse formato: cole lá o bloco inteiro e ele é montado como disquete, com o mapa dos setores na aba Discos).

## O setor de boot do MINIOS

Agora juntamos tudo: acertar a pilha, ler o diretório, procurar o `KERNEL  SYS` com `REPE CMPSB`, ler os setores do kernel um por um para **0800:0000** e saltar para lá.

```asm titulo="BOOT.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  BOOT.ASM  -  setor de boot do MINIOS (512 bytes)             ║
; ║  Curso Assembly 8086, aula 40                                 ║
; ║                                                               ║
; ║  A BIOS lê este setor para 0000:7C00 e salta para cá com      ║
; ║  DL = drive do boot. Ele lê o diretório (setor 1), acha o     ║
; ║  KERNEL.SYS e carrega o kernel em 0800:0000.                  ║
; ╚══════════════════════════════════════════════════════════════╝
BOOT SEGMENT
        ORG 7C00h

SEG_KERNEL  EQU 0800h           ; onde o kernel vai morar (8000h físico)
DIRETORIO   EQU 0500h           ; o diretório é lido para 0000:0500
ENTRADAS    EQU 16              ; 16 entradas de 32 bytes no setor 1
SETORES_TRILHA EQU 18           ; disquete de 1,44 MB: 18 setores por trilha
CABECAS     EQU 2

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

        MOV  SI, OFFSET msg_ola
        CALL ESCREVE

        MOV  AX, 1              ; setor 1 (LBA) = diretório
        MOV  BX, DIRETORIO
        CALL LE_SETOR

        MOV  SI, DIRETORIO      ; procura 'KERNEL  SYS' nas 16 entradas
        MOV  CX, ENTRADAS
@@procura:
        PUSH CX
        PUSH SI
        MOV  DI, OFFSET nome_kernel
        MOV  CX, 11
        REPE CMPSB              ; compara DS:SI com ES:DI (os dois no seg. 0)
        POP  SI
        POP  CX
        JE   @@achou
        ADD  SI, 32
        LOOP @@procura
        MOV  SI, OFFSET msg_sem_kernel
        JMP  ERRO

@@achou:
        MOV  AX, [SI+12]        ; primeiro setor do arquivo
        MOV  CX, [SI+14]        ; quantos setores
        MOV  BX, SEG_KERNEL
        MOV  ES, BX
        XOR  BX, BX             ; ES:BX = 0800:0000
@@setor:
        CALL LE_SETOR
        INC  AX
        ADD  BX, 512
        MOV  SI, OFFSET msg_ponto
        CALL ESCREVE            ; um ponto por setor, como nos anos 90
        LOOP @@setor

        MOV  DL, drive          ; o kernel também quer saber o drive
        MOV  AX, SEG_KERNEL     ; salto longe para 0800:0000:
        PUSH AX                 ; empilha CS e IP e "volta" para lá
        XOR  AX, AX
        PUSH AX
        RETF

; LE_SETOR: lê o setor lógico AX (LBA) para ES:BX. Tenta 3 vezes.
; A BIOS não entende LBA, só cilindro/cabeça/setor (CHS):
;   setor    = LBA mod 18 + 1    (os setores começam em 1!)
;   cabeça   = (LBA / 18) mod 2
;   cilindro = LBA / 36
LE_SETOR PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH DI
        XOR  DX, DX
        MOV  CX, SETORES_TRILHA
        DIV  CX                 ; AX = LBA / 18, DX = LBA mod 18
        MOV  CL, DL
        INC  CL                 ; CL = setor
        MOV  DH, AL
        AND  DH, CABECAS-1      ; DH = cabeça
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

; ESCREVE: texto terminado em 0 (DS:SI) pela BIOS (INT 10h, AH=0Eh)
ESCREVE PROC
        PUSH AX
        PUSH BX
        PUSH SI
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  @@car
@@fim:  POP  SI
        POP  BX
        POP  AX
        RET
ESCREVE ENDP

; ERRO: mostra a mensagem SI e para. Uma tecla tenta o boot de novo.
ERRO:   CALL ESCREVE
        MOV  SI, OFFSET msg_tecla
        CALL ESCREVE
        XOR  AH, AH
        INT  16h
        INT  19h                ; recomeça o boot

drive          DB 0
nome_kernel    DB 'KERNEL  SYS'  ; 8 + 3, sem o ponto, como no diretório
msg_ola        DB 'MINIOS: carregando o kernel', 0
msg_ponto      DB '.', 0
msg_sem_kernel DB 13, 10, 'KERNEL.SYS nao esta no disco.', 0
msg_erro_disco DB 13, 10, 'Erro lendo o disquete.', 0
msg_tecla      DB 13, 10, 'Aperte uma tecla para tentar de novo.', 0

        ORG 7DFEh               ; os dois últimos bytes do setor:
        DW  0AA55h              ; a assinatura que a BIOS procura (55h AAh)
BOOT ENDS
END inicio
```

### A procura com REPE CMPSB

```asm fragmento titulo="Procurando o kernel nas 16 entradas"
        MOV  SI, DIRETORIO      ; procura 'KERNEL  SYS' nas 16 entradas
        MOV  CX, ENTRADAS
@@procura:
        PUSH CX
        PUSH SI
        MOV  DI, OFFSET nome_kernel
        MOV  CX, 11
        REPE CMPSB              ; compara DS:SI com ES:DI (os dois no seg. 0)
        POP  SI
        POP  CX
        JE   @@achou
        ADD  SI, 32
        LOOP @@procura
```

`REPE CMPSB` compara o byte em DS:SI com o byte em ES:DI, avança os dois e repete **enquanto forem iguais** e CX não chegar a zero. No fim, ZF = 1 se os 11 bytes bateram ([aula 13](aula:aula13)). Como `CMPSB` estraga SI e CX, os dois são guardados na pilha em volta da comparação: o SI original avança 32 bytes para a próxima entrada, e o CX original conta as entradas.

### Carregar e saltar

O kernel é lido setor a setor, avançando ES:BX 512 bytes de cada vez, com um ponto na tela por setor, como os carregadores dos anos 90 faziam. Ler um setor por vez é mais lento que pedir vários à BIOS de uma vez, mas evita dois problemas: uma leitura de vários setores não pode passar do fim da trilha em muitas BIOS, e não pode cruzar uma **fronteira de 64 KB** da memória, por causa do DMA ([capítulo 9 do livro](livro:cap09)).

Para saltar para 0800:0000, o boot usa um truque: **empilha o segmento e o offset e executa `RETF`**. O `RETF` tira IP e CS da pilha e salta para lá, como se estivesse voltando de uma chamada que nunca aconteceu. É o jeito clássico de fazer um salto longe para um endereço calculado, porque o 8086 não tem `JMP FAR` para um endereço num registrador.

```asm fragmento titulo="O salto para o kernel"
        MOV  DL, drive          ; o kernel também quer saber o drive
        MOV  AX, SEG_KERNEL     ; salto longe para 0800:0000:
        PUSH AX                 ; empilha CS e IP e "volta" para lá
        XOR  AX, AX
        PUSH AX
        RETF
```

### Por que o kernel em 0800:0000?

O endereço físico é 8000h, 32 KB. Abaixo dele ficam a IVT (0000h a 03FFh), a área de dados da BIOS (0400h a 04FFh), o diretório (0500h), a pilha e o próprio setor de boot (7C00h a 7DFFh). Acima, o kernel tem espaço livre até onde quiser. Um segmento novo (0800h) com offset 0 deixa o kernel ser montado com `ORG 0`, como se tivesse a memória toda para ele. A [aula 41](aula:aula41) desenha o mapa completo.

## O boot carregando um kernel

Para ver o boot do MINIOS funcionando, falta um kernel. Este aqui é o mais simples possível: ele só prova que foi carregado, mostrando o próprio CS. Clique em **▶ Dar boot**. A primeira linha do bloco puxa o `BOOT.ASM` acima; a segunda parte é o kernel.

```asm boot titulo="DISCO1.IMG"
;### ARQUIVO BOOT.BIN = aula40/BOOT.ASM
;### ARQUIVO KERNEL.SYS
; ╔══════════════════════════════════════════════════════════════╗
; ║  KERNEL0.ASM  -  um "kernel" que só prova que foi carregado   ║
; ╚══════════════════════════════════════════════════════════════╝
KERNEL  SEGMENT
        ORG 0

inicio: MOV  AX, CS             ; o boot saltou para 0800:0000
        MOV  DS, AX             ; os dados do kernel estão no segmento dele
        MOV  SI, OFFSET mensagem
        CALL ESCREVE
        MOV  AX, CS             ; mostra o CS, para conferir o endereço
        CALL HEXA16
        MOV  SI, OFFSET fim_msg
        CALL ESCREVE
        CLI
        HLT

ESCREVE PROC
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  @@car
@@fim:  RET
ESCREVE ENDP

HEXA16  PROC                    ; AX em 4 dígitos hexadecimais
        MOV  CX, 4
@@dig:  PUSH CX
        MOV  CL, 4
        ROL  AX, CL             ; o nibble de cima vai para baixo
        PUSH AX
        AND  AL, 0Fh
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 7
@@ok:   MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        POP  AX
        POP  CX
        LOOP @@dig
        RET
HEXA16  ENDP

mensagem DB 13, 10, 'Kernel carregado! Estou rodando em CS = ', 0
fim_msg  DB 'h.', 13, 10, 'Ainda nao tenho INT 21h, nem shell: isso e a aula 41.', 13, 10, 0
KERNEL  ENDS
END inicio
```

Você deve ver "MINIOS: carregando o kernel" seguido de um ponto por setor e, depois, a mensagem do kernel com **CS = 0800h**. No depurador, abra a memória em 0000:0500 e veja o diretório que o boot leu: a entrada do `KERNEL  SYS`, com o atributo 04h e o primeiro setor 0002h.

:::dica Teste com um kernel ruim
Mude o nome `KERNEL.SYS` da segunda parte para `KERNEL.BIN` e dê boot de novo. O setor de boot não acha o kernel, mostra "KERNEL.SYS nao esta no disco" e espera uma tecla para chamar a INT 19h. É o "Non-system disk" do MINIOS.
:::

## Exercícios

```exercicio
id: a40-1
titulo: De LBA para CHS
nivel: 1
--- enunciado
**AX** traz um setor lógico (LBA) de um disquete de 1,44 MB (18 setores por trilha, 2 cabeças). Calcule os parâmetros da INT 13h: **CH** = cilindro, **DH** = cabeça e **CL** = setor (que começa em 1).
--- inicial
; AX = LBA (0 a 2879)
; CH = cilindro, DH = cabeça, CL = setor
        MOV  CL, AL
--- testes
[{ "nome": "LBA 0: o setor de boot", "setup": { "AX": 0 }, "espera": { "CH": 0, "DH": 0, "CL": 1 } },
 { "nome": "LBA 1: o diretório", "setup": { "AX": 1 }, "espera": { "CH": 0, "DH": 0, "CL": 2 } },
 { "nome": "LBA 17: o último da trilha", "setup": { "AX": 17 }, "espera": { "CH": 0, "DH": 0, "CL": 18 } },
 { "nome": "LBA 18: o outro lado", "setup": { "AX": 18 }, "espera": { "CH": 0, "DH": 1, "CL": 1 } },
 { "nome": "LBA 36: cilindro 1", "setup": { "AX": 36 }, "espera": { "CH": 1, "DH": 0, "CL": 1 } },
 { "nome": "LBA 1000", "setup": { "AX": 1000 }, "espera": { "CH": 27, "DH": 1, "CL": 11 } },
 { "nome": "LBA 2879: o último do disquete", "setup": { "AX": 2879 }, "espera": { "CH": 79, "DH": 1, "CL": 18 } }]
--- dicas
Divida por 18 com um divisor de 16 bits: XOR DX,DX / MOV BX,18 / DIV BX. O resto (DL) mais 1 é o setor.
O quociente (AX) é a trilha "corrida". O bit 0 dela é a cabeça; o resto, deslocado uma vez para a direita, é o cilindro.
Guarde o setor em CL antes de mexer em DH: o resto está em DL, que faz parte de DX.
--- solucao
; AX = LBA (0 a 2879)
; CH = cilindro, DH = cabeça, CL = setor
        XOR  DX, DX
        MOV  BX, 18
        DIV  BX                 ; AX = LBA / 18, DX = LBA mod 18
        MOV  CL, DL
        INC  CL                 ; setor = resto + 1
        MOV  DH, AL
        AND  DH, 1              ; cabeça = trilha mod 2
        SHR  AX, 1
        MOV  CH, AL             ; cilindro = trilha / 2
```

```exercicio
id: a40-2
titulo: De CHS para LBA
nivel: 2
--- enunciado
Faça o caminho inverso: **CH** = cilindro, **DH** = cabeça e **CL** = setor (1 a 18) de um disquete de 1,44 MB. Devolva em **AX** o setor lógico: `LBA = (cilindro × 2 + cabeça) × 18 + setor − 1`.
--- inicial
; CH = cilindro, DH = cabeça, CL = setor (1-18)
; AX = LBA
        XOR  AX, AX
--- testes
[{ "nome": "0/0/1 = setor de boot", "setup": { "CX": 1, "DX": 0 }, "espera": { "AX": 0 } },
 { "nome": "0/0/2", "setup": { "CX": 2, "DX": 0 }, "espera": { "AX": 1 } },
 { "nome": "0/1/1", "setup": { "CX": 1, "DX": 256 }, "espera": { "AX": 18 } },
 { "nome": "1/0/1", "setup": { "CX": 257, "DX": 0 }, "espera": { "AX": 36 } },
 { "nome": "27/1/11", "setup": { "CX": 6923, "DX": 256 }, "espera": { "AX": 1000 } },
 { "nome": "79/1/18", "setup": { "CX": 20242, "DX": 256 }, "espera": { "AX": 2879 } }]
--- dicas
Comece pela trilha corrida: MOV AL,CH / XOR AH,AH / SHL AX,1 / ADD AL,DH (cabe em 8 bits: no máximo 159).
Multiplique por 18: MOV BL,18 / MUL BL deixa AX = trilha × 18 (MUL de 8 bits).
Some o setor menos 1: MOV BL,CL / DEC BL / XOR BH,BH / ADD AX,BX.
--- solucao
; CH = cilindro, DH = cabeça, CL = setor (1-18)
; AX = LBA
        MOV  AL, CH
        XOR  AH, AH
        SHL  AX, 1
        ADD  AL, DH             ; trilha = cilindro * 2 + cabeça
        MOV  BL, 18
        MUL  BL                 ; AX = trilha * 18
        MOV  BL, CL
        DEC  BL
        XOR  BH, BH
        ADD  AX, BX             ; + setor - 1
```

```exercicio
id: a40-3
titulo: Escrever pela BIOS
nivel: 1
exigir: LODSB
--- enunciado
Num setor de boot não existe INT 21h. Escreva o texto **mensagem** (terminado em 0) na tela usando só a BIOS: `INT 10h` com `AH = 0Eh` escreve o caractere de AL e avança o cursor (BX = 0007h: página 0, cor cinza). Use `LODSB` para ler os caracteres.
--- inicial
        JMP  inicio
mensagem DB 40 DUP (0)
inicio: MOV  SI, OFFSET mensagem
        ; escreva até achar o 0
--- testes
[{ "nome": "MINIOS", "setup": { "mensagem": "MINIOS carregando" }, "espera": { "telaContem": "MINIOS carregando" } },
 { "nome": "outra mensagem", "setup": { "mensagem": "Non-system disk" }, "espera": { "telaContem": "Non-system disk" } },
 { "nome": "uma letra", "setup": { "mensagem": "X" }, "espera": { "telaContem": "X" } }]
--- dicas
O laço: LODSB / OR AL,AL / JZ fim / MOV AH,0Eh / MOV BX,0007h / INT 10h / JMP volta.
CLD antes do laço garante que LODSB avance SI para a frente.
O rótulo fim pode ficar logo depois do JMP, no fim do trecho.
--- solucao
        JMP  inicio
mensagem DB 40 DUP (0)
inicio: MOV  SI, OFFSET mensagem
        CLD
proximo:
        LODSB
        OR   AL, AL
        JZ   fim
        MOV  AH, 0Eh
        MOV  BX, 0007h
        INT  10h
        JMP  proximo
fim:
```

```quiz
? Em que endereço a BIOS carrega o setor de boot?
- F000:FFF0, junto da BIOS
+ 0000:7C00 (físico 07C00h)
- 0000:0100, como um .COM
> 7C00h = 32 KB − 1 KB: o lugar mais alto da memória mínima do primeiro PC, deixando espaço para o boot e a pilha.

? Por que um setor de boot começa com `XOR AX,AX` / `MOV DS,AX` / `MOV SS,AX` / `MOV SP,7C00h`?
+ Porque a BIOS não garante os valores de DS, SS e SP, e o código foi montado com ORG 7C00h esperando DS = 0
- Porque o 8086 sempre começa com DS = 7C00h
- Para apagar a tabela de vetores
> Só DL (o drive) e o endereço 0000:7C00 são garantidos. Pilha e segmentos de dados são responsabilidade do boot.

? O que a BIOS confere antes de saltar para o setor de boot?
- Se o setor tem a palavra "BOOT"
+ Se os bytes 510 e 511 são 55h e AAh
- Se o primeiro byte é um JMP
> Em MASM: `ORG 7DFEh` / `DW 0AA55h`. Little-endian: 55h vem primeiro.

? Qual é o setor CHS do LBA 18 num disquete de 1,44 MB?
- cilindro 1, cabeça 0, setor 1
+ cilindro 0, cabeça 1, setor 1
- cilindro 0, cabeça 0, setor 19
> Cada trilha tem 18 setores (LBA 0 a 17). O LBA 18 é o primeiro setor do outro lado (cabeça 1) do mesmo cilindro.

? O que fazer quando a INT 13h devolve CF = 1 lendo um disquete?
- Desistir: o disquete está estragado
+ Reiniciar a controladora (AH=00h) e tentar de novo, até três vezes
- Chamar a INT 19h
> O motor pode ainda não ter chegado à velocidade. A IBM recomenda três tentativas antes de considerar o erro real.

? Por que o boot do MINIOS salta para o kernel com `PUSH AX` / `PUSH AX` / `RETF`?
- Porque o RETF é mais rápido que um JMP
+ Porque o 8086 não tem JMP FAR para um endereço que está em registradores; o RETF tira IP e CS da pilha e salta para lá
- Para que o kernel possa voltar para o boot com RET
> É o salto longe "calculado": empilhe o segmento, depois o offset, e faça RETF.

? Num disquete de boot, sem DOS, o que acontece com `MOV AH,9` / `INT 21h`?
- A mensagem aparece na tela
+ Nada sabe tratar a INT 21h: o vetor está vazio até alguém instalar um DOS (o simulador para com um erro)
- A BIOS escreve a mensagem pela INT 10h
> A INT 21h é do DOS, não da BIOS. O kernel do MINIOS, na aula 41, instala a sua própria.
```

## Desafios

1. **Boot com menu.** Faça um setor de boot que mostra "1 - OLA / 2 - LEITOR" e, conforme a tecla, lê o setor 2 ou o setor 3 para 0000:0600 e salta para lá com `JMP` (os dois programas são segmentos com `ORG 600h`).
2. **Barra de progresso.** Troque os pontos do BOOT.ASM por uma barra `[####......]` que mostra quantos setores do kernel já foram lidos, usando `INT 10h, AH=02h` para voltar o cursor.
3. **Ler vários setores de uma vez.** Leia o kernel com uma só chamada da INT 13h por trilha, calculando quantos setores faltam até o fim da trilha (18 − setor + 1). Meça a diferença no simulador contando os ciclos.
4. **Setor de boot que se copia.** Os setores de boot do DOS e do Linux antigo se copiam de 7C00h para outro lugar (0000:0600, por exemplo) com `REP MOVSW` e continuam rodando lá, para deixar 7C00h livre para outro setor de boot (o da partição, num disco rígido). Faça isso e prove que funciona lendo outro setor para 7C00h.
5. **Mensagem colorida.** Use `INT 10h, AH=09h` para escrever cada caractere com um atributo de cor diferente, andando o cursor com `AH=02h`. O [capítulo 3 do livro](livro:cap03) explica a diferença entre 09h, 0Ah e 0Eh.

## No livro

- [Capítulo 12, inicialização e ROMs](livro:cap12): o POST, as ROMs de adaptadores com 55AAh, a INT 19h e a INT 18h (o BASIC da ROM, quando não há disco de boot).
- [Capítulo 9, o disquete](livro:cap09): todas as funções da INT 13h para disquete, os códigos de erro, as três tentativas e a fronteira de 64 KB do DMA.
- [Capítulo 3, o vídeo](livro:cap03): a INT 10h, `AH=0Eh` (teletipo) e as outras formas de escrever caracteres.
- [Capítulo 6, o teclado](livro:cap06): a INT 16h, que funciona antes de qualquer DOS.
- [Capítulo 17, a área de dados](livro:cap17): o que a BIOS deixa preparado em 0040:0000 antes do boot.
- [Capítulo 21, sem DOS](livro:cap21): o setor de boot, o carregamento do kernel e o mapa de memória do MINIOS, com mais detalhes.

:::resumo
- Ao ligar, o 8086 começa em FFFF:0000; a BIOS faz o POST, monta a IVT e a área de dados e chama a INT 19h, que lê o setor 0 do disco para **0000:7C00** e salta para lá com **DL = drive**.
- A BIOS só aceita o setor se os bytes 510 e 511 forem **55h AAh** (`ORG 7DFEh` / `DW 0AA55h`). O setor tem exatamente 512 bytes.
- Todo boot começa acertando DS, ES, SS e SP (com CLI em volta), e CLD. Não há INT 21h: só a BIOS (INT 10h, 13h, 16h, 19h, 1Ah).
- A INT 13h, AH=02h, lê setores por cilindro, cabeça e setor (este começa em 1). Converta de LBA dividindo por 18: resto + 1 = setor, quociente mod 2 = cabeça, quociente / 2 = cilindro. Em caso de erro, AH=00h e tente de novo, até três vezes.
- O MINIFS tem o boot no setor 0, um diretório de 16 entradas de 32 bytes no setor 1 (nome 8.3 sem ponto, atributo, primeiro setor, número de setores, tamanho) e os arquivos em setores seguidos a partir do 2.
- O boot do MINIOS lê o diretório para 0000:0500, acha `'KERNEL  SYS'` com `REPE CMPSB`, lê o kernel para 0800:0000 e salta com `PUSH`/`PUSH`/`RETF`.
:::
