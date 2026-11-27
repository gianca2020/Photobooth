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

/** Where each accessory sits relative to the (grid-snapped) face centre, in grid steps. */
export interface Anchors {
  mustache: { dx: number; yy: number };
  glasses: { dx: number; yy: number };
  ears: { dx: number; yy: number };
}

// Placement on detected faces (the shapes themselves are Draft 27's, unchanged).
const GLASSES_LENS_CENTRE = 3.5; // grid steps from the top bar to the middle of the lenses
const MUSTACHE_NOTCH = 0.35; // the mustache's middle notch, as a fraction of the way from nose to mouth
const EARS_BASE = 0.6; // ear bases, in face-box heights above the eye line (about the top of the head)
const EARS_BASE_STEPS = 4; // the ear polygons run from yy - 10 down to yy + 4

/**
 * Draft 27 measured everything from the box centre (mustache +0.17, glasses -0.16, ears -0.47 box
 * heights), which puts the glasses on the nose and the mustache on the mouth of a real face. With eye,
 * nose and mouth positions (`f.marks`) each accessory goes where it belongs instead: lenses centred on the
 * eyes, mustache under the nose, ears on top of the head. `cx, cy, step` are the snapped centre and grid
 * step in canvas pixels; faces without marks (the demo art) keep Draft 27's offsets exactly.
 */
export function anchors(f: Face, w: number, h: number, cx: number, cy: number, step: number, fh: number): Anchors {
  const hh = fh / step;
  const m = f.marks;
  if (!m) {
    return {
      mustache: { dx: 0, yy: Math.round(hh * 0.17) },
      glasses: { dx: 0, yy: -Math.round(hh * 0.16) },
      ears: { dx: 0, yy: -Math.round(hh * 0.47) },
    };
  }
  const dx = (x: number) => Math.round((x * w - cx) / step);
  const dy = (y: number) => (y * h - cy) / step;
  return {
    mustache: { dx: dx(m.mouthX), yy: Math.round(dy(m.noseY + (m.mouthY - m.noseY) * MUSTACHE_NOTCH)) },
    glasses: { dx: dx(m.eyeX), yy: Math.round(dy(m.eyeY) - GLASSES_LENS_CENTRE) },
    ears: { dx: dx(m.eyeX), yy: Math.round(dy(m.eyeY - EARS_BASE * (fh / h)) - EARS_BASE_STEPS) },
  };
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
    const a = anchors(f, w, h, x, y, step, fh);
    if (mode === 'mustache' || mode === 'all') {
      const { dx, yy } = a.mustache;
      if (dx) {
        g.save();
        g.translate(dx, 0);
      }
      polygon(g, [[0, yy], [3, yy - 2], [6, yy - 2], [9, yy], [12, yy - 1], [10, yy + 3], [6, yy + 4], [3, yy + 3], [0, yy + 1], [-3, yy + 3], [-6, yy + 4], [-10, yy + 3], [-12, yy - 1], [-9, yy], [-6, yy - 2], [-3, yy - 2]], ink, 'white');
      if (dx) g.restore();
    }
    if (mode === 'glasses' || mode === 'all') {
      const { dx, yy } = a.glasses;
      if (dx) {
        g.save();
        g.translate(dx, 0);
      }
      g.fillStyle = ink;
      g.fillRect(-13, yy, 26, 2);
      g.fillRect(-12, yy, 10, 7);
      g.fillRect(2, yy, 10, 7);
      g.fillStyle = 'white';
      g.fillRect(-10, yy + 1, 2, 3);
      g.fillRect(4, yy + 1, 2, 3);
      g.fillStyle = orange;
      g.fillRect(-2, yy, 4, 1);
      if (dx) g.restore();
    }
    if (mode === 'ears' || mode === 'all') {
      const { dx, yy } = a.ears;
      if (dx) {
        g.save();
        g.translate(dx, 0);
      }
      polygon(g, [[-13, yy + 4], [-14, yy - 8], [-11, yy - 10], [-4, yy - 1], [-3, yy + 4]], ink, 'white');
      polygon(g, [[13, yy + 4], [14, yy - 8], [11, yy - 10], [4, yy - 1], [3, yy + 4]], ink, 'white');
      polygon(g, [[-12, yy - 6], [-7, yy], [-11, yy + 1]], orange);
      polygon(g, [[12, yy - 6], [7, yy], [11, yy + 1]], orange);
      if (dx) g.restore();
    }
    g.restore();
  }
}
