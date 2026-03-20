# The Combat System — Damage, Status Effects, and Death

---

## Overview

All damage in the game flows through one function: `CombatSystem.applyDamage()`. Whether it is a basic attack, a skill, a projectile, a hazard pool, a burn tick, or a poison tick — everything calls `applyDamage`.

**File: `src/systems/CombatSystem.ts`**

---

## The damage formula

```typescript
applyDamage(source, target, min, max, damageType, silent = false) {
  // 1. Roll damage
  const rolled = Phaser.Math.Between(min, max);

  // 2. Check crit
  const crit = Math.random() < source.stats.critChance;

  // 3. Add stat bonus (small bonus from attacker's stats)
  let amount = rolled + (
    damageType === "physical" ? source.stats.physicalDamageMin / 6 :
    damageType === "fire"     ? source.stats.fireDamageMin / 4     :
                                source.stats.physicalDamageMin / 5
  );

  // 4. Apply crit multiplier
  if (crit) amount *= source.stats.critMultiplier;

  // 5. Apply target's resistance / armor
  if (damageType === "physical") {
    amount = amount * (1 - Clamp(target.stats.physicalResistance, 0, 0.75));
    amount -= target.stats.armor * 0.25;
  } else if (damageType === "fire") {
    amount = amount * (1 - Clamp(target.stats.fireResistance, 0, 0.75));
  } else {  // poison
    amount = amount * (1 - Clamp(target.stats.poisonResistance, 0, 0.75));
  }

  // 6. Minimum 1 damage, always a whole number
  amount = Math.max(1, Math.round(amount));

  // 7. Apply to target
  target.health = Math.max(0, target.health - amount);
```

### Key points

- **The minimum rolled is always at least 1** — you can never do 0 damage
- **Resistances cap at 75%** — even with maxed fire resistance, fire still deals 25% damage
- **Physical armor** reduces physical damage by `armor * 0.25` after resistance
- **Crits** multiply the entire damage value by `critMultiplier` (default 1.6×)

### Example calculation

Player basic attacks a Scavenger Rusher (armor 5, physicalResistance 3%):
1. Roll: `Between(8, 12)` = 10
2. Stat bonus: `physicalDamageMin / 6` = `8 / 6` ≈ 1.3
3. Total before reduction: ≈ 11.3
4. Resistance reduction: `11.3 * (1 - 0.03)` ≈ 10.96
5. Armor reduction: `10.96 - (5 * 0.25)` = `10.96 - 1.25` ≈ 9.71
6. Final: `Math.round(9.71)` = **10 damage**

---

## The three damage types

| Type | Blocked by | Applied by |
|------|-----------|-----------|
| `physical` | `physicalResistance` + `armor * 0.25` | Basic attack, Cleave Shot, Frost Nova, bruiser melee |
| `fire` | `fireResistance` | Fire Bomb hazard, cultist/boss projectiles, burn ticks |
| `poison` | `poisonResistance` | Venom Shot projectile, poison ticks, Plague Stalker |

---

## Floating damage numbers

Every call to `applyDamage` spawns a floating text above the target:

```typescript
const color = damageType === "fire" ? "#ff9d73" :
              damageType === "poison" ? "#8bef6a" : "#f0e6d2";
const fontSize = crit ? 18 : 14;
this.render.spawnFloatingText(target.x, target.y - radius - 8,
  `${crit ? "CRIT " : ""}${amount}`, color, fontSize);
```

Crits also shake the camera slightly.

---

## Basic attack

**Triggered by:** clicking an enemy or targeting one

```typescript
performBasicAttack(target, time) {
  player.attackCooldownUntil = time + (450 / Math.max(0.65, player.stats.attackSpeed));
  applyDamage(player, target, player.stats.physicalDamageMin, player.stats.physicalDamageMax, "physical");
  render.spawnBasicAttackEffect(target, time);
}
```

The base cooldown is 450 ms. Higher `attackSpeed` reduces this cooldown (minimum ~300 ms at 1.5× speed).

---

## Status effects

### Burn (fire DoT)

Applied by Fire Bomb and enemy fire projectile hits.

```typescript
applyBurn(target, time, damageMin, damageMax, sourceId) {
  target.status.burningUntil = time + 3200;      // lasts 3.2 seconds
  target.status.burnDamageMin = Math.max(existing, damageMin);  // takes the higher value
  target.status.burnDamageMax = Math.max(existing, damageMax);
  target.status.nextBurnTickAt = time + 1000;    // first tick in 1 second
  target.status.burnSourceId = sourceId;
}
```

**Tick processing** (every frame, in `updateBurning()`):

```typescript
if (actor.alive && actor.status.burningUntil > time && actor.status.nextBurnTickAt <= time) {
  actor.status.nextBurnTickAt = time + 1000;     // tick every 1 second
  applyDamage(source, actor, burnMin, burnMax, "fire", /*silent=*/true);
}
```

"Silent" means no combat log entry for each tick — only the initial hit logs.

### Poison (poison DoT)

Applied by Venom Shot and Plague Stalker contact.

```typescript
applyPoison(target, time, damageMin, damageMax, sourceId) {
  target.status.poisonedUntil = time + 4000;    // lasts 4 seconds
  // ticks every 1.2 seconds
}
```

Works identically to burn but uses poison resistance instead of fire resistance.

### Chill (slow debuff)

Applied by Frost Nova and Frost Wraith projectiles.

```typescript
applyChill(target, time, factor) {
  target.status.chilledUntil = time + 3000;     // lasts 3 seconds
  target.status.chillFactor = Math.min(0.6, Math.max(existing, factor));
}
```

The chill factor (0–0.6) reduces the target's move speed and attack speed:

- For enemies: `effectiveSpeed = stats.moveSpeed * (1 - chillFactor)`
- For the player (from Frost Nova AoE splash): same calculation
- Chilled enemies' attack cooldowns are extended: `effectiveCooldown = base * (1 + chillFactor)`

Maximum chill is 60% slow.

---

## Hazards (ground effects)

Hazards are persistent damage zones — circular areas on the ground that deal damage every N milliseconds.

**Created by:** Fire Bomb skill, and the boss in phase 2

```typescript
createHazard(x, y, radius, expiresAt, tickEveryMs, damageMin, damageMax, damageType?) {
  ctx.hazards.set(uuid(), {
    x, y, radius, expiresAt, tickEveryMs,
    nextTickAt: time + 120,
    damageMin, damageMax, damageType,
  });
}
```

**Processing** (in `updateHazards()` every frame):

```typescript
for each hazard:
  if hazard has expired → destroy it
  if it's time for the next tick:
    nextTickAt = time + tickEveryMs

    // damage all enemies in the hazard radius
    for each nearby enemy: applyDamage(player, enemy, ...)

    // also damage the player if standing in the hazard
    applyDamage(boss, player, ...)
```

Fire hazards also apply burn on each tick.

---

## Projectiles

Projectiles are moving objects that deal damage on collision.

**File: `src/systems/CombatSystem.ts`, `updateProjectiles()`**

Every frame, each projectile:
1. Moves: `x += vx * (delta / 1000)`, `y += vy * (delta / 1000)`
2. Checks for collision with any actor of the opposing faction
3. On hit: applies damage (and possibly a status effect), then is destroyed
4. If it leaves the zone bounds or expires: is destroyed

---

## Death

```typescript
handleDeath(source, target) {
  target.alive = false;
  target.health = 0;
  target.targetId = undefined;
  target.moveTarget = undefined;
  target.deathAnimatedUntil = time + 1200;  // fades out over 1.2 seconds

  if (target.faction === "enemy") {
    gainXp(definition.xpReward);
    loot.dropRewards(target, definition.id);  // gold, maybe potion, maybe item
    // check if the encounter is now fully cleared
    const aliveInEncounter = [...actors.values()].some(
      (a) => a.alive && a.encounterId === target.encounterId
    );
    if (!aliveInEncounter) ctx.clearedEncounterIds.add(encounterId);
  } else {
    // player died
    ctx.overlayRect.setFillStyle(0x000000, 0.42);  // darken screen
    // "YOU DIED" menu appears via bootstrap's render loop
  }
}
```

### After player death

The game pauses (player is no longer alive, so `update()` returns early). The sidebar detects `!snapshot.player.alive` and shows the "YOU DIED" screen with options:

- **Respawn** — places the player at the zone spawn point with full health, keeps items and progress
- **Load Last Save** — restores the last autosave from localStorage
- **New Game** — wipes all state and starts fresh

---

## Potions

```typescript
consumePotion() {
  if (inventory.potions <= 0) { log("No health tonics left."); return; }
  if (player.health >= maxHealth - 2) { log("Already full."); return; }
  inventory.potions -= 1;
  player.health = Math.min(maxHealth, player.health + 64);  // +64 flat HP
}
```

Potions restore 64 HP flat. They do not scale with level — later levels you will need multiple or better gear.
