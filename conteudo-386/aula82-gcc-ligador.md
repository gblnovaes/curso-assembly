---
id: aula82
numero: 82
modulo: 25
titulo: GCC cruzado e o ligador
subtitulo: Compilar C para o seu kernel, juntar objetos com o ld e fazer C e Assembly se chamarem
duracao: 65 min
objetivos: entender por que um kernel precisa de um compilador cruzado freestanding; conhecer o fluxo compilar → montar → ligar; ler um script de ligação com .text, .rodata, .data e .bss; chamar Assembly a partir do C e vice-versa respeitando o cdecl
---

## Por que um compilador *cruzado*?

O GCC que vem na sua distribuição Linux produz programas **para o Linux**: eles esperam a libc, chamadas de sistema, um carregador dinâmico. Nada disso existe dentro de um kernel que você está escrevendo do zero. Você precisa de um GCC **cruzado** e **freestanding**:

- **cruzado** (*cross*): roda na sua máquina, mas gera código para um alvo "nu", o `i686-elf` (um 386 sem sistema operacional).
- **freestanding**: sem a biblioteca padrão, sem `main` mágico, sem `_start` da libc. Só o C puro da linguagem (`int`, ponteiros, structs) mais o que você mesmo escrever.

```diagrama titulo="A toolchain cruzada de um kernel"
i686-elf-gcc   — compilador C para o alvo i686-elf (freestanding)
i686-elf-ld    — ligador: junta os .o num executável ELF
i686-elf-as    — montador GNU (ou use o nasm para os .asm)
i686-elf-objcopy — extrai o binário puro do ELF, se o boot precisar
```

Construir essa toolchain é compilar o binutils e o GCC com `--target=i686-elf`. É um passo único, feito uma vez, e documentado no projeto externo do curso (o kernel de verdade roda no QEMU, não no simulador desta trilha).

## O fluxo: compilar, montar, ligar

Cada arquivo vira um **objeto** (`.o`): um pedaço de código com a tabela do que ele oferece (`global`) e do que ele precisa de fora (`extern`), mas ainda **sem endereços finais**. O ligador junta todos, resolve os `extern` e fixa os endereços.

```diagrama titulo="Do código-fonte ao kernel.bin"
kernel.c  --i686-elf-gcc -ffreestanding-->  kernel.o
boot.asm  --nasm -f elf32-------------->    boot.o
           i686-elf-ld -T link.ld kernel.o boot.o  ->  kernel.elf
                                                         |
                                       objcopy -O binary  ->  kernel.bin
```

:::atencao `-ffreestanding` e as suposições do GCC
Sem `-ffreestanding`, o GCC supõe que funções como `memcpy`, `memset` e `memcmp` existem e pode até **trocar** o seu laço de cópia por uma chamada a `memcpy`. Num kernel isso gera um `extern memcpy` que não existe e o ligador reclama. Com `-ffreestanding` (e `-nostdlib` no ligador) o compilador para de supor a libc — mas você ainda precisa fornecer essas poucas funções, porque o GCC pode chamá-las mesmo assim.
:::

## O script de ligação

O ligador precisa saber **onde** na memória o kernel vai morar e em que ordem pôr as seções. Isso é um *linker script*:

```diagrama titulo="link.ld — um script de ligação mínimo"
ENTRY(_start)                /* símbolo de entrada */
SECTIONS {
  . = 0x100000;              /* o kernel começa em 1 MiB */
  .text   : { *(.text) }     /* código */
  .rodata : { *(.rodata) }   /* constantes só-leitura */
  .data   : { *(.data) }     /* dados inicializados */
  .bss    : { *(.bss)  }     /* dados zerados (não ocupam o arquivo) */
}
```

As quatro seções aparecem em todo programa compilado:

| Seção | O que guarda | No arquivo? |
|-------|--------------|-------------|
| `.text` | código executável | sim |
| `.rodata` | constantes (`const`, literais de string) | sim |
| `.data` | variáveis globais com valor inicial | sim |
| `.bss` | variáveis globais zeradas | **não** (só o tamanho; o kernel zera na partida) |

O `1 MiB` (`0x100000`) não é por acaso: é o mesmo `org 100000h` que usamos nos exemplos `pm32` desta trilha, logo acima da memória baixa onde ficam a BIOS, a VGA e as tabelas.

## C e Assembly se chamando

Como as duas linguagens seguem o mesmo contrato cdecl (aula anterior), elas se chamam direto. Em NASM, `global` **oferece** um símbolo ao ligador e `extern` **importa** um de outro objeto:

```nasm fragmento titulo="soma.asm: uma função chamável pelo C"
        global soma            ; o C poderá chamar soma()
soma:                          ; int soma(int a, int b)
        mov eax, [esp+4]       ; a  (sem prólogo: função folha simples)
        add eax, [esp+8]       ; + b
        ret
```

```diagrama titulo="E o C que a usa"
extern int soma(int, int);     /* prometo que existe em outro objeto */
int total = soma(2, 3);        /* o GCC empilha 3, 2, chama, lê EAX */
```

No sentido contrário, o Assembly chama uma função do C com `extern` e o mesmo protocolo de empilhar/chamar/limpar. O ligador cola as duas pontas.

:::cpu Por que `[esp+4]` e não `[ebp+8]` aqui?
A função `soma` acima não monta quadro de pilha (não faz `push ebp`). Então o endereço de retorno está em `[esp]`, o 1º argumento em `[esp+4]` e o 2º em `[esp+8]`. É uma otimização comum em funções-folha curtas; o compilador faz isso o tempo todo com `-O2`. Se você empilhar qualquer coisa antes de ler os argumentos, os deslocamentos mudam — por isso o quadro com EBP é mais seguro.
:::

```quiz
? Por que um kernel precisa de um GCC cruzado freestanding em vez do GCC normal?
+ O GCC normal gera código que depende da libc e do SO; o freestanding gera só o C puro, sem supor nenhum sistema por baixo
- Porque o GCC normal não compila arquivos .asm
- Porque o alvo i686-elf é mais rápido que o x86-64
- Porque só o GCC cruzado aceita ponteiros

? O que o ligador (ld) faz que o compilador sozinho não faz?
+ Junta vários objetos, resolve os símbolos extern entre eles e fixa os endereços finais conforme o linker script
- Traduz C para Assembly
- Zera a seção .bss na partida do kernel
- Gera o código de máquina a partir do .c

? Por que a seção .bss não ocupa espaço no arquivo do kernel?
+ Ela só guarda variáveis globais zeradas; basta registrar o tamanho e o kernel zera a região na partida
- Porque .bss é opcional e quase nunca é usada
- Porque o ligador a comprime
- Porque ela fica na memória baixa, abaixo de 1 MiB
```

## Exercícios

```exercicio
id: a82-1
titulo: Devolver um valor de 64 bits em EDX:EAX
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Um `int` de 32 bits volta em EAX, mas um produto de dois valores de 32 bits pode ter até 64 bits — e o cdecl manda devolvê-lo em **EDX:EAX** (parte alta em EDX, baixa em EAX). Implemente `mult64(a, b)` que faz `EDX:EAX = a * b` usando a instrução `mul` (que calcula EDX:EAX = EAX × operando, sem sinal). O chamador já chama `mult64(0x100000, 0x1000)` e guarda a parte baixa em `res_lo` e a alta em `res_hi`. Como `0x100000 * 0x1000 = 0x100000000`, verifique que `res_lo = 0` e `res_hi = 1`.
--- inicial
        bits 32
        org 100000h

        push dword 0x1000      ; b
        push dword 0x100000    ; a
        call mult64
        add  esp, 8
        mov  [res_lo], eax
        mov  [res_hi], edx
        cli
        hlt

mult64:
        push ebp
        mov  ebp, esp
        ; eax = a ; mul (b)  → EDX:EAX = a * b
        leave
        ret

res_lo: dd 0
res_hi: dd 0
--- testes
[
  { "nome": "res_lo = 0", "espera": { "mem": { "res_lo": 0 } } },
  { "nome": "res_hi = 1", "espera": { "mem": { "res_hi": 1 } } }
]
--- dicas
mov eax, [ebp+8] (a) / mov ecx, [ebp+12] (b) / mul ecx.
mul ecx faz EDX:EAX = EAX * ECX; a parte alta cai sozinha em EDX.
--- solucao
        bits 32
        org 100000h

        push dword 0x1000
        push dword 0x100000
        call mult64
        add  esp, 8
        mov  [res_lo], eax
        mov  [res_hi], edx
        cli
        hlt

mult64:
        push ebp
        mov  ebp, esp
        mov  eax, [ebp+8]
        mov  ecx, [ebp+12]
        mul  ecx
        leave
        ret

res_lo: dd 0
res_hi: dd 0
```

```exercicio
id: a82-2
titulo: Chamar uma função por ponteiro
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Em C, um **ponteiro para função** é só um endereço que você chama com `call`. É assim que o `qsort` recebe o comparador e que o kernel instala *callbacks*. Implemente `aplica(f, x)`: recebe em `[ebp+8]` o endereço de uma função e em `[ebp+12]` um argumento `x`; deve chamar `f(x)` (empilhar x, `call`, limpar a pilha) e devolver o que `f` devolveu. O chamador faz `aplica(dobro, 21)`, onde `dobro(n)=2n`, e guarda o resultado em `resultado`. Verifique que `resultado = 42`.
--- inicial
        bits 32
        org 100000h

        push dword 21          ; x
        push dword dobro       ; f (endereço da função)
        call aplica
        add  esp, 8
        mov  [resultado], eax
        cli
        hlt

dobro:
        mov  eax, [esp+4]
        add  eax, eax
        ret

aplica:
        push ebp
        mov  ebp, esp
        ; empilhe x ([ebp+12]), chame a função em [ebp+8], limpe a pilha
        ; o retorno de f já estará em EAX
        leave
        ret

resultado: dd 0
--- testes
[{ "nome": "resultado = 42", "espera": { "mem": { "resultado": 42 } } }]
--- dicas
mov eax, [ebp+8] (ponteiro de f) / push dword [ebp+12] (x) / call eax / add esp, 4.
O valor devolvido por f fica em EAX, que já é o retorno de aplica.
--- solucao
        bits 32
        org 100000h

        push dword 21
        push dword dobro
        call aplica
        add  esp, 8
        mov  [resultado], eax
        cli
        hlt

dobro:
        mov  eax, [esp+4]
        add  eax, eax
        ret

aplica:
        push ebp
        mov  ebp, esp
        mov  eax, [ebp+8]
        push dword [ebp+12]
        call eax
        add  esp, 4
        leave
        ret

resultado: dd 0
```

:::resumo
- Um kernel usa um GCC **cruzado** e **freestanding** (`i686-elf-gcc -ffreestanding`): código para um 386 nu, sem libc nem suposições de sistema.
- O fluxo é **compilar** (`.c` → `.o`) e **montar** (`.asm` → `.o`), depois **ligar** (`ld -T link.ld`) para juntar os objetos, resolver os `extern` e fixar os endereços.
- O **linker script** define o endereço de carga (1 MiB) e a ordem das seções `.text`, `.rodata`, `.data` e `.bss`; a `.bss` não ocupa o arquivo, só é zerada na partida.
- C e Assembly se chamam direto porque seguem o mesmo cdecl: `global` oferece um símbolo e `extern` importa um de outro objeto.
- Um valor de 64 bits volta em **EDX:EAX**; um **ponteiro para função** é chamado com `call` sobre um registrador.
:::
