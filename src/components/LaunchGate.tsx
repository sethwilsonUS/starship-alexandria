'use client';

import { useRef } from 'react';
import { EventBridge } from '@/game/EventBridge';
import { useGameStore } from '@/store/gameStore';
import { cancelSpeech, unlockAudioSystem } from '@/utils/speech';
import HowToPlayContent from './HowToPlayContent';
import { useModalFocus } from './useModalFocus';

export default function LaunchGate() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = useGameStore((state) => state.session.launchGateOpen);
  const ready = useGameStore((state) => state.session.contentReady);
  const error = useGameStore((state) => state.session.contentError);
  const returning = useGameStore((state) => state.hasSeenHowToPlay);
  const actions = useGameStore((state) => state.actions);

  useModalFocus(open, dialogRef);
  if (!open) return null;

  const begin = () => {
    cancelSpeech();
    unlockAudioSystem();
    actions.acceptLaunchGate();
    EventBridge.emit('launch-accepted');
    requestAnimationFrame(() => document.getElementById('game-controls')?.focus());
  };

  const status = (
    <div className="launch-gate__status" role={error ? 'alert' : 'status'} aria-live="polite">
      {error
        ? `Archive loading failed: ${error}`
        : ready
          ? 'Archive synchronized. Transporter standing by.'
          : 'Synchronizing catalog and transporter patterns…'}
    </div>
  );

  if (returning) {
    return (
      <div className="launch-gate" role="presentation">
        <div
          ref={dialogRef}
          className="launch-gate__panel launch-gate__panel--resume"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-title"
          aria-describedby="resume-description"
          tabIndex={-1}
        >
          <p className="launch-gate__eyebrow">Alexandria Expeditionary Archive · Flight Deck 7</p>
          <h1 id="resume-title" className="launch-gate__title">Welcome back, Archivist.</h1>
          <p id="resume-description" className="launch-gate__description">
            Your collection and preferences are safe aboard ship. Resume to unlock this session&apos;s audio.
          </p>
          {status}
          <div className="launch-gate__actions">
            {error ? (
              <button
                type="button"
                className="archive-button archive-button--primary"
                onClick={() => window.location.reload()}
                data-autofocus
              >
                Retry synchronization
              </button>
            ) : (
              <button
                type="button"
                className="archive-button archive-button--primary"
                onClick={begin}
                disabled={!ready}
                data-autofocus
              >
                Resume aboard Alexandria
              </button>
            )}
          </div>
          <p className="launch-gate__note">
            Audio begins only after Resume. Every essential sound also has a visible or spoken equivalent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="launch-gate launch-gate--guide" role="presentation">
      <div
        ref={dialogRef}
        className="launch-gate__panel launch-gate__panel--guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-launch-title"
        aria-describedby="how-to-launch-title-intro"
        tabIndex={-1}
      >
        <div className="launch-gate__guide-scroll" tabIndex={0} aria-label="How to Play guide">
          <HowToPlayContent titleId="how-to-launch-title" titleLevel={1} />
        </div>
        <footer className="launch-gate__guide-footer">
          {status}
          <div className="launch-gate__actions">
            {error ? (
              <button
                type="button"
                className="archive-button archive-button--primary"
                onClick={() => window.location.reload()}
              >
                Retry synchronization
              </button>
            ) : (
              <button
                type="button"
                className="archive-button archive-button--primary"
                onClick={begin}
                disabled={!ready}
              >
                Begin recovery mission
              </button>
            )}
          </div>
          <p className="launch-gate__note">
            Audio stays silent until you choose Play narrated guide or Begin. How to Play and Options
            remain available during normal play.
          </p>
        </footer>
      </div>
    </div>
  );
}
