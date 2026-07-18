import type { ContentThemeId } from './content';

/** BookFragment is an included excerpt presented in the player's library. */

export interface BookFragment {
  id: string;
  bookId: string;
  label: string; // e.g. "Canto I"
  order: number;
  text: string; // Full text from Project Gutenberg
  /** Available for catalog-loaded excerpts; optional on legacy save fixtures. */
  sourceLocation?: string;
  themeAffinities?: ContentThemeId[];
  editorialContext?: string;
}
