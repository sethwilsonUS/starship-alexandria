import { BlendModes, Scene } from 'phaser';
import { TILE_SIZE } from '@/config/gameConfig';
import { getBookCatalogSync } from '@/data/books';
import { getNPCCatalogSync } from '@/data/npcs';
import { getJournalCacheSync } from '@/utils/contentLoaderSync';
import { computeVisibleTiles } from '../systems/FOVSystem';
import { useGameStore } from '@/store/gameStore';
import { EventBridge } from '../EventBridge';
import { Player } from '../entities/Player';
import { GridMovement } from '../systems/GridMovement';
import { InteractionSystem } from '../systems/Interaction';
import { AnnouncementQueue, createSceneAnnouncementScheduler } from '../systems/AnnouncementQueue';
import { FxController } from '../systems/FxController';
import { FogRenderer } from '../systems/FogRenderer';
import { summarizeRoomContent, type RoomContentSummary } from '../systems/PlacementSystem';
import { createCpuTilemapLayer } from '../utils/tilemapLayers';
import { ASSET_KEYS, THEME_TILESET_KEYS } from '@/game/assets/assetManifest';
import { playBumpSound, speak } from '@/utils/speech';
import { transitionGuard } from '@/game/input/gameInput';
import {
  EXPEDITION_THEMES,
  expeditionToTilemap,
  generateExpedition,
  type ExpeditionContentCatalog,
  type ExpeditionTheme,
  type GeneratedExpedition,
  type PlacedEntity,
  type Point,
  type ThemeId,
  type RenderedExpeditionMap,
} from '@/game/expeditions';
import type { FootstepSurface } from '@/game/expeditions';
import {
  playCue,
  playFootstep as playFootstepSound,
  startAmbience,
} from '@/game/audio/AudioDirector';
import { shouldUseMotion } from '@/game/motionPolicy';

const BEAM_UP_INPUT_BLOCK_MS = 1100;

const STEP_DUST_COLORS: Record<FootstepSurface, number> = {
  stone: 0xb9b4a4,
  wood: 0xa38560,
  dirt: 0x9a7f5a,
  grass: 0x86a06a,
  sand: 0xc9b280,
  water: 0x7fb6d9,
};

/** Renders and operates one pure, deterministic expedition. */
export default class ExploreScene extends Scene {
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private decorationLayer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Player;
  private gridMovement!: GridMovement;
  private interactionSystem!: InteractionSystem;
  private announcementQueue!: AnnouncementQueue;
  private fx!: FxController;
  private fogRenderer!: FogRenderer;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private expedition!: GeneratedExpedition;
  private theme!: ExpeditionTheme;
  private mapData!: RenderedExpeditionMap;
  private lastZoneId: string | null = null;
  private revealedZoneIds = new Set<string>();
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private bookContainers = new Map<string, Phaser.GameObjects.Container>();
  private journalContainers = new Map<string, Phaser.GameObjects.Container>();
  private mapContainer: Phaser.GameObjects.Container | null = null;
  private vaultContainer: Phaser.GameObjects.Container | null = null;
  private blockedTiles = new Set<string>();
  private interactiveContainers = new Map<string, Phaser.GameObjects.Container>();
  private highlightedInteractiveId: string | null = null;
  private bookToRoomMap = new Map<string, string>();
  private roomContents = new Map<string, RoomContentSummary>();
  private announcedRooms = new Set<string>();
  private isBeamingUp = false;
  private footstepIndex = 0;

  constructor() {
    super({ key: 'ExploreScene' });
  }

  create(): void {
    this.resetSceneCollections();
    const state = useGameStore.getState();
    const themeId = state.session.activeThemeId ?? 'scriptorium';
    this.theme = EXPEDITION_THEMES[themeId];
    const seed = getExpeditionSeed(state.session.activeExpeditionId, themeId);
    this.expedition = generateExpedition({
      seed,
      themeId,
      collectedFragmentIds: state.savedFragmentIds,
      contentCatalog: buildRuntimeContentCatalog(),
    });
    this.mapData = expeditionToTilemap(this.expedition);

    if (this.shouldAnimate()) this.cameras.main.fadeIn(600, 92, 180, 255);
    this.fx = new FxController(this);
    startAmbience(this, ASSET_KEYS.audio.ambience.byTheme[themeId]);
    this.createTilemap();
    this.fogRenderer = new FogRenderer(this, this.mapData.walls);

    const { x: spawnX, y: spawnY } = this.expedition.spawn;
    this.player = new Player(this, ASSET_KEYS.sprites.player, spawnX, spawnY);
    this.player.setDirection('down');

    this.gridMovement = new GridMovement();
    this.gridMovement.attach(this, this.player, {
      wallLayer: this.wallLayer,
      mapWidth: this.expedition.width,
      mapHeight: this.expedition.height,
      getBlockedTiles: () => this.blockedTiles,
      getSemanticCell: (x, y) => this.expedition.cells[y]?.[x] ?? null,
    });

    this.interactionSystem = new InteractionSystem();
    this.interactionSystem.attach(this, this.player);
    this.announcementQueue = new AnnouncementQueue(createSceneAnnouncementScheduler(this));
    this.events.once('shutdown', () => this.cleanupOnShutdown());
    this.placeGeneratedInteractives();

    state.actions.startExpedition();
    state.actions.setMapLayoutData(
      this.mapData.rooms,
      this.mapData.walls,
      { x: spawnX, y: spawnY },
    );
    state.actions.clearExploredTiles();
    state.actions.setExplorableTileCount(this.mapData.reachableTiles.size);
    state.actions.movePlayer({ x: spawnX, y: spawnY });
    this.bindRuntimeEvents();
    this.checkRoomEntry(spawnX, spawnY, true);
    this.updateFOV(spawnX, spawnY);

    const worldWidth = this.expedition.width * TILE_SIZE;
    const worldHeight = this.expedition.height * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.camera = this.cameras.main;
    this.camera.setBounds(0, 0, worldWidth, worldHeight);
    this.camera.setZoom(2);
    this.camera.startFollow(this.player.getSprite(), true, 0.08, 0.08);
    this.createAmbientGrade();
    this.createVignetteOverlay();
    this.showLocationCard();
    this.publishE2ESnapshot();
  }

  private createTilemap(): void {
    const atlasKey = THEME_TILESET_KEYS[this.expedition.themeId];
    this.tilemap = this.make.tilemap({
      data: this.mapData.ground,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const groundTileset = this.tilemap.addTilesetImage(atlasKey, atlasKey, TILE_SIZE, TILE_SIZE)!;
    this.groundLayer = createCpuTilemapLayer(this.tilemap, 0, groundTileset, 0, 0);
    this.groundLayer.setDepth(0);

    const wallMap = this.make.tilemap({
      data: this.mapData.walls,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const wallTileset = wallMap.addTilesetImage(atlasKey, atlasKey, TILE_SIZE, TILE_SIZE)!;
    this.wallLayer = createCpuTilemapLayer(wallMap, 0, wallTileset, 0, 0);
    this.wallLayer.setDepth(1);
    this.wallLayer.setCollision([4, 5]);

    const decorationMap = this.make.tilemap({
      data: this.mapData.decoration,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const decorationTileset = decorationMap.addTilesetImage(atlasKey, atlasKey, TILE_SIZE, TILE_SIZE)!;
    this.decorationLayer = createCpuTilemapLayer(decorationMap, 0, decorationTileset, 0, 0);
    this.decorationLayer.setDepth(2);
  }

  private bindRuntimeEvents(): void {
    const onPlayerMoved = ({ x, y, surface }: { x: number; y: number; surface: FootstepSurface }) => {
      const actions = useGameStore.getState().actions;
      actions.movePlayer({ x, y });
      this.playFootstep(surface);
      if (this.shouldAnimate()) {
        this.fx.playStepDust(this.player.getPixelPosition(), STEP_DUST_COLORS[surface] ?? STEP_DUST_COLORS.stone);
      }
      this.checkRoomEntry(x, y);
      this.updateFOV(x, y);
      this.publishE2ESnapshot();
    };
    EventBridge.on('player-moved', onPlayerMoved);
    this.events.once('shutdown', () => EventBridge.off('player-moved', onPlayerMoved));

    const onBeamUpConfirmed = () => this.playBeamUpAnimation();
    EventBridge.on('beam-up-confirmed', onBeamUpConfirmed);
    this.events.once('shutdown', () => EventBridge.off('beam-up-confirmed', onBeamUpConfirmed));

    const onBookFound = () => {
      if (this.shouldAnimate()) this.fx.playPickupBurst(this.player.getPixelPosition());
    };
    EventBridge.on('book-found', onBookFound);
    this.events.once('shutdown', () => EventBridge.off('book-found', onBookFound));

    const onMovementBlocked = ({ reason }: { reason: string }) => {
      playBumpSound();
      speak({ edge: 'Edge of the site', terrain: 'Blocked passage', entity: 'Someone or something is here' }[reason] ?? 'Blocked');
    };
    EventBridge.on('movement-blocked', onMovementBlocked);
    this.events.once('shutdown', () => EventBridge.off('movement-blocked', onMovementBlocked));

    const onInteractiveConsumed = ({ type, id }: { type: string; id?: string }) => {
      this.time.delayedCall(50, () => this.removeConsumedInteractive(type, id));
    };
    EventBridge.on('interactive-consumed', onInteractiveConsumed);
    this.events.once('shutdown', () => EventBridge.off('interactive-consumed', onInteractiveConsumed));

    const onVaultOpened = ({ vaultId }: { vaultId: string }) => {
      if (vaultId !== this.expedition.vault.id || !this.vaultContainer) return;
      playCue(this, ASSET_KEYS.audio.cues.vaultOpen, 0.55);
      this.vaultContainer.setAlpha(0.62);
    };
    EventBridge.on('vault-opened', onVaultOpened);
    this.events.once('shutdown', () => EventBridge.off('vault-opened', onVaultOpened));

    const onDebugDespawnAllBooks = () => {
      this.bookContainers.forEach((container, id) => {
        container.destroy();
        this.interactionSystem.unregister(id);
      });
      this.bookContainers.clear();
      this.bookToRoomMap.clear();
      const actions = useGameStore.getState().actions;
      actions.setBooksRemainingOnThisMap(0);
      actions.setRoomsWithBooksOnMap([]);
    };
    EventBridge.on('debug-despawn-all-books', onDebugDespawnAllBooks);
    this.events.once('shutdown', () => EventBridge.off('debug-despawn-all-books', onDebugDespawnAllBooks));

    const onInteractionAvailable = ({ id }: { type: string; label?: string; id?: string }) => {
      this.setInteractiveHighlight(id);
    };
    EventBridge.on('interaction-available', onInteractionAvailable);
    this.events.once('shutdown', () => EventBridge.off('interaction-available', onInteractionAvailable));
  }

  private placeGeneratedInteractives(): void {
    this.placeTransporter();
    const bookCatalog = getBookCatalogSync();
    const fragments = new Map(bookCatalog.flatMap((book) => book.fragments.map((fragment) => [fragment.id, { book, fragment }] as const)));
    const npcs = new Map(getNPCCatalogSync().map((npc) => [npc.id, npc]));
    const journals = new Map(getJournalCacheSync().map((journal) => [journal.id, journal]));
    const npcRooms: Record<string, string> = {};
    const npcPositions: Array<{ id: string; name: string; x: number; y: number; roomName: string }> = [];

    for (const entity of this.expedition.entities) {
      const roomName = this.zoneName(entity.zoneId);
      if (entity.blocksMovement) this.blockedTiles.add(pointKey(entity.position));

      switch (entity.kind) {
        case 'fragment': {
          const content = fragments.get(entity.fragmentId);
          if (!content) break;
          const container = this.addGroundedSprite(entity.position, ASSET_KEYS.sprites.book, 0xd4af37, 'float');
          this.bookContainers.set(entity.fragmentId, container);
          this.interactiveContainers.set(entity.fragmentId, container);
          this.bookToRoomMap.set(entity.fragmentId, roomName);
          this.interactionSystem.register({
            id: entity.fragmentId,
            type: 'book',
            gridX: entity.position.x,
            gridY: entity.position.y,
            label: `${content.book.title}: ${content.fragment.label}`,
          });
          summarizeRoomContent(this.roomContents, roomName, 'book');
          break;
        }
        case 'npc': {
          const npc = npcs.get(entity.npcId);
          if (!npc) break;
          this.interactiveContainers.set(npc.id, this.addGroundedSprite(entity.position, ASSET_KEYS.sprites.npc, 0xe8a838, 'breathe'));
          this.interactionSystem.register({
            id: npc.id,
            type: 'npc',
            gridX: entity.position.x,
            gridY: entity.position.y,
            label: `${npc.name}, ${npc.role}`,
            interactionRange: 'adjacent',
          });
          npcRooms[npc.id] = roomName;
          npcPositions.push({ id: npc.id, name: npc.name, x: entity.position.x, y: entity.position.y, roomName });
          summarizeRoomContent(this.roomContents, roomName, 'npc', npc.name);
          break;
        }
        case 'journal': {
          const journal = journals.get(entity.journalId);
          if (!journal) break;
          const container = this.addGroundedSprite(entity.position, ASSET_KEYS.sprites.journal, 0xb8860b, 'float');
          this.journalContainers.set(entity.journalId, container);
          this.interactiveContainers.set(entity.journalId, container);
          this.interactionSystem.register({
            id: entity.journalId,
            type: 'journal',
            gridX: entity.position.x,
            gridY: entity.position.y,
            label: journal.title,
          });
          summarizeRoomContent(this.roomContents, roomName, 'journal');
          break;
        }
        case 'clue': {
          const container = this.addGroundedSprite(entity.position, ASSET_KEYS.sprites.journal, 0x9cb3c9, 'float');
          this.journalContainers.set(entity.clueId, container);
          this.interactiveContainers.set(entity.clueId, container);
          this.interactionSystem.register({
            id: entity.clueId,
            type: 'journal',
            gridX: entity.position.x,
            gridY: entity.position.y,
            label: entity.label,
          });
          summarizeRoomContent(this.roomContents, roomName, 'journal');
          break;
        }
        case 'map': {
          this.mapContainer = this.addGroundedSprite(entity.position, ASSET_KEYS.sprites.map, 0x00ced1, 'float');
          this.interactiveContainers.set(entity.id, this.mapContainer);
          this.interactionSystem.register({
            id: entity.id,
            type: 'map',
            gridX: entity.position.x,
            gridY: entity.position.y,
            label: `Map of ${this.theme.title}`,
          });
          summarizeRoomContent(this.roomContents, roomName, 'map');
          break;
        }
        case 'prop':
          this.placeProp(entity);
          break;
      }
    }

    this.placeVault();
    const actions = useGameStore.getState().actions;
    actions.setBooksOnThisMap(this.bookContainers.size);
    actions.setRoomsWithBooksOnMap([...new Set(this.bookToRoomMap.values())]);
    actions.setNpcRoomsOnMap(npcRooms);
    actions.setNpcPositionsOnMap(npcPositions);
  }

  private placeTransporter(): void {
    const container = this.addGroundedSprite(this.expedition.extraction, ASSET_KEYS.sprites.transporter, 0x5cb3ff, 'static');
    this.interactiveContainers.set(`transporter-${this.expedition.seed}`, container);
    this.interactionSystem.register({
      id: `transporter-${this.expedition.seed}`,
      type: 'transporter',
      gridX: this.expedition.extraction.x,
      gridY: this.expedition.extraction.y,
      label: 'Transporter pad',
    });
  }

  private placeVault(): void {
    const vault = this.expedition.vault;
    const roomName = this.zoneName(vault.zoneId);
    this.blockedTiles.add(pointKey(vault.position));
    this.vaultContainer = this.addGroundedSprite(vault.position, ASSET_KEYS.sprites.vault, 0x9370db, 'static');
    this.interactiveContainers.set(vault.id, this.vaultContainer);
    this.interactionSystem.register({
      id: vault.id,
      type: 'vault',
      gridX: vault.position.x,
      gridY: vault.position.y,
      label: vault.label,
      interactionRange: 'adjacent',
    });
    useGameStore.getState().actions.setVaultInfo({
      vaultId: vault.id,
      contentId: vault.contentId,
      clueId: vault.clueId,
      clueContentId: vault.clueContentId,
      roomName,
      label: vault.label,
      code: vault.code,
      reward: vault.reward,
    });
  }

  private placeProp(entity: Extract<PlacedEntity, { kind: 'prop' }>): void {
    const substantial = /shelf|desk|pew|column|locker|crate|console|stand|statue/i.test(entity.propId);
    const texture = substantial ? ASSET_KEYS.sprites.bookshelfProp : ASSET_KEYS.sprites.paperDebrisProp;
    const image = this.add.image(
      entity.position.x * TILE_SIZE + TILE_SIZE / 2,
      entity.position.y * TILE_SIZE + TILE_SIZE / 2,
      texture,
    );
    image.setDepth(3.1);
    image.setAlpha(0.84);
    if (!substantial) image.setAngle(stableAngle(entity.id));
  }

  /**
   * Entities sit in the world: accent glow on the ground, a cast shadow, and
   * the sprite itself. Pickups float gently, NPCs breathe, fixtures hold still.
   * Containers render below the fog so unexplored darkness hides them and the
   * explored-memory dim applies naturally; the map overlay keeps badge markers.
   */
  private addGroundedSprite(
    position: Point,
    texture: string,
    accentColor: number,
    style: 'float' | 'breathe' | 'static',
  ): Phaser.GameObjects.Container {
    const container = this.add.container(
      position.x * TILE_SIZE + TILE_SIZE / 2,
      position.y * TILE_SIZE + TILE_SIZE / 2,
    );
    container.setDepth(3.5);

    const glow = this.add.graphics();
    glow.fillStyle(accentColor, 0.07);
    glow.fillCircle(0, 2, 19);
    glow.fillStyle(accentColor, 0.14);
    glow.fillCircle(0, 2, 13);
    container.add(glow);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x05080f, 0.42);
    shadow.fillEllipse(0, 11, 20, 7);
    container.add(shadow);

    const sprite = this.add.sprite(0, 0, texture);
    container.add(sprite);

    if (this.shouldAnimate()) {
      if (style === 'float') {
        this.tweens.add({
          targets: sprite,
          y: -2.5,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (style === 'breathe') {
        this.tweens.add({
          targets: sprite,
          scaleY: 1.03,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        this.tweens.add({
          targets: glow,
          alpha: 0.55,
          duration: 1600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    return container;
  }

  /** Scale up the interactive the player can currently act on; settle the last one. */
  private setInteractiveHighlight(id: string | undefined): void {
    if (this.highlightedInteractiveId && this.highlightedInteractiveId !== id) {
      const previous = this.interactiveContainers.get(this.highlightedInteractiveId);
      if (previous) {
        this.tweens.killTweensOf(previous);
        previous.setScale(1);
      }
    }
    this.highlightedInteractiveId = id ?? null;
    if (!id) return;

    const container = this.interactiveContainers.get(id);
    if (!container) return;
    if (this.shouldAnimate()) {
      this.tweens.add({ targets: container, scale: 1.12, duration: 140, ease: 'Sine.easeOut' });
    } else {
      container.setScale(1.1);
    }
  }

  private removeConsumedInteractive(type: string, id?: string): void {
    if (!id) return;
    const containers = type === 'book'
      ? this.bookContainers
      : type === 'journal'
        ? this.journalContainers
        : null;
    const container = containers?.get(id);
    if (container) {
      container.destroy();
      containers?.delete(id);
    } else if (type === 'map' && this.mapContainer) {
      this.mapContainer.destroy();
      this.mapContainer = null;
    }
    this.interactiveContainers.delete(id);
    if (this.highlightedInteractiveId === id) this.highlightedInteractiveId = null;
    this.interactionSystem.unregister(id);

    if (type === 'book') {
      this.bookToRoomMap.delete(id);
      const actions = useGameStore.getState().actions;
      actions.setBooksRemainingOnThisMap(this.bookContainers.size);
      actions.setRoomsWithBooksOnMap([...new Set(this.bookToRoomMap.values())]);
    }
  }

  private checkRoomEntry(x: number, y: number, isInitialSpawn = false): void {
    const zone = this.zoneAt(x, y);
    const zoneId = zone?.id ?? 'corridor';
    if (zoneId === this.lastZoneId) return;
    this.lastZoneId = zoneId;
    useGameStore.getState().actions.setCurrentZone(zone?.id ?? null);
    const name = zone?.name ?? this.corridorLabel();
    EventBridge.emit('area-entered', { areaName: name });
    if (zone) useGameStore.getState().actions.visitRoom(`${zone.bounds.x1},${zone.bounds.y1}`);

    if (zone && !this.announcedRooms.has(zone.id)) {
      this.announcedRooms.add(zone.id);
      this.announceRoomEntry(name, isInitialSpawn ? 1200 : 250);
    } else if (isInitialSpawn) {
      this.announcementQueue.play([
        { delayMs: 1600, run: () => EventBridge.emit('room-announcements-complete') },
      ]);
    }
  }

  private announceRoomEntry(roomName: string, initialDelay: number): void {
    this.announcementQueue.play([
      { delayMs: initialDelay, run: () => speak(roomName) },
      { delayMs: 900, run: () => this.announceRoomContents(roomName) },
      { delayMs: 1200, run: () => EventBridge.emit('room-announcements-complete') },
    ]);
  }

  private announceRoomContents(roomName: string): void {
    const contents = this.roomContents.get(roomName);
    if (!contents) return;
    const parts: string[] = [];
    if (contents.books) parts.push(`${contents.books} book ${contents.books === 1 ? 'fragment' : 'fragments'}`);
    if (contents.journals) parts.push(`${contents.journals} ${contents.journals === 1 ? 'journal or clue' : 'journals or clues'}`);
    if (contents.npcs.length) parts.push(contents.npcs.join(' and '));
    if (contents.maps) parts.push('area map');
    if (parts.length) speak(`Contains: ${parts.join(', ')}.`);
  }

  private updateFOV(originX: number, originY: number): void {
    const visible = computeVisibleTiles(originX, originY, {
      walls: this.mapData.walls,
    });
    const reachableVisible = [...visible].filter((coordinate) => this.mapData.reachableTiles.has(coordinate));
    useGameStore.getState().actions.addExploredTiles(reachableVisible);
    this.fogRenderer.render(
      visible,
      new Set(useGameStore.getState().session.exploredTiles),
      { x: originX, y: originY },
    );

    for (const coordinate of visible) {
      const [x, y] = coordinate.split(',').map(Number);
      const zone = this.zoneAt(x, y);
      if (zone && !this.revealedZoneIds.has(zone.id)) {
        this.revealedZoneIds.add(zone.id);
        EventBridge.emit('area-discovered', { areaName: zone.name });
      }
    }
  }

  private showLocationCard(): void {
    EventBridge.emit('location-card', { title: this.theme.title, kicker: this.theme.kicker });
    const { width, height } = this.cameras.main;
    const container = this.add.container(width / 2, height / 2 - 20).setDepth(500).setScrollFactor(0);
    const background = this.add.graphics();
    background.fillStyle(0x080f21, 0.92);
    background.fillRoundedRect(-260, -52, 520, 104, 8);
    background.lineStyle(2, Number.parseInt(this.theme.accentColor.slice(1), 16), 0.9);
    background.strokeRoundedRect(-260, -52, 520, 104, 8);
    container.add(background);
    container.add(this.add.text(0, -12, this.theme.title, {
      color: '#f5ecd5',
      fontFamily: 'Atkinson Hyperlegible, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5));
    container.add(this.add.text(0, 22, this.theme.kicker, {
      color: this.theme.accentColor,
      fontFamily: 'Atkinson Hyperlegible, sans-serif',
      fontSize: '13px',
      align: 'center',
    }).setOrigin(0.5));

    if (!this.shouldAnimate()) {
      this.time.delayedCall(1400, () => container.destroy());
      return;
    }
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 350,
      onComplete: () => this.time.delayedCall(1500, () => {
        this.tweens.add({ targets: container, alpha: 0, duration: 350, onComplete: () => container.destroy() });
      }),
    });
  }

  /**
   * Per-destination color grade: a near-white tint multiplied over the scene
   * (warm parchment in the scriptorium, cool moonlight in the cathedral, …).
   * Sits above the world and fog, below the location card and vignette.
   */
  private createAmbientGrade(): void {
    const { width, height } = this.cameras.main;
    const tint = Number.parseInt(this.theme.ambientTint.slice(1), 16);
    const grade = this.add.graphics().setDepth(450).setScrollFactor(0);
    grade.fillStyle(tint, 1);
    grade.fillRect(0, 0, width, height);
    grade.setBlendMode(BlendModes.MULTIPLY);
  }

  private createVignetteOverlay(): void {
    const { width, height } = this.cameras.main;
    this.vignetteOverlay = this.add.graphics().setDepth(1000).setScrollFactor(0);
    const edgeWidth = 64;
    for (let offset = 0; offset < edgeWidth; offset += 1) {
      const alpha = 0.22 * (1 - offset / edgeWidth);
      this.vignetteOverlay.fillStyle(0x000000, alpha);
      this.vignetteOverlay.fillRect(offset, 0, 1, height);
      this.vignetteOverlay.fillRect(width - offset - 1, 0, 1, height);
      this.vignetteOverlay.fillRect(0, offset, width, 1);
      this.vignetteOverlay.fillRect(0, height - offset - 1, width, 1);
    }
  }

  private playFootstep(surface: FootstepSurface): void {
    this.footstepIndex = playFootstepSound(this, surface, this.footstepIndex);
  }

  private zoneAt(x: number, y: number) {
    const id = this.expedition.cells[y]?.[x]?.zoneId;
    return id ? this.expedition.zones.find((zone) => zone.id === id) ?? null : null;
  }

  private zoneName(zoneId: string): string {
    return this.expedition.zones.find((zone) => zone.id === zoneId)?.name ?? this.corridorLabel();
  }

  private corridorLabel(): string {
    return this.expedition.themeId === 'gardens' ? 'the overgrown paths' : 'the connecting passage';
  }

  private shouldAnimate(): boolean {
    return shouldUseMotion(useGameStore.getState().settings.motionPreference);
  }

  private playBeamUpAnimation(): void {
    if (this.isBeamingUp) return;
    this.isBeamingUp = true;
    transitionGuard.beginTransition(Date.now(), BEAM_UP_INPUT_BLOCK_MS);
    this.gridMovement.detach();
    this.interactionSystem.detach();
    EventBridge.emit('interaction-available', { type: '', label: undefined });
    const finish = () => {
      useGameStore.getState().actions.beamToShip();
      useGameStore.getState().actions.saveToLocalStorage();
      this.scene.start('ShipScene');
    };
    playCue(this, ASSET_KEYS.audio.cues.transporter, 0.55);
    if (!this.shouldAnimate()) {
      finish();
      return;
    }
    this.fx.playBeamColumn(
      this.player.getPixelPosition(),
      () => this.cameras.main.fadeOut(400, 200, 220, 255),
      finish,
    );
  }

  private publishE2ESnapshot(): void {
    if (process.env.NEXT_PUBLIC_E2E !== '1' || typeof window === 'undefined') return;
    window.__STARSHIP_E2E__ = Object.freeze({
      get inputReady() {
        return transitionGuard.canAcceptAction();
      },
      seed: this.expedition.seed,
      themeId: this.expedition.themeId,
      cells: this.expedition.cells.map((row) => row.map((cell) => ({
        walkable: cell.walkable,
        surface: cell.surface,
        zoneId: cell.zoneId,
      }))),
      player: { ...this.player.getGridPosition() },
      extraction: { ...this.expedition.extraction },
      entities: this.expedition.entities.map((entity) => ({
        id: entity.id,
        kind: entity.kind,
        position: { ...entity.position },
        blocksMovement: entity.blocksMovement,
      })),
      vault: {
        id: this.expedition.vault.id,
        position: { ...this.expedition.vault.position },
        clueId: this.expedition.vault.clueId,
      },
    });
  }

  private resetSceneCollections(): void {
    this.lastZoneId = null;
    this.revealedZoneIds.clear();
    this.bookContainers.clear();
    this.journalContainers.clear();
    this.blockedTiles.clear();
    this.interactiveContainers.clear();
    this.highlightedInteractiveId = null;
    this.bookToRoomMap.clear();
    this.roomContents.clear();
    this.announcedRooms.clear();
    this.mapContainer = null;
    this.vaultContainer = null;
    this.isBeamingUp = false;
    this.footstepIndex = 0;
  }

  private cleanupOnShutdown(): void {
    this.fx?.destroy();
    this.fogRenderer?.destroy();
    this.announcementQueue?.destroy();
    this.gridMovement?.detach();
    this.interactionSystem?.detach();
    EventBridge.emit('interaction-available', { type: '', label: undefined });
    if (process.env.NEXT_PUBLIC_E2E === '1' && typeof window !== 'undefined') {
      delete window.__STARSHIP_E2E__;
    }
    this.isBeamingUp = false;
  }

  update(): void {
    this.interactionSystem?.update();
  }
}

function buildRuntimeContentCatalog(): ExpeditionContentCatalog {
  const books = getBookCatalogSync();
  const npcs = getNPCCatalogSync();
  const journals = getJournalCacheSync();
  const themes = Object.keys(EXPEDITION_THEMES) as ThemeId[];
  return {
    fragments: books.flatMap((book) => book.fragments.map((fragment) => ({
      id: fragment.id,
      themeIds: fragment.themeAffinities,
    }))),
    npcIdsByTheme: Object.fromEntries(themes.map((themeId) => [
      themeId,
      npcs.filter((npc) => npc.themeIds.includes(themeId)).map((npc) => npc.id),
    ])),
    journalIdsByTheme: Object.fromEntries(themes.map((themeId) => [
      themeId,
      journals.filter((journal) => journal.themeIds?.includes(themeId)).map((journal) => journal.id),
    ])),
  };
}

function getExpeditionSeed(activeExpeditionId: string | null, themeId: ThemeId): string {
  if (process.env.NEXT_PUBLIC_E2E === '1' && typeof window !== 'undefined') {
    const requestedSeed = new URLSearchParams(window.location.search).get('seed')?.trim();
    if (requestedSeed) return requestedSeed;
  }
  return activeExpeditionId ?? `${themeId}-expedition`;
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function stableAngle(value: string): number {
  const sum = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return (sum % 25) - 12;
}

declare global {
  interface Window {
    __STARSHIP_E2E__?: Readonly<{
      readonly inputReady: boolean;
      seed: string;
      themeId: ThemeId;
      cells: Array<Array<{ walkable: boolean; surface: FootstepSurface; zoneId: string | null }>>;
      player: Point;
      extraction: Point;
      entities: Array<{
        id: string;
        kind: PlacedEntity['kind'];
        position: Point;
        blocksMovement: boolean;
      }>;
      vault: { id: string; position: Point; clueId: string };
    }>;
  }
}
