// Testes do montador e da CPU: node tests/core.test.js
const assert = require('assert');
const Asm = require('../app/core/asm.js');
const { runProgram } = require('../app/core/cpu.js');

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); ok++; }
  catch (e) { fail++; console.log('FALHOU: ' + name + '\n   ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n   ')); }
}
const bytesOf = (src) => {
  const p = Asm.assemble(src);
  assert.ok(p.ok, JSON.stringify(p.errors));
  return p.instrs.map(i => i.bytes.map(b => b.toString(16).padStart(2, '0')).join(' '));
};
const run = (src, opts) => {
  const r = runProgram(src, opts);
  if (!r.prog.ok) throw new Error('Erros: ' + JSON.stringify(r.prog.errors));
  return r;
};
const errOf = (src) => {
  const p = Asm.assemble(src);
  assert.ok(!p.ok, 'deveria falhar: ' + src);
  return p.errors[0].msg;
};

const HEADER = '.MODEL SMALL\n.STACK 100h\n';

t('trecho simples', () => {
  const r = run('MOV AX,5\nADD AX,3');
  assert.strictEqual(r.machine.AX, 8);
  assert.strictEqual(r.status, 'terminado');
});

t('codificação real', () => {
  assert.deepStrictEqual(bytesOf('MOV AX,5'), ['b8 05 00']);
  assert.deepStrictEqual(bytesOf('MOV AL,[BX+SI+4]'), ['8a 40 04']);
  assert.deepStrictEqual(bytesOf('ADD AX,BX'), ['03 c3']);
  assert.deepStrictEqual(bytesOf('MOV AX,BX\nXCHG CH,CL\nXOR AX,AX'), ['8b c3', '86 e9', '33 c0']);
  assert.deepStrictEqual(bytesOf('INT 21h'), ['cd 21']);
  assert.deepStrictEqual(bytesOf('MOV [BP],AX'), ['89 46 00']);
  assert.deepStrictEqual(bytesOf('ADD BX,1'), ['83 c3 01']);
  assert.deepStrictEqual(bytesOf('ADD BX,1000h'), ['81 c3 00 10']);
  assert.deepStrictEqual(bytesOf('INC CX'), ['41']);
  assert.deepStrictEqual(bytesOf('XCHG AX,BX'), ['93']);
  assert.deepStrictEqual(bytesOf('PUSH DS'), ['1e']);
  assert.deepStrictEqual(bytesOf('MOV ES:[DI],AL'), ['26 88 05']);
  assert.deepStrictEqual(bytesOf('SHL AX,1\nSHL AX,CL'), ['d1 e0', 'd3 e0']);
  assert.deepStrictEqual(bytesOf('volta: DEC CX\nJNZ volta'), ['49', '75 fd']);
  assert.deepStrictEqual(bytesOf('REP MOVSB'), ['f3 a4']);
  assert.deepStrictEqual(bytesOf('MOV WORD PTR [BX],1234h'), ['c7 07 34 12']);
  assert.deepStrictEqual(bytesOf('IMUL BX\nIDIV CL\nCBW\nCWD\nNEG AX'), ['f7 eb', 'f6 f9', '98', '99', 'f7 d8']);
});

t('erros didáticos do 8086', () => {
  assert.match(errOf('SHL AX,2'), /80186/);
  assert.match(errOf('MOV AX,[AX]'), /não é um endereçamento válido/);
  assert.match(errOf('MOV AX,[SI+DI]'), /só pode haver um índice/);
  assert.match(errOf('MOV AX,[BX+BP]'), /um registrador base/);
  assert.match(errOf('IMUL AX,BX'), /80186/);
  assert.match(errOf('PUSH 5'), /80186/);
  assert.match(errOf('PUSHA'), /80186/);
  assert.match(errOf('MOV DS,1234h'), /Não existe MOV DS,imediato/);
  assert.match(errOf('x DW 1\ny DW 2\nMOV x,y'), /memória, memória/);
  assert.match(errOf('MOV AX,BL'), /tamanhos diferentes/);
  assert.match(errOf('MOV [BX],5'), /Tamanho ambíguo/);
  assert.match(errOf('MOV EAX,1'), /32 bits/);
  assert.match(errOf('MOV AX,[SI*2]'), /80386/);
  assert.match(errOf('MOVZX AX,BL'), /80386/);
  assert.match(errOf('MOV AL,300'), /não cabe em 8 bits/);
  assert.match(errOf('x DW 5\nMOV AL,x'), /Tamanhos diferentes/);
});

t('salto condicional longe demais', () => {
  let src = 'inicio:\n';
  for (let i = 0; i < 60; i++) src += 'MOV AX,1234h\n';
  src += 'JZ inicio\n';
  assert.match(errOf(src), /longe demais/);
  // JMP vira near automaticamente
  const p = Asm.assemble(src.replace('JZ inicio', 'JMP inicio'));
  assert.ok(p.ok);
  assert.strictEqual(p.instrs[p.instrs.length - 1].bytes[0], 0xE9);
});

t('hello world .EXE', () => {
  const r = run(HEADER + `.DATA
msg DB 'Ola, mundo!',13,10,'$'
.CODE
inicio:
  MOV AX,@DATA
  MOV DS,AX
  MOV AH,09h
  LEA DX,msg
  INT 21h
  MOV AX,4C00h
  INT 21h
END inicio`);
  assert.strictEqual(r.status, 'terminado');
  assert.strictEqual(r.machine.outputText(), 'Ola, mundo!');
  assert.strictEqual(r.machine.exitCode, 0);
  assert.ok(r.machine.screenText().startsWith('Ola, mundo!'));
});

t('DS não inicializado gera aviso', () => {
  const r = run(HEADER + `.DATA
x DW 1234h
.CODE
main PROC
  MOV AX,x
  MOV AH,4Ch
  INT 21h
main ENDP
END main`);
  assert.ok(r.machine.events.some(e => /DS ainda aponta/.test(e.msg)));
  assert.notStrictEqual(r.machine.AX & 0xFF, 0x34);
});

t('analisador de vetor (aula 18)', () => {
  const r = run(HEADER + `.DATA
vetor DW 10,25,8,42,15
N EQU 5
soma DW ?
maior DW ?
pares DW ?
.CODE
main PROC
  MOV AX,@DATA
  MOV DS,AX
  CALL SOMAR_VETOR
  MOV soma,AX
  CALL ENCONTRAR_MAIOR
  MOV maior,AX
  CALL CONTAR_PARES
  MOV pares,AX
  MOV AX,soma
  CALL IMPRIMIR_NUMERO
  MOV AX,4C00h
  INT 21h
main ENDP
SOMAR_VETOR PROC
  PUSH CX
  PUSH SI
  XOR AX,AX
  LEA SI,vetor
  MOV CX,N
@@laco:
  ADD AX,[SI]
  ADD SI,2
  LOOP @@laco
  POP SI
  POP CX
  RET
SOMAR_VETOR ENDP
ENCONTRAR_MAIOR PROC
  PUSH CX
  PUSH SI
  LEA SI,vetor
  MOV AX,[SI]
  MOV CX,N-1
@@laco:
  ADD SI,2
  CMP [SI],AX
  JBE @@nao
  MOV AX,[SI]
@@nao:
  LOOP @@laco
  POP SI
  POP CX
  RET
ENCONTRAR_MAIOR ENDP
CONTAR_PARES PROC
  PUSH BX
  PUSH CX
  PUSH SI
  XOR AX,AX
  LEA SI,vetor
  MOV CX,N
@@laco:
  MOV BX,[SI]
  TEST BX,1
  JNZ @@impar
  INC AX
@@impar:
  ADD SI,2
  LOOP @@laco
  POP SI
  POP CX
  POP BX
  RET
CONTAR_PARES ENDP
IMPRIMIR_NUMERO PROC
  PUSH AX
  PUSH BX
  PUSH CX
  PUSH DX
  MOV BX,10
  XOR CX,CX
@@div:
  XOR DX,DX
  DIV BX
  PUSH DX
  INC CX
  TEST AX,AX
  JNZ @@div
@@imp:
  POP DX
  ADD DL,'0'
  MOV AH,02h
  INT 21h
  LOOP @@imp
  POP DX
  POP CX
  POP BX
  POP AX
  RET
IMPRIMIR_NUMERO ENDP
END main`);
  const m = r.machine;
  assert.strictEqual(r.status, 'terminado');
  assert.strictEqual(m.readSymbol('soma'), 100);
  assert.strictEqual(m.readSymbol('maior'), 42);
  assert.strictEqual(m.readSymbol('pares'), 3);
  assert.strictEqual(m.outputText(), '100');
  assert.strictEqual(m.SP, r.prog.stack.sp);
});

t('flags de soma e subtração', () => {
  let m = run('MOV AL,7Fh\nADD AL,1').machine;
  assert.deepStrictEqual([m.AL, m.getReg('OF'), m.getReg('SF'), m.getReg('ZF'), m.getReg('CF'), m.getReg('AF')], [0x80, 1, 1, 0, 0, 1]);
  m = run('MOV AL,0FFh\nADD AL,1').machine;
  assert.deepStrictEqual([m.AL, m.getReg('OF'), m.getReg('ZF'), m.getReg('CF'), m.getReg('PF')], [0, 0, 1, 1, 1]);
  m = run('MOV AX,3\nCMP AX,5').machine;
  assert.deepStrictEqual([m.AX, m.getReg('CF'), m.getReg('SF'), m.getReg('ZF')], [3, 1, 1, 0]);
  m = run('MOV AX,8000h\nNEG AX').machine;
  assert.deepStrictEqual([m.AX, m.getReg('OF'), m.getReg('CF')], [0x8000, 1, 1]);
  m = run('STC\nMOV AL,0FFh\nINC AL').machine;
  assert.deepStrictEqual([m.AL, m.getReg('CF'), m.getReg('ZF')], [0, 1, 1]);
});

t('aritmética com sinal', () => {
  let m = run('MOV AL,-5\nCBW\nMOV BX,AX\nMOV AX,-7\nIMUL BX').machine;
  assert.deepStrictEqual([m.BX, m.AX, m.DX], [0xFFFB, 35, 0]);
  m = run('MOV AX,-7\nCWD\nMOV BX,2\nIDIV BX').machine;
  assert.deepStrictEqual([m.AX, m.DX], [0xFFFD, 0xFFFF]); // -3 resto -1
  m = run('MOV AX,300\nMOV BX,-200\nIMUL BX').machine;
  assert.strictEqual((m.DX * 65536 + m.AX) | 0, -60000);
  assert.strictEqual(m.getReg('OF'), 1);
  const r = run('MOV AX,8000h\nCWD\nMOV BX,-1\nIDIV BX');
  assert.strictEqual(r.status, 'erro');
  assert.match(r.machine.outputText(), /Divide overflow/);
});

t('divisão por zero', () => {
  const r = run('MOV AX,10\nXOR BL,BL\nDIV BL');
  assert.strictEqual(r.status, 'erro');
  assert.ok(r.machine.events.some(e => /por zero/.test(e.msg)));
});

t('entrada com INT 21h/0Ah', () => {
  const r = run(HEADER + `.DATA
buf DB 6,0,6 DUP(?)
.CODE
ini: MOV AX,@DATA
  MOV DS,AX
  MOV AH,0Ah
  LEA DX,buf
  INT 21h
  MOV AH,4Ch
  INT 21h
END ini`, { input: '1x\b23\r' });
  const m = r.machine;
  assert.strictEqual(r.status, 'terminado');
  const base = r.prog.symbols.BUF.seg * 16 + r.prog.symbols.BUF.off;
  assert.deepStrictEqual(Array.from(m.mem.slice(base, base + 6)), [6, 3, 0x31, 0x32, 0x33, 13]);
});

t('entrada espera teclado', () => {
  const r = run('MOV AH,1\nINT 21h');
  assert.strictEqual(r.status, 'aguardando');
  r.machine.pushKey(65, 0x1E);
  assert.strictEqual(r.machine.run(100), 'terminado');
  assert.strictEqual(r.machine.AL, 65);
});

t('REP MOVSB e STOSW', () => {
  const r = run(HEADER + `.DATA
orig DB 'ABCDE'
dest DB 5 DUP(0)
.CODE
ini: MOV AX,@DATA
  MOV DS,AX
  MOV ES,AX
  CLD
  LEA SI,orig
  LEA DI,dest
  MOV CX,5
  REP MOVSB
  MOV AH,4Ch
  INT 21h
END ini`);
  const s = r.prog.symbols.DEST;
  const base = s.seg * 16 + s.off;
  assert.strictEqual(String.fromCharCode(...r.machine.mem.slice(base, base + 5)), 'ABCDE');
  assert.strictEqual(r.machine.CX, 0);
});

t('recursão (fatorial)', () => {
  const r = run(HEADER + `.CODE
main PROC
  MOV AX,5
  PUSH AX
  CALL FAT
  MOV AH,4Ch
  INT 21h
main ENDP
FAT PROC
  PUSH BP
  MOV BP,SP
  MOV AX,[BP+4]
  CMP AX,1
  JBE @@fim
  DEC AX
  PUSH AX
  CALL FAT
  MUL WORD PTR [BP+4]
@@fim:
  POP BP
  RET 2
FAT ENDP
END main`);
  assert.strictEqual(r.machine.AL, 120);
});

t('LOOP com CX=0 avisa', () => {
  const r = run('XOR CX,CX\nvolta: INC AX\nLOOP volta');
  assert.strictEqual(r.machine.AX, 0); // 65536 voltas
  assert.ok(r.machine.events.some(e => /65.536/.test(e.msg)));
});

t('ciclos e tamanho', () => {
  const r = run('MOV AX,5\nADD AX,BX\nINC AX');
  assert.strictEqual(r.machine.cycles, 4 + 3 + 2);
  const p = Asm.assemble('MOV AX,[BX+SI+10]');
  assert.strictEqual(p.instrs[0].cycles.base, 8 + 11);
});

t('vetor de interrupção do usuário', () => {
  const r = run(HEADER + `.CODE
ini: MOV AX,CS
  MOV DS,AX
  MOV AX,2560h
  MOV DX,OFFSET minha
  INT 21h
  INT 60h
  MOV AH,4Ch
  INT 21h
minha PROC FAR
  MOV BX,1234h
  IRET
minha ENDP
END ini`);
  assert.strictEqual(r.machine.BX, 0x1234);
  assert.strictEqual(r.status, 'terminado');
});

t('timer com INT 1Ch', () => {
  const r = run(HEADER + `.DATA
cont DW 0
.CODE
ini: MOV AX,@DATA
  MOV DS,AX
  PUSH DS
  MOV AX,CS
  MOV DS,AX
  MOV DX,OFFSET tique
  MOV AX,251Ch
  INT 21h
  POP DS
espera: CMP cont,3
  JB espera
  MOV AH,4Ch
  INT 21h
tique PROC FAR
  PUSH DS
  PUSH AX
  MOV AX,@DATA
  MOV DS,AX
  INC cont
  POP AX
  POP DS
  IRET
tique ENDP
END ini`, { timer: true });
  assert.strictEqual(r.status, 'terminado');
  assert.strictEqual(r.machine.readSymbol('cont'), 3);
});

t('saída de vídeo direta em B800h', () => {
  const r = run(`MOV AX,0B800h
MOV ES,AX
MOV DI,0
MOV AL,'X'
MOV AH,1Eh
MOV ES:[DI],AX`);
  assert.strictEqual(r.machine.mem[0xB8000], 88);
  assert.strictEqual(r.machine.mem[0xB8001], 0x1E);
});

t('programa .COM com RET', () => {
  const r = run(`.MODEL TINY
.CODE
ORG 100h
ini: MOV AH,9
  MOV DX,OFFSET msg
  INT 21h
  RET
msg DB 'COM!$'
END ini`);
  assert.strictEqual(r.machine.outputText(), 'COM!');
  assert.strictEqual(r.status, 'terminado');
});

t('EQU de texto e LENGTH', () => {
  const r = run(HEADER + `.DATA
tab DW 1,2,3,4
TAM EQU ($-tab)/2
.CODE
ini: MOV AX,@DATA
 MOV DS,AX
 MOV CX,TAM
 MOV BX,LENGTH tab
 MOV AH,4Ch
 INT 21h
END ini`);
  assert.strictEqual(r.machine.CX, 4);
  assert.strictEqual(r.machine.BX, 4);
  const r2 = run('PARAM EQU [BP+4]\nMOV BP,SP\nSUB SP,4\nMOV WORD PTR PARAM,7\nMOV AX,PARAM');
  assert.strictEqual(r2.machine.AX, 7);
});

t('8087: codificação igual à do MASM', () => {
  const b = bytesOf('x DD 2.5\ny DQ 1.0\nFINIT\nFLD x\nFADD ST,ST(1)\nFSUB ST(2),ST\nFSUBP ST(1),ST\nFADD\nFILD WORD PTR [BX]\nFSTP y\nFNSTSW WORD PTR [SI]\nFXCH');
  assert.deepStrictEqual(b, ['9b db e3', '9b d9 06 00 01', '9b d8 c1', '9b dc ea', '9b de e9', '9b de c1', '9b df 07', '9b dd 1e 04 01', 'dd 3c', '9b d9 c9']);
  assert.ok(/80287/.test(errOf('FSTSW AX')));
  assert.ok(/80387/.test(errOf('FSIN')));
});
t('8087: área do círculo e comparação', () => {
  const r = run(HEADER + '.DATA\nraio DD 2.0\nn DW ?\nsw DW ?\n.CODE\nini: MOV AX,@DATA\nMOV DS,AX\nFINIT\nFLD raio\nFMUL ST,ST\nFLDPI\nFMUL\nFIST n\nFLD1\nFCOMPP\nFSTSW sw\nMOV AX,sw\nSAHF\nMOV AX,4C00h\nINT 21h\nEND ini');
  assert.strictEqual(r.machine.readSymbol('n'), 13);
  assert.strictEqual(r.machine.fpuPilha()[0], null);   // FCOMPP desempilhou os dois
  assert.strictEqual(r.machine.getReg('CF'), 1);   // 1 < 4π
});
t('modo 13h, paleta e pixels', () => {
  const r = run('MOV AX,13h\nINT 10h\nMOV AX,0A000h\nMOV ES,AX\nMOV DI,320*10+5\nMOV AL,9\nSTOSB\nMOV DX,3C8h\nMOV AL,9\nOUT DX,AL\nINC DX\nMOV AL,63\nOUT DX,AL\nOUT DX,AL\nMOV AL,0\nOUT DX,AL\nMOV AH,0Dh\nMOV CX,5\nMOV DX,10\nINT 10h');
  const m = r.machine;
  assert.strictEqual(m.videoMode, 0x13);
  assert.strictEqual(m.pixel(5, 10), 9);
  assert.strictEqual(m.AL, 9);
  assert.deepStrictEqual(Array.from(m.dac.slice(27, 30)), [63, 63, 0]);
});
t('arquivos: criar, gravar, ler, procurar', () => {
  const r = run(HEADER + ".DATA\nn1 DB 'NOVO.TXT',0\nn2 DB 'DADOS.TXT',0\nmasc DB '*.TXT',0\nt DB 'abc'\nbuf DB 10 DUP(0)\nlidos DW ?\n.CODE\nini: MOV AX,@DATA\nMOV DS,AX\nMOV AH,3Ch\nXOR CX,CX\nLEA DX,n1\nINT 21h\nMOV BX,AX\nMOV AH,40h\nMOV CX,3\nLEA DX,t\nINT 21h\nMOV AH,3Eh\nINT 21h\nMOV AX,3D00h\nLEA DX,n2\nINT 21h\nMOV BX,AX\nMOV AH,3Fh\nMOV CX,10\nLEA DX,buf\nINT 21h\nMOV lidos,AX\nMOV AH,4Eh\nXOR CX,CX\nLEA DX,masc\nINT 21h\nMOV AX,4C00h\nINT 21h\nEND ini", { arquivos: { 'DADOS.TXT': 'oi\r\n' } });
  const m = r.machine;
  assert.deepStrictEqual(m.disco.get('NOVO.TXT').dados, [97, 98, 99]);
  assert.strictEqual(m.readSymbol('lidos'), 4);
  assert.strictEqual(m.lerNome(m.prog.pspSeg, 0x80 + 0x1E), 'DADOS.TXT');
});
t('memória: 48h falha até o 4Ah encolher o programa', () => {
  const r = run(HEADER + '.DATA\ne1 DW ?\ns1 DW ?\n.CODE\nini: MOV AX,@DATA\nMOV DS,AX\nMOV AH,48h\nMOV BX,10h\nINT 21h\nMOV e1,AX\nMOV AH,4Ah\nMOV BX,100h\nINT 21h\nMOV AH,48h\nMOV BX,10h\nINT 21h\nMOV s1,AX\nMOV AX,4C00h\nINT 21h\nEND ini');
  const m = r.machine;
  assert.strictEqual(m.readSymbol('e1'), 8);
  assert.strictEqual(m.readSymbol('s1'), 0x0801);
  assert.strictEqual(m.mem[0x0800 * 16], 0x4D);   // 'M' antes do bloco novo
});
t('TSR: gancho na INT 1Ch continua rodando', () => {
  const r = run("ORG 100h\nini: JMP inst\nant DD ?\nconta DW 0\nnovo PROC FAR\nINC CS:conta\nJMP CS:ant\nnovo ENDP\ninst: MOV AX,351Ch\nINT 21h\nMOV WORD PTR ant,BX\nMOV WORD PTR ant+2,ES\nMOV AX,251Ch\nMOV DX,OFFSET novo\nINT 21h\nMOV DX,(OFFSET inst + 15) / 16\nMOV AX,3100h\nINT 21h", { residente: { passos: 30000 } });
  assert.strictEqual(r.status, 'residente');
  assert.strictEqual(r.machine.readSymbol('conta'), 10);
});
t('INT 9: teclas chegam pela IRQ 1 com aperto e soltura', () => {
  const r = run(HEADER + ".DATA\nant DD ?\nscans DB 8 DUP(0)\n.CODE\nn9 PROC FAR\nPUSH AX\nPUSH BX\nPUSH DS\nMOV AX,@DATA\nMOV DS,AX\nIN AL,60h\nMOV BX,WORD PTR scans+7\nAND BX,7\nMOV scans[BX],AL\nINC BYTE PTR scans+7\nPUSHF\nCALL ant\nPOP DS\nPOP BX\nPOP AX\nIRET\nn9 ENDP\nini: MOV AX,@DATA\nMOV DS,AX\nMOV AX,3509h\nINT 21h\nMOV WORD PTR ant,BX\nMOV WORD PTR ant+2,ES\nPUSH DS\nPUSH CS\nPOP DS\nMOV DX,OFFSET n9\nMOV AX,2509h\nINT 21h\nPOP DS\nMOV AH,0\nINT 16h\nMOV AH,0\nINT 16h\nMOV AX,4C00h\nINT 21h\nEND ini", { input: 'a{F1}' });
  const m = r.machine, base = m.prog.symbols.SCANS.seg * 16 + m.prog.symbols.SCANS.off;
  assert.deepStrictEqual(Array.from(m.mem.slice(base, base + 3)), [0x1E, 0x9E, 0x3B]);
});

// ---------------- decodificador, boot e disquete ----------------
const M = require('../app/core/cpu.js');
const Decod = require('../app/core/decod.js');
t('decodificador: os bytes do montador voltam à mesma instrução', () => {
  const src = 'MOV AX,1234h\nMOV [BX+SI+4],AL\nADD WORD PTR [DI],5\nJMP SHORT $+2\nCALL FAR PTR x\nx: LES SI,[BP-2]\nREP MOVSW\nIN AL,DX\nINT 21h\nSHL AX,CL\nXCHG AX,BX\nRET 4';
  const p = Asm.assemble(src);
  assert.ok(p.ok, JSON.stringify(p.errors));
  for (const ins of p.instrs) {
    const d = Decod.decodificar((i) => ins.bytes[i], ins.off);
    assert.ok(!d.invalida, ins.text + ': ' + d.invalida);
    assert.strictEqual(d.size, ins.bytes.length, ins.text);
    assert.strictEqual(d.mn, ins.mn, ins.text);
  }
  assert.ok(Decod.decodificar((i) => [0x0F, 0x00][i], 0).invalida);   // POP CS não existe no 8086 "oficial"
});
t('código escrito em tempo de execução é decodificado da memória', () => {
  // grava "MOV AX, 4321h / RET" num buffer e chama
  const r = run(".MODEL TINY\n.CODE\nORG 100h\nini: MOV BYTE PTR buf, 0B8h\nMOV WORD PTR buf+1, 4321h\nMOV BYTE PTR buf+3, 0C3h\nMOV BX, OFFSET buf\nCALL BX\nMOV AX, 4C00h\nOR AX, AX\nMOV BX, AX\nMOV AX, 4C00h\nINT 21h\nbuf DB 4 DUP (90h)\nEND ini");
  assert.strictEqual(r.status, 'terminado');
});
const BOOT = 'BOOT SEGMENT\nORG 7C00h\nini: XOR AX,AX\nMOV DS,AX\nMOV ES,AX\nMOV AX,1000h\nMOV ES,AX\nXOR BX,BX\nMOV AX,0201h\nMOV CX,0002h\nXOR DH,DH\nINT 13h\nJC erro\nPUSH ES\nXOR AX,AX\nPUSH AX\nRETF\nerro: CLI\nHLT\nORG 7DFEh\nDW 0AA55h\nBOOT ENDS\n';
t('modo de boot: setor 0 em 7C00h, INT 13h lê o setor 1 e o código roda', () => {
  const src = BOOT + 'K SEGMENT\nORG 0\nkini: MOV AX,CS\nMOV DS,AX\nMOV valor,1234h\nCLI\nHLT\nvalor DW 0\nK ENDS\nEND ini';
  const p = Asm.assemble(src);
  assert.ok(M.ehDisquete(p));
  const r = run(src, { maxSteps: 20000 });
  assert.strictEqual(r.status, 'terminado');
  assert.strictEqual(r.machine.readSymbol('valor'), 0x1234);   // a variável foi para 1000:xxxx
  assert.strictEqual(r.machine.modo, 'boot');
});
t('modo de boot: INT 21h não existe sem DOS', () => {
  const r = M.runProgram(BOOT + 'K SEGMENT\nORG 0\nkini: MOV AH,9\nINT 21h\nK ENDS\nEND ini', { maxSteps: 20000 });
  assert.strictEqual(r.status, 'erro');
  assert.ok(/DOS/.test(r.machine.haltReason));
});
t('INT 13h: setor 19 não existe numa trilha de 18', () => {
  const src = BOOT.replace('MOV CX,0002h', 'MOV CX,0013h') + 'END ini';
  const r = run(src, { maxSteps: 20000 });
  assert.strictEqual(r.status, 'terminado');      // caiu no CLI/HLT do erro
  assert.notStrictEqual(r.machine.mem[0x441], 0); // status do disquete em 40:41
});
t('MINIFS: vários arquivos, diretório no setor 1', () => {
  const src = ';### ARQUIVO BOOT.BIN\n' + BOOT.replace('MOV CX,0002h', 'MOV CX,0003h') + 'END ini\n' +
    ';### ARQUIVO K.SYS\nK SEGMENT\nORG 0\nkini: MOV AX,CS\nMOV DS,AX\nMOV AX,dado\nCLI\nHLT\ndado DW 0BEEFh\nK ENDS\nEND kini\n' +
    ';### ARQUIVO OUTRO.COM\n.MODEL TINY\n.CODE\nORG 100h\no: RET\nEND o\n';
  const p = M.montarPrograma(src);
  assert.ok(p.ok, JSON.stringify(p.errors));
  const d = p.disquete.dados;
  assert.strictEqual(String.fromCharCode(...d.slice(512, 523)), 'K       SYS');
  assert.strictEqual(d[512 + 12], 2);                        // K.SYS começa no setor 2
  assert.strictEqual(String.fromCharCode(...d.slice(544, 555)), 'OUTRO   COM');
  assert.ok(p.symbols['K:DADO'] && p.symbols.DADO);
  const r = M.runProgram(src, { maxSteps: 20000 });
  assert.strictEqual(r.status, 'terminado');
  assert.strictEqual(r.machine.AX, 0xBEEF);
  assert.strictEqual(r.machine.curLine, 32);                  // a linha do HLT no fonte inteiro (K.SYS)
});

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
