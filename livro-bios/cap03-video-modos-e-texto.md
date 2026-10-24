---
id: cap03
numero: 3
parte: 2
titulo: "Vídeo I: modos, cursor, caracteres e pixels (INT 10H, AH=00H a 0FH)"
aulas: aula12; aula14; aula23
---

# Capítulo 3 · Vídeo I: modos, cursor, caracteres e pixels

> **Neste capítulo:** as funções básicas da `INT 10H` (AH = 00H a 0FH): definir o modo,
> controlar o cursor, rolar janelas, ler e escrever caracteres, a paleta CGA, pixels, o modo
> teletipo e a leitura do estado. Mais a organização da memória de vídeo em texto.
>
> **Antes de ler:** [Aula 14, Interrupções, IVT, DOS e BIOS](../conteudo/aula14-interrupcoes.md)
> (seção "Vídeo pela BIOS: INT 10h"), [Aula 12, Segmentos a fundo](../conteudo/aula12-segmentos.md)
> (seção "A memória de vídeo em modo texto") e [Aula 23, O modo gráfico 13h](../conteudo/aula23-modo13h.md).

## 3.1 Visão geral

`INT 10H` reúne os serviços de vídeo da BIOS. **AH** escolhe a função:

| AH | O que faz | Seção |
|---|---|---|
| 00H | Define o modo de vídeo | 3.2 |
| 01H–03H | Formato e posição do cursor | 3.3 |
| 04H | Caneta óptica | 3.4 |
| 05H | Página ativa | 3.5 |
| 06H, 07H | Rolagem de janela | 3.6 |
| 08H–0AH | Ler/escrever caracteres no cursor | 3.7 |
| 0BH | Paleta de cores (320×200) | 3.8 |
| 0CH, 0DH | Escrever/ler pixel | 3.9 |
| 0EH | Saída em modo teletipo | 3.10 |
| 0FH | Estado atual do vídeo | 3.11 |
| 10H–13H | Paleta, fontes, seleções alternativas, strings | [Capítulo 4](cap04-video-paleta-fontes-strings.md) |
| 14H–1CH | LCD, DCC, estado, salvar/restaurar | [Capítulo 5](cap05-video-estado-e-deteccao.md) |

## 3.2 AH = 00H · Definir modo

Entrada: `AL` = número do modo.

### Como pensar nos modos

| Modo | Tipo | Resolução típica | Cores | Buffer | Onde existe |
|---|---|---|---|---|---|
| 00H, 01H | texto | 40×25 | 16 | `B8000H` | CGA e posteriores |
| 02H, 03H | texto | 80×25 | 16 | `B8000H` | CGA e posteriores |
| 04H, 05H | gráfico | 320×200 | 4 | `B8000H` | CGA e posteriores |
| 06H | gráfico | 640×200 | 2 | `B8000H` | CGA e posteriores |
| 07H | texto | 80×25 | mono | `B0000H` | monocromático, EGA, PS/2 (exceto Model 30) |
| 08H, 09H, 0AH | gráfico | | | | só PCjr |
| 0DH | gráfico | 320×200 | 16 | `A0000H` | EGA, PS/2 (exceto Model 30) |
| 0EH | gráfico | 640×200 | 16 | `A0000H` | EGA, PS/2 (exceto Model 30) |
| 0FH | gráfico | 640×350 | mono | `A0000H` | EGA, PS/2 (exceto Model 30) |
| 10H | gráfico | 640×350 | 16 | `A0000H` | EGA, PS/2 (exceto Model 30) |
| 11H | gráfico | 640×480 | 2 | `A0000H` | PS/2 (inclusive Model 30) |
| 12H | gráfico | 640×480 | 16 | `A0000H` | PS/2 (exceto Model 30) |
| 13H | gráfico | 320×200 | **256** | `A0000H` | PS/2 (inclusive Model 30) |

Resumo do manual:

- **Texto (A/N, alfanumérico)**: 0 e 1 (40 colunas), 2 e 3 (80 colunas), 7 (monocromático).
- **Gráficos (APA, *all points addressable*)**: 4, 5 e 6 (CGA clássico), 0DH a 13H (EGA e
  PS/2). 8, 9 e 0AH existem só no PCjr.
- **Buffer**: texto colorido e CGA em `B8000H`; monocromático (modo 7) em `B0000H`; gráficos
  EGA/PS/2 em `A0000H`.
- **Cores**: modos de texto 0 a 3 têm 16; modo 6 tem 2; modos 4 e 5 têm 4; 0EH, 10H e 12H têm
  16; 11H tem 2; **13H tem 256** (um byte por pixel, 320×200).
- **Resolução real do texto** varia com o adaptador: o mesmo "80×25" pode usar célula 8×8
  (CGA), 8×14 (EGA), 9×14 (monocromático) ou 9×16/8×16 (PS/2). O PS/2 (exceto Model 30) deixa
  escolher 200, 350 ou 400 linhas de varredura via `AH=12H, BL=30H` ([Capítulo 4](cap04-video-paleta-fontes-strings.md)).
- **Páginas de vídeo**: os modos de texto permitem até 8 páginas em EGA/PS/2 (4 em CGA/PCjr
  no modo de 80 colunas); os gráficos clássicos têm 1 página; 0DH a 10H têm de 8 a 2 páginas
  conforme a memória.

> As resoluções da tabela de modos são as usuais de cada adaptador; a Figura 2-3 e a
> Figura 2-4 do manual trazem a lista exaustiva por adaptador, com tamanho de célula e número
> de páginas.

### Comportamento ao trocar de modo

- **Bit 7 de `AL` ligado = não limpa o buffer** (PCjr, EGA, PC Convertible, PS/2). Útil para
  trocar de modo sem apagar a tela.
- Em gráficos o cursor de texto não aparece.
- Os modos 0, 2 e 5 equivalem a 1, 3 e 4, mas com o *color burst* desligado: só importa
  para monitor composto (sem cor); em RGB não há diferença.
- Modo inicial ao ligar: depende das chaves do EGA; 2 ou 7 no PC Convertible; **3** no PS/2
  Model 30; **3** (colorido) ou **7** (mono) nos outros PS/2.
- PS/2: após o *set mode* os 16 (Model 30) ou 64 (demais) primeiros registradores de cor
  ficam inicializados; o resto é indefinido, exceto no modo 13H.

```asm fragmento titulo="Entrar em 320×200 com 256 cores e voltar ao texto"
MOV  AX,0013H     ; AH=00H, AL=13H
INT  10H
; ... desenhar escrevendo em A000:0000 ...
MOV  AX,0003H     ; volta ao texto 80x25 colorido
INT  10H
```

> **Boa educação.** Um programa que troca de modo deve **guardar o modo original** com
> `AH=0FH` (seção 3.11) e restaurá-lo na saída, em vez de supor que era o modo 3.

## 3.3 O cursor: AH = 01H, 02H e 03H

### AH = 01H · Formato do cursor

`CH` = linha inicial, `CL` = linha final da "caixa" do cursor (bits 4 a 0). Ligar os bits 6
e 5 de `CH` gera efeitos estranhos (piscar irregular ou cursor invisível). A BIOS guarda
**um só formato** para todas as páginas. No PS/2 Model 30 os valores são ajustados
internamente (`CH×2`, `CL×2+1`) antes de ir ao hardware. Nos EGA e PS/2 com emulação de
cursor ligada (`AH=12H, BL=34H`), os valores são escalados para a altura da célula atual.

> **Dica:** para esconder o cursor em muitos adaptadores, use `CH=20H`. Para restaurar o
> cursor sublinhado padrão em 80×25 colorido, use `CX=0607H`.

### AH = 02H · Posicionar o cursor

`DH` = linha, `DL` = coluna (**base 0**, canto superior esquerdo = 0,0), `BH` = página.

### AH = 03H · Ler o cursor

Entrada: `BH` = página. Retorna `DH,DL` = posição e `CH,CL` = formato do cursor.

```asm fragmento titulo="Imprimir na linha 12, coluna 30, e voltar para onde estava"
        MOV  AH,03H
        MOV  BH,0
        INT  10H            ; DX = posição atual
        PUSH DX
        MOV  AH,02H
        MOV  DX,0C1EH       ; linha 12 (0CH), coluna 30 (1EH)
        INT  10H
        ; ... escrever ...
        POP  DX
        MOV  AH,02H
        INT  10H            ; cursor de volta
```

## 3.4 AH = 04H · Caneta óptica

PC Convertible e PS/2 não têm suporte (retorna `AH=0`). Nos demais, `AH=1` indica leitura
válida, com linha e coluna do caractere em `DH,DL` e a posição em pixels em `CH`/`CX`
(linha de varredura) e `BX` (coluna de pixel). `BX`, `CX` e `DX` são sempre alterados.

## 3.5 AH = 05H · Página ativa

`AL` = nova página (**base 0**), dentro do máximo do modo. O PCjr trata esta função de forma
própria. Cada página de texto 80×25 ocupa 4000 bytes, arredondados para 4 KB: a página 1
começa em `B800:1000`, a 2 em `B800:2000`, e assim por diante. Desenhar numa página invisível
e depois ativá-la é a forma "texto" do *double buffer* da [Aula 24](../conteudo/aula24-paleta-animacao.md).

## 3.6 AH = 06H / 07H · Rolar janela para cima / para baixo

| Reg. | Uso |
|---|---|
| AL | linhas a rolar; `00H` apaga a janela toda |
| CH,CL | canto superior esquerdo (linha, coluna) |
| DH,DL | canto inferior direito (linha, coluna) |
| BH | atributo das linhas novas em branco |

```asm fragmento titulo="Limpar a tela inteira de 80×25 com cinza sobre preto"
MOV  AX,0600H
MOV  BH,07H
XOR  CX,CX
MOV  DX,184FH       ; linha 24, coluna 79
INT  10H
```

Rolar só uma janela é a base das interfaces "de caixas" dos anos 90: uma área de mensagens
que rola enquanto o resto da tela fica parado.

## 3.7 Caracteres no cursor: AH = 08H, 09H e 0AH

### AH = 08H · Ler caractere e atributo

`BH` = página. Retorna `AL` = caractere e, em texto, `AH` = atributo.

### AH = 09H / 0AH · Escrever no cursor

`BH` = página, `CX` = repetições, `AL` = caractere. A 09H também usa `BL` (atributo em
texto, cor em gráficos); a 0AH preserva o atributo existente. **Nenhuma das duas move o
cursor**: para escrever uma frase com 09H, avance o cursor com 02H a cada caractere (ou use
`AH=13H`, [Capítulo 4](cap04-video-paleta-fontes-strings.md)).

Cuidados em gráficos:

- Nos modos 4, 5 e 6 a ROM só tem os 128 primeiros caracteres; os outros 128 exigem apontar
  `INT 1FH` (`0000:007C`) para uma tabela própria de 1 KB (128 caracteres × 8 bytes).
- `CX > 1` só funciona dentro da mesma linha.
- Bit 7 de `BL` ligado = XOR com o que já está na tela (exceto modo 13H).
- No modo 13H, `BH` serve de cor de fundo.
- Em gráficos use a 09H, não a 0AH.

### O byte de atributo

Em modo texto, cada posição da tela ocupa **dois bytes** na memória: o código do caractere
(no endereço par) e o **atributo** (no ímpar). O atributo é:

```
   bit:  7     6  5  4     3     2  1  0
       ┌───┬─────────┬───┬─────────┐
       │ B │  fundo  │ I │  frente │
       └───┴─────────┴───┴─────────┘
   B = piscar (ou fundo intenso, ver AH=10H, AL=03H)    I = frente intensa
```

| Cor | Valor | Cor | Valor |
|---|---|---|---|
| preto | 0 | cinza escuro | 8 |
| azul | 1 | azul claro | 9 |
| verde | 2 | verde claro | 0AH |
| ciano | 3 | ciano claro | 0BH |
| vermelho | 4 | vermelho claro | 0CH |
| magenta | 5 | magenta claro | 0DH |
| marrom | 6 | amarelo | 0EH |
| cinza claro | 7 | branco | 0FH |

`1EH` = amarelo sobre azul (o clássico do Norton Commander e do Turbo Pascal); `4FH` =
branco sobre vermelho; `70H` = preto sobre cinza (vídeo reverso). O endereço do caractere na
linha `L`, coluna `C` de 80×25 é `B800:(L×80 + C)×2`, como na Aula 12.

## 3.8 AH = 0BH · Paleta de cores

Vale para os gráficos 320×200 da CGA. `BH` escolhe o que ajustar:

- `BH = 00H`: `BL` = cor de **fundo** (cor 0) em 320×200; em texto, a cor da **borda**
  (0 a 31, sendo 16 a 31 o conjunto de alta intensidade). No EGA/PS/2 em 640×200 gráfico,
  define o fundo.
- `BH = 01H`: `BL` = 0 ou 1 escolhe uma das duas paletas fixas de 3 cores do modo 4.

## 3.9 AH = 0CH / 0DH · Escrever / ler pixel

`DX` = linha, `CX` = coluna, `AL` = cor (na escrita) ou valor lido (na leitura), `BH` =
página quando o modo tem várias. Na escrita, bit 7 de `AL` = XOR com o pixel atual (exceto
modo 13H).

Esta é a forma **portátil** e **lenta** de desenhar. A [Aula 23](../conteudo/aula23-modo13h.md)
compara esta função com a escrita direta em `A000:(y×320+x)`, que é dezenas de vezes mais
rápida no modo 13H. Use a BIOS quando o modo for desconhecido ou para testes; escreva na
memória quando a velocidade importa.

## 3.10 AH = 0EH · Teletipo

`AL` = caractere. Escreve na página ativa, **avança o cursor**, quebra a linha e rola a tela.
CR (0DH), LF (0AH), Backspace (08H) e Bell (07H) são interpretados como comandos. Nos modos
gráficos, `BL` dá a cor do caractere. Nas BIOS de 24/04/81 e 19/10/81, `BH` também precisa
conter a página ativa.

```asm fragmento titulo="Imprimir OK no console via BIOS"
MOV  AH,0EH
MOV  AL,'O'
INT  10H
MOV  AL,'K'
INT  10H
```

> **BIOS ou DOS?** `INT 21H, AH=02H/09H` passa pelo DOS e pode ser redirecionada para arquivo
> (`PROG > SAIDA.TXT`). `INT 10H, AH=0EH` vai sempre para a tela. Use a BIOS em programas
> gráficos, TSRs e setores de boot, onde o DOS não está disponível ou não é reentrante
> ([Aula 27](../conteudo/aula27-tsr.md)).

## 3.11 AH = 0FH · Estado atual

Retorna `AL` = modo, `AH` = número de colunas da tela, `BH` = página ativa. Os mesmos
valores ficam na área de dados da BIOS em `40:49` (modo), `40:4A` (colunas) e `40:62`
(página), detalhados no [Capítulo 17](cap17-area-de-dados-da-bios.md).

## 3.12 Exemplo completo: uma janela no estilo DOS

O programa abaixo usa só funções deste capítulo: limpa a tela de azul, abre uma "janela"
cinza com rolagem, escreve um título com atributo próprio e espera uma tecla. Roda no
simulador do curso.

```asm titulo="JANELA.ASM: janela de texto só com INT 10H"
.MODEL SMALL
.STACK 100h
.DATA
titulo  DB  ' BIOS DO PC ',0
modo    DB  ?
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX

        MOV  AH,0FH          ; guarda o modo atual
        INT  10H
        MOV  modo,AL

        MOV  AX,0600H        ; fundo azul na tela toda
        MOV  BH,1FH          ; branco sobre azul
        XOR  CX,CX
        MOV  DX,184FH
        INT  10H

        MOV  AX,0600H        ; janela cinza de (5,10) a (15,69)
        MOV  BH,70H          ; preto sobre cinza
        MOV  CX,050AH
        MOV  DX,0F45H
        INT  10H

        MOV  AH,02H          ; cursor no título: linha 5, coluna 33
        MOV  BH,0
        MOV  DX,0521H
        INT  10H
        MOV  SI,OFFSET titulo
proximo:
        LODSB
        CMP  AL,0
        JE   fim_titulo
        PUSH AX
        MOV  AH,09H          ; caractere com atributo
        MOV  BX,004FH        ; página 0, branco sobre vermelho
        MOV  CX,1
        INT  10H
        MOV  AH,03H          ; lê o cursor...
        INT  10H
        INC  DL              ; ...e avança uma coluna, pois 09H não move
        MOV  AH,02H
        INT  10H
        POP  AX
        JMP  proximo
fim_titulo:
        MOV  AH,00H          ; espera uma tecla (Capítulo 6)
        INT  16H

        MOV  AH,00H          ; restaura o modo original
        MOV  AL,modo
        INT  10H
        MOV  AX,4C00H
        INT  21H
END inicio
```

## 3.13 No simulador do curso

Funcionam: 00H (modos 3 e 13H), 02H, 03H (devolve o formato fixo `0607H`), 06H e 07H (no modo
13H só limpam a tela com `AL=0`), 08H, 09H, 0AH, 0CH e 0DH (modo 13H), 0EH e 0FH. 01H e 05H são
aceitas e não fazem nada (há uma página só). 04H e 0BH não têm serviço. Os campos `40:49` e
`40:4A` são mantidos.

## 3.14 Exercícios

1. Escreva `ESCREVA_EM`, um procedimento que recebe linha em `DH`, coluna em `DL`, atributo em
   `BL` e uma string terminada em 0 em `DS:SI`, usando `AH=09H` e `AH=02H`.
2. Reescreva o exercício 1 sem a BIOS, gravando direto em `B800:0000`, e compare a quantidade
   de instruções executadas no depurador do laboratório.
3. Faça um programa que rola só a janela de (2,2) a (10,40) uma linha por tecla pressionada,
   escrevendo um número novo na última linha a cada rolagem.
4. Use `AH=0FH` para descobrir as colunas da tela e centralize uma mensagem na linha 0.
5. No modo 13H, desenhe a diagonal de (0,0) a (199,199) com `AH=0CH` e depois com escrita
   direta em `A000H`. Qual é mais rápida no simulador? (Veja a Aula 23.)

## Resumo

- `AH=00H` troca o modo (bit 7 de AL preserva a tela); `AH=0FH` lê o modo, as colunas e a
  página. Guarde e restaure o modo original.
- Cursor: 01H formato, 02H posiciona, 03H lê; linhas e colunas são base 0.
- 06H/07H rolam ou limpam janelas; 09H e 0AH escrevem sem mover o cursor; 0EH escreve e move.
- O atributo de texto é `piscar|fundo(3)|intenso|frente(3)`.
- Pixels pela BIOS (0CH/0DH) são portáveis e lentos; a memória direta é o caminho rápido.
