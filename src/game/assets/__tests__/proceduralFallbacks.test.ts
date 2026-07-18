import { describe, expect, it, vi } from 'vitest';

import { THEME_TILESET_KEYS } from '../assetManifest';
import { ensureProceduralFallbackTextures } from '../proceduralFallbacks';

describe('procedural asset fallbacks', () => {
  it('generates a usable tileset for every registered expedition theme', () => {
    const tilesetKeys = Object.values(THEME_TILESET_KEYS);
    const missingTilesets = new Set<string>(tilesetKeys);
    const generatedKeys: string[] = [];
    const graphics = {
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      generateTexture: vi.fn((key: string) => generatedKeys.push(key)),
      destroy: vi.fn(),
    };
    const scene = {
      textures: {
        exists: vi.fn((key: string) => !missingTilesets.has(key)),
      },
      add: { graphics: vi.fn(() => graphics) },
    } as unknown as Phaser.Scene;

    ensureProceduralFallbackTextures(scene);

    expect(generatedKeys).toEqual(tilesetKeys);
  });
});
