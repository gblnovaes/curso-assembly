#!/usr/bin/env node
/*
 * Compila as aulas em Markdown (pasta conteudo/) para app/conteudo.js.
 * Uso: node tools/build-conteudo.js
 *
 * Formato de cada aula: veja conteudo/LEIA-ME.md
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'conteudo');
const OUT = path.join(ROOT, 'app', 'conteudo.js');
const LIVRO = path.join(ROOT, 'livro-bios');
const OUT_LIVRO = path.join(ROOT, 'app', 'livro.js');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    let href = u;
    if (u.startsWith('aula:')) href = '#aula/' + u.slice(5);
    else if (u.startsWith('ref:')) href = '#ref/' + u.slice(4);
    else if (u.startsWith('livro:')) href = '#livro/' + u.slice(6);
    else if (u === 'lab') href = '#lab';
    const ext = /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '';
    return '<a href="' + href + '"' + ext + '>' + t + '</a>';
  });
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[+i]) + '</code>');
  return s;
}

function mdToHtml(text) {
  const lines = text.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if (/^```/.test(l)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      html += '<pre class="asm asm-hl">' + esc(code.join('\n')) + '</pre>';
      continue;
    }
    if ((m = /^(#{2,4})\s+(.*)$/.exec(l))) {
      const lvl = m[1].length;
      const id = slug(m[2]);
      html += `<h${lvl} id="${id}">${inline(m[2])}</h${lvl}>`;
      i++; continue;
    }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      html += '<div class="tabela"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      html += '<ul>';
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        html += '<li>' + inline(item) + '</li>';
      }
      html += '</ul>';
      continue;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      const ini = +/\d+/.exec(l)[0];
      html += ini === 1 ? '<ol>' : '<ol start="' + ini + '">';
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\.\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        html += '<li>' + inline(item) + '</li>';
      }
      html += '</ol>';
      continue;
    }
    if (/^>\s?/.test(l)) {
      // linhas "> " vazias separam parágrafos dentro da citação
      const ps = [''];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        const t = lines[i++].replace(/^>\s?/, '');
        if (t.trim()) ps[ps.length - 1] += t.trim() + ' '; else if (ps[ps.length - 1]) ps.push('');
      }
      const qs = ps.map(q => q.trim()).filter(Boolean);
      html += '<blockquote>' + (qs.length > 1 ? qs.map(q => '<p>' + inline(q) + '</p>').join('') : inline(qs[0] || '')) + '</blockquote>';
      continue;
    }
    let p = '';
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\||\s*[-*]\s+|\s*\d+\.\s+|>|```)/.test(lines[i])) p += lines[i++].trim() + ' ';
    html += '<p>' + inline(p.trim()) + '</p>';
  }
  return html;
}

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseQuiz(text, file) {
  const qs = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const l = raw.trimEnd();
    if (!l.trim()) continue;
    const m = /^([?+\->])\s?(.*)$/.exec(l.trim());
    if (!m) { if (cur && cur._last) cur._last.push(l.trim()); continue; }
    if (m[1] === '?') { cur = { q: m[2], ops: [], exp: '' }; cur._last = null; qs.push(cur); continue; }
    if (!cur) throw new Error(file + ': quiz sem pergunta');
    if (m[1] === '>') cur.exp += (cur.exp ? ' ' : '') + m[2];
    else cur.ops.push({ t: m[2], ok: m[1] === '+' });
  }
  for (const q of qs) {
    delete q._last;
    if (!q.ops.some(o => o.ok)) throw new Error(file + ': pergunta sem resposta certa: ' + q.q);
    q.q = inline(q.q); q.exp = inline(q.exp);
    q.ops.forEach(o => { o.t = inline(o.t); });
  }
  return qs;
}

function parseExercise(text, file) {
  const ex = { id: '', titulo: '', nivel: 1 };
  const parts = text.split(/^---\s*(\w+)\s*$/m);
  const head = parts[0];
  for (const l of head.split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(l.trim());
    if (!m) continue;
    const k = m[1], v = m[2];
    if (['proibir', 'exigir'].includes(k)) ex[k] = v.split(/[ ,]+/).filter(Boolean).map(s => s.toUpperCase());
    else if (['nivel', 'maxBytes', 'maxCiclos', 'maxPassos'].includes(k)) ex[k] = +v;
    else if (k === 'timer') ex.timer = v === 'sim' || v === 'true';
    else ex[k] = v;
  }
  for (let i = 1; i < parts.length; i += 2) {
    const k = parts[i], v = parts[i + 1].replace(/^\n/, '').replace(/\s+$/, '');
    if (k === 'enunciado') ex.enunciado = mdToHtml(v);
    else if (k === 'inicial') ex.inicial = v;
    else if (k === 'solucao') ex.solucao = v;
    else if (k === 'dicas') ex.dicas = v.split('\n').filter(x => x.trim()).map(x => inline(x.replace(/^\s*[-*]\s+/, '')));
    else if (k === 'testes') {
      try { ex.testes = JSON.parse(v); }
      catch (e) { throw new Error(file + ': JSON inválido nos testes do exercício "' + ex.titulo + '": ' + e.message); }
    } else throw new Error(file + ': seção desconhecida no exercício: ' + k);
  }
  if (!ex.id) throw new Error(file + ': exercício sem id');
  if (!ex.testes) throw new Error(file + ': exercício ' + ex.id + ' sem testes');
  return ex;
}

function parseLesson(file, texto) {
  const raw = (texto !== undefined ? texto : fs.readFileSync(file, 'utf8')).replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  if (!fm) throw new Error(file + ': falta o cabeçalho --- ... ---');
  const meta = {};
  for (const l of fm[1].split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(l);
    if (m) meta[m[1]] = m[2].trim();
  }
  const body = raw.slice(fm[0].length);
  const blocks = [];
  const lines = body.split('\n');
  let buf = [];
  const flush = () => { const t = buf.join('\n'); if (t.trim()) blocks.push({ t: 'html', html: mdToHtml(t) }); buf = []; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = /^```(\w+)\s*(.*)$/.exec(l))) {
      flush();
      const kind = m[1], info = m[2];
      const content = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) content.push(lines[i++]);
      const text = content.join('\n');
      const attrs = {};
      info.replace(/(\w+)(?:="([^"]*)")?/g, (_, k, v) => { attrs[k] = v === undefined ? true : v; });
      if (kind === 'asm') blocks.push({ t: 'asm', code: text, run: !!attrs.executar, titulo: attrs.titulo || '', soLeitura: !!attrs.fragmento, parametros: attrs.parametros || '', entrada: attrs.entrada || '', jogo: !!attrs.jogo, boot: !!attrs.boot });
      else if (kind === 'quiz') blocks.push({ t: 'quiz', qs: parseQuiz(text, file) });
      else if (kind === 'exercicio') blocks.push({ t: 'ex', ex: parseExercise(text, file) });
      else if (kind === 'widget') blocks.push({ t: 'widget', nome: info.split(/\s+/)[0], params: text.trim() ? JSON.parse(text) : {} });
      else if (kind === 'diagrama' || kind === 'texto') blocks.push({ t: 'diagrama', text, titulo: attrs.titulo || '' });
      else throw new Error(file + ': bloco desconhecido ```' + kind);
      continue;
    }
    if ((m = /^:::(\w+)\s*(.*)$/.exec(l))) {
      flush();
      const content = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) content.push(lines[i++]);
      blocks.push({ t: 'nota', tipo: m[1], titulo: inline(m[2] || ''), html: mdToHtml(content.join('\n')) });
      continue;
    }
    buf.push(l);
  }
  flush();
  const objetivos = (meta.objetivos || '').split(';').map(s => s.trim()).filter(Boolean).map(inline);
  return {
    id: meta.id, numero: +meta.numero, modulo: +meta.modulo, titulo: meta.titulo, subtitulo: meta.subtitulo || '',
    duracao: meta.duracao || '', objetivos, blocks,
    secoes: blocks.filter(b => b.t === 'html').flatMap(b => [...b.html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(m => ({ id: m[1], titulo: m[2].replace(/<[^>]+>/g, '') })))
  };
}

// ---------------- livro da BIOS (livro-bios/*.md -> app/livro.js) ----------------
const ROMANOS = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const semTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function frontMatter(raw) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const meta = {};
  if (fm) for (const l of fm[1].split('\n')) { const m = /^(\w+):\s*(.*)$/.exec(l); if (m) meta[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1'); }
  return meta;
}

// Texto pesquisável, uma entrada por seção (h2/h3/h4) do capítulo
function indiceBusca(cap) {
  const secs = [{ id: '', titulo: cap.titulo, texto: '' }];
  const add = (t) => { secs[secs.length - 1].texto += ' ' + t; };
  for (const b of cap.blocks) {
    if (b.t === 'html') {
      const partes = b.html.split(/(<h[234] id="[^"]+">.*?<\/h[234]>)/);
      for (const p of partes) {
        const m = /^<h[234] id="([^"]+)">(.*?)<\/h[234]>$/.exec(p);
        if (m) secs.push({ id: m[1], titulo: semTags(m[2]), texto: '' }); else add(semTags(p));
      }
    } else if (b.t === 'asm') add((b.titulo || '') + ' ' + b.code);
    else if (b.t === 'diagrama') add((b.titulo || '') + ' ' + b.text);
    else if (b.t === 'nota') add(semTags(b.titulo + ' ' + b.html));
  }
  return secs.map(x => ({ id: x.id, titulo: x.titulo, texto: x.texto.replace(/\s+/g, ' ').trim() })).filter(x => x.texto || x.id);
}

function buildLivro(aulas) {
  if (!fs.existsSync(LIVRO)) return null;
  const arquivos = fs.readdirSync(LIVRO).filter(f => f.endsWith('.md'));
  const ordem = (f) => f === 'README.md' ? 0 : f.startsWith('cap') ? 1 : 2;
  arquivos.sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b));
  const crus = {};
  const idDe = {};
  for (const f of arquivos) {
    crus[f] = fs.readFileSync(path.join(LIVRO, f), 'utf8').replace(/\r\n/g, '\n');
    idDe[f] = f === 'README.md' ? 'sumario' : frontMatter(crus[f]).id;
    if (!idDe[f]) throw new Error('livro-bios/' + f + ': falta id no cabeçalho');
  }
  const aulaDe = {};
  for (const f of fs.readdirSync(SRC).filter(f => /^aula\d+.*\.md$/.test(f))) aulaDe[f] = frontMatter(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n')).id;
  const idsAula = new Set(aulas.map(a => a.id));

  // partes, a partir do sumário do README ("### Parte II · Tela e teclado")
  const partes = [];
  for (const m of crus['README.md'].matchAll(/^### Parte ([IVX]+) · (.*)$/gm)) {
    const fut = /\(em preparação\)/.test(m[2]);
    partes.push({ id: ROMANOS[m[1]], romano: m[1], titulo: m[2].replace(/\s*\(em preparação\)/, '').trim(), futuro: fut });
  }
  partes.push({ id: 'apendices', romano: '', titulo: 'Apêndices' });

  const caps = [];
  for (const f of arquivos) {
    let raw = crus[f];
    const arq = 'livro-bios/' + f;
    if (f === 'README.md') {
      const t = /^# (.*)$/m.exec(raw);
      raw = '---\nid: sumario\nnumero: 0\nparte: 0\ntitulo: ' + (t ? t[1] : 'Livro da BIOS') + '\n---\n' + raw;
    }
    const meta = frontMatter(raw);
    // o título vem do cabeçalho; o "# Capítulo n · ..." do texto sairia repetido
    raw = raw.replace(/^(---\n[\s\S]*?\n---\n)\s*# .*\n/, '$1');
    // blocos ``` sem linguagem (diagramas) e ```basic viram blocos de texto
    let dentro = false;
    raw = raw.split('\n').map(l => {
      const m = /^```(\w*)(.*)$/.exec(l);
      if (!m) return l;
      if (dentro) { dentro = false; return l; }
      dentro = true;
      if (!m[1]) return '```texto' + m[2];
      if (m[1] === 'basic') return '```texto titulo="BASIC"';
      return l;
    }).join('\n');
    // links entre arquivos viram links internos do aplicativo
    raw = raw.replace(/\]\(([^)\s]+?\.md)(#[^)]*)?\)/g, (all, alvo, ancora) => {
      const nome = path.basename(alvo);
      if (/^\.\.\/conteudo\//.test(alvo)) {
        if (!aulaDe[nome]) throw new Error(arq + ': link para aula inexistente: ' + alvo);
        return '](aula:' + aulaDe[nome] + ')';
      }
      if (!idDe[nome]) throw new Error(arq + ': link para arquivo inexistente do livro: ' + alvo);
      return '](livro:' + idDe[nome] + (ancora ? '/' + ancora.slice(1) : '') + ')';
    });
    const c = parseLesson(arq, raw);
    // ids de títulos únicos dentro do capítulo
    const vistos = {};
    for (const b of c.blocks) if (b.html) b.html = b.html.replace(/<(h[234]) id="([^"]+)">/g, (_, tg, id) => {
      vistos[id] = (vistos[id] || 0) + 1;
      return '<' + tg + ' id="' + (vistos[id] > 1 ? id + '-' + vistos[id] : id) + '">';
    });
    const relacionadas = (meta.aulas || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
    for (const a of relacionadas) if (!idsAula.has(a)) throw new Error(arq + ': aula relacionada inexistente: ' + a);
    const cap = {
      id: c.id, numero: c.numero, parte: /^\d+$/.test(meta.parte) ? +meta.parte : meta.parte, titulo: meta.titulo,
      aulas: relacionadas, blocks: c.blocks
    };
    cap.secoes = c.blocks.filter(b => b.t === 'html').flatMap(b => [...b.html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(m => ({ id: m[1], titulo: semTags(m[2]) })));
    cap.busca = indiceBusca(cap);
    caps.push(cap);
  }
  // âncoras dos links internos precisam existir
  for (const cap of caps) for (const b of cap.blocks) if (b.html) for (const m of b.html.matchAll(/href="#livro\/([^"\/]+)\/([^"]+)"/g)) {
    const alvo = caps.find(x => x.id === m[1]);
    if (!alvo.blocks.some(x => x.html && x.html.includes('id="' + m[2] + '"'))) throw new Error('livro: âncora inexistente ' + m[1] + '#' + m[2] + ' (em ' + cap.id + ')');
  }
  return { partes, capitulos: caps };
}

function main() {
  const modulos = JSON.parse(fs.readFileSync(path.join(SRC, 'modulos.json'), 'utf8'));
  const files = fs.readdirSync(SRC).filter(f => /^aula\d+.*\.md$/.test(f)).sort();
  const aulas = [];
  const ids = new Set();
  const exIds = new Set();
  for (const f of files) {
    const a = parseLesson(path.join(SRC, f));
    if (!a.id) throw new Error(f + ': falta id');
    if (ids.has(a.id)) throw new Error('id repetido: ' + a.id);
    ids.add(a.id);
    for (const b of a.blocks) if (b.t === 'ex') {
      if (exIds.has(b.ex.id)) throw new Error('exercício repetido: ' + b.ex.id);
      exIds.add(b.ex.id);
    }
    aulas.push(a);
  }
  aulas.sort((x, y) => x.numero - y.numero);
  const out = '/* Gerado por tools/build-conteudo.js a partir de conteudo/*.md. Não edite à mão. */\n' +
    'window.CURSO_CONTEUDO = ' + JSON.stringify({ modulos, aulas, geradoEm: new Date().toISOString().slice(0, 10) }) + ';\n';
  fs.writeFileSync(OUT, out);
  const nEx = aulas.reduce((s, a) => s + a.blocks.filter(b => b.t === 'ex').length, 0);
  const nQ = aulas.reduce((s, a) => s + a.blocks.filter(b => b.t === 'quiz').reduce((k, b) => k + b.qs.length, 0), 0);
  console.log(`${aulas.length} aulas, ${nEx} exercícios, ${nQ} perguntas -> ${path.relative(ROOT, OUT)} (${(out.length / 1024).toFixed(0)} KB)`);
  const livro = buildLivro(aulas);
  if (livro) {
    const outL = '/* Gerado por tools/build-conteudo.js a partir de livro-bios/*.md. Não edite à mão. */\n' +
      'window.CURSO_LIVRO = ' + JSON.stringify(livro) + ';\n';
    fs.writeFileSync(OUT_LIVRO, outL);
    console.log(`livro da BIOS: ${livro.capitulos.length} capítulos e apêndices -> ${path.relative(ROOT, OUT_LIVRO)} (${(outL.length / 1024).toFixed(0)} KB)`);
  }
}

if (require.main === module) main();
module.exports = { parseLesson, mdToHtml, buildLivro };
