/**
 * Field of view / fog of war using rot-js PreciseShadowcasting.
 * Tracks visible tiles from a position and supports three states:
 * unexplored (black), explored (dim), visible (full brightness).
 */

import { FOV } from 'rot-js';
import { MAP_WIDTH, MAP_HEIGHT, FOV_RADIUS } from '@/config/gameConfig';
import { TILE } from '@/data/tilesets';
import type { MapLayer } from '@/utils/mapUtils';

export interface FOVOptions {
  walls: MapLayer;
  mapWidth?: number;
  mapHeight?: number;
  radius?: number;
}

/**
 * Computes visible tiles from origin (x, y) using PreciseShadowcasting.
 * Light passes through floor tiles; walls block visibility.
 */
export function computeVisibleTiles(
  originX: number,
  originY: number,
  options: FOVOptions
): Set<string> {
  const {
    walls,
    mapWidth = MAP_WIDTH,
    mapHeight = MAP_HEIGHT,
    radius = FOV_RADIUS,
  } = options;

  const lightPasses = (x: number, y: number): boolean => {
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return false;
    const tile = walls[y]?.[x];
    return tile === TILE.EMPTY || tile === undefined;
  };

  const fov = new FOV.PreciseShadowcasting(lightPasses);
  const visible = new Set<string>();

  fov.compute(originX, originY, radius, (x, y) => {
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
      visible.add(`${x},${y}`);
    }
  });

  return visible;
}
