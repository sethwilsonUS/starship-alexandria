/**
 * Store state types.
 * Shape mirrors planned Convex schema for minimal refactor on migration.
 */

import type { BookFragment } from './books';
import type { Position } from './game';

export interface DialogueChoice {
  label: string;
  key: string; // keyboard key to press (e.g. 'y', 'n')
  action: string; // action identifier emitted via EventBridge
}

export interface DialogueLine {
  speaker?: string;
  text: string;
  choices?: DialogueChoice[];
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
}

/** Room data for map display (matches GeneratedRoom from MapGenerator) */
export interface MapRoom {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
}

/** Persistent state (saved to localStorage now, Convex tables later) */
export interface PersistedState {
  player: PlayerState;
  library: BookFragment[];
  exploration: ExplorationState;
  /** Has the player seen the initial welcome to the ship? */
  hasSeenWelcome: boolean;
  /** User settings */
  settings: SettingsState;
}

export interface PlayerState {
  id: string;
  name: string;
  position: Position;
  currentMapId: string;
  flashlightBattery: number; // 0–100, dims but never kills
  spareBatteries: number; // collected pickups; press B to use
}

export interface ExplorationState {
  visitedMaps: string[];
  discoveredNPCs: string[];
  readJournals: string[];
  totalFragmentsFound: number;
}

/** Session state (not persisted – local UI/session only) */
export interface SessionState {
  currentDialogue: DialogueLine[] | null;
  currentJournal: JournalEntry | null;
  isReadingBook: boolean;
  currentBookFragment: BookFragment | null;
  gamePhase: GamePhase;
  /** Explored tile coords "x,y" — fog of war within session */
  exploredTiles: string[];
  /** Books on current map (reset each map) */
  booksOnThisMap: number;
  booksRemainingOnThisMap: number;
  /** Room names where books are placed this map (for NPC hints) */
  roomsWithBooksOnMap: string[];
  /** NPC id → room name mapping for current map (for dynamic dialogue) */
  npcRoomsOnMap: Record<string, string>;
  /** NPC positions on current map (for map display) */
  npcPositionsOnMap: Array<{ id: string; name: string; x: number; y: number; roomName: string }>;
  /** Total reachable tiles on current map (for discovery %). Discovery = FOV-touched tiles. */
  explorableTileCount: number;
  /** Library size when current expedition started (to calculate new fragments found) */
  fragmentsAtExpeditionStart: number;
  /** Whether the player has found the map for the current area */
  hasAreaMap: boolean;
  /** Room data for the current area (for map display) */
  mapRooms: MapRoom[];
  /** Wall data for the current area (for ASCII map display) - 2D array [y][x], non-zero = wall */
  mapWalls: number[][];
  /** Player spawn position for the current area */
  mapSpawn: { x: number; y: number };
}

export type GamePhase = 'exploring' | 'ship' | 'dialogue' | 'reading' | 'viewing-map';

/** Settings state (persisted) */
export interface SettingsState {
  /** Text-to-speech for accessibility announcements (default: true) */
  ttsEnabled: boolean;
}

export interface GameState {
  player: PlayerState;
  library: BookFragment[];
  exploration: ExplorationState;
  hasSeenWelcome: boolean;
  settings: SettingsState;
  session: SessionState;
  actions: GameActions;
}

export interface GameActions {
  movePlayer: (position: Position) => void;
  decrementFlashlight: () => void;
  restoreFlashlight: (amount: number) => void;
  setFlashlight: (amount: number) => void;
  addBattery: () => void;
  useBattery: () => boolean;
  collectFragment: (fragment: BookFragment) => void;
  markMapVisited: (mapId: string) => void;
  discoverNPC: (npcId: string) => void;
  readJournal: (journalId: string) => void;
  openDialogue: (lines: DialogueLine[]) => void;
  closeDialogue: () => void;
  closeBook: () => void;
  /** Open a collected fragment for reading (ship library) */
  openLibraryBook: (fragment: BookFragment) => void;
  beamToShip: () => void;
  beamToSurface: (mapId: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  addExploredTiles: (coords: string[]) => void;
  clearExploredTiles: () => void;
  setBooksOnThisMap: (total: number) => void;
  setBooksRemainingOnThisMap: (remaining: number) => void;
  setRoomsWithBooksOnMap: (roomNames: string[]) => void;
  setNpcRoomsOnMap: (npcRooms: Record<string, string>) => void;
  setNpcPositionsOnMap: (npcs: Array<{ id: string; name: string; x: number; y: number; roomName: string }>) => void;
  setExplorableTileCount: (count: number) => void;
  startExpedition: () => void;
  /** Mark welcome as seen (first ship arrival) */
  setHasSeenWelcome: () => void;
  /** Reset all game state for "New Game" */
  resetGame: () => void;
  /** Store the map layout data when scene is created (before map is found) */
  setMapLayoutData: (rooms: MapRoom[], walls: number[][], spawn: { x: number; y: number }) => void;
  /** Mark the area map as collected (enables viewing) */
  collectMap: () => void;
  /** Clear the area map (on beaming to new surface) */
  clearAreaMap: () => void;
  /** Open the map overlay */
  openMap: () => void;
  /** Close the map overlay */
  closeMap: () => void;
  /** Toggle TTS on/off */
  setTTSEnabled: (enabled: boolean) => void;
}
