/**
 * Browser TTS via Web Speech API + simple sound effects.
 * TTS can be toggled via setTTSEnabled() - called by the game store.
 */

// Global TTS state - avoids circular import with store
let ttsEnabled = true;

export function setTTSEnabledGlobal(enabled: boolean): void {
  ttsEnabled = enabled;
}

export function getTTSEnabled(): boolean {
  return ttsEnabled;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis;
}

export function speak(text: string): void {
  if (!ttsEnabled) return;
  
  const synth = getSynth();
  if (!synth || !text.trim()) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = 0.95;
  utterance.pitch = 1;
  synth.speak(utterance);
}

export function cancelSpeech(): void {
  getSynth()?.cancel();
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
