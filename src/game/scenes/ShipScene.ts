import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync } from '@/data/books';
import { transitionGuard } from '@/game/input/gameInput';
import { FxController } from '../systems/FxController';
import { ASSET_KEYS } from '@/game/assets/assetManifest';
import type { SavedThemeId } from '@/store/saveMigration';
import { playCue, startAmbience } from '@/game/audio/AudioDirector';
import { shouldUseMotion } from '@/game/motionPolicy';

const BEAM_DOWN_INPUT_BLOCK_MS = 700;

/**
 * ShipScene: The Starship Alexandria library deck.
 * A cozy interior where players return after expeditions.
 * The library shelf UI is rendered via React (LibraryShelf.tsx).
 */
export default class ShipScene extends Scene {
  private beamDownListener: ((payload: { themeId: SavedThemeId }) => void) | null = null;
  private launchAcceptedListener: (() => void) | null = null;
  private fx!: FxController;
  private hasShownVictory = false;
  private isBeamingDown = false;

  constructor() {
    super({ key: 'ShipScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.fx = new FxController(this);
    
    // Fade in from beam-up when decorative motion is enabled.
    if (this.shouldAnimate()) this.cameras.main.fadeIn(500, 30, 30, 46);
    
    // Draw ship interior background (procedural for now)
    this.drawShipInterior(width, height);
    this.placeShipProps(width, height);
    
    // Listen for beam-down request from React UI
    this.beamDownListener = ({ themeId }) => {
      // Only beam down if not in reading phase
      const gamePhase = useGameStore.getState().session.gamePhase;
      if (gamePhase === 'reading' || gamePhase === 'dialogue') return;
      this.beamDown(themeId);
    };
    EventBridge.on('beam-down-requested', this.beamDownListener);
    this.events.once('shutdown', () => this.cleanupOnShutdown());
    
    // Emit area-entered for accessibility
    EventBridge.emit('area-entered', { areaName: 'Starship Alexandria - Library Deck' });
    
    // Check if first-time player and show welcome
    this.launchAcceptedListener = () => this.beginShipExperience();
    EventBridge.on('launch-accepted', this.launchAcceptedListener);
    if (!useGameStore.getState().session.launchGateOpen) this.beginShipExperience();
  }

  private beginShipExperience(): void {
    startAmbience(this, ASSET_KEYS.audio.ambience.ship);
    this.showArrivalDialogue();
  }
  
  private isGameComplete(): boolean {
    const library = useGameStore.getState().library;
    try {
      const catalog = getBookCatalogSync();
      const totalFragments = catalog.reduce((sum, book) => sum + book.fragments.length, 0);
      return library.length >= totalFragments && totalFragments > 0;
    } catch {
      return false;
    }
  }
  
  private drawShipInterior(width: number, height: number): void {
    const bg = this.add.graphics();
    
    // Floor - warm wood tones
    bg.fillStyle(0x3d2817, 1);
    bg.fillRect(0, 0, width, height);
    
    // Wood plank pattern
    bg.fillStyle(0x4a3020, 0.3);
    for (let y = 0; y < height; y += 40) {
      bg.fillRect(0, y, width, 2);
    }
    for (let x = 0; x < width; x += 120) {
      const offset = (Math.floor(x / 120) % 2) * 60;
      for (let y = offset; y < height; y += 80) {
        bg.fillRect(x, y, 2, 40);
      }
    }
    
    // Walls (darker)
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, width, 130);
    bg.fillStyle(0x2a2a3e, 1);
    bg.fillRect(0, 125, width, 8);
    
    // Viewport (window to space)
    const viewportX = width / 2 - 150;
    const viewportY = 20;
    const viewportW = 300;
    const viewportH = 100;
    
    // Space background
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRoundedRect(viewportX, viewportY, viewportW, viewportH, 8);
    
    // Stars
    bg.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 30; i++) {
      const sx = viewportX + 10 + ((i * 73 + 29) % (viewportW - 20));
      const sy = viewportY + 10 + ((i * 47 + 11) % (viewportH - 20));
      const size = i % 4 === 0 ? 2 : 1;
      bg.fillCircle(sx, sy, size);
    }
    
    // Earth (small, distant)
    bg.fillStyle(0x4477aa, 0.6);
    bg.fillCircle(viewportX + viewportW - 40, viewportY + 30, 15);
    bg.fillStyle(0x335588, 0.4);
    bg.fillCircle(viewportX + viewportW - 35, viewportY + 28, 8);
    
    // Viewport frame
    bg.lineStyle(4, 0x5a5a7a, 1);
    bg.strokeRoundedRect(viewportX, viewportY, viewportW, viewportH, 8);
    
    // Bookshelves on sides (silhouettes for atmosphere - actual shelves in React UI)
    bg.fillStyle(0x2d1f12, 1);
    bg.fillRect(30, 150, 80, height - 200);
    bg.fillRect(width - 110, 150, 80, height - 200);
    
    // Shelf lines
    bg.fillStyle(0x3d2817, 0.5);
    for (let y = 180; y < height - 100; y += 50) {
      bg.fillRect(32, y, 76, 4);
      bg.fillRect(width - 108, y, 76, 4);
    }
    
    // Warm ambient light circles
    bg.fillStyle(0xffcc66, 0.05);
    bg.fillCircle(width / 2, height / 2, 300);
    bg.fillCircle(150, 300, 150);
    bg.fillCircle(width - 150, 300, 150);
    
    bg.setDepth(-1);
  }

  private placeShipProps(width: number, height: number): void {
    const leftShelf = this.add.image(70, height / 2 + 20, ASSET_KEYS.sprites.bookshelfProp);
    leftShelf.setScale(2.8);
    leftShelf.setDepth(0);
    leftShelf.setAlpha(0.88);

    const rightShelf = this.add.image(width - 70, height / 2 + 20, ASSET_KEYS.sprites.bookshelfProp);
    rightShelf.setScale(2.8);
    rightShelf.setDepth(0);
    rightShelf.setAlpha(0.88);

    const terminal = this.add.image(width / 2, 165, ASSET_KEYS.sprites.shipTerminalProp);
    terminal.setScale(2.2);
    terminal.setDepth(1);
    terminal.setAlpha(0.95);

    if (this.shouldAnimate()) {
      this.tweens.add({
        targets: terminal,
        alpha: 0.74,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  
  private showArrivalDialogue(): void {
    const hasSeenWelcome = useGameStore.getState().hasSeenWelcome;
    if (!hasSeenWelcome) {
      this.time.delayedCall(180, () => EventBridge.emit('show-welcome'));
    } else if (this.isGameComplete() && !this.hasShownVictory) {
      this.hasShownVictory = true;
      this.time.delayedCall(300, () => EventBridge.emit('show-victory'));
    }
  }

  private beamDown(themeId: SavedThemeId): void {
    if (this.isBeamingDown) return;
    this.isBeamingDown = true;
    transitionGuard.beginTransition(Date.now(), BEAM_DOWN_INPUT_BLOCK_MS);
    playCue(this, ASSET_KEYS.audio.cues.transporter, 0.55);

    const finish = () => {
      // Generate new map ID
      const mapId = `earth-expedition-${Date.now()}`;
      useGameStore.getState().actions.beamToSurface(mapId, themeId);
      this.scene.start('ExploreScene');
    };

    if (!this.shouldAnimate()) {
      finish();
      return;
    }

    const duration = 600;
    this.fx.playScreenBeam(0x5cb3ff, duration);
    this.cameras.main.fadeOut(400, 92, 180, 255);
    this.time.delayedCall(duration, finish);
  }

  private shouldAnimate(): boolean {
    return shouldUseMotion(useGameStore.getState().settings.motionPreference);
  }

  private cleanupOnShutdown(): void {
    this.fx?.destroy();
    if (this.beamDownListener) {
      EventBridge.off('beam-down-requested', this.beamDownListener);
      this.beamDownListener = null;
    }
    if (this.launchAcceptedListener) {
      EventBridge.off('launch-accepted', this.launchAcceptedListener);
      this.launchAcceptedListener = null;
    }
    this.isBeamingDown = false;
  }
}
