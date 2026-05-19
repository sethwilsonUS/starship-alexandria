import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from '@/config/gameConfig';
import { TILE } from '@/data/tilesets';

const FOG_COLOR = 0x000000;
const WALL_OUTLINE_COLOR = 0xe8e4dc;
const WALL_OUTLINE_WIDTH = 4;

export class FogRenderer {
  private readonly wallOutline: Phaser.GameObjects.Graphics;
  private readonly fogOverlay: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly walls: number[][],
  ) {
    this.wallOutline = scene.add.graphics();
    this.wallOutline.setDepth(2.5);

    this.fogOverlay = scene.add.graphics();
    this.fogOverlay.setDepth(4);
  }

  render(visible: Set<string>, explored: Set<string>): void {
    this.drawFog(visible, explored);
    this.drawWallOutlines(visible);
  }

  destroy(): void {
    this.wallOutline.destroy();
    this.fogOverlay.destroy();
  }

  private drawFog(visible: Set<string>, explored: Set<string>): void {
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
