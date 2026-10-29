---
id: aula72
numero: 72
modulo: 22
titulo: A TSS e a troca de pilha
subtitulo: Estrutura da TSS, LTR e a pilha do anel 0 na transição de anel
duracao: 65 min
objetivos: entender a estrutura do segmento de estado de tarefa (TSS) de 32 bits; montar um descritor de TSS na GDT e carregá-lo com LTR; compreender por que a CPU precisa de uma pilha separada ao receber uma interrupção do anel 3
---

## Por que a CPU precisa de uma pilha separada?

Quando uma interrupção chega enquanto o código roda no anel 0, a CPU apenas empilha EIP, CS e EFLAGS na pilha atual — simples. Mas se o código estiver no **anel 3** e a interrupção precisar ir para um handler no **anel 0**, há um problema:

> A pilha do anel 3 não é confiável. O kernel não pode usar a pilha do processo de usuário para guardar seu próprio contexto.

A solução do 386: a CPU busca a **pilha do anel 0** numa estrutura chamada **TSS** (Task State Segment) e troca a pilha antes de empilhar o contexto interrompido.

## A estrutura da TSS de 32 bits

```diagrama titulo="Estrutura da TSS de 32 bits (primeiros 108 bytes)"
offset  tam   campo
 0      word  back link (seletor da tarefa anterior; usado em troca por hardware)
 2      word  reservado
 4     dword  ESP0  ← pilha do anel 0 (lida pela CPU ao receber INT do anel 3)
 8      word  SS0   ← seletor de pilha do anel 0
10      word  reservado
12     dword  ESP1  (raro)
16      word  SS1
...
28     dword  CR3   (para hardware task switch)
32     dword  EIP   (salvo/restaurado em hardware task switch)
36     dword  EFLAGS
40-68  dword  EAX, ECX, EDX, EBX, ESP, EBP, ESI, EDI
72-96  word   ES, CS, SS, DS, FS, GS (+ padding)
100    word   LDTR
102    word   debug trap
104    word   I/O map base (0x68 = sem mapa de E/S, limite mínimo)
```

Para uso **apenas** como repositório de pilha de anel 0 (o caso mais comum), só precisamos preencher **ESP0** e **SS0**.

## Montando a TSS na GDT

A TSS é referenciada por um **descritor de sistema** na GDT (S=0, tipo=9 = TSS 32-bit disponível):

```diagrama titulo="Descritor de TSS de 32 bits na GDT"
bits 31:16  base[15:0]   — endereço físico do início da TSS
bits 15:0   limite[15:0] — tamanho da TSS em bytes − 1 (mínimo 0x67 = 103)

bits 63:56  base[31:24]
bits 55:52  G=0, AVL
bits 51:48  limite[19:16]
bits 47:40  byte de acesso: P=1, DPL=0, S=0, tipo=9 (0x89)
bits 39:32  base[23:16]
```

Com a TSS em `0x4000` e tamanho mínimo de 0x68 bytes (limite 0x67):

```nasm fragmento titulo="Descritor de TSS para base=0x4000, limite=0x67"
; lo dword: base[15:0]=4000h, limite[15:0]=0067h
; hi dword: base[31:24]=00, G/AVL=0, limite[19:16]=0, acesso=89h, base[23:16]=00
mov dword [tss_gdt_lo], 0x40000067
mov dword [tss_gdt_hi], 0x00008900
```

## LTR — carregando o registrador de tarefa

A instrução `LTR` (Load Task Register) carrega o seletor da TSS atual e torna o descritor "busy":

```nasm executar modo="pm32" titulo="TSS.BIN: TSS mínima com LTR"
        bits 32
        org 100000h

        ; === passo 1: montar a TSS em 0x4000 ===
        ; zeramos os 0x68 bytes
        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd

        ; esp0 = 0x90000 (pilha do anel 0); ss0 = 0x10 (dados anel 0)
        mov dword [0x4004], 0x90000     ; ESP0
        mov  word [0x4008], 0x10        ; SS0

        ; === passo 2: adicionar descritor de TSS na GDT ===
        ; GDT em 0x500; 5 entradas já existem (índices 0–4, limite=0x27)
        ; Adicionamos o índice 5 (seletor 0x28) no offset 0x500 + 5*8 = 0x528
        mov dword [0x528], 0x40000067   ; lo: base[15:0]=4000h, limit=67h
        mov dword [0x52C], 0x00008900   ; hi: P=1, DPL=0, S=0, tipo=9

        ; === passo 3: estender o limite da GDTR para cobrir o novo descritor ===
        sub esp, 6
        mov  word [esp],   6 * 8 - 1   ; novo limite: 47 (6 entradas)
        mov dword [esp+2], 0x500        ; base inalterada
        lgdt [esp]
        add esp, 6

        ; === passo 4: carregar TR ===
        mov ax, 0x28
        ltr ax                          ; TR = seletor da TSS

        mov byte [0xB8000], 'T'
        mov byte [0xB8001], 0x0A
        cli
        hlt
```

:::atencao LTR antes de entrar no anel 3
Se uma interrupção chegar antes que LTR tenha sido executado, a CPU tenta ler a pilha do anel 0 a partir de um TSS inválido e gera uma exceção de falha de TSS (#TS, vetor 10). Carregue sempre TR antes de fazer IRET para o anel 3.
:::

## O que acontece na transição de anel 3 → anel 0

Quando uma interrupção chega com CPL=3 e o handler está no anel 0:

```diagrama titulo="Transição de anel 3 para anel 0 via interrupção"
1. CPU lê ESP0 e SS0 da TSS
2. CPU troca a pilha: SS ← SS0, ESP ← ESP0
3. CPU empilha (no anel 0):  GS, FS, DS, ES (somente se vindo do modo v86)
                              SS3, ESP3    (pilha do anel 3)
                              EFLAGS
                              CS3, EIP3   (endereço de retorno)
                              código de erro (se houver)
4. CPU salta para o handler
```

No handler, `[esp]` = EIP3, `[esp+4]` = CS3, `[esp+8]` = EFLAGS, `[esp+12]` = ESP3 (pilha do anel 3 na hora do INT), `[esp+16]` = SS3.

```quiz
? Qual é o campo mínimo que a TSS precisa ter preenchido para que a CPU faça a troca de pilha ao receber uma INT do anel 3?
+ ESP0 e SS0 (pilha e seletor de pilha do anel 0)
- Apenas ESP0
- Todo o bloco de registradores (EAX..EDI, CS..GS)
- O campo CR3 da TSS

? Por que o limite mínimo de uma TSS de 32 bits é 0x67?
+ Porque a CPU precisa ler pelo menos 104 bytes (offsets 0x00 a 0x67) para acessar todos os campos de pilha
- Porque qualquer TSS menor que 4 KB gera #TS
- Porque o campo de mapa de E/S fica no offset 0x67
- É uma convenção; qualquer limite funciona

? Após receber uma INT do anel 3 com troca de pilha, o que contém [esp+12] no handler?
+ O valor de ESP que o anel 3 tinha no momento da interrupção (pilha do usuário)
- O valor de ESP0 da TSS
- O endereço de retorno (EIP3)
- O seletor CS do anel 3
```

## Exercícios

```exercicio
id: a72-1
titulo: Montar TSS e carregar TR
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Monte a TSS em `0x4000` (zere 0x68 bytes, depois `ESP0 = 0x90000`, `SS0 = 0x10`). Acrescente o descritor de TSS na GDT (no índice 5, seletor `0x28`): `lo = 0x40000067`, `hi = 0x00008900`. Estenda o limite da GDTR para 6 entradas com LGDT. Execute `LTR 0x28`. Por fim, instale uma porta de interrupção para o vetor `0x80` com DPL=3 (tipo `0xEE`, seletor `0x08`) apontando para `handler`. Do anel 0 (IRET com CS=`0x1B` e SS=`0x23` para anel 3, ESP=`0x80000`), entre no anel 3 e execute `INT 0x80`. O handler (no anel 0) escreve `1` em `resultado` e para com CLI/HLT.
--- inicial
        bits 32
        org 100000h

        ; 1. montar TSS em 0x4000 (zerar + esp0/ss0)

        ; 2. adicionar descritor de TSS na GDT (índice 5 = 0x28)

        ; 3. LGDT com novo limite

        ; 4. LTR 0x28

        ; 5. instalar gate INT 80h com DPL=3 na IDT (vetor 0x80 = offset 0x800 + 0x80*8 = 0xC00)
        ;    dword [0xC00] = (0x08 << 16) | (handler & 0xFFFF)
        ;    dword [0xC04] = (handler & 0xFFFF0000) | 0xEE00

        ; 6. IRET para o anel 3
        push 0x23        ; SS3
        push 0x80000     ; ESP3
        pushfd
        push 0x1B        ; CS3
        push ring3_code  ; EIP3
        iret

ring3_code:
        ; código em anel 3: chama INT 80h
        int 0x80
        hlt              ; nunca deve chegar aqui

handler:
        ; escrever 1 em resultado e parar (anel 0)
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 1", "espera": { "mem": { "resultado": 1 } } }]
--- dicas
TSS: mov edi, 4000h / mov ecx, 0x68/4 / xor eax,eax / rep stosd / mov dword [4004h], 90000h / mov word [4008h], 10h.
GDT: mov dword [528h], 40000067h / mov dword [52Ch], 8900h.
LGDT: sub esp,6 / mov word [esp], 2Fh / mov dword [esp+2], 500h / lgdt [esp] / add esp,6.
LTR: mov ax, 28h / ltr ax.
Gate 80h: mov dword [0C00h], (8 shl 16) or (handler and 0FFFFh) / mov dword [0C04h], (handler and 0FFFF0000h) or 0EE00h.
Handler: mov dword [resultado], 1 / cli / hlt.
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
        int 0x80
        hlt

handler:
        mov dword [resultado], 1
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a72-2
titulo: Ler a pilha do anel 3 a partir do handler
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Repita a configuração de a72-1 (TSS, LGDT, LTR, gate INT 80h com DPL=3). Entre no anel 3 com `ESP3 = 0x80000`. O código de anel 3 executa `INT 0x80`. No handler (anel 0), após a troca de pilha, `[esp+12]` contém o ESP3 original (0x80000). Leia esse valor e escreva-o em `resultado`. O teste verifica que `resultado = 0x80000`.
--- inicial
        bits 32
        org 100000h

        ; configuração completa: TSS, LGDT, LTR, gate 0x80

        push 0x23
        push 0x80000     ; ESP3 = 0x80000 (será lido pelo handler)
        pushfd
        push 0x1B
        push ring3_code
        iret

ring3_code:
        int 0x80
        hlt

handler:
        ; [esp+12] = ESP3 original = 0x80000
        ; leia e salve em resultado, depois pare
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 0x80000", "espera": { "mem": { "resultado": 524288 } } }]
--- dicas
Configuração igual a a72-1.
No handler: mov eax, [esp+12] / mov [resultado], eax / cli / hlt.
Nota: [esp+0]=EIP3, [esp+4]=CS3, [esp+8]=EFLAGS, [esp+12]=ESP3, [esp+16]=SS3.
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
        int 0x80
        hlt

handler:
        mov eax, [esp+12]
        mov [resultado], eax
        cli
        hlt

resultado: dd 0
```

:::resumo
- A **TSS** (Task State Segment) é uma estrutura de memória que a CPU usa para guardar e restaurar o estado de uma tarefa; o campo mais crítico para a maioria dos kernels são **ESP0** e **SS0** (pilha do anel 0).
- O descritor de TSS na GDT tem tipo 0x9 (32-bit, disponível) e S=0.
- `LTR` carrega o seletor da TSS no registrador de tarefa (TR); isso deve ser feito antes de qualquer transição de anel.
- Quando uma interrupção ocorre com CPL=3, a CPU consulta ESP0/SS0 da TSS, troca a pilha para o anel 0 e empilha SS3:ESP3, EFLAGS, CS3:EIP3 nessa nova pilha.
- No handler, `[esp+12]` contém o ESP3 original, permitindo ao kernel ler e modificar o contexto do processo de usuário.
:::
