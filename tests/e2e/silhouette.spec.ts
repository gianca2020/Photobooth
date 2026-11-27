// The runner's white doorway outline. Safari's canvas has no `filter`, so it is built from compositing.
// On every engine it must be solid white wherever the sprite has pixels, and (where the browser has
// `filter`, i.e. Chromium and Firefox) identical to what Draft 27's `brightness(0) invert(1)` produced.
import { expect, test } from '@playwright/test';
import { art } from '../../app/src/assets/manifest';

test('whiteSilhouette is white where the sprite is, transparent elsewhere, and equals Draft 27\'s filter', async ({ page }) => {
  await page.goto('/?debug', { waitUntil: 'load' });
  const result = await page.evaluate(async (sprites) => {
    const path = '/src/engine/sprites.ts'; // served by the dev server
    const { whiteSilhouette } = (await import(/* @vite-ignore */ path)) as typeof import('../../app/src/engine/sprites');
    const out: { sprite: string; scale: number; solid: boolean; compared: boolean; differing: number }[] = [];
    for (const src of sprites) {
      const im = new Image();
      im.src = src;
      await im.decode();
      for (const scale of [1, 0.75, 0.5]) {
        const w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
        // reference: the sprite itself, at the same size
        const plain = new OffscreenCanvas(w, h);
        const pg = plain.getContext('2d')!;
        pg.imageSmoothingEnabled = false;
        pg.drawImage(im, 0, 0, w, h);
        const base = pg.getImageData(0, 0, w, h).data;
        const white = whiteSilhouette(im, w, h);
        const wd = white.getContext('2d')!.getImageData(0, 0, w, h).data;
        let solid = true;
        for (let i = 0; i < base.length; i += 4) {
          const a = base[i + 3]!;
          if (a === 0 ? wd[i + 3] !== 0 : !(wd[i] === 255 && wd[i + 1] === 255 && wd[i + 2] === 255 && wd[i + 3] === a)) solid = false;
        }
        // Draft 27's own method, where this browser supports it
        let compared = false, differing = 0;
        const probe = new OffscreenCanvas(1, 1).getContext('2d')!;
        if ('filter' in probe) {
          const f = new OffscreenCanvas(w, h);
          const fg = f.getContext('2d')!;
          fg.imageSmoothingEnabled = false;
          fg.filter = 'brightness(0) invert(1)';
          fg.drawImage(im, 0, 0, w, h);
          const fd = fg.getImageData(0, 0, w, h).data;
          compared = true;
          for (let i = 0; i < fd.length; i++) if (fd[i] !== wd[i] && !(fd[i + (3 - (i % 4))] === 0 && wd[i + (3 - (i % 4))] === 0)) differing++;
        }
        out.push({ sprite: src, scale, solid, compared, differing });
      }
    }
    return out;
  }, art.run.runners as unknown as string[]);
  expect(result).toHaveLength(12);
  for (const r of result) {
    expect(r.solid, `${r.sprite} @${r.scale}: white where the sprite has pixels, same transparency`).toBe(true);
    expect(r.differing, `${r.sprite} @${r.scale}: differs from the canvas filter`).toBe(0);
  }
});

// What Safari runs: the app with the canvas `filter` switched off (Chromium can imitate that), compared
// frame by frame with Draft 27 itself running normally. Every one of the 100 frames must be identical.
test('without canvas filter (Safari) the run-in is frame-for-frame identical to Draft 27', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'needs Chromium to render Draft 27 as it was designed');
  const hashFrames = async (kind: 'draft27' | 'app') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    if (kind === 'app') await page.addInitScript(() => { delete (CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>).filter; });
    await page.clock.install({ time: 0 });
    await page.goto(kind === 'draft27' ? 'file://' + process.cwd() + '/reference/draft27.html' : '/?debug', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(10_000);
    if (kind === 'app') {
      expect(await page.evaluate(() => 'filter' in CanvasRenderingContext2D.prototype)).toBe(false); // the fallback really is what runs
      await page.evaluate(() => { window.__lpc.session.count = 3; window.__lpc.go(2, false); });
    } else {
      await page.evaluate(`count = 3; go(2, false);`);
    }
    await page.waitForTimeout(800);
    const hashes: string[] = [];
    for (let k = 0; k < 100; k++) {
      hashes.push(await page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('#booth-art canvas');
        if (!c) return 'none';
        const d = c.getContext('2d')!.getImageData(0, 0, 384, 144).data;
        let h = 2166136261; // FNV-1a over every byte
        for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i]!, 16777619);
        return (h >>> 0).toString(16);
      }));
      await page.clock.runFor(84);
    }
    await ctx.close();
    return hashes;
  };
  const [reference, app] = [await hashFrames('draft27'), await hashFrames('app')];
  expect(reference).not.toContain('none');
  expect(new Set(reference).size).toBeGreaterThan(50); // frames really vary, so equality means something
  expect(app).toEqual(reference);
});
