// One-time split of reference/draft27.html into app/index.html (markup) and
// app/src/styles/draft27.css (CSS, verbatim). Embedded base64 images in the markup are
// swapped for the files extracted by tools/extract-assets.mjs. The script body is NOT
// copied: it is re-implemented as TypeScript modules.
// Usage: node tools/split-reference.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'reference/draft27.html'), 'utf8');
const lock = JSON.parse(readFileSync(join(root, 'assets.lock.json'), 'utf8'));

const styleOpen = html.indexOf('<style>') + '<style>'.length;
const styleClose = html.indexOf('</style>');
const css = html.slice(styleOpen, styleClose);

const bodyStart = html.indexOf('<body>') + '<body>'.length;
const scriptStart = html.indexOf('<script>');
let markup = html.slice(bodyStart, scriptStart);

// offset (in the whole file) -> published asset path
const byOffset = new Map();
for (const [name, info] of Object.entries(lock)) byOffset.set(info.sourceOffset, info.duplicateOf ?? name);

let replaced = 0;
markup = markup.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, (match, offsetInMarkup) => {
  const name = byOffset.get(bodyStart + offsetInMarkup);
  if (!name) throw new Error(`no extracted asset for markup offset ${offsetInMarkup}`);
  replaced++;
  return `/${name}`;
});

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Little Photo Club</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/src/styles/draft27.css">
<link rel="stylesheet" href="/src/styles/production.css">
</head>
<body>`;

mkdirSync(join(root, 'app/src/styles'), { recursive: true });
writeFileSync(join(root, 'app/src/styles/draft27.css'), css.replace(/^\n/, ''));
writeFileSync(join(root, 'app/index.html'), `${head}${markup}<script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n`);
console.log(`css ${css.length} bytes, markup ${markup.length} bytes, ${replaced} images replaced by paths`);
