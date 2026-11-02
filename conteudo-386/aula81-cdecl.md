---
id: aula81
numero: 81
modulo: 25
titulo: A convenção cdecl
subtitulo: Ordem dos argumentos, quem limpa a pilha e quais registradores a função pode estragar
duracao: 60 min
objetivos: entender a ordem de empilhamento dos argumentos no cdecl; saber por que o chamador limpa a pilha e como isso permite o printf; distinguir registradores caller-saved de callee-saved; escrever uma função que preserva os registradores que o C exige
---

## O contrato entre funções

Uma convenção de chamada é um **contrato**: o chamador e a função chamada combinam onde ficam os argumentos, onde fica o retorno, quem limpa a pilha e quais registradores cada um pode estragar. Se todo mundo segue o mesmo contrato, uma função escrita em C chama outra escrita em Assembly sem nem saber.

A convenção padrão do C de 32 bits no x86 chama-se **cdecl**. Ela tem quatro cláusulas.

## Cláusula 1: argumentos da direita para a esquerda

Os argumentos são empilhados **na ordem inversa** da que aparecem na chamada. Para `soma3(a, b, c)`, o chamador empilha `c`, depois `b`, depois `a`:

```nasm fragmento titulo="Empilhar soma3(10, 20, 30) — da direita para a esquerda"
        push dword 30          ; c (empilhado primeiro)
        push dword 20          ; b
        push dword 10          ; a (empilhado por último, fica no topo)
        call soma3
        add  esp, 12           ; limpa os três argumentos
```

Por que inversa? Assim o **primeiro** argumento fica no endereço **mais baixo**, logo acima do endereço de retorno. Dentro da função:

```
[ebp+8]  — a (1º argumento)
[ebp+12] — b (2º argumento)
[ebp+16] — c (3º argumento)
```

O primeiro argumento está sempre em `[ebp+8]`, não importa quantos venham depois. Isso é a chave da próxima cláusula.

## Cláusula 2: o chamador limpa a pilha

Repare no `add esp, 12` depois do `call`. No cdecl é o **chamador** quem remove os argumentos. Isso parece desperdício (cada chamada repete o `add esp`), mas habilita algo que nenhuma outra convenção faz direito: **funções de número variável de argumentos**.

O `printf("%d %d", x, y)` recebe três argumentos; o `printf("%d", x)` recebe dois. A função `printf` não sabe de antemão quantos vêm — ela descobre lendo a string de formato. Como ela não sabe o total, **não pode** limpar a pilha. Só o chamador sabe quantos empilhou, então só ele pode limpar.

:::anos90 stdcall e o Windows
O Windows adotou a convenção **stdcall** para a API do sistema (`WINAPI`): igual ao cdecl, mas é a **função** que limpa a pilha (com `ret 12`, por exemplo). Isso gera código menor (o `add esp` não se repete em cada chamada), mas proíbe argumentos variáveis — por isso o `wsprintf` do Windows é uma das pouquíssimas funções `cdecl` no meio de uma API `stdcall`.
:::

## Cláusula 3: o retorno em EAX

Um valor de retorno de até 32 bits (um `int`, um `char`, um ponteiro) volta em **EAX**. Um `long long` de 64 bits volta no par **EDX:EAX** (parte alta em EDX). Valores de ponto flutuante voltam no topo da pilha da FPU (`st0`) — assunto de outra aula.

## Cláusula 4: quem pode estragar cada registrador

Esta é a cláusula mais esquecida — e a que mais causa bugs. Os registradores se dividem em dois grupos:

| Grupo | Registradores | Quem garante |
|-------|---------------|--------------|
| **Caller-saved** (voláteis) | EAX, ECX, EDX | O **chamador** salva se precisar deles depois |
| **Callee-saved** (preservados) | EBX, ESI, EDI, EBP (e ESP) | A **função** deve devolvê-los como os recebeu |

Ou seja: a sua função pode usar EAX, ECX e EDX à vontade. Mas se ela usar EBX, ESI ou EDI, precisa **salvá-los no começo e restaurá-los no fim** — senão quebra o chamador, que confiava que esses registradores sobreviveriam à chamada.

```nasm fragmento titulo="Uma função que usa EBX precisa preservá-lo"
funcao:
        push ebp
        mov  ebp, esp
        push ebx            ; EBX é callee-saved: salve antes de usar
        ; ... usa EBX livremente ...
        pop  ebx            ; restaure antes de sair
        leave
        ret
```

```quiz
? Para chamar `f(a, b)` no cdecl, em que ordem o chamador empilha os argumentos?
+ Primeiro b, depois a, de modo que a fique em [ebp+8] e b em [ebp+12]
- Primeiro a, depois b, na ordem em que aparecem
- Os dois de uma vez, com um único push de 8 bytes
- Em registradores (a em EAX, b em EDX), nunca na pilha

? Por que o cdecl faz o chamador limpar a pilha em vez da função?
+ Porque só o chamador sabe quantos argumentos empilhou — é o que permite funções variádicas como printf
- Porque é mais rápido que a função limpar
- Porque a função não tem acesso ao ESP
- Para que o valor de retorno caiba em EAX

? Sua função em Assembly usa ESI no meio de um cálculo. O que o contrato cdecl exige?
+ Salvar ESI no começo (push esi) e restaurá-lo no fim (pop esi), porque ESI é callee-saved
- Nada: ESI é caller-saved, pode estragar à vontade
- Zerar ESI antes de retornar
- Devolver o valor em ESI em vez de EAX
```

## Exercícios

```exercicio
id: a81-1
titulo: Uma função cdecl de três argumentos
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Implemente `conta(a, b, c)` que devolve `a - b - c` em EAX. Lembre que, no cdecl, o 1º argumento (`a`) está em `[ebp+8]`, o 2º (`b`) em `[ebp+12]` e o 3º (`c`) em `[ebp+16]`. O chamador já está pronto: empilha os argumentos na ordem certa para `conta(100, 30, 20)` e guarda EAX em `resultado`. Verifique que `resultado = 50`.
--- inicial
        bits 32
        org 100000h

        push dword 20          ; c
        push dword 30          ; b
        push dword 100         ; a
        call conta
        add  esp, 12
        mov  [resultado], eax
        cli
        hlt

conta:
        ; prólogo
        ; eax = a - b - c
        ; epílogo
        ret

resultado: dd 0
--- testes
[{ "nome": "resultado = 50", "espera": { "mem": { "resultado": 50 } } }]
--- dicas
Prólogo: push ebp / mov ebp, esp.
mov eax, [ebp+8] / sub eax, [ebp+12] / sub eax, [ebp+16].
Epílogo: leave / ret.
--- solucao
        bits 32
        org 100000h

        push dword 20
        push dword 30
        push dword 100
        call conta
        add  esp, 12
        mov  [resultado], eax
        cli
        hlt

conta:
        push ebp
        mov  ebp, esp
        mov  eax, [ebp+8]
        sub  eax, [ebp+12]
        sub  eax, [ebp+16]
        leave
        ret

resultado: dd 0
```

```exercicio
id: a81-2
titulo: Preservar um registrador callee-saved
nivel: 3
maquina: 386
modo: pm32
--- enunciado
O chamador coloca o valor `0xABCD` em EBX, chama `trabalho` e, quando ela volta, guarda EBX em `resultado`. A função `trabalho` **precisa** usar EBX no seu cálculo (some 1+2+...+10 em EBX como acumulador), mas EBX é callee-saved: salve-o no começo (`push ebx`) e restaure-o no fim (`pop ebx`) para não quebrar o chamador. Verifique que `resultado = 0xABCD` (EBX sobreviveu intacto à chamada).
--- inicial
        bits 32
        org 100000h

        mov  ebx, 0xABCD
        call trabalho
        mov  [resultado], ebx
        cli
        hlt

trabalho:
        push ebp
        mov  ebp, esp
        ; salve EBX (callee-saved) antes de usá-lo

        mov  ebx, 0
        mov  ecx, 1
.laco:
        cmp  ecx, 10
        jg   .fim
        add  ebx, ecx
        inc  ecx
        jmp  .laco
.fim:
        ; restaure EBX

        leave
        ret

resultado: dd 0
--- testes
[{ "nome": "resultado = 0xABCD", "espera": { "mem": { "resultado": 43981 } } }]
--- dicas
Logo após mov ebp, esp: push ebx.
Logo antes de leave: pop ebx.
Assim o EBX que a função usou como acumulador é descartado e o do chamador volta.
--- solucao
        bits 32
        org 100000h

        mov  ebx, 0xABCD
        call trabalho
        mov  [resultado], ebx
        cli
        hlt

trabalho:
        push ebp
        mov  ebp, esp
        push ebx
        mov  ebx, 0
        mov  ecx, 1
.laco:
        cmp  ecx, 10
        jg   .fim
        add  ebx, ecx
        inc  ecx
        jmp  .laco
.fim:
        pop  ebx
        leave
        ret

resultado: dd 0
```

:::resumo
- **cdecl** é a convenção de chamada padrão do C de 32 bits.
- Argumentos empilhados **da direita para a esquerda**: o 1º fica em `[ebp+8]`, o 2º em `[ebp+12]`, e assim por diante.
- O **chamador** limpa a pilha (`add esp, N`) depois do `call` — é o que permite funções variádicas como o `printf`.
- Valor de retorno em **EAX** (par **EDX:EAX** para 64 bits).
- **Caller-saved** (EAX, ECX, EDX): a função pode estragar. **Callee-saved** (EBX, ESI, EDI, EBP): a função precisa salvar e restaurar.
:::
