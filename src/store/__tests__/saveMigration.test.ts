import { describe, expect, it } from 'vitest';
import {
  migratePersistedSave,
  resolveSavedFragments,
  type SaveV5,
} from '../saveMigration';

describe('save migration seam', () => {
  it('migrates a v4 save to fragment ids and safely recalls the player to the ship', () => {
    const migrated = migratePersistedSave(
      {
        player: {
          id: 'explorer-1',
          name: 'Explorer',
          position: { x: 17, y: 23 },
          currentMapId: 'earth-expedition-old',
          flashlightBattery: 41,
          spareBatteries: 2,
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
      schemaVersion: 5,
      player: {
        id: 'explorer-1',
        name: 'Explorer',
        flashlightBattery: 41,
        spareBatteries: 2,
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

  it('normalizes a v5 save without discarding valid preferences or progress', () => {
    const input: SaveV5 = {
      schemaVersion: 5,
      player: {
        id: 'explorer-2',
        name: 'Reader',
        flashlightBattery: 88,
        spareBatteries: 3,
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

    expect(migratePersistedSave(input, 5)).toEqual({
      ...input,
      collectedFragmentIds: ['known', 'missing'],
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
