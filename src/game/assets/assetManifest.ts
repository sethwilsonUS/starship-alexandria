export const ASSET_KEYS = {
  tileset: 'tileset',
  sprites: {
    player: 'player',
    npc: 'npc',
    book: 'book-pickup',
    journal: 'journal-pickup',
    battery: 'battery-pickup',
    map: 'map-pickup',
    transporter: 'transporter-pad',
    vault: 'vault',
  },
} as const;

export interface ImageAsset {
  key: string;
  path: string;
}

export const IMAGE_ASSETS: ImageAsset[] = [
  { key: ASSET_KEYS.tileset, path: '/game-assets/tiles/library-tiles.png' },
  { key: ASSET_KEYS.sprites.player, path: '/game-assets/sprites/player.png' },
  { key: ASSET_KEYS.sprites.npc, path: '/game-assets/sprites/npc.png' },
  { key: ASSET_KEYS.sprites.book, path: '/game-assets/sprites/book-pickup.png' },
  { key: ASSET_KEYS.sprites.journal, path: '/game-assets/sprites/journal-pickup.png' },
  { key: ASSET_KEYS.sprites.battery, path: '/game-assets/sprites/battery-pickup.png' },
  { key: ASSET_KEYS.sprites.map, path: '/game-assets/sprites/map-pickup.png' },
  { key: ASSET_KEYS.sprites.transporter, path: '/game-assets/sprites/transporter-pad.png' },
  { key: ASSET_KEYS.sprites.vault, path: '/game-assets/sprites/vault.png' },
];

export function preloadGameAssets(scene: Phaser.Scene): void {
  for (const asset of IMAGE_ASSETS) {
    scene.load.image(asset.key, asset.path);
  }
}
