import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  playCue,
  playFootstep,
  resolveAudioPolicy,
  startAmbience,
  stopAmbience,
} from '../AudioDirector';
import { ASSET_KEYS } from '@/game/assets/assetManifest';

interface TestSound {
  volume: number;
  volumeNode: { gain: object } | null;
  isPlaying: boolean;
  isPaused: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
}

function createTestSound(): TestSound {
  const sound: TestSound = {
    volume: 0,
    volumeNode: { gain: {} },
    isPlaying: false,
    isPaused: false,
    play: vi.fn(() => {
      sound.isPlaying = true;
      return true;
    }),
    pause: vi.fn(() => {
      sound.isPlaying = false;
      sound.isPaused = true;
      return true;
    }),
    resume: vi.fn(() => {
      sound.isPlaying = true;
      sound.isPaused = false;
      return true;
    }),
    stop: vi.fn(() => {
      sound.isPlaying = false;
      sound.isPaused = false;
      return true;
    }),
    destroy: vi.fn(),
    setVolume: vi.fn((value: number) => {
      sound.volume = value;
      return sound;
    }),
  };
  return sound;
}

function createAudioHarness(options: { deferFades?: boolean; soundCount?: number } = {}) {
  const fadeCallbacks: Array<() => void> = [];
  const sounds = Array.from(
    { length: options.soundCount ?? 1 },
    () => createTestSound(),
  );
  let soundIndex = 0;
  const addEvent = vi.fn((config: { callback: () => void; repeat?: number }) => {
    const calls = (config.repeat ?? 0) + 1;
    for (let index = 0; index < calls; index += 1) {
      if (options.deferFades) fadeCallbacks.push(config.callback);
      else config.callback();
    }
    return {};
  });
  const scene = {
    sound: {
      add: vi.fn(() => sounds[soundIndex++] ?? sounds.at(-1)),
      play: vi.fn(),
    },
    time: { addEvent },
  } as unknown as Phaser.Scene;

  return { fadeCallbacks, scene, sound: sounds[0], sounds };
}

describe('resolveAudioPolicy', () => {
  it('keeps every Phaser channel silent before the launch gesture', () => {
    expect(resolveAudioPolicy({
      audioUnlocked: false,
      sfxEnabled: true,
      ambienceEnabled: true,
      masterVolume: 1,
    })).toEqual({ sfxVolume: 0, ambienceVolume: 0 });
  });

  it('applies the shared master level and channel preferences', () => {
    expect(resolveAudioPolicy({
      audioUnlocked: true,
      sfxEnabled: true,
      ambienceEnabled: false,
      masterVolume: 0.5,
    })).toEqual({ sfxVolume: 0.5, ambienceVolume: 0 });
  });
});

describe('active ambience policy', () => {
  it('silences and pauses a live loop at zero, then restores its current master level', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { scene, sound } = createAudioHarness();
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        sfxEnabled: true,
        masterVolume: 0.8,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-test');
    expect(sound.volume).toBeCloseTo(0.144);

    useGameStore.getState().actions.setMasterVolume(0);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0);
    expect(sound.pause).toHaveBeenCalledTimes(1);

    useGameStore.getState().actions.setMasterVolume(0.4);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.072);
    expect(sound.resume).toHaveBeenCalledTimes(1);

    stopAmbience(scene);
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('keeps live ambience and future cues synchronized with independent channel preferences', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { scene, sound } = createAudioHarness();
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        sfxEnabled: true,
        masterVolume: 0.6,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-test');
    useGameStore.getState().actions.setAmbienceEnabled(false);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0);
    expect(sound.pause).toHaveBeenCalledTimes(1);

    useGameStore.getState().actions.setSfxEnabled(false);
    useGameStore.getState().actions.setAmbienceEnabled(true);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.108);
    expect(sound.resume).toHaveBeenCalledTimes(1);

    playCue(scene, 'cue-test', 0.5);
    expect(scene.sound.play).not.toHaveBeenCalled();
    useGameStore.getState().actions.setSfxEnabled(true);
    playCue(scene, 'cue-test', 0.5);
    expect(scene.sound.play).toHaveBeenCalledWith('cue-test', { volume: 0.3 });

    stopAmbience(scene);
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('abandons delayed fades before touching a WebAudio sound whose gain node was destroyed', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { fadeCallbacks, scene, sound } = createAudioHarness({ deferFades: true });
    sound.setVolume.mockImplementation((value: number) => {
      if (!sound.volumeNode) throw new TypeError('volumeNode is null');
      sound.volume = value;
      return sound;
    });
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        masterVolume: 0.7,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-test');
    sound.volumeNode = null;

    expect(() => fadeCallbacks.forEach((callback) => callback())).not.toThrow();
    expect(sound.setVolume).not.toHaveBeenCalled();
    expect(sound.destroy).toHaveBeenCalledTimes(1);

    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('cancels an in-flight fade before a live mute can be overwritten', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { fadeCallbacks, scene, sound } = createAudioHarness({ deferFades: true });
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        masterVolume: 0.8,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-test');
    useGameStore.getState().actions.setMasterVolume(0);
    fadeCallbacks.forEach((callback) => callback());

    expect(sound.setVolume).toHaveBeenCalledTimes(1);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0);
    expect(sound.pause).toHaveBeenCalledTimes(1);

    useGameStore.getState().actions.setMasterVolume(0.4);
    expect(sound.setVolume).toHaveBeenLastCalledWith(0.072);
    expect(sound.resume).toHaveBeenCalledTimes(1);

    stopAmbience(scene);
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('immediately silences every live loop during a crossfade when ambience is disabled', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { fadeCallbacks, scene, sounds } = createAudioHarness({
      deferFades: true,
      soundCount: 2,
    });
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        masterVolume: 0.8,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-one');
    fadeCallbacks.splice(0).forEach((callback) => callback());
    startAmbience(scene, 'ambience-two');

    useGameStore.getState().actions.setAmbienceEnabled(false);
    expect(sounds[0].setVolume).toHaveBeenLastCalledWith(0);
    expect(sounds[0].pause).toHaveBeenCalledTimes(1);
    expect(sounds[1].setVolume).toHaveBeenLastCalledWith(0);
    expect(sounds[1].pause).toHaveBeenCalledTimes(1);

    const callsAtMute = sounds.map((sound) => sound.setVolume.mock.calls.length);
    fadeCallbacks.splice(0).forEach((callback) => callback());
    expect(sounds.map((sound) => sound.setVolume.mock.calls.length)).toEqual(callsAtMute);

    stopAmbience(scene);
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('starts the requested scene ambience when the preference is enabled live', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { scene, sound } = createAudioHarness();
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: false,
        masterVolume: 0.7,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-test');
    expect(scene.sound.add).not.toHaveBeenCalled();

    useGameStore.getState().actions.setAmbienceEnabled(true);
    expect(scene.sound.add).toHaveBeenCalledTimes(1);
    expect(sound.play).toHaveBeenCalledTimes(1);
    expect(sound.volume).toBeCloseTo(0.126);

    stopAmbience(scene);
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('keeps the current loop active when its replacement cannot start', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { scene, sounds } = createAudioHarness({ soundCount: 2 });
    sounds[1].play.mockReturnValue(false);
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        masterVolume: 0.8,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-one');
    startAmbience(scene, 'ambience-two');
    startAmbience(scene, 'ambience-one');

    expect(scene.sound.add).toHaveBeenCalledTimes(2);
    expect(sounds[0].destroy).not.toHaveBeenCalled();
    expect(sounds[0].setVolume).toHaveBeenLastCalledWith(0.144);

    stopAmbience(scene);
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });

  it('starts newly requested ambience when a hidden page becomes visible', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const browserDocument = Object.assign(new EventTarget(), { hidden: false });
    const { scene, sounds } = createAudioHarness({ soundCount: 2 });
    vi.stubGlobal('document', browserDocument);
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        ambienceEnabled: true,
        masterVolume: 0.7,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    startAmbience(scene, 'ambience-visible');
    browserDocument.hidden = true;
    browserDocument.dispatchEvent(new Event('visibilitychange'));
    startAmbience(scene, 'ambience-hidden');
    expect(scene.sound.add).toHaveBeenCalledTimes(1);

    browserDocument.hidden = false;
    browserDocument.dispatchEvent(new Event('visibilitychange'));
    const addCallCount = vi.mocked(scene.sound.add).mock.calls.length;
    const replacementPlayCallCount = sounds[1].play.mock.calls.length;

    stopAmbience(scene);
    vi.unstubAllGlobals();
    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));

    expect(addCallCount).toBe(2);
    expect(replacementPlayCallCount).toBe(1);
  });
});

describe('surface-aware footsteps', () => {
  it('uses the destination surface bank and advances only after an audible step', () => {
    const originalSettings = useGameStore.getState().settings;
    const originalAudioUnlocked = useGameStore.getState().session.audioUnlocked;
    const { scene } = createAudioHarness();
    useGameStore.setState((state) => ({
      settings: {
        ...state.settings,
        sfxEnabled: true,
        masterVolume: 0.5,
      },
      session: { ...state.session, audioUnlocked: true },
    }));

    expect(playFootstep(scene, 'water', 0)).toBe(1);
    expect(scene.sound.play).toHaveBeenLastCalledWith(
      ASSET_KEYS.audio.footsteps.water[0],
      { volume: 0.21 },
    );

    useGameStore.getState().actions.setSfxEnabled(false);
    expect(playFootstep(scene, 'stone', 1)).toBe(1);
    expect(scene.sound.play).toHaveBeenCalledTimes(1);

    useGameStore.setState((state) => ({
      settings: originalSettings,
      session: { ...state.session, audioUnlocked: originalAudioUnlocked },
    }));
  });
});
