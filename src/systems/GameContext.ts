import type Phaser from "phaser";
import type {
  ActorState,
  HazardState,
  ItemInstance,
  NpcState,
  PickupState,
  ProjectileState,
  RenderActor,
  RenderAttackEffect,
  RenderClickPulse,
  RenderHazard,
  RenderNpc,
  RenderPickup,
  RenderProjectile,
  RuntimeInventory,
  ZoneId,
} from "../gameplay/types";

/**
 * Shared mutable state bag passed to every system.
 * Systems read and write into these collections directly.
 */
export interface GameContext {
  // Phaser scene reference — gives systems access to add, tweens, time, cameras, etc.
  scene: Phaser.Scene;

  // Core game state
  player: ActorState;
  actors: Map<string, ActorState>;
  projectiles: Map<string, ProjectileState>;
  hazards: Map<string, HazardState>;
  pickups: Map<string, PickupState>;
  clearedEncounterIds: Set<string>;
  inventory: RuntimeInventory;

  // Progression
  level: number;
  xp: number;
  nextLevelXp: number;
  activeZoneId: ZoneId;

  // Render views
  actorViews: Map<string, RenderActor>;
  projectileViews: Map<string, RenderProjectile>;
  hazardViews: Map<string, RenderHazard>;
  pickupViews: Map<string, RenderPickup>;
  npcs: Map<string, NpcState>;
  npcViews: Map<string, RenderNpc>;
  isShopOpen: boolean;
  floatingTexts: Map<string, Phaser.GameObjects.Text>;
  attackEffects: Map<string, RenderAttackEffect>;
  clickPulse?: RenderClickPulse;
  targetRing?: Phaser.GameObjects.Arc;

  // HUD game objects
  hudText: Phaser.GameObjects.Text;
  zoneText: Phaser.GameObjects.Text;
  debugText: Phaser.GameObjects.Text;
  overlayRect: Phaser.GameObjects.Rectangle;
  bossHealthBarBg?: Phaser.GameObjects.Rectangle;
  bossHealthBar?: Phaser.GameObjects.Rectangle;

  // Minimap
  minimapBg?: Phaser.GameObjects.Rectangle;
  minimapDots: Phaser.GameObjects.Shape[];

  // Misc state
  skillCooldowns: Record<string, number>;
  phaseTwoSummoned: boolean;
  showDebug: boolean;
  godMode: boolean;
  combatLog: string[];
  combatLogTexts: Phaser.GameObjects.Text[];
  pendingTimers: Phaser.Time.TimerEvent[];

  // Pointer position (updated by GameScene input listeners)
  lastPointerWorld: Phaser.Math.Vector2;

  // Callback into GameScene for saving
  autosave: () => void;
  log: (msg: string) => void;
}

/** Convenience: current zone definition. */
export function getActiveItemInstances(ctx: GameContext): ItemInstance[] {
  return Object.values(ctx.inventory.equipped).filter((i): i is ItemInstance => Boolean(i));
}
