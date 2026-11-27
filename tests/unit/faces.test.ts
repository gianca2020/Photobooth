import { beforeEach, describe, expect, it } from 'vitest';
import { toFace } from '../../app/src/camera/detector';
import * as faces from '../../app/src/camera/faces';

describe('toFace', () => {
  it('turns a pixel box into a centred 0-1 face', () => {
    expect(toFace(100, 60, 80, 100, 320, 240)).toEqual({ x: 140 / 320, y: 110 / 240, w: 80 / 320, h: 100 / 240 });
  });
  it('rejects empty or non-finite boxes', () => {
    expect(toFace(0, 0, 0, 10, 320, 240)).toBeNull();
    expect(toFace(0, 0, 10, -1, 320, 240)).toBeNull();
    expect(toFace(NaN, 0, 10, 10, 320, 240)).toBeNull();
  });
});

describe('tracked faces (Draft 27 smoothing)', () => {
  beforeEach(() => faces.reset());
  const f = (x: number, y = 0.5, w = 0.2, h = 0.3) => ({ x, y, w, h });

  it('takes the first detection as is', () => {
    faces.setTracked([f(0.5)], 1000);
    expect(faces.getTracked()).toEqual([f(0.5)]);
  });

  it('eases a nearby match toward the new box (35% old, 65% new)', () => {
    faces.setTracked([f(0.5)], 1000);
    faces.setTracked([f(0.56)], 1170);
    expect(faces.getTracked()[0]!.x).toBeCloseTo(0.5 * 0.35 + 0.56 * 0.65, 10);
  });

  it('treats a far-away box (>= 0.10) as a different face', () => {
    faces.setTracked([f(0.3)], 1000);
    faces.setTracked([f(0.6)], 1170);
    expect(faces.getTracked()).toEqual([f(0.6)]);
  });

  it('keeps at most four faces', () => {
    faces.setTracked([f(0.1), f(0.3), f(0.5), f(0.7), f(0.9)], 1000);
    expect(faces.getTracked()).toHaveLength(4);
  });

  it('holds faces through brief dropouts, forgets after 0.8 s', () => {
    faces.setTracked([f(0.5)], 1000);
    faces.setTracked([], 1500);
    expect(faces.getTracked()).toHaveLength(1);
    faces.setTracked([], 1801);
    expect(faces.getTracked()).toHaveLength(0);
  });

  it('reset() clears tracked and manual faces and bumps the generation', () => {
    faces.setTracked([f(0.5)], 1000);
    faces.place(0.4, 0.4, 2);
    const gen = faces.getGeneration();
    faces.reset();
    expect(faces.getTracked()).toEqual([]);
    expect(faces.getManual()).toEqual([]);
    expect(faces.getGeneration()).toBe(gen + 1);
  });
});

describe('activeFaces priority', () => {
  beforeEach(() => faces.reset());
  it('manual beats tracked beats demo positions', () => {
    expect(faces.activeFaces(false, 2)).toHaveLength(2); // demo art
    expect(faces.activeFaces(true, 2)).toEqual([]); // live, nothing tracked yet
    faces.setTracked([{ x: 0.5, y: 0.5, w: 0.2, h: 0.3 }], 1000);
    expect(faces.activeFaces(true, 2)).toHaveLength(1);
    faces.place(0.2, 0.2, 2);
    expect(faces.activeFaces(true, 2)[0]).toMatchObject({ x: 0.2, y: 0.2 });
  });
  it('with one guest a new tap replaces the face; with several it adds up to the guest count', () => {
    faces.place(0.3, 0.3, 1);
    faces.place(0.6, 0.6, 1);
    expect(faces.getManual()).toHaveLength(1);
    faces.reset();
    faces.place(0.3, 0.3, 2);
    faces.place(0.6, 0.6, 2);
    expect(faces.getManual()).toHaveLength(2);
    faces.place(0.8, 0.8, 2);
    expect(faces.getManual()).toHaveLength(1);
  });
});
