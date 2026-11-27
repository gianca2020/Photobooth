// Golden test: every lens must produce exactly what Draft 27's own code produces. The original
// functions are cut out of reference/draft27.html and run next to ours on the same synthetic image.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LensId } from '../../app/src/app/state';
import { drawAccessories } from '../../app/src/camera/lenses/accessories';
import { emotePixels } from '../../app/src/camera/lenses/emote';
import { processPixels } from '../../app/src/camera/lenses/pixels';
import { warpPixels } from '../../app/src/camera/lenses/warp';
import type { Face } from '../../app/src/camera/types';

const html = readFileSync(new URL('../../reference/draft27.html', import.meta.url), 'utf8');
const start = html.indexOf('const bayer=');
const end = html.indexOf('function applyLens');
if (start < 0 || end < 0) throw new Error('lens code not found in reference');
const lensCode = html.slice(start, end);

type Ref = {
  processPixels(g: unknown, w: number, h: number, mode: string): void;
  warpPixels(g: unknown, w: number, h: number): void;
  emotePixels(g: unknown, w: number, h: number): void;
  drawAccessories(g: unknown, w: number, h: number): void;
};
function reference(faces: Face[], choice: { warp: string; emoter: string; mischief: string }): Ref {
  const make = new Function(
    'clamp', 'activeFaces', 'lensChoice',
    `${lensCode}; return { processPixels, warpPixels, emotePixels, drawAccessories };`,
  );
  return make((v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)), () => faces, choice);
}

const W = 96, H = 72;
function testImage(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = Math.floor(i / W);
    const orange = x > 10 && x < 40 && y > 10 && y < 30; // a block the orange lens should keep
    d[i * 4] = orange ? 230 : rnd() * 255;
    d[i * 4 + 1] = orange ? 110 : rnd() * 255;
    d[i * 4 + 2] = orange ? 20 : rnd() * 255;
    d[i * 4 + 3] = 255;
  }
  return d;
}
const fakePixelContext = (data: Uint8ClampedArray) => {
  const box = { data: new Uint8ClampedArray(data) };
  return { ctx: { getImageData: () => box, putImageData: () => {} }, result: () => box.data };
};
function recorder() {
  const log: unknown[] = [];
  const ctx = new Proxy({}, {
    get: (_t, key) => (...args: unknown[]) => { log.push([String(key), args]); },
    set: (_t, key, value) => { log.push(['set', String(key), value]); return true; },
  });
  return { ctx, log };
}

const faces: Face[] = [{ x: 0.35, y: 0.5, w: 0.25, h: 0.35 }, { x: 0.7, y: 0.55, w: 0.22, h: 0.3 }];
const choice = { warp: 'bulge', emoter: 'happy', mischief: 'mustache' };

describe('processPixels matches Draft 27', () => {
  for (const mode of ['classic', 'flipnote', 'orange', '2009', 'mischief'] as LensId[]) {
    it(mode, () => {
      const a = fakePixelContext(testImage()), b = fakePixelContext(testImage());
      reference(faces, choice).processPixels(a.ctx, W, H, mode);
      processPixels(b.ctx as never, W, H, mode);
      expect(Buffer.from(b.result()).equals(Buffer.from(a.result()))).toBe(true);
    });
  }
});

describe('warpPixels matches Draft 27', () => {
  for (const mode of ['bulge', 'pinch', 'wide']) {
    for (const f of [faces, []]) {
      it(`${mode} with ${f.length} faces`, () => {
        const a = fakePixelContext(testImage()), b = fakePixelContext(testImage());
        reference(f, { ...choice, warp: mode }).warpPixels(a.ctx, W, H);
        warpPixels(b.ctx as never, W, H, f, mode);
        expect(Buffer.from(b.result()).equals(Buffer.from(a.result()))).toBe(true);
      });
    }
  }
});

describe('emotePixels matches Draft 27', () => {
  for (const mode of ['happy', 'sad', 'angry']) {
    it(mode, () => {
      const a = fakePixelContext(testImage()), b = fakePixelContext(testImage());
      reference(faces, { ...choice, emoter: mode }).emotePixels(a.ctx, W, H);
      emotePixels(b.ctx as never, W, H, faces, mode);
      expect(Buffer.from(b.result()).equals(Buffer.from(a.result()))).toBe(true);
    });
  }
  it('does nothing without faces', () => {
    const a = fakePixelContext(testImage()), b = fakePixelContext(testImage());
    reference([], choice).emotePixels(a.ctx, W, H);
    emotePixels(b.ctx as never, W, H, [], 'happy');
    expect(Buffer.from(b.result()).equals(Buffer.from(testImage()))).toBe(true);
    expect(Buffer.from(a.result()).equals(Buffer.from(testImage()))).toBe(true);
  });
});

describe('drawAccessories issues the same drawing calls as Draft 27', () => {
  for (const mode of ['mustache', 'glasses', 'ears', 'all']) {
    it(mode, () => {
      const a = recorder(), b = recorder();
      reference(faces, { ...choice, mischief: mode }).drawAccessories(a.ctx, 640, 480);
      drawAccessories(b.ctx as never, 640, 480, faces, mode);
      expect(a.log.length).toBeGreaterThan(5);
      expect(b.log).toEqual(a.log);
    });
  }
});
