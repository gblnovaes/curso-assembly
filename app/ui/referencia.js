/* Referência rápida: instruções do 8086, serviços DOS/BIOS, ciclos e tabela ASCII. */
(function () {
  'use strict';
  const { h, escHtml, hex } = window.UI;

  // [mnemônico, grupo, formas, descrição, flags ODITSZAPC, ciclos (8086), observações]
  const INSTR = [
    ['MOV', 'Transferência', 'MOV destino, origem', 'Copia origem para destino. Não existe memória→memória nem imediato→registrador de segmento.', '---------', 'reg,reg 2 · reg,mem 8+EA · mem,reg 9+EA · reg,imm 4 · mem,imm 10+EA', 'CS não pode ser destino.'],
    ['XCHG', 'Transferência', 'XCHG op1, op2', 'Troca os valores dos dois operandos.', '---------', 'AX,reg 3 · reg,reg 4 · mem,reg 17+EA', 'XCHG AX,AX é o NOP (90h).'],
    ['LEA', 'Transferência', 'LEA reg16, memória', 'Carrega o ENDEREÇO (offset) do operando, sem acessar a memória.', '---------', '2+EA', 'Útil também para somas: LEA AX,[BX+SI+3].'],
    ['LDS', 'Transferência', 'LDS reg16, memória', 'Carrega um ponteiro far: reg = word[mem], DS = word[mem+2].', '---------', '16+EA', ''],
    ['LES', 'Transferência', 'LES reg16, memória', 'Carrega um ponteiro far: reg = word[mem], ES = word[mem+2].', '---------', '16+EA', ''],
    ['PUSH', 'Pilha', 'PUSH reg16 | sreg | mem16', 'SP = SP − 2, depois grava o valor em SS:SP.', '---------', 'reg 11 · sreg 10 · mem 16+EA', 'PUSH imediato só existe a partir do 80186. No 8086, PUSH SP grava o SP já decrementado.'],
    ['POP', 'Pilha', 'POP reg16 | sreg | mem16', 'Lê a word em SS:SP, depois SP = SP + 2.', '---------', 'reg 8 · sreg 8 · mem 17+EA', 'POP CS não é permitido.'],
    ['PUSHF', 'Pilha', 'PUSHF', 'Empilha o registrador de FLAGS.', '---------', '10', 'No 8086 os bits 12–15 aparecem como 1.'],
    ['POPF', 'Pilha', 'POPF', 'Desempilha para FLAGS.', 'MMMMMMMMM', '8', ''],
    ['LAHF', 'Transferência', 'LAHF', 'AH = byte baixo de FLAGS (SF ZF - AF - PF - CF).', '---------', '4', ''],
    ['SAHF', 'Transferência', 'SAHF', 'Byte baixo de FLAGS = AH.', '----MMMMM', '4', ''],
    ['XLAT', 'Transferência', 'XLAT', 'AL = byte em DS:[BX+AL] (consulta em tabela).', '---------', '11', ''],
    ['IN', 'E/S', 'IN AL|AX, porta8 | DX', 'Lê de uma porta de E/S.', '---------', 'imm 10 · DX 8', ''],
    ['OUT', 'E/S', 'OUT porta8 | DX, AL|AX', 'Escreve em uma porta de E/S.', '---------', 'imm 10 · DX 8', 'OUT 20h,AL com AL=20h envia EOI ao PIC 8259A.'],
    ['ADD', 'Aritmética', 'ADD destino, origem', 'destino = destino + origem.', 'M---MMMMM', 'reg,reg 3 · reg,mem 9+EA · mem,reg 16+EA · reg,imm 4 · mem,imm 17+EA', ''],
    ['ADC', 'Aritmética', 'ADC destino, origem', 'destino = destino + origem + CF (soma com vai-um, para números grandes).', 'M---MMMMM', 'como ADD', ''],
    ['SUB', 'Aritmética', 'SUB destino, origem', 'destino = destino − origem.', 'M---MMMMM', 'como ADD', ''],
    ['SBB', 'Aritmética', 'SBB destino, origem', 'destino = destino − origem − CF (subtração com empréstimo).', 'M---MMMMM', 'como ADD', ''],
    ['CMP', 'Aritmética', 'CMP op1, op2', 'Calcula op1 − op2 só para ajustar as FLAGS. Os operandos NÃO mudam.', 'M---MMMMM', 'reg,reg 3 · reg,mem 9+EA · mem,reg 9+EA · mem,imm 10+EA', 'Use em seguida um salto condicional.'],
    ['INC', 'Aritmética', 'INC destino', 'destino = destino + 1.', 'M---MMMM-', 'reg16 2 · reg8 3 · mem 15+EA', 'NÃO altera CF.'],
    ['DEC', 'Aritmética', 'DEC destino', 'destino = destino − 1.', 'M---MMMM-', 'reg16 2 · reg8 3 · mem 15+EA', 'NÃO altera CF.'],
    ['NEG', 'Aritmética', 'NEG destino', 'destino = 0 − destino (troca o sinal em complemento de dois).', 'M---MMMMM', 'reg 3 · mem 16+EA', 'CF=1 se o operando era diferente de zero. NEG 8000h dá 8000h com OF=1.'],
    ['MUL', 'Aritmética', 'MUL reg|mem', 'Sem sinal. 8 bits: AX = AL × op. 16 bits: DX:AX = AX × op.', 'M---????M', 'r8 70–77 · r16 118–133 · mem +6+EA', 'Não aceita imediato. CF=OF=1 se a metade alta é diferente de zero.'],
    ['IMUL', 'Aritmética', 'IMUL reg|mem', 'Com sinal. 8 bits: AX = AL × op. 16 bits: DX:AX = AX × op.', 'M---????M', 'r8 80–98 · r16 128–154 · mem +6+EA', 'No 8086 só existe a forma de UM operando. IMUL reg,imm é do 80186.'],
    ['DIV', 'Aritmética', 'DIV reg|mem', 'Sem sinal. 8 bits: AX ÷ op → AL quociente, AH resto. 16 bits: DX:AX ÷ op → AX quociente, DX resto.', '?---?????', 'r8 80–90 · r16 144–162 · mem +6+EA', 'Divisor zero ou quociente grande demais geram INT 0. Zere DX antes (XOR DX,DX).'],
    ['IDIV', 'Aritmética', 'IDIV reg|mem', 'Com sinal; mesmos registradores de DIV. Trunca em direção a zero; o resto tem o sinal do dividendo.', '?---?????', 'r8 101–112 · r16 165–184 · mem +6+EA', 'Estenda o sinal antes com CBW/CWD. -32768 ÷ -1 gera INT 0.'],
    ['CBW', 'Aritmética', 'CBW', 'Estende o sinal de AL para AX (AH = 00h ou FFh).', '---------', '2', ''],
    ['CWD', 'Aritmética', 'CWD', 'Estende o sinal de AX para DX:AX (DX = 0000h ou FFFFh).', '---------', '5', ''],
    ['DAA', 'BCD', 'DAA', 'Ajuste decimal de AL depois de ADD com números BCD compactados.', '?---MMMMM', '4', ''],
    ['DAS', 'BCD', 'DAS', 'Ajuste decimal de AL depois de SUB com BCD compactado.', '?---MMMMM', '4', ''],
    ['AAA', 'BCD', 'AAA', 'Ajuste ASCII depois de soma (BCD descompactado).', '?---??M?M', '8', ''],
    ['AAS', 'BCD', 'AAS', 'Ajuste ASCII depois de subtração.', '?---??M?M', '8', ''],
    ['AAM', 'BCD', 'AAM', 'AH = AL ÷ 10, AL = AL mod 10 (depois de MUL).', '?---MM?M?', '83', ''],
    ['AAD', 'BCD', 'AAD', 'AL = AH × 10 + AL, AH = 0 (antes de DIV).', '?---MM?M?', '60', ''],
    ['AND', 'Lógica', 'AND destino, origem', 'E bit a bit. Use para zerar bits (máscaras).', '0---MM?M0', 'como ADD', ''],
    ['OR', 'Lógica', 'OR destino, origem', 'OU bit a bit. Use para ligar bits.', '0---MM?M0', 'como ADD', ''],
    ['XOR', 'Lógica', 'XOR destino, origem', 'OU exclusivo bit a bit. XOR AX,AX zera AX.', '0---MM?M0', 'como ADD', ''],
    ['NOT', 'Lógica', 'NOT destino', 'Inverte todos os bits (complemento de um).', '---------', 'reg 3 · mem 16+EA', 'Não altera nenhuma flag.'],
    ['TEST', 'Lógica', 'TEST op1, op2', 'AND só para ajustar FLAGS; os operandos não mudam.', '0---MM?M0', 'reg,reg 3 · reg,imm 5 · acc,imm 4 · mem,imm 11+EA', 'TEST AL,1 testa se é ímpar.'],
    ['SHL', 'Deslocamento', 'SHL destino, 1 | CL', 'Desloca para a esquerda (multiplica por 2). O bit que sai vai para CF.', 'M---MM?MM', 'reg,1 2 · reg,CL 8+4/bit · mem,1 15+EA · mem,CL 20+EA+4/bit', 'Imediato maior que 1 só no 80186+. SAL é o mesmo que SHL.'],
    ['SAL', 'Deslocamento', 'SAL destino, 1 | CL', 'Igual a SHL.', 'M---MM?MM', 'como SHL', ''],
    ['SHR', 'Deslocamento', 'SHR destino, 1 | CL', 'Desloca para a direita, entrando 0 (divide sem sinal por 2).', 'M---MM?MM', 'como SHL', ''],
    ['SAR', 'Deslocamento', 'SAR destino, 1 | CL', 'Desloca para a direita repetindo o bit de sinal (divide com sinal por 2, arredondando para baixo).', 'M---MM?MM', 'como SHL', ''],
    ['ROL', 'Deslocamento', 'ROL destino, 1 | CL', 'Rotaciona para a esquerda; o bit que sai entra pela direita e em CF.', 'M-------M', 'como SHL', ''],
    ['ROR', 'Deslocamento', 'ROR destino, 1 | CL', 'Rotaciona para a direita.', 'M-------M', 'como SHL', ''],
    ['RCL', 'Deslocamento', 'RCL destino, 1 | CL', 'Rotaciona para a esquerda passando por CF (17 ou 9 bits).', 'M-------M', 'como SHL', ''],
    ['RCR', 'Deslocamento', 'RCR destino, 1 | CL', 'Rotaciona para a direita passando por CF.', 'M-------M', 'como SHL', ''],
    ['JMP', 'Controle', 'JMP rótulo | reg | mem | FAR PTR rótulo', 'Salto incondicional (curto, próximo, distante ou indireto).', '---------', '15 · reg 11 · mem 18+EA', ''],
    ['Jcc', 'Controle', 'JE/JZ JNE/JNZ JA JAE JB JBE JG JGE JL JLE JC JNC JO JNO JS JNS JP JNP', 'Salto condicional curto (−128 a +127 bytes), conforme as FLAGS.', '---------', '16 se salta · 4 se não', 'A/B = sem sinal (CF,ZF). G/L = com sinal (SF,OF,ZF). No 8086 não há salto condicional longo.'],
    ['LOOP', 'Controle', 'LOOP rótulo', 'CX = CX − 1; salta se CX ≠ 0.', '---------', '17 se salta · 5 se não', 'Não altera FLAGS. Com CX = 0 na entrada roda 65.536 vezes.'],
    ['LOOPE', 'Controle', 'LOOPE/LOOPZ rótulo', 'CX = CX − 1; salta se CX ≠ 0 e ZF = 1.', '---------', '18 · 6', ''],
    ['LOOPNE', 'Controle', 'LOOPNE/LOOPNZ rótulo', 'CX = CX − 1; salta se CX ≠ 0 e ZF = 0.', '---------', '19 · 5', ''],
    ['JCXZ', 'Controle', 'JCXZ rótulo', 'Salta se CX = 0 (não altera CX).', '---------', '18 · 6', 'Proteja laços LOOP com JCXZ.'],
    ['CALL', 'Controle', 'CALL rótulo | reg | mem', 'Empilha o endereço de retorno (IP, ou CS e IP se far) e salta.', '---------', 'near 19 · far 28 · reg 16 · mem 21+EA', ''],
    ['RET', 'Controle', 'RET [n] / RETF [n]', 'Desempilha IP (e CS se far); com n, soma n a SP depois (descarta parâmetros).', '---------', 'near 8 · near n 12 · far 18 · far n 17', ''],
    ['INT', 'Interrupção', 'INT n', 'Empilha FLAGS, CS e IP, zera IF e TF, salta para o vetor n (0000:n×4).', '--00-----', '51 · INT 3: 52', ''],
    ['INTO', 'Interrupção', 'INTO', 'Gera INT 4 se OF = 1.', '--**-----', '53 / 4', ''],
    ['IRET', 'Interrupção', 'IRET', 'Desempilha IP, CS e FLAGS (fim de uma rotina de interrupção).', 'MMMMMMMMM', '24', ''],
    ['MOVSB', 'String', 'MOVSB / MOVSW', 'Copia DS:[SI] para ES:[DI]; SI e DI avançam (DF=0) ou recuam (DF=1).', '---------', '18 · REP: 9+17/rep', ''],
    ['CMPSB', 'String', 'CMPSB / CMPSW', 'Compara DS:[SI] com ES:[DI] (como CMP) e avança SI e DI.', 'M---MMMMM', '22 · REP: 9+22/rep', 'Use REPE/REPNE.'],
    ['SCASB', 'String', 'SCASB / SCASW', 'Compara AL/AX com ES:[DI] e avança DI.', 'M---MMMMM', '15 · REP: 9+15/rep', ''],
    ['LODSB', 'String', 'LODSB / LODSW', 'AL/AX = DS:[SI] e avança SI.', '---------', '12 · REP: 9+13/rep', ''],
    ['STOSB', 'String', 'STOSB / STOSW', 'ES:[DI] = AL/AX e avança DI.', '---------', '11 · REP: 9+10/rep', 'REP STOSW preenche memória rapidamente.'],
    ['REP', 'String', 'REP / REPE / REPNE instr', 'Repete a instrução de string CX vezes (REPE/REPNE param também por ZF).', '---------', '—', ''],
    ['CLC', 'FLAGS', 'CLC / STC / CMC', 'CF = 0 / CF = 1 / inverte CF.', '--------M', '2', ''],
    ['CLD', 'FLAGS', 'CLD / STD', 'DF = 0 (strings avançam) / DF = 1 (recuam).', '-M-------', '2', ''],
    ['CLI', 'FLAGS', 'CLI / STI', 'Desliga / liga as interrupções de hardware (IF).', '--M------', '2', ''],
    ['NOP', 'Controle', 'NOP', 'Não faz nada (1 byte, 3 ciclos).', '---------', '3', ''],
    ['HLT', 'Controle', 'HLT', 'Para a CPU até a próxima interrupção.', '---------', '2', ''],
    ['WAIT', 'Controle', 'WAIT (FWAIT)', 'Espera o coprocessador 8087 terminar a instrução atual.', '---------', '3', 'O MASM coloca 9Bh (WAIT) antes de cada instrução do 8087.']
  ];

  // [instrução, formas, o que faz, ciclos típicos do 8087]
  const FPU = [
    ['FINIT', 'FINIT / FNINIT', 'Reinicia o 8087: pilha vazia, palavra de controle 03FFh (arredonda ao mais próximo, exceções mascaradas).', '2–8'],
    ['FLD', 'FLD mem32|mem64|mem80 · FLD ST(i)', 'Empilha um real (DD, DQ ou DT) ou uma cópia de ST(i).', '38–56 (mem) · 17–22 (ST)'],
    ['FILD', 'FILD mem16|mem32|mem64', 'Empilha um inteiro (DW, DD ou DQ) convertido em real.', '46–60'],
    ['FBLD', 'FBLD mem80', 'Empilha um número BCD compactado de 18 dígitos (DT).', '290–310'],
    ['FST / FSTP', 'FST mem32|mem64|ST(i) · FSTP mem32|mem64|mem80|ST(i)', 'Grava ST na memória ou em ST(i); FSTP também desempilha.', '84–105 (mem) · 15–22 (ST)'],
    ['FIST / FISTP', 'FIST mem16|mem32 · FISTP mem16|mem32|mem64', 'Grava ST como inteiro, arredondando conforme a palavra de controle.', '80–100'],
    ['FBSTP', 'FBSTP mem80', 'Grava ST como BCD de 18 dígitos e desempilha.', '520–540'],
    ['FXCH', 'FXCH [ST(i)]', 'Troca ST com ST(i) (sem operando: ST(1)).', '10–15'],
    ['FADD', 'FADD mem · FADD ST,ST(i) · FADD ST(i),ST · FADD', 'Soma. Sem operandos: ST(1) = ST(1) + ST e desempilha.', '70–100'],
    ['FSUB / FSUBR', 'como FADD', 'Subtrai; a forma R inverte a ordem (origem − destino).', '70–100'],
    ['FMUL', 'como FADD', 'Multiplica.', '90–145'],
    ['FDIV / FDIVR', 'como FADD', 'Divide; a forma R inverte a ordem. Divisão por zero dá infinito (exceção mascarada).', '193–203'],
    ['FADDP...', 'FADDP ST(i),ST (e FSUBP, FSUBRP, FMULP, FDIVP, FDIVRP)', 'Faz a operação em ST(i) e desempilha.', 'como a operação'],
    ['FIADD...', 'FIADD mem16|mem32 (e FISUB, FISUBR, FIMUL, FIDIV, FIDIVR, FICOM, FICOMP)', 'Operação com um inteiro da memória.', '+30 a +50'],
    ['FCOM', 'FCOM [mem|ST(i)] · FCOMP · FCOMPP', 'Compara ST com o operando e acende C3, C2, C0. As formas P desempilham.', '40–50'],
    ['FTST', 'FTST', 'Compara ST com 0,0.', '38–48'],
    ['FSTSW', 'FSTSW mem16 / FNSTSW mem16', 'Grava a palavra de status. Depois: MOV AX,mem / SAHF e use JA, JB, JE (C3→ZF, C0→CF). FSTSW AX só existe a partir do 80287.', '12–18'],
    ['FSTCW / FLDCW', 'FSTCW mem16 · FLDCW mem16', 'Grava / carrega a palavra de controle (bits 10–11: arredondamento 00 mais próximo, 01 para baixo, 10 para cima, 11 truncar).', '7–15'],
    ['FCHS / FABS', 'FCHS · FABS', 'Troca o sinal / valor absoluto de ST.', '10–17'],
    ['FSQRT', 'FSQRT', 'Raiz quadrada de ST.', '180–186'],
    ['FRNDINT', 'FRNDINT', 'Arredonda ST para inteiro (conforme a palavra de controle).', '16–50'],
    ['FSCALE / FXTRACT', 'FSCALE · FXTRACT', 'ST × 2^ST(1) / separa expoente e mantissa.', '27–62'],
    ['FPREM', 'FPREM', 'Resto parcial de ST ÷ ST(1).', '15–190'],
    ['FPTAN / FPATAN', 'FPTAN · FPATAN', 'Tangente parcial (0 ≤ ST ≤ π/4) / arco tangente de ST(1)/ST. O 8087 não tem FSIN nem FCOS (só no 80387).', '30–540 / 250–800'],
    ['F2XM1 / FYL2X', 'F2XM1 · FYL2X · FYL2XP1', '2^ST − 1 / ST(1) × log2(ST) / ST(1) × log2(ST + 1).', '310–1000'],
    ['Constantes', 'FLDZ · FLD1 · FLDPI · FLDL2T · FLDL2E · FLDLG2 · FLDLN2', 'Empilham 0, 1, π, log2(10), log2(e), log10(2) e ln(2).', '11–24'],
    ['FFREE / FINCSTP / FDECSTP', 'FFREE ST(i) · FINCSTP · FDECSTP', 'Marca ST(i) como vazio / gira o ponteiro TOP.', '6–12'],
    ['FCLEX', 'FCLEX / FNCLEX', 'Limpa os bits de exceção da palavra de status.', '2–8']
  ];
  const PORTAS = [
    ['20h', 'PIC 8259A', 'OUT 20h,AL com AL=20h: fim de interrupção (EOI). IN: registrador em serviço.'],
    ['21h', 'PIC 8259A', 'Máscara de interrupções (bit 0 = IRQ0 timer, bit 1 = IRQ1 teclado...). 1 = desligada.'],
    ['40h', 'PIT 8253, canal 0', 'Timer do sistema (IRQ0). Divisor padrão 65536 → 18,2 Hz.'],
    ['41h', 'PIT 8253, canal 1', 'Refresh da memória (não mexa).'],
    ['42h', 'PIT 8253, canal 2', 'Alto-falante: frequência = 1.193.182 ÷ divisor.'],
    ['43h', 'PIT 8253, controle', 'Bits 7-6 canal, 5-4 acesso (00 = trava a contagem, 11 = byte baixo e depois alto), 3-1 modo. Ex.: B6h = canal 2, modo 3; 36h = canal 0, modo 3.'],
    ['60h', 'Teclado', 'Scan code da última tecla: aperto (make) ou soltura (break = make OR 80h).'],
    ['61h', 'PPI 8255, porta B', 'Bit 0 liga o canal 2 do PIT; bit 1 liga o alto-falante. Ligue os dois para tocar.'],
    ['64h', 'Controlador do teclado', 'Bit 0 = há um byte para ler na porta 60h.'],
    ['3C7h', 'VGA DAC', 'Índice da cor que será lida pela porta 3C9h.'],
    ['3C8h', 'VGA DAC', 'Índice da cor que será gravada pela porta 3C9h.'],
    ['3C9h', 'VGA DAC', 'Componentes vermelho, verde e azul (0 a 63), nessa ordem; o índice avança sozinho depois do azul.'],
    ['3DAh', 'VGA, status', 'Bit 3 = retraço vertical (o feixe está voltando ao topo: hora de mexer na tela e na paleta).']
  ];
  const PSP = [
    ['00h', '2', 'INT 20h (CD 20h): voltar para o PSP:0000 termina o programa'],
    ['02h', '2', 'Segmento do fim da memória disponível (A000h com 640 KB)'],
    ['16h', '2', 'Segmento do PSP do programa pai (COMMAND.COM)'],
    ['18h', '20', 'Tabela de handles do processo (FFh = livre)'],
    ['2Ch', '2', 'Segmento do bloco de ambiente (PATH=..., COMSPEC=...)'],
    ['5Ch', '16', 'FCB 1: primeiro parâmetro, já no formato NOME     EXT'],
    ['6Ch', '16', 'FCB 2: segundo parâmetro'],
    ['80h', '1', 'Tamanho da linha de comando'],
    ['81h', '127', 'Linha de comando (começa com espaço, termina com 0Dh); também é a DTA padrão']
  ];
  const ERROS = [['1', 'Função inválida'], ['2', 'Arquivo não encontrado'], ['3', 'Caminho não encontrado'], ['4', 'Handles esgotados (arquivos abertos demais)'], ['5', 'Acesso negado'], ['6', 'Handle inválido'], ['7', 'Blocos de controle de memória destruídos'], ['8', 'Memória insuficiente'], ['9', 'Endereço de bloco de memória inválido'], ['12', 'Código de acesso inválido'], ['18', 'Não há mais arquivos']];

  const INT21 = [
    ['01h', 'Ler caractere com eco', '—', 'AL = caractere'],
    ['02h', 'Imprimir caractere', 'DL = caractere', 'AL = DL'],
    ['06h', 'E/S direta do console', 'DL = caractere, ou DL=FFh para ler', 'ZF=1 se não há tecla; AL = caractere'],
    ['07h', 'Ler caractere sem eco (sem Ctrl+C)', '—', 'AL = caractere'],
    ['08h', 'Ler caractere sem eco', '—', 'AL = caractere'],
    ['09h', 'Imprimir string terminada em $', 'DS:DX = endereço da string', 'AL = 24h'],
    ['0Ah', 'Entrada com buffer (linha)', 'DS:DX = buffer: [máximo][lidos][texto...]', 'buffer preenchido; termina com 0Dh'],
    ['0Bh', 'Há tecla disponível?', '—', 'AL = FFh se sim, 00h se não'],
    ['0Ch', 'Limpar buffer e chamar função', 'AL = função (01h,06h,07h,08h,0Ah)', 'como a função chamada'],
    ['25h', 'Definir vetor de interrupção', 'AL = número, DS:DX = rotina', '—'],
    ['2Ah', 'Data do sistema', '—', 'CX = ano, DH = mês, DL = dia, AL = dia da semana'],
    ['2Ch', 'Hora do sistema', '—', 'CH = hora, CL = min, DH = s, DL = centésimos'],
    ['30h', 'Versão do DOS', '—', 'AL = maior, AH = menor'],
    ['35h', 'Ler vetor de interrupção', 'AL = número', 'ES:BX = endereço da rotina'],
    ['0Eh', 'Selecionar drive', 'DL = drive (0 = A:)', 'AL = número de drives'],
    ['19h', 'Drive atual', '—', 'AL = drive (2 = C:)'],
    ['1Ah', 'Definir a DTA', 'DS:DX = área de 128 bytes', '—'],
    ['2Fh', 'Ler a DTA', '—', 'ES:BX = DTA atual'],
    ['31h', 'Terminar e ficar residente (TSR)', 'AL = código, DX = parágrafos a manter (contando o PSP)', 'não retorna; o programa fica na memória'],
    ['34h', 'Endereço do flag InDOS', '—', 'ES:BX → byte (≠ 0 = o DOS está ocupado)'],
    ['36h', 'Espaço livre no disco', 'DL = drive (0 = atual)', 'AX = setores/cluster, BX = clusters livres, CX = bytes/setor'],
    ['3Bh', 'Mudar diretório', 'DS:DX = caminho ASCIIZ', 'CF=1 se erro'],
    ['3Ch', 'Criar arquivo (ou zerar)', 'DS:DX = nome ASCIIZ, CX = atributos (0 = normal)', 'AX = handle; CF=1 e AX = erro'],
    ['3Dh', 'Abrir arquivo', 'DS:DX = nome ASCIIZ, AL = 0 leitura, 1 escrita, 2 ambos', 'AX = handle; CF=1 e AX = erro'],
    ['3Eh', 'Fechar arquivo', 'BX = handle', 'CF=1 se erro'],
    ['3Fh', 'Ler de arquivo ou dispositivo', 'BX = handle, CX = bytes, DS:DX = buffer', 'AX = bytes lidos (0 = fim do arquivo)'],
    ['40h', 'Gravar em arquivo ou dispositivo', 'BX = handle (1 = tela), CX = bytes, DS:DX = dados', 'AX = bytes gravados; CX=0 corta o arquivo'],
    ['41h', 'Apagar arquivo', 'DS:DX = nome ASCIIZ', 'CF=1 se erro'],
    ['42h', 'Mover o ponteiro do arquivo', 'BX = handle, AL = 0 início, 1 atual, 2 fim; CX:DX = deslocamento', 'DX:AX = nova posição'],
    ['43h', 'Ler/definir atributos', 'AL = 0 ler, 1 definir; DS:DX = nome; CX = atributos', 'CX = atributos'],
    ['44h', 'IOCTL: informação do dispositivo', 'AL = 0, BX = handle', 'DX: bit 7 = 1 se é dispositivo'],
    ['45h', 'Duplicar handle', 'BX = handle', 'AX = novo handle'],
    ['46h', 'Forçar handle', 'BX = handle, CX = handle destino', '—'],
    ['47h', 'Diretório atual', 'DL = drive, DS:SI = buffer de 64 bytes', 'buffer com o caminho (sem C:\\)'],
    ['48h', 'Alocar memória', 'BX = parágrafos (16 bytes)', 'AX = segmento; se CF=1, BX = maior bloco livre'],
    ['49h', 'Liberar memória', 'ES = segmento do bloco', 'CF=1 se erro'],
    ['4Ah', 'Redimensionar bloco', 'ES = segmento, BX = novo tamanho em parágrafos', 'se CF=1, BX = máximo possível'],
    ['4Ch', 'Terminar programa', 'AL = código de saída', 'não retorna'],
    ['4Eh', 'Achar o primeiro arquivo', 'DS:DX = máscara (*.TXT), CX = atributos', 'DTA+1Eh = nome, DTA+1Ah = tamanho; CF=1 se nenhum'],
    ['4Fh', 'Achar o próximo', '(usa a DTA da busca)', 'como 4Eh'],
    ['56h', 'Renomear arquivo', 'DS:DX = nome atual, ES:DI = novo nome', 'CF=1 se erro'],
    ['62h', 'Endereço do PSP', '—', 'BX = segmento do PSP']
  ];
  const INTBIOS = [
    ['INT 10h', '00h', 'Definir modo de vídeo (03h = texto 80x25 colorido)', 'AL = modo'],
    ['INT 10h', '02h', 'Posicionar cursor', 'BH = página, DH = linha, DL = coluna'],
    ['INT 10h', '03h', 'Ler posição do cursor', 'BH = página → DH, DL'],
    ['INT 10h', '06h', 'Rolar janela para cima (AL=0 limpa)', 'AL = linhas, BH = atributo, CH,CL = canto sup. esq., DH,DL = canto inf. dir.'],
    ['INT 10h', '07h', 'Rolar janela para baixo', 'como 06h'],
    ['INT 10h', '08h', 'Ler caractere e atributo no cursor', '→ AL = caractere, AH = atributo'],
    ['INT 10h', '09h', 'Escrever caractere com atributo', 'AL = caractere, BL = atributo, CX = repetições'],
    ['INT 10h', '0Eh', 'Escrever caractere (teletipo)', 'AL = caractere'],
    ['INT 10h', '0Fh', 'Ler modo de vídeo', '→ AL = modo, AH = colunas'],
    ['INT 10h', '00h', 'Modo gráfico 13h: 320x200 com 256 cores, 1 byte por pixel em A000h', 'AX = 0013h (volte ao texto com AX = 0003h)'],
    ['INT 10h', '0Ch', 'Acender pixel (modo gráfico)', 'AL = cor, CX = x, DX = y'],
    ['INT 10h', '0Dh', 'Ler pixel', 'CX = x, DX = y → AL = cor'],
    ['INT 10h', '0Eh', 'Teletipo no modo 13h', 'AL = caractere, BL = cor'],
    ['INT 10h', '10h', 'Paleta: AL=10h uma cor, AL=12h um bloco, AL=15h/17h ler', 'AL=10h: BX = índice, DH = R, CH = G, CL = B (0 a 63)'],
    ['INT 10h', '11h', 'AL=30h: endereço da fonte', 'BH = 3 (8x8, 0–127) → ES:BP'],
    ['INT 16h', '00h', 'Esperar tecla', '→ AH = scan code, AL = ASCII'],
    ['INT 16h', '01h', 'Há tecla? (não remove)', '→ ZF=1 se não há; senão AX = tecla'],
    ['INT 1Ah', '00h', 'Contador de tiques (18,2 por segundo)', '→ CX:DX = tiques desde a meia-noite'],
    ['INT 08h', '—', 'IRQ0, timer (18,2 vezes por segundo)', 'A BIOS soma 1 em 0040:006Ch e chama a INT 1Ch'],
    ['INT 09h', '—', 'IRQ1, teclado', 'A BIOS lê a porta 60h, põe a tecla no buffer e manda o EOI'],
    ['INT 1Ch', '—', 'Gancho do usuário no timer', 'Chamada pela INT 08h; termine com IRET'],
    ['INT 28h', '—', 'O DOS está ocioso esperando comando', 'TSRs podem trabalhar aqui'],
    ['INT 2Fh', 'xxh', 'Multiplex: "você está instalado?"', 'AH = número do programa, AL = 0 → AL = FFh se instalado'],
    ['INT 20h', '—', 'Terminar programa .COM', 'CS = PSP']
  ];
  const EA = [
    ['[desloc]', '6'], ['[BX] [BP] [SI] [DI]', '5'], ['[BX+desloc] [BP+desloc] [SI+desloc] [DI+desloc]', '9'],
    ['[BP+DI] [BX+SI]', '7'], ['[BP+SI] [BX+DI]', '8'], ['[BP+DI+desloc] [BX+SI+desloc]', '11'], ['[BP+SI+desloc] [BX+DI+desloc]', '12'],
    ['prefixo de segmento (ES:, CS:...)', '+2'], ['word em endereço ímpar', '+4 por acesso']
  ];

  // data-label repete o cabeçalho em cada célula: em telas estreitas cada linha vira um cartão (veja dos.css)
  function tabela(cab, linhas) {
    return '<div class="tabela ref-tab"><table><thead><tr>' + cab.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
      linhas.map(l => '<tr>' + l.map((c, i) => '<td data-label="' + escHtml(cab[i]) + '"><div>' + c + '</div></td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  const flagsStr = (f) => 'ODITSZAPC'.split('').map((n, i) => f[i] === '-' ? '<span style="opacity:.35">' + n.toLowerCase() + '</span>' : '<b title="' + ({ M: 'modificada', '?': 'indefinida', '0': 'zerada', '1': 'ligada' }[f[i]] || '') + '">' + n + (f[i] === 'M' ? '' : f[i]) + '</b>').join('');

  function criar(sub) {
    const conteudo = h('div.aula', { style: { maxWidth: '130ch' } });
    const abas = [['instr', 'Instruções'], ['fpu', '8087'], ['int21', 'INT 21h (DOS)'], ['bios', 'BIOS'], ['portas', 'Portas e memória'], ['ciclos', 'Endereçamento e ciclos'], ['ascii', 'Tabela ASCII (CP437)'], ['atalhos', 'Atalhos']];
    const barra = h('div.ref-tabs');
    const mostrar = (id, filtro) => {
      barra.querySelectorAll('.tab').forEach(t => t.classList.toggle('ativo', t.dataset.id === id));
      conteudo.innerHTML = '';
      if (id === 'instr') {
        const busca = h('input.ref-busca', { type: 'text', placeholder: 'Buscar instrução…', value: filtro || '' });
        const lista = h('div');
        const render = () => {
          const q = busca.value.trim().toUpperCase();
          const ls = INSTR.filter(i => !q || i[0].includes(q) || i[2].toUpperCase().includes(q) || i[1].toUpperCase().includes(q) || i[3].toUpperCase().includes(q));
          lista.innerHTML = tabela(['Instrução', 'Formas', 'O que faz', 'Flags', 'Ciclos (8086)'], ls.map(i => ['<b>' + i[0] + '</b><br><span style="opacity:.7">' + i[1] + '</span>', '<code>' + escHtml(i[2]) + '</code>', escHtml(i[3]) + (i[6] ? '<br><i>' + escHtml(i[6]) + '</i>' : ''), '<span style="white-space:nowrap">' + flagsStr(i[4]) + '</span>', escHtml(i[5])]));
        };
        busca.addEventListener('input', render);
        render();
        conteudo.append(h('p', { html: 'Flags: letra acesa = modificada; <b>0</b>/<b>1</b> = sempre zera/liga; <b>?</b> = indefinida (não confie no valor); apagada = não muda. Ciclos segundo o manual da Intel (EA = cálculo do endereço efetivo, veja a aba de ciclos).' }), busca, lista);
        setTimeout(() => busca.focus(), 50);
      } else if (id === 'int21') {
        conteudo.innerHTML = '<p>Chame com <code>MOV AH,função</code> e <code>INT 21h</code>. As funções de arquivo e de memória avisam erro com <b>CF=1</b> e o código em AX.</p>' + tabela(['AH', 'Serviço', 'Entrada', 'Saída'], INT21.map(r => r.map(escHtml))) +
          '<h3>Códigos de erro</h3>' + tabela(['AX', 'Erro'], ERROS) +
          '<h3>PSP (Program Segment Prefix)</h3><p>Os 256 bytes que o DOS põe antes de todo programa. No início de um .EXE, DS e ES apontam para ele.</p>' + tabela(['Offset', 'Bytes', 'Conteúdo'], PSP.map(r => r.map(escHtml)));
      } else if (id === 'bios') {
        conteudo.innerHTML = '<p>Serviços da BIOS também escolhem a função em AH. A explicação completa de cada serviço, com códigos de retorno, áreas de dados e programas de exemplo, está no <a href="#livro">Livro da BIOS</a> (F5).</p>' + tabela(['Interrupção', 'AH', 'Serviço', 'Registradores'], INTBIOS.map(r => r.map(escHtml))) +
          '<h3>Atributos de cor (modo texto)</h3><p>Byte de atributo = <code>piscar(1) | fundo(3) | frente(4)</code>. Ex.: 1Eh = amarelo sobre azul, 07h = cinza sobre preto, 4Fh = branco sobre vermelho.</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:2px">' + window.Tela.PAL.map((c, i) => '<span style="background:' + c + ';color:' + (i < 7 || i === 8 ? '#fff' : '#000') + ';padding:0 1ch">' + hex(i, 1) + '</span>').join('') + '</div>';
      } else if (id === 'fpu') {
        conteudo.innerHTML = '<p>O coprocessador 8087 tem uma pilha de 8 registradores de 80 bits, ST(0) (o topo, também escrito ST) até ST(7). Os reais ficam na memória em <code>DD</code> (32 bits), <code>DQ</code> (64) ou <code>DT</code> (80), escritos com ponto: <code>raio DD 2.5</code>. Os ciclos são valores típicos do manual do 8087 e variam com os operandos.</p>' +
          tabela(['Instrução', 'Formas', 'O que faz', 'Ciclos'], FPU.map(r => ['<b>' + escHtml(r[0]) + '</b>', '<code>' + escHtml(r[1]) + '</code>', escHtml(r[2]), escHtml(r[3])])) +
          '<h3>Palavra de status depois de FCOM / FTST</h3>' + tabela(['Resultado', 'C3', 'C2', 'C0', 'Depois de SAHF'], [['ST > operando', '0', '0', '0', 'JA salta'], ['ST < operando', '0', '0', '1', 'JB salta (CF=1)'], ['ST = operando', '1', '0', '0', 'JE salta (ZF=1)'], ['não comparáveis (NaN)', '1', '1', '1', 'JP salta (PF=1)']]);
      } else if (id === 'portas') {
        conteudo.innerHTML = '<h3>Portas de E/S do PC</h3><p>Use <code>IN AL,porta</code> e <code>OUT porta,AL</code>; acima de 255, ponha a porta em DX.</p>' + tabela(['Porta', 'Chip', 'Uso'], PORTAS.map(r => r.map(escHtml))) +
          '<h3>Mapa da memória</h3>' + tabela(['Endereço', 'Conteúdo'], [['0000:0000', 'Tabela de vetores de interrupção (256 × 4 bytes)'], ['0040:0000', 'Área de dados da BIOS (0040:006Ch = tiques do timer; 0040:001Eh = buffer do teclado)'], ['primeiro segmento livre', 'DOS, depois os programas, cada bloco precedido por um MCB de 16 bytes (\'M\' ou \'Z\', dono, tamanho)'], ['A000:0000', 'Vídeo gráfico VGA (modo 13h: 64.000 bytes, pixel = y × 320 + x)'], ['B800:0000', 'Vídeo em modo texto colorido (caractere e atributo)'], ['F000:0000', 'ROM da BIOS (fonte 8x8 em F000:FA6Eh)']].map(r => r.map(escHtml)));
      } else if (id === 'ciclos') {
        conteudo.innerHTML = '<h3>Tempo de cálculo do endereço efetivo (EA) no 8086</h3>' + tabela(['Forma do operando', 'Ciclos extras'], EA) +
          '<h3>Endereçamentos válidos no 8086</h3><p>Base (<code>BX</code> ou <code>BP</code>) + índice (<code>SI</code> ou <code>DI</code>) + deslocamento, cada parte opcional. Com <code>BP</code>, o segmento padrão é <code>SS</code>; nos outros casos, <code>DS</code>.</p>' +
          '<p>Inválidos: <code>[AX]</code>, <code>[CX]</code>, <code>[DX]</code>, <code>[SP]</code>, <code>[BX+BP]</code>, <code>[SI+DI]</code>, <code>[SI*2]</code>.</p>' +
          '<h3>Relógio</h3><p>O IBM PC original roda a 4,77 MHz: 1 ciclo ≈ 210 ns. Uma instrução de 100 ciclos leva cerca de 21 µs.</p>';
      } else if (id === 'ascii') {
        const g = h('div.ascii-g');
        const CP = window.Asm8086.CP437;
        for (let i = 0; i < 256; i++) g.append(h('div.c', { title: i + ' = ' + hex(i, 2) + 'h' }, h('span.g', null, i === 0 || i === 32 || i === 255 ? '·' : CP[i]), h('span.h', null, hex(i, 2))));
        conteudo.append(h('p', null, 'Conjunto de caracteres do IBM PC (página de código 437). Passe o mouse para ver o valor decimal.'), g);
      } else {
        conteudo.innerHTML = tabela(['Tecla', 'Ação'], [
          ['F1', 'Ajuda'], ['F3 / F4 / F5 / F6', 'Aulas / Laboratório / Livro da BIOS / Referência (fora do laboratório)'], ['Ctrl+F', 'Buscar no Livro da BIOS'], ['F10', 'Abre o menu'],
          ['Ctrl+→ / Ctrl+←', 'Próxima / anterior aula'],
          ['F9', 'Laboratório: executar'], ['F7', 'Passo (entra em CALL e INT do usuário)'], ['F8', 'Passo por cima (executa a CALL inteira)'],
          ['F4', 'Laboratório: executar até a linha do cursor'], ['F2', 'Liga/desliga breakpoint na linha do cursor (ou clique no número da linha)'],
          ['Ctrl+F2', 'Reiniciar o programa'], ['F5', 'Verificar exercício aberto no laboratório'], ['Alt+F5', 'Tela do usuário em tamanho grande'], ['Esc', 'Pausar a execução']
        ]);
      }
    };
    for (const [id, nome] of abas) {
      const t = h('span.tab', { onclick: () => { location.hash = '#ref/' + id; } }, nome);
      t.dataset.id = id;
      barra.append(t);
    }
    return {
      el: [barra, conteudo],
      mostrar(s) {
        if (!s) return mostrar('instr');
        const id = abas.some(a => a[0] === s) ? s : 'instr';
        mostrar(id, id === 'instr' && s !== 'instr' ? s.toUpperCase() : '');
      }
    };
  }

  window.Referencia = { criar, INSTR };
})();
