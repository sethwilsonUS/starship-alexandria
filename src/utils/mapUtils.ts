/**
 * Helpers for map generation and tile math.
 */

import { MAP_WIDTH, MAP_HEIGHT } from '@/config/gameConfig';
import { TILE } from '@/data/tilesets';

export type MapLayer = number[][];

/**
 * Create a static test tilemap for Phase 1.3.
 * Ground layer, wall/collision layer, decoration layer.
 */
export function createStaticTestMap(): {
  ground: MapLayer;
  walls: MapLayer;
  decoration: MapLayer;
} {
  const ground: MapLayer = [];
  const walls: MapLayer = [];
  const decoration: MapLayer = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    ground.push([]);
    walls.push([]);
    decoration.push([]);
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isBorder =
        x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1;
      const inRoom1 =
        x >= 5 && x <= 15 && y >= 5 && y <= 15; // Library wing
      const inRoom2 =
        x >= 30 && x <= 45 && y >= 10 && y <= 25; // Reading room
      const inRoom3 = x >= 20 && x <= 35 && y >= 35 && y <= 45; // Courtyard
      const inCorridor =
        (x >= 15 && x <= 25 && y >= 20 && y <= 30) ||
        (y >= 15 && y <= 20 && x >= 15 && x <= 45);

      if (isBorder) {
        walls[y][x] = TILE.WALL;
        ground[y][x] = TILE.DIRT;
      } else if (inRoom1 || inRoom2) {
        ground[y][x] = TILE.STONE_FLOOR;
        walls[y][x] = TILE.EMPTY;
      } else if (inRoom3) {
        ground[y][x] = TILE.GRASS;
        walls[y][x] = TILE.EMPTY;
      } else if (inCorridor) {
        ground[y][x] = TILE.FLOOR;
        walls[y][x] = TILE.EMPTY;
      } else {
        ground[y][x] = x % 3 === 0 ? TILE.GRASS : TILE.DIRT;
        walls[y][x] = Math.random() < 0.03 ? TILE.RUBBLE : TILE.EMPTY;
      }

      decoration[y][x] = TILE.EMPTY;
      if (walls[y][x] === TILE.EMPTY && Math.random() < 0.02) {
        decoration[y][x] = Math.random() < 0.5 ? TILE.VINE : TILE.DEBRIS;
      }
    }
  }

  // Wall boundaries for rooms
  for (let x = 5; x <= 15; x++) {
    walls[5][x] = TILE.WALL;
    walls[15][x] = TILE.WALL;
  }
  for (let y = 5; y <= 15; y++) {
    walls[y][5] = TILE.WALL;
    walls[y][15] = TILE.WALL;
  }
  walls[10][5] = TILE.EMPTY; // Door

  for (let x = 30; x <= 45; x++) {
    walls[10][x] = TILE.WALL;
    walls[25][x] = TILE.WALL;
  }
  for (let y = 10; y <= 25; y++) {
    walls[y][30] = TILE.WALL;
    walls[y][45] = TILE.WALL;
  }
  walls[17][30] = TILE.EMPTY; // Door

  return { ground, walls, decoration };
}
