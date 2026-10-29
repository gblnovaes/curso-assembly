---
id: aula70
numero: 70
modulo: 21
titulo: O kernel na metade alta
subtitulo: Dois mapeamentos, o salto para 0xC0000000 e removendo o mapa idêntico
duracao: 70 min
objetivos: entender por que kernels vivem na metade alta do espaço de endereços; criar dois mapeamentos simultâneos (identidade e metade alta) no mesmo PD; saltar do endereço físico para o endereço virtual alto depois de ligar PG; remover o mapa de identidade após o salto
---

## Por que o kernel fica na metade alta?

Quando um sistema operacional gerencia vários processos, cada processo tem seu próprio espaço de endereços virtual. Um problema surge: onde o kernel vive nesse espaço?

Se o kernel ocupar os endereços baixos (como `0x000000`-`0x3FFFFF`), processos de usuário ficam com pouco espaço e o kernel precisa de mapas especiais para cada processo. A solução clássica do Linux e de muitos kernels de 32 bits é **partir o espaço de endereços ao meio**:

```
Virtual 00000000h–BFFFFFFFh   → espaço de usuário  (3 GB)
Virtual C0000000h–FFFFFFFFh   → espaço do kernel   (1 GB)
```

Fisicamente, o kernel continua nos primeiros megabytes de RAM. A paginação cria a ilusão de que ele está em `0xC0000000`.

## Dois mapeamentos simultâneos

A estratégia para ligar a paginação num kernel de metade alta é criar **dois mapeamentos ao mesmo tempo**:

1. **Mapa idêntico** (temporário): virtual `0–3FFFFFh` → físico `0–3FFFFFh`. Necessário para que o código continue rodando logo depois de ligar PG (EIP ainda está em `0x100000`).
2. **Mapa alto**: virtual `C0000000h–C03FFFFFh` → físico `0–3FFFFFh`. O destino permanente do kernel.

```diagrama titulo="PD com dois mapeamentos: identidade (PDE[0]) e metade alta (PDE[768])"
PD em 0x200000
  PDE[0]   = 0x201003  → PT0 em 0x201000  (virtual 0–3FFFFFh     → físico 0–3FFFFFh)
  PDE[1..767] = 0       (não presentes)
  PDE[768] = 0x202003  → PT768 em 0x202000 (virtual C0000000h–C03FFFFFh → físico 0–3FFFFFh)
  PDE[769..1023] = 0    (não presentes)
```

PT0 e PT768 têm o mesmo conteúdo: PT[i] = `i * 1000h | 3`.

## Habilitando e saltando para a metade alta

```nasm executar modo="pm32" titulo="HIGHKERN.BIN: salto para o kernel na metade alta"
        bits 32
        org 100000h

        ; --- PT0 em 0x201000: identidade (virtual 0 → físico 0, 4 MB) ---
        mov edi, 201000h
        xor eax, eax
.pt0:   mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt0

        ; --- PT768 em 0x202000: metade alta (virtual C0000000h → físico 0, 4 MB) ---
        ; mesmo conteúdo de PT0
        mov edi, 202000h
        xor eax, eax
.pt768: mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt768

        ; --- PD em 0x200000 ---
        mov dword [200000h], 201003h        ; PDE[0]   = PT0
        mov dword [200C00h], 202003h        ; PDE[768] = PT768  (768*4 = 0xC00)

        ; --- CR3 e bit PG ---
        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        ; --- saltar para o endereço virtual alto equivalente ---
        ; 'continua' está em físico 0x100000 + offset
        ; O mapa alto coloca esse frame em C0100000h + offset
        jmp continua + 0C0000000h

continua:
        ; EIP agora está em 0xC01xxxxx — estamos na metade alta!
        mov byte [0B8000h + 0C0000000h], 'H'
        mov byte [0B8001h + 0C0000000h], 0Ah
        cli
        hlt
```

:::cpu Constante de ligação do kernel (LOAD_OFFSET)
Kernels reais definem uma macro `PAGE_OFFSET = 0xC0000000` e a usam em toda parte. Todo símbolo do kernel é compilado com endereço virtual alto; o *bootloader* carrega o binário em memória física baixa. A conversão entre os dois é apenas uma soma ou subtração de `PAGE_OFFSET`.
:::

## Removendo o mapa de identidade

Após saltar para a metade alta, o mapa idêntico em PDE[0] não serve mais; mantê-lo é um risco de segurança (permite que o anel 3 veja a memória física do kernel se U/S=1). O kernel o remove zerando PDE[0] e invalidando a TLB:

```nasm fragmento titulo="Remover o mapa de identidade após o salto"
; depois de jumpar para 0xC01xxxxx:
        mov dword [200000h + 0C0000000h], 0     ; PDE[0] = 0 (não presente)
        mov eax, cr3
        mov cr3, eax                            ; invalida TLB
        ; agora virtual 0–3FFFFFh não está mais mapeado
```

A partir daí, todo acesso a endereços abaixo de `0xC0000000` gera #PF — exatamente o que um kernel quer quando um processo de usuário tenta acessar a memória do kernel (com U/S=0 nas PTEs do kernel).

```quiz
? Qual é o endereço virtual de `0x100000` físico depois de aplicar o mapa da metade alta (`PAGE_OFFSET = 0xC0000000`)?
+ 0xC0100000
- 0x100000 (não muda)
- 0xC0000000
- 0x400000

? Por que o mapa idêntico é necessário durante a transição para a metade alta?
+ Porque logo após ligar PG, EIP ainda é um endereço físico baixo; sem o mapa idêntico, a CPU geraria #PF imediatamente
- Porque sem ele o modo protegido não funciona
- Porque o mapa alto não cobre endereços abaixo de 4 MB
- Porque PDE[768] aponta para uma PT diferente de PT0

? Após remover o mapa idêntico (PDE[0] = 0), o que acontece se o anel 3 tentar acessar o endereço 0x00001000?
+ #PF com P=0 na entrada do diretório (PDE[0].P = 0)
- Acessa a memória normalmente, porque o anel 0 sempre consegue mapear
- O sistema trava imediatamente sem gerar exceção
- #GP, não #PF
```

## Exercícios

```exercicio
id: a70-1
titulo: Saltar para o endereço virtual alto
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte PT0 em `0x201000` (identidade 4 MB) e PT768 em `0x202000` (mesma coisa). Configure o PD em `0x200000` com `PDE[0] = 0x201003` e `PDE[768] = 0x202003` (em `0x200C00`). Ative a paginação. Salte para `continua + 0C0000000h`. No label `continua`, armazene `0x5A5A5A5A` em `[resultado + 0C0000000h]` e pare. O teste verifica o valor físico de `resultado`.
--- inicial
        bits 32
        org 100000h

        ; monte PT0 e PT768, configure PD, ative PG

        jmp continua + 0C0000000h

continua:
        ; armazene 5A5A5A5Ah em [resultado + 0C0000000h] e pare
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 5A5A5A5Ah", "espera": { "mem": { "resultado": 1515870810 } } }]
--- dicas
PT0: loop mov edx, eax / or edx, 3 / mov [edi], edx / add edi, 4 / add eax, 1000h.
PT768: mesmo loop, edi = 202000h.
PD: mov dword [200000h], 201003h / mov dword [200C00h], 202003h.
Salto: jmp continua + 0C0000000h.
No continua: mov dword [resultado + 0C0000000h], 5A5A5A5Ah.
--- solucao
        bits 32
        org 100000h

        mov edi, 201000h
        xor eax, eax
.pt0:   mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt0

        mov edi, 202000h
        xor eax, eax
.pt768: mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt768

        mov dword [200000h], 201003h
        mov dword [200C00h], 202003h

        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        jmp continua + 0C0000000h

continua:
        mov dword [resultado + 0C0000000h], 5A5A5A5Ah
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a70-2
titulo: Duas janelas para o mesmo frame físico
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte PT0 em `0x201000` (identidade 4 MB) e PT768 em `0x202000` (metade alta). Configure o PD com `PDE[0] = 0x201003` e `PDE[768] = 0x202003`. Ative a paginação. *Antes* de saltar para a metade alta, escreva `0xBEEFBEEFh` em `[300000h]` (via endereço de identidade). Depois salte para `continua + 0C0000000h`. No label `continua`, leia `[300000h + 0C0000000h]` (via endereço alto, o mesmo frame físico) e armazene o valor em `[resultado + 0C0000000h]`. O teste verifica que `resultado = 0xBEEFBEEF`.
--- inicial
        bits 32
        org 100000h

        ; monte PT0 e PT768, configure PD, ative PG

        ; escreva 0BEEFBEEFh via endereço baixo antes de saltar

        jmp continua + 0C0000000h

continua:
        ; leia via endereço alto e armazene em resultado
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = BEEFBEEFh", "espera": { "mem": { "resultado": 3203383023 } } }]
--- dicas
Escreva via identidade: mov dword [300000h], 0BEEFBEEFh (antes de jmp).
No continua: mov eax, [300000h + 0C0000000h] / mov [resultado + 0C0000000h], eax.
--- solucao
        bits 32
        org 100000h

        mov edi, 201000h
        xor eax, eax
.pt0:   mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt0

        mov edi, 202000h
        xor eax, eax
.pt768: mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt768

        mov dword [200000h], 201003h
        mov dword [200C00h], 202003h

        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        mov dword [300000h], 0BEEFBEEFh

        jmp continua + 0C0000000h

continua:
        mov eax, [300000h + 0C0000000h]
        mov [resultado + 0C0000000h], eax
        cli
        hlt

resultado: dd 0
```

:::resumo
- Kernels de 32 bits vivem na **metade alta** do espaço virtual (`0xC0000000+`) para separar o espaço de usuário (3 GB) do espaço do kernel (1 GB).
- A transição usa dois mapeamentos no mesmo PD: identidade (`PDE[0]`) e metade alta (`PDE[768]`), apontando para as mesmas tabelas de páginas.
- Após ligar PG e saltar para `label + 0xC0000000`, o código continua no mesmo frame físico, mas EIP agora é um endereço virtual alto.
- O mapa idêntico é removido zerando `PDE[0]` e re-escrevendo CR3 para invalidar a TLB; a partir daí acessos a endereços baixos geram #PF.
- A constante `PAGE_OFFSET = 0xC0000000` é o elo entre endereços virtuais do kernel e endereços físicos.
:::
