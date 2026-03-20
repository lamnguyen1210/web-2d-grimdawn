# Content Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new combat zones (Ashveil Descent, Deepmire Caverns) in a linear chain from Crossroads, plus a deterministic elite enemy system with 5 modifier types.

**Architecture:** Elite state lives entirely in `ActorState` (optional fields). Zone definitions carry the elite modifier per spawn. `ZoneSystem.spawnEnemy()` applies stat mutations at spawn time. `frenzied` elites use a new `attackCooldownMultiplier` field read by `AISystem`. No new systems, no new files.

**Tech Stack:** TypeScript, Phaser 3, Vite. No test suite — `npx tsc --noEmit` is the verification gate. Dev server: `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-03-20-content-expansion-design.md`

---

## File map

| File | What changes |
|------|-------------|
| `src/gameplay/types.ts` | Add `"ashveil"\|"deepmire"` to `ZoneId`; add `EliteModifier`; add `elite?` to `SpawnDefinition`; add `chestX?/chestY?` to `EncounterDefinition`; add `isElite?`, `eliteModifier?`, `attackCooldownMultiplier?` to `ActorState` |
| `src/content/zones.ts` | Add `ashveil` and `deepmire` zone objects; add crossroads→ashveil transition |
| `src/systems/AISystem.ts` | Apply `actor.attackCooldownMultiplier` when computing effective attack cooldown |
| `src/systems/ZoneSystem.ts` | `spawnEnemy()` gains `elite?` param, level-scaling extended, elite mutations added; `spawnZone()` chest coord logic updated |
| `src/systems/CombatSystem.ts` | `handleDeath()` calls `triggerVolatileExplosion()` for volatile elites; new private method added |
| `src/systems/LootSystem.ts` | `dropRewards()` checks `target.isElite` for forced item drop and gold ×1.5 |
| `src/systems/RenderSystem.ts` | `createZoneVisuals()` gets color branches for ashveil and deepmire |

---

## Task 1: Extend the type system

**Files:**
- Modify: `src/gameplay/types.ts`

- [ ] **Step 1: Update `ZoneId` union** (line 9)

  Replace:
  ```typescript
  export type ZoneId = "crossroads" | "arena" | "hollow";
  ```
  With:
  ```typescript
  export type ZoneId = "crossroads" | "arena" | "hollow" | "ashveil" | "deepmire";
  ```

- [ ] **Step 2: Add `EliteModifier` type** — insert after the `ZoneId` line:

  ```typescript
  export type EliteModifier =
    | "frenzied"
    | "armored"
    | "volatile"
    | "regenerating"
    | "empowered";
  ```

- [ ] **Step 3: Add `elite?` field to `SpawnDefinition`**

  Replace:
  ```typescript
  export interface SpawnDefinition {
    enemyId: string;
    x: number;
    y: number;
  }
  ```
  With:
  ```typescript
  export interface SpawnDefinition {
    enemyId: string;
    x: number;
    y: number;
    elite?: EliteModifier;
  }
  ```

- [ ] **Step 4: Add `chestX?/chestY?` to `EncounterDefinition`**

  Replace:
  ```typescript
  export interface EncounterDefinition {
    id: string;
    zoneId: ZoneId;
    spawns: SpawnDefinition[];
    chest?: boolean;
  }
  ```
  With:
  ```typescript
  export interface EncounterDefinition {
    id: string;
    zoneId: ZoneId;
    spawns: SpawnDefinition[];
    chest?: boolean;
    chestX?: number;
    chestY?: number;
  }
  ```

- [ ] **Step 5: Add elite + frenzied fields to `ActorState`** — insert after the existing `isBoss?: boolean` and `phase?: number` lines:

  ```typescript
  isElite?: boolean;
  eliteModifier?: EliteModifier;
  attackCooldownMultiplier?: number;  // frenzied elites: 0.6 (faster attacks); undefined = 1.0
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors (all new fields are optional, backward-compatible)

- [ ] **Step 7: Commit**

  ```bash
  git add src/gameplay/types.ts
  git commit -m "feat: add ZoneId expansion, EliteModifier type, and elite fields to types"
  ```

---

## Task 2: Add zone definitions

**Files:**
- Modify: `src/content/zones.ts`

- [ ] **Step 1: Add crossroads → ashveil transition**

  In the existing `crossroads.transitions` array, add a third entry after the hollow transition:
  ```typescript
  {
    toZoneId: "ashveil",
    x: 1640,
    y: 100,
    width: 120,
    height: 200,
    targetX: 120,
    targetY: 600,
    label: "To Ashveil Descent",
  },
  ```

- [ ] **Step 2: Add Ashveil Descent zone**

  Add a new key `ashveil` to the `zoneDefinitions` object:
  ```typescript
  ashveil: {
    id: "ashveil",
    name: "Ashveil Descent",
    width: 1600,
    height: 1200,
    playerSpawn: { x: 120, y: 600 },
    encounters: [
      {
        id: "ashveil-entrance-pack",
        zoneId: "ashveil",
        spawns: [
          { enemyId: "scavenger",    x: 320, y: 500 },
          { enemyId: "scavenger",    x: 380, y: 560 },
          { enemyId: "cultist",      x: 450, y: 520 },
          { enemyId: "cultist",      x: 480, y: 600, elite: "armored" },
        ],
      },
      {
        id: "ashveil-mid-pack",
        zoneId: "ashveil",
        chest: true,
        chestX: 850,
        chestY: 600,
        spawns: [
          { enemyId: "bruiser",       x: 780, y: 450 },
          { enemyId: "bruiser",       x: 860, y: 520 },
          { enemyId: "plagueStalker", x: 820, y: 600, elite: "frenzied" },
        ],
      },
      {
        id: "ashveil-deep-pack",
        zoneId: "ashveil",
        spawns: [
          { enemyId: "bruiser",   x: 1200, y: 400, elite: "volatile" },
          { enemyId: "cultist",   x: 1280, y: 480 },
          { enemyId: "cultist",   x: 1340, y: 560 },
          { enemyId: "scavenger", x: 1150, y: 520 },
        ],
      },
    ],
    transitions: [
      {
        toZoneId: "crossroads",
        x: 0,
        y: 400,
        width: 64,
        height: 240,
        targetX: 1520,
        targetY: 590,
        label: "Back to Crossroads",
      },
      {
        toZoneId: "deepmire",
        x: 1536,
        y: 400,
        width: 64,
        height: 240,
        targetX: 120,
        targetY: 600,
        label: "To Deepmire Caverns",
      },
    ],
  },
  ```

- [ ] **Step 3: Add Deepmire Caverns zone**

  Add a new key `deepmire` to the `zoneDefinitions` object:
  ```typescript
  deepmire: {
    id: "deepmire",
    name: "Deepmire Caverns",
    width: 1800,
    height: 1400,
    playerSpawn: { x: 120, y: 600 },
    encounters: [
      {
        id: "deepmire-stalker-pack",
        zoneId: "deepmire",
        chest: true,
        chestX: 500,
        chestY: 400,
        spawns: [
          { enemyId: "plagueStalker", x: 300, y: 280 },
          { enemyId: "plagueStalker", x: 380, y: 350 },
          { enemyId: "plagueStalker", x: 440, y: 260 },
          { enemyId: "plagueStalker", x: 350, y: 420, elite: "empowered" },
        ],
      },
      {
        id: "deepmire-wraith-pack",
        zoneId: "deepmire",
        spawns: [
          { enemyId: "frostWraith", x: 860,  y: 660 },
          { enemyId: "frostWraith", x: 940,  y: 720 },
          { enemyId: "frostWraith", x: 900,  y: 760, elite: "armored" },
          { enemyId: "bruiser",     x: 1000, y: 680 },
        ],
      },
      {
        id: "deepmire-boss-pack",
        zoneId: "deepmire",
        chest: true,
        chestX: 1350,
        chestY: 1050,
        spawns: [
          { enemyId: "bruiser",       x: 1350, y: 980,  elite: "regenerating" },
          { enemyId: "plagueStalker", x: 1280, y: 1060 },
          { enemyId: "plagueStalker", x: 1420, y: 1040 },
          { enemyId: "cultist",       x: 1480, y: 980,  elite: "frenzied" },
        ],
      },
    ],
    transitions: [
      {
        toZoneId: "ashveil",
        x: 0,
        y: 500,
        width: 64,
        height: 240,
        targetX: 1480,
        targetY: 600,
        label: "Back to Ashveil",
      },
    ],
  },
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 5: Commit**

  ```bash
  git add src/content/zones.ts
  git commit -m "feat: add Ashveil Descent and Deepmire Caverns zone definitions"
  ```

---

## Task 3: AISystem — respect attackCooldownMultiplier

**Files:**
- Modify: `src/systems/AISystem.ts`

- [ ] **Step 1: Apply multiplier to effectiveCooldown**

  Find the line (currently line 58):
  ```typescript
  const effectiveCooldown = definition.attackCooldownMs * chillMult;
  ```
  Replace with:
  ```typescript
  const effectiveCooldown = definition.attackCooldownMs * chillMult * (actor.attackCooldownMultiplier ?? 1);
  ```

  This is the only change to AISystem. `frenzied` elites will have `attackCooldownMultiplier = 0.6`, making their attack cooldown 60% of normal (40% faster attacks). `undefined` defaults to `1.0` (no change for non-elites).

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add src/systems/AISystem.ts
  git commit -m "feat: apply attackCooldownMultiplier in AI for frenzied elite attack speed"
  ```

---

## Task 4: Elite modifiers in ZoneSystem

**Files:**
- Modify: `src/systems/ZoneSystem.ts`

- [ ] **Step 1: Add `EliteModifier` to the import**

  The existing import from `../gameplay/types` includes `ActorState`, `EncounterDefinition`, `ZoneId`. Add `EliteModifier`:
  ```typescript
  import type { ActorState, EncounterDefinition, EliteModifier, ZoneId } from "../gameplay/types";
  ```

- [ ] **Step 2: Update `spawnZone()` — pass `spawn.elite` and use `encounter.chestX/Y`**

  Replace the inner loop and chest block (current lines 24-29) with:
  ```typescript
  for (const spawn of encounter.spawns) {
    this.spawnEnemy(spawn.enemyId, spawn.x, spawn.y, encounter, spawn.elite);
  }
  if (encounter.chest) {
    const chestX = encounter.chestX ?? (encounter.zoneId === "hollow" ? 1220 : 910);
    const chestY = encounter.chestY ?? (encounter.zoneId === "hollow" ? 1080 : 560);
    this.spawnChest(encounter.id, chestX, chestY);
  }
  ```

  > This replaces the previously hardcoded `encounter.zoneId === "hollow" ? 1220 : 910` ternary with a data-driven `encounter.chestX ??` lookup. The two existing `chest: true` encounters — `crossroads-center-pack` and `hollow-elite-pack` — have no `chestX/Y` defined and will use the fallback values `(910, 560)` and `(1220, 1080)` respectively, which are identical to what the old hardcoded ternary produced. No existing behavior changes.

- [ ] **Step 3: Update `spawnEnemy()` signature and level scaling**

  Replace the method signature and the `level` constant (current lines 33-40).

  > **`elite?` must be optional and trailing** — existing 4-argument call sites in `AISystem.ts` (`this.zone.spawnEnemy(enemyId, x, y, encounter)`) remain valid with no changes required to AISystem calls.

  ```typescript
  // OLD:
  spawnEnemy(enemyId: string, x: number, y: number, encounter: EncounterDefinition): void {
    const definition = enemyDefinitions[enemyId];
    const level =
      encounter.zoneId === "arena"
        ? Math.max(2, this.ctx.level + (enemyId === "warden" ? 1 : 0))
        : encounter.zoneId === "hollow"
          ? Math.max(2, this.ctx.level)
          : Math.max(1, this.ctx.level);

  // NEW:
  spawnEnemy(enemyId: string, x: number, y: number, encounter: EncounterDefinition, elite?: EliteModifier): void {
    const definition = enemyDefinitions[enemyId];
    const level =
      encounter.zoneId === "arena"    ? Math.max(2, this.ctx.level + (enemyId === "warden" ? 1 : 0))
    : encounter.zoneId === "ashveil"  ? Math.max(1, this.ctx.level + 1)
    : encounter.zoneId === "deepmire" ? Math.max(1, this.ctx.level + 2)
    : encounter.zoneId === "hollow"   ? Math.max(2, this.ctx.level)
    :                                   Math.max(1, this.ctx.level);
  ```

- [ ] **Step 4: Apply elite mutations after actor creation**

  After `this.ctx.actors.set(actor.id, actor);` (current line 78), add the full elite mutation block.

  **Sequencing rule:** the `actor.health = actor.stats.maxHealth` re-sync must happen LAST — after all stat spreads including the empowered damage correction.

  ```typescript
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

    // Step B — modifier-specific extras (applied on top of Step A)
    if (elite === "frenzied") {
      actor.attackCooldownMultiplier = 0.6;  // AISystem reads this for 40% faster attacks
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
      // Correct the ×1.2 damage from Step A up to ×1.35 net
      // net correction factor = 1.35 / 1.2 ≈ 1.125
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

    // Step C — re-sync health to new maxHealth (MUST be last, after all stat mutations)
    actor.health = actor.stats.maxHealth;

    // Step D — visual + name
    actor.radius += 3;
    const title = elite.charAt(0).toUpperCase() + elite.slice(1);
    actor.name  = `${title} ${actor.name}`;
    actor.color = actor.color | 0x404040;  // bitwise OR: result always ≤ 0xFFFFFF
  }
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 6: Commit**

  ```bash
  git add src/systems/ZoneSystem.ts
  git commit -m "feat: add elite modifier system to ZoneSystem (spawn mutations, level scaling, chest coords)"
  ```

---

## Task 5: Volatile explosion in CombatSystem

**Files:**
- Modify: `src/systems/CombatSystem.ts`

- [ ] **Step 1: Add `triggerVolatileExplosion` private method**

  Add this new private method anywhere after `handleDeath` (e.g., before `updateBurning`).

  > **Variable naming:** Use `playerActor` as the loop variable (not `target`) to avoid any confusion with `handleDeath`'s own `target` parameter, even though `triggerVolatileExplosion` is a separate method with its own scope.

  ```typescript
  private triggerVolatileExplosion(source: ActorState): void {
    for (const [, playerActor] of this.ctx.actors) {
      if (!playerActor.alive || playerActor.faction !== "player") continue;
      const dist = Phaser.Math.Distance.Between(source.x, source.y, playerActor.x, playerActor.y);
      if (dist <= 60 + playerActor.radius) {
        this.applyDamage(source, playerActor, 8, 14, "physical");
      }
    }
  }
  ```

  `source` is the just-killed volatile elite. Its `stats` are intact (only `alive` is set to false). `applyDamage` guards only `!target.alive` on the **target**, not the source — passing a dead source is safe.

- [ ] **Step 2: Call it from `handleDeath()`**

  In `handleDeath()`, inside the `if (target.faction === "enemy")` block, add after the existing `if (target.isBoss) { ... }` block:

  ```typescript
  if (target.eliteModifier === "volatile") {
    this.triggerVolatileExplosion(target);
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/systems/CombatSystem.ts
  git commit -m "feat: add volatile elite explosion on death"
  ```

---

## Task 6: Elite loot bonus in LootSystem

**Files:**
- Modify: `src/systems/LootSystem.ts`

- [ ] **Step 1: Update `dropRewards()` for elite gold and forced item drop**

  Replace the entire `dropRewards` method body with:

  ```typescript
  dropRewards(target: ActorState, enemyId: string): void {
    const isElite = target.isElite === true;

    // Gold — compute base range first (warden vs others), then apply elite multiplier
    const baseGold = Phaser.Math.Between(enemyId === "warden" ? 22 : 6, enemyId === "warden" ? 40 : 18);
    const goldAmount = isElite ? Math.round(baseGold * 1.5) : baseGold;
    this.createPickup({
      id: `gold-${Phaser.Math.RND.uuid()}`,
      kind: "gold",
      x: target.x + Phaser.Math.Between(-10, 10),
      y: target.y + Phaser.Math.Between(-10, 10),
      value: goldAmount,
      label: `${goldAmount} gold`,
    });

    // Potion — unchanged
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

    // Item — elites always drop; others use existing percentage chance
    const itemChance = enemyId === "warden" ? 1 : enemyId === "bruiser" ? 0.48 : 0.28;
    if (isElite || Math.random() < itemChance) {
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
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add src/systems/LootSystem.ts
  git commit -m "feat: elite enemies drop guaranteed item and 1.5x gold"
  ```

---

## Task 7: Zone visual colors in RenderSystem

**Files:**
- Modify: `src/systems/RenderSystem.ts`

- [ ] **Step 1: Update background color expression** (currently line 19)

  Replace:
  ```typescript
  const bgColor = zone.id === "crossroads" ? 0x2d231f : zone.id === "hollow" ? 0x1f2d1f : 0x261d1a;
  ```
  With:
  ```typescript
  const bgColor =
    zone.id === "crossroads" ? 0x2d231f
  : zone.id === "hollow"     ? 0x1f2d1f
  : zone.id === "ashveil"    ? 0x2a2018
  : zone.id === "deepmire"   ? 0x0f1a0f
  :                            0x261d1a;
  ```

- [ ] **Step 2: Update patch color expression** (currently line 31)

  Replace:
  ```typescript
  const patchColor = zone.id === "crossroads" ? 0x403226 : zone.id === "hollow" ? 0x2a4028 : 0x3b291f;
  ```
  With:
  ```typescript
  const patchColor =
    zone.id === "crossroads" ? 0x403226
  : zone.id === "hollow"     ? 0x2a4028
  : zone.id === "ashveil"    ? 0x4a2e1a
  : zone.id === "deepmire"   ? 0x1a2e1a
  :                            0x3b291f;
  ```

- [ ] **Step 3: Update road color expression** (currently line 41)

  Replace:
  ```typescript
  const roadColor = zone.id === "crossroads" ? 0x5c4a3c : zone.id === "hollow" ? 0x3d5c3a : 0x4b3830;
  ```
  With:
  ```typescript
  const roadColor =
    zone.id === "crossroads" ? 0x5c4a3c
  : zone.id === "hollow"     ? 0x3d5c3a
  : zone.id === "ashveil"    ? 0x5c3d2a
  : zone.id === "deepmire"   ? 0x1a3d1a
  :                            0x4b3830;
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 5: Commit**

  ```bash
  git add src/systems/RenderSystem.ts
  git commit -m "feat: add Ashveil and Deepmire zone visual colors"
  ```

---

## Task 8: Full verification

- [ ] **Step 1: Final type check**

  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 2: Build check**

  Run: `npm run build`
  Expected: build succeeds

- [ ] **Step 3: Start dev server and manual smoke test**

  Run: `npm run dev`

  Verify in browser:
  - [ ] Walk to top-right corner of Crossroads — portal "To Ashveil Descent" appears
  - [ ] Enter portal — Ashveil Descent loads with dark ash-brown floor
  - [ ] Three enemy groups spawn (west, center, east)
  - [ ] Elite enemies are visibly brighter than normal enemies of the same type
  - [ ] Elite name label shows prefix (e.g. "Armored Ash Cultist")
  - [ ] Kill the frenzied elite — it attacks faster than its normal counterpart
  - [ ] Kill the volatile elite Bruiser in deep-pack while standing close — player takes explosion damage
  - [ ] Clear ashveil-mid-pack — chest spawns near (850, 600)
  - [ ] Elite kill yields item drop in addition to gold
  - [ ] Walk right edge of Ashveil — portal to Deepmire Caverns appears
  - [ ] Enter Deepmire — dark green-black floor, no exit except back to Ashveil
  - [ ] All deepmire encounters spawn with their elite compositions
