# Rendering — How Things Get Drawn on Screen

---

## Overview

All visual output is handled by `RenderSystem`. It creates, updates, and destroys Phaser game objects to match the current game state.

**File: `src/systems/RenderSystem.ts`**

The key concept: **game state and visuals are kept separate**. The `ActorState` at `ctx.player` holds the position `(x, y)`. The Phaser game object at `ctx.actorViews.get("player")` is the actual circle you see on screen. `RenderSystem` keeps the visual in sync with the state — it reads the state, then moves/resizes/recolors the visual.

---

## Phaser game objects used in this project

| Object | What it is | Used for |
|--------|-----------|----------|
| `Phaser.GameObjects.Arc` | Circle | Actors (player, enemies), projectiles, hazards, pickups |
| `Phaser.GameObjects.Ellipse` | Ellipse | Drop shadows under actors |
| `Phaser.GameObjects.Rectangle` | Rectangle | HP bars, UI overlay, minimap |
| `Phaser.GameObjects.Text` | Text label | Names, zone text, HUD, floating damage numbers |

This game uses **no images at all** — every visual is a coloured shape.

---

## Actor views

For each actor, `RenderSystem` maintains a `RenderActor`:

```typescript
interface RenderActor {
  body:      Phaser.GameObjects.Arc;        // the circle that is the character
  shadow:    Phaser.GameObjects.Ellipse;    // dark ellipse below (depth illusion)
  hpBarBg:   Phaser.GameObjects.Rectangle; // grey health bar background
  hpBar:     Phaser.GameObjects.Rectangle; // coloured health bar fill
  nameLabel: Phaser.GameObjects.Text;      // name above the character
}
```

These are stored in `ctx.actorViews: Map<string, RenderActor>`.

### Creating actor views — syncActorViews()

Called after spawning a zone, this creates Phaser objects for every actor in `ctx.actors`:

```typescript
syncActorViews() {
  for (const [id, actor] of ctx.actors) {
    if (ctx.actorViews.has(id)) continue;  // already exists

    const body = scene.add.circle(actor.x, actor.y, actor.radius, actor.color);
    body.setDepth(10);

    const shadow = scene.add.ellipse(actor.x, actor.y + actor.radius * 0.6, ...);
    shadow.setDepth(8);

    const hpBar = scene.add.rectangle(actor.x, actor.y + actor.radius + 8, ...);
    // ...
    const nameLabel = scene.add.text(actor.x, actor.y - actor.radius - 10, actor.name, {...});

    ctx.actorViews.set(id, { body, shadow, hpBarBg, hpBar, nameLabel });
  }
}
```

### Updating actor views — refreshRenderState()

Called every frame, this reads the current game state and positions/colors all visuals:

```typescript
refreshRenderState(time) {
  for (const [id, actor] of ctx.actors) {
    const view = ctx.actorViews.get(id);

    if (!actor.alive) {
      // Death fade-out: shrink over 1.2 seconds, then destroy
      const progress = (time - (actor.deathAnimatedUntil - 1200)) / 1200;
      view.body.setAlpha(1 - progress);
      if (time >= actor.deathAnimatedUntil) destroyActorView(id);
      continue;
    }

    // Move the visual to the actor's world position
    view.body.setPosition(actor.x, actor.y);
    view.shadow.setPosition(actor.x, actor.y + actor.radius * 0.6);
    view.nameLabel.setPosition(actor.x, actor.y - actor.radius - 10);

    // Update HP bar width
    const hpPercent = actor.health / actor.stats.maxHealth;
    view.hpBar.setSize(hpPercent * (actor.radius * 2.2), 4);

    // Hit flash: white briefly on damage
    const isHit = actor.bodyHitUntil !== undefined && time - actor.bodyHitUntil < 120;
    view.body.setFillStyle(isHit ? 0xffffff : actor.color);

    // Burn: orange tint
    if (actor.status.burningUntil > time) view.body.setFillStyle(0xff6622);

    // Chill: blue tint
    if (actor.status.chilledUntil > time) view.body.setFillStyle(0x66bbff);
  }
}
```

---

## The camera

Phaser's camera follows the player and pans the world:

```typescript
// Set up in RenderSystem when a zone loads
cameras.main.setBounds(0, 0, zone.width, zone.height);
cameras.main.startFollow(playerBody, true, 0.12, 0.12);
//                                         ^lerp — smooth damping factor
```

`startFollow` with lerp = 0.12 means the camera smoothly catches up to the player rather than snapping. `setBounds` prevents the camera from scrolling past the zone edges.

---

## Depth layers

Depth controls which objects are drawn on top of others (higher depth = drawn later = on top):

| Depth | Contents |
|-------|---------|
| 1–2 | Ground tiles, floor |
| 5 | Zone boundary rectangle |
| 8 | Shadows |
| 9 | Hazard pools, frost nova ring |
| 10 | Actor bodies |
| 11 | Target ring |
| 15 | Projectiles |
| 20 | Attack effect visuals |
| 25 | HP bars |
| 30 | Name labels |
| 40 | Floating damage text |
| 50 | Minimap background |
| 55 | Minimap dots |
| 80 | Screen overlay (death darken) |
| 90 | HUD text (zone name, health bar, debug) |

---

## Floating damage text

```typescript
spawnFloatingText(x, y, text, color, fontSize = 14) {
  const label = scene.add.text(x, y, text, {
    fontFamily: "Trebuchet MS",
    fontSize: `${fontSize}px`,
    color,
    stroke: "#000000",
    strokeThickness: 3,
  });
  label.setDepth(40);

  const id = uuid();
  ctx.floatingTexts.set(id, label);

  tweens.add({
    targets: label,
    y: y - 38,         // float upward
    alpha: 0,          // fade out
    duration: 900,
    onComplete: () => { label.destroy(); ctx.floatingTexts.delete(id); },
  });
}
```

Every damage number, XP gain, level-up message, and skill name uses this function.

---

## HUD

The HUD is drawn as Phaser Text objects with `setScrollFactor(0)` — they stay fixed on screen and don't scroll with the camera.

```
Zone: Ruined Crossroads
HP: ████████░░ 130/160   Energy: ██████░░ 62/80
Cleave: Ready   Fire Bomb: 3.1s   Frost Nova: Ready   Venom: 1.2s
```

The HUD text is updated every frame in `RenderSystem.updateHud()`.

---

## Visual effects

### Attack effect (basic attack)
A white rectangle "slash" + orange circle "impact" appear on the target briefly:
- Duration: 120ms
- Then destroyed

### Click pulse
When you click, a ring appears at the click location and quickly fades:
- Ground click: gold ring
- Enemy click: orange ring

### Camera shake
On crit hits and events like level-up and boss death, the camera briefly shakes:
```typescript
cameras.main.shake(durationMs, intensity);
```

---

## Boss HP bar

When a boss enemy is in the current zone, a dedicated HP bar is shown at the bottom of the screen:

```
[ WARDEN ALCHEMIST ████████████████░░░░ 68% ]
```

It is created by `RenderSystem` on zone load if a boss is present and updated each frame.

---

## Combat log

The bottom-left area shows recent combat messages (last ~10 visible). Messages are:
- Added via `ctx.log(msg)` → `GameScene.log()` → `render.addCombatLogEntry(msg)`
- Stored in `ctx.combatLog` array (max 40 entries)
- Each is a Phaser Text object that fades after several seconds

Messages include: damage dealt, status effects applied, items picked up, encounters cleared, level ups, skill casts.
