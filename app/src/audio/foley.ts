// Playback of Draft 27's synthesized effects (sample math lives in render.ts).
import { getContext, isEnabled, playSamples, track } from './audio-engine';
import { RATE, renderCoin, renderOpening, type CoinKind, type OpeningKind } from './render';

export const coinSound = (kind: CoinKind): void => playSamples(renderCoin(kind), RATE);
export const openingSound = (kind: OpeningKind): void => playSamples(renderOpening(kind), RATE);

/** UI blips: a short swept oscillator ('pop' by default, 'slide' between scenes, 'shutter'). */
export function sfx(kind: 'pop' | 'slide' | 'shutter' = 'pop'): void {
  if (!isEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = kind === 'shutter' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(kind === 'slide' ? 190 : kind === 'shutter' ? 620 : 480, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'slide' ? 780 : kind === 'shutter' ? 120 : 130, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    o.connect(g);
    g.connect(ctx.destination);
    track(o);
    o.start(t);
    o.stop(t + 0.19);
  } catch { /* audio is a nicety, never fatal */ }
}
