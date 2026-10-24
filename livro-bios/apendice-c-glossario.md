---
id: apC
numero: 103
parte: apendices
titulo: "Apêndice C · Glossário"
---

# Apêndice C · Glossário

**A20.** A 21ª linha de endereço (bit 20). Liberada, permite ao 80286 em modo real alcançar os
~64 KB logo acima de 1 MB; a `INT 15H, AH=87H` precisa controlá-la (erro 03H). [Cap. 14](cap14-memoria-estendida-modo-protegido.md)

**A/N (alfanumérico).** Modo de texto: a tela é uma grade de caracteres com atributos. [Cap. 3](cap03-video-modos-e-texto.md)

**APA (*all points addressable*).** Modo gráfico: cada pixel é endereçável. [Cap. 3](cap03-video-modos-e-texto.md)

**Área de dados da BIOS.** Os 256 bytes de `0040:0000` a `0040:00FF` usados pela BIOS como memória
de trabalho. [Cap. 17](cap17-area-de-dados-da-bios.md)

**Atributo.** O byte que acompanha cada caractere em modo texto: piscar, fundo, intensidade e
frente. [Cap. 3](cap03-video-modos-e-texto.md)

**Base 0 / base 1.** Se a contagem começa em 0 ou em 1. Na BIOS o padrão é base 1; trilhas,
cabeças, linhas, colunas e páginas são base 0. [Cap. 1](cap01-o-que-e-a-bios.md)

**BCD.** Decimal codificado em binário: um dígito decimal a cada 4 bits. O RTC usa BCD. [Cap. 7](cap07-tempo-e-relogios.md), Aula 30

**Borda / nível.** Formas de sinalizar uma interrupção: pela transição do sinal (barramento do PC)
ou pelo seu estado (Micro Channel). [Cap. 18](cap18-compartilhamento-de-irq.md)

**Break code / make code.** Código que o teclado envia ao soltar / apertar uma tecla; o *break* é o
*make* com o bit 7 ligado. [Cap. 6](cap06-teclado.md)

**CHS.** Cilindro, cabeça, setor: o endereçamento de disco da `INT 13H`. [Cap. 9](cap09-disquete.md), [Cap. 10](cap10-disco-fixo.md)

**CMOS.** Memória com bateria do AT e do PS/2 que guarda a configuração e o relógio de tempo real.

**CRTC.** Controlador do tubo de raios catódicos (6845 e sucessores): gera a temporização do vídeo;
seu endereço fica em `40:63`. [Cap. 5](cap05-video-estado-e-deteccao.md)

**DAC.** Conversor digital-analógico do vídeo do PS/2: 256 registradores de cor RGB de 6 bits.
[Cap. 4](cap04-video-paleta-fontes-strings.md), Aula 24

**DASD.** *Direct Access Storage Device*: termo da IBM para disquete e disco. [Cap. 9](cap09-disquete.md)

**DCC.** Código de combinação de display: identifica os monitores ligados num PS/2. [Cap. 5](cap05-video-estado-e-deteccao.md)

**DMA.** Acesso direto à memória: o controlador de disquete transfere dados sem a CPU; o buffer não
pode cruzar 64 KB. [Cap. 9](cap09-disquete.md)

**EBDA.** Área de dados estendida da BIOS, reservada no topo da memória convencional dos PS/2.
[Cap. 8](cap08-equipamento-e-memoria.md)

**ECC.** Código de correção de erros do disco fixo; o status 11H indica erro corrigido. [Cap. 10](cap10-disco-fixo.md)

**EOI.** *End of interrupt*: comando ao 8259A que encerra o atendimento de uma IRQ (`OUT 20H,AL`
com `AL=20H`). [Cap. 18](cap18-compartilhamento-de-irq.md), Aula 15

**ESDI.** Interface de disco usada em alguns PS/2; tem formatação própria (`INT 13H, AH=1AH`).
[Cap. 10](cap10-disco-fixo.md)

**GDT.** Tabela global de descritores do modo protegido; a `INT 15H, AH=87H` e `89H` a recebem
em `ES:SI`. [Cap. 14](cap14-memoria-estendida-modo-protegido.md)

**IRQ.** Linha de pedido de interrupção de hardware, entregue pelo 8259A como um vetor. [Cap. 2](cap02-vetores-e-excecoes.md)

**IVT.** Tabela de vetores de interrupção, em `0000:0000` a `0000:03FF`. [Cap. 2](cap02-vetores-e-excecoes.md)

**Macro.** Trecho de fonte com nome que o montador copia no lugar de cada chamada, trocando os
parâmetros, antes de gerar o código. Não existe para a CPU. Aula 45

**Mickey.** Unidade de movimento do mouse (normalmente 1/200 de polegada), usada pela `INT 33H`
(`AX=0BH`). [Cap. 15](cap15-mouse-ps2.md), Aula 47

**Micro Channel.** Barramento dos PS/2 (exceto Model 25 e 30), com interrupções por nível e
configuração por POS. [Cap. 13](cap13-int15-servicos.md), [Cap. 18](cap18-compartilhamento-de-irq.md)

**Modo protegido.** Modo do 80286 em que os segmentos são seletores de descritores e a memória vai
até 16 MB. [Cap. 14](cap14-memoria-estendida-modo-protegido.md)

**NMI.** Interrupção não mascarável (`INT 02H`), usada para erros graves. [Cap. 2](cap02-vetores-e-excecoes.md)

**Overscan.** A borda da tela, fora da área de imagem. [Cap. 4](cap04-video-paleta-fontes-strings.md)

**POS.** *Programmable Option Select*: configuração das placas Micro Channel por software. [Cap. 13](cap13-int15-servicos.md)

**POST.** *Power-On Self Test*: os testes e a inicialização feitos pela BIOS ao ligar. [Cap. 12](cap12-boot-e-roms.md)

**RTC.** Relógio de tempo real com bateria (AT e posteriores). [Cap. 7](cap07-tempo-e-relogios.md)

**Scan code.** Número da tecla física, independente do caractere. [Cap. 6](cap06-teclado.md)

**STRUC.** Diretiva do MASM que descreve um registro: cada campo vira uma constante com o seu
deslocamento. Aula 46

**Teletipo.** Saída "de máquina de escrever": escreve e avança o cursor, interpretando CR, LF,
Backspace e Bell (`INT 10H, AH=0EH`). [Cap. 3](cap03-video-modos-e-texto.md)

**Tick.** Cada interrupção do canal 0 do temporizador, ~18,2 por segundo. [Cap. 7](cap07-tempo-e-relogios.md)

**TSR.** Programa residente (*terminate and stay resident*). Aulas 27 e 28, [Cap. 13](cap13-int15-servicos.md), [Cap. 16](cap16-multitarefa.md)

**Typematic.** Repetição automática de uma tecla mantida pressionada. [Cap. 6](cap06-teclado.md)

**Watchdog.** Temporizador do PS/2 que gera NMI se a interrupção do timer deixar de ser atendida.
[Cap. 13](cap13-int15-servicos.md)
