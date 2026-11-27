// Distortion lens: bulge / pinch / widen the area around each face.
import type { Face } from '../types';
import { clamp } from './util';

export function warpPixels(g: CanvasRenderingContext2D, w: number, h: number, activeFaces: Face[], mode: string): void {
  const a = g.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(a.data);
  const p = a.data;
  let faces = activeFaces;
  if (!faces.length) faces = [{ x: 0.5, y: 0.48, w: 0.42, h: 0.48 }];
  const regions = faces.map((f) => ({
    cx: f.x * w,
    cy: f.y * h,
    rx: Math.max(18, f.w * w * 0.95),
    ry: Math.max(18, f.h * h * 0.86),
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx = x, sy = y;
      for (const f of regions) {
        const dx = (x - f.cx) / f.rx, dy = (y - f.cy) / f.ry;
        const rad = Math.hypot(dx, dy);
        if (rad >= 1) continue;
        const envelope = (1 - rad * rad) ** 2;
        const fx = 1 - (mode === 'pinch' ? -0.65 : mode === 'wide' ? 0.65 : 0.56) * envelope;
        const fy = 1 - (mode === 'pinch' ? -0.65 : mode === 'wide' ? -0.15 : 0.56) * envelope;
        sx = f.cx + (x - f.cx) * fx;
        sy = f.cy + (y - f.cy) * fy;
        break;
      }
      const xx = clamp(Math.round(sx), 0, w - 1), yy = clamp(Math.round(sy), 0, h - 1);
      const i = (y * w + x) * 4, j = (yy * w + xx) * 4;
      p[i] = src[j]!; p[i + 1] = src[j + 1]!; p[i + 2] = src[j + 2]!;
    }
  }
  g.putImageData(a, 0, 0);
}
