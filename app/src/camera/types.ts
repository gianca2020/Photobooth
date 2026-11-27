/** Eye, nose and mouth positions of a detected face, in 0-1 coordinates of the 4:3 frame. */
export interface FaceMarks {
  /** Midpoint between the eyes. */
  eyeX: number;
  eyeY: number;
  /** Distance between the two eye centres. */
  eyeDist: number;
  noseX: number;
  noseY: number;
  mouthX: number;
  mouthY: number;
}

/** A face box in 0-1 coordinates of the 4:3 frame (centre x/y, width, height). */
export interface Face {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Present on faces from a live detector (and live taps); the demo art has hand-placed boxes only. */
  marks?: FaceMarks;
}
