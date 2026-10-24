---
id: apA
numero: 101
parte: apendices
titulo: "Apêndice A · Referência rápida de todas as funções"
---

# Apêndice A · Referência rápida de todas as funções

Uma linha por função, com a entrada essencial, o retorno, onde ela existe e se roda no simulador
do curso. Coluna **Sim.**: ✓ = implementada; ◐ = parcial (veja o capítulo); vazio = sem serviço no
simulador. **Modelos**: "todos" = desde o PC; "AT+" = AT, XT 286, PS/2 (e, quando dito no capítulo,
o PC Convertible e o XT de 10/01/86); "PS/2" inclui o Model 30 salvo indicação "(−30)".

## Interrupções do processador e de hardware

| INT | Função | Notas | Cap. | Sim. |
|---|---|---|---|---|
| 00H | Divisão por zero / quociente grande | gerada por `DIV`/`IDIV` | 2 | ✓ |
| 01H | Passo a passo | TF = 1 | 2 | ◐ |
| 02H | NMI | paridade; PS/2: 110–113; 8087 | 2 | |
| 03H | Breakpoint | `INT 3` (`CCH`) | 2 | ✓ |
| 04H | Overflow | `INTO` com OF = 1 | 2 | ◐ |
| 05H | Print Screen | estado em `50:00` | 2 | ◐ |
| 08H | Timer (IRQ 0) | `40:6C`++, motor, chama 1CH | 7 | ✓ |
| 09H | Teclado (IRQ 1) | porta 60H → buffer `40:1E` | 6 | ✓ |
| 0EH | Disquete (IRQ 6) | bit 7 de `40:3E` | 9 | |
| 1BH | Ctrl-Break | chamada pela 09H | 6 | |
| 1CH | Gancho do tick | ~18,2/s, encadear | 7 | ✓ |
| 4AH | Alarme do usuário | chamada pelo RTC | 7 | |
| 70H | RTC (IRQ 8) | periódica ~1024/s e alarme (AT+) | 7 | |
| 75H | Coprocessador (IRQ 13) | repassa para INT 02H (AT+) | 2 | |

## INT 10H · Vídeo

| AH | Função | Entrada → retorno | Modelos | Cap. | Sim. |
|---|---|---|---|---|---|
| 00H | Definir modo | AL = modo (bit 7: não limpa) | todos | 3 | ◐ (3, 13H) |
| 01H | Formato do cursor | CH, CL = linhas inicial/final | todos | 3 | ◐ |
| 02H | Posicionar cursor | DH linha, DL coluna, BH página | todos | 3 | ✓ |
| 03H | Ler cursor | BH → DH,DL posição; CH,CL formato | todos | 3 | ✓ |
| 04H | Caneta óptica | → AH=1 válida; DH,DL; CH/CX; BX | não PS/2/Convertible | 3 | |
| 05H | Página ativa | AL = página | todos | 3 | ◐ |
| 06H | Rolar para cima | AL linhas (0 = limpar), BH atributo, CX/DX cantos | todos | 3 | ✓ |
| 07H | Rolar para baixo | idem | todos | 3 | ✓ |
| 08H | Ler caractere/atributo | BH → AL caractere, AH atributo | todos | 3 | ✓ |
| 09H | Escrever caractere+atributo | AL, BL, BH, CX (não move o cursor) | todos | 3 | ✓ |
| 0AH | Escrever caractere | AL, BH, CX (mantém atributo) | todos | 3 | ✓ |
| 0BH | Paleta CGA / borda | BH=0: BL fundo/borda; BH=1: BL paleta | todos | 3 | |
| 0CH | Escrever pixel | AL cor (bit 7 XOR), CX x, DX y, BH | todos | 3 | ◐ (13H) |
| 0DH | Ler pixel | CX, DX, BH → AL | todos | 3 | ◐ (13H) |
| 0EH | Teletipo | AL caractere (BL cor em gráficos) | todos | 3 | ✓ |
| 0FH | Estado | → AL modo, AH colunas, BH página | todos | 3 | ✓ |
| 10H | Paleta e DAC | AL = 00H–03H, 07H–09H, 10H–1BH | PCjr, EGA, PS/2 | 4 | ◐ (10H, 12H, 15H, 17H) |
| 11H | Fontes | AL = 00H–04H, 10H–14H, 20H–24H, 30H | EGA, PS/2 | 4 | ◐ (30H) |
| 12H | Seleções alternativas | BL = 10H, 20H, 30H–36H → AL=12H | EGA, PS/2 | 4 | |
| 13H | Escrever string | AL 00H–03H, ES:BP, CX, DX, BH, BL | XT 86+, AT, EGA, PS/2 | 4 | |
| 14H | Fonte do LCD | AL 00H–02H | PC Convertible | 5 | |
| 15H | Parâmetros físicos do display | (ver manual) | | 5 | |
| 1AH | DCC | AL=00H lê → AL=1AH, BL, BH; AL=01H grava | PS/2 | 5 | |
| 1BH | Funcionalidade/estado | BX=0, ES:DI → 64 bytes; AL=1BH | PS/2 | 5 | |
| 1CH | Salvar/restaurar estado | AL 00H–02H, CX máscara, ES:BX | PS/2 (−30) | 5 | |

## INT 11H e INT 12H

| INT | Função | Retorno | Cap. | Sim. |
|---|---|---|---|---|
| 11H | Equipamento | AX = mapa de bits (`40:10`) | 8 | |
| 12H | Memória convencional | AX = KB (`40:13`) | 8 | |

## INT 13H · Disquete (DL < 80H)

| AH | Função | Notas | Cap. |
|---|---|---|---|
| 00H | Reiniciar | DL ≥ 80H reinicia também o disco fixo | 9 |
| 01H | Status | → AH (de `40:41`) | 9 |
| 02H | Ler setores | AL n, CH trilha, CL setor, DH cabeça, DL unidade, ES:BX | 9 |
| 03H | Gravar setores | idem | 9 |
| 04H | Verificar setores | idem (ES:BX dispensável nas BIOS novas) | 9 |
| 05H | Formatar trilha | ES:BX → campos (trilha, cabeça, setor, tamanho) | 9 |
| 08H | Parâmetros da unidade | → BL tipo, CH/CL, DH, DL, ES:DI tabela | 9 |
| 15H | Tipo de DASD | → AH 00H–03H | 9 |
| 16H | Linha de troca | → AH 00H / 06H | 9 |
| 17H | DASD para formatar | AL 01H–04H | 9 |
| 18H | Mídia para formatar | CH/CL trilhas e setores → ES:DI | 9 |

## INT 13H · Disco fixo (DL ≥ 80H)

| AH | Função | Notas | Cap. |
|---|---|---|---|
| 00H | Reiniciar | também o disquete | 10 |
| 01H | Status | → AH; depois zera | 10 |
| 02H / 03H | Ler / gravar | CHS com cilindro de 10 bits | 10 |
| 04H | Verificar | | 10 |
| 05H | Formatar cilindro | XT: AL interleave; AT/PS/2: ES:BX pares F,N | 10 |
| 06H / 07H | Formatar (XT) | só PC XT | 10 |
| 08H | Parâmetros | → DL discos, DH cabeças, CH/CL | 10 |
| 09H | Inicializar par | tabelas INT 41H / 46H | 10 |
| 0CH | Seek | | 10 |
| 0DH | Reset alternativo | não toca no disquete | 10 |
| 10H | Unidade pronta? | | 10 |
| 11H | Recalibrar | | 10 |
| 15H | Tipo / capacidade | → AH=03H, CX:DX setores (AT+) | 10 |
| 19H | Estacionar cabeças | (ver manual) | 10 |
| 1AH | Formatar ESDI | AL, ES:BX, CL bits | 10 |

O simulador do curso não tem `INT 13H`.

## INT 14H · Serial

| AH | Função | Notas | Cap. |
|---|---|---|---|
| 00H | Inicializar | AL = baud(3) paridade(2) parada(1) palavra(2); DX linha | 11 |
| 01H | Enviar | AL → AH status (bit 7 = time-out) | 11 |
| 02H | Receber | → AL, AH (espera) | 11 |
| 03H | Status | → AH linha, AL modem | 11 |
| 04H | Inicialização estendida | AL, BH, BL, CH, CL (até 19200) | 11 (PS/2) |
| 05H | Controle do modem | AL 00H/01H, BL | 11 (PS/2) |

## INT 15H · Serviços do sistema

| AH | Função | Modelos | Cap. |
|---|---|---|---|
| 00H–03H | Cassete | PC, PCjr | 13 |
| 0FH | Gancho de formatação ESDI | PS/2 com ESDI | 13 |
| 21H | Log de erros do POST | PS/2 (−30) | 13 |
| 40H–44H | Perfis, evento externo, desligar, status, modem | PC Convertible | 13 |
| 4FH | Interceptação de teclado | AT 10/06/85+ | 6 |
| 80H–82H | Abrir, fechar, terminar | AT+ | 13 |
| 83H | Aviso após intervalo (µs) | AT+ (−30) | 7 |
| 84H | Joystick | AT+ | 13 |
| 85H | SysRq | XT 86+, AT+ | 6 |
| 86H | Esperar (µs) | AT+ (−30) | 7 |
| 87H | Mover bloco (acima de 1 MB) | AT+ (−30) | 14 |
| 88H | Memória estendida | AT+ (−30) | 8 |
| 89H | Entrar em modo protegido | AT+ (−30) | 14 |
| 90H / 91H | Ocupado / completo | AT+ | 16 |
| C0H | Configuração do sistema | AT 10/06/85+, XT 86+, PS/2 | 8 |
| C1H | Segmento da EBDA | PS/2 | 8 |
| C2H | Mouse | PS/2 | 15 |
| C3H | Watchdog | PS/2 (−30) | 13 |
| C4H | POS | PS/2 (−30) | 13 |

Sem suporte: `CF=1` com `AH=80H` (PC, PCjr) ou `86H`. O simulador do curso não tem `INT 15H`.

## INT 16H · Teclado

| AH | Função | Retorno | Modelos | Cap. | Sim. |
|---|---|---|---|---|---|
| 00H | Ler tecla | AL ASCII, AH scan (espera) | todos | 6 | ✓ |
| 01H | Há tecla? | ZF=1 não; ZF=0 sim, AX | todos | 6 | ✓ |
| 02H | Estado de Shift | AL (`40:17`) | todos | 6 | ◐ (AL=0) |
| 03H | Typematic | AL=05H, BL taxa, BH atraso | AT 15/11/85+, PS/2, PCjr | 6 | |
| 04H | Clique | AL 00H/01H | PCjr, Convertible | 6 | |
| 05H | Escrever no buffer | CL ASCII, CH scan → AL 00H/01H | AT 15/11/85+, XT 86+, PS/2 | 6 | |
| 10H | Ler tecla estendida | como 00H, sem tradução | idem | 6 | ✓ |
| 11H | Há tecla estendida? | como 01H | idem | 6 | ✓ |
| 12H | Estado estendido | AL e AH | idem | 6 | |

## INT 17H · Impressora

| AH | Função | Notas | Cap. |
|---|---|---|---|
| 00H | Imprimir | AL caractere, DX impressora → AH status | 11 |
| 01H | Inicializar | → AH status | 11 |
| 02H | Status | → AH (bit 7 = pronta) | 11 |

## INT 18H, 19H e 1AH

| INT / AH | Função | Modelos | Cap. | Sim. |
|---|---|---|---|---|
| 18H | ROM BASIC | PC, XT, AT | 12 | |
| 19H | Boot: setor 1 → `0000:7C00`, DL = unidade | todos | 12 | |
| 1AH / 00H | Ler ticks | CX:DX, AL = passou meia-noite | todos | 7 | ✓ |
| 1AH / 01H | Acertar ticks | CX:DX | todos | 7 | |
| 1AH / 02H, 03H | Ler / acertar hora (BCD) | CH, CL, DH, DL | AT+ | 7 | |
| 1AH / 04H, 05H | Ler / acertar data (BCD) | CH, CL, DH, DL | AT+ | 7 | |
| 1AH / 06H, 07H | Alarme / cancelar | CH, CL, DH; usa INT 4AH | AT+ | 7 | |
| 1AH / 08H | Ligar pelo RTC | | PC Convertible | 7 | |
| 1AH / 09H | Ler alarme e status | DL | Convertible, Model 30 | 7 | |
| 1AH / 0AH, 0BH | Ler / acertar contador de dias | CX desde 01/01/1980 | XT 86+, PS/2 | 7 | |
| 1AH / 80H | Multiplexador de som | | PCjr | 7 | |
