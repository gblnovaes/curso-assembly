// Cenários de sistema da máquina 386 contra o Bochs e o QEMU (só para quem desenvolve;
// precisa de nasm, bochs e qemu-system-i386). Cada tests/cenarios386/NOME.asm roda nos três;
// a saída da porta E9h do simulador precisa ser igual à do Bochs, que confere limites e tipos
// de segmento como o processador de verdade. O QEMU não confere limites de segmento nos acessos
// à memória, então uma diferença só com ele é mostrada como aviso.
// Uso: node tools/cenarios386.js [nome...]          compara
//      node tools/cenarios386.js --gravar [nome...]  compara e grava NOME.esperado (usado pelo npm test)
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, spawn } = require('child_process');
const N = require('../app/core/nasm.js');
const M = require('../app/core/cpu386.js');
const { fonte } = require('../tests/cenarios386/comum.js');

const DIR = path.join(__dirname, '..', 'tests', 'cenarios386');
const args = process.argv.slice(2);
const gravar = args.includes('--gravar');
let nomes = args.filter(a => !a.startsWith('--'));
if (!nomes.length) nomes = fs.readdirSync(DIR).filter(f => f.endsWith('.asm')).map(f => f.replace(/\.asm$/, '')).sort();
const FIM = '~~';

function imagem(arquivos) {
  const img = Buffer.alloc(16 * 63 * 512 * 2);
  let p = 0;
  for (const b of arquivos) { Buffer.from(b).copy(img, p); p += Math.ceil(b.length / 512) * 512; }
  return img;
}

function simular(src) {
  const r = N.montarDisco(src);
  if (!r.ok) return { erro: r.erros.slice(0, 5).map(e => (e.arquivo || '') + ':' + e.linha + ' ' + e.msg).join(' | ') };
  const img = imagem(r.arquivos.map(a => a.bytes));
  const m = new M.Maquina({ memoria: 16 * 1024 * 1024 });
  m.carregar(img.subarray(0, 512), { modo: 'boot', disco: img });
  m.executar(20000000);
  return { r, m, saida: m.saida };
}

function qemu(fImg, tmp) {
  const fOut = path.join(tmp, 'qemu.bin');
  try { execFileSync('qemu-system-i386', ['-drive', 'file=' + fImg + ',format=raw', '-debugcon', 'file:' + fOut, '-display', 'none', '-no-reboot', '-device', 'isa-debug-exit,iobase=0xf4,iosize=0x04', '-m', '16'], { timeout: 20000, stdio: 'pipe' }); } catch (e) { /* isa-debug-exit sai com código != 0 */ }
  return fs.existsSync(fOut) ? fs.readFileSync(fOut, 'latin1') : '';
}

// Bochs com o depurador embutido: "c" continua; a saída da E9 vai para o stdout depois do prompt
function bochs(fImg, tmp) {
  const rc = path.join(tmp, 'bochsrc');
  fs.writeFileSync(rc, [
    'megs: 16', 'romimage: file=/usr/share/seabios/bios.bin', 'vgaromimage: file=/usr/share/seabios/vgabios-isavga.bin',
    'display_library: rfb, options="timeout=0"', 'ata0-master: type=disk, path=' + fImg + ', mode=flat, cylinders=2, heads=16, spt=63',
    'boot: disk', 'port_e9_hack: enabled=1', 'log: ' + path.join(tmp, 'bochs.log'), 'cpu: model=bx_generic, ips=50000000', 'clock: sync=none', 'speaker: enabled=0', 'sound: driver=dummy'
  ].join('\n') + '\n');
  return new Promise((res) => {
    // pelo shell: com o stdin vindo de um pipe comum o depurador do Bochs roda na velocidade normal
    const p = spawn('sh', ['-c', '(echo c; sleep 60) | exec stdbuf -o0 bochs -q -f "$0"', rc], { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
    let out = '';
    const tirar = () => { const i = out.indexOf('<bochs:1> c\n'); return i < 0 ? '' : out.slice(i + 12); };
    const fim = () => { clearTimeout(t); try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { /* já saiu */ } };
    const t = setTimeout(fim, 30000);
    p.stdout.on('data', d => { out += d.toString('latin1'); if (tirar().includes(FIM)) fim(); });
    p.on('close', () => { let s = tirar(); const k = s.indexOf(FIM); if (k >= 0) s = s.slice(0, k + FIM.length); res(s); });
  });
}

function mostrarDif(nome, quem, ref, s) {
  let k = 0; while (ref[k] === s.saida[k] && k < ref.length) k++;
  console.log(nome + ': DIFERENTE do ' + quem + ' a partir do caractere ' + k + ' (simulador: ' + s.m.status + ' ' + (s.m.motivo || '') + ')');
  console.log('  ' + quem.padEnd(10) + JSON.stringify(ref.slice(Math.max(0, k - 80), k + 120)));
  console.log('  simulador ' + JSON.stringify(s.saida.slice(Math.max(0, k - 80), k + 120)));
}

(async () => {
  let falhas = 0;
  for (const nome of nomes) {
    const src = fonte(fs.readFileSync(path.join(DIR, nome + '.asm'), 'utf8'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cen386-'));
    const partes = src.split(/^;### ARQUIVO .*$/m).slice(1);
    let bins;
    try {
      bins = partes.map((p, i) => { const f = path.join(tmp, 'p' + i + '.asm'); fs.writeFileSync(f, p); execFileSync('nasm', ['-f', 'bin', f, '-o', f + '.bin'], { stdio: 'pipe' }); return fs.readFileSync(f + '.bin'); });
    } catch (e) { console.log(nome + ': o NASM recusou: ' + e.stderr); falhas++; continue; }
    const s = simular(src);
    if (s.erro) { console.log(nome + ': o montador do curso recusou: ' + s.erro); falhas++; continue; }
    s.r.arquivos.forEach((a, i) => { if (!Buffer.from(a.bytes).equals(bins[i])) { console.log(nome + ': montador difere do NASM no arquivo ' + a.nome); falhas++; } });
    const fImg = path.join(tmp, 'disco.img'); fs.writeFileSync(fImg, imagem(bins));
    const b = await bochs(fImg, tmp);
    const q = qemu(fImg, tmp);
    if (process.env.DEPURAR) console.log(tmp); else fs.rmSync(tmp, { recursive: true, force: true });
    if (b !== s.saida) { falhas++; mostrarDif(nome, 'bochs', b, s); continue; }
    console.log(nome + ': igual ao Bochs (' + b.length + ' caracteres)' + (q === b ? ' e ao QEMU' : ''));
    if (q !== b) mostrarDif(nome + ' (aviso)', 'qemu', q, s);
    if (gravar) fs.writeFileSync(path.join(DIR, nome + '.esperado'), b, 'latin1');
  }
  process.exit(falhas ? 1 : 0);
})();
