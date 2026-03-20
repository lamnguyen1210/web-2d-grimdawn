import Phaser from "phaser";
import { enemyDefinitions } from "../content/enemies";
import { zoneDefinitions } from "../content/zones";
import { scaleStatsForLevel } from "../gameplay/stats";
import type { ActorState, EncounterDefinition, EliteModifier, ZoneId } from "../gameplay/types";
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
        this.spawnEnemy(spawn.enemyId, spawn.x, spawn.y, encounter, spawn.elite);
      }
      if (encounter.chest) {
        const chestX = encounter.chestX ?? (encounter.zoneId === "hollow" ? 1220 : 910);
        const chestY = encounter.chestY ?? (encounter.zoneId === "hollow" ? 1080 : 560);
        this.spawnChest(encounter.id, chestX, chestY);
      }
    }
  }

  spawnEnemy(enemyId: string, x: number, y: number, encounter: EncounterDefinition, elite?: EliteModifier): void {
    const definition = enemyDefinitions[enemyId];
    const level =
      encounter.zoneId === "arena"    ? Math.max(2, this.ctx.level + (enemyId === "warden" ? 1 : 0))
    : encounter.zoneId === "ashveil"  ? Math.max(1, this.ctx.level + 1)
    : encounter.zoneId === "deepmire" ? Math.max(1, this.ctx.level + 2)
    : encounter.zoneId === "hollow"   ? Math.max(2, this.ctx.level)
    :                                   Math.max(1, this.ctx.level);
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
        burnSourceId: "",
        poisonedUntil: 0,
        poisonDamageMin: 0,
        poisonDamageMax: 0,
        nextPoisonTickAt: 0,
        poisonSourceId: "",
        chilledUntil: 0,
        chillFactor: 0,
      },
      isBoss: definition.archetype === "boss",
      phase: 1,
    };
    this.ctx.actors.set(actor.id, actor);

    if (elite) {
      actor.isElite = true;
      actor.eliteModifier = elite;

      // Step A — all elites: health ×1.6, phys+fire damage ×1.2
      actor.stats = {
        ...actor.stats,
        maxHealth:         Math.round(actor.stats.maxHealth         * 1.6),
        physicalDamageMin: Math.round(actor.stats.physicalDamageMin * 1.2),
        physicalDamageMax: Math.round(actor.stats.physicalDamageMax * 1.2),
        fireDamageMin:     Math.round(actor.stats.fireDamageMin     * 1.2),
        fireDamageMax:     Math.round(actor.stats.fireDamageMax     * 1.2),
      };

      // Step B — modifier-specific extras
      if (elite === "frenzied") {
        actor.attackCooldownMultiplier = 0.6;
      } else if (elite === "armored") {
        actor.stats = {
          ...actor.stats,
          armor:              Math.round(actor.stats.armor * 1.6),
          physicalResistance: Math.min(0.85, actor.stats.physicalResistance + 0.15),
          fireResistance:     Math.min(0.85, actor.stats.fireResistance     + 0.15),
          poisonResistance:   Math.min(0.85, actor.stats.poisonResistance   + 0.15),
        };
      } else if (elite === "regenerating") {
        actor.stats = { ...actor.stats, healthRegen: actor.stats.healthRegen + 3 };
      } else if (elite === "empowered") {
        // Correct ×1.2 damage from Step A up to ×1.35 net (factor = 1.35/1.2)
        const correction = 1.35 / 1.2;
        actor.stats = {
          ...actor.stats,
          physicalDamageMin: Math.round(actor.stats.physicalDamageMin * correction),
          physicalDamageMax: Math.round(actor.stats.physicalDamageMax * correction),
          fireDamageMin:     Math.round(actor.stats.fireDamageMin     * correction),
          fireDamageMax:     Math.round(actor.stats.fireDamageMax     * correction),
        };
      }
      // volatile: no stat extras; explosion handled in CombatSystem on death

      // Step C — re-sync health to new maxHealth (MUST be last)
      actor.health = actor.stats.maxHealth;

      // Step D — visual + name
      actor.radius += 3;
      const title = elite.charAt(0).toUpperCase() + elite.slice(1);
      actor.name  = `${title} ${actor.name}`;
      actor.color = actor.color | 0x404040;
    }
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
    const transitions = zoneDefinitions[this.ctx.activeZoneId].transitions;
    for (const transition of transitions) {
      const p = this.ctx.player;
      const inside =
        p.x >= transition.x &&
        p.x <= transition.x + transition.width &&
        p.y >= transition.y &&
        p.y <= transition.y + transition.height;
      if (inside) {
        this.transitionToZone(transition.toZoneId, transition.targetX, transition.targetY);
        return;
      }
    }
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
    for (const timer of this.ctx.pendingTimers) {
      timer.remove(false);
    }
    this.ctx.pendingTimers = [];

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

    // Clean up minimap
    if (this.ctx.minimapBg) {
      this.ctx.minimapBg.destroy();
      this.ctx.minimapBg = undefined;
    }
    for (const dot of this.ctx.minimapDots) {
      dot.destroy();
    }
    this.ctx.minimapDots = [];

    this.ctx.phaseTwoSummoned = false;
    this.ctx.skillCooldowns = {};
    this.ctx.overlayRect.setFillStyle(0x000000, 0);
  }
}
