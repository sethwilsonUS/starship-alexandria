import type { FootstepSurface } from '@/game/expeditions';
import { ASSET_KEYS } from '@/game/assets/assetManifest';
import { useGameStore } from '@/store/gameStore';

export interface AudioPolicyInput {
  audioUnlocked: boolean;
  sfxEnabled: boolean;
  ambienceEnabled: boolean;
  masterVolume: number;
}

export function resolveAudioPolicy(input: AudioPolicyInput): {
  sfxVolume: number;
  ambienceVolume: number;
} {
  const master = Math.min(1, Math.max(0, input.masterVolume));
  if (!input.audioUnlocked) return { sfxVolume: 0, ambienceVolume: 0 };
  return {
    sfxVolume: input.sfxEnabled ? master : 0,
    ambienceVolume: input.ambienceEnabled ? master : 0,
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

let currentAmbience: VolumeSound | null = null;
let currentAmbienceKey: string | null = null;
let visibilityListenerInstalled = false;
let policyListenerInstalled = false;
let pausedForVisibility = false;
const fadeGenerations = new WeakMap<VolumeSound, number>();
const activeAmbienceSounds = new Set<VolumeSound>();
let requestedAmbience: { scene: Phaser.Scene; key: string } | null = null;

function currentPolicy() {
  const state = useGameStore.getState();
  return resolveAudioPolicy({
    audioUnlocked: state.session.audioUnlocked,
    sfxEnabled: state.settings.sfxEnabled,
    ambienceEnabled: state.settings.ambienceEnabled,
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

export function startAmbience(scene: Phaser.Scene, key: string): void {
  requestedAmbience = { scene, key };
  installVisibilityListener();
  installPolicyListener();
  const targetVolume = currentPolicy().ambienceVolume * 0.18;
  if (targetVolume <= 0 || (typeof document !== 'undefined' && document.hidden)) return;

  if (currentAmbience && currentAmbienceKey === key) {
    if (!safeSetVolume(currentAmbience, targetVolume)) {
      safelyDestroy(currentAmbience);
      currentAmbience = null;
      currentAmbienceKey = null;
      return;
    }
    if (currentAmbience.isPaused) currentAmbience.resume();
    return;
  }

  const previous = currentAmbience;
  const previousKey = currentAmbienceKey;
  let next: VolumeSound;
  try {
    next = scene.sound.add(key, { loop: true, volume: 0 }) as VolumeSound;
  } catch {
    return;
  }
  currentAmbience = next;
  currentAmbienceKey = key;
  activeAmbienceSounds.add(next);
  try {
    if (!next.play()) {
      safelyDestroy(next);
      currentAmbience = previous;
      currentAmbienceKey = previousKey;
      return;
    }
  } catch {
    safelyDestroy(next);
    currentAmbience = previous;
    currentAmbienceKey = previousKey;
    return;
  }
  fadeSound(scene, next, targetVolume, 700);
  if (previous) {
    fadeSound(scene, previous, 0, 500, () => {
      if (previous !== currentAmbience) {
        safelyDestroy(previous);
      }
    });
  }
}

export function stopAmbience(scene: Phaser.Scene): void {
  requestedAmbience = null;
  const sound = currentAmbience;
  if (!sound) return;
  currentAmbience = null;
  currentAmbienceKey = null;
  fadeSound(scene, sound, 0, 350, () => {
    safelyDestroy(sound);
  });
}

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
): void {
  if (!hasUsableVolumeBackend(sound)) {
    detachFailedSound(sound);
    safelyDestroy(sound);
    onComplete?.();
    return;
  }
  let start = 0;
  try {
    start = Number.isFinite(sound.volume) ? sound.volume : 0;
  } catch {
    detachFailedSound(sound);
    safelyDestroy(sound);
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
        detachFailedSound(sound);
        safelyDestroy(sound);
        onComplete?.();
        return;
      }
      step += 1;
      const progress = step / steps;
      if (!safeSetVolume(sound, start + (target - start) * progress)) {
        failed = true;
        detachFailedSound(sound);
        safelyDestroy(sound);
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

function detachFailedSound(sound: VolumeSound): void {
  if (sound !== currentAmbience) return;
  currentAmbience = null;
  currentAmbienceKey = null;
}

function safelyDestroy(sound: VolumeSound): void {
  cancelFade(sound);
  activeAmbienceSounds.delete(sound);
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
      || state.settings.masterVolume !== previousState.settings.masterVolume;
    if (policyChanged) syncCurrentAmbiencePolicy();
  });
}

function syncCurrentAmbiencePolicy(): void {
  const sound = currentAmbience;
  const targetVolume = currentPolicy().ambienceVolume * 0.18;
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (!sound) {
    if (targetVolume > 0 && !hidden && requestedAmbience) {
      const { scene, key } = requestedAmbience;
      startAmbience(scene, key);
    }
    return;
  }
  for (const outgoing of activeAmbienceSounds) {
    if (outgoing === sound) continue;
    cancelFade(outgoing);
    safeSetVolume(outgoing, 0);
    try {
      if (outgoing.isPlaying) outgoing.pause();
    } catch {
      // A destroyed outgoing backend needs no further policy work.
    }
    safelyDestroy(outgoing);
  }
  cancelFade(sound);
  if (targetVolume <= 0 || hidden) {
    if (!safeSetVolume(sound, 0)) {
      safelyDestroy(sound);
      currentAmbience = null;
      currentAmbienceKey = null;
      return;
    }
    try {
      if (sound.isPlaying) sound.pause();
    } catch {
      // A scene can disappear while a persisted preference is being applied.
    }
    return;
  }

  if (!safeSetVolume(sound, targetVolume)) {
    safelyDestroy(sound);
    currentAmbience = null;
    currentAmbienceKey = null;
    return;
  }
  try {
    if (sound.isPaused) sound.resume();
  } catch {
    // A destroyed backend is treated as silence.
  }
}

function installVisibilityListener(): void {
  if (visibilityListenerInstalled || typeof document === 'undefined') return;
  visibilityListenerInstalled = true;
  document.addEventListener('visibilitychange', () => {
    const sound = currentAmbience;
    if (document.hidden) {
      if (!sound) return;
      pausedForVisibility = sound.isPlaying;
      if (pausedForVisibility) sound.pause();
      return;
    }
    if (requestedAmbience && requestedAmbience.key !== currentAmbienceKey) {
      pausedForVisibility = false;
      const { scene, key } = requestedAmbience;
      startAmbience(scene, key);
      return;
    }
    if (!sound) {
      syncCurrentAmbiencePolicy();
      return;
    }
    if (pausedForVisibility && currentPolicy().ambienceVolume > 0) sound.resume();
    pausedForVisibility = false;
  });
}
