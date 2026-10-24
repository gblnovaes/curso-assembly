---
id: cap02
numero: 2
parte: 1
titulo: O mapa de interrupções, as exceções, o NMI e o Print Screen
aulas: aula14; aula15; aula20; aula22; aula31
---

# Capítulo 2 · O mapa de interrupções, as exceções, o NMI e o Print Screen

> **Neste capítulo:** a tabela completa de vetores do PC (Figura 2-1 do manual), as
> interrupções que o próprio processador gera (00H a 04H), a interrupção não mascarável
> (`INT 02H`) e o Print Screen (`INT 05H`).
>
> **Antes de ler:** [Aula 14, Interrupções, IVT, DOS e BIOS](../conteudo/aula14-interrupcoes.md)
> e [Aula 15, Rotinas de interrupção e o timer](../conteudo/aula15-isr.md).

## 2.1 A tabela de vetores

Os primeiros 1024 bytes da memória (`0000:0000` a `0000:03FF`) formam a **tabela de vetores
de interrupção** (IVT): 256 entradas de 4 bytes, cada uma com **offset** (palavra baixa) e
**segmento** (palavra alta) da rotina. O vetor `n` fica em `0000:(n × 4)`.

| Vetor | Endereço na IVT | Vetor | Endereço na IVT |
|---|---|---|---|
| 08H | `0000:0020` | 1CH | `0000:0070` |
| 09H | `0000:0024` | 1DH | `0000:0074` |
| 10H | `0000:0040` | 1EH | `0000:0078` |
| 13H | `0000:004C` | 1FH | `0000:007C` |
| 16H | `0000:0058` | 41H | `0000:0104` |
| 1AH | `0000:0068` | 4AH | `0000:0128` |

### Mapa geral dos vetores (Figura 2-1)

| INT (hex) | Função | Capítulo |
|---|---|---|
| 00 | Divisão por zero | 2 |
| 01 | Passo a passo (*single step*) | 2 |
| 02 | NMI, interrupção não mascarável | 2 |
| 03 | Ponto de parada (*breakpoint*) | 2 |
| 04 | Overflow | 2 |
| 05 | Print Screen | 2 |
| 06–07 | Reservadas | |
| 08 | Temporizador do sistema | [7](cap07-tempo-e-relogios.md) |
| 09 | Teclado | [6](cap06-teclado.md) |
| 0A–0D | Reservadas | |
| 0E | Disquete (IRQ do controlador) | [9](cap09-disquete.md) |
| 0F | Reservada | |
| 10 | Vídeo | [3](cap03-video-modos-e-texto.md), [4](cap04-video-paleta-fontes-strings.md), [5](cap05-video-estado-e-deteccao.md) |
| 11 | Determinação de equipamento | [8](cap08-equipamento-e-memoria.md) |
| 12 | Determinação do tamanho de memória | [8](cap08-equipamento-e-memoria.md) |
| 13 | Disco fixo / disquete | [9](cap09-disquete.md), [10](cap10-disco-fixo.md) |
| 14 | Comunicação assíncrona (serial) | [11](cap11-serial-e-impressora.md) |
| 15 | Serviços do sistema | [13](cap13-int15-servicos.md) a [16](cap16-multitarefa.md) |
| 16 | Teclado | [6](cap06-teclado.md) |
| 17 | Impressora | [11](cap11-serial-e-impressora.md) |
| 18 | BASIC residente (ROM BASIC) | [12](cap12-boot-e-roms.md) |
| 19 | Carregador de inicialização (*bootstrap*) | [12](cap12-boot-e-roms.md) |
| 1A | Relógio do sistema e relógio de tempo real | [7](cap07-tempo-e-relogios.md) |
| 1B | Interrupção de teclado por Ctrl-Break | [6](cap06-teclado.md) |
| 1C | Gancho do usuário a cada tick do temporizador | [7](cap07-tempo-e-relogios.md) |
| 1D | Ponteiro para parâmetros de vídeo | [17](cap17-area-de-dados-da-bios.md) |
| 1E | Ponteiro para parâmetros de disquete | [9](cap09-disquete.md), [17](cap17-area-de-dados-da-bios.md) |
| 1F | Ponteiro para os caracteres gráficos de vídeo | [4](cap04-video-paleta-fontes-strings.md) |
| 20–3F | Reservadas para o DOS | |
| 40 | Redirecionamento da BIOS de disquete | [10](cap10-disco-fixo.md) |
| 41 | Ponteiro de parâmetros do disco fixo (unidade 0) | [10](cap10-disco-fixo.md) |
| 42–45 | Reservadas | |
| 46 | Ponteiro de parâmetros do disco fixo (unidade 1) | [10](cap10-disco-fixo.md) |
| 47–49 | Reservadas | |
| 4A | Alarme do usuário | [7](cap07-tempo-e-relogios.md) |
| 4B–5F | Reservadas | |
| 60–67 | Reservadas para programas do usuário | |
| 68–6F | Reservadas | |
| 70 | Interrupção do relógio de tempo real | [7](cap07-tempo-e-relogios.md) |
| 71–74 | Reservadas | |
| 75 | Redireciona para o NMI (erro do coprocessador) | 2 |
| 76–7F | Reservadas | |
| 80–85 | Reservadas para BASIC | |
| 86–F0 | Usadas pelo interpretador BASIC quando em execução | |
| F1–FF | Reservadas para programas do usuário | |

Observe que alguns vetores (**1D, 1E, 1F, 41, 46**) **não são código**: apontam para
**tabelas de dados**. Nunca execute `INT 1EH`; leia o ponteiro e use a tabela.

> **IRQs e vetores.** No PC, o controlador de interrupções 8259A entrega as linhas IRQ 0 a 7
> nos vetores 08H a 0FH (IRQ 0 = timer, INT 08H; IRQ 1 = teclado, INT 09H; IRQ 6 = disquete,
> INT 0EH). Nos sistemas com segundo controlador (AT e PS/2), as IRQ 8 a 15 chegam nos vetores
> 70H a 77H: IRQ 8 é o relógio de tempo real (INT 70H), IRQ 9 é INT 71H e IRQ 13, a do
> coprocessador, é INT 75H. Os vetores 0AH a 0DH aparecem como "reservados" no mapa da BIOS
> porque a BIOS não os trata; no uso comum eles recebem placas (IRQ 3 e 4 são, por convenção,
> as portas seriais COM2 e COM1). A [Aula 15](../conteudo/aula15-isr.md) explica o 8259A e o
> EOI; o [Capítulo 18](cap18-compartilhamento-de-irq.md) trata do compartilhamento de IRQs.

### Ler e trocar um vetor sem o DOS

O DOS oferece `INT 21H, AH=35H` (ler vetor) e `AH=25H` (gravar vetor), usados nas Aulas 15 e
27. Quando não há DOS (um setor de boot, por exemplo) o acesso é direto à IVT, sempre com as
interrupções desligadas durante a troca:

```asm fragmento titulo="Troca direta do vetor 1CH"
        XOR  AX,AX
        MOV  ES,AX               ; ES = 0000H, segmento da IVT
        CLI                      ; ninguém pode usar o vetor pela metade
        MOV  AX,ES:[1CH*4]       ; offset antigo
        MOV  WORD PTR antigo,AX
        MOV  AX,ES:[1CH*4+2]     ; segmento antigo
        MOV  WORD PTR antigo+2,AX
        MOV  WORD PTR ES:[1CH*4],OFFSET minha_rotina
        MOV  ES:[1CH*4+2],CS
        STI
```

## 2.2 As interrupções do próprio processador (00H a 04H)

Estes cinco vetores são acionados pelo 8086, não pela BIOS. A BIOS (ou o DOS) só instala
tratadores padrão.

| INT | Quem dispara | Quando |
|---|---|---|
| 00H | `DIV`/`IDIV` | divisor zero ou quociente que não cabe no destino |
| 01H | flag TF | depois de cada instrução, se TF = 1 (o modo passo a passo dos depuradores) |
| 02H | pino NMI | erro grave de hardware (seção 2.3) |
| 03H | `INT 3` (opcode de 1 byte, `CCH`) | ponto de parada inserido pelo depurador |
| 04H | `INTO` | se OF = 1 no momento da instrução |

- O caso de `INT 00H` é estudado na [Aula 22](../conteudo/aula22-sinal.md): `IDIV` com
  −32768 / −1 também dispara a exceção, porque +32768 não cabe em 16 bits. No 8086 o endereço
  empilhado é o da instrução **seguinte** ao `DIV`, por isso o tratador não pode simplesmente
  "tentar de novo".
- `INT 01H` e `INT 03H` são as ferramentas do DEBUG.COM e do Turbo Debugger
  ([Aula 20](../conteudo/aula20-depuracao.md)).
- `INTO` é útil depois de `ADD`/`SUB`/`IMUL` com sinal: uma única instrução que só desvia em
  caso de estouro.

## 2.3 INT 02H · Interrupção não mascarável (NMI)

Serve para sinalizar **falhas graves de hardware**. Ela não pode ser desligada por `CLI`
(daí o nome).

**PC, PC XT, AT e PS/2 Model 30.** O tratador mostra:

- `PARITY CHECK 1`: erro de paridade na placa-mãe;
- `PARITY CHECK 2`: erro de paridade no canal de E/S.

Ele tenta localizar o endereço com paridade ruim e exibe o segmento. Se não encontra nada,
mostra `?????`, o que indica um problema intermitente de leitura.

**Demais PS/2 (exceto Model 30).** Em vez dos textos acima aparecem códigos numéricos, e há
duas causas a mais:

| Código | Significado |
|---|---|
| 110 | Falha de memória na placa-mãe |
| 111 | *I/O Channel Check* ativado (memória no canal de E/S) |
| 112 | *Watchdog time-out* |
| 113 | *Time-out* do barramento de DMA |

- **112**: com o *watchdog* habilitado (`INT 15H, AH=C3H`, [Capítulo 13](cap13-int15-servicos.md)),
  se uma interrupção esperada do temporizador (IRQ 0) não chegar, o sistema gera o NMI.
- **113**: se um dispositivo com DMA segura o barramento por mais de **7,8 µs**, o *Central
  Arbitration Control Point* (árbitro do barramento) gera o NMI.

Quando ocorre um NMI nesses sistemas o árbitro é desabilitado implicitamente; o tratador
precisa reabilitá-lo escrevendo **00H na porta 90H**.

**PC Convertible.** O NMI está ligado ao teclado, ao disquete, ao relógio de tempo real e às
interrupções de suspensão do sistema, além do *I/O channel check*.

**PCjr.** O NMI está ligado à interrupção do teclado.

### O NMI e o coprocessador

1. Em máquinas 8088/8086, um erro do coprocessador **8087** aciona diretamente o NMI.
2. Em máquinas 80286/80386, um erro do **80287/80387** aciona a linha **IRQ 13**; o tratador
   de IRQ 13 (vetor 75H) então executa um `INT 02H` por software, para manter compatibilidade
   com programas que esperam um NMI.
3. Um programa que redireciona o vetor do NMI para si (típico de aplicações com
   coprocessador) deve **verificar se o NMI foi mesmo causado pelo coprocessador**; se não
   foi, deve repassar o controle ao tratador original do sistema.

> **Ligação com o curso.** A [Aula 31, O coprocessador 8087](../conteudo/aula31-8087.md)
> mostra as exceções do 8087 (divisão por zero, inválido, estouro) e a palavra de controle,
> que decide quais exceções ficam **mascaradas**. Com todas mascaradas, que é o padrão
> depois de `FINIT`, o 8087 devolve infinito ou NaN e não aciona o NMI. Desmascarar uma
> exceção só faz sentido se você instalou um tratador de NMI que confere a palavra de estado
> do 8087 (`FSTSW`) e repassa o NMI quando a causa é outra.

## 2.4 INT 05H · Print Screen

Imprime o conteúdo da tela na impressora 1. É chamada pelo tratador do teclado quando se
pressiona a tecla Print Screen ([Capítulo 6](cap06-teclado.md)), mas qualquer programa pode
executar `INT 05H`.

- Salva a posição do cursor e a restaura ao terminar.
- Roda com interrupções habilitadas.
- Pedidos feitos enquanto já há uma impressão em andamento são ignorados.
- Um erro de status logo no início da impressão cancela o pedido.
- O estado fica no byte **0050:0000** (escrito `50:00`):

| Valor | Significado |
|---|---|
| 00H | Print Screen não foi chamado, ou terminou com sucesso |
| 01H | Em andamento; novo pedido é ignorado |
| FFH | Erro durante a impressão |

No **PC Convertible**, um erro inicial de status também emite um *beep*, e Ctrl-Break encerra a
impressão. No EGA e nos PS/2, `INT 10H, AH=12H, BL=20H` instala uma rotina alternativa de
Print Screen que entende telas com mais de 25 linhas ([Capítulo 4](cap04-video-paleta-fontes-strings.md)).

```asm fragmento titulo="Print Screen por programa, conferindo o resultado"
        INT  05H
        PUSH DS
        MOV  AX,0050H
        MOV  DS,AX
        MOV  AL,DS:[0000H]       ; 00H = ok, FFH = erro
        POP  DS
        CMP  AL,0FFH
        JE   falhou
```

## 2.5 No simulador do curso

A IVT existe de verdade na memória simulada, e `INT 21H, AH=25H/35H` ou a escrita direta
funcionam. `INT 00H` mostra "Divide overflow" e encerra o programa, como o DOS. `INT 03H`
pausa a execução no depurador. `INT 01H`, `INT 04H` e `INT 05H` não fazem nada. Não há NMI.

## 2.6 Exercícios

1. Calcule onde ficam na IVT os vetores 05H, 4AH e 70H. *(0000:0014, 0000:0128, 0000:01C0.)*
2. Escreva um programa que lê com `INT 21H, AH=35H` os vetores 08H, 09H, 10H e 1CH e os
   imprime no formato `SSSS:OOOO` com `imphex16` do [Capítulo 1](cap01-o-que-e-a-bios.md).
3. Instale um tratador próprio para `INT 00H` que escreve "divisão inválida", restaura o
   vetor original e encerra o programa com código de retorno 1. Teste com `IDIV` de −32768
   por −1, como na [Aula 22](../conteudo/aula22-sinal.md).
4. Por que um tratador de NMI de uma aplicação com 8087 precisa repassar o controle quando o
   NMI não veio do coprocessador? *(Porque erros de paridade e de canal também chegam por ali;
   engolir o NMI esconderia uma falha de memória.)*

## Resumo

- A IVT ocupa `0000:0000` a `0000:03FF`; o vetor `n` está em `0000:n×4`, offset antes do
  segmento.
- Vetores 00H a 04H vêm do processador; 08H a 0FH das IRQ 0 a 7; 70H a 77H das IRQ 8 a 15.
- 1DH, 1EH, 1FH, 41H e 46H apontam para tabelas, não para código.
- O NMI indica falha grave; nos PS/2 os códigos 110 a 113 identificam a causa, e o árbitro é
  reabilitado com 00H na porta 90H.
- Print Screen é `INT 05H`, com estado em `50:00`.
