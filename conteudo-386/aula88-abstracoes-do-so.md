---
id: aula88
numero: 88
modulo: 27
titulo: As abstrações de um sistema operacional
subtitulo: Processos, arquivos e memória no DOS, no Unix, no Minix, no Linux e no Windows NT
duracao: 65 min
objetivos: comparar como cinco sistemas resolvem processos, arquivos, memória e chamadas de sistema; entender a tabela de descritores de arquivo e a regra do menor descritor livre; implementar dup2 e ver como o shell redireciona a saída
---

## Três abstrações em todo sistema

Um sistema operacional existe para esconder o hardware atrás de poucas ideias simples. Quase todos acabam com as mesmas três:

- **Processo**: um programa em execução, com a sua CPU "virtual".
- **Arquivo**: um nome para guardar dados, ou para falar com um dispositivo.
- **Espaço de endereços**: a memória que o programa enxerga como sua.

O que diferencia o DOS do Unix e do Windows é *como* cada um as implementa. Esta aula as compara lado a lado, com tudo o que você montou até aqui.

```diagrama titulo="Cinco sistemas, três abstrações"
                 criar processo      arquivos            memória do programa
DOS (1981)       EXEC (INT 21h 4Bh)  handles (JFT de 20) real, 1 MB, sem proteção
Unix (1971)      fork + exec         descritores 0,1,2…  virtual, por processo
Minix (1987)     fork + exec         descritores (via    virtual, por processo
                 (mensagem ao PM)    servidor de arquivos)
Linux (1991)     fork/clone + exec   descritores         virtual (3 GB usuário + 1 GB kernel)
Windows NT       CreateProcess       handles de objetos  virtual (2 GB usuário + 2 GB kernel)
(1993)
```

## O DOS: pouca abstração

O DOS roda no modo real: não há anéis, nem paginação, nem proteção de memória. Um programa cabe no primeiro megabyte, escreve onde quiser, e um erro pode derrubar o sistema. Só há um programa por vez; os TSRs (módulo 11) são a gambiarra para ter algo residente.

Mesmo assim o DOS tem **handles de arquivo**, a ideia que ele pegou do Unix na versão 2.0 (1983). Cada programa recebe uma tabela de 20 handles (a *JFT*, guardada no PSP), e os cinco primeiros já vêm abertos: `0` é a entrada padrão, `1` a saída padrão, `2` o erro padrão, `3` a serial e `4` a impressora.

:::anos90 Os pipes do DOS eram de mentira
O DOS 2.0 trouxe também os redirecionamentos (`>`, `<`) e os pipes (`|`), copiados do Unix. Só que o DOS não roda dois programas ao mesmo tempo. Num `dir | sort`, ele rodava o `dir` inteiro gravando a saída num **arquivo temporário**, e só depois rodava o `sort` lendo dele. Funcionava para o usuário, mas o pipe não era um canal entre dois processos, como o buffer circular da aula 85.
:::

## O Unix: tudo é arquivo

A grande ideia do Unix é que **dispositivos, arquivos, pipes e conexões de rede são todos acessados pelo mesmo conjunto de chamadas**: `open`, `read`, `write`, `close`. O terminal é um arquivo (`/dev/tty`), o disco também, e um programa que lê da entrada padrão não sabe, e não precisa saber, se está lendo do teclado, de um arquivo ou de um pipe.

O kernel guarda, para cada processo, uma **tabela de descritores**: um vetor em que o índice (o *descritor*, ou *fd*) aponta para um arquivo aberto. Três descritores nascem abertos: `0` (entrada), `1` (saída) e `2` (erro).

```diagrama titulo="A tabela de descritores de um processo"
fd 0 ──► terminal (entrada)
fd 1 ──► terminal (saída)
fd 2 ──► terminal (erro)
fd 3 ──► (livre)
fd 4 ──► (livre)
```

Duas regras sustentam o shell:

1. `open` devolve **sempre o menor descritor livre**. Se o 3 está livre, o arquivo novo vira o 3; se o 3 está ocupado e o 4 livre, vira o 4. O POSIX exige isso.
2. `dup2(velho, novo)` faz `novo` apontar para o mesmo arquivo que `velho` (fechando o que `novo` apontava antes).

Com essas duas regras o shell implementa `comando > saida.txt`. No processo filho, depois do `fork` e antes do `exec`: abre `saida.txt` (que vira o fd 3), faz `dup2(3, 1)` (agora o fd 1 aponta para o arquivo) e fecha o 3. Quando o `exec` carrega o comando, tudo o que ele escrever no fd 1 vai para o arquivo sem que ele saiba. O programa nunca foi alterado.

## Minix, Linux e Windows NT

- **Minix** (Tanenbaum, 1987) oferece a mesma interface do Unix, mas por dentro é feito de servidores trocando mensagens (aula 86). Nasceu para ensinar: o livro do Tanenbaum traz o código inteiro.
- **Linux** (1991) reimplementa a interface POSIX num kernel monolítico, com módulos carregáveis para os drivers. No 386 a divisão é de 3 GB para o usuário e 1 GB para o kernel.
- **Windows NT** (Dave Cutler, vindo do VMS da DEC, 1993) tem outra filosofia: não há `fork`; o processo nasce de `CreateProcess`. Em vez de "tudo é arquivo", é "tudo é objeto": arquivos, eventos, processos e threads são objetos do kernel, acessados por **handles** numa tabela por processo, que é o primo do descritor do Unix. Ele nasceu com uma camada **HAL** que isola o kernel do hardware.

:::cpu Por que a divisão 3 GB / 1 GB?
Com a paginação (módulo 21), cada processo tem o seu CR3 e a sua visão de 4 GB. Para que a chamada de sistema não precise trocar de espaço de endereços, o kernel é mapeado **em todos** os processos, na parte alta (acima de `0xC0000000` no Linux). Os 3 GB de baixo são do usuário. O bit U/S dos descritores de página (aula 68) impede o anel 3 de tocar na parte do kernel.
:::

```quiz
? Por que o shell consegue redirecionar a saída de um programa (comando > arquivo) sem alterá-lo?
+ Antes do exec, o filho abre o arquivo e usa dup2 para fazer o descritor 1 apontar para ele; o programa continua escrevendo no fd 1
- Porque o programa lê o nome do arquivo na linha de comando
- Porque o shell copia a tela para o arquivo no fim
- Porque o kernel troca o programa por outro

? O que o POSIX exige que open() devolva?
+ O menor número de descritor que esteja livre
- Sempre o número 3
- Um número escolhido ao acaso
- O maior descritor livre

? Qual é a diferença de filosofia entre o Unix e o Windows NT sobre arquivos?
+ No Unix tudo é arquivo e acessado por descritores; no NT tudo é objeto do kernel, acessado por handles de uma tabela por processo
- O NT não tem arquivos
- O Unix não permite dispositivos
- Os dois usam exatamente o mesmo mecanismo
```

## Exercícios

```exercicio
id: a88-1
titulo: O menor descritor livre
nivel: 3
maquina: 386
modo: pm32
--- enunciado
A `fdtab` tem 8 entradas de 1 byte: `1` significa ocupado e `0` livre. Os descritores 0, 1 e 2 já estão abertos. Implemente `fd_abre`, que procura o **menor** descritor livre, marca-o como ocupado (`1`) e devolve o número em EAX; e `fd_fecha(fd)`, que marca a entrada como livre. O programa abre duas vezes (guardando em `a` e `b`), fecha o descritor 3 e abre de novo (guardando em `c`). Verifique `a = 3`, `b = 4` e `c = 3`: depois do `close(3)`, o menor livre volta a ser o 3.
--- inicial
        bits 32
        org 100000h

        call fd_abre
        mov  [a], eax
        call fd_abre
        mov  [b], eax
        push dword 3
        call fd_fecha
        add  esp, 4
        call fd_abre
        mov  [c], eax
        cli
        hlt

fd_abre:
        ; varra fdtab do 0 ao 7; no primeiro 0: marque 1 e devolva o índice
        mov  eax, -1
        ret

fd_fecha:
        ; fdtab[fd] = 0
        ret

fdtab: db 1, 1, 1, 0, 0, 0, 0, 0
a: dd 0
b: dd 0
c: dd 0
--- testes
[{ "nome": "a = 3, b = 4, c = 3", "espera": { "mem": { "a": 3, "b": 4, "c": 3 } } }]
--- dicas
fd_abre: xor eax, eax / .l: cmp byte [fdtab+eax], 0 / je .achou / inc eax / cmp eax, 8 / jb .l / mov eax, -1 / ret.
.achou: mov byte [fdtab+eax], 1 / ret.
fd_fecha: mov eax, [esp+4] / mov byte [fdtab+eax], 0 / ret.
--- solucao
        bits 32
        org 100000h

        call fd_abre
        mov  [a], eax
        call fd_abre
        mov  [b], eax
        push dword 3
        call fd_fecha
        add  esp, 4
        call fd_abre
        mov  [c], eax
        cli
        hlt

fd_abre:
        xor  eax, eax
.laco:
        cmp  byte [fdtab+eax], 0
        je   .achou
        inc  eax
        cmp  eax, 8
        jb   .laco
        mov  eax, -1
        ret
.achou:
        mov  byte [fdtab+eax], 1
        ret

fd_fecha:
        mov  eax, [esp+4]
        mov  byte [fdtab+eax], 0
        ret

fdtab: db 1, 1, 1, 0, 0, 0, 0, 0
a: dd 0
b: dd 0
c: dd 0
```

```exercicio
id: a88-2
titulo: dup2 e o redirecionamento do shell
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Agora a `fdtab` é uma tabela de **dwords** que guarda o número do *arquivo aberto*: `0` é o terminal e `1` é `saida.txt`. Os descritores 0, 1 e 2 apontam para o terminal; o 3 aponta para o arquivo (o shell acabou de abri-lo); os demais valem `-1` (fechado). Implemente `dup2(velho, novo)` (`fdtab[novo] = fdtab[velho]`) e `escreve(fd)`, que soma 1 ao contador `escritas[fdtab[fd]]` do arquivo aberto a que o descritor aponta. O programa faz o que o shell faz em `comando > saida.txt`: `dup2(3, 1)`, fecha o 3 e depois escreve duas vezes no fd 1 e uma no fd 2. Verifique `escritas = [1, 2]`: o terminal recebeu só a escrita do erro, e o arquivo recebeu as duas da saída.
--- inicial
        bits 32
        org 100000h

        push dword 1            ; novo
        push dword 3            ; velho
        call dup2
        add  esp, 8
        mov  dword [fdtab+3*4], -1     ; close(3)

        push dword 1
        call escreve
        add  esp, 4
        push dword 1
        call escreve
        add  esp, 4
        push dword 2
        call escreve
        add  esp, 4
        cli
        hlt

dup2:
        ; fdtab[novo] = fdtab[velho]
        ret

escreve:
        ; escritas[fdtab[fd]]++
        ret

fdtab:    dd 0, 0, 0, 1, -1, -1, -1, -1
escritas: db 0, 0
--- testes
[{ "nome": "escritas = [1, 2]", "espera": { "mem": { "escritas": [1, 2] } } }]
--- dicas
dup2: mov eax, [esp+4] / mov edx, [fdtab+eax*4] / mov eax, [esp+8] / mov [fdtab+eax*4], edx / ret.
escreve: mov eax, [esp+4] / mov eax, [fdtab+eax*4] / inc byte [escritas+eax] / ret.
--- solucao
        bits 32
        org 100000h

        push dword 1
        push dword 3
        call dup2
        add  esp, 8
        mov  dword [fdtab+3*4], -1

        push dword 1
        call escreve
        add  esp, 4
        push dword 1
        call escreve
        add  esp, 4
        push dword 2
        call escreve
        add  esp, 4
        cli
        hlt

dup2:
        mov  eax, [esp+4]
        mov  edx, [fdtab+eax*4]
        mov  eax, [esp+8]
        mov  [fdtab+eax*4], edx
        ret

escreve:
        mov  eax, [esp+4]
        mov  eax, [fdtab+eax*4]
        inc  byte [escritas+eax]
        ret

fdtab:    dd 0, 0, 0, 1, -1, -1, -1, -1
escritas: db 0, 0
```

:::resumo
- Todo sistema oferece **processos**, **arquivos** e **espaços de endereços**; o DOS (modo real, sem proteção, só um programa por vez) tem o mínimo, e o Unix, o Minix, o Linux e o Windows NT têm memória virtual por processo.
- No **Unix** tudo é arquivo e acessado por **descritores**: a tabela do processo tem 0 (entrada), 1 (saída) e 2 (erro) abertos, e `open` devolve sempre o **menor descritor livre**.
- O shell implementa `comando > arquivo` com **`dup2`**: depois do `fork` e antes do `exec`, o filho faz o descritor 1 apontar para o arquivo, e o programa nunca percebe.
- O **Windows NT** troca "tudo é arquivo" por "tudo é objeto" (handles numa tabela por processo) e cria processos com `CreateProcess`, sem `fork`.
- O DOS 2.0 copiou handles, redirecionamento e pipes do Unix, mas seus pipes eram arquivos temporários.
:::
