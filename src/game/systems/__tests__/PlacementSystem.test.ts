import { describe, expect, it } from 'vitest';
import { reserveTile, summarizeRoomContent, type RoomContentSummary } from '../PlacementSystem';

describe('PlacementSystem helpers', () => {
  it('reserves a tile once', () => {
    const reserved = new Set<string>();

    expect(reserveTile(reserved, { x: 4, y: 7 })).toBe(true);
    expect(reserveTile(reserved, { x: 4, y: 7 })).toBe(false);
    expect(reserved.has('4,7')).toBe(true);
  });

  it('summarizes room contents', () => {
    const summaries = new Map<string, RoomContentSummary>();

    summarizeRoomContent(summaries, 'Reading Room', 'book');
    summarizeRoomContent(summaries, 'Reading Room', 'journal');
    summarizeRoomContent(summaries, 'Reading Room', 'npc', 'Martha');
    summarizeRoomContent(summaries, 'Reading Room', 'battery');
    summarizeRoomContent(summaries, 'Reading Room', 'map');

    expect(summaries.get('Reading Room')).toEqual({
      books: 1,
      journals: 1,
      npcs: ['Martha'],
      batteries: 1,
      maps: 1,
    });
  });
});
