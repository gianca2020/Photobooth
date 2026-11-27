// Runs detection on the live video while a face lens is selected: at most every 170 ms, on a
// 320x240 copy of the frame, one request at a time. Stale answers (the guest changed lens, tapped to
// place a face, or left) are dropped.
import { loadEngine, forgetFailure } from './detector';
import * as faces from './faces';

export const DETECT_W = 320;
export const DETECT_H = 240;
const MIN_INTERVAL_MS = 170;

const canvas = document.createElement('canvas');
canvas.width = DETECT_W;
canvas.height = DETECT_H;

let busy = false;
let lastDetect = 0;
let seenGeneration = -1;

export interface TrackerHooks {
  /** Paint the current frame into the given context; false if there is no frame yet. */
  draw(g: CanvasRenderingContext2D, w: number, h: number): boolean;
  /** Still on the camera scene, live, with a face lens selected? */
  wanted(): boolean;
  /** The face note/preview should be refreshed. */
  changed(): void;
}

export async function detectFaces(t: number, hooks: TrackerHooks): Promise<void> {
  if (faces.getGeneration() !== seenGeneration) {
    seenGeneration = faces.getGeneration();
    lastDetect = 0;
  }
  if (!hooks.wanted() || faces.getManual().length || busy || t - lastDetect < MIN_INTERVAL_MS || faces.getStatus() === 'failed') return;
  lastDetect = t;
  busy = true;
  const generation = faces.getGeneration();
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  try {
    if (!hooks.draw(g, DETECT_W, DETECT_H)) return;
    if (faces.getStatus() === 'idle') {
      faces.setStatus('loading');
      hooks.changed();
    }
    const engine = await loadEngine();
    if (!engine) {
      faces.setStatus('failed');
      return;
    }
    if (faces.getStatus() !== 'ready') faces.setStatus('ready');
    if (!hooks.wanted() || generation !== faces.getGeneration()) return;
    hooks.draw(g, DETECT_W, DETECT_H); // the load may have taken a while: use a fresh frame
    const found = await engine.detect(canvas);
    if (!hooks.wanted() || generation !== faces.getGeneration()) return;
    faces.setTracked(found, performance.now());
  } catch {
    faces.setStatus('failed');
    faces.clearTracked();
  } finally {
    busy = false;
    hooks.changed();
  }
}

/** Called when the guest enters the camera: a failed load (e.g. bad connection) gets another chance. */
export function retryAfterFailure(): void {
  if (faces.getStatus() === 'failed') {
    faces.setStatus('idle');
    forgetFailure();
  }
}
