/**
 * Runtime and v7 local-save state types.
 */

import type { BookFragment } from './books';
import type { Position } from './game';
import type { MotionPreference, SaveV7, SavedThemeId } from '@/store/saveMigration';
import type { VaultReward } from '@/game/expeditions';

export interface DialogueChoice {
  label: string;
  key: string; // keyboard key to press (e.g. 'y', 'n')
  action: string; // action identifier emitted via EventBridge
}

export interface DialogueLine {
  speaker?: string;
  text: string;
  voiceLineId?: string;
  choices?: DialogueChoice[];
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
}

/** Semantic zone bounds adapted for the HTML map display. */
export interface MapRoom {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
}

export interface SessionVaultInfo {
  vaultId: string;
  contentId: string;
  clueId: string;
  clueContentId: string;
  roomName: string;
  label: string;
  code: string;
  reward: VaultReward;
}

/** Serialized v7 save. Runtime book objects are resolved from these IDs after content loads. */
export type PersistedState = SaveV7;

export interface PlayerState {
  id: string;
  name: string;
  position: Position;
  currentMapId: string;
}

export interface ExplorationState {
  visitedMaps: string[];
  discoveredNPCs: string[];
  readJournals: string[];
  /** Artifact IDs collected from vaults */
  collectedArtifacts: string[];
}

/** Session state (not persisted – local UI/session only) */
export interface SessionState {
  /** Whether YAML content (books, NPCs, etc.) has finished loading */
  contentReady: boolean;
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
  /** Semantic zone under the player; null while traversing a connecting path. */
  currentZoneId: string | null;
  /** Room names the player has visited this expedition */
  visitedRooms: string[];
  /** Vault info for the current map (room name, code, artifact inside) */
  vaultInfo: SessionVaultInfo | null;
  /** Whether the vault has been opened this expedition */
  vaultOpened: boolean;
  /** Theme used by the active, non-resumable expedition. */
  activeThemeId: SavedThemeId | null;
  /** Unique vault/clue namespace for the active expedition only. */
  activeExpeditionId: string | null;
  discoveredClueIds: string[];
  /** Every page load starts behind this user-gesture gate. */
  launchGateOpen: boolean;
  audioUnlocked: boolean;
  contentError: string | null;
  /** Utility overlays preserve the underlying ship/exploration phase. */
  activeUtility: UtilityOverlay | null;
}

export type GamePhase = 'exploring' | 'ship' | 'mission-select' | 'departing' | 'dialogue' | 'reading' | 'viewing-map';
export type UtilityOverlay = 'how-to' | 'settings';

/** Settings state (persisted) */
export interface SettingsState {
  /** Recorded narration and browser speech synthesis. */
  narrationEnabled: boolean;
  sfxEnabled: boolean;
  ambienceEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
  motionPreference: MotionPreference;
}

export interface GameState {
  player: PlayerState;
  library: BookFragment[];
  /** Canonical IDs used to reconstruct `library` after YAML content loads. */
  savedFragmentIds: string[];
  exploration: ExplorationState;
  hasSeenHowToPlay: boolean;
  hasSeenSurfaceHints: boolean;
  previousThemeId: SavedThemeId | null;
  settings: SettingsState;
  session: SessionState;
  actions: GameActions;
}

export interface GameActions {
  movePlayer: (position: Position) => void;
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
  beamToSurface: (mapId: string, themeId?: SavedThemeId) => void;
  /** Retire the one-time surface controls hint bar. */
  markSurfaceHintsSeen: () => void;
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
  /** Mark YAML content as loaded (called by BootScene) */
  setContentReady: () => void;
  /** Reset all game state for "New Game" */
  resetGame: () => void;
  /** Store the map layout data when scene is created (before map is found) */
  setMapLayoutData: (rooms: MapRoom[], walls: number[][], spawn: { x: number; y: number }) => void;
  setCurrentZone: (zoneId: string | null) => void;
  /** Mark the area map as collected (enables viewing) */
  collectMap: () => void;
  /** Clear the area map (on beaming to new surface) */
  clearAreaMap: () => void;
  /** Open the map overlay */
  openMap: () => void;
  /** Close the map overlay */
  closeMap: () => void;
  setNarrationEnabled: (enabled: boolean) => void;
  /** Backwards-compatible action name for existing UI callers. */
  setTTSEnabled: (enabled: boolean) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setAmbienceEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setMotionPreference: (preference: MotionPreference) => void;
  acceptLaunchGate: () => void;
  reopenLaunchGate: () => void;
  openHowToPlay: () => void;
  openSettings: () => void;
  closeUtility: () => void;
  setContentError: (message: string | null) => void;
  openMissionPicker: () => void;
  closeMissionPicker: () => void;
  selectExpeditionTheme: (themeId: SavedThemeId) => void;
  discoverVaultClue: (clueId: string) => void;
  hasDiscoveredVaultClue: (clueId: string) => boolean;
  /** Mark a room as visited */
  visitRoom: (roomName: string) => void;
  /** Set vault info for current map */
  setVaultInfo: (info: SessionVaultInfo | null) => void;
  /** Mark vault as opened */
  openVault: () => void;
  /** Collect an artifact from a vault */
  collectArtifact: (artifactId: string) => void;
}
