import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';

import { TILE } from '@/data/tilesets';
import { ASSET_KEYS, AUDIO_ASSETS, FONT_ASSETS, IMAGE_ASSETS } from '../assetManifest';

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const TILE_SIZE = 32;
const TILE_PIXELS = TILE_SIZE * TILE_SIZE;

async function countFullyOpaqueTilePixels(tilesetPath: string, tileIndex: number): Promise<number> {
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

    const tilesetKeys = new Set(Object.values(ASSET_KEYS.tilesets));
    expect(assetDimensions).toEqual(
      IMAGE_ASSETS.map((asset) =>
        tilesetKeys.has(asset.key as (typeof ASSET_KEYS.tilesets)[keyof typeof ASSET_KEYS.tilesets])
          ? { key: asset.key, width: 128, height: 96, format: 'png' }
          : { key: asset.key, width: 32, height: 32, format: 'png' }
      )
    );
  });

  test('keeps blocking wall tiles visually filled in every theme', async () => {
    const tilesets = IMAGE_ASSETS.filter((asset) => asset.path.includes('/tiles/'));
    for (const tileset of tilesets) {
      const tilesetPath = path.join(PUBLIC_ROOT, tileset.path.replace(/^\//, ''));
      await expect(countFullyOpaqueTilePixels(tilesetPath, TILE.WALL)).resolves.toBe(TILE_PIXELS);
      await expect(countFullyOpaqueTilePixels(tilesetPath, TILE.RUBBLE)).resolves.toBe(TILE_PIXELS);
    }
  });

  test('ships local OGG/MP3 pairs and self-hosted fonts', () => {
    expect(new Set(AUDIO_ASSETS.map((asset) => asset.key)).size).toBe(AUDIO_ASSETS.length);
    for (const asset of AUDIO_ASSETS) {
      expect(asset.paths[0]).toMatch(/\.ogg$/);
      expect(asset.paths[1]).toMatch(/\.mp3$/);
      for (const assetPath of asset.paths) {
        expect(fs.existsSync(path.join(PUBLIC_ROOT, assetPath.replace(/^\//, ''))), assetPath).toBe(true);
      }
    }
    for (const asset of FONT_ASSETS) {
      expect(fs.existsSync(path.join(PUBLIC_ROOT, asset.path.replace(/^\//, ''))), asset.path).toBe(true);
    }
  });
});
