/**
 * Browser/local TTS + simple sound effects.
 * TTS can be toggled via setTTSEnabled() - called by the game store.
 */

import { findVoiceClip, loadVoiceManifest } from './voiceManifest';

// Global TTS state - avoids circular import with store
let ttsEnabled = true;
let browserTtsFallbackEnabled = false;
let activeVoiceAudio: HTMLAudioElement | null = null;
let speechRequestId = 0;

export function setTTSEnabledGlobal(enabled: boolean): void {
  ttsEnabled = enabled;
}

export function getTTSEnabled(): boolean {
  return ttsEnabled;
}

export function setBrowserTtsFallbackEnabled(enabled: boolean): void {
  browserTtsFallbackEnabled = enabled;
}

export interface SpeakOptions {
  voiceLineId?: string;
  allowBrowserFallback?: boolean;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis;
}

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!ttsEnabled) return;
  const trimmedText = text.trim();
  if (!trimmedText) return;

  const requestId = beginSpeechRequest();

  if (options.voiceLineId) {
    const allowFallback = options.allowBrowserFallback === true || browserTtsFallbackEnabled;
    void speakLocalVoiceLine(options.voiceLineId, trimmedText, allowFallback, requestId);
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
  requestId: number
): Promise<void> {
  const manifest = await loadVoiceManifest();
  if (requestId !== speechRequestId) return;

  const clip = manifest ? findVoiceClip(manifest, lineId) : null;
  if (!clip) {
    if (allowBrowserFallback) speakWithBrowserTts(fallbackText);
    return;
  }

  try {
    const audio = new Audio(clip.path);
    activeVoiceAudio = audio;
    audio.addEventListener(
      'ended',
      () => {
        if (activeVoiceAudio === audio) {
          activeVoiceAudio = null;
        }
      },
      { once: true }
    );
    await audio.play();
  } catch (error) {
    if (requestId !== speechRequestId) return;
    activeVoiceAudio = null;
    console.warn(`Voice clip failed for ${lineId}:`, error);
    if (allowBrowserFallback) speakWithBrowserTts(fallbackText);
  }
}

function speakWithBrowserTts(text: string): void {
  const synth = getSynth();
  if (!synth || !text.trim()) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = 0.95;
  utterance.pitch = 1;
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
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
  
  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  
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
  
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime + 0.2);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.4);
}
