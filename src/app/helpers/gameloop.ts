import { doHeroGameloop } from './gameloop-hero';
import { isSetup } from './setup';

export function isPlayingGame(): boolean {
  return window.location.href.includes('/game');
}

export function doGameloop(): void {
  if (!isSetup()) return;
  if (!isPlayingGame()) return;

  doHeroGameloop();
}
