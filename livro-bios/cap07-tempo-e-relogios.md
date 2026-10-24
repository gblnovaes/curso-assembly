---
id: cap07
numero: 7
parte: 3
titulo: "Tempo: o temporizador, os relógios e as esperas (INT 08H, 1CH, 1AH, 70H, 4AH e INT 15H 83H/86H)"
aulas: aula15; aula27; aula29; aula30
---

# Capítulo 7 · Tempo: o temporizador, os relógios e as esperas

> **Neste capítulo:** a interrupção do temporizador (`INT 08H`) e o gancho do usuário
> (`INT 1CH`); os dois relógios da `INT 1AH` (contador de ticks e relógio de tempo real com
> bateria); a interrupção do RTC (`INT 70H`) e o alarme (`INT 4AH`); e as esperas da
> `INT 15H` (83H e 86H).
>
> **Antes de ler:** [Aula 15, Rotinas de interrupção e o timer](../conteudo/aula15-isr.md),
> [Aula 29, O timer 8253 e o alto-falante](../conteudo/aula29-pit-som.md) (o hardware por trás
> do tick) e [Aula 30, BCD e ponto fixo](../conteudo/aula30-bcd-ponto-fixo.md) (o RTC fala BCD).

## 7.1 Dois relógios diferentes

| | Contador do temporizador | Relógio de tempo real (RTC) |
|---|---|---|
| Hardware | canal 0 do 8253/8254 (PIT) | chip CMOS com bateria |
| Precisão | ~18,2 ticks por segundo | segundos (e interrupção de ~1024 Hz) |
| Ao desligar | perde tudo; recomeça no POST | continua contando |
| Formato | contagem binária de 32 bits | **BCD** |
| Onde existe | todos os modelos | AT e posteriores, e PC Convertible |
| Acesso | `INT 1AH`, AH=00H/01H; `40:6C` | `INT 1AH`, AH=02H a 07H |

O DOS, ao iniciar, lê o RTC (quando existe) e acerta o contador de ticks; a partir daí, o
`TIME` do DOS vem do contador.

## 7.2 INT 08H · Temporizador do sistema

É a interrupção gerada pelo **canal 0** do temporizador. A entrada do contador é de
**1,19318 MHz** com divisor **65536**, o que dá cerca de **18,2 interrupções por segundo**
(1.193.180 / 65.536 ≈ 18,2065; um tick a cada ~54,9 ms).

A cada tick o tratador:

1. Incrementa o contador de ticks em `40:6C` (palavra dupla, contagem desde a energização ou
   desde a meia-noite, usada para derivar a hora do dia). Depois de 24 horas o contador volta
   a zero e o byte de estouro em `40:70` passa a ser diferente de zero.
2. Decrementa o contador de desligamento do motor do disquete em `40:40`; ao chegar a zero,
   desliga o motor e limpa os flags de motor em `40:3F`.
3. Chama a rotina do usuário via **INT 1CH** (gancho de tick).

No **PC Convertible**, quando ocorre um alarme, ele também chama uma rotina do usuário via
**INT 4AH**.

> **Quantos ticks tem um dia?** 24 × 60 × 60 × 18,2065 ≈ 1.573.040 = `1800B0H`. É nesse valor
> que o contador volta a zero. Com ele dá para converter ticks em hora:
> `segundos = ticks × 65536 / 1193180`, ou, aproximadamente, `ticks / 18,2`.

### INT 1CH · O gancho do usuário

Para executar algo periodicamente **sem substituir a INT 08H**, instale seu código no vetor
da `INT 1CH` e encadeie o tratador anterior. É o que fazem o relógio residente da
[Aula 27](../conteudo/aula27-tsr.md) e os exemplos da Aula 15.

Regras para a rotina de `INT 1CH`:

- Ela roda **dentro** da `INT 08H`, antes do EOI de muitas BIOS: seja curta, ou o teclado e o
  próprio relógio atrasam.
- Preserve todos os registradores que usar e termine com `IRET` (ou salte para o vetor
  anterior).
- Não chame o DOS (`INT 21H`) de dentro dela: o DOS pode estar no meio de outra chamada
  (Aula 27, "Nada de DOS dentro da rotina").
- Acesse suas variáveis com o prefixo `CS:`, porque DS é o do programa interrompido.

Mudar a frequência do canal 0 (Aula 29, "Acelerando o canal 0") faz a `INT 08H` acontecer mais
vezes por segundo, e o relógio do DOS adianta, a menos que o seu tratador só chame o original
na proporção certa.

## 7.3 INT 1AH · Relógio do sistema e relógio de tempo real

| AH | Função | Disponibilidade |
|---|---|---|
| 00H / 01H | Ler / definir o contador do temporizador | todos |
| 02H / 03H | Ler / definir a hora do RTC | AT e posteriores |
| 04H / 05H | Ler / definir a data do RTC | AT e posteriores |
| 06H / 07H | Definir / cancelar o alarme do RTC | AT e posteriores |
| 08H | Modo de ligar o sistema pelo RTC | só PC Convertible |
| 09H | Ler hora e status do alarme | PC Convertible e Model 30 |
| 0AH / 0BH | Ler / definir o contador de dias | PC XT (10/01/86+) e PS/2 |
| 80H | Multiplexador de som | PCjr |

Quando uma função não existe no modelo, a BIOS normalmente retorna `CF=1` ("função inválida")
ou simplesmente não faz nada.

### AH = 00H e 01H · Contador do temporizador

`CX:DX` = contagem (parte alta em CX, baixa em DX). A taxa é **1.193.180 / 65.536 ≈ 18,2
contagens por segundo**; 24 horas completam o contador e ligam o *flag* de estouro (`40:70`).
Na 00H, `AL` é diferente de zero se passaram 24 horas desde a última leitura, ajuste ou reset;
**ler ou ajustar zera esse flag**.

> **Cuidado com o flag de meia-noite.** O DOS usa esse flag para avançar a data. Se o seu
> programa lê `INT 1AH, AH=00H` e ignora `AL`, o DOS nunca fica sabendo que o dia virou. Prefira
> ler `40:6C` diretamente quando só precisa medir intervalos.

```asm fragmento titulo="Esperar N ticks lendo 40:6C (funciona em qualquer PC)"
; Entrada: CX = número de ticks (~55 ms cada)
espera  PROC
        PUSH AX
        PUSH DS
        MOV  AX,0040H
        MOV  DS,AX
prox:   MOV  AX,DS:[006CH]   ; palavra baixa do contador
mesmo:  CMP  AX,DS:[006CH]
        JE   mesmo           ; aguarda o próximo tick
        LOOP prox
        POP  DS
        POP  AX
        RET
espera  ENDP
```

Este laço independe da velocidade da CPU, ao contrário de um `LOOP` vazio, que é exatamente o
que a IBM recomenda evitar ([Capítulo 19](cap19-diretrizes-e-compatibilidade.md)).

### RTC: hora, data e alarme (AH = 02H a 07H)

Todos os valores são em **BCD** compactado: `25H` significa vinte e cinco.

- **Hora (02H/03H):** `CH` = horas, `CL` = minutos, `DH` = segundos; `DL=01H` indica horário de
  verão (ignorado no Model 30). `CF=1` na leitura = relógio parado.
- **Data (04H/05H):** `CH` = século (19 ou 20), `CL` = ano, `DH` = mês, `DL` = dia.
- **Alarme (06H):** `CH:CL:DH` = hora:minuto:segundo. Retorna `CF=1` se já há alarme ativo ou
  se o relógio não funciona. Quando dispara, a BIOS executa `INT 4AH`; **você deve apontar
  `INT 4AH` para sua rotina antes** de ativar o alarme. A `07H` cancela.

```asm titulo="HORA.ASM: hora e data do relógio de tempo real em BCD"
.MODEL SMALL
.STACK 100h
.DATA
sem_rtc DB  'Relógio de tempo real indisponível',13,10,'$'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        MOV  AH,02H           ; lê a hora: CH=h CL=min DH=s (BCD)
        STC                   ; BIOS sem RTC pode não mexer em CF
        INT  1AH
        JC   falhou
        MOV  AL,CH
        CALL impbcd
        MOV  DL,':'
        CALL letra
        MOV  AL,CL
        CALL impbcd
        MOV  DL,':'
        CALL letra
        MOV  AL,DH
        CALL impbcd
        MOV  DL,' '
        CALL letra

        MOV  AH,04H           ; lê a data: CH=século CL=ano DH=mês DL=dia
        STC
        INT  1AH
        JC   falhou
        MOV  AL,DL
        CALL impbcd
        MOV  DL,'/'
        CALL letra
        MOV  AL,DH
        CALL impbcd
        MOV  DL,'/'
        CALL letra
        MOV  AL,CH
        CALL impbcd
        MOV  AL,CL
        CALL impbcd
        JMP  fim
falhou: MOV  DX,OFFSET sem_rtc
        MOV  AH,09H
        INT  21H
fim:    MOV  AX,4C00H
        INT  21H

; imprime o byte BCD de AL como dois dígitos (preserva CX e DX)
impbcd  PROC
        PUSH CX
        PUSH DX
        MOV  DH,AL
        MOV  CL,4
        SHR  AL,CL            ; dezena (nibble alto)
        ADD  AL,'0'
        MOV  DL,AL
        CALL letra
        MOV  AL,DH
        AND  AL,0FH           ; unidade (nibble baixo)
        ADD  AL,'0'
        MOV  DL,AL
        CALL letra
        POP  DX
        POP  CX
        RET
impbcd  ENDP

letra   PROC                  ; escreve DL (preserva AX)
        PUSH AX
        MOV  AH,02H
        INT  21H
        POP  AX
        RET
letra   ENDP
END inicio
```

Repare que imprimir BCD é **mais simples** que imprimir binário: cada nibble já é um dígito,
sem nenhuma divisão. Para calcular com esses valores (somar minutos, comparar horários), use
`ADD` seguido de `DAA`, como na [Aula 30](../conteudo/aula30-bcd-ponto-fixo.md).

### AH = 0AH e 0BH · Contador de dias

`CX` = dias desde **01/01/1980**, zerado pelo POST no PC XT (BIOS de 10/01/86 em diante) e no
Model 30. Em AT e XT 286 retorna `CF=1`.

### Funções de modelos específicos

- `08H`: no PC Convertible, programa um horário para o RTC **ligar** o sistema.
- `09H`: lê hora e status do alarme em `DL` (00H = desligado; 01H = ativo mas não liga a
  máquina; 02H = ativo e liga a máquina). O Model 30 não suporta o "ligar".
- `80H`: no PCjr, escolhe a fonte de som (canal 2 do 8253, cassete, linha *Audio In* ou o chip
  de som complexo).

## 7.4 INT 70H · Interrupção do relógio de tempo real

Só AT, XT 286 e PS/2 (IRQ 8, no segundo controlador de interrupções). Controla duas funções do
RTC:

- **Periódica:** quando ativada, dispara cerca de **1024 vezes por segundo**; o contador de
  microssegundos do usuário (palavra dupla) é decrementado de **976 µs** a cada disparo. Ao
  chegar a zero, a BIOS liga o bit de "evento concluído" no byte do usuário. É o mecanismo
  da `INT 15H, AH=83H` e `86H` (seção 7.5).
- **Alarme:** no horário programado emite `INT 4AH`.

No **PC Convertible** as mesmas funções existem, mas geram uma interrupção **não mascarável**
em vez do `INT 70H`. No **PS/2 Model 30** a função periódica não é suportada.

### INT 4AH · Alarme do usuário

Vetor livre que a BIOS chama quando o alarme do RTC dispara (`INT 1AH, AH=06H`). O seu
tratador termina com `IRET`. Mesmas regras da `INT 1CH`: curto, sem DOS, variáveis via `CS:`.

## 7.5 Esperas pela BIOS: INT 15H, AH = 83H e 86H

Estas funções usam a interrupção periódica do RTC, portanto exigem AT, XT 286 ou PS/2 (exceto
Model 30). Em PCjr e PC retornam `AH=80H, CF=1`; no PC XT, `AH=86H, CF=1`.

### AH = 83H · Espera por evento (não bloqueia)

Programa um aviso para daqui a certo tempo, sem travar o programa.

- `AL=00H` define o intervalo: `ES:BX` aponta para um byte do chamador cujo **bit 7** será
  ligado ao fim do intervalo; `CX:DX` = microssegundos (granularidade de **976 µs**). Retorna
  `CF=1` se a função já está ocupada.
- `AL=01H` cancela o intervalo.

O PS/2 Model 30 sempre retorna `CF=1`. No PC XT retorna 86H; no AT de 10/01/84, só a variante
de intervalo está disponível.

```asm fragmento titulo="Pedir um aviso em 500 ms (500000 µs = 0007A120H)"
        MOV  BYTE PTR flag,0
        MOV  AX,8300H
        MOV  CX,0007H
        MOV  DX,0A120H
        PUSH DS
        POP  ES
        MOV  BX,OFFSET flag
        INT  15H
        JC   ocupado
jogo:   ; ... continuar trabalhando ...
        TEST BYTE PTR flag,80H
        JZ   jogo            ; ainda não passou meio segundo
```

### AH = 86H · Esperar um tempo (bloqueia)

`CX:DX` = microssegundos (granularidade ≈ 976 µs). A BIOS só devolve o controle depois do
tempo. `CF=1` indica que já existe uma espera em andamento.

> **Diferença prática:** a **86H** trava o seu programa; a **83H** marca um byte e deixa o
> programa continuar. Os campos de trabalho das duas ficam em `40:98` a `40:A0` (endereço do
> flag do usuário, contagem em µs e flag de espera ativa), vistos no
> [Capítulo 17](cap17-area-de-dados-da-bios.md).

### Escolhendo o jeito de medir tempo

| Necessidade | Melhor ferramenta | Resolução |
|---|---|---|
| Hora e data de verdade | `INT 21H` (DOS) ou `INT 1AH, AH=02H/04H` | 1 s |
| Esperas de jogo, animação | `40:6C` ou `INT 1CH` | ~55 ms |
| Esperas finas em AT/PS/2 | `INT 15H, AH=86H` | ~1 ms |
| Medir trechos de código | latch do canal 0 do PIT (Aula 29) | ~0,84 µs |

## 7.6 No simulador do curso

Funcionam: o tratador nativo de `INT 08H` (incrementa `40:6C` e chama a `INT 1CH` quando ela foi
enganchada), `INT 1CH` e `INT 1AH, AH=00H` (devolve `CX:DX` com `AL=0`). O tick do simulador
acontece a cada 3000 instruções (proporcional ao divisor do canal 0), não a cada 55 ms reais; no
"▶ Jogar" das aulas de jogos, o tempo é real (18,2 tiques por segundo). Do RTC, funcionam
`AH=02H` (hora) e `AH=04H` (data), em BCD, com a hora do computador onde o curso roda: é o que o
comando `HORA` do MINIOS ([aula 43](../conteudo/aula43-shell.md)) e o `HORA.ASM` usam. As demais
funções do RTC: `AH=03H` e `05H` são aceitas, mas não acertam o relógio; `06H` a `0BH`, `INT 70H`, `INT 4AH` e `INT 15H` não existem.

## 7.7 Exercícios

1. Escreva `CRONOMETRO.ASM`: mostra os segundos decorridos (ticks ÷ 18) desde o início do
   programa, atualizando a cada tick, até uma tecla ser pressionada.
2. Converta o contador `CX:DX` de `INT 1AH, AH=00H` em horas, minutos e segundos. Dica: divida
   por 1092 (18,2 × 60) para obter os minutos aproximados desde a meia-noite e depois por 60
   para separar horas e minutos, tratando a divisão de 32 bits como na [Aula 21](../conteudo/aula21-calculadora.md).
3. Instale um tratador de `INT 1CH` que pisca um asterisco no canto superior direito da tela
   (`B800:009E`) a cada 9 ticks e restaure o vetor ao sair. Rode no laboratório.
4. Num AT ou emulador, programe um alarme para daqui a um minuto com `INT 1AH, AH=06H` e um
   tratador de `INT 4AH` que toca um bipe com o canal 2 do PIT (Aula 29). Lembre de somar em
   BCD (`ADD` + `DAA`) e de tratar a virada de 59 para 00.

## Resumo

- O PIT gera `INT 08H` ~18,2 vezes por segundo; a BIOS conta em `40:6C`, cuida do motor do
  disquete e chama `INT 1CH`.
- `INT 1AH, AH=00H` lê o contador (e zera o flag de meia-noite); `AH=02H` a `07H` acessam o RTC
  em BCD, em AT e posteriores.
- O RTC tem interrupção periódica de ~1024 Hz (`INT 70H`) e alarme (`INT 4AH`).
- `INT 15H, AH=83H` agenda um aviso; `AH=86H` espera bloqueando; ambas em µs com passo de
  976 µs.
