/**
 * NPC definitions: name, dialogue trees.
 * Phase 2.4 — NPCs & journal entries.
 * 
 * Content is now loaded from content/npcs.yaml
 */

import type { DialogueLine } from '@/types/store';
import {
  getAllNPCs,
  getNPCById as getContentNPCById,
  getMarthaBookHint as getContentMarthaBookHint,
  type NPCYaml,
} from '@/utils/contentLoader';

export interface NPC {
  id: string;
  name: string;
  firstMeet: DialogueLine[];
  return: DialogueLine[];
}

export function yamlToNPC(yaml: NPCYaml): NPC {
  return {
    id: yaml.id,
    name: yaml.name,
    firstMeet: yaml.firstMeet.map((line) => ({
      speaker: line.speaker,
      text: line.text,
    })),
    return: yaml.return.map((line) => ({
      speaker: line.speaker,
      text: line.text,
    })),
  };
}

export async function loadNPCCatalog(): Promise<NPC[]> {
  const npcs = await getAllNPCs();
  return npcs.map(yamlToNPC);
}

export async function getNPCById(id: string): Promise<NPC | undefined> {
  const yaml = await getContentNPCById(id);
  return yaml ? yamlToNPC(yaml) : undefined;
}

export async function getMarthaBookHint(roomNames: string[]): Promise<string> {
  return getContentMarthaBookHint(roomNames);
}

// Backward compatibility: export a placeholder that throws if accessed synchronously
// This will help catch places that need to be updated to async
let _cachedCatalog: NPC[] | null = null;

export function setCachedNPCCatalog(npcs: NPC[]): void {
  _cachedCatalog = npcs;
}

export function getNPCCatalogSync(): NPC[] {
  if (!_cachedCatalog) {
    throw new Error('NPC_CATALOG not loaded. Call loadNPCCatalog() first or use async getNPCById().');
  }
  return _cachedCatalog;
}

export function getNPCByIdSync(id: string): NPC | undefined {
  return getNPCCatalogSync().find((n) => n.id === id);
}
