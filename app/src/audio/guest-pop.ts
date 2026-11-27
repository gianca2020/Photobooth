// The one sampled sound in the app: the pop when a guest is added.
import { audioFiles } from '../assets/manifest';
import { isEnabled, onDisable } from './audio-engine';

const pop = new Audio(audioFiles.guestPop);
pop.preload = 'auto';
onDisable(() => pop.pause());

export function playGuestPop(): void {
  if (!isEnabled()) return;
  pop.pause();
  pop.currentTime = 0;
  pop.play().catch(() => {});
}
