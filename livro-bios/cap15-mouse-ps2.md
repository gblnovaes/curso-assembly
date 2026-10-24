---
id: cap15
numero: 15
parte: 5
titulo: "O mouse do PS/2 (INT 15H, AH=C2H)"
aulas: aula10; aula15; aula23; aula47
---

# Capítulo 15 · O mouse do PS/2

> **Neste capítulo:** a interface da BIOS para o dispositivo apontador da porta auxiliar do PS/2
> (`INT 15H, AH=C2H`): habilitar, configurar taxa e resolução, ler o estado e, principalmente,
> instalar uma rotina `FAR` que recebe os pacotes de movimento pela pilha.
>
> **Antes de ler:** [Aula 10, Parâmetros, BP e variáveis locais](../conteudo/aula10-parametros.md)
> (ler parâmetros com `[BP+n]`), [Aula 15](../conteudo/aula15-isr.md) (rotinas chamadas pelo
> hardware) e [Aula 23](../conteudo/aula23-modo13h.md) (para desenhar o ponteiro).

## 15.1 BIOS do mouse e driver do mouse

Há duas camadas de software para o mouse no DOS:

| Camada | Interface | Quem fornece |
|---|---|---|
| BIOS (este capítulo) | `INT 15H, AH=C2H`: pacotes brutos de deslocamento e botões | ROM do PS/2 |
| Driver (`MOUSE.COM`) | `INT 33H`: posição na tela, ponteiro desenhado, eventos | o fabricante do mouse |

O driver da `INT 33H`, quando o mouse é PS/2, usa por baixo exatamente as funções deste
capítulo. Programas que só precisam de "onde está o ponteiro" usam a `INT 33H` (veja a
[Aula 47](../conteudo/aula47-mouse.md)); jogos e programas residentes que querem controle total,
ou que rodam sem driver, falam com a BIOS.

A interface existe só no PS/2 (e posteriores). O bit 2 do byte de equipamento (`INT 11H`) diz se
há dispositivo apontador, e a EBDA ([Capítulo 8](cap08-equipamento-e-memoria.md)) guarda os
dados de trabalho da BIOS do mouse.

## 15.2 AH = C2H · As subfunções

A subfunção vai em `AL`:

| AL | Função | Entrada / saída |
|---|---|---|
| 00H | Habilitar/desabilitar | `BH`=0 desabilita, 1 habilita |
| 01H | Reset | retorna ID do dispositivo (`BH`=0) |
| 02H | Taxa de amostragem | `BH`: 0=10, 1=20, 2=40, 3=60, 4=80, 5=100, 6=200 relatórios/s |
| 03H | Resolução | `BH`: 0=1, 1=2, 2=4, 3=8 contagens/mm |
| 04H | Ler tipo do dispositivo | retorna ID em `BH` |
| 05H | Inicializar a interface | `BH` = tamanho do pacote (1 a 8 bytes) |
| 06H | Comandos estendidos | `BH`=0 status; 1 escala 1:1; 2 escala 2:1 |
| 07H | Instalar a rotina do driver | `ES:BX` = endereço da rotina (*far call*) |

**Retorno comum:** `CF=0` e `AH=0` se deu certo; senão `CF=1` e `AH` indica:

| AH | Erro |
|---|---|
| 01H | Função inválida |
| 02H | Entrada inválida |
| 03H | Erro de interface |
| 04H | Reenviar |
| 05H | Nenhuma rotina *far* instalada |

Depois de `AL=01H` ou `05H` o dispositivo fica **desabilitado**, com amostragem de 100/s,
resolução de 4 contagens/mm e escala 1:1.

**Status (AL=06H, BH=00H):** `BL` traz bit 6 (0 = modo *stream*, 1 = *remote*), bit 5
(habilitado), bit 4 (escala 2:1), bit 2 (botão esquerdo) e bit 0 (botão direito); `CL` traz a
resolução; `DL` a taxa de amostragem (0AH = 10/s … C8H = 200/s).

> **Escala 2:1** é uma aceleração simples: movimentos rápidos são multiplicados, os lentos
> ficam iguais. A taxa de amostragem decide quantos pacotes por segundo chegam; a resolução,
> quantas contagens cada milímetro de movimento produz.

## 15.3 Receber os dados: a rotina instalada com AL = 07H

Você escreve uma rotina `FAR` e informa o endereço à BIOS. A cada pacote disponível, a BIOS a
chama deixando **quatro palavras na pilha**, empilhadas nesta ordem:

1. **Status**: bits 0 botão esquerdo, 1 botão direito, 4 sinal de X, 5 sinal de Y, 6 estouro de
   X, 7 estouro de Y (bit 3 sempre 1);
2. **X** (deslocamento, byte baixo);
3. **Y** (deslocamento, byte baixo);
4. **Z** (zero nesta geração).

A rotina deve terminar com `RETF` **sem retirar os parâmetros** (a BIOS os remove).

Como o status foi empilhado primeiro, ele fica no endereço mais alto. Depois do `CALL FAR` da
BIOS e de um `PUSH BP` / `MOV BP,SP` dentro da rotina, a moldura é a da Aula 10:

```
 [BP+12]  status      (empilhado primeiro)
 [BP+10]  X
 [BP+8]   Y
 [BP+6]   Z           (empilhado por último)
 [BP+4]   CS de retorno
 [BP+2]   IP de retorno
 [BP+0]   BP salvo
```

### Os deslocamentos têm 9 bits

X e Y chegam como um byte cada, mas o **sinal** de cada um está no status (bits 4 e 5). Juntos,
formam números de 9 bits em complemento de dois (de −256 a +255). Para estender para 16 bits:

```asm fragmento titulo="X com sinal em AX, a partir do byte X e do bit 4 do status"
        MOV  AL,[BP+10]      ; byte baixo de X
        XOR  AH,AH
        TEST BYTE PTR [BP+12],10H   ; bit 4: X negativo?
        JZ   x_pronto
        MOV  AH,0FFH         ; estende o sinal (complemento de dois, Aula 22)
x_pronto:
```

> No mouse PS/2, **Y positivo significa para cima**. Como a linha 0 da tela é a de cima, subtraia
> Y da coordenada da tela em vez de somar. Os bits de estouro (6 e 7) indicam que o deslocamento
> passou do que cabe em 9 bits; nesses pacotes o valor não é confiável e costuma ser ignorado.

### Regras para a rotina

Ela roda dentro do tratador de interrupção da BIOS (IRQ 12, a da porta auxiliar):

- seja curta; não chame o DOS;
- preserve todos os registradores que usar;
- acesse as suas variáveis com `CS:` ou carregue o seu DS e restaure o original;
- não use `IRET`: é `RETF`, porque a BIOS a chama com `CALL FAR`.

## 15.4 Exemplo: um ponteiro de texto

O programa liga o mouse, instala a rotina, move um caractere de "ponteiro" pela tela de texto
conforme o mouse se mexe e termina com uma tecla ou com o botão direito.

```asm titulo="MOUSE.ASM: ponteiro em modo texto pela BIOS do PS/2"
.MODEL SMALL
.STACK 100h
.CODE
px      DW  40               ; coluna (0-79), em CS: para a rotina achar
py      DW  12               ; linha (0-24)
botoes  DB  0
mudou   DB  0
m_erro  DB  'Sem mouse PS/2 pela BIOS',13,10,'$'

; rotina chamada pela BIOS a cada pacote (FAR, termina com RETF)
pacote  PROC FAR
        PUSH BP
        MOV  BP,SP
        PUSH AX
        MOV  AL,[BP+12]      ; status
        MOV  CS:botoes,AL
        TEST AL,0C0H         ; estouro? ignora o movimento
        JNZ  fim_pac
        ; X: soma o deslocamento (dividido por 4 para ficar suave)
        MOV  AL,[BP+10]
        XOR  AH,AH
        TEST BYTE PTR [BP+12],10H
        JZ   x_pos
        MOV  AH,0FFH
x_pos:  SAR  AX,1
        SAR  AX,1
        ADD  CS:px,AX
        ; Y: positivo é para cima, então subtrai
        MOV  AL,[BP+8]
        XOR  AH,AH
        TEST BYTE PTR [BP+12],20H
        JZ   y_pos
        MOV  AH,0FFH
y_pos:  SAR  AX,1
        SAR  AX,1
        SUB  CS:py,AX
        MOV  CS:mudou,1
fim_pac:
        POP  AX
        POP  BP
        RETF                 ; a BIOS retira as 4 palavras
pacote  ENDP

inicio:
        MOV  AX,CS
        MOV  DS,AX           ; dados no próprio segmento de código
        MOV  AX,0C205H       ; inicializa a interface, pacote de 3 bytes
        MOV  BH,3
        STC                  ; sem BIOS de mouse, CF fica 1
        INT  15H
        JC   sem_mouse
        MOV  AX,0C207H       ; instala a rotina
        PUSH CS
        POP  ES
        MOV  BX,OFFSET pacote
        STC                  ; sem BIOS de mouse, CF fica 1
        INT  15H
        JC   sem_mouse
        MOV  AX,0C200H       ; habilita
        MOV  BH,1
        STC                  ; sem BIOS de mouse, CF fica 1
        INT  15H
        JC   sem_mouse

laco:   CMP  mudou,0
        JE   tecla
        MOV  mudou,0
        CALL limita
        MOV  AH,02H          ; posiciona o cursor em (py, px)
        MOV  BH,0
        MOV  DH,BYTE PTR py
        MOV  DL,BYTE PTR px
        INT  10H
        MOV  AX,0E000H+'*'   ; AH=0EH, AL='*': marca a posição
        INT  10H
tecla:  TEST botoes,02H      ; botão direito sai
        JNZ  sair
        MOV  AH,01H
        INT  16H
        JZ   laco
        MOV  AH,00H
        INT  16H

sair:   MOV  AX,0C200H       ; desabilita antes de sair
        MOV  BH,0
        INT  15H
        MOV  AX,0C207H       ; e desinstala a rotina (ES:BX = 0:0)
        XOR  BX,BX
        MOV  ES,BX
        INT  15H
        MOV  AX,4C00H
        INT  21H

sem_mouse:
        MOV  DX,OFFSET m_erro
        MOV  AH,09H
        INT  21H
        MOV  AX,4C01H
        INT  21H

; mantém px em 0..79 e py em 0..24 (as variáveis são modificadas pela rotina)
limita  PROC
        CLI
        CMP  px,0
        JGE  x_min_ok
        MOV  px,0
x_min_ok:
        CMP  px,79
        JLE  x_max_ok
        MOV  px,79
x_max_ok:
        CMP  py,0
        JGE  y_min_ok
        MOV  py,0
y_min_ok:
        CMP  py,24
        JLE  y_max_ok
        MOV  py,24
y_max_ok:
        STI
        RET
limita  ENDP
END inicio
```

Repare no `CLI` dentro de `limita`: a rotina do mouse pode alterar `px` e `py` a qualquer
momento, e o laço principal não pode ser interrompido no meio da verificação. É a mesma ideia de
seção crítica da [Aula 15](../conteudo/aula15-isr.md). E no `SAR` (não `SHR`): os deslocamentos
têm sinal, e dividir um negativo por 4 exige o deslocamento aritmético da [Aula 22](../conteudo/aula22-sinal.md).

## 15.5 No simulador do curso

O simulador tem o driver da `INT 33H` (funções 00H a 0CH, a rotina de eventos e o cursor na
tela), que é o assunto da [Aula 47](../conteudo/aula47-mouse.md), mas não a BIOS do mouse do
PS/2: não há `INT 15H, AH=C2H`. `MOUSE.ASM` monta e, no laboratório, mostra "Sem mouse
PS/2 pela BIOS": como a interrupção não é atendida, o CF ligado pelo `STC` antes de cada chamada
continua ligado. Sem esse `STC`, o programa acharia que o mouse existe. Num PS/2 real ou num
emulador com mouse PS/2 (86Box, PCem), o ponteiro se move.

## 15.6 Exercícios

1. Acrescente ao `MOUSE.ASM` o apagamento da posição anterior, para o asterisco "andar" em vez de
   deixar rastro. Dica: guarde a posição e o caractere que havia lá (`INT 10H, AH=08H`).
2. Mude a taxa para 40 relatórios/s e a resolução para 8 contagens/mm e compare a sensação.
3. Faça a versão gráfica no modo 13H: um ponteiro de 8×8 pixels desenhado com XOR (bit 7 de `AL`
   na `INT 10H, AH=0CH`, ou XOR direto na memória), coordenadas de 0 a 319 e 0 a 199.
4. Por que a rotina não pode chamar `INT 21H, AH=09H` para mostrar a posição? (Veja a
   [Aula 27](../conteudo/aula27-tsr.md), "Nada de DOS dentro da rotina".)

## Resumo

- `INT 15H, AH=C2H` é a BIOS do mouse do PS/2; a `INT 33H` é o driver, que fica por cima dela.
- Sequência: 05H (inicializar, tamanho do pacote) → 07H (instalar a rotina `FAR`) → 00H com
  `BH=1` (habilitar). Ao sair: desabilitar e desinstalar.
- A rotina recebe status, X, Y e Z na pilha (`[BP+12]` a `[BP+6]`) e sai com `RETF` sem retirá-los.
- X e Y têm 9 bits; o sinal está nos bits 4 e 5 do status; Y positivo é para cima.
