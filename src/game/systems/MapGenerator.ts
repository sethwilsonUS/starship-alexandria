/**
 * rot.js → Phaser tilemap pipeline.
 * Uses ROT.Map.Digger for interior ruins; transforms to Phaser-compatible layers.
 */

import { Map as ROTMap } from 'rot-js';
import { MAP_WIDTH, MAP_HEIGHT } from '@/config/gameConfig';
import { TILE } from '@/data/tilesets';
import type { MapLayer } from '@/utils/mapUtils';

// Default room names - used as fallback if content not loaded
const DEFAULT_ROOM_NAMES = [
  'library wing',
  'reading room',
  'archives',
  'courtyard',
  'stacks',
  'rotunda',
  'vestibule',
  'study',
  'scriptorium',
] as const;

// Cached room names loaded from content/rooms.yaml
let _roomNamesCache: string[] | null = null;

export function setRoomNamesCache(names: string[]): void {
  _roomNamesCache = names;
}

export function getRoomNames(): string[] {
  return _roomNamesCache ?? [...DEFAULT_ROOM_NAMES];
}

export interface GeneratedRoom {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
}

export interface GeneratedMap {
  ground: MapLayer;
  walls: MapLayer;
  decoration: MapLayer;
  rooms: GeneratedRoom[];
  spawnX: number;
  spawnY: number;
  /** Tile coords "x,y" that are flooded (passable but slow) */
  floodedTiles: Set<string>;
  /** Tile coords "x,y" reachable from spawn (BFS after rubble). Items only placed here. */
  reachableTiles: Set<string>;
}

/**
 * Generate a procedural ruin map using ROT.Map.Digger.
 * Returns ground, walls, decoration layers + room metadata.
 */
export function generateMap(): GeneratedMap {
  const ground: MapLayer = [];
  const walls: MapLayer = [];
  const decoration: MapLayer = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    ground.push(new Array(MAP_WIDTH).fill(TILE.DIRT));
    walls.push(new Array(MAP_WIDTH).fill(TILE.EMPTY));
    decoration.push(new Array(MAP_WIDTH).fill(TILE.EMPTY));
  }

  const digger = new ROTMap.Digger(
    MAP_WIDTH,
    MAP_HEIGHT,
    {
      roomWidth: [5, 12],
      roomHeight: [4, 8],
      corridorLength: [2, 8],
      dugPercentage: 0.25,
    }
  );

  const rawMap: number[][] = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    rawMap[x] = new Array(MAP_HEIGHT).fill(1);
  }

  digger.create((x: number, y: number, value: number) => {
    if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
      rawMap[x][y] = value;
    }
  });

  const rooms = digger.getRooms() as Array<{ _x1: number; _y1: number; _x2: number; _y2: number }>;
  const roomNames = getRoomNames();
  const shuffledNames = [...roomNames].sort(() => Math.random() - 0.5);

  const taggedRooms: GeneratedRoom[] = rooms.map((room, i) => {
    const x1 = room._x1;
    const y1 = room._y1;
    const x2 = room._x2;
    const y2 = room._y2;
    const centerX = Math.floor((x1 + x2) / 2);
    const centerY = Math.floor((y1 + y2) / 2);
    return {
      name: shuffledNames[i % shuffledNames.length],
      x1,
      y1,
      x2,
      y2,
      centerX,
      centerY,
    };
  });

  const FLOOR_TILES = [TILE.FLOOR, TILE.STONE_FLOOR] as const;
  const WALL_TILES = [TILE.WALL, TILE.RUBBLE] as const;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const raw = rawMap[x][y];
      const isOpen = raw === 0 || raw === 2;

      if (isOpen) {
        const inRoom = taggedRooms.some(
          (r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2
        );
        ground[y][x] =
          FLOOR_TILES[Math.floor(Math.random() * FLOOR_TILES.length)];
        if (inRoom) {
          ground[y][x] = TILE.STONE_FLOOR;
        }
        walls[y][x] = TILE.EMPTY;
      } else {
        ground[y][x] = TILE.DIRT;
        walls[y][x] =
          WALL_TILES[Math.floor(Math.random() * WALL_TILES.length)];
      }
    }
  }

  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (walls[y][x] !== TILE.EMPTY) continue;

      const adjacentToWall = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => walls[ny]?.[nx] && walls[ny][nx] !== TILE.EMPTY);

      if (adjacentToWall && Math.random() < 0.25) {
        decoration[y][x] = TILE.DEBRIS;
      } else if (
        !adjacentToWall &&
        ground[y][x] === TILE.STONE_FLOOR &&
        Math.random() < 0.03
      ) {
        decoration[y][x] = TILE.VINE;
      }
    }
  }

  // Corridor rubble: block some corridor tiles (distinct dark tiles, impassable)
  // But ensure all rooms remain reachable from spawn
  const floodedTiles = new Set<string>();
  const inRoom = (x: number, y: number) =>
    taggedRooms.some((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
  const corridorTiles: { x: number; y: number }[] = [];
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (walls[y][x] !== TILE.EMPTY) continue;
      if (!inRoom(x, y)) corridorTiles.push({ x, y });
    }
  }
  
  // Determine spawn point first (needed for reachability checks)
  let spawnX = Math.floor(MAP_WIDTH / 2);
  let spawnY = Math.floor(MAP_HEIGHT / 2);
  const spawnRoom = taggedRooms[0];
  if (spawnRoom && walls[spawnRoom.centerY]?.[spawnRoom.centerX] === TILE.EMPTY) {
    spawnX = spawnRoom.centerX;
    spawnY = spawnRoom.centerY;
  } else if (spawnRoom) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = spawnRoom.centerX + dx;
        const ty = spawnRoom.centerY + dy;
        if (walls[ty]?.[tx] === TILE.EMPTY) {
          spawnX = tx;
          spawnY = ty;
          break;
        }
      }
    }
  }
  
  // Helper to check if all rooms are reachable from spawn
  const allRoomsReachable = (): boolean => {
    const reached = computeReachableTiles(walls, spawnX, spawnY);
    for (const room of taggedRooms) {
      // Check if any tile in the room is reachable
      let roomReachable = false;
      for (let ry = room.y1; ry <= room.y2 && !roomReachable; ry++) {
        for (let rx = room.x1; rx <= room.x2 && !roomReachable; rx++) {
          if (reached.has(`${rx},${ry}`)) {
            roomReachable = true;
          }
        }
      }
      if (!roomReachable) return false;
    }
    return true;
  };
  
  // Place rubble one at a time, only if it doesn't disconnect any room
  const rubbleCount = Math.min(5 + Math.floor(Math.random() * 8), corridorTiles.length);
  const shuffledCorridors = [...corridorTiles].sort(() => Math.random() - 0.5);
  let rubblePlaced = 0;
  for (let i = 0; i < shuffledCorridors.length && rubblePlaced < rubbleCount; i++) {
    const { x, y } = shuffledCorridors[i];
    walls[y][x] = TILE.RUBBLE;
    
    if (allRoomsReachable()) {
      rubblePlaced++;
    } else {
      // This rubble disconnects a room, remove it
      walls[y][x] = TILE.EMPTY;
    }
  }

  // Flooded tiles: passable but slow, visually distinct (blue-gray overlay)
  const floorTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (walls[y][x] === TILE.EMPTY && decoration[y][x] === TILE.EMPTY) {
        floorTiles.push({ x, y });
      }
    }
  }
  const floodCount = Math.min(3 + Math.floor(Math.random() * 5), floorTiles.length);
  const shuffledFloors = [...floorTiles].sort(() => Math.random() - 0.5);
  for (let i = 0; i < floodCount; i++) {
    const { x, y } = shuffledFloors[i];
    decoration[y][x] = TILE.FLOODED;
    floodedTiles.add(`${x},${y}`);
  }

  // BFS from spawn to get reachable tiles (after rubble) — items only placed here
  const reachableTiles = computeReachableTiles(walls, spawnX, spawnY);

  return {
    ground,
    walls,
    decoration,
    rooms: taggedRooms,
    spawnX,
    spawnY,
    floodedTiles,
    reachableTiles,
  };
}

/**
 * BFS from (sx, sy) over walkable tiles (walls EMPTY). Returns coord strings "x,y".
 */
function computeReachableTiles(
  walls: MapLayer,
  sx: number,
  sy: number
): Set<string> {
  const reached = new Set<string>();
  const queue: { x: number; y: number }[] = [{ x: sx, y: sy }];
  reached.add(`${sx},${sy}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      if (walls[ny][nx] !== TILE.EMPTY) continue;
      const key = `${nx},${ny}`;
      if (reached.has(key)) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reached;
}

/**
 * Get open (walkable) tiles within a room. Excludes spawn if provided.
 */
export function getOpenTilesInRoom(
  rooms: GeneratedRoom[],
  walls: MapLayer,
  exclude?: { x: number; y: number }
): { room: GeneratedRoom; tiles: { x: number; y: number }[] }[] {
  return rooms
    .filter((r) => walls[r.centerY]?.[r.centerX] === TILE.EMPTY)
    .map((room) => {
      const tiles: { x: number; y: number }[] = [];
      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          if (walls[y]?.[x] === TILE.EMPTY && !(exclude && exclude.x === x && exclude.y === y)) {
            tiles.push({ x, y });
          }
        }
      }
      return { room, tiles };
    })
    .filter(({ tiles }) => tiles.length > 0);
}

/**
 * Get room name at grid position, or null if not in a room.
 */
export function getRoomAt(
  rooms: GeneratedRoom[],
  x: number,
  y: number
): GeneratedRoom | null {
  return (
    rooms.find((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) ?? null
  );
}
