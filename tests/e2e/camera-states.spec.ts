// Camera permission / availability states and demo-mode capture (no webcam involved).
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
}
const goCamera = (page: Page) => page.evaluate(() => window.__lpc.go(3, false));

test('permission denied: shows Draft 27 wording, stays in demo, can still take photos', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await open(page);
  await goCamera(page);
  await expect(page.locator('#camera-status')).toHaveText('No camera access. You can still use the demo.');
  await expect(page.locator('#webcam')).toHaveText('Use real camera');
  await expect(page.locator('#video')).toBeHidden();
  await expect(page.locator('#take')).toBeEnabled();
});

test('no camera API at all: says so and keeps the demo working', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });
  await open(page);
  await goCamera(page);
  await expect(page.locator('#camera-status')).toHaveText('Camera unavailable in this browser. Demo still works.');
  await expect(page.locator('#take')).toBeEnabled();
});

test('demo capture takes four photos, hands over to the reveal, and retake clears them', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await open(page);
  await page.evaluate(() => { window.__lpc.session.count = 2; window.__lpc.go(3, false); });
  await page.click('#take');
  // 4 x (1450 prompt + 3 x 1000 countdown + 650 settle) = 20.4 s
  await page.clock.runFor(21_000);
  await expect.poll(() => page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s4');
  const info = await page.evaluate(async () => {
    const shots = window.__lpc.session.shots as ({ blob: Blob; url: string } | null)[];
    const dims = await Promise.all(shots.map(async (s) => {
      if (!s) return null;
      const bmp = await createImageBitmap(s.blob);
      return [bmp.width, bmp.height, s.blob.type];
    }));
    return { n: shots.length, dims, urls: shots.map((s) => s?.url) };
  });
  expect(info.n).toBe(4);
  for (const d of info.dims) expect(d).toEqual([960, 720, 'image/png']);

  // Retake: the old photos' object URLs must be released.
  await page.evaluate(() => window.__lpc.go(3, false));
  const stillValid = await page.evaluate(async (urls) => {
    const out: boolean[] = [];
    for (const u of urls as string[]) out.push(await fetch(u).then(() => true, () => false));
    return out;
  }, info.urls);
  expect(stillValid).toEqual([false, false, false, false]);
  expect(await page.evaluate(() => window.__lpc.session.shots.length)).toBe(0);
});

test('leaving mid-countdown stops the countdown for good', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await open(page);
  await goCamera(page);
  await page.click('#take');
  await page.clock.runFor(2000);
  await page.evaluate(() => window.__lpc.go(1, false));
  await page.clock.runFor(30_000);
  expect(await page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s1');
  expect(await page.evaluate(() => window.__lpc.session.shots.length)).toBe(0);
});

test('lens and frame buttons do nothing while the countdown runs', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await open(page);
  await goCamera(page);
  await page.click('#take');
  await page.clock.runFor(500);
  await page.evaluate(() => {
    (document.querySelector('[data-filter="flipnote"]') as HTMLElement).click();
    (document.getElementById('frame-toggle') as HTMLElement).click();
  });
  expect(await page.evaluate(() => [window.__lpc.session.lens, window.__lpc.session.frameOn])).toEqual(['classic', false]);
});

test('Draft 27 state: lens survives a retake, and a full reset restores defaults', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await open(page);
  await goCamera(page);
  await page.click('[data-filter="mischief"]');
  await page.click('#variant-buttons button[data-variant="glasses"]');
  await goCamera(page);
  expect(await page.evaluate(() => [window.__lpc.session.lens, window.__lpc.session.lensChoice.mischief])).toEqual(['mischief', 'glasses']);
  await page.evaluate(() => window.__lpc.resetSession());
  expect(await page.evaluate(() => [window.__lpc.session.lens, window.__lpc.session.lensChoice.mischief, window.__lpc.session.frameOn])).toEqual(['classic', 'mustache', false]);
});
