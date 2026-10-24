---
id: aula13
numero: 13
modulo: 5
titulo: Instruções de string
subtitulo: MOVS, STOS, LODS, SCAS, CMPS e o prefixo REP
duracao: 75 min
objetivos: conhecer as cinco instruções de string e os registradores que elas usam; controlar a direção com CLD e STD; repetir operações com REP, REPE e REPNE; limpar a tela, copiar, medir e comparar strings em poucas instruções; entender por que REP MOVSW era o coração das rotinas rápidas dos anos 90
---

## Um laço em uma instrução

Na Aula 12 copiamos uma string para a tela com um laço de cinco instruções: ler de `[SI]`, gravar em `[DI]`, avançar SI, avançar DI e `LOOP`. Esse padrão é tão comum que a Intel criou instruções que fazem tudo isso **sozinhas**: as **instruções de string**.

Todas seguem as mesmas convenções:

```diagrama titulo="Os registradores das instruções de string"
   origem:   DS:SI  ──►  ┌───────────┐
                         │ instrução │  CX conta as repetições (com REP)
   destino:  ES:DI  ◄──  │ de string │  DF escolhe a direção
                         └───────────┘
   DF = 0 (CLD): SI e DI aumentam   ──►  percorre para frente
   DF = 1 (STD): SI e DI diminuem   ◄──  percorre para trás
   o passo é 1 (versões B) ou 2 (versões W)
```

| Instrução | O que faz | Usa | Flags |
|-----------|-----------|-----|-------|
| `MOVSB` / `MOVSW` | copia `DS:[SI]` para `ES:[DI]` | SI, DI | nenhuma |
| `STOSB` / `STOSW` | grava AL/AX em `ES:[DI]` | DI | nenhuma |
| `LODSB` / `LODSW` | lê `DS:[SI]` para AL/AX | SI | nenhuma |
| `SCASB` / `SCASW` | compara AL/AX com `ES:[DI]` | DI | como CMP |
| `CMPSB` / `CMPSW` | compara `DS:[SI]` com `ES:[DI]` | SI, DI | como CMP |

Depois de cada execução, SI e/ou DI avançam (ou recuam) automaticamente.

:::atencao O destino é sempre ES:DI
O destino das instruções de string **sempre** usa ES, e isso não pode ser trocado com prefixo. No modelo SMALL, ES começa apontando para o PSP, e não para os seus dados! Antes de usar `MOVSB`, `STOSB`, `SCASB` ou `CMPSB` nos seus dados, faça ES = DS:

```asm fragmento
        MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX         ; ES = DS: agora o destino também são os dados
```
:::

## CLD e STD: a direção

A flag **DF** (Direction Flag) decide se SI e DI sobem ou descem. Duas instruções a controlam:

- `CLD` (Clear Direction): DF = 0, os endereços **aumentam**. É o caso normal.
- `STD` (Set Direction): DF = 1, os endereços **diminuem**.

:::dica Sempre CLD antes
Nunca confie no valor de DF que você recebeu. Uma rotina que deixou DF = 1 por engano faz todas as cópias seguintes andarem para trás e destruírem a memória. Os programadores cuidadosos escreviam `CLD` antes de cada bloco de instruções de string, e quem usava `STD` voltava a `CLD` logo depois.
:::

## O prefixo REP

Sozinha, uma instrução de string processa um elemento. Com o prefixo **REP** ela se repete **CX vezes**:

```asm fragmento
        CLD
        MOV  CX, 100
        REP  MOVSB          ; copia 100 bytes de DS:SI para ES:DI
```

O que `REP` faz, a cada repetição:

1. Se CX = 0, termina.
2. Executa a instrução (e avança SI/DI).
3. Decrementa CX e volta ao passo 1.

:::cpu REP com CX = 0 não faz nada
Repare que o teste vem **antes**: `REP` com CX = 0 executa zero vezes. Isso é o oposto do `LOOP`, que decrementa antes de testar e roda 65.536 vezes com CX = 0 (Aula 7). E o `REP` também não mexe nas flags ao decrementar CX.
:::

### REPE e REPNE: repetir enquanto

Para `SCAS` e `CMPS`, que comparam, existem duas variantes que param mais cedo:

| Prefixo | Sinônimo | Repete enquanto | Uso típico |
|---------|----------|-----------------|------------|
| `REP` | | CX ≠ 0 | MOVS, STOS |
| `REPE` | `REPZ` | CX ≠ 0 **e** ZF = 1 (iguais) | comparar strings |
| `REPNE` | `REPNZ` | CX ≠ 0 **e** ZF = 0 (diferentes) | procurar um caractere |

Quando termina, você descobre o motivo olhando ZF: se parou porque achou (ou porque achou uma diferença), ZF diz qual foi o último resultado.

## Exemplo: limpar a tela

Limpar a tela de texto é gravar 2.000 células (80 × 25) com espaço (20h) e atributo cinza sobre preto (07h). Com `REP STOSW`, são cinco instruções:

```asm executar titulo="LIMPA.ASM: limpando a tela com REP STOSW"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX, 0B800h
        MOV  ES, AX
        XOR  DI, DI         ; começa em B800:0000
        MOV  AX, 1F20h      ; espaço, branco sobre azul
        MOV  CX, 80*25      ; 2000 células
        CLD
        REP  STOSW          ; grava AX em ES:[DI] 2000 vezes
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Rode no laboratório: a tela inteira fica azul de uma vez. Experimente trocar `1F20h` por `4EB1h` (o caractere ▒ em amarelo sobre vermelho).

## Exemplo: copiar uma string

```asm executar titulo="COPIA.ASM: copiando com REP MOVSB"
.MODEL SMALL
.STACK 100h
.DATA
origem  DB 'Copiado com REP MOVSB!', 13, 10, '$'
TAM     EQU $ - origem
destino DB TAM DUP(?)
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX             ; destino também nos dados

        MOV  SI, OFFSET origem
        MOV  DI, OFFSET destino
        MOV  CX, TAM
        CLD
        REP  MOVSB              ; copia TAM bytes

        MOV  DX, OFFSET destino ; imprime a cópia
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

### Cópias com sobreposição

Se origem e destino se sobrepõem, a direção importa. Imagine deslocar uma string um byte para a direita para abrir espaço (como ao inserir uma letra em um editor):

```diagrama titulo="Copiando para frente com sobreposição"
  antes:        A B C D _          origem = posição 0, destino = posição 1
  CLD, byte 1:  A A C D _          o A sobrescreve o B antes de ele ser copiado!
  CLD, byte 2:  A A A D _
  resultado:    A A A A A          errado

  STD, começando do fim (SI = 3, DI = 4):
  resultado:    A A B C D          certo
```

A regra: se o **destino está depois** da origem e eles se sobrepõem, copie **de trás para frente** com `STD`, apontando SI e DI para o **último** elemento. É exatamente o que a função `memmove` da biblioteca C faz.

```quiz
? Qual segmento a instrução STOSB usa para gravar?
- DS
+ ES, sempre
- O segmento indicado pelo prefixo
> O destino das instruções de string é sempre ES:DI e não aceita prefixo de segmento.

? O que REP MOVSB faz se CX = 0?
+ Não copia nada
- Copia 65.536 bytes
- Copia 1 byte
> REP testa CX antes de executar. É o LOOP que roda 65.536 vezes com CX = 0.

? Depois de LODSB com DF = 0, o que acontece com SI?
- Diminui 1
+ Aumenta 1
- Aumenta 2
> LODSB lê um byte, então o passo é 1. Com DF = 0 os endereços sobem.

? Qual prefixo usar para procurar um caractere com SCASB?
- REP
- REPE
+ REPNE
> REPNE repete enquanto os valores forem diferentes, ou seja, até achar o caractere (ZF = 1) ou acabar o CX.

? Para deslocar uma string 1 byte para a direita na mesma área de memória, qual é o jeito certo?
- CLD e copiar do começo para o fim
+ STD e copiar do fim para o começo
- Tanto faz a direção
> Com destino depois da origem e sobreposição, copiar para frente sobrescreve bytes antes de copiá-los.
```

## Medindo uma string: strlen com REPNE SCASB

Em C, as strings terminam com o byte 0. Para medir uma, procuramos o 0 com `REPNE SCASB`:

```asm executar titulo="STRLEN.ASM: medindo uma string terminada em 0"
.MODEL SMALL
.STACK 100h
.DATA
texto   DB 'Turbo Assembler 2.0', 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  DI, OFFSET texto
        XOR  AL, AL         ; procurar o byte 0
        MOV  CX, 0FFFFh     ; "infinito"
        CLD
        REPNE SCASB         ; para logo depois do 0
        NOT  CX             ; CX = -CX - 1 = bytes examinados
        DEC  CX             ; tira o 0 da conta: CX = 19
        MOV  AX, 4C00h
        INT  21h
END inicio
```

A conta de CX merece atenção. Se a string tem n caracteres, `SCASB` examina n + 1 bytes (incluindo o 0) e CX termina valendo FFFFh − (n + 1). `NOT CX` dá n + 1, e o `DEC` deixa n. Esse truque de três instruções aparece em praticamente todas as implementações de `strlen` da era DOS.

## Comparando strings: REPE CMPSB

`REPE CMPSB` compara byte a byte enquanto forem iguais. Ao terminar:

- **ZF = 1**: todos os CX bytes foram iguais.
- **ZF = 0**: achou uma diferença. SI e DI apontam **um byte depois** dela, e as flags dizem quem é maior (como depois de um `CMP`).

```asm executar titulo="SENHA.ASM: comparando strings"
.MODEL SMALL
.STACK 100h
.DATA
senha   DB 'ZEROCOOL'
digitou DB 'ZEROCOOL'
TAM     EQU 8
certa   DB 'Acesso liberado.$'
errada  DB 'Senha incorreta.$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET senha
        MOV  DI, OFFSET digitou
        MOV  CX, TAM
        CLD
        REPE CMPSB          ; compara enquanto iguais
        MOV  DX, OFFSET errada
        JNE  @@mostra       ; ZF = 0: achou diferença
        MOV  DX, OFFSET certa
@@mostra:
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Mude uma letra de `digitou` e rode de novo.

## Transformando: LODSB + STOSB

`LODSB` e `STOSB` juntos formam um "filtro": lê um byte, trabalha com ele em AL e grava. Com SI e DI apontando para o mesmo lugar, o filtro transforma a string no próprio lugar:

```asm executar titulo="MAIUSC.ASM: convertendo para maiúsculas"
.MODEL SMALL
.STACK 100h
.DATA
frase   DB 'o 8086 tem 29 mil transistores', 13, 10, '$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET frase
        MOV  DI, SI
        CLD
@@laco: LODSB               ; AL = [SI], SI++
        CMP  AL, '$'
        JE   @@fim
        CMP  AL, 'a'
        JB   @@grava
        CMP  AL, 'z'
        JA   @@grava
        SUB  AL, 20h        ; 'a'..'z' -> 'A'..'Z'
@@grava:
        STOSB               ; [DI] = AL, DI++
        JMP  @@laco
@@fim:  MOV  DX, OFFSET frase
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

## Quanto custa: por que REP MOVSW era rei

| Forma | Ciclos por byte (aprox.) |
|-------|--------------------------|
| Laço `MOV AL,[SI]` / `MOV [DI],AL` / `INC SI` / `INC DI` / `LOOP` | 50 |
| `REP MOVSB` (9 + 17 por repetição) | 17 |
| `REP MOVSW` (9 + 17 por repetição, 2 bytes cada) | 8,5 |
| `REP STOSW` (9 + 10 por repetição, 2 bytes cada) | 5 |

O `REP MOVSW` move dois bytes no mesmo tempo que o `REP MOVSB` move um. Por isso as rotinas de cópia da época faziam:

```asm fragmento
        SHR  CX, 1          ; CX = número de words, CF = sobrou 1 byte?
        REP  MOVSW          ; copia as words
        JNC  @@pronto
        MOVSB               ; copia o byte que sobrou
@@pronto:
```

:::anos90 Copiando a tela inteira 70 vezes por segundo
Os jogos em modo 13h (assunto do módulo de gráficos VGA) desenhavam cada quadro em um buffer na memória e depois o copiavam para A000h: 64.000 bytes, ou 32.000 `MOVSW`. Em PCs lentos, essa cópia sozinha consumia boa parte do tempo de cada quadro, e cada ciclo economizado nela virava quadros por segundo a mais.
:::

:::cpu O defeito do REP com prefixo de segmento
O 8086 original tem um defeito famoso: se uma interrupção de hardware chega no meio de um `REP MOVSB` com **dois prefixos** (por exemplo `REP` junto com `ES:` trocando o segmento da origem), ao voltar da interrupção o processador só lembra do último prefixo, e a cópia continua errada ou para no meio. Os manuais recomendavam desligar as interrupções (`CLI`) em volta dessas instruções. O 80286 corrigiu o defeito.
:::

## Exercícios

```exercicio
id: a13-1
titulo: Preenchendo um buffer
nivel: 1
exigir: STOSB|STOSW
proibir: LOOP
--- enunciado
Preencha os 64 bytes de **buffer** com o caractere `'*'` usando uma instrução de string com `REP`. A variável **guarda**, logo depois do buffer, não pode ser alterada.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
buffer  DB 64 DUP(0)
guarda  DB 'X'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "64 asteriscos e guarda intacta", "espera": { "mem": { "buffer": ["*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*","*"], "guarda": "X" } } }]
--- dicas
O destino das instruções de string é ES:DI. Faça ES = DS primeiro.
AL = '*', DI = OFFSET buffer, CX = 64, CLD e REP STOSB.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
buffer  DB 64 DUP(0)
guarda  DB 'X'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  DI, OFFSET buffer
        MOV  AL, '*'
        MOV  CX, 64
        CLD
        REP  STOSB
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a13-2
titulo: Copiar e imprimir
nivel: 1
exigir: MOVSB|MOVSW
proibir: LOOP
--- enunciado
Copie a mensagem de **origem** (14 bytes, incluindo o `$`) para **destino** com uma instrução de string e depois imprima **destino** com `INT 21h`, `AH=09h`.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
origem  DB 'Assembly 8086$'
destino DB 14 DUP('?')
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; copie origem para destino

        MOV  DX, OFFSET destino
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "imprime a cópia", "espera": { "saida": "Assembly 8086", "mem": { "destino": ["A","s","s","e","m","b","l","y"," ","8","0","8","6","$"] } } }]
--- dicas
Sem copiar, o destino ainda tem '?' e o programa imprime lixo até achar um '$'.
SI = OFFSET origem, DI = OFFSET destino, CX = 14, ES = DS, CLD e REP MOVSB.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
origem  DB 'Assembly 8086$'
destino DB 14 DUP('?')
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET origem
        MOV  DI, OFFSET destino
        MOV  CX, 14
        CLD
        REP  MOVSB
        MOV  DX, OFFSET destino
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a13-3
titulo: strlen
nivel: 2
exigir: SCASB
proibir: LOOP
--- enunciado
Calcule o tamanho da string **texto**, terminada pelo byte 0, usando `REPNE SCASB`, e guarde o resultado em **tamanho** (sem contar o 0). O verificador vai testar com textos diferentes.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
texto   DB 'Programando nos anos 90', 0, 40 DUP(0)
tamanho DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "Programando nos anos 90 = 23", "espera": { "mem": { "tamanho": 23 } } },
 { "nome": "MASM = 4", "setup": { "texto": "MASM\u0000" }, "espera": { "mem": { "tamanho": 4 } } },
 { "nome": "string vazia = 0", "setup": { "texto": "\u0000" }, "espera": { "mem": { "tamanho": 0 } } }]
--- dicas
ES = DS, DI = OFFSET texto, AL = 0, CX = 0FFFFh, CLD, REPNE SCASB.
No fim, NOT CX e DEC CX dão o tamanho.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
texto   DB 'Programando nos anos 90', 0, 40 DUP(0)
tamanho DW ?
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  DI, OFFSET texto
        XOR  AL, AL
        MOV  CX, 0FFFFh
        CLD
        REPNE SCASB
        NOT  CX
        DEC  CX
        MOV  tamanho, CX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a13-4
titulo: Conferindo a senha
nivel: 2
exigir: CMPSB|CMPSW
--- enunciado
Compare os 8 bytes de **senha** com os 8 bytes de **tentativa** usando `REPE CMPSB`. Se forem iguais, coloque **1** em **BX**; se forem diferentes, coloque **0**. O verificador vai trocar a tentativa.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
senha     DB 'IDDQD123'
tentativa DB 'IDDQD123'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        ; seu código aqui

        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "senha certa", "espera": { "BX": 1 } },
 { "nome": "última letra diferente", "setup": { "tentativa": "IDDQD124" }, "espera": { "BX": 0 } },
 { "nome": "primeira letra diferente", "setup": { "tentativa": "XDDQD123" }, "espera": { "BX": 0 } },
 { "nome": "minúsculas", "setup": { "tentativa": "iddqd123" }, "espera": { "BX": 0 } }]
--- dicas
ES = DS, SI = OFFSET senha, DI = OFFSET tentativa, CX = 8, CLD, REPE CMPSB.
Depois do REPE CMPSB, JE (ZF = 1) significa que todos os bytes foram iguais.
Cuidado: MOV não altera flags, mas XOR BX,BX altera. Decida BX depois do salto.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
senha     DB 'IDDQD123'
tentativa DB 'IDDQD123'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  ES, AX
        MOV  SI, OFFSET senha
        MOV  DI, OFFSET tentativa
        MOV  CX, 8
        CLD
        REPE CMPSB
        MOV  BX, 0          ; MOV não altera flags
        JNE  @@fim
        MOV  BX, 1
@@fim:  MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Instruções de string: `MOVS`, `STOS`, `LODS`, `SCAS` e `CMPS`, em versões B (byte) e W (word).
- Origem em DS:SI, destino **sempre** em ES:DI. No modelo SMALL, faça ES = DS antes de usar.
- `CLD` faz SI e DI subirem; `STD` faz descerem. Use `STD` para copiar com sobreposição quando o destino vem depois.
- `REP` repete CX vezes (e não faz nada com CX = 0). `REPE` repete enquanto iguais, `REPNE` enquanto diferentes.
- strlen: `REPNE SCASB` com CX = FFFFh, depois `NOT CX` / `DEC CX`. Comparação: `REPE CMPSB` e teste ZF.
- `REP MOVSW` e `REP STOSW` são o jeito mais rápido de mover e preencher memória no 8086.
:::
