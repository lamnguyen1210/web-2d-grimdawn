import Phaser from "phaser";
import { affixes } from "../content/affixes";
import { itemDefinitions } from "../content/items";
import { addStats } from "../gameplay/stats";
import type { ActorState, ItemDefinition, ItemInstance, PickupState } from "../gameplay/types";
import type { GameContext } from "./GameContext";

const PICKUP_RANGE = 56;

export class LootSystem {
  constructor(private ctx: GameContext) {}

  rollLoot(targetRarity: "common" | "magic" | "rare"): ItemInstance {
    const pool = itemDefinitions.filter((item) =>
      targetRarity === "rare"
        ? item.rarity !== "common"
        : item.rarity === targetRarity || (targetRarity === "magic" && item.rarity === "common"),
    );
    const base = Phaser.Utils.Array.GetRandom(pool);
    return this.createItemInstance(base, targetRarity);
  }

  createItemInstance(base: ItemDefinition, forcedRarity?: "common" | "magic" | "rare"): ItemInstance {
    const rarity = forcedRarity ?? base.rarity;
    const prefixPool = affixes.filter((affix) => affix.family === "prefix");
    const suffixPool = affixes.filter((affix) => affix.family === "suffix");
    const affixCount = rarity === "common" ? 0 : rarity === "magic" ? 1 : 2;
    const selectedAffixes = [];
    if (affixCount >= 1) {
      selectedAffixes.push(Phaser.Utils.Array.GetRandom(prefixPool));
    }
    if (affixCount >= 2) {
      selectedAffixes.push(Phaser.Utils.Array.GetRandom(suffixPool));
    }
    const prefix = selectedAffixes.find((affix) => affix.family === "prefix")?.name;
    const suffix = selectedAffixes.find((affix) => affix.family === "suffix")?.name;
    const name = [prefix, base.name, suffix].filter(Boolean).join(" ");
    return {
      id: Phaser.Math.RND.uuid(),
      baseId: base.id,
      name,
      slot: base.slot,
      rarity,
      affixIds: selectedAffixes.map((affix) => affix.id),
      stats: addStats(base.baseStats, ...selectedAffixes.map((affix) => affix.stats)),
      requiredLevel: base.requiredLevel,
    };
  }

  dropRewards(target: ActorState, enemyId: string): void {
    const goldAmount = Phaser.Math.Between(enemyId === "warden" ? 22 : 6, enemyId === "warden" ? 40 : 18);
    this.createPickup({
      id: `gold-${Phaser.Math.RND.uuid()}`,
      kind: "gold",
      x: target.x + Phaser.Math.Between(-10, 10),
      y: target.y + Phaser.Math.Between(-10, 10),
      value: goldAmount,
      label: `${goldAmount} gold`,
    });

    if (Math.random() < (enemyId === "warden" ? 1 : 0.2)) {
      this.createPickup({
        id: `potion-${Phaser.Math.RND.uuid()}`,
        kind: "potion",
        x: target.x + Phaser.Math.Between(-16, 16),
        y: target.y + Phaser.Math.Between(-16, 16),
        value: 1,
        label: "Health Tonic",
      });
    }

    const itemChance = enemyId === "warden" ? 1 : enemyId === "bruiser" ? 0.48 : 0.28;
    if (Math.random() < itemChance) {
      const item = this.rollLoot(enemyId === "warden" ? "rare" : Math.random() < 0.45 ? "magic" : "common");
      this.createPickup({
        id: `item-${item.id}`,
        kind: "item",
        x: target.x + Phaser.Math.Between(-18, 18),
        y: target.y + Phaser.Math.Between(-18, 18),
        item,
        label: item.name,
      });
    }
  }

  createPickup(pickup: PickupState): void {
    this.ctx.pickups.set(pickup.id, pickup);
  }

  openChest(pickup: PickupState): void {
    const gold = Phaser.Math.Between(24, 44);
    this.ctx.inventory.gold += gold;
    this.ctx.inventory.potions += 1;
    this.ctx.inventory.items.push(this.rollLoot("magic"));
    this.ctx.clearedEncounterIds.add(pickup.encounterId ?? "chest");
    this.ctx.log(`Opened supply cache: ${gold} gold, 1 tonic, and a magic item.`);
    this.ctx.autosave();
  }

  updatePickups(): void {
    for (const [id, pickup] of [...this.ctx.pickups.entries()]) {
      if (Phaser.Math.Distance.Between(this.ctx.player.x, this.ctx.player.y, pickup.x, pickup.y) > PICKUP_RANGE) {
        continue;
      }
      if (pickup.kind === "gold") {
        this.ctx.inventory.gold += pickup.value ?? 0;
        this.ctx.log(`Picked up ${pickup.value} gold.`);
      } else if (pickup.kind === "potion") {
        this.ctx.inventory.potions += pickup.value ?? 1;
        this.ctx.log("Picked up a health tonic.");
      } else if (pickup.kind === "item" && pickup.item) {
        this.ctx.inventory.items.push(pickup.item);
        this.ctx.log(`Picked up ${pickup.item.name}.`);
      } else if (pickup.kind === "chest") {
        this.openChest(pickup);
      }
      this.destroyPickup(id);
    }
  }

  destroyPickup(id: string): void {
    this.ctx.pickups.delete(id);
    const view = this.ctx.pickupViews.get(id);
    if (view) {
      view.sprite.destroy();
      view.label.destroy();
      this.ctx.pickupViews.delete(id);
    }
  }
}
