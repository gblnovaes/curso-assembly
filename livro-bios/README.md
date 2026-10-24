# A BIOS do IBM PC e do PS/2: guia de referência e tutorial

**Livro de apoio ao Curso Interativo de Assembly 8086**

Interfaces de software da BIOS: interrupções, áreas de dados, tabelas e boas práticas, explicadas
para quem está aprendendo Assembly do 8086 em sintaxe MASM/TASM.

> **Origem.** Este livro reorganiza e amplia um guia de estudo em português escrito de forma
> independente a partir do manual técnico *Personal System/2 and Personal Computer BIOS
> Interface Technical Reference* (IBM, 1ª edição, abril de 1987). Não é uma tradução: o texto é
> explicativo, e os fatos técnicos do manual (números de interrupção, registradores, endereços,
> códigos) foram mantidos. O livro acrescenta explicações, programas completos, ligações com as
> aulas do curso, notas sobre o simulador e exercícios. Algumas subfunções raras do manual não
> constavam do material de origem; onde isso acontece, o texto avisa. Para tabelas completas e
> casos de borda, consulte sempre o manual original.

## Como usar este livro

- **Como referência:** o [Apêndice A](apendice-a-referencia-rapida.md) tem uma linha por função,
  com o capítulo onde ela é explicada; o [Apêndice D](apendice-d-indice-de-enderecos.md) indexa
  endereços, vetores e portas.
- **Como tutorial, junto com o curso:** o [Apêndice B](apendice-b-trilha-do-curso.md) diz o que ler
  depois de cada aula. Cada capítulo começa com "Antes de ler", apontando as aulas que o preparam,
  e termina com exercícios e um resumo.
- **No laboratório:** os programas completos (blocos com `.MODEL` e `END`) podem ser colados no
  laboratório do curso. A seção "No simulador do curso" de cada capítulo diz o que roda lá e o que
  precisa de um PC real ou de um emulador (DOSBox, 86Box, PCem).

## Sumário

### Parte I · Fundamentos

1. [O que é a BIOS e como conversar com ela](cap01-o-que-e-a-bios.md): `INT n`, registradores,
   regras de preservação, versão da BIOS, grupos de sistemas, rotinas `imphex8`/`imphex16`.
2. [O mapa de interrupções, as exceções, o NMI e o Print Screen](cap02-vetores-e-excecoes.md):
   a IVT completa, INT 00H a 05H, IRQs e vetores.

### Parte II · Tela e teclado

3. [Vídeo I: modos, cursor, caracteres e pixels](cap03-video-modos-e-texto.md): `INT 10H`,
   AH = 00H a 0FH, atributos de texto.
4. [Vídeo II: paleta, DAC, fontes, seleções alternativas e strings](cap04-video-paleta-fontes-strings.md):
   AH = 10H a 13H, 512 caracteres, 43/50 linhas.
5. [Vídeo III: estado, salvar/restaurar e detecção do adaptador](cap05-video-estado-e-deteccao.md):
   AH = 14H a 1CH, DCC, receita de detecção, troca mono/cor.
6. [O teclado: INT 09H, INT 16H, Ctrl-Break e scan codes](cap06-teclado.md): buffer circular,
   funções clássicas e estendidas, `INT 15H, AH=4FH`.

### Parte III · Tempo

7. [Tempo: o temporizador, os relógios e as esperas](cap07-tempo-e-relogios.md): INT 08H, 1CH,
   1AH, 70H, 4AH; `INT 15H, AH=83H/86H`; o RTC em BCD.

### Parte IV · Equipamento, discos e periféricos

8. [Equipamento, memória e identificação do sistema](cap08-equipamento-e-memoria.md): INT 11H,
   12H; `INT 15H, AH=88H/C0H/C1H`; EBDA.
9. [Disquete](cap09-disquete.md): `INT 13H` com DL < 80H, status, fronteira de DMA, tabela da
   `INT 1EH`, tipo de mídia.
10. [Disco fixo](cap10-disco-fixo.md): `INT 13H` com DL ≥ 80H, CHS de 10 bits, ECC, `INT 41H/46H`.
11. [Comunicação serial e impressora](cap11-serial-e-impressora.md): INT 14H e INT 17H.
12. [Inicialização, ROMs de adaptadores e identificação do sistema](cap12-boot-e-roms.md): POST,
    ROMs `55H AAH`, INT 19H, INT 18H, `40:72`, bytes de modelo.

### Parte V · Serviços do sistema (INT 15H)

13. [INT 15H: a caixa de ferramentas do sistema](cap13-int15-servicos.md): detecção de recursos,
    cassete, ESDI, PC Convertible, joystick, *watchdog*, POS.
14. [Memória estendida e modo protegido](cap14-memoria-estendida-modo-protegido.md): `AH=87H` e
    `89H`.
15. [O mouse do PS/2](cap15-mouse-ps2.md): `AH=C2H` e a rotina de pacotes.
16. [Multitarefa: os avisos de espera e de conclusão](cap16-multitarefa.md): `AH=90H/91H`.

### Parte VI · Dados da BIOS e boas práticas

17. [A área de dados da BIOS, a EBDA e as tabelas em ROM](cap17-area-de-dados-da-bios.md).
18. [Compartilhamento de interrupções](cap18-compartilhamento-de-irq.md).
19. [Diretrizes para aplicações compatíveis](cap19-diretrizes-e-compatibilidade.md): lista de
    verificação e armadilhas.

### Parte VII · Tópicos avançados: jogos e sistemas

20. [A BIOS para jogos](cap20-bios-para-jogos.md): tiques e retraço, teclado sem esperar e INT 09H
    própria, vídeo direto em B800H e A000H, som pelo PIT sem travar, e o que cada jogo do curso usa.
21. [Sem DOS: o setor de boot e o kernel](cap21-sem-dos-boot-e-kernel.md): INT 19H, 0000:7C00,
    INT 13H na prática (LBA, CHS, novas tentativas), carregar e saltar, vetores e o mapa do MINIOS.
22. [O DOS por dentro (e o MINIOS)](cap22-o-dos-por-dentro.md): IO.SYS, MSDOS.SYS e COMMAND.COM,
    FAT12, PSP, EXEC, INT 20H a 2FH e a comparação função a função com o MINIOS.

### Apêndices

- [A · Referência rápida de todas as funções](apendice-a-referencia-rapida.md)
- [B · Trilha de estudo: o curso e o livro lado a lado](apendice-b-trilha-do-curso.md)
- [C · Glossário](apendice-c-glossario.md)
- [D · Índice de endereços, vetores e portas](apendice-d-indice-de-enderecos.md)

## Convenções

- `AH=nnH` é a função; quando há subfunção, ela vai em `AL` ou `BL`, como cada capítulo indica.
- `CF` é o *carry flag*; `CF = 1` no retorno costuma indicar erro, quando o texto diz.
- Endereços `40:xx` significam segmento `0040H`, offset `00xxH` (as aulas escrevem `0040:00xxh`).
- Números terminados em `H` são hexadecimais, como em MASM/TASM.
- **Base 1** é o padrão para contagens e índices; **base 0** só quando informado.
- Nomes de modelos: PC, PC XT, PC AT, XT 286, PCjr, PC Convertible, PS/2 (e "Model 30" quando é
  exceção). "AT e posteriores" inclui XT 286 e PS/2.
- Código: só instruções reais do 8086, sintaxe MASM/TASM. Deslocamentos de mais de um bit usam
  `CL`; nada de `PUSH` imediato, `SHL reg,n` ou outras formas do 80186 em diante. Blocos marcados
  `fragmento` são trechos para leitura; os demais são programas completos que montam no montador
  do curso.

## Formato dos arquivos

Cada capítulo é um arquivo Markdown `capNN-assunto.md` com um cabeçalho igual ao das aulas
(`id`, `numero`, `parte`, `titulo`, `aulas`), para facilitar a integração futura com o aplicativo
do curso. Os links para as aulas são relativos (`../conteudo/aulaNN-*.md`); os blocos de código
usam a mesma marcação das aulas (` ```asm ` com `titulo="..."` e `fragmento`).

## Correspondência com o guia de origem

| Arquivo de origem | Onde está agora |
|---|---|
| `00_capa.md` | este README |
| `01_introducao_e_interrupcoes_basicas.md` | Capítulos 1, 2, 6 (INT 09H) e 7 (INT 08H) |
| `02_int10h_video_parte1.md` | Capítulo 3 |
| `03_int10h_video_parte2.md` | Capítulo 4 |
| `04_int10h_parte3_int11h_int12h.md` | Capítulos 5 e 8 |
| `05_int13h_disquete.md` | Capítulo 9 |
| `06_int13h_disco_fixo.md` | Capítulo 10 |
| `07_int14h_serial.md` | Capítulo 11 |
| `08_int15h_parte1.md` | Capítulos 13, 6 (4FH) e 7 (83H) |
| `09_int15h_parte2_memoria_estendida_e_multitarefa.md` | Capítulos 6 (85H), 7 (86H), 8 (88H), 14 e 16 |
| `10_int15h_parte3_configuracao_mouse.md` | Capítulos 8 (C0H, C1H), 13 (C3H, C4H) e 15 |
| `11_int16h_a_int70h_teclado_impressora_boot_relogio.md` | Capítulos 6, 11, 12 e 7 |
| `12_secao3_areas_de_dados_e_tabelas.md` | Capítulo 17 (e as tabelas nos Capítulos 9 e 10) |
| `13_secao4_informacoes_adicionais.md` | Capítulos 18, 12, 5, 16, 19, 9 e 6 |
