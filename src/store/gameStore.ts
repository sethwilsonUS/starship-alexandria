/** Runtime game state plus the deliberately small, versioned local save. */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  GameState,
  GameActions,
  PersistedState,
  PlayerState,
  ExplorationState,
  DialogueLine,
  SettingsState,
  SessionVaultInfo,
} from '@/types/store';
import type { BookFragment } from '@/types/books';
import type { Position } from '@/types/game';
import type { MapRoom } from '@/types/store';
import {
  setAudioUnlockedGlobal,
  setMasterVolumeGlobal,
  setSfxEnabledGlobal,
  setTTSEnabledGlobal,
} from '@/utils/speech';
import { getBookCatalogSync } from '@/data/books';
import {
  DEFAULT_SAVED_SETTINGS,
  migratePersistedSave,
  resolveSavedFragments,
  type MotionPreference,
  type SavedThemeId,
} from './saveMigration';

const STORAGE_KEY = 'starship-alexandria-save';

const createInitialPlayer = (): PlayerState => ({
  id: uuidv4(),
  name: 'Explorer',
  position: { x: 0, y: 0 },
  currentMapId: 'ship',
  flashlightBattery: 100,
  spareBatteries: 0,
});

const initialExploration: ExplorationState = {
  visitedMaps: [],
  discoveredNPCs: [],
  readJournals: [],
  collectedArtifacts: [],
};

const initialSettings: SettingsState = {
  ...DEFAULT_SAVED_SETTINGS,
};

const createInitialSession = () => ({
  contentReady: false,
  currentDialogue: null,
  currentJournal: null,
  isReadingBook: false,
  currentBookFragment: null,
  gamePhase: 'ship' as const,
  exploredTiles: [] as string[],
  booksOnThisMap: 0,
  booksRemainingOnThisMap: 0,
  roomsWithBooksOnMap: [] as string[],
  npcRoomsOnMap: {} as Record<string, string>,
  npcPositionsOnMap: [] as Array<{ id: string; name: string; x: number; y: number; roomName: string }>,
  explorableTileCount: 0,
  fragmentsAtExpeditionStart: 0,
  hasAreaMap: false,
  mapRooms: [] as MapRoom[],
  mapWalls: [] as number[][],
  mapSpawn: { x: 0, y: 0 },
  currentZoneId: null as string | null,
  visitedRooms: [] as string[],
  vaultInfo: null as SessionVaultInfo | null,
  vaultOpened: false,
  activeThemeId: null as SavedThemeId | null,
  activeExpeditionId: null as string | null,
  discoveredClueIds: [] as string[],
  launchGateOpen: true,
  audioUnlocked: false,
  contentError: null as string | null,
});

type GameStore = GameState;

const createActions = (
  set: (fn: (state: GameStore) => Partial<GameStore>) => void,
  get: () => GameStore
): GameActions => ({
  movePlayer: (position: Position) =>
    set((s) => ({
      player: { ...s.player, position },
    })),

  decrementFlashlight: () =>
    set((s) => ({
      player: {
        ...s.player,
        flashlightBattery: Math.max(0, s.player.flashlightBattery - 1),
      },
    })),

  restoreFlashlight: (amount: number) =>
    set((s) => ({
      player: {
        ...s.player,
        flashlightBattery: Math.min(100, s.player.flashlightBattery + amount),
      },
    })),

  setFlashlight: (amount: number) =>
    set((s) => ({
      player: {
        ...s.player,
        flashlightBattery: Math.max(0, Math.min(100, amount)),
      },
    })),

  addBattery: () =>
    set((s) => ({
      player: { ...s.player, spareBatteries: s.player.spareBatteries + 1 },
    })),

  useBattery: () => {
    const { spareBatteries, flashlightBattery } = get().player;
    if (spareBatteries <= 0 || flashlightBattery > 50) return false;
    set((s) => ({
      player: {
        ...s.player,
        spareBatteries: s.player.spareBatteries - 1,
        flashlightBattery: Math.min(100, s.player.flashlightBattery + 50),
      },
    }));
    return true;
  },

  collectFragment: (fragment: BookFragment) =>
    set((s) => {
      // Prevent collecting duplicate fragments
      const alreadyHave = s.library.some((f) => f.id === fragment.id);
      if (alreadyHave) {
        // Still show the book (re-reading), but don't add to library
        return {
          session: {
            ...s.session,
            currentDialogue: null,
            currentBookFragment: fragment,
            isReadingBook: true,
            gamePhase: 'reading',
          },
        };
      }
      return {
        library: [...s.library, fragment],
        savedFragmentIds: [...new Set([...s.savedFragmentIds, fragment.id])],
        session: {
          ...s.session,
          currentDialogue: null,
          currentBookFragment: fragment,
          isReadingBook: true,
          gamePhase: 'reading',
        },
      };
    }),

  markMapVisited: (mapId: string) =>
    set((s) => ({
      exploration: {
        ...s.exploration,
        visitedMaps: s.exploration.visitedMaps.includes(mapId)
          ? s.exploration.visitedMaps
          : [...s.exploration.visitedMaps, mapId],
      },
    })),

  discoverNPC: (npcId: string) =>
    set((s) => ({
      exploration: {
        ...s.exploration,
        discoveredNPCs: s.exploration.discoveredNPCs.includes(npcId)
          ? s.exploration.discoveredNPCs
          : [...s.exploration.discoveredNPCs, npcId],
      },
    })),

  readJournal: (journalId: string) =>
    set((s) => ({
      exploration: {
        ...s.exploration,
        readJournals: s.exploration.readJournals.includes(journalId)
          ? s.exploration.readJournals
          : [...s.exploration.readJournals, journalId],
      },
    })),

  openDialogue: (lines: DialogueLine[]) =>
    set((s) => ({
      session: {
        ...s.session,
        currentDialogue: lines,
        currentBookFragment: null,
        isReadingBook: false,
        gamePhase: 'dialogue',
      },
    })),

  closeDialogue: () =>
    set((s) => {
      // Determine the correct phase to return to
      let nextPhase: 'ship' | 'exploring' | 'reading' = 'ship';
      
      if (s.session.isReadingBook || s.session.currentBookFragment) {
        nextPhase = 'reading';
      } else if (s.player.currentMapId && s.player.currentMapId !== 'ship' && s.player.currentMapId !== 'default') {
        nextPhase = 'exploring';
      }
      // Default to 'ship' for safety (handles undefined/null/ship/default mapId)
      
      return {
        session: {
          ...s.session,
          currentDialogue: null,
          gamePhase: nextPhase,
        },
      };
    }),

  closeBook: () =>
    set((s) => ({
      session: {
        ...s.session,
        currentDialogue: null,
        isReadingBook: false,
        currentBookFragment: null,
        gamePhase: s.session.gamePhase === 'reading' && s.player.currentMapId === 'ship'
          ? 'ship'
          : 'exploring',
      },
    })),

  openLibraryBook: (fragment: BookFragment) =>
    set((s) => ({
      session: {
        ...s.session,
        currentBookFragment: fragment,
        isReadingBook: true,
        gamePhase: 'reading',
      },
    })),

  beamToShip: () =>
    set((s) => ({
      player: {
        ...s.player,
        currentMapId: 'ship',
      },
      session: {
        ...s.session,
        currentDialogue: null,
        currentJournal: null,
        isReadingBook: false,
        currentBookFragment: null,
        gamePhase: 'ship',
        exploredTiles: [],
        booksOnThisMap: 0,
        booksRemainingOnThisMap: 0,
        roomsWithBooksOnMap: [],
        npcRoomsOnMap: {},
        npcPositionsOnMap: [],
        explorableTileCount: 0,
        hasAreaMap: false,
        mapRooms: [],
        mapWalls: [],
        mapSpawn: { x: 0, y: 0 },
        currentZoneId: null,
        visitedRooms: [],
        vaultInfo: null,
        vaultOpened: false,
        activeThemeId: null,
        activeExpeditionId: null,
        discoveredClueIds: [],
      },
    })),

  beamToSurface: (mapId: string, themeId?: SavedThemeId) =>
    set((s) => ({
      previousThemeId: themeId ?? s.previousThemeId,
      player: {
        ...s.player,
        currentMapId: mapId,
        position: { x: 0, y: 0 },
      },
      session: {
        ...s.session,
        currentDialogue: null,
        currentJournal: null,
        isReadingBook: false,
        currentBookFragment: null,
        gamePhase: 'exploring',
        hasAreaMap: false,
        mapRooms: [],
        mapWalls: [],
        mapSpawn: { x: 0, y: 0 },
        currentZoneId: null,
        visitedRooms: [],
        vaultInfo: null,
        vaultOpened: false,
        activeThemeId: themeId ?? s.session.activeThemeId,
        activeExpeditionId: mapId,
        discoveredClueIds: [],
      },
    })),

  saveToLocalStorage: () => {
    // Persist already saves every mutation. This named checkpoint keeps scene
    // transitions explicit without serializing the active expedition.
  },

  addExploredTiles: (coords: string[]) =>
    set((s) => ({
      session: {
        ...s.session,
        exploredTiles: [...new Set([...s.session.exploredTiles, ...coords])],
      },
    })),

  clearExploredTiles: () =>
    set((s) => ({
      session: { ...s.session, exploredTiles: [] },
    })),

  setBooksOnThisMap: (total: number) =>
    set((s) => ({
      session: {
        ...s.session,
        booksOnThisMap: total,
        booksRemainingOnThisMap: total,
      },
    })),

  setBooksRemainingOnThisMap: (remaining: number) =>
    set((s) => ({
      session: { ...s.session, booksRemainingOnThisMap: remaining },
    })),

  setRoomsWithBooksOnMap: (roomNames: string[]) =>
    set((s) => ({
      session: { ...s.session, roomsWithBooksOnMap: roomNames },
    })),

  setNpcRoomsOnMap: (npcRooms: Record<string, string>) =>
    set((s) => ({
      session: { ...s.session, npcRoomsOnMap: npcRooms },
    })),

  setNpcPositionsOnMap: (npcs: Array<{ id: string; name: string; x: number; y: number; roomName: string }>) =>
    set((s) => ({
      session: { ...s.session, npcPositionsOnMap: npcs },
    })),

  setExplorableTileCount: (count: number) =>
    set((s) => ({
      session: { ...s.session, explorableTileCount: count },
    })),

  startExpedition: () =>
    set((s) => ({
      session: {
        ...s.session,
        fragmentsAtExpeditionStart: s.library.length,
      },
    })),

  setHasSeenWelcome: () =>
    set(() => ({
      hasSeenWelcome: true,
    })),

  setContentReady: () =>
    set((s) => {
      let library = s.library;
      let savedFragmentIds = s.savedFragmentIds;
      try {
        const fragments = getBookCatalogSync().flatMap((book) => book.fragments);
        library = resolveSavedFragments(savedFragmentIds, fragments);
        savedFragmentIds = library.map((fragment) => fragment.id);
      } catch {
        // BootScene owns the visible load failure/retry state. Keep IDs intact.
      }
      return {
        library,
        savedFragmentIds,
        session: { ...s.session, contentReady: true, contentError: null },
      };
    }),

  resetGame: () => {
    // Clear localStorage and reset all state
    localStorage.removeItem(STORAGE_KEY);
    set(() => ({
      player: createInitialPlayer(),
      library: [],
      savedFragmentIds: [],
      exploration: initialExploration,
      hasSeenWelcome: false,
      previousThemeId: null,
      settings: initialSettings,
      session: createInitialSession(),
    }));
  },

  loadFromLocalStorage: () => {
    // Persist auto-hydrates on app init; this action allows an explicit retry.
    useGameStore.persist?.rehydrate();
  },

  setMapLayoutData: (rooms: MapRoom[], walls: number[][], spawn: { x: number; y: number }) =>
    set((s) => ({
      session: {
        ...s.session,
        mapRooms: rooms,
        mapWalls: walls,
        mapSpawn: spawn,
      },
    })),

  setCurrentZone: (zoneId: string | null) =>
    set((s) => ({
      session: { ...s.session, currentZoneId: zoneId },
    })),

  collectMap: () =>
    set((s) => ({
      session: {
        ...s.session,
        hasAreaMap: true,
      },
    })),

  clearAreaMap: () =>
    set((s) => ({
      session: {
        ...s.session,
        hasAreaMap: false,
        mapRooms: [],
        mapWalls: [],
        mapSpawn: { x: 0, y: 0 },
        currentZoneId: null,
        visitedRooms: [],
        vaultInfo: null,
        vaultOpened: false,
        activeThemeId: null,
        activeExpeditionId: null,
        discoveredClueIds: [],
      },
    })),

  openMap: () =>
    set((s) => ({
      session: {
        ...s.session,
        gamePhase: 'viewing-map',
      },
    })),

  closeMap: () =>
    set((s) => ({
      session: {
        ...s.session,
        gamePhase: 'exploring',
      },
    })),

  setNarrationEnabled: (enabled: boolean) => {
    setTTSEnabledGlobal(enabled); // Sync with global state for speech module
    set((s) => ({
      settings: { ...s.settings, narrationEnabled: enabled },
    }));
  },

  setTTSEnabled: (enabled: boolean) => {
    setTTSEnabledGlobal(enabled);
    set((s) => ({ settings: { ...s.settings, narrationEnabled: enabled } }));
  },

  setSfxEnabled: (enabled: boolean) => {
    setSfxEnabledGlobal(enabled);
    set((s) => ({ settings: { ...s.settings, sfxEnabled: enabled } }));
  },

  setAmbienceEnabled: (enabled: boolean) =>
    set((s) => ({ settings: { ...s.settings, ambienceEnabled: enabled } })),

  setMasterVolume: (volume: number) => {
    const normalizedVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 0;
    setMasterVolumeGlobal(normalizedVolume);
    set((s) => ({
      settings: {
        ...s.settings,
        masterVolume: normalizedVolume,
      },
    }));
  },

  setMotionPreference: (preference: MotionPreference) =>
    set((s) => ({ settings: { ...s.settings, motionPreference: preference } })),

  acceptLaunchGate: () => {
    setAudioUnlockedGlobal(true);
    set((s) => ({
      session: { ...s.session, launchGateOpen: false, audioUnlocked: true },
    }));
  },

  reopenLaunchGate: () => {
    setAudioUnlockedGlobal(false);
    set((s) => ({
      session: { ...s.session, launchGateOpen: true, audioUnlocked: false },
    }));
  },

  setContentError: (message: string | null) =>
    set((s) => ({
      session: {
        ...s.session,
        contentReady: message ? false : s.session.contentReady,
        contentError: message,
      },
    })),

  openMissionPicker: () =>
    set((s) => ({ session: { ...s.session, gamePhase: 'mission-select' } })),

  closeMissionPicker: () =>
    set((s) => ({ session: { ...s.session, gamePhase: 'ship' } })),

  selectExpeditionTheme: (themeId: SavedThemeId) =>
    set((s) => ({
      session: { ...s.session, activeThemeId: themeId, gamePhase: 'ship' },
    })),

  discoverVaultClue: (clueId: string) =>
    set((s) => ({
      session: {
        ...s.session,
        discoveredClueIds: s.session.discoveredClueIds.includes(clueId)
          ? s.session.discoveredClueIds
          : [...s.session.discoveredClueIds, clueId],
      },
    })),

  hasDiscoveredVaultClue: (clueId: string) =>
    get().session.discoveredClueIds.includes(clueId),

  visitRoom: (roomName: string) =>
    set((s) => ({
      session: {
        ...s.session,
        visitedRooms: s.session.visitedRooms.includes(roomName)
          ? s.session.visitedRooms
          : [...s.session.visitedRooms, roomName],
      },
    })),

  setVaultInfo: (info: SessionVaultInfo | null) =>
    set((s) => ({
      session: {
        ...s.session,
        vaultInfo: info,
      },
    })),

  openVault: () =>
    set((s) => ({
      session: {
        ...s.session,
        vaultOpened: true,
      },
    })),

  collectArtifact: (artifactId: string) =>
    set((s) => ({
      exploration: {
        ...s.exploration,
        collectedArtifacts: s.exploration.collectedArtifacts.includes(artifactId)
          ? s.exploration.collectedArtifacts
          : [...s.exploration.collectedArtifacts, artifactId],
      },
    })),
});

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      player: createInitialPlayer(),
      library: [],
      savedFragmentIds: [],
      exploration: initialExploration,
      hasSeenWelcome: false,
      previousThemeId: null,
      settings: initialSettings,
      session: createInitialSession(),
      actions: createActions(set as (fn: (s: GameStore) => Partial<GameStore>) => void, get),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        schemaVersion: 5,
        player: {
          id: state.player.id,
          name: state.player.name,
          flashlightBattery: state.player.flashlightBattery,
          spareBatteries: state.player.spareBatteries,
        },
        collectedFragmentIds: state.savedFragmentIds,
        exploration: state.exploration,
        hasSeenWelcome: state.hasSeenWelcome,
        settings: state.settings,
        previousThemeId: state.previousThemeId,
      }),
      version: 5,
      onRehydrateStorage: () => (state) => {
        if (state?.settings?.narrationEnabled !== undefined) {
          setTTSEnabledGlobal(state.settings.narrationEnabled);
        }
        if (state?.settings?.sfxEnabled !== undefined) {
          setSfxEnabledGlobal(state.settings.sfxEnabled);
        }
        if (state?.settings?.masterVolume !== undefined) {
          setMasterVolumeGlobal(state.settings.masterVolume);
        }
        // A persisted save never counts as a fresh browser audio gesture.
        setAudioUnlockedGlobal(false);
      },
      migrate: (persisted: unknown, version: number) => migratePersistedSave(persisted, version),
      merge: (persisted, current) => {
        const save = migratePersistedSave(persisted, 5);
        return {
          ...current,
          player: {
            ...current.player,
            ...save.player,
            position: { x: 0, y: 0 },
            currentMapId: 'ship',
          },
          library: [],
          savedFragmentIds: save.collectedFragmentIds,
          exploration: save.exploration,
          hasSeenWelcome: save.hasSeenWelcome,
          previousThemeId: save.previousThemeId,
          settings: save.settings,
          session: createInitialSession(),
        };
      },
    }
  )
);
