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
    SkillSystem.ts  # Cleave Shot, Fire Bomb, resource checks
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

## Worktrees

Stored in `.worktrees/` (gitignored). Active branch: `feature/split-systems`.
