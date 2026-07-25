#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assertFfmpegVersion,
  PINNED_FFMPEG_VERSION,
} from './lib/asset-validation.mjs';
import { getHowToPlayVoiceLines } from './lib/how-to-play-voice-lines.mjs';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is required to generate How to Play narration.');
  process.exit(1);
}

const root = process.cwd();
const contentPath = path.join(root, 'public', 'content', 'how-to-play.json');
const outputDir = path.join(root, 'public', 'audio', 'voices', 'how-to-play');
const manifestPath = path.join(root, 'public', 'audio', 'voices', 'manifest.json');
const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const voice = process.env.OPENAI_TTS_VOICE || 'marin';
const instructions = process.env.OPENAI_TTS_INSTRUCTIONS
  || 'Warm, clear starship librarian narration. Calm, hopeful, intimate, and accessible. Read keyboard letters distinctly. Avoid harsh sibilance or theatrical overacting.';

function isPresentString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Voice manifest must be an object.');
  }
  if (manifest.version !== 1) {
    throw new Error(`Unsupported voice manifest version: ${manifest.version}`);
  }
  if (!isPresentString(manifest.generatedAt)) {
    throw new Error('Voice manifest generatedAt must be a string.');
  }
  if (!Array.isArray(manifest.clips)) {
    throw new Error('Voice manifest clips must be an array.');
  }

  const seenLineIds = new Set();
  for (const [index, clip] of manifest.clips.entries()) {
    if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
      throw new Error(`Voice manifest clip at index ${index} must be an object.`);
    }
    if (!isPresentString(clip.lineId)) {
      throw new Error(`Voice manifest clip at index ${index} is missing lineId.`);
    }
    if (seenLineIds.has(clip.lineId)) {
      throw new Error(`Duplicate voice manifest lineId "${clip.lineId}".`);
    }
    seenLineIds.add(clip.lineId);
    for (const field of ['textHash', 'path', 'model', 'voice']) {
      if (!isPresentString(clip[field])) {
        throw new Error(`Voice manifest clip "${clip.lineId}" is missing ${field}.`);
      }
    }
    if (typeof clip.durationMs !== 'number' && clip.durationMs !== null) {
      throw new Error(`Voice manifest clip "${clip.lineId}" durationMs must be a number or null.`);
    }
    // Accept legacy clips without formats so this generator can upgrade the
    // disclosure manifest. Every newly written clip includes the strict pair.
    if (clip.formats !== undefined && !Array.isArray(clip.formats)) {
      throw new Error(`Voice manifest clip "${clip.lineId}" formats must be an array.`);
    }
  }
}

async function readManifest(filePath) {
  try {
    const manifest = JSON.parse(await fs.readFile(filePath, 'utf8'));
    validateManifest(manifest);
    return manifest;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { version: 1, generatedAt: new Date(0).toISOString(), clips: [] };
    }
    throw error;
  }
}

async function generateSpeech(line) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: line.text,
      instructions,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI TTS failed for ${line.lineId}: ${response.status} ${body}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function assertFfmpegAvailable() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ffmpeg -version failed: ${result.stderr || result.stdout}`);
  }
  assertFfmpegVersion(result.stdout, PINNED_FFMPEG_VERSION);
}

async function encodeOgg(mp3Path, oggPath) {
  const tempPath = `${oggPath}.${process.pid}.tmp`;
  const result = spawnSync('ffmpeg', [
    '-nostdin',
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', mp3Path,
    '-map_metadata', '-1',
    '-vn',
    '-ac', '2',
    '-ar', '24000',
    '-c:a', 'vorbis',
    '-strict', '-2',
    '-q:a', '5',
    '-f', 'ogg',
    tempPath,
  ], { encoding: 'utf8' });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    await fs.rm(tempPath, { force: true });
    throw new Error(`ffmpeg OGG encoding failed: ${result.stderr || result.stdout}`);
  }
  await fs.rename(tempPath, oggPath);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function describeFormat({ filePath, publicPath, format, provenance }) {
  const buffer = await fs.readFile(filePath);
  return {
    format,
    path: publicPath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
    provenance,
  };
}

const content = JSON.parse(await fs.readFile(contentPath, 'utf8'));
const lines = getHowToPlayVoiceLines(content);
await fs.mkdir(outputDir, { recursive: true });

const manifest = await readManifest(manifestPath);
const clipsById = new Map(manifest.clips.map((clip) => [clip.lineId, clip]));
let didUpdateManifest = false;

assertFfmpegAvailable();

for (const line of lines) {
  const mp3FileName = `${line.lineId}.mp3`;
  const oggFileName = `${line.lineId}.ogg`;
  const mp3PublicPath = `/audio/voices/how-to-play/${mp3FileName}`;
  const oggPublicPath = `/audio/voices/how-to-play/${oggFileName}`;
  const mp3OutputPath = path.join(outputDir, mp3FileName);
  const oggOutputPath = path.join(outputDir, oggFileName);
  const existing = clipsById.get(line.lineId);

  const canReuseMp3 = existing?.textHash === line.textHash
    && existing.path === mp3PublicPath
    && existing.model === model
    && existing.voice === voice
    && await fileExists(mp3OutputPath);

  if (!canReuseMp3) {
    console.log(`Generating ${line.lineId} MP3 with OpenAI`);
    const audio = await generateSpeech(line);
    const tempMp3Path = `${mp3OutputPath}.${process.pid}.tmp`;
    await fs.writeFile(tempMp3Path, audio);
    await fs.rename(tempMp3Path, mp3OutputPath);
  } else {
    console.log(`Reusing unchanged ${line.lineId} MP3`);
  }

  if (!canReuseMp3 || !await fileExists(oggOutputPath)) {
    console.log(`Encoding ${line.lineId} OGG with ffmpeg ${PINNED_FFMPEG_VERSION}`);
    await encodeOgg(mp3OutputPath, oggOutputPath);
  }

  const nextClip = {
    lineId: line.lineId,
    textHash: line.textHash,
    path: mp3PublicPath,
    model,
    voice,
    durationMs: null,
    formats: [
      await describeFormat({
        filePath: mp3OutputPath,
        publicPath: mp3PublicPath,
        format: 'mp3',
        provenance: {
          encoder: 'openai-audio-speech',
          encoderVersion: model,
          sourceFormat: 'text',
        },
      }),
      await describeFormat({
        filePath: oggOutputPath,
        publicPath: oggPublicPath,
        format: 'ogg',
        provenance: {
          encoder: 'ffmpeg',
          encoderVersion: PINNED_FFMPEG_VERSION,
          sourceFormat: 'mp3',
        },
      }),
    ],
  };
  if (JSON.stringify(existing) !== JSON.stringify(nextClip)) didUpdateManifest = true;
  clipsById.set(line.lineId, nextClip);
}

if (!didUpdateManifest) {
  console.log('No voice clips changed; manifest left as-is.');
} else {
  const nextManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    clips: Array.from(clipsById.values()).sort((a, b) => a.lineId.localeCompare(b.lineId)),
  };
  const tempManifestPath = `${manifestPath}.${process.pid}.tmp`;

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(tempManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await fs.rename(tempManifestPath, manifestPath);
  console.log(`Wrote ${manifestPath}`);
}
