# The Player Character — Creation, Stats, and Movement

---

## Who is the player?

The player character is called **Soldier-Alchemist**. They exist in the game as an `ActorState` object stored at `ctx.player`. "Actor" is the game's term for any character — player, enemy, or neutral — because they all share the same data shape.

---

## ActorState — the data shape of every character

**File: `src/gameplay/types.ts`**

```typescript
interface ActorState {
  id: string;              // unique ID, "player" for the player
  name: string;            // display name
  faction: "player" | "enemy" | "neutral";
  x: number;               // world position (pixels)
  y: number;
  radius: number;          // collision/visual size (pixels)
  color: number;           // hex colour for rendering
  level: number;
  stats: StatBlock;        // all stats (health, damage, etc.)
  health: number;          // current health
  energy: number;          // current energy (for skills)
  alive: boolean;
  targetId?: string;       // ID of the enemy to auto-attack
  moveTarget?: { x, y };  // ground point to walk toward
  zoneId: ZoneId;          // which zone this actor is in
  aiState?: "idle" | "chase" | "attack" | ...;  // only used by enemies
  attackCooldownUntil: number;  // timestamp when next attack is allowed
  status: StatusState;     // burn, poison, chill timers
  isBoss?: boolean;
}
```

The player is created in `GameScene.restoreOrStart()` like this:

```typescript
this.ctx.player = {
  id: "player",
  name: "Soldier-Alchemist",
  faction: "player",
  x: save?.player.x ?? zoneDefinitions["crossroads"].playerSpawn.x,  // 240
  y: save?.player.y ?? zoneDefinitions["crossroads"].playerSpawn.y,  // 680
  radius: 18,
  color: 0xd9d4ca,  // light grey
  level: 1,
  stats: this.combat.buildPlayerStats(),
  health: playerStats.maxHealth,
  energy: playerStats.maxEnergy,
  alive: true,
  ...
};
```

---

## StatBlock — all the numbers

**File: `src/gameplay/types.ts`**

```typescript
interface StatBlock {
  maxHealth: number;
  healthRegen: number;       // HP recovered per second
  maxEnergy: number;
  energyRegen: number;       // energy recovered per second
  armor: number;             // reduces incoming physical damage
  moveSpeed: number;         // pixels per second
  attackSpeed: number;       // multiplier on basic attack speed
  physicalDamageMin: number;
  physicalDamageMax: number;
  fireDamageMin: number;
  fireDamageMax: number;
  critChance: number;        // 0.08 = 8% chance to crit
  critMultiplier: number;    // 1.6 = crits deal 160% damage
  physicalResistance: number; // 0.05 = 5% damage reduction
  fireResistance: number;
  poisonResistance: number;
}
```

### Player base stats (level 1, no gear)

Defined in `CombatSystem.ts`:

| Stat | Value |
|------|-------|
| Max Health | 160 |
| Health Regen | 1.2 / sec |
| Max Energy | 80 |
| Energy Regen | 5.5 / sec |
| Armor | 10 |
| Move Speed | 328 px/sec |
| Physical Damage | 8–12 |
| Fire Damage | 2–4 |
| Crit Chance | 8% |
| Crit Multiplier | 1.6× |

### How stats are calculated

**File: `src/systems/CombatSystem.ts`, `buildPlayerStats()`**

Player stats are always computed fresh from three sources:

```
finalStats = baseStats + levelBonus + sum(equipped item stats)
```

1. **Base stats** — the fixed `PLAYER_BASE_STATS` constant
2. **Level bonus** — flat bonuses that scale with level:
   - +24 max health per level
   - +10 max energy per level
   - +3 armor per level
   - +1–2 physical damage per level
   - +1–2 fire damage per level
   - +3 move speed per level
3. **Equipment bonuses** — every stat on every equipped item is added

This is done with `addStats()` from `src/gameplay/stats.ts` — it simply adds all `StatBlock` objects together field by field.

---

## Movement — how the player moves

**File: `src/scenes/GameScene.ts`, `updatePlayer()` — called every frame**

The player has two movement modes: **keyboard (WASD)** and **click-to-move**. Keyboard always wins.

### WASD movement

```typescript
const moveVector = new Phaser.Math.Vector2(
  (D.isDown ? 1 : 0) - (A.isDown ? 1 : 0),  // -1, 0, or +1
  (S.isDown ? 1 : 0) - (W.isDown ? 1 : 0),
);

if (moveVector.lengthSq() > 0) {
  moveVector.normalize().scale(effectiveMoveSpeed * (delta / 1000));
  player.x += moveVector.x;
  player.y += moveVector.y;
  player.moveTarget = undefined;  // cancel any click-to-move
  player.targetId = undefined;    // cancel any locked target
}
```

**Normalizing** the vector is the key step — if you press W and D at the same time, the raw vector is `(1, -1)` which has length √2 ≈ 1.41. Without normalizing, diagonal movement would be 41% faster than straight movement. After normalizing, the length becomes exactly 1, then you scale it to the desired speed.

### Chill slows movement

If the player is chilled (from a Frost Wraith's projectile or their own Frost Nova reflected), the move speed is reduced:

```typescript
const chillMult = player.status.chilledUntil > time ? 1 - player.status.chillFactor : 1;
const effectiveMoveSpeed = player.stats.moveSpeed * chillMult;
```

### Click-to-move

When the player left-clicks on empty ground, `player.moveTarget = { x, y }` is set. Every frame:

```typescript
if (player.targetId) {
  // chasing a targeted enemy
  const distance = Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y);
  if (distance > range * 0.86) {
    moveActorTowards(player, target.x, target.y, speed, delta, zone.width, zone.height);
  } else {
    // close enough — attack
    this.combat.performBasicAttack(target, time);
  }
} else if (player.moveTarget) {
  const arrived = moveActorTowards(player, moveTarget.x, moveTarget.y, speed, delta, ...);
  if (arrived) player.moveTarget = undefined;
}
```

### moveActorTowards()

**File: `src/gameplay/movement.ts`**

```typescript
function moveActorTowards(actor, x, y, speed, delta, zoneW, zoneH): boolean {
  const direction = new Vector2(x - actor.x, y - actor.y);
  const distance = direction.length();
  if (distance <= 4) {
    actor.x = x; actor.y = y;
    return true;  // arrived!
  }
  direction.normalize().scale(speed * (delta / 1000));
  actor.x = Clamp(actor.x + direction.x, 16, zoneW - 16);
  actor.y = Clamp(actor.y + direction.y, 16, zoneH - 16);
  return false;
}
```

`Clamp` keeps the actor 16 pixels away from the zone edges — a simple boundary system.

---

## Health and energy regeneration

Every frame in `updatePlayer()`:

```typescript
player.health = Clamp(
  player.health + player.stats.healthRegen * (delta / 1000),
  0,
  player.stats.maxHealth
);
player.energy = Clamp(
  player.energy + player.stats.energyRegen * (delta / 1000),
  0,
  player.stats.maxEnergy
);
```

At base stats: health regenerates at 1.2 HP/s, energy at 5.5 energy/s. Energy refills fast so you can use skills regularly.

---

## Clicking on enemies — targeting

When the player left-clicks:

```typescript
const clickedEnemy = getNearestEnemy(ctx.actors, zoneId, pointer.worldX, pointer.worldY, 28);
if (clickedEnemy) {
  ctx.player.targetId = clickedEnemy.id;
  ctx.player.moveTarget = undefined;
}
```

`getNearestEnemy` finds the closest alive enemy within 28 px of the click point (plus the enemy's radius). If found, the player locks onto that enemy and walks toward them, auto-attacking when in range.

---

## Leveling up

When an enemy dies, `CombatSystem.gainXp()` is called. Level thresholds are:

```typescript
LEVEL_THRESHOLDS = [0, 70, 180, 360, 580]
// level 1→2 at 70 XP, 2→3 at 180, 3→4 at 360, 4→5 at 580
```

On level up:
1. Level is incremented
2. `recalculatePlayerStats(true)` is called — stats are rebuilt and health/energy are fully restored
3. A "Level X" floating text appears
4. Camera shakes briefly
5. An autosave is triggered

---

## Autosave

The game saves to `localStorage` automatically:
- Every 4 seconds while playing
- After each level up
- After each boss kill
- After equipping an item
- When transitioning to a new zone

Save data is stored as JSON under a fixed key. On next load, `restoreOrStart()` checks `localStorage` and restores all state.
