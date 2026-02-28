import type { IControllablePlayer, Position, Direction } from '@/types/game';
import { TILE_SIZE } from '@/config/gameConfig';

/** Highlight ring radius (pixels) — makes player easy to locate when tabbing back */
const HIGHLIGHT_RADIUS = 20;
const HIGHLIGHT_COLOR = 0xffffff;
const HIGHLIGHT_ALPHA = 0.85;

/**
 * Player entity: sprite + grid position + facing direction.
 * Uses composition; movement is delegated to a MovementController.
 * Includes a persistent highlight ring for accessibility (legally blind friendly).
 */
export class Player implements IControllablePlayer {
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  private gridX: number;
  private gridY: number;
  private facing: Direction;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    startX: number,
    startY: number
  ) {
    const pixelX = startX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = startY * TILE_SIZE + TILE_SIZE / 2;

    this.container = scene.add.container(pixelX, pixelY);
    this.container.setDepth(10);

    // Highlight ring — drawn first so it sits behind the sprite
    const ring = scene.add.graphics();
    ring.lineStyle(3, HIGHLIGHT_COLOR, HIGHLIGHT_ALPHA);
    ring.strokeCircle(0, 0, HIGHLIGHT_RADIUS);
    this.container.add(ring);

    this.sprite = scene.add.sprite(0, 0, textureKey);
    this.container.add(this.sprite);

    this.gridX = startX;
    this.gridY = startY;
    this.facing = 'down';
  }

  getGridPosition(): Position {
    return { x: this.gridX, y: this.gridY };
  }

  setGridPosition(x: number, y: number): void {
    this.gridX = x;
    this.gridY = y;
  }

  getDirection(): Direction {
    return this.facing;
  }

  setDirection(dir: Direction): void {
    this.facing = dir;
    this.updateFacingVisual();
  }

  getSprite(): Phaser.GameObjects.GameObject {
    return this.container;
  }

  getPixelPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /** Update sprite position to match grid (after tween completes) */
  setPixelPosition(pixelX: number, pixelY: number): void {
    this.container.setPosition(pixelX, pixelY);
  }

  /** Apply facing direction to sprite (angle for 4-dir top-down) */
  private updateFacingVisual(): void {
    const angles: Record<Direction, number> = {
      up: -90,
      down: 90,
      left: 180,
      right: 0,
    };
    this.sprite.setAngle(angles[this.facing]);
  }
}
