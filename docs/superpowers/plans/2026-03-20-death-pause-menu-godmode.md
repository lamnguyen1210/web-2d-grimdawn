# Death/Pause Menu & God Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an in-canvas overlay menu (Respawn / Load Last Save / New Game) when the player dies or presses Escape, pause the game while the menu is open, and toggle god mode with F2.

**Architecture:** An HTML `<div>` overlay is injected over the Phaser canvas inside `.viewport`; `bootstrap.ts`'s existing 180ms render loop shows/hides it by checking `!snapshot.player.alive || scene.getIsPaused()`. `GameScene` owns `isPaused` state and exposes `getIsPaused()` / `resumeGame()`. God mode lives in `GameContext` so `CombatSystem` can check it when applying damage.

**Tech Stack:** Phaser 3, TypeScript, Vite. No test suite — `npx tsc --noEmit` is the verification gate after every task.

---

## Files Modified

| File | Change |
|------|--------|
| `src/systems/GameContext.ts` | Add `godMode: boolean` field |
| `src/systems/CombatSystem.ts` | Skip damage to player when `ctx.godMode` is true |
| `src/scenes/GameScene.ts` | Add ESC/F2 keys, `isPaused` field, `getIsPaused()` / `resumeGame()` public methods; update `update()` and `restoreOrStart()` |
| `src/ui/bootstrap.ts` | Inject overlay div, show/hide it, wire buttons, remove dead-state buttons from combat log, update hint text |
| `src/styles.css` | Add `.game-menu`, `.game-menu-panel`, `.game-menu-title`, `.game-menu-actions` styles |

---

## Task 1: Add `godMode` to GameContext and block damage in CombatSystem

**Files:**
- Modify: `src/systems/GameContext.ts`
- Modify: `src/systems/CombatSystem.ts`

- [ ] **Step 1: Add `godMode: boolean` to `GameContext` interface**

  In `src/systems/GameContext.ts`, add the field to the `GameContext` interface under `// Misc state`:

  ```typescript
  // Misc state
  skillCooldowns: Record<string, number>;
  phaseTwoSummoned: boolean;
  showDebug: boolean;
  godMode: boolean;          // ← add this line
  combatLog: string[];
  ```

- [ ] **Step 2: Add god mode guard to `CombatSystem.applyDamage()`**

  In `src/systems/CombatSystem.ts`, in `applyDamage()`, after the existing `if (!target.alive) return;` check, add:

  ```typescript
  if (this.ctx.godMode && target.id === "player") {
    return;
  }
  ```

---

## Task 2: Add Escape/F2 keys, pause state, and public methods to GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Declare new key fields and `isPaused` flag**

  In `GameScene`, add after the existing private key declarations:

  ```typescript
  private escKey!: Phaser.Input.Keyboard.Key;
  private godModeKey!: Phaser.Input.Keyboard.Key;
  private isPaused = false;
  ```

- [ ] **Step 2: Register the new keys in `create()`**

  After the existing `this.lootKey = ...` line:

  ```typescript
  this.escKey = this.input.keyboard!.addKey("ESC");
  this.godModeKey = this.input.keyboard!.addKey("F2");
  ```

- [ ] **Step 3: Initialize `godMode` in the `ctx` object**

  In the `ctx` object literal in `create()`, add under `showDebug: false,`:

  ```typescript
  godMode: false,
  ```

- [ ] **Step 4: Add public `getIsPaused()` and `resumeGame()` methods**

  Add after the existing `startNewGame()` method:

  ```typescript
  getIsPaused(): boolean {
    return this.isPaused;
  }

  resumeGame(): void {
    this.isPaused = false;
  }
  ```

- [ ] **Step 5: Update `update()` to handle ESC/F2 before the early-return guard**

  Replace the current `update()` opening:

  ```typescript
  update(time: number, delta: number): void {
    if (!this.ctx?.player?.alive) {
      return;
    }
    this.handleKeys();
  ```

  With:

  ```typescript
  update(time: number, delta: number): void {
    if (this.ctx?.player) {
      if (Phaser.Input.Keyboard.JustDown(this.escKey) && this.ctx.player.alive) {
        this.isPaused = !this.isPaused;
      }
      if (Phaser.Input.Keyboard.JustDown(this.godModeKey)) {
        this.ctx.godMode = !this.ctx.godMode;
        this.log(`God mode ${this.ctx.godMode ? "ON" : "OFF"}.`);
      }
    }
    if (!this.ctx?.player?.alive || this.isPaused) {
      return;
    }
    this.handleKeys();
  ```

- [ ] **Step 6: Reset `isPaused` in `restoreOrStart()`**

  At the very start of `private restoreOrStart(...)`, before the first line of logic, add:

  ```typescript
  this.isPaused = false;
  ```

- [ ] **Step 7: Verify types**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/systems/GameContext.ts src/systems/CombatSystem.ts src/scenes/GameScene.ts
  git commit -m "feat: add god mode (F2) and pause state with ESC to GameScene"
  ```

---

## Task 3: Add in-canvas menu overlay to bootstrap.ts and styles.css

**Files:**
- Modify: `src/ui/bootstrap.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add CSS for the overlay**

  Append to `src/styles.css`:

  ```css
  .game-menu {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(9, 8, 7, 0.72);
    backdrop-filter: blur(2px);
  }

  .game-menu-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 36px 48px;
    border: 1px solid rgba(212, 166, 113, 0.25);
    border-radius: 20px;
    background: rgba(18, 14, 12, 0.95);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  }

  .game-menu-title {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #f2c680;
  }

  .game-menu-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .game-menu-actions .button {
    width: 100%;
    text-align: center;
    padding: 10px 20px;
  }
  ```

- [ ] **Step 2: Inject overlay div inside `.viewport` in `bootstrapApp()`**

  In `src/ui/bootstrap.ts`, change the viewport section of the `root.innerHTML` template from:

  ```html
  <section class="viewport">
    <div id="game-root" class="game-root"></div>
  </section>
  ```

  To:

  ```html
  <section class="viewport">
    <div id="game-root" class="game-root"></div>
    <div id="game-menu" class="game-menu" style="display:none">
      <div class="game-menu-panel">
        <h2 id="game-menu-title" class="game-menu-title">PAUSED</h2>
        <div id="game-menu-actions" class="game-menu-actions"></div>
      </div>
    </div>
  </section>
  ```

- [ ] **Step 3: Add overlay element references after the existing query selectors**

  After the existing `const logList = ...` line, add:

  ```typescript
  const gameMenu = root.querySelector<HTMLElement>("#game-menu")!;
  const gameMenuTitle = root.querySelector<HTMLElement>("#game-menu-title")!;
  const gameMenuActions = root.querySelector<HTMLElement>("#game-menu-actions")!;
  ```

- [ ] **Step 4: Show/hide the overlay in `render()`**

  At the end of the `render()` function (after the `logList.innerHTML = ...` block), add:

  ```typescript
  const dead = !snapshot.player.alive;
  const paused = scene.getIsPaused();
  if (dead || paused) {
    gameMenu.style.display = "flex";
    gameMenuTitle.textContent = dead ? "YOU DIED" : "PAUSED";
    gameMenuActions.innerHTML = dead
      ? `<button class="button" data-action="respawn">Respawn</button>
         <button class="button" data-action="load-save">Load Last Save</button>
         <button class="button" data-action="new-game">New Game</button>`
      : `<button class="button" data-action="resume">Resume</button>
         <button class="button" data-action="load-save">Load Last Save</button>
         <button class="button" data-action="new-game">New Game</button>`;
  } else {
    gameMenu.style.display = "none";
  }
  ```

- [ ] **Step 5: Remove death-state buttons from the combat log render**

  In `render()`, replace the current conditional combat log block:

  ```typescript
  logList.innerHTML = snapshot.player.alive
    ? scene
        .getCombatLog()
        .slice(-8)
        .reverse()
        .map((entry) => `<div class="log-entry">${entry}</div>`)
        .join("")
    : `
        <div class="log-entry">The soldier has fallen.</div>
        <div class="item-actions">
          <button class="button" data-action="respawn">Respawn</button>
          <button class="button" data-action="load-save">Load Last Save</button>
          <button class="button" data-action="new-game">New Game</button>
        </div>
      `;
  ```

  With:

  ```typescript
  logList.innerHTML = scene
    .getCombatLog()
    .slice(-8)
    .reverse()
    .map((entry) => `<div class="log-entry">${entry}</div>`)
    .join("");
  ```

- [ ] **Step 6: Wire the Resume button in the click handler**

  In `root.addEventListener("click", ...)`, add a `resume` case alongside the existing actions:

  ```typescript
  } else if (target.dataset.action === "resume") {
    scene.resumeGame();
  } else if (target.dataset.action === "respawn") {
  ```

  (Insert before `respawn` so the else-if chain remains readable.)

- [ ] **Step 7: Update the hint text to include the new controls**

  Change the hint `<p>` in the HTML template from:

  ```
  Controls: left click move/attack, right click Fire Bomb, WASD override, 1 Cleave Shot, 2 Fire Bomb, 3 Frost Nova, 4 Venom Shot, I inventory, Space potion, F1 debug, F5 test loot.
  ```

  To:

  ```
  Controls: left click move/attack, right click Fire Bomb, WASD override, 1 Cleave Shot, 2 Fire Bomb, 3 Frost Nova, 4 Venom Shot, I inventory, Space potion, Esc pause, F1 debug, F2 god mode, F5 test loot.
  ```

- [ ] **Step 8: Verify types**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 9: Manual smoke test**

  - Start the dev server: `npm run dev`
  - Press **Escape** mid-game → overlay appears with "PAUSED", game freezes
  - Click **Resume** → overlay hides, game resumes
  - Press **Escape** again → overlay appears again
  - Die to an enemy → overlay appears with "YOU DIED"
  - Click **Respawn** → player respawns, overlay hides
  - Click **Load Last Save** → save loaded, overlay hides
  - Click **New Game** → new run starts, overlay hides
  - Press **F2** → combat log shows "God mode ON", take hits from enemies — no damage
  - Press **F2** again → combat log shows "God mode OFF", damage resumes
  - Sidebar combat log no longer shows action buttons when player is dead

- [ ] **Step 10: Commit**

  ```bash
  git add src/ui/bootstrap.ts src/styles.css
  git commit -m "feat: add in-canvas death/pause menu overlay and remove sidebar death buttons"
  ```
