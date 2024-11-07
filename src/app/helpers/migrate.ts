import { GameResearch } from '../interfaces';
import { getEntriesByType } from './content';
import { gamestate, setGameState } from './gamestate';
import { addHero, allHeroes, createHero } from './hero';

export function migrateState() {
  const state = gamestate();

  if (!state.townSetup.hasDoneSetup) return;

  state.version ??= 1;
  state.heroes ??= {};
  state.researchProgress ??= {};
  state.resources ??= {};
  state.taskAssignments ??= {};
  state.townSetup ??= {
    hasDoneSetup: false,
    heroId: '',
    heroName: '',
    townName: '',
  };

  setGameState(state);

  initializeTown();
}

export function initializeTown() {
  unlockBasicTasks();
  ensureFirstHero();
}

export function unlockBasicTasks() {
  const state = gamestate();

  const allTasks = getEntriesByType<GameResearch>('research').filter(
    (t) => t.researchRequired === 0,
  );

  allTasks.forEach((task) => {
    state.researchProgress[task.id] = 0;
  });

  setGameState(state);
}

export function ensureFirstHero() {
  if (allHeroes().length > 0) return;

  const state = gamestate();
  const firstHero = createHero();

  firstHero.name = state.townSetup.heroName;

  state.townSetup.heroId = firstHero.id;
  setGameState(state);

  addHero(firstHero);
}