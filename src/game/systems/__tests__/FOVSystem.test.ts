import { describe, it, expect } from 'vitest';
import { computeVisibleTiles } from '../FOVSystem';
import { TILE } from '@/data/tilesets';

/**
 * Helper: build a walls grid of given size, defaulting to all EMPTY (open).
 * Place walls by setting walls[y][x] = TILE.WALL after calling this.
 */
function makeOpenGrid(width: number, height: number): number[][] {
  const walls: number[][] = [];
  for (let y = 0; y < height; y++) {
    walls.push(new Array(width).fill(TILE.EMPTY));
  }
  return walls;
}

describe('computeVisibleTiles', () => {
  const SIZE = 15;

  it('always includes the origin tile', () => {
    const walls = makeOpenGrid(SIZE, SIZE);
    const visible = computeVisibleTiles(7, 7, {
      walls,
      mapWidth: SIZE,
      mapHeight: SIZE,
      radius: 5,
    });
    expect(visible.has('7,7')).toBe(true);
  });

  it('sees all tiles within radius in an open grid', () => {
    const walls = makeOpenGrid(SIZE, SIZE);
    const visible = computeVisibleTiles(7, 7, {
      walls,
      mapWidth: SIZE,
      mapHeight: SIZE,
      radius: 3,
    });
    // Origin should be visible
    expect(visible.has('7,7')).toBe(true);
    // Adjacent tiles (distance 1)
    expect(visible.has('8,7')).toBe(true);
    expect(visible.has('6,7')).toBe(true);
    expect(visible.has('7,8')).toBe(true);
    expect(visible.has('7,6')).toBe(true);
    // Tiles at distance 3 along cardinal
    expect(visible.has('10,7')).toBe(true);
    expect(visible.has('4,7')).toBe(true);
  });

  it('does not see tiles beyond the radius', () => {
    const walls = makeOpenGrid(SIZE, SIZE);
    const visible = computeVisibleTiles(7, 7, {
      walls,
      mapWidth: SIZE,
      mapHeight: SIZE,
      radius: 2,
    });
    // Distance 3 along cardinal should be outside radius 2
    expect(visible.has('10,7')).toBe(false);
    expect(visible.has('4,7')).toBe(false);
  });

  it('walls block line of sight', () => {
    const walls = makeOpenGrid(SIZE, SIZE);
    // Place a wall at (9,7) — should block vision to (10,7) and beyond
    walls[7][9] = TILE.WALL;

    const visible = computeVisibleTiles(7, 7, {
      walls,
      mapWidth: SIZE,
      mapHeight: SIZE,
      radius: 5,
    });

    // Wall tile itself may or may not be visible (implementation-dependent),
    // but the tile directly behind it should not be
    expect(visible.has('10,7')).toBe(false);
    expect(visible.has('11,7')).toBe(false);

    // Tiles in other directions should still be visible
    expect(visible.has('5,7')).toBe(true);
    expect(visible.has('7,5')).toBe(true);
  });

  it('does not include tiles outside map bounds', () => {
    const walls = makeOpenGrid(5, 5);
    const visible = computeVisibleTiles(0, 0, {
      walls,
      mapWidth: 5,
      mapHeight: 5,
      radius: 10,
    });

    for (const key of visible) {
      const [x, y] = key.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(5);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(5);
    }
  });

  it('sees through corridors but not through walls', () => {
    // 11x5 grid: walls everywhere except a 1-wide corridor at y=2
    const walls = makeOpenGrid(11, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 11; x++) {
        walls[y][x] = y === 2 ? TILE.EMPTY : TILE.WALL;
      }
    }

    const visible = computeVisibleTiles(0, 2, {
      walls,
      mapWidth: 11,
      mapHeight: 5,
      radius: 10,
    });

    // Should see along the corridor
    expect(visible.has('5,2')).toBe(true);
    expect(visible.has('10,2')).toBe(true);
    // Should NOT see above/below the corridor (walls block)
    expect(visible.has('0,0')).toBe(false);
    expect(visible.has('5,0')).toBe(false);
    expect(visible.has('5,4')).toBe(false);
  });

  it('handles radius of 0 (only origin visible)', () => {
    const walls = makeOpenGrid(SIZE, SIZE);
    const visible = computeVisibleTiles(7, 7, {
      walls,
      mapWidth: SIZE,
      mapHeight: SIZE,
      radius: 0,
    });
    expect(visible.has('7,7')).toBe(true);
    expect(visible.size).toBe(1);
  });

  it('respects partial wall coverage (L-shaped wall)', () => {
    const walls = makeOpenGrid(SIZE, SIZE);
    // L-shaped wall: (8,6), (8,7), (8,8), (9,8)
    walls[6][8] = TILE.WALL;
    walls[7][8] = TILE.WALL;
    walls[8][8] = TILE.WALL;
    walls[8][9] = TILE.WALL;

    const visible = computeVisibleTiles(7, 7, {
      walls,
      mapWidth: SIZE,
      mapHeight: SIZE,
      radius: 5,
    });

    // Should see to the left, up, and down freely
    expect(visible.has('5,7')).toBe(true);
    expect(visible.has('7,5')).toBe(true);
    expect(visible.has('7,9')).toBe(true);
    // Directly behind the wall at (8,7) should be blocked
    expect(visible.has('9,7')).toBe(false);
  });
});
