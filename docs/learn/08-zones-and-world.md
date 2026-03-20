# Zones and World — Map Areas, Encounters, and Transitions

---

## What is a zone?

A **zone** is a named map area with:
- A fixed pixel size (the "world")
- Fixed spawn positions for enemies (grouped into encounters)
- Exit portals that lead to other zones

The game currently has three zones:

| Zone | ID | Size | Description |
|------|----|------|-------------|
| Ruined Crossroads | `crossroads` | 1800×1200 | The starting zone; three enemy packs |
| Warden Arena | `arena` | 1200×960 | Boss zone; one encounter with the Warden |
| Blighted Hollow | `hollow` | 1600×1400 | Side zone; poison and frost enemies |

---

## Zone definitions

**File: `src/content/zones.ts`**

```typescript
interface ZoneDefinition {
  id: ZoneId;
  name: string;
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };  // where the player appears on entry
  encounters: EncounterDefinition[];       // enemy groups
  transitions: ZoneTransition[];           // exit portals
}
```

### Encounters

```typescript
interface EncounterDefinition {
  id: string;            // unique name like "crossroads-west-pack"
  zoneId: ZoneId;
  spawns: SpawnDefinition[];   // list of enemies with positions
  chest?: boolean;       // whether to also spawn a chest pickup
}
```

### Zone transitions

```typescript
interface ZoneTransition {
  toZoneId: ZoneId;
  x: number;            // position on the map where the portal is
  y: number;
  width: number;        // portal size (a rectangle)
  height: number;
  targetX: number;      // where the player appears in the destination zone
  targetY: number;
  label: string;
}
```

---

## Map of connections

```
[Ruined Crossroads]
        │
        ├──► [Warden Arena]   (right edge of Crossroads)
        │
        └──► [Blighted Hollow] (bottom edge of Crossroads)
```

Both Arena and Hollow have a transition back to Crossroads.

---

## Zone loading sequence

**File: `src/systems/ZoneSystem.ts`, `spawnZone()`**

When entering a zone:

1. Set `ctx.activeZoneId` and `ctx.player.zoneId`
2. Loop through all encounters in the zone definition
3. Skip encounters in `ctx.clearedEncounterIds` (already beaten)
4. Call `spawnEnemy()` for each spawn in the encounter
5. If the encounter has `chest: true`, call `spawnChest()`

```typescript
spawnZone(zoneId) {
  ctx.activeZoneId = zoneId;
  for (const encounter of zoneDefinitions[zoneId].encounters) {
    if (ctx.clearedEncounterIds.has(encounter.id)) continue;

    for (const spawn of encounter.spawns) {
      spawnEnemy(spawn.enemyId, spawn.x, spawn.y, encounter);
    }
    if (encounter.chest) {
      spawnChest(encounter.id, chestX, chestY);
    }
  }
}
```

After spawning, two more calls happen:
- `render.createZoneVisuals()` — draws the ground floor and zone boundary
- `render.syncActorViews()` — creates Phaser game objects for every actor in `ctx.actors`

---

## Zone transitions — how the player moves between zones

**File: `src/systems/ZoneSystem.ts`, `checkTransitions()` — called every frame**

```typescript
checkTransitions() {
  for (const transition of zoneDefinitions[ctx.activeZoneId].transitions) {
    const p = ctx.player;
    const inside =
      p.x >= transition.x &&
      p.x <= transition.x + transition.width &&
      p.y >= transition.y &&
      p.y <= transition.y + transition.height;

    if (inside) {
      transitionToZone(transition.toZoneId, transition.targetX, transition.targetY);
      return;
    }
  }
}
```

There is no loading screen, no button — you simply walk into the transition rectangle and you instantly appear in the other zone.

### transitionToZone()

```typescript
transitionToZone(zoneId, x, y) {
  clearZoneState();        // destroy all Phaser objects for the current zone
  ctx.activeZoneId = zoneId;
  ctx.player.zoneId = zoneId;
  ctx.player.x = x;
  ctx.player.y = y;
  ctx.player.moveTarget = undefined;
  ctx.player.targetId = undefined;

  spawnZone(zoneId);
  render.createZoneVisuals();
  render.syncActorViews();
  autosave();
}
```

---

## Clearing zones

When the last enemy in an encounter dies, `CombatSystem.handleDeath()` checks:

```typescript
const aliveInEncounter = [...ctx.actors.values()].some(
  (actor) => actor.alive && actor.encounterId === encounterId
);
if (!aliveInEncounter) {
  ctx.clearedEncounterIds.add(encounterId);
}
```

Cleared encounter IDs are part of the save file. When you re-enter a zone after clearing encounters, those enemy groups simply do not spawn.

---

## Zone cleanup — clearZoneState()

When leaving a zone, all runtime objects for that zone are destroyed:

- All actors except the player
- All projectiles
- All hazards
- All pickups
- All attack effects and visual pulses
- All pending scheduled timers (e.g. an in-flight Fire Bomb's delayed explosion)

This prevents memory leaks and ensures the new zone starts clean.

---

## The minimap

The minimap in the top-right corner shows:
- The zone boundary
- The player's position (white dot)
- All alive enemies in the zone (coloured dots)

It is updated every frame in `RenderSystem.refreshRenderState()`. The minimap is implemented as a set of tiny Phaser `Shape` objects positioned at scaled-down versions of world coordinates.
