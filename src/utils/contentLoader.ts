/**
 * Content loader: loads YAML content files and text files at runtime.
 * This allows narrative content to be edited without touching TypeScript code.
 */

import { parse as parseYaml } from 'yaml';

// ─────────────────────────────────────────────────────────────────────────────
// Types for YAML content structures
// ─────────────────────────────────────────────────────────────────────────────

export interface DialogueLineYaml {
  speaker?: string;
  text: string;
}

export interface NPCYaml {
  id: string;
  name: string;
  firstMeet: DialogueLineYaml[];
  return: DialogueLineYaml[];
}

export interface JournalYaml {
  id: string;
  title: string;
  lines: DialogueLineYaml[];
}

export interface FragmentYaml {
  id: string;
  label: string;
  order: number;
  textFile: string;
}

export interface BookYaml {
  id: string;
  title: string;
  author: string;
  totalFragments: number;
  fragments: FragmentYaml[];
}

export interface DialogueChoiceYaml {
  label: string;
  key: string;
  action: string;
}

export interface TransporterDialogueYaml {
  text: string;
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
}

export interface GameloopYaml {
  welcome: {
    lines: GameloopDialogueLineYaml[];
  };
  victory: {
    lines: GameloopDialogueLineYaml[];
  };
  vault: {
    alreadyOpened: GameloopDialogueLineYaml[];
    openWithArtifact: GameloopDialogueLineYaml[];
    openEmpty: GameloopDialogueLineYaml[];
    locked: GameloopDialogueLineYaml[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache for loaded content
// ─────────────────────────────────────────────────────────────────────────────

let npcsCache: NPCYaml[] | null = null;
let journalsCache: JournalYaml[] | null = null;
let booksCache: BookYaml[] | null = null;
let roomNamesCache: string[] | null = null;
let dialogueCache: DialogueContentYaml | null = null;
let artifactsCache: ArtifactYaml[] | null = null;
let gameloopCache: GameloopYaml | null = null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Books & Fragments
// ─────────────────────────────────────────────────────────────────────────────

export async function loadBooks(): Promise<BookYaml[]> {
  if (booksCache) return booksCache;
  const data = await fetchYaml<{ books: BookYaml[] }>('/content/books.yaml');
  booksCache = data.books;
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
// Room Names
// ─────────────────────────────────────────────────────────────────────────────

export async function loadRoomNames(): Promise<string[]> {
  if (roomNamesCache) return roomNamesCache;
  const data = await fetchYaml<{ roomNames: string[] }>('/content/rooms.yaml');
  roomNamesCache = data.roomNames;
  return roomNamesCache;
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
): Promise<{ text: string; choices?: DialogueChoiceYaml[] }[]> {
  const dialogue = await loadDialogue();
  
  if (newFragmentsThisTrip === 0) {
    const d = dialogue.transporter.noFragments;
    return [{ text: d.text, choices: d.choices }];
  }

  if (fragmentsRemaining > 0) {
    const d = dialogue.transporter.fragmentsRemaining;
    const plural = fragmentsRemaining === 1 ? 'fragment' : 'fragments';
    const text = d.text.replace('{count}', String(fragmentsRemaining)).replace('{plural}', plural);
    return [{ text, choices: d.choices }];
  }

  const d = dialogue.transporter.allCollected;
  return [{ text: d.text, choices: d.choices }];
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
// Preload all content (call at game start for better UX)
// ─────────────────────────────────────────────────────────────────────────────

export async function preloadAllContent(): Promise<void> {
  await Promise.all([
    loadNPCs(),
    loadJournals(),
    loadBooks(),
    loadRoomNames(),
    loadDialogue(),
    loadArtifacts(),
    loadGameloop(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear cache (useful for hot reload during development)
// ─────────────────────────────────────────────────────────────────────────────

export function clearContentCache(): void {
  npcsCache = null;
  journalsCache = null;
  booksCache = null;
  roomNamesCache = null;
  dialogueCache = null;
  artifactsCache = null;
  gameloopCache = null;
  textFileCache.clear();
}
