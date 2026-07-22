/**
 * Journal entries: discovered lore, worldbuilding.
 * Shown in DialogueBox on interaction; consumed on read (removed from map).
 * 
 * Content is loaded from the canonical public/content/journals.yaml.
 */

import type { DialogueLine } from '@/types/store';
import type { ContentThemeId } from '@/types/content';
import {
  loadJournals,
  getJournalById as getContentJournalById,
  getRandomJournalEntries as getContentRandomJournalEntries,
  type JournalYaml,
} from '@/utils/contentLoader';

export interface JournalEntryDef {
  id: string;
  title: string;
  /** Content journals have affinities; expedition-scoped dynamic notes may not. */
  themeIds?: ContentThemeId[];
  lines: DialogueLine[];
}

export function yamlToJournal(yaml: JournalYaml): JournalEntryDef {
  return {
    id: yaml.id,
    title: yaml.title,
    themeIds: [...yaml.themeIds],
    lines: yaml.lines.map((line) => ({
      speaker: line.speaker,
      text: line.text,
    })),
  };
}

export async function loadJournalCatalog(): Promise<JournalEntryDef[]> {
  const journals = await loadJournals();
  return journals.map(yamlToJournal);
}

export async function getJournalById(id: string): Promise<JournalEntryDef | undefined> {
  const yaml = await getContentJournalById(id);
  return yaml ? yamlToJournal(yaml) : undefined;
}

export async function getRandomJournalEntries(count: number): Promise<JournalEntryDef[]> {
  const yamls = await getContentRandomJournalEntries(count);
  return yamls.map(yamlToJournal);
}
