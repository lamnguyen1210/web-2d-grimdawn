import type { QuestDefinition, ZoneId } from "./types";

export function isObjectiveComplete(
  type: string,
  targetId: string,
  clearedIds: Set<string>,
  visitedZones: Set<ZoneId>,
): boolean {
  if (type === "enter_zone") return visitedZones.has(targetId as ZoneId);
  return clearedIds.has(targetId);
}

export function isQuestComplete(
  quest: QuestDefinition,
  clearedIds: Set<string>,
  visitedZones: Set<ZoneId>,
): boolean {
  return quest.objectives.every((obj) =>
    isObjectiveComplete(obj.type, obj.targetId, clearedIds, visitedZones),
  );
}

export function getActiveQuest(
  quests: QuestDefinition[],
  clearedIds: Set<string>,
  visitedZones: Set<ZoneId>,
): QuestDefinition | undefined {
  return quests.find((q) => !isQuestComplete(q, clearedIds, visitedZones));
}
