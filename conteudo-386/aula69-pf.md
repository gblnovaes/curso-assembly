---
id: aula69
numero: 69
modulo: 21
titulo: A falta de página (#PF)
subtitulo: Código de erro, CR2 e paginação sob demanda
duracao: 65 min
objetivos: entender quando e como a CPU gera uma #PF; interpretar o código de erro do vetor 14; ler o endereço faltante em CR2; escrever um tratador de #PF que monta a página ausente e retorna com IRET para reexecutar a instrução
---

## O que gera uma #PF?

Uma falta de página (vetor **14**, #PF) ocorre quando a CPU tenta traduzir um endereço linear e encontra um dos seguintes problemas:

1. A entrada no PD ou na PT tem **P = 0** (página não presente).
2. O acesso viola a proteção: escrita em página R/W=0, ou anel 3 acessando página U/S=0.

O 386 então:
1. Salva o endereço linear que causou o erro em **CR2**.
2. Empilha um **código de erro** de 32 bits.
3. Chama o tratador do vetor 14 pela IDT.

## O código de erro do #PF

```diagrama titulo="Código de erro empilhado pelo #PF"
bit 4    bit 3    bit 2    bit 1    bit 0
+-------+-------+-------+-------+-------+
|  I/D  |  RSVD |  U/S  |  W/R  |   P   |
+-------+-------+-------+-------+-------+
instrução  bit    usuário  escrita  1 = violação de proteção
 ou dado reservado          0 = leitura  0 = página não presente
```

| Bit | Valor 0 | Valor 1 |
|---|---|---|
| **P** | Página ausente (PDE ou PTE com P=0) | Página presente, mas acesso proibido |
| **W/R** | Falha numa leitura | Falha numa escrita |
| **U/S** | Acesso em anel 0 | Acesso em anel 3 |
| **I/D** | Acesso a dado | Busca de instrução |

## CR2: o endereço que falhou

Ao entrar no tratador de #PF, **CR2** contém o endereço linear que causou a falta. O tratador pode lê-lo com `mov eax, cr2`.

:::atencao Salve CR2 antes de qualquer acesso à memória
CR2 é sobrescrito pela próxima #PF. Se o tratador acessa memória e gera outra falta (nested #PF), CR2 muda antes de você gravá-lo. Leia CR2 como primeira instrução do tratador.
:::

## Capturando o CR2

```nasm executar modo="pm32" titulo="PF.BIN: tratador de #PF captura CR2"
        bits 32
        org 100000h

        lidt [idtr]

        ; mapa idêntico 4 MB
        mov edi, 201000h
        xor eax, eax
.pt:    mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt
        mov dword [200000h], 201003h    ; PDE[0] = PT0

        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        ; acessar endereço fora dos 4 MB mapeados → #PF
        mov eax, [500000h]              ; CR2 = 500000h

        cli
        hlt

pf_handler:
        ; pilha: [esp]=cod_erro, [esp+4]=eip, [esp+8]=cs, [esp+12]=eflags
        pop eax                         ; descartar código de erro
        mov eax, cr2                    ; ler endereço que falhou
        mov [cr2_salvo], eax
        cli
        hlt

cr2_salvo: dd 0

        align 8
idt:    times 14 * 8 db 0
        ; vetor 14 = #PF
        dw pf_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw pf_handler >> 16
        times (256 - 15) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

## Paginação sob demanda

Como #PF é uma **fault** (EIP na pilha aponta para a instrução que falhou), o tratador pode *mapear a página* e retornar com `IRET` — a CPU reexecuta a instrução, que agora encontra a página presente:

```nasm executar modo="pm32" titulo="DEMAND.BIN: mapeando página na falta"
        bits 32
        org 100000h

        lidt [idtr]

        ; PT0: mapa idêntico 4 MB, mas página 0x300000 com P=0 (ausente)
        mov edi, 201000h
        xor eax, eax
.pt:    cmp eax, 300000h        ; pular o frame 300000h
        je  .sem_mapear
        mov edx, eax
        or  edx, 3
        mov [edi], edx
        jmp .prox
.sem_mapear:
        mov dword [edi], 0      ; P=0 = não presente
.prox:  add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt

        mov dword [200000h], 201003h
        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        ; esta instrução vai causar #PF; o handler a mapeia; IRET a retenta
        mov eax, [300000h]
        mov [resultado], eax
        cli
        hlt

pf_handler:
        pop  ecx                        ; código de erro
        mov  eax, cr2                   ; endereço linear faltando
        and  eax, 0FFFFF000h            ; alinha para o início da página
        or   eax, 3                     ; P=1, R/W=1
        ; PT0[768] = entrada para 300000h; 768 * 4 = 3072 = 0xC00
        mov  [201000h + 0C00h], eax     ; mapear PT0[768]
        ; re-escrever CR3 invalida TLB e força releitura das tabelas
        mov  eax, cr3
        mov  cr3, eax
        iret                            ; volta para mov eax, [300000h] → retry

resultado: dd 0

        align 8
idt:    times 14 * 8 db 0
        dw pf_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw pf_handler >> 16
        times (256 - 15) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::anos90 Como o Linux 2.0 alocava páginas
No Linux 2.0, cada processo tinha seu espaço de endereços; quando acessava uma página nova (mapeada como ausente), o tratador de #PF buscava um frame livre, zerrava-o, mapeava-o e retornava. O processo nunca sabia que a página não existia antes. Esse mecanismo, chamado *demand paging*, permitia que programas usassem mais memória virtual do que a RAM física disponível, com o resto no arquivo de swap em disco.
:::

```quiz
? O que o 386 armazena automaticamente em CR2 ao gerar uma #PF?
+ O endereço linear que causou a falta (o endereço que a CPU tentou traduzir)
- O endereço físico do frame que faltou
- O endereço do tratador de #PF
- O conteúdo do registrador CS

? No tratador de #PF, qual é o primeiro item na pilha ao entrar?
+ O código de erro (32 bits), empilhado antes de EIP
- O EIP da instrução que falhou
- CR2
- O seletor CS

? Por que o tratador de #PF pode fazer IRET e ter a instrução original reexecutada com sucesso?
+ Porque #PF é uma fault: o EIP empilhado aponta para a instrução que causou a falta, que será reexecutada
- Porque IRET sempre reexecuta a última instrução
- Porque o tratador avança EIP manualmente para o mesmo endereço
- Não é possível; o processo deve ser terminado após #PF
```

## Exercícios

```exercicio
id: a69-1
titulo: Tratador de #PF que salva CR2
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Monte o mapa idêntico de 4 MB (PT0 em `0x201000`, PD em `0x200000`). Instale um tratador para o vetor 14 que salva o valor de CR2 em `cr2_salvo` e para (CLI/HLT — não há como continuar sem mapear a página). Ative a paginação e acesse `[800000h]` para gerar o #PF. O teste verifica que `cr2_salvo = 0x800000`.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        ; monte paginação (mapa idêntico 4 MB)

        ; ative CR3 e PG

        mov eax, [800000h]      ; → #PF

        cli
        hlt

pf_handler:
        ; pop do código de erro; ler CR2; salvar em cr2_salvo; parar
        iret

cr2_salvo: dd 0

        align 8
idt:    times 14 * 8 db 0
        ; gate do vetor 14 aqui
        times (256 - 15) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "CR2 = 800000h", "espera": { "mem": { "cr2_salvo": 8388608 } } }]
--- dicas
Gate vetor 14: dw pf_handler & 0FFFFh / dw 08h / db 0 / db 8Eh / dw pf_handler >> 16.
Handler: pop eax (código de erro) / mov eax, cr2 / mov [cr2_salvo], eax / cli / hlt.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        mov edi, 201000h
        xor eax, eax
.pt:    mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt
        mov dword [200000h], 201003h

        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        mov eax, [800000h]
        cli
        hlt

pf_handler:
        pop  eax
        mov  eax, cr2
        mov  [cr2_salvo], eax
        cli
        hlt

cr2_salvo: dd 0

        align 8
idt:    times 14 * 8 db 0
        dw pf_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw pf_handler >> 16
        times (256 - 15) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

```exercicio
id: a69-2
titulo: Paginação sob demanda — mapear página na falta
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte o mapa idêntico de 4 MB mas deixe `PT0[768]` (que mapeia `0x300000`) com P=0. Escreva `0xDEADBEEF` em `0x300000` *antes* de ativar a paginação. Instale um tratador de #PF que mapeia a página faltante: lê CR2, alinha para a página, coloca `endereço | 3` em `PT0[CR2 >> 12]`, re-escreve CR3 para limpar a TLB e faz IRET. Ative a paginação e leia `[300000h]` — o handler mapeia, IRET retenta, e a leitura funciona. Armazene o valor lido em `resultado`.
--- inicial
        bits 32
        org 100000h

        lidt [idtr]

        ; escrever em 300000h ANTES de ativar paginação
        ; (com PG desligado, 300000h é acessado diretamente)

        ; PT0 em 201000h: mapa idêntico 4MB, deixar PT0[768] com P=0
        ; PD em 200000h, CR3, PG

        ; mov eax, [300000h] → aqui ocorre #PF; handler mapeia; IRET retenta
        cli
        hlt

pf_handler:
        ; pop cod_erro; ler CR2; calcular índice PT; mapear; mov cr3,cr3; iret
        iret

resultado: dd 0

        align 8
idt:    times 14 * 8 db 0
        ; gate vetor 14
        times (256 - 15) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
--- testes
[{ "nome": "resultado = 0DEADBEEFh", "espera": { "mem": { "resultado": 3735928559 } } }]
--- dicas
Loop PT0: pular quando eax=300000h (mov dword [edi], 0 em vez de | 3).
Handler: pop ecx / mov eax, cr2 / and eax, 0FFFFF000h / or eax, 3 (prepara PTE) / mov edx, cr2 / shr edx, 12 / mov [201000h + edx*4], eax / mov eax, cr3 / mov cr3, eax / iret.
--- solucao
        bits 32
        org 100000h

        lidt [idtr]

        mov dword [300000h], 0DEADBEEFh

        mov edi, 201000h
        xor eax, eax
.pt:    cmp eax, 300000h
        je  .skip
        mov edx, eax
        or  edx, 3
        mov [edi], edx
        jmp .next
.skip:  mov dword [edi], 0
.next:  add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt

        mov dword [200000h], 201003h
        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        mov eax, [300000h]
        mov [resultado], eax
        cli
        hlt

pf_handler:
        pop  ecx
        mov  eax, cr2
        and  eax, 0FFFFF000h
        or   eax, 3
        mov  edx, cr2
        shr  edx, 12
        mov  [201000h + edx*4], eax
        mov  eax, cr3
        mov  cr3, eax
        iret

resultado: dd 0

        align 8
idt:    times 14 * 8 db 0
        dw pf_handler & 0FFFFh
        dw 08h
        db 0
        db 8Eh
        dw pf_handler >> 16
        times (256 - 15) * 8 db 0

idtr:   dw 256 * 8 - 1
        dd idt
```

:::resumo
- #PF (vetor 14) é gerada quando P=0 numa PDE ou PTE, ou quando o acesso viola a proteção de R/W ou U/S.
- O endereço linear que falhou é salvo no **CR2**; leia-o como primeira instrução do tratador.
- O código de erro empilhado indica: bit 0 = P (proteção vs. ausência), bit 1 = W/R (escrita vs. leitura), bit 2 = U/S (anel 3 vs. anel 0).
- Como #PF é uma **fault**, o EIP na pilha aponta para a instrução faltosa — o tratador pode mapear a página e retornar com IRET, que reexecuta a instrução.
- Esse mecanismo é a base da **paginação sob demanda** usada por todos os sistemas operacionais modernos.
:::
