import { describe, expect, it } from 'vitest';
import { RNG as RotRng } from 'rot-js';
import { MAP_HEIGHT, MAP_WIDTH } from '@/config/gameConfig';
import {
  EXPEDITION_THEME_IDS,
  EXPEDITION_THEMES,
  chooseSurpriseTheme,
  generateExpedition,
  type GeneratedExpedition,
  type Point,
  type ThemeId,
} from '..';

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function reachableWithoutBlockers(expedition: GeneratedExpedition): Set<string> {
  const blocked = new Set(
    expedition.entities
      .filter((entity) => entity.blocksMovement)
      .map((entity) => pointKey(entity.position))
  );
  blocked.add(pointKey(expedition.vault.position));

  const reached = new Set<string>();
  const queue: Point[] = [expedition.spawn];
  reached.add(pointKey(expedition.spawn));

  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const next = { x: point.x + dx, y: point.y + dy };
      const cell = expedition.cells[next.y]?.[next.x];
      const key = pointKey(next);
      if (!cell?.walkable || blocked.has(key) || reached.has(key)) continue;
      reached.add(key);
      queue.push(next);
    }
  }

  return reached;
}

function hasReachableNeighbor(point: Point, reached: Set<string>): boolean {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(
    ([dx, dy]) => reached.has(`${point.x + dx},${point.y + dy}`)
  );
}

function areCardinallyAdjacent(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
}

describe('expedition theme registry', () => {
  it('describes the four mission-picker destinations', () => {
    expect(EXPEDITION_THEME_IDS).toEqual([
      'scriptorium',
      'cathedral',
      'university',
      'gardens',
    ]);

    for (const id of EXPEDITION_THEME_IDS) {
      const theme = EXPEDITION_THEMES[id];
      expect(theme.id).toBe(id);
      expect(theme.title.length).toBeGreaterThan(8);
      expect(theme.description.length).toBeGreaterThan(20);
      expect(theme.roomNames.length).toBeGreaterThanOrEqual(5);
      expect(theme.npcIds).toHaveLength(2);
      expect(theme.vault.contentId).toContain(id);
      expect(theme.vault.clueContentId).toContain(id);
      expect(theme.vault.label.length).toBeGreaterThan(5);
    }
  });

  it('chooses Surprise Me deterministically without immediately repeating', () => {
    expect(chooseSurpriseTheme('same-seed', 'cathedral')).toBe(
      chooseSurpriseTheme('same-seed', 'cathedral')
    );

    for (const previousThemeId of EXPEDITION_THEME_IDS) {
      expect(chooseSurpriseTheme('alexandria', previousThemeId)).not.toBe(previousThemeId);
    }
  });
});

describe('generateExpedition', () => {
  it('returns the same complete expedition for the same seed', () => {
    const input = {
      seed: 'the-road-goes-ever-on',
      themeId: 'scriptorium' as const,
      collectedFragmentIds: ['inferno-canto-1'],
    };

    expect(generateExpedition(input)).toEqual(generateExpedition(input));
  });

  it('does not disturb rot-js global random state', () => {
    const originalSeed = RotRng.getSeed();
    const originalState = RotRng.getState();

    generateExpedition({
      seed: 'speak-friend-and-enter',
      themeId: 'gardens',
      collectedFragmentIds: [],
    });

    expect(RotRng.getSeed()).toBe(originalSeed);
    expect(RotRng.getState()).toEqual(originalState);
  });

  it('keeps topology and placement coordinates stable when collection state changes', () => {
    const fresh = generateExpedition({
      seed: 'cosmetic-stream-independence',
      themeId: 'university',
      collectedFragmentIds: [],
    });
    const returning = generateExpedition({
      seed: 'cosmetic-stream-independence',
      themeId: 'university',
      collectedFragmentIds: ['frankenstein-chapter-4'],
    });

    expect(returning.cells).toEqual(fresh.cells);
    expect(returning.zones).toEqual(fresh.zones);
    expect(returning.spawn).toEqual(fresh.spawn);
    expect(returning.extraction).toEqual(fresh.extraction);
    expect(returning.vault.position).toEqual(fresh.vault.position);
    expect(returning.vault.cluePosition).toEqual(fresh.vault.cluePosition);
    expect(returning.vault.code).toBe(fresh.vault.code);
    expect(returning.entities.map((entity) => entity.position)).toEqual(
      fresh.entities.map((entity) => entity.position)
    );
  });

  it('falls back safely when the caller provides an empty content catalog', () => {
    const expedition = generateExpedition({
      seed: 'empty-archive',
      themeId: 'cathedral',
      collectedFragmentIds: ['unknown-fragment'],
      contentCatalog: {
        fragments: [],
        npcIdsByTheme: { cathedral: [] },
        journalIdsByTheme: { cathedral: [] },
      },
    });

    expect(expedition.entities.some((entity) => entity.kind === 'fragment')).toBe(false);
    expect(expedition.entities.some((entity) => entity.kind === 'npc')).toBe(false);
    expect(expedition.entities.some((entity) => entity.kind === 'clue')).toBe(true);
    expect(expedition.vault.reward).toEqual({
      kind: 'supplies',
      loreJournalId: null,
      batteries: 2,
    });
  });

  it('uses the supplies reward after every known excerpt is collected', () => {
    const contentCatalog = {
      fragments: [
        { id: 'only-fragment', themeIds: ['gardens' as const] },
      ],
    };
    const expedition = generateExpedition({
      seed: 'catalog-complete',
      themeId: 'gardens',
      collectedFragmentIds: ['only-fragment'],
      contentCatalog,
    });

    expect(expedition.vault.reward.kind).toBe('supplies');
    if (expedition.vault.reward.kind === 'supplies') {
      expect(expedition.vault.reward.batteries).toBe(2);
    }
  });

  it('prefers an uncollected excerpt affiliated with the destination for the vault', () => {
    const expedition = generateExpedition({
      seed: 'affinity-before-generality',
      themeId: 'cathedral',
      collectedFragmentIds: [],
      contentCatalog: {
        fragments: [
          { id: 'garden-only', themeIds: ['gardens'] },
          { id: 'cathedral-text', themeIds: ['cathedral'] },
        ],
      },
    });

    expect(expedition.vault.reward).toEqual({
      kind: 'fragment',
      fragmentId: 'cathedral-text',
    });
  });

  it.each(EXPEDITION_THEME_IDS)(
    '%s satisfies the generation contract across 250 seeds',
    (themeId) => {
      for (let seedNumber = 0; seedNumber < 250; seedNumber += 1) {
        const expedition = generateExpedition({
          seed: `${themeId}-fuzz-${seedNumber}`,
          themeId,
          collectedFragmentIds: [],
        });
        assertExpeditionContract(expedition, themeId);
      }
    },
    60_000
  );

  it('produces topology-specific spatial signatures', () => {
    const maps = Object.fromEntries(
      EXPEDITION_THEME_IDS.map((themeId) => [
        themeId,
        generateExpedition({ seed: 'topology-signature', themeId, collectedFragmentIds: [] }),
      ])
    ) as Record<ThemeId, GeneratedExpedition>;

    expect(maps.scriptorium.topology).toBe('digger');
    expect(maps.scriptorium.zones.some((zone) => zone.kind === 'scriptorium')).toBe(true);

    expect(maps.cathedral.topology).toBe('cross-plan');
    expect(maps.cathedral.zones.some((zone) => zone.kind === 'nave')).toBe(true);
    expect(maps.cathedral.zones.some((zone) => zone.kind === 'transept')).toBe(true);

    expect(maps.university.topology).toBe('courtyard');
    expect(maps.university.zones.some((zone) => zone.kind === 'courtyard')).toBe(true);

    expect(maps.gardens.topology).toBe('cellular');
    expect(maps.gardens.zones.filter((zone) => zone.kind === 'clearing').length).toBeGreaterThanOrEqual(4);

    const fingerprints = new Set(
      Object.values(maps).map((expedition) =>
        expedition.cells
          .map((row) => row.map((cell) => (cell.walkable ? '1' : '0')).join(''))
          .join('\n')
      )
    );
    expect(fingerprints.size).toBe(EXPEDITION_THEME_IDS.length);
  });

  it.each(EXPEDITION_THEME_IDS)('%s varies its walkable layout between seeds', (themeId) => {
    const first = generateExpedition({
      seed: 'layout-variation-alpha',
      themeId,
      collectedFragmentIds: [],
    });
    const second = generateExpedition({
      seed: 'layout-variation-beta',
      themeId,
      collectedFragmentIds: [],
    });

    expect(walkabilityFingerprint(first)).not.toBe(walkabilityFingerprint(second));
  });
});

function walkabilityFingerprint(expedition: GeneratedExpedition): string {
  return expedition.cells
    .map((row) => row.map((cell) => (cell.walkable ? '1' : '0')).join(''))
    .join('\n');
}

function assertExpeditionContract(expedition: GeneratedExpedition, themeId: ThemeId): void {
  expect(expedition.themeId).toBe(themeId);
  expect(expedition.width).toBe(MAP_WIDTH);
  expect(expedition.height).toBe(MAP_HEIGHT);
  expect(expedition.cells).toHaveLength(MAP_HEIGHT);
  expect(expedition.cells.every((row) => row.length === MAP_WIDTH)).toBe(true);
  const cells = expedition.cells.flat();
  expect(
    cells.every((cell) =>
      cell.walkable
        ? !cell.opaque && cell.terrain !== 'wall' && cell.terrain !== 'rubble'
        : cell.opaque && (cell.terrain === 'wall' || cell.terrain === 'rubble')
    )
  ).toBe(true);
  expect(expedition.generation.attempts).toBeGreaterThanOrEqual(1);
  expect(expedition.generation.attempts).toBeLessThanOrEqual(20);
  expect(typeof expedition.generation.usedFallback).toBe('boolean');

  expect(expedition.cells[expedition.spawn.y][expedition.spawn.x].walkable).toBe(true);
  expect(expedition.cells[expedition.extraction.y][expedition.extraction.x].walkable).toBe(true);
  expect(pointKey(expedition.extraction)).toBe(pointKey(expedition.spawn));

  const occupied = new Set<string>([pointKey(expedition.spawn)]);
  for (const entity of expedition.entities) {
    expect(expedition.cells[entity.position.y]?.[entity.position.x]?.walkable).toBe(true);
    expect(occupied.has(pointKey(entity.position))).toBe(false);
    occupied.add(pointKey(entity.position));
  }
  expect(occupied.has(pointKey(expedition.vault.position))).toBe(false);
  expect(expedition.vault.code).toMatch(/^\d{4}$/);

  const ids = expedition.entities.map((entity) => entity.id);
  expect(new Set(ids).size).toBe(ids.length);
  const clue = expedition.entities.find((entity) => entity.kind === 'clue');
  expect(clue?.vaultId).toBe(expedition.vault.id);
  expect(clue?.position).toEqual(expedition.vault.cluePosition);
  expect(clue?.zoneId).not.toBe(expedition.vault.zoneId);

  const npcs = expedition.entities.filter((entity) => entity.kind === 'npc');
  expect(npcs.length).toBeGreaterThanOrEqual(1);
  expect(npcs.length).toBeLessThanOrEqual(2);
  expect(new Set(npcs.map((npc) => npc.npcId)).size).toBe(npcs.length);
  expect(npcs.every((npc) => EXPEDITION_THEMES[themeId].npcIds.includes(npc.npcId))).toBe(true);

  const fragments = expedition.entities.filter((entity) => entity.kind === 'fragment');
  expect(fragments.length).toBeGreaterThanOrEqual(2);
  expect(fragments.length).toBeLessThanOrEqual(4);
  const npcZoneIds = new Set(npcs.map((npc) => npc.zoneId));
  expect(
    fragments.every((fragment) => !npcZoneIds.has(fragment.zoneId)),
    'NPCs and fragments occupy separate zones'
  ).toBe(true);
  expect(expedition.entities.filter((entity) => entity.kind === 'map')).toHaveLength(1);
  expect(expedition.entities.filter((entity) => entity.kind === 'clue')).toHaveLength(1);
  expect(expedition.entities.filter((entity) => entity.kind === 'journal')).toHaveLength(1);
  const batteries = expedition.entities.filter((entity) => entity.kind === 'battery');
  expect(batteries.length).toBeGreaterThanOrEqual(1);
  expect(batteries.length).toBeLessThanOrEqual(2);

  const spacedKinds = new Set(['fragment', 'npc', 'journal', 'battery']);
  const spacingAnchors: Point[] = [expedition.spawn, expedition.extraction];
  for (const entity of expedition.entities) {
    if (!spacedKinds.has(entity.kind)) continue;
    expect(
      spacingAnchors.some((anchor) => areCardinallyAdjacent(entity.position, anchor)),
      `${entity.kind} ${entity.id} at ${pointKey(entity.position)} is cardinally adjacent to another protected position`
    ).toBe(false);
    spacingAnchors.push(entity.position);
  }

  const reached = reachableWithoutBlockers(expedition);
  expect(reached.has(pointKey(expedition.extraction))).toBe(true);
  for (const entity of expedition.entities) {
    if (entity.blocksMovement) {
      expect(hasReachableNeighbor(entity.position, reached)).toBe(true);
    } else {
      expect(reached.has(pointKey(entity.position))).toBe(true);
    }
  }
  expect(hasReachableNeighbor(expedition.vault.position, reached)).toBe(true);

  for (const zone of expedition.zones) {
    let zoneReachable = false;
    for (let y = zone.bounds.y1; y <= zone.bounds.y2 && !zoneReachable; y += 1) {
      for (let x = zone.bounds.x1; x <= zone.bounds.x2; x += 1) {
        if (expedition.cells[y]?.[x]?.zoneId === zone.id && reached.has(`${x},${y}`)) {
          zoneReachable = true;
          break;
        }
      }
    }
    expect(zoneReachable).toBe(true);
  }
}
