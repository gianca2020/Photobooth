// Captures deterministic reference screenshots of Draft 27 (demo mode, no webcam, fake clock).
// Usage: node tools/capture-reference.mjs [outDir]   (default tests/visual/baseline)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ?? join(root, 'tests/visual/baseline');
const url = 'file://' + join(root, 'reference/draft27.html');
mkdirSync(outDir, { recursive: true });

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const browser = await chromium.launch();

for (const [vpName, viewport] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, permissions: [], reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.clock.install({ time: 0 });
  // Draft 27 pulls Pixelify Sans from Google Fonts; wait for it so the baseline is not a fallback font.
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // The installed clock keeps ticking in real time until paused; freeze it so only runFor() advances JS time.
  await page.clock.pauseAt(10_000);
  const shot = async (name) => page.screenshot({ path: join(outDir, `${vpName}-${name}.png`) });
  const run = (ms) => page.clock.runFor(ms);
  // CSS transitions/animations run on wall-clock time, not the fake clock; let them finish before a shot.
  const settle = () => page.waitForTimeout(1000);
  const frames = (n) => run(Math.round((n * 1000) / 12));

  // Scene -1: coin idle frame 0, then insert sequence.
  await shot('coin-0');
  await run(2400 + 3 * 83); // idle animation passes frame 3
  await shot('coin-idle-3');
  await page.click('#coin-hit');
  let at = 0; // frames elapsed since the click
  for (const n of [3, 10, 24, 27, 34]) { await frames(n - at); at = n; await shot(`coin-insert-f${n}`); }
  // Welcome: let the sequence run to the start button.
  await run(6000);
  await settle();
  await shot('welcome-ready');

  for (const count of [1, 2, 3, 4]) {
    await page.evaluate((c) => { count = c; go(1, false); }, count);
    await run(500);
    await settle();
    await shot(`guests-${count}`);
  }
  await page.evaluate(() => { count = 4; go(2, false); });
  await settle();
  await frames(10); await shot('run-f10');
  await frames(30); await shot('run-f40');
  await run(10000);
  await settle();
  await shot('camera-demo');
  // Lenses (demo mode, 4 guests), driven by real clicks so the new app can replay the same steps.
  for (const lens of ['classic', 'flipnote', 'mischief', 'warp', 'orange', '2009', 'emoter']) {
    await page.click(`[data-filter="${lens}"]`);
    await run(300);
    await shot(`camera-lens-${lens}`);
    const variant = { mischief: 'all', warp: 'wide', emoter: 'angry' }[lens];
    if (variant) {
      await page.click(`#variant-buttons button[data-variant="${variant}"]`);
      await run(300);
      await shot(`camera-lens-${lens}-${variant}`);
    }
  }
  await page.click('[data-filter="classic"]');
  await page.click('#frame-toggle');
  await run(300);
  await shot('camera-frame');
  await page.click('#frame-toggle');
  await run(300);
  // Countdown: the number appears 1450 ms after "Take photos" and changes every second.
  await page.click('#take');
  await run(1500);
  await shot('camera-count-3');
  await run(1000);
  await shot('camera-count-2');
  await page.evaluate(() => { go(4, false); });
  await settle();
  let pf = 0; // print timeline starts 0 ms after go(4) without the .enter delay
  for (const f of [0, 18, 30, 36]) { await frames(f - pf); pf = f; await shot(`print-f${f}`); }
  await run(4000);
  await page.evaluate(() => openPhoto());
  await run(1000);
  await settle();
  await shot('reveal-strip');
  await page.evaluate(() => go(5, false));
  await run(1000);
  await settle();
  await shot('email');
  // Live graffiti (Phase 3c): a fresh visit to the camera scene, drawn with real mouse input.
  await page.evaluate(() => { go(3, false); });
  await run(500);
  await settle();
  const pad = await page.locator('#live-graffiti').boundingBox();
  const padPoint = ([fx, fy]) => [pad.x + pad.width * fx, pad.y + pad.height * fy];
  const stroke = async (points) => {
    await page.mouse.move(...padPoint(points[0]));
    await page.mouse.down();
    for (const p of points.slice(1)) await page.mouse.move(...padPoint(p), { steps: 6 });
    await page.mouse.up();
  };
  await page.click('#live-toggle');
  await shot('camera-graffiti-on');
  await page.click('#live-pen');
  await page.click('[data-livecolor="#f66b00"]');
  await page.selectOption('#live-size', '6');
  await stroke([[0.1, 0.2], [0.3, 0.5], [0.6, 0.3], [0.85, 0.6]]);
  await shot('camera-graffiti-pen');
  await page.click('#live-stamps');
  await shot('camera-graffiti-palette');
  await page.click('[data-livecolor="#171717"]');
  await page.click('[data-livestamp="star"]');
  await page.mouse.click(...padPoint([0.25, 0.75]));
  await shot('camera-graffiti-stamp');
  await page.click('#live-eraser');
  await stroke([[0.05, 0.4], [0.95, 0.45]]);
  await shot('camera-graffiti-erase');
  await page.click('#live-undo');
  await shot('camera-graffiti-undo');
  await page.click('#live-clear');
  await shot('camera-graffiti-clear');
  await page.click('#live-stamps');
  await page.click('[data-livecolor="#ffffff"]');
  await page.click('[data-livestamp="heart"]');
  await page.selectOption('#live-size', '4');
  await page.mouse.click(...padPoint([0.5, 0.5]));
  await page.click('#take');
  await run(1500);
  await shot('camera-graffiti-count');
  await ctx.close();
}
await browser.close();
console.log('baseline written to', outDir);
