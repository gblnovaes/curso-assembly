---
id: aula12
numero: 12
modulo: 5
titulo: Segmentos a fundo
subtitulo: Como 16 bits endereçam 1 MB, e a memória de vídeo em B800h
duracao: 75 min
objetivos: calcular endereços físicos a partir de segmento:offset; conhecer o mapa de memória do PC; usar prefixos de segmento (ES:, CS:, SS:); declarar segmentos completos com SEGMENT, ENDS e ASSUME; chamar procedimentos FAR e usar ponteiros longos com LDS e LES; escrever direto na memória de vídeo em B800h
---

## O problema: 16 bits não bastam

Os registradores do 8086 têm 16 bits, então um registrador sozinho aponta para no máximo 65.536 endereços (64 KB). Mas o 8086 tem **20 linhas de endereço**: ele enxerga 2²⁰ = 1.048.576 bytes, ou **1 MB**. Como fechar essa conta?

A solução da Intel foi combinar **dois** valores de 16 bits:

```diagrama titulo="Endereço físico = segmento × 16 + offset"
  segmento  1234h  ──►  1 2 3 4 0     (deslocado 4 bits = ×16)
  offset    0010h  ──►    0 0 1 0
                        ─────────
  físico               1 2 3 5 0h    (20 bits)
```

O **segmento** escolhe uma "janela" de 64 KB que começa em um múltiplo de 16 bytes (um **parágrafo**). O **offset** escolhe o byte dentro da janela. A notação é `segmento:offset`, por exemplo `1234:0010`.

Experimente no simulador abaixo. Mude o segmento e o offset e veja o endereço físico mudar:

```widget endereco
{ "seg": "1234h", "off": "0010h" }
```

## Muitos nomes para o mesmo byte

Como os segmentos andam de 16 em 16 bytes e cada um tem 64 KB, eles **se sobrepõem**. O mesmo endereço físico tem até 4.096 nomes diferentes:

| segmento:offset | cálculo | físico |
|-----------------|---------|--------|
| 1235:0000 | 12350 + 0000 | 12350h |
| 1234:0010 | 12340 + 0010 | 12350h |
| 1200:0350 | 12000 + 0350 | 12350h |
| 1000:2350 | 10000 + 2350 | 12350h |

Um endereço com offset entre 0 e 15 (como `1235:0000`) é chamado de **normalizado**. Comparar dois ponteiros longos só funciona com segurança depois de normalizá-los. Os compiladores C da época tinham até um modelo de memória (`huge`) que normalizava ponteiros a cada operação, e era bem mais lento por isso.

:::atencao O offset dá a volta dentro do segmento
O offset tem 16 bits. Se DI vale FFFFh e você faz `INC DI`, ele volta a 0000h, e o próximo acesso cai **no começo do mesmo segmento**, e não no byte seguinte da memória. Um bloco de dados nunca pode passar de 64 KB sem trocar de segmento.
:::

## O mapa de memória do PC

O 1 MB do PC não é todo seu. A IBM dividiu o espaço assim em 1981, e essa divisão durou até o fim do DOS:

```diagrama titulo="Mapa de memória do IBM PC (1 MB)"
  FFFFFh ┌──────────────────────────────┐
         │ ROM BIOS (F000h)             │  rotinas de INT 10h, 13h, 16h...
  F0000h ├──────────────────────────────┤
         │ ROMs de placas, EMS (C000h)  │  BIOS do vídeo, rede, discos
  C0000h ├──────────────────────────────┤
         │ texto colorido   (B800h)     │  80x25, 2 bytes por caractere
  B8000h │ texto mono       (B000h)     │  placas MDA/Hercules
  B0000h │ gráficos VGA     (A000h)     │  modo 13h: 320x200, 256 cores
  A0000h ├══════════════════════════════┤  <- limite dos famosos 640 KB
         │ seu programa .EXE / .COM     │
         │ DOS, drivers, COMMAND.COM    │
  00500h ├──────────────────────────────┤
         │ dados da BIOS    (0040h)     │  teclado, relógio, modo de vídeo
  00400h ├──────────────────────────────┤
         │ tabela de interrupções (IVT) │  256 vetores de 4 bytes
  00000h └──────────────────────────────┘
```

Os **640 KB** ("ninguém vai precisar de mais que isso", frase atribuída a Bill Gates, que ele sempre negou ter dito) são a memória convencional. Tudo acima de A0000h é reservado para vídeo e ROMs.

:::anos90 A guerra pela memória convencional
No começo dos anos 90, jogos como *Wing Commander* e *Strike Commander* exigiam 600 KB livres de memória convencional. Com o driver do mouse, do CD-ROM e da placa de som carregados, sobravam 540 KB. Daí nasceram os famosos disquetes de boot e os menus no `CONFIG.SYS`, com `DEVICEHIGH`, `LOADHIGH` e o `MEMMAKER` do MS-DOS 6, tudo para empurrar drivers para os buracos entre A0000h e FFFFFh.
:::

## A volta ao mundo em FFFF:0010

O que acontece com `FFFF:0010`? O cálculo dá FFFF0 + 0010 = **100000h**, um bit a mais que 20. O 8086 simplesmente perde esse bit: o endereço **dá a volta** e vira **00000h**.

:::cpu A20: o portão que a IBM amarrou no teclado
O 80286 tinha 24 linhas de endereço, então FFFF:0010 passou a acessar a memória acima de 1 MB de verdade. Só que alguns programas do DOS dependiam da volta do 8086! Para manter a compatibilidade, a IBM colocou uma porta lógica na linha de endereço 20 (a "A20") e a ligou... ao **controlador do teclado**, que tinha um pino sobrando. Ligar a A20 liberava os 64 KB menos 16 bytes acima de 1 MB, a **HMA**, que o MS-DOS 5 passou a usar com `DOS=HIGH` e o `HIMEM.SYS`. Neste curso a A20 está desligada, como em um 8086 real.
:::

```quiz
? Qual o endereço físico de B800:0000?
- B800h
+ B8000h
- 0B800h
> Segmento × 16 = B8000h, mais o offset 0.

? Qual destes endereços NÃO aponta para o mesmo byte que 2000:0100?
- 2010:0000
- 1FF0:0200
+ 2001:0100
> 2000:0100 = 20100h. 2001:0100 = 20010 + 0100 = 20110h.

? DI vale FFFFh e você faz INC DI. Qual o próximo endereço acessado por ES:[DI]?
+ ES:0000, no começo do mesmo segmento
- O byte seguinte da memória física
- O 8086 gera um erro de segmento
> O offset tem só 16 bits e dá a volta. O segmento não muda sozinho.

? Em que região começa a memória de vídeo em modo texto colorido?
- A000h
- C000h
+ B800h
> A000h é o modo gráfico VGA, B000h o texto monocromático e B800h o texto colorido.

? No 8086, qual o endereço físico de FFFF:0010?
- 100000h
+ 00000h
- FFFFFh
> O resultado 100000h tem 21 bits. O 8086 só tem 20 linhas de endereço, então o bit mais alto se perde.
```

## Quem usa qual segmento

Toda instrução que acessa memória usa um registrador de segmento, mesmo que você não escreva. As regras padrão são estas:

| Acesso | Segmento padrão | Pode trocar? |
|--------|-----------------|--------------|
| Busca de instruções (IP) | CS | não |
| Pilha (PUSH, POP, CALL, RET) | SS | não |
| Endereço com BP (`[BP+4]`) | SS | sim |
| Outros dados (`[BX]`, `[SI]`, variáveis) | DS | sim |
| Destino das instruções de string (`[DI]` em STOSB, MOVSB) | ES | não |

Para usar outro segmento, escreva um **prefixo de segmento** antes dos colchetes:

```asm fragmento
        MOV  AX, ES:[BX]        ; lê de ES em vez de DS
        MOV  CS:[contador], AX  ; grava em uma variável no segmento de código
        MOV  AL, SS:[SI]        ; lê da pilha usando SI
        MOV  DX, DS:[BP+2]      ; BP, mas no segmento de dados
```

O prefixo é um byte a mais no código (`26h` para ES, `2Eh` para CS, `36h` para SS, `3Eh` para DS) e custa **2 ciclos** a mais. Abra o código no laboratório e olhe a aba Listagem para ver o byte do prefixo.

:::cpu Por que CS: era tão usado
Uma rotina de interrupção (que veremos na Aula 15) pode ser chamada a qualquer momento, com DS apontando para os dados de **outro** programa. O único segmento garantido é CS. Por isso os programas residentes guardavam suas variáveis no próprio segmento de código e as acessavam com `CS:`.
:::

### As regras dos registradores de segmento

Os registradores de segmento são cidadãos de segunda classe no 8086. Você não pode fazer conta com eles e as formas de carregá-los são poucas:

| Permitido | Proibido |
|-----------|----------|
| `MOV DS, AX` | `MOV DS, 1234h` (imediato) |
| `MOV AX, ES` | `MOV DS, ES` (segmento para segmento) |
| `MOV ES, [var]` | `MOV CS, AX` (CS só muda com saltos far) |
| `PUSH ES` / `POP DS` | `ADD DS, 10h` (nenhuma aritmética) |

Por isso você vê `MOV AX,@DATA` / `MOV DS,AX` em todo programa: são duas instruções porque não existe `MOV DS,imediato`. Para copiar ES em DS sem estragar AX, o truque é `PUSH ES` / `POP DS`.

## Segmentos completos: SEGMENT, ENDS e ASSUME

As diretivas `.MODEL`, `.DATA` e `.CODE` que usamos até aqui são **simplificadas**: o MASM 5.0 as criou em 1987 para poupar trabalho. Antes disso, e em muitos programas dos anos 90, os segmentos eram declarados por extenso:

```asm executar titulo="COMPLETO.ASM: segmentos por extenso"
DADOS   SEGMENT
msg     DB 'Segmentos declarados por extenso!$'
DADOS   ENDS

PILHA   SEGMENT STACK
        DW 128 DUP(?)
PILHA   ENDS

CODIGO  SEGMENT
        ASSUME CS:CODIGO, DS:DADOS, SS:PILHA
inicio: MOV  AX, DADOS          ; o nome do segmento vale o seu endereço
        MOV  DS, AX
        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
CODIGO  ENDS
        END inicio
```

- `nome SEGMENT` ... `nome ENDS` delimitam um segmento. O nome, usado como valor (`MOV AX,DADOS`), é o endereço do segmento em parágrafos.
- `STACK` marca o segmento da pilha: o DOS carrega SS e SP com ele automaticamente.
- `ASSUME` **não gera código**. Ele só informa ao montador qual registrador de segmento vai apontar para cada segmento, para que ele saiba quando precisa de um prefixo.

:::atencao ASSUME é uma promessa, não uma ordem
`ASSUME DS:DADOS` não carrega DS. Você ainda precisa do `MOV AX,DADOS` / `MOV DS,AX`. Esquecer isso era o erro mais comum de quem estava começando: o montador acreditava na promessa, o programa lia os dados do lugar errado e imprimia lixo na tela.
:::

## Saltos e procedimentos FAR

Um `CALL` comum (near) empilha só o IP e salta dentro do mesmo segmento de código. Um programa grande, com mais de 64 KB de código, precisa de vários segmentos de código, e aí entram os procedimentos **FAR**:

| | near | far |
|-|------|-----|
| `CALL` empilha | IP (2 bytes) | CS e IP (4 bytes) |
| retorno | `RET` (C3h) | `RETF` (CBh) |
| ciclos do `CALL` direto | 19 | 28 |
| ciclos do retorno | 16 (ou 8) | 26 (ou 18) |

Quando um procedimento é declarado com `PROC FAR`, o montador gera `RETF` no lugar de `RET` e `CALL` far em todas as chamadas a ele.

```asm executar titulo="LONGE.ASM: chamada far entre segmentos de código"
DADOS   SEGMENT
msg     DB 'Voltei do outro segmento!$'
DADOS   ENDS

PILHA   SEGMENT STACK
        DW 64 DUP(?)
PILHA   ENDS

CODIGO  SEGMENT
        ASSUME CS:CODIGO, DS:DADOS, SS:PILHA
inicio: MOV  AX, DADOS
        MOV  DS, AX
        CALL FAR PTR ROTINA     ; empilha CS e IP
        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
CODIGO  ENDS

BIBLIO  SEGMENT
        ASSUME CS:BIBLIO
ROTINA  PROC FAR
        MOV  CX, 1234h          ; observe CS diferente aqui
        RET                     ; o montador gera RETF
ROTINA  ENDP
BIBLIO  ENDS
        END inicio
```

Execute passo a passo no laboratório e observe o valor de **CS** mudar dentro de `ROTINA` e a pilha guardar 4 bytes.

## Ponteiros longos: DD, LDS e LES

Um ponteiro far (segmento + offset) ocupa 4 bytes e é declarado com `DD`. Na memória, o **offset vem primeiro** e o segmento depois. Duas instruções carregam um ponteiro longo de uma vez só:

- `LDS reg, [mem]`: reg = offset, **DS** = segmento.
- `LES reg, [mem]`: reg = offset, **ES** = segmento.

```asm fragmento
.DATA
tela    DD 0B8000000h       ; B800:0000 (offset 0000h, segmento B800h)
.CODE
        LES  DI, tela       ; ES = B800h, DI = 0000h, em uma instrução
        MOV  WORD PTR ES:[DI], 1E41h
```

## A memória de vídeo em modo texto

Chegou a hora de aproveitar os segmentos para algo visível. Em modo texto colorido, a tela de 80 × 25 caracteres está mapeada a partir de **B800:0000**. Cada posição ocupa **dois bytes**:

```diagrama titulo="Cada célula da tela = caractere + atributo"
  offset:   0     1     2     3     4     5   ...
          ┌─────┬─────┬─────┬─────┬─────┬─────┐
          │ 'O' │ 1Eh │ 'K' │ 1Eh │ ' ' │ 07h │ ...
          └─────┴─────┴─────┴─────┴─────┴─────┘
           caractere  atributo

  atributo:  bit 7    bits 6-4    bit 3     bits 2-0
             piscar    fundo      brilho     frente
  1Eh = 0001 1110 = fundo 1 (azul), frente E (amarelo)
```

| Cor | Valor | Cor | Valor |
|-----|-------|-----|-------|
| Preto | 0 | Cinza escuro | 8 |
| Azul | 1 | Azul claro | 9 |
| Verde | 2 | Verde claro | A |
| Ciano | 3 | Ciano claro | B |
| Vermelho | 4 | Vermelho claro | C |
| Magenta | 5 | Magenta claro | D |
| Marrom | 6 | Amarelo | E |
| Cinza claro | 7 | Branco | F |

O offset de uma posição é **(linha × 80 + coluna) × 2**. A linha 12, coluna 36 fica no offset (12 × 80 + 36) × 2 = 1992.

```asm executar titulo="VIDEO.ASM: escrevendo direto na tela"
.MODEL SMALL
.STACK 100h
.DATA
texto   DB 'GRAVADO DIRETO NA MEMORIA DE VIDEO'
TAM     EQU $ - texto
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0B800h         ; ES aponta para a tela
        MOV  ES, AX

        MOV  SI, OFFSET texto
        MOV  DI, (10*80 + 23)*2 ; linha 10, coluna 23
        MOV  CX, TAM
        MOV  AH, 1Fh            ; branco brilhante em fundo azul
@@laco: MOV  AL, [SI]           ; caractere vem de DS
        MOV  ES:[DI], AX        ; caractere + atributo de uma vez
        INC  SI
        ADD  DI, 2
        LOOP @@laco

        MOV  AX, 4C00h
        INT  21h
END inicio
```

Repare no `MOV ES:[DI], AX`: como o 8086 é little-endian, AL (o caractere) vai para o endereço par e AH (o atributo) para o ímpar. Uma única instrução escreve a célula inteira.

:::anos90 Por que todo jogo escrevia em B800h
Imprimir com `INT 21h` passa pelo DOS, que passa pela BIOS, que calcula a posição, move o cursor e trata caracteres especiais: centenas de ciclos por letra. Escrever em B800h custa uns 20. Editores como o *QEdit*, o *Norton Commander* e as telas de setup dos jogos desenhavam as janelas inteiras assim, e por isso eram instantâneos mesmo em um XT de 4,77 MHz.
:::

:::cpu O "chuvisco" da placa CGA
Na placa CGA original, se a CPU escrevesse na memória de vídeo enquanto a placa desenhava a tela, apareciam riscos brancos ("snow"). Os programas cuidadosos esperavam o retraço horizontal lendo a porta 3DAh antes de cada escrita. As placas EGA e VGA resolveram o problema.
:::

```quiz
? Por que não se pode escrever MOV DS, 1234h?
- Porque 1234h não é um segmento válido
+ Porque o 8086 não tem MOV de imediato para registrador de segmento
- Porque DS só pode ser carregado pelo DOS
> É preciso passar por um registrador geral: MOV AX,1234h / MOV DS,AX.

? Qual o segmento padrão de MOV AX, [BP+6]?
- DS
+ SS
- ES
> Endereços com BP usam SS, porque BP foi feito para acessar a pilha.

? O que ASSUME DS:DADOS faz em tempo de execução?
+ Nada: só informa ao montador qual segmento DS vai apontar
- Carrega DS com o endereço de DADOS
- Cria o segmento DADOS
> ASSUME não gera nenhum byte de código. Carregar DS continua sendo sua responsabilidade.

? Quantos bytes um CALL far empilha?
- 2
+ 4
- 6
> CS (2 bytes) e IP (2 bytes). O retorno precisa ser RETF.

? Qual o offset em B800h da linha 1, coluna 0?
- 80
+ 160
- 1
> (1 × 80 + 0) × 2 = 160. Cada linha ocupa 160 bytes: 80 caracteres e 80 atributos.
```

## Exercícios

```exercicio
id: a12-1
titulo: OK na tela
nivel: 1
--- enunciado
Sem usar o DOS para imprimir, escreva **OK** no canto superior esquerdo da tela (linha 0, colunas 0 e 1), com **amarelo sobre azul** (atributo 1Eh), gravando direto na memória de vídeo em B800h.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        ; aponte ES para a memória de vídeo e grave os caracteres

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "OK amarelo sobre azul em (0,0)", "espera": { "video": { "0": ["O", 30], "1": ["K", 30] } } }]
--- dicas
Não existe MOV ES,0B800h. Passe por AX.
A célula 0 está no offset 0 e a célula 1 no offset 2.
MOV WORD PTR ES:[0], 1E4Fh grava 'O' (4Fh) com atributo 1Eh.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 0B800h
        MOV  ES, AX
        MOV  WORD PTR ES:[0], 1E4Fh     ; 'O'
        MOV  WORD PTR ES:[2], 1E4Bh     ; 'K'
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a12-2
titulo: Calculando o endereço físico
nivel: 3
--- enunciado
Escreva o código que calcula o endereço físico de **BX:SI** (segmento em BX, offset em SI). O resultado tem 20 bits: guarde os 16 bits baixos na variável **baixo** e os 4 bits altos na variável **alto**. Por exemplo, B800:0000 dá alto = 000Bh e baixo = 8000h. **BX e SI precisam ser preservados.** Lembre que o 8086 não tem `SHL AX,4`: deslocamentos de mais de 1 bit usam CL.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
baixo   DW ?
alto    DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; BX = segmento, SI = offset
        ; calcule BX * 16 + SI e guarde em alto:baixo

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "1234:0010 = 12350h", "setup": { "BX": 4660, "SI": 16 }, "espera": { "mem": { "alto": 1, "baixo": 9040 }, "BX": 4660, "SI": 16 } },
 { "nome": "B800:0000 = B8000h", "setup": { "BX": 47104, "SI": 0 }, "espera": { "mem": { "alto": 11, "baixo": 32768 } } },
 { "nome": "0040:006C = 0046Ch", "setup": { "BX": 64, "SI": 108 }, "espera": { "mem": { "alto": 0, "baixo": 1132 } } },
 { "nome": "2000:FFFF = 2FFFFh", "setup": { "BX": 8192, "SI": 65535 }, "espera": { "mem": { "alto": 2, "baixo": 65535 } } },
 { "nome": "1FFF:FFF0 = 2FFE0h (com vai-um)", "setup": { "BX": 8191, "SI": 65520 }, "espera": { "mem": { "alto": 2, "baixo": 65504 }, "BX": 8191, "SI": 65520 } }]
--- dicas
Os 16 bits baixos de BX × 16 são BX deslocado 4 bits à esquerda: MOV CL,4 / SHL AX,CL.
Os 4 bits altos são BX deslocado 12 bits à direita.
Some SI aos 16 bits baixos e propague o vai-um para os altos com ADC DX,0.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
baixo   DW ?
alto    DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, BX
        MOV  DX, BX
        MOV  CL, 4
        SHL  AX, CL         ; AX = 16 bits baixos de BX*16
        MOV  CL, 12
        SHR  DX, CL         ; DX = 4 bits altos de BX*16
        ADD  AX, SI
        ADC  DX, 0          ; vai-um do offset
        MOV  baixo, AX
        MOV  alto, DX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a12-3
titulo: Faixa colorida
nivel: 2
--- enunciado
Copie a string **titulo** para a tela na **linha 12, coluna 36**, com **branco sobre vermelho** (atributo 4Fh). Leia os caracteres de DS:SI e grave em ES:DI, um por vez, com um laço.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
titulo  DB 'ASSEMBLY'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "ASSEMBLY na linha 12, coluna 36", "espera": { "telaContem": "ASSEMBLY", "video": { "996": ["A", 79], "999": ["E", 79], "1003": ["Y", 79] } } }]
--- dicas
O offset inicial é (12 × 80 + 36) × 2 = 1992.
Coloque o atributo em AH, o caractere em AL e grave AX inteiro com MOV ES:[DI],AX.
Avance SI de 1 em 1 e DI de 2 em 2. São 8 caracteres.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
titulo  DB 'ASSEMBLY'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  AX, 0B800h
        MOV  ES, AX
        MOV  SI, OFFSET titulo
        MOV  DI, (12*80 + 36)*2
        MOV  CX, 8
        MOV  AH, 4Fh
@@laco: MOV  AL, [SI]
        MOV  ES:[DI], AX
        INC  SI
        ADD  DI, 2
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Endereço físico = segmento × 16 + offset, com 20 bits (1 MB). O mesmo byte tem muitos nomes segmento:offset.
- O offset dá a volta dentro do segmento; FFFF:0010 dá a volta para 00000h no 8086 (A20 desligada).
- Segmentos padrão: CS para código, SS para pilha e BP, DS para dados, ES para o destino das strings. Prefixos como `ES:` trocam o padrão.
- Registradores de segmento só recebem valores de registradores gerais, da memória ou de POP. CS só muda com saltos far.
- `SEGMENT`/`ENDS` declaram segmentos; `ASSUME` só informa o montador. `PROC FAR` gera `RETF`; `LDS`/`LES` carregam ponteiros longos.
- A tela de texto fica em B800h: 2 bytes por célula (caractere e atributo), offset = (linha × 80 + coluna) × 2.
:::
