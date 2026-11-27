// Where the faces are. Priority: faces the guest placed by tapping, then tracked faces (live camera),
// then fixed positions that match the demo artwork. Detection itself lives in tracker.ts/detector.ts.
import { clamp } from './lenses/util';
import type { Face, FaceMarks } from './types';

export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'failed';

let tracked: Face[] = [];
let manual: Face[] = [];
let status: TrackingStatus = 'idle';
let lastFaceTime = 0;
let generation = 0;

export const getTracked = (): Face[] => tracked;
export const getManual = (): Face[] => manual;
export const getStatus = (): TrackingStatus => status;
export const setStatus = (s: TrackingStatus): void => void (status = s);
/** Bumped by reset(); in-flight detections from an older generation are thrown away. */
export const getGeneration = (): number => generation;

export function reset(): void {
  generation++;
  tracked = [];
  manual = [];
  lastFaceTime = 0;
}

const ease = (old: number, now: number): number => old * 0.35 + now * 0.65;
function easeMarks(old: FaceMarks | undefined, now: FaceMarks | undefined): FaceMarks | undefined {
  if (!now || !old) return now;
  return {
    eyeX: ease(old.eyeX, now.eyeX), eyeY: ease(old.eyeY, now.eyeY), eyeDist: ease(old.eyeDist, now.eyeDist),
    noseX: ease(old.noseX, now.noseX), noseY: ease(old.noseY, now.noseY),
    mouthX: ease(old.mouthX, now.mouthX), mouthY: ease(old.mouthY, now.mouthY),
  };
}

/**
 * Where eyes, nose and mouth usually sit inside a face box (measured with the face detector on real
 * faces: eyes -0.14, nose +0.09, mouth +0.23 box heights from the centre; eyes 0.33 box widths apart).
 * Used for faces the guest placed by tapping on a live camera, so they get the same placement as tracked ones.
 */
export function typicalMarks(f: Face): FaceMarks {
  return { eyeX: f.x, eyeY: f.y - 0.14 * f.h, eyeDist: 0.33 * f.w, noseX: f.x, noseY: f.y + 0.09 * f.h, mouthX: f.x, mouthY: f.y + 0.23 * f.h };
}

/** Fold a fresh detection into the tracked faces: ease toward matches (less jitter), keep up to 4, forget after 0.8 s of nothing. */
export function setTracked(found: Face[], now: number): void {
  if (found.length) {
    const prev = tracked;
    tracked = found.slice(0, 4).map((f) => {
      const old = prev.find((o) => Math.hypot(o.x - f.x, o.y - f.y) < 0.1);
      if (!old) return f;
      const eased: Face = { x: ease(old.x, f.x), y: ease(old.y, f.y), w: ease(old.w, f.w), h: ease(old.h, f.h) };
      const marks = easeMarks(old.marks, f.marks);
      if (marks) eased.marks = marks;
      return eased;
    });
    lastFaceTime = now;
  } else if (now - lastFaceTime > 800) {
    tracked = [];
  }
}

export function clearTracked(): void {
  tracked = [];
}

// Where the guests are drawn in the demo art, per guest count (x, y, w, h).
const DEMO_FACES: Record<number, [number, number, number, number][]> = {
  1: [[0.5, 0.57, 0.25, 0.34]],
  2: [[0.33, 0.56, 0.25, 0.33], [0.69, 0.61, 0.24, 0.32]],
  3: [[0.35, 0.52, 0.21, 0.3], [0.7, 0.52, 0.21, 0.3], [0.51, 0.87, 0.24, 0.3]],
  4: [[0.21, 0.59, 0.2, 0.28], [0.83, 0.6, 0.2, 0.28], [0.5, 0.84, 0.23, 0.29]],
};

export function activeFaces(live: boolean, count: number): Face[] {
  if (manual.length) return manual;
  if (live) return tracked.length ? tracked : [];
  return (DEMO_FACES[count] ?? DEMO_FACES[1]!).map(([x, y, w, h]) => ({ x, y, w, h }));
}

/** A tap/click at (x, y) in 0-1 viewfinder coordinates: add or move a face there. `live` = on the real camera (not the demo art). */
export function place(x: number, y: number, count: number, live = false): void {
  const nearest = tracked.reduce<Face | null>(
    (best, f) => (!best || Math.hypot(f.x - x, f.y - y) < Math.hypot(best.x - x, best.y - y) ? f : best),
    null,
  );
  const size = nearest && Math.hypot(nearest.x - x, nearest.y - y) < 0.18 ? nearest : { w: count === 1 ? 0.3 : 0.23, h: count === 1 ? 0.42 : 0.32 };
  const face: Face = { x: clamp(x, 0, 1), y: clamp(y, 0, 1), w: size.w, h: size.h };
  if (live) face.marks = typicalMarks(face);
  if (count === 1 || manual.length >= count) manual = [face];
  else manual.push(face);
}
