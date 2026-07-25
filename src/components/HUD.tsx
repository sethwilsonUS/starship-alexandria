'use client';

import { useState, useEffect } from 'react';
import { EventBridge } from '@/game/EventBridge';
import { useGameStore } from '@/store/gameStore';
import { getTotalFragments } from '@/utils/library';

/**
 * Top-level HUD: current area name, fragment count.
 * Non-intrusive bar at top. Semantic HTML with role="banner".
 * Shows exploration stats only during exploring phase.
 */
export default function HUD() {
  const fragmentCount = useGameStore((s) => s.library.length);
  const booksOnThisMap = useGameStore((s) => s.session.booksOnThisMap);
  const booksRemainingOnThisMap = useGameStore((s) => s.session.booksRemainingOnThisMap);
  const exploredTiles = useGameStore((s) => s.session.exploredTiles);
  const explorableTileCount = useGameStore((s) => s.session.explorableTileCount);
  const currentMapId = useGameStore((s) => s.player.currentMapId);
  const contentReady = useGameStore((s) => s.session.contentReady);
  const openHowToPlay = useGameStore((s) => s.actions.openHowToPlay);
  const openSettings = useGameStore((s) => s.actions.openSettings);
  const [areaName, setAreaName] = useState('Starship Alexandria — Library Deck');

  const isOnShip = currentMapId === 'ship';

  const discoveryPercent =
    explorableTileCount > 0
      ? Math.round((exploredTiles.length / explorableTileCount) * 100)
      : 0;
  const totalFragments = contentReady ? getTotalFragments() : null;

  useEffect(() => {
    const onAreaEntered = ({ areaName: name }: { areaName: string }) => {
      setAreaName(name);
    };
    EventBridge.on('area-entered', onAreaEntered);
    return () => {
      EventBridge.off('area-entered', onAreaEntered);
    };
  }, []);

  return (
    <header
      role="banner"
      className="hud"
      aria-label="Game status"
    >
      <h1 className="hud__title">Starship Alexandria</h1>
      <div className="hud__status">
        <span className="hud__area" aria-label="Current area">
          {areaName}
        </span>
        {!isOnShip && (
          <>
            {explorableTileCount > 0 && (
              <span className="hud__discovery" aria-label="Discovery progress">
                🗺 {discoveryPercent}% explored
              </span>
            )}
          </>
        )}
        <span className="hud__fragments" aria-label="Fragments on this map and total recovered">
          {!isOnShip && booksOnThisMap > 0 && (
            <>📖 {booksRemainingOnThisMap} left here · </>
          )}
          📚 {fragmentCount}/{totalFragments ?? '...'} total
        </span>
      </div>
      <nav className="hud__utilities" aria-label="Game utilities">
        <button type="button" onClick={openHowToPlay}>
          How to Play <kbd aria-hidden="true">?</kbd>
        </button>
        <button type="button" onClick={openSettings}>Settings</button>
      </nav>
    </header>
  );
}
