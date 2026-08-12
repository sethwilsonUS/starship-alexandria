import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync } from '@/data/books';
import { transitionGuard } from '@/game/input/gameInput';
import { FxController } from '../systems/FxController';
import { ASSET_KEYS } from '@/game/assets/assetManifest';
import type { SavedThemeId } from '@/store/saveMigration';
import { playCue, startAmbience, startMusic } from '@/game/audio/AudioDirector';
import { shouldUseMotion } from '@/game/motionPolicy';

/** Covers the full animated departure (beam column 1000ms) plus a small margin. */
const BEAM_DOWN_INPUT_BLOCK_MS = 1150;

/** Deterministic 0..1 stream for scatter placement — keeps renders reproducible. */
const unit = (index: number, salt: number): number => ((index * 73 + salt * 37 + 29) % 97) / 97;

/** Muted book-spine palette for the progress shelves. */
const SPINE_COLORS = [0xa8623a, 0x8a4b45, 0x4a6b8a, 0x6b8a4a, 0xc9a35f, 0x72533c] as const;

const VIEWPORT = { w: 300, h: 100, y: 20 } as const;
const SHELF_TOP = 150;
const SHELF_WIDTH = 80;
const SHELF_LINE_START = 180;
const SHELF_LINE_STEP = 50;

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
  private padOrigin = { x: 0, y: 0 };

  constructor() {
    super({ key: 'ShipScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.fx = new FxController(this);

    // Fade in from beam-up when decorative motion is enabled.
    if (this.shouldAnimate()) this.cameras.main.fadeIn(500, 30, 30, 46);

    this.drawShipInterior(width, height);
    this.createViewportStarfield(width);
    this.createLibraryProgress(width, height);
    this.createTransporterPad(width, height);
    this.placeShipProps(width, height);
    this.createDustMotes(width, height);

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

    // Any beam-up block was a ceiling for the animated transition; the deck is live.
    transitionGuard.release();
  }

  private beginShipExperience(): void {
    startAmbience(this, ASSET_KEYS.audio.ambience.ship);
    startMusic(this, ASSET_KEYS.audio.music.ship);
    this.showCompletionDialogue();
  }

  private isGameComplete(): boolean {
    const { collected, total } = this.libraryProgress();
    return total > 0 && collected >= total;
  }

  private libraryProgress(): { collected: number; total: number } {
    const library = useGameStore.getState().library;
    try {
      const catalog = getBookCatalogSync();
      const total = catalog.reduce((sum, book) => sum + book.fragments.length, 0);
      return { collected: Math.min(library.length, total), total };
    } catch {
      return { collected: library.length, total: 0 };
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

    // Viewport (window to space) — stars live in their own parallax layers.
    const viewportX = width / 2 - VIEWPORT.w / 2;
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRoundedRect(viewportX, VIEWPORT.y, VIEWPORT.w, VIEWPORT.h, 8);

    // Earth (small, distant)
    bg.fillStyle(0x4477aa, 0.6);
    bg.fillCircle(viewportX + VIEWPORT.w - 40, VIEWPORT.y + 30, 15);
    bg.fillStyle(0x335588, 0.4);
    bg.fillCircle(viewportX + VIEWPORT.w - 35, VIEWPORT.y + 28, 8);

    // Viewport frame
    bg.lineStyle(4, 0x5a5a7a, 1);
    bg.strokeRoundedRect(viewportX, VIEWPORT.y, VIEWPORT.w, VIEWPORT.h, 8);

    // Bookshelves on sides (silhouettes for atmosphere - actual shelves in React UI)
    bg.fillStyle(0x2d1f12, 1);
    bg.fillRect(30, SHELF_TOP, SHELF_WIDTH, height - 200);
    bg.fillRect(width - 110, SHELF_TOP, SHELF_WIDTH, height - 200);

    // Shelf lines
    bg.fillStyle(0x3d2817, 0.5);
    for (let y = SHELF_LINE_START; y < height - 100; y += SHELF_LINE_STEP) {
      bg.fillRect(32, y, 76, 4);
      bg.fillRect(width - 108, y, 76, 4);
    }

    // Warm ambient light pools
    bg.fillStyle(0xffcc66, 0.05);
    bg.fillCircle(width / 2, height / 2, 300);
    bg.fillCircle(150, 300, 150);
    bg.fillCircle(width - 150, 300, 150);

    bg.setDepth(-1);
  }

  /**
   * Two star layers drifting at different speeds behind the viewport glass.
   * No mask: geometry masks are unsupported in Phaser 4 WebGL, so stars are
   * placed with enough inset (14px) that the ±10px parallax drift can never
   * carry one outside the window frame.
   */
  private createViewportStarfield(width: number): void {
    const viewportX = width / 2 - VIEWPORT.w / 2;

    const drawStars = (count: number, salt: number, size: number, alpha: number) => {
      const layer = this.add.graphics().setDepth(-0.5);
      layer.fillStyle(0xffffff, alpha);
      for (let i = 0; i < count; i++) {
        const sx = viewportX + 14 + unit(i, salt) * (VIEWPORT.w - 28);
        const sy = VIEWPORT.y + 12 + unit(i, salt + 3) * (VIEWPORT.h - 24);
        layer.fillCircle(sx, sy, i % 4 === 0 ? size + 1 : size);
      }
      return layer;
    };

    const far = drawStars(18, 1, 1, 0.55);
    const near = drawStars(9, 2, 1.5, 0.9);

    if (this.shouldAnimate()) {
      this.tweens.add({ targets: far, x: 6, duration: 11000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: near, x: -10, duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: near, alpha: 0.7, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /**
   * The shelves fill with recovered book spines and glow warmer as the
   * library grows — the collection is visible in the room itself.
   */
  private createLibraryProgress(width: number, height: number): void {
    const { collected, total } = this.libraryProgress();
    const progress = total > 0 ? collected / total : 0;

    const glow = this.add.graphics().setDepth(-0.4);
    glow.fillStyle(0xffcc66, 0.04 + 0.18 * progress);
    glow.fillCircle(70, height / 2, 130);
    glow.fillCircle(width - 70, height / 2, 130);

    const spines = this.add.graphics().setDepth(-0.3);
    const shelfLeft = [34, width - 106];
    for (let i = 0; i < collected; i++) {
      const shelf = i % 2;
      const slot = Math.floor(i / 2);
      const row = Math.floor(slot / 6);
      const col = slot % 6;
      const lineY = SHELF_LINE_START + row * SHELF_LINE_STEP;
      if (lineY >= height - 100) break;

      const spineHeight = 22 + unit(i, 5) * 8;
      const x = shelfLeft[shelf] + col * 12 + unit(i, 9) * 3;
      spines.fillStyle(SPINE_COLORS[i % SPINE_COLORS.length], 0.95);
      spines.fillRect(x, lineY - spineHeight, 7, spineHeight);
      spines.fillStyle(0xf5ecd5, 0.25);
      spines.fillRect(x + 1, lineY - spineHeight + 3, 5, 2);
    }
  }

  /** The transporter alcove the departure beam fires from. */
  private createTransporterPad(width: number, height: number): void {
    this.padOrigin = { x: width / 2, y: height - 96 };
    const pad = this.add.graphics().setDepth(-0.4);

    pad.fillStyle(0x2a3a4a, 1);
    pad.fillEllipse(this.padOrigin.x, this.padOrigin.y, 156, 48);
    pad.fillStyle(0x16222e, 1);
    pad.fillEllipse(this.padOrigin.x, this.padOrigin.y, 116, 32);
    pad.lineStyle(2, 0x5cb3ff, 0.5);
    pad.strokeEllipse(this.padOrigin.x, this.padOrigin.y, 156, 48);

    // Emitter studs around the rim
    pad.fillStyle(0x5ed9d0, 0.9);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      pad.fillCircle(
        this.padOrigin.x + Math.cos(angle) * 70,
        this.padOrigin.y + Math.sin(angle) * 20,
        2.5,
      );
    }

    const glow = this.add.graphics().setDepth(-0.35);
    glow.fillStyle(0x5ed9d0, 0.1);
    glow.fillEllipse(this.padOrigin.x, this.padOrigin.y, 132, 36);
    if (this.shouldAnimate()) {
      this.tweens.add({ targets: glow, alpha: 0.45, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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

  /** Slow warm dust motes drifting through the lamplight. Decorative only. */
  private createDustMotes(width: number, height: number): void {
    if (!this.shouldAnimate()) return;

    for (let i = 0; i < 12; i++) {
      const mote = this.add.graphics().setDepth(2);
      mote.fillStyle(0xffe8b0, 1);
      mote.fillCircle(0, 0, 1.5);
      mote.setAlpha(0);
      mote.setPosition(40 + unit(i, 13) * (width - 80), 200 + unit(i, 17) * (height - 320));

      this.tweens.add({
        targets: mote,
        y: '-=70',
        duration: 9000 + unit(i, 19) * 5000,
        repeat: -1,
        ease: 'Linear',
      });
      this.tweens.add({
        targets: mote,
        alpha: 0.13,
        duration: 3500 + unit(i, 23) * 2000,
        yoyo: true,
        repeat: -1,
        delay: unit(i, 29) * 3000,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private showCompletionDialogue(): void {
    if (this.isGameComplete() && !this.hasShownVictory) {
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

    // Beam column rises from the transporter pad, then the deck fades away.
    this.fx.playBeamColumn(
      this.padOrigin,
      () => this.cameras.main.fadeOut(400, 92, 180, 255),
      finish,
    );
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
