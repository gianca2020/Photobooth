// Runs the app's own MediaPipe face detector (same wasm + model the site serves) on still images and
// prints where the eyes, nose and mouth sit relative to the face box. Use it to measure, not guess.
//
//   npx vite --port 5391 --strictPort &            # the page serves the model + wasm
//   node docs/fixes/tools/probe-face.mjs photo1.png photo2.png
//
// Numbers are in box heights from the box centre (negative = up), plus eye distance in box widths.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = process.argv.slice(2);
if (!files.length) throw new Error('usage: node probe-face.mjs <image.png> [...]');
const base = process.env.APP_URL ?? 'http://localhost:5391';
const bundle = '/@fs' + resolve('node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + '/');
for (const file of files) {
  const url = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const found = await page.evaluate(async ([url, bundle]) => {
    const m = await import(bundle);
    const fileset = await m.FilesetResolver.forVisionTasks('/models/mediapipe/wasm');
    const detector = await m.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.3,
    });
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return detector.detect(c).detections.map((d) => ({
      box: d.boundingBox,
      score: d.categories[0].score,
      // right eye, left eye, nose tip, mouth, right ear, left ear (normalised 0-1)
      kp: d.keypoints.map((k) => [k.x * c.width, k.y * c.height]),
    }));
  }, [url, bundle]);
  if (!found.length) console.log(file, 'no face found');
  for (const { box, score, kp } of found) {
    const cy = box.originY + box.height / 2;
    const rel = (y) => ((y - cy) / box.height).toFixed(2);
    const eyeY = (kp[0][1] + kp[1][1]) / 2;
    const eyeDist = Math.hypot(kp[1][0] - kp[0][0], kp[1][1] - kp[0][1]) / box.width;
    console.log(`${file}  score ${score.toFixed(2)}  box ${box.width}x${box.height}  eyes ${rel(eyeY)}  nose ${rel(kp[2][1])}  mouth ${rel(kp[3][1])}  eyeDist/boxW ${eyeDist.toFixed(2)}`);
  }
}
await browser.close();
