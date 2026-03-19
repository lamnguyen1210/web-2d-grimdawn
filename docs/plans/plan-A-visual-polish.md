# Plan A: Visual Polish & Screen Effects

## Goal
Add visual feedback that makes combat feel more impactful and readable.

## Changes

### 1. Screen Shake on Critical Hits & Boss Attacks
- **File:** `RenderSystem.ts`
- Add `shakeCamera(intensity, duration)` method
- Call from `CombatSystem.applyDamage()` when crit lands
- Call from `AISystem` when boss attacks in phase 2

### 2. Burn Visual Indicator on Actors
- **File:** `RenderSystem.ts` → `refreshRenderState()`
- When `actor.status.burningUntil > time`, apply pulsing orange stroke on the actor body
- Already have `bodyHitUntil` flash — burn uses a different visual (stroke color cycle)

### 3. Death Corpse Fade-Out
- **File:** `RenderSystem.ts` → `refreshRenderState()`
- Currently dead actors instantly turn gray at 35% alpha — add a tween that fades them out over 1.2s then destroys them
- Track `deathAnimatedUntil` on ActorState to avoid re-triggering

### 4. XP Floating Text on Kill
- Already exists ("+Level N" on level up) — add XP gain floating text: "+22 XP" in gold color when enemy dies

## Files Modified
- `src/systems/RenderSystem.ts` — camera shake, burn glow, death fade
- `src/systems/CombatSystem.ts` — trigger shake on crits, XP text on kill
- `src/gameplay/types.ts` — add `deathAnimatedUntil` to ActorState

## Verification
- `npx tsc --noEmit` passes
- Manual: crits cause screen shake, burning actors glow orange, corpses fade out
