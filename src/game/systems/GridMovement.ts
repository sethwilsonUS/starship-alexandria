import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import type { MovementController, MovementContext, Direction } from '@/types/game';
import type { IControllablePlayer } from '@/types/game';
import { TILE_SIZE, PLAYER_MOVE_DURATION, PLAYER_MOVE_DURATION_SLOW } from '@/config/gameConfig';

const MOVEMENT_BLOCKED_PHASES: readonly string[] = ['dialogue', 'reading', 'viewing-map'];

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/**
 * Grid-based movement controller.
 * Listens for arrow keys / WASD, checks collision, tweens sprite.
 * Implements MovementController for swappability with FreeMovementController.
 */
export class GridMovement implements MovementController {
  private scene: Scene | null = null;
  private player: IControllablePlayer | null = null;
  private context: MovementContext | null = null;
  private isMoving = false;
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;

  attach(
    scene: Scene,
    player: IControllablePlayer,
    context: MovementContext
  ): void {
    this.scene = scene;
    this.player = player;
    this.context = context;

    this.boundHandler = this.handleKeyDown.bind(this);
    scene.input.keyboard!.on('keydown', this.boundHandler);
    scene.events.once('shutdown', () => this.detach());
  }

  detach(): void {
    if (this.scene?.input?.keyboard && this.boundHandler) {
      this.scene.input.keyboard.off('keydown', this.boundHandler);
    }
    this.scene = null;
    this.player = null;
    this.context = null;
    this.boundHandler = null;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.scene || !this.player || !this.context || this.isMoving) return;

    const gamePhase = useGameStore.getState().session.gamePhase;
    if (MOVEMENT_BLOCKED_PHASES.includes(gamePhase)) return;

    const dir = KEY_MAP[event.code];
    if (!dir) return;

    event.preventDefault();
    this.tryMove(dir);
  }

  private tryMove(direction: Direction): boolean {
    if (!this.scene || !this.player || !this.context) return false;
    if (this.isMoving) return false;
    const gamePhase = useGameStore.getState().session.gamePhase;
    if (MOVEMENT_BLOCKED_PHASES.includes(gamePhase)) return false;

    const pos = this.player.getGridPosition();
    const { dx, dy } = directionDelta(direction);
    const targetX = pos.x + dx;
    const targetY = pos.y + dy;

    // Check what type of obstacle we hit (if any)
    const blockReason = this.getBlockReason(targetX, targetY);
    if (blockReason) {
      EventBridge.emit('movement-blocked', { reason: blockReason });
      return false;
    }

    const isFlooded = this.context!.getFloodedTiles?.().has(`${targetX},${targetY}`);
    const duration = isFlooded ? PLAYER_MOVE_DURATION_SLOW : PLAYER_MOVE_DURATION;

    this.isMoving = true;
    EventBridge.emit('player-moving');
    this.player.setDirection(direction);

    const pixelTargetX = targetX * TILE_SIZE + TILE_SIZE / 2;
    const pixelTargetY = targetY * TILE_SIZE + TILE_SIZE / 2;

    this.scene.tweens.add({
      targets: this.player.getSprite(),
      x: pixelTargetX,
      y: pixelTargetY,
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.player!.setGridPosition(targetX, targetY);
        this.isMoving = false;
        EventBridge.emit('player-moved', { x: targetX, y: targetY });
      },
    });

    return true;
  }

  private getBlockReason(tx: number, ty: number): string | null {
    if (!this.context) return 'unknown';
    const { wallLayer, mapWidth, mapHeight, getBlockedTiles } = this.context;
    
    // Out of bounds
    if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) return 'edge';

    // NPC or other entity blocking
    if (getBlockedTiles?.().has(`${tx},${ty}`)) return 'npc';

    // Wall or rubble
    const tile = wallLayer.getTileAt(tx, ty);
    if (tile && tile.index !== -1) {
      const WALL_INDICES = [4, 5];
      if (WALL_INDICES.includes(tile.index)) {
        return tile.index === 5 ? 'rubble' : 'wall';
      }
    }
    
    return null; // Not blocked
  }
}

function directionDelta(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'up': return { dx: 0, dy: -1 };
    case 'down': return { dx: 0, dy: 1 };
    case 'left': return { dx: -1, dy: 0 };
    case 'right': return { dx: 1, dy: 0 };
  }
}
