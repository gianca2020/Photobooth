// Scene 0: the opening animation. 12 fps sprite sheet with an orange focus flash (frames 28-31)
// and a white shutter flash with sound (frame 39). Draft 27 jumps to the held final frame 76 at
// frame 41; frames 42-75 of the sheet are never shown, so we don't pretend to play them.
import { openingSound } from '../audio/foley';
import { go, type Scene } from '../app/router';
import { art } from '../assets/manifest';
import { FRAME_MS, timeout } from '../engine/clock';
import { drawFrame, isReady, loadImage } from '../engine/sprites';
import { $, prefersReducedMotion } from '../ui/dom';

const sheet = loadImage(art.welcomeSheet);
const canvas = $<HTMLCanvasElement>('welcome-canvas');
const start = $<HTMLButtonElement>('start');
const flash = $('opening-flash');
const FINAL_FRAME = 76;

function hideFlash(): void {
  flash.hidden = true;
  flash.classList.remove('fizzle');
  flash.style.backgroundImage = '';
  flash.style.backgroundColor = 'white';
}

function showFlash(mode: 'white' | 'focus' = 'white'): void {
  flash.classList.remove('fizzle');
  flash.style.backgroundImage = '';
  flash.style.backgroundColor = mode === 'focus' ? 'rgba(246,107,0,.88)' : 'white';
  flash.hidden = false;
}

function cleanup(): void {
  hideFlash();
  document.body.classList.remove('welcome-opening');
}

export const welcomeScene: Scene = {
  enter({ signal }) {
    cleanup();
    start.hidden = true;
    start.disabled = true;
    start.classList.remove('ready');
    document.body.classList.add('welcome-opening');

    const finish = () => {
      if (signal.aborted) return;
      hideFlash();
      document.body.classList.remove('welcome-opening');
      start.disabled = false;
      start.hidden = false;
      start.classList.add('ready');
    };
    const play = () => {
      if (signal.aborted) return;
      if (prefersReducedMotion()) {
        drawFrame(canvas, sheet, FINAL_FRAME);
        finish();
        return;
      }
      let n = 0;
      const tick = () => {
        if (n >= 77) { finish(); return; }
        drawFrame(canvas, sheet, n);
        if (n === 28) showFlash('focus');
        if (n === 31) hideFlash();
        if (n === 39) { showFlash(); openingSound('shutter'); }
        if (n === 41) { drawFrame(canvas, sheet, FINAL_FRAME); finish(); return; }
        n++;
        timeout(tick, FRAME_MS, signal);
      };
      tick();
    };
    if (isReady(sheet)) play();
    else sheet.addEventListener('load', play, { once: true });
  },
  exit: cleanup,
};

start.addEventListener('click', () => go(1));
