/**
 * Browser/local narration + lightweight sound effects.
 *
 * The module starts locked on every page load. `unlockAudioSystem()` must be
 * called from the launch button's user gesture before any browser audio API is
 * created or used.
 */

import { findVoiceClip, loadVoiceManifest } from './voiceManifest';

// Global TTS state - avoids circular import with store
let ttsEnabled = true;
let sfxEnabled = true;
let audioUnlocked = false;
let masterVolume = 0.7;
let browserTtsFallbackEnabled = false;
let activeVoiceAudio: HTMLAudioElement | null = null;
let speechRequestId = 0;
const e2eAudioMuted = process.env.NEXT_PUBLIC_E2E === '1';

export function setTTSEnabledGlobal(enabled: boolean): void {
  ttsEnabled = enabled;
}

export function getTTSEnabled(): boolean {
  return ttsEnabled;
}

export function setSfxEnabledGlobal(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function setMasterVolumeGlobal(volume: number): void {
  masterVolume = Number.isFinite(volume)
    ? Math.min(1, Math.max(0, volume))
    : 0;
  if (activeVoiceAudio) activeVoiceAudio.volume = masterVolume;
}

export function setAudioUnlockedGlobal(unlocked: boolean): void {
  audioUnlocked = unlocked;
  if (!unlocked) cancelSpeech();
}

/**
 * Unlock audio from a real pointer/keyboard gesture. Existing Web Audio
 * contexts are resumed here; none are constructed before this call.
 */
export function unlockAudioSystem(): void {
  audioUnlocked = true;
  if (audioContext?.state === 'suspended') {
    void audioContext.resume();
  }
}

export function setBrowserTtsFallbackEnabled(enabled: boolean): void {
  browserTtsFallbackEnabled = enabled;
}

export interface SpeakOptions {
  voiceLineId?: string;
  allowBrowserFallback?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Narration activity broadcast: AudioDirector ducks its loop channels while a
 * voice (recorded clip or browser TTS) is speaking. Kept as a subscription so
 * this module never imports the audio layer (avoids an import cycle).
 */
type NarrationListener = (active: boolean) => void;
const narrationListeners = new Set<NarrationListener>();
let narrationActive = false;

export function onNarrationActivity(listener: NarrationListener): () => void {
  narrationListeners.add(listener);
  return () => narrationListeners.delete(listener);
}

function setNarrationActive(active: boolean): void {
  if (narrationActive === active) return;
  narrationActive = active;
  narrationListeners.forEach((listener) => listener(active));
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis;
}

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!audioUnlocked || !ttsEnabled) return;
  const trimmedText = text.trim();
  if (!trimmedText) return;

  const requestId = beginSpeechRequest();

  if (options.voiceLineId) {
    const allowFallback = options.allowBrowserFallback === true || browserTtsFallbackEnabled;
    void speakLocalVoiceLine(
      options.voiceLineId,
      trimmedText,
      allowFallback,
      requestId,
      options
    );
    return;
  }

  speakWithBrowserTts(trimmedText);
}

function beginSpeechRequest(): number {
  speechRequestId += 1;
  cancelCurrentPlayback();
  return speechRequestId;
}

async function speakLocalVoiceLine(
  lineId: string,
  fallbackText: string,
  allowBrowserFallback: boolean,
  requestId: number,
  lifecycle: Pick<SpeakOptions, 'onStart' | 'onEnd' | 'onError'>
): Promise<void> {
  const manifest = await loadVoiceManifest();
  if (!audioUnlocked || !ttsEnabled || requestId !== speechRequestId) return;

  const clip = manifest ? findVoiceClip(manifest, lineId) : null;
  if (!clip) {
    if (allowBrowserFallback) {
      speakWithBrowserTts(fallbackText);
    } else {
      lifecycle.onError?.();
    }
    return;
  }

  try {
    const audio = new Audio(clip.path);
    audio.volume = masterVolume;
    // Browser journeys verify loading and playback state without broadcasting
    // narration through the developer's speakers.
    audio.muted = e2eAudioMuted;
    activeVoiceAudio = audio;
    audio.addEventListener(
      'ended',
      () => {
        if (activeVoiceAudio === audio) {
          activeVoiceAudio = null;
          setNarrationActive(false);
          lifecycle.onEnd?.();
        }
      },
      { once: true }
    );
    await audio.play();
    if (requestId !== speechRequestId) {
      audio.pause();
      return;
    }
    setNarrationActive(true);
    lifecycle.onStart?.();
  } catch (error) {
    if (requestId !== speechRequestId) return;
    activeVoiceAudio = null;
    console.warn(`Voice clip failed for ${lineId}:`, error);
    if (allowBrowserFallback) {
      speakWithBrowserTts(fallbackText);
    } else {
      lifecycle.onError?.();
    }
  }
}

function speakWithBrowserTts(text: string): void {
  if (e2eAudioMuted || !audioUnlocked || !ttsEnabled) return;
  const synth = getSynth();
  if (!synth || !text.trim()) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = masterVolume;
  utterance.onstart = () => setNarrationActive(true);
  utterance.onend = () => setNarrationActive(false);
  utterance.onerror = () => setNarrationActive(false);
  synth.speak(utterance);
}

export function cancelSpeech(): void {
  speechRequestId += 1;
  cancelCurrentPlayback();
}

function cancelCurrentPlayback(): void {
  getSynth()?.cancel();
  if (activeVoiceAudio) {
    activeVoiceAudio.pause();
    activeVoiceAudio.currentTime = 0;
    activeVoiceAudio = null;
  }
  setNarrationActive(false);
}

// Audio context for sound effects
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (
    e2eAudioMuted
    || !audioUnlocked
    || !sfxEnabled
    || masterVolume <= 0
    || typeof window === 'undefined'
  ) return null;
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    audioContext = new AudioContextConstructor();
  }
  return audioContext;
}

/**
 * Play a short "bump" sound when hitting a wall or obstacle.
 * Uses Web Audio API for low latency.
 */
export function playBumpSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  // Low, dull thud sound
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(80, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
  
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setValueAtTime(0.3 * masterVolume, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.1);
}

export type DiscoveryKind = 'book' | 'journal' | 'map' | 'generic';

/** Each discoverable gets its own small motif so the ear learns the difference. */
const DISCOVERY_MOTIFS: Record<DiscoveryKind, readonly number[]> = {
  book: [440, 554, 659],
  journal: [392, 494, 587],
  map: [523, 659],
  generic: [440, 554, 659],
};

/**
 * Play a gentle chime when discovering something.
 */
export function playDiscoveryChime(kind: DiscoveryKind = 'generic'): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  // Pleasant ascending motif, one note every 100ms
  const motif = DISCOVERY_MOTIFS[kind];
  oscillator.type = 'sine';
  motif.forEach((frequency, index) => {
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + index * 0.1);
  });
  const sustainEnd = motif.length * 0.1 + 0.1;
  
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2 * masterVolume, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2 * masterVolume, ctx.currentTime + sustainEnd - 0.2);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + sustainEnd);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + sustainEnd);
}

type UiCueName = 'confirm' | 'select' | 'close' | 'page-turn-1' | 'page-turn-2' | 'book-open';

const UI_CUE_FILES: Record<UiCueName, string> = {
  confirm: 'ui-confirm',
  select: 'ui-select',
  close: 'ui-close',
  'page-turn-1': 'page-turn-1',
  'page-turn-2': 'page-turn-2',
  'book-open': 'book-open',
};

let uiCuePreferredExtension: 'ogg' | 'mp3' | null = null;

/**
 * Small interface cues for the HTML overlays, which live outside Phaser's
 * sound system. Follows the same policy as the synthesized chimes: silent
 * until the launch gesture, gated by the sound-effects preference.
 */
export function playUiCue(name: UiCueName, volume = 0.4): void {
  if (e2eAudioMuted || !audioUnlocked || !sfxEnabled) return;
  if (typeof Audio === 'undefined') return;
  if (!uiCuePreferredExtension) {
    const probe = new Audio();
    uiCuePreferredExtension = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  }
  const audio = new Audio(`/game-assets/audio/cues/${UI_CUE_FILES[name]}.${uiCuePreferredExtension}`);
  audio.volume = Math.min(1, masterVolume * volume);
  void audio.play().catch(() => {
    // UI cues are decoration; a blocked or missing clip stays silent.
  });
}
