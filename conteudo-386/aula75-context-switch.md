---
id: aula75
numero: 75
modulo: 23
titulo: Troca de contexto por software
subtitulo: Salvar e restaurar registradores manualmente — como Linux e sistemas reais fazem
duracao: 65 min
objetivos: implementar a troca de contexto por software; entender a estrutura de um bloco de controle de processo (PCB) mínimo; escrever uma função switch_to que salva todos os registradores callee-save e restaura os do próximo processo
---

## Por que software em vez de hardware?

A troca por hardware do 386 salva **todos** os 104 bytes do estado a cada mudança de tarefa — incluindo registradores de segmento desnecessários em sistemas que usam um único espaço de endereços plano. Além disso, salvar CR3 é ineficiente se o novo processo tiver o mesmo espaço de páginas.

A troca de contexto **por software** é o que Linux, FreeBSD e a maioria dos kernels usam:

1. Na hora de trocar, o scheduler salva apenas os **registradores callee-save** (EBX, ESI, EDI, EBP) e o ESP.
2. Carrega o ESP do próximo processo.
3. Restaura os registradores callee-save.
4. Faz RET — a pilha do novo processo tem o EIP de retorno no topo.

EAX, ECX e EDX não precisam ser salvos porque, por convenção C (cdecl), quem chama os salva antes de chamar a função (caller-save).

## O PCB mínimo

```diagrama titulo="Bloco de controle de processo (PCB) mínimo para troca por software"
struct pcb {
  uint32_t esp;   // pilha do processo (salva/restaurada na troca)
  uint32_t cr3;   // opcional: espaço de endereços (não usado se compartilhado)
};
```

Na pilha do processo fica o contexto completo de registradores empilhado em ordem:

```
ESP → [EBX] [ESI] [EDI] [EBP] [EIP de retorno]
```

## A função switch_to

```nasm executar modo="pm32" titulo="CTX.BIN: troca de contexto por software"
        bits 32
        org 100000h

        ; PCBs dos dois "processos"
pcb_a: dd 0         ; ESP da tarefa A (preenchido ao chamar switch_to)
pcb_b: dd 0         ; ESP da tarefa B

        ; Pilha da tarefa B: 512 bytes em 0x70000
PILHA_B equ 0x70000

        ; Montar a pilha inicial da tarefa B (como se task_b fosse entrar por RET)
        ; switch_to faz: pop ebx / pop esi / pop edi / pop ebp / ret
        ; então o ESP inicial deve apontar para EBX e task_b fica no topo acima dos regs
        mov dword [PILHA_B -  4], task_b      ; EIP de retorno = ponto de entrada de B
        mov dword [PILHA_B -  8], 0           ; EBP
        mov dword [PILHA_B - 12], 0           ; EDI
        mov dword [PILHA_B - 16], 0           ; ESI
        mov dword [PILHA_B - 20], 0           ; EBX (primeiro pop)
        mov dword [pcb_b], PILHA_B - 20       ; ESP da tarefa B aponta para o topo

        ; Tarefa A começa aqui
        mov dword [marca_a], 1
        ; Chamar switch_to(pcb_a, pcb_b)
        push pcb_b
        push pcb_a
        call switch_to
        add esp, 8
        ; Tarefa A retorna aqui depois que B chamar switch_to de volta (não neste exemplo)
        cli
        hlt

task_b:
        ; Tarefa B: foi lançada por switch_to
        mov dword [marca_b], 1
        cli
        hlt

; switch_to(pcb_atual*, pcb_proximo*)
switch_to:
        mov edx, [esp+4]    ; edx = pcb_atual*
        mov ecx, [esp+8]    ; ecx = pcb_proximo*
        ; salvar callee-save e EIP de retorno (já na pilha — salva ESP)
        push ebp
        push edi
        push esi
        push ebx
        mov [edx], esp       ; pcb_atual->esp = ESP atual
        mov esp, [ecx]       ; ESP = pcb_proximo->esp
        pop ebx
        pop esi
        pop edi
        pop ebp
        ret                  ; EIP do próximo processo (task_b ou onde A parou)

marca_a: dd 0
marca_b: dd 0
```

:::anos90 Linux 2.0 switch_to
O `switch_to` do Linux 2.0 (arch/i386/kernel/process.c) salvava EBX, ESI, EDI, EBP e o ESP do processo atual, depois carregava o ESP do próximo e restaurava seus registradores — exatamente o padrão acima, com a adição de mudar CR3 quando o espaço de endereços era diferente. A instrução `jmp [ecx]` (compilada pelo GCC) foi substituída por `ret` na mesma versão para facilitar o stack unwinding no debugger.
:::

## Contexto completo: salvar todos os registradores

Quando a troca ocorre dentro de uma **interrupção** (preemptiva), é necessário salvar os registradores caller-save também. O handler salva tudo, chama o scheduler, e o contexto restaurado é o frame completo:

```nasm fragmento titulo="Salvando contexto completo num handler de IRQ"
irq_handler:
        pushad              ; EAX, ECX, EDX, EBX, ESP_original, EBP, ESI, EDI
        push ds
        push es
        ; ... chamar scheduler ...
        pop es
        pop ds
        popad
        iret
```

```quiz
? Quais registradores a troca de contexto por software precisa salvar obrigatoriamente?
+ Os callee-save (EBX, ESI, EDI, EBP) e o ESP; EAX/ECX/EDX são caller-save e quem chamou é responsável
- Todos os 32 registradores, igual à troca por hardware
- Apenas o EIP (salvo implicitamente na pilha pelo RET)
- Nenhum, porque o context switch sempre acontece em pontos onde os registradores não têm valor

? Como a pilha inicial de uma nova tarefa é preparada para que switch_to possa lançá-la?
+ A pilha é montada manualmente com o EIP de entrada no topo e os callee-save zerados abaixo; switch_to faz RET para o EIP
- A nova tarefa precisa de uma chamada CALL antes de ser lançada
- A CPU lê o EIP inicial da nova TSS
- O endereço de entrada é colocado em EAX e o switch_to usa JMP EAX

? Qual a vantagem principal da troca por software sobre a por hardware?
+ Salva apenas o contexto necessário (mais rápido) e é portável para outras arquiteturas
- A troca por software é mais lenta mas mais segura
- A troca por hardware é descontinuada no x86-64
- Só a troca por software funciona com paginação ativa
```

## Exercícios

```exercicio
id: a75-1
titulo: switch_to lança tarefa B
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Implemente `switch_to(pcb_atual*, pcb_proximo*)`. A tarefa B terá sua pilha inicial montada em `0x70000`: empilhe (em ordem inversa, decrementando o ponteiro) `EBP=0`, `EDI=0`, `ESI=0`, `EBX=0`, `EIP=task_b`; salve o ESP resultante em `pcb_b`. Chame `switch_to(pcb_a, pcb_b)` da tarefa A. Em `task_b`, escreva `0x5555` em `resultado` e pare. A função `switch_to` deve: salvar EBP, EDI, ESI, EBX na pilha, salvar ESP em `pcb_atual->esp`, carregar ESP de `pcb_proximo->esp`, restaurar EBX, ESI, EDI, EBP, executar RET.
--- inicial
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000

        ; prepare a pilha inicial da tarefa B em PILHA_B
        ; (EIP=task_b no topo, depois EBX, ESI, EDI, EBP zerados)

        ; salve o ESP da tarefa B em pcb_b

        ; chame switch_to
        push pcb_b
        push pcb_a
        call switch_to
        add esp, 8

        cli
        hlt

task_b:
        ; escreva resultado = 0x5555 e pare
        cli
        hlt

switch_to:
        ; salvar callee-save + ESP em pcb_atual
        ; carregar ESP de pcb_proximo
        ; restaurar callee-save e retornar
        ret

resultado: dd 0
--- testes
[{ "nome": "resultado = 0x5555", "espera": { "mem": { "resultado": 21845 } } }]
--- dicas
Pilha de B: mov dword [PILHA_B-4], 0 / [PILHA_B-8]=0 / [PILHA_B-12]=0 / [PILHA_B-16]=0 / [PILHA_B-20]=task_b.
pcb_b: mov dword [pcb_b], PILHA_B-20.
switch_to: mov edx,[esp+4] / mov ecx,[esp+8] / push ebp/edi/esi/ebx / mov [edx],esp / mov esp,[ecx] / pop ebx/esi/edi/ebp / ret.
--- solucao
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000

        mov dword [PILHA_B -  4], task_b
        mov dword [PILHA_B -  8], 0
        mov dword [PILHA_B - 12], 0
        mov dword [PILHA_B - 16], 0
        mov dword [PILHA_B - 20], 0
        mov dword [pcb_b], PILHA_B - 20

        push pcb_b
        push pcb_a
        call switch_to
        add esp, 8
        cli
        hlt

task_b:
        mov dword [resultado], 0x5555
        cli
        hlt

switch_to:
        mov edx, [esp+4]
        mov ecx, [esp+8]
        push ebp
        push edi
        push esi
        push ebx
        mov [edx], esp
        mov esp, [ecx]
        pop ebx
        pop esi
        pop edi
        pop ebp
        ret

resultado: dd 0
```

```exercicio
id: a75-2
titulo: Tarefas A e B se revezam duas vezes
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Configure duas tarefas com `switch_to`. A tarefa A escreve `1` em `conta_a`, chama `switch_to(pcb_a, pcb_b)`, escreve `2` em `conta_a` e para. A tarefa B escreve `1` em `conta_b`, chama `switch_to(pcb_b, pcb_a)` (volta para A), escreve `2` em `conta_b` e para. O teste verifica que `conta_a = 2` e `conta_b = 2` (ambas completaram dois ciclos). Use `PILHA_B = 0x70000` e `PILHA_A_INICIAL = ESP (ignorar na função)`.
--- inicial
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000

        ; prepare pilha B (task_b)

        mov dword [conta_a], 1
        push pcb_b
        push pcb_a
        call switch_to
        add esp, 8
        ; volta aqui após B fazer switch_to(pcb_b, pcb_a)
        mov dword [conta_a], 2
        cli
        hlt

task_b:
        mov dword [conta_b], 1
        push pcb_a
        push pcb_b
        call switch_to
        add esp, 8
        ; nunca chega aqui neste exercício
        mov dword [conta_b], 2
        cli
        hlt

switch_to:
        ; mesmo de a75-1
        ret

conta_a: dd 0
conta_b: dd 0
--- testes
[
  { "nome": "conta_a = 2", "espera": { "mem": { "conta_a": 2 } } },
  { "nome": "conta_b = 2", "espera": { "mem": { "conta_b": 2 } } }
]
--- dicas
task_b escreve conta_b=1, chama switch_to(pcb_b, pcb_a), quando retorna escreve conta_b=2.
A tarefa A retorna do switch_to e escreve conta_a=2.
switch_to igual ao de a75-1.
--- solucao
        bits 32
        org 100000h

pcb_a:  dd 0
pcb_b:  dd 0

PILHA_B equ 0x70000

        mov dword [PILHA_B -  4], task_b
        mov dword [PILHA_B -  8], 0
        mov dword [PILHA_B - 12], 0
        mov dword [PILHA_B - 16], 0
        mov dword [PILHA_B - 20], 0
        mov dword [pcb_b], PILHA_B - 20

        mov dword [conta_a], 1
        push pcb_b
        push pcb_a
        call switch_to
        add esp, 8
        ; volta aqui após B chamar switch_to(b, a)
        mov dword [conta_a], 2
        ; trocar de volta para B para B completar
        push pcb_b
        push pcb_a
        call switch_to
        add esp, 8
        cli
        hlt

task_b:
        mov dword [conta_b], 1
        push pcb_a
        push pcb_b
        call switch_to
        add esp, 8
        ; volta aqui após A chamar switch_to(a, b) pela segunda vez
        mov dword [conta_b], 2
        cli
        hlt

switch_to:
        mov edx, [esp+4]
        mov ecx, [esp+8]
        push ebp
        push edi
        push esi
        push ebx
        mov [edx], esp
        mov esp, [ecx]
        pop ebx
        pop esi
        pop edi
        pop ebp
        ret

conta_a: dd 0
conta_b: dd 0
```

:::resumo
- A troca de contexto **por software** salva apenas os registradores callee-save (EBX, ESI, EDI, EBP) e o ESP; é mais rápida que a troca por hardware.
- A pilha de uma **nova tarefa** é preparada manualmente com EIP de entrada no topo e callee-save zerados abaixo; `switch_to` faz `RET` e a CPU começa a executar a nova tarefa.
- A função `switch_to(pcb_atual, pcb_proximo)` salva ESP em `pcb_atual->esp` e carrega ESP de `pcb_proximo->esp`.
- Quando a troca ocorre em um handler de IRQ (preemptiva), `pushad`/`popad` salvam/restauram o contexto completo antes do `switch_to`.
:::
