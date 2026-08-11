'use client';

import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  EXPEDITION_THEME_IDS,
  EXPEDITION_THEMES,
  chooseSurpriseTheme,
  type ThemeId,
} from '@/game/expeditions';
import { EventBridge } from '@/game/EventBridge';
import { useGameStore } from '@/store/gameStore';
import { useModalFocus } from './useModalFocus';

const GRID_COLUMNS = 2;

export default function MissionPicker() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const phase = useGameStore((state) => state.session.gamePhase);
  const previousThemeId = useGameStore((state) => state.previousThemeId);
  const actions = useGameStore((state) => state.actions);
  const open = phase === 'mission-select';
  const close = useCallback(() => actions.closeMissionPicker(), [actions]);

  useModalFocus(open, dialogRef, close);
  if (!open) return null;

  const depart = (themeId: ThemeId) => {
    actions.selectExpeditionTheme(themeId);
    EventBridge.emit('beam-down-requested', { themeId });
  };

  /** Arrow keys rove focus across the 2-column destination grid. */
  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -GRID_COLUMNS,
      ArrowDown: GRID_COLUMNS,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;

    const buttons = cardButtonRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (!buttons.length) return;
    const activeIndex = buttons.findIndex((button) => button === document.activeElement);
    const from = activeIndex === -1 ? 0 : activeIndex;
    const to = (from + offset + buttons.length) % buttons.length;

    event.preventDefault();
    buttons[to].focus();
  };

  const surprise = () => {
    const seed = `${Date.now()}-${useGameStore.getState().exploration.visitedMaps.length}`;
    depart(chooseSurpriseTheme(seed, previousThemeId));
  };

  return (
    <div className="mission-picker" role="presentation">
      <div
        ref={dialogRef}
        className="mission-picker__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-picker-title"
        aria-describedby="mission-picker-description"
        tabIndex={-1}
        onKeyDown={onGridKeyDown}
      >
        <header className="mission-picker__header">
          <div>
            <p className="mission-picker__eyebrow">Transporter destination registry</p>
            <h2 id="mission-picker-title">Choose the next recovery site</h2>
            <p id="mission-picker-description">
              Each signal resolves to a different ruin, population, soundscape, and path through the archive.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Close destination picker">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="mission-picker__grid">
          {EXPEDITION_THEME_IDS.map((themeId, index) => {
            const theme = EXPEDITION_THEMES[themeId];
            const wasPrevious = previousThemeId === themeId;
            return (
              <article
                key={theme.id}
                className="mission-card"
                style={{ '--mission-accent': theme.accentColor } as React.CSSProperties}
              >
                <p className="mission-card__index" aria-hidden="true">0{index + 1}</p>
                <p className="mission-card__kicker">{theme.kicker}</p>
                <h3>{theme.title}</h3>
                <p className="mission-card__description">{theme.description}</p>
                <dl>
                  <div><dt>Terrain</dt><dd>{theme.environment}</dd></div>
                  <div><dt>Hazard</dt><dd>{theme.hazard}</dd></div>
                  <div><dt>Recovery brief</dt><dd>{theme.objective}</dd></div>
                </dl>
                <button
                  type="button"
                  className="mission-card__button"
                  onClick={() => depart(themeId)}
                  ref={(element) => { cardButtonRefs.current[index] = element; }}
                  data-autofocus={index === 0 ? '' : undefined}
                >
                  Lock coordinates{wasPrevious ? ' · recently visited' : ''}
                </button>
              </article>
            );
          })}
        </div>

        <footer className="mission-picker__footer">
          <button type="button" className="archive-button" onClick={surprise}>
            Surprise me—follow the strongest signal
          </button>
          <p>The registry is data-driven; future destinations join this same flight plan without changing the picker.</p>
        </footer>
      </div>
    </div>
  );
}
