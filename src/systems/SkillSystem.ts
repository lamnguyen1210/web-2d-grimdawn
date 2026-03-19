import Phaser from "phaser";
import { skillDefinitions } from "../content/skills";
import type { GameContext } from "./GameContext";
import type { CombatSystem } from "./CombatSystem";
import type { RenderSystem } from "./RenderSystem";

export class SkillSystem {
  constructor(
    private ctx: GameContext,
    private combat: CombatSystem,
    private render: RenderSystem,
  ) {}

  hasSkillResources(skillId: "cleaveShot" | "fireBomb"): boolean {
    const skill = skillDefinitions[skillId];
    const cooldownUntil = this.ctx.skillCooldowns[skillId] ?? 0;
    if (cooldownUntil > this.ctx.scene.time.now) {
      this.ctx.log(`${skill.name} is still on cooldown.`);
      return false;
    }
    if (this.ctx.player.energy < skill.energyCost) {
      this.ctx.log(`Not enough energy for ${skill.name}.`);
      return false;
    }
    return true;
  }

  tryCastCleaveShot(): void {
    if (!this.hasSkillResources("cleaveShot")) {
      return;
    }
    this.ctx.player.energy -= skillDefinitions.cleaveShot.energyCost;
    this.ctx.skillCooldowns.cleaveShot = this.ctx.scene.time.now + skillDefinitions.cleaveShot.cooldownMs;
    const targetPoint =
      this.ctx.player.targetId && this.ctx.actors.get(this.ctx.player.targetId)
        ? this.ctx.actors.get(this.ctx.player.targetId)!
        : { x: this.ctx.lastPointerWorld.x || this.ctx.player.x + 1, y: this.ctx.lastPointerWorld.y || this.ctx.player.y };
    const facing = new Phaser.Math.Vector2(targetPoint.x - this.ctx.player.x, targetPoint.y - this.ctx.player.y);
    if (facing.lengthSq() === 0) {
      facing.setTo(1, 0);
    }
    facing.normalize();
    for (const actor of this.ctx.actors.values()) {
      if (actor.faction !== "enemy" || !actor.alive || actor.zoneId !== this.ctx.activeZoneId) {
        continue;
      }
      const toEnemy = new Phaser.Math.Vector2(actor.x - this.ctx.player.x, actor.y - this.ctx.player.y);
      const distance = toEnemy.length();
      if (distance > skillDefinitions.cleaveShot.range) {
        continue;
      }
      toEnemy.normalize();
      const angle = Phaser.Math.RadToDeg(Math.acos(Phaser.Math.Clamp(facing.dot(toEnemy), -1, 1)));
      if (angle <= 38) {
        this.combat.applyDamage(
          this.ctx.player,
          actor,
          this.ctx.player.stats.physicalDamageMin + 6,
          this.ctx.player.stats.physicalDamageMax + 9,
          "physical",
        );
      }
    }
    this.render.spawnFloatingText(this.ctx.player.x, this.ctx.player.y - 36, "Cleave Shot", "#f1d08e");
    this.ctx.log("Cleave Shot tears through the pack.");
  }

  tryCastFireBomb(x: number, y: number): void {
    if (!this.hasSkillResources("fireBomb")) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.ctx.player.x, this.ctx.player.y, x, y);
    const range = skillDefinitions.fireBomb.range;
    let targetX = x;
    let targetY = y;
    if (distance > range) {
      const angle = Phaser.Math.Angle.Between(this.ctx.player.x, this.ctx.player.y, x, y);
      targetX = this.ctx.player.x + Math.cos(angle) * range;
      targetY = this.ctx.player.y + Math.sin(angle) * range;
    }

    this.ctx.player.energy -= skillDefinitions.fireBomb.energyCost;
    this.ctx.skillCooldowns.fireBomb = this.ctx.scene.time.now + skillDefinitions.fireBomb.cooldownMs;
    const delay = 420;
    const marker = this.ctx.scene.add.circle(targetX, targetY, 18, 0xde8a4d, 0.25).setDepth(2);
    marker.setStrokeStyle(2, 0xf3d492, 0.55);
    this.ctx.scene.tweens.add({
      targets: marker,
      scale: 3.8,
      alpha: 0,
      duration: delay,
      onComplete: () => marker.destroy(),
    });
    this.ctx.scene.time.delayedCall(delay, () => {
      this.combat.createHazard(
        targetX,
        targetY,
        68,
        this.ctx.scene.time.now + 4500,
        800,
        this.ctx.player.stats.fireDamageMin + 8,
        this.ctx.player.stats.fireDamageMax + 12,
      );
      this.render.spawnFloatingText(targetX, targetY - 36, "Fire Bomb", "#f09a62");
    });
    this.ctx.log("Fire Bomb lands and ignites the ground.");
  }
}
