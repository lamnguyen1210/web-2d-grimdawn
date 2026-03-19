# Brainstorm

## 1. Project Goal

Create a web-based 2D ARPG engine that captures the feel of Grim Dawn at a smaller scale:

- Dense combat
- Character builds and stat scaling
- Procedural or semi-random loot
- Strong progression loop
- Modular systems that can later support different game themes

This should start as an engine-first hobby project, but it needs a playable vertical slice early so architecture is tested against real gameplay.

## 2. Core Pillars

### Combat Feel

- Fast enemy engagement
- Clear hit feedback
- Cooldown-based active skills
- Layered effects: damage, debuffs, knockback, area damage

### Build Depth

- Attributes, derived stats, damage types, resistances
- Skill trees or mastery-style progression
- Equipment that changes playstyle, not just numbers

### Loot Loop

- Rarity tiers
- Affixes and prefixes
- Gold, crafting materials, consumables
- Enemies and chests as primary reward sources

### Replayability

- Reusable map chunks or event spawning
- Elite enemies
- Scalable encounter density
- Difficulty tiers later

## 3. Player Experience Target

The first playable version should let the player:

1. Enter a map
2. Move and attack
3. Use 1 to 2 skills
4. Fight several enemy types
5. Pick up loot
6. Equip an item
7. Level up or gain a skill point

If that loop feels good, the engine direction is viable.

## 4. Suggested Scope for Version 0

Keep the first milestone narrow:

- One outdoor zone
- One dungeon or arena
- One player class
- Three enemy archetypes: melee, ranged, bruiser
- Basic inventory and equipment
- Item generation with a few affixes
- One boss encounter
- Save and load in local storage

Avoid these early:

- Multiplayer
- Procedural world generation
- Full crafting system
- Complex quest system
- Extensive narrative tooling

## 5. Tech Direction

### Rendering

Best starting option:

- `Phaser` for fast iteration and scene management

Alternative if you want tighter engine control:

- `PixiJS` plus your own gameplay framework

Recommendation:

- Start with Phaser unless engine internals are the main goal

### Language and Tooling

- `TypeScript`
- `Vite`
- ESLint + Prettier

### Data Model

Keep gameplay data external and serializable:

- Skills in JSON or TS data files
- Enemy stats in data files
- Items and affix pools in data files
- Map metadata separate from engine code

### State and Systems

Prefer game-specific systems over general enterprise patterns:

- Entity model for player, enemies, projectiles, loot
- Combat resolution system
- Buff/debuff system
- AI state logic
- Drop generation system
- Save system

You do not need a heavy ECS on day one. A lightweight entity-component style can evolve later if complexity justifies it.

## 6. High-Level Architecture

Possible folders:

```text
src/
  core/
  engine/
  gameplay/
  content/
  ui/
  data/
  scenes/
```

Suggested responsibilities:

- `engine`: rendering, camera, map integration, input, timing
- `gameplay`: combat, stats, skills, AI, loot
- `content`: actual classes, enemies, items, maps
- `ui`: HUD, inventory, skill bar, tooltips
- `data`: schemas and loaders

## 7. Core Systems List

Engine systems:

- Game loop
- Input abstraction
- Collision and pathing
- Camera follow and culling
- Animation playback
- Scene transitions

Gameplay systems:

- Stats and modifiers
- Damage formula
- Skills and cooldowns
- Enemy AI
- Target selection
- Loot tables
- Inventory and equipment
- Progression and leveling
- Status effects

Support systems:

- Save/load
- Debug overlay
- Content validation
- Spawn tools for testing

## 8. Hard Problems to Think About Early

### Movement Model

Decide whether the game is:

- Click-to-move first
- WASD first
- Hybrid

For a Grim Dawn feel, hybrid is probably best.

### Map Format

Good early choice:

- Tiled maps with collision and spawn markers

### Combat Resolution

Decide whether attacks are:

- Hit-scan style checks
- Projectile based
- Animation event based

Likely answer:

- Mix of animation events and projectile entities

### Scaling Complexity

Stat systems can spiral quickly. Start with:

- Health
- Energy or mana
- Armor
- Physical damage
- Fire damage
- Attack speed
- Crit chance
- Crit damage
- Resistances

## 9. First Milestone Plan

### Milestone A: Prototype Feel

- One map
- One character controller
- Basic enemy chase and attack
- One primary attack
- Damage numbers and hit flashes

### Milestone B: Vertical Slice

- Skills
- Inventory
- Random loot drops
- Equip flow
- Level up
- Boss

### Milestone C: Engine Hardening

- Better content pipeline
- Save stability
- More reusable combat systems
- Debug tools

## 10. Concrete Next Decisions

You should decide these next:

1. Phaser or PixiJS
2. Click-to-move only vs hybrid controls
3. Single-player only for the long term or multiplayer as a future possibility
4. Pixel art vs painted 2D style
5. Engine-first architecture vs vertical-slice-first development emphasis

## 11. Recommendation

Best pragmatic path:

- `TypeScript + Vite + Phaser`
- Single-player only
- Hybrid movement
- Tiled map pipeline
- Vertical-slice-first

That combination keeps the project achievable while still leaving room for a strong ARPG engine foundation.
