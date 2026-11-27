// Phase 1 parity: coin and welcome scenes must match Draft 27 frame for frame.
// Time is frozen after load; only clock.runFor() advances JS timers (same method as the baseline capture).
import { expect, test } from '@playwright/test';

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

for (const [name, viewport] of Object.entries(viewports)) {
  test(`coin and welcome match Draft 27 (${name})`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL });
    const page = await ctx.newPage();
    await page.clock.install({ time: 0 });
    await page.goto('/?debug', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(10_000);

    const run = (ms: number) => page.clock.runFor(ms);
    const frames = (n: number) => run(Math.round((n * 1000) / 12));
    const settle = () => page.waitForTimeout(1000);
    const check = (shot: string) => expect(page).toHaveScreenshot(`${name}-${shot}.png`);

    await check('coin-0');
    await run(2400 + 3 * 83);
    await check('coin-idle-3');
    await page.click('#coin-hit');
    let at = 0;
    for (const n of [3, 10, 24, 27, 34]) {
      await frames(n - at);
      at = n;
      await check(`coin-insert-f${n}`);
    }
    await run(6000);
    await settle();
    await check('welcome-ready');
    await ctx.close();
  });
}
