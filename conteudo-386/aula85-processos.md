---
id: aula85
numero: 85
modulo: 26
titulo: Processos: fork, exec e um shell
subtitulo: A tabela de processos, o par fork/exec que cria programas e o pipe que os liga
duracao: 70 min
objetivos: entender o modelo de processos do Unix e a tabela de processos; distinguir fork (duplicar) de exec (substituir a imagem); entender como um shell usa fork+exec+wait; implementar a alocação de um processo e um pipe como buffer circular
---

## O modelo de processos do Unix

Juntando tudo da trilha — anéis (módulo 22), troca de contexto (23) e carregamento de ELF (aula 83) — dá para montar o que um Unix chama de **processo**: um programa em execução, com o seu espaço de endereços, a sua pilha e uma entrada numa **tabela de processos** do kernel.

Cada entrada (o *process control block*, PCB, que já vimos no escalonador) guarda o estado do processo:

```diagrama titulo="Uma entrada da tabela de processos (PCB)"
pid        — número do processo
estado     — LIVRE, PRONTO, RODANDO ou BLOQUEADO
esp        — pilha salva (para a troca de contexto)
cr3        — diretório de páginas (o espaço de endereços)
pai        — pid do processo que o criou
```

Criar um processo no Unix é surpreendentemente elegante: não há uma chamada "crie e rode o programa X". Há **duas** chamadas menores que se combinam.

## fork: duplicar

`fork()` cria um processo **filho que é uma cópia** do pai: mesma memória, mesmos registradores, mesmo ponto de execução. A única diferença é o valor de retorno:

```diagrama titulo="O retorno duplo do fork"
pid = fork();
   no PAI:   pid = número do filho (ex.: 42)
   no FILHO: pid = 0
```

Depois do `fork`, **os dois** processos continuam da mesma linha, e cada um descobre quem é pelo valor de `pid`. É o único lugar em que uma função "retorna duas vezes".

## exec: substituir

`exec()` **substitui** a imagem do processo atual por um novo programa: descarta a memória antiga, carrega o ELF (aula 83), monta uma pilha nova e salta para o `e_entry`. O pid não muda — é o mesmo processo vestindo outra roupa. Se der certo, `exec` **nunca volta** (não há para onde voltar: o código que o chamou deixou de existir).

## O shell é só fork + exec + wait

Com essas duas peças, o shell que roda os seus comandos é um laço de poucas linhas:

```diagrama titulo="O coração de um shell"
repita:
    escreva o prompt "$ "
    leia uma linha de comando
    pid = fork()
    se pid == 0:                 // filho
        exec(comando)            // vira o programa; não volta
    senão:                       // pai
        wait(pid)                // espera o filho terminar
```

O pai (o shell) se duplica, o filho vira o programa pedido, e o shell espera. Quando o programa acaba, o `wait` volta e o laço recomeça. Todo shell do Unix — do `sh` ao `bash` — é, no fundo, isto.

:::anos90 fork e a memória que não se copia
Copiar toda a memória do pai a cada `fork` seria caríssimo, ainda mais quando o filho vai logo chamar `exec` e jogar tudo fora. A solução, chamada **copy-on-write**, usa a paginação (módulo 21): o filho compartilha as páginas do pai marcadas como só-leitura, e só quando um dos dois **escreve** é que aquela página é copiada de verdade. O `fork` fica quase instantâneo. Foi uma das grandes ideias do Unix BSD.
:::

## Pipes: ligar dois processos

O `ls | sort` conecta a saída do `ls` à entrada do `sort`. Essa ligação é um **pipe**: um buffer no kernel onde um processo escreve e outro lê, em ordem FIFO. Na prática é um **buffer circular** — um vetor com um índice de escrita (cabeça) e um de leitura (cauda) que avançam e dão a volta:

```diagrama titulo="Um pipe é um buffer circular"
buffer: [ _ _ _ _ _ _ _ _ ]   capacidade 8
         ↑cauda (lê)  ↑cabeça (escreve)
escrever: buffer[cabeça % cap] = byte; cabeça++
ler:      byte = buffer[cauda % cap];  cauda++
```

Quando a capacidade é uma potência de 2, o `% cap` vira um `and cap-1` — barato e sem divisão.

```quiz
? O que o fork() faz e o que ele retorna?
+ Cria um processo filho que é cópia do pai; retorna o pid do filho ao pai e 0 ao filho
- Carrega um novo programa por cima do processo atual
- Retorna sempre 0 e cria um processo vazio
- Espera o processo filho terminar

? Por que exec() normalmente não retorna?
+ Porque substitui a imagem do processo pelo novo programa; o código que o chamou deixou de existir
- Porque sempre falha na primeira tentativa
- Porque ele bloqueia esperando o filho
- Porque o pid muda e o kernel perde o processo

? Como um shell roda o comando que você digita?
+ Faz fork; no filho chama exec(comando); no pai chama wait até o filho terminar
- Chama exec diretamente, sem fork, e perde o shell
- Copia o programa para 0x7C00 e dá um jmp
- Cria uma thread nova dentro do próprio shell
```

## Exercícios

```exercicio
id: a85-1
titulo: Alocar um processo na tabela
nivel: 3
maquina: 386
modo: pm32
--- enunciado
A `tabela` tem 4 entradas de 8 bytes cada: `dd estado` (0 = livre, 1 = usado) e `dd pid`. O slot 0 já está ocupado pelo processo inicial (estado 1, pid 1). Implemente `fork`: varre a tabela, acha o primeiro slot **livre**, marca `estado = 1`, atribui o pid de `prox_pid` (e incrementa `prox_pid`), e devolve o pid em EAX. Chame `fork` duas vezes, guardando os retornos em `pid_a` e `pid_b`. Verifique que `pid_a = 2` e `pid_b = 3`.
--- inicial
        bits 32
        org 100000h

        call fork
        mov  [pid_a], eax
        call fork
        mov  [pid_b], eax
        cli
        hlt

MAX equ 4
fork:
        ; ecx = índice; procure estado livre em [tabela + ecx*8]
        ; ao achar: estado=1, pid=[prox_pid], prox_pid++, eax=pid
        ret

tabela:
        dd 1, 1                 ; slot 0: processo inicial (usado, pid 1)
        times (MAX-1)*2 dd 0    ; slots 1..3 livres
prox_pid: dd 2
pid_a: dd 0
pid_b: dd 0
--- testes
[
  { "nome": "pid_a = 2", "espera": { "mem": { "pid_a": 2 } } },
  { "nome": "pid_b = 3", "espera": { "mem": { "pid_b": 3 } } }
]
--- dicas
xor ecx, ecx / .b: cmp ecx, MAX / jae .fim / mov edx, ecx / shl edx, 3.
cmp dword [tabela+edx], 0 / je .achou / inc ecx / jmp .b.
.achou: mov dword [tabela+edx], 1 / mov eax, [prox_pid] / mov [tabela+edx+4], eax / inc dword [prox_pid] / ret.
--- solucao
        bits 32
        org 100000h

        call fork
        mov  [pid_a], eax
        call fork
        mov  [pid_b], eax
        cli
        hlt

MAX equ 4
fork:
        xor  ecx, ecx
.busca:
        cmp  ecx, MAX
        jae  .fim
        mov  edx, ecx
        shl  edx, 3
        cmp  dword [tabela+edx], 0
        je   .achou
        inc  ecx
        jmp  .busca
.achou:
        mov  dword [tabela+edx], 1
        mov  eax, [prox_pid]
        mov  [tabela+edx+4], eax
        inc  dword [prox_pid]
        ret
.fim:
        xor  eax, eax
        ret

tabela:
        dd 1, 1
        times (MAX-1)*2 dd 0
prox_pid: dd 2
pid_a: dd 0
pid_b: dd 0
```

```exercicio
id: a85-2
titulo: Um pipe como buffer circular
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Implemente as duas rotinas de um pipe de capacidade 8. `pipe_escreve` grava o byte de AL em `buffer[cabeca % 8]` e incrementa `cabeca`. `pipe_le` lê o byte de `buffer[cauda % 8]`, incrementa `cauda` e devolve o byte em AL. Como 8 é potência de 2, `% 8` é `and 7`. O programa principal (pronto) escreve `'A'`, `'B'`, `'C'` no pipe e depois lê três bytes de volta para `saida`. Verifique que `saida` contém `"ABC"` (ordem FIFO preservada).
--- inicial
        bits 32
        org 100000h

        mov  esi, fonte
        mov  ecx, 3
.esc:
        mov  al, [esi]
        call pipe_escreve
        inc  esi
        loop .esc

        mov  edi, saida
        mov  ecx, 3
.ler:
        call pipe_le
        mov  [edi], al
        inc  edi
        loop .ler

        cli
        hlt

pipe_escreve:
        ; edx = cabeca & 7; buffer[edx] = al; cabeca++
        ret

pipe_le:
        ; edx = cauda & 7; al = buffer[edx]; cauda++
        ret

fonte:  db 'A', 'B', 'C'
buffer: times 8 db 0
cabeca: dd 0
cauda:  dd 0
saida:  times 3 db 0
--- testes
[{ "nome": "saida = ABC", "espera": { "mem": { "saida": "ABC" } } }]
--- dicas
pipe_escreve: mov edx, [cabeca] / and edx, 7 / mov [buffer+edx], al / inc dword [cabeca] / ret.
pipe_le: mov edx, [cauda] / and edx, 7 / mov al, [buffer+edx] / inc dword [cauda] / ret.
--- solucao
        bits 32
        org 100000h

        mov  esi, fonte
        mov  ecx, 3
.esc:
        mov  al, [esi]
        call pipe_escreve
        inc  esi
        loop .esc

        mov  edi, saida
        mov  ecx, 3
.ler:
        call pipe_le
        mov  [edi], al
        inc  edi
        loop .ler

        cli
        hlt

pipe_escreve:
        mov  edx, [cabeca]
        and  edx, 7
        mov  [buffer+edx], al
        inc  dword [cabeca]
        ret

pipe_le:
        mov  edx, [cauda]
        and  edx, 7
        mov  al, [buffer+edx]
        inc  dword [cauda]
        ret

fonte:  db 'A', 'B', 'C'
buffer: times 8 db 0
cabeca: dd 0
cauda:  dd 0
saida:  times 3 db 0
```

:::resumo
- Um **processo** é um programa em execução com uma entrada (PCB) na **tabela de processos**: pid, estado, esp, cr3 e pai.
- **fork** duplica o processo (retorna o pid do filho ao pai e 0 ao filho); **exec** substitui a imagem pelo novo programa (carrega o ELF e salta para `e_entry`, sem voltar).
- Um **shell** é um laço de `fork` + `exec` (no filho) + `wait` (no pai).
- O **copy-on-write** usa a paginação para que o `fork` não copie a memória toda de uma vez.
- Um **pipe** liga dois processos por um **buffer circular** FIFO, com índices de cabeça (escrita) e cauda (leitura).
:::
