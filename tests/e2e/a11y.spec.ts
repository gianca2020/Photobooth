// Automated accessibility check (axe-core, WCAG 2.0/2.1 A + AA and best practices) of every screen, at desktop and phone
// size. It runs on real time because axe itself uses timers. Colour contrast cannot be judged automatically here (the
// backgrounds are dotted patterns, so axe reports it as "needs review"); see docs/accessibility.md for the manual figures.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const viewports = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

for (const [name, size] of Object.entries(viewports)) {
  test(`every screen has no axe violations (${name})`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: size, baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.goto('/?debug', { waitUntil: 'load' }); // ?debug adds the scene hook (and the prototype footer, scanned too)

    const problems: string[] = [];
    const scan = async (screen: string) => {
      await page.waitForTimeout(600);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).exclude('#progress').analyze(); // #progress is the prototype scene-jumper, shown only with ?debug
      for (const v of result.violations) problems.push(`${screen}: ${v.id} [${v.impact}] ${v.nodes[0]!.target.join(' ')}: ${v.help}`);
    };
    const go = (n: number) => page.evaluate((i) => window.__lpc.go(i, false), n);

    await scan('coin');
    await go(0); await scan('welcome');
    await page.evaluate(() => { window.__lpc.session.count = 3; window.__lpc.session.names = ['Ana', 'Ben', '', '']; });
    await go(1); await scan('guests');
    await go(2); await scan('run-in');
    await go(3); await scan('camera');
    await page.click('#live-toggle'); await page.click('#live-stamps'); await scan('camera with graffiti tools and the stamp palette');
    await go(4); await page.waitForTimeout(4000); await scan('dispenser (strip landed, with names)');
    await page.click('#fall'); await scan('reveal');
    await page.click('#graffiti-open'); await page.click('#post-stamps'); await scan('graffiti editor with the stamp palette');
    await page.click('#graffiti-cancel'); await page.click('#review-next'); await scan('keep or retake');
    await go(5); await scan('delivery');
    await page.click('#download'); await page.waitForTimeout(900); await scan('delivery finished');

    expect(problems).toEqual([]);
    await ctx.close();
  });
}

test('the page has a level-one heading inside the main area, and a language', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('main > h1')).toHaveText('Little Photo Club'); // inside <main>: present even while the header is hidden on the coin screen
  expect(await page.getAttribute('html', 'lang')).toBe('en');
});

test('labelled containers have a role that allows a label (axe only marks this "needs review")', async ({ page }) => {
  await page.goto('/?debug', { waitUntil: 'load' });
  for (const sel of ['#dots', '.dispenser']) await expect(page.locator(sel)).toHaveAttribute('role', 'group');
});

test('controls announce what they show: the sound button\'s name is its visible text, the guest buttons start with theirs', async ({ page }) => {
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.evaluate(() => window.__lpc.go(1, false)); // the header (and its buttons) is hidden on the coin screen
  await expect(page.locator('#sound')).toHaveAccessibleName('sound on');
  await page.evaluate(() => document.getElementById('sound')!.click());
  await expect(page.locator('#sound')).toHaveAccessibleName('sound off');
  await expect(page.locator('#minus')).toHaveAccessibleName('−1 guest');
  await expect(page.locator('#plus')).toHaveAccessibleName('+1 guest');
});
