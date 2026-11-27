// The photo strip / 2x2 grid markup shown on the dispenser card and the reveal (Draft 27 stripHTML),
// plus the guest names that now print under the brand line.
import type { PhotoFormat, Session } from '../app/state';
import { demoImage } from '../camera/source';
import { escapeHTML, namesLine } from './names';

export function stripHTML(session: Session, format: PhotoFormat = session.format): string {
  const shots = [0, 1, 2, 3].map((i) => {
    const shot = session.shots[i];
    return `<div class="shot">${shot ? `<img alt="Photo ${i + 1}" src="${shot.url}">` : `<img alt="Demo photo ${i + 1}" src="${demoImage(session.count, i).src}">`}</div>`;
  });
  const names = namesLine(session);
  // The newline between the two lines is invisible (a grid ignores whitespace) but keeps their words apart for assistive tech.
  return `<div class="photo-strip ${format === 'grid' ? 'grid' : ''}">${shots.join('')}<div class="strip-footer">little photo \u2733 club</div>${names ? `\n<div class="strip-names">${escapeHTML(names)}</div>` : ''}</div>`;
}

/** Mark the 4-strip / 2x2 buttons on the delivery scene to match the session. */
export function syncFormatButtons(session: Pick<Session, 'format'>): void {
  document.querySelectorAll<HTMLElement>('[data-format]').forEach((b) => {
    b.classList.toggle('selected', b.dataset.format === session.format);
    b.setAttribute('aria-pressed', String(b.dataset.format === session.format));
  });
}
