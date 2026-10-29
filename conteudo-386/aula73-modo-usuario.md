---
id: aula73
numero: 73
modulo: 22
titulo: Modo usuário e chamadas de sistema
subtitulo: Entrar no anel 3 com IRET e retornar ao kernel via INT 80h
duracao: 70 min
objetivos: entrar no anel 3 via IRET; entender por que o CPL muda ao carregar um CS com RPL=3; executar código de usuário que chama o kernel via INT 80h; verificar que instruções privilegiadas causam #GP no anel 3
---

## Entrando no anel 3

A única maneira de **descer** para um anel menos privilegiado no 386 é via **IRET**: ao desempilhar um seletor de CS com RPL > CPL, a CPU também desempilha SS:ESP e muda o CPL.

```nasm fragmento titulo="Entrando no anel 3 a partir do anel 0"
; Frame IRET para transição inter-anel (ordem de push = inversa da pop):
push 0x23        ; SS anel 3 (DPL=3, RPL=3)
push 0x80000     ; ESP no anel 3
pushfd           ; EFLAGS
push 0x1B        ; CS anel 3 (DPL=3, RPL=3)
push ring3_code  ; EIP
iret
; CPU desempilha EIP, CS (RPL=3), EFLAGS, ESP, SS
; Como RPL do CS > CPL atual, carrega SS:ESP e seta CPL=3
```

Após o IRET, `CPL = 3`. O código em `ring3_code` roda no anel 3.

:::cpu Por que IRET e não JMP?
JMP far e CALL far só podem ir para anéis iguais ou mais privilegiados (com porta de chamada). Para ir de anel 0 → anel 3 é preciso "simular um retorno" com IRET — o mesmo mecanismo que os sistemas operacionais usam para lançar um processo de usuário pela primeira vez.
:::

## Chamadas de sistema via INT

O anel 3 não pode executar diretamente código do kernel — a CPU impede acesso a segmentos com DPL=0. A solução clássica: **INT** com um gate de DPL=3 na IDT.

O Linux histórico (i386) usava `INT 0x80`. A convenção:

```
EAX = número da chamada de sistema
EBX, ECX, EDX, ESI, EDI = argumentos
Retorno em EAX
```

Para que `INT 0x80` funcione do anel 3, o gate no vetor 0x80 da IDT deve ter **DPL=3** (tipo `0xEE`). Gates com DPL=0 bloqueiam o `INT` com #GP quando CPL=3.

```nasm executar modo="pm32" titulo="SYSCALL.BIN: INT 80h do anel 3"
        bits 32
        org 100000h

        ; --- TSS em 0x4000 ---
        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        mov dword [0x4004], 0x90000
        mov  word [0x4008], 0x10

        ; --- descritor TSS no GDT ---
        mov dword [0x528], 0x40000067
        mov dword [0x52C], 0x00008900
        sub esp, 6
        mov  word [esp],   0x2F
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6
        mov ax, 0x28
        ltr ax

        ; --- gate INT 80h com DPL=3 (tipo 0xEE) na IDT ---
        ; IDT em 0x800; vetor 0x80 em offset 0x800 + 0x80*8 = 0xC00
        mov dword [0xC00], (0x08 << 16) | (syscall & 0xFFFF)
        mov dword [0xC04], (syscall & 0xFFFF0000) | 0xEE00

        ; --- entrar no anel 3 ---
        mov ax, 0x23
        mov ds, ax
        mov es, ax
        push 0x23
        push 0x80000
        pushfd
        push 0x1B
        push ring3_code
        iret

ring3_code:
        ; CPL = 3
        mov eax, 1              ; sys_write (número de chamada fictício)
        mov ebx, 'H'            ; argumento: caractere
        int 0x80                ; → syscall handler no anel 0
        ; IRET voltará aqui; mas o handler para, então nunca chegamos

syscall:
        ; Handler no anel 0 — EAX e EBX ainda têm os valores do anel 3
        ; DS=0x23 (anel 3) ainda é válido para acesso no anel 0 (DPL=3 ≥ CPL=0)
        cmp eax, 1
        jne .desconhecida
        ; sys_write: escreve o caractere EBX na tela
        mov byte [0xB8000], bl
        mov byte [0xB8001], 0x0A
        cli
        hlt                     ; handler encerra — não retorna ao anel 3

.desconhecida:
        cli
        hlt
```

## Instruções privilegiadas no anel 3

Ao executar `CLI`, `HLT` ou qualquer instrução privilegiada no anel 3, a CPU gera **#GP** (vetor 13, código de erro = 0). O kernel pode:

1. **Terminar** o processo (comportamento padrão do Linux: SIGSEGV).
2. **Emular** a instrução e retornar com IRET (usado em monitor v86 — módulo 24).
3. Para `CLI`/`STI`: ignorá-las (Linux não o faz, mas é possível avançando EIP no handler).

```nasm fragmento titulo="#GP do anel 3 ao tentar CLI — handler avança EIP"
gp_handler:
        pop  ecx                ; descarta código de erro (0)
        ; EIP empilhado aponta para CLI (0xFA, 1 byte)
        add  dword [esp], 1     ; avança EIP 1 byte (pula CLI)
        iret                    ; retorna ao anel 3 na instrução seguinte
```

:::atencao EFLAGS e IRET no anel 3
O IRET do anel 3 não pode alterar IOPL nem certos bits de EFLAGS. A CPU mascara automaticamente as tentativas de mudar bits reservados ao anel 0 ao aplicar os flags restaurados via IRET.
:::

```quiz
? Por que é necessário usar IRET (e não JMP far) para entrar no anel 3?
+ JMP far só pode ir para anéis iguais ou mais privilegiados; IRET é o único mecanismo que abaixa o CPL
- JMP far não existe no modo protegido
- O anel 3 exige que o CS seja carregado por LRET
- Porque o bit de proteção no CR0 bloqueia JMP far

? Para que `INT 0x80` do anel 3 não cause #GP, qual DPL deve ter o gate na IDT?
+ DPL ≥ 3 (geralmente exatamente 3, tipo 0xEE); gates com DPL=0 bloqueiam o INT com #GP
- DPL=0 sempre
- O gate não precisa de DPL especial; é a instrução INT que define o privilégio
- DPL=1

? O que acontece quando código de anel 3 executa CLI?
+ #GP (vetor 13) com código de erro 0; o handler do kernel pode terminar o processo ou avançar EIP e retornar com IRET
- CLI simplesmente não tem efeito no anel 3; flags não mudam
- CLI desliga as interrupções para aquele processo mas não para outros
- Double fault (#DF) porque CLI gera dois erros consecutivos
```

## Exercícios

```exercicio
id: a73-1
titulo: INT 80h que passa EAX ao kernel
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Configure TSS (ESP0=0x90000, SS0=0x10), acrescente seu descritor na GDT (seletor 0x28), execute LGDT e LTR. Instale gate INT 0x80 com DPL=3 (tipo 0xEE). Entre no anel 3 via IRET. O código de anel 3 coloca `0x5A5A` em EAX e chama `INT 0x80`. O handler (anel 0) escreve EAX em `resultado` e para com CLI/HLT.
--- inicial
        bits 32
        org 100000h

        ; TSS, GDT, LTR (igual a a72-1)

        ; gate INT 0x80 com DPL=3

        ; IRET para anel 3
        push 0x23
        push 0x80000
        pushfd
        push 0x1B
        push ring3_code
        iret

ring3_code:
        ; coloque 5A5Ah em EAX e chame INT 80h
        int 0x80
        hlt

handler:
        ; escreva EAX em resultado e pare
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 0x5A5A", "espera": { "mem": { "resultado": 23130 } } }]
--- dicas
ring3_code: mov eax, 5A5Ah / int 80h.
handler: mov [resultado], eax / cli / hlt.
--- solucao
        bits 32
        org 100000h

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

        mov dword [0xC00], (0x08 << 16) | (handler & 0xFFFF)
        mov dword [0xC04], (handler & 0xFFFF0000) | 0xEE00

        mov ax, 0x23
        mov ds, ax
        mov es, ax
        push 0x23
        push 0x80000
        pushfd
        push 0x1B
        push ring3_code
        iret

ring3_code:
        mov eax, 0x5A5A
        int 0x80
        hlt

handler:
        mov [resultado], eax
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a73-2
titulo: CLI no anel 3 gera #GP — handler conta e pula
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Configure TSS, GDT, LTR e gate INT 0x80 (DPL=3). Instale também um tratador para o vetor 13 (#GP, tipo 0x8E, DPL=0). Entre no anel 3. O código de anel 3 executa `CLI` (instrução privilegiada → #GP) seguido de `INT 0x80`. O handler de #GP deve: descartar o código de erro, incrementar `gp_count`, avançar EIP em 1 byte (pular o CLI de 1 byte) e retornar com IRET. O handler de INT 0x80 deve: escrever `gp_count` em `resultado` e parar. Verifique que `resultado = 1`.
--- inicial
        bits 32
        org 100000h

        ; TSS, GDT, LTR
        ; gate 0x80 (DPL=3), gate 0x0D (DPL=0)

        push 0x23
        push 0x80000
        pushfd
        push 0x1B
        push ring3_code
        iret

ring3_code:
        cli             ; → #GP: handler incrementa gp_count e avança EIP
        int 0x80        ; → handler escreve gp_count em resultado e para

gp_handler:
        ; pop código de erro
        ; incrementar gp_count
        ; add dword [esp], 1  (avança EIP para pular o CLI)
        ; iret
        iret

syscall_handler:
        ; escreva gp_count em resultado, pare
        cli
        hlt

gp_count:  dd 0
resultado: dd 0
--- testes
[{ "nome": "resultado = 1 (#GP pelo CLI)", "espera": { "mem": { "resultado": 1 } } }]
--- dicas
Gate #GP (vetor 13): igual ao gate 0x80 mas tipo 0x8Eh (DPL=0) e apontando para gp_handler.
gp_handler: pop ecx / inc dword [gp_count] / add dword [esp], 1 / iret.
syscall_handler: mov eax, [gp_count] / mov [resultado], eax / cli / hlt.
--- solucao
        bits 32
        org 100000h

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

        ; gate INT 80h: DPL=3, tipo 0xEE
        mov dword [0xC00], (0x08 << 16) | (syscall_handler & 0xFFFF)
        mov dword [0xC04], (syscall_handler & 0xFFFF0000) | 0xEE00

        ; gate #GP (vetor 13): DPL=0, tipo 0x8E; IDT[13] = 0x800 + 13*8 = 0x868
        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

        mov ax, 0x23
        mov ds, ax
        mov es, ax
        push 0x23
        push 0x80000
        pushfd
        push 0x1B
        push ring3_code
        iret

ring3_code:
        cli
        int 0x80
        hlt

gp_handler:
        pop  ecx
        inc  dword [gp_count]
        add  dword [esp], 1
        iret

syscall_handler:
        mov eax, [gp_count]
        mov [resultado], eax
        cli
        hlt

gp_count:  dd 0
resultado: dd 0
```

:::resumo
- Para entrar no anel 3, o kernel usa **IRET** empilhando SS3:ESP3, EFLAGS, CS3:EIP3 (CS com RPL=3) na pilha do anel 0.
- A CPU detecta que CS.RPL > CPL, troca a pilha para SS3:ESP3 e seta CPL=3.
- Chamadas de sistema são feitas com **INT 0x80** (ou outro vetor); o gate na IDT deve ter **DPL=3** para que o anel 3 possa usá-lo.
- Instruções privilegiadas (CLI, HLT, LGDT…) no anel 3 geram **#GP** com código de erro 0; o handler pode terminar o processo ou avançar EIP e retornar.
- O padrão Linux i386 passa o número de syscall em EAX e argumentos em EBX/ECX/EDX/ESI/EDI; o retorno vem em EAX.
:::
