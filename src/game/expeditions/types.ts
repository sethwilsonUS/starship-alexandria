export const EXPEDITION_THEME_IDS = [
  'scriptorium',
  'cathedral',
  'university',
  'gardens',
] as const;

export type ThemeId = (typeof EXPEDITION_THEME_IDS)[number];

export type TopologyKind = 'digger' | 'cross-plan' | 'courtyard' | 'cellular';

export type TerrainKind =
  | 'wall'
  | 'rubble'
  | 'stone-floor'
  | 'wood-floor'
  | 'path'
  | 'soil'
  | 'grass'
  | 'water';

export type FootstepSurface = 'stone' | 'wood' | 'dirt' | 'grass' | 'sand' | 'water';

export type RenderRole =
  | 'wall'
  | 'rubble'
  | 'floor'
  | 'floor-variant'
  | 'path'
  | 'water'
  | 'vegetation'
  | 'debris'
  | 'feature';

export type ZoneKind =
  | 'scriptorium'
  | 'stacks'
  | 'reading-room'
  | 'refectory'
  | 'workshop'
  | 'archives'
  | 'nave'
  | 'transept'
  | 'choir'
  | 'chapel'
  | 'cloister'
  | 'crypt'
  | 'narthex'
  | 'courtyard'
  | 'lecture-hall'
  | 'laboratory'
  | 'dormitory'
  | 'special-collections'
  | 'registrar'
  | 'commons'
  | 'observatory'
  | 'clearing';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SemanticCell {
  terrain: TerrainKind;
  walkable: boolean;
  opaque: boolean;
  surface: FootstepSurface;
  renderRole: RenderRole;
  zoneId: string | null;
}

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  bounds: Bounds;
  center: Point;
}

export interface ThemeVaultDefinition {
  contentId: string;
  clueContentId: string;
  label: string;
  clueLabel: string;
  clueDescription: string;
  preferredZoneName: string;
}

export interface ExpeditionTheme {
  id: ThemeId;
  title: string;
  kicker: string;
  description: string;
  environment: string;
  hazard: string;
  objective: string;
  topology: TopologyKind;
  atlasKey: string;
  ambienceKey: string;
  accentColor: string;
  roomNames: readonly string[];
  npcIds: readonly string[];
  journalIds: readonly string[];
  propIds: readonly string[];
  vault: ThemeVaultDefinition;
}

interface PlacedEntityBase {
  id: string;
  position: Point;
  zoneId: string;
  blocksMovement: boolean;
}

export interface PlacedFragmentEntity extends PlacedEntityBase {
  kind: 'fragment';
  fragmentId: string;
}

export interface PlacedNpcEntity extends PlacedEntityBase {
  kind: 'npc';
  npcId: string;
  blocksMovement: true;
}

export interface PlacedJournalEntity extends PlacedEntityBase {
  kind: 'journal';
  journalId: string;
}

export interface PlacedMapEntity extends PlacedEntityBase {
  kind: 'map';
}

export interface PlacedClueEntity extends PlacedEntityBase {
  kind: 'clue';
  clueId: string;
  clueContentId: string;
  vaultId: string;
  label: string;
}

export interface PlacedPropEntity extends PlacedEntityBase {
  kind: 'prop';
  propId: string;
}

export type PlacedEntity =
  | PlacedFragmentEntity
  | PlacedNpcEntity
  | PlacedJournalEntity
  | PlacedMapEntity
  | PlacedClueEntity
  | PlacedPropEntity;

export type VaultReward =
  | { kind: 'fragment'; fragmentId: string }
  | { kind: 'lore'; loreJournalId: string | null };

export interface PlacedVault {
  id: string;
  contentId: string;
  /** Narrated after discovering the clue; the player never has to type it. */
  code: string;
  position: Point;
  zoneId: string;
  label: string;
  clueId: string;
  clueContentId: string;
  cluePosition: Point;
  clueLabel: string;
  clueDescription: string;
  reward: VaultReward;
}

export interface ExpeditionFragmentRef {
  id: string;
  themeIds?: readonly ThemeId[];
}

export interface ExpeditionContentCatalog {
  fragments: readonly ExpeditionFragmentRef[];
  npcIdsByTheme: Partial<Record<ThemeId, readonly string[]>>;
  journalIdsByTheme: Partial<Record<ThemeId, readonly string[]>>;
}

export interface GenerateExpeditionInput {
  seed: string;
  themeId: ThemeId;
  collectedFragmentIds: readonly string[];
  /** Optional runtime catalog. Omitted sections use registry defaults; explicit empty arrays disable them. */
  contentCatalog?: Partial<ExpeditionContentCatalog>;
}

export interface GeneratedExpedition {
  seed: string;
  themeId: ThemeId;
  topology: TopologyKind;
  width: number;
  height: number;
  cells: SemanticCell[][];
  zones: Zone[];
  spawn: Point;
  extraction: Point;
  entities: PlacedEntity[];
  vault: PlacedVault;
  generation: {
    attempts: number;
    usedFallback: boolean;
  };
}
