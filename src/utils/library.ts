import { getBookCatalogSync } from '@/data/books';

export function getTotalFragments(): number {
  try {
    return getBookCatalogSync().reduce((total, book) => total + book.fragments.length, 0);
  } catch {
    return 0;
  }
}
