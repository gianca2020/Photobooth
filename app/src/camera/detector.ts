// Face detection engines. Order matches Draft 27: the browser's built-in FaceDetector if it has one,
// otherwise MediaPipe Tasks, loaded on demand from our own domain (/models), never from a CDN.
import type { Face } from './types';

export interface Engine {
  kind: 'native' | 'mediapipe';
  detect(canvas: HTMLCanvasElement): Promise<Face[]>;
}

const MEDIAPIPE_WASM = '/models/mediapipe/wasm';
const MEDIAPIPE_MODEL = '/models/blaze_face_short_range.tflite';
const LOAD_TIMEOUT_MS = 30_000;

/** Pixel box -> 0-1 face, or null if the box is unusable. */
export function toFace(x: number, y: number, w: number, h: number, canvasW: number, canvasH: number): Face | null {
  const face = { x: (x + w / 2) / canvasW, y: (y + h / 2) / canvasH, w: w / canvasW, h: h / canvasH };
  return Number.isFinite(face.x) && Number.isFinite(face.y) && face.w > 0 && face.h > 0 ? face : null;
}
const keep = (faces: (Face | null)[]): Face[] => faces.filter((f): f is Face => f !== null);

interface NativeFaceDetector {
  detect(source: CanvasImageSource): Promise<{ boundingBox: DOMRectReadOnly }[]>;
}

async function createNative(): Promise<Engine | null> {
  const Ctor = (window as unknown as { FaceDetector?: new (o: object) => NativeFaceDetector }).FaceDetector;
  if (typeof Ctor !== 'function') return null;
  try {
    const detector = new Ctor({ fastMode: true, maxDetectedFaces: 4 });
    await detector.detect(document.createElement('canvas')); // does it actually work here?
    return {
      kind: 'native',
      detect: async (c) => keep((await detector.detect(c)).map((d) => toFace(d.boundingBox.x, d.boundingBox.y, d.boundingBox.width, d.boundingBox.height, c.width, c.height))),
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
          return b ? toFace(b.originX, b.originY, b.width, b.height, c.width, c.height) : null;
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
