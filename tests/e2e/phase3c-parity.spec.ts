// Phase 3c parity: the live graffiti layer (toggle, pen, stamp palette, stamp, eraser, undo, clear,
// locked during the countdown) must match Draft 27 pixel for pixel. Same mouse input as
// tools/capture-reference.mjs, same frozen clock.
import { expect, test } from '@playwright/test';

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

for (const [name, viewport] of Object.entries(viewports)) {
  test(`live graffiti matches Draft 27 (${name})`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL });
    const page = await ctx.newPage();
    await page.clock.install({ time: 0 });
    await page.goto('/?debug', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(10_000);

    const run = (ms: number) => page.clock.runFor(ms);
    const settle = () => page.waitForTimeout(1000);
    const check = (shot: string) => expect(page).toHaveScreenshot(`${name}-camera-graffiti-${shot}.png`);

    await page.evaluate(() => { window.__lpc.session.count = 4; window.__lpc.go(3, false); });
    await run(500);
    await settle();
    const pad = (await page.locator('#live-graffiti').boundingBox())!;
    const padPoint = ([fx, fy]: number[]): [number, number] => [pad.x + pad.width * fx!, pad.y + pad.height * fy!];
    const stroke = async (points: number[][]) => {
      await page.mouse.move(...padPoint(points[0]!));
      await page.mouse.down();
      for (const p of points.slice(1)) await page.mouse.move(...padPoint(p), { steps: 6 });
      await page.mouse.up();
    };

    await page.click('#live-toggle');
    await check('on');
    await page.click('#live-pen');
    await page.click('[data-livecolor="#f66b00"]');
    await page.selectOption('#live-size', '6');
    await stroke([[0.1, 0.2], [0.3, 0.5], [0.6, 0.3], [0.85, 0.6]]);
    await check('pen');
    await page.click('#live-stamps');
    await check('palette');
    await page.click('[data-livecolor="#171717"]');
    await page.click('[data-livestamp="star"]');
    await page.mouse.click(...padPoint([0.25, 0.75]));
    await check('stamp');
    await page.click('#live-eraser');
    await stroke([[0.05, 0.4], [0.95, 0.45]]);
    await check('erase');
    await page.click('#live-undo');
    await check('undo');
    await page.click('#live-clear');
    await check('clear');
    await page.click('#live-stamps');
    await page.click('[data-livecolor="#ffffff"]');
    await page.click('[data-livestamp="heart"]');
    await page.selectOption('#live-size', '4');
    await page.mouse.click(...padPoint([0.5, 0.5]));
    await page.click('#take');
    await run(1500);
    await check('count');
    await ctx.close();
  });
}
