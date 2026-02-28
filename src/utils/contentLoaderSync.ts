/**
 * Synchronous access to cached content.
 * Content must be loaded via preloadAllContent() in BootScene first.
 * These functions provide sync access for use in Phaser scenes.
 */

import { getBookCatalogSync, type FragmentDef } from '@/data/books';
import type { JournalEntryDef } from '@/data/journalEntries';

// Journal cache (set by BootScene)
let _journalCache: JournalEntryDef[] | null = null;

export function setJournalCache(journals: JournalEntryDef[]): void {
  _journalCache = journals;
}

export function getJournalCacheSync(): JournalEntryDef[] {
  if (!_journalCache) {
    throw new Error('Journal cache not loaded. Call preloadAllContent() first.');
  }
  return _journalCache;
}

/**
 * Get n random fragments for map placement (sync version).
 * Ensures variety across books.
 */
export function getRandomFragmentsForMapSync(count: number): FragmentDef[] {
  const books = getBookCatalogSync();
  const allFragments: FragmentDef[] = [];
  
  for (const book of books) {
    for (const frag of book.fragments) {
      allFragments.push(frag);
    }
  }
  
  const shuffled = [...allFragments].sort(() => Math.random() - 0.5);
  const picked: FragmentDef[] = [];
  const usedBooks = new Set<string>();

  for (const f of shuffled) {
    if (picked.length >= count) break;
    if (usedBooks.has(f.bookId)) continue;
    picked.push(f);
    usedBooks.add(f.bookId);
  }

  if (picked.length < count) {
    const remaining = shuffled.filter((f) => !picked.includes(f));
    while (picked.length < count && remaining.length > 0) {
      picked.push(remaining.pop()!);
    }
  }

  return picked;
}

/**
 * Get n random journal entries for map placement (sync version).
 */
export function getRandomJournalEntriesSync(count: number): JournalEntryDef[] {
  const journals = getJournalCacheSync();
  const shuffled = [...journals].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
