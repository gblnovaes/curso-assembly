---
id: aula05
numero: 5
modulo: 2
titulo: CMP e saltos condicionais
subtitulo: Como o Assembly toma decisões e repete coisas
duracao: 60 min
objetivos: usar JMP e rótulos; comparar valores com CMP; escolher o salto certo para números com e sem sinal; escrever if, if/else, while e for em Assembly; entender o limite de alcance dos saltos condicionais do 8086
---

## Rótulos e JMP

Até agora, a CPU executou as instruções na ordem em que aparecem. Para mudar essa ordem existem os **saltos**. O mais simples é `JMP` (*jump*), que salta sempre:

```asm fragmento
        JMP  pula_aqui      ; vai direto para o rótulo
        MOV  AX, 1          ; esta linha nunca é executada
pula_aqui:
        MOV  BX, 2
```

Um **rótulo** é um nome seguido de dois pontos. Ele marca uma posição no código. O montador troca o rótulo pela distância até ele: um `JMP` para perto vira só 2 bytes (`EB` + distância de −128 a +127).

## CMP: comparar sem estragar

`CMP a, b` faz a mesma conta que `SUB a, b`, mas **joga fora o resultado** e guarda só as flags. Nenhum operando muda. Depois de um `CMP`, as flags dizem tudo sobre a relação entre `a` e `b`:

| Se... | ZF | CF (sem sinal) | SF e OF (com sinal) |
|-------|----|-----------------|---------------------|
| a = b | 1 | 0 | SF = OF |
| a < b | 0 | 1 | SF ≠ OF |
| a > b | 0 | 0 | SF = OF |

Você não precisa decorar essa tabela: os saltos condicionais fazem a leitura por você.

## Os saltos condicionais

Um salto condicional pula **se** uma condição sobre as flags for verdadeira; senão, segue para a próxima instrução. Os nomes seguem uma lógica:

- **E** = *equal* (igual), **Z** = *zero*, **N** = *not* (não)
- **A** = *above* (acima) e **B** = *below* (abaixo): comparações **sem sinal**
- **G** = *greater* (maior) e **L** = *less* (menor): comparações **com sinal**

| Depois de `CMP a,b`, pule se... | Sem sinal | Com sinal | Flags testadas |
|------|-----------|-----------|----------------|
| a = b | `JE` / `JZ` | `JE` / `JZ` | ZF = 1 |
| a ≠ b | `JNE` / `JNZ` | `JNE` / `JNZ` | ZF = 0 |
| a > b | `JA` / `JNBE` | `JG` / `JNLE` | sem: CF=0 e ZF=0 · com: ZF=0 e SF=OF |
| a ≥ b | `JAE` / `JNB` / `JNC` | `JGE` / `JNL` | sem: CF=0 · com: SF=OF |
| a < b | `JB` / `JNAE` / `JC` | `JL` / `JNGE` | sem: CF=1 · com: SF≠OF |
| a ≤ b | `JBE` / `JNA` | `JLE` / `JNG` | sem: CF=1 ou ZF=1 · com: ZF=1 ou SF≠OF |

E os que testam uma flag só: `JC`/`JNC` (CF), `JZ`/`JNZ` (ZF), `JS`/`JNS` (SF), `JO`/`JNO` (OF), `JP`/`JNP` (PF).

:::atencao JA não é JG
Este é **o** bug clássico (a Aula 20 volta nele). Compare AX = FFFFh com BX = 1:

- Sem sinal, FFFFh é 65.535, maior que 1: `JA` pula.
- Com sinal, FFFFh é −1, menor que 1: `JG` **não** pula.

Os bits são os mesmos; a pergunta é diferente. Use **A/B** para endereços, tamanhos, contadores e caracteres. Use **G/L** para valores que podem ser negativos.
:::

## Traduzindo estruturas de controle

### if

```asm fragmento
; if (AX == 10) BX = 1;
        CMP  AX, 10
        JNE  fim_if         ; condição INVERTIDA: pula o bloco se for diferente
        MOV  BX, 1
fim_if:
```

O truque é **inverter a condição**: em vez de "se igual, faça", escreva "se diferente, pule o bloco".

### if / else

```asm fragmento
; if (AX < BX) CX = AX; else CX = BX;   (sem sinal)
        CMP  AX, BX
        JAE  senao          ; se AX >= BX, vai para o else
        MOV  CX, AX         ; bloco do if
        JMP  fim_se         ; pula o else!
senao:
        MOV  CX, BX         ; bloco do else
fim_se:
```

Não esqueça o `JMP` no fim do bloco do if; sem ele, a CPU executa também o else.

### while e for

Laços também são feitos com saltos. Este soma 1 + 2 + ... + 10:

```asm executar titulo="Soma de 1 a 10"
        XOR  AX, AX         ; AX = 0 (acumulador)
        MOV  CX, 1          ; contador i = 1
laco:
        CMP  CX, 10
        JA   fim_laco       ; while (i <= 10)
        ADD  AX, CX         ;   soma += i
        INC  CX             ;   i++
        JMP  laco
fim_laco:                   ; AX = 55 = 0037h
```

Uma forma mais eficiente conta **para baixo** e testa no fim, aproveitando que `DEC` atualiza ZF:

```asm executar titulo="Soma de 10 até 1"
        XOR  AX, AX
        MOV  CX, 10
volta:
        ADD  AX, CX
        DEC  CX             ; ZF = 1 quando CX chega a zero
        JNZ  volta          ; repete enquanto CX != 0
```

São 3 instruções por volta em vez de 5. Na Aula 7 você verá que o 8086 tem até uma instrução própria para isso: `LOOP`.

## O alcance limitado dos saltos condicionais

No 8086, **todos** os saltos condicionais são **curtos**: o destino precisa estar entre −128 e +127 bytes da instrução seguinte. Se o bloco ficar grande demais, o montador dá erro. A solução clássica é inverter a condição e usar um `JMP`, que alcança qualquer lugar do segmento:

```asm fragmento
; Em vez de:   JE  muito_longe     (erro: fora do alcance)
        JNE  continua
        JMP  muito_longe
continua:
```

:::anos90 "Relative jump out of range"
Essa mensagem de erro do MASM perseguia todo mundo que escrevia rotinas grandes. O TASM tinha a diretiva `JUMPS`, que fazia essa troca automaticamente. A partir do 80386 a Intel criou saltos condicionais longos (2 ou 4 bytes de distância), mas no 8086 o limite é este.
:::

```quiz
? Depois de CMP AX,BX com AX = 5 e BX = 5, qual salto acontece?
+ JE
- JA
- JB
> 5 = 5: ZF = 1, e JE pula quando ZF = 1.

? AX = 0FFFEh (−2 com sinal) e BX = 3. Depois de CMP AX,BX, quais saltos pulam?
- JA e JG
+ JA e JL
- JB e JG
> Sem sinal, 65.534 > 3 (JA pula). Com sinal, −2 < 3 (JL pula).

? Para escrever "if (AX == 0) { bloco }", qual salto vai antes do bloco?
- JE fim
+ JNE fim
- JMP fim
> Invertemos a condição: se NÃO for zero, pulamos o bloco.

? Por que o if/else precisa de um JMP no fim do bloco do if?
+ Para não executar também o bloco do else.
- Porque CMP exige um JMP depois.
- Para limpar as flags.
> Sem o JMP, depois do bloco do if a CPU continua em linha reta e cai no else.

? Qual o alcance de JNE no 8086?
- Qualquer lugar do segmento
+ De −128 a +127 bytes
- 1 MB
> Saltos condicionais do 8086 são sempre curtos (deslocamento de 1 byte com sinal).
```

## Exercícios

```exercicio
id: a05-1
titulo: O maior sem sinal
nivel: 1
--- enunciado
Coloque em **CX** o **maior** entre **AX** e **BX**, tratando-os como números **sem sinal**.
--- inicial
; CX = max(AX, BX) sem sinal
--- testes
[
 { "nome": "AX=5, BX=9", "setup": { "AX": 5, "BX": 9 }, "espera": { "CX": 9 } },
 { "nome": "AX=900, BX=30", "setup": { "AX": 900, "BX": 30 }, "espera": { "CX": 900 } },
 { "nome": "AX=FFFFh, BX=1", "setup": { "AX": 65535, "BX": 1 }, "espera": { "CX": 65535 } },
 { "nome": "iguais", "setup": { "AX": 7, "BX": 7 }, "espera": { "CX": 7 } }
]
--- dicas
Comece supondo que AX é o maior (MOV CX,AX). Depois compare e troque se precisar.
Sem sinal: use JA/JAE/JB/JBE.
--- solucao
        MOV  CX, AX
        CMP  AX, BX
        JAE  pronto
        MOV  CX, BX
pronto:
```

```exercicio
id: a05-2
titulo: O maior com sinal
nivel: 2
--- enunciado
Agora **AX** e **BX** são números **com sinal**. Coloque o maior em **CX**.
--- inicial
; CX = max(AX, BX) com sinal
--- testes
[
 { "nome": "AX=5, BX=9", "setup": { "AX": 5, "BX": 9 }, "espera": { "CX": 9 } },
 { "nome": "AX=-1, BX=1", "setup": { "AX": -1, "BX": 1 }, "espera": { "CX": 1 } },
 { "nome": "AX=-300, BX=-20", "setup": { "AX": -300, "BX": -20 }, "espera": { "CX": -20 } },
 { "nome": "AX=100, BX=-100", "setup": { "AX": 100, "BX": -100 }, "espera": { "CX": 100 } }
]
--- dicas
Troque os saltos A/B por G/L.
--- solucao
        MOV  CX, AX
        CMP  AX, BX
        JGE  pronto
        MOV  CX, BX
pronto:
```

```exercicio
id: a05-3
titulo: Faixas de valores
nivel: 2
--- enunciado
Classifique **AX** (sem sinal) e coloque o resultado em **BX**:

- BX = **1** se AX < 10
- BX = **2** se 10 ≤ AX < 100
- BX = **3** se AX ≥ 100
--- inicial
; classifique AX em BX
--- testes
[
 { "nome": "AX=0", "setup": { "AX": 0 }, "espera": { "BX": 1 } },
 { "nome": "AX=9", "setup": { "AX": 9 }, "espera": { "BX": 1 } },
 { "nome": "AX=10", "setup": { "AX": 10 }, "espera": { "BX": 2 } },
 { "nome": "AX=99", "setup": { "AX": 99 }, "espera": { "BX": 2 } },
 { "nome": "AX=100", "setup": { "AX": 100 }, "espera": { "BX": 3 } },
 { "nome": "AX=50000", "setup": { "AX": 50000 }, "espera": { "BX": 3 } }
]
--- dicas
Teste do menor para o maior: CMP AX,10 / JB um.
Não esqueça de pular para o fim depois de cada caso.
--- solucao
        MOV  BX, 1
        CMP  AX, 10
        JB   fim
        MOV  BX, 2
        CMP  AX, 100
        JB   fim
        MOV  BX, 3
fim:
```

```exercicio
id: a05-4
titulo: Potência de 2
nivel: 3
proibir: MUL, IMUL
--- enunciado
Calcule **AX = 2 elevado a CX** (CX vai de 0 a 15) usando um laço. Use apenas somas, comparações e saltos.
--- inicial
; AX = 2^CX
--- testes
[
 { "nome": "2^0", "setup": { "CX": 0 }, "espera": { "AX": 1 } },
 { "nome": "2^1", "setup": { "CX": 1 }, "espera": { "AX": 2 } },
 { "nome": "2^10", "setup": { "CX": 10 }, "espera": { "AX": 1024 } },
 { "nome": "2^15", "setup": { "CX": 15 }, "espera": { "AX": 32768 } }
]
--- dicas
Comece com AX = 1 e dobre AX (ADD AX,AX) CX vezes.
Cuidado com CX = 0: teste antes de entrar no laço.
--- solucao
        MOV  AX, 1
proximo:
        CMP  CX, 0
        JE   fim
        ADD  AX, AX
        DEC  CX
        JMP  proximo
fim:
```

:::resumo
- `JMP rótulo` salta sempre. `CMP a,b` calcula a − b só para as flags.
- Sem sinal: `JA`, `JAE`, `JB`, `JBE`. Com sinal: `JG`, `JGE`, `JL`, `JLE`. Ambos: `JE`, `JNE`.
- if: compare e salte com a condição invertida. if/else: um `JMP` no fim do bloco do if.
- Laços: contar para baixo com `DEC` + `JNZ` é o mais enxuto.
- Saltos condicionais do 8086 só alcançam −128..+127 bytes.
:::
