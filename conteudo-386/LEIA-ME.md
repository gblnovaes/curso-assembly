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

## Do módulo 17 em diante: NASM e a máquina 386

O módulo 16 ainda usa o montador e o simulador do 8086. Do módulo 17 em diante, os exemplos são blocos `nasm`, montados com o montador NASM do curso (`app/core/nasm.js`, idêntico byte a byte ao NASM 2.16) e executados na máquina 386 (`app/core/cpu386.js`). O `asm.js` e o `cpu.js` do curso principal não mudam.

````
```nasm executar modo="boot" titulo="PM.BIN: descrição"
        bits 16
        org 7C00h
        ...
```
````

- `executar`: mostra "▶ Executar aqui", que abre o painel da máquina 386 (código, registradores de 32 bits, CR0 a CR3, GDT, eventos, saída e tela). O teste roda o bloco e exige que ele termine.
- `modo`: `com` (padrão: um .COM do DOS em 0700:0100, termina com INT 21h/4Ch), `boot` (o bloco é um disco; a BIOS lê o setor 0 para 0000:7C00 com DL = 80h; termina com `cli`/`hlt`) ou `pm32` (já no modo protegido plano de 32 bits, com GDT em 500h: 08h código e 10h dados do anel 0, 1Bh e 23h do anel 3; o código fica em `org`, padrão 100000h).
- `org`: endereço de carga no modo pm32.
- `termina="excecao"`: o exemplo existe para mostrar uma exceção; o teste exige que ele pare com uma.
- `fragmento`, `titulo` e `entrada` como nos blocos `asm`.
- Um disco com vários arquivos usa linhas `;### ARQUIVO nome`: cada arquivo começa num setor novo, na ordem em que aparecem.

A porta **E9h** é a saída de depuração: o que se escreve nela aparece na caixa "Saída" (e no QEMU e no Bochs com `-debugcon`). A porta **F4h** desliga a máquina. Exceções sem tratador param a máquina com uma explicação, em vez de travar ou reiniciar.

### Exercícios na máquina 386

Um exercício com `maquina: 386` no cabeçalho é corrigido por `app/ui/verificador386.js`. Use também `modo` e, se precisar, `org`. As chaves de `setup` e `espera` são as do curso principal, com estas diferenças:

- registradores de 32, 16 e 8 bits, segmentos, flags, `eip`, `cr0`, `cr2`, `cr3`, `cpl`, `iopl`, `tr`, `ldtr`;
- `mem` e `setup` usam rótulos: `"total"` é um dword, `"total:w"` uma palavra, `"total:b"` um byte; texto e listas são bytes;
- `excecao` (número ou nome, como `"#GP"`), `status`, `modoProtegido`, `paginacao`, `a20`, `tela` (texto que precisa aparecer na tela), `saida`, `saidaContem`, `eventos`, `pilhaEquilibrada` e `preservar`.

## Conferindo a máquina 386

- `npm test` roda `tests/nasm.test.js` (o montador contra o binário que o NASM gerou) e `tests/cpu386.test.js` (cenários de sistema em `tests/cenarios386/`, contra a saída gravada do Bochs).
- `node tools/cenarios386.js` roda os cenários no Bochs, no QEMU e no simulador e compara (precisa de `nasm`, `bochs` e `qemu-system-i386`). A referência é o Bochs: o QEMU não confere limites de segmento nos acessos à memória. `--gravar` atualiza os `.esperado`.
- `node tools/difer386.js [semente]` gera centenas de instruções aleatórias de 16 e de 32 bits e compara registradores e flags com o QEMU.
