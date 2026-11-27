import type { LensId, VariantLens } from '../../app/state';
import type { Face } from '../types';
import { drawAccessories } from './accessories';
import { emotePixels } from './emote';
import { processPixels } from './pixels';
import { warpPixels } from './warp';

export { processPixels };

export const LENS_TITLES: Record<LensId, string> = {
  classic: 'Classic',
  flipnote: 'Flipnote Ink',
  mischief: 'Mischief',
  warp: 'Distortion',
  orange: 'Orange Lens',
  '2009': '2009 Lens',
  emoter: 'Emoter',
};

export const LENS_NOTES: Record<LensId, string> = {
  classic: 'Clean black & white',
  flipnote: 'Original two-tone Flipnote pixels',
  mischief: 'Pixel accessories · tap the center of a face to adjust',
  warp: 'Cartoon distortion · tap a face to aim',
  orange: 'Black & white with orange objects in color · try an orange object',
  '2009': 'VGA color · faded digicam tones · 640 × 480',
  emoter: 'Happy, sad or angry · tap a face to aim',
};

export const LENS_VARIANTS: Record<VariantLens, [string, string][]> = {
  mischief: [['mustache', 'Mustache'], ['glasses', 'Glasses'], ['ears', 'Cat ears'], ['all', 'All three']],
  warp: [['bulge', 'Big head'], ['pinch', 'Tiny face'], ['wide', 'Wide face']],
  emoter: [['happy', 'Happy'], ['sad', 'Sad'], ['angry', 'Angry']],
};

export const isFaceLens = (lens: LensId): boolean => lens === 'mischief' || lens === 'warp' || lens === 'emoter';
export const isVariantLens = (lens: LensId): lens is VariantLens => lens in LENS_VARIANTS;

/** Working resolution of a lens: Flipnote works on the native 256x192 grid, everything else at VGA. */
export const filterSize = (lens: LensId): [number, number] => (lens === 'flipnote' ? [256, 192] : [640, 480]);

export function applyLens(g: CanvasRenderingContext2D, w: number, h: number, lens: LensId, faces: Face[], choice: Record<VariantLens, string>): void {
  if (lens === 'warp') warpPixels(g, w, h, faces, choice.warp);
  if (lens === 'emoter') emotePixels(g, w, h, faces, choice.emoter);
  processPixels(g, w, h, lens);
  if (lens === 'mischief') drawAccessories(g, w, h, faces, choice.mischief);
}
