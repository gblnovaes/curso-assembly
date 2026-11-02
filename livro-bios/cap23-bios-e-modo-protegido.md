---
id: cap23
numero: 23
parte: 8
titulo: "A BIOS depois do modo protegido (o mapa E820 e a linha A20)"
---

# Capítulo 23 · A BIOS depois do modo protegido

> **Neste capítulo:** o que acontece com todas as `INT` deste livro quando o processador sai do modo
> real; as quatro estratégias que os sistemas usam para continuar a enxergar a BIOS; a receita do
> que **coletar antes** de entrar no modo protegido; o mapa de memória da `INT 15H, AX=E820H`, que
> substitui o `AH=88H` do [Capítulo 14](cap14-memoria-estendida-modo-protegido.md); e as três
> maneiras de liberar a linha **A20**.
>
> **Antes de ler:** [Capítulo 8](cap08-equipamento-e-memoria.md) (`INT 12H` e `INT 15H, AH=88H`),
> [Capítulo 14](cap14-memoria-estendida-modo-protegido.md) e, da trilha avançada,
> [Aula 56, A20 e a HMA](../conteudo-386/aula56-a20-hma.md),
> [Aula 62, Entrando no modo protegido](../conteudo-386/aula62-entrando-pm.md) e
> [Aula 63, Segmentos e a volta ao modo real](../conteudo-386/aula63-segmentos-e-volta.md).
>
> **Sintaxe desta parte:** os capítulos 23 e 24 acompanham a trilha avançada: usam o montador
> **NASM** e instruções do 386, e os blocos ` ```nasm ` rodam na máquina 386 do curso. As partes I a
> VII continuam em MASM/TASM e 8086.

## 23.1 O que muda quando você sai do modo real

Toda a BIOS deste livro é código de **modo real de 16 bits**. Ela foi escrita para ser chamada por
`INT n`, e o `INT n` do modo real faz uma coisa específica: lê o vetor `n` da **IVT** (a tabela de
256 endereços `segmento:offset` que começa em `0000:0000`) e salta para lá.

No modo protegido isso desaparece, por três motivos:

1. **A IVT deixa de existir.** `INT n` passa a consultar a **IDT**, cuja base está no `IDTR`. As
   entradas da IDT são *gates* de 8 bytes, não endereços `segmento:offset`, e quem as preenche é o
   seu sistema operacional.
2. **Os números colidem.** Os vetores `00H` a `1FH` pertencem às **exceções** da CPU. Uma `INT 10H`
   (vídeo) cairia no vetor 16, que é o erro do coprocessador (`#MF`); `INT 13H` (disco) é o vetor 19
   (`#XM`); e os vetores `08H` a `0FH` da IRQ0 a IRQ7 coincidem com a falha dupla (`08H`), a falha
   de proteção geral (`0DH`) e a falha de página (`0EH`). É por isso que o 8259 é **remapeado** para `20H` ou mais (veja
   a [Aula 67](../conteudo-386/aula67-pic-irq.md)).
3. **O código da BIOS não roda.** Os registradores de segmento viraram seletores, o tamanho
   de operando padrão é de 32 bits e o código da ROM usa `segmento × 16 + offset`. Saltar para ele
   com a CPU em modo protegido executa lixo.

A conclusão prática: **a BIOS não é uma biblioteca que acompanha o programa para o modo
protegido**. Você precisa decidir o que fazer com ela antes de sair.

## 23.2 Quatro estratégias

```
 estratégia                      como funciona                              quem usa
 ─────────────────────────────────────────────────────────────────────────────────────────────
 1  coletar antes                chamar a BIOS ainda em modo real, guardar  carregadores de boot,
                                 os resultados e só então entrar no PM      a parte inicial do Linux
 2  voltar ao modo real          sair do PM, chamar a BIOS, entrar de novo  extensores de DOS sem
                                 (lento, desliga as interrupções do PM)     gerenciador, OS/2 1.x no 286
 3  modo virtual 8086 (v86)      rodar a BIOS dentro de um v86 sob um       Windows 3.x e 9x, EMM386,
                                 monitor do kernel (Aulas 77 a 79)          vm86() do Linux
 4  nunca usar a BIOS            drivers próprios para o disco, o vídeo     todos os sistemas atuais,
                                 e o teclado                                 depois da inicialização
```

Os sistemas reais combinam as estratégias: o carregador **coleta** (1) o que o kernel precisa saber
e entrega em uma estrutura; o kernel então usa **drivers próprios** (4) o tempo todo. As estratégias
2 e 3 existem para quem precisa continuar a rodar programas de DOS dentro de um sistema protegido
(a [Aula 79](../conteudo-386/aula79-com-v86.md) faz isso com um `.COM`).

## 23.3 A receita: o que coletar antes

Estas são as perguntas que um carregador faz à BIOS, em modo real, antes de saltar para o kernel:

| Pergunta | Serviço | Capítulo |
|---|---|---|
| Quanta memória, e onde há buracos? | `INT 15H, AX=E820H` (mapa); senão `E801H`; senão `AH=88H` | este, 8 |
| Qual modo de vídeo, e onde fica o *framebuffer*? | `INT 10H, AX=4F00H`, `4F01H`, `4F02H` (VBE) | [3](cap03-video-modos-e-texto.md), [5](cap05-video-estado-e-deteccao.md) |
| Qual a geometria e o tamanho do disco? | `INT 13H, AH=08H`; `AH=41H`/`48H` (extensões LBA) | [9](cap09-disquete.md), [10](cap10-disco-fixo.md) |
| De que disco eu vim? | o `DL` que a BIOS entrega ao setor de boot | [21](cap21-sem-dos-boot-e-kernel.md) |
| Que portas e equipamentos existem? | a área de dados da BIOS (`0040:0000`) e `INT 11H` | [17](cap17-area-de-dados-da-bios.md), [8](cap08-equipamento-e-memoria.md) |
| Onde estão as tabelas do ACPI? | procurar `"RSD PTR "` na EBDA e em `E0000H` a `FFFFFH` | [24](cap24-uefi-acpi-pc-moderno.md) |

Tudo isso é pedido com `INT`, então só funciona **antes** de ligar o `CR0.PE`. O kernel recebe o
resultado em memória (no Linux, uma estrutura chamada *boot params*).

## 23.4 INT 15H, AX = E820H · O mapa de memória

O `AH=88H` do [Capítulo 8](cap08-equipamento-e-memoria.md) devolve um número só (os KB acima de 1 MB)
e para em cerca de 64 MB. O `AX=E801H` chega a uns 4 GB, mas continua devolvendo dois números. Nenhum
dos dois consegue dizer que existe um **buraco** no meio da memória: a região de `0A0000H` a
`0FFFFFH` (vídeo e ROMs), a memória de dispositivos PCI logo abaixo de 4 GB, as áreas do ACPI. O
`E820H` devolve uma **lista de intervalos**, cada um com o seu tipo.

**Entrada:** `EAX` = `0000E820H`; `EDX` = `534D4150H` (as letras `"SMAP"`); `EBX` = 0 na primeira
chamada e, depois, o valor que a BIOS devolveu; `ECX` = tamanho do buffer (pelo menos 20; 24 se você
aceita o campo extra); `ES:DI` → o buffer.

**Retorno:** `CF = 0` e `EAX` = `"SMAP"` de novo; `ECX` = bytes gravados; `EBX` = o cursor para a próxima
chamada, ou **0** se esta foi a última entrada. `CF = 1` indica fim da lista (ou BIOS sem suporte).

Cada entrada é uma estrutura de 20 bytes (24 com o campo extra do ACPI 3.0):

| Offset | Tamanho | Campo |
|---|---|---|
| 0 | 8 bytes | Endereço-base |
| 8 | 8 bytes | Tamanho do intervalo em bytes |
| 16 | 4 bytes | **Tipo** (tabela abaixo) |
| 20 | 4 bytes | Atributos estendidos do ACPI 3.0 (só nas entradas de 24 bytes) |

| Tipo | Nome | O que o sistema operacional faz |
|---|---|---|
| 1 | Memória livre | pode usar |
| 2 | Reservada | não toca (ROMs, EBDA, memória de dispositivos) |
| 3 | ACPI, recuperável | pode usar depois de ler as tabelas do ACPI |
| 4 | ACPI NVS | não toca; o firmware a usa em suspensão e hibernação |
| 5 | Defeituosa | não usa |

> **Atenção:** a lista **não vem ordenada** e as entradas **podem se sobrepor**; quando duas se
> sobrepõem, vale a mais restritiva. Um sistema de verdade ordena e funde as entradas antes de
> entregar a memória ao alocador de páginas.

O programa abaixo chama o `E820H` em laço e escreve o tipo de cada entrada na porta de depuração
`E9H` (a "Saída" do painel do simulador).

```nasm executar modo="boot" titulo="E820.BIN: lista os tipos do mapa de memória da BIOS"
        bits 16
        org 7C00h

inicio:
        xor  ax, ax
        mov  ds, ax
        mov  es, ax
        mov  ss, ax
        mov  sp, 7C00h
        xor  ebx, ebx               ; continuação: 0 na primeira chamada
.proxima:
        mov  di, entrada            ; ES:DI = onde a BIOS grava a entrada
        mov  eax, 0xE820
        mov  edx, 0x534D4150        ; "SMAP"
        mov  ecx, 24                ; tamanho do buffer
        int  15h
        jc   .fim                   ; CF = 1: sem suporte, ou a lista acabou
        cmp  eax, 0x534D4150        ; a BIOS devolve "SMAP" em EAX
        jne  .fim
        mov  al, [entrada+16]       ; tipo: 1 = livre, 2 = reservada...
        add  al, '0'
        out  0E9h, al
        mov  al, 10
        out  0E9h, al
        test ebx, ebx               ; EBX = 0 depois da última entrada
        jnz  .proxima
.fim:
        cli
        hlt

entrada: times 24 db 0
        times 510-($-$$) db 0
        dw 0xAA55
```

Um carregador faz primeiro o `E820H`; se a BIOS não o suporta (`CF = 1` já na primeira chamada), tenta
o `E801H` e, por último, o `AH=88H`. O Linux e o GRUB usam exatamente essa escada.

## 23.5 A linha A20, outra vez

O [Capítulo 14](cap14-memoria-estendida-modo-protegido.md) citou a A20 de passagem, e a
[Aula 56](../conteudo-386/aula56-a20-hma.md) explica a história: o PC AT trouxe um gate na 21ª
linha de endereço para que os programas antigos continuassem a dar a volta de `FFFF:0010` em
`0000:0000`. Para usar qualquer endereço acima de 1 MB, o carregador precisa **liberar** o gate. Há
três caminhos, e um carregador cuidadoso tenta um depois do outro, conferindo o resultado:

```nasm fragmento titulo="Três maneiras de liberar a A20"
; 1) Pela BIOS (nem todas têm)
        mov  ax, 2401h          ; 2400h desliga, 2401h liga, 2402h consulta, 2403h informa o suporte
        int  15h                ; CF = 0 e AH = 0 em caso de sucesso

; 2) Pela porta 92h ("Fast A20", nas placas que a têm)
        in   al, 92h
        or   al, 2              ; bit 1 liga a A20
        and  al, 0FEh           ; NUNCA deixe o bit 0 em 1: ele reinicia o PC
        out  92h, al

; 3) Pelo controlador de teclado 8042 (o método original do AT)
;    espera o buffer de entrada esvaziar, comando D1h na porta 64h (escrever a porta de saída),
;    depois o byte DFh na porta 60h (liga a A20), e espera de novo
```

Depois de liberar, **teste**: grave um valor em `0000:0500` e outro em `FFFF:0510` (que é o endereço
`100500H` com a A20 ligada). Se os dois valores forem diferentes, a A20 está mesmo ligada.

## 23.6 No simulador do curso

- O simulador da trilha avançada é um 386 com uma BIOS mínima. Os modos `com` e `boot` entregam a
  `INT 15H` com `AH=88H`, `AX=E801H`, **`AX=E820H`** e o grupo `AX=2400H` a `2403H` da A20.
- O mapa de memória que ele devolve tem **quatro entradas**: `0` a `9FC00H` (livre), os 1 KB da EBDA
  (reservada), `F0000H` (64 KB de ROM, reservada) e tudo de `100000H` em diante (livre). Por isso
  o programa da seção 23.4 escreve `1`, `2`, `2` e `1`.
- Uma diferença importante com os PCs de verdade: a A20 **começa desligada** no simulador. Os PCs
  modernos já a entregam ligada pela BIOS, mas você não pode contar com isso nos antigos.
- Os modos `com` e `boot` rodam em modo real; os exemplos em modo protegido da trilha começam
  em `pm32`, que simula o estado em que um carregador como o GRUB entrega o controle.

## 23.7 Exercícios

1. Altere o `E820.BIN` para imprimir também o **primeiro byte do tamanho** (`entrada+8`) em
   hexadecimal. Qual é o tamanho da última entrada, em KB?
2. Escreva uma rotina que percorre o mapa e soma os tamanhos das entradas do tipo 1, deixando o
   total em `EAX`. Por que somar só 32 bits pode dar errado em máquinas com mais de 4 GB?
3. Um mapa tem as entradas livres `[0, 9FC00H)` e `[100000H, 800000H)`, mais uma reservada
   `[F0000H, 100000H)`. Quantos KB de memória livre existem? E quantos o `INT 15H, AH=88H` devolve?
4. Por que a `INT 13H` não pode ser chamada a partir de um kernel de 32 bits com a paginação ligada,
   mesmo que ele tenha uma entrada na IDT para o vetor `13H`?
5. Escreva o teste da A20 descrito na seção 23.5 para o modo real. Execute-o no simulador antes
   e depois de chamar `INT 15H, AX=2401H`.

## Resumo

- A BIOS é código de **modo real**: no modo protegido a IVT some, os vetores `00H` a `1FH` pertencem às
  exceções da CPU e o código da ROM não executa. Decida o que fazer com ela **antes** de sair.
- Os sistemas **coletam** informação da BIOS em modo real (mapa de memória, vídeo, discos, ACPI),
  entregam ao kernel numa estrutura e passam a usar **drivers próprios**; o v86 e a volta ao modo real
  servem para código antigo.
- O **`INT 15H, AX=E820H`** devolve uma lista de intervalos de memória com tipo (1 livre, 2 reservada,
  3 ACPI recuperável, 4 ACPI NVS, 5 defeituosa); a lista não é ordenada e pode se sobrepor. A escada
  de reserva é `E820H`, `E801H`, `AH=88H`.
- A **A20** pode ser liberada pela BIOS (`AX=2401H`), pela porta `92H` (sem nunca ligar o bit 0) ou
  pelo controlador de teclado; confira o resultado com um teste de gravação.
