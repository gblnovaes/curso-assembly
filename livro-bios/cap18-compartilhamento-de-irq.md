---
id: cap18
numero: 18
parte: 6
titulo: "Compartilhamento de interrupções"
aulas: aula15; aula27
---

# Capítulo 18 · Compartilhamento de interrupções

> **Neste capítulo:** o protocolo de software que a IBM definiu para várias placas dividirem a
> mesma linha de interrupção (IRQ): a diferença entre borda e nível, a estrutura de 16 bytes no
> início de cada tratador, como ligar, atender e desligar um tratador da cadeia, e as dicas de
> programação do 8259A.
>
> **Antes de ler:** [Aula 15](../conteudo/aula15-isr.md) (o 8259A, o EOI, IF, CLI e STI) e
> [Aula 27](../conteudo/aula27-tsr.md) (encadear tratadores com `JMP DWORD PTR CS:`).

## 18.1 O problema

Placas de PC têm poucas linhas de interrupção: 8 no PC e no XT (IRQ 0 a 7), 15 utilizáveis no AT
e no PS/2. Várias já estão ocupadas pelo timer, teclado, disquete, seriais e impressora. O
manual define um protocolo para que várias placas dividam a **mesma** linha, tanto no barramento
de E/S do PC quanto no **Micro Channel** do PS/2.

### A diferença de hardware que importa

- **Barramento do PC: sinal sensível à borda.** O pedido de interrupção é a *subida* do sinal; ele
  "se apaga sozinho" depois de reconhecido.
- **Micro Channel: sinal sensível a nível.** O pedido continua ativo enquanto a linha estiver
  ativa, até a placa ser mandada limpá-lo. Por isso o tratador precisa **zerar explicitamente** a
  causa da interrupção (normalmente lendo ou escrevendo uma porta da placa) **antes do EOI**. Se
  não o fizer, o controlador enxerga uma "nova" interrupção logo em seguida e o sistema fica preso
  atendendo a mesma IRQ.

## 18.2 Regras para quem compartilha

- O protocolo vale apenas em **modo real**, e não é garantido em todo sistema operacional.
- Desabilite interrupções (`CLI`) antes de passar o controle ao próximo tratador da cadeia e antes
  de emitir o EOI não específico; as interrupções só voltam com o `IRET`.
- Todo tratador deve ter uma rotina de **reset** que desliga as interrupções da sua placa após a
  energização.
- Dados em memória no formato Intel (*little-endian*).

## 18.3 A cadeia de tratadores

Cada tratador começa com um `JMP SHORT` que salta sobre uma estrutura de **16 bytes**:

| Offset | Campo | Tamanho | Uso |
|---|---|---|---|
| 00H | `JMP SHORT inicio` | 2 bytes | salta para o código do tratador |
| 02H | Ponteiro para frente (FPTR) | 4 bytes | endereço do próximo tratador da cadeia |
| 06H | Assinatura | 2 bytes | `424BH` (aparece como `4BH,42H` na memória) |
| 08H | Flags | 1 byte | `80H` = **FIRST**, este é o primeiro tratador da cadeia |
| 09H | Salto para reset | 2 bytes | `JMP SHORT` até a rotina que desliga a interrupção da placa |
| 0BH | Reservado | 7 bytes | zero |

Os offsets da primeira coluna contam a partir do início do tratador (o próprio `JMP SHORT` de 2
bytes vem antes da estrutura).

```asm fragmento titulo="Cabeçalho de um tratador compartilhável"
trat_irq PROC FAR
        JMP  SHORT inicio_irq
fptr    DD   0                   ; próximo tratador da cadeia
assin   DW   424BH               ; assinatura do protocolo
flags   DB   0                   ; 80H = FIRST
        JMP  SHORT reset_placa   ; usado pelo sistema para desligar a placa
        DB   7 DUP(0)            ; reservado
inicio_irq:
        ; ... ver seção 18.4 ...
trat_irq ENDP
```

### Ligar (instalar) um tratador

O tratador guarda em FPTR o vetor anterior e troca o vetor por si mesmo. Se o vetor anterior
apontava para o tratador padrão do sistema (nenhuma placa compartilhando ainda), o novo marca-se
como FIRST.

### Atender

O tratador lê o registrador de estado da **sua** placa:

- **Foi ela quem interrompeu:** atende, limpa a causa na placa, emite o EOI e faz `IRET`.
- **Não foi:** repassa o controle ao próximo pelo FPTR, com as interrupções desligadas.

```asm fragmento titulo="Corpo do tratador"
inicio_irq:
        STI
        PUSH AX
        PUSH DX
        MOV  DX,PORTA_ESTADO     ; registrador de estado da placa
        IN   AL,DX
        TEST AL,PEDIU_IRQ
        JZ   nao_eh_minha
        ; ... atender a placa e LIMPAR a causa (essencial no Micro Channel) ...
        CLI
        MOV  AL,20H              ; EOI não específico ao 8259A mestre
        OUT  20H,AL
        POP  DX
        POP  AX
        IRET
nao_eh_minha:
        POP  DX
        POP  AX
        CLI
        JMP  DWORD PTR CS:fptr   ; próximo da cadeia
```

### Desligar

Para sair da cadeia, o programa localiza a sua posição percorrendo-a a partir do vetor: segue os
FPTR, conferindo a assinatura `424BH` em cada elo, até achar o tratador que aponta para ele, e
copia o seu FPTR para esse anterior. Se for o primeiro da cadeia (o vetor aponta para ele), devolve
ao vetor o seu FPTR. Se a cadeia estiver corrompida (assinatura ausente), o código precisa de uma
rotina de recuperação.

Para tratadores em **ROM**, o FPTR e o flag FIRST ficam em travas ou portas da placa (a ROM não
pode ser escrita). O flag FIRST só é permitido em IRQ 7 e, mesmo assim, apenas depois que o sistema
operacional foi carregado.

> **Compare com a Aula 27.** Um TSR comum também encadeia o vetor anterior, mas guarda o ponteiro
> num lugar que só ele conhece e por isso não consegue sair da cadeia se outro programa se
> instalou depois. A estrutura de 16 bytes com assinatura é o que torna a cadeia **percorrível**
> por qualquer participante.

## 18.4 Dicas de implementação

- O registrador de máscara de interrupção (IMR) fica na porta **21H** (controlador mestre).
  Habilitar a IRQ `n` é zerar o bit `n` dessa porta (Aula 15).
- Use o EOI **específico** conforme o nível (por exemplo, `67H` para o nível 7) ao falar com o
  8259A: `60H + n` dá fim exatamente à IRQ `n`, mesmo que haja outra em serviço.
- Entre um comando de E/S e o `STI`, insira `JMP SHORT $+2` para dar tempo de recuperação à
  placa-mãe e ao canal. Instruções como `MOV AL,AH` **não** bastam.
- Desabilite as interrupções (`CLI`) antes de reprogramar os controladores (máscara, EOI, palavras
  de inicialização).
- No Micro Channel, a **IRQ 2** foi substituída pela **IRQ 9** (INT 71H), que repassa a interrupção
  ao tratador de IRQ 2 (INT 0AH). Se você compartilha, implemente o compartilhamento na IRQ 2 /
  INT 0AH.

```asm fragmento titulo="Habilitar a IRQ 7 no 8259A, com tempo de recuperação"
        CLI
        IN   AL,21H
        JMP  SHORT $+2           ; tempo de recuperação do barramento
        AND  AL,7FH              ; zera o bit 7: IRQ 7 habilitada
        OUT  21H,AL
        JMP  SHORT $+2
        STI
```

`JMP SHORT $+2` salta para a instrução seguinte: não faz nada, mas esvazia a fila de instruções do
processador e gasta os ciclos necessários entre dois acessos de E/S ao mesmo chip.

## 18.5 No simulador do curso

O simulador tem um 8259A com IMR (porta 21H) e ISR, e as IRQ 0 (timer) e 1 (teclado). Não há outras
placas para compartilhar uma linha, mas a estrutura do tratador e o encadeamento podem ser
estudados enganchando a `INT 08H` com dois tratadores no padrão desta seção, cada um conferindo a
assinatura do outro.

## 18.6 Exercícios

1. Escreva duas rotinas residentes no padrão de 16 bytes, ambas enganchadas na `INT 1CH`, e uma
   terceira rotina que percorre a cadeia a partir do vetor e imprime o endereço de cada elo com
   assinatura `424BH`.
2. Implemente o "desligar" para o caso em que o seu tratador está no meio da cadeia.
3. Por que, no Micro Channel, esquecer de limpar a causa da interrupção trava o sistema, mas no
   barramento do PC muitas vezes "só" se perde uma interrupção?

## Resumo

- Borda (PC) versus nível (Micro Channel): no nível, limpe a causa na placa antes do EOI.
- Cada tratador compartilhável começa com `JMP SHORT` + 16 bytes: FPTR, assinatura `424BH`, flag
  FIRST (80H), salto para reset e 7 bytes reservados.
- Atender: se a placa não pediu, repasse ao FPTR com `CLI`.
- Desligar: percorra a cadeia pelas assinaturas e religue o anterior ao seguinte.
- 8259A: IMR em 21H, EOI específico `60H + n`, `JMP SHORT $+2` entre acessos de E/S.
