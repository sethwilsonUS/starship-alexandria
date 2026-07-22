import { describe, expect, it } from 'vitest';
import {
  migratePersistedSave,
  resolveSavedFragments,
  type SaveV6,
} from '../saveMigration';

describe('save migration seam', () => {
  it('migrates a v4 save to v6 fragment ids and safely recalls the player to the ship', () => {
    const migrated = migratePersistedSave(
      {
        player: {
          id: 'explorer-1',
          name: 'Explorer',
          position: { x: 17, y: 23 },
          currentMapId: 'earth-expedition-old',
        },
        library: [
          { id: 'fragment-a', bookId: 'book-a', order: 1, label: 'A', text: 'old cached text' },
          { id: 'fragment-a', bookId: 'book-a', order: 1, label: 'A', text: 'duplicate' },
          { id: 'fragment-b', bookId: 'book-b', order: 1, label: 'B', text: 'old cached text' },
        ],
        exploration: {
          visitedMaps: ['earth-expedition-old'],
          discoveredNPCs: ['martha'],
          readJournals: ['journal-vault-hint'],
          totalFragmentsFound: 2,
          collectedArtifacts: ['artifact-1'],
        },
        hasSeenWelcome: true,
        settings: { ttsEnabled: false },
      },
      4,
    );

    expect(migrated).toMatchObject({
      schemaVersion: 6,
      player: {
        id: 'explorer-1',
        name: 'Explorer',
      },
      collectedFragmentIds: ['fragment-a', 'fragment-b'],
      hasSeenWelcome: true,
      previousThemeId: null,
      settings: {
        narrationEnabled: false,
        sfxEnabled: true,
        ambienceEnabled: true,
        masterVolume: 0.7,
        motionPreference: 'system',
      },
    });
    expect(migrated.exploration.readJournals).toEqual([]);
    expect(migrated.exploration).not.toHaveProperty('totalFragmentsFound');
    expect(migrated).not.toHaveProperty('library');
    expect(migrated.player).not.toHaveProperty('position');
    expect(migrated.player).not.toHaveProperty('currentMapId');
  });

  it('normalizes a v6 save without discarding valid preferences or progress', () => {
    const input: SaveV6 = {
      schemaVersion: 6,
      player: {
        id: 'explorer-2',
        name: 'Reader',
      },
      collectedFragmentIds: ['known', 'missing', 'known'],
      exploration: {
        visitedMaps: ['scriptorium'],
        discoveredNPCs: ['imani'],
        readJournals: [],
        collectedArtifacts: [],
      },
      hasSeenWelcome: true,
      settings: {
        narrationEnabled: true,
        sfxEnabled: false,
        ambienceEnabled: false,
        masterVolume: 0.35,
        motionPreference: 'reduce',
      },
      previousThemeId: 'cathedral',
    };

    expect(migratePersistedSave(input, 6)).toEqual({
      ...input,
      collectedFragmentIds: ['known', 'missing'],
    });
  });

  it('upgrades a compact v5 save to v6 without losing identity or progress', () => {
    const migrated = migratePersistedSave({
      schemaVersion: 5,
      player: { id: 'v5-explorer', name: 'Archivist' },
      collectedFragmentIds: ['known'],
      exploration: {
        visitedMaps: ['gardens'],
        discoveredNPCs: ['noor'],
        readJournals: ['journal-garden-log'],
        collectedArtifacts: ['seed-vault'],
      },
      hasSeenWelcome: true,
      settings: {
        narrationEnabled: false,
        sfxEnabled: true,
        ambienceEnabled: false,
        masterVolume: 0.5,
        motionPreference: 'reduce',
      },
      previousThemeId: 'gardens',
    }, 5);

    expect(migrated).toMatchObject({
      schemaVersion: 6,
      player: { id: 'v5-explorer', name: 'Archivist' },
      collectedFragmentIds: ['known'],
      exploration: {
        visitedMaps: ['gardens'],
        collectedArtifacts: ['seed-vault'],
      },
      previousThemeId: 'gardens',
    });
  });

  it('resolves ids against the current catalog and filters retired fragments', () => {
    const catalog = [
      { id: 'known', bookId: 'book', order: 1, label: 'Known', text: 'Current canonical text' },
      { id: 'second', bookId: 'book', order: 2, label: 'Second', text: 'Another text' },
    ];

    expect(resolveSavedFragments(['known', 'retired', 'known'], catalog)).toEqual([catalog[0]]);
  });
});
