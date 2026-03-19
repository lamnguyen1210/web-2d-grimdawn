import type { AffixDefinition } from "../gameplay/types";

export const affixes: AffixDefinition[] = [
  { id: "sturdy", name: "Sturdy", family: "prefix", stats: { armor: 6 }, weight: 6 },
  { id: "swift", name: "Swift", family: "prefix", stats: { moveSpeed: 14 }, weight: 5 },
  { id: "tempered", name: "Tempered", family: "prefix", stats: { physicalDamageMin: 2, physicalDamageMax: 4 }, weight: 5 },
  { id: "ember", name: "Ember", family: "prefix", stats: { fireDamageMin: 2, fireDamageMax: 4 }, weight: 4 },
  { id: "of-health", name: "of Health", family: "suffix", stats: { maxHealth: 20 }, weight: 6 },
  { id: "of-quickness", name: "of Quickness", family: "suffix", stats: { attackSpeed: 0.18 }, weight: 4 },
  { id: "of-sparks", name: "of Sparks", family: "suffix", stats: { energyRegen: 0.9 }, weight: 5 },
  { id: "of-cinders", name: "of Cinders", family: "suffix", stats: { fireResistance: 0.08 }, weight: 5 },
];
