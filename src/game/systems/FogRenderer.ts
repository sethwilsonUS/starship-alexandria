import { FOV_RADIUS, MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from '@/config/gameConfig';
import { TILE } from '@/data/tilesets';

/** Deep blue-black rather than pure black so the void reads as night, not dead pixels. */
const UNEXPLORED_COLOR = 0x05080f;
const UNEXPLORED_ALPHA = 0.97;
const UNEXPLORED_EDGE_ALPHA = 0.88;

/** Explored-but-unseen tiles keep a dim, cool "memory" of the map. */
const EXPLORED_COLOR = 0x0a1424;
const EXPLORED_ALPHA = 0.58;
const EXPLORED_EDGE_ALPHA = 0.44;

/** Fraction of the FOV radius where light starts falling off toward darkness. */
const FALLOFF_START = 0.55;
const FALLOFF_MAX_ALPHA = 0.42;

/** Faint warm wash on the tiles nearest the archivist — lantern light. */
const GLOW_COLOR = 0xffdfa8;
const GLOW_MAX_ALPHA = 0.05;

const WALL_OUTLINE_COLOR = 0xe8e4dc;
const WALL_OUTLINE_WIDTH = 4;

/** Layered strips under south-facing walls approximate a soft cast shadow. */
const WALL_SHADOW_STRIPS: ReadonlyArray<{ height: number; alpha: number }> = [
  { height: 6, alpha: 0.36 },
  { height: 5, alpha: 0.2 },
  { height: 4, alpha: 0.09 },
];

export class FogRenderer {
  private readonly wallShadow: Phaser.GameObjects.Graphics;
  private readonly wallOutline: Phaser.GameObjects.Graphics;
  private readonly fogOverlay: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly walls: number[][],
  ) {
    this.wallShadow = scene.add.graphics();
    this.wallShadow.setDepth(2.6);
    this.drawWallShadows();

    this.wallOutline = scene.add.graphics();
    this.wallOutline.setDepth(2.7);

    this.fogOverlay = scene.add.graphics();
    this.fogOverlay.setDepth(4);
  }

  render(visible: Set<string>, explored: Set<string>, origin: { x: number; y: number }): void {
    this.drawFog(visible, explored, origin);
    this.drawWallOutlines(visible);
  }

  destroy(): void {
    this.wallShadow.destroy();
    this.wallOutline.destroy();
    this.fogOverlay.destroy();
  }

  private drawFog(visible: Set<string>, explored: Set<string>, origin: { x: number; y: number }): void {
    this.fogOverlay.clear();

    for (let ty = 0; ty < MAP_HEIGHT; ty++) {
      for (let tx = 0; tx < MAP_WIDTH; tx++) {
        const coord = `${tx},${ty}`;
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        if (visible.has(coord)) {
          this.drawVisibleTile(px, py, tx, ty, origin);
          continue;
        }

        // Tiles bordering the lit area get lighter fog so the edge of sight
        // feathers instead of ending in a hard cliff.
        const softened = this.bordersVisible(tx, ty, visible);
        if (explored.has(coord)) {
          this.fogOverlay.fillStyle(EXPLORED_COLOR, softened ? EXPLORED_EDGE_ALPHA : EXPLORED_ALPHA);
        } else {
          this.fogOverlay.fillStyle(UNEXPLORED_COLOR, softened ? UNEXPLORED_EDGE_ALPHA : UNEXPLORED_ALPHA);
        }
        this.fogOverlay.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /** Visible tiles darken toward the edge of the light and warm slightly near its center. */
  private drawVisibleTile(px: number, py: number, tx: number, ty: number, origin: { x: number; y: number }): void {
    const distance = Math.hypot(tx - origin.x, ty - origin.y) / FOV_RADIUS;

    if (distance > FALLOFF_START) {
      const t = Math.min((distance - FALLOFF_START) / (1 - FALLOFF_START), 1);
      this.fogOverlay.fillStyle(UNEXPLORED_COLOR, FALLOFF_MAX_ALPHA * t * t);
      this.fogOverlay.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    const glow = GLOW_MAX_ALPHA * (1 - distance / FALLOFF_START);
    if (glow > 0.008) {
      this.fogOverlay.fillStyle(GLOW_COLOR, glow);
      this.fogOverlay.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  private bordersVisible(x: number, y: number, visible: Set<string>): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (visible.has(`${x + dx},${y + dy}`)) return true;
      }
    }
    return false;
  }

  /** Static pass: soft shadows on the floor below south-facing walls. */
  private drawWallShadows(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!this.isWall(x, y) || this.isWall(x, y + 1) || y + 1 >= MAP_HEIGHT) continue;

        const px = x * TILE_SIZE;
        let py = (y + 1) * TILE_SIZE;
        for (const strip of WALL_SHADOW_STRIPS) {
          this.wallShadow.fillStyle(0x000000, strip.alpha);
          this.wallShadow.fillRect(px, py, TILE_SIZE, strip.height);
          py += strip.height;
        }
      }
    }
  }

  /**
   * Draw light borders along wall edges only when the adjacent floor tile is visible.
   */
  private drawWallOutlines(visible: Set<string>): void {
    const floorVisible = (x: number, y: number) => visible.has(`${x},${y}`);

    this.wallOutline.clear();
    this.wallOutline.lineStyle(WALL_OUTLINE_WIDTH, WALL_OUTLINE_COLOR, 1);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!this.isWall(x, y)) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (!this.isWall(x - 1, y) && floorVisible(x - 1, y)) {
          this.wallOutline.lineBetween(px, py, px, py + TILE_SIZE);
        }
        if (!this.isWall(x + 1, y) && floorVisible(x + 1, y)) {
          this.wallOutline.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
        }
        if (!this.isWall(x, y - 1) && floorVisible(x, y - 1)) {
          this.wallOutline.lineBetween(px, py, px + TILE_SIZE, py);
        }
        if (!this.isWall(x, y + 1) && floorVisible(x, y + 1)) {
          this.wallOutline.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
        }
      }
    }
  }

  private isWall(x: number, y: number): boolean {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;

    const tile = this.walls[y]?.[x];
    return tile === TILE.WALL || tile === TILE.RUBBLE;
  }
}
