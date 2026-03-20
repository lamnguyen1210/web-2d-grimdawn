import Phaser from "phaser";
import { itemDefinitions } from "../content/items";
import { skillDefinitions } from "../content/skills";
import { zoneDefinitions } from "../content/zones";
import { loadSave, resetSave, SAVE_VERSION, writeSave } from "../gameplay/save";
import type {
  ActorState,
  RuntimeInventory,
  RuntimeStateSnapshot,
  SaveGame,
  ZoneId,
} from "../gameplay/types";
import { AISystem } from "../systems/AISystem";
import type { GameContext } from "../systems/GameContext";
import { CombatSystem, LEVEL_THRESHOLDS } from "../systems/CombatSystem";
import { LootSystem } from "../systems/LootSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { SkillSystem } from "../systems/SkillSystem";
import { ZoneSystem } from "../systems/ZoneSystem";
import { getNearestEnemy, moveActorTowards } from "../gameplay/movement";

const SAVE_DEBOUNCE_MS = 4000;

export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private render!: RenderSystem;
  private loot!: LootSystem;
  private combat!: CombatSystem;
  private skill!: SkillSystem;
  private zone!: ZoneSystem;
  private ai!: AISystem;

  // Input keys
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private skill1Key!: Phaser.Input.Keyboard.Key;
  private skill2Key!: Phaser.Input.Keyboard.Key;
  private skill3Key!: Phaser.Input.Keyboard.Key;
  private skill4Key!: Phaser.Input.Keyboard.Key;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private potionKey!: Phaser.Input.Keyboard.Key;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private lootKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private godModeKey!: Phaser.Input.Keyboard.Key;
  private isPaused = false;

  private isInventoryVisible = false;
  private lastSaveAt = 0;

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
    this.skill3Key = this.input.keyboard!.addKey("THREE");
    this.skill4Key = this.input.keyboard!.addKey("FOUR");
    this.inventoryKey = this.input.keyboard!.addKey("I");
    this.potionKey = this.input.keyboard!.addKey("SPACE");
    this.debugKey = this.input.keyboard!.addKey("F1");
    this.lootKey = this.input.keyboard!.addKey("F5");
    this.escKey = this.input.keyboard!.addKey("ESC");
    this.godModeKey = this.input.keyboard!.addKey("F2");

    const overlayRect = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(80);
    const zoneText = this.add
      .text(24, 20, "", { fontFamily: "Trebuchet MS", fontSize: "20px", color: "#f4d39c", stroke: "#000000", strokeThickness: 4 })
      .setScrollFactor(0).setDepth(90);
    const hudText = this.add
      .text(24, 52, "", { fontFamily: "Trebuchet MS", fontSize: "15px", color: "#f0e6d2", stroke: "#000000", strokeThickness: 3 })
      .setScrollFactor(0).setDepth(90);
    const debugText = this.add
      .text(24, 150, "", { fontFamily: "Consolas", fontSize: "13px", color: "#f8d08b", stroke: "#000000", strokeThickness: 3 })
      .setScrollFactor(0).setDepth(90);

    const combatLog: string[] = [];
    const lastPointerWorld = new Phaser.Math.Vector2();

    this.ctx = {
      scene: this,
      player: undefined as unknown as ActorState,
      actors: new Map(),
      projectiles: new Map(),
      hazards: new Map(),
      pickups: new Map(),
      clearedEncounterIds: new Set(),
      inventory: { gold: 0, potions: 3, items: [], equipped: {} },
      level: 1,
      xp: 0,
      nextLevelXp: LEVEL_THRESHOLDS[1],
      activeZoneId: "crossroads",
      actorViews: new Map(),
      projectileViews: new Map(),
      hazardViews: new Map(),
      pickupViews: new Map(),
      floatingTexts: new Map(),
      attackEffects: new Map(),
      hudText,
      zoneText,
      debugText,
      overlayRect,
      skillCooldowns: {},
      phaseTwoSummoned: false,
      showDebug: false,
      godMode: false,
      combatLog,
      combatLogTexts: [],
      pendingTimers: [],
      lastPointerWorld,
      minimapDots: [],
      autosave: () => this.autosave(),
      log: (msg) => this.log(msg),
    };

    this.render = new RenderSystem(this.ctx);
    this.loot = new LootSystem(this.ctx);
    this.combat = new CombatSystem(this.ctx, this.render, this.loot);
    this.skill = new SkillSystem(this.ctx, this.combat, this.render);
    this.zone = new ZoneSystem(this.ctx, this.render, this.loot);
    this.ai = new AISystem(this.ctx, this.combat, this.zone);

    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.ctx.lastPointerWorld.set(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused || !this.ctx.player?.alive) return;
      this.ctx.lastPointerWorld.set(pointer.worldX, pointer.worldY);
      if (pointer.rightButtonDown()) {
        this.skill.tryCastFireBomb(pointer.worldX, pointer.worldY);
        return;
      }
      const clickedEnemy = getNearestEnemy(this.ctx.actors, this.ctx.activeZoneId, pointer.worldX, pointer.worldY, 28);
      if (clickedEnemy) {
        this.ctx.player.targetId = clickedEnemy.id;
        this.ctx.player.moveTarget = undefined;
        this.render.showClickPulse(clickedEnemy.x, clickedEnemy.y, 0xf09a62);
      } else {
        const currentZone = zoneDefinitions[this.ctx.activeZoneId];
        this.ctx.player.moveTarget = {
          x: Phaser.Math.Clamp(pointer.worldX, 20, currentZone.width - 20),
          y: Phaser.Math.Clamp(pointer.worldY, 20, currentZone.height - 20),
        };
        this.ctx.player.targetId = undefined;
        this.render.showClickPulse(this.ctx.player.moveTarget.x, this.ctx.player.moveTarget.y, 0xf2d08c);
      }
    });

    this.restoreOrStart();
    this.game.events.emit("ready");
  }

  getSnapshot(): RuntimeStateSnapshot | null {
    if (!this.ctx?.player) {
      return null;
    }
    return {
      zoneId: this.ctx.activeZoneId,
      player: this.ctx.player,
      inventory: this.ctx.inventory,
      clearedEncounterIds: [...this.ctx.clearedEncounterIds],
      level: this.ctx.level,
      xp: this.ctx.xp,
      nextLevelXp: this.ctx.nextLevelXp,
    };
  }

  getCombatLog(): string[] {
    return this.ctx.combatLog;
  }

  equipItem(itemId: string): void {
    const itemIndex = this.ctx.inventory.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return;
    }
    const item = this.ctx.inventory.items[itemIndex];
    const previous = this.ctx.inventory.equipped[item.slot];
    if (previous) {
      this.ctx.inventory.items.push(previous);
    }
    this.ctx.inventory.equipped[item.slot] = item;
    this.ctx.inventory.items.splice(itemIndex, 1);
    this.combat.recalculatePlayerStats();
    this.log(`Equipped ${item.name}.`);
    this.autosave();
  }

  respawnPlayer(): void {
    if (this.ctx.player.alive) {
      return;
    }
    const zoneSpawn = zoneDefinitions[this.ctx.activeZoneId].playerSpawn;
    const stats = this.combat.buildPlayerStats();
    const respawnSave: SaveGame = {
      version: SAVE_VERSION,
      zoneId: this.ctx.activeZoneId,
      player: {
        x: zoneSpawn.x,
        y: zoneSpawn.y,
        level: this.ctx.level,
        xp: this.ctx.xp,
        nextLevelXp: this.ctx.nextLevelXp,
        health: stats.maxHealth,
        energy: stats.maxEnergy,
      },
      inventory: this.ctx.inventory,
      clearedEncounterIds: [...this.ctx.clearedEncounterIds],
    };
    this.restoreOrStart(respawnSave);
    this.log("Respawned at the zone entrance.");
  }

  loadLastSaveState(): void {
    this.restoreOrStart(loadSave());
    this.log("Loaded the last autosave.");
  }

  startNewGame(): void {
    resetSave();
    this.restoreOrStart(null);
    this.log("Started a new run.");
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getIsInventoryVisible(): boolean {
    return this.isInventoryVisible;
  }

  resumeGame(): void {
    this.isPaused = false;
  }

  update(time: number, delta: number): void {
    if (this.ctx?.player) {
      if (Phaser.Input.Keyboard.JustDown(this.escKey) && this.ctx.player.alive) {
        this.isPaused = !this.isPaused;
      }
      if (Phaser.Input.Keyboard.JustDown(this.godModeKey)) {
        this.ctx.godMode = !this.ctx.godMode;
        this.log(`God mode ${this.ctx.godMode ? "ON" : "OFF"}.`);
      }
    }
    if (!this.ctx?.player?.alive || this.isPaused) {
      return;
    }
    this.handleKeys();
    this.updatePlayer(time, delta);
    this.ai.updateEnemies(time, delta);
    this.combat.updateProjectiles(time, delta);
    this.combat.updateHazards(time);
    this.combat.updateBurning(time);
    this.combat.updatePoison(time);
    this.render.updateFloatingTexts(time, delta);
    this.render.updateCombatEffects(time);
    this.loot.updatePickups();
    this.zone.checkTransitions();
    this.render.refreshRenderState(time);
    this.render.updateHud();

    if (time - this.lastSaveAt >= SAVE_DEBOUNCE_MS) {
      this.autosave();
    }
  }

  private restoreOrStart(saveOverride?: SaveGame | null): void {
    this.isPaused = false;
    const save = saveOverride === undefined ? loadSave() : saveOverride;
    this.zone.resetRuntimeState();

    this.ctx.inventory = save?.inventory ?? {
      gold: 18,
      potions: 3,
      items: [this.loot.createItemInstance(itemDefinitions[0]), this.loot.createItemInstance(itemDefinitions[1])],
      equipped: {},
    };
    this.ctx.level = save?.player.level ?? 1;
    this.ctx.xp = save?.player.xp ?? 0;
    this.ctx.nextLevelXp = save?.player.nextLevelXp ?? LEVEL_THRESHOLDS[this.ctx.level] ?? LEVEL_THRESHOLDS.at(-1)!;
    this.ctx.activeZoneId = (save?.zoneId ?? "crossroads") as ZoneId;
    this.ctx.clearedEncounterIds = new Set(save?.clearedEncounterIds ?? []);

    const playerStats = this.combat.buildPlayerStats();
    this.ctx.player = {
      id: "player",
      name: "Soldier-Alchemist",
      faction: "player",
      x: save?.player.x ?? zoneDefinitions[this.ctx.activeZoneId].playerSpawn.x,
      y: save?.player.y ?? zoneDefinitions[this.ctx.activeZoneId].playerSpawn.y,
      radius: 18,
      color: 0xd9d4ca,
      level: this.ctx.level,
      stats: playerStats,
      health: Math.min(save?.player.health ?? playerStats.maxHealth, playerStats.maxHealth),
      energy: Math.min(save?.player.energy ?? playerStats.maxEnergy, playerStats.maxEnergy),
      alive: true,
      zoneId: this.ctx.activeZoneId,
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
    };
    this.ctx.actors.set(this.ctx.player.id, this.ctx.player);
    this.zone.spawnZone(this.ctx.activeZoneId);
    this.render.createZoneVisuals();
    this.render.syncActorViews();
    this.ctx.overlayRect.setFillStyle(0x000000, 0);
  }

  private handleKeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.skill1Key)) {
      this.skill.tryCastCleaveShot();
    }
    if (Phaser.Input.Keyboard.JustDown(this.skill2Key)) {
      this.skill.tryCastFireBomb(
        this.ctx.lastPointerWorld.x || this.ctx.player.x + 10,
        this.ctx.lastPointerWorld.y || this.ctx.player.y,
      );
    }
    if (Phaser.Input.Keyboard.JustDown(this.skill3Key)) {
      this.skill.tryCastFrostNova();
    }
    if (Phaser.Input.Keyboard.JustDown(this.skill4Key)) {
      this.skill.tryCastVenomShot();
    }
    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      this.isInventoryVisible = !this.isInventoryVisible;
    }
    if (Phaser.Input.Keyboard.JustDown(this.potionKey)) {
      this.combat.consumePotion();
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.ctx.showDebug = !this.ctx.showDebug;
    }
    if (Phaser.Input.Keyboard.JustDown(this.lootKey)) {
      this.grantTestLoot();
    }
  }

  private updatePlayer(time: number, delta: number): void {
    const player = this.ctx.player;
    player.health = Phaser.Math.Clamp(player.health + player.stats.healthRegen * (delta / 1000), 0, player.stats.maxHealth);
    player.energy = Phaser.Math.Clamp(player.energy + player.stats.energyRegen * (delta / 1000), 0, player.stats.maxEnergy);

    // Chill slows player movement
    const chillMult = player.status.chilledUntil > time ? 1 - player.status.chillFactor : 1;
    const effectiveMoveSpeed = player.stats.moveSpeed * chillMult;

    const moveVector = new Phaser.Math.Vector2(
      (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0),
      (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0),
    );

    const zone = zoneDefinitions[this.ctx.activeZoneId];
    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().scale(effectiveMoveSpeed * (delta / 1000));
      player.moveTarget = undefined;
      player.targetId = undefined;
      player.x = Phaser.Math.Clamp(player.x + moveVector.x, 16, zone.width - 16);
      player.y = Phaser.Math.Clamp(player.y + moveVector.y, 16, zone.height - 16);
      return;
    }

    if (player.targetId) {
      const target = this.ctx.actors.get(player.targetId);
      if (!target || !target.alive || target.zoneId !== this.ctx.activeZoneId) {
        player.targetId = undefined;
      } else {
        const range = skillDefinitions.basicAttack.range;
        const distance = Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y);
        if (distance > range * 0.86) {
          moveActorTowards(player, target.x, target.y, effectiveMoveSpeed, delta, zone.width, zone.height);
        } else if (time >= player.attackCooldownUntil) {
          this.combat.performBasicAttack(target, time);
        }
      }
    } else if (player.moveTarget) {
      const arrived = moveActorTowards(player, player.moveTarget.x, player.moveTarget.y, effectiveMoveSpeed, delta, zone.width, zone.height);
      if (arrived) {
        player.moveTarget = undefined;
      }
    }
  }

  private autosave(): void {
    this.lastSaveAt = this.time.now;
    const snapshot = this.getSnapshot();
    if (snapshot) {
      writeSave(snapshot);
    }
  }

  private log(message: string): void {
    this.ctx.combatLog.push(message);
    if (this.ctx.combatLog.length > 40) {
      this.ctx.combatLog.shift();
    }
    this.render.addCombatLogEntry(message);
  }

  private grantTestLoot(): void {
    this.ctx.inventory.items.push(this.loot.rollLoot("rare"));
    this.ctx.inventory.gold += 75;
    this.ctx.inventory.potions += 1;
    this.log("Debug cache granted.");
  }
}
