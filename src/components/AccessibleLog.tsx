'use client';

import { useState, useEffect, useRef } from 'react';
import { EventBridge } from '@/game/EventBridge';
import { useGameStore } from '@/store/gameStore';
import { getBookCatalogSync, type Book, type FragmentDef } from '@/data/books';
import { getJournalCacheSync } from '@/utils/contentLoaderSync';

const DEBUG_VISIBLE =
  typeof window !== 'undefined' &&
  (window.location.search.includes('debug-log') || window.location.search.includes('debug'));

/**
 * ARIA live region for game events.
 * Visually hidden but available to screen readers.
 * Every important game event gets a text log entry.
 * Add ?debug to the URL to show the log on screen for testing.
 */
export default function AccessibleLog() {
  const [entries, setEntries] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPlayerMoved = ({ x, y }: { x: number; y: number }) => {
      addEntry(`Moved to position ${x}, ${y}`);
    };
    const onAreaEntered = ({ areaName }: { areaName: string }) => {
      addEntry(`You entered ${areaName}`);
    };
    let lastFacingId: string | null = null;
    const onInteractionAvailable = ({
      type,
      label,
    }: {
      type: string;
      label?: string;
    }) => {
      const id = type ? `${type}-${label ?? ''}` : '';
      if (id && id !== lastFacingId) {
        lastFacingId = id;
        addEntry(
          label ? `${label} nearby — press E to interact` : `${type} nearby`
        );
      } else if (!id) {
        lastFacingId = null;
      }
    };
    const onInteractionTriggered = ({
      type,
      id,
    }: {
      type: string;
      id?: string;
    }) => {
      if (type === 'book') return; // book-found handles it
      if (type === 'journal' && id) {
        try {
          const journals = getJournalCacheSync();
          const journal = journals.find((j) => j.id === id);
          addEntry(journal ? `Read: ${journal.title}` : 'Read a journal entry');
        } catch {
          addEntry('Read a journal entry');
        }
        return;
      }
      const labels: Record<string, string> = {
        transporter: "You activated the transporter pad",
        npc: "You spoke to an NPC",
      };
      addEntry(labels[type] ?? `Interacted with ${type}`);
    };
    const onBatteryFound = () => {
      addEntry('Found a battery — press B to use when needed');
    };
    const onBatteryUsed = () => {
      const pct = useGameStore.getState().player.flashlightBattery;
      addEntry(`Battery used — flashlight ${pct}%`);
    };
    const onBookFound = ({ fragmentId }: { fragmentId: string; bookId: string }) => {
      try {
        const books = getBookCatalogSync();
        let frag: FragmentDef | undefined;
        for (const book of books) {
          frag = book.fragments.find((f: FragmentDef) => f.id === fragmentId);
          if (frag) break;
        }
        if (frag) addEntry(`Recovered: ${frag.label}`);
      } catch {
        addEntry('Recovered a book fragment');
      }
    };

    function addEntry(text: string) {
      setEntries((prev) => {
        const next = [...prev.slice(-4), text];
        return next;
      });
    }

    EventBridge.on('player-moved', onPlayerMoved);
    EventBridge.on('area-entered', onAreaEntered);
    EventBridge.on('battery-found', onBatteryFound);
    EventBridge.on('battery-used', onBatteryUsed);
    EventBridge.on('interaction-available', onInteractionAvailable);
    EventBridge.on('interaction-triggered', onInteractionTriggered);
    EventBridge.on('book-found', onBookFound);

    return () => {
      EventBridge.off('player-moved', onPlayerMoved);
      EventBridge.off('area-entered', onAreaEntered);
      EventBridge.off('battery-found', onBatteryFound);
      EventBridge.off('battery-used', onBatteryUsed);
      EventBridge.off('interaction-available', onInteractionAvailable);
      EventBridge.off('interaction-triggered', onInteractionTriggered);
      EventBridge.off('book-found', onBookFound);
    };
  }, []);

  return (
    <div
      ref={logRef}
      className={`accessible-log${DEBUG_VISIBLE ? ' accessible-log--visible' : ''}`}
      aria-live="polite"
      aria-atomic="false"
      aria-label="Game event log"
      role="log"
    >
      {entries.map((text, i) => (
        <p key={`${i}-${text}`} className="accessible-log__entry">
          {text}
        </p>
      ))}
    </div>
  );
}
