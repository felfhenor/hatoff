import { sample, sampleSize } from 'lodash';
import {
  GameDamageType,
  GameResource,
  GameTask,
  GameUpgrade,
} from '../interfaces';
import { sendDesignEvent } from './analytics';
import { heroGainRandomInjury } from './attribute';
import { getEntry, getResearchableEntriesByType } from './content';
import { cooldown } from './cooldown';
import { isEasyMode, isHardMode } from './difficulty';
import { gamestate, updateGamestate } from './gamestate';
import { allHeroes } from './hero';
import { notify } from './notify';
import {
  allUnlockedDamageTypes,
  allUnlockedTasks,
  totalCompletedResearch,
} from './research';
import { getResourceValue, hasResource, zeroResource } from './resource';
import { randomChoice, succeedsChance } from './rng';
import {
  allUpgradesForTask,
  hasUpgrade,
  loseUpgrade,
  purchasedUpgradesForTask,
} from './upgrade';

export function setDefenseResetTime(): void {
  updateGamestate((state) => {
    state.cooldowns.nextDefenseAttackTime = cooldown('nextDefenseAttackTime');
    return state;
  });
}

export function requiredBuildingsForTownAttack(): number {
  return 7;
}

export function requiredResearchesForTownAttack(): number {
  return 14;
}

export function canAttackTown(): boolean {
  if (isEasyMode()) return false;

  return (
    allUnlockedTasks().length >= requiredBuildingsForTownAttack() &&
    totalCompletedResearch() >= requiredResearchesForTownAttack()
  );
}

export function hasQueuedAttack(): boolean {
  return gamestate().defense.incomingDamage > 0;
}

export function generateFirstAttack(): void {
  notify(
    "You've just unlocked town defense, and accrued the ire of the woodlands...",
    'Defense',
  );
  updateGamestate((state) => {
    state.defense.numAttacks = 0;
    return state;
  });

  generateTownAttack();
}

export function pickTownDamageType(): GameDamageType {
  const numAttacks = gamestate().defense.numAttacks;
  const allUnlockedIds = allUnlockedDamageTypes().map((f) => f.id);

  const damageTypes = getResearchableEntriesByType<GameDamageType>(
    'damagetype',
  ).filter((t) => {
    // no locked damage types in the first few
    if (numAttacks < 3) {
      return allUnlockedIds.includes(t.id);
    }

    // 30% chance of having a locked damage type up until attack 7
    if (numAttacks < 7 && succeedsChance(70)) {
      return allUnlockedIds.includes(t.id);
    }

    // every damage type
    return t;
  });

  return randomChoice<GameDamageType>(damageTypes);
}

export function calculateDamageForTown(): number {
  const numAttacks = gamestate().defense.numAttacks + 1;
  const numResearch = totalCompletedResearch();
  if (numAttacks <= 0) return 0;

  const divisor = isHardMode() ? 25 : 50;

  const coefficient = numAttacks / divisor;
  const result = numResearch ** coefficient * Math.log10(numResearch) * 50;

  return Math.floor(result);
}

export function hasReinforcedWalls(): boolean {
  const defenseTask = getEntry<GameTask>('Defend Town');
  const upgrade = getEntry<GameUpgrade>('Reinforced Walls');

  return !!defenseTask && !!upgrade && hasUpgrade(defenseTask, upgrade);
}

export function hasMedic(): boolean {
  const defenseTask = getEntry<GameTask>('Defend Town');
  const upgrade = getEntry<GameUpgrade>('Medic On Demand');

  return !!defenseTask && !!upgrade && hasUpgrade(defenseTask, upgrade);
}

export function isTaskThreatened(task: GameTask): boolean {
  const defenseTask = getEntry<GameTask>('Defend Town');

  if (hasReinforcedWalls()) {
    return task.id === defenseTask?.id;
  }

  return (
    !hasEnoughFortifications() &&
    gamestate().defense.targettedTaskIds.includes(task.id)
  );
}

export function hasEnoughFortifications(): boolean {
  return (
    getResourceValue('Fortifications') >= gamestate().defense.incomingDamage
  );
}

export function generateTownAttack(): void {
  const availableTasks = allUnlockedTasks().filter(
    (t) => destroyableUpgrades(t).length > 0,
  );
  const numTasks = sample([1, 2]);
  const chosenTasks = sampleSize(availableTasks, numTasks).map((t) => t.id);

  updateGamestate((state) => {
    state.defense.incomingDamage = calculateDamageForTown();
    state.defense.damageTypeId = pickTownDamageType().id;
    state.defense.targettedTaskIds = chosenTasks;
    return state;
  });
}

export function setTownAttacks(attacks: number): void {
  updateGamestate((state) => {
    state.defense.numAttacks = attacks;
    return state;
  });
}

export function destroyableUpgrades(task: GameTask): GameUpgrade[] {
  const allUpgrades = allUpgradesForTask(task);
  const purchasedUpgrades = purchasedUpgradesForTask(task);

  return purchasedUpgrades.filter((u) => {
    const dependentUpgrades = allUpgrades.filter((f) =>
      f.requiresUpgradeIds?.includes(u.id),
    );

    // no child upgrades = we can delete it
    if (dependentUpgrades.length === 0) return true;

    // if any of our child upgrades exist, and they're built, we can't delete this one
    if (
      dependentUpgrades.some(
        (d) => d.requiresUpgradeIds?.includes(u.id) && hasUpgrade(task, d),
      )
    )
      return false;

    // we can only delete it
    return true;
  });
}

export function doTownAttack(): void {
  sendDesignEvent('TownDefense:NumAttacks', gamestate().defense.numAttacks + 1);
  setTownAttacks(gamestate().defense.numAttacks + 1);

  let shouldLoseWalls = false;
  const tasksToLoseUpgradesFor: GameTask[] = [];

  updateGamestate((state) => {
    if (hasReinforcedWalls()) {
      sendDesignEvent('TownDefense:DefenseLevel:DefendedWithWalls');
      shouldLoseWalls = true;
      return state;
    }

    const fortifications = getEntry<GameResource>('Fortifications');
    if (fortifications) {
      const wasFullyDefended = hasResource(
        fortifications,
        state.defense.incomingDamage,
      );
      zeroResource(fortifications);

      if (!wasFullyDefended) {
        sendDesignEvent('TownDefense:DefenseLevel:NotFullyDefended');
        tasksToLoseUpgradesFor.push(
          ...state.defense.targettedTaskIds.map((t) => getEntry<GameTask>(t)!),
        );

        const injuryChance = 100 - (hasMedic() ? 50 : 0);
        if (succeedsChance(injuryChance)) {
          sendDesignEvent('Hero:Injure:TownDefense');
          const heroToInjure = sample(allHeroes());
          if (heroToInjure) {
            heroGainRandomInjury(heroToInjure);
            notify(`${heroToInjure.name} was injured!`, 'Defense');
          }
        }
      } else {
        sendDesignEvent('TownDefense:DefenseLevel:FullyDefended');
      }
    }

    return state;
  });

  tasksToLoseUpgradesFor.forEach((task) => {
    const possibleLosses = destroyableUpgrades(task);
    const lost = sample(possibleLosses)!;

    notify(`${task.name} lost the upgrade ${lost.name}!`, 'Defense');

    loseUpgrade(task, lost);
  });

  if (shouldLoseWalls) {
    const defenseTask = getEntry<GameTask>('Defend Town');
    const upgrade = getEntry<GameUpgrade>('Reinforced Walls');
    loseUpgrade(defenseTask!, upgrade!);
  }

  generateTownAttack();
  setDefenseResetTime();
}
