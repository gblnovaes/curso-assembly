---
id: cap10
numero: 10
parte: 4
titulo: "Disco fixo (INT 13H com DL ≥ 80H, INT 40H, INT 41H e INT 46H)"
aulas: aula12; aula21; aula25
---

# Capítulo 10 · Disco fixo

> **Neste capítulo:** a `INT 13H` quando o bit 7 de `DL` está ligado: o mapa de funções do
> disco fixo, o endereçamento CHS com cilindro de 10 bits e os limites de capacidade que ele
> criou, os códigos de status (com o curioso "erro corrigido"), a tabela de parâmetros
> apontada por `INT 41H`/`INT 46H` e a formatação do adaptador ESDI.
>
> **Antes de ler:** [Capítulo 9](cap09-disquete.md) (as convenções comuns da `INT 13H`) e
> [Aula 21, Projeto, a calculadora de 32 bits](../conteudo/aula21-calculadora.md) (números
> maiores que 16 bits em pares de registradores, como a capacidade em `CX:DX`).

## 10.1 Disquete, disco fixo e o vetor 40H

Quando `DL` tem o **bit 7 ligado** (80H = primeiro disco, 81H = segundo), `INT 13H` fala com o
disco fixo. Se não há adaptador de disco fixo instalado, o código nem é ligado ao vetor e o
comportamento é o da interface de disquete.

Quando há disco fixo, a BIOS do disco **move o vetor original da `INT 13H` (o do disquete) para
a `INT 40H`** ("redirecionamento da BIOS de disquete", no mapa do [Capítulo 2](cap02-vetores-e-excecoes.md))
e instala o seu tratador na 13H. Chamadas com `DL` < 80H são repassadas à `INT 40H`. Por isso
"reiniciar o disco" também reinicia o disquete.

## 10.2 Mapa de funções

| AH | Função | Observação |
|---|---|---|
| 00H | Reiniciar o disco | também reinicia o disquete |
| 01H | Status da última operação | zera o status depois de ler |
| 02H / 03H | Ler / gravar setores | |
| 04H | Verificar setores | |
| 05H | Formatar cilindro | formato muda conforme o modelo |
| 06H | Formatar cilindro e marcar setores ruins | só PC XT |
| 07H | Formatar a unidade a partir de um cilindro | só PC XT |
| 08H | Ler parâmetros da unidade | |
| 09H | Inicializar características do par de discos | |
| 0CH | Seek (posicionar a cabeça) | |
| 0DH | Reset alternativo | |
| 10H | Testar se a unidade está pronta | |
| 11H | Recalibrar | |
| 15H | Tipo de DASD / capacidade | AT e posteriores |
| 19H | Estacionar cabeças | |
| 1AH | Formatar unidade (ESDI) | |
| 0AH–0BH, 0EH–0FH, 12H–14H | Diagnóstico (reservadas) | |
| 16H–18H | Reservadas para o disquete | |
| 1BH–FFH | Reservadas | |

## 10.3 Regras gerais

- Diferente do disquete, o número da unidade (`DL`) **é validado** em todas as funções.
- O bit 7 de `DL` deve estar ligado na entrada.
- Endereçamento **CHS** com cilindro de **10 bits**: `CH` guarda os 8 bits baixos do cilindro e
  os bits 7–6 de `CL` guardam os 2 bits altos; os bits 5–0 de `CL` são o setor (base 1). A
  cabeça vai em `DH`.
- Em AT, XT 286 e PS/2, antes de esperar a interrupção a BIOS chama `INT 15H, AH=90H, AL=00H`
  (dispositivo ocupado, tipo = disco) e, ao terminar, `INT 15H, AH=91H, AL=00H` (interrupção
  completa). No PS/2, o reset usa `INT 15H, AH=90H` com tipo `FCH`, que é apenas uma espera com
  *time-out* ([Capítulo 16](cap16-multitarefa.md)).
- Receita padrão de erro: **reiniciar o disco e repetir**.
- Parâmetros do disco: tabela apontada pelo vetor `INT 41H` (disco 0) e, no AT e PS/2,
  `INT 46H` (disco 1). Seção 10.6.
- O status da última operação também fica em `40:74`.

```
  CX = ┌─────────────── CH ───────────────┬──────────── CL ─────────────┐
       │ c7 c6 c5 c4 c3 c2 c1 c0          │ c9 c8 │ s5 s4 s3 s2 s1 s0   │
       └──────────────────────────────────┴───────┴─────────────────────┘
         cilindro, 8 bits baixos           2 altos   setor (1 a 63)
```

```asm fragmento titulo="Montar CX a partir do cilindro (AX, 0 a 1023) e do setor (BL, 1 a 63)"
        MOV  CH,AL          ; 8 bits baixos do cilindro
        MOV  CL,6
        SHL  AH,CL          ; bits 9-8 do cilindro vão para 7-6
        OR   AH,BL          ; setor nos bits 5-0
        MOV  CL,AH          ; CX pronto
```

### Os limites de capacidade

Com 10 bits de cilindro e 6 de setor, a interface só enxerga **1024 cilindros** e **63 setores
por trilha**. Combinado com o número de cabeças, isso gerou os famosos limites dos anos 90:

| Limite | Conta | Capacidade |
|---|---|---|
| BIOS + interface de disco do AT (16 cabeças) | 1024 × 16 × 63 × 512 | ~504 MB (528 milhões de bytes) |
| BIOS com tradução de geometria (255 cabeças) | 1024 × 255 × 63 × 512 | ~7,8 GB (8,4 bilhões de bytes) |

Os discos maiores exigiram as extensões de `INT 13H` com endereçamento por bloco lógico (LBA),
que vieram depois deste manual de 1987 e ficam para os capítulos avançados.

## 10.4 Status (AH): os que mais importam

| Código | Significado |
|---|---|
| 00H | Sem erro |
| 01H | Função inválida |
| 02H | Marca de endereço não encontrada |
| 04H | Setor não encontrado |
| 05H | Falha no reset |
| 07H | Falha ao aplicar parâmetros da unidade |
| 09H | Erro de fronteira de dados (DMA cruzando 64 KB) |
| 0AH / 0BH | Setor ruim / cilindro ruim detectado |
| 10H | Erro não corrigível de ECC/CRC |
| **11H** | **Erro corrigido por ECC** (os dados provavelmente estão certos) |
| 20H | Falha do controlador |
| 40H | Falha no *seek* |
| 80H | *Time-out* |
| BBH | Erro indefinido |
| CCH | Falha de gravação |
| E0H | Erro de status / registrador de erro = 0 |
| FFH | Falha no *sense* |

(Há mais códigos: 03H, 06H, 08H, 0DH, 0EH e 0FH; consulte o original.)

O erro **11H** merece atenção: a leitura teve um erro recuperável que o ECC consertou. A BIOS o
sinaliza com `CF=1` para que o programa decida; os dados no buffer provavelmente estão bons, e
regravá-los costuma fazer o erro sumir. Um utilitário de disco trata 11H como "aviso", não
como falha.

## 10.5 As funções, uma a uma

### 00H · Reiniciar

`DL` = unidade (bit 7 = 1). Só reinicia o disco se o número de 7 bits for menor ou igual ao
máximo de discos instalados; o disquete é reiniciado para qualquer `DL`.

### 01H · Status

Devolve o status da última operação e depois o zera.

### 02H / 03H · Ler / gravar setores

`DL` unidade, `DH` cabeça, `CH`/`CL` cilindro e setor, `AL` nº de setores, `ES:BX` buffer. Nada
além da unidade é validado. Retorno: `CF` e `AH`.

```asm fragmento titulo="Ler o primeiro setor do disco (o MBR)"
        MOV  AX,0201H        ; ler 1 setor
        MOV  CX,0001H        ; cilindro 0, setor 1
        MOV  DX,0080H        ; cabeça 0, primeiro disco fixo
        MOV  BX,OFFSET buf
        INT  13H
        JC   erro
```

O primeiro setor do disco (cilindro 0, cabeça 0, setor 1) contém o código de partida e a tabela
de partições, gravados pelo `FDISK` do DOS. A estrutura dessa tabela é definida pelo DOS e fica
para os capítulos avançados.

### 04H · Verificar

Mesma passagem de parâmetros, sem buffer relevante; confere os setores pelo ECC.

### 05H · Formatar cilindro

- **PC XT:** `AL` = fator de *interleave*.
- **AT, XT 286 e PS/2:** `ES:BX` → buffer de 512 bytes; os primeiros `2 × setores por
  trilha` bytes contêm pares `F, N` por setor, com `F` = 00H (bom) ou 80H (ruim) e `N` = número
  do setor.
- **Adaptador ESDI/A:** retorna "função inválida".

### 06H e 07H · Formatação do XT

`06H` formata o cilindro marcando setores ruins; `07H` formata a unidade inteira a partir de um
cilindro. Em AT, XT 286, PS/2 e ESDI: função inválida. **Formatar destrói todos os dados.**

### 08H · Parâmetros da unidade

Retorna `DL` = número de discos ligados ao controlador (1 ou 2), `DH` = máximo de cabeças,
`CH` = máximo de cilindros (8 bits baixos), `CL` = setores por trilha + 2 bits altos do
cilindro. Se a unidade é inválida: `AH = 07H`, `CX = DX = 0` e `CF = 1`. Se não há adaptador ou
disco: `AH = 01H`, `CF = 1`.

> "Máximo" aqui é o **último índice** (base 0) para cilindros e cabeças: um disco com 615
> cilindros e 4 cabeças devolve 614 e 3. Para obter as quantidades, some 1.

### 09H · Inicializar o par de discos

Aplica os parâmetros ao controlador.

- **PC XT:** a tabela vem de `INT 41H`; quatro entradas correspondem às chaves do adaptador (as
  chaves funcionam como índice). Valores `80H–87H` em `DL` inicializam os dois discos; se o
  disco 0 falhar, o 1 nem é tentado.
- **AT, XT 286 e PS/2:** `INT 41H` descreve o disco 0 e `INT 46H` o disco 1; `DL=80H` usa 41H,
  `DL=81H` usa 46H.
- **ESDI/A:** não faz nada, a configuração vem do próprio disco.

### 0CH · Seek

Move a cabeça para o cilindro dado em `CH`/`CL`, na cabeça `DH`.

### 0DH · Reset alternativo

Como o 00H, mas sem tocar no disquete. Reservada para diagnóstico no ESDI/A.

### 10H · Unidade pronta?

Retorna `CF`/`AH` indicando se a unidade responde.

### 11H · Recalibrar

Leva as cabeças ao cilindro 0.

### 15H · Tipo de DASD e capacidade

- PC XT: não suportada (função inválida).
- AT, XT 286, PS/2: `AH` = 00H (ausente ou `DL` inválido) ou 03H (disco fixo); `CX:DX` =
  número de blocos de 512 bytes (capacidade). `CF = 0`.

```asm fragmento
        MOV  AH,15H
        MOV  DL,80H
        INT  13H           ; CX:DX = setores de 512 bytes
```

Para obter megabytes: `CX:DX / 2048` (2048 setores de 512 bytes = 1 MB). Como o quociente cabe
em 16 bits para discos dessa época, basta `MOV AX,DX` / `MOV DX,CX` / `MOV BX,2048` / `DIV BX`.

### 19H · Estacionar cabeças

Aparece na lista de funções do manual, mas sua descrição detalhada não constava do material de
origem deste livro; consulte o original antes de usá-la. Estacionar move as cabeças para a
**zona de estacionamento** da tabela de parâmetros (seção 10.6), longe dos dados, antes de
transportar a máquina.

### 1AH · Formatar unidade (apenas ESDI/A)

Pode levar **mais de uma hora**. Parâmetros: `AL` = nº de blocos da tabela de defeitos RBA (0 =
sem tabela), `ES:BX` → tabela RBA, `CL` = bits de modificação:

| Bit de CL | Efeito |
|---|---|
| 4 | Interrupção periódica: o controlador interrompe a cada cilindro concluído (fase 1 = análise de superfície, 2 = formatação), via `INT 15H, AH=0FH`; limpar `CF` continua, ligar `CF` cancela |
| 3 | Análise estendida da superfície (exige formatação anterior sem este bit) |
| 2 | Atualiza o mapa de defeitos secundário (com o bit 1: substitui) |
| 1 | Ignora o mapa de defeitos secundário |
| 0 | Ignora o mapa de defeitos primário |

Os bits 7–5 devem ser 0. Em outros sistemas é reservada. O gancho `INT 15H, AH=0FH` está no
[Capítulo 13](cap13-int15-servicos.md).

## 10.6 A tabela de parâmetros do disco fixo (INT 41H e INT 46H)

Apontada por `INT 41H` (disco 0, em `0000:0104`) e, em AT/PS/2, `INT 46H` (disco 1, em
`0000:0118`). Cada entrada tem 16 bytes:

| Offset | Tamanho | Campo |
|---|---|---|
| 0 | palavra | Número máximo de cilindros |
| 2 | byte | Número máximo de cabeças |
| 3 | palavra | *Reduced write current* (só PC XT) |
| 5 | palavra | Cilindro inicial de pré-compensação de escrita |
| 7 | byte | Rajada máxima de ECC (só PC XT) |
| 8 | byte | **Byte de controle** (desabilitar tentativas de repetição etc.) |
| 9–11 | bytes | *Time-outs* padrão, de formatação e de verificação (só PC XT) |
| 12 | palavra | **Zona de estacionamento** (*landing zone*), AT e demais |
| 14 | byte | **Setores por trilha**, AT e demais |
| 15 | byte | Reservado |

No **PC XT**, as quatro entradas da tabela são escolhidas pelas **chaves** do adaptador; no
**AT e PS/2**, cada disco tem um único registro e o **tipo** (1 a 32) é um número escolhido no
*setup* e guardado na CMOS. Quantos tipos existem depende da BIOS: AT de 10/01/84: tipos 0 a 14;
AT de 10/06/85 e 15/11/85: 0 a 23; XT 286: 0 a 24; PS/2: 0 a 32 (Model 30: 0 a 26). Os valores de
cada tipo (cilindros, cabeças, pré-compensação, zona de estacionamento) estão na Figura 3-24 do
manual.

Nos PS/2 (exceto Model 30) há uma variante em que a tabela traz a cadeia
`'IBM HARDFILE TYPE xxx'`, o número do tipo e os mesmos parâmetros; essa informação fica gravada
no disco (cabeça 0, trilha 0, setor 2).

```asm fragmento titulo="Ler cilindros, cabeças e setores da tabela do disco 0"
        XOR  AX,AX
        MOV  ES,AX
        LES  BX,ES:[41H*4]          ; ES:BX = tabela do disco 0
        MOV  AX,ES:[BX]             ; cilindros
        MOV  DL,ES:[BX+2]           ; cabeças
        MOV  DH,ES:[BX+14]          ; setores por trilha (AT e PS/2)
```

## 10.7 No simulador do curso

Não há disco fixo nem `INT 13H` no simulador. Os exemplos deste capítulo precisam de um PC real
ou de um emulador com imagem de disco rígido. **Nunca grave (AH=03H, 05H a 07H, 1AH) num disco
com dados que importam**: um setor errado no MBR torna o disco inteiro inacessível.

## 10.8 Exercícios

1. Escreva `DISCOS.ASM`: usa `AH=08H` com `DL=80H` para descobrir quantos discos fixos existem e
   imprime cilindros, cabeças e setores (lembre de somar 1 aos máximos) de cada um.
2. Num AT ou emulador, compare a capacidade calculada pelo exercício 1
   (`cilindros × cabeças × setores × 512`) com `AH=15H`. Por que pode haver diferença de um
   cilindro? (Pista: muitas BIOS reservam o último cilindro para diagnóstico.)
3. Faça uma rotina `LER_CHS` que recebe cilindro (0 a 1023) em AX, cabeça em DH e setor em BL e
   lê um setor do disco 80H com até 3 tentativas, tratando o erro 11H como sucesso com aviso.

## Resumo

- `INT 13H` com `DL` ≥ 80H; a unidade é validada; o vetor do disquete passa para a `INT 40H`.
- Cilindro de 10 bits (CH + bits 7–6 de CL), setor de 6 bits, cabeça em DH: 1024 × 63 × cabeças.
- Erro 11H = ECC corrigiu; os dados provavelmente estão bons.
- 08H dá a geometria; 15H a capacidade em `CX:DX` setores (AT em diante).
- `INT 41H`/`INT 46H` apontam a tabela de 16 bytes por disco; o tipo vem do *setup* no AT.
