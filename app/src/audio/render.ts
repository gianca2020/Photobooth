// Pure sample generators for Draft 27's effects (no browser APIs, so they can be unit tested).
// Low sample rate (8180 Hz), mono, quantized to a few bits: a handheld-speaker sound.
export const RATE = 8180;

export type CoinKind = 'tick' | 'spin' | 'clunk';
export type OpeningKind = 'cash' | 'erase' | 'shutter';

export function renderCoin(kind: CoinKind): Float32Array {
  const dur = kind === 'clunk' ? 0.23 : kind === 'spin' ? 0.26 : 0.055;
  const a = new Float32Array(Math.round(RATE * dur));
  let seed = 712;
  for (let i = 0; i < a.length; i++) {
    const t = i / RATE;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    const v =
      kind === 'tick'
        ? (Math.sin(2 * Math.PI * 920 * t) * 0.65 + noise * 0.35) * Math.exp(-t * 65)
        : kind === 'spin'
          ? (Math.sin(2 * Math.PI * (620 * t - 650 * t * t)) * 0.6 + noise * 0.25) * Math.exp(-t * 10) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 36 * t))
          : (Math.sin(2 * Math.PI * 170 * t) * 0.5 + Math.sin(2 * Math.PI * 520 * t) * 0.25 + noise * 0.25) * Math.exp(-t * 23);
    a[i] = (Math.round(v * 24) / 24) * 0.3;
  }
  return a;
}

export function renderOpening(kind: OpeningKind): Float32Array {
  const dur = kind === 'cash' ? 0.48 : kind === 'erase' ? 0.68 : 0.19;
  const a = new Float32Array(Math.round(RATE * dur));
  let seed = 152;
  for (let i = 0; i < a.length; i++) {
    const t = i / RATE;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    let v = 0;
    if (kind === 'cash') {
      const u = t < 0.085 ? t : t - 0.085;
      const f = t < 0.085 ? 660 : 1318;
      v = (Math.sign(Math.sin(2 * Math.PI * f * u)) * 0.42 + Math.sin(2 * Math.PI * f * 1.5 * u) * 0.24) * Math.exp(-u * (t < 0.085 ? 25 : 11));
      if (t < 0.055) v += noise * 0.27 * Math.exp(-t * 50);
    } else if (kind === 'erase') {
      v = noise * 0.46 * (0.25 + 0.75 * Math.abs(Math.sin(t * 39))) * Math.min(1, t * 25, (dur - t) * 25);
    } else {
      v = (noise * 0.7 + Math.sin(2 * Math.PI * 180 * t) * 0.3) * Math.exp(-t * 24);
    }
    a[i] = (Math.round(v * 16) / 16) * 0.27;
  }
  return a;
}
