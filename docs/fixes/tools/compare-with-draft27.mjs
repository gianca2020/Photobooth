// Feeds one face video to BOTH reference/draft27.html and the app through Chromium's fake webcam, picks
// the Mischief lens, waits for "1 face tracked" and saves a screenshot of each viewfinder. Answers
// "is this look inherited from Draft 27, or did we break it?" with pictures.
//
//   ffmpeg -loop 1 -i face.png -t 4 -r 15 -vf scale=640:480 -pix_fmt yuv420p face.y4m
//   npx vite --port 5391 --strictPort &
//   node docs/fixes/tools/compare-with-draft27.mjs face.y4m out-dir [mischief-variant: all|glasses|mustache|ears]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [video, outDir = 'compare-out', variant = 'all'] = process.argv.slice(2);
if (!video) throw new Error('usage: node compare-with-draft27.mjs <face.y4m> [outDir] [variant]');
mkdirSync(outDir, { recursive: true });

const targets = {
  draft27: pathToFileURL(resolve('reference/draft27.html')).href,
  app: (process.env.APP_URL ?? 'http://localhost:5391') + '/?debug',
};
const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${resolve(video)}`],
});
for (const [name, url] of Object.entries(targets)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => (window.__lpc ? window.__lpc.go(3, false) : go(3, false)));
  await page.waitForTimeout(2500);
  await page.click('[data-filter="mischief"]');
  await page.click(`#variant-buttons button[data-variant="${variant}"]`);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if (/1 face tracked/.test(await page.textContent('#filter-note'))) break;
  }
  console.log(name, '-', await page.textContent('#filter-note'));
  await page.waitForTimeout(800);
  await page.locator('#s3 .viewfinder').screenshot({ path: `${outDir}/${name}.png` });
  await ctx.close();
}
await browser.close();
