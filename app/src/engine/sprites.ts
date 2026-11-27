// Sprite sheets: 5 columns of 256x192 frames, drawn with smoothing off (native-resolution pixels).
export const FRAME_W = 256;
export const FRAME_H = 192;
const COLS = 5;

export function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
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
