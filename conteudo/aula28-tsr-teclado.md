---
id: aula28
numero: 28
modulo: 11
titulo: O teclado por dentro e TSRs com tecla de atalho
subtitulo: Scan codes na porta 60h, a INT 9, o buffer da BIOS, teclas de atalho e desinstalação
duracao: 100 min
objetivos: entender o caminho de uma tecla do teclado até a INT 16h; distinguir o código de aperto (make) do código de soltura (break); ler o scan code na porta 60h; enganchar a INT 9 encadeando com a BIOS; consumir uma tecla de atalho mandando o EOI você mesmo; escrever um TSR ativado por tecla; desinstalar um TSR com segurança
---

## O caminho de uma tecla

Até agora, para o seu programa, uma tecla era um par de valores que a `INT 16h` devolvia em AH (scan code) e AL (ASCII). Por baixo disso há uma pequena cadeia de hardware e software, e cada elo pode ser interceptado:

```diagrama titulo="Da tecla à INT 16h"
  ┌──────────────┐  código serial   ┌────────────────────┐
  │ teclado      │ ───────────────► │ controlador do PC  │
  │ (microcontr. │  "1Eh" = A       │ (8255 no XT,       │
  │  8048 dentro)│  "9Eh" = soltou A│  8042 no AT)       │
  └──────────────┘                  └─────────┬──────────┘
                                              │ IRQ 1 ── porta 60h = 1Eh
                                              ▼
                                  INT 09h (BIOS do teclado)
                                  • lê a porta 60h
                                  • Shift/Ctrl/Alt? atualiza 0040:0017
                                  • traduz 1Eh em 'a' ou 'A'
                                  • guarda (1Eh, 'a') no buffer
                                  • manda o EOI
                                              │
                                              ▼
                  buffer circular em 0040:001E (16 teclas)
                                              │
                                              ▼
                       INT 16h, AH=0: AH = 1Eh, AL = 'a'
```

Três ideias para guardar:

1. O teclado não manda letras, manda **números de teclas**: os *scan codes*. A tecla A é sempre 1Eh, com ou sem Shift, com ou sem Caps Lock. Quem decide se vira `a` ou `A` é a BIOS.
2. O teclado avisa **duas vezes**: quando a tecla desce (código de **aperto**, *make code*) e quando sobe (código de **soltura**, *break code*). O código de soltura é o de aperto com o bit 7 ligado: A desce = 1Eh, A sobe = 9Eh.
3. Quem chama a `INT 9` é o **hardware**, pela IRQ 1, a cada aperto e a cada soltura. A `INT 16h` só lê o que a `INT 9` já guardou.

### Alguns scan codes

| Tecla | Aperto | Soltura | | Tecla | Aperto | Soltura |
|-------|--------|---------|-|-------|--------|---------|
| Esc | 01h | 81h | | Enter | 1Ch | 9Ch |
| 1 ... 0 | 02h ... 0Bh | 82h ... 8Bh | | Espaço | 39h | B9h |
| Q W E R T Y | 10h ... 15h | 90h ... 95h | | F1 ... F10 | 3Bh ... 44h | BBh ... C4h |
| A S D F G H | 1Eh ... 23h | 9Eh ... A3h | | ↑ ← → ↓ | 48h 4Bh 4Dh 50h | C8h CBh CDh D0h |
| Z X C V B N | 2Ch ... 31h | ACh ... B1h | | Ctrl, Shift esq., Alt | 1Dh, 2Ah, 38h | 9Dh, AAh, B8h |

Os números seguem a posição física das teclas no teclado original do IBM PC: a primeira fileira de letras começa em 10h (Q), a segunda em 1Eh (A), a terceira em 2Ch (Z).

:::cpu Os dois bytes do buffer
O buffer da BIOS guarda **words**: o scan code no byte alto e o ASCII no baixo, exatamente o que a `INT 16h` devolve em AX. Teclas sem ASCII, como as setas e as teclas de função, ficam com AL = 0, e é por isso que os programas testavam `CMP AL,0` antes de olhar AH. O buffer é circular: o offset da próxima tecla a ler fica em 0040:001Ah, o da próxima posição livre em 0040:001Ch, e quando os dois são iguais o buffer está vazio. Com o buffer cheio, a BIOS apita e descarta a tecla: é o famoso bip de quem digita rápido demais num PC ocupado.
:::

## Lendo a porta 60h

A porta **60h** guarda o último scan code que o controlador recebeu. Ler essa porta dentro de uma rotina da `INT 9` mostra exatamente o que aconteceu no teclado, antes de qualquer tradução da BIOS:

```asm fragmento
        IN   AL, 60h            ; AL = scan code (aperto ou soltura)
        TEST AL, 80h            ; bit 7 ligado?
        JNZ  @@soltou           ; sim: é uma soltura
        ; ... é um aperto: AL = número da tecla
```

Jogos de ação faziam isso para saber quais teclas estavam **pressionadas agora**, algo que a `INT 16h` não diz: um vetor de 128 bytes, um por tecla, recebia 1 no aperto e 0 na soltura. Assim o jogador podia segurar a seta e o espaço ao mesmo tempo.

## Espiando o teclado

Este programa engancha a `INT 9`, guarda cada scan code que passar, e **encadeia** com a BIOS, para que as teclas continuem chegando à `INT 16h`. Quando você aperta Esc, ele restaura o vetor e mostra tudo o que viu.

```asm executar titulo="ESPIA.ASM: os scan codes de verdade"
.MODEL SMALL
.STACK 100h
.DATA
antigo  DD   ?                  ; vetor original da INT 9
codigos DB   16 DUP (0)         ; os scan codes que passaram
total   DW   0
hexa    DB   '0123456789ABCDEF'
titulo  DB   'Scan codes: $'
.CODE
; chamada pela IRQ 1 a cada aperto e a cada soltura
novo9   PROC FAR
        PUSH AX
        PUSH BX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        IN   AL, 60h            ; o scan code que acabou de chegar
        MOV  BX, total
        CMP  BX, 16
        JAE  @@cheio
        MOV  codigos[BX], AL
        INC  total
@@cheio:
        PUSHF                   ; simula um INT para a rotina da BIOS:
        CALL antigo             ; ela traduz, guarda no buffer e manda o EOI
        POP  DS
        POP  BX
        POP  AX
        IRET
novo9   ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3509h          ; guarda o vetor antigo
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS                 ; instala o nosso
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        POP  DS

@@le:   MOV  AH, 0              ; lê teclas normalmente até vir Esc
        INT  16h
        CMP  AL, 27
        JNE  @@le

        PUSH DS                 ; devolve o vetor antes de qualquer outra coisa
        LDS  DX, antigo
        MOV  AX, 2509h
        INT  21h
        POP  DS

        MOV  DX, OFFSET titulo
        MOV  AH, 09h
        INT  21h
        MOV  CX, total
        XOR  SI, SI
        MOV  BX, OFFSET hexa
@@mostra:
        MOV  AL, codigos[SI]
        PUSH AX
        SHR  AL, 1              ; nibble alto
        SHR  AL, 1
        SHR  AL, 1
        SHR  AL, 1
        XLAT
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  AX
        AND  AL, 0Fh            ; nibble baixo
        XLAT
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        MOV  DL, ' '
        INT  21h
        INC  SI
        LOOP @@mostra
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Digite `a`, `b` e Esc na tela do usuário. A saída é `1E 9E 30 B0 01`: aperto e soltura do A, aperto e soltura do B, e o aperto do Esc. A soltura do Esc (81h) não aparece porque, quando ela chega, o programa já leu o Esc e devolveu o vetor.

:::dica O simulador e o teclado
Quando um programa engancha a `INT 9`, o simulador passa a entregar cada tecla pela IRQ 1, como um PC: primeiro o código de aperto, depois o de soltura, cada um com a sua interrupção. As teclas Shift, Ctrl e Alt sozinhas não são enviadas, por isso os exemplos desta aula usam as teclas de função como atalho.
:::

## Consumindo uma tecla

Encadear com a BIOS é o comportamento educado para as teclas que não são suas. Mas uma **tecla de atalho** não deve chegar ao programa que está rodando: se o seu TSR usa F10, o editor de texto por baixo não deveria receber F10 também. Para isso a rotina **não** chama a BIOS e termina a interrupção ela mesma.

Sem a BIOS, duas tarefas passam a ser suas:

- **Avisar o teclado** que o código foi lido. No PC e no XT, isso se faz pulsando o bit 7 da porta 61h. No AT o controlador 8042 dispensa o pulso, mas os TSRs da época faziam assim mesmo, para funcionar em todos.
- **Mandar o EOI** ao 8259A, como na aula sobre rotinas de interrupção. Sem ele, o PIC nunca mais entrega a IRQ 1, e o teclado morre.

```asm fragmento
        IN   AL, 61h            ; "já li o código" (PC/XT)
        OR   AL, 80h
        OUT  61h, AL
        AND  AL, 7Fh
        OUT  61h, AL
        MOV  AL, 20h            ; EOI: esta IRQ terminou
        OUT  20h, AL
```

## Um TSR com tecla de atalho

Juntando tudo: o `LUZ.COM` fica residente e, a cada F10, troca as cores da tela inteira entre cinza sobre preto e amarelo sobre azul. Qualquer outra tecla segue para a BIOS.

```asm executar titulo="LUZ.COM: F10 troca as cores da tela"
; LUZ.COM - TSR: F10 alterna as cores da tela
        ORG  100h
inicio: JMP  instalar

; ---------------- parte residente ----------------
antigo9 DD   ?

novo9   PROC FAR
        PUSH AX
        IN   AL, 60h
        CMP  AL, 44h            ; aperto do F10?
        JE   @@atalho
        POP  AX
        JMP  CS:antigo9         ; não é nosso: a BIOS cuida

@@atalho:
        PUSH CX
        PUSH DI
        PUSH ES
        MOV  AX, 0B800h
        MOV  ES, AX
        MOV  DI, 1              ; primeiro byte de atributo
        MOV  CX, 2000           ; 80 x 25 células
@@cor:  XOR  BYTE PTR ES:[DI], 19h  ; 07h (cinza/preto) <-> 1Eh (amarelo/azul)
        ADD  DI, 2
        LOOP @@cor
        POP  ES
        POP  DI
        POP  CX

        IN   AL, 61h            ; consome a tecla: avisa o teclado...
        OR   AL, 80h
        OUT  61h, AL
        AND  AL, 7Fh
        OUT  61h, AL
        MOV  AL, 20h            ; ... e o PIC
        OUT  20h, AL
        POP  AX
        IRET
novo9   ENDP

; ---------------- parte transitória ----------------
instalar:
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo9, BX
        MOV  WORD PTR antigo9+2, ES
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        MOV  ES, DS:[2Ch]       ; devolve o ambiente
        MOV  AH, 49h
        INT  21h
        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h

msg     DB   'LUZ instalado: aperte F10 (Shift+F10 no navegador).', 13, 10, '$'
```

Rode no laboratório e, já no prompt `C:\CURSO>`, clique na tela do usuário e aperte F10 (no navegador, use Shift+F10, porque F10 sozinho abre o menu do curso). Repare que a soltura do F10 (C4h) não é consumida: ela segue para a BIOS, que simplesmente a ignora. Só o aperto é o atalho.

:::atencao Rotinas de teclado precisam ser rápidas
A `INT 9` é chamada duas vezes por tecla, com as interrupções desligadas. O laço de 2.000 células do `LUZ.COM` é aceitável porque só roda quando F10 é apertado. Para tarefas maiores, como abrir uma janela, os TSRs só **anotavam** que o atalho foi pressionado e faziam o trabalho depois, no timer ou na INT 28h, quando o DOS estivesse livre.
:::

:::anos90 Atalhos com Ctrl e Alt
TSRs de verdade usavam combinações como Ctrl+Alt ou Alt+Shift, que dificilmente colidiam com os atalhos de outros programas. Para isso, a rotina olhava o byte de estado do teclado em **0040:0017h**, que a BIOS mantém atualizado: bit 0 = Shift direito, bit 1 = Shift esquerdo, bit 2 = Ctrl, bit 3 = Alt, e os bits 4 a 7 para Scroll Lock, Num Lock, Caps Lock e Insert. O *SideKick* abria com Ctrl+Alt; o *DOSKEY* usava as setas e o F7.
:::

## Desinstalando um TSR

Um TSR pode ser removido da memória, mas só se ninguém tiver se instalado **depois** dele nas mesmas interrupções. Se outro TSR leu o vetor da INT 9 depois de você, ele guardou o **seu** endereço como "antigo". Desinstalar você nesse momento deixaria o outro saltando para memória livre.

```diagrama titulo="Quando dá para desinstalar"
  pode:   vetor 9 ──► VOCÊ ──► BIOS
          (restaura o vetor 9 para o "antigo" que você guardou)

  não pode: vetor 9 ──► OUTRO TSR ──► VOCÊ ──► BIOS
            (o OUTRO saltaria para a memória que você liberou)
```

O roteiro do desinstalador, normalmente o mesmo programa executado com um parâmetro como `/U`:

1. Pergunta pela INT 2Fh se o TSR está na memória e, na resposta, recebe o **segmento** dele (a rotina multiplex devolve CS em ES, por exemplo).
2. Lê cada vetor que o TSR usa com `AH=35h` e confere se o segmento ainda é o dele. Se algum não for, desiste e avisa.
3. Restaura cada vetor com o valor que a **cópia residente** guardou. Como as duas cópias são o mesmo programa, as variáveis estão nos mesmos offsets: `ES:antigo9` é o `antigo9` da cópia residente.
4. Devolve o bloco do PSP residente com `AH=49h`, ES = segmento do TSR.

```asm fragmento
; ES = segmento do TSR residente (devolvido pela INT 2Fh)
        MOV  SI, ES             ; guarda o segmento do TSR
        MOV  AX, 3509h
        INT  21h                ; ES:BX = vetor atual da INT 9
        MOV  AX, ES
        CMP  AX, SI             ; ainda aponta para o TSR?
        JNE  nao_da             ; alguém se instalou por cima: não mexa
        MOV  ES, SI
        PUSH DS
        LDS  DX, ES:antigo9     ; o vetor que a cópia residente guardou
        MOV  AX, 2509h
        INT  21h
        POP  DS
        MOV  ES, SI             ; ES = PSP do TSR (em um .COM, CS = PSP)
        MOV  AH, 49h            ; libera a memória dele
        INT  21h
```

:::cpu Por que ES = CS serve para liberar
A função `AH=49h` espera o segmento do bloco que o DOS entregou ao programa. Em um `.COM`, esse bloco começa no PSP, e o PSP fica no mesmo segmento que CS. É mais um motivo para os TSRs serem `.COM`: o segmento da rotina, o do PSP e o do bloco de memória são o mesmo número.
:::

```quiz
? A tecla S tem o código de aperto 1Fh. Qual é o código de soltura?
- 1Fh
- F1h
+ 9Fh
> A soltura é o código de aperto com o bit 7 ligado: 1Fh OR 80h = 9Fh.

? Quem chama a INT 9?
- A INT 16h, quando o programa pede uma tecla
+ O hardware, pela IRQ 1, a cada aperto e a cada soltura
- O DOS, a cada 55 ms
> A INT 16h só lê o buffer que a INT 9 preencheu. Por isso uma tecla pode ser digitada antes do programa pedir.

? Uma rotina da INT 9 encadeia com a BIOS usando PUSHF / CALL CS:antigo9. Ela precisa mandar o EOI?
+ Não: a rotina da BIOS já manda o EOI
- Sim, sempre
- Só se a tecla for de soltura
> Quem encadeia deixa a BIOS terminar o atendimento. Mandar o EOI duas vezes poderia encerrar outra interrupção que estivesse em andamento.

? Uma rotina da INT 9 consome a tecla de atalho e não chama a BIOS. O que acontece se ela esquecer o EOI?
- A tecla aparece duas vezes
+ O PIC não entrega mais a IRQ 1: o teclado para de responder
- Nada, o teclado manda o EOI sozinho
> O 8259A fica esperando o fim do atendimento da IRQ 1 e bloqueia novas interrupções desse nível e dos menos prioritários.

? Por que não se deve desinstalar um TSR se o vetor da INT 9 aponta para outro programa?
- Porque AH = 25h não funciona nesse caso
+ Porque o outro programa guardou o endereço do seu TSR como "rotina antiga" e saltaria para memória liberada
- Porque o DOS impede
> A corrente de rotinas só pode ser desfeita de cima para baixo. O desinstalador deve conferir cada vetor antes de mexer.

? Por que a INT 16h não serve para saber se o jogador está segurando uma tecla?
- Porque a INT 16h é lenta demais
+ Porque ela só devolve as teclas apertadas, guardadas no buffer, e não diz quando foram soltas
- Porque ela não funciona com as setas
> Só a INT 9 (ou a porta 60h) vê as solturas. Jogos mantinham uma tabela "tecla pressionada agora" atualizada pela própria rotina da INT 9.
```

## Exercícios

```exercicio
id: a28-1
titulo: Contando apertos e solturas
nivel: 2
--- enunciado
Complete a rotina **novo9**: leia o scan code na porta **60h** e some 1 em **apertos** se for um código de aperto (bit 7 desligado) ou em **soltas** se for de soltura (bit 7 ligado). Depois, encadeie com a rotina da BIOS, que está em **antigo**, para que o programa principal continue recebendo as teclas pela INT 16h.

O programa principal já instala a rotina, lê teclas até chegar um Esc e restaura o vetor.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
antigo  DD   ?
apertos DW   0
soltas  DW   0
.CODE
novo9   PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        ; leia a porta 60h e conte

        PUSHF
        CALL antigo
        POP  DS
        POP  AX
        IRET
novo9   ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        POP  DS
@@le:   MOV  AH, 0
        INT  16h
        CMP  AL, 27
        JNE  @@le
        PUSH DS
        LDS  DX, antigo
        MOV  AX, 2509h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "a, b, c e Esc", "entrada": "abc{ESC}", "espera": { "mem": { "apertos": 4, "soltas": 3 }, "pilhaEquilibrada": true } },
 { "nome": "só Esc", "entrada": "{ESC}", "espera": { "mem": { "apertos": 1, "soltas": 0 } } },
 { "nome": "seta e Esc", "entrada": "{CIMA}{CIMA}{ESC}", "espera": { "mem": { "apertos": 3, "soltas": 2 } } }]
--- dicas
IN AL,60h coloca o scan code em AL.
TEST AL,80h liga ZF quando o bit 7 está desligado, ou seja, quando é um aperto.
Use dois ramos: JNZ @@solta / INC apertos / JMP @@fim / @@solta: INC soltas / @@fim:.
A soltura do Esc não é contada porque o programa restaura o vetor logo depois de ler o Esc.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
antigo  DD   ?
apertos DW   0
soltas  DW   0
.CODE
novo9   PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        IN   AL, 60h
        TEST AL, 80h
        JNZ  @@solta
        INC  apertos
        JMP  @@fim
@@solta:
        INC  soltas
@@fim:
        PUSHF
        CALL antigo
        POP  DS
        POP  AX
        IRET
novo9   ENDP

inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        POP  DS
@@le:   MOV  AH, 0
        INT  16h
        CMP  AL, 27
        JNE  @@le
        PUSH DS
        LDS  DX, antigo
        MOV  AX, 2509h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a28-2
titulo: O último scan code
nivel: 2
--- enunciado
Escreva a rotina **novo9** deste TSR: a cada interrupção do teclado, ela lê a porta **60h** e mostra o scan code em hexadecimal, com dois dígitos, no canto superior direito da tela: o dígito alto na coluna **78** e o baixo na coluna **79** da linha 0, ambos com o atributo **1Fh**. Depois, passa a vez para a rotina antiga (**antigo9**), para que o DOS continue recebendo as teclas.

Depois de apertar e soltar a tecla A, por exemplo, a tela mostra `9E`, a soltura. A tabela **hexa** está pronta para você usar.
--- inicial
        ORG  100h
inicio: JMP  instalar

antigo9 DD   ?
hexa    DB   '0123456789ABCDEF'

novo9   PROC FAR
        ; seu código aqui
        JMP  CS:antigo9
novo9   ENDP

instalar:
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo9, BX
        MOV  WORD PTR antigo9+2, ES
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
--- testes
[{ "nome": "tecla A: 9E", "residente": { "passos": 3000, "entrada": "a" }, "espera": { "status": "residente", "video": { "78": ["9", 31], "79": ["E", 31] }, "telaContem": "C:\\CURSO>a" } },
 { "nome": "F1: BB", "residente": { "passos": 3000, "entrada": "{F1}" }, "espera": { "status": "residente", "video": { "78": ["B", 31], "79": ["B", 31] } } },
 { "nome": "Esc: 81", "residente": { "passos": 3000, "entrada": "{ESC}" }, "espera": { "status": "residente", "video": { "78": ["8", 31], "79": ["1", 31] } } }]
--- dicas
Empilhe AX, BX e ES. Leia o código com IN AL,60h e guarde uma cópia (por exemplo em AH).
Para o dígito alto: desloque AL 4 vezes para a direita (SHR AL,1 quatro vezes, ou MOV CL,4 / SHR AL,CL guardando CX também).
Para converter um nibble em caractere: MOV BX,OFFSET hexa / XLAT CS:hexa. Sem o CS:, o XLAT leria a tabela com o DS de outro programa.
O dígito vai em ES:[156] e o atributo 1Fh em ES:[157]; o segundo dígito em ES:[158], com o atributo em ES:[159]. Desempilhe tudo antes do JMP.
--- solucao
        ORG  100h
inicio: JMP  instalar

antigo9 DD   ?
hexa    DB   '0123456789ABCDEF'

novo9   PROC FAR
        PUSH AX
        PUSH BX
        PUSH ES
        MOV  BX, 0B800h
        MOV  ES, BX
        MOV  BX, OFFSET hexa
        IN   AL, 60h
        MOV  AH, AL             ; cópia
        SHR  AL, 1
        SHR  AL, 1
        SHR  AL, 1
        SHR  AL, 1
        XLAT CS:hexa
        MOV  ES:[156], AL
        MOV  BYTE PTR ES:[157], 1Fh
        MOV  AL, AH
        AND  AL, 0Fh
        XLAT CS:hexa
        MOV  ES:[158], AL
        MOV  BYTE PTR ES:[159], 1Fh
        POP  ES
        POP  BX
        POP  AX
        JMP  CS:antigo9
novo9   ENDP

instalar:
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo9, BX
        MOV  WORD PTR antigo9+2, ES
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
```

```exercicio
id: a28-3
titulo: Tecla de atalho
nivel: 3
exigir: IRET
--- enunciado
Escreva a rotina **novo9** de um TSR ativado pelo **F10** (aperto = scan code **44h**):

- No aperto do F10, inverta a variável residente **ligado** (0 vira 1, 1 vira 0) e escreva no canto superior direito da tela (linha 0, coluna 79) um `*` se ele ficou ligado, ou um espaço se ficou desligado, sempre com o atributo **0Eh**. O F10 é **consumido**: não chame a BIOS, mande o EOI ao PIC e termine com `IRET`.
- Qualquer outro código (inclusive a soltura do F10) segue para a rotina antiga, para que o DOS continue recebendo as teclas normais.
--- inicial
        ORG  100h
inicio: JMP  instalar

antigo9 DD   ?
ligado  DB   0

novo9   PROC FAR
        JMP  CS:antigo9
novo9   ENDP

instalar:
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo9, BX
        MOV  WORD PTR antigo9+2, ES
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
--- testes
[{ "nome": "F10 liga", "residente": { "passos": 3000, "entrada": "{F10}" }, "espera": { "status": "residente", "mem": { "ligado": 1 }, "video": { "79": ["*", 14] } } },
 { "nome": "F10, a, b, F10 desliga e o DOS recebe ab", "residente": { "passos": 4000, "entrada": "{F10}ab{F10}" }, "espera": { "status": "residente", "mem": { "ligado": 0 }, "video": { "79": [" ", 14] }, "telaContem": "C:\\CURSO>ab" } },
 { "nome": "outras teclas não ligam", "residente": { "passos": 3000, "entrada": "xy" }, "espera": { "status": "residente", "mem": { "ligado": 0 }, "telaContem": "C:\\CURSO>xy" } }]
--- dicas
Comece com PUSH AX / IN AL,60h / CMP AL,44h. Se não for o F10: POP AX e JMP CS:antigo9.
Para inverter: XOR CS:ligado,1. Depois escolha o caractere: MOV AL,' ' / CMP CS:ligado,0 / JE pronto / MOV AL,'*'.
Escreva com ES = 0B800h: o caractere em ES:[158] e o atributo 0Eh em ES:[159]. Preserve ES.
Para consumir o F10: MOV AL,20h / OUT 20h,AL / POP AX / IRET. Se quiser, pulse antes o bit 7 da porta 61h, como no LUZ.COM.
--- solucao
        ORG  100h
inicio: JMP  instalar

antigo9 DD   ?
ligado  DB   0

novo9   PROC FAR
        PUSH AX
        IN   AL, 60h
        CMP  AL, 44h
        JE   @@atalho
        POP  AX
        JMP  CS:antigo9
@@atalho:
        PUSH ES
        XOR  CS:ligado, 1
        MOV  AL, ' '
        CMP  CS:ligado, 0
        JE   @@mostra
        MOV  AL, '*'
@@mostra:
        MOV  AH, 0Eh
        PUSH AX
        MOV  AX, 0B800h
        MOV  ES, AX
        POP  AX
        MOV  ES:[158], AX
        POP  ES
        IN   AL, 61h
        OR   AL, 80h
        OUT  61h, AL
        AND  AL, 7Fh
        OUT  61h, AL
        MOV  AL, 20h
        OUT  20h, AL
        POP  AX
        IRET
novo9   ENDP

instalar:
        MOV  AX, 3509h
        INT  21h
        MOV  WORD PTR antigo9, BX
        MOV  WORD PTR antigo9+2, ES
        MOV  DX, OFFSET novo9
        MOV  AX, 2509h
        INT  21h
        MOV  DX, OFFSET instalar + 15
        MOV  CL, 4
        SHR  DX, CL
        MOV  AX, 3100h
        INT  21h
```

:::resumo
- O teclado manda **scan codes**: o número da tecla ao apertar (*make*) e o mesmo número com o bit 7 ligado ao soltar (*break*).
- Cada aperto e cada soltura geram a **IRQ 1** (`INT 9`). A rotina da BIOS lê a **porta 60h**, traduz para ASCII e guarda a word (scan, ASCII) no buffer em 0040:001Eh; a `INT 16h` só lê esse buffer.
- Para espiar as teclas: engancha a `INT 9`, lê a porta 60h e **encadeia** com `PUSHF` / `CALL antigo` (ou `JMP CS:antigo`). A BIOS manda o EOI.
- Para uma tecla de atalho: **consuma** o aperto, sem chamar a BIOS. Pulse o bit 7 da porta 61h e mande o **EOI** (`MOV AL,20h` / `OUT 20h,AL`) antes do `IRET`.
- O estado de Shift, Ctrl e Alt fica em 0040:0017h.
- Desinstale um TSR só se os vetores ainda apontarem para ele; restaure-os com os valores que a cópia residente guardou e libere o bloco com `AH=49h`.
:::
