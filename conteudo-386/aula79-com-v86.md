---
id: aula79
numero: 79
modulo: 24
titulo: Rodando um .COM em v86
subtitulo: Carregar um programa DOS no segmento v86 e emular INT 21h para saída de texto
duracao: 65 min
objetivos: entender o formato .COM do DOS; carregar o binário em CS=0x1000 (offset 0x100); implementar um monitor que emula INT 21h AH=9 (imprimir string) e AH=4Ch (encerrar); verificar que a string foi copiada para a área de resultados
---

## Formato .COM

Um arquivo `.COM` do DOS é o formato mais simples de executável:

- É um **binário plano**: começa diretamente com código, sem cabeçalho.
- O DOS carrega o arquivo em `CS:0x0100` (IP começa em 0x100).
- O segmento `CS = DS = ES = SS` apontam para o mesmo segmento, 0x100 bytes abaixo do início do código (o **PSP** — Program Segment Prefix).
- O espaço do programa vai de offset `0x0100` até `0xFFFF` dentro do segmento.

Para executar um `.COM` em v86, o kernel precisa:

1. Escolher um segmento de memória (ex.: CS = `0x1000`, base física = `0x10000`).
2. Copiar o binário para a base física + 0x100 (ex.: para `0x10100`).
3. Entrar no v86 com CS = DS = ES = SS = `0x1000` e IP = `0x100`.

```diagrama titulo="Layout de memória para executar um .COM em v86"
Endereço físico:
  0x10000 — PSP (256 bytes, zeramos)
  0x10100 — código do .COM começa aqui (CS=0x1000, IP=0x100)
  0x1FFFF — final do segmento (limite 64 KB)
  0x1FF00 — pilha (SS=0x1000, SP=0xFF00)
```

## INT 21h: as duas funções essenciais

Para uma demonstração funcional do monitor, precisamos emular duas funções do DOS:

| AH | Função | Descrição |
|----|--------|-----------|
| 09h | Print string | DS:DX aponta para string terminada em `$` |
| 4Ch | Terminate | AL = código de saída; encerra o processo |

```nasm fragmento titulo="Emular AH=09h no monitor v86"
.int21_ah09:
        ; DS_v86 em [esp+28] (depois de pop do erro), DX em DX
        ; endereço físico da string: DS_v86 * 16 + DX
        movzx esi, word [esp+24]   ; DS do v86 (campo DS no frame)
        shl   esi, 4
        movzx ecx, dx
        add   esi, ecx             ; esi = endereço físico da string

        mov   edi, resultado       ; destino: área de resultado
.copia:
        mov   al, [esi]
        cmp   al, '$'
        je    .fim_string
        mov   [edi], al
        inc   esi
        inc   edi
        jmp   .copia
.fim_string:
        iret
```

:::cpu DS do v86 no frame de #GP
No frame de #GP do v86, o campo DS fica em `[esp+28]` (após o pop do código de erro): `[esp+0]=erro`, `[esp+4]=EIP`, `[esp+8]=CS`, `[esp+12]=EFLAGS`, `[esp+16]=ESP`, `[esp+20]=SS`, `[esp+24]=ES`, `[esp+28]=DS`. O monitor acessa esse campo para calcular endereços de dados do v86.
:::

## Exemplo completo: executar um .COM mínimo

```nasm executar modo="pm32" titulo="COMV86.BIN: rodar um .COM no modo v86"
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

        ; Zerar PSP (bytes 0x10000 a 0x100FF)
        mov edi, 0x10000
        mov ecx, 0x100 / 4
        xor eax, eax
        rep stosd

        ; Copiar o .COM para 0x10100
        ; Programa .COM (16-bit, offset 0x100):
        ;   mov ah, 09h
        ;   mov dx, msg   (offset da string)
        ;   int 21h
        ;   mov ah, 4Ch
        ;   mov al, 0
        ;   int 21h
        ;   msg db 'OI$'
        ;
        ; Bytes: B4 09 / BA 0C 01 / CD 21 / B4 4C / B0 00 / CD 21 / 4F 49 24
        ; (msg está em offset 0x100 + 12 = 0x10C dentro do segmento)
        mov edi, 0x10100
        mov byte [edi+0],  0xB4   ; mov ah, 09h
        mov byte [edi+1],  0x09
        mov byte [edi+2],  0xBA   ; mov dx, 0x010C
        mov byte [edi+3],  0x0C
        mov byte [edi+4],  0x01
        mov byte [edi+5],  0xCD   ; int 21h
        mov byte [edi+6],  0x21
        mov byte [edi+7],  0xB4   ; mov ah, 4Ch
        mov byte [edi+8],  0x4C
        mov byte [edi+9],  0xB0   ; mov al, 0
        mov byte [edi+10], 0x00
        mov byte [edi+11], 0xCD   ; int 21h
        mov byte [edi+12], 0x21
        mov byte [edi+13], 'O'    ; msg: 'OI$'
        mov byte [edi+14], 'I'
        mov byte [edi+15], '$'

        ; Instalar handler de #GP (vetor 13) → IDT[13] = 0x868
        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

        ; Entrar no v86: CS=DS=ES=SS=0x1000, IP=0x100, SP=0xFF00
        push 0x1000     ; GS
        push 0x1000     ; FS
        push 0x1000     ; DS
        push 0x1000     ; ES
        push 0x1000     ; SS
        push 0xFF00     ; ESP
        pushfd
        or  dword [esp], 0x20000  ; VM=1
        push 0x1000     ; CS
        push 0x100      ; IP = 0x100 (início do .COM)
        iret

gp_handler:
        push eax                        ; recarregar DS (v86 deixa DS inválido)
        mov  ax, 0x10
        mov  ds, ax
        pop  eax
        pop  ebx                        ; código de erro
        test dword [esp+8], 0x20000     ; VM=1?
        jz   .para

        movzx ecx, word [esp]           ; EIP
        movzx edi, word [esp+4]         ; CS
        shl   edi, 4
        add   edi, ecx                  ; endereço físico da instrução

        movzx ebx, byte [edi]
        cmp   bl, 0xCD
        jne   .para

        movzx ebx, byte [edi+1]         ; número do INT
        add  dword [esp], 2             ; avança IP

        cmp  bl, 0x21
        jne  .ignora

        ; Despachar INT 21h por AH
        movzx ecx, ah
        cmp   cl, 0x09
        je    .ah09
        cmp   cl, 0x4C
        je    .ah4c
        jmp   .ignora

.ah09:
        ; Imprimir string em DS:DX
        movzx esi, word [esp+24]        ; DS do v86 no frame
        shl   esi, 4
        movzx ecx, dx
        add   esi, ecx                  ; endereço físico de DS:DX

        mov   edi, resultado
.copia:
        mov   al, [esi]
        cmp   al, '$'
        je    .fim_str
        mov   [edi], al
        inc   esi
        inc   edi
        jmp   .copia
.fim_str:
        iret

.ah4c:
        ; Terminate: programa terminou normalmente
        mov  dword [saiu], 1
        cli
        hlt

.ignora:
        iret

.para:
        cli
        hlt

resultado: times 16 db 0
saiu:     dd 0
```

```quiz
? Qual é o offset de início de código de um arquivo .COM quando carregado pelo DOS (ou por um monitor v86)?
+ 0x0100 — o .COM é carregado após o PSP de 256 bytes; IP começa em 0x100
- 0x0000 — o código começa no início do segmento
- 0x0200 — dois PSPs são reservados
- Depende do tamanho do arquivo

? Para emular INT 21h AH=09h (imprimir string), o monitor precisa acessar DS:DX do v86. Como obtém o valor de DS do v86?
+ Do frame de #GP empilhado pelo hardware, campo DS em [esp+28] (após pop do código de erro)
- De um registrador salvo pelo PUSHAD antes do handler
- De um campo na TSS atual
- Lendo o registrador DS diretamente, pois DS não muda ao entrar no handler

? No modo v86 com CS=0x1000 e IP=0x0100, qual é o endereço físico onde o código .COM começa?
+ 0x10100 — CS * 16 + IP = 0x1000 * 16 + 0x100 = 0x10000 + 0x100
- 0x01000 — CS + IP sem multiplicação
- 0x10000 — confunde com a base do segmento (seria IP=0)
- 0x10010 — confunde com CS * 1 + IP
```

## Exercícios

```exercicio
id: a79-1
titulo: Executar .COM que chama INT 21h AH=9
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte um programa `.COM` em `0x10100` (CS=0x1000, IP=0x100): bytes `B4 09 BA 0D 01 CD 21 B4 4C B0 00 CD 21 48 49 24` (equivale a `mov ah,9 / mov dx,0x10D / int 21h / mov ah,4Ch / mov al,0 / int 21h` seguido da string `HI$` nos três últimos bytes, no offset 0x10D). Instale handler de #GP (vetor 13). Entre no v86 com CS=DS=ES=SS=0x1000, IP=0x100, SP=0xFF00. O handler emula INT 21h AH=9: copia bytes de DS_v86*16+DX até o `$` para `resultado`. AH=4Ch: CLI/HLT. Verifique que `resultado` contém `HI` (bytes 72 e 73).
--- inicial
        bits 32
        org 100000h

        ; Zerar PSP em 0x10000 (256 bytes)
        ; Copiar bytes do .COM para 0x10100:
        ; B4 09 BA 0D 01 CD 21 B4 4C B0 00 CD 21 48 49 24

        ; Instalar #GP handler (vetor 13)

        ; Entrar no v86 com CS=DS=ES=SS=0x1000, IP=100h, SP=FF00h

gp_handler:
        ; descarte erro; verifique VM; calc endereço; verifique CD
        ; INT 21h: AH=9 copia string, AH=4Ch para
        iret

resultado: times 4 db 0
--- testes
[
  { "nome": "resultado contém 'HI'", "espera": { "mem": { "resultado": [72, 73] } } }
]
--- dicas
A string fica nos três últimos bytes do .COM, no offset 0x10D; mov dx, 0x10D (bytes BA 0D 01).
DS v86 no frame: [esp+24] após pop do erro.
Endereço físico da string: DS_v86*16 + DX = 0x1000*16 + 0x10D = 0x1010D.
AH=4Ch: apenas para (cli/hlt).
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
        mov ecx, 0x100 / 4
        xor eax, eax
        rep stosd

        mov edi, 0x10100
        mov byte [edi+0],  0xB4
        mov byte [edi+1],  0x09
        mov byte [edi+2],  0xBA
        mov byte [edi+3],  0x0D
        mov byte [edi+4],  0x01
        mov byte [edi+5],  0xCD
        mov byte [edi+6],  0x21
        mov byte [edi+7],  0xB4
        mov byte [edi+8],  0x4C
        mov byte [edi+9],  0xB0
        mov byte [edi+10], 0x00
        mov byte [edi+11], 0xCD
        mov byte [edi+12], 0x21
        mov byte [edi+13], 'H'
        mov byte [edi+14], 'I'
        mov byte [edi+15], '$'

        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

        push 0x1000
        push 0x1000
        push 0x1000
        push 0x1000
        push 0x1000
        push 0xFF00
        pushfd
        or  dword [esp], 0x20000
        push 0x1000
        push 0x100
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

        movzx ebx, byte [edi+1]
        add  dword [esp], 2

        cmp  bl, 0x21
        jne  .ignora

        movzx ecx, ah
        cmp   cl, 0x09
        je    .ah09
        cmp   cl, 0x4C
        je    .ah4c
        jmp   .ignora

.ah09:
        movzx esi, word [esp+24]
        shl   esi, 4
        movzx ecx, dx
        add   esi, ecx
        mov   edi, resultado
.copia:
        mov   al, [esi]
        cmp   al, '$'
        je    .fim
        mov   [edi], al
        inc   esi
        inc   edi
        jmp   .copia
.fim:
        iret

.ah4c:
        cli
        hlt

.ignora:
        iret

.para:
        cli
        hlt

resultado: times 4 db 0
```

```exercicio
id: a79-2
titulo: .COM que chama INT 21h duas vezes e acumula
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte em `0x10100` o .COM: `B4 01 B2 0A CD 21 B4 01 B2 14 CD 21 B4 4C B0 00 CD 21` (= `mov ah,1 / mov dl,10 / int 21h / mov ah,1 / mov dl,20 / int 21h / exit`). O monitor emula INT 21h AH=1: adiciona DL ao valor em `soma`. Após as duas chamadas, `soma` deve conter 30 (10+20). AH=4Ch para. Verifique que `soma=30`.
--- inicial
        bits 32
        org 100000h

        ; Zerar PSP em 0x10000
        ; Copiar bytes do .COM para 0x10100:
        ; B4 01 B2 0A CD 21 B4 01 B2 14 CD 21 B4 4C B0 00 CD 21

        ; Instalar #GP handler (vetor 13)

        ; Entrar no v86 com CS=DS=ES=SS=0x1000, IP=100h, SP=FF00h

gp_handler:
        ; INT 21h AH=1: soma += DL; AH=4Ch: para
        iret

soma: dd 0
--- testes
[{ "nome": "soma = 30", "espera": { "mem": { "soma": 30 } } }]
--- dicas
AH=1 (bits 15:8 de EAX); DL = byte baixo de EDX.
soma += DL: movzx ecx, dl / add [soma], ecx.
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
        mov ecx, 0x100 / 4
        xor eax, eax
        rep stosd

        mov edi, 0x10100
        mov byte [edi+0],  0xB4   ; mov ah, 1
        mov byte [edi+1],  0x01
        mov byte [edi+2],  0xB2   ; mov dl, 10
        mov byte [edi+3],  0x0A
        mov byte [edi+4],  0xCD   ; int 21h
        mov byte [edi+5],  0x21
        mov byte [edi+6],  0xB4   ; mov ah, 1
        mov byte [edi+7],  0x01
        mov byte [edi+8],  0xB2   ; mov dl, 20
        mov byte [edi+9],  0x14
        mov byte [edi+10], 0xCD   ; int 21h
        mov byte [edi+11], 0x21
        mov byte [edi+12], 0xB4   ; mov ah, 4Ch
        mov byte [edi+13], 0x4C
        mov byte [edi+14], 0xB0   ; mov al, 0
        mov byte [edi+15], 0x00
        mov byte [edi+16], 0xCD   ; int 21h
        mov byte [edi+17], 0x21

        mov dword [0x868], (0x08 << 16) | (gp_handler & 0xFFFF)
        mov dword [0x86C], (gp_handler & 0xFFFF0000) | 0x8E00

        push 0x1000
        push 0x1000
        push 0x1000
        push 0x1000
        push 0x1000
        push 0xFF00
        pushfd
        or  dword [esp], 0x20000
        push 0x1000
        push 0x100
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

        movzx ebx, byte [edi+1]
        add  dword [esp], 2

        cmp  bl, 0x21
        jne  .ignora

        movzx ecx, ah
        cmp   cl, 0x01
        je    .ah01
        cmp   cl, 0x4C
        je    .ah4c
        jmp   .ignora

.ah01:
        movzx ecx, dl
        add  [soma], ecx
        iret

.ah4c:
        cli
        hlt

.ignora:
        iret

.para:
        cli
        hlt

soma: dd 0
```

:::resumo
- Um `.COM` do DOS é um binário plano carregado em `CS:0x100`; no v86, escolhemos CS = segmento base e copiamos o binário para `base_física + 0x100`.
- O monitor v86 emula as chamadas INT 21h do DOS: **AH=09h** imprime uma string terminada em `$` cujo endereço físico é `DS_v86 * 16 + DX`; **AH=4Ch** encerra o processo.
- O campo DS no frame de #GP do v86 está em `[esp+28]` (após pop do código de erro); os registradores gerais (AH, DL) ainda contêm os valores do código v86.
- O monitor avança EIP em 2 antes de IRET para que o .COM continue na instrução seguinte ao INT.
- Com um monitor mais completo, é possível executar programas DOS reais em ambiente protegido — é exatamente o que o DOSBox e o NTVDM do Windows faziam.
:::
