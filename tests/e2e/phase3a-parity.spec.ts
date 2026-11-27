// Phase 3a parity: the camera scene (demo mode), every lens, variants, doodle frame and the
// countdown must match Draft 27. Same clicks and the same frozen clock as the baseline capture.
import { expect, test } from '@playwright/test';

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

for (const [name, viewport] of Object.entries(viewports)) {
  test(`camera scene matches Draft 27 (${name})`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL }); // no camera permission -> demo
    const page = await ctx.newPage();
    await page.clock.install({ time: 0 });
    await page.goto('/?debug', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(10_000);

    const run = (ms: number) => page.clock.runFor(ms);
    const frames = (n: number) => run(Math.round((n * 1000) / 12));
    const settle = () => page.waitForTimeout(1000);
    const check = (shot: string) => expect(page).toHaveScreenshot(`${name}-${shot}.png`);

    await page.evaluate(() => { window.__lpc.session.count = 4; window.__lpc.go(2, false); });
    await settle();
    await frames(10);
    await frames(30);
    await run(10000); // the run-in finishes and hands over to the camera scene
    await settle();
    await check('camera-demo');

    for (const lens of ['classic', 'flipnote', 'mischief', 'warp', 'orange', '2009', 'emoter']) {
      await page.click(`[data-filter="${lens}"]`);
      await run(300);
      await check(`camera-lens-${lens}`);
      const variant = ({ mischief: 'all', warp: 'wide', emoter: 'angry' } as Record<string, string>)[lens];
      if (variant) {
        await page.click(`#variant-buttons button[data-variant="${variant}"]`);
        await run(300);
        await check(`camera-lens-${lens}-${variant}`);
      }
    }
    await page.click('[data-filter="classic"]');
    await page.click('#frame-toggle');
    await run(300);
    await check('camera-frame');
    await page.click('#frame-toggle');
    await run(300);

    await page.click('#take');
    await run(1500);
    await check('camera-count-3');
    await run(1000);
    await check('camera-count-2');
    await ctx.close();
  });
}

