import type { RuntimeStateSnapshot, SaveGame } from "./types";

const SAVE_KEY = "web-2d-grimdawn-save";
export const SAVE_VERSION = 1;

export const loadSave = (): SaveGame | null => {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SaveGame;
    if (parsed.version !== SAVE_VERSION) {
      window.localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const writeSave = (snapshot: RuntimeStateSnapshot): void => {
  const save: SaveGame = {
    version: SAVE_VERSION,
    zoneId: snapshot.zoneId,
    player: {
      x: snapshot.player.x,
      y: snapshot.player.y,
      level: snapshot.level,
      xp: snapshot.xp,
      nextLevelXp: snapshot.nextLevelXp,
      health: snapshot.player.health,
      energy: snapshot.player.energy,
    },
    inventory: snapshot.inventory,
    clearedEncounterIds: snapshot.clearedEncounterIds,
  };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
};

export const resetSave = (): void => {
  window.localStorage.removeItem(SAVE_KEY);
};
