---
id: aula48
numero: 48
modulo: 16
titulo: Para onde vamos
subtitulo: Do 8086 ao modo protegido do 386
duracao: 40 min
objetivos: entender por que o modo real não basta para um sistema operacional moderno; conhecer a linha do tempo do 8086 ao 486; ver o mapa da trilha avançada; saber o que revisar antes de continuar
---

## O que o 8086 não consegue fazer

Nas aulas 40 a 44 você construiu o MINIOS: um setor de boot, um kernel com a sua própria INT 21h, um sistema de arquivos, um shell e utilitários. Ele funciona. Mas ele tem três limites que nenhuma linha de código consegue tirar, porque estão no próprio processador:

- **Memória.** O 8086 enxerga 1 MB, e só 640 KB são RAM livre. Cada segmento tem no máximo 64 KB. Um programa maior que isso precisa trocar de segmento o tempo todo ([aula 12](aula:aula12)).
- **Proteção.** Qualquer programa pode escrever em qualquer endereço. Um `MOV [0],AX` com DS = 0 destrói o vetor da INT 0, e o sistema inteiro cai. No MINIOS, o COBRA.COM poderia apagar o kernel sem pedir licença.
- **Uma coisa de cada vez.** Não há como o kernel tirar a CPU de um programa que não devolve o controle, nem como dar a cada programa a ilusão de ter a máquina só para ele.

Um sistema como o Linux ou o Windows precisa resolver os três. A Intel resolveu no **modo protegido**, que apareceu no 80286 e ficou completo no **80386**.

:::cpu Modo real é um nome que veio depois
Quando o 286 ganhou o modo protegido, o jeito antigo de funcionar, o do 8086, passou a se chamar **modo real**: os endereços que o programa usa são os endereços reais da memória, só calculados com segmento × 16 + deslocamento. Todo PC ainda liga em modo real, e é o setor de boot, ou o carregador, que passa para o modo protegido.
:::

## A linha do tempo

```diagrama titulo="Do 8086 ao 486"
  1978  8086    16 bits · 1 MB · modo real
  1982  80186   instruções novas (PUSHA, ENTER, BOUND), periféricos no chip
  1982  80286   modo protegido de 16 bits · 16 MB · descritores e anéis
  1985  80386   32 bits · 4 GB · paginação · modo virtual 8086
  1989  80486   cache e FPU no chip · o mesmo modelo de programação do 386
```

O 386 é o ponto de chegada desta trilha. Tudo o que um sistema operacional de 32 bits usa até hoje já estava nele: registradores de 32 bits, segmentos descritos por uma tabela, quatro níveis de privilégio, paginação e troca de tarefas. O Linux, em 1991, foi escrito para um 386.

:::anos90 O 286 que ninguém aproveitou
O modo protegido do 286 tinha um problema: depois de entrar, não havia instrução para voltar ao modo real. Para rodar um programa do DOS de novo, o sistema precisava **reiniciar a CPU** pelo controlador de teclado e retomar de onde estava. O OS/2 1.x fazia isso. O 386 resolveu com o modo virtual 8086, e foi assim que o Windows 3.0 e o EMM386 rodavam vários programas do DOS ao mesmo tempo.
:::

## O mapa da trilha

```diagrama titulo="Trilha avançada"
  16  Programas grandes           .EXE/MZ, PUBLIC/EXTRN, INCLUDE, ferramentas reais
  17  O 186 e o 286               instruções novas, linha A20, HMA
  18  O 386 em modo real          EAX..EDI, FS, GS, prefixos 66h/67h, escala
  ─────────────────────────────── fronteira: CR0.PE = 1 ──────────────────────
  19  Entrando no modo protegido  GDT, descritores, seletores, modelo plano
  20  Interrupções e exceções     IDT, #GP, #PF, 8259 remapeado
  21  Paginação                   CR3, diretório e tabelas, metade alta
  22  Anéis e chamadas de sistema CPL/DPL/RPL, TSS, modo usuário
  23  Multitarefa                 troca de contexto, escalonador
  24  O modo virtual 8086         rodar um .COM dentro do seu kernel
  ─────────────────────────────── um sistema de verdade ─────────────────────
  25  C para quem já sabe Assembly
  26  Um kernel de 32 bits estilo Unix
  27  Desenho de sistemas operacionais
  28  Depois do 386               64 bits, APIC, UEFI
```

Os módulos 16 a 18 ainda moram no modo real e preparam as ferramentas. A partir do 19, cada módulo usa uma peça nova do 386 para resolver um dos três limites do começo desta aula.

## O que revisar antes de continuar

O modo protegido reaproveita quase tudo o que você já sabe, mas cobra os detalhes. Se algum item desta tabela parecer nebuloso, volte à aula antes de seguir:

| Você vai precisar de | Porque no modo protegido... | Reveja |
|---|---|---|
| Segmento × 16 + deslocamento | o registrador de segmento passa a guardar um **seletor**, e o cálculo muda | [aula 12](aula:aula12) |
| Vetores de interrupção e IRET | a tabela de vetores vira a **IDT**, com entradas de 8 bytes | [aulas 14](aula:aula14) e [15](aula:aula15) |
| Quadro de pilha com BP | as exceções empilham um **código de erro** que a rotina precisa tirar | [aula 10](aula:aula10) |
| O 8259 e o EOI | o PIC precisa ser **remapeado**, senão o IRQ0 cai em cima de uma exceção | [aula 15](aula:aula15) |
| Setor de boot e kernel | é o boot que liga o modo protegido | [aulas 40](aula:aula40) e [41](aula:aula41) |
| STRUC | descritores, TSS e tabelas de páginas são registros de bits | [aula 46](aula:aula46) |
| ADD e ADC em 32 bits | o 386 faz em uma instrução o que você faz em duas | [aula 22](aula:aula22) |

## Dois exercícios de aquecimento

Os dois exercícios abaixo são de 8086 puro. O primeiro mostra o trabalho que o 386 vai poupar. O segundo é o cálculo de endereço que o modo protegido vai substituir.

```exercicio
id: a48-1
titulo: Somar dois números de 32 bits
nivel: 1
--- enunciado
**DX:AX** e **CX:BX** guardam dois números de 32 bits sem sinal (a parte alta em DX e em CX). Some os dois e deixe o resultado em **DX:AX**. Não precisa tratar o estouro além de 32 bits.

No 386 isso seria uma instrução só: `ADD EAX,EBX`.
--- inicial
        ; DX:AX = DX:AX + CX:BX
--- testes
[{ "nome": "sem vai-um", "setup": { "DX": 1, "AX": 2, "CX": 3, "BX": 4 }, "espera": { "DX": 4, "AX": 6 } },
 { "nome": "com vai-um da parte baixa", "setup": { "DX": 0, "AX": 65535, "CX": 0, "BX": 1 }, "espera": { "DX": 1, "AX": 0 } },
 { "nome": "12345678h + 0000FFFFh", "setup": { "DX": 4660, "AX": 22136, "CX": 0, "BX": 65535 }, "espera": { "DX": 4661, "AX": 22135 } }]
--- dicas
Some primeiro as partes baixas: ADD AX,BX. Se passar de FFFFh, o CF fica em 1.
Depois some as partes altas levando o vai-um: ADC DX,CX.
--- solucao
        ADD  AX, BX
        ADC  DX, CX
```

```exercicio
id: a48-2
titulo: O endereço físico de 20 bits
nivel: 2
--- enunciado
**AX** tem um segmento e **BX** um deslocamento. Calcule o endereço físico, segmento × 16 + deslocamento, que tem 20 bits, e deixe-o em **DX:AX**: os 4 bits altos em DX e os 16 bits baixos em AX.

Exemplo: 1234h:5678h dá 179B8h, então DX = 0001h e AX = 79B8h.
--- inicial
        ; AX = segmento, BX = deslocamento
        ; DX:AX = segmento * 16 + deslocamento
--- testes
[{ "nome": "1234h:5678h = 179B8h", "setup": { "AX": 4660, "BX": 22136, "DX": 0 }, "espera": { "DX": 1, "AX": 31160 } },
 { "nome": "B800h:0000h = B8000h", "setup": { "AX": 47104, "BX": 0, "DX": 0 }, "espera": { "DX": 11, "AX": 32768 } },
 { "nome": "0000h:7C00h = 07C00h", "setup": { "AX": 0, "BX": 31744, "DX": 5 }, "espera": { "DX": 0, "AX": 31744 } },
 { "nome": "FFFFh:0010h = 100000h (passa de 1 MB)", "setup": { "AX": 65535, "BX": 16, "DX": 0 }, "espera": { "DX": 16, "AX": 0 } }]
--- dicas
Os 4 bits altos do segmento viram a parte alta: MOV DX,AX e depois desloque DX 12 bits para a direita (MOV CL,12 / SHR DX,CL).
A parte baixa é o segmento deslocado 4 bits para a esquerda: MOV CL,4 / SHL AX,CL.
Some o deslocamento em AX e leve o vai-um para DX: ADD AX,BX / ADC DX,0.
--- solucao
        MOV  DX, AX
        MOV  CL, 12
        SHR  DX, CL
        MOV  CL, 4
        SHL  AX, CL
        ADD  AX, BX
        ADC  DX, 0
```

:::cpu FFFFh:0010h e a linha A20
O último teste dá 100000h, um endereço que passa de 1 MB. O 8086 só tem 20 fios de endereço, então ele perde o bit 20 e acessa 00000h. Os PCs com 286 tinham o 21º fio, e a IBM criou um jeito de desligá-lo para os programas antigos continuarem funcionando: a **linha A20**, assunto do módulo 17.
:::

```quiz
? Qual destes limites do MINIOS o modo protegido resolve com a ajuda do hardware?
- O shell ser pequeno
+ Um programa poder apagar o kernel escrevendo na memória dele
- O disquete ter só 1,44 MB
> A proteção de memória é feita pela CPU: no modo protegido, um acesso fora do que o descritor permite gera uma exceção antes de estragar alguma coisa.

? Qual processador trouxe a paginação e o modo virtual 8086?
- 80186
- 80286
+ 80386
> O 286 já tinha descritores e anéis, mas só o 386 trouxe a paginação, os registradores de 32 bits e o modo v86.

? No modo protegido, o que o registrador DS passa a guardar?
- Um endereço físico de 32 bits
+ Um seletor, que aponta para um descritor numa tabela
- O mesmo segmento do modo real, multiplicado por 256
> O seletor indexa a GDT (ou a LDT). O descritor diz onde o segmento começa, qual o tamanho e quem pode usá-lo.
```

:::resumo
- O modo real tem três limites: 1 MB de memória, nenhuma proteção e nenhum jeito de o kernel tomar a CPU de volta.
- O modo protegido do 286 trouxe descritores e anéis; o 386 completou com 32 bits, paginação e o modo v86.
- A trilha vai do modo real (módulos 16 a 18) ao modo protegido (19 a 24) e termina num kernel de 32 bits estilo Unix (25 a 27).
- Antes de seguir, revise segmentos, interrupções, o 8259, o boot e STRUC.
:::
