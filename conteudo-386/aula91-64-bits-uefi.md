---
id: aula91
numero: 91
modulo: 28
titulo: O modo de 64 bits e o UEFI
subtitulo: Paginação de quatro níveis, endereços canônicos, a BIOS que foi aposentada e as tabelas do ACPI
duracao: 70 min
objetivos: conhecer o caminho do modo protegido de 32 bits ao modo longo; decompor um endereço virtual de 48 bits nos quatro índices da paginação; reconhecer um endereço canônico; entender como o UEFI substitui a BIOS; verificar a soma de uma tabela do ACPI
---

## O modo longo (long mode)

O AMD64 de 2003 não foi uma máquina nova: foi o x86 de 32 bits **esticado**. Quem sabe o 386 reconhece quase tudo. As diferenças principais são estas:

- Os registradores de uso geral passam a ter **64 bits** (RAX, RBX... RSP), e ganham 8 colegas novos, de **R8 a R15**. O ponteiro de instruções é o RIP.
- A segmentação quase desaparece: em 64 bits as bases de CS, DS, ES e SS valem sempre 0 e os limites são ignorados (só FS e GS ainda têm base, usada para dados por thread). O modelo plano da aula 61 virou o único modelo.
- A paginação é obrigatória e tem **quatro níveis** (veja a seguir).
- Várias instruções saíram: `PUSHAD`/`POPAD`, `BOUND`, `INTO` e as instruções de aritmética BCD. Os opcodes `0x40` a `0x4F`, que eram `INC` e `DEC` de registrador, viraram os prefixos **REX**, que dão acesso aos registradores novos e aos operandos de 64 bits.
- As convenções de chamada passam a usar registradores: no Linux (System V) os seis primeiros argumentos vão em RDI, RSI, RDX, RCX, R8 e R9; no Windows x64, os quatro primeiros em RCX, RDX, R8 e R9. O cdecl da aula 81 ficou no passado.

A entrada no modo longo é parente da entrada no modo protegido (aula 62), em passos:

```diagrama titulo="Do modo protegido de 32 bits ao modo longo"
1. CR4.PAE = 1                    ; paginação PAE (entradas de 64 bits)
2. CR3 = endereço da tabela PML4  ; a raiz da paginação de 4 níveis
3. EFER.LME = 1                   ; MSR 0xC0000080, bit 8 (WRMSR)
4. CR0.PG = 1                     ; liga a paginação: a CPU liga o EFER.LMA sozinha
5. jmp far para um segmento de código de 64 bits  ; descritor com o bit L = 1
```

O `EFER` é um MSR (aula 90) e o descritor de código de 64 bits usa o **bit L** (bit 53 do descritor), que ocupava um bit "reservado" no descritor do 386.

## A paginação de quatro níveis

Com a PAE cada entrada de tabela tem 8 bytes, então uma tabela de 4 KiB comporta **512 entradas**, e 512 = 2⁹: cada nível consome **9 bits** do endereço. Com quatro níveis, e os 12 bits do deslocamento dentro da página, dá 4 × 9 + 12 = **48 bits** de endereço virtual.

```diagrama titulo="Um endereço virtual de 48 bits"
 63      48 47    39 38    30 29    21 20    12 11         0
┌──────────┬────────┬────────┬────────┬────────┬────────────┐
│ canônico │ PML4   │ PDPT   │   PD   │   PT   │ deslocamen │
│ (cópia   │ índice │ índice │ índice │ índice │ to dentro  │
│ do bit   │ (9     │ (9     │ (9     │ (9     │ da página  │
│  47)     │ bits)  │ bits)  │ bits)  │ bits)  │ (12 bits)  │
└──────────┴────────┴────────┴────────┴────────┴────────────┘
CR3 → PML4[i] → PDPT[j] → PD[k] → PT[l] → página de 4 KiB + deslocamento
```

Cada índice escolhe uma entrada do nível seguinte, e o último nível aponta a página. É a mesma ideia do diretório e da tabela de páginas da aula 68, com dois níveis a mais. As CPUs mais novas têm ainda um quinto nível (LA57, 57 bits de endereço), usado em máquinas com muita memória.

Os bits 63:48 não são livres: precisam ser **cópias do bit 47**. Um endereço assim se chama **canônico**; os 48 bits dão a metade baixa (`0x0000000000000000` a `0x00007FFFFFFFFFFF`, onde ficam os programas de usuário) e a metade alta (`0xFFFF800000000000` em diante, para o kernel). Usar um endereço não canônico gera #GP. A regra existe para que um dia, com mais bits, os endereços antigos continuem valendo.

:::cpu Por que 48 bits e não 64
2⁶⁴ bytes dariam 16 exabytes, mais do que qualquer máquina precisa, e cada nível de tabela extra torna a tradução mais lenta. A AMD escolheu 48 bits (256 TiB) como o ponto de equilíbrio e deixou a regra do endereço canônico como a porta para crescer sem quebrar o software.
:::

## O UEFI: a BIOS aposentada

A BIOS que o livro de apoio descreve é de 1981. O **UEFI** (*Unified Extensible Firmware Interface*, evoluído do EFI da Intel, e mantido a partir de 2005 pelo UEFI Forum) a substitui em quase todos os PCs de hoje, e muda tudo o que o módulo 16 aprendeu sobre a partida:

| | BIOS | UEFI |
|---|---|---|
| Modo da CPU ao entregar o controle | modo real de 16 bits | modo de 64 bits (ou 32), já com paginação |
| Como o sistema pede serviços | `INT 10h`, `INT 13h`... | chamadas por tabelas de funções (`EFI_BOOT_SERVICES`) |
| Mapa de memória | `INT 15h, AX=E820h` | `GetMemoryMap()` |
| Onde fica o carregador | primeiros 512 bytes do disco (MBR) | arquivo `\EFI\BOOT\BOOTX64.EFI` numa partição **ESP** |
| Tabela de partições | MBR (4 partições, discos de até 2 TiB) | **GPT** (128 partições, discos enormes) |
| Formato do programa | setor binário | executável **PE/COFF** (o formato do Windows, não o ELF) |

O firmware UEFI sabe ler FAT (a ESP é uma partição FAT32), então o carregador é um **arquivo de verdade**, não um setor. O disco GPT começa com um MBR "protetor" no LBA 0, e a tabela real no LBA 1, cuja assinatura é a string `"EFI PART"`. Depois que o carregador chama `ExitBootServices()`, os serviços de inicialização somem e o sistema operacional passa a ser dono da máquina. O UEFI também traz o **Secure Boot**, que só carrega código assinado.

O sistema operacional também recebe do firmware a descrição do hardware pelo **ACPI**, um conjunto de tabelas na memória (a que a aula anterior citou). A raiz é o **RSDP**, que começa com a assinatura `"RSD PTR "` de 8 bytes. Todas as tabelas do ACPI têm um byte de verificação escolhido de modo que **a soma de todos os bytes, módulo 256, dê zero**: é assim que o sistema confere se a tabela está intacta.

```quiz
? Quantos bits do endereço virtual cada nível da paginação de 4 níveis do modo longo consome, e por quê?
+ 9 bits por nível, porque uma tabela de 4 KiB tem 512 entradas de 8 bytes (2^9)
- 12 bits por nível, o tamanho do deslocamento
- 10 bits, como na paginação de 32 bits
- 16 bits, o tamanho de um segmento

? O que é um endereço canônico em x86-64?
+ Um endereço em que os bits 63:48 são cópias do bit 47; qualquer outro gera #GP
- Um endereço alinhado em 4 KiB
- Um endereço abaixo de 1 MiB
- Um endereço de 32 bits estendido com zeros

? Qual destas coisas o UEFI muda em relação à BIOS?
+ O carregador é um arquivo PE/COFF numa partição FAT (ESP), os serviços vêm por tabelas de funções em vez de INT, e o disco usa GPT em vez de MBR
- O UEFI volta a ligar o modo real antes de entregar o controle
- O UEFI continua usando INT 13h para ler o disco
- O carregador continua sendo exatamente os 512 bytes do setor de boot
```

## Exercícios

```exercicio
id: a91-1
titulo: Os índices de um endereço virtual de 64 bits
nivel: 3
maquina: 386
modo: pm32
--- enunciado
O simulador é de 32 bits, então o endereço virtual `0x00007F12_34567ABC` chega em duas metades: `va_hi = 0x00007F12` e `va_lo = 0x34567ABC`. Decomponha-o nos quatro índices da paginação de 4 níveis e no deslocamento, e guarde em `i_pml4` (bits 47:39), `i_pdpt` (38:30), `i_pd` (29:21), `i_pt` (20:12) e `desloc` (11:0). Cuidado: o índice da PDPT atravessa as duas metades (os bits 38:32 vêm de `va_hi` e os bits 31:30 de `va_lo`). Verifique `254`, `72`, `418`, `359` e `0xABC` (2748).
--- inicial
        bits 32
        org 100000h

        mov  esi, 0x00007F12     ; va_hi (bits 63:32)
        mov  edi, 0x34567ABC     ; va_lo (bits 31:0)

        ; i_pml4 = (hi >> 7) & 0x1FF
        ; i_pdpt = ((hi & 0x7F) << 2) | (lo >> 30)
        ; i_pd   = (lo >> 21) & 0x1FF
        ; i_pt   = (lo >> 12) & 0x1FF
        ; desloc = lo & 0xFFF

        cli
        hlt

i_pml4: dd 0
i_pdpt: dd 0
i_pd:   dd 0
i_pt:   dd 0
desloc: dd 0
--- testes
[
  { "nome": "i_pml4 = 254, i_pdpt = 72", "espera": { "mem": { "i_pml4": 254, "i_pdpt": 72 } } },
  { "nome": "i_pd = 418, i_pt = 359, desloc = 2748", "espera": { "mem": { "i_pd": 418, "i_pt": 359, "desloc": 2748 } } }
]
--- dicas
PML4: mov eax, esi / shr eax, 7 / and eax, 0x1FF.
PDPT: mov eax, esi / and eax, 0x7F / shl eax, 2 / mov ebx, edi / shr ebx, 30 / or eax, ebx.
PD: mov eax, edi / shr eax, 21 / and eax, 0x1FF. PT: shr eax, 12 em vez de 21. Deslocamento: and eax, 0xFFF.
--- solucao
        bits 32
        org 100000h

        mov  esi, 0x00007F12
        mov  edi, 0x34567ABC

        mov  eax, esi
        shr  eax, 7
        and  eax, 0x1FF
        mov  [i_pml4], eax

        mov  eax, esi
        and  eax, 0x7F
        shl  eax, 2
        mov  ebx, edi
        shr  ebx, 30
        or   eax, ebx
        mov  [i_pdpt], eax

        mov  eax, edi
        shr  eax, 21
        and  eax, 0x1FF
        mov  [i_pd], eax

        mov  eax, edi
        shr  eax, 12
        and  eax, 0x1FF
        mov  [i_pt], eax

        mov  eax, edi
        and  eax, 0xFFF
        mov  [desloc], eax

        cli
        hlt

i_pml4: dd 0
i_pdpt: dd 0
i_pd:   dd 0
i_pt:   dd 0
desloc: dd 0
```

```exercicio
id: a91-2
titulo: Endereços canônicos
nivel: 3
maquina: 386
modo: pm32
--- enunciado
A `tabela` guarda a metade alta (`va_hi`, bits 63:32) de quatro endereços virtuais. Um endereço é **canônico** quando os bits 63:47 são todos iguais (todos 0 ou todos 1), o que na metade alta quer dizer `hi >> 15` igual a `0` ou a `0x1FFFF` (17 bits). Para cada entrada guarde `1` (canônico) ou `0` (não canônico) em `res`, um byte por entrada. Verifique `res = [1, 1, 0, 0]`: `0x00007FFF` e `0xFFFF8000` são canônicos; `0x00008000` e `0x12345678` não.
--- inicial
        bits 32
        org 100000h

        xor  esi, esi
.laco:
        mov  eax, [tabela+esi*4]
        ; ebx = eax >> 15
        ; canônico se ebx == 0 ou ebx == 0x1FFFF
        mov  byte [res+esi], 0
        inc  esi
        cmp  esi, 4
        jb   .laco
        cli
        hlt

tabela: dd 0x00007FFF, 0xFFFF8000, 0x00008000, 0x12345678
res:    times 4 db 0
--- testes
[{ "nome": "res = [1, 1, 0, 0]", "espera": { "mem": { "res": [1, 1, 0, 0] } } }]
--- dicas
mov ebx, eax / shr ebx, 15.
test ebx, ebx / jz .sim. cmp ebx, 0x1FFFF / je .sim. Caso contrário, deixe 0.
.sim: mov byte [res+esi], 1.
--- solucao
        bits 32
        org 100000h

        xor  esi, esi
.laco:
        mov  eax, [tabela+esi*4]
        mov  ebx, eax
        shr  ebx, 15
        test ebx, ebx
        jz   .sim
        cmp  ebx, 0x1FFFF
        jne  .nao
.sim:
        mov  byte [res+esi], 1
        jmp  .prox
.nao:
        mov  byte [res+esi], 0
.prox:
        inc  esi
        cmp  esi, 4
        jb   .laco
        cli
        hlt

tabela: dd 0x00007FFF, 0xFFFF8000, 0x00008000, 0x12345678
res:    times 4 db 0
```

```exercicio
id: a91-3
titulo: O checksum de uma tabela ACPI
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Uma tabela do ACPI é válida quando a **soma de todos os seus bytes, módulo 256, é zero**. Implemente `acpi_ok(ptr, tamanho)`, com o ponteiro em `[esp+4]` e o tamanho em `[esp+8]`: some os bytes num registrador de 8 bits (que já descarta o excesso) e devolva `1` em EAX se a soma deu 0, ou `0` se não. O programa testa o `rsdp` (os 20 bytes iniciais de um RSDP, de assinatura `"RSD PTR "`, com o byte de verificação correto) e uma cópia `rsdp_ruim` em que um byte foi estragado. Verifique `res = [1, 0]`.
--- inicial
        bits 32
        org 100000h

        push dword 20
        push dword rsdp
        call acpi_ok
        add  esp, 8
        mov  [res], al

        push dword 20
        push dword rsdp_ruim
        call acpi_ok
        add  esp, 8
        mov  [res+1], al
        cli
        hlt

acpi_ok:
        ; esi = ptr, ecx = tamanho, bl = soma dos bytes (módulo 256)
        ; devolva 1 se bl == 0, senão 0
        mov  eax, 1
        ret

rsdp:
        db 0x52, 0x53, 0x44, 0x20, 0x50, 0x54, 0x52, 0x20     ; "RSD PTR "
        db 0xD0                                               ; checksum
        db 0x42, 0x4F, 0x43, 0x48, 0x53, 0x20                 ; OEMID "BOCHS "
        db 0x00                                               ; revisão
        db 0xA0, 0xD3, 0x0F, 0x00                             ; endereço do RSDT
rsdp_ruim:
        db 0x52, 0x53, 0x44, 0x20, 0x50, 0x54, 0x52, 0x20
        db 0xD0
        db 0x42, 0x4F, 0x43, 0x48, 0x53, 0x20
        db 0x00
        db 0xA1, 0xD3, 0x0F, 0x00                             ; um byte diferente
res:    times 2 db 0
--- testes
[{ "nome": "res = [1, 0]", "espera": { "mem": { "res": [1, 0] } } }]
--- dicas
mov esi, [esp+4] / mov ecx, [esp+8] / xor ebx, ebx.
.l: add bl, [esi] / inc esi / loop .l.
test bl, bl / jnz .nao / mov eax, 1 / ret. .nao: xor eax, eax / ret.
--- solucao
        bits 32
        org 100000h

        push dword 20
        push dword rsdp
        call acpi_ok
        add  esp, 8
        mov  [res], al

        push dword 20
        push dword rsdp_ruim
        call acpi_ok
        add  esp, 8
        mov  [res+1], al
        cli
        hlt

acpi_ok:
        mov  esi, [esp+4]
        mov  ecx, [esp+8]
        xor  ebx, ebx
.laco:
        add  bl, [esi]
        inc  esi
        loop .laco
        test bl, bl
        jnz  .nao
        mov  eax, 1
        ret
.nao:
        xor  eax, eax
        ret

rsdp:
        db 0x52, 0x53, 0x44, 0x20, 0x50, 0x54, 0x52, 0x20
        db 0xD0
        db 0x42, 0x4F, 0x43, 0x48, 0x53, 0x20
        db 0x00
        db 0xA0, 0xD3, 0x0F, 0x00
rsdp_ruim:
        db 0x52, 0x53, 0x44, 0x20, 0x50, 0x54, 0x52, 0x20
        db 0xD0
        db 0x42, 0x4F, 0x43, 0x48, 0x53, 0x20
        db 0x00
        db 0xA1, 0xD3, 0x0F, 0x00
res:    times 2 db 0
```

:::resumo
- O **modo longo** (AMD64, 2003) estica o x86: registradores de 64 bits (RAX...R15, RIP), segmentação quase extinta, paginação obrigatória e convenções de chamada em registradores. Entra-se nele com `CR4.PAE`, o `CR3` apontando a PML4, `EFER.LME` e `CR0.PG`, e um salto para um segmento de código com o bit **L**.
- A paginação tem **4 níveis** (PML4, PDPT, PD, PT) de **9 bits** cada, mais 12 de deslocamento: 48 bits de endereço virtual. Os bits 63:48 precisam copiar o bit 47 (**endereço canônico**), senão há #GP.
- O **UEFI** aposenta a BIOS: o carregador é um arquivo PE/COFF (`BOOTX64.EFI`) numa partição ESP em FAT, os serviços vêm de tabelas de funções, o mapa de memória vem de `GetMemoryMap()` e o disco usa **GPT** (`"EFI PART"`) no lugar do MBR.
- O **ACPI** descreve o hardware por tabelas, a partir do **RSDP** (`"RSD PTR "`); cada tabela é válida quando **a soma dos seus bytes, módulo 256, é zero**.
:::
