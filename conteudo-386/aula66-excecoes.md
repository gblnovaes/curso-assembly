---
id: aula66
numero: 66
modulo: 20
titulo: As exceções do 386
subtitulo: Vetores 0 a 31, códigos de erro, falha e armadilha
duracao: 65 min
objetivos: conhecer as exceções definidas pela Intel nos vetores 0 a 31; distinguir falha (fault), armadilha (trap) e aborto (abort) pelo comportamento do EIP na pilha; ler e interpretar os códigos de erro de #GP, #PF e #SS; escrever um tratador genérico que imprime qual exceção ocorreu
---

## O que é uma exceção?

Uma **exceção** é uma interrupção gerada internamente pela CPU quando detecta uma condição anormal durante a execução de uma instrução. Há três subtipos:

| Tipo | EIP na pilha | Exemplo |
|---|---|---|
| **Fault (falha)** | Aponta para a instrução que causou a exceção — ela pode ser reiniciada após corrigi o erro | #PF (falta de página), #GP |
| **Trap (armadilha)** | Aponta para a instrução **seguinte** — o gatilho já foi executado | INT 3, overflow (#OF) |
| **Abort (aborto)** | Sem endereço de retorno confiável — recuperação impossível | #DF (falha dupla) |

## Os vetores reservados pela Intel (0–31)

| Vetor | Nome | Tem código de erro? | Tipo |
|---|---|---|---|
| 0 | #DE: divisão por zero | Não | Fault |
| 1 | #DB: debug | Não | Fault/Trap |
| 2 | NMI: interrupção não mascarável | Não | — |
| 3 | #BP: breakpoint (INT 3) | Não | Trap |
| 4 | #OF: overflow (INTO) | Não | Trap |
| 5 | #BR: limite de BOUND excedido | Não | Fault |
| 6 | #UD: instrução inválida | Não | Fault |
| 7 | #NM: sem coprocessador | Não | Fault |
| 8 | #DF: falha dupla | Sim (sempre 0) | Abort |
| 10 | #TS: TSS inválida | Sim | Fault |
| 11 | #NP: segmento não presente | Sim | Fault |
| 12 | #SS: exceção de pilha | Sim | Fault |
| 13 | **#GP: proteção geral** | Sim | Fault |
| 14 | **#PF: falta de página** | Sim | Fault |
| 16 | #MF: exceção de ponto flutuante | Não | Fault |
| 17 | #AC: verificação de alinhamento | Sim (sempre 0) | Fault |
| 18 | #MC: verificação de máquina | — | Abort |

Os vetores 32 a 255 são livres para o sistema operacional usar (IRQs, chamadas de sistema, etc.).

## O código de erro

As exceções com código de erro empilham um número de 32 bits **antes** do EIP. Ao entrar no tratador, a pilha tem:

```
ESP+0:  código de erro (32 bits)
ESP+4:  EIP (32 bits)
ESP+8:  CS (32 bits com zero no alto)
ESP+12: EFLAGS (32 bits)
```

O IRET só desempilha EIP, CS e EFLAGS. Por isso o tratador deve remover o código de erro antes de chamar IRET, por exemplo com `add esp, 4` ou `pop eax`.

### O código de erro de #GP e #SS

```diagrama titulo="Código de erro de #GP (general protection fault)"
bit 15:3     bit 2    bit 1    bit 0
+----------+--------+--------+-------+
| seletor  |   TI   |  IDT   |  EXT  |
+----------+--------+--------+-------+
 índice GDT/LDT  1=LDT  1=é índice IDT   1=exceção externa
```

O seletor que causou o problema (ou 0 se não houve seletor específico).

### O código de erro de #PF

```diagrama titulo="Código de erro de #PF (page fault)"
bit 4    bit 3    bit 2    bit 1    bit 0
+-------+-------+-------+-------+-------+
|  I/D  |  RSVD |  U/S  |  W/R  |   P   |
+-------+-------+-------+-------+-------+
fetch    bit rsrv  usuário  escrita  1=proteção
                             0=leitura  0=não presente
```

O endereço que causou o #PF é salvo automaticamente no **CR2**.

## Um tratador genérico de exceções

```nasm executar modo="pm32" titulo="EXCP.BIN: imprime o número da exceção"
        bits 32
        org 100000h

        lidt [idtr]

        ; provocar um #GP (acessar segmento com limite errado)
        mov ax, 0           ; seletor nulo em DS
        mov ds, ax
        mov eax, [0]        ; #GP: DS inválido

        cli
        hlt

; Tratadores genéricos para vetores 0-31
; Empilham o número do vetor e saltam para o handler comum
%assign v 0
%rep 32
  exc %+ v :
    %if v == 8 || v == 10 || v == 11 || v == 12 || v == 13 || v == 14 || v == 17
        ; vetores com código de erro: apenas empilha o número
        push dword v
    %else
        ; vetores sem código de erro: empilha 0 (falso código) e o número
        push dword 0
        push dword v
    %endif
        jmp exc_handler
  %assign v v+1
%endrep

exc_handler:
        ; pilha: [esp]=vetor, [esp+4]=cod_erro, [esp+8]=eip, [esp+12]=cs, [esp+16]=eflags
        pop eax             ; vetor
        pop ecx             ; código de erro (pode ser falso 0)

        ; imprimir "EXC " + número
        mov edi, 0B8000h
        mov ah, 4Fh
        mov al, 'E'
        stosw
        mov al, 'X'
        stosw
        mov al, 'C'
        stosw
        mov al, ' '
        stosw
        ; imprimir número (0-31) como dois dígitos
        mov ebx, eax
        mov al, bl
        mov cl, 10
        xor ah, ah
        div cl
        add ax, 0x3030
        xchg al, ah
        stosw
        xchg al, ah
        stosw

.loop:  hlt
        jmp .loop

        align 8
idt:
%assign v 0
%rep 32
        dw (exc %+ v) & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw (exc %+ v) >> 16
  %assign v v+1
%endrep
        times (256 - 32) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::atencao Macro e `%assign` no tratador genérico
O NASM do curso suporta `%assign` e `%rep` para gerar código repetido. O truque de escrever `exc0:`, `exc1:`, ..., `exc31:` com um `%rep` e empilhar o número do vetor é uma técnica clássica para ter um handler genérico sem precisar de 32 funções separadas.
:::

## Um tratador de #DE que conta divisões por zero

```nasm executar modo="pm32" titulo="DIVZERO.BIN: tratando #DE e continuando"
        bits 32
        org 100000h

        lidt [idtr]
        mov dword [cont], 0

        ; três divisões por zero propositais
        xor edx, edx
        xor eax, eax
        div eax
        xor edx, edx
        xor eax, eax
        div eax
        xor edx, edx
        xor eax, eax
        div eax

        ; se o tratador está funcionando, cont deve ser 3
        mov al, [cont]
        add al, '0'
        mov [0B8000h], al
        mov byte [0B8001h], 0Fh

        cli
        hlt

de_handler:
        ; #DE: fault; EIP aponta para a instrução DIV que causou o problema
        ; para "continuar", avançamos EIP manualmente além do DIV
        ; O DIV EAX tem encoding F7 F0 = 2 bytes; o DIV EDX tem F7 F2 = 2 bytes
        ; Apontamos para a instrução depois do DIV: avançamos EIP da pilha
        inc dword [cont]
        add dword [esp], 2      ; pular os 2 bytes do "div eax" ou "div edx"
        iret

cont:   dd 0

        align 8
idt:    dw de_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw de_handler >> 16  ; vetor 0
        times (256 - 1) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

```quiz
? Qual é a diferença entre uma fault e uma trap no que diz respeito ao EIP empilhado?
+ Fault: EIP aponta para a instrução causadora (pode ser reiniciada); Trap: EIP aponta para a instrução seguinte
- Fault: EIP está no topo da pilha; Trap: EIP não é empilhado
- Fault: EIP é modificado; Trap: EIP não é modificado
- Não há diferença

? O tratador de uma exceção com código de erro (como #GP) deve fazer o quê com o código de erro antes de chamar IRET?
+ Removê-lo da pilha (pop ou add esp, 4), porque IRET só desempilha EIP, CS e EFLAGS
- Nada; IRET remove tudo
- Devolvê-lo em EAX
- Empilhá-lo de volta

? Um processo de usuário gera uma #PF. O CR2 contém qual valor?
- O endereço do tratador de #PF
- O endereço da instrução que causou a falta
+ O endereço linear que causou a falta de página
- O código de erro da falta
```

## Exercícios

```exercicio
id: a66-1
titulo: Tratador de #DE que registra o EIP
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Instale um tratador para o vetor 0 (#DE) que salva em `eip_salvo` o EIP que está no topo da pilha **após o código de erro ter sido descartado** (lembre: #DE não tem código de erro, então o EIP é o primeiro item na pilha). Depois retorne com IRET. O código faz `xor edx, edx` / `div edx` e depois armazena EIP. A instrução `div edx` em 32 bits tem encoding `F7 F2` (2 bytes).
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        xor edx, edx
        div edx             ; 2 bytes: F7 F2
        cli
        hlt

de_handler:
        ; salve EIP em eip_salvo e continue (avance EIP de 2 bytes)
        iret

eip_salvo: dd 0

        align 8
idt:    ; coloque o gate para vetor 0 aqui
        times (256 - 1) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "eip_salvo é o endereço do div edx", "espera": { "mem": { "eip_salvo": 1048585 } } }]
--- dicas
O gate do vetor 0: dw de_handler & 0FFFFh / dw 08h / db 0 / db 8Eh / dw de_handler >> 16.
No handler: mov eax, [esp] (EIP está no topo) / mov [eip_salvo], eax / add dword [esp], 2 / iret.
O endereço 1048585 = 0x100009 = org 0x100000 + 9 bytes: lidt usa 7 bytes (0F 01 1D + disp32), xor edx,edx usa 2 bytes.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        xor edx, edx
        div edx
        cli
        hlt

de_handler:
        mov eax, [esp]
        mov [eip_salvo], eax
        add dword [esp], 2
        iret

eip_salvo: dd 0

        align 8
idt:    dw de_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw de_handler >> 16
        times (256 - 1) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

```exercicio
id: a66-2
titulo: Tratador de #GP que imprime o código de erro
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Instale um tratador para o vetor 13 (#GP). O código provoca um #GP carregando o seletor `28h` (que não existe na GDT do ambiente) em DS. O tratador deve salvar o código de erro em `cod_erro` e parar (cli/hlt — **não** chamar IRET, pois não há como continuar com DS inválido). O código de erro de um seletor inválido é o seletor com os bits 0-2 zerados: para o seletor `28h`, o código de erro vale `28h` = 40.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        mov ax, 28h
        mov ds, ax      ; #GP: seletor inexistente

        cli
        hlt

gp_handler:
        ; pilha: [esp]=cod_erro, [esp+4]=eip, ...
        ; salve o código de erro em cod_erro e pare
        cli
        hlt

cod_erro: dd 0FFFFFFFFh

        align 8
idt:    times 13 * 8 db 0     ; vetores 0-12 ausentes
        ; coloque o gate do vetor 13 aqui
        times (256 - 14) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "código de erro = 28h", "espera": { "mem": { "cod_erro": 40 } } }]
--- dicas
Gate do vetor 13: dw gp_handler & 0FFFFh / dw 08h / db 0 / db 8Eh / dw gp_handler >> 16.
No handler: pop eax / mov [cod_erro], eax / cli / hlt. (O pop pega o código de erro do topo.)
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        mov ax, 28h
        mov ds, ax

        cli
        hlt

gp_handler:
        pop eax
        mov [cod_erro], eax
        cli
        hlt

cod_erro: dd 0FFFFFFFFh

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
- A Intel reserva vetores 0–31 para exceções; vetores 32–255 são para o SO.
- **Fault**: EIP na pilha é a instrução que causou a exceção (pode ser reexecutada após corrigir o problema).
- **Trap**: EIP na pilha é a instrução **seguinte** (o gatilho já ocorreu).
- Exceções 8, 10–14 e 17 empilham um código de erro antes de EIP. O tratador deve descartá-lo antes de `IRET`.
- O CR2 guarda o endereço linear que causou um #PF.
:::
