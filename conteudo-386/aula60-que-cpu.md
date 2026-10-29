---
id: aula60
numero: 60
modulo: 18
titulo: Que processador é este?
subtitulo: Descobrindo 8086, 286, 386 ou 486 pelos bits do registrador de flags
duracao: 60 min
objetivos: entender por que um programa de 32 bits precisa conferir a CPU antes de usar EAX; usar os bits 12 a 15 de FLAGS para separar 8086, 286 e 386; usar o bit AC para separar o 386 do 486 e o bit ID para saber se existe CPUID; ler CR0 no modo real; conhecer as variações 386SX, 386DX e 486SX
---

## Por que perguntar

Um programa que usa `mov eax, 1` num 8086 não dá erro: o 8086 lê o byte 66h como outra instrução e segue executando lixo. Por isso todo programa dos anos 90 que usava o 386 começava conferindo o processador, e dizia "This program requires a 386 or better" em vez de travar. O Windows 3.1 no modo 386 aprimorado, o DOS/4GW (o DOS extender do *Doom*) e o Linux faziam isso.

A Intel só criou uma instrução para perguntar, a **CPUID**, no fim da vida do 486. Antes disso, cada geração era reconhecida por um detalhe de comportamento, quase sempre no registrador de flags.

## Os bits de cima de FLAGS

| Bits | 8086 / 186 | 286 no modo real | 386 |
|---|---|---|---|
| 12-13 (IOPL) | sempre 1 | sempre 0 | o programa pode mudar |
| 14 (NT) | sempre 1 | sempre 0 | o programa pode mudar |
| 15 | sempre 1 | sempre 0 | sempre 0 |

No 8086, os bits 12 a 15 não existem e são lidos como 1. O 286 os criou (IOPL e NT, usados no modo protegido), mas no modo real não deixa mudá-los: ficam em 0. O 386 deixa mudar IOPL e NT também no modo real, e o bit 15 continua reservado, sempre 0.

O teste então tem dois passos: tentar zerar os quatro bits (se continuarem 1111, é um 8086) e tentar ligá-los (se continuarem 0000, é um 286).

## AC e ID: o 486 e a CPUID

O 486 acrescentou o bit **AC** (*alignment check*, bit 18 de EFLAGS). No 386 esse bit não existe: um POPFD que tenta ligá-lo não muda nada. Então: se AC muda, é um 486 ou mais novo.

Os 486 mais novos e o Pentium acrescentaram o bit **ID** (bit 21). Se o programa consegue inverter o ID, a instrução **CPUID** existe, e a partir dali a CPU responde sozinha: fabricante ("GenuineIntel", "AuthenticAMD"), família, modelo e uma lista de recursos. O módulo 28 usa a CPUID.

```nasm executar titulo="CPU.COM: o detector clássico"
        org 100h
        ; 1. 8086/186: os bits 12-15 não zeram
        pushf
        pop ax
        and ax, 0FFFh           ; tenta zerar os bits 12-15
        push ax
        popf
        pushf
        pop ax
        and ax, 0F000h
        cmp ax, 0F000h
        mov dx, msg8086
        je .escreve
        ; 2. 286: os bits 12-15 não ligam
        pushf
        pop ax
        or ax, 0F000h           ; tenta ligar
        push ax
        popf
        pushf
        pop ax
        test ax, 0F000h
        mov dx, msg286
        jz .escreve
        ; 3. daqui em diante, 32 bits valem. 386: o bit AC (18) não muda
        pushfd
        pop eax
        mov ecx, eax            ; guarda o original
        xor eax, 1 << 18
        push eax
        popfd
        pushfd
        pop eax
        push ecx
        popfd                   ; devolve os flags originais
        xor eax, ecx
        test eax, 1 << 18
        mov dx, msg386
        jz .escreve
        ; 4. 486 ou mais: o bit ID (21) diz se existe CPUID
        mov dx, msg486
.escreve:
        mov ah, 9
        int 21h
        mov ax, 4C00h
        int 21h

msg8086: db 'Um 8086 ou 80186', 13, 10, '$'
msg286:  db 'Um 80286', 13, 10, '$'
msg386:  db 'Um 80386', 13, 10, '$'
msg486:  db 'Um 486 ou mais novo', 13, 10, '$'
```

Na máquina do curso a resposta é "Um 80386". O mesmo .COM no DOSBox ou no QEMU diz "486 ou mais novo", porque eles emulam CPUs mais recentes.

:::cpu Por que o 286 vem antes do 386 no teste
Os passos 1 e 2 usam só PUSHF e POPF de 16 bits, que existem em todos. O passo 3 usa PUSHFD e EAX, que só existem do 386 em diante. A ordem do detector é a ordem da história: cada passo só usa o que o passo anterior garantiu.
:::

## CR0 no modo real

O 386 tem registradores de controle, **CR0** a **CR3**. O CR0 é a MSW do 286 aumentada para 32 bits, e dá para lê-lo no modo real com `mov eax, cr0`:

| Bit | Nome | Quer dizer |
|---|---|---|
| 0 | PE | modo protegido ligado |
| 1 | MP | o coprocessador está sendo monitorado (WAIT com TS) |
| 2 | EM | não há coprocessador: as instruções de ponto flutuante viram exceção 7 |
| 3 | TS | houve troca de tarefa (módulo 23) |
| 4 | ET | tipo do coprocessador: 1 = 387 |
| 31 | PG | paginação ligada (módulo 21) |

Na máquina do curso, CR0 começa em **00000010h**: só ET ligado. No módulo 19 você vai ligar o PE, e no 21, o PG.

```quiz
? Um programa tenta ligar os bits 12 a 15 de FLAGS e, ao ler de volta, eles continuam 0000. Qual é a CPU?
- 8086
+ 80286
- 80386
- 486
> No 286, no modo real, esses bits ficam sempre em 0. No 8086 ficam sempre em 1, e no 386 IOPL e NT podem ser ligados.

? Por que o teste do bit AC usa PUSHFD e POPFD, e não PUSHF e POPF?
- Porque PUSHF zera o AC
+ Porque AC é o bit 18: só existe na metade de cima de EFLAGS
- Porque POPF é mais lento
- Por nenhum motivo especial
> PUSHF e POPF mexem só nos 16 bits de baixo. O AC (18) e o ID (21) estão na metade de cima.
```

## As variações do 386 e do 486

- **386DX** (1985): o 386 completo, 32 bits de dados e 32 de endereço.
- **386SX** (1988): o mesmo processador por dentro, com barramento de 16 bits e 24 fios de endereço (16 MB), para placas baratas de 286. Para o programa, é igual a um 386DX.
- **486DX** (1989): um 386 mais rápido com o coprocessador de ponto flutuante e um cache de 8 KB dentro.
- **486SX**: um 486 com o coprocessador desligado. Detectar a diferença exige testar o coprocessador (com `fninit` e `fnstsw`), não os flags.

:::anos90 "Requires a 386"
O *Doom* (1993) precisava de um 386 e de 4 MB de memória, e rodava no modo protegido de 32 bits graças ao DOS/4GW. Um 386SX de 16 MHz rodava o jogo em janela pequena, a uns 10 quadros por segundo. Muita gente comprou um 486 por causa dele.
:::

## Exercícios

```exercicio
id: a60-1
titulo: O que sobra dos bits 12-15
nivel: 1
maquina: 386
modo: com
exigir: POPF PUSHF
--- enunciado
Tente **ligar** os bits 12 a 15 de FLAGS (com PUSHF, OR e POPF), leia FLAGS de volta e guarde em `bits` só os bits 12 a 15 (os outros zerados). Num 386, o resultado mostra quais desses bits existem de verdade.
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
bits:   dw 0FFFFh
--- testes
[{ "nome": "num 386", "espera": { "mem": { "bits:w": 28672 } } }]
--- dicas
pushf / pop ax / or ax, 0F000h / push ax / popf, depois pushf / pop ax de novo.
and ax, 0F000h antes de guardar. O resultado num 386 é 7000h: IOPL = 3, NT = 1 e o bit 15 sempre 0.
--- solucao
        org 100h
        pushf
        pop ax
        or ax, 0F000h
        push ax
        popf
        pushf
        pop ax
        and ax, 0F000h
        mov [bits], ax
        mov ax, 4C00h
        int 21h
bits:   dw 0FFFFh
```

```exercicio
id: a60-2
titulo: É um 486?
nivel: 2
maquina: 386
modo: com
exigir: POPFD PUSHFD
--- enunciado
Teste o bit **AC** (bit 18 de EFLAGS): grave **1** em `e486` se ele puder ser invertido e **0** se não puder. Depois, devolva EFLAGS ao valor original (o teste confere que o bit AC terminou como começou e que a pilha voltou ao lugar).
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
e486:   db 9
--- testes
[{ "nome": "na máquina 386", "espera": { "mem": { "e486:b": 0 }, "pilhaEquilibrada": true } }]
--- dicas
pushfd / pop eax / mov ecx, eax / xor eax, 40000h / push eax / popfd / pushfd / pop eax.
Compare EAX com ECX no bit 18 (xor e test), restaure com push ecx / popfd e grave o resultado com setnz.
--- solucao
        org 100h
        pushfd
        pop eax
        mov ecx, eax
        xor eax, 40000h
        push eax
        popfd
        pushfd
        pop eax
        push ecx
        popfd
        xor eax, ecx
        test eax, 40000h
        setnz [e486]
        mov ax, 4C00h
        int 21h
e486:   db 9
```

:::resumo
- Num 8086, código de 32 bits executa lixo sem dar erro: confira a CPU antes.
- Bits 12-15 de FLAGS: sempre 1 no 8086, sempre 0 no 286 (modo real), IOPL e NT mudam no 386.
- Bit **AC** (18) só existe do 486 em diante; bit **ID** (21) mutável quer dizer que a CPUID existe.
- `mov eax, cr0` funciona no modo real. PE = bit 0, PG = bit 31.
- 386SX e 386DX são iguais para o programa; 486DX e 486SX diferem no coprocessador.
:::
