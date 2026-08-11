'use client';

import { useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useModalFocus } from './useModalFocus';

export default function SettingsModal() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = useGameStore((state) => state.session.activeUtility === 'settings');
  const settings = useGameStore((state) => state.settings);
  const actions = useGameStore((state) => state.actions);
  const close = useCallback(() => actions.closeUtility(), [actions]);
  const activeThemeId = useGameStore((state) => state.session.activeThemeId);
  const activeExpeditionId = useGameStore((state) => state.session.activeExpeditionId);
  const volumePercent = Math.round(settings.masterVolume * 100);
  // Deterministic expeditions are shareable; mirror ExploreScene's seed fallback.
  const expeditionSeed = activeExpeditionId ?? (activeThemeId ? `${activeThemeId}-expedition` : null);

  useModalFocus(open, dialogRef, close);
  if (!open) return null;

  return (
    <div className="utility-modal" role="presentation">
      <div
        ref={dialogRef}
        className="utility-modal__panel utility-modal__panel--settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
        tabIndex={-1}
      >
        <header className="utility-modal__header">
          <div>
            <p className="how-to-guide__eyebrow">Personal console</p>
            <h2 id="settings-title" tabIndex={-1} data-autofocus>Options</h2>
            <p id="settings-description">
              Changes apply immediately and stay with this browser, including after New Game.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Close Options">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="utility-modal__scroll settings-form">
          <fieldset className="settings-form__group">
            <legend>Audio and narration</legend>
            <div className="settings-form__toggles">
              <label className="launch-toggle">
                <input
                  type="checkbox"
                  checked={settings.narrationEnabled}
                  onChange={(event) => actions.setNarrationEnabled(event.target.checked)}
                />
                <span><strong>Narration</strong><small>Play recorded guides and read game text aloud</small></span>
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

            <div className="settings-form__volume">
              <div className="settings-form__volume-label">
                <label htmlFor="master-volume"><strong>Master volume</strong></label>
                <output htmlFor="master-volume">{volumePercent}%</output>
              </div>
              <input
                id="master-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVolume}
                aria-valuetext={`${volumePercent} percent`}
                aria-describedby="master-volume-help"
                onChange={(event) => actions.setMasterVolume(Number(event.target.value))}
              />
              <p id="master-volume-help">Controls narration, sound effects, and ambience together.</p>
            </div>
          </fieldset>

          <fieldset className="settings-form__group settings-form__motion">
            <legend>Motion</legend>
            <p>Choose how decorative movement and transitions behave.</p>
            {(['system', 'reduce', 'full'] as const).map((preference) => (
              <label key={preference}>
                <input
                  type="radio"
                  name="settings-motion-preference"
                  value={preference}
                  checked={settings.motionPreference === preference}
                  onChange={() => actions.setMotionPreference(preference)}
                />
                {preference === 'system' ? 'Follow system' : preference === 'reduce' ? 'Reduce motion' : 'Full effects'}
              </label>
            ))}
          </fieldset>
        </div>

        <footer className="utility-modal__footer">
          {expeditionSeed && (
            <p className="utility-modal__seed">
              Expedition seed: <code>{expeditionSeed}</code>
            </p>
          )}
          <p role="status">Options save automatically.</p>
          <button type="button" className="archive-button archive-button--primary" onClick={close}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
