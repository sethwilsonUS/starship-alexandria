/**
 * Phaser 4 createLayer can return a CPU TilemapLayer or a TilemapGPULayer.
 * This game currently relies on CPU layer collision/query behavior, so force
 * CPU layers and fail loudly if Phaser ever returns a GPU layer here.
 */
export function createCpuTilemapLayer(
  map: Phaser.Tilemaps.Tilemap,
  layerId: string | number,
  tileset: Phaser.Tilemaps.Tileset,
  x = 0,
  y = 0
): Phaser.Tilemaps.TilemapLayer {
  const layer = map.createLayer(layerId, tileset, x, y, false);

  if (!layer) {
    throw new Error(`Failed to create tilemap layer "${String(layerId)}"`);
  }

  if ('generateLayerDataTexture' in layer) {
    throw new Error(`Layer "${String(layerId)}" unexpectedly used TilemapGPULayer`);
  }

  return layer as Phaser.Tilemaps.TilemapLayer;
}
