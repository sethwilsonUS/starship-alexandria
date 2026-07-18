import { Scene } from 'phaser';
import { useGameStore } from '@/store/gameStore';
import { preloadAllContent, loadArtifacts, loadGameloop } from '@/utils/contentLoader';
import { preloadGameAssets } from '@/game/assets/assetManifest';
import { ensureProceduralFallbackTextures } from '@/game/assets/proceduralFallbacks';
import { loadNPCCatalog, setCachedNPCCatalog } from '@/data/npcs';
import { loadBookCatalog, setCachedBookCatalog } from '@/data/books';
import { loadJournalCatalog } from '@/data/journalEntries';
import { setJournalCache, setArtifactCache, setGameloopCache } from '@/utils/contentLoaderSync';
import type { Artifact } from '@/data/artifacts';

/**
 * BootScene: Preload game assets and content before starting the playable scenes.
 * Procedural textures are generated only when manifest assets are unavailable.
 */
export default class BootScene extends Scene {
  private assetFailures: string[] = [];

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.assetFailures = [];
    preloadGameAssets(this);
    this.load.once('complete', () => ensureProceduralFallbackTextures(this));
    this.load.on('loaderror', (file: { key: string; src?: string }) => {
      this.assetFailures.push(file.key);
      console.warn(`Asset failed to load: ${file.key}`, file.src);
    });
  }

  async create() {
    if (this.assetFailures.length > 0) {
      const failedKeys = [...new Set(this.assetFailures)].join(', ');
      useGameStore.getState().actions.setContentError(`Required game assets did not load: ${failedKeys}`);
      return;
    }
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
      
      // Cache NPCs for sync access
      setCachedNPCCatalog(await loadNPCCatalog());
      
      // Cache books for sync access
      setCachedBookCatalog(await loadBookCatalog());
      
      // Cache journals for sync access
      setJournalCache(await loadJournalCatalog());
      
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
      const message = error instanceof Error ? error.message : 'Unknown content error';
      useGameStore.getState().actions.setContentError(message);
    }
  }
}
