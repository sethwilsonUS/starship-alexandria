'use client';

import { useState, useEffect } from 'react';
import { EventBridge } from '@/game/EventBridge';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync, type Book } from '@/data/books';

function getTotalFragments(): number {
  try {
    const catalog = getBookCatalogSync();
    return catalog.reduce((n: number, b: Book) => n + b.fragments.length, 0);
  } catch {
    return 0;
  }
}

/**
 * Top-level HUD: current area name, fragment count.
 * Non-intrusive bar at top. Semantic HTML with role="banner".
 * Shows exploration stats only during exploring phase.
 */
export default function HUD() {
  const fragmentCount = useGameStore((s) => s.library.length);
  const booksOnThisMap = useGameStore((s) => s.session.booksOnThisMap);
  const booksRemainingOnThisMap = useGameStore((s) => s.session.booksRemainingOnThisMap);
  const battery = useGameStore((s) => s.player.flashlightBattery);
  const spareBatteries = useGameStore((s) => s.player.spareBatteries);
  const exploredTiles = useGameStore((s) => s.session.exploredTiles);
  const explorableTileCount = useGameStore((s) => s.session.explorableTileCount);
  const currentMapId = useGameStore((s) => s.player.currentMapId);
  const [areaName, setAreaName] = useState('Ruined Library Wing');

  const isOnShip = currentMapId === 'ship';

  const discoveryPercent =
    explorableTileCount > 0
      ? Math.round((exploredTiles.length / explorableTileCount) * 100)
      : 0;

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
            <span className="hud__battery" aria-label="Flashlight battery">
              🔦 {battery}%
            </span>
            {spareBatteries > 0 && (
              <span className="hud__spare-batteries" aria-label="Spare batteries. Press B to use.">
                🔋 {spareBatteries} · B to use
              </span>
            )}
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
          📚 {fragmentCount}/{getTotalFragments()} total
        </span>
      </div>
    </header>
  );
}
