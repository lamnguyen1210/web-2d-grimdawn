# Plan B: Combat Expansion — New Status Effects & Skills

## Goal
Deepen combat with poison/chill status effects and two new player skills.

## Changes

### 1. Poison Status Effect
- **Types:** Add `poisonedUntil`, `poisonDamageMin`, `poisonDamageMax`, `nextPoisonTickAt` to `StatusState`
- **CombatSystem:** Add `applyPoison()` and `updatePoison()` (ticks every 1.2s, physical damage, 4s duration)
- **RenderSystem:** Green pulsing stroke on poisoned actors
- **Source:** New enemy "Plague Stalker" (see Plan C) and new player skill "Venom Shot"

### 2. Chill Status Effect
- **Types:** Add `chilledUntil`, `chillFactor` (0.0–1.0 slow multiplier) to `StatusState`
- **CombatSystem:** Add `applyChill()` — slows moveSpeed and attackSpeed by chillFactor for 3s
- **Movement functions:** Check `chilledUntil` in movement.ts to apply slow (multiply speed by `1 - chillFactor`)
- **AI:** Enemy attack cooldown extended while chilled
- **RenderSystem:** Blue-ish tint on chilled actors
- **Source:** New enemy "Frost Wraith" (see Plan C) and new player skill "Frost Nova"

### 3. New Skill: Frost Nova (key 3)
- **Skill definition:** Self-targeted AoE, 4s cooldown, 18 energy, 120px radius
- **SkillSystem:** `tryCastFrostNova()` — damages + chills all enemies in radius around player
- **Effect:** Blue ring expanding outward (tween), chill for 3s at 0.4 factor
- **Damage:** player.fireDamageMin+3 to fireDamageMax+5 (cold/physical hybrid — uses physical type)
- **Input:** Key 3 in GameScene

### 4. New Skill: Venom Shot (key 4)
- **Skill definition:** Enemy-targeted ranged, 3.8s cooldown, 14 energy, 200px range
- **SkillSystem:** `tryCastVenomShot()` — fires a green projectile that poisons on hit
- **Projectile:** New `damageType: "poison"` handled in CombatSystem — applies poison on hit
- **Input:** Key 4 in GameScene

### 5. Type Updates
- Extend `DamageType` union: `"physical" | "fire" | "poison"`
- Extend `SkillId` union: add `"frostNova" | "venomShot"`
- Add poison/chill fields to `StatusState`
- Add `poisonResistance` to `StatBlock`

## Files Modified
- `src/gameplay/types.ts` — StatusState, DamageType, SkillId, StatBlock
- `src/gameplay/stats.ts` — add poisonResistance to createStatBlock/addStats/scaleStats
- `src/content/skills.ts` — add frostNova and venomShot definitions
- `src/systems/CombatSystem.ts` — applyPoison, applyChill, updatePoison, poison resistance in damage calc
- `src/systems/SkillSystem.ts` — tryCastFrostNova, tryCastVenomShot
- `src/systems/RenderSystem.ts` — poison/chill visual indicators, skill cooldowns in HUD
- `src/systems/AISystem.ts` — chill affects enemy AI speed/cooldowns
- `src/scenes/GameScene.ts` — key 3/4 bindings, updatePoison in game loop

## Verification
- `npx tsc --noEmit` passes
- Manual: Frost Nova chills enemies (blue tint, slow), Venom Shot poisons (green tint, DoT)
