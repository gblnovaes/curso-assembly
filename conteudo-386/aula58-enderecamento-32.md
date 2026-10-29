---
id: aula58
numero: 58
modulo: 18
titulo: Endereços de 32 bits, FS e GS
subtitulo: Qualquer registrador como base, índice com escala e dois segmentos a mais
duracao: 70 min
objetivos: escrever endereços com base, índice multiplicado por 1, 2, 4 ou 8 e deslocamento; saber quando aparece o prefixo 67h; entender por que um endereço de 32 bits ainda esbarra no limite de 64 KB do modo real; usar LEA com escala para fazer contas; usar FS e GS e carregar ponteiros far com LFS, LGS e LSS
---

## Os endereços do 8086 eram apertados

No 8086, um endereço na memória só podia ser montado com **BX ou BP**, mais **SI ou DI**, mais um deslocamento. Oito combinações, nada mais. `mov ax, [cx]` não existia, nem `mov ax, [dx+si]`. E para pegar o elemento `i` de um vetor de palavras era preciso dobrar o índice antes: `shl si, 1`.

O 386 trouxe um formato novo, usado sempre que o endereço tem registradores de 32 bits:

```diagrama titulo="Endereço de 32 bits"
   [ base  +  índice × escala  +  deslocamento ]

   base:          qualquer um dos 8: EAX EBX ECX EDX ESI EDI EBP ESP
   índice:        qualquer um, menos ESP
   escala:        1, 2, 4 ou 8
   deslocamento:  um número de 8 ou de 32 bits (com sinal)
```

Todas as partes são opcionais. Valem `[eax]`, `[ecx+edx]`, `[tabela+ebx*4]`, `[esi+edi*8-12]` e `[ebp+eax*2+100h]`. A escala casa com o tamanho dos elementos: 2 para palavras, 4 para dwords, 8 para qwords. Acabou o `shl` antes de indexar.

```nasm executar titulo="DIAS.COM: tabela de dwords indexada com escala"
        org 100h
        movzx ebx, byte [mes]           ; 1 a 12
        mov eax, [dias + ebx*4 - 4]     ; -4 porque a tabela começa no mês 1
        mov [resposta], eax
        mov ax, 4C00h
        int 21h
mes:      db 9
dias:     dd 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31
resposta: dd 0
```

O segmento padrão continua a regra antiga: endereços com **EBP ou ESP como base** usam SS; os outros usam DS. Um prefixo de segmento troca, como antes: `[es:edi+ecx*2]`.

## O prefixo 67h e o limite de 64 KB

Em código de 16 bits, um endereço com registradores de 32 bits leva o prefixo **67h**, o de tamanho de endereço. O montador põe sozinho. `mov al, [si]` é `8A 04`; `mov al, [esi]` é `67 8A 06`.

Só que estamos no modo real, e no modo real todo segmento tem limite **FFFFh**. O endereço calculado (a soma inteira) precisa caber nesse limite, ou o 386 gera uma exceção: **#GP** (interrupção 0Dh) para os segmentos de dados, **#SS** (0Ch) para a pilha. Um ESI = 10000h não lê o byte 64 K adiante; ele para o programa.

```nasm executar termina="excecao" titulo="LIMITE.COM: 32 bits no endereço não passam de 64 KB"
        org 100h
        mov esi, 0FFFFh
        mov al, [esi]           ; o último byte do segmento: tudo bem
        inc esi                 ; ESI = 10000h
        mov al, [esi]           ; #GP: passa do limite FFFFh
        mov ax, 4C00h
        int 21h
```

O painel mostra o motivo exato. Num PC de verdade seria pior: a BIOS usa o vetor 0Dh para a IRQ 5, a exceção ia parar no lugar errado, e o programa travava. No módulo 19 você vai ver um jeito de passar por cima desse limite, o "unreal mode".

:::cpu Os bytes de um endereço de 32 bits
No 8086, o byte ModR/M sozinho dizia o endereço. No formato de 32 bits, quando há índice, vem um segundo byte, o **SIB** (*scale, index, base*): 2 bits de escala, 3 de índice, 3 de base. `mov eax, [ebx+ecx*4]` é `8B 04 8B`: ModR/M 04h diz "tem SIB", e o SIB 8Bh = 10 001 011 diz escala 4, índice ECX (001), base EBX (011). Por isso ESP não pode ser índice: o código 100 no campo índice quer dizer "sem índice".
:::

## LEA com escala: contas de graça

`lea` calcula o endereço e guarda o número, sem ler a memória. Com o formato de 32 bits, ele virou uma calculadora de somas e multiplicações por 2, 3, 4, 5, 8 e 9, sem mexer nos flags:

| Instrução | Faz |
|---|---|
| `lea eax, [eax+eax*2]` | EAX × 3 |
| `lea eax, [eax+eax*4]` | EAX × 5 |
| `lea eax, [eax*8+eax]` | EAX × 9 |
| `lea ecx, [ebx+esi+10]` | ECX = EBX + ESI + 10 |
| `lea edx, [eax*4]` | EDX = EAX × 4 (com deslocamento 0 de 32 bits) |

Os compiladores usam isso o tempo todo. Multiplicar por 10 vira duas instruções: `lea eax, [eax+eax*4]` (× 5) e `add eax, eax` (× 2).

```quiz
? Qual destes endereços NÃO existe no 386?
- [eax+ebx*8]
- [esp+4]
+ [eax+esp*2]
- [ebp]
> ESP pode ser base, mas não índice: o código dele no campo índice do byte SIB significa "sem índice".

? Num programa do DOS, ESI = 12345h e você executa mov al, [esi]. O que acontece?
- Lê o byte 12345h adiante de DS
- Lê o byte 2345h adiante de DS (o 1 é ignorado)
+ #GP: no modo real o deslocamento não pode passar de FFFFh
- O 386 troca para o modo protegido
> O endereço é calculado com 32 bits e comparado com o limite do segmento, que no modo real é FFFFh.

? Quantas instruções LEA (sem outras) calculam EAX × 25?
- 1
+ 2: lea eax, [eax+eax*4] duas vezes
- 3
- Não dá
> × 5 e depois × 5 de novo. LEA multiplica por 2, 3, 4, 5, 8 ou 9 (base + índice × escala).
```

## FS e GS

O 386 acrescentou dois registradores de segmento, **FS** e **GS**, sem uso padrão: só são usados com prefixo (`[fs:...]`, `[gs:...]`). No DOS, são ótimos para deixar a tela sempre à mão sem gastar ES, que as instruções de cadeia usam.

```nasm executar titulo="FSGS.COM: a tela em FS, cadeias em ES"
        org 100h
        mov ax, 0B800h
        mov fs, ax                      ; FS = tela, para o programa todo
        mov word [fs:0], 2E33h          ; '3' amarelo em verde
        mov word [fs:2], 2E38h          ; '8'
        mov word [fs:4], 2E36h          ; '6'
        push ds
        pop es                          ; ES continua livre para MOVS/STOS
        mov di, copia
        mov si, origem
        mov cx, 5
        rep movsb
        mov ax, 4C00h
        int 21h
origem: db 'FS+GS'
copia:  times 5 db 0
```

Mais tarde, no Windows e no Linux, FS e GS ganharam um papel fixo: apontar para os dados de cada thread. Até hoje, `fs:[0]` no Windows de 32 bits é a lista de tratadores de exceção da thread.

## LFS, LGS e LSS

O 8086 tinha `lds` e `les`: leem um ponteiro far (deslocamento e segmento) da memória e carregam o par de uma vez. O 386 completou com **`lfs`**, **`lgs`** e **`lss`**.

`lss sp, [nova_pilha]` merece atenção. Trocar a pilha com duas instruções (`mov ss, ax` e `mov sp, bx`) tem um momento perigoso entre elas: se uma interrupção chegar ali, ela empilha no SS novo com o SP velho. O 8086 já se protegia disso (depois de um `mov ss`, as interrupções ficam bloqueadas por uma instrução), mas o LSS troca os dois de uma vez e acaba com a dúvida.

```nasm fragmento titulo="Trocando de pilha de uma vez"
        lss sp, [pilha_nova]    ; SP = 1000h, SS = 2000h, juntos
        ...
pilha_nova: dw 1000h, 2000h     ; deslocamento primeiro, depois o segmento
```

## Exercícios

```exercicio
id: a58-1
titulo: Índice com escala
nivel: 1
maquina: 386
modo: com
proibir: SHL MUL IMUL
--- enunciado
`tabela` tem 10 dwords. Copie para `valor` o elemento de índice **BX** (de 0 a 9). Use um endereço com escala, sem multiplicar o índice antes.
--- inicial
        org 100h
        ; valor = tabela[BX]

        mov ax, 4C00h
        int 21h
tabela: dd 0, 1, 4, 9, 16, 25, 36, 49, 64, 81000000
valor:  dd 0
--- testes
[{ "nome": "índice 3", "setup": { "bx": 3 }, "espera": { "mem": { "valor": 9 } } },
 { "nome": "índice 0", "setup": { "bx": 0 }, "espera": { "mem": { "valor": 0 } } },
 { "nome": "índice 9", "setup": { "bx": 9 }, "espera": { "mem": { "valor": 81000000 } } }]
--- dicas
O índice precisa estar num registrador de 32 bits: movzx ebx, bx.
mov eax, [tabela + ebx*4] e mov [valor], eax.
--- solucao
        org 100h
        movzx ebx, bx
        mov eax, [tabela + ebx*4]
        mov [valor], eax
        mov ax, 4C00h
        int 21h
tabela: dd 0, 1, 4, 9, 16, 25, 36, 49, 64, 81000000
valor:  dd 0
```

```exercicio
id: a58-2
titulo: Diagonal de uma matriz
nivel: 2
maquina: 386
modo: com
--- enunciado
`matriz` é uma matriz 4 × 4 de dwords, guardada linha por linha. Some a diagonal principal (os elementos [0][0], [1][1], [2][2] e [3][3]) em `traco`.
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
matriz: dd 1, 2, 3, 4
        dd 5, 6, 7, 8
        dd 9, 10, 11, 12
        dd 13, 14, 15, 16
traco:  dd 0
--- testes
[{ "nome": "1 a 16", "espera": { "mem": { "traco": 34 } } },
 { "nome": "identidade vezes 1000", "setup": { "matriz": [232, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 232, 3, 0, 0] }, "espera": { "mem": { "traco": 4000 } } }]
--- dicas
O elemento [i][i] está no deslocamento (i × 4 + i) × 4 = i × 20 bytes.
Com ESI = i × 4 + i (some 5 a cada volta), o endereço é [matriz + esi*4].
--- solucao
        org 100h
        xor eax, eax
        xor esi, esi
        mov cx, 4
.laco:  add eax, [matriz + esi*4]
        add esi, 5
        loop .laco
        mov [traco], eax
        mov ax, 4C00h
        int 21h
matriz: dd 1, 2, 3, 4
        dd 5, 6, 7, 8
        dd 9, 10, 11, 12
        dd 13, 14, 15, 16
traco:  dd 0
```

```exercicio
id: a58-3
titulo: Multiplicar só com LEA
nivel: 2
maquina: 386
modo: com
exigir: LEA
proibir: MUL IMUL SHL SAL ADD
--- enunciado
Calcule **resultado = x × 45 + 7** usando só LEA (e MOV). Nada de MUL, IMUL, deslocamentos ou ADD.
--- inicial
        org 100h
        mov eax, [x]

        mov [resultado], eax
        mov ax, 4C00h
        int 21h
x:         dd 3
resultado: dd 0
--- testes
[{ "nome": "x = 3", "espera": { "mem": { "resultado": 142 } } },
 { "nome": "x = 1000", "setup": { "x": 1000 }, "espera": { "mem": { "resultado": 45007 } } },
 { "nome": "x = 0", "setup": { "x": 0 }, "espera": { "mem": { "resultado": 7 } } }]
--- dicas
45 = 9 × 5.
lea eax, [eax+eax*8] (× 9), depois lea eax, [eax+eax*4+7] (× 5 e + 7 na mesma instrução).
--- solucao
        org 100h
        mov eax, [x]
        lea eax, [eax+eax*8]
        lea eax, [eax+eax*4+7]
        mov [resultado], eax
        mov ax, 4C00h
        int 21h
x:         dd 3
resultado: dd 0
```

```exercicio
id: a58-4
titulo: Escrever com GS
nivel: 1
maquina: 386
modo: com
--- enunciado
Ponha o segmento da tela (**B800h**) em **GS** e escreva **386** no canto de cima, à esquerda, usando `[gs:...]`. Cor: 1Fh (branco no azul).
--- inicial
        org 100h

        mov ax, 4C00h
        int 21h
--- testes
[{ "nome": "386 na tela", "espera": { "tela": "386", "gs": 47104 } }]
--- dicas
mov ax, 0B800h / mov gs, ax.
Cada caractere é uma palavra: o código no byte de baixo e a cor no de cima: mov word [gs:0], 1F33h.
--- solucao
        org 100h
        mov ax, 0B800h
        mov gs, ax
        mov word [gs:0], 1F33h
        mov word [gs:2], 1F38h
        mov word [gs:4], 1F36h
        mov ax, 4C00h
        int 21h
```

:::resumo
- Endereço de 32 bits: **[base + índice × escala + deslocamento]**, com qualquer registrador como base, qualquer um menos ESP como índice, e escala 1, 2, 4 ou 8.
- Em código de 16 bits, esses endereços levam o prefixo **67h**. No modo real, o resultado ainda precisa ser ≤ FFFFh, ou vem #GP (#SS na pilha).
- `lea` com escala multiplica por 2, 3, 4, 5, 8 e 9 e soma, sem mexer nos flags.
- **FS** e **GS** são segmentos extras, usados só com prefixo. `lfs`, `lgs` e `lss` carregam ponteiros far; `lss` troca a pilha de uma vez.
:::
