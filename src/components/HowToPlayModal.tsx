'use client';

import { useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { cancelSpeech } from '@/utils/speech';
import HowToPlayContent from './HowToPlayContent';
import { useModalFocus } from './useModalFocus';

export default function HowToPlayModal() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = useGameStore((state) => state.session.activeUtility === 'how-to');
  const closeUtility = useGameStore((state) => state.actions.closeUtility);
  const close = useCallback(() => {
    cancelSpeech();
    closeUtility();
  }, [closeUtility]);

  useModalFocus(open, dialogRef, close);
  if (!open) return null;

  return (
    <div className="utility-modal" role="presentation">
      <div
        ref={dialogRef}
        className="utility-modal__panel utility-modal__panel--guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-modal-title"
        aria-describedby="how-to-modal-title-intro"
        tabIndex={-1}
      >
        <button
          type="button"
          className="modal-close utility-modal__close"
          onClick={close}
          aria-label="Close How to Play"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="utility-modal__scroll" tabIndex={0} aria-label="How to Play guide">
          <HowToPlayContent titleId="how-to-modal-title" titleLevel={2} />
        </div>
        <footer className="utility-modal__footer">
          <button type="button" className="archive-button archive-button--primary" onClick={close}>
            Return to game
          </button>
        </footer>
      </div>
    </div>
  );
}
