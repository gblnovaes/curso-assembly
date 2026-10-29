# Trilha avançada: 386 e modo protegido

Esta pasta é a continuação do curso, a partir do módulo 16. Ela é separada de `conteudo/` para que o curso do 8086 não mude:

- as aulas usam **o mesmo formato** de `conteudo/LEIA-ME.md` (cabeçalho, blocos `asm`, `exercicio`, `quiz`, notas, diagramas e widgets);
- `npm run conteudo` compila esta pasta para `app/conteudo386.js`, à parte do `app/conteudo.js`;
- `npm test` confere esta trilha em `tests/avancado.test.js`; os testes do curso principal continuam os mesmos;
- ids de aula e de exercício não podem repetir os do curso principal (o build recusa), porque o progresso salvo é indexado por eles. Use `aula48`, `aula49`... e exercícios `a48-1`, `a48-2`...

## Links

- `[texto](avancado:aula48)` abre outra aula desta trilha.
- `[texto](aula:aula12)` abre uma aula do curso principal (bom para "reveja a aula 12").
- `ref:`, `livro:` e `lab` funcionam como no curso principal.

## A aba no aplicativo

A trilha fica **escondida** enquanto está em construção. Para vê-la:

- no aplicativo, menu **Opções → Cores, fonte e som…**, marque "Mostrar a trilha avançada (em construção)"; ou
- abra `app/index.html?avancado` no navegador.

Com ela ligada, aparece o menu **Avançado** e a rota `#avancado/<id>`.

## Programas com vários módulos

A partir da aula 50, um bloco `asm` ou um exercício pode ter vários arquivos. Cada um começa com uma linha-marcador:

```asm
;### MODULO PRINC.ASM
        ...                 ; um módulo: montado à parte, com PUBLIC e EXTRN
        END  inicio
;### MODULO TELA.ASM
        ...
        END
;### INCLUIR TELA.INC
        ...                 ; um arquivo que o INCLUDE TELA.INC lê
```

O montador (`Asm.ligar`) monta cada módulo separado e faz o papel do LINK: junta segmentos de mesmo nome, resolve EXTRN e recusa nomes de outro módulo sem EXTRN. Só um módulo pode ter `END rótulo`. Um código sem marcadores é montado como sempre, então os blocos do curso principal não mudam. Nas variáveis do `setup` e da `espera`, um nome repetido em dois módulos é escrito `MODULO:NOME` (por exemplo `PRINC:contador`).

## Simulador

Por enquanto as aulas desta trilha rodam no mesmo simulador do 8086. Quando entrar o simulador de 32 bits, ele virá num arquivo novo em `app/core/`, sem alterar o `cpu.js`, e as instruções do 386 só serão aceitas nesta trilha.
