import type { IControllablePlayer, Position, Direction } from '@/types/game';
import { TILE_SIZE } from '@/config/gameConfig';

/** Highlight ring radius (pixels) — makes player easy to locate when tabbing back */
const HIGHLIGHT_RADIUS = 20;
const HIGHLIGHT_COLOR = 0xffffff;
const HIGHLIGHT_ALPHA = 0.85;
const STEP_BOB_PIXELS = 3;
const STEP_BOB_HALF_DURATION = 75;

/**
 * Player entity: sprite + grid position + facing direction.
 * Uses composition; movement is delegated to a MovementController.
 * Includes a persistent highlight ring for accessibility (legally blind friendly).
 */
export class Player implements IControllablePlayer {
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly scene: Phaser.Scene;
  private gridX: number;
  private gridY: number;
  private facing: Direction;
  private walkTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    startX: number,
    startY: number
  ) {
    const pixelX = startX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = startY * TILE_SIZE + TILE_SIZE / 2;

    this.scene = scene;
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

  beginStep(durationMs: number): void {
    this.walkTween?.stop();
    this.resetWalkPose();

    const repeats = Math.max(0, Math.round(durationMs / (STEP_BOB_HALF_DURATION * 2)) - 1);
    this.walkTween = this.scene.tweens.add({
      targets: this.sprite,
      y: -STEP_BOB_PIXELS,
      duration: STEP_BOB_HALF_DURATION,
      yoyo: true,
      repeat: repeats,
      ease: 'Sine.easeInOut',
      onComplete: () => this.resetWalkPose(),
    });
  }

  endStep(): void {
    this.walkTween?.stop();
    this.resetWalkPose();
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

  /** Keep the Kenney player upright; facing is gameplay state, not sprite rotation. */
  private updateFacingVisual(): void {
    this.sprite.setAngle(0);
    this.sprite.setFlipX(this.facing === 'left');
  }

  private resetWalkPose(): void {
    this.walkTween = null;
    this.sprite.setY(0);
    this.updateFacingVisual();
  }
}
