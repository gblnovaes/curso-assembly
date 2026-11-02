---
id: aula86
numero: 86
modulo: 27
titulo: Monolítico ou microkernel?
subtitulo: A grande decisão de projeto de um sistema operacional e o preço de cada escolha
duracao: 65 min
objetivos: distinguir kernel monolítico, microkernel e híbrido; entender o que fica dentro e fora do kernel em cada modelo; calcular o custo de uma chamada por troca de mensagens; ver como a isolação de falhas permite reiniciar um servidor que travou
---

## A pergunta que todo projetista faz

Você já escreveu um kernel pequeno nos módulos anteriores. Ele tem um escalonador, tratamento de interrupções, memória, um sistema de arquivos e um shell. A pergunta de projeto agora é: **o que deve rodar no anel 0, com privilégio total, e o que pode rodar como um programa comum?**

Há duas respostas extremas e uma no meio.

```diagrama titulo="Três jeitos de dividir um sistema operacional"
MONOLÍTICO (Unix clássico, Linux)        MICROKERNEL (Minix 3, QNX, L4)
┌───────────────────────────────┐        ┌──────┐ ┌──────┐ ┌──────┐ anel 3
│ anel 0: tudo junto            │        │ FS   │ │ disco│ │ rede │ servidores
│  escalonador · memória        │        └──┬───┘ └──┬───┘ └──┬───┘
│  sistema de arquivos · discos │           └────────┼────────┘
│  rede · terminal · drivers    │        ┌───────────┴───────────┐ anel 0
└───────────────────────────────┘        │ só: IPC, escalonador, │
                                         │ memória e interrupções│
HÍBRIDO (Windows NT, macOS/XNU)          └───────────────────────┘
  desenhado em módulos como um microkernel,
  mas com a maior parte rodando no anel 0
```

- No **kernel monolítico**, todos os serviços vivem no mesmo espaço de endereços do anel 0. Uma chamada de sistema entra no kernel uma vez e tudo o que ela precisa já está ali, a uma chamada de função de distância.
- No **microkernel**, o anel 0 guarda o mínimo: trocar mensagens entre processos (IPC), escalonar, gerenciar a memória e despachar interrupções. O sistema de arquivos, os drivers e a pilha de rede são **servidores**: processos comuns do anel 3.
- No **híbrido**, o projeto é modular como o de um microkernel, mas por desempenho os módulos rodam todos no anel 0. O Windows NT e o XNU do macOS são assim.

## O preço da isolação

O microkernel não é de graça. Quando um programa pede para ler um arquivo, a chamada vira uma **troca de mensagens**: o programa manda uma mensagem ao servidor de arquivos e espera a resposta. Cada ida e volta custa duas trocas de contexto e duas cópias da mensagem.

```diagrama titulo="Uma leitura de arquivo nos dois modelos"
monolítico:   programa --syscall--> [kernel faz tudo] --retorno--> programa
                                    2 trocas de modo

microkernel:  programa --msg--> kernel --> servidor FS
              programa <--msg-- kernel <-- servidor FS
                                    4 trocas de contexto
                                    (e mais, se o FS pedir ao driver de disco)
```

Em troca desse custo, o microkernel ganha **isolação de falhas**: se o driver de disco tem um erro e trava, só aquele processo cai. O resto do sistema continua rodando, e um servidor especial pode reiniciar o driver. No kernel monolítico, um ponteiro errado em qualquer driver derruba a máquina inteira.

:::anos90 O debate Tanenbaum e Torvalds
Em janeiro de 1992, poucos meses depois do primeiro Linux, o professor Andrew Tanenbaum, autor do Minix, escreveu no grupo de notícias `comp.os.minix` que *"Linux is obsolete"*: para ele, um kernel monolítico era um retrocesso aos anos 1970. Linus Torvalds respondeu que o Linux funcionava hoje, no 386 que ele tinha, e que o desempenho vinha em primeiro lugar. Três décadas depois os dois lados têm razão: o Linux domina servidores e celulares, e o Minix 3 roda, escondido, dentro dos chips Intel modernos (no Intel Management Engine). O L4, de Jochen Liedtke (1993), mostrou que o custo do IPC não é inevitável: uma implementação cuidadosa chegou a ser cerca de vinte vezes mais rápida que a do Mach.
:::

## Um servidor que reencarna

O Minix 3 leva a isolação a sério. Um processo especial, o **servidor de reencarnação**, vigia os drivers. Se um deles trava, o servidor de reencarnação o mata e inicia uma cópia nova, sem reiniciar a máquina e quase sem o usuário notar. A chamada que estava em andamento pode ser repetida.

Os exercícios desta aula simulam as duas ideias: o custo de uma chamada por mensagens, e o conserto de um servidor que caiu.

```quiz
? O que fica dentro do kernel (anel 0) num microkernel como o Minix 3 ou o L4?
+ Só o essencial: troca de mensagens (IPC), escalonamento, memória e despacho de interrupções; o resto são servidores no anel 3
- O sistema de arquivos, os drivers e a pilha de rede, como no Linux
- Nada: um microkernel roda inteiro no anel 3
- Apenas o shell e os utilitários

? Por que uma leitura de arquivo é mais lenta num microkernel do que num kernel monolítico?
+ Porque vira uma troca de mensagens com um servidor: duas trocas de contexto e duas cópias de mensagem por ida e volta, em vez de uma única chamada de sistema
- Porque o microkernel não tem cache de disco
- Porque os servidores rodam em modo real
- Porque o microkernel usa o PIC em vez do APIC

? Qual é a vantagem que o microkernel ganha em troca desse custo?
+ Isolação de falhas: se um driver trava, só ele cai e pode ser reiniciado, sem derrubar o sistema inteiro
- Ele é sempre mais rápido que o monolítico
- Ele não precisa de paginação
- Ele dispensa o escalonador
```

## Exercícios

```exercicio
id: a86-1
titulo: O custo de uma chamada por mensagens
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Simule o IPC de um microkernel. A `caixa` é uma mensagem de dois dwords: `[caixa]` é o pedido e `[caixa+4]` a resposta. `ipc_chama(x)` faz uma ida e volta: grava `x` em `[caixa]`, **conta uma troca de contexto** para o servidor (`inc dword [trocas]`), chama `servidor` (que lê o pedido e grava em `[caixa+4]` o pedido multiplicado por 3), **conta mais uma troca** de volta ao cliente e devolve a resposta em EAX. O cliente chama `ipc_chama` três vezes, com 1, 2 e 3, guardando as respostas em `r1`, `r2` e `r3`. Verifique as respostas 3, 6 e 9 e que `trocas = 6` (duas por chamada).
--- inicial
        bits 32
        org 100000h

        push dword 1
        call ipc_chama
        add  esp, 4
        mov  [r1], eax
        push dword 2
        call ipc_chama
        add  esp, 4
        mov  [r2], eax
        push dword 3
        call ipc_chama
        add  esp, 4
        mov  [r3], eax
        cli
        hlt

ipc_chama:
        ; grave o pedido em [caixa], conte a troca para o servidor,
        ; chame servidor, conte a troca de volta, devolva [caixa+4] em EAX
        ret

servidor:
        ; lê [caixa], grava em [caixa+4] o pedido * 3
        ret

caixa:  dd 0, 0
trocas: dd 0
r1:     dd 0
r2:     dd 0
r3:     dd 0
--- testes
[
  { "nome": "respostas 3, 6 e 9", "espera": { "mem": { "r1": 3, "r2": 6, "r3": 9 } } },
  { "nome": "trocas = 6", "espera": { "mem": { "trocas": 6 } } }
]
--- dicas
ipc_chama: mov eax, [esp+4] / mov [caixa], eax / inc dword [trocas] / call servidor / inc dword [trocas] / mov eax, [caixa+4] / ret.
servidor: mov eax, [caixa] / lea eax, [eax+eax*2] / mov [caixa+4], eax / ret.
--- solucao
        bits 32
        org 100000h

        push dword 1
        call ipc_chama
        add  esp, 4
        mov  [r1], eax
        push dword 2
        call ipc_chama
        add  esp, 4
        mov  [r2], eax
        push dword 3
        call ipc_chama
        add  esp, 4
        mov  [r3], eax
        cli
        hlt

ipc_chama:
        mov  eax, [esp+4]
        mov  [caixa], eax
        inc  dword [trocas]
        call servidor
        inc  dword [trocas]
        mov  eax, [caixa+4]
        ret

servidor:
        mov  eax, [caixa]
        lea  eax, [eax+eax*2]
        mov  [caixa+4], eax
        ret

caixa:  dd 0, 0
trocas: dd 0
r1:     dd 0
r2:     dd 0
r3:     dd 0
```

```exercicio
id: a86-2
titulo: O servidor de reencarnação
nivel: 3
maquina: 386
modo: pm32
--- enunciado
O servidor de disco está **travado**: `viva` vale 0 e uma chamada a ele deve falhar. Implemente `chama_disco(x)`: se `viva = 0`, devolve `-1` em EAX (sem chamar o servidor); senão devolve `x + 100`. Depois implemente o laço do cliente: chama `chama_disco(5)`; se vier `-1`, **conta uma falha** (`inc dword [falhas]`), chama `reencarna` (que põe `viva = 1`, reiniciando o servidor) e tenta de novo. Guarde a resposta final em `resposta`. Verifique `falhas = 1` e `resposta = 105`.
--- inicial
        bits 32
        org 100000h

.tenta:
        push dword 5
        call chama_disco
        add  esp, 4
        cmp  eax, -1
        jne  .ok
        ; conte a falha, reencarne o servidor e tente de novo
        jmp  .tenta
.ok:
        mov  [resposta], eax
        cli
        hlt

chama_disco:
        ; se [viva] = 0, devolve -1; senão devolve x + 100
        ret

reencarna:
        ; o servidor de reencarnação reinicia o driver: viva = 1
        ret

viva:     dd 0
falhas:   dd 0
resposta: dd 0
--- testes
[
  { "nome": "falhas = 1", "espera": { "mem": { "falhas": 1 } } },
  { "nome": "resposta = 105", "espera": { "mem": { "resposta": 105 } } }
]
--- dicas
chama_disco: cmp dword [viva], 0 / je .morto / mov eax, [esp+4] / add eax, 100 / ret / .morto: mov eax, -1 / ret.
No laço: depois do jne, faça inc dword [falhas] / call reencarna / jmp .tenta.
reencarna: mov dword [viva], 1 / ret.
--- solucao
        bits 32
        org 100000h

.tenta:
        push dword 5
        call chama_disco
        add  esp, 4
        cmp  eax, -1
        jne  .ok
        inc  dword [falhas]
        call reencarna
        jmp  .tenta
.ok:
        mov  [resposta], eax
        cli
        hlt

chama_disco:
        cmp  dword [viva], 0
        je   .morto
        mov  eax, [esp+4]
        add  eax, 100
        ret
.morto:
        mov  eax, -1
        ret

reencarna:
        mov  dword [viva], 1
        ret

viva:     dd 0
falhas:   dd 0
resposta: dd 0
```

:::resumo
- Um **kernel monolítico** (Unix, Linux) mantém todos os serviços no anel 0; um **microkernel** (Minix 3, QNX, L4) deixa só IPC, escalonamento, memória e interrupções no kernel e roda o resto como **servidores** no anel 3; um **híbrido** (Windows NT, XNU) é modular mas roda quase tudo no anel 0.
- Uma chamada por **troca de mensagens** custa duas trocas de contexto e duas cópias por ida e volta; a chamada de sistema do monolítico entra no kernel uma só vez.
- A recompensa é a **isolação de falhas**: um driver que trava pode ser reiniciado (o servidor de reencarnação do Minix 3) sem derrubar o sistema.
- Não há um lado certo: o desempenho favorece o monolítico, a robustez favorece o microkernel, e o híbrido tenta ficar no meio.
:::
