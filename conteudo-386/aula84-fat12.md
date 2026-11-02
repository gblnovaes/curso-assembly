---
id: aula84
numero: 84
modulo: 26
titulo: Drivers e o sistema de arquivos FAT12
subtitulo: O BPB, a tabela de alocação de 12 bits e seguir a cadeia de clusters de um arquivo
duracao: 70 min
objetivos: entender o layout de um disquete FAT12 (BPB, FATs, diretório raiz, dados); decodificar uma entrada de 12 bits da FAT respeitando o caso par e o ímpar; seguir a cadeia de clusters de um arquivo até o marcador de fim
---

## Do driver ao arquivo

Um disco entrega **setores** de 512 bytes numerados — nada mais. Transformar isso em "arquivos com nomes dentro de pastas" é trabalho do **sistema de arquivos**. O mais simples e histórico é o **FAT**, criado pela Microsoft para o disquete e usado até hoje em pendrives e cartões SD. Na variante **FAT12** (a dos disquetes de 1,44 MiB) cada entrada da tabela tem 12 bits.

O driver de disco é a camada de baixo: lê o setor *N* para a memória (no simulador, via um dispositivo; num PC real, via o controlador IDE ou a INT 13h da BIOS). Em cima dele, o código de FAT12 interpreta os bytes.

## O layout de um disquete FAT12

O setor 0 é o **setor de boot**, e dentro dele mora o **BPB** (*BIOS Parameter Block*), que descreve a geometria:

```diagrama titulo="Campos do BPB (dentro do setor de boot)"
offset  tam  campo              valor típico (1,44 MiB)
0x0B    2    bytes por setor    512
0x0D    1    setores/cluster    1
0x0E    2    setores reservados 1        (só o boot)
0x10    1    número de FATs     2
0x11    2    entradas na raiz   224
0x13    2    total de setores   2880
0x16    2    setores por FAT    9
```

A partir desses campos sai o mapa do disco:

```diagrama titulo="Layout de um disquete FAT12 de 1,44 MiB"
setor 0         — boot + BPB
setores 1–9     — FAT 1 (9 setores)
setores 10–18   — FAT 2 (cópia de reserva)
setores 19–32   — diretório raiz (224 entradas × 32 bytes = 14 setores)
setores 33–2879 — região de dados (os clusters começam a contar do 2 aqui)
```

:::cpu Por que os clusters começam no 2?
As entradas 0 e 1 da FAT são reservadas: a 0 guarda o "byte de mídia" e a 1 um marcador. Então o **primeiro cluster de dados é o número 2**, e ele cai no início da região de dados. Para achar o setor de um cluster: `setor = dados_inicio + (cluster - 2) × setores_por_cluster`.
:::

## A FAT de 12 bits

A FAT é um vetor onde a entrada do cluster *N* diz **qual é o próximo cluster** do arquivo (ou um marcador de fim). O detalhe cruel do FAT12 é que cada entrada tem **12 bits** — então dois clusters compartilham três bytes, e a decodificação depende de *N* ser par ou ímpar:

```diagrama titulo="Dois clusters em três bytes"
bytes:    [ b0 ] [ b1 ] [ b2 ]
cluster par   N : (b1 & 0x0F) << 8 | b0        ← 12 bits de baixo
cluster ímpar N+1: b2 << 4 | (b1 >> 4)         ← 12 bits de cima
```

Na prática lê-se a **palavra de 16 bits** no offset `N + N/2` (divisão inteira) e aplica-se a regra:

```diagrama titulo="Decodificar a entrada do cluster N"
offset = N + (N >> 1)           ; = floor(N × 1,5)
w = palavra de 16 bits em FAT[offset]
se N é par:    entrada = w & 0x0FFF
se N é ímpar:  entrada = w >> 4
```

Um valor `≥ 0xFF8` é o marcador de **fim de cadeia** (o arquivo acaba nesse cluster). Valores de `0x002` a `0xFF6` apontam para o próximo cluster.

```quiz
? Por que a decodificação de uma entrada FAT12 depende de o cluster ser par ou ímpar?
+ Cada entrada tem 12 bits e dois clusters dividem três bytes; o par usa os 12 bits de baixo e o ímpar os de cima
- Porque clusters pares ficam na FAT 1 e ímpares na FAT 2
- Porque o disquete alterna a ordem dos bytes
- Porque o BPB guarda só os clusters pares

? Qual é o primeiro cluster de dados num volume FAT?
+ O cluster 2 — as entradas 0 e 1 da FAT são reservadas
- O cluster 0, sempre
- O cluster que o e_entry do ELF indicar
- O primeiro setor depois do boot

? O que significa uma entrada da FAT com valor 0xFFF (≥ 0xFF8)?
+ É o marcador de fim de cadeia: o arquivo termina nesse cluster
- O cluster está livre
- O cluster está defeituoso
- O arquivo continua no cluster 0xFFF
```

## Exercícios

```exercicio
id: a84-1
titulo: Decodificar uma entrada par e uma ímpar
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Em `fat` estão os primeiros bytes de uma FAT12. Decodifique a entrada do **cluster 2** (par) em `ent_par` e a do **cluster 3** (ímpar) em `ent_impar`. Regra: offset = `N + N/2`; leia a palavra de 16 bits em `fat+offset`; se N é par, use `w & 0x0FFF`; se ímpar, use `w >> 4`. Os três bytes das entradas 2 e 3 (offsets 3,4,5) são `23 61 45`. Verifique que `ent_par = 0x123` e `ent_impar = 0x456`.
--- inicial
        bits 32
        org 100000h

        ; cluster 2 (par): offset = 2 + 1 = 3; w = [fat+3]; ent_par = w & 0x0FFF
        ; cluster 3 (ímpar): offset = 3 + 1 = 4; w = [fat+4]; ent_impar = w >> 4

        cli
        hlt

ent_par:   dd 0
ent_impar: dd 0

fat:
        db 0xF0, 0xFF, 0xFF  ; entradas 0 e 1 (reservadas)
        db 0x23, 0x61, 0x45  ; entradas 2 e 3
--- testes
[
  { "nome": "ent_par = 0x123",   "espera": { "mem": { "ent_par": 291 } } },
  { "nome": "ent_impar = 0x456", "espera": { "mem": { "ent_impar": 1110 } } }
]
--- dicas
Par: movzx eax, word [fat+3] / and eax, 0x0FFF / mov [ent_par], eax.
Ímpar: movzx eax, word [fat+4] / shr eax, 4 / mov [ent_impar], eax.
--- solucao
        bits 32
        org 100000h

        movzx eax, word [fat+3]
        and   eax, 0x0FFF
        mov   [ent_par], eax

        movzx eax, word [fat+4]
        shr   eax, 4
        mov   [ent_impar], eax

        cli
        hlt

ent_par:   dd 0
ent_impar: dd 0

fat:
        db 0xF0, 0xFF, 0xFF
        db 0x23, 0x61, 0x45
```

```exercicio
id: a84-2
titulo: Seguir a cadeia de clusters de um arquivo
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Um arquivo ocupa a cadeia de clusters `2 → 3 → 4 → fim`. A FAT em `fat` codifica isso: a entrada 2 vale 3, a 3 vale 4 e a 4 vale `0xFFF` (fim). Começando no cluster 2, siga a cadeia decodificando cada entrada (regra par/ímpar da aula) e conte quantos clusters o arquivo tem, parando quando a entrada for `≥ 0xFF8`. Guarde a contagem em `total`. Verifique que `total = 3`.
--- inicial
        bits 32
        org 100000h

        mov  eax, 2            ; cluster inicial
        xor  ebx, ebx          ; contador
.laco:
        inc  ebx               ; conta este cluster
        ; offset = eax + eax/2
        ; w = [fat+offset]; se eax ímpar: w >>= 4; senão: w &= 0x0FFF
        ; eax = próximo cluster
        ; se eax < 0xFF8, repita
        cli
        hlt

total: dd 0

fat:
        db 0xF0, 0xFF, 0xFF    ; entradas 0,1
        db 0x03, 0x40, 0x00    ; entradas 2 (=3) e 3 (=4)
        db 0xFF, 0x0F, 0x00    ; entradas 4 (=0xFFF) e 5
--- testes
[{ "nome": "total = 3", "espera": { "mem": { "total": 3 } } }]
--- dicas
offset: mov edx, eax / shr edx, 1 / add edx, eax.
w: movzx ecx, word [fat+edx]; test eax,1 / jz .par / shr ecx,4 / jmp .ok / .par: and ecx,0x0FFF / .ok: mov eax, ecx.
cmp eax, 0xFF8 / jb .laco.
--- solucao
        bits 32
        org 100000h

        mov  eax, 2
        xor  ebx, ebx
.laco:
        inc  ebx
        mov  edx, eax
        shr  edx, 1
        add  edx, eax
        movzx ecx, word [fat+edx]
        test eax, 1
        jz   .par
        shr  ecx, 4
        jmp  .ok
.par:
        and  ecx, 0x0FFF
.ok:
        mov  eax, ecx
        cmp  eax, 0xFF8
        jb   .laco
        mov  [total], ebx
        cli
        hlt

total: dd 0

fat:
        db 0xF0, 0xFF, 0xFF
        db 0x03, 0x40, 0x00
        db 0xFF, 0x0F, 0x00
```

:::resumo
- Um disco entrega **setores** de 512 bytes; o **sistema de arquivos** FAT dá a eles nomes e pastas.
- O **BPB**, no setor de boot, descreve a geometria; o disquete tem boot, duas FATs, o diretório raiz e a região de dados.
- Os clusters de dados começam no **número 2** (as entradas 0 e 1 da FAT são reservadas).
- Cada entrada FAT12 tem **12 bits**: lê-se a palavra em `N + N/2` e aplica-se `& 0x0FFF` (par) ou `>> 4` (ímpar).
- Para ler um arquivo, segue-se a **cadeia de clusters** até uma entrada `≥ 0xFF8` (fim de cadeia).
:::
