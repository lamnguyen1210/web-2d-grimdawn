import type Phaser from "phaser";

export type DamageType = "physical" | "fire" | "poison";
export type Faction = "player" | "enemy" | "neutral";
export type EnemyArchetype = "rusher" | "ranged" | "bruiser" | "boss";
export type ItemSlot = "weapon" | "chest" | "ring";
export type ItemRarity = "common" | "magic" | "rare";
export type SkillId = "basicAttack" | "cleaveShot" | "fireBomb" | "frostNova" | "venomShot";
export type ZoneId = "crossroads" | "arena" | "hollow" | "ashveil" | "deepmire" | "town";

export type NpcKind = "merchant" | "healer";

export interface NpcState {
  id: string;
  kind: NpcKind;
  name: string;
  x: number;
  y: number;
  zoneId: ZoneId;
}

export type EliteModifier =
  | "frenzied"
  | "armored"
  | "volatile"
  | "regenerating"
  | "empowered";

export interface StatBlock {
  maxHealth: number;
  healthRegen: number;
  maxEnergy: number;
  energyRegen: number;
  armor: number;
  moveSpeed: number;
  attackSpeed: number;
  physicalDamageMin: number;
  physicalDamageMax: number;
  fireDamageMin: number;
  fireDamageMax: number;
  critChance: number;
  critMultiplier: number;
  physicalResistance: number;
  fireResistance: number;
  poisonResistance: number;
}

export type PartialStats = Partial<StatBlock>;

export interface ItemDefinition {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  baseStats: PartialStats;
  affixCapacity: number;
  requiredLevel: number;
}

export interface AffixDefinition {
  id: string;
  name: string;
  family: "prefix" | "suffix";
  stats: PartialStats;
  weight: number;
}

export interface ItemInstance {
  id: string;
  baseId: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  stats: PartialStats;
  affixIds: string[];
  requiredLevel: number;
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  cooldownMs: number;
  energyCost: number;
  range: number;
  targetMode: "enemy" | "ground" | "self";
  description: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  color: number;
  radius: number;
  baseStats: StatBlock;
  xpReward: number;
  contactDamageMin: number;
  contactDamageMax: number;
  attackRange: number;
  attackCooldownMs: number;
}

export interface SpawnDefinition {
  enemyId: string;
  x: number;
  y: number;
  elite?: EliteModifier;
}

export interface EncounterDefinition {
  id: string;
  zoneId: ZoneId;
  spawns: SpawnDefinition[];
  chest?: boolean;
  chestX?: number;
  chestY?: number;
}

export interface HazardState {
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  tickEveryMs: number;
  nextTickAt: number;
  damageMin: number;
  damageMax: number;
  damageType?: DamageType;
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sourceId: string;
  faction: Faction;
  damageMin: number;
  damageMax: number;
  damageType: DamageType;
  expiresAt: number;
}

export interface StatusState {
  burningUntil: number;
  burnDamageMin: number;
  burnDamageMax: number;
  nextBurnTickAt: number;
  burnSourceId: string;
  poisonedUntil: number;
  poisonDamageMin: number;
  poisonDamageMax: number;
  nextPoisonTickAt: number;
  poisonSourceId: string;
  chilledUntil: number;
  chillFactor: number;
}

export interface ActorState {
  id: string;
  definitionId?: string;
  name: string;
  faction: Faction;
  x: number;
  y: number;
  radius: number;
  color: number;
  level: number;
  stats: StatBlock;
  health: number;
  energy: number;
  alive: boolean;
  targetId?: string;
  moveTarget?: { x: number; y: number };
  zoneId: ZoneId;
  encounterId?: string;
  aiState?: "idle" | "acquire" | "chase" | "attack" | "recover";
  lastActionAt: number;
  attackCooldownUntil: number;
  status: StatusState;
  isBoss?: boolean;
  phase?: number;
  isElite?: boolean;
  eliteModifier?: EliteModifier;
  attackCooldownMultiplier?: number;
  bodyHitUntil?: number;
  deathAnimatedUntil?: number;
}

export interface ZoneTransition {
  toZoneId: ZoneId;
  x: number;
  y: number;
  width: number;
  height: number;
  targetX: number;
  targetY: number;
  label: string;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };
  encounters: EncounterDefinition[];
  transitions: ZoneTransition[];
}

export interface RuntimeInventory {
  gold: number;
  potions: number;
  items: ItemInstance[];
  equipped: Partial<Record<ItemSlot, ItemInstance>>;
}

export interface RuntimeStateSnapshot {
  zoneId: ZoneId;
  player: ActorState;
  inventory: RuntimeInventory;
  clearedEncounterIds: string[];
  level: number;
  xp: number;
  nextLevelXp: number;
}

export interface SaveGame {
  version: number;
  zoneId: ZoneId;
  player: {
    x: number;
    y: number;
    level: number;
    xp: number;
    nextLevelXp: number;
    health: number;
    energy: number;
  };
  inventory: RuntimeInventory;
  clearedEncounterIds: string[];
}

// ── Pickup types ─────────────────────────────────────────────────────────────

export type PickupKind = "gold" | "potion" | "item" | "chest";

export interface PickupState {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  value?: number;
  item?: ItemInstance;
  encounterId?: string;
  label: string;
}

// ── Render view types (reference Phaser game objects) ────────────────────────

export interface RenderActor {
  body: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Ellipse;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameLabel: Phaser.GameObjects.Text;
}

export interface RenderPickup {
  sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

export interface RenderHazard {
  shape: Phaser.GameObjects.Arc;
}

export interface RenderProjectile {
  shape: Phaser.GameObjects.Arc;
}

export interface RenderAttackEffect {
  slash: Phaser.GameObjects.Rectangle;
  impact: Phaser.GameObjects.Arc;
  expiresAt: number;
}

export interface RenderClickPulse {
  ring: Phaser.GameObjects.Arc;
  expiresAt: number;
}

export interface RenderNpc {
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}
