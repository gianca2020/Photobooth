// The one place session data lives. It is reset between groups ("Next guests") and never persisted.
export interface Session {
  count: number;
  names: string[];
}

export const session: Session = { count: 1, names: ['', '', '', ''] };

export function resetSession(): void {
  session.count = 1;
  session.names = ['', '', '', ''];
}
