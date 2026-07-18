#!/usr/bin/env node

/**
 * Rebuild the committed runtime art, audio, and font bundle from pinned CC0/OFL
 * sources. The game never fetches these files at runtime.
 *
 * Source roots can be overridden for another maintainer checkout:
 *   KENNEY_ROOT=/path/to/kenney BEOWULF_ROOT=/path/to/beowulf npm run import-external-assets
 */

import { execFile as execFileCallback } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFile = promisify(execFileCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const KENNEY_ROOT = path.resolve(process.env.KENNEY_ROOT ?? path.join(os.homedir(), 'dev', 'kenney'));
const BEOWULF_ROOT = path.resolve(process.env.BEOWULF_ROOT ?? path.join(os.homedir(), 'dev', 'beowulf'));
const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_ROOT, 'game-assets');
const MANIFEST_PATH = path.join(OUTPUT_ROOT, 'manifest.json');

const TILE_SIZE = 32;
const SOURCE_TILE_SIZE = 16;
const TILE_SPACING = 1;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const CC0 = 'CC0-1.0';
const OFL = 'OFL-1.1';

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const SOURCE_CATALOG = {
  kenneyRoguelike: {
    owner: 'Kenney',
    title: 'Roguelike/RPG Pack',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/roguelike-rpg-pack',
    archiveUrl:
      'https://www.kenney.nl/media/pages/assets/roguelike-rpg-pack/12c03cd78b-1677697420/kenney_roguelike-rpg-pack.zip',
    root: 'kenney',
    relativePath: '2D assets/Roguelike Base Pack/Spritesheet/roguelikeSheet_transparent.png',
    sha256: '4709d89e4d3f2e0ede6b0959d555a97b48b0513a70076caa4d0943dabe8c33cc',
    grid: { columns: 57, rows: 31 },
  },
  kenneyDungeon: {
    owner: 'Kenney',
    title: 'Roguelike Caves & Dungeons',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/roguelike-caves-dungeons',
    archiveUrl:
      'https://www.kenney.nl/media/pages/assets/roguelike-caves-dungeons/5195ceb8ca-1677694831/kenney_roguelike-caves-dungeons.zip',
    root: 'kenney',
    relativePath: '2D assets/Roguelike Dungeon Pack/Spritesheet/roguelikeDungeon_transparent.png',
    sha256: '508b4ab4929f1d79e3376b0201eb28f5e8f7f974edc7b96d420edc192f74888c',
    grid: { columns: 29, rows: 18 },
  },
  kenneyModernCity: {
    owner: 'Kenney',
    title: 'Roguelike Modern City',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/roguelike-modern-city',
    archiveUrl:
      'https://www.kenney.nl/media/pages/assets/roguelike-modern-city/0ff3dfff2b-1677694743/kenney_roguelike-modern-city.zip',
    root: 'kenney',
    relativePath: '2D assets/Roguelike City Pack/Tilemap/tilemap.png',
    sha256: 'e7791156bfe5fd238a698e900ca5c749dec49c8f58b0c570af2f288ced34500c',
    grid: { columns: 37, rows: 28 },
  },
  kenneyUrban: {
    owner: 'Kenney',
    title: 'RPG Urban Pack',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/rpg-urban-pack',
    archiveUrl:
      'https://www.kenney.nl/media/pages/assets/rpg-urban-pack/0a097d1dc7-1677578575/kenney_rpg-urban-pack.zip',
    root: 'kenney',
    relativePath: '2D assets/RPG Urban Pack/Tilemap/tilemap.png',
    sha256: 'c2a4b6c58587a39cef78553347d6d2b51ec6820efb9945fd548c68a0b50cafe0',
    grid: { columns: 27, rows: 18 },
  },
  kenneyTinyDungeon: {
    owner: 'Kenney',
    title: 'Tiny Dungeon',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/tiny-dungeon',
    archiveUrl:
      'https://www.kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip',
    root: 'kenney',
    relativePath: '2D assets/Tiny Dungeon/Tilemap/tilemap.png',
    sha256: '5653222ac495d89e942f9b636300759b3f38e85b26e9b888676f2e9ab834095a',
    grid: { columns: 12, rows: 11 },
  },
  kenneyInterface: {
    owner: 'Kenney',
    title: 'Interface Sounds',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/interface-sounds',
  },
  kenneyScifi: {
    owner: 'Kenney',
    title: 'Sci-fi Sounds',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/sci-fi-sounds',
  },
  kenneyRpgAudio: {
    owner: 'Kenney',
    title: 'RPG Audio',
    license: CC0,
    pageUrl: 'https://www.kenney.nl/assets/rpg-audio',
  },
  fantozziFootsteps: {
    owner: 'Fantozzi (submitted by qubodup)',
    title: "Fantozzi's Footsteps (Grass/Sand & Stone)",
    license: CC0,
    pageUrl: 'https://opengameart.org/content/fantozzis-footsteps-grasssand-stone',
  },
  tinyWorldsFootsteps: {
    owner: 'TinyWorlds; source recordings from pdsounds',
    title: 'Different steps on wood, stone, leaves, gravel and mud',
    license: CC0,
    pageUrl: 'https://opengameart.org/node/5701',
  },
  peludoFootsteps: {
    owner: 'Peludo',
    title: 'Water Splash and sand footsteps',
    license: CC0,
    pageUrl: 'https://opengameart.org/content/water-splash-and-sand-footsteps',
  },
  haelDbFootsteps: {
    owner: 'HaelDB',
    title: 'Footsteps Leather, Cloth, Armor',
    license: CC0,
    pageUrl: 'https://opengameart.org/content/footsteps-leather-cloth-armor',
  },
  voltimentPageTurns: {
    owner: 'Voltiment555',
    title: 'Book Flip Sounds',
    license: CC0,
    pageUrl: 'https://opengameart.org/content/book-flip-sounds',
  },
  springSpringAmbience: {
    owner: 'Spring Spring; public-domain bird recordings credited by the author',
    title: 'Birds and Wind - Ambient, Birds, Wind and Synth',
    license: CC0,
    pageUrl: 'https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth',
  },
  jasinskiWaves: {
    owner: 'jasinski (submitted by qubodup)',
    title: 'Beach Ocean Waves',
    license: CC0,
    pageUrl: 'https://opengameart.org/content/beach-ocean-waves',
  },
  atkinson: {
    owner: 'Braille Institute of America',
    title: 'Atkinson Hyperlegible',
    license: OFL,
    pageUrl: 'https://github.com/googlefonts/atkinson-hyperlegible',
    revision: '1cb311624b2ddf88e9e37873999d165a8cd28b46',
  },
  literata: {
    owner: 'The Literata Project Authors / TypeTogether',
    title: 'Literata',
    license: OFL,
    pageUrl: 'https://github.com/googlefonts/literata',
  },
};

const BEOWULF_FILES = [
  ['stone-1', 'footsteps/fantozzi-stone-l1', 'fantozziFootsteps', '50939f401795fbe24c1f1c964706d16fba20b72b1c3c4ebc88e59287d3a37187', 'e9beaa8ca25bb68476b14970ec272516e39baeccac3eb4f4899a5d67440dee63'],
  ['stone-2', 'footsteps/fantozzi-stone-r1', 'fantozziFootsteps', '9765b807dc69e5d208773e3fa53d4c56dffa50028b73342ebed8ad25209b57ac', '92bb9253ce659e6070bcd47266da5bd886a18883dae9194b14a079a516987ad7'],
  ['dirt-1', 'footsteps/dirt-gravel', 'tinyWorldsFootsteps', '507fb2d1746f2b799995a5cc177447af277ed0073fe8585a105d27ec901e5dae', '54913ff0b356565e494d79f463bfcfdcac57b757c3b2417ce75328224b8b1c82'],
  ['dirt-2', 'footsteps/dirt-leaves-1', 'tinyWorldsFootsteps', 'bebee4f6d812500a78fb3f43fcccc1e48f97e6c354866a43cb9a3e45b35d383b', 'a2d490d171403f2b71a75793acb1d909eff66062a3027a31bb148ace81f5a399'],
  ['sand-1', 'footsteps/fantozzi-sand-l1', 'fantozziFootsteps', '18e2db5dd5e8e5e72a5604b1c0bd9a48dc119c02bcda78077b4f938f6d30e53b', '0e3f789edb3390e841679e09c98fe94cb8e9471c1e5b34f10f2f754e41e8d773'],
  ['sand-2', 'footsteps/fantozzi-sand-r1', 'fantozziFootsteps', '32490950dd804a4d92432f3cc13a59e34013001f7f3c493c7e35e2394fb570a8', '087b7385b056ca49f5832e333bf68bd23b5721b91b0aa8b324f979aaa36f2c2f'],
  ['water-1', 'footsteps/shallow-water-1', 'peludoFootsteps', 'c65db589153cdbb4da4c1f211fcd630fe534f5e278002b6b62f2f72db45529d3', '465f2b29dd4033e69627b6f068cb77c3c7d44155b9fb4db101b85492fc822c4c'],
  ['water-2', 'footsteps/shallow-water-2', 'peludoFootsteps', 'deecf58bc851e89a348f3060cacaccb8fc969c3a666dfed563c14c45488badaa', '8a71eb4f327c1a8b6f1d3166deab8c5927db42723acabedb027b3044aaa8ac7b'],
  ['gear-1', 'footsteps/gear-leather-1', 'haelDbFootsteps', '2ab9bbd412a9e9f78f420559d7b0024c2f3a7dafd2fe227efd124a4bd851860f', '138a95e6813a8ca678f4354e0d1eae1995cd79d0b0ca0f5e98f9ce5e94768a0d'],
  ['gear-2', 'footsteps/gear-leather-2', 'haelDbFootsteps', '22fc01f5f9c4a97a936139aa664db2899cb1efeb6d57f009e81db527b9046113', 'b5d555755daa0ca142f858b837185f7561f7735c91381b03a3c90212d7547445'],
  ['page-turn-1', 'study/page-turn-1', 'voltimentPageTurns', 'a842a9ebfe6b75328cd9b50dab1856f5e79dd48f3f3d8ab13b9711ddaaf15b7c', '42a64f503b8bba9844b1f5c94455079efbda1bdce86f5e8f63e3ae69fe66b19a'],
  ['page-turn-2', 'study/page-turn-2', 'voltimentPageTurns', 'bf97f6287217638fa581da9c5346cbe6f693ac75dbe659e321877ffae4088079', '50ba81068681516e66cffd7038647115939678f7d8f79510ca177e6c1a721f99'],
  ['book-open', 'cues/bookOpen', 'kenneyRpgAudio', '0f2e27a329ff7d06fc8932599a1db1aaddd5f0fd5abc913a6ec33c8c52190a0e', 'ea69743f3500f4e531822424399a56ce466729268c2ed0e294adfcdcc113f1a8'],
  ['vault-open', 'cues/handleSmallLeather', 'kenneyRpgAudio', 'a0ec5452293a521db0a137a7a550df1fb5f5d4ed78ed9ca15039ec0425feb0a8', '0fac8b9dd2ae6c3a50190dbf37f7a3fb4699f0f02e983b6c4b7d3163b320e014'],
  ['ambience-ruins', 'ambience/danish-shore-soundscape', 'springSpringAmbience', '44f8407235e320ecfb1c764dbc9a789ee28ad524c6ea99f3b66f7977ee30a081', '94aa57832f07a1bca4be51913ad4a7511e7fb5797fa7b14f94490e5cefceedef', 'ambience'],
  ['ambience-gardens', 'ambience/alki-beach-wave-loop', 'jasinskiWaves', '49488d935213587ed7da97cbf6f2e4262ed96a8efef2951aa1beeb116d5d6cb9', 'fef5dd39c5c4bb6a25cb9525ad2386d57499845e60319b01bced7743f89d9cd3', 'ambience'],
].map(([name, relativeStem, sourceId, oggHash, mp3Hash, category]) => ({
  name,
  relativeStem,
  sourceId,
  oggHash,
  mp3Hash,
  category,
}));

const KENNEY_AUDIO = [
  {
    name: 'ui-confirm',
    sourceId: 'kenneyInterface',
    relativePath: 'Audio/Interface Sounds/Audio/confirmation_001.ogg',
    sha256: '1d59821014076adf376ae092a556ff7ee4816f5532a8ae0719b6d44d244bfbc1',
  },
  {
    name: 'ui-select',
    sourceId: 'kenneyInterface',
    relativePath: 'Audio/Interface Sounds/Audio/select_001.ogg',
    sha256: '510deb19199cfbba6ee90c85b70ff00d429ee8437d5be196c2b2c7cfca01fc50',
  },
  {
    name: 'ui-close',
    sourceId: 'kenneyInterface',
    relativePath: 'Audio/Interface Sounds/Audio/close_001.ogg',
    sha256: 'c971de34787cd175c0847b511e7d1f73308aaee9508f3914991c2d098beeefc4',
  },
  {
    name: 'transporter',
    sourceId: 'kenneyScifi',
    relativePath: 'Audio/Sci-Fi Sounds/Audio/forceField_000.ogg',
    sha256: '63f31cbf6fd8b6387204ba5bbfdb29ca1889552faf7f30b419ead3f68e3be54e',
  },
  {
    name: 'ship-engine',
    sourceId: 'kenneyScifi',
    relativePath: 'Audio/Sci-Fi Sounds/Audio/spaceEngineLow_000.ogg',
    sha256: 'c741a87521746092d7fc7b2428b5208cf0655638100a77881a617b425ad240bc',
  },
];

const FONT_FILES = [
  {
    sourceId: 'atkinson',
    relativePath: 'atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
    output: 'fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
    sha256: '2df4ba17804bc7a36f123127966075d8427bff2df58d0d76820c1130bb1a4150',
    kind: 'font',
  },
  {
    sourceId: 'atkinson',
    relativePath: 'atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
    output: 'fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
    sha256: 'da8fce41a04f8498fbf79076f92d304b12e70c76f71b143c5dcfb6536c93c075',
    kind: 'font',
  },
  {
    sourceId: 'atkinson',
    relativePath: 'atkinson-hyperlegible/OFL.txt',
    output: 'fonts/atkinson-hyperlegible/OFL.txt',
    sha256: '64b9cae8727cb41ea9e8843103e69647c82383f3a902e2bb39b2c5d92083b6e1',
    kind: 'license',
  },
  {
    sourceId: 'literata',
    relativePath: 'literata/Literata-Latin-Variable.woff2',
    output: 'fonts/literata/Literata-Latin-Variable.woff2',
    sha256: '7478e1920209e51dcc235d151d2056a0a6e3c54b4436f7030d256f231fe09b58',
    kind: 'font',
  },
  {
    sourceId: 'literata',
    relativePath: 'literata/OFL.txt',
    output: 'fonts/literata/OFL.txt',
    sha256: '72ef68216a08669b2a977fe788a4aea6114636adbbe0bc6aa9192f63f8d400d0',
    kind: 'license',
  },
];

const TILE_SOURCES = Object.fromEntries(
  Object.entries(SOURCE_CATALOG).filter(([, source]) => source.grid)
);

const THEME_TILES = {
  scriptorium: [
    ['kenneyDungeon', 9, 5, '#5a3b2c'],
    ['kenneyRoguelike', 2, 16, '#516437'],
    ['kenneyRoguelike', 1, 17, '#765035'],
    ['kenneyDungeon', 8, 0, '#69737a'],
    ['kenneyDungeon', 18, 0, '#4a3025'],
    ['kenneyDungeon', 0, 0, '#4a3025'],
    ['kenneyDungeon', 2, 0, null],
    ['project', 'paper', null, null],
    ['kenneyDungeon', 0, 9, null],
  ],
  cathedral: [
    ['kenneyDungeon', 8, 1, '#59646c'],
    ['kenneyRoguelike', 2, 16, '#3e5143'],
    ['kenneyDungeon', 10, 6, '#655044'],
    ['kenneyDungeon', 10, 0, '#838b91'],
    ['kenneyDungeon', 16, 1, '#333b43'],
    ['kenneyDungeon', 1, 0, '#333b43'],
    ['kenneyDungeon', 3, 0, null],
    ['kenneyDungeon', 1, 2, null],
    ['kenneyDungeon', 1, 9, null],
  ],
  university: [
    ['kenneyUrban', 8, 0, '#6d7285'],
    ['kenneyModernCity', 0, 23, '#55714b'],
    ['kenneyModernCity', 15, 23, '#72533c'],
    ['kenneyUrban', 10, 1, '#77798a'],
    ['kenneyUrban', 17, 0, '#743e43'],
    ['kenneyUrban', 19, 0, '#743e43'],
    ['kenneyModernCity', 31, 12, null],
    ['project', 'paper', null, null],
    ['kenneyUrban', 8, 5, null],
  ],
  gardens: [
    ['kenneyModernCity', 0, 23, '#3f6846'],
    ['kenneyModernCity', 1, 23, '#4c7649'],
    ['kenneyModernCity', 15, 23, '#75533b'],
    ['kenneyModernCity', 0, 19, '#858b8c'],
    ['kenneyUrban', 3, 0, '#315f62'],
    ['kenneyDungeon', 0, 0, '#3d5148'],
    ['kenneyDungeon', 2, 0, null],
    ['kenneyRoguelike', 1, 6, null],
    ['kenneyRoguelike', 0, 0, null],
  ],
};

const SPRITES = [
  { file: 'player.png', sourceId: 'kenneyTinyDungeon', index: 85 },
  { file: 'npc.png', sourceId: 'kenneyTinyDungeon', index: 87 },
  { file: 'bookshelf-prop.png', sourceId: 'kenneyTinyDungeon', index: 75 },
  { file: 'vault.png', sourceId: 'kenneyTinyDungeon', index: 89 },
  { file: 'book-pickup.png', projectSprite: 'book' },
  { file: 'journal-pickup.png', projectSprite: 'journal' },
  { file: 'battery-pickup.png', projectSprite: 'battery' },
  { file: 'map-pickup.png', projectSprite: 'map' },
  { file: 'transporter-pad.png', projectSprite: 'transporter' },
  { file: 'paper-debris-prop.png', projectSprite: 'paper' },
  { file: 'ship-terminal-prop.png', projectSprite: 'terminal' },
];

const PROJECT_SPRITES = {
  book: [
    ['#432a2b', 3, 2, 10, 13], ['#a7623a', 4, 2, 9, 12], ['#f0d99b', 5, 3, 7, 10],
    ['#c58c46', 4, 2, 1, 12], ['#7f382f', 9, 3, 3, 10], ['#e7bf65', 10, 5, 1, 6],
  ],
  journal: [
    ['#172638', 3, 2, 10, 13], ['#294c62', 4, 2, 9, 12], ['#142332', 5, 3, 7, 10],
    ['#c89b50', 4, 2, 1, 12], ['#e7c875', 6, 5, 5, 1], ['#e7c875', 6, 8, 4, 1],
  ],
  battery: [
    ['#122a35', 5, 2, 6, 13], ['#c99c49', 6, 1, 4, 2], ['#67d7d0', 6, 4, 4, 8],
    ['#d9f4df', 7, 5, 2, 4], ['#2f878a', 6, 11, 4, 2], ['#c99c49', 6, 14, 4, 1],
  ],
  map: [
    ['#8b603f', 2, 3, 12, 10], ['#ead39b', 3, 2, 10, 12], ['#c8aa72', 6, 3, 1, 10],
    ['#c8aa72', 10, 3, 1, 10], ['#47756c', 4, 5, 6, 1], ['#47756c', 8, 6, 3, 1],
    ['#a84d45', 5, 9, 1, 1], ['#a84d45', 6, 8, 1, 1], ['#a84d45', 7, 9, 1, 1],
  ],
  transporter: [
    ['#1c2d3d', 2, 6, 12, 8], ['#486477', 3, 5, 10, 8], ['#162331', 4, 7, 8, 5],
    ['#5ed9d0', 5, 6, 6, 1], ['#5ed9d0', 4, 8, 1, 3], ['#5ed9d0', 11, 8, 1, 3],
    ['#d8bd67', 6, 9, 4, 2], ['#94f1dc', 7, 8, 2, 1],
  ],
  paper: [
    ['#d9c28d', 2, 10, 5, 3], ['#f3dfaa', 4, 7, 7, 4], ['#c59d62', 8, 5, 6, 4],
    ['#7f6549', 9, 7, 3, 1], ['#b85345', 5, 9, 2, 1],
  ],
  terminal: [
    ['#172637', 3, 4, 10, 10], ['#45596b', 4, 3, 8, 8], ['#10222d', 5, 4, 6, 5],
    ['#64d8d0', 6, 5, 4, 2], ['#d9b65d', 6, 8, 1, 1], ['#b3534c', 9, 8, 1, 1],
    ['#263b4b', 2, 13, 12, 2],
  ],
};

function rootFor(source) {
  if (source.root === 'kenney') return KENNEY_ROOT;
  if (source.root === 'beowulf') return BEOWULF_ROOT;
  throw new Error(`Unknown source root: ${source.root}`);
}

async function readPinned(filePath, expectedHash, label) {
  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`Missing pinned source ${label}: ${filePath}\n${error instanceof Error ? error.message : error}`);
  }
  const actualHash = sha256(buffer);
  if (actualHash !== expectedHash) {
    throw new Error(`Pinned source changed for ${label}: expected ${expectedHash}, received ${actualHash}`);
  }
  return buffer;
}

async function loadTileSources() {
  const loaded = new Map();
  for (const [sourceId, source] of Object.entries(TILE_SOURCES)) {
    loaded.set(
      sourceId,
      await readPinned(path.join(rootFor(source), source.relativePath), source.sha256, sourceId)
    );
  }
  return loaded;
}

function assertCell(sourceId, column, row) {
  const { grid } = TILE_SOURCES[sourceId];
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) {
    throw new Error(`Invalid ${sourceId} cell (${column}, ${row}) for ${grid.columns}x${grid.rows} grid`);
  }
}

async function extractTile(sources, sourceId, column, row, background = null) {
  assertCell(sourceId, column, row);
  let pipeline = sharp(sources.get(sourceId))
    .extract({
      left: column * (SOURCE_TILE_SIZE + TILE_SPACING),
      top: row * (SOURCE_TILE_SIZE + TILE_SPACING),
      width: SOURCE_TILE_SIZE,
      height: SOURCE_TILE_SIZE,
    })
    .ensureAlpha();
  if (background) pipeline = pipeline.flatten({ background });
  return pipeline
    .resize(TILE_SIZE, TILE_SIZE, { kernel: sharp.kernel.nearest })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

function rawPixelArt(rectangles) {
  const buffer = Buffer.alloc(SOURCE_TILE_SIZE * SOURCE_TILE_SIZE * 4);
  for (const [color, left, top, width, height] of rectangles) {
    const value = color.replace('#', '');
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        const offset = (y * SOURCE_TILE_SIZE + x) * 4;
        buffer[offset] = red;
        buffer[offset + 1] = green;
        buffer[offset + 2] = blue;
        buffer[offset + 3] = 255;
      }
    }
  }
  return buffer;
}

async function renderProjectSprite(name) {
  return sharp(rawPixelArt(PROJECT_SPRITES[name]), {
    raw: { width: SOURCE_TILE_SIZE, height: SOURCE_TILE_SIZE, channels: 4 },
  })
    .resize(TILE_SIZE, TILE_SIZE, { kernel: sharp.kernel.nearest })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function writeThemeAtlases(sources) {
  const records = [];
  for (const [themeId, tiles] of Object.entries(THEME_TILES)) {
    const composites = [];
    for (const [index, tile] of tiles.entries()) {
      let input;
      if (tile[0] === 'project') {
        input = await renderProjectSprite(tile[1]);
      } else {
        input = await extractTile(sources, tile[0], tile[1], tile[2], tile[3]);
      }
      composites.push({
        input,
        left: (index % 4) * TILE_SIZE,
        top: Math.floor(index / 4) * TILE_SIZE,
      });
    }
    const relativePath = `game-assets/tiles/${themeId}-tiles.png`;
    const outputPath = path.join(PUBLIC_ROOT, relativePath);
    await sharp({
      create: { width: 4 * TILE_SIZE, height: 3 * TILE_SIZE, channels: 4, background: TRANSPARENT },
    })
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toFile(outputPath);
    records.push({
      path: relativePath,
      kind: 'tileset',
      mediaType: 'image/png',
      width: 128,
      height: 96,
      sourceIds: [...new Set(tiles.map((tile) => tile[0]).filter((id) => id !== 'project'))],
      transformation: `Nine semantic 16px cells composed on a 4x3 grid and scaled 2x with nearest-neighbor; theme=${themeId}`,
    });
  }
  return records;
}

async function writeSprites(sources) {
  const records = [];
  for (const sprite of SPRITES) {
    const input = sprite.projectSprite
      ? await renderProjectSprite(sprite.projectSprite)
      : await extractTile(
          sources,
          sprite.sourceId,
          sprite.index % TILE_SOURCES[sprite.sourceId].grid.columns,
          Math.floor(sprite.index / TILE_SOURCES[sprite.sourceId].grid.columns)
        );
    const relativePath = `game-assets/sprites/${sprite.file}`;
    await sharp(input)
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toFile(path.join(PUBLIC_ROOT, relativePath));
    records.push({
      path: relativePath,
      kind: 'sprite',
      mediaType: 'image/png',
      width: 32,
      height: 32,
      sourceIds: sprite.projectSprite ? ['project'] : [sprite.sourceId],
      transformation: sprite.projectSprite
        ? `Project-authored ${sprite.projectSprite} icon drawn on a 16px integer grid and scaled 2x with nearest-neighbor`
        : `Cell ${sprite.index} extracted from a 16px CC0 sheet and scaled 2x with nearest-neighbor`,
    });
  }
  return records;
}

async function copyPinnedAudio() {
  const records = [];
  const sourceRoot = path.join(BEOWULF_ROOT, 'public', 'assets', '2d', 'audio');
  for (const entry of BEOWULF_FILES) {
    if (entry.name === 'ambience-ruins') {
      const inputPath = path.join(sourceRoot, `${entry.relativeStem}.ogg`);
      await readPinned(inputPath, entry.oggHash, `${entry.name}.ogg`);
      await readPinned(
        path.join(sourceRoot, `${entry.relativeStem}.mp3`),
        entry.mp3Hash,
        `${entry.name}.mp3`
      );
      const filter =
        '[0:a]asplit=2[a][b];' +
        '[a]atrim=start=60:end=120,asetpts=PTS-STARTPTS[main];' +
        '[b]atrim=start=60:end=62,asetpts=PTS-STARTPTS[head];' +
        '[main][head]acrossfade=d=2:c1=tri:c2=tri[out]';
      const oggRelativePath = 'game-assets/audio/ambience/ambience-ruins.ogg';
      const mp3RelativePath = 'game-assets/audio/ambience/ambience-ruins.mp3';
      await execFile(
        process.env.FFMPEG ?? 'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
          '-filter_complex', filter, '-map', '[out]', '-map_metadata', '-1',
          '-fflags', '+bitexact', '-flags:a', '+bitexact', '-c:a', 'vorbis',
          '-strict', '-2', '-q:a', '3', path.join(PUBLIC_ROOT, oggRelativePath),
        ],
        { maxBuffer: 1024 * 1024 }
      );
      await execFile(
        process.env.FFMPEG ?? 'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
          '-filter_complex', filter, '-map', '[out]', '-map_metadata', '-1',
          '-fflags', '+bitexact', '-flags:a', '+bitexact', '-codec:a', 'libmp3lame',
          '-q:a', '4', '-write_xing', '0', path.join(PUBLIC_ROOT, mp3RelativePath),
        ],
        { maxBuffer: 1024 * 1024 }
      );
      for (const [relativePath, mediaType] of [
        [oggRelativePath, 'audio/ogg'],
        [mp3RelativePath, 'audio/mpeg'],
      ]) {
        records.push({
          path: relativePath,
          kind: 'audio',
          mediaType,
          sourceIds: [entry.sourceId],
          logicalName: entry.name,
          transformation:
            'Selected seconds 60-120 and crossfaded the final two seconds into the opening two seconds; encoded bit-exact without metadata',
        });
      }
      continue;
    }
    for (const [extension, expectedHash] of [
      ['ogg', entry.oggHash],
      ['mp3', entry.mp3Hash],
    ]) {
      const inputPath = path.join(sourceRoot, `${entry.relativeStem}.${extension}`);
      const buffer = await readPinned(inputPath, expectedHash, `${entry.name}.${extension}`);
      const category = entry.category ?? (entry.name.match(/^(stone|dirt|sand|water|gear)-/) ? 'footsteps' : 'cues');
      const relativePath = `game-assets/audio/${category}/${entry.name}.${extension}`;
      await fs.writeFile(path.join(PUBLIC_ROOT, relativePath), buffer);
      records.push({
        path: relativePath,
        kind: 'audio',
        mediaType: extension === 'ogg' ? 'audio/ogg' : 'audio/mpeg',
        sourceIds: [entry.sourceId],
        logicalName: entry.name,
        transformation: 'Copied from Beowulf normalized CC0 audio library without re-encoding',
      });
    }
  }
  return records;
}

async function transcodeKenneyAudio() {
  const records = [];
  for (const entry of KENNEY_AUDIO) {
    const inputPath = path.join(KENNEY_ROOT, entry.relativePath);
    const ogg = await readPinned(inputPath, entry.sha256, entry.name);
    const category = entry.name === 'ship-engine' ? 'ambience' : 'cues';
    const oggRelativePath = `game-assets/audio/${category}/${entry.name}.ogg`;
    const mp3RelativePath = `game-assets/audio/${category}/${entry.name}.mp3`;
    const oggOutputPath = path.join(PUBLIC_ROOT, oggRelativePath);
    const mp3OutputPath = path.join(PUBLIC_ROOT, mp3RelativePath);
    await fs.writeFile(oggOutputPath, ogg);
    await execFile(
      process.env.FFMPEG ?? 'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
        '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-q:a', '4', '-write_xing', '0', mp3OutputPath,
      ],
      { maxBuffer: 1024 * 1024 }
    );
    for (const [relativePath, mediaType, transformation] of [
      [oggRelativePath, 'audio/ogg', 'Copied from the pinned Kenney OGG source'],
      [mp3RelativePath, 'audio/mpeg', 'Transcoded from the pinned Kenney OGG source with ffmpeg libmp3lame q=4 and metadata removed'],
    ]) {
      records.push({
        path: relativePath,
        kind: 'audio',
        mediaType,
        sourceIds: [entry.sourceId],
        logicalName: entry.name,
        transformation,
      });
    }
  }
  return records;
}

async function copyFonts() {
  const records = [];
  const sourceRoot = path.join(BEOWULF_ROOT, 'public', 'assets', 'fonts');
  for (const font of FONT_FILES) {
    const inputPath = path.join(sourceRoot, font.relativePath);
    const buffer = await readPinned(inputPath, font.sha256, font.relativePath);
    await fs.mkdir(path.dirname(path.join(PUBLIC_ROOT, font.output)), { recursive: true });
    await fs.writeFile(path.join(PUBLIC_ROOT, font.output), buffer);
    records.push({
      path: font.output,
      kind: font.kind,
      mediaType: font.output.endsWith('.woff2') ? 'font/woff2' : 'text/plain',
      sourceIds: [font.sourceId],
      transformation: 'Copied from the pinned Beowulf font library without modification',
    });
  }
  return records;
}

async function finishRecords(records) {
  const finished = [];
  for (const record of records) {
    const buffer = await fs.readFile(path.join(PUBLIC_ROOT, record.path));
    finished.push({ ...record, bytes: buffer.byteLength, sha256: sha256(buffer) });
  }
  return finished.sort((left, right) => left.path.localeCompare(right.path));
}

function publicSourceCatalog() {
  return Object.fromEntries(
    Object.entries(SOURCE_CATALOG).map(([id, source]) => [
      id,
      Object.fromEntries(
        Object.entries(source).filter(([key]) => !['root', 'relativePath', 'grid'].includes(key))
      ),
    ])
  );
}

async function cleanLegacyOutputs() {
  const legacy = [path.join(OUTPUT_ROOT, 'tiles', 'library-tiles.png')];
  for (const filePath of legacy) await fs.rm(filePath, { force: true });
}

async function main() {
  await fs.mkdir(path.join(OUTPUT_ROOT, 'tiles'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_ROOT, 'sprites'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_ROOT, 'audio', 'footsteps'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_ROOT, 'audio', 'cues'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_ROOT, 'audio', 'ambience'), { recursive: true });
  await cleanLegacyOutputs();

  const sources = await loadTileSources();
  const records = await finishRecords([
    ...(await writeThemeAtlases(sources)),
    ...(await writeSprites(sources)),
    ...(await copyPinnedAudio()),
    ...(await transcodeKenneyAudio()),
    ...(await copyFonts()),
  ]);

  const manifest = {
    schemaVersion: 1,
    runtimePolicy: 'All runtime assets are local. Network access is maintainer-only.',
    tileSchema: {
      sourceTileSize: 16,
      runtimeTileSize: TILE_SIZE,
      columns: 4,
      rows: 3,
      roles: ['floor', 'grass', 'dirt', 'stone-floor', 'wall', 'rubble', 'vine', 'debris', 'flooded'],
      opaqueRoles: ['floor', 'grass', 'dirt', 'stone-floor', 'wall', 'rubble'],
    },
    sources: publicSourceCatalog(),
    assets: records,
  };
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Generated ${records.length} pinned runtime assets.`);
  console.log(`Manifest: ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
