import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Baselines are screenshots of reference/draft27.html (see tools/capture-reference.mjs).
  // BASELINE_DIR lets CI compare against a reference captured on the same OS (see .github/workflows/ci.yml).
  snapshotPathTemplate: `${process.env.BASELINE_DIR ?? 'tests/visual/baseline'}/{arg}{ext}`,
  webServer: {
    command: 'npx vite --port 5391 --strictPort',
    url: 'http://localhost:5391',
    reuseExistingServer: false, // never attach to some other project's dev server
  },
  use: { baseURL: 'http://localhost:5391', deviceScaleFactor: 1 },
  // 2 of 42 baseline shots vary by a few pixels between identical runs of the reference itself.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.0005 } },
  projects: [
    // Demo-mode and pixel-parity tests: no camera is ever available.
    { name: 'chromium', testIgnore: '**/camera-live.spec.ts', use: { browserName: 'chromium' } },
    // Tests that need a (fake) webcam stream.
    {
      name: 'chromium-fake-camera',
      testMatch: '**/camera-live.spec.ts',
      use: {
        browserName: 'chromium',
        permissions: ['camera'],
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
      },
    },
  ],
});
