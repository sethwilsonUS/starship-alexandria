import { MAP_HEIGHT, MAP_WIDTH } from '@/config/gameConfig';
import {
  DEFAULT_FRAGMENT_CATALOG,
  EXPEDITION_THEMES,
} from './themes';
import { decorateLayout, buildFallbackLayout, buildLayout, type LayoutCandidate } from './layouts';
import { hashSeed, SeededRandom } from './rng';
import type {
  ExpeditionContentCatalog,
  ExpeditionFragmentRef,
  ExpeditionTheme,
  GenerateExpeditionInput,
  GeneratedExpedition,
  PlacedEntity,
  PlacedVault,
  Point,
  SemanticCell,
  ThemeId,
  VaultReward,
  Zone,
} from './types';

const MAX_GENERATION_ATTEMPTS = 20;
const MIN_WALKABLE_TILES = 120;

interface ResolvedCatalog {
  fragments: ExpeditionFragmentRef[];
  npcIds: string[];
  journalIds: string[];
}

interface PositionedSlot {
  position: Point;
  zoneId: string;
}

/**
 * Build one deterministic expedition. The function is synchronous and pure: it performs
 * no I/O, touches no game/store state, and restores rot-js's singleton RNG before returning.
 */
export function generateExpedition(input: GenerateExpeditionInput): GeneratedExpedition {
  const theme = EXPEDITION_THEMES[input.themeId];
  if (!theme) {
    throw new Error(`Unknown expedition theme: ${String(input.themeId)}`);
  }
  const catalog = resolveCatalog(theme, input.contentCatalog);

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const attemptSeed = `${input.seed}|${theme.id}|attempt:${attempt}`;
    const layout = buildLayout(theme, new SeededRandom(`${attemptSeed}|layout`));
    if (!isValidLayout(layout)) continue;

    const decorated = decorateLayout(layout, new SeededRandom(`${attemptSeed}|decor:cells`));
    const expedition = populateExpedition({
      input,
      theme,
      catalog,
      layout: decorated,
      attemptSeed,
      attempts: attempt,
      usedFallback: false,
    });
    if (expedition && isValidExpedition(expedition, input.collectedFragmentIds)) {
      return expedition;
    }
  }

  const fallbackSeed = `${input.seed}|${theme.id}|fallback`;
  const fallback = decorateLayout(
    buildFallbackLayout(theme, new SeededRandom(`${fallbackSeed}|layout`)),
    new SeededRandom(`${fallbackSeed}|decor:cells`)
  );
  const expedition = populateExpedition({
    input,
    theme,
    catalog,
    layout: fallback,
    attemptSeed: fallbackSeed,
    attempts: MAX_GENERATION_ATTEMPTS,
    usedFallback: true,
  });
  if (!expedition || !isValidLayout(fallback) || !isValidExpedition(expedition, input.collectedFragmentIds)) {
    throw new Error(`Unable to generate a valid ${theme.id} expedition for seed "${input.seed}"`);
  }
  return expedition;
}

function resolveCatalog(
  theme: ExpeditionTheme,
  supplied?: Partial<ExpeditionContentCatalog>
): ResolvedCatalog {
  const fragmentSource = supplied?.fragments ?? DEFAULT_FRAGMENT_CATALOG;
  const npcSource = supplied?.npcIdsByTheme?.[theme.id] ?? theme.npcIds;
  const journalSource = supplied?.journalIdsByTheme?.[theme.id] ?? theme.journalIds;

  const seenFragments = new Set<string>();
  const fragments = fragmentSource.flatMap((fragment) => {
    const id = fragment.id.trim();
    if (!id || seenFragments.has(id)) return [];
    seenFragments.add(id);
    return [{ id, themeIds: fragment.themeIds ? [...fragment.themeIds] : undefined }];
  });

  return {
    fragments,
    npcIds: uniqueNonEmpty(npcSource),
    journalIds: uniqueNonEmpty(journalSource),
  };
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = value.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function populateExpedition(options: {
  input: GenerateExpeditionInput;
  theme: ExpeditionTheme;
  catalog: ResolvedCatalog;
  layout: LayoutCandidate;
  attemptSeed: string;
  attempts: number;
  usedFallback: boolean;
}): GeneratedExpedition | null {
  const { input, theme, catalog, layout, attemptSeed, attempts, usedFallback } = options;
  const vaultRandom = new SeededRandom(`${attemptSeed}|vault`);
  const npcRandom = new SeededRandom(`${attemptSeed}|npc`);
  const contentPositionRandom = new SeededRandom(`${attemptSeed}|content:positions`);
  const contentIdRandom = new SeededRandom(`${attemptSeed}|content:ids`);
  const decorPropRandom = new SeededRandom(`${attemptSeed}|decor:props`);
  const reserved = new Set<string>([pointKey(layout.spawn)]);
  const protectedInteractivePositions = new Set<string>([
    pointKey(layout.spawn),
    pointKey(layout.extraction),
  ]);

  const preferredVaultZone =
    layout.zones.find((zone) => zone.name === theme.vault.preferredZoneName) ??
    farthestZones(layout.zones, layout.spawn)[0];
  if (!preferredVaultZone) return null;

  const vaultSlot = takeSlot(
    layout,
    [preferredVaultZone, ...farthestZones(layout.zones, layout.spawn)],
    vaultRandom,
    reserved,
    true
  );
  if (!vaultSlot) return null;

  const clueZones = farthestZones(
    layout.zones.filter((zone) => zone.id !== vaultSlot.zoneId),
    vaultSlot.position
  );
  const clueSlot = takeSlot(layout, clueZones, vaultRandom, reserved, false);
  if (!clueSlot) return null;

  const vaultId = `vault-${theme.id}-${hashSeed(`${input.seed}|${theme.id}`).toString(36)}`;
  const clueId = `clue-${vaultId}`;
  const vaultCode = String(vaultRandom.int(0, 9_999)).padStart(4, '0');
  const collected = new Set(input.collectedFragmentIds);
  const uncollected = catalog.fragments.filter((fragment) => !collected.has(fragment.id));
  const affineUncollected = uncollected.filter(
    (fragment) => !fragment.themeIds?.length || fragment.themeIds.includes(theme.id)
  );
  const rewardFragment = vaultRandom.pick(
    affineUncollected.length > 0 ? affineUncollected : uncollected
  );
  const reward: VaultReward = rewardFragment
    ? { kind: 'fragment', fragmentId: rewardFragment.id }
    : { kind: 'lore', loreJournalId: catalog.journalIds[0] ?? null };

  const vault: PlacedVault = {
    id: vaultId,
    contentId: theme.vault.contentId,
    code: vaultCode,
    position: vaultSlot.position,
    zoneId: vaultSlot.zoneId,
    label: theme.vault.label,
    clueId,
    clueContentId: theme.vault.clueContentId,
    cluePosition: clueSlot.position,
    clueLabel: theme.vault.clueLabel,
    clueDescription: theme.vault.clueDescription,
    reward,
  };

  const entities: PlacedEntity[] = [
    {
      id: clueId,
      kind: 'clue',
      clueId,
      clueContentId: theme.vault.clueContentId,
      vaultId,
      label: theme.vault.clueLabel,
      position: clueSlot.position,
      zoneId: clueSlot.zoneId,
      blocksMovement: false,
    },
  ];

  const npcCount = Math.min(catalog.npcIds.length, 1 + npcRandom.int(0, 1));
  const npcIds = npcRandom.shuffle(catalog.npcIds).slice(0, npcCount);
  const npcZones = npcRandom.shuffle(
    layout.zones.filter((zone) => zone.id !== vaultSlot.zoneId && zone.id !== clueSlot.zoneId)
  );
  const npcZoneIds = new Set<string>();
  for (let index = 0; index < npcIds.length; index += 1) {
    const slot = takeProtectedSlot(
      layout,
      rotate(npcZones, index),
      npcRandom,
      reserved,
      protectedInteractivePositions,
      true
    );
    if (!slot) return null;
    npcZoneIds.add(slot.zoneId);
    entities.push({
      id: `npc-${index}`,
      kind: 'npc',
      npcId: npcIds[index],
      position: slot.position,
      zoneId: slot.zoneId,
      blocksMovement: true,
    });
  }

  const fragmentTargetCount = 2 + contentPositionRandom.int(0, 2);
  const fragmentSlots = takeSlotsAcrossZones(
    layout,
    contentPositionRandom.shuffle(layout.zones.filter((zone) => !npcZoneIds.has(zone.id))),
    contentPositionRandom,
    reserved,
    protectedInteractivePositions,
    fragmentTargetCount
  );
  const fragmentPool = orderFragmentPool(
    catalog.fragments.filter(
      (fragment) => !collected.has(fragment.id) && fragment.id !== rewardFragment?.id
    ),
    theme.id,
    contentIdRandom
  );
  const fragmentsToPlace = fragmentPool.slice(0, fragmentSlots.length);
  for (let index = 0; index < fragmentsToPlace.length; index += 1) {
    const slot = fragmentSlots[index];
    entities.push({
      id: `fragment-${index}`,
      kind: 'fragment',
      fragmentId: fragmentsToPlace[index].id,
      position: slot.position,
      zoneId: slot.zoneId,
      blocksMovement: false,
    });
  }
  // Slots with no content should remain available for later interactives rather than becoming ghost pickups.
  for (let index = fragmentsToPlace.length; index < fragmentSlots.length; index += 1) {
    const key = pointKey(fragmentSlots[index].position);
    reserved.delete(key);
    protectedInteractivePositions.delete(key);
  }

  const journalIds = contentIdRandom.shuffle(catalog.journalIds).slice(0, 1);
  for (let index = 0; index < journalIds.length; index += 1) {
    const slot = takeProtectedSlot(
      layout,
      contentPositionRandom.shuffle(layout.zones),
      contentPositionRandom,
      reserved,
      protectedInteractivePositions,
      false
    );
    if (!slot) return null;
    entities.push({
      id: `journal-${index}`,
      kind: 'journal',
      journalId: journalIds[index],
      position: slot.position,
      zoneId: slot.zoneId,
      blocksMovement: false,
    });
  }

  const mapSlot = takeSlot(
    layout,
    contentPositionRandom.shuffle(layout.zones),
    contentPositionRandom,
    reserved,
    false
  );
  if (!mapSlot) return null;
  entities.push({
    id: 'area-map',
    kind: 'map',
    position: mapSlot.position,
    zoneId: mapSlot.zoneId,
    blocksMovement: false,
  });

  const propCount = Math.min(6, theme.propIds.length * 2);
  for (let index = 0; index < propCount; index += 1) {
    const slot = takeSlot(
      layout,
      decorPropRandom.shuffle(layout.zones),
      decorPropRandom,
      reserved,
      false
    );
    if (!slot) break;
    entities.push({
      id: `prop-${index}`,
      kind: 'prop',
      propId: theme.propIds[index % theme.propIds.length],
      position: slot.position,
      zoneId: slot.zoneId,
      blocksMovement: false,
    });
  }

  return {
    seed: input.seed,
    themeId: theme.id,
    topology: theme.topology,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    cells: layout.cells,
    zones: layout.zones,
    spawn: layout.spawn,
    extraction: layout.extraction,
    entities,
    vault,
    generation: { attempts, usedFallback },
  };
}

function orderFragmentPool(
  fragments: readonly ExpeditionFragmentRef[],
  themeId: ThemeId,
  random: SeededRandom
): ExpeditionFragmentRef[] {
  const affine = fragments.filter(
    (fragment) => !fragment.themeIds?.length || fragment.themeIds.includes(themeId)
  );
  const general = fragments.filter((fragment) => !affine.includes(fragment));
  return [...random.shuffle(affine), ...random.shuffle(general)];
}

function takeSlotsAcrossZones(
  layout: LayoutCandidate,
  zones: readonly Zone[],
  random: SeededRandom,
  reserved: Set<string>,
  protectedInteractivePositions: Set<string>,
  count: number
): PositionedSlot[] {
  const slots: PositionedSlot[] = [];
  for (let index = 0; index < count; index += 1) {
    const slot = takeProtectedSlot(
      layout,
      rotate(zones, index),
      random,
      reserved,
      protectedInteractivePositions,
      false
    );
    if (!slot) break;
    slots.push(slot);
  }
  return slots;
}

function takeProtectedSlot(
  layout: LayoutCandidate,
  zones: readonly Zone[],
  random: SeededRandom,
  reserved: Set<string>,
  protectedInteractivePositions: Set<string>,
  blocksMovement: boolean
): PositionedSlot | null {
  const slot = takeSlot(
    layout,
    zones,
    random,
    reserved,
    blocksMovement,
    protectedInteractivePositions
  );
  if (slot) protectedInteractivePositions.add(pointKey(slot.position));
  return slot;
}

function takeSlot(
  layout: LayoutCandidate,
  zones: readonly Zone[],
  random: SeededRandom,
  reserved: Set<string>,
  blocksMovement: boolean,
  avoidAdjacentTo?: ReadonlySet<string>
): PositionedSlot | null {
  const seenZones = new Set<string>();
  for (const zone of zones) {
    if (seenZones.has(zone.id)) continue;
    seenZones.add(zone.id);
    const candidates: Point[] = [];
    for (let y = zone.bounds.y1; y <= zone.bounds.y2; y += 1) {
      for (let x = zone.bounds.x1; x <= zone.bounds.x2; x += 1) {
        const cell = layout.cells[y]?.[x];
        const point = { x, y };
        if (!cell?.walkable || cell.zoneId !== zone.id || reserved.has(pointKey(point))) continue;
        if (manhattan(point, layout.spawn) < 3) continue;
        if (
          avoidAdjacentTo &&
          cardinalNeighbors(point).some((neighbor) => avoidAdjacentTo.has(pointKey(neighbor)))
        ) {
          continue;
        }
        if (blocksMovement && walkableNeighborCount(layout.cells, point) < 3) continue;
        candidates.push(point);
      }
    }
    const position = random.pick(candidates);
    if (!position) continue;
    reserved.add(pointKey(position));
    return { position, zoneId: zone.id };
  }
  return null;
}

function rotate<T>(values: readonly T[], offset: number): T[] {
  if (values.length === 0) return [];
  const start = offset % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function farthestZones(zones: readonly Zone[], from: Point): Zone[] {
  return [...zones].sort((left, right) =>
    manhattan(right.center, from) - manhattan(left.center, from)
  );
}

function manhattan(left: Point, right: Point): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function walkableNeighborCount(cells: SemanticCell[][], point: Point): number {
  return cardinalNeighbors(point).filter(({ x, y }) => cells[y]?.[x]?.walkable).length;
}

function cardinalNeighbors(point: Point): Point[] {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ];
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function isValidLayout(layout: LayoutCandidate): boolean {
  if (layout.cells.length !== MAP_HEIGHT || layout.cells.some((row) => row.length !== MAP_WIDTH)) {
    return false;
  }
  if (!layout.cells[layout.spawn.y]?.[layout.spawn.x]?.walkable) return false;
  if (!layout.cells[layout.extraction.y]?.[layout.extraction.x]?.walkable) return false;

  for (let x = 0; x < MAP_WIDTH; x += 1) {
    if (layout.cells[0][x].walkable || layout.cells[MAP_HEIGHT - 1][x].walkable) return false;
  }
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    if (layout.cells[y][0].walkable || layout.cells[y][MAP_WIDTH - 1].walkable) return false;
  }

  const reached = computeReachable(layout.cells, layout.spawn, new Set());
  let walkableCount = 0;
  for (const row of layout.cells) {
    for (const cell of row) if (cell.walkable) walkableCount += 1;
  }
  if (walkableCount < MIN_WALKABLE_TILES || reached.size !== walkableCount) return false;

  if (layout.zones.length < 4) return false;
  for (const zone of layout.zones) {
    let hasReachableCell = false;
    for (let y = zone.bounds.y1; y <= zone.bounds.y2 && !hasReachableCell; y += 1) {
      for (let x = zone.bounds.x1; x <= zone.bounds.x2; x += 1) {
        if (layout.cells[y]?.[x]?.zoneId === zone.id && reached.has(`${x},${y}`)) {
          hasReachableCell = true;
          break;
        }
      }
    }
    if (!hasReachableCell) return false;
  }
  return true;
}

function isValidExpedition(
  expedition: GeneratedExpedition,
  collectedFragmentIds: readonly string[]
): boolean {
  const occupied = new Set<string>([pointKey(expedition.spawn)]);
  const ids = new Set<string>();
  const collected = new Set(collectedFragmentIds);
  const protectedInteractivePositions = new Set<string>([
    pointKey(expedition.spawn),
    pointKey(expedition.extraction),
  ]);
  const npcZoneIds = new Set(
    expedition.entities
      .filter((entity) => entity.kind === 'npc')
      .map((entity) => entity.zoneId)
  );
  for (const entity of expedition.entities) {
    const key = pointKey(entity.position);
    if (ids.has(entity.id) || occupied.has(key)) return false;
    if (!expedition.cells[entity.position.y]?.[entity.position.x]?.walkable) return false;
    if (entity.kind === 'fragment' && collected.has(entity.fragmentId)) return false;
    if (entity.kind === 'fragment' && npcZoneIds.has(entity.zoneId)) return false;
    if (isProtectedInteractive(entity)) {
      if (
        cardinalNeighbors(entity.position).some((neighbor) =>
          protectedInteractivePositions.has(pointKey(neighbor))
        )
      ) {
        return false;
      }
      protectedInteractivePositions.add(key);
    }
    ids.add(entity.id);
    occupied.add(key);
  }
  if (occupied.has(pointKey(expedition.vault.position))) return false;
  if (!expedition.cells[expedition.vault.position.y]?.[expedition.vault.position.x]?.walkable) {
    return false;
  }

  const clue = expedition.entities.find((entity) => entity.kind === 'clue');
  if (
    !clue ||
    clue.vaultId !== expedition.vault.id ||
    clue.clueId !== expedition.vault.clueId ||
    pointKey(clue.position) !== pointKey(expedition.vault.cluePosition) ||
    clue.zoneId === expedition.vault.zoneId
  ) {
    return false;
  }

  const blockers = new Set(
    expedition.entities
      .filter((entity) => entity.blocksMovement)
      .map((entity) => pointKey(entity.position))
  );
  blockers.add(pointKey(expedition.vault.position));
  const reached = computeReachable(expedition.cells, expedition.spawn, blockers);
  if (!reached.has(pointKey(expedition.extraction))) return false;
  for (const entity of expedition.entities) {
    if (entity.blocksMovement) {
      if (!cardinalNeighbors(entity.position).some((point) => reached.has(pointKey(point)))) return false;
    } else if (!reached.has(pointKey(entity.position))) {
      return false;
    }
  }
  if (!cardinalNeighbors(expedition.vault.position).some((point) => reached.has(pointKey(point)))) {
    return false;
  }
  for (const zone of expedition.zones) {
    let reachable = false;
    for (let y = zone.bounds.y1; y <= zone.bounds.y2 && !reachable; y += 1) {
      for (let x = zone.bounds.x1; x <= zone.bounds.x2; x += 1) {
        if (expedition.cells[y]?.[x]?.zoneId === zone.id && reached.has(`${x},${y}`)) {
          reachable = true;
          break;
        }
      }
    }
    if (!reachable) return false;
  }
  return true;
}

function isProtectedInteractive(entity: PlacedEntity): boolean {
  return (
    entity.kind === 'fragment' ||
    entity.kind === 'npc' ||
    entity.kind === 'journal'
  );
}

function computeReachable(
  cells: SemanticCell[][],
  spawn: Point,
  blocked: ReadonlySet<string>
): Set<string> {
  const reached = new Set<string>();
  if (!cells[spawn.y]?.[spawn.x]?.walkable || blocked.has(pointKey(spawn))) return reached;
  const queue: Point[] = [{ ...spawn }];
  reached.add(pointKey(spawn));
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of cardinalNeighbors(queue[index])) {
      const key = pointKey(next);
      if (!cells[next.y]?.[next.x]?.walkable || blocked.has(key) || reached.has(key)) continue;
      reached.add(key);
      queue.push(next);
    }
  }
  return reached;
}
