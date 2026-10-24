---
id: aula20
numero: 20
modulo: 8
titulo: Depuração, caçando bugs
subtitulo: Do DEBUG.COM ao Turbo Debugger, e os erros que todo programador assembly comete
duracao: 80 min
objetivos: aplicar um método para encontrar bugs em vez de chutar; usar passo a passo, passo por cima, pontos de parada e execução até o cursor; reconhecer os sintomas dos erros clássicos de assembly 8086; conhecer o DEBUG.COM e o Turbo Debugger; consertar programas quebrados
---

## Assembly não perdoa

Em Pascal ou C, muitos erros são pegos pelo compilador. Em assembly, o montador só verifica a **forma** das instruções. Se você usar o registrador errado, esquecer um `POP` ou comparar com sinal quando devia ser sem sinal, o programa monta sem reclamar e faz exatamente o que você mandou, que não é o que você queria.

E os sintomas costumam aparecer **longe da causa**: um `PUSH` sem `POP` dentro de um procedimento só explode no `RET`, que salta para um endereço maluco, que executa lixo, que trava a máquina três telas depois. Por isso depurar assembly exige método.

## O método

```diagrama titulo="O ciclo da depuração"
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ 1. reproduzir│────►│ 2. isolar    │────►│ 3. hipótese  │
   │ achar uma    │     │ onde o certo │     │ "acho que é  │
   │ entrada que  │     │ vira errado? │     │ o CX que..." │
   │ sempre falha │     │              │     │              │
   └──────────────┘     └──────────────┘     └──────┬───────┘
          ▲                                         │
          │             ┌──────────────┐            │
          └─────────────│ 4. verificar │◄───────────┘
            não era     │ no depurador │
                        └──────────────┘
```

1. **Reproduza.** Ache uma entrada que sempre causa o erro. Um bug que aparece "às vezes" ainda não foi entendido.
2. **Isole.** Descubra o primeiro ponto em que o estado (registradores, memória, pilha) fica errado. Antes dele está tudo certo, depois está tudo errado. Divida o programa ao meio com pontos de parada e vá estreitando.
3. **Formule uma hipótese** concreta: "o CX chega zerado no LOOP", "o DS não aponta para os dados".
4. **Verifique** no depurador antes de mudar o código. Se a hipótese estava errada, volte ao passo 2.

:::dica Saiba o que esperar antes de olhar
Antes de executar uma instrução passo a passo, diga em voz alta o que ela deve fazer: "AX vai ficar 0123h e ZF vai ligar". Quando o depurador mostrar outra coisa, você achou o bug. Olhar os registradores sem expectativa nenhuma não ensina nada.
:::

## As ferramentas do laboratório

O depurador do laboratório usa as mesmas teclas do *Turbo Debugger* da Borland:

| Tecla | Ação | Quando usar |
|-------|------|-------------|
| **F7** | Passo: executa uma instrução, entrando em `CALL` e `INT` | examinar cada detalhe |
| **F8** | Passo por cima: um `CALL` roda inteiro | pular procedimentos que já funcionam |
| **F4** | Executa até a linha do cursor | chegar rápido a um ponto suspeito |
| **F2** | Liga ou desliga um ponto de parada na linha | parar sempre que passar por ali |
| **F9** | Executa até o fim ou até um ponto de parada | ver o resultado final |
| **Ctrl+F2** | Reinicia o programa | começar de novo |
| **Alt+F5** | Mostra a tela do usuário em tela cheia | ver a saída do programa |

E os painéis:

- **Registradores e flags**: o que mudou na última instrução aparece destacado.
- **Pilha**: o topo da pilha, com SP. Ótimo para conferir `PUSH`/`POP` e endereços de retorno.
- **Variáveis**: os valores das variáveis declaradas, pelo nome.
- **Memória**: um dump em hexadecimal e ASCII de qualquer endereço.
- **Mensagens**: os avisos do simulador. Ele avisa sobre DS apontando para o PSP, `LOOP` com CX = 0, estouro de pilha, `RET` sem `CALL`, execução caindo nos dados e divisão por zero.

:::cpu Pontos de parada no código: INT 3
Você também pode escrever `INT 3` no próprio programa. Quando a execução passa por ali, o depurador para, como em um ponto de parada. Era um truque comum para parar em um lugar que só é alcançado em uma condição rara: `CMP CX,500` / `JNE pula` / `INT 3` / `pula:`. É o primeiro "ponto de parada condicional" da história.
:::

## Como era nos anos 90: DEBUG.COM

Todo PC com DOS tinha o **DEBUG.COM**, um depurador de linha de comando minimalista. Sem janelas, sem mouse, sem nomes de variáveis: só endereços e hexadecimal.

```diagrama titulo="Uma sessão no DEBUG.COM"
  C:\>DEBUG SOMA.COM
  -R
  AX=0000  BX=0000  CX=000A  DX=0000  SP=FFFE  BP=0000  SI=0000  DI=0000
  DS=0B3C  ES=0B3C  SS=0B3C  CS=0B3C  IP=0100   NV UP EI PL NZ NA PO NC
  0B3C:0100 B80500        MOV     AX,0005
  -T
  AX=0005  BX=0000  ...
  0B3C:0103 050300        ADD     AX,0003
  -U 100 L 6
  0B3C:0100 B80500        MOV     AX,0005
  0B3C:0103 050300        ADD     AX,0003
  -D 200 L 10
  0B3C:0200  48 65 6C 6C 6F 24 00 00-00 00 00 00 00 00 00 00   Hello$..........
  -Q
```

| Comando | Ação |
|---------|------|
| `R` | mostra (ou altera) os registradores |
| `T` | executa uma instrução (*trace*) |
| `P` | executa passando por cima de CALL e INT (*proceed*) |
| `G endereço` | executa até o endereço (*go*) |
| `U` | desmonta código (*unassemble*) |
| `D` | mostra memória (*dump*) |
| `E` | edita bytes da memória (*enter*) |
| `A` | monta instruções direto na memória (*assemble*) |

As flags aparecem como pares de letras: `NV`/`OV` (OF), `UP`/`DN` (DF), `EI`/`DI` (IF), `PL`/`NG` (SF), `NZ`/`ZR` (ZF), `NA`/`AC` (AF), `PO`/`PE` (PF), `NC`/`CY` (CF).

:::anos90 Turbo Debugger, CodeView e SoftICE
Em 1989 a Borland lançou o **Turbo Debugger**, com janelas em modo texto, painéis de registradores, pilha e memória, e as teclas que usamos aqui. A Microsoft respondeu com o **CodeView**. E para os casos impossíveis havia o **SoftICE**, da NuMega, que ficava residente "por baixo" do sistema e podia congelar qualquer coisa, inclusive o próprio DOS e o Windows, com um Ctrl+D. O SoftICE virou a ferramenta lendária de quem estudava proteções de software.
:::

```quiz
? Qual a diferença entre F7 e F8 no depurador?
+ F7 entra nos CALL e INT; F8 executa o CALL inteiro como se fosse uma instrução
- F7 executa até o fim; F8 executa uma instrução
- Nenhuma
> Use F8 para pular procedimentos que você já confia e F7 para investigar um procedimento por dentro.

? Um programa trava no RET de um procedimento. Qual a causa mais provável?
- O procedimento não foi declarado com PROC
+ A pilha está desequilibrada: algum PUSH ficou sem POP (ou o contrário)
- Falta MOV AX,4C00h
> O RET desempilha o que estiver no topo. Se sobrou um valor empilhado, ele vira o "endereço de retorno".

? O que significa ZR na linha de flags do DEBUG.COM?
- Que o registrador está zerado
+ Que ZF = 1
- Que houve erro
> Cada flag aparece como um par: NZ/ZR para ZF, NC/CY para CF, e assim por diante.

? Qual o primeiro passo do método de depuração?
+ Reproduzir: achar uma entrada que sempre causa o erro
- Reescrever o procedimento suspeito
- Adicionar NOPs para mudar o tempo
> Sem reproduzir, você não sabe se o conserto funcionou.

? Para que serve escrever INT 3 no código?
- Para terminar o programa
+ Para parar no depurador quando a execução passar por ali, como um ponto de parada
- Para chamar o DOS
> INT 3 é a instrução de breakpoint. Combinada com um CMP e um salto, vira um ponto de parada condicional.
```

## O catálogo dos erros clássicos

Estes são os bugs que todo programador assembly cometeu dezenas de vezes. Aprenda os sintomas e você vai reconhecê-los na hora.

| Sintoma | Causa provável |
|---------|----------------|
| Imprime lixo em vez da mensagem | **DS não inicializado**: faltou `MOV AX,@DATA` / `MOV DS,AX`. Ou a string não termina com `$`. |
| Comparações erram só com números "grandes" ou negativos | **Salto com sinal trocado por sem sinal**: `JA` em vez de `JG`, ou vice-versa. |
| Trava ou salta para o nada no `RET` | **Pilha desequilibrada**: `PUSH` sem `POP`, ou `POP` a mais. |
| Um laço roda "para sempre" (65.536 vezes) | **`LOOP` com CX = 0**. Proteja com `JCXZ`. |
| "Divide overflow" | **DX não zerado antes do `DIV`** de 16 bits, ou divisor zero. |
| Um valor muda "sozinho" depois de um `CALL` ou `INT` | **Registrador destruído**: `MUL` muda DX, `INT 21h` com `AH=02h` devolve AL = DL, o procedimento não preservou. |
| O laço processa um elemento a mais ou a menos | **Erro de um** (*off-by-one*): `JBE` em vez de `JB`, contador começando em 0 ou 1. |
| Cópias andam para trás e destroem a memória | **DF = 1** esquecido de uma rotina anterior. Use `CLD`. |
| Lê ou grava o dobro do esperado | **Tamanho errado**: variável `DB` acessada como word, ou `WORD PTR` onde devia ser `BYTE PTR`. |

### Um exemplo completo

Veja este programa. Ele deveria imprimir a média de três notas, 7, 8 e 9, ou seja, **8**:

```asm executar titulo="MEDIA.ASM: tem um bug aqui"
.MODEL SMALL
.STACK 100h
.DATA
notas   DB 7, 8, 9
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET notas
        MOV  CX, 3
        XOR  AX, AX
@@soma: ADD  AX, [SI]       ; soma as notas
        INC  SI
        LOOP @@soma
        MOV  BL, 3
        DIV  BL             ; AL = média
        MOV  DL, AL
        ADD  DL, '0'
        MOV  AH, 02h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

Rode no laboratório. Em vez de 8, aparece **Divide overflow**! Siga o método:

1. **Reproduzir**: sempre falha com estes dados. Ótimo.
2. **Isolar**: coloque um ponto de parada (F2) no `MOV BL,3` e rode (F9). AX deveria ser 24 (7 + 8 + 9). Não é: AX vale um número enorme, e dividido por 3 o quociente não cabe em AL, daí o "Divide overflow". O erro está no laço.
3. **Hipótese**: avance com F7 dentro do laço. Na primeira volta, AX vira 0807h em vez de 7. `ADD AX,[SI]` está lendo **uma word**, dois bytes: a nota 7 e a nota 8 juntas!
4. **Verificar e consertar**: `notas` é `DB`, mas `AX` é de 16 bits. O certo é somar bytes em AL e propagar o vai-um em AH: `ADD AL,[SI]` / `ADC AH,0`.

Esse é o bug do tamanho errado, e ele é traiçoeiro porque o montador aceita `ADD AX,[SI]` sem reclamar: `[SI]` não tem tamanho, então ele usa o tamanho de AX.

## Exercícios: conserte os programas

Cada programa abaixo tem **um** bug clássico. Use o laboratório (botão **Depurar no laboratório**) para encontrá-lo e conserte com a menor mudança possível.

```exercicio
id: a20-1
titulo: A mensagem que virou lixo
nivel: 1
--- enunciado
Este programa deveria imprimir **Ola, mundo!**, mas imprime lixo. Conserte.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
msg     DB 'Ola, mundo!$'
.CODE
inicio: MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "imprime a mensagem", "espera": { "saida": "Ola, mundo!" } }]
--- dicas
Veja a aba Mensagens do laboratório depois de rodar.
Em um programa .EXE, para onde DS aponta no começo?
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
msg     DB 'Ola, mundo!$'
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  DX, OFFSET msg
        MOV  AH, 09h
        INT  21h
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a20-2
titulo: A temperatura mais alta
nivel: 2
--- enunciado
O programa procura a **maior temperatura** do vetor e guarda em **maior**. As temperaturas podem ser **negativas**. Com estes dados a resposta deveria ser **3**, mas o programa responde −1. Conserte.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
temps   DW -5, -20, 3, -1, -12
maior   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET temps
        MOV  CX, 4
        MOV  AX, [SI]
@@laco: ADD  SI, 2
        CMP  [SI], AX
        JBE  @@nao
        MOV  AX, [SI]
@@nao:  LOOP @@laco
        MOV  maior, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "maior = 3", "espera": { "mem": { "maior": 3 } } },
 { "nome": "todas negativas", "setup": { "temps": [-30, -7, -15, -8, -40] }, "espera": { "mem": { "maior": -7 } } },
 { "nome": "todas positivas", "setup": { "temps": [10, 35, 2, 34, 0] }, "espera": { "mem": { "maior": 35 } } }]
--- dicas
Como −1 fica em hexadecimal? E como JBE compara?
JA/JB/JAE/JBE são para números sem sinal. Para números com sinal: JG/JL/JGE/JLE.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
temps   DW -5, -20, 3, -1, -12
maior   DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET temps
        MOV  CX, 4
        MOV  AX, [SI]
@@laco: ADD  SI, 2
        CMP  [SI], AX
        JLE  @@nao          ; com sinal!
        MOV  AX, [SI]
@@nao:  LOOP @@laco
        MOV  maior, AX
        MOV  AX, 4C00h
        INT  21h
END inicio
```

```exercicio
id: a20-3
titulo: O retorno perdido
nivel: 2
--- enunciado
O procedimento **DOBRA_SOMA** deveria devolver em AX o dobro de BX mais CX, preservando BX e CX. Mas o programa se perde ao voltar do procedimento. Conserte.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  BX, 10
        MOV  CX, 5
        CALL DOBRA_SOMA     ; AX = 2*10 + 5 = 25
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

DOBRA_SOMA PROC
        PUSH BX
        PUSH CX
        SHL  BX, 1
        ADD  BX, CX
        MOV  AX, BX
        POP  CX
        RET
DOBRA_SOMA ENDP
END inicio
--- testes
[{ "nome": "DX = 25, BX e CX preservados", "espera": { "DX": 25, "BX": 10, "CX": 5, "pilhaEquilibrada": true } }]
--- dicas
Execute com F7 e observe o painel da pilha logo antes do RET. O que está no topo?
Cada PUSH precisa de um POP, em ordem inversa.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  BX, 10
        MOV  CX, 5
        CALL DOBRA_SOMA
        MOV  DX, AX
        MOV  AX, 4C00h
        INT  21h

DOBRA_SOMA PROC
        PUSH BX
        PUSH CX
        SHL  BX, 1
        ADD  BX, CX
        MOV  AX, BX
        POP  CX
        POP  BX
        RET
DOBRA_SOMA ENDP
END inicio
```

```exercicio
id: a20-4
titulo: O vetor vazio
nivel: 2
proibir: DEC
--- enunciado
**SOMA_VETOR** soma as **n** words de um vetor (n está na variável **n**). Funciona para n ≥ 1, mas com **n = 0** a soma deveria ser 0 e o programa devolve um valor absurdo. Conserte sem trocar o `LOOP` por outra forma de laço.
--- inicial
.MODEL SMALL
.STACK 100h
.DATA
n       DW 3
vetor   DW 100, 200, 300, 400
soma    DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET vetor
        MOV  CX, n
        CALL SOMA_VETOR
        MOV  soma, AX
        MOV  AX, 4C00h
        INT  21h

; SOMA_VETOR: SI = vetor, CX = n -> AX = soma
SOMA_VETOR PROC
        XOR  AX, AX
@@laco: ADD  AX, [SI]
        ADD  SI, 2
        LOOP @@laco
        RET
SOMA_VETOR ENDP
END inicio
--- testes
[{ "nome": "n = 3", "espera": { "mem": { "soma": 600 } } },
 { "nome": "n = 4", "setup": { "n": 4 }, "espera": { "mem": { "soma": 1000 } } },
 { "nome": "n = 0", "setup": { "n": 0 }, "espera": { "mem": { "soma": 0 } } }]
--- dicas
O que LOOP faz quando CX = 0? Veja a aba Mensagens.
Existe um salto feito exatamente para isso: salta se CX = 0.
--- solucao
.MODEL SMALL
.STACK 100h
.DATA
n       DW 3
vetor   DW 100, 200, 300, 400
soma    DW 0
.CODE
inicio: MOV  AX, @DATA
        MOV  DS, AX
        MOV  SI, OFFSET vetor
        MOV  CX, n
        CALL SOMA_VETOR
        MOV  soma, AX
        MOV  AX, 4C00h
        INT  21h

SOMA_VETOR PROC
        XOR  AX, AX
        JCXZ @@fim          ; vetor vazio
@@laco: ADD  AX, [SI]
        ADD  SI, 2
        LOOP @@laco
@@fim:  RET
SOMA_VETOR ENDP
END inicio
```

```exercicio
id: a20-5
titulo: Os asteriscos sumidos
nivel: 2
--- enunciado
O programa lê um dígito **n** (de 1 a 9) e deveria imprimir um `:` seguido de **n** asteriscos. Com a tecla **3**, deveria mostrar `:***`, mas imprime asteriscos demais. Conserte.
--- inicial
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AH, 08h        ; lê o dígito
        INT  21h
        MOV  DL, ':'
        MOV  AH, 02h
        INT  21h
        SUB  AL, '0'        ; AL = n
        MOV  CL, AL
        XOR  CH, CH
        MOV  DL, '*'
@@laco: INT  21h
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
--- testes
[{ "nome": "3 -> :***", "entrada": "3", "espera": { "saida": ":***" } },
 { "nome": "1 -> :*", "entrada": "1", "espera": { "saida": ":*" } },
 { "nome": "5 -> :*****", "entrada": "5", "espera": { "saida": ":*****" } }]
--- dicas
Execute passo a passo e olhe AL logo depois do INT 21h que imprime o ':'.
A função 02h do DOS devolve em AL o caractere impresso. Guarde o dígito antes, em outro registrador.
--- solucao
.MODEL SMALL
.STACK 100h
.CODE
inicio: MOV  AH, 08h
        INT  21h
        SUB  AL, '0'
        MOV  CL, AL         ; guarda n antes de chamar o DOS de novo
        XOR  CH, CH
        MOV  DL, ':'
        MOV  AH, 02h
        INT  21h
        MOV  DL, '*'
@@laco: INT  21h
        LOOP @@laco
        MOV  AX, 4C00h
        INT  21h
END inicio
```

:::resumo
- Depure com método: reproduzir, isolar, formular hipótese, verificar. Saiba o que esperar antes de executar cada passo.
- F7 entra nos procedimentos, F8 passa por cima, F4 vai até o cursor, F2 marca pontos de parada, F9 executa. `INT 3` no código também para o depurador.
- Erros clássicos: DS não inicializado, JA/JG trocados, pilha desequilibrada, `LOOP` com CX = 0, DX sujo no `DIV`, registradores destruídos por `MUL` e pelo DOS, tamanho de operando errado.
- O montador só confere a forma. A lógica é com você e com o depurador.
:::
