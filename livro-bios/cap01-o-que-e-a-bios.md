---
id: cap01
numero: 1
parte: 1
titulo: O que é a BIOS e como conversar com ela
aulas: aula00; aula12; aula14
---

# Capítulo 1 · O que é a BIOS e como conversar com ela

> **Neste capítulo:** o papel da BIOS entre o programa e o hardware, a chamada por `INT n`,
> a passagem de parâmetros por registradores, as regras de preservação de registradores, a
> data de versão gravada em ROM e os grupos de sistemas que o manual da IBM usa.
>
> **Antes de ler:** [Aula 0, Bem-vindo ao IBM PC](../conteudo/aula00-bem-vindo.md) (o mapa
> CPU, memória e portas) e [Aula 14, Interrupções, IVT, DOS e BIOS](../conteudo/aula14-interrupcoes.md)
> (o que a instrução `INT` faz por dentro). A [Aula 12, Segmentos a fundo](../conteudo/aula12-segmentos.md)
> ajuda a ler endereços como `F000:FFF5`.

## 1.1 Uma camada entre você e os chips

A BIOS (*Basic Input/Output System*) é um conjunto de rotinas gravado em ROM que fica entre
os programas e o hardware. Em vez de programar diretamente as portas de E/S e os
registradores de cada controlador, o sistema operacional ou o aplicativo **pede um serviço**:
"leia este setor", "mostre este caractere", "que horas são?". A BIOS cuida dos detalhes do
equipamento.

```
  ┌────────────────────┐
  │  seu programa      │   MOV AH,0EH / INT 10H
  ├────────────────────┤
  │  DOS (INT 21H)     │   arquivos, processos, console
  ├────────────────────┤
  │  BIOS (INT 10H..)  │   vídeo, teclado, discos, relógio
  ├────────────────────┤
  │  hardware          │   portas de E/S, memória de vídeo, controladores
  └────────────────────┘
```

A grande vantagem é a **portabilidade**: se a temporização, o controlador ou o modelo da
máquina mudam, o programa que usa a BIOS continua funcionando, porque cada máquina traz a
sua própria BIOS adaptada ao seu hardware. Por isso a recomendação da IBM é sempre pedir
serviços à BIOS (ou ao sistema operacional) e evitar mexer nas portas de E/S por conta
própria. O [Capítulo 19](cap19-diretrizes-e-compatibilidade.md) volta a esse assunto.

A BIOS reside em ROMs na placa-mãe e, em alguns adaptadores opcionais (vídeo, por exemplo),
em ROMs da própria placa, que fornecem o controle em nível de dispositivo. Como essas ROMs
de placa são encontradas e ativadas durante a inicialização é o tema do
[Capítulo 12](cap12-boot-e-roms.md).

> **No curso.** A [Aula 14](../conteudo/aula14-interrupcoes.md) mostra as três camadas
> (DOS, BIOS e hardware) funcionando: o mesmo caractere pode ser escrito com `INT 21H`,
> com `INT 10H` ou gravando direto em `B800:0000`. Este livro é o mapa detalhado da camada
> do meio.

## 1.2 Como se chama a BIOS: interrupções de software

Cada grupo de serviços é acessado por uma instrução `INT n`. As interrupções de `INT 10H` a
`INT 1AH` levam, cada uma, a um grupo diferente de rotinas. Quando o grupo tem várias
funções, o registrador **AH** escolhe qual executar.

| Exemplo | O que faz |
|---|---|
| `INT 12H` | devolve o tamanho da memória (não usa AH) |
| `INT 1AH` com `AH=0` | lê o contador de tempo |
| `INT 1AH` com `AH=1` | ajusta o contador de tempo |

Lembrete da Aula 14: `INT n` empilha FLAGS, CS e IP, zera IF e TF e salta para o endereço
guardado na **tabela de vetores** em `0000:(n×4)`. A rotina da BIOS termina com `IRET`, que
desempilha tudo de volta. Como o endereço vem da tabela, o seu programa não precisa saber
onde a rotina mora, e outros programas podem trocar o vetor para interceptar o serviço
(base dos TSRs da [Aula 27](../conteudo/aula27-tsr.md)).

## 1.3 Passagem de parâmetros

Tudo entra e sai pelos **registradores do processador**. Cada função documenta quais
registradores usa na chamada e quais devolve no retorno.

Ajustar o relógio do sistema:

```asm fragmento
MOV  AH,1            ; função 1: acertar o contador de tempo
MOV  CX,HIGH_COUNT   ; parte alta da contagem
MOV  DX,LOW_COUNT    ; parte baixa da contagem
INT  1AH
```

Ler o relógio:

```asm fragmento
MOV  AH,0            ; função 0: ler o contador de tempo
INT  1AH             ; CX:DX = contagem
```

### Regras gerais que valem para todo o livro

1. **Preservação.** As rotinas preservam todos os registradores, **exceto AX, os flags e os
   registradores que carregam valores de retorno**. Algumas funções alteram outros
   registradores; isso é indicado caso a caso nos capítulos.
2. **Base 1.** Contagens e índices são **base 1** (começam em 1), a menos que se diga
   explicitamente que são base 0. Exemplo: setores de disco começam em 1; trilhas,
   cabeças, linhas e colunas da tela começam em 0 (e o texto avisa).
3. **Erro pelo carry.** Em muitas funções, `CF = 1` no retorno indica erro e `AH` traz o
   código. Testar com `JC` logo depois do `INT` é o padrão.
4. **Função ausente.** Quando um modelo não implementa uma função, a BIOS costuma devolver
   `CF = 1` com `AH = 80H` ou `86H`, ou simplesmente não fazer nada (o vídeo é o caso típico).
   Isso permite **detectar recursos** chamando a função e olhando o resultado.

> **Erro clássico.** Como AX não é preservado, código como
> `MOV AX,contador` / `MOV AH,0EH` / `INT 10H` / `ADD AX,1` perde o contador. Guarde o valor
> em outro registrador ou na pilha antes da chamada. A [Aula 20](../conteudo/aula20-depuracao.md)
> traz esse e outros erros do catálogo.

## 1.4 Áreas de dados e tabelas em ROM

Além das rotinas, a BIOS mantém duas estruturas que o programador consulta:

- **Áreas de dados**: trechos de RAM reservados para a BIOS do sistema e das placas usarem
  como área de trabalho. A principal fica em `0040:0000` a `0040:00FF` e guarda, por exemplo,
  o buffer do teclado e o contador de ticks. É o [Capítulo 17](cap17-area-de-dados-da-bios.md).
- **Tabelas em ROM**: descrevem as características dos dispositivos suportados por uma
  determinada BIOS, como os parâmetros de disquete e de vídeo. Alguns vetores de interrupção
  (1DH, 1EH, 1FH, 41H, 46H) não apontam para código, e sim para essas tabelas.

### Notação de endereços

O manual escreve `40:xx` para o segmento `0040H`. Assim, `40:6C` é o endereço lógico
`0040:006C`, que corresponde ao físico `0046CH` (0040H × 16 + 006CH). As aulas do curso usam
a forma longa (`0040:006Ch`); as duas significam a mesma coisa. Os números terminados em `H`
são hexadecimais, como em MASM e TASM, que aceitam `10H` ou `10h`.

## 1.5 Como descobrir a versão da BIOS

Toda BIOS tem uma **data de versão**, e o manual usa essa data para distinguir diferenças de
interface entre sistemas parecidos ("AT com BIOS de 10/06/85 em diante", por exemplo). A data
fica gravada em ROM no segmento **F000H**, offsets **FFF5H a FFFCH**: 8 caracteres ASCII no
formato `MM/DD/AA`.

Em BASIC, como no manual:

```basic
10 DEF SEG=&HF000
20 FOR X=&HFFF5 TO &HFFFC
30 PRINT CHR$(PEEK(X));
40 NEXT
```

A mesma coisa em Assembly, como programa DOS completo:

```asm titulo="DATABIOS.ASM: mostra a data da BIOS"
.MODEL SMALL
.STACK 100h
.CODE
inicio:
        MOV  AX,0F000H
        MOV  ES,AX          ; ES = segmento da ROM da BIOS
        MOV  SI,0FFF5H      ; primeiro caractere da data
        MOV  CX,8           ; 8 caracteres: MM/DD/AA
volta:  MOV  DL,ES:[SI]
        MOV  AH,02H         ; DOS: escreve o caractere em DL
        INT  21H
        INC  SI
        LOOP volta
        MOV  AX,4C00H
        INT  21H
END inicio
```

Repare no prefixo `ES:` do [capítulo de segmentos](../conteudo/aula12-segmentos.md): sem ele,
`[SI]` leria do segmento de dados. A outra forma de identificar a máquina, mais confiável, é
`INT 15H, AH=C0H`, que devolve o byte de modelo e os recursos do sistema
([Capítulo 8](cap08-equipamento-e-memoria.md) e [Capítulo 12](cap12-boot-e-roms.md)).

### Uma ferramenta para o livro inteiro: imprimir em hexadecimal

Quase tudo que a BIOS devolve (modos, códigos de status, mapas de bits) é mais legível em
hexadecimal. As rotinas abaixo são usadas em vários exemplos do livro. Para imprimir em
decimal, use a técnica de divisões sucessivas da [Aula 11](../conteudo/aula11-recursao.md).

```asm fragmento titulo="IMPHEX: imprime AL (2 dígitos) ou AX (4 dígitos) em hexadecimal"
; Entrada: AL = byte. Preserva todos os registradores.
imphex8 PROC
        PUSH AX
        PUSH CX
        PUSH DX
        MOV  DH,AL          ; guarda o byte
        MOV  CL,4
        SHR  AL,CL          ; nibble alto (8086: deslocamento > 1 só com CL)
        CALL digito
        MOV  AL,DH
        AND  AL,0FH         ; nibble baixo
        CALL digito
        POP  DX
        POP  CX
        POP  AX
        RET
imphex8 ENDP

; Entrada: AX = palavra.
imphex16 PROC
        PUSH AX
        MOV  AL,AH
        CALL imphex8        ; byte alto primeiro
        POP  AX
        CALL imphex8        ; depois o byte baixo
        RET
imphex16 ENDP

; Entrada: AL = 0..15. Escreve '0'..'9' ou 'A'..'F'.
digito  PROC
        ADD  AL,'0'
        CMP  AL,'9'
        JBE  escreve
        ADD  AL,7           ; pula de '9'+1 para 'A'
escreve: MOV  DL,AL
        MOV  AH,02H
        INT  21H
        RET
digito  ENDP
```

## 1.6 Grupos de sistemas

Para não repetir informação, o manual agrupa máquinas com interface de BIOS semelhante:

| Grupo | Observação |
|---|---|
| Personal System/2 | todos os modelos |
| Personal Computer XT | inclui o Portable PC |
| Personal Computer AT | todos os modelos |

Quando há exceção, ela é indicada no texto (por exemplo "PC Convertible", "PCjr",
"Model 30", "XT 286"). O manual também avisa que os suplementos no final podem trazer
informação que altera o que está nas outras partes; vale lê-los antes de tomar decisões de
projeto.

> **Como ler as notas de modelo neste livro.** O 8086 e o 8088 aparecem no PC, no XT, no
> PCjr, no PC Convertible e nos PS/2 Model 25 e 30. AT, XT 286 e a maioria dos PS/2 usam
> 80286 ou 80386. Funções marcadas "AT e posteriores" existem em máquinas de 8086 só quando a
> nota diz (o Model 30 é o caso mais comum). O curso simula um PC com 8086; por isso cada
> capítulo tem uma seção "No simulador do curso".

## 1.7 No simulador do curso

O simulador do curso implementa a parte da BIOS que as aulas usam: boa parte de `INT 10H`
(modos 3 e 13H, cursor, rolagem, caracteres, pixels, teletipo, DAC), `INT 16H` (ler, espiar,
estado), `INT 1AH` com `AH=0`, os tratadores de hardware `INT 08H` e `INT 09H` com o gancho
`INT 1CH`, e os campos da área de dados `40:13`, `40:49`, `40:4A` e `40:6C`. A ROM simulada não
imita uma BIOS da IBM: `DATABIOS.ASM` roda, mas a data sai em branco. Uma `INT` sem
serviço gera o aviso "não tem serviço no simulador; nada foi feito". Programas que dependem
de discos, serial, impressora ou `INT 15H` precisam de um PC real ou de um emulador completo
(DOSBox, 86Box, PCem). O [Apêndice A](apendice-a-referencia-rapida.md) marca, função por
função, o que roda no simulador.

## 1.8 Exercícios

1. Escreva um trecho que chama `INT 12H` e guarda o resultado em uma variável `memkb DW ?`.
   Que registrador você precisa salvar antes, se ele tinha um valor importante?
2. Converta para endereço físico: `40:1E`, `F000:FFF5`, `0000:0078`.
   *(Respostas: 0041EH, FFFF5H, 00078H.)*
3. Altere `DATABIOS.ASM` para também mostrar o byte em `F000:FFFE` (o byte de modelo, visto no
   [Capítulo 12](cap12-boot-e-roms.md)) em hexadecimal. Dica: a rotina `imphex8` da seção 1.5 e os procedimentos da
   [Aula 9](../conteudo/aula09-call-ret.md).

## Resumo

- A BIOS é a camada de serviços entre programas e hardware; usá-la garante portabilidade.
- Chama-se com `INT n`; AH escolhe a função; parâmetros vão e voltam por registradores.
- AX e flags não são preservados; `CF = 1` costuma indicar erro; índices são base 1, salvo
  aviso.
- A data da BIOS fica em `F000:FFF5`; o modelo, em `F000:FFFE` ou via `INT 15H, AH=C0H`.
