---
id: aula05b
numero: 5.5
rotulo: 5B
modulo: 2
titulo: Lógica bit a bit e deslocamentos
subtitulo: AND, OR, XOR, NOT, TEST, SHL, SHR, SAR e as rotações
duracao: 70 min
objetivos: ligar, desligar e inverter bits escolhidos com OR, AND e XOR; testar bits sem estragar o valor com TEST; multiplicar e dividir por potências de 2 com SHL, SHR e SAR; girar bits com ROL, ROR, RCL e RCR; extrair um campo de bits com deslocamento e máscara
prerequisitos: aula04; aula05
---

## Por que mexer em bits

Até aqui cada registrador guardou **um número**. Mas no PC muita coisa é um **pacote de bits**: o registrador de FLAGS da [Aula 4](aula:aula04), o byte de cor de cada caractere na tela (frente em 4 bits, fundo em 3, piscar em 1), o estado das teclas Shift e Caps Lock, os bits de controle das portas de hardware. Para trabalhar com eles, o 8086 tem dois grupos de instruções:

- **lógicas** (`AND`, `OR`, `XOR`, `NOT`, `TEST`): operam bit a bit, cada bit do resultado depende só dos bits na mesma posição;
- **deslocamentos e rotações** (`SHL`, `SHR`, `SAR`, `ROL`, `ROR`, `RCL`, `RCR`): empurram os bits para os lados.

Os dois grupos são baratos (2 a 3 ciclos com registradores) e aparecem em quase todo programa de verdade.

## AND, OR, XOR e NOT

Cada operação lógica olha para um par de bits por vez:

```diagrama titulo="Tabela de cada operação, bit a bit"
  a b │ a AND b   a OR b   a XOR b        a │ NOT a
 ─────┼───────────────────────────      ────┼──────
  0 0 │    0        0        0            0 │   1
  0 1 │    0        1        1            1 │   0
  1 0 │    0        1        1
  1 1 │    1        1        0
```

A forma é a mesma de `ADD`: `AND destino, fonte`, com o resultado no destino. O segredo para usá-las é pensar no segundo operando como uma **máscara**, um número escolhido para dizer quais bits serão afetados:

| Quero... | Use | Máscara | Exemplo |
|---|---|---|---|
| **desligar** bits | `AND` | 0 nos bits a desligar, 1 no resto | `AND AL, 0F0h` apaga os 4 bits de baixo |
| **ligar** bits | `OR` | 1 nos bits a ligar, 0 no resto | `OR AL, 80h` liga o bit 7 |
| **inverter** bits | `XOR` | 1 nos bits a inverter | `XOR AL, 01h` troca o bit 0 |
| inverter **todos** | `NOT` | (não tem) | `NOT AL` |

```asm executar titulo="Máscaras em ação"
        MOV  AL, 10110110b
        AND  AL, 11110000b   ; desliga os 4 bits de baixo -> 10110000b
        OR   AL, 00000101b   ; liga os bits 0 e 2         -> 10110101b
        XOR  AL, 11111111b   ; inverte tudo               -> 01001010b
        NOT  AL              ; inverte de novo            -> 10110101b
        XOR  BX, BX          ; um valor XOR ele mesmo é 0: BX = 0
```

A última linha é um idioma clássico: `XOR BX, BX` zera o registrador em 2 bytes, contra 3 de `MOV BX, 0`. Você vai vê-la em todo código dos anos 90.

Experimente as operações no simulador abaixo. Os bits que mudaram ficam marcados:

```widget bits
{ "op": "AND", "a": "10110110b", "b": "00001111b", "bits": 8 }
```

:::dica Letras maiúsculas e minúsculas
Em ASCII, 'A' é 41h (0100 0001b) e 'a' é 61h (0110 0001b). A única diferença é o **bit 5** (20h). Por isso `AND AL, 0DFh` (todos os bits ligados menos o 5) vira qualquer letra em maiúscula, `OR AL, 20h` vira em minúscula e `XOR AL, 20h` troca a caixa.
:::

### O que acontece com as flags

`AND`, `OR`, `XOR` e `TEST` **sempre zeram CF e OF** e ajustam ZF, SF e PF pelo resultado. `NOT` não mexe em nenhuma flag. Isso dá outro idioma: `OR AX, AX` (ou `TEST AX, AX`) não muda AX, mas liga ZF se AX for zero e SF se for negativo.

## TEST: perguntar sem estragar

Muitas vezes você só quer **saber** se um bit está ligado, sem alterar o valor. `TEST` faz um `AND`, ajusta as flags e **joga o resultado fora**, do mesmo jeito que `CMP` faz uma subtração e joga fora.

```asm executar titulo="O bit 0 diz se o número é par"
        MOV  AX, 37
        MOV  BX, 0           ; BX = 0 quer dizer "par"
        TEST AX, 1           ; AND com 0000...0001, só para as flags
        JZ   fim             ; ZF = 1: o bit 0 estava desligado, é par
        MOV  BX, 1           ; ímpar
fim:                         ; AX continua 37, BX = 1
```

A leitura é: depois de `TEST valor, máscara`, **ZF = 1** quer dizer "nenhum dos bits da máscara estava ligado" (salte com `JZ`), e **ZF = 0** quer dizer "pelo menos um estava" (salte com `JNZ`).

## Deslocamentos: SHL, SHR e SAR

`SHL destino, 1` empurra todos os bits uma casa para a **esquerda**. Entra um 0 no bit 0 e o bit que cai do lado de cima vai para **CF**. `SHR` faz o contrário, para a direita, com o bit 0 indo para CF.

```diagrama titulo="Uma casa de deslocamento em 8 bits"
 SHL AL,1     CF ◄── [7 6 5 4 3 2 1 0] ◄── 0

 SHR AL,1     0 ──► [7 6 5 4 3 2 1 0] ──► CF

 SAR AL,1     ┌─►[7 6 5 4 3 2 1 0] ──► CF
              └───┘  (o bit 7 é copiado nele mesmo)
```

Em binário, andar uma casa para a esquerda **multiplica por 2**, assim como em decimal acrescentar um zero multiplica por 10. Andar para a direita **divide por 2** e o resto (o bit que saiu) fica em CF.

:::atencao No 8086, mais de uma casa só com CL
O 8086 aceita só duas formas: `SHL AX, 1` e `SHL AX, CL`. Para deslocar 3 casas, coloque 3 em CL: `MOV CL, 3` / `SHL AX, CL`. A forma `SHL AX, 3` só apareceu no 80186, e o montador do curso recusa e explica.
:::

```asm executar titulo="Multiplicar e dividir por potências de 2"
        MOV  AX, 13
        SHL  AX, 1           ; 26  (x 2)
        MOV  CL, 3
        SHL  AX, CL          ; 208 (x 8)
        SHR  AX, 1           ; 104 (/ 2)
        MOV  BX, 100
        SHR  BX, CL          ; 100 / 8 = 12, o resto se perde
```

`SAR` (deslocamento aritmético) também anda para a direita, mas **copia o bit de sinal** em vez de entrar 0. Com isso ele divide por 2 números **com sinal**: −8 vira −4. `SHR` trataria o mesmo padrão de bits como um número grande sem sinal. A [Aula 22](aula:aula22) explica os números negativos a fundo; por ora guarde: `SHR` para sem sinal, `SAR` para com sinal. (`SAL` existe, mas é só outro nome para `SHL`.)

Juntando deslocamentos e somas dá para multiplicar por qualquer constante, muito mais rápido que `MUL`: x × 10 = x × 8 + x × 2.

```asm executar titulo="AX vezes 10 com deslocamentos"
        MOV  AX, 123
        SHL  AX, 1           ; 2x
        MOV  BX, AX          ; guarda 2x
        SHL  AX, 1           ; 4x
        SHL  AX, 1           ; 8x
        ADD  AX, BX          ; 8x + 2x = 10x -> 1230
```

## Rotações: ROL, ROR, RCL e RCR

Uma rotação é um deslocamento em que **nada se perde**: o bit que sai de um lado entra do outro.

```diagrama titulo="As quatro rotações"
 ROL   ┌─[7 ◄─────────── 0]◄─┐       o bit 7 entra no 0 (e vai para CF)
       └─────────────────────┘

 ROR   ┌─►[7 ───────────► 0]─┐       o bit 0 entra no 7 (e vai para CF)
       └─────────────────────┘

 RCL   ┌─[CF]◄─[7 ◄──── 0]◄─┐       9 bits girando: CF faz parte da roda
       └────────────────────┘

 RCR   ┌─►[CF]─►[7 ────► 0]─┐
       └────────────────────┘
```

Usos típicos:

- `ROL AL, CL` com CL = 4 **troca os dois nibbles** de AL (3Ch vira C3h).
- `ROL AX, 1` dezesseis vezes percorre todos os bits e devolve AX intacto no fim, cada bit passando por CF.
- `RCL` e `RCR` emendam deslocamentos de vários registradores, porque o bit que sai de um entra no outro via CF.

```asm executar titulo="Dobrar um número de 32 bits em DX:AX"
        MOV  DX, 0001h       ; DX:AX = 0001 8000h = 98304
        MOV  AX, 8000h
        SHL  AX, 1           ; bit 15 de AX vai para CF; AX = 0000h
        RCL  DX, 1           ; DX recebe CF embaixo:     DX = 0003h
                             ; DX:AX = 0003 0000h = 196608
```

É o mesmo truque de `ADD`/`ADC` da [Aula 3](aula:aula03): a parte baixa gera o bit extra em CF e a parte alta o recebe.

## Extraindo um campo de bits

O byte de atributo da tela de texto guarda três informações:

```diagrama titulo="Byte de atributo (modo texto)"
   bit:   7   6 5 4   3 2 1 0
        ┌───┬───────┬─────────┐
        │ P │ fundo │ frente  │      P = piscar
        └───┴───────┴─────────┘
  1Eh = 0   001     1110        -> fundo azul (1), frente amarela (14)
```

Para pegar um campo do meio: **desloque** até o campo chegar no bit 0 e **apague** o resto com `AND`.

```asm executar titulo="Separando o atributo 1Eh"
        MOV  AL, 1Eh
        MOV  BL, AL
        AND  BL, 0Fh         ; frente: bits 0-3 -> BL = 0Eh
        MOV  BH, AL
        MOV  CL, 4
        SHR  BH, CL          ; traz os bits 4-7 para baixo
        AND  BH, 07h         ; fica só com o fundo (bits 4-6) -> BH = 1
```

Montar um campo é o caminho inverso: desloque para a esquerda até a posição e junte com `OR`.

## Imprimindo um número em binário

Este programa junta tudo: `SHL` tira um bit por vez para CF, e `ADC DL, 0` transforma CF no caractere '0' ou '1' ('0' + 0 ou '0' + 1). A função 02h da INT 21h imprime o caractere que está em DL (as funções do DOS são o assunto da [Aula 14](aula:aula14)).

```asm executar titulo="BINARIO.ASM: imprime uma word em binário"
.MODEL SMALL
.STACK 100h
.DATA
valor   DW 0B5A3h
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  BX, valor
        MOV  CX, 16          ; 16 bits
prox:   MOV  DL, '0'
        SHL  BX, 1           ; o bit 15 vai para CF
        ADC  DL, 0           ; DL = '0' + CF
        MOV  AH, 02h         ; DOS: imprime o caractere em DL
        INT  21h
        LOOP prox
        MOV  AX, 4C00h
        INT  21h
END inicio
```

A saída é `1011010110100011`. `LOOP` repete o laço CX vezes; ele é o assunto da [Aula 7](aula:aula07).

:::anos90 Bits por todo lado
A BIOS guarda em 0040:0017h um byte com o estado das teclas especiais: bit 0 Shift direito, bit 1 Shift esquerdo, bit 2 Ctrl, bit 3 Alt, bit 6 Caps Lock. Programas residentes que mudavam o comportamento com Ctrl+Alt faziam exatamente `TEST byte, 0Ch`. Os jogos guardavam fases inteiras em bits (um bit por tijolo, como na [Aula 37](aula:aula37)) para caber na memória.
:::

:::cpu Por dentro do 8086
`SHL reg, CL` gasta 8 ciclos mais 4 por casa deslocada, então deslocar 4 casas com CL custa 24 ciclos, enquanto quatro `SHL reg, 1` custam 8. Para poucas casas, repetir a forma de 1 é mais rápido; a [Aula 16](aula:aula16) volta a esse assunto.
:::

```previsao titulo="Máscara e deslocamento" perguntar="AL CF"
        MOV  AL, 0B6h
        AND  AL, 0Fh
        OR   AL, 80h
        MOV  CL, 2
        SHL  AL, CL
```

```quiz
? Qual instrução desliga só o bit 7 de AL e mantém os outros?
- OR AL, 80h
+ AND AL, 7Fh
- XOR AL, 7Fh
> 7Fh = 0111 1111b: o 0 no bit 7 apaga esse bit, os 1 preservam os demais.

? Depois de TEST AL, 08h, o que quer dizer ZF = 1?
+ O bit 3 de AL estava desligado.
- O bit 3 de AL estava ligado.
- AL ficou igual a zero.
> TEST faz o AND sem guardar. ZF = 1 quer dizer que o AND deu zero, ou seja, o bit 3 estava desligado. AL não muda.

? Quanto vale AX depois de MOV AX,5 / MOV CL,3 / SHL AX,CL?
- 15
- 8
+ 40
> Três casas para a esquerda multiplicam por 2 × 2 × 2 = 8: 5 × 8 = 40.

? Qual destas linhas o 8086 NÃO aceita?
- SHL AX, 1
- SHR BL, CL
+ SHL AX, 4
> No 8086 o contador é 1 ou CL. Deslocamento por número maior que 1 só surgiu no 80186.

? Para dividir por 2 um número com sinal (por exemplo, −20), qual instrução usar?
- SHR
+ SAR
- ROR
> SAR copia o bit de sinal, então o negativo continua negativo: −20 vira −10.

? Qual é a diferença entre ROL e RCL?
- ROL só funciona em 8 bits.
+ RCL inclui o CF na roda; ROL gira só os bits do registrador.
- Nenhuma, são sinônimos.
> Em RCL o bit que sai vai para CF e o CF antigo entra do outro lado: 9 ou 17 bits girando.
```

## Exercícios

```exercicio
id: a05b-1
titulo: Maiúscula e minúscula
nivel: 1
proibir: ADD, SUB, CMP
--- enunciado
**AL** traz uma letra, que pode ser maiúscula ou minúscula. Coloque em **BL** a versão **maiúscula** e em **BH** a versão **minúscula**, usando só operações lógicas (sem somar, subtrair ou comparar).
--- inicial
; BL = maiúscula de AL, BH = minúscula de AL
--- testes
[
 { "nome": "'a'", "setup": { "AL": 97 }, "espera": { "BL": 65, "BH": 97 } },
 { "nome": "'Q'", "setup": { "AL": 81 }, "espera": { "BL": 81, "BH": 113 } },
 { "nome": "'z'", "setup": { "AL": 122 }, "espera": { "BL": 90, "BH": 122 } },
 { "nome": "'M'", "setup": { "AL": 77 }, "espera": { "BL": 77, "BH": 109 } }
]
--- dicas
A diferença entre maiúscula e minúscula é o bit 5 (20h).
Para desligar o bit 5 use AND com 0DFh; para ligá-lo use OR com 20h.
--- solucao
        MOV  BL, AL
        AND  BL, 0DFh
        MOV  BH, AL
        OR   BH, 20h
```

```exercicio
id: a05b-2
titulo: O bit 3 está ligado?
nivel: 1
exigir: TEST
--- enunciado
Coloque **CX = 1** se o bit 3 de **AX** estiver ligado e **CX = 0** se estiver desligado. AX não pode mudar.
--- inicial
; CX = bit 3 de AX (0 ou 1)
--- testes
[
 { "nome": "AX = 8 (só o bit 3)", "setup": { "AX": 8 }, "espera": { "CX": 1, "AX": 8 } },
 { "nome": "AX = 7 (bits 0 a 2)", "setup": { "AX": 7, "CX": 9 }, "espera": { "CX": 0, "AX": 7 } },
 { "nome": "AX = FFFFh", "setup": { "AX": 65535 }, "espera": { "CX": 1, "AX": 65535 } },
 { "nome": "AX = FFF7h (todos menos o 3)", "setup": { "AX": 65527, "CX": 5 }, "espera": { "CX": 0, "AX": 65527 } }
]
--- dicas
Comece com CX = 0. TEST AX, 8 liga ZF quando o bit 3 está desligado.
Se ZF = 1 (JZ), pule a linha que faz CX = 1.
--- solucao
        MOV  CX, 0
        TEST AX, 8
        JZ   fim
        MOV  CX, 1
fim:
```

```exercicio
id: a05b-3
titulo: Vezes 10 com deslocamentos
nivel: 2
proibir: MUL, IMUL
exigir: SHL|SAL
--- enunciado
Multiplique **AX** por **10** usando deslocamentos (`SHL`) e somas, sem `MUL`. O resultado fica em AX. Os valores de teste cabem em 16 bits.
--- inicial
; AX = AX * 10
--- testes
[
 { "nome": "7 x 10", "setup": { "AX": 7 }, "espera": { "AX": 70 } },
 { "nome": "123 x 10", "setup": { "AX": 123 }, "espera": { "AX": 1230 } },
 { "nome": "6553 x 10", "setup": { "AX": 6553 }, "espera": { "AX": 65530 } },
 { "nome": "0 x 10", "setup": { "AX": 0 }, "espera": { "AX": 0 } }
]
--- dicas
10x = 8x + 2x.
Desloque uma vez e guarde (2x) em outro registrador; desloque mais duas vezes (8x) e some.
--- solucao
        SHL  AX, 1
        MOV  BX, AX
        SHL  AX, 1
        SHL  AX, 1
        ADD  AX, BX
```

```exercicio
id: a05b-4
titulo: Troque os nibbles
nivel: 2
exigir: ROL|ROR
--- enunciado
Troque as duas metades de 4 bits (os **nibbles**) de **AL**: 3Ch deve virar C3h. Use uma rotação.
--- inicial
; AL = nibbles de AL trocados
--- testes
[
 { "nome": "3Ch vira C3h", "setup": { "AL": 60 }, "espera": { "AL": 195 } },
 { "nome": "F0h vira 0Fh", "setup": { "AL": 240 }, "espera": { "AL": 15 } },
 { "nome": "A5h vira 5Ah", "setup": { "AL": 165 }, "espera": { "AL": 90 } },
 { "nome": "77h continua 77h", "setup": { "AL": 119 }, "espera": { "AL": 119 } }
]
--- dicas
Girar 4 casas leva o nibble de cima para baixo e o de baixo para cima.
No 8086, 4 casas precisam de CL: MOV CL,4 / ROL AL,CL.
--- solucao
        MOV  CL, 4
        ROL  AL, CL
```

```exercicio
id: a05b-5
titulo: Conte os bits ligados
nivel: 3
proibir: MUL, DIV
--- enunciado
Coloque em **CX** quantos bits de **AX** estão ligados (de 0 a 16). AX pode ser destruído. Dica de idioma: desloque AX e some o CF.
--- inicial
; CX = número de bits 1 em AX
--- testes
[
 { "nome": "AX = 0", "setup": { "AX": 0, "CX": 7 }, "espera": { "CX": 0 } },
 { "nome": "AX = FFFFh", "setup": { "AX": 65535 }, "espera": { "CX": 16 } },
 { "nome": "AX = 8001h", "setup": { "AX": 32769 }, "espera": { "CX": 2 } },
 { "nome": "AX = 1234h", "setup": { "AX": 4660 }, "espera": { "CX": 5 } }
]
--- dicas
Zere CX e repita 16 vezes: SHR AX,1 joga o bit 0 em CF; ADC CX,0 soma esse CF.
Use outro registrador (DX, por exemplo) como contador do laço, porque CX guarda a resposta. DEC DX / JNZ volta para o começo.
--- solucao
        XOR  CX, CX
        MOV  DX, 16
laco:   SHR  AX, 1
        ADC  CX, 0
        DEC  DX
        JNZ  laco
```

```exercicio
id: a05b-6
titulo: Separando o atributo
nivel: 3
--- enunciado
**AL** traz um byte de atributo da tela de texto (bit 7 = piscar, bits 4-6 = fundo, bits 0-3 = frente). Coloque a **frente** em **BL**, o **fundo** em **BH** (de 0 a 7) e o bit de **piscar** em **CL** (0 ou 1).
--- inicial
; BL = frente (bits 0-3), BH = fundo (bits 4-6), CL = piscar (bit 7)
--- testes
[
 { "nome": "1Eh: amarelo sobre azul", "setup": { "AL": 30 }, "espera": { "BL": 14, "BH": 1, "CL": 0 } },
 { "nome": "CFh: branco sobre vermelho, piscando", "setup": { "AL": 207 }, "espera": { "BL": 15, "BH": 4, "CL": 1 } },
 { "nome": "70h: preto sobre cinza", "setup": { "AL": 112 }, "espera": { "BL": 0, "BH": 7, "CL": 0 } },
 { "nome": "80h: só o piscar", "setup": { "AL": 128 }, "espera": { "BL": 0, "BH": 0, "CL": 1 } }
]
--- dicas
Frente: copie AL e faça AND com 0Fh.
Fundo: copie AL, desloque 4 casas para a direita (MOV CL,4 / SHR BH,CL) e faça AND com 07h.
Piscar: deixe para o fim, porque CL foi usado como contador. ROL AL,1 leva o bit 7 para o bit 0; depois AND com 1.
--- solucao
        MOV  BL, AL
        AND  BL, 0Fh
        MOV  BH, AL
        MOV  CL, 4
        SHR  BH, CL
        AND  BH, 07h
        ROL  AL, 1
        AND  AL, 1
        MOV  CL, AL
```

## Revisão do módulo 2

Antes de seguir, confira se o módulo "FLAGS e decisões" ficou firme. As perguntas misturam assuntos de todas as aulas do módulo (e algumas dos anteriores).

```quiz
? Com AX = 5 e BX = 10 (sem sinal), depois de CMP AX,BX, qual salto é tomado?
+ JB
- JA
- JE
> 5 está abaixo de 10. Para números sem sinal, use JB/JA; JL/JG são para números com sinal.

? Com AX = FFFFh e BX = 1, depois de CMP AX,BX, qual salto é tomado?
- JG
+ JA
- JE
> Sem sinal, FFFFh é 65.535 e está acima de 1 (JA). Com sinal, é −1, que é menor que 1, então JG não salta.

? Qual instrução descobre se AX é ímpar sem mudar AX?
- AND AX, 1
+ TEST AX, 1
- SHR AX, 1
> TEST faz o AND só para as flags. AND e SHR destroem o valor.

? Depois de MOV AX,7 e SHR AX,1, quanto valem AX e CF?
- AX = 14, CF = 0
+ AX = 3, CF = 1
- AX = 3, CF = 0
> 7 ÷ 2 = 3 e o resto (o bit que saiu) vai para CF.

? O que XOR AL, AL faz com AL e com as flags?
+ AL = 0, ZF = 1 e CF = 0
- AL = FFh e CF = 1
- AL não muda, só as flags
> Um valor XOR ele mesmo dá zero. As operações lógicas zeram CF e OF.
```

Para fechar, um desafio sem dicas. Use o laboratório (F4) para depurar à vontade.

```exercicio
id: a05b-d1
titulo: A maior sequência de bits ligados
nivel: 3
desafio: sim
proibir: MUL, DIV
--- enunciado
Coloque em **CX** o tamanho da **maior sequência de bits 1 seguidos** em **AX**. Por exemplo, em 0111 0110 1111 1000b as sequências têm 3, 2 e 5 bits, então CX = 5. AX pode ser destruído.
--- inicial
; CX = maior sequência de bits 1 seguidos em AX
--- testes
[
 { "nome": "0", "setup": { "AX": 0, "CX": 3 }, "espera": { "CX": 0 } },
 { "nome": "FFFFh", "setup": { "AX": 65535 }, "espera": { "CX": 16 } },
 { "nome": "0F0Fh", "setup": { "AX": 3855 }, "espera": { "CX": 4 } },
 { "nome": "76F8h", "setup": { "AX": 30456 }, "espera": { "CX": 5 } },
 { "nome": "8001h", "setup": { "AX": 32769 }, "espera": { "CX": 1 } }
]
--- solucao
        XOR  CX, CX
        XOR  BX, BX
        MOV  DX, 16
laco:   SHL  AX, 1
        JNC  zero
        INC  BX
        CMP  BX, CX
        JBE  prox
        MOV  CX, BX
        JMP  prox
zero:   XOR  BX, BX
prox:   DEC  DX
        JNZ  laco
```

:::resumo
- `AND` desliga bits (máscara com 0 onde apagar), `OR` liga, `XOR` inverte, `NOT` inverte todos.
- `AND`, `OR`, `XOR` e `TEST` zeram CF e OF; `NOT` não mexe em flags. `XOR reg,reg` zera o registrador.
- `TEST` faz o AND só para as flags: ZF = 1 quer dizer que nenhum bit da máscara estava ligado.
- `SHL` multiplica por 2, `SHR` divide por 2 sem sinal, `SAR` divide com sinal. O bit que sai vai para CF.
- No 8086 o contador de deslocamento é 1 ou CL.
- `ROL`/`ROR` giram os bits; `RCL`/`RCR` giram passando por CF e emendam registradores.
- Campo de bits: desloque até o bit 0 e apague o resto com `AND`.
:::
