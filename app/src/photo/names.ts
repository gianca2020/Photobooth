// Guest names as they appear on the strip footer (pure helpers, no DOM).
import type { Session } from '../app/state';

export const escapeHTML = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The names the guests typed (only the guests actually present), blanks left out, joined for the footer. Empty if nobody typed one. */
export function namesLine(session: Pick<Session, 'count' | 'names'>): string {
  return session.names
    .slice(0, session.count)
    .map((n) => n.trim())
    .filter(Boolean)
    .join(' · ');
}
