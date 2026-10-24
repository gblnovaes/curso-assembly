---
id: cap05
numero: 5
parte: 2
titulo: "Vídeo III: LCD, DCC, estado, salvar/restaurar e detecção do adaptador (INT 10H, AH=14H a 1CH)"
aulas: aula23; aula24; aula27
---

# Capítulo 5 · Vídeo III: estado, salvar/restaurar e detecção do adaptador

> **Neste capítulo:** as funções finais da `INT 10H` (fonte do LCD do PC Convertible, código
> de combinação de display, quadro de funcionalidade e estado, salvar e restaurar o estado do
> vídeo) e a receita da IBM para descobrir qual placa de vídeo está instalada.
>
> **Antes de ler:** [Capítulo 3](cap03-video-modos-e-texto.md) e
> [Capítulo 4](cap04-video-paleta-fontes-strings.md). A seção 5.5 interessa a quem escreve TSRs
> ([Aula 27](../conteudo/aula27-tsr.md)) que desenham sobre a tela de outro programa.

## 5.1 AH = 14H · Fonte do LCD (somente PC Convertible)

O PC Convertible tem um display LCD próprio. Esta função controla a fonte de caracteres do
LCD e como a "alta intensidade" é representada (um LCD monocromático não tem como mostrar
brilho extra).

| AL | Ação | Entrada |
|---|---|---|
| 00H | Carrega fonte do usuário | `ES:DI` → fonte; `CX` = nº de caracteres (1–256); `DX` = deslocamento na RAM de fonte; `BH` = bytes por caractere (1–255); `BL` = 0 fonte principal, 1 alternativa |
| 01H | Carrega a fonte padrão da ROM | `BL` = 0 principal, 1 alternativa |
| 02H | Mapeia o atributo de alta intensidade do LCD | `BL` = 0 ignora; 1 vídeo reverso; 2 sublinhado; 3 seleciona a fonte alternativa |

Valores de `BL` fora da faixa não fazem nada; os valores de `CX` e `BH` são validados.

**Retorno:** `AX` = tipo de adaptador alternativo (0 = nenhum; `5140H` = LCD; `5153H` = tipo
CGA; `5151H` = tipo monocromático) e `ES:DI` → tabela de 7 palavras descrevendo o display
(número do modelo, pixels por metro na vertical e na horizontal, total de pixels na vertical e
na horizontal e a distância centro a centro entre pixels). Os valores para os quatro displays
do PC Convertible estão na Figura 2-5 do manual. Em outros sistemas a função não faz nada.

## 5.2 AH = 15H e 16H a 19H

A função 15H (parâmetros físicos do display ativo) aparece na lista do manual, mas sua seção
detalhada não constava do material de origem deste livro; confira o manual original antes de
usá-la. As funções 16H a 19H são reservadas.

## 5.3 AH = 1AH · Código de combinação de display (DCC)

**Somente PS/2.** O DCC identifica qual ou quais monitores estão ligados: um **ativo** e, se
houver, um **alternativo**.

- `AL=00H` lê: retorna `AL=1AH` (função suportada), `BL` = código ativo, `BH` = alternativo.
- `AL=01H` grava: `BL` e `BH` com os códigos desejados.

| Código | Display |
|---|---|
| 00H | Nenhum |
| 01H | Monocromático (5151) |
| 02H | CGA com 5153/5154 (cor) |
| 04H | EGA com 5153/5154 (cor) |
| 05H | EGA com 5151 (monocromático) |
| 06H | Professional Graphics System com 5175 (cor) |
| 07H | PS/2 (exceto Model 30) com analógico monocromático |
| 08H | PS/2 (exceto Model 30) com analógico colorido |
| 0BH | PS/2 Model 30 com analógico monocromático |
| 0CH | PS/2 Model 30 com analógico colorido |
| FFH | Desconhecido |
| 03H, 09H–0AH, 0DH–FEH | Reservados |

> **Uso típico:** detectar se o PS/2 tem vídeo analógico (07H/08H, o VGA; 0BH/0CH, o MCGA do
> Model 30) para decidir quais modos oferecer. O modo 13H existe nos dois; o modo 12H, só no
> primeiro.

## 5.4 AH = 1BH · Funcionalidade e estado

**Somente PS/2.** Devolve um quadro completo de "o que este vídeo sabe fazer" e "em que
estado está".

Entrada: `BX = 0` (tipo de implementação 00H), `ES:DI` → buffer do usuário de **40H bytes**
(64). Retorno: `AL = 1BH` e o buffer preenchido.

### Buffer de estado (dinâmico)

Os primeiros 4 bytes apontam (offset:segmento) para a **tabela estática de funcionalidade**,
em ROM. O restante reflete o estado atual:

| Offset | Conteúdo |
|---|---|
| 00H | Ponteiro (offset, segmento) para a tabela estática |
| 04H | Modo de vídeo atual |
| 05H | Colunas na tela |
| 07H / 09H | Tamanho e endereço inicial do buffer de vídeo |
| 0BH | Posição do cursor das 8 páginas (linha, coluna) |
| 1BH | Formato do cursor |
| 1DH | Página ativa |
| 1EH | Endereço do controlador CRT (3Bx mono / 3Dx cor) |
| 20H, 21H | Valores atuais dos registradores 3x8 e 3x9 |
| 22H | Linhas de texto |
| 23H | Altura do caractere (linhas de varredura) |
| 25H, 26H | DCC ativo e alternativo |
| 27H | Cores suportadas no modo atual |
| 29H | Páginas suportadas no modo atual |
| 2AH | Linhas de varredura (0=200, 1=350, 2=400, 3=480) |
| 2BH, 2CH | Bloco de caracteres primário e secundário (reservados no Model 30) |
| 2DH | Estado diverso: bit 5 piscar/fundo intenso, 4 emulação de cursor, 3 carga de paleta desabilitada, 2 monitor mono, 1 soma para cinza ativa, 0 todos os modos em todos os displays |
| 31H | Memória de vídeo (0=64K … 3=256K) |
| 32H | Estado dos ponteiros de salvamento (512 caracteres, área dinâmica, sobreposições de fontes e paleta, extensão DCC) |

### Tabela estática de funcionalidade

Uma lista de bits "suportado / não suportado" que cobre:

- modos de vídeo 00H a 13H (3 bytes, um bit por modo);
- linhas de varredura disponíveis em texto (200/350/400);
- blocos de fonte disponíveis e máximo de blocos ativos;
- funções diversas: paginação de cor, paleta, cursor, carga de fonte, soma para cinza, caneta
  óptica, DCC, controle de piscar/intensidade, salvar/restaurar, sobreposições.

Bons programas consultam essa tabela antes de usar uma função opcional, em vez de presumir
que ela existe.

```asm fragmento titulo="O modo 13H é suportado? (bit 3 do terceiro byte da tabela estática)"
; estado DB 64 DUP(?)
        PUSH DS
        POP  ES
        MOV  DI,OFFSET estado
        MOV  AH,1BH
        XOR  BX,BX
        INT  10H
        CMP  AL,1BH
        JNE  sem_funcao          ; não é PS/2
        LES  BX,DWORD PTR estado ; ES:BX = tabela estática em ROM
        TEST BYTE PTR ES:[BX+2],08H
        JZ   sem_modo13
```

> Os 3 primeiros bytes da tabela estática trazem um bit por modo: byte 0 = modos 00H a 07H,
> byte 1 = 08H a 0FH, byte 2 = 10H a 13H (bit 0 = 10H … bit 3 = 13H). Confira o layout
> completo no manual antes de depender de outros campos.

O `LES` com um ponteiro "offset, segmento" guardado em memória é exatamente o da seção
"Ponteiros longos: DD, LDS e LES" da [Aula 12](../conteudo/aula12-segmentos.md).

## 5.5 AH = 1CH · Salvar e restaurar o estado do vídeo

**PS/2, exceto Model 30.** Serve para guardar e devolver o estado do vídeo, por exemplo antes
de entrar num modo gráfico e depois voltar ao ambiente anterior, ou num TSR que abre uma
janela sobre outro programa.

| AL | Ação | Entrada |
|---|---|---|
| 00H | Calcula o tamanho do buffer | `CX` = estados pedidos; retorno `BX` = nº de blocos de 64 bytes |
| 01H | Salva | `CX` = estados; `ES:BX` → buffer |
| 02H | Restaura | `CX` = estados; `ES:BX` → buffer salvo |

Máscara de estados em `CX`: bit 0 = hardware de vídeo; bit 1 = área de dados da BIOS de vídeo;
bit 2 = DAC e registradores de cor. Os demais bits devem ser zero. `AL = 1CH` no retorno
indica que a função existe.

> **Cuidado:** salvar **altera o estado atual do vídeo**. Se você quer continuar de onde
> parou, faça um *restore* logo em seguida.

A função salva **registradores e variáveis**, não o conteúdo da tela. Um TSR que abre uma
janela ainda precisa copiar a área de `B800:0000` que vai cobrir (ou os 64000 bytes de
`A000:0000` no modo 13H) e devolvê-la ao sair, com `REP MOVSW` da [Aula 13](../conteudo/aula13-strings.md).

`AH = 1DH` a `FFH`: reservados.

## 5.6 Receita da IBM: descobrir o adaptador de vídeo

Da Seção 4 do manual, em ordem:

1. Chame `INT 10H, AX=1A00H` (ler DCC). Se voltar `AL=1AH`, `BL`/`BH` descrevem o(s)
   display(s). Pronto.
2. Senão, teste o **EGA**: `INT 10H, AH=12H, BL=10H`. Se `BL` continuar `10H`, não há EGA; se
   mudou, há. Mesmo com EGA pode haver também CGA ou monocromático (depende das chaves).
3. Por fim, teste CGA e monocromático diretamente (por exemplo, escrevendo e lendo um
   registrador do controlador CRT em `3D4H` ou `3B4H`), ou consulte os bits 5 e 4 do byte de
   equipamento em `40:10` ([Capítulo 8](cap08-equipamento-e-memoria.md)).

```asm titulo="VIDEO.ASM: identifica o adaptador de vídeo"
.MODEL SMALL
.STACK 100h
.DATA
m_vga   DB  'PS/2: vídeo analógico (VGA/MCGA) ou DCC conhecido',13,10,'$'
m_ega   DB  'EGA presente',13,10,'$'
m_cga   DB  'CGA (ou compatível colorido)',13,10,'$'
m_mono  DB  'Monocromático',13,10,'$'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX

        MOV  AX,1A00H        ; passo 1: DCC
        INT  10H
        CMP  AL,1AH
        JNE  testa_ega
        MOV  DX,OFFSET m_vga
        JMP  mostra

testa_ega:
        MOV  AH,12H          ; passo 2: EGA
        MOV  BL,10H
        INT  10H
        CMP  BL,10H
        JE   testa_cga
        MOV  DX,OFFSET m_ega
        JMP  mostra

testa_cga:
        INT  11H             ; passo 3: bits 5-4 do equipamento
        AND  AL,30H
        CMP  AL,30H          ; 11 = 80x25 monocromático
        JE   eh_mono
        MOV  DX,OFFSET m_cga
        JMP  mostra
eh_mono:
        MOV  DX,OFFSET m_mono

mostra: MOV  AH,09H
        INT  21H
        MOV  AX,4C00H
        INT  21H
END inicio
```

## 5.7 Trocar entre monocromático e colorido

Há três ambientes possíveis:

1. **Uma só função de vídeo**, só mono ou só colorida: só os modos correspondentes estão
   disponíveis.
2. **Duas funções** (uma colorida e uma monocromática): os dois conjuntos de modos estão
   disponíveis, e a aplicação **troca o tipo de vídeo registrado em `40:10`** (bits 5 e 4)
   antes do *set mode*.
3. **Uma função que atende os dois tipos**: consulte `INT 10H, AH=1BH`; se o bit "todos os
   modos em todos os displays" (bit 0 do byte 2DH) estiver ativo, os dois conjuntos funcionam.

```asm fragmento titulo="Caso 2: passar para o monitor monocromático"
        PUSH DS
        MOV  AX,0040H
        MOV  DS,AX
        OR   BYTE PTR DS:[10H],30H    ; bits 5-4 = 11: 80x25 mono
        POP  DS
        MOV  AX,0007H                 ; set mode 7
        INT  10H
```

## 5.8 No simulador do curso

1AH, 1BH, 1CH e 14H não têm serviço. `VIDEO.ASM` roda mesmo assim: os passos 1 e 2 falham
silenciosamente, como num PC antigo, e o passo 3 também, porque o simulador não implementa
`INT 11H`: AX fica como estava, e o programa responde "CGA". Rode-o num emulador com VGA para
ver o passo 1 funcionar.

## 5.9 Exercícios

1. Estenda `VIDEO.ASM` para imprimir os códigos `BL` e `BH` do DCC em hexadecimal e o nome de
   cada display pela tabela da seção 5.3 (use uma tabela de ponteiros indexada por `BL`, como
   os menus da [Aula 19](../conteudo/aula19-menu-entrada.md)).
2. Com `AH=1BH`, imprima o modo atual, as colunas, as linhas de texto e a quantidade de cores
   do modo.
3. Escreva um par de rotinas `SALVA_VIDEO` / `RESTAURA_VIDEO` que usam `AH=1CH` com `CX=7`,
   alocando o buffer com `INT 21H, AH=48H` ([Aula 26](../conteudo/aula26-psp-memoria.md)) a
   partir do tamanho devolvido por `AL=00H`. Lembre que `BX` vem em blocos de 64 bytes e
   `AH=48H` pede parágrafos de 16.

## Resumo

- `AH=1AH` (DCC) e `AH=1BH` (estado + tabela estática) só existem no PS/2; ambas confirmam
  com `AL` igual ao número da função.
- `AH=1CH` salva e restaura registradores, área de dados e DAC (não o conteúdo da tela).
- Detecção: DCC, depois EGA (`AH=12H, BL=10H`), depois CGA/mono pelo hardware ou por `40:10`.
- Para trocar mono/cor com duas placas, altere os bits 5 e 4 de `40:10` antes do *set mode*.
