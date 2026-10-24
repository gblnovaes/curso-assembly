---
id: cap17
numero: 17
parte: 6
titulo: "A área de dados da BIOS, a EBDA e as tabelas em ROM"
aulas: aula12; aula14; aula28; aula46
---

# Capítulo 17 · A área de dados da BIOS, a EBDA e as tabelas em ROM

> **Neste capítulo:** o mapa de consulta dos 256 bytes da área de dados da BIOS em `0040:0000`,
> organizado por assunto e em ordem de endereço; as tabelas de ponteiros de salvamento do
> EGA/PS/2; a área de dados estendida (EBDA); e um resumo das tabelas em ROM apontadas por
> vetores.
>
> **Antes de ler:** [Aula 12](../conteudo/aula12-segmentos.md) (segmentos e endereços lógicos) e
> [Aula 28](../conteudo/aula28-tsr-teclado.md), que usa `40:17`, `40:1A`, `40:1C` e `40:1E`.

## 17.1 A área de dados da BIOS (segmento 0040H)

A BIOS usa **256 bytes** de RAM, de `0000:0400H` a `0000:04FFH` (escritos `40:00` a `40:FF`),
como memória de trabalho. É aqui que ficam o buffer do teclado, o contador de tempo, os
endereços das portas de E/S, o estado dos discos e do vídeo. Programas bem-comportados **leem**
essa área; escrever nela só deve ser feito com cuidado e quando documentado (como a troca mono/cor
em `40:10` do [Capítulo 5](cap05-video-estado-e-deteccao.md)).

> Este é um **mapa de consulta** com os endereços mais úteis. Para a lista completa, os valores
> iniciais e os campos específicos de cada modelo, consulte a Seção 3 do manual original.

### Como acessar

```asm fragmento titulo="Duas formas de ler 40:49 (modo de vídeo)"
; 1) segmento 0040H
        PUSH DS
        MOV  AX,0040H
        MOV  DS,AX
        MOV  AL,DS:[0049H]
        POP  DS
; 2) segmento 0000H, offset 0449H (o mesmo byte físico)
        XOR  BX,BX
        MOV  ES,BX
        MOV  AL,ES:[0449H]
```

Em MASM/TASM, um segmento com `AT 40H` dá nomes simbólicos aos campos:

```asm fragmento titulo="Declarando a área de dados com SEGMENT AT"
bda     SEGMENT AT 40H
        ORG  10H
equip   DW   ?              ; 40:10
        ORG  17H
kbflag  DB   ?              ; 40:17
        ORG  6CH
ticks   DD   ?              ; 40:6C
bda     ENDS
```

Com `ASSUME ES:bda` e `ES = 0040H`, o programa escreve `MOV AL,kbflag`. A forma de segmentos
completos com `SEGMENT`/`ASSUME` é a da [Aula 12](../conteudo/aula12-segmentos.md).

## 17.2 Mapa por assunto

### Portas de E/S (endereços-base)

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:00 – 40:06 | Endereço-base das linhas RS-232-C 1 a 4 (uma palavra cada) | [11](cap11-serial-e-impressora.md) |
| 40:08 – 40:0E | Endereço-base das impressoras 1 a 3 (e uma quarta posição) | [11](cap11-serial-e-impressora.md) |
| 40:78 – 40:7B | *Time-out* das impressoras | [11](cap11-serial-e-impressora.md) |
| 40:7C – 40:7F | *Time-out* das linhas RS-232-C | [11](cap11-serial-e-impressora.md) |

Um valor **zero** indica que a porta não existe.

### Equipamento e memória

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:10 | Equipamento instalado (mesmo mapa de bits devolvido por `INT 11H`) | [8](cap08-equipamento-e-memoria.md) |
| 40:12 | Usado pelo POST e pelas ROMs de adaptador (bit 4: erro de autoteste no PC Convertible) | [12](cap12-boot-e-roms.md) |
| 40:13 | Memória convencional em KB (0–640), mesmo valor de `INT 12H`; já desconta a EBDA | [8](cap08-equipamento-e-memoria.md) |

### Teclado

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:17, 40:18 | Estado dos modificadores (Insert, Caps, Num, Scroll, Alt, Ctrl, Shift…) | [6](cap06-teclado.md) |
| 40:19 | Entrada de teclado numérico alternativo (Alt+dígitos) | [6](cap06-teclado.md) |
| 40:1A | Ponteiro de **cabeça** do buffer (próxima tecla a ler) | [6](cap06-teclado.md) |
| 40:1C | Ponteiro de **cauda** do buffer (próxima posição livre) | [6](cap06-teclado.md) |
| 40:1E | Buffer do teclado (32 bytes = 16 teclas) | [6](cap06-teclado.md) |
| 40:80, 40:82 | Início e fim do buffer (offsets) | [6](cap06-teclado.md) |
| 40:96, 40:97 | Modo/tipo do teclado (101/102 teclas instalado, E0/E1 etc.) e estado dos LEDs | [6](cap06-teclado.md) |

Buffer vazio quando cabeça = cauda. Ao somar 2 à cabeça ou à cauda, volta-se ao início se passar
do fim. Os ponteiros são **offsets relativos a 0040H**: um buffer recém-esvaziado tem
cabeça = cauda = `001EH`.

### Disquete

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:3E | Status de recalibração (bit por unidade; bit 7 = interrupção ocorreu) | [9](cap09-disquete.md) |
| 40:3F | Status do motor e seleção de unidade | [9](cap09-disquete.md) |
| 40:40 | Contador de desligamento do motor (decrementado a cada tick da INT 08H) | [7](cap07-tempo-e-relogios.md) |
| 40:41 | Status da última operação de disquete (mesmos códigos da INT 13H) | [9](cap09-disquete.md) |
| 40:42 | 7 bytes de status do controlador | [9](cap09-disquete.md) |

### Disco fixo

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:74 | Status da última operação do disco fixo (mesmos códigos da INT 13H) | [10](cap10-disco-fixo.md) |

### Vídeo

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:49 | Modo de vídeo atual | [3](cap03-video-modos-e-texto.md) |
| 40:4A | Número de colunas (palavra) | [3](cap03-video-modos-e-texto.md) |
| 40:4C | Tamanho do buffer de vídeo (bytes) | [3](cap03-video-modos-e-texto.md) |
| 40:4E | Endereço inicial do buffer (offset da página ativa) | [3](cap03-video-modos-e-texto.md) |
| 40:50 – 40:5E | Posição do cursor das 8 páginas (coluna no byte baixo, linha no alto, uma palavra cada) | [3](cap03-video-modos-e-texto.md) |
| 40:60 | Formato do cursor | [3](cap03-video-modos-e-texto.md) |
| 40:62 | Página ativa | [3](cap03-video-modos-e-texto.md) |
| 40:63 | Endereço-base do controlador CRT (`3B4H` mono, `3D4H` cor) | [5](cap05-video-estado-e-deteccao.md) |
| 40:65, 40:66 | Valores correntes dos registradores 3x8 e 3x9 | [5](cap05-video-estado-e-deteccao.md) |
| 40:84 | Número de linhas da tela menos 1 | [4](cap04-video-paleta-fontes-strings.md) |
| 40:85 | Altura do caractere (bytes por caractere) | [4](cap04-video-paleta-fontes-strings.md) |
| 40:87 e seguintes | Controle de vídeo e informações do EGA/PS/2 | [4](cap04-video-paleta-fontes-strings.md) |
| 40:A8 | Ponteiro para os parâmetros de vídeo e *overrides* (tabela *save pointer*) | 17.3 |

> **Por que a palavra do cursor tem a coluna embaixo?** Porque assim ela pode ser carregada
> direto em `DX` para a `INT 10H, AH=02H`: `DL` = coluna, `DH` = linha.

### Tempo

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 40:6C | Contador de ticks (palavra dupla, ~18,2/s) | [7](cap07-tempo-e-relogios.md) |
| 40:70 | Flag de estouro de 24 horas | [7](cap07-tempo-e-relogios.md) |
| 40:71 | Estado da tecla Break (bit 7) | [6](cap06-teclado.md) |
| 40:72 | **Flag de reset**: `1234H` = pular teste de memória (Ctrl-Alt-Del); `4321H` = preservar memória (PS/2 exceto Model 30); `5678H`, `9ABCH`, `ABCDH` = estados de suspensão/teste de fábrica do PC Convertible | [12](cap12-boot-e-roms.md) |
| 40:98 – 40:A0 | Espera do usuário: endereço do flag, contagem em µs, flag de espera ativa (`INT 15H, AH=83H` e `86H`) | [7](cap07-tempo-e-relogios.md) |

### Diversos

| Endereço | Conteúdo | Capítulo |
|---|---|---|
| 50:00 | Status do Print Screen (`INT 05H`): 00H livre/concluído, 01H em andamento, FFH erro | [2](cap02-vetores-e-excecoes.md) |
| 40:AC – 40:FF | Reservado | |

## 17.3 Tabelas de ponteiros de salvamento (EGA e PS/2)

A palavra dupla em `40:A8` aponta para uma tabela de **ponteiros** que a BIOS de vídeo usa no
*set mode* (`INT 10H, AH=00H`). Através dela, um programa pode substituir de forma dinâmica:

- a tabela de parâmetros de vídeo (os valores dos registradores para cada modo);
- o conjunto de fontes de texto;
- as fontes gráficas;
- a paleta;
- e, nos PS/2, informações do código de combinação de display (DCC).

Existe uma tabela principal e uma **secundária**. Mexer nelas exige o layout exato; use o
manual. O princípio é o mesmo da tabela de disquete: copie a tabela para a RAM, altere a cópia e
aponte `40:A8` para ela; o próximo *set mode* passa a usar os seus valores.

## 17.4 Área de dados estendida da BIOS (EBDA), somente PS/2

O POST reserva o maior bloco necessário logo abaixo de 640 KB como EBDA e **diminui** o valor em
`40:13` na mesma proporção. Para obter o segmento: `INT 15H, AH=C1H`; para saber se existe: o
bit 2 do byte de recursos em `INT 15H, AH=C0H` ([Capítulo 8](cap08-equipamento-e-memoria.md)).
O mouse do PS/2 ([Capítulo 15](cap15-mouse-ps2.md)) guarda ali os seus dados de trabalho.

## 17.5 Tabelas em ROM apontadas por vetores

| Vetor | Endereço na IVT | Tabela | Capítulo |
|---|---|---|---|
| 1DH | `0000:0074` | Parâmetros de vídeo (CRTC) | 17.3 |
| 1EH | `0000:0078` | Parâmetros de disquete (11 bytes) | [9](cap09-disquete.md) |
| 1FH | `0000:007C` | Caracteres gráficos 128–255 (8 bytes cada) | [3](cap03-video-modos-e-texto.md), [4](cap04-video-paleta-fontes-strings.md) |
| 41H | `0000:0104` | Parâmetros do disco fixo 0 (16 bytes) | [10](cap10-disco-fixo.md) |
| 43H | `0000:010C` | Fonte gráfica do EGA/PS/2 | [4](cap04-video-paleta-fontes-strings.md) |
| 46H | `0000:0118` | Parâmetros do disco fixo 1 (16 bytes) | [10](cap10-disco-fixo.md) |

Regra de ouro das tabelas (Seção 4 do manual): **não altere a da ROM; copie a tabela, modifique
a cópia e aponte o vetor correspondente para ela**. E devolva o vetor original ao terminar.

## 17.6 Exemplo: um painel da área de dados

```asm titulo="BDA.ASM: mostra campos da área de dados da BIOS"
.MODEL SMALL
.STACK 100h
.DATA
m_modo  DB  'Modo de vídeo (40:49): $'
m_col   DB  13,10,'Colunas (40:4A): $'
m_mem   DB  13,10,'Memória em KB (40:13): $'
m_tick  DB  13,10,'Ticks (40:6C): $'
m_kb    DB  13,10,'Teclas no buffer: $'
m_fim   DB  13,10,'$'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        MOV  AX,0040H
        MOV  ES,AX              ; ES = área de dados da BIOS

        MOV  DX,OFFSET m_modo
        CALL texto
        MOV  AL,ES:[49H]
        CALL imphex8

        MOV  DX,OFFSET m_col
        CALL texto
        MOV  AX,ES:[4AH]
        CALL imphex16

        MOV  DX,OFFSET m_mem
        CALL texto
        MOV  AX,ES:[13H]
        CALL imphex16

        MOV  DX,OFFSET m_tick
        CALL texto
        MOV  AX,ES:[6EH]        ; palavra alta primeiro
        CALL imphex16
        MOV  AX,ES:[6CH]
        CALL imphex16

        MOV  DX,OFFSET m_kb
        CALL texto
        MOV  AX,ES:[1CH]        ; cauda
        SUB  AX,ES:[1AH]        ; - cabeça
        JNS  positivo
        ADD  AX,32              ; deu a volta no buffer circular
positivo:
        SHR  AX,1               ; 2 bytes por tecla
        CALL imphex8

        MOV  DX,OFFSET m_fim
        CALL texto
        MOV  AX,4C00H
        INT  21H

texto   PROC
        MOV  AH,09H
        INT  21H
        RET
texto   ENDP

imphex16 PROC
        PUSH AX
        MOV  AL,AH
        CALL imphex8
        POP  AX
        CALL imphex8
        RET
imphex16 ENDP

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

O cálculo das teclas no buffer supõe o buffer padrão de 32 bytes; para ser exato em qualquer
máquina, use `40:82 − 40:80` como tamanho.

## 17.7 No simulador do curso

O simulador mantém `40:13` (640 KB), `40:49` e `40:4A` (modo e colunas, atualizados pelo *set
mode*) e `40:6C` (ticks). Os outros campos ficam em zero; em particular o buffer de teclado do
simulador não fica em `40:1E`, então a contagem de teclas de `BDA.ASM` mostra 0.

## 17.8 Exercícios

1. Acrescente ao `BDA.ASM` a posição do cursor da página 0 (`40:50`), a página ativa (`40:62`) e
   o endereço do CRTC (`40:63`).
2. Escreva uma rotina `LIMPA_TECLADO` que esvazia o buffer igualando a cabeça à cauda, com as
   interrupções desligadas. Compare com o laço `AH=01H`/`AH=00H` da `INT 16H`. Qual é mais
   portável?
3. Use `SEGMENT AT 40H` para declarar todos os campos de vídeo da seção 17.2 com nomes e
   reescreva o exercício 1 com eles.

## Resumo

- A área de dados da BIOS ocupa `40:00` a `40:FF`; leia à vontade, escreva só o que é
  documentado.
- Portas em `40:00`/`40:08`; equipamento em `40:10`; memória em `40:13`; teclado em `40:17` a
  `40:3D` e `40:80`; disquete em `40:3E` a `40:48`; vídeo em `40:49` a `40:66` e `40:84` em
  diante; ticks em `40:6C`; reset em `40:72`.
- `40:A8` aponta as tabelas de salvamento do vídeo; a EBDA fica abaixo de 640 KB nos PS/2.
- Tabelas em ROM (1DH, 1EH, 1FH, 41H, 43H, 46H): copie, ajuste a cópia, aponte o vetor.
