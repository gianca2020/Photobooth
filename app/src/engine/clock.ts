// Timers that are cancelled by an AbortSignal, so leaving a scene can never leave a timer behind.
export function timeout(fn: () => void, ms: number, signal: AbortSignal): void {
  if (signal.aborted) return;
  const cancel = () => clearTimeout(id);
  const id = setTimeout(() => {
    signal.removeEventListener('abort', cancel);
    fn();
  }, ms);
  signal.addEventListener('abort', cancel, { once: true });
}

export const FPS = 12;
export const FRAME_MS = 1000 / FPS;

/** Resolves true after `ms`, or false right away if the signal is aborted (so callers can bail out). */
export function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const onAbort = () => {
      clearTimeout(id);
      resolve(false);
    };
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
