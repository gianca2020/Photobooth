// Tests that need a webcam stream (Chromium's fake device). Run by the "chromium-fake-camera" project.
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.addInitScript(() => {
    // Remember every stream the app gets so tests can check the tracks are released.
    const w = window as unknown as { __streams: MediaStream[]; __release?: () => void };
    w.__streams = [];
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await real(c);
      w.__streams.push(stream);
      return stream;
    };
  });
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
}
const goCamera = (page: Page) => page.evaluate(() => window.__lpc.go(3, false));
const tracksEnded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).every((t) => t.readyState === 'ended'));
const streamCount = (page: Page) => page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.length);

test('granted: shows live video, hides the demo art', async ({ page }) => {
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await expect(page.locator('#video')).toBeVisible();
  await expect(page.locator('#demo')).toBeHidden();
  await expect(page.locator('#webcam')).toHaveText('Use demo instead');
  await expect(page.locator('#camera-status')).toHaveText('');
  await expect(page.locator('#take')).toBeEnabled();
  expect(await tracksEnded(page)).toBe(false);
});

test('"Use demo instead" releases the camera; "Use real camera" asks again', async ({ page }) => {
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('#webcam');
  await expect(page.locator('#rec')).toHaveText('DEMO VIEW');
  expect(await tracksEnded(page)).toBe(true);
  await page.click('#webcam');
  await expect(page.locator('#rec')).toHaveText('LIVE');
  expect(await streamCount(page)).toBe(2);
});

test('leaving the scene releases the camera', async ({ page }) => {
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.evaluate(() => window.__lpc.go(1, false));
  expect(await tracksEnded(page)).toBe(true);
});

test('leaving while the permission prompt is still open never leaves the camera on', async ({ page }) => {
  await page.addInitScript(() => {
    // Hold the answer back until the test says so (like a user staring at the permission prompt).
    const w = window as unknown as { __streams: MediaStream[]; __answer: () => void };
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    w.__streams = [];
    navigator.mediaDevices.getUserMedia = (c) =>
      new Promise((resolve, reject) => {
        w.__answer = () => real(c).then((s) => { w.__streams.push(s); resolve(s); }, reject);
      });
  });
  await page.clock.install({ time: 0 });
  await page.goto('/?debug', { waitUntil: 'load' });
  await page.clock.pauseAt(10_000);
  await goCamera(page);
  await expect(page.locator('#camera-status')).toHaveText('Waiting for camera permission…');
  await page.evaluate(() => window.__lpc.go(1, false)); // guest walks away
  await page.evaluate(() => (window as unknown as { __answer: () => void }).__answer()); // ...then grants
  await expect.poll(() => streamCount(page)).toBe(1);
  await expect.poll(() => tracksEnded(page)).toBe(true);
});

test('every lens renders live video without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // MediaPipe reports an informational line through console.error; real errors still fail the test.
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('INFO:') && errors.push(m.text()));
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  for (const lens of ['flipnote', 'mischief', 'warp', 'orange', '2009', 'emoter', 'classic']) {
    await page.click(`[data-filter="${lens}"]`);
    await page.clock.runFor(300);
    if (lens === 'classic') {
      await expect(page.locator('#ink-preview')).toBeHidden();
    } else {
      await expect(page.locator('#ink-preview')).toBeVisible();
      const size = await page.evaluate(() => { const c = document.getElementById('ink-preview') as HTMLCanvasElement; return [c.width, c.height]; });
      expect(size).toEqual(lens === 'flipnote' ? [256, 192] : [640, 480]);
    }
  }
  expect(errors).toEqual([]);
});

test('tapping places a face manually; "Auto faces" clears it', async ({ page }) => {
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('[data-filter="mischief"]');
  await page.locator('#s3 .viewfinder').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('#filter-note')).toContainText('Manual placement');
  await page.click('#auto-face');
  await expect(page.locator('#filter-note')).not.toContainText('Manual placement');
});

test('tapping the viewfinder places no face while live graffiti is on (it draws instead)', async ({ page }) => {
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('[data-filter="mischief"]');
  await page.click('#live-toggle');
  await page.locator('#s3 .viewfinder').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('#filter-note')).not.toContainText('Manual placement');
  await page.click('#live-toggle'); // graffiti off: tapping aims again
  await page.locator('#s3 .viewfinder').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('#filter-note')).toContainText('Manual placement');
});

test('a live capture produces four 960x720 photos', async ({ page }) => {
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('#take');
  await page.clock.runFor(21_000);
  await expect.poll(() => page.evaluate(() => document.querySelector('.scene.active')?.id)).toBe('s4');
  const dims = await page.evaluate(async () => Promise.all(window.__lpc.session.shots.map(async (s) => {
    const b = await createImageBitmap(s!.blob);
    return [b.width, b.height];
  })));
  expect(dims).toEqual([[960, 720], [960, 720], [960, 720], [960, 720]]);
  expect(await tracksEnded(page)).toBe(true); // leaving the camera scene released it
});


// ---- face detection (3b) ------------------------------------------------------------------

const note = (page: Page) => page.locator('#filter-note');
/** Let the paused clock tick (rAF drives detection) until the note matches. */
async function tickUntilNote(page: Page, text: string, timeout = 20_000) {
  await expect
    .poll(async () => { await page.clock.runFor(250); return (await note(page).textContent()) ?? ''; }, { timeout })
    .toContain(text);
}

test('MediaPipe loads from our own domain, only once a face lens is chosen', async ({ page }) => {
  const hosts = new Set<string>();
  const paths: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); hosts.add(u.host); paths.push(u.pathname); });
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('[data-filter="flipnote"]'); // not a face lens
  await page.clock.runFor(1000);
  expect(paths.some((p) => p.includes('/models/'))).toBe(false);

  await page.click('[data-filter="mischief"]');
  await tickUntilNote(page, 'Looking for faces'); // loaded fine, the fake video just has no face
  expect(paths).toContain('/models/blaze_face_short_range.tflite');
  expect(paths).toContain('/models/mediapipe/wasm/vision_wasm_internal.wasm');
  const outside = [...hosts].filter((h) => !/^(localhost:\d+|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(h));
  expect(outside).toEqual([]);
});

test('a detected face is tracked, tapping overrides it, "Auto faces" gives control back', async ({ page }) => {
  await page.addInitScript(() => {
    // The browser's built-in detector API, stubbed: always sees one face. Exercises the whole path.
    const w = window as unknown as { FaceDetector: unknown; __detects: number };
    w.__detects = 0;
    w.FaceDetector = class {
      async detect(c: HTMLCanvasElement) {
        if (c.width === 320) w.__detects++; // real frames only, not the start-up probe
        return [{ boundingBox: { x: 110, y: 70, width: 100, height: 110 } }];
      }
    };
  });
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('[data-filter="warp"]');
  await tickUntilNote(page, '1 face tracked');
  await page.locator('#s3 .viewfinder').click({ position: { x: 150, y: 120 } });
  await expect(note(page)).toContainText('Manual placement');
  const detects = () => page.evaluate(() => (window as unknown as { __detects: number }).__detects);
  await page.clock.runFor(300);
  const before = await detects();
  await page.clock.runFor(2000);
  await expect(note(page)).toContainText('Manual placement');
  expect(await detects()).toBe(before); // no wasted detection while the guest is aiming
  await page.click('#auto-face');
  await tickUntilNote(page, '1 face tracked');
});

test('if the model cannot load: tap-to-aim message, manual placement still works, next visit retries', async ({ page }) => {
  let block = true;
  await page.route('**/models/**', (route) => (block ? route.abort() : route.continue()));
  await open(page);
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await page.click('[data-filter]:nth-child(3)'); // mischief
  await tickUntilNote(page, 'Tracking unavailable; tap to aim');
  await page.locator('#s3 .viewfinder').click({ position: { x: 150, y: 120 } });
  await expect(note(page)).toContainText('Manual placement');

  block = false; // connection is back
  await page.evaluate(() => window.__lpc.go(1, false));
  await goCamera(page);
  await expect(page.locator('#rec')).toHaveText('LIVE');
  await tickUntilNote(page, 'Looking for faces');
});
