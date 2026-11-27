// Phase 2 parity: guests (1-4) and the run-in must match Draft 27. Scenes are reached through the
// ?debug hook (window.__lpc) so the test doesn't depend on the opening sequence.
import { expect, test } from '@playwright/test';

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

declare global {
  interface Window { __lpc: { go: (i: number, animate?: boolean) => void; session: { count: number } } }
}

for (const [name, viewport] of Object.entries(viewports)) {
  test(`guests and run-in match Draft 27 (${name})`, async ({ browser, baseURL }) => {
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

    for (const count of [1, 2, 3, 4]) {
      await page.evaluate((c) => { window.__lpc.session.count = c; window.__lpc.go(1, false); }, count);
      await run(500);
      await settle();
      await check(`guests-${count}`);
    }
    await page.evaluate(() => { window.__lpc.session.count = 4; window.__lpc.go(2, false); });
    await settle();
    await frames(10);
    await check('run-f10');
    await frames(30);
    await check('run-f40');
    await ctx.close();
  });
}
