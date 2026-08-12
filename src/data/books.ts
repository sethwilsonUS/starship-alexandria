/**
 * Book catalog: titles, fragments, Gutenberg text.
 * Content is loaded from the canonical public/content/books.yaml and public/content/texts/.
 */

import type { Book, BookFragment, FragmentDef } from '@/types/books';
import {
  getAllBooks,
  getBookById as getContentBookById,
  getFragmentById as getContentFragmentById,
  getAllFragments,
  getRandomFragmentsForMap as getContentRandomFragmentsForMap,
  type BookYaml,
  type FragmentWithText,
} from '@/utils/contentLoader';

export type { Book, FragmentDef } from '@/types/books';

export function fragmentWithTextToFragmentDef(f: FragmentWithText): FragmentDef {
  return {
    id: f.id,
    bookId: f.bookId,
    label: f.label,
    order: f.order,
    text: f.text,
    sourceLocation: f.sourceLocation,
    themeAffinities: [...f.themeAffinities],
    editorialContext: f.editorialContext,
  };
}

export function toBookFragment(f: FragmentDef): BookFragment {
  return {
    id: f.id,
    bookId: f.bookId,
    label: f.label,
    order: f.order,
    text: f.text,
    sourceLocation: f.sourceLocation,
    themeAffinities: [...f.themeAffinities],
    editorialContext: f.editorialContext,
  };
}

export async function loadBookCatalog(): Promise<Book[]> {
  const books = await getAllBooks();
  const allFragments = await getAllFragments();
  
  return books.map((book: BookYaml) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    archivistNote: book.archivistNote,
    source: book.source,
    includedFragmentCount: book.fragments.length,
    fragments: allFragments
      .filter((f) => f.bookId === book.id)
      .map(fragmentWithTextToFragmentDef),
  }));
}

export async function getFragmentById(id: string): Promise<BookFragment | undefined> {
  const fragment = await getContentFragmentById(id);
  return fragment ? toBookFragment(fragmentWithTextToFragmentDef(fragment)) : undefined;
}

export async function getRandomFragmentsForMap(count: number): Promise<FragmentDef[]> {
  const fragments = await getContentRandomFragmentsForMap(count);
  return fragments.map(fragmentWithTextToFragmentDef);
}

export async function getAllFragmentDefs(): Promise<FragmentDef[]> {
  const fragments = await getAllFragments();
  return fragments.map(fragmentWithTextToFragmentDef);
}

// Backward compatibility: cached catalog for sync access after initial load
let _cachedBookCatalog: Book[] | null = null;

export function setCachedBookCatalog(books: Book[]): void {
  _cachedBookCatalog = books;
}

export function getBookCatalogSync(): Book[] {
  if (!_cachedBookCatalog) {
    throw new Error('BOOK_CATALOG not loaded. Call loadBookCatalog() first.');
  }
  return _cachedBookCatalog;
}

export function getBookByIdSync(id: string): Book | undefined {
  return getBookCatalogSync().find((b) => b.id === id);
}
