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

The two new zones form a harder linear progression off the Crossroads. Deepmire is a dead end — no onward transition — forcing full engagement before backtracking.

---

## New Zone 1 — Ashveil Descent

| Property | Value |
|----------|-------|
| ID | `ashveil` |
| Name | Ashveil Descent |
| Size | 1600 × 1200 |
| Theme | Collapsed mine, ash and fire |
| Difficulty | Medium (recommended level 3–4) |

**Connections:**
- Left edge ← back to Ruined Crossroads
- Right edge → Deepmire Caverns

**Encounters (3 total, 1 with chest):**

| Encounter ID | Spawns | Chest |
|---|---|---|
| `ashveil-entrance-pack` | 2× scavenger, 1× cultist, 1× cultist (armored elite) | No |
| `ashveil-mid-pack` | 2× bruiser, 1× plagueStalker (frenzied elite) | Yes |
| `ashveil-deep-pack` | 1× bruiser (volatile elite), 2× cultist, 1× scavenger | No |

---

## New Zone 2 — Deepmire Caverns

| Property | Value |
|----------|-------|
| ID | `deepmire` |
| Name | Deepmire Caverns |
| Size | 1800 × 1400 |
| Theme | Deep swamp cave, poison and cold |
| Difficulty | Hard (recommended level 5+) |

**Connections:**
- Left edge ← back to Ashveil Descent
- No onward transition (dead end)

**Encounters (3 total, 2 with chest):**

| Encounter ID | Spawns | Chest |
|---|---|---|
| `deepmire-stalker-pack` | 3× plagueStalker, 1× plagueStalker (empowered elite) | Yes |
| `deepmire-wraith-pack` | 2× frostWraith (armored elite), 1× frostWraith, 1× bruiser | No |
| `deepmire-boss-pack` | 1× bruiser (regenerating elite), 2× plagueStalker, 1× cultist (frenzied elite) | Yes |

---

## Elite enemy system

### Data model

`SpawnDefinition` gains an optional `elite` field:

```typescript
export interface SpawnDefinition {
  enemyId: string;
  x: number;
  y: number;
  elite?: EliteModifier;
}

export type EliteModifier =
  | "frenzied"
  | "armored"
  | "volatile"
  | "regenerating"
  | "empowered";
```

### Stat modifiers applied at spawn

| Modifier | Health | Damage | Other |
|----------|--------|--------|-------|
| frenzied | ×1.6 | ×1.2 | attackCooldownMs ×0.6 (faster attacks) |
| armored | ×1.6 | ×1.2 | armor ×1.6, all resistances +15% |
| volatile | ×1.6 | ×1.2 | explodes on death (60px AoE, 8–14 physical dmg) |
| regenerating | ×1.6 | ×1.2 | healthRegen +3/sec |
| empowered | ×1.6 | ×1.35 | — |

All elites: radius +3, name prefixed (e.g. `"Frenzied Grave Bruiser"`).

### Visual distinction

Elite body color is brightened: `color | 0x404040`. Name label is unchanged — the modified name already communicates elite status.

### Loot bonus

Elite kills always drop an item (overrides the normal 28%/48% chance). Gold drop amount ×1.5.

### `ActorState` additions

```typescript
isElite?: boolean;
eliteModifier?: EliteModifier;
```

### Volatile explosion

When a volatile elite dies, `CombatSystem.handleDeath()` checks `actor.eliteModifier === "volatile"` and calls a new `triggerVolatileExplosion(actor)` helper that applies `applyDamage()` to all player-faction actors within 60px.

---

## Files changed

| File | Change |
|------|--------|
| `src/gameplay/types.ts` | Add `EliteModifier` type; add `elite?` to `SpawnDefinition`; add `isElite?`, `eliteModifier?` to `ActorState` |
| `src/content/zones.ts` | Add `ashveil` and `deepmire` zone definitions; add `ZoneId` union values; add transition from crossroads → ashveil |
| `src/systems/ZoneSystem.ts` | Apply elite modifiers in `spawnEnemy()` when `spawn.elite` is set |
| `src/systems/CombatSystem.ts` | `handleDeath()`: volatile explosion; `dropRewards()`: elite loot bonus |
| `src/systems/RenderSystem.ts` | `syncActorViews()`: brightened color for elites |

---

## Out of scope

- New enemy type definitions (can be added later as pure content)
- Procedural/random elite spawning
- Elite-specific AI behaviors beyond stat modifiers
- New damage types or status effects
