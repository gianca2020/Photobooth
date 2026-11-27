// PixelCanvas must paint exactly what Draft 27's live graffiti code paints. The original liveDraw and
// stamp loop are cut out of reference/draft27.html and run next to ours on a fake 256x192 canvas.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAYER_H, LAYER_W, PixelCanvas } from '../../app/src/graffiti/pixel-canvas';
import { STAMPS } from '../../app/src/graffiti/stamps';

/** Just enough 2D context: remembers the fill colour of every pixel (null = transparent). */
class FakeCtx {
  fillStyle = '#000';
  px: (string | null)[] = new Array(LAYER_W * LAYER_H).fill(null);
  private paint(x: number, y: number, w: number, h: number, v: string | null) {
    for (let j = Math.max(0, y); j < Math.min(LAYER_H, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(LAYER_W, x + w); i++) this.px[j * LAYER_W + i] = v;
  }
  fillRect(x: number, y: number, w: number, h: number) { this.paint(x, y, w, h, this.fillStyle); }
  clearRect(x: number, y: number, w: number, h: number) { this.paint(x, y, w, h, null); }
  getImageData() { return { data: [...this.px] }; }
  putImageData(img: { data: (string | null)[] }) { this.px = [...img.data]; }
}
function fake() {
  const ctx = new FakeCtx();
  const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ left: 10, top: 20, width: 512, height: 384 }) } as unknown as HTMLCanvasElement;
  return { ctx, canvas };
}
const count = (ctx: FakeCtx) => ctx.px.filter(Boolean).length;

const html = readFileSync(new URL('../../reference/draft27.html', import.meta.url), 'utf8');
const drawSrc = html.match(/function liveDraw\(a,b\)\{[^\n]*\}/)?.[0];
if (!drawSrc) throw new Error('liveDraw not found in reference');

/** Draft 27's own pen/eraser and stamp code driven against a FakeCtx. */
function draft27(ctx: FakeCtx, tool: string, color: string, size: number) {
  // liveTool / liveColor / liveCtx / $ are free variables in Draft 27; pass them in as parameters.
  const make = new Function('liveCtx', '$', 'liveTool', 'liveColor', `${drawSrc}; return liveDraw;`);
  const liveDraw = make(ctx, () => ({ value: String(size) }), tool, color);
  return {
    line: (a: { x: number; y: number }, b: { x: number; y: number }) => liveDraw(a, b),
    stamp(x: number, y: number) {
      const rows: readonly string[] = (STAMPS as Record<string, readonly string[]>)[tool]!;
      const k = Math.max(2, size);
      ctx.fillStyle = color;
      // verbatim from the pointerdown handler in Draft 27
      rows.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') ctx.fillRect(x - Math.floor(row.length * k / 2) + xx * k, y - Math.floor(rows.length * k / 2) + yy * k, k, k); }));
    },
  };
}

describe('PixelCanvas matches Draft 27', () => {
  const strokes = [
    [{ x: 10, y: 10 }, { x: 10, y: 10 }],
    [{ x: 5, y: 7 }, { x: 200, y: 150 }],
    [{ x: 250, y: 3 }, { x: 40, y: 3 }],
    [{ x: 0, y: 191 }, { x: 255, y: 0 }],
  ] as const;

  for (const size of [2, 4, 6]) {
    for (const tool of ['pen', 'eraser'] as const) {
      it(`${tool} lines at size ${size}`, () => {
        const a = fake(), b = fake();
        // start from a filled layer so the eraser has something to erase
        a.ctx.fillStyle = b.ctx.fillStyle = '#123456';
        a.ctx.fillRect(0, 0, LAYER_W, LAYER_H);
        b.ctx.fillRect(0, 0, LAYER_W, LAYER_H);
        const ours = new PixelCanvas(a.canvas, 25);
        const ref = draft27(b.ctx, tool, '#f66b00', size);
        for (const [p, q] of strokes) {
          ours.line(p, q, tool, { color: '#f66b00', size });
          ref.line(p, q);
        }
        expect(a.ctx.px).toEqual(b.ctx.px);
        expect(count(a.ctx)).toBeGreaterThan(0);
      });
    }
  }

  for (const name of Object.keys(STAMPS)) {
    for (const size of [2, 4, 6]) {
      it(`${name} stamp at size ${size}`, () => {
        const a = fake(), b = fake();
        new PixelCanvas(a.canvas, 25).stamp(name as keyof typeof STAMPS, 128, 96, { color: '#ffffff', size });
        draft27(b.ctx, name, '#ffffff', size).stamp(128, 96);
        expect(a.ctx.px).toEqual(b.ctx.px);
        expect(count(a.ctx)).toBeGreaterThan(0);
      });
    }
  }
});

describe('PixelCanvas behaviour', () => {
  it('stamp size 1 still draws 2x2 cells (Draft 27 minimum)', () => {
    const { ctx, canvas } = fake();
    new PixelCanvas(canvas, 25).stamp('heart', 100, 100, { color: '#000', size: 1 });
    const cells = STAMPS.heart.join('').split('1').length - 1;
    expect(count(ctx)).toBe(cells * 4);
  });

  it('the eraser hole is three times the pen size', () => {
    const { ctx, canvas } = fake();
    const pc = new PixelCanvas(canvas, 25);
    ctx.fillRect(0, 0, LAYER_W, LAYER_H);
    pc.line({ x: 100, y: 100 }, { x: 100, y: 100 }, 'eraser', { color: '#000', size: 4 });
    expect(LAYER_W * LAYER_H - count(ctx)).toBe(12 * 12);
  });

  it('undo restores each snapshot in reverse order and reports when empty', () => {
    const { ctx, canvas } = fake();
    const pc = new PixelCanvas(canvas, 25);
    const brush = { color: '#000', size: 2 };
    pc.snapshot(); pc.stamp('heart', 50, 50, brush);
    const one = [...ctx.px];
    pc.snapshot(); pc.stamp('star', 150, 100, brush);
    expect(pc.undo()).toBe(true);
    expect(ctx.px).toEqual(one);
    expect(pc.undo()).toBe(true);
    expect(count(ctx)).toBe(0);
    expect(pc.canUndo).toBe(false);
    expect(pc.undo()).toBe(false);
  });

  it('keeps at most maxHistory snapshots, dropping the oldest', () => {
    const { ctx, canvas } = fake();
    const pc = new PixelCanvas(canvas, 25);
    for (let i = 0; i < 30; i++) { pc.snapshot(); ctx.fillRect(i, 0, 1, 1); }
    let undone = 0;
    while (pc.undo()) undone++;
    expect(undone).toBe(25);
    expect(ctx.px[4]).toBe('#000'); // pixels 0..4 were drawn before the oldest kept snapshot
    expect(ctx.px[5]).toBeNull();
  });

  it('reset clears pixels and history; clear keeps history', () => {
    const { ctx, canvas } = fake();
    const pc = new PixelCanvas(canvas, 25);
    pc.snapshot(); ctx.fillRect(0, 0, 5, 5);
    pc.clear();
    expect(count(ctx)).toBe(0);
    expect(pc.canUndo).toBe(true);
    ctx.fillRect(0, 0, 5, 5);
    pc.reset();
    expect(count(ctx)).toBe(0);
    expect(pc.canUndo).toBe(false);
  });

  it('point maps client coordinates onto the 256x192 grid and clamps to the edges', () => {
    const { canvas } = fake(); // 512x384 box at (10, 20): 2 CSS px per layer pixel
    const pc = new PixelCanvas(canvas, 25);
    expect(pc.point({ clientX: 10, clientY: 20 })).toEqual({ x: 0, y: 0 });
    expect(pc.point({ clientX: 10 + 301, clientY: 20 + 101 })).toEqual({ x: 150, y: 50 });
    expect(pc.point({ clientX: -50, clientY: 9999 })).toEqual({ x: 0, y: 191 });
    expect(pc.point({ clientX: 9999, clientY: -5 })).toEqual({ x: 255, y: 0 });
  });
});
