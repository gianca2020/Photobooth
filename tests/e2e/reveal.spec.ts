// Scene 4 behaviour (demo mode, no webcam): the dispenser timeline and its sound, picking up the strip,
// keep / retake, and the post-capture graffiti editor.
import { expect, test, type Page } from '@playwright/test';
import { STAMPS } from '../../app/src/graffiti/stamps';

/** Count what the audio engine plays and stops, and every object URL made / revoked. */
function instrument(): void {
  const w = window as unknown as { __snd: { starts: number; stops: number }; __urls: { made: Set<string>; revoked: Set<string> }; __slowBlob?: { held: (() => void)[] } };
  w.__snd = { starts: 0, stops: 0 };
  const start = AudioBufferSourceNode.prototype.start;
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...a) { w.__snd.starts++; return start.apply(this, a as []); };
  AudioBufferSourceNode.prototype.stop = function (...a) { w.__snd.stops++; return stop.apply(this, a as []); };
  w.__urls = { made: new Set(), revoked: new Set() };
  const make = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (o) => { const u = make(o); w.__urls.made.add(u); return u; };
  URL.revokeObjectURL = (u) => { w.__urls.revoked.add(u); revoke(u); };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(instrument);
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
});

const sound = (page: Page) => page.evaluate(() => (window as unknown as { __snd: { starts: number; stops: number } }).__snd);
const card = (page: Page) => page.locator('#fall');
const toReveal = (page: Page, animate: boolean, count = 2) =>
  page.evaluate(([a, c]) => { window.__lpc.session.count = c as number; window.__lpc.go(4, a as boolean); }, [animate, count]);
/**
 * Click, and keep clicking until `until` holds, like a person tapping again. On a loaded machine a button can still
 * be sliding into place (the layout changes when the editor or the decision opens), and a press that starts on one
 * spot and ends on another is not a click.
 */
async function clickUntil(page: Page, selector: string, until: () => Promise<void>) {
  await expect(async () => {
    await page.click(selector, { timeout: 5_000 });
    await until();
  }).toPass({ timeout: 20_000, intervals: [100, 300, 600] });
}
const shown = (page: Page, sel: string) => () => expect(page.locator(sel)).toBeVisible({ timeout: 1_500 });
const sceneIs = (page: Page, id: string) => () => expect.poll(() => page.evaluate(() => document.querySelector('.scene.active')?.id), { timeout: 1_500 }).toBe(id);

/** Print finishes 3 s after it starts (650 ms later when sliding in); run past that and pick up the strip. */
async function printAndPickUp(page: Page) {
  await page.clock.runFor(4000);
  await page.click('#fall');
}

test.describe('dispenser', () => {
  test('the strip is not clickable while printing, and says so; it is when it has landed', async ({ page }) => {
    await toReveal(page, false);
    await expect(card(page)).toBeDisabled();
    await expect(card(page)).toHaveAttribute('aria-label', 'Printing your photo strip, little photo club');
    await page.clock.runFor(2900);
    await expect(card(page)).toBeDisabled(); // 36 frames = 3 s
    await page.clock.runFor(200);
    await expect(card(page)).toBeEnabled();
    await expect(card(page)).toHaveAttribute('aria-label', 'Pick up your photo strip, little photo club');
  });

  test('sliding in waits 650 ms before printing; the foley starts with the first frame, not before', async ({ page }) => {
    await toReveal(page, true);
    await page.clock.runFor(500);
    expect((await sound(page)).starts).toBe(0);
    await page.clock.runFor(300);
    expect((await sound(page)).starts).toBe(1);
    await page.clock.runFor(2700);
    await expect(card(page)).toBeDisabled(); // 650 + 3000 ms
    await page.clock.runFor(500);
    await expect(card(page)).toBeEnabled();
  });

  test('leaving the scene mid-print stops the sound and the timeline', async ({ page }) => {
    await toReveal(page, false);
    await page.clock.runFor(1000);
    expect((await sound(page)).starts).toBe(1);
    await page.evaluate(() => window.__lpc.go(1, false));
    expect((await sound(page)).stops).toBe(1);
    await page.clock.runFor(5000);
    expect((await sound(page)).starts).toBe(1); // nothing restarted
    await expect(card(page)).toBeDisabled(); // the stale timeline did not "land" the card
  });

  test('with the sound off the dispenser is silent', async ({ page }) => {
    await page.evaluate(() => document.getElementById('sound')!.click());
    await toReveal(page, false);
    await page.clock.runFor(4000);
    expect((await sound(page)).starts).toBe(0);
    await expect(card(page)).toBeEnabled();
  });

  test('reduced motion: the strip has already landed, no animation, no sound', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(instrument);
    await page.clock.install({ time: 0 });
    await page.goto('/?debug', { waitUntil: 'load' });
    await page.clock.pauseAt(10_000);
    await toReveal(page, true);
    await expect(card(page)).toBeEnabled();
    expect((await sound(page)).starts).toBe(0);
    await ctx.close();
  });

  test('printing again (retake and back) starts a fresh timeline', async ({ page }) => {
    await toReveal(page, false);
    await page.clock.runFor(4000);
    await toReveal(page, false);
    await expect(card(page)).toBeDisabled();
    await page.clock.runFor(1000);
    expect((await sound(page)).starts).toBe(2);
  });
});

test.describe('reveal and decision', () => {
  test('picking up the strip shows the four demo photos in the full reveal', async ({ page }) => {
    await toReveal(page, false);
    await printAndPickUp(page);
    await expect(page.locator('#drop-area')).toBeHidden();
    await expect(page.locator('#reveal-full')).toBeVisible();
    await expect(page.locator('#photo-display .shot img')).toHaveCount(4);
    await expect(page.locator('#photo-display .shot img').first()).toHaveAttribute('alt', 'Demo photo 1');
    await expect(page.locator('#photo-display .strip-footer')).toHaveText('little photo ✳ club');
    expect(await page.evaluate(() => window.__lpc.session.format)).toBe('strip');
  });

  test('picking up always shows the 4-strip, even if the last visit ended on the 2x2 grid', async ({ page }) => {
    await page.evaluate(() => { window.__lpc.session.format = 'grid'; });
    await toReveal(page, false);
    await printAndPickUp(page);
    await expect(page.locator('#photo-display .photo-strip')).not.toHaveClass(/grid/);
    expect(await page.evaluate(() => window.__lpc.session.format)).toBe('strip');
  });

  test('captured photos (not the demo art) are what the reveal shows', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      window.__lpc.session.count = 1;
      window.__lpc.go(3, false);
    });
    await page.click('#take');
    await page.clock.runFor(21_000);
    await expect.poll(() => page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s4');
    await printAndPickUp(page);
    const imgs = page.locator('#photo-display .shot img');
    await expect(imgs.first()).toHaveAttribute('alt', 'Photo 1');
    expect(await imgs.first().getAttribute('src')).toMatch(/^blob:/);
  });

  test('"Next step" opens Keep it / Retake and hides the arrow', async ({ page }) => {
    await toReveal(page, false);
    await printAndPickUp(page);
    await expect(page.locator('#decision')).toBeHidden();
    await clickUntil(page, '#review-next', shown(page, '#decision'));
    await expect(page.locator('#decision')).toBeVisible();
    await expect(page.locator('#review-next')).toBeHidden();
    await expect(page.locator('#reveal-full')).toHaveClass(/deciding/);
    await expect(page.locator('#send-next')).toBeFocused();
  });

  test('Keep it goes to delivery; Retake goes back to the camera and clears the photos', async ({ page }) => {
    await toReveal(page, false);
    await printAndPickUp(page);
    await clickUntil(page, '#review-next', shown(page, '#decision'));
    await clickUntil(page, '#send-next', sceneIs(page, 's5'));
    expect(await page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s5');

    await toReveal(page, false);
    await printAndPickUp(page);
    await clickUntil(page, '#review-next', shown(page, '#decision'));
    await clickUntil(page, '#retake', sceneIs(page, 's3'));
    expect(await page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s3');
    expect(await page.evaluate(() => window.__lpc.session.shots.length)).toBe(0);
  });

  test('coming back to the dispenser resets the reveal (decision closed, strip printing again)', async ({ page }) => {
    await toReveal(page, false);
    await printAndPickUp(page);
    await clickUntil(page, '#review-next', shown(page, '#decision'));
    await toReveal(page, false);
    await expect(page.locator('#reveal-full')).toBeHidden();
    await expect(page.locator('#decision')).toBeHidden();
    await expect(page.locator('#review-next')).not.toHaveClass(/hidden/); // ready for the next visit (its parent is hidden until pickup)
    await expect(page.locator('#drop-area')).toBeVisible();
  });
});

// ---- the graffiti editor ---------------------------------------------------------------------

async function openEditor(page: Page) {
  await toReveal(page, false);
  await printAndPickUp(page);
  await clickUntil(page, '#graffiti-open', shown(page, '#graffiti-editor'));
  await page.waitForTimeout(600); // the dialog slides in on real time; wait so the canvas stops moving
}
const inkXY = async (page: Page, lx: number, ly: number): Promise<[number, number]> => {
  const b = (await page.locator('#graffiti-ink').boundingBox())!;
  return [b.x + ((lx + 0.5) * b.width) / 256, b.y + ((ly + 0.5) * b.height) / 192];
};
const tap = async (page: Page, lx: number, ly: number) => page.mouse.click(...(await inkXY(page, lx, ly)));
const inked = (page: Page) =>
  page.evaluate(() => {
    const d = (document.getElementById('graffiti-ink') as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 256, 192).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
const px = (page: Page, x: number, y: number) =>
  page.evaluate(([a, b]) => [...(document.getElementById('graffiti-ink') as HTMLCanvasElement).getContext('2d')!.getImageData(a!, b!, 1, 1).data], [x, y]);
const pressed = (page: Page, sel: string) => page.locator(sel).getAttribute('aria-pressed');

test.describe('graffiti editor', () => {
  test('opens with the four photo tabs, the pen and black ink; focus goes to the first tab', async ({ page }) => {
    await openEditor(page);
    await expect(page.locator('#graffiti-editor')).toBeVisible();
    await expect(page.locator('[data-gphoto]')).toHaveCount(4);
    expect(await pressed(page, '[data-gphoto="0"]')).toBe('true');
    expect(await pressed(page, '[data-gtool="pen"]')).toBe('true');
    expect(await pressed(page, '[data-gcolor="#171717"]')).toBe('true');
    await expect(page.locator('#graffiti-undo')).toBeDisabled();
    await expect(page.locator('[data-gphoto="0"]')).toBeFocused();
    await expect(page.locator('#graffiti-base')).toHaveAttribute('src', /demo-2-0/);
  });

  test('pen draws in the chosen colour; size S/M/L; the eraser is three times as big', async ({ page }) => {
    await openEditor(page);
    await page.click('[data-gcolor="#f66b00"]');
    await page.selectOption('#graffiti-size', '7');
    await tap(page, 100, 100);
    expect(await inked(page)).toBe(49);
    expect(await px(page, 100, 100)).toEqual([246, 107, 0, 255]);
    await page.click('[data-gtool="eraser"]');
    await tap(page, 100, 100);
    expect(await inked(page)).toBe(0);
    expect(await pressed(page, '[data-gtool="eraser"]')).toBe('true');
    await page.click('[data-gcolor="#ffffff"]'); // picking a colour switches the eraser back to the pen
    expect(await pressed(page, '[data-gtool="pen"]')).toBe('true');
  });

  test('stamp palette: opens, a pick closes it and marks the stamp, the stamp is drawn at the tap', async ({ page }) => {
    await openEditor(page);
    await expect(page.locator('#post-palette')).toBeHidden();
    await page.click('#post-stamps');
    await expect(page.locator('#post-palette')).toBeVisible();
    await page.click('#post-stamps');
    await expect(page.locator('#post-palette')).toBeHidden();
    await page.click('#post-stamps');
    await page.click('[data-poststamp="bolt"]');
    await expect(page.locator('#post-palette')).toBeHidden();
    expect(await pressed(page, '[data-poststamp="bolt"]')).toBe('true');
    await page.selectOption('#graffiti-size', '4');
    await tap(page, 128, 96);
    const cells = STAMPS.bolt.join('').replaceAll('0', '').length;
    expect(await inked(page)).toBe(cells * 16);
  });

  test('undo steps back mark by mark; clear wipes and can be undone; undo disables when empty', async ({ page }) => {
    await openEditor(page);
    await page.selectOption('#graffiti-size', '7');
    await tap(page, 50, 50);
    await tap(page, 150, 50);
    await page.click('#graffiti-undo');
    expect(await px(page, 150, 50)).toEqual([0, 0, 0, 0]);
    expect(await px(page, 50, 50)).toEqual([23, 23, 23, 255]);
    await page.click('#graffiti-clear');
    expect(await inked(page)).toBe(0);
    await page.click('#graffiti-undo');
    expect(await px(page, 50, 50)).toEqual([23, 23, 23, 255]);
    await page.click('#graffiti-undo');
    await expect(page.locator('#graffiti-undo')).toBeDisabled();
  });

  test('undo remembers 35 marks', async ({ page }) => {
    await openEditor(page);
    await page.selectOption('#graffiti-size', '2');
    for (let i = 0; i < 40; i++) await tap(page, 5 + i * 6, 20);
    for (let i = 0; i < 35; i++) await page.click('#graffiti-undo');
    await expect(page.locator('#graffiti-undo')).toBeDisabled();
    expect(await inked(page)).toBe(5 * 4);
  });

  test('each photo has its own drawing and its own undo history', async ({ page }) => {
    await openEditor(page);
    await page.selectOption('#graffiti-size', '7');
    await tap(page, 60, 60);
    await page.click('[data-gphoto="1"]');
    expect(await pressed(page, '[data-gphoto="1"]')).toBe('true');
    expect(await inked(page)).toBe(0);
    await expect(page.locator('#graffiti-undo')).toBeDisabled(); // photo 1's mark is not photo 2's history
    await tap(page, 120, 120);
    await page.click('[data-gphoto="0"]');
    expect(await px(page, 60, 60)).toEqual([23, 23, 23, 255]);
    expect(await px(page, 120, 120)).toEqual([0, 0, 0, 0]);
    await expect(page.locator('#graffiti-undo')).toBeEnabled(); // photo 1 can still undo its mark
    await expect(page.locator('#graffiti-base')).toHaveAttribute('src', /demo-2-0/);
  });

  test('Cancel and Escape close without applying anything', async ({ page }) => {
    await openEditor(page);
    await tap(page, 60, 60);
    await page.click('#graffiti-cancel');
    await expect(page.locator('#graffiti-editor')).toBeHidden();
    await expect(page.locator('#graffiti-open')).toBeFocused();
    expect(await page.evaluate(() => window.__lpc.session.shots.filter(Boolean).length)).toBe(0);
    await clickUntil(page, '#graffiti-open', shown(page, '#graffiti-editor'));
    await page.waitForTimeout(600);
    expect(await inked(page)).toBe(0); // reopening starts clean
    await page.keyboard.press('Escape');
    await expect(page.locator('#graffiti-editor')).toBeHidden();
  });

  test('Done bakes only the photos that were drawn on, at the photo\'s own size, and refreshes the strip', async ({ page }) => {
    await openEditor(page);
    await page.click('[data-gcolor="#f66b00"]');
    await page.selectOption('#graffiti-size', '7');
    await tap(page, 128, 96); // photo 1
    await page.click('[data-gphoto="2"]');
    await tap(page, 30, 30); // photo 3
    await page.click('#graffiti-done');
    await expect(page.locator('#graffiti-editor')).toBeHidden();
    const info = await page.evaluate(async () => {
      const shots = window.__lpc.session.shots;
      return Promise.all(shots.map(async (s) => {
        if (!s) return null;
        const b = await createImageBitmap(s.blob);
        const c = new OffscreenCanvas(b.width, b.height);
        const g = c.getContext('2d')!;
        g.drawImage(b, 0, 0);
        return { w: b.width, h: b.height, type: s.blob.type, centre: [...g.getImageData(Math.floor(b.width / 2), Math.floor(b.height / 2), 1, 1).data] };
      }));
    });
    expect(info.map((i) => !!i)).toEqual([true, false, true, false]);
    expect(info[0]!.type).toBe('image/png');
    expect(info[0]!.centre).toEqual([246, 107, 0, 255]);
    const imgs = page.locator('#photo-display .shot img');
    await expect(imgs.nth(0)).toHaveAttribute('alt', 'Photo 1');
    await expect(imgs.nth(1)).toHaveAttribute('alt', 'Demo photo 2');
    await expect(imgs.nth(2)).toHaveAttribute('alt', 'Photo 3');
  });

  test('Done with nothing drawn changes no photo', async ({ page }) => {
    await openEditor(page);
    await page.click('#graffiti-done');
    await expect(page.locator('#graffiti-editor')).toBeHidden();
    expect(await page.evaluate(() => window.__lpc.session.shots.filter(Boolean).length)).toBe(0);
  });

  test('baking a second time replaces and releases the first baked photo', async ({ page }) => {
    await openEditor(page);
    await tap(page, 60, 60);
    await page.click('#graffiti-done');
    await expect(page.locator('#graffiti-editor')).toBeHidden();
    const first = await page.evaluate(() => window.__lpc.session.shots[0]!.url);
    await clickUntil(page, '#graffiti-open', shown(page, '#graffiti-editor'));
    await page.waitForTimeout(600);
    await tap(page, 100, 100);
    await page.click('#graffiti-done');
    await expect(page.locator('#graffiti-editor')).toBeHidden();
    const now = await page.evaluate(() => window.__lpc.session.shots[0]!.url);
    expect(now).not.toBe(first);
    expect(await page.evaluate((u) => fetch(u).then(() => true, () => false), first)).toBe(false);
    // every URL the app made is either still in use (the 4 session photos) or has been revoked
    const live = await page.evaluate(() => {
      const u = (window as unknown as { __urls: { made: Set<string>; revoked: Set<string> } }).__urls;
      return [...u.made].filter((x) => !u.revoked.has(x)).length;
    });
    expect(live).toBe(1); // only the second bake of photo 1 is alive; the first was released, the other photos are demo art
  });

  test('leaving the scene while the doodles are being applied drops the result and leaks nothing', async ({ page }) => {
    await page.addInitScript(() => {
      // Hold every toBlob back until released, so the test can leave while Done is still working.
      const w = window as unknown as { __held: (() => void)[]; __release: () => void };
      w.__held = [];
      const real = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
        w.__held.push(() => real.call(this, cb, ...rest));
      };
      w.__release = () => w.__held.splice(0).forEach((f) => f());
    });
    await page.reload({ waitUntil: 'load' });
    await page.clock.pauseAt(20_000);
    await openEditor(page);
    await tap(page, 60, 60);
    await page.click('#graffiti-done');
    await expect(page.locator('#graffiti-status')).toHaveText('Applying your doodles…');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __held: unknown[] }).__held.length)).toBe(1);
    await page.evaluate(() => window.__lpc.go(1, false)); // the guest walks away
    await page.evaluate(() => (window as unknown as { __release: () => void }).__release());
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__lpc.session.shots.filter(Boolean).length)).toBe(0);
    const leaked = await page.evaluate(() => {
      const u = (window as unknown as { __urls: { made: Set<string>; revoked: Set<string> } }).__urls;
      return [...u.made].filter((x) => !u.revoked.has(x)).length;
    });
    expect(leaked).toBe(0);
  });
});
