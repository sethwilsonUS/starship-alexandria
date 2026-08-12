#!/usr/bin/env node

/**
 * Synthesize the project's ambient music beds with the pinned ffmpeg.
 *
 * Each track is a slow generative pad: four detuned voice pairs on a
 * per-destination chord, swelling on independent tremolo cycles. Every
 * frequency (pitch, detune beat, and tremolo) is snapped to an integer
 * number of cycles per loop, and the encoded slice is taken from the
 * filter's steady state, so the loops are mathematically seamless.
 * Output is deterministic for a given ffmpeg version (bitexact flags,
 * no metadata), matching the committed-asset policy.
 */

import { execFile as execFileCallback } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assertFfmpegVersion } from './lib/asset-validation.mjs';

const execFile = promisify(execFileCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const MUSIC_ROOT = path.join(PUBLIC_ROOT, 'game-assets', 'audio', 'music');
const MANIFEST_PATH = path.join(PUBLIC_ROOT, 'game-assets', 'manifest.json');
const FFMPEG_COMMAND = process.env.FFMPEG ?? 'ffmpeg';

const SAMPLE_RATE = 44100;
const LOOP_SECONDS = 48;
/** Slice after the lowpass transient has settled into its periodic steady state. */
const STEADY_STATE_OFFSET_SECONDS = 2;
/** Slow beat between each voice's detuned pair: 12 cycles per loop = 4s shimmer. */
const DETUNE_HZ = 12 / LOOP_SECONDS;

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const snap = (frequency) => Math.round(frequency * LOOP_SECONDS) / LOOP_SECONDS;

/**
 * Voices are [frequency, amplitude, tremoloCyclesPerLoop, tremoloPhase].
 * Distinct prime-ish tremolo cycles keep the swells from aligning, so the
 * pad evolves for the whole loop instead of breathing in unison.
 *
 * Music is deliberately ship-only: the deck's engine-hum ambience is
 * atonal, so a pad layers cleanly there, while the surface soundscapes
 * carry their own minimal musicality and are left untouched. Add a
 * destination entry here only as an ambience replacement, not a layer.
 */
const TRACKS = [
  {
    logicalName: 'music-ship',
    description: 'warm A-major hum for the library deck',
    lowpassHz: 700,
    voices: [
      [110.0, 0.085, 3, 0.0],
      [164.81, 0.075, 5, 1.3],
      [220.0, 0.06, 7, 2.6],
      [329.63, 0.035, 4, 4.1],
    ],
  },
];

function voiceExpression([frequency, amplitude, tremoloCycles, tremoloPhase]) {
  const f1 = snap(frequency);
  const f2 = snap(frequency + DETUNE_HZ);
  const tremolo = tremoloCycles / LOOP_SECONDS;
  return `${amplitude}*(0.6+0.4*sin(2*PI*${tremolo}*t+${tremoloPhase}))*(sin(2*PI*${f1}*t)+sin(2*PI*${f2}*t))`;
}

async function synthesizeTrack(track, workDir) {
  const expression = track.voices.map(voiceExpression).join('+');
  const wavPath = path.join(workDir, `${track.logicalName}.wav`);
  const sliceEnd = STEADY_STATE_OFFSET_SECONDS + LOOP_SECONDS;
  await execFile(FFMPEG_COMMAND, [
    '-y', '-f', 'lavfi',
    '-i', `aevalsrc=${expression}:s=${SAMPLE_RATE}:d=${sliceEnd + 2}`,
    '-af', `lowpass=f=${track.lowpassHz},atrim=start=${STEADY_STATE_OFFSET_SECONDS}:end=${sliceEnd},asetpts=PTS-STARTPTS`,
    '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-ac', '1', '-map_metadata', '-1',
    wavPath,
  ], { maxBuffer: 16 * 1024 * 1024 });

  const oggPath = path.join(MUSIC_ROOT, `${track.logicalName}.ogg`);
  const mp3Path = path.join(MUSIC_ROOT, `${track.logicalName}.mp3`);
  await execFile(FFMPEG_COMMAND, [
    '-y', '-i', wavPath,
    '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-map_metadata', '-1', '-ac', '2', '-c:a', 'vorbis', '-strict', '-2', '-q:a', '3', oggPath,
  ], { maxBuffer: 16 * 1024 * 1024 });
  await execFile(FFMPEG_COMMAND, [
    '-y', '-i', wavPath,
    '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-map_metadata', '-1', '-ac', '2', '-codec:a', 'libmp3lame', '-q:a', '6', '-write_xing', '0', mp3Path,
  ], { maxBuffer: 16 * 1024 * 1024 });

  return [oggPath, mp3Path];
}

async function manifestEntry(filePath, track) {
  const buffer = await fs.readFile(filePath);
  const extension = path.extname(filePath).slice(1);
  return {
    path: path.relative(PUBLIC_ROOT, filePath).split(path.sep).join('/'),
    kind: 'audio',
    mediaType: extension === 'ogg' ? 'audio/ogg' : 'audio/mpeg',
    sourceIds: ['project'],
    logicalName: track.logicalName,
    transformation: `Project-generated seamless ${LOOP_SECONDS}s ambient pad (${track.description}): detuned sine voice pairs on loop-periodic frequencies with independent tremolo cycles, lowpass ${track.lowpassHz} Hz, synthesized and encoded with the pinned ffmpeg (bitexact, no metadata)`,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

async function main() {
  const { stdout } = await execFile(FFMPEG_COMMAND, ['-version'], { maxBuffer: 1024 * 1024 });
  assertFfmpegVersion(stdout);

  await fs.mkdir(MUSIC_ROOT, { recursive: true });
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'starship-music-'));

  const entries = [];
  for (const track of TRACKS) {
    const outputs = await synthesizeTrack(track, workDir);
    for (const output of outputs) entries.push(await manifestEntry(output, track));
    console.log(`✓ ${track.logicalName}`);
  }
  await fs.rm(workDir, { recursive: true, force: true });

  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  const kept = manifest.assets.filter((record) => !record.path.startsWith('game-assets/audio/music/'));
  const lastAudioIndex = kept.reduce(
    (last, record, index) => (record.path.startsWith('game-assets/audio/') ? index : last),
    -1,
  );
  kept.splice(lastAudioIndex + 1, 0, ...entries.sort((a, b) => a.path.localeCompare(b.path)));
  manifest.assets = kept;
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ manifest updated with ${entries.length} music entries`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
