---
id: aula49
numero: 49
modulo: 16
titulo: .COM e .EXE: o cabeçalho MZ
subtitulo: Como o DOS carrega um programa com vários segmentos
duracao: 60 min
objetivos: entender por que um .COM não serve para programas grandes; ler os campos do cabeçalho MZ; saber o que é relocação e por que ela existe; reproduzir em Assembly os passos do carregador do DOS
---

## O .COM: uma fotografia da memória

Quase todos os programas que você escreveu até agora, das primeiras aulas aos jogos do módulo 13, eram **.COM**. Um arquivo .COM é a coisa mais simples possível: os bytes do arquivo são copiados para a memória, a partir do deslocamento 100h de um segmento, e a CPU salta para lá. Não há cabeçalho nem tabela, e o DOS não precisa ler nada além dos bytes.

Isso funciona porque um .COM só usa **deslocamentos**. Um `MOV SI,OFFSET mensagem` guarda no código o número 0123h, e esse número está certo em qualquer segmento em que o DOS carregar o programa, porque CS, DS, ES e SS apontam todos para o mesmo lugar: o PSP do programa ([aula 26](aula:aula26)).

O preço é o tamanho. Código, dados e pilha dividem **um segmento só**, então o programa inteiro precisa caber em 64 KB, menos os 256 bytes do PSP e o espaço da pilha. Um editor de texto, um compilador ou um jogo com muitos gráficos não cabem.

```diagrama titulo="Um .COM na memória"
  PSP:0000   PSP (256 bytes): linha de comando, DTA, INT 20h
  PSP:0100   código e dados do arquivo, exatamente como estão no disco
     ...
  PSP:FFFE   pilha (SP começa aqui e cresce para baixo)

  CS = DS = ES = SS = PSP      tudo num segmento de 64 KB
```

## O problema de usar vários segmentos

Com `.MODEL SMALL` você separa o código dos dados: `.CODE` vai para um segmento e `.DATA` para outro. Desde a [aula 12](aula:aula12) todo programa assim começa com as mesmas duas linhas:

```asm fragmento
        MOV  AX, @DATA      ; AX = o segmento dos dados
        MOV  DS, AX
```

Repare no que `@DATA` é: o **número de um segmento**, um parágrafo da memória. Quando o MASM monta o programa, ele não sabe esse número. Ele depende de onde o DOS vai carregar o programa, e isso depende de quanta memória os TSRs e os drivers já ocuparam naquele computador, naquele dia.

Então o montador faz a única coisa possível: escreve o segmento **relativo ao começo do programa** (o segmento de dados começa, digamos, 3 parágrafos depois do código, então ele escreve 0003h) e anota numa lista: "no deslocamento tal existe um número de segmento que precisa ser corrigido na hora de carregar". Essa lista é a **tabela de relocação**, e corrigir os números é **relocar** o programa.

:::cpu O que precisa de relocação
Precisa ser corrigido todo número que é um **segmento**: `MOV AX,@DATA`, `MOV AX,SEG variavel`, um `CALL FAR` ou `JMP FAR` para outro segmento, um ponteiro `DD rotina` (que guarda deslocamento e segmento). Deslocamentos nunca precisam: `MOV SI,OFFSET x` vale em qualquer lugar, porque é contado a partir do início do próprio segmento.
:::

Um .COM não tem lugar para guardar essa lista. Por isso o DOS 2.0 adotou um segundo formato de executável, com um cabeçalho na frente: o **.EXE**.

## O cabeçalho MZ

Todo .EXE do DOS começa com os dois bytes `4Dh 5Ah`, as letras **MZ**. Depois vêm os campos, todos words:

| Deslocamento | Campo | O que guarda |
|---|---|---|
| 00h | assinatura | `MZ` (4Dh, 5Ah) |
| 02h | bytes na última página | quantos bytes da última página de 512 são usados (0 = a página inteira) |
| 04h | páginas | tamanho do arquivo em páginas de 512 bytes, contando a última, mesmo incompleta |
| 06h | relocações | quantas entradas tem a tabela de relocação |
| 08h | tamanho do cabeçalho | em parágrafos (16 bytes) |
| 0Ah | mínimo extra | parágrafos que o programa precisa **além** da imagem (dados não inicializados, pilha) |
| 0Ch | máximo extra | quanto ele aceita receber a mais (0FFFFh = toda a memória livre) |
| 0Eh | SS inicial | relativo ao início da imagem |
| 10h | SP inicial | |
| 12h | soma de verificação | quase ninguém usava |
| 14h | IP inicial | |
| 16h | CS inicial | relativo ao início da imagem |
| 18h | posição da tabela de relocação | deslocamento dentro do arquivo |
| 1Ah | número do overlay | 0 para o programa principal |

Cada entrada da tabela de relocação tem duas words, **deslocamento e segmento**, que apontam para o lugar a corrigir, contado a partir do início da imagem. A **imagem** (o "load module") é o arquivo inteiro menos o cabeçalho.

```diagrama titulo="Um .EXE no disco"
  arquivo
  ┌──────────────────────────────┐ 0
  │ cabeçalho MZ (28 bytes)      │
  │ tabela de relocação          │  em 18h: onde ela começa
  │ (zeros até completar)        │
  ├──────────────────────────────┤ tamanho do cabeçalho × 16
  │ imagem: código, dados, pilha │  é isto que vai para a memória
  │ ...                          │
  └──────────────────────────────┘ (páginas - 1) × 512 + bytes na última
```

:::anos90 MZ
As letras são as iniciais de **Mark Zbikowski**, o programador da Microsoft que desenhou o formato para o MS-DOS 2.0, em 1983. Elas continuam no começo de todo .EXE do Windows de hoje: um executável PE de 64 bits ainda começa com um pequeno programa de DOS que escreve "This program cannot be run in DOS mode". O DOS também aceitava os bytes invertidos, **ZM**, como assinatura.
:::

### O tamanho da imagem

Os campos de tamanho são o primeiro lugar em que todo mundo erra. As páginas contam o arquivo inteiro, inclusive o cabeçalho, e a última página pode estar incompleta:

- se "bytes na última página" for 0, o arquivo tem `páginas × 512` bytes;
- se não for, tem `(páginas − 1) × 512 + bytes na última página`.

A imagem é esse tamanho menos `tamanho do cabeçalho × 16`. Um arquivo com 3 páginas, 50h bytes na última e 2 parágrafos de cabeçalho tem `2 × 512 + 80 = 1104` bytes, e a imagem tem `1104 − 32 = 1072`.

```quiz
? O que precisa ser corrigido (relocado) quando o DOS carrega um .EXE?
- Todo endereço de memória que o programa usa
+ Os números de segmento, como o de MOV AX,@DATA
- Só os saltos JMP e CALL
> Deslocamentos são relativos ao começo do segmento e valem em qualquer lugar. Os números de segmento dependem de onde o programa foi carregado.

? Um .EXE tem 4 páginas e 0 bytes na última página. Quantos bytes tem o arquivo?
- 1536
+ 2048
- 2047
> Zero bytes na última página quer dizer que ela está cheia: 4 × 512 = 2048.
:::
```

## Como o DOS carrega um .EXE

Quando o COMMAND.COM chama a INT 21h com AX = 4B00h ([aula 26](aula:aula26)), o DOS lê os primeiros bytes do arquivo. Se não começam com MZ, é um .COM. Se começam, ele segue estes passos:

1. Calcula o tamanho da imagem com os campos 02h, 04h e 08h.
2. Reserva memória para o PSP, a imagem e pelo menos o "mínimo extra" (e até o "máximo extra", se houver).
3. Monta o PSP e copia a imagem logo depois dele: o **segmento de carga** é `PSP + 10h`, já que o PSP tem 100h bytes, ou seja, 10h parágrafos.
4. Para cada entrada da tabela de relocação, soma o segmento de carga à word que está em `(carga + segmento da entrada):deslocamento`.
5. Faz `SS = carga + SS inicial`, `SP = SP inicial`, `DS = ES = PSP`.
6. Salta para `carga + CS inicial : IP inicial`.

```diagrama titulo="Relocação"
  no disco (imagem)               na memória, carregado em 0712h
  0000:0001  B8 03 00   MOV AX,0003      B8 15 07   MOV AX,0715h
             ▲                                ▲
             └ entrada da tabela: 0000:0002   └ 0003h + 0712h
```

Por isso `DS` aponta para o PSP quando o programa começa, e é por isso que o `MOV AX,@DATA` / `MOV DS,AX` é obrigatório: só o próprio programa sabe onde ficam os seus dados.

:::atencao E no simulador do curso?
O simulador carrega **sempre** no mesmo lugar: PSP em 0700h e imagem em 0710h. Como o endereço é sempre esse, o montador do curso já escreve os segmentos finais no código e não precisa de tabela. O resultado na memória é exatamente o que o DOS produziria depois de relocar. Os exercícios desta aula fazem o trabalho que o DOS faz com um .EXE de verdade.
:::

## Voltando para .COM: EXE2BIN

O ligador do DOS (LINK, ou TLINK da Borland) sempre produzia um .EXE. Para obter um .COM, você passava o resultado pelo **EXE2BIN**, que jogava o cabeçalho fora. Isso só funcionava se o programa tivesse `ORG 100h`, um segmento só e **nenhuma** relocação. Um `MOV AX,@DATA` num .COM é um erro, e o EXE2BIN avisava. O TLINK tinha a opção `/t`, que fazia as duas coisas de uma vez.

```texto titulo="As duas receitas"
  .COM com TASM:   TASM PROG.ASM        TLINK /t PROG.OBJ
  .EXE com TASM:   TASM PROG.ASM        TLINK PROG.OBJ
  .COM com MASM:   MASM PROG.ASM;       LINK PROG.OBJ;       EXE2BIN PROG.EXE PROG.COM
```

A [aula 53](avancado:aula53) mostra como rodar essas ferramentas de verdade.

## Erros que você vai cometer

- **Contar o cabeçalho na imagem.** As "páginas" incluem o cabeçalho. Esquecer de subtrair `tamanho do cabeçalho × 16` copia lixo para a memória.
- **Achar que "bytes na última página = 0" quer dizer arquivo vazio.** Quer dizer página cheia.
- **Esquecer o `MOV DS,AX`.** Num .EXE, DS começa apontando para o PSP. O simulador avisa ("DS ainda aponta para o PSP"), o DOS não.
- **Somar o PSP em vez do segmento de carga.** A imagem começa 10h parágrafos depois do PSP.

## Exercícios

```exercicio
id: a49-1
titulo: O tamanho da imagem
nivel: 1
--- enunciado
**cab** tem os primeiros campos de um cabeçalho MZ (words): `cab[2]` são os bytes na última página, `cab[4]` o número de páginas e `cab[8]` o tamanho do cabeçalho em parágrafos.

Calcule em **AX** o tamanho da imagem em bytes (o arquivo menos o cabeçalho). Os arquivos dos testes têm menos de 64 KB.
--- inicial
        JMP  inicio
cab     DW 14 DUP (0)
inicio: ; AX = tamanho da imagem em bytes
--- testes
[{ "nome": "3 páginas, 50h bytes na última, cabeçalho de 2 parágrafos", "setup": { "cab": [23117, 80, 3, 0, 2] }, "espera": { "AX": 1072 } },
 { "nome": "4 páginas cheias, cabeçalho de 32 parágrafos", "setup": { "cab": [23117, 0, 4, 0, 32] }, "espera": { "AX": 1536 } },
 { "nome": "1 página com 511 bytes", "setup": { "cab": [23117, 511, 1, 0, 2] }, "espera": { "AX": 479 } }]
--- dicas
Comece com as páginas × 512: MOV AX,cab[4] / MOV CL,9 / SHL AX,CL.
Se cab[2] não for zero, a última página não está cheia: tire 512 e some cab[2].
No fim, subtraia o cabeçalho: cab[8] × 16 (SHL de 4 bits).
--- solucao
        JMP  inicio
cab     DW 14 DUP (0)
inicio: MOV  AX, cab[4]
        MOV  CL, 9
        SHL  AX, CL         ; páginas * 512
        MOV  BX, cab[2]
        OR   BX, BX
        JZ   cheia
        SUB  AX, 512        ; a última página não está cheia
        ADD  AX, BX
cheia:  MOV  BX, cab[8]
        MOV  CL, 4
        SHL  BX, CL         ; cabeçalho em bytes
        SUB  AX, BX
```

```exercicio
id: a49-2
titulo: É um .EXE?
nivel: 1
--- enunciado
**cab** é o começo de um arquivo. Faça **CF = 0** se ele for um .EXE (a primeira word é `MZ` ou `ZM`) e **CF = 1** se não for.

Lembre que a word lida da memória tem o primeiro byte na parte baixa: os bytes `4Dh 5Ah` ("MZ") formam a word 5A4Dh.
--- inicial
        JMP  inicio
cab     DW 14 DUP (0)
inicio: ; CF = 0 se for MZ ou ZM
        CLC
--- testes
[{ "nome": "MZ", "setup": { "cab": [23117] }, "espera": { "CF": 0 } },
 { "nome": "ZM também vale", "setup": { "cab": [19802] }, "espera": { "CF": 0 } },
 { "nome": "PK (um .ZIP)", "setup": { "cab": [19280] }, "espera": { "CF": 1 } },
 { "nome": "um .COM que começa com JMP", "setup": { "cab": [4331] }, "espera": { "CF": 1 } }]
--- dicas
Compare cab[0] com 5A4Dh e com 4D5Ah.
CMP não mexe no valor; o CF que ela deixa não serve como resposta. Termine com CLC ou STC.
--- solucao
        JMP  inicio
cab     DW 14 DUP (0)
inicio: MOV  AX, cab[0]
        CMP  AX, 5A4Dh      ; "MZ"
        JE   eh_exe
        CMP  AX, 4D5Ah      ; "ZM"
        JE   eh_exe
        STC
        JMP  SHORT fim
eh_exe: CLC
fim:
```

```exercicio
id: a49-3
titulo: Relocar uma imagem
nivel: 2
--- enunciado
Você é o carregador do DOS. **imagem** acabou de ser copiada do disco, e **rel** é a tabela de relocação: pares de words (deslocamento, segmento). Nesta imagem pequena o segmento de todas as entradas é 0, então o deslocamento é contado a partir do começo de **imagem**.

**BX** tem o segmento de carga e **CX** o número de entradas. Some BX à word de **imagem** indicada por cada entrada.
--- inicial
        JMP  inicio
imagem  DW 8 DUP (0)
rel     DW 8 DUP (0)
inicio: ; BX = segmento de carga, CX = número de relocações
--- testes
[{ "nome": "duas relocações (2 e 8), carga em 1000h", "setup": { "imagem": [0, 1, 2, 3, 4, 5, 6, 7], "rel": [2, 0, 8, 0], "BX": 4096, "CX": 2 }, "espera": { "mem": { "imagem": [0, 4097, 2, 3, 4100, 5, 6, 7] } } },
 { "nome": "nenhuma relocação", "setup": { "imagem": [9, 9, 9, 9, 9, 9, 9, 9], "rel": [0, 0], "BX": 4096, "CX": 0 }, "espera": { "mem": { "imagem": [9, 9, 9, 9, 9, 9, 9, 9] } } },
 { "nome": "três relocações, carga em 0712h", "setup": { "imagem": [3, 0, 0, 5, 0, 0, 0, 1], "rel": [0, 0, 14, 0, 6, 0], "BX": 1810, "CX": 3 }, "espera": { "mem": { "imagem": [1813, 0, 0, 1815, 0, 0, 0, 1811] } } }]
--- dicas
Percorra a tabela com SI = OFFSET rel, pulando 4 bytes por entrada.
O deslocamento da entrada vai para um registrador de índice: MOV DI,[SI]. Depois ADD imagem[DI],BX.
Cuidado com CX = 0: teste com JCXZ antes de entrar no LOOP.
--- solucao
        JMP  inicio
imagem  DW 8 DUP (0)
rel     DW 8 DUP (0)
inicio: MOV  SI, OFFSET rel
        JCXZ fim
proxima:
        MOV  DI, [SI]           ; deslocamento a corrigir
        ADD  imagem[DI], BX     ; soma o segmento de carga
        ADD  SI, 4              ; próxima entrada (deslocamento, segmento)
        LOOP proxima
fim:
```

```exercicio
id: a49-4
titulo: Onde o programa começa
nivel: 2
--- enunciado
**AX** tem o segmento do PSP que o DOS acabou de montar e **cab** tem o cabeçalho MZ inteiro. Calcule os registradores com que o programa vai começar:

- **CX** = CS inicial e **DX** = IP inicial;
- **SI** = SS inicial e **DI** = SP inicial.

O segmento de carga é o PSP + 10h. Os campos estão em `cab[0Eh]` (SS), `cab[10h]` (SP), `cab[14h]` (IP) e `cab[16h]` (CS).
--- inicial
        JMP  inicio
cab     DW 14 DUP (0)
inicio: ; AX = PSP
        ; CX:DX = CS:IP, SI:DI = SS:SP
--- testes
[{ "nome": "PSP 0700h, CS 0, IP 0, SS 3, SP 100h", "setup": { "AX": 1792, "cab": [23117, 0, 2, 0, 2, 0, 65535, 3, 256, 0, 0, 0] }, "espera": { "CX": 1808, "DX": 0, "SI": 1811, "DI": 256 } },
 { "nome": "PSP 1234h, CS 2, IP 15h, SS 40h, SP 400h", "setup": { "AX": 4660, "cab": [23117, 0, 2, 0, 2, 0, 65535, 64, 1024, 0, 21, 2] }, "espera": { "CX": 4678, "DX": 21, "SI": 4740, "DI": 1024 } }]
--- dicas
Primeiro o segmento de carga: ADD AX,10h.
CS = carga + cab[16h] e SS = carga + cab[0Eh]. IP e SP são copiados como estão.
--- solucao
        JMP  inicio
cab     DW 14 DUP (0)
inicio: ADD  AX, 10h        ; segmento de carga = PSP + 10h
        MOV  CX, cab[16h]
        ADD  CX, AX         ; CS
        MOV  DX, cab[14h]   ; IP
        MOV  SI, cab[0Eh]
        ADD  SI, AX         ; SS
        MOV  DI, cab[10h]   ; SP
```

```quiz
? O PSP de um .EXE está no segmento 2000h. Em que segmento começa a imagem?
- 2000h
+ 2010h
- 2100h
> O PSP tem 256 bytes, que são 10h parágrafos. A imagem vem logo depois: 2000h + 10h.

? Por que EXE2BIN recusava um programa com MOV AX,@DATA?
- Porque o .COM não aceita a instrução MOV AX
+ Porque @DATA precisa de relocação, e o .COM não tem tabela de relocação
- Porque o .COM não pode ter dados
> Um .COM é copiado para a memória sem nenhuma correção. Um número de segmento escrito no código estaria errado.
```

:::resumo
- Um .COM é uma cópia direta da memória: um segmento, ORG 100h, até 64 KB, nenhuma correção ao carregar.
- Um .EXE começa com o cabeçalho MZ, que diz o tamanho, a memória extra, os registradores iniciais e onde está a tabela de relocação.
- Relocar é somar o segmento de carga (PSP + 10h) a cada número de segmento listado na tabela.
- Imagem = arquivo − cabeçalho. Páginas de 512 bytes; "bytes na última página = 0" é página cheia.
- DS começa apontando para o PSP: por isso todo .EXE começa com MOV AX,@DATA / MOV DS,AX.
:::
