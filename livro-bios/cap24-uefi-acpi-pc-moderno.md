---
id: cap24
numero: 24
parte: 8
titulo: "Depois da BIOS: UEFI, ACPI e o PC moderno"
---

# Capítulo 24 · Depois da BIOS: UEFI, ACPI e o PC moderno

> **Neste capítulo:** por que a BIOS foi substituída; como o **UEFI** inicia a máquina e entrega o
> controle ao sistema operacional; o disco **GPT** e a partição **ESP**; uma tabela que diz, para cada
> serviço `INT` deste livro, o que o substituiu; o **ACPI** e as suas tabelas; e o que acontece com os
> programas de modo real quando a máquina não tem mais modo real para oferecer.
>
> **Antes de ler:** [Capítulo 12](cap12-boot-e-roms.md) (POST, ROMs e `INT 19H`),
> [Capítulo 23](cap23-bios-e-modo-protegido.md) e, da trilha avançada,
> [Aula 90, APIC e MSRs](../conteudo-386/aula90-apic-msr.md) e
> [Aula 91, O modo de 64 bits e o UEFI](../conteudo-386/aula91-64-bits-uefi.md).
>
> **Aviso:** o simulador do curso é uma máquina com **BIOS**. Não há firmware UEFI nele; este
> capítulo é de leitura, para você saber o que existe do outro lado.

## 24.1 Por que a BIOS foi aposentada

A BIOS descrita neste livro nasceu em 1981 e foi remendada por mais de trinta anos. Os remendos
mostram os limites do projeto:

- **Tudo é de 16 bits em modo real.** O código de inicialização, as ROMs dos adaptadores e os
  serviços `INT` precisam caber em 1 MB, com segmentos de 64 KB.
- **Cada fabricante inventou o seu jeito.** As extensões do disco (`INT 13H, AH=42H`), do vídeo
  (VBE), do mouse e da memória (`E820H`) apareceram uma a uma, sem uma especificação única.
- **O MBR tem limites duros.** A tabela de partições do setor 0 cabe 4 partições, e os campos de
  setor têm 32 bits: com setores de 512 bytes, o disco máximo é de **2 TiB**.
- **O programa de boot é um setor de 512 bytes.** Qualquer coisa mais sofisticada, como um menu, um
  sistema de arquivos ou uma interface de rede, precisa de um segundo estágio escrito às cegas.

O **UEFI** (*Unified Extensible Firmware Interface*) nasceu como EFI, um projeto da Intel para o
Itanium, e desde 2005 é mantido pelo UEFI Forum. Ele é uma especificação **única**, em vez de uma
coleção de convenções.

## 24.2 Como o UEFI inicia a máquina

O firmware passa por fases bem definidas, bem diferentes do "POST e `INT 19H`" da BIOS:

```
 SEC   liga o núcleo, encontra a memória cache e a usa como RAM temporária
  │
 PEI   inicializa a RAM de verdade e as peças mínimas do chipset
  │
 DXE   carrega os drivers (disco, USB, vídeo, rede) e publica os serviços
  │
 BDS   o gerenciador de boot: lê as variáveis Boot0000, BootOrder... da NVRAM
  │    e escolhe o que carregar
 TSL   o carregador do sistema (GRUB, bootmgfw.efi...) roda e chama ExitBootServices()
  │
 RT    o sistema operacional é dono da máquina; só os "serviços de execução" continuam
```

O ponto principal: **o firmware já entrega a CPU em modo de 64 bits** (nos x86-64) com a paginação
ligada, e entrega ao carregador uma tabela de funções (`EFI_SYSTEM_TABLE`), no lugar de vetores de
interrupção. O programa carregado é um executável **PE/COFF**, o mesmo formato do Windows, e não
um setor binário.

## 24.3 O disco GPT e a partição ESP

A **GPT** (*GUID Partition Table*) substitui a tabela do MBR:

```
 LBA 0       MBR "protetor": uma única partição que cobre o disco (ferramentas antigas não apagam a GPT)
 LBA 1       cabeçalho da GPT, de assinatura  "EFI PART"
 LBA 2 em diante   128 entradas de 128 bytes (cada uma com GUID de tipo, GUID único, LBA inicial e final)
 ...
 último LBA  cópia de reserva do cabeçalho
```

Os campos de LBA são de 64 bits, então o limite sobe para zetabytes. Uma das partições é a **ESP**
(*EFI System Partition*), formatada em **FAT** (em geral FAT32), onde mora o carregador. Se não há
uma entrada de boot nas variáveis da NVRAM, o firmware procura um caminho padrão dentro da ESP:

```
 \EFI\BOOT\BOOTX64.EFI      (x86-64)         \EFI\BOOT\BOOTIA32.EFI   (x86 de 32 bits)
```

Repare no que isso quer dizer: o firmware **entende um sistema de arquivos** e carrega um arquivo
pelo nome. É o contrário do `INT 19H`, que só sabia ler os 512 primeiros bytes do disco.

## 24.4 O que substituiu cada serviço da BIOS

| Serviço da BIOS | Capítulo | No UEFI e no PC moderno |
|---|---|---|
| `INT 10H` (vídeo) | [3](cap03-video-modos-e-texto.md), [4](cap04-video-paleta-fontes-strings.md) | **GOP** (*Graphics Output Protocol*): um framebuffer linear; o texto vem do protocolo de saída de texto |
| `INT 13H` (disco) | [9](cap09-disquete.md), [10](cap10-disco-fixo.md) | protocolo **Block I/O**; o sistema depois usa o driver próprio (AHCI, NVMe) |
| `INT 16H` / `INT 09H` (teclado) | [6](cap06-teclado.md) | protocolo de **entrada de texto**; depois, o driver de USB HID |
| `INT 15H, AH=C2H` (mouse PS/2) | [15](cap15-mouse-ps2.md) | protocolo de **ponteiro simples**; depois, USB HID |
| `INT 15H, AX=E820H` (memória) | [23](cap23-bios-e-modo-protegido.md) | `GetMemoryMap()` dos serviços de inicialização |
| `INT 1AH` / `INT 70H` (hora) | [7](cap07-tempo-e-relogios.md) | `GetTime()` dos serviços de execução (continua depois de `ExitBootServices()`) |
| `INT 14H` (serial) | [11](cap11-serial-e-impressora.md) | protocolo **Serial I/O**; muitos sistemas usam a porta direto |
| `INT 19H` / `INT 18H` (boot) | [12](cap12-boot-e-roms.md) | o gerenciador de boot e as variáveis `Boot####` / `BootOrder` |
| Área de dados da BIOS (`0040:0000`) | [17](cap17-area-de-dados-da-bios.md) | tabelas **ACPI** e **SMBIOS**, achadas pela tabela de configuração do UEFI |
| 8259, 8254 (IRQ, timer) | [2](cap02-vetores-e-excecoes.md), [7](cap07-tempo-e-relogios.md) | **APIC**, HPET, TSC (Aula 90) |

Os serviços do UEFI são chamadas de função por ponteiros em tabelas (`EFI_BOOT_SERVICES`,
`EFI_RUNTIME_SERVICES`), com a convenção de chamada do x86-64. A única parte que continua
disponível depois de `ExitBootServices()` são os **serviços de execução**: ler e gravar as variáveis
da NVRAM, a hora, desligar e reiniciar.

## 24.5 O ACPI: o hardware descrito por tabelas

Antes do ACPI, a BIOS entregava a lista dos dispositivos de formas dispersas: a tabela MP para os
processadores, o APM para a energia, o PnP BIOS para as placas ISA e a tabela de roteamento de IRQ
do PCI. O **ACPI** (1996) reuniu tudo em um conjunto de tabelas na memória, escritas pelo firmware
e lidas pelo sistema operacional.

A raiz é o **RSDP**, que começa com os 8 bytes `"RSD PTR "`. Com a BIOS, o sistema procura essa
assinatura na EBDA e em `E0000H` a `FFFFFH`; com o UEFI, o endereço vem na tabela de configuração.

```
 RSDP  ("RSD PTR ")
   └─► XSDT   (lista de ponteiros de 64 bits; na revisão antiga, RSDT com ponteiros de 32 bits)
         ├─► FADT  ("FACP")  registradores de energia, desligar a máquina, ponteiro para a DSDT
         ├─► MADT  ("APIC")  os núcleos e os APICs (Aula 90)
         ├─► MCFG            o acesso à configuração do PCI Express pela memória
         ├─► HPET            o relógio de eventos de alta precisão
         └─► DSDT / SSDT     código em AML, uma linguagem que o kernel interpreta
```

Todas as tabelas começam com um cabeçalho de 36 bytes (assinatura, tamanho, revisão, *checksum*...) e
obedecem à mesma regra: **a soma de todos os bytes, módulo 256, vale zero**. É o *checksum* que o
exercício a91-3 da [Aula 91](../conteudo-386/aula91-64-bits-uefi.md) pede para você verificar.

A DSDT contém, em **AML** (*ACPI Machine Language*), o código que descreve o que cada dispositivo
faz: como ligar e desligar, o que cada interrupção significa, como ler a bateria. O kernel carrega um
interpretador de AML, e é assim que o mesmo sistema operacional gerencia energia em placas diferentes
sem ter um driver para cada uma.

## 24.6 O CSM e o fim do modo de compatibilidade

Para continuar a iniciar sistemas antigos, a maioria dos firmwares UEFI trouxe um **CSM**
(*Compatibility Support Module*): um módulo que **emula uma BIOS clássica**, com a `INT 13H`, a
`INT 10H` e o carregamento do setor de boot em `0000:7C00`. A Intel anunciou em 2017 que deixaria
de oferecer o CSM até 2020, e muitas placas novas já não o têm.

Isso tem uma consequência prática para este livro: sem o CSM, **um setor de boot de MBR não roda mais
nesses computadores**. Também não há mais modo real "de graça" para uma `INT` chegar a uma ROM de
16 bits. O que os capítulos 1 a 22 descrevem continua a existir em máquinas antigas, em
**emuladores** (DOSBox, 86Box, PCem, QEMU com SeaBIOS) e em simuladores como o deste curso. Aprender
a BIOS hoje é aprender a base sobre a qual tudo foi construído, e que a próxima camada ainda imita
em muitas decisões: o mapa de memória, o `DL` do disco de boot, a leitura do disco por número de setor.

## 24.7 No simulador do curso

- Não há UEFI no simulador. A trilha avançada ensina o que dá para executar: a entrada no modo
  protegido, o modo de 64 bits como **decodificação** (Aula 91), as tabelas do ACPI (o *checksum*) e
  o APIC (Aula 90).
- O projeto de kernel real, com o `QEMU` e o firmware `OVMF` (um UEFI de código aberto), é o lugar
  para praticar um boot UEFI completo.

## 24.8 Exercícios

1. Quantos setores de 512 bytes ocupa a tabela de partições da GPT (128 entradas de 128 bytes)? Em
   que LBA ela termina, sabendo que começa no LBA 2?
2. Um disco MBR usa LBA de 32 bits e setores de 512 bytes. Calcule o tamanho máximo. Com setores de
   4096 bytes (discos modernos) o limite sobe quantas vezes?
3. Escolha três serviços `INT` do Apêndice A e diga como cada um seria feito num UEFI, usando a
   tabela da seção 24.4.
4. Por que um sistema operacional **precisa** ler o mapa de memória antes de chamar
   `ExitBootServices()`? O que acontece com as chamadas ao firmware depois dela?
5. Uma tabela do ACPI de 5 bytes tem os valores `10H`, `20H`, `30H`, `40H` e um *checksum*. Qual é o
   valor do *checksum* para que a tabela seja válida?

## Resumo

- A BIOS foi aposentada por ser de 16 bits, cheia de extensões incompatíveis e presa ao MBR (4
  partições, 2 TiB) e ao setor de boot de 512 bytes.
- O **UEFI** inicia por fases (SEC, PEI, DXE, BDS, TSL, RT), entrega a CPU já em 64 bits e carrega um
  executável **PE/COFF** (`\EFI\BOOT\BOOTX64.EFI`) de uma partição **ESP** em FAT. O disco usa **GPT**
  (`"EFI PART"` no LBA 1).
- Cada serviço `INT` tem um sucessor: GOP para o vídeo, Block I/O para o disco, `GetMemoryMap()` para
  o mapa de memória, `GetTime()` para a hora; depois de `ExitBootServices()` só os serviços de
  execução continuam.
- O **ACPI** descreve o hardware em tabelas ligadas a partir do **RSDP** (`"RSD PTR "`), cada uma com
  *checksum* de soma zero; a DSDT traz código AML que o kernel interpreta.
- O **CSM** emula a BIOS clássica nos firmwares que o têm, mas está desaparecendo: o conhecimento
  dos capítulos 1 a 22 vive hoje, sobretudo, em máquinas antigas, em emuladores e em simuladores.
