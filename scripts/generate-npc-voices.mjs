#!/usr/bin/env node

/**
 * Generate the committed NPC greeting recordings with OpenAI TTS, following
 * the How to Play narration pipeline: MP3 from the API, OGG via the pinned
 * ffmpeg, and clips merged into the shared voice disclosure manifest keyed
 * by lineId + textHash so unchanged lines are never re-billed.
 *
 * Only static firstMeet lines are recorded; templated or dynamically
 * assembled dialogue keeps using browser speech synthesis at runtime.
 */

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  assertFfmpegVersion,
  PINNED_FFMPEG_VERSION,
} from './lib/asset-validation.mjs';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is required to generate NPC greeting recordings.');
  process.exit(1);
}

const root = process.cwd();
const npcsPath = path.join(root, 'public', 'content', 'npcs.yaml');
const outputDir = path.join(root, 'public', 'audio', 'voices', 'npc');
const manifestPath = path.join(root, 'public', 'audio', 'voices', 'manifest.json');
const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';

const SHARED_DIRECTION = 'Calm, intimate, post-apocalyptic survivor who has made peace with the quiet. Hopeful, never theatrical. A person speaking to one visitor in a still room.';

/** Per-character voice and delivery, keyed by NPC id. */
const CHARACTER_VOICES = {
  martha: { voice: 'sage', instructions: `Elderly head librarian, warm and precise, gently wry. ${SHARED_DIRECTION}` },
  eli: { voice: 'ash', instructions: `Young scavenger and book runner, friendly, quick, practical. ${SHARED_DIRECTION}` },
  imani: { voice: 'coral', instructions: `Cathedral caretaker, steady and reverent without solemnity. ${SHARED_DIRECTION}` },
  anselm: { voice: 'onyx', instructions: `Old monk, deep and unhurried, kind. ${SHARED_DIRECTION}` },
  cora: { voice: 'nova', instructions: `Former lecturer, crisp and curious, a teacher who misses students. ${SHARED_DIRECTION}` },
  rowan: { voice: 'verse', instructions: `Lab assistant turned survivor, thoughtful, a little guarded. ${SHARED_DIRECTION}` },
  noor: { voice: 'shimmer', instructions: `Botanist and seed keeper, soft, attentive, quietly delighted by growing things. ${SHARED_DIRECTION}` },
  theo: { voice: 'echo', instructions: `Groundskeeper poet, slow, fond, close to the earth. ${SHARED_DIRECTION}` },
};

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const hashText = (text) => sha256(Buffer.from(text)).slice(0, 16);

function collectGreetingLines(document) {
  const npcs = document?.npcs;
  if (!Array.isArray(npcs) || npcs.length === 0) throw new Error('npcs.yaml must contain a non-empty npcs array.');
  const lines = [];
  for (const npc of npcs) {
    const character = CHARACTER_VOICES[npc.id];
    if (!character) throw new Error(`No voice assigned for NPC "${npc.id}" — add it to CHARACTER_VOICES.`);
    if (!Array.isArray(npc.firstMeet) || npc.firstMeet.length === 0) {
      throw new Error(`NPC "${npc.id}" has no firstMeet lines.`);
    }
    npc.firstMeet.forEach((line, index) => {
      const text = line?.text;
      if (typeof text !== 'string' || !text.trim()) throw new Error(`NPC "${npc.id}" firstMeet[${index}] has no text.`);
      if (text.includes('{{')) throw new Error(`NPC "${npc.id}" firstMeet[${index}] is templated; templated lines stay on browser TTS.`);
      const trimmed = text.trim();
      lines.push({
        lineId: `npc.${npc.id}.first-meet.${index}`,
        text: trimmed,
        textHash: hashText(trimmed),
        // Full generation identity: changing only the delivery instructions
        // must invalidate the recording, not just text/model/voice.
        generationHash: hashText([trimmed, model, character.voice, character.instructions].join('\n')),
        ...character,
      });
    });
  }
  return lines;
}

async function readManifest() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.clips)) {
    throw new Error('Unsupported voice manifest shape.');
  }
  return manifest;
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
      voice: line.voice,
      input: line.text,
      instructions: line.instructions,
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
  if (result.status !== 0) throw new Error(`ffmpeg -version failed: ${result.stderr || result.stdout}`);
  assertFfmpegVersion(result.stdout, PINNED_FFMPEG_VERSION);
}

function encodeOgg(mp3Path, oggPath) {
  const result = spawnSync('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-i', mp3Path,
    '-map_metadata', '-1', '-vn', '-ac', '2', '-ar', '24000',
    '-c:a', 'vorbis', '-strict', '-2', '-q:a', '5',
    '-f', 'ogg', oggPath,
  ], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg OGG encoding failed: ${result.stderr || result.stdout}`);
}

async function describeFormat(filePath, publicPath, format, encoderVersion) {
  const buffer = await fs.readFile(filePath);
  return {
    format,
    path: publicPath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
    provenance: {
      encoder: format === 'mp3' ? 'openai-audio-speech' : `ffmpeg-${PINNED_FFMPEG_VERSION}`,
      encoderVersion,
      sourceFormat: format === 'mp3' ? 'text' : 'mp3',
    },
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  assertFfmpegAvailable();
  const document = parseYaml(await fs.readFile(npcsPath, 'utf8'));
  const lines = collectGreetingLines(document);
  await fs.mkdir(outputDir, { recursive: true });

  const manifest = await readManifest();
  const clipsById = new Map(manifest.clips.map((clip) => [clip.lineId, clip]));

  for (const line of lines) {
    const mp3Path = path.join(outputDir, `${line.lineId}.mp3`);
    const oggPath = path.join(outputDir, `${line.lineId}.ogg`);
    const mp3PublicPath = `/audio/voices/npc/${line.lineId}.mp3`;
    const oggPublicPath = `/audio/voices/npc/${line.lineId}.ogg`;
    const existing = clipsById.get(line.lineId);

    // Legacy clips predate generationHash; adopt them once when the rest of
    // the identity matches, so the hash is stamped without re-billing.
    const identityMatches = existing?.generationHash === line.generationHash
      || (existing?.generationHash === undefined
        && existing?.textHash === line.textHash
        && existing.model === model
        && existing.voice === line.voice);
    const canReuse = identityMatches && await fileExists(mp3Path);

    if (!canReuse) {
      console.log(`Generating ${line.lineId} (${line.voice})`);
      await fs.writeFile(mp3Path, await generateSpeech(line));
      encodeOgg(mp3Path, oggPath);
    } else if (!await fileExists(oggPath)) {
      encodeOgg(mp3Path, oggPath);
    } else {
      console.log(`Reusing unchanged ${line.lineId}`);
    }

    clipsById.set(line.lineId, {
      lineId: line.lineId,
      textHash: line.textHash,
      generationHash: line.generationHash,
      path: mp3PublicPath,
      model,
      voice: line.voice,
      durationMs: null,
      formats: [
        await describeFormat(mp3Path, mp3PublicPath, 'mp3', model),
        await describeFormat(oggPath, oggPublicPath, 'ogg', PINNED_FFMPEG_VERSION),
      ],
    });
  }

  manifest.clips = [...clipsById.values()].sort((a, b) => a.lineId.localeCompare(b.lineId));
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ voice manifest updated (${lines.length} NPC greeting lines)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
