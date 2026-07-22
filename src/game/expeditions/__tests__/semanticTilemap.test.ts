import { describe, expect, it } from 'vitest';
import { expeditionToTilemap } from '../semanticTilemap';
import type { GeneratedExpedition, SemanticCell } from '../types';

const cell = (overrides: Partial<SemanticCell> = {}): SemanticCell => ({
  terrain: 'stone-floor',
  walkable: true,
  opaque: false,
  surface: 'stone',
  renderRole: 'floor',
  zoneId: 'zone-1',
  ...overrides,
});

describe('expeditionToTilemap', () => {
  it('maps semantic terrain to compatible tile layers without losing collision or surface data', () => {
    const expedition = {
      width: 2,
      height: 2,
      cells: [
        [cell(), cell({ terrain: 'wall', walkable: false, opaque: true, renderRole: 'wall' })],
        [cell({ terrain: 'grass', surface: 'grass', renderRole: 'vegetation' }), cell({ terrain: 'water', surface: 'water', renderRole: 'water' })],
      ],
      zones: [{
        id: 'zone-1',
        name: 'the test archive',
        kind: 'archives',
        bounds: { x1: 0, y1: 0, x2: 1, y2: 1 },
        center: { x: 0, y: 0 },
      }],
      spawn: { x: 0, y: 0 },
    } as GeneratedExpedition;

    const view = expeditionToTilemap(expedition);

    expect(view.walls).toEqual([[-1, 4], [-1, -1]]);
    expect(view.floodedTiles).toEqual(new Set(['1,1']));
    expect(view.reachableTiles).toEqual(new Set(['0,0', '0,1', '1,1']));
    expect(view.rooms[0]).toMatchObject({ name: 'the test archive', centerX: 0, centerY: 0 });
  });
});
