---
id: aula71
numero: 71
modulo: 22
titulo: Anéis de proteção
subtitulo: CPL, DPL e RPL — como o 386 separa o kernel dos processos
duracao: 60 min
objetivos: entender os quatro anéis de privilégio do 386; interpretar CPL, DPL e RPL; saber quando um acesso gera #GP por privilégio insuficiente; demonstrar que RPL limita o acesso mesmo em anel 0
---

## Por que anéis?

Sem proteção, qualquer programa pode executar `HLT`, `CLI`, `MOV CR3, EAX` ou escrever na memória do kernel. Os **anéis de privilégio** do 386 resolvem isso com um mecanismo embutido na CPU:

```diagrama titulo="Os quatro anéis do 386"
anel 0 — kernel do OS        (CPL = 0, máximo privilégio)
  anel 1 — drivers (raro)    (CPL = 1)
    anel 2 — serviços (raro) (CPL = 2)
      anel 3 — processo de usuário  (CPL = 3, mínimo privilégio)
```

Na prática, Linux e a maioria dos sistemas de 32 bits usa apenas os anéis 0 e 3.

## Os três campos de privilégio

```diagrama titulo="Campos de privilégio no 386"
Seletor (16 bits):
  bit 15:3  — índice na GDT ou LDT
  bit 2     — TI (0=GDT, 1=LDT)
  bits 1:0  — RPL (Requested Privilege Level)

Byte de acesso do descritor (GDT/LDT):
  bit 7     — P (presente)
  bits 6:5  — DPL (Descriptor Privilege Level)
  bit 4     — S (segmento de código/dados vs. sistema)
  bits 3:0  — tipo

Registrador CS (invisível):
  bits 1:0  do seletor carregado em CS = CPL (Current Privilege Level)
```

| Campo | Onde fica | O que representa |
|-------|-----------|-----------------|
| **CPL** | Bits 1:0 do seletor em CS | Anel em que o código está rodando |
| **DPL** | Bits 6:5 do byte de acesso do descritor | Anel mínimo para acessar o segmento |
| **RPL** | Bits 1:0 de qualquer seletor | Anel que o seletor "afirma" ter (proteção contra escalonamento de privilégio) |

## A regra de acesso

Para carregar um seletor de **dados** em DS, ES, FS ou GS:

```
max(CPL, RPL) ≤ DPL
```

Se `max(CPL, RPL) > DPL` → **#GP** (exceção de proteção geral).

Para **pilha** (SS): RPL = CPL = DPL (todos iguais).

Para **código** (JMP far / CALL far): sem porta de chamada, DPL = CPL (apenas nível igual). Para **subir** de anel 3 → anel 0 é preciso usar uma porta de chamada, uma interrupção ou uma exceção.

```nasm fragmento titulo="Exemplos de acesso — GDT com index 1=código0, index 2=dados0, index 3=código3, index 4=dados3"
; CPL = 0 (anel 0)
; DPL do seletor 0x10 (dados anel 0) = 0
mov ax, 0x10            ; RPL = 0, max(CPL=0, RPL=0)=0 ≤ DPL=0 → OK
mov ds, ax

mov ax, 0x23            ; DPL=3, RPL=3, max(CPL=0, RPL=3)=3 ≤ DPL=3 → OK
mov ds, ax              ; anel 0 acessa dados de anel 3

mov ax, 0x13            ; seletor 0x10 com RPL=3; max(0,3)=3 > DPL=0 → #GP
mov ds, ax
```

:::cpu RPL e o problema de "confused deputy"
Imagine que um processo de usuário passa ao kernel um seletor de um dado do kernel. Sem o RPL, o kernel (CPL=0) acessaria esse dado privilegiado *em nome* do usuário — um ataque clássico. O RPL impede isso: se o kernel usar o seletor recebido do usuário sem modificá-lo (RPL=3), `max(0,3)=3 > DPL=0` gera #GP mesmo no anel 0.
:::

## O #GP por instrução privilegiada

Certas instruções só existem no anel 0:

| Instrução | Por quê é privilegiada |
|---|---|
| `CLI` / `STI` | Desliga/liga interrupções globais |
| `HLT` | Para o processador |
| `LGDT`, `LIDT` | Redefine tabelas do sistema |
| `MOV CRn` | Muda CR0 (modo protegido/paginação), CR3 (troca de processo) |
| `LTR` | Carrega o registrador de tarefa |
| `IN` / `OUT` | Acesso a portas de E/S (com IOPL<CPL) |

Tentativa de executar qualquer um desses no anel 3 → **#GP** com código de erro 0.

:::atencao IOPL e E/S
`IN`/`OUT` têm uma regra especial: são permitidos se `CPL ≤ IOPL` (bits 13:12 do EFLAGS). Por padrão IOPL=0, então o anel 3 não pode usar IN/OUT. O kernel pode elevar o IOPL de um processo específico (usado por programas de acesso a hardware no Linux com `ioperm()`).
:::

```quiz
? Para carregar um seletor de dados com DPL=1 em DS, qual é a regra que o 386 verifica?
+ max(CPL, RPL) ≤ DPL; se CPL=0 e RPL=0, max=0 ≤ 1 → OK; se CPL=3, max=3 > 1 → #GP
- CPL < DPL em qualquer caso
- Apenas DPL ≥ 0 (qualquer acesso é permitido)
- RPL deve ser igual a CPL

? Um código rodando com CPL=0 tenta carregar o seletor 0x13 em DS (índice 2 da GDT = dados anel 0, DPL=0; RPL=3). O que acontece?
+ #GP, porque max(CPL=0, RPL=3) = 3 > DPL=0
- O carregamento ocorre normalmente; CPL=0 tem privilégio máximo
- O seletor é aceito mas com DPL ajustado para 3
- Apenas #SS (violação de pilha)

? Por que `CLI` causa #GP quando executada no anel 3?
+ É uma instrução privilegiada que só pode ser executada no anel 0
- Porque o bit IF está limpo no modo usuário
- Porque CLI só existe no modo real
- Porque o seletor CS tem DPL=0
```

## Exercícios

```exercicio
id: a71-1
titulo: Carregar seletor de anel 3 do anel 0
nivel: 2
maquina: 386
modo: pm32
--- enunciado
A GDT do modo pm32 tem seletor `0x23` para dados de anel 3 (DPL=3). Carregue-o em DS (de dentro do anel 0, CPL=0). A regra `max(CPL=0, RPL=3) ≤ DPL=3` deve ser satisfeita. Escreva `0x1234` em `resultado` através do DS carregado. Restaure DS para o seletor de dados de anel 0 (`0x10`) antes de parar.
--- inicial
        bits 32
        org 100000h

        ; carregue 0x23 em DS (max(0,3)=3 ≤ DPL=3 → deve funcionar)

        ; escreva 0x1234 em resultado

        ; restaure DS = 0x10

        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 0x1234", "espera": { "mem": { "resultado": 4660 } } }]
--- dicas
mov ax, 0x23 / mov ds, ax — depois use [resultado] normalmente.
--- solucao
        bits 32
        org 100000h

        mov ax, 0x23
        mov ds, ax
        mov dword [resultado], 1234h

        mov ax, 0x10
        mov ds, ax
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a71-2
titulo: RPL viola acesso mesmo no anel 0
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Instale um tratador para o vetor 13 (#GP). Tente carregar o seletor `0x13` em DS: é o seletor de dados de anel 0 (DPL=0 na GDT), mas com RPL=3. A regra `max(CPL=0, RPL=3)=3 > DPL=0` gera #GP mesmo que o código esteja no anel 0. No tratador, descarte o código de erro, escreva `0x4321` em `resultado` e pare.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        ; tente carregar 0x13 em DS → deve gerar #GP
        mov ax, 0x13
        mov ds, ax          ; max(CPL=0, RPL=3)=3 > DPL=0 → #GP

        cli
        hlt

gp_handler:
        ; descarte código de erro, escreva resultado, pare
        iret

resultado: dd 0

        align 8
idt:    times 13 * 8 db 0
        ; vetor 13 aqui
        times (256 - 14) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "resultado = 0x4321", "espera": { "mem": { "resultado": 17185 } } }]
--- dicas
Gate do vetor 13: dw gp_handler & 0FFFFh / dw 08h / db 0 / db 8Eh / dw gp_handler >> 16.
Handler: pop eax (código de erro) / mov dword [resultado], 4321h / cli / hlt.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        mov ax, 0x13
        mov ds, ax
        cli
        hlt

gp_handler:
        pop  eax
        mov  dword [resultado], 4321h
        cli
        hlt

resultado: dd 0

        align 8
idt:    times 13 * 8 db 0
        dw gp_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw gp_handler >> 16
        times (256 - 14) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::resumo
- O 386 tem quatro **anéis de privilégio** (0–3); sistemas operacionais reais usam apenas 0 (kernel) e 3 (usuário).
- **CPL** = bits 1:0 do seletor em CS = anel atual do código em execução.
- **DPL** = bits 6:5 do byte de acesso do descritor = privilégio mínimo exigido para acessar aquele segmento.
- **RPL** = bits 1:0 de qualquer seletor = "anel afirmado" pelo chamador, que limita o acesso mesmo quando CPL=0.
- Regra para dados: `max(CPL, RPL) ≤ DPL`; violação → **#GP** (vetor 13).
- Instruções privilegiadas (CLI, HLT, LGDT, MOV CRn, LTR, IN/OUT) só podem ser executadas no anel 0.
:::
