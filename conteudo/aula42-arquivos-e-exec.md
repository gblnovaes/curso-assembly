---
id: aula42
numero: 42
modulo: 14
titulo: Arquivos e o EXEC
subtitulo: Procurar no diretório, ler um arquivo setor a setor e carregar, rodar e encerrar um programa .COM
duracao: 130 min
objetivos: converter um nome como "cobra.com" para o formato de 11 bytes do diretório; procurar um arquivo no diretório com REPE CMPSB; ler um arquivo inteiro, setor a setor, para qualquer segmento; entender as funções 80h e 81h que o kernel do MINIOS oferece para o shell; carregar um .COM, montar o PSP com a linha de comando e saltar para ele com os segmentos e a pilha certos; salvar e restaurar os vetores e a pilha do pai para que um programa possa terminar e devolver o controle; comparar o EXEC do MINIOS com o do MS-DOS
---

## Dois serviços que faltam

O kernel da [aula 41](aula:aula41) já tem console, vetores e versão. Mas um sistema operacional existe, antes de tudo, para duas coisas: **guardar arquivos** e **rodar programas**. Esta aula cuida das duas, e das partes do kernel que ficaram para depois:

| Função | O que faz | Quem usa |
|---|---|---|
| 80h (só do MINIOS) | copia a entrada CX do diretório para ES:DI | o comando DIR do shell |
| 81h (só do MINIOS) | lê o arquivo DS:DX inteiro para ES:BX; AX = tamanho | o comando TIPO do shell |
| 4Bh | carrega e roda o programa DS:DX, com a linha de comando ES:BX | o shell, para qualquer X.COM |
| 4Ch | termina o programa atual com o código AL | todo programa |
| 4Dh | devolve o código de saída do último programa | quem fez a 4Bh |
| INT 20h | termina com o código 0 (o `RET` de um .COM cai aqui) | programas antigos |

As funções 80h e 81h não existem no DOS: são o jeito mais simples de dar ao shell acesso ao MINIFS sem implementar `abrir`, `ler` e `fechar` com handles, como as funções 3Dh, 3Fh e 3Eh que você usou na [aula 25](aula:aula25). O DOS reservava os números acima de 6Ch para versões futuras, e a 80h nunca foi usada por ele; um sistema próprio pode escolher.

## Nomes no formato 8.3

O diretório guarda os nomes em **11 bytes**: 8 de nome e 3 de extensão, completados com espaços, em maiúsculas, sem o ponto ([aula 40](aula:aula40)). Mas o usuário digita `cobra.com`, ou `COBRA.COM`, ou `Cobra.Com`. Antes de procurar, o kernel converte:

```diagrama titulo="NOME_83: do texto digitado ao formato do diretório"
  DS:DX  →  c  o  b  r  a  .  c  o  m  0
            │  │  │  │  │     │  │  │
            ▼  ▼  ▼  ▼  ▼     ▼  ▼  ▼
  nome83 = [C][O][B][R][A][ ][ ][ ][C][O][M]
            0              7  8        10
            nome (8, com espaços)   extensão (3)
```

```asm fragmento titulo="NOME_83 (KERNEL.ASM)"
NOME_83 PROC
        ...
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
@@fim:  ...
```

- Primeiro tudo vira espaço com `REP STOSB`; depois as letras são escritas por cima. Assim o "completar com espaços" sai de graça.
- **`JCXZ`** (*salte se CX = 0*) testa o contador sem mudar as flags. Um nome com mais de 8 letras continua sendo lido (para achar o ponto), mas as letras a mais são ignoradas: `NOMEMUITOLONGO.COM` vira `NOMEMUITCOM`, como o DOS fazia.
- `MAIUSCULA` subtrai 32 das letras de `a` a `z` (`'a' − 'A'` = 20h). O DOS também é insensível a maiúsculas e minúsculas nos nomes de arquivo, e pela mesma razão: ele converte tudo para maiúsculas.
- O nome convertido fica em `nome83`, na memória do **kernel**. Como DS é o de quem chamou (o nome vem dele), `STOSB` grava em ES:DI com ES = CS.

## Procurar no diretório

Com o nome em 11 bytes, procurar é comparar 11 bytes com cada uma das 16 entradas, como o setor de boot fez com o `KERNEL  SYS`:

```asm fragmento titulo="ACHA_ARQUIVO: SI = entrada, ou CF = 1"
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
```

A dança de `PUSH DS` / `PUSH CS` / `POP DS` é porque `CMPSB` compara **DS:SI** com **ES:DI**, e as duas coisas (o diretório e o `nome83`) estão no segmento do kernel. O DS de quem chamou é guardado e volta depois de cada comparação, porque quem chamou ainda vai precisar dele (a 81h, por exemplo, devolve o tamanho e a 4Bh lê a linha de comando em ES:BX).

O resultado é **SI apontando para a entrada** no diretório do kernel. Daí em diante, tudo o que se quer saber do arquivo está a um `CS:[SI+n]` de distância: `CS:[SI+12]` é o primeiro setor, `CS:[SI+14]` o número de setores, `CS:[SI+16]` o tamanho.

## Ler um arquivo

Com os arquivos sempre em setores seguidos, ler um arquivo é um laço de `LE_SETOR`, a mesma rotina do boot (LBA → CHS, três tentativas):

```asm fragmento titulo="LE_ARQUIVO: a entrada CS:SI para ES:BX"
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
```

O arquivo é lido **inteiro**, até o fim do último setor: um arquivo de 2 348 bytes ocupa 5 setores, e os 212 bytes que sobram do último também vêm para a memória. Por isso o tamanho exato fica no diretório: a função 81h o devolve em AX, e o comando TIPO do shell para de mostrar no Ctrl+Z (1Ah) ou no tamanho, o que vier primeiro. O exercício 1 calcula quantos setores um arquivo ocupa.

:::cpu E se o arquivo passar de 64 KB?
`ADD BX, 512` daria a volta em FFFFh e o arquivo sobrescreveria o começo dele mesmo. O MINIOS não tem esse problema porque um .COM tem no máximo 64 KB menos 256 bytes. Um sistema que lê arquivos maiores precisa avançar o **segmento** em vez do offset (`ADD ES, 32` avança 512 bytes, porque 32 × 16 = 512) e tomar cuidado com a fronteira de 64 KB do DMA, que a INT 13h não atravessa ([capítulo 9 do livro](livro:cap09)).
:::

### As funções 80h e 81h

```asm fragmento titulo="F_80: a entrada CX do diretório para ES:DI"
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
```

O shell chama a 80h com CX = 0, 1, 2... até receber CF = 1 com AX = 18 ("não há mais arquivos", o mesmo erro que a 4Fh do DOS devolve no fim de uma busca). Mudar o DS aqui não faz mal: o DS de quem chamou está no quadro e volta no `POP DS` da saída. A `F_81` usa `ACHA_ARQUIVO` e `LE_ARQUIVO` e devolve o tamanho:

```asm fragmento titulo="F_81: o arquivo DS:DX inteiro para ES:BX"
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
```

## Rodar um programa: o EXEC

Agora a parte mais delicada do kernel. Rodar um programa parece simples ("carregue e salte"), mas o programa precisa, um dia, **voltar**, e quando voltar, quem o chamou tem que continuar exatamente de onde parou, com a pilha, os registradores e os vetores como estavam.

```diagrama titulo="O EXEC do MINIOS (INT 21h, AH=4Bh)"
  shell (nível 0, 2000h): INT 21h AH=4Bh, DS:DX = "COBRA.COM", ES:BX = cauda
     │
     ▼ kernel (na pilha do shell, com o quadro)
     1. nível < 2?                      senão: erro 8
     2. ACHA_ARQUIVO                    senão: erro 2
     3. segmento = 3000h + nível × 1000h
     4. LE_ARQUIVO para SEG:0100
     5. MONTA_PSP em SEG:0000 (INT 20h, linha de comando em 80h)
     6. SALVA_VETORES (INT 00h a 3Fh) na cópia deste nível
     7. guarda SS:SP do shell  ─────────────────────┐
     8. nível = nível + 1                           │
     9. INICIA_PROGRAMA: SS = DS = ES = SEG,        │
        SP = FFFEh com um 0 no topo, RETF ► SEG:0100│
     ▼                                              │
  COBRA.COM roda ... INT 21h AH=4Ch                 │
     ▼ kernel: TERMINA                              │
     1. nível = nível − 1                           │
     2. RESTAURA_VETORES                            │
     3. SS:SP = o do shell  ◄───────────────────────┘
     4. BP = SP: o quadro da 4Bh do shell está no topo
     5. FIM_OK: POPs e IRET ─► o shell volta do INT 21h da 4Bh
```

A ideia central está no passo 7 e no TERMINA: quando o shell chamou a 4Bh, a INT 21h montou **o quadro dele na pilha dele**. O kernel guarda SS:SP nesse momento e abandona essa pilha (o programa novo ganha a dele). Quando o programa termina, o kernel simplesmente **volta para a pilha guardada**: o quadro do shell está lá, intacto, no topo. Um `JMP FIM_OK` faz os POPs e o IRET, e o shell sai da INT 21h como se a 4Bh tivesse acabado naquele instante.

### O segmento de cada nível

```asm fragmento titulo="F_4B: o começo"
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
```

O shell está no nível 0; um programa rodado por ele fica no nível 1 (3000h); se esse programa rodar outro, ele fica no nível 2 (4000h). O MINIOS para aí: com dois níveis já dá para um programa chamar outro (o exemplo PAI/FILHO no fim da aula), e os segmentos fixos não se sobrepõem. O DOS não tem esse limite porque aloca a memória com os MCBs ([aula 26](aula:aula26)): cada EXEC pede o maior bloco livre.

`SHL AX, CL` com CL = 12 multiplica por 4096 = 1000h. Lembre que no 8086 o deslocamento por mais de 1 bit precisa do CL ([aula 16](aula:aula16)).

### O PSP

Todo .COM espera encontrar, nos 256 bytes antes do código, o **PSP** (*Program Segment Prefix*). O do DOS tem dezenas de campos ([aula 26](aula:aula26), [capítulo 22 do livro](livro:cap22)); o do MINIOS preenche só os que os programas do curso usam:

```asm fragmento titulo="MONTA_PSP"
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
```

```diagrama titulo="O PSP do MINIOS"
  SEG:0000  CD 20        INT 20h: um RET de um .COM salta para cá
  SEG:0002  00 A0        "topo da memória" (A000h, como o DOS diz)
  SEG:0004  ...          (zeros)
  SEG:0080  0B           tamanho da linha de comando
  SEG:0081  " ola, filho" 0D    o texto e o ENTER
  SEG:0100  o programa
```

- Os bytes **CD 20** em SEG:0000 são a instrução `INT 20h`. O kernel empilha um **0** no topo da pilha do programa; um .COM que termina com `RET` tira esse 0 como endereço de volta, salta para SEG:0000 e executa a INT 20h. É o jeito de terminar dos programas do CP/M e do DOS 1.0, e o MINIOS o mantém.
- A **linha de comando** (a "cauda") chega ao kernel em ES:BX, no mesmo formato do PSP: um byte com o tamanho, o texto e um 13. O kernel copia tudo para SEG:80h. O SETOR.COM da [aula 44](aula:aula44) lê o número do setor dali.

### Salvar os vetores

Os jogos do módulo 13 trocam a **INT 9** pelo leitor de teclado deles. Um jogo bem escrito devolve o vetor antes de sair; mas e se ele travar, ou sair por um caminho esquecido? O shell ficaria com um teclado que não funciona.

O kernel se protege: no EXEC, ele **copia os vetores 00h a 3Fh** (256 bytes) para uma área própria, uma por nível; no TERMINA, copia de volta. Qualquer vetor que o programa tenha mudado volta a ser o de antes.

```asm fragmento titulo="SALVA_VETORES"
SALVA_VETORES PROC
        ...
        CALL VETORES_DO_NIVEL   ; DI = cópia deste nível
        PUSH CS
        POP  ES
        XOR  SI, SI
        MOV  DS, SI             ; DS:SI = 0000:0000
        MOV  CX, VETORES_SALVOS*2
        CLI
        REP  MOVSW
        STI
        ...
```

O DOS de verdade faz uma versão menor disso: ele guarda só os vetores 22h, 23h e 24h (fim, Ctrl+C e erro crítico) no PSP do programa e os restaura na saída. Os outros são problema do programa. Um TSR, que de propósito deixa a INT 9 trocada ([aula 27](aula:aula27)), não funcionaria no MINIOS: o kernel desfaria a troca. É uma escolha de projeto, e o MINIOS não tem a função 31h.

### Saltar para o programa

```asm fragmento titulo="INICIA_PROGRAMA"
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
        ...
        RETF                    ; "volta" para dentro do programa
```

Um .COM começa com CS = DS = ES = SS = o segmento do PSP, IP = 100h e SP no fim do segmento ([aula 26](aula:aula26)). Com SP = 0, o primeiro `PUSH` decrementa para FFFEh e grava ali: a pilha usa a última word do segmento. Depois, o mesmo `PUSH` / `PUSH` / `RETF` do setor de boot salta para SEG:0100.

### Terminar

```asm fragmento titulo="TERMINA"
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
```

`TERMINA` é chamada pela função 4Ch, pela INT 20h e pela INT 0. Repare que ela **não volta** para quem a chamou: a pilha do programa que terminou é simplesmente abandonada (a memória dele será sobrescrita pelo próximo programa do mesmo nível). Se quem terminou foi o próprio shell (nível 0), não há para onde voltar, e o kernel carrega o shell de novo: é assim que o MINIOS sobrevive a um `EXIT`.

O código de saída fica em `codigo_saida`, e a função **4Dh** o devolve. É o que o `IF ERRORLEVEL` dos arquivos .BAT do DOS lia.

:::anos90 "Program too big to fit in memory"
O EXEC do DOS (a função 4Bh com AL = 0) é bem mais trabalhoso: ele monta o **ambiente** (as variáveis do SET, como PATH e PROMPT) num bloco à parte, aloca a memória, lê o cabeçalho de um .EXE, aplica as **relocações** (os endereços de segmento que dependem de onde o programa foi carregado), acerta SS:SP e CS:IP pelo cabeçalho e guarda os vetores 22h a 24h no PSP. Quando não havia um bloco livre grande o bastante, vinha a mensagem "Program too big to fit in memory", a mais temida do DOS nos anos 90, quando os jogos pediam 600 KB dos 640 KB e cada driver de mouse ou de CD-ROM carregado no CONFIG.SYS roubava alguns. O [capítulo 22 do livro](livro:cap22) mostra o EXEC do DOS passo a passo.
:::

## Um programa que roda outro

Este disquete tem o boot, o kernel, o shell e dois programas: o **PAI.COM**, que roda o **FILHO.COM** com a linha de comando `" ola, filho"` e depois pergunta (função 4Dh) com que código ele terminou; e o FILHO, que mostra o segmento em que foi carregado e a linha de comando que recebeu, e termina com o código 7.

Clique em **▶ Dar boot** e digite `PAI`. Depois digite `FILHO abc`: rodado pelo shell, o filho fica no nível 1 (3000h); rodado pelo PAI, no nível 2 (4000h).

```asm boot titulo="DISCO3.IMG"
;### ARQUIVO BOOT.BIN = aula40/BOOT.ASM
;### ARQUIVO KERNEL.SYS = aula41/KERNEL.ASM
;### ARQUIVO SHELL.COM = aula43/SHELL.ASM
;### ARQUIVO PAI.COM
; PAI.COM: roda o FILHO.COM com uma linha de comando (INT 21h, AH=4Bh)
; e depois pergunta com que código ele terminou (AH=4Dh).
.MODEL TINY
.CODE
        ORG 100h
inicio: MOV  AH, 09h
        MOV  DX, OFFSET msg_vou
        INT  21h
        MOV  DX, OFFSET nome_filho      ; DS:DX = nome do programa
        MOV  BX, OFFSET cauda           ; ES:BX = linha de comando
        MOV  AX, 4B00h                  ; (ES = DS num .COM)
        INT  21h
        JC   erro
        MOV  AH, 09h
        MOV  DX, OFFSET msg_voltou
        INT  21h
        MOV  AH, 4Dh                    ; código de saída do filho
        INT  21h
        ADD  AL, '0'                    ; (um dígito basta aqui)
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        MOV  AH, 09h
        MOV  DX, OFFSET msg_crlf
        INT  21h
        MOV  AX, 4C00h
        INT  21h
erro:   ADD  AL, '0'                    ; AX = código do erro (2 = não achou)
        MOV  msg_erro_n, AL
        MOV  AH, 09h
        MOV  DX, OFFSET msg_erro
        INT  21h
        MOV  AX, 4C01h
        INT  21h

nome_filho DB 'FILHO.COM', 0
cauda      DB 11, ' ola, filho', 13     ; tamanho, texto, 13 (como no PSP)
msg_vou    DB 'PAI: vou rodar o FILHO.COM...', 13, 10, '$'
msg_voltou DB 'PAI: o filho terminou com o codigo $'
msg_erro   DB 'PAI: erro '
msg_erro_n DB '0 no EXEC.', 13, 10, '$'
msg_crlf   DB '.', 13, 10, '$'
END inicio
;### ARQUIVO FILHO.COM
; FILHO.COM: mostra onde está e a linha de comando que recebeu
; (no PSP, em 80h), e termina com o código 7.
.MODEL TINY
.CODE
        ORG 100h
inicio: MOV  AH, 09h
        MOV  DX, OFFSET msg_seg
        INT  21h
        MOV  AX, CS                     ; 3000h ou 4000h, conforme o nível
        CALL HEXA16
        MOV  AH, 09h
        MOV  DX, OFFSET msg_cauda
        INT  21h
        MOV  SI, 81h                    ; o texto da linha de comando
        MOV  CL, DS:[80h]               ; e o tamanho dele
        XOR  CH, CH
        JCXZ fim
mostra: LODSB
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        LOOP mostra
fim:    MOV  AH, 09h
        MOV  DX, OFFSET msg_fecha
        INT  21h
        MOV  AX, 4C07h                  ; termina com o código 7
        INT  21h

HEXA16  PROC
        MOV  CX, 4
@@dig:  PUSH CX
        MOV  CL, 4
        ROL  AX, CL
        PUSH AX
        AND  AL, 0Fh
        ADD  AL, '0'
        CMP  AL, '9'
        JBE  @@ok
        ADD  AL, 7
@@ok:   MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  AX
        POP  CX
        LOOP @@dig
        RET
HEXA16  ENDP

msg_seg   DB 'FILHO: estou no segmento $'
msg_cauda DB 'h. Recebi: [$'
msg_fecha DB ']', 13, 10, '$'
END inicio
```

A saída esperada:

```diagrama titulo="Uma sessão com o PAI e o FILHO"
  A> PAI
  PAI: vou rodar o FILHO.COM...
  FILHO: estou no segmento 4000h. Recebi: [ ola, filho]
  PAI: o filho terminou com o codigo 7.
  A> FILHO abc
  FILHO: estou no segmento 3000h. Recebi: [ abc]
  A>
```

:::dica Os dois programas rodam no DOS também
PAI.COM e FILHO.COM só usam as funções 02h, 09h, 4Bh, 4Ch e 4Dh, que o DOS também tem. No DOS, o FILHO mostraria outro segmento (o DOS escolhe onde carregar) e a 4Bh precisaria de um bloco de parâmetros em ES:BX em vez da cauda direta, e de memória livre (um .COM recebe toda a memória ao começar e precisaria liberar o resto com a função 4Ah antes). As diferenças estão no [capítulo 22 do livro](livro:cap22).
:::

## Exercícios

```exercicio
id: a42-1
titulo: Quantos setores ocupa
nivel: 1
proibir: DIV
--- enunciado
**AX** traz o tamanho de um arquivo em bytes (0 a 65 535). Devolva em **CX** quantos setores de 512 bytes ele ocupa no disquete: a divisão por 512 **arredondada para cima** (um arquivo de 513 bytes ocupa 2 setores; um de 0 bytes, nenhum). Sem `DIV`: 512 é 2⁹.
--- inicial
; AX = tamanho em bytes
; CX = setores (arredondando para cima)
        MOV  CX, AX
--- testes
[{ "nome": "0 bytes", "setup": { "AX": 0, "CX": 9 }, "espera": { "CX": 0 } },
 { "nome": "1 byte", "setup": { "AX": 1 }, "espera": { "CX": 1 } },
 { "nome": "512 bytes: exatamente 1", "setup": { "AX": 512 }, "espera": { "CX": 1 } },
 { "nome": "513 bytes", "setup": { "AX": 513 }, "espera": { "CX": 2 } },
 { "nome": "o KERNEL.SYS: 2348 bytes", "setup": { "AX": 2348 }, "espera": { "CX": 5 } },
 { "nome": "65535 bytes (cuidado com AX + 511)", "setup": { "AX": 65535 }, "espera": { "CX": 128 } }]
--- dicas
Somar 511 e depois dividir é a receita clássica, mas AX + 511 passa de 65 535 para arquivos grandes.
Em vez disso: CX = AX deslocado 9 bits para a direita (MOV CL,9 / SHR AX,CL... cuidado, CL faz parte de CX).
Se sobrou alguma coisa (AX AND 511 diferente de 0), some 1.
--- solucao
; AX = tamanho em bytes
; CX = setores (arredondando para cima)
        MOV  DX, AX
        AND  DX, 511            ; sobra no último setor
        MOV  CL, 9
        SHR  AX, CL             ; setores cheios
        MOV  CX, AX
        OR   DX, DX
        JZ   fim
        INC  CX                 ; mais um, pela sobra
fim:
```

```exercicio
id: a42-2
titulo: NOME_83
nivel: 2
--- enunciado
**nome** traz o nome de um arquivo como o usuário digita, terminado em 0 (como `cobra.com`). Converta para o formato do diretório em **nome83** (11 bytes): até 8 letras do nome, completadas com espaços, e até 3 da extensão, também completadas com espaços, tudo em **maiúsculas** e sem o ponto. Letras além da 8ª do nome são ignoradas.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: ; nome (terminado em 0) -> nome83 (11 bytes)

        MOV  AX, 4C00h
        INT  21h
nome    DB 20 DUP (0)
nome83  DB 11 DUP (0)
END inicio
--- testes
[{ "nome": "cobra.com", "setup": { "nome": "cobra.com" }, "espera": { "mem": { "nome83": ["C","O","B","R","A"," "," "," ","C","O","M"] } } },
 { "nome": "KERNEL.SYS", "setup": { "nome": "KERNEL.SYS" }, "espera": { "mem": { "nome83": ["K","E","R","N","E","L"," "," ","S","Y","S"] } } },
 { "nome": "Leiame.Txt", "setup": { "nome": "Leiame.Txt" }, "espera": { "mem": { "nome83": ["L","E","I","A","M","E"," "," ","T","X","T"] } } },
 { "nome": "sem extensão", "setup": { "nome": "x" }, "espera": { "mem": { "nome83": ["X"," "," "," "," "," "," "," "," "," "," "] } } },
 { "nome": "nome comprido", "setup": { "nome": "nomemuitolongo.com" }, "espera": { "mem": { "nome83": ["N","O","M","E","M","U","I","T","C","O","M"] } } },
 { "nome": "8 letras certinhas", "setup": { "nome": "labirin8.c" }, "espera": { "mem": { "nome83": ["L","A","B","I","R","I","N","8","C"," "," "] } } }]
--- dicas
Comece enchendo nome83 de espaços: MOV DI,OFFSET nome83 / MOV AL,' ' / MOV CX,11 / CLD / REP STOSB.
Leia com LODSB a partir de nome. Para maiúsculas: se AL estiver entre 'a' e 'z', SUB AL,20h.
Conte as letras do nome em CX (8). Ao achar o ponto, DI = OFFSET nome83 + 8 e CX = 3. Com CX = 0, continue lendo sem gravar (JCXZ).
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: CLD
        MOV  DI, OFFSET nome83
        MOV  AL, ' '
        MOV  CX, 11
        REP  STOSB
        MOV  SI, OFFSET nome
        MOV  DI, OFFSET nome83
        MOV  CX, 8
letra:  LODSB
        CALL MAIUSCULA
        OR   AL, AL
        JZ   fim
        CMP  AL, '.'
        JE   extensao
        JCXZ letra              ; já tem 8: ignora
        STOSB
        DEC  CX
        JMP  letra
extensao:
        MOV  DI, OFFSET nome83+8
        MOV  CX, 3
ext:    LODSB
        CALL MAIUSCULA
        OR   AL, AL
        JZ   fim
        STOSB
        LOOP ext
fim:    MOV  AX, 4C00h
        INT  21h

MAIUSCULA PROC
        CMP  AL, 'a'
        JB   @@sai
        CMP  AL, 'z'
        JA   @@sai
        SUB  AL, 20h
@@sai:  RET
MAIUSCULA ENDP

nome    DB 20 DUP (0)
nome83  DB 11 DUP (0)
END inicio
```

```exercicio
id: a42-3
titulo: Procurar no diretório
nivel: 3
exigir: CMPSB
--- enunciado
**diretorio** tem 4 entradas de 32 bytes no formato do MINIFS (nome nos bytes 0 a 10, primeiro setor nos bytes 12 e 13). **procura** traz um nome de 11 bytes, já no formato 8.3.

Procure o nome nas 4 entradas comparando com `REPE CMPSB`. Se achar, devolva em **AX** o número da entrada (0 a 3) e em **BX** o primeiro setor do arquivo. Se não achar, devolva **AX = 0FFFFh**.
--- inicial
        JMP  inicio
diretorio DB 4*32 DUP (0)
procura   DB 11 DUP (' ')
inicio: ; procure "procura" nas 4 entradas do diretório
        ; AX = entrada e BX = primeiro setor, ou AX = 0FFFFh
        MOV  AX, 0FFFFh
--- testes
[{ "nome": "COBRA COM: entrada 2, setor 12", "setup": { "diretorio": [75, 69, 82, 78, 69, 76, 32, 32, 83, 89, 83, 4, 2, 0, 5, 0, 44, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 83, 72, 69, 76, 76, 32, 32, 32, 67, 79, 77, 32, 7, 0, 5, 0, 105, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 79, 66, 82, 65, 32, 32, 32, 67, 79, 77, 32, 12, 0, 4, 0, 108, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "procura": "COBRA   COM" }, "espera": { "AX": 2, "BX": 12 } },
 { "nome": "KERNEL SYS: entrada 0, setor 2", "setup": { "diretorio": [75, 69, 82, 78, 69, 76, 32, 32, 83, 89, 83, 4, 2, 0, 5, 0, 44, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 83, 72, 69, 76, 76, 32, 32, 32, 67, 79, 77, 32, 7, 0, 5, 0, 105, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 79, 66, 82, 65, 32, 32, 32, 67, 79, 77, 32, 12, 0, 4, 0, 108, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "procura": "KERNEL  SYS" }, "espera": { "AX": 0, "BX": 2 } },
 { "nome": "SHELL COM: entrada 1, setor 7", "setup": { "diretorio": [75, 69, 82, 78, 69, 76, 32, 32, 83, 89, 83, 4, 2, 0, 5, 0, 44, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 83, 72, 69, 76, 76, 32, 32, 32, 67, 79, 77, 32, 7, 0, 5, 0, 105, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 79, 66, 82, 65, 32, 32, 32, 67, 79, 77, 32, 12, 0, 4, 0, 108, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "procura": "SHELL   COM" }, "espera": { "AX": 1, "BX": 7 } },
 { "nome": "PONG COM não está", "setup": { "diretorio": [75, 69, 82, 78, 69, 76, 32, 32, 83, 89, 83, 4, 2, 0, 5, 0, 44, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 83, 72, 69, 76, 76, 32, 32, 32, 67, 79, 77, 32, 7, 0, 5, 0, 105, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 79, 66, 82, 65, 32, 32, 32, 67, 79, 77, 32, 12, 0, 4, 0, 108, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "procura": "PONG    COM" }, "espera": { "AX": 65535 } },
 { "nome": "SHELL COX: quase, mas não", "setup": { "diretorio": [75, 69, 82, 78, 69, 76, 32, 32, 83, 89, 83, 4, 2, 0, 5, 0, 44, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 83, 72, 69, 76, 76, 32, 32, 32, 67, 79, 77, 32, 7, 0, 5, 0, 105, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 79, 66, 82, 65, 32, 32, 32, 67, 79, 77, 32, 12, 0, 4, 0, 108, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "procura": "SHELL   COX" }, "espera": { "AX": 65535 } }]
--- dicas
Um laço de 4 voltas: BX = OFFSET diretorio no começo, ADD BX,32 a cada volta, e DX conta as entradas.
Em cada volta: MOV SI,BX / MOV DI,OFFSET procura / MOV CX,11 / REPE CMPSB. ZF = 1 no fim quer dizer que os 11 bytes bateram.
Achou: MOV AX,DX e MOV BX,[BX+12] (nessa ordem: depois do MOV, BX já não aponta para a entrada).
--- solucao
        JMP  inicio
diretorio DB 4*32 DUP (0)
procura   DB 11 DUP (' ')
inicio: CLD
        MOV  BX, OFFSET diretorio
        XOR  DX, DX             ; DX = número da entrada
entrada:
        MOV  SI, BX
        MOV  DI, OFFSET procura
        MOV  CX, 11
        REPE CMPSB
        JE   achou
        ADD  BX, 32
        INC  DX
        CMP  DX, 4
        JB   entrada
        MOV  AX, 0FFFFh
        JMP  SHORT fim
achou:  MOV  AX, DX
        MOV  BX, [BX+12]
fim:
```

```quiz
? Como o kernel transforma `cobra.com` para procurar no diretório?
- Procura "cobra.com" byte a byte, com o ponto
+ Converte para 11 bytes, `'COBRA   COM'`: 8 de nome e 3 de extensão, com espaços, em maiúsculas e sem o ponto
- Calcula uma soma dos caracteres e procura a soma
> Assim a comparação é sempre de 11 bytes, com REPE CMPSB.

? Por que o kernel guarda SS:SP de quem chamou a 4Bh?
+ Porque o quadro da INT 21h de quem chamou está nessa pilha; quando o programa terminar, o kernel volta para ela e sai da 4Bh com os POPs e o IRET
- Porque o programa novo vai usar a mesma pilha
- Porque a BIOS exige
> TERMINA põe SS:SP de volta, faz BP = SP e salta para FIM_OK: quem chamou sai da INT 21h como se a 4Bh tivesse acabado agora.

? Um .COM termina com `RET`. Para onde ele vai no MINIOS?
- Para o shell, direto
+ Para SEG:0000, porque o kernel deixou um 0 no topo da pilha; ali, no PSP, há `CD 20` (INT 20h), que encerra o programa
- Para 0000:0000, e o PC trava
> É o costume herdado do CP/M e do DOS 1.0, mantido pelo DOS e pelo MINIOS.

? Por que o EXEC salva os vetores 00h a 3Fh?
+ Para que um programa que troque a INT 9 (como os jogos) e termine sem devolvê-la não deixe o shell sem teclado
- Porque o programa novo precisa de uma IVT vazia
- Para acelerar as interrupções
> TERMINA devolve os 64 vetores do jeito que estavam antes do EXEC.

? Onde o kernel do MINIOS põe a linha de comando do programa?
- Em 0000:0080
+ No PSP do programa, em SEG:0080 (tamanho), SEG:0081 (texto) e um 13 no fim
- Em DS:DX, ao saltar para o programa
> O mesmo lugar do DOS: o SETOR.COM lê o número do setor dali.

? Por que o MINIOS só permite dois níveis de programas (3000h e 4000h)?
- Porque o 8086 só tem dois segmentos de dados
+ Porque os segmentos são fixos e cada nível precisa de uma cópia dos vetores e da pilha do pai; dois níveis bastam para um programa rodar outro
- Porque o disquete só cabe dois programas
> O DOS aloca a memória dinamicamente com MCBs e não tem esse limite fixo.

? Um arquivo de 2 348 bytes ocupa quantos setores, e o que fica no resto do último setor?
- 4 setores; o resto é apagado com zeros
+ 5 setores; os 212 bytes que sobram do último também são lidos para a memória, e o tamanho exato fica no diretório
- 5 setores; a INT 13h lê só os bytes que interessam
> A INT 13h só lê setores inteiros. Por isso o diretório guarda o tamanho em bytes.
```

## Desafios

1. **Programas .EXE.** Acrescente ao EXEC a leitura do cabeçalho MZ de um .EXE (os bytes 'MZ', o tamanho do cabeçalho, CS:IP e SS:SP iniciais e a tabela de relocações) e aplique as relocações somando o segmento de carga. O [capítulo 22 do livro](livro:cap22) descreve o cabeçalho. Teste com um programa `.MODEL SMALL` do curso.
2. **Gravar arquivos.** Crie uma função 82h que grava ES:BX com CX bytes num arquivo novo DS:DX: ache uma entrada livre, use o primeiro setor depois do último arquivo, grave com a INT 13h, AH=03h, e grave o diretório de volta no setor 1.
3. **Três níveis.** Mude o kernel para aceitar 3 níveis (5000h passa a ser de programa; mude o buffer do comando TIPO do shell) e teste com um NETO.COM.
4. **Ambiente.** Dê aos programas um bloco de ambiente (`PATH=A:\` e `PROMPT=$P$G`, terminados em 0 e com 00 no fim) e ponha o segmento dele no byte 2Ch do PSP, como o DOS faz. Faça o FILHO.COM mostrar as variáveis.
5. **Erro crítico.** Quando a INT 13h falha três vezes dentro da 81h, em vez de só mostrar a mensagem, pergunte "Abortar, Repetir?" como a INT 24h do DOS, e repita a leitura se o usuário apertar R.

## No livro

- [Capítulo 9, o disquete](livro:cap09): a INT 13h, os erros, a fronteira de 64 KB e a gravação com AH=03h.
- [Capítulo 21, sem DOS](livro:cap21): o EXEC do MINIOS com o mapa de memória completo.
- [Capítulo 22, o DOS por dentro](livro:cap22): a FAT12, a entrada de diretório do DOS ao lado da do MINIFS, o PSP campo a campo, o EXEC 4Bh, os MCBs e as INT 20h a 24h.
- [Capítulo 2, vetores e exceções](livro:cap02): os vetores 00h a 3Fh que o kernel guarda e o que cada um faz.

:::resumo
- O nome digitado vira 11 bytes no formato 8.3 (`NOME_83`: espaços primeiro, letras por cima, maiúsculas, sem o ponto, `JCXZ` para ignorar as letras a mais). Procurar é `REPE CMPSB` de 11 bytes em cada entrada de 32.
- Ler um arquivo é ler os setores seguidos dele, da entrada do diretório (`[SI+12]` e `[SI+14]`), avançando ES:BX 512 bytes. O tamanho exato fica em `[SI+16]`.
- As funções 80h (entrada do diretório) e 81h (arquivo inteiro) são só do MINIOS; erros com CF = 1 e os códigos do DOS (2 = não achou, 18 = fim).
- O EXEC (4Bh): segmento pelo nível (3000h + nível × 1000h), ler para SEG:0100, montar o PSP (CD 20 em 0, a linha de comando em 80h), salvar os vetores 00h a 3Fh, guardar SS:SP de quem chamou, e saltar com SS = DS = ES = CS, SP = FFFEh e um 0 no topo da pilha.
- O fim (4Ch, INT 20h, INT 0): `TERMINA` restaura os vetores e a pilha de quem fez a 4Bh, e `FIM_OK` sai da INT 21h dele. O código de saída fica para a 4Dh. Se o shell terminar, o kernel o carrega de novo.
- O DOS faz o mesmo com mais peças: ambiente, MCBs, .EXE com relocações, e só os vetores 22h a 24h salvos no PSP.
:::
