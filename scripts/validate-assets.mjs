#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  PINNED_FFMPEG_VERSION,
  validateAudioFormatGroups,
} from './lib/asset-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const MANIFEST_PATH = path.join(PUBLIC_ROOT, 'game-assets', 'manifest.json');
const CONCEPT_MANIFEST_PATH = path.join(PUBLIC_ROOT, 'images', 'manifest.json');
const RUNTIME_EXTENSIONS = new Set(['.png', '.ogg', '.mp3']);
const errors = [];

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const fail = (message) => errors.push(message);

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function isMp3(buffer) {
  return (
    buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  );
}

async function validateTileset(filePath, record, opaqueIndices) {
  const metadata = await sharp(filePath).metadata();
  if (metadata.format !== 'png' || metadata.width !== 128 || metadata.height !== 96) {
    fail(`${record.path}: tilesets must be 128x96 PNGs; received ${metadata.width}x${metadata.height} ${metadata.format}`);
    return;
  }
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < 9; index += 1) {
    let visible = 0;
    let opaque = 0;
    const tileLeft = (index % 4) * 32;
    const tileTop = Math.floor(index / 4) * 32;
    for (let y = tileTop; y < tileTop + 32; y += 1) {
      for (let x = tileLeft; x < tileLeft + 32; x += 1) {
        const alpha = data[(y * info.width + x) * info.channels + 3];
        if (alpha > 0) visible += 1;
        if (alpha === 255) opaque += 1;
      }
    }
    if (visible === 0) fail(`${record.path}: semantic tile ${index} is empty`);
    if (opaqueIndices.has(index) && opaque !== 32 * 32) {
      fail(`${record.path}: collision/ground tile ${index} is not fully opaque`);
    }
  }
}

async function validateSprite(filePath, record) {
  const metadata = await sharp(filePath).metadata();
  if (metadata.format !== 'png' || metadata.width !== 32 || metadata.height !== 32) {
    fail(`${record.path}: sprites must be 32x32 PNGs; received ${metadata.width}x${metadata.height} ${metadata.format}`);
  }
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  if (manifest.schemaVersion !== 1) fail(`Unsupported asset manifest schema: ${manifest.schemaVersion}`);
  if (manifest.toolchain?.ffmpeg !== PINNED_FFMPEG_VERSION) {
    fail(`Asset manifest must pin ffmpeg ${PINNED_FFMPEG_VERSION}`);
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) fail('Asset manifest has no assets');

  const opaqueIndices = new Set(
    manifest.tileSchema.opaqueRoles.map((role) => manifest.tileSchema.roles.indexOf(role))
  );
  const seenPaths = new Set();
  const audioFormats = validateAudioFormatGroups(manifest.assets);
  for (const error of audioFormats.errors) fail(error);

  for (const record of manifest.assets) {
    if (seenPaths.has(record.path)) fail(`Duplicate manifest path: ${record.path}`);
    seenPaths.add(record.path);
    if (/^(?:https?:)?\/\//i.test(record.path)) {
      fail(`${record.path}: remote runtime paths are forbidden`);
      continue;
    }
    const resolved = path.resolve(PUBLIC_ROOT, record.path);
    if (!resolved.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
      fail(`${record.path}: runtime path escapes public/`);
      continue;
    }

    let buffer;
    try {
      const realPath = await fs.realpath(resolved);
      if (!realPath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) fail(`${record.path}: symlink escapes public/`);
      buffer = await fs.readFile(realPath);
    } catch {
      fail(`${record.path}: missing runtime asset`);
      continue;
    }
    if (buffer.byteLength === 0) fail(`${record.path}: empty runtime asset`);
    if (record.bytes !== buffer.byteLength) fail(`${record.path}: byte count does not match manifest`);
    if (record.sha256 !== sha256(buffer)) fail(`${record.path}: SHA-256 does not match manifest`);

    for (const sourceId of record.sourceIds ?? []) {
      if (sourceId !== 'project' && !manifest.sources[sourceId]) {
        fail(`${record.path}: unknown source ID ${sourceId}`);
      }
    }

    if (record.kind === 'tileset') await validateTileset(resolved, record, opaqueIndices);
    if (record.kind === 'sprite') await validateSprite(resolved, record);
    if (record.kind === 'audio') {
      const extension = path.extname(record.path).slice(1);
      if (extension === 'ogg' && buffer.subarray(0, 4).toString('ascii') !== 'OggS') {
        fail(`${record.path}: invalid OGG signature`);
      }
      if (extension === 'mp3' && !isMp3(buffer)) fail(`${record.path}: invalid MP3 signature`);
    }
  }

  const themeNames = new Set(
    manifest.assets
      .filter((record) => record.kind === 'tileset')
      .map((record) => path.basename(record.path, '-tiles.png'))
  );
  for (const theme of ['scriptorium', 'cathedral', 'university', 'gardens']) {
    if (!themeNames.has(theme)) fail(`Missing theme tileset: ${theme}`);
  }

  for (const [sourceId, source] of Object.entries(manifest.sources)) {
    if (!['CC0-1.0', 'OFL-1.1'].includes(source.license)) {
      fail(`${sourceId}: unsupported source license ${source.license}`);
    }
    if (!source.pageUrl?.startsWith('https://')) fail(`${sourceId}: missing HTTPS source page`);
  }

  const runtimeFiles = (await walk(path.join(PUBLIC_ROOT, 'game-assets')))
    .filter((filePath) => RUNTIME_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => path.relative(PUBLIC_ROOT, filePath).split(path.sep).join('/'));
  for (const runtimeFile of runtimeFiles) {
    if (!seenPaths.has(runtimeFile)) fail(`${runtimeFile}: runtime file is missing from manifest`);
  }
  for (const manifestFile of seenPaths) {
    if (RUNTIME_EXTENSIONS.has(path.extname(manifestFile).toLowerCase()) && !runtimeFiles.includes(manifestFile)) {
      fail(`${manifestFile}: manifest runtime entry is not in game-assets/`);
    }
  }

  const runtimeManifest = await fs.readFile(path.join(PROJECT_ROOT, 'src', 'game', 'assets', 'assetManifest.ts'), 'utf8');
  if (/https?:\/\//i.test(runtimeManifest)) fail('assetManifest.ts contains a remote runtime URL');
  const importer = await fs.readFile(path.join(PROJECT_ROOT, 'scripts', 'import-external-game-assets.mjs'), 'utf8');
  if (/sketchfab|poly\s*haven/i.test(importer)) fail('Importer still references removed thumbnail/photo-texture sources');

  const conceptManifest = JSON.parse(await fs.readFile(CONCEPT_MANIFEST_PATH, 'utf8'));
  if (!conceptManifest.prompt || !conceptManifest.disclosure || !conceptManifest.tool) {
    fail('Concept-art manifest must retain its prompt, tool, and AI disclosure');
  }
  for (const output of conceptManifest.outputs ?? []) {
    const resolved = path.resolve(PUBLIC_ROOT, output.path.replace(/^\//, ''));
    if (!resolved.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
      fail(`${output.path}: concept-art path escapes public/`);
      continue;
    }
    try {
      const buffer = await fs.readFile(resolved);
      const metadata = await sharp(buffer).metadata();
      if (sha256(buffer) !== output.sha256) fail(`${output.path}: concept-art SHA-256 does not match manifest`);
      if (metadata.width !== output.width || metadata.height !== output.height) {
        fail(`${output.path}: concept-art dimensions do not match manifest`);
      }
    } catch {
      fail(`${output.path}: missing concept-art output`);
    }
  }

  if (errors.length > 0) {
    console.error(`Asset validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${manifest.assets.length} assets, ${audioFormats.pairCount} audio pairs, ${themeNames.size} theme atlases, and ${conceptManifest.outputs?.length ?? 0} concept-art outputs.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
