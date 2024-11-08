import { GameHero } from './hero';

export interface GameStateTownSetup {
  hasDoneSetup: boolean;
  townName: string;
  heroName: string;
  heroId: string;
}

export interface GameStateRecruitment {
  recruitableHeroes: GameHero[];
  nextResetTime: number;
  numRerolls: number;
}

export interface GameState {
  /**
   * Current version of the game state
   */
  version: number;

  /**
   * Hero id -> Hero data
   */
  heroes: Record<string, GameHero>;

  /**
   * Research id -> Research progress
   */
  researchProgress: Record<string, number>;

  /**
   * Resource id -> total obtained
   */
  resources: Record<string, number>;

  /**
   * Hero id -> Hero speed
   */
  heroCurrentTaskSpeed: Record<string, number>;

  /**
   * Task id -> Task progress
   */
  taskProgress: Record<string, number>;

  /**
   * Hero id -> Task id
   */
  taskAssignments: Record<string, string>;

  /**
   * Current research id
   */
  activeResearch: string;

  /**
   * Setup information for the town
   */
  townSetup: GameStateTownSetup;

  /**
   * Recruitment data
   */
  recruitment: GameStateRecruitment;
}
