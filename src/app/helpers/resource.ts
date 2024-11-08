import { GameResource } from '../interfaces';
import { getEntry } from './content';
import { gamestate, setGameState } from './gamestate';

export function getResourceValue(idOrName: string): number {
  const id = getEntry<GameResource>(idOrName)?.id;
  if (!id) return 0;

  return gamestate().resources[id] ?? 0;
}

export function gainResource(resource: GameResource, value = 1): void {
  const state = gamestate();
  state.resources[resource.id] ??= 0;
  state.resources[resource.id] += value;
  setGameState(state);
}
