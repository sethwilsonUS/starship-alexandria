/**
 * NPC definitions: name, dialogue trees.
 * Content is loaded from the canonical public/content/npcs.yaml.
 */

import type { DialogueLine } from '@/types/store';
import type { ContentThemeId } from '@/types/content';
import {
  getAllNPCs,
  getNPCById as getContentNPCById,
  getMarthaBookHint as getContentMarthaBookHint,
  type NPCYaml,
} from '@/utils/contentLoader';

export interface NPC {
  id: string;
  name: string;
  role: string;
  themeIds: ContentThemeId[];
  firstMeet: DialogueLine[];
  return: DialogueLine[];
  postVault: DialogueLine[];
}

export function yamlToNPC(yaml: NPCYaml): NPC {
  return {
    id: yaml.id,
    name: yaml.name,
    role: yaml.role,
    themeIds: [...yaml.themeIds],
    firstMeet: yaml.firstMeet.map((line) => ({
      speaker: line.speaker,
      text: line.text,
    })),
    return: yaml.return.map((line) => ({
      speaker: line.speaker,
      text: line.text,
    })),
    postVault: yaml.postVault.map((line) => ({
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

// Phaser scenes use this catalog only after BootScene has loaded canonical content.
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

export function getNPCsForThemeSync(themeId: ContentThemeId): NPC[] {
  return getNPCCatalogSync().filter((npc) => npc.themeIds.includes(themeId));
}
