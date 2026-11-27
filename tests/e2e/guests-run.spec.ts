import { expect, test, type Page } from '@playwright/test';


async function open(page: Page) {
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
}
const activeScene = (page: Page) => page.evaluate(() => document.querySelector('.scene.active')?.id);

test.describe('guest selection', () => {
  test('buttons stop at 1 and 4, and inputs follow the count', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__lpc.go(1, false));
    const minus = page.locator('#minus'), plus = page.locator('#plus'), inputs = page.locator('#names input');
    await expect(minus).toBeDisabled();
    await expect(inputs).toHaveCount(1);
    for (const expected of [2, 3, 4]) {
      await plus.click();
      await expect(inputs).toHaveCount(expected);
    }
    await expect(plus).toBeDisabled();
    await expect(page.locator('#names')).toHaveClass(/two-by-two/);
    await expect(page.locator('#guest-count')).toHaveText('4 guests');
    await minus.click();
    await expect(page.locator('#portrait img')).toHaveClass(/count-3/);
    for (let i = 0; i < 2; i++) await minus.click();
    await expect(page.locator('#guest-count')).toHaveText('1 guest');
  });

  test('typed names survive changing the count and leaving the scene', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__lpc.go(1, false));
    await page.locator('#plus').click();
    await page.locator('#names input').nth(1).fill('Leo');
    await page.locator('#minus').click();
    await page.locator('#plus').click();
    await expect(page.locator('#names input').nth(1)).toHaveValue('Leo');
    await page.evaluate(() => (window as any).__lpc.go(2, false));
    await page.evaluate(() => (window as any).__lpc.go(1, false));
    await expect(page.locator('#names input').nth(1)).toHaveValue('Leo');
    expect(await page.evaluate(() => (window as any).__lpc.session.names[1])).toBe('Leo');
  });

  test('"Step inside" goes to the run-in', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__lpc.go(1, false));
    await page.locator('#enter').click();
    expect(await activeScene(page)).toBe('s2');
  });
});

test.describe('run-in', () => {
  for (const count of [1, 4]) {
    test(`auto-advances to the camera scene (${count} guest${count > 1 ? 's' : ''})`, async ({ page }) => {
      await open(page);
      await page.evaluate((c) => { (window as any).__lpc.session.count = c; (window as any).__lpc.go(2, false); }, count);
      await page.waitForTimeout(500);
      await page.clock.runFor(4000);
      expect(await activeScene(page)).toBe('s2'); // still hopping
      await page.clock.runFor(5000);
      expect(await activeScene(page)).toBe('s3');
    });
  }

  test('"Skip" goes to the camera scene immediately', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__lpc.go(2, false));
    await page.locator('#skiprun').click();
    expect(await activeScene(page)).toBe('s3');
  });

  test('leaving mid-run cancels every timer (no surprise jump later)', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__lpc.go(2, false));
    await page.waitForTimeout(500);
    await page.clock.runFor(2000);
    await page.evaluate(() => (window as any).__lpc.go(1, false));
    await page.clock.runFor(20_000);
    expect(await activeScene(page)).toBe('s1');
  });

  test('reduced motion shows the final frame and still advances', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', baseURL });
    const page = await ctx.newPage();
    await open(page);
    await page.evaluate(() => (window as any).__lpc.go(2, false));
    await page.waitForTimeout(500);
    expect(await activeScene(page)).toBe('s2');
    await page.clock.runFor(1000);
    expect(await activeScene(page)).toBe('s3');
    await ctx.close();
  });
});
