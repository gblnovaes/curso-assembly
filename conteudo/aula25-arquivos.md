---
id: aula25
numero: 25
modulo: 10
titulo: Arquivos com handles
subtitulo: Criar, abrir, ler, gravar e posicionar arquivos com a INT 21h
duracao: 90 min
objetivos: escrever nomes de arquivo como strings ASCIIZ; criar, abrir, ler, gravar e fechar arquivos com as funções 3Ch a 3Fh, 40h e 3Eh; tratar erros pelo CF e pelo código em AX; ler um arquivo inteiro em pedaços até AX = 0; usar os handles padrão 0 a 4 e escrever na tela com o handle 1; posicionar o ponteiro com 42h e descobrir o tamanho de um arquivo; apagar, renomear e ler atributos com 41h, 56h e 43h
---

## O disco, finalmente

Até aqui os nossos programas nasciam e morriam sem deixar rastro: tudo o que calculavam sumia quando o DOS retomava o controle. Programas de verdade guardam coisas. Um editor salva o texto, um jogo guarda a pontuação máxima, um compilador lê o `.ASM` e grava o `.OBJ`. Nesta aula você vai aprender a conversar com o disco pelo DOS.

O DOS oferece **dois** jeitos de mexer em arquivos:

- **FCBs** (File Control Blocks), herdados do CP/M e do DOS 1.0. O programa monta uma estrutura de 37 bytes com o nome do arquivo e o DOS a preenche. Não aceitam diretórios e são trabalhosos.
- **Handles**, introduzidos no **DOS 2.0** junto com os subdiretórios. O programa passa o nome, o DOS devolve um **número** (o handle) e todas as operações seguintes usam esse número. É o jeito que estudaremos, e o único que você deve usar em programas novos.

:::anos90 Uma ideia emprestada do Unix
O DOS 2.0, de 1983, trouxe subdiretórios, handles, redirecionamento com `>` e `<` e pipes com `|`. Tudo isso vinha do Unix, que a Microsoft conhecia bem: ela vendia o Xenix, a sua versão do Unix, na mesma época. Os handles são os "descritores de arquivo" do Unix com outro nome, inclusive com os números 0, 1 e 2 para entrada, saída e erro.
:::

## Nomes ASCIIZ

As funções de handle recebem o nome do arquivo como uma **string ASCIIZ**: os caracteres seguidos de um byte **zero**. Nada de `$` aqui.

```asm fragmento
nome    DB 'POEMA.TXT', 0               ; certo: termina em 0
nome2   DB 'C:\POEMA.TXT', 0            ; com unidade e diretório
errado  DB 'POEMA.TXT$'                 ; ERRADO: o DOS procuraria um nome sem fim
```

O nome segue a regra **8.3** do DOS: até 8 caracteres, um ponto e até 3 de extensão, sem espaços. Maiúsculas e minúsculas tanto faz: o DOS converte tudo para maiúsculas.

:::dica O disco C: do curso
O simulador tem um disco C: virtual, com alguns arquivos de exemplo (`LEIAME.TXT`, `POEMA.TXT`, `NUMEROS.TXT` e `CONFIG.SYS`). Os seus programas podem ler, criar e apagar arquivos nele, e tudo fica salvo no seu computador. No laboratório, a aba **Disco C:** mostra os arquivos e deixa você ver, editar e criar arquivos à mão. Esse disco não tem subdiretórios: use nomes sem `\` ou com `C:\` na frente.
:::

## As funções de arquivo

| AH | Função | Entrada | Saída (se CF = 0) |
|----|--------|---------|-------------------|
| 3Ch | Criar (ou zerar) | DS:DX = nome, CX = atributos | AX = handle |
| 3Dh | Abrir | DS:DX = nome, AL = modo | AX = handle |
| 3Eh | Fechar | BX = handle | |
| 3Fh | Ler | BX = handle, CX = quantos bytes, DS:DX = buffer | AX = bytes lidos |
| 40h | Gravar | BX = handle, CX = quantos bytes, DS:DX = dados | AX = bytes gravados |
| 41h | Apagar | DS:DX = nome | |
| 42h | Posicionar | BX = handle, AL = origem, CX:DX = deslocamento | DX:AX = nova posição |
| 43h | Atributos | DS:DX = nome, AL = 0 (ler) ou 1 (gravar), CX = atributos | CX = atributos |
| 56h | Renomear | DS:DX = nome antigo, ES:DI = nome novo | |

O **modo** de abertura (AL na função 3Dh) diz o que você pretende fazer:

| AL | Modo |
|----|------|
| 0 | só leitura |
| 1 | só gravação |
| 2 | leitura e gravação |

A função **3Ch** cria o arquivo se ele não existe e **zera** o arquivo se ele já existe (o conteúdo antigo se perde). Ela sempre abre para leitura e gravação. Em CX vão os atributos do arquivo novo; quase sempre CX = 0 (arquivo normal).

## Erros: CF e AX

Mexer com disco dá errado de muitas formas: o arquivo não existe, o disco está protegido, acabaram os handles. Todas as funções de arquivo usam a mesma convenção:

- **CF = 0**: deu certo, e AX tem o resultado (o handle, a quantidade de bytes...).
- **CF = 1**: deu errado, e **AX tem o código do erro**.

```asm fragmento
        MOV  AX, 3D00h          ; abrir para leitura
        LEA  DX, nome
        INT  21h
        JC   erro               ; CF = 1: AX é o código do erro
        MOV  handle, AX         ; CF = 0: AX é o handle
```

Os códigos mais comuns:

| Código | Significado |
|--------|-------------|
| 1 | função inválida |
| 2 | arquivo não encontrado |
| 3 | caminho não encontrado (diretório que não existe, nome inválido) |
| 4 | handles esgotados (arquivos abertos demais) |
| 5 | acesso negado (arquivo somente leitura, disco protegido) |
| 6 | handle inválido (fechado ou nunca aberto) |
| 12 (0Ch) | modo de acesso inválido |

:::atencao Teste o CF sempre, logo depois do INT 21h
Se você ignorar o CF e a abertura falhar, AX terá um **código de erro** (por exemplo, 2) e o programa vai usá-lo como handle. Ler do "handle 2" é ler do dispositivo de erro padrão, e gravar nele escreve na tela. O programa não trava: ele faz coisas estranhas em silêncio, que é pior. Faça o `JC` logo em seguida, antes de qualquer instrução que mexa nas flags.
:::

No laboratório, quando uma função do DOS devolve erro, a aba **Mensagens** mostra o código e o significado. Isso ajuda muito a descobrir por que um arquivo "não abre".

## O primeiro arquivo

O programa abaixo cria `NOTAS.TXT` e grava duas linhas nele. Execute e depois abra a aba **Disco C:** do laboratório para ver o arquivo novo.

```asm executar titulo="CRIA.ASM: criando um arquivo de texto"
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'NOTAS.TXT', 0
texto   DB 'Assembly 8086', 13, 10
        DB 'Primeiro arquivo gravado por mim!', 13, 10
TAMANHO EQU $ - texto           ; quantos bytes gravar
handle  DW ?
ok      DB 'Arquivo NOTAS.TXT criado.$'
falha   DB 'Erro ao criar o arquivo.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AH, 3Ch            ; criar
        XOR  CX, CX             ; atributo normal
        LEA  DX, nome
        INT  21h
        JC   erro
        MOV  handle, AX

        MOV  AH, 40h            ; gravar
        MOV  BX, handle
        MOV  CX, TAMANHO
        LEA  DX, texto
        INT  21h
        JC   erro

        MOV  AH, 3Eh            ; fechar
        MOV  BX, handle
        INT  21h

        LEA  DX, ok
        JMP  SHORT mostra
erro:   LEA  DX, falha
mostra: MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Repare em três detalhes:

1. **`TAMANHO EQU $ - texto`** calcula o número de bytes na hora da montagem. Se você mudar o texto, o tamanho acompanha.
2. As linhas terminam em **13, 10** (CR LF), a quebra de linha do DOS. Um arquivo de texto do DOS é só uma sequência de bytes; não existe "linha" no disco, só os bytes 13 e 10 que os programas interpretam.
3. O arquivo é **fechado** no fim. Fechar é o que garante que tudo foi gravado e devolve o handle ao DOS.

:::cpu O que o DOS faz quando você fecha
O DOS não grava cada byte no disco no momento em que você chama a função 40h. Ele junta os dados em **buffers** na memória (a linha `BUFFERS=` do `CONFIG.SYS` diz quantos) e só grava setores inteiros. Ao fechar o arquivo, ele grava o que sobrou nos buffers e atualiza o tamanho e a data no diretório. Um programa que termina sem fechar o arquivo pode deixá-lo com tamanho errado ou com o fim faltando. O DOS fecha os handles abertos quando o programa termina com 4Ch, mas não conte com isso: feche sempre.
:::

## Lendo um arquivo inteiro

Ler é o inverso: abrir, ler em um buffer, fechar. O problema é que você raramente sabe o tamanho do arquivo, e o buffer tem tamanho fixo. A solução clássica é ler **em pedaços**, num laço:

```diagrama titulo="O laço de leitura"
        abrir ──► ler até N bytes ──► AX = 0? ──sim──► fechar
                       ▲                │ não
                       │                ▼
                       └──── processar AX bytes
```

A função 3Fh devolve em AX **quantos bytes leu de verdade**. Normalmente é o que você pediu, mas no último pedaço é menos, e quando o arquivo acabou é **zero**. Não existe "erro de fim de arquivo": AX = 0 com CF = 0 é o sinal de que acabou.

O programa abaixo é o comando `TYPE` do DOS em miniatura: mostra o conteúdo de `POEMA.TXT` na tela.

```asm executar titulo="TIPO.ASM: mostrando um arquivo na tela"
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'POEMA.TXT', 0
handle  DW ?
buffer  DB 32 DUP(?)            ; lê de 32 em 32 bytes
falha   DB 'Nao consegui abrir o arquivo.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 3D00h          ; abrir só para leitura
        LEA  DX, nome
        INT  21h
        JC   erro
        MOV  handle, AX

le:     MOV  AH, 3Fh            ; ler até 32 bytes
        MOV  BX, handle
        MOV  CX, 32
        LEA  DX, buffer
        INT  21h
        JC   fecha
        TEST AX, AX             ; AX = 0: fim do arquivo
        JZ   fecha

        MOV  CX, AX             ; grava só o que foi lido
        MOV  AH, 40h
        MOV  BX, 1              ; handle 1 = saída padrão (a tela)
        LEA  DX, buffer
        INT  21h
        JMP  le

fecha:  MOV  AH, 3Eh
        MOV  BX, handle
        INT  21h
        MOV  AX, 4C00h
        INT  21h

erro:   MOV  AH, 09h
        LEA  DX, falha
        INT  21h
        MOV  AX, 4C01h          ; código de saída 1: falhou
        INT  21h
END inicio
```

Experimente trocar o nome para um arquivo que não existe e veja a mensagem de erro. Troque também o tamanho do buffer para 5 e acompanhe no depurador: o laço roda mais vezes, mas o resultado é o mesmo.

:::atencao MOV CX,AX, e não MOV CX,32
No último pedaço a função 3Fh lê menos que 32 bytes. Se você gravar sempre 32, o fim do buffer ainda tem bytes do pedaço anterior, e eles aparecem repetidos no fim da saída. É um erro clássico.
:::

## Os handles padrão

Quando um programa começa, o DOS já deixa **cinco handles abertos**:

| Handle | Nome | Dispositivo normal |
|--------|------|--------------------|
| 0 | entrada padrão (stdin) | teclado |
| 1 | saída padrão (stdout) | tela |
| 2 | erro padrão (stderr) | tela |
| 3 | auxiliar (stdaux) | porta serial COM1 |
| 4 | impressora (stdprn) | LPT1 |

Por isso o primeiro arquivo que você abre recebe o handle **5**. No `TIPO.ASM` usamos o handle 1 para escrever na tela com a mesma função 40h que grava em arquivos. Para o DOS, a tela é só mais um "arquivo".

Isso tem uma consequência bonita. Se o usuário digitar `TIPO > COPIA.TXT` no prompt, o COMMAND.COM troca o handle 1 por um arquivo antes de rodar o programa, e o mesmo código passa a gravar no disco sem saber disso. É o **redirecionamento**. O handle 2 continua indo para a tela, e é por isso que as mensagens de erro devem ir por ele: elas aparecem mesmo quando a saída foi redirecionada.

Ler do handle 0 lê do teclado. O DOS entrega uma **linha inteira** de cada vez: espera o Enter (mostrando o que é digitado) e devolve os caracteres seguidos de 13 e 10.

```asm executar titulo="ECO0.ASM: lendo do handle 0"
.MODEL SMALL
.STACK 100h
.DATA
pede    DB 'Digite algo: $'
linha   DB 80 DUP(?)
lidos   DW ?
diz     DB 'Voce digitou $'
bytes   DB ' bytes (contando o CR e o LF).$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AH, 09h
        LEA  DX, pede
        INT  21h

        MOV  AH, 3Fh            ; ler do handle 0 (teclado)
        XOR  BX, BX
        MOV  CX, 80
        LEA  DX, linha
        INT  21h
        MOV  lidos, AX

        MOV  AH, 09h
        LEA  DX, diz
        INT  21h
        MOV  AX, lidos          ; imprime o número (até 99)
        MOV  BL, 10
        DIV  BL                 ; AL = dezenas, AH = unidades
        ADD  AX, 3030h
        MOV  BX, AX
        MOV  DL, BL
        MOV  AH, 02h
        INT  21h
        MOV  DL, BH
        INT  21h
        MOV  AH, 09h
        LEA  DX, bytes
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Os nomes de dispositivo também funcionam como arquivos: abrir `CON` dá acesso ao console, e gravar em `NUL` joga os dados fora (útil para testes).

## Mostrando o motivo do erro

Um programa educado diz **por que** falhou. Como os códigos são números pequenos, uma **tabela de endereços** resolve sem uma fila de `CMP`:

```asm executar titulo="ERROS.ASM: explicando o código de erro"
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'SUMIU.TXT', 0
m_outro DB 'erro desconhecido$'
m_func  DB 'funcao invalida$'
m_arq   DB 'arquivo nao encontrado$'
m_cam   DB 'caminho nao encontrado$'
m_hand  DB 'arquivos abertos demais$'
m_aces  DB 'acesso negado$'
m_hinv  DB 'handle invalido$'
tabela  DW m_outro, m_func, m_arq, m_cam, m_hand, m_aces, m_hinv
prefixo DB 'Erro: $'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 3D00h
        LEA  DX, nome
        INT  21h
        JNC  fim                ; abriu: nada a explicar

        CMP  AX, 6              ; código fora da tabela?
        JBE  @@ok
        XOR  AX, AX             ; usa a mensagem 0
@@ok:   MOV  BX, AX
        SHL  BX, 1              ; cada entrada tem 2 bytes
        MOV  AH, 09h
        LEA  DX, prefixo
        INT  21h
        MOV  DX, tabela[BX]     ; endereço da mensagem certa
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

:::dica Por que SHL BX,1
A tabela tem words (DW), então a entrada número 2 está no byte 4. Multiplicar o índice por 2 é exatamente um deslocamento de 1 bit, como vimos nas aulas de vetores.
:::

## O ponteiro do arquivo e a função 42h

Cada handle tem um **ponteiro de posição**: o número do próximo byte que será lido ou gravado. Ele começa em 0 ao abrir e avança sozinho a cada leitura ou gravação. A função **42h** (LSEEK) move o ponteiro:

- **BX** = handle
- **AL** = de onde contar: 0 = do início, 1 = da posição atual, 2 = do fim
- **CX:DX** = deslocamento de 32 bits (CX é a parte alta), com sinal nas origens 1 e 2
- Devolve **DX:AX** = a nova posição, contada do início

Dois usos são clássicos:

```asm fragmento
; descobrir o tamanho: ir para o fim (deslocamento 0 a partir do fim)
        MOV  AX, 4202h          ; AH = 42h, AL = 2 (do fim)
        MOV  BX, handle
        XOR  CX, CX
        XOR  DX, DX
        INT  21h                ; DX:AX = tamanho do arquivo

; voltar ao começo para ler de novo
        MOV  AX, 4200h          ; AL = 0 (do início)
        XOR  CX, CX
        XOR  DX, DX
        INT  21h
```

Para **acrescentar** dados ao fim de um arquivo existente, abra para gravação (3Dh com AL = 1 ou 2, **não** 3Ch, que zeraria o arquivo), mova o ponteiro para o fim e grave.

```asm executar titulo="TAMANHO.ASM: o tamanho de POEMA.TXT"
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'POEMA.TXT', 0
msg     DB 'POEMA.TXT tem $'
bytes   DB ' bytes.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3D00h
        LEA  DX, nome
        INT  21h
        JC   fim
        MOV  BX, AX             ; BX = handle

        MOV  AX, 4202h          ; ponteiro para o fim
        XOR  CX, CX
        XOR  DX, DX
        INT  21h                ; DX:AX = tamanho (aqui DX = 0)
        PUSH AX

        MOV  AH, 3Eh            ; fecha (BX ainda é o handle)
        INT  21h

        MOV  AH, 09h
        LEA  DX, msg
        INT  21h
        POP  AX
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        LEA  DX, bytes
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h

; IMPRIMIR_NUMERO: imprime AX (0..65535) em decimal
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

:::cpu Por que 32 bits
Um arquivo pode passar de 64 KB, então posições e tamanhos precisam de 32 bits. O 8086 não tem registradores de 32 bits, e o DOS usa pares: **CX:DX** na entrada e **DX:AX** na saída. É a mesma convenção do `MUL` e do `DIV` de 16 bits, e as rotinas de 32 bits da aula 21 servem para imprimir esses valores.
:::

## Copiando um arquivo

Juntando tudo: abrir a origem, criar o destino e, num laço, ler um pedaço de um e gravar no outro. Este é o esqueleto do comando `COPY`:

```asm executar titulo="COPIA.ASM: copiando POEMA.TXT para POEMA.BAK"
.MODEL SMALL
.STACK 100h
.DATA
origem  DB 'POEMA.TXT', 0
destino DB 'POEMA.BAK', 0
h_orig  DW ?
h_dest  DW ?
buffer  DB 64 DUP(?)
ok      DB 'Copiado.$'
falha   DB 'Erro na copia.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 3D00h          ; abre a origem para leitura
        LEA  DX, origem
        INT  21h
        JC   erro
        MOV  h_orig, AX

        MOV  AH, 3Ch            ; cria o destino
        XOR  CX, CX
        LEA  DX, destino
        INT  21h
        JC   erro_fecha
        MOV  h_dest, AX

copia:  MOV  AH, 3Fh            ; lê um pedaço da origem
        MOV  BX, h_orig
        MOV  CX, 64
        LEA  DX, buffer
        INT  21h
        JC   fim_copia
        MOV  CX, AX             ; quantos bytes vieram
        JCXZ fim_copia          ; zero: acabou
        MOV  AH, 40h            ; grava o mesmo tanto no destino
        MOV  BX, h_dest
        LEA  DX, buffer
        INT  21h
        JMP  copia

fim_copia:
        MOV  AH, 3Eh
        MOV  BX, h_dest
        INT  21h
        MOV  AH, 3Eh
        MOV  BX, h_orig
        INT  21h
        LEA  DX, ok
        JMP  SHORT mostra

erro_fecha:
        MOV  AH, 3Eh            ; a origem já estava aberta
        MOV  BX, h_orig
        INT  21h
erro:   LEA  DX, falha
mostra: MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Repare no caminho de erro `erro_fecha`: se a criação do destino falhar, a origem **já está aberta** e precisa ser fechada. Em programas com vários recursos abertos, o tratamento de erro tem que desfazer exatamente o que foi feito até ali.

:::dica JCXZ de novo
`JCXZ` (aula 7) aparece aqui com um papel natural: AX foi para CX, e se for zero o laço termina. É uma instrução a menos que `TEST AX,AX / JZ`.
:::

## Apagar, renomear e atributos

Três funções completam o kit:

```asm fragmento
; apagar
        MOV  AH, 41h
        LEA  DX, nome           ; DS:DX = nome ASCIIZ
        INT  21h                ; CF = 1 se não existe (2) ou é protegido (5)

; renomear: o nome novo vai em ES:DI
        PUSH DS
        POP  ES                 ; ES = DS (os dois nomes estão nos dados)
        MOV  AH, 56h
        LEA  DX, antigo
        LEA  DI, novo
        INT  21h                ; erro 5 se o nome novo já existe

; ler os atributos
        MOV  AX, 4300h
        LEA  DX, nome
        INT  21h                ; CX = atributos
```

Os **atributos** são bits guardados no diretório, junto do nome:

| Bit | Valor | Atributo |
|-----|-------|----------|
| 0 | 01h | somente leitura |
| 1 | 02h | oculto |
| 2 | 04h | sistema |
| 3 | 08h | rótulo do volume |
| 4 | 10h | diretório |
| 5 | 20h | arquivo (modificado desde o último backup) |

Um arquivo com o bit 0 ligado não pode ser aberto para gravação, zerado nem apagado: as funções devolvem o erro 5. É o que o comando `ATTRIB +R` faz.

:::anos90 FILES=20
Cada arquivo aberto ocupa uma entrada numa tabela interna do DOS, cujo tamanho é definido pela linha `FILES=` do `CONFIG.SYS`. O padrão era só 8, contando os 5 handles já abertos de cada programa, e muitos instaladores de jogos e de bancos de dados pediam para o usuário colocar `FILES=20` ou `FILES=30` e reiniciar. Além disso, cada programa tem a sua própria tabela de 20 handles dentro do PSP (assunto da próxima aula). Por isso o erro 4, "handles esgotados", era comum em programas que abriam arquivos e esqueciam de fechar.
:::

```quiz
? Como termina uma string ASCIIZ?
- Com o caractere $
+ Com um byte zero
- Com CR e LF
> As funções de arquivo (3Ch, 3Dh, 41h, 43h, 56h...) recebem o nome terminado em byte 0. O $ é só para a função 09h.

? A função 3Fh devolveu CF = 0 e AX = 0. O que isso significa?
- Erro: o handle é inválido
+ O arquivo chegou ao fim: não havia mais bytes para ler
- Foi lido o byte 0
> Fim de arquivo não é erro. AX diz quantos bytes vieram; zero quer dizer que acabou.

? Você abriu um arquivo com sucesso e é o primeiro arquivo do programa. Que handle o DOS devolve, normalmente?
- 0
- 1
+ 5
> Os handles 0 a 4 já vêm abertos (entrada, saída, erro, auxiliar e impressora).

? Você quer acrescentar linhas ao fim de RELATO.TXT, que já existe. Qual é o caminho certo?
- Criar com 3Ch e gravar
+ Abrir com 3Dh para gravação, mover o ponteiro para o fim com 42h (AL = 2) e gravar
- Abrir com 3Dh e gravar direto
> 3Ch zeraria o arquivo. Abrindo com 3Dh, o ponteiro começa em 0 e a gravação escreveria por cima do começo.

? A abertura falhou e o programa ignorou o CF, usando AX como handle. AX era 2 (arquivo não encontrado). O que acontece ao gravar nesse "handle"?
- O PC trava
- O DOS cria o arquivo
+ Os dados vão para o erro padrão, ou seja, a tela
> O código de erro 2 coincide com o handle 2 (stderr). O programa não trava: faz a coisa errada em silêncio.

? Como a função 42h devolve a nova posição do ponteiro?
- Em AX, porque arquivos têm no máximo 64 KB
+ Em DX:AX, um número de 32 bits
- Em CX:DX
> Posições e tamanhos têm 32 bits. A entrada é CX:DX e a saída é DX:AX.
```

## Exercícios

```exercicio
id: a25-1
titulo: Gravar uma saudação
nivel: 1
--- enunciado
Crie o arquivo **SAUDACAO.TXT** contendo exatamente o texto `Ola, disco!` seguido de CR e LF (13 e 10), e **feche** o arquivo. Se o arquivo já existir, o conteúdo antigo deve sumir.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'SAUDACAO.TXT', 0
texto   DB 'Ola, disco!', 13, 10
handle  DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        ; crie, grave e feche

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "disco vazio", "espera": { "arquivos": { "SAUDACAO.TXT": "Ola, disco!\r\n" }, "arquivosFechados": true } },
 { "nome": "o arquivo já existia, com outro texto", "arquivos": { "SAUDACAO.TXT": "texto antigo e bem mais comprido que o novo" }, "espera": { "arquivos": { "SAUDACAO.TXT": "Ola, disco!\r\n" }, "arquivosFechados": true } }]
--- dicas
A função 3Ch cria o arquivo (ou zera, se ele existir). CX = 0, DS:DX = nome. O handle vem em AX.
Grave com AH = 40h: BX = handle, CX = 13 (11 letras + CR + LF), DS:DX = texto. Você pode usar EQU $ - texto para não contar à mão.
Feche com AH = 3Eh e BX = handle.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'SAUDACAO.TXT', 0
texto   DB 'Ola, disco!', 13, 10
TAM     EQU $ - texto
handle  DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AH, 3Ch
        XOR  CX, CX
        LEA  DX, nome
        INT  21h
        JC   fim
        MOV  handle, AX
        MOV  AH, 40h
        MOV  BX, handle
        MOV  CX, TAM
        LEA  DX, texto
        INT  21h
        MOV  AH, 3Eh
        MOV  BX, handle
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a25-2
titulo: Contar linhas
nivel: 2
--- enunciado
Leia o arquivo **DADOS.TXT** inteiro e guarde em **linhas** a quantidade de bytes **10** (LF) que ele contém. O arquivo pode ser maior que o buffer: leia em pedaços até a função 3Fh devolver 0. Feche o arquivo no fim.

Se DADOS.TXT não existir, deixe **linhas = 0FFFFh** e termine normalmente.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'DADOS.TXT', 0
handle  DW ?
linhas  DW 0
buffer  DB 64 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        ; abra, conte os bytes 10 e feche

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "três linhas", "arquivos": { "DADOS.TXT": "um\r\ndois\r\ntres\r\n" }, "espera": { "mem": { "linhas": 3 }, "arquivosFechados": true } },
 { "nome": "última linha sem quebra", "arquivos": { "DADOS.TXT": "a\r\nb" }, "espera": { "mem": { "linhas": 1 }, "arquivosFechados": true } },
 { "nome": "arquivo vazio", "arquivos": { "DADOS.TXT": "" }, "espera": { "mem": { "linhas": 0 }, "arquivosFechados": true } },
 { "nome": "arquivo grande (vários pedaços)", "arquivos": { "DADOS.TXT": "linha numero 01 do arquivo\r\nlinha numero 02 do arquivo\r\nlinha numero 03 do arquivo\r\nlinha numero 04 do arquivo\r\nlinha numero 05 do arquivo\r\nlinha numero 06 do arquivo\r\nlinha numero 07 do arquivo\r\nlinha numero 08 do arquivo\r\nlinha numero 09 do arquivo\r\nlinha numero 10 do arquivo\r\nlinha numero 11 do arquivo\r\nlinha numero 12 do arquivo\r\n" }, "espera": { "mem": { "linhas": 12 }, "arquivosFechados": true } },
 { "nome": "arquivo inexistente", "espera": { "mem": { "linhas": 65535 } } }]
--- dicas
Abra com AX = 3D00h. Se CF = 1, coloque 0FFFFh em linhas e vá para o fim.
No laço: AH = 3Fh, BX = handle, CX = 64, DS:DX = buffer. Se AX = 0, acabou.
Para percorrer o pedaço lido: CX = AX bytes, SI aponta para o buffer. Para cada byte, CMP BYTE PTR [SI],10 e, se for igual, INC linhas.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'DADOS.TXT', 0
handle  DW ?
linhas  DW 0
buffer  DB 64 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3D00h
        LEA  DX, nome
        INT  21h
        JNC  abriu
        MOV  linhas, 0FFFFh
        JMP  SHORT fim
abriu:  MOV  handle, AX
le:     MOV  AH, 3Fh
        MOV  BX, handle
        MOV  CX, 64
        LEA  DX, buffer
        INT  21h
        JC   fecha
        MOV  CX, AX
        JCXZ fecha
        LEA  SI, buffer
conta:  CMP  BYTE PTR [SI], 10
        JNE  @@prox
        INC  linhas
@@prox: INC  SI
        LOOP conta
        JMP  le
fecha:  MOV  AH, 3Eh
        MOV  BX, handle
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a25-3
titulo: Copiar arquivo
nivel: 2
--- enunciado
Copie **ORIGEM.TXT** para **DESTINO.TXT**, byte a byte, criando o destino (ou zerando, se já existir). O arquivo pode ter qualquer tamanho, inclusive zero, e o buffer tem só 32 bytes. Feche os dois arquivos.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
origem  DB 'ORIGEM.TXT', 0
destino DB 'DESTINO.TXT', 0
h_orig  DW ?
h_dest  DW ?
buffer  DB 32 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        ; abra a origem, crie o destino, copie em pedaços, feche os dois

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "texto curto", "arquivos": { "ORIGEM.TXT": "Copie-me!\r\n" }, "espera": { "arquivos": { "DESTINO.TXT": "Copie-me!\r\n", "ORIGEM.TXT": "Copie-me!\r\n" }, "arquivosFechados": true } },
 { "nome": "arquivo vazio", "arquivos": { "ORIGEM.TXT": "" }, "espera": { "arquivos": { "DESTINO.TXT": "" }, "arquivosFechados": true } },
 { "nome": "exatamente 32 bytes", "arquivos": { "ORIGEM.TXT": "0123456789ABCDEFGHIJKLMNOPQRSTUV" }, "espera": { "arquivos": { "DESTINO.TXT": "0123456789ABCDEFGHIJKLMNOPQRSTUV" }, "arquivosFechados": true } },
 { "nome": "101 bytes (último pedaço incompleto)", "arquivos": { "ORIGEM.TXT": "As armas e os baroes assinalados, que da ocidental praia lusitana, por mares nunca de antes navegados", "DESTINO.TXT": "lixo antigo" }, "espera": { "arquivos": { "DESTINO.TXT": "As armas e os baroes assinalados, que da ocidental praia lusitana, por mares nunca de antes navegados" }, "arquivosFechados": true } }]
--- dicas
A ordem é: 3Dh (AL = 0) na origem, 3Ch no destino, laço de 3Fh/40h, dois 3Eh.
Grave exatamente a quantidade que a leitura devolveu em AX, não 32. Senão o último pedaço sai com bytes a mais.
Quando a leitura devolver AX = 0, saia do laço (JCXZ depois de MOV CX,AX é prático).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
origem  DB 'ORIGEM.TXT', 0
destino DB 'DESTINO.TXT', 0
h_orig  DW ?
h_dest  DW ?
buffer  DB 32 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3D00h
        LEA  DX, origem
        INT  21h
        JC   fim
        MOV  h_orig, AX
        MOV  AH, 3Ch
        XOR  CX, CX
        LEA  DX, destino
        INT  21h
        JC   fecha_orig
        MOV  h_dest, AX
copia:  MOV  AH, 3Fh
        MOV  BX, h_orig
        MOV  CX, 32
        LEA  DX, buffer
        INT  21h
        JC   fecha_dest
        MOV  CX, AX
        JCXZ fecha_dest
        MOV  AH, 40h
        MOV  BX, h_dest
        LEA  DX, buffer
        INT  21h
        JMP  copia
fecha_dest:
        MOV  AH, 3Eh
        MOV  BX, h_dest
        INT  21h
fecha_orig:
        MOV  AH, 3Eh
        MOV  BX, h_orig
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a25-4
titulo: Diário de bordo
nivel: 3
--- enunciado
O arquivo **LOG.TXT** guarda um registro que só cresce. Seu programa deve:

1. Abrir LOG.TXT para gravação **sem apagar** o que já existe. Se ele não existir, crie-o.
2. Guardar em **tamanho** (uma variável DD) o tamanho do arquivo **antes** de gravar, em 32 bits.
3. Acrescentar `fim` seguido de CR e LF **no final** do arquivo.
4. Fechar o arquivo.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'LOG.TXT', 0
linha   DB 'fim', 13, 10
handle  DW ?
tamanho DD 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        ; abra (ou crie), vá para o fim, guarde o tamanho, grave e feche

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "acrescenta a um log existente", "arquivos": { "LOG.TXT": "inicio\r\nmeio\r\n" }, "espera": { "mem": { "tamanho": 14 }, "arquivos": { "LOG.TXT": "inicio\r\nmeio\r\nfim\r\n" }, "arquivosFechados": true } },
 { "nome": "log vazio", "arquivos": { "LOG.TXT": "" }, "espera": { "mem": { "tamanho": 0 }, "arquivos": { "LOG.TXT": "fim\r\n" }, "arquivosFechados": true } },
 { "nome": "log ainda não existe", "espera": { "mem": { "tamanho": 0 }, "arquivos": { "LOG.TXT": "fim\r\n" }, "arquivosFechados": true } },
 { "nome": "log de 102 bytes", "arquivos": { "LOG.TXT": "As armas e os baroes assinalados, que da ocidental praia lusitana, por mares nunca de antes navegados\r" }, "espera": { "mem": { "tamanho": 102 }, "arquivos": { "LOG.TXT": "As armas e os baroes assinalados, que da ocidental praia lusitana, por mares nunca de antes navegados\rfim\r\n" }, "arquivosFechados": true } }]
--- dicas
Abra com AX = 3D01h (só gravação) ou 3D02h. Se CF = 1, crie com 3Ch: o arquivo novo tem tamanho 0.
Para ir ao fim: AX = 4202h, BX = handle, CX = 0, DX = 0. A posição volta em DX:AX, que é exatamente o tamanho.
Guarde DX:AX em tamanho com WORD PTR: MOV WORD PTR tamanho,AX / MOV WORD PTR tamanho+2,DX. Depois grave 5 bytes com AH = 40h.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
nome    DB 'LOG.TXT', 0
linha   DB 'fim', 13, 10
handle  DW ?
tamanho DD 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3D01h          ; abre só para gravação
        LEA  DX, nome
        INT  21h
        JNC  abriu
        MOV  AH, 3Ch            ; não existe: cria
        XOR  CX, CX
        LEA  DX, nome
        INT  21h
        JC   fim
abriu:  MOV  handle, AX
        MOV  AX, 4202h          ; ponteiro para o fim
        MOV  BX, handle
        XOR  CX, CX
        XOR  DX, DX
        INT  21h
        MOV  WORD PTR tamanho, AX
        MOV  WORD PTR tamanho+2, DX
        MOV  AH, 40h
        MOV  BX, handle
        MOV  CX, 5
        LEA  DX, linha
        INT  21h
        MOV  AH, 3Eh
        MOV  BX, handle
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Use **handles** (DOS 2.0 em diante), não FCBs. Nomes de arquivo são strings **ASCIIZ** (terminam em 0).
- 3Ch cria ou zera, 3Dh abre (AL = 0 leitura, 1 gravação, 2 as duas), 3Fh lê, 40h grava, 3Eh fecha.
- **CF = 1** indica erro, com o código em AX (2 = não encontrado, 3 = caminho, 4 = handles esgotados, 5 = acesso negado, 6 = handle inválido). Teste o CF logo depois do `INT 21h`.
- Leia em pedaços, num laço, até a função 3Fh devolver **AX = 0**. Grave sempre a quantidade que foi lida.
- Os handles 0 a 4 já vêm abertos; o handle 1 é a tela, e a função 40h com BX = 1 escreve nela (e respeita o redirecionamento).
- 42h move o ponteiro (AL = 0 início, 1 atual, 2 fim) e devolve a posição em DX:AX; ir ao fim com deslocamento 0 dá o tamanho.
- 41h apaga, 56h renomeia (nome novo em ES:DI), 43h lê ou grava os atributos. Feche todo arquivo que abrir.
:::
