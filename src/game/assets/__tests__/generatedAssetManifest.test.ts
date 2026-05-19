import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';

import { TILE } from '@/data/tilesets';
import { ASSET_KEYS, IMAGE_ASSETS } from '../assetManifest';

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const TILE_SIZE = 32;
const TILE_PIXELS = TILE_SIZE * TILE_SIZE;

async function countFullyOpaqueTilePixels(tileIndex: number): Promise<number> {
  const tilesetPath = path.join(PUBLIC_ROOT, 'game-assets/tiles/library-tiles.png');
  const { data } = await sharp(tilesetPath)
    .extract({
      left: (tileIndex % 4) * TILE_SIZE,
      top: Math.floor(tileIndex / 4) * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let opaquePixels = 0;
  for (let alphaIndex = 3; alphaIndex < data.length; alphaIndex += 4) {
    if (data[alphaIndex] === 255) opaquePixels += 1;
  }
  return opaquePixels;
}

describe('generated game assets', () => {
  test('writes manifest images with the dimensions Phaser expects', async () => {
    const missingAssets = IMAGE_ASSETS
      .map((asset) => path.join(PUBLIC_ROOT, asset.path.replace(/^\//, '')))
      .filter((filePath) => !fs.existsSync(filePath));

    expect(missingAssets, 'missing manifest asset files').toEqual([]);

    const assetDimensions = await Promise.all(
      IMAGE_ASSETS.map(async (asset) => {
        const filePath = path.join(PUBLIC_ROOT, asset.path.replace(/^\//, ''));
        const metadata = await sharp(filePath).metadata();

        return {
          key: asset.key,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        };
      })
    );

    expect(assetDimensions).toEqual(
      IMAGE_ASSETS.map((asset) =>
        asset.key === ASSET_KEYS.tileset
          ? { key: asset.key, width: 128, height: 96, format: 'png' }
          : { key: asset.key, width: 32, height: 32, format: 'png' }
      )
    );
  });

  test('keeps blocking wall tiles visually filled', async () => {
    await expect(countFullyOpaqueTilePixels(TILE.WALL)).resolves.toBe(TILE_PIXELS);
    await expect(countFullyOpaqueTilePixels(TILE.RUBBLE)).resolves.toBe(TILE_PIXELS);
  });
});
