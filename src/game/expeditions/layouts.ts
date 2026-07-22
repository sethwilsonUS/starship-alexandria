import { Map as RotMap } from 'rot-js';
import { MAP_HEIGHT, MAP_WIDTH } from '@/config/gameConfig';
import type {
  Bounds,
  ExpeditionTheme,
  FootstepSurface,
  Point,
  RenderRole,
  SemanticCell,
  TerrainKind,
  ThemeId,
  Zone,
  ZoneKind,
} from './types';
import { SeededRandom, withRotSeed } from './rng';

export interface LayoutCandidate {
  cells: SemanticCell[][];
  zones: Zone[];
  spawn: Point;
  extraction: Point;
}

interface FloorStyle {
  terrain: TerrainKind;
  surface: FootstepSurface;
  renderRole: RenderRole;
}

const STONE_FLOOR: FloorStyle = {
  terrain: 'stone-floor',
  surface: 'stone',
  renderRole: 'floor',
};

const WOOD_FLOOR: FloorStyle = {
  terrain: 'wood-floor',
  surface: 'wood',
  renderRole: 'floor',
};

const DIRT_PATH: FloorStyle = {
  terrain: 'path',
  surface: 'dirt',
  renderRole: 'path',
};

const GRASS_FLOOR: FloorStyle = {
  terrain: 'grass',
  surface: 'grass',
  renderRole: 'floor-variant',
};

function wallCell(): SemanticCell {
  return {
    terrain: 'wall',
    walkable: false,
    opaque: true,
    surface: 'stone',
    renderRole: 'wall',
    zoneId: null,
  };
}

function floorCell(style: FloorStyle, zoneId: string | null): SemanticCell {
  return {
    ...style,
    walkable: true,
    opaque: false,
    zoneId,
  };
}

function createBaseLayout(): LayoutCandidate {
  return {
    cells: Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, wallCell)
    ),
    zones: [],
    spawn: { x: 1, y: 1 },
    extraction: { x: 1, y: 1 },
  };
}

function inBounds(x: number, y: number): boolean {
  return x > 0 && x < MAP_WIDTH - 1 && y > 0 && y < MAP_HEIGHT - 1;
}

function carveCell(
  layout: LayoutCandidate,
  x: number,
  y: number,
  style: FloorStyle,
  zoneId: string | null,
  preserveZone = false
): void {
  if (!inBounds(x, y)) return;
  const existingZoneId = preserveZone ? layout.cells[y][x].zoneId : null;
  layout.cells[y][x] = floorCell(style, existingZoneId ?? zoneId);
}

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    x1: Math.max(1, Math.min(bounds.x1, bounds.x2)),
    y1: Math.max(1, Math.min(bounds.y1, bounds.y2)),
    x2: Math.min(MAP_WIDTH - 2, Math.max(bounds.x1, bounds.x2)),
    y2: Math.min(MAP_HEIGHT - 2, Math.max(bounds.y1, bounds.y2)),
  };
}

function boundsCenter(bounds: Bounds): Point {
  return {
    x: Math.floor((bounds.x1 + bounds.x2) / 2),
    y: Math.floor((bounds.y1 + bounds.y2) / 2),
  };
}

function zoneId(themeId: ThemeId, kind: ZoneKind, index: number): string {
  return `${themeId}-${kind}-${index}`;
}

function addRectZone(
  layout: LayoutCandidate,
  themeId: ThemeId,
  name: string,
  kind: ZoneKind,
  boundsInput: Bounds,
  style: FloorStyle
): Zone {
  const bounds = normalizeBounds(boundsInput);
  const zone: Zone = {
    id: zoneId(themeId, kind, layout.zones.length),
    name,
    kind,
    bounds,
    center: boundsCenter(bounds),
  };
  layout.zones.push(zone);
  for (let y = bounds.y1; y <= bounds.y2; y += 1) {
    for (let x = bounds.x1; x <= bounds.x2; x += 1) {
      carveCell(layout, x, y, style, zone.id);
    }
  }
  return zone;
}

function addRingZone(
  layout: LayoutCandidate,
  themeId: ThemeId,
  name: string,
  kind: ZoneKind,
  boundsInput: Bounds,
  thickness: number,
  style: FloorStyle
): Zone {
  const bounds = normalizeBounds(boundsInput);
  const zone: Zone = {
    id: zoneId(themeId, kind, layout.zones.length),
    name,
    kind,
    bounds,
    center: { x: bounds.x1 + thickness - 1, y: boundsCenter(bounds).y },
  };
  layout.zones.push(zone);
  for (let y = bounds.y1; y <= bounds.y2; y += 1) {
    for (let x = bounds.x1; x <= bounds.x2; x += 1) {
      const onRing =
        x < bounds.x1 + thickness ||
        x > bounds.x2 - thickness ||
        y < bounds.y1 + thickness ||
        y > bounds.y2 - thickness;
      if (onRing) carveCell(layout, x, y, style, zone.id);
    }
  }
  return zone;
}

function addEllipseZone(
  layout: LayoutCandidate,
  themeId: ThemeId,
  name: string,
  center: Point,
  radiusX: number,
  radiusY: number,
  style: FloorStyle
): Zone {
  const bounds = normalizeBounds({
    x1: center.x - radiusX,
    y1: center.y - radiusY,
    x2: center.x + radiusX,
    y2: center.y + radiusY,
  });
  const zone: Zone = {
    id: zoneId(themeId, 'clearing', layout.zones.length),
    name,
    kind: 'clearing',
    bounds,
    center: { ...center },
  };
  layout.zones.push(zone);
  for (let y = bounds.y1; y <= bounds.y2; y += 1) {
    for (let x = bounds.x1; x <= bounds.x2; x += 1) {
      const dx = (x - center.x) / radiusX;
      const dy = (y - center.y) / radiusY;
      if (dx * dx + dy * dy <= 1) carveCell(layout, x, y, style, zone.id);
    }
  }
  return zone;
}

function carveRect(
  layout: LayoutCandidate,
  boundsInput: Bounds,
  style: FloorStyle,
  preserveZone = true
): void {
  const bounds = normalizeBounds(boundsInput);
  for (let y = bounds.y1; y <= bounds.y2; y += 1) {
    for (let x = bounds.x1; x <= bounds.x2; x += 1) {
      carveCell(layout, x, y, style, null, preserveZone);
    }
  }
}

function carvePath(
  layout: LayoutCandidate,
  from: Point,
  to: Point,
  width: number,
  style: FloorStyle,
  horizontalFirst: boolean
): void {
  const half = Math.floor(width / 2);
  const carveHorizontal = (x1: number, x2: number, y: number) =>
    carveRect(layout, { x1, y1: y - half, x2, y2: y + half }, style);
  const carveVertical = (y1: number, y2: number, x: number) =>
    carveRect(layout, { x1: x - half, y1, x2: x + half, y2 }, style);

  if (horizontalFirst) {
    carveHorizontal(from.x, to.x, from.y);
    carveVertical(from.y, to.y, to.x);
  } else {
    carveVertical(from.y, to.y, from.x);
    carveHorizontal(from.x, to.x, to.y);
  }
}

export function buildLayout(
  theme: ExpeditionTheme,
  random: SeededRandom
): LayoutCandidate {
  switch (theme.id) {
    case 'scriptorium':
      return buildScriptorium(theme, random);
    case 'cathedral':
      return buildCathedral(theme, random);
    case 'university':
      return buildUniversity(theme, random);
    case 'gardens':
      return buildGardens(theme, random, true);
  }
}

function buildScriptorium(theme: ExpeditionTheme, random: SeededRandom): LayoutCandidate {
  const layout = createBaseLayout();
  const generated = withRotSeed(random.uint32(), () => {
    const raw = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => 1)
    );
    const digger = new RotMap.Digger(MAP_WIDTH, MAP_HEIGHT, {
      roomWidth: [5, 12],
      roomHeight: [4, 8],
      corridorLength: [2, 8],
      dugPercentage: 0.29,
      timeLimit: 1200,
    });
    digger.create((x, y, value) => {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) raw[y][x] = value;
    });
    const rooms = digger.getRooms().map((room) => ({
      x1: room.getLeft(),
      y1: room.getTop(),
      x2: room.getRight(),
      y2: room.getBottom(),
    }));
    return { raw, rooms };
  });

  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      if (generated.raw[y][x] === 0 || generated.raw[y][x] === 2) {
        carveCell(layout, x, y, STONE_FLOOR, null);
      }
    }
  }

  const kinds: readonly ZoneKind[] = [
    'scriptorium',
    'stacks',
    'reading-room',
    'refectory',
    'workshop',
    'archives',
    'stacks',
    'archives',
    'reading-room',
  ];
  generated.rooms.forEach((bounds, index) => {
    addRectZone(
      layout,
      theme.id,
      theme.roomNames[index % theme.roomNames.length],
      kinds[index % kinds.length],
      bounds,
      index % 3 === 0 ? WOOD_FLOOR : STONE_FLOOR
    );
  });

  const spawnZone = layout.zones[0];
  layout.spawn = spawnZone ? { ...spawnZone.center } : { x: 25, y: 25 };
  layout.extraction = { ...layout.spawn };
  return layout;
}

function buildCathedral(theme: ExpeditionTheme, random: SeededRandom): LayoutCandidate {
  const layout = createBaseLayout();
  const centerX = 25 + random.int(-2, 2);
  const crossingY = 24 + random.int(-2, 2);
  const halfWidth = random.int(2, 3);

  addRectZone(layout, theme.id, theme.roomNames[2], 'choir', {
    x1: centerX - 5,
    y1: 4,
    x2: centerX + 5,
    y2: crossingY - 7,
  }, STONE_FLOOR);
  addRectZone(layout, theme.id, theme.roomNames[0], 'nave', {
    x1: centerX - halfWidth,
    y1: 10,
    x2: centerX + halfWidth,
    y2: 43,
  }, STONE_FLOOR);
  addRectZone(layout, theme.id, theme.roomNames[1], 'transept', {
    x1: 7,
    y1: crossingY - halfWidth,
    x2: 42,
    y2: crossingY + halfWidth,
  }, STONE_FLOOR);
  addRectZone(layout, theme.id, theme.roomNames[3], 'chapel', {
    x1: 11,
    y1: 10,
    x2: 18,
    y2: 17,
  }, STONE_FLOOR);
  addRectZone(layout, theme.id, theme.roomNames[4], 'chapel', {
    x1: 32,
    y1: 10,
    x2: 39,
    y2: 17,
  }, STONE_FLOOR);
  addRingZone(layout, theme.id, theme.roomNames[5], 'cloister', {
    x1: 33,
    y1: 30,
    x2: 45,
    y2: 44,
  }, 2, STONE_FLOOR);
  addRectZone(layout, theme.id, theme.roomNames[6], 'crypt', {
    x1: 5,
    y1: 33,
    x2: 15,
    y2: 43,
  }, STONE_FLOOR);
  const narthex = addRectZone(layout, theme.id, theme.roomNames[7], 'narthex', {
    x1: centerX - 7,
    y1: 39,
    x2: centerX + 7,
    y2: 46,
  }, STONE_FLOOR);

  carvePath(layout, { x: 18, y: 14 }, { x: centerX, y: 14 }, 2, STONE_FLOOR, true);
  carvePath(layout, { x: 32, y: 14 }, { x: centerX, y: 14 }, 2, STONE_FLOOR, true);
  carvePath(layout, { x: 15, y: 38 }, { x: centerX, y: 38 }, 2, STONE_FLOOR, true);
  carvePath(layout, { x: 33, y: 37 }, { x: centerX, y: 37 }, 2, STONE_FLOOR, true);

  layout.spawn = { ...narthex.center };
  layout.extraction = { ...layout.spawn };
  return layout;
}

function buildUniversity(theme: ExpeditionTheme, random: SeededRandom): LayoutCandidate {
  const layout = createBaseLayout();
  const auxiliaryCampus = withRotSeed(random.uint32(), () => {
    const raw = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => 1)
    );
    const uniform = new RotMap.Uniform(MAP_WIDTH, MAP_HEIGHT, {
      roomWidth: [4, 9],
      roomHeight: [4, 7],
      roomDugPercentage: 0.16,
      timeLimit: 900,
    });
    const result = uniform.create((x, y, value) => {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) raw[y][x] = value;
    });
    return {
      raw,
      centers: result
        ? uniform.getRooms().map((room) => {
            const [x, y] = room.getCenter();
            return { x, y };
          })
        : [],
    };
  });

  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      if (auxiliaryCampus.raw[y][x] === 0) carveCell(layout, x, y, STONE_FLOOR, null);
    }
  }

  const courtyardCenter = { x: 25 + random.int(-1, 1), y: 25 + random.int(-1, 1) };
  const courtyardHalf = random.int(5, 6);
  const courtyard = addRectZone(layout, theme.id, theme.roomNames[7], 'courtyard', {
    x1: courtyardCenter.x - courtyardHalf,
    y1: courtyardCenter.y - courtyardHalf,
    x2: courtyardCenter.x + courtyardHalf,
    y2: courtyardCenter.y + courtyardHalf,
  }, GRASS_FLOOR);

  const arcade = {
    x1: courtyard.bounds.x1 - 3,
    y1: courtyard.bounds.y1 - 3,
    x2: courtyard.bounds.x2 + 3,
    y2: courtyard.bounds.y2 + 3,
  };
  carveRect(layout, { x1: arcade.x1, y1: arcade.y1, x2: arcade.x2, y2: arcade.y1 + 2 }, STONE_FLOOR);
  carveRect(layout, { x1: arcade.x1, y1: arcade.y2 - 2, x2: arcade.x2, y2: arcade.y2 }, STONE_FLOOR);
  carveRect(layout, { x1: arcade.x1, y1: arcade.y1, x2: arcade.x1 + 2, y2: arcade.y2 }, STONE_FLOOR);
  carveRect(layout, { x1: arcade.x2 - 2, y1: arcade.y1, x2: arcade.x2, y2: arcade.y2 }, STONE_FLOOR);

  const rooms = [
    addRectZone(layout, theme.id, theme.roomNames[0], 'lecture-hall', { x1: 4, y1: 4, x2: 15 + random.int(-1, 1), y2: 13 }, WOOD_FLOOR),
    addRectZone(layout, theme.id, theme.roomNames[1], 'laboratory', { x1: 34 + random.int(-1, 1), y1: 4, x2: 45, y2: 13 }, STONE_FLOOR),
    addRectZone(layout, theme.id, theme.roomNames[2], 'registrar', { x1: 4, y1: 18, x2: 13, y2: 30 }, WOOD_FLOOR),
    addRectZone(layout, theme.id, theme.roomNames[3], 'special-collections', { x1: 36, y1: 18, x2: 45, y2: 30 }, WOOD_FLOOR),
    addRectZone(layout, theme.id, theme.roomNames[4], 'dormitory', { x1: 4, y1: 36, x2: 15, y2: 45 }, WOOD_FLOOR),
    addRectZone(layout, theme.id, theme.roomNames[5], 'commons', { x1: 34, y1: 36, x2: 45, y2: 45 }, STONE_FLOOR),
    addRectZone(layout, theme.id, theme.roomNames[6], 'observatory', { x1: 20, y1: 5, x2: 29, y2: 12 }, STONE_FLOOR),
  ];

  for (const [index, room] of rooms.entries()) {
    const target = {
      x: Math.max(arcade.x1, Math.min(arcade.x2, room.center.x)),
      y: Math.max(arcade.y1, Math.min(arcade.y2, room.center.y)),
    };
    carvePath(layout, room.center, target, 2, STONE_FLOOR, index % 2 === 0);
  }

  for (const [index, center] of auxiliaryCampus.centers.entries()) {
    const target = {
      x: Math.max(arcade.x1, Math.min(arcade.x2, center.x)),
      y: Math.max(arcade.y1, Math.min(arcade.y2, center.y)),
    };
    carvePath(layout, center, target, 1, STONE_FLOOR, index % 2 === 0);
  }

  layout.spawn = { ...courtyard.center };
  layout.extraction = { ...layout.spawn };
  return layout;
}

function buildGardens(
  theme: ExpeditionTheme,
  random: SeededRandom,
  includeCellularField: boolean
): LayoutCandidate {
  const layout = createBaseLayout();

  if (includeCellularField) {
    const raw = withRotSeed(random.uint32(), () => {
      const cells = Array.from({ length: MAP_HEIGHT }, () =>
        Array.from({ length: MAP_WIDTH }, () => 1)
      );
      const cellular = new RotMap.Cellular(MAP_WIDTH, MAP_HEIGHT, { topology: 8 });
      cellular.randomize(0.49);
      for (let iteration = 0; iteration < 4; iteration += 1) cellular.create();
      cellular.connect((x, y, value) => {
        cells[y][x] = value;
      }, 0);
      return cells;
    });

    for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
      for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
        if (raw[y][x] === 0) carveCell(layout, x, y, GRASS_FLOOR, null);
      }
    }
  }

  const centers: Point[] = [
    { x: 10 + random.int(-1, 1), y: 10 + random.int(-1, 1) },
    { x: 39 + random.int(-1, 1), y: 10 + random.int(-1, 1) },
    { x: 11 + random.int(-1, 1), y: 37 + random.int(-1, 1) },
    { x: 38 + random.int(-1, 1), y: 37 + random.int(-1, 1) },
    { x: 25 + random.int(-1, 1), y: 16 + random.int(-1, 1) },
    { x: 25 + random.int(-1, 1), y: 39 + random.int(-1, 1) },
  ];
  const styles = [STONE_FLOOR, GRASS_FLOOR, GRASS_FLOOR, STONE_FLOOR, GRASS_FLOOR, GRASS_FLOOR];
  const zones = centers.map((center, index) =>
    addEllipseZone(
      layout,
      theme.id,
      theme.roomNames[index],
      center,
      index % 2 === 0 ? 5 : 4,
      index % 2 === 0 ? 4 : 5,
      styles[index]
    )
  );

  for (let index = 1; index < centers.length; index += 1) {
    const previous = index === 4 ? centers[0] : index === 5 ? centers[2] : centers[index - 1];
    carvePath(layout, previous, centers[index], 2, DIRT_PATH, random.chance(0.5));
  }

  const floodedPavilion = zones[2];
  for (let y = floodedPavilion.bounds.y1; y <= floodedPavilion.bounds.y2; y += 1) {
    for (let x = floodedPavilion.bounds.x1; x <= floodedPavilion.bounds.x2; x += 1) {
      const cell = layout.cells[y][x];
      if (cell.zoneId === floodedPavilion.id && random.chance(0.28)) {
        layout.cells[y][x] = floorCell({
          terrain: 'water',
          surface: 'water',
          renderRole: 'water',
        }, floodedPavilion.id);
      }
    }
  }

  layout.spawn = { ...zones[0].center };
  layout.extraction = { ...layout.spawn };
  return layout;
}

export function buildFallbackLayout(
  theme: ExpeditionTheme,
  random: SeededRandom
): LayoutCandidate {
  if (theme.id === 'scriptorium') return buildFallbackScriptorium(theme);
  if (theme.id === 'gardens') return buildGardens(theme, random, false);
  if (theme.id === 'cathedral') return buildCathedral(theme, new SeededRandom('fallback-cathedral'));
  return buildUniversity(theme, new SeededRandom('fallback-university'));
}

function buildFallbackScriptorium(theme: ExpeditionTheme): LayoutCandidate {
  const layout = createBaseLayout();
  const specs: Array<{ bounds: Bounds; kind: ZoneKind; name: string }> = [
    { bounds: { x1: 5, y1: 5, x2: 14, y2: 13 }, kind: 'scriptorium', name: theme.roomNames[0] },
    { bounds: { x1: 20, y1: 5, x2: 29, y2: 13 }, kind: 'stacks', name: theme.roomNames[1] },
    { bounds: { x1: 35, y1: 5, x2: 44, y2: 13 }, kind: 'reading-room', name: theme.roomNames[2] },
    { bounds: { x1: 5, y1: 34, x2: 14, y2: 43 }, kind: 'refectory', name: theme.roomNames[3] },
    { bounds: { x1: 20, y1: 34, x2: 29, y2: 43 }, kind: 'workshop', name: theme.roomNames[4] },
    { bounds: { x1: 35, y1: 34, x2: 44, y2: 43 }, kind: 'archives', name: theme.roomNames[5] },
  ];
  const zones = specs.map((spec, index) =>
    addRectZone(layout, theme.id, spec.name, spec.kind, spec.bounds, index % 2 ? STONE_FLOOR : WOOD_FLOOR)
  );
  carveRect(layout, { x1: 8, y1: 23, x2: 41, y2: 26 }, STONE_FLOOR);
  for (const zone of zones) {
    carvePath(layout, zone.center, { x: zone.center.x, y: 24 }, 2, STONE_FLOOR, false);
  }
  layout.spawn = { ...zones[0].center };
  layout.extraction = { ...layout.spawn };
  return layout;
}

export function decorateLayout(
  layout: LayoutCandidate,
  random: SeededRandom
): LayoutCandidate {
  const cells = layout.cells.map((row) => row.map((cell) => ({ ...cell })));
  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      const cell = cells[y][x];
      if (!cell.walkable || cell.renderRole === 'water') continue;
      if (random.chance(0.026)) {
        cell.renderRole = cell.surface === 'grass' ? 'vegetation' : 'debris';
      } else if (random.chance(0.035)) {
        cell.renderRole = 'floor-variant';
      }
    }
  }
  return {
    ...layout,
    cells,
    zones: layout.zones.map((zone) => ({
      ...zone,
      bounds: { ...zone.bounds },
      center: { ...zone.center },
    })),
    spawn: { ...layout.spawn },
    extraction: { ...layout.extraction },
  };
}
