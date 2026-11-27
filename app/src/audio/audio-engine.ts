// One AudioContext for the whole app, created on first use (browsers require a user gesture),
// with a master on/off switch that also stops anything still playing.
let ctx: AudioContext | null = null;
let enabled = true;
const active = new Set<AudioScheduledSourceNode>();

export const isEnabled = (): boolean => enabled;

export function setEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    for (const node of active) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    active.clear();
  }
}

export function getContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Remember a playing node so setEnabled(false) can silence it. */
export function track(node: AudioScheduledSourceNode): void {
  active.add(node);
  node.addEventListener('ended', () => active.delete(node));
}

/** Play a pre-rendered mono buffer at its own sample rate. */
export function playSamples(samples: Float32Array, sampleRate: number): void {
  if (!enabled) return;
  const audio = getContext();
  if (!audio) return;
  try {
    const buffer = audio.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const node = audio.createBufferSource();
    node.buffer = buffer;
    node.connect(audio.destination);
    track(node);
    node.start();
  } catch { /* audio is a nicety, never fatal */ }
}

// Phones suspend the context when the page is hidden; wake it when the user returns.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ctx?.state === 'suspended') ctx.resume().catch(() => {});
});
