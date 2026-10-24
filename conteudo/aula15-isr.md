---
id: aula15
numero: 15
modulo: 6
titulo: Rotinas de interrupção e o timer
subtitulo: IRQs, o controlador 8259A, EOI e ganchos na INT 1Ch
duracao: 80 min
objetivos: entender como os dispositivos interrompem a CPU pelas linhas IRQ e pelo controlador 8259A; escrever rotinas de interrupção (ISR) que preservam todos os registradores e terminam com IRET; instalar e restaurar vetores com AH=25h e AH=35h; enganchar o timer pela INT 1Ch; mandar o EOI ao escrever uma rotina de hardware; criar o seu próprio serviço de interrupção
---

## Quando o hardware chama você

Na aula passada as interrupções aconteciam porque **o seu programa** executava `INT n`. As interrupções de **hardware** são diferentes: elas chegam a qualquer momento, entre duas instruções quaisquer, porque um dispositivo precisa de atenção. O teclado avisa que uma tecla foi pressionada, o timer avisa que passou mais um tique, o disco avisa que terminou de ler um setor.

Sem interrupções, o programa teria que perguntar a cada dispositivo, sem parar, "tem algo para mim?" (isso se chama **polling**). Com elas, o programa trabalha em paz e o dispositivo o interrompe só quando precisa.

## O controlador 8259A

O 8086 tem um único pino para interrupções de hardware, o **INTR**. Para atender vários dispositivos, o IBM PC usa um chip auxiliar, o **8259A PIC** (Programmable Interrupt Controller), com 8 entradas chamadas **IRQ 0 a IRQ 7**:

```diagrama titulo="Do dispositivo à rotina"
  timer (8253) ──► IRQ 0 ─┐
  teclado      ──► IRQ 1 ─┤
  (livre/2º PIC)  IRQ 2 ─┤     ┌────────┐ INTR  ┌───────┐
  COM2         ──► IRQ 3 ─┼───► │ 8259A  ├──────► │ 8086  │
  COM1         ──► IRQ 4 ─┤     │  PIC   │ ◄──────┤       │
  disco rígido ──► IRQ 5 ─┤     └────────┘  INTA └───┬───┘
  disquete     ──► IRQ 6 ─┤      "é a INT 08h + n"    │
  impressora   ──► IRQ 7 ─┘                           ▼
                                        IVT: vetor 08h + n
                                        IRQ 0 = INT 08h, IRQ 1 = INT 09h ...
```

1. O dispositivo ativa sua linha IRQ.
2. O PIC verifica se ela não está **mascarada** e se não há outra IRQ mais prioritária em atendimento (IRQ 0 é a mais prioritária).
3. O PIC ativa o pino INTR da CPU.
4. Se a flag **IF** estiver ligada, a CPU termina a instrução atual e pergunta ao PIC qual é o número da interrupção. O BIOS programou o PIC para responder **08h + n**.
5. A CPU executa o equivalente a `INT 08h+n`: empilha FLAGS, CS e IP e salta para o vetor.

:::dica Por que IRQ 0 virou INT 08h
A Intel reservou as interrupções 00h a 1Fh para exceções da CPU, mas a IBM ignorou a reserva e programou o PIC a partir de 08h. Quando o 80286 passou a gerar exceções nas posições 08h a 0Dh, as duas coisas colidiram, e os sistemas em modo protegido tiveram que reprogramar o PIC. No 8086 não há conflito.
:::

## IF, CLI e STI

A flag **IF** (Interrupt Flag) liga e desliga a aceitação das interrupções de hardware **mascaráveis**:

- `CLI` (Clear Interrupt flag): IF = 0, a CPU ignora o INTR. Os pedidos ficam esperando no PIC.
- `STI` (Set Interrupt flag): IF = 1, a CPU volta a atender.

Use `CLI` para proteger trechos que não podem ser interrompidos no meio, e **mantenha esses trechos curtos**: enquanto IF = 0, o relógio atrasa e teclas podem se perder.

:::cpu A instrução depois de MOV SS é protegida
Trocar a pilha exige duas instruções: `MOV SS,AX` e `MOV SP,novo`. Se uma interrupção chegasse entre as duas, ela empilharia em SS novo com SP velho, um lugar aleatório. Por isso o 8086 **adia as interrupções por uma instrução** depois de qualquer carga de registrador de segmento. Mesmo assim, os programadores cuidadosos escreviam `CLI` antes e `STI` depois, porque alguns 8088 antigos tinham um defeito justamente nesse mecanismo.
:::

## Escrevendo uma rotina de interrupção (ISR)

Uma ISR (Interrupt Service Routine) é um procedimento com regras mais rígidas que as de um procedimento comum:

1. **Preservar todos os registradores** que usar, inclusive DS e ES. O programa interrompido não sabe que foi interrompido!
2. **Não confiar em DS.** Quando a interrupção chega, DS aponta para os dados de quem estava rodando, que pode nem ser o seu programa. Carregue o seu DS ou use `CS:`.
3. **Terminar com `IRET`**, que restaura FLAGS, CS e IP.
4. **Ser rápida.** Enquanto ela roda, as interrupções do mesmo nível ou de nível mais baixo esperam.
5. **Mandar o EOI** ao PIC, se for uma rotina de hardware (veremos já já).

```asm fragmento
MINHA_ISR PROC FAR
        PUSH AX             ; 1. salva tudo que for usar
        PUSH DS
        MOV  AX, @DATA      ; 2. não confia no DS de quem foi interrompido
        MOV  DS, AX

        INC  contador       ;    o trabalho de verdade, curto

        POP  DS             ; 1. restaura na ordem inversa
        POP  AX
        IRET                ; 3. desempilha IP, CS e FLAGS
MINHA_ISR ENDP
```

## Instalando e restaurando um vetor

O roteiro de todo programa que usa uma interrupção é sempre o mesmo:

```diagrama titulo="O ciclo de vida de um gancho"
  1. AH = 35h: lê o vetor atual e GUARDA (o "antigo")
  2. AH = 25h: grava o endereço da sua rotina no vetor
  3. ... o programa roda, a sua rotina é chamada ...
  4. AH = 25h: devolve o vetor antigo ANTES de terminar
```

O passo 4 é obrigatório. Se o programa terminar sem restaurar o vetor, a IVT continua apontando para a memória onde estava a sua rotina, e o DOS vai carregar outro programa por cima. Na próxima interrupção, a CPU salta para o meio do programa novo, e o PC trava.

Lembre do detalhe da `AH=25h`: o endereço da rotina vai em **DS:DX**. Como a rotina está no segmento de código, é preciso trocar DS temporariamente:

```asm fragmento
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX                 ; DS = segmento da rotina
        MOV  DX, OFFSET MINHA_ISR   ; DX = offset da rotina
        MOV  AX, 251Ch              ; AH = 25h, AL = número do vetor
        INT  21h
        POP  DS
```

## O timer do PC e a INT 1Ch

O chip **8253** (PIT, Programmable Interval Timer) recebe um relógio de 1.193.182 Hz e o divide por 65.536, gerando a IRQ 0 cerca de **18,2 vezes por segundo**. A rotina da BIOS na `INT 08h`:

1. Soma 1 ao contador de tiques em 0040:006C (o mesmo que a `INT 1Ah` devolve).
2. Controla o motor do disquete.
3. Chama a **`INT 1Ch`**, que por padrão só contém um `IRET`.
4. Manda o EOI ao PIC.

A `INT 1Ch` existe exatamente para os programas se pendurarem nela. É o jeito mais seguro de executar algo periodicamente, porque a BIOS já cuida do PIC.

```asm executar titulo="TIQUES.ASM: contando tiques com a INT 1Ch"
.MODEL SMALL
.STACK 100h
.DATA
tiques  DW 0
antigo  DD ?                    ; vetor original da INT 1Ch
msg     DB 'Passaram 18 tiques (cerca de 1 segundo num PC real).$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX

        MOV  AX, 351Ch          ; 1. guarda o vetor antigo
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES

        PUSH DS                 ; 2. instala a nossa rotina
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET RELOGIO
        MOV  AX, 251Ch
        INT  21h
        POP  DS

@@espera:                       ; 3. o programa principal só espera
        CMP  tiques, 18
        JB   @@espera

        PUSH DS                 ; 4. restaura o vetor antigo
        LDS  DX, antigo         ; DS:DX = vetor guardado
        MOV  AX, 251Ch
        INT  21h
        POP  DS

        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h

; Chamada 18,2 vezes por segundo pela BIOS
RELOGIO PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        INC  tiques
        POP  DS
        POP  AX
        IRET
RELOGIO ENDP
END inicio
```

Abra no laboratório e rode na velocidade **real**. O programa principal fica preso no laço `@@espera`, e mesmo assim `tiques` sobe: é a rotina sendo chamada "por fora". Na aba **IVT** do painel de inspeção, veja o vetor 1Ch apontar para o seu código enquanto o programa roda.

:::atencao O timer do simulador
Em um PC real, a IRQ 0 chega a cada 54,9 ms. No nosso simulador ela chega a cada 3.000 instruções executadas, para que os exercícios terminem rápido e sempre do mesmo jeito. Os conceitos são idênticos; só a escala de tempo muda.
:::

## Enganchando o hardware direto: o EOI

Você também pode instalar uma rotina diretamente na `INT 08h`, no lugar da BIOS. Aí entra uma obrigação nova. Quando o PIC entrega uma IRQ, ele marca que ela está **em atendimento** e bloqueia novas interrupções daquele nível e dos menos prioritários. Ele só libera quando recebe o comando **EOI** (End Of Interrupt):

```asm fragmento
        MOV  AL, 20h        ; comando EOI não específico
        OUT  20h, AL        ; porta de comando do 8259A
```

Esqueça o EOI e o timer **para de vez** depois do primeiro tique. Pior: o teclado (IRQ 1) também para, porque tem prioridade menor. O PC parece travado.

Quem engancha a `INT 08h` normalmente faz uma de duas coisas:

- **Encadeia** com a rotina antiga, que manda o EOI e mantém o relógio do DOS certo: `PUSHF` seguido de `CALL DWORD PTR antigo` simula um `INT` para a rotina original.
- **Manda o EOI ela mesma**, quando substitui a rotina por completo (e aceita que o relógio do DOS atrase).

```asm fragmento
TIMER   PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        INC  tiques
        POP  DS
        PUSHF                       ; simula um INT:
        CALL CS:antigo8             ; a BIOS faz o resto e manda o EOI
        POP  AX
        IRET
TIMER   ENDP
```

:::cpu Mais rápido que 18,2 por segundo
Para tocar música ou animar a 70 quadros por segundo, os jogos reprogramavam o 8253 com outro divisor (porta 43h e porta 40h) e faziam o timer disparar centenas de vezes por segundo. Para o relógio do DOS não adiantar, a rotina contava os tiques e só chamava a rotina original a cada N disparos. As bibliotecas de som da época, como a do *Sound Blaster* e da *Gravis Ultrasound*, faziam exatamente isso.
:::

## O seu próprio serviço de interrupção

Nada impede você de criar um "serviço" como o DOS, usando um vetor livre. As interrupções **60h a 66h** foram reservadas para programas do usuário. Os drivers do mouse usavam a `33h`, e muitos drivers de som e de rede usavam a faixa 60h–66h.

```asm executar titulo="SERVICO.ASM: criando a INT 60h"
.MODEL SMALL
.STACK 100h
.DATA
antigo  DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3560h          ; guarda o vetor 60h
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET SERVICO
        MOV  AX, 2560h          ; instala
        INT  21h
        POP  DS

        MOV  AL, 'A'
        MOV  CX, 26
@@laco: INT  60h                ; nosso serviço: imprime AL
        INC  AL
        LOOP @@laco

        PUSH DS
        LDS  DX, antigo         ; restaura
        MOV  AX, 2560h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

; INT 60h: imprime o caractere em AL. Preserva tudo.
SERVICO PROC FAR
        STI                     ; um serviço de software pode aceitar IRQs
        PUSH AX
        PUSH DX
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h
        POP  DX
        POP  AX
        IRET
SERVICO ENDP
END inicio
```

:::anos90 O DOS não é reentrante
Uma rotina de interrupção de hardware **não pode** chamar o DOS (`INT 21h`). Se o timer interromper o programa no meio de uma chamada ao DOS e a sua rotina chamar o DOS de novo, as variáveis internas do DOS são sobrescritas e o sistema trava. Os programas residentes dos anos 90 consultavam a flag não documentada **InDOS** (obtida com `AH=34h`) para saber se era seguro chamar o DOS. Na rotina do timer, fique com a BIOS ou com acesso direto à memória de vídeo. O `SERVICO` acima pode chamar o DOS porque é chamado pelo próprio programa, nunca no meio de outra chamada.
:::

```quiz
? Qual vetor a IRQ 1 (teclado) usa no IBM PC?
- INT 01h
+ INT 09h
- INT 16h
> O BIOS programa o PIC para entregar a IRQ n como INT 08h + n. A INT 16h é o serviço de software do teclado.

? Por que uma ISR não pode confiar no valor de DS?
+ Porque ela pode interromper qualquer código, com DS apontando para os dados de outra parte do programa ou de outro programa
- Porque INT zera DS
- Porque DS só vale dentro de procedimentos NEAR
> A interrupção chega entre duas instruções quaisquer. A ISR precisa carregar o seu próprio DS (e restaurar o antigo) ou usar CS:.

? O que acontece se uma rotina instalada na INT 08h esquecer o EOI?
- Nada, o PIC libera sozinho
+ O PIC não entrega mais a IRQ 0 nem as de prioridade menor, como o teclado
- O timer passa a disparar mais rápido
> O PIC fica esperando o fim do atendimento. Até o EOI chegar, IRQ 0 a 7 ficam bloqueadas.

? Por que é mais seguro usar a INT 1Ch do que a INT 08h para tarefas periódicas?
- Porque a INT 1Ch é mais rápida
+ Porque a BIOS já atualiza o relógio e manda o EOI, e a INT 1Ch só precisa terminar com IRET
- Porque a INT 1Ch não precisa preservar registradores
> A INT 1Ch é chamada de dentro da rotina da BIOS. Mesmo assim ela precisa preservar registradores e ser curta.

? O que um programa precisa fazer com os vetores que alterou antes de terminar?
- Nada, o DOS restaura tudo
+ Restaurar os vetores originais com AH = 25h
- Zerar os vetores
> O DOS não restaura os vetores (com exceção de 22h, 23h e 24h). Um vetor apontando para memória liberada trava o PC na próxima interrupção.
```

## Exercícios

```exercicio
id: a15-1
titulo: Dez tiques
nivel: 2
timer: sim
maxPassos: 300000
exigir: IRET
--- enunciado
Complete o programa: guarde o vetor antigo da **INT 1Ch**, instale a rotina **RELOGIO** (que soma 1 em **contador**), espere até contador chegar a **10** e restaure o vetor antigo antes de sair. O laço de espera já está pronto. Escreva também a rotina RELOGIO.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
contador DW 0
antigo   DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; 1. guarde o vetor antigo da INT 1Ch em antigo
        ; 2. instale RELOGIO na INT 1Ch

@@espera:
        CMP  contador, 10
        JB   @@espera

        ; 3. restaure o vetor antigo

        MOV  AX, 4C00h
        INT  21h

RELOGIO PROC FAR
        ; some 1 em contador, preservando os registradores
RELOGIO ENDP
END inicio
--- testes
[{ "nome": "contador = 10", "espera": { "mem": { "contador": 10 }, "pilhaEquilibrada": true } }]
--- dicas
AX = 351Ch e INT 21h devolvem o vetor em ES:BX. Guarde com MOV WORD PTR antigo,BX e MOV WORD PTR antigo+2,ES.
Para instalar: PUSH DS / MOV AX,CS / MOV DS,AX / MOV DX,OFFSET RELOGIO / MOV AX,251Ch / INT 21h / POP DS.
Na rotina: PUSH AX, PUSH DS, carregue DS com @DATA, INC contador, POP DS, POP AX, IRET.
Para restaurar: PUSH DS / LDS DX,antigo / MOV AX,251Ch / INT 21h / POP DS.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
contador DW 0
antigo   DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 351Ch
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET RELOGIO
        MOV  AX, 251Ch
        INT  21h
        POP  DS

@@espera:
        CMP  contador, 10
        JB   @@espera

        PUSH DS
        LDS  DX, antigo
        MOV  AX, 251Ch
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

RELOGIO PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        INC  contador
        POP  DS
        POP  AX
        IRET
RELOGIO ENDP
END inicio
```

```exercicio
id: a15-2
titulo: O relógio parou
nivel: 2
timer: sim
maxPassos: 300000
--- enunciado
Este programa substitui a rotina do timer (**INT 08h**) e espera 10 tiques, mas trava: o contador sobe para 1 e nunca mais muda. Descubra o que falta na rotina **TIMER** e conserte.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
tiques  DW 0
antigo  DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3508h
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET TIMER
        MOV  AX, 2508h
        INT  21h
        POP  DS
@@espera:
        CMP  tiques, 10
        JB   @@espera
        PUSH DS
        LDS  DX, antigo
        MOV  AX, 2508h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

TIMER   PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        INC  tiques
        POP  DS
        POP  AX
        IRET
TIMER   ENDP
END inicio
--- testes
[{ "nome": "o timer continua disparando até 10", "espera": { "mem": { "tiques": 10 } } }]
--- dicas
Rode no laboratório com o painel IVT aberto: o contador para em 1. Quem está esperando um aviso de "terminei"?
O PIC 8259A precisa receber o EOI: o valor 20h na porta 20h.
O EOI usa AL, então coloque-o antes do POP AX.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
tiques  DW 0
antigo  DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3508h
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET TIMER
        MOV  AX, 2508h
        INT  21h
        POP  DS
@@espera:
        CMP  tiques, 10
        JB   @@espera
        PUSH DS
        LDS  DX, antigo
        MOV  AX, 2508h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

TIMER   PROC FAR
        PUSH AX
        PUSH DS
        MOV  AX, @DATA
        MOV  DS, AX
        INC  tiques
        MOV  AL, 20h        ; EOI para o 8259A
        OUT  20h, AL
        POP  DS
        POP  AX
        IRET
TIMER   ENDP
END inicio
```

```exercicio
id: a15-3
titulo: Serviço de maiúsculas
nivel: 3
exigir: IRET
--- enunciado
Crie um serviço na **INT 60h** que converte o caractere em **AL** para maiúscula (letras de a a z; o resto fica como está) e preserva todos os outros registradores. O programa principal lê uma tecla, chama `INT 60h` e imprime o resultado. Instale o serviço antes do uso e restaure o vetor antigo no fim.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
antigo  DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; guarde o vetor 60h e instale MAIUSC

        MOV  AH, 08h        ; lê uma tecla
        INT  21h
        INT  60h            ; AL = maiúscula
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h

        ; restaure o vetor 60h

        MOV  AX, 4C00h
        INT  21h

MAIUSC  PROC FAR
        ; seu código aqui
MAIUSC  ENDP
END inicio
--- testes
[{ "nome": "g -> G", "entrada": "g", "espera": { "saida": "G", "pilhaEquilibrada": true } },
 { "nome": "Q continua Q", "entrada": "Q", "espera": { "saida": "Q" } },
 { "nome": "z -> Z", "entrada": "z", "espera": { "saida": "Z" } },
 { "nome": "5 continua 5", "entrada": "5", "espera": { "saida": "5" } }]
--- dicas
O programa inicial chama INT 60h sem rotina instalada: o vetor aponta para a rotina padrão, que não faz nada.
Na rotina: CMP AL,'a' / JB fim / CMP AL,'z' / JA fim / SUB AL,20h / fim: IRET.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
antigo  DD ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 3560h
        INT  21h
        MOV  WORD PTR antigo, BX
        MOV  WORD PTR antigo+2, ES
        PUSH DS
        MOV  AX, CS
        MOV  DS, AX
        MOV  DX, OFFSET MAIUSC
        MOV  AX, 2560h
        INT  21h
        POP  DS

        MOV  AH, 08h
        INT  21h
        INT  60h
        MOV  DL, AL
        MOV  AH, 02h
        INT  21h

        PUSH DS
        LDS  DX, antigo
        MOV  AX, 2560h
        INT  21h
        POP  DS
        MOV  AX, 4C00h
        INT  21h

MAIUSC  PROC FAR
        CMP  AL, 'a'
        JB   @@fim
        CMP  AL, 'z'
        JA   @@fim
        SUB  AL, 20h
@@fim:  IRET
MAIUSC  ENDP
END inicio
```

:::resumo
- Dispositivos pedem atenção pelas linhas IRQ 0 a 7 do 8259A; a IRQ n vira a `INT 08h+n` no PC.
- IF liga (`STI`) e desliga (`CLI`) as interrupções de hardware. `INT` desliga IF automaticamente.
- Uma ISR preserva todos os registradores, carrega o seu próprio DS, é curta e termina com `IRET`.
- Guarde o vetor antigo (`AH=35h`), instale o seu (`AH=25h`, DS:DX) e **restaure antes de sair**.
- A `INT 1Ch` é chamada pela BIOS a cada tique (18,2 por segundo). Na `INT 08h` direta, é preciso mandar o EOI (`MOV AL,20h` / `OUT 20h,AL`) ou encadear com a rotina antiga.
- Rotinas de hardware não devem chamar o DOS: ele não é reentrante.
:::
