#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getOpeningVoiceLines } from './lib/opening-voice-lines.mjs';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is required to generate opening voices.');
  process.exit(1);
}

const root = process.cwd();
const gameloopPath = path.join(root, 'public', 'content', 'gameloop.yaml');
const outputDir = path.join(root, 'public', 'audio', 'voices', 'opening');
const manifestPath = path.join(root, 'public', 'audio', 'voices', 'manifest.json');
const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const voice = process.env.OPENAI_TTS_VOICE || 'marin';
const instructions = process.env.OPENAI_TTS_INSTRUCTIONS ||
  'Warm, clear starship librarian narration. Calm, hopeful, intimate, and accessible. Avoid harsh sibilance or theatrical overacting.';
async function readManifest(filePath) {
  let raw;

  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        version: 1,
        generatedAt: new Date(0).toISOString(),
        clips: [],
      };
    }

    throw error;
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse voice manifest at ${filePath}: ${error.message}`);
  }

  validateManifest(manifest);
  return manifest;
}

function isPresentString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

const gameloop = parseYaml(await fs.readFile(gameloopPath, 'utf8'));
const lines = getOpeningVoiceLines(gameloop);

if (lines.length === 0) {
  console.error('No opening voice lines found in public/content/gameloop.yaml.');
  process.exit(1);
}

await fs.mkdir(outputDir, { recursive: true });

const manifest = await readManifest(manifestPath);
const clipsById = new Map(manifest.clips.map((clip) => [clip.lineId, clip]));
let didGenerateClip = false;

for (const line of lines) {
  const fileName = `${line.lineId}.mp3`;
  const publicPath = `/audio/voices/opening/${fileName}`;
  const outputPath = path.join(outputDir, fileName);
  const existing = clipsById.get(line.lineId);

  if (existing?.textHash === line.textHash && existing.path === publicPath) {
    try {
      await fs.access(outputPath);
      console.log(`Skipping unchanged ${line.lineId}`);
      continue;
    } catch {
      // Missing file; regenerate below.
    }
  }

  console.log(`Generating ${line.lineId}`);
  const audio = await generateSpeech(line);
  await fs.writeFile(outputPath, audio);
  didGenerateClip = true;
  clipsById.set(line.lineId, {
    lineId: line.lineId,
    textHash: line.textHash,
    path: publicPath,
    model,
    voice,
    durationMs: null,
  });
}

if (!didGenerateClip) {
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
