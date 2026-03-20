# Startup Flow — From Browser to Gameplay

This document traces the exact sequence of code that runs from the moment a user opens the game URL to the moment they can move their character.

---

## Step 1 — Browser loads `index.html`

The web server delivers a plain HTML file. The `<body>` contains one element:

```html
<div id="app"></div>
```

The HTML file also has a `<script>` tag that loads the bundled JavaScript. The browser executes it, which starts everything.

**File: `index.html`** (root of the project)

---

## Step 2 — Vite serves the bundle

In development (`npm run dev`), Vite acts as a dev server. It compiles TypeScript to JavaScript on demand and serves it. In production (`npm run build`), it outputs static files.

The entry point the browser receives is:

**File: `src/main.ts`**

```typescript
import "./styles.css";
import { bootstrapApp } from "./ui/bootstrap";

bootstrapApp(document.querySelector<HTMLDivElement>("#app"));
```

Two things happen:
1. The global CSS is loaded (fonts, colours, layout)
2. `bootstrapApp` is called with the `#app` div

---

## Step 3 — `bootstrapApp` builds the HTML shell

**File: `src/ui/bootstrap.ts`**

`bootstrapApp` injects the full UI structure into the `#app` div using `innerHTML`. It creates:

- `.viewport` — contains the Phaser canvas and all overlay panels
- `#game-root` — the empty div where Phaser will mount the `<canvas>`
- `#game-menu` — the pause/death overlay (hidden at start)
- `#inventory-popup` — the inventory screen (hidden at start)

Then it calls:

```typescript
const game = createGame(root.querySelector("#game-root")!);
```

---

## Step 4 — Phaser game is created

**File: `src/engine/game.ts`**

```typescript
export const createGame = (parent: HTMLElement): Phaser.Game => {
  validateContent();

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#120f0d",
    scale: { mode: Phaser.Scale.RESIZE, ... },
    scene: [BootScene, GameScene],
  });
};
```

`validateContent()` runs first — it checks that all enemy IDs referenced in zone encounters actually exist in `enemyDefinitions`. This catches data bugs at startup rather than at runtime.

`new Phaser.Game(...)` creates the Phaser engine. Key config:

| Option | Meaning |
|--------|---------|
| `type: Phaser.AUTO` | Use WebGL if available, otherwise fall back to Canvas 2D |
| `parent` | The `#game-root` div — Phaser creates a `<canvas>` inside it |
| `scene: [BootScene, GameScene]` | The list of scenes; the first one starts automatically |

---

## Step 5 — BootScene runs

**File: `src/scenes/BootScene.ts`**

```typescript
create(): void {
  this.scene.start("game");
}
```

`BootScene` is intentionally minimal. In a full game, you would load images, audio, fonts here. This project uses only Phaser's built-in shapes and text, so there is nothing to load — `BootScene` immediately transitions to `GameScene`.

---

## Step 6 — GameScene.create() runs

**File: `src/scenes/GameScene.ts`, `create()` method**

This is the big one. It runs once when GameScene first starts. Here is everything it does, in order:

### 6a — Camera background colour
```typescript
this.cameras.main.setBackgroundColor("#171311");
```

### 6b — Register keyboard keys
```typescript
this.wasd = {
  W: this.input.keyboard!.addKey("W"),
  A: this.input.keyboard!.addKey("A"),
  ...
};
this.skill1Key = this.input.keyboard!.addKey("ONE");
// ... etc
```
Phaser wraps the browser's raw `keydown`/`keyup` events into convenient `Key` objects you can poll each frame.

### 6c — Create HUD text objects
Three `Phaser.GameObjects.Text` are created:
- `zoneText` — zone name shown top-left
- `hudText` — health/energy/cooldown bar shown below that
- `debugText` — hidden debug info (press F1)

These have `setScrollFactor(0)` — they are fixed to the screen, not the world.

### 6d — Build the GameContext
```typescript
this.ctx = {
  scene: this,
  player: undefined,  // filled in a moment
  actors: new Map(),
  projectiles: new Map(),
  hazards: new Map(),
  pickups: new Map(),
  inventory: { gold: 0, potions: 3, items: [], equipped: {} },
  level: 1,
  xp: 0,
  activeZoneId: "crossroads",
  // ... all the Maps and HUD refs
  autosave: () => this.autosave(),
  log: (msg) => this.log(msg),
};
```

`GameContext` is the **shared state bag** — a single object every system reads and writes. There is no global state, no singleton, no message bus. Every system gets a reference to `ctx` and mutates it directly.

### 6e — Instantiate all systems
```typescript
this.render  = new RenderSystem(this.ctx);
this.loot    = new LootSystem(this.ctx);
this.combat  = new CombatSystem(this.ctx, this.render, this.loot);
this.skill   = new SkillSystem(this.ctx, this.combat, this.render);
this.zone    = new ZoneSystem(this.ctx, this.render, this.loot);
this.ai      = new AISystem(this.ctx, this.combat, this.zone);
```

Each system receives only the dependencies it actually needs. The dependency graph is a tree with no cycles:

```
RenderSystem   ← no deps
LootSystem     ← no deps
CombatSystem   ← RenderSystem, LootSystem
SkillSystem    ← CombatSystem, RenderSystem
ZoneSystem     ← RenderSystem, LootSystem
AISystem       ← CombatSystem, ZoneSystem
```

### 6f — Register mouse listeners
```typescript
this.input.on("pointerdown", (pointer) => {
  if (pointer.rightButtonDown()) {
    this.skill.tryCastFireBomb(...);
    return;
  }
  const clickedEnemy = getNearestEnemy(..., pointer.worldX, pointer.worldY, 28);
  if (clickedEnemy) {
    this.ctx.player.targetId = clickedEnemy.id;  // lock target
  } else {
    this.ctx.player.moveTarget = { x: ..., y: ... };  // move to ground
  }
});
```

### 6g — restoreOrStart()
This is where the player character is actually created. It either:
- Loads a saved game from `localStorage`
- Or creates a fresh game with default values

After this, `ctx.player` exists, `zone.spawnZone("crossroads")` has placed enemies, and `render.createZoneVisuals()` has drawn the ground and zone boundary.

### 6h — Emit "ready" event
```typescript
this.game.events.emit("ready");
```
This signal causes `bootstrap.ts` to call `render()` for the first time, populating the sidebar UI.

---

## Step 7 — The UI polling loop starts

Back in `bootstrap.ts`:

```typescript
window.setInterval(render, 180);
```

Every 180 ms, the sidebar UI re-reads `scene.getSnapshot()` and rewrites the inventory/pause panels. This is a simple polling approach — no reactive state, no React, just a timer.

---

## Step 8 — Phaser's game loop begins

Phaser now calls `GameScene.update(time, delta)` approximately 60 times per second. This is where all real-time gameplay runs. See the next documents for details on each system.

---

## Full sequence at a glance

```
Browser opens URL
  → index.html loads
    → main.ts runs
      → bootstrapApp() builds HTML shell
        → createGame() validates content data, creates Phaser
          → BootScene.create() → starts GameScene immediately
            → GameScene.create()
              ├── register keys
              ├── create HUD objects
              ├── build GameContext (empty Maps)
              ├── instantiate 6 systems
              ├── register mouse listeners
              ├── restoreOrStart()
              │     ├── load save from localStorage (or use defaults)
              │     ├── build player ActorState
              │     ├── zone.spawnZone("crossroads") → enemies added to ctx.actors
              │     ├── render.createZoneVisuals() → draws floor/boundary
              │     └── render.syncActorViews() → draws all actors
              └── emit "ready" → sidebar renders for first time
          → Phaser game loop starts → update() called 60/s
```
