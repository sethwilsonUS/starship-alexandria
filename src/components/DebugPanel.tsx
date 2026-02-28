'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { EventBridge } from '@/game/EventBridge';
import { getBookCatalogSync, type Book } from '@/data/books';
import type { BookFragment } from '@/types/books';

/**
 * Debug panel for development/testing.
 * Add ?debug to the URL to show the panel.
 * Provides buttons for resetting game state, clearing localStorage, etc.
 */
export default function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const resetGame = useGameStore((s) => s.actions.resetGame);
  const collectMap = useGameStore((s) => s.actions.collectMap);
  const collectFragment = useGameStore((s) => s.actions.collectFragment);
  const setTTSEnabled = useGameStore((s) => s.actions.setTTSEnabled);
  const library = useGameStore((s) => s.library);
  const exploration = useGameStore((s) => s.exploration);
  const hasAreaMap = useGameStore((s) => s.session.hasAreaMap);
  const gamePhase = useGameStore((s) => s.session.gamePhase);
  const ttsEnabled = useGameStore((s) => s.settings.ttsEnabled);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsVisible(window.location.search.includes('debug'));
    }
  }, []);

  if (!isVisible) return null;

  const handleReset = () => {
    if (window.confirm('Reset all game progress? This will clear your library and start fresh.')) {
      resetGame();
      window.location.reload();
    }
  };

  const handleClearStorage = () => {
    if (window.confirm('Clear ALL localStorage for this site? This is a hard reset.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleGetMap = () => {
    if (hasAreaMap) return;
    collectMap();
    EventBridge.emit('interactive-consumed', { type: 'map', id: 'area-map' });
  };

  const handleGetAllFragments = () => {
    try {
      const catalog = getBookCatalogSync();
      const collectedIds = new Set(library.map(f => f.id));
      
      // Collect all fragments not already in library
      catalog.forEach((book: Book) => {
        book.fragments.forEach((fragDef) => {
          if (!collectedIds.has(fragDef.id)) {
            const fragment: BookFragment = {
              id: fragDef.id,
              bookId: book.id,
              label: fragDef.label,
              order: fragDef.order,
              text: fragDef.text || `[Text for ${fragDef.label}]`,
            };
            collectFragment(fragment);
          }
        });
      });
      
      // Despawn all books on the current map
      EventBridge.emit('debug-despawn-all-books');
    } catch (e) {
      console.error('Failed to get all fragments:', e);
    }
  };

  return (
    <aside
      className="debug-panel"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: 'rgba(0, 0, 0, 0.9)',
        border: '2px solid #ff6b6b',
        borderRadius: '8px',
        padding: '1rem',
        zIndex: 9999,
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff',
        maxWidth: '300px',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem', color: '#ff6b6b' }}>Debug Panel</h3>
      <p style={{ margin: '0.25rem 0', color: '#aaa' }}>
        Library: {library.length} fragments
      </p>
      <p style={{ margin: '0.25rem 0', color: '#aaa' }}>
        Total found: {exploration.totalFragmentsFound}
      </p>
      <p style={{ margin: '0.25rem 0', color: '#aaa' }}>
        NPCs met: {exploration.discoveredNPCs.length}
      </p>
      <p style={{ margin: '0.25rem 0', color: '#aaa' }}>
        Journals: {exploration.readJournals.length}
      </p>
      <p style={{ margin: '0.25rem 0', color: '#aaa' }}>
        TTS: {ttsEnabled ? 'ON' : 'OFF'}
      </p>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          onClick={() => setTTSEnabled(!ttsEnabled)}
          style={{
            background: ttsEnabled ? '#5cb85c' : '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {ttsEnabled ? '🔊 TTS On' : '🔇 TTS Off'}
        </button>
        <button
          onClick={handleReset}
          style={{
            background: '#ff6b6b',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Reset Game Progress
        </button>
        <button
          onClick={handleClearStorage}
          style={{
            background: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Clear All localStorage
        </button>
        {gamePhase === 'exploring' && (
          <>
            <button
              onClick={handleGetMap}
              disabled={hasAreaMap}
              style={{
                background: hasAreaMap ? '#333' : '#00ced1',
                color: hasAreaMap ? '#666' : '#000',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem',
                cursor: hasAreaMap ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              {hasAreaMap ? 'Map Collected' : 'Get Map'}
            </button>
            <button
              onClick={handleGetAllFragments}
              style={{
                background: '#ffd700',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ✨ Get All Fragments
            </button>
          </>
        )}
      </div>
      <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: '10px' }}>
        Remove ?debug from URL to hide
      </p>
    </aside>
  );
}
