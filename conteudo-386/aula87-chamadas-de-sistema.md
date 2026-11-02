---
id: aula87
numero: 87
modulo: 27
titulo: Chamadas de sistema por dentro
subtitulo: De INT 21h a SYSENTER, a tabela de despacho e a regra de nunca confiar num ponteiro do usuário
duracao: 65 min
objetivos: comparar INT 21h, INT 80h e SYSENTER como portas de entrada do kernel; montar uma tabela de despacho que devolve -ENOSYS para números inválidos; validar um ponteiro vindo do usuário sem cair no estouro do somatório
---

## A porta de entrada do kernel

Um programa de usuário roda no anel 3 e não pode tocar o disco, a tela nem a memória de outro processo. Para pedir qualquer coisa ao sistema, ele precisa **atravessar a fronteira** do kernel de um jeito controlado. Esse ponto de passagem é a **chamada de sistema** (*system call*). O que muda de um sistema para outro é o *mecanismo*: como o programa chega ao kernel e como diz o que quer.

| Sistema | Instrução | Como diz o que quer |
|---------|-----------|---------------------|
| MS-DOS | `INT 21h` | número da função em **AH** |
| Linux i386 | `INT 80h` | número da chamada em **EAX**, argumentos em EBX, ECX, EDX, ESI, EDI, EBP |
| Windows NT (até o 2000) | `INT 2Eh` | número do serviço em EAX |
| Pentium II em diante | `SYSENTER` | o mesmo, mas sem passar pela IDT |
| x86-64 | `SYSCALL` | número em RAX, argumentos em RDI, RSI, RDX... |

Veja a mesma chamada, escrever cinco bytes na tela, nos dois mundos:

```nasm fragmento titulo="DOS: INT 21h, função 09h"
        mov  ah, 09h          ; função: imprimir string
        mov  dx, mensagem     ; DS:DX aponta para o texto terminado em $
        int  21h
```

```nasm fragmento titulo="Linux i386: INT 80h, chamada 4 (write)"
        mov  eax, 4           ; número da chamada: sys_write
        mov  ebx, 1           ; 1º argumento: descritor 1 (a saída padrão)
        mov  ecx, mensagem    ; 2º argumento: endereço do texto
        mov  edx, 5           ; 3º argumento: quantos bytes
        int  80h              ; o valor de retorno volta em EAX
```

:::cpu Por que o INT 80h atravessa o anel e o INT 21h não
No DOS tudo roda no anel 0 do modo real, então `INT 21h` é só uma chamada de função pelo vetor da IVT; não há fronteira a cruzar. No Linux, a entrada 0x80 da IDT é um *gate* com `DPL = 3`, o que **permite** que o anel 3 a use (aula 71). A CPU troca de pilha pela TSS (`SS0:ESP0`, aula 72), salta para o código do kernel e o `IRET` do retorno volta ao anel 3. É o mecanismo que você montou na aula 73.
:::

## SYSENTER: a porta rápida

Atravessar um gate de interrupção custa caro: a CPU lê o descritor na IDT, confere os privilégios, carrega o novo seletor de código e troca a pilha, tudo isso a cada chamada. Como uma chamada de sistema é muito frequente, a Intel criou no **Pentium II** (1997) a instrução `SYSENTER`, e a AMD criou a `SYSCALL`. Elas **não consultam a IDT nem a GDT**: os endereços e os seletores ficam em registradores especiais da CPU, os MSRs, configurados uma vez pelo kernel na partida. A chamada fica várias vezes mais rápida. O Linux 2.6 e o Windows XP passaram a usá-la quando o processador permite.

O simulador desta trilha é um 386, que não tem `SYSENTER`; nas aulas usamos `INT 80h`, que existe em todo x86 de 32 bits e ensina a mesma ideia.

## A tabela de despacho

Quando o kernel recebe a chamada, ele precisa trocar o **número** pelo código a executar. A solução padrão é um vetor de ponteiros para função, uma **tabela de despacho** (no Linux, a `sys_call_table`):

```diagrama titulo="Despachando a chamada número N"
tabela_sys:  [0] ──► sys_dobro
             [1] ──► sys_quadrado
             [2] ──► sys_incrementa

chamada(num, arg):
    se num >= 3:           ; fora da tabela
        devolva -ENOSYS    ; "função não implementada" (-38 no Linux)
    senão:
        devolva tabela_sys[num](arg)
```

A verificação `num >= 3` é essencial: sem ela, o número é um índice direto num vetor de endereços, e um programa do usuário que passa `num = 1000000` faria o kernel **saltar para um endereço qualquer** lido de fora da tabela. O valor de erro negativo (`-ENOSYS`, `-EFAULT`, `-EINVAL`...) é o jeito do Linux avisar uma falha: um retorno entre `-1` e `-4095` é um erro.

## Nunca confie num ponteiro do usuário

Há uma regra mais séria. Se o usuário passa ao kernel um **ponteiro** (o endereço do texto do `write`), o kernel vai ler dele no anel 0, onde nenhuma proteção o impede de ler a memória de qualquer um. Um programa malicioso pode então passar o endereço de uma estrutura **do próprio kernel** e fazer o `write` mostrar dados secretos, ou usar o `read` para sobrescrever o kernel. É o problema do "procurador confuso", o mesmo da aula 71, agora com ponteiros.

Por isso o kernel confere, antes de tocar no ponteiro, se a região `[ptr, ptr + tamanho)` cabe inteira na parte da memória que pertence ao usuário. No Linux de 32 bits isso é `access_ok`, e a divisão clássica é: o usuário vai até `0xC0000000` e o kernel ocupa o resto.

```diagrama titulo="Um teste de intervalo ingênuo (e errado)"
if (ptr + tamanho <= 0xC0000000)  ok        ← ERRADO

ptr = 0xFFFFFFF0, tamanho = 0x20
ptr + tamanho = 0x100000010  →  estoura 32 bits  →  vale 0x10
0x10 <= 0xC0000000  →  "ok"!   (e o kernel lê memória inválida)
```

A soma **estoura** os 32 bits e volta a um valor pequeno que passa na comparação. O teste correto precisa detectar o estouro (o *carry*) antes de comparar.

:::atencao Estouro de inteiro é vulnerabilidade
Esse tipo de erro, soma de ponteiro e tamanho sem checar o estouro, causou falhas de segurança reais em kernels. Sempre que somar dois valores vindos do usuário, pergunte: *e se a soma passar de 32 bits?*
:::

```quiz
? Por que o INT 80h do Linux permite que o anel 3 entre no kernel, se o kernel roda no anel 0?
+ A entrada 0x80 da IDT é um gate com DPL = 3, que permite o INT do anel 3; a CPU troca para a pilha do anel 0 pela TSS
- Porque o anel 3 pode executar qualquer instrução privilegiada
- Porque o INT 80h desliga a proteção
- Porque o kernel é copiado para o anel 3 durante a chamada

? Para que serve a verificação num >= N antes de usar a tabela de despacho?
+ Para impedir que um número fora da tabela faça o kernel ler um endereço qualquer e saltar para ele; o retorno é -ENOSYS
- Para deixar o escalonador mais rápido
- Para conferir se o usuário é o administrador
- Para escolher qual anel usar

? Por que o teste "ptr + tamanho <= LIMITE" está errado?
+ A soma pode estourar os 32 bits e voltar a um valor pequeno que passa na comparação; é preciso checar o carry antes
- Porque o LIMITE deveria ser 0xFFFFFFFF
- Porque ptr e tamanho devem ser comparados em separado
- Porque a comparação não funciona em modo protegido
```

## Exercícios

```exercicio
id: a87-1
titulo: access_ok sem estouro
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Implemente `access_ok(ptr, tamanho)`: devolve `1` em EAX se a região `[ptr, ptr + tamanho)` cabe na parte do usuário (termina em ou antes de `LIMITE = 0xC0000000`) e `0` caso contrário. O ponteiro está em `[esp+4]` e o tamanho em `[esp+8]`. **Atenção ao estouro**: some os dois e, se a soma passar de 32 bits (CF = 1), devolva 0. O programa testa quatro pares da `tabela` e guarda os resultados, um byte cada, em `res`. Verifique `res = [1, 0, 0, 1]`. O terceiro par (`0xFFFFFFF0` + `0x20`) estoura a soma e só passa se o seu teste for ingênuo.
--- inicial
        bits 32
        org 100000h

LIMITE equ 0xC0000000

        xor  ebx, ebx
.laco:
        mov  esi, ebx
        shl  esi, 3
        push dword [tabela+esi+4]   ; tamanho
        push dword [tabela+esi]     ; ptr
        call access_ok
        add  esp, 8
        mov  [res+ebx], al
        inc  ebx
        cmp  ebx, 4
        jb   .laco
        cli
        hlt

access_ok:
        ; eax = ptr + tamanho; se CF = 1, devolva 0
        ; se eax > LIMITE, devolva 0; senão devolva 1
        mov  eax, 1
        ret

tabela:
        dd 0x00001000, 0x00000100     ; dentro
        dd 0xBFFFFFF0, 0x00000020     ; passa do limite
        dd 0xFFFFFFF0, 0x00000020     ; a soma estoura os 32 bits
        dd 0xBFFFF000, 0x00001000     ; termina exatamente no limite
res:    times 4 db 0
--- testes
[{ "nome": "res = [1, 0, 0, 1]", "espera": { "mem": { "res": [1, 0, 0, 1] } } }]
--- dicas
mov eax, [esp+4] / add eax, [esp+8] / jc .nao.
cmp eax, LIMITE / ja .nao / mov eax, 1 / ret.
.nao: xor eax, eax / ret.
--- solucao
        bits 32
        org 100000h

LIMITE equ 0xC0000000

        xor  ebx, ebx
.laco:
        mov  esi, ebx
        shl  esi, 3
        push dword [tabela+esi+4]
        push dword [tabela+esi]
        call access_ok
        add  esp, 8
        mov  [res+ebx], al
        inc  ebx
        cmp  ebx, 4
        jb   .laco
        cli
        hlt

access_ok:
        mov  eax, [esp+4]
        add  eax, [esp+8]
        jc   .nao
        cmp  eax, LIMITE
        ja   .nao
        mov  eax, 1
        ret
.nao:
        xor  eax, eax
        ret

tabela:
        dd 0x00001000, 0x00000100
        dd 0xBFFFFFF0, 0x00000020
        dd 0xFFFFFFF0, 0x00000020
        dd 0xBFFFF000, 0x00001000
res:    times 4 db 0
```

```exercicio
id: a87-2
titulo: A tabela de despacho com -ENOSYS
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Implemente `syscall(num, arg)`: o número está em `[esp+4]` e o argumento em `[esp+8]`. Se `num >= NSYS` (3), devolva `-38` (`-ENOSYS`) em EAX. Senão, empilhe `arg`, chame o endereço guardado em `tabela_sys[num]` (use `call [tabela_sys+eax*4]`), limpe a pilha e devolva o valor que o tratador deixou em EAX. Os três tratadores já estão prontos: `0` dobra o argumento, `1` o eleva ao quadrado e `2` soma 1. O programa chama `syscall(1, 7)`, `syscall(9, 0)` e `syscall(2, 10)`. Verifique `r1 = 49`, `r2 = -38` e `r3 = 11`.
--- inicial
        bits 32
        org 100000h

NSYS equ 3

        push dword 7
        push dword 1
        call syscall
        add  esp, 8
        mov  [r1], eax
        push dword 0
        push dword 9
        call syscall
        add  esp, 8
        mov  [r2], eax
        push dword 10
        push dword 2
        call syscall
        add  esp, 8
        mov  [r3], eax
        cli
        hlt

syscall:
        ; valide num; despache por tabela_sys
        xor  eax, eax
        ret

sys_dobro:
        mov  eax, [esp+4]
        add  eax, eax
        ret
sys_quadrado:
        mov  eax, [esp+4]
        imul eax, eax
        ret
sys_inc:
        mov  eax, [esp+4]
        inc  eax
        ret

tabela_sys: dd sys_dobro, sys_quadrado, sys_inc
r1: dd 0
r2: dd 0
r3: dd 0
--- testes
[{ "nome": "r1 = 49, r2 = -38, r3 = 11", "espera": { "mem": { "r1": 49, "r2": -38, "r3": 11 } } }]
--- dicas
mov eax, [esp+4] / cmp eax, NSYS / jae .invalida.
push dword [esp+8] / call [tabela_sys+eax*4] / add esp, 4 / ret.
.invalida: mov eax, -38 / ret.
--- solucao
        bits 32
        org 100000h

NSYS equ 3

        push dword 7
        push dword 1
        call syscall
        add  esp, 8
        mov  [r1], eax
        push dword 0
        push dword 9
        call syscall
        add  esp, 8
        mov  [r2], eax
        push dword 10
        push dword 2
        call syscall
        add  esp, 8
        mov  [r3], eax
        cli
        hlt

syscall:
        mov  eax, [esp+4]
        cmp  eax, NSYS
        jae  .invalida
        push dword [esp+8]
        call [tabela_sys+eax*4]
        add  esp, 4
        ret
.invalida:
        mov  eax, -38
        ret

sys_dobro:
        mov  eax, [esp+4]
        add  eax, eax
        ret
sys_quadrado:
        mov  eax, [esp+4]
        imul eax, eax
        ret
sys_inc:
        mov  eax, [esp+4]
        inc  eax
        ret

tabela_sys: dd sys_dobro, sys_quadrado, sys_inc
r1: dd 0
r2: dd 0
r3: dd 0
```

:::resumo
- Uma **chamada de sistema** é a passagem controlada do anel 3 para o anel 0. O mecanismo varia: `INT 21h` no DOS (número em AH), `INT 80h` no Linux i386 (número em EAX), e as instruções rápidas `SYSENTER` e `SYSCALL`, que dispensam a IDT.
- O `INT 80h` funciona porque a entrada 0x80 da IDT é um gate com **DPL = 3**; a CPU troca para a pilha do anel 0 pela **TSS**.
- O kernel despacha pelo número numa **tabela de ponteiros para função** e devolve `-ENOSYS` (`-38`) se o número for inválido, para o usuário nunca escolher um índice fora dela.
- **Nunca confie num ponteiro do usuário**: confira que `[ptr, ptr + tamanho)` cabe na parte do usuário e **detecte o estouro** da soma (carry) antes de comparar.
:::
