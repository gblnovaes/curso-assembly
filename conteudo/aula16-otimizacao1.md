---
id: aula16
numero: 16
modulo: 7
titulo: Otimização 1, contando ciclos e bytes
subtitulo: A arte de fazer o mesmo com menos, como nos tempos do XT
duracao: 75 min
objetivos: medir o custo de uma instrução em ciclos e em bytes; ler a tabela de ciclos do 8086, incluindo o cálculo do endereço efetivo (EA); conhecer os idiomas clássicos (XOR para zerar, TEST para comparar com zero, formas curtas do acumulador); trocar MUL e DIV por deslocamentos e somas; usar LEA para fazer contas; saber quando otimizar e quando não vale a pena
---

## Por que contar ciclos

Um PC XT rodava a **4,77 MHz**: 4.770.000 ciclos por segundo. Parece muito, até você fazer as contas de um jogo. Para atualizar a tela 30 vezes por segundo, cada quadro tem 159.000 ciclos. Uma única instrução `MUL` gasta mais de 120. Um laço que roda 1.000 vezes por quadro com um `MUL` dentro já consome **75% do quadro inteiro**.

Nos anos 90, otimizar não era capricho: era a diferença entre um jogo jogável e uma apresentação de slides. E a memória também era cara. Um programa `.COM` tinha que caber em 64 KB, e cada byte economizado era espaço para mais um nível ou mais um efeito.

Neste curso, o laboratório mostra o total de ciclos de cada execução, e cada linha da aba **Listagem** traz os bytes e os ciclos da instrução. As contagens seguem o manual da Intel para o 8086.

## A tabela de ciclos do 8086

O custo de uma instrução depende muito de **onde estão os operandos**:

| Forma | Exemplo | Ciclos |
|-------|---------|--------|
| registrador, registrador | `ADD AX, BX` | 3 |
| registrador, imediato | `ADD AX, 5` | 4 |
| registrador, memória | `ADD AX, [BX]` | 9 + EA |
| memória, registrador | `ADD [BX], AX` | 16 + EA |
| memória, imediato | `ADD WORD PTR [BX], 5` | 17 + EA |
| `MOV` reg, reg | `MOV AX, BX` | 2 |
| `MOV` reg, mem | `MOV AX, [BX]` | 8 + EA |
| `MOV` mem, reg | `MOV [BX], AX` | 9 + EA |

Escrever na memória custa mais que ler: o processador precisa ler o valor, operar e gravar de volta.

### O custo do endereço efetivo (EA)

Sempre que uma instrução acessa a memória, a unidade de execução do 8086 gasta ciclos **calculando o endereço**. É o "+ EA" da tabela:

| Endereçamento | Exemplo | EA |
|---------------|---------|----|
| só deslocamento | `[1234h]`, `[variavel]` | 6 |
| base ou índice | `[BX]`, `[SI]`, `[DI]`, `[BP]` | 5 |
| base ou índice + deslocamento | `[BX+4]`, `[SI+tabela]` | 9 |
| base + índice: `[BP+DI]`, `[BX+SI]` | | 7 |
| base + índice: `[BP+SI]`, `[BX+DI]` | | 8 |
| base + índice + desloc.: `[BP+DI+4]`, `[BX+SI+4]` | | 11 |
| base + índice + desloc.: `[BP+SI+4]`, `[BX+DI+4]` | | 12 |
| prefixo de segmento (`ES:`) | | +2 |

E mais um detalhe: no 8086, ler ou gravar uma **word em endereço ímpar** custa **4 ciclos a mais**, porque o barramento de 16 bits precisa de dois acessos. É por isso que a diretiva `EVEN` (Aula 17) existe.

:::cpu 8086 ou 8088?
O IBM PC original usava o **8088**, que é um 8086 com barramento externo de **8 bits**. Toda word lida ou gravada na memória custa 4 ciclos a mais, mesmo em endereço par, e buscar instruções é duas vezes mais lento. Os ciclos deste curso são os do 8086; num XT com 8088, os acessos a words custam mais, e código curto vale ainda mais. Veremos isso na próxima aula.
:::

## Idioma 1: zerar com XOR

```widget comparar
{ "titulo": "Zerar um registrador", "a": "MOV AX, 0", "b": "XOR AX, AX", "altura": 5 }
```

`XOR AX,AX` ocupa **2 bytes** contra 3 do `MOV AX,0`, e gasta 3 ciclos contra 4. Também existe `SUB AX,AX`, com o mesmo custo. Por isso todo código assembly da época zera registradores com XOR.

:::atencao XOR altera as flags
`MOV` não mexe nas flags; `XOR` zera CF e OF e liga ZF. Se você precisa preservar o resultado de um `CMP` feito antes, use `MOV reg,0`. Esse cuidado já apareceu no exercício da senha da Aula 13.
:::

## Idioma 2: comparar com zero usando TEST ou OR

`CMP AX,0` ocupa 3 bytes. `TEST AX,AX` e `OR AX,AX` ocupam 2, gastam 3 ciclos e deixam ZF e SF exatamente como o `CMP` deixaria:

```asm fragmento
        TEST AX, AX     ; ZF = 1 se AX = 0; SF = bit de sinal
        JZ   @@zero
        JS   @@negativo
```

## Idioma 3: as formas curtas do acumulador

O 8086 tem codificações especiais, um byte menores, quando o destino é **AL ou AX**:

| Instrução | Bytes | Instrução | Bytes |
|-----------|-------|-----------|-------|
| `ADD AX, 1000` | 3 | `ADD BX, 1000` | 4 |
| `CMP AL, 'A'` | 2 | `CMP BL, 'A'` | 3 |
| `MOV AX, [var]` | 3 | `MOV BX, [var]` | 4 |
| `XCHG AX, BX` | 1 | `XCHG CX, BX` | 2 |

Algumas também são mais rápidas: `MOV AX,[var]` gasta 10 ciclos, enquanto `MOV BX,[var]` gasta 8 + EA de 6 = 14.

E quando o imediato cabe em um byte com sinal (−128 a 127), `ADD BX,5` usa uma forma estendida de 3 bytes em vez de 4. O montador escolhe sozinho. Confira na aba **Listagem** do laboratório.

## Idioma 4: multiplicar com deslocamentos

`MUL` de 16 bits custa entre 118 e 133 ciclos. Um deslocamento de 1 bit custa 2. Para multiplicar por uma **constante**, decomponha a constante em potências de 2:

```diagrama titulo="Multiplicando por constantes"
  x × 2   = x << 1
  x × 10  = x × 8 + x × 2    = (x << 3) + (x << 1)
  x × 320 = x × 256 + x × 64 = (x << 8) + (x << 6)
  x × 7   = x × 8 − x        = (x << 3) − x
```

```widget comparar
{ "titulo": "AX = BX × 10", "a": "MOV AX, 10\nMUL BX", "b": "MOV AX, BX\nSHL AX, 1     ; 2x\nSHL AX, 1     ; 4x\nADD AX, BX    ; 5x\nSHL AX, 1     ; 10x", "setup": { "BX": 7 }, "altura": 9 }
```

O resultado é idêntico (70) em menos de um décimo dos ciclos, ao custo de alguns bytes a mais. Repare: no 8086, `SHL AX,1` é a única forma de deslocar com imediato. Para deslocar mais de 1 bit é preciso usar CL (`MOV CL,3` / `SHL AX,CL`, que custa 8 + 4 por bit). Para 2 ou 3 bits, repetir `SHL AX,1` é mais rápido.

:::anos90 A multiplicação por 320
No modo gráfico 13h (320 × 200, 256 cores), o pixel (x, y) fica no offset **y × 320 + x**. Calcular isso com `MUL` para cada pixel era lento demais. O truque universal: y × 320 = y × 256 + y × 64. Multiplicar por 256 é só mover o byte baixo para o alto (`MOV AH,BL` / `XOR AL,AL`), de graça. Muitos jogos iam além e guardavam uma **tabela** com os 200 offsets pré-calculados: uma leitura de memória em vez de qualquer conta.
:::

## Idioma 5: dividir com deslocamentos e AND

Para divisores que são potências de 2, sem sinal:

| Operação | Com DIV | Sem DIV |
|----------|---------|---------|
| quociente de x / 16 | `DIV` (144 a 162 ciclos) | `MOV CL,4` / `SHR AX,CL` (24) |
| resto de x / 16 | o mesmo DIV | `AND AX, 0Fh` (4) |

Para números **com sinal**, `SAR` arredonda para baixo (−7 / 2 dá −4), enquanto `IDIV` arredonda em direção a zero (−7 / 2 dá −3). Cuidado ao trocar um pelo outro; a Aula 22 trata disso.

## Idioma 6: LEA como calculadora

`LEA` calcula um endereço efetivo e guarda o **endereço**, sem acessar a memória. Como o cálculo do endereço é uma soma, LEA vira uma instrução de "soma de três parcelas":

```asm fragmento
        LEA  AX, [BX+SI+5]      ; AX = BX + SI + 5, em uma instrução
        LEA  DI, [DI+2]         ; DI = DI + 2 sem alterar as flags
```

```widget comparar
{ "titulo": "AX = BX + SI + 5", "a": "LEA AX, [BX+SI+5]", "b": "MOV AX, BX\nADD AX, SI\nADD AX, 5", "setup": { "BX": 1, "SI": 2 }, "altura": 6 }
```

Surpresa: no 8086, o `LEA` com três parcelas é **mais lento** (2 + EA de 11 = 13 ciclos) que as três instruções (9 ciclos), mas ocupa menos da metade dos bytes e **não altera as flags**. A medida certa depende do que você precisa. Nos processadores seguintes (386, 486), o LEA ficou muito mais rápido, e esse idioma virou regra.

## Otimizar o quê?

:::dica A regra dos 90/10
Programas passam 90% do tempo em 10% do código: os laços mais internos. Otimizar uma rotina de inicialização que roda uma vez não muda nada. Antes de otimizar, descubra **onde** está o tempo (no laboratório, rode com e sem o trecho suspeito e compare os ciclos). E sempre teste de novo depois: código otimizado é mais fácil de quebrar.
:::

:::anos90 Michael Abrash e o "Zen"
O livro *Zen of Assembly Language* (1990), de Michael Abrash, ensinou uma geração a medir em vez de adivinhar. Abrash criou o "Zen timer", que usava o chip 8253 para cronometrar trechos de código com precisão de microssegundos, e mostrou que no 8088 o tamanho do código muitas vezes importava mais que os ciclos da tabela. Anos depois ele ajudaria a otimizar o motor de *Quake* na id Software.
:::

```quiz
? Quantos ciclos custa ADD AX,[BX+SI] no 8086?
- 9
+ 16 (9 + EA de 7)
- 3
> Registrador com memória custa 9 + EA, e o EA de [BX+SI] é 7.

? Por que XOR AX,AX é preferido a MOV AX,0?
+ Ocupa 2 bytes em vez de 3 e gasta um ciclo a menos
- Porque MOV AX,0 não existe no 8086
- Porque XOR não altera as flags
> XOR altera as flags (zera CF e OF, liga ZF). Quando as flags importam, MOV AX,0 é o certo.

? Como calcular AX × 320 sem MUL?
- AX << 320
+ AX × 256 + AX × 64, com deslocamentos e uma soma
- AX × 300 + AX × 20
> 320 = 256 + 64, ambos potências de 2.

? Qual destas instruções calcula BX + SI + 5 sem alterar nenhuma flag?
- ADD AX, BX
+ LEA AX, [BX+SI+5]
- MOV AX, [BX+SI+5]
> LEA calcula o endereço e guarda o resultado, sem ler a memória e sem mexer nas flags. MOV com colchetes leria a memória.

? Quanto custa a mais ler uma word de um endereço ímpar no 8086?
- Nada
+ 4 ciclos
- 1 ciclo
> O barramento de 16 bits lê words alinhadas de uma vez; desalinhadas exigem dois acessos.
```

## Exercícios

Estes exercícios são **trechos**: os valores chegam nos registradores, e o código termina quando chega ao fim. O limite de ciclos vale para o trecho inteiro.

```exercicio
id: a16-1
titulo: O offset do modo 13h
nivel: 2
proibir: MUL, IMUL
maxCiclos: 70
--- enunciado
Calcule **AX = BX × 320** (BX vai de 0 a 199, então o resultado cabe em 16 bits) **sem MUL**, gastando no máximo **70 ciclos**. Use o truque da decomposição 320 = 256 + 64.
--- inicial
; AX = BX * 320
        MOV  AX, 320
        MUL  BX
--- testes
[{ "nome": "199 × 320 = 63680", "setup": { "BX": 199 }, "espera": { "AX": 63680 } },
 { "nome": "1 × 320 = 320", "setup": { "BX": 1 }, "espera": { "AX": 320 } },
 { "nome": "100 × 320 = 32000", "setup": { "BX": 100 }, "espera": { "AX": 32000 } },
 { "nome": "0 × 320 = 0", "setup": { "BX": 0 }, "espera": { "AX": 0 } }]
--- dicas
BX × 256 é só colocar BL em AH e zerar AL.
BX × 64 é BX deslocado 6 bits: MOV CL,6 / SHL reg,CL.
Some as duas partes.
--- solucao
; AX = BX * 320 = BX*256 + BX*64
        MOV  AH, BL         ; AX = BX * 256 (BX < 256)
        XOR  AL, AL
        MOV  DX, BX
        MOV  CL, 6
        SHL  DX, CL         ; DX = BX * 64
        ADD  AX, DX
```

```exercicio
id: a16-2
titulo: Zerando em 8 bytes
nivel: 1
maxBytes: 8
--- enunciado
Zere **AX, BX, CX e DX** usando no máximo **8 bytes** de código. O código inicial funciona, mas ocupa 12.
--- inicial
        MOV  AX, 0
        MOV  BX, 0
        MOV  CX, 0
        MOV  DX, 0
--- testes
[{ "nome": "tudo zerado", "setup": { "AX": 4660, "BX": 22136, "CX": 39612, "DX": 65535 }, "espera": { "AX": 0, "BX": 0, "CX": 0, "DX": 0 } }]
--- dicas
Qual instrução de 2 bytes zera um registrador?
--- solucao
        XOR  AX, AX
        XOR  BX, BX
        XOR  CX, CX
        XOR  DX, DX
```

```exercicio
id: a16-3
titulo: Dividindo por 16 sem DIV
nivel: 2
proibir: DIV, IDIV
maxCiclos: 45
--- enunciado
AX chega com um número sem sinal. Calcule o **quociente** de AX ÷ 16 em **AX** e o **resto** em **DX**, sem DIV e com no máximo **45 ciclos**.
--- inicial
; AX = AX / 16, DX = AX mod 16
        XOR  DX, DX
        MOV  BX, 16
        DIV  BX
--- testes
[{ "nome": "1000 = 62 × 16 + 8", "setup": { "AX": 1000 }, "espera": { "AX": 62, "DX": 8 } },
 { "nome": "65535 = 4095 × 16 + 15", "setup": { "AX": 65535 }, "espera": { "AX": 4095, "DX": 15 } },
 { "nome": "15 = 0 × 16 + 15", "setup": { "AX": 15 }, "espera": { "AX": 0, "DX": 15 } },
 { "nome": "32 = 2 × 16 + 0", "setup": { "AX": 32 }, "espera": { "AX": 2, "DX": 0 } }]
--- dicas
O resto da divisão por 16 são os 4 bits baixos: AND com 0Fh.
Guarde o resto antes de deslocar AX.
O quociente é AX deslocado 4 bits à direita (SHR, com CL = 4).
--- solucao
; AX = AX / 16, DX = AX mod 16
        MOV  DX, AX
        AND  DX, 0Fh        ; resto: 4 bits baixos
        MOV  CL, 4
        SHR  AX, CL         ; quociente
```

:::resumo
- Registrador é barato, memória é cara: some o custo do endereço efetivo (EA) a cada acesso. Word em endereço ímpar custa +4.
- Idiomas clássicos: `XOR reg,reg` para zerar, `TEST reg,reg` para comparar com zero, formas curtas com AL/AX.
- Multiplique e divida por constantes com deslocamentos, somas e `AND`. `MUL` e `DIV` custam mais de 100 ciclos.
- `LEA` soma até três parcelas sem tocar nas flags; no 8086 ele economiza bytes, não necessariamente ciclos.
- Meça antes e depois. Otimize os laços internos, não o código que roda uma vez.
:::
