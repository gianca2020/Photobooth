// Accessory placement on detected faces (issue #6). The numbers below are what the face model returned
// on a real face (box + eye/nose/mouth points, in pixels of the screenshot it ran on).
import { beforeEach, describe, expect, it } from 'vitest';
import { nativeMarks, toFace, toMarks } from '../../app/src/camera/detector';
import * as faces from '../../app/src/camera/faces';
import { anchors } from '../../app/src/camera/lenses/accessories';
import type { Face } from '../../app/src/camera/types';

const W = 640, H = 480;
// Real detection (1370x1456 screenshot): box 249x249 at (496, 605); right eye, left eye, nose tip, mouth centre.
const real = (() => {
  const px = (x: number, y: number) => ({ x: x / 1370, y: y / 1456 });
  const marks = toMarks([px(591.5, 696.9), px(676.5, 688.0)], px(650.1, 752.9), px(647.3, 790.5))!;
  return toFace(496, 605, 249, 249, 1370, 1456, marks)!;
})();

/** Same snapping drawAccessories does. */
function layout(f: Face) {
  const fh = Math.min(Math.max(f.h * H, 35), H * 0.85), fw = Math.min(Math.max(f.w * W, 30), W * 0.75);
  const step = Math.max(2, Math.round(fw / 26));
  const cx = Math.round((f.x * W) / step) * step, cy = Math.round((f.y * H) / step) * step;
  return { step, cx, cy, a: anchors(f, W, H, cx, cy, step, fh), fh };
}

describe('anchors without marks (demo art, old behaviour)', () => {
  it('keep Draft 27 offsets: mustache +0.17, glasses -0.16, ears -0.47 box heights', () => {
    const f: Face = { x: 0.5, y: 0.57, w: 0.25, h: 0.34 };
    const { a, fh, step } = layout(f);
    const hh = fh / step;
    expect(a.mustache).toEqual({ dx: 0, yy: Math.round(hh * 0.17) });
    expect(a.glasses).toEqual({ dx: 0, yy: -Math.round(hh * 0.16) });
    expect(a.ears).toEqual({ dx: 0, yy: -Math.round(hh * 0.47) });
  });
});

describe('anchors with eye / nose / mouth marks', () => {
  const { step, cx, cy, a, fh } = layout(real);
  const m = real.marks!;
  const px = (steps: number) => steps * step;

  it('puts the middle of the glasses lenses on the eyes (within one grid step)', () => {
    const lensCentreY = cy + px(a.glasses.yy + 3.5);
    expect(Math.abs(lensCentreY - m.eyeY * H)).toBeLessThanOrEqual(step);
    expect(Math.abs(cx + px(a.glasses.dx) - m.eyeX * W)).toBeLessThanOrEqual(step);
  });

  it('puts the mustache between the nose and the mouth', () => {
    const notchY = cy + px(a.mustache.yy);
    const nose = m.noseY * H, mouth = m.mouthY * H;
    expect(notchY).toBeGreaterThan(nose);
    expect(notchY).toBeLessThan(nose + 0.5 * (mouth - nose) + step / 2); // the upper half of the gap: the lips stay visible
  });

  it('puts the ear bases above the eyes, about at the top of the head, and the tips above that', () => {
    const baseY = cy + px(a.ears.yy + 4);
    expect(m.eyeY * H - baseY).toBeGreaterThan(0.5 * fh);
    expect(m.eyeY * H - baseY).toBeLessThan(0.7 * fh);
  });

  it('is no longer a fixed offset from the box centre: it follows the eyes when the box and eyes disagree', () => {
    const lowEyes: Face = { ...real, marks: { ...m, eyeY: m.eyeY + 0.1 } };
    expect(layout(lowEyes).a.glasses.yy).toBeGreaterThan(a.glasses.yy);
    expect(layout(lowEyes).a.ears.yy).toBeGreaterThan(a.ears.yy);
  });

  it('follows the eyes and mouth sideways when the head turns', () => {
    const turned: Face = { ...real, marks: { ...m, eyeX: m.eyeX + 0.06, mouthX: m.mouthX - 0.06 } };
    const t = layout(turned).a;
    expect(t.glasses.dx).toBeGreaterThan(0);
    expect(t.ears.dx).toBeGreaterThan(0);
    expect(t.mustache.dx).toBeLessThan(0);
  });
});

describe('toMarks', () => {
  const eyes = [{ x: 0.6, y: 0.4 }, { x: 0.4, y: 0.42 }]; // order does not matter
  it('uses the midpoint and distance of the eyes', () => {
    const m = toMarks(eyes, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 })!;
    expect(m.eyeX).toBeCloseTo(0.5, 10);
    expect(m.eyeY).toBeCloseTo(0.41, 10);
    expect(m.eyeDist).toBeCloseTo(Math.hypot(0.2, 0.02), 10);
    expect(m).toMatchObject({ noseX: 0.5, noseY: 0.5, mouthX: 0.5, mouthY: 0.6 });
  });
  it('estimates a missing nose 62% of the way from the eyes to the mouth', () => {
    const m = toMarks(eyes, undefined, { x: 0.5, y: 0.6 })!;
    expect(m.noseY).toBeCloseTo(0.41 + (0.6 - 0.41) * 0.62, 10);
  });
  it('gives up (so the old placement is used) on missing or nonsense points', () => {
    expect(toMarks([eyes[0]!], undefined, { x: 0.5, y: 0.6 })).toBeUndefined();
    expect(toMarks(eyes, undefined, undefined)).toBeUndefined();
    expect(toMarks(eyes, undefined, { x: 0.5, y: 0.3 })).toBeUndefined(); // mouth above the eyes
    expect(toMarks([{ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.4 }], undefined, { x: 0.5, y: 0.6 })).toBeUndefined(); // same point twice
    expect(toMarks(eyes, undefined, { x: NaN, y: 0.6 })).toBeUndefined();
  });
});

describe('browser FaceDetector landmarks', () => {
  it('maps pixel landmarks (one entry per eye, or both in one) to marks', () => {
    const lm = [
      { type: 'eye', locations: [{ x: 128, y: 96 }] },
      { type: 'eye', locations: [{ x: 192, y: 96 }] },
      { type: 'mouth', locations: [{ x: 160, y: 170 }] },
    ];
    const m = nativeMarks(lm, 320, 240)!;
    expect(m).toMatchObject({ eyeX: 0.5, eyeY: 0.4, mouthY: 170 / 240 });
    expect(nativeMarks([{ type: 'eye', locations: [{ x: 128, y: 96 }, { x: 192, y: 96 }] }, lm[2]!], 320, 240)).toEqual(m);
  });
  it('is undefined when the browser reports no landmarks', () => {
    expect(nativeMarks(undefined, 320, 240)).toBeUndefined();
    expect(nativeMarks([], 320, 240)).toBeUndefined();
  });
});

describe('tracking keeps the marks', () => {
  beforeEach(() => faces.reset());
  it('eases the marks together with the box (35% old, 65% new)', () => {
    const a: Face = { ...real, marks: { ...real.marks!, eyeY: 0.4 } };
    const b: Face = { ...real, marks: { ...real.marks!, eyeY: 0.5 } };
    faces.setTracked([a], 1000);
    faces.setTracked([b], 1100);
    expect(faces.getTracked()[0]!.marks!.eyeY).toBeCloseTo(0.4 * 0.35 + 0.5 * 0.65, 10);
  });
  it('a face with no marks stays a plain box', () => {
    faces.setTracked([{ x: 0.5, y: 0.5, w: 0.2, h: 0.3 }], 1000);
    faces.setTracked([{ x: 0.51, y: 0.5, w: 0.2, h: 0.3 }], 1100);
    expect('marks' in faces.getTracked()[0]!).toBe(false);
  });
  it('a tap on the live camera gets typical marks; a tap on the demo art keeps the old placement', () => {
    faces.place(0.5, 0.5, 1, true);
    const m = faces.getManual()[0]!.marks!;
    expect(m.eyeY).toBeCloseTo(0.5 - 0.14 * 0.42, 10);
    expect(m.mouthY).toBeGreaterThan(m.noseY);
    faces.reset();
    faces.place(0.5, 0.5, 1);
    expect(faces.getManual()[0]!.marks).toBeUndefined();
  });
});
