/* Tela de texto VGA 80x25 desenhada em canvas a partir da memória B800h. */
(function () {
  'use strict';
  const PAL = ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
    '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'];
  const CW = 9, CH = 16;

  // Caracteres de moldura do CP437: [cima, baixo, esquerda, direita] (1 = simples, 2 = dupla)
  const BOX = {
    0xB3: [1, 1, 0, 0], 0xB4: [1, 1, 1, 0], 0xB5: [1, 1, 2, 0], 0xB6: [2, 2, 1, 0], 0xB7: [0, 2, 1, 0], 0xB8: [0, 1, 2, 0],
    0xB9: [2, 2, 2, 0], 0xBA: [2, 2, 0, 0], 0xBB: [0, 2, 2, 0], 0xBC: [2, 0, 2, 0], 0xBD: [2, 0, 1, 0], 0xBE: [1, 0, 2, 0],
    0xBF: [0, 1, 1, 0], 0xC0: [1, 0, 0, 1], 0xC1: [1, 0, 1, 1], 0xC2: [0, 1, 1, 1], 0xC3: [1, 1, 0, 1], 0xC4: [0, 0, 1, 1],
    0xC5: [1, 1, 1, 1], 0xC6: [1, 1, 0, 2], 0xC7: [2, 2, 0, 1], 0xC8: [2, 0, 0, 2], 0xC9: [0, 2, 0, 2], 0xCA: [2, 0, 2, 2],
    0xCB: [0, 2, 2, 2], 0xCC: [2, 2, 0, 2], 0xCD: [0, 0, 2, 2], 0xCE: [2, 2, 2, 2], 0xCF: [1, 0, 2, 2], 0xD0: [2, 0, 1, 1],
    0xD1: [0, 1, 2, 2], 0xD2: [0, 2, 1, 1], 0xD3: [2, 0, 0, 1], 0xD4: [1, 0, 0, 2], 0xD5: [0, 1, 0, 2], 0xD6: [0, 2, 0, 1],
    0xD7: [2, 2, 1, 1], 0xD8: [1, 1, 2, 2], 0xD9: [1, 0, 1, 0], 0xDA: [0, 1, 0, 1]
  };

  class Tela {
    constructor(canvas) {
      this.cv = canvas;
      this.cv.width = 80 * CW; this.cv.height = 25 * CH;
      this.ctx = canvas.getContext('2d');
      this.blink = true;
      this.t = 0;
    }
    desenhar(mem, cursor, mostrarCursor, m) {
      const ctx = this.ctx;
      if (mem[0x449] === 0x13) { this.cache = null; return this.desenharVGA(mem, m ? m.dac : window.Machine8086.PALETA_PADRAO); }
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--font') || 'monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = '18px ' + fam;
      const CP = window.Asm8086.CP437;
      const piscaOn = Math.floor(performance.now() / 400) % 2 === 0;
      const pisca = (mem[0x465] & 0x20) !== 0;        // INT 10h AX=1003h: bit 7 pisca ou é fundo claro
      const oculto = (mem[0x461] & 0x20) !== 0;       // INT 10h AH=01h com CH bit 5: cursor invisível
      // só redesenha as células que mudaram (e as que piscam, quando a fase do pisca muda)
      if (!this.cache || this.cacheFam !== fam) { this.cache = new Int32Array(2000).fill(-1); this.cacheFam = fam; }
      const cache = this.cache;
      const fase = piscaOn ? 1 : 0;
      const curPos = this.ultCursor;
      for (let r = 0; r < 25; r++) {
        for (let c = 0; c < 80; c++) {
          const i = r * 80 + c;
          const a = 0xB8000 + i * 2;
          const ch = mem[a], at = mem[a + 1];
          const chave = ch | (at << 8) | (pisca && (at & 0x80) ? (fase + 1) << 16 : 0) | (pisca ? 0 : 1 << 18);
          if (cache[i] === chave && i !== curPos) continue;
          cache[i] = chave;
          const fg = PAL[at & 15], bg = PAL[pisca ? (at >> 4) & 7 : (at >> 4) & 15];
          const x = c * CW, y = r * CH;
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, CW, CH);
          if (pisca && (at & 0x80) && !piscaOn) continue;
          if (ch === 0 || ch === 32 || ch === 255) continue;
          ctx.fillStyle = fg;
          this.glifo(ch, x, y, CP);
        }
      }
      this.ultCursor = -1;
      if (mostrarCursor && cursor && piscaOn && !oculto && cursor.row < 25 && cursor.col < 80) {
        const at = mem[0xB8000 + (cursor.row * 80 + cursor.col) * 2 + 1];
        ctx.fillStyle = PAL[at & 15] || '#AAAAAA';
        ctx.fillRect(cursor.col * CW, cursor.row * CH + 13, CW, 2);
        this.ultCursor = cursor.row * 80 + cursor.col;   // no próximo quadro essa célula é refeita (apaga o cursor)
      }
    }
    invalidar() { this.cache = null; }
    // modo 13h: 320x200, um byte por pixel em A000h, cores da paleta (DAC de 6 bits por componente)
    desenharVGA(mem, dac) {
      this.cache = null;
      if (!this.off) {
        this.off = document.createElement('canvas'); this.off.width = 320; this.off.height = 200;
        this.octx = this.off.getContext('2d'); this.img = this.octx.createImageData(320, 200);
        this.pal = new Uint32Array(256);
      }
      const pal = this.pal;
      for (let i = 0; i < 256; i++) {
        const r = (dac[i * 3] & 63) * 255 / 63 | 0, g = (dac[i * 3 + 1] & 63) * 255 / 63 | 0, b = (dac[i * 3 + 2] & 63) * 255 / 63 | 0;
        pal[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
      const px = new Uint32Array(this.img.data.buffer);
      for (let i = 0; i < 64000; i++) px[i] = pal[mem[0xA0000 + i]];
      this.octx.putImageData(this.img, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.off, 0, 0, this.cv.width, this.cv.height);
    }
    glifo(ch, x, y, CP) {
      const ctx = this.ctx;
      const box = BOX[ch];
      if (box) {
        const cx = x + 4, cy = y + 8;
        const seg = (kind, x1, y1, x2, y2, vertical) => {
          if (!kind) return;
          if (kind === 1) ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), vertical ? 1 : Math.abs(x2 - x1) + 1, vertical ? Math.abs(y2 - y1) + 1 : 1);
          else {
            if (vertical) { ctx.fillRect(Math.min(x1, x2) - 2, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1); ctx.fillRect(Math.min(x1, x2) + 2, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1); }
            else { ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2) - 2, Math.abs(x2 - x1) + 1, 1); ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2) + 2, Math.abs(x2 - x1) + 1, 1); }
          }
        };
        const [u, d, l, r] = box;
        const ext = (k) => (k === 2 ? 2 : 0);
        const hv = Math.max(l, r), vv = Math.max(u, d);
        seg(u, cx, y, cx, cy + ext(hv), true);
        seg(d, cx, cy - ext(hv), cx, y + CH - 1, true);
        seg(l, x, cy, cx + ext(vv), cy, false);
        seg(r, cx - ext(vv), cy, x + CW - 1, cy, false);
        return;
      }
      switch (ch) {
        case 0xDB: ctx.fillRect(x, y, CW, CH); return;
        case 0xDC: ctx.fillRect(x, y + 8, CW, 8); return;
        case 0xDF: ctx.fillRect(x, y, CW, 8); return;
        case 0xDD: ctx.fillRect(x, y, 5, CH); return;
        case 0xDE: ctx.fillRect(x + 5, y, 4, CH); return;
        case 0xFE: ctx.fillRect(x + 2, y + 5, 5, 6); return;
        case 0xB0: case 0xB1: case 0xB2: {
          for (let yy = 0; yy < CH; yy++) for (let xx = 0; xx < CW; xx++) {
            const on = ch === 0xB0 ? ((xx + yy * 2) % 4 === 0) : ch === 0xB1 ? ((xx + yy) % 2 === 0) : ((xx + yy * 2) % 4 !== 0);
            if (on) ctx.fillRect(x + xx, y + yy, 1, 1);
          }
          return;
        }
      }
      ctx.fillText(CP[ch], x + CW / 2, y + CH / 2 + 1);
    }
  }
  window.Tela = Tela;
  window.Tela.PAL = PAL;
})();
