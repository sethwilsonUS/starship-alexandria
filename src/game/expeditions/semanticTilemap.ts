import { TILE } from '@/data/tilesets';
import type { GeneratedExpedition, SemanticCell } from './types';

export interface RenderedExpeditionRoom {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
}

export interface RenderedExpeditionMap {
  ground: number[][];
  walls: number[][];
  decoration: number[][];
  rooms: RenderedExpeditionRoom[];
  spawnX: number;
  spawnY: number;
  floodedTiles: Set<string>;
  reachableTiles: Set<string>;
}

/**
 * Thin rendering adapter. Gameplay continues to use semantic cells; these
 * numeric layers only select compatible 16px atlas frames for Phaser.
 */
export function expeditionToTilemap(expedition: GeneratedExpedition): RenderedExpeditionMap {
  const ground = expedition.cells.map((row) => row.map(groundTile));
  const walls = expedition.cells.map((row) => row.map(wallTile));
  const decoration = expedition.cells.map((row) => row.map(decorationTile));
  const floodedTiles = new Set<string>();
  const reachableTiles = new Set<string>();

  expedition.cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell.walkable) reachableTiles.add(`${x},${y}`);
      if (cell.walkable && cell.surface === 'water') floodedTiles.add(`${x},${y}`);
    });
  });

  return {
    ground,
    walls,
    decoration,
    rooms: expedition.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      x1: zone.bounds.x1,
      y1: zone.bounds.y1,
      x2: zone.bounds.x2,
      y2: zone.bounds.y2,
      centerX: zone.center.x,
      centerY: zone.center.y,
    })),
    spawnX: expedition.spawn.x,
    spawnY: expedition.spawn.y,
    floodedTiles,
    reachableTiles,
  };
}

function groundTile(cell: SemanticCell): number {
  switch (cell.terrain) {
    case 'grass': return TILE.GRASS;
    case 'soil':
    case 'path': return TILE.DIRT;
    case 'wood-floor': return TILE.FLOOR;
    case 'stone-floor':
    case 'water':
    case 'rubble': return TILE.STONE_FLOOR;
    case 'wall': return TILE.DIRT;
  }
}

function wallTile(cell: SemanticCell): number {
  if (cell.walkable) return TILE.EMPTY;
  return cell.terrain === 'rubble' || cell.renderRole === 'rubble'
    ? TILE.RUBBLE
    : TILE.WALL;
}

function decorationTile(cell: SemanticCell): number {
  if (!cell.walkable) return TILE.EMPTY;
  if (cell.surface === 'water' || cell.renderRole === 'water') return TILE.FLOODED;
  if (cell.renderRole === 'vegetation' || cell.terrain === 'grass') return TILE.VINE;
  if (cell.renderRole === 'debris') return TILE.DEBRIS;
  return TILE.EMPTY;
}
