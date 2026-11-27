# 002: the runner's white doorway outline did not work in Safari

Found in Phase 8 by running the behaviour tests on WebKit (Safari's engine). Not reported by anyone: Safari
was never tried before.

## Symptom
In the run-in scene, once a guest reaches the booth door, Draft 27 draws them clipped to the dark opening
with a one-pixel white outline. Draft 27 builds the outline with the canvas `filter` property
(`brightness(0) invert(1)`), which makes a white silhouette. **Safari's canvas ignores `filter`**: the
property is accepted and does nothing, so the "silhouette" was four offset copies of the coloured sprite.

## How it was found
`tools`-style probe in all three engines: set `filter = 'brightness(0)'`, fill red, read the pixel.
Chromium and Firefox gave black; WebKit gave red and `'filter' in ctx` was `false`.

## The fix
`whiteSilhouette()` in `engine/sprites.ts` builds the same silhouette from compositing, which every browser has:
draw the sprite, then `source-in` fill with white (colour becomes white, transparency stays).
`scenes/run.ts` keeps Draft 27's `filter` path **wherever the browser has it** and uses the silhouette only
where it does not. So Chrome and Firefox render exactly what they always did, and Safari gets the fix.

Why not one path for everyone: the silhouette is byte-identical to the filter in Chromium (all 100 frames of a
3-guest run-in), but Firefox's own filter rounds a few antialiased edge pixels differently (2 pixels, at most
13/255, in one frame). Tiny, but "pixel-identical to Draft 27" is the rule, so the engines that were already
right keep their original path.

## Tests
- `silhouette.spec.ts`, all engines: the silhouette is solid white wherever the sprite has pixels, same
  transparency, for every runner sprite at three scales; and where the browser has `filter`, equal to it.
- Chromium with `filter` deleted (what Safari looks like): all 100 run-in frames are **identical to Draft 27**
  running normally, compared by hashing the canvas each frame. This is the test that proves the fallback is
  right. Removing the fallback drawing makes it fail.

## What this method is good for
Whenever a browser might lack a canvas feature Draft 27 relies on: probe the feature in all three engines, then
test the fallback by *switching the feature off in Chromium* and comparing with Draft 27 frame for frame. A
cross-engine pixel comparison did not work: even Draft 27 itself produced different run-in frames in WebKit
and Firefox than in Chromium (67 and 16 of 100). The cause was not investigated (rendering differences or the
test clock stepping differently). A same-engine comparison does work.

## Not covered
No real iPhone yet. WebKit here is Playwright's build, which is close to Safari but not identical.
