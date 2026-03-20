# CLAUDE.md

## Project

**web-2d-grimdawn** — 2D action RPG prototype built with Phaser 3, TypeScript, and Vite.
Single canvas game embedded in an HTML page with a React-style sidebar UI.

## Commands

```bash
npm run dev      # start dev server (Vite HMR)
npm run build    # type-check then bundle
```

No test suite — `npx tsc --noEmit` is the verification gate.

## Architecture

### Entry point
`src/ui/bootstrap.ts` → mounts the Phaser game and wires the sidebar UI to `GameScene`'s public API.

### Scene
`src/scenes/GameScene.ts` (~380 lines) — the only Phaser.Scene. Owns input, HUD creation, and the game loop. Delegates all logic to system classes via a shared `GameContext`.

### GameContext (`src/systems/GameContext.ts`)
Plain interface (data bag) passed to every system. Holds:
- `scene` — the Phaser.Scene reference
- All runtime state maps: `actors`, `projectiles`, `hazards`, `pickups`, render view maps
- Progression state: `level`, `xp`, `inventory`
- HUD game objects, skill cooldowns, combat log
- `autosave()` / `log()` callbacks into GameScene

Systems read and write into `ctx` directly — no events, no message bus.

### Folder structure

```
src/
  content/        # Static data definitions (enemies, items, skills, zones, affixes)
  gameplay/       # Pure domain logic — stateless, no Phaser scene dependency
    types.ts        # All shared TypeScript interfaces and types
    stats.ts        # Stat math (addStats, scaleStatsForLevel, createStatBlock)
    save.ts         # localStorage save/load
    movement.ts     # Free functions: moveActorTowards/Away, pushActor, getNearestEnemy
  systems/        # Stateful runtime classes, all take GameContext in constructor
    GameContext.ts  # Shared state interface
    RenderSystem.ts # All Phaser rendering: actors, pickups, hazards, HUD, effects
    LootSystem.ts   # Pickup logic, item rolling, chest opening
    CombatSystem.ts # Damage, burn, death, XP, stats, projectiles, hazards
    SkillSystem.ts  # Cleave Shot, Fire Bomb, Frost Nova, Venom Shot, resource checks
    ZoneSystem.ts   # Zone spawning, transitions, state reset
    AISystem.ts     # Enemy AI loop, enemy projectile firing
  scenes/
    GameScene.ts    # Phaser scene — input, wiring, update delegation
  ui/
    bootstrap.ts    # HTML/sidebar integration
```

### `gameplay/` vs `systems/`

| | `gameplay/` | `systems/` |
|---|---|---|
| State | Stateless | Hold `GameContext` reference |
| Phaser | No scene objects | Deep scene access |
| Instantiation | Never | `new FooSystem(ctx)` |
| Rule | *What the game knows* | *What the game does* |

### System wiring (in `GameScene.create`)

```typescript
const ctx = { scene: this, ...allStateMaps };
this.render  = new RenderSystem(ctx);
this.loot    = new LootSystem(ctx);
this.combat  = new CombatSystem(ctx, this.render, this.loot);
this.skill   = new SkillSystem(ctx, this.combat, this.render);
this.zone    = new ZoneSystem(ctx, this.render, this.loot);
this.ai      = new AISystem(ctx, this.combat, this.zone);
```

Dependency graph (no circular deps):
```
RenderSystem   (leaf)
LootSystem     (leaf)
CombatSystem → RenderSystem, LootSystem
SkillSystem  → CombatSystem, RenderSystem
ZoneSystem   → RenderSystem, LootSystem
AISystem     → CombatSystem, ZoneSystem
movement.ts  (free functions, no deps)
```

## Conventions

- **PascalCase filenames** for files that export a class (`RenderSystem.ts`)
- **lowercase filenames** for files that export free functions (`movement.ts`, `stats.ts`)
- Systems mutate `ctx` directly — no return values for state changes
- `ctx.log(msg)` for all combat log entries; `ctx.autosave()` after significant events
- All damage flows through `CombatSystem.applyDamage()` — never write damage logic elsewhere
- Visuals are always separate from state: `ctx.actors` holds positions/health, `ctx.actorViews` holds Phaser objects; `RenderSystem.refreshRenderState()` syncs them each frame

## Key runtime patterns

**Adding a new enemy type:** add definition to `src/content/enemies.ts`, add spawn to a zone encounter in `src/content/zones.ts`. No other files need changing.

**Adding a new skill:** add definition to `src/content/skills.ts`, add a `tryCast*()` method to `SkillSystem`, wire a key in `GameScene.handleKeys()`.

**Adding a new item:** add definition to `src/content/items.ts`. It automatically enters the loot pool for `rollLoot()`.

**Adding a new stat:** add the field to `StatBlock` in `types.ts`, initialize it in `stats.ts` (`createStatBlock`), add it to `addStats()`.

**Zone transition:** player walks into a `ZoneTransition` rectangle → `ZoneSystem.checkTransitions()` calls `transitionToZone()` → `clearZoneState()` destroys all Phaser objects → new zone spawns.

## Deep-dive docs

`docs/learn/` contains 9 in-depth documents for understanding the codebase:

| File | Covers |
|------|--------|
| `00-index.md` | Overview, architecture diagram, key files table |
| `01-how-web-games-work.md` | Canvas, Phaser, game loop, delta time |
| `02-startup-flow.md` | Full trace from page load to gameplay |
| `03-player-and-movement.md` | Player creation, stats, WASD + click-to-move |
| `04-enemies-and-ai.md` | Enemy archetypes, AI state machine, spawning |
| `05-combat-system.md` | Damage formula, burn/poison/chill, hazards, death |
| `06-skills-and-spells.md` | All 5 abilities explained with code |
| `07-items-and-loot.md` | Item system, affixes, rarity, loot drops |
| `08-zones-and-world.md` | Zones, encounters, transitions, persistence |
| `09-rendering.md` | Phaser game objects, camera, HUD, depth layers |

## Worktrees

Stored in `.worktrees/` (gitignored). Active branch: `feature/split-systems`.
