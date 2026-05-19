import { AUTO, Game } from 'phaser';
import BootScene from './scenes/BootScene';
import ExploreScene from './scenes/ExploreScene';
import ShipScene from './scenes/ShipScene';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, ExploreScene, ShipScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;
