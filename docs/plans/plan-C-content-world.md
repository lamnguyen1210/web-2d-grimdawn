# Plan C: Content & World Expansion

## Goal
Expand the game world with new enemies, items, affixes, and a third zone.

## Changes

### 1. New Enemies (2)
- **Plague Stalker** — rusher archetype, 56 HP, applies poison on contact, green (0x6fbf40), XP: 30
- **Frost Wraith** — ranged archetype, 38 HP, fires chill projectiles, light blue (0x7abce0), XP: 32

### 2. New Items (4)
- **Blighted Musket** — weapon, rare, high phys + poison resist, req level 3
- **Hollow Guardian Plate** — chest, rare, high armor + HP + poison resist, req level 3
- **Frostfire Signet** — ring, rare, fire + crit + chill synergy, req level 3
- **Militia Repeater** — weapon, magic, balanced phys + attack speed, req level 2

### 3. New Affixes (4)
- **Venomous** (prefix) — +poisonResistance: 0.08
- **Frozen** (prefix) — +physicalDamageMin: 1, physicalDamageMax: 3, moveSpeed: -8 (trade-off)
- **of Warding** (suffix) — +poisonResistance: 0.06, fireResistance: 0.04
- **of Fortitude** (suffix) — +maxHealth: 30, healthRegen: 0.6

### 4. New Zone: Blighted Hollow
- Accessible from crossroads (second transition on south side)
- 1600×1400 map, darker green-brown palette
- 3 encounters: Plague Stalker pack, mixed Frost Wraith + Stalker, Bruiser + Cultist elite pack
- Supply cache in the elite encounter
- Transition back to crossroads

### 5. Zone Linking
- Add a second `transitions` array (change from single transition to array) in ZoneDefinition
- Or simpler: keep single transition but add crossroads → hollow as a second zone link
- **Decision:** Change `transition?: {...}` to `transitions: Array<{...}>` to support multiple exits

### 6. Minimap
- **RenderSystem:** Add minimap rendering in top-right corner
- Small 180×120 rectangle with:
  - Zone boundary outline
  - Green dot for player
  - Red dots for alive enemies
  - Yellow dots for pickups
  - Gold rectangle for transitions
- Updates every frame in `refreshRenderState()`
- Uses `setScrollFactor(0)` to stay on screen

## Files Modified
- `src/gameplay/types.ts` — ZoneDefinition.transitions (array), ZoneId union, EnemyArchetype
- `src/content/enemies.ts` — Plague Stalker, Frost Wraith
- `src/content/items.ts` — 4 new items
- `src/content/affixes.ts` — 4 new affixes
- `src/content/zones.ts` — Blighted Hollow zone, update crossroads with 2nd transition, update ZoneId
- `src/systems/ZoneSystem.ts` — handle transitions array, spawn new zone
- `src/systems/RenderSystem.ts` — render multiple transitions, minimap
- `src/systems/AISystem.ts` — handle new enemy types (poison on contact, chill projectiles)
- `src/systems/CombatSystem.ts` — poison projectile handling

## Verification
- `npx tsc --noEmit` passes
- Manual: can navigate to Blighted Hollow, fight new enemies, find new items, see minimap
