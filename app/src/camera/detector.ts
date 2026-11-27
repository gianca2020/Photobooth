// Face detection engines. Order matches Draft 27: the browser's built-in FaceDetector if it has one,
// otherwise MediaPipe Tasks, loaded on demand from our own domain (/models), never from a CDN.
import type { Face, FaceMarks } from './types';

export interface Engine {
  kind: 'native' | 'mediapipe';
  detect(canvas: HTMLCanvasElement): Promise<Face[]>;
}

const MEDIAPIPE_WASM = '/models/mediapipe/wasm';
const MEDIAPIPE_MODEL = '/models/blaze_face_short_range.tflite';
const LOAD_TIMEOUT_MS = 30_000;

type Pt = { x: number; y: number };

/**
 * Eyes + mouth (+ nose if the engine has one) in 0-1 coordinates -> marks, or undefined if they are
 * missing or nonsense. Without a nose it is estimated, 62% of the way from the eyes to the mouth.
 */
export function toMarks(eyes: Pt[], nose: Pt | undefined, mouth: Pt | undefined): FaceMarks | undefined {
  if (eyes.length < 2 || !mouth) return undefined;
  const [a, b] = [...eyes].sort((p, q) => p.x - q.x) as [Pt, Pt];
  const eyeX = (a.x + b.x) / 2;
  const eyeY = (a.y + b.y) / 2;
  const marks = {
    eyeX,
    eyeY,
    eyeDist: Math.hypot(b.x - a.x, b.y - a.y),
    noseX: nose?.x ?? eyeX + (mouth.x - eyeX) * 0.62,
    noseY: nose?.y ?? eyeY + (mouth.y - eyeY) * 0.62,
    mouthX: mouth.x,
    mouthY: mouth.y,
  };
  const sane = Object.values(marks).every(Number.isFinite) && marks.eyeDist > 0 && mouth.y > eyeY;
  return sane ? marks : undefined;
}

/** Pixel box -> 0-1 face, or null if the box is unusable. Landmark points, if given, are in pixels too. */
export function toFace(x: number, y: number, w: number, h: number, canvasW: number, canvasH: number, marks?: FaceMarks): Face | null {
  const face: Face = { x: (x + w / 2) / canvasW, y: (y + h / 2) / canvasH, w: w / canvasW, h: h / canvasH };
  if (marks) face.marks = marks;
  return Number.isFinite(face.x) && Number.isFinite(face.y) && face.w > 0 && face.h > 0 ? face : null;
}
const keep = (faces: (Face | null)[]): Face[] => faces.filter((f): f is Face => f !== null);

interface NativeLandmark {
  type: string;
  locations: Pt[];
}
interface NativeFaceDetector {
  detect(source: CanvasImageSource): Promise<{ boundingBox: DOMRectReadOnly; landmarks?: NativeLandmark[] }[]>;
}

/** The browser's FaceDetector reports pixel landmarks: two eyes, a mouth and (some browsers) a nose. */
export function nativeMarks(landmarks: NativeLandmark[] | undefined, cw: number, ch: number): FaceMarks | undefined {
  if (!landmarks) return undefined;
  const at = (type: string) => landmarks.filter((l) => l.type === type).flatMap((l) => l.locations).map((p) => ({ x: p.x / cw, y: p.y / ch }));
  return toMarks(at('eye'), at('nose')[0], at('mouth')[0]);
}

async function createNative(): Promise<Engine | null> {
  const Ctor = (window as unknown as { FaceDetector?: new (o: object) => NativeFaceDetector }).FaceDetector;
  if (typeof Ctor !== 'function') return null;
  try {
    const detector = new Ctor({ fastMode: true, maxDetectedFaces: 4 });
    await detector.detect(document.createElement('canvas')); // does it actually work here?
    return {
      kind: 'native',
      detect: async (c) =>
        keep(
          (await detector.detect(c)).map((d) =>
            toFace(d.boundingBox.x, d.boundingBox.y, d.boundingBox.width, d.boundingBox.height, c.width, c.height, nativeMarks(d.landmarks, c.width, c.height)),
          ),
        ),
    };
  } catch {
    return null;
  }
}

async function createMediaPipe(): Promise<Engine> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MEDIAPIPE_MODEL },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.55,
  });
  return {
    kind: 'mediapipe',
    detect: async (c) =>
      keep(
        detector.detect(c).detections.map((d) => {
          const b = d.boundingBox;
          // BlazeFace keypoints (0-1): right eye, left eye, nose tip, mouth, right ear, left ear.
          const k = d.keypoints;
          const marks = k.length >= 4 ? toMarks([k[0]!, k[1]!], k[2], k[3]) : undefined;
          return b ? toFace(b.originX, b.originY, b.width, b.height, c.width, c.height, marks) : null;
        }),
      ),
  };
}

let loading: Promise<Engine | null> | null = null;

/** Load once and share. Resolves null (never throws) if no engine could be started. */
export function loadEngine(): Promise<Engine | null> {
  loading ??= (async () => {
    try {
      const native = await createNative();
      if (native) return native;
      return await Promise.race([
        createMediaPipe(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('face detector load timed out')), LOAD_TIMEOUT_MS)),
      ]);
    } catch {
      return null;
    }
  })();
  return loading;
}

/** Allow a new attempt after a failure (e.g. a flaky mobile connection). */
export function forgetFailure(): void {
  loading = null;
}
