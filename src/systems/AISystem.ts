import Phaser from "phaser";
import { enemyDefinitions } from "../content/enemies";
import type { ActorState, DamageType, EnemyDefinition, ProjectileState } from "../gameplay/types";
import { moveActorTowards, moveActorAway, pushActor } from "../gameplay/movement";
import type { GameContext } from "./GameContext";
import type { CombatSystem } from "./CombatSystem";
import type { ZoneSystem } from "./ZoneSystem";
import { zoneDefinitions } from "../content/zones";

export class AISystem {
  constructor(
    private ctx: GameContext,
    private combat: CombatSystem,
    private zone: ZoneSystem,
  ) {}

  updateEnemies(time: number, delta: number): void {
    const zoneW = zoneDefinitions[this.ctx.activeZoneId].width;
    const zoneH = zoneDefinitions[this.ctx.activeZoneId].height;

    for (const actor of this.ctx.actors.values()) {
      if (actor.faction !== "enemy" || !actor.alive || actor.zoneId !== this.ctx.activeZoneId) {
        continue;
      }
      const definition = enemyDefinitions[actor.definitionId!];
      const distance = Phaser.Math.Distance.Between(actor.x, actor.y, this.ctx.player.x, this.ctx.player.y);
      const aggroRange = definition.archetype === "boss" ? 380 : 260;

      if (distance <= aggroRange) {
        actor.aiState = "chase";
      } else if (distance > aggroRange + 80) {
        actor.aiState = "idle";
      }

      if (
        definition.archetype === "boss" &&
        actor.phase === 1 &&
        actor.health <= actor.stats.maxHealth * 0.5 &&
        !this.ctx.phaseTwoSummoned
      ) {
        actor.phase = 2;
        this.ctx.phaseTwoSummoned = true;
        this.ctx.log("Warden Alchemist enters phase two and summons reinforcements.");
        this.zone.spawnEnemy("scavenger", actor.x - 80, actor.y + 110, {
          id: "boss-adds",
          zoneId: "arena",
          spawns: [],
        });
        this.zone.spawnEnemy("cultist", actor.x + 90, actor.y - 90, {
          id: "boss-adds",
          zoneId: "arena",
          spawns: [],
        });
      }

      // Chill slows attack cooldowns
      const chillMult = actor.status.chilledUntil > time ? 1 + actor.status.chillFactor : 1;
      const effectiveCooldown = definition.attackCooldownMs * chillMult;

      if (distance <= definition.attackRange && time >= actor.attackCooldownUntil) {
        actor.attackCooldownUntil = time + effectiveCooldown;
        if (definition.archetype === "ranged" || definition.archetype === "boss") {
          this.fireEnemyProjectile(actor, definition);
          if (definition.archetype === "boss" && actor.phase === 2) {
            this.combat.createHazard(this.ctx.player.x, this.ctx.player.y, 74, time + 3800, 650, 6, 11);
          }
        } else {
          this.combat.applyDamage(actor, this.ctx.player, definition.contactDamageMin, definition.contactDamageMax, "physical");
          if (definition.archetype === "bruiser") {
            pushActor(this.ctx.player, actor.x, actor.y, 24, zoneW, zoneH);
          }
          // Plague Stalker applies poison on contact
          if (definition.id === "plagueStalker") {
            this.combat.applyPoison(this.ctx.player, time, 2, 4);
          }
        }
      } else if (actor.aiState === "chase") {
        // Chill slows movement
        const moveSpeedMult = actor.status.chilledUntil > time ? 1 - actor.status.chillFactor : 1;
        const effectiveSpeed = actor.stats.moveSpeed * moveSpeedMult;

        if (definition.archetype === "ranged" && distance < 140) {
          moveActorAway(actor, this.ctx.player.x, this.ctx.player.y, effectiveSpeed * 0.9, delta, zoneW, zoneH);
        } else {
          moveActorTowards(actor, this.ctx.player.x, this.ctx.player.y, effectiveSpeed, delta, zoneW, zoneH);
        }
      }

      actor.health = Phaser.Math.Clamp(actor.health + actor.stats.healthRegen * (delta / 1000), 0, actor.stats.maxHealth);
    }
  }

  fireEnemyProjectile(actor: ActorState, definition: EnemyDefinition): void {
    const angle = Phaser.Math.Angle.Between(actor.x, actor.y, this.ctx.player.x, this.ctx.player.y);
    const speed = definition.archetype === "boss" ? 240 : 210;

    // Frost Wraith fires chill projectiles (physical type + chill)
    const isFrostWraith = definition.id === "frostWraith";
    const damageType: DamageType = isFrostWraith ? "physical" : (definition.archetype === "ranged" || definition.archetype === "boss") ? "fire" : "physical";

    const projectile: ProjectileState & { appliesChill?: boolean } = {
      id: Phaser.Math.RND.uuid(),
      x: actor.x,
      y: actor.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: definition.archetype === "boss" ? 10 : 7,
      sourceId: actor.id,
      faction: "enemy",
      damageMin: definition.contactDamageMin,
      damageMax: definition.contactDamageMax + (definition.archetype === "boss" ? 4 : 0),
      damageType,
      expiresAt: this.ctx.scene.time.now + 4000,
      appliesChill: isFrostWraith,
    };
    this.ctx.projectiles.set(projectile.id, projectile);
  }
}
