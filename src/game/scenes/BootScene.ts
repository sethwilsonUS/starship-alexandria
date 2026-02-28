import { Scene } from 'phaser';
import { TILE_SIZE } from '@/config/gameConfig';
import { useGameStore } from '@/store/gameStore';
import { preloadAllContent, loadRoomNames, loadBooks, loadJournals, getAllNPCs, getAllFragments } from '@/utils/contentLoader';
import { setRoomNamesCache } from '../systems/MapGenerator';
import { setCachedNPCCatalog, type NPC } from '@/data/npcs';
import { setCachedBookCatalog, type Book } from '@/data/books';
import { setJournalCache } from '@/utils/contentLoaderSync';
import type { JournalEntryDef } from '@/data/journalEntries';

/**
 * BootScene: Preload minimal assets and create procedural tileset.
 * Tileset spritesheet is generated at runtime for Phase 1.3.
 * TODO: Replace with asset-based loading (itch.io/Kenney tileset) when available.
 */
export default class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Generate procedural tileset (post-apocalyptic palette)
    // 4 columns x 3 rows = 12 tiles @ 32x32 each
    const cols = 4;
    const rows = 3;
    const width = cols * TILE_SIZE;
    const height = rows * TILE_SIZE;

    const graphics = this.add.graphics();
    // Brightness rules: floors (0-3) stay above min luminance; walls (4-5) stay below max.
    const palette = [
      0x8b7355, // 0 floor (stone/tan)
      0x4a7c4e, // 1 grass (overgrown green)
      0x7a5530, // 2 dirt
      0xa89888, // 3 stone floor (lighter interior)
      0x353535, // 4 wall (dark — bounded/solid)
      0x454545, // 5 rubble base (distinct, textured)
      0x2d4a2d, // 6 vine (dark green overgrowth)
      0x4a4a4a, // 7 debris
      0x3a5a6b, // 8 flooded base (blue-gray, textured)
    ];

    for (let i = 0; i < palette.length; i++) {
      const tx = (i % cols) * TILE_SIZE;
      const ty = Math.floor(i / cols) * TILE_SIZE;
      graphics.fillStyle(palette[i], 1);
      graphics.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);

      // Rubble (5): irregular chunks for texture — distinct from plain floors
      if (i === 5) {
        graphics.fillStyle(0x3a3a3a, 0.8);
        graphics.fillRect(tx + 2, ty + 4, 10, 8);
        graphics.fillStyle(0x505050, 0.7);
        graphics.fillRect(tx + 14, ty + 12, 12, 10);
        graphics.fillStyle(0x2a2a2a, 0.9);
        graphics.fillRect(tx + 6, ty + 20, 14, 6);
      }

      // Flooded (8): wavy water-like texture — clearly distinguishable
      if (i === 8) {
        graphics.fillStyle(0x4a6a7b, 0.6);
        graphics.fillRect(tx + 0, ty + 8, TILE_SIZE, 6);
        graphics.fillRect(tx + 0, ty + 20, TILE_SIZE, 6);
        graphics.fillStyle(0x2a4a5b, 0.5);
        graphics.fillRect(tx + 0, ty + 14, TILE_SIZE, 4);
      }
    }

    graphics.generateTexture('tileset', width, height);
    graphics.destroy();

    // Placeholder: book fragment — book-like shape, high contrast (accessibility)
    // Vertical rect = closed book spine; cream pages + dark outline. Replace with itch.io asset (e.g. Book & Scroll Set) when ready.
    const book = this.add.graphics();
    book.fillStyle(0xe8dcc4, 1); // Warm cream (old paper)
    book.fillRect(10, 6, 12, 20); // Vertical book shape
    book.lineStyle(4, 0x2a2520, 1); // Thick dark outline (matches player)
    book.strokeRect(10, 6, 12, 20);
    book.fillStyle(0xc4a574, 0.6); // Spine line
    book.fillRect(14, 6, 4, 20);
    book.generateTexture('book-pickup', 32, 32);
    book.destroy();

    // Placeholder: transporter pad — platform with inner glow (sci-fi teleporter)
    const pad = this.add.graphics();
    pad.fillStyle(0x2a3a5a, 1); // Dark blue base
    pad.fillRect(4, 4, 24, 24);
    pad.lineStyle(3, 0x2a2520, 1); // Dark outline for contrast
    pad.strokeRect(4, 4, 24, 24);
    pad.fillStyle(0x4488ff, 0.5); // Blue glow
    pad.fillRect(8, 8, 16, 16);
    pad.lineStyle(2, 0x5cb3ff, 0.9);
    pad.strokeRect(8, 8, 16, 16);
    pad.generateTexture('transporter-pad', 32, 32);
    pad.destroy();

    // Placeholder: player — high-contrast for visibility (legally blind accessible)
    // Bright cyan + dark outline stands out on brown/green map; replace with spritesheet later
    const player = this.add.graphics();
    player.fillStyle(0x0ec3c9, 1); // Bright cyan
    player.fillCircle(16, 16, 12);
    player.lineStyle(4, 0x1a1a2e, 1); // Thick dark outline (matches scene bg)
    player.strokeCircle(16, 16, 12);
    player.generateTexture('player', 32, 32);
    player.destroy();

    // Placeholder: NPC — simple figure (head + body), distinct from player
    const npc = this.add.graphics();
    npc.fillStyle(0xe8d4b8, 1); // Skin tone
    npc.fillCircle(16, 10, 5); // Head
    npc.fillStyle(0x6b7b8b, 1); // Muted gray-blue clothing
    npc.fillRect(10, 16, 12, 14); // Body/torso
    npc.lineStyle(3, 0x2a2520, 1);
    npc.strokeCircle(16, 10, 5);
    npc.strokeRect(10, 16, 12, 14);
    npc.generateTexture('npc', 32, 32);
    npc.destroy();

    // Placeholder: journal/scroll — rolled scroll with aged paper
    const journal = this.add.graphics();
    journal.fillStyle(0xe8e0d0, 0.95);
    journal.fillRect(8, 6, 16, 20);
    journal.fillStyle(0xc4b896, 0.8);
    journal.fillRect(10, 8, 12, 16);
    journal.lineStyle(3, 0x2a2520, 1);
    journal.strokeRect(8, 6, 16, 20);
    journal.fillStyle(0x8b7355, 0.5);
    journal.fillRect(12, 4, 8, 4); // Rolled top
    journal.generateTexture('journal-pickup', 32, 32);
    journal.destroy();

    // Placeholder: battery pickup — bright yellow/green with lightning bolt
    const battery = this.add.graphics();
    // Bright yellow-green body (high visibility)
    battery.fillStyle(0x7cfc00, 1); // Lawn green - very bright
    battery.fillRoundedRect(6, 4, 20, 24, 4);
    // Dark outline for contrast
    battery.lineStyle(3, 0x1a1a1a, 1);
    battery.strokeRoundedRect(6, 4, 20, 24, 4);
    // Positive terminal on top (distinct from journal)
    battery.fillStyle(0xffff00, 1); // Bright yellow
    battery.fillRect(12, 1, 8, 5);
    battery.lineStyle(2, 0x1a1a1a, 1);
    battery.strokeRect(12, 1, 8, 5);
    // Lightning bolt symbol in center (makes purpose obvious)
    battery.fillStyle(0x1a1a1a, 1);
    battery.fillTriangle(18, 10, 14, 18, 17, 18); // Top part
    battery.fillTriangle(14, 14, 18, 22, 15, 14); // Bottom part
    battery.generateTexture('battery-pickup', 32, 32);
    battery.destroy();

    // Placeholder: map pickup — rolled parchment with compass rose hint
    const mapPickup = this.add.graphics();
    // Parchment body (rolled scroll look)
    mapPickup.fillStyle(0xf4e4bc, 1); // Light parchment tan
    mapPickup.fillRect(6, 8, 20, 16);
    // Darker edges for rolled effect
    mapPickup.fillStyle(0xd4c49c, 1);
    mapPickup.fillRect(6, 8, 4, 16); // Left roll
    mapPickup.fillRect(22, 8, 4, 16); // Right roll
    // Grid lines suggesting map
    mapPickup.lineStyle(1, 0x8b7355, 0.5);
    mapPickup.lineBetween(10, 12, 22, 12);
    mapPickup.lineBetween(10, 16, 22, 16);
    mapPickup.lineBetween(10, 20, 22, 20);
    mapPickup.lineBetween(14, 8, 14, 24);
    mapPickup.lineBetween(18, 8, 18, 24);
    // X mark (treasure map feel)
    mapPickup.lineStyle(2, 0x8b4513, 1);
    mapPickup.lineBetween(14, 13, 18, 17);
    mapPickup.lineBetween(18, 13, 14, 17);
    // Dark outline for contrast
    mapPickup.lineStyle(3, 0x2a2520, 1);
    mapPickup.strokeRect(6, 8, 20, 16);
    mapPickup.generateTexture('map-pickup', 32, 32);
    mapPickup.destroy();
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
    } catch (error) {
      console.error('Failed to load content:', error);
      // Game can still run with defaults if content loading fails
    }
  }
}
