// Scene state machine. Same DOM contract as Draft 27's go(): .active / .past / .enter classes,
// `inert` on inactive scenes. Every scene gets an AbortSignal that is aborted the moment the scene
// is left, so timers, listeners and camera work tied to it are cancelled in one place.
import { sfx } from '../audio/foley';
import { updateProgress } from '../ui/chrome';
import { $ } from '../ui/dom';

export interface SceneContext {
  signal: AbortSignal;
  animate: boolean;
}
export interface Scene {
  enter(ctx: SceneContext): void;
  exit?(): void;
}

const registry = new Map<number, Scene>();
let current = -1;
let controller: AbortController | null = null;

export const register = (index: number, scene: Scene): void => void registry.set(index, scene);
export const currentScene = (): number => current;

export function go(index: number, animate = true): void {
  if (index < -1 || index > 5) return;
  const scenes = [...document.querySelectorAll<HTMLElement>('.scene')];

  controller?.abort();
  registry.get(current)?.exit?.();

  $('coin-launch').hidden = index !== -1;
  document.body.classList.toggle('coin-open', index === -1);
  if (index !== current && animate && index !== 4) sfx('slide');

  current = index;
  scenes.forEach((s, j) => {
    s.classList.toggle('active', j === index);
    s.classList.toggle('past', j < index);
    s.classList.remove('enter');
    s.inert = j !== index;
  });
  if (animate && index > 0) {
    void scenes[index]!.offsetWidth; // restart the CSS entrance animation
    scenes[index]!.classList.add('enter');
  }
  updateProgress(index);
  window.scrollTo(0, 0);

  controller = new AbortController();
  registry.get(index)?.enter({ signal: controller.signal, animate });
}

/** Stop the current scene's work without changing scene (page hidden/unloaded). */
export function suspend(): void {
  controller?.abort();
  registry.get(current)?.exit?.();
}
