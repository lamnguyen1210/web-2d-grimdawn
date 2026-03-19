import Phaser from "phaser";
import { enemyDefinitions } from "../content/enemies";
import { skillDefinitions } from "../content/skills";
import { zoneDefinitions } from "../content/zones";
import { addStats, createStatBlock, scaleStatsForLevel } from "../gameplay/stats";
import type { ActorState, DamageType, PartialStats, ProjectileState } from "../gameplay/types";
import type { GameContext } from "./GameContext";
import type { LootSystem } from "./LootSystem";
import type { RenderSystem } from "./RenderSystem";

export const PLAYER_BASE_STATS = createStatBlock({
  maxHealth: 160,
  healthRegen: 1.2,
  maxEnergy: 80,
  energyRegen: 5.5,
  armor: 10,
  moveSpeed: 164,
  attackSpeed: 1,
  physicalDamageMin: 8,
  physicalDamageMax: 12,
  fireDamageMin: 2,
  fireDamageMax: 4,
  critChance: 0.08,
  critMultiplier: 1.6,
  physicalResistance: 0.05,
  fireResistance: 0.05,
  poisonResistance: 0.03,
});

export const LEVEL_THRESHOLDS = [0, 70, 180, 360, 580];

export class CombatSystem {
  constructor(
    private ctx: GameContext,
    private render: RenderSystem,
    private loot: LootSystem,
  ) {}

  applyDamage(source: ActorState, target: ActorState, min: number, max: number, damageType: DamageType, silent = false): void {
    if (!target.alive) {
      return;
    }
    const rolled = Phaser.Math.Between(Math.round(min), Math.round(max));
    const crit = Math.random() < source.stats.critChance;
    let amount = rolled + (damageType === "physical" ? source.stats.physicalDamageMin / 6 : damageType === "fire" ? source.stats.fireDamageMin / 4 : source.stats.physicalDamageMin / 5);
    if (crit) {
      amount *= source.stats.critMultiplier;
    }
    if (damageType === "physical") {
      amount = amount * (1 - Phaser.Math.Clamp(target.stats.physicalResistance, 0, 0.75));
      amount -= target.stats.armor * 0.25;
    } else if (damageType === "fire") {
      amount = amount * (1 - Phaser.Math.Clamp(target.stats.fireResistance, 0, 0.75));
    } else {
      amount = amount * (1 - Phaser.Math.Clamp(target.stats.poisonResistance, 0, 0.75));
    }
    amount = Math.max(1, Math.round(amount));
    target.health = Math.max(0, target.health - amount);
    target.bodyHitUntil = this.ctx.scene.time.now;

    const color = damageType === "fire" ? "#ff9d73" : damageType === "poison" ? "#8bef6a" : "#f0e6d2";
    const fontSize = crit ? 18 : 14;
    this.render.spawnFloatingText(
      target.x,
      target.y - target.radius - 8,
      `${crit ? "CRIT " : ""}${amount}`,
      color,
      fontSize,
    );

    if (crit) {
      this.render.shakeCamera(3, 80);
    }

    if (!silent) {
      this.ctx.log(`${source.name} deals ${amount} ${damageType} to ${target.name}.`);
    }
    if (target.health <= 0) {
      this.handleDeath(source, target);
    }
  }

  applyBurn(target: ActorState, time: number, damageMin: number, damageMax: number): void {
    target.status.burningUntil = time + 3200;
    target.status.burnDamageMin = Math.max(target.status.burnDamageMin, damageMin);
    target.status.burnDamageMax = Math.max(target.status.burnDamageMax, damageMax);
    target.status.nextBurnTickAt = time + 1000;
  }

  applyPoison(target: ActorState, time: number, damageMin: number, damageMax: number): void {
    target.status.poisonedUntil = time + 4000;
    target.status.poisonDamageMin = Math.max(target.status.poisonDamageMin, damageMin);
    target.status.poisonDamageMax = Math.max(target.status.poisonDamageMax, damageMax);
    target.status.nextPoisonTickAt = time + 1200;
  }

  applyChill(target: ActorState, time: number, factor: number): void {
    target.status.chilledUntil = time + 3000;
    target.status.chillFactor = Math.min(0.6, Math.max(target.status.chillFactor, factor));
  }

  handleDeath(source: ActorState, target: ActorState): void {
    target.alive = false;
    target.health = 0;
    target.targetId = undefined;
    target.moveTarget = undefined;
    target.deathAnimatedUntil = this.ctx.scene.time.now + 1200;
    if (target.faction === "enemy") {
      const definition = enemyDefinitions[target.definitionId!];
      this.gainXp(definition.xpReward);
      this.loot.dropRewards(target, definition.id);
      this.ctx.log(`${target.name} falls.`);
      this.render.spawnFloatingText(target.x, target.y - target.radius - 24, `+${definition.xpReward} XP`, "#f5d56b");
      const encounterId = target.encounterId;
      if (encounterId) {
        const aliveInEncounter = [...this.ctx.actors.values()].some((actor) => actor.alive && actor.encounterId === encounterId);
        if (!aliveInEncounter) {
          this.ctx.clearedEncounterIds.add(encounterId);
          this.ctx.log(`Encounter cleared: ${encounterId.replaceAll("-", " ")}.`);
        }
      }
      if (target.isBoss) {
        this.ctx.inventory.gold += 80;
        this.ctx.inventory.potions += 2;
        this.ctx.log("Boss defeated. The crossroads route is secure.");
        this.render.shakeCamera(6, 200);
        this.ctx.autosave();
      }
    } else {
      this.ctx.log(`You were slain by ${source.name}.`);
      this.ctx.overlayRect.setFillStyle(0x000000, 0.42);
      this.render.spawnFloatingText(this.ctx.player.x, this.ctx.player.y - 48, "Defeated", "#f07568");
    }
  }

  updateBurning(time: number): void {
    for (const actor of this.ctx.actors.values()) {
      if (!actor.alive || actor.status.burningUntil <= time || actor.status.nextBurnTickAt > time) {
        continue;
      }
      actor.status.nextBurnTickAt = time + 1000;
      const source = actor.faction === "player" ? actor : this.ctx.player;
      this.applyDamage(source, actor, actor.status.burnDamageMin, actor.status.burnDamageMax, "fire", true);
    }
  }

  updatePoison(time: number): void {
    for (const actor of this.ctx.actors.values()) {
      if (!actor.alive || actor.status.poisonedUntil <= time || actor.status.nextPoisonTickAt > time) {
        continue;
      }
      actor.status.nextPoisonTickAt = time + 1200;
      const source = actor.faction === "player" ? actor : this.ctx.player;
      this.applyDamage(source, actor, actor.status.poisonDamageMin, actor.status.poisonDamageMax, "poison", true);
    }
  }

  performBasicAttack(target: ActorState, time: number): void {
    this.ctx.player.attackCooldownUntil = time + skillDefinitions.basicAttack.cooldownMs / Math.max(0.65, this.ctx.player.stats.attackSpeed);
    this.applyDamage(this.ctx.player, target, this.ctx.player.stats.physicalDamageMin, this.ctx.player.stats.physicalDamageMax, "physical");
    this.render.spawnBasicAttackEffect(target, time);
    this.ctx.log(`Basic attack hits ${target.name}.`);
  }

  consumePotion(): void {
    if (this.ctx.inventory.potions <= 0) {
      this.ctx.log("No health tonics left.");
      return;
    }
    if (this.ctx.player.health >= this.ctx.player.stats.maxHealth - 2) {
      this.ctx.log("Health is already full.");
      return;
    }
    this.ctx.inventory.potions -= 1;
    this.ctx.player.health = Math.min(this.ctx.player.stats.maxHealth, this.ctx.player.health + 64);
    this.ctx.log("Consumed a health tonic.");
    this.render.spawnFloatingText(this.ctx.player.x, this.ctx.player.y - 42, "+64", "#8bcf84");
  }

  gainXp(amount: number): void {
    this.ctx.xp += amount;
    while (this.ctx.level < LEVEL_THRESHOLDS.length - 1 && this.ctx.xp >= this.ctx.nextLevelXp) {
      this.ctx.level += 1;
      this.ctx.nextLevelXp = LEVEL_THRESHOLDS[this.ctx.level] ?? LEVEL_THRESHOLDS.at(-1)!;
      this.recalculatePlayerStats(true);
      this.ctx.log(`Level up. You are now level ${this.ctx.level}.`);
      this.render.spawnFloatingText(this.ctx.player.x, this.ctx.player.y - 56, `Level ${this.ctx.level}`, "#f5d56b", 20);
      this.render.shakeCamera(4, 120);
      this.ctx.autosave();
    }
  }

  recalculatePlayerStats(fullHeal = false): void {
    const healthRatio = this.ctx.player ? this.ctx.player.health / this.ctx.player.stats.maxHealth : 1;
    const energyRatio = this.ctx.player ? this.ctx.player.energy / this.ctx.player.stats.maxEnergy : 1;
    const stats = this.buildPlayerStats();
    this.ctx.player.stats = stats;
    this.ctx.player.level = this.ctx.level;
    this.ctx.player.health = fullHeal ? stats.maxHealth : Math.min(stats.maxHealth, Math.max(1, stats.maxHealth * healthRatio));
    this.ctx.player.energy = fullHeal ? stats.maxEnergy : Math.min(stats.maxEnergy, stats.maxEnergy * energyRatio);
  }

  buildPlayerStats() {
    const equipmentBonuses = Object.values(this.ctx.inventory.equipped)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => item.stats);
    const levelBonus: PartialStats = {
      maxHealth: (this.ctx.level - 1) * 24,
      maxEnergy: (this.ctx.level - 1) * 10,
      armor: (this.ctx.level - 1) * 3,
      physicalDamageMin: this.ctx.level - 1,
      physicalDamageMax: (this.ctx.level - 1) * 2,
      fireDamageMin: this.ctx.level - 1,
      fireDamageMax: (this.ctx.level - 1) * 2,
      moveSpeed: (this.ctx.level - 1) * 3,
    };
    return addStats(PLAYER_BASE_STATS, levelBonus, ...equipmentBonuses);
  }

  updateProjectiles(time: number, delta: number): void {
    const zone = zoneDefinitions[this.ctx.activeZoneId];
    for (const [id, projectile] of [...this.ctx.projectiles.entries()]) {
      projectile.x += projectile.vx * (delta / 1000);
      projectile.y += projectile.vy * (delta / 1000);

      const hitTarget =
        projectile.faction === "player"
          ? [...this.ctx.actors.values()].find(
              (actor) =>
                actor.faction === "enemy" &&
                actor.alive &&
                actor.zoneId === this.ctx.activeZoneId &&
                Phaser.Math.Distance.Between(actor.x, actor.y, projectile.x, projectile.y) <= actor.radius + projectile.radius,
            )
          : Phaser.Math.Distance.Between(this.ctx.player.x, this.ctx.player.y, projectile.x, projectile.y) <= this.ctx.player.radius + projectile.radius
            ? this.ctx.player
            : undefined;

      if (hitTarget) {
        if (projectile.faction === "player") {
          this.applyDamage(this.ctx.player, hitTarget, projectile.damageMin, projectile.damageMax, projectile.damageType);
          if (projectile.damageType === "poison") {
            this.applyPoison(hitTarget, time, 3, 5);
          }
        } else {
          this.applyDamage(
            [...this.ctx.actors.values()].find((actor) => actor.id === projectile.sourceId) ?? this.ctx.player,
            hitTarget,
            projectile.damageMin,
            projectile.damageMax,
            projectile.damageType,
          );
          if (projectile.damageType === "fire") {
            this.applyBurn(hitTarget, time, 4, 7);
          }
          if (projectile.damageType === "physical" && (projectile as ProjectileState & { appliesChill?: boolean }).appliesChill) {
            this.applyChill(hitTarget, time, 0.35);
          }
        }
        this.destroyProjectile(id);
        continue;
      }

      if (
        projectile.expiresAt <= time ||
        projectile.x < 0 ||
        projectile.x > zone.width ||
        projectile.y < 0 ||
        projectile.y > zone.height
      ) {
        this.destroyProjectile(id);
      }
    }
  }

  updateHazards(time: number): void {
    for (const [id, hazard] of [...this.ctx.hazards.entries()]) {
      if (time >= hazard.expiresAt) {
        this.destroyHazard(id);
        continue;
      }
      if (time >= hazard.nextTickAt) {
        hazard.nextTickAt = time + hazard.tickEveryMs;
        const hazDmgType = hazard.damageType ?? "fire";
        const enemies = [...this.ctx.actors.values()].filter(
          (actor) =>
            actor.faction === "enemy" &&
            actor.alive &&
            actor.zoneId === this.ctx.activeZoneId &&
            Phaser.Math.Distance.Between(actor.x, actor.y, hazard.x, hazard.y) <= hazard.radius + actor.radius,
        );
        for (const enemy of enemies) {
          this.applyDamage(this.ctx.player, enemy, hazard.damageMin, hazard.damageMax, hazDmgType);
          if (hazDmgType === "fire") {
            this.applyBurn(enemy, time, Math.max(1, hazard.damageMin - 1), Math.max(2, hazard.damageMax - 1));
          }
        }
        if (Phaser.Math.Distance.Between(this.ctx.player.x, this.ctx.player.y, hazard.x, hazard.y) <= hazard.radius + this.ctx.player.radius) {
          const boss = [...this.ctx.actors.values()].find((actor) => actor.isBoss && actor.alive) ?? this.ctx.player;
          this.applyDamage(boss, this.ctx.player, hazard.damageMin, hazard.damageMax, hazDmgType);
          if (hazDmgType === "fire") {
            this.applyBurn(this.ctx.player, time, Math.max(1, hazard.damageMin - 2), Math.max(2, hazard.damageMax - 2));
          }
        }
      }
    }
  }

  createHazard(x: number, y: number, radius: number, expiresAt: number, tickEveryMs: number, damageMin: number, damageMax: number, damageType?: DamageType): void {
    const id = Phaser.Math.RND.uuid();
    this.ctx.hazards.set(id, {
      x,
      y,
      radius,
      expiresAt,
      tickEveryMs,
      nextTickAt: this.ctx.scene.time.now + 120,
      damageMin,
      damageMax,
      damageType,
    });
  }

  destroyProjectile(id: string): void {
    this.ctx.projectiles.delete(id);
    const view = this.ctx.projectileViews.get(id);
    if (view) {
      view.shape.destroy();
      this.ctx.projectileViews.delete(id);
    }
  }

  destroyHazard(id: string): void {
    this.ctx.hazards.delete(id);
    const view = this.ctx.hazardViews.get(id);
    if (view) {
      view.shape.destroy();
      this.ctx.hazardViews.delete(id);
    }
  }
}
