// Scene 1: choose 1-4 guests and (optionally) type names. Names stay in memory only.
import { go, type Scene } from '../app/router';
import { session } from '../app/state';
import { playGuestPop } from '../audio/guest-pop';
import { sfx } from '../audio/foley';
import { art } from '../assets/manifest';
import { $ } from '../ui/dom';

function render(): void {
  const { count } = session;
  $('guest-count').textContent = `${count} ${count === 1 ? 'guest' : 'guests'}`;
  ($('minus') as HTMLButtonElement).disabled = count === 1;
  ($('plus') as HTMLButtonElement).disabled = count === 4;
  $('portrait').innerHTML =
    `<img class="guest-art count-${count}" alt="Illustrated group of ${count} ${count === 1 ? 'guest' : 'guests'}" src="${art.guests[count - 1]}">`;

  const names = $('names');
  names.className = 'names' + (count > 2 ? ' two-by-two' : '');
  names.innerHTML = Array.from(
    { length: count },
    (_, i) => `<label><input aria-label="Name of guest ${i + 1}" maxlength="40" placeholder="Your name" autocomplete="off" data-name="${i}"></label>`,
  ).join('');
  names.querySelectorAll<HTMLInputElement>('[data-name]').forEach((input) => {
    const i = Number(input.dataset.name);
    input.value = session.names[i] ?? '';
    input.oninput = () => { session.names[i] = input.value; };
  });
}

export const guestsScene: Scene = {
  enter: render,
};

$('minus').onclick = () => {
  if (session.count > 1) { session.count--; sfx(); render(); }
};
$('plus').onclick = () => {
  if (session.count < 4) { session.count++; playGuestPop(); render(); }
};
$('enter').onclick = () => go(2);
