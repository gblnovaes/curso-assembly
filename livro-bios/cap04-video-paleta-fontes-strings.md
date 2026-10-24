---
id: cap04
numero: 4
parte: 2
titulo: "Vídeo II: paleta, DAC, fontes, seleções alternativas e strings (INT 10H, AH=10H a 13H)"
aulas: aula23; aula24; aula13
---

# Capítulo 4 · Vídeo II: paleta, DAC, fontes, seleções alternativas e strings

> **Neste capítulo:** o "painel de controle" do EGA e dos PS/2: registradores de paleta e de
> cor (DAC), carga de fontes e o truque dos 512 caracteres, as seleções alternativas da
> função 12H e a escrita de strings com atributo.
>
> **Antes de ler:** [Aula 24, Paleta, retraço e animação](../conteudo/aula24-paleta-animacao.md)
> (o DAC pelas portas 3C8H/3C9H e "A paleta pela BIOS") e [Aula 13, Instruções de string](../conteudo/aula13-strings.md).

Quase tudo aqui depende do adaptador. Se a função não é suportada, a BIOS simplesmente
**não faz nada**: não há código de erro. Por isso os programas detectam o adaptador antes
([Capítulo 5](cap05-video-estado-e-deteccao.md)) ou conferem o valor que algumas funções
devolvem em `AL`.

## 4.1 AH = 10H · Registradores de paleta e de cor

Dois mundos convivem:

```
  atributo/pixel ──► PALETA (16 registradores) ──► DAC (256 registradores R,G,B) ──► monitor
                     EGA, PCjr, PS/2               só PS/2 (VGA e MCGA)
                     (exceto Model 30)
```

- **Paleta (16 registradores + overscan)**: PCjr, EGA e PS/2 (exceto Model 30). Cada entrada
  escolhe qual **registrador de cor** o pixel ou atributo usa.
- **Registradores de cor (DAC, valores RGB)**: PS/2. Cada registrador guarda vermelho, verde
  e azul, de 0 a 63 cada (6 bits), o que dá 262.144 cores possíveis.

No modo 13H a paleta de 16 entradas é contornada e o byte do pixel escolhe diretamente um dos
256 registradores do DAC, que é o que a Aula 24 explora.

### Paleta (AL = 00H a 09H)

| AL | Ação | Registradores |
|---|---|---|
| 00H | Define um registrador de paleta | `BL` = registrador, `BH` = valor |
| 01H | Define o overscan (borda) | `BH` = valor |
| 02H | Define todos + overscan | `ES:DX` → tabela de 17 bytes (16 valores + overscan) |
| 03H | Alterna *intensify* / *blink* | `BL=0` intensidade, `BL=1` piscar |
| 07H | Lê um registrador (PS/2) | `BL` = registrador; retorno em `BH` |
| 08H | Lê o overscan (PS/2) | retorno em `BH` |
| 09H | Lê todos + overscan (PS/2) | `ES:DX` → buffer de 17 bytes |

A função 03H define o que o **bit 7 do atributo de texto** significa: piscar o caractere ou
acender o fundo (16 cores de fundo). Muitos programas a usam para liberar as 16 cores de
fundo.

> **Receita: 16 cores de fundo em texto.** `MOV AX,1003H` / `MOV BL,0` / `INT 10H`. Depois
> disso, o atributo `0F0H` é preto sobre branco brilhante, em vez de preto sobre cinza piscando.

### Registradores de cor, o DAC (AL = 10H a 1BH, PS/2)

| AL | Ação | Registradores |
|---|---|---|
| 10H | Define um registrador de cor | `BX` = nº; `DH`=R, `CH`=G, `CL`=B |
| 12H | Define um bloco | `ES:DX` → tabela R,G,B,R,G,B…; `BX` = primeiro; `CX` = quantidade |
| 13H | Seleciona paginação de cor | veja abaixo |
| 15H | Lê um registrador | `BX` = nº; retorna `DH`,`CH`,`CL` |
| 17H | Lê um bloco | `ES:DX` → destino; `BX`, `CX` |
| 1AH | Lê estado da paginação | retorna `BL` = modo, `BH` = página atual |
| 1BH | Converte para tons de cinza | `BX` = primeiro, `CX` = quantidade |

**Paginação de cor (AL=13H; não vale no modo 13H).** Os 256 registradores podem ser vistos
em dois arranjos:

- `BL=0`: escolhe o arranjo, `BH=0` → 4 blocos de 64; `BH=1` → 16 blocos de 16.
- `BL=1`: escolhe o bloco ativo (`BH` = número do bloco).

O *set mode* assume o arranjo de 4×64 com o primeiro bloco ativo e só inicializa esse bloco;
para usar outros blocos, carregue-os por conta própria. Trocar o bloco ativo muda **todas** as
cores da tela de uma vez, o que permite animações "de graça" em modos de 16 cores.

**Cinza (AL=1BH).** Cada registrador é substituído pela soma ponderada
**30 % vermelho + 59 % verde + 11 % azul**, escrita nos três componentes. O valor original é
perdido; guarde a paleta com `AL=17H` antes se quiser voltar.

**PS/2 Model 30.** É um subconjunto: `AL=00H` com `BX=0712H` ajusta os registradores para 8
cores coerentes; existem 03H, 10H, 12H, 15H, 17H e 1BH; os demais são reservados. Em sistemas
sem esta capacidade, nada acontece.

### BIOS ou portas para o DAC?

A [Aula 24](../conteudo/aula24-paleta-animacao.md) programa o DAC escrevendo o índice na porta
`3C8H` e os três componentes em `3C9H`. As duas formas chegam ao mesmo registrador:

| | BIOS (`AX=1010H`/`1012H`) | Portas `3C8H`/`3C9H` |
|---|---|---|
| Portabilidade | funciona em qualquer PS/2, inclusive Model 30 | exige hardware compatível com VGA |
| Velocidade | uma chamada por bloco, com sobrecarga | `OUT` direto, ideal dentro do retraço |
| Leitura | `AX=1015H`/`1017H` | índice em `3C7H`, dados em `3C9H` |

```asm fragmento titulo="Escurecer a paleta inteira em 64 passos, pela BIOS"
; paleta DB 768 DUP(?)  ; cópia de trabalho: 256 × (R,G,B)
        PUSH DS
        POP  ES
        MOV  AX,1017H         ; lê os 256 registradores
        XOR  BX,BX
        MOV  CX,256
        MOV  DX,OFFSET paleta
        INT  10H
        MOV  BP,64            ; 64 passos bastam: cada componente vai de 0 a 63
passo:  MOV  SI,OFFSET paleta
        MOV  CX,768
dim:    CMP  BYTE PTR [SI],0
        JE   ja_zero
        DEC  BYTE PTR [SI]
ja_zero: INC  SI
        LOOP dim
        MOV  AX,1012H         ; grava o bloco de volta
        XOR  BX,BX
        MOV  CX,256
        MOV  DX,OFFSET paleta
        INT  10H
        ; (esperar o retraço vertical aqui, como na Aula 24)
        DEC  BP
        JNZ  passo
```

## 4.2 AH = 11H · Gerador de caracteres (fontes)

Em sistemas com EGA esta função **refaz o modo de vídeo** (reinicia o ambiente de vídeo, mas
preserva o conteúdo do buffer). Por isso:

> Chame as subfunções de carga (10H a 14H, 20H a 24H) **logo depois de um *set mode***; em
> outro momento o resultado é imprevisível.

### Carregar fontes (AL = 00H a 04H e 10H a 14H)

| Operação | AL (sem recalcular) | AL (recalcula a geometria) |
|---|---|---|
| Fonte do usuário | 00H | 10H |
| ROM 8×14 (no Model 30: reservado, usa 04H) | 01H | 11H |
| ROM 8×8 *double dot* | 02H | 12H |
| ROM 8×16 (PS/2) | 04H | 14H |

Parâmetros da fonte do usuário: `ES:BP` → tabela; `CX` = quantos caracteres; `DX` = índice
do primeiro; `BL` = bloco de destino; `BH` = bytes por caractere. Nas fontes da ROM basta
`BL` = bloco.

As variantes **1xH** fazem a mesma carga, mas **recalculam a geometria da tela**: exigem a
página 0 ativa, recalculam os pontos por caractere, as linhas
(`INT(200, 350 ou 400 / pontos) − 1`) e o tamanho do buffer (`linhas × colunas × 2`), e
reprogramam registradores do controlador CRTC (altura da célula, início e fim do cursor, fim
da área visível e, só no modo 7, a linha de sublinhado). Se os valores finais ficarem longe
dos da tabela original, o resultado pode ser imprevisível.

> **O modo de 50 linhas.** Num PS/2 com VGA em 400 linhas de varredura, carregar a fonte 8×8
> com recálculo dá `400/8 = 50` linhas de texto: `MOV AX,0003H` / `INT 10H` / `MOV AX,1112H` /
> `MOV BL,0` / `INT 10H`. No EGA (350 linhas) o mesmo dá 43 linhas. Era assim que editores e o
> próprio DOS (`MODE CON LINES=50`) faziam.

No **Model 30**, `AL=10H/11H/12H/14H/22H` são reservados e executados como as versões sem
recálculo (`00H/01H/02H/04H/24H`). Com 400 linhas e `BH=14` os caracteres são esticados
repetindo a última linha até 16.

### Seleção de bloco (AL = 03H) e os 512 caracteres

Define quais blocos de fonte ficam ativos em modos de texto, e é a base para usar **512
caracteres** na tela. `BL` indica um bloco para quando o bit 3 do atributo do caractere é 0 e
outro para quando é 1.

| Plataforma | Blocos | Bits de `BL` (bit 3 do atributo = 0) | (bit 3 = 1) |
|---|---|---|---|
| EGA, Model 30 | 0–3 | bits 1,0 | bits 3,2 |
| PS/2 (exceto Model 30) | 0–7 | bits 4,1,0 | bits 5,3,2 |

Se os dois campos escolhem o mesmo bloco, a tela usa **256 caracteres** e o bit 3 do atributo
controla a intensidade do primeiro plano, como de costume. Se são blocos diferentes, a tela
tem 512 caracteres e o bit 3 escolhe o bloco (perdendo a função de intensidade).

Exemplos: no EGA, `BL=0FH` seleciona só o bloco 3; `BL=0CH` usa os blocos 0 e 3. No PS/2,
`BL=3AH` seleciona só o bloco 6; `BL=28H` usa os blocos 0 e 6. Ao ativar 512 caracteres,
recomenda-se `AX=1000H, BX=0712H` para ter 8 cores de primeiro plano coerentes. No Model 30,
depois de qualquer carga é preciso emitir a seleção de bloco para o bloco carregado ficar
ativo.

### Fontes gráficas (AL = 20H a 24H)

| AL | Efeito |
|---|---|
| 20H | Aponta o vetor **INT 1FH** para uma tabela do usuário (caracteres 128–255 em gráficos CGA): `ES:BP` |
| 21H | Aponta **INT 43H** para uma tabela do usuário: `ES:BP`, `CX` = pontos por caractere, `BL` = linhas (`0` = definido pelo usuário em `DL`; `1` = 14; `2` = 25; `3` = 43) |
| 22H | Usa a ROM 8×14 (`BL` = especificador de linhas) |
| 23H | Usa a ROM 8×8 *double dot* |
| 24H | Usa a ROM 8×16 (PS/2) |

### Informações sobre as fontes (AL = 30H)

`BH` escolhe qual ponteiro de fonte devolver. Retorno: `ES:BP` = ponteiro, `CX` = pontos por
caractere, `DL` = linhas na tela (menos 1).

| BH | Fonte |
|---|---|
| 00H | Ponteiro atual de INT 1FH |
| 01H | Ponteiro atual de INT 43H (EGA: 44H) |
| 02H | ROM 8×14 |
| 03H | ROM 8×8 |
| 04H | ROM 8×8 (metade superior) |
| 05H | ROM 9×14 alternativa |
| 06H | ROM 8×16 (PS/2) |
| 07H | ROM 9×16 alternativa (PS/2) |

`AX=1130H` com `BH=03H` é o jeito portátil de achar o desenho dos caracteres na ROM para
escrever texto **ampliado** ou em modo gráfico com as suas próprias rotinas, como a seção
"Texto no modo gráfico" da [Aula 23](../conteudo/aula23-modo13h.md). Cada caractere ocupa
`CX` bytes seguidos, um por linha, com o bit 7 sendo o pixel mais à esquerda.

## 4.3 AH = 12H · Seleções alternativas

A subfunção vai em `BL`. Em caso de sucesso, quase todas devolvem `AL = 12H` ("função
suportada"), um jeito prático de **detectar** se o sistema oferece a função.

| BL | Função | Entrada / saída |
|---|---|---|
| 10H | Informações do EGA | Retorno: `BH` (0 = cor/3Dx, 1 = mono/3Bx); `BL` = memória (0=64K, 1=128K, 2=192K, 3=256K); `CH` = bits do adaptador; `CL` = chaves |
| 20H | Rotina alternativa de Print Screen | — |
| 30H | Linhas de varredura para texto (PS/2, exceto Model 30) | `AL` = 0 (200), 1 (350), 2 (400); vale no próximo *set mode* |
| 31H | Carga da paleta padrão no *set mode* | `AL` = 0 habilita, 1 desabilita |
| 32H | Habilitar/desabilitar o vídeo | `AL` = 0 habilita, 1 desabilita (decodificação de portas e buffer do display ativo) |
| 33H | Soma para cinza | `AL` = 0 habilita, 1 desabilita (atua no *set mode* e em 10H) |
| 34H | Emulação de cursor | `AL` = 0 habilita, 1 desabilita; padrão = habilitada |
| 35H | Troca de display (PS/2) | `AL` = 00H a 03H, veja abaixo |
| 36H | Tela ligada/desligada (PS/2, exceto Model 30) | `AL` = 0 liga, 1 desliga |

- **31H**: com a carga desabilitada, nenhum *set mode* mexe nas 16 paletas, no overscan nem
  nos 256 registradores de cor. Útil para preservar uma paleta personalizada entre trocas de
  modo.
- **34H**: habilitada, os valores de início e fim do cursor passados à função 01H são
  **escalados** para a altura da célula atual, de modo que um cursor "sublinhado" fica
  sublinhado em qualquer fonte.
- **36H**: desligar a tela durante um redesenho pesado evita o "rasgo" e acelera a escrita
  em algumas placas.

No **Model 30**, 30H e 34H são reservadas.

### Troca de display (BL = 35H)

Permite alternar entre o vídeo da placa-mãe e o de um adaptador quando os dois disputam a área
de dados da BIOS e recursos de hardware. Exige que ambos tenham a função de desabilitar
(BL=32H). Se não há conflito, os dois ficam ativos e a troca nem é necessária; se há, o
adaptador é o vídeo primário e o da placa-mãe fica desabilitado.

| AL | Ação |
|---|---|
| 00H | Desliga o vídeo inicial do adaptador (`ES:DX` → área de 128 bytes) |
| 01H | Liga o vídeo inicial da placa-mãe |
| 02H | Desliga o vídeo ativo e salva seu estado (`ES:DX` → buffer) |
| 03H | Liga o vídeo inativo e restaura o estado salvo (`ES:DX` → buffer previamente salvo) |

Os passos 00H e 01H só valem na primeira inicialização; depois, a troca é feita com 02H e
03H, sempre com o buffer de estado do respectivo display.

## 4.4 AH = 13H · Escrever string

Disponível no PC XT (BIOS de 10/01/86 em diante), AT, EGA, PC Convertible e PS/2.

Entrada comum: `ES:BP` → string, `CX` = quantidade de **caracteres**, `DX` = posição (linha
em `DH`, coluna em `DL`), `BH` = página.

| AL | Formato da string | Atributo | Cursor |
|---|---|---|---|
| 00H | caracteres | `BL` | não move |
| 01H | caracteres | `BL` | move |
| 02H | caractere, atributo, caractere, atributo… | na própria string | não move |
| 03H | caractere, atributo… | na própria string | move |

As formas 02H e 03H só valem em modos de texto. CR, LF, Backspace e Bell são tratados como
comandos. Atenção a dois detalhes que pegam iniciantes: a string vem em **ES:BP**, não em
DS:SI ou DS:DX; e `CX` conta caracteres, não bytes (nas formas 02H e 03H a string tem o dobro
de bytes).

```asm fragmento titulo="Escrever uma string com atributo na linha 10, coluna 30"
msg     DB  'Ola, BIOS!'
; ...
        PUSH DS
        POP  ES            ; ES:BP deve apontar a string (aqui ela está em DS)
        MOV  BP,OFFSET msg
        MOV  CX,10         ; 10 caracteres
        MOV  DX,0A1EH      ; linha 10, coluna 30
        MOV  BX,0007H      ; página 0, atributo 07H
        MOV  AX,1301H      ; escreve e move o cursor
        INT  10H
```

> **Cuidado com BP.** BP é o registrador da moldura de pilha da
> [Aula 10](../conteudo/aula10-parametros.md). Dentro de um procedimento que usa `[BP+4]` para
> parâmetros, salve BP com `PUSH BP` antes de usá-lo como ponteiro da string.

## 4.5 No simulador do curso

Funcionam: `AX=1010H`, `1012H`, `1015H` e `1017H` (DAC) e `AX=1130H` (ponteiro da fonte 8×8 da
ROM, com `CX=8`). As outras subfunções de 10H e 11H geram um aviso e não fazem nada; 12H e 13H
não têm serviço. Para strings use `AH=09H` com `AH=02H` ([Capítulo 3](cap03-video-modos-e-texto.md))
ou escreva direto em `B800:0000`.

## 4.6 Exercícios

1. No modo 13H, grave um degradê de 64 tons de azul nos registradores 0 a 63 com uma única
   chamada `AX=1012H`. Compare com a solução por portas da Aula 24.
2. Leia a paleta inteira com `AX=1017H`, converta para cinza em memória com a fórmula
   30/59/11 (use `MUL` e divida por 100) e grave com `AX=1012H`. Compare com `AX=101BH`.
3. Use `AX=1130H, BH=03H` para obter a fonte 8×8 e escreva a letra "A" ampliada 8 vezes no
   modo 13H (cada bit vira um quadrado de 8×8 pixels).
4. Escreva uma string em que cada caractere tem uma cor diferente usando `AX=1302H` e uma
   tabela `DB 'B',1FH,'I',2FH,'O',4FH,'S',6FH`. Quanto vale `CX`?

## Resumo

- `AH=10H`: paleta de 16 (EGA) e DAC de 256 cores RGB de 6 bits (PS/2). `AX=1003H, BL=0`
  libera 16 cores de fundo.
- `AH=11H`: carregar fontes logo depois do *set mode*; as variantes 1xH recalculam linhas
  (o truque das 43/50 linhas); `AL=03H` habilita 512 caracteres; `AL=30H` acha as fontes.
- `AH=12H`: detecção (`AL=12H` no retorno), linhas de varredura, preservar paleta, emulação
  de cursor, troca de display.
- `AH=13H`: string em `ES:BP`, `CX` caracteres, com ou sem atributos embutidos.
