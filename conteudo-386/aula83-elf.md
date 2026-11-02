---
id: aula83
numero: 83
modulo: 26
titulo: O formato ELF
subtitulo: O cabeçalho, os cabeçalhos de programa e como o kernel carrega um executável
duracao: 65 min
objetivos: ler o cabeçalho ELF de 32 bits e validar a assinatura; entender os cabeçalhos de programa e o tipo PT_LOAD; escrever um carregador mínimo que copia os segmentos para a memória e salta para o ponto de entrada
---

## O executável do mundo Unix

Quando o seu kernel precisar rodar um programa — um `/bin/sh`, um utilitário — ele vai receber um arquivo em disco e ter que transformá-lo num processo na memória. No DOS esse arquivo era o `.COM` (binário plano) ou o `.EXE` (formato MZ). No mundo Unix, de Linux a FreeBSD, o formato é o **ELF** (*Executable and Linkable Format*).

O ELF é o mesmo formato dos objetos `.o` que o ligador junta (aula anterior) e dos executáveis finais. Aqui olhamos só o essencial para **carregar** um executável ELF de 32 bits.

## O cabeçalho ELF

Os primeiros 52 bytes de todo ELF de 32 bits são o cabeçalho:

```diagrama titulo="Cabeçalho ELF de 32 bits (Elf32_Ehdr), 52 bytes"
offset  tam  campo         conteúdo
0x00    4    e_ident[0..3] 7F 45 4C 46  = 0x7F,'E','L','F' (a assinatura mágica)
0x04    1    EI_CLASS      1 = 32 bits (ELFCLASS32)
0x05    1    EI_DATA       1 = little-endian
0x10    2    e_type        2 = ET_EXEC (executável)
0x12    2    e_machine     3 = EM_386
0x18    4    e_entry       endereço virtual do ponto de entrada
0x1C    4    e_phoff       offset dos cabeçalhos de programa no arquivo
0x2C    2    e_phnum       quantos cabeçalhos de programa há
```

A primeira coisa que um carregador faz é **validar a assinatura**: os quatro bytes `7F 45 4C 46`. Lidos como um dword little-endian, eles valem `0x464C457F`. Se não baterem, não é um ELF e o carregador recusa.

## Os cabeçalhos de programa

O cabeçalho ELF diz **o que** o arquivo é; os **cabeçalhos de programa** (*program headers*) dizem **como carregá-lo**. Há `e_phnum` deles, a partir do offset `e_phoff`, cada um com 32 bytes:

```diagrama titulo="Cabeçalho de programa (Elf32_Phdr), 32 bytes"
offset  tam  campo       conteúdo
0x00    4    p_type      1 = PT_LOAD (segmento que vai para a memória)
0x04    4    p_offset    onde o segmento começa no arquivo
0x08    4    p_vaddr     endereço virtual de destino na memória
0x10    4    p_filesz    quantos bytes copiar do arquivo
0x14    4    p_memsz     tamanho na memória (≥ filesz; o excedente é zerado)
0x18    4    p_flags     permissões: 1=X, 2=W, 4=R
```

Carregar um ELF é, no fundo, um laço simples:

```diagrama titulo="O algoritmo do carregador ELF"
valide a assinatura (7F 45 4C 46)
para cada cabeçalho de programa (e_phnum deles, a partir de e_phoff):
    se p_type == PT_LOAD:
        copie p_filesz bytes de (arquivo + p_offset) para p_vaddr
        zere (p_memsz - p_filesz) bytes depois disso   ; o .bss
salte para e_entry
```

:::cpu p_memsz maior que p_filesz: é o .bss
Lembra da seção `.bss` da aula anterior, que não ocupa espaço no arquivo? É aqui que ela aparece: o cabeçalho de programa diz `p_filesz = 200` e `p_memsz = 512`, por exemplo. O carregador copia 200 bytes do arquivo e **zera** os outros 312 na memória. Assim as variáveis globais zeradas não gastam um único byte no executável.
:::

:::anos90 Por que ELF e não a.out?
Os primeiros Unix (e o Linux até 1995) usavam o formato **a.out**, simples mas rígido: difícil ter bibliotecas compartilhadas e seções extras. O ELF, criado pela AT&T para o System V, é extensível — cada program header e cada section header descreve um pedaço, então acrescentar uma tabela de símbolos de depuração ou uma seção de *thread-local storage* não quebra os carregadores antigos. O Linux migrou para ELF no kernel 1.2 e nunca mais olhou para trás.
:::

```quiz
? Qual é a primeira coisa que um carregador ELF faz ao receber um arquivo?
+ Validar a assinatura mágica 7F 45 4C 46 nos primeiros quatro bytes
- Saltar imediatamente para e_entry
- Copiar o arquivo inteiro para 0x100000
- Ler a tabela de símbolos

? O que o campo p_vaddr de um cabeçalho de programa indica?
+ O endereço virtual de destino para onde aquele segmento deve ser copiado na memória
- O offset do segmento dentro do arquivo
- O ponto de entrada do programa
- O tamanho do segmento

? Por que p_memsz pode ser maior que p_filesz?
+ A diferença é o .bss: o carregador copia p_filesz bytes do arquivo e zera o restante até p_memsz
- É um erro no cabeçalho; eles deveriam ser sempre iguais
- p_memsz inclui o cabeçalho ELF
- Porque a memória é sempre alinhada em páginas de 4 KiB
```

## Exercícios

```exercicio
id: a83-1
titulo: Validar a assinatura e ler o ponto de entrada
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Em `elf` está montado um cabeçalho ELF. Escreva o código que **valida a assinatura**: compare o dword em `[elf]` com `0x464C457F` (os bytes `7F 45 4C 46` em little-endian). Se bater, leia o `e_entry` (dword em `elf + 0x18`) e guarde-o em `resultado`. Se não bater, deixe `resultado` em 0. O cabeçalho montado tem `e_entry = 0x00102000`, então verifique que `resultado = 0x102000`.
--- inicial
        bits 32
        org 100000h

        ; esi = elf; valide [esi] == 0x464C457F; se ok, resultado = [esi+0x18]

        cli
        hlt

resultado: dd 0

elf:
        db 0x7F, 'E', 'L', 'F', 1, 1, 1, 0
        times 8 db 0
        dw 2                 ; e_type
        dw 3                 ; e_machine
        dd 1                 ; e_version
        dd 0x00102000        ; e_entry
        dd 52                ; e_phoff
        dd 0                 ; e_shoff
        dd 0                 ; e_flags
        dw 52                ; e_ehsize
        dw 32                ; e_phentsize
        dw 1                 ; e_phnum
        dw 0
        dw 0
        dw 0
--- testes
[{ "nome": "resultado = 0x102000", "espera": { "mem": { "resultado": 1056768 } } }]
--- dicas
mov esi, elf / cmp dword [esi], 0x464C457F / jne .fim.
mov eax, [esi+0x18] / mov [resultado], eax.
.fim: cli / hlt.
--- solucao
        bits 32
        org 100000h

        mov  esi, elf
        cmp  dword [esi], 0x464C457F
        jne  .fim
        mov  eax, [esi+0x18]
        mov  [resultado], eax
.fim:
        cli
        hlt

resultado: dd 0

elf:
        db 0x7F, 'E', 'L', 'F', 1, 1, 1, 0
        times 8 db 0
        dw 2
        dw 3
        dd 1
        dd 0x00102000
        dd 52
        dd 0
        dd 0
        dw 52
        dw 32
        dw 1
        dw 0
        dw 0
        dw 0
```

```exercicio
id: a83-2
titulo: Um carregador ELF mínimo
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Em `elf` há um ELF completo com **um** cabeçalho de programa PT_LOAD. Implemente o carregador: leia `e_phoff` (dword em `elf+0x1C`) para achar o cabeçalho de programa; de lá leia `p_offset` (+4), `p_vaddr` (+8) e `p_filesz` (+16); copie `p_filesz` bytes de `elf + p_offset` para `p_vaddr` (use `rep movsb`). O segmento contém o dword `0x1234ABCD` e o `p_vaddr` aponta para o rótulo `destino`. Verifique que `destino = 0x1234ABCD`.
--- inicial
        bits 32
        org 100000h

        ; edx = elf + [elf+0x1C]   (endereço do program header)
        ; esi = elf + [edx+4]      (origem = elf + p_offset)
        ; edi = [edx+8]            (destino = p_vaddr)
        ; ecx = [edx+16]           (p_filesz)
        ; rep movsb

        cli
        hlt

destino: dd 0

elf:
        db 0x7F, 'E', 'L', 'F', 1, 1, 1, 0
        times 8 db 0
        dw 2
        dw 3
        dd 1
        dd destino           ; e_entry
        dd ph - elf          ; e_phoff
        dd 0
        dd 0
        dw 52
        dw 32
        dw 1
        dw 0
        dw 0
        dw 0
ph:
        dd 1                 ; p_type = PT_LOAD
        dd carga - elf       ; p_offset
        dd destino           ; p_vaddr
        dd destino           ; p_paddr
        dd 4                 ; p_filesz
        dd 4                 ; p_memsz
        dd 5                 ; p_flags = R+X
        dd 0x1000            ; p_align
carga:
        dd 0x1234ABCD
--- testes
[{ "nome": "destino = 0x1234ABCD", "espera": { "mem": { "destino": 305441741 } } }]
--- dicas
mov edx, elf / add edx, [elf+0x1C].
mov esi, elf / add esi, [edx+4].
mov edi, [edx+8] / mov ecx, [edx+16] / rep movsb.
--- solucao
        bits 32
        org 100000h

        mov  edx, elf
        add  edx, [elf+0x1C]
        mov  esi, elf
        add  esi, [edx+4]
        mov  edi, [edx+8]
        mov  ecx, [edx+16]
        rep  movsb

        cli
        hlt

destino: dd 0

elf:
        db 0x7F, 'E', 'L', 'F', 1, 1, 1, 0
        times 8 db 0
        dw 2
        dw 3
        dd 1
        dd destino
        dd ph - elf
        dd 0
        dd 0
        dw 52
        dw 32
        dw 1
        dw 0
        dw 0
        dw 0
ph:
        dd 1
        dd carga - elf
        dd destino
        dd destino
        dd 4
        dd 4
        dd 5
        dd 0x1000
carga:
        dd 0x1234ABCD
```

:::resumo
- O **ELF** é o formato de executáveis e objetos do mundo Unix; o seu kernel carrega programas ELF de 32 bits.
- O **cabeçalho ELF** (52 bytes) começa com a assinatura `7F 45 4C 46` e traz `e_entry` (ponto de entrada), `e_phoff` e `e_phnum`.
- Os **cabeçalhos de programa** descrevem os segmentos: `PT_LOAD` com `p_offset`, `p_vaddr`, `p_filesz` e `p_memsz`.
- Carregar = validar a assinatura, copiar cada segmento `PT_LOAD` para `p_vaddr`, zerar o excedente (`p_memsz - p_filesz`, o `.bss`) e saltar para `e_entry`.
:::
