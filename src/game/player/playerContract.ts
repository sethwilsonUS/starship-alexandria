import type { FootstepSurface } from '@/game/expeditions';
import type { Direction, InteractiveType, Position } from '@/types/game';

export type MovementBlockReason = 'edge' | 'terrain' | 'entity';

export interface PlayerGridCell {
  walkable: boolean;
  surface: FootstepSurface;
}

/** Minimal, Phaser-free world view required to decide a player step. */
export interface PlayerGrid {
  width: number;
  height: number;
  cellAt: (point: Position) => PlayerGridCell | null;
  blockedEntityIdsAt: (point: Position) => readonly string[];
}

export type DirectionalMoveResult =
  | {
      type: 'movement.succeeded';
      direction: Direction;
      from: Position;
      to: Position;
      surface: FootstepSurface;
    }
  | {
      type: 'movement.blocked';
      direction: Direction;
      from: Position;
      attempted: Position;
      reason: MovementBlockReason;
      entityIds?: readonly string[];
    };

export interface PlayerInteractive {
  id: string;
  type: InteractiveType;
  position: Position;
  range: 'on' | 'adjacent';
  label?: string;
}

export type InteractionTargetResult =
  | { type: 'interaction.available'; target: PlayerInteractive }
  | { type: 'interaction.unavailable' };

export function resolveDirectionalMove(
  command: { position: Position; direction: Direction },
  grid: PlayerGrid,
): DirectionalMoveResult {
  const { position: from, direction } = command;
  const delta = directionDelta(direction);
  const attempted = { x: from.x + delta.x, y: from.y + delta.y };
  const blocked = (reason: MovementBlockReason, entityIds?: readonly string[]): DirectionalMoveResult => ({
    type: 'movement.blocked',
    direction,
    from: { ...from },
    attempted,
    reason,
    ...(entityIds?.length ? { entityIds } : {}),
  });

  if (attempted.x < 0 || attempted.x >= grid.width || attempted.y < 0 || attempted.y >= grid.height) {
    return blocked('edge');
  }

  const entityIds = grid.blockedEntityIdsAt(attempted);
  if (entityIds.length > 0) return blocked('entity', [...entityIds]);

  const cell = grid.cellAt(attempted);
  if (!cell?.walkable) return blocked('terrain');

  return {
    type: 'movement.succeeded',
    direction,
    from: { ...from },
    to: attempted,
    surface: cell.surface,
  };
}

export function resolveInteractionTarget(
  position: Position,
  interactives: readonly PlayerInteractive[],
): InteractionTargetResult {
  const exact = interactives.find((interactive) =>
    interactive.range === 'on' && samePoint(position, interactive.position));
  if (exact) return { type: 'interaction.available', target: exact };

  const adjacent = interactives.find((interactive) =>
    interactive.range === 'adjacent' && manhattanDistance(position, interactive.position) === 1);
  return adjacent
    ? { type: 'interaction.available', target: adjacent }
    : { type: 'interaction.unavailable' };
}

function directionDelta(direction: Direction): Position {
  switch (direction) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
}

function samePoint(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
