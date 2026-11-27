// The DSi-style live graffiti layer over the viewfinder (#live-graffiti, 256x192). Port of Draft 27's
// "live*" code: Graffiti toggle, pen / eraser / stamps / clear, three colours, size S/M/L, undo (25 deep).
import { $ } from '../ui/dom';
import { PixelCanvas } from './pixel-canvas';
import { isStamp } from './stamps';

const UNDO_DEPTH = 25;

export interface LiveGraffiti {
  /** Back to Draft 27's start state: drawing off, heart stamp, black ink, empty layer, no undo. */
  reset(): void;
  /** True while the Graffiti toggle is on (the viewfinder click must not place faces then). */
  isDrawing(): boolean;
}

/** `isLocked` is true while the countdown runs: the toggle and the canvas ignore input. */
export function setupLiveGraffiti(isLocked: () => boolean): LiveGraffiti {
  const layer = new PixelCanvas($<HTMLCanvasElement>('live-graffiti'), UNDO_DEPTH);
  const canvas = layer.canvas;
  const size = $<HTMLSelectElement>('live-size');
  const palette = $('live-palette');
  const stampTiles = document.querySelectorAll<HTMLElement>('[data-livestamp]');
  const colorButtons = document.querySelectorAll<HTMLElement>('[data-livecolor]');

  let drawing = false;
  let tool = 'heart'; // 'pen' | 'eraser' | a stamp name
  let color = '#171717';
  let pointer: number | null = null;
  let last: { x: number; y: number } | null = null;

  const brush = () => ({ color, size: +size.value });

  function controls(): void {
    $('live-toggle').setAttribute('aria-pressed', String(drawing));
    $('live-options').classList.toggle('hidden', !drawing);
    canvas.parentElement!.classList.toggle('live-drawing', drawing);
    $('live-pen').setAttribute('aria-pressed', String(tool === 'pen'));
    $('live-eraser').setAttribute('aria-pressed', String(tool === 'eraser'));
    $('live-stamps').setAttribute('aria-pressed', String(isStamp(tool)));
    stampTiles.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.livestamp === tool)));
    colorButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.livecolor === color)));
    $<HTMLButtonElement>('live-undo').disabled = !layer.canUndo;
  }

  function showPalette(show: boolean): void {
    palette.classList.toggle('hidden', !show);
    $('live-stamps').setAttribute('aria-expanded', String(show));
  }

  function snapshot(): void {
    layer.snapshot();
    controls();
  }

  function reset(): void {
    drawing = false;
    tool = 'heart';
    color = '#171717';
    pointer = null;
    last = null;
    layer.reset();
    showPalette(false);
    controls();
  }

  $('live-toggle').onclick = () => {
    if (isLocked()) return;
    drawing = !drawing;
    if (!drawing) showPalette(false);
    controls();
  };
  $('live-pen').onclick = () => {
    tool = 'pen';
    showPalette(false);
    controls();
  };
  $('live-eraser').onclick = () => {
    tool = 'eraser';
    showPalette(false);
    controls();
  };
  $('live-stamps').onclick = () => {
    if (!isStamp(tool)) tool = 'heart';
    showPalette(palette.classList.contains('hidden'));
    controls();
  };
  stampTiles.forEach((b) => {
    b.onclick = () => {
      tool = b.dataset.livestamp!;
      showPalette(false);
      controls();
    };
  });
  colorButtons.forEach((b) => {
    b.onclick = () => {
      color = b.dataset.livecolor!;
      controls();
    };
  });
  $('live-clear').onclick = () => {
    snapshot();
    layer.clear();
  };
  $('live-undo').onclick = () => {
    layer.undo();
    controls();
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!drawing || isLocked() || pointer !== null || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    snapshot();
    const p = layer.point(e);
    if (isStamp(tool)) {
      layer.stamp(tool, p.x, p.y, brush());
      return;
    }
    pointer = e.pointerId;
    last = p;
    canvas.setPointerCapture(e.pointerId);
    layer.line(p, p, tool === 'eraser' ? 'eraser' : 'pen', brush());
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer || !last || isLocked()) return;
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

  return { reset, isDrawing: () => drawing };
}
