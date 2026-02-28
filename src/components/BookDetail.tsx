'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync, type Book } from '@/data/books';
import { speak, cancelSpeech } from '@/utils/speech';
import { unlockInteractions } from '@/game/systems/Interaction';

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
  }, [isOpen, currentBookFragment?.id]);

  useEffect(() => {
    if (!isOpen) cancelSpeech();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return; // Ignore key repeats
      // Ignore closes within 300ms of opening (prevents accidental instant close)
      if (Date.now() - openedAtRef.current < 300) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        cancelSpeech();
        closeBook();
        unlockInteractions();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, closeBook]);

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
      role="dialog"
      aria-modal="true"
      aria-label={`Reading: ${currentBookFragment.label} from ${book?.title ?? 'Unknown'}`}
      className="book-detail"
    >
      <div className="book-detail__inner">
        <header className="book-detail__header">
          <h2 className="book-detail__title">{book?.title ?? 'Unknown'}</h2>
          <p className="book-detail__meta">
            {book?.author} — {currentBookFragment.label}
          </p>
        </header>
        <div className="book-detail__text">
          {currentBookFragment.text.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="book-detail__hint" aria-hidden="true">
          Press Space, Enter, or Escape to close
        </p>
      </div>
    </article>
  );
}
