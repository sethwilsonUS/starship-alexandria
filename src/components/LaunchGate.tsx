'use client';

import { useRef } from 'react';
import { EventBridge } from '@/game/EventBridge';
import { useGameStore } from '@/store/gameStore';
import { unlockAudioSystem } from '@/utils/speech';
import { useModalFocus } from './useModalFocus';

export default function LaunchGate() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = useGameStore((state) => state.session.launchGateOpen);
  const ready = useGameStore((state) => state.session.contentReady);
  const error = useGameStore((state) => state.session.contentError);
  const returning = useGameStore((state) => state.hasSeenWelcome);
  const settings = useGameStore((state) => state.settings);
  const actions = useGameStore((state) => state.actions);

  useModalFocus(open, dialogRef);
  if (!open) return null;

  const begin = () => {
    unlockAudioSystem();
    actions.acceptLaunchGate();
    EventBridge.emit('launch-accepted');
    requestAnimationFrame(() => document.getElementById('game-controls')?.focus());
  };

  return (
    <div className="launch-gate" role="presentation">
      <div
        ref={dialogRef}
        className="launch-gate__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-title"
        aria-describedby="launch-description"
        tabIndex={-1}
      >
        <p className="launch-gate__eyebrow">Alexandria Expeditionary Archive · Flight Deck 7</p>
        <h1 id="launch-title" className="launch-gate__title">
          {returning ? 'Welcome back, Archivist.' : 'The library at the end of the world is still accepting returns.'}
        </h1>
        <p id="launch-description" className="launch-gate__description">
          {returning
            ? 'Your collection is safe aboard ship. Resume when your audio and motion settings feel right.'
            : 'Beam into the ruins below, recover lost words, and bring their voices home to the stars.'}
        </p>

        <div className="launch-gate__status" role={error ? 'alert' : 'status'} aria-live="polite">
          {error ? `Archive loading failed: ${error}` : ready ? 'Archive synchronized. Transporter standing by.' : 'Synchronizing catalog and transporter patterns…'}
        </div>

        <details className="launch-gate__preferences" open={!returning}>
          <summary>{returning ? 'Review audio and motion settings' : 'Audio and motion settings'}</summary>
          <fieldset className="launch-gate__preference-group launch-gate__preference-group--audio">
            <legend>Audio</legend>
            <div className="launch-gate__settings">
              <label className="launch-toggle">
                <input
                  type="checkbox"
                  checked={settings.narrationEnabled}
                  onChange={(event) => actions.setNarrationEnabled(event.target.checked)}
                />
                <span><strong>Narration</strong><small>Read dialogue and discoveries aloud</small></span>
              </label>
              <label className="launch-toggle">
                <input
                  type="checkbox"
                  checked={settings.sfxEnabled}
                  onChange={(event) => actions.setSfxEnabled(event.target.checked)}
                />
                <span><strong>Sound effects</strong><small>Footsteps, relics, and transporter cues</small></span>
              </label>
              <label className="launch-toggle">
                <input
                  type="checkbox"
                  checked={settings.ambienceEnabled}
                  onChange={(event) => actions.setAmbienceEnabled(event.target.checked)}
                />
                <span><strong>Ambience</strong><small>Quiet environmental sound beds</small></span>
              </label>
            </div>
          </fieldset>

          <fieldset className="launch-gate__preference-group">
            <legend>Motion</legend>
            {(['system', 'reduce', 'full'] as const).map((preference) => (
              <label key={preference}>
                <input
                  type="radio"
                  name="motion-preference"
                  value={preference}
                  checked={settings.motionPreference === preference}
                  onChange={() => actions.setMotionPreference(preference)}
                />
                {preference === 'system' ? 'Follow system' : preference === 'reduce' ? 'Reduce motion' : 'Full effects'}
              </label>
            ))}
          </fieldset>
        </details>

        <div className="launch-gate__actions">
          {error ? (
            <button type="button" className="archive-button archive-button--primary" onClick={() => window.location.reload()} data-autofocus>
              Retry synchronization
            </button>
          ) : (
            <button type="button" className="archive-button archive-button--primary" onClick={begin} disabled={!ready} data-autofocus>
              {returning ? 'Resume aboard Alexandria' : 'Begin the recovery mission'}
            </button>
          )}
        </div>
        <p className="launch-gate__note">Audio begins only after this button. Every sound also has a visible or spoken equivalent.</p>
      </div>
    </div>
  );
}
