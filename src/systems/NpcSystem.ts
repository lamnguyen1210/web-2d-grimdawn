import { npcSpawnsByZone } from "../content/npcs";
import type { NpcState, ZoneId } from "../gameplay/types";
import type { CombatSystem } from "./CombatSystem";
import type { GameContext } from "./GameContext";
import type { LootSystem } from "./LootSystem";

const INTERACT_RANGE = 64;
const HEAL_COST = 20;
const TONIC_COST = 5;
const ITEM_COST = 25;

export class NpcSystem {
  constructor(
    private ctx: GameContext,
    private combat: CombatSystem,
    private loot: LootSystem,
  ) {}

  spawnZoneNpcs(zoneId: ZoneId): void {
    const spawns = npcSpawnsByZone[zoneId] ?? [];
    for (const spawn of spawns) {
      const npc: NpcState = { ...spawn, zoneId };
      this.ctx.npcs.set(npc.id, npc);
    }
  }

  clearNpcs(): void {
    this.ctx.npcs.clear();
  }

  getNearbyNpc(x: number, y: number): NpcState | undefined {
    for (const npc of this.ctx.npcs.values()) {
      if (npc.zoneId !== this.ctx.activeZoneId) continue;
      const dx = npc.x - x;
      const dy = npc.y - y;
      if (dx * dx + dy * dy <= INTERACT_RANGE * INTERACT_RANGE) {
        return npc;
      }
    }
    return undefined;
  }

  interactWith(npc: NpcState): void {
    if (npc.kind === "healer") {
      this.interactHealer();
    } else {
      this.ctx.isShopOpen = true;
    }
  }

  interactHealer(): void {
    if (this.ctx.inventory.gold < HEAL_COST) {
      this.ctx.log(`Not enough gold to be healed (costs ${HEAL_COST}g).`);
      return;
    }
    if (this.ctx.player.health >= this.ctx.player.stats.maxHealth) {
      this.ctx.log("You are already at full health.");
      return;
    }
    this.ctx.inventory.gold -= HEAL_COST;
    this.ctx.player.health = this.ctx.player.stats.maxHealth;
    this.ctx.log(`Healer Seline restores you to full health for ${HEAL_COST}g.`);
  }

  buyTonic(): void {
    if (this.ctx.inventory.gold < TONIC_COST) {
      this.ctx.log(`Not enough gold (Health Tonic costs ${TONIC_COST}g).`);
      return;
    }
    this.ctx.inventory.gold -= TONIC_COST;
    this.ctx.inventory.potions += 1;
    this.ctx.log(`Bought a Health Tonic for ${TONIC_COST}g.`);
  }

  buyItem(): void {
    if (this.ctx.inventory.gold < ITEM_COST) {
      this.ctx.log(`Not enough gold (item costs ${ITEM_COST}g).`);
      return;
    }
    this.ctx.inventory.gold -= ITEM_COST;
    const item = this.loot.rollLoot("magic");
    this.ctx.inventory.items.push(item);
    this.ctx.log(`Bought ${item.name} for ${ITEM_COST}g.`);
  }
}
