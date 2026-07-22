import { describe, expect, it } from 'vitest';
import { reserveTile, summarizeRoomContent, type RoomContentSummary } from '../PlacementSystem';

describe('PlacementSystem helpers', () => {
  it('reserves a tile once', () => {
    const reserved = new Set<string>();

    expect(reserveTile(reserved, { x: 4, y: 7 })).toBe(true);
    expect(reserveTile(reserved, { x: 4, y: 7 })).toBe(false);
    expect(reserved.has('4,7')).toBe(true);
  });

  it('counts repeated room content increments', () => {
    const summaries = new Map<string, RoomContentSummary>();

    summarizeRoomContent(summaries, 'Reading Room', 'book');
    summarizeRoomContent(summaries, 'Reading Room', 'book');
    summarizeRoomContent(summaries, 'Reading Room', 'journal');
    summarizeRoomContent(summaries, 'Reading Room', 'map');

    expect(summaries.get('Reading Room')).toEqual({
      books: 2,
      journals: 1,
      npcs: [],
      maps: 1,
    });
  });

  it('keeps separate rooms isolated', () => {
    const summaries = new Map<string, RoomContentSummary>();

    summarizeRoomContent(summaries, 'Reading Room', 'book');
    summarizeRoomContent(summaries, 'Map Room', 'map');

    expect(summaries.get('Reading Room')).toEqual({
      books: 1,
      journals: 0,
      npcs: [],
      maps: 0,
    });
    expect(summaries.get('Map Room')).toEqual({
      books: 0,
      journals: 0,
      npcs: [],
      maps: 1,
    });
  });

  it('records NPC names', () => {
    const summaries = new Map<string, RoomContentSummary>();

    summarizeRoomContent(summaries, 'Reading Room', 'npc', 'Martha');
    summarizeRoomContent(summaries, 'Reading Room', 'npc', 'Cora');

    expect(summaries.get('Reading Room')).toEqual({
      books: 0,
      journals: 0,
      npcs: ['Martha', 'Cora'],
      maps: 0,
    });
  });

  it('throws when JavaScript callers summarize an NPC without a name', () => {
    const summaries = new Map<string, RoomContentSummary>();

    expect(() => summarizeRoomContent(summaries, 'Reading Room', 'npc' as never)).toThrow(
      'NPC room content requires an npcName'
    );
  });
});

function assertSummarizeRoomContentTypes() {
  const summaries = new Map<string, RoomContentSummary>();

  summarizeRoomContent(summaries, 'Reading Room', 'book');
  summarizeRoomContent(summaries, 'Reading Room', 'npc', 'Martha');
  // @ts-expect-error NPC summaries require an NPC name.
  summarizeRoomContent(summaries, 'Reading Room', 'npc');
}
