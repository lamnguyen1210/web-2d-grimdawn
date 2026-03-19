import type { PartialStats, StatBlock } from "./types";

export const createStatBlock = (overrides: PartialStats): StatBlock => ({
  maxHealth: overrides.maxHealth ?? 0,
  healthRegen: overrides.healthRegen ?? 0,
  maxEnergy: overrides.maxEnergy ?? 0,
  energyRegen: overrides.energyRegen ?? 0,
  armor: overrides.armor ?? 0,
  moveSpeed: overrides.moveSpeed ?? 0,
  attackSpeed: overrides.attackSpeed ?? 0,
  physicalDamageMin: overrides.physicalDamageMin ?? 0,
  physicalDamageMax: overrides.physicalDamageMax ?? 0,
  fireDamageMin: overrides.fireDamageMin ?? 0,
  fireDamageMax: overrides.fireDamageMax ?? 0,
  critChance: overrides.critChance ?? 0,
  critMultiplier: overrides.critMultiplier ?? 1.5,
  physicalResistance: overrides.physicalResistance ?? 0,
  fireResistance: overrides.fireResistance ?? 0,
  poisonResistance: overrides.poisonResistance ?? 0,
});

export const cloneStats = (stats: StatBlock): StatBlock => createStatBlock(stats);

export const addStats = (...blocks: PartialStats[]): StatBlock => {
  const result = createStatBlock({});
  for (const block of blocks) {
    result.maxHealth += block.maxHealth ?? 0;
    result.healthRegen += block.healthRegen ?? 0;
    result.maxEnergy += block.maxEnergy ?? 0;
    result.energyRegen += block.energyRegen ?? 0;
    result.armor += block.armor ?? 0;
    result.moveSpeed += block.moveSpeed ?? 0;
    result.attackSpeed += block.attackSpeed ?? 0;
    result.physicalDamageMin += block.physicalDamageMin ?? 0;
    result.physicalDamageMax += block.physicalDamageMax ?? 0;
    result.fireDamageMin += block.fireDamageMin ?? 0;
    result.fireDamageMax += block.fireDamageMax ?? 0;
    result.critChance += block.critChance ?? 0;
    result.critMultiplier += (block.critMultiplier ?? 1.5) - 1.5;
    result.physicalResistance += block.physicalResistance ?? 0;
    result.fireResistance += block.fireResistance ?? 0;
    result.poisonResistance += block.poisonResistance ?? 0;
  }
  if (result.critMultiplier === 0) {
    result.critMultiplier = 1.5;
  }
  return result;
};

export const scaleStatsForLevel = (base: StatBlock, level: number): StatBlock => {
  const scaled = cloneStats(base);
  const multiplier = 1 + Math.max(0, level - 1) * 0.18;
  scaled.maxHealth = Math.round(base.maxHealth * multiplier);
  scaled.maxEnergy = Math.round(base.maxEnergy * (1 + Math.max(0, level - 1) * 0.08));
  scaled.physicalDamageMin = Math.round(base.physicalDamageMin * multiplier);
  scaled.physicalDamageMax = Math.round(base.physicalDamageMax * multiplier);
  scaled.fireDamageMin = Math.round(base.fireDamageMin * multiplier);
  scaled.fireDamageMax = Math.round(base.fireDamageMax * multiplier);
  scaled.armor = Math.round(base.armor * (1 + Math.max(0, level - 1) * 0.12));
  return scaled;
};
