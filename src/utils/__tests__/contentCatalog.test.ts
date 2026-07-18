import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const contentRoot = path.resolve(process.cwd(), 'public', 'content');
const themeIds = ['scriptorium', 'cathedral', 'university', 'gardens'] as const;

type Catalog = {
  books: Array<{
    id: string;
    totalFragments?: number;
    source: {
      provider: string;
      ebookNumber: number;
      edition: string;
      url: string;
      publicDomainNote: string;
    };
    fragments: Array<{
      id: string;
      textFile: string;
      sourceLocation: string;
      themeAffinities: string[];
      editorialContext?: string;
    }>;
  }>;
};

type NPCContent = {
  npcs: Array<{
    id: string;
    themeIds: string[];
    postVault: Array<{ text: string }>;
  }>;
};

type VaultContent = {
  vaults: Array<{
    id: string;
    themeId: string;
    clue: { id: string; lines: Array<{ text: string }> };
  }>;
};

type JournalContent = {
  journals: Array<{ id: string; themeIds: string[] }>;
};

function readYaml<T>(filename: string): T {
  return parseYaml(readFileSync(path.join(contentRoot, filename), 'utf8')) as T;
}

describe('the shipped literary catalog', () => {
  it('contains exactly the 21 sourced excerpts in the refresh', () => {
    const catalog = readYaml<Catalog>('books.yaml');
    const fragments = catalog.books.flatMap((book) => book.fragments);

    expect(fragments).toHaveLength(21);
    expect(catalog.books.map((book) => book.id)).toEqual(
      expect.arrayContaining([
        'paradise-lost',
        'canterbury',
        'faerie-queene',
        'frankenstein',
        'vindication',
        'douglass-narrative',
      ])
    );
    expect(catalog.books.every((book) => book.totalFragments === undefined)).toBe(true);
  });

  it('provides source provenance and valid destination affinities for every excerpt', () => {
    const catalog = readYaml<Catalog>('books.yaml');

    for (const book of catalog.books) {
      expect(book.source.provider).toBe('Project Gutenberg');
      expect(book.source.ebookNumber).toBeGreaterThan(0);
      expect(book.source.url).toBe(
        `https://www.gutenberg.org/ebooks/${book.source.ebookNumber}`
      );
      expect(book.source.edition.length).toBeGreaterThan(0);
      expect(book.source.publicDomainNote).toBe('Public domain in the USA');

      for (const fragment of book.fragments) {
        expect(fragment.sourceLocation.length).toBeGreaterThan(0);
        expect(fragment.themeAffinities.length).toBeGreaterThan(0);
        expect(fragment.themeAffinities.every((id) => themeIds.includes(id as never))).toBe(true);

        const text = readFileSync(path.join(contentRoot, 'texts', fragment.textFile), 'utf8');
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toMatch(/START OF THE PROJECT GUTENBERG|END OF THE PROJECT GUTENBERG/i);
      }
    }
  });
});

describe('the shipped destination characters and vaults', () => {
  it('offers exactly two distinct NPCs with post-vault dialogue per destination', () => {
    const { npcs } = readYaml<NPCContent>('npcs.yaml');

    expect(npcs).toHaveLength(8);
    for (const themeId of themeIds) {
      const pool = npcs.filter((npc) => npc.themeIds.includes(themeId));
      expect(pool.map((npc) => npc.id)).toHaveLength(2);
      expect(new Set(pool.map((npc) => npc.id)).size).toBe(2);
      expect(pool.every((npc) => npc.postVault.length > 0)).toBe(true);
    }
  });

  it('provides the journal IDs consumed by every destination registry entry', () => {
    const { journals } = readYaml<JournalContent>('journals.yaml');
    const idsByTheme = Object.fromEntries(
      themeIds.map((themeId) => [
        themeId,
        journals.filter((journal) => journal.themeIds.includes(themeId)).map((journal) => journal.id),
      ])
    );

    expect(idsByTheme.scriptorium).toEqual(
      expect.arrayContaining(['journal-diary-1', 'journal-memo'])
    );
    expect(idsByTheme.cathedral).toEqual(
      expect.arrayContaining(['journal-cathedral-hymnal', 'journal-cathedral-memorial'])
    );
    expect(idsByTheme.university).toEqual(
      expect.arrayContaining(['journal-university-memo', 'journal-university-notes'])
    );
    expect(idsByTheme.gardens).toEqual(
      expect.arrayContaining(['journal-garden-log', 'journal-garden-specimens'])
    );
  });

  it('defines one unique clue-bearing vault per destination', () => {
    const { vaults } = readYaml<VaultContent>('vaults.yaml');

    expect(vaults).toHaveLength(4);
    expect(vaults.map((vault) => vault.themeId).sort()).toEqual([...themeIds].sort());
    expect(new Set(vaults.map((vault) => vault.id)).size).toBe(4);
    expect(new Set(vaults.map((vault) => vault.clue.id)).size).toBe(4);
    expect(vaults.every((vault) => vault.clue.lines.some((line) => line.text.includes('{code}')))).toBe(true);
  });
});
