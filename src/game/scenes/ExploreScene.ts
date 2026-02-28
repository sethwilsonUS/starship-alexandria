import { Scene } from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '@/config/gameConfig';
import { TILE } from '@/data/tilesets';
import {
  generateMap,
  getRoomAt,
  getOpenTilesInRoom,
  type GeneratedMap,
  type GeneratedRoom,
} from '../systems/MapGenerator';
import { getBookCatalogSync } from '@/data/books';
import { getNPCCatalogSync } from '@/data/npcs';
import { getRandomFragmentsForMapSync, getRandomJournalEntriesSync } from '@/utils/contentLoaderSync';
import { computeVisibleTiles } from '../systems/FOVSystem';
import { getFovRadiusFromBattery } from '@/utils/flashlight';
import { useGameStore } from '@/store/gameStore';
import { EventBridge } from '../EventBridge';
import { Player } from '../entities/Player';
import { GridMovement } from '../systems/GridMovement';
import { InteractionSystem } from '../systems/Interaction';
import { playBumpSound, speak, playDiscoveryChime } from '@/utils/speech';

/**
 * ExploreScene: Main exploration gameplay.
 * Procedurally generated tilemap via MapGenerator (Phase 2.1).
 */
export default class ExploreScene extends Scene {
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private decorationLayer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Player;
  private gridMovement!: GridMovement;
  private interactionSystem!: InteractionSystem;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private mapData!: GeneratedMap;
  private lastRoomName: string | null = null;
  private revealedRoomNames = new Set<string>();
  private wallOutline!: Phaser.GameObjects.Graphics;
  private fogOverlay!: Phaser.GameObjects.Graphics;
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private bookContainers = new Map<string, Phaser.GameObjects.Container>();
  private journalContainers = new Map<string, Phaser.GameObjects.Container>();
  private batteryContainers = new Map<string, Phaser.GameObjects.Container>();
  private mapContainer: Phaser.GameObjects.Container | null = null;
  private npcBlockedTiles = new Set<string>();
  private moveCount = 0;
  private bookToRoomMap = new Map<string, string>(); // fragmentId → roomName
  private roomContents = new Map<string, { books: number; journals: number; npcs: string[]; batteries: number; maps: number }>(); // roomName → contents
  private announcedRooms = new Set<string>(); // Rooms we've already announced contents for

  constructor() {
    super({ key: 'ExploreScene' });
  }

  create() {
    // Fade in from beam-down
    this.cameras.main.fadeIn(600, 92, 180, 255);
    
    this.mapData = generateMap();
    const { ground, walls, decoration, rooms, spawnX, spawnY } = this.mapData;

    // Create tilemap from raw data
    this.tilemap = this.make.tilemap({
      data: ground,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = this.tilemap.addTilesetImage(
      'tileset',
      'tileset',
      TILE_SIZE,
      TILE_SIZE,
      0,
      0
    )!;

    // Create layers (bottom to top: ground → walls → decoration)
    this.groundLayer = this.tilemap.createLayer(0, tileset, 0, 0)!;
    this.groundLayer.setDepth(0);

    // Wall layer from separate data
    const wallMapData = this.make.tilemap({
      data: walls,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const wallTileset = wallMapData.addTilesetImage(
      'tileset',
      'tileset',
      TILE_SIZE,
      TILE_SIZE
    )!;
    this.wallLayer = wallMapData.createLayer(0, wallTileset, 0, 0)!;
    this.wallLayer.setDepth(1);
    this.wallLayer.setCollision([4, 5]); // Wall and rubble block

    // Decoration layer (non-blocking)
    const decoMapData = this.make.tilemap({
      data: decoration,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const decoTileset = decoMapData.addTilesetImage(
      'tileset',
      'tileset',
      TILE_SIZE,
      TILE_SIZE
    )!;
    this.decorationLayer = decoMapData.createLayer(0, decoTileset, 0, 0)!;
    this.decorationLayer.setDepth(2);

    // Wall outline — thin border along wall edges for clarity
    this.wallOutline = this.add.graphics();
    this.wallOutline.setDepth(2.5);

    // Fog overlay — drawn on top of map, avoids Phaser layer APIs (see .cursor/rules)
    this.fogOverlay = this.add.graphics();
    this.fogOverlay.setDepth(4);

    // Player entity
    this.player = new Player(this, 'player', spawnX, spawnY);
    this.player.setDirection('down');

    this.gridMovement = new GridMovement();
    this.gridMovement.attach(this, this.player, {
      wallLayer: this.wallLayer,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      getBlockedTiles: () => this.npcBlockedTiles,
      getFloodedTiles: () => this.mapData.floodedTiles,
    });

    // Interaction system
    this.interactionSystem = new InteractionSystem();
    this.interactionSystem.attach(this, this.player);

    this.placeInteractives(rooms, spawnX, spawnY);

    // Interaction prompt rendered via React (InteractionPrompt.tsx) to avoid Phaser Text/WebGL bugs

    // Mark expedition start (tracks library size for "new fragments this trip" calculation)
    useGameStore.getState().actions.startExpedition();
    // Store map layout data for the map overlay (when player finds the map pickup)
    useGameStore.getState().actions.setMapLayoutData(rooms, walls, { x: spawnX, y: spawnY });
    // Reset battery at start of expedition
    useGameStore.getState().actions.setFlashlight(100);
    this.moveCount = 0;

    // Sync store on movement
    const onPlayerMoved = ({ x, y }: { x: number; y: number }) => {
      useGameStore.getState().actions.movePlayer({ x, y });
      this.moveCount++;
      if (this.moveCount % 5 === 0) {
        useGameStore.getState().actions.decrementFlashlight();
      }
      this.checkRoomEntry(x, y);
      this.updateFOV(x, y);
    };
    EventBridge.on('player-moved', onPlayerMoved);
    this.events.once('shutdown', () => EventBridge.off('player-moved', onPlayerMoved));

    // Beam-up animation and scene transition
    const onBeamUpConfirmed = () => {
      this.playBeamUpAnimation();
    };
    EventBridge.on('beam-up-confirmed', onBeamUpConfirmed);
    this.events.once('shutdown', () => EventBridge.off('beam-up-confirmed', onBeamUpConfirmed));

    // Camera shake + golden flash when picking up a book fragment
    const onBookFound = () => {
      this.playBookPickupEffect();
    };
    EventBridge.on('book-found', onBookFound);
    this.events.once('shutdown', () => EventBridge.off('book-found', onBookFound));

    // Bump sound when hitting obstacles
    const onMovementBlocked = ({ reason }: { reason: string }) => {
      playBumpSound();
      // Speak what blocked us (but don't spam - use short phrases)
      const messages: Record<string, string> = {
        wall: 'Wall',
        rubble: 'Rubble',
        npc: 'Someone here',
        edge: 'Edge',
      };
      const msg = messages[reason] || 'Blocked';
      speak(msg);
    };
    EventBridge.on('movement-blocked', onMovementBlocked);
    this.events.once('shutdown', () => EventBridge.off('movement-blocked', onMovementBlocked));

    const onInteractiveConsumed = ({ type, id }: { type: string; id?: string }) => {
      const destroy = () => {
        if (type === 'book' && id) {
          const container = this.bookContainers.get(id);
          if (container) {
            container.destroy();
            this.bookContainers.delete(id);
          }
          this.interactionSystem.unregister(id);
          useGameStore.getState().actions.setBooksRemainingOnThisMap(this.bookContainers.size);
          
          // Update roomsWithBooksOnMap to remove the room this book was in
          const roomName = this.bookToRoomMap.get(id);
          if (roomName) {
            this.bookToRoomMap.delete(id);
            // Rebuild the list of rooms that still have books
            const remainingRooms = new Set(this.bookToRoomMap.values());
            useGameStore.getState().actions.setRoomsWithBooksOnMap(Array.from(remainingRooms));
          }
        } else if (type === 'journal' && id) {
          const container = this.journalContainers.get(id);
          if (container) {
            container.destroy();
            this.journalContainers.delete(id);
          }
          this.interactionSystem.unregister(id);
        } else if (type === 'battery' && id) {
          const container = this.batteryContainers.get(id);
          if (container) {
            container.destroy();
            this.batteryContainers.delete(id);
          }
          this.interactionSystem.unregister(id);
        } else if (type === 'map' && id) {
          if (this.mapContainer) {
            this.mapContainer.destroy();
            this.mapContainer = null;
          }
          this.interactionSystem.unregister(id);
        }
      };
      this.time.delayedCall(50, destroy);
    };
    EventBridge.on('interactive-consumed', onInteractiveConsumed);
    this.events.once('shutdown', () => EventBridge.off('interactive-consumed', onInteractiveConsumed));

    // Map scene: M key opens the MapScene (sleep this scene)
    const onOpenMapScene = () => {
      useGameStore.getState().actions.openMap();
      this.scene.sleep('ExploreScene');
      this.scene.run('MapScene');
    };
    EventBridge.on('open-map-scene', onOpenMapScene);
    this.events.once('shutdown', () => EventBridge.off('open-map-scene', onOpenMapScene));

    useGameStore.getState().actions.movePlayer({ x: spawnX, y: spawnY });
    this.checkRoomEntry(spawnX, spawnY, true); // isInitialSpawn = true
    useGameStore.getState().actions.clearExploredTiles();
    useGameStore.getState().actions.setExplorableTileCount(this.mapData.reachableTiles.size);
    this.updateFOV(spawnX, spawnY);

    // World bounds
    this.physics.world.setBounds(
      0,
      0,
      MAP_WIDTH * TILE_SIZE,
      MAP_HEIGHT * TILE_SIZE
    );

    // Camera
    this.camera = this.cameras.main;
    this.camera.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.camera.setZoom(1);
    this.camera.startFollow(this.player.getSprite(), true, 0.08, 0.08);

    // Vignette overlay - atmospheric darkening at edges
    this.createVignetteOverlay();
    
    // Show location title card
    this.showLocationCard();
  }

  private showLocationCard(): void {
    const { width, height } = this.cameras.main;
    
    // Create container for title card (fixed to camera)
    const container = this.add.container(width / 2, height / 2);
    container.setDepth(500);
    container.setScrollFactor(0);
    container.setAlpha(0);
    
    // Background bar
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-200, -40, 400, 80, 8);
    container.add(bg);
    
    // Location text (use Phaser text - this is temporary UI, not permanent game element)
    const locationNames = [
      'Ruined Library Wing',
      'Collapsed Archive',
      'Overgrown Reading Hall',
      'Flooded Record Room',
      'Crumbling Study',
    ];
    const locationName = locationNames[Math.floor(Math.random() * locationNames.length)];
    
    // We'll emit this for the HUD to pick up
    EventBridge.emit('area-entered', { areaName: locationName });
    
    // Create simple text display using graphics (avoiding Phaser Text issues)
    const subtitleBg = this.add.graphics();
    subtitleBg.fillStyle(0xd4af37, 0.8);
    subtitleBg.fillRoundedRect(-60, -30, 120, 20, 4);
    container.add(subtitleBg);
    
    // Decorative lines
    const decorLine = this.add.graphics();
    decorLine.lineStyle(2, 0xd4af37, 0.6);
    decorLine.lineBetween(-150, 25, 150, 25);
    decorLine.lineBetween(-100, 32, 100, 32);
    container.add(decorLine);
    
    // Animate in
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: height / 2 - 20,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold, then fade out
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: height / 2 - 40,
            duration: 400,
            ease: 'Quad.easeIn',
            onComplete: () => container.destroy(),
          });
        });
      },
    });
  }

  private createVignetteOverlay(): void {
    // Simple subtle vignette - just darken the edges slightly
    // Using a minimal approach to avoid performance/rendering issues
    const { width, height } = this.cameras.main;
    this.vignetteOverlay = this.add.graphics();
    this.vignetteOverlay.setDepth(1000);
    this.vignetteOverlay.setScrollFactor(0);
    
    // Simple gradient bars at edges
    const edgeWidth = 80;
    
    // Left edge gradient
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.25 * (1 - i / edgeWidth);
      this.vignetteOverlay.fillStyle(0x000000, alpha);
      this.vignetteOverlay.fillRect(i, 0, 1, height);
    }
    
    // Right edge gradient
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.25 * (1 - i / edgeWidth);
      this.vignetteOverlay.fillStyle(0x000000, alpha);
      this.vignetteOverlay.fillRect(width - i - 1, 0, 1, height);
    }
    
    // Top edge gradient
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.2 * (1 - i / edgeWidth);
      this.vignetteOverlay.fillStyle(0x000000, alpha);
      this.vignetteOverlay.fillRect(0, i, width, 1);
    }
    
    // Bottom edge gradient  
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.2 * (1 - i / edgeWidth);
      this.vignetteOverlay.fillStyle(0x000000, alpha);
      this.vignetteOverlay.fillRect(0, height - i - 1, width, 1);
    }
  }

  private placeInteractives(
    rooms: GeneratedRoom[],
    spawnX: number,
    spawnY: number
  ): void {
    const { walls } = this.mapData;

    // Transporter at spawn — container with shadow, rings, pulse (blue glow)
    const tx = spawnX * TILE_SIZE + TILE_SIZE / 2;
    const ty = spawnY * TILE_SIZE + TILE_SIZE / 2;
    const transporterContainer = this.add.container(tx, ty);
    transporterContainer.setDepth(5);
    const tShadow = this.add.graphics();
    tShadow.fillStyle(0x1a1a2e, 0.6);
    tShadow.fillCircle(0, 2, 14);
    transporterContainer.add(tShadow);
    const tOutline = this.add.graphics();
    tOutline.lineStyle(5, 0x1a1a2e, 1);
    tOutline.strokeCircle(0, 0, 18);
    transporterContainer.add(tOutline);
    const tRing = this.add.graphics();
    tRing.lineStyle(3, 0x5cb3ff, 1); // Electric blue
    tRing.strokeCircle(0, 0, 18);
    transporterContainer.add(tRing);
    transporterContainer.add(this.add.sprite(0, 0, 'transporter-pad'));
    this.tweens.add({
      targets: transporterContainer,
      scale: 1.06,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.interactionSystem.register({
      id: 'transporter-1',
      type: 'transporter',
      gridX: spawnX,
      gridY: spawnY,
      label: 'Transporter pad',
    });

    // Books: 2-4 fragments per map, one per room, never in spawn room
    // Only use rooms/tiles reachable from spawn (rubble can block corridors)
    const reachable = this.mapData.reachableTiles;
    const roomData = getOpenTilesInRoom(rooms, walls, { x: spawnX, y: spawnY })
      .map(({ room, tiles }) => ({
        room,
        tiles: tiles.filter((t) => reachable.has(`${t.x},${t.y}`)),
      }))
      .filter(({ tiles }) => tiles.length > 0);
    const spawnRoom = getRoomAt(rooms, spawnX, spawnY);
    const bookRoomData = spawnRoom
      ? roomData.filter(({ room }) => room !== spawnRoom)
      : roomData;
    if (bookRoomData.length === 0) return;

    const count = Math.min(
      2 + Math.floor(Math.random() * 3),
      bookRoomData.length,
      4
    );
    const fragments = getRandomFragmentsForMapSync(count);

    const distFromSpawn = (r: GeneratedRoom) =>
      Math.abs(r.centerX - spawnX) + Math.abs(r.centerY - spawnY);
    const farRooms = bookRoomData.filter(({ room }) => distFromSpawn(room) >= 8);
    const nearRooms = bookRoomData.filter(({ room }) => distFromSpawn(room) < 8);
    const shuffledFar = [...farRooms].sort(() => Math.random() - 0.5);
    const shuffledNear = [...nearRooms].sort(() => Math.random() - 0.5);

    const roomsToUse: { room: GeneratedRoom; tiles: { x: number; y: number }[] }[] = [];
    if (shuffledFar.length > 0) roomsToUse.push(shuffledFar[0]);
    const rest = [...shuffledFar.slice(1), ...shuffledNear].sort(() => Math.random() - 0.5);
    for (const r of rest) {
      if (roomsToUse.length >= count) break;
      roomsToUse.push(r);
    }

    const roomNamesWithBooks = roomsToUse.map((r) => r.room.name);
    useGameStore.getState().actions.setRoomsWithBooksOnMap(roomNamesWithBooks);

    const usedTiles = new Set<string>();
    usedTiles.add(`${spawnX},${spawnY}`);
    const isAdjacentToUsed = (x: number, y: number) =>
      usedTiles.has(`${x - 1},${y}`) || usedTiles.has(`${x + 1},${y}`) ||
      usedTiles.has(`${x},${y - 1}`) || usedTiles.has(`${x},${y + 1}`);

    // Check if a tile is a corridor/chokepoint (blocking it would prevent passage)
    const isCorridorTile = (x: number, y: number): boolean => {
      const { reachableTiles } = this.mapData;
      const n = reachableTiles.has(`${x},${y - 1}`);
      const s = reachableTiles.has(`${x},${y + 1}`);
      const e = reachableTiles.has(`${x + 1},${y}`);
      const w = reachableTiles.has(`${x - 1},${y}`);
      const walkableNeighbors = [n, s, e, w].filter(Boolean).length;
      
      // Corridor: exactly 2 opposite neighbors (N-S or E-W)
      if (walkableNeighbors === 2) {
        if ((n && s) || (e && w)) return true;
      }
      // Also consider doorways: 2-3 neighbors in a line pattern
      // A tile with only 2 neighbors that aren't opposite is likely a corner, not a corridor
      return false;
    };

    for (let i = 0; i < count && i < roomsToUse.length && i < fragments.length; i++) {
      const { room, tiles } = roomsToUse[i];
      const frag = fragments[i];
      const available = tiles.filter(
        (t) => !usedTiles.has(`${t.x},${t.y}`) && !isAdjacentToUsed(t.x, t.y)
      );
      if (available.length === 0) continue;

      const tile = available[Math.floor(Math.random() * available.length)];
      usedTiles.add(`${tile.x},${tile.y}`);
      const bookCatalog = getBookCatalogSync();
      const book = bookCatalog.find((b) => b.id === frag.bookId);
      const label = `${book?.title ?? 'Fragment'}: ${frag.label}`;

      const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const container = this.add.container(px, py);
      container.setDepth(5);

      // Shadow: dark circle under book — improves visibility on light floors
      const shadow = this.add.graphics();
      shadow.fillStyle(0x1a1a2e, 0.6);
      shadow.fillCircle(0, 2, 14);
      container.add(shadow);

      // Dark outline ring — strong silhouette on any floor color
      const outlineRing = this.add.graphics();
      outlineRing.lineStyle(5, 0x1a1a2e, 1);
      outlineRing.strokeCircle(0, 0, 18);
      container.add(outlineRing);

      const ring = this.add.graphics();
      ring.lineStyle(3, 0xd4af37, 1); // Gold highlight — always bright
      ring.strokeCircle(0, 0, 18);
      container.add(ring);
      const sprite = this.add.sprite(0, 0, 'book-pickup');
      container.add(sprite);
      this.bookContainers.set(frag.id, container);

      // Subtle pulse so books are easy to spot
      this.tweens.add({
        targets: container,
        scale: 1.08,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.interactionSystem.register({
        id: frag.id,
        type: 'book',
        gridX: tile.x,
        gridY: tile.y,
        label,
      });
      // Track which room this book is in (for updating Martha's hints)
      this.bookToRoomMap.set(frag.id, room.name);
      // Track for room content announcements
      this.addRoomContent(room.name, 'book');
    }
    useGameStore.getState().actions.setBooksOnThisMap(count);

    // NPCs: 1–2 per map, in rooms other than spawn, never in same room as a book
    const roomsWithBooks = new Set(roomsToUse.map((r) => r.room));
    const npcRoomData = roomData.filter(({ room }) => {
      const dx = Math.abs(room.centerX - spawnX);
      const dy = Math.abs(room.centerY - spawnY);
      if (dx <= 1 && dy <= 1) return false; // exclude spawn room
      if (roomsWithBooks.has(room)) return false; // exclude rooms with books
      return true;
    });
    const npcCount = Math.min(1 + Math.floor(Math.random() * 2), npcRoomData.length);
    const npcCatalog = getNPCCatalogSync();
    const npcsToPlace = [...npcCatalog].sort(() => Math.random() - 0.5).slice(0, npcCount);
    const npcRooms: Record<string, string> = {};
    const npcPositions: Array<{ id: string; name: string; x: number; y: number; roomName: string }> = [];

    for (let i = 0; i < npcCount && i < npcRoomData.length; i++) {
      const { room, tiles } = npcRoomData[i];
      const npc = npcsToPlace[i];
      const available = tiles.filter(
        (t) => !usedTiles.has(`${t.x},${t.y}`) && 
               !isAdjacentToUsed(t.x, t.y) &&
               !isCorridorTile(t.x, t.y) // Don't block corridors/doorways
      );
      if (available.length === 0 || !npc) continue;

      // Sort by distance to room center (prefer interior tiles, avoid doorways)
      const sortedByCenter = [...available].sort((a, b) => {
        const distA = Math.abs(a.x - room.centerX) + Math.abs(a.y - room.centerY);
        const distB = Math.abs(b.x - room.centerX) + Math.abs(b.y - room.centerY);
        return distA - distB;
      });
      
      // Pick from the closest 30% to center (or at least top 2)
      const centerCount = Math.max(2, Math.floor(sortedByCenter.length * 0.3));
      const centerTiles = sortedByCenter.slice(0, centerCount);
      const tile = centerTiles[Math.floor(Math.random() * centerTiles.length)];
      usedTiles.add(`${tile.x},${tile.y}`);
      this.npcBlockedTiles.add(`${tile.x},${tile.y}`);

      const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const npcContainer = this.add.container(px, py);
      npcContainer.setDepth(5);
      const nTorchGlow = this.add.graphics();
      nTorchGlow.fillStyle(0xff9944, 0.25);
      nTorchGlow.fillCircle(0, 0, 28);
      nTorchGlow.fillStyle(0xffcc66, 0.15);
      nTorchGlow.fillCircle(0, 0, 20);
      npcContainer.add(nTorchGlow);
      const nShadow = this.add.graphics();
      nShadow.fillStyle(0x1a1a2e, 0.6);
      nShadow.fillCircle(0, 2, 14);
      npcContainer.add(nShadow);
      const nOutline = this.add.graphics();
      nOutline.lineStyle(5, 0x1a1a2e, 1);
      nOutline.strokeCircle(0, 0, 18);
      npcContainer.add(nOutline);
      const nRing = this.add.graphics();
      nRing.lineStyle(3, 0xe8a838, 1); // Warm amber — survivor/friendly
      nRing.strokeCircle(0, 0, 18);
      npcContainer.add(nRing);
      npcContainer.add(this.add.sprite(0, 0, 'npc'));
      this.tweens.add({
        targets: npcContainer,
        scale: 1.06,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.interactionSystem.register({
        id: npc.id,
        type: 'npc',
        gridX: tile.x,
        gridY: tile.y,
        label: npc.name,
        interactionRange: 'adjacent',
      });
      npcRooms[npc.id] = room.name;
      npcPositions.push({ id: npc.id, name: npc.name, x: tile.x, y: tile.y, roomName: room.name });
      // Track for room content announcements
      this.addNpcToRoom(room.name, npc.name);
    }
    useGameStore.getState().actions.setNpcRoomsOnMap(npcRooms);
    useGameStore.getState().actions.setNpcPositionsOnMap(npcPositions);

    // Journals: 1–2 per map, like books but different visual
    const journalEntries = getRandomJournalEntriesSync(Math.min(2, roomData.length));
    const shuffledRooms = [...roomData].sort(() => Math.random() - 0.5);
    for (let i = 0; i < journalEntries.length; i++) {
      const journal = journalEntries[i];
      const roomWithSpace = shuffledRooms.find(({ tiles }) =>
        tiles.some((t) => !usedTiles.has(`${t.x},${t.y}`) && !isAdjacentToUsed(t.x, t.y))
      );
      if (!roomWithSpace) break;
      const available = roomWithSpace.tiles.filter(
        (t) => !usedTiles.has(`${t.x},${t.y}`) && !isAdjacentToUsed(t.x, t.y)
      );
      const tile = available[Math.floor(Math.random() * available.length)];
      usedTiles.add(`${tile.x},${tile.y}`);

      const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const container = this.add.container(px, py);
      container.setDepth(5);

      const shadow = this.add.graphics();
      shadow.fillStyle(0x1a1a2e, 0.6);
      shadow.fillCircle(0, 2, 12);
      container.add(shadow);
      const outlineRing = this.add.graphics();
      outlineRing.lineStyle(5, 0x1a1a2e, 1);
      outlineRing.strokeCircle(0, 0, 16);
      container.add(outlineRing);
      const ring = this.add.graphics();
      ring.lineStyle(3, 0xb8860b, 1); // Dark goldenrod — aged paper/sepia
      ring.strokeCircle(0, 0, 16);
      container.add(ring);
      const sprite = this.add.sprite(0, 0, 'journal-pickup');
      container.add(sprite);
      this.journalContainers.set(journal.id, container);

      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.interactionSystem.register({
        id: journal.id,
        type: 'journal',
        gridX: tile.x,
        gridY: tile.y,
        label: journal.title,
      });
      // Track for room content announcements
      this.addRoomContent(roomWithSpace.room.name, 'journal');
    }

    // Batteries: 1–2 per map, same rules as books (never in spawn room), green ring
    const batteryCount = Math.min(1 + Math.floor(Math.random() * 2), bookRoomData.length);
    const batteryRoomsShuffled = [...bookRoomData].sort(() => Math.random() - 0.5);
    for (let i = 0; i < batteryCount; i++) {
      const { room: batteryRoom, tiles } = batteryRoomsShuffled[i];
      const available = tiles.filter(
        (t) => !usedTiles.has(`${t.x},${t.y}`) && !isAdjacentToUsed(t.x, t.y)
      );
      if (available.length === 0) continue;

      const tile = available[Math.floor(Math.random() * available.length)];
      usedTiles.add(`${tile.x},${tile.y}`);
      const batteryId = `battery-${i}`;

      const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const container = this.add.container(px, py);
      container.setDepth(5);

      const shadow = this.add.graphics();
      shadow.fillStyle(0x1a1a2e, 0.6);
      shadow.fillCircle(0, 2, 14);
      container.add(shadow);
      const outlineRing = this.add.graphics();
      outlineRing.lineStyle(5, 0x1a1a2e, 1);
      outlineRing.strokeCircle(0, 0, 18);
      container.add(outlineRing);
      const ring = this.add.graphics();
      ring.lineStyle(3, 0x5cb85c, 1); // Green — battery/energy
      ring.strokeCircle(0, 0, 18);
      container.add(ring);
      container.add(this.add.sprite(0, 0, 'battery-pickup'));
      this.batteryContainers.set(batteryId, container);

      this.tweens.add({
        targets: container,
        scale: 1.06,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.interactionSystem.register({
        id: batteryId,
        type: 'battery',
        gridX: tile.x,
        gridY: tile.y,
        label: 'Battery',
      });
      // Track for room content announcements
      this.addRoomContent(batteryRoom.name, 'battery');
    }

    // Map: exactly 1 per map, in a room other than spawn, cyan/teal ring
    const mapRoomData = [...bookRoomData].sort(() => Math.random() - 0.5);
    for (const { room: mapRoom, tiles } of mapRoomData) {
      const available = tiles.filter(
        (t) => !usedTiles.has(`${t.x},${t.y}`) && !isAdjacentToUsed(t.x, t.y)
      );
      if (available.length === 0) continue;

      const tile = available[Math.floor(Math.random() * available.length)];
      usedTiles.add(`${tile.x},${tile.y}`);
      const mapId = 'area-map';

      const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const py = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const container = this.add.container(px, py);
      container.setDepth(5);

      const shadow = this.add.graphics();
      shadow.fillStyle(0x1a1a2e, 0.6);
      shadow.fillCircle(0, 2, 14);
      container.add(shadow);
      const outlineRing = this.add.graphics();
      outlineRing.lineStyle(5, 0x1a1a2e, 1);
      outlineRing.strokeCircle(0, 0, 18);
      container.add(outlineRing);
      const ring = this.add.graphics();
      ring.lineStyle(3, 0x00ced1, 1); // Cyan/teal — map/navigation
      ring.strokeCircle(0, 0, 18);
      container.add(ring);
      container.add(this.add.sprite(0, 0, 'map-pickup'));
      this.mapContainer = container;

      this.tweens.add({
        targets: container,
        scale: 1.06,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.interactionSystem.register({
        id: mapId,
        type: 'map',
        gridX: tile.x,
        gridY: tile.y,
        label: 'Map',
      });
      // Track for room content announcements
      this.addRoomContent(mapRoom.name, 'map');
      break; // Only place one map
    }
  }

  private checkRoomEntry(x: number, y: number, isInitialSpawn = false): void {
    const room = getRoomAt(this.mapData.rooms, x, y);
    const name = room?.name ?? 'corridor';
    if (name !== this.lastRoomName) {
      this.lastRoomName = name;
      EventBridge.emit('area-entered', { areaName: name });
      
      // Announce room name and contents if entering a room for the first time
      if (name !== 'corridor' && !this.announcedRooms.has(name)) {
        this.announcedRooms.add(name);
        // On initial spawn, delay longer to let game settle
        const initialDelay = isInitialSpawn ? 1500 : 300;
        this.announceRoomEntry(name, initialDelay);
      } else if (isInitialSpawn) {
        // Even if spawning in corridor, emit event so transporter can be announced
        setTimeout(() => {
          EventBridge.emit('room-announcements-complete');
        }, 2000);
      }
    }
  }

  private announceRoomEntry(roomName: string, initialDelay: number): void {
    // First: announce room name
    setTimeout(() => {
      speak(roomName);

      // Then: announce room contents after a pause
      setTimeout(() => {
        this.announceRoomContents(roomName);
        
        // Finally: signal that initial announcements are done
        // InteractionSystem will then announce current interactive (e.g., transporter)
        setTimeout(() => {
          EventBridge.emit('room-announcements-complete');
        }, 1500);
      }, 1200);
    }, initialDelay);
  }

  private addRoomContent(roomName: string, type: 'book' | 'journal' | 'battery' | 'map', npcName?: string): void {
    if (!this.roomContents.has(roomName)) {
      this.roomContents.set(roomName, { books: 0, journals: 0, npcs: [], batteries: 0, maps: 0 });
    }
    const contents = this.roomContents.get(roomName)!;
    switch (type) {
      case 'book': contents.books++; break;
      case 'journal': contents.journals++; break;
      case 'battery': contents.batteries++; break;
      case 'map': contents.maps++; break;
    }
    if (npcName) contents.npcs.push(npcName);
  }

  private addNpcToRoom(roomName: string, npcName: string): void {
    if (!this.roomContents.has(roomName)) {
      this.roomContents.set(roomName, { books: 0, journals: 0, npcs: [], batteries: 0, maps: 0 });
    }
    this.roomContents.get(roomName)!.npcs.push(npcName);
  }

  private announceRoomContents(roomName: string): void {
    const contents = this.roomContents.get(roomName);
    if (!contents) return;
    
    const parts: string[] = [];
    
    if (contents.books > 0) {
      parts.push(contents.books === 1 ? '1 book fragment' : `${contents.books} book fragments`);
    }
    if (contents.journals > 0) {
      parts.push(contents.journals === 1 ? '1 journal' : `${contents.journals} journals`);
    }
    if (contents.npcs.length > 0) {
      parts.push(contents.npcs.join(' and '));
    }
    if (contents.batteries > 0) {
      parts.push(contents.batteries === 1 ? '1 battery' : `${contents.batteries} batteries`);
    }
    if (contents.maps > 0) {
      parts.push('area map');
    }
    
    if (parts.length === 0) return;
    
    const announcement = `Contains: ${parts.join(', ')}.`;
    speak(announcement);
  }

  private updateFOV(originX: number, originY: number): void {
    const battery = useGameStore.getState().player.flashlightBattery;
    const radius = getFovRadiusFromBattery(battery);
    const visible = computeVisibleTiles(originX, originY, {
      walls: this.mapData.walls,
      radius,
    });
    // Only count tiles that are actually reachable/walkable for discovery
    const { reachableTiles } = this.mapData;
    const reachableVisible = Array.from(visible).filter(coord => reachableTiles.has(coord));
    useGameStore.getState().actions.addExploredTiles(reachableVisible);

    const explored = new Set(useGameStore.getState().session.exploredTiles);
    this.applyFogOfWar(visible, explored);

    // Emit area-entered when a new room first enters visibility
    for (const coord of visible) {
      const [x, y] = coord.split(',').map(Number);
      const room = getRoomAt(this.mapData.rooms, x, y);
      const name = room?.name ?? 'corridor';
      if (name !== 'corridor' && !this.revealedRoomNames.has(name)) {
        this.revealedRoomNames.add(name);
        EventBridge.emit('area-entered', { areaName: name });
      }
    }
  }

  private applyFogOfWar(
    visible: Set<string>,
    explored: Set<string>,
  ): void {
    // Fog overlay: draw dark rectangles instead of modifying tile layers.
    // Phaser layers from separate tilemaps (wall, decoration) have incompatible
    // internal structure — forEachTile/getTileAt throw. Overlay avoids that.
    const FOG_COLOR = 0x000000;
    this.fogOverlay.clear();

    for (let ty = 0; ty < MAP_HEIGHT; ty++) {
      for (let tx = 0; tx < MAP_WIDTH; tx++) {
        const coord = `${tx},${ty}`;
        if (visible.has(coord)) continue;

        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;
        const alpha = explored.has(coord) ? 0.5 : 1;
        this.fogOverlay.fillStyle(FOG_COLOR, alpha);
        this.fogOverlay.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    this.drawWallOutline(visible, explored);
  }

  /**
   * Draw light, thick borders along wall edges — only on the side the player sees.
   * An edge is drawn only when the adjacent floor tile is in current FoV (visible).
   * This avoids outlining the "far" side of walls (e.g. in dead ends).
   */
  private drawWallOutline(visible: Set<string>, _explored: Set<string>): void {
    const { walls } = this.mapData;
    const isWall = (x: number, y: number) =>
      x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT &&
      (walls[y][x] === TILE.WALL || walls[y][x] === TILE.RUBBLE);
    const floorVisible = (x: number, y: number) => visible.has(`${x},${y}`);

    this.wallOutline.clear();

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!isWall(x, y)) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        this.wallOutline.lineStyle(4, 0xe8e4dc, 1);

        // Only draw edge if the floor on that side is currently visible to the player
        if (!isWall(x - 1, y) && floorVisible(x - 1, y))
          this.wallOutline.lineBetween(px, py, px, py + TILE_SIZE);
        if (!isWall(x + 1, y) && floorVisible(x + 1, y))
          this.wallOutline.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
        if (!isWall(x, y - 1) && floorVisible(x, y - 1))
          this.wallOutline.lineBetween(px, py, px + TILE_SIZE, py);
        if (!isWall(x, y + 1) && floorVisible(x, y + 1))
          this.wallOutline.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
      }
    }
  }

  update() {
    this.interactionSystem?.update();
  }

  private playBookPickupEffect(): void {
    // Gentle camera shake
    this.cameras.main.shake(200, 0.008);
    
    // Golden flash overlay
    const flash = this.add.graphics();
    flash.setDepth(200);
    flash.fillStyle(0xd4af37, 0.3);
    flash.fillRect(0, 0, this.cameras.main.width * 2, this.cameras.main.height * 2);
    flash.setScrollFactor(0);
    
    // Radial burst from player position
    const playerPos = this.player.getPixelPosition();
    const particles: { x: number; y: number; vx: number; vy: number; alpha: number; size: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      particles.push({
        x: playerPos.x,
        y: playerPos.y,
        vx: Math.cos(angle) * 80,
        vy: Math.sin(angle) * 80,
        alpha: 1,
        size: 4 + Math.random() * 3,
      });
    }
    
    const particleGraphics = this.add.graphics();
    particleGraphics.setDepth(201);
    
    let elapsed = 0;
    const duration = 400;
    
    const animate = () => {
      elapsed += 16;
      const t = elapsed / duration;
      
      // Fade flash
      flash.clear();
      flash.fillStyle(0xd4af37, 0.3 * (1 - t));
      flash.fillRect(
        this.cameras.main.scrollX - 50,
        this.cameras.main.scrollY - 50,
        this.cameras.main.width + 100,
        this.cameras.main.height + 100
      );
      
      // Animate particles
      particleGraphics.clear();
      particles.forEach(p => {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.alpha = 1 - t;
        particleGraphics.fillStyle(0xd4af37, p.alpha);
        particleGraphics.fillCircle(p.x, p.y, p.size * (1 - t * 0.5));
      });
      
      if (elapsed < duration) {
        this.time.delayedCall(16, animate);
      } else {
        flash.destroy();
        particleGraphics.destroy();
      }
    };
    
    animate();
  }

  private playBeamUpAnimation(): void {
    // Disable player input during animation
    this.gridMovement?.detach();
    this.interactionSystem?.detach();

    const playerPos = this.player.getPixelPosition();
    
    // Create beam effect graphics
    const beamGraphics = this.add.graphics();
    beamGraphics.setDepth(100);
    
    // Initial beam column (thin, bright blue)
    const beamWidth = 40;
    const beamX = playerPos.x - beamWidth / 2;
    
    // Animate beam expanding and brightening
    let progress = 0;
    const beamDuration = 800;
    const fadeDelay = 600;
    
    // Beam particles rising effect
    const particles: { x: number; y: number; speed: number; alpha: number }[] = [];
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: playerPos.x + (Math.random() - 0.5) * 30,
        y: playerPos.y + Math.random() * 40 - 20,
        speed: 50 + Math.random() * 100,
        alpha: 0.6 + Math.random() * 0.4,
      });
    }
    
    const updateBeam = () => {
      progress += 16;
      const t = Math.min(progress / beamDuration, 1);
      
      beamGraphics.clear();
      
      // Expanding beam column
      const expandedWidth = beamWidth + t * 60;
      const beamAlpha = 0.3 + t * 0.5;
      beamGraphics.fillStyle(0x5cb3ff, beamAlpha);
      beamGraphics.fillRect(
        playerPos.x - expandedWidth / 2,
        0,
        expandedWidth,
        this.cameras.main.height * 2
      );
      
      // Inner bright core
      const coreWidth = 20 + t * 20;
      beamGraphics.fillStyle(0xffffff, 0.6 + t * 0.4);
      beamGraphics.fillRect(
        playerPos.x - coreWidth / 2,
        0,
        coreWidth,
        this.cameras.main.height * 2
      );
      
      // Rising particles
      particles.forEach((p) => {
        p.y -= p.speed * 0.016;
        beamGraphics.fillStyle(0x5cb3ff, p.alpha * (1 - t * 0.5));
        beamGraphics.fillCircle(p.x, p.y, 3 + Math.random() * 2);
      });
      
      if (progress < beamDuration) {
        this.time.delayedCall(16, updateBeam);
      }
    };
    
    updateBeam();
    
    // Screen fade to white/blue
    this.time.delayedCall(fadeDelay, () => {
      this.cameras.main.fadeOut(400, 200, 220, 255);
    });
    
    // Transition to ship after animation
    this.time.delayedCall(beamDuration + 200, () => {
      useGameStore.getState().actions.beamToShip();
      useGameStore.getState().actions.saveToLocalStorage();
      this.scene.start('ShipScene');
    });
  }

  shutdown() {
    this.gridMovement?.detach();
    this.interactionSystem?.detach();
  }
}
