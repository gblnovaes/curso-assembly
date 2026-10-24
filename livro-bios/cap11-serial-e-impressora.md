---
id: cap11
numero: 11
parte: 4
titulo: "Comunicação serial e impressora (INT 14H e INT 17H)"
aulas: aula04; aula14; aula29
---

# Capítulo 11 · Comunicação serial e impressora

> **Neste capítulo:** as portas seriais RS-232-C pela `INT 14H` (inicializar, enviar, receber,
> status e as funções estendidas dos PS/2) e a impressora paralela pela `INT 17H`. As duas
> interfaces têm a mesma ideia: um índice em `DX` escolhe a porta, e a BIOS acha o endereço de
> E/S numa tabela da área de dados.
>
> **Antes de ler:** [Aula 4, O registrador de FLAGS](../conteudo/aula04-flags.md) (testar bits
> de status) e [Aula 29](../conteudo/aula29-pit-som.md) (portas de E/S com `IN` e `OUT`).

## 11.1 Portas lógicas e endereços de E/S

O POST procura as placas e grava os endereços-base encontrados na área de dados:

| Área | Conteúdo | Valores típicos |
|---|---|---|
| `40:00` a `40:06` | Endereço-base das linhas RS-232-C 1 a 4 (uma palavra cada) | COM1 = `3F8H`, COM2 = `2F8H` |
| `40:08` a `40:0E` | Endereço-base das impressoras 1 a 3 (e uma quarta posição) | `3BCH`, `378H`, `278H` |
| `40:78` a `40:7B` | *Time-out* das impressoras | |
| `40:7C` a `40:7F` | *Time-out* das linhas RS-232-C | |

Um valor **zero** indica que a porta não existe; é assim que `INT 14H` e `INT 17H` sabem se a
porta pedida é válida. O número de portas também aparece no byte de equipamento
(`INT 11H`, bits 11–9 para seriais e 15–14 para impressoras; [Capítulo 8](cap08-equipamento-e-memoria.md)).

```asm fragmento titulo="Endereço de E/S da COM1"
        PUSH DS
        MOV  AX,0040H
        MOV  DS,AX
        MOV  DX,DS:[0000H]   ; DX = endereço-base da COM1 (0 se não existe)
        POP  DS
        OR   DX,DX
        JZ   sem_com1
```

## 11.2 INT 14H · Comunicação assíncrona (RS-232-C)

`INT 14H` oferece o básico para usar portas seriais: configurar, enviar, receber e consultar
status. Em todas as funções, `DX` escolhe a linha serial (0 a 3), que corresponde ao endereço
guardado a partir de `40:00`.

| AH | Função |
|---|---|
| 00H | Inicializar a porta |
| 01H | Enviar caractere |
| 02H | Receber caractere (espera até chegar) |
| 03H | Ler status |
| 04H | Inicialização estendida (PS/2) |
| 05H | Controle estendido da porta (PS/2) |
| 06H–FFH | Reservadas |

### Retorno de status

Quase todas as funções devolvem em `AH` o **status da linha**:

| Bit | Significado |
|---|---|
| 7 | *Time-out* |
| 6 | Registrador de deslocamento do transmissor vazio |
| 5 | Registrador de retenção do transmissor vazio |
| 4 | *Break* detectado |
| 3 | Erro de enquadramento (*framing*) |
| 2 | Erro de paridade |
| 1 | Erro de *overrun* |
| 0 | Dado pronto |

Se o bit 7 (*time-out*) estiver ligado, **os outros bits não são confiáveis**. A função 03H (e
algumas outras) também devolve em `AL` o **status do modem**, com as linhas de controle. Os
nomes abaixo seguem o registrador de status de modem do 8250, o chip serial do PC; confira os
bits no manual original:

| Bit de AL | Significado |
|---|---|
| 7 | DCD (*data carrier detect*): portadora presente |
| 6 | RI (*ring indicator*): telefone tocando |
| 5 | DSR (*data set ready*): modem ligado |
| 4 | CTS (*clear to send*): pode transmitir |
| 3 a 0 | as mesmas linhas, indicando que **mudaram** desde a última leitura |

### AH = 00H · Inicializar

`AL` empacota os parâmetros:

| Bits de AL | Campo | Valores |
|---|---|---|
| 7–5 | Taxa (baud) | 000 = 110 · 001 = 150 · 010 = 300 · 011 = 600 · 100 = 1200 · 101 = 2400 · 110 = 4800 · 111 = 9600 |
| 4–3 | Paridade | 01 = ímpar · 11 = par · 00 ou 10 = nenhuma |
| 2 | Bits de parada | 0 = 1 bit · 1 = 2 bits |
| 1–0 | Tamanho da palavra | 10 = 7 bits · 11 = 8 bits |

`DX` = linha. Para taxas acima de 9600 em PS/2, use as funções 04H e 05H. Devolve o status em
`AH` e `AL`.

```asm fragmento titulo="COM1 a 9600 bps, 8N1: 111 00 0 11 = 0E3H"
        MOV  AH,00H
        MOV  AL,0E3H
        XOR  DX,DX          ; DX = 0: COM1
        INT  14H
```

Outras combinações comuns: 2400 8N1 = `101 00 0 11` = `0A3H`; 1200 7E1 = `100 11 0 10` = `9AH`.

### AH = 01H · Enviar caractere

`AL` = caractere; `DX` = linha. Retorna o status em `AH` (bit 7 ligado = falhou por *time-out*).

### AH = 02H · Receber caractere

A rotina **espera** o caractere chegar (até o *time-out*). Retorna `AL` = caractere e `AH` =
status da linha.

### AH = 03H · Ler status

Retorna `AH` = status da linha e `AL` = status do modem. Útil para checar "há dado pronto?"
(bit 0 de `AH`) antes de chamar 02H, evitando bloquear o programa.

### AH = 04H · Inicialização estendida (PS/2)

Dá controle individual a cada parâmetro e inclui 19200 bps.

| Registrador | Campo | Valores |
|---|---|---|
| AL | *Break* | 00H = sem break · 01H = break |
| BH | Paridade | 00H nenhuma · 01H ímpar · 02H par · 03H *stick* ímpar · 04H *stick* par |
| BL | Bits de parada | 00H = 1 · 01H = 2 (ou 1,5 se palavra de 5 bits) |
| CH | Palavra | 00H = 5 bits · 01H = 6 · 02H = 7 · 03H = 8 |
| CL | Taxa | 00H = 110 · 01H = 150 · 02H = 300 · 03H = 600 · 04H = 1200 · 05H = 2400 · 06H = 4800 · 07H = 9600 · 08H = 19200 |

Retorna status da linha em `AH` e do modem em `AL`. Em sistemas que não são PS/2, nada é feito.

### AH = 05H · Controle estendido da porta (PS/2)

Lê ou escreve o **registrador de controle do modem**.

- `AL=00H`: lê. `AL=01H`: escreve o valor de `BL`.
- Bits de `BL`: 4 = *loopback*; 3 = OUT2; 2 = OUT1; 1 = RTS (*request to send*); 0 = DTR (*data
  terminal ready*); 7–5 reservados.

Retorna `BL` (registrador), `AL` (status do modem) e `AH` (status da linha). Em sistemas que não
são PS/2, nada é feito.

> **Autoteste sem cabo:** o *loopback* (bit 4) liga a saída do transmissor à entrada do
> receptor dentro do próprio chip. Envie um caractere com 01H e receba-o de volta com 02H.

### Limites da INT 14H

A BIOS faz E/S serial **por espera ativa** (*polling*): não usa a interrupção da placa (IRQ 4
para a COM1, IRQ 3 para a COM2) nem tem buffer de recepção. A 2400 bps ou mais, um programa que
fica ocupado desenhando a tela perde caracteres. Programas de terminal e BBS dos anos 90 por
isso programavam o 8250/16550 diretamente e instalavam o seu próprio tratador de IRQ com um
buffer circular, como o do teclado ([Capítulo 6](cap06-teclado.md)). Essa técnica é um dos
tópicos dos capítulos avançados.

```asm fragmento titulo="Terminal mínimo: o que chega pela COM1 vai para a tela, o teclado vai para a COM1"
laco:   MOV  AH,03H          ; há dado na serial?
        XOR  DX,DX
        INT  14H
        TEST AH,01H
        JZ   teclado
        MOV  AH,02H          ; recebe
        INT  14H
        TEST AH,80H          ; time-out?
        JNZ  teclado
        MOV  AH,0EH          ; mostra (Capítulo 3)
        INT  10H
teclado:
        MOV  AH,01H          ; há tecla? (Capítulo 6)
        INT  16H
        JZ   laco
        MOV  AH,00H
        INT  16H
        CMP  AL,1BH          ; Esc sai
        JE   sair
        MOV  AH,01H          ; envia
        XOR  DX,DX
        INT  14H
        JMP  laco
```

## 11.3 INT 17H · Impressora

| AH | Função |
|---|---|
| 00H | Imprimir o caractere de `AL` |
| 01H | Inicializar a porta |
| 02H | Ler o status |

`DX` = impressora (0, 1 ou 2), índice na tabela de endereços-base em `40:08`. Todas devolvem em
`AH` o **status**:

| Bit | Se = 1 |
|---|---|
| 7 | **Não** ocupada (pronta) |
| 6 | Reconhecimento (*acknowledge*) |
| 5 | Sem papel |
| 4 | Selecionada (*online*) |
| 3 | Erro de E/S |
| 2–1 | Não usados |
| 0 | *Time-out* |

> **Leitura invertida do bit 7:** ele indica **pronta**, não ocupada. Uma impressora pronta e
> ligada costuma devolver `90H` (bits 7 e 4).

### Particularidades por modelo

- AT, XT 286, PC Convertible e PS/2: quando a impressora está ocupada, a BIOS chama
  `INT 15H, AH=90H, AL=FEH` (impressora) para avisar o sistema operacional
  ([Capítulo 16](cap16-multitarefa.md)).
- Se o número da impressora é inválido ou sua porta está zerada, o comportamento varia: em
  alguns modelos nada acontece e `AH` volta inalterado; no PC XT de 10/01/86 em diante,
  `AH=29H`; no PC Convertible, `AH=01H`. Em PS/2 o limite de `DX` é 2; em AT/XT 286 e outros, 3.
- O tempo de espera antes do *time-out* vem dos bytes `40:78` a `40:7B`, um por impressora.

```asm fragmento titulo="Imprimir uma string terminada em 0, parando no primeiro erro"
; DS:SI = string
imprime: LODSB
        OR   AL,AL
        JZ   pronto
        MOV  AH,00H
        XOR  DX,DX          ; LPT1
        INT  17H
        TEST AH,29H         ; time-out (0), erro (3) ou sem papel (5)?
        JZ   imprime
        ; ... tratar o erro ...
pronto:
```

## 11.4 No simulador do curso

Não há portas seriais nem impressora no simulador: `INT 14H` e `INT 17H` não têm serviço. Num
emulador, o DOSBox liga a COM1 a um arquivo ou a uma porta TCP com `serial1=` na configuração, e
redireciona a impressora para arquivos.

## 11.5 Exercícios

1. Escreva um programa que lista as portas seriais e paralelas encontradas pelo POST, lendo
   `40:00` a `40:0E` e imprimindo os endereços em hexadecimal (use `imphex16` do
   [Capítulo 1](cap01-o-que-e-a-bios.md)).
2. Monte o byte de inicialização para 4800 bps, paridade par, 1 bit de parada, 7 bits.
   *(Resposta: `110 11 0 10` = `0DAH`.)*
3. Transforme o terminal mínimo da seção 11.2 em um programa completo, inicializando a COM1 a
   9600 8N1 e mostrando uma mensagem se a porta não existir.
4. Faça uma rotina `IMPRESSORA_OK` que devolve `CF=0` se a LPT1 está pronta, ligada e com papel,
   e `CF=1` caso contrário, com uma mensagem diferente para cada causa.

## Resumo

- `40:00` a `40:06` guardam as portas seriais e `40:08` a `40:0E` as paralelas; zero = ausente.
- `INT 14H`: 00H configura (AL empacotado), 01H envia, 02H recebe (espera), 03H status; 04H e
  05H nos PS/2. Bit 7 de AH = *time-out*.
- A serial da BIOS é por espera ativa, sem buffer: serve para pouco tráfego.
- `INT 17H`: 00H imprime, 01H inicializa, 02H status; bit 7 = pronta, bit 5 = sem papel.
