// Scene 5: delivery. Choose the layout (4-strip / 2x2), then Save (download) or Share (the phone's share
// sheet). Either one closes the envelope and moves on to "That's a wrap!", where "Next guests" starts over.
import { go, type Scene } from '../app/router';
import { resetSession, session, type PhotoFormat } from '../app/state';
import { sfx } from '../audio/foley';
import { timeout } from '../engine/clock';
import { canShareFiles, composeExport, saveBlob, shareBlob } from '../photo/export';
import { syncFormatButtons } from '../photo/strip';
import { $ } from '../ui/dom';

const layout = $('email-layout');
const finished = $('finished');
const envelope = $('envelope');
const saveBtn = $<HTMLButtonElement>('download');
const shareBtn = $<HTMLButtonElement>('share');

let signal: AbortSignal | null = null;
let busy = false;
// The picture is composed ahead of time (on entering and on a layout change) so Share can be called
// straight from the click: phones only allow the share sheet right after a tap.
let prepared: { key: string; blob: Promise<Blob> } | null = null;

const keyFor = (): string => `${session.format}|${session.count}|${session.names.join('\u0000')}|${session.shots.map((s) => s?.url ?? '-').join(',')}`;

function prepare(): Promise<Blob> {
  const key = keyFor();
  if (prepared?.key !== key) {
    const blob = composeExport(session);
    prepared = { key, blob };
    blob.catch(() => { if (prepared?.blob === blob) prepared = null; });
  }
  return prepared.blob;
}

function finish(): void {
  sfx();
  envelope.classList.add('sent');
  if (!signal) return;
  timeout(() => {
    layout.classList.add('hidden');
    finished.classList.remove('hidden');
  }, 700, signal);
}

async function deliver(how: 'save' | 'share'): Promise<void> {
  if (busy) return;
  busy = true;
  saveBtn.disabled = shareBtn.disabled = true;
  const mine = signal;
  try {
    const blob = await prepare();
    if (how === 'share') {
      if (await shareBlob(blob)) finish();
    } else {
      saveBlob(blob);
      finish();
    }
  } catch {
    if (mine === signal) alert('Could not create the preview image.');
  } finally {
    busy = false;
    saveBtn.disabled = shareBtn.disabled = false;
  }
}

export const deliverScene: Scene = {
  enter(ctx) {
    signal = ctx.signal;
    prepared = null;
    busy = false;
    layout.classList.remove('hidden');
    finished.classList.add('hidden');
    envelope.classList.remove('sent');
    saveBtn.disabled = shareBtn.disabled = false;
    shareBtn.hidden = !canShareFiles();
    syncFormatButtons(session);
    void prepare().catch(() => {}); // errors surface when the guest actually saves
  },
  exit() {
    signal = null;
    prepared = null;
  },
};

document.querySelectorAll<HTMLElement>('[data-format]').forEach((b) => {
  b.onclick = () => {
    session.format = b.dataset.format as PhotoFormat;
    sfx();
    syncFormatButtons(session);
    void prepare().catch(() => {});
  };
});
saveBtn.onclick = () => void deliver('save');
shareBtn.onclick = () => void deliver('share');
$('restart').onclick = () => {
  resetSession();
  go(-1, false);
};
