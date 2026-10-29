---
id: aula68
numero: 68
modulo: 21
titulo: Ativando a paginação no 386
subtitulo: CR3, diretório de páginas, tabelas de páginas e o mapa idêntico
duracao: 75 min
objetivos: entender o mecanismo de paginação de dois níveis do 386; montar um diretório de páginas e uma tabela de páginas na memória física; carregar CR3 e ligar o bit PG no CR0; verificar que endereços lineares e físicos coincidem no mapa idêntico
---

## O que é paginação?

A **paginação** é um mecanismo pelo qual a CPU traduz endereços *lineares* (gerados pela segmentação) em endereços *físicos* (fios na placa). Com paginação:

- A memória é dividida em blocos de **4 KB** chamados *páginas*.
- Um processo pode ter páginas físicas espalhadas pela RAM mas enxergar um espaço de endereços contínuo.
- Páginas podem ser marcadas como somente-leitura, não-presentes, ou pertencentes ao usuário/kernel.

Sem paginação (que é o padrão depois de entrar no modo protegido) os endereços lineares já são os físicos. Para ativar a paginação, escrevemos o bit **PG** (bit 31 do CR0).

## A estrutura de dois níveis

O 386 usa uma tabela de dois níveis para traduzir um endereço linear de 32 bits:

```diagrama titulo="Tradução de endereço linear para físico"
endereço linear de 32 bits:
 bits 31:22      bits 21:12       bits 11:0
+------------+---------------+---------------+
|  índice PD |   índice PT   |    offset     |
| (10 bits)  |   (10 bits)   |   (12 bits)   |
+------------+---------------+---------------+
       |               |               |
       v               v               |
  CR3 → PD[i] → PT[j] → frame 4 KB    |
                        └──────────────+→ endereço físico
```

- **CR3**: aponta para o *diretório de páginas* (PD) — alinhado em 4 KB.
- **PD**: 1024 entradas de 4 bytes (= 4 KB); cada entrada aponta para uma *tabela de páginas* (PT).
- **PT**: 1024 entradas de 4 bytes (= 4 KB); cada entrada aponta para um *frame* físico de 4 KB.

## O formato de PDE e PTE

```diagrama titulo="Formato de uma entrada PDE ou PTE (32 bits)"
bit 31:12         bit 11:9  bit 8  bit 7  bit 6  bit 5  bit 4  bit 3  bit 2  bit 1  bit 0
+---------------+----------+------+------+------+------+------+------+------+------+------+
| endereço 31:12| ignorados|  G   |  PS  |  D   |  A   |  PCD | PWT  |  U/S |  R/W |  P   |
+---------------+----------+------+------+------+------+------+------+------+------+------+
  frame físico               global  4MB  dirty  acess.  cache  WT   usuário  escrit. presente
  (ou base PT)                      (PDE) (PTE)  CPU seta
```

Os bits mais relevantes:

| Bit | Nome | Efeito |
|---|---|---|
| 0 | **P** | 1 = página presente; 0 = #PF ao acessar |
| 1 | **R/W** | 1 = leitura e escrita; 0 = somente leitura (anel 3) |
| 2 | **U/S** | 1 = acessível pelo anel 3; 0 = somente kernel |
| 5 | **A** | CPU seta a 1 no primeiro acesso |
| 6 | **D** (PTE) | CPU seta a 1 na primeira escrita (*dirty*) |

Para uma página simples do kernel: `endereço_frame | 3` (P=1, R/W=1).

## O CR3

```diagrama titulo="Registrador CR3 (PDBR)"
bit 31:12        bit 4  bit 3  bit 2:0
+-------------+-------+-------+--------+
|  base do PD |  PCD  |  PWT  |   000  |
+-------------+-------+-------+--------+
 endereço físico ÷ 4096  cache  write-t.  reservados (zero)
```

- Os 20 bits superiores são o endereço físico do diretório de páginas dividido por 4096 (deve estar alinhado em 4 KB).
- Escrever em CR3 invalida toda a TLB (*Translation Lookaside Buffer*), o cache de traduções da CPU.

## Habilitando a paginação

A sequência para ligar a paginação é sempre:

1. Montar o diretório de páginas (PD) e as tabelas de páginas (PT) na memória física.
2. Carregar CR3 com o endereço físico do PD.
3. Setar o bit 31 (PG) no CR0.

```nasm executar modo="pm32" titulo="PG.BIN: mapa idêntico de 4 MB e paginação ligada"
        bits 32
        org 100000h

        ; --- PT0 em 0x201000: mapa idêntico 4 MB (virtual 0-3FFFFFh = físico) ---
        mov edi, 201000h
        xor eax, eax            ; frame 0 (endereço físico)
.pt:    mov edx, eax
        or  edx, 3              ; P=1, R/W=1
        mov [edi], edx
        add edi, 4
        add eax, 1000h          ; próximo frame (+4 KB)
        cmp eax, 400000h        ; até 4 MB (1024 páginas)
        jb .pt

        ; --- PD em 0x200000: PDE[0] aponta para PT0 ---
        ; (demais entradas já são zero = P=0 = não presentes)
        mov dword [200000h], 201003h    ; PT0 | P=1 | R/W=1

        ; --- CR3 e bit PG ---
        mov eax, 200000h
        mov cr3, eax

        mov eax, cr0
        or  eax, 80000000h      ; bit 31 = PG
        mov cr0, eax

        ; paginação ativa; endereços lineares == físicos (mapa idêntico)
        mov dword [300000h], 0DEADBEEFh
        mov eax, [300000h]
        cmp eax, 0DEADBEEFh
        jne .erro

        mov byte [0B8000h], 'P'
        mov byte [0B8001h], 0Ah
        cli
        hlt

.erro:  mov byte [0B8000h], '?'
        mov byte [0B8001h], 0Ch
        cli
        hlt
```

:::cpu Por que o mapa idêntico?
Quando o bit PG é ligado, a CPU *imediatamente* começa a usar a tabela de páginas para traduzir endereços. Se o endereço da próxima instrução (`EIP`) não estiver mapeado, a CPU trava com #PF antes de executar qualquer coisa. O mapa idêntico (linear == físico) garante que EIP 0x100000 continue apontando para o mesmo código depois que PG é ligado.
:::

## O alias de páginas

Como dois endereços lineares diferentes podem apontar para o mesmo frame físico, você pode criar *aliases* — duas "janelas" para a mesma memória física:

```nasm fragmento titulo="Mapeando virtual 0x400000 para o mesmo frame que virtual 0x300000"
        ; PT0 já mapeia virtual 0x300000 → físico 0x300000
        ; Cria PT1 em 0x202000 para a região virtual 400000h-7FFFFFh
        ; PT1[0]: virtual 0x400000 → físico 0x300000
        mov dword [202000h], 300003h    ; 0x300000 | P | R/W
        mov dword [200004h], 202003h    ; PDE[1] = PT1 | P | R/W

        ; agora [300000h] e [400000h] são o mesmo byte físico
        mov dword [300000h], 0CAFEBABEh
        mov eax,  [400000h]             ; lê 0xCAFEBABE também
```

```quiz
? Qual campo do CR3 contém o endereço do diretório de páginas?
+ Os bits 31:12 (endereço físico ÷ 4096); o diretório deve estar alinhado em 4 KB
- Os bits 11:0
- Todo o registrador de 32 bits, sem alinhamento obrigatório
- CR3 contém o endereço da primeira tabela de páginas, não do diretório

? Quantas entradas tem um diretório de páginas e qual o tamanho de cada uma?
- 256 entradas de 8 bytes
- 4096 entradas de 1 byte
+ 1024 entradas de 4 bytes (total = 4 KB)
- 512 entradas de 8 bytes (igual ao modo de 64 bits)

? Por que é necessário ter paginação ativa antes de fazer o jump para a metade alta do espaço de endereços?
- Não é necessário; pode-se fazer o jump antes de ligar PG
- Porque sem paginação não existe segmentação
+ Porque sem paginação o endereço linear 0xC0100000 seria enviado diretamente ao barramento físico, onde não há RAM
- Porque o bit PG habilita o modo protegido
```

## Exercícios

```exercicio
id: a68-1
titulo: Ativar a paginação com mapa idêntico
nivel: 2
maquina: 386
modo: pm32
--- enunciado
Monte um mapa idêntico de 4 MB. Use PT0 em `0x201000` (1024 entradas, cada uma `i*1000h | 3`). Coloque o PD em `0x200000` com `PDE[0] = 0x201003`. Carregue CR3 com `0x200000` e ligue o bit PG (bit 31) no CR0. Depois escreva `0x12345678` em `resultado` via acesso normal de memória. O teste verifica `resultado`.
--- inicial
        bits 32
        org 100000h

        ; monte PT0 em 201000h (mapa idêntico 4 MB)

        ; configure o PD em 200000h

        ; carregue CR3 e ligue PG

        ; depois de ativar a paginação, escreva 12345678h em resultado
        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "resultado = 12345678h", "espera": { "mem": { "resultado": 305419896 } } }]
--- dicas
PT0: mov edi, 201000h / xor eax, eax / .pt: mov edx, eax / or edx, 3 / mov [edi], edx / add edi, 4 / add eax, 1000h / cmp eax, 400000h / jb .pt.
PD: mov dword [200000h], 201003h.
CR3: mov eax, 200000h / mov cr3, eax.
PG: mov eax, cr0 / or eax, 80000000h / mov cr0, eax.
--- solucao
        bits 32
        org 100000h

        mov edi, 201000h
        xor eax, eax
.pt:    mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt

        mov dword [200000h], 201003h

        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        mov dword [resultado], 12345678h
        cli
        hlt

resultado: dd 0
```

```exercicio
id: a68-2
titulo: Alias de página — dois endereços, mesmo frame físico
nivel: 3
maquina: 386
modo: pm32
--- enunciado
Monte o mapa idêntico de 4 MB com PT0 em `0x201000`. Crie também PT1 em `0x202000` para cobrir a região virtual `400000h–7FFFFFh`. Na entrada `PT1[0]` (`0x202000`), aponte para o frame físico `0x300000` (mesma página mapeada por PT0[768]). Adicione `PDE[1] = 0x202003` em `0x200004`. Ative a paginação. Escreva `0xABCDABCD` via o endereço `0x400000` (alias) e leia de volta via `0x300000` (identidade), armazenando em `resultado`.
--- inicial
        bits 32
        org 100000h

        ; PT0 em 201000h (mapa idêntico 4MB)
        ; PT1 em 202000h (PT1[0] → frame 300000h)
        ; PD em 200000h (PDE[0]=201003h, PDE[1]=202003h)

        ; ativar paginação

        ; escrever via alias (400000h) e ler via identidade (300000h)

        cli
        hlt

resultado: dd 0
--- testes
[{ "nome": "alias lido via identidade", "espera": { "mem": { "resultado": 2882382797 } } }]
--- dicas
PT1: mov dword [202000h], 300003h (mapeia virtual 400000h → físico 300000h).
PDE[1] em 200004h: mov dword [200004h], 202003h.
Após paginação: mov dword [400000h], 0ABCDABCDh / mov eax, [300000h] / mov [resultado], eax.
--- solucao
        bits 32
        org 100000h

        mov edi, 201000h
        xor eax, eax
.pt:    mov edx, eax
        or  edx, 3
        mov [edi], edx
        add edi, 4
        add eax, 1000h
        cmp eax, 400000h
        jb .pt

        mov dword [202000h], 300003h    ; PT1[0]: 400000h → físico 300000h
        mov dword [200000h], 201003h    ; PDE[0] = PT0
        mov dword [200004h], 202003h    ; PDE[1] = PT1

        mov eax, 200000h
        mov cr3, eax
        mov eax, cr0
        or  eax, 80000000h
        mov cr0, eax

        mov dword [400000h], 0ABCDABCDh
        mov eax, [300000h]
        mov [resultado], eax
        cli
        hlt

resultado: dd 0
```

:::resumo
- A paginação do 386 traduz endereços lineares de 32 bits em endereços físicos via dois níveis: diretório de páginas (PD) e tabela de páginas (PT), cada um com 1024 entradas de 4 bytes.
- O CR3 aponta para o PD (alinhado em 4 KB); escrever no CR3 invalida a TLB.
- Cada entrada (PDE ou PTE) guarda o endereço físico do frame nos bits 31:12 e flags nos bits 11:0. Os mais usados: **P** (presente), **R/W** (escrita), **U/S** (usuário).
- O bit **PG** (bit 31 do CR0) ativa a paginação. Antes de ligá-lo, o código em execução deve estar mapeado na tabela (geralmente com mapa idêntico).
- Dois endereços lineares podem apontar para o mesmo frame físico (*alias*); escrever por um endereço é visto pelo outro.
:::
