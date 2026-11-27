// Mischief lens: pixel mustache, glasses and cat ears drawn on each face.
import type { Face } from '../types';
import { clamp } from './util';

function polygon(g: CanvasRenderingContext2D, points: [number, number][], fill: string, stroke?: string): void {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.stroke();
  }
}

export function drawAccessories(g: CanvasRenderingContext2D, w: number, h: number, faces: Face[], mode: string): void {
  for (const f of faces) {
    const fw = clamp(f.w * w, 30, w * 0.75), fh = clamp(f.h * h, 35, h * 0.85);
    const step = Math.max(2, Math.round(fw / 26));
    const x = Math.round((f.x * w) / step) * step, y = Math.round((f.y * h) / step) * step;
    g.save();
    g.translate(x, y);
    g.scale(step, step);
    g.imageSmoothingEnabled = false;
    const ink = '#171717', orange = '#f66b00';
    const hh = fh / step;
    if (mode === 'mustache' || mode === 'all') {
      const yy = Math.round(hh * 0.17);
      polygon(g, [[0, yy], [3, yy - 2], [6, yy - 2], [9, yy], [12, yy - 1], [10, yy + 3], [6, yy + 4], [3, yy + 3], [0, yy + 1], [-3, yy + 3], [-6, yy + 4], [-10, yy + 3], [-12, yy - 1], [-9, yy], [-6, yy - 2], [-3, yy - 2]], ink, 'white');
    }
    if (mode === 'glasses' || mode === 'all') {
      const yy = -Math.round(hh * 0.16);
      g.fillStyle = ink;
      g.fillRect(-13, yy, 26, 2);
      g.fillRect(-12, yy, 10, 7);
      g.fillRect(2, yy, 10, 7);
      g.fillStyle = 'white';
      g.fillRect(-10, yy + 1, 2, 3);
      g.fillRect(4, yy + 1, 2, 3);
      g.fillStyle = orange;
      g.fillRect(-2, yy, 4, 1);
    }
    if (mode === 'ears' || mode === 'all') {
      const yy = -Math.round(hh * 0.47);
      polygon(g, [[-13, yy + 4], [-14, yy - 8], [-11, yy - 10], [-4, yy - 1], [-3, yy + 4]], ink, 'white');
      polygon(g, [[13, yy + 4], [14, yy - 8], [11, yy - 10], [4, yy - 1], [3, yy + 4]], ink, 'white');
      polygon(g, [[-12, yy - 6], [-7, yy], [-11, yy + 1]], orange);
      polygon(g, [[12, yy - 6], [7, yy], [11, yy + 1]], orange);
    }
    g.restore();
  }
}
