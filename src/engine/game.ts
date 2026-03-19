import Phaser from "phaser";
import { validateContent } from "../gameplay/content";
import { BootScene } from "../scenes/BootScene";
import { GameScene } from "../scenes/GameScene";

export const createGame = (parent: HTMLElement): Phaser.Game => {
  validateContent();

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#120f0d",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [BootScene, GameScene],
  });
};
