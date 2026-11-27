// Scene 4: the photo dispenser. The strip prints and drops into the tray; picking it up opens the full
// reveal (with the Graffiti editor), then "Keep it" goes on to delivery and "Retake" back to the camera.
import { go, type Scene } from '../app/router';
import { session } from '../app/state';
import { printFoley, sfx } from '../audio/foley';
import { runPrint, showLanded } from '../dispenser/print';
import { setupEditor } from '../graffiti/editor';
import { stripHTML, syncFormatButtons } from '../photo/strip';
import { $, prefersReducedMotion } from '../ui/dom';

const card = $<HTMLButtonElement>('fall');
const mouth = card.parentElement!;
const dropArea = $('drop-area');
const full = $('reveal-full');
const decision = $('decision');
const reviewNext = $('review-next');

let printAbort: AbortController | null = null;

const stopPrint = (): void => {
  printAbort?.abort();
  printAbort = null;
};

/** Show the finished photos in the current format and mark the matching format button on the delivery scene. */
function updateFormat(): void {
  $('photo-display').innerHTML = stripHTML(session);
  syncFormatButtons(session);
}

const editor = setupEditor(session, updateFormat);

function openPhoto(): void {
  if (card.disabled) return;
  stopPrint();
  session.format = 'strip';
  sfx();
  dropArea.classList.add('hidden');
  full.classList.remove('hidden');
  updateFormat();
}

export const revealScene: Scene = {
  enter(ctx) {
    stopPrint();
    editor.close(false);
    decision.classList.add('hidden');
    reviewNext.classList.remove('hidden');
    full.classList.remove('deciding');
    dropArea.classList.remove('hidden');
    full.classList.add('hidden');

    card.innerHTML = stripHTML(session, 'strip');
    card.disabled = true;
    card.setAttribute('aria-label', 'Printing your photo strip');
    card.style.transform = 'translate(-50%,-110%)';

    const landed = () => {
      card.disabled = false;
      card.setAttribute('aria-label', 'Pick up your photo strip');
    };
    if (prefersReducedMotion()) {
      showLanded(card, mouth);
      landed();
      return;
    }
    printAbort = new AbortController();
    const mine = printAbort.signal;
    runPrint({
      card,
      mouth,
      signal: mine,
      delayMs: ctx.animate ? 650 : 0,
      onStart: () => {
        const stopSound = printFoley();
        mine.addEventListener('abort', stopSound, { once: true });
      },
      onLanded: landed,
    });
  },
  exit() {
    stopPrint();
    editor.close(false);
  },
};

card.onclick = openPhoto;
reviewNext.onclick = () => {
  reviewNext.classList.add('hidden');
  full.classList.add('deciding');
  decision.classList.remove('hidden');
  $('send-next').focus();
};
$('retake').onclick = () => go(3);
$('send-next').onclick = () => go(5);
