import type { PartialStats } from "../gameplay/types";

export interface TalentDefinition {
  id: string;
  name: string;
  description: string;
  theme: "combat" | "survival" | "elemental";
  statBonus: PartialStats;
}

export const talentDefinitions: TalentDefinition[] = [
  // Combat
  { id: "combat-phys-1",   name: "Brute Force",     theme: "combat",    description: "+3/+3 physical damage",   statBonus: { physicalDamageMin: 3, physicalDamageMax: 3 } },
  { id: "combat-crit-1",   name: "Keen Eye",         theme: "combat",    description: "+5% crit chance",         statBonus: { critChance: 0.05 } },
  { id: "combat-crit-2",   name: "Lethal Strikes",   theme: "combat",    description: "+15% crit multiplier",    statBonus: { critMultiplier: 0.15 } },
  { id: "combat-speed-1",  name: "Swift Strikes",    theme: "combat",    description: "+1 attack speed",         statBonus: { attackSpeed: 1 } },
  // Survival
  { id: "survival-hp-1",    name: "Iron Body",       theme: "survival",  description: "+30 max health",          statBonus: { maxHealth: 30 } },
  { id: "survival-hp-2",    name: "Fortified",       theme: "survival",  description: "+50 max health",          statBonus: { maxHealth: 50 } },
  { id: "survival-armor-1", name: "Plated Hide",     theme: "survival",  description: "+8 armor",                statBonus: { armor: 8 } },
  { id: "survival-regen-1", name: "Vitality",        theme: "survival",  description: "+1.5 health regen/sec",   statBonus: { healthRegen: 1.5 } },
  // Elemental
  { id: "elemental-fire-1",   name: "Pyromaniac",    theme: "elemental", description: "+2/+3 fire damage",       statBonus: { fireDamageMin: 2, fireDamageMax: 3 } },
  { id: "elemental-fire-2",   name: "Flame Ward",    theme: "elemental", description: "+10% fire resistance",    statBonus: { fireResistance: 0.10 } },
  { id: "elemental-poison-1", name: "Toxin Immunity",theme: "elemental", description: "+10% poison resistance",  statBonus: { poisonResistance: 0.10 } },
  { id: "elemental-energy-1", name: "Inner Reserve", theme: "elemental", description: "+20 max energy",          statBonus: { maxEnergy: 20 } },
];
