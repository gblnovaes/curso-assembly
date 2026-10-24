---
id: aula43
numero: 43
modulo: 14
titulo: O shell do MINIOS
subtitulo: Ler uma linha, separar o comando, procurar numa tabela, comandos internos e programas externos, e o que o COMMAND.COM faz de diferente
duracao: 120 min
objetivos: entender por que o interpretador de comandos é um programa comum e não parte do kernel; ler uma linha com a função 0Ah e transformar o buffer num texto terminado em zero; separar a primeira palavra dos argumentos e convertê-la para maiúsculas; procurar o comando numa tabela de nomes e endereços e chamá-lo com um CALL indireto; escrever os comandos internos AJUDA, DIR, TIPO, LIMPA, VER, MEM, HORA, ECO, REINICIA e DESLIGA usando o kernel e a BIOS; rodar programas externos pela função 4Bh com a cauda de comando no formato do PSP; comparar o shell do MINIOS com o COMMAND.COM do MS-DOS (internos e externos, PROMPT, parte residente e parte transiente)
---

## O programa que conversa com você

Até aqui o MINIOS sabe dar boot ([aula 40](aula:aula40)), tem um kernel que instala a sua própria INT 21h ([aula 41](aula:aula41)) e sabe ler arquivos do disquete e rodar programas ([aula 42](aula:aula42)). Mas, quando o kernel termina de arrumar a casa, alguém precisa mostrar um `A>` e esperar o usuário digitar alguma coisa. Esse alguém é o **shell**, o interpretador de comandos.

A primeira coisa que surpreende quem estuda o DOS por dentro é que o shell **não faz parte do kernel**. O `COMMAND.COM` do MS-DOS é um programa como outro qualquer: o `IO.SYS` e o `MSDOS.SYS` carregam, configuram tudo e, no fim, rodam o arquivo que o `CONFIG.SYS` mandar (o padrão é `SHELL=C:\COMMAND.COM`). Se você trocar essa linha por outro programa, o DOS roda o outro programa no lugar ([o DOS por dentro, no livro](livro:cap22)).

O MINIOS faz igual. O kernel, no fim da inicialização, procura o arquivo `SHELL.COM` no diretório, carrega em `2000:0100h` e salta para lá. Daí em diante o shell é só um `.COM` que usa a INT 21h do kernel (e um pouco de BIOS), exatamente como os jogos das aulas 33 a 39. Isso tem três vantagens que valiam ouro em 1981 e continuam valendo:

1. **O kernel fica pequeno.** O que ele precisa saber é ler setores, achar arquivos e rodar programas. Texto de ajuda, formatação do `DIR` e mensagens de erro ficam fora dele.
2. **O shell pode ser trocado.** Quem não gostava do `COMMAND.COM` instalava o 4DOS; quem queria menus usava o DOSSHELL; e no MINIOS você pode escrever o seu `SHELL.COM` e pôr no disquete no lugar deste.
3. **Um erro no shell não derruba o sistema.** Se o shell terminar (com `INT 20h` ou `AH = 4Ch`), o kernel simplesmente o carrega de novo. O DOS fazia o mesmo com a parte transiente do `COMMAND.COM`, como você vai ver no fim da aula.

:::anos90 A>, C> e C:\>
O prompt do DOS era só a letra do drive e um sinal de maior: `A>` num PC com dois disquetes, `C>` quando o disco rígido virou comum. O famoso `C:\>`, com o diretório atual, só aparecia se o `AUTOEXEC.BAT` tivesse a linha `PROMPT $P$G`, o que quase todo mundo acabava colocando depois de se perder nos subdiretórios. O MINIOS não tem diretórios, então o `A>` de 1981 basta.
:::

## O laço do shell

Todo interpretador de comandos, do `COMMAND.COM` ao `bash`, tem o mesmo esqueleto: mostrar o prompt, ler uma linha, descobrir o que ela pede, fazer, voltar ao começo. Em inglês isso se chama *read-eval-print loop*; no MINIOS ele cabe em trinta linhas.

```diagrama titulo="O laço principal do SHELL.COM"
          ┌──────────────────────────────────────┐
          │  mostra "A> "            (AH = 09h)  │◄──────────────┐
          └──────────────────┬───────────────────┘               │
                             ▼                                   │
          ┌──────────────────────────────────────┐               │
          │  lê a linha              (AH = 0Ah)  │               │
          └──────────────────┬───────────────────┘               │
                             ▼                                   │
          ┌──────────────────────────────────────┐   vazia       │
          │  SEPARA: comando em maiúsculas,      ├───────────────┤
          │  SI = começo dos argumentos          │               │
          └──────────────────┬───────────────────┘               │
                             ▼                                   │
          ┌──────────────────────────────────────┐               │
          │  procura o nome na tabela            │               │
          └───────┬──────────────────────┬───────┘               │
            achou │                      │ não achou             │
                  ▼                      ▼                       │
     ┌─────────────────────┐   ┌──────────────────────────┐      │
     │ CALL rotina interna │   │ EXTERNO: NOME.COM pela   │      │
     │ (CMD_DIR, CMD_ECO…) │   │ INT 21h, AH = 4Bh        │      │
     └──────────┬──────────┘   └────────────┬─────────────┘      │
                └─────────────┬─────────────┘                    │
                              └──────────────────────────────────┘
```

No código, o laço é exatamente esse desenho:

```asm fragmento titulo="SHELL.ASM: o laço principal"
inicio:
        MOV  DX, OFFSET msg_ola
        CALL TEXTO
@@prompt:
        MOV  DX, OFFSET msg_prompt
        CALL TEXTO
        MOV  DX, OFFSET linha   ; lê a linha (INT 21h, AH=0Ah)
        MOV  AH, 0Ah
        INT  21h
        CALL NOVA_LINHA
        CALL SEPARA             ; comando em "comando", SI = argumentos
        CMP  comando, 0
        JE   @@prompt           ; linha vazia
        MOV  argumentos, SI
        MOV  SI, OFFSET tabela  ; procura o comando na tabela
@@procura:
        CMP  BYTE PTR [SI], 0
        JE   @@externo
        MOV  DI, OFFSET comando
        CALL IGUAIS             ; ZF = 1 se iguais; SI vai para depois do 0
        JE   @@interno
        ADD  SI, 2              ; pula o endereço da rotina
        JMP  @@procura
@@interno:
        MOV  BX, [SI]           ; BX = rotina do comando
        MOV  SI, argumentos
        CALL BX                 ; CALL indireto: o endereço veio da tabela
        JMP  @@prompt
@@externo:
        CALL EXTERNO
        JMP  @@prompt
```

Repare que o shell **nunca termina**. Não há `INT 20h` nem `AH = 4Ch` no laço: os únicos jeitos de sair são `REINICIA` (que chama a BIOS para dar boot de novo) e `DESLIGA` (que para a CPU). Um shell que terminasse voltaria para o kernel, que o carregaria outra vez; funcionaria, mas sem motivo.

:::cpu Rótulos @@ dentro de "inicio"
`@@prompt`, `@@procura` e os outros rótulos com `@@` são locais: valem só até o próximo `PROC` ou rótulo comum. O laço principal não está dentro de um `PROC`, então os rótulos `@@` dele pertencem ao bloco que começa em `inicio:` e termina no `SEPARA PROC`. É por isso que cada rotina abaixo pode ter o seu próprio `@@fim` sem conflito.
:::

## Ler uma linha: a função 0Ah

A [aula 19](aula:aula19) apresentou a função **0Ah** da INT 21h, a leitura com buffer. Ela é perfeita para um shell porque já resolve tudo o que dá trabalho numa linha de comando: ecoar cada tecla na tela, apagar com Backspace, não deixar o usuário digitar além do limite e terminar com Enter. No MINIOS quem implementa a 0Ah é o kernel (a rotina `F_0A` da [aula 42](aula:aula42)), com a INT 16h da BIOS por baixo; no DOS, é o próprio MSDOS.SYS.

O buffer tem um formato fixo: o primeiro byte diz quantos caracteres cabem (contando o Enter), o segundo é preenchido com quantos foram digitados (sem o Enter), e o texto vem depois, terminado por um 13 (CR).

```diagrama titulo="O buffer da função 0Ah depois de digitar  tipo leiame.txt⏎"
 linha:  +0    +1    +2  +3  +4  +5  +6  +7  +8 ...  +16  +17
       ┌─────┬─────┬───┬───┬───┬───┬───┬───┬───┬────┬────┬────┬───
       │ 79  │ 15  │ t │ i │ p │ o │   │ l │ e │ …  │ t  │ 13 │ ...
       └─────┴─────┴───┴───┴───┴───┴───┴───┴───┴────┴────┴────┴───
         │     │     └─ o texto começa em linha+2
         │     └─ quantos caracteres vieram (o kernel escreve)
         └─ máximo, contando o 13 do fim (o programa escreve)
```

No `SHELL.ASM` o buffer é declarado assim:

```asm fragmento titulo="SHELL.ASM: o buffer da linha"
MAX_LINHA   EQU 78
linha       DB MAX_LINHA+1, 0, MAX_LINHA+2 DUP (0)
```

São 79 bytes de máximo (78 letras e o Enter), o byte do contador e espaço para o texto com uma folga. Por que 78 e não 80? Porque o prompt `A> ` já ocupa três colunas, e uma linha que passa do fim da tela faz o cursor descer, o que confunde o Backspace de muitas implementações da 0Ah. Os shells da época limitavam a linha a 127 caracteres, o tamanho que cabe na cauda de comando do PSP; o MINIOS fica com uma linha de tela.

:::atencao O 13 no fim não é um zero
A 0Ah termina o texto com **13**, não com zero e nem com `$`. As rotinas do shell trabalham com textos terminados em **0** (o estilo do C, que também é o do MINIFS e da função 4Bh). Por isso a primeira coisa que o `SEPARA` faz é trocar o 13 por 0, usando o contador do segundo byte para achá-lo.
:::

## Separar o comando dos argumentos

Uma linha como `   tipo   leiame.txt` tem duas partes: a primeira palavra é o **comando**; o resto, sem os espaços da frente, são os **argumentos**. O shell precisa da primeira em maiúsculas (para comparar com a tabela, onde os nomes estão em maiúsculas) e da segunda como está (o `ECO` deve repetir exatamente o que você digitou).

```diagrama titulo="O que o SEPARA faz com a linha"
 linha+2:   ␣ ␣ ␣ t i p o ␣ ␣ ␣ l e i a m e . t x t 13
                  ▲                                  └─ vira 0
            PULA_ESPACOS
                  │ copia até o espaço, em maiúsculas
                  ▼
 comando:   T I P O 0                    (no máximo 12 letras)

                          ▲
 SI (argumentos) ─────────┘ depois de PULA_ESPACOS:
                            "leiame.txt",0
```

```asm fragmento titulo="SHELL.ASM: SEPARA, PULA_ESPACOS e MAIUSCULA"
SEPARA  PROC
        MOV  BL, linha+1        ; quantos caracteres vieram
        XOR  BH, BH
        MOV  SI, OFFSET linha+2
        MOV  BYTE PTR [SI+BX], 0   ; troca o 13 do fim por 0
        CALL PULA_ESPACOS
        MOV  DI, OFFSET comando
        MOV  CX, 12
@@letra:
        LODSB
        CMP  AL, ' '
        JE   @@fim
        OR   AL, AL
        JZ   @@acabou
        CALL MAIUSCULA
        JCXZ @@letra            ; comprido demais: ignora o resto
        MOV  [DI], AL
        INC  DI
        DEC  CX
        JMP  @@letra
@@acabou:
        DEC  SI                 ; deixa SI no 0
@@fim:  MOV  BYTE PTR [DI], 0
        CALL PULA_ESPACOS
        RET
SEPARA  ENDP

PULA_ESPACOS PROC
@@olha: CMP  BYTE PTR [SI], ' '
        JNE  @@fim
        INC  SI
        JMP  @@olha
@@fim:  RET
PULA_ESPACOS ENDP

MAIUSCULA PROC
        CMP  AL, 'a'
        JB   @@fim
        CMP  AL, 'z'
        JA   @@fim
        SUB  AL, 'a'-'A'
@@fim:  RET
MAIUSCULA ENDP
```

Alguns detalhes que fazem diferença:

- **`MOV BYTE PTR [SI+BX], 0`** usa o contador como índice. Se a linha veio vazia (só Enter), BX = 0 e o zero vai direto para `linha+2`: o `comando` fica vazio e o laço principal volta ao prompt sem procurar nada.
- **O limite de 12 letras** (8 do nome, o ponto e 3 da extensão) protege o buffer `comando`, que tem 13 bytes. O truque está no `JCXZ @@letra`: quando CX chega a zero, as letras continuam sendo lidas (para SI andar até o fim da palavra), mas não são mais gravadas. Um `JCXZ` que pula *para trás* é raro, e aqui economiza um rótulo e um salto.
- **Quando a linha acaba no meio da palavra**, o `LODSB` já passou do zero. O `DEC SI` em `@@acabou` devolve SI para cima do zero, para que os argumentos sejam um texto vazio e não o lixo depois dele.
- **Só o comando vira maiúsculas.** Os argumentos ficam como foram digitados. O kernel converte o nome do arquivo por conta própria (a `NOME_83` da aula 42 passa tudo para maiúsculas), então `TIPO leiame.txt` funciona, e `ECO Olá` mostra "Olá" e não "OLÁ".

:::cpu 'a' − 'A' = 20h
Na tabela ASCII, cada minúscula fica exatamente 32 (20h) posições depois da maiúscula: 'A' = 41h, 'a' = 61h. A diferença é só o **bit 5**. Por isso também se via `AND AL, 0DFh` (zera o bit 5) para passar para maiúscula, ou `OR AL, 20h` para minúscula. Mas o `AND` sozinho estraga números e sinais: `'1'` (31h) viraria 11h. O `MAIUSCULA` testa o intervalo antes e só mexe em letras; o `SUB AL, 'a'-'A'` é a mesma conta, mais legível (o montador calcula 20h).
:::

## A tabela de comandos

Agora vem a parte mais elegante do shell. Em vez de uma cascata de comparações (`se é DIR, faça isto; senão, se é TIPO, faça aquilo...`), o shell guarda **pares nome-endereço** numa tabela e usa um único laço para todos os comandos:

```asm fragmento titulo="SHELL.ASM: a tabela de comandos"
tabela      DB 'AJUDA', 0
            DW CMD_AJUDA
            DB '?', 0
            DW CMD_AJUDA
            DB 'DIR', 0
            DW CMD_DIR
            DB 'TIPO', 0
            DW CMD_TIPO
            ...
            DB 'DESLIGA', 0
            DW CMD_DESLIGA
            DB 0                ; fim da tabela
```

```diagrama titulo="A tabela na memória: entradas de tamanho variável"
 ┌───┬───┬───┬───┬───┬───┬───────┬───┬───┬───────┬───┬───┬───┬───┬───────┬─────┬───┐
 │ A │ J │ U │ D │ A │ 0 │ CMD_  │ ? │ 0 │ CMD_  │ D │ I │ R │ 0 │ CMD_  │ ... │ 0 │
 │   │   │   │   │   │   │ AJUDA │   │   │ AJUDA │   │   │   │   │ DIR   │     │   │
 └───┴───┴───┴───┴───┴───┴───────┴───┴───┴───────┴───┴───┴───┴───┴───────┴─────┴───┘
  └──── nome ─────────┘  2 bytes   nome   2 bytes   └─── nome ──┘ 2 bytes        fim:
                         (DW)              (DW)                   (DW)    um nome vazio
```

Cada entrada é um nome terminado em zero seguido de uma palavra com o **endereço da rotina**. O fim da tabela é um nome vazio (um zero sozinho). Note que `AJUDA` e `?` apontam para a **mesma** rotina: um apelido custa só a entrada na tabela.

Por que nomes de tamanho variável e não, digamos, 8 bytes fixos por nome? Com tamanho fixo o laço seria mais simples (`ADD SI, 10` sempre), mas a tabela ocuparia 11 × 10 = 110 bytes contra 73. Os dois jeitos aparecem em programas da época; o importante é que o laço e a tabela concordem sobre o formato.

### Comparando dois textos

A rotina `IGUAIS` compara o nome da tabela (em SI) com o comando digitado (em DI) e tem uma obrigação extra: **deixar SI logo depois do zero do nome**, porque é ali que está o endereço da rotina, com acerto ou sem acerto.

```asm fragmento titulo="SHELL.ASM: IGUAIS"
IGUAIS  PROC
        PUSH DI
@@car:  LODSB
        CMP  AL, [DI]
        JNE  @@diferente
        INC  DI
        OR   AL, AL
        JNZ  @@car
        POP  DI                 ; chegou nos dois zeros: iguais (ZF = 1)
        RET
@@diferente:
        OR   AL, AL             ; anda com SI até o fim do texto dele
        JZ   @@sai
        LODSB
        JMP  @@diferente
@@sai:  OR   SP, SP             ; ZF = 0 (SP nunca é zero aqui)
        POP  DI
        RET
IGUAIS  ENDP
```

Os dois caminhos de saída precisam devolver a resposta no **ZF**, para o laço principal poder usar `JE @@interno` logo depois do `CALL`:

- **Iguais:** a comparação chegou a um zero que também estava no outro texto. O último `OR AL, AL` deu ZF = 1, e nem o `POP` nem o `RET` mexem nas flags.
- **Diferentes:** depois de andar com SI até o zero, o ZF está em 1 (foi o `OR AL, AL` que achou o zero!). É preciso forçar ZF = 0. O truque `OR SP, SP` faz isso: SP nunca é zero dentro de uma rotina (há pelo menos o endereço de retorno e o DI na pilha), então o resultado é diferente de zero e o ZF desliga. Custa 2 bytes e não estraga nenhum registrador.

:::dica Por que não REPE CMPSB?
O setor de boot da [aula 40](aula:aula40) compara nomes com `REPE CMPSB`, que é mais rápido. Mas lá os nomes têm sempre 11 bytes (o formato 8.3 do diretório). Aqui os nomes têm tamanhos diferentes e terminam em zero, e o `CMPSB` não sabe parar no zero. Daria para medir o tamanho antes e depois usar `REPE CMPSB`, mas a tabela tem onze entradas curtas: a versão com `LODSB` é mais simples e o tempo é desprezível perto do tempo de digitar.
:::

### O CALL indireto

Quando o nome bate, SI aponta para a palavra com o endereço da rotina. O laço principal faz:

```asm fragmento titulo="Chamando a rotina pelo endereço da tabela"
        MOV  BX, [SI]           ; BX = rotina do comando
        MOV  SI, argumentos
        CALL BX                 ; CALL indireto: o endereço veio da tabela
```

`CALL BX` empilha o endereço de retorno e salta para o deslocamento que está em BX. É a mesma instrução que um compilador C gera para um ponteiro de função, e a mesma ideia do `CALL acoes[BX]` da [aula 19](aula:aula19). O 8086 tem três formas de CALL indireto perto (*near*):

| Forma | Exemplo | O endereço vem de |
|-------|---------|-------------------|
| registrador | `CALL BX` | BX |
| memória | `CALL WORD PTR [SI]` | a palavra em DS:SI |
| memória com índice | `CALL tabela[BX]` | a palavra em DS:tabela+BX |

O shell podia ter usado `CALL WORD PTR [SI]` direto, mas precisa trocar SI pelos argumentos antes da chamada (todas as rotinas recebem SI = argumentos). Por isso o endereço passa por BX.

O resultado é que **acrescentar um comando é escrever a rotina e uma entrada na tabela**. O laço não muda. É assim que o `COMMAND.COM` real é organizado por dentro, e é assim que você vai fazer os desafios do fim da aula.

:::atencao Uma tabela de endereços é um convite a saltar para o lixo
Se a tabela não tiver o zero do fim, o laço continua comparando os bytes que vêm depois (as mensagens), acha um "nome" qualquer e salta para um "endereço" que é na verdade um pedaço de texto. Com tabelas indexadas por número (`CALL tabela[BX]`), o perigo é um índice grande demais. Sempre garanta o fim da tabela ou verifique o limite do índice.
:::

## Os comandos internos

Cada rotina interna recebe **SI = argumentos** (um texto terminado em zero, talvez vazio) e termina com `RET`. Vamos a elas.

### AJUDA e ?

Só escreve um texto com a função 09h. O texto de ajuda é o maior dado do shell, e é bom que ele não esteja no kernel.

### DIR: perguntando ao kernel

O shell não lê o diretório do disquete sozinho: ele pede ao kernel, entrada por entrada, com a função **80h**, que só existe no MINIOS (o DOS usa as funções 4Eh e 4Fh, com uma DTA, como na [aula 26](aula:aula26)). CX diz o número da entrada; o kernel copia os 32 bytes dela para ES:DI e devolve CF = 1 quando as entradas acabam.

```diagrama titulo="Uma entrada do diretório do MINIFS (32 bytes)"
  0                     8           11   12    14    16          20          31
 ┌──────────────────────┬───────────┬────┬─────┬─────┬───────────┬───────────┐
 │ nome (8, com espaços)│ ext (3)   │attr│setor│ qtd │ tamanho   │ (livre)   │
 │ K E R N E L ␣ ␣      │ S Y S     │ 04 │ 2   │ 5   │ 2348      │           │
 └──────────────────────┴───────────┴────┴─────┴─────┴───────────┴───────────┘
                                      │    │     │     └─ DD, em bytes
                                      │    │     └─ número de setores
                                      │    └─ primeiro setor (LBA)
                                      └─ 04h = sistema, 20h = arquivo comum
```

```asm fragmento titulo="SHELL.ASM: o coração do DIR"
        XOR  CX, CX             ; CX = número da entrada
        MOV  total, 0
@@entrada:
        PUSH CX
        MOV  DI, OFFSET entrada
        MOV  AH, 80h
        INT  21h
        POP  CX
        JC   @@fim              ; CF = 1: acabaram as entradas
        ...
        MOV  SI, OFFSET entrada ; nome (8 letras)
        MOV  BX, 8
        CALL ESCREVE_N
        MOV  DL, ' '
        CALL CARACTERE
        MOV  BX, 3              ; extensão
        CALL ESCREVE_N
        MOV  AX, WORD PTR entrada+16   ; tamanho
        ADD  total, AX
        MOV  BL, 8
        CALL ESCREVE_NUM
```

O nome sai exatamente como está no diretório: 8 letras com espaços, um espaço, 3 letras da extensão. É por isso que o `DIR` do DOS também mostrava `LEIAME   TXT` e não `LEIAME.TXT`: é o formato do disco aparecendo na tela, sem conversão. O tamanho é lido só como palavra (16 bits): nenhum arquivo do MINIOS passa de 64 KB, porque um `.COM` inteiro precisa caber num segmento.

O `ESCREVE_NUM` merece atenção. Ele escreve AX em decimal, mas **alinhado à direita** em BL colunas, para os números do `DIR` ficarem em coluna:

```asm fragmento titulo="SHELL.ASM: ESCREVE_NUM com espaços na frente"
        MOV  SI, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  SI
        PUSH DX                 ; os dígitos saem do último para o primeiro
        INC  CX
        OR   AX, AX
        JNZ  @@divide
        MOV  DL, ' '            ; espaços na frente até BL colunas
        MOV  AL, BL
        XOR  AH, AH
@@espaco:
        CMP  AX, CX             ; CX = quantos dígitos o número tem
        JBE  @@digitos
        CALL CARACTERE
        DEC  AX
        JMP  @@espaco
@@digitos:
        POP  DX
        ADD  DL, '0'
        CALL CARACTERE
        LOOP @@digitos
```

As divisões por 10 produzem os dígitos ao contrário, e a pilha os desvira (a mesma técnica da [aula 9](aula:aula09)). Como a contagem de dígitos (CX) já está pronta antes de escrever, dá para saber quantos espaços faltam para completar BL colunas. Com BL = 1 o número sai sem espaço nenhum.

### TIPO: mostrar um arquivo de texto

O nome do comando vem do `TYPE` do DOS. O shell pede ao kernel que carregue o arquivo **inteiro** num buffer, com a função **81h** do MINIOS (DS:DX = nome, ES:BX = destino, AX volta com o tamanho), e depois escreve byte a byte:

```asm fragmento titulo="SHELL.ASM: TIPO"
@@tem:  MOV  DX, SI             ; DS:DX = nome
        PUSH ES
        MOV  AX, SEG_BUFFER
        MOV  ES, AX
        XOR  BX, BX             ; ES:BX = 5000:0000
        MOV  AH, 81h
        INT  21h
        POP  ES
        JNC  @@mostra
        ...
@@mostra:
        MOV  CX, AX             ; CX = tamanho
        JCXZ @@fim
        PUSH DS
        MOV  AX, SEG_BUFFER
        MOV  DS, AX
        XOR  SI, SI
@@car:  LODSB
        CMP  AL, 1Ah            ; Ctrl+Z: fim de texto, à moda do DOS
        JE   @@acabou
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        LOOP @@car
@@acabou:
        POP  DS
```

Três escolhas a notar:

- **O buffer fica em 5000:0000**, um segmento livre do mapa do MINIOS (o shell está em 2000h, os programas em 3000h e 4000h). Um arquivo de até 64 KB cabe ali sem pisar em ninguém. O DOS de verdade abriria o arquivo e leria aos pedaços de 512 bytes; o MINIOS não tem arquivos abertos, só "carregar inteiro", e isso basta para mostrar texto.
- **O DS muda no meio da rotina.** Para o `LODSB` ler do buffer, DS passa a valer 5000h. Enquanto isso, nada de variáveis do shell (elas estão no DS antigo)! A função 02h só usa DL, então funciona. O `PUSH DS`/`POP DS` em volta é obrigatório.
- **Ctrl+Z (1Ah) é o fim do texto.** O CP/M gravava arquivos em blocos de 128 bytes e marcava o fim do texto com 1Ah; o DOS herdou o costume, e muitos editores ainda punham um 1Ah no fim dos arquivos em 1990. O `LEIAME.TXT` do disquete termina com um. O `TYPE` do DOS também parava no primeiro Ctrl+Z.

### LIMPA: trocar de modo apaga a tela

```asm fragmento titulo="SHELL.ASM: LIMPA"
        MOV  AX, 0003h          ; trocar de modo limpa a tela
        INT  10h
```

Programar o modo 03h (texto 80 × 25 colorido) de novo faz a BIOS apagar a memória de vídeo e pôr o cursor no canto ([vídeo no livro](livro:cap03)). O `CLS` do `COMMAND.COM` fazia mais ou menos isso. Há um bônus: se um jogo terminar no modo 13h e esquecer de voltar ao modo texto, `LIMPA` conserta a tela.

### VER: a versão do sistema

A função **30h** devolve a versão em AL (principal) e AH (secundária). O kernel do MINIOS responde 1.0 e põe `'MI'` em BX, um jeito de um programa saber que está no MINIOS e não no DOS (o `INFO.COM` da [aula 44](aula:aula44) usa isso). O DOS do simulador responde 5.0, como um MS-DOS 5.

### MEM: quanto há de memória

```asm fragmento titulo="SHELL.ASM: MEM"
        INT  12h                ; AX = KB de memória convencional
        MOV  BL, 1
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_mem
        CALL TEXTO
```

A **INT 12h** é um dos serviços mais antigos da BIOS: devolve em AX quantos KB de memória convencional o POST encontrou (o valor está guardado em 0040:0013h, [na área de dados da BIOS](livro:cap17)). Num PC com 640 KB, AX = 280h. O resto do `MEM` é um mapa fixo, em texto, porque o MINIOS não tem gerenciador de memória: cada coisa tem o seu segmento combinado ([equipamento e memória, no livro](livro:cap08)).

```diagrama titulo="O mapa da memória do MINIOS (o que o MEM mostra)"
  00000h ┌──────────────────────────────┐ 0000:0000  vetores de interrupção
         │                              │ 0000:0400  área de dados da BIOS
  07C00h ├──────────────────────────────┤ 0000:7C00  setor de boot (já não é usado)
  08000h ├──────────────────────────────┤ 0800:0000  KERNEL.SYS (+ pilha do kernel)
  20000h ├──────────────────────────────┤ 2000:0000  PSP do SHELL.COM, código em 2000:0100
  30000h ├──────────────────────────────┤ 3000:0000  programa rodado pelo shell (nível 1)
  40000h ├──────────────────────────────┤ 4000:0000  programa rodado por ele (nível 2)
  50000h ├──────────────────────────────┤ 5000:0000  buffer do TIPO
         │            livre             │
  A0000h ├──────────────────────────────┤ A000:0000  memória de vídeo (modo 13h)
  B8000h │                              │ B800:0000  memória de vídeo (modo texto)
  F0000h └──────────────────────────────┘ F000:0000  ROM da BIOS
```

:::anos90 O MEM do DOS
No MS-DOS o `MEM` era um **programa externo** (`MEM.EXE`, desde o DOS 4.0) e mostrava a famosa linha "Largest executable program size", a memória que sobrava para rodar um programa. Os jogadores de 1993 passavam tardes reorganizando o `CONFIG.SYS` com `DEVICEHIGH` e `LOADHIGH` para ganhar os 600 KB livres que alguns jogos exigiam. No MINIOS a pergunta não faz sentido: cada programa ganha um segmento inteiro de 64 KB, sempre o mesmo.
:::

### HORA: o relógio em BCD

O comando junta o `DATE` e o `TIME` do DOS. O relógio de tempo real do PC AT (o chip MC146818, alimentado pela bateria) é lido pela **INT 1Ah**: a função 04h devolve a data, a 02h a hora ([o tempo, no livro](livro:cap07)).

| Função | CH | CL | DH | DL |
|--------|----|----|----|----|
| 02h (hora) | hora | minuto | segundo | horário de verão |
| 04h (data) | século (19 ou 20) | ano | mês | dia |

Tudo vem em **BCD** (a [aula 30](aula:aula30)): cada nibble é um dígito decimal. A hora 23 vem como 23h, isto é, 0010 0011. Para escrever basta mostrar os dois nibbles como dígitos, sem nenhuma divisão:

```asm fragmento titulo="SHELL.ASM: ESCREVE_BCD"
ESCREVE_BCD PROC
        PUSH CX
        PUSH AX
        MOV  DL, AL
        MOV  CL, 4
        SHR  DL, CL             ; nibble de cima: o primeiro dígito
        ADD  DL, '0'
        CALL CARACTERE
        POP  AX
        MOV  DL, AL
        AND  DL, 0Fh            ; nibble de baixo: o segundo
        ADD  DL, '0'
        CALL CARACTERE
        POP  CX
        RET
ESCREVE_BCD ENDP
```

O `PUSH CX` não é enfeite: no `CMD_HORA`, CX guarda o século e o ano enquanto o dia e o mês são escritos, e o `MOV CL, 4` estragaria o ano.

Por que o relógio usa BCD? Porque o chip foi feito para relógios e aparelhos simples, que mostram os dígitos direto num display sem saber dividir. O PC herdou o formato. O DOS converte para binário (a função 2Ah devolve o ano como 1993 num registrador); o MINIOS não precisa, porque só mostra.

:::atencao O PC XT não tem relógio
A INT 1Ah funções 02h e 04h só existem a partir do PC AT. No XT original não havia relógio com bateria: o DOS perguntava a data e a hora a cada boot (o famoso "Enter new date:"), e a BIOS devolve CF = 1 nessas funções. O shell do MINIOS não testa o CF; um desafio do fim da aula é fazer isso e cair para o contador de tiques da BIOS.
:::

### ECO, REINICIA e DESLIGA

```asm fragmento titulo="SHELL.ASM: os três menores comandos"
CMD_ECO PROC
        CALL ESCREVE_Z          ; SI já aponta para os argumentos
        CALL NOVA_LINHA
        RET
CMD_ECO ENDP

CMD_REINICIA PROC
        INT  19h                ; a BIOS lê o setor de boot de novo
CMD_REINICIA ENDP

CMD_DESLIGA PROC
        MOV  DX, OFFSET msg_desliga
        CALL TEXTO
        CLI                     ; sem interrupções, o HLT para de vez
        HLT
CMD_DESLIGA ENDP
```

- **ECO** mostra que a convenção "SI = argumentos" vale a pena: a rotina inteira são três instruções.
- **REINICIA** chama a **INT 19h**, o carregador de boot da BIOS: ela lê o setor 0 do disquete para 0000:7C00 e salta para lá, e o MINIOS começa do zero ([boot e ROMs, no livro](livro:cap12)). Não há `RET` porque a INT 19h não volta. Num PC real, a INT 19h não reinicializa o hardware; um programa que deixou o PIC ou o vídeo num estado estranho continua estranho. O "Ctrl+Alt+Del" de verdade salta para F000:FFF0, o mesmo endereço do ligar. Para o MINIOS, que não mexe em hardware além dos vetores, a INT 19h basta.
- **DESLIGA** não desliga nada: um PC de 1990 não tinha como desligar a fonte por software (isso só veio com o APM e o ACPI, nos Pentiums). O `CLI` seguido de `HLT` para a CPU de vez: o `HLT` espera uma interrupção, e com o `CLI` nenhuma interrupção mascarável chega. É o que os sistemas faziam antes de mostrar "Agora é seguro desligar o computador".

## Programas externos

Se o nome não está na tabela, o shell supõe que é um programa no disquete. A rotina `EXTERNO` faz três coisas: monta o nome do arquivo, monta a linha de comando e chama a função **4Bh** (EXEC).

### O nome do arquivo

`COBRA` vira `COBRA.COM`. Mas se o usuário já digitou um ponto (`COBRA.COM` ou `LEIAME.TXT`), o nome fica como está:

```asm fragmento titulo="SHELL.ASM: EXTERNO, o nome"
        MOV  SI, OFFSET comando ; monta o nome do arquivo
        MOV  DI, OFFSET arquivo
        XOR  BL, BL             ; BL = 1 se o nome já tem ponto
@@copia:
        LODSB
        CMP  AL, '.'
        JNE  @@nao_ponto
        MOV  BL, 1
@@nao_ponto:
        MOV  [DI], AL
        INC  DI
        OR   AL, AL
        JNZ  @@copia
        DEC  DI                 ; DI volta para cima do zero
        OR   BL, BL
        JNZ  @@cauda
        MOV  SI, OFFSET ext_com ; acrescenta ".COM"
        MOV  CX, 5
        REP  MOVSB              ; (ES = DS num .COM)
```

O `REP MOVSB` copia os 5 bytes de `'.COM', 0`, já com o zero do fim, por cima do zero antigo. Num `.COM`, CS = DS = ES = SS, então ES já aponta para os dados do shell e o `MOVSB` funciona sem preparação. Num `.EXE` isso seria um erro clássico: ES aponta para o PSP no começo do programa ([aula 26](aula:aula26)).

E se o usuário digitar `LEIAME.TXT` como comando? O shell manda o kernel "rodar" o texto: ele é carregado em 3000:0100 e a CPU começa a executar as letras como se fossem instruções. O MINIOS, como o CP/M e o DOS 1.0, não confere nada. O DOS 2.0 em diante recusa extensões que não sejam `.COM`, `.EXE` ou `.BAT`. Um desafio do fim da aula é fazer o mesmo.

### A cauda de comando

O programa rodado precisa receber os argumentos. No DOS eles ficam no **PSP**, a partir do deslocamento 80h, num formato fixo: um byte com o tamanho, o texto (normalmente começando com um espaço) e um 13 no fim. O MINIOS usa o mesmo formato, para que os programas sejam compatíveis: o `SETOR.COM` da [aula 44](aula:aula44) lê o número do setor em `PSP:81h` e funciona igual nos dois sistemas.

```diagrama titulo="SETOR 1  →  a cauda que vai para o PSP do programa"
 cauda (no shell)                      PSP do programa (3000:0080)
 ┌────┬─────┬─────┬────┐   kernel     ┌────┬─────┬─────┬────┐
 │ 2  │ ' ' │ '1' │ 13 │ ──────────►  │ 2  │ ' ' │ '1' │ 13 │
 └────┴─────┴─────┴────┘  MONTA_PSP   └────┴─────┴─────┴────┘
   │     │                             80h  81h   82h   83h
   │     └─ um espaço na frente, como o COMMAND.COM faz
   └─ tamanho: o espaço e o texto, sem o 13
```

```asm fragmento titulo="SHELL.ASM: EXTERNO, a cauda e o EXEC"
@@cauda:
        MOV  SI, argumentos     ; linha de comando: tamanho, " args", 13
        MOV  DI, OFFSET cauda+1
        XOR  CL, CL
        CMP  BYTE PTR [SI], 0
        JE   @@fim_cauda
        MOV  BYTE PTR [DI], ' ' ; o DOS também deixa um espaço na frente
        INC  DI
        INC  CL
@@arg:  LODSB
        OR   AL, AL
        JZ   @@fim_cauda
        MOV  [DI], AL
        INC  DI
        INC  CL
        JMP  @@arg
@@fim_cauda:
        MOV  BYTE PTR [DI], 13
        MOV  cauda, CL
        MOV  DX, OFFSET arquivo
        MOV  BX, OFFSET cauda   ; ES:BX = linha de comando
        MOV  AH, 4Bh
        INT  21h                ; roda... e volta aqui quando ele terminar
        JNC  @@fim
        CMP  AX, 8
        JE   @@memoria
        MOV  DX, OFFSET msg_nao_achei
        ...
```

Sem argumentos, a cauda é só `0, 13`, o que os programas entendem como "nada na linha de comando".

### O que acontece dentro da 4Bh

Do ponto de vista do shell, o `INT 21h` com AH = 4Bh é uma chamada que **demora**: só volta quando o programa termina. Por dentro, o kernel faz tudo o que a [aula 42](aula:aula42) explicou:

```diagrama titulo="A vida de um programa externo"
  SHELL (2000h)                    KERNEL (0800h)                   COBRA (3000h)
  ─────────────                    ──────────────                   ─────────────
  INT 21h, AH=4Bh  ──────────────► acha COBRA.COM no diretório
                                   lê os setores para 3000:0100
                                   monta o PSP (CD 20, cauda em 80h)
                                   guarda os vetores 00h-3Fh
                                   guarda SS:SP do shell
                                   SS=DS=ES=3000h, SP=FFFEh
                                   RETF para 3000:0100 ──────────►  roda o jogo...
                                                                    troca a INT 9...
                                                                    INT 21h, AH=4Ch
                                   TERMINA ◄──────────────────────
                                   devolve os vetores
                                   volta para a pilha do shell
  ◄───────────────────────────── IRET (CF = 0)
  JMP @@prompt
```

Dois detalhes do kernel tornam a vida do shell fácil:

- **Os vetores voltam como estavam.** Um jogo que troca a INT 9 (teclado) ou a INT 8 (timer) e termina sem devolver deixaria o shell sem teclado. O kernel guarda uma cópia das INT 00h a 3Fh antes de rodar o programa e restaura no fim. O DOS de verdade só restaura as INT 22h, 23h e 24h, que ficam no PSP; o resto é responsabilidade do programa.
- **Há um limite de dois níveis.** Um programa rodado pelo shell vai para 3000h; se ele também usar a 4Bh, o segundo vai para 4000h. Um terceiro nível devolve o erro 8 ("memória insuficiente", o mesmo número do DOS), e o shell mostra "Programas demais rodando ao mesmo tempo".

Os erros voltam com **CF = 1** e o código em AX, igual ao DOS: 2 = arquivo não encontrado, 8 = sem memória. O shell só distingue esses dois.

:::atencao O SHELL.COM não roda programas no DOS de verdade
No MS-DOS, a função 4Bh espera em ES:BX um **bloco de parâmetros** de 14 bytes (segmento do ambiente, ponteiro para a cauda, dois ponteiros para FCBs), e não a cauda direto. Além disso, um `.COM` recebe do DOS **toda** a memória livre; antes de rodar outro programa, ele precisa devolver o que não usa com a função 4Ah ([aula 26](aula:aula26)), senão a 4Bh falha com erro 8. O MINIOS simplificou as duas coisas (memória em segmentos fixos, cauda direto em ES:BX). Os comandos internos que só usam a BIOS funcionam no DOS; `DIR`, `TIPO` e os externos dependem das funções do MINIOS.
:::

## E o COMMAND.COM?

O shell do MINIOS tem 2 KB. O `COMMAND.COM` do MS-DOS 6.22 tem 54 KB. Onde estão os 52 KB de diferença? Em quatro grandes blocos de recursos ([o DOS por dentro, no livro](livro:cap22)):

| Recurso | COMMAND.COM | SHELL.COM do MINIOS |
|---------|-------------|---------------------|
| comandos internos | uns 30: DIR, COPY, DEL, REN, TYPE, CLS, VER, VOL, DATE, TIME, ECHO, SET, PATH, PROMPT, CD, MD, RD, BREAK, EXIT... | 11 (com o `?`) |
| programas externos | `.COM`, `.EXE` e `.BAT`, no diretório atual e depois em cada diretório do `PATH` | só `.COM`, no único diretório |
| arquivos de lote | `.BAT` com IF, FOR, GOTO, CALL, SHIFT, PAUSE, `%1`... | não tem |
| redirecionamento | `>`, `>>`, `<` e `|` (com arquivos temporários) | não tem |
| ambiente | variáveis `SET`, o `PATH`, o `COMSPEC`, copiadas para cada programa | não tem |
| prompt | configurável: `PROMPT $P$G`, `$D`, `$T`... | fixo: `A> ` |
| erros críticos | "Abort, Retry, Fail?" (a INT 24h) | o kernel desiste |
| Ctrl+C | interrompe o programa (a INT 23h) | não tem |

### Internos e externos

A divisão entre comandos internos e externos no DOS seguia uma regra prática: **interno é o que é pequeno e usado o tempo todo**; **externo é o que é grande ou raro**. `DIR`, `COPY` e `TYPE` estão sempre na memória, prontos sem ler o disquete. `FORMAT`, `CHKDSK`, `DISKCOPY`, `XCOPY`, `MEM`, `MORE`, `SORT` e `EDIT` são arquivos que só ocupam memória quando rodam. O preço de um externo: num PC com dois disquetes, o disquete do DOS precisava estar no drive para você usar o `FORMAT`.

O MINIOS segue a mesma regra. Os utilitários `INFO`, `TECLAS` e `SETOR` da próxima aula poderiam ter sido comandos internos, mas são externos: não ocupam memória quando não estão rodando, e um usuário pode acrescentar novos sem mexer no shell.

A ordem de busca também vem do DOS: **primeiro a tabela de internos, depois o disco**. Por isso, no DOS, um programa chamado `DIR.COM` nunca roda quando você digita `DIR` (o interno ganha); só digitando `DIR.COM` com a extensão. No MINIOS acontece o mesmo: a tabela é consultada com o nome digitado, e `DIR.COM` não está nela.

### PROMPT

O `PROMPT` do DOS é um minilinguagem: `$P` é o drive e o diretório atual, `$G` é o `>`, `$D` a data, `$T` a hora, `$_` uma quebra de linha, `$E` o ESC (para usar o `ANSI.SYS` e pintar o prompt de cores). O texto fica guardado no ambiente, na variável `PROMPT`. Cada vez que mostra o prompt, o `COMMAND.COM` percorre o texto e troca cada `$letra` pela informação correspondente. É um desafio ótimo para o shell do MINIOS: guardar um texto, e, na hora de mostrar o prompt, interpretar os `$` com as rotinas que já existem (o `ESCREVE_BCD` do `HORA`, por exemplo).

### A parte residente e a parte transiente

Este é o truque mais interessante do `COMMAND.COM`, e nasceu da falta de memória. Em 1981 um PC vinha com 64 KB. Se o `COMMAND.COM` inteiro ficasse na memória o tempo todo, sobraria pouco para os programas. A solução foi dividir o shell em três partes:

```diagrama titulo="O COMMAND.COM na memória (MS-DOS 3 a 6)"
  00000h ┌─────────────────────────────┐
         │ vetores, BIOS, IO.SYS,      │
         │ MSDOS.SYS, buffers, drivers │
         ├─────────────────────────────┤
         │ COMMAND.COM: parte RESIDENTE│  uns 4 KB, nunca sai da memória:
         │  INT 22h, 23h e 24h         │  trata o fim de programa, o Ctrl+C
         │  e o carregador do transiente│ e o "Abort, Retry, Fail?"
         ├─────────────────────────────┤
         │                             │
         │ programa do usuário         │  pode ocupar tudo isto...
         │                             │
         │ ......................      │  ...inclusive a área do transiente
         ├─────────────────────────────┤
         │ COMMAND.COM: parte          │  uns 25 KB no alto da memória:
         │ TRANSIENTE                  │  o prompt, a leitura da linha, os
         │                             │  comandos internos, os .BAT
  A0000h └─────────────────────────────┘
          (a parte de INICIALIZAÇÃO, que lê o AUTOEXEC.BAT, é descartada)
```

A parte **transiente** (o interpretador de verdade, com todos os comandos internos) fica no topo da memória convencional, num lugar que o DOS considera **livre**. Se um programa grande precisar dessa memória, ele pode usar e apagar o transiente. Quando o programa termina, a parte **residente** (pequena, embaixo) calcula um *checksum* da área do transiente. Se não bater, ela lê o transiente de novo do disco, usando o caminho da variável `COMSPEC`. Se o disquete do DOS não estiver no drive, aparece a mensagem que todo usuário de PC com dois disquetes conhecia:

```
Insert disk with \COMMAND.COM in drive A
and strike any key when ready
```

O MINIOS faz uma versão bem mais simples da mesma ideia: o shell inteiro é "transiente" e o kernel faz o papel da parte residente. Se o shell terminar, o kernel o lê de novo do disquete (a rotina `RODA_SHELL` da aula 42). E como cada programa tem o seu próprio segmento, o shell nunca é sobrescrito: não há o que verificar.

:::anos90 Outros shells
Como o `COMMAND.COM` é só um programa, apareceram substitutos. O **4DOS** (da JP Software, 1989) era compatível e acrescentava histórico de comandos com as setas, apelidos, descrições de arquivos e um `.BAT` muito mais poderoso; a Symantec distribuía uma versão dele como **NDOS** no Norton Utilities. Bastava pôr `SHELL=C:\4DOS\4DOS.COM` no `CONFIG.SYS`. O histórico com as setas o `COMMAND.COM` nunca teve: era preciso carregar o `DOSKEY`, um TSR, a partir do DOS 5.
:::

## A listagem completa

O `SHELL.COM` tem cerca de 2 KB (o `DIR` mostra o tamanho exato) e ocupa 5 setores do disquete. Ele é um `.COM` normal: `.MODEL TINY`, `ORG 100h`, e só usa a INT 21h (funções 02h, 09h, 0Ah, 30h, 4Bh e as duas do MINIOS, 80h e 81h), a INT 10h, a INT 12h, a INT 1Ah e a INT 19h. Para vê-lo em ação, dê boot no disquete completo do MINIOS na [aula 44](aula:aula44).

:::dica E no DOS do simulador?
Se você abrir o `SHELL.ASM` no laboratório, ele roda como um `.COM` do DOS: `AJUDA`, `ECO`, `HORA`, `MEM` e `LIMPA` funcionam, e `VER` mostra a versão do DOS do simulador. Mas `DIR` mostra zero arquivos e os programas externos não são encontrados, porque as funções 80h e 81h e a 4Bh simplificada só existem no kernel do MINIOS. É uma boa demonstração de que o shell é só um cliente das chamadas de sistema: o mesmo programa se comporta conforme o sistema que estiver por baixo.
:::

```asm titulo="SHELL.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  SHELL.ASM  -  o interpretador de comandos do MINIOS          ║
; ║  Curso Assembly 8086, aula 43                                 ║
; ║                                                               ║
; ║  Um .COM comum, que só usa a INT 21h do kernel (e a BIOS).    ║
; ║  Lê uma linha, separa o comando dos argumentos e procura o    ║
; ║  comando numa tabela; se não achar, roda o arquivo NOME.COM.  ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

SEG_BUFFER  EQU 5000h           ; onde o TIPO carrega o arquivo
MAX_LINHA   EQU 78

inicio:
        MOV  DX, OFFSET msg_ola
        CALL TEXTO
@@prompt:
        MOV  DX, OFFSET msg_prompt
        CALL TEXTO
        MOV  DX, OFFSET linha   ; lê a linha (INT 21h, AH=0Ah)
        MOV  AH, 0Ah
        INT  21h
        CALL NOVA_LINHA
        CALL SEPARA             ; comando em "comando", SI = argumentos
        CMP  comando, 0
        JE   @@prompt           ; linha vazia
        MOV  argumentos, SI
        MOV  SI, OFFSET tabela  ; procura o comando na tabela
@@procura:
        CMP  BYTE PTR [SI], 0
        JE   @@externo
        MOV  DI, OFFSET comando
        CALL IGUAIS             ; ZF = 1 se iguais; SI vai para depois do 0
        JE   @@interno
        ADD  SI, 2              ; pula o endereço da rotina
        JMP  @@procura
@@interno:
        MOV  BX, [SI]           ; BX = rotina do comando
        MOV  SI, argumentos
        CALL BX                 ; CALL indireto: o endereço veio da tabela
        JMP  @@prompt
@@externo:
        CALL EXTERNO
        JMP  @@prompt

; ===============================================================
; Linha de comando
; ===============================================================

; SEPARA: pega a primeira palavra da linha (em maiúsculas) para
; "comando" e devolve SI no começo dos argumentos (texto com 0 no fim)
SEPARA  PROC
        MOV  BL, linha+1        ; quantos caracteres vieram
        XOR  BH, BH
        MOV  SI, OFFSET linha+2
        MOV  BYTE PTR [SI+BX], 0   ; troca o 13 do fim por 0
        CALL PULA_ESPACOS
        MOV  DI, OFFSET comando
        MOV  CX, 12
@@letra:
        LODSB
        CMP  AL, ' '
        JE   @@fim
        OR   AL, AL
        JZ   @@acabou
        CALL MAIUSCULA
        JCXZ @@letra            ; comprido demais: ignora o resto
        MOV  [DI], AL
        INC  DI
        DEC  CX
        JMP  @@letra
@@acabou:
        DEC  SI                 ; deixa SI no 0
@@fim:  MOV  BYTE PTR [DI], 0
        CALL PULA_ESPACOS
        RET
SEPARA  ENDP

PULA_ESPACOS PROC
@@olha: CMP  BYTE PTR [SI], ' '
        JNE  @@fim
        INC  SI
        JMP  @@olha
@@fim:  RET
PULA_ESPACOS ENDP

; IGUAIS: compara o texto SI com o texto DI (os dois terminados em 0).
; ZF = 1 se iguais. SI sempre termina logo depois do 0 do seu texto.
IGUAIS  PROC
        PUSH DI
@@car:  LODSB
        CMP  AL, [DI]
        JNE  @@diferente
        INC  DI
        OR   AL, AL
        JNZ  @@car
        POP  DI                 ; chegou nos dois zeros: iguais (ZF = 1)
        RET
@@diferente:
        OR   AL, AL             ; anda com SI até o fim do texto dele
        JZ   @@sai
        LODSB
        JMP  @@diferente
@@sai:  OR   SP, SP             ; ZF = 0 (SP nunca é zero aqui)
        POP  DI
        RET
IGUAIS  ENDP

MAIUSCULA PROC
        CMP  AL, 'a'
        JB   @@fim
        CMP  AL, 'z'
        JA   @@fim
        SUB  AL, 'a'-'A'
@@fim:  RET
MAIUSCULA ENDP

; ===============================================================
; Programas externos
; ===============================================================

; EXTERNO: roda COMANDO.COM (ou o nome com extensão, se tiver ponto),
; passando os argumentos na linha de comando, pela INT 21h, AH=4Bh
EXTERNO PROC
        MOV  SI, OFFSET comando ; monta o nome do arquivo
        MOV  DI, OFFSET arquivo
        XOR  BL, BL             ; BL = 1 se o nome já tem ponto
@@copia:
        LODSB
        CMP  AL, '.'
        JNE  @@nao_ponto
        MOV  BL, 1
@@nao_ponto:
        MOV  [DI], AL
        INC  DI
        OR   AL, AL
        JNZ  @@copia
        DEC  DI
        OR   BL, BL
        JNZ  @@cauda
        MOV  SI, OFFSET ext_com ; acrescenta ".COM"
        MOV  CX, 5
        REP  MOVSB              ; (ES = DS num .COM)
@@cauda:
        MOV  SI, argumentos     ; linha de comando: tamanho, " args", 13
        MOV  DI, OFFSET cauda+1
        XOR  CL, CL
        CMP  BYTE PTR [SI], 0
        JE   @@fim_cauda
        MOV  BYTE PTR [DI], ' ' ; o DOS também deixa um espaço na frente
        INC  DI
        INC  CL
@@arg:  LODSB
        OR   AL, AL
        JZ   @@fim_cauda
        MOV  [DI], AL
        INC  DI
        INC  CL
        JMP  @@arg
@@fim_cauda:
        MOV  BYTE PTR [DI], 13
        MOV  cauda, CL
        MOV  DX, OFFSET arquivo
        MOV  BX, OFFSET cauda   ; ES:BX = linha de comando
        MOV  AH, 4Bh
        INT  21h                ; roda... e volta aqui quando ele terminar
        JNC  @@fim
        CMP  AX, 8
        JE   @@memoria
        MOV  DX, OFFSET msg_nao_achei
        CALL TEXTO
        MOV  SI, OFFSET arquivo
        CALL ESCREVE_Z
        CALL NOVA_LINHA
        RET
@@memoria:
        MOV  DX, OFFSET msg_memoria
        CALL TEXTO
@@fim:  RET
EXTERNO ENDP

; ===============================================================
; Comandos internos (entram com SI = argumentos)
; ===============================================================
CMD_AJUDA PROC
        MOV  DX, OFFSET msg_ajuda
        CALL TEXTO
        RET
CMD_AJUDA ENDP

; DIR: pede as entradas do diretório ao kernel (função 80h do MINIOS)
CMD_DIR PROC
        MOV  DX, OFFSET msg_dir
        CALL TEXTO
        XOR  CX, CX             ; CX = número da entrada
        MOV  total, 0
@@entrada:
        PUSH CX
        MOV  DI, OFFSET entrada
        MOV  AH, 80h
        INT  21h
        POP  CX
        JC   @@fim              ; CF = 1: acabaram as entradas
        MOV  DX, OFFSET msg_espaco2
        CALL TEXTO
        MOV  SI, OFFSET entrada ; nome (8 letras)
        MOV  BX, 8
        CALL ESCREVE_N
        MOV  DL, ' '
        CALL CARACTERE
        MOV  BX, 3              ; extensão
        CALL ESCREVE_N
        MOV  AX, WORD PTR entrada+16   ; tamanho
        ADD  total, AX
        MOV  BL, 8
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_bytes
        CALL TEXTO
        MOV  AX, WORD PTR entrada+12   ; primeiro setor
        MOV  BL, 5
        CALL ESCREVE_NUM
        TEST entrada+11, 04h    ; atributo de sistema?
        JZ   @@linha
        MOV  DX, OFFSET msg_sistema
        CALL TEXTO
@@linha:
        CALL NOVA_LINHA
        INC  CX
        JMP  @@entrada
@@fim:  MOV  AX, CX
        MOV  BL, 5
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_arquivos
        CALL TEXTO
        MOV  AX, total
        MOV  BL, 1
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_bytes_fim
        CALL TEXTO
        RET
CMD_DIR ENDP

; TIPO arquivo: carrega o arquivo inteiro (função 81h) e mostra o texto
CMD_TIPO PROC
        CMP  BYTE PTR [SI], 0
        JNE  @@tem
        MOV  DX, OFFSET msg_uso_tipo
        CALL TEXTO
        RET
@@tem:  MOV  DX, SI             ; DS:DX = nome
        PUSH ES
        MOV  AX, SEG_BUFFER
        MOV  ES, AX
        XOR  BX, BX             ; ES:BX = 5000:0000
        MOV  AH, 81h
        INT  21h
        POP  ES
        JNC  @@mostra
        MOV  DX, OFFSET msg_nao_achei
        CALL TEXTO
        MOV  SI, argumentos
        CALL ESCREVE_Z
        CALL NOVA_LINHA
        RET
@@mostra:
        MOV  CX, AX             ; CX = tamanho
        JCXZ @@fim
        PUSH DS
        MOV  AX, SEG_BUFFER
        MOV  DS, AX
        XOR  SI, SI
@@car:  LODSB
        CMP  AL, 1Ah            ; Ctrl+Z: fim de texto, à moda do DOS
        JE   @@acabou
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        LOOP @@car
@@acabou:
        POP  DS
@@fim:  CALL NOVA_LINHA
        RET
CMD_TIPO ENDP

CMD_LIMPA PROC
        MOV  AX, 0003h          ; trocar de modo limpa a tela
        INT  10h
        RET
CMD_LIMPA ENDP

CMD_VER PROC
        MOV  AH, 30h
        INT  21h                ; AL = versão, AH = revisão
        PUSH AX
        MOV  DX, OFFSET msg_versao
        CALL TEXTO
        POP  AX
        PUSH AX
        XOR  AH, AH
        MOV  BL, 1
        CALL ESCREVE_NUM
        MOV  DL, '.'
        CALL CARACTERE
        POP  AX
        MOV  AL, AH
        XOR  AH, AH
        MOV  BL, 1
        CALL ESCREVE_NUM
        CALL NOVA_LINHA
        RET
CMD_VER ENDP

; MEM: a memória que a BIOS informa (INT 12h) e o mapa do MINIOS
CMD_MEM PROC
        INT  12h                ; AX = KB de memória convencional
        MOV  BL, 1
        CALL ESCREVE_NUM
        MOV  DX, OFFSET msg_mem
        CALL TEXTO
        RET
CMD_MEM ENDP

; HORA: data e hora do relógio de tempo real (INT 1Ah, AH=04h e 02h).
; O relógio guarda tudo em BCD: 19h quer dizer "19", e basta escrever
; os dois dígitos hexadecimais.
CMD_HORA PROC
        MOV  DX, OFFSET msg_data
        CALL TEXTO
        MOV  AH, 04h
        INT  1Ah                ; CH = século, CL = ano, DH = mês, DL = dia
        PUSH CX
        PUSH DX
        MOV  AL, DL
        CALL ESCREVE_BCD
        MOV  DL, '/'
        CALL CARACTERE
        POP  DX
        MOV  AL, DH
        CALL ESCREVE_BCD
        MOV  DL, '/'
        CALL CARACTERE
        POP  CX
        MOV  AL, CH
        CALL ESCREVE_BCD
        MOV  AL, CL
        CALL ESCREVE_BCD
        MOV  DX, OFFSET msg_hora
        CALL TEXTO
        MOV  AH, 02h
        INT  1Ah                ; CH = hora, CL = minuto, DH = segundo
        PUSH DX
        PUSH CX
        MOV  AL, CH
        CALL ESCREVE_BCD
        MOV  DL, ':'
        CALL CARACTERE
        POP  CX
        MOV  AL, CL
        CALL ESCREVE_BCD
        MOV  DL, ':'
        CALL CARACTERE
        POP  DX
        MOV  AL, DH
        CALL ESCREVE_BCD
        CALL NOVA_LINHA
        RET
CMD_HORA ENDP

CMD_ECO PROC
        CALL ESCREVE_Z
        CALL NOVA_LINHA
        RET
CMD_ECO ENDP

CMD_REINICIA PROC
        INT  19h                ; a BIOS lê o setor de boot de novo
CMD_REINICIA ENDP

CMD_DESLIGA PROC
        MOV  DX, OFFSET msg_desliga
        CALL TEXTO
        CLI                     ; sem interrupções, o HLT para de vez
        HLT
CMD_DESLIGA ENDP

; ===============================================================
; Saída de texto
; ===============================================================
TEXTO   PROC                    ; texto DS:DX terminado em '$'
        PUSH AX
        MOV  AH, 09h
        INT  21h
        POP  AX
        RET
TEXTO   ENDP

CARACTERE PROC                  ; DL
        PUSH AX
        MOV  AH, 02h
        INT  21h
        POP  AX
        RET
CARACTERE ENDP

NOVA_LINHA PROC
        PUSH DX
        MOV  DX, OFFSET msg_crlf
        CALL TEXTO
        POP  DX
        RET
NOVA_LINHA ENDP

; ESCREVE_Z: texto DS:SI terminado em 0
ESCREVE_Z PROC
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        MOV  DL, AL
        CALL CARACTERE
        JMP  @@car
@@fim:  RET
ESCREVE_Z ENDP

; ESCREVE_N: BX caracteres de DS:SI (SI avança)
ESCREVE_N PROC
@@car:  LODSB
        MOV  DL, AL
        CALL CARACTERE
        DEC  BX
        JNZ  @@car
        RET
ESCREVE_N ENDP

; ESCREVE_NUM: AX em decimal, alinhado à direita em BL colunas
ESCREVE_NUM PROC
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  SI, 10
        XOR  CX, CX
@@divide:
        XOR  DX, DX
        DIV  SI
        PUSH DX
        INC  CX
        OR   AX, AX
        JNZ  @@divide
        MOV  DL, ' '            ; espaços na frente até BL colunas
        MOV  AL, BL
        XOR  AH, AH
@@espaco:
        CMP  AX, CX
        JBE  @@digitos
        CALL CARACTERE
        DEC  AX
        JMP  @@espaco
@@digitos:
        POP  DX
        ADD  DL, '0'
        CALL CARACTERE
        LOOP @@digitos
        POP  SI
        POP  DX
        POP  CX
        RET
ESCREVE_NUM ENDP

; ESCREVE_BCD: os dois dígitos do byte BCD em AL
ESCREVE_BCD PROC
        PUSH CX
        PUSH AX
        MOV  DL, AL
        MOV  CL, 4
        SHR  DL, CL
        ADD  DL, '0'
        CALL CARACTERE
        POP  AX
        MOV  DL, AL
        AND  DL, 0Fh
        ADD  DL, '0'
        CALL CARACTERE
        POP  CX
        RET
ESCREVE_BCD ENDP

; ===============================================================
; Dados
; ===============================================================
; tabela de comandos: nome com 0 no fim e o endereço da rotina
tabela      DB 'AJUDA', 0
            DW CMD_AJUDA
            DB '?', 0
            DW CMD_AJUDA
            DB 'DIR', 0
            DW CMD_DIR
            DB 'TIPO', 0
            DW CMD_TIPO
            DB 'LIMPA', 0
            DW CMD_LIMPA
            DB 'VER', 0
            DW CMD_VER
            DB 'MEM', 0
            DW CMD_MEM
            DB 'HORA', 0
            DW CMD_HORA
            DB 'ECO', 0
            DW CMD_ECO
            DB 'REINICIA', 0
            DW CMD_REINICIA
            DB 'DESLIGA', 0
            DW CMD_DESLIGA
            DB 0                ; fim da tabela

msg_ola     DB 13, 10, 'Shell do MINIOS. Digite AJUDA para ver os comandos.', 13, 10, '$'
msg_prompt  DB 13, 10, 'A> $'
msg_crlf    DB 13, 10, '$'
msg_ajuda   DB 'Comandos do shell:', 13, 10
            DB '  AJUDA       esta lista', 13, 10
            DB '  DIR         lista os arquivos do disquete', 13, 10
            DB '  TIPO arq    mostra um arquivo de texto', 13, 10
            DB '  LIMPA       limpa a tela', 13, 10
            DB '  VER         versao do sistema', 13, 10
            DB '  MEM         memoria e mapa do MINIOS', 13, 10
            DB '  HORA        data e hora do relogio', 13, 10
            DB '  ECO texto   repete o texto', 13, 10
            DB '  REINICIA    faz o boot de novo', 13, 10
            DB '  DESLIGA     para a CPU', 13, 10
            DB 'Qualquer outro nome roda o programa NOME.COM do disco.', 13, 10, '$'
msg_dir     DB ' Disquete A: (MINIFS)', 13, 10, 13, 10
            DB '  Nome     Ext  Tamanho       Setor', 13, 10, '$'
msg_espaco2 DB '  $'
msg_bytes   DB ' bytes $'
msg_sistema DB '  (sistema)$'
msg_arquivos DB ' arquivo(s), $'
msg_bytes_fim DB ' bytes', 13, 10, '$'
msg_nao_achei DB 'Comando ou arquivo nao encontrado: $'
msg_memoria DB 'Programas demais rodando ao mesmo tempo.', 13, 10, '$'
msg_uso_tipo DB 'Uso: TIPO arquivo (por exemplo, TIPO LEIAME.TXT)', 13, 10, '$'
msg_versao  DB 'MINIOS versao $'
msg_mem     DB ' KB de memoria convencional', 13, 10
            DB '  0000:0000  vetores de interrupcao e dados da BIOS', 13, 10
            DB '  0000:7C00  setor de boot', 13, 10
            DB '  0800:0000  kernel', 13, 10
            DB '  2000:0000  shell (este programa)', 13, 10
            DB '  3000:0000  programa em execucao', 13, 10
            DB '  A000:0000  memoria de video', 13, 10, '$'
msg_data    DB 'Data: $'
msg_hora    DB '   Hora: $'
msg_desliga DB 'Pode desligar o computador.', 13, 10, '$'
ext_com     DB '.COM', 0

linha       DB MAX_LINHA+1, 0, MAX_LINHA+2 DUP (0)
comando     DB 13 DUP (0)
argumentos  DW 0
arquivo     DB 20 DUP (0)
cauda       DB 0, 127 DUP (13)
entrada     DB 32 DUP (0)
total       DW 0

END inicio
```

```quiz
? Por que o shell do MINIOS (e o COMMAND.COM do DOS) é um programa separado e não uma parte do kernel?
- Porque o 8086 não deixa o kernel ler o teclado
+ Para o kernel ficar pequeno, o shell poder ser trocado e um erro no shell não derrubar o sistema
- Porque um .COM é mais rápido que um kernel
- Porque a BIOS só carrega arquivos .COM
> O kernel só precisa ler setores, achar arquivos e rodar programas. Como o shell é um programa comum, dá para trocá-lo (o 4DOS fazia isso) e, se ele terminar, o kernel simplesmente o carrega de novo.

? Depois de digitar `eco oi` e Enter, como fica o buffer da função 0Ah (`linha`), declarado com `DB 79, 0, ...`?
- `79, 6, 'eco oi', 0`
+ `79, 6, 'eco oi', 13`
- `79, 7, 'eco oi', 13`
- `6, 79, 'eco oi', '$'`
> O primeiro byte (o máximo) não muda; o segundo recebe quantos caracteres vieram, sem contar o Enter; e o texto termina com 13. O SEPARA troca esse 13 por 0 usando o contador como índice.

? Na rotina `IGUAIS`, para que serve o `OR SP, SP` antes do `RET` do caminho "diferentes"?
- Para alinhar a pilha
- Para zerar SP
+ Para forçar ZF = 0, já que o OR AL,AL que achou o zero deixou ZF = 1
- Para conferir se a pilha estourou
> SP nunca é zero dentro da rotina, então `OR SP, SP` dá um resultado diferente de zero e desliga o ZF sem mudar nenhum registrador. Assim o `JE @@interno` depois do CALL só salta quando os nomes eram iguais.

? Na tabela de comandos, `DB 'DIR', 0` é seguido de `DW CMD_DIR`. O que o laço principal faz quando o nome bate?
- `JMP CMD_DIR` direto, com o endereço escrito no código
+ Lê a palavra depois do nome (`MOV BX, [SI]`) e faz `CALL BX`
- Calcula o endereço pela posição do nome na tabela
- Procura o arquivo DIR.COM no disquete
> É um CALL indireto: o endereço da rotina é um dado, guardado na tabela. Para acrescentar um comando basta escrever a rotina e uma entrada na tabela; o laço não muda.

? O usuário digita `SETOR 1`. Que bytes o shell entrega ao kernel como cauda de comando (ES:BX)?
- `'1', 0`
- `1, '1', 13`
+ `2, ' ', '1', 13`
- `' ', '1', '$'`
> O formato é o do PSP:80h: um byte com o tamanho, o texto começando com um espaço (como o COMMAND.COM faz) e um 13 no fim, que não entra na conta do tamanho.

? Por que o comando REINICIA não tem RET no fim?
- Porque o montador coloca o RET sozinho
+ Porque a INT 19h lê o setor de boot e salta para ele: nunca volta
- Porque o RET reiniciaria o PC duas vezes
- Porque a INT 19h já faz um RET
> A INT 19h é o carregador de boot da BIOS: ela lê o setor 0 para 0000:7C00 e salta para lá. Tudo o que estava na memória (inclusive o shell) é esquecido.

? No MS-DOS, o que acontecia quando um programa grande sobrescrevia a parte transiente do COMMAND.COM?
- O PC travava
- O DOS se recusava a rodar programas grandes
+ Ao terminar o programa, a parte residente via o checksum errado e lia o transiente de novo do disco (COMSPEC)
- O transiente era copiado para a memória estendida
> A parte transiente fica no topo da memória, numa área que o DOS considera livre. A parte residente, pequena, confere um checksum quando o programa termina e, se precisar, recarrega o transiente; se o disquete não estiver no drive, aparece "Insert disk with COMMAND.COM".

? Um programa chamado `DIR.COM` está no disco. O que acontece quando o usuário digita `DIR`?
+ Roda o comando interno DIR, porque a tabela de internos é consultada primeiro
- Roda o DIR.COM, porque programas do disco têm prioridade
- Aparece uma mensagem perguntando qual dos dois rodar
- Os dois rodam, um depois do outro
> Tanto no DOS quanto no MINIOS, os internos ganham. Para rodar o programa é preciso digitar `DIR.COM`, com a extensão (que não está na tabela).
```

## Exercícios

Cada exercício treina uma rotina do shell isolada, num programa `.EXE` pequeno. Como as rotinas do shell usam `LODSB`, `STOSB` e `MOVSB`, os programas começam com DS = ES = @DATA.

```exercicio
id: a43-1
titulo: Tudo em maiúsculas
nivel: 1
--- enunciado
O texto em **linha** termina com um byte 0. Converta para maiúsculas, no próprio lugar, todas as letras de `a` a `z`. Os outros caracteres (números, sinais, espaços, letras que já são maiúsculas) ficam como estão.

Cuidado com os vizinhos do intervalo: o `` ` `` (60h) vem logo antes do `a` e o `{` (7Bh) logo depois do `z`; eles não podem mudar.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
linha   DB 40 DUP (0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET linha
        ; converta cada letra minúscula até achar o 0

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "comando com argumento", "setup": { "linha": "tipo leiame.txt" }, "espera": { "mem": { "linha": ["T","I","P","O"," ","L","E","I","A","M","E",".","T","X","T",0] } } },
 { "nome": "misturado com números e sinais", "setup": { "linha": "Eco 123, ola!" }, "espera": { "mem": { "linha": ["E","C","O"," ","1","2","3",","," ","O","L","A","!",0] } } },
 { "nome": "vizinhos do intervalo", "setup": { "linha": "`az{@AZ[" }, "espera": { "mem": { "linha": ["`","A","Z","{","@","A","Z","[",0] } } },
 { "nome": "já em maiúsculas", "setup": { "linha": "DIR" }, "espera": { "mem": { "linha": ["D","I","R",0] } } }]
--- dicas
Um laço: MOV AL,[SI] / OR AL,AL / JZ fim.
Se AL < 'a' ou AL > 'z' (comparações sem sinal: JB e JA), pule para o próximo caractere.
Dentro do intervalo, SUB AL, 'a'-'A' (ou seja, 20h) e grave de volta com MOV [SI],AL. Depois INC SI e volte ao começo.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
linha   DB 40 DUP (0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET linha
@@car:  MOV  AL, [SI]
        OR   AL, AL
        JZ   @@fim
        CMP  AL, 'a'
        JB   @@prox
        CMP  AL, 'z'
        JA   @@prox
        SUB  AL, 'a'-'A'
        MOV  [SI], AL
@@prox: INC  SI
        JMP  @@car
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a43-2
titulo: Separar o comando
nivel: 2
--- enunciado
Escreva a parte principal do `SEPARA`. O texto em **linha** termina em 0 e pode ter espaços em qualquer lugar. Faça:

1. Pule os espaços do começo.
2. Copie a primeira palavra (até um espaço ou o 0) para **comando**, **convertida para maiúsculas**, e ponha um 0 depois dela. Nenhuma palavra dos testes passa de 12 letras.
3. Pule os espaços depois da palavra e guarde em **posArg** (DW) a **posição**, dentro de `linha`, do primeiro caractere dos argumentos (0 = o primeiro byte de `linha`). Se não houver argumentos, posArg é a posição do 0 do fim.

Por exemplo, para `"  dir   *.txt"`: comando = `"DIR"`, 0 e posArg = 8 (o `*`). Para uma linha só com espaços, comando fica vazio (só o 0).
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
linha   DB 60 DUP (0)
comando DB 13 DUP (0)
posArg  DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET linha

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "espaços antes e depois", "setup": { "linha": "  dir   *.txt", "comando": "XXXXXXXXXXXX" }, "espera": { "mem": { "comando": ["D","I","R",0], "posArg": 8 } } },
 { "nome": "sem argumentos", "setup": { "linha": "eco", "comando": "XXXXXXXXXXXX" }, "espera": { "mem": { "comando": ["E","C","O",0], "posArg": 3 } } },
 { "nome": "maiúsculas e minúsculas", "setup": { "linha": "Tipo leiame.txt", "comando": "XXXXXXXXXXXX" }, "espera": { "mem": { "comando": ["T","I","P","O",0], "posArg": 5 } } },
 { "nome": "espaços no fim", "setup": { "linha": " setor   ", "comando": "XXXXXXXXXXXX" }, "espera": { "mem": { "comando": ["S","E","T","O","R",0], "posArg": 9 } } },
 { "nome": "só espaços", "setup": { "linha": "    ", "comando": "XXXXXXXXXXXX" }, "espera": { "mem": { "comando": [0], "posArg": 4 } } },
 { "nome": "nome com ponto", "setup": { "linha": "cobra.com 5", "comando": "XXXXXXXXXXXX" }, "espera": { "mem": { "comando": ["C","O","B","R","A",".","C","O","M",0], "posArg": 10 } } }]
--- dicas
Pular espaços: CMP BYTE PTR [SI],' ' / JNE pronto / INC SI / JMP de volta. Você vai precisar disso duas vezes.
Copiar a palavra: DI = OFFSET comando; leia [SI]; se for ' ' ou 0, pare (sem avançar SI); senão converta e grave em [DI], INC SI, INC DI.
No fim da palavra, MOV BYTE PTR [DI],0. Depois de pular os espaços de novo, posArg = SI − OFFSET linha.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
linha   DB 60 DUP (0)
comando DB 13 DUP (0)
posArg  DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET linha
        CALL PULA
        MOV  DI, OFFSET comando
@@letra:
        MOV  AL, [SI]
        CMP  AL, ' '
        JE   @@fim
        OR   AL, AL
        JZ   @@fim
        CMP  AL, 'a'
        JB   @@grava
        CMP  AL, 'z'
        JA   @@grava
        SUB  AL, 'a'-'A'
@@grava:
        MOV  [DI], AL
        INC  DI
        INC  SI
        JMP  @@letra
@@fim:  MOV  BYTE PTR [DI], 0
        CALL PULA
        SUB  SI, OFFSET linha
        MOV  posArg, SI
        MOV  AX, 4C00h
        INT  21h

PULA    PROC
@@olha: CMP  BYTE PTR [SI], ' '
        JNE  @@ok
        INC  SI
        JMP  @@olha
@@ok:   RET
PULA    ENDP
END inicio
```

```exercicio
id: a43-3
titulo: Procurar na tabela
nivel: 2
--- enunciado
A **tabela** tem o formato da tabela do shell: cada entrada é um nome terminado em 0 seguido de uma palavra (DW). Aqui a palavra não é o endereço de uma rotina, mas um número que identifica o comando. Um nome vazio (um 0 sozinho) marca o fim.

Procure o texto de **comando** (em maiúsculas, terminado em 0) na tabela e devolva em **AX** a palavra que vem depois do nome encontrado. Se o nome não estiver na tabela, AX = 0.

Cuidado: `DI` é o começo de `DIR`, mas não é o mesmo comando; e `DIRX` também não.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
tabela  DB 'AJUDA', 0
        DW 1
        DB '?', 0
        DW 1
        DB 'DIR', 0
        DW 2
        DB 'TIPO', 0
        DW 3
        DB 'ECO', 0
        DW 4
        DB 'DESLIGA', 0
        DW 99
        DB 0
comando DB 13 DUP (0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET tabela
        ; AX = número do comando, ou 0

        MOV  AH, 4Ch            ; (AL = resposta, para conferir no fim)
        INT  21h
END inicio
--- testes
[{ "nome": "DIR", "setup": { "comando": "DIR" }, "espera": { "AX": 19458 } },
 { "nome": "o primeiro da tabela", "setup": { "comando": "AJUDA" }, "espera": { "AX": 19457 } },
 { "nome": "o apelido ?", "setup": { "comando": "?" }, "espera": { "AX": 19457 } },
 { "nome": "o último da tabela", "setup": { "comando": "DESLIGA" }, "espera": { "AX": 19555 } },
 { "nome": "DI não é DIR", "setup": { "comando": "DI" }, "espera": { "AX": 19456 } },
 { "nome": "DIRX não é DIR", "setup": { "comando": "DIRX" }, "espera": { "AX": 19456 } },
 { "nome": "não existe", "setup": { "comando": "COBRA" }, "espera": { "AX": 19456 } }]
--- dicas
O programa termina com MOV AH,4Ch: o teste confere AX com AH = 4Ch (19456 = 4C00h). Deixe a resposta em AL antes do MOV AH,4Ch.
Para cada entrada: se [SI] = 0, acabou a tabela (AL = 0). Senão compare o nome com o comando, letra por letra, com DI = OFFSET comando.
Os dois textos são iguais quando chegam juntos a um 0. Na primeira diferença, ande com SI até depois do 0 do nome, pule a palavra (ADD SI,2) e tente a próxima entrada.
Quando forem iguais, SI está logo depois do 0 do nome: MOV AX,[SI] pega o número.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
tabela  DB 'AJUDA', 0
        DW 1
        DB '?', 0
        DW 1
        DB 'DIR', 0
        DW 2
        DB 'TIPO', 0
        DW 3
        DB 'ECO', 0
        DW 4
        DB 'DESLIGA', 0
        DW 99
        DB 0
comando DB 13 DUP (0)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET tabela
@@entrada:
        XOR  AX, AX
        CMP  BYTE PTR [SI], 0
        JE   @@fim              ; fim da tabela: AX = 0
        MOV  DI, OFFSET comando
@@car:  LODSB
        CMP  AL, [DI]
        JNE  @@pula
        INC  DI
        OR   AL, AL
        JNZ  @@car
        MOV  AX, [SI]           ; iguais: a palavra vem logo depois do 0
        JMP  SHORT @@fim
@@pula: OR   AL, AL             ; anda até depois do 0 do nome
        JZ   @@prox
        LODSB
        JMP  @@pula
@@prox: ADD  SI, 2
        JMP  @@entrada
@@fim:  MOV  AH, 4Ch
        INT  21h
END inicio
```

```exercicio
id: a43-4
titulo: Despacho com CALL indireto
nivel: 2
exigir: CALL
proibir: JE, JZ, JNE, JNZ
--- enunciado
Um shell mais simples numera os comandos: 0 = DIR, 1 = ECO, 2 = VER, 3 = HORA. O número chega em **numero** (DB). As rotinas já estão prontas e a **tabela** tem o endereço de cada uma.

Chame a rotina do número com um **CALL indireto** pela tabela (sem comparar o número com cada valor: os saltos `JE`/`JNE`/`JZ`/`JNZ` estão proibidos). Se o número for 4 ou mais, não chame nada: grave `'?'` em **resultado**.

Depois da chamada (ou do `'?'`), some 1 a **chamadas**: o teste confere que o programa voltou da rotina.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
numero    DB 0
resultado DB 0
chamadas  DB 0
tabela    DW CMD_DIR, CMD_ECO, CMD_VER, CMD_HORA
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        ; chame tabela[numero * 2], ou resultado = '?' se numero >= 4

        INC  chamadas
        MOV  AX, 4C00h
        INT  21h

CMD_DIR  PROC
        MOV  resultado, 'D'
        RET
CMD_DIR  ENDP
CMD_ECO  PROC
        MOV  resultado, 'E'
        RET
CMD_ECO  ENDP
CMD_VER  PROC
        MOV  resultado, 'V'
        RET
CMD_VER  ENDP
CMD_HORA PROC
        MOV  resultado, 'H'
        RET
CMD_HORA ENDP
END inicio
--- testes
[{ "nome": "0 = DIR", "setup": { "numero": 0 }, "espera": { "mem": { "resultado": 68, "chamadas": 1 }, "pilhaEquilibrada": true } },
 { "nome": "1 = ECO", "setup": { "numero": 1 }, "espera": { "mem": { "resultado": 69, "chamadas": 1 } } },
 { "nome": "2 = VER", "setup": { "numero": 2 }, "espera": { "mem": { "resultado": 86, "chamadas": 1 } } },
 { "nome": "3 = HORA", "setup": { "numero": 3 }, "espera": { "mem": { "resultado": 72, "chamadas": 1 }, "pilhaEquilibrada": true } },
 { "nome": "4 não existe", "setup": { "numero": 4 }, "espera": { "mem": { "resultado": 63, "chamadas": 1 } } },
 { "nome": "200 não existe", "setup": { "numero": 200 }, "espera": { "mem": { "resultado": 63, "chamadas": 1 } } }]
--- dicas
Primeiro o limite: CMP numero,4 / JAE invalido (comparação sem sinal: 200 também é inválido).
Cada endereço tem 2 bytes: BX = numero × 2 (MOV BL,numero / XOR BH,BH / SHL BX,1).
CALL tabela[BX] lê o endereço na tabela e chama a rotina. Depois, JMP SHORT para o INC chamadas, pulando o MOV resultado,'?'.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
numero    DB 0
resultado DB 0
chamadas  DB 0
tabela    DW CMD_DIR, CMD_ECO, CMD_VER, CMD_HORA
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        CMP  numero, 4
        JAE  @@invalido
        MOV  BL, numero
        XOR  BH, BH
        SHL  BX, 1
        CALL tabela[BX]
        JMP  SHORT @@conta
@@invalido:
        MOV  resultado, '?'
@@conta:
        INC  chamadas
        MOV  AX, 4C00h
        INT  21h

CMD_DIR  PROC
        MOV  resultado, 'D'
        RET
CMD_DIR  ENDP
CMD_ECO  PROC
        MOV  resultado, 'E'
        RET
CMD_ECO  ENDP
CMD_VER  PROC
        MOV  resultado, 'V'
        RET
CMD_VER  ENDP
CMD_HORA PROC
        MOV  resultado, 'H'
        RET
CMD_HORA ENDP
END inicio
```

```exercicio
id: a43-5
titulo: Montar a cauda de comando
nivel: 3
--- enunciado
Os argumentos estão em **argumentos**, um texto terminado em 0 (já sem os espaços do começo). Monte em **cauda** a linha de comando no formato do PSP, como o `EXTERNO` do shell faz:

- sem argumentos (o texto é só o 0): `cauda` = **0, 13**;
- com argumentos: o tamanho, um espaço, o texto e um 13. O tamanho conta o espaço e o texto, mas não o 13.

Por exemplo, para `"1"`: cauda = 2, `' '`, `'1'`, 13.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
argumentos DB 40 DUP (0)
cauda      DB 64 DUP (0FFh)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET argumentos

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "SETOR 1", "setup": { "argumentos": "1" }, "espera": { "mem": { "cauda": [2, 32, 49, 13] } } },
 { "nome": "TIPO LEIAME.TXT", "setup": { "argumentos": "LEIAME.TXT" }, "espera": { "mem": { "cauda": [11, 32, 76, 69, 73, 65, 77, 69, 46, 84, 88, 84, 13] } } },
 { "nome": "espaços no meio ficam", "setup": { "argumentos": "a  b" }, "espera": { "mem": { "cauda": [5, 32, 97, 32, 32, 98, 13] } } },
 { "nome": "sem argumentos", "espera": { "mem": { "cauda": [0, 13] } } }]
--- dicas
Use DI = OFFSET cauda + 1 para escrever o texto e um contador (CL) que começa em 0. O tamanho vai para [cauda] só no fim.
Se [SI] = 0, pule direto para o fim. Senão grave o espaço, INC DI, INC CL, e copie os caracteres até o 0 (LODSB / STOSB / INC CL).
No fim: MOV BYTE PTR [DI],13 e MOV cauda,CL. Se usar STOSB, lembre que ES precisa ser igual a DS (o programa já faz isso).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
argumentos DB 40 DUP (0)
cauda      DB 64 DUP (0FFh)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET argumentos
        MOV  DI, OFFSET cauda+1
        CLD
        XOR  CL, CL
        CMP  BYTE PTR [SI], 0
        JE   @@fim
        MOV  AL, ' '
        STOSB
        INC  CL
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        STOSB
        INC  CL
        JMP  @@car
@@fim:  MOV  BYTE PTR [DI], 13
        MOV  cauda, CL
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## Desafios

Ideias para levar o shell adiante (sem verificador: teste no disquete do MINIOS da [aula 44](aula:aula44), trocando o bloco `SHELL.ASM` pelo seu):

1. **Histórico de um comando.** Guarde a última linha digitada. Se o usuário apertar F3 (como no DOS) ou a seta para cima, ponha a linha de volta no buffer. Dica: a 0Ah do kernel não aceita isso; você vai precisar ler as teclas uma a uma com a INT 16h e escrever a sua própria rotina de edição de linha ([teclado, no livro](livro:cap06)).
2. **PROMPT.** Um comando `PROMPT texto` que guarda o texto; na hora de mostrar o prompt, troque `$T` pela hora (com o `ESCREVE_BCD`), `$V` pela versão e `$G` por `>`.
3. **Só programas.** Recuse rodar arquivos cuja extensão não seja `.COM`, com uma mensagem como "Não é um programa". Assim `LEIAME.TXT` digitado como comando não vira código.
4. **HORA sem relógio.** Teste o CF depois da INT 1Ah. Se o relógio não existir (PC XT), calcule a hora pelos tiques em 0040:006Ch (18,2 por segundo, 65.543 por hora) ([o tempo, no livro](livro:cap07)).
5. **Código de saída.** Depois de um programa externo, a função 4Dh do kernel devolve o código de saída (o AL da 4Ch). Mostre-o quando não for zero, ou crie uma variável como o `ERRORLEVEL` dos `.BAT`.

## No livro

- [O DOS por dentro](livro:cap22): o `COMMAND.COM` com as suas partes residente, transiente e de inicialização, o PSP e a cauda de comando, a função 4Bh com o bloco de parâmetros e a comparação com o MINIOS.
- [Sem DOS: o boot, o setor de boot e o kernel](livro:cap21): quem carrega o shell e como o kernel prepara os segmentos e a pilha antes de saltar para ele.
- [O tempo](livro:cap07): a INT 1Ah, o relógio de tempo real em BCD e os tiques da BIOS em 0040:006Ch.
- [Equipamento e memória](livro:cap08): a INT 12h que o `MEM` usa.
- [Boot e ROMs](livro:cap12): a INT 19h do `REINICIA`.
- [Vídeo I](livro:cap03): a troca de modo que o `LIMPA` usa para apagar a tela.

:::resumo
- O shell é um programa comum (`SHELL.COM`), carregado pelo kernel em 2000:0100. Ele só usa a INT 21h e a BIOS. Se terminar, o kernel o roda de novo.
- O laço: prompt → função 0Ah → `SEPARA` → tabela → rotina interna (`CALL BX`) ou programa externo (4Bh) → prompt.
- O buffer da 0Ah: máximo, quantos vieram, texto e 13. O `SEPARA` troca o 13 por 0, pula espaços, copia o comando em maiúsculas (até 12 letras) e deixa SI nos argumentos, que não são convertidos.
- A tabela de comandos guarda pares "nome terminado em 0 + endereço" e termina com um nome vazio. A `IGUAIS` responde no ZF e sempre deixa SI depois do nome. Acrescentar um comando é uma rotina e uma entrada.
- Internos: `DIR` (função 80h do MINIOS), `TIPO` (81h, buffer em 5000h, para no Ctrl+Z), `LIMPA` (modo 03h), `VER` (30h), `MEM` (INT 12h), `HORA` (INT 1Ah em BCD), `ECO`, `REINICIA` (INT 19h) e `DESLIGA` (CLI + HLT).
- Externos: o nome ganha `.COM` se não tiver ponto; a cauda vai no formato do PSP (tamanho, espaço, texto, 13); a 4Bh só volta quando o programa termina; o kernel restaura os vetores. Erros com CF = 1: 2 (não achei) e 8 (níveis demais).
- O `COMMAND.COM` tem muito mais (PATH, .BAT, redirecionamento, ambiente, PROMPT) e se divide em parte residente (INT 22h-24h, pequena) e transiente (o interpretador, no alto da memória, recarregado se for sobrescrito). Internos são os comandos pequenos e frequentes; externos, os grandes e raros.
:::
