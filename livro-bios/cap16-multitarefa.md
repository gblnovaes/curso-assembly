---
id: cap16
numero: 16
parte: 5
titulo: "Multitarefa: os avisos de espera e de conclusão (INT 15H, AH=90H e 91H)"
aulas: aula15; aula27
---

# Capítulo 16 · Multitarefa: os avisos de espera e de conclusão

> **Neste capítulo:** como a BIOS, que não é reentrante e foi escrita para um usuário e uma
> tarefa, colabora com um sistema multitarefa: o aviso "dispositivo ocupado" antes de cada
> espera (`AH=90H`), o aviso "interrupção completa" quando a espera termina (`AH=91H`), os
> códigos de tipo e as três classes de dispositivo, e o esqueleto de um despachante.
>
> **Antes de ler:** [Aula 15](../conteudo/aula15-isr.md) (interrupções e reentrância) e
> [Aula 27, Programas residentes (TSR)](../conteudo/aula27-tsr.md), seção "Um sistema de uma
> tarefa só".

## 16.1 O problema: a BIOS espera girando

Quando a BIOS lê um setor de disquete, ela manda o comando ao controlador e fica num laço até a
interrupção do disquete chegar. Quando um programa chama `INT 16H, AH=00H` sem tecla no buffer,
ela fica num laço até alguém digitar. Num sistema de uma tarefa só, isso não incomoda ninguém.
Num sistema multitarefa, é tempo de CPU jogado fora: outra tarefa poderia rodar enquanto o motor
do disquete acelera.

A solução da IBM: antes de cada laço de espera, a BIOS **avisa** chamando a `INT 15H`. Sozinha,
a BIOS não faz nada com o aviso (devolve `CF=0` e segue esperando). Mas um sistema operacional
multitarefa que **intercepte** a `INT 15H` pode usar o aviso para trocar de tarefa.

```
  tarefa A: INT 13H (ler setor)
              └─ BIOS: manda o comando ao controlador
                 └─ INT 15H, AX=9001H  "disquete ocupado"  ──► despachante: salva A,
                                                                roda a tarefa B ...
  ... IRQ 6 chega: tratador do disquete
                 └─ INT 15H, AX=9101H  "interrupção completa" ──► despachante: marca A
                                                                   como pronta
  ... mais tarde o despachante volta para A, que sai do laço e termina a leitura
```

## 16.2 AH = 90H e AH = 91H

- **AH = 90H, "dispositivo ocupado" (*wait*)**: chamado **antes de esperar** um dispositivo.
- **AH = 91H, "interrupção completa" (*post*)**: chamado **depois que o evento ocorreu**,
  normalmente de dentro do tratador de interrupção do dispositivo.

`AL` é o **código de tipo**. As faixas:

| Faixa | Natureza |
|---|---|
| 00H–7FH | Dispositivos **reutilizáveis em série**: o SO deve serializar o acesso (uma tarefa por vez) |
| 80H–BFH | Dispositivos **reentrantes**: `ES:BX` distingue chamadas simultâneas |
| C0H–FFH | **Somente espera**, com *time-out*; não há função complementar de aviso (91H) |

Tipos definidos:

| AL | Dispositivo | Time-out? |
|---|---|---|
| 00H | Disco | sim |
| 01H | Disquete | sim |
| 02H | Teclado | não |
| 03H | Dispositivo apontador | sim |
| 80H | Rede (`ES:BX` = NCB) | não |
| FCH | Reset do disco fixo (somente PS/2) | sim |
| FDH | Motor do disquete | sim |
| FEH | Impressora | sim |

Na 90H, o retorno diz ao laço da BIOS o que fazer: **`CF=0`** significa "a espera não foi
satisfeita" (o dispositivo ainda precisa de tempo, continue esperando); **`CF=1`**, "o tempo
mínimo já foi cumprido" (por exemplo, o despachante já deixou passar o *time-out*). A 91H só
recebe `AL` com o tipo.

Nos PCjr/PC retorna 80H; no PC XT de 08/11/82, 86H.

### Quem chama o quê

Reunindo o que aparece nos outros capítulos:

| Situação | Chamada | Capítulo |
|---|---|---|
| Disco fixo esperando a interrupção / terminou | `AX=9000H` / `AX=9100H` | [10](cap10-disco-fixo.md) |
| Reset do disco fixo no PS/2 | `AX=90FCH` | [10](cap10-disco-fixo.md) |
| Disquete esperando a interrupção / terminou | `AX=9001H` / `AX=9101H` | [9](cap09-disquete.md) |
| Motor do disquete acelerando | `AX=90FDH` | [9](cap09-disquete.md) |
| `INT 16H, AH=00H` sem tecla | `AX=9002H` | [6](cap06-teclado.md) |
| Tecla disponível no buffer (avisado pela INT 09H) | `AX=9102H` | [6](cap06-teclado.md) |
| Impressora ocupada | `AX=90FEH` | [11](cap11-serial-e-impressora.md) |

## 16.3 O despachante, segundo a Seção 4 do manual

A BIOS **não é reentrante**: duas tarefas não podem estar dentro da mesma rotina ao mesmo
tempo. Os ganchos existem para que um sistema multitarefa contorne isso.

- **Wait (ocupado)**, `INT 15H, AX=90xxH`: antes de um laço de espera, a BIOS avisa. O
  despachante guarda o estado da tarefa e executa outra.
- **Post (interrupção)**, `INT 15H, AX=91xxH`: quando a causa da espera termina, a BIOS avisa; o
  despachante marca a tarefa como pronta.
- **Início:** o despachante intercepta `INT 15H`, trata 90H/91H e repassa as demais funções ao
  tratador anterior.
- **Serialização:** o próprio sistema deve garantir que o código do driver seja usado por uma
  tarefa de cada vez (nos tipos 00H a 7FH).
- **Time-out:** o despachante precisa conhecer o tempo, porque certos dispositivos (disquete,
  impressora) devem desistir depois de um prazo e devolver `CF=1` ao laço.

```asm fragmento titulo="Esqueleto do gancho de um despachante"
nova15  PROC FAR
        CMP  AH,90H
        JE   ocupado
        CMP  AH,91H
        JE   completo
        JMP  DWORD PTR CS:antigo15      ; outras funções: tratador anterior

ocupado:
        ; AL = tipo. Marcar a tarefa atual como "esperando AL",
        ; salvar o seu contexto e trocar para outra tarefa pronta.
        ; Quando esta tarefa voltar a rodar:
        ;   evento já ocorreu  -> CF=1 (pode parar de esperar)
        ;   ainda não          -> CF=0 (a BIOS continua o laço)
        CLC
        RETF 2

completo:
        ; AL = tipo. Marcar como pronta a tarefa que esperava AL.
        ; Atenção: aqui estamos dentro de uma interrupção de hardware.
        IRET
nova15  ENDP
```

O `RETF 2` devolve os flags novos (com o CF escolhido) em vez dos flags empilhados pela `INT`,
como no tratador de teclado do [Capítulo 6](cap06-teclado.md).

> **Na prática.** Ambientes como o TopView, o DESQview e o OS/2 usavam esses ganchos. Num TSR
> simples, o gancho 90H é útil por outro motivo: `AX=9002H` diz que o programa em primeiro
> plano está **parado esperando uma tecla**, um momento seguro para o TSR fazer trabalho em
> segundo plano, parecido com a `INT 28H` do DOS que a [Aula 27](../conteudo/aula27-tsr.md) usa.

## 16.4 No simulador do curso

O simulador não tem `INT 15H`, e a sua BIOS não emite os avisos 90H/91H (ela se comporta como a
de um PC de 8086, anterior a esses ganchos). Os exemplos deste capítulo são para estudo ou para
emuladores de AT e PS/2.

## 16.5 Exercícios

1. Escreva um TSR que intercepta a `INT 15H` e conta quantas vezes cada tipo (00H, 01H, 02H, FDH,
   FEH) foi avisado pela 90H. Uma tecla de atalho mostra os contadores. Num AT ou emulador.
2. Usando o gancho `AX=9002H`, faça um TSR que mostra um relógio no canto da tela **apenas**
   enquanto o programa em primeiro plano espera uma tecla. Compare com o relógio da Aula 27,
   baseado na `INT 1CH`.
3. Explique por que os tipos C0H a FFH não têm aviso de conclusão (91H). *(Porque não há
   interrupção que avise o fim: a espera termina pelo tempo, não por um evento do dispositivo.)*

## Resumo

- A BIOS espera em laços; antes de cada um chama `INT 15H, AH=90H` com o tipo em `AL`, e o fim
  do evento gera `AH=91H`.
- Tipos 00H–7FH são seriais, 80H–BFH reentrantes, C0H–FFH só espera com *time-out*.
- O despachante engancha a `INT 15H`, troca de tarefa no 90H, marca a tarefa pronta no 91H e
  repassa o resto.
- A BIOS não é reentrante: serializar o acesso é responsabilidade do sistema.
