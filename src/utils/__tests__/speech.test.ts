import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearVoiceManifestCacheForTests, type VoiceManifest } from '../voiceManifest';
import {
  cancelSpeech,
  playBumpSound,
  playDiscoveryChime,
  setAudioUnlockedGlobal,
  setBrowserTtsFallbackEnabled,
  setMasterVolumeGlobal,
  setSfxEnabledGlobal,
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
      formats: [
        {
          format: 'mp3',
          path: '/audio/voices/opening/opening.welcome.01.mp3',
          bytes: 100,
          sha256: 'a'.repeat(64),
          provenance: {
            encoder: 'openai-audio-speech',
            encoderVersion: 'gpt-4o-mini-tts',
            sourceFormat: 'text',
          },
        },
        {
          format: 'ogg',
          path: '/audio/voices/opening/opening.welcome.01.ogg',
          bytes: 90,
          sha256: 'b'.repeat(64),
          provenance: {
            encoder: 'ffmpeg',
            encoderVersion: '8.1',
            sourceFormat: 'mp3',
          },
        },
      ],
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
  const instances: Array<{
    src: string;
    pause: ReturnType<typeof vi.fn>;
    currentTime: number;
    volume: number;
  }> = [];
  const playMock = vi.fn(playImpl);

  class TestAudio {
    currentTime = 0;
    volume = 1;
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
  setAudioUnlockedGlobal(true);
  setTTSEnabledGlobal(true);
  setSfxEnabledGlobal(true);
  setMasterVolumeGlobal(0.7);
  setBrowserTtsFallbackEnabled(false);
});

afterEach(() => {
  cancelSpeech();
  clearVoiceManifestCacheForTests();
  setAudioUnlockedGlobal(false);
  setTTSEnabledGlobal(true);
  setSfxEnabledGlobal(true);
  setMasterVolumeGlobal(0.7);
  setBrowserTtsFallbackEnabled(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('speak', () => {
  it('does not construct or play narration before the launch gesture unlocks audio', async () => {
    const synth = installBrowserSpeech();
    const fetchMock = installManifestFetch();
    const { instances, play } = installAudio();
    setAudioUnlockedGlobal(false);

    speak('Dynamic room announcement.');
    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
      allowBrowserFallback: true,
    });
    await flushPromises();

    expect(synth.speak).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(instances).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });

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
    const onStart = vi.fn();

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
      onStart,
    });
    await flushPromises();

    expect(instances[0]?.src).toBe('/audio/voices/opening/opening.welcome.01.mp3');
    expect(play).toHaveBeenCalledTimes(1);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to browser TTS for missing local clips by default', async () => {
    const synth = installBrowserSpeech();
    installManifestFetch({ ...voiceManifest, clips: [] });
    installAudio();

    const onError = vi.fn();
    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
      onError,
    });
    await flushPromises();

    expect(synth.speak).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
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

  it('applies live master-volume changes to active local narration', async () => {
    installBrowserSpeech();
    installManifestFetch();
    const { instances } = installAudio();

    speak('Welcome aboard the Starship Alexandria.', {
      voiceLineId: 'opening.welcome.01',
    });
    await flushPromises();
    setMasterVolumeGlobal(0.25);

    expect(instances[0]?.volume).toBe(0.25);
  });
});

describe('sound effects', () => {
  it('does not create an audio context before the launch gesture', () => {
    const AudioContextMock = vi.fn();
    vi.stubGlobal('window', { AudioContext: AudioContextMock });
    setAudioUnlockedGlobal(false);

    playBumpSound();

    expect(AudioContextMock).not.toHaveBeenCalled();
  });

  it('does not create or schedule browser tones at zero master volume', () => {
    const createOscillator = vi.fn();
    const createGain = vi.fn();
    const AudioContextMock = vi.fn(class {
      state = 'running';
      currentTime = 0;
      createOscillator = createOscillator;
      createGain = createGain;
    });
    vi.stubGlobal('window', { AudioContext: AudioContextMock });
    setMasterVolumeGlobal(0);

    playBumpSound();
    playDiscoveryChime();

    expect(AudioContextMock).not.toHaveBeenCalled();
    expect(createOscillator).not.toHaveBeenCalled();
    expect(createGain).not.toHaveBeenCalled();
  });

  it('ramps audible browser tones all the way to silence without exponential zero targets', () => {
    const gainParams = Array.from({ length: 2 }, () => ({
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    }));
    let gainIndex = 0;
    const createGain = vi.fn(() => ({
      connect: vi.fn(),
      gain: gainParams[gainIndex++],
    }));
    const createOscillator = vi.fn(() => ({
      connect: vi.fn(),
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
      type: 'sine',
    }));
    const AudioContextMock = vi.fn(class {
      state = 'running';
      currentTime = 12;
      destination = {};
      createOscillator = createOscillator;
      createGain = createGain;
      resume = vi.fn();
    });
    vi.stubGlobal('window', { AudioContext: AudioContextMock });
    setMasterVolumeGlobal(0.5);

    playBumpSound();
    playDiscoveryChime();

    expect(gainParams[0].cancelScheduledValues).toHaveBeenCalledWith(12);
    expect(gainParams[0].linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 12.1);
    expect(gainParams[1].cancelScheduledValues).toHaveBeenCalledWith(12);
    expect(gainParams[1].linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 12.4);
    expect(gainParams[0].exponentialRampToValueAtTime).not.toHaveBeenCalled();
    expect(gainParams[1].exponentialRampToValueAtTime).not.toHaveBeenCalled();

    setMasterVolumeGlobal(0);
    playBumpSound();
    playDiscoveryChime();
    expect(createOscillator).toHaveBeenCalledTimes(2);
    expect(createGain).toHaveBeenCalledTimes(2);
  });
});
