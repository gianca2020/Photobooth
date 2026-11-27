// The saved picture: the 4-strip (480 x 1470) or the 2x2 grid (960 x 800), composed exactly like
// Draft 27's downloadPhoto, with the brand line matching the on-screen footer and, if guests typed names,
// a names line under it (the picture grows by one line then). Plus Save (download) and Share (share sheet).
import type { PhotoFormat, Session } from '../app/state';
import { demoImage } from '../camera/source';
import { namesLine } from './names';

const FILE_NAME = 'little-photo-club.png';
const BRAND = 'little photo ✳ club';
const NAMES_BAND = 40; // extra height for the names line

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`could not load ${src}`));
    im.src = src;
  });
}

/** Shrink the font until `text` fits in `maxWidth`; cut with an ellipsis if even the smallest doesn't. */
function fitText(g: CanvasRenderingContext2D, text: string, family: string, maxWidth: number, start: number, min: number): string {
  for (let size = start; size >= min; size--) {
    g.font = `${size}px ${family}`;
    if (g.measureText(text).width <= maxWidth) return text;
  }
  let cut = text;
  while (cut.length > 1 && g.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export async function composeExport(session: Session, format: PhotoFormat = session.format): Promise<Blob> {
  const grid = format === 'grid';
  const names = namesLine(session);
  const w = grid ? 960 : 480;
  const baseH = grid ? 800 : 1470;
  const h = names ? baseH + NAMES_BAND : baseH;
  const root = getComputedStyle(document.documentElement);
  const family = root.getPropertyValue('--marker').trim();
  const ink = root.getPropertyValue('--ink').trim() || '#171717';
  await document.fonts.load(`25px ${family}`).catch(() => []); // the footer must not be drawn in a fallback font

  const images = await Promise.all([0, 1, 2, 3].map((i) => loadImage(session.shots[i]?.url ?? demoImage(session.count, i).src)));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  const pw = grid ? 438 : 440;
  const ph = pw * 0.75;
  images.forEach((im, i) => {
    const x = grid ? 32 + (i % 2) * 458 : 20;
    const y = grid ? 28 + Math.floor(i / 2) * 350 : 18 + i * 350;
    g.drawImage(im, x, y, pw, ph);
  });
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.font = `25px ${family}`;
  g.fillText(BRAND, w / 2, baseH - 24);
  if (names) {
    const line = fitText(g, names, family, w - 40, 21, 12);
    g.fillText(line, w / 2, h - 14);
  }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode the picture'))), 'image/png'));
}

/** Hand the picture to the browser as a download. */
export function saveBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = FILE_NAME;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000); // some browsers read the file after the click returns
}

const asFile = (blob: Blob): File => new File([blob], FILE_NAME, { type: 'image/png' });

/** Can this browser share an image file (phones' share sheet)? */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [asFile(new Blob([], { type: 'image/png' }))] });
  } catch {
    return false;
  }
}

/** Open the share sheet. Resolves true if shared, false if the guest closed the sheet. Throws on real errors. */
export async function shareBlob(blob: Blob): Promise<boolean> {
  try {
    await navigator.share({ files: [asFile(blob)] });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}
