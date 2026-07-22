import type { Position } from '@/types/game';

export interface RoomContentSummary {
  books: number;
  journals: number;
  npcs: string[];
  maps: number;
}

export type RoomContentType = 'book' | 'journal' | 'map' | 'npc';
type NonNpcRoomContentType = Exclude<RoomContentType, 'npc'>;

export function tileKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function reserveTile(reserved: Set<string>, position: Position): boolean {
  const key = tileKey(position);
  if (reserved.has(key)) return false;
  reserved.add(key);
  return true;
}

export function createRoomContentSummary(): RoomContentSummary {
  return { books: 0, journals: 0, npcs: [], maps: 0 };
}

export function summarizeRoomContent(
  summaries: Map<string, RoomContentSummary>,
  roomName: string,
  type: NonNpcRoomContentType
): void;
export function summarizeRoomContent(
  summaries: Map<string, RoomContentSummary>,
  roomName: string,
  type: 'npc',
  npcName: string
): void;
export function summarizeRoomContent(
  summaries: Map<string, RoomContentSummary>,
  roomName: string,
  type: RoomContentType,
  npcName?: string
): void {
  if (!summaries.has(roomName)) {
    summaries.set(roomName, createRoomContentSummary());
  }

  const summary = summaries.get(roomName)!;
  if (type === 'book') summary.books += 1;
  if (type === 'journal') summary.journals += 1;
  if (type === 'map') summary.maps += 1;
  if (type === 'npc') {
    if (!npcName) {
      throw new Error('NPC room content requires an npcName');
    }
    summary.npcs.push(npcName);
  }
}
