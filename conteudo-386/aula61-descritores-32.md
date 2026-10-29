---
id: aula61
numero: 61
modulo: 19
titulo: Descritores de 32 bits
subtitulo: Base de 4 GB, limite de 20 bits, granularidade e o bit D
duracao: 70 min
objetivos: ler e escrever um descritor de segmento do 386, campo por campo; entender a granularidade e por que um limite de 20 bits chega a 4 GB; saber o que o bit D/B muda num segmento de código e num de pilha; montar uma GDT plana com código e dados de 4 GB; decodificar um descritor com deslocamentos e máscaras
---

## O descritor cresceu

O 286 deixou dois bytes do descritor reservados, "para uso futuro". O 386 os usou. A base passou a ter 32 bits (4 GB de espaço), o limite ganhou 4 bits e um multiplicador, e apareceram bits novos. Para continuar compatível, os campos novos foram encaixados nos bytes livres, e por isso o descritor do 386 tem a base e o limite espalhados em pedaços:

```diagrama titulo="Descritor de segmento do 386 (8 bytes)"
byte 7          byte 6                 byte 5          bytes 4, 3, 2      bytes 1, 0
+-----------+--+--+--+---+--------+---+-----+--+----+------------------+---------------+
|base 31:24 |G |D |0 |AVL|lim 19:16| P | DPL |S |tipo|   base 23:0      |  limite 15:0  |
+-----------+--+--+--+---+--------+---+-----+--+----+------------------+---------------+
   novo      novos (eram 0 no 286)  |<- acesso, igual ao 286 ->|  igual ao 286     igual ao 286
```

- **base**: 32 bits, em três pedaços (bytes 2-4 e byte 7).
- **limite**: 20 bits, em dois pedaços (bytes 0-1 e a metade de baixo do byte 6).
- **G** (granularidade): com G = 0, o limite conta bytes (até 1 MB); com G = 1, conta páginas de 4 KB, e o limite efetivo é `limite × 4096 + 4095`. Com limite FFFFFh e G = 1, o segmento vai até **FFFFFFFFh**: 4 GB.
- **D/B**: num segmento de **código**, D = 1 quer dizer que o código é de 32 bits (tamanho padrão de operando e de endereço 32, sem prefixos); D = 0 é código de 16 bits, como no 286. Num segmento de **pilha**, B = 1 faz PUSH e POP usarem ESP em vez de SP.
- **AVL**: livre para o sistema operacional usar como quiser.
- O byte de acesso (P, DPL, S, tipo) é o mesmo do 286.

Um descritor do 286 é um descritor do 386 com os bytes 6 e 7 zerados: G = 0, D = 0, base abaixo de 16 MB. Por isso o código do 286 roda sem mudança no 386.

## Os descritores mais usados

Na prática, quase todo sistema de 32 bits usa só segmentos planos: base 0, limite 4 GB. Escritos como um `dq`, ficam assim:

| Descritor | Valor | Byte 6 | Byte 5 |
|---|---|---|---|
| código anel 0, 32 bits, 4 GB | `00CF9A000000FFFFh` | CFh: G=1, D=1, limite 19:16 = Fh | 9Ah |
| dados anel 0, 4 GB | `00CF92000000FFFFh` | CFh | 92h |
| código anel 3 | `00CFFA000000FFFFh` | CFh | FAh (DPL 3) |
| dados anel 3 | `00CFF2000000FFFFh` | CFh | F2h |
| código 16 bits, 64 KB | `00009A000000FFFFh` | 00h | 9Ah |

Lendo o primeiro da direita para a esquerda: `FFFF` é o limite 15:0, `000000` a base 23:0, `9A` o acesso, `CF` o byte 6 (`C` = G e D ligados, `F` = limite 19:16) e `00` a base 31:24.

Escrever descritores em hexadecimal é rápido, mas fácil de errar. Uma macro deixa a GDT legível. O NASM calcula os campos em tempo de montagem:

```nasm fragmento titulo="Uma macro para descritores"
; DESCRITOR base, limite (em bytes ou páginas), acesso, flags (G e D em 0Ch, 08h, 04h ou 00h)
%macro DESCRITOR 4
        dw (%2) & 0FFFFh                        ; limite 15:0
        dw (%1) & 0FFFFh                        ; base 15:0
        db ((%1) >> 16) & 0FFh                  ; base 23:16
        db %3                                   ; acesso
        db ((%4) << 4) | (((%2) >> 16) & 0Fh)   ; flags e limite 19:16
        db ((%1) >> 24) & 0FFh                  ; base 31:24
%endmacro

gdt:    dq 0
        DESCRITOR 0, 0FFFFFh, 9Ah, 0Ch          ; 08h: código 32 bits, 4 GB
        DESCRITOR 0, 0FFFFFh, 92h, 0Ch          ; 10h: dados, 4 GB
        DESCRITOR 0B8000h, 0F9Fh, 92h, 0        ; 18h: só a tela, 4000 bytes
```

```quiz
? Um descritor tem limite 0003Fh e G = 1. Qual é o último deslocamento válido?
- 0003Fh
- 3F000h
+ 3FFFFh
- 0003Fh × 4096
> Com G = 1 o limite conta páginas: 3Fh × 4096 + 4095 = 3FFFFh (256 KB menos 1).

? O que o bit D = 1 muda num segmento de código?
- O segmento passa a ser só de leitura
+ As instruções passam a usar 32 bits por padrão; o prefixo 66h passa a pedir 16
- O segmento passa a ter 4 GB
- Nada, é reservado
> D escolhe o tamanho padrão de operandos e endereços. É o que separa código de 16 e de 32 bits no modo protegido.

? Qual é a base do descritor 00CF92000000FFFFh?
+ 0
- FFFFh
- CF000000h
- 92000000h
> A base está nos bytes 2, 3, 4 (000000) e 7 (00). O FFFF é o limite e CF guarda G, D e o limite 19:16.
```

## Decodificando um descritor

Juntar os pedaços de volta é um bom exercício de deslocamentos e máscaras. Com o descritor em EDX:EAX (EAX = bytes 0-3, EDX = bytes 4-7):

- base = `(EAX >> 16) | ((EDX & 0FFh) << 16) | (EDX & 0FF000000h)`
- limite = `(EAX & 0FFFFh) | (EDX & 000F0000h)`, e se G (bit 23 de EDX) estiver ligado, `limite << 12 | 0FFFh`

O programa abaixo faz isso num .COM, sem modo protegido nenhum: um descritor é só um número de 64 bits.

```nasm executar titulo="DECODE.COM: base e limite de um descritor"
        org 100h
        mov eax, [desc]
        mov edx, [desc+4]
        ; base
        mov ebx, eax
        shr ebx, 16                     ; base 15:0
        mov ecx, edx
        and ecx, 0FFh
        shl ecx, 16
        or ebx, ecx                     ; base 23:16
        mov ecx, edx
        and ecx, 0FF000000h
        or ebx, ecx                     ; base 31:24
        mov [base], ebx
        ; limite
        mov ecx, eax
        and ecx, 0FFFFh
        mov esi, edx
        and esi, 0F0000h
        or ecx, esi
        bt edx, 23                      ; G?
        jnc .fim
        shl ecx, 12
        or ecx, 0FFFh
.fim:   mov [limite], ecx
        mov ax, 4C00h
        int 21h
desc:   dq 00C0920B80000003h            ; base 000B8000h, limite 3 páginas
base:   dd 0
limite: dd 0
```

Rode e confira no painel: EBX = 000B8000h e ECX = 00003FFFh.

## Exercícios

```exercicio
id: a61-1
titulo: Montar um descritor
nivel: 2
maquina: 386
modo: com
--- enunciado
Escreva em `desc` (8 bytes) o descritor de um segmento de **dados com escrita, presente, DPL 0**, com base **00123000h** e limite **0FFFFh bytes** (G = 0, B = 1). Escreva com `dw`/`db`, campo por campo, ou com uma macro.
--- inicial
        org 100h
        mov ax, 4C00h
        int 21h
desc:   dq 0
--- testes
[{ "nome": "o descritor", "espera": { "mem": { "desc": [255, 255, 0, 48, 18, 146, 64, 0] } } }]
--- dicas
Limite 15:0 = FFFFh (dw 0FFFFh). Base 15:0 = 3000h (dw 3000h). Base 23:16 = 12h. Acesso 92h.
Byte 6: G = 0, B = 1 (bit 6), limite 19:16 = 0: 40h. Byte 7: base 31:24 = 0.
--- solucao
        org 100h
        mov ax, 4C00h
        int 21h
desc:   dw 0FFFFh
        dw 3000h
        db 12h
        db 92h
        db 40h
        db 0
```

```exercicio
id: a61-2
titulo: Decodificar a base e o limite
nivel: 3
maquina: 386
modo: com
--- enunciado
`desc` tem um descritor qualquer. Guarde em `base` a base de 32 bits e em `limite` o **limite efetivo em bytes** (levando em conta o bit G).
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
desc:   dq 00CF9A000000FFFFh
base:   dd 1
limite: dd 1
--- testes
[{ "nome": "código plano de 4 GB", "espera": { "mem": { "base": 0, "limite": 4294967295 } } },
 { "nome": "tela com G = 0", "setup": { "desc": [159, 15, 0, 128, 11, 146, 64, 0] }, "espera": { "mem": { "base": 753664, "limite": 3999 } } },
 { "nome": "base alta, G = 1", "setup": { "desc": [16, 0, 0, 0, 64, 146, 192, 192] }, "espera": { "mem": { "base": 3225419776, "limite": 69631 } } }]
--- dicas
Carregue os 8 bytes em EAX (0-3) e EDX (4-7). Base: EAX >> 16, mais (EDX & FFh) << 16, mais EDX & FF000000h.
Limite: (EAX & FFFFh) | (EDX & F0000h). Se o bit 23 de EDX estiver ligado: shl 12 e or 0FFFh.
--- solucao
        org 100h
        mov eax, [desc]
        mov edx, [desc+4]
        mov ebx, eax
        shr ebx, 16
        mov ecx, edx
        and ecx, 0FFh
        shl ecx, 16
        or ebx, ecx
        mov ecx, edx
        and ecx, 0FF000000h
        or ebx, ecx
        mov [base], ebx
        mov ecx, eax
        and ecx, 0FFFFh
        mov esi, edx
        and esi, 0F0000h
        or ecx, esi
        bt edx, 23
        jnc .fim
        shl ecx, 12
        or ecx, 0FFFh
.fim:   mov [limite], ecx
        mov ax, 4C00h
        int 21h
desc:   dq 00CF9A000000FFFFh
base:   dd 1
limite: dd 1
```

:::resumo
- O descritor do 386 tem base de 32 bits e limite de 20 bits espalhados pelos 8 bytes, para caber nos bytes que o 286 deixou reservados.
- **G = 1**: o limite conta páginas de 4 KB; FFFFFh com G = 1 é 4 GB.
- **D = 1** num segmento de código: código de 32 bits. **B = 1** na pilha: PUSH e POP usam ESP.
- Os descritores planos de sempre: `00CF9A000000FFFFh` (código) e `00CF92000000FFFFh` (dados).
- Uma macro com `>>` e `&` monta descritores legíveis em tempo de montagem.
:::
