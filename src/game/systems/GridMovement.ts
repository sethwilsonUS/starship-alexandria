import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import type { MovementController, MovementContext, Direction } from '@/types/game';
import type { IControllablePlayer } from '@/types/game';
import { TILE_SIZE, PLAYER_MOVE_DURATION, PLAYER_MOVE_DURATION_SLOW } from '@/config/gameConfig';
import type { GameInputAction } from '@/game/input/InputActionRouter';
import { resolveDirectionalMove } from '@/game/player/playerContract';
import { shouldUseMotion } from '@/game/motionPolicy';

const MOVEMENT_BLOCKED_PHASES: readonly string[] = ['dialogue', 'reading', 'viewing-map'];

let playerMidStep = false;

/** Observability for the E2E snapshot: true while a movement tween is carrying the player between tiles. */
export function isPlayerMidStep(): boolean {
  return playerMidStep;
}

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
  private boundHandler: (({ action }: { action: GameInputAction }) => void) | null = null;

  attach(
    scene: Scene,
    player: IControllablePlayer,
    context: MovementContext
  ): void {
    this.scene = scene;
    this.player = player;
    this.context = context;

    this.boundHandler = this.handleKeyDown.bind(this);
    EventBridge.on('input-action', this.boundHandler);
    scene.events.once('shutdown', () => this.detach());
  }

  detach(): void {
    if (this.boundHandler) {
      EventBridge.off('input-action', this.boundHandler);
    }
    this.scene = null;
    this.player = null;
    this.context = null;
    this.boundHandler = null;
  }

  private handleKeyDown({ action }: { action: GameInputAction }): void {
    if (!this.scene || !this.player || !this.context || this.isMoving) return;

    const gamePhase = useGameStore.getState().session.gamePhase;
    if (MOVEMENT_BLOCKED_PHASES.includes(gamePhase)) return;

    if (action === 'move.up') this.tryMove('up');
    if (action === 'move.down') this.tryMove('down');
    if (action === 'move.left') this.tryMove('left');
    if (action === 'move.right') this.tryMove('right');
  }

  private tryMove(direction: Direction): boolean {
    if (!this.scene || !this.player || !this.context) return false;
    if (this.isMoving) return false;
    const gamePhase = useGameStore.getState().session.gamePhase;
    if (MOVEMENT_BLOCKED_PHASES.includes(gamePhase)) return false;

    const pos = this.player.getGridPosition();
    const result = resolveDirectionalMove(
      { position: pos, direction },
      {
        width: this.context.mapWidth,
        height: this.context.mapHeight,
        blockedEntityIdsAt: ({ x, y }) =>
          this.context?.getBlockedTiles?.().has(`${x},${y}`) ? ['blocking-entity'] : [],
        cellAt: ({ x, y }) => {
          const semanticCell = this.context?.getSemanticCell?.(x, y);
          if (semanticCell) return semanticCell;
          const tile = this.context?.wallLayer.getTileAt(x, y);
          const isBlocked = Boolean(tile && [4, 5].includes(tile.index));
          const surface = this.context?.getSurfaceAt?.(x, y)
            ?? (this.context?.getFloodedTiles?.().has(`${x},${y}`) ? 'water' : 'stone');
          return { walkable: !isBlocked, surface };
        },
      },
    );

    if (result.type === 'movement.blocked') {
      EventBridge.emit('movement-blocked', { reason: result.reason });
      return false;
    }

    const { x: targetX, y: targetY } = result.to;
    const duration = result.surface === 'water' ? PLAYER_MOVE_DURATION_SLOW : PLAYER_MOVE_DURATION;

    this.isMoving = true;
    playerMidStep = true;
    EventBridge.emit('player-moving');
    this.player.setDirection(direction);
    if (shouldUseMotion(useGameStore.getState().settings.motionPreference)) {
      this.player.beginStep?.(duration);
    }

    const pixelTargetX = targetX * TILE_SIZE + TILE_SIZE / 2;
    const pixelTargetY = targetY * TILE_SIZE + TILE_SIZE / 2;

    this.scene.tweens.add({
      targets: this.player.getSprite(),
      x: pixelTargetX,
      y: pixelTargetY,
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.player!.endStep?.();
        this.player!.setGridPosition(targetX, targetY);
        this.isMoving = false;
        playerMidStep = false;
        EventBridge.emit('player-moved', { x: targetX, y: targetY, surface: result.surface });
      },
    });

    return true;
  }

}
