// Emoter lens: pushes pixels around the mouth and brows to fake a happy, sad or angry face.
import type { Face } from '../types';
import { clamp } from './util';

export function emotePixels(g: CanvasRenderingContext2D, w: number, h: number, faces: Face[], mode: string): void {
  if (!faces.length) return;
  const a = g.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(a.data);
  const p = a.data;
  for (const f of faces) {
    const cx = f.x * w, cy = f.y * h;
    const fw = Math.max(24, f.w * w), fh = Math.max(30, f.h * h);
    const x0 = Math.max(0, Math.floor(cx - fw * 0.66)), x1 = Math.min(w - 1, Math.ceil(cx + fw * 0.66));
    const y0 = Math.max(0, Math.floor(cy - fh * 0.58)), y1 = Math.min(h - 1, Math.ceil(cy + fh * 0.64));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = (x - cx) / fw, v = (y - cy) / fh, abs = Math.abs(u);
        const mask = Math.max(0, 1 - (u / 0.64) ** 2);
        const mouth = Math.exp(-(((v - 0.28) / 0.17) ** 2)) * mask;
        const brow = Math.exp(-(((v + 0.24) / 0.13) ** 2)) * mask;
        const corner = Math.min(1, (abs / 0.27) ** 1.5);
        let dy = 0, dx = 0;
        if (mode === 'happy') {
          dy = fh * 0.15 * corner * mouth;
          dx = -fw * 0.12 * u * mouth;
          dy -= fh * 0.035 * brow;
        } else if (mode === 'sad') {
          dy = -fh * 0.14 * corner * mouth;
          dy += fh * 0.085 * (1 - corner) * brow;
        } else {
          dy = -fh * 0.07 * corner * mouth;
          dy -= fh * 0.15 * (1 - corner) * brow;
          dx = fw * 0.08 * u * mouth;
        }
        const sx = clamp(Math.round(x + dx), 0, w - 1), sy = clamp(Math.round(y + dy), 0, h - 1);
        const i = (y * w + x) * 4, j = (sy * w + sx) * 4;
        p[i] = src[j]!; p[i + 1] = src[j + 1]!; p[i + 2] = src[j + 2]!;
      }
    }
  }
  g.putImageData(a, 0, 0);
}
