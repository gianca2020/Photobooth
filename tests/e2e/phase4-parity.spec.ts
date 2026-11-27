// Phase 4 parity (first part): the dispenser print/drop frames and the opened strip must match the
// Draft 27 baselines. Same steps and the same frozen clock as tools/capture-reference.mjs.
import { expect, test } from '@playwright/test';

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

for (const [name, viewport] of Object.entries(viewports)) {
  test(`dispenser and reveal strip match Draft 27 (${name})`, async ({ browser, baseURL }) => {
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

    await page.evaluate(() => { window.__lpc.session.count = 4; window.__lpc.go(4, false); });
    await settle();
    let at = 0;
    for (const f of [0, 18, 30, 36]) {
      await frames(f - at);
      at = f;
      await check(`print-f${f}`);
    }
    await run(4000);
    await page.click('#fall');
    await run(1000);
    await settle();
    await check('reveal-strip');
    await ctx.close();
  });

  test(`graffiti editor and decision match Draft 27 (${name})`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL });
    const page = await ctx.newPage();
    await page.clock.install({ time: 0 });
    await page.goto('/?debug', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(10_000);

    const run = (ms: number) => page.clock.runFor(ms);
    const settle = () => page.waitForTimeout(1000);
    const check = (shot: string) => expect(page).toHaveScreenshot(`${name}-reveal-${shot}.png`);

    await page.evaluate(() => { window.__lpc.session.count = 4; window.__lpc.go(4, false); });
    await settle();
    await run(4000);
    await page.click('#fall');
    await run(1000);
    await settle();
    await page.click('#graffiti-open');
    await run(300);
    await settle();
    await check('graffiti-open');

    const ink = (await page.locator('#graffiti-ink').boundingBox())!;
    const inkPoint = ([fx, fy]: number[]): [number, number] => [ink.x + ink.width * fx!, ink.y + ink.height * fy!];
    const inkStroke = async (points: number[][]) => {
      await page.mouse.move(...inkPoint(points[0]!));
      await page.mouse.down();
      for (const p of points.slice(1)) await page.mouse.move(...inkPoint(p), { steps: 6 });
      await page.mouse.up();
    };
    await page.click('[data-gcolor="#f66b00"]');
    await page.selectOption('#graffiti-size', '7');
    await inkStroke([[0.1, 0.2], [0.3, 0.5], [0.6, 0.3], [0.85, 0.6]]);
    await check('graffiti-pen');
    await page.click('#post-stamps');
    await check('graffiti-palette');
    await page.click('[data-gcolor="#171717"]');
    await page.click('[data-poststamp="star"]');
    await page.mouse.click(...inkPoint([0.25, 0.75]));
    await check('graffiti-stamp');
    await page.click('[data-gtool="eraser"]');
    await inkStroke([[0.05, 0.4], [0.95, 0.45]]);
    await check('graffiti-erase');
    await page.click('#graffiti-undo');
    await check('graffiti-undo');
    await page.click('[data-gphoto="1"]');
    await page.click('#post-stamps');
    await page.click('[data-poststamp="heart"]');
    await page.mouse.click(...inkPoint([0.5, 0.5]));
    await check('graffiti-photo2');
    await page.click('#graffiti-done');
    await settle();
    await run(500);
    await check('graffiti-applied');
    await page.click('#review-next');
    await run(500);
    await settle();
    await check('decision');
    await ctx.close();
  });
}
