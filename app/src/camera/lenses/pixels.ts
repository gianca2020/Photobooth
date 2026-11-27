// Per-pixel looks: classic B&W, Flipnote two-tone dither, orange-pass, 2009 digicam. Math is Draft 27's.
// (Mischief, Distortion and Emoter also end here, as plain grayscale, after their geometry is applied.)
import type { LensId } from '../../app/state';
import { clamp } from './util';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const WARM = [6, 2, -4];

export function processPixels(g: CanvasRenderingContext2D, w: number, h: number, mode: LensId): void {
  const a = g.getImageData(0, 0, w, h);
  const p = a.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = p[i]!, gr = p[i + 1]!, b = p[i + 2]!;
      const l = r * 0.2126 + gr * 0.7152 + b * 0.0722;
      let z = l;
      if (mode === '2009') {
        const noise = (((x * 73 + y * 137 + x * y * 19) % 31) - 15) * 0.52;
        const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2);
        const vignette = 1 - 0.1 * (nx * nx + ny * ny);
        const tone = Math.pow(l / 255, 0.93) * 255;
        for (let k = 0; k < 3; k++) {
          const c = k === 0 ? r : k === 1 ? gr : b;
          p[i + k] = Math.round(clamp((tone + (c - l) * 0.73) * 0.94 * vignette + 8 + WARM[k]! + noise, 0, 255) / 4) * 4;
        }
        continue;
      }
      if (mode === 'flipnote') {
        const threshold = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
        z = r * 0.299 + gr * 0.587 + b * 0.114 > threshold * 256 ? 255 : 23;
      }
      if (mode === 'orange') {
        const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
        const sat = max ? (max - min) / max : 0;
        const hue = ((gr - b) / Math.max(1, max - min)) * 60;
        if (r === max && hue >= 12 && hue <= 52 && sat > 0.52 && max - min > 40) {
          p[i] = r; p[i + 1] = gr; p[i + 2] = b;
          continue;
        }
      }
      p[i] = p[i + 1] = p[i + 2] = Math.round(z);
    }
  }
  g.putImageData(a, 0, 0);
}
