# Skill Tree / Passive Talents — Design Spec

**Goal:** A simple passive talent system. Player spends talent points (earned on level-up) to unlock permanent stat bonuses. No branching skill trees — a flat grid of talent nodes organized by theme.

---

## Design

### Talent Points
- Player gains 1 talent point per level-up (starting from level 2)
- Talent points persist in save
- Track as `ctx.talentPoints: number` and `ctx.spentTalents: string[]` (ids of unlocked talents)

### Talent Nodes
A flat list of ~12 talent nodes, organized into 3 themes. Each node is unlocked independently (no prerequisite chain — YAGNI):

**Combat** (physical power)
- `combat-phys-1`: +3/+3 physical damage
- `combat-crit-1`: +5% crit chance
- `combat-crit-2`: +15% crit multiplier
- `combat-speed-1`: +1 attack speed

**Survival** (health/armor)
- `survival-hp-1`: +30 max health
- `survival-hp-2`: +50 max health
- `survival-armor-1`: +8 armor
- `survival-regen-1`: +1.5 health regen/sec

**Elemental** (fire/poison)
- `elemental-fire-1`: +2/+3 fire damage
- `elemental-fire-2`: +10% fire resistance
- `elemental-poison-1`: +10% poison resistance
- `elemental-energy-1`: +20 max energy

### Architecture
- `content/talents.ts` — static talent definitions (id, name, description, statBonus: PartialStats)
- `gameplay/types.ts` — add `talentPoints?: number` and `spentTalents?: string[]` to `SaveGame`; add `talentPoints: number`, `spentTalents: Set<string>` to `RuntimeStateSnapshot`
- `systems/GameContext.ts` — add `talentPoints: number`, `spentTalents: Set<string>`
- `systems/CombatSystem.ts` — `gainXp()` awards talent point on level-up
- `gameplay/save.ts` — persist `talentPoints` and `spentTalents`
- `scenes/GameScene.ts` — add `getTalentSnapshot()` public method, `spendTalent(id)` public method; `spendTalent` validates cost, adds to spentTalents, calls `recalculatePlayerStats()`
- `gameplay/stats.ts` — `buildPlayerStats()` / `addStats()` already handles PartialStats; talent bonuses summed in `buildPlayerStats()` (called via CombatSystem)
- `ui/bootstrap.ts` — talent panel in inventory popup (new tab or new section); shows talent nodes as cards with "Unlock (1pt)" button; shows available points
- `styles.css` — talent grid styles

### Stats wiring
Talent stat bonuses are applied in `CombatSystem.buildPlayerStats()` — add sum of all spent talent stats alongside equipment bonuses. No new system needed.

### Save format
Bump save version. Add `talentPoints: number` (default 0) and `spentTalents: string[]` (default []) to SaveGame.
