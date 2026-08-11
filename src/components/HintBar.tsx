'use client';

import { useGameStore } from '@/store/gameStore';

/**
 * One-time surface controls reminder for the first expedition.
 * Retires permanently on dismissal or the first return to the ship;
 * migrated saves with prior expeditions never see it.
 */
export default function HintBar() {
  const gamePhase = useGameStore((s) => s.session.gamePhase);
  const hasSeenSurfaceHints = useGameStore((s) => s.hasSeenSurfaceHints);
  const markSurfaceHintsSeen = useGameStore((s) => s.actions.markSurfaceHintsSeen);

  if (gamePhase !== 'exploring' || hasSeenSurfaceHints) return null;

  return (
    <aside className="hint-bar" aria-label="Surface controls reminder">
      <p className="hint-bar__text">
        <kbd>W A S D</kbd> move · <kbd>E</kbd> interact · <kbd>M</kbd> map
        · <kbd>I</kbd> status · <kbd>O</kbd> options · <kbd>?</kbd> guide
      </p>
      <button
        type="button"
        className="hint-bar__dismiss"
        onClick={markSurfaceHintsSeen}
      >
        Got it
      </button>
    </aside>
  );
}
