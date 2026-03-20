# How Web Games Work — General Concepts

A foundation for understanding this project before diving into its code.

---

## What is a "web game"?

A web game runs entirely inside a browser. There is no download — you just open a URL and play. The game is built from the same HTML, CSS, and JavaScript that any website uses, but instead of displaying text and buttons it draws and animates a game world every fraction of a second.

This project is a **2D action RPG** — a top-down game where you move a character, fight enemies, collect loot, and level up, similar in spirit to Diablo or Path of Exile but much smaller in scope.

---

## The Canvas and Phaser

Browsers provide a native `<canvas>` element — essentially a rectangle of pixels you can draw anything onto with JavaScript. You can draw circles, rectangles, text, images, or anything else.

**Phaser** is a JavaScript game framework that wraps the canvas and gives you:

- A **scene** system to organise game states (loading screen, main menu, gameplay, etc.)
- **Game objects** (circles, rectangles, text, sprites) that are easy to create, move, and destroy
- A **camera** that follows the player and lets the world scroll
- An **input system** for keyboard and mouse
- A built-in **timer** for scheduling events
- **Tweens** for smooth animations

Think of Phaser as "jQuery for games" — it does not write your game for you, but it handles all the tedious low-level browser work.

---

## The Game Loop

The most important concept in game programming is the **game loop**.

Every game runs a loop, many times per second, that does three things:

```
1. Read input     — check what keys/mouse are pressed right now
2. Update state   — move characters, resolve combat, tick timers
3. Draw           — repaint the canvas to match the new state
```

Phaser calls your `update()` function automatically, usually 60 times per second (60 FPS). Each call is one "frame". The time between frames is called `delta` (in milliseconds).

### Why delta matters

If your game logic says "move the player 5 pixels every frame", the player will move twice as fast on a 120 Hz monitor as on a 60 Hz monitor. That is wrong.

The correct way is: **move the player at a speed in pixels-per-second, then multiply by delta / 1000**.

```
newX = oldX + (moveSpeed * delta / 1000)
```

This project uses delta time everywhere — search for `delta / 1000` in any system file.

---

## Coordinates

The canvas uses a **2D coordinate system** where:

- `x = 0, y = 0` is the **top-left** corner
- `x` increases going **right**
- `y` increases going **down** (opposite of school math!)

So if the player is at `(240, 680)`, they are 240 pixels from the left edge and 680 pixels from the top.

The zones in this game are larger than the visible screen (e.g. the Ruined Crossroads is 1800×1200 pixels). Phaser's **camera** tracks the player and automatically scrolls the view — the game objects stay at their world coordinates but the camera decides which part of the world to display.

---

## Scenes

Phaser organises game state into **Scenes**. A scene is like a "mode" of the game:

| Scene | Purpose |
|-------|---------|
| `BootScene` | Runs immediately on start — does nothing except launch `GameScene` |
| `GameScene` | The actual gameplay — everything you see and interact with |

Only one scene is running at a time (in this project).

---

## TypeScript

This project is written in **TypeScript**, which is JavaScript with type annotations. Types let you say "this variable must be a number" or "this function returns an `ActorState`". The browser cannot run TypeScript directly — it is compiled down to plain JavaScript by Vite (the build tool) before being served.

**Vite** also provides Hot Module Replacement (HMR): when you save a file, the browser auto-refreshes without losing game state.

---

## Summary

```
Browser
  └── HTML page loads index.html
        └── Vite bundles TypeScript → JavaScript
              └── Phaser creates <canvas>
                    └── Game loop runs ~60 times/second
                          ├── Read keyboard + mouse
                          ├── Update all game systems
                          └── Draw everything to canvas
```

The next document explains exactly what happens when a user first opens this game in the browser.
