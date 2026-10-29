---
id: aula59
numero: 59
modulo: 18
titulo: As instruções novas do 386
subtitulo: Bits, SETcc, deslocamentos de precisão dupla e saltos longos
duracao: 75 min
objetivos: testar, ligar, desligar e inverter bits com BT, BTS, BTR e BTC; achar o primeiro e o último bit ligado com BSF e BSR; transformar uma comparação em 0 ou 1 com SETcc; deslocar números de 64 bits com SHLD e SHRD; usar IMUL de dois operandos e saltos condicionais longos
---

## Instruções para bits

Sistemas operacionais vivem de mapas de bits: quais páginas da memória estão livres, quais setores do disco estão usados, quais interrupções estão pendentes. No 8086, testar o bit `n` de uma variável exigia montar uma máscara com deslocamentos. O 386 trouxe quatro instruções que fazem isso direto:

| Instrução | Faz | Depois, CF = |
|---|---|---|
| `bt x, n` | só testa o bit n | o valor do bit |
| `bts x, n` | testa e **liga** | o valor antigo |
| `btr x, n` | testa e **desliga** | o valor antigo |
| `btc x, n` | testa e **inverte** | o valor antigo |

`x` é um registrador ou memória (16 ou 32 bits); `n` é um imediato ou registrador. Com registrador em `n` e memória em `x`, o número do bit pode passar de 31: `bt [mapa], eax` com EAX = 1000 testa o bit 1000 a partir de `mapa`, 125 bytes adiante. É exatamente o que um mapa de páginas livres precisa.

```nasm executar titulo="BITS.COM: um mapa de 64 blocos"
        org 100h
        bts dword [mapa], 5     ; ocupa o bloco 5
        mov eax, 40
        bts [mapa], eax         ; o bloco 40 está no segundo dword: com registrador, o BTS acha sozinho
        bt [mapa], eax          ; CF = 1: ocupado
        setc [b40]
        btr dword [mapa], 5     ; libera o 5; CF = 1 (estava ocupado)
        bt dword [mapa], 5
        setc [b5]               ; agora 0
        mov ax, 4C00h
        int 21h
mapa:   dd 0, 0                 ; 64 bits
b40:    db 0
b5:     db 0
```

:::atencao O número do bit na memória
Com um **imediato**, o número do bit é usado módulo 32 (ou 16): `bts dword [mapa], 40` liga o bit **8** de `mapa`, não o bit 40! O NASM monta sem reclamar, e o erro só aparece quando o programa roda. Para passar de 31, ponha o número num registrador, como no exemplo: `bts [mapa], eax`.
:::

## BSF e BSR: onde está o primeiro bit?

`bsf reg, x` (*bit scan forward*) devolve o número do bit ligado **mais baixo** de `x`; `bsr` (*reverse*), o **mais alto**. Se `x` for zero, ZF = 1 e o destino fica indefinido. `bsr` de um número é a parte inteira do seu logaritmo na base 2.

```nasm executar titulo="LOG2.COM: BSF e BSR"
        org 100h
        mov eax, 01011000b
        bsf ecx, eax            ; ECX = 3: o bit ligado mais baixo
        bsr edx, eax            ; EDX = 6: o mais alto
        mov eax, 1000000
        bsr ebx, eax            ; EBX = 19: 2^19 = 524288 <= 1000000 < 2^20
        mov ax, 4C00h
        int 21h
```

Juntas com BTR, viram um laço que visita cada bit ligado, sem olhar os desligados: `bsf` acha o próximo, `btr` desliga, repete até ZF = 1. É assim que um escalonador acha a próxima tarefa pronta num mapa de prioridades.

## SETcc: uma comparação vira 0 ou 1

`setcc destino` grava **1** num byte se a condição `cc` for verdadeira e **0** se não for. As condições são as mesmas dos saltos: `sete`, `setne`, `setl`, `setg`, `setb`, `seta`, `setc`... É o que um compilador usa para `x = (a < b);` sem nenhum salto.

```nasm executar titulo="MENOR.COM: x = (a < b), com e sem sinal"
        org 100h
        mov eax, [a]
        cmp eax, [b]
        setl [com_sinal]        ; -1 < 5 ? sim: 1
        setb [sem_sinal]        ; FFFFFFFFh < 5 ? não: 0
        mov ax, 4C00h
        int 21h
a:          dd -1
b:          dd 5
com_sinal:  db 0
sem_sinal:  db 0
```

:::cpu Por que evitar saltos?
O 386 busca instruções adiantado. Um salto tomado joga fora a fila e custa 7 ciclos ou mais. Nos processadores com previsão de saltos (do Pentium em diante), um salto difícil de prever custa dezenas de ciclos. SETcc não salta, então custa sempre o mesmo. O 386 ainda não tinha CMOVcc (mover se a condição valer), que veio no Pentium Pro.
:::

## SHLD e SHRD: deslocar dois registradores juntos

`shld a, b, n` desloca `a` para a esquerda `n` bits, e os bits que entram pela direita vêm do **topo de `b`** (que não muda). `shrd` faz o mesmo para a direita. Com isso, deslocar um número de 64 bits em EDX:EAX leva duas instruções:

```nasm fragmento titulo="EDX:EAX deslocado n bits (n < 32 em CL)"
        shld edx, eax, cl       ; a parte alta recebe os bits de cima da baixa
        shl eax, cl             ; depois a baixa anda sozinha
```

Os deslocamentos de precisão dupla também servem para extrair um campo de bits que atravessa o limite entre dois registradores, como os campos de um descritor de segmento (módulo 19).

## IMUL de dois operandos e saltos longos

Mais duas novidades pequenas, mas usadas o tempo todo:

- **`imul reg, r/m`**: `imul ecx, ebx` faz ECX = ECX × EBX (com sinal, só a metade de baixo). Junto com a forma de três operandos do 186, o IMUL virou a multiplicação "normal": qualquer registrador, sem EDX:EAX.
- **Saltos condicionais longos**: no 8086, `je` só alcançava −128 a +127 bytes, e saltos mais longos exigiam inverter a condição e pular um `jmp`. O 386 tem versões com deslocamento de 16 ou 32 bits (opcode 0Fh 8xh). O NASM escolhe sozinho a menor que serve.

```quiz
? Depois de mov eax, 12 (1100b) e bsf ecx, eax, quanto vale ECX?
+ 2
- 3
- 12
- 1
> 12 = 1100b. O bit ligado mais baixo é o 2; o mais alto (BSR) é o 3.

? O que faz bts dword [mapa], 5 se o bit 5 já estava ligado?
- Desliga o bit 5
+ Deixa o bit ligado e põe CF = 1
- Gera uma exceção
- Põe CF = 0
> BTS liga o bit e devolve em CF o valor que ele tinha antes. Com CF = 1, o código sabe que o bloco já estava ocupado.

? Qual instrução grava 1 em AL se a última comparação sem sinal deu "maior"?
- setg al
+ seta al
- setc al
- setnz al
> "Above" (A) é maior sem sinal; "greater" (G) é maior com sinal. Como nos saltos JA e JG.
```

## Exercícios

```exercicio
id: a59-1
titulo: Contar os bits ligados
nivel: 2
maquina: 386
modo: com
exigir: BSF BTR
--- enunciado
Conte quantos bits estão ligados no dword `valor` e guarde em `contagem` (dword). Use o laço BSF + BTR: ache o bit mais baixo, desligue, some 1, até não sobrar nenhum.
--- inicial
        org 100h
        mov eax, [valor]

        mov ax, 4C00h
        int 21h
valor:    dd 10110110b
contagem: dd 0
--- testes
[{ "nome": "10110110b", "espera": { "mem": { "contagem": 5 } } },
 { "nome": "zero", "setup": { "valor": 0 }, "espera": { "mem": { "contagem": 0 } } },
 { "nome": "todos", "setup": { "valor": 4294967295 }, "espera": { "mem": { "contagem": 32 } } },
 { "nome": "80000001h", "setup": { "valor": 2147483649 }, "espera": { "mem": { "contagem": 2 } } }]
--- dicas
bsf ecx, eax põe ZF = 1 quando EAX é zero: use jz para sair.
btr eax, ecx desliga o bit que o BSF achou.
--- solucao
        org 100h
        mov eax, [valor]
        xor edx, edx
.laco:  bsf ecx, eax
        jz .fim
        btr eax, ecx
        inc edx
        jmp .laco
.fim:   mov [contagem], edx
        mov ax, 4C00h
        int 21h
valor:    dd 10110110b
contagem: dd 0
```

```exercicio
id: a59-2
titulo: Comparar sem saltar
nivel: 2
maquina: 386
modo: com
proibir: JE JNE JZ JNZ JL JG JLE JGE JB JA JBE JAE JC JNC JS JNS JMP
--- enunciado
Para os números **com sinal** `a` e `b` (dwords), grave em `menor` 1 se a < b (senão 0), em `igual` 1 se a = b e em `maior` 1 se a > b. Sem nenhum salto.
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
a:      dd 0
b:      dd 0
menor:  db 9
igual:  db 9
maior:  db 9
--- testes
[{ "nome": "3 e 7", "setup": { "a": 3, "b": 7 }, "espera": { "mem": { "menor:b": 1, "igual:b": 0, "maior:b": 0 } } },
 { "nome": "-3 e -7", "setup": { "a": -3, "b": -7 }, "espera": { "mem": { "menor:b": 0, "igual:b": 0, "maior:b": 1 } } },
 { "nome": "iguais", "setup": { "a": 100000, "b": 100000 }, "espera": { "mem": { "menor:b": 0, "igual:b": 1, "maior:b": 0 } } },
 { "nome": "-1 e 1", "setup": { "a": -1, "b": 1 }, "espera": { "mem": { "menor:b": 1, "igual:b": 0, "maior:b": 0 } } }]
--- dicas
Um único cmp basta: os SETcc não mudam os flags.
setl, sete e setg, um em cada variável.
--- solucao
        org 100h
        mov eax, [a]
        cmp eax, [b]
        setl [menor]
        sete [igual]
        setg [maior]
        mov ax, 4C00h
        int 21h
a:      dd 0
b:      dd 0
menor:  db 9
igual:  db 9
maior:  db 9
```

```exercicio
id: a59-3
titulo: Reservar o primeiro bloco livre
nivel: 3
maquina: 386
modo: com
exigir: BSF BTS
--- enunciado
`mapa` é um dword: bit = 1 quer dizer bloco ocupado. Ache o **primeiro bloco livre** (o bit 0 mais baixo), marque-o como ocupado e guarde o número dele em `bloco`. Se não houver bloco livre, guarde **-1** em `bloco` e não mude o mapa. É assim que um kernel reserva páginas de memória.
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
mapa:   dd 00000111b
bloco:  dd 0
--- testes
[{ "nome": "0-2 ocupados", "espera": { "mem": { "bloco": 3, "mapa": 15 } } },
 { "nome": "tudo livre", "setup": { "mapa": 0 }, "espera": { "mem": { "bloco": 0, "mapa": 1 } } },
 { "nome": "buraco no meio", "setup": { "mapa": 4294901759 }, "espera": { "mem": { "bloco": 16, "mapa": 4294967295 } } },
 { "nome": "cheio", "setup": { "mapa": 4294967295 }, "espera": { "mem": { "bloco": -1, "mapa": 4294967295 } } }]
--- dicas
Inverta uma cópia do mapa com not: os livres viram bits 1. Aí o bsf acha o primeiro.
Se o bsf der ZF = 1, o mapa estava cheio. Senão, bts [mapa], ecx marca o bloco.
--- solucao
        org 100h
        mov eax, [mapa]
        not eax
        bsf ecx, eax
        jz .cheio
        bts [mapa], ecx
        mov [bloco], ecx
        jmp .fim
.cheio: mov dword [bloco], -1
.fim:   mov ax, 4C00h
        int 21h
mapa:   dd 00000111b
bloco:  dd 0
```

```exercicio
id: a59-4
titulo: Deslocar 64 bits
nivel: 2
maquina: 386
modo: com
exigir: SHLD
--- enunciado
O número de 64 bits em `baixo` (32 bits de baixo) e `alto` (32 de cima) precisa ser deslocado **CL** bits para a esquerda (CL de 0 a 31). Guarde o resultado de volta nas mesmas variáveis.
--- inicial
        org 100h
        mov eax, [baixo]
        mov edx, [alto]

        mov [baixo], eax
        mov [alto], edx
        mov ax, 4C00h
        int 21h
baixo:  dd 0
alto:   dd 0
--- testes
[{ "nome": "1 << 31", "setup": { "baixo": 1, "alto": 0, "cl": 31 }, "espera": { "mem": { "baixo": 2147483648, "alto": 0 } } },
 { "nome": "80000000h << 1", "setup": { "baixo": 2147483648, "alto": 0, "cl": 1 }, "espera": { "mem": { "baixo": 0, "alto": 1 } } },
 { "nome": "12345678h:9ABCDEF0h << 8", "setup": { "baixo": 2596069104, "alto": 305419896, "cl": 8 }, "espera": { "mem": { "baixo": 3168727040, "alto": 878082202 } } }]
--- dicas
shld edx, eax, cl primeiro (a parte alta recebe os bits de cima de EAX), depois shl eax, cl.
--- solucao
        org 100h
        mov eax, [baixo]
        mov edx, [alto]
        shld edx, eax, cl
        shl eax, cl
        mov [baixo], eax
        mov [alto], edx
        mov ax, 4C00h
        int 21h
baixo:  dd 0
alto:   dd 0
```

:::resumo
- `bt`, `bts`, `btr` e `btc` testam (e ligam, desligam ou invertem) um bit e devolvem o valor antigo em CF. Com o número do bit num registrador, o mapa pode ter qualquer tamanho.
- `bsf` e `bsr` acham o bit ligado mais baixo e o mais alto; ZF = 1 quando o valor é zero.
- `setcc` grava 0 ou 1 num byte conforme a condição, sem saltar.
- `shld` e `shrd` deslocam com os bits vindo de outro registrador: números de 64 bits em duas instruções.
- `imul reg, r/m` multiplica em qualquer registrador; os saltos condicionais alcançam qualquer distância.
:::
