// The dispenser's foley samples and card motion must equal Draft 27's own code. Both are cut out of
// reference/draft27.html and run next to ours.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dropPose, transformFor } from '../../app/src/dispenser/print';
import { renderPrintFoley } from '../../app/src/audio/render';

const html = readFileSync(new URL('../../reference/draft27.html', import.meta.url), 'utf8');

describe('print foley', () => {
  it('matches Draft 27 sample for sample', () => {
    const a = html.indexOf('function printFoley()');
    const b = html.indexOf('function renderDrop()');
    if (a < 0 || b < a) throw new Error('printFoley not found in reference');
    let captured: Float32Array | null = null;
    class FakeContext {
      state = 'running';
      destination = {};
      createBuffer(_c: number, length: number) {
        captured = new Float32Array(length);
        return { getChannelData: () => captured };
      }
      createBufferSource() {
        return { connect() {}, start() {}, set buffer(_b: unknown) {}, set onended(_f: unknown) {} };
      }
    }
    const factory = new Function('window', 'sound', `let ctx, printSource; ${html.slice(a, b)}; return printFoley;`);
    factory({ AudioContext: FakeContext }, true)();
    const expected = captured as Float32Array | null;
    if (!expected) throw new Error('reference did not render');
    const actual = renderPrintFoley();
    expect(actual.length).toBe(expected.length);
    expect(Buffer.from(actual.buffer).equals(Buffer.from(expected.buffer))).toBe(true);
  });
});

describe('card motion', () => {
  const a = html.indexOf(' function paint(t){');
  const b = html.indexOf(' function done()');
  if (a < 0 || b < a) throw new Error('paint() not found in reference');
  // Draft 27's paint(t), run against a fake card/slot that records the transform it sets.
  const make = new Function('card', 'mouth', `${html.slice(a, b)}; return paint;`);

  for (const [h, H] of [[420, 520], [260, 340], [300, 300], [120, 110], [500, 640]] as const) {
    it(`every frame of the 3 s timeline (card ${h}px in a ${H}px slot)`, () => {
      const card = { offsetHeight: h, style: { transform: '' } };
      const paint = make(card, { clientHeight: H });
      // 37 frames at 12 fps, plus the in-between times the stepped feed and the drop can land on
      const times = [...Array.from({ length: 37 }, (_, i) => i / 12), 0.249, 0.25, 0.3, 1.82, 1.83, 2.1, 2.17, 2.4, 2.66, 2.67, 2.9, 3, 3.5];
      for (const t of times) {
        paint(t);
        expect(transformFor(dropPose(t, h, H)), `t=${t}`).toBe(card.style.transform);
      }
    });
  }
});
