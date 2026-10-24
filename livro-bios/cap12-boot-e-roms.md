---
id: cap12
numero: 12
parte: 4
titulo: "Inicialização, ROMs de adaptadores e identificação do sistema (INT 18H, INT 19H, POST)"
aulas: aula00; aula12; aula26
---

# Capítulo 12 · Inicialização, ROMs de adaptadores e identificação do sistema

> **Neste capítulo:** o que acontece entre ligar o PC e o DOS aparecer: o POST, a varredura de
> ROMs de adaptadores (assinatura `55H AAH`, tamanho e checksum), o carregador de boot
> (`INT 19H`), o ROM BASIC (`INT 18H`), o flag de reset em `40:72` e a identificação do modelo
> pelos bytes em `F000:FFFE`.
>
> **Antes de ler:** [Aula 12, Segmentos a fundo](../conteudo/aula12-segmentos.md) (o mapa de
> memória, "A volta ao mundo em FFFF:0010") e [Aula 26](../conteudo/aula26-psp-memoria.md) (o
> que existe antes da primeira instrução de um programa).

## 12.1 Do botão de ligar ao setor de boot

```
 reset ─► CPU começa em FFFF:0000 (a ROM da BIOS)
          │
          ▼
        POST: testa CPU, memória (pula se 40:72 = 1234H), vídeo, teclado, discos
          │   instala os vetores padrão (Capítulo 2) e preenche a área de dados (Capítulo 17)
          ▼
        varre C0000H–C7FFFH (ROMs de vídeo) e C8000H–DFFFFH (outras ROMs)
          │   para cada ROM válida: CALL FAR no byte 3
          ▼
        INT 19H: lê trilha 0, setor 1 para 0000:7C00 e salta para lá com DL = unidade
          │   (falhou?) ──► INT 18H: ROM BASIC
          ▼
        setor de boot ──► carrega o sistema operacional (IO.SYS, MSDOS.SYS...)
```

O 8086 começa a executar no endereço físico `FFFF0H` (`FFFF:0000`), 16 bytes antes do fim do
primeiro megabyte, onde a ROM da BIOS tem um salto para o código do POST.

## 12.2 ROMs de adaptadores

Durante o POST, depois de instalar os vetores padrão, a BIOS **varre a memória** à procura de
ROMs de placas:

- `C0000H` a `C7FFFH`: varridos cedo (ROMs de vídeo, como a do EGA);
- `C8000H` a `DFFFFH`: varridos em blocos de 2 KB, para outras placas (controladoras de disco,
  rede).

Uma ROM é **válida** se:

1. Byte 0 = `55H` e byte 1 = `AAH` (assinatura);
2. Byte 2 = tamanho em blocos de 512 bytes (máximo `7FH`);
3. A soma de todos os bytes, módulo 256, é zero (checksum).

Quando encontra uma ROM válida, o POST faz uma **chamada distante** (`CALL FAR`) ao byte 3, que
deve conter código executável (normalmente um `JMP` para a rotina de inicialização). A placa faz
sua inicialização (por exemplo, toma o vetor da `INT 10H` ou da `INT 13H` para si) e devolve o
controle ao POST com `RETF`.

```
  offset 0   1   2      3                   ...      tamanho×512 - 1
       ┌───┬───┬────┬──────────────────────────────┬──────────┐
       │55H│AAH│ n  │ JMP inicialização ...        │ checksum │
       └───┴───┴────┴──────────────────────────────┴──────────┘
       soma de todos os n×512 bytes ≡ 0 (mod 256)
```

### Particularidades

- **PC Convertible:** se o autoteste da placa falhar, a ROM deve ligar o bit 4 de `40:12`,
  colocar o código do dispositivo em `AH` e um código de erro de dois dígitos em `AL`; se estiver
  tudo bem, zera esse bit. Ao voltar de uma ROM de vídeo, `BH` indica: 00H = não é vídeo; 02H =
  vídeo na faixa CGA; 04H = vídeo na faixa monocromática.
- **PS/2:** ROMs de vídeo trazem no offset `0CH` a assinatura `77H, CCH, 'VIDEO'` seguida de
  bytes POS, para a BIOS achar o primeiro vídeo quando a CMOS está inválida.

```asm titulo="ROMS.ASM: procura ROMs de adaptadores de C000H a DF80H"
.MODEL SMALL
.STACK 100h
.DATA
m_rom   DB  'ROM em $'
m_tam   DB  'H, blocos de 512 bytes: $'
m_ok    DB  ' checksum ok',13,10,'$'
m_ruim  DB  ' checksum RUIM',13,10,'$'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        MOV  BX,0C000H          ; segmento atual
procura:
        MOV  ES,BX
        CMP  WORD PTR ES:[0],0AA55H   ; 55H no byte 0, AAH no byte 1
        JNE  proximo
        MOV  DX,OFFSET m_rom
        CALL texto
        MOV  AX,BX
        CALL imphex16
        MOV  DX,OFFSET m_tam
        CALL texto
        MOV  AL,ES:[2]
        CALL imphex8
        ; checksum: soma de tamanho×512 bytes
        MOV  CL,ES:[2]
        XOR  CH,CH
        JCXZ proximo            ; tamanho zero: não é uma ROM de verdade
        PUSH BX
        MOV  BX,CX              ; BX = blocos de 512
        XOR  SI,SI
        XOR  AH,AH              ; AH = soma
bloco:  MOV  CX,512
soma:   ADD  AH,ES:[SI]
        INC  SI
        LOOP soma
        DEC  BX
        JNZ  bloco
        POP  BX
        MOV  DX,OFFSET m_ok
        OR   AH,AH
        JZ   mostra
        MOV  DX,OFFSET m_ruim
mostra: CALL texto
proximo:
        ADD  BX,80H             ; 80H parágrafos = 2 KB
        CMP  BX,0E000H
        JB   procura
        MOV  AX,4C00H
        INT  21H

texto   PROC
        PUSH AX
        MOV  AH,09H
        INT  21H
        POP  AX
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

Repare em `CMP WORD PTR ES:[0],0AA55H`: o 8086 é *little-endian*, então os bytes `55H, AAH` na
memória formam a palavra `AA55H`.

## 12.3 INT 19H · Carregador de inicialização (*bootstrap*)

Lê a **trilha 0, setor 1** (o setor de boot) para o endereço **`0000:7C00H`** e passa o controle
a ele com `CS=0000H`, `IP=7C00H` e **`DL` = unidade** de onde o setor foi lido. Se houver erro de
hardware na leitura, o controle vai para o ponto de entrada do **ROM BASIC** (`INT 18H`).

> **Dois fatos úteis para quem escreve setores de boot:** o código sempre começa em `7C00H`, e a
> unidade vem em `DL`; salve-a antes de mexer em `DX`. Nada do DOS existe ainda: só a BIOS. Por
> isso todo o vídeo, teclado e disco de um setor de boot passa pelas `INT 10H`, `16H` e `13H`.

```asm fragmento titulo="Primeiras instruções típicas de um setor de boot"
; montado para rodar em 0000:7C00 (ORG 7C00H, num segmento que começa em 0)
        CLI
        XOR  AX,AX
        MOV  DS,AX           ; dados relativos a 0000
        MOV  ES,AX
        MOV  SS,AX
        MOV  SP,7C00H        ; pilha cresce para baixo, abaixo do código
        STI
        MOV  unidade,DL      ; guarda a unidade de boot
        ; ... INT 10H para mensagens, INT 13H para ler mais setores ...
```

Executar `INT 19H` com o sistema já carregado é uma forma de "reiniciar sem reiniciar"; mas os
vetores que programas residentes alteraram continuam alterados, por isso não é um reset seguro.
O reset de verdade é saltar para `FFFF:0000`, de preferência gravando antes `1234H` em `40:72`
para pular o teste de memória.

A estrutura completa de um setor de boot (bloco de parâmetros do DOS, carregar um segundo
estágio, a assinatura no fim do setor) é tema da parte avançada do livro.

## 12.4 INT 18H · BASIC residente

Nos PCs originais da IBM, a ROM trazia um interpretador **Cassette BASIC**. A `INT 18H` o
inicia; é para lá que a `INT 19H` desvia quando não consegue ler um setor de boot. Nos PS/2 e
compatíveis sem ROM BASIC, a mesma interrupção mostra uma mensagem pedindo um disco de sistema.
Os vetores 80H a F0H do mapa ficam reservados para esse BASIC.

## 12.5 O flag de reset (40:72)

| Valor | Significado |
|---|---|
| `1234H` | pular o teste de memória (gravado pelo Ctrl-Alt-Del) |
| `4321H` | preservar a memória (PS/2, exceto Model 30) |
| `5678H`, `9ABCH`, `ABCDH` | estados de suspensão e teste de fábrica do PC Convertible |

```asm fragmento titulo="Reiniciar como o Ctrl-Alt-Del (reset a quente)"
        MOV  AX,0040H
        MOV  DS,AX
        MOV  WORD PTR DS:[0072H],1234H
        DB   0EAH                 ; JMP FAR codificado à mão:
        DW   0000H,0FFFFH         ; offset 0000H, segmento FFFFH
```

O `DB 0EAH` seguido de offset e segmento é a codificação do `JMP FAR` direto; montá-la à mão
evita depender de um rótulo `FAR` no segmento da ROM.

## 12.6 Identificação do sistema

O **byte de modelo** de cada ROM de BIOS fica em **`F000:FFFE`**. Alguns sistemas têm também
um byte de submodelo e um nível de revisão. A forma recomendada de ler tudo isso é
`INT 15H, AH=C0H` ([Capítulo 8](cap08-equipamento-e-memoria.md)); a tabela completa de
produtos, datas de BIOS e bytes (Figura 4-1) está no manual. O PC (1981) usa o modelo `FFH`.

Valores amplamente conhecidos, para orientação (confira a Figura 4-1 antes de depender de um
submodelo):

| Modelo | Sistemas |
|---|---|
| `FFH` | PC |
| `FEH` | PC XT, Portable PC |
| `FDH` | PCjr |
| `FCH` | AT, XT 286, PS/2 Model 50 e 60 (distinguidos pelo submodelo) |
| `FBH` | PC XT (BIOS de 10/01/86) |
| `FAH` | PS/2 Model 30 |
| `F9H` | PC Convertible |
| `F8H` | PS/2 Model 80 |

> **Em caso de dúvida sobre o modelo**, use o descritor da `C0H`; não compare datas de BIOS "no
> olho". E prefira testar **recursos** (há segundo PIC? há RTC? a função existe?) a testar
> modelos: compatíveis de outros fabricantes usam os mesmos bytes com hardware diferente.

A data da BIOS (`F000:FFF5`, 8 caracteres) está no [Capítulo 1](cap01-o-que-e-a-bios.md).

## 12.7 No simulador do curso

A memória de `C0000H` a `DFFFFH` está vazia (sem ROMs de adaptador), então `ROMS.ASM` roda e não
encontra nada. `INT 18H` e `INT 19H` não têm serviço; não há POST nem reset. A leitura direta
de `F000:FFFE` e `F000:FFF5` funciona, mas devolve o conteúdo da ROM simulada, que não imita
uma BIOS da IBM.

## 12.8 Exercícios

1. Estenda `ROMS.ASM` para mostrar, para cada ROM, os 3 primeiros bytes de código (offset 3) e,
   num PS/2, se ela tem a assinatura `77H, CCH, 'VIDEO'` no offset `0CH`.
2. Escreva `MODELO.ASM`: tenta `INT 15H, AH=C0H`; se funcionar, imprime modelo, submodelo e
   revisão; senão lê `F000:FFFE`. Depois escreve o nome do sistema pela tabela da seção 12.6.
3. Explique por que o checksum de uma ROM de 16 KB (`n = 20H`) soma 16384 bytes e por que o
   último byte da ROM normalmente é o que "acerta" a soma.

## Resumo

- O POST testa, instala vetores e varre `C0000H`–`DFFFFH` por ROMs `55H AAH` com checksum zero,
  chamando o byte 3 de cada uma.
- `INT 19H` carrega o setor de boot em `0000:7C00` e salta para lá com `DL` = unidade; se falhar,
  `INT 18H`.
- `40:72 = 1234H` pula o teste de memória num reset; o reset é um salto para `FFFF:0000`.
- O modelo fica em `F000:FFFE`; o caminho oficial é `INT 15H, AH=C0H`.
