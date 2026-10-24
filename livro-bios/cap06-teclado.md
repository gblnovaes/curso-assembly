---
id: cap06
numero: 6
parte: 2
titulo: "O teclado: INT 09H, INT 16H, Ctrl-Break e scan codes"
aulas: aula14; aula19; aula28; aula29
---

# Capítulo 6 · O teclado: INT 09H, INT 16H, Ctrl-Break e scan codes

> **Neste capítulo:** o caminho de uma tecla desde a porta 60H até o seu programa; o tratador
> de hardware `INT 09H` e os ganchos que ele oferece; as funções da `INT 16H`, clássicas e
> estendidas; o buffer circular em `40:1E`; e as regras dos *scan codes*.
>
> **Antes de ler:** [Aula 14](../conteudo/aula14-interrupcoes.md) (seção "Teclado pela BIOS:
> INT 16h"), [Aula 19, Menus e entrada de dados](../conteudo/aula19-menu-entrada.md) e
> [Aula 28, O teclado por dentro e TSRs com tecla de atalho](../conteudo/aula28-tsr-teclado.md),
> que é o par prático deste capítulo.

## 6.1 O caminho de uma tecla

```
 tecla ─► controlador do teclado ─► porta 60H + IRQ 1 ─► INT 09H (BIOS)
                                                          │  ├─ INT 15H, AH=4FH  (interceptação)
                                                          │  ├─ Shift/Ctrl/Alt → 40:17, 40:18, 40:96
                                                          │  ├─ Print Screen   → INT 05H
                                                          │  ├─ Ctrl-Break     → INT 1BH
                                                          │  ├─ SysRq          → INT 15H, AH=85H
                                                          │  └─ tecla comum    → buffer em 40:1E
                                                          ▼
                                              INT 16H (seu programa lê do buffer)
```

Dois níveis: a `INT 09H` é a interrupção de **hardware** (acontece sozinha a cada tecla); a
`INT 16H` é o **serviço** que o seu programa chama para ler o que a 09H guardou.

## 6.2 INT 09H · Teclado (interrupção de hardware)

Disparada no *make* (tecla pressionada) e no *break* (tecla solta) de cada tecla. O *break
code* é o *make code* com o bit 7 ligado (Esc: make `01H`, break `81H`).

- **Teclas ASCII:** ao ler o *make code* na **porta 60H**, o tratador coloca o par
  (código de caractere, *scan code*) no buffer circular de **32 bytes** que começa em `40:1E`,
  na posição apontada pelo ponteiro de cauda em `40:1C`. A cauda avança 2 bytes e volta ao
  início do buffer se passar do fim.
- **Ctrl, Alt, Shift:** a cada make/break, atualiza os bytes de estado em `40:17` e `40:18`
  (controle do teclado) e `40:96` (modo e tipo do teclado).
- **Ctrl-Alt-Del:** grava `1234H` no flag de reset em `40:72` (significa "pule o teste de
  memória") e salta para o POST. O POST verifica esse flag e, se encontrar `1234H`, não retesta
  a memória. No PC Convertible, em vez de saltar ao POST, faz um reset do processador.
- **Pause:** o tratador fica em laço até que uma tecla ASCII válida seja pressionada. No PC
  Convertible usa `INT 15H, AH=41H` (esperar evento externo).
- **Print Screen:** emite `INT 05H` ([Capítulo 2](cap02-vetores-e-excecoes.md)).
- **Ctrl-Break:** emite `INT 1BH`.

### Ganchos para o sistema (dependem do modelo e da data da BIOS)

| Condição | Serviço chamado |
|---|---|
| PC XT (BIOS de 10/01/86 ou posterior), AT, XT 286, PC Convertible, PS/2, tecla **System Request** | `INT 15H, AH=85H` informa o make (`AL=00H`) ou break (`AL=01H`) da tecla; além disso, `INT 15H, AH=91H` com `AL=02H` (tipo = teclado) indica que há tecla disponível |
| AT (BIOS de 10/06/85 ou posterior), XT 286, PC Convertible, PS/2 | `INT 15H, AH=4FH` (*keyboard intercept*) é chamado logo após ler o *scan code* da porta 60H, permitindo que o sistema **troque ou descarte** o código. O EOI é feito no retorno |

### INT 15H, AH = 4FH · Interceptação do teclado

Na entrada: `AL` = *scan code* e `CF = 1`. Quem intercepta o vetor da `INT 15H` pode:

1. trocar `AL` por outro código e retornar com `CF=1`: a tecla muda;
2. consumir a tecla e retornar com `CF=0`: a `INT 09H` a ignora;
3. devolver `AL` intacto com `CF=1`: a tecla passa normalmente.

PC XT de 08/11/82 e AT de 10/01/84 retornam `AH=86H` (não suportado). O bit 4 do byte de
recursos de `INT 15H, AH=C0H` diz se a `INT 09H` chama a 4FH ([Capítulo 8](cap08-equipamento-e-memoria.md)).

> **Hotkeys residentes.** Esta é a base das teclas de atalho de TSRs: o programa engancha a
> `INT 15H`, reconhece a sua combinação quando `AH=4FH` e devolve `CF=0` para que ela não
> chegue a ninguém mais. Em máquinas sem a 4FH (o PC e o XT antigos, como o 8086 do curso), a
> alternativa é enganchar a própria `INT 09H` e espiar a porta 60H antes de chamar o tratador
> original, que é o caminho da [Aula 28](../conteudo/aula28-tsr-teclado.md).

```asm fragmento titulo="Tratador de INT 15H que engole F12 (scan 58H) quando AH=4FH"
nova15  PROC FAR
        CMP  AH,4FH
        JNE  repassa
        CMP  AL,58H              ; make de F12?
        JNE  repassa
        ; ... marcar "atalho pedido" numa variável CS: ...
        CLC                      ; CF=0: a tecla some
        RETF 2                   ; volta descartando os FLAGS empilhados
repassa:
        JMP  DWORD PTR CS:antigo15
nova15  ENDP
```

O `RETF 2` é o truque para **devolver flags** de dentro de uma rotina de interrupção: em vez
de `IRET` (que restauraria os flags antigos, com o CF original), retorna como `FAR` e descarta
a palavra de flags da pilha (IF continua como a `INT` deixou, isto é, desligado; quem chamou
a `INT 15H` cuida disso). A outra forma é alterar o bit 0 (CF) na cópia dos flags que está na
pilha, em `[BP+6]` depois de `PUSH BP` / `MOV BP,SP`, e sair com `POP BP` / `IRET`.

### INT 1BH · Ctrl-Break

A `INT 09H` executa `INT 1BH` quando detecta Ctrl-Break. O DOS instala aqui uma rotina que
marca o pedido para, depois, encerrar o programa no próximo ponto seguro (o famoso `^C`). Um
programa que não quer ser interrompido aponta `INT 1BH` (e a `INT 23H` do DOS) para um `IRET` e
restaura os vetores na saída. O byte `40:71` (bit 7) registra que o Break foi pressionado.

## 6.3 INT 16H · Serviços de teclado

Convivem o teclado "clássico" (83/84 teclas) e o de **101/102 teclas** (estendido). As
funções clássicas (00H a 05H) funcionam em todo lugar; as estendidas (10H a 12H) existem em AT
com BIOS de 15/11/85 em diante, PC XT de 10/01/86 em diante, XT 286 e PS/2.

| AH | Função | Disponibilidade |
|---|---|---|
| 00H | Ler tecla (espera, retira do buffer) | todos |
| 01H | Ver se há tecla (não retira) | todos |
| 02H | Estado dos modificadores | todos |
| 03H | Taxa de repetição (*typematic*) | PCjr; AT 15/11/85+, XT 286, PS/2 |
| 04H | Clique do teclado | PCjr, PC Convertible |
| 05H | Escrever no buffer | AT 15/11/85+, PC XT 10/01/86+, XT 286, PS/2 |
| 10H | Ler tecla estendida | como acima |
| 11H | Ver se há tecla estendida | como acima |
| 12H | Estado estendido | como acima |

### O buffer e as duas famílias

A `INT 09H` põe pares (ASCII, *scan code*) num buffer circular na área de dados: **cabeça** em
`40:1A` (próxima tecla a ler), **cauda** em `40:1C` (próxima posição livre), dados em `40:1E`.
Cabeça igual à cauda significa buffer vazio. Os limites do buffer ficam em `40:80` e `40:82`.

| Ação | Clássica | Estendida |
|---|---|---|
| Ler tecla (espera, **retira** do buffer) | 00H | 10H |
| Ver se há tecla (**não retira**) | 01H | 11H |
| Estado dos modificadores | 02H | 12H |

A diferença está no que fazem com as teclas "novas" do teclado de 101 teclas (F11/F12, setas
separadas, Ctrl/Alt da direita etc.):

- As funções **estendidas** devolvem o código **como está** no buffer, sem tradução.
- As funções **clássicas** traduzem para o código equivalente do teclado antigo e **pulam**
  entradas que não têm equivalente.

Resultado prático: programa antigo usa 00H/01H e continua funcionando; programa novo usa
10H/11H/12H para enxergar todas as teclas.

**Como detectar as funções estendidas:** grave o código `FFFFH` no buffer com a função 05H e
leia de volta com 10H; se vier `FFFFH`, elas existem.

### AH = 00H e 01H · Ler e espiar

- `00H` espera uma tecla e a **remove** do buffer: `AL` = ASCII, `AH` = *scan code*. Em AT e
  posteriores, se não há tecla, a BIOS chama `INT 15H, AH=90H, AL=02H` para avisar o sistema
  operacional que o teclado está em espera, permitindo trocar de tarefa
  ([Capítulo 16](cap16-multitarefa.md)).
- `01H` não espera: `ZF=1` = sem tecla; `ZF=0` = há tecla, devolvida em `AX` **sem remover**.

```asm fragmento titulo="Laço de jogo: faz outras coisas enquanto não há tecla"
quadro: ; ... desenhar, mover inimigos ...
        MOV  AH,01H
        INT  16H
        JZ   quadro          ; sem tecla: próximo quadro
        MOV  AH,00H
        INT  16H             ; AL = caractere, AH = scan code
        CMP  AH,01H          ; Esc?
        JNE  quadro
```

> A Aula 19 lê linhas inteiras com o DOS (`INT 21H, AH=0AH`). Para menus que reagem a uma
> tecla só, a `INT 16H` é mais direta e não ecoa nada na tela.

### AH = 02H e 12H · Estado de Shift

`02H` devolve em `AL` (a cópia de `40:17`):

| Bit | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
|---|---|---|---|---|---|---|---|---|
| Significado | Insert ativo | Caps Lock | Num Lock | Scroll Lock | Alt | Ctrl | Shift esq. | Shift dir. |

`12H` devolve o mesmo em `AL` e, em `AH`, o estado estendido: 7 SysRq pressionada, 6 Caps Lock
pressionada, 5 Num Lock pressionada, 4 Scroll Lock pressionada, 3 Alt **direita**, 2 Ctrl
**direita**, 1 Alt esquerda, 0 Ctrl esquerda.

Nos bits 4 a 7 de `AL`, "ativo" é o **estado** (a luz acesa); nos bits 4 a 7 de `AH`,
"pressionada" é a tecla fisicamente apertada naquele momento.

### AH = 03H · Taxa de repetição (*typematic*)

- **PCjr:** `AL=00H` a `04H` ajusta atraso e repetição em passos fixos (04H desliga a
  repetição).
- **AT (BIOS de 15/11/85 em diante), XT 286, PS/2:** `AL=05H` define taxa e atraso: `BL` =
  taxa (00H = 30 caracteres/s … 1FH = 2 caracteres/s, decrescente), `BH` = atraso inicial
  (00H = 250 ms, 01H = 500, 02H = 750, 03H = 1000).

```asm fragmento titulo="Repetição mais rápida (30 cps), atraso mínimo (250 ms)"
        MOV  AX,0305H
        XOR  BX,BX
        INT  16H
```

### AH = 04H e 05H

- `04H` (PCjr e PC Convertible): `AL=00H` desliga e `AL=01H` liga o clique do teclado.
- `05H` **escreve** uma tecla no buffer como se ela tivesse sido digitada: `CL` = ASCII,
  `CH` = *scan code*. Retorna `AL=00H` ok ou `01H` buffer cheio. Útil para injetar teclas
  (macros, testes automáticos, um TSR que "digita" uma data).

## 6.4 Scan codes e códigos de caractere

O manual traz, tecla por tecla, os pares *scan code / ASCII* devolvidos pela `INT 16H` em três
colunas: teclado de 83/84 teclas, 101/102 teclas (função padrão) e 101/102 teclas (função
estendida). Para as teclas comuns, as três são iguais:

| Tecla | Scan / ASCII | Tecla | Scan / ASCII |
|---|---|---|---|
| Esc | `01/1B` | Tab | `0F/09` |
| 1 | `02/31` | q | `10/71` |
| Backspace | `0E/08` | Enter | `1C/0D` |

Regras úteis:

- Teclas ASCII devolvem em `AL` o caractere e em `AH` o *scan code*.
- Teclas **sem** ASCII (setas, F1 a F10, Home, End, PgUp, PgDn, Ins, Del) devolvem `AL=00H`
  (ou `E0H` nas funções estendidas, para as teclas duplicadas do teclado de 101 teclas) e o
  *scan code* em `AH`. É assim que um programa as distingue de caracteres normais: `CMP AL,0`
  antes de olhar `AH`.
- O teclado de 101/102 teclas duplica algumas teclas (setas e bloco de edição separados do
  bloco numérico). As funções clássicas (00H/01H) as tornam iguais às antigas; as estendidas
  (10H/11H) as distinguem.

Alguns *scan codes* muito usados, os mesmos da tabela da Aula 28:

| Tecla | Scan | Tecla | Scan | Tecla | Scan |
|---|---|---|---|---|---|
| F1 | `3BH` | ↑ | `48H` | Home | `47H` |
| F10 | `44H` | ↓ | `50H` | End | `4FH` |
| F11 | `57H` | ← | `4BH` | PgUp | `49H` |
| F12 | `58H` | → | `4DH` | PgDn | `51H` |
| Espaço | `39H` | Ins | `52H` | Del | `53H` |

Para a tabela completa, incluindo as combinações com Shift, Ctrl e Alt, consulte a seção
"Scan Code/Character Code Combinations" do manual original.

## 6.5 Exemplo completo: o espião de teclas

```asm titulo="TECLAS.ASM: mostra ASCII e scan code de cada tecla até Esc"
.MODEL SMALL
.STACK 100h
.DATA
cab     DB  'Pressione teclas (Esc sai). ASCII SCAN',13,10,'$'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        MOV  DX,OFFSET cab
        MOV  AH,09H
        INT  21H
le:     MOV  AH,00H
        INT  16H              ; AL = ASCII, AH = scan
        PUSH AX
        CALL imphex8          ; ASCII
        MOV  DL,' '
        MOV  AH,02H
        INT  21H
        POP  AX
        PUSH AX
        MOV  AL,AH
        CALL imphex8          ; scan code
        MOV  DL,13
        MOV  AH,02H
        INT  21H
        MOV  DL,10
        INT  21H
        POP  AX
        CMP  AH,01H           ; Esc?
        JNE  le
        MOV  AX,4C00H
        INT  21H

imphex8 PROC
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  DH,AL
        MOV  CL,4
        SHR  AL,CL
        CALL digito
        MOV  AL,DH
        AND  AL,0FH
        CALL digito
        POP  DX
        POP  CX
        POP  AX
        RET
imphex8 ENDP

digito  PROC
        ADD  AL,'0'
        CMP  AL,'9'
        JBE  escreve
        ADD  AL,7
escreve: MOV  DL,AL
        MOV  AH,02H
        INT  21H
        RET
digito  ENDP
END inicio
```

## 6.6 No simulador do curso

Funcionam: `INT 16H` com 00H/10H (espera tecla), 01H/11H (espia, com ZF) e 02H (sempre
devolve `AL=0`). O tratador nativo de `INT 09H` lê a porta 60H, descarta Shift, Ctrl e Alt e
põe as outras teclas no buffer; pode ser enganchado como na Aula 28. `INT 15H, AH=4FH` não é
chamada (o simulador é um PC de 8086, anterior a ela). 03H, 04H, 05H e 12H não fazem nada.

## 6.7 Exercícios

1. Modifique `TECLAS.ASM` para escrever o nome da tecla quando ela for uma das da tabela de
   *scan codes* (F1, setas, Home…), usando uma tabela de pares (scan, ponteiro para nome).
2. Escreva uma rotina `TEM_TECLA` que lê diretamente `40:1A` e `40:1C` e devolve `ZF=1` se o
   buffer está vazio, sem chamar a BIOS. Compare com `AH=01H`.
3. Use `AH=05H` para injetar a palavra `DIR` seguida de Enter no buffer e termine o programa.
   O que o DOS faz em seguida? (Num PC real ou no DOSBox.)
4. Faça um "medidor de Shift": um laço que mostra continuamente, com `AH=02H`, quais
   modificadores estão pressionados, até Esc.

## Resumo

- `INT 09H` (hardware) lê a porta 60H e preenche o buffer em `40:1E`; `INT 16H` (serviço) lê
  dele.
- 00H/10H esperam e retiram; 01H/11H espiam com ZF; 02H/12H dão o estado dos modificadores.
- `INT 15H, AH=4FH` deixa trocar ou engolir teclas (AT 10/06/85 em diante); em PCs antigos,
  engancha-se a `INT 09H`.
- Teclas sem ASCII voltam com `AL=0` (ou `E0H`) e o *scan code* em `AH`.
- Ctrl-Break gera `INT 1BH`; Ctrl-Alt-Del grava `1234H` em `40:72`.
