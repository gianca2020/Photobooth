// One-time extractor: decodes every base64 asset in reference/draft27.html byte for byte
// (no re-encoding, no optimisation) into app/public, and writes assets.lock.json.
// Usage: node tools/extract-assets.mjs [--check]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'reference/draft27.html'), 'utf8');
const out = join(root, 'app/public');
const check = process.argv.includes('--check');

// Names follow source order of the PNG payloads in Draft 27 (stable, asserted below).
const pngNames = [
  'art/arcade-camera', 'art/doodle-frame', 'art/dispenser', 'art/envelope', 'art/finished-envelope',
  ...[1, 2, 3, 4].map((n) => `art/guests/guests-${n}`),
  'art/run/booth', 'art/run/booth-open', ...[1, 2, 3, 4].map((n) => `art/run/runner-${n}`),
  ...[1, 2, 3, 4].flatMap((g) => [0, 1, 2, 3].map((p) => `art/demo/demo-${g}-${p}`)),
  'art/frame-asset', 'art/coin-sheet',
  ...Array.from({ length: 10 }, (_, i) => `art/flash/mask-${i}`),
  'art/welcome-sheet',
];

const re = /data:(image\/png|audio\/wav);base64,([A-Za-z0-9+/=]+)/g;
const items = [];
let pngIndex = 0;
for (const m of html.matchAll(re)) {
  const bytes = Buffer.from(m[2], 'base64');
  const isPng = m[1] === 'image/png';
  const name = isPng ? pngNames[pngIndex++] : 'audio/guest-pop';
  items.push({ name: `${name}.${isPng ? 'png' : 'wav'}`, bytes, offset: m.index });
}
if (pngIndex !== pngNames.length) throw new Error(`expected ${pngNames.length} PNGs, found ${pngIndex}`);
if (items.length !== 45) throw new Error(`expected 45 assets, found ${items.length}`);

const lock = {};
const byHash = new Map();
for (const it of items) {
  const md5 = createHash('md5').update(it.bytes).digest('hex');
  const sha256 = createHash('sha256').update(it.bytes).digest('hex');
  const dim = it.name.endsWith('.png') ? { width: it.bytes.readUInt32BE(16), height: it.bytes.readUInt32BE(20) } : {};
  if (byHash.has(md5)) {
    lock[it.name] = { duplicateOf: byHash.get(md5), md5, sourceOffset: it.offset };
    continue;
  }
  byHash.set(md5, it.name);
  lock[it.name] = { md5, sha256, size: it.bytes.length, ...dim, sourceOffset: it.offset };
  const dest = join(out, it.name);
  if (check) {
    if (!existsSync(dest) || createHash('md5').update(readFileSync(dest)).digest('hex') !== md5) {
      console.error(`MISMATCH ${it.name}`);
      process.exitCode = 1;
    }
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, it.bytes);
  }
}
if (!check) writeFileSync(join(root, 'assets.lock.json'), JSON.stringify(lock, null, 2) + '\n');
const dupes = Object.values(lock).filter((v) => v.duplicateOf).length;
console.log(`${check ? 'checked' : 'extracted'} ${items.length} payloads (${items.length - dupes} unique files, ${dupes} duplicates)`);
