import Phaser from "phaser";
import { affixes } from "../content/affixes";
import { enemyDefinitions } from "../content/enemies";
import { itemDefinitions } from "../content/items";
import { skillDefinitions } from "../content/skills";
import { zoneDefinitions } from "../content/zones";
import { loadSave, writeSave } from "../gameplay/save";
import { addStats, createStatBlock, scaleStatsForLevel } from "../gameplay/stats";
import type {
  ActorState,
  DamageType,
  EncounterDefinition,
  EnemyDefinition,
  HazardState,
  ItemDefinition,
  ItemInstance,
  PartialStats,
  ProjectileState,
  RuntimeInventory,
  RuntimeStateSnapshot,
  ZoneId,
  ZoneDefinition,
} from "../gameplay/types";

const PLAYER_BASE_STATS = createStatBlock({
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
});

const LEVEL_THRESHOLDS = [0, 70, 180, 360, 580];
const PICKUP_RANGE = 56;
const SAVE_DEBOUNCE_MS = 4000;

type PickupKind = "gold" | "potion" | "item" | "chest";

interface PickupState {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  value?: number;
  item?: ItemInstance;
  encounterId?: string;
  label: string;
}

interface RenderActor {
  body: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Ellipse;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameLabel: Phaser.GameObjects.Text;
}

interface RenderPickup {
  sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface RenderHazard {
  shape: Phaser.GameObjects.Arc;
}

interface RenderProjectile {
  shape: Phaser.GameObjects.Arc;
}

export class GameScene extends Phaser.Scene {
  private player!: ActorState;
  private actors = new Map<string, ActorState>();
  private actorViews = new Map<string, RenderActor>();
  private projectiles = new Map<string, ProjectileState>();
  private projectileViews = new Map<string, RenderProjectile>();
  private hazards = new Map<string, HazardState>();
  private hazardViews = new Map<string, RenderHazard>();
  private floatingTexts = new Map<string, Phaser.GameObjects.Text>();
  private pickups = new Map<string, PickupState>();
  private pickupViews = new Map<string, RenderPickup>();
  private clearedEncounterIds = new Set<string>();
  private inventory: RuntimeInventory = {
    gold: 0,
    potions: 3,
    items: [],
    equipped: {},
  };
  private level = 1;
  private xp = 0;
  private nextLevelXp = LEVEL_THRESHOLDS[1];
  private activeZoneId: ZoneId = "crossroads";
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private skill1Key!: Phaser.Input.Keyboard.Key;
  private skill2Key!: Phaser.Input.Keyboard.Key;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private potionKey!: Phaser.Input.Keyboard.Key;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private lootKey!: Phaser.Input.Keyboard.Key;
  private hudText!: Phaser.GameObjects.Text;
  private zoneText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private overlayRect!: Phaser.GameObjects.Rectangle;
  private bossHealthBarBg?: Phaser.GameObjects.Rectangle;
  private bossHealthBar?: Phaser.GameObjects.Rectangle;
  private lastPointerWorld = new Phaser.Math.Vector2();
  private skillCooldowns: Record<string, number> = {};
  private isInventoryVisible = true;
  private combatLog: string[] = [];
  private lastSaveAt = 0;
  private showDebug = false;
  private phaseTwoSummoned = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#171311");
    this.wasd = {
      W: this.input.keyboard!.addKey("W"),
      A: this.input.keyboard!.addKey("A"),
      S: this.input.keyboard!.addKey("S"),
      D: this.input.keyboard!.addKey("D"),
    };
    this.skill1Key = this.input.keyboard!.addKey("ONE");
    this.skill2Key = this.input.keyboard!.addKey("TWO");
    this.inventoryKey = this.input.keyboard!.addKey("I");
    this.potionKey = this.input.keyboard!.addKey("SPACE");
    this.debugKey = this.input.keyboard!.addKey("F1");
    this.lootKey = this.input.keyboard!.addKey("F5");

    this.overlayRect = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0);
    this.overlayRect.setOrigin(0, 0).setScrollFactor(0).setDepth(80);
    this.zoneText = this.add
      .text(24, 20, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "20px",
        color: "#f4d39c",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(90);

    this.hudText = this.add
      .text(24, 52, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "15px",
        color: "#f0e6d2",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(90);

    this.debugText = this.add
      .text(24, 134, "", {
        fontFamily: "Consolas",
        fontSize: "13px",
        color: "#f8d08b",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(90);

    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.lastPointerWorld.set(pointer.worldX, pointer.worldY);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.lastPointerWorld.set(pointer.worldX, pointer.worldY);
      if (pointer.rightButtonDown()) {
        this.tryCastFireBomb(pointer.worldX, pointer.worldY);
        return;
      }

      const clickedEnemy = this.getNearestEnemy(pointer.worldX, pointer.worldY, 28);
      if (clickedEnemy) {
        this.player.targetId = clickedEnemy.id;
        this.player.moveTarget = undefined;
      } else {
        this.player.moveTarget = {
          x: Phaser.Math.Clamp(pointer.worldX, 20, this.currentZone.width - 20),
          y: Phaser.Math.Clamp(pointer.worldY, 20, this.currentZone.height - 20),
        };
        this.player.targetId = undefined;
      }
    });

    this.restoreOrStart();
    this.createZoneVisuals();
    this.syncActorViews();
    this.game.events.emit("ready");
  }

  getSnapshot(): RuntimeStateSnapshot | null {
    if (!this.player) {
      return null;
    }

    return {
      zoneId: this.activeZoneId,
      player: this.player,
      inventory: this.inventory,
      clearedEncounterIds: [...this.clearedEncounterIds],
      level: this.level,
      xp: this.xp,
      nextLevelXp: this.nextLevelXp,
    };
  }

  getCombatLog(): string[] {
    return this.combatLog;
  }

  equipItem(itemId: string): void {
    const itemIndex = this.inventory.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return;
    }
    const item = this.inventory.items[itemIndex];
    const previous = this.inventory.equipped[item.slot];
    if (previous) {
      this.inventory.items.push(previous);
    }
    this.inventory.equipped[item.slot] = item;
    this.inventory.items.splice(itemIndex, 1);
    this.recalculatePlayerStats();
    this.log(`Equipped ${item.name}.`);
    this.autosave();
  }

  update(time: number, delta: number): void {
    if (!this.player.alive) {
      return;
    }

    this.handleKeys();
    this.updatePlayer(time, delta);
    this.updateEnemies(time, delta);
    this.updateProjectiles(time, delta);
    this.updateHazards(time);
    this.updateBurning(time);
    this.updateFloatingTexts(time, delta);
    this.updatePickups();
    this.checkTransitions();
    this.refreshRenderState(time);
    this.updateHud();

    if (time - this.lastSaveAt >= SAVE_DEBOUNCE_MS) {
      this.autosave();
    }
  }

  private get currentZone(): ZoneDefinition {
    return zoneDefinitions[this.activeZoneId];
  }

  private restoreOrStart(): void {
    const save = loadSave();
    this.inventory = save?.inventory ?? {
      gold: 18,
      potions: 3,
      items: [this.createItemInstance(itemDefinitions[0]), this.createItemInstance(itemDefinitions[1])],
      equipped: {},
    };

    this.level = save?.player.level ?? 1;
    this.xp = save?.player.xp ?? 0;
    this.nextLevelXp = save?.player.nextLevelXp ?? LEVEL_THRESHOLDS[this.level] ?? LEVEL_THRESHOLDS.at(-1)!;
    this.activeZoneId = save?.zoneId ?? "crossroads";
    this.clearedEncounterIds = new Set(save?.clearedEncounterIds ?? []);

    const playerStats = this.buildPlayerStats();
    this.player = {
      id: "player",
      name: "Soldier-Alchemist",
      faction: "player",
      x: save?.player.x ?? zoneDefinitions[this.activeZoneId].playerSpawn.x,
      y: save?.player.y ?? zoneDefinitions[this.activeZoneId].playerSpawn.y,
      radius: 18,
      color: 0xd9d4ca,
      level: this.level,
      stats: playerStats,
      health: Math.min(save?.player.health ?? playerStats.maxHealth, playerStats.maxHealth),
      energy: Math.min(save?.player.energy ?? playerStats.maxEnergy, playerStats.maxEnergy),
      alive: true,
      zoneId: this.activeZoneId,
      lastActionAt: 0,
      attackCooldownUntil: 0,
      status: {
        burningUntil: 0,
        burnDamageMin: 0,
        burnDamageMax: 0,
        nextBurnTickAt: 0,
      },
    };
    this.actors.set(this.player.id, this.player);
    this.spawnZone(this.activeZoneId);
  }

  private createZoneVisuals(): void {
    this.children.list
      .filter((child) => child.name === "zone-art")
      .forEach((child) => child.destroy());

    const zone = this.currentZone;
    this.cameras.main.setBounds(0, 0, zone.width, zone.height);

    const bg = this.add.rectangle(
      zone.width / 2,
      zone.height / 2,
      zone.width,
      zone.height,
      zone.id === "crossroads" ? 0x2d231f : 0x261d1a,
      1,
    );
    bg.name = "zone-art";
    bg.setDepth(-5);

    for (let i = 0; i < 18; i += 1) {
      const x = 120 + i * 90;
      const y = 180 + (i % 4) * 180;
      const patch = this.add.ellipse(x, y, 180, 90, zone.id === "crossroads" ? 0x403226 : 0x3b291f, 0.38);
      patch.setRotation((i % 3) * 0.2);
      patch.setDepth(-4);
      patch.name = "zone-art";
    }

    const road = this.add.rectangle(
      zone.width / 2,
      zone.height / 2,
      zone.id === "crossroads" ? zone.width - 120 : zone.width - 160,
      zone.id === "crossroads" ? 220 : 300,
      zone.id === "crossroads" ? 0x5c4a3c : 0x4b3830,
      0.45,
    );
    road.setDepth(-3);
    road.name = "zone-art";

    if (zone.transition) {
      const t = zone.transition;
      const gate = this.add.rectangle(t.x + t.width / 2, t.y + t.height / 2, t.width, t.height, 0xf2b35f, 0.09);
      gate.setStrokeStyle(2, 0xf2b35f, 0.36);
      gate.setDepth(1);
      gate.name = "zone-art";
      const label = this.add.text(t.x + 6, t.y - 20, t.label, {
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

  private spawnZone(zoneId: ZoneId): void {
    this.activeZoneId = zoneId;
    this.player.zoneId = zoneId;
    for (const encounter of zoneDefinitions[zoneId].encounters) {
      if (this.clearedEncounterIds.has(encounter.id)) {
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

  private spawnEnemy(enemyId: string, x: number, y: number, encounter: EncounterDefinition): void {
    const definition = enemyDefinitions[enemyId];
    const level = encounter.zoneId === "arena" ? Math.max(2, this.level + (enemyId === "warden" ? 1 : 0)) : Math.max(1, this.level);
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
    this.actors.set(actor.id, actor);
  }

  private spawnChest(encounterId: string, x: number, y: number): void {
    const id = `chest-${encounterId}`;
    if (this.pickups.has(id)) {
      return;
    }
    this.pickups.set(id, {
      id,
      kind: "chest",
      x,
      y,
      encounterId,
      label: "Supply Cache",
    });
  }

  private syncActorViews(): void {
    for (const actor of this.actors.values()) {
      if (this.actorViews.has(actor.id)) {
        continue;
      }
      const shadow = this.add.ellipse(actor.x, actor.y + actor.radius + 6, actor.radius * 2, actor.radius, 0x000000, 0.25).setDepth(1);
      const body = this.add.circle(actor.x, actor.y, actor.radius, actor.color).setDepth(4);
      const hpBarBg = this.add.rectangle(actor.x, actor.y - actor.radius - 12, actor.radius * 2.2, 6, 0x000000, 0.55).setDepth(6);
      const hpBar = this.add
        .rectangle(actor.x - actor.radius * 1.1, actor.y - actor.radius - 12, actor.radius * 2.2, 6, actor.faction === "player" ? 0x88c06f : 0xd56b52, 1)
        .setOrigin(0, 0.5)
        .setDepth(7);
      const nameLabel = this.add
        .text(actor.x, actor.y - actor.radius - 30, actor.name, {
          fontFamily: "Trebuchet MS",
          fontSize: actor.faction === "player" ? "14px" : "12px",
          color: actor.faction === "player" ? "#f2dcc0" : "#f0c3b0",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(8);
      this.actorViews.set(actor.id, { body, shadow, hpBarBg, hpBar, nameLabel });
    }

    for (const pickup of this.pickups.values()) {
      if (this.pickupViews.has(pickup.id)) {
        continue;
      }
      const sprite =
        pickup.kind === "item"
          ? this.add.rectangle(pickup.x, pickup.y, 16, 18, 0x7eb7ff, 1).setDepth(3)
          : pickup.kind === "gold"
            ? this.add.circle(pickup.x, pickup.y, 8, 0xf3cd66, 1).setDepth(3)
            : pickup.kind === "potion"
              ? this.add.circle(pickup.x, pickup.y, 9, 0xcd4f49, 1).setDepth(3)
              : this.add.rectangle(pickup.x, pickup.y, 28, 20, 0xa67943, 1).setDepth(3);
      const label = this.add
        .text(pickup.x, pickup.y - 22, pickup.label, {
          fontFamily: "Trebuchet MS",
          fontSize: "12px",
          color: "#f4d39c",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(4);
      this.pickupViews.set(pickup.id, { sprite, label });
    }
  }

  private handleKeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.skill1Key)) {
      this.tryCastCleaveShot();
    }
    if (Phaser.Input.Keyboard.JustDown(this.skill2Key)) {
      this.tryCastFireBomb(this.lastPointerWorld.x || this.player.x + 10, this.lastPointerWorld.y || this.player.y);
    }
    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      this.isInventoryVisible = !this.isInventoryVisible;
      const sidebar = document.querySelector<HTMLElement>(".sidebar");
      if (sidebar) {
        sidebar.style.opacity = this.isInventoryVisible ? "1" : "0.22";
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.potionKey)) {
      this.consumePotion();
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.showDebug = !this.showDebug;
    }
    if (Phaser.Input.Keyboard.JustDown(this.lootKey)) {
      this.grantTestLoot();
    }
  }

  private updatePlayer(time: number, delta: number): void {
    this.player.health = Phaser.Math.Clamp(this.player.health + this.player.stats.healthRegen * (delta / 1000), 0, this.player.stats.maxHealth);
    this.player.energy = Phaser.Math.Clamp(this.player.energy + this.player.stats.energyRegen * (delta / 1000), 0, this.player.stats.maxEnergy);

    const moveVector = new Phaser.Math.Vector2(
      (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0),
      (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0),
    );

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().scale(this.player.stats.moveSpeed * (delta / 1000));
      this.player.moveTarget = undefined;
      this.player.targetId = undefined;
      this.player.x = Phaser.Math.Clamp(this.player.x + moveVector.x, 16, this.currentZone.width - 16);
      this.player.y = Phaser.Math.Clamp(this.player.y + moveVector.y, 16, this.currentZone.height - 16);
      return;
    }

    if (this.player.targetId) {
      const target = this.actors.get(this.player.targetId);
      if (!target || !target.alive || target.zoneId !== this.activeZoneId) {
        this.player.targetId = undefined;
      } else {
        const range = skillDefinitions.basicAttack.range;
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
        if (distance > range * 0.86) {
          this.moveActorTowards(this.player, target.x, target.y, this.player.stats.moveSpeed, delta);
        } else if (time >= this.player.attackCooldownUntil) {
          this.performBasicAttack(target, time);
        }
      }
    } else if (this.player.moveTarget) {
      const arrived = this.moveActorTowards(this.player, this.player.moveTarget.x, this.player.moveTarget.y, this.player.stats.moveSpeed, delta);
      if (arrived) {
        this.player.moveTarget = undefined;
      }
    }
  }

  private updateEnemies(time: number, delta: number): void {
    for (const actor of this.actors.values()) {
      if (actor.faction !== "enemy" || !actor.alive || actor.zoneId !== this.activeZoneId) {
        continue;
      }
      const definition = enemyDefinitions[actor.definitionId!];
      const distance = Phaser.Math.Distance.Between(actor.x, actor.y, this.player.x, this.player.y);
      const aggroRange = definition.archetype === "boss" ? 380 : 260;

      if (distance <= aggroRange) {
        actor.aiState = "chase";
      } else if (distance > aggroRange + 80) {
        actor.aiState = "idle";
      }

      if (definition.archetype === "boss" && actor.phase === 1 && actor.health <= actor.stats.maxHealth * 0.5 && !this.phaseTwoSummoned) {
        actor.phase = 2;
        this.phaseTwoSummoned = true;
        this.log("Warden Alchemist enters phase two and summons reinforcements.");
        this.spawnEnemy("scavenger", actor.x - 80, actor.y + 110, { id: "boss-adds", zoneId: "arena", spawns: [] });
        this.spawnEnemy("cultist", actor.x + 90, actor.y - 90, { id: "boss-adds", zoneId: "arena", spawns: [] });
      }

      if (distance <= definition.attackRange && time >= actor.attackCooldownUntil) {
        actor.attackCooldownUntil = time + definition.attackCooldownMs;
        if (definition.archetype === "ranged" || definition.archetype === "boss") {
          this.fireEnemyProjectile(actor, definition);
          if (definition.archetype === "boss" && actor.phase === 2) {
            this.createHazard(this.player.x, this.player.y, 74, time + 3800, 650, 6, 11);
          }
        } else {
          this.applyDamage(actor, this.player, definition.contactDamageMin, definition.contactDamageMax, "physical");
          if (definition.archetype === "bruiser") {
            this.pushActor(this.player, actor.x, actor.y, 24);
          }
        }
      } else if (actor.aiState === "chase") {
        if (definition.archetype === "ranged" && distance < 140) {
          this.moveActorAway(actor, this.player.x, this.player.y, actor.stats.moveSpeed * 0.9, delta);
        } else {
          this.moveActorTowards(actor, this.player.x, this.player.y, actor.stats.moveSpeed, delta);
        }
      }

      actor.health = Phaser.Math.Clamp(actor.health + actor.stats.healthRegen * (delta / 1000), 0, actor.stats.maxHealth);
    }
  }

  private updateProjectiles(time: number, delta: number): void {
    for (const [id, projectile] of [...this.projectiles.entries()]) {
      projectile.x += projectile.vx * (delta / 1000);
      projectile.y += projectile.vy * (delta / 1000);

      const hitTarget =
        projectile.faction === "player"
          ? [...this.actors.values()].find(
              (actor) =>
                actor.faction === "enemy" &&
                actor.alive &&
                actor.zoneId === this.activeZoneId &&
                Phaser.Math.Distance.Between(actor.x, actor.y, projectile.x, projectile.y) <= actor.radius + projectile.radius,
            )
          : Phaser.Math.Distance.Between(this.player.x, this.player.y, projectile.x, projectile.y) <= this.player.radius + projectile.radius
            ? this.player
            : undefined;

      if (hitTarget) {
        if (projectile.faction === "player") {
          this.applyDamage(this.player, hitTarget, projectile.damageMin, projectile.damageMax, projectile.damageType);
        } else {
          this.applyDamage(
            [...this.actors.values()].find((actor) => actor.id === projectile.sourceId) ?? this.player,
            hitTarget,
            projectile.damageMin,
            projectile.damageMax,
            projectile.damageType,
          );
          if (projectile.damageType === "fire") {
            this.applyBurn(hitTarget, time, 4, 7);
          }
        }
        this.destroyProjectile(id);
        continue;
      }

      if (
        projectile.expiresAt <= time ||
        projectile.x < 0 ||
        projectile.x > this.currentZone.width ||
        projectile.y < 0 ||
        projectile.y > this.currentZone.height
      ) {
        this.destroyProjectile(id);
      }
    }
  }

  private updateHazards(time: number): void {
    for (const [id, hazard] of [...this.hazards.entries()]) {
      if (time >= hazard.expiresAt) {
        this.destroyHazard(id);
        continue;
      }
      if (time >= hazard.nextTickAt) {
        hazard.nextTickAt = time + hazard.tickEveryMs;
        const enemies = [...this.actors.values()].filter(
          (actor) =>
            actor.faction === "enemy" &&
            actor.alive &&
            actor.zoneId === this.activeZoneId &&
            Phaser.Math.Distance.Between(actor.x, actor.y, hazard.x, hazard.y) <= hazard.radius + actor.radius,
        );
        for (const enemy of enemies) {
          this.applyDamage(this.player, enemy, hazard.damageMin, hazard.damageMax, "fire");
          this.applyBurn(enemy, time, Math.max(1, hazard.damageMin - 1), Math.max(2, hazard.damageMax - 1));
        }
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, hazard.x, hazard.y) <= hazard.radius + this.player.radius) {
          const boss = [...this.actors.values()].find((actor) => actor.isBoss && actor.alive) ?? this.player;
          this.applyDamage(boss, this.player, hazard.damageMin, hazard.damageMax, "fire");
          this.applyBurn(this.player, time, Math.max(1, hazard.damageMin - 2), Math.max(2, hazard.damageMax - 2));
        }
      }
    }
  }

  private updateBurning(time: number): void {
    for (const actor of this.actors.values()) {
      if (!actor.alive || actor.status.burningUntil <= time || actor.status.nextBurnTickAt > time) {
        continue;
      }
      actor.status.nextBurnTickAt = time + 1000;
      const source = actor.faction === "player" ? actor : this.player;
      this.applyDamage(source, actor, actor.status.burnDamageMin, actor.status.burnDamageMax, "fire", true);
    }
  }

  private updateFloatingTexts(time: number, delta: number): void {
    for (const [id, text] of [...this.floatingTexts.entries()]) {
      text.y -= 22 * (delta / 1000);
      if ((text.getData("expiresAt") as number) <= time) {
        text.destroy();
        this.floatingTexts.delete(id);
      }
    }
  }

  private updatePickups(): void {
    for (const [id, pickup] of [...this.pickups.entries()]) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y) > PICKUP_RANGE) {
        continue;
      }
      if (pickup.kind === "gold") {
        this.inventory.gold += pickup.value ?? 0;
        this.log(`Picked up ${pickup.value} gold.`);
      } else if (pickup.kind === "potion") {
        this.inventory.potions += pickup.value ?? 1;
        this.log("Picked up a health tonic.");
      } else if (pickup.kind === "item" && pickup.item) {
        this.inventory.items.push(pickup.item);
        this.log(`Picked up ${pickup.item.name}.`);
      } else if (pickup.kind === "chest") {
        this.openChest(pickup);
      }
      this.destroyPickup(id);
    }
  }

  private checkTransitions(): void {
    const transition = this.currentZone.transition;
    if (!transition) {
      return;
    }
    const inside =
      this.player.x >= transition.x &&
      this.player.x <= transition.x + transition.width &&
      this.player.y >= transition.y &&
      this.player.y <= transition.y + transition.height;
    if (!inside) {
      return;
    }
    this.transitionToZone(transition.toZoneId, transition.targetX, transition.targetY);
  }

  private refreshRenderState(time: number): void {
    this.syncActorViews();
    this.cameras.main.centerOn(this.player.x, this.player.y);

    for (const [id, actor] of this.actors.entries()) {
      const view = this.actorViews.get(id);
      if (!view) {
        continue;
      }
      const visible = actor.zoneId === this.activeZoneId;
      if (!actor.alive) {
        view.body.setFillStyle(0x2b1f1a, 0.35);
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
      view.body.setStrokeStyle(actor.bodyHitUntil && actor.bodyHitUntil > time ? 4 : 0, 0xffffff, 1);
      view.body.setAlpha(visible ? 1 : 0);
      view.shadow.setAlpha(visible ? 1 : 0);
      view.hpBar.setAlpha(visible ? 1 : 0);
      view.hpBarBg.setAlpha(visible ? 1 : 0);
      view.nameLabel.setAlpha(visible ? 1 : 0);
    }

    for (const [id, projectile] of this.projectiles.entries()) {
      let view = this.projectileViews.get(id);
      if (!view) {
        view = {
          shape: this.add.circle(projectile.x, projectile.y, projectile.radius, projectile.faction === "player" ? 0xe8d8b1 : 0xdb694c, 1).setDepth(5),
        };
        this.projectileViews.set(id, view);
      }
      view.shape.setPosition(projectile.x, projectile.y);
      view.shape.setFillStyle(projectile.damageType === "fire" ? 0xde6f42 : 0xd7d3cc);
    }

    for (const [id, hazard] of this.hazards.entries()) {
      let view = this.hazardViews.get(id);
      if (!view) {
        view = {
          shape: this.add.circle(hazard.x, hazard.y, hazard.radius, 0xd15b33, 0.24).setDepth(2),
        };
        view.shape.setStrokeStyle(2, 0xef9a58, 0.48);
        this.hazardViews.set(id, view);
      }
      view.shape.setPosition(hazard.x, hazard.y);
      view.shape.setAlpha(Phaser.Math.Clamp(0.15 + (hazard.expiresAt - time) / 5000, 0.12, 0.4));
    }

    for (const [id, pickup] of this.pickups.entries()) {
      const view = this.pickupViews.get(id);
      if (!view) {
        continue;
      }
      view.sprite.setPosition(pickup.x, pickup.y);
      view.label.setPosition(pickup.x, pickup.y - 22);
    }

    const boss = [...this.actors.values()].find((actor) => actor.isBoss && actor.alive && actor.zoneId === this.activeZoneId);
    if (boss && !this.bossHealthBarBg) {
      this.bossHealthBarBg = this.add.rectangle(640, 36, 420, 14, 0x000000, 0.65).setScrollFactor(0).setDepth(92);
      this.bossHealthBar = this.add.rectangle(430, 36, 420, 14, 0xd56b52, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(93);
    }
    if (!boss && this.bossHealthBarBg && this.bossHealthBar) {
      this.bossHealthBarBg.destroy();
      this.bossHealthBar.destroy();
      this.bossHealthBarBg = undefined;
      this.bossHealthBar = undefined;
    }
    if (boss && this.bossHealthBar) {
      this.bossHealthBar.displayWidth = 420 * Phaser.Math.Clamp(boss.health / boss.stats.maxHealth, 0, 1);
    }
  }

  private updateHud(): void {
    this.zoneText.setText(this.currentZone.name);
    this.hudText.setText([
      `HP ${Math.round(this.player.health)}/${this.player.stats.maxHealth}   EN ${Math.round(this.player.energy)}/${this.player.stats.maxEnergy}   Potions ${this.inventory.potions}`,
      `Lvl ${this.level}   XP ${this.xp}/${this.nextLevelXp}   Gold ${this.inventory.gold}`,
      `1 ${skillDefinitions.cleaveShot.name} ${this.getCooldownLabel("cleaveShot")}   2 ${skillDefinitions.fireBomb.name} ${this.getCooldownLabel("fireBomb")}`,
    ]);
    this.debugText.setVisible(this.showDebug);
    this.debugText.setText([
      `Actors: ${[...this.actors.values()].filter((actor) => actor.zoneId === this.activeZoneId && actor.alive).length}`,
      `Projectiles: ${this.projectiles.size}`,
      `Hazards: ${this.hazards.size}`,
      `Zone: ${this.activeZoneId}`,
      `Inventory visible: ${this.isInventoryVisible}`,
    ]);
  }

  private getCooldownLabel(skillId: "cleaveShot" | "fireBomb"): string {
    const remaining = Math.max(0, (this.skillCooldowns[skillId] ?? 0) - this.time.now);
    return remaining <= 0 ? "ready" : `${(remaining / 1000).toFixed(1)}s`;
  }

  private moveActorTowards(actor: ActorState, x: number, y: number, speed: number, delta: number): boolean {
    const direction = new Phaser.Math.Vector2(x - actor.x, y - actor.y);
    const distance = direction.length();
    if (distance <= 4) {
      actor.x = x;
      actor.y = y;
      return true;
    }
    direction.normalize().scale(speed * (delta / 1000));
    actor.x = Phaser.Math.Clamp(actor.x + direction.x, 16, this.currentZone.width - 16);
    actor.y = Phaser.Math.Clamp(actor.y + direction.y, 16, this.currentZone.height - 16);
    return false;
  }

  private moveActorAway(actor: ActorState, x: number, y: number, speed: number, delta: number): void {
    const direction = new Phaser.Math.Vector2(actor.x - x, actor.y - y);
    if (direction.lengthSq() === 0) {
      direction.setTo(1, 0);
    }
    direction.normalize().scale(speed * (delta / 1000));
    actor.x = Phaser.Math.Clamp(actor.x + direction.x, 16, this.currentZone.width - 16);
    actor.y = Phaser.Math.Clamp(actor.y + direction.y, 16, this.currentZone.height - 16);
  }

  private performBasicAttack(target: ActorState, time: number): void {
    this.player.attackCooldownUntil = time + skillDefinitions.basicAttack.cooldownMs / Math.max(0.65, this.player.stats.attackSpeed);
    this.applyDamage(this.player, target, this.player.stats.physicalDamageMin, this.player.stats.physicalDamageMax, "physical");
    this.log(`Basic attack hits ${target.name}.`);
  }

  private tryCastCleaveShot(): void {
    if (!this.hasSkillResources("cleaveShot")) {
      return;
    }
    this.player.energy -= skillDefinitions.cleaveShot.energyCost;
    this.skillCooldowns.cleaveShot = this.time.now + skillDefinitions.cleaveShot.cooldownMs;
    const targetPoint =
      this.player.targetId && this.actors.get(this.player.targetId)
        ? this.actors.get(this.player.targetId)!
        : { x: this.lastPointerWorld.x || this.player.x + 1, y: this.lastPointerWorld.y || this.player.y };
    const facing = new Phaser.Math.Vector2(targetPoint.x - this.player.x, targetPoint.y - this.player.y);
    if (facing.lengthSq() === 0) {
      facing.setTo(1, 0);
    }
    facing.normalize();
    for (const actor of this.actors.values()) {
      if (actor.faction !== "enemy" || !actor.alive || actor.zoneId !== this.activeZoneId) {
        continue;
      }
      const toEnemy = new Phaser.Math.Vector2(actor.x - this.player.x, actor.y - this.player.y);
      const distance = toEnemy.length();
      if (distance > skillDefinitions.cleaveShot.range) {
        continue;
      }
      toEnemy.normalize();
      const angle = Phaser.Math.RadToDeg(Math.acos(Phaser.Math.Clamp(facing.dot(toEnemy), -1, 1)));
      if (angle <= 38) {
        this.applyDamage(this.player, actor, this.player.stats.physicalDamageMin + 6, this.player.stats.physicalDamageMax + 9, "physical");
      }
    }
    this.spawnFloatingText(this.player.x, this.player.y - 36, "Cleave Shot", "#f1d08e");
    this.log("Cleave Shot tears through the pack.");
  }

  private tryCastFireBomb(x: number, y: number): void {
    if (!this.hasSkillResources("fireBomb")) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    const range = skillDefinitions.fireBomb.range;
    let targetX = x;
    let targetY = y;
    if (distance > range) {
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, x, y);
      targetX = this.player.x + Math.cos(angle) * range;
      targetY = this.player.y + Math.sin(angle) * range;
    }

    this.player.energy -= skillDefinitions.fireBomb.energyCost;
    this.skillCooldowns.fireBomb = this.time.now + skillDefinitions.fireBomb.cooldownMs;
    const delay = 420;
    const marker = this.add.circle(targetX, targetY, 18, 0xde8a4d, 0.25).setDepth(2);
    marker.setStrokeStyle(2, 0xf3d492, 0.55);
    this.tweens.add({
      targets: marker,
      scale: 3.8,
      alpha: 0,
      duration: delay,
      onComplete: () => marker.destroy(),
    });
    this.time.delayedCall(delay, () => {
      this.createHazard(targetX, targetY, 68, this.time.now + 4500, 800, this.player.stats.fireDamageMin + 8, this.player.stats.fireDamageMax + 12);
      this.spawnFloatingText(targetX, targetY - 36, "Fire Bomb", "#f09a62");
    });
    this.log("Fire Bomb lands and ignites the ground.");
  }

  private hasSkillResources(skillId: "cleaveShot" | "fireBomb"): boolean {
    const skill = skillDefinitions[skillId];
    const cooldownUntil = this.skillCooldowns[skillId] ?? 0;
    if (cooldownUntil > this.time.now) {
      this.log(`${skill.name} is still on cooldown.`);
      return false;
    }
    if (this.player.energy < skill.energyCost) {
      this.log(`Not enough energy for ${skill.name}.`);
      return false;
    }
    return true;
  }

  private fireEnemyProjectile(actor: ActorState, definition: EnemyDefinition): void {
    const angle = Phaser.Math.Angle.Between(actor.x, actor.y, this.player.x, this.player.y);
    const speed = definition.archetype === "boss" ? 240 : 210;
    const damageType: DamageType = definition.archetype === "ranged" || definition.archetype === "boss" ? "fire" : "physical";
    const projectile: ProjectileState = {
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
      expiresAt: this.time.now + 4000,
    };
    this.projectiles.set(projectile.id, projectile);
  }

  private createHazard(x: number, y: number, radius: number, expiresAt: number, tickEveryMs: number, damageMin: number, damageMax: number): void {
    const id = Phaser.Math.RND.uuid();
    this.hazards.set(id, {
      x,
      y,
      radius,
      expiresAt,
      tickEveryMs,
      nextTickAt: this.time.now + 120,
      damageMin,
      damageMax,
    });
  }

  private applyBurn(target: ActorState, time: number, damageMin: number, damageMax: number): void {
    target.status.burningUntil = time + 3200;
    target.status.burnDamageMin = Math.max(target.status.burnDamageMin, damageMin);
    target.status.burnDamageMax = Math.max(target.status.burnDamageMax, damageMax);
    target.status.nextBurnTickAt = time + 1000;
  }

  private applyDamage(source: ActorState, target: ActorState, min: number, max: number, damageType: DamageType, silent = false): void {
    if (!target.alive) {
      return;
    }
    const rolled = Phaser.Math.Between(Math.round(min), Math.round(max));
    const crit = Math.random() < source.stats.critChance;
    let amount = rolled + (damageType === "physical" ? source.stats.physicalDamageMin / 6 : source.stats.fireDamageMin / 4);
    if (crit) {
      amount *= source.stats.critMultiplier;
    }
    if (damageType === "physical") {
      amount = amount * (1 - Phaser.Math.Clamp(target.stats.physicalResistance, 0, 0.75));
      amount -= target.stats.armor * 0.25;
    } else {
      amount = amount * (1 - Phaser.Math.Clamp(target.stats.fireResistance, 0, 0.75));
    }
    amount = Math.max(1, Math.round(amount));
    target.health = Math.max(0, target.health - amount);
    target.bodyHitUntil = this.time.now + 120;
    this.spawnFloatingText(target.x, target.y - target.radius - 8, `${crit ? "CRIT " : ""}${amount}`, damageType === "fire" ? "#ff9d73" : "#f0e6d2");
    if (!silent) {
      this.log(`${source.name} deals ${amount} ${damageType} to ${target.name}.`);
    }
    if (target.health <= 0) {
      this.handleDeath(source, target);
    }
  }

  private handleDeath(source: ActorState, target: ActorState): void {
    target.alive = false;
    target.health = 0;
    target.targetId = undefined;
    target.moveTarget = undefined;
    if (target.faction === "enemy") {
      const definition = enemyDefinitions[target.definitionId!];
      this.gainXp(definition.xpReward);
      this.dropRewards(target, definition.id);
      this.log(`${target.name} falls.`);
      const encounterId = target.encounterId;
      if (encounterId) {
        const aliveInEncounter = [...this.actors.values()].some((actor) => actor.alive && actor.encounterId === encounterId);
        if (!aliveInEncounter) {
          this.clearedEncounterIds.add(encounterId);
          this.log(`Encounter cleared: ${encounterId.replaceAll("-", " ")}.`);
        }
      }
      if (target.isBoss) {
        this.inventory.gold += 80;
        this.inventory.potions += 2;
        this.log("Boss defeated. The crossroads route is secure.");
        this.autosave();
      }
    } else {
      this.log(`You were slain by ${source.name}.`);
      this.overlayRect.setFillStyle(0x000000, 0.42);
      this.spawnFloatingText(this.player.x, this.player.y - 48, "Defeated", "#f07568");
    }
  }

  private dropRewards(target: ActorState, enemyId: string): void {
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

  private createPickup(pickup: PickupState): void {
    this.pickups.set(pickup.id, pickup);
  }

  private openChest(pickup: PickupState): void {
    const gold = Phaser.Math.Between(24, 44);
    this.inventory.gold += gold;
    this.inventory.potions += 1;
    this.inventory.items.push(this.rollLoot("magic"));
    this.clearedEncounterIds.add(pickup.encounterId ?? "chest");
    this.log(`Opened supply cache: ${gold} gold, 1 tonic, and a magic item.`);
    this.autosave();
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    while (this.level < LEVEL_THRESHOLDS.length - 1 && this.xp >= this.nextLevelXp) {
      this.level += 1;
      this.nextLevelXp = LEVEL_THRESHOLDS[this.level] ?? LEVEL_THRESHOLDS.at(-1)!;
      this.recalculatePlayerStats(true);
      this.log(`Level up. You are now level ${this.level}.`);
      this.spawnFloatingText(this.player.x, this.player.y - 56, `Level ${this.level}`, "#f5d56b");
      this.autosave();
    }
  }

  private consumePotion(): void {
    if (this.inventory.potions <= 0) {
      this.log("No health tonics left.");
      return;
    }
    if (this.player.health >= this.player.stats.maxHealth - 2) {
      this.log("Health is already full.");
      return;
    }
    this.inventory.potions -= 1;
    this.player.health = Math.min(this.player.stats.maxHealth, this.player.health + 64);
    this.log("Consumed a health tonic.");
    this.spawnFloatingText(this.player.x, this.player.y - 42, "+64", "#8bcf84");
  }

  private recalculatePlayerStats(fullHeal = false): void {
    const healthRatio = this.player ? this.player.health / this.player.stats.maxHealth : 1;
    const energyRatio = this.player ? this.player.energy / this.player.stats.maxEnergy : 1;
    const stats = this.buildPlayerStats();
    this.player.stats = stats;
    this.player.level = this.level;
    this.player.health = fullHeal ? stats.maxHealth : Math.min(stats.maxHealth, Math.max(1, stats.maxHealth * healthRatio));
    this.player.energy = fullHeal ? stats.maxEnergy : Math.min(stats.maxEnergy, stats.maxEnergy * energyRatio);
  }

  private buildPlayerStats() {
    const equipmentBonuses = Object.values(this.inventory.equipped)
      .filter((item): item is ItemInstance => Boolean(item))
      .map((item) => item.stats);
    const levelBonus: PartialStats = {
      maxHealth: (this.level - 1) * 24,
      maxEnergy: (this.level - 1) * 10,
      armor: (this.level - 1) * 3,
      physicalDamageMin: this.level - 1,
      physicalDamageMax: (this.level - 1) * 2,
      fireDamageMin: this.level - 1,
      fireDamageMax: (this.level - 1) * 2,
      moveSpeed: (this.level - 1) * 3,
    };
    return addStats(PLAYER_BASE_STATS, levelBonus, ...equipmentBonuses);
  }

  private rollLoot(targetRarity: "common" | "magic" | "rare"): ItemInstance {
    const pool = itemDefinitions.filter((item) =>
      targetRarity === "rare"
        ? item.rarity !== "common"
        : item.rarity === targetRarity || (targetRarity === "magic" && item.rarity === "common"),
    );
    const base = Phaser.Utils.Array.GetRandom(pool);
    return this.createItemInstance(base, targetRarity);
  }

  private createItemInstance(base: ItemDefinition, forcedRarity?: "common" | "magic" | "rare"): ItemInstance {
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
    };
  }

  private spawnFloatingText(x: number, y: number, value: string, color: string): void {
    const id = Phaser.Math.RND.uuid();
    const text = this.add
      .text(x, y, value, {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(30);
    text.setData("expiresAt", this.time.now + 900);
    this.floatingTexts.set(id, text);
  }

  private getNearestEnemy(x: number, y: number, maxDistance: number): ActorState | undefined {
    return [...this.actors.values()]
      .filter((actor) => actor.faction === "enemy" && actor.alive && actor.zoneId === this.activeZoneId)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(a.x, a.y, x, y) -
          Phaser.Math.Distance.Between(b.x, b.y, x, y),
      )
      .find((actor) => Phaser.Math.Distance.Between(actor.x, actor.y, x, y) <= maxDistance + actor.radius);
  }

  private pushActor(actor: ActorState, sourceX: number, sourceY: number, distance: number): void {
    const direction = new Phaser.Math.Vector2(actor.x - sourceX, actor.y - sourceY);
    if (direction.lengthSq() === 0) {
      direction.setTo(1, 0);
    }
    direction.normalize().scale(distance);
    actor.x = Phaser.Math.Clamp(actor.x + direction.x, 16, this.currentZone.width - 16);
    actor.y = Phaser.Math.Clamp(actor.y + direction.y, 16, this.currentZone.height - 16);
  }

  private destroyProjectile(id: string): void {
    this.projectiles.delete(id);
    const view = this.projectileViews.get(id);
    if (view) {
      view.shape.destroy();
      this.projectileViews.delete(id);
    }
  }

  private destroyHazard(id: string): void {
    this.hazards.delete(id);
    const view = this.hazardViews.get(id);
    if (view) {
      view.shape.destroy();
      this.hazardViews.delete(id);
    }
  }

  private destroyPickup(id: string): void {
    this.pickups.delete(id);
    const view = this.pickupViews.get(id);
    if (view) {
      view.sprite.destroy();
      view.label.destroy();
      this.pickupViews.delete(id);
    }
  }

  private autosave(): void {
    this.lastSaveAt = this.time.now;
    const snapshot = this.getSnapshot();
    if (snapshot) {
      writeSave(snapshot);
    }
  }

  private transitionToZone(zoneId: ZoneId, x: number, y: number): void {
    this.clearZoneState();
    this.activeZoneId = zoneId;
    this.player.zoneId = zoneId;
    this.player.x = x;
    this.player.y = y;
    this.player.moveTarget = undefined;
    this.player.targetId = undefined;
    this.actors.set(this.player.id, this.player);
    this.spawnZone(zoneId);
    this.createZoneVisuals();
    this.syncActorViews();
    this.log(`Entered ${zoneDefinitions[zoneId].name}.`);
    this.autosave();
  }

  private clearZoneState(): void {
    for (const [id, actor] of [...this.actors.entries()]) {
      if (id === this.player.id) {
        continue;
      }
      this.actors.delete(id);
      const view = this.actorViews.get(id);
      if (view) {
        view.body.destroy();
        view.shadow.destroy();
        view.hpBar.destroy();
        view.hpBarBg.destroy();
        view.nameLabel.destroy();
        this.actorViews.delete(id);
      }
    }

    for (const [id, view] of [...this.projectileViews.entries()]) {
      view.shape.destroy();
      this.projectileViews.delete(id);
    }
    this.projectiles.clear();

    for (const [id, view] of [...this.hazardViews.entries()]) {
      view.shape.destroy();
      this.hazardViews.delete(id);
    }
    this.hazards.clear();

    for (const [id, view] of [...this.pickupViews.entries()]) {
      view.sprite.destroy();
      view.label.destroy();
      this.pickupViews.delete(id);
    }
    this.pickups.clear();

    this.phaseTwoSummoned = false;
  }

  private grantTestLoot(): void {
    this.inventory.items.push(this.rollLoot("rare"));
    this.inventory.gold += 75;
    this.inventory.potions += 1;
    this.log("Debug cache granted.");
  }

  private log(message: string): void {
    this.combatLog.push(message);
    if (this.combatLog.length > 40) {
      this.combatLog.shift();
    }
  }
}
