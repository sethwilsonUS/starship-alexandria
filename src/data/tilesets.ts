/**
 * Tileset configuration and tile index mappings.
 * Procedural tileset is generated at runtime; paths here for future asset-based tiles.
 */

import { TILE_SIZE } from '@/config/gameConfig';

export const TILESET_TILE_WIDTH = TILE_SIZE;
export const TILESET_TILE_HEIGHT = TILE_SIZE;

/** Tile indices in our procedural/asset tileset */
export const TILE = {
  // Ground layer (floor types)
  FLOOR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE_FLOOR: 3,
  // Wall/collision layer (impassable)
  WALL: 4,
  RUBBLE: 5,
  // Decoration layer (non-blocking)
  VINE: 6,
  DEBRIS: 7,
  FLOODED: 8, // Passable but slow (water/flood)
  EMPTY: -1,
} as const;
