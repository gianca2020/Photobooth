import { register, go, suspend, currentScene } from './app/router';
import { resetSession, session } from './app/state';
import { coinScene } from './scenes/coin';
import { cameraScene } from './scenes/camera';
import { guestsScene } from './scenes/guests';
import { runScene } from './scenes/run';
import { welcomeScene } from './scenes/welcome';
import { buildProgress, wireHeader } from './ui/chrome';
import { $ } from './ui/dom';

const debug = new URLSearchParams(location.search).has('debug');
document.body.classList.toggle('debug', debug);
// Test/QA hook, present only with ?debug.
if (debug) Object.assign(window, { __lpc: { go, session, resetSession } });

register(-1, coinScene);
register(0, welcomeScene);
register(1, guestsScene);
register(2, runScene);
register(3, cameraScene);

buildProgress((scene) => go(scene));
wireHeader();
$('back').onclick = () => go(currentScene() - 1);

// Release anything running when the page goes away; wake the scene again if the browser restores it.
window.addEventListener('pagehide', suspend);
window.addEventListener('pageshow', (e) => { if (e.persisted) go(currentScene(), false); });

go(-1, false);
