import { Content } from './identifiable';

export interface GameDungeonEncounterFightMonster {
  monsterId: string;
}

export type GameDungeonEncounterType = 'fight' | 'treasure' | 'loot';

export type GameDungeonEncounter =
  | GameDungeonEncounterFight
  | GameDungeonEncounterLoot
  | GameDungeonEncounterTreasure;

export interface GameDungeonEncounterFight extends GameDungeonEncounterBase {
  type: 'fight';
  monsters: GameDungeonEncounterFightMonster[];
}

export interface GameDungeonEncounterTreasure extends GameDungeonEncounterBase {
  type: 'treasure';
  itemIds: string[];
}

export interface GameDungeonEncounterLoot extends GameDungeonEncounterBase {
  type: 'loot';
  lootId: string;
}

export interface GameDungeonEncounterBase {
  type: GameDungeonEncounterType;
  xpGained: number;
  ticksRequired: number;
}

export interface GameDungeon extends Content {
  description: string;
  stunTimeOnFailure: number;
  earnedAttributeId?: string;

  requiresLootIds?: string[];

  encounters: GameDungeonEncounter[];
}
