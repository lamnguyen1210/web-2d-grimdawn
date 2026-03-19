import Phaser from "phaser";
import type { ActorState } from "../gameplay/types";

/**
 * Move `actor` towards (x, y) at `speed` px/s.
 * Returns true when the actor has arrived (within 4 px).
 */
export function moveActorTowards(
  actor: ActorState,
  x: number,
  y: number,
  speed: number,
  delta: number,
  zoneW: number,
  zoneH: number,
): boolean {
  const direction = new Phaser.Math.Vector2(x - actor.x, y - actor.y);
  const distance = direction.length();
  if (distance <= 4) {
    actor.x = x;
    actor.y = y;
    return true;
  }
  direction.normalize().scale(speed * (delta / 1000));
  actor.x = Phaser.Math.Clamp(actor.x + direction.x, 16, zoneW - 16);
  actor.y = Phaser.Math.Clamp(actor.y + direction.y, 16, zoneH - 16);
  return false;
}

/** Move `actor` away from (x, y) at `speed` px/s. */
export function moveActorAway(
  actor: ActorState,
  x: number,
  y: number,
  speed: number,
  delta: number,
  zoneW: number,
  zoneH: number,
): void {
  const direction = new Phaser.Math.Vector2(actor.x - x, actor.y - y);
  if (direction.lengthSq() === 0) {
    direction.setTo(1, 0);
  }
  direction.normalize().scale(speed * (delta / 1000));
  actor.x = Phaser.Math.Clamp(actor.x + direction.x, 16, zoneW - 16);
  actor.y = Phaser.Math.Clamp(actor.y + direction.y, 16, zoneH - 16);
}

/** Push `actor` away from (sourceX, sourceY) by `distance` px instantly. */
export function pushActor(
  actor: ActorState,
  sourceX: number,
  sourceY: number,
  distance: number,
  zoneW: number,
  zoneH: number,
): void {
  const direction = new Phaser.Math.Vector2(actor.x - sourceX, actor.y - sourceY);
  if (direction.lengthSq() === 0) {
    direction.setTo(1, 0);
  }
  direction.normalize().scale(distance);
  actor.x = Phaser.Math.Clamp(actor.x + direction.x, 16, zoneW - 16);
  actor.y = Phaser.Math.Clamp(actor.y + direction.y, 16, zoneH - 16);
}

/** Return the nearest alive enemy within `maxDistance` of (x, y), or undefined. */
export function getNearestEnemy(
  actors: Map<string, ActorState>,
  activeZoneId: string,
  x: number,
  y: number,
  maxDistance: number,
): ActorState | undefined {
  return [...actors.values()]
    .filter((actor) => actor.faction === "enemy" && actor.alive && actor.zoneId === activeZoneId)
    .sort(
      (a, b) =>
        Phaser.Math.Distance.Between(a.x, a.y, x, y) -
        Phaser.Math.Distance.Between(b.x, b.y, x, y),
    )
    .find((actor) => Phaser.Math.Distance.Between(actor.x, actor.y, x, y) <= maxDistance + actor.radius);
}
