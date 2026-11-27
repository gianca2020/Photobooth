// Prototype/utility chrome: scene dots + back link (shown only with ?debug) and the header buttons.
import { setEnabled, isEnabled } from '../audio/audio-engine';
import { sfx } from '../audio/foley';
import { $ } from './dom';

const titles = ['Insert coin', 'Welcome', 'Guests', 'Enter booth', 'Camera', 'Reveal', 'Email'];

export function buildProgress(go: (scene: number) => void): void {
  $('progress').innerHTML = titles
    .map((t, i) => `<button aria-label="Preview ${t}" title="${t}" data-scene="${i - 1}"></button>`)
    .join('');
  document.querySelectorAll<HTMLButtonElement>('#progress button').forEach((b) => {
    b.onclick = () => go(Number(b.dataset.scene));
  });
}

export function updateProgress(scene: number): void {
  document.querySelectorAll<HTMLButtonElement>('#progress button').forEach((b) => {
    const j = Number(b.dataset.scene);
    b.className = j === scene ? 'active' : j < scene ? 'passed' : '';
    b.setAttribute('aria-current', j === scene ? 'step' : 'false');
  });
  $('back').style.visibility = scene >= 0 ? 'visible' : 'hidden';
}

export function wireHeader(): void {
  const button = $('sound');
  button.onclick = () => {
    setEnabled(!isEnabled());
    const on = isEnabled();
    button.querySelector('.word')!.textContent = on ? 'sound on' : 'sound off';
    button.style.opacity = on ? '1' : '0.5';
    button.setAttribute('aria-pressed', String(on));
    if (on) sfx();
  };
  $('fullscreen').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
}
