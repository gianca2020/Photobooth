import { register, go, suspend, currentScene } from './app/router';
import { coinScene } from './scenes/coin';
import { welcomeScene } from './scenes/welcome';
import { buildProgress, wireHeader } from './ui/chrome';
import { $ } from './ui/dom';

document.body.classList.toggle('debug', new URLSearchParams(location.search).has('debug'));

register(-1, coinScene);
register(0, welcomeScene);

buildProgress((scene) => go(scene));
wireHeader();
$('back').onclick = () => go(currentScene() - 1);

// Release anything running when the page goes away; wake the scene again if the browser restores it.
window.addEventListener('pagehide', suspend);
window.addEventListener('pageshow', (e) => { if (e.persisted) go(currentScene(), false); });

go(-1, false);
