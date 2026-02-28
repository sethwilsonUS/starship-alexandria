/**
 * Zustand game store — Convex-shaped schema
 *
 * PLANNED CONVEX SCHEMA (for reference when migrating):
 * ─────────────────────────────────────────────────────────────
 * tables: {
 *   players: defineTable({
 *     id: v.id("players"),
 *     name: v.string(),
 *     position: v.object({ x: v.number(), y: v.number() }),
 *     currentMapId: v.string(),
 *     flashlightBattery: v.number(),
 *   }),
 *   library: defineTable({
 *     id: v.id("library"),
 *     bookId: v.string(),
 *     label: v.string(),
 *     order: v.number(),
 *     text: v.string(),
 *     playerId: v.id("players"),
 *   }),
 *   exploration: defineTable({
 *     playerId: v.id("players"),
 *     visitedMaps: v.array(v.string()),
 *     discoveredNPCs: v.array(v.string()),
 *     readJournals: v.array(v.string()),
 *     totalFragmentsFound: v.number(),
 *   }),
 * }
 * Actions become Convex mutations; use useQuery for player, library, exploration.
 * Session state stays client-only.
 * ─────────────────────────────────────────────────────────────
 */

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
} from '@/types/store';
import type { BookFragment } from '@/types/books';
import type { Position } from '@/types/game';
import type { MapRoom } from '@/types/store';
import { setTTSEnabledGlobal } from '@/utils/speech';

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
  totalFragmentsFound: 0,
};

const initialSettings: SettingsState = {
  ttsEnabled: true, // On by default for accessibility
};

const createInitialSession = () => ({
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
        exploration: {
          ...s.exploration,
          totalFragmentsFound: s.exploration.totalFragmentsFound + 1,
        },
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
    set((s) => ({
      session: {
        ...s.session,
        currentDialogue: null,
        gamePhase:
          s.session.isReadingBook || s.session.currentBookFragment
            ? 'reading'
            : s.player.currentMapId === 'ship'
              ? 'ship'
              : 'exploring',
      },
    })),

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
        gamePhase: 'ship',
      },
    })),

  beamToSurface: (mapId: string) =>
    set((s) => ({
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
      },
    })),

  saveToLocalStorage: () => {
    // Persist middleware auto-saves on every setState. This action exists for:
    // 1) Explicit API / "save checkpoint" semantics (e.g. after beam-up)
    // 2) Future Convex: replace with sync mutation call
    // No-op for localStorage—persist handles it. Replace with Convex sync when ready.
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

  resetGame: () => {
    // Clear localStorage and reset all state
    localStorage.removeItem(STORAGE_KEY);
    set(() => ({
      player: createInitialPlayer(),
      library: [],
      exploration: initialExploration,
      hasSeenWelcome: false,
      settings: initialSettings,
      session: createInitialSession(),
    }));
  },

  loadFromLocalStorage: () => {
    // Persist middleware auto-hydrates on app init. This allows explicit reload
    // (e.g. "Continue" / "Load Game" button). Future Convex: trigger refetch.
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

  setTTSEnabled: (enabled: boolean) => {
    setTTSEnabledGlobal(enabled); // Sync with global state for speech module
    set((s) => ({
      settings: { ...s.settings, ttsEnabled: enabled },
    }));
  },
});

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      player: createInitialPlayer(),
      library: [],
      exploration: initialExploration,
      hasSeenWelcome: false,
      settings: initialSettings,
      session: createInitialSession(),
      actions: createActions(set as (fn: (s: GameStore) => Partial<GameStore>) => void, get),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        player: state.player,
        library: state.library,
        exploration: state.exploration,
        hasSeenWelcome: state.hasSeenWelcome,
        settings: state.settings,
      }),
      version: 4,
      onRehydrateStorage: () => (state) => {
        // Sync TTS global state when store rehydrates from localStorage
        if (state?.settings?.ttsEnabled !== undefined) {
          setTTSEnabledGlobal(state.settings.ttsEnabled);
        }
      },
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as PersistedState;
        // v3 → v4: add settings
        if (version < 4) {
          if (s && !s.settings) {
            s.settings = initialSettings;
          }
        }
        // v2 → v3: add hasSeenWelcome
        if (version < 3) {
          if (s && typeof s.hasSeenWelcome !== 'boolean') {
            // Existing saves have seen welcome (they've played before)
            s.hasSeenWelcome = true;
          }
        }
        // v1 → v2: add spareBatteries
        if (s?.player && typeof s.player.spareBatteries !== 'number') {
          s.player = { ...s.player, spareBatteries: 0 };
        }
        return s;
      },
    }
  )
);
