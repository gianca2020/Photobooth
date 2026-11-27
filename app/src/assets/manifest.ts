// Every extracted asset, by role. Files live in app/public and are verified by assets.lock.json.
export const art = {
  coinSheet: '/art/coin-sheet.png',
  welcomeSheet: '/art/welcome-sheet.png',
  guests: [1, 2, 3, 4].map((n) => `/art/guests/guests-${n}.png`),
  run: {
    booth: '/art/run/booth.png',
    open: '/art/run/booth-open.png',
    runners: [1, 2, 3, 4].map((n) => `/art/run/runner-${n}.png`),
  },
  /** Demo art: demo[guestCount - 1][pose]. */
  demo: [1, 2, 3, 4].map((g) => [0, 1, 2, 3].map((p) => `/art/demo/demo-${g}-${p}.png`)),
  doodleFrame: '/art/doodle-frame.png',
} as const;

export const audioFiles = { guestPop: '/audio/guest-pop.wav' } as const;
