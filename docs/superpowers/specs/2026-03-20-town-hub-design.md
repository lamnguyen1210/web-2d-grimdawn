# Town Hub + Merchant + Healer — Design Spec

**Goal:** Add a safe "Thornhaven" town zone reachable from Crossroads, with a merchant NPC (buy tonics and items) and a healer NPC (restore health for gold).

---

## Zone

- Zone id: `"town"`, name: "Thornhaven", size 800×600
- No enemies, no encounters — a safe rest zone
- Accessible via a new transition on the left edge of Crossroads (x=0, y=700, w=64, h=200)
- Town exit transition: left edge (x=0, y=200, w=64, h=200) back to Crossroads right-side
- Player spawn: (120, 300)
- Visual palette: warm earth browns — warmer and lighter than combat zones

## NPCs

Two NPCs in Thornhaven:
- **Merchant Aldric** (amber circle, x=400, y=240): buy Health Tonics (5g) or a magic item (25g)
- **Healer Seline** (green circle, x=540, y=360): restore full health for 20g (instant, no UI)

NPCs live in `ctx.npcs: Map<string, NpcState>` — not in `ctx.actors`. No AI, no health bar, no combat.

## Interaction

- E key while within 64px of an NPC triggers interaction
- Merchant: sets `ctx.isShopOpen = true` — bootstrap.ts shows the shop HTML panel
- Healer: immediate effect (deduct gold + restore health) + combat log message
- Shop panel shows current gold, two buy buttons, close button
- `ctx.isShopOpen` resets to `false` in `clearZoneState()` (so transitioning zones closes it)

## Architecture

**New types** (`types.ts`): `NpcKind = "merchant" | "healer"`, `NpcState` interface, `RenderNpc` interface

**New content** (`content/npcs.ts`): NPC spawn records keyed by ZoneId

**New system** (`systems/NpcSystem.ts`): `spawnZoneNpcs(zoneId)`, `clearNpcs()`, `interactHealer()`, `buyTonic()`, `buyItem()`, `getNearbyNpc(x, y, range)`

**Rendering** in `RenderSystem`: `syncNpcViews()` creates body circle + text label; `clearNpcViews()` destroys them; `refreshNpcHints()` updates label text to show "Press E" when player ≤64px away

**GameContext** gains: `npcs`, `npcViews`, `isShopOpen`

**ZoneSystem** gains NpcSystem dep — calls `npcSystem.spawnZoneNpcs()` after zone spawn, `npcSystem.clearNpcs()` in clearZoneState, resets `ctx.isShopOpen = false` in clearZoneState

**GameScene** gains: E key binding, wire NpcSystem, public methods `getIsShopVisible()`, `closeShop()`, `buyTonic()`, `buyItem()` (delegates to NpcSystem)

**bootstrap.ts** gains: `#shop-popup` HTML panel (same structural pattern as `#inventory-popup`); shown when `scene.getIsShopVisible()`; buttons call `scene.buyTonic()`, `scene.buyItem()`, `scene.closeShop()`

## Dependency graph (no circular deps)

```
RenderSystem   (leaf)
LootSystem     (leaf)
CombatSystem → RenderSystem, LootSystem
NpcSystem    → CombatSystem, LootSystem
SkillSystem  → CombatSystem, RenderSystem
ZoneSystem   → RenderSystem, LootSystem, NpcSystem
AISystem     → CombatSystem, ZoneSystem
```

## NPC prices

| Action | Cost |
|--------|------|
| Buy Health Tonic | 5g |
| Buy magic item | 25g |
| Heal to full | 20g |

## Out of scope for this sub-project

- Sell items
- Item restock / shop rotation
- NPC dialogue beyond log messages
