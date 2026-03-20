# Enemies and AI — How NPCs Think and Move

---

## Two layers: definition vs. instance

Every enemy type is described by an **`EnemyDefinition`** — a static data record that never changes during gameplay. When an enemy is actually spawned into the world, an **`ActorState`** is created — a live runtime object that tracks position, health, and AI state.

Think of `EnemyDefinition` as the "blueprint" and `ActorState` as the "living creature".

---

## Enemy definitions

**File: `src/content/enemies.ts`**

Six enemy types exist:

| ID | Name | Archetype | Health | Notes |
|----|------|-----------|--------|-------|
| `scavenger` | Scavenger Rusher | rusher | 48 | Fast melee attacker |
| `cultist` | Ash Cultist | ranged | 42 | Fires fire projectiles, kites (backs away) |
| `bruiser` | Grave Bruiser | bruiser | 92 | Slow but hard-hitting melee, knocks player back |
| `warden` | Warden Alchemist | boss | 340 | Ranged, two-phase, drops hazards |
| `plagueStalker` | Plague Stalker | rusher | 56 | Fast melee, applies poison on hit |
| `frostWraith` | Frost Wraith | ranged | 38 | Fires chill projectiles, kites |

### What EnemyDefinition contains

```typescript
interface EnemyDefinition {
  id: string;
  name: string;
  archetype: "rusher" | "ranged" | "bruiser" | "boss";
  color: number;             // display colour (hex)
  radius: number;            // circle size in pixels
  baseStats: StatBlock;      // stats at level 1
  xpReward: number;          // XP the player gains on kill
  contactDamageMin: number;  // damage on melee hit / projectile
  contactDamageMax: number;
  attackRange: number;       // pixels — how far away they can attack
  attackCooldownMs: number;  // milliseconds between attacks
}
```

---

## Spawning enemies

**File: `src/systems/ZoneSystem.ts`, `spawnEnemy()`**

When a zone is loaded, each encounter in the zone definition calls `spawnEnemy()`:

```typescript
spawnEnemy(enemyId, x, y, encounter) {
  const definition = enemyDefinitions[enemyId];
  const level = calculateLevel(encounter.zoneId, ctx.level);
  const stats = scaleStatsForLevel(definition.baseStats, level);

  const actor: ActorState = {
    id: `${enemyId}-${uuid()}`,
    definitionId: definition.id,
    name: definition.name,
    faction: "enemy",
    x, y,
    radius: definition.radius,
    level,
    stats,
    health: stats.maxHealth,
    alive: true,
    zoneId: encounter.zoneId,
    encounterId: encounter.id,
    aiState: "idle",
    ...
  };

  ctx.actors.set(actor.id, actor);
}
```

### Level scaling

Enemy difficulty scales with the player's current level:

- Crossroads enemies: player level (minimum 1)
- Arena enemies: player level + 0, boss gets +1 (minimum 2)
- Hollow enemies: player level (minimum 2)

`scaleStatsForLevel()` applies a multiplier to health, damage, and armor:

```
multiplier = 1 + (level - 1) * 0.18

e.g. level 3 → multiplier = 1.36 → 36% more health and damage
```

---

## AI loop — how enemies decide what to do

**File: `src/systems/AISystem.ts`, `updateEnemies()` — called every frame**

For each alive enemy in the current zone:

### Step 1 — Measure distance to player

```typescript
const distance = Phaser.Math.Distance.Between(actor.x, actor.y, ctx.player.x, ctx.player.y);
const aggroRange = definition.archetype === "boss" ? 380 : 260;
```

### Step 2 — Change AI state based on distance

```typescript
if (distance <= aggroRange) {
  actor.aiState = "chase";   // player is close enough, engage
} else if (distance > aggroRange + 80) {
  actor.aiState = "idle";    // player is far away, stop caring
}
```

The `+ 80` prevents flickering between idle and chase when the player is right on the boundary.

### Step 3 — Boss phase transition

```typescript
if (definition.archetype === "boss" && actor.phase === 1
    && actor.health <= actor.stats.maxHealth * 0.5) {
  actor.phase = 2;
  // spawn two minions:
  zone.spawnEnemy("scavenger", actor.x - 80, actor.y + 110, ...);
  zone.spawnEnemy("cultist",   actor.x + 90, actor.y - 90,  ...);
}
```

At 50% health, the Warden Alchemist enters phase 2 and summons reinforcements. This only happens once (`phaseTwoSummoned` flag).

### Step 4 — Attack if in range and cooldown expired

```typescript
if (distance <= definition.attackRange && time >= actor.attackCooldownUntil) {
  actor.attackCooldownUntil = time + effectiveCooldown;

  if (definition.archetype === "ranged" || definition.archetype === "boss") {
    fireEnemyProjectile(actor, definition);  // fire a projectile
    if (boss phase 2) {
      combat.createHazard(player.x, player.y, ...);  // drop a fire pool
    }
  } else {
    combat.applyDamage(actor, player, ...);  // melee hit
    if (definition.archetype === "bruiser") {
      pushActor(player, actor.x, actor.y, 24, ...);  // knockback
    }
    if (definition.id === "plagueStalker") {
      combat.applyPoison(player, time, 2, 4, actor.id);  // poison on hit
    }
  }
}
```

### Step 5 — Move if chasing

```typescript
else if (actor.aiState === "chase") {
  if (definition.archetype === "ranged" && distance < 140) {
    // ranged enemies kite — back away when player gets too close
    moveActorAway(actor, player.x, player.y, speed * 0.9, delta, ...);
  } else {
    moveActorTowards(actor, player.x, player.y, speed, delta, ...);
  }
}
```

### Step 6 — Health regen

```typescript
actor.health = Clamp(actor.health + actor.stats.healthRegen * (delta / 1000), 0, maxHealth);
```

Most enemies have 0 regen, so this does nothing for them. The Bruiser has 0.2/s and the Warden has 0.35/s.

---

## Archetype behaviour summary

| Archetype | Movement | Attack style | Special |
|-----------|----------|-------------|---------|
| **rusher** | Charges directly at player | Melee contact | Some apply poison |
| **ranged** | Kites (moves away when < 140 px) | Fires projectiles | Cultist fires fire; Frost Wraith fires chill |
| **bruiser** | Slow walk toward player | Melee contact | Knockback push on hit |
| **boss** | Walks toward player | Fires projectiles + drops hazards | Phase 2 at 50% HP |

---

## Enemy projectiles

**File: `src/systems/AISystem.ts`, `fireEnemyProjectile()`**

```typescript
const angle = Phaser.Math.Angle.Between(actor.x, actor.y, player.x, player.y);
const speed = definition.archetype === "boss" ? 240 : 210;

const projectile = {
  id: uuid(),
  x: actor.x, y: actor.y,
  vx: Math.cos(angle) * speed,   // x velocity (pixels/sec)
  vy: Math.sin(angle) * speed,   // y velocity (pixels/sec)
  faction: "enemy",
  damageMin: definition.contactDamageMin,
  damageMax: definition.contactDamageMax,
  damageType: isFrostWraith ? "physical" : "fire",
  expiresAt: time + 4000,
  appliesChill: isFrostWraith,   // special flag for Frost Wraith
};

ctx.projectiles.set(projectile.id, projectile);
```

The projectile travels in a straight line and hits either the player or expires after 4 seconds.

- **Cultist / Boss projectiles**: fire type, apply burn on hit
- **Frost Wraith projectiles**: physical type, apply chill on hit (slows movement and attack speed)

---

## Encounters

Enemies in each zone are grouped into **encounters** — named packs. An encounter is "cleared" when every enemy in it dies. Once cleared, the encounter ID is saved and those enemies do not respawn when you re-enter the zone.

Cleared encounters are stored in `ctx.clearedEncounterIds` (a `Set<string>`), persisted in the save file, and checked in `ZoneSystem.spawnZone()`:

```typescript
for (const encounter of zoneDefinitions[zoneId].encounters) {
  if (ctx.clearedEncounterIds.has(encounter.id)) {
    continue;  // already cleared, skip
  }
  // ... spawn enemies
}
```
