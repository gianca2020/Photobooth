// Scene 2: the guests hop one by one into the booth, then the curtain closes. Drawn on a 384x144
// canvas at 12 fps with held poses, no tweening: a 6-pose hop cycle, curtain wipe over 4 frames.
// Every number below is Draft 27's.
import { go, type Scene } from '../app/router';
import { session } from '../app/state';
import { art } from '../assets/manifest';
import { FPS, FRAME_MS, timeout } from '../engine/clock';
import { isReady, loadImage } from '../engine/sprites';
import { $, prefersReducedMotion } from '../ui/dom';

const INK = '#171717';
const booth = loadImage(art.run.booth);
const boothOpen = loadImage(art.run.open);
const sprites = art.run.runners.map(loadImage);

const BX = 220, BY = 8, GROUND = 116, DOOR_X = 291, SPACING = 49, SPEED = 6, START_X = -24;
const OFFSETS = [0, -3, -9, -7, -2, 0];
const ADVANCE = [0, 3, 13, 24, 33, 36];
const COMPRESS = [-2, 1, 2, 1, -1, 0];

export const runScene: Scene = {
  enter({ signal }) {
    const count = session.count;
    $('booth-art').innerHTML =
      '<canvas class="run-raster" width="384" height="144" role="img" aria-label="Four little anime silhouettes hop one by one into the hand-drawn photo booth"></canvas>';
    const g = ($('booth-art').firstChild as HTMLCanvasElement).getContext('2d')!;
    g.imageSmoothingEnabled = false;

    const lastArrival = Math.ceil((DOOR_X - START_X + (count - 1) * SPACING) / SPEED);
    const closeAt = lastArrival + 7;
    const end = closeAt + 9;

    const draw = (im: HTMLImageElement, ...args: [number, number] | [number, number, number, number]) => {
      if (isReady(im)) g.drawImage(im, ...(args as [number, number, number, number]));
    };

    function paint(f: number): void {
      g.clearRect(0, 0, 384, 144);
      g.fillStyle = INK;
      // Ground terminates beneath the booth entrance, not beyond it.
      g.fillRect(7, GROUND, 61, 1);
      g.fillRect(68, GROUND + 1, 55, 1);
      g.fillRect(123, GROUND, 64, 1);
      g.fillRect(187, GROUND + 1, 68, 1);

      draw(f >= closeAt + 4 ? booth : boothOpen, BX, BY);
      if (f >= closeAt && f < closeAt + 4) {
        const w = Math.round(((f - closeAt + 1) * 49) / 4);
        g.save();
        g.beginPath();
        g.rect(BX + 95 - w, BY + 42, w, 63);
        g.clip();
        draw(booth, BX, BY);
        g.restore();
      }

      for (let i = count - 1; i >= 0; i--) {
        const phase = (f + i * 2) % 6;
        const x = START_X + Math.floor((f + i * 2) / 6) * 36 + ADVANCE[phase]! - i * (SPACING + 12);
        const sprite = sprites[i]!;
        if (!sprite.naturalWidth || x > DOOR_X + 20 || x < -32) continue;
        const compress = COMPRESS[phase]!;
        const progress = Math.max(0, Math.min(1, (x - (DOOR_X - 16)) / 35));
        const scale = 1 - progress * 0.5;
        const w = Math.max(1, Math.round(sprite.naturalWidth * scale));
        const h = Math.max(1, Math.round((sprite.naturalHeight + compress) * scale));
        const left = Math.round(x - w / 2);
        const top = GROUND - h + OFFSETS[phase]! - Math.round(progress * 4);
        if (x < BX + 46) {
          draw(sprite, left, top, w, h);
        } else {
          // Inside the doorway: clip to the dark opening and outline the sprite in white.
          g.save();
          g.beginPath();
          g.rect(BX + 42, BY + 43, 44, 69);
          g.clip();
          g.filter = 'brightness(0) invert(1)';
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) draw(sprite, left + dx, top + dy, w, h);
          g.filter = 'none';
          draw(sprite, left, top, w, h);
          g.restore();
        }
      }
    }

    let frame = 0;
    const tick = () => {
      paint(frame);
      if (frame++ < end) timeout(tick, FRAME_MS, signal);
    };
    const begin = () => {
      if (signal.aborted) return;
      if (prefersReducedMotion()) {
        paint(end);
        timeout(() => go(3), 900, signal);
        return;
      }
      tick();
      timeout(() => go(3), ((end + 2) * 1000) / FPS, signal);
    };

    // Decode first, avoiding a blank booth on slower devices.
    const images = [booth, boothOpen, ...sprites];
    if (images.every(isReady)) begin();
    else Promise.allSettled(images.map((im) => im.decode())).then(begin);
  },
};

$('skiprun').onclick = () => go(3);
