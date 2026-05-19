import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearVoiceManifestCacheForTests, type VoiceManifest } from '../voiceManifest';
import {
  cancelSpeech,
  setBrowserTtsFallbackEnabled,
  setTTSEnabledGlobal,
  speak,
} from '../speech';

const voiceManifest: VoiceManifest = {
  version: 1,
  generatedAt: '2026-05-19T00:00:00.000Z',
  clips: [
    {
      lineId: 'opening.welcome.01',
      textHash: 'hash-1',
      path: '/audio/voices/opening/opening.welcome.01.mp3',
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      durationMs: null,
    },
  ],
};

class TestUtterance {
  rate = 1;
  pitch = 1;

  constructor(public text: string) {}
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function installBrowserSpeech() {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn(),
  };

  vi.stubGlobal('window', { speechSynthesis: synth });
  vi.stubGlobal('SpeechSynthesisUtterance', TestUtterance);

  return synth;
}

function installManifestFetch(manifest: unknown = voiceManifest) {
  const json = vi.fn().mockResolvedValue(manifest);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function installAudio(playImpl: () => Promise<void> = () => Promise.resolve()) {
  const instances: Array<{ src: string; pause: ReturnType<typeof vi.fn>; currentTime: number }> = [];
  const playMock = vi.fn(playImpl);

  class TestAudio {
    currentTime = 0;
    pause = vi.fn();

    constructor(public src: string) {
      instances.push(this);
    }

    addEventListener = vi.fn();
    play = playMock;
  }

  vi.stubGlobal('Audio', TestAudio);

  return { instances, play: playMock };
}

beforeEach(() => {
  clearVoiceManifestCacheForTests();
  setTTSEnabledGlobal(true);
  setBrowserTtsFallbackEnabled(false);
});

afterEach(() => {
  cancelSpeech();
  clearVoiceManifestCacheForTests();
  setTTSEnabledGlobal(true);
  setBrowserTtsFallbackEnabled(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('speak', () => {
  it('uses browser TTS for dynamic text without a voice line id', () => {
    const synth = installBrowserSpeech();

    speak('Dynamic room announcement.');

    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Dynamic room announcement.' })
    );
  });

  it('plays a local voice clip for a matching voice line id', async () => {
    const synth = installBrowserSpeech();
    installManifestFetch();
    const { instances, play } = installAudio();

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
    });
    await flushPromises();

    expect(instances[0]?.src).toBe('/audio/voices/opening/opening.welcome.01.mp3');
    expect(play).toHaveBeenCalledTimes(1);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('does not fall back to browser TTS for missing local clips by default', async () => {
    const synth = installBrowserSpeech();
    installManifestFetch({ ...voiceManifest, clips: [] });
    installAudio();

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
    });
    await flushPromises();

    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('falls back to browser TTS for missing clips when explicitly allowed', async () => {
    const synth = installBrowserSpeech();
    installManifestFetch({ ...voiceManifest, clips: [] });
    installAudio();

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
      allowBrowserFallback: true,
    });
    await flushPromises();

    expect(synth.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Welcome aboard the Starship Alexandria.' })
    );
  });

  it('falls back to browser TTS for missing clips when global fallback is enabled', async () => {
    const synth = installBrowserSpeech();
    installManifestFetch({ ...voiceManifest, clips: [] });
    installAudio();
    setBrowserTtsFallbackEnabled(true);

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
      allowBrowserFallback: false,
    });
    await flushPromises();

    expect(synth.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Welcome aboard the Starship Alexandria.' })
    );
  });

  it('cancels active local audio', async () => {
    installBrowserSpeech();
    installManifestFetch();
    const { instances } = installAudio();

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
    });
    await flushPromises();

    cancelSpeech();

    expect(instances[0]?.pause).toHaveBeenCalledTimes(1);
    expect(instances[0]?.currentTime).toBe(0);
  });
});
