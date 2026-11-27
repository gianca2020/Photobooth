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
