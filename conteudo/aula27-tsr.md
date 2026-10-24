---
id: aula27
numero: 27
modulo: 11
titulo: Programas residentes (TSR)
subtitulo: Terminar e continuar na memória com AH=31h, ganchos no timer e um relógio no canto da tela
duracao: 100 min
objetivos: entender o que é um programa residente e por que o DOS precisava deles; organizar um .COM com a parte residente na frente e o instalador no fim; calcular em DX quantos parágrafos ficam na memória; enganchar a INT 1Ch e encadear com a rotina antiga usando JMP DWORD PTR CS:antigo; acessar variáveis dentro da rotina com o prefixo CS:; escrever um relógio residente na memória de vídeo; liberar o bloco de ambiente; saber por que não chamar o DOS de dentro de uma interrupção; impedir que o programa seja instalado duas vezes
---

## Um sistema de uma tarefa só

O DOS roda **um programa de cada vez**. Quando o programa termina com `AH=4Ch`, o DOS devolve toda a memória dele e carrega o próximo no mesmo lugar. Não existe "deixar algo rodando em segundo plano".

Só que os usuários queriam exatamente isso: um relógio no canto da tela, uma calculadora que aparece com uma tecla de atalho no meio do editor de texto, um driver de mouse, um teclado com acentos. A saída foi um truque oficial do próprio DOS: a função **31h**, *Terminate and Stay Resident* (terminar e ficar residente). O programa termina, o controle volta ao prompt, mas **uma parte da memória dele continua reservada**. Se essa parte tiver uma rotina pendurada em alguma interrupção, ela continua sendo chamada, para sempre.

:::anos90 A era dos TSRs
No fim dos anos 80, o *SideKick*, da Borland, ficou famoso por abrir uma agenda, uma calculadora e um bloco de notas por cima de qualquer programa, com Ctrl+Alt. Logo vieram dezenas de outros: drivers de mouse (`MOUSE.COM`), o `DOSKEY` (histórico de comandos), o `KEYB` (teclado brasileiro), cache de disco, antivírus. O `CONFIG.SYS` e o `AUTOEXEC.BAT` de um PC de 1993 carregavam vários, e cada byte deles saía dos preciosos 640 KB. Daí a obsessão da época por "memória convencional livre".
:::

Um TSR não é um programa rodando em paralelo. Ele é **só código parado na memória**, esperando ser chamado por uma interrupção. Tudo o que você aprendeu na aula de rotinas de interrupção continua valendo, com uma diferença: agora o "programa principal" já terminou, e quem está rodando é o DOS ou qualquer outro programa.

## A anatomia de um TSR

Quase todo TSR é um `.COM`, porque nele CS = DS = ES = SS = segmento do PSP e tudo cabe em um único segmento. A organização clássica é esta:

```diagrama titulo="RELOGIO.COM na memória"
  segmento do PSP
  ┌──────────────────────────┐ offset 0000h
  │ PSP (256 bytes)          │  fica: o DOS precisa dele
  ├──────────────────────────┤ offset 0100h  ← ORG 100h
  │ JMP instalar             │
  │ antigo   DD ?            │  PARTE RESIDENTE
  │ variáveis da rotina      │  (fica na memória)
  │ rotina da interrupção    │
  ├──────────────────────────┤ ← rótulo instalar
  │ instalador:              │  PARTE TRANSITÓRIA
  │  guarda o vetor antigo   │  (roda uma vez e é
  │  instala o novo          │   descartada pelo DOS)
  │  calcula DX, AH = 31h    │
  │ mensagens                │
  └──────────────────────────┘
```

A ideia é simples: o DOS guarda a memória do começo do PSP até onde você mandar. Tudo que vem **depois** desse ponto é devolvido. Por isso o instalador, que só roda uma vez, fica no fim, e a primeira instrução do programa é um `JMP` que pula a parte residente.

### AH = 31h: quanto fica

| Registrador | Conteúdo |
|-------------|----------|
| AH | 31h |
| AL | código de saída (como no 4Ch) |
| DX | quantos **parágrafos** (blocos de 16 bytes) manter, contando **a partir do PSP** |

Como o `.COM` começa com `ORG 100h`, os offsets do programa já contam os 256 bytes do PSP. O offset do rótulo `instalar` é exatamente o número de bytes que precisam ficar. Falta só transformar bytes em parágrafos, **arredondando para cima**:

```asm fragmento
        MOV  DX, OFFSET instalar + 15   ; arredonda para cima
        MOV  CL, 4
        SHR  DX, CL                     ; DX = bytes / 16
        MOV  AX, 3100h                  ; AH = 31h, AL = 0
        INT  21h                        ; não volta!
```

:::atencao Arredonde para cima
Se o rótulo `instalar` estiver no offset 01ACh (428 bytes), dividir por 16 com `SHR` sozinho dá 1Ah (26 parágrafos = 416 bytes), e os últimos 12 bytes da sua rotina são devolvidos ao DOS. O próximo programa carregado escreve por cima deles e, na próxima interrupção, o PC trava. Somar 15 antes de dividir garante que o último pedaço também fique: (428 + 15) / 16 = 27.
:::

Em um `.EXE` a conta é mais trabalhosa (o PSP fica em um segmento e o código em outro, e a pilha costuma ficar no fim), e por isso os TSRs eram quase sempre `.COM`.

## As variáveis da rotina: sempre com CS:

Quando o timer chama a sua rotina, DS aponta para os dados de quem foi interrompido: o DOS, o editor de texto, um jogo. Na aula 15 a rotina carregava `MOV AX,@DATA` / `MOV DS,AX`. Em um `.COM` residente não há `@DATA`: os dados estão no mesmo segmento do código. A forma mais curta e segura de acessá-los é o **prefixo de segmento CS:**, porque CS é o único registrador de segmento que você tem certeza que aponta para o seu programa quando a rotina começa:

```asm fragmento
novo1C  PROC FAR
        INC  CS:tiques          ; CS: = "a variável que está no MEU segmento"
        JMP  CS:antigo          ; encadeia com quem estava antes
novo1C  ENDP
```

Sem o `CS:`, o `INC tiques` incrementaria um byte qualquer nos dados do programa interrompido. O erro é silencioso e terrível: o *seu* TSR funciona, e algum *outro* programa começa a se comportar de um jeito estranho.

## Encadear: JMP DWORD PTR CS:antigo

Outros TSRs podem ter se pendurado na mesma interrupção antes de você. O vetor que você leu com `AH=35h` aponta para o anterior, que aponta para outro anterior, até chegar à BIOS. Uma rotina educada faz o seu trabalho e **passa a vez** para a anterior:

```diagrama titulo="Uma corrente de rotinas na INT 1Ch"
  IRQ 0 ─► INT 08h (BIOS) ─► INT 1Ch
                               │
               vetor 1Ch ──► SEU RELÓGIO ──JMP CS:antigo──┐
                                                          ▼
                              TSR instalado antes ──JMP──┐
                                                         ▼
                                       IRET da BIOS (o fim da corrente)
```

O `JMP` far indireto para `antigo` (que é um `DD`, ou seja, um ponteiro segmento:offset) não empilha nada. A rotina anterior encontra na pilha **exatamente** o que encontraria se fosse chamada direto pela interrupção: IP, CS e FLAGS. Quando ela fizer o `IRET`, volta direto para o programa interrompido. Por isso, antes do `JMP`, a sua rotina precisa ter desempilhado tudo o que empilhou.

| Forma | O que faz | Quando usar |
|-------|-----------|-------------|
| `JMP CS:antigo` | passa a vez, sem volta | o seu trabalho já terminou (mais comum) |
| `PUSHF` / `CALL CS:antigo` | chama a anterior e **volta** para você | você quer fazer algo depois dela |

:::dica DWORD PTR
`antigo` foi definido com `DD`, então o montador já sabe que é um ponteiro de 4 bytes e gera o salto far. Muitos programadores escreviam `JMP DWORD PTR CS:antigo` mesmo assim, para deixar claro para quem lê. As duas formas geram os mesmos bytes.
:::

## O primeiro TSR

Este programa mostra um dígito no canto superior direito da tela que muda a cada tique do timer. Rode no laboratório: depois do `AH=31h`, o simulador mostra o prompt `C:\CURSO>` do DOS, e o dígito continua mudando. Digite algo no prompt: o DOS responde, e o TSR continua lá.

```asm executar titulo="DIGITO.COM: o primeiro programa residente"
; DIGITO.COM - mostra um dígito que muda a cada tique, no canto da tela
        ORG  100h
inicio: JMP  instalar

; ---------------- parte residente ----------------
antigo  DD   ?                  ; vetor original da INT 1Ch
tiques  DW   0                  ; quantos tiques já vimos

novo1C  PROC FAR
        INC  CS:tiques
        PUSH AX
        PUSH ES
        MOV  AX, 0B800h         ; memória de vídeo do modo texto
        MOV  ES, AX
        MOV  AX, CS:tiques
        AND  AL, 7              ; 0 a 7
        ADD  AL, '0'
        MOV  AH, 1Eh            ; amarelo sobre azul
        MOV  ES:[158], AX       ; linha 0, coluna 79 (79 * 2 = 158)
        POP  ES
        POP  AX
        JMP  CS:antigo          ; passa a vez para a rotina anterior
novo1C  ENDP

; ---------------- parte transitória ----------------
instalar:
        MOV  AX, 351Ch          ; guarda o vetor antigo
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES

        MOV  DX, OFFSET novo1C  ; DS já é igual a CS em um .COM
        MOV  AX, 251Ch
        INT  21h

        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h

        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL             ; parágrafos até o fim da parte residente
        MOV  AX, 3100h
        INT  21h

msg     DB   'DIGITO instalado. Olhe o canto da tela.', 13, 10, '$'
```

Observe três detalhes:

- `msg` fica **depois** de `instalar`: a mensagem só é usada uma vez e não precisa ficar na memória.
- Na hora de instalar não é preciso trocar DS, como era na aula 15: em um `.COM`, DS já é o segmento do código.
- A rotina escreve direto na memória de vídeo (`B800h`). Ela **não** usa `INT 21h` nem `INT 10h`. Veremos o porquê daqui a pouco.

:::cpu Dois bytes de uma vez
`MOV ES:[158],AX` grava o caractere (AL) no offset 158 e o atributo (AH) no 159 com uma instrução só. Isso só funciona porque o 8086 é *little-endian*: o byte baixo da word vai para o endereço menor, e na memória de vídeo o caractere vem antes do atributo.
:::

## O relógio de verdade

A BIOS conta os tiques desde a meia-noite em uma variável de 32 bits no endereço **0040:006Ch**. São cerca de 18,2 tiques por segundo (1.193.182 / 65.536 = 18,2065), ou 1.573.040 por dia. Com esse contador dá para mostrar a hora sem perguntar nada ao DOS:

```diagrama titulo="Dos tiques à hora"
  tiques (32 bits, DX:AX)
     │  ÷ 1092          (≈ tiques por minuto: 18,2065 × 60 = 1092,4)
     ├──► AX = minutos desde a meia-noite (0 a 1439)
     │       ÷ 60  ──► AL = horas, AH = minutos
     └──► DX = tiques que sobraram (0 a 1091)
             × 10 ÷ 182  ──► segundos (0 a 59)
```

Por que não dividir os tiques por 18 e pronto? Porque o resultado (segundos desde a meia-noite, até 86.399) não cabe em 16 bits, e o `DIV` de 32 por 16 bits do 8086 geraria uma exceção de divisão. Dividindo primeiro por 1092, o quociente fica abaixo de 1440 e cabe em AX. O preço é um pequeno erro, de cerca de meio minuto no fim do dia, porque 1092 não é exatamente 1092,4. Os relógios residentes da época conviviam com aproximações assim.

```asm executar titulo="RELOGIO.COM: hora no canto superior direito"
; RELOGIO.COM - relógio residente (HH:MM:SS) no canto superior direito
        ORG  100h
inicio: JMP  instalar

; ---------------- parte residente ----------------
antigo  DD   ?

novo1C  PROC FAR
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH DI
        PUSH DS
        PUSH ES
        CLD                     ; não confie em DF: quem foi interrompido pode ter feito STD

        MOV  AX, 40h            ; área de dados da BIOS
        MOV  DS, AX
        MOV  AX, DS:[6Ch]       ; DX:AX = tiques desde a meia-noite
        MOV  DX, DS:[6Eh]
        MOV  CX, 1092
        DIV  CX                 ; AX = minutos desde 0h, DX = sobra
        MOV  BX, AX             ; BX = minutos
        MOV  AX, DX
        MOV  CX, 10
        MUL  CX                 ; DX:AX = sobra × 10
        MOV  CX, 182
        DIV  CX                 ; AX = segundos
        MOV  CH, AL             ; CH = segundos
        MOV  AX, BX
        MOV  BL, 60
        DIV  BL                 ; AL = horas, AH = minutos
        MOV  CL, AH             ; CL = minutos

        MOV  BX, 0B800h
        MOV  ES, BX
        MOV  DI, 144            ; linha 0, coluna 72
        CALL DOISDIG            ; horas
        MOV  AX, 1F3Ah          ; ':' branco sobre azul
        STOSW
        MOV  AL, CL
        CALL DOISDIG            ; minutos
        MOV  AX, 1F3Ah
        STOSW
        MOV  AL, CH
        CALL DOISDIG            ; segundos

        POP  ES
        POP  DS
        POP  DI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        JMP  CS:antigo
novo1C  ENDP

; escreve AL (0 a 99) com dois dígitos em ES:DI, avançando DI
DOISDIG PROC NEAR
        MOV  AH, 0
        MOV  BL, 10
        DIV  BL                 ; AL = dezena, AH = unidade
        ADD  AX, 3030h          ; os dois viram caracteres ASCII
        MOV  BL, AH             ; guarda a unidade
        MOV  AH, 1Fh
        STOSW                   ; dezena
        MOV  AL, BL
        STOSW                   ; unidade (AH continua 1Fh)
        RET
DOISDIG ENDP

; ---------------- parte transitória ----------------
instalar:
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET novo1C
        MOV  AX, 251Ch
        INT  21h

        MOV  ES, DS:[2Ch]       ; segmento do bloco de ambiente (está no PSP)
        MOV  AH, 49h            ; devolve o ambiente ao DOS: o TSR não precisa dele
        INT  21h

        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h

msg     DB   'RELOGIO instalado.', 13, 10, '$'
```

:::atencao O relógio do simulador
O simulador "liga o PC" à meia-noite, então o relógio começa em 00:00:00. E, como o timer do simulador dispara a cada 3.000 instruções, a velocidade do relógio depende da velocidade escolhida no laboratório: em "Máxima" ele corre muito mais rápido que um relógio de verdade.
:::

A rotina chama `DOISDIG` com `CALL`. Uma rotina de interrupção pode chamar procedimentos à vontade, desde que eles também estejam na parte residente. `DOISDIG` está antes de `instalar`, então fica na memória.

### Devolvendo o ambiente

Todo programa recebe do DOS uma cópia das variáveis de ambiente (`PATH=...`, `COMSPEC=...`) em um bloco de memória separado. O segmento desse bloco está no offset **2Ch do PSP**. Um TSR quase nunca precisa dele, e devolvê-lo com `AH=49h` (ES = segmento do bloco) economiza algumas centenas de bytes. Por isso o `RELOGIO.COM` faz `MOV ES,DS:[2Ch]` antes de terminar: em um `.COM`, DS aponta para o PSP.

## Nada de DOS dentro da rotina

Por que o relógio escreve direto em `B800h` em vez de usar `INT 21h` com `AH=09h`? Porque o DOS **não é reentrante**: ele guarda o estado de cada chamada em variáveis internas fixas, não na pilha de quem chamou.

```diagrama titulo="Como travar o DOS com um TSR"
  programa lendo um arquivo
     └─► INT 21h, AH=3Fh ──► o DOS está no meio da leitura
                               │ (variáveis internas em uso)
              IRQ 0 chega ─────┘
                 └─► INT 08h ─► INT 1Ch ─► SEU TSR
                                             └─► INT 21h, AH=09h
                                                 └─► o DOS sobrescreve as
                                                     variáveis da leitura
                                                     que estava no meio. Pane.
```

Na rotina de um timer ou de um teclado:

- **Pode:** ler e escrever memória (inclusive a de vídeo e a área da BIOS), portas de E/S, chamar a BIOS com cuidado.
- **Não pode:** chamar `INT 21h`, a menos que tenha certeza de que o DOS não está ocupado.

Como saber se o DOS está ocupado? A função não documentada `AH=34h` devolve em ES:BX o endereço de um byte, a **flag InDOS**, que vale diferente de zero enquanto o DOS executa uma função. TSRs sofisticados, como os que gravavam arquivos ou abriam janelas, consultavam essa flag a cada tique e só faziam o trabalho pesado quando ela estava zerada. Muitos também se penduravam na **INT 28h**, que o DOS chama enquanto espera o usuário digitar um comando: ali é seguro usar as funções de arquivo.

```asm fragmento
; no instalador: guarda o endereço da flag InDOS
        MOV  AH, 34h
        INT  21h                ; ES:BX = endereço da flag
        MOV  WORD PTR CS:indos, BX
        MOV  WORD PTR CS:indos+2, ES

; na rotina: só usa o DOS se ele estiver livre
        PUSH DS
        PUSH BX
        LDS  BX, CS:indos       ; DS:BX = flag InDOS
        CMP  BYTE PTR [BX], 0
        POP  BX
        POP  DS
        JNE  @@depois           ; DOS ocupado: tenta no próximo tique
```

:::dica Rotinas curtas
Mesmo sem chamar o DOS, lembre que a sua rotina roda 18 vezes por segundo, dentro de outro programa, com as interrupções desligadas. Faça o mínimo: atualize um contador, escreva alguns caracteres na tela e saia. Contas demoradas deixam o PC inteiro mais lento.
:::

## Já estou instalado?

Rode o `RELOGIO.COM` duas vezes e você terá **dois** relógios residentes, um encadeado no outro, gastando o dobro da memória e escrevendo no mesmo lugar. Um TSR bem educado verifica se já está na memória antes de se instalar.

O jeito padronizado pela Microsoft é a **INT 2Fh**, a interrupção **multiplex**. Cada TSR escolhe um número de identificação (de C0h a FFh, a faixa livre para programas do usuário) e se pendura na INT 2Fh. Quando alguém chama `INT 2Fh` com AH = esse número e AL = 0, o TSR responde AL = FFh, "estou instalado". Se o número for de outro programa, ele passa a vez para o anterior.

```asm fragmento
; ---- parte residente ----
antigo2F DD   ?
novo2F  PROC FAR
        CMP  AH, 0C0h           ; é comigo?
        JNE  @@outro
        MOV  AL, 0FFh           ; sim: "já estou instalado"
        IRET
@@outro:
        JMP  CS:antigo2F        ; não: passa a vez
novo2F  ENDP

; ---- instalador, antes de tudo ----
instalar:
        MOV  AX, 0C000h         ; AH = nossa identificação, AL = 0
        INT  2Fh
        CMP  AL, 0FFh
        JNE  @@instala
        MOV  DX, OFFSET ja_esta
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C01h          ; termina normalmente, sem ficar residente
        INT  21h
@@instala:
        ...                     ; engancha a 2Fh e a 1Ch, AH = 31h
```

Repare que `novo2F` termina com `IRET` quando a pergunta é para ele: aqui ele **responde** em vez de passar a vez. Quando ninguém responde, a corrente chega à rotina original, que devolve AL inalterado (0), e o instalador sabe que pode prosseguir.

:::anos90 Assinaturas
Antes da INT 2Fh se popularizar, muitos TSRs usavam uma **assinatura**: um texto fixo, como `'RELOGIO v1'`, logo antes da rotina. O instalador lia o vetor atual com `AH=35h` e comparava os bytes em ES:(BX − 10) com a assinatura usando `REPE CMPSB`. Se fossem iguais, a rotina já era a dele. O método falha se outro TSR se instalar depois na mesma interrupção, e foi por isso que a multiplex ganhou.
:::

```quiz
? O que a função AH = 31h da INT 21h faz?
- Carrega um programa residente do disco
+ Termina o programa mas mantém na memória os DX parágrafos a partir do PSP
- Suspende o programa até a próxima interrupção
> O programa termina de verdade: o DOS volta ao prompt. Só a memória continua reservada, e as rotinas instaladas nela continuam sendo chamadas pelas interrupções.

? Por que o instalador fica no fim de um TSR?
+ Porque o DOS guarda a memória só até o ponto indicado em DX; o que vem depois é devolvido
- Porque o 8086 executa o código de trás para frente
- Porque o PSP fica no fim do programa
> O instalador roda uma única vez. Colocando-o depois da parte residente, ele é descartado e não gasta memória.

? O rótulo instalar está no offset 0233h de um .COM. Quanto deve valer DX?
- 23h
+ 24h
- 33h
> 0233h = 563 bytes. (563 + 15) / 16 = 36 = 24h. Sem o arredondamento, SHR daria 23h e os últimos 3 bytes da parte residente seriam perdidos.

? Por que a rotina usa INC CS:tiques em vez de INC tiques?
- Porque CS: é mais rápido
+ Porque, quando a interrupção chega, DS aponta para os dados de quem foi interrompido; só CS com certeza aponta para o TSR
- Porque variáveis em .COM só podem ser lidas com CS:
> Sem o prefixo, a instrução usaria DS e alteraria a memória de outro programa.

? O que JMP CS:antigo faz no fim da rotina da INT 1Ch?
- Volta para o programa interrompido
+ Salta para a rotina que estava instalada antes, que encontra a pilha intacta e faz o IRET
- Desinstala o TSR
> É um salto far indireto. Nada é empilhado, então a rotina anterior se comporta como se tivesse sido chamada direto pela interrupção.

? Por que um TSR de timer não deve chamar INT 21h?
- Porque a INT 21h não existe depois do AH=31h
- Porque a INT 21h desliga o timer
+ Porque o DOS não é reentrante: se ele já estiver no meio de uma função, a nova chamada estraga o estado da anterior
> A flag InDOS (AH=34h) e a INT 28h eram os recursos usados pelos TSRs que realmente precisavam do DOS.
```

## Exercícios

```exercicio
id: a27-1
titulo: Contador residente
nivel: 2
--- enunciado
Complete o TSR: o instalador deve guardar o vetor antigo da **INT 1Ch** em **antigo**, instalar **novo1C** e terminar residente com **AH = 31h**, mantendo na memória tudo até o rótulo **instalar**. A rotina **novo1C** deve somar 1 na variável residente **tiques** a cada tique e passar a vez para a rotina antiga.

O teste instala o programa e deixa o "DOS" rodando por 31.500 instruções, o suficiente para 10 tiques.
--- inicial
        ORG  100h
inicio: JMP  instalar

antigo  DD   ?
tiques  DW   0

novo1C  PROC FAR
        ; some 1 em tiques e passe a vez para a rotina antiga
novo1C  ENDP

instalar:
        ; 1. guarde o vetor antigo da INT 1Ch
        ; 2. instale novo1C
        ; 3. termine residente

        MOV  AX, 4C00h
        INT  21h
--- testes
[{ "nome": "10 tiques contados depois de instalado", "residente": { "passos": 31500 }, "espera": { "status": "residente", "mem": { "tiques": 10 } } }]
--- dicas
A rotina precisa só de duas instruções: INC CS:tiques e JMP CS:antigo. Sem o CS:, o INC alteraria a memória de outro programa.
Guardar: MOV AX,351Ch / INT 21h / MOV WORD PTR antigo,BX / MOV WORD PTR antigo+2,ES.
Instalar: MOV DX,OFFSET novo1C / MOV AX,251Ch / INT 21h (em um .COM, DS já é o segmento certo).
Terminar: MOV DX,OFFSET instalar+15 / MOV CL,4 / SHR DX,CL / MOV AX,3100h / INT 21h. Apague o 4Ch.
--- solucao
        ORG  100h
inicio: JMP  instalar

antigo  DD   ?
tiques  DW   0

novo1C  PROC FAR
        INC  CS:tiques
        JMP  CS:antigo
novo1C  ENDP

instalar:
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET novo1C
        MOV  AX, 251Ch
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
```

```exercicio
id: a27-2
titulo: Quantos parágrafos?
nivel: 1
--- enunciado
Este TSR funciona no simulador, mas trava em um PC de verdade algum tempo depois de instalado. O problema está na conta de **DX** antes do `AH = 31h`: ela não mantém a parte residente inteira, que vai do PSP até o rótulo **fim_res**. Corrija a conta.

Dica de depuração: veja na listagem o offset de `fim_res` e faça a conta à mão.
--- inicial
        ORG  100h
inicio: JMP  instalar

antigo  DD   ?
marca   DB   'TSR do curso'
novo1C  PROC FAR
        PUSH AX
        PUSH ES
        MOV  AX, 0B800h
        MOV  ES, AX
        XOR  BYTE PTR ES:[1], 70h   ; pisca o fundo do primeiro caractere
        POP  ES
        POP  AX
        JMP  CS:antigo
novo1C  ENDP
fim_res:

instalar:
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET novo1C
        MOV  AX, 251Ch
        INT  21h
        MOV  DX, OFFSET fim_res     ; quantos bytes ficam
        MOV  CL, 4
        SHR  DX, CL                 ; ... em parágrafos
        MOV  AX, 3100h
        INT  21h
--- testes
[{ "nome": "DX cobre a parte residente inteira", "espera": { "status": "residente", "DX": 19 } }]
--- dicas
fim_res está no offset 0126h (294 bytes, contando o PSP). Quantos parágrafos de 16 bytes são necessários para guardar 294 bytes?
SHR divide e joga fora o resto: 294 / 16 = 18, que guarda só 288 bytes. Os últimos 6 bytes da rotina (o POP AX e o JMP CS:antigo!) seriam devolvidos ao DOS.
Some 15 antes de dividir: MOV DX,OFFSET fim_res+15.
--- solucao
        ORG  100h
inicio: JMP  instalar

antigo  DD   ?
marca   DB   'TSR do curso'
novo1C  PROC FAR
        PUSH AX
        PUSH ES
        MOV  AX, 0B800h
        MOV  ES, AX
        XOR  BYTE PTR ES:[1], 70h
        POP  ES
        POP  AX
        JMP  CS:antigo
novo1C  ENDP
fim_res:

instalar:
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET novo1C
        MOV  AX, 251Ch
        INT  21h
        MOV  DX, OFFSET fim_res + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
```

```exercicio
id: a27-3
titulo: Cata-vento no canto
nivel: 2
--- enunciado
Escreva a rotina **novo1C** de um TSR que mostra um "cata-vento" girando no canto superior direito da tela (linha 0, coluna 79), com o atributo **0Eh** (amarelo sobre preto). A cada tique, some 1 em **passo** e mostre o caractere `helice[passo AND 3]`: depois de 1 tique aparece `/`, depois de 2 aparece `-`, depois de 3 aparece `\`, depois de 4 volta a `|`.

Preserve todos os registradores que usar e passe a vez para a rotina antiga no fim. O instalador já está pronto.
--- inicial
        ORG  100h
inicio: JMP  instalar

antigo  DD   ?
passo   DW   0
helice  DB   '|/-\'

novo1C  PROC FAR
        ; seu código aqui
        JMP  CS:antigo
novo1C  ENDP

instalar:
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET novo1C
        MOV  AX, 251Ch
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
--- testes
[{ "nome": "10 tiques: '-'", "residente": { "passos": 31500 }, "espera": { "status": "residente", "video": { "79": ["-", 14] }, "mem": { "passo": 10 } } },
 { "nome": "11 tiques: '\\'", "residente": { "passos": 34500 }, "espera": { "status": "residente", "video": { "79": ["\\", 14] } } },
 { "nome": "12 tiques: '|'", "residente": { "passos": 37500 }, "espera": { "status": "residente", "video": { "79": ["|", 14] } } }]
--- dicas
Comece com INC CS:passo. Depois carregue o índice: MOV BX,CS:passo / AND BX,3.
O caractere é MOV AL,CS:helice[BX]. Não esqueça o CS: também aqui.
Aponte ES para 0B800h e grave em ES:[158] (caractere) e ES:[159] (atributo). Ou monte AH = 0Eh e grave AX de uma vez.
Empilhe AX, BX e ES no começo e desempilhe na ordem inversa antes do JMP.
--- solucao
        ORG  100h
inicio: JMP  instalar

antigo  DD   ?
passo   DW   0
helice  DB   '|/-\'

novo1C  PROC FAR
        PUSH AX
        PUSH BX
        PUSH ES
        INC  CS:passo
        MOV  BX, CS:passo
        AND  BX, 3
        MOV  AL, CS:helice[BX]
        MOV  AH, 0Eh
        MOV  BX, 0B800h
        MOV  ES, BX
        MOV  ES:[158], AX
        POP  ES
        POP  BX
        POP  AX
        JMP  CS:antigo
novo1C  ENDP

instalar:
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        MOV  DX, OFFSET novo1C
        MOV  AX, 251Ch
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
```

```exercicio
id: a27-4
titulo: Não se instale duas vezes
nivel: 3
exigir: IRET
--- enunciado
Este TSR se identifica pela INT 2Fh com o número **C0h**. O instalador já está pronto: ele pergunta se o TSR está na memória antes de se instalar, se pendura na INT 2Fh e, para conferir, faz mais duas perguntas depois de instalado, guardando as respostas em **antes**, **depois** e **outro**.

Escreva a rotina **novo2F**:

- se **AH = C0h**, responda **AL = FFh** e volte com `IRET`;
- para qualquer outro valor de AH, passe a vez para a rotina antiga (em **antigo2F**), sem mexer em nenhum registrador.

Esperado: `antes` = 0 (ninguém respondeu antes da instalação), `depois` = FFh e `outro` = 0 (a pergunta com AH = 16h não é para você e deve seguir pela corrente).
--- inicial
        ORG  100h
inicio: JMP  instalar

antigo2F DD  ?
antes   DB   ?
depois  DB   ?
outro   DB   ?

novo2F  PROC FAR
        JMP  CS:antigo2F
novo2F  ENDP

instalar:
        MOV  AX, 0C000h         ; já estou na memória?
        INT  2Fh
        MOV  antes, AL
        CMP  AL, 0FFh
        JNE  @@instala
        MOV  DX, OFFSET ja_esta
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C01h
        INT  21h
@@instala:
        MOV  AX, 352Fh
        INT  21h
        MOV  WORD PTR antigo2F, BX
        MOV  WORD PTR antigo2F+2, ES
        MOV  DX, OFFSET novo2F
        MOV  AX, 252Fh
        INT  21h

        MOV  AX, 0C000h         ; autoteste: agora deve responder FFh
        INT  2Fh
        MOV  depois, AL
        MOV  AX, 1600h          ; pergunta de outro programa
        INT  2Fh
        MOV  outro, AL

        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h

ja_esta DB   'Ja estou instalado.', 13, 10, '$'
--- testes
[{ "nome": "responde só ao número C0h", "espera": { "status": "residente", "mem": { "antes": 0, "depois": 255, "outro": 0 } } }]
--- dicas
Comece com CMP AH,0C0h. Se for diferente, salte para o JMP CS:antigo2F que já existe.
Se for igual: MOV AL,0FFh e IRET. Essa rotina responde em vez de passar a vez.
Use um rótulo local como @@outro antes do JMP, para não colidir com outros nomes.
--- solucao
        ORG  100h
inicio: JMP  instalar

antigo2F DD  ?
antes   DB   ?
depois  DB   ?
outro   DB   ?

novo2F  PROC FAR
        CMP  AH, 0C0h
        JNE  @@outro
        MOV  AL, 0FFh
        IRET
@@outro:
        JMP  CS:antigo2F
novo2F  ENDP

instalar:
        MOV  AX, 0C000h
        INT  2Fh
        MOV  antes, AL
        CMP  AL, 0FFh
        JNE  @@instala
        MOV  DX, OFFSET ja_esta
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C01h
        INT  21h
@@instala:
        MOV  AX, 352Fh
        INT  21h
        MOV  WORD PTR antigo2F, BX
        MOV  WORD PTR antigo2F+2, ES
        MOV  DX, OFFSET novo2F
        MOV  AX, 252Fh
        INT  21h

        MOV  AX, 0C000h
        INT  2Fh
        MOV  depois, AL
        MOV  AX, 1600h
        INT  2Fh
        MOV  outro, AL

        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h

ja_esta DB   'Ja estou instalado.', 13, 10, '$'
```

:::resumo
- Um TSR termina com **INT 21h, AH = 31h**, e DX diz quantos parágrafos (16 bytes) ficam na memória a partir do PSP. Arredonde para cima: `MOV DX,OFFSET instalar+15` / `MOV CL,4` / `SHR DX,CL`.
- Organize o `.COM` com a **parte residente na frente** e o **instalador no fim**, para que ele seja descartado.
- Dentro da rotina, acesse as variáveis com **CS:**, porque DS pertence a quem foi interrompido. Use `CLD` se for usar instruções de string.
- Passe a vez com **`JMP CS:antigo`** (sem volta) ou chame com `PUSHF` / `CALL CS:antigo` (com volta).
- A BIOS conta os tiques desde a meia-noite em **0040:006Ch** (32 bits, 18,2 por segundo).
- Devolva o bloco de ambiente com `AH=49h` e ES = palavra do offset 2Ch do PSP.
- **Não chame o DOS** de dentro de uma rotina de hardware: ele não é reentrante. A flag InDOS (`AH=34h`) e a INT 28h existem para isso.
- Use a **INT 2Fh** (multiplex, números C0h a FFh) para saber se o TSR já está instalado.
:::
