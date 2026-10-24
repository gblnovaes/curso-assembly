---
id: aula19
numero: 19
modulo: 8
titulo: Menus e entrada de dados
subtitulo: Lendo linhas com a função 0Ah, convertendo texto em número e validando com CF
duracao: 80 min
objetivos: ler uma linha inteira com INT 21h AH=0Ah e entender o formato do buffer; converter texto decimal em número com a regra n = n × 10 + dígito; detectar dígitos inválidos e estouro; sinalizar erros com CF usando STC e CLC, como o DOS faz; montar um menu interativo com uma tabela de saltos
---

## Programas que conversam

Um programa de verdade pergunta coisas ao usuário: "quantos itens?", "qual opção?", "digite o nome do arquivo". Na Aula 14 lemos teclas soltas. Agora vamos ler **linhas inteiras**, com edição (Backspace funciona!), e transformar o texto digitado em números.

## A função 0Ah: entrada com buffer

`INT 21h` com `AH=0Ah` lê uma linha do teclado até o Enter, com eco na tela e edição. Ela grava o resultado em um **buffer** com um formato especial, apontado por **DS:DX**:

```diagrama titulo="O buffer da função 0Ah"
  buf DB 6, ?, 6 DUP(?)

  offset:   0      1      2    3    4    5    6    7
          ┌──────┬──────┬────┬────┬────┬────┬────┬────┐
  antes:  │  6   │  ?   │ ?  │ ?  │ ?  │ ?  │ ?  │ ?  │
          └──────┴──────┴────┴────┴────┴────┴────┴────┘
             │      │
             │      └── o DOS preenche: quantos caracteres foram digitados
             └── você preenche: máximo de caracteres, CONTANDO o Enter

  depois de digitar 1 2 3 Enter:
          ┌──────┬──────┬────┬────┬────┬────┬────┬────┐
          │  6   │  3   │'1' │'2' │'3' │ 0Dh│ ?  │ ?  │
          └──────┴──────┴────┴────┴────┴────┴────┴────┘
```

- **Byte 0** (você preenche): o tamanho máximo, incluindo o Enter. Com 6, o usuário digita no máximo 5 caracteres; o DOS apita se tentar mais.
- **Byte 1** (o DOS preenche): quantos caracteres foram digitados, **sem** contar o Enter.
- **A partir do byte 2**: os caracteres, seguidos de 0Dh (o Enter).

```asm executar titulo="NOME.ASM: lendo uma linha"
.MODEL SMALL
.STACK 100h
.DATA
pergunta DB 'Qual o seu nome? $'
ola      DB 13, 10, 'Ola, $'
buf      DB 21, ?, 21 DUP(?)        ; até 20 caracteres
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET pergunta
        MOV  AH, 09h
        INT  21h

        MOV  DX, OFFSET buf
        MOV  AH, 0Ah                ; lê a linha
        INT  21h

        ; troca o Enter (0Dh) por '$' para imprimir com AH=09h
        MOV  BL, buf+1              ; BL = quantidade digitada
        XOR  BH, BH
        MOV  buf[BX+2], '$'

        MOV  DX, OFFSET ola
        MOV  AH, 09h
        INT  21h
        MOV  DX, OFFSET buf+2       ; o texto começa no byte 2
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

No laboratório, digite um nome na tela do usuário e tecle Enter. Experimente o Backspace e tente digitar mais de 20 letras.

:::atencao O eco do Enter
Quando o usuário tecla Enter, a função 0Ah ecoa só o **retorno de carro** (0Dh): o cursor volta ao começo da mesma linha, mas não desce. Por isso a mensagem seguinte começa com 13, 10. Esquecer isso faz o texto seguinte sobrescrever o que o usuário digitou.
:::

## De texto para número

O usuário digitou `"472"`. Para o programa, isso são três bytes: 34h, 37h, 32h. Para virar o número 472, usamos a mesma regra que você usa de cabeça ao ler da esquerda para a direita:

```diagrama titulo="Convertendo o texto 472 em número"
  n = 0
  '4':  n = 0   × 10 + 4 = 4
  '7':  n = 4   × 10 + 7 = 47
  '2':  n = 47  × 10 + 2 = 472

  dígito = caractere − '0'   (34h − 30h = 4)
```

E a cada passo, duas coisas podem dar errado:

1. **Caractere inválido**: o usuário digitou `"4x2"`. Antes de subtrair '0', verifique se o caractere está entre '0' e '9'.
2. **Estouro**: o usuário digitou `"70000"`. O número não cabe em 16 bits. Depois do `MUL` por 10, se DX ≠ 0 o resultado passou de 65.535; depois de somar o dígito, se CF = 1 também passou.

## Sinalizando erros com CF

Como um procedimento avisa que deu errado? O DOS inventou uma convenção que todo programa da época seguia: **CF = 0 é sucesso, CF = 1 é erro**. Todas as funções de arquivo do DOS (abrir, ler, gravar) devolvem o erro assim.

Duas instruções controlam CF diretamente:

| Instrução | Efeito |
|-----------|--------|
| `CLC` | CF = 0 (*clear carry*) |
| `STC` | CF = 1 (*set carry*) |
| `CMC` | inverte CF (*complement carry*) |

Quem chama testa com `JC` (salta se erro) ou `JNC` (salta se sucesso), logo depois do `CALL`. E como `POP` e `RET` não alteram as flags, o procedimento pode restaurar registradores depois de decidir o CF.

```asm executar titulo="CONVERTE.ASM: texto para número com validação"
.MODEL SMALL
.STACK 100h
.DATA
pede    DB 'Digite um numero (0 a 65535): $'
ok_msg  DB 13, 10, 'Numero valido. O dobro e: $'
erro    DB 13, 10, 'Entrada invalida!$'
buf     DB 7, ?, 7 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET pede
        MOV  AH, 09h
        INT  21h
        MOV  DX, OFFSET buf
        MOV  AH, 0Ah
        INT  21h

        MOV  SI, OFFSET buf
        CALL TEXTO_PARA_NUMERO
        JC   @@invalido

        SHL  AX, 1                  ; o dobro (pode estourar, tudo bem)
        MOV  DX, OFFSET ok_msg
        PUSH AX
        MOV  AH, 09h
        INT  21h
        POP  AX
        CALL IMPRIMIR_NUMERO
        JMP  @@fim
@@invalido:
        MOV  DX, OFFSET erro
        MOV  AH, 09h
        INT  21h
@@fim:  MOV  AX, 4C00h
        INT  21h

; TEXTO_PARA_NUMERO: SI = buffer da função 0Ah
;   sucesso: CF = 0, AX = número
;   erro:    CF = 1 (vazio, caractere inválido ou maior que 65535)
TEXTO_PARA_NUMERO PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        XOR  AX, AX                 ; n = 0
        MOV  CL, [SI+1]             ; quantidade de caracteres
        XOR  CH, CH
        JCXZ @@erro                 ; nada digitado
        ADD  SI, 2
        MOV  BX, 10
@@laco: MOV  DL, [SI]
        CMP  DL, '0'
        JB   @@erro
        CMP  DL, '9'
        JA   @@erro
        PUSH DX                     ; MUL destrói DX
        MUL  BX                     ; DX:AX = n * 10
        POP  DX
        JC   @@erro                 ; MUL liga CF se DX != 0
        SUB  DL, '0'
        ADD  AL, DL                 ; n = n * 10 + dígito
        ADC  AH, 0
        JC   @@erro                 ; passou de 65535
        INC  SI
        LOOP @@laco
        CLC                         ; sucesso
        JMP  @@sai
@@erro: STC
@@sai:  POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
TEXTO_PARA_NUMERO ENDP

; IMPRIMIR_NUMERO: imprime AX (0..65535) em decimal. Preserva tudo.
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

Teste no laboratório com `123`, `65535`, `65536`, `12a` e uma linha vazia.

:::cpu MUL e as flags
Depois de `MUL` com operando de 16 bits, o 8086 liga **CF e OF** quando a parte alta do resultado (DX) é diferente de zero, e zera os dois quando DX = 0. É um jeito barato de saber se a multiplicação "coube" em 16 bits. As outras flags (ZF, SF, PF) ficam indefinidas depois de MUL: não confie nelas.
:::

```quiz
? No buffer da função 0Ah, o que o primeiro byte significa?
+ O máximo de caracteres aceitos, contando o Enter
- Quantos caracteres o usuário digitou
- O primeiro caractere digitado
> Você preenche o byte 0 antes da chamada. O DOS preenche o byte 1 com a quantidade digitada, sem o Enter.

? O usuário digitou "AB" e Enter num buffer 0Ah em buf. Onde está o 0Dh?
- buf+1
- buf+3
+ buf+4
> buf+0 = máximo, buf+1 = 2, buf+2 = 'A', buf+3 = 'B', buf+4 = 0Dh.

? Qual a regra para converter "472" em número, lendo da esquerda para a direita?
- n = n + dígito × 10
+ n = n × 10 + dígito
- n = dígito × 10 + n
> Cada dígito novo empurra os anteriores uma casa decimal para a esquerda.

? Na convenção do DOS, como um procedimento indica erro?
- Devolvendo AX = 0
+ Com CF = 1
- Com ZF = 1
> CF = 0 é sucesso e CF = 1 é erro. Quem chama testa com JC ou JNC logo depois do CALL.

? Por que o procedimento pode fazer POP depois de STC sem perder o erro?
+ Porque POP e RET não alteram as flags
- Porque STC protege CF por algumas instruções
- Porque POP só altera ZF
> MOV, PUSH, POP, CALL, RET e JMP não alteram nenhuma flag.
```

## Menus e tabelas de saltos

Um menu é um laço: mostra as opções, lê uma tecla, executa a ação, volta. Para escolher a ação, o jeito ingênuo é uma cadeia de `CMP`/`JE`. O jeito elegante, usado nos anos 90 em interpretadores e emuladores, é uma **tabela de saltos**: um vetor de endereços indexado pela opção.

```asm fragmento
.DATA
acoes   DW OPCAO_0, OPCAO_1, OPCAO_2, OPCAO_3   ; endereços (near) das rotinas
.CODE
        ; AL = '0'..'3' já validado
        SUB  AL, '0'            ; 0..3
        XOR  AH, AH
        MOV  BX, AX
        SHL  BX, 1              ; cada endereço tem 2 bytes
        CALL acoes[BX]          ; chama a rotina da opção
```

`CALL acoes[BX]` é uma **chamada indireta**: ela lê o endereço de destino da memória. O mesmo vale para `JMP acoes[BX]`. Com 20 opções, a tabela faz o mesmo trabalho que 20 comparações, em tempo constante.

:::atencao Valide antes de indexar
Se o usuário digitar '7' e a tabela só tem 4 entradas, `CALL acoes[BX]` lê um "endereço" qualquer depois da tabela e salta para lá. Sempre verifique os limites antes de usar uma tabela de saltos.
:::

```asm executar titulo="MENU.ASM: um menu completo"
.MODEL SMALL
.STACK 100h
.DATA
menu    DB 13, 10, 201, 20 DUP(205), 187, 13, 10
        DB 186, '  1 - Saudacao      ', 186, 13, 10
        DB 186, '  2 - Contar 1 a 9  ', 186, 13, 10
        DB 186, '  3 - Sobre         ', 186, 13, 10
        DB 186, '  0 - Sair          ', 186, 13, 10
        DB 200, 20 DUP(205), 188, 13, 10
        DB 'Opcao: $'
m_ola   DB 'Bem-vindo ao curso de Assembly 8086!$'
m_sobre DB 'MENU.ASM - escrito em assembly, 1994 style.$'
m_tchau DB 'Ate logo!$'
acoes   DW OPCAO_0, OPCAO_1, OPCAO_2, OPCAO_3
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
@@menu: MOV  DX, OFFSET menu
        MOV  AH, 09h
        INT  21h
@@le:   MOV  AH, 08h            ; lê sem eco
        INT  21h
        CMP  AL, '0'
        JB   @@le               ; ignora teclas fora de '0'..'3'
        CMP  AL, '3'
        JA   @@le
        MOV  BL, AL             ; guarda a opção: AH=02h devolve AL = DL!
        MOV  DL, AL             ; ecoa a opção escolhida
        MOV  AH, 02h
        INT  21h
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        SUB  BL, '0'            ; BX = 0..3
        XOR  BH, BH
        SHL  BX, 1
        CALL acoes[BX]          ; CF = 1 pede para sair
        JNC  @@menu
        MOV  AX, 4C00h
        INT  21h

OPCAO_0 PROC                    ; sair
        MOV  DX, OFFSET m_tchau
        MOV  AH, 09h
        INT  21h
        STC
        RET
OPCAO_0 ENDP

OPCAO_1 PROC                    ; saudação
        MOV  DX, OFFSET m_ola
        MOV  AH, 09h
        INT  21h
        CLC
        RET
OPCAO_1 ENDP

OPCAO_2 PROC                    ; conta de 1 a 9
        MOV  CX, 9
        MOV  DL, '1'
        MOV  AH, 02h
@@laco: INT  21h
        INC  DL
        LOOP @@laco
        CLC
        RET
OPCAO_2 ENDP

OPCAO_3 PROC                    ; sobre
        MOV  DX, OFFSET m_sobre
        MOV  AH, 09h
        INT  21h
        CLC
        RET
OPCAO_3 ENDP
END inicio
```

:::anos90 Menus em modo texto
Os programas DOS de 1990 a 1995 tinham uma cara inconfundível: janelas com bordas duplas (╔═╗), fundo azul, a letra de atalho de cada opção em destaque e uma barra de status embaixo. Era o padrão "CUA" da IBM, seguido pelo *Edit* do MS-DOS, pelo *QBasic*, pelo *Turbo Pascal* e pelos programas de instalação de jogos. Este curso usa o mesmo visual.
:::

## Exercícios

```exercicio
id: a19-1
titulo: Conversor com validação
nivel: 3
exigir: STC
--- enunciado
Escreva **CONVERTER**: SI aponta para um buffer no formato da função 0Ah (já preenchido). Se o texto for um número decimal válido de 0 a 65535, devolva o número em **AX** com **CF = 0**. Se estiver vazio, tiver um caractere que não é dígito ou passar de 65535, devolva **CF = 1**. O programa principal já guarda o resultado em **valor** e **erro**.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
buf     DB 7, 4, '2024', 13, 0
valor   DW 0
erro    DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET buf
        CALL CONVERTER
        MOV  valor, AX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

; CONVERTER: SI = buffer 0Ah -> AX = número, CF = 0 (ok) ou 1 (erro)
CONVERTER PROC
        ; seu código aqui
        RET
CONVERTER ENDP
END inicio
--- testes
[{ "nome": "2024", "espera": { "mem": { "valor": 2024, "erro": 0 } } },
 { "nome": "0", "setup": { "buf": "\u0007\u00010\r" }, "espera": { "mem": { "valor": 0, "erro": 0 } } },
 { "nome": "65535", "setup": { "buf": "\u0007\u000565535\r" }, "espera": { "mem": { "valor": 65535, "erro": 0 } } },
 { "nome": "65536 é erro", "setup": { "buf": "\u0007\u000565536\r" }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "99999 é erro", "setup": { "buf": "\u0007\u000599999\r" }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "12a é erro", "setup": { "buf": "\u0007\u000312a\r" }, "espera": { "mem": { "erro": 1 } } },
 { "nome": "vazio é erro", "setup": { "buf": "\u0007\u0000\r" }, "espera": { "mem": { "erro": 1 } } }]
--- dicas
CX = [SI+1] (a quantidade); se for 0, é erro. Os caracteres começam em SI+2.
Para cada caractere: valide '0'..'9', faça AX = AX × 10 (MUL com BX = 10; CF = 1 se estourou) e some o dígito (ADD e depois JC).
MUL destrói DX: guarde o caractere em outro lugar ou empilhe.
Termine com CLC no caminho de sucesso e STC no de erro.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
buf     DB 7, 4, '2024', 13, 0
valor   DW 0
erro    DB 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET buf
        CALL CONVERTER
        MOV  valor, AX
        MOV  erro, 0
        JNC  @@fim
        MOV  erro, 1
@@fim:  MOV  AX, 4C00h
        INT  21h

CONVERTER PROC
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        XOR  AX, AX
        MOV  CL, [SI+1]
        XOR  CH, CH
        JCXZ @@erro
        ADD  SI, 2
        MOV  BX, 10
@@laco: MOV  DL, [SI]
        CMP  DL, '0'
        JB   @@erro
        CMP  DL, '9'
        JA   @@erro
        PUSH DX
        MUL  BX
        POP  DX
        JC   @@erro
        SUB  DL, '0'
        ADD  AL, DL
        ADC  AH, 0
        JC   @@erro
        INC  SI
        LOOP @@laco
        CLC
        JMP  @@sai
@@erro: STC
@@sai:  POP  SI
        POP  DX
        POP  CX
        POP  BX
        RET
CONVERTER ENDP
END inicio
```

```exercicio
id: a19-2
titulo: Ao contrário
nivel: 2
--- enunciado
Leia uma linha de até 30 caracteres com a função **0Ah** e imprima-a **de trás para frente** na linha seguinte (imprima 13 e 10 antes). Por exemplo, `Assembly` vira `ylbmessA`.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
buf     DB 31, ?, 31 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "Assembly", "entrada": "Assembly\r", "espera": { "saidaContem": "\nylbmessA" } },
 { "nome": "MASM 5.1", "entrada": "MASM 5.1\r", "espera": { "saidaContem": "\n1.5 MSAM" } },
 { "nome": "uma letra", "entrada": "x\r", "espera": { "saidaContem": "\nx" } }]
--- dicas
Depois do INT 21h com AH = 0Ah, a quantidade está em buf+1 e o texto começa em buf+2.
Aponte SI para o último caractere: OFFSET buf + 1 + quantidade.
Imprima [SI] com AH = 02h, DEC SI e repita quantidade vezes (cuidado com quantidade 0 no LOOP).
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
buf     DB 31, ?, 31 DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET buf
        MOV  AH, 0Ah
        INT  21h
        MOV  AH, 02h
        MOV  DL, 13
        INT  21h
        MOV  DL, 10
        INT  21h
        MOV  CL, buf+1
        XOR  CH, CH
        JCXZ @@fim
        MOV  SI, OFFSET buf+1
        ADD  SI, CX         ; SI = último caractere
@@laco: MOV  DL, [SI]
        INT  21h
        DEC  SI
        LOOP @@laco
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a19-3
titulo: Menu com tabela de saltos
nivel: 3
--- enunciado
Complete o menu: leia teclas **sem eco** (`AH=08h`) em laço. A tecla **1** imprime `A`, a **2** imprime `B` e a **3** imprime `C`; a tecla **0** termina o programa; qualquer outra tecla é ignorada. As rotinas e a tabela **acoes** já existem: use a tabela para chamar a rotina certa.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
acoes   DW ACAO_1, ACAO_2, ACAO_3
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; laço: leia uma tecla, valide e chame acoes[...]

        MOV  AX, 4C00h
        INT  21h

ACAO_1  PROC
        MOV  DL, 'A'
        JMP  IMPRIME
ACAO_1  ENDP
ACAO_2  PROC
        MOV  DL, 'B'
        JMP  IMPRIME
ACAO_2  ENDP
ACAO_3  PROC
        MOV  DL, 'C'
        JMP  IMPRIME
ACAO_3  ENDP
IMPRIME PROC                ; imprime DL e retorna para quem chamou a ação
        MOV  AH, 02h
        INT  21h
        RET
IMPRIME ENDP
END inicio
--- testes
[{ "nome": "1 3 2 1 x 0", "entrada": "1321x0", "espera": { "saida": "ACBA", "pilhaEquilibrada": true } },
 { "nome": "teclas inválidas ignoradas", "entrada": "9a3!40", "espera": { "saida": "C" } },
 { "nome": "sai direto", "entrada": "0", "espera": { "saida": "" } }]
--- dicas
Depois de ler: CMP AL,'0' / JE fim. Depois valide '1'..'3' com JB e JA, voltando a ler se estiver fora.
Índice: SUB AL,'1' dá 0..2. Copie para BX, zere BH e faça SHL BX,1.
CALL acoes[BX] chama a rotina; ela retorna para depois do CALL.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
acoes   DW ACAO_1, ACAO_2, ACAO_3
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
@@le:   MOV  AH, 08h
        INT  21h
        CMP  AL, '0'
        JE   @@fim
        CMP  AL, '1'
        JB   @@le
        CMP  AL, '3'
        JA   @@le
        SUB  AL, '1'
        MOV  BL, AL
        XOR  BH, BH
        SHL  BX, 1
        CALL acoes[BX]
        JMP  @@le
@@fim:  MOV  AX, 4C00h
        INT  21h

ACAO_1  PROC
        MOV  DL, 'A'
        JMP  IMPRIME
ACAO_1  ENDP
ACAO_2  PROC
        MOV  DL, 'B'
        JMP  IMPRIME
ACAO_2  ENDP
ACAO_3  PROC
        MOV  DL, 'C'
        JMP  IMPRIME
ACAO_3  ENDP
IMPRIME PROC
        MOV  AH, 02h
        INT  21h
        RET
IMPRIME ENDP
END inicio
```

:::resumo
- `INT 21h` com `AH=0Ah` lê uma linha em DS:DX: byte 0 = máximo (com o Enter), byte 1 = quantidade lida, texto a partir do byte 2, terminado em 0Dh.
- A 0Ah só ecoa o retorno de carro: imprima 13, 10 antes da próxima mensagem.
- Texto para número: n = n × 10 + (caractere − '0'), validando o dígito e o estouro (CF depois de `MUL` e de `ADD`/`ADC`).
- Convenção do DOS: CF = 0 sucesso, CF = 1 erro. `STC`, `CLC` e `CMC` controlam CF; `POP` e `RET` não mexem nas flags.
- Tabelas de saltos (`CALL tabela[BX]`) trocam cadeias de comparações por um acesso indexado. Valide o índice antes.
:::
