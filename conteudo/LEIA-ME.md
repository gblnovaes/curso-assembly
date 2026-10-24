# Como escrever uma aula

Cada aula é um arquivo Markdown nesta pasta, com nome `aulaNN-assunto.md` (por exemplo `aula23-modo13h.md`). O script `tools/build-conteudo.js` lê todos os arquivos `aula*.md`, valida e gera `app/conteudo.js`, que o aplicativo carrega.

Depois de criar ou editar uma aula:

```
npm run conteudo     # gera app/conteudo.js
npm test             # monta todos os exemplos e confere todos os exercícios
```

O teste falha se algum exemplo executável não montar, se a solução de algum exercício não passar nos testes ou se o código inicial de algum exercício já passar (o que indicaria testes fracos demais).

## Cabeçalho

Todo arquivo começa com um cabeçalho entre `---`:

```
---
id: aula23
numero: 23
modulo: 9
titulo: O modo gráfico 13h
subtitulo: 320 x 200 com 256 cores em A000h
duracao: 80 min
objetivos: primeiro objetivo; segundo objetivo; terceiro objetivo
---
```

- `id`: único, usado na URL (`#aula/aula23`) e no progresso salvo.
- `numero`: ordem da aula no índice.
- `modulo`: número de um módulo de `modulos.json`. Um módulo que tem aulas deixa de aparecer como "em breve".
- `objetivos`: separados por ponto e vírgula.

## Texto

Markdown comum: títulos `##` e `###`, parágrafos, listas, tabelas, citações, `**negrito**`, `*itálico*` e `` `código` ``. Links especiais:

- `[texto](aula:aula12)` abre outra aula.
- `[texto](ref:int21)` abre uma aba da Referência (`instr`, `fpu`, `int21`, `bios`, `portas`, `ciclos`, `ascii`, `atalhos`).
- `[texto](lab)` abre o laboratório.
- `[texto](livro:cap06)` abre um capítulo do livro da BIOS e do DOS (`livro-bios/`).

## Código

````
```asm executar titulo="NOME.ASM: descrição"
.MODEL SMALL
...
END inicio
```
````

- `executar`: mostra o botão "▶ Executar aqui" (miniexecutor dentro da aula). Todo bloco `asm` também tem "Copiar" e "Laboratório".
- `titulo`: aparece na barra do bloco; o começo vira o nome do arquivo no laboratório.
- `fragmento`: trecho incompleto, só para leitura. Não é montado pelo teste nem pode ser executado.
- `parametros="ARQ.TXT /X"`: linha de comando do programa (vai para o PSP, em 80h) no "Executar aqui" e no laboratório.
- `jogo`: mostra o botão "▶ Jogar", que abre o programa em tela grande, em tempo real e com o teclado de verdade. O teste roda cada bloco `jogo` por 400 mil instruções (com o timer ligado) e falha se der erro.
- `boot`: o bloco é um disquete. O botão "▶ Dar boot" liga um PC **sem DOS**, a BIOS lê o setor 0 para 0000:7C00 e salta para ele com DL = 0. Também é rodado pelo teste.

### Setor de boot e disquete

Um programa cujo primeiro segmento tem `ORG 7C00h` e termina exatamente em 512 bytes com `ORG 7DFEh` / `DW 0AA55h` é um setor de boot. Os segmentos seguintes vão para os setores seguintes do disquete (1,44 MB: 18 setores por trilha, 2 cabeças), e a INT 13h (AH=02h) lê esses setores. Sem DOS, a INT 21h não existe até que o próprio programa instale uma; `HLT` espera a próxima interrupção e `CLI` + `HLT` desliga a máquina.

### Vários arquivos num bloco

Um bloco pode ter vários arquivos, separados por linhas `;### ARQUIVO NOME.EXT`. Cada parte é montada sozinha (os números de linha continuam os do bloco inteiro). Se a primeira parte for um setor de boot, o bloco vira um disquete no formato MINIFS das aulas 40 a 44:

```diagrama titulo="MINIFS"
 setor 0      setor de boot (a primeira parte)
 setor 1      diretório: 16 entradas de 32 bytes
                0-10  nome 8.3 sem o ponto ("KERNEL  SYS")
                11    atributo (04h para .SYS, 20h para os demais)
                12-13 primeiro setor     14-15 número de setores
                16-19 tamanho em bytes
 setor 2...   os arquivos, cada um começando num setor novo
```

Os bytes de cada arquivo são a imagem do programa na memória, do primeiro ao último byte gerado (um .COM com `ORG 100h` começa no byte 100h). Uma linha `;### ARQUIVO NOME.EXT = aula33/COBRA.ASM` puxa o código do bloco `asm` de título `COBRA.ASM` da aula 33, sem repetir o fonte; o título precisa ser exatamente o nome do arquivo.

No depurador, os símbolos de cada arquivo aparecem como `ARQUIVO:NOME` (e só `NOME` quando é único).

Programas sem `.MODEL` rodam como trecho: CS = DS = ES = SS, origem em 100h, e o programa termina ao chegar no fim do código.

## Notas

```
:::dica Título opcional
Texto em Markdown. Pode ter blocos de código dentro.
:::
```

Tipos: `dica`, `atencao`, `anos90` (história e cultura da época), `cpu` (por dentro do 8086), `resumo`.

## Diagramas

````
```diagrama titulo="Título opcional"
  desenho em texto, com caracteres de caixa ┌─┐ │ └─┘ ► ▼
```
````

O texto é mostrado exatamente como escrito, em fonte monoespaçada.

## Simuladores (widgets)

````
```widget nome
{ "parametro": "valor" }
```
````

| Widget | Parâmetros |
|--------|-----------|
| `bases` | `bits` (8 ou 16), `valor` |
| `registrador` | nenhum |
| `flags` | `op` (ADD, SUB, CMP, ADC, SBB, AND, OR, XOR, TEST, INC, DEC, NEG, SHL, SHR, SAR, IMUL, MUL), `bits`, `a`, `b` |
| `endereco` | `seg`, `off` (texto, como `"1234h"`) |
| `pilha` | nenhum |
| `complemento` | nenhum |
| `comparar` | `titulo`, `a`, `b` (dois trechos de código), `setup` (registradores), `altura` (em linhas) |

## Quiz

````
```quiz
? Pergunta (aceita `código` e **negrito**)
- opção errada
+ opção certa
- outra opção errada
> Explicação mostrada depois da resposta.

? Próxima pergunta
...
```
````

Cada pergunta precisa de pelo menos uma opção com `+`. As respostas ficam salvas no progresso do aluno.

## Exercícios

````
```exercicio
id: a23-1
titulo: Nome curto
nivel: 2
proibir: MUL, IMUL
exigir: STOSB|STOSW
maxBytes: 20
maxCiclos: 500
maxPassos: 300000
timer: sim
--- enunciado
Texto em Markdown.
--- inicial
código que aparece no editor
--- testes
[{ "nome": "descrição", "setup": { "AX": 5, "vetor": [1, 2, 3], "texto": "ABC" }, "entrada": "abc\r", "espera": { "AX": 10 } }]
--- dicas
Uma dica por linha, reveladas uma de cada vez.
--- solucao
código da solução de referência
```
````

Cabeçalho do exercício:

- `id`: único em todo o curso (convenção: `aNN-n`).
- `nivel`: 1 a 3 estrelas.
- `proibir`: instruções que não podem aparecer no código.
- `exigir`: instruções que precisam aparecer; `A|B` aceita qualquer uma das duas.
- `maxBytes`: tamanho máximo do código, em bytes.
- `maxCiclos`: ciclos máximos em cada teste.
- `maxPassos`: limite de instruções antes de considerar laço infinito (padrão 3.000.000).
- `timer: sim`: liga a interrupção do timer (IRQ 0 a cada 3.000 instruções; muda proporcionalmente se o programa reprogramar o canal 0 do PIT).

Cada teste é um objeto JSON:

- `setup`: valores iniciais. Nomes de registradores (`AX`, `BL`...) ou de variáveis do programa. Variáveis aceitam número, vetor de números ou texto (só para variáveis `DB`). Em `DQ` e `DT` o número é gravado como real; em `DD`, só quando tem parte fracionária (`2.5`).
- `entrada`: teclas digitadas, como texto (`\r` é Enter, `\u001b` é Esc). Teclas especiais: `{ESC}`, `{ENTER}`, `{TAB}`, `{CIMA}`, `{BAIXO}`, `{ESQUERDA}`, `{DIREITA}`, `{HOME}`, `{END}`, `{PGUP}`, `{PGDN}`, `{INS}`, `{DEL}`, `{F1}` a `{F10}`. Se o programa instalar uma rotina na INT 9, as teclas ainda não lidas passam a chegar pela IRQ 1 (aperto e soltura).
- `arquivos`: arquivos no disco C: antes de rodar, como `{ "DADOS.TXT": "texto" }` ou com uma lista de bytes.
- `linhaComando`: a linha de comando do programa (`" ARQ.TXT"`).
- `residente`: para TSRs, `{ "passos": 30000, "entrada": "teclas" }` continua rodando o "prompt do DOS" por esse número de instruções depois do `AH=31h` (com o timer ligado) e digita as teclas. Use `"status": "residente"` na `espera`.
- `espera`: o que conferir no fim:

| Chave | Confere |
|-------|---------|
| `AX`, `BL`, `SI`... | valor do registrador (aceita negativos) |
| `CF`, `ZF`, `SF`, `OF`... | valor da flag (0 ou 1) |
| `mem` | variáveis: `{ "soma": 10, "vetor": [1, 2], "nome": ["A", "B"] }` (DD é lido como inteiro de 32 bits) |
| `reais` | variáveis reais (DD, DQ, DT): `{ "area": 78.54 }` ou `{ "area": [78.54, 0.001] }` com tolerância relativa |
| `st` | pilha do 8087: `[ST(0), ST(1), ...]`, com `null` para vazio |
| `modoVideo` | modo de vídeo no fim (`19` = 13h) |
| `pixel` | `{ "x,y": cor }` na memória A000h |
| `contaPixels` | `{ "cor": quantidade }` na tela 320x200 |
| `paleta` | `{ "índice": [r, g, b] }` (0 a 63) |
| `arquivos` | conteúdo dos arquivos no fim: `{ "SAIDA.TXT": "texto" }`, lista de bytes, ou `null` (não pode existir) |
| `arquivosFechados` | `true`: nenhum arquivo pode ficar aberto |
| `portas` | `{ "pit0": divisor, "pit2": divisor, "61": bits 0-1 da porta 61h, "imr": máscara do PIC }` |
| `notas` | frequências (Hz) tocadas pelo alto-falante, em ordem, com 1% de tolerância |
| `saida` | o texto impresso, exatamente |
| `saidaContem` | um texto (ou lista) que precisa aparecer na saída |
| `telaContem` | um texto (ou lista) que precisa aparecer na tela |
| `video` | células da tela: `{ "posição": ["caractere", atributo] }`, posição = linha × 80 + coluna |
| `pilhaEquilibrada` | SP no fim igual ao inicial |
| `preservar` | lista de registradores que precisam voltar aos valores do `setup` |
| `maxCiclos` | limite de ciclos só neste teste |
| `codigoSaida` | o valor de AL na saída com `AH=4Ch` |
| `status` | estado final esperado (padrão `terminado`; `residente` para TSRs) |

## Regras de conteúdo

- Só instruções e modos de endereçamento do 8086 real, na sintaxe MASM/TASM. O montador recusa as formas do 80186 em diante com uma mensagem explicando.
- Texto em português do Brasil. Nomes de rótulos e variáveis em português, sem acentos.
- Programas `.EXE` (modelo SMALL) sempre começam com `MOV AX,@DATA` / `MOV DS,AX`.
- O montador não tem `MACRO`. Rótulos `@@` valem só dentro do `PROC`. Símbolos não diferenciam maiúsculas: uma variável não pode ter o nome de uma constante `EQU`.
- Num programa do DOS, `HLT` termina o programa no simulador; para esperar o tempo passar, use os tiques (0040:006Ch) ou o retraço (porta 3DAh).
- Cada aula aponta os capítulos do livro da BIOS e do DOS com `[texto](livro:cap20)`.
- Explique o porquê, não só o como, e prefira exemplos que o aluno possa executar.
