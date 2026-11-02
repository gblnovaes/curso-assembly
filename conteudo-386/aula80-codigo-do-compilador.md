---
id: aula80
numero: 80
modulo: 25
titulo: O código que o compilador gera
subtitulo: Prólogo, epílogo e o quadro de pilha que o C monta em cada função
duracao: 60 min
objetivos: entender o quadro de pilha (stack frame) de uma função C de 32 bits; escrever o prólogo e o epílogo que o compilador emite; localizar argumentos e variáveis locais em relação a EBP; devolver um valor em EAX
---

## O C é Assembly com açúcar

Quem já escreve Assembly tem uma vantagem enorme ao aprender C: dá para **ver através** da linguagem. Cada construção do C vira um punhado de instruções previsíveis. Uma função não é mágica — é um prólogo, um corpo e um epílogo. Um `if` é um `cmp` e um `jcc`. Um `while` é um rótulo e um salto condicional no fim.

Nesta aula olhamos o que o compilador faz com uma função: como ele organiza a pilha para guardar os argumentos, as variáveis locais e o endereço de retorno. Do módulo 17 em diante estamos em 32 bits, então o quadro de pilha é o de um C de 32 bits (como o `gcc -m32` gera).

## O quadro de pilha

Quando uma função C de 32 bits começa a rodar, a pilha tem, de cima (endereço baixo) para baixo (endereço alto):

```diagrama titulo="Quadro de pilha de uma função C de 32 bits (cdecl)"
endereço alto
  ...
  [ebp+12]  — 2º argumento
  [ebp+8]   — 1º argumento
  [ebp+4]   — endereço de retorno (empilhado pelo CALL)
  [ebp+0]   — EBP salvo do chamador  ← EBP aponta aqui
  [ebp-4]   — 1ª variável local
  [ebp-8]   — 2ª variável local
  ...                                 ← ESP aponta no topo das locais
endereço baixo
```

O truque é o registrador **EBP** (base pointer). Ele é fixado no começo da função e serve de âncora: todo argumento e toda variável local é um deslocamento constante a partir de EBP. Isso é importante porque ESP muda o tempo todo (cada `push` de um `CALL` mexe nele), mas EBP fica parado durante a função inteira.

## Prólogo e epílogo

O compilador abre **toda** função com o mesmo par de instruções (o **prólogo**):

```nasm fragmento titulo="O prólogo que o compilador emite"
funcao:
        push ebp            ; salva o EBP do chamador
        mov  ebp, esp       ; fixa EBP no topo atual
        sub  esp, 8         ; reserva 8 bytes para variáveis locais (se houver)
```

E fecha com o **epílogo**:

```nasm fragmento titulo="O epílogo que o compilador emite"
        mov  esp, ebp       ; descarta as locais
        pop  ebp            ; restaura o EBP do chamador
        ret                 ; volta (desempilha o endereço de retorno)
```

O 386 tem uma instrução que faz o epílogo de uma vez: **`leave`** é idêntico a `mov esp, ebp` / `pop ebp`. O compilador usa `leave` quando otimiza.

:::cpu `enter` e `leave`
O 386 trouxe `enter N, 0` (= `push ebp` / `mov ebp, esp` / `sub esp, N`) e `leave`. Na prática os compiladores emitem o prólogo "na mão" (é mais rápido que `enter`, que foi pensado para linguagens com funções aninhadas como Pascal), mas quase sempre usam `leave` no epílogo.
:::

## Uma função completa

Veja o C e o Assembly lado a lado. A função recebe um número e devolve o seu quadrado:

```diagrama titulo="C e o Assembly correspondente"
int quadrado(int n) {        quadrado:
    return n * n;                push ebp
}                                mov  ebp, esp
                                 mov  eax, [ebp+8]   ; eax = n
                                 imul eax, eax       ; eax = n * n
                                 leave               ; (sem locais, mas o padrão é esse)
                                 ret                 ; valor de retorno já está em EAX
```

Três regras aparecem aqui e valem para quase toda função de 32 bits:

1. O **1º argumento** está em `[ebp+8]` (logo acima do endereço de retorno e do EBP salvo).
2. O **valor de retorno** sai em **EAX** (um `int`, um ponteiro, qualquer coisa de até 32 bits).
3. Não há local nenhuma aqui, então o `sub esp` do prólogo é omitido; o `leave` ainda funciona porque `ebp == esp`.

```nasm executar modo="pm32" titulo="CHAMAR.BIN: chamar quadrado(7) e guardar o resultado"
        bits 32
        org 100000h

        push dword 7            ; argumento
        call quadrado
        add  esp, 4            ; o CHAMADOR limpa o argumento (cdecl)
        mov  [resultado], eax  ; EAX = valor de retorno
        cli
        hlt

quadrado:
        push ebp
        mov  ebp, esp
        mov  eax, [ebp+8]      ; eax = n
        imul eax, eax          ; eax = n * n
        leave
        ret

resultado: dd 0
```

:::atencao Quem limpa os argumentos?
Repare no `add esp, 4` depois do `call`. Na convenção **cdecl** (a do C) é o **chamador** quem tira os argumentos da pilha depois que a função volta. Veremos o porquê na [próxima aula](avancado:aula81) — é o que permite funções de número variável de argumentos como o `printf`.
:::

```quiz
? Numa função C de 32 bits, onde está o primeiro argumento?
+ Em [ebp+8], logo acima do endereço de retorno ([ebp+4]) e do EBP salvo ([ebp+0])
- Em [ebp-4], a primeira posição abaixo de EBP
- Sempre em EAX, antes do prólogo
- Em [esp], no topo da pilha durante toda a função

? Para que serve fixar EBP no prólogo?
+ Para ter uma âncora fixa: argumentos e locais ficam em deslocamentos constantes de EBP, mesmo quando ESP muda
- Para zerar as variáveis locais automaticamente
- Porque o CALL exige EBP apontando para o retorno
- Para devolver o valor da função

? O que a instrução `leave` faz?
+ Exatamente `mov esp, ebp` seguido de `pop ebp` — desfaz o quadro de pilha
- Empilha EBP e reserva espaço para locais
- Volta da função, como o RET
- Limpa os argumentos que o chamador empilhou
```

## Exercícios

```exercicio
id: a80-1
titulo: Escrever o prólogo e o epílogo
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Implemente a função `dobro(n)` que devolve `n * 2` em EAX, com o prólogo (`push ebp` / `mov ebp, esp`) e o epílogo (`leave` / `ret`) que o compilador geraria. O chamador já está pronto: empilha o argumento `21`, chama `dobro`, limpa a pilha e guarda EAX em `resultado`. Verifique que `resultado = 42`.
--- inicial
        bits 32
        org 100000h

        push dword 21
        call dobro
        add  esp, 4
        mov  [resultado], eax
        cli
        hlt

dobro:
        ; prólogo

        ; eax = n * 2 (dica: pode usar add eax, eax ou shl eax, 1)

        ; epílogo

resultado: dd 0
--- testes
[{ "nome": "resultado = 42", "espera": { "mem": { "resultado": 42 } } }]
--- dicas
Prólogo: push ebp / mov ebp, esp.
Corpo: mov eax, [ebp+8] / add eax, eax (ou shl eax, 1).
Epílogo: leave / ret.
--- solucao
        bits 32
        org 100000h

        push dword 21
        call dobro
        add  esp, 4
        mov  [resultado], eax
        cli
        hlt

dobro:
        push ebp
        mov  ebp, esp
        mov  eax, [ebp+8]
        add  eax, eax
        leave
        ret

resultado: dd 0
```

```exercicio
id: a80-2
titulo: Uma variável local no quadro de pilha
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Implemente `soma_ate(n)`, que devolve `1 + 2 + ... + n`. Use uma **variável local** em `[ebp-4]` como acumulador (reserve espaço com `sub esp, 4` no prólogo). Inicie o acumulador em 0 e some de 1 a n num laço, depois mova o acumulador para EAX e volte. O chamador empilha `5`, chama, limpa a pilha e guarda EAX em `resultado`. Verifique que `resultado = 15`.
--- inicial
        bits 32
        org 100000h

        push dword 5
        call soma_ate
        add  esp, 4
        mov  [resultado], eax
        cli
        hlt

soma_ate:
        ; prólogo com espaço para 1 local (sub esp, 4)
        ; [ebp-4] = acumulador = 0
        ; ecx = 1; enquanto ecx <= n: [ebp-4] += ecx; ecx++
        ; eax = [ebp-4]
        ; epílogo
        ret

resultado: dd 0
--- testes
[{ "nome": "resultado = 15", "espera": { "mem": { "resultado": 15 } } }]
--- dicas
Prólogo: push ebp / mov ebp, esp / sub esp, 4.
mov dword [ebp-4], 0 / mov ecx, 1.
Laço: .l: cmp ecx, [ebp+8] / jg .fim / add [ebp-4], ecx / inc ecx / jmp .l.
Fim: mov eax, [ebp-4] / leave / ret.
--- solucao
        bits 32
        org 100000h

        push dword 5
        call soma_ate
        add  esp, 4
        mov  [resultado], eax
        cli
        hlt

soma_ate:
        push ebp
        mov  ebp, esp
        sub  esp, 4
        mov  dword [ebp-4], 0
        mov  ecx, 1
.laco:
        cmp  ecx, [ebp+8]
        jg   .fim
        add  [ebp-4], ecx
        inc  ecx
        jmp  .laco
.fim:
        mov  eax, [ebp-4]
        leave
        ret

resultado: dd 0
```

:::resumo
- Cada função C monta um **quadro de pilha** ancorado em **EBP**: argumentos em `[ebp+8]`, `[ebp+12]`...; variáveis locais em `[ebp-4]`, `[ebp-8]`...
- O **prólogo** (`push ebp` / `mov ebp, esp` / `sub esp, N`) reserva o quadro; o **epílogo** (`leave` / `ret`, ou `mov esp, ebp` / `pop ebp` / `ret`) o desfaz.
- O endereço de retorno fica em `[ebp+4]` e o EBP salvo do chamador em `[ebp+0]`.
- O **valor de retorno** de até 32 bits sai em **EAX**.
- Na convenção cdecl é o **chamador** quem limpa os argumentos da pilha depois do `call` (`add esp, N`).
:::
