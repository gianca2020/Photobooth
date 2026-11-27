// Turns the current frame into a finished 4:3 photo: lens, optional doodle frame, live graffiti.
import type { Photo, Session } from '../app/state';
import { art } from '../assets/manifest';
import { drawSource } from '../camera/source';
import { activeFaces } from '../camera/faces';
import { applyLens, filterSize, processPixels } from '../camera/lenses';
import { isReady, loadImage } from '../engine/sprites';
import { getStream } from '../camera/webcam';

const frameAsset = loadImage(art.doodleFrame);
const effectCanvas = document.createElement('canvas');

/** Draw one photo synchronously (so the shutter and the picture are the same instant). Null if no frame was available. */
export function drawShot(session: Session, video: HTMLVideoElement, graffiti: HTMLCanvasElement, pose: number): HTMLCanvasElement | null {
  const live = getStream() !== null;
  const c = document.createElement('canvas');
  c.width = session.lens === '2009' ? 640 : 960;
  c.height = (c.width * 3) / 4;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);

  if (session.lens !== 'classic') {
    const [w, h] = filterSize(session.lens);
    effectCanvas.width = w;
    effectCanvas.height = h;
    const q = effectCanvas.getContext('2d', { willReadFrequently: true })!;
    q.fillStyle = '#fff';
    q.fillRect(0, 0, w, h);
    if (!drawSource(q, video, w, h, session.count, pose)) return null;
    applyLens(q, w, h, session.lens, activeFaces(live, session.count), session.lensChoice);
    g.imageSmoothingEnabled = session.lens !== 'flipnote';
    g.drawImage(effectCanvas, 0, 0, c.width, c.height);
  } else {
    if (!drawSource(g, video, c.width, c.height, session.count, pose)) return null;
    if (live) processPixels(g, c.width, c.height, 'classic');
  }

  if (session.frameOn && isReady(frameAsset)) {
    g.imageSmoothingEnabled = false;
    g.drawImage(frameAsset, 0, 0, c.width, c.height);
  }
  g.imageSmoothingEnabled = false;
  g.drawImage(graffiti, 0, 0, c.width, c.height);
  return c;
}

export function toPhoto(canvas: HTMLCanvasElement | null): Promise<Photo | null> {
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? { blob, url: URL.createObjectURL(blob) } : null), 'image/png'),
  );
}
