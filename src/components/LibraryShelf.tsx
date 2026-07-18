'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync } from '@/data/books';
import type { Book, FragmentDef } from '@/types/books';
import { getAllArtifacts, getTotalArtifacts, type Artifact } from '@/data/artifacts';
import type { BookFragment } from '@/types/books';

/**
 * Library collection view for ShipScene.
 * Shows collected book fragments organized by book title.
 * Clicking a fragment opens BookDetail for reading.
 */
export default function LibraryShelf() {
  const library = useGameStore((s) => s.library);
  const collectedArtifacts = useGameStore((s) => s.exploration.collectedArtifacts) ?? [];
  const gamePhase = useGameStore((s) => s.session.gamePhase);
  const contentReady = useGameStore((s) => s.session.contentReady);
  const openLibraryBook = useGameStore((s) => s.actions.openLibraryBook);
  const openMissionPicker = useGameStore((s) => s.actions.openMissionPicker);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'library' | 'curiosities'>('library');
  const shelfRef = useRef<HTMLDivElement>(null);

  const isVisible = gamePhase === 'ship';

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // Escape to deselect book or go back to library view
      if (e.code === 'Escape') {
        if (selectedBookId) {
          e.preventDefault();
          setSelectedBookId(null);
        } else if (viewMode === 'curiosities') {
          e.preventDefault();
          setViewMode('library');
        }
      }

      // A to toggle curiosities view (only if we have any)
      if (e.code === 'KeyA' && collectedArtifacts.length > 0) {
        e.preventDefault();
        setViewMode(viewMode === 'curiosities' ? 'library' : 'curiosities');
        setSelectedBookId(null);
        setSelectedArtifactId(null);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isVisible, selectedBookId, viewMode, collectedArtifacts.length]);

  if (!isVisible) return null;

  // Show loading state while content loads
  if (!contentReady) {
    return (
      <section className="library-shelf" role="region" aria-label="Library Collection">
        <div className="library-shelf__content">
          <header className="library-shelf__header">
            <h2 className="library-shelf__title">The Alexandria Archives</h2>
            <p className="library-shelf__count">Loading archives...</p>
          </header>
        </div>
      </section>
    );
  }

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
    openMissionPicker();
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
  const isGameComplete = totalCollected >= totalAvailable && totalAvailable > 0;

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
          {/* Tab buttons for Library/Curiosities */}
          <div
            className="library-shelf__tabs"
            role="tablist"
            aria-label="Archive sections"
            onKeyDown={(event) => {
              if (event.repeat) return;
              if (collectedArtifacts.length === 0) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const next = viewMode === 'library' ? 'curiosities' : 'library';
                setViewMode(next);
                requestAnimationFrame(() => document.getElementById(`${next}-tab`)?.focus());
              }
            }}
          >
            <button
              id="library-tab"
              role="tab"
              aria-selected={viewMode === 'library'}
              aria-controls="library-panel"
              tabIndex={viewMode === 'library' ? 0 : -1}
              className={`library-shelf__tab ${viewMode === 'library' ? 'library-shelf__tab--active' : ''}`}
              onClick={() => setViewMode('library')}
            >
              Library
              <span className="library-shelf__tab-count">{totalCollected}/{totalAvailable}</span>
            </button>
            {collectedArtifacts.length > 0 && (
              <button
                id="curiosities-tab"
                role="tab"
                aria-selected={viewMode === 'curiosities'}
                aria-controls="curiosities-panel"
                tabIndex={viewMode === 'curiosities' ? 0 : -1}
                className={`library-shelf__tab ${viewMode === 'curiosities' ? 'library-shelf__tab--active' : ''}`}
                onClick={() => setViewMode('curiosities')}
              >
                Curiosities
                <span className="library-shelf__tab-count">{collectedArtifacts.length}/{getTotalArtifacts()}</span>
              </button>
            )}
          </div>
        </header>

        {/* Library View */}
        {viewMode === 'library' && (
          <div id="library-panel" role="tabpanel" aria-labelledby="library-tab" tabIndex={0}>
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
          </div>
        )}

        {/* Curiosities View */}
        {viewMode === 'curiosities' && (
          <section id="curiosities-panel" className="library-shelf__curiosities-view" role="tabpanel" aria-labelledby="curiosities-tab" tabIndex={0}>
            <p className="library-shelf__curiosities-intro">
              Personal treasures recovered from vaults. Each tells a story of those who came before.
            </p>
            <ul className="library-shelf__artifacts" role="list">
              {getAllArtifacts()
                .filter((a: Artifact) => collectedArtifacts.includes(a.id))
                .map((artifact: Artifact) => (
                  <li key={artifact.id} className="library-shelf__artifact">
                    <button
                      className={`library-shelf__artifact-btn ${selectedArtifactId === artifact.id ? 'library-shelf__artifact-btn--expanded' : ''}`}
                      onClick={() => setSelectedArtifactId(
                        selectedArtifactId === artifact.id ? null : artifact.id
                      )}
                      aria-expanded={selectedArtifactId === artifact.id}
                    >
                      <span className="library-shelf__artifact-name">{artifact.name}</span>
                    </button>
                    {selectedArtifactId === artifact.id && (
                      <p className="library-shelf__artifact-desc">{artifact.description}</p>
                    )}
                  </li>
                ))}
            </ul>
            <p className="library-shelf__curiosities-hint">
              Press Escape to return to Library
            </p>
          </section>
        )}

        <div className="library-shelf__actions">
          {isGameComplete ? (
            <>
              <div className="library-shelf__complete">
                <span className="library-shelf__complete-icon">✨</span>
                <span className="library-shelf__complete-text">Mission Complete</span>
              </div>
              <p className="library-shelf__complete-hint">
                All included excerpts recovered. Expeditions remain available for lore and supply caches.
              </p>
              <button
                className="library-shelf__beam-btn library-shelf__beam-btn--victory"
                onClick={handleBeamDown}
                aria-label="Begin another expedition to Earth"
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
            </>
          ) : (
            <>
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
              <p className="library-shelf__voice-disclosure">
                Opening narration uses AI-generated voice clips.
              </p>
              <button
                className="library-shelf__new-game-btn"
                onClick={handleNewGame}
                aria-label="Start a new game from the beginning"
              >
                New Game
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
