// Owns the MediaStream. A request counter drops answers that arrive after the user has moved on,
// and the tracks are always stopped when a request is superseded or the camera is released.
let stream: MediaStream | null = null;
let pending = false;
let requestId = 0;

export const getStream = (): MediaStream | null => stream;
export const isLive = (): boolean => stream !== null;
export const isPending = (): boolean => pending;
export const isSupported = (): boolean => !!navigator.mediaDevices?.getUserMedia;

export type OpenResult = 'live' | 'stale' | 'failed';

/** Ask for the camera. Resolves 'stale' (and releases the tracks) if stop() or another open() happened meanwhile. */
export async function open(): Promise<OpenResult> {
  const mine = ++requestId;
  pending = true;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    if (mine !== requestId) {
      s.getTracks().forEach((t) => t.stop());
      return 'stale';
    }
    stream = s;
    return 'live';
  } catch {
    return mine === requestId ? 'failed' : 'stale';
  } finally {
    if (mine === requestId) pending = false;
  }
}

/** Release the camera (turns off the light) and invalidate any request still in flight. */
export function stop(): void {
  requestId++;
  pending = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}
