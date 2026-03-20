# Skill Tree Implementation Plan

**Goal:** Flat passive talent grid — 12 nodes, 3 themes. 1 point per level-up. Unlock → permanent stat bonus.

**Spec:** `docs/superpowers/specs/2026-03-20-skill-tree-design.md`

---

## Task 1: Add talent content

**Files:** `src/content/talents.ts` (new)

- [ ] Create:
  ```typescript
  import type { PartialStats } from "../gameplay/types";

  export interface TalentDefinition {
    id: string;
    name: string;
    description: string;
    theme: "combat" | "survival" | "elemental";
    statBonus: PartialStats;
  }

  export const talentDefinitions: TalentDefinition[] = [
    // Combat
    { id: "combat-phys-1",  name: "Brute Force",      theme: "combat",    description: "+3/+3 physical damage",    statBonus: { physicalDamageMin: 3, physicalDamageMax: 3 } },
    { id: "combat-crit-1",  name: "Keen Eye",          theme: "combat",    description: "+5% crit chance",          statBonus: { critChance: 0.05 } },
    { id: "combat-crit-2",  name: "Lethal Strikes",    theme: "combat",    description: "+15% crit multiplier",     statBonus: { critMultiplier: 0.15 } },
    { id: "combat-speed-1", name: "Swift Strikes",     theme: "combat",    description: "+1 attack speed",          statBonus: { attackSpeed: 1 } },
    // Survival
    { id: "survival-hp-1",   name: "Iron Body",        theme: "survival",  description: "+30 max health",           statBonus: { maxHealth: 30 } },
    { id: "survival-hp-2",   name: "Fortified",        theme: "survival",  description: "+50 max health",           statBonus: { maxHealth: 50 } },
    { id: "survival-armor-1",name: "Plated Hide",      theme: "survival",  description: "+8 armor",                 statBonus: { armor: 8 } },
    { id: "survival-regen-1",name: "Vitality",         theme: "survival",  description: "+1.5 health regen/sec",    statBonus: { healthRegen: 1.5 } },
    // Elemental
    { id: "elemental-fire-1",   name: "Pyromaniac",    theme: "elemental", description: "+2/+3 fire damage",        statBonus: { fireDamageMin: 2, fireDamageMax: 3 } },
    { id: "elemental-fire-2",   name: "Flame Ward",    theme: "elemental", description: "+10% fire resistance",     statBonus: { fireResistance: 0.10 } },
    { id: "elemental-poison-1", name: "Toxin Immunity",theme: "elemental", description: "+10% poison resistance",   statBonus: { poisonResistance: 0.10 } },
    { id: "elemental-energy-1", name: "Inner Reserve", theme: "elemental", description: "+20 max energy",           statBonus: { maxEnergy: 20 } },
  ];
  ```
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/content/talents.ts && git commit -m "feat: add passive talent definitions (12 nodes, 3 themes)"`

---

## Task 2: Update types and save format

**Files:** `src/gameplay/types.ts`, `src/gameplay/save.ts`

- [ ] In `SaveGame`, add:
  ```typescript
  talentPoints?: number;
  spentTalents?: string[];
  ```
- [ ] In `RuntimeStateSnapshot`, add:
  ```typescript
  talentPoints: number;
  spentTalents: string[];
  ```
- [ ] In `save.ts`, bump `SAVE_VERSION` to 3; in `writeSave`, add:
  ```typescript
  talentPoints: snapshot.talentPoints,
  spentTalents: snapshot.spentTalents,
  ```
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/gameplay/types.ts src/gameplay/save.ts && git commit -m "feat: add talent points fields to SaveGame and RuntimeStateSnapshot, bump save version"`

---

## Task 3: Update GameContext

**Files:** `src/systems/GameContext.ts`

- [ ] Add to `GameContext` interface:
  ```typescript
  talentPoints: number;
  spentTalents: Set<string>;
  ```
- [ ] Run `npx tsc --noEmit` (will error in GameScene — expected)
- [ ] `git add src/systems/GameContext.ts && git commit -m "feat: add talentPoints and spentTalents to GameContext"`

---

## Task 4: Wire talent stat bonuses into CombatSystem.buildPlayerStats

**Files:** `src/systems/CombatSystem.ts`

- [ ] Add import: `import { talentDefinitions } from "../content/talents";`
- [ ] In `buildPlayerStats()`, add talent bonuses alongside equipment:
  ```typescript
  const talentBonuses = talentDefinitions
    .filter((t) => this.ctx.spentTalents.has(t.id))
    .map((t) => t.statBonus);
  return addStats(PLAYER_BASE_STATS, levelBonus, ...equipmentBonuses, ...talentBonuses);
  ```
- [ ] In `gainXp()`, inside the level-up loop after `this.ctx.level += 1`:
  ```typescript
  this.ctx.talentPoints += 1;
  ```
- [ ] Run `npx tsc --noEmit`
- [ ] `git add src/systems/CombatSystem.ts && git commit -m "feat: apply talent bonuses in buildPlayerStats and award talent point on level-up"`

---

## Task 5: Update GameScene — wire talents, add public methods

**Files:** `src/scenes/GameScene.ts`

- [ ] Add to ctx init object:
  ```typescript
  talentPoints: 0,
  spentTalents: new Set<string>(),
  ```
- [ ] In `restoreOrStart()`, after clearedEncounterIds init:
  ```typescript
  this.ctx.talentPoints = save?.talentPoints ?? 0;
  this.ctx.spentTalents = new Set(save?.spentTalents ?? []);
  ```
- [ ] Update `getSnapshot()` to include:
  ```typescript
  talentPoints: this.ctx.talentPoints,
  spentTalents: [...this.ctx.spentTalents],
  ```
- [ ] Add public methods:
  ```typescript
  spendTalent(talentId: string): void {
    if (this.ctx.talentPoints <= 0) {
      this.log("No talent points available.");
      return;
    }
    if (this.ctx.spentTalents.has(talentId)) {
      this.log("Talent already unlocked.");
      return;
    }
    this.ctx.spentTalents.add(talentId);
    this.ctx.talentPoints -= 1;
    this.combat.recalculatePlayerStats();
    this.log(`Talent unlocked.`);
    this.autosave();
  }

  getTalentSnapshot(): { points: number; spent: Set<string> } {
    return { points: this.ctx?.talentPoints ?? 0, spent: this.ctx?.spentTalents ?? new Set() };
  }
  ```
- [ ] Run `npx tsc --noEmit` — expect 0 errors
- [ ] `git add src/scenes/GameScene.ts && git commit -m "feat: wire talent points into GameScene with spendTalent and getTalentSnapshot methods"`

---

## Task 6: Add talent panel to inventory popup in bootstrap.ts

**Files:** `src/ui/bootstrap.ts`, `src/styles.css`

- [ ] Import `talentDefinitions` at top: add to existing imports or a new import line:
  ```typescript
  // Note: talentDefinitions is a static import used for rendering
  ```
  Actually, import via a module: the HTML panel is rendered from `scene.getTalentSnapshot()` + the definitions array. Import the array in bootstrap.ts:
  ```typescript
  import { talentDefinitions } from "../content/talents";
  ```
- [ ] Add a new "Talents" column to the inventory popup HTML (add as third `.inventory-popup-col`):
  ```html
  <div class="inventory-popup-col">
    <h2 class="inventory-popup-title">Talents</h2>
    <div id="popup-talent-points" class="popup-talent-points"></div>
    <div id="popup-talents" class="popup-talents"></div>
  </div>
  ```
- [ ] Query the new elements:
  ```typescript
  const popupTalentPoints = root.querySelector<HTMLElement>("#popup-talent-points")!;
  const popupTalents = root.querySelector<HTMLElement>("#popup-talents")!;
  ```
- [ ] In `render()`, inside `if (inventoryVisible)`, add talent rendering:
  ```typescript
  const talentSnap = scene.getTalentSnapshot();
  popupTalentPoints.textContent = `Available points: ${talentSnap.points}`;

  const themes = ["combat", "survival", "elemental"] as const;
  popupTalents.innerHTML = themes.map((theme) => {
    const nodes = talentDefinitions.filter((t) => t.theme === theme);
    return `
      <div class="talent-theme-label">${theme.toUpperCase()}</div>
      ${nodes.map((t) => {
        const unlocked = talentSnap.spent.has(t.id);
        return `
          <div class="talent-card${unlocked ? " is-unlocked" : ""}">
            <div class="talent-card-name">${t.name}</div>
            <div class="talent-card-desc">${t.description}</div>
            ${!unlocked ? `<button class="button talent-btn" data-action="spend-talent" data-talent-id="${t.id}"
              ${talentSnap.points <= 0 ? 'disabled style="opacity:0.4;cursor:default"' : ""}>
              Unlock (1pt)
            </button>` : `<span class="talent-unlocked-badge">✓ Unlocked</span>`}
          </div>
        `;
      }).join("")}
    `;
  }).join("");
  ```
- [ ] In the click handler, add:
  ```typescript
  } else if (control.dataset.action === "spend-talent" && control.dataset.talentId) {
    scene.spendTalent(control.dataset.talentId);
  ```
- [ ] Add CSS for talent panel classes
- [ ] Run `npx tsc --noEmit` and `npm run build`
- [ ] `git add src/ui/bootstrap.ts src/styles.css && git commit -m "feat: add talent panel to inventory popup with spend-talent UI"`
