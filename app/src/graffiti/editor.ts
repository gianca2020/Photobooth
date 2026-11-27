// The post-capture graffiti editor (Draft 27 openGraffiti/closeGraffiti/graffiti*): a dialog on the reveal
// with one 256x192 drawing layer per photo. Pen, eraser, 12 stamps, 3 colours, size S/M/L, per-photo undo
// (35 deep) and clear. "Done" bakes each drawn layer into its photo.
import type { Photo, Session } from '../app/state';
import { demoImage } from '../camera/source';
import { toPhoto } from '../photo/compose';
import { $ } from '../ui/dom';
import { LAYER_H, LAYER_W, PixelCanvas } from './pixel-canvas';
import { isStamp } from './stamps';

const UNDO_DEPTH = 35;

export interface Editor {
  /** Close without applying. `restoreFocus` puts focus back on the Graffiti button. */
  close(restoreFocus?: boolean): void;
}

export function setupEditor(session: Session, onApplied: () => void): Editor {
  const layer = new PixelCanvas($<HTMLCanvasElement>('graffiti-ink'), UNDO_DEPTH);
  const canvas = layer.canvas;
  const size = $<HTMLSelectElement>('graffiti-size');
  const palette = $('post-palette');
  const editor = $('graffiti-editor');
  const status = $('graffiti-status');
  const done = $<HTMLButtonElement>('graffiti-done');

  let index = 0;
  let tool = 'pen'; // 'pen' | 'eraser' | a stamp name
  let color = '#171717';
  let pointer: number | null = null;
  let last: { x: number; y: number } | null = null;
  let epoch = 0;
  let busy = false;
  let bases: string[] = [];
  let layers: HTMLCanvasElement[] = [];
  let histories: ImageData[][] = [];

  const brush = () => ({ color, size: +size.value });
  const tabs = () => document.querySelectorAll<HTMLElement>('[data-gphoto]');

  function controls(): void {
    document.querySelectorAll<HTMLElement>('[data-gtool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gtool === tool)));
    document.querySelectorAll<HTMLElement>('[data-poststamp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.poststamp === tool)));
    document.querySelectorAll<HTMLElement>('[data-gcolor]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gcolor === color)));
    tabs().forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.gphoto! === index)));
    $<HTMLButtonElement>('graffiti-undo').disabled = !layer.canUndo;
  }

  function saveLayer(): void {
    layers[index]?.getContext('2d')!.putImageData(layer.ctx.getImageData(0, 0, LAYER_W, LAYER_H), 0, 0);
  }

  function select(i: number): void {
    if (busy) return;
    saveLayer();
    index = i;
    layer.useHistory(histories[i]!);
    $<HTMLImageElement>('graffiti-base').src = bases[i]!;
    layer.clear();
    layer.ctx.drawImage(layers[i]!, 0, 0);
    controls();
  }

  function snapshot(): void {
    layer.snapshot();
    controls();
  }

  function open(): void {
    palette.classList.add('hidden');
    $('post-stamps').setAttribute('aria-expanded', 'false');
    epoch++;
    busy = false;
    index = 0;
    tool = 'pen';
    color = '#171717';
    pointer = null;
    last = null;
    bases = [0, 1, 2, 3].map((i) => session.shots[i]?.url ?? demoImage(session.count, i).src);
    layers = bases.map(() => {
      const c = document.createElement('canvas');
      c.width = LAYER_W;
      c.height = LAYER_H;
      return c;
    });
    histories = [[], [], [], []];
    layer.reset();
    $('graffiti-tabs').innerHTML = bases.map((_, i) => `<button type="button" class="secondary" data-gphoto="${i}" aria-pressed="false">Photo ${i + 1}</button>`).join('');
    tabs().forEach((b) => (b.onclick = () => select(+b.dataset.gphoto!)));
    editor.classList.remove('hidden');
    $('reveal-full').classList.add('editing');
    status.textContent = '';
    done.disabled = false;
    select(0);
    $('graffiti-tabs').querySelector('button')!.focus();
  }

  function close(restoreFocus = true): void {
    epoch++;
    busy = false;
    pointer = null;
    last = null;
    editor.classList.add('hidden');
    $('reveal-full').classList.remove('editing');
    if (restoreFocus) $('graffiti-open').focus();
  }

  /** The photo with its doodle layer baked in (at the photo's own resolution), or null if nothing was drawn. */
  async function bake(src: string, doodle: HTMLCanvasElement): Promise<Photo | null> {
    const d = doodle.getContext('2d')!.getImageData(0, 0, LAYER_W, LAYER_H).data;
    if (!d.some((v, j) => j % 4 === 3 && v > 0)) return null;
    const im = new Image();
    await new Promise<void>((resolve, reject) => {
      im.onload = () => resolve();
      im.onerror = reject;
      im.src = src;
    });
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(im, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(doodle, 0, 0, c.width, c.height);
    return toPhoto(c);
  }

  async function apply(): Promise<void> {
    if (busy) return;
    saveLayer();
    busy = true;
    const mine = epoch;
    done.disabled = true;
    status.textContent = 'Applying your doodles…';
    const made: (Photo | null)[] = [];
    try {
      for (let i = 0; i < 4; i++) {
        made.push(await bake(bases[i]!, layers[i]!));
      }
      if (mine !== epoch) {
        made.forEach((p) => p && URL.revokeObjectURL(p.url)); // left or reopened meanwhile: drop the result
        return;
      }
      const next = [0, 1, 2, 3].map((i) => made[i] ?? session.shots[i] ?? null);
      session.shots.forEach((old, i) => old && made[i] && URL.revokeObjectURL(old.url));
      session.shots = next;
      onApplied();
      close();
    } catch {
      made.forEach((p) => p && URL.revokeObjectURL(p.url));
      if (mine === epoch) {
        status.textContent = 'Could not apply doodles. Try again.';
        busy = false;
        done.disabled = false;
      }
    }
  }

  // ---- wiring (once) -----------------------------------------------------------------------
  $('graffiti-open').onclick = open;
  $('graffiti-cancel').onclick = () => close();
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  done.onclick = () => void apply();

  document.querySelectorAll<HTMLElement>('[data-gtool]').forEach((b) => {
    b.onclick = () => {
      tool = b.dataset.gtool!;
      controls();
    };
  });
  document.querySelectorAll<HTMLElement>('[data-gcolor]').forEach((b) => {
    b.onclick = () => {
      color = b.dataset.gcolor!;
      if (tool === 'eraser') tool = 'pen';
      controls();
    };
  });
  $('post-stamps').onclick = () => {
    const show = palette.classList.toggle('hidden') === false;
    $('post-stamps').setAttribute('aria-expanded', String(show));
  };
  document.querySelectorAll<HTMLElement>('[data-poststamp]').forEach((b) => {
    b.onclick = () => {
      tool = b.dataset.poststamp!;
      palette.classList.add('hidden');
      $('post-stamps').setAttribute('aria-expanded', 'false');
      controls();
    };
  });
  $('graffiti-undo').onclick = () => {
    if (busy) return;
    layer.undo();
    controls();
  };
  $('graffiti-clear').onclick = () => {
    if (busy) return;
    snapshot();
    layer.clear();
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (busy || pointer !== null || e.button !== 0) return;
    e.preventDefault();
    snapshot();
    const p = layer.point(e);
    if (isStamp(tool)) {
      layer.stamp(tool, p.x, p.y, brush());
      return;
    }
    pointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    last = p;
    layer.line(p, p, tool === 'eraser' ? 'eraser' : 'pen', brush());
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer || !last) return;
    const p = layer.point(e);
    layer.line(last, p, tool === 'eraser' ? 'eraser' : 'pen', brush());
    last = p;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, (e) => {
      if ((e as PointerEvent).pointerId === pointer) {
        pointer = null;
        last = null;
      }
    });
  }

  return { close };
}
