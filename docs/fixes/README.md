# How we fix things

Little Photo Club is a port of a finished design (`reference/draft27.html`). That shapes how fixes are
made here: **Draft 27 is the reference, the look never changes by accident, and "better" has to be
measured, not felt.** This folder records the method and one write-up per fix, so the next fix (and the
next person) doesn't start from zero.

## The method

1. **Reproduce with real data.** Get the actual failing case (a screenshot, a recording, a log), not a
   description of it. Prefer measuring with the app's own code over guessing from a picture.
2. **Ask whether Draft 27 does the same.** Run `reference/draft27.html` on the same input
   (`tools/compare-with-draft27.mjs`). If Draft 27 behaves the same, it is not a regression, it is
   inherited design, and changing it needs the owner's sign-off. If Draft 27 is right and we are wrong,
   it is a bug and the fix restores Draft 27.
3. **Find the cause in numbers.** Put measured values next to the code's constants
   (`tools/probe-face.mjs` prints face-box ratios). A cause you can state as numbers can be tested.
4. **Smallest change that fixes the cause.** Keep what Draft 27 gets right exactly as it was: the demo
   art, the shapes, the old code path for inputs the fix doesn't apply to. A fallback to the old
   behaviour is cheaper than a regression.
5. **Test the fix, then try to break the test.**
   - unit tests with real measured values, not invented ones;
   - an end-to-end test through the real pipeline where a fake can stand in for the part that cannot be
     faked (the fake webcam has no face, so a stubbed detector supplies landmarks);
   - the existing Draft 27 golden and pixel-parity tests must pass **unchanged**;
   - **mutation check**: deliberately break each important line, confirm a test fails, restore. A test
     that survives a mutant is too loose (this has happened: see `001-accessory-placement.md`).
6. **One PR per fix, cut from the latest `origin/main`.** Description: what changed, automated checks,
   honest limits, and a human-testing checklist for what automation cannot see (real faces, real phones).
7. **Say what was not tested.** Never present a measurement from one face as a general truth.
8. **Merge only on the owner's explicit say-so.** Branches are deleted automatically on merge.

## Fixes

| # | Fix | Issue / PR |
|---|---|---|
| 001 | [Mischief accessories placed from eyes, nose and mouth](001-accessory-placement.md) | issue #6, PR #8 |

## Tools

Both need the dev server (`npx vite --port 5391 --strictPort`; port 5391 because 5173 is another project's)
and Node 22. They use only the repo's own dependencies. Do not commit photos of real people.

- `tools/probe-face.mjs <image>...`: runs the face model on still images, prints box and
  eye/nose/mouth ratios.
- `tools/compare-with-draft27.mjs <face.y4m> [outDir] [variant]`: shows the same face video through
  Draft 27 and the app, side by side, via Chromium's fake webcam.
