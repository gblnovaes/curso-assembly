---
id: cap19
numero: 19
parte: 6
titulo: "Diretrizes para aplicações compatíveis"
aulas: aula16; aula17; aula20; aula29
---

# Capítulo 19 · Diretrizes para aplicações compatíveis

> **Neste capítulo:** as recomendações finais do manual da IBM para que um programa funcione em
> todos os modelos, reunidas com as lições práticas espalhadas pelo livro e transformadas numa
> lista de verificação para os seus projetos do curso.
>
> **Antes de ler:** [Aula 16](../conteudo/aula16-otimizacao1.md) e
> [Aula 17](../conteudo/aula17-otimizacao2.md) (otimização: quando vale a pena ir direto ao
> hardware) e [Aula 20, Depuração](../conteudo/aula20-depuracao.md).

## 19.1 As diretrizes do manual

- Use a **BIOS** (ou o sistema operacional) como interface de hardware sempre que possível; isso
  garante portabilidade entre modelos.
- Para tempos precisos, use as interfaces do sistema operacional ou da linguagem (como `TIME$`
  em BASIC); **laços de contagem dependem da velocidade da CPU** e quebram em máquinas mais
  rápidas.
- As linguagens suportadas pela IBM na época (C, BASIC, FORTRAN, COBOL, Pascal) eram a melhor
  escolha para programas compatíveis.
- **Tabelas de parâmetros** (vídeo, disquete): não altere a da ROM; **copie** a tabela, modifique
  a cópia e aponte o vetor correspondente (por exemplo, `INT 1EH`, em `0000:0078H`) para ela.
- Os suplementos no fim do manual podem alterar o que está nas outras partes: leia-os antes de
  decidir.

## 19.2 BIOS, DOS ou hardware: como escolher

As Aulas 23, 24, 28 e 29 vão direto ao hardware (memória de vídeo, portas do DAC, porta 60H, PIT).
O manual recomenda o contrário. As duas posições se conciliam assim:

| Use o DOS quando… | Use a BIOS quando… | Vá ao hardware quando… |
|---|---|---|
| o recurso tem serviço do DOS (arquivos, console redirecionável, memória, data e hora) | não há DOS (setor de boot), o DOS não pode ser chamado (dentro de uma ISR ou TSR) ou o DOS não oferece o serviço (vídeo, teclado detalhado, disco por setor) | a BIOS é lenta demais para o que você precisa (gráficos, animação, som, E/S serial rápida) **e** você detectou antes que o hardware é o esperado |

O terceiro caso é legítimo, e foi como os jogos e demos dos anos 90 conseguiram o que conseguiram.
A condição é **detectar antes** (Capítulos 5, 8 e 12) e oferecer um caminho alternativo quando o
hardware não é o esperado.

## 19.3 Lista de verificação de compatibilidade

**Ao iniciar**

- [ ] Inicialize `DS` com `MOV AX,@DATA` / `MOV DS,AX` (Aula 11) antes de qualquer variável.
- [ ] Guarde o modo de vídeo atual (`INT 10H, AH=0FH`) para restaurá-lo na saída.
- [ ] Detecte o que vai usar: adaptador de vídeo (Capítulo 5), coprocessador (`INT 11H`, bit 1),
      mouse, memória estendida, recursos da `INT 15H` (`C0H`).
- [ ] Ao enganchar um vetor, guarde o antigo **antes** de trocar e troque com interrupções
      desligadas (ou por `INT 21H, AH=25H`).

**Durante**

- [ ] Não suponha que AX, os flags ou os registradores de retorno sobrevivem a uma `INT`.
- [ ] Teste `CF` depois de cada serviço que o documenta como indicador de erro.
- [ ] Tente de novo, com reset, nos erros de disco (até 3 vezes).
- [ ] Meça tempo com o contador de ticks, a `INT 1CH`, a `INT 15H, AH=86H` ou o PIT, nunca com
      laços vazios.
- [ ] Dentro de rotinas de interrupção: curto, sem DOS, variáveis com `CS:`, preserve tudo.
- [ ] Cuide da fronteira de 64 KB em buffers de DMA (disquete e disco).

**Ao sair**

- [ ] Restaure todos os vetores que alterou (incluindo `INT 1BH`, `INT 1CH`, `INT 1EH` e
      `INT 23H`, se mexeu neles).
- [ ] Restaure o modo de vídeo, a paleta (se desabilitou a carga padrão com `AH=12H, BL=31H`) e o
      formato do cursor.
- [ ] Desabilite e desinstale a rotina do mouse (`INT 15H, AH=C2H`).
- [ ] Termine com `INT 21H, AH=4CH` e um código de retorno.

## 19.4 Armadilhas recorrentes, por capítulo

| Armadilha | Consequência | Onde |
|---|---|---|
| `SHR AX,6` ou `PUSH 1234H` | não existem no 8086; num PC original os bytes viram outra instrução e o programa se perde | [1](cap01-o-que-e-a-bios.md), [8](cap08-equipamento-e-memoria.md) |
| Esquecer que `AH=09H/0AH` da `INT 10H` não move o cursor | texto sobreposto num único lugar | [3](cap03-video-modos-e-texto.md) |
| String da `AH=13H` em DS:SI em vez de ES:BP | lixo na tela | [4](cap04-video-paleta-fontes-strings.md) |
| Carregar fonte longe do *set mode* | resultado imprevisível no EGA | [4](cap04-video-paleta-fontes-strings.md) |
| Ler a `INT 1AH, AH=00H` e ignorar `AL` | o DOS perde a virada da meia-noite | [7](cap07-tempo-e-relogios.md) |
| Chamar o DOS dentro da `INT 1CH`, `INT 4AH` ou da rotina do mouse | travamentos aleatórios | [7](cap07-tempo-e-relogios.md), [15](cap15-mouse-ps2.md) |
| Buffer de disquete atravessando 64 KB | erro 09H em algumas máquinas e não em outras | [9](cap09-disquete.md) |
| Tratar o erro 11H do disco como falha | dados bons descartados | [10](cap10-disco-fixo.md) |
| Ler o bit 7 do status da impressora como "ocupada" | lógica invertida | [11](cap11-serial-e-impressora.md) |
| Não fazer `STC` antes de uma `INT 15H` que pode não existir | "sucesso" falso em máquinas antigas ou em tratadores incompletos | [13](cap13-int15-servicos.md) |
| Copiar blocos grandes com `AH=87H` | interrupções perdidas (relógio atrasa, teclado falha) | [14](cap14-memoria-estendida-modo-protegido.md) |
| Usar `SHR` nos deslocamentos do mouse | movimento para a esquerda e para cima vira salto enorme | [15](cap15-mouse-ps2.md) |
| Esquecer de limpar a causa da IRQ no Micro Channel | sistema preso na mesma interrupção | [18](cap18-compartilhamento-de-irq.md) |

## 19.5 Onde testar

O simulador do curso cobre a parte da BIOS que as aulas usam (o [Apêndice A](apendice-a-referencia-rapida.md)
marca cada função). Para o restante:

- **DOSBox**: rápido e simples; implementa boa parte da BIOS de um AT com VGA, incluindo a
  `INT 15H, AH=87H/88H`, disquetes e discos em imagens.
- **86Box e PCem**: emulam máquinas específicas (PC, XT, AT, PS/2) com as BIOS originais; ideais
  para conferir diferenças entre modelos e datas de BIOS descritas neste livro.
- **Um PC real** dos anos 80 ou 90, se você tiver um: nada substitui ouvir o disquete.

## Resumo

- Prefira o DOS e a BIOS; vá ao hardware só com detecção prévia e caminho alternativo.
- Copie tabelas de parâmetros antes de alterar e devolva vetores e modos ao sair.
- Meça tempo com o relógio do sistema, nunca com laços.
- Use a lista de verificação da seção 19.3 em cada projeto.
