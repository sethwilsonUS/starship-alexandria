/**
 * Content loader: loads YAML content files and text files at runtime.
 * This allows narrative content to be edited without touching TypeScript code.
 */

import { parse as parseYaml } from 'yaml';
import type { ContentThemeId, PublicDomainSource } from '@/types/content';

// ─────────────────────────────────────────────────────────────────────────────
// Types for YAML content structures
// ─────────────────────────────────────────────────────────────────────────────

export interface DialogueLineYaml {
  speaker?: string;
  text: string;
  voiceLineId?: string;
}

export interface NPCYaml {
  id: string;
  name: string;
  role: string;
  themeIds: ContentThemeId[];
  firstMeet: DialogueLineYaml[];
  return: DialogueLineYaml[];
  /** Spoken while the vault clue is in hand and the vault is still sealed. */
  returnWithClue: DialogueLineYaml[];
  postVault: DialogueLineYaml[];
}

export interface JournalYaml {
  id: string;
  title: string;
  themeIds: ContentThemeId[];
  lines: DialogueLineYaml[];
}

export interface FragmentYaml {
  id: string;
  label: string;
  order: number;
  textFile: string;
  sourceLocation: string;
  themeAffinities: ContentThemeId[];
  editorialContext?: string;
}

export interface BookYaml {
  id: string;
  title: string;
  author: string;
  /** The ship archivist's personal note, shown once the work reaches the shelf. */
  archivistNote: string;
  source: PublicDomainSource;
  /** Derived from fragments; never stored in books.yaml. */
  includedFragmentCount: number;
  fragments: FragmentYaml[];
}

type StoredBookYaml = Omit<BookYaml, 'includedFragmentCount'>;

export interface DialogueChoiceYaml {
  label: string;
  key: string;
  action: string;
}

export interface TransporterDialogueYaml {
  text: string;
  voiceLineId?: string;
  choices: DialogueChoiceYaml[];
}

export interface DialogueContentYaml {
  transporter: {
    noFragments: TransporterDialogueYaml;
    fragmentsRemaining: TransporterDialogueYaml;
    allCollected: TransporterDialogueYaml;
  };
  marthaHint: {
    template: string;
    fallback: string;
  };
}

export interface ArtifactYaml {
  id: string;
  name: string;
  description: string;
}

export interface GameloopDialogueLineYaml {
  text: string;
  voiceLineId?: string;
  choices?: DialogueChoiceYaml[];
}

export interface GameloopYaml {
  victory: {
    lines: GameloopDialogueLineYaml[];
  };
}

export interface VaultYaml {
  id: string;
  themeId: ContentThemeId;
  name: string;
  clue: {
    id: string;
    title: string;
    lines: GameloopDialogueLineYaml[];
  };
  dialogue: {
    locked: GameloopDialogueLineYaml[];
    opening: GameloopDialogueLineYaml[];
    opened: GameloopDialogueLineYaml[];
  };
  exhaustedReward: {
    journalTitle: string;
    journalText: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache for loaded content
// ─────────────────────────────────────────────────────────────────────────────

let npcsCache: NPCYaml[] | null = null;
let journalsCache: JournalYaml[] | null = null;
let booksCache: BookYaml[] | null = null;
let dialogueCache: DialogueContentYaml | null = null;
let artifactsCache: ArtifactYaml[] | null = null;
let gameloopCache: GameloopYaml | null = null;
let vaultsCache: VaultYaml[] | null = null;
const textFileCache: Map<string, string> = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Content loading functions
// ─────────────────────────────────────────────────────────────────────────────

async function fetchYaml<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  const text = await response.text();
  return parseYaml(text) as T;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.text();
}

// ─────────────────────────────────────────────────────────────────────────────
// NPCs
// ─────────────────────────────────────────────────────────────────────────────

export async function loadNPCs(): Promise<NPCYaml[]> {
  if (npcsCache) return npcsCache;
  const data = await fetchYaml<{ npcs: NPCYaml[] }>('/content/npcs.yaml');
  npcsCache = data.npcs;
  return npcsCache;
}

export async function getNPCById(id: string): Promise<NPCYaml | undefined> {
  const npcs = await loadNPCs();
  return npcs.find((n) => n.id === id);
}

export async function getAllNPCs(): Promise<NPCYaml[]> {
  return loadNPCs();
}

export async function getNPCsForTheme(themeId: ContentThemeId): Promise<NPCYaml[]> {
  const npcs = await loadNPCs();
  return npcs.filter((npc) => npc.themeIds.includes(themeId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Journals
// ─────────────────────────────────────────────────────────────────────────────

export async function loadJournals(): Promise<JournalYaml[]> {
  if (journalsCache) return journalsCache;
  const data = await fetchYaml<{ journals: JournalYaml[] }>('/content/journals.yaml');
  journalsCache = data.journals;
  return journalsCache;
}

export async function getJournalById(id: string): Promise<JournalYaml | undefined> {
  const journals = await loadJournals();
  return journals.find((j) => j.id === id);
}

export async function getRandomJournalEntries(count: number): Promise<JournalYaml[]> {
  const journals = await loadJournals();
  const shuffled = [...journals].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function getJournalsForTheme(themeId: ContentThemeId): Promise<JournalYaml[]> {
  const journals = await loadJournals();
  return journals.filter((journal) => journal.themeIds.includes(themeId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Books & Fragments
// ─────────────────────────────────────────────────────────────────────────────

export async function loadBooks(): Promise<BookYaml[]> {
  if (booksCache) return booksCache;
  const data = await fetchYaml<{ books: StoredBookYaml[] }>('/content/books.yaml');
  booksCache = data.books.map((book) => ({
    ...book,
    includedFragmentCount: book.fragments.length,
  }));
  return booksCache;
}

export async function getBookById(id: string): Promise<BookYaml | undefined> {
  const books = await loadBooks();
  return books.find((b) => b.id === id);
}

export async function getAllBooks(): Promise<BookYaml[]> {
  return loadBooks();
}

export async function loadFragmentText(textFile: string): Promise<string> {
  if (textFileCache.has(textFile)) {
    return textFileCache.get(textFile)!;
  }
  const text = await fetchText(`/content/texts/${textFile}`);
  textFileCache.set(textFile, text);
  return text;
}

export interface FragmentWithText {
  id: string;
  bookId: string;
  label: string;
  order: number;
  text: string;
  sourceLocation: string;
  themeAffinities: ContentThemeId[];
  editorialContext?: string;
}

export async function getFragmentById(id: string): Promise<FragmentWithText | undefined> {
  const books = await loadBooks();
  for (const book of books) {
    const fragment = book.fragments.find((f) => f.id === id);
    if (fragment) {
      const text = await loadFragmentText(fragment.textFile);
      return {
        id: fragment.id,
        bookId: book.id,
        label: fragment.label,
        order: fragment.order,
        text,
        sourceLocation: fragment.sourceLocation,
        themeAffinities: [...fragment.themeAffinities],
        editorialContext: fragment.editorialContext,
      };
    }
  }
  return undefined;
}

export async function getAllFragments(): Promise<FragmentWithText[]> {
  const books = await loadBooks();
  const fragments: FragmentWithText[] = [];
  for (const book of books) {
    for (const fragment of book.fragments) {
      const text = await loadFragmentText(fragment.textFile);
      fragments.push({
        id: fragment.id,
        bookId: book.id,
        label: fragment.label,
        order: fragment.order,
        text,
        sourceLocation: fragment.sourceLocation,
        themeAffinities: [...fragment.themeAffinities],
        editorialContext: fragment.editorialContext,
      });
    }
  }
  return fragments;
}

export async function getRandomFragmentsForMap(count: number): Promise<FragmentWithText[]> {
  const fragments = await getAllFragments();
  const shuffled = [...fragments].sort(() => Math.random() - 0.5);
  const picked: FragmentWithText[] = [];
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

// ─────────────────────────────────────────────────────────────────────────────
// Dialogue
// ─────────────────────────────────────────────────────────────────────────────

export async function loadDialogue(): Promise<DialogueContentYaml> {
  if (dialogueCache) return dialogueCache;
  dialogueCache = await fetchYaml<DialogueContentYaml>('/content/dialogue.yaml');
  return dialogueCache;
}

export async function getTransporterDialogue(
  newFragmentsThisTrip: number,
  fragmentsRemaining: number
): Promise<{ text: string; voiceLineId?: string; choices?: DialogueChoiceYaml[] }[]> {
  const dialogue = await loadDialogue();
  
  if (newFragmentsThisTrip === 0) {
    const d = dialogue.transporter.noFragments;
    return [{ text: d.text, voiceLineId: d.voiceLineId, choices: d.choices }];
  }

  if (fragmentsRemaining > 0) {
    const d = dialogue.transporter.fragmentsRemaining;
    const plural = fragmentsRemaining === 1 ? 'fragment' : 'fragments';
    const text = d.text.replace('{count}', String(fragmentsRemaining)).replace('{plural}', plural);
    return [{ text, voiceLineId: d.voiceLineId, choices: d.choices }];
  }

  const d = dialogue.transporter.allCollected;
  return [{ text: d.text, voiceLineId: d.voiceLineId, choices: d.choices }];
}

export async function getMarthaBookHint(roomNames: string[]): Promise<string> {
  const dialogue = await loadDialogue();
  
  if (roomNames.length === 0) {
    return dialogue.marthaHint.fallback;
  }
  
  const formatted =
    roomNames.length === 1
      ? `the ${roomNames[0]}`
      : roomNames.length === 2
        ? `the ${roomNames[0]} and the ${roomNames[1]}`
        : roomNames.slice(0, -1).map((r) => `the ${r}`).join(", ") + ", and the " + roomNames[roomNames.length - 1];
  
  return dialogue.marthaHint.template.replace('{rooms}', formatted);
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifacts
// ─────────────────────────────────────────────────────────────────────────────

export async function loadArtifacts(): Promise<ArtifactYaml[]> {
  if (artifactsCache) return artifactsCache;
  const data = await fetchYaml<{ artifacts: ArtifactYaml[] }>('/content/artifacts.yaml');
  artifactsCache = data.artifacts;
  return artifactsCache;
}

export async function getArtifactById(id: string): Promise<ArtifactYaml | undefined> {
  const artifacts = await loadArtifacts();
  return artifacts.find((a) => a.id === id);
}

export async function getAllArtifacts(): Promise<ArtifactYaml[]> {
  return loadArtifacts();
}

// ─────────────────────────────────────────────────────────────────────────────
// Gameloop (welcome, victory, vault dialogues)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadGameloop(): Promise<GameloopYaml> {
  if (gameloopCache) return gameloopCache;
  gameloopCache = await fetchYaml<GameloopYaml>('/content/gameloop.yaml');
  return gameloopCache;
}

// ─────────────────────────────────────────────────────────────────────────────
// Themed vaults
// ─────────────────────────────────────────────────────────────────────────────

export async function loadVaults(): Promise<VaultYaml[]> {
  if (vaultsCache) return vaultsCache;
  const data = await fetchYaml<{ vaults: VaultYaml[] }>('/content/vaults.yaml');
  vaultsCache = data.vaults;
  return vaultsCache;
}

export async function getVaultByTheme(themeId: ContentThemeId): Promise<VaultYaml | undefined> {
  const vaults = await loadVaults();
  return vaults.find((vault) => vault.themeId === themeId);
}

/** Synchronous access after preloadAllContent has completed. */
export function getVaultByThemeSync(themeId: ContentThemeId): VaultYaml | undefined {
  if (!vaultsCache) {
    throw new Error('Vault content not loaded. Call preloadAllContent() first.');
  }
  return vaultsCache.find((vault) => vault.themeId === themeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Preload all content (call at game start for better UX)
// ─────────────────────────────────────────────────────────────────────────────

export async function preloadAllContent(): Promise<void> {
  await Promise.all([
    loadNPCs(),
    loadJournals(),
    loadBooks(),
    loadDialogue(),
    loadArtifacts(),
    loadGameloop(),
    loadVaults(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear cache (useful for hot reload during development)
// ─────────────────────────────────────────────────────────────────────────────

export function clearContentCache(): void {
  npcsCache = null;
  journalsCache = null;
  booksCache = null;
  dialogueCache = null;
  artifactsCache = null;
  gameloopCache = null;
  vaultsCache = null;
  textFileCache.clear();
}
