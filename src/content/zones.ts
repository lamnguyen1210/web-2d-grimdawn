import type { ZoneDefinition } from "../gameplay/types";

export const zoneDefinitions: Record<string, ZoneDefinition> = {
  crossroads: {
    id: "crossroads",
    name: "Ruined Crossroads",
    width: 1800,
    height: 1200,
    playerSpawn: { x: 240, y: 680 },
    encounters: [
      {
        id: "crossroads-west-pack",
        zoneId: "crossroads",
        spawns: [
          { enemyId: "scavenger", x: 430, y: 560 },
          { enemyId: "scavenger", x: 490, y: 620 },
          { enemyId: "cultist", x: 560, y: 560 },
        ],
      },
      {
        id: "crossroads-center-pack",
        zoneId: "crossroads",
        chest: true,
        spawns: [
          { enemyId: "bruiser", x: 860, y: 440 },
          { enemyId: "cultist", x: 930, y: 390 },
          { enemyId: "scavenger", x: 980, y: 500 },
        ],
      },
      {
        id: "crossroads-east-pack",
        zoneId: "crossroads",
        spawns: [
          { enemyId: "bruiser", x: 1290, y: 720 },
          { enemyId: "cultist", x: 1380, y: 660 },
          { enemyId: "cultist", x: 1450, y: 780 },
        ],
      },
    ],
    transition: {
      toZoneId: "arena",
      x: 1640,
      y: 470,
      width: 120,
      height: 240,
      targetX: 180,
      targetY: 520,
      label: "To Warden Arena",
    },
  },
  arena: {
    id: "arena",
    name: "Warden Arena",
    width: 1200,
    height: 960,
    playerSpawn: { x: 180, y: 520 },
    encounters: [
      {
        id: "warden-boss",
        zoneId: "arena",
        spawns: [{ enemyId: "warden", x: 820, y: 500 }],
      },
    ],
    transition: {
      toZoneId: "crossroads",
      x: 0,
      y: 400,
      width: 64,
      height: 240,
      targetX: 1520,
      targetY: 590,
      label: "Back to Crossroads",
    },
  },
};
