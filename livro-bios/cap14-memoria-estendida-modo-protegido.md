---
id: cap14
numero: 14
parte: 5
titulo: "Memória estendida e modo protegido (INT 15H, AH=87H e 89H)"
aulas: aula12; aula26
---

# Capítulo 14 · Memória estendida e modo protegido

> **Neste capítulo:** como um programa em modo real usa a memória acima de 1 MB com a ajuda da
> BIOS: o *block move* (`INT 15H, AH=87H`) e a sua pequena tabela de descritores (GDT), e a
> entrada definitiva no modo protegido do 80286 (`AH=89H`) com tudo que fica por conta do
> programa depois dela.
>
> **Antes de ler:** [Aula 12, Segmentos a fundo](../conteudo/aula12-segmentos.md) (por que o
> 8086 só enxerga 1 MB) e o [Capítulo 8](cap08-equipamento-e-memoria.md) (`AH=88H`, quanta
> memória estendida existe).

Estes serviços exigem **AT, XT 286 ou PS/2** com 80286 ou 80386. Em PCjr e PC o retorno é
`AH=80H, CF=1`; no PC XT, `AH=86H, CF=1`. O programa que os chama pode ser escrito só com
instruções do 8086: é a BIOS que executa as instruções do 286 por dentro.

## 14.1 Por que a BIOS precisa ajudar

O 8086 forma endereços de 20 bits (`segmento × 16 + offset`), que vão até `FFFFFH`. O 80286 tem
24 linhas de endereço (16 MB), mas em **modo real** se comporta como um 8086 e não alcança o que
está acima de 1 MB (exceto os ~64 KB logo acima, quando a linha **A20** está liberada, o que
este manual não explora). Para chegar lá é preciso entrar em **modo protegido**, onde os
registradores de segmento deixam de ser "parágrafos" e passam a ser **seletores** que apontam
descritores numa tabela (a GDT), cada um com um endereço-base de 24 bits.

```
 modo real:      endereço = segmento × 16 + offset            (até 1 MB)
 modo protegido: endereço = base(descritor[seletor]) + offset (até 16 MB no 286)
```

## 14.2 AH = 87H · Copiar dados acima de 1 MB (*block move*)

Esta função coloca o processador brevemente em modo protegido, copia o bloco e volta ao modo
real, tudo dentro da BIOS.

**Entrada:** `CX` = número de **palavras** a copiar (máximo `8000H` = 64 KB), `ES:SI` → uma
pequena **GDT** que você monta com 6 descritores de 8 bytes:

| Descritor | Offset na GDT | Papel |
|---|---|---|
| 0 | 00H | Obrigatório, zerado |
| 1 | 08H | Aponta a própria GDT (a BIOS preenche; deixe zerado) |
| 2 | 10H | **Origem** do bloco (você preenche) |
| 3 | 18H | **Destino** do bloco (você preenche) |
| 4 | 20H | Segmento de código usado pela BIOS (preencher com 0) |
| 5 | 28H | Segmento de pilha usado pela BIOS (preencher com 0) |

Cada descritor de origem e de destino tem 8 bytes:

| Offset | Tamanho | Campo |
|---|---|---|
| 0 | palavra | Limite do segmento (tamanho − 1; até `FFFFH` = 64 KB) |
| 2 | 3 bytes | Endereço físico de 24 bits (até 16 MB − 1), byte baixo primeiro |
| 5 | byte | Direitos de acesso: `93H` = dados, nível 0, leitura/escrita |
| 6 | palavra | Reservada, igual a zero |

**Retorno em `AH`:** 00H sucesso (`CF=0, ZF=1`); 01H erro de paridade na RAM; 02H outra exceção;
03H falha no *gate* da linha de endereço A20 (nos erros, `CF=1, ZF=0`). Todos os registradores,
exceto `AH`, são restaurados.

> **Atenção:** nenhuma interrupção é atendida durante a cópia. Blocos grandes podem fazer o
> sistema perder interrupções (teclado, relógio, serial). Prefira copiar em pedaços menores,
> por exemplo 1 KB (512 palavras) por chamada.

### Calcular o endereço físico de 24 bits

O endereço de um buffer seu em modo real, `DS:offset`, vira um número de 20 bits que cabe nos 3
bytes do descritor. Com instruções do 8086 (deslocamentos de mais de 1 bit só com `CL`):

```asm fragmento titulo="DL:AX = endereço físico de DS:BX (24 bits)"
        MOV  AX,DS
        MOV  DX,AX
        MOV  CL,4
        SHL  AX,CL          ; 16 bits baixos de DS×16
        MOV  CL,12
        SHR  DX,CL          ; 4 bits altos de DS×16
        ADD  AX,BX          ; + offset
        ADC  DL,0           ; propaga o vai-um para os bits 16-23
```

É o `ADC` da [Aula 3](../conteudo/aula03-aritmetica.md) fazendo uma soma de 24 bits.

### Exemplo completo: ler o primeiro KB acima de 1 MB

```asm titulo="ESTENDE.ASM: copia 1 KB de 100000H para um buffer e mostra os 16 primeiros bytes"
.MODEL SMALL
.STACK 100h
.DATA
gdt     DB  16 DUP(0)        ; descritores 0 e 1
orig    DW  03FFH            ; limite: 1024 - 1
        DB  00H,00H,10H      ; base 100000H (byte baixo primeiro)
        DB  93H              ; dados, leitura/escrita
        DW  0
dest    DW  03FFH
dest_b  DB  3 DUP(?)         ; base do buffer: calculada em tempo de execução
        DB  93H
        DW  0
        DB  16 DUP(0)        ; descritores 4 e 5
buf     DB  1024 DUP(0)
m_erro  DB  'INT 15H AH=87H indisponível ou falhou',13,10,'$'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        MOV  ES,AX

        MOV  BX,OFFSET buf   ; endereço físico de DS:buf em DL:AX
        MOV  AX,DS
        MOV  DX,AX
        MOV  CL,4
        SHL  AX,CL
        MOV  CL,12
        SHR  DX,CL
        ADD  AX,BX
        ADC  DL,0
        MOV  WORD PTR dest_b,AX
        MOV  dest_b+2,DL

        MOV  SI,OFFSET gdt   ; ES:SI = GDT
        MOV  CX,512          ; 512 palavras = 1 KB
        MOV  AH,87H
        STC                  ; "ninguém respondeu" conta como falha
        INT  15H
        JC   falhou

        MOV  SI,OFFSET buf   ; mostra 16 bytes em hexadecimal
        MOV  CX,16
mostra: LODSB
        CALL imphex8
        MOV  DL,' '
        MOV  AH,02H
        INT  21H
        LOOP mostra
        JMP  fim
falhou: MOV  DX,OFFSET m_erro
        MOV  AH,09H
        INT  21H
fim:    MOV  AX,4C00H
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

Para **gravar** na memória estendida basta trocar os papéis: o buffer vira a origem e
`100000H`, o destino. Assim funcionavam os *RAM disks* (`VDISK.SYS`) e os primeiros caches de
disco antes dos gerenciadores XMS.

> **Convivência.** A BIOS não controla quem usa a memória estendida. Um programa que grava em
> 100000H pode destruir os dados de um *RAM disk* ou de um gerenciador de memória carregado
> antes. Programas bem-comportados da época perguntavam ao gerenciador (XMS, VDISK) ou
> reduziam o valor informado por `AH=88H` com um tratador de `INT 15H`. Detalhes ficam para a
> parte avançada.

## 14.3 AH = 89H · Entrar em modo protegido

Coloca o 80286 em modo protegido e devolve o controle ao seu código, já em modo protegido, no
segmento de código que você definiu.

**Entrada:** `ES:SI` → GDT com **8 descritores**:

| Descritor | Papel |
|---|---|
| 0 | Nulo |
| 1 | A própria GDT |
| 2 | A IDT do usuário |
| 3 | DS do usuário |
| 4 | ES do usuário |
| 5 | SS do usuário |
| 6 | O segmento de código para onde retornar |
| 7 | Segmento de código temporário da BIOS |

`BH` e `BL` = índices na IDT onde começam as interrupções de hardware dos dois controladores
(IRQ 0–7 e IRQ 8–15).

**Retorno:** `AH=00H`; todos os registradores de segmento, `AX` e `BP` são alterados.

Depois da chamada você **está sozinho**:

1. As funções da BIOS **não funcionam** em modo protegido; você trata toda a E/S.
2. Os vetores de interrupção precisam ser remapeados (a Intel reserva as primeiras 32 entradas
   para exceções do processador, que no modo real colidem com IRQ 0 a 7 nos vetores 08H a 0FH).
3. Os controladores de interrupção devem ser reprogramados para os novos números (é o que `BH` e
   `BL` pedem à BIOS).
4. Você precisa instalar a tabela e os tratadores de exceção.
5. A IDT não pode sobrepor a IDT do modo real da BIOS.

> **E para voltar?** No 80286 não há instrução para sair do modo protegido: a volta ao modo real
> exige resetar o processador (pelo controlador do teclado ou por uma falha tripla), com o flag
> de reset e um endereço de retorno guardados na área de dados e na CMOS. É exatamente o que a
> `AH=87H` faz por dentro. O 80386 voltou a permitir a saída limpando um bit de controle. Esse
> é o terreno dos *DOS extenders* e fica para a parte avançada.

## 14.4 No simulador do curso

O simulador é um PC de 8086 com 1 MB: não há memória estendida nem `INT 15H`. `ESTENDE.ASM` monta
e roda, e mostra a mensagem de erro porque o `STC` antes da chamada não é desfeito. Num emulador
de AT (86Box, PCem, Bochs, ou o DOSBox, que implementa a `AH=87H`), ele mostra os bytes copiados.

## 14.5 Exercícios

1. Modifique `ESTENDE.ASM` para primeiro **gravar** uma mensagem em 100000H e depois lê-la de
   volta para outro buffer, conferindo que voltou igual.
2. Faça uma rotina `XCOPIA` que recebe o endereço físico de origem em `DL:AX`, o de destino em
   `DH:BX` e o número de palavras em `CX`, monta a GDT e chama `AH=87H`, devolvendo `CF`.
3. Use `AH=88H` e `XCOPIA` para testar toda a memória estendida em blocos de 1 KB: grave um
   padrão, leia de volta, compare (com `REPE CMPSB`, [Aula 13](../conteudo/aula13-strings.md)) e
   mostre o total de KB aprovados.

## Resumo

- Acima de 1 MB só se chega em modo protegido; em modo real, a BIOS faz a ponte.
- `AH=87H`: `CX` palavras (até 32 K), `ES:SI` → GDT de 6 descritores; origem no 2, destino no 3,
  base de 24 bits e acesso `93H`; interrupções ficam desligadas durante a cópia.
- `AH=89H`: entra em modo protegido de vez; a partir daí, sem BIOS, com IDT, PICs e exceções por
  conta do programa.
