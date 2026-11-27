# Browsers and devices

## What runs where (`playwright.config.ts`)
| Project | Engine | Runs |
|---|---|---|
| `chromium` | Chromium | everything, including the pixel parity against Draft 27, the accessibility scan, preload timing |
| `chromium-fake-camera` | Chromium + fake webcam | live camera, lenses, face detection |
| `webkit` | Safari's engine | behaviour tests (no pixel tests, no fake camera) |
| `firefox` | Firefox | behaviour tests |
| `iphone` | WebKit as an iPhone 13 (touch) | behaviour tests; opt-in: `MOBILE=1 npx playwright test` |
| `pixel` | Chromium as a Pixel 7 (touch) | behaviour tests; opt-in, same switch |

Pixel comparisons stay on Chromium on purpose: Draft 27 itself renders different frames in WebKit and Firefox than
in Chromium (see `fixes/002-safari-run-in-outline.md`), so a cross-engine pixel diff would not tell app problems
from engine differences. Camera tests need Chromium's fake
webcam flags.

## Known differences between engines
- **Safari has no canvas `filter`** (see `fixes/002-safari-run-in-outline.md`). Handled.
- Safari (and Playwright's WebKit) can share files (`navigator.canShare`), Chromium on desktop usually cannot,
  so "Share" shows up in some and not others; the tests pin both cases.
- The LIVE / DEMO VIEW tag used to catch taps meant for the drawing layer (it sits above it); it no longer does.

## Performance of the lenses
Measured per frame in Chromium on an Apple-silicon Mac, with the CPU slowed by Chrome's throttling to imitate
slower phones (a rough stand-in, not a real device). Lens math only; the frame budget is 66 ms (15 fps).

| Lens | normal | 4x slower | 6x slower |
|---|---|---|---|
| Classic | 1.2 ms | 6.1 | 9.6 |
| Flipnote | 0.3 | 1.2 | 1.9 |
| Mischief | 1.4 | 6.3 | 9.7 |
| Orange pass | 1.6 | 7.1 | 10.9 |
| Emoter | 3.2 | 12.7 | 19.3 |
| Distortion (warp) | 5.7 | 23.8 | 35.8 |
| 2009 | 6.4 | 24.5 | 36.6 |

The two heaviest lenses use about half the budget at 6x. Drawing the video into the canvas, reading and
writing the pixels, and face detection (MediaPipe, every few frames) come on top and were not measured here. If a
phone drops frames the effect loop simply runs slower; nothing breaks. Real phones still need a try.

## Not yet done
Real iPhone and Android devices. The human checklists in the PRs cover them.
