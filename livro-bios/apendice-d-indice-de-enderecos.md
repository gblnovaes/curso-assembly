---
id: apD
numero: 104
parte: apendices
titulo: "Apêndice D · Índice de endereços, vetores e portas"
---

# Apêndice D · Índice de endereços, vetores e portas

Em ordem crescente. Para cada item, onde ele é explicado.

## D.1 Memória

| Endereço | O que é | Capítulo |
|---|---|---|
| `0000:0000`–`0000:03FF` | Tabela de vetores de interrupção | [2](cap02-vetores-e-excecoes.md) |
| `0000:0070` | Vetor da INT 1CH | [7](cap07-tempo-e-relogios.md) |
| `0000:0078` | Vetor da INT 1EH (tabela de disquete) | [9](cap09-disquete.md) |
| `0000:007C` | Vetor da INT 1FH (caracteres gráficos 128–255) | [3](cap03-video-modos-e-texto.md) |
| `0000:0104` | Vetor da INT 41H (disco fixo 0) | [10](cap10-disco-fixo.md) |
| `0000:0118` | Vetor da INT 46H (disco fixo 1) | [10](cap10-disco-fixo.md) |
| `0000:0128` | Vetor da INT 4AH (alarme) | [7](cap07-tempo-e-relogios.md) |
| `40:00`–`40:FF` | Área de dados da BIOS (mapa completo) | [17](cap17-area-de-dados-da-bios.md) |
| `50:00` | Estado do Print Screen | [2](cap02-vetores-e-excecoes.md) |
| `0000:7C00` | Onde a INT 19H carrega o setor de boot | [12](cap12-boot-e-roms.md) |
| abaixo de `A000:0000` | EBDA (PS/2) | [8](cap08-equipamento-e-memoria.md) |
| `A000:0000` | Memória de vídeo gráfica (EGA, PS/2, modo 13H) | [3](cap03-video-modos-e-texto.md) |
| `B000:0000` | Memória de vídeo monocromática (modo 7) | [3](cap03-video-modos-e-texto.md) |
| `B800:0000` | Memória de vídeo colorida de texto e CGA | [3](cap03-video-modos-e-texto.md) |
| `C000:0000`–`C7FF:000F` | ROMs de vídeo | [12](cap12-boot-e-roms.md) |
| `C800:0000`–`DFFF:000F` | Outras ROMs de adaptador (passos de 2 KB) | [12](cap12-boot-e-roms.md) |
| `F000:FFF5`–`F000:FFFC` | Data da BIOS (MM/DD/AA) | [1](cap01-o-que-e-a-bios.md) |
| `F000:FFFE` | Byte de modelo | [12](cap12-boot-e-roms.md) |
| `FFFF:0000` | Ponto de partida do processador (reset) | [12](cap12-boot-e-roms.md) |
| `100000H` em diante | Memória estendida (AT, PS/2) | [8](cap08-equipamento-e-memoria.md), [14](cap14-memoria-estendida-modo-protegido.md) |

## D.2 Vetores com função especial

| Vetor | Função | Capítulo |
|---|---|---|
| 00H–04H | Exceções do processador | [2](cap02-vetores-e-excecoes.md) |
| 08H–0FH | IRQ 0–7 | [2](cap02-vetores-e-excecoes.md) |
| 1BH | Ctrl-Break | [6](cap06-teclado.md) |
| 1CH | Gancho do tick | [7](cap07-tempo-e-relogios.md) |
| 1DH, 1EH, 1FH, 41H, 43H, 46H | Ponteiros para tabelas (não são código) | [17](cap17-area-de-dados-da-bios.md) |
| 40H | INT 13H original do disquete, quando há disco fixo | [10](cap10-disco-fixo.md) |
| 4AH | Alarme do RTC | [7](cap07-tempo-e-relogios.md) |
| 70H–77H | IRQ 8–15 (AT, PS/2) | [2](cap02-vetores-e-excecoes.md) |
| 71H | IRQ 9, repassa para a IRQ 2 (INT 0AH) | [18](cap18-compartilhamento-de-irq.md) |
| 75H | IRQ 13, erro do coprocessador, repassa para o NMI | [2](cap02-vetores-e-excecoes.md) |

## D.3 Portas de E/S citadas

| Porta | Uso | Capítulo |
|---|---|---|
| 20H, 21H | 8259A mestre: comando/EOI e máscara (IMR) | [18](cap18-compartilhamento-de-irq.md), Aula 15 |
| 40H–43H | 8253/8254 (PIT) | [7](cap07-tempo-e-relogios.md), Aula 29 |
| 60H | Dados do teclado (scan code) | [6](cap06-teclado.md), Aula 28 |
| 90H | Árbitro do barramento do PS/2 (escrever 00H após NMI) | [2](cap02-vetores-e-excecoes.md) |
| 201H | Joystick | [13](cap13-int15-servicos.md) |
| 278H, 378H, 3BCH | Portas paralelas (valores típicos) | [11](cap11-serial-e-impressora.md) |
| 2F8H, 3F8H | COM2 e COM1 (valores típicos) | [11](cap11-serial-e-impressora.md) |
| 3B4H / 3D4H | CRTC monocromático / colorido | [5](cap05-video-estado-e-deteccao.md) |
| 3C7H, 3C8H, 3C9H | DAC do VGA: índice de leitura, de escrita, dados | [4](cap04-video-paleta-fontes-strings.md), Aula 24 |
