import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearVoiceManifestCacheForTests,
  findVoiceClip,
  loadVoiceManifest,
  validateVoiceManifest,
  type VoiceManifest,
} from '../voiceManifest';

const baseManifest: VoiceManifest = {
  version: 1,
  generatedAt: '2026-05-19T00:00:00.000Z',
  clips: [
    {
      lineId: 'opening.arrival.1',
      textHash: 'hash-1',
      path: '/audio/voices/opening.arrival.1.mp3',
      model: 'tts-test',
      voice: 'voice-test',
      durationMs: 1200,
    },
  ],
};

describe('findVoiceClip', () => {
  it('returns the matching clip by line id', () => {
    expect(findVoiceClip(baseManifest, 'opening.arrival.1')).toBe(baseManifest.clips[0]);
  });

  it('returns null when no clip matches the line id', () => {
    expect(findVoiceClip(baseManifest, 'missing.line')).toBeNull();
  });
});

describe('validateVoiceManifest', () => {
  it('returns no errors for a valid manifest', () => {
    expect(validateVoiceManifest(baseManifest)).toEqual([]);
  });

  it('reports malformed top-level manifest fields without throwing', () => {
    expect(validateVoiceManifest(null)).toContain('manifest must be an object');

    const errors = validateVoiceManifest({
      version: 2,
      generatedAt: '2026-05-19T00:00:00.000Z',
      clips: 'not-an-array',
    });

    expect(errors).toContain('unsupported version');
    expect(errors).toContain('clips must be an array');
  });

  it('reports missing required clip fields', () => {
    const errors = validateVoiceManifest({
      version: 1,
      generatedAt: '2026-05-19T00:00:00.000Z',
      clips: [
        {
          lineId: '',
          textHash: 'hash-1',
          path: '',
          model: 'tts-test',
          voice: 'voice-test',
          durationMs: null,
        },
      ],
    });

    expect(errors).toContain('missing clip lineId at index 0');
    expect(errors).toContain('missing clip path at index 0');
  });

  it('reports duplicate line ids', () => {
    const errors = validateVoiceManifest({
      ...baseManifest,
      clips: [
        baseManifest.clips[0],
        {
          ...baseManifest.clips[0],
          path: '/audio/voices/opening.arrival.1-alt.mp3',
        },
      ],
    });

    expect(errors).toContain('duplicate line id: opening.arrival.1');
  });
});

describe('loadVoiceManifest', () => {
  beforeEach(() => {
    clearVoiceManifestCacheForTests();
  });

  afterEach(() => {
    clearVoiceManifestCacheForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null on the server without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadVoiceManifest()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and caches the browser manifest', async () => {
    const json = vi.fn().mockResolvedValue(baseManifest);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([loadVoiceManifest(), loadVoiceManifest()]);
    const third = await loadVoiceManifest();

    expect(first).toEqual(baseManifest);
    expect(second).toEqual(baseManifest);
    expect(third).toEqual(baseManifest);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/audio/voices/manifest.json');
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('returns null when the manifest response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadVoiceManifest()).resolves.toBeNull();
  });

  it('warns and returns null for an invalid fetched manifest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        version: 1,
        generatedAt: '2026-05-19T00:00:00.000Z',
        clips: [
          {
            lineId: 'opening.arrival.1',
            textHash: 'hash-1',
            path: '',
            model: 'tts-test',
            voice: 'voice-test',
            durationMs: null,
          },
        ],
      }),
    });
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadVoiceManifest()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'Invalid voice manifest:',
      expect.arrayContaining(['missing clip path at index 0']),
    );
  });

  it('warns and returns null when fetching fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('network down');
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadVoiceManifest()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('Failed to load voice manifest:', error);
  });
});
