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

/**
 * The photo dispenser's 3-second mechanical foley (Draft 26/27 printFoley): solenoid clicks, a slightly
 * uneven geared feed motor with roller chatter, card stock in free fall, then a soft tray landing.
 */
export const PRINT_SECONDS = 3;
export function renderPrintFoley(): Float32Array {
  const a = new Float32Array(RATE * PRINT_SECONDS);
  let seed = 826, prev = 0, phase = 0;
  const bell = (t: number, at: number, decay: number) => (t >= at ? Math.exp(-(t - at) * decay) : 0);
  for (let i = 0; i < a.length; i++) {
    const t = i / RATE;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = (seed / 4294967296) * 2 - 1;
    const grit = n - prev * 0.65;
    prev = n;
    let v = 0;
    // Solenoid: dry click and short low mechanical knock.
    for (const at of [0.035, 1.83, 2.16]) {
      const d = t - at;
      if (d >= 0 && d < 0.12) v += (grit * 0.45 + Math.sin(2 * Math.PI * 185 * d) * 0.33 + Math.sin(2 * Math.PI * 780 * d) * 0.12) * bell(t, at, 46);
    }
    // Slightly uneven geared motor, with intermittent feed-roller chatter.
    if (t >= 0.25 && t < 1.82) {
      const u = t - 0.25;
      const env = Math.min(1, u * 18, (1.82 - t) * 21);
      const f = 145 + 22 * Math.min(1, u * 6) - 12 * Math.max(0, u - 1.2) * 3;
      phase += (2 * Math.PI * f) / RATE;
      const chatter = 0.65 + 0.35 * Math.sin(2 * Math.PI * 24 * u);
      v += env * (0.27 * Math.sin(phase) + 0.13 * Math.sin(phase * 2) + 0.06 * Math.sin(phase * 5) + 0.12 * n) * chatter;
      const pulse = (u * 12) % 1;
      v += env * 0.15 * grit * Math.exp(-pulse * 9);
    }
    // Card stock whisper in free fall, followed by a soft tray contact.
    if (t >= 2.17 && t < 2.66) {
      const u = t - 2.17;
      const env = Math.min(1, u * 16, (2.66 - t) * 15);
      v += grit * 0.15 * env * (0.55 + 0.45 * Math.sin(2 * Math.PI * 13 * u) ** 2);
    }
    if (t >= 2.67) {
      const u = t - 2.67;
      v += (grit * 0.37 + Math.sin(2 * Math.PI * 115 * u) * 0.17) * Math.exp(-u * 45);
    }
    if (t >= 2.82) {
      const u = t - 2.82;
      v += grit * 0.11 * Math.exp(-u * 65);
    }
    a[i] = (Math.round(Math.max(-1, Math.min(1, v)) * 32) / 32) * 0.34;
  }
  return a;
}
