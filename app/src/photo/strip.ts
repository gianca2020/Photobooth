// The photo strip / 2x2 grid markup shown on the dispenser card and the reveal (Draft 27 stripHTML).
import type { PhotoFormat, Session } from '../app/state';
import { demoImage } from '../camera/source';

export function stripHTML(session: Session, format: PhotoFormat = session.format): string {
  const shots = [0, 1, 2, 3].map((i) => {
    const shot = session.shots[i];
    return `<div class="shot">${shot ? `<img alt="Photo ${i + 1}" src="${shot.url}">` : `<img alt="Demo photo ${i + 1}" src="${demoImage(session.count, i).src}">`}</div>`;
  });
  return `<div class="photo-strip ${format === 'grid' ? 'grid' : ''}">${shots.join('')}<div class="strip-footer">little photo ✳ club</div></div>`;
}
