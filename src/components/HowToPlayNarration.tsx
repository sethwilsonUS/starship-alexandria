'use client';

import { useCallback, useEffect, useState } from 'react';
import { HOW_TO_PLAY, HOW_TO_PLAY_NARRATION } from '@/content/howToPlay';
import { useGameStore } from '@/store/gameStore';
import { cancelSpeech, speak, unlockAudioSystem } from '@/utils/speech';

type PlaybackState = 'idle' | 'loading' | 'playing' | 'error';

export default function HowToPlayNarration() {
  const narrationEnabled = useGameStore((state) => state.settings.narrationEnabled);
  const [playback, setPlayback] = useState<PlaybackState>('idle');

  const stop = useCallback(() => {
    cancelSpeech();
    setPlayback('idle');
  }, []);

  const toggle = useCallback(() => {
    if (playback === 'loading' || playback === 'playing') {
      stop();
      return;
    }

    // This button is itself a valid browser audio-unlock gesture. Phaser audio
    // remains gated until Begin/Resume updates the store's session policy.
    unlockAudioSystem();
    setPlayback('loading');
    speak(HOW_TO_PLAY_NARRATION, {
      voiceLineId: HOW_TO_PLAY.voiceLineId,
      onStart: () => setPlayback('playing'),
      onEnd: () => setPlayback('idle'),
      onError: () => setPlayback('error'),
    });
  }, [playback, stop]);

  useEffect(() => () => cancelSpeech(), []);

  if (!narrationEnabled) {
    return (
      <p className="how-to-guide__voice-note">
        Prerecorded guide narration is off in Settings.
      </p>
    );
  }

  const buttonLabel = playback === 'loading'
    ? 'Stop loading narrated guide'
    : playback === 'playing'
      ? 'Stop narrated guide'
      : playback === 'error'
        ? 'Retry narrated guide'
        : 'Play narrated guide';

  const status = playback === 'loading'
    ? 'Loading prerecorded narration.'
    : playback === 'playing'
      ? 'Prerecorded narration is playing.'
      : playback === 'error'
        ? 'Narration could not be played. The complete guide remains available as text.'
        : 'AI-generated voice clip.';

  return (
    <div className="how-to-guide__voice-controls">
      <button
        type="button"
        className="dialogue-box__voice-btn"
        onClick={toggle}
        aria-pressed={playback === 'loading' || playback === 'playing'}
      >
        {buttonLabel}
      </button>
      <span
        className="how-to-guide__voice-note"
        role={playback === 'idle' ? undefined : 'status'}
        aria-live={playback === 'idle' ? 'off' : 'polite'}
      >
        {status}
      </span>
    </div>
  );
}
