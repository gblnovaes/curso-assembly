---
id: aula89
numero: 89
modulo: 28
titulo: Depois do 386: a CPUID e a família x86
subtitulo: Do 486 ao Pentium e adiante, e como um programa descobre o que a CPU sabe fazer
duracao: 60 min
objetivos: situar o 486, o Pentium, o Pentium Pro e os processadores de 64 bits na linha do tempo do x86; usar a CPUID para ler o fabricante, a assinatura e os bits de recursos; decodificar família, modelo e passo, inclusive com os campos estendidos
---

## O que veio depois do 386

O 386 de 1985 fixou o x86 de 32 bits, e a Intel passou os vinte anos seguintes acrescentando coisas por cima, sem nunca quebrar o que já existia. Cada geração trouxe instruções e recursos novos:

```diagrama titulo="A linha do tempo depois do 386"
1989  486      FPU e cache de 8 KB dentro do chip, pipeline; BSWAP, CMPXCHG, XADD; flag AC
1993  Pentium  duas instruções por ciclo (superescalar); RDTSC, CPUID, MSRs; depois o MMX
1995  P. Pro   execução fora de ordem; CMOVcc; PAE (36 bits de endereço físico)
1999  P. III   SSE (registradores XMM de 128 bits)
2000  P4       SSE2
2003  AMD64    o modo de 64 bits (Opteron); a Intel o adota em 2004 (Intel 64)
```

A consequência prática é que **um mesmo programa pode rodar em processadores muito diferentes**. Para usar `CMOV` ou `SSE2` com segurança, o programa precisa antes perguntar à CPU se ela os tem. Já vimos, na aula 60, como separar 8086, 286, 386 e 486 pelos bits de FLAGS, e como o bit **ID** (bit 21) mostra se existe a instrução que faz essa pergunta direito: a `CPUID`.

## A instrução CPUID

`CPUID` recebe em **EAX** o número de uma *folha* (*leaf*) e devolve informações em EAX, EBX, ECX e EDX. Cada folha responde a uma pergunta:

```nasm fragmento titulo="CPUID: o fabricante (folha 0)"
        xor   eax, eax        ; folha 0
        cpuid                 ; EAX = maior folha válida
                              ; EBX:EDX:ECX = texto de 12 letras
```

O texto do fabricante vem espalhado em **três** registradores, e a ordem importa: **EBX, EDX, ECX**. Cada registrador guarda quatro letras, em little-endian.

```diagrama titulo="O fabricante em EBX, EDX e ECX"
registrador   conteúdo (hexa)   letras
EBX           756E6547h         G e n u
EDX           49656E69h         i n e I
ECX           6C65746Eh         n t e l
                                ───────────────
                                "GenuineIntel"
(AMD:  EBX "Auth", EDX "enti", ECX "cAMD"  →  "AuthenticAMD")
```

A **folha 1** devolve a *assinatura* do processador em EAX e os bits de recursos em EDX e ECX. Alguns dos bits de EDX:

| Bit de EDX | Recurso |
|---|---|
| 0 | FPU na pastilha |
| 4 | TSC (a instrução `RDTSC`) |
| 5 | MSRs (`RDMSR`/`WRMSR`) |
| 6 | PAE |
| 9 | APIC local |
| 15 | `CMOVcc` |
| 23 | MMX |
| 25 | SSE |
| 26 | SSE2 |

Para saber se o processador tem modo de 64 bits, usa-se uma folha *estendida*: `0x80000001`, e o bit 29 de EDX (o bit **LM**, *long mode*).

:::cpu O simulador é um 386
A máquina desta trilha é um 386, e o 386 **não tem** a instrução `CPUID`: se um programa a executar, o simulador responde com uma exceção #UD e avisa "CPUID veio depois, no 486 e no Pentium". Por isso os exercícios desta aula não executam a instrução; recebem os valores que ela devolveria e fazem o trabalho de **decodificá-los**, que é exatamente o que um programa de verdade faz com o resultado.
:::

## A assinatura: família, modelo e passo

O EAX da folha 1 é uma palavra de 32 bits com vários campos:

```diagrama titulo="CPUID folha 1: o EAX (a assinatura)"
bits  3:0    passo (stepping)
bits  7:4    modelo
bits 11:8    família
bits 19:16   modelo estendido
bits 27:20   família estendida
```

A leitura obedece a duas regras, criadas quando 4 bits de família e de modelo deixaram de bastar:

1. Se a família é **6** ou **15**, o modelo de verdade é `(modelo estendido << 4) | modelo`.
2. Se a família é **15**, a família de verdade é `15 + família estendida`.

Exemplo: a assinatura `0x000306A9` tem família 6, modelo base `0xA`, modelo estendido `3` e passo 9. Como a família é 6, o modelo vale `(3 << 4) | 0xA = 0x3A` (58). Já a assinatura `0x00800F11` tem família base 15 e família estendida 8: a família de verdade é 15 + 8 = **23**, a do primeiro Ryzen da AMD.

```quiz
? Em que ordem a CPUID devolve as 12 letras do fabricante?
+ EBX, EDX e ECX, com quatro letras em cada um
- EAX, EBX e ECX
- EAX, ECX e EDX
- EBX, ECX e EDX

? Por que o simulador desta trilha não consegue executar a CPUID?
+ Ele é um 386, e a CPUID só apareceu no 486 tardio e no Pentium; a instrução gera #UD
- Porque a CPUID é privilegiada e só roda no anel 0
- Porque a CPUID exige o modo de 64 bits
- Porque o simulador não tem registradores de 32 bits

? Uma assinatura tem família base 15 e família estendida 8. Qual é a família que o programa deve mostrar?
+ 23 (15 + 8), pela regra da família estendida
- 8
- 15
- 120 (15 × 8)
```

## Exercícios

```exercicio
id: a89-1
titulo: Montar a string do fabricante
nivel: 2
maquina: 386
modo: pm32
--- enunciado
O simulador não tem `CPUID`, então o programa já recebe os três registradores como a instrução os devolveria para um Intel: `EBX = 756E6547h`, `EDX = 49656E69h` e `ECX = 6C65746Eh`. Grave os três em `vendor`, em **ordem de texto**: EBX nos bytes 0 a 3, EDX nos bytes 4 a 7 e ECX nos bytes 8 a 11. Verifique que `vendor` contém `"GenuineIntel"`.
--- inicial
        bits 32
        org 100000h

        mov  ebx, 0x756E6547
        mov  edx, 0x49656E69
        mov  ecx, 0x6C65746E

        ; grave EBX, EDX e ECX, nesta ordem, em vendor

        cli
        hlt

vendor: times 12 db 0
--- testes
[{ "nome": "vendor = GenuineIntel", "espera": { "mem": { "vendor": "GenuineIntel" } } }]
--- dicas
mov [vendor], ebx / mov [vendor+4], edx / mov [vendor+8], ecx.
A ordem de gravação é EBX, EDX, ECX (e não a ordem numérica dos registradores).
--- solucao
        bits 32
        org 100000h

        mov  ebx, 0x756E6547
        mov  edx, 0x49656E69
        mov  ecx, 0x6C65746E

        mov  [vendor],   ebx
        mov  [vendor+4], edx
        mov  [vendor+8], ecx

        cli
        hlt

vendor: times 12 db 0
```

```exercicio
id: a89-2
titulo: Decodificar família, modelo e passo
nivel: 3
maquina: 386
modo: pm32
--- enunciado
A tabela `sigs` tem quatro assinaturas (EAX da folha 1): `0x00000430`, `0x000306A9`, `0x00000F29` e `0x00800F11`. Para cada uma, decodifique **família**, **modelo** e **passo** com as regras da aula (modelo estendido se a família é 6 ou 15; família estendida se a família é 15) e guarde um byte em `familia`, `modelo` e `passo`. Verifique `familia = [4, 6, 15, 23]`, `modelo = [3, 58, 2, 1]` e `passo = [0, 9, 9, 1]`.
--- inicial
        bits 32
        org 100000h

        xor  esi, esi
.laco:
        mov  eax, [sigs+esi*4]
        ; ebx = família base: (eax >> 8) & 0xF
        ; ecx = modelo base:  (eax >> 4) & 0xF
        ; se a família é 6 ou 15: ecx |= ((eax >> 16) & 0xF) << 4
        ; se a família é 15:      ebx += (eax >> 20) & 0xFF
        ; passo = eax & 0xF
        mov  [familia+esi], bl
        mov  [modelo+esi], cl
        and  eax, 0xF
        mov  [passo+esi], al
        inc  esi
        cmp  esi, 4
        jb   .laco
        cli
        hlt

sigs:    dd 0x00000430, 0x000306A9, 0x00000F29, 0x00800F11
familia: times 4 db 0
modelo:  times 4 db 0
passo:   times 4 db 0
--- testes
[
  { "nome": "familia = [4, 6, 15, 23]", "espera": { "mem": { "familia": [4, 6, 15, 23] } } },
  { "nome": "modelo = [3, 58, 2, 1]", "espera": { "mem": { "modelo": [3, 58, 2, 1] } } },
  { "nome": "passo = [0, 9, 9, 1]", "espera": { "mem": { "passo": [0, 9, 9, 1] } } }
]
--- dicas
mov ebx, eax / shr ebx, 8 / and ebx, 0xF.
mov ecx, eax / shr ecx, 4 / and ecx, 0xF.
cmp ebx, 6 / je .ext / cmp ebx, 15 / jne .semext; no .ext: mov edx, eax / shr edx, 16 / and edx, 0xF / shl edx, 4 / or ecx, edx.
cmp ebx, 15 / jne .semfam / mov edx, eax / shr edx, 20 / and edx, 0xFF / add ebx, edx.
--- solucao
        bits 32
        org 100000h

        xor  esi, esi
.laco:
        mov  eax, [sigs+esi*4]
        mov  ebx, eax
        shr  ebx, 8
        and  ebx, 0xF
        mov  ecx, eax
        shr  ecx, 4
        and  ecx, 0xF
        cmp  ebx, 6
        je   .estende
        cmp  ebx, 15
        jne  .semmodelo
.estende:
        mov  edx, eax
        shr  edx, 16
        and  edx, 0xF
        shl  edx, 4
        or   ecx, edx
.semmodelo:
        cmp  ebx, 15
        jne  .semfamilia
        mov  edx, eax
        shr  edx, 20
        and  edx, 0xFF
        add  ebx, edx
.semfamilia:
        mov  [familia+esi], bl
        mov  [modelo+esi], cl
        and  eax, 0xF
        mov  [passo+esi], al
        inc  esi
        cmp  esi, 4
        jb   .laco
        cli
        hlt

sigs:    dd 0x00000430, 0x000306A9, 0x00000F29, 0x00800F11
familia: times 4 db 0
modelo:  times 4 db 0
passo:   times 4 db 0
```

:::resumo
- Depois do 386 vieram o **486** (FPU e cache no chip), o **Pentium** (superescalar, `RDTSC`, `CPUID`), o **Pentium Pro** (fora de ordem, `CMOV`, PAE), o **SSE** e o **SSE2**, e em 2003 o **AMD64** com o modo de 64 bits.
- Um programa que quer usar um recurso novo deve **perguntar à CPU**: a `CPUID` recebe a folha em EAX e responde em EAX, EBX, ECX e EDX.
- A folha 0 devolve o fabricante em **EBX, EDX, ECX** (`"GenuineIntel"`, `"AuthenticAMD"`); a folha 1 devolve a assinatura em EAX e os bits de recursos (TSC, PAE, APIC, CMOV, MMX, SSE, SSE2...) em EDX e ECX; o bit LM da folha `0x80000001` indica o modo de 64 bits.
- A assinatura tem passo (bits 3:0), modelo (7:4), família (11:8) e os campos estendidos: o modelo estendido vale para famílias 6 e 15, a família estendida só para a 15.
- O 386 não tem `CPUID`; o simulador a recusa com #UD.
:::
