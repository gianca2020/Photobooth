// Scene 3: the DSi-style camera. Live (or demo) viewfinder, seven lenses, doodle frame, and the
// four-photo countdown. Lifecycle: enter() resets and asks for the camera; exit() (or leaving
// mid-countdown) aborts everything and releases the camera.
import { go, type Scene } from '../app/router';
import { clearShots, session } from '../app/state';
import { sfx } from '../audio/foley';
import * as faces from '../camera/faces';
import { detectFaces, retryAfterFailure } from '../camera/tracker';
import { LENS_NOTES, LENS_TITLES, LENS_VARIANTS, applyLens, filterSize, isFaceLens, isVariantLens } from '../camera/lenses';
import { clamp } from '../camera/lenses/util';
import { drawSource, demoImage } from '../camera/source';
import * as webcam from '../camera/webcam';
import { sleep } from '../engine/clock';
import { drawShot, toPhoto } from '../photo/compose';
import type { LensId } from '../app/state';
import { $ } from '../ui/dom';

const PROMPTS = [
  'Something respectable for the family album.',
  'Now give us your finest Hollywood performance!',
  'Look as suspicious as humanly possible.',
  'One last photograph. Make it ridiculous!',
];

const video = $<HTMLVideoElement>('video');
const demo = $('demo');
const ink = $<HTMLCanvasElement>('ink-preview');
const graffiti = $<HTMLCanvasElement>('live-graffiti');
const take = $<HTMLButtonElement>('take');
const webcamBtn = $<HTMLButtonElement>('webcam');
const status = $('camera-status');
const viewfinder = document.querySelector<HTMLElement>('#s3 .viewfinder')!;

let signal: AbortSignal | null = null;
let capturing = false;
let previewPose = 0;
let fxRAF = 0;
let lastFX = 0;

const live = (): boolean => webcam.isLive();
const active = (): boolean => !!signal && !signal.aborted;

// ---- demo / live source -------------------------------------------------------------------

function drawDemo(pose: number): void {
  demo.innerHTML = `<img alt="Illustrated demo guests" src="${demoImage(session.count, pose).src}">`;
}

function stopCam(): void {
  faces.reset();
  webcam.stop();
  video.srcObject = null;
  video.hidden = true;
  demo.classList.remove('hidden');
  $('rec').textContent = 'DEMO VIEW';
  status.textContent = '';
  webcamBtn.textContent = 'Use real camera';
}

async function enableCamera(): Promise<void> {
  if (live() || webcam.isPending()) {
    stopCam();
    take.disabled = false;
    webcamBtn.disabled = false;
    return;
  }
  if (!webcam.isSupported()) {
    status.textContent = 'Camera unavailable in this browser. Demo still works.';
    return;
  }
  take.disabled = true;
  webcamBtn.disabled = false;
  webcamBtn.textContent = 'Use demo instead';
  status.textContent = 'Waiting for camera permission…';
  const mySignal = signal;
  const result = await webcam.open();
  if (result === 'stale') return;
  if (result === 'live' && mySignal === signal && active()) {
    faces.reset();
    video.srcObject = webcam.getStream();
    video.hidden = false;
    demo.classList.add('hidden');
    $('rec').textContent = 'LIVE';
    status.textContent = '';
    webcamBtn.textContent = 'Use demo instead';
    await video.play().catch(() => {});
  } else if (result === 'live') {
    webcam.stop(); // the guest left while the permission prompt was open
    return;
  } else if (active()) {
    status.textContent = 'No camera access. You can still use the demo.';
    webcamBtn.textContent = 'Use real camera';
  }
  if (active() && !capturing) {
    take.disabled = false;
    webcamBtn.disabled = false;
  }
}

// ---- lens preview -------------------------------------------------------------------------

function faceNote(): void {
  let n = LENS_NOTES[session.lens];
  if (isFaceLens(session.lens) && live()) {
    n += faces.getManual().length
      ? ' · Manual placement'
      : faces.getStatus() === 'loading'
        ? ' · Loading face tracking…'
        : faces.getStatus() === 'failed'
          ? ' · Tracking unavailable; tap to aim'
          : faces.getTracked().length
            ? ` · ${faces.getTracked().length} face${faces.getTracked().length === 1 ? '' : 's'} tracked`
            : ' · Looking for faces';
  }
  const el = $('filter-note');
  if (el.textContent !== n) el.textContent = n;
}

function paintEffect(pose: number): boolean {
  const [w, h] = filterSize(session.lens);
  if (ink.width !== w || ink.height !== h) {
    ink.width = w;
    ink.height = h;
  }
  const g = ink.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  if (!drawSource(g, video, w, h, session.count, pose)) {
    ink.hidden = true;
    return false;
  }
  applyLens(g, w, h, session.lens, faces.activeFaces(live(), session.count), session.lensChoice);
  ink.classList.toggle('pixel-lens', session.lens === 'flipnote');
  ink.hidden = false;
  return true;
}

const trackerHooks = {
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => drawSource(g, video, w, h, session.count, previewPose),
  wanted: () => active() && live() && isFaceLens(session.lens) && video.videoWidth > 0,
  changed: faceNote,
};

function effectLoop(t: number): void {
  fxRAF = 0;
  if (!active() || session.lens === 'classic') return;
  if (t - lastFX >= 66) {
    lastFX = t;
    paintEffect(previewPose);
    if (isFaceLens(session.lens)) void detectFaces(t, trackerHooks);
  }
  fxRAF = requestAnimationFrame(effectLoop);
}

function updateEffects(): void {
  $('lens-title').textContent = LENS_TITLES[session.lens];
  document.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === session.lens)));
  $('frame-toggle').setAttribute('aria-pressed', String(session.frameOn));
  ($('doodle-preview') as HTMLImageElement).hidden = !session.frameOn;

  const options = isVariantLens(session.lens) ? LENS_VARIANTS[session.lens] : undefined;
  $('lens-settings').hidden = !options;
  if (options && isVariantLens(session.lens)) {
    const lens = session.lens;
    const select = $<HTMLSelectElement>('lens-variant');
    select.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    select.value = session.lensChoice[lens];
    $('variant-buttons').innerHTML = options
      .map(([v, l]) => `<button class="secondary" type="button" data-variant="${v}" aria-pressed="${v === session.lensChoice[lens]}">${l}</button>`)
      .join('');
    $('variant-buttons').querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.onclick = () => {
        if (capturing) return;
        select.value = b.dataset.variant!;
        select.onchange?.(new Event('change'));
      };
    });
  }
  $('auto-face').hidden = !isFaceLens(session.lens);
  viewfinder.classList.toggle('face-placement', isFaceLens(session.lens));
  faceNote();

  if (session.lens === 'classic') {
    ink.hidden = true;
    if (fxRAF) {
      cancelAnimationFrame(fxRAF);
      fxRAF = 0;
    }
  } else if (active()) {
    paintEffect(previewPose);
    if (!fxRAF) fxRAF = requestAnimationFrame(effectLoop);
  }
}

function resetFacePlacement(): void {
  faces.reset();
  faceNote();
}

// ---- capture --------------------------------------------------------------------------------

function renderDots(taken: number): void {
  $('dots').innerHTML = Array.from({ length: 4 }, (_, j) => `<span class="${j < taken ? 'taken' : j === taken ? 'current' : ''}"></span>`).join('');
}

function resetCapture(): void {
  resetFacePlacement();
  capturing = false;
  clearShots();
  $('timer').textContent = '';
  previewPose = 0;
  drawDemo(0);
  updateEffects();
  $('capturetitle').textContent = '';
  $('prompt').textContent = '';
  $('capture-controls').classList.remove('hidden', 'shooting');
  take.disabled = false;
  take.innerHTML = 'Take photos <span aria-hidden="true">→</span>';
  webcamBtn.disabled = false;
  renderDots(0);
}

async function capture(): Promise<void> {
  if (capturing || !signal) return;
  const mine = signal;
  capturing = true;
  clearShots();
  take.disabled = true;
  $('capture-controls').classList.add('shooting');
  webcamBtn.disabled = true;
  const duration = Number($<HTMLSelectElement>('duration').value) || 3;
  const pending: Promise<import('../app/state').Photo | null>[] = [];

  for (let i = 0; i < 4; i++) {
    if (mine.aborted) return;
    renderDots(i);
    $('capturetitle').textContent = `Photo ${i + 1} / 4`;
    $('prompt').textContent = PROMPTS[i]!;
    previewPose = i;
    drawDemo(i);
    if (!(await sleep(1450, mine))) return;
    for (let n = duration; n > 0; n--) {
      if (mine.aborted) return;
      $('timer').textContent = String(n);
      sfx('pop');
      if (!(await sleep(1000, mine))) return;
    }
    if (mine.aborted) return;
    $('timer').textContent = '';
    pending.push(toPhoto(drawShot(session, video, graffiti, i)));
    sfx('shutter');
    const flash = $('flash');
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    renderDots(i + 1);
    if (!(await sleep(650, mine))) return;
  }

  const photos = await Promise.all(pending);
  if (mine.aborted) {
    photos.forEach((p) => p && URL.revokeObjectURL(p.url));
    return;
  }
  session.shots = photos;
  go(4);
}

// ---- scene ----------------------------------------------------------------------------------

export const cameraScene: Scene = {
  enter(ctx) {
    signal = ctx.signal;
    retryAfterFailure();
    resetCapture();
    if (!live()) void enableCamera();
  },
  exit() {
    capturing = false;
    stopCam();
    if (fxRAF) {
      cancelAnimationFrame(fxRAF);
      fxRAF = 0;
    }
    signal = null;
  },
};

// ---- controls (wired once) ------------------------------------------------------------------

take.onclick = () => void capture();
webcamBtn.onclick = () => void enableCamera();

document.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => {
  b.onclick = () => {
    if (capturing) return;
    session.lens = b.dataset.filter as LensId;
    resetFacePlacement();
    sfx();
    updateEffects();
  };
});
$('frame-toggle').onclick = () => {
  if (capturing) return;
  session.frameOn = !session.frameOn;
  sfx();
  updateEffects();
};
$<HTMLSelectElement>('lens-variant').onchange = () => {
  if (capturing || !isVariantLens(session.lens)) return;
  session.lensChoice[session.lens] = $<HTMLSelectElement>('lens-variant').value;
  sfx();
  updateEffects();
};
$('auto-face').onclick = () => {
  resetFacePlacement();
  updateEffects();
};
viewfinder.addEventListener('click', (e) => {
  if (!isFaceLens(session.lens) || capturing) return;
  const r = viewfinder.getBoundingClientRect();
  faces.place(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1), session.count);
  faceNote();
  paintEffect(previewPose);
});
