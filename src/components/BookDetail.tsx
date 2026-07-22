'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync } from '@/data/books';
import type { Book } from '@/types/books';
import { speak, cancelSpeech } from '@/utils/speech';
import { unlockInteractions } from '@/game/systems/Interaction';
import { isNativeInteractiveTarget } from '@/utils/domEvents';
import { useModalFocus } from './useModalFocus';

/**
 * Reading a found book fragment. WCAG contrast for text.
 * Close with Space/Enter. TTS reads the fragment aloud.
 */
export default function BookDetail() {
  const currentBookFragment = useGameStore((s) => s.session.currentBookFragment);
  const closeBook = useGameStore((s) => s.actions.closeBook);
  const gamePhase = useGameStore((s) => s.session.gamePhase);

  const isOpen = gamePhase === 'reading' && currentBookFragment !== null;
  const openedAtRef = useRef<number>(0);
  const dialogRef = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    cancelSpeech();
    closeBook();
    unlockInteractions();
  }, [closeBook]);

  useModalFocus(isOpen, dialogRef, close);

  // Track when the book opens
  useEffect(() => {
    if (!isOpen) return;
    openedAtRef.current = Date.now();
  }, [isOpen]);

  // TTS: speak fragment text when opened
  useEffect(() => {
    if (!isOpen || !currentBookFragment) return;
    const intro = `Reading ${currentBookFragment.label}.`;
    speak(intro + ' ' + currentBookFragment.text);
    return () => cancelSpeech();
  }, [isOpen, currentBookFragment]);

  useEffect(() => {
    if (!isOpen) cancelSpeech();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return; // Ignore key repeats
      // Preserve native button/link activation. In particular, Enter on the
      // Project Gutenberg source link must open the source, not close the book.
      if (isNativeInteractiveTarget(e.target)) return;
      // Ignore closes within 300ms of opening (prevents accidental instant close)
      if (Date.now() - openedAtRef.current < 300) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  if (!isOpen || !currentBookFragment) return null;

  let book: Book | undefined;
  try {
    const catalog = getBookCatalogSync();
    book = catalog.find((b: Book) => b.id === currentBookFragment.bookId);
  } catch {
    book = undefined;
  }

  return (
    <article
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-detail-title"
      aria-describedby="book-detail-meta"
      className="book-detail"
      tabIndex={-1}
    >
      <div className="book-detail__inner">
        <button type="button" className="modal-close book-detail__close" onClick={close} aria-label="Close reading view" data-autofocus>
          <span aria-hidden="true">×</span>
        </button>
        <header className="book-detail__header">
          <h2 id="book-detail-title" className="book-detail__title">{book?.title ?? 'Unknown'}</h2>
          <p id="book-detail-meta" className="book-detail__meta">
            {book?.author} — {currentBookFragment.label}
          </p>
          <p className="book-detail__source-location">{currentBookFragment.sourceLocation}</p>
        </header>
        {currentBookFragment.editorialContext ? (
          <aside className="book-detail__context" aria-label="Editorial context">
            {currentBookFragment.editorialContext}
          </aside>
        ) : null}
        <div className="book-detail__text">
          {currentBookFragment.text.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {book?.source ? (
          <p className="book-detail__provenance">
            Source: <a href={book.source.url} target="_blank" rel="noreferrer">Project Gutenberg eBook #{book.source.ebookNumber}</a>
            {' · '}{book.source.edition}{' · '}{book.source.publicDomainNote}
          </p>
        ) : null}
        <p className="book-detail__hint" aria-hidden="true">
          Press Space, Enter, or Escape to close
        </p>
      </div>
    </article>
  );
}
