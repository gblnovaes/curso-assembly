---
id: aula65
numero: 65
modulo: 20
titulo: A IDT e os gates
subtitulo: Interrupt gate, trap gate, LIDT e o tratador mínimo
duracao: 75 min
objetivos: entender a estrutura de um gate de interrupção de 32 bits; montar uma IDT com LIDT; escrever um tratador mínimo de exceção com IRET; distinguir interrupt gate de trap gate; reconhecer o formato de saída de erro da máquina 386
---

## A IDT: a tabela de interrupções do modo protegido

No modo real, quando ocorre uma interrupção de número N, a CPU busca o vetor na **IVT** (tabela de vetores de interrupção), que começa no endereço 0 e tem uma entrada de 4 bytes por vetor (segment:offset de 16 bits).

No modo protegido, a CPU busca o vetor N na **IDT** (tabela de descritores de interrupção). A IDT pode ficar em qualquer lugar da memória e o registrador **IDTR** (base + limite) aponta para ela, assim como o GDTR aponta para a GDT. Cada entrada da IDT tem 8 bytes e se chama **gate**.

## Os gates de interrupção e trap

```diagrama titulo="Gate de interrupção de 32 bits (8 bytes)"
byte 7           byte 6                    byte 5            bytes 4, 3, 2, 1, 0
+----------------+--+--+---+------+-------+-----------------+------------------+
| offset 31:16   |P |DPL|0 | tipo |  000  |  seletor CS     |  offset 15:0     |
+----------------+--+--+---+------+-------+-----------------+------------------+
                            1110=INT gate                      o mesmo formato
                            1111=trap gate                     do descritor de código
```

- **Seletor CS**: o segmento de código onde está o tratador (quase sempre `08h`).
- **Offset**: endereço de 32 bits do tratador dentro do segmento.
- **P**: presente; se 0, causa #NP.
- **DPL**: nível mínimo para chamar com INT N; exceções de hardware ignoram o DPL.
- **Tipo 0xE (interrupt gate)**: além de desviar para o tratador, **zera o IF** (desliga interrupções). Ideal para exceções e IRQs.
- **Tipo 0xF (trap gate)**: **não zera o IF**. Usado para breakpoints (INT 3) e chamadas de sistema que permitem interrupções aninhadas.

O formato em NASM, num gate que aponta para o endereço `alvo` no segmento `08h`:

```nasm fragmento titulo="Construindo um gate com dw/dd"
; gate de interrupção DPL 0 para um tratador em 'alvo':
        dw alvo & 0FFFFh        ; offset 15:0
        dw 08h                  ; seletor de código anel 0
        db 0                    ; zero (reservado)
        db 10001110b            ; P=1, DPL=0, tipo=0xE (interrupt gate)
        dw alvo >> 16           ; offset 31:16
```

Uma macro deixa a IDT mais legível:

```nasm fragmento titulo="Macro GATE"
; GATE seletor, offset, flags (8Eh = int gate DPL 0, 8Fh = trap gate DPL 0)
%macro GATE 3
        dw (%2) & 0FFFFh
        dw %1
        db 0
        db %3
        dw (%2) >> 16
%endmacro
```

## Montando e carregando a IDT

```nasm executar modo="pm32" titulo="IDT1.BIN: IDT com tratadores de exceção"
        bits 32
        org 100000h

%macro GATE 3
        dw (%2) & 0FFFFh
        dw %1
        db 0
        db %3
        dw (%2) >> 16
%endmacro

        ; instalar IDT
        lidt [idtr]

        ; gerar uma exceção #DE (divisão por zero, vetor 0)
        xor edx, edx
        xor eax, eax
        div edx         ; divide por zero → #DE
        cli
        hlt

; tratador de #DE
de_handler:
        ; na pilha: [ESP] = EIP que causou a exceção
        ;           [ESP+4] = CS
        ;           [ESP+8] = EFLAGS
        ; Numa exceção com código de erro, há um word extra antes de EIP
        mov byte [0B8000h], 'D'
        mov byte [0B8001h], 1Fh
        mov byte [0B8002h], 'E'
        mov byte [0B8003h], 1Fh
        ; a div por zero empilha o EIP DA instrução que causou a exceção
        ; não tem código de erro (as que têm são DF, TS, NP, SS, GP, PF, AC)
        add esp, 4              ; descarta EIP (não vamos voltar)
        jmp .loop
.loop:  hlt
        jmp .loop

idt:    GATE 08h, de_handler, 8Eh   ; vetor 0: #DE
        times (32 - 1) * 8 db 0     ; vetores 1-31 não tratados (presentes=0 = causa NP)

idtr:   dw 32 * 8 - 1
        dd idt
```

:::cpu O que a CPU empilha ao entregar uma exceção
Antes de chamar o tratador, a CPU empilha automaticamente:
- **EFLAGS** original
- **CS** do código interrompido
- **EIP** de retorno (para onde iret vai voltar)
- Para algumas exceções (DF, TS, NP, SS, GP, PF, AC, CP): um **código de erro** de 32 bits antes do EIP
O tratador restaura tudo com `IRET`, que desempilha EIP, CS e EFLAGS de volta nos registradores.
:::

## O IDT correto com IRET

Para um tratador que realmente retorna ao código interrompido, use `IRET`:

```nasm executar modo="pm32" titulo="TRAP.BIN: capturando INT 3 com trap gate"
        bits 32
        org 100000h

%macro GATE 3
        dw (%2) & 0FFFFh
        dw %1
        db 0
        db %3
        dw (%2) >> 16
%endmacro

        lidt [idtr]

        ; INT 3 chama o trap gate
        int 3

        ; se o trap gate funcionou, chegamos aqui
        mov byte [0B8000h], 'O'
        mov byte [0B8001h], 2Fh
        mov byte [0B8002h], 'K'
        mov byte [0B8003h], 2Fh
        cli
        hlt

bp_handler:
        ; INT 3 não tem código de erro
        ; o EIP na pilha aponta para a instrução DEPOIS de INT 3
        iret                    ; volta para o código logo após int 3

idt:    times 3 * 8 db 0        ; vetores 0-2 não tratados
        GATE 08h, bp_handler, 8Fh  ; vetor 3: INT 3 (trap gate, DPL=0)
        times (256 - 4) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

## O IDTR e como a máquina 386 usa a IDT

No modo `pm32` da máquina 386, há uma IDT de ambiente já carregada: cada vetor aponta para um stub que registra a exceção e para a execução (status `excecao`). Por isso os exercícios das aulas anteriores podiam capturar exceções sem montar uma IDT. Quando você instala sua própria IDT com `LIDT`, ela substitui a do ambiente.

```quiz
? Qual é a diferença entre um interrupt gate (0xE) e um trap gate (0xF)?
+ O interrupt gate zera o IF ao entrar no tratador; o trap gate não muda o IF
- O interrupt gate usa 32 bits de offset; o trap gate usa 16 bits
- O trap gate é só para exceções; o interrupt gate é só para IRQs
- Não há diferença; os nomes são sinônimos

? Quando a CPU entrega uma exceção com código de erro (como #GP), o que aparece no topo da pilha ao entrar no tratador?
- EIP
- EFLAGS
+ O código de erro (32 bits), empilhado antes de EIP
- CS

? Para que serve o campo DPL de um gate?
- Define o anel do tratador
+ Define o nível mínimo necessário para chamar o vetor com INT N a partir do código de usuário
- Define se o gate tem código de erro
- Define o endereço base do segmento
```

## Exercícios

```exercicio
id: a65-1
titulo: Montar um gate de interrupção
nivel: 2
maquina: 386
modo: com
--- enunciado
Escreva em `gate` (8 bytes) um **interrupt gate DPL 0** que aponta para o seletor `08h` e o offset `0DEADBEEF h`. Escreva campo a campo com `dw`/`db`.
--- inicial
        org 100h
        mov ax, 4C00h
        int 21h
gate:   dq 0
--- testes
[{ "nome": "gate correto", "espera": { "mem": { "gate": [239, 190, 8, 0, 0, 142, 173, 222] } } }]
--- dicas
Offset 15:0 = 0BEEFh (dw 0BEEFh). Seletor = 08h (dw 0008h). Reservado = 0 (db 0). Flags = 8Eh (db 8Eh). Offset 31:16 = 0DEADh (dw 0DEADh).
--- solucao
        org 100h
        mov ax, 4C00h
        int 21h
gate:   dw 0BEEFh
        dw 0008h
        db 0
        db 8Eh
        dw 0DEADh
```

```exercicio
id: a65-2
titulo: Tratador com IRET que conta chamadas
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Instale um **trap gate** para o vetor 5 (INT 5) que incrementa `contador` e retorna com IRET. O código principal faz `int 5` três vezes. Ao final `contador` deve valer 3.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        int 5
        int 5
        int 5

        cli
        hlt

handler5:
        ; complete: incremente contador e retorne
        iret

contador: dd 0

idt:    times 5 * 8 db 0
        ; coloque o gate para o vetor 5 aqui
        times (256 - 6) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "contador = 3", "espera": { "mem": { "contador": 3 } } }]
--- dicas
No gate do vetor 5: dw handler5 & 0FFFFh / dw 08h / db 0 / db 8Fh (trap gate) / dw handler5 >> 16.
No handler: inc dword [contador] e depois iret.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        int 5
        int 5
        int 5

        cli
        hlt

handler5:
        inc dword [contador]
        iret

contador: dd 0

idt:    times 5 * 8 db 0
        dw handler5 & 0FFFFh
        dw 08h
        db 0
        db 8Fh
        dw handler5 >> 16
        times (256 - 6) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::resumo
- A IDT tem uma entrada de 8 bytes (gate) para cada vetor de interrupção de 0 a 255.
- Um gate de interrupção (tipo 0xE) desvio para o tratador e **zera o IF**; um trap gate (0xF) mantém o IF.
- Ao entrar no tratador, a CPU empilha EFLAGS, CS e EIP automaticamente; algumas exceções empilham também um código de erro.
- `LIDT [idtr]` carrega o IDTR com o endereço e o limite da IDT.
- `IRET` desempilha EIP, CS e EFLAGS e retorna ao código interrompido.
:::
