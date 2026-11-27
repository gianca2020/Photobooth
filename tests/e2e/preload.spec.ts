// Issue #4: in Draft 27 every image was already in memory; in the port each file is a download. The art
// guests are about to need must be requested and decoded ahead of time, so nothing waits mid-screen.
// Measured the way the issue did: 150 ms latency, ~1.5 Mbit/s.
import { expect, test, type Page } from '@playwright/test';
import { art } from '../../app/src/assets/manifest';

const everyArt = [
  art.coinSheet,
  art.welcomeSheet,
  ...art.guests,
  art.run.booth,
  art.run.open,
  ...art.run.runners,
  ...art.demo.flat(),
  art.doodleFrame,
  '/art/dispenser.png',
  '/art/arcade-camera.png',
  '/art/envelope.png',
];

async function slowPage(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Which images the app asked the browser to decode ahead of time.
    const w = window as unknown as { __decoded: Set<string> };
    w.__decoded = new Set();
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      w.__decoded.add(new URL(this.src).pathname);
      return decode.call(this);
    };
  });
});

test('every picture is requested and decoded without waiting for its screen, the first sheets first', async ({ page }) => {
  await slowPage(page);
  const order: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/art/')) order.push(u.pathname); });
  await page.goto('/?debug', { waitUntil: 'load' }); // stays on the coin scene: nobody has opened any other screen
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const wanted = [...new Set(everyArt)].sort();
  expect([...new Set(order)].sort()).toEqual(wanted); // requested
  const decoded = await page.evaluate(() => [...(window as unknown as { __decoded: Set<string> }).__decoded].sort());
  expect(decoded).toEqual(wanted); // and decoded, not just downloaded
  // the first screens' own sheets are not queued behind the portraits
  expect(Math.max(order.indexOf(art.coinSheet), order.indexOf(art.welcomeSheet))).toBeLessThan(Math.min(...art.guests.map((g) => order.indexOf(g))));
});

test('+1 on the guests screen shows the new portrait at once: no new download, already loaded', async ({ page }) => {
  await slowPage(page);
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.__lpc.go(1, false));
  const after: string[] = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/art/')) after.push(new URL(r.url()).pathname); });
  for (const n of [2, 3, 4]) {
    const ready = await page.evaluate(() => {
      document.getElementById('plus')!.click();
      const img = document.querySelector<HTMLImageElement>('#portrait img')!;
      return img.complete && img.naturalWidth > 0; // checked in the same tick as the click
    });
    expect(ready, `portrait for ${n} guests`).toBe(true);
  }
  await page.waitForTimeout(400);
  expect(after).toEqual([]);
  // and going back down is as instant as before
  expect(await page.evaluate(() => { document.getElementById('minus')!.click(); const i = document.querySelector<HTMLImageElement>('#portrait img')!; return i.complete; })).toBe(true);
});
