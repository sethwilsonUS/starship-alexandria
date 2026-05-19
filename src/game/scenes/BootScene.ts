import { Scene } from 'phaser';
import { useGameStore } from '@/store/gameStore';
import { preloadAllContent, loadRoomNames, loadBooks, loadJournals, loadArtifacts, loadGameloop, getAllNPCs, getAllFragments } from '@/utils/contentLoader';
import { preloadGameAssets } from '@/game/assets/assetManifest';
import { ensureProceduralFallbackTextures } from '@/game/assets/proceduralFallbacks';
import { setRoomNamesCache } from '../systems/MapGenerator';
import { setCachedNPCCatalog, type NPC } from '@/data/npcs';
import { setCachedBookCatalog, type Book } from '@/data/books';
import { setJournalCache, setArtifactCache, setGameloopCache } from '@/utils/contentLoaderSync';
import type { JournalEntryDef } from '@/data/journalEntries';
import type { Artifact } from '@/data/artifacts';

/**
 * BootScene: Preload game assets and content before starting the playable scenes.
 * Procedural textures are generated only when manifest assets are unavailable.
 */
export default class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    preloadGameAssets(this);
    this.load.once('complete', () => ensureProceduralFallbackTextures(this));
    this.load.on('loaderror', (file: { key: string; src?: string }) => {
      console.warn(`Asset failed to load: ${file.key}`, file.src);
    });
  }

  async create() {
    // Load all content from YAML files before starting game
    await this.loadContent();
    
    // Ensure scene is still active after async operation
    if (!this.scene || !this.scene.manager) {
      console.warn('BootScene: Scene manager no longer available after content load');
      return;
    }
    
    // Check saved state to determine starting scene
    const state = useGameStore.getState();
    const currentMapId = state.player.currentMapId;
    
    // Start on ship for new games, or restore to last location
    if (currentMapId === 'ship' || currentMapId === 'default') {
      // Set game phase to ship for new games
      if (currentMapId === 'default') {
        useGameStore.getState().actions.beamToShip();
      }
      this.scene.start('ShipScene');
    } else {
      // Player was mid-exploration — this shouldn't normally happen
      // since we save on beam-up, but handle it gracefully
      this.scene.start('ShipScene');
    }
  }

  private async loadContent(): Promise<void> {
    try {
      // Preload all YAML content
      await preloadAllContent();
      
      // Cache room names for MapGenerator
      const roomNames = await loadRoomNames();
      setRoomNamesCache(roomNames);
      
      // Cache NPCs for sync access
      const npcs = await getAllNPCs();
      const npcsCasted: NPC[] = npcs.map((n) => ({
        id: n.id,
        name: n.name,
        firstMeet: n.firstMeet.map((line) => ({ speaker: line.speaker, text: line.text })),
        return: n.return.map((line) => ({ speaker: line.speaker, text: line.text })),
      }));
      setCachedNPCCatalog(npcsCasted);
      
      // Cache books for sync access
      const books = await loadBooks();
      const allFragments = await getAllFragments();
      const booksCasted: Book[] = books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        totalFragments: b.totalFragments,
        fragments: allFragments
          .filter((f) => f.bookId === b.id)
          .map((f) => ({
            id: f.id,
            bookId: f.bookId,
            label: f.label,
            order: f.order,
            text: f.text,
          })),
      }));
      setCachedBookCatalog(booksCasted);
      
      // Cache journals for sync access
      const journals = await loadJournals();
      const journalsCasted: JournalEntryDef[] = journals.map((j) => ({
        id: j.id,
        title: j.title,
        lines: j.lines.map((line) => ({ speaker: line.speaker, text: line.text })),
      }));
      setJournalCache(journalsCasted);
      
      // Cache artifacts for sync access
      const artifacts = await loadArtifacts();
      const artifactsCasted: Artifact[] = artifacts.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
      }));
      setArtifactCache(artifactsCasted);
      
      // Cache gameloop dialogue for sync access
      const gameloop = await loadGameloop();
      setGameloopCache(gameloop);

      // Signal to React components that content is ready
      useGameStore.getState().actions.setContentReady();
    } catch (error) {
      console.error('Failed to load content:', error);
      // Game can still run with defaults if content loading fails
      // Still mark content as ready so UI doesn't wait forever
      useGameStore.getState().actions.setContentReady();
    }
  }
}
