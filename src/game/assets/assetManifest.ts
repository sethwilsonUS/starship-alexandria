export const ASSET_KEYS = {
  /** Compatibility alias for the original scriptorium/library atlas. */
  tileset: 'tileset',
  tilesets: {
    scriptorium: 'tileset',
    cathedral: 'tileset-cathedral',
    university: 'tileset-university',
    gardens: 'tileset-gardens',
  },
  sprites: {
    player: 'player',
    npc: 'npc',
    book: 'book-pickup',
    journal: 'journal-pickup',
    map: 'map-pickup',
    transporter: 'transporter-pad',
    vault: 'vault',
    bookshelfProp: 'bookshelf-prop',
    paperDebrisProp: 'paper-debris-prop',
    shipTerminalProp: 'ship-terminal-prop',
  },
  audio: {
    footsteps: {
      stone: ['footstep-stone-1', 'footstep-stone-2'],
      dirt: ['footstep-dirt-1', 'footstep-dirt-2'],
      sand: ['footstep-sand-1', 'footstep-sand-2'],
      water: ['footstep-water-1', 'footstep-water-2'],
      gear: ['footstep-gear-1', 'footstep-gear-2'],
    },
    cues: {
      pageTurn: ['page-turn-1', 'page-turn-2'],
      bookOpen: 'book-open',
      vaultOpen: 'vault-open',
      uiConfirm: 'ui-confirm',
      uiSelect: 'ui-select',
      uiClose: 'ui-close',
      transporter: 'transporter',
    },
    ambience: {
      ship: 'ship-engine',
      ruins: 'ambience-ruins',
      gardens: 'ambience-gardens',
      byTheme: {
        scriptorium: 'ambience-ruins',
        cathedral: 'ambience-ruins',
        university: 'ambience-ruins',
        gardens: 'ambience-gardens',
      },
    },
    music: {
      ship: 'music-ship',
    },
  },
} as const;

export const THEME_TILESET_KEYS = ASSET_KEYS.tilesets;

export interface ImageAsset {
  key: string;
  path: string;
}

export interface AudioAsset {
  key: string;
  paths: readonly [ogg: string, mp3: string];
}

export interface FontAsset {
  family: 'Atkinson Hyperlegible' | 'Literata';
  path: string;
  weight: string;
}

export const IMAGE_ASSETS: ImageAsset[] = [
  { key: ASSET_KEYS.tilesets.scriptorium, path: '/game-assets/tiles/scriptorium-tiles.png' },
  { key: ASSET_KEYS.tilesets.cathedral, path: '/game-assets/tiles/cathedral-tiles.png' },
  { key: ASSET_KEYS.tilesets.university, path: '/game-assets/tiles/university-tiles.png' },
  { key: ASSET_KEYS.tilesets.gardens, path: '/game-assets/tiles/gardens-tiles.png' },
  { key: ASSET_KEYS.sprites.player, path: '/game-assets/sprites/player.png' },
  { key: ASSET_KEYS.sprites.npc, path: '/game-assets/sprites/npc.png' },
  { key: ASSET_KEYS.sprites.book, path: '/game-assets/sprites/book-pickup.png' },
  { key: ASSET_KEYS.sprites.journal, path: '/game-assets/sprites/journal-pickup.png' },
  { key: ASSET_KEYS.sprites.map, path: '/game-assets/sprites/map-pickup.png' },
  { key: ASSET_KEYS.sprites.transporter, path: '/game-assets/sprites/transporter-pad.png' },
  { key: ASSET_KEYS.sprites.vault, path: '/game-assets/sprites/vault.png' },
  { key: ASSET_KEYS.sprites.bookshelfProp, path: '/game-assets/sprites/bookshelf-prop.png' },
  { key: ASSET_KEYS.sprites.paperDebrisProp, path: '/game-assets/sprites/paper-debris-prop.png' },
  { key: ASSET_KEYS.sprites.shipTerminalProp, path: '/game-assets/sprites/ship-terminal-prop.png' },
];

const pairedAudio = (key: string, folder: 'footsteps' | 'cues' | 'ambience' | 'music', file: string): AudioAsset => ({
  key,
  paths: [`/game-assets/audio/${folder}/${file}.ogg`, `/game-assets/audio/${folder}/${file}.mp3`],
});

export const AUDIO_ASSETS: AudioAsset[] = [
  pairedAudio(ASSET_KEYS.audio.footsteps.stone[0], 'footsteps', 'stone-1'),
  pairedAudio(ASSET_KEYS.audio.footsteps.stone[1], 'footsteps', 'stone-2'),
  pairedAudio(ASSET_KEYS.audio.footsteps.dirt[0], 'footsteps', 'dirt-1'),
  pairedAudio(ASSET_KEYS.audio.footsteps.dirt[1], 'footsteps', 'dirt-2'),
  pairedAudio(ASSET_KEYS.audio.footsteps.sand[0], 'footsteps', 'sand-1'),
  pairedAudio(ASSET_KEYS.audio.footsteps.sand[1], 'footsteps', 'sand-2'),
  pairedAudio(ASSET_KEYS.audio.footsteps.water[0], 'footsteps', 'water-1'),
  pairedAudio(ASSET_KEYS.audio.footsteps.water[1], 'footsteps', 'water-2'),
  pairedAudio(ASSET_KEYS.audio.footsteps.gear[0], 'footsteps', 'gear-1'),
  pairedAudio(ASSET_KEYS.audio.footsteps.gear[1], 'footsteps', 'gear-2'),
  pairedAudio(ASSET_KEYS.audio.cues.pageTurn[0], 'cues', 'page-turn-1'),
  pairedAudio(ASSET_KEYS.audio.cues.pageTurn[1], 'cues', 'page-turn-2'),
  pairedAudio(ASSET_KEYS.audio.cues.bookOpen, 'cues', 'book-open'),
  pairedAudio(ASSET_KEYS.audio.cues.vaultOpen, 'cues', 'vault-open'),
  pairedAudio(ASSET_KEYS.audio.cues.uiConfirm, 'cues', 'ui-confirm'),
  pairedAudio(ASSET_KEYS.audio.cues.uiSelect, 'cues', 'ui-select'),
  pairedAudio(ASSET_KEYS.audio.cues.uiClose, 'cues', 'ui-close'),
  pairedAudio(ASSET_KEYS.audio.cues.transporter, 'cues', 'transporter'),
  pairedAudio(ASSET_KEYS.audio.ambience.ship, 'ambience', 'ship-engine'),
  pairedAudio(ASSET_KEYS.audio.music.ship, 'music', 'music-ship'),
  pairedAudio(ASSET_KEYS.audio.ambience.ruins, 'ambience', 'ambience-ruins'),
  pairedAudio(ASSET_KEYS.audio.ambience.gardens, 'ambience', 'ambience-gardens'),
];

export const FONT_ASSETS: FontAsset[] = [
  {
    family: 'Atkinson Hyperlegible',
    path: '/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
    weight: '400',
  },
  {
    family: 'Atkinson Hyperlegible',
    path: '/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
    weight: '700',
  },
  {
    family: 'Literata',
    path: '/fonts/literata/Literata-Latin-Variable.woff2',
    weight: '200 900',
  },
];

export function preloadGameAssets(scene: Phaser.Scene): void {
  for (const asset of IMAGE_ASSETS) scene.load.image(asset.key, asset.path);
  for (const asset of AUDIO_ASSETS) scene.load.audio(asset.key, [...asset.paths]);
}
