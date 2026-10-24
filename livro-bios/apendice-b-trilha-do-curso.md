---
id: apB
numero: 102
parte: apendices
titulo: "Apêndice B · Trilha de estudo: o curso e o livro lado a lado"
---

# Apêndice B · Trilha de estudo: o curso e o livro lado a lado

O livro foi escrito para acompanhar o curso interativo. Esta trilha diz, aula por aula, o que ler
no livro para aprofundar, e, capítulo por capítulo, quais aulas preparam a leitura.

## B.1 Aula por aula

| Aula | Assunto | Leia no livro |
|---|---|---|
| [0](../conteudo/aula00-bem-vindo.md) | Bem-vindo ao IBM PC | [Cap. 1](cap01-o-que-e-a-bios.md) (seção 1.1), [Cap. 12](cap12-boot-e-roms.md) (12.1, do botão ao boot) |
| [1](../conteudo/aula01-registradores.md) | Os registradores do 8086 | [Cap. 1](cap01-o-que-e-a-bios.md) (1.3, passagem por registradores) |
| [2](../conteudo/aula02-mov-xchg.md) | MOV e XCHG | — |
| [3](../conteudo/aula03-aritmetica.md) | INC, DEC, ADD, SUB, ADC, SBB | [Cap. 14](cap14-memoria-estendida-modo-protegido.md) (somar 24 bits com ADC) |
| [4](../conteudo/aula04-flags.md) | O registrador de FLAGS | [Cap. 8](cap08-equipamento-e-memoria.md) (mapas de bits), [Cap. 11](cap11-serial-e-impressora.md) (bits de status) |
| [5](../conteudo/aula05-cmp-saltos.md) | CMP e saltos condicionais | [Cap. 13](cap13-int15-servicos.md) (13.1, detectar recursos pelo CF) |
| [6](../conteudo/aula06-enderecamento.md) | Modos de endereçamento | [Cap. 17](cap17-area-de-dados-da-bios.md) (17.1, acessar a área de dados) |
| [7](../conteudo/aula07-vetores-loop.md) | Vetores, LOOP, BYTE/WORD PTR | [Cap. 17](cap17-area-de-dados-da-bios.md) (buffer circular do teclado) |
| [8](../conteudo/aula08-pilha.md) | A pilha | [Cap. 15](cap15-mouse-ps2.md) (parâmetros do mouse na pilha) |
| [9](../conteudo/aula09-call-ret.md) | CALL e RET | [Cap. 1](cap01-o-que-e-a-bios.md) (rotinas `imphex8` e `imphex16`) |
| [10](../conteudo/aula10-parametros.md) | Parâmetros, BP e locais | [Cap. 15](cap15-mouse-ps2.md) (moldura `[BP+n]`), [Cap. 4](cap04-video-paleta-fontes-strings.md) (cuidado com BP na `AH=13H`) |
| [11](../conteudo/aula11-recursao.md) | Recursão e programas DOS completos | [Cap. 8](cap08-equipamento-e-memoria.md) (imprimir decimal) |
| [12](../conteudo/aula12-segmentos.md) | Segmentos a fundo | [Cap. 1](cap01-o-que-e-a-bios.md) (notação `40:xx`), [Cap. 8](cap08-equipamento-e-memoria.md) (mapa de memória), [Cap. 9](cap09-disquete.md) (fronteira de 64 KB), [Cap. 14](cap14-memoria-estendida-modo-protegido.md) (além de 1 MB) |
| [13](../conteudo/aula13-strings.md) | Instruções de string | [Cap. 5](cap05-video-estado-e-deteccao.md) (salvar a tela), [Cap. 9](cap09-disquete.md) (copiar a tabela de disquete) |
| [14](../conteudo/aula14-interrupcoes.md) | Interrupções, IVT, DOS e BIOS | [Cap. 1](cap01-o-que-e-a-bios.md), [Cap. 2](cap02-vetores-e-excecoes.md), [Cap. 3](cap03-video-modos-e-texto.md), [Cap. 6](cap06-teclado.md), [Cap. 7](cap07-tempo-e-relogios.md) |
| [15](../conteudo/aula15-isr.md) | Rotinas de interrupção e o timer | [Cap. 2](cap02-vetores-e-excecoes.md) (IRQs e vetores), [Cap. 7](cap07-tempo-e-relogios.md) (INT 08H e 1CH), [Cap. 18](cap18-compartilhamento-de-irq.md) (compartilhar IRQs) |
| [16](../conteudo/aula16-otimizacao1.md) | Otimização 1 | [Cap. 19](cap19-diretrizes-e-compatibilidade.md) (quando ir ao hardware) |
| [17](../conteudo/aula17-otimizacao2.md) | Otimização 2 | [Cap. 3](cap03-video-modos-e-texto.md) (3.9, pixel pela BIOS ou direto), [Cap. 19](cap19-diretrizes-e-compatibilidade.md) |
| [18](../conteudo/aula18-projeto-vetores.md) | Projeto, o analisador de vetores | [Cap. 3](cap03-video-modos-e-texto.md) (janelas e atributos para a interface) |
| [19](../conteudo/aula19-menu-entrada.md) | Menus e entrada de dados | [Cap. 6](cap06-teclado.md) (teclas de função e setas), [Cap. 13](cap13-int15-servicos.md) (erros com CF) |
| [20](../conteudo/aula20-depuracao.md) | Depuração | [Cap. 2](cap02-vetores-e-excecoes.md) (INT 01H e 03H), [Cap. 19](cap19-diretrizes-e-compatibilidade.md) (armadilhas) |
| [21](../conteudo/aula21-calculadora.md) | A calculadora de 32 bits | [Cap. 7](cap07-tempo-e-relogios.md) (ticks em CX:DX), [Cap. 10](cap10-disco-fixo.md) (capacidade em CX:DX) |
| [22](../conteudo/aula22-sinal.md) | Aritmética com sinal | [Cap. 2](cap02-vetores-e-excecoes.md) (INT 00H), [Cap. 15](cap15-mouse-ps2.md) (deslocamentos de 9 bits com sinal) |
| [23](../conteudo/aula23-modo13h.md) | O modo gráfico 13h | [Cap. 3](cap03-video-modos-e-texto.md) (modos, pixels), [Cap. 4](cap04-video-paleta-fontes-strings.md) (fonte da ROM com `AX=1130H`), [Cap. 5](cap05-video-estado-e-deteccao.md) (o modo 13H existe?) |
| [24](../conteudo/aula24-paleta-animacao.md) | Paleta, retraço e animação | [Cap. 4](cap04-video-paleta-fontes-strings.md) (DAC pela BIOS, paginação de cor, cinza) |
| [25](../conteudo/aula25-arquivos.md) | Arquivos com handles | [Cap. 9](cap09-disquete.md) e [Cap. 10](cap10-disco-fixo.md) (o disco visto por baixo) |
| [26](../conteudo/aula26-psp-memoria.md) | PSP, linha de comando e memória | [Cap. 8](cap08-equipamento-e-memoria.md) (INT 12H, EBDA), [Cap. 12](cap12-boot-e-roms.md) (antes do DOS) |
| [27](../conteudo/aula27-tsr.md) | Programas residentes (TSR) | [Cap. 7](cap07-tempo-e-relogios.md) (regras da INT 1CH), [Cap. 13](cap13-int15-servicos.md) (enganchar a INT 15H), [Cap. 16](cap16-multitarefa.md) (o gancho 9002H), [Cap. 18](cap18-compartilhamento-de-irq.md) (cadeias percorríveis) |
| [28](../conteudo/aula28-tsr-teclado.md) | O teclado por dentro | [Cap. 6](cap06-teclado.md) (INT 09H, 4FH, buffer), [Cap. 17](cap17-area-de-dados-da-bios.md) (campos do teclado) |
| [29](../conteudo/aula29-pit-som.md) | O timer 8253 e o alto-falante | [Cap. 7](cap07-tempo-e-relogios.md) (o tick e as esperas), [Cap. 13](cap13-int15-servicos.md) (joystick pela porta 201H) |
| [30](../conteudo/aula30-bcd-ponto-fixo.md) | BCD e ponto fixo | [Cap. 7](cap07-tempo-e-relogios.md) (o RTC fala BCD: `HORA.ASM`) |
| [31](../conteudo/aula31-8087.md) | O coprocessador 8087 | [Cap. 2](cap02-vetores-e-excecoes.md) (o NMI e o 8087), [Cap. 8](cap08-equipamento-e-memoria.md) (detectar o coprocessador) |
| [32](../conteudo/aula32-jogos-fundamentos.md) | Fundamentos de jogos | [Cap. 20](cap20-bios-para-jogos.md), [Cap. 6](cap06-teclado.md) (INT 09H e 16H), [Cap. 7](cap07-tempo-e-relogios.md) (tiques) |
| [33](../conteudo/aula33-cobra.md) | A cobra | [Cap. 20](cap20-bios-para-jogos.md), [Cap. 3](cap03-video-modos-e-texto.md) (texto em B800H) |
| [34](../conteudo/aula34-pong.md) | Pong | [Cap. 20](cap20-bios-para-jogos.md) (INT 09H própria, retraço), [Cap. 6](cap06-teclado.md) |
| [35](../conteudo/aula35-invasores.md) | Invasores do espaço | [Cap. 20](cap20-bios-para-jogos.md), [Cap. 4](cap04-video-paleta-fontes-strings.md) (DAC) |
| [36](../conteudo/aula36-blocos.md) | Blocos que caem | [Cap. 20](cap20-bios-para-jogos.md), [Cap. 6](cap06-teclado.md) (repetição), [Cap. 7](cap07-tempo-e-relogios.md) |
| [37](../conteudo/aula37-paredao.md) | Paredão | [Cap. 20](cap20-bios-para-jogos.md), [Cap. 3](cap03-video-modos-e-texto.md) |
| [38](../conteudo/aula38-sapo.md) | O sapo | [Cap. 20](cap20-bios-para-jogos.md), [Cap. 7](cap07-tempo-e-relogios.md) |
| [39](../conteudo/aula39-labirinto.md) | O labirinto | [Cap. 20](cap20-bios-para-jogos.md) (retraço e tabela de teclas) |
| [40](../conteudo/aula40-boot.md) | O setor de boot | [Cap. 12](cap12-boot-e-roms.md) (INT 19H), [Cap. 9](cap09-disquete.md) (INT 13H), [Cap. 21](cap21-sem-dos-boot-e-kernel.md) |
| [41](../conteudo/aula41-kernel.md) | O kernel e a INT 21h | [Cap. 2](cap02-vetores-e-excecoes.md) (IVT), [Cap. 21](cap21-sem-dos-boot-e-kernel.md), [Cap. 22](cap22-o-dos-por-dentro.md) |
| [42](../conteudo/aula42-arquivos-e-exec.md) | Arquivos e o EXEC | [Cap. 9](cap09-disquete.md), [Cap. 22](cap22-o-dos-por-dentro.md) (FAT12, PSP, EXEC) |
| [43](../conteudo/aula43-shell.md) | O shell | [Cap. 22](cap22-o-dos-por-dentro.md) (COMMAND.COM), [Cap. 7](cap07-tempo-e-relogios.md) (hora do RTC) |
| [44](../conteudo/aula44-utilitarios.md) | Utilitários e o disquete completo | [Cap. 8](cap08-equipamento-e-memoria.md), [Cap. 12](cap12-boot-e-roms.md), [Cap. 21](cap21-sem-dos-boot-e-kernel.md), [Cap. 22](cap22-o-dos-por-dentro.md) |

## B.2 Capítulo por capítulo

| Capítulo | Prepare-se com |
|---|---|
| [1 · O que é a BIOS](cap01-o-que-e-a-bios.md) | Aulas 0, 12, 14 |
| [2 · Vetores e exceções](cap02-vetores-e-excecoes.md) | Aulas 14, 15, 20, 22, 31 |
| [3 · Vídeo I](cap03-video-modos-e-texto.md) | Aulas 12, 14, 23 |
| [4 · Vídeo II](cap04-video-paleta-fontes-strings.md) | Aulas 13, 23, 24 |
| [5 · Vídeo III](cap05-video-estado-e-deteccao.md) | Aulas 23, 24, 27 |
| [6 · Teclado](cap06-teclado.md) | Aulas 14, 19, 28 |
| [7 · Tempo](cap07-tempo-e-relogios.md) | Aulas 15, 27, 29, 30 |
| [8 · Equipamento e memória](cap08-equipamento-e-memoria.md) | Aulas 4, 12, 26 |
| [9 · Disquete](cap09-disquete.md) | Aulas 12, 19, 25 |
| [10 · Disco fixo](cap10-disco-fixo.md) | Aulas 12, 21, 25 |
| [11 · Serial e impressora](cap11-serial-e-impressora.md) | Aulas 4, 14, 29 |
| [12 · Boot e ROMs](cap12-boot-e-roms.md) | Aulas 0, 12, 26 |
| [13 · INT 15H](cap13-int15-servicos.md) | Aulas 14, 19, 27 |
| [14 · Memória estendida](cap14-memoria-estendida-modo-protegido.md) | Aulas 3, 12, 26 |
| [15 · Mouse](cap15-mouse-ps2.md) | Aulas 10, 15, 22, 23 |
| [16 · Multitarefa](cap16-multitarefa.md) | Aulas 15, 27 |
| [17 · Área de dados](cap17-area-de-dados-da-bios.md) | Aulas 12, 14, 28 |
| [18 · Compartilhar IRQs](cap18-compartilhamento-de-irq.md) | Aulas 15, 27 |
| [19 · Diretrizes](cap19-diretrizes-e-compatibilidade.md) | Aulas 16, 17, 20, 29 |
| [20 · A BIOS para jogos](cap20-bios-para-jogos.md) | Aulas 15, 24, 28, 29, 32 |
| [21 · Sem DOS](cap21-sem-dos-boot-e-kernel.md) | Aulas 12, 14, 40, 41 |
| [22 · O DOS por dentro](cap22-o-dos-por-dentro.md) | Aulas 25, 26, 42, 43 |

## B.3 Três roteiros de leitura

**Roteiro 1: junto com o curso (recomendado).** Faça as aulas na ordem e, ao terminar cada uma,
leia as seções indicadas na tabela B.1. Os capítulos 1, 2, 3, 6 e 7 se encaixam a partir da
Aula 14; os demais, a partir da Aula 23.

**Roteiro 2: tela e teclado primeiro.** Para quem quer fazer jogos e programas interativos logo
depois do Módulo 6 do curso: capítulos 1, 3, 6, 7, 4, 5, 17 e 15, e o capítulo 20 junto com o módulo 13 (aulas 32 a 39).

**Roteiro 3: o sistema por dentro.** Para quem terminou o curso e quer entender o PC de baixo
para cima: capítulos 12, 2, 17, 8, 9, 10, 13, 14, 16, 18 e 19, nesta ordem, e depois 21 e 22, junto com as aulas 40 a 44, para construir o próprio sistema.
