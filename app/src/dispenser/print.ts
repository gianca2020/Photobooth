// The dispenser's print-and-drop animation (Draft 27 renderDrop): the strip feeds out of the slot in 18
// stepped frames, hangs, drops with a flutter, bounces once and lands tilted. Stepped at 12 fps, in sync
// with the 3 s foley. All timing is frame-quantised from one start time so sound and picture stay together.
import { FPS } from '../engine/clock';

export interface Pose {
  x: number;
  y: number;
  r: number;
}

/** Where the card is `t` seconds into the 3 s timeline. `h` = card height, `H` = slot height (px). */
export function dropPose(t: number, h: number, H: number): Pose {
  const land = Math.max(0, H - h - 3);
  let y = -h, x = 0, r = 0;
  if (t >= 0.25 && t < 1.83) {
    const p = Math.min(1, Math.floor((t - 0.25) * 12 + 1e-5) / 18);
    y = -h + (h - 2) * p;
  } else if (t >= 1.83 && t < 2.17) {
    y = -2;
  } else if (t >= 2.17 && t < 2.67) {
    const p = (t - 2.17) / 0.5;
    y = -2 + (land + 2) * p * p;
    r = Math.sin(p * Math.PI) * 7 - p * 5;
    x = Math.sin(p * Math.PI) * Math.min(8, H * 0.035);
  } else if (t >= 2.67 && t < 3) {
    const p = (t - 2.67) / 0.33;
    y = land - Math.sin(p * Math.PI * 2) * Math.max(0, 1 - p) * Math.min(4, H * 0.025);
    y = Math.min(land, y);
    r = -5 + Math.sin(p * Math.PI) * 2;
  } else if (t >= 3) {
    y = land;
    r = -5;
  }
  return { x, y, r };
}

export const transformFor = ({ x, y, r }: Pose): string => `translate(calc(-50% + ${Math.round(x)}px),${Math.round(y)}px) rotate(${Math.round(r)}deg)`;

export interface PrintOptions {
  card: HTMLElement;
  /** The slot the card falls inside (its height sets how far the card drops). */
  mouth: HTMLElement;
  signal: AbortSignal;
  /** Wait before the first frame (Draft 27: 650 ms when the scene slides in). */
  delayMs: number;
  /** Called once, when the strip has landed. */
  onLanded: () => void;
  /** Called when the animation really starts (the foley starts here). */
  onStart: () => void;
}

const LAST_FRAME = 36;

/** Starts the timeline. Aborting `signal` stops it for good. */
export function runPrint({ card, mouth, signal, delayMs, onLanded, onStart }: PrintOptions): void {
  const paint = (t: number) => {
    card.style.transform = transformFor(dropPose(t, card.offsetHeight, mouth.clientHeight));
  };
  const begin = performance.now() + delayMs;
  let started = false;
  let last = -1;
  let raf = 0;
  signal.addEventListener('abort', () => cancelAnimationFrame(raf), { once: true });

  const tick = (now: number) => {
    if (signal.aborted) return;
    if (now < begin) {
      raf = requestAnimationFrame(tick);
      return;
    }
    if (!started) {
      started = true;
      onStart();
    }
    const frame = Math.min(LAST_FRAME, Math.floor(((now - begin) * FPS) / 1000));
    if (frame !== last) {
      last = frame;
      paint(frame / FPS);
    }
    if (frame >= LAST_FRAME) {
      paint(3);
      onLanded();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Skip the show (reduced motion): the strip is simply there, landed. */
export function showLanded(card: HTMLElement, mouth: HTMLElement): void {
  card.style.transform = transformFor(dropPose(3, card.offsetHeight, mouth.clientHeight));
}
