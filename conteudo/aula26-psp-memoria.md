---
id: aula26
numero: 26
modulo: 10
titulo: PSP, linha de comando e memória
subtitulo: O que o DOS prepara antes do seu programa e como pedir mais memória
duracao: 90 min
objetivos: conhecer o PSP e os seus campos mais importantes; ler os parâmetros da linha de comando em 80h e separá-los; lembrar que DS e ES apontam para o PSP no início de um .EXE e obter o PSP com AH=62h; usar a DTA e as funções 4Eh e 4Fh para listar arquivos; ler o bloco de ambiente; entender a cadeia de MCBs; encolher o programa com 4Ah e alocar e liberar memória com 48h e 49h
---

## O que existe antes da primeira instrução

Quando você digita `PROGRAMA ARQUIVO.TXT /V` no prompt, muita coisa acontece antes de a primeira instrução do seu código rodar. O COMMAND.COM pede ao DOS para carregar o programa (a função 4Bh, EXEC), e o DOS:

1. Procura um bloco de memória livre e o entrega **inteiro** ao programa.
2. Copia as variáveis de ambiente (`PATH`, `COMSPEC`...) para um bloco próprio.
3. Monta, no início do bloco do programa, uma estrutura de 256 bytes: o **PSP** (Program Segment Prefix).
4. Copia para o PSP o que foi digitado depois do nome do programa.
5. Carrega o código logo depois do PSP, ajusta os registradores e salta para o ponto de entrada.

Nesta aula vamos olhar cada uma dessas peças por dentro: o PSP, a linha de comando, o ambiente e a forma como o DOS controla a memória.

## O PSP

O PSP tem sempre 256 bytes (100h), e é por isso que os programas `.COM` começam com `ORG 100h`: o código vem logo depois dele, no mesmo segmento.

```diagrama titulo="O PSP (Program Segment Prefix), 256 bytes"
  offset  conteúdo
  ──────  ───────────────────────────────────────────────────────
   00h    CD 20 = INT 20h (terminar; um RET num .COM cai aqui)
   02h    segmento do fim da memória do programa (A000h com 640 KB)
   0Ah    endereços de término, Ctrl+Break e erro crítico (INT 22h-24h)
   16h    segmento do PSP do programa pai (quem chamou: o COMMAND.COM)
   18h    tabela de handles do programa (20 bytes, FFh = livre)
   2Ch    segmento do bloco de ambiente
   5Ch    FCB 1: o 1º parâmetro já no formato de FCB
   6Ch    FCB 2: o 2º parâmetro
   80h    tamanho da linha de comando (sem o CR final)
   81h    a linha de comando, terminada em 0Dh (até 127 bytes)
  100h    ── fim do PSP: aqui começa o código de um .COM ──
```

:::anos90 Herança do CP/M
Boa parte do PSP é cópia de uma estrutura do CP/M, o sistema operacional dos micros de 8 bits que o DOS imitou para facilitar a conversão de programas. O `INT 20h` no offset 0, os FCBs em 5Ch e 6Ch e a linha de comando em 80h estão nos mesmos lugares em que os programas do CP/M esperavam encontrá-los. A ideia funcionou: muitos programas de CP/M foram convertidos para o DOS quase de forma mecânica nos primeiros anos do IBM PC.
:::

### Onde está o PSP?

- Num **.COM**, CS = DS = ES = SS = segmento do PSP. Tudo está no mesmo lugar.
- Num **.EXE**, o DOS deixa **DS e ES apontando para o PSP** quando o programa começa. É por isso que todo `.EXE` começa com `MOV AX,@DATA / MOV DS,AX`: DS ainda não aponta para os seus dados.

Esse detalhe é útil: depois do `MOV DS,AX`, **ES continua apontando para o PSP**. Se você precisa ler a linha de comando, faça isso antes de mexer em ES, ou guarde o valor numa variável.

Se você perdeu ES, a função **62h** do DOS devolve o segmento do PSP em **BX** (a 51h faz o mesmo, mas não era documentada nas primeiras versões).

```asm fragmento
        MOV  AH, 62h
        INT  21h            ; BX = segmento do PSP
        MOV  ES, BX
```

## A linha de comando

Tudo o que foi digitado depois do nome do programa vai para o offset **81h** do PSP, e o tamanho (sem contar o CR final) vai no byte **80h**. Para `PROGRAMA ARQUIVO.TXT /V`:

```diagrama titulo="A linha de comando no PSP"
  80h  81h  82h  83h            8Dh  8Eh  8Fh  90h
  ┌───┬────┬────┬────┬─ ··· ─┬────┬────┬────┬────┐
  │0Fh│ ' '│ 'A'│ 'R'│       │ ' '│ '/'│ 'V'│ 0Dh│
  └───┴────┴────┴────┴─ ··· ─┴────┴────┴────┴────┘
   15 bytes, começando pelo espaço que separa o nome do programa
```

Repare que o espaço depois do nome do programa vem junto, e que o COMMAND.COM tira dali os redirecionamentos (`> SAIDA.TXT`) antes de chamar o programa.

O programa abaixo mostra a linha de comando entre colchetes. Neste bloco, ele roda com os parâmetros `ARQUIVO.TXT /V`; no laboratório, você pode digitar outros na caixa **parâmetros**, ao lado da velocidade.

```asm executar titulo="ECO.ASM: mostrando a linha de comando" parametros="ARQUIVO.TXT /V"
.MODEL SMALL
.STACK 100h
.CODE
inicio: ; não precisamos de @DATA aqui: ES aponta para o PSP
        MOV  DL, '['
        MOV  AH, 02h
        INT  21h

        MOV  CL, ES:[80h]       ; tamanho da linha de comando
        XOR  CH, CH
        MOV  SI, 81h            ; primeiro caractere
        JCXZ fecha              ; sem parâmetros
mostra: MOV  DL, ES:[SI]
        MOV  AH, 02h
        INT  21h
        INC  SI
        LOOP mostra

fecha:  MOV  DL, ']'
        MOV  AH, 02h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

### Separando os parâmetros

Quase sempre você quer os parâmetros **um por um**. A regra do DOS é simples: eles são separados por espaços (e às vezes por tabulações). O algoritmo é um pequeno autômato com dois estados, "entre palavras" e "dentro de uma palavra":

```asm executar titulo="ARGS.ASM: um parâmetro por linha" parametros="  primeiro segundo   /terceiro"
.MODEL SMALL
.STACK 100h
.DATA
dentro  DB 0                    ; 1 = estamos dentro de uma palavra
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX             ; ES continua no PSP

        MOV  CL, ES:[80h]
        XOR  CH, CH
        MOV  SI, 81h
        JCXZ fim
proximo:
        MOV  DL, ES:[SI]
        CMP  DL, ' '
        JE   espaco
        CMP  DL, 9              ; tabulação também separa
        JE   espaco
        MOV  dentro, 1          ; um caractere de palavra: mostra
        MOV  AH, 02h
        INT  21h
        JMP  SHORT avanca
espaco: CMP  dentro, 1          ; acabou uma palavra?
        JNE  avanca
        MOV  dentro, 0
        CALL NOVA_LINHA
avanca: INC  SI
        LOOP proximo
        CMP  dentro, 1          ; a última palavra não tem espaço depois
        JNE  fim
        CALL NOVA_LINHA
fim:    MOV  AX, 4C00h
        INT  21h

NOVA_LINHA PROC
        PUSH AX
        PUSH DX
        MOV  AH, 02h
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        POP  DX
        POP  AX
        RET
NOVA_LINHA ENDP
END inicio
```

:::dica Os FCBs ainda ajudam
Para os dois primeiros parâmetros que parecem nomes de arquivo, o COMMAND.COM já fez o trabalho: em 5Ch e 6Ch estão FCBs com o nome separado em 8 + 3 caracteres, completados com espaços (o byte 0 é a unidade, e o nome começa no byte 1). Programas antigos usavam isso para não precisar separar nada. Para opções como `/V`, porém, você precisa da linha de comando de verdade.
:::

## Listando arquivos: a DTA, 4Eh e 4Fh

Para saber **quais** arquivos existem (o que o comando `DIR` faz), o DOS oferece um par de funções:

- **4Eh** (procurar o primeiro): DS:DX = padrão ASCIIZ, como `*.TXT`; CX = atributos que também devem entrar (0 = só arquivos normais).
- **4Fh** (procurar o próximo): continua a busca anterior.

Ambas devolvem CF = 1 quando não há (mais) arquivos, com o código **18** (12h, "não há mais arquivos"). O resultado de cada busca vai para uma área de 43 bytes chamada **DTA** (Disk Transfer Area):

| Offset na DTA | Tamanho | Conteúdo |
|---------------|---------|----------|
| 00h | 21 | uso interno do DOS (o estado da busca) |
| 15h | 1 | atributos do arquivo encontrado |
| 16h | 2 | hora |
| 18h | 2 | data |
| 1Ah | 4 | tamanho (32 bits) |
| 1Eh | 13 | nome no formato `NOME.EXT`, ASCIIZ |

Onde fica a DTA? Por padrão, no offset **80h do PSP**, em cima da linha de comando! A primeira busca destruiria os parâmetros. Por isso os programas definem a sua própria DTA com a função **1Ah** (DS:DX = endereço da nova DTA). A função 2Fh devolve a DTA atual em ES:BX.

```asm executar titulo="DIR.ASM: um DIR em miniatura"
.MODEL SMALL
.STACK 100h
.DATA
padrao  DB '*.*', 0
dta     DB 43 DUP(?)
total   DW 0
rodape  DB ' arquivo(s)$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AH, 1Ah            ; a DTA agora é a nossa variável
        LEA  DX, dta
        INT  21h

        MOV  AH, 4Eh            ; procura o primeiro
        XOR  CX, CX
        LEA  DX, padrao
        INT  21h
achou:  JC   acabou             ; CF = 1: não há (mais) arquivos
        INC  total

        LEA  SI, dta + 1Eh      ; nome, ASCIIZ
        MOV  BX, 13             ; coluna: nome em 13 posições
@@nome: MOV  DL, [SI]
        TEST DL, DL
        JZ   @@pad
        MOV  AH, 02h
        INT  21h
        INC  SI
        DEC  BX
        JMP  @@nome
@@pad:  MOV  DL, ' '
        MOV  AH, 02h
        INT  21h
        DEC  BX
        JNZ  @@pad

        MOV  AX, WORD PTR dta + 1Ah ; tamanho (a parte alta é 0 aqui)
        CALL IMPRIMIR_NUMERO
        MOV  DL, 13
        MOV  AH, 02h
        INT  21h
        MOV  DL, 10
        INT  21h

        MOV  AH, 4Fh            ; procura o próximo
        INT  21h
        JMP  achou

acabou: MOV  AX, total
        CALL IMPRIMIR_NUMERO
        MOV  AH, 09h
        LEA  DX, rodape
        INT  21h
        MOV  AX, 4C00h
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

Troque o padrão por `*.TXT` ou `C*.*` e veja a lista mudar. Os curingas funcionam como no prompt: `?` vale um caractere qualquer e `*` vale "o resto do nome" (ou da extensão).

## O bloco de ambiente

O word no offset **2Ch** do PSP é o segmento do **bloco de ambiente**: as variáveis que o comando `SET` mostra, uma string ASCIIZ atrás da outra, com um **zero extra** marcando o fim. A partir do DOS 3.0, depois desse zero duplo vem um word (normalmente 1) e o **caminho completo do próprio programa**, outra string ASCIIZ.

```diagrama titulo="O bloco de ambiente"
  COMSPEC=C:\COMMAND.COM 00 PATH=C:\DOS;C:\TASM 00 PROMPT=$P$G 00 00 01 00 C:\CURSO\PROGRAMA.EXE 00
  └──────── 1ª variável ──┘ └──── 2ª variável ───┘ └─ 3ª ────┘ fim  qtd   └─ caminho do programa ─┘
```

```asm executar titulo="AMBIENTE.ASM: listando as variáveis de ambiente"
.MODEL SMALL
.STACK 100h
.DATA
eu      DB 'Eu sou: $'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, ES:[2Ch]       ; segmento do ambiente (ES = PSP)
        MOV  ES, AX
        XOR  SI, SI
variavel:
        CMP  BYTE PTR ES:[SI], 0
        JE   fim_vars           ; zero logo no começo: acabou a lista
mostra: MOV  DL, ES:[SI]
        INC  SI
        TEST DL, DL
        JZ   quebra
        MOV  AH, 02h
        INT  21h
        JMP  mostra
quebra: CALL NOVA_LINHA
        JMP  variavel

fim_vars:
        ADD  SI, 3              ; pula o zero final e o word com a quantidade
        MOV  AH, 09h
        LEA  DX, eu
        INT  21h
caminho:
        MOV  DL, ES:[SI]
        TEST DL, DL
        JZ   fim
        MOV  AH, 02h
        INT  21h
        INC  SI
        JMP  caminho
fim:    MOV  AX, 4C00h
        INT  21h

NOVA_LINHA PROC
        MOV  AH, 02h
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        RET
NOVA_LINHA ENDP
END inicio
```

:::atencao Por que não a função 09h
A variável `PROMPT=$P$G` contém o caractere `$`, que a função 09h entende como fim de texto. Strings que vêm de fora do seu programa devem ser impressas caractere por caractere (ou com a função 40h e um tamanho). É um bom hábito: nunca confie que um dado externo não tem `$`.
:::

O caminho do programa é o jeito de um programa achar os **seus próprios arquivos** (configuração, dados) mesmo quando é chamado de outro diretório pelo `PATH`.

## A memória do DOS: a cadeia de MCBs

Como o DOS sabe quais pedaços da memória estão ocupados? Antes de cada bloco de memória, ele guarda um cabeçalho de 16 bytes (um parágrafo) chamado **MCB** (Memory Control Block, ou "arena"):

| Offset | Tamanho | Conteúdo |
|--------|---------|----------|
| 0 | 1 | `'M'` (4Dh): há outro bloco depois; `'Z'` (5Ah): é o último |
| 1 | 2 | dono: o segmento do PSP de quem alocou (0 = livre) |
| 3 | 2 | tamanho do bloco em parágrafos (sem contar o MCB) |
| 8 | 8 | nome do programa dono (DOS 4.0 em diante) |

Os blocos ficam um atrás do outro, sem buracos: o próximo MCB está em **segmento do MCB + 1 + tamanho**. O MCB do seu programa está no parágrafo **logo antes do PSP** (PSP − 1).

```diagrama titulo="A cadeia de MCBs no simulador, logo depois de carregar um .EXE"
  067Fh ┌─────────────────────┐ MCB 'M', dono 0700h, 007Fh parágrafos
  0680h │ ambiente            │
  06FFh ├─────────────────────┤ MCB 'Z', dono 0700h, 9900h parágrafos
  0700h │ PSP                 │
  0710h │ código, dados, pilha│
        │ ... e todo o resto  │ ◄── o programa é dono de TUDO até A000h
  A000h └─────────────────────┘ fim dos 640 KB (começa a memória de vídeo)
```

O programa abaixo percorre a cadeia a partir do bloco do ambiente, como o comando `MEM /C` faz.

```asm executar titulo="MCB.ASM: percorrendo a cadeia de blocos"
.MODEL SMALL
.STACK 100h
.DATA
cab     DB 'MCB   tipo dono  paragrafos', 13, 10, '$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AH, 09h
        LEA  DX, cab
        INT  21h

        MOV  BX, ES:[2Ch]       ; ambiente (ES = PSP)
        DEC  BX                 ; o MCB fica um parágrafo antes
bloco:  MOV  ES, BX
        MOV  AX, BX
        CALL HEX4               ; segmento do MCB
        CALL ESPACO
        MOV  DL, ES:[0]         ; 'M' ou 'Z'
        MOV  AH, 02h
        INT  21h
        CALL ESPACO
        CALL ESPACO
        CALL ESPACO
        CALL ESPACO
        MOV  AX, ES:[1]         ; dono
        CALL HEX4
        CALL ESPACO
        MOV  AX, ES:[3]         ; tamanho
        CALL HEX4
        MOV  AH, 02h
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        CMP  BYTE PTR ES:[0], 'Z'
        JE   fim
        ADD  BX, ES:[3]         ; próximo = MCB + 1 + tamanho
        INC  BX
        JMP  bloco
fim:    MOV  AX, 4C00h
        INT  21h

ESPACO  PROC
        MOV  DL, ' '
        MOV  AH, 02h
        INT  21h
        RET
ESPACO  ENDP

; HEX4: imprime AX em hexadecimal, 4 dígitos
HEX4    PROC
        PUSH BX
        PUSH CX
        MOV  BX, AX
        MOV  CX, 4
@@dig:  PUSH CX
        MOV  CL, 4
        ROL  BX, CL             ; o dígito mais alto vai para baixo
        POP  CX
        MOV  DL, BL
        AND  DL, 0Fh
        ADD  DL, '0'
        CMP  DL, '9'
        JBE  @@mostra
        ADD  DL, 7              ; 'A'..'F'
@@mostra:
        MOV  AH, 02h
        INT  21h
        LOOP @@dig
        POP  CX
        POP  BX
        RET
HEX4    ENDP
END inicio
```

:::cpu Por que parágrafos
O DOS mede memória em **parágrafos** de 16 bytes porque um parágrafo é exatamente a distância entre dois valores consecutivos de segmento. Todo bloco começa num parágrafo, então o endereço do bloco cabe num registrador de segmento, e o tamanho cabe num word: 65.535 parágrafos são quase 1 MB. Um MCB tem 16 bytes justamente para que o bloco seguinte comece no parágrafo seguinte.
:::

:::anos90 "Memory allocation error"
A cadeia de MCBs não tem nenhuma proteção. Um programa com um ponteiro errado que escrevesse em cima de um MCB destruía a cadeia, e a próxima vez que o DOS precisasse dela aparecia a mensagem *Memory allocation error, cannot load COMMAND, system halted*. A única saída era reiniciar o PC. Quem programava em Assembly nos anos 90 conheceu bem essa frase.
:::

## Pedindo memória: 48h, 49h e 4Ah

| AH | Função | Entrada | Saída |
|----|--------|---------|-------|
| 48h | Alocar | BX = parágrafos | AX = segmento do bloco; se CF = 1: AX = 8 e BX = maior bloco livre |
| 49h | Liberar | ES = segmento do bloco | CF = 1 e AX = 9 se o bloco é inválido |
| 4Ah | Redimensionar | ES = segmento do bloco, BX = novo tamanho | se CF = 1: AX = 8 e BX = maior tamanho possível |

O segmento devolvido pela 48h é o do **bloco**, não o do MCB: a memória utilizável começa em AX:0000.

### A surpresa: não há memória livre

Como vimos no diagrama, o DOS entrega **toda** a memória ao programa que carrega (é o padrão dos `.EXE` gerados pelo LINK, e sempre é assim com os `.COM`). Por isso, a primeira chamada à 48h de um programa recém-carregado **falha** com o erro 8 e BX = 0: não sobrou nada para alocar.

A solução é **encolher** o próprio bloco com a função 4Ah antes de pedir memória. Em ES vai o segmento do PSP (o bloco do programa começa nele), e em BX, o tamanho de que o programa precisa de verdade. Num `.EXE` do modelo SMALL, a pilha é o último segmento, então o programa vai do PSP até SS:SP:

```diagrama titulo="Quanto o programa ocupa"
  PSP ─────────────────────────────── SS ──────────── SS:SP
  │ PSP │ código │ dados │            │ pilha          │
  └────────────── SS − PSP ───────────┴── (SP+15)/16 ──┘
        tamanho em parágrafos = SS − PSP + (SP + 15) / 16
```

```asm executar titulo="MEMORIA.ASM: encolher, alocar, usar e liberar"
.MODEL SMALL
.STACK 100h
.DATA
psp     DW ?
m_falha DB 'Antes: 48h falhou, maior bloco livre = $'
m_par   DB ' paragrafos.', 13, 10, '$'
m_ok    DB 'Depois do 4Ah: bloco alocado no segmento $'
m_lib   DB 13, 10, 'Bloco liberado.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  psp, ES            ; guarda o PSP antes de mexer em ES

        MOV  AH, 48h            ; 1. tenta alocar 1000h parágrafos (64 KB)
        MOV  BX, 1000h
        INT  21h
        JNC  alocou
        PUSH BX
        MOV  AH, 09h
        LEA  DX, m_falha
        INT  21h
        POP  AX
        CALL HEX4
        MOV  AH, 09h
        LEA  DX, m_par
        INT  21h

        MOV  BX, SP             ; 2. encolhe o programa ao necessário
        ADD  BX, 15
        MOV  CL, 4
        SHR  BX, CL             ; parágrafos da pilha
        MOV  AX, SS
        ADD  BX, AX
        SUB  BX, psp            ; BX = SS - PSP + (SP+15)/16
        MOV  ES, psp
        MOV  AH, 4Ah
        INT  21h
        JC   fim

        MOV  AH, 48h            ; 3. agora sim
        MOV  BX, 1000h
        INT  21h
        JC   fim
alocou: MOV  ES, AX             ; ES:0000 = início do bloco novo
        PUSH AX
        MOV  AH, 09h
        LEA  DX, m_ok
        INT  21h
        POP  AX
        CALL HEX4

        XOR  DI, DI             ; 4. usa: preenche 64 KB com o valor 0AAh
        MOV  CX, 8000h          ; 32.768 words
        MOV  AX, 0AAAAh
        CLD
        REP  STOSW

        MOV  AH, 49h            ; 5. devolve (ES = segmento do bloco)
        INT  21h
        MOV  AH, 09h
        LEA  DX, m_lib
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h

; HEX4: imprime AX em hexadecimal, 4 dígitos
HEX4    PROC
        PUSH BX
        PUSH CX
        MOV  BX, AX
        MOV  CX, 4
@@dig:  PUSH CX
        MOV  CL, 4
        ROL  BX, CL
        POP  CX
        MOV  DL, BL
        AND  DL, 0Fh
        ADD  DL, '0'
        CMP  DL, '9'
        JBE  @@mostra
        ADD  DL, 7
@@mostra:
        MOV  AH, 02h
        INT  21h
        LOOP @@dig
        POP  CX
        POP  BX
        RET
HEX4    ENDP
END inicio
```

Execute o `MCB.ASM` depois de entender este programa e imagine a cadeia nos passos 2, 3 e 5: o 4Ah divide o bloco do programa em dois (o programa e um bloco livre novo), a 48h divide o bloco livre outra vez, e a 49h devolve o pedaço, que o DOS junta de novo ao livre vizinho.

:::atencao Encolher demais é fatal
Se você passar à função 4Ah um tamanho menor que o programa, o DOS vai considerar livre uma parte que ainda está em uso, normalmente a pilha. A próxima alocação entrega essa memória a outro uso, e a pilha é sobrescrita. Calcule com cuidado e, na dúvida, sobre alguns parágrafos.
:::

:::dica Por que encolher, se dá para usar a memória "de graça"?
Um programa que já é dono de tudo poderia simplesmente usar a memória depois do fim dele, sem pedir nada. Funciona, mas é frágil: você não sabe o que mais está ali, e não poderia chamar outros programas (a função EXEC, 4Bh, precisa de memória livre para carregá-los). Na próxima aula, os programas residentes dependem exatamente desse controle: eles dizem ao DOS quanto da memória querem manter.
:::

```quiz
? Num .EXE, para onde DS e ES apontam quando o programa começa?
- Para o segmento de dados
+ Para o PSP
- Para o segmento de código
> Por isso MOV AX,@DATA / MOV DS,AX é obrigatório, e por isso ES ainda serve para ler a linha de comando depois disso.

? O usuário digitou PROGRAMA /X. Qual é o valor do byte 80h do PSP?
- 2
+ 3
- 4
> A linha começa com o espaço que separa o nome do programa: ' /X' tem 3 bytes. O 0Dh final não entra na conta.

? Por que é importante definir uma DTA própria (AH = 1Ah) antes de procurar arquivos?
- Porque a DTA padrão é pequena demais para o nome
+ Porque a DTA padrão fica em PSP:80h e a busca escreveria em cima da linha de comando
- Porque a função 4Eh não funciona sem ela
> A DTA padrão começa no offset 80h do PSP. A primeira busca destruiria os parâmetros que você ainda quer ler.

? Um MCB está no segmento 1000h, com tamanho 0200h parágrafos e tipo 'M'. Onde está o próximo MCB?
- 1200h
+ 1201h
- 1020h
> Próximo = 1000h + 1 (o próprio MCB) + 0200h (o bloco) = 1201h.

? Um .EXE recém-carregado chama a função 48h pedindo 100h parágrafos. O que acontece?
- O DOS aloca normalmente
+ Falha com o erro 8: o programa já é dono de toda a memória livre
- O PC trava
> O DOS entrega todo o bloco livre ao programa. É preciso encolher o bloco com 4Ah antes de alocar.

? Por que o programa AMBIENTE.ASM imprime as variáveis caractere por caractere em vez de usar a função 09h?
- Porque a função 09h não aceita ES
+ Porque as variáveis podem conter $, que a função 09h entende como fim do texto
- Porque o ambiente está em maiúsculas
> PROMPT=$P$G é o exemplo clássico. Também é verdade que a 09h usa DS:DX, mas o $ estragaria a saída mesmo com DS certo.
```

## Exercícios

```exercicio
id: a26-1
titulo: Eco dos parâmetros
nivel: 1
--- enunciado
Imprima a linha de comando do programa **sem os espaços do começo**. Se não houver parâmetros (ou só espaços), não imprima nada. Lembre que ES aponta para o PSP quando o programa começa.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: ; ES = PSP: a linha de comando está em ES:81h, o tamanho em ES:80h

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "um espaço antes", "linhaComando": " ola mundo", "espera": { "saida": "ola mundo" } },
 { "nome": "vários espaços antes", "linhaComando": "    tres espacos", "espera": { "saida": "tres espacos" } },
 { "nome": "espaços no meio são mantidos", "linhaComando": " A  B", "espera": { "saida": "A  B" } },
 { "nome": "sem parâmetros", "espera": { "saida": "" } },
 { "nome": "só espaços", "linhaComando": "     ", "espera": { "saida": "" } }]
--- dicas
CL = ES:[80h] (com CH = 0) é a quantidade de bytes; SI = 81h aponta para o primeiro. Use JCXZ para o caso sem parâmetros.
Primeiro um laço que pula os espaços: enquanto ES:[SI] for ' ', INC SI e DEC CX (pare se CX chegar a 0).
Depois imprima os CX bytes restantes com AH = 02h, um a um.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  CL, ES:[80h]
        XOR  CH, CH
        MOV  SI, 81h
        JCXZ fim
pula:   CMP  BYTE PTR ES:[SI], ' '
        JNE  mostra
        INC  SI
        LOOP pula
        JMP  SHORT fim
mostra: MOV  DL, ES:[SI]
        MOV  AH, 02h
        INT  21h
        INC  SI
        LOOP mostra
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a26-2
titulo: Contar parâmetros
nivel: 2
--- enunciado
Conte quantos **parâmetros** há na linha de comando e guarde o número em **quantos**. Parâmetros são sequências de caracteres separadas por um ou mais espaços. Espaços no começo e no fim não contam.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
quantos DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX             ; ES continua apontando para o PSP

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "sem parâmetros", "espera": { "mem": { "quantos": 0 } } },
 { "nome": "um parâmetro", "linhaComando": " ARQUIVO.TXT", "espera": { "mem": { "quantos": 1 } } },
 { "nome": "três, com espaços sobrando", "linhaComando": "   um  dois    tres  ", "espera": { "mem": { "quantos": 3 } } },
 { "nome": "opções", "linhaComando": " /S *.TXT", "espera": { "mem": { "quantos": 2 } } },
 { "nome": "só espaços", "linhaComando": "      ", "espera": { "mem": { "quantos": 0 } } }]
--- dicas
Uma palavra começa quando você encontra um caractere que não é espaço logo depois de um espaço (ou no começo).
Guarde num registrador (BL, por exemplo) se o caractere anterior era espaço. Comece com BL = 1, como se houvesse um espaço antes da linha.
Para cada caractere: se é espaço, BL = 1. Se não é e BL = 1, INC quantos e BL = 0.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
quantos DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CL, ES:[80h]
        XOR  CH, CH
        MOV  SI, 81h
        MOV  BL, 1              ; 1 = o anterior era espaço
        JCXZ fim
laco:   CMP  BYTE PTR ES:[SI], ' '
        JNE  letra
        MOV  BL, 1
        JMP  SHORT prox
letra:  CMP  BL, 1
        JNE  prox
        INC  quantos            ; começo de uma palavra
        MOV  BL, 0
prox:   INC  SI
        LOOP laco
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a26-3
titulo: Listar os .TXT
nivel: 2
--- enunciado
Imprima o nome de cada arquivo do disco que combina com `*.TXT`, um por linha (cada nome seguido de CR e LF), na ordem em que as funções 4Eh e 4Fh os devolvem. Se nenhum arquivo combinar, imprima `Nenhum arquivo.` Use uma DTA própria.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
padrao  DB '*.TXT', 0
dta     DB 43 DUP(?)
nenhum  DB 'Nenhum arquivo.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "dois .TXT e um .DAT", "arquivos": { "A.TXT": "1", "B.DAT": "2", "NOTAS.TXT": "3" }, "espera": { "saida": "A.TXT\nNOTAS.TXT" } },
 { "nome": "um só", "arquivos": { "LEIA.TXT": "x", "PROG.EXE": "y" }, "espera": { "saida": "LEIA.TXT" } },
 { "nome": "nenhum .TXT", "arquivos": { "CARTA.DOC": "z" }, "espera": { "saida": "Nenhum arquivo." } },
 { "nome": "disco vazio", "espera": { "saida": "Nenhum arquivo." } }]
--- dicas
AH = 1Ah com DS:DX = dta define a DTA. Depois AH = 4Eh, CX = 0, DS:DX = padrao. CF = 1 quer dizer que não achou nada.
O nome está em dta + 1Eh, terminado em 0. Imprima com AH = 02h até achar o zero, e depois 13 e 10.
Para continuar, AH = 4Fh e volte ao teste do CF. Para saber se deve imprimir "Nenhum arquivo.", basta ver se a primeira busca falhou.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
padrao  DB '*.TXT', 0
dta     DB 43 DUP(?)
nenhum  DB 'Nenhum arquivo.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AH, 1Ah
        LEA  DX, dta
        INT  21h
        MOV  AH, 4Eh
        XOR  CX, CX
        LEA  DX, padrao
        INT  21h
        JNC  mostra
        MOV  AH, 09h
        LEA  DX, nenhum
        INT  21h
        JMP  SHORT fim
mostra: LEA  SI, dta + 1Eh
@@letra:
        MOV  DL, [SI]
        TEST DL, DL
        JZ   @@fimnome
        MOV  AH, 02h
        INT  21h
        INC  SI
        JMP  @@letra
@@fimnome:
        MOV  AH, 02h
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        MOV  AH, 4Fh
        INT  21h
        JNC  mostra
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a26-4
titulo: Abrindo espaço na memória
nivel: 3
--- enunciado
Faça o programa encolher o próprio bloco com a função 4Ah para **exatamente** SS − PSP + (SP + 15) / 16 parágrafos (o valor de SP no início do programa). Depois:

1. Chame a função 48h com BX = 0FFFFh (um pedido impossível) e guarde em **livre** o tamanho do maior bloco livre que ela devolve em BX.
2. Aloque **100h** parágrafos com a função 48h e guarde o segmento do bloco em **bloco**.
3. Grave a word 1234h no início do bloco (bloco:0000) e libere-o com a função 49h.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
psp     DW ?
livre   DW 0
bloco   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "encolhe, mede, aloca e libera", "espera": { "mem": { "livre": 39129, "bloco": 1831 } } }]
--- dicas
Logo depois de MOV DS,AX, ES ainda é o PSP: guarde-o em psp. Calcule BX = SP, ADD BX,15, SHR por 4 (MOV CL,4 / SHR BX,CL), some SS e subtraia psp.
Com ES = psp e AH = 4Ah, chame a INT 21h. Depois, AH = 48h com BX = 0FFFFh: vai dar CF = 1, e BX traz o maior bloco livre.
A segunda 48h devolve o segmento em AX. Coloque-o em ES, grave com MOV WORD PTR ES:[0],1234h e chame AH = 49h (o bloco a liberar é o de ES).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
psp     DW ?
livre   DW 0
bloco   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  psp, ES
        MOV  BX, SP
        ADD  BX, 15
        MOV  CL, 4
        SHR  BX, CL
        MOV  AX, SS
        ADD  BX, AX
        SUB  BX, psp
        MOV  ES, psp
        MOV  AH, 4Ah
        INT  21h
        JC   fim
        MOV  AH, 48h
        MOV  BX, 0FFFFh
        INT  21h
        MOV  livre, BX
        MOV  AH, 48h
        MOV  BX, 100h
        INT  21h
        JC   fim
        MOV  bloco, AX
        MOV  ES, AX
        MOV  WORD PTR ES:[0], 1234h
        MOV  AH, 49h
        INT  21h
fim:    MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- O **PSP** tem 256 bytes: INT 20h em 00h, o fim da memória em 02h, a tabela de handles em 18h, o segmento do ambiente em 2Ch, FCBs em 5Ch e 6Ch e a linha de comando em 80h (tamanho) e 81h (texto terminado em 0Dh).
- Num .EXE, **DS e ES apontam para o PSP** no início; depois de `MOV DS,AX`, ES ainda serve para ler o PSP. A função 62h devolve o PSP em BX.
- Os parâmetros começam com o espaço depois do nome do programa e são separados por espaços.
- 4Eh e 4Fh procuram arquivos por padrão (`*.TXT`); o resultado vai para a **DTA**, que deve ser definida com 1Ah porque a padrão fica em cima da linha de comando.
- O **ambiente** é uma lista de strings ASCIIZ com um zero extra no fim, seguida do caminho do programa. Imprima dados externos sem a função 09h.
- Cada bloco de memória tem um **MCB** antes dele ('M' ou 'Z', dono, tamanho); o próximo está em MCB + 1 + tamanho.
- O programa recebe **toda** a memória: encolha com 4Ah (ES = PSP, BX = parágrafos) antes de alocar com 48h. Libere com 49h (ES = bloco).
:::
