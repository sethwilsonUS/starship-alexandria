import { describe, expect, it } from 'vitest';
import {
  assertFfmpegVersion,
  validateAudioFormatGroups,
} from '../../../../scripts/lib/asset-validation.mjs';

describe('asset manifest audio format validation', () => {
  it('accepts exactly one OGG and one MP3 for each logical sound', () => {
    expect(validateAudioFormatGroups([
      { kind: 'audio', path: 'game-assets/audio/cue.ogg', logicalName: 'cue' },
      { kind: 'audio', path: 'game-assets/audio/cue.mp3', logicalName: 'cue' },
    ])).toEqual({ errors: [], pairCount: 1 });
  });

  it('rejects duplicate, unexpected, and unnamed audio formats', () => {
    const result = validateAudioFormatGroups([
      { kind: 'audio', path: 'game-assets/audio/cue.ogg', logicalName: 'cue' },
      { kind: 'audio', path: 'game-assets/audio/cue-copy.ogg', logicalName: 'cue' },
      { kind: 'audio', path: 'game-assets/audio/cue.wav', logicalName: 'cue' },
      { kind: 'audio', path: 'game-assets/audio/orphan.mp3', logicalName: '   ' },
    ]);

    expect(result.pairCount).toBe(1);
    expect(result.errors).toEqual([
      'game-assets/audio/orphan.mp3: audio assets require a non-empty logicalName',
      'cue: audio must provide exactly one OGG and one MP3; found ogg=2, mp3=0, unexpected=wav',
    ]);
  });

  it('rejects case-variant extensions instead of bypassing signature checks', () => {
    expect(validateAudioFormatGroups([
      { kind: 'audio', path: 'game-assets/audio/cue.OGG', logicalName: 'cue' },
      { kind: 'audio', path: 'game-assets/audio/cue.mp3', logicalName: 'cue' },
    ]).errors).toEqual([
      'cue: audio must provide exactly one OGG and one MP3; found ogg=0, mp3=1, unexpected=OGG',
    ]);
  });
});

describe('asset refresh toolchain validation', () => {
  it('accepts only the exact pinned ffmpeg release', () => {
    expect(() => assertFfmpegVersion('ffmpeg version 8.1 Copyright', '8.1')).not.toThrow();
    expect(() => assertFfmpegVersion('ffmpeg version 8.1.1 Copyright', '8.1')).toThrow(
      'Asset refresh requires ffmpeg 8.1; received 8.1.1',
    );
    expect(() => assertFfmpegVersion('unexpected banner', '8.1')).toThrow(
      'Unable to determine ffmpeg version',
    );
  });
});
