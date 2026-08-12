import type { FootstepSurface } from '@/game/expeditions';
import { ASSET_KEYS } from '@/game/assets/assetManifest';
import { useGameStore } from '@/store/gameStore';
import { onNarrationActivity } from '@/utils/speech';

export interface AudioPolicyInput {
  audioUnlocked: boolean;
  sfxEnabled: boolean;
  ambienceEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
}

export function resolveAudioPolicy(input: AudioPolicyInput): {
  sfxVolume: number;
  ambienceVolume: number;
  musicVolume: number;
} {
  const master = Math.min(1, Math.max(0, input.masterVolume));
  if (!input.audioUnlocked) return { sfxVolume: 0, ambienceVolume: 0, musicVolume: 0 };
  return {
    sfxVolume: input.sfxEnabled ? master : 0,
    ambienceVolume: input.ambienceEnabled ? master : 0,
    musicVolume: input.musicEnabled ? master : 0,
  };
}

type VolumeSound = Phaser.Sound.BaseSound & {
  volume: number;
  setVolume: (value: number) => VolumeSound;
};

type SoundBackendState = {
  pendingRemove?: boolean;
  volumeNode?: { gain: unknown } | null;
};

let visibilityListenerInstalled = false;
let policyListenerInstalled = false;
const fadeGenerations = new WeakMap<VolumeSound, number>();

/** While narration speaks, the loop channels sit back at this fraction. */
const NARRATION_DUCK_FACTOR = 0.35;
let narrationDucked = false;

function currentPolicy() {
  // E2E exercises audio policy and asset requests without sending output to
  // the workstation's speakers. Production bundles inline this as false.
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return { sfxVolume: 0, ambienceVolume: 0, musicVolume: 0 };
  }
  const state = useGameStore.getState();
  return resolveAudioPolicy({
    audioUnlocked: state.session.audioUnlocked,
    sfxEnabled: state.settings.sfxEnabled,
    ambienceEnabled: state.settings.ambienceEnabled,
    musicEnabled: state.settings.musicEnabled,
    masterVolume: state.settings.masterVolume,
  });
}

export function playCue(scene: Phaser.Scene, key: string, baseVolume = 1): void {
  const volume = currentPolicy().sfxVolume * baseVolume;
  if (volume <= 0) return;
  scene.sound.play(key, { volume });
}

export function playFootstep(
  scene: Phaser.Scene,
  surface: FootstepSurface,
  sequenceIndex: number,
): number {
  const volume = currentPolicy().sfxVolume * 0.42;
  if (volume <= 0) return sequenceIndex;
  const keys = footstepKeys(surface);
  scene.sound.play(keys[sequenceIndex % keys.length], { volume });
  return sequenceIndex + 1;
}

/**
 * A persistent looping channel (ambience bed or music pad) with crossfade,
 * tab-visibility pause, and live policy tracking.
 */
interface LoopChannel {
  start(scene: Phaser.Scene, key: string): void;
  stop(scene: Phaser.Scene): void;
  syncPolicy(): void;
  handleVisibility(hidden: boolean): void;
}

function createLoopChannel(volumeScale: number, selectVolume: (policy: ReturnType<typeof currentPolicy>) => number): LoopChannel {
  let current: VolumeSound | null = null;
  let currentKey: string | null = null;
  let requested: { scene: Phaser.Scene; key: string } | null = null;
  let pausedForVisibility = false;
  const activeSounds = new Set<VolumeSound>();

  const targetVolume = () =>
    selectVolume(currentPolicy()) * volumeScale * (narrationDucked ? NARRATION_DUCK_FACTOR : 1);

  const detachIfCurrent = (sound: VolumeSound) => {
    if (sound !== current) return;
    current = null;
    currentKey = null;
  };

  /** Fade-failure teardown: detach if live and always release the retained entry. */
  const releaseFailedSound = (sound: VolumeSound) => {
    detachIfCurrent(sound);
    activeSounds.delete(sound);
  };

  const destroySound = (sound: VolumeSound) => {
    cancelFade(sound);
    activeSounds.delete(sound);
    try {
      sound.stop();
    } catch {
      // The backend was never fully initialized.
    }
    try {
      sound.destroy();
    } catch {
      // Nothing further to release.
    }
  };

  const start = (scene: Phaser.Scene, key: string) => {
    requested = { scene, key };
    installVisibilityListener();
    installPolicyListener();
    const volume = targetVolume();
    if (volume <= 0 || (typeof document !== 'undefined' && document.hidden)) return;

    if (current && currentKey === key) {
      if (!safeSetVolume(current, volume)) {
        destroySound(current);
        current = null;
        currentKey = null;
        return;
      }
      if (current.isPaused) current.resume();
      return;
    }

    const previous = current;
    const previousKey = currentKey;
    let next: VolumeSound;
    try {
      next = scene.sound.add(key, { loop: true, volume: 0 }) as VolumeSound;
    } catch {
      return;
    }
    current = next;
    currentKey = key;
    activeSounds.add(next);
    try {
      if (!next.play()) {
        destroySound(next);
        current = previous;
        currentKey = previousKey;
        return;
      }
    } catch {
      destroySound(next);
      current = previous;
      currentKey = previousKey;
      return;
    }
    fadeSound(scene, next, volume, 700, undefined, releaseFailedSound);
    if (previous) {
      fadeSound(scene, previous, 0, 500, () => {
        if (previous !== current) {
          destroySound(previous);
        }
      }, releaseFailedSound);
    }
  };

  const stop = (scene: Phaser.Scene) => {
    requested = null;
    const sound = current;
    if (!sound) return;
    current = null;
    currentKey = null;
    fadeSound(scene, sound, 0, 350, () => {
      destroySound(sound);
    }, releaseFailedSound);
  };

  const syncPolicy = () => {
    const sound = current;
    const volume = targetVolume();
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (!sound) {
      if (volume > 0 && !hidden && requested) {
        const { scene, key } = requested;
        start(scene, key);
      }
      return;
    }
    for (const outgoing of activeSounds) {
      if (outgoing === sound) continue;
      cancelFade(outgoing);
      safeSetVolume(outgoing, 0);
      try {
        if (outgoing.isPlaying) outgoing.pause();
      } catch {
        // A destroyed outgoing backend needs no further policy work.
      }
      destroySound(outgoing);
    }
    cancelFade(sound);
    if (volume <= 0 || hidden) {
      if (!safeSetVolume(sound, 0)) {
        destroySound(sound);
        current = null;
        currentKey = null;
        return;
      }
      try {
        if (sound.isPlaying) sound.pause();
      } catch {
        // A scene can disappear while a persisted preference is being applied.
      }
      return;
    }

    if (!safeSetVolume(sound, volume)) {
      destroySound(sound);
      current = null;
      currentKey = null;
      return;
    }
    try {
      if (sound.isPaused) sound.resume();
    } catch {
      // A destroyed backend is treated as silence.
    }
  };

  const handleVisibility = (hidden: boolean) => {
    const sound = current;
    if (hidden) {
      if (!sound) return;
      try {
        pausedForVisibility = sound.isPlaying;
        if (pausedForVisibility) sound.pause();
      } catch {
        // A dead backend has nothing left to pause; drop it so the other
        // channel keeps working.
        releaseFailedSound(sound);
        pausedForVisibility = false;
      }
      return;
    }
    if (requested && requested.key !== currentKey) {
      pausedForVisibility = false;
      const { scene, key } = requested;
      start(scene, key);
      return;
    }
    if (!sound) {
      syncPolicy();
      return;
    }
    try {
      if (pausedForVisibility && targetVolume() > 0) sound.resume();
    } catch {
      releaseFailedSound(sound);
    }
    pausedForVisibility = false;
  };

  return { start, stop, syncPolicy, handleVisibility };
}

const ambienceChannel = createLoopChannel(0.18, (policy) => policy.ambienceVolume);
const musicChannel = createLoopChannel(0.14, (policy) => policy.musicVolume);
const loopChannels = [ambienceChannel, musicChannel];

export function startAmbience(scene: Phaser.Scene, key: string): void {
  ambienceChannel.start(scene, key);
}

export function stopAmbience(scene: Phaser.Scene): void {
  ambienceChannel.stop(scene);
}

export function startMusic(scene: Phaser.Scene, key: string): void {
  musicChannel.start(scene, key);
}

export function stopMusic(scene: Phaser.Scene): void {
  musicChannel.stop(scene);
}

/** Narration ducking: the beds sit back while a voice speaks, then recover. */
export function setNarrationDucking(active: boolean): void {
  if (narrationDucked === active) return;
  narrationDucked = active;
  for (const channel of loopChannels) channel.syncPolicy();
}

onNarrationActivity(setNarrationDucking);

function footstepKeys(surface: FootstepSurface): readonly string[] {
  switch (surface) {
    case 'stone': return ASSET_KEYS.audio.footsteps.stone;
    case 'water': return ASSET_KEYS.audio.footsteps.water;
    case 'sand': return ASSET_KEYS.audio.footsteps.sand;
    case 'wood': return ASSET_KEYS.audio.footsteps.gear;
    case 'grass':
    case 'dirt': return ASSET_KEYS.audio.footsteps.dirt;
  }
}

function fadeSound(
  scene: Phaser.Scene,
  sound: VolumeSound,
  target: number,
  durationMs: number,
  onComplete?: () => void,
  onBackendFailure?: (sound: VolumeSound) => void,
): void {
  if (!hasUsableVolumeBackend(sound)) {
    onBackendFailure?.(sound);
    safelyDestroySound(sound);
    onComplete?.();
    return;
  }
  let start = 0;
  try {
    start = Number.isFinite(sound.volume) ? sound.volume : 0;
  } catch {
    onBackendFailure?.(sound);
    safelyDestroySound(sound);
    onComplete?.();
    return;
  }
  const steps = 14;
  let step = 0;
  let failed = false;
  const generation = (fadeGenerations.get(sound) ?? 0) + 1;
  fadeGenerations.set(sound, generation);
  scene.time.addEvent({
    delay: durationMs / steps,
    repeat: steps - 1,
    callback: () => {
      if (failed || fadeGenerations.get(sound) !== generation) return;
      if (!hasUsableVolumeBackend(sound)) {
        failed = true;
        onBackendFailure?.(sound);
        safelyDestroySound(sound);
        onComplete?.();
        return;
      }
      step += 1;
      const progress = step / steps;
      if (!safeSetVolume(sound, start + (target - start) * progress)) {
        failed = true;
        onBackendFailure?.(sound);
        safelyDestroySound(sound);
        onComplete?.();
        return;
      }
      if (step === steps) onComplete?.();
    },
  });
}

function safeSetVolume(sound: VolumeSound, value: number): boolean {
  if (!hasUsableVolumeBackend(sound)) return false;
  try {
    sound.setVolume(value);
    return true;
  } catch {
    // Phaser's no-audio/partially initialized WebAudio backends may expose a
    // sound object without a gain node. Silence is the accessible fallback.
    return false;
  }
}

function hasUsableVolumeBackend(sound: VolumeSound): boolean {
  const backend = sound as VolumeSound & SoundBackendState;
  if (backend.pendingRemove) return false;
  return !('volumeNode' in backend) || backend.volumeNode !== null;
}

/** Fade-path teardown for sounds whose backend failed mid-flight. */
function safelyDestroySound(sound: VolumeSound): void {
  cancelFade(sound);
  try {
    sound.stop();
  } catch {
    // The backend was never fully initialized.
  }
  try {
    sound.destroy();
  } catch {
    // Nothing further to release.
  }
}

function cancelFade(sound: VolumeSound): void {
  fadeGenerations.set(sound, (fadeGenerations.get(sound) ?? 0) + 1);
}

function installPolicyListener(): void {
  if (policyListenerInstalled) return;
  policyListenerInstalled = true;
  useGameStore.subscribe((state, previousState) => {
    const policyChanged =
      state.session.audioUnlocked !== previousState.session.audioUnlocked
      || state.settings.ambienceEnabled !== previousState.settings.ambienceEnabled
      || state.settings.musicEnabled !== previousState.settings.musicEnabled
      || state.settings.masterVolume !== previousState.settings.masterVolume;
    if (policyChanged) {
      for (const channel of loopChannels) channel.syncPolicy();
    }
  });
}

function installVisibilityListener(): void {
  if (visibilityListenerInstalled || typeof document === 'undefined') return;
  visibilityListenerInstalled = true;
  document.addEventListener('visibilitychange', () => {
    for (const channel of loopChannels) channel.handleVisibility(document.hidden);
  });
}
