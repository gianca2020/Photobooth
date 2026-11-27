// Sprite sheets: 5 columns of 256x192 frames, drawn with smoothing off (native-resolution pixels).
export const FRAME_W = 256;
export const FRAME_H = 192;
const COLS = 5;

/** Start loading a picture now, and decode it as soon as it arrives so the first draw doesn't stall. */
export function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  img.decode().catch(() => {}); // a failed decode just means it is decoded on first use, as before
  return img;
}

export const isReady = (img: HTMLImageElement): boolean => img.complete && img.naturalWidth > 0;

export function drawFrame(canvas: HTMLCanvasElement, sheet: HTMLImageElement, n: number): void {
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, FRAME_W, FRAME_H);
  g.imageSmoothingEnabled = false;
  if (isReady(sheet)) {
    g.drawImage(sheet, (n % COLS) * FRAME_W, Math.floor(n / COLS) * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
  }
}

const scratch = document.createElement('canvas');

/**
 * The sprite drawn at w x h (nearest-neighbour) with every colour turned white and its transparency kept:
 * the same result as the canvas filter `brightness(0) invert(1)`, but built from compositing, which every
 * browser has. Safari's canvas ignores `filter`, so the run-in doorway outline used to come out as smeared
 * copies of the coloured sprite there. The returned canvas is reused by the next call.
 */
export function whiteSilhouette(sprite: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  scratch.width = w; // resizing also clears it
  scratch.height = h;
  const g = scratch.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(sprite, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return scratch;
}
