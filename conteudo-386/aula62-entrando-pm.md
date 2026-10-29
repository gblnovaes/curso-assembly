---
id: aula62
numero: 62
modulo: 19
titulo: Entrando no modo protegido de 32 bits
subtitulo: CLI, LGDT, CR0, o salto far e os segmentos recarregados
duracao: 80 min
objetivos: seguir passo a passo a sequência que liga o modo protegido de 32 bits a partir de um setor de boot; entender por que bits 16 e bits 32 convivem no mesmo arquivo; recarregar todos os registradores de segmento e a pilha; escrever na tela de texto sem a BIOS, com endereços de 32 bits; reconhecer as falhas mais comuns dessa transição
---

## A sequência

Todo sistema operacional de 32 bits para PC, do Windows 95 ao Linux, passa por estes passos logo depois do boot. São sempre os mesmos:

1. **`cli`**: a partir do passo 4, uma interrupção procuraria a IDT, que ainda não existe. Desligue antes.
2. **Ligue a A20** (aula 56). Sem ela, todo endereço com o bit 20 ligado cai 1 MB abaixo.
3. **`lgdt [gdtr]`**: diga à CPU onde está a GDT.
4. **`mov eax, cr0` / `or eax, 1` / `mov cr0, eax`**: liga o PE. A partir daqui, a CPU está no modo protegido, mas ainda executa código de 16 bits com o CS antigo.
5. **`jmp 08h:inicio32`**: o salto far carrega CS com o descritor de código de 32 bits e esvazia a fila de instruções.
6. **Recarregue DS, ES, FS, GS e SS** com o seletor de dados, e ponha ESP num lugar seguro.

O passo 5 é o mais delicado. O salto é montado em código de 16 bits (o processador ainda está nele), mas o destino é código de 32 bits. No NASM, isso se resolve com a diretiva `bits`: tudo o que vem depois de `bits 32` é montado para um segmento com D = 1.

```nasm executar modo="boot" titulo="PM32.BIN: do boot ao modo protegido de 32 bits"
        bits 16
        org 7C00h
inicio:
        cli                             ; 1
        xor ax, ax
        mov ds, ax
        in al, 92h                      ; 2: A20 pela porta 92h
        or al, 2
        and al, 0FEh
        out 92h, al
        lgdt [gdtr]                     ; 3
        mov eax, cr0                    ; 4
        or eax, 1
        mov cr0, eax
        jmp 08h:inicio32                ; 5: salto far para código de 32 bits

        bits 32
inicio32:
        mov ax, 10h                     ; 6: todos os segmentos de dados
        mov ds, ax
        mov es, ax
        mov fs, ax
        mov gs, ax
        mov ss, ax
        mov esp, 90000h                 ; pilha abaixo de 640 KB

        mov esi, msg
        mov edi, 0B8000h + (12 * 80 + 20) * 2   ; linha 12, coluna 20
        mov ah, 1Fh
.laco:  lodsb                           ; agora com ESI: código de 32 bits
        test al, al
        jz .fim
        stosw                           ; ES:EDI, 2 bytes por caractere
        jmp .laco
.fim:   cli
        hlt

msg:    db 'Ola do modo protegido de 32 bits!', 0

        align 8
gdt:    dq 0                            ; 00h: nulo
        dq 00CF9A000000FFFFh            ; 08h: código, 32 bits, 4 GB
        dq 00CF92000000FFFFh            ; 10h: dados, 4 GB
gdtr:   dw gdtr - gdt - 1
        dd gdt

        times 510 - ($ - $$) db 0
        dw 0AA55h
```

Execute passo a passo e acompanhe o painel. Depois do `mov cr0, eax`, o MODO vira "modo protegido 16 bits": o PE está ligado, mas o cache de CS ainda descreve um segmento de 16 bits. Só depois do salto far ele vira "modo protegido 32 bits", e os registradores de segmento mostram base 00000000h e limite FFFFFFFFh.

:::cpu O endereço da tela
No modo real, a tela era B800:0000. No modelo plano, com base 0, o endereço linear e o deslocamento são o mesmo número: a tela fica no deslocamento **0B8000h**. É só usar `mov edi, 0B8000h`. Os segmentos sumiram do caminho, e é por isso que esse modelo se chama **plano**: o programa enxerga uma memória única de 4 GB.
:::

## Os erros clássicos

Quase todo mundo erra a primeira vez. A máquina do curso explica o que aconteceu, mas vale saber reconhecer:

| Sintoma | Causa provável |
|---|---|
| exceção logo depois do `mov cr0, eax` | interrupções ligadas: faltou `cli` |
| exceção no salto far | o seletor não aponta para um descritor de código, ou o `gdtr` tem o endereço errado (lembre: endereço linear) |
| instruções sem sentido depois do salto | faltou `bits 32`, ou o descritor de código tem D = 0 |
| #GP ao usar DS | os segmentos não foram recarregados: DS ainda tem o cache do modo real, com limite FFFFh |
| funciona no emulador, trava no PC de verdade | A20 desligada |

Ainda não existe IDT (ela vem no módulo 20), então qualquer exceção nessa fase vira **falha tripla**: a CPU não acha o tratador da exceção, nem o da falha dupla, e desiste. Num PC de verdade, a máquina reinicia sem mensagem nenhuma, e quem programou isso nos anos 90 lembra do PC reiniciando em loop. A máquina do curso para e conta qual foi a primeira exceção. Rode este exemplo:

```nasm executar modo="boot" termina="erro" titulo="ESQUECI.BIN: sem recarregar DS"
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        lgdt [gdtr]
        mov eax, cr0
        or eax, 1
        mov cr0, eax
        jmp 08h:pm
        bits 32
pm:     mov esi, 0B8000h                ; DS ainda tem o limite do modo real: FFFFh
        mov word [esi], 1F41h           ; #GP: B8000h passa do limite
        cli
        hlt
        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
```

```quiz
? Por que o salto far é escrito antes de bits 32 e o código de destino depois?
- Porque o NASM não aceita salto far em bits 32
+ Porque o salto ainda é executado em código de 16 bits; só o destino roda num segmento de código com D = 1
- Por estilo; tanto faz
- Porque bits 32 liga o modo protegido
> A diretiva bits só diz ao montador como codificar as instruções seguintes. Ela não muda nada na CPU. Quem muda é o salto far, que carrega um CS com D = 1.

? Num segmento plano (base 0, limite 4 GB), qual deslocamento acessa o primeiro caractere da tela?
- B800h
- 0000h
+ 0B8000h
- B8000000h
> No modelo plano, deslocamento = endereço linear. A tela de texto fica no endereço físico B8000h.

? Depois de mov cr0, eax com PE = 1, quanto vale o limite do cache de DS até ele ser recarregado?
+ FFFFh, o do modo real
- FFFFFFFFh
- 0
- O limite do descritor 10h
> Mudar o PE não recarrega nenhum registrador de segmento. Os caches continuam com o que o modo real deixou.
```

## Uma rotina de escrita para o modo protegido

Sem a BIOS, até escrever um texto é com você. Uma rotina pequena, que será usada até o fim da trilha, recebe o texto em ESI, a posição em EDI e a cor em AH. O exercício 2 pede para você escrever uma.

## Exercícios

```exercicio
id: a62-1
titulo: Os passos que faltam
nivel: 2
maquina: 386
modo: boot
--- enunciado
O programa já tem a GDT e o código de 32 bits que escreve **PM** na tela. Faltam os passos do meio: carregar a GDT, ligar o PE, saltar para `pm` com o seletor de código e, já em 32 bits, recarregar **DS, ES e SS** com o seletor de dados e apontar ESP para **90000h**.
--- inicial
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        ; faltam os passos aqui

        bits 32
pm:
        ; e a recarga dos segmentos aqui

        mov dword [0B8000h], 1F4D1F50h  ; 'P' 'M'
        cli
        hlt
        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
--- testes
[{ "nome": "PM na tela", "espera": { "tela": "PM", "modoProtegido": true, "cs": 8, "ds": 16, "es": 16, "ss": 16, "esp": 589824 } }]
--- dicas
lgdt [gdtr], depois mov eax, cr0 / or eax, 1 / mov cr0, eax e jmp 08h:pm.
Depois de pm: mov ax, 10h e mov para DS, ES e SS; mov esp, 90000h.
--- solucao
        bits 16
        org 7C00h
        cli
        xor ax, ax
        mov ds, ax
        lgdt [gdtr]
        mov eax, cr0
        or eax, 1
        mov cr0, eax
        jmp 08h:pm
        bits 32
pm:
        mov ax, 10h
        mov ds, ax
        mov es, ax
        mov ss, ax
        mov esp, 90000h
        mov dword [0B8000h], 1F4D1F50h
        cli
        hlt
        align 8
gdt:    dq 0
        dq 00CF9A000000FFFFh
        dq 00CF92000000FFFFh
gdtr:   dw gdtr - gdt - 1
        dd gdt
        times 510 - ($ - $$) db 0
        dw 0AA55h
```

```exercicio
id: a62-2
titulo: escreve, a rotina de texto de 32 bits
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Este programa já começa no modo protegido de 32 bits (modo **pm32**: o carregador fez tudo da aula). Escreva a rotina **escreve**: recebe em ESI um texto terminado em 0, em EDI o endereço na tela e em AH a cor, e escreve o texto. Ela deve devolver EDI apontando para logo depois do último caractere, para dar para escrever em seguida.
--- inicial
        bits 32
        org 100000h
        mov esi, linha1
        mov edi, 0B8000h
        mov ah, 1Eh
        call escreve
        mov esi, linha2
        mov ah, 1Ah
        call escreve                    ; continua de onde parou
        cli
        hlt

escreve:
        ret

linha1: db 'Modo protegido, ', 0
linha2: db 'sem BIOS!', 0
--- testes
[{ "nome": "as duas partes juntas", "espera": { "tela": "Modo protegido, sem BIOS!", "edi": 753714 } }]
--- dicas
Um laço com lodsb: se AL = 0, ret; senão stosw (AL = caractere, AH = cor) e repete.
O stosw já avança EDI de 2 em 2.
--- solucao
        bits 32
        org 100000h
        mov esi, linha1
        mov edi, 0B8000h
        mov ah, 1Eh
        call escreve
        mov esi, linha2
        mov ah, 1Ah
        call escreve
        cli
        hlt

escreve:
        lodsb
        test al, al
        jz .fim
        stosw
        jmp escreve
.fim:   ret

linha1: db 'Modo protegido, ', 0
linha2: db 'sem BIOS!', 0
```

:::resumo
- A sequência: `cli`, A20, `lgdt`, PE no CR0, salto far para código com D = 1, recarga de DS, ES, FS, GS, SS e ESP.
- `bits 16` e `bits 32` dizem ao montador como codificar; quem muda o processador é o salto far.
- No modelo plano, deslocamento = endereço linear. A tela fica em `0B8000h`.
- Até recarregar, os registradores de segmento guardam o cache do modo real.
- O modo **pm32** dos exemplos começa onde esta aula termina.
:::
