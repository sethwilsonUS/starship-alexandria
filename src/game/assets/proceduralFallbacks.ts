import { TILE_SIZE } from '@/config/gameConfig';
import { ASSET_KEYS, THEME_TILESET_KEYS } from './assetManifest';

export function ensureProceduralFallbackTextures(scene: Phaser.Scene): void {
  for (const tilesetKey of Object.values(THEME_TILESET_KEYS)) {
    if (!scene.textures.exists(tilesetKey)) createTileset(scene, tilesetKey);
  }
  if (!scene.textures.exists(ASSET_KEYS.sprites.book)) createBook(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.transporter)) createTransporter(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.player)) createPlayer(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.npc)) createNpc(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.journal)) createJournal(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.battery)) createBattery(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.map)) createMapPickup(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.vault)) createVault(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.bookshelfProp)) createBookshelfProp(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.paperDebrisProp)) createPaperDebrisProp(scene);
  if (!scene.textures.exists(ASSET_KEYS.sprites.shipTerminalProp)) createShipTerminalProp(scene);
}

function createTileset(scene: Phaser.Scene, key: string): void {
  // Generate procedural tileset (post-apocalyptic palette)
  // 4 columns x 3 rows = 12 tiles @ 32x32 each
  const cols = 4;
  const rows = 3;
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;

  const graphics = scene.add.graphics();
  // Brightness rules: floors (0-3) stay above min luminance; walls (4-5) stay below max.
  const palette = [
    0x8b7355, // 0 floor (stone/tan)
    0x4a7c4e, // 1 grass (overgrown green)
    0x7a5530, // 2 dirt
    0xa89888, // 3 stone floor (lighter interior)
    0x353535, // 4 wall (dark - bounded/solid)
    0x454545, // 5 rubble base (distinct, textured)
    0x2d4a2d, // 6 vine (dark green overgrowth)
    0x4a4a4a, // 7 debris
    0x3a5a6b, // 8 flooded base (blue-gray, textured)
  ];

  for (let i = 0; i < palette.length; i++) {
    const tx = (i % cols) * TILE_SIZE;
    const ty = Math.floor(i / cols) * TILE_SIZE;
    graphics.fillStyle(palette[i], 1);
    graphics.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);

    // Rubble (5): irregular chunks for texture - distinct from plain floors
    if (i === 5) {
      graphics.fillStyle(0x3a3a3a, 0.8);
      graphics.fillRect(tx + 2, ty + 4, 10, 8);
      graphics.fillStyle(0x505050, 0.7);
      graphics.fillRect(tx + 14, ty + 12, 12, 10);
      graphics.fillStyle(0x2a2a2a, 0.9);
      graphics.fillRect(tx + 6, ty + 20, 14, 6);
    }

    // Flooded (8): wavy water-like texture - clearly distinguishable
    if (i === 8) {
      graphics.fillStyle(0x4a6a7b, 0.6);
      graphics.fillRect(tx + 0, ty + 8, TILE_SIZE, 6);
      graphics.fillRect(tx + 0, ty + 20, TILE_SIZE, 6);
      graphics.fillStyle(0x2a4a5b, 0.5);
      graphics.fillRect(tx + 0, ty + 14, TILE_SIZE, 4);
    }
  }

  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function createBook(scene: Phaser.Scene): void {
  // Placeholder: book fragment - book-like shape, high contrast (accessibility)
  // Vertical rect = closed book spine; cream pages + dark outline.
  const book = scene.add.graphics();
  book.fillStyle(0xe8dcc4, 1); // Warm cream (old paper)
  book.fillRect(10, 6, 12, 20); // Vertical book shape
  book.lineStyle(4, 0x2a2520, 1); // Thick dark outline (matches player)
  book.strokeRect(10, 6, 12, 20);
  book.fillStyle(0xc4a574, 0.6); // Spine line
  book.fillRect(14, 6, 4, 20);
  book.generateTexture(ASSET_KEYS.sprites.book, 32, 32);
  book.destroy();
}

function createTransporter(scene: Phaser.Scene): void {
  // Placeholder: transporter pad - platform with inner glow (sci-fi teleporter)
  const pad = scene.add.graphics();
  pad.fillStyle(0x2a3a5a, 1); // Dark blue base
  pad.fillRect(4, 4, 24, 24);
  pad.lineStyle(3, 0x2a2520, 1); // Dark outline for contrast
  pad.strokeRect(4, 4, 24, 24);
  pad.fillStyle(0x4488ff, 0.5); // Blue glow
  pad.fillRect(8, 8, 16, 16);
  pad.lineStyle(2, 0x5cb3ff, 0.9);
  pad.strokeRect(8, 8, 16, 16);
  pad.generateTexture(ASSET_KEYS.sprites.transporter, 32, 32);
  pad.destroy();
}

function createPlayer(scene: Phaser.Scene): void {
  // Placeholder: player - high-contrast for visibility (legally blind accessible)
  // Bright cyan + dark outline stands out on brown/green map; replace with spritesheet later
  const player = scene.add.graphics();
  player.fillStyle(0x0ec3c9, 1); // Bright cyan
  player.fillCircle(16, 16, 12);
  player.lineStyle(4, 0x1a1a2e, 1); // Thick dark outline (matches scene bg)
  player.strokeCircle(16, 16, 12);
  player.generateTexture(ASSET_KEYS.sprites.player, 32, 32);
  player.destroy();
}

function createNpc(scene: Phaser.Scene): void {
  // Placeholder: NPC - simple figure (head + body), distinct from player
  const npc = scene.add.graphics();
  npc.fillStyle(0xe8d4b8, 1); // Skin tone
  npc.fillCircle(16, 10, 5); // Head
  npc.fillStyle(0x6b7b8b, 1); // Muted gray-blue clothing
  npc.fillRect(10, 16, 12, 14); // Body/torso
  npc.lineStyle(3, 0x2a2520, 1);
  npc.strokeCircle(16, 10, 5);
  npc.strokeRect(10, 16, 12, 14);
  npc.generateTexture(ASSET_KEYS.sprites.npc, 32, 32);
  npc.destroy();
}

function createJournal(scene: Phaser.Scene): void {
  // Placeholder: journal/scroll - rolled scroll with aged paper
  const journal = scene.add.graphics();
  journal.fillStyle(0xe8e0d0, 0.95);
  journal.fillRect(8, 6, 16, 20);
  journal.fillStyle(0xc4b896, 0.8);
  journal.fillRect(10, 8, 12, 16);
  journal.lineStyle(3, 0x2a2520, 1);
  journal.strokeRect(8, 6, 16, 20);
  journal.fillStyle(0x8b7355, 0.5);
  journal.fillRect(12, 4, 8, 4); // Rolled top
  journal.generateTexture(ASSET_KEYS.sprites.journal, 32, 32);
  journal.destroy();
}

function createBattery(scene: Phaser.Scene): void {
  // Placeholder: battery pickup - bright yellow/green with lightning bolt
  const battery = scene.add.graphics();
  // Bright yellow-green body (high visibility)
  battery.fillStyle(0x7cfc00, 1); // Lawn green - very bright
  battery.fillRoundedRect(6, 4, 20, 24, 4);
  // Dark outline for contrast
  battery.lineStyle(3, 0x1a1a1a, 1);
  battery.strokeRoundedRect(6, 4, 20, 24, 4);
  // Positive terminal on top (distinct from journal)
  battery.fillStyle(0xffff00, 1); // Bright yellow
  battery.fillRect(12, 1, 8, 5);
  battery.lineStyle(2, 0x1a1a1a, 1);
  battery.strokeRect(12, 1, 8, 5);
  // Lightning bolt symbol in center (makes purpose obvious)
  battery.fillStyle(0x1a1a1a, 1);
  battery.fillTriangle(18, 10, 14, 18, 17, 18); // Top part
  battery.fillTriangle(14, 14, 18, 22, 15, 14); // Bottom part
  battery.generateTexture(ASSET_KEYS.sprites.battery, 32, 32);
  battery.destroy();
}

function createMapPickup(scene: Phaser.Scene): void {
  // Placeholder: map pickup - rolled parchment with compass rose hint
  const mapPickup = scene.add.graphics();
  // Parchment body (rolled scroll look)
  mapPickup.fillStyle(0xf4e4bc, 1); // Light parchment tan
  mapPickup.fillRect(6, 8, 20, 16);
  // Darker edges for rolled effect
  mapPickup.fillStyle(0xd4c49c, 1);
  mapPickup.fillRect(6, 8, 4, 16); // Left roll
  mapPickup.fillRect(22, 8, 4, 16); // Right roll
  // Grid lines suggesting map
  mapPickup.lineStyle(1, 0x8b7355, 0.5);
  mapPickup.lineBetween(10, 12, 22, 12);
  mapPickup.lineBetween(10, 16, 22, 16);
  mapPickup.lineBetween(10, 20, 22, 20);
  mapPickup.lineBetween(14, 8, 14, 24);
  mapPickup.lineBetween(18, 8, 18, 24);
  // X mark (treasure map feel)
  mapPickup.lineStyle(2, 0x8b4513, 1);
  mapPickup.lineBetween(14, 13, 18, 17);
  mapPickup.lineBetween(18, 13, 14, 17);
  // Dark outline for contrast
  mapPickup.lineStyle(3, 0x2a2520, 1);
  mapPickup.strokeRect(6, 8, 20, 16);
  mapPickup.generateTexture(ASSET_KEYS.sprites.map, 32, 32);
  mapPickup.destroy();
}

function createVault(scene: Phaser.Scene): void {
  // Placeholder: vault - sturdy metal box with lock, distinct purple/steel color
  const vault = scene.add.graphics();
  // Steel body
  vault.fillStyle(0x5a5a6a, 1); // Steel gray-blue
  vault.fillRoundedRect(4, 6, 24, 20, 3);
  // Lock mechanism (gold/brass)
  vault.fillStyle(0xc4a060, 1);
  vault.fillCircle(16, 16, 5);
  // Keyhole
  vault.fillStyle(0x1a1a1a, 1);
  vault.fillCircle(16, 15, 2);
  vault.fillRect(15, 16, 2, 4);
  // Hinges
  vault.fillStyle(0x8b8b9b, 1);
  vault.fillRect(5, 8, 3, 4);
  vault.fillRect(5, 18, 3, 4);
  // Dark outline
  vault.lineStyle(3, 0x2a2520, 1);
  vault.strokeRoundedRect(4, 6, 24, 20, 3);
  vault.generateTexture(ASSET_KEYS.sprites.vault, 32, 32);
  vault.destroy();
}

function createBookshelfProp(scene: Phaser.Scene): void {
  const shelf = scene.add.graphics();
  shelf.fillStyle(0x1a120d, 1);
  shelf.fillRoundedRect(5, 3, 22, 26, 2);
  shelf.fillStyle(0x4a3020, 1);
  shelf.fillRect(8, 6, 16, 20);
  shelf.fillStyle(0x2d1f12, 1);
  shelf.fillRect(8, 11, 16, 2);
  shelf.fillRect(8, 19, 16, 2);
  const bookColors = [0xb94a3a, 0xd4af37, 0x4f7cac, 0x5f9f55, 0xb86b3f];
  for (let i = 0; i < bookColors.length; i++) {
    shelf.fillStyle(bookColors[i], 1);
    shelf.fillRect(9 + i * 3, 7, 2, 4 + (i % 2));
    shelf.fillRect(9 + i * 3, 21, 2, 4);
  }
  shelf.lineStyle(3, 0x1a120d, 1);
  shelf.strokeRoundedRect(5, 3, 22, 26, 2);
  shelf.generateTexture(ASSET_KEYS.sprites.bookshelfProp, 32, 32);
  shelf.destroy();
}

function createPaperDebrisProp(scene: Phaser.Scene): void {
  const paper = scene.add.graphics();
  paper.fillStyle(0x1a1a2e, 0.3);
  paper.fillEllipse(16, 23, 26, 7);
  paper.fillStyle(0xe8dcc4, 1);
  paper.fillRect(5, 16, 11, 5);
  paper.fillStyle(0xd7c29b, 1);
  paper.fillRect(16, 13, 10, 5);
  paper.fillStyle(0xc4b896, 1);
  paper.fillRect(10, 9, 10, 4);
  paper.lineStyle(1, 0x6f6048, 0.8);
  paper.lineBetween(7, 18, 14, 18);
  paper.lineBetween(18, 15, 24, 15);
  paper.lineBetween(11, 11, 18, 11);
  paper.generateTexture(ASSET_KEYS.sprites.paperDebrisProp, 32, 32);
  paper.destroy();
}

function createShipTerminalProp(scene: Phaser.Scene): void {
  const terminal = scene.add.graphics();
  terminal.fillStyle(0x1a1a2e, 0.3);
  terminal.fillEllipse(16, 25, 25, 7);
  terminal.fillStyle(0x152334, 1);
  terminal.fillRoundedRect(6, 8, 20, 15, 3);
  terminal.fillStyle(0x5cb3ff, 0.9);
  terminal.fillRoundedRect(8, 10, 16, 6, 1);
  terminal.lineStyle(1, 0xe8fbff, 0.9);
  terminal.lineBetween(10, 12, 15, 12);
  terminal.lineBetween(17, 12, 22, 12);
  terminal.lineBetween(10, 15, 20, 15);
  terminal.fillStyle(0x9fb8c4, 1);
  terminal.fillRect(8, 18, 16, 5);
  terminal.lineStyle(2, 0x1f2937, 1);
  terminal.strokeRoundedRect(6, 8, 20, 15, 3);
  terminal.generateTexture(ASSET_KEYS.sprites.shipTerminalProp, 32, 32);
  terminal.destroy();
}
