// Shape of the ?debug hook the app exposes for tests (see app/src/main.ts).
import type { Session } from '../../app/src/app/state';

declare global {
  interface Window {
    __lpc: { go: (index: number, animate?: boolean) => void; session: Session; resetSession: () => void };
  }
}
export {};
