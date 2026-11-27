import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// MediaPipe's wasm runtime is served from our own domain (never a CDN) so no third party sees the
// camera feature being used. It is read straight from node_modules, so the repo doesn't commit 15 MB
// of binaries and the version is pinned by package-lock.json.
function mediapipeWasm(): Plugin {
  const dir = fileURLToPath(new URL('./node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url));
  const base = '/models/mediapipe/wasm/';
  const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use(base, (req, res, next) => {
        const name = (req.url ?? '').split('?')[0]!.replace(/^\//, '');
        if (!files.includes(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(dir + name));
      });
    },
    generateBundle() {
      for (const name of files) this.emitFile({ type: 'asset', fileName: base.slice(1) + name, source: readFileSync(dir + name) });
    },
  };
}

export default defineConfig({
  root: 'app',
  publicDir: 'public',
  plugins: [mediapipeWasm()],
  build: { outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['tests/unit/**/*.test.ts'] },
});
