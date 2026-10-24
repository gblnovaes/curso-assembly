---
id: aula36
numero: 36
modulo: 13
titulo: Blocos que caem
subtitulo: Peças de 16 bits, rotação com empurrão, linhas cheias, cópia para trás e placar de 32 bits
duracao: 140 min
objetivos: conhecer a história do Tetris e por que ele pegou o mundo; guardar cada peça numa word, como uma grade 4 × 4 de bits; testar se uma peça cabe no poço percorrendo os bits com SHL e o carry; girar a peça e empurrá-la para os lados quando ela bate na parede; achar linhas cheias e removê-las com uma cópia de trás para a frente (STD e REP MOVSB); contar pontos em 32 bits com ADD e ADC e imprimi-los com duas divisões; controlar a velocidade pelos tiques da BIOS e por uma tabela de níveis; desenhar o jogo em modo texto com células de duas colunas
---

## Um programador, um computador soviético e cinco quadrados

Em junho de 1984, Alexey Pajitnov trabalhava no Centro de Computação da Academia de Ciências da URSS, em Moscou. O trabalho dele era testar computadores novos com programas de inteligência artificial e reconhecimento de fala. Para se divertir, ele escrevia quebra-cabeças. Um deles era inspirado nos **pentaminós**, peças feitas de cinco quadrados que ele montava desde criança. No computador da época, um **Electronika 60** que só mostrava texto, cinco quadrados por peça davam formas demais, e ele ficou com quatro: os **tetraminós**. Sete peças ao todo. Daí o nome: *tetra* + *tênis*, o esporte preferido dele.

A ideia que fez o jogo funcionar foi a de **apagar as linhas completas**. Sem isso, o poço enche em um minuto. Com isso, o jogador está sempre arrumando a bagunça que acabou de fazer.

:::anos90 Do Electronika ao Game Boy
O Tetris original não tinha cor nem gráficos: os blocos eram pares de colchetes `[]` e as paredes, `<!` e `!>`. Em 1985, Vadim Gerasimov, um estudante de 16 anos, fez a versão para o **IBM PC**, que se espalhou de disquete em disquete pelos países do Leste e chegou à Hungria, onde a empresa inglesa Andromeda viu o jogo. Seguiu-se uma briga de direitos famosa entre a Andromeda, a Mirrorsoft, a Atari e a Nintendo, contra a agência soviética que controlava a exportação de software, a Elorg. A Nintendo ganhou e, em 1989, colocou o Tetris junto com cada **Game Boy**: foram mais de 35 milhões de cópias. Pajitnov só passou a receber pelo jogo em 1996.
:::

O nosso BLOCOS imita o visual da versão de PC: paredes `<!` e `!>`, fundo `<!====!>` e `\/\/\/`, e o poço de 10 colunas por 20 linhas. Só que com cores, porque em 1990 qualquer PC tinha uma placa CGA ou VGA.

## As regras do BLOCOS

- Uma peça entra no topo do poço e cai uma linha de cada vez, num ritmo que depende do **nível**.
- **← e →** movem a peça; **↑** gira no sentido horário; **↓** desce uma linha (1 ponto); **ESPAÇO** derruba até o fundo (2 pontos por linha).
- Quando a peça não consegue mais descer, ela fica presa e a próxima entra. A próxima peça aparece numa vitrine à direita.
- Uma linha completa pisca e some; tudo o que estava acima desce. Fechar 1, 2, 3 ou 4 linhas de uma vez vale **40, 100, 300 ou 1200** pontos, vezes o nível mais um (a tabela do Tetris do Nintendo).
- A cada 10 linhas o nível sobe e as peças caem mais rápido.
- Se a peça nova não cabe no topo, o jogo acaba. **P** pausa e **ESC** volta ao título.

```diagrama titulo="A tela do BLOCOS (modo texto 80 × 25)"
 col: 4                          28 30                  50  56  58
      B L O C O S                <! . . . . . . . . . . !>  PROXIMA
                                 <! . . . . . . . . . . !>
      PONTOS                     <! . . ████▌. . . . . . !>   ██▌██▌
      1232                       <! . . . ██▌. . . . . . !>   ██▌██▌
                                 <! . . . . . . . . . . !>
      RECORDE                    <! . . . . . . . . . . !>
      0                          ...  20 linhas  ...       ← →  move
                                 <! . . . . . . . . . . !>   ↑    gira
      LINHAS                     <!██▌██▌. ██▌██▌██▌██▌██▌!>   ↓    desce
      12                         <!██▌██▌██▌██▌. ██▌██▌██▌!>   ESPACO derruba
                                 <!====================!>   P    pausa
      NIVEL                        \/\/\/\/\/\/\/\/\/\/     ESC  sai
      1
```

Cada célula do poço ocupa **duas colunas** da tela. Os caracteres do modo texto são quase duas vezes mais altos que largos (8 × 16 pixels na VGA), então uma célula de um caractere só sairia como um tijolo em pé. Com dois caracteres, `█` seguido de `▌`, a célula fica quase quadrada e ainda sobra uma fresta escura entre um bloco e o vizinho. A célula vazia é um ponto cinza, `" ."`, como na versão de 1985.

## O que vem da aula 32 e o que é deste jogo

Da [aula 32](aula:aula32) e da [COBRA](aula:aula33) vêm o tempo pelos tiques da BIOS (`LE_RELOGIO`, INT 1Ah), o sorteio (`ALEATORIO`, o gerador congruente linear), o som que não trava o jogo (`SOM_LIGA`, `SOM_ATUALIZA` e `SOM_DESLIGA`, com o canal 2 do PIT) e a escrita direta em B800h com uma tabela de linhas (`POSICAO`). Se alguma delas parecer mágica, volte lá: aqui elas são usadas sem repetir a explicação.

O que este jogo traz de novo:

| Técnica | Onde |
|---|---|
| Uma peça inteira numa **word**: 16 bits = grade 4 × 4 | `formas`, `FORMA_ATUAL` |
| Percorrer os bits com `SHL` e olhar o **carry** | `CABE`, `FORMA`, `FIXA_PECA` |
| Devolver sim/não no **CF** (`STC`/`CLC`) | `CABE`, `TENTA_MOVER`, `LINHA_CHEIA` |
| Multiplicar por 10 com deslocamentos e somas | `CABE`, `FIXA_PECA`, `LINHA_CHEIA` |
| Rotação com **empurrões** (*wall kick*) | `GIRA`, `empurroes` |
| Cópia com sobreposição: **STD** + `REP MOVSB` | `REMOVE_LINHA` |
| Número de **32 bits**: `ADD`/`ADC`, comparar, imprimir com dois `DIV` | `SOMA_PONTOS`, `FIM_DE_JOGO`, `ESCREVE_NUM32` |
| Velocidade por **tabela de níveis** | `intervalos` |
| Teclado da BIOS com repetição automática | `LER_TECLADO` |

O teclado, aqui, é a INT 16h comum, sem INT 9 própria. Num jogo de peças isso é uma vantagem: segurar a seta faz a BIOS repetir a tecla sozinha (a *typematic*, que o [capítulo 6 do livro](livro:cap06) explica), e a peça escorrega para o lado num ritmo bom, sem nenhum código nosso.

## O estado do jogo

Todo o jogo cabe em algumas dezenas de bytes:

```asm fragmento titulo="As variáveis (fim do BLOCOS.ASM)"
poco        DB LARG*ALT DUP (0) ; 0 = vazio, senão a cor do bloco
pontos      DD 0
recorde     DW 0, 0
linhas_feitas DW 0
nivel       DB 0
cheias      DB 0
peca        DB 0
rot         DB 0
proxima     DB 0
ultima_sorteada DB 0FFh
px          DW 0
py          DW 0
acabou      DB 0
pausado     DB 0
sair_pedido DB 0
ultima_queda DW 0
```

- **`poco`** é o tabuleiro: 200 bytes, linha por linha, de cima para baixo. Cada byte é 0 (vazio) ou a **cor** do bloco que ficou ali. Guardar a cor em vez de um simples "ocupado" custa o mesmo byte e permite redesenhar o poço inteiro sem saber de que peça veio cada bloco.
- **`peca`** (0 a 6) e **`rot`** (0 a 3) dizem qual peça está caindo e em que rotação.
- **`px`, `py`** são a posição, no poço, do **canto de cima à esquerda** da grade 4 × 4 da peça. Elas são words, e `px` pode ficar **negativa** por um instante (uma peça na parede esquerda cuja grade começa fora do poço): por isso as comparações em `CABE` usam `JL`/`JG`, com sinal.
- A peça que cai **não está** no `poco`. Ela só é copiada para lá quando fica presa (`FIXA_PECA`). Enquanto cai, ela só existe na tela e nas variáveis `peca`, `rot`, `px` e `py`.

```diagrama titulo="O poço na memória: 20 linhas de 10 bytes"
 poco+0    ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐  linha 0  (o topo)
 poco+10   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤  linha 1
   ...     │  │  │  │  │  │  │  │  │  │  │
 poco+180  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤  linha 18
 poco+190  │0B│0B│00│0E│0E│0D│0D│0D│0A│0A│  linha 19 (o fundo)
           └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
 célula (x, y) = poco[y * 10 + x]     0 = vazio, senão a cor
```

## Uma peça numa word

O coração do BLOCOS é a representação das peças. Cada peça, em cada rotação, é uma **grade de 4 × 4** células. São 16 células, e cada uma está cheia ou vazia: exatamente os 16 bits de uma word.

```diagrama titulo="O T em pé: 0100 1110 0000 0000b = 4E00h"
            col 0  1  2  3          bits
  linha 0     .  #  .  .     →  0 1 0 0    (bits 15..12)
  linha 1     #  #  #  .     →  1 1 1 0    (bits 11..8)
  linha 2     .  .  .  .     →  0 0 0 0    (bits 7..4)
  linha 3     .  .  .  .     →  0 0 0 0    (bits 3..0)

  bit 15 = linha 0, coluna 0     bit 0 = linha 3, coluna 3
  célula (linha, coluna) = bit 15 - (linha * 4 + coluna)
```

Escrita em hexadecimal, cada **dígito é uma linha** da grade. É por isso que a tabela fica legível até sem desenho: `4E00h` é "`.#..`, `###.`, nada, nada".

```asm fragmento titulo="As 7 peças em 4 rotações: 28 words, 56 bytes"
formas      DW 00F00h, 02222h, 000F0h, 04444h   ; I  ####
            DW 06600h, 06600h, 06600h, 06600h   ; O  ##/##
            DW 04E00h, 04640h, 00E40h, 04C40h   ; T  .#./###
            DW 06C00h, 04620h, 006C0h, 08C40h   ; S  .##/##.
            DW 0C600h, 02640h, 00C60h, 04C80h   ; Z  ##./.##
            DW 08E00h, 06440h, 00E20h, 044C0h   ; J  #../###
            DW 02E00h, 04460h, 00E80h, 0C440h   ; L  ..#/###
cores       DB 0Bh, 0Eh, 0Dh, 0Ah, 0Ch, 09h, 06h
```

As quatro rotações de cada peça foram desenhadas **à mão** e não calculadas. Uma rotação "matemática" de 90° da grade 4 × 4 move a peça para outro canto (o T girado iria para as colunas 1 e 2 ou 2 e 3, conforme o caso), e a peça pareceria pular ao girar. Desenhando cada rotação, dá para escolher o centro de giro de cada peça, que é o que os jogadores esperam. O exercício 4 desta aula faz a rotação calculada, e você vai ver a diferença.

:::cpu Por que não uma tabela de coordenadas?
Muitos Tetris guardam cada peça como 4 pares (x, y). São 8 bytes por rotação, 224 bytes para todas. A word guarda a mesma coisa em 2 bytes, e o teste "esta célula está cheia?" vira um único `SHL AX,1`, que custa **2 ciclos** e deixa a resposta no carry. No 8086 a 4,77 MHz, testar as 16 células de uma peça leva menos que um décimo de milissegundo.
:::

Para achar a forma atual, `FORMA_ATUAL` calcula o índice `peca × 4 + rot` e o dobra, porque cada forma é uma word:

```asm fragmento titulo="FORMA_ATUAL: SI = formas[(peca*4 + rot) * 2]"
FORMA_ATUAL PROC
        PUSH BX
        MOV  BL, peca
        XOR  BH, BH
        SHL  BX, 1
        SHL  BX, 1
        ADD  BL, rot            ; BX = peca * 4 + rot
        SHL  BX, 1              ; (cada forma é uma word)
        MOV  SI, formas[BX]
        POP  BX
        RET
FORMA_ATUAL ENDP
```

Note os dois `SHL BX,1` em vez de `SHL BX,2`: no 8086 não existe deslocamento por um imediato diferente de 1. Para 2 posições, ou se repete a instrução, ou se usa `MOV CL,2` / `SHL BX,CL`. Para 2 ou 3 posições, repetir é mais rápido (2 ciclos cada, contra 8 + 4 por bit com CL); a [aula 16](aula:aula16) faz essa conta.

## A peça cabe?

Toda decisão do jogo (mover, girar, descer, a peça nova entrar) passa por uma pergunta só: **a forma SI cabe com o canto em (CX, DX)?** A rotina `CABE` responde no **carry flag**: CF = 0 sim, CF = 1 não. Assim quem chama decide com um `JC` ou `JNC`, sem gastar registrador.

```asm fragmento titulo="CABE: percorre os 16 bits da forma"
        MOV  AX, SI             ; AX = bits da forma
        MOV  DI, 4              ; 4 linhas
@@linha:
        PUSH CX
        MOV  SI, 4              ; 4 colunas
@@coluna:
        SHL  AX, 1              ; bit 15 = célula da esquerda, em cima
        JNC  @@livre
        CMP  CX, 0              ; fora pela esquerda?
        JL   @@bate
        CMP  CX, LARG-1         ; pela direita?
        JG   @@bate
        CMP  DX, ALT-1          ; pelo fundo?
        JG   @@bate
        MOV  BX, DX             ; BX = y * 10 + x  (y*10 = (y*4 + y) * 2)
        SHL  BX, 1
        SHL  BX, 1
        ADD  BX, DX
        SHL  BX, 1
        ADD  BX, CX
        CMP  poco[BX], 0        ; já tem bloco aí?
        JNE  @@bate
@@livre:
        INC  CX
        DEC  SI
        JNZ  @@coluna
        POP  CX
        INC  DX
        DEC  DI
        JNZ  @@linha
        CLC                     ; todas as células couberam
```

Três ideias para guardar:

1. **`SHL AX,1` seguido de `JNC`.** O bit que sai pela esquerda vai para o carry. Em 16 deslocamentos, os bits saem na ordem certa: linha 0 da esquerda para a direita, depois linha 1, e assim por diante. Ninguém precisa calcular o número do bit.
2. **Só as células cheias são testadas.** Uma grade 4 × 4 pode estar metade fora do poço (a barra em pé tem as colunas 0, 1 e 3 vazias) e isso não importa: o que precisa caber são os blocos, não a grade.
3. **`y × 10` sem `MUL`.** `y × 10 = (y × 4 + y) × 2`: dois `SHL`, um `ADD` e mais um `SHL`, 8 ciclos. Um `MUL` de 8 bits custaria de 70 a 77 ciclos no 8086. A mesma conta aparece em `FIXA_PECA`, `LINHA_CHEIA` e `REMOVE_LINHA`.

Repare também que o topo **não** é testado: uma peça pode ter partes acima da linha 0? Não neste jogo, porque todas as formas têm a primeira linha ocupada ou ficam na linha 0 ao nascer, e `py` nunca diminui. Quando se escreve um jogo, vale anotar esses "não precisa testar porque" no comentário: são eles que quebram quando alguém muda uma regra.

:::dica CF como resposta
Devolver sim/não no carry é uma convenção da própria BIOS e do DOS: a INT 13h, a INT 21h com arquivos e quase toda a INT 15h dizem "deu erro" com CF = 1 (o [capítulo 1 do livro](livro:cap01) lista as regras). Você ganha duas coisas: o resultado sobrevive ao `POP` dos registradores (POP não mexe nas flags) e quem chama testa com um salto, sem `CMP`.
:::

## Mover é tentar

Mover para o lado, descer e girar são a mesma operação: **tentar** pôr a peça numa posição (CX, DX) com uma rotação AL. Se couber, apaga a peça velha, guarda a posição nova e desenha. Se não couber, nada acontece e o CF volta ligado.

```asm fragmento titulo="TENTA_MOVER"
TENTA_MOVER PROC
        PUSH AX
        MOV  AH, rot            ; guarda a rotação velha
        MOV  rot, AL
        CALL FORMA_ATUAL
        MOV  rot, AH
        CALL CABE
        JC   @@nao
        PUSH DX
        CALL APAGA_PECA         ; apaga com a forma e a posição velhas
        POP  DX
        POP  AX
        MOV  rot, AL
        MOV  px, CX
        MOV  py, DX
        CALL MOSTRA_PECA
        CLC
        RET
@@nao:  POP  AX
        STC
        RET
TENTA_MOVER ENDP
```

O truque de trocar `rot` por um instante e chamar `FORMA_ATUAL` evita escrever uma segunda rotina que receba a rotação num registrador. O `PUSH DX` em volta de `APAGA_PECA` existe porque o desenho usa DX para a linha e a coluna da tela: sem ele, a posição nova se perderia. Esse foi um dos erros reais encontrados ao escrever o jogo, e é o tipo de erro que só aparece quando a peça "teleporta" para um lugar estranho.

```diagrama titulo="Quem chama TENTA_MOVER"
   ←  : TENTA_MOVER(rot,   px-1, py)
   →  : TENTA_MOVER(rot,   px+1, py)
   ↓  : DESCE  → TENTA_MOVER(rot, px, py+1) → não deu? FIXA, LIMPA, NOVA
   ↑  : GIRA   → TENTA_MOVER(rot+1, px+0 / px-1 / px+1 / px-2, py)
  ESP : DERRUBA → repete TENTA_MOVER(rot, px, py+1) até não dar
```

## Girar com empurrão

Girar a peça encostada na parede é o caso difícil. A barra deitada na coluna 0, ao ficar em pé, ocupa a coluna 2 da grade, e a grade "girada" pode sair do poço pela direita se a peça estiver na parede direita. A solução de muitos Tetris é o **empurrão** (em inglês, *wall kick*): se a rotação no lugar não cabe, tenta a mesma rotação um pouco para os lados.

```asm fragmento titulo="GIRA e a tabela de empurrões"
GIRA    PROC
        MOV  AL, rot
        INC  AL
        AND  AL, 3
        MOV  DI, OFFSET empurroes
@@tenta:
        MOV  CX, px
        ADD  CX, [DI]
        MOV  DX, py
        CALL TENTA_MOVER        ; (TENTA_MOVER usa SI, então o índice é DI)
        JNC  @@girou
        ADD  DI, 2
        CMP  DI, OFFSET empurroes + 8
        JB   @@tenta
        RET                     ; não deu de jeito nenhum
@@girou:
        ...
empurroes   DW 0, -1, 1, -2     ; deslocamentos tentados ao girar
```

- `INC AL` / `AND AL,3` dá a rotação seguinte de 0 a 3, voltando a 0 depois da 3. É o "resto da divisão por 4" mais barato que existe, e só funciona porque 4 é potência de 2.
- A ordem dos empurrões importa: primeiro no lugar (0), depois uma coluna para a esquerda (−1), uma para a direita (+1) e, por último, duas para a esquerda (−2), que só a barra precisa, na parede direita.
- A tabela é de words com sinal: `DW -1` vira `0FFFFh`, e `ADD CX,[DI]` subtrai 1. O complemento de dois ([aula 22](aula:aula22)) faz a subtração sair de graça.

:::anos90 As regras de rotação viraram norma
Cada Tetris dos anos 80 e 90 girava as peças de um jeito. Em 2001 a The Tetris Company publicou o "Super Rotation System", com uma tabela de cinco empurrões por rotação e regras diferentes para a barra. Hoje todo Tetris oficial é obrigado a seguir esse manual, que também fixa as cores: a barra é ciano, o quadrado é amarelo, o T é roxo. As cores do BLOCOS (`cores`) seguem a mesma ideia, na paleta de 16 cores do modo texto.
:::

## A peça fica presa

Quando `DESCE` não consegue descer, a peça vira parte do poço:

```asm fragmento titulo="FIXA_PECA: copia os blocos para o poço"
        CALL FORMA_ATUAL
        MOV  AX, SI
        MOV  BL, peca
        XOR  BH, BH
        MOV  DL, cores[BX]      ; DL = cor da peça (é o que fica no poço)
        MOV  BX, py             ; BX = py * 10 + px
        SHL  BX, 1
        SHL  BX, 1
        ADD  BX, py
        SHL  BX, 1
        ADD  BX, px
        MOV  DH, 4
@@linha:
        MOV  CX, 4
@@coluna:
        SHL  AX, 1
        JNC  @@prox
        MOV  poco[BX], DL
@@prox: INC  BX
        LOOP @@coluna
        ADD  BX, LARG-4         ; mesma coluna, linha de baixo
        DEC  DH
        JNZ  @@linha
```

O índice no poço anda junto com os bits: a cada célula, `INC BX`; no fim de cada linha da grade, `ADD BX, LARG-4` pula as 6 células do poço que ficam fora da grade e chega à mesma coluna na linha de baixo. Não há nenhuma multiplicação dentro do laço.

## Linhas cheias

Depois de fixar a peça, `LIMPA_LINHAS` procura as linhas sem buraco, de baixo para cima:

```asm fragmento titulo="LINHA_CHEIA: CF = 1 se não há buraco na linha DX"
LINHA_CHEIA PROC
        PUSH BX
        PUSH CX
        MOV  BX, DX
        SHL  BX, 1
        SHL  BX, 1
        ADD  BX, DX
        SHL  BX, 1              ; BX = DX * 10
        MOV  CX, LARG
@@cel:  CMP  poco[BX], 0
        JE   @@buraco
        INC  BX
        LOOP @@cel
        STC
        ...
```

Ela poderia ser escrita com string: ES:DI na linha, AL = 0, CX = 10 e `REPNE SCASB` procura o primeiro zero; se ZF = 0 no fim, não achou zero e a linha está cheia. Fica mais curta e mais rápida, mas exige ES = DS, e no BLOCOS o ES aponta para a tela o tempo todo (B800h). Trocar o ES e devolvê-lo custaria mais que o laço simples. O exercício 2 pede justamente a versão com `REPNE SCASB`, num programa em que ES = DS.

A remoção acontece em duas passadas. Na primeira, cada linha cheia é **pintada de branco**, o som agudo toca e o jogo espera 6 tiques (um terço de segundo, contando com `LE_RELOGIO`). Na segunda, as linhas são tiradas de verdade. Separar as duas coisas é o que faz o efeito de "piscar": o jogador vê quais linhas vão sumir.

### Tirar uma linha: a cópia para trás

Tirar a linha DX quer dizer: tudo o que está **acima** dela desce 10 bytes, e a linha 0 fica vazia.

```asm fragmento titulo="REMOVE_LINHA: STD + REP MOVSB"
        PUSH DS
        POP  ES                 ; MOVSB copia de DS:SI para ES:DI
        MOV  CX, DX
        SHL  CX, 1
        SHL  CX, 1
        ADD  CX, DX
        SHL  CX, 1              ; CX = DX * 10 = bytes acima da linha
        MOV  SI, OFFSET poco - 1
        ADD  SI, CX             ; último byte da linha de cima
        MOV  DI, SI
        ADD  DI, LARG           ; último byte da linha DX
        STD
        REP  MOVSB
        CLD
```

A origem (as linhas 0 a DX−1) e o destino (as linhas 1 a DX) **se sobrepõem**. Se a cópia andasse para a frente, o primeiro byte copiado da linha 0 cairia em cima da linha 1 antes de a linha 1 ser lida: a linha 0 se espalharia pelo poço inteiro. Copiando **de trás para a frente** (direção decrescente, `STD`), cada byte é lido antes de ser sobrescrito.

```diagrama titulo="Por que de trás para a frente"
  antes:   [ A ][ B ][ C ][cheia]     destino = origem + 1 linha
            0    1    2    3

  para a frente (CLD), errado:        para trás (STD), certo:
   copia 0→1: [A][A][C][..]            copia 2→3: [A][B][C][C]
   copia 1→2: [A][A][A][..]            copia 1→2: [A][B][B][C]
   copia 2→3: [A][A][A][A]   ✗         copia 0→1: [A][A][B][C]
                                       zera 0:    [ ][A][B][C]  ✓
```

É a mesma regra do `memmove` da linguagem C, e a [aula 13](aula:aula13) apresenta o flag de direção. O `CLD` logo depois é obrigatório: todas as outras rotinas do jogo (e a BIOS, e o DOS) supõem DF = 0.

Depois de tirar uma linha, `LIMPA_LINHAS` olha **de novo a mesma linha DX**, porque o que estava em cima acabou de cair nela e também pode estar cheio. Só quando ela não está cheia o laço sobe (`DEC DX`).

## Pontos de 32 bits

Com 1200 pontos por quatro linhas, vezes o nível, uma partida boa passa de 65 535 pontos, o máximo de uma word. Os pontos são um **DD** (32 bits), e somar a ele é um `ADD` na parte baixa seguido de um `ADC` na alta:

```asm fragmento titulo="SOMA_PONTOS"
SOMA_PONTOS PROC
        ADD  WORD PTR pontos, AX
        ADC  WORD PTR pontos+2, 0
        RET
SOMA_PONTOS ENDP
```

O `ADC` soma o carry que o `ADD` deixou: se a parte baixa passou de FFFFh, a alta ganha 1. É a técnica da [aula 3](aula:aula03) e da calculadora de 32 bits da [aula 21](aula:aula21).

Comparar dois números de 32 bits (os pontos com o recorde) começa pela parte **alta**: se ela decide, acabou; se for igual, a baixa decide. Os saltos são sem sinal (`JA`, `JB`, `JAE`), porque pontos nunca são negativos:

```asm fragmento titulo="FIM_DE_JOGO: novo recorde?"
        MOV  AX, recorde+2      ; recorde (32 bits): compara a parte alta
        CMP  AX, WORD PTR pontos+2
        JA   @@enche
        JB   @@novo
        MOV  AX, recorde        ; altas iguais: decide a parte baixa
        CMP  AX, WORD PTR pontos
        JAE  @@enche
@@novo: ...
```

### Imprimir 32 bits com DIV de 16

`DIV` com um divisor de 16 bits divide DX:AX por ele e põe o quociente em AX. Se o quociente não couber em 16 bits, o 8086 gera a **INT 0**, a mesma da divisão por zero ([capítulo 2 do livro](livro:cap02)). Dividir 1 000 000 por 10 dá 100 000, que não cabe: o programa cairia.

A saída é dividir em **duas etapas**, como na divisão de papel: primeiro a parte alta por 10, depois o resto dela junto com a parte baixa.

```asm fragmento titulo="ESCREVE_NUM32: BX:AX / 10 em duas etapas"
@@divide:
        PUSH AX                 ; BX:AX / 10
        MOV  AX, BX
        XOR  DX, DX
        DIV  SI                 ; parte alta: AX = quociente, DX = resto
        MOV  BX, AX
        POP  AX
        DIV  SI                 ; (resto:baixa) / 10 -> cabe em 16 bits
        PUSH DX                 ; DX = dígito
        INC  CX
        MOV  DX, AX
        OR   DX, BX             ; acabou quando o quociente é zero
        JNZ  @@divide
```

A segunda divisão nunca estoura: o resto da primeira é menor que 10, então DX:AX é menor que 10 × 65 536, e o quociente cabe em 16 bits. Os dígitos saem do menos significativo para o mais significativo e vão para a pilha; o laço `@@mostra` os tira na ordem certa. Com essa rotina o placar vai até 4 294 967 295.

## O ritmo: tiques e níveis

O laço principal não tem espera nenhuma. Ele gira o mais rápido que pode, lendo o teclado, e a cada volta pergunta ao relógio da BIOS se já passou o intervalo do nível atual:

```asm fragmento titulo="O laço principal: a peça cai quando o intervalo passa"
@@laco:
        CALL LER_TECLADO
        CMP  sair_pedido, 1
        JE   @@titulo
        CALL SOM_ATUALIZA
        CMP  pausado, 1
        JE   @@laco
        CALL LE_RELOGIO         ; já é hora de a peça cair uma linha?
        MOV  DX, AX
        SUB  AX, ultima_queda
        MOV  BL, nivel
        CMP  BL, 10
        JBE  @@tabela
        MOV  BL, 10
@@tabela:
        XOR  BH, BH
        MOV  CL, intervalos[BX]
        XOR  CH, CH
        CMP  AX, CX
        JB   @@laco
        MOV  ultima_queda, DX
        CALL DESCE
        ...
intervalos  DB 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2
```

- O tique da BIOS bate **18,2 vezes por segundo** (o [capítulo 7 do livro](livro:cap07) explica de onde vem esse número: 1 193 182 Hz ÷ 65 536). No nível 0 a peça cai a cada 16 tiques, quase um segundo; no nível 10, a cada 2 tiques, nove linhas por segundo.
- `AX − ultima_queda` funciona mesmo quando o contador dá a volta (de FFFFh para 0): a subtração sem sinal de 16 bits dá a diferença certa. Só a word baixa do contador (DX da INT 1Ah) é usada, e ela dá a volta a cada hora; para medir intervalos curtos, isso basta.
- Uma tabela em vez de uma fórmula deixa o ajuste fino na mão do autor: a curva de dificuldade do Tetris do Nintendo também é uma tabela.
- Como a peça desce quando o tempo manda, e não a cada volta do laço, o jogo tem a **mesma velocidade** num XT de 4,77 MHz e num 486 de 66 MHz. Os jogos que contavam voltas de laço ficaram injogáveis nos PCs mais rápidos; a [aula 32](aula:aula32) conta essa história.

A peça nova ganha um intervalo inteiro (`DESCE` atualiza `ultima_queda`), e descer na mão com ↓ também reinicia a contagem: senão, a peça poderia cair duas linhas seguidas.

## Desenho em células de duas colunas

```asm fragmento titulo="CELULA: um bloco ou um ponto, em duas colunas"
CELULA  PROC
        PUSH AX
        PUSH DI
        CALL POSICAO
        OR   AL, AL
        JZ   @@vazia
        MOV  AH, AL
        MOV  AL, 0DBh           ; █
        STOSW
        MOV  AL, 0DDh           ; ▌ (deixa uma fresta entre os blocos)
        STOSW
        JMP  SHORT @@fim
@@vazia:
        MOV  AX, COR_VAZIO*256 + ' '
        STOSW
        MOV  AL, '.'
        STOSW
@@fim:  POP  DI
        POP  AX
        RET
CELULA  ENDP
```

O par caractere + atributo vai de uma vez com `STOSW` (AL = caractere, AH = cor), como na [aula 32](aula:aula32). A mesma rotina serve para os blocos do poço, a peça que cai e a vitrine da próxima peça: `FORMA` percorre os bits de uma forma e chama `CELULA` para cada bit 1, somando 2 à coluna da tela a cada célula. Para **apagar** a peça, `APAGA_PECA` desenha a mesma forma com cor 0, que vira célula vazia. Não é preciso redesenhar o poço a cada movimento: só as quatro células que mudaram.

O redesenho completo (`DESENHA_TABULEIRO`, 200 células) só acontece quando linhas somem, quando a pausa termina e no começo de cada partida.

## O título, a pausa e o fim

- **Título**: o poço vazio com um quadro azul dentro, esperando ENTER ou ESC com `INT 16h, AH=00h`, que bloqueia. Aqui bloquear não faz mal: não há nada para animar.
- **Pausa**: P inverte `pausado` com `XOR pausado,1` e escreve "PAUSA" piscando (atributo 0CEh: o bit 7 do atributo faz o caractere piscar). Na volta, o poço é redesenhado por cima da palavra.
- **Fim**: o poço enche de cinza de baixo para cima, uma linha por tique, com um som grave; o recorde é atualizado e um quadro vermelho espera ENTER. Antes de esperar, `@@limpa` joga fora as teclas que o jogador apertou durante a animação (`AH=01h` até o buffer esvaziar): sem isso, um ENTER segurado pularia o quadro.
- **Saída**: alto-falante desligado e `INT 10h, AX=0003h` para devolver o modo texto limpo, com o cursor de volta.

:::atencao HLT não é espera
Uma versão anterior do BLOCOS tinha um `HLT` dentro do laço, para "descansar" até o próximo tique. Num PC real, `HLT` para a CPU até a próxima interrupção e economiza energia. No simulador, num programa do DOS, `HLT` **termina o programa**. Se quiser poupar a CPU, espere o tique mudar lendo o relógio, como `LIMPA_LINHAS` faz, ou espere o retraço vertical (porta 3DAh). Esse é um dos detalhes que a [aula 20](aula:aula20) chama de "o simulador não é o PC": conheça as diferenças antes de confiar num comportamento.
:::

## A listagem completa

O programa inteiro tem cerca de 1 060 linhas. Clique em **▶ Jogar** para jogar em tela grande, com o teclado de verdade. Ele também roda no MINIOS, o sistema operacional que você vai construir no módulo 14, porque só usa da INT 21h o fim de programa (`AH=4Ch`); todo o resto é BIOS (INT 10h, 16h e 1Ah) e hardware (B800h e o PIT).

```asm jogo titulo="BLOCOS.ASM"
; ╔══════════════════════════════════════════════════════════════╗
; ║  BLOCOS.ASM  -  peças que caem, em modo texto 80x25           ║
; ║  Curso Assembly 8086, aula 36                                 ║
; ║                                                               ║
; ║  Programa .COM: TASM BLOCOS / TLINK /t BLOCOS                 ║
; ║  Setas: ← → movem, ↑ gira, ↓ desce.  ESPAÇO derruba.          ║
; ║  P pausa, ESC sai.                                            ║
; ╚══════════════════════════════════════════════════════════════╝
.MODEL TINY
.CODE
        ORG 100h

; ---------------------------------------------------------------
; Constantes
; ---------------------------------------------------------------
LARG        EQU 10              ; o poço tem 10 colunas
ALT         EQU 20              ; e 20 linhas
POCO_LIN    EQU 2               ; linha da tela onde o poço começa
POCO_COL    EQU 30              ; coluna da tela (cada célula usa 2 colunas)
PROX_LIN    EQU 5               ; onde aparece a próxima peça
PROX_COL    EQU 58

COR_VAZIO   EQU 08h             ; cinza escuro
COR_PAREDE  EQU 07h
COR_TEXTO   EQU 07h
COR_NUMERO  EQU 0Fh
COR_TITULO  EQU 0Eh
COR_CHEIA   EQU 0Fh             ; a linha completa pisca em branco

TECLA_ESQ   EQU 4Bh
TECLA_DIR   EQU 4Dh
TECLA_CIMA  EQU 48h
TECLA_BAIXO EQU 50h

; ===============================================================
; Programa principal
; ===============================================================
inicio:
        MOV  AX, 0B800h
        MOV  ES, AX
        CLD
        CALL ESCONDE_CURSOR
        CALL SEMEIA
        CALL LIMPA_TELA
        CALL DESENHA_POCO
        CALL DESENHA_PAINEIS

@@titulo:
        CALL TELA_TITULO        ; AL = 27 se o jogador quer sair
        CMP  AL, 27
        JE   @@sair
        CALL NOVO_JOGO
@@laco:
        CALL LER_TECLADO
        CMP  sair_pedido, 1
        JE   @@titulo
        CALL SOM_ATUALIZA
        CMP  pausado, 1
        JE   @@laco
        CALL LE_RELOGIO         ; já é hora de a peça cair uma linha?
        MOV  DX, AX
        SUB  AX, ultima_queda
        MOV  BL, nivel
        CMP  BL, 10
        JBE  @@tabela
        MOV  BL, 10
@@tabela:
        XOR  BH, BH
        MOV  CL, intervalos[BX]
        XOR  CH, CH
        CMP  AX, CX
        JB   @@laco
        MOV  ultima_queda, DX
        CALL DESCE
        CMP  acabou, 1
        JNE  @@laco
        CALL FIM_DE_JOGO
        JMP  @@titulo

@@sair: CALL SOM_DESLIGA
        MOV  AX, 0003h
        INT  10h
        MOV  AX, 4C00h
        INT  21h

; ===============================================================
; Jogo
; ===============================================================
NOVO_JOGO PROC
        PUSH ES                 ; esvazia o poço (ES = DS por um instante,
        PUSH DS                 ;  porque STOSB escreve em ES:DI)
        POP  ES
        MOV  DI, OFFSET poco
        MOV  CX, LARG*ALT
        XOR  AL, AL
        REP  STOSB
        POP  ES
        MOV  WORD PTR pontos, 0
        MOV  WORD PTR pontos+2, 0
        MOV  linhas_feitas, 0
        MOV  nivel, 0
        MOV  acabou, 0
        MOV  pausado, 0
        MOV  sair_pedido, 0
        CALL DESENHA_TABULEIRO
        CALL MOSTRA_NUMEROS
        CALL SORTEIA_PECA
        MOV  proxima, AL
        CALL NOVA_PECA
        CALL LE_RELOGIO
        MOV  ultima_queda, AX
        RET
NOVO_JOGO ENDP

; SORTEIA_PECA: AL = peça de 0 a 6. Se repetir a última, sorteia de novo
; uma vez (assim sequências iguais ficam raras, mas não impossíveis).
SORTEIA_PECA PROC
        MOV  AX, 7
        CALL ALEATORIO
        CMP  AL, ultima_sorteada
        JNE  @@ok
        MOV  AX, 7
        CALL ALEATORIO
@@ok:   MOV  ultima_sorteada, AL
        RET
SORTEIA_PECA ENDP

; NOVA_PECA: a próxima entra no topo do poço; sorteia outra para a vitrine
NOVA_PECA PROC
        MOV  AL, proxima
        MOV  peca, AL
        MOV  rot, 0
        MOV  px, 3
        MOV  py, 0
        CALL SORTEIA_PECA
        MOV  proxima, AL
        CALL MOSTRA_PROXIMA
        CALL FORMA_ATUAL        ; SI = forma
        MOV  CX, px
        MOV  DX, py
        CALL CABE
        JNC  @@cabe
        MOV  acabou, 1          ; não cabe nem a peça nova: fim de jogo
@@cabe: CALL MOSTRA_PECA
        RET
NOVA_PECA ENDP

; FORMA_ATUAL: SI = os 16 bits da peça "peca" na rotação "rot"
FORMA_ATUAL PROC
        PUSH BX
        MOV  BL, peca
        XOR  BH, BH
        SHL  BX, 1
        SHL  BX, 1
        ADD  BL, rot            ; BX = peca * 4 + rot
        SHL  BX, 1              ; (cada forma é uma word)
        MOV  SI, formas[BX]
        POP  BX
        RET
FORMA_ATUAL ENDP

; CABE: a forma SI cabe com o canto em (CX, DX)? CF = 0 sim, CF = 1 não.
; Cada bit 1 da forma é uma célula: ela tem que estar dentro do poço
; e em cima de um lugar vazio.
CABE    PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        MOV  AX, SI             ; AX = bits da forma
        MOV  DI, 4              ; 4 linhas
@@linha:
        PUSH CX
        MOV  SI, 4              ; 4 colunas
@@coluna:
        SHL  AX, 1              ; bit 15 = célula da esquerda, em cima
        JNC  @@livre
        CMP  CX, 0              ; fora pela esquerda?
        JL   @@bate
        CMP  CX, LARG-1         ; pela direita?
        JG   @@bate
        CMP  DX, ALT-1          ; pelo fundo?
        JG   @@bate
        MOV  BX, DX             ; BX = y * 10 + x  (y*10 = (y*4 + y) * 2)
        SHL  BX, 1
        SHL  BX, 1
        ADD  BX, DX
        SHL  BX, 1
        ADD  BX, CX
        CMP  poco[BX], 0        ; já tem bloco aí?
        JNE  @@bate
@@livre:
        INC  CX
        DEC  SI
        JNZ  @@coluna
        POP  CX
        INC  DX
        DEC  DI
        JNZ  @@linha
        CLC                     ; todas as células couberam
        JMP  SHORT @@fim
@@bate: POP  CX
        STC
@@fim:  POP  DI
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
CABE    ENDP

; TENTA_MOVER: tenta pôr a peça em (CX, DX) com a rotação AL.
; Se couber, apaga a velha, desenha a nova e devolve CF = 0.
TENTA_MOVER PROC
        PUSH AX
        MOV  AH, rot            ; guarda a rotação velha
        MOV  rot, AL
        CALL FORMA_ATUAL
        MOV  rot, AH
        CALL CABE
        JC   @@nao
        PUSH DX
        CALL APAGA_PECA         ; apaga com a forma e a posição velhas
        POP  DX
        POP  AX
        MOV  rot, AL
        MOV  px, CX
        MOV  py, DX
        CALL MOSTRA_PECA
        CLC
        RET
@@nao:  POP  AX
        STC
        RET
TENTA_MOVER ENDP

; DESCE: a peça cai uma linha; se não der, ela fica presa no poço
DESCE   PROC
        MOV  AL, rot
        MOV  CX, px
        MOV  DX, py
        INC  DX
        CALL TENTA_MOVER
        JNC  @@fim
        CALL FIXA_PECA
        CALL LIMPA_LINHAS
        CALL NOVA_PECA
        CALL LE_RELOGIO         ; a peça nova ganha um intervalo inteiro
        MOV  ultima_queda, AX
@@fim:  RET
DESCE   ENDP

; GIRA: tenta a rotação seguinte no lugar; se bater, tenta empurrar a
; peça 1 coluna para cada lado (e 2 para a esquerda, por causa da barra)
GIRA    PROC
        MOV  AL, rot
        INC  AL
        AND  AL, 3
        MOV  DI, OFFSET empurroes
@@tenta:
        MOV  CX, px
        ADD  CX, [DI]
        MOV  DX, py
        CALL TENTA_MOVER        ; (TENTA_MOVER usa SI, então o índice é DI)
        JNC  @@girou
        ADD  DI, 2
        CMP  DI, OFFSET empurroes + 8
        JB   @@tenta
        RET                     ; não deu de jeito nenhum
@@girou:
        MOV  BX, 3000
        MOV  CL, 1
        CALL SOM_LIGA
        RET
GIRA    ENDP

; DERRUBA: desce direto até encostar (2 pontos por linha)
DERRUBA PROC
@@cai:  MOV  AL, rot
        MOV  CX, px
        MOV  DX, py
        INC  DX
        CALL TENTA_MOVER
        JC   @@parou
        MOV  AX, 2
        CALL SOMA_PONTOS
        JMP  @@cai
@@parou:
        CALL DESCE              ; agora ela não desce: DESCE a prende
        CALL MOSTRA_NUMEROS
        RET
DERRUBA ENDP

; FIXA_PECA: copia as células da peça para dentro do poço
FIXA_PECA PROC
        CALL FORMA_ATUAL
        MOV  AX, SI
        MOV  BL, peca
        XOR  BH, BH
        MOV  DL, cores[BX]      ; DL = cor da peça (é o que fica no poço)
        MOV  BX, py             ; BX = py * 10 + px
        SHL  BX, 1
        SHL  BX, 1
        ADD  BX, py
        SHL  BX, 1
        ADD  BX, px
        MOV  DH, 4
@@linha:
        MOV  CX, 4
@@coluna:
        SHL  AX, 1
        JNC  @@prox
        MOV  poco[BX], DL
@@prox: INC  BX
        LOOP @@coluna
        ADD  BX, LARG-4         ; mesma coluna, linha de baixo
        DEC  DH
        JNZ  @@linha
        MOV  BX, 6000           ; "toc"
        MOV  CL, 1
        CALL SOM_LIGA
        RET
FIXA_PECA ENDP

; LIMPA_LINHAS: acha as linhas cheias, pisca, tira e conta os pontos
LIMPA_LINHAS PROC
        MOV  cheias, 0
        MOV  DX, ALT-1          ; DX = linha, de baixo para cima
@@olha: CALL LINHA_CHEIA
        JNC  @@prox
        INC  cheias
        PUSH DX                 ; pinta de branco para piscar
        MOV  AL, COR_CHEIA
        CALL PINTA_LINHA
        POP  DX
@@prox: DEC  DX
        JNS  @@olha
        CMP  cheias, 0
        JNE  @@tem
        RET
@@tem:  MOV  BX, 1500           ; som agudo enquanto pisca
        MOV  CL, 6
        CALL SOM_LIGA
        MOV  CX, 6              ; espera 6 tiques (1/3 de segundo)
@@espera:
        CALL SOM_ATUALIZA
        PUSH CX
        CALL LE_RELOGIO
        POP  CX
        CMP  AX, ultimo_tique
        JE   @@espera
        MOV  ultimo_tique, AX
        LOOP @@espera
        MOV  DX, ALT-1          ; agora tira as linhas cheias
@@tira: CALL LINHA_CHEIA
        JNC  @@sobe
        CALL REMOVE_LINHA       ; as de cima descem: olha a mesma DX de novo
        JMP  @@tira
@@sobe: DEC  DX
        JNS  @@tira
        CALL DESENHA_TABULEIRO
        MOV  BL, cheias         ; pontos = tabela[cheias] * (nível + 1)
        XOR  BH, BH
        SHL  BX, 1
        MOV  AX, pontos_linhas[BX]
        MOV  CL, nivel
        INC  CL
        XOR  CH, CH
        MUL  CX
        CALL SOMA_PONTOS
        MOV  AL, cheias
        XOR  AH, AH
        ADD  linhas_feitas, AX
        MOV  AX, linhas_feitas  ; um nível novo a cada 10 linhas
        MOV  BL, 10
        DIV  BL
        MOV  nivel, AL
        CALL MOSTRA_NUMEROS
        RET
LIMPA_LINHAS ENDP

; LINHA_CHEIA: CF = 1 se a linha DX do poço não tem buraco
LINHA_CHEIA PROC
        PUSH BX
        PUSH CX
        MOV  BX, DX
        SHL  BX, 1
        SHL  BX, 1
        ADD  BX, DX
        SHL  BX, 1              ; BX = DX * 10
        MOV  CX, LARG
@@cel:  CMP  poco[BX], 0
        JE   @@buraco
        INC  BX
        LOOP @@cel
        STC
        JMP  SHORT @@fim
@@buraco:
        CLC
@@fim:  POP  CX
        POP  BX
        RET
LINHA_CHEIA ENDP

; REMOVE_LINHA: tira a linha DX; tudo que está acima desce uma linha.
; É uma cópia de trás para a frente (STD), porque origem e destino se
; sobrepõem: copiar para a frente estragaria os dados antes de lê-los.
REMOVE_LINHA PROC
        PUSH CX
        PUSH SI
        PUSH DI
        PUSH ES
        PUSH DS
        POP  ES                 ; MOVSB copia de DS:SI para ES:DI
        MOV  CX, DX
        SHL  CX, 1
        SHL  CX, 1
        ADD  CX, DX
        SHL  CX, 1              ; CX = DX * 10 = bytes acima da linha
        MOV  SI, OFFSET poco - 1
        ADD  SI, CX             ; último byte da linha de cima
        MOV  DI, SI
        ADD  DI, LARG           ; último byte da linha DX
        STD
        REP  MOVSB
        CLD
        MOV  DI, OFFSET poco    ; a linha 0 fica vazia
        MOV  CX, LARG
        XOR  AL, AL
        REP  STOSB
        POP  ES
        POP  DI
        POP  SI
        POP  CX
        RET
REMOVE_LINHA ENDP

; SOMA_PONTOS: pontos (32 bits) += AX. ADD na parte baixa, ADC na alta.
SOMA_PONTOS PROC
        ADD  WORD PTR pontos, AX
        ADC  WORD PTR pontos+2, 0
        RET
SOMA_PONTOS ENDP

; ===============================================================
; Teclado: INT 16h (o próprio BIOS repete a tecla segurada)
; ===============================================================
LER_TECLADO PROC
        MOV  AH, 01h            ; tem tecla no buffer?
        INT  16h
        JNZ  @@tem
        RET
@@tem:  MOV  AH, 00h            ; tira do buffer: AH = scan, AL = ASCII
        INT  16h
        CMP  AL, 27
        JE   @@esc
        CMP  pausado, 1         ; pausado, só P funciona
        JE   @@so_p
        CMP  AH, TECLA_ESQ
        JE   @@esq
        CMP  AH, TECLA_DIR
        JE   @@dir
        CMP  AH, TECLA_CIMA
        JE   @@gira
        CMP  AH, TECLA_BAIXO
        JE   @@baixo
        CMP  AL, ' '
        JE   @@derruba
@@so_p: OR   AL, 20h            ; minúscula
        CMP  AL, 'p'
        JE   @@pausa
        RET
@@esc:  MOV  sair_pedido, 1
        RET
@@esq:  MOV  CX, px
        DEC  CX
        JMP  SHORT @@anda
@@dir:  MOV  CX, px
        INC  CX
@@anda: MOV  AL, rot
        MOV  DX, py
        CALL TENTA_MOVER
        RET
@@gira: CALL GIRA
        RET
@@baixo:
        CALL DESCE
        MOV  AX, 1              ; 1 ponto por linha descida na mão
        CALL SOMA_PONTOS
        CALL MOSTRA_NUMEROS
        CALL LE_RELOGIO
        MOV  ultima_queda, AX
        RET
@@derruba:
        CALL DERRUBA
        RET
@@pausa:
        XOR  pausado, 1
        MOV  DH, POCO_LIN+9
        MOV  DL, POCO_COL+5
        MOV  AH, 0CEh           ; amarelo no vermelho, piscando
        MOV  SI, OFFSET txt_pausa
        CMP  pausado, 1
        JE   @@escreve
        CALL DESENHA_TABULEIRO  ; tira a palavra e põe a peça de volta
        CALL MOSTRA_PECA
        RET
@@escreve:
        CALL ESCREVE
        RET
LER_TECLADO ENDP

; ===============================================================
; Desenho
; ===============================================================

; CELULA: desenha uma célula na linha DH, coluna DL da tela.
; AL = 0: vazia (" ." cinza); senão AL é a cor do bloco ("█▌").
CELULA  PROC
        PUSH AX
        PUSH DI
        CALL POSICAO
        OR   AL, AL
        JZ   @@vazia
        MOV  AH, AL
        MOV  AL, 0DBh           ; █
        STOSW
        MOV  AL, 0DDh           ; ▌ (deixa uma fresta entre os blocos)
        STOSW
        JMP  SHORT @@fim
@@vazia:
        MOV  AX, COR_VAZIO*256 + ' '
        STOSW
        MOV  AL, '.'
        STOSW
@@fim:  POP  DI
        POP  AX
        RET
CELULA  ENDP

; FORMA: desenha a forma SI com o canto na linha DH, coluna DL, cor AL
; (AL = 0 apaga). Só as células com bit 1 são tocadas.
FORMA   PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        MOV  BX, SI             ; BX = bits
        MOV  CH, 4
@@linha:
        PUSH DX
        MOV  CL, 4
@@coluna:
        SHL  BX, 1
        JNC  @@prox
        CALL CELULA
@@prox: ADD  DL, 2
        DEC  CL
        JNZ  @@coluna
        POP  DX
        INC  DH
        DEC  CH
        JNZ  @@linha
        POP  SI
        POP  DX
        POP  CX
        POP  BX
        POP  AX
        RET
FORMA   ENDP

; TELA_DA_PECA: DH, DL = posição na tela do canto da peça (px, py)
TELA_DA_PECA PROC
        MOV  DX, py
        ADD  DL, POCO_LIN
        MOV  DH, DL
        MOV  DL, BYTE PTR px
        SHL  DL, 1
        ADD  DL, POCO_COL
        RET
TELA_DA_PECA ENDP

MOSTRA_PECA PROC
        CALL FORMA_ATUAL
        CALL TELA_DA_PECA
        MOV  BL, peca
        XOR  BH, BH
        MOV  AL, cores[BX]
        CALL FORMA
        RET
MOSTRA_PECA ENDP

APAGA_PECA PROC
        CALL FORMA_ATUAL
        CALL TELA_DA_PECA
        XOR  AL, AL
        CALL FORMA
        RET
APAGA_PECA ENDP

; MOSTRA_PROXIMA: limpa a vitrine e desenha a próxima peça nela
MOSTRA_PROXIMA PROC
        MOV  DH, PROX_LIN
@@limpa:
        MOV  DL, PROX_COL
        PUSH DI
        CALL POSICAO
        MOV  AX, 0720h
        MOV  CX, 8
        REP  STOSW
        POP  DI
        INC  DH
        CMP  DH, PROX_LIN+4
        JB   @@limpa
        MOV  BL, proxima
        XOR  BH, BH
        MOV  AL, cores[BX]
        SHL  BX, 1
        SHL  BX, 1
        SHL  BX, 1              ; peça * 8 = rotação 0 dela
        MOV  SI, formas[BX]
        MOV  DH, PROX_LIN
        MOV  DL, PROX_COL
        CALL FORMA
        RET
MOSTRA_PROXIMA ENDP

; DESENHA_TABULEIRO: redesenha as 200 células do poço
DESENHA_TABULEIRO PROC
        XOR  BX, BX
        MOV  DH, POCO_LIN
@@linha:
        MOV  DL, POCO_COL
        MOV  CX, LARG
@@cel:  MOV  AL, poco[BX]
        CALL CELULA
        INC  BX
        ADD  DL, 2
        LOOP @@cel
        INC  DH
        CMP  DH, POCO_LIN+ALT
        JB   @@linha
        RET
DESENHA_TABULEIRO ENDP

; PINTA_LINHA: pinta a linha DX do poço inteira com a cor AL
PINTA_LINHA PROC
        MOV  DH, DL
        ADD  DH, POCO_LIN
        MOV  DL, POCO_COL
        MOV  CX, LARG
@@cel:  CALL CELULA
        ADD  DL, 2
        LOOP @@cel
        RET
PINTA_LINHA ENDP

; DESENHA_POCO: as paredes <! !> e o fundo, como no Tetris original
DESENHA_POCO PROC
        MOV  AH, COR_PAREDE
        MOV  DH, POCO_LIN
@@lados:
        MOV  DL, POCO_COL-2
        MOV  SI, OFFSET txt_esq
        CALL ESCREVE
        MOV  DL, POCO_COL+LARG*2
        MOV  SI, OFFSET txt_dir
        CALL ESCREVE
        INC  DH
        CMP  DH, POCO_LIN+ALT
        JB   @@lados
        MOV  DL, POCO_COL-2
        MOV  SI, OFFSET txt_fundo1
        CALL ESCREVE
        INC  DH
        MOV  DL, POCO_COL
        MOV  SI, OFFSET txt_fundo2
        CALL ESCREVE
        RET
DESENHA_POCO ENDP

DESENHA_PAINEIS PROC
        MOV  AH, COR_TITULO
        MOV  DH, 2
        MOV  DL, 4
        MOV  SI, OFFSET txt_nome
        CALL ESCREVE
        MOV  AH, COR_TEXTO
        MOV  DH, 5              ; os rótulos ficam um embaixo do outro
        MOV  SI, OFFSET txt_rotulos
@@rotulo:
        MOV  DL, 4
        CALL ESCREVE            ; SI já para no próximo texto
        ADD  DH, 4              ; (o número fica na linha de baixo)
        CMP  BYTE PTR [SI], 0   ; dois zeros seguidos: acabou a lista
        JNE  @@rotulo
        MOV  DH, 3
        MOV  DL, PROX_COL
        MOV  SI, OFFSET txt_proxima
        CALL ESCREVE
        MOV  DH, 12             ; ajuda das teclas
        MOV  SI, OFFSET txt_ajuda
@@ajuda:
        MOV  DL, 56
        CALL ESCREVE
        INC  DH
        CMP  BYTE PTR [SI], 0
        JNE  @@ajuda
        RET
DESENHA_PAINEIS ENDP

MOSTRA_NUMEROS PROC
        MOV  DH, 6
        MOV  DL, 4
        MOV  AX, WORD PTR pontos
        MOV  BX, WORD PTR pontos+2
        CALL ESCREVE_NUM32
        MOV  DH, 10
        MOV  AX, recorde
        MOV  BX, recorde+2
        CALL ESCREVE_NUM32
        MOV  DH, 14
        MOV  AX, linhas_feitas
        XOR  BX, BX
        CALL ESCREVE_NUM32
        MOV  DH, 18
        MOV  AL, nivel
        XOR  AH, AH
        XOR  BX, BX
        CALL ESCREVE_NUM32
        RET
MOSTRA_NUMEROS ENDP

; ESCREVE_NUM32: BX:AX em decimal (até 4 bilhões: 10 dígitos, sem
; zeros à esquerda) na linha DH, coluna DL.
; DIV só divide 32 bits por 16 se o quociente couber em 16 bits, então
; a divisão é feita em duas etapas: primeiro a parte alta, depois a
; baixa com o resto da alta em DX - como na divisão de papel.
ESCREVE_NUM32 PROC
        PUSH DI
        PUSH CX
        PUSH SI
        PUSH DX
        CALL POSICAO
        MOV  CX, 10             ; apaga os 10 lugares
        PUSH AX
        MOV  AX, COR_NUMERO*256 + ' '
        PUSH DI
        REP  STOSW
        POP  DI
        POP  AX
        MOV  SI, 10
        XOR  CX, CX             ; CX = quantos dígitos
@@divide:
        PUSH AX                 ; BX:AX / 10
        MOV  AX, BX
        XOR  DX, DX
        DIV  SI                 ; parte alta: AX = quociente, DX = resto
        MOV  BX, AX
        POP  AX
        DIV  SI                 ; (resto:baixa) / 10 -> cabe em 16 bits
        PUSH DX                 ; DX = dígito
        INC  CX
        MOV  DX, AX
        OR   DX, BX             ; acabou quando o quociente é zero
        JNZ  @@divide
@@mostra:
        POP  AX
        ADD  AL, '0'
        MOV  AH, COR_NUMERO
        STOSW
        LOOP @@mostra
        POP  DX
        POP  SI
        POP  CX
        POP  DI
        RET
ESCREVE_NUM32 ENDP

; TELA_TITULO: o poço vazio com um quadro dentro; espera ENTER ou ESC
TELA_TITULO PROC
        MOV  DH, POCO_LIN+6
        MOV  SI, OFFSET txt_quadro
        MOV  AH, 1Fh
@@linha:
        MOV  DL, POCO_COL
        CALL ESCREVE
        INC  DH
        CMP  BYTE PTR [SI], 0
        JNE  @@linha
@@espera:
        MOV  AH, 00h
        INT  16h
        CMP  AL, 27
        JE   @@fim
        CMP  AL, 13
        JNE  @@espera
@@fim:  RET
TELA_TITULO ENDP

; FIM_DE_JOGO: enche o poço de cinza de baixo para cima e mostra o quadro
FIM_DE_JOGO PROC
        MOV  AX, recorde+2      ; recorde (32 bits): compara a parte alta
        CMP  AX, WORD PTR pontos+2
        JA   @@enche
        JB   @@novo
        MOV  AX, recorde        ; altas iguais: decide a parte baixa
        CMP  AX, WORD PTR pontos
        JAE  @@enche
@@novo: MOV  AX, WORD PTR pontos
        MOV  recorde, AX
        MOV  AX, WORD PTR pontos+2
        MOV  recorde+2, AX
@@enche:
        MOV  BX, 9000
        MOV  CL, 9
        CALL SOM_LIGA
        MOV  DX, ALT-1
@@linha:
        PUSH DX
        MOV  AL, COR_VAZIO
        CALL PINTA_LINHA
        POP  DX
        CALL LE_RELOGIO         ; uma linha por tique
        MOV  ultimo_tique, AX
@@tique:
        CALL SOM_ATUALIZA
        CALL LE_RELOGIO
        CMP  AX, ultimo_tique
        JE   @@tique
        DEC  DX
        JNS  @@linha
        CALL MOSTRA_NUMEROS
        MOV  DH, POCO_LIN+7
        MOV  SI, OFFSET txt_fim
        MOV  AH, 4Fh
@@quadro:
        MOV  DL, POCO_COL
        CALL ESCREVE
        INC  DH
        CMP  BYTE PTR [SI], 0
        JNE  @@quadro
@@limpa:
        MOV  AH, 01h            ; joga fora as teclas apertadas durante a queda
        INT  16h
        JZ   @@espera
        MOV  AH, 00h
        INT  16h
        JMP  @@limpa
@@espera:
        MOV  AH, 00h
        INT  16h
        CMP  AL, 13
        JNE  @@espera
        PUSH ES                 ; esvazia o poço para o quadro do título
        PUSH DS
        POP  ES
        MOV  DI, OFFSET poco
        MOV  CX, LARG*ALT
        XOR  AL, AL
        REP  STOSB
        POP  ES
        CALL DESENHA_TABULEIRO
        RET
FIM_DE_JOGO ENDP

; ===============================================================
; Tela de texto (ES = B800h)
; ===============================================================
POSICAO PROC
        PUSH BX
        MOV  BL, DH
        XOR  BH, BH
        SHL  BX, 1
        MOV  DI, linhas[BX]
        MOV  BL, DL
        XOR  BH, BH
        SHL  BX, 1
        ADD  DI, BX
        POP  BX
        RET
POSICAO ENDP

; ESCREVE: texto terminado em 0 (DS:SI) na linha DH, coluna DL, cor AH.
; Devolve SI logo depois do 0.
ESCREVE PROC
        PUSH DI
        CALL POSICAO
@@car:  LODSB
        OR   AL, AL
        JZ   @@fim
        STOSW
        JMP  @@car
@@fim:  POP  DI
        RET
ESCREVE ENDP

LIMPA_TELA PROC
        XOR  DI, DI
        MOV  AX, 0720h
        MOV  CX, 2000
        REP  STOSW
        RET
LIMPA_TELA ENDP

ESCONDE_CURSOR PROC
        MOV  AH, 01h
        MOV  CX, 2000h
        INT  10h
        RET
ESCONDE_CURSOR ENDP

; ===============================================================
; Tempo, sorteio e som (as rotinas da cobra)
; ===============================================================
LE_RELOGIO PROC
        PUSH CX
        PUSH DX
        MOV  AH, 00h
        INT  1Ah
        MOV  AX, DX
        POP  DX
        POP  CX
        RET
LE_RELOGIO ENDP

SEMEIA  PROC
        CALL LE_RELOGIO
        MOV  semente, AX
        RET
SEMEIA  ENDP

ALEATORIO PROC
        PUSH BX
        PUSH DX
        MOV  BX, AX
        MOV  AX, semente
        MOV  DX, 25173
        MUL  DX
        ADD  AX, 13849
        MOV  semente, AX
        MUL  BX
        MOV  AX, DX
        POP  DX
        POP  BX
        RET
ALEATORIO ENDP

SOM_LIGA PROC
        PUSH AX
        PUSH CX
        MOV  AL, 0B6h
        OUT  43h, AL
        MOV  AL, BL
        OUT  42h, AL
        MOV  AL, BH
        OUT  42h, AL
        IN   AL, 61h
        OR   AL, 3
        OUT  61h, AL
        CALL LE_RELOGIO
        XOR  CH, CH
        ADD  AX, CX
        MOV  som_fim, AX
        MOV  som_ligado, 1
        POP  CX
        POP  AX
        RET
SOM_LIGA ENDP

SOM_ATUALIZA PROC
        CMP  som_ligado, 1
        JNE  @@fim
        PUSH AX
        CALL LE_RELOGIO
        CMP  AX, som_fim
        POP  AX
        JB   @@fim
        CALL SOM_DESLIGA
@@fim:  RET
SOM_ATUALIZA ENDP

SOM_DESLIGA PROC
        PUSH AX
        IN   AL, 61h
        AND  AL, 0FCh
        OUT  61h, AL
        MOV  som_ligado, 0
        POP  AX
        RET
SOM_DESLIGA ENDP

; ===============================================================
; Dados
; ===============================================================
; As 7 peças, cada uma em 4 rotações. Uma forma é uma grade 4x4 guardada
; numa word: bit 15 = linha 0 coluna 0, bit 14 = linha 0 coluna 1, ...
; Exemplo, o T em pé: .#.. / ###. / .... / ....  = 0100 1110 0000 0000b
formas      DW 00F00h, 02222h, 000F0h, 04444h   ; I  ####
            DW 06600h, 06600h, 06600h, 06600h   ; O  ##/##
            DW 04E00h, 04640h, 00E40h, 04C40h   ; T  .#./###
            DW 06C00h, 04620h, 006C0h, 08C40h   ; S  .##/##.
            DW 0C600h, 02640h, 00C60h, 04C80h   ; Z  ##./.##
            DW 08E00h, 06440h, 00E20h, 044C0h   ; J  #../###
            DW 02E00h, 04460h, 00E80h, 0C440h   ; L  ..#/###
cores       DB 0Bh, 0Eh, 0Dh, 0Ah, 0Ch, 09h, 06h
empurroes   DW 0, -1, 1, -2     ; deslocamentos tentados ao girar
; quantos tiques cada nível espera por linha (18,2 tiques = 1 segundo)
intervalos  DB 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2
pontos_linhas DW 0, 40, 100, 300, 1200   ; 1, 2, 3 ou 4 linhas de uma vez

linhas      DW  0*160,  1*160,  2*160,  3*160,  4*160,  5*160,  6*160,  7*160
            DW  8*160,  9*160, 10*160, 11*160, 12*160, 13*160, 14*160, 15*160
            DW 16*160, 17*160, 18*160, 19*160, 20*160, 21*160, 22*160, 23*160
            DW 24*160

txt_esq     DB '<!', 0
txt_dir     DB '!>', 0
txt_fundo1  DB '<!====================!>', 0
txt_fundo2  DB '\/\/\/\/\/\/\/\/\/\/', 0
txt_nome    DB 'B L O C O S', 0
txt_rotulos DB 'PONTOS', 0, 'RECORDE', 0, 'LINHAS', 0, 'NIVEL', 0, 0
txt_proxima DB 'PROXIMA', 0
txt_ajuda   DB 1Bh, ' ', 1Ah, '  move', 0, 18h, '    gira', 0, 19h, '    desce', 0
            DB 'ESPACO derruba', 0, 'P      pausa', 0, 'ESC    sai', 0, 0
txt_pausa   DB ' PAUSA ', 0
txt_quadro  DB '                    ', 0
            DB '  B L O C O S       ', 0
            DB '                    ', 0
            DB '  ENTER  joga       ', 0
            DB '  ESC    sai        ', 0
            DB '                    ', 0, 0
txt_fim     DB '                    ', 0
            DB '    FIM DE JOGO     ', 0
            DB '                    ', 0
            DB '  ENTER continua    ', 0
            DB '                    ', 0, 0

; estado
poco        DB LARG*ALT DUP (0) ; 0 = vazio, senão a cor do bloco
pontos      DD 0
recorde     DW 0, 0
linhas_feitas DW 0
nivel       DB 0
cheias      DB 0
peca        DB 0
rot         DB 0
proxima     DB 0
ultima_sorteada DB 0FFh
px          DW 0
py          DW 0
acabou      DB 0
pausado     DB 0
sair_pedido DB 0
ultima_queda DW 0
ultimo_tique DW 0
semente     DW 1
som_fim     DW 0
som_ligado  DB 0

END inicio
```

## Exercícios

```exercicio
id: a36-1
titulo: Esta célula está cheia?
nivel: 1
--- enunciado
**AX** traz uma forma de peça (a grade 4 × 4 numa word, bit 15 = linha 0, coluna 0). **BL** traz a linha (0 a 3) e **BH** a coluna (0 a 3) de uma célula.

Devolva em **AL** o valor **1** se a célula estiver cheia e **0** se estiver vazia. O número do bit é `15 − (linha × 4 + coluna)`.
--- inicial
; AX = forma, BL = linha (0-3), BH = coluna (0-3)
; AL = 1 se a célula está cheia, 0 se vazia
        MOV  AL, 0
--- testes
[{ "nome": "T (4E00h), linha 0 coluna 1: cheia", "setup": { "AX": 19968, "BX": 256 }, "espera": { "AL": 1 } },
 { "nome": "T (4E00h), linha 0 coluna 0: vazia", "setup": { "AX": 19968, "BX": 0 }, "espera": { "AL": 0 } },
 { "nome": "T (4E00h), linha 1 coluna 2: cheia", "setup": { "AX": 19968, "BX": 513 }, "espera": { "AL": 1 } },
 { "nome": "T (4E00h), linha 1 coluna 3: vazia", "setup": { "AX": 19968, "BX": 769 }, "espera": { "AL": 0 } },
 { "nome": "barra em pé (2222h), linha 3 coluna 2: cheia", "setup": { "AX": 8738, "BX": 515 }, "espera": { "AL": 1 } },
 { "nome": "só o último bit (0001h), linha 3 coluna 3", "setup": { "AX": 1, "BX": 771 }, "espera": { "AL": 1 } },
 { "nome": "tudo cheio menos o último (FFFEh), linha 3 coluna 3", "setup": { "AX": 65534, "BX": 771 }, "espera": { "AL": 0 } }]
--- dicas
Calcule linha × 4 + coluna num registrador de 8 bits: MOV CL,BL / SHL CL,1 / SHL CL,1 / ADD CL,BH.
Em vez de "15 menos", desloque AX para a esquerda: SHL AX,CL leva a célula para o bit 15.
Depois de deslocar, um ROL AX,1 traz o bit 15 para o bit 0. AND AL,1 fica só com ele.
--- solucao
; AX = forma, BL = linha (0-3), BH = coluna (0-3)
; AL = 1 se a célula está cheia, 0 se vazia
        MOV  CL, BL
        SHL  CL, 1
        SHL  CL, 1
        ADD  CL, BH             ; CL = linha * 4 + coluna
        SHL  AX, CL             ; a célula vai para o bit 15
        ROL  AX, 1              ; e do bit 15 para o bit 0
        AND  AL, 1
```

```exercicio
id: a36-2
titulo: Linha cheia com REPNE SCASB
nivel: 2
exigir: SCASB
--- enunciado
O programa abaixo tem uma linha do poço, **linha** (10 bytes, 0 = vazio). Usando `REPNE SCASB` para procurar um zero, guarde em **cheia** o valor **1** se a linha não tiver nenhum buraco e **0** se tiver. Num .COM, ES já é igual a DS.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: ; procure um zero em "linha" com REPNE SCASB
        MOV  cheia, 0
        MOV  AX, 4C00h
        INT  21h
linha   DB 10 DUP (0)
cheia   DB 0FFh
END inicio
--- testes
[{ "nome": "vazia", "setup": { "linha": [0,0,0,0,0,0,0,0,0,0] }, "espera": { "mem": { "cheia": 0 } } },
 { "nome": "cheia", "setup": { "linha": [11,11,14,14,13,13,13,10,10,9] }, "espera": { "mem": { "cheia": 1 } } },
 { "nome": "buraco na primeira célula", "setup": { "linha": [0,11,14,14,13,13,13,10,10,9] }, "espera": { "mem": { "cheia": 0 } } },
 { "nome": "buraco na última célula", "setup": { "linha": [11,11,14,14,13,13,13,10,10,0] }, "espera": { "mem": { "cheia": 0 } } },
 { "nome": "buraco no meio", "setup": { "linha": [6,6,6,6,0,6,6,6,6,6] }, "espera": { "mem": { "cheia": 0 } } },
 { "nome": "toda de uma cor só", "setup": { "linha": [6,6,6,6,6,6,6,6,6,6] }, "espera": { "mem": { "cheia": 1 } } }]
--- dicas
Prepare ES:DI = linha, AL = 0 (o que procurar), CX = 10 e CLD.
REPNE SCASB para no primeiro byte igual a AL, ou quando CX chega a zero.
Depois do REPNE SCASB, ZF = 1 quer dizer que achou um zero (há buraco). Cuidado: não use CX para decidir, porque um zero na última célula também deixa CX = 0.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: MOV  DI, OFFSET linha
        MOV  CX, 10
        XOR  AL, AL
        CLD
        REPNE SCASB             ; procura o primeiro 0
        MOV  cheia, 0
        JE   @@fim              ; ZF = 1: achou um buraco
        MOV  cheia, 1
@@fim:  MOV  AX, 4C00h
        INT  21h
linha   DB 10 DUP (0)
cheia   DB 0FFh
END inicio
```

```exercicio
id: a36-3
titulo: Pontos de 32 bits
nivel: 2
exigir: ADC
proibir: MUL
--- enunciado
**pontos** é um DD (32 bits) e **AL** traz quantas linhas foram fechadas de uma vez (1 a 4). **BL** traz o nível atual (0 a 20).

Some a pontos o valor `tabela[AL] × (nível + 1)`, com a tabela do Tetris: 1 linha vale 40, 2 valem 100, 3 valem 300 e 4 valem 1200. Não use `MUL`: some o valor da tabela `nível + 1` vezes, com `ADD` e `ADC`, para treinar a soma de 32 bits.
--- inicial
.MODEL TINY
.CODE
        ORG 100h
inicio: ; pontos += tabela[AL] * (BL + 1)
        MOV  AX, 4C00h
        INT  21h
tabela  DW 0, 40, 100, 300, 1200
pontos  DD 0
END inicio
--- testes
[{ "nome": "1 linha no nível 0", "setup": { "AL": 1, "BL": 0, "pontos": 0 }, "espera": { "mem": { "pontos": 40 } } },
 { "nome": "4 linhas no nível 0", "setup": { "AL": 4, "BL": 0, "pontos": 1000 }, "espera": { "mem": { "pontos": 2200 } } },
 { "nome": "3 linhas no nível 2", "setup": { "AL": 3, "BL": 2, "pontos": 7 }, "espera": { "mem": { "pontos": 907 } } },
 { "nome": "passa de 65535", "setup": { "AL": 4, "BL": 0, "pontos": 65000 }, "espera": { "mem": { "pontos": 66200 } } },
 { "nome": "4 linhas no nível 20, passando de vários 65536", "setup": { "AL": 4, "BL": 20, "pontos": 60000 }, "espera": { "mem": { "pontos": 85200 } } }]
--- dicas
O índice na tabela de words é AL × 2: MOV BH,0 antes de usar BX, e ponha AL em SI (XOR AH,AH / MOV SI,AX / SHL SI,1).
Guarde o valor em DX: MOV DX,tabela[SI]. O contador de voltas é BL + 1: MOV CL,BL / XOR CH,CH / INC CX.
Dentro do laço: ADD WORD PTR pontos,DX e ADC WORD PTR pontos+2,0. LOOP volta.
--- solucao
.MODEL TINY
.CODE
        ORG 100h
inicio: XOR  AH, AH
        MOV  SI, AX
        SHL  SI, 1              ; SI = AL * 2
        MOV  DX, tabela[SI]
        MOV  CL, BL
        XOR  CH, CH
        INC  CX                 ; nível + 1 vezes
@@soma: ADD  WORD PTR pontos, DX
        ADC  WORD PTR pontos+2, 0
        LOOP @@soma
        MOV  AX, 4C00h
        INT  21h
tabela  DW 0, 40, 100, 300, 1200
pontos  DD 0
END inicio
```

```exercicio
id: a36-4
titulo: Girar a grade 4 × 4
nivel: 3
--- enunciado
**AX** traz uma forma (grade 4 × 4 numa word, bit 15 = linha 0, coluna 0). Devolva em **BX** a mesma grade girada **90° no sentido horário**: a célula da linha `l`, coluna `c` vai para a linha `c`, coluna `3 − l`.

Exemplos: a barra deitada na linha 1 (0F00h) vira a barra em pé na coluna 2 (2222h); o quadrado 6600h vira 0330h. Compare com a tabela `formas` do BLOCOS e veja por que as rotações do jogo foram desenhadas à mão.
--- inicial
; AX = forma; BX = forma girada 90 graus no sentido horário
        MOV  BX, AX
--- testes
[{ "nome": "barra deitada 0F00h → 2222h", "setup": { "AX": 3840 }, "espera": { "BX": 8738 } },
 { "nome": "quadrado 6600h → 0330h", "setup": { "AX": 26112 }, "espera": { "BX": 816 } },
 { "nome": "canto 8000h → 1000h", "setup": { "AX": 32768 }, "espera": { "BX": 4096 } },
 { "nome": "T 4E00h → 2320h", "setup": { "AX": 19968 }, "espera": { "BX": 8992 } },
 { "nome": "diagonal 8421h → 1248h", "setup": { "AX": 33825 }, "espera": { "BX": 4680 } },
 { "nome": "tudo cheio", "setup": { "AX": 65535 }, "espera": { "BX": 65535 } },
 { "nome": "vazio", "setup": { "AX": 0, "BX": 1 }, "espera": { "BX": 0 } }]
--- dicas
Percorra as 16 células da forma com SHL AX,1 (o carry diz se a célula está cheia), contando a linha l em DH e a coluna c em DL.
Para cada célula cheia, o bit de destino é 15 − (c × 4 + 3 − l) = 12 − c × 4 + l.
Monte esse número em CL e ligue o bit: MOV SI,1 / SHL SI,CL / OR BX,SI. Comece com BX = 0.
--- solucao
; AX = forma; BX = forma girada 90 graus no sentido horário
        XOR  BX, BX
        XOR  DH, DH             ; DH = linha velha
linha:  XOR  DL, DL             ; DL = coluna velha
coluna: SHL  AX, 1
        JNC  proxima
        MOV  CL, DL             ; destino: linha c, coluna 3-l
        SHL  CL, 1
        SHL  CL, 1
        MOV  CH, 12
        SUB  CH, CL
        ADD  CH, DH             ; bit = 12 - c*4 + l
        MOV  CL, CH
        MOV  SI, 1
        SHL  SI, CL
        OR   BX, SI
proxima:
        INC  DL
        CMP  DL, 4
        JB   coluna
        INC  DH
        CMP  DH, 4
        JB   linha
```

```quiz
? Por que cada forma de peça cabe numa word?
- Porque as peças têm no máximo 16 blocos
+ Porque a grade 4 × 4 tem 16 células, e cada uma está cheia ou vazia: 1 bit cada
- Porque o 8086 só sabe mover words
> 4 × 4 = 16 células, um bit para cada. Em hexadecimal, cada dígito é uma linha da grade.

? O que `SHL AX,1` seguido de `JNC @@livre` faz em `CABE`?
+ Tira o bit 15 da forma para o carry e pula as células vazias
- Multiplica a forma por 2 e testa se deu estouro com sinal
- Gira a peça uma posição para a esquerda
> O bit que sai pela esquerda vai para o CF. Em 16 deslocamentos, as células saem na ordem: linha 0 da esquerda para a direita, depois a linha 1...

? Por que `REMOVE_LINHA` copia com `STD` (de trás para a frente)?
- Porque REP MOVSB só funciona com DF = 1
+ Porque origem e destino se sobrepõem e o destino fica depois da origem: para a frente, a cópia sobrescreveria bytes antes de lê-los
- Para que a linha cheia vá para o topo do poço
> É a regra do memmove: se o destino está adiante da origem e as áreas se cruzam, copie do fim para o começo.

? Como `GIRA` resolve a peça que não pode girar encostada na parede?
- Ela gira a peça no sentido contrário
- Ela desce a peça uma linha e tenta de novo
+ Ela tenta a mesma rotação deslocada 0, −1, +1 e −2 colunas, nessa ordem, e fica com a primeira que cabe
> São os empurrões (wall kicks). O −2 existe por causa da barra na parede direita.

? `DIV SI` com SI = 10 e DX:AX = 1 000 000 (000F4240h). O que acontece?
- AX = 100 000 e DX = 0
+ O quociente não cabe em 16 bits e o 8086 gera a INT 0 (erro de divisão)
- AX = 34 464 (o quociente truncado)
> Por isso `ESCREVE_NUM32` divide em duas etapas: parte alta primeiro, depois o resto dela com a parte baixa.

? Por que o laço principal compara `tique atual − ultima_queda` com a tabela `intervalos`, em vez de esperar um número fixo de voltas?
+ Para que a peça caia na mesma velocidade em qualquer PC, rápido ou lento
- Porque a INT 16h só funciona uma vez por tique
- Para economizar memória
> O tique da BIOS bate 18,2 vezes por segundo em qualquer PC. Contar voltas de laço deixava os jogos rápidos demais nos PCs novos.

? Qual é o jeito mais barato de calcular y × 10 no 8086?
- MUL com 10 num registrador
- MOV CL,10 / SHL BX,CL
+ (y × 4 + y) × 2: dois SHL, um ADD e mais um SHL
> SHL BX,CL deslocaria 10 bits (× 1024). O MUL de 8 bits custa ~70 ciclos; os deslocamentos e a soma, 8.

? A peça que está caindo fica guardada onde?
- No vetor `poco`, com uma marca especial
+ Só nas variáveis `peca`, `rot`, `px`, `py` e na tela; ela vai para o `poco` quando fica presa (FIXA_PECA)
- Numa cópia do poço feita a cada movimento
> Assim CABE testa a peça contra o poço sem que ela bata nela mesma.
```

## Desafios

1. **A sombra.** Mostre onde a peça vai cair: calcule a posição de `DERRUBA` sem mexer na peça (repita `CABE` com DX crescente) e desenhe ali a forma com pontos `░░`. Lembre-se de apagar a sombra antes de cada movimento.
2. **Guardar a peça.** Uma tecla (C) guarda a peça atual numa caixa ao lado e traz a guardada (ou a próxima, na primeira vez). Só pode guardar uma vez por peça.
3. **Saco de 7.** Em vez de `SORTEIA_PECA`, embaralhe as 7 peças (algoritmo de Fisher-Yates com `ALEATORIO`) e entregue uma de cada antes de embaralhar de novo, como nos Tetris modernos.
4. **Recorde no disco.** Grave o recorde num arquivo BLOCOS.REC com as funções de arquivo do DOS ([aula 25](aula:aula25)) e leia-o ao começar. No MINIOS, que não grava arquivos, o jogo deve continuar funcionando sem o arquivo.
5. **Dois jogadores.** Dois poços lado a lado, um com as setas e outro com W A S D, controlados por uma INT 9 própria com tabela de teclas ([aula 32](aula:aula32)): a INT 16h não informa duas teclas apertadas ao mesmo tempo.

## No livro

- [Capítulo 6, o teclado](livro:cap06): a INT 16h, o buffer de 16 teclas e a repetição automática que move a peça quando se segura a seta.
- [Capítulo 7, o tempo](livro:cap07): o contador de tiques da INT 1Ah, de onde vem o 18,2 e por que ele dá a volta à meia-noite.
- [Capítulo 3, o vídeo em modo texto](livro:cap03): o atributo de cor, o bit de piscar e o cursor escondido com `AH=01h`.
- [Capítulo 2, vetores e exceções](livro:cap02): a INT 0 que um `DIV` estourado dispara.
- [Capítulo 20, a BIOS para jogos](livro:cap20): o que um jogo pede à BIOS e o que ele faz sozinho, com a tabela das técnicas dos sete jogos do curso.

:::resumo
- Uma peça numa word: a grade 4 × 4 vira 16 bits, cada dígito hexadecimal é uma linha. `SHL AX,1` + `JNC` percorre as células na ordem.
- Uma única pergunta, `CABE` (CF = 0 sim, CF = 1 não), decide mover, girar, descer e o fim do jogo. Mover é tentar: `TENTA_MOVER` só apaga e desenha se couber.
- Girar com empurrões: tente a rotação no lugar, depois −1, +1 e −2 colunas. As rotações do jogo são desenhadas à mão para girar em torno do centro certo.
- O poço guarda a cor de cada bloco; a peça que cai só entra nele em `FIXA_PECA`. Multiplicar por 10 é `(y × 4 + y) × 2`.
- Linhas cheias: pinte, espere, tire. Tirar é uma cópia com sobreposição, feita de trás para a frente com `STD` + `REP MOVSB`, seguida de `CLD`.
- Pontos em 32 bits: `ADD` + `ADC`; comparar pela parte alta primeiro; imprimir com duas divisões para o `DIV` nunca estourar.
- A velocidade vem dos tiques da BIOS e de uma tabela de níveis, não de laços de espera: o jogo roda igual em qualquer PC.
:::
