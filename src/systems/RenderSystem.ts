import { zoneDefinitions } from "../content/zones";
import { skillDefinitions } from "../content/skills";
import { GameContext } from "./GameContext";
import { ActorState } from "../gameplay/types";

export class RenderSystem {
  constructor(private ctx: GameContext) {}

  createZoneVisuals(): void {
    this.ctx.scene.children.list
      .filter((child) => child.name === "zone-art")
      .forEach((child) => child.destroy());

    const zone = zoneDefinitions[this.ctx.activeZoneId];
    this.ctx.scene.cameras.main.setBounds(0, 0, zone.width, zone.height);

    const bgColor = zone.id === "crossroads" ? 0x2d231f : zone.id === "hollow" ? 0x1f2d1f : 0x261d1a;
    const bg = this.ctx.scene.add.rectangle(
      zone.width / 2,
      zone.height / 2,
      zone.width,
      zone.height,
      bgColor,
      1,
    );
    bg.name = "zone-art";
    bg.setDepth(-5);

    const patchColor = zone.id === "crossroads" ? 0x403226 : zone.id === "hollow" ? 0x2a4028 : 0x3b291f;
    for (let i = 0; i < 18; i += 1) {
      const x = 120 + i * 90;
      const y = 180 + (i % 4) * 180;
      const patch = this.ctx.scene.add.ellipse(x, y, 180, 90, patchColor, 0.38);
      patch.setRotation((i % 3) * 0.2);
      patch.setDepth(-4);
      patch.name = "zone-art";
    }

    const roadColor = zone.id === "crossroads" ? 0x5c4a3c : zone.id === "hollow" ? 0x3d5c3a : 0x4b3830;
    const road = this.ctx.scene.add.rectangle(
      zone.width / 2,
      zone.height / 2,
      zone.id === "crossroads" ? zone.width - 120 : zone.width - 160,
      zone.id === "crossroads" ? 220 : 300,
      roadColor,
      0.45,
    );
    road.setDepth(-3);
    road.name = "zone-art";

    for (const t of zone.transitions) {
      const gate = this.ctx.scene.add.rectangle(t.x + t.width / 2, t.y + t.height / 2, t.width, t.height, 0xf2b35f, 0.09);
      gate.setStrokeStyle(2, 0xf2b35f, 0.36);
      gate.setDepth(1);
      gate.name = "zone-art";
      const label = this.ctx.scene.add.text(t.x + 6, t.y - 20, t.label, {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color: "#f4d39c",
        stroke: "#000000",
        strokeThickness: 3,
      });
      label.setDepth(1);
      label.name = "zone-art";
    }
  }

  syncActorViews(): void {
    for (const actor of this.ctx.actors.values()) {
      if (this.ctx.actorViews.has(actor.id)) {
        continue;
      }
      const shadow = this.ctx.scene.add.ellipse(actor.x, actor.y + actor.radius + 6, actor.radius * 2, actor.radius, 0x000000, 0.25).setDepth(1);
      const body = this.ctx.scene.add.circle(actor.x, actor.y, actor.radius, actor.color).setDepth(4);
      const hpBarBg = this.ctx.scene.add.rectangle(actor.x, actor.y - actor.radius - 12, actor.radius * 2.2, 6, 0x000000, 0.55).setDepth(6);
      const hpBar = this.ctx.scene.add
        .rectangle(actor.x - actor.radius * 1.1, actor.y - actor.radius - 12, actor.radius * 2.2, 6, actor.faction === "player" ? 0x88c06f : 0xd56b52, 1)
        .setOrigin(0, 0.5)
        .setDepth(7);
      const nameLabel = this.ctx.scene.add
        .text(actor.x, actor.y - actor.radius - 30, actor.name, {
          fontFamily: "Trebuchet MS",
          fontSize: actor.faction === "player" ? "14px" : "12px",
          color: actor.faction === "player" ? "#f2dcc0" : "#f0c3b0",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(8);
      this.ctx.actorViews.set(actor.id, { body, shadow, hpBarBg, hpBar, nameLabel });
    }

    for (const pickup of this.ctx.pickups.values()) {
      if (this.ctx.pickupViews.has(pickup.id)) {
        continue;
      }
      const sprite =
        pickup.kind === "item"
          ? this.ctx.scene.add.rectangle(pickup.x, pickup.y, 16, 18, 0x7eb7ff, 1).setDepth(3)
          : pickup.kind === "gold"
            ? this.ctx.scene.add.circle(pickup.x, pickup.y, 8, 0xf3cd66, 1).setDepth(3)
            : pickup.kind === "potion"
              ? this.ctx.scene.add.circle(pickup.x, pickup.y, 9, 0xcd4f49, 1).setDepth(3)
              : this.ctx.scene.add.rectangle(pickup.x, pickup.y, 28, 20, 0xa67943, 1).setDepth(3);
      const label = this.ctx.scene.add
        .text(pickup.x, pickup.y - 22, pickup.label, {
          fontFamily: "Trebuchet MS",
          fontSize: "12px",
          color: "#f4d39c",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(4);
      this.ctx.pickupViews.set(pickup.id, { sprite, label });
    }
  }

  refreshRenderState(time: number): void {
    this.syncActorViews();
    this.ctx.scene.cameras.main.centerOn(this.ctx.player.x, this.ctx.player.y);
    this.refreshTargetRing(time);

    for (const [id, actor] of this.ctx.actors.entries()) {
      const view = this.ctx.actorViews.get(id);
      if (!view) {
        continue;
      }
      const visible = actor.zoneId === this.ctx.activeZoneId;
      if (!actor.alive) {
        if (actor.deathAnimatedUntil && actor.deathAnimatedUntil > time) {
          const progress = 1 - (actor.deathAnimatedUntil - time) / 1200;
          view.body.setFillStyle(0x2b1f1a, Math.max(0, 0.35 - progress * 0.35));
        } else {
          view.body.setFillStyle(0x2b1f1a, 0);
          view.shadow.setAlpha(0);
        }
        view.hpBar.setVisible(false);
        view.hpBarBg.setVisible(false);
        view.nameLabel.setVisible(false);
      }
      view.body.setPosition(actor.x, actor.y);
      view.shadow.setPosition(actor.x, actor.y + actor.radius + 6);
      view.hpBarBg.setPosition(actor.x, actor.y - actor.radius - 12);
      view.hpBar.setPosition(actor.x - actor.radius * 1.1, actor.y - actor.radius - 12);
      view.hpBar.displayWidth = actor.radius * 2.2 * Phaser.Math.Clamp(actor.health / actor.stats.maxHealth, 0, 1);
      view.nameLabel.setPosition(actor.x, actor.y - actor.radius - 30);

      // Status effect visuals
      let strokeWidth = 0;
      let strokeColor = 0xffffff;
      if (actor.bodyHitUntil && actor.bodyHitUntil > time) {
        strokeWidth = 4;
        strokeColor = 0xffffff;
      } else if (actor.alive && actor.status.burningUntil > time) {
        strokeWidth = 3;
        strokeColor = 0xff7733;
      } else if (actor.alive && actor.status.poisonedUntil > time) {
        strokeWidth = 3;
        strokeColor = 0x66dd44;
      } else if (actor.alive && actor.status.chilledUntil > time) {
        strokeWidth = 3;
        strokeColor = 0x66bbff;
      }
      view.body.setStrokeStyle(strokeWidth, strokeColor, 1);

      view.body.setAlpha(visible ? (actor.alive ? 1 : view.body.alpha) : 0);
      view.shadow.setAlpha(visible && actor.alive ? 1 : 0);
      view.hpBar.setAlpha(visible ? 1 : 0);
      view.hpBarBg.setAlpha(visible ? 1 : 0);
      view.nameLabel.setAlpha(visible ? 1 : 0);
    }

    for (const [id, projectile] of this.ctx.projectiles.entries()) {
      let view = this.ctx.projectileViews.get(id);
      if (!view) {
        const projColor = projectile.damageType === "fire" ? 0xde6f42 : projectile.damageType === "poison" ? 0x66dd44 : 0xd7d3cc;
        view = {
          shape: this.ctx.scene.add.circle(projectile.x, projectile.y, projectile.radius, projColor, 1).setDepth(5),
        };
        this.ctx.projectileViews.set(id, view);
      }
      view.shape.setPosition(projectile.x, projectile.y);
      const fillColor = projectile.damageType === "fire" ? 0xde6f42 : projectile.damageType === "poison" ? 0x66dd44 : 0xd7d3cc;
      view.shape.setFillStyle(fillColor);
    }

    for (const [id, hazard] of this.ctx.hazards.entries()) {
      let view = this.ctx.hazardViews.get(id);
      const hazColor = hazard.damageType === "poison" ? 0x449933 : 0xd15b33;
      const hazStroke = hazard.damageType === "poison" ? 0x66dd44 : 0xef9a58;
      if (!view) {
        view = {
          shape: this.ctx.scene.add.circle(hazard.x, hazard.y, hazard.radius, hazColor, 0.24).setDepth(2),
        };
        view.shape.setStrokeStyle(2, hazStroke, 0.48);
        this.ctx.hazardViews.set(id, view);
      }
      view.shape.setPosition(hazard.x, hazard.y);
      view.shape.setAlpha(Phaser.Math.Clamp(0.15 + (hazard.expiresAt - time) / 5000, 0.12, 0.4));
    }

    for (const [id, pickup] of this.ctx.pickups.entries()) {
      const view = this.ctx.pickupViews.get(id);
      if (!view) {
        continue;
      }
      view.sprite.setPosition(pickup.x, pickup.y);
      view.label.setPosition(pickup.x, pickup.y - 22);
    }

    const boss = [...this.ctx.actors.values()].find((actor) => actor.isBoss && actor.alive && actor.zoneId === this.ctx.activeZoneId);
    if (boss && !this.ctx.bossHealthBarBg) {
      this.ctx.bossHealthBarBg = this.ctx.scene.add.rectangle(640, 36, 420, 14, 0x000000, 0.65).setScrollFactor(0).setDepth(92);
      this.ctx.bossHealthBar = this.ctx.scene.add.rectangle(430, 36, 420, 14, 0xd56b52, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(93);
    }
    if (!boss && this.ctx.bossHealthBarBg && this.ctx.bossHealthBar) {
      this.ctx.bossHealthBarBg.destroy();
      this.ctx.bossHealthBar.destroy();
      this.ctx.bossHealthBarBg = undefined;
      this.ctx.bossHealthBar = undefined;
    }
    if (boss && this.ctx.bossHealthBar) {
      this.ctx.bossHealthBar.displayWidth = 420 * Phaser.Math.Clamp(boss.health / boss.stats.maxHealth, 0, 1);
    }

    this.updateMinimap();
  }

  updateHud(): void {
    const zone = zoneDefinitions[this.ctx.activeZoneId];
    this.ctx.zoneText.setText(zone.name);
    this.ctx.hudText.setText([
      `HP ${Math.round(this.ctx.player.health)}/${this.ctx.player.stats.maxHealth}   EN ${Math.round(this.ctx.player.energy)}/${this.ctx.player.stats.maxEnergy}   Potions ${this.ctx.inventory.potions}`,
      `Lvl ${this.ctx.level}   XP ${this.ctx.xp}/${this.ctx.nextLevelXp}   Gold ${this.ctx.inventory.gold}`,
      `1 ${skillDefinitions.cleaveShot.name} ${this.getCooldownLabel("cleaveShot")}   2 ${skillDefinitions.fireBomb.name} ${this.getCooldownLabel("fireBomb")}`,
      `3 ${skillDefinitions.frostNova.name} ${this.getCooldownLabel("frostNova")}   4 ${skillDefinitions.venomShot.name} ${this.getCooldownLabel("venomShot")}`,
    ]);
    this.ctx.debugText.setVisible(this.ctx.showDebug);
    this.ctx.debugText.setText([
      `Actors: ${[...this.ctx.actors.values()].filter((actor) => actor.zoneId === this.ctx.activeZoneId && actor.alive).length}`,
      `Projectiles: ${this.ctx.projectiles.size}`,
      `Hazards: ${this.ctx.hazards.size}`,
      `Zone: ${this.ctx.activeZoneId}`,
    ]);
  }

  getCooldownLabel(skillId: string): string {
    const remaining = Math.max(0, (this.ctx.skillCooldowns[skillId] ?? 0) - this.ctx.scene.time.now);
    return remaining <= 0 ? "ready" : `${(remaining / 1000).toFixed(1)}s`;
  }

  spawnFloatingText(x: number, y: number, value: string, color: string, fontSize = 14): void {
    const id = Phaser.Math.RND.uuid();
    const text = this.ctx.scene.add
      .text(x, y, value, {
        fontFamily: "Trebuchet MS",
        fontSize: `${fontSize}px`,
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(30);
    text.setData("expiresAt", this.ctx.scene.time.now + 900);
    this.ctx.floatingTexts.set(id, text);
  }

  showClickPulse(x: number, y: number, color: number): void {
    if (this.ctx.clickPulse) {
      this.ctx.clickPulse.ring.destroy();
      this.ctx.clickPulse = undefined;
    }

    const ring = this.ctx.scene.add.circle(x, y, 18, color, 0).setDepth(9);
    ring.setStrokeStyle(3, color, 0.9);
    this.ctx.clickPulse = {
      ring,
      expiresAt: this.ctx.scene.time.now + 220,
    };
    this.ctx.scene.tweens.add({
      targets: ring,
      scale: 2,
      alpha: 0,
      duration: 220,
      ease: "Cubic.Out",
    });
  }

  refreshTargetRing(time: number): void {
    const target = this.ctx.player.targetId ? this.ctx.actors.get(this.ctx.player.targetId) : undefined;
    const isVisible = Boolean(target && target.alive && target.zoneId === this.ctx.activeZoneId);
    if (!isVisible) {
      this.ctx.targetRing?.setVisible(false);
      return;
    }

    if (!this.ctx.targetRing) {
      this.ctx.targetRing = this.ctx.scene.add.circle(0, 0, 24, 0xf2d08c, 0).setDepth(8);
      this.ctx.targetRing.setStrokeStyle(2, 0xf2d08c, 1);
    }

    const pulse = (Math.sin(time / 110) + 1) * 0.5;
    const radius = target!.radius + 10;
    this.ctx.targetRing
      .setVisible(true)
      .setPosition(target!.x, target!.y)
      .setScale(radius / 24 + pulse * 0.08)
      .setAlpha(0.55 + pulse * 0.25);
  }

  spawnBasicAttackEffect(target: ActorState, time: number): void {
    const id = Phaser.Math.RND.uuid();
    const angle = Phaser.Math.Angle.Between(this.ctx.player.x, this.ctx.player.y, target.x, target.y);
    const distance = Phaser.Math.Distance.Between(this.ctx.player.x, this.ctx.player.y, target.x, target.y);
    const slash = this.ctx.scene.add
      .rectangle(
        (this.ctx.player.x + target.x) * 0.5,
        (this.ctx.player.y + target.y) * 0.5,
        Math.max(26, distance - Math.max(8, target.radius * 0.35)),
        7,
        0xf7ddb0,
        0.95,
      )
      .setDepth(10)
      .setRotation(angle);
    slash.setStrokeStyle(1, 0xffffff, 0.6);

    const impact = this.ctx.scene.add.circle(target.x, target.y, target.radius + 6, 0xf7ddb0, 0.12).setDepth(9);
    impact.setStrokeStyle(3, 0xf2d08c, 0.95);

    this.ctx.attackEffects.set(id, {
      slash,
      impact,
      expiresAt: time + 140,
    });

    this.ctx.scene.tweens.add({
      targets: [slash, impact],
      alpha: 0,
      duration: 140,
      ease: "Cubic.Out",
    });
    this.ctx.scene.tweens.add({
      targets: impact,
      scale: 1.35,
      duration: 140,
      ease: "Cubic.Out",
    });
  }

  updateFloatingTexts(time: number, delta: number): void {
    for (const [id, text] of [...this.ctx.floatingTexts.entries()]) {
      text.y -= 22 * (delta / 1000);
      if ((text.getData("expiresAt") as number) <= time) {
        text.destroy();
        this.ctx.floatingTexts.delete(id);
      }
    }
  }

  updateCombatEffects(time: number): void {
    if (this.ctx.clickPulse && this.ctx.clickPulse.expiresAt <= time) {
      this.ctx.clickPulse.ring.destroy();
      this.ctx.clickPulse = undefined;
    }

    for (const [id, effect] of [...this.ctx.attackEffects.entries()]) {
      if (effect.expiresAt > time) {
        continue;
      }
      effect.slash.destroy();
      effect.impact.destroy();
      this.ctx.attackEffects.delete(id);
    }
  }

  shakeCamera(intensity: number, duration: number): void {
    this.ctx.scene.cameras.main.shake(duration, intensity / 1000);
  }

  // ── Minimap ────────────────────────────────────────────────────────────────

  private updateMinimap(): void {
    const zone = zoneDefinitions[this.ctx.activeZoneId];
    const mapW = 160;
    const mapH = 110;
    const offsetX = this.ctx.scene.cameras.main.width - mapW - 16;
    const offsetY = 16;
    const scaleX = mapW / zone.width;
    const scaleY = mapH / zone.height;

    if (!this.ctx.minimapBg) {
      this.ctx.minimapBg = this.ctx.scene.add.rectangle(offsetX + mapW / 2, offsetY + mapH / 2, mapW, mapH, 0x000000, 0.45)
        .setScrollFactor(0).setDepth(95);
      this.ctx.minimapBg.setStrokeStyle(1, 0xf4d39c, 0.4);
    }

    // Clean old minimap dots
    for (const dot of this.ctx.minimapDots) {
      dot.destroy();
    }
    this.ctx.minimapDots = [];

    // Player dot (green)
    const px = offsetX + this.ctx.player.x * scaleX;
    const py = offsetY + this.ctx.player.y * scaleY;
    this.ctx.minimapDots.push(
      this.ctx.scene.add.circle(px, py, 3, 0x88c06f, 1).setScrollFactor(0).setDepth(97),
    );

    // Enemy dots (red)
    for (const actor of this.ctx.actors.values()) {
      if (actor.faction !== "enemy" || !actor.alive || actor.zoneId !== this.ctx.activeZoneId) {
        continue;
      }
      const ex = offsetX + actor.x * scaleX;
      const ey = offsetY + actor.y * scaleY;
      this.ctx.minimapDots.push(
        this.ctx.scene.add.circle(ex, ey, 2, actor.isBoss ? 0xf5d56b : 0xd56b52, 1).setScrollFactor(0).setDepth(96),
      );
    }

    // Pickup dots (gold)
    for (const pickup of this.ctx.pickups.values()) {
      const ppx = offsetX + pickup.x * scaleX;
      const ppy = offsetY + pickup.y * scaleY;
      this.ctx.minimapDots.push(
        this.ctx.scene.add.circle(ppx, ppy, 1.5, 0xf3cd66, 0.8).setScrollFactor(0).setDepth(96),
      );
    }

    // Transition markers
    for (const t of zone.transitions) {
      const tx = offsetX + (t.x + t.width / 2) * scaleX;
      const ty = offsetY + (t.y + t.height / 2) * scaleY;
      this.ctx.minimapDots.push(
        this.ctx.scene.add.rectangle(tx, ty, 6, 4, 0xf2b35f, 0.8).setScrollFactor(0).setDepth(96),
      );
    }
  }
}
