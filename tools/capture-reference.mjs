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
  await ctx.close();
}
await browser.close();
console.log('baseline written to', outDir);
