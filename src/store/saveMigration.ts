import type { BookFragment } from '@/types/books';

export type MotionPreference = 'system' | 'reduce' | 'full';
export type SavedThemeId = 'scriptorium' | 'cathedral' | 'university' | 'gardens';

export interface SavedSettingsV7 {
  narrationEnabled: boolean;
  sfxEnabled: boolean;
  ambienceEnabled: boolean;
  masterVolume: number;
  motionPreference: MotionPreference;
}

export interface SaveV7 {
  schemaVersion: 7;
  player: {
    id: string;
    name: string;
  };
  collectedFragmentIds: string[];
  exploration: {
    visitedMaps: string[];
    discoveredNPCs: string[];
    readJournals: string[];
    collectedArtifacts: string[];
  };
  hasSeenHowToPlay: boolean;
  settings: SavedSettingsV7;
  previousThemeId: SavedThemeId | null;
}

const DEFAULT_SETTINGS: SavedSettingsV7 = {
  narrationEnabled: true,
  sfxEnabled: true,
  ambienceEnabled: true,
  masterVolume: 0.7,
  motionPreference: 'system',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : [];
}

function finiteNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function isThemeId(value: unknown): value is SavedThemeId {
  return value === 'scriptorium' || value === 'cathedral' || value === 'university' || value === 'gardens';
}

function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduce' || value === 'full';
}

/**
 * Converts every historical persisted shape into the deliberately small v7 save.
 * Active expedition state is intentionally discarded: loading always starts aboard ship.
 */
export function migratePersistedSave(persisted: unknown, version: number): SaveV7 {
  const source = record(persisted);
  const player = record(source.player);
  const exploration = record(source.exploration);
  const oldSettings = record(source.settings);

  const idsFromCurrentSave = strings(source.collectedFragmentIds);
  const idsFromLegacyLibrary = Array.isArray(source.library)
    ? source.library
        .map((fragment) => record(fragment).id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const collectedFragmentIds = [...new Set(idsFromCurrentSave.length > 0 ? idsFromCurrentSave : idsFromLegacyLibrary)];

  const legacyTts = typeof oldSettings.ttsEnabled === 'boolean' ? oldSettings.ttsEnabled : true;
  const narrationEnabled = typeof oldSettings.narrationEnabled === 'boolean'
    ? oldSettings.narrationEnabled
    : legacyTts;

  const readJournals = strings(exploration.readJournals).filter(
    (id) => !id.startsWith('journal-vault') && !id.startsWith('vault-clue'),
  );

  return {
    schemaVersion: 7,
    player: {
      id: typeof player.id === 'string' && player.id ? player.id : 'explorer',
      name: typeof player.name === 'string' && player.name ? player.name : 'Explorer',
    },
    collectedFragmentIds,
    exploration: {
      visitedMaps: strings(exploration.visitedMaps),
      discoveredNPCs: strings(exploration.discoveredNPCs),
      readJournals,
      collectedArtifacts: strings(exploration.collectedArtifacts),
    },
    hasSeenHowToPlay: typeof source.hasSeenHowToPlay === 'boolean'
      ? source.hasSeenHowToPlay
      : typeof source.hasSeenWelcome === 'boolean'
        ? source.hasSeenWelcome
        : version < 3,
    settings: {
      narrationEnabled,
      sfxEnabled: typeof oldSettings.sfxEnabled === 'boolean'
        ? oldSettings.sfxEnabled
        : DEFAULT_SETTINGS.sfxEnabled,
      ambienceEnabled: typeof oldSettings.ambienceEnabled === 'boolean'
        ? oldSettings.ambienceEnabled
        : DEFAULT_SETTINGS.ambienceEnabled,
      masterVolume: finiteNumber(oldSettings.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
      motionPreference: isMotionPreference(oldSettings.motionPreference)
        ? oldSettings.motionPreference
        : DEFAULT_SETTINGS.motionPreference,
    },
    previousThemeId: isThemeId(source.previousThemeId) ? source.previousThemeId : null,
  };
}

/** Resolve persisted IDs against canonical content after YAML has loaded. */
export function resolveSavedFragments(
  ids: readonly string[],
  catalog: readonly BookFragment[],
): BookFragment[] {
  const byId = new Map(catalog.map((fragment) => [fragment.id, fragment]));
  const resolved: BookFragment[] = [];

  for (const id of new Set(ids)) {
    const fragment = byId.get(id);
    if (fragment) resolved.push(fragment);
  }

  return resolved;
}

export const DEFAULT_SAVED_SETTINGS = DEFAULT_SETTINGS;
