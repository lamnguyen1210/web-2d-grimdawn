# Sub-project A: Content Expansion — Design Spec
**Date:** 2026-03-20
**Status:** Approved

---

## Overview

Add two new combat zones extending the world into a linear chain, and introduce a deterministic elite enemy system that places named, modified enemies at fixed locations in zone definitions.

---

## Zone chain

```
Ruined Crossroads → Ashveil Descent → Deepmire Caverns
      ↓
 Warden Arena (existing side branch, unchanged)
      ↓
 Blighted Hollow (existing side branch, unchanged)
```

Deepmire is a dead end — no onward transition — forcing full engagement before backtracking.

---

## Type changes — `src/gameplay/types.ts`

```typescript
// 1. Extend ZoneId union
export type ZoneId = "crossroads" | "arena" | "hollow" | "ashveil" | "deepmire";

// 2. New type
export type EliteModifier =
  | "frenzied"
  | "armored"
  | "volatile"
  | "regenerating"
  | "empowered";

// 3. Update SpawnDefinition — add optional elite field
export interface SpawnDefinition {
  enemyId: string;
  x: number;
  y: number;
  elite?: EliteModifier;
}

// 4. Update EncounterDefinition — add optional chest position fields
export interface EncounterDefinition {
  id: string;
  zoneId: ZoneId;
  spawns: SpawnDefinition[];
  chest?: boolean;
  chestX?: number;   // if undefined, ZoneSystem falls back to existing hardcoded default
  chestY?: number;
}

// 5. Update ActorState — add two optional fields (after existing isBoss/phase)
isElite?: boolean;
eliteModifier?: EliteModifier;
```

`EncounterDefinition.zoneId: ZoneId` automatically accepts new zone IDs once the union is extended.

---

## New Zone 1 — Ashveil Descent

| Property | Value |
|----------|-------|
| ID | `ashveil` |
| Name | Ashveil Descent |
| Size | 1600 × 1200 |
| Floor color | `0x2a2018` |
| Patch color | `0x4a2e1a` |
| Enemy level | `Math.max(1, ctx.level + 1)` |

**Transitions (both must be defined):**

| Direction | rect | targetX | targetY | label |
|-----------|------|---------|---------|-------|
| ← Crossroads | `x:0, y:400, w:64, h:240` | 1520 | 590 | `"Back to Crossroads"` |
| → Deepmire | `x:1536, y:400, w:64, h:240` | 120 | 600 | `"To Deepmire Caverns"` |

**Encounters:**

| ID | Spawns | chest | chestX | chestY |
|----|--------|-------|--------|--------|
| `ashveil-entrance-pack` | 2× scavenger, 1× cultist, 1× cultist (armored elite) | — | — | — |
| `ashveil-mid-pack` | 2× bruiser, 1× plagueStalker (frenzied elite) | true | 850 | 600 |
| `ashveil-deep-pack` | 1× bruiser (volatile elite), 2× cultist, 1× scavenger | — | — | — |

Spawn x/y coordinates within each encounter are chosen by the implementor: entrance pack in west third, mid in center, deep in east third of the 1600×1200 space.

---

## New Zone 2 — Deepmire Caverns

| Property | Value |
|----------|-------|
| ID | `deepmire` |
| Name | Deepmire Caverns |
| Size | 1800 × 1400 |
| Floor color | `0x0f1a0f` |
| Patch color | `0x1a2e1a` |
| Enemy level | `Math.max(1, ctx.level + 2)` |

**Transitions:**

| Direction | rect | targetX | targetY | label |
|-----------|------|---------|---------|-------|
| ← Ashveil | `x:0, y:500, w:64, h:240` | 1480 | 600 | `"Back to Ashveil"` |

No onward transition (dead end).

**Encounters:**

| ID | Spawns | chest | chestX | chestY |
|----|--------|-------|--------|--------|
| `deepmire-stalker-pack` | 3× plagueStalker, 1× plagueStalker (empowered elite) | true | 500 | 400 |
| `deepmire-wraith-pack` | 2× frostWraith, 1× frostWraith (armored elite), 1× bruiser | — | — | — |
| `deepmire-boss-pack` | 1× bruiser (regenerating elite), 2× plagueStalker, 1× cultist (frenzied elite) | true | 1350 | 1050 |

Note: no `isBoss: true` actors in deepmire. The hardcoded boss death message in `handleDeath()` fires only for `actor.isBoss === true` and will not trigger here.

Spawn x/y: stalker-pack in northwest quarter, wraith-pack in center, boss-pack in southeast.

---

## Crossroads — new transition to Ashveil

Add to the existing crossroads transitions array:

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
}
```

(Place on the top-right edge of Crossroads, away from the existing Arena portal.)

---

## Elite modifier application — `ZoneSystem`

### `spawnEnemy()` signature change

Add an optional fifth parameter:

```typescript
private spawnEnemy(enemyId: string, x: number, y: number, encounter: EncounterDefinition, elite?: EliteModifier): void
```

In `spawnZone()`, the loop over `encounter.spawns` passes `spawn.elite`:

```typescript
for (const spawn of encounter.spawns) {
  this.spawnEnemy(spawn.enemyId, spawn.x, spawn.y, encounter, spawn.elite);
}
```

### Level scaling inside `spawnEnemy()`

The existing level-offset conditional inside `spawnEnemy()` must be extended. Replace the existing branch with:

```typescript
const level =
  encounter.zoneId === "arena"    ? Math.max(1, ctx.level + 1)
: encounter.zoneId === "ashveil"  ? Math.max(1, ctx.level + 1)
: encounter.zoneId === "deepmire" ? Math.max(1, ctx.level + 2)
: /* crossroads, hollow */          Math.max(1, ctx.level);
```

Without this change, `ashveil` and `deepmire` silently fall into the default arm and spawn enemies at `ctx.level + 0`. TypeScript will not catch this because the fallback compiles without error.

### Elite mutations inside `spawnEnemy()`

After the base actor is created and level-scaled (using the branch above), when `elite` is defined:

1. `actor.isElite = true`
2. `actor.eliteModifier = elite`
3. Scale stats:

| Modifier | health | phys & fire damage (min + max) | extra |
|----------|--------|--------------------------------|-------|
| frenzied | ×1.6 | ×1.2 | `attackCooldownMs ×0.6` |
| armored | ×1.6 | ×1.2 | `armor ×1.6`; each resistance `= Math.min(0.85, resistance + 0.15)` |
| volatile | ×1.6 | ×1.2 | explosion on death (see CombatSystem) |
| regenerating | ×1.6 | ×1.2 | `healthRegen +3` |
| empowered | ×1.6 | ×1.35 | — |

4. `actor.health = actor.stats.maxHealth` (re-sync to new max)
5. `actor.radius += 3`
6. `actor.name = "<Title> <BaseName>"` where title = modifier string with first letter uppercased
7. `actor.color = actor.color | 0x404040`
   - Bitwise OR on a 24-bit color value: each channel is `originalChannel | 0x40`, which can only set bits 6 and below of each byte. The result is always ≤ `0xFFFFFF`. No per-channel clamping needed.
   - Storing the brightened value in `actor.color` means both `syncActorViews()` (initial creation) and `refreshRenderState()` (per-frame base color) use it automatically — no changes to RenderSystem needed for elite tinting.

### Chest coordinate extension — `spawnZone()`

`spawnChest()` is called when `encounter.chest === true`. Use `chestX`/`chestY` from the encounter definition if present; fall back to existing hardcoded defaults:

```typescript
const chestX = encounter.chestX ?? (encounter.zoneId === "hollow" ? 1220 : 910);
const chestY = encounter.chestY ?? (encounter.zoneId === "hollow" ? 1080 : 560);
this.spawnChest(encounter.id, chestX, chestY);
```

---

## Volatile explosion — `CombatSystem.handleDeath()`

When `actor.eliteModifier === "volatile"`, after normal death handling, call:

```typescript
private triggerVolatileExplosion(source: ActorState): void {
  for (const [, target] of this.ctx.actors) {
    if (!target.alive || target.faction !== "player") continue;
    const dist = Phaser.Math.Distance.Between(source.x, source.y, target.x, target.y);
    if (dist <= 60 + target.radius) {
      this.applyDamage(source, target, 8, 14, "physical");
    }
  }
}
```

**Targeting:** only `faction === "player"` actors are hit. No enemy-to-enemy chain explosions. The player is the only player-faction actor in the game.

**Source:** the dying elite actor passed as `source`. Its `stats` are intact at call time (only `alive` is false). `applyDamage` uses `source.stats.critChance` and damage bonus normally. This is intentional.

**Zone-transition safety:** `clearZoneState()` removes actors without calling `handleDeath()` — no explosion during zone exit.

---

## Elite loot — `LootSystem.dropRewards(target, enemyId)`

Add at the start:

```typescript
const isElite = target.isElite === true;
```

**Gold:** compute the base amount using the existing `enemyId === "warden"` range (22–40 for warden, 6–18 otherwise), then: `const finalGold = isElite ? Math.round(baseGold * 1.5) : baseGold`. The warden will never be marked `isElite`, so these paths never combine.

**Item drop:** when `isElite`, skip the normal 28%/48% roll and always drop an item. Use the existing `rollLoot()` call with the same rarity selection logic (bruiser uses magic/common split, others stay the same).

**Potion:** unchanged for elites.

---

## Zone visual colors — `RenderSystem.createZoneVisuals()`

Extend the per-zone color branches to add cases for `ashveil` (floor `0x2a2018`, patches `0x4a2e1a`) and `deepmire` (floor `0x0f1a0f`, patches `0x1a2e1a`) using the same pattern as existing branches.

---

## Files changed

| File | Change |
|------|--------|
| `src/gameplay/types.ts` | `ZoneId` extended; `EliteModifier` added; `SpawnDefinition.elite?` added; `EncounterDefinition.chestX/Y?` added; `ActorState.isElite?` and `eliteModifier?` added |
| `src/content/zones.ts` | `ashveil` and `deepmire` definitions added; crossroads → ashveil transition added |
| `src/systems/ZoneSystem.ts` | `spawnEnemy()` gains `elite?` parameter and applies modifiers; level scaling extended; `spawnZone()` chest coords use `chestX/Y` from encounter |
| `src/systems/CombatSystem.ts` | `handleDeath()`: calls `triggerVolatileExplosion()` for volatile elites; `dropRewards()` in LootSystem receives `target.isElite` |
| `src/systems/LootSystem.ts` | `dropRewards()`: elite gold ×1.5 (Math.round) and forced item drop |
| `src/systems/RenderSystem.ts` | `createZoneVisuals()`: color branches for ashveil and deepmire |

---

## Out of scope

- New enemy type definitions
- Procedural/random elite spawning
- Elite-specific AI behaviors beyond stat modifiers
- Visual explosion effect for volatile (damage only; no ring visual)
- Generalising the boss death message
