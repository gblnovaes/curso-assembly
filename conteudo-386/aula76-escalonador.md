---
id: aula76
numero: 76
modulo: 23
titulo: Escalonador com timer
subtitulo: IRQ0, preempção e um escalonador round-robin mínimo
duracao: 70 min
objetivos: usar o IRQ0 (timer 8253/8259) como gatilho de preempção; implementar um escalonador round-robin que troca de contexto a cada tick; verificar que duas tarefas se alternam sem cooperação explícita
---

## Preempção: forçar a troca de contexto

A cooperação entre tarefas — onde cada tarefa chama `switch_to` voluntariamente — funciona apenas se todas as tarefas forem "bem comportadas". Um kernel real precisa de **preempção**: a troca acontece mesmo que a tarefa não queira.

O **IRQ0** (pino INT do timer 8253) é a fonte clássica de preempção. A cada ~55 ms (18,2 Hz padrão), o timer dispara, o PIC entrega o IRQ0 ao vetor 0x20, e o handler do sistema operacional troca a tarefa atual.

## Handler de IRQ0 com troca de contexto

```nasm executar modo="pm32" titulo="SCHED.BIN: escalonador round-robin com IRQ0"
        bits 32
        org 100000h

; ---- PCBs das duas tarefas ----
pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000
PILHA_A equ 0x80000       ; pilha da tarefa A (usaremos o ESP atual)

; ---- estrutura do escalonador ----
tarefa_atual: dd pcb_a    ; ponteiro para o PCB da tarefa que está rodando

; ---- preparar pilha inicial da tarefa B (frame pushad + iret) ----
        mov dword [PILHA_B -  4], 0x202       ; EFLAGS (IF=1)
        mov dword [PILHA_B -  8], 0x08        ; CS (seletor ring-0)
        mov dword [PILHA_B - 12], task_b      ; EIP = ponto de entrada de B
        mov dword [PILHA_B - 16], 0           ; EAX
        mov dword [PILHA_B - 20], 0           ; ECX
        mov dword [PILHA_B - 24], 0           ; EDX
        mov dword [PILHA_B - 28], 0           ; EBX
        mov dword [PILHA_B - 32], 0           ; ESP (ignorado pelo popad)
        mov dword [PILHA_B - 36], 0           ; EBP
        mov dword [PILHA_B - 40], 0           ; ESI
        mov dword [PILHA_B - 44], 0           ; EDI
        mov dword [pcb_b], PILHA_B - 44

; ---- configurar IRQ0 (8253 já configurado pelo simulador; só precisamos habilitar o PIC) ----
        ; IDT: vetor 0x20 = IRQ0 (remapeado pelo pm32)
        mov dword [0x900], (0x08 << 16) | (irq0_handler & 0xFFFF)
        mov dword [0x904], (irq0_handler & 0xFFFF0000) | 0x8E00

        ; Desmascarar IRQ0 no PIC mestre (IMR do mestre = porta 0x21)
        in  al, 0x21
        and al, 0xFE        ; bit 0 = IRQ0
        out 0x21, al

        sti                  ; ligar interrupções

; ---- tarefa A ----
task_a:
        inc dword [conta_a]
        cmp dword [conta_a], 5
        jb  task_a
        ; chegou a 5 ticks; aguardar o mesmo para B
.aguarda:
        cmp dword [conta_b], 5
        jb  .aguarda
        cli
        hlt

task_b:
        inc dword [conta_b]
        cmp dword [conta_b], 5
        jb  task_b
        ; B continuará a ser escalonada (A ainda espera)
        cli
        hlt

; ---- handler do IRQ0 ----
irq0_handler:
        pushad              ; salvar contexto completo do processo interrompido
        mov  al, 0x20       ; EOI para o PIC mestre
        out  0x20, al

        ; switch_to simples: alterna entre pcb_a e pcb_b
        mov  eax, [tarefa_atual]
        mov  [eax], esp          ; salvar ESP no PCB atual

        ; alternar a tarefa atual para a outra
        cmp  eax, pcb_a
        je   .para_b
        mov  dword [tarefa_atual], pcb_a
        jmp  .restaurar
.para_b:
        mov  dword [tarefa_atual], pcb_b
.restaurar:
        mov  eax, [tarefa_atual]
        mov  esp, [eax]          ; carregar ESP do próximo processo
        popad
        iret

conta_a: dd 0
conta_b: dd 0
```

:::atencao EOI no handler de IRQ
Após tratar um IRQ, o handler **deve** enviar um End-Of-Interrupt (`mov al, 0x20 / out 0x20, al`) antes do `IRET`. Sem o EOI, o PIC bloqueia todos os IRQs do mesmo nível ou superior, e o timer nunca dispara novamente — o sistema trava.
:::

:::cpu O timer 8253/8254 no PC
O circuito 8253 tem três contadores de 16 bits. O contador 0, ligado ao pino INT do PIC mestre, é programado pelo BIOS para disparar a ~18,2 Hz (divisor 0 = 65536 no modo divisor de 1,193182 MHz). Kernels modernos reprogramam o contador para 100 Hz, 250 Hz ou 1000 Hz para granularidade maior.
:::

## O ciclo completo de preempção

```diagrama titulo="Ciclo de preempção por IRQ0"
Tarefa A rodando
  → timer dispara → IRQ0 → handler
     → pushad salva contexto A
     → EOI para PIC
     → pcb_a.esp = ESP atual
     → ESP = pcb_b.esp
     → popad restaura contexto B
     → iret → Tarefa B continua
Tarefa B rodando
  → timer dispara → IRQ0 → handler
     → ... → Tarefa A continua
```

```quiz
? Por que é necessário enviar EOI ao PIC antes de fazer IRET no handler do IRQ0?
+ Sem EOI o PIC bloqueia IRQs do mesmo nível ou inferior; o timer não dispara de novo e o sistema trava
- O EOI limpa o bit IF no EFLAGS
- O EOI é necessário apenas para IRQs de hardware, não para software
- O PIC envia EOI automaticamente depois do IRET

? Por que o handler de IRQ0 usa `pushad`/`popad` em vez de apenas salvar callee-save como o switch_to cooperativo?
+ A preempção interrompe a tarefa em qualquer ponto; EAX, ECX e EDX podem ter valores importantes que a tarefa espera não perder
- pushad é mais rápido que salvar registradores individualmente
- switch_to não funciona com interrupções ativas
- Porque popad é necessário para retornar com IRET

? O que define quantas vezes por segundo o handler do IRQ0 é chamado?
+ O divisor programado no contador 0 do 8253; o padrão do BIOS (divisor 0 = 65536) dá ~18,2 Hz
- O IRET do handler define o intervalo
- O bit IF no EFLAGS controla a frequência das interrupções
- A CPU tem um timer interno separado do 8253
```

## Exercícios

```exercicio
id: a76-1
titulo: Escalonador que conta ticks de cada tarefa
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Configure TSS (ESP0=0x90000, SS0=0x10), LGDT, LTR (seletor 0x28). Monte a pilha inicial da tarefa B em `0x70000` (EIP=`task_b`). No handler do IRQ0 (vetor 0x20): salve contexto com `pushad`, envie EOI (`out 0x20, 0x20`), faça a troca de contexto (alterne entre `pcb_a` e `pcb_b`), restaure com `popad` e `iret`. Habilite IRQ0 no PIC (`in al, 0x21 / and al, 0xFE / out 0x21, al`) e execute `sti`. A tarefa A incrementa `conta_a` até 3 e depois **gira em espera** (`.aguarda`) até que `conta_b` também chegue a 3, só então `cli`/`hlt`. Esse giro é essencial: o timer só dispara a cada ~200 instruções, então A precisa continuar executando para ser preemptada e dar a vez a B. A tarefa B incrementa `conta_b` até 3 e para. Verifique que `conta_a = 3` e `conta_b = 3`.
--- inicial
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000
tarefa_atual: dd pcb_a

        ; TSS, LGDT, LTR
        ; preparar pilha B
        ; instalar handler IRQ0 no vetor 0x20 (IDT em 0x800, offset 0x800+0x20*8 = 0x900)
        ; habilitar IRQ0, STI

task_a:
        inc dword [conta_a]
        cmp dword [conta_a], 3
        jb  task_a
.aguarda:                     ; gira esperando B (dá tempo ao timer preemptar)
        cmp dword [conta_b], 3
        jb  .aguarda
        cli
        hlt

task_b:
        inc dword [conta_b]
        cmp dword [conta_b], 3
        jb  task_b
        cli
        hlt

irq0_handler:
        ; pushad, EOI, switch_to, popad, iret
        iret

conta_a: dd 0
conta_b: dd 0
--- testes
[
  { "nome": "conta_a = 3", "espera": { "mem": { "conta_a": 3 } } },
  { "nome": "conta_b = 3", "espera": { "mem": { "conta_b": 3 } } }
]
--- dicas
TSS/GDT/LTR: igual a a72-1 (0x4000, seletor 0x28).
Pilha B (frame pushad+iret): [PILHA_B-4]=0x202 / [PILHA_B-8]=0x08 / [PILHA_B-12]=task_b / [PILHA_B-16...-44]=0; pcb_b=PILHA_B-44.
Gate IRQ0: mov dword [900h], (8 shl 16)|(irq0_handler and 0FFFFh) / mov dword [904h], (irq0_handler and 0FFFF0000h) or 8E00h.
irq0_handler: pushad / mov al,20h / out 20h,al / mov eax,[tarefa_atual] / mov [eax],esp / cmp eax,pcb_a / je .parab / ... / popad / iret.
--- solucao
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000
tarefa_atual: dd pcb_a

        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        mov dword [0x4004], 0x90000
        mov  word [0x4008], 0x10

        mov dword [0x528], 0x40000067
        mov dword [0x52C], 0x00008900

        sub esp, 6
        mov  word [esp],   0x2F
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6

        mov ax, 0x28
        ltr ax

        mov dword [PILHA_B -  4], 0x202
        mov dword [PILHA_B -  8], 0x08
        mov dword [PILHA_B - 12], task_b
        mov dword [PILHA_B - 16], 0
        mov dword [PILHA_B - 20], 0
        mov dword [PILHA_B - 24], 0
        mov dword [PILHA_B - 28], 0
        mov dword [PILHA_B - 32], 0
        mov dword [PILHA_B - 36], 0
        mov dword [PILHA_B - 40], 0
        mov dword [PILHA_B - 44], 0
        mov dword [pcb_b], PILHA_B - 44

        mov dword [0x900], (0x08 << 16) | (irq0_handler & 0xFFFF)
        mov dword [0x904], (irq0_handler & 0xFFFF0000) | 0x8E00

        in  al, 0x21
        and al, 0xFE
        out 0x21, al
        sti

task_a:
        inc dword [conta_a]
        cmp dword [conta_a], 3
        jb  task_a
.aguarda:                     ; já chegou a 3; gira esperando B para dar tempo ao timer
        cmp dword [conta_b], 3
        jb  .aguarda
        cli
        hlt

task_b:
        inc dword [conta_b]
        cmp dword [conta_b], 3
        jb  task_b
        cli
        hlt

irq0_handler:
        pushad
        mov  al, 0x20
        out  0x20, al

        mov  eax, [tarefa_atual]
        mov  [eax], esp

        cmp  eax, pcb_a
        je   .para_b
        mov  dword [tarefa_atual], pcb_a
        jmp  .restaurar
.para_b:
        mov  dword [tarefa_atual], pcb_b
.restaurar:
        mov  eax, [tarefa_atual]
        mov  esp, [eax]
        popad
        iret

conta_a: dd 0
conta_b: dd 0
```

```exercicio
id: a76-2
titulo: Escalonador conta o número de trocas
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Adapte o escalonador de a76-1. Cada vez que o handler do IRQ0 fizer uma troca de contexto, incremente `trocas`. A tarefa A incrementa `conta_a` até 3 e depois gira em `.aguarda` esperando `conta_b` chegar a 3, só então `cli`/`hlt`. A tarefa B incrementa `conta_b` até 3 e então gira para sempre em `.loopb`. Assim o timer dispara duas vezes: a 1ª troca leva de A para B, a 2ª devolve a A, que vê `conta_b = 3` e encerra. O teste verifica que `trocas = 2`.
--- inicial
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000
tarefa_atual: dd pcb_a

        ; configuração igual a a76-1

task_a:
        inc dword [conta_a]
        cmp dword [conta_a], 3
        jb  task_a
.aguarda:
        cmp dword [conta_b], 3
        jb  .aguarda
        cli
        hlt

task_b:
        inc dword [conta_b]
        cmp dword [conta_b], 3
        jb  task_b
.loopb:
        jmp .loopb

irq0_handler:
        ; igual a a76-1, mas incrementar trocas antes do switch
        iret

conta_a: dd 0
conta_b: dd 0
trocas:  dd 0
--- testes
[
  { "nome": "trocas = 2", "espera": { "mem": { "trocas": 2 } } }
]
--- dicas
No irq0_handler, após o EOI: inc dword [trocas] / mov eax,[tarefa_atual] / ...
--- solucao
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000
tarefa_atual: dd pcb_a

        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        mov dword [0x4004], 0x90000
        mov  word [0x4008], 0x10

        mov dword [0x528], 0x40000067
        mov dword [0x52C], 0x00008900

        sub esp, 6
        mov  word [esp],   0x2F
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6

        mov ax, 0x28
        ltr ax

        mov dword [PILHA_B -  4], 0x202
        mov dword [PILHA_B -  8], 0x08
        mov dword [PILHA_B - 12], task_b
        mov dword [PILHA_B - 16], 0
        mov dword [PILHA_B - 20], 0
        mov dword [PILHA_B - 24], 0
        mov dword [PILHA_B - 28], 0
        mov dword [PILHA_B - 32], 0
        mov dword [PILHA_B - 36], 0
        mov dword [PILHA_B - 40], 0
        mov dword [PILHA_B - 44], 0
        mov dword [pcb_b], PILHA_B - 44

        mov dword [0x900], (0x08 << 16) | (irq0_handler & 0xFFFF)
        mov dword [0x904], (irq0_handler & 0xFFFF0000) | 0x8E00

        in  al, 0x21
        and al, 0xFE
        out 0x21, al
        sti

task_a:
        inc dword [conta_a]
        cmp dword [conta_a], 3
        jb  task_a
.aguarda:
        cmp dword [conta_b], 3
        jb  .aguarda
        cli
        hlt

task_b:
        inc dword [conta_b]
        cmp dword [conta_b], 3
        jb  task_b
.loopb:
        jmp .loopb

irq0_handler:
        pushad
        mov  al, 0x20
        out  0x20, al
        inc  dword [trocas]

        mov  eax, [tarefa_atual]
        mov  [eax], esp

        cmp  eax, pcb_a
        je   .para_b
        mov  dword [tarefa_atual], pcb_a
        jmp  .restaurar
.para_b:
        mov  dword [tarefa_atual], pcb_b
.restaurar:
        mov  eax, [tarefa_atual]
        mov  esp, [eax]
        popad
        iret

conta_a: dd 0
conta_b: dd 0
trocas:  dd 0
```

:::resumo
- A preempção usa o **IRQ0** (timer) para interromper qualquer tarefa a qualquer momento, sem cooperação.
- O handler salva o contexto completo com `pushad`, envia **EOI** ao PIC, executa o `switch_to` e restaura com `popad`/`iret`.
- Sem EOI o PIC bloqueia novos IRQs — o handler ficaria preso num loop infinito ou o timer pararia.
- O escalonador **round-robin** alterna entre `pcb_a` e `pcb_b` a cada tick, dando a cada tarefa uma fatia de tempo igual.
- Em kernels reais, o handler também salva os registradores de segmento (`push ds / push es`) e invoca uma função de scheduler mais sofisticada que considera prioridades.
:::
