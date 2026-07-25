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

/**
 * Play a gentle chime when discovering something.
 */
export function playDiscoveryChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  // Pleasant ascending chime
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, ctx.currentTime);
  oscillator.frequency.setValueAtTime(554, ctx.currentTime + 0.1);
  oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.2);
  
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2 * masterVolume, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2 * masterVolume, ctx.currentTime + 0.2);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.4);
}
