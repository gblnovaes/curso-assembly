---
id: aula74
numero: 74
modulo: 23
titulo: Troca de tarefas por hardware
subtitulo: Descritores de TSS, LTR, JMP far a uma tarefa e o mecanismo automático de salvamento
duracao: 65 min
objetivos: entender como o 386 troca tarefas automaticamente via TSS; montar dois descritores de TSS na GDT; executar JMP far para outro TSS; verificar que os registradores da tarefa atual foram salvos e os da nova tarefa foram restaurados
---

## Tarefas no 386

O 386 tem suporte nativo a múltiplas tarefas. Cada tarefa é descrita por uma **TSS** completa, que contém todos os registradores (EAX..EDI, ESP, EBP, ESI, EDI, CS, DS, ES, FS, GS, SS, EIP, EFLAGS, CR3, LDT). Uma **troca de tarefa por hardware** ocorre quando o código executa `JMP far` ou `CALL far` para um seletor cujo descritor na GDT é um TSS (tipo 0x9 = disponível, 0xB = ocupado).

```diagrama titulo="Troca de tarefa por hardware com JMP far"
Tarefa A (TSS_A, tipo=0xB busy)          Tarefa B (TSS_B, tipo=0x9 disponível)
  EIP = <ponto de retorno>                 EIP = <início de B>
  EAX, EBX, ... = estado de A             EAX = 0, EBX = 0, ...
  ↑ CPU salva aqui                         ↓ CPU restaura daqui
```

Passos automáticos ao executar `JMP far [TSS_B_seletor]`:

1. CPU salva EIP, EFLAGS, EAX..EDI, CS, DS..GS na **TSS_A** (a tarefa atual).
2. Marca TSS_A como disponível (tipo=0x9) e TSS_B como ocupado (tipo=0xB).
3. Carrega todos os registradores a partir de **TSS_B**.
4. Executa a partir do EIP salvo na TSS_B.

## Preparando duas TSSes

```nasm executar modo="pm32" titulo="TASKS.BIN: troca de tarefa por hardware"
        bits 32
        org 100000h

        ; === TSS_A em 0x4000 (tarefa atual) ===
        ; zeramos e preenchemos só o essencial
        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        ; A tarefa A não precisa de ESP0/SS0 se ficar no anel 0

        ; === TSS_B em 0x5000 (tarefa a ser lançada) ===
        mov edi, 0x5000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        ; Preencher EIP da tarefa B
        mov dword [0x5020], task_b      ; EIP
        ; EFLAGS da tarefa B: IF=1, reservado=1
        mov dword [0x5024], 0x00000202
        ; CS = 0x08 (código anel 0), SS = DS = ES = FS = GS = 0x10
        mov  word [0x504C], 0x08        ; CS  (offset 76 = 0x4C)
        mov  word [0x5050], 0x10        ; SS
        mov  word [0x5048], 0x10        ; ES
        mov  word [0x5054], 0x10        ; DS
        mov  word [0x5058], 0x10        ; FS
        mov  word [0x505C], 0x10        ; GS
        ; ESP da tarefa B
        mov dword [0x5038], 0x7F000     ; ESP (offset 56 = 0x38)

        ; === descritores de TSS na GDT ===
        ; GDT em 0x500; adicionamos índice 5 (0x28) para TSS_A e índice 6 (0x30) para TSS_B
        mov dword [0x528], 0x40000067   ; TSS_A lo (base=0x4000, limit=0x67)
        mov dword [0x52C], 0x00008900   ; TSS_A hi (P=1, DPL=0, type=9)
        mov dword [0x530], 0x50000067   ; TSS_B lo (base=0x5000, limit=0x67)
        mov dword [0x534], 0x00008900   ; TSS_B hi (P=1, DPL=0, type=9)

        sub esp, 6
        mov  word [esp],   7 * 8 - 1   ; 7 entradas (índices 0–6)
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6

        ; carregar TR com TSS_A (tarefa atual)
        mov ax, 0x28
        ltr ax

        ; trocar para a tarefa B: JMP far com seletor 0x30 (TSS_B)
        jmp 0x30:0                      ; offset ignorado em troca de tarefa

        ; aqui nunca chegamos (a tarefa A não volta sem uma nova troca)
        cli
        hlt

task_b:
        ; agora somos a tarefa B; EAX..EDI = 0 (zeramos TSS_B)
        mov dword [resultado], 0x1234
        cli
        hlt

resultado: dd 0
```

:::cpu Descritores de TSS busy (tipo 0xB)
Quando você carrega um TSS com `LTR`, a CPU muda o tipo do descritor de 0x9 (disponível) para 0xB (ocupado). Um `JMP far` para uma tarefa "busy" gera #GP — a CPU proíbe recursividade de tarefas. `IRET` com o flag NT (Nested Task) ativo volta para a tarefa anterior.
:::

## Limitações da troca por hardware

O mecanismo de hardware salva e restaura ~104 bytes de contexto a cada troca. Em arquiteturas modernas isso é lento, e a maioria dos kernels de produção (Linux, Windows) usa **troca de contexto por software** (próxima aula), salvando apenas os registradores necessários.

```quiz
? Qual instrução inicia uma troca de tarefa por hardware no 386?
+ JMP far (ou CALL far) cujo seletor de destino na GDT aponta para um TSS (tipo 0x9 disponível)
- CALL diretamente seguido de LTR
- MOV TR, seletor
- INT com gate de tarefa pode fazer o mesmo; JMP far para TSS é o mais direto

? Por que o 386 não permite JMP far para uma tarefa "busy" (tipo 0xB)?
+ Para evitar que uma tarefa se chame recursivamente, o que corromperia o estado salvo na TSS
- Porque 0xB é o tipo de um TSS inválido
- Porque a CPU não lê a TSS nesse caso
- A tarefa "busy" só aceita CALL, não JMP

? O que a CPU faz com os registradores da tarefa atual ao executar JMP far para outro TSS?
+ Salva todos os registradores (EAX..EDI, CS..GS, EIP, EFLAGS, CR3) na TSS da tarefa atual e os restaura da nova TSS
- Apenas EIP é salvo; os demais são responsabilidade do software
- Salva apenas os registradores de propósito geral
- Não salva nada; a tarefa anterior é descartada
```

## Exercícios

```exercicio
id: a74-1
titulo: Trocar para uma tarefa com JMP far
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte `TSS_A` em `0x4000` e `TSS_B` em `0x5000` (cada uma com `0x68` bytes zerados). Na `TSS_B`, configure: `EIP = task_b`, `EFLAGS = 0x202`, `CS = 0x08`, `SS = DS = ES = FS = GS = 0x10`, `ESP = 0x7F000`. Acrescente descritores de TSS na GDT: índice 5 (0x28) para TSS_A e índice 6 (0x30) para TSS_B, ambos `lo = base | 0x67`, `hi = 0x00008900`. LGDT com 7 entradas. LTR 0x28. Execute `JMP 0x30:0` para trocar para a tarefa B. Em `task_b`, escreva `0xABCD` em `resultado` e pare.
--- inicial
        bits 32
        org 100000h

        ; monte TSS_A em 0x4000 (zere 0x68 bytes)

        ; monte TSS_B em 0x5000: EIP=task_b, EFLAGS=202h, CS=8, SS/DS/ES/FS/GS=10h, ESP=7F000h
        ; offsets na TSS: EIP=0x20, EFLAGS=0x24, EAX=0x28, ESP=0x38, CS=0x4C, SS=0x50, ES=0x48, DS=0x54, FS=0x58, GS=0x5C

        ; descritores na GDT (estender para 7 entradas, LGDT)

        ; LTR 0x28

        ; trocar para tarefa B
        jmp 0x30:0

        cli
        hlt

task_b:
        ; escreva 0xABCD em resultado e pare
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 0xABCD", "espera": { "mem": { "resultado": 43981 } } }]
--- dicas
TSS_B[0x20] = task_b, TSS_B[0x24] = 0x202.
TSS_B[0x4C] = 0x08 (CS), TSS_B[0x50] = 0x10 (SS), TSS_B[0x48] = 0x10 (ES), TSS_B[0x54] = 0x10 (DS), TSS_B[0x58] = 0x10 (FS), TSS_B[0x5C] = 0x10 (GS).
TSS_B[0x38] = 0x7F000 (ESP).
GDT idx 5: lo=40000067h, hi=8900h; idx 6: lo=50000067h, hi=8900h.
LGDT: 7*8-1 = 0x37.
--- solucao
        bits 32
        org 100000h

        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd

        mov edi, 0x5000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        mov dword [0x5020], task_b
        mov dword [0x5024], 0x202
        mov dword [0x5038], 0x7F000
        mov  word [0x504C], 0x08
        mov  word [0x5050], 0x10
        mov  word [0x5048], 0x10
        mov  word [0x5054], 0x10
        mov  word [0x5058], 0x10
        mov  word [0x505C], 0x10

        mov dword [0x528], 0x40000067
        mov dword [0x52C], 0x00008900
        mov dword [0x530], 0x50000067
        mov dword [0x534], 0x00008900

        sub esp, 6
        mov  word [esp],   7 * 8 - 1
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6

        mov ax, 0x28
        ltr ax

        jmp 0x30:0
        cli
        hlt

task_b:
        mov dword [resultado], 0xABCD
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a74-2
titulo: Duas tarefas com JMP entre si
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte duas TSSes (`TSS_A` em `0x4000`, `TSS_B` em `0x5000`). Configure a tarefa B para iniciar em `task_b`. A tarefa A (código atual) escreve `1` em `marca_a`, depois executa `JMP 0x30:0` para a tarefa B. A tarefa B escreve `1` em `marca_b` e para. O teste verifica que tanto `marca_a` quanto `marca_b` valem 1 (ambas as tarefas rodaram).
--- inicial
        bits 32
        org 100000h

        ; montar TSSes, LGDT, LTR 0x28

        ; tarefa A escreve marca_a = 1
        mov dword [marca_a], 1

        ; JMP para tarefa B
        jmp 0x30:0
        cli
        hlt

task_b:
        ; tarefa B escreve marca_b = 1 e para
        cli
        hlt

marca_a: dd 0
marca_b: dd 0
--- testes
[
  { "nome": "marca_a = 1", "espera": { "mem": { "marca_a": 1 } } },
  { "nome": "marca_b = 1", "espera": { "mem": { "marca_b": 1 } } }
]
--- dicas
Igual a a74-1, mas task_b escreve marca_b antes de parar.
--- solucao
        bits 32
        org 100000h

        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd

        mov edi, 0x5000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        mov dword [0x5020], task_b
        mov dword [0x5024], 0x202
        mov dword [0x5038], 0x7F000
        mov  word [0x504C], 0x08
        mov  word [0x5050], 0x10
        mov  word [0x5048], 0x10
        mov  word [0x5054], 0x10
        mov  word [0x5058], 0x10
        mov  word [0x505C], 0x10

        mov dword [0x528], 0x40000067
        mov dword [0x52C], 0x00008900
        mov dword [0x530], 0x50000067
        mov dword [0x534], 0x00008900

        sub esp, 6
        mov  word [esp],   7 * 8 - 1
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6

        mov ax, 0x28
        ltr ax

        mov dword [marca_a], 1
        jmp 0x30:0
        cli
        hlt

task_b:
        mov dword [marca_b], 1
        cli
        hlt

marca_a: dd 0
marca_b: dd 0
```

:::resumo
- A troca de tarefa por hardware usa **JMP far** (ou CALL far) cujo seletor de destino na GDT é um TSS de tipo 0x9 (disponível).
- A CPU salva automaticamente todos os registradores na **TSS atual** e os restaura da nova TSS.
- Cada TSS precisa ter: EIP, EFLAGS, todos os seletores de segmento e ESP minimamente preenchidos.
- Um TSS "ocupado" (tipo 0xB) não pode ser alvo de JMP far — evita recursividade de tarefas.
- Kernels modernos preferem troca de contexto **por software** por ser mais rápida e controlável; o hardware task switch permanece como referência didática.
:::
