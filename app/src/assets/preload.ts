// Issue #4: Draft 27 had every image embedded, so nothing ever waited for a download. Here each picture is a
// file, so the ones guests are about to see are fetched and decoded ahead of time. Everything is tiny (the
// whole art folder is a few hundred KB); the point is the round trip, not the bytes.
import { art } from './manifest';

// Held for the life of the page so the browser keeps the decoded pictures instead of dropping them.
const kept: HTMLImageElement[] = [];

const decodeQuietly = (img: HTMLImageElement): void => void img.decode().catch(() => {});

/**
 * Fetch and decode what is not already on its way. Pictures that scenes load for themselves (sheets, run-in
 * and demo art, the doodle frame) are decoded where they are loaded (engine/sprites.ts); the pictures built
 * into index.html are decoded here; the guests' portraits, which nothing requests until their screen, are
 * fetched here. Starts after the page's own load, so the coin and welcome sheets are never held up.
 */
export function preloadArt(): void {
  const start = (): void => {
    for (const url of art.guests) {
      const img = new Image();
      img.fetchPriority = 'low';
      img.src = url;
      kept.push(img);
      decodeQuietly(img);
    }
    document.querySelectorAll<HTMLImageElement>('img[src^="/art/"]').forEach(decodeQuietly);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
