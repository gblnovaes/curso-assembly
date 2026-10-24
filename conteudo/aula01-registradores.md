---
id: aula01
numero: 1
modulo: 1
titulo: Os registradores do 8086
subtitulo: As 14 "variáveis" de 16 bits que moram dentro da CPU
duracao: 50 min
objetivos: conhecer os 14 registradores do 8086 e a função de cada um; entender como AX se divide em AH e AL; usar MOV para colocar valores em registradores; ler os registradores no depurador
---

## Por que registradores?

A memória do PC guarda 1 MB, mas buscar um valor lá é lento: o 8086 precisa colocar o endereço no barramento, esperar a memória responder e trazer os bytes. Dentro da CPU existem alguns poucos lugares de armazenamento que respondem **imediatamente**: os **registradores**.

Programar em Assembly é, em grande parte, decidir **o que fica em qual registrador**. Quanto mais trabalho você fizer nos registradores e menos na memória, mais rápido o programa.

O 8086 tem **14 registradores de 16 bits**:

```diagrama titulo="O conjunto de registradores do 8086"
  REGISTRADORES GERAIS (16 bits, divisíveis em 8 + 8)
  ┌──────────┬──────────┐
  │    AH    │    AL    │  AX  acumulador      (contas, E/S, retorno de funções)
  ├──────────┼──────────┤
  │    BH    │    BL    │  BX  base            (aponta para dados na memória)
  ├──────────┼──────────┤
  │    CH    │    CL    │  CX  contador        (laços, LOOP, deslocamentos)
  ├──────────┼──────────┤
  │    DH    │    DL    │  DX  dados           (MUL/DIV, portas de E/S)
  └──────────┴──────────┘
  PONTEIROS E ÍNDICES (16 bits, NÃO divisíveis)
  ┌─────────────────────┐
  │         SI          │  índice de origem    (source index)
  │         DI          │  índice de destino   (destination index)
  │         BP          │  ponteiro de base    (parâmetros na pilha)
  │         SP          │  ponteiro de pilha   (topo da pilha)
  └─────────────────────┘
  SEGMENTOS (16 bits)                CONTROLE (16 bits)
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   ┌──────┐ ┌──────────┐
  │  CS  │ │  DS  │ │  SS  │ │  ES  │   │  IP  │ │  FLAGS   │
  └──────┘ └──────┘ └──────┘ └──────┘   └──────┘ └──────────┘
   código   dados    pilha    extra      próxima   estado da
                                         instrução última conta
```

## Os quatro registradores gerais

**AX, BX, CX e DX** são os "registradores de trabalho". Qualquer um deles serve para guardar números e fazer contas, mas cada um tem uma especialidade, e algumas instruções **só** funcionam com um deles:

| Registrador | Nome | Especialidade | Exemplos de uso obrigatório |
|-------------|------|---------------|-----------------------------|
| **AX** | Acumulador | resultado de contas, E/S | `MUL`, `DIV`, `IN`, `OUT`, `CBW`; função do DOS em AH |
| **BX** | Base | endereço de dados | `[BX]` aponta para a memória; `XLAT` |
| **CX** | Contador | repetições | `LOOP` usa CX; `SHL AX,CL` usa CL; `REP` usa CX |
| **DX** | Dados | extensão do AX | metade alta em `MUL`/`DIV` de 16 bits; porta em `IN AL,DX` |

:::anos90 Herança do 8080
Os nomes vêm do Intel 8080 (1974), um processador de 8 bits com registradores A, B, C, D, E, H e L. A Intel projetou o 8086 para que programas do 8080 pudessem ser convertidos quase automaticamente: o A virou AL, o par HL virou BX. Por isso as especialidades parecem um pouco arbitrárias.
:::

### A parte alta e a parte baixa

Cada registrador geral pode ser usado inteiro (16 bits) ou em duas metades de 8 bits:

- **AX** = **AH** (alta, *high*: bits 15 a 8) + **AL** (baixa, *low*: bits 7 a 0)
- **BX** = BH + BL, **CX** = CH + CL, **DX** = DH + DL

As metades **não são cópias**: elas **são** o registrador. Mudar AL muda AX, e mudar AX muda AL e AH:

```asm executar titulo="As metades de AX"
        MOV  AX, 1234h   ; AX = 1234h  -> AH = 12h, AL = 34h
        MOV  AL, 0FFh    ; muda só a parte baixa: AX = 12FFh
        MOV  AH, 0       ; muda só a parte alta:  AX = 00FFh
        MOV  BL, AL      ; copia 8 bits:          BL = FFh
        MOV  BH, 1       ;                         BX = 01FFh
```

Execute passo a passo e observe AX e BX. Depois experimente o simulador abaixo:

```widget registrador
```

:::atencao Não existe metade de SI, DI, BP e SP
`SL`, `SH`, `DIL` e parecidos **não existem** no 8086. Só AX, BX, CX e DX se dividem. Se você precisar do byte baixo de SI, copie SI para um registrador geral primeiro.
:::

## Ponteiros e índices

**SI** e **DI** são usados principalmente para percorrer a memória: em vetores e nas instruções de string, SI aponta para a origem e DI para o destino. Também servem para guardar números e fazer contas, como os registradores gerais.

**BP** e **SP** trabalham com a **pilha**, uma área de memória que você vai estudar no Módulo 4:

- **SP** (*stack pointer*) aponta sempre para o topo da pilha. Você quase nunca o altera diretamente.
- **BP** (*base pointer*) é usado para acessar parâmetros e variáveis locais de procedimentos.

## Registradores de segmento

O 8086 enxerga 1 MB de memória, mas um registrador de 16 bits só conta até 65.535 (64 KB). A solução da Intel foi dividir a memória em **segmentos**. Os registradores **CS**, **DS**, **SS** e **ES** dizem onde começa cada segmento em uso:

| Registrador | Segmento | Usado para |
|-------------|----------|------------|
| **CS** | código | buscar as instruções |
| **DS** | dados | ler e gravar variáveis |
| **SS** | pilha | PUSH, POP, CALL, RET |
| **ES** | extra | destino das instruções de string, acesso a outra área |

É por isso que o programa da aula anterior começava com `MOV AX,@DATA` e `MOV DS,AX`: era preciso apontar DS para o segmento de dados do programa. O Módulo 5 explica segmentos em detalhes.

## IP e FLAGS

**IP** (*instruction pointer*) guarda o endereço (dentro de CS) da **próxima** instrução a executar. Você não escreve em IP diretamente: ele muda sozinho a cada instrução e com saltos (`JMP`), chamadas (`CALL`) e retornos (`RET`). No depurador, a linha destacada é a instrução em CS:IP.

**FLAGS** é um registrador em que cada bit é um sinalizador: se o último resultado deu zero, se foi negativo, se estourou. As flags são o assunto do Módulo 2.

## MOV: colocando valores em registradores

A instrução mais usada de todo programa Assembly é `MOV`:

```asm fragmento
        MOV  destino, origem    ; destino = origem
```

Apesar do nome (*move*, mover), `MOV` **copia**: a origem continua igual. Nesta aula vamos usar só duas formas:

| Forma | Exemplo | Efeito |
|-------|---------|--------|
| registrador, imediato | `MOV CX, 10` | CX passa a valer 10 |
| registrador, registrador | `MOV BX, CX` | BX recebe uma cópia de CX |

Um **imediato** é um valor escrito direto na instrução, como `10`, `0FFh` ou `'A'`.

Os dois operandos precisam ter o **mesmo tamanho**. `MOV AX, BL` é um erro: AX tem 16 bits e BL tem 8. O montador recusa a instrução, porque não sabe se você quer zerar AH, repetir o sinal, ou outra coisa.

```asm executar titulo="Copiando entre registradores"
        MOV  AX, 100     ; imediato decimal
        MOV  BX, AX      ; BX = 100, AX continua 100
        MOV  CL, 'A'     ; CL = 41h (código ASCII de A)
        MOV  CH, CL      ; CH = 41h  -> CX = 4141h
        MOV  DX, 0B800h  ; DX = B800h
        MOV  SI, DX      ; SI = B800h
```

:::cpu Código de máquina
Abra este código no **Laboratório** e escolha a aba **Listagem**. Você vai ver os bytes que o montador gerou: `MOV AX,100` vira `B8 64 00`. O `B8` significa "MOV para AX com imediato de 16 bits", e `64 00` é o número 100 (64h) em little-endian. `MOV BX,AX` vira só dois bytes: `89 C3`.
:::

## Os registradores no depurador

No laboratório, a janela **Registradores** mostra cada registrador em hexadecimal, em decimal sem sinal e em decimal com sinal, além das metades H e L. Os registradores que mudaram na última instrução ficam **destacados**. Acostume-se a olhar para essa janela depois de cada passo: é assim que se programa em Assembly.

```quiz
? Se AX = 1234h, quanto vale AL?
- 12h
+ 34h
- 1234h
> AL é a parte baixa (bits 7 a 0), os dois últimos dígitos hexadecimais: 34h. AH vale 12h.

? Depois de MOV AX,0ABCDh e MOV AH,0, quanto vale AX?
- 0ABCDh
- 0AB00h
+ 00CDh
> MOV AH,0 zera só a parte alta. A parte baixa, CDh, continua lá.

? Qual instrução é INVÁLIDA no 8086?
- MOV DL, BH
+ MOV AX, CL
- MOV SI, AX
> AX tem 16 bits e CL tem 8. Os operandos de MOV precisam ter o mesmo tamanho.

? Qual registrador guarda o endereço da próxima instrução?
- SP
- CS
+ IP
> IP (instruction pointer) aponta, dentro do segmento de código CS, para a próxima instrução.

? Qual destes registradores pode ser dividido em duas metades de 8 bits?
+ DX
- SI
- BP
> Só AX, BX, CX e DX têm metades de 8 bits.
```

## Exercícios

```exercicio
id: a01-1
titulo: Monte AX por partes
nivel: 1
--- enunciado
Faça **AX** valer **0BEEFh** usando apenas instruções `MOV` de **8 bits** (com AH e AL). Não vale `MOV AX,...`.
--- inicial
        MOV  AH, 0
        MOV  AL, 0
--- testes
[{ "nome": "AX = BEEFh", "espera": { "AX": 48879 } }]
--- dicas
A parte alta de BEEFh é BEh e a parte baixa é EFh.
Lembre do zero na frente de números hexa que começam com letra.
--- solucao
        MOV  AH, 0BEh
        MOV  AL, 0EFh
```

```exercicio
id: a01-2
titulo: Separe as metades
nivel: 2
--- enunciado
No início do programa, **AX** já tem um valor qualquer. Copie a **parte alta** de AX para **BL** e a **parte baixa** de AX para **CL**, e depois zere **BH** e **CH**. No final, BX deve ter o valor de AH e CX o valor de AL, e AX não pode mudar.

O verificador testa com vários valores de AX.
--- inicial
; AX já chega com um valor
        MOV  BL, 0
        MOV  CL, 0
--- testes
[
 { "nome": "AX = 1234h", "setup": { "AX": 4660 }, "espera": { "BX": 18, "CX": 52, "AX": 4660 } },
 { "nome": "AX = FF01h", "setup": { "AX": 65281 }, "espera": { "BX": 255, "CX": 1, "AX": 65281 } },
 { "nome": "AX = 00A0h com lixo em BX e CX", "setup": { "AX": 160, "BX": 43690, "CX": 21845 }, "espera": { "BX": 0, "CX": 160, "AX": 160 } }
]
--- dicas
MOV BL,AH copia a parte alta.
Se BH e CH já tiverem lixo, você precisa zerá-los com MOV BH,0 e MOV CH,0.
--- solucao
        MOV  BL, AH
        MOV  BH, 0
        MOV  CL, AL
        MOV  CH, 0
```

```exercicio
id: a01-3
titulo: Iniciais em CX e DX
nivel: 1
--- enunciado
Coloque o código ASCII da letra **'P'** em **CH**, de **'C'** em **CL**, de **'8'** em **DH** e de **'6'** em **DL**. Use caracteres entre aspas, não números.
--- inicial
        MOV  CH, 0
--- testes
[{ "nome": "CX = 'PC' e DX = '86'", "espera": { "CX": 20547, "DX": 14390 } }]
--- dicas
O montador entende 'P' como o número 50h. Escreva MOV CH,'P'.
--- solucao
        MOV  CH, 'P'
        MOV  CL, 'C'
        MOV  DH, '8'
        MOV  DL, '6'
```

:::resumo
- 14 registradores de 16 bits: gerais (AX, BX, CX, DX), ponteiros e índices (SI, DI, BP, SP), segmentos (CS, DS, SS, ES), IP e FLAGS.
- Só AX, BX, CX e DX se dividem em H e L. As metades fazem parte do registrador.
- `MOV destino, origem` copia; os dois operandos têm o mesmo tamanho.
- Cada registrador geral tem uma especialidade: AX contas, BX endereços, CX contagens, DX extensão do AX e portas.
:::
