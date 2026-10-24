---
id: cap08
numero: 8
parte: 4
titulo: "Equipamento, memória e identificação do sistema (INT 11H, INT 12H, INT 15H 88H/C0H/C1H)"
aulas: aula04; aula12; aula26
---

# Capítulo 8 · Equipamento, memória e identificação do sistema

> **Neste capítulo:** como um programa descobre o que existe na máquina: a lista de
> equipamento (`INT 11H`), a memória convencional (`INT 12H`), a memória estendida
> (`INT 15H, AH=88H`), o descritor do sistema (`INT 15H, AH=C0H`) e a área de dados estendida
> (`INT 15H, AH=C1H`).
>
> **Antes de ler:** [Aula 4, O registrador de FLAGS](../conteudo/aula04-flags.md) (testar bits
> com `TEST` e `AND`), [Aula 12, Segmentos a fundo](../conteudo/aula12-segmentos.md) (o mapa de
> memória do PC) e [Aula 26, PSP, linha de comando e memória](../conteudo/aula26-psp-memoria.md)
> (como o DOS reparte a memória que a BIOS informa).

## 8.1 INT 11H · Determinação de equipamento

Retorna em `AX` um mapa de bits com o hardware instalado, montado pelo POST e guardado em
`40:10`.

| Bits | Significado |
|---|---|
| 15–14 | Número de impressoras |
| 13 | Modem interno instalado |
| 12 | Não usado |
| 11–9 | Número de placas RS-232-C (seriais) |
| 8 | Não usado |
| 7–6 | Número de unidades de disquete, menos 1 (somente se o bit 0 = 1): `00` = 1, `01` = 2 |
| 5–4 | Modo de vídeo inicial: `01` = 40×25 cor; `10` = 80×25 cor; `11` = 80×25 mono |
| 3 | Não usado |
| 2 | Dispositivo apontador (mouse) instalado |
| 1 | Coprocessador matemático instalado |
| 0 | Há disquete de inicialização (IPL) |

```asm fragmento titulo="Quantos disquetes?"
        INT  11H
        TEST AL,01H        ; bit 0: há disquetes?
        JZ   sem_disquete
        MOV  CL,6
        SHR  AX,CL
        AND  AX,3          ; AX = nº de disquetes - 1
        INC  AX            ; AX = nº de disquetes
```

O 8086 só desloca mais de uma posição com o contador em `CL`; `SHR AX,6` é instrução do
80186 e o montador do curso a recusa (veja [Aula 16](../conteudo/aula16-otimizacao1.md)).

> **Coprocessador presente?** O bit 1 diz se o POST encontrou um 8087/80287. Um programa
> que usa as instruções da [Aula 31](../conteudo/aula31-8087.md) deve testá-lo antes e
> oferecer uma rotina alternativa em inteiros ou ponto fixo ([Aula 30](../conteudo/aula30-bcd-ponto-fixo.md)).
> Em máquinas muito antigas a chave de configuração podia estar errada; o teste definitivo é
> `FNINIT` seguido de `FNSTSW` e conferir se a palavra de estado ficou zerada.

## 8.2 INT 12H · Tamanho da memória convencional

Devolve em `AX` a quantidade de memória **convencional contígua**, em blocos de 1 KB, até
640 KB, **descontando** o que foi reservado para a *Extended BIOS Data Area* (seção 8.5). O
cálculo parte de duas hipóteses: toda a memória instalada funciona, e os primeiros 640 KB são
contíguos. O mesmo valor fica em `40:13`.

```asm fragmento
INT  12H           ; AX = KB de memória convencional (ex.: 640 = 0280H)
```

O segmento logo depois do fim da memória convencional é `AX × 64` (1 KB = 64 parágrafos de
16 bytes): com 640 KB, `A000H`, justamente onde começa a memória de vídeo gráfica.

```
 00000H ┌─────────────────────────────┐
        │ IVT (1 KB)                  │  Capítulo 2
 00400H │ área de dados da BIOS       │  Capítulo 17
 00500H │ DOS, drivers, programas     │  Aula 26 (MCBs)
        │ ...                         │
        │ EBDA (PS/2, alguns KB)      │  seção 8.5
 A0000H ├─────────────────────────────┤  ← INT 12H × 1024
        │ memória de vídeo            │  Capítulos 3 a 5
 C0000H │ ROMs de adaptadores         │  Capítulo 12
 F0000H │ ROM da BIOS                 │
 FFFFFH └─────────────────────────────┘
        acima de 1 MB: memória estendida (AT e PS/2), INT 15H AH=88H/87H
```

## 8.3 INT 15H, AH = 88H · Tamanho da memória estendida

Retorna em `AX` quantos KB contíguos existem a partir do endereço **1 MB (100000H)**, como o
POST os detectou. Disponível em AT, XT 286 e PS/2 (exceto Model 30). O sistema pode não
conseguir usar memória de E/S em certos casos.

```asm fragmento
        MOV  AH,88H
        INT  15H
        JC   sem_estendida
        ; AX = KB acima de 1 MB
```

Um programa em modo real não alcança esses bytes diretamente; para copiar dados de e para lá
existe `INT 15H, AH=87H`, explicada no [Capítulo 14](cap14-memoria-estendida-modo-protegido.md).

## 8.4 INT 15H, AH = C0H · Parâmetros de configuração do sistema

Existe em AT com BIOS de 10/06/85 em diante, XT de 10/01/86 em diante, XT 286, PC Convertible
e PS/2. Em PCjr e PC retorna `AH=80H, CF=1`; em máquinas mais antigas, `AH=86H, CF=1`.

Retorna em `ES:BX` um ponteiro para o **descritor do sistema**, que fica em ROM:

| Offset | Tamanho | Conteúdo |
|---|---|---|
| 0 | palavra | Quantidade de bytes que seguem (mínimo 8) |
| 2 | byte | **Modelo** |
| 3 | byte | **Submodelo** |
| 4 | byte | Nível de revisão da BIOS (00H = primeira versão, +1 a cada nova) |
| 5 | byte | Informações de recurso nº 1 (bits abaixo) |
| 6 | 4 bytes | Informações de recurso 2 a 5 (reservadas) |

Bits do byte de recursos nº 1:

| Bit | Se = 1 |
|---|---|
| 7 | A BIOS do disco fixo usa o canal DMA 3 |
| 6 | Há um segundo controlador de interrupções (IRQ 8 a 15) |
| 5 | Há relógio de tempo real |
| 4 | A `INT 09H` chama a interceptação de teclado (`INT 15H, AH=4FH`) |
| 3 | Suporta "esperar evento externo" (`INT 15H, AH=41H`) |
| 2 | Há *Extended BIOS Data Area* alocada |
| 1 | Barramento Micro Channel (0 = barramento do tipo PC) |
| 0 | Reservado |

Se o modelo de um PS/2 (exceto Model 30) não pode ser determinado, a função retorna `AH=86H,
CF=1` e `ES:BX` não muda.

```asm fragmento titulo="Modelo e recursos"
        MOV  AH,0C0H
        INT  15H
        JC   nao_suportado
        MOV  AL,ES:[BX+2]            ; byte de modelo
        TEST BYTE PTR ES:[BX+5],40H  ; segundo PIC?
        JNZ  tem_irq_alta
```

O byte de modelo também fica em `F000:FFFE` em todas as BIOS, inclusive nas antigas que não
têm a `C0H`. A tabela de modelos está no [Capítulo 12](cap12-boot-e-roms.md).

## 8.5 INT 15H, AH = C1H · A área de dados estendida da BIOS (EBDA)

Retorna `ES` = segmento da *Extended BIOS Data Area*, uma região de dados da BIOS (usada, por
exemplo, pelo mouse PS/2) reservada no **topo da memória convencional**. O POST reserva o
bloco logo abaixo de 640 KB e **diminui** o valor em `40:13` na mesma proporção. É por isso que
`INT 12H` pode devolver menos de 640 KB num PS/2.

Só PS/2 e posteriores; PC XT, AT, XT 286 e PC Convertible retornam `AH=86H`. Para saber se a
EBDA existe antes de chamar, teste o bit 2 do byte de recursos da `C0H`.

> **Consequência para o DOS.** Como a EBDA fica acima do último byte que `INT 12H` informa, o
> DOS nunca a entrega a um programa: a cadeia de MCBs da Aula 26 termina antes dela. Um
> programa que "acha" memória livre logo abaixo de A000H, sem perguntar ao DOS, pode estar
> pisando nos dados do mouse.

## 8.6 Exemplo completo: o inventário da máquina

```asm titulo="INVENT.ASM: equipamento e memória pela BIOS"
.MODEL SMALL
.STACK 100h
.DATA
m_mem   DB  'Memória convencional (KB): $'
m_imp   DB  13,10,'Impressoras: $'
m_ser   DB  13,10,'Portas seriais: $'
m_fpu   DB  13,10,'Coprocessador: $'
m_sim   DB  'sim$'
m_nao   DB  'não$'
m_fim   DB  13,10,'$'
equip   DW  ?
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        INT  11H
        MOV  equip,AX

        MOV  DX,OFFSET m_mem
        CALL texto
        INT  12H
        CALL decimal              ; AX em decimal

        MOV  DX,OFFSET m_imp
        CALL texto
        MOV  AX,equip
        MOV  CL,14
        SHR  AX,CL                ; bits 15-14
        CALL decimal

        MOV  DX,OFFSET m_ser
        CALL texto
        MOV  AX,equip
        MOV  CL,9
        SHR  AX,CL
        AND  AX,7                 ; bits 11-9
        CALL decimal

        MOV  DX,OFFSET m_fpu
        CALL texto
        MOV  DX,OFFSET m_nao
        TEST equip,0002H          ; bit 1
        JZ   mostra_fpu
        MOV  DX,OFFSET m_sim
mostra_fpu:
        CALL texto
        MOV  DX,OFFSET m_fim
        CALL texto
        MOV  AX,4C00H
        INT  21H

texto   PROC
        MOV  AH,09H
        INT  21H
        RET
texto   ENDP

; imprime AX (sem sinal) em decimal, por divisões sucessivas (Aula 11)
decimal PROC
        PUSH BX
        PUSH CX
        PUSH DX
        MOV  BX,10
        XOR  CX,CX
divide: XOR  DX,DX
        DIV  BX                   ; DX:AX / 10
        PUSH DX                   ; resto = dígito
        INC  CX
        OR   AX,AX
        JNZ  divide
mostra: POP  DX
        ADD  DL,'0'
        MOV  AH,02H
        INT  21H
        LOOP mostra
        POP  DX
        POP  CX
        POP  BX
        RET
decimal ENDP
END inicio
```

## 8.7 No simulador do curso

O simulador mantém `40:13 = 640` mas não implementa `INT 11H`, `INT 12H` nem a `INT 15H`: as
chamadas mostram um aviso e deixam AX como estava, e `INVENT.ASM` imprime números sem sentido
(o que sobrou em AX). Para rodá-lo de verdade no laboratório,
troque `INT 12H` por uma leitura de `40:13` (exercício 1). Num PC real ou emulador o programa
funciona como está.

## 8.8 Exercícios

1. Reescreva `INVENT.ASM` lendo `40:10` e `40:13` diretamente, sem `INT 11H` e `INT 12H`, e
   confira que dá o mesmo resultado num PC real.
2. Acrescente ao inventário o número de disquetes, o modo de vídeo inicial (40×25, 80×25 cor
   ou mono) e, num AT, a memória estendida (`AH=88H`).
3. Use `AH=C0H` para imprimir modelo, submodelo e revisão em hexadecimal; se a função não
   existir, leia o modelo em `F000:FFFE`.
4. Calcule o segmento onde termina a memória convencional (`INT 12H × 64`) e compare com o
   segmento devolvido por `AH=C1H` num PS/2. Devem coincidir. Por quê?

## Resumo

- `INT 11H` devolve o mapa de equipamento de `40:10`; os campos são extraídos com `SHR`/`AND`.
- `INT 12H` devolve os KB de memória convencional (de `40:13`), já descontada a EBDA.
- `INT 15H, AH=88H` informa a memória acima de 1 MB (AT e PS/2).
- `INT 15H, AH=C0H` devolve modelo, submodelo, revisão e os recursos (PIC escravo, RTC, 4FH,
  EBDA, Micro Channel).
- `INT 15H, AH=C1H` devolve o segmento da EBDA (PS/2).
