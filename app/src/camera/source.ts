// What a frame is made from: the live video (mirrored, cropped to 4:3) or, in demo mode, the demo art.
import { art } from '../assets/manifest';
import { isReady, loadImage } from '../engine/sprites';
import { getStream } from './webcam';

const demoImages = art.demo.map((row) => row.map(loadImage));

export function demoImage(count: number, pose: number): HTMLImageElement {
  return demoImages[count - 1]![pose]!;
}

export function drawSource(g: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number, count: number, pose: number): boolean {
  if (getStream() && video.videoWidth) {
    const sw = video.videoWidth, sh = video.videoHeight;
    const cw = Math.min(sw, (sh * 4) / 3), ch = (cw * 3) / 4;
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(video, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
    g.restore();
    return true;
  }
  const im = demoImage(count, pose);
  if (isReady(im)) {
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0, w, h);
    return true;
  }
  return false;
}
