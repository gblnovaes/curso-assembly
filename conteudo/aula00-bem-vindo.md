---
id: aula00
numero: 0
modulo: 0
titulo: Bem-vindo ao IBM PC
subtitulo: O 8086, bits, bytes, hexadecimal e o seu primeiro programa
duracao: 45 min
objetivos: entender o que é o 8086 e por que ele ainda importa; contar em binário e hexadecimal sem medo; saber o que são bit, nibble, byte, word e dword; montar e executar seu primeiro programa no simulador
---

## Uma máquina de 1981

Em agosto de 1981 a IBM lançou o **IBM Personal Computer**, modelo 5150. Dentro dele havia um processador **Intel 8088**, irmão do **8086** (lançado em 1978). Os dois executam exatamente as mesmas instruções. A diferença é que o 8086 conversa com a memória 16 bits por vez, e o 8088, para baratear a placa, 8 bits por vez.

Esse conjunto de instruções nunca morreu. Todo PC com processador Intel ou AMD que você usar hoje ainda liga em um modo compatível com o 8086 e ainda entende `MOV AX,BX` com os mesmos bytes de 1978. Aprender o 8086 é aprender a raiz da arquitetura **x86**.

:::anos90 A era de ouro
Nos anos 80 e 90, quem queria velocidade escrevia em Assembly. Jogos como *Prince of Persia*, *Wolfenstein 3D* e boa parte do MS-DOS tinham rotinas críticas escritas à mão. As ferramentas eram o **MASM** (Microsoft Macro Assembler), o **TASM** (Turbo Assembler, da Borland), o **DEBUG.COM** que vinha com o DOS e o **Turbo Debugger**. A documentação era impressa: a "bíblia" era a *Ralf Brown's Interrupt List*, que circulava em disquetes e BBSs.
:::

Este curso recria esse ambiente. Você vai escrever programas reais para DOS em sintaxe **MASM/TASM**, e eles vão rodar em um 8086 simulado, com DOS e BIOS, dentro deste aplicativo. Nada de instruções modernas: só o que existia no chip original.

## O que tem dentro de um computador

Um computador do tipo IBM PC tem três partes que importam para o programador Assembly:

```diagrama titulo="Visão do programador"
  ┌──────────────────┐          barramento           ┌──────────────────────┐
  │   CPU  8086      │◄═════════════════════════════►│   MEMÓRIA  (1 MB)    │
  │                  │   endereço (20 bits)          │  00000h ... FFFFFh   │
  │  registradores   │   dados    (16 bits)          │  programa e dados    │
  │  AX BX CX DX ... │                               │  vídeo em B8000h     │
  │  FLAGS   IP      │◄═════════════════════════════►├──────────────────────┤
  └──────────────────┘                               │  PORTAS DE E/S       │
                                                     │  teclado, timer, som │
                                                     └──────────────────────┘
```

- A **CPU** executa instruções, uma depois da outra. Ela tem poucas "variáveis" internas muito rápidas, chamadas **registradores**.
- A **memória** é uma fileira enorme de bytes numerados de 0 a 1.048.575 (1 MB). Cada número é um **endereço**. O programa e os dados ficam lá.
- As **portas de entrada e saída** ligam a CPU ao teclado, ao relógio, ao alto-falante e a outros dispositivos.

Um programa em Assembly é uma lista de instruções para a CPU, em uma notação legível por humanos. O **montador** (assembler) traduz cada instrução para os bytes de **código de máquina** que a CPU realmente entende.

## Bits e bytes

Tudo dentro do computador é feito de **bits**: um bit vale 0 ou 1. Os bits andam em grupos com nomes próprios:

| Nome | Bits | Faixa sem sinal | Exemplo no 8086 |
|------|------|-----------------|-----------------|
| bit | 1 | 0 a 1 | uma flag, como ZF |
| nibble | 4 | 0 a 15 | um dígito hexadecimal |
| **byte** | 8 | 0 a 255 | AL, AH, um caractere |
| **word** | 16 | 0 a 65.535 | AX, BX, um endereço de offset |
| dword | 32 | 0 a 4.294.967.295 | o par DX:AX |

O 8086 é um processador de **16 bits**: seus registradores principais guardam uma word, e ele faz contas de 16 bits de uma vez.

## Binário: a base 2

Nós contamos em base 10 porque temos dez dedos: cada posição vale dez vezes a anterior (unidades, dezenas, centenas). Em base 2, cada posição vale **duas vezes** a anterior:

```diagrama titulo="O byte 00101010 em base 2"
 posição:   7    6    5    4    3    2    1    0
 vale:     128   64   32   16    8    4    2    1
 bit:        0    0    1    0    1    0    1    0
                       │         │         │
                       32   +    8    +    2   = 42
```

Para converter de binário para decimal, some os valores das posições que têm 1. Para converter de decimal para binário, vá tirando as maiores potências de 2 que cabem: 42 = 32 + 8 + 2, então os bits 5, 3 e 1 ficam ligados.

:::dica Potências de 2 para decorar
1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024... e também 2^16 = 65.536 e 2^20 = 1.048.576 (1 MB). Programadores Assembly sabem essas de cor.
:::

## Hexadecimal: a base 16

Binário é ótimo para a máquina e péssimo para ler. A solução é a **base 16**, o **hexadecimal**. Cada dígito hexa representa exatamente **4 bits** (um nibble), então a conversão é direta:

| Hexa | Binário | Decimal | | Hexa | Binário | Decimal |
|------|---------|---------|-|------|---------|---------|
| 0 | 0000 | 0 | | 8 | 1000 | 8 |
| 1 | 0001 | 1 | | 9 | 1001 | 9 |
| 2 | 0010 | 2 | | A | 1010 | 10 |
| 3 | 0011 | 3 | | B | 1011 | 11 |
| 4 | 0100 | 4 | | C | 1100 | 12 |
| 5 | 0101 | 5 | | D | 1101 | 13 |
| 6 | 0110 | 6 | | E | 1110 | 14 |
| 7 | 0111 | 7 | | F | 1111 | 15 |

Assim, o byte `0010 1010` vira `2A` em hexa: o primeiro nibble é 2, o segundo é A. Uma word de 16 bits vira sempre **4 dígitos hexa**: `1111 0000 0000 1100` é `F00C`.

### Como escrever números no MASM e no TASM

| Escrita | Base | Valor |
|---------|------|-------|
| `42` ou `42d` | decimal | 42 |
| `2Ah` | hexadecimal (sufixo **h**) | 42 |
| `0FFh` | hexadecimal começando com letra: põe um **0** na frente | 255 |
| `00101010b` | binário (sufixo **b**) | 42 |
| `'A'` | código do caractere | 65 |

:::atencao O zero da frente
`FFh` sem o zero é lido como o **nome** de algo (um rótulo chamado FFh), não como número. Todo número hexadecimal que começa com letra precisa de um `0` na frente: `0FFh`, `0B800h`, `0Ah`. E não existe `0x` no MASM: isso é coisa da linguagem C.
:::

Brinque com o conversor abaixo. Digite um número em qualquer base e clique nos bits.

```widget bases
{ "valor": 42, "bits": 8 }
```

## Little-endian: a word ao contrário na memória

A memória é feita de bytes. Quando o 8086 guarda uma word (2 bytes) na memória, ele coloca o **byte menos significativo primeiro**, no endereço menor. Isso se chama **little-endian**.

```diagrama titulo="A word 1234h gravada no endereço 0100h"
  endereço:   0100h   0101h
  conteúdo:    34h     12h
               ▲       ▲
               │       └─ byte alto  (12h)
               └───────── byte baixo (34h) vem primeiro
```

Parece estranho no começo, mas você vai ver isso o tempo todo no dump de memória do depurador. Quando ler `34 12`, pense "1234h".

## Seu primeiro programa

Chega de teoria. Abaixo está um programa completo para DOS. Clique em **▶ Executar aqui** e depois em **► Passo** algumas vezes para ver cada instrução sendo executada. Repare nos registradores que ficam destacados quando mudam.

```asm executar titulo="OLA.ASM"
.MODEL SMALL            ; modelo de memória: um segmento de código e um de dados
.STACK 100h             ; 256 bytes de pilha

.DATA                   ; daqui para baixo: dados
mensagem DB 'Ola, mundo do 8086!', 13, 10, '$'

.CODE                   ; daqui para baixo: instruções
inicio:
        MOV  AX, @DATA      ; AX recebe o endereço do segmento de dados
        MOV  DS, AX         ; DS passa a apontar para os nossos dados

        MOV  AH, 09h        ; função 09h do DOS: imprimir texto
        LEA  DX, mensagem   ; DX recebe o endereço da mensagem
        INT  21h            ; chama o DOS

        MOV  AX, 4C00h      ; função 4Ch do DOS: encerrar o programa
        INT  21h
END inicio              ; fim do código; a execução começa em "inicio"
```

Não se preocupe em entender tudo agora. Cada linha deste programa será explicada em detalhes nas próximas aulas. Por enquanto, repare na estrutura:

- **Diretivas** como `.MODEL`, `.DATA` e `.CODE` são ordens para o montador, não para a CPU. Elas organizam o programa.
- **Instruções** como `MOV` e `INT` viram código de máquina e são executadas pela CPU.
- Tudo depois de `;` é **comentário**. Em Assembly, comente muito: daqui a uma semana você não vai lembrar por que escreveu `MOV AH,09h`.
- `DB` define bytes na memória: o texto, os bytes 13 e 10 (volta para o início da linha e pula linha) e o `$`, que marca o fim do texto para o DOS.

:::dica O laboratório
O botão **Laboratório** abre o mesmo código no depurador completo (tecla **F4**). Lá você vê a memória, a pilha, o código de máquina gerado e a tela do DOS em tamanho real. Use **F9** para executar e **F7** para ir passo a passo.
:::

## Como o curso funciona

Cada aula tem explicações, códigos executáveis, simuladores, um quiz e exercícios. Os exercícios são corrigidos automaticamente: o seu código roda no 8086 simulado e o aplicativo confere registradores, memória e a saída na tela.

O simulador é rigoroso como um 8086 de verdade. Se você escrever algo que só funciona em processadores mais novos, como `SHL AX,2` ou `PUSH 5`, o montador vai recusar e explicar por quê.

```quiz
? Quantos bits tem uma word no 8086?
- 8
+ 16
- 32
> Uma word tem 16 bits (2 bytes). É o tamanho dos registradores AX, BX, CX, DX e dos outros registradores principais do 8086.

? Quanto vale 2Ah em decimal?
- 20
+ 42
- 32
> 2Ah = 2 × 16 + 10 = 42. O dígito A vale 10.

? Por que escrevemos 0FFh em vez de FFh no MASM?
- Porque o 8086 só aceita números com 3 dígitos.
+ Porque um número precisa começar com dígito; FFh sem o zero seria lido como um nome.
- Porque 0FFh é diferente de FFh.
> O montador decide se algo é número ou nome pelo primeiro caractere. 0FFh e FFh seriam o mesmo valor, mas só o primeiro é reconhecido como número.

? A word 0ABCDh está gravada a partir do endereço 200h. Qual byte está no endereço 200h?
- ABh
+ CDh
- 0Ah
> No little-endian o byte menos significativo (CDh) fica no endereço menor. No endereço 201h fica ABh.

? Qual a faixa de valores de um byte sem sinal?
- 0 a 127
+ 0 a 255
- 0 a 65.535
> 8 bits permitem 2^8 = 256 combinações: de 0 a 255.
```

## Exercício

O primeiro exercício é só para conhecer o editor e o verificador. Você vai aprender `MOV` de verdade na próxima aula, mas a ideia é simples: `MOV destino, valor` coloca um valor em um registrador.

```exercicio
id: a00-1
titulo: Escreva o número 42 de três jeitos
nivel: 1
--- enunciado
Complete o programa para que **AX**, **BX** e **CX** terminem todos valendo **42**. Use uma forma diferente em cada um: decimal em AX, hexadecimal em BX e binário em CX.
--- inicial
; Coloque 42 em AX (decimal), BX (hexadecimal) e CX (binário)
        MOV  AX, 42
        MOV  BX, 0      ; troque 0 por 42 em hexadecimal
        MOV  CX, 0      ; troque 0 por 42 em binário
--- testes
[{ "nome": "AX, BX e CX valem 42", "espera": { "AX": 42, "BX": 42, "CX": 42 } }]
--- dicas
42 = 2 × 16 + 10. O dígito hexa que vale 10 é o A.
42 = 32 + 8 + 2, então em 8 bits fica 00101010.
Não esqueça os sufixos: h para hexa e b para binário.
--- solucao
        MOV  AX, 42
        MOV  BX, 2Ah
        MOV  CX, 00101010b
```

```exercicio
id: a00-2
titulo: Hexadecimal que começa com letra
nivel: 1
--- enunciado
Coloque o valor **255** em **AL** e o valor **0B800h** (o endereço da memória de vídeo em modo texto) em **DX**. Escreva os dois em hexadecimal.
--- inicial
        MOV  AL, 0      ; 255 em hexadecimal
        MOV  DX, 0      ; B800 em hexadecimal
--- testes
[{ "nome": "AL = 255 e DX = B800h", "espera": { "AL": 255, "DX": 47104 } }]
--- dicas
255 = FFh, mas um número não pode começar com letra.
--- solucao
        MOV  AL, 0FFh
        MOV  DX, 0B800h
```

:::resumo
- O 8086 é um processador de 16 bits; o IBM PC usava o 8088, que executa as mesmas instruções.
- Byte = 8 bits, word = 16 bits. Um dígito hexa = 4 bits.
- No MASM: `42`, `2Ah`, `0FFh`, `101010b`, `'A'`.
- Words ficam na memória em little-endian: o byte baixo primeiro.
- Diretivas organizam o programa; instruções viram código de máquina.
:::
