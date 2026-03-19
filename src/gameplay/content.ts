import { affixes } from "../content/affixes";
import { enemyDefinitions } from "../content/enemies";
import { itemDefinitions } from "../content/items";
import { skillDefinitions } from "../content/skills";
import { zoneDefinitions } from "../content/zones";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Content validation failed: ${message}`);
  }
};

export const validateContent = (): void => {
  const itemIds = new Set(itemDefinitions.map((item) => item.id));
  assert(itemIds.size === itemDefinitions.length, "duplicate item ids");

  const affixIds = new Set(affixes.map((affix) => affix.id));
  assert(affixIds.size === affixes.length, "duplicate affix ids");

  for (const skill of Object.values(skillDefinitions)) {
    assert(skill.cooldownMs >= 0, `skill ${skill.id} has invalid cooldown`);
    assert(skill.range >= 0, `skill ${skill.id} has invalid range`);
  }

  for (const enemy of Object.values(enemyDefinitions)) {
    assert(enemy.baseStats.maxHealth > 0, `enemy ${enemy.id} must have health`);
  }

  for (const zone of Object.values(zoneDefinitions)) {
    for (const encounter of zone.encounters) {
      assert(encounter.zoneId === zone.id, `encounter ${encounter.id} mapped to wrong zone`);
      for (const spawn of encounter.spawns) {
        assert(Boolean(enemyDefinitions[spawn.enemyId]), `spawn ${spawn.enemyId} missing in encounter ${encounter.id}`);
      }
    }
  }
};
