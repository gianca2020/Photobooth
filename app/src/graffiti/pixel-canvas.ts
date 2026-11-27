// Pen, eraser, stamp and undo on a 256x192 pixel canvas. Shared by the live viewfinder layer and
// (Phase 4) the post-capture editor; the maths is Draft 27's, only the history cap differs per user.
import { clamp } from '../camera/lenses/util';
import { STAMPS, type StampName } from './stamps';

export const LAYER_W = 256;
export const LAYER_H = 192;

export interface Brush {
  color: string;
  /** Pen size in layer pixels. The eraser is three times this. */
  size: number;
}

export class PixelCanvas {
  readonly ctx: CanvasRenderingContext2D;
  private history: ImageData[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly maxHistory: number,
  ) {
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Layer pixel under a pointer event, clamped to the canvas. */
  point(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: clamp(Math.floor(((e.clientX - r.left) * LAYER_W) / r.width), 0, LAYER_W - 1),
      y: clamp(Math.floor(((e.clientY - r.top) * LAYER_H) / r.height), 0, LAYER_H - 1),
    };
  }

  /** Remember the current pixels so undo() can come back to them. Oldest snapshots fall off the end. */
  snapshot(): void {
    this.history.push(this.ctx.getImageData(0, 0, LAYER_W, LAYER_H));
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (previous) this.ctx.putImageData(previous, 0, 0);
    return !!previous;
  }

  /** Wipe the pixels. History is untouched, so call snapshot() first if the wipe should be undoable. */
  clear(): void {
    this.ctx.clearRect(0, 0, LAYER_W, LAYER_H);
  }

  /** Forget undo history and wipe the pixels. */
  reset(): void {
    this.history = [];
    this.clear();
  }

  /** Square dots from a to b, one per step of the longer axis (pen), or three-times-bigger holes (eraser). */
  line(a: { x: number; y: number }, b: { x: number; y: number }, tool: 'pen' | 'eraser', brush: Brush): void {
    const erasing = tool === 'eraser';
    const k = erasing ? brush.size * 3 : brush.size;
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    this.ctx.fillStyle = brush.color;
    for (let j = 0; j <= n; j++) {
      const x = Math.round(a.x + ((b.x - a.x) * j) / n) - Math.floor(k / 2);
      const y = Math.round(a.y + ((b.y - a.y) * j) / n) - Math.floor(k / 2);
      if (erasing) this.ctx.clearRect(x, y, k, k);
      else this.ctx.fillRect(x, y, k, k);
    }
  }

  /** Stamp a bitmap centred on (x, y). Each bitmap pixel becomes a square of at least 2 layer pixels. */
  stamp(name: StampName, x: number, y: number, brush: Brush): void {
    const rows = STAMPS[name];
    const k = Math.max(2, brush.size);
    this.ctx.fillStyle = brush.color;
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') this.ctx.fillRect(x - Math.floor((row.length * k) / 2) + c * k, y - Math.floor((rows.length * k) / 2) + r * k, k, k);
      }
    });
  }
}
