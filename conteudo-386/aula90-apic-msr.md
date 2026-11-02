---
id: aula90
numero: 90
modulo: 28
titulo: Interrupções modernas: APIC, MSRs e vários núcleos
subtitulo: O que substituiu o 8259 quando um PC passou a ter mais de um processador
duracao: 65 min
objetivos: entender por que o 8259 não serve para máquinas com vários núcleos; conhecer o APIC local e o de E/S e onde ficam os seus registradores; ler e escrever MSRs com RDMSR e WRMSR; decodificar o MSR IA32_APIC_BASE; montar uma entrada de redirecionamento do I/O APIC; seguir a sequência INIT-SIPI-SIPI que acorda os outros núcleos
---

## Os limites do 8259

O par de 8259 que você programou no módulo 20 resolve bem o problema de um PC de 1984: **15 linhas de IRQ** e **uma só CPU** para atendê-las. Num computador de hoje, nenhuma das duas premissas vale:

- há dezenas de dispositivos (placas PCI Express, USB, rede, discos NVMe) e eles não cabem em 15 linhas;
- há **vários núcleos**, e a interrupção de um disco precisa poder ser entregue a *qualquer* um deles, ou a um escolhido, para espalhar o trabalho.

A resposta da Intel, a partir do Pentium, foi o **APIC** (*Advanced Programmable Interrupt Controller*), que no lugar de um chip central tem duas peças.

```diagrama titulo="A arquitetura APIC"
 dispositivos (teclado, disco, rede...)
        │ linhas de IRQ (24 ou mais)
        ▼
  ┌────────────┐   mensagens de interrupção
  │ I/O APIC   │ ──────────────────────────────┐
  │ (1 por     │                               ▼
  │  placa)    │                  ┌──────────┐  ┌──────────┐
  └────────────┘                  │ APIC     │  │ APIC     │
                                  │ local    │  │ local    │
                                  │ núcleo 0 │  │ núcleo 1 │ ...
                                  └──────────┘  └──────────┘
```

- O **I/O APIC** recebe as linhas dos dispositivos. Para cada linha há uma *entrada de redirecionamento* que diz **qual vetor** gerar e **para qual núcleo** mandar.
- O **APIC local** fica dentro de cada núcleo. Ele entrega a interrupção à CPU, mede o tempo (tem o seu próprio timer) e deixa um núcleo mandar uma interrupção a outro, a **IPI** (*inter-processor interrupt*).

Os registradores são acessados por **endereços de memória fixos**: o APIC local fica por padrão em `0xFEE00000` e o I/O APIC em `0xFEC00000`. Hoje, muitos dispositivos PCI Express nem precisam do I/O APIC: usam **MSI** (*message signaled interrupts*), em que o dispositivo avisa o núcleo escrevendo uma mensagem direto no endereço do APIC local.

## Os MSRs

A configuração do APIC e de muitos outros recursos do processador mora em **MSRs** (*model-specific registers*), uma tabela de registradores numerados que não são nem de uso geral nem de controle. Duas instruções, privilegiadas (só no anel 0), os leem e escrevem:

```nasm fragmento titulo="RDMSR e WRMSR"
        mov   ecx, 0x1B       ; número do MSR: IA32_APIC_BASE
        rdmsr                 ; EDX:EAX = valor do MSR
        or    eax, 1 << 11    ; liga o bit de habilitação
        wrmsr                 ; EDX:EAX → MSR
```

O número vai em **ECX** e o valor de 64 bits em **EDX:EAX** (EDX é a metade alta). `RDMSR` e `WRMSR` apareceram no Pentium; ao contrário da `CPUID`, o simulador da trilha não as executa, então nos exercícios você decodifica o valor que o `RDMSR` devolveria.

O MSR `0x1B`, **IA32_APIC_BASE**, controla o APIC local:

```diagrama titulo="IA32_APIC_BASE (MSR 0x1B), metade baixa"
bits 31:12   endereço-base do APIC local (alinhado em 4 KiB; padrão 0xFEE00000)
bit  11      habilitação global do APIC
bit  10      modo x2APIC
bit   8      BSP: 1 neste núcleo se ele for o processador de partida
```

Quando o PC liga, todos os núcleos têm um valor aí, mas o bit 8 (BSP) é 1 em **apenas um** deles.

## Acordando os outros núcleos

Ao ligar, só um núcleo trabalha: o **BSP** (*bootstrap processor*). Os outros, chamados **APs** (*application processors*), ficam parados esperando. Para acordá-los o BSP manda IPIs pelo seu APIC local, numa sequência combinada chamada **INIT-SIPI-SIPI**:

1. uma IPI **INIT**, que reinicia o AP;
2. uma IPI **SIPI** (*startup IPI*) com um número de 8 bits, o **vetor**;
3. uma segunda SIPI (por segurança).

O AP começa a executar no **modo real**, em `CS:IP` correspondentes ao endereço `vetor × 4096`, um endereço abaixo de 1 MiB. Ou seja: cada núcleo que o seu kernel acorda precisa repetir, sozinho, a subida do módulo 19: modo real → GDT → modo protegido → paginação. O código de partida dos APs (o *trampolim*) costuma ser um pedacinho de código de 16 bits copiado pelo BSP para uma página baixa, justamente para os APs o encontrarem.

:::anos90 O MP Table e o ACPI
Como o sistema operacional sabe quantos núcleos e I/O APICs existem? Nos PCs de 1995 em diante a Intel definiu o **MP Table**, uma estrutura na memória baixa. Hoje isso vem do **ACPI**: a tabela `MADT` (de assinatura `"APIC"`) lista cada núcleo e cada I/O APIC. É a mesma ACPI que a aula seguinte volta a usar.
:::

```quiz
? Qual é a diferença entre o APIC local e o I/O APIC?
+ O I/O APIC recebe as linhas dos dispositivos e as roteia; o APIC local fica em cada núcleo, entrega a interrupção à CPU e trata as IPIs e o timer local
- O local fica na placa-mãe e o de E/S dentro da CPU
- O I/O APIC só serve para o teclado
- Não há diferença; são o mesmo chip

? Em que modo um processador de aplicação (AP) começa a executar depois da SIPI?
+ No modo real, no endereço vetor × 4096; ele precisa subir até o modo protegido sozinho
- Direto no modo de 64 bits
- No modo protegido plano, com paginação ligada
- No modo virtual 8086

? Para ler o MSR 0x1B, o que se carrega e onde sai o resultado?
+ ECX = 0x1B antes do RDMSR; o valor de 64 bits sai em EDX:EAX
- EAX = 0x1B; o valor sai em ECX
- O número vai em DX e o valor em AL
- RDMSR não usa registradores
```

## Exercícios

```exercicio
id: a90-1
titulo: Decodificar o IA32_APIC_BASE
nivel: 2
maquina: 386
modo: pm32
--- enunciado
O `RDMSR` do MSR `0x1B` devolveu `EAX = 0xFEE00900`. Decodifique a metade baixa: guarde em `base_apic` o endereço-base (bits 31:12, ou seja, o valor com os 12 bits baixos zerados), em `habilitado` o bit 11 e em `eh_bsp` o bit 8. Verifique `base_apic = 0xFEE00000`, `habilitado = 1` e `eh_bsp = 1`.
--- inicial
        bits 32
        org 100000h

        mov  eax, 0xFEE00900     ; o que o RDMSR devolveu

        ; base_apic = eax & 0xFFFFF000
        ; habilitado = (eax >> 11) & 1
        ; eh_bsp     = (eax >> 8) & 1

        cli
        hlt

base_apic:  dd 0
habilitado: dd 0
eh_bsp:     dd 0
--- testes
[
  { "nome": "base_apic = 0xFEE00000", "espera": { "mem": { "base_apic": 4276092928 } } },
  { "nome": "habilitado = 1 e eh_bsp = 1", "espera": { "mem": { "habilitado": 1, "eh_bsp": 1 } } }
]
--- dicas
mov ebx, eax / and ebx, 0xFFFFF000 / mov [base_apic], ebx.
mov ebx, eax / shr ebx, 11 / and ebx, 1 / mov [habilitado], ebx.
O bit 8 é o mesmo raciocínio com shr ebx, 8.
--- solucao
        bits 32
        org 100000h

        mov  eax, 0xFEE00900

        mov  ebx, eax
        and  ebx, 0xFFFFF000
        mov  [base_apic], ebx

        mov  ebx, eax
        shr  ebx, 11
        and  ebx, 1
        mov  [habilitado], ebx

        shr  eax, 8
        and  eax, 1
        mov  [eh_bsp], eax

        cli
        hlt

base_apic:  dd 0
habilitado: dd 0
eh_bsp:     dd 0
```

```exercicio
id: a90-2
titulo: A entrada de redirecionamento do I/O APIC
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Cada linha de IRQ do I/O APIC tem uma entrada de redirecionamento de 64 bits; a metade baixa tem estes campos: bits 7:0 = **vetor**; bit 13 = polaridade (1 = ativo em nível baixo); bit 15 = modo de disparo (1 = por nível, 0 = por borda); bit 16 = **máscara** (1 = interrupção desligada). Implemente `monta_entrada(vetor, nivel, baixo, mascara)`, com os argumentos empilhados nessa ordem (o vetor em `[esp+4]`, `nivel` em `[esp+8]`, `baixo` em `[esp+12]` e `mascara` em `[esp+16]`; os três últimos valem 0 ou 1), que devolve em EAX o dword montado. O programa pede três entradas: um IRQ de ISA (vetor `0x20`, borda, ativo alto, ligado), uma linha PCI (vetor `0x2A`, nível, ativo baixo, ligada) e o teclado desligado (vetor `0x21`, borda, ativo alto, mascarado). Verifique `r1 = 0x20`, `r2 = 0xA02A` e `r3 = 0x10021`.
--- inicial
        bits 32
        org 100000h

        push dword 0          ; mascara
        push dword 0          ; baixo
        push dword 0          ; nivel
        push dword 0x20       ; vetor
        call monta_entrada
        add  esp, 16
        mov  [r1], eax

        push dword 0
        push dword 1
        push dword 1
        push dword 0x2A
        call monta_entrada
        add  esp, 16
        mov  [r2], eax

        push dword 1
        push dword 0
        push dword 0
        push dword 0x21
        call monta_entrada
        add  esp, 16
        mov  [r3], eax
        cli
        hlt

monta_entrada:
        ; eax = vetor | (baixo << 13) | (nivel << 15) | (mascara << 16)
        xor  eax, eax
        ret

r1: dd 0
r2: dd 0
r3: dd 0
--- testes
[{ "nome": "r1 = 0x20, r2 = 0xA02A, r3 = 0x10021", "espera": { "mem": { "r1": 32, "r2": 41002, "r3": 65569 } } }]
--- dicas
mov eax, [esp+4] (vetor).
mov ecx, [esp+12] / shl ecx, 13 / or eax, ecx (baixo).
mov ecx, [esp+8] / shl ecx, 15 / or eax, ecx (nível).
mov ecx, [esp+16] / shl ecx, 16 / or eax, ecx (máscara) / ret.
--- solucao
        bits 32
        org 100000h

        push dword 0
        push dword 0
        push dword 0
        push dword 0x20
        call monta_entrada
        add  esp, 16
        mov  [r1], eax

        push dword 0
        push dword 1
        push dword 1
        push dword 0x2A
        call monta_entrada
        add  esp, 16
        mov  [r2], eax

        push dword 1
        push dword 0
        push dword 0
        push dword 0x21
        call monta_entrada
        add  esp, 16
        mov  [r3], eax
        cli
        hlt

monta_entrada:
        mov  eax, [esp+4]
        mov  ecx, [esp+12]
        shl  ecx, 13
        or   eax, ecx
        mov  ecx, [esp+8]
        shl  ecx, 15
        or   eax, ecx
        mov  ecx, [esp+16]
        shl  ecx, 16
        or   eax, ecx
        ret

r1: dd 0
r2: dd 0
r3: dd 0
```

:::resumo
- O **8259** (15 IRQs, uma CPU) não serve para máquinas modernas; o **APIC** o substitui com um **I/O APIC** (recebe as linhas e as roteia, com uma entrada de redirecionamento por linha) e um **APIC local** por núcleo (entrega a interrupção, tem timer e manda IPIs). Dispositivos PCI Express ainda podem usar **MSI** e dispensar o I/O APIC.
- Os registradores do APIC local ficam em `0xFEE00000` e os do I/O APIC em `0xFEC00000`.
- **MSRs** são lidos por `RDMSR` e escritos por `WRMSR` (ECX = número, EDX:EAX = valor; só no anel 0). O **IA32_APIC_BASE** (`0x1B`) traz o endereço-base (bits 31:12), a habilitação (bit 11) e o bit **BSP** (bit 8).
- Só o **BSP** trabalha na partida; ele acorda os **APs** com **INIT-SIPI-SIPI**, e cada AP começa em **modo real** em `vetor × 4096`.
- A lista de núcleos e de I/O APICs vem do **ACPI** (tabela `MADT`), que substituiu o MP Table.
:::
