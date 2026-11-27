// Scene 5 (delivery): layout choice, Save and Share, the saved picture, names, finishing, and starting over.
import { expect, test, type Page } from '@playwright/test';

/** Capture what the app would download instead of letting the browser save it. */
async function interceptDownloads(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __saved: { name: string; href: string }[]; __alerts: string[] };
    w.__saved = [];
    w.__alerts = [];
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        w.__saved.push({ name: this.download, href: this.href });
        return;
      }
      return click.call(this);
    };
    window.alert = (m?: unknown) => void w.__alerts.push(String(m));
  });
}

test.beforeEach(async ({ page }) => {
  await interceptDownloads(page);
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
});

const toDeliver = (page: Page, count = 2, names: string[] = ['', '', '', '']) =>
  page.evaluate(([c, n]) => { const s = window.__lpc.session; s.count = c as number; s.names = n as string[]; window.__lpc.go(5, false); }, [count, names] as const);
const saved = (page: Page) => page.evaluate(() => (window as unknown as { __saved: { name: string; href: string }[] }).__saved.map((s) => s.name));
/** Decode what Save produced: size, plus a function-free summary of its pixels. */
const savedImage = (page: Page, index = 0) =>
  page.evaluate(async (i) => {
    const s = (window as unknown as { __saved: { href: string }[] }).__saved[i]!;
    const blob = await fetch(s.href).then((r) => r.blob());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, type: blob.type, png: [...bytes.slice(0, 8)] };
  }, index);

test.describe('the screen', () => {
  test('Save replaces the email form: no inputs, no prototype note; Share is hidden when the browser cannot share files', async ({ page }) => {
    await page.addInitScript(() => {
      // Pin the "cannot share files" case, whatever the browser under test supports (Safari's engine can).
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    });
    await page.reload({ waitUntil: 'load' });
    await page.clock.pauseAt(20_000);
    await toDeliver(page);
    await expect(page.locator('#s5 h2').first()).toHaveText('Special delivery!');
    await expect(page.locator('#download')).toHaveText('Save the photos!');
    await expect(page.locator('#s5 input')).toHaveCount(0);
    await expect(page.locator('#s5')).not.toContainText('Prototype only');
    await expect(page.locator('#share')).toBeHidden();
    await expect(page.locator('#email-layout')).toBeVisible();
    await expect(page.locator('#finished')).toBeHidden();
  });

  test('the 4-strip / 2x2 buttons choose the layout', async ({ page }) => {
    await toDeliver(page);
    await expect(page.locator('[data-format="strip"]')).toHaveClass(/selected/);
    await page.click('[data-format="grid"]');
    expect(await page.evaluate(() => window.__lpc.session.format)).toBe('grid');
    await expect(page.locator('[data-format="grid"]')).toHaveClass(/selected/);
    await expect(page.locator('[data-format="grid"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-format="strip"]')).not.toHaveClass(/selected/);
  });
});

test.describe('Save', () => {
  test('downloads little-photo-club.png: a 480 x 1470 PNG for the strip, 960 x 800 for the grid', async ({ page }) => {
    await toDeliver(page);
    await page.click('#download');
    await expect.poll(() => saved(page)).toEqual(['little-photo-club.png']);
    const strip = await savedImage(page);
    expect([strip.w, strip.h, strip.type]).toEqual([480, 1470, 'image/png']);
    expect(strip.png).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); // PNG signature

    await toDeliver(page);
    await page.click('[data-format="grid"]');
    await page.click('#download');
    await expect.poll(() => saved(page).then((s) => s.length)).toBe(2);
    const grid = await savedImage(page, 1);
    expect([grid.w, grid.h]).toEqual([960, 800]);
  });

  test('the photos in the saved picture are exactly the ones Draft 27 would save', async ({ page, browser }) => {
    // Same demo photos, same layout code: compare every pixel above the footer, strip and grid.
    const ref = await browser.newPage();
    await ref.addInitScript(() => {
      (window as unknown as { __saved: string[] }).__saved = [];
      HTMLAnchorElement.prototype.click = function () { (window as unknown as { __saved: string[] }).__saved.push(this.href); };
    });
    await ref.goto('file://' + process.cwd() + '/reference/draft27.html', { waitUntil: 'load' });
    for (const fmt of ['strip', 'grid'] as const) {
      await ref.evaluate(`(async () => { count = 2; format = '${fmt}'; await downloadPhoto(); })()`); // Draft 27's own globals
      await toDeliver(page);
      if (fmt === 'grid') await page.click('[data-format="grid"]');
      await page.click('#download');
      await expect.poll(() => saved(page).then((s) => s.length)).toBe(fmt === 'strip' ? 1 : 2);
      const refUrl = (await ref.evaluate(() => (window as unknown as { __saved: string[] }).__saved.at(-1)!));
      const ourUrl = await page.evaluate((i) => (window as unknown as { __saved: { href: string }[] }).__saved[i]!.href, fmt === 'strip' ? 0 : 1);
      const ourBytes = await page.evaluate((u) => fetch(u).then((r) => r.arrayBuffer()).then((b) => [...new Uint8Array(b)]), ourUrl);
      // decode both in one page so the comparison is pixel for pixel
      const diff = await ref.evaluate(async ([a, b, limit]) => {
        const draw = async (blob: Blob) => { const bmp = await createImageBitmap(blob); const c = new OffscreenCanvas(bmp.width, bmp.height); c.getContext('2d')!.drawImage(bmp, 0, 0); return c.getContext('2d')!.getImageData(0, 0, bmp.width, limit as number).data; };
        const A = await draw(await fetch(a as string).then((r) => r.blob()));
        const B = await draw(new Blob([new Uint8Array(b as number[])], { type: 'image/png' }));
        let n = 0;
        for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) n++;
        return { n, len: A.length };
      }, [refUrl, ourBytes, fmt === 'strip' ? 1418 : 720] as const);
      expect(diff.len).toBeGreaterThan(0);
      expect(diff.n, `${fmt}: differing channel values above the footer`).toBe(0);
    }
    await ref.close();
  });

  test('without names the picture keeps Draft 27\'s height; with names it grows by one line, and the line has ink inside the margins', async ({ page }) => {
    await toDeliver(page, 3, ['Ana', 'Ben', 'Cleo', '']);
    await page.click('#download');
    await expect.poll(() => saved(page).then((s) => s.length)).toBe(1);
    const withNames = await page.evaluate(async () => {
      const s = (window as unknown as { __saved: { href: string }[] }).__saved[0]!;
      const bmp = await createImageBitmap(await fetch(s.href).then((r) => r.blob()));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      const band = g.getImageData(0, 1470, bmp.width, bmp.height - 1470).data;
      let left = bmp.width, right = 0;
      for (let i = 0; i < band.length; i += 4) if (band[i]! < 128) { const x = (i / 4) % bmp.width; left = Math.min(left, x); right = Math.max(right, x); }
      return { h: bmp.height, left, right, w: bmp.width };
    });
    expect(withNames.h).toBe(1510);
    expect(withNames.left).toBeGreaterThan(19);
    expect(withNames.right).toBeLessThan(withNames.w - 20);
    expect(withNames.right).toBeGreaterThan(withNames.left); // there is text in the names band
  });

  test('adding names leaves the photos and the brand line exactly where they were', async ({ page }) => {
    await toDeliver(page, 3);
    await page.click('#download');
    await toDeliver(page, 3, ['Ana', 'Ben', 'Cleo', '']);
    await page.click('#download');
    await expect.poll(() => saved(page).then((s) => s.length)).toBe(2);
    const same = await page.evaluate(async () => {
      const rows = async (i: number) => {
        const s = (window as unknown as { __saved: { href: string }[] }).__saved[i]!;
        const bmp = await createImageBitmap(await fetch(s.href).then((r) => r.blob()));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext('2d')!;
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, 1470).data; // everything down to Draft 27's bottom edge, brand line included
      };
      const [a, b] = [await rows(0), await rows(1)];
      return a.length === b.length && a.every((v, i) => v === b[i]);
    });
    expect(same).toBe(true);
  });

  test('very long names are shrunk or cut to fit, never run off the picture', async ({ page }) => {
    const long = 'Bartholomew Montgomery-Wellington III';
    await toDeliver(page, 4, [long, long, long, long]);
    await page.click('#download');
    await expect.poll(() => saved(page).then((s) => s.length)).toBe(1);
    const edge = await page.evaluate(async () => {
      const s = (window as unknown as { __saved: { href: string }[] }).__saved[0]!;
      const bmp = await createImageBitmap(await fetch(s.href).then((r) => r.blob()));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      const band = g.getImageData(0, 1470, bmp.width, bmp.height - 1470).data;
      let left = bmp.width, right = 0;
      for (let i = 0; i < band.length; i += 4) if (band[i]! < 128) { const x = (i / 4) % bmp.width; left = Math.min(left, x); right = Math.max(right, x); }
      return { left, right, w: bmp.width };
    });
    expect(edge.left).toBeGreaterThan(19);
    expect(edge.right).toBeLessThan(edge.w - 20);
  });

  test('a failure while building the picture says so (Draft 27\'s wording) and the buttons come back', async ({ page }) => {
    await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => cb(null); });
    await toDeliver(page);
    await page.click('#download');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __alerts: string[] }).__alerts)).toEqual(['Could not create the preview image.']);
    await expect(page.locator('#download')).toBeEnabled();
    expect(await saved(page)).toEqual([]);
    await expect(page.locator('#finished')).toBeHidden();
  });

  test('two quick clicks save once', async ({ page }) => {
    await toDeliver(page);
    await page.evaluate(() => { const b = document.getElementById('download')!; b.click(); b.click(); });
    await page.waitForTimeout(500);
    expect((await saved(page)).length).toBe(1);
  });
});

test.describe('finishing', () => {
  test('after Save the envelope closes, then "That\'s a wrap!" appears 700 ms later', async ({ page }) => {
    await toDeliver(page);
    await page.click('#download');
    await expect(page.locator('#envelope')).toHaveClass(/sent/);
    await expect(page.locator('#email-layout')).toBeVisible();
    await page.clock.runFor(600);
    await expect(page.locator('#finished')).toBeHidden();
    await page.clock.runFor(200);
    await expect(page.locator('#finished')).toBeVisible();
    await expect(page.locator('#email-layout')).toBeHidden();
    await expect(page.locator('#finished h2')).toHaveText("That's a wrap!");
  });

  test('leaving before the 700 ms are up shows nothing later', async ({ page }) => {
    await toDeliver(page);
    await page.click('#download');
    await page.evaluate(() => window.__lpc.go(1, false));
    await page.clock.runFor(2000);
    await expect(page.locator('#finished')).toBeHidden();
  });

  test('"Next guests" starts over: the coin scene, and the session is back to its defaults', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.__lpc.session;
      s.count = 3; s.names = ['Ana', 'Ben', 'Cleo', '']; s.lens = 'warp'; s.lensChoice.warp = 'wide'; s.frameOn = true; s.format = 'grid';
      window.__lpc.go(5, false);
    });
    await page.click('#download');
    await page.clock.runFor(800);
    await page.click('#restart');
    expect(await page.evaluate(() => document.body.classList.contains('coin-open'))).toBe(true);
    expect(await page.evaluate(() => {
      const s = window.__lpc.session;
      return [s.count, s.names.join('|'), s.lens, s.lensChoice.warp, s.frameOn, s.format, s.shots.length];
    })).toEqual([1, '|||', 'classic', 'bulge', false, 'strip', 0]);
  });

  test('coming back to the delivery screen starts fresh (envelope open, form visible)', async ({ page }) => {
    await toDeliver(page);
    await page.click('#download');
    await page.clock.runFor(800);
    await toDeliver(page);
    await expect(page.locator('#email-layout')).toBeVisible();
    await expect(page.locator('#finished')).toBeHidden();
    await expect(page.locator('#envelope')).not.toHaveClass(/sent/);
  });
});

test.describe('Share', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shares: { name: string; type: string; size: number }[]; __shareResult: string };
      w.__shares = [];
      w.__shareResult = 'ok';
      Object.defineProperty(navigator, 'canShare', { value: (d: ShareData) => !!d.files?.length, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (d: ShareData) => {
          w.__shares.push(...d.files!.map((f) => ({ name: f.name, type: f.type, size: f.size })));
          if (w.__shareResult === 'abort') throw new DOMException('closed', 'AbortError');
          if (w.__shareResult === 'fail') throw new DOMException('nope', 'NotAllowedError');
        },
      });
    });
    await page.reload({ waitUntil: 'load' });
    await page.clock.pauseAt(20_000);
  });
  const shares = (page: Page) => page.evaluate(() => (window as unknown as { __shares: { name: string; type: string; size: number }[] }).__shares);

  test('is offered when the browser can share files, and sends the PNG', async ({ page }) => {
    await toDeliver(page);
    await expect(page.locator('#share')).toBeVisible();
    await page.click('#share');
    await expect.poll(() => shares(page)).toHaveLength(1);
    const [file] = await shares(page);
    expect(file).toMatchObject({ name: 'little-photo-club.png', type: 'image/png' });
    expect(file!.size).toBeGreaterThan(1000);
    expect(await saved(page)).toEqual([]); // sharing is not a download
    await expect(page.locator('#envelope')).toHaveClass(/sent/);
  });

  test('closing the share sheet changes nothing: still on the screen, buttons usable', async ({ page }) => {
    await toDeliver(page);
    await page.evaluate(() => { (window as unknown as { __shareResult: string }).__shareResult = 'abort'; });
    await page.click('#share');
    await expect.poll(() => shares(page)).toHaveLength(1);
    await expect(page.locator('#envelope')).not.toHaveClass(/sent/);
    await expect(page.locator('#share')).toBeEnabled();
    await expect(page.locator('#download')).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as { __alerts: string[] }).__alerts)).toEqual([]); // closing the sheet is not an error
  });

  test('a real sharing error is reported and nothing is marked as sent', async ({ page }) => {
    await toDeliver(page);
    await page.evaluate(() => { (window as unknown as { __shareResult: string }).__shareResult = 'fail'; });
    await page.click('#share');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __alerts: string[] }).__alerts.length)).toBe(1);
    await expect(page.locator('#envelope')).not.toHaveClass(/sent/);
    await expect(page.locator('#share')).toBeEnabled();
  });
});

test.describe('names on the strip', () => {
  const reveal = async (page: Page, names: string[], count = 3) => {
    await page.evaluate(([c, n]) => { const s = window.__lpc.session; s.count = c as number; s.names = n as string[]; window.__lpc.go(4, false); }, [count, names] as const);
    await page.clock.runFor(4000);
    await page.click('#fall');
  };

  test('a second line under "little photo ✳ club" lists the named guests', async ({ page }) => {
    await reveal(page, ['Ana', 'Ben', 'Cleo', '']);
    await expect(page.locator('#photo-display .strip-footer')).toHaveText('little photo ✳ club');
    await expect(page.locator('#photo-display .strip-names')).toHaveText('Ana · Ben · Cleo');
  });

  test('nobody named: no names line at all (the strip is exactly Draft 27\'s)', async ({ page }) => {
    await reveal(page, ['', '', '', '']);
    await expect(page.locator('#photo-display .strip-names')).toHaveCount(0);
  });

  test('names are text, never markup', async ({ page }) => {
    await reveal(page, ['<img src=x onerror=alert(1)>', '', '', ''], 1);
    await expect(page.locator('#photo-display .strip-names')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(page.locator('#photo-display img')).toHaveCount(4); // only the four photos
  });

  test('a long list is cut with an ellipsis, not wrapped (the strip keeps its shape)', async ({ page }) => {
    await reveal(page, ['Bartholomew', 'Montgomery', 'Wellington', 'Christopher'], 4);
    const el = page.locator('#photo-display .strip-names');
    const { whiteSpace, overflow, textOverflow, scroll, client, height } = await el.evaluate((e) => {
      const cs = getComputedStyle(e);
      return { whiteSpace: cs.whiteSpace, overflow: cs.overflow, textOverflow: cs.textOverflow, scroll: e.scrollWidth, client: e.clientWidth, height: e.getBoundingClientRect().height };
    });
    expect([whiteSpace, overflow, textOverflow]).toEqual(['nowrap', 'hidden', 'ellipsis']);
    expect(scroll).toBeGreaterThan(client); // really too long here...
    expect(height).toBeLessThan(20); // ...and still one line
  });

  test('the names are also on the strip card in the dispenser', async ({ page }) => {
    await page.evaluate(() => { const s = window.__lpc.session; s.count = 2; s.names = ['Ana', 'Ben', '', '']; window.__lpc.go(4, false); });
    await expect(page.locator('#fall .strip-names')).toHaveText('Ana · Ben');
  });
});
