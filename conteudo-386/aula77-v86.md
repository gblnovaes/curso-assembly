---
id: aula77
numero: 77
modulo: 24
titulo: O modo virtual 8086
subtitulo: EFLAGS.VM, segmentação real num ambiente protegido e como entrar no modo v86
duracao: 60 min
objetivos: entender o que é o modo virtual 8086; conhecer o flag VM no EFLAGS; entrar no modo v86 via IRET com VM=1; verificar que o código v86 usa endereçamento real-mode (CS * 16 + IP)
---

## O que é o modo v86?

O **modo virtual 8086** (v86) permite que o 386 execute código de 8086 dentro de um ambiente de modo protegido. Um processo rodando em v86 funciona como se fosse um 8086 "caixinha de areia" (sandbox):

- Segmentos são calculados como no modo real: `base = segment_register * 16`.
- O código parece ter acesso direto ao hardware (portas I/O, `INT`), mas na verdade é **interceptado** pelo sistema operacional.
- O CPL efetivo é 3 (menor privilégio).
- A CPU ainda usa a IDT do modo protegido para interrupções.

O monitor v86 (um componente do kernel) intercepta instruções privilegiadas e as emula, devolvendo ao código v86 a ilusão de estar rodando em hardware real.

```diagrama titulo="Mapa de memória com código v86"
Endereço físico
  0x10000 — código do programa DOS (.COM, carregado aqui)
  0x90000 — pilha da tarefa v86
  ...
  0xB8000 — memória de vídeo (acessível diretamente do v86)

Código v86 em CS=0x1000, IP=0x0000:
  endereço físico = 0x1000 * 16 + 0x0000 = 0x10000 ✓
```

## O flag VM no EFLAGS

```diagrama titulo="Bit VM no EFLAGS (bit 17)"
bit 17 = VM (Virtual Mode)
  0 = modo protegido ou modo real normal
  1 = modo virtual 8086 ativo
```

Quando VM=1:
- Segmentos são tratados como no real mode.
- Instruções "sensíveis" (CLI, STI, PUSHF, POPF, IRET, IN, OUT, INT n) geram **#GP** se IOPL < 3.
- O monitor v86 recebe o #GP e decide o que fazer.

## Entrando no modo v86

Para entrar em v86, o kernel faz `IRET` com VM=1 no EFLAGS empilhado. O frame é maior do que no PM (inclui os registradores de segmento v86):

```nasm fragmento titulo="Frame IRET para entrar no modo v86"
; ordem de push (de cima para baixo na pilha):
push 0          ; GS
push 0          ; FS
push 0          ; DS
push 0          ; ES
push 0x9000     ; SS  (v86: segmento da pilha)
push 0xFFF0     ; ESP (v86: ponteiro de pilha inicial)
pushfd
or  dword [esp], 0x20000  ; setar VM=1 (bit 17)
push 0x1000     ; CS  (v86: segmento de código)
push 0          ; EIP (v86: offset inicial)
iret
; → CPU entra em v86: CS=0x1000, IP=0x0000, SS=0x9000, SP=0xFFF0
; código físico executado: 0x1000*16 + 0 = 0x10000
```

```nasm executar modo="pm32" titulo="V86ENTER.BIN: entrar no v86 e escrever na tela"
        bits 32
        org 100000h

        ; TSS mínima em 0x4000 (necessária para que a CPU encontre a pilha do anel 0 ao #GP do v86)
        mov edi, 0x4000
        mov ecx, 0x68 / 4
        xor eax, eax
        rep stosd
        mov dword [0x4004], 0x90000     ; ESP0
        mov  word [0x4008], 0x10        ; SS0

        mov dword [0x528], 0x40000067
        mov dword [0x52C], 0x00008900

        sub esp, 6
        mov  word [esp],   0x2F
        mov dword [esp+2], 0x500
        lgdt [esp]
        add esp, 6

        mov ax, 0x28
        ltr ax

        ; Handler de #GP (vetor 13): captura HLT e outras instruções sensíveis do v86
        mov dword [0x868], (0x08 << 16) | (gp_stop & 0xFFFF)
        mov dword [0x86C], (gp_stop & 0xFFFF0000) | 0x8E00

        ; Copiar código v86 para 0x10000
        ; v86 code: mov ax, 0B800h / mov ds, ax / mov byte [0], 'V' / mov byte [1], 0Eh / hlt
        ; bytes: B8 00 B8 / 8E D8 / C6 06 00 00 56 / C6 06 01 00 0E / F4
        mov edi, 0x10000
        mov dword [edi+0],  0xB800B8
        mov byte  [edi+3],  0x00        ; mov ax, 0B800h
        mov word  [edi+4],  0xD88E      ; mov ds, ax
        mov word  [edi+6],  0x06C6      ; mov byte [0], 'V'
        mov word  [edi+8],  0x0000
        mov byte  [edi+10], 'V'
        mov word  [edi+11], 0x06C6      ; mov byte [1], 0Eh
        mov word  [edi+13], 0x0100
        mov byte  [edi+15], 0x0E
        mov byte  [edi+16], 0xF4        ; HLT → #GP → gp_stop

        ; Entrar em v86
        push 0          ; GS
        push 0          ; FS
        push 0          ; DS
        push 0x0000     ; ES
        push 0x9000     ; SS
        push 0xFFF0     ; ESP
        pushfd
        or  dword [esp], 0x20000  ; VM=1
        push 0x1000     ; CS
        push 0          ; IP
        iret

gp_stop:
        pop  eax        ; descarta código de erro
        cli
        hlt
```

:::atencao HLT e CLI no v86 causam #GP
No modo v86 com IOPL<3, instruções como `HLT`, `CLI`, `STI`, `INT n`, `IRET` e `IN`/`OUT` geram **#GP** (vetor 13). O monitor v86 decide o que fazer: emular a instrução, terminar o processo ou retornar com IRET. Isso é a base do monitor v86 da próxima aula.
:::

:::cpu IOPL e o modo v86
Se o kernel configurar IOPL=3 no EFLAGS do frame v86 (bits 13:12 = 3), então `CLI`, `STI`, `IN` e `OUT` **não** geram #GP — o código v86 tem acesso real ao hardware. Isso é usado quando se confia no código v86 ou quando o monitor não precisa interceptar E/S.
:::

```quiz
? Como o 386 calcula o endereço físico no modo v86 para um acesso com CS=0x1000 e IP=0x100?
+ CS * 16 + IP = 0x1000 * 16 + 0x100 = 0x10100 — igual ao modo real
- CS selecionado pela GDT como no modo protegido
- CS * 16 + IP com o base do GDT adicionado por cima
- CS direto como endereço base sem multiplicação

? Por que instruções como INT n e IRET geram #GP no modo v86 (com IOPL=0)?
+ São instruções sensíveis que precisam ser interceptadas pelo monitor v86; com IOPL<3 e VM=1, elas causam #GP
- Porque a IDT não existe no modo v86
- Porque INT n e IRET não existem no modo v86
- Porque o CPL é 0 no v86 e o monitor precisa elevá-lo

? Qual bit deve ser setado no EFLAGS para entrar no modo v86 via IRET?
+ Bit 17 = VM (Virtual Mode); o restante do frame deve incluir GS, FS, DS, ES, SS e ESP extras
- Bit 31 = PG
- Bit 0 = PE
- Bit 9 = IF
```

## Exercícios

```exercicio
id: a77-1
titulo: Entrar no v86 e escrever na memória de vídeo
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Copie o seguinte código (bytes) para `0x10000`: `B8 00 B8 8E D8 C6 06 00 00 56 C6 06 01 00 0F F4` (mov ax, 0B800h / mov ds, ax / mov byte [0], 'V' / mov byte [1], 0Fh / hlt). Entre no modo v86 com CS=0x1000, IP=0, SS=0x9000, SP=0xFFF0. No handler de #GP (`gp_stop`): recarregue DS=0x10 (o modo v86 deixa DS inválido para PM32), descarte o código de erro, copie `byte [0xB8000]` para `char_vga` e `byte [0xB8001]` para `attr_vga`, e pare. O teste verifica `char_vga = 86` ('V') e `attr_vga = 15` (0x0F).
--- inicial
        bits 32
        org 100000h

        ; copiar código v86 para 0x10000
        ; bytes: B8 00 B8 8E D8 C6 06 00 00 56 C6 06 01 00 0F F4
        mov edi, 0x10000
        ; use mov byte para escrever os bytes

        ; instalar handler #GP no vetor 13 (IDT offset 0x868)
        mov dword [0x868], (0x08 << 16) | (gp_stop & 0xFFFF)
        mov dword [0x86C], (gp_stop & 0xFFFF0000) | 0x8E00

        ; IRET frame para v86 (VM=1)
        push 0          ; GS
        push 0          ; FS
        push 0          ; DS
        push 0          ; ES
        push 0x9000     ; SS
        push 0xFFF0     ; ESP
        pushfd
        or  dword [esp], 0x20000  ; setar VM=1 (bit 17)
        push 0x1000     ; CS
        push 0          ; IP
        iret

gp_stop:
        push eax
        mov  ax, 0x10           ; recarregar DS (v86 deixa DS inválido)
        mov  ds, ax
        pop  eax
        pop  eax                ; descarta código de erro
        movzx eax, byte [0xB8000]
        mov [char_vga], eax
        movzx eax, byte [0xB8001]
        mov [attr_vga], eax
        cli
        hlt

char_vga: dd 0
attr_vga: dd 0
--- testes
[
  { "nome": "v86 escreveu 'V' em char_vga", "espera": { "mem": { "char_vga": 86 } } },
  { "nome": "atributo 0x0F em attr_vga", "espera": { "mem": { "attr_vga": 15 } } }
]
--- dicas
Para copiar: mov byte [0x10000], 0xB8 / [0x10001]=0x00 / [0x10002]=0xB8 / [0x10003]=0x8E / [0x10004]=0xD8 / etc. (16 bytes no total).
VM=1: or dword [esp], 0x20000 (após pushfd).
gp_stop: push eax / mov ax,10h / mov ds,ax / pop eax / pop eax / movzx eax,byte[0xB8000] / mov[char_vga],eax / movzx eax,byte[0xB8001] / mov[attr_vga],eax / cli / hlt.
--- solucao
        bits 32
        org 100000h

        ; TSS para que a CPU encontre a pilha do anel 0 ao #GP do v86
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

        ; #GP handler (vetor 13)
        mov dword [0x868], (0x08 << 16) | (gp_stop & 0xFFFF)
        mov dword [0x86C], (gp_stop & 0xFFFF0000) | 0x8E00

        mov edi, 0x10000
        ; mov ax, 0B800h = B8 00 B8
        mov byte [edi+0],  0xB8
        mov byte [edi+1],  0x00
        mov byte [edi+2],  0xB8
        ; mov ds, ax = 8E D8
        mov byte [edi+3],  0x8E
        mov byte [edi+4],  0xD8
        ; mov byte [0], 'V' = C6 06 00 00 56
        mov byte [edi+5],  0xC6
        mov byte [edi+6],  0x06
        mov byte [edi+7],  0x00
        mov byte [edi+8],  0x00
        mov byte [edi+9],  0x56   ; 'V'
        ; mov byte [1], 0Fh = C6 06 01 00 0F
        mov byte [edi+10], 0xC6
        mov byte [edi+11], 0x06
        mov byte [edi+12], 0x01
        mov byte [edi+13], 0x00
        mov byte [edi+14], 0x0F
        ; HLT = F4
        mov byte [edi+15], 0xF4

        push 0
        push 0
        push 0
        push 0
        push 0x9000
        push 0xFFF0
        pushfd
        or  dword [esp], 0x20000
        push 0x1000
        push 0
        iret

gp_stop:
        push eax
        mov  ax, 0x10
        mov  ds, ax
        pop  eax
        pop  eax
        movzx eax, byte [0xB8000]
        mov [char_vga], eax
        movzx eax, byte [0xB8001]
        mov [attr_vga], eax
        cli
        hlt

char_vga: dd 0
attr_vga: dd 0
```

```exercicio
id: a77-2
titulo: v86 faz cálculo e salva em memória compartilhada
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Copie para `0x10000` o seguinte código 16-bit (bytes): `B8 22 00 BB 11 00 01 D8 A3 00 20 F4` que equivale a `mov ax, 0x22 / mov bx, 0x11 / add ax, bx / mov [0x2000], ax / hlt`. O código v86 escreverá `0x33` no endereço físico `0x2000` (DS=0, base=0). Entre no v86 com CS=0x1000, IP=0, DS=0, SS=0x9000. No handler de #GP (`gp_stop`): recarregue DS=0x10, descarte o código de erro, copie `word [0x2000]` para `resultado`, e pare. O teste verifica `resultado = 0x33`.
--- inicial
        bits 32
        org 100000h

        ; copiar bytes para 0x10000
        ; B8 22 00 BB 11 00 01 D8 A3 00 20 F4

        ; instalar handler #GP no vetor 13
        mov dword [0x868], (0x08 << 16) | (gp_stop & 0xFFFF)
        mov dword [0x86C], (gp_stop & 0xFFFF0000) | 0x8E00

        ; IRET para v86
        push 0          ; GS
        push 0          ; FS
        push 0          ; DS (segmento 0; físico base=0)
        push 0          ; ES
        push 0x9000     ; SS
        push 0xFFF0     ; ESP
        pushfd
        or  dword [esp], 0x20000  ; VM=1
        push 0x1000
        push 0
        iret

gp_stop:
        push eax
        mov  ax, 0x10           ; recarregar DS
        mov  ds, ax
        pop  eax
        pop  eax                ; descarta código de erro
        movzx eax, word [0x2000]
        mov [resultado], eax
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "[0x2000] = 0x33", "espera": { "mem": { "resultado": 51 } } }]
--- dicas
Setar VM=1: or dword [esp], 0x20000 após pushfd.
Os bytes: B8 22 00 / BB 11 00 / 01 D8 / A3 00 20 / F4.
gp_stop: push eax / mov ax,10h / mov ds,ax / pop eax / pop eax / movzx eax,word[0x2000] / mov[resultado],eax / cli / hlt.
--- solucao
        bits 32
        org 100000h

        ; TSS para que a CPU encontre a pilha do anel 0 ao #GP do v86
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

        ; #GP handler
        mov dword [0x868], (0x08 << 16) | (gp_stop & 0xFFFF)
        mov dword [0x86C], (gp_stop & 0xFFFF0000) | 0x8E00

        mov edi, 0x10000
        mov byte [edi+0],  0xB8  ; mov ax, 0x22
        mov byte [edi+1],  0x22
        mov byte [edi+2],  0x00
        mov byte [edi+3],  0xBB  ; mov bx, 0x11
        mov byte [edi+4],  0x11
        mov byte [edi+5],  0x00
        mov byte [edi+6],  0x01  ; add ax, bx
        mov byte [edi+7],  0xD8
        mov byte [edi+8],  0xA3  ; mov [0x2000], ax
        mov byte [edi+9],  0x00
        mov byte [edi+10], 0x20
        mov byte [edi+11], 0xF4  ; hlt

        push 0
        push 0
        push 0
        push 0
        push 0x9000
        push 0xFFF0
        pushfd
        or  dword [esp], 0x20000
        push 0x1000
        push 0
        iret

gp_stop:
        push eax
        mov  ax, 0x10
        mov  ds, ax
        pop  eax
        pop  eax
        movzx eax, word [0x2000]
        mov [resultado], eax
        cli
        hlt

resultado: dd 0
```

:::resumo
- O modo virtual 8086 é habilitado pelo bit 17 (VM) do EFLAGS; o código v86 usa endereçamento real-mode (CS*16 + IP).
- Para entrar no v86, o kernel faz IRET com VM=1 no EFLAGS e inclui GS, FS, DS, ES, SS e ESP extras no frame.
- O CPL efetivo em v86 é 3; instruções sensíveis (INT, IRET, CLI, STI, IN, OUT, HLT) com IOPL<3 geram #GP.
- O #GP é a ponte entre o código v86 e o monitor do kernel, que decide como emular cada instrução.
- Memória em v86 é física (endereço = segment*16 + offset) e pode ser lida/escrita também pelo modo protegido.
:::
