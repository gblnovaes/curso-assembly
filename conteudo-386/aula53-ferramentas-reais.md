---
id: aula53
numero: 53
modulo: 16
titulo: Ferramentas de verdade
subtitulo: MASM, TASM, LINK, DEBUG, DOSBox e a sintaxe do NASM
duracao: 70 min
objetivos: montar, ligar e depurar um programa com as ferramentas da época; rodar tudo hoje no DOSBox; usar o DEBUG para olhar e remendar um programa; ler e escrever a sintaxe do NASM, que é a usada no resto da trilha; saber traduzir entre MASM e NASM sem mudar um byte do programa
---

## Saindo do simulador

Tudo o que você escreveu até aqui roda num PC real com MS-DOS. O simulador do curso monta a sintaxe do MASM e do TASM, faz o papel do LINK e carrega o programa como o DOS carregaria ([aula 49](avancado:aula49)). Esta aula mostra as ferramentas que faziam esse trabalho de verdade e como usá-las hoje.

Ela também apresenta o **NASM**. A partir do [módulo 19](avancado:aula48), quando o programa sai do DOS e passa a ser um sistema operacional, a trilha usa NASM e um emulador de PC completo: o NASM gera arquivos binários puros (um setor de boot, um kernel) sem precisar de ligador, roda em qualquer sistema e é o montador mais usado em projetos de sistemas operacionais amadores.

## O ciclo editar, montar, ligar, depurar

```diagrama titulo="Do .ASM ao programa rodando"
  PROG.ASM ──► montador ──► PROG.OBJ ──► ligador ──► PROG.EXE ──► depurador
               MASM / TASM               LINK / TLINK              CV / TD
                    │                         │
                    └─► PROG.LST              └─► PROG.MAP
                        (listagem)                (mapa)
```

As linhas de comando das duas famílias:

| Etapa | Microsoft (MASM 5.1) | Borland (TASM 3/4) |
|-------|----------------------|--------------------|
| Montar | `MASM PROG;` | `TASM PROG` |
| Montar com informação para o depurador | `MASM /Zi PROG;` | `TASM /zi PROG` |
| Gerar listagem | `MASM PROG,,PROG.LST;` | `TASM /l PROG` |
| Ligar | `LINK PROG;` | `TLINK PROG` |
| Ligar vários módulos | `LINK PRINC+TELA+NUMEROS;` | `TLINK PRINC TELA NUMEROS` |
| Gerar .COM | `EXE2BIN PROG.EXE PROG.COM` | `TLINK /t PROG` |
| Depurar | `CV PROG` (CodeView) | `TD PROG` (Turbo Debugger) |

O MASM 6 juntou montar e ligar num comando só: `ML PROG.ASM` gera o .EXE, e `ML /AT PROG.ASM` gera um .COM. O ponto e vírgula no fim dos comandos da Microsoft diz "aceite os nomes padrão para o resto" e evita as perguntas pelo nome da listagem e do mapa.

:::anos90 O Turbo Debugger
O TD era a ferramenta que fazia a Borland vender o TASM. Tela cheia em modo texto, janelas de código, registradores, flags, pilha e memória lado a lado, F7 para entrar numa instrução e F8 para passar por cima. O depurador deste curso copia esse jeito de trabalhar. Com `TASM /zi` e `TLINK /v`, o TD mostrava o seu código-fonte com os comentários, não só a desmontagem.
:::

## Rodando hoje: DOSBox

O jeito mais simples de ter um DOS hoje é o **DOSBox** (ou o DOSBox-X, que é mais completo). Ele emula um PC com DOS, e uma pasta do seu computador vira o drive C:.

```texto titulo="Dentro do DOSBox"
  Z:\> MOUNT C C:\DOS          (no Linux ou no Mac: MOUNT C ~/dos)
  Z:\> C:
  C:\> CD TASM
  C:\TASM> TASM OLA
  C:\TASM> TLINK OLA
  C:\TASM> OLA
  Ola, mundo!
```

Para não digitar o MOUNT toda vez, ponha esses comandos na seção `[autoexec]` do arquivo de configuração do DOSBox.

O TASM e o MASM originais são programas comerciais antigos, e não são distribuídos com o DOSBox. Há alternativas livres que montam a mesma sintaxe: o **JWasm** e o seu sucessor **UASM** são compatíveis com o MASM, rodam no DOS, no Windows e no Linux, e geram .OBJ e .EXE. O **FreeDOS**, um DOS livre, traz um DEBUG compatível e roda no DOSBox, no QEMU, no VirtualBox ou num PC antigo de verdade.

## DEBUG: o depurador que vinha com o DOS

Todo MS-DOS trazia o DEBUG.EXE. Ele é tosco perto do TD, mas está sempre lá, e com ele dá para examinar a memória, desmontar código, executar passo a passo e até escrever um .COM pequeno sem montador nenhum. Os comandos são uma letra:

| Comando | Faz |
|---------|-----|
| `R` | mostra os registradores; `R AX` muda AX |
| `D 100` | mostra a memória a partir de DS:0100 (dump) |
| `U 100` | desmonta o código a partir de CS:0100 |
| `A 100` | monta instruções digitadas, a partir de CS:0100 |
| `E 200 41 42` | escreve os bytes 41h e 42h em DS:0200 |
| `T` | executa uma instrução (trace) |
| `P` | executa uma instrução, mas passa por cima de CALL e INT |
| `G 10A` | roda até o endereço CS:010A |
| `N OLA.COM` | dá nome ao arquivo |
| `W` | grava BX:CX bytes a partir de CS:0100 no arquivo |
| `Q` | sai |

Uma sessão inteira, criando um .COM de 8 bytes que escreve um "A":

```texto titulo="Um .COM feito no DEBUG"
  C:\> DEBUG
  -A 100
  0B3E:0100 MOV AH,2
  0B3E:0102 MOV DL,41
  0B3E:0104 INT 21
  0B3E:0106 INT 20
  0B3E:0108
  -R CX
  CX 0000
  :8
  -N LETRA.COM
  -W
  Gravando 00008 bytes
  -Q
  C:\> LETRA
  A
```

Repare que o DEBUG só entende números em hexadecimal, sem o `h`: `MOV DL,41` é 41h, a letra A. O segmento (0B3E aqui) muda de uma máquina para outra; o deslocamento 0100 é sempre o mesmo, porque um .COM começa depois do PSP ([aula 26](aula:aula26)).

```quiz
? No DEBUG, qual a diferença entre T e P numa linha com INT 21?
- Nenhuma, as duas executam uma instrução
+ T entra na rotina da INT 21; P executa a interrupção inteira e para na instrução seguinte
- P só funciona em programas .EXE
> T (trace) segue a CPU para dentro do DOS. P (proceed) é o "passar por cima", como o F8 do Turbo Debugger.

? Antes de W gravar o arquivo, para que serve R CX?
+ Para dizer quantos bytes gravar: o W grava BX:CX bytes a partir de CS:0100
- Para escolher a velocidade da gravação
- Para limpar CX antes de o programa rodar
> O W usa o par BX:CX como tamanho. Num .COM pequeno, BX fica 0 e CX recebe o tamanho em bytes.
```

## NASM: a mesma máquina, outra sintaxe

O NASM monta exatamente as mesmas instruções. O que muda é a escrita, e a mudança mais importante é uma só: **no NASM, um nome sozinho é sempre um endereço; para ler a memória, use colchetes.**

| Quer dizer | MASM / TASM | NASM |
|------------|-------------|------|
| Ler a variável | `MOV AX, valor` | `mov ax, [valor]` |
| Pegar o endereço | `MOV AX, OFFSET valor` | `mov ax, valor` |
| Índice | `MOV AX, tabela[BX]` | `mov ax, [tabela+bx]` |
| Tamanho da memória | `MOV WORD PTR [BX], 1` | `mov word [bx], 1` |
| Segmento explícito | `MOV AL, ES:[DI]` | `mov al, [es:di]` |
| Repetir dados | `buf DB 80 DUP (0)` | `buf times 80 db 0` |
| Reservar sem valor | `buf DB 80 DUP (?)` | `buf resb 80` (seção .bss) |
| Rótulo local | `@@1:` (TASM, com LOCALS) | `.laco:` (local ao último rótulo sem ponto) |
| Procedimento | `nome PROC` ... `nome ENDP` | só o rótulo `nome:` |
| Macro | `nome MACRO a, b` ... `ENDM` | `%macro nome 2` ... `%endmacro` (`%1`, `%2`) |
| Começo de um .COM | `.MODEL TINY` / `ORG 100h` / `END inicio` | `org 100h` (e `nasm -f bin`) |
| Pseudo-variável de tipo | `ASSUME`, `.DATA`, `SEG`, `@DATA` | não existe: o NASM não guarda tipo de variável |

A última linha explica as outras. O MASM lembra que `valor` foi declarado com `DW` e usa isso para escolher o tamanho e para decidir que você quis ler a memória. O NASM não lembra de nada: `valor` é um número, o endereço, e só vira acesso à memória entre colchetes. Isso deixa o código mais explícito e acaba com a pergunta "aqui é o valor ou o endereço?".

O mesmo programa nas duas sintaxes. Os dois geram um .COM com os mesmos bytes, conferido com o NASM 2.16:

```asm executar titulo="TOTAL.ASM em MASM"
        .MODEL TINY
        .CODE
        ORG  100h
inicio: MOV  CX, 5
        XOR  BX, BX
        XOR  AX, AX
soma:   ADD  AX, tabela[BX]
        ADD  BX, 2
        LOOP soma
        MOV  total, AX
        MOV  vezes, 1
        INC  flag
        MOV  AX, 4C00h
        INT  21h
tabela  DW   10, 20, 30, 40, 50
total   DW   0
vezes   DW   0
flag    DB   0
        END  inicio
```

```texto titulo="TOTAL.ASM em NASM (nasm -f bin total.asm -o total.com)"
        org  100h
        mov  cx, 5
        xor  bx, bx
        xor  ax, ax
.soma:  add  ax, [tabela+bx]
        add  bx, 2
        loop .soma
        mov  [total], ax
        mov  word [vezes], 1
        inc  byte [flag]
        mov  ax, 4C00h
        int  21h
tabela  dw   10, 20, 30, 40, 50
total   dw   0
vezes   dw   0
flag    db   0
```

Repare em `mov word [vezes], 1` e `inc byte [flag]`: o NASM não sabe que `vezes` é uma palavra, então quem diz é você. Sem o `word`, o NASM recusa com "operation size not specified".

:::cpu Os mesmos bytes, quase
Comparando byte a byte, os dois arquivos só diferem em duas posições: `XOR BX, BX` vira `33 DB` no MASM e `31 DB` no NASM. As duas codificações são válidas e fazem a mesma coisa. Muitas instruções do 8086 com dois registradores têm duas formas, porque o bit d do opcode diz qual operando é o destino, e com dois registradores qualquer um dos dois pode ir no campo reg do byte ModR/M ([aula 6](aula:aula06)). Cada montador escolhe uma. É um jeito de descobrir com que montador um programa foi feito olhando só o executável.
:::

```quiz
? Em NASM, o que faz mov si, msg?
- Copia para SI a primeira palavra da string msg
+ Copia para SI o endereço de msg
- Dá erro: falta o tamanho
> No NASM, um nome sem colchetes é o endereço, como OFFSET msg no MASM. Para ler o conteúdo seria mov si, [msg].

? Qual é a tradução para MASM de mov byte [es:di], 0?
- MOV ES:DI, 0
+ MOV BYTE PTR ES:[DI], 0
- MOV [ES+DI], 0
> No MASM o segmento vem antes dos colchetes, e o tamanho é BYTE PTR.

? Por que o NASM exige word em mov word [vezes], 1 e o MASM aceita MOV vezes, 1?
+ Porque o NASM não guarda o tipo das variáveis: vezes é só um endereço
- Porque o NASM só trabalha com bytes
- Porque o MASM ignora o tamanho
> O MASM lembra que vezes foi declarada com DW. O NASM não; o tamanho tem que vir na instrução quando nenhum operando é registrador.
```

## Erros que você vai cometer

- **Esquecer os colchetes no NASM.** `mov ax, valor` não dá erro: carrega o endereço. O programa roda e faz a coisa errada.
- **Pôr colchetes demais no MASM.** `MOV AX, [valor]` funciona no MASM igual a `MOV AX, valor`, mas `MOV AX, [5]` no MASM é o número 5, não a memória no endereço 5 (para isso, `DS:[5]`).
- **`mov [bx], 1` no NASM.** Sem `byte` ou `word`, o NASM não sabe o tamanho e recusa.
- **Esquecer o `;` no `MASM PROG;`.** O MASM começa a perguntar o nome de cada arquivo de saída.
- **Gravar no DEBUG sem acertar CX.** O `W` grava o tamanho que estiver em BX:CX, nem que seja 0 ou 40 KB.

## Exercícios

Nos três exercícios, o código inicial traz um programa em NASM, nos comentários. Escreva a versão em MASM, que roda aqui, fazendo exatamente o mesmo.

```exercicio
id: a53-1
titulo: Colchetes e OFFSET
nivel: 1
--- enunciado
Traduza para MASM o trecho em NASM dos comentários. Ele soma a variável `a` com a `b`, guarda em `soma`, e deixa em SI o **endereço** de `b` e em DI o **conteúdo** de `a`.
--- inicial
; Original em NASM:
;       mov  ax, [a]
;       add  ax, [b]
;       mov  [soma], ax
;       mov  si, b
;       mov  di, [a]
        .MODEL SMALL
        .STACK 100h
        .DATA
a       DW 30
b       DW 12
soma    DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; a tradução vem aqui
        MOV  AX, 4C00h
        INT  21h
        END  inicio
--- testes
[{ "nome": "30 + 12", "setup": { "a": 30, "b": 12 }, "espera": { "mem": { "soma": 42 }, "SI": 2, "DI": 30 } },
 { "nome": "1000 + 234", "setup": { "a": 1000, "b": 234 }, "espera": { "mem": { "soma": 1234 }, "SI": 2, "DI": 1000 } }]
--- dicas
Sem colchetes no NASM = OFFSET no MASM.
Com colchetes no NASM = o nome sozinho no MASM: MOV AX, a.
Como a é a primeira variável do .DATA, OFFSET b vale 2.
--- solucao
; Original em NASM:
;       mov  ax, [a]
;       add  ax, [b]
;       mov  [soma], ax
;       mov  si, b
;       mov  di, [a]
        .MODEL SMALL
        .STACK 100h
        .DATA
a       DW 30
b       DW 12
soma    DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, a
        ADD  AX, b
        MOV  soma, AX
        MOV  SI, OFFSET b
        MOV  DI, a
        MOV  AX, 4C00h
        INT  21h
        END  inicio
```

```exercicio
id: a53-2
titulo: Tamanhos e rótulos locais
nivel: 2
--- enunciado
Traduza o laço em NASM dos comentários. Ele conta quantos bytes do vetor `dados` são maiores que 100 (sem sinal) e guarda a contagem em `conta`, uma palavra. O `.laco` e o `.pula` são rótulos locais do NASM: em MASM, use rótulos comuns.
--- inicial
; Original em NASM:
;       mov  word [conta], 0
;       mov  si, dados
;       mov  cx, 8
; .laco:
;       cmp  byte [si], 100
;       jbe  .pula
;       inc  word [conta]
; .pula:
;       inc  si
;       loop .laco
        .MODEL SMALL
        .STACK 100h
        .DATA
dados   DB 5, 200, 101, 100, 0, 255, 99, 150
conta   DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; a tradução vem aqui
        MOV  AX, 4C00h
        INT  21h
        END  inicio
--- testes
[{ "nome": "200, 101, 255, 150", "espera": { "mem": { "conta": 4 } } },
 { "nome": "todos pequenos", "setup": { "dados": [1, 2, 3, 4, 5, 6, 7, 100], "conta": 77 }, "espera": { "mem": { "conta": 0 } } },
 { "nome": "todos grandes", "setup": { "dados": [101, 120, 130, 140, 150, 160, 170, 255] }, "espera": { "mem": { "conta": 8 } } }]
--- dicas
mov word [conta], 0 vira MOV conta, 0 (ou MOV WORD PTR conta, 0).
mov si, dados é o endereço: MOV SI, OFFSET dados.
cmp byte [si], 100 vira CMP BYTE PTR [SI], 100.
--- solucao
; Original em NASM:
;       mov  word [conta], 0
;       mov  si, dados
;       mov  cx, 8
; .laco:
;       cmp  byte [si], 100
;       jbe  .pula
;       inc  word [conta]
; .pula:
;       inc  si
;       loop .laco
        .MODEL SMALL
        .STACK 100h
        .DATA
dados   DB 5, 200, 101, 100, 0, 255, 99, 150
conta   DW ?
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  conta, 0
        MOV  SI, OFFSET dados
        MOV  CX, 8
laco:   CMP  BYTE PTR [SI], 100
        JBE  pula
        INC  conta
pula:   INC  SI
        LOOP laco
        MOV  AX, 4C00h
        INT  21h
        END  inicio
```

```exercicio
id: a53-3
titulo: Um .COM em NASM
nivel: 2
--- enunciado
O programa dos comentários é um .COM completo em NASM, que copia `origem` para `destino` com `rep movsb` e imprime o resultado. Traduza para MASM, como .COM (`.MODEL TINY` e `ORG 100h`).

Repare na macro: no NASM, `%1` é o primeiro parâmetro.
--- inicial
; Original em NASM (nasm -f bin copia.asm -o copia.com):
;       org  100h
; %macro imprime 1
;       mov  dx, %1
;       mov  ah, 09h
;       int  21h
; %endmacro
;       cld
;       mov  si, origem
;       mov  di, destino
;       mov  cx, 6
;       rep  movsb
;       imprime destino
;       mov  ax, 4C00h
;       int  21h
; origem  db 'COPIA$'
; destino times 6 db '?'
        .MODEL TINY
        .CODE
        ORG  100h
inicio:
        ; a tradução vem aqui
        END  inicio
--- testes
[{ "nome": "imprime COPIA", "espera": { "saida": "COPIA" } }]
--- dicas
A macro em MASM: imprime MACRO texto / MOV DX, OFFSET texto / ... / ENDM.
Num .COM, os dados podem ficar depois do código, no mesmo segmento: só não deixe a CPU cair neles (o INT 21h com 4Ch vem antes).
times 6 db '?' vira DB 6 DUP ('?').
--- solucao
; Original em NASM (nasm -f bin copia.asm -o copia.com):
;       org  100h
; %macro imprime 1
;       mov  dx, %1
;       mov  ah, 09h
;       int  21h
; %endmacro
;       cld
;       mov  si, origem
;       mov  di, destino
;       mov  cx, 6
;       rep  movsb
;       imprime destino
;       mov  ax, 4C00h
;       int  21h
; origem  db 'COPIA$'
; destino times 6 db '?'
        .MODEL TINY
        .CODE
        ORG  100h
imprime MACRO texto
        MOV  DX, OFFSET texto
        MOV  AH, 09h
        INT  21h
        ENDM
inicio: CLD
        MOV  SI, OFFSET origem
        MOV  DI, OFFSET destino
        MOV  CX, 6
        REP  MOVSB
        imprime destino
        MOV  AX, 4C00h
        INT  21h
origem  DB 'COPIA$'
destino DB 6 DUP ('?')
        END  inicio
```

:::resumo
- MASM: `MASM PROG;` e `LINK PROG;` (ou `ML PROG.ASM` no MASM 6). TASM: `TASM PROG` e `TLINK PROG` (`/t` para .COM, `/zi` e `/v` para o Turbo Debugger).
- DOSBox emula um PC com DOS; `MOUNT C pasta` transforma uma pasta sua no drive C:. JWasm/UASM e FreeDOS são alternativas livres.
- DEBUG: R, D, U, A, E, T, P, G, N, W, Q. Tudo em hexadecimal, sem o `h`.
- NASM: nome sozinho é endereço; memória vai entre colchetes; o tamanho (`byte`, `word`) vem na instrução; não há PROC, ASSUME nem tipo de variável.
- Os dois montadores geram as mesmas instruções; às vezes escolhem codificações diferentes para a mesma instrução.
:::
