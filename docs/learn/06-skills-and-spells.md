# Skills and Spells — How the Player's Abilities Work

---

## Overview

The player has one passive ability (Basic Attack) and four active skills. Active skills cost energy and have cooldowns.

**File: `src/systems/SkillSystem.ts`**
**Definitions: `src/content/skills.ts`**

---

## Skill definitions

```typescript
interface SkillDefinition {
  id: SkillId;
  name: string;
  cooldownMs: number;   // milliseconds before the skill can be used again
  energyCost: number;   // energy drained on use
  range: number;        // maximum reach in pixels
  targetMode: "enemy" | "ground" | "self";
  description: string;
}
```

| Key | 1 | 2 | 3 | 4 |
|-----|---|---|---|---|
| **Name** | Cleave Shot | Fire Bomb | Frost Nova | Venom Shot |
| **Cooldown** | 3.2 s | 5.2 s | 4.0 s | 3.8 s |
| **Energy cost** | 12 | 20 | 18 | 14 |
| **Range** | 150 px | 220 px | 120 px | 200 px |
| **Target mode** | enemy/forward arc | ground | self (all around) | enemy/direction |

---

## Resource gate

Before any skill fires, `hasSkillResources()` checks:

```typescript
hasSkillResources(skillId) {
  const cooldownUntil = ctx.skillCooldowns[skillId] ?? 0;
  if (cooldownUntil > ctx.scene.time.now) {
    log(`${skill.name} is still on cooldown.`);
    return false;
  }
  if (ctx.player.energy < skill.energyCost) {
    log(`Not enough energy for ${skill.name}.`);
    return false;
  }
  return true;
}
```

On success, the skill deducts energy and records the cooldown:

```typescript
ctx.player.energy -= skill.energyCost;
ctx.skillCooldowns[skillId] = ctx.scene.time.now + skill.cooldownMs;
```

---

## Skill 1 — Cleave Shot (key: `1`)

**Type:** Instant AoE arc
**Targeting:** Frontal cone in the direction of the locked target or mouse cursor

```
Player position →───► cursor/target direction
         ╔══════════╗
         ║  38° arc ║  (enemies in here get hit)
         ╚══════════╝
```

**Code:**

```typescript
// Build a normalized vector toward the target/cursor
const facing = normalize(targetPoint - player);

// Check every enemy in the current zone
for each enemy in zone:
  const toEnemy = normalize(enemy.position - player);
  const distance = length(enemy - player);
  if (distance > 150) continue;  // out of range

  // dot product gives cosine of angle between directions
  const angle = degrees(acos(dot(facing, toEnemy)));
  if (angle <= 38) {
    applyDamage(player, enemy, physMin + 6, physMax + 9, "physical");
  }
```

**Damage:** Player physical damage + 6–9 bonus
**No projectile** — instant hits anything in the arc

---

## Skill 2 — Fire Bomb (key: `2`, right-click)

**Type:** Delayed ground hazard
**Targeting:** Aims at a world position (ground target mode)

```
[Player] ──throws──► [target point on ground]
         420ms delay...
         ╔══════════╗
         ║ fire pool ║  4.5 seconds, tick every 800ms
         ╚══════════╝
```

**Code:**

```typescript
tryCastFireBomb(x, y) {
  // Clamp target to max range (220 px from player)
  if (distance > range) {
    angle = atan2(y - player.y, x - player.x);
    targetX = player.x + cos(angle) * range;
    targetY = player.y + sin(angle) * range;
  }

  // Visual: expanding marker circle at target point
  const marker = scene.add.circle(targetX, targetY, 18, ...);
  tweens.add({ targets: marker, scale: 3.8, alpha: 0, duration: 420 });

  // Create hazard after 420ms delay
  const timer = scene.time.delayedCall(420, () => {
    combat.createHazard(
      targetX, targetY,
      radius: 68,
      expiresAt: time + 4500,
      tickEveryMs: 800,
      damageMin: player.fireDamageMin + 8,
      damageMax: player.fireDamageMax + 12,
    );
  });
}
```

**Why the delay?** It gives enemies (and the player!) a visual warning window to dodge out.

**Burn:** The hazard's fire damage also applies burn, so enemies inside keep taking fire damage for 3.2 seconds after leaving the pool.

---

## Skill 3 — Frost Nova (key: `3`)

**Type:** Instant self-centered AoE
**Targeting:** All enemies within 120 px of the player

```
         ╔══════════╗
         ║  120px   ║  ← expanding ring animation
         ║  radius  ║
         ╚══════════╝
         [Player is center]
```

**Code:**

```typescript
tryCastFrostNova() {
  const radius = 120;

  // Visual: animated expanding blue ring
  const ring = scene.add.circle(player.x, player.y, 20, 0x66bbff, 0.15);
  tweens.add({ targets: ring, scale: radius / 20, alpha: 0, duration: 350 });

  // Damage and chill all nearby enemies
  for each enemy in zone:
    const distance = dist(player, enemy);
    if (distance <= radius + enemy.radius) {
      applyDamage(player, enemy, physMin + 3, physMax + 5, "physical");
      applyChill(enemy, time, factor: 0.4);  // 40% slow for 3 seconds
    }
}
```

**Chill effect:** Enemies slow by 40% move speed and their attack cooldowns are extended by 40%.

**Use case:** An escape tool or crowd control — cast it when surrounded to slow everything chasing you.

---

## Skill 4 — Venom Shot (key: `4`)

**Type:** Projectile
**Targeting:** Fires toward the locked target or mouse cursor

```
[Player] ──► ──► ──► ──►[enemy]
             260 px/sec  poisons on hit
```

**Code:**

```typescript
tryCastVenomShot() {
  const angle = atan2(target.y - player.y, target.x - player.x);
  const speed = 260;

  const projectile = {
    x: player.x, y: player.y,
    vx: cos(angle) * speed,
    vy: sin(angle) * speed,
    damageType: "poison",
    damageMin: physMin + 4,
    damageMax: physMax + 6,
    expiresAt: time + 3000,  // despawns if it travels for 3 seconds
  };

  ctx.projectiles.set(projectile.id, projectile);
}
```

**On hit (in CombatSystem.updateProjectiles()):**

```typescript
if (projectile.damageType === "poison") {
  applyPoison(hitTarget, time, 3, 5, player.id);  // 4 seconds of poison
}
```

The projectile deals instant damage **plus** poisons the target. Poison ticks every 1.2 seconds for 4 seconds (about 3 ticks).

---

## Basic Attack (passive — no key)

Triggered automatically when:
1. The player clicks on an enemy (sets `player.targetId`)
2. The player is within range (145 px)
3. `time >= player.attackCooldownUntil`

```typescript
performBasicAttack(target, time) {
  player.attackCooldownUntil = time + (450 / Math.max(0.65, attackSpeed));
  applyDamage(player, target, physMin, physMax, "physical");
  render.spawnBasicAttackEffect(target, time);
}
```

The attack cooldown of 450ms is reduced by higher `attackSpeed` (from items). A high-attack-speed weapon can get this down to ~300ms.

---

## How cooldowns are tracked

Skill cooldowns are stored in `ctx.skillCooldowns`, a plain object:

```typescript
ctx.skillCooldowns = {
  cleaveShot: 12345,  // timestamp when it becomes available again
  fireBomb:   18000,
  // etc.
}
```

The HUD reads these values to draw the cooldown bar. The check is simply: `if (now < skillCooldowns[id]) → on cooldown`.

---

## Skill interaction with status effects

| Skill | Damage type | Status applied |
|-------|------------|----------------|
| Cleave Shot | Physical | None |
| Fire Bomb (hazard) | Fire | Burn (on both initial hit and per tick) |
| Frost Nova | Physical | Chill (40%, 3 seconds) |
| Venom Shot | Poison | Poison (3–5 per tick, 4 seconds) |
| Basic Attack | Physical | None |

The distinction: Frost Nova deals **physical** damage but applies a **non-damage debuff** (chill). This means physical-resistant enemies still slow down from it.
