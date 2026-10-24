---
id: cap13
numero: 13
parte: 5
titulo: "INT 15H: a caixa de ferramentas do sistema"
aulas: aula14; aula19; aula27
---

# Capítulo 13 · INT 15H: a caixa de ferramentas do sistema

> **Neste capítulo:** o mapa completo da `INT 15H`, o padrão de "não suportado" (`CF=1` com
> `AH=80H` ou `86H`) que torna fácil detectar recursos, e as funções que não têm capítulo
> próprio: fita cassete, gancho de formatação ESDI, log de erros do POST, as funções de energia
> do PC Convertible, os ganchos de dispositivo, o joystick, o *watchdog* e o POS do Micro
> Channel.
>
> **Antes de ler:** [Aula 14](../conteudo/aula14-interrupcoes.md) e
> [Aula 19](../conteudo/aula19-menu-entrada.md) (sinalizar erros com CF).

`INT 15H` é a "caixa de ferramentas" da BIOS: um conjunto heterogêneo de serviços que foi
crescendo a cada geração de hardware. Por isso o mesmo número de função pode significar coisas
diferentes (ou nada) conforme a máquina.

## 13.1 Como interpretar os retornos de "não suportado"

Quase todas as funções seguem um padrão: se o sistema não implementa o serviço, a BIOS devolve
`CF = 1` e um código de erro em `AH`:

- **`AH = 80H`**: comando inválido (típico de PCjr e PC);
- **`AH = 86H`**: função não suportada (típico das gerações seguintes).

Isso torna fácil **detectar** recursos: chame a função e olhe `CF`. Para saber de antemão o que
existe, use `INT 15H, AH=C0H` ([Capítulo 8](cap08-equipamento-e-memoria.md)).

```asm fragmento titulo="Padrão de detecção"
        MOV  AH,88H          ; qualquer função da INT 15H
        INT  15H
        JC   nao_tem         ; CF=1: AH = 80H ou 86H (ou um erro da função)
```

> **Cuidado em máquinas muito antigas.** No PC original, a `INT 15H` só tratava a fita
> cassete; para outras funções o resultado é `AH=80H` com `CF=1`. Um tratador de terceiros
> instalado no vetor pode não seguir o padrão. Por isso, além de olhar `CF`, confira se o valor
> devolvido faz sentido.

## 13.2 Mapa das funções

| AH | Função | Onde está |
|---|---|---|
| 00H–03H | Fita cassete: motor on/off, ler e gravar blocos | 13.3 |
| 0FH | Interrupção periódica de formatação (ESDI) | 13.4 |
| 21H | Registro de erros do POST | 13.5 |
| 40H | Ler/modificar perfis (PC Convertible) | 13.6 |
| 41H | Esperar evento externo | 13.6 |
| 42H | Pedir desligamento do sistema | 13.6 |
| 43H | Ler status do sistema | 13.6 |
| 44H | Alimentação do modem interno | 13.6 |
| 4FH | Interceptação do teclado | [Capítulo 6](cap06-teclado.md) |
| 80H–82H | Abrir/fechar dispositivo, terminar programa | 13.7 |
| 83H | Espera por evento (temporizador) | [Capítulo 7](cap07-tempo-e-relogios.md) |
| 84H | Suporte a joystick | 13.8 |
| 85H | Tecla System Request | [Capítulo 6](cap06-teclado.md) |
| 86H | Espera (*wait*) | [Capítulo 7](cap07-tempo-e-relogios.md) |
| 87H | Mover bloco (memória estendida) | [Capítulo 14](cap14-memoria-estendida-modo-protegido.md) |
| 88H | Tamanho da memória estendida | [Capítulo 8](cap08-equipamento-e-memoria.md) |
| 89H | Entrar em modo protegido | [Capítulo 14](cap14-memoria-estendida-modo-protegido.md) |
| 90H / 91H | Dispositivo ocupado / interrupção completa | [Capítulo 16](cap16-multitarefa.md) |
| C0H | Parâmetros de configuração do sistema | [Capítulo 8](cap08-equipamento-e-memoria.md) |
| C1H | Segmento da EBDA | [Capítulo 8](cap08-equipamento-e-memoria.md) |
| C2H | Dispositivo apontador (mouse) | [Capítulo 15](cap15-mouse-ps2.md) |
| C3H | *Watchdog time-out* | 13.9 |
| C4H | POS (*Programmable Option Select*) | 13.10 |

## 13.3 AH = 00H a 03H · Fita cassete

Só **PCjr e PC** têm suporte real a cassete (o PC original tinha um conector para gravador de
fita, como os micros domésticos da época).

- `00H` liga o motor e `01H` desliga (retornam `AH=0`, `CF=0`).
- `02H` lê blocos: `ES:BX` = buffer, `CX` = bytes a ler. Retorna `ES:BX` = último byte lido + 1,
  `DX` = bytes lidos e `CF`. No PCjr, em caso de erro, `AH` indica: 01H = erro de CRC, 02H =
  transições de dados perdidas, 04H = nenhum dado encontrado.
- `03H` grava blocos: `ES:BX` = buffer, `CX` = bytes; no retorno `CX = 0`.

Nos demais sistemas, as quatro funções retornam `AH=86H`, `CF=1`.

## 13.4 AH = 0FH · Interrupção periódica de formatação

Gancho para o adaptador de disco **ESDI** durante a formatação (`INT 13H, AH=1AH`,
[Capítulo 10](cap10-disco-fixo.md)). A BIOS chama esta função ao concluir cada cilindro, com
`AL` = fase (01H = análise de superfície, 02H = formatação). Se o seu tratador devolve `CF=0`, o
processo continua; com `CF=1`, ele termina. **Sem tratador instalado, `CF=1` e a formatação
para.** Um formatador instala o seu tratador na `INT 15H`, atende `AH=0FH` (mostrando, por
exemplo, uma barra de progresso) e repassa as outras funções ao vetor antigo.

## 13.5 AH = 21H · Registro de erros do POST (PS/2, exceto Model 30)

- `AL=00H`: lê o log. Retorna `ES:DI` → log e `BX` = quantidade de códigos armazenados.
- `AL=01H`: grava um código (`BX`: `BH` = código do dispositivo, `BL` = erro do dispositivo).
  Retorna `CF=1`/`AH=01H` se o local está cheio.

## 13.6 AH = 40H a 44H · Energia e perfis do PC Convertible

Existem somente nesse modelo (nos outros, retornam 80H ou 86H).

| AH | O que faz |
|---|---|
| 40H | `AL=00H/01H` lê/modifica o perfil do sistema (`CX:BX`); `AL=02H/03H` lê/modifica o do modem interno (`BX`). `AL=80H`/`CF=1` = falha |
| 41H | Espera por evento externo, com *time-out*. Os códigos de tipo 11H–14H equivalem a 01H–04H, mas `DX` carrega o endereço de verificação |
| 42H | Pede *power-off*: `AL=00H` segue o perfil do sistema (suspender ou reiniciar); `AL=01H` força o modo *suspend* |
| 43H | Status do sistema em `AL`: b7 bateria fraca · b6 energia externa · b5 energia reserva perdida (relógio inválido) · b4 ligado por alarme do RTC · b3 modem interno ligado · b2 RS-232-C/paralela ligada · b0 LCD destacado |
| 44H | `AL=00H` desliga o modem interno; `AL=01H` liga e configura conforme o perfil |

O bit 3 do byte de recursos da `C0H` indica se o sistema suporta a 41H.

## 13.7 AH = 80H a 82H · Abrir, fechar e terminar

São ganchos para sistemas operacionais multitarefa. Na maioria dos casos a BIOS só devolve
`CF=0` e quem faz algo útil é o SO ao interceptar o vetor. `BX` = ID do dispositivo e `CX` = ID
do processo (em `80H` e `81H`; `82H` usa só `BX`). Disponíveis em AT, XT 286, PC Convertible e
PS/2; nos PCjr/PC retornam 80H e no PC XT, 86H.

## 13.8 AH = 84H · Joystick

Nos PCjr/PC retorna 80H; no PC XT de 08/11/82, 86H. Para os demais sistemas existe um serviço de
joystick (leitura de botões e posição) cujas subfunções não constavam do material de origem
deste livro; consulte o manual original. A forma tradicional de ler o joystick, sem a BIOS, é a
**porta 201H**: os 4 bits altos são os botões (0 = pressionado) e os 4 baixos são *one-shots*
que ficam em 1 por um tempo proporcional à posição de cada eixo depois de uma escrita qualquer na
porta. Medir esse tempo com um laço ou com o latch do PIT ([Aula 29](../conteudo/aula29-pit-som.md))
dá a posição.

```asm fragmento titulo="Botões do joystick direto pela porta 201H"
        MOV  DX,201H
        IN   AL,DX
        NOT  AL
        AND  AL,0F0H        ; bits 4-7 = botões pressionados (1 = apertado)
```

## 13.9 AH = C3H · Watchdog time-out (PS/2, exceto Model 30)

`AL=00H` desabilita e `AL=01H` habilita o *watchdog*; `BX` = contagem (1 a 255). Se o
temporizador deixar de ser atendido, o sistema gera um NMI, que o tratador da `INT 02H` reporta
como erro **112** ([Capítulo 2](cap02-vetores-e-excecoes.md)). Retorna `CF=1` se falhou.

## 13.10 AH = C4H · POS (*Programmable Option Select*)

Só PS/2 (exceto Model 30). O POS é o mecanismo do **Micro Channel** que substitui as chaves
(*jumpers*) das placas: cada placa tem registradores de identificação e configuração acessados
por *slot*, e o disquete de referência do PS/2 grava a configuração escolhida na CMOS.

| AL | Ação |
|---|---|
| 00H | Retorna em `DX` o endereço-base dos registradores POS do adaptador |
| 01H | Habilita um *slot* para *setup* (`BL` = número do slot) |
| 02H | Habilita o adaptador |

`CF=1` indica falha. Em outros modelos retorna 80H/86H.

## 13.11 Enganchar a INT 15H com segurança

Várias funções desta interrupção são **ganchos** que a BIOS chama e espera que alguém trate
(4FH, 85H, 90H, 91H, 0FH). O modelo de tratador é sempre o mesmo: atender as funções que
interessam e repassar todas as outras ao tratador anterior, sem mexer em nenhum registrador.

```asm fragmento titulo="Esqueleto de tratador da INT 15H"
antigo15 DD  ?
nova15  PROC FAR
        CMP  AH,85H          ; SysRq?
        JE   sysrq
        JMP  DWORD PTR CS:antigo15   ; todas as outras: tratador anterior
sysrq:  ; ... AL=00H make, AL=01H break ...
        JMP  DWORD PTR CS:antigo15   ; e repassa também
nova15  ENDP
```

É o mesmo encadeamento por `JMP DWORD PTR CS:` da [Aula 27, Programas residentes](../conteudo/aula27-tsr.md).

## 13.12 No simulador do curso

A `INT 15H` não tem serviço no simulador: qualquer chamada mostra um aviso e não muda nada
(nem o CF). Para testar o padrão de detecção, rode no laboratório e observe: como `CF` fica como
estava, um programa que faz `CLC` antes do `INT 15H` concluiria, erradamente, que a função
existe. Faça `STC` antes da chamada quando quiser que "ninguém atendeu" seja tratado como
"não suportado".

## 13.13 Exercícios

1. Escreva `RECURSOS.ASM`, que testa e lista quais destas funções existem: 41H, 4FH (pelo bit 4
   da `C0H`), 83H, 86H, 88H, C0H, C1H, C2H, C3H e C4H.
2. Leia os botões do joystick pela porta 201H em laço e mostre, com `INT 10H, AH=09H`, um
   caractere diferente para cada botão pressionado, até uma tecla.
3. Escreva um tratador de `INT 15H` que conta quantas vezes a função 4FH é chamada (cada
   pressionar e soltar de tecla) e mostra a contagem quando o programa termina. Num AT ou
   emulador.

## Resumo

- Função ausente: `CF=1` com `AH=80H` (PC/PCjr) ou `86H` (posteriores); use `STC` antes para
  não confundir "ninguém respondeu" com sucesso.
- Cassete (00H–03H) só no PC/PCjr; 40H–44H só no PC Convertible; 21H, C3H e C4H só no PS/2.
- 0FH, 4FH, 80H–82H, 85H, 90H e 91H são ganchos: a BIOS chama, o SO ou o seu TSR trata e repassa.
- Tempo (83H, 86H) no Capítulo 7; memória (87H–89H) nos Capítulos 8 e 14; mouse (C2H) no 15;
  multitarefa (90H/91H) no 16.
