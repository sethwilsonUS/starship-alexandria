/**
 * Core game types used across Phaser and the store.
 */

import type { Scene } from 'phaser';
import type { FootstepSurface, SemanticCell } from '@/game/expeditions';

export interface Position {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Interactive object types (register with Interaction system) */
export type InteractiveType = 'book' | 'npc' | 'journal' | 'transporter' | 'battery' | 'map' | 'vault';

export interface Interactive {
  id: string;
  type: InteractiveType;
  gridX: number;
  gridY: number;
  label?: string;
  /** 'on' = stand on tile (books, journals, transporter); 'adjacent' = stand next to (NPCs) */
  interactionRange?: 'on' | 'adjacent';
}

/** Context needed for movement collision checks */
export interface MovementContext {
  wallLayer: Phaser.Tilemaps.TilemapLayer;
  mapWidth: number;
  mapHeight: number;
  /** Optional: tiles blocked by entities (e.g. NPCs). Returns coord strings "x,y". */
  getBlockedTiles?: () => Set<string>;
  /** Optional: flooded tiles (passable but slow). Returns coord strings "x,y". */
  getFloodedTiles?: () => Set<string>;
  /** Semantic terrain supplied by the pure expedition generator. */
  getSemanticCell?: (x: number, y: number) => Pick<SemanticCell, 'walkable' | 'surface'> | null;
  /** Compatibility surface lookup for hand-authored scenes. */
  getSurfaceAt?: (x: number, y: number) => FootstepSurface;
}

/** Minimal player API required by MovementController and InteractionSystem */
export interface IControllablePlayer {
  getGridPosition(): Position;
  setGridPosition(x: number, y: number): void;
  getDirection(): Direction;
  setDirection(dir: Direction): void;
  /** Optional visual movement cue for implementations with animated sprites. */
  beginStep?(durationMs: number): void;
  endStep?(): void;
  getSprite(): Phaser.GameObjects.GameObject;
  /** Pixel position for UI placement (same as container/sprite position) */
  getPixelPosition(): { x: number; y: number };
}

/**
 * Interface for movement controllers. Allows swapping GridMovement
 * for FreeMovementController later without changing Player.ts.
 */
export interface MovementController {
  attach(
    scene: Scene,
    player: IControllablePlayer,
    context: MovementContext
  ): void;
  detach(): void;
}
