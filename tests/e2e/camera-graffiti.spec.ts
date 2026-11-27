// Live graffiti behaviour (demo mode, no webcam): drawing, erasing, stamping, undo, clear, colours,
// sizes, the stamp palette, the countdown lock, graffiti in the photos, and the reset on retake.
import { expect, test, type Page } from '@playwright/test';
import { STAMPS } from '../../app/src/graffiti/stamps';

const ORANGE = [246, 107, 0, 255];
const INK = [23, 23, 23, 255];
const WHITE = [255, 255, 255, 255];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
  await page.evaluate(() => { window.__lpc.session.count = 2; window.__lpc.go(3, false); });
  await page.clock.runFor(500);
});

/** Page coordinates of the middle of layer pixel (lx, ly). */
async function layerXY(page: Page, lx: number, ly: number): Promise<[number, number]> {
  const b = (await page.locator('#live-graffiti').boundingBox())!;
  return [b.x + ((lx + 0.5) * b.width) / 256, b.y + ((ly + 0.5) * b.height) / 192];
}
const tap = async (page: Page, lx: number, ly: number) => page.mouse.click(...(await layerXY(page, lx, ly)));
async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...(await layerXY(page, ...from)));
  await page.mouse.down();
  await page.mouse.move(...(await layerXY(page, ...to)), { steps: 8 });
  await page.mouse.up();
}
/** RGBA of one layer pixel. */
const pixel = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const c = document.getElementById('live-graffiti') as HTMLCanvasElement;
    return [...c.getContext('2d')!.getImageData(px!, py!, 1, 1).data];
  }, [x, y]);
const inked = (page: Page) =>
  page.evaluate(() => {
    const c = document.getElementById('live-graffiti') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, 256, 192).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
const pressed = (page: Page, sel: string) => page.locator(sel).getAttribute('aria-pressed');
const on = (page: Page) => page.click('#live-toggle');

test('starts off; the Graffiti button opens the tools and closes them again', async ({ page }) => {
  await expect(page.locator('#live-options')).toBeHidden();
  expect(await pressed(page, '#live-toggle')).toBe('false');
  await on(page);
  await expect(page.locator('#live-options')).toBeVisible();
  expect(await pressed(page, '#live-toggle')).toBe('true');
  await expect(page.locator('#s3 .viewfinder')).toHaveClass(/live-drawing/);
  expect(await pressed(page, '#live-stamps')).toBe('true'); // Draft 27 starts on the heart stamp
  await expect(page.locator('#live-undo')).toBeDisabled();
  await on(page);
  await expect(page.locator('#live-options')).toBeHidden();
  await expect(page.locator('#s3 .viewfinder')).not.toHaveClass(/live-drawing/);
});

test('with graffiti on, nothing covers the drawing layer: every point of it receives the pointer', async ({ page }) => {
  await on(page);
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    const covered = await page.evaluate(() => {
      const c = document.getElementById('live-graffiti')!;
      const r = c.getBoundingClientRect();
      const blockers: string[] = [];
      for (let fx = 0.01; fx < 1; fx += 0.04) for (let fy = 0.01; fy < 1; fy += 0.04) {
        const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy)!;
        if (e !== c) blockers.push(`${e.tagName}#${e.id}`);
      }
      return blockers;
    });
    expect(covered, `${vp.width}px wide`).toEqual([]);
  }
});

test('with graffiti off the canvas ignores the mouse', async ({ page }) => {
  await tap(page, 100, 100);
  expect(await inked(page)).toBe(0);
});

test('pen draws a stroke in the chosen colour; each colour button works', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  expect(await pressed(page, '#live-pen')).toBe('true');
  expect(await pressed(page, '#live-stamps')).toBe('false');
  await drag(page, [40, 50], [120, 50]);
  expect(await pixel(page, 40, 50)).toEqual(INK); // default colour
  expect(await pixel(page, 80, 50)).toEqual(INK);
  expect(await pixel(page, 120, 50)).toEqual(INK);
  expect(await pixel(page, 80, 80)).toEqual([0, 0, 0, 0]);

  await page.click('[data-livecolor="#f66b00"]');
  expect(await pressed(page, '[data-livecolor="#f66b00"]')).toBe('true');
  expect(await pressed(page, '[data-livecolor="#171717"]')).toBe('false');
  await drag(page, [40, 90], [120, 90]);
  expect(await pixel(page, 80, 90)).toEqual(ORANGE);
  await page.click('[data-livecolor="#ffffff"]');
  await drag(page, [40, 130], [120, 130]);
  expect(await pixel(page, 80, 130)).toEqual(WHITE);
});

test('size S / M / L makes the pen dot 2, 4 and 6 pixels square', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  for (const [value, side] of [['2', 2], ['4', 4], ['6', 6]] as const) {
    await page.selectOption('#live-size', value);
    await page.click('#live-clear');
    await tap(page, 100, 100);
    expect(await inked(page)).toBe(side * side);
  }
});

test('eraser punches a hole three times the pen size, and only where you drag', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await page.selectOption('#live-size', '6');
  await drag(page, [20, 100], [200, 100]); // a thick bar
  const before = await inked(page);
  await page.click('#live-eraser');
  expect(await pressed(page, '#live-eraser')).toBe('true');
  expect(await pressed(page, '#live-pen')).toBe('false');
  await tap(page, 100, 100);
  // The hole is 18 px wide (3 x the pen) and as tall as the 6 px bar. Where exactly it lands can be one layer
  // pixel off on a phone-sized canvas (a tap is rounded to whole screen pixels), so find it instead of assuming.
  const hole = await page.evaluate(() => {
    const d = (document.getElementById('live-graffiti') as HTMLCanvasElement).getContext('2d')!.getImageData(0, 100, 256, 1).data;
    let left = -1, right = -1;
    for (let x = 21; x < 199; x++) if (d[x * 4 + 3] === 0) { if (left < 0) left = x; right = x; }
    return { left, right };
  });
  expect(hole.right - hole.left + 1).toBe(18);
  expect(Math.abs((hole.left + hole.right) / 2 - 100)).toBeLessThanOrEqual(1.5);
  expect(before - (await inked(page))).toBe(18 * 6); // the bar is 6 tall: 18 wide x 6 tall removed
});

test('stamp palette: opens, closes on pick, marks the chosen stamp, stamps its bitmap', async ({ page }) => {
  await on(page);
  await expect(page.locator('#live-palette')).toBeHidden();
  await page.click('#live-stamps');
  await expect(page.locator('#live-palette')).toBeVisible();
  expect(await page.locator('#live-stamps').getAttribute('aria-expanded')).toBe('true');
  await page.click('#live-stamps');
  await expect(page.locator('#live-palette')).toBeHidden();
  expect(await page.locator('#live-stamps').getAttribute('aria-expanded')).toBe('false');

  await page.click('#live-stamps');
  await page.click('[data-livestamp="bolt"]');
  await expect(page.locator('#live-palette')).toBeHidden();
  expect(await pressed(page, '[data-livestamp="bolt"]')).toBe('true');
  expect(await pressed(page, '[data-livestamp="heart"]')).toBe('false');
  await page.selectOption('#live-size', '4');
  await tap(page, 128, 96);
  const cells = STAMPS.bolt.join('').replaceAll('0', '').length;
  expect(await inked(page)).toBe(cells * 16);
});

test('stamp size S still stamps 2-pixel cells; the stamp is centred on the click', async ({ page }) => {
  await on(page);
  await page.selectOption('#live-size', '2');
  await tap(page, 128, 96);
  const cells = STAMPS.heart.join('').replaceAll('0', '').length;
  expect(await inked(page)).toBe(cells * 4);
  // heart is 9x8 cells of 2 px: spans x 119..136, y 88..103; its middle column's top row (cell 4,7) is blank
  expect(await pixel(page, 128, 99)).toEqual(INK);
  expect(await pixel(page, 118, 96)).toEqual([0, 0, 0, 0]);
});

test('choosing the pen or eraser closes the palette; Stamps goes back to a stamp', async ({ page }) => {
  await on(page);
  await page.click('#live-stamps');
  await page.click('#live-pen');
  await expect(page.locator('#live-palette')).toBeHidden();
  await page.click('#live-stamps'); // palette opens, tool turns back into the heart
  await expect(page.locator('#live-palette')).toBeVisible();
  expect(await pressed(page, '[data-livestamp="heart"]')).toBe('true');
  expect(await pressed(page, '#live-pen')).toBe('false');
  await page.click('#live-eraser');
  await expect(page.locator('#live-palette')).toBeHidden();
  expect(await pressed(page, '#live-eraser')).toBe('true');
});

test('undo steps back one mark at a time and disables itself when there is nothing left', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await page.selectOption('#live-size', '6');
  await tap(page, 50, 50);
  await tap(page, 150, 50);
  await expect(page.locator('#live-undo')).toBeEnabled();
  await page.click('#live-undo');
  expect(await pixel(page, 50, 50)).toEqual(INK);
  expect(await pixel(page, 150, 50)).toEqual([0, 0, 0, 0]);
  await page.click('#live-undo');
  expect(await inked(page)).toBe(0);
  await expect(page.locator('#live-undo')).toBeDisabled();
});

test('undo remembers the last 25 marks and no more', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await page.selectOption('#live-size', '2');
  for (let i = 0; i < 30; i++) await tap(page, 10 + i * 8, 20); // 30 separate dots
  expect(await inked(page)).toBe(30 * 4);
  for (let i = 0; i < 25; i++) {
    await expect(page.locator('#live-undo')).toBeEnabled();
    await page.click('#live-undo');
  }
  await expect(page.locator('#live-undo')).toBeDisabled();
  expect(await inked(page)).toBe(5 * 4); // the first five dots can no longer be undone
});

test('Clear wipes the layer and can itself be undone', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await drag(page, [30, 30], [200, 150]);
  const drawn = await inked(page);
  expect(drawn).toBeGreaterThan(0);
  await page.click('#live-clear');
  expect(await inked(page)).toBe(0);
  await page.click('#live-undo');
  expect(await inked(page)).toBe(drawn);
});

test('a drag that leaves the canvas is clamped to its edge', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await page.selectOption('#live-size', '2');
  const b = (await page.locator('#live-graffiti').boundingBox())!;
  await page.mouse.move(b.x + 5, b.y + 5);
  await page.mouse.down();
  await page.mouse.move(b.x - 200, b.y + 5); // far outside, left
  await page.mouse.up();
  expect(await pixel(page, 0, 2)).toEqual(INK); // clamped to the left edge
});

test('drawing is locked while the countdown runs', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await tap(page, 60, 60);
  const before = await inked(page);
  await page.click('#take');
  await page.clock.runFor(500);
  await tap(page, 150, 100);
  await drag(page, [20, 150], [100, 150]);
  expect(await inked(page)).toBe(before);
  await page.evaluate(() => (document.getElementById('live-toggle') as HTMLElement).click());
  expect(await pressed(page, '#live-toggle')).toBe('true'); // the toggle ignores clicks too
});

test('a stroke that is in progress when the countdown starts stops painting', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await page.selectOption('#live-size', '2');
  await page.mouse.move(...(await layerXY(page, 20, 20)));
  await page.mouse.down();
  await page.mouse.move(...(await layerXY(page, 40, 20)));
  await page.evaluate(() => (document.getElementById('take') as HTMLElement).click());
  const before = await inked(page);
  await page.mouse.move(...(await layerXY(page, 120, 20)), { steps: 4 });
  await page.mouse.up();
  expect(await inked(page)).toBe(before);
});

test('graffiti is part of all four photos, and a retake starts with a clean layer', async ({ page }) => {
  await on(page);
  await page.click('#live-pen');
  await page.selectOption('#live-size', '6');
  await page.click('[data-livecolor="#f66b00"]');
  await drag(page, [60, 90], [200, 90]);
  await page.click('[data-livecolor="#ffffff"]');
  await page.click('#live-stamps');
  await page.click('[data-livestamp="star"]');
  await tap(page, 128, 150);

  await page.click('#take');
  await page.clock.runFor(21_000);
  await expect.poll(() => page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s4');

  // The pen stroke sits at layer (128, 90) -> photo (480+, 337+) at 3.75x.
  const photos = await page.evaluate(async () => {
    const out: number[][] = [];
    for (const s of window.__lpc.session.shots) {
      const bmp = await createImageBitmap(s!.blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      out.push([...g.getImageData(480, 340, 1, 1).data]);
    }
    return out;
  });
  expect(photos).toEqual([ORANGE, ORANGE, ORANGE, ORANGE]);

  // Retake: back to the camera scene. Draft 27 resets everything about the layer.
  await page.evaluate(() => window.__lpc.go(3, false));
  await page.clock.runFor(500);
  expect(await inked(page)).toBe(0);
  expect(await pressed(page, '#live-toggle')).toBe('false');
  await expect(page.locator('#live-options')).toBeHidden();
  await expect(page.locator('#live-palette')).toBeHidden();
  await expect(page.locator('#live-undo')).toBeDisabled();
  expect(await pressed(page, '[data-livestamp="heart"]')).toBe('true'); // tool back to the heart
  expect(await pressed(page, '[data-livecolor="#171717"]')).toBe('true'); // colour back to black
  await expect(page.locator('#s3 .viewfinder')).not.toHaveClass(/live-drawing/);
  expect(await page.evaluate(() => (document.getElementById('live-size') as HTMLSelectElement).value)).toBe('6'); // Draft 27 keeps the size
  await on(page);
  await tap(page, 128, 150); // old undo history is gone: undo stays disabled until something new is drawn
  await expect(page.locator('#live-undo')).toBeEnabled();
  await page.click('#live-undo');
  await expect(page.locator('#live-undo')).toBeDisabled();
});
