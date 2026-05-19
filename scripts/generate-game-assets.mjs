#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFile = promisify(execFileCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const KENNEY_ROOT = path.resolve(process.env.KENNEY_ROOT ?? path.join(os.homedir(), 'dev', 'kenney'));
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'public', 'game-assets');
const TILE_OUTPUT_PATH = path.join(OUTPUT_ROOT, 'tiles', 'library-tiles.png');
const README_OUTPUT_PATH = path.join(OUTPUT_ROOT, 'README.md');

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const TILE_SIZE = 32;
const TILE_COLUMNS = 4;
const TILE_ROWS = 3;

const fileSource = (relativePath) => ({ type: 'file', relativePath });
const zipSource = (relativePath, entry) => ({ type: 'zip', relativePath, entry });

const TILE_SOURCES = [
  {
    index: 0,
    name: 'FLOOR',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_07.png'),
  },
  {
    index: 1,
    name: 'GRASS',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_01.png'),
  },
  {
    index: 2,
    name: 'DIRT',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_05.png'),
  },
  {
    index: 3,
    name: 'STONE_FLOOR',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_09.png'),
  },
  {
    index: 4,
    name: 'WALL',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_28.png'),
  },
  {
    index: 5,
    name: 'RUBBLE',
    source: fileSource('2D assets/RTS Sci-fi/PNG/Default size/Environment/scifiEnvironment_04.png'),
    baseSource: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_28.png'),
  },
  {
    index: 6,
    name: 'VINE',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_134.png'),
  },
  {
    index: 7,
    name: 'DEBRIS',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_161.png'),
  },
  {
    index: 8,
    name: 'FLOODED',
    source: fileSource('2D assets/Topdown Shooter/PNG/Tiles/tile_131.png'),
  },
];

const SPRITE_SOURCES = [
  {
    name: 'player',
    outputFile: 'player.png',
    source: fileSource('2D assets/RTS Sci-fi/PNG/Default size/Unit/scifiUnit_02.png'),
  },
  {
    name: 'npc',
    outputFile: 'npc.png',
    source: fileSource('2D assets/RTS Sci-fi/PNG/Default size/Unit/scifiUnit_14.png'),
  },
  {
    name: 'book',
    outputFile: 'book-pickup.png',
    source: fileSource('2D assets/Generic Items/PNG/Colored/genericItem_color_035.png'),
  },
  {
    name: 'journal',
    outputFile: 'journal-pickup.png',
    source: fileSource('2D assets/Generic Items/PNG/Colored/genericItem_color_038.png'),
  },
  {
    name: 'battery',
    outputFile: 'battery-pickup.png',
    source: fileSource('2D assets/Generic Items/PNG/Colored/genericItem_color_073.png'),
  },
  {
    name: 'map',
    outputFile: 'map-pickup.png',
    source: fileSource('2D assets/Generic Items/PNG/Colored/genericItem_color_162.png'),
  },
  {
    name: 'transporter',
    outputFile: 'transporter-pad.png',
    source: zipSource('Archive/Space Kit (Legacy)/sprites_topdown.zip', 'portal.png'),
  },
  {
    name: 'vault',
    outputFile: 'vault.png',
    source: fileSource('2D assets/Generic Items/PNG/Colored/genericItem_color_044.png'),
  },
];

function sourceKey(source) {
  return source.type === 'zip' ? `${source.relativePath}::${source.entry}` : source.relativePath;
}

function sourceLabel(source) {
  return source.type === 'zip' ? `${source.relativePath} entry ${source.entry}` : source.relativePath;
}

async function readZipEntry(zipPath, entry) {
  try {
    const { stdout } = await execFile('unzip', ['-p', zipPath, entry], {
      encoding: 'buffer',
      maxBuffer: 1024 * 1024,
    });

    if (stdout.length === 0) {
      throw new Error('zip entry produced no bytes');
    }

    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${entry} from ${zipPath}: ${message}`);
  }
}

async function readSource(source) {
  const sourcePath = path.join(KENNEY_ROOT, source.relativePath);

  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`Missing Kenney source asset: ${sourcePath}`);
  }

  if (source.type === 'zip') {
    return readZipEntry(sourcePath, source.entry);
  }

  return fs.readFile(sourcePath);
}

async function loadSources() {
  const sources = new Map();
  const requests = [
    ...TILE_SOURCES.flatMap(({ source, baseSource }) => [source, baseSource]),
    ...SPRITE_SOURCES.map(({ source }) => source),
  ].filter(Boolean);

  for (const source of requests) {
    const key = sourceKey(source);

    if (!sources.has(key)) {
      sources.set(key, await readSource(source));
    }
  }

  return sources;
}

async function normalizeTile(input, base) {
  const normalized = await sharp(input)
    .resize(TILE_SIZE, TILE_SIZE, {
      fit: 'cover',
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();

  if (!base) {
    return normalized;
  }

  const normalizedBase = await sharp(base)
    .resize(TILE_SIZE, TILE_SIZE, {
      fit: 'cover',
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();

  return sharp(normalizedBase)
    .composite([{ input: normalized }])
    .png()
    .toBuffer();
}

async function normalizeSprite(input, outputPath) {
  return sharp(input)
    .ensureAlpha()
    .trim()
    .resize({
      width: TILE_SIZE,
      height: TILE_SIZE,
      fit: 'contain',
      background: TRANSPARENT,
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toFile(outputPath);
}

async function writeTileset(sources) {
  const composites = await Promise.all(
    TILE_SOURCES.map(async ({ index, source, baseSource }) => {
      const input = sources.get(sourceKey(source));
      const base = baseSource ? sources.get(sourceKey(baseSource)) : undefined;
      const normalized = await normalizeTile(input, base);

      return {
        input: normalized,
        left: (index % TILE_COLUMNS) * TILE_SIZE,
        top: Math.floor(index / TILE_COLUMNS) * TILE_SIZE,
      };
    })
  );

  return sharp({
    create: {
      width: TILE_COLUMNS * TILE_SIZE,
      height: TILE_ROWS * TILE_SIZE,
      channels: 4,
      background: TRANSPARENT,
    },
  })
    .composite(composites)
    .png()
    .toFile(TILE_OUTPUT_PATH);
}

async function writeSprites(sources) {
  return Promise.all(
    SPRITE_SOURCES.map(async ({ outputFile, source }) => {
      const outputPath = path.join(OUTPUT_ROOT, 'sprites', outputFile);
      const input = sources.get(sourceKey(source));
      const info = await normalizeSprite(input, outputPath);

      return { outputPath, info };
    })
  );
}

async function writeReadme() {
  const tileSourceLines = TILE_SOURCES.map(
    ({ index, name, source, baseSource }) =>
      `- ${index} ${name}: \`${sourceLabel(source)}\`${baseSource ? ` over \`${sourceLabel(baseSource)}\`` : ''}`
  );
  const spriteSourceLines = SPRITE_SOURCES.map(
    ({ name, outputFile, source }) => `- \`${outputFile}\` (${name}): \`${sourceLabel(source)}\``
  );
  const contents = [
    '# Game Assets',
    '',
    'These normalized PNGs are generated by `npm run generate-assets` from a local Kenney bundle.',
    'The source root defaults to `~/dev/kenney`; set `KENNEY_ROOT=/path/to/kenney` to override it.',
    '',
    'Kenney assets are credited to Kenney (kenney.nl) and distributed as CC0 1.0 Universal in the local bundle.',
    'The Kenney source bundle itself is intentionally not committed here.',
    '',
    '## Tiles',
    '',
    '`tiles/library-tiles.png` is a 128x96 image containing a 4x3 grid of 32px tiles. Tile indices 0-8 match `src/data/tilesets.ts`; the remaining slots are transparent.',
    '',
    ...tileSourceLines,
    '',
    '## Sprites',
    '',
    'Each sprite is normalized to a transparent 32x32 PNG.',
    '',
    ...spriteSourceLines,
    '',
  ].join('\n');

  await fs.writeFile(README_OUTPUT_PATH, contents);
}

function formatOutputPath(outputPath) {
  return path.relative(PROJECT_ROOT, outputPath).split(path.sep).join('/');
}

function printSummary(summaries) {
  console.log(`Generated game assets from ${KENNEY_ROOT}`);

  for (const { outputPath, width, height, note } of summaries) {
    const detail = note ?? `${width}x${height}`;
    console.log(`- ${formatOutputPath(outputPath)} ${detail}`);
  }
}

async function main() {
  const sources = await loadSources();

  await fs.mkdir(path.join(OUTPUT_ROOT, 'tiles'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_ROOT, 'sprites'), { recursive: true });

  const tilesetInfo = await writeTileset(sources);
  const spriteInfos = await writeSprites(sources);
  await writeReadme();

  printSummary([
    {
      outputPath: TILE_OUTPUT_PATH,
      width: tilesetInfo.width,
      height: tilesetInfo.height,
    },
    ...spriteInfos.map(({ outputPath, info }) => ({
      outputPath,
      width: info.width,
      height: info.height,
    })),
    {
      outputPath: README_OUTPUT_PATH,
      note: 'metadata written',
    },
  ]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
