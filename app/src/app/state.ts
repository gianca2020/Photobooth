// The one place session data lives. It is reset between groups ("Next guests") and never persisted.
export type LensId = 'classic' | 'flipnote' | 'mischief' | 'warp' | 'orange' | '2009' | 'emoter';
export type VariantLens = 'mischief' | 'warp' | 'emoter';

/** A captured photo. The object URL is revoked when the session is cleared. */
export interface Photo {
  blob: Blob;
  url: string;
}

export interface Session {
  count: number;
  names: string[];
  lens: LensId;
  lensChoice: Record<VariantLens, string>;
  frameOn: boolean;
  /** One entry per pose; null if a frame could not be captured (callers fall back to the demo art). */
  shots: (Photo | null)[];
}

const freshChoice = (): Record<VariantLens, string> => ({ mischief: 'mustache', warp: 'bulge', emoter: 'happy' });

export const session: Session = {
  count: 1,
  names: ['', '', '', ''],
  lens: 'classic',
  lensChoice: freshChoice(),
  frameOn: false,
  shots: [],
};

export function clearShots(): void {
  for (const shot of session.shots) if (shot) URL.revokeObjectURL(shot.url);
  session.shots = [];
}

export function resetSession(): void {
  clearShots();
  session.count = 1;
  session.names = ['', '', '', ''];
  session.lens = 'classic';
  session.lensChoice = freshChoice();
  session.frameOn = false;
}
