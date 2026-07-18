import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  loadBookCatalog,
  toBookFragment,
  fragmentWithTextToFragmentDef,
} from '../books';
import { clearContentCache, type FragmentWithText } from '@/utils/contentLoader';

const sampleFragmentWithText: FragmentWithText = {
  id: 'iliad-canto-1',
  bookId: 'iliad',
  label: 'Canto I',
  order: 1,
  text: 'Sing, O goddess, the anger of Achilles...',
  sourceLocation: 'Book I, opening invocation',
  themeAffinities: ['scriptorium'],
};

describe('fragmentWithTextToFragmentDef', () => {
  it('maps all fields from FragmentWithText to FragmentDef', () => {
    const result = fragmentWithTextToFragmentDef(sampleFragmentWithText);
    expect(result).toEqual({
      id: 'iliad-canto-1',
      bookId: 'iliad',
      label: 'Canto I',
      order: 1,
      text: 'Sing, O goddess, the anger of Achilles...',
      sourceLocation: 'Book I, opening invocation',
      themeAffinities: ['scriptorium'],
    });
  });

  it('does not include extra properties from the input', () => {
    const extended = { ...sampleFragmentWithText, extraField: 'should be dropped' } as FragmentWithText;
    const result = fragmentWithTextToFragmentDef(extended);
    expect(Object.keys(result)).toEqual([
      'id',
      'bookId',
      'label',
      'order',
      'text',
      'sourceLocation',
      'themeAffinities',
      'editorialContext',
    ]);
  });
});

describe('toBookFragment', () => {
  it('converts FragmentDef to BookFragment with identical shape', () => {
    const def = fragmentWithTextToFragmentDef(sampleFragmentWithText);
    const fragment = toBookFragment(def);
    expect(fragment).toEqual({
      id: 'iliad-canto-1',
      bookId: 'iliad',
      label: 'Canto I',
      order: 1,
      text: 'Sing, O goddess, the anger of Achilles...',
      sourceLocation: 'Book I, opening invocation',
      themeAffinities: ['scriptorium'],
      editorialContext: undefined,
    });
  });

  it('handles empty text gracefully', () => {
    const def: ReturnType<typeof fragmentWithTextToFragmentDef> = {
      id: 'empty-frag',
      bookId: 'some-book',
      label: 'Chapter 1',
      order: 0,
      text: '',
      sourceLocation: 'Chapter 1',
      themeAffinities: ['university'],
      editorialContext: undefined,
    };
    const fragment = toBookFragment(def);
    expect(fragment.text).toBe('');
    expect(fragment.id).toBe('empty-frag');
  });
});

describe('loadBookCatalog', () => {
  afterEach(() => {
    clearContentCache();
    vi.unstubAllGlobals();
  });

  it('derives includedFragmentCount instead of trusting a stored total', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === '/content/books.yaml') {
          return new Response(`
books:
  - id: sample
    title: Sample
    author: Anonymous
    source:
      provider: Project Gutenberg
      ebookNumber: 1
      edition: Test edition
      url: https://www.gutenberg.org/ebooks/1
      publicDomainNote: Public domain in the USA
    fragments:
      - id: sample-1
        label: First excerpt
        order: 1
        textFile: sample/first.txt
        sourceLocation: Chapter I
        themeAffinities: [scriptorium]
`);
        }
        if (url === '/content/texts/sample/first.txt') {
          return new Response('A known-good excerpt.');
        }
        return new Response('Not found', { status: 404 });
      })
    );

    const [book] = await loadBookCatalog();

    expect(book.includedFragmentCount).toBe(1);
    expect(book.fragments).toHaveLength(1);
    expect(book).not.toHaveProperty('totalFragments');
  });
});
