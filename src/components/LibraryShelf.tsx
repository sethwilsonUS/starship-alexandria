'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync, type Book, type FragmentDef } from '@/data/books';
import { EventBridge } from '@/game/EventBridge';
import type { BookFragment } from '@/types/books';

/**
 * Library collection view for ShipScene.
 * Shows collected book fragments organized by book title.
 * Clicking a fragment opens BookDetail for reading.
 */
export default function LibraryShelf() {
  const library = useGameStore((s) => s.library);
  const gamePhase = useGameStore((s) => s.session.gamePhase);
  const openLibraryBook = useGameStore((s) => s.actions.openLibraryBook);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  const isVisible = gamePhase === 'ship';

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // Space/Enter on ship to beam down
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!selectedBookId) {
          e.preventDefault();
          EventBridge.emit('beam-down-requested');
        }
      }

      // Escape to deselect book or beam down
      if (e.code === 'Escape') {
        if (selectedBookId) {
          e.preventDefault();
          setSelectedBookId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isVisible, selectedBookId]);

  if (!isVisible) return null;

  // Build a map of collected fragments by book
  const collectedByBook = new Map<string, BookFragment[]>();
  library.forEach((frag) => {
    const existing = collectedByBook.get(frag.bookId) || [];
    collectedByBook.set(frag.bookId, [...existing, frag]);
  });

  // Get books that have at least one collected fragment
  let bookCatalog: Book[] = [];
  try {
    bookCatalog = getBookCatalogSync();
  } catch {
    bookCatalog = [];
  }
  const booksWithFragments = bookCatalog.filter(
    (book: Book) => collectedByBook.has(book.id)
  );

  const handleFragmentClick = (fragment: BookFragment) => {
    openLibraryBook(fragment);
  };

  const handleBookClick = (bookId: string) => {
    setSelectedBookId(selectedBookId === bookId ? null : bookId);
  };

  const handleBeamDown = () => {
    EventBridge.emit('beam-down-requested');
  };

  const handleNewGame = () => {
    if (window.confirm('Start a new game? This will erase all progress.')) {
      useGameStore.getState().actions.resetGame();
      // Reload to reinitialize Phaser with fresh state
      window.location.reload();
    }
  };

  const totalCollected = library.length;
  const totalAvailable = bookCatalog.reduce((sum: number, b: Book) => sum + b.fragments.length, 0);

  return (
    <section
      ref={shelfRef}
      className="library-shelf"
      role="region"
      aria-label="Library Collection"
    >
      <div className="library-shelf__content">
        <header className="library-shelf__header">
          <h2 className="library-shelf__title">The Alexandria Archives</h2>
          <p className="library-shelf__count">
            {totalCollected} of {totalAvailable} fragments recovered
          </p>
        </header>

        {booksWithFragments.length === 0 ? (
          <div className="library-shelf__empty">
            <p>Your library awaits its first acquisitions.</p>
            <p className="library-shelf__hint">
              Beam down to Earth to recover fragments of lost literature.
            </p>
          </div>
        ) : (
          <nav aria-label="Book collection">
            <ul className="library-shelf__books" role="list">
              {booksWithFragments.map((book: Book) => {
                const collected = collectedByBook.get(book.id) || [];
                const sortedFragments = [...collected].sort(
                  (a, b) => a.order - b.order
                );
                const isExpanded = selectedBookId === book.id;

                return (
                  <li key={book.id} className="library-shelf__book">
                    <button
                      className={`library-shelf__book-header ${isExpanded ? 'library-shelf__book-header--expanded' : ''}`}
                      onClick={() => handleBookClick(book.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`book-fragments-${book.id}`}
                    >
                      <span className="library-shelf__book-title">
                        {book.title}
                      </span>
                      <span className="library-shelf__book-author">
                        {book.author}
                      </span>
                      <span className="library-shelf__book-progress">
                        {collected.length}/{book.fragments.length}
                      </span>
                    </button>

                    {isExpanded && (
                      <ul
                        id={`book-fragments-${book.id}`}
                        className="library-shelf__fragments"
                        role="list"
                      >
                        {book.fragments.map((fragDef: FragmentDef) => {
                          const collected = sortedFragments.find(
                            (f) => f.id === fragDef.id
                          );
                          const isCollected = !!collected;

                          return (
                            <li
                              key={fragDef.id}
                              className={`library-shelf__fragment ${isCollected ? 'library-shelf__fragment--collected' : 'library-shelf__fragment--missing'}`}
                            >
                              {isCollected ? (
                                <button
                                  className="library-shelf__fragment-btn"
                                  onClick={() => handleFragmentClick(collected)}
                                  aria-label={`Read ${fragDef.label}`}
                                >
                                  <span className="library-shelf__fragment-check">
                                    ✓
                                  </span>
                                  <span className="library-shelf__fragment-label">
                                    {fragDef.label}
                                  </span>
                                </button>
                              ) : (
                                <span
                                  className="library-shelf__fragment-placeholder"
                                  aria-label={`${fragDef.label} - not yet discovered`}
                                >
                                  <span className="library-shelf__fragment-missing">
                                    ?
                                  </span>
                                  <span className="library-shelf__fragment-label">
                                    {fragDef.label}
                                  </span>
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className="library-shelf__actions">
          <button
            className="library-shelf__beam-btn"
            onClick={handleBeamDown}
            aria-label="Begin new expedition to Earth"
          >
            New Expedition
          </button>
          <p className="library-shelf__beam-hint">
            Press Space or Enter to beam down
          </p>
          <button
            className="library-shelf__new-game-btn"
            onClick={handleNewGame}
            aria-label="Start a new game from the beginning"
          >
            New Game
          </button>
        </div>
      </div>
    </section>
  );
}
