import type { SkillDefinition } from "../gameplay/types";

export const skillDefinitions: Record<string, SkillDefinition> = {
  basicAttack: {
    id: "basicAttack",
    name: "Basic Attack",
    cooldownMs: 450,
    energyCost: 0,
    range: 145,
    targetMode: "enemy",
    description: "A precise weapon strike that locks onto a hostile in range.",
  },
  cleaveShot: {
    id: "cleaveShot",
    name: "Cleave Shot",
    cooldownMs: 3200,
    energyCost: 12,
    range: 150,
    targetMode: "enemy",
    description: "A sweeping burst that damages enemies in a frontal arc.",
  },
  fireBomb: {
    id: "fireBomb",
    name: "Fire Bomb",
    cooldownMs: 5200,
    energyCost: 20,
    range: 220,
    targetMode: "ground",
    description: "Throw an explosive flask that creates a burning hazard pool.",
  },
};
