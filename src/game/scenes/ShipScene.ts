import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync } from '@/data/books';

/**
 * ShipScene: The Starship Alexandria library deck.
 * A cozy interior where players return after expeditions.
 * The library shelf UI is rendered via React (LibraryShelf.tsx).
 */
export default class ShipScene extends Scene {
  private beamDownListener: (() => void) | null = null;
  private hasShownVictory = false;

  constructor() {
    super({ key: 'ShipScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    
    // Fade in from beam-up
    this.cameras.main.fadeIn(500, 30, 30, 46);
    
    // Draw ship interior background (procedural for now)
    this.drawShipInterior(width, height);
    
    // Listen for beam-down request from React UI
    this.beamDownListener = () => {
      // Only beam down if not in reading phase
      const gamePhase = useGameStore.getState().session.gamePhase;
      if (gamePhase === 'reading' || gamePhase === 'dialogue') return;
      // Don't allow beam down if game is complete
      if (this.isGameComplete()) return;
      this.beamDown();
    };
    EventBridge.on('beam-down-requested', this.beamDownListener);
    
    // Emit area-entered for accessibility
    EventBridge.emit('area-entered', { areaName: 'Starship Alexandria - Library Deck' });
    
    // Check if first-time player and show welcome
    const hasSeenWelcome = useGameStore.getState().hasSeenWelcome;
    if (!hasSeenWelcome) {
      // Delay slightly so UI is ready
      this.time.delayedCall(300, () => {
        EventBridge.emit('show-welcome');
      });
    } else if (this.isGameComplete() && !this.hasShownVictory) {
      // Show victory dialogue if all fragments collected
      this.hasShownVictory = true;
      this.time.delayedCall(500, () => {
        EventBridge.emit('show-victory');
      });
    }
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
      const sx = viewportX + 10 + Math.random() * (viewportW - 20);
      const sy = viewportY + 10 + Math.random() * (viewportH - 20);
      const size = Math.random() < 0.3 ? 2 : 1;
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
  
  private beamDown(): void {
    // Beam-down animation
    const { width, height } = this.cameras.main;
    
    const beamGraphics = this.add.graphics();
    beamGraphics.setDepth(100);
    
    let progress = 0;
    const duration = 600;
    
    const animate = () => {
      progress += 16;
      const t = Math.min(progress / duration, 1);
      
      beamGraphics.clear();
      beamGraphics.fillStyle(0x5cb3ff, 0.3 + t * 0.7);
      beamGraphics.fillRect(0, 0, width, height);
      
      if (progress < duration) {
        this.time.delayedCall(16, animate);
      }
    };
    
    animate();
    
    this.cameras.main.fadeOut(400, 92, 180, 255);
    
    this.time.delayedCall(duration, () => {
      // Generate new map ID
      const mapId = `earth-expedition-${Date.now()}`;
      useGameStore.getState().actions.beamToSurface(mapId);
      this.scene.start('ExploreScene');
    });
  }

  shutdown() {
    if (this.beamDownListener) {
      EventBridge.off('beam-down-requested', this.beamDownListener);
      this.beamDownListener = null;
    }
  }
}
