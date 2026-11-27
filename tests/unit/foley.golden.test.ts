// Golden test: our TypeScript sound generators must produce exactly the samples Draft 27's own
// code produces. We pull the original functions out of reference/draft27.html and run them
// against a fake AudioContext that captures the buffer they fill.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderCoin, renderOpening } from '../../app/src/audio/render';

const html = readFileSync(new URL('../../reference/draft27.html', import.meta.url), 'utf8');
const grab = (name: string): string => {
  const m = html.match(new RegExp(`^function ${name}\\(.*$`, 'm'));
  if (!m) throw new Error(`${name} not found in reference`);
  return m[0];
};

function runReference(name: 'coinSound' | 'openingSound', kind: string): Float32Array {
  let captured: Float32Array | null = null;
  class FakeContext {
    state = 'running';
    destination = {};
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      captured = data;
      return { getChannelData: () => data };
    }
    createBufferSource() {
      return { connect() {}, start() {}, set buffer(_b: unknown) {} };
    }
  }
  const factory = new Function('window', 'sound', `let ctx; ${grab(name)}; return ${name};`);
  factory({ AudioContext: FakeContext }, true)(kind);
  if (!captured) throw new Error('reference did not render a buffer');
  return captured;
}

describe('foley matches Draft 27 sample for sample', () => {
  for (const kind of ['tick', 'spin', 'clunk'] as const) {
    it(`coinSound ${kind}`, () => {
      const expected = runReference('coinSound', kind);
      const actual = renderCoin(kind);
      expect(actual.length).toBe(expected.length);
      expect(Buffer.from(actual.buffer).equals(Buffer.from(expected.buffer))).toBe(true);
    });
  }
  for (const kind of ['cash', 'erase', 'shutter'] as const) {
    it(`openingSound ${kind}`, () => {
      const expected = runReference('openingSound', kind);
      const actual = renderOpening(kind);
      expect(actual.length).toBe(expected.length);
      expect(Buffer.from(actual.buffer).equals(Buffer.from(expected.buffer))).toBe(true);
    });
  }
});
