import type { IControllablePlayer, Position, Direction } from '@/types/game';
import { TILE_SIZE } from '@/config/gameConfig';

/** Highlight ring radius (pixels) — makes player easy to locate when tabbing back */
const HIGHLIGHT_RADIUS = 20;
const HIGHLIGHT_COLOR = 0xffffff;
const HIGHLIGHT_ALPHA = 0.85;
const STEP_BOB_PIXELS = 3;
const STEP_BOB_HALF_DURATION = 75;
const STEP_WADDLE_DEGREES = 2.4;
const SHADOW_COLOR = 0x05080f;
const SHADOW_ALPHA = 0.38;

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
  private waddleTween: Phaser.Tweens.Tween | null = null;
  private landTween: Phaser.Tweens.Tween | null = null;
  private stepParity = 1;

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

    // Cast shadow grounds the sprite; the step bob lifts the sprite above it.
    const shadow = scene.add.graphics();
    shadow.fillStyle(SHADOW_COLOR, SHADOW_ALPHA);
    shadow.fillEllipse(0, 12, 20, 7);
    this.container.add(shadow);

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
    this.waddleTween?.stop();
    this.landTween?.stop();
    this.resetWalkPose();
    this.stepParity = -this.stepParity;

    const repeats = Math.max(0, Math.round(durationMs / (STEP_BOB_HALF_DURATION * 2)) - 1);
    this.walkTween = this.scene.tweens.add({
      targets: this.sprite,
      y: -STEP_BOB_PIXELS,
      duration: STEP_BOB_HALF_DURATION,
      yoyo: true,
      repeat: repeats,
      ease: 'Sine.easeInOut',
      onComplete: () => this.settleStep(),
    });
    // Alternating lean sells a walk cycle without extra frames.
    this.waddleTween = this.scene.tweens.add({
      targets: this.sprite,
      angle: STEP_WADDLE_DEGREES * this.stepParity,
      duration: STEP_BOB_HALF_DURATION,
      yoyo: true,
      repeat: repeats,
      ease: 'Sine.easeInOut',
    });
  }

  endStep(): void {
    this.walkTween?.stop();
    this.waddleTween?.stop();
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

  /** Brief squash when a step tween ran to completion — the landing beat. */
  private settleStep(): void {
    this.waddleTween?.stop();
    this.resetWalkPose();
    this.landTween?.stop();
    this.sprite.setScale(1.05, 0.94);
    this.landTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1,
      scaleY: 1,
      duration: 70,
      ease: 'Sine.easeOut',
    });
  }

  private resetWalkPose(): void {
    this.walkTween = null;
    this.waddleTween = null;
    this.sprite.setY(0);
    this.updateFacingVisual();
  }
}
