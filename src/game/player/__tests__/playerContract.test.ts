import { describe, expect, it } from 'vitest';
import {
  resolveDirectionalMove,
  resolveInteractionTarget,
  type PlayerGrid,
  type PlayerInteractive,
} from '../playerContract';

function grid(overrides: Partial<PlayerGrid> = {}): PlayerGrid {
  return {
    width: 3,
    height: 3,
    cellAt: (point) => ({
      walkable: !(point.x === 2 && point.y === 1),
      surface: point.x === 1 && point.y === 2 ? 'water' : 'stone',
    }),
    blockedEntityIdsAt: () => [],
    ...overrides,
  };
}

describe('resolveDirectionalMove', () => {
  it('returns a successful move with the destination surface', () => {
    expect(resolveDirectionalMove({ position: { x: 1, y: 1 }, direction: 'down' }, grid()))
      .toEqual({
        type: 'movement.succeeded',
        direction: 'down',
        from: { x: 1, y: 1 },
        to: { x: 1, y: 2 },
        surface: 'water',
      });
  });

  it('reports map edges, terrain, and blocking entities without moving', () => {
    expect(resolveDirectionalMove({ position: { x: 0, y: 0 }, direction: 'up' }, grid()))
      .toMatchObject({ type: 'movement.blocked', reason: 'edge' });
    expect(resolveDirectionalMove({ position: { x: 1, y: 1 }, direction: 'right' }, grid()))
      .toMatchObject({ type: 'movement.blocked', reason: 'terrain' });
    expect(resolveDirectionalMove(
      { position: { x: 1, y: 1 }, direction: 'left' },
      grid({ blockedEntityIdsAt: () => ['npc-imani'] }),
    )).toMatchObject({ type: 'movement.blocked', reason: 'entity', entityIds: ['npc-imani'] });
  });
});

describe('resolveInteractionTarget', () => {
  const interactives: PlayerInteractive[] = [
    { id: 'fragment', type: 'book', position: { x: 2, y: 1 }, range: 'on' },
    { id: 'npc', type: 'npc', position: { x: 1, y: 2 }, range: 'adjacent' },
  ];

  it('returns an exact-tile target before an adjacent target', () => {
    expect(resolveInteractionTarget({ x: 2, y: 1 }, interactives)).toEqual({
      type: 'interaction.available',
      target: interactives[0],
    });
  });

  it('returns an adjacent target at Manhattan distance one', () => {
    expect(resolveInteractionTarget({ x: 0, y: 2 }, interactives)).toEqual({
      type: 'interaction.available',
      target: interactives[1],
    });
  });

  it('returns an explicit unavailable result when nothing is in range', () => {
    expect(resolveInteractionTarget({ x: 0, y: 0 }, interactives)).toEqual({
      type: 'interaction.unavailable',
    });
  });
});
