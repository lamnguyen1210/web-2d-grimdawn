# Quest / Objective System — Design Spec

**Goal:** A minimal quest tracker that gives players clear objectives: kill specific encounter packs, open specific chests, and enter new zones. Progress persists to save. A HUD objective list shows active tasks and checks them off as completed.

---

## Scope

Quests are not dialogue-driven story quests. They are a structured form of the existing encounter/zone data — a lightweight objective list that makes the game's existing content more legible. No quest giver, no accept/reject, no branching.

## Quest Definition

Each quest has:
- `id: string`
- `title: string`
- `objectives: QuestObjective[]`

Each `QuestObjective` has:
- `id: string`
- `description: string`
- `type: "kill_encounter" | "open_chest" | "enter_zone"`
- `targetId: string` — encounterId, encounterId (for chest), or ZoneId

A quest is complete when all its objectives are complete. An objective is complete when its `targetId` matches a cleared encounter, a cleared chest encounter, or a visited zone.

## Quest Progress Tracking

Progress is entirely derivable from existing state:
- `clearedEncounterIds` — tracks killed encounter packs AND opened chests (same set)
- A new `visitedZoneIds: Set<ZoneId>` in GameContext (persisted to save)

No new progress maps needed — quest completion is computed on the fly from existing state.

## Quest Definitions (static content)

A single starter quest chain:

**Quest 1: "First Blood"** — kill crossroads-west-pack, crossroads-center-pack, crossroads-east-pack
**Quest 2: "Into the Dark"** — enter hollow, enter ashveil
**Quest 3: "Depths of the Mire"** — kill deepmire-stalker-pack, deepmire-wraith-pack, deepmire-boss-pack

## HUD Integration

A compact quest tracker panel rendered in the HTML UI (sidebar/overlay). Shows:
- Active quest title
- Objectives as a checklist (✓ for complete, ○ for pending)
- On quest complete: congratulations log message + autosave

No in-game Phaser overlay for quests — HTML sidebar handles this cleanly.

## Architecture

**New types** (`types.ts`): `QuestObjectiveType`, `QuestObjective`, `QuestDefinition`, update `SaveGame` and `RuntimeStateSnapshot` to include `visitedZoneIds`

**New content** (`content/quests.ts`): quest definitions array

**New pure function** (`gameplay/quests.ts`): `getQuestProgress(quest, clearedIds, visitedZoneIds)` — returns objective completion booleans; `getActiveQuest(quests, clearedIds, visitedZoneIds)` — returns first incomplete quest

**GameContext** gains: `visitedZoneIds: Set<ZoneId>`

**ZoneSystem**: `transitionToZone()` adds `zoneId` to `ctx.visitedZoneIds`; includes in save/load

**GameScene**: `getQuestSnapshot()` returns data for UI rendering; update `autosave()` / save format to include `visitedZoneIds`; check quest completion each zone transition and on encounter clear

**bootstrap.ts**: render quest tracker panel (always visible, small); updates on same 180ms interval

**save.ts**: update `SaveGame` to include `visitedZoneIds: string[]`; update `writeSave` / `loadSave`

## No new files for quest checking

Quest completion is checked in two places:
1. After `clearedEncounterIds.add(encounterId)` in CombatSystem (encounter kill) — call `ctx.checkQuestProgress()` callback
2. After zone transition in ZoneSystem — same callback

`checkQuestProgress` is a callback in GameContext (like `autosave` and `log`) — keeps systems decoupled.
