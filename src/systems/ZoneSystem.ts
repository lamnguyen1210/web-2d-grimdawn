import Phaser from "phaser";
import { enemyDefinitions } from "../content/enemies";
import { zoneDefinitions } from "../content/zones";
import { scaleStatsForLevel } from "../gameplay/stats";
import type { ActorState, EncounterDefinition, ZoneId } from "../gameplay/types";
import type { GameContext } from "./GameContext";
import type { LootSystem } from "./LootSystem";
import type { RenderSystem } from "./RenderSystem";

export class ZoneSystem {
  constructor(
    private ctx: GameContext,
    private render: RenderSystem,
    private loot: LootSystem,
  ) {}

  spawnZone(zoneId: ZoneId): void {
    this.ctx.activeZoneId = zoneId;
    this.ctx.player.zoneId = zoneId;
    for (const encounter of zoneDefinitions[zoneId].encounters) {
      if (this.ctx.clearedEncounterIds.has(encounter.id)) {
        continue;
      }
      for (const spawn of encounter.spawns) {
        this.spawnEnemy(spawn.enemyId, spawn.x, spawn.y, encounter);
      }
      if (encounter.chest) {
        this.spawnChest(encounter.id, 910, 560);
      }
    }
  }

  spawnEnemy(enemyId: string, x: number, y: number, encounter: EncounterDefinition): void {
    const definition = enemyDefinitions[enemyId];
    const level =
      encounter.zoneId === "arena"
        ? Math.max(2, this.ctx.level + (enemyId === "warden" ? 1 : 0))
        : Math.max(1, this.ctx.level);
    const stats = scaleStatsForLevel(definition.baseStats, level);
    const actor: ActorState = {
      id: `${enemyId}-${Phaser.Math.RND.uuid()}`,
      definitionId: definition.id,
      name: definition.name,
      faction: "enemy",
      x,
      y,
      radius: definition.radius,
      color: definition.color,
      level,
      stats,
      health: stats.maxHealth,
      energy: 0,
      alive: true,
      zoneId: encounter.zoneId,
      encounterId: encounter.id,
      aiState: "idle",
      lastActionAt: 0,
      attackCooldownUntil: 0,
      status: {
        burningUntil: 0,
        burnDamageMin: 0,
        burnDamageMax: 0,
        nextBurnTickAt: 0,
      },
      isBoss: definition.archetype === "boss",
      phase: 1,
    };
    this.ctx.actors.set(actor.id, actor);
  }

  spawnChest(encounterId: string, x: number, y: number): void {
    const id = `chest-${encounterId}`;
    if (this.ctx.pickups.has(id)) {
      return;
    }
    this.ctx.pickups.set(id, {
      id,
      kind: "chest",
      x,
      y,
      encounterId,
      label: "Supply Cache",
    });
  }

  checkTransitions(): void {
    const transition = zoneDefinitions[this.ctx.activeZoneId].transition;
    if (!transition) {
      return;
    }
    const p = this.ctx.player;
    const inside =
      p.x >= transition.x &&
      p.x <= transition.x + transition.width &&
      p.y >= transition.y &&
      p.y <= transition.y + transition.height;
    if (!inside) {
      return;
    }
    this.transitionToZone(transition.toZoneId, transition.targetX, transition.targetY);
  }

  transitionToZone(zoneId: ZoneId, x: number, y: number): void {
    this.clearZoneState();
    this.ctx.activeZoneId = zoneId;
    this.ctx.player.zoneId = zoneId;
    this.ctx.player.x = x;
    this.ctx.player.y = y;
    this.ctx.player.moveTarget = undefined;
    this.ctx.player.targetId = undefined;
    this.ctx.actors.set(this.ctx.player.id, this.ctx.player);
    this.spawnZone(zoneId);
    this.render.createZoneVisuals();
    this.render.syncActorViews();
    this.ctx.log(`Entered ${zoneDefinitions[zoneId].name}.`);
    this.ctx.autosave();
  }

  clearZoneState(): void {
    for (const [id, actor] of [...this.ctx.actors.entries()]) {
      if (id === this.ctx.player.id) {
        continue;
      }
      this.ctx.actors.delete(id);
      const view = this.ctx.actorViews.get(id);
      if (view) {
        view.body.destroy();
        view.shadow.destroy();
        view.hpBar.destroy();
        view.hpBarBg.destroy();
        view.nameLabel.destroy();
        this.ctx.actorViews.delete(id);
      }
    }

    for (const [id, view] of [...this.ctx.projectileViews.entries()]) {
      view.shape.destroy();
      this.ctx.projectileViews.delete(id);
    }
    this.ctx.projectiles.clear();

    for (const [id, view] of [...this.ctx.hazardViews.entries()]) {
      view.shape.destroy();
      this.ctx.hazardViews.delete(id);
    }
    this.ctx.hazards.clear();

    for (const [, effect] of [...this.ctx.attackEffects.entries()]) {
      effect.slash.destroy();
      effect.impact.destroy();
    }
    this.ctx.attackEffects.clear();

    if (this.ctx.clickPulse) {
      this.ctx.clickPulse.ring.destroy();
      this.ctx.clickPulse = undefined;
    }
    if (this.ctx.targetRing) {
      this.ctx.targetRing.destroy();
      this.ctx.targetRing = undefined;
    }

    for (const [id, view] of [...this.ctx.pickupViews.entries()]) {
      view.sprite.destroy();
      view.label.destroy();
      this.ctx.pickupViews.delete(id);
    }
    this.ctx.pickups.clear();

    this.ctx.phaseTwoSummoned = false;
  }

  resetRuntimeState(): void {
    this.clearZoneState();

    for (const view of this.ctx.actorViews.values()) {
      view.body.destroy();
      view.shadow.destroy();
      view.hpBar.destroy();
      view.hpBarBg.destroy();
      view.nameLabel.destroy();
    }
    this.ctx.actorViews.clear();
    this.ctx.actors.clear();

    for (const text of this.ctx.floatingTexts.values()) {
      text.destroy();
    }
    this.ctx.floatingTexts.clear();

    for (const effect of this.ctx.attackEffects.values()) {
      effect.slash.destroy();
      effect.impact.destroy();
    }
    this.ctx.attackEffects.clear();

    if (this.ctx.clickPulse) {
      this.ctx.clickPulse.ring.destroy();
      this.ctx.clickPulse = undefined;
    }
    if (this.ctx.targetRing) {
      this.ctx.targetRing.destroy();
      this.ctx.targetRing = undefined;
    }

    if (this.ctx.bossHealthBarBg) {
      this.ctx.bossHealthBarBg.destroy();
      this.ctx.bossHealthBarBg = undefined;
    }
    if (this.ctx.bossHealthBar) {
      this.ctx.bossHealthBar.destroy();
      this.ctx.bossHealthBar = undefined;
    }

    this.ctx.phaseTwoSummoned = false;
    this.ctx.skillCooldowns = {};
    this.ctx.overlayRect.setFillStyle(0x000000, 0);
  }
}
