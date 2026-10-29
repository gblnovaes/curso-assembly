---
id: aula78
numero: 78
modulo: 24
titulo: Monitor v86
subtitulo: Interceptar INT n do modo v86 com o handler de #GP e emular chamadas DOS
duracao: 70 min
objetivos: entender como o #GP captura instruções sensíveis do v86; ler CS*16+EIP para identificar o INT n emitido; avançar IP em 2 bytes para pular o INT e fazer IRET de volta ao v86; implementar um despachante de INT 21h básico
---

## O que é o monitor v86?

Quando código v86 executa `INT 21h` (ou qualquer instrução sensível) com IOPL < 3, a CPU gera **#GP** (vetor 13). O **monitor v86** é a parte do kernel que trata esse #GP, descobre qual instrução causou o fault, emula seu efeito, avança o IP e retorna ao v86 com IRET.

```diagrama titulo="Fluxo do monitor v86"
Código v86 executa INT 21h
  → #GP (vetor 13) → handler do kernel
    → identifica instrução em CS*16 + EIP
    → determina: é INT n? (opcode CD nn)
    → lê o número n do byte seguinte
    → emula a função (ex: escreve resultado)
    → avança IP em 2 (pula CD nn)
    → IRET → v86 continua na instrução seguinte
```

## O frame de #GP vindo do v86

Quando um #GP ocorre **dentro do modo v86**, a pilha do kernel recebe um frame maior do que o normal, incluindo os registradores de segmento do v86:

```diagrama titulo="Pilha do kernel após #GP do v86 (IOPL < 3)"
[esp+0]  = código de erro (0 para INT n)
[esp+4]  = EIP  (offset no segmento v86 onde ocorreu o fault)
[esp+8]  = CS   (seletor do segmento v86 — valor como no real mode)
[esp+12] = EFLAGS (VM=1, indica que veio do v86)
[esp+16] = ESP  (pilha v86)
[esp+20] = SS   (segmento de pilha v86)
[esp+24] = ES
[esp+28] = DS
[esp+32] = FS
[esp+36] = GS
```

Os registradores gerais (EAX, EBX, …) ainda têm os valores do código v86 no momento do fault — não foram alterados pela entrada no handler.

## Identificando o INT n

Quando a instrução faultante é `INT n` (opcode `CD nn`), o byte em `CS*16 + EIP` vale `0xCD` e o byte em `CS*16 + EIP + 1` é o número da interrupção `n`.

```nasm fragmento titulo="Identificar e despachar INT n no monitor v86"
gp_handler:
        pop  eax                ; descarta código de erro
        ; verificar: VM=1 no EFLAGS empilhado?
        test dword [esp+8], 0x20000   ; bit 17 = VM
        jz   .nao_e_v86
        ; ler o byte na instrução faultante
        movzx ecx, word [esp]          ; IP da instrução (offset)
        movzx edx, word [esp+4]       ; CS do código v86 (palavra baixa)
        shl   edx, 4                   ; CS * 16 = base física
        add   edx, ecx                 ; + IP = endereço físico da instrução
        movzx eax, byte [edx]          ; opcode
        cmp   al, 0xCD                 ; é INT n?
        jne   .outra_instrucao
        movzx eax, byte [edx+1]        ; número do INT (n)
        add  dword [esp], 2            ; avança IP em 2 (pula CD nn)
        ; despachar por número de INT...
        ; ...
        iret                           ; retorna ao v86 (frame incluindo GS..SS)
.nao_e_v86:
        cli
        hlt
.outra_instrucao:
        cli
        hlt
```

:::cpu Endereçamento físico do IP no monitor
O EIP empilhado no frame de #GP é o **offset** da instrução dentro do segmento v86. O CS empilhado é o valor inteiro do registrador de segmento v86 (não um seletor GDT). Portanto o endereço físico da instrução faultante é `CS_v86 * 16 + EIP_v86`, calculado pelo handler com deslocamento de 4 bits.
:::

## Exemplo completo: monitor para INT 21h

```nasm executar modo="pm32" titulo="MONITOR.BIN: monitor v86 com INT 21h básico"
        bits 32
        org 100000h

        ; TSS mínima para que a CPU encontre a pilha do anel 0 ao #GP do v86
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

        ; Copiar código v86 para 0x10000
        ; Programa: mov eax, 0x1234 / int 21h / hlt
        ; bytes: B8 34 12 00 00 / CD 21 / F4
        mov edi, 0x10000
        mov byte [edi+0],  0xB8   ; mov eax, 0x1234
        mov byte [edi+1],  0x34
        mov byte [edi+2],  0x12
        mov byte [edi+3],  0x00
        mov byte [edi+4],  0x00
        mov byte [edi+5],  0xCD   ; int 21h
        mov byte [edi+6],  0x21
        mov byte [edi+7],  0xF4   ; hlt

        ; Instalar handler de #GP (vetor 13) → IDT[13] = 0x800 + 13*8 = 0x868
        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

        ; Entrar no modo v86: frame IRET com VM=1
        push 0          ; GS
        push 0          ; FS
        push 0          ; DS
        push 0          ; ES
        push 0x9000     ; SS
        push 0xFFF0     ; ESP
        pushfd
        or  dword [esp], 0x20000  ; VM=1
        push 0x1000     ; CS (código em CS*16=0x10000)
        push 0          ; EIP = 0
        iret

gp_handler:
        push eax                        ; recarregar DS (v86 deixa DS inválido)
        mov  ax, 0x10
        mov  ds, ax
        pop  eax
        pop  eax                        ; descarta código de erro
        test dword [esp+8], 0x20000     ; EFLAGS.VM?
        jz   .para                      ; não é v86 → parar

        movzx ecx, word [esp]           ; EIP (offset)
        movzx edx, word [esp+4]         ; CS
        shl   edx, 4
        add   edx, ecx                  ; endereço físico da instrução

        movzx eax, byte [edx]
        cmp   al, 0xCD
        jne   .hlt_sensivel

        movzx eax, byte [edx+1]         ; número do INT
        add  dword [esp], 2             ; avança IP sobre CD nn

        cmp  al, 0x21
        je   .int21

.desconhecido:
        ; INT desconhecido: ignorar e voltar ao v86
        iret

.int21:
        ; Pegar EAX do v86 (ainda intacto nos registradores)
        ; na entrada do handler os regs gerais são os do v86
        mov  [resultado], eax           ; salvar EAX do código v86
        ; parar (hlt também gera #GP; desta vez é um HLT)
        iret

.hlt_sensivel:
        ; HLT, CLI, STI etc. → parar o monitor
        mov  dword [resultado], 0xDEAD
        cli
        hlt

.para:
        cli
        hlt

resultado: dd 0
```

:::atencao EAX no handler é o EAX do v86
Ao entrar no handler de #GP, os registradores gerais (EAX, EBX, ECX, EDX…) ainda contêm os valores que o código v86 tinha no momento da falta. O monitor pode lê-los diretamente para descobrir os argumentos da instrução emulada.
:::

:::cpu O IRET do monitor devolve ao v86
Depois de emular a instrução, o monitor executa `IRET`. Como o frame ainda tem EFLAGS.VM=1 (mais os registradores de segmento v86 empilhados), a CPU retorna ao modo v86 com CS:IP na instrução seguinte ao INT. O handler **não** precisa tratar o frame de forma especial — apenas corrigir EIP (+2) e fazer IRET.
:::

```quiz
? Após um INT n no modo v86 causar #GP, como o monitor calcula o endereço físico da instrução faultante?
+ CS_v86 * 16 + EIP_v86, lendo CS e EIP diretamente do frame empilhado (posições [esp+8] e [esp+4] após pop do erro)
- Basta ler [esp+4] como endereço físico direto
- CS_v86 é um seletor da GDT; usa-se o campo base do descritor
- O endereço está em CR2, como em um page fault

? Qual campo do frame de #GP deve ser avançado em 2 para que o v86 retome na instrução seguinte ao INT n?
+ [esp+4] = EIP do v86; INT n tem 2 bytes (CD nn), então add dword [esp+4], 2
- [esp+16] = ESP do v86
- O monitor modifica CR2 para pular a instrução
- O EIP é avançado automaticamente pela CPU antes de entrar no handler

? Por que o monitor verifica EFLAGS.VM no frame de #GP antes de tentar emular?
+ Nem todo #GP vem do v86; se VM=0 o fault é de código protegido e a emulação de INT n seria incorreta
- Para saber se o código v86 usa segmentos de 16 ou 32 bits
- Porque EFLAGS.VM=0 indica que o modo paginado está ativo
- O bit VM é necessário para calcular o endereço físico via CS*16
```

## Exercícios

```exercicio
id: a78-1
titulo: Monitor captura INT 21h e salva EAX
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Copie para `0x10000` o programa v86 (bytes): `B8 78 56 00 00 CD 21 F4` (`mov eax, 0x5678 / int 21h / hlt`). Instale um handler para o vetor 13 (#GP, tipo 0x8E). Entre no modo v86 com CS=0x1000, IP=0, SS=0x9000, SP=0xFFF0. O handler deve: descartar o código de erro; verificar que EFLAGS.VM=1 no frame; calcular o endereço físico `CS*16 + EIP`; verificar que o opcode é `0xCD`; avançar `[esp+4]` em 2; salvar o valor atual de EAX em `resultado`; fazer IRET. O HLT subsequente gera outro #GP; dessa vez o opcode não é `0xCD`, então o handler pode parar com `cli/hlt`. O teste verifica que `resultado = 0x5678`.
--- inicial
        bits 32
        org 100000h

        ; copiar bytes do programa v86 para 0x10000
        ; B8 78 56 00 00 CD 21 F4

        ; instalar #GP handler (vetor 13, IDT[13] = 0x868)

        ; entrar no modo v86 (IRET com VM=1)
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

gp_handler:
        ; descarte código de erro
        ; verifique VM=1 em EFLAGS do frame
        ; calcule endereço físico da instrução
        ; se opcode = CDh: avance EIP+2, salve EAX em resultado, IRET
        ; senão: cli/hlt
        iret

resultado: dd 0
--- testes
[{ "nome": "resultado = 0x5678", "espera": { "mem": { "resultado": 22136 } } }]
--- dicas
Frame após pop do erro: [esp]=EIP, [esp+4]=CS (v86), [esp+8]=EFLAGS.
Endereço físico: movzx ecx, word [esp] / movzx edx, word [esp+4] / shl edx,4 / add edx,ecx.
Opcode: movzx eax, byte [edx]. Se al=CDh: add dword [esp], 2 / mov [resultado],eax_v86 / iret.
EAX v86 está nos registradores na entrada do handler.
Gate #GP: mov dword [868h], (8 shl 16)|(gp_handler and 0FFFFh) / mov dword [86Ch], (gp_handler and 0FFFF0000h) or 8E00h.
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

        mov edi, 0x10000
        mov byte [edi+0], 0xB8
        mov byte [edi+1], 0x78
        mov byte [edi+2], 0x56
        mov byte [edi+3], 0x00
        mov byte [edi+4], 0x00
        mov byte [edi+5], 0xCD
        mov byte [edi+6], 0x21
        mov byte [edi+7], 0xF4

        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

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

gp_handler:
        push eax
        mov  ax, 0x10
        mov  ds, ax
        pop  eax
        pop  ebx                        ; código de erro
        test dword [esp+8], 0x20000
        jz   .para

        movzx ecx, word [esp]
        movzx edx, word [esp+4]
        shl   edx, 4
        add   edx, ecx

        movzx ebx, byte [edx]
        cmp   bl, 0xCD
        jne   .para

        add  dword [esp], 2
        mov  [resultado], eax
        iret

.para:
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a78-2
titulo: Monitor despacha INT 21h funções AH=1 e AH=2
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Copie para `0x10000` o programa v86: `B4 01 CD 21 B4 02 B2 41 CD 21 F4` que é `mov ah, 1 / int 21h / mov ah, 2 / mov dl, 'A' / int 21h / hlt`. O monitor de #GP deve despachar INT 21h: se AH=1, escrever `1` em `func1_chamada`; se AH=2, escrever DL em `func2_char`. O teste verifica `func1_chamada=1` e `func2_char=65` (ASCII de 'A').
--- inicial
        bits 32
        org 100000h

        ; copiar bytes para 0x10000
        ; B4 01 CD 21 B4 02 B2 41 CD 21 F4

        ; instalar #GP handler (vetor 13)

        ; entrar no modo v86
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

gp_handler:
        ; descarte erro; verifique VM; calcule endereço; verifique CD
        ; avance EIP+2; despache por AH
        ; AH=1 → func1_chamada=1
        ; AH=2 → func2_char=DL
        ; outro → ignora; HLT → cli/hlt
        iret

func1_chamada: dd 0
func2_char:    dd 0
--- testes
[
  { "nome": "func1_chamada = 1", "espera": { "mem": { "func1_chamada": 1 } } },
  { "nome": "func2_char = 65 ('A')", "espera": { "mem": { "func2_char": 65 } } }
]
--- dicas
AH = byte alto de AX; para testá-lo: shr eax, 8 / and eax, 0xFF (ou movzx ecx, ah depois de salvar eax).
DL = byte baixo de EDX.
Código dos bytes: B4=mov ah,imm8 / CD=int / 21=número / B2=mov dl,imm8.
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

        mov edi, 0x10000
        mov byte [edi+0],  0xB4   ; mov ah, 1
        mov byte [edi+1],  0x01
        mov byte [edi+2],  0xCD   ; int 21h
        mov byte [edi+3],  0x21
        mov byte [edi+4],  0xB4   ; mov ah, 2
        mov byte [edi+5],  0x02
        mov byte [edi+6],  0xB2   ; mov dl, 'A'
        mov byte [edi+7],  0x41
        mov byte [edi+8],  0xCD   ; int 21h
        mov byte [edi+9],  0x21
        mov byte [edi+10], 0xF4   ; hlt

        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

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

gp_handler:
        push eax
        mov  ax, 0x10
        mov  ds, ax
        pop  eax
        pop  ebx
        test dword [esp+8], 0x20000
        jz   .para

        movzx ecx, word [esp]
        movzx edi, word [esp+4]
        shl   edi, 4
        add   edi, ecx

        movzx ebx, byte [edi]
        cmp   bl, 0xCD
        jne   .para

        add  dword [esp], 2

        ; despachar por AH (bits 15:8 de EAX)
        movzx ecx, ah
        cmp   cl, 1
        je    .func1
        cmp   cl, 2
        je    .func2
        iret

.func1:
        mov  dword [func1_chamada], 1
        iret

.func2:
        movzx ecx, dl
        mov   [func2_char], ecx
        iret

.para:
        cli
        hlt

func1_chamada: dd 0
func2_char:    dd 0
```

:::resumo
- O monitor v86 é o handler de **#GP** (vetor 13) do kernel; ele intercepta instruções sensíveis do v86.
- Quando a instrução é `INT n` (opcode `CD nn`), o monitor lê o opcode em `CS_v86 * 16 + EIP_v86`, extrai o número `n` do byte seguinte e **avança EIP em 2** antes de fazer IRET.
- O frame de #GP vindo do v86 inclui os registradores de segmento extras (GS, FS, DS, ES, SS, ESP); após avançar EIP, o handler faz IRET normalmente e a CPU retorna ao v86.
- Os registradores gerais (EAX, EBX…) no handler ainda têm os valores do código v86 — o monitor usa EAX/AH/DL etc. para descobrir qual função foi pedida.
- Um monitor v86 completo despacha INT 10h (BIOS vídeo), INT 21h (DOS) e outras interrupções, emulando o comportamento do hardware/DOS para cada chamada.
:::
