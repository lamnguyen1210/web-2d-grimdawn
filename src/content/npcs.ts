import type { NpcKind, ZoneId } from "../gameplay/types";

export interface NpcSpawn {
  id: string;
  kind: NpcKind;
  name: string;
  x: number;
  y: number;
}

export const npcSpawnsByZone: Partial<Record<ZoneId, NpcSpawn[]>> = {
  town: [
    { id: "merchant-aldric", kind: "merchant", name: "Merchant Aldric", x: 400, y: 240 },
    { id: "healer-seline",   kind: "healer",   name: "Healer Seline",   x: 540, y: 360 },
  ],
};
