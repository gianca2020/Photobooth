# 001: Mischief accessories sat too low on live faces

Issue #6, PR #8. Tracking itself worked ("1 face tracked"); the placement did not.

## Symptom
Found by human-testing face detection with a real webcam: glasses over the nose, mustache over the
lips and chin, cat ears on the forehead instead of the head.

## Step 1: is it inherited? Yes.
Draft 27 uses legacy MediaPipe from a CDN; the app uses MediaPipe Tasks. Same model family, but the
only way to know was to run both. A face video was fed to both through Chromium's fake webcam
(`tools/compare-with-draft27.mjs`). The glasses and mustache landed in the same place, within a pixel or
two. So the new detector was not at fault; Draft 27's own offsets were. That also meant the fix changes the
look of Draft 27, which needed (and got) the owner's approval.

## Step 2: measure
`tools/probe-face.mjs` ran the app's model on three real screenshots. The model returns a box plus six
keypoints (right eye, left eye, nose tip, mouth, two ears). Expressed in box heights from the box centre:

| | eyes | nose tip | mouth |
|---|---|---|---|
| shot 1 | -0.15 | +0.09 | +0.24 |
| shot 2 | -0.13 | +0.08 | +0.21 |
| shot 3 (head tipped down) | -0.04 | +0.15 | +0.24 |
| a later, tighter crop | -0.16 | +0.13 | +0.29 |

The ratios move with pose and framing. The box is a tight square (about eyebrows to chin), so it is a
poor ruler for features, and a fixed offset from its centre cannot be right for every face.

## Step 3: read the code against the numbers
`lenses/accessories.ts` placed everything at a fixed fraction of box height from the centre
(mustache +0.17, glasses -0.16, ears -0.47):
- glasses: the top bar was on the eye line (-0.16 matches -0.15) but the lenses hang 7 grid steps
  *below* the bar, so the lenses sat on the nose;
- mustache: centred on the lips (+0.21 to +0.24) instead of between nose and mouth;
- ears: bases started at the brow, not the top of the head.

## Step 4: the fix (kept small)
- Detected faces carry `marks` (eye midpoint, eye distance, nose, mouth), from MediaPipe keypoints or the
  browser `FaceDetector`'s landmarks. They are smoothed with the box (35% old, 65% new).
- `anchors()` in `accessories.ts` puts each accessory where it belongs: lenses centred on the eyes,
  mustache notch a third of the way from nose to mouth, ear bases 0.6 box heights above the eyes.
- Unchanged on purpose: accessory shapes and sizes, the demo art (hand-placed boxes without marks keep
  Draft 27's exact offsets and drawing calls), and any engine that reports no landmarks falls back to the
  old placement. Taps on the live camera get typical marks so they look like tracked faces.

## Step 5: tests
- Unit: real measured detection values, not invented ones; the lens, notch and ear base positions in grid
  steps; sideways following; `toMarks` edge cases (eye order, missing nose, mouth above eyes, NaN);
  smoothing of marks.
- E2E: the fake webcam has no face, so a stubbed browser `FaceDetector` supplies landmarks and the test reads
  pixels from the effect canvas to check the lens sits on the eye line. A second test checks the fallback.
- Draft 27 golden tests and pixel parity: unchanged and green. They are what proves the demo art did not move.
- Mutation checks: 9 deliberate breaks. **One survived**: the first mustache test only checked "between nose
  and mouth", which a broken version also satisfied. The test was tightened to "upper half of the gap" and
  then killed it. Lesson: loose bounds hide mutants.

## What the evidence is not
Three screenshots of one person plus geometry. The constants (`GLASSES_LENS_CENTRE`, `MUSTACHE_NOTCH`,
`EARS_BASE`) are judgement calls, which is why the PR carried a human checklist. The owner then tried it
on a real face and reported the detection and placement as right. The MediaPipe keypoint indices were
verified by running the real model, not by a committed test (no face in the fake webcam).

## Not covered
Distortion and Emoter still use the box only. Issue #6 suspected they may be slightly off-centre; not
checked.
