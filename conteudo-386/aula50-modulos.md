---
id: aula50
numero: 50
modulo: 16
titulo: Vários módulos: PUBLIC, EXTRN e o ligador
subtitulo: Dividir um programa grande em arquivos que se encontram no LINK
duracao: 70 min
objetivos: entender o caminho fonte → .OBJ → ligador → .EXE; exportar nomes com PUBLIC e importá-los com EXTRN; saber como o ligador junta segmentos de mesmo nome; reconhecer os erros clássicos de ligação
---

## Um arquivo só não escala

O shell do MINIOS ([aula 43](aula:aula43)) tem mais de mil linhas num arquivo só. Para achar a rotina que lê a linha de comando, você rola a tela. Para mudar uma letra, o montador refaz o arquivo inteiro. E se duas pessoas quiserem trabalhar nele ao mesmo tempo, uma vai apagar o trabalho da outra.

Todo sistema grande, do MS-DOS ao Linux, é dividido em **módulos**: arquivos-fonte separados, montados (ou compilados) um por um, e depois **ligados** num executável. Cada módulo esconde os seus detalhes e mostra aos outros só o que eles precisam usar.

```diagrama titulo="Do fonte ao executável"
  PRINC.ASM ──► MASM ──► PRINC.OBJ ──┐
                                      ├──► LINK ──► PROG.EXE
  ROTINAS.ASM ► MASM ──► ROTINAS.OBJ ─┘        └──► PROG.MAP (opcional)

  montar: cada .ASM sozinho, sem saber dos outros
  ligar: juntar os .OBJ, resolver os nomes e fixar os endereços
```

## O que um .OBJ guarda

Ao montar um módulo, o MASM sabe tudo sobre ele, menos duas coisas: **onde** os seus segmentos vão parar no programa final e **o que** são os nomes que vêm de outros módulos. Por isso um .OBJ (no formato OMF da Intel, usado pelo MASM e pelo TASM) guarda, além dos bytes:

- os **segmentos** do módulo, com nome e classe (`_TEXT`, `CODE`; `_DATA`, `DATA`...);
- os **nomes públicos**: os que este módulo oferece, com o deslocamento de cada um;
- os **nomes externos**: os que este módulo usa e não definiu;
- os **fixups**: os lugares do código onde falta um endereço, porque ele depende de um nome externo ou da posição final de um segmento.

O ligador lê todos os .OBJ, decide a posição de cada pedaço, calcula os endereços que faltavam e escreve os fixups. Os que dependem do lugar onde o DOS vai carregar o programa, os números de segmento, viram a tabela de relocação do .EXE ([aula 49](avancado:aula49)).

## PUBLIC e EXTRN

Por padrão, todo nome é **local** ao módulo. Para que outro módulo o enxergue, são precisas duas declarações:

- `PUBLIC nome` no módulo que **define** o nome;
- `EXTRN nome:tipo` no módulo que **usa** o nome.

O tipo diz ao montador como usar algo que ele não pode ver:

| Tipo no EXTRN | Para | O montador gera |
|---|---|---|
| `NEAR` | um PROC ou rótulo no mesmo segmento de código | `CALL` com deslocamento de 16 bits |
| `FAR` | um PROC FAR, em outro segmento | `CALL` com segmento e deslocamento |
| `BYTE`, `WORD`, `DWORD` | uma variável | acessos de 8, 16 ou 32 bits |
| `ABS` | uma constante (`EQU`) | o número, como imediato |

```asm executar titulo="SOMA3.ASM: três módulos ligados"
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN TAM:ABS, tabela:WORD, somar:NEAR
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  CX, TAM            ; constante do módulo DADOS
        MOV  SI, OFFSET tabela  ; variável do módulo DADOS
        CALL somar              ; rotina do módulo SOMA: BX = soma
        MOV  AX, 4C00h
        INT  21h
        END  inicio             ; só o principal diz onde começa
;### MODULO DADOS.ASM
        .MODEL SMALL
        PUBLIC TAM, tabela
TAM     EQU 4
        .DATA
tabela  DW 10, 20, 30, 40
        END
;### MODULO SOMA.ASM
        .MODEL SMALL
        PUBLIC somar
        .CODE
; somar: BX = soma de CX words a partir de DS:SI
somar   PROC
        XOR  BX, BX
proxima:
        ADD  BX, [SI]
        ADD  SI, 2
        LOOP proxima
        RET
somar   ENDP
        END
```

Rode no passo a passo e veja BX chegar a 100 (0064h). No depurador, os nomes locais aparecem com o nome do módulo na frente quando há mais de um igual.

:::dica Os módulos neste curso
Um bloco de código pode ter várias partes que começam com `;### MODULO NOME.ASM`. Cada parte é montada como um módulo separado, com os seus próprios nomes, e o simulador faz o papel do LINK: junta tudo num programa só. Um bloco também pode ter partes `;### INCLUIR NOME.INC`, que são arquivos para a diretiva `INCLUDE` ([aula 51](avancado:aula51)). Funciona no laboratório também.
:::

### END só uma vez com rótulo

Cada módulo termina com `END`, mas só **um** deles diz onde o programa começa: `END inicio`. Nos outros, `END` sozinho. Se dois módulos tiverem rótulo no END, o ligador não sabe qual escolher.

## Como os segmentos se juntam

Os três módulos do exemplo usam `.CODE`, e todos os `.CODE` se chamam `_TEXT`. O ligador junta os segmentos de **mesmo nome** num só, um depois do outro, **na ordem em que os módulos aparecem** na linha de comando. O mesmo vale para `_DATA`.

```diagrama titulo="_TEXT depois da ligação"
  _TEXT (um segmento só)
  ┌─────────────────────────────┐ 0000h
  │ código de PRINC.OBJ         │  inicio
  ├─────────────────────────────┤ 0013h
  │ código de SOMA.OBJ          │  somar  (era 0000h dentro de SOMA.OBJ)
  └─────────────────────────────┘

  O MASM montou SOMA.ASM achando que somar estava em 0000h.
  O ligador soma 0013h ao endereço e corrige o CALL somar de PRINC.
```

O `CALL somar` do módulo principal foi montado sem saber o endereço. O ligador escreve o endereço final ali: esse é um **fixup**. Como os dois estão no mesmo segmento, um `CALL NEAR` basta.

:::cpu E os dados?
No `.MODEL SMALL`, `_DATA` e a pilha formam o grupo **DGROUP**, e DS aponta para o começo dele. Os deslocamentos das variáveis são contados a partir do DGROUP, então a `tabela` de DADOS.ASM e as variáveis de outros módulos ficam todas acessíveis com o mesmo DS.
:::

### O mapa

O LINK podia gerar um arquivo .MAP com a posição de cada segmento e de cada nome público. Era a primeira coisa que se olhava quando um programa travava num endereço estranho:

```texto titulo="PROG.MAP (resumido)"
 Start  Stop   Length Name        Class
 00000H 0001CH 0001DH _TEXT       CODE
 00020H 00027H 00008H _DATA       DATA
 00030H 0012FH 00100H STACK       STACK

  Address         Publics by Name
 0002:0000       TABELA
 0000:0013       SOMAR
 0000:0004  Abs  TAM
```

```quiz
? Um módulo define a variável total e outro quer usá-la. O que falta?
- Só EXTRN total:WORD no módulo que usa
- Só PUBLIC total no módulo que define
+ PUBLIC total no que define e EXTRN total:WORD no que usa
> PUBLIC exporta e EXTRN importa. Sem os dois, cada módulo enxerga só os próprios nomes.

? Dois módulos têm uma variável local chamada x, sem PUBLIC. O que acontece?
+ Nada: cada módulo usa a sua
- O ligador acusa símbolo definido duas vezes
- O segundo x sobrescreve o primeiro
> Nomes locais não saem do .OBJ. O conflito só acontece se os dois forem PUBLIC.
```

## Os erros do ligador

Cada mensagem clássica do LINK tem uma causa simples:

| Mensagem do LINK | Causa | No simulador |
|---|---|---|
| `Unresolved external: SOMAR` | alguém fez EXTRN, ninguém fez PUBLIC | "EXTRN SOMAR: nenhum módulo declarou PUBLIC SOMAR" |
| `Symbol defined more than once: X` | dois módulos com PUBLIC X | "Símbolo X definido mais de uma vez" |
| `Undefined symbol` (no MASM) | o nome é de outro módulo e falta o EXTRN | "SOMAR está no módulo SOMA.ASM. Declare EXTRN..." |
| `No stack segment` | nenhum módulo tem `.STACK` | "Sem .STACK: usando pilha de 1024 bytes" |

## Erros que você vai cometer

- **Tipo errado no EXTRN.** `EXTRN tabela:BYTE` para uma variável DW monta sem erro: o montador só conhece o que o EXTRN diz, e o LINK não confere. O programa lê um byte onde devia ler uma word. O simulador avisa, o MASM não avisava.
- **END com rótulo em dois módulos.** Escreva `END inicio` só no principal.
- **Esquecer o `.MODEL` num módulo.** Cada módulo é montado sozinho e precisa saber o modelo.
- **PUBLIC de um nome que não existe.** Um erro de digitação no PUBLIC só aparece quando outro módulo tenta usar o nome.

## Exercícios

```exercicio
id: a50-1
titulo: Ligue os dois módulos
nivel: 1
--- enunciado
O módulo **CALC.ASM** tem a rotina **dobro** (AX = AX × 2), mas o programa não monta: falta exportar a rotina num módulo e importá-la no outro. Corrija sem mudar o código das instruções.

O programa termina com o resultado em **CX**.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        .CODE
inicio: CALL dobro
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO CALC.ASM
        .MODEL SMALL
        .CODE
dobro   PROC
        ADD  AX, AX
        RET
dobro   ENDP
        END
--- testes
[{ "nome": "AX = 21", "setup": { "AX": 21 }, "espera": { "CX": 42 } },
 { "nome": "AX = 1000", "setup": { "AX": 1000 }, "espera": { "CX": 2000 } }]
--- dicas
No módulo CALC.ASM: PUBLIC dobro.
No módulo PRINC.ASM, antes de usar: EXTRN dobro:NEAR.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN dobro:NEAR
        .CODE
inicio: CALL dobro
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO CALC.ASM
        .MODEL SMALL
        PUBLIC dobro
        .CODE
dobro   PROC
        ADD  AX, AX
        RET
dobro   ENDP
        END
```

```exercicio
id: a50-2
titulo: Um módulo de rotinas
nivel: 2
--- enunciado
Escreva o módulo **MAIOR.ASM** com a rotina pública **maior**: ela devolve em **AX** o maior entre AX e BX, **com sinal**. O módulo principal já está pronto e guarda o resultado em CX.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN maior:NEAR
        .CODE
inicio: CALL maior
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO MAIOR.ASM
        .MODEL SMALL
        .CODE
        ; escreva aqui a rotina pública maior
        END
--- testes
[{ "nome": "maior(3, 8) = 8", "setup": { "AX": 3, "BX": 8 }, "espera": { "CX": 8 } },
 { "nome": "maior(9, 2) = 9", "setup": { "AX": 9, "BX": 2 }, "espera": { "CX": 9 } },
 { "nome": "maior(-5, 2) = 2 (com sinal)", "setup": { "AX": 65531, "BX": 2 }, "espera": { "CX": 2 } },
 { "nome": "maior(-1, -7) = -1", "setup": { "AX": 65535, "BX": 65529 }, "espera": { "CX": 65535 } }]
--- dicas
PUBLIC maior no começo do módulo, e o PROC dentro do .CODE.
Com sinal: CMP AX,BX / JGE pronto / MOV AX,BX.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN maior:NEAR
        .CODE
inicio: CALL maior
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO MAIOR.ASM
        .MODEL SMALL
        PUBLIC maior
        .CODE
maior   PROC
        CMP  AX, BX
        JGE  pronto
        MOV  AX, BX
pronto: RET
maior   ENDP
        END
```

```exercicio
id: a50-3
titulo: Uma variável compartilhada
nivel: 2
--- enunciado
Escreva o módulo **CONTA.ASM** com:

- uma variável pública **contador** (DW, começando em 0), no `.DATA`;
- uma rotina pública **incrementa**, que soma 1 ao contador.

O módulo principal chama `incrementa` três vezes e copia o contador para BX.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN contador:WORD, incrementa:NEAR
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        CALL incrementa
        CALL incrementa
        CALL incrementa
        MOV  BX, contador
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO CONTA.ASM
        .MODEL SMALL
        ; escreva aqui
        END
--- testes
[{ "nome": "três chamadas", "espera": { "BX": 3, "mem": { "contador": 3 } } }]
--- dicas
PUBLIC contador, incrementa.
No .DATA: contador DW 0. No .CODE: um PROC com INC contador e RET.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN contador:WORD, incrementa:NEAR
        .CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        CALL incrementa
        CALL incrementa
        CALL incrementa
        MOV  BX, contador
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO CONTA.ASM
        .MODEL SMALL
        PUBLIC contador, incrementa
        .DATA
contador DW 0
        .CODE
incrementa PROC
        INC  contador
        RET
incrementa ENDP
        END
```

```exercicio
id: a50-4
titulo: Uma constante de outro módulo
nivel: 3
--- enunciado
O módulo **CONFIG.ASM** define a constante pública **MAXIMO**. Complete o módulo principal: ele deve limitar **AX** a MAXIMO (se AX for maior, sem sinal, AX vira MAXIMO) e terminar com o resultado em **CX**.

Use a constante pelo nome, sem copiar o valor: se alguém mudar o CONFIG.ASM, o programa precisa acompanhar.
--- inicial
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        .CODE
inicio: ; limite AX a MAXIMO
        MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO CONFIG.ASM
        .MODEL SMALL
        PUBLIC MAXIMO
MAXIMO  EQU 50
        END
--- testes
[{ "nome": "AX = 10 fica 10", "setup": { "AX": 10 }, "espera": { "CX": 10 } },
 { "nome": "AX = 50 fica 50", "setup": { "AX": 50 }, "espera": { "CX": 50 } },
 { "nome": "AX = 300 vira 50", "setup": { "AX": 300 }, "espera": { "CX": 50 } }]
--- dicas
Uma constante vem com EXTRN MAXIMO:ABS.
Depois é como um número: CMP AX,MAXIMO / JBE ok / MOV AX,MAXIMO.
--- solucao
;### MODULO PRINC.ASM
        .MODEL SMALL
        .STACK 100h
        EXTRN MAXIMO:ABS
        .CODE
inicio: CMP  AX, MAXIMO
        JBE  ok
        MOV  AX, MAXIMO
ok:     MOV  CX, AX
        MOV  AX, 4C00h
        INT  21h
        END  inicio
;### MODULO CONFIG.ASM
        .MODEL SMALL
        PUBLIC MAXIMO
MAXIMO  EQU 50
        END
```

:::resumo
- Um programa grande é dividido em módulos, montados um por um em .OBJ e juntados pelo ligador.
- `PUBLIC nome` exporta um nome do módulo que o define; `EXTRN nome:tipo` importa no módulo que usa. Tipos: NEAR, FAR, BYTE, WORD, DWORD, ABS.
- O ligador junta os segmentos de mesmo nome na ordem dos módulos e corrige os endereços (fixups).
- Só um módulo tem `END inicio`; os outros terminam com `END`.
- Os erros clássicos: "Unresolved external" (falta PUBLIC) e "defined more than once" (dois PUBLIC).
:::
