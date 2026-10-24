---
id: cap09
numero: 9
parte: 4
titulo: "Disquete (INT 13H com DL < 80H, INT 0EH e INT 1EH)"
aulas: aula12; aula19; aula25
---

# Capítulo 9 · Disquete

> **Neste capítulo:** a `INT 13H` quando `DL` é menor que 80H: ler, gravar, verificar e
> formatar setores; os códigos de status; a fronteira de 64 KB do DMA; os tipos de unidade e
> de mídia; a tabela de parâmetros apontada por `INT 1EH`; e as receitas da IBM para tentar de
> novo e para descobrir o tipo de disquete.
>
> **Antes de ler:** [Aula 12, Segmentos a fundo](../conteudo/aula12-segmentos.md) (endereços
> físicos, necessários para entender a fronteira de DMA), [Aula 19](../conteudo/aula19-menu-entrada.md)
> (sinalizar erros com CF) e [Aula 25, Arquivos com handles](../conteudo/aula25-arquivos.md),
> que é o mesmo disco visto de cima, pelo DOS.

```
  seu programa ──► INT 21H (arquivos, Aula 25) ──► DOS: FAT, diretórios
                                                    │
                                                    ▼
                  INT 13H (setores, este capítulo) ──► controlador ──► disquete
```

O DOS transforma "arquivo, posição" em "trilha, cabeça, setor" e chama a `INT 13H`. Programas
comuns devem ficar no nível do DOS; a `INT 13H` é para utilitários de disco, copiadores,
formatadores, setores de boot e sistemas operacionais.

## 9.1 Funções

`INT 13H` é a porta de entrada para os discos. Com `DL` < 80H a chamada vai para o
**disquete**; com `DL` ≥ 80H, para o **disco fixo** ([Capítulo 10](cap10-disco-fixo.md)).
Algumas funções numeradas entre 06H e 14H existem só para o disco fixo e são reservadas aqui.

| AH | Função |
|---|---|
| 00H | Reiniciar o sistema de disquete |
| 01H | Ler o status da última operação |
| 02H | Ler setores para a memória |
| 03H | Gravar setores da memória |
| 04H | Verificar setores |
| 05H | Formatar uma trilha |
| 08H | Ler parâmetros da unidade |
| 15H | Ler o tipo de DASD |
| 16H | Status da linha de troca de disquete |
| 17H | Definir o tipo de DASD para formatação |
| 18H | Definir o tipo de mídia para formatação |
| 06H–07H, 09H–14H, 19H–FFH | Reservadas |

## 9.2 Convenções comuns

- `DL` = número da unidade (base 0: A: = 0, B: = 1); bit 7 = 0 indica disquete.
- `DH` = cabeça (base 0), `CH` = trilha (base 0), `CL` = setor (**base 1**), `AL` = quantidade
  de setores, `ES:BX` = buffer.
- A BIOS **não valida** cabeça, trilha, setor nem contagem: valores errados geram erros de
  hardware, não recusa da chamada.
- Retorno: **CF = 1** se `AH` ≠ 0 (erro); `AH` = status; `AL` = setores transferidos (leitura,
  escrita, verificação). O mesmo status fica em `40:41`.
- **Regra de ouro:** se houver erro, **reinicie o disquete (AH=00H) e tente de novo**. Os erros
  de disquete são frequentemente transitórios (motor ainda acelerando, mídia suja). A prática
  consagrada é tentar até 3 vezes antes de desistir.

### Códigos de status (AH / 40:41)

| Código | Significado |
|---|---|
| 00H | Sem erro |
| 01H | Comando ou parâmetro inválido |
| 02H | Marca de endereço não encontrada |
| 03H | Disquete protegido contra gravação |
| 04H | Setor não encontrado |
| 06H | Linha de troca de disquete ativa |
| 08H | *Overrun* de DMA |
| 09H | Tentativa de DMA atravessando limite de 64 KB |
| 0CH | Tipo de mídia não encontrado |
| 10H | Erro de CRC na leitura |
| 20H | Falha geral do controlador |
| 40H | Falha de posicionamento (*seek*) |
| 80H | Unidade não pronta (*time-out*) |

### A fronteira de 64 KB do DMA

O buffer de DMA **não pode cruzar uma fronteira de 64 KB** de endereço físico (10000H, 20000H,
30000H…). Se o seu buffer cai perto do limite, o erro 09H aparece; a solução é reposicionar o
buffer ou transferir menos setores.

O controlador de DMA do PC conta só os 16 bits baixos do endereço; os 4 bits altos ficam num
registrador de página fixo. Para saber se um buffer de `n` bytes em `ES:BX` é seguro, calcule
o endereço físico como na Aula 12 e confira se os 16 bits baixos não estouram:

```asm fragmento titulo="O buffer ES:BX de DX bytes cruza 64 KB? (CF=1 se cruza)"
; Entrada: ES:BX = buffer, DX = tamanho em bytes (maior que zero)
        MOV  AX,ES
        MOV  CL,4
        SHL  AX,CL          ; 16 bits baixos de ES×16
        ADD  AX,BX          ; 16 bits baixos do endereço físico do primeiro byte
        DEC  DX             ; distância até o último byte
        ADD  AX,DX          ; CF=1: o último byte já está no bloco de 64 KB seguinte
```

Um truque comum é declarar um buffer com o dobro do tamanho e usar a metade que não cruza.

### Cooperação com multitarefa

Em AT, PC XT (BIOS de 10/01/86 em diante), XT 286, PC Convertible e PS/2, a BIOS avisa o
sistema operacional antes de esperar o motor ou a interrupção do disquete:

- `INT 15H, AX=90FDH`: "início do motor", permitindo ao SO fazer outra coisa enquanto o motor
  acelera;
- `INT 15H, AH=90H, AL=01H`: "dispositivo ocupado" antes de esperar a interrupção;
- `INT 15H, AH=91H, AL=01H`: "interrupção completa" quando a operação termina.

Veja o [Capítulo 16](cap16-multitarefa.md). A interrupção de hardware do controlador de
disquete é a IRQ 6, vetor **INT 0EH**; o tratador da BIOS só marca que a operação terminou
(bit 7 de `40:3E`) e manda o EOI.

## 9.3 As funções, uma a uma

### AH = 00H · Reiniciar

`DL` = unidade. Reinicializa o controlador. Se `DL` ≥ 80H, reinicia o disquete **e depois** o
disco fixo, e o status em `AH` é o do disco fixo; leia o status do disquete à parte, se
precisar.

### AH = 01H · Status da última operação

Devolve em `AH` o status da operação anterior daquela unidade (CF reflete se é diferente de
zero).

### AH = 02H · Ler setores

Parâmetros comuns acima. Retorno: `AL` = setores realmente lidos.

```asm fragmento titulo="Ler o setor de boot de A:"
        MOV  AX,0201H      ; AH=02H ler, AL=1 setor
        MOV  CX,0001H      ; trilha 0, setor 1
        XOR  DX,DX         ; cabeça 0, unidade A:
        MOV  BX,OFFSET buf ; ES:BX = buffer de 512 bytes
        INT  13H
        JC   erro
```

### AH = 03H · Gravar setores

Mesmos parâmetros. No PC XT Model 286, `AL` não é necessário.

### AH = 04H · Verificar setores

Testa se os setores podem ser lidos (confere o CRC) sem transferir dados. Nas BIOS de AT de
15/11/85 em diante, XT 286, PC Convertible e PS/2, `ES:BX` não é necessário. `AL` retorna o
número de setores verificados.

### AH = 05H · Formatar trilha

`ES:BX` aponta para uma lista de **campos de endereço**, um por setor da trilha, cada um com 4
bytes:

| Byte | Conteúdo |
|---|---|
| 0 | Número da trilha |
| 1 | Número da cabeça |
| 2 | Número do setor |
| 3 | Tamanho do setor: 00H = 128, 01H = 256, 02H = 512, 03H = 1024 bytes |

Deve haver uma entrada para cada setor da trilha. `AL` = nº de setores, `DL` = unidade, `DH` =
cabeça, `CH` = trilha. Se a unidade suporta mais de um formato, chame antes `AH=17H` ou
`AH=18H` para dizer qual será formatado. A formatação usa a tabela de parâmetros de disquete
(seção 9.4). No XT Model 286, `AL` é dispensável.

> A ordem dos números de setor na lista é o **entrelaçamento** (*interleave*): uma lista
> `1,2,3,…,9` grava os setores em sequência; uma lista `1,6,2,7,3,8,4,9,5` deixa um setor de
> folga entre dois consecutivos. Copiadores de proteção de disquete dos anos 80 brincavam com
> números e tamanhos fora do padrão nesta lista.

```asm fragmento titulo="Lista de campos de endereço para a trilha 0, cabeça 0, 9 setores de 512"
campos  DB  0,0,1,2, 0,0,2,2, 0,0,3,2, 0,0,4,2, 0,0,5,2
        DB  0,0,6,2, 0,0,7,2, 0,0,8,2, 0,0,9,2
```

**Formatar destrói todos os dados da trilha.** Teste em disquetes descartáveis ou em imagens de
disco num emulador.

### AH = 08H · Ler parâmetros da unidade

PCjr, PC, PC XT e AT com BIOS de 10/01/84: a função não existe e retorna `CF=1, AH=01H`.

Nos demais, `DL` = unidade; retorno:

| Registrador | Conteúdo |
|---|---|
| ES:DI | Ponteiro para tabela de parâmetros de 11 bytes do maior tipo de mídia suportado |
| CH | Última trilha (8 bits baixos de um número de 10 bits, base 0) |
| CL | Bits 7–6: 2 bits altos da trilha máxima; bits 5–0: setores por trilha |
| DH | Número máximo de cabeça |
| DL | Número de unidades de disquete instaladas |
| BH | 0 |
| BL | Tipo de unidade (CMOS): 01H = 360 KB 5,25" · 02H = 1,2 MB 5,25" · 03H = 720 KB 3,5" · 04H = 1,44 MB 3,5" |
| AX | 0 |

Se o tipo é conhecido mas o CMOS é inválido (ausente, bateria descarregada ou checksum ruim),
tudo é devolvido como acima, mas com `BL = 0`. Se a unidade não existe, ou o tipo é
desconhecido e o CMOS é inválido, `ES, AX, BX, CX, DH, DI` voltam zerados e `DL` contém o
número de unidades. Com `DL` ≥ 80H a chamada retorna erro `CF=1, AH=01H`.

```asm fragmento titulo="Separar trilhas e setores de CX (formato de 10 bits)"
        MOV  AL,CL
        AND  AL,3FH        ; AL = setores por trilha (bits 5-0)
        MOV  AH,CL
        MOV  CL,6
        SHR  AH,CL         ; AH = 2 bits altos da trilha
        MOV  CL,AL         ; (guarda setores em CL)
        MOV  AL,CH         ; AX = última trilha (10 bits)
```

### AH = 15H · Tipo de DASD

AT, PC XT (BIOS de 10/01/86 em diante), XT 286, PC Convertible, PS/2. Retorno em `AH`: 00H =
unidade ausente; 01H = disquete sem linha de troca; 02H = disquete com linha de troca; 03H =
reservado para disco fixo. Demais sistemas: `CF=1`, `AH=01H`.

### AH = 16H · Linha de troca de disquete

Mesmos sistemas da 15H. Retorno `AH`: 00H = sinal inativo; 06H = sinal ativo (houve troca de
disquete); 01H = parâmetro inválido; 80H = unidade não pronta. `CF` = 1 se `AH` ≠ 0. Em outros
sistemas, `AH=01H` e `CF=1`.

Uso típico: um sistema de arquivos consulta esta função antes de confiar em dados da FAT que
estão em cache, para saber se o usuário trocou o disquete.

### AH = 17H · Definir DASD para formatação

Informa qual formato será gravado, quando a unidade aceita mais de um. `AL`:

| AL | Mídia / unidade |
|---|---|
| 01H | 320/360 KB em unidade de 360 KB |
| 02H | 360 KB em unidade de 1,2 MB |
| 03H | 1,2 MB em unidade de 1,2 MB |
| 04H | 720 KB em unidade de 720 KB (em AT com BIOS anterior a 10/06/85: inválido) |
| 00H, 05H–FFH | Inválido |

A BIOS confere o sinal de troca de disquete: se ativo, tenta resetá-lo; se consegue, ajusta a
taxa de dados e retorna o código de "mudança de disquete"; se falha, retorna *time-out* e deixa
o tipo de mídia como "desconhecido". Depois de uma troca de disquete, a função deve ser chamada
de novo. Em outros sistemas, retorna `AH=01H`, `CF=1`.

### AH = 18H · Definir tipo de mídia para formatação

AT (BIOS de 15/11/85 em diante), PC XT (10/01/86 em diante), XT 286 e PS/2. Deve ser chamada
**antes** de `AH=05H` e novamente após trocar o disquete; o disquete precisa estar na unidade.

Entrada: `DL` = unidade; `CH` = nº de trilhas (8 bits baixos); `CL` = bits 7–6: 2 bits altos de
trilhas, bits 5–0: setores por trilha. Retorno: `ES:DI` → tabela de 11 bytes do tipo de mídia
(inalterado se `AH` ≠ 0).

No XT 286 e no PS/2, a função monitora a linha de troca. Se estiver ativa, tenta zerá-la; se dá
certo (há mídia), ajusta a taxa de dados; se falha (sem mídia), retorna `AH=80H` e `CF=1`.

## 9.4 A tabela de parâmetros de disquete (INT 1EH)

Tabela de 11 bytes apontada pelo vetor `INT 1EH` (em `0000:0078`) e devolvida por
`INT 13H, AH=08H` para o maior tipo da unidade:

| Offset | Campo |
|---|---|
| 0, 1 | Dois bytes de especificação (*specify*) do controlador |
| 2 | Ticks do temporizador de espera antes de desligar o motor |
| 3 | Tamanho do setor: 00H = 128 · 01H = 256 · 02H = 512 · 03H = 1024 bytes |
| 4 | Setores por trilha |
| 5 | Tamanho do intervalo (*gap*) |
| 6 | Comprimento dos dados (DTL) |
| 7 | *Gap* usado na formatação |
| 8 | Byte de enchimento usado na formatação |
| 9 | Tempo de acomodação da cabeça (ms) |
| 10 | Tempo de partida do motor, em 1/8 s (8 = 1 segundo) |

Como `INT 1EH` aponta para essa tabela, um programa pode **copiá-la**, ajustar campos (por
exemplo, setores por trilha) e apontar o vetor para a cópia, para ler formatos não padrão.
**Nunca altere a tabela na ROM** nem a deixe apontando para a sua cópia depois de sair.

```asm fragmento titulo="Copiar a tabela de disquete e mudar os setores por trilha"
; tabela DB 11 DUP(?)   antigo1E DD ?
        XOR  AX,AX
        MOV  ES,AX
        LDS  SI,ES:[1EH*4]       ; DS:SI = tabela atual
        MOV  WORD PTR CS:antigo1E,SI
        MOV  WORD PTR CS:antigo1E+2,DS
        PUSH CS
        POP  ES
        MOV  DI,OFFSET tabela
        MOV  CX,11
        CLD
        REP  MOVSB               ; copia os 11 bytes
        PUSH CS
        POP  DS
        MOV  BYTE PTR tabela+4,18 ; 18 setores por trilha
        XOR  AX,AX
        MOV  ES,AX
        CLI
        MOV  WORD PTR ES:[1EH*4],OFFSET tabela
        MOV  ES:[1EH*4+2],CS
        STI
        ; ... usar o disquete; ao sair, devolver antigo1E ao vetor ...
```

### O que a BIOS impõe por conta própria

Das diretrizes da Seção 4 do manual:

- O comprimento do *gap* nas operações de leitura, escrita e verificação é obtido pela própria
  BIOS, não pela tabela; o da formatação ainda vem da tabela.
- Tempo de acomodação mínimo se a tabela traz 0 ms (em escrita e formatação): 20 ms para 5,25"
  de 48 TPI e 15 ms para 5,25" de alta capacidade (96 TPI); leituras e verificações usam o
  valor da tabela.
- Tempo mínimo de partida do motor em escrita ou verificação: 500 ms (1 s em PCs).

## 9.5 Receita: descobrir o tipo de disquete inserido

1. Verifique (AH=04H) trilha 0, cabeça 0, setor 1. Se falhar, reinicie e tente de novo; se
   falhar de novo, a mídia não está formatada ou está com defeito.
2. Verifique trilha 0, cabeça 0, setor 16. Se falhar, é um disquete de 5,25" (48 TPI) ou de
   3,5" de 720 KB; para diferenciar, verifique trilha 78, cabeça 1, setor 1 (sucesso = 720 KB).
3. Leia o status do controlador a partir de `40:42`; o quinto byte indica a cabeça com que a
   operação terminou, o que permite distinguir 5,25" de alta capacidade de outros tipos.

## 9.6 Exemplo completo: ler o setor de boot com novas tentativas

O setor 1 da trilha 0 de um disquete formatado pelo DOS começa com um salto e, a partir do
offset 3, um nome de 8 caracteres (o "OEM"), seguido do bloco de parâmetros do DOS, em que a
palavra no offset 0BH é o número de bytes por setor. Esses campos são definidos pelo DOS, não
pela BIOS, mas são o primeiro exemplo útil de leitura de setor.

```asm titulo="BOOTA.ASM: lê o setor de boot de A: e mostra o nome OEM"
.MODEL SMALL
.STACK 100h
.DATA
buf     DB  512 DUP(0)
m_erro  DB  'Erro de disquete, status: $'
m_oem   DB  'OEM: $'
.CODE
inicio:
        MOV  AX,@DATA
        MOV  DS,AX
        MOV  ES,AX              ; ES:BX = buf
        MOV  SI,3               ; até 3 tentativas
tenta:  MOV  AX,0201H           ; ler 1 setor
        MOV  CX,0001H           ; trilha 0, setor 1
        XOR  DX,DX              ; cabeça 0, unidade 0 (A:)
        MOV  BX,OFFSET buf
        STC                     ; sem serviço de disco, conta como erro
        INT  13H
        JNC  leu
        PUSH AX                 ; guarda o status (AH)
        XOR  AX,AX              ; AH=00H: reiniciar
        INT  13H
        POP  AX
        DEC  SI
        JNZ  tenta
        MOV  DX,OFFSET m_erro   ; desistiu: mostra o status
        PUSH AX
        MOV  AH,09H
        INT  21H
        POP  AX
        MOV  AL,AH
        CALL imphex8
        JMP  fim

leu:    MOV  DX,OFFSET m_oem
        MOV  AH,09H
        INT  21H
        MOV  SI,OFFSET buf+3    ; nome OEM: 8 caracteres
        MOV  CX,8
oem:    MOV  DL,[SI]
        MOV  AH,02H
        INT  21H
        INC  SI
        LOOP oem
fim:    MOV  AX,4C00H
        INT  21H

imphex8 PROC
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  DH,AL
        MOV  CL,4
        SHR  AL,CL
        CALL digito
        MOV  AL,DH
        AND  AL,0FH
        CALL digito
        POP  DX
        POP  CX
        POP  AX
        RET
imphex8 ENDP

digito  PROC
        ADD  AL,'0'
        CMP  AL,'9'
        JBE  escreve
        ADD  AL,7
escreve: MOV  DL,AL
        MOV  AH,02H
        INT  21H
        RET
digito  ENDP
END inicio
```

## 9.7 No simulador do curso

O simulador tem um "disco" acessível só pelos arquivos do DOS (`INT 21H`, Aula 25); a
`INT 13H` não tem serviço. `BOOTA.ASM` monta e roda no laboratório, mas termina em "Erro de
disquete" depois das três tentativas. Use um emulador (DOSBox com uma imagem de disquete montada com
`IMGMOUNT`, ou 86Box/PCem) para os exemplos deste capítulo.

## 9.8 Exercícios

1. Escreva `PARAMS.ASM`: chama `AH=08H` para A: e imprime tipo da unidade, última trilha,
   cabeças e setores por trilha. Trate a ausência da função (`CF=1, AH=01H`).
2. Faça uma rotina `LER_SETOR` que recebe o **número lógico** do setor (0, 1, 2…) em AX e o
   converte em trilha, cabeça e setor para um disquete de 1,44 MB (18 setores por trilha, 2
   cabeças): `setor = (lógico mod 18) + 1`, `cabeça = (lógico / 18) mod 2`,
   `trilha = lógico / 36`.
3. Use a rotina do exercício 2 para ler o primeiro setor do diretório raiz de um disquete de
   1,44 MB (setor lógico 19) e listar os nomes dos 16 primeiros arquivos (32 bytes por entrada,
   nome nos primeiros 11).
4. Por que um copiador de disquete precisa conferir a fronteira de 64 KB antes de ler uma
   trilha inteira de 18 setores (9 KB) para um buffer qualquer?

## Resumo

- `INT 13H` com `DL` < 80H: 02H lê, 03H grava, 04H verifica, 05H formata; trilha e cabeça base
  0, setor base 1.
- `CF=1` e `AH` = status; reinicie (00H) e tente de novo, até 3 vezes.
- O buffer não pode cruzar uma fronteira de 64 KB (erro 09H).
- `AH=08H`, `15H` a `18H` dão o tipo de unidade, a linha de troca e preparam a formatação.
- `INT 1EH` aponta a tabela de 11 bytes; copie, ajuste e restaure, nunca altere a original.
