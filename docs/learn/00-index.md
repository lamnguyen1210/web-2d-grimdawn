# Learning Docs — web-2d-grimdawn

A set of documents for understanding how this project works, starting from zero knowledge of web game development.

---

## Reading order

| # | File | What you'll learn |
|---|------|-------------------|
| 1 | [01-how-web-games-work.md](./01-how-web-games-work.md) | Browser, canvas, game loop, delta time, Phaser, TypeScript — the foundation concepts |
| 2 | [02-startup-flow.md](./02-startup-flow.md) | Step-by-step trace from browser URL open → player can move; every file and function in the chain |
| 3 | [03-player-and-movement.md](./03-player-and-movement.md) | How the player character is created, stats explained, WASD + click-to-move, leveling, autosave |
| 4 | [04-enemies-and-ai.md](./04-enemies-and-ai.md) | Enemy definitions, spawning, AI state machine, all 6 enemy archetypes, projectiles, encounters |
| 5 | [05-combat-system.md](./05-combat-system.md) | Damage formula step-by-step, all three damage types, status effects (burn/poison/chill), hazards, death |
| 6 | [06-skills-and-spells.md](./06-skills-and-spells.md) | All 5 abilities explained (Basic Attack, Cleave Shot, Fire Bomb, Frost Nova, Venom Shot) with code |
| 7 | [07-items-and-loot.md](./07-items-and-loot.md) | Item system, rarity, affixes (random modifiers), loot drop rates, inventory, equipping |
| 8 | [08-zones-and-world.md](./08-zones-and-world.md) | The three zones, encounter system, zone transitions, clearing and persistence |
| 9 | [09-rendering.md](./09-rendering.md) | How Phaser draws everything: actor views, camera, HUD, floating damage text, boss bar |

---

## Architecture at a glance

```
Browser opens the page
  ↓
main.ts → bootstrapApp() → builds HTML shell
  ↓
createGame() → Phaser creates <canvas>
  ↓
BootScene → GameScene.create()
  ├── Build GameContext (shared state bag)
  ├── Instantiate systems: Render, Loot, Combat, Skill, Zone, AI
  ├── Register keyboard + mouse input
  └── restoreOrStart() → create player, spawn enemies, draw world
          ↓
   Phaser game loop: update() called ~60/sec
     ├── handleKeys() → check skill keypresses
     ├── updatePlayer() → movement, health/energy regen
     ├── ai.updateEnemies() → AI movement and attacks
     ├── combat.updateProjectiles() → move projectiles, check hits
     ├── combat.updateHazards() → tick fire pools
     ├── combat.updateBurning/Poison() → tick DoTs
     ├── loot.updatePickups() → auto-collect nearby loot
     ├── zone.checkTransitions() → detect zone exits
     └── render.refreshRenderState() → sync all visuals with state
```

---

## Key files quick reference

| File | Purpose |
|------|---------|
| `src/main.ts` | Entry point |
| `src/ui/bootstrap.ts` | HTML shell, sidebar UI, polling loop |
| `src/engine/game.ts` | Creates Phaser game instance |
| `src/scenes/GameScene.ts` | The Phaser scene — input, wiring, game loop |
| `src/systems/GameContext.ts` | Shared state interface |
| `src/systems/CombatSystem.ts` | All damage, status effects, projectiles, hazards, death |
| `src/systems/SkillSystem.ts` | 4 active skills logic |
| `src/systems/AISystem.ts` | Enemy AI loop |
| `src/systems/ZoneSystem.ts` | Zone loading, transitions, cleanup |
| `src/systems/LootSystem.ts` | Item generation, pickups, chests |
| `src/systems/RenderSystem.ts` | All Phaser visuals |
| `src/gameplay/types.ts` | All TypeScript interfaces |
| `src/gameplay/stats.ts` | Stat math (addStats, scaleStatsForLevel) |
| `src/gameplay/movement.ts` | moveActorTowards, moveActorAway, pushActor |
| `src/gameplay/save.ts` | localStorage save/load |
| `src/content/enemies.ts` | Enemy definitions |
| `src/content/items.ts` | Item definitions |
| `src/content/skills.ts` | Skill definitions |
| `src/content/zones.ts` | Zone definitions |
| `src/content/affixes.ts` | Affix (random modifier) definitions |
