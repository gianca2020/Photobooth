// Scene -1: the coin slot. Idle flicker, then the 44-frame insert sequence at 12 fps with
// synchronized sounds. Frame numbers and sound cues are Draft 27's.
import { coinSound, openingSound } from '../audio/foley';
import { currentScene, go, type Scene } from '../app/router';
import { art } from '../assets/manifest';
import { FRAME_MS, timeout } from '../engine/clock';
import { drawFrame, isReady, loadImage } from '../engine/sprites';
import { $, prefersReducedMotion } from '../ui/dom';

const sheet = loadImage(art.coinSheet);
const canvas = $<HTMLCanvasElement>('coin-canvas');
const hit = $<HTMLButtonElement>('coin-hit');
const draw = (n: number) => drawFrame(canvas, sheet, n);

let busy = false;
let sceneSignal: AbortSignal | null = null;
let idle: AbortController | null = null;

function startIdle(signal: AbortSignal): void {
  // Frames 1-4 at 83 ms, then a 3.2 s rest, repeating (Draft 27's exact cadence).
  const run = () => {
    if (signal.aborted || busy) return;
    let k = 1;
    const tick = () => {
      if (signal.aborted || busy) return;
      draw(k++);
      timeout(k <= 4 ? tick : run, k <= 4 ? 83 : 3200, signal);
    };
    tick();
  };
  timeout(run, 2400, signal);
}

export const coinScene: Scene = {
  enter({ signal }) {
    sceneSignal = signal;
    busy = false;
    hit.disabled = false;
    idle = new AbortController();
    draw(0);
    if (!isReady(sheet)) {
      sheet.addEventListener('load', () => { if (!signal.aborted && !busy) draw(0); }, { once: true });
    }
    if (!prefersReducedMotion()) startIdle(idle.signal);
  },
  exit() {
    idle?.abort();
    busy = false;
    hit.disabled = false;
  },
};

hit.addEventListener('click', () => {
  if (busy || currentScene() !== -1 || !sceneSignal) return;
  idle?.abort();
  busy = true;
  hit.disabled = true;
  const signal = sceneSignal;
  coinSound('tick');
  if (prefersReducedMotion()) {
    openingSound('cash');
    go(0, false);
    return;
  }
  let n = 0;
  const tick = () => {
    if (n === 3) coinSound('spin');
    if (n === 24) openingSound('cash');
    if (n === 27) openingSound('erase');
    if (n === 34) openingSound('erase');
    if (n >= 44) { go(0, false); return; }
    draw(5 + n++);
    timeout(tick, FRAME_MS, signal);
  };
  tick();
});
