# Quest System Implementation Plan

**Goal:** Lightweight objective tracker — kill packs, open chests, enter zones. Progress derived from existing state. HTML panel shows checklist.

**Spec:** `docs/superpowers/specs/2026-03-20-quest-system-design.md`

---

## Task 1: Add quest types

**Files:** `src/gameplay/types.ts`

- [ ] Add after `NpcKind`:
  ```typescript
  export type QuestObjectiveType = "kill_encounter" | "open_chest" | "enter_zone";

  export interface QuestObjective {
    id: string;
    description: string;
    type: QuestObjectiveType;
    targetId: string;
  }

  export interface QuestDefinition {
    id: string;
    title: string;
    objectives: QuestObjective[];
  }
  ```
- [ ] Add `visitedZoneIds: ZoneId[]` to `SaveGame` interface (after `clearedEncounterIds`)
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/gameplay/types.ts && git commit -m "feat: add QuestObjective, QuestDefinition types and visitedZoneIds to SaveGame"`

---

## Task 2: Add quest content

**Files:** `src/content/quests.ts` (new)

- [ ] Create:
  ```typescript
  import type { QuestDefinition } from "../gameplay/types";

  export const questDefinitions: QuestDefinition[] = [
    {
      id: "first-blood",
      title: "First Blood",
      objectives: [
        { id: "ob-west",   description: "Clear the west crossroads pack",   type: "kill_encounter", targetId: "crossroads-west-pack"   },
        { id: "ob-center", description: "Clear the center crossroads pack", type: "kill_encounter", targetId: "crossroads-center-pack" },
        { id: "ob-east",   description: "Clear the east crossroads pack",   type: "kill_encounter", targetId: "crossroads-east-pack"   },
      ],
    },
    {
      id: "into-the-dark",
      title: "Into the Dark",
      objectives: [
        { id: "ob-hollow",  description: "Enter Blighted Hollow",   type: "enter_zone", targetId: "hollow"  },
        { id: "ob-ashveil", description: "Enter Ashveil Descent",   type: "enter_zone", targetId: "ashveil" },
      ],
    },
    {
      id: "depths-of-the-mire",
      title: "Depths of the Mire",
      objectives: [
        { id: "ob-stalker", description: "Clear the stalker pack in Deepmire",   type: "kill_encounter", targetId: "deepmire-stalker-pack" },
        { id: "ob-wraith",  description: "Clear the wraith pack in Deepmire",    type: "kill_encounter", targetId: "deepmire-wraith-pack"  },
        { id: "ob-boss",    description: "Clear the boss pack in Deepmire",      type: "kill_encounter", targetId: "deepmire-boss-pack"    },
      ],
    },
  ];
  ```
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/content/quests.ts && git commit -m "feat: add quest definitions (First Blood, Into the Dark, Depths of the Mire)"`

---

## Task 3: Add quest logic helpers

**Files:** `src/gameplay/quests.ts` (new)

- [ ] Create:
  ```typescript
  import type { QuestDefinition, ZoneId } from "./types";

  export function isObjectiveComplete(
    type: string,
    targetId: string,
    clearedIds: Set<string>,
    visitedZones: Set<ZoneId>,
  ): boolean {
    if (type === "enter_zone") return visitedZones.has(targetId as ZoneId);
    return clearedIds.has(targetId);
  }

  export function isQuestComplete(
    quest: QuestDefinition,
    clearedIds: Set<string>,
    visitedZones: Set<ZoneId>,
  ): boolean {
    return quest.objectives.every((obj) =>
      isObjectiveComplete(obj.type, obj.targetId, clearedIds, visitedZones),
    );
  }

  export function getActiveQuest(
    quests: QuestDefinition[],
    clearedIds: Set<string>,
    visitedZones: Set<ZoneId>,
  ): QuestDefinition | undefined {
    return quests.find((q) => !isQuestComplete(q, clearedIds, visitedZones));
  }
  ```
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/gameplay/quests.ts && git commit -m "feat: add pure quest progress helper functions"`

---

## Task 4: Update GameContext and save format

**Files:** `src/systems/GameContext.ts`, `src/gameplay/save.ts`

- [ ] In `GameContext.ts`, add import `ZoneId` if not present, add to interface:
  ```typescript
  visitedZoneIds: Set<ZoneId>;
  checkQuestProgress: () => void;
  ```
- [ ] Read `src/gameplay/save.ts` to see current structure, then update `SaveGame` write/load to include `visitedZoneIds: string[]`

  In `writeSave()` snapshot param, add `visitedZoneIds: [...ctx.visitedZoneIds]`

  In `loadSave()` return, add `visitedZoneIds: (save.visitedZoneIds ?? []) as ZoneId[]`

  Update `RuntimeStateSnapshot` in types.ts if needed to include `visitedZoneIds`

- [ ] Run `npx tsc --noEmit` — expect errors in GameScene for missing ctx fields
- [ ] Commit: `git add src/systems/GameContext.ts src/gameplay/save.ts && git commit -m "feat: add visitedZoneIds and checkQuestProgress callback to GameContext"`

---

## Task 5: Update ZoneSystem — track visited zones

**Files:** `src/systems/ZoneSystem.ts`

- [ ] In `transitionToZone()`, before `this.ctx.autosave()`:
  ```typescript
  this.ctx.visitedZoneIds.add(zoneId);
  this.ctx.checkQuestProgress();
  ```
- [ ] Run `npx tsc --noEmit` (may still error on GameScene)
- [ ] `git add src/systems/ZoneSystem.ts && git commit -m "feat: track visited zones and check quest progress on zone transition"`

---

## Task 6: Update CombatSystem — check quests on encounter clear

**Files:** `src/systems/CombatSystem.ts`

- [ ] In `handleDeath()`, after `this.ctx.clearedEncounterIds.add(encounterId)`:
  ```typescript
  this.ctx.checkQuestProgress();
  ```
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/systems/CombatSystem.ts && git commit -m "feat: trigger quest progress check on encounter cleared"`

---

## Task 7: Update GameScene — wire quest tracking

**Files:** `src/scenes/GameScene.ts`

- [ ] Import quest helpers: `import { questDefinitions } from "../content/quests"; import { getActiveQuest, isObjectiveComplete, isQuestComplete } from "../gameplay/quests";`
- [ ] Add ctx field init: `visitedZoneIds: new Set<ZoneId>([this.ctx.activeZoneId ?? "crossroads"])`, `checkQuestProgress: () => this.checkQuestProgress()`
- [ ] In `restoreOrStart()`, init `visitedZoneIds` from save:
  ```typescript
  this.ctx.visitedZoneIds = new Set((save?.visitedZoneIds ?? ["crossroads"]) as ZoneId[]);
  ```
- [ ] Add private `checkQuestProgress()` method:
  ```typescript
  private checkQuestProgress(): void {
    const prev = getActiveQuest(questDefinitions, this.ctx.clearedEncounterIds, this.ctx.visitedZoneIds);
    // re-evaluate: if all quests done, or active quest changed, log it
    // Check each quest for just-completed state
    for (const quest of questDefinitions) {
      const completedKey = `quest-done-${quest.id}`;
      if (
        isQuestComplete(quest, this.ctx.clearedEncounterIds, this.ctx.visitedZoneIds) &&
        !this.ctx.clearedEncounterIds.has(completedKey)
      ) {
        this.ctx.clearedEncounterIds.add(completedKey);
        this.log(`Quest complete: ${quest.title}!`);
        this.autosave();
      }
    }
  }
  ```
- [ ] Update `getSnapshot()` (or add `getQuestSnapshot()`) to return quest data for the UI:
  ```typescript
  getActiveQuestForUi(): { title: string; objectives: Array<{ description: string; done: boolean }> } | null {
    const active = getActiveQuest(questDefinitions, this.ctx.clearedEncounterIds, this.ctx.visitedZoneIds);
    if (!active) return null;
    return {
      title: active.title,
      objectives: active.objectives.map((obj) => ({
        description: obj.description,
        done: isObjectiveComplete(obj.type, obj.targetId, this.ctx.clearedEncounterIds, this.ctx.visitedZoneIds),
      })),
    };
  }
  ```
- [ ] Run `npx tsc --noEmit` — expect 0 errors after also initializing ctx fields
- [ ] `git add src/scenes/GameScene.ts && git commit -m "feat: wire quest tracking into GameScene with completion detection and UI data method"`

---

## Task 8: Update save.ts — persist visitedZoneIds

**Files:** `src/gameplay/save.ts`

- [ ] Read the file, then update `writeSave` to include `visitedZoneIds` and `loadSave` to restore it
- [ ] Bump `SAVE_VERSION` by 1 (so stale saves reload cleanly with defaults)
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/gameplay/save.ts && git commit -m "feat: persist visitedZoneIds in save format, bump save version"`

---

## Task 9: Update bootstrap.ts — quest tracker panel

**Files:** `src/ui/bootstrap.ts`, `src/styles.css`

- [ ] Add quest tracker HTML inside `.viewport` (after shop popup):
  ```html
  <div id="quest-tracker" class="quest-tracker"></div>
  ```
- [ ] Query element and render quest data in `render()`:
  ```typescript
  const questTracker = root.querySelector<HTMLElement>("#quest-tracker")!;
  // in render():
  const activeQuest = scene.getActiveQuestForUi();
  if (activeQuest) {
    questTracker.innerHTML = `
      <div class="quest-title">${activeQuest.title}</div>
      ${activeQuest.objectives.map((obj) =>
        `<div class="quest-obj ${obj.done ? "is-done" : ""}">
          <span class="quest-check">${obj.done ? "✓" : "○"}</span>
          <span>${obj.description}</span>
        </div>`
      ).join("")}
    `;
  } else {
    questTracker.innerHTML = `<div class="quest-title">All quests complete!</div>`;
  }
  ```
- [ ] Add CSS for `.quest-tracker`, `.quest-title`, `.quest-obj`, `.quest-check`, `.is-done`
- [ ] Run `npx tsc --noEmit` and `npm run build`
- [ ] `git add src/ui/bootstrap.ts src/styles.css && git commit -m "feat: add quest tracker HUD panel to bootstrap UI"`
