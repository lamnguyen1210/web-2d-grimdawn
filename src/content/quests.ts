import type { QuestDefinition } from "../gameplay/types";

export const questDefinitions: QuestDefinition[] = [
  {
    id: "first-blood",
    title: "First Blood",
    objectives: [
      { id: "ob-west",   description: "Clear the west crossroads pack",   type: "kill_encounter", targetId: "crossroads-west-pack"   },
      { id: "ob-center", description: "Clear the center crossroads pack", type: "kill_encounter", targetId: "crossroads-center-pack" },
      { id: "ob-east",   description: "Clear the east crossroads pack",   type: "kill_encounter", targetId: "crossroads-east-pack"   },
    ],
  },
  {
    id: "into-the-dark",
    title: "Into the Dark",
    objectives: [
      { id: "ob-hollow",  description: "Enter Blighted Hollow",  type: "enter_zone", targetId: "hollow"  },
      { id: "ob-ashveil", description: "Enter Ashveil Descent",  type: "enter_zone", targetId: "ashveil" },
    ],
  },
  {
    id: "depths-of-the-mire",
    title: "Depths of the Mire",
    objectives: [
      { id: "ob-stalker", description: "Clear the stalker pack in Deepmire", type: "kill_encounter", targetId: "deepmire-stalker-pack" },
      { id: "ob-wraith",  description: "Clear the wraith pack in Deepmire",  type: "kill_encounter", targetId: "deepmire-wraith-pack"  },
      { id: "ob-boss",    description: "Clear the boss pack in Deepmire",    type: "kill_encounter", targetId: "deepmire-boss-pack"    },
    ],
  },
];
