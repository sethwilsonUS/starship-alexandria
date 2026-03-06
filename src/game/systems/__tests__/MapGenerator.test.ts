import { describe, it, expect } from 'vitest';
import {
  generateMap,
  getOpenTilesInRoom,
  getRoomAt,
  computeReachableTiles,
} from '../MapGenerator';
import type { GeneratedRoom, GeneratedMap } from '../MapGenerator';
import { TILE } from '@/data/tilesets';
import { MAP_WIDTH, MAP_HEIGHT } from '@/config/gameConfig';

// ── Helper: run generateMap and collect results for invariant testing ──

const NUM_RUNS = 5;
let maps: GeneratedMap[];

function ensureMaps() {
  if (!maps) {
    maps = Array.from({ length: NUM_RUNS }, () => generateMap());
  }
  return maps;
}

// ── generateMap invariants (run across multiple random seeds) ──

describe('generateMap invariants', () => {
  it('produces ground and walls layers with correct dimensions', () => {
    for (const map of ensureMaps()) {
      expect(map.ground).toHaveLength(MAP_HEIGHT);
      expect(map.walls).toHaveLength(MAP_HEIGHT);
      expect(map.decoration).toHaveLength(MAP_HEIGHT);
      for (let y = 0; y < MAP_HEIGHT; y++) {
        expect(map.ground[y]).toHaveLength(MAP_WIDTH);
        expect(map.walls[y]).toHaveLength(MAP_WIDTH);
        expect(map.decoration[y]).toHaveLength(MAP_WIDTH);
      }
    }
  });

  it('places spawn on a walkable tile', () => {
    for (const map of ensureMaps()) {
      expect(map.walls[map.spawnY][map.spawnX]).toBe(TILE.EMPTY);
    }
  });

  it('includes spawn in reachableTiles', () => {
    for (const map of ensureMaps()) {
      expect(map.reachableTiles.has(`${map.spawnX},${map.spawnY}`)).toBe(true);
    }
  });

  it('has non-empty reachableTiles', () => {
    for (const map of ensureMaps()) {
      expect(map.reachableTiles.size).toBeGreaterThan(0);
    }
  });

  it('generates at least one room', () => {
    for (const map of ensureMaps()) {
      expect(map.rooms.length).toBeGreaterThan(0);
    }
  });

  it('all rooms are reachable from spawn', () => {
    for (const map of ensureMaps()) {
      for (const room of map.rooms) {
        let roomReachable = false;
        for (let y = room.y1; y <= room.y2 && !roomReachable; y++) {
          for (let x = room.x1; x <= room.x2 && !roomReachable; x++) {
            if (map.reachableTiles.has(`${x},${y}`)) {
              roomReachable = true;
            }
          }
        }
        expect(roomReachable).toBe(true);
      }
    }
  });

  it('rooms have valid bounds (x1 <= x2, y1 <= y2) within map', () => {
    for (const map of ensureMaps()) {
      for (const room of map.rooms) {
        expect(room.x1).toBeLessThanOrEqual(room.x2);
        expect(room.y1).toBeLessThanOrEqual(room.y2);
        expect(room.x1).toBeGreaterThanOrEqual(0);
        expect(room.y1).toBeGreaterThanOrEqual(0);
        expect(room.x2).toBeLessThan(MAP_WIDTH);
        expect(room.y2).toBeLessThan(MAP_HEIGHT);
      }
    }
  });

  it('rooms have names', () => {
    for (const map of ensureMaps()) {
      for (const room of map.rooms) {
        expect(room.name).toBeTruthy();
        expect(typeof room.name).toBe('string');
      }
    }
  });

  it('uses only valid tile indices in walls layer', () => {
    const validWallTiles = new Set<number>([TILE.EMPTY, TILE.WALL, TILE.RUBBLE]);
    for (const map of ensureMaps()) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          expect(validWallTiles.has(map.walls[y][x])).toBe(true);
        }
      }
    }
  });

  it('flooded tiles are within map bounds', () => {
    for (const map of ensureMaps()) {
      for (const key of map.floodedTiles) {
        const [x, y] = key.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(MAP_WIDTH);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(MAP_HEIGHT);
      }
    }
  });

  it('flooded tiles are on walkable ground (not walls)', () => {
    for (const map of ensureMaps()) {
      for (const key of map.floodedTiles) {
        const [x, y] = key.split(',').map(Number);
        expect(map.walls[y][x]).toBe(TILE.EMPTY);
      }
    }
  });
});

// ── computeReachableTiles (deterministic, hand-crafted grids) ──

describe('computeReachableTiles', () => {
  /**
   * Full-size grid that's all walls except a 3x3 open area with a wall in the center:
   *   (1,1) (2,1) (3,1)
   *   (1,2) [WALL] (3,2)
   *   (1,3) (2,3) (3,3)
   * BFS is cardinal-only, so all 8 open tiles are reachable around the center wall.
   */
  function makeGridWithRoom(): number[][] {
    const walls: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      walls.push(new Array(MAP_WIDTH).fill(TILE.WALL));
    }
    // Open a 3x3 area
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        walls[y][x] = TILE.EMPTY;
      }
    }
    // Put a wall in the center
    walls[2][2] = TILE.WALL;
    return walls;
  }

  it('finds all reachable tiles in a small open area', () => {
    const walls = makeGridWithRoom();
    const reached = computeReachableTiles(walls, 1, 1);
    const expected = ['1,1', '2,1', '3,1', '1,2', '3,2', '1,3', '2,3', '3,3'];
    expect(reached.size).toBe(expected.length);
    for (const key of expected) {
      expect(reached.has(key)).toBe(true);
    }
  });

  it('does not include wall tiles', () => {
    const walls = makeGridWithRoom();
    const reached = computeReachableTiles(walls, 1, 1);
    expect(reached.has('0,0')).toBe(false);
    expect(reached.has('2,2')).toBe(false);
  });

  it('handles disconnected regions', () => {
    // Full-size grid with a wall column at x=25 splitting it into two halves
    const walls: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      walls.push([]);
      for (let x = 0; x < MAP_WIDTH; x++) {
        walls[y][x] = x === 25 ? TILE.WALL : TILE.EMPTY;
      }
    }
    const leftSide = computeReachableTiles(walls, 1, 1);
    expect(leftSide.has('1,1')).toBe(true);
    expect(leftSide.has('0,0')).toBe(true);
    expect(leftSide.has('24,1')).toBe(true);
    // Right side should NOT be reachable from left
    expect(leftSide.has('26,1')).toBe(false);
    expect(leftSide.has('49,49')).toBe(false);
  });

  it('returns only the spawn tile when completely walled in', () => {
    const walls: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      walls.push(new Array(MAP_WIDTH).fill(TILE.WALL));
    }
    walls[1][1] = TILE.EMPTY;
    const reached = computeReachableTiles(walls, 1, 1);
    expect(reached.size).toBe(1);
    expect(reached.has('1,1')).toBe(true);
  });
});

// ── getOpenTilesInRoom ──

describe('getOpenTilesInRoom', () => {
  const rooms: GeneratedRoom[] = [
    { name: 'library', x1: 1, y1: 1, x2: 3, y2: 3, centerX: 2, centerY: 2 },
    { name: 'study', x1: 5, y1: 5, x2: 7, y2: 7, centerX: 6, centerY: 6 },
  ];

  function makeWalls(): number[][] {
    const walls: number[][] = [];
    for (let y = 0; y < 10; y++) {
      walls.push(new Array(10).fill(TILE.WALL));
    }
    // Open up room interiors
    for (const room of rooms) {
      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          walls[y][x] = TILE.EMPTY;
        }
      }
    }
    return walls;
  }

  it('returns open tiles for each room', () => {
    const result = getOpenTilesInRoom(rooms, makeWalls());
    expect(result).toHaveLength(2);
    // First room: 3x3 = 9 tiles
    expect(result[0].tiles).toHaveLength(9);
    expect(result[0].room.name).toBe('library');
  });

  it('excludes the specified tile', () => {
    const result = getOpenTilesInRoom(rooms, makeWalls(), { x: 2, y: 2 });
    const libraryResult = result.find((r) => r.room.name === 'library')!;
    expect(libraryResult.tiles).toHaveLength(8);
    expect(libraryResult.tiles.some((t) => t.x === 2 && t.y === 2)).toBe(false);
  });

  it('excludes rooms whose center is a wall', () => {
    const walls = makeWalls();
    walls[6][6] = TILE.WALL; // block study center
    const result = getOpenTilesInRoom(rooms, walls);
    expect(result).toHaveLength(1);
    expect(result[0].room.name).toBe('library');
  });

  it('excludes rooms with no open tiles', () => {
    const walls: number[][] = [];
    for (let y = 0; y < 10; y++) {
      walls.push(new Array(10).fill(TILE.WALL));
    }
    const result = getOpenTilesInRoom(rooms, walls);
    expect(result).toHaveLength(0);
  });
});

// ── getRoomAt ──

describe('getRoomAt', () => {
  const rooms: GeneratedRoom[] = [
    { name: 'library', x1: 2, y1: 2, x2: 5, y2: 5, centerX: 3, centerY: 3 },
    { name: 'study', x1: 8, y1: 8, x2: 12, y2: 12, centerX: 10, centerY: 10 },
  ];

  it('returns the room containing the point', () => {
    const result = getRoomAt(rooms, 3, 3);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('library');
  });

  it('returns correct room for edge tiles', () => {
    expect(getRoomAt(rooms, 2, 2)?.name).toBe('library');
    expect(getRoomAt(rooms, 5, 5)?.name).toBe('library');
    expect(getRoomAt(rooms, 8, 8)?.name).toBe('study');
    expect(getRoomAt(rooms, 12, 12)?.name).toBe('study');
  });

  it('returns null for coordinates outside any room', () => {
    expect(getRoomAt(rooms, 0, 0)).toBeNull();
    expect(getRoomAt(rooms, 6, 6)).toBeNull();
    expect(getRoomAt(rooms, 50, 50)).toBeNull();
  });

  it('returns first matching room if rooms overlap', () => {
    const overlapping: GeneratedRoom[] = [
      { name: 'A', x1: 0, y1: 0, x2: 5, y2: 5, centerX: 2, centerY: 2 },
      { name: 'B', x1: 3, y1: 3, x2: 8, y2: 8, centerX: 5, centerY: 5 },
    ];
    expect(getRoomAt(overlapping, 4, 4)?.name).toBe('A');
  });
});
