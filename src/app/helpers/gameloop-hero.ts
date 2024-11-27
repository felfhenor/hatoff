import { sum } from 'lodash';
import {
  GameHero,
  GameResearch,
  GameResource,
  GameState,
  GameTask,
} from '../interfaces';
import {
  getArchetypeResourceBonusForHero,
  getArchetypeTaskBonusForHero,
  getArchetypeXpBonusForHero,
} from './archetype';
import { getEntry } from './content';
import { gamestate, setGameState } from './gamestate';
import {
  gainStat,
  gainXp,
  isStunned,
  totalHeroForce,
  totalHeroSpeed,
} from './hero';
import { notify, notifyError } from './notify';
import { getOption } from './options';
import { getResourceValue, loseResource, zeroResource } from './resource';
import {
  heroesAllocatedToTask,
  maxLevelForTask,
  numHeroesAllocatedToTask,
  xpRequiredForTaskLevel,
} from './task';
import { resourceBonusForTask, xpBonusForTask } from './upgrade';

function applyHeroSpeed(
  state: GameState,
  hero: GameHero,
  task: GameTask,
  numTimes: number,
): void {
  state.heroCurrentTaskSpeed[hero.id] ??= 0;
  state.heroCurrentTaskSpeed[hero.id] += totalHeroSpeed(hero, task, numTimes);
}

function resetHeroSpeed(state: GameState, hero: GameHero): void {
  state.heroCurrentTaskSpeed[hero.id] = 0;
}

function canApplyDamageToTask(
  state: GameState,
  hero: GameHero,
  task: GameTask,
): boolean {
  return state.heroCurrentTaskSpeed[hero.id] >= task.speedPerCycle;
}

function numTimesToApplyDamageToTask(
  state: GameState,
  hero: GameHero,
  task: GameTask,
): number {
  return Math.floor(state.heroCurrentTaskSpeed[hero.id] / task.speedPerCycle);
}

function applyHeroForce(
  state: GameState,
  hero: GameHero,
  task: GameTask,
  numTimes: number,
): void {
  const damage = totalHeroForce(hero, task, numTimes);

  state.taskProgress[task.id] ??= 0;
  state.taskProgress[task.id] += damage;
}

function updateHero(state: GameState, hero: GameHero): void {
  state.heroes[hero.id] = hero;
}

function taskBonusForHero(hero: GameHero, task: GameTask): number {
  let rewardBoost = hero.taskLevels[task.id] ?? 0;

  if (task.resourceIdPerCycle) {
    const resourceGained = getEntry<GameResource>(task.resourceIdPerCycle);
    if (resourceGained) {
      rewardBoost += getArchetypeResourceBonusForHero(hero, resourceGained);
    }
  }

  rewardBoost += getArchetypeTaskBonusForHero(hero, task);

  return rewardBoost;
}

function numTaskRewards(state: GameState, task: GameTask): number {
  return Math.floor(state.taskProgress[task.id] / task.damageRequiredPerCycle);
}

function isTaskFinished(state: GameState, task: GameTask): boolean {
  return numTaskRewards(state, task) > 0;
}

function finalizeTask(state: GameState, task: GameTask): void {
  if (task.siblingTaskIdRequiringHeroesAllocated) {
    const sibling = getEntry<GameTask>(
      task.siblingTaskIdRequiringHeroesAllocated,
    );
    if (sibling && heroesAllocatedToTask(sibling).length === 0) {
      notifyError(`Task "${task.name}" requires heroes on "${sibling.name}"!`);
      return;
    }
  }

  const heroBonusSum = sum(
    heroesAllocatedToTask(task).map((h) => taskBonusForHero(h, task)),
  );

  if (task.resourceIdPerCycle && task.resourceRewardPerCycle) {
    const res = getEntry<GameResource>(task.resourceIdPerCycle);
    const bonusResources = resourceBonusForTask(task);
    const numHeroesOnTask = numHeroesAllocatedToTask(task);

    const gained =
      (heroBonusSum +
        bonusResources +
        task.resourceRewardPerCycle * numHeroesOnTask) *
      numTaskRewards(state, task) *
      getOption('rewardMultiplier');
    state.resources[task.resourceIdPerCycle] ??= 0;
    state.resources[task.resourceIdPerCycle] += gained;

    notify(`+${gained} ${res?.name ?? '???'}`, 'ResourceGain');
  }

  if (task.applyResultsToResearch) {
    const researchGained =
      (heroBonusSum + task.resourceRewardPerCycle) *
      numTaskRewards(state, task) *
      getOption('rewardMultiplier');
    const activeResearch = state.activeResearch;
    const activeResearchEntry = getEntry<GameResearch>(activeResearch);
    if (
      !activeResearchEntry ||
      state.researchProgress[activeResearch] >=
        activeResearchEntry.researchRequired
    ) {
      notifyError('Gained research, but not researching anything!');
      return;
    }

    state.researchProgress[activeResearch] ??= 0;
    state.researchProgress[activeResearch] = Math.min(
      state.researchProgress[activeResearch] + researchGained,
      activeResearchEntry.researchRequired,
    );
  }
}

function resetTask(state: GameState, task: GameTask): void {
  state.taskProgress[task.id] -=
    task.damageRequiredPerCycle * numTaskRewards(state, task);
}

function rewardTaskDoers(state: GameState, task: GameTask): void {
  const xpGained = numTaskRewards(state, task);
  const heroXpBonus = xpBonusForTask(task);

  let bonusConversionXp = 0;
  if (task.convertResourceIdIntoXp) {
    const resourceRef = getEntry<GameResource>(task.convertResourceIdIntoXp);
    if (!resourceRef) return;

    const resourceValue = getResourceValue(resourceRef.id);
    loseResource(resourceRef, resourceValue);
    bonusConversionXp += resourceValue;
  }

  let statValueGained = 0;
  if (task.convertResourceIdToStat && task.convertResourceStat) {
    const resourceRef = getEntry<GameResource>(task.convertResourceIdToStat);
    if (!resourceRef) return;

    const resourceValue = getResourceValue(resourceRef.id);
    zeroResource(resourceRef);
    statValueGained += resourceValue;
  }

  const taskXpGained = task.xpPerCycle;

  heroesAllocatedToTask(task).forEach((hero) => {
    const archXpBonus = getArchetypeXpBonusForHero(hero);

    gainTaskXp(state, hero, task, xpGained + archXpBonus + hero.stats.progress);
    gainXp(
      hero,
      xpGained *
        (taskXpGained +
          bonusConversionXp +
          archXpBonus +
          heroXpBonus +
          taskBonusForHero(hero, task)),
    );

    if (statValueGained > 0 && task.convertResourceStat) {
      gainStat(hero, task.convertResourceStat, statValueGained);
    }

    updateHero(state, hero);
  });
}

function gainTaskXp(
  state: GameState,
  hero: GameHero,
  task: GameTask,
  xp = 1,
): void {
  if (hero.taskLevels[task.id] >= maxLevelForTask(task)) return;

  hero.taskXp ??= {};

  hero.taskLevels[task.id] ??= 0;
  hero.taskXp[task.id] ??= 0;

  hero.taskXp[task.id] += xp * getOption('heroTaskXpMultiplier');

  if (
    hero.taskXp[task.id] >=
    xpRequiredForTaskLevel(task, hero.taskLevels[task.id] + 1)
  ) {
    hero.taskXp[task.id] = 0;
    hero.taskLevels[task.id] += 1;
  }
}

export function canDoTask(task: GameTask): boolean {
  return task.speedPerCycle > 0;
}

export function doHeroGameloop(numTicks: number): void {
  const state = gamestate();

  Object.values(state.heroes).forEach((hero) => {
    if (isStunned(hero)) {
      hero.stunTicks -= numTicks;
      return;
    }

    if (!state.taskAssignments[hero.id]) return;

    const task = getEntry<GameTask>(state.taskAssignments[hero.id]);
    if (!task) return;

    if (!canDoTask(task)) return;

    // boost speed, track action
    applyHeroSpeed(state, hero, task, numTicks);
    if (!canApplyDamageToTask(state, hero, task)) return;
    const numTimesToApplyForce = numTimesToApplyDamageToTask(state, hero, task);
    resetHeroSpeed(state, hero);

    // if we've met the terms, we can do damage
    applyHeroForce(state, hero, task, numTimesToApplyForce);

    if (!isTaskFinished(state, task)) return;

    // finish the task, reset it, give the task doers a reward
    finalizeTask(state, task);
    rewardTaskDoers(state, task);
    resetTask(state, task);
  });

  setGameState(state);
}
