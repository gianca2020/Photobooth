// The stamp palette buttons in index.html carry inline SVG copies of the bitmaps (kept as is for
// pixel parity). This test makes sure those copies can never drift from graffiti/stamps.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAMPS, isStamp, type StampName } from '../../app/src/graffiti/stamps';

const html = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');
const VIEWBOX = 11;

function tiles(attr: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const re = new RegExp(`<button[^>]*${attr}="([a-z]+)"[^>]*>\\s*<svg([^>]*)>(.*?)</svg>`, 'gs');
  for (const m of html.matchAll(re)) {
    expect(m[2]).toContain(`viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"`);
    const rects = [...m[3]!.matchAll(/<rect x="(\d+)" y="(\d+)" width="1" height="1"\/>/g)].map((r) => `${r[1]},${r[2]}`);
    expect(m[3]!.match(/<rect/g)?.length).toBe(rects.length); // no rect with other attributes
    found.set(m[1]!, rects);
  }
  return found;
}

// Where a bitmap's cells land in the 11x11 SVG: centred, rounded down.
function expectedRects(rows: readonly string[]): string[] {
  const ox = Math.floor((VIEWBOX - rows[0]!.length) / 2);
  const oy = Math.floor((VIEWBOX - rows.length) / 2);
  const out: string[] = [];
  rows.forEach((row, y) => [...row].forEach((v, x) => v === '1' && out.push(`${x + ox},${y + oy}`)));
  return out;
}

describe('stamp bitmaps', () => {
  it('are the twelve Draft 27 stamps, all rectangular 1-bit grids', () => {
    expect(Object.keys(STAMPS)).toEqual(['heart', 'star', 'cat', 'note', 'flower', 'clover', 'sparkle', 'paw', 'speech', 'smile', 'bow', 'bolt']);
    for (const rows of Object.values(STAMPS)) {
      expect(rows.every((r) => /^[01]+$/.test(r) && r.length === rows[0]!.length)).toBe(true);
    }
  });

  it('isStamp separates stamps from the pen and eraser', () => {
    expect(isStamp('heart')).toBe(true);
    expect(isStamp('pen')).toBe(false);
    expect(isStamp('eraser')).toBe(false);
    expect(isStamp('toString')).toBe(false);
  });

  for (const attr of ['data-livestamp', 'data-poststamp']) {
    it(`every ${attr} SVG tile draws exactly its bitmap`, () => {
      const svgs = tiles(attr);
      if (attr === 'data-livestamp') expect([...svgs.keys()]).toEqual(Object.keys(STAMPS));
      for (const [name, rects] of svgs) {
        expect(isStamp(name)).toBe(true);
        expect(rects, name).toEqual(expectedRects(STAMPS[name as StampName]));
      }
    });
  }
});
