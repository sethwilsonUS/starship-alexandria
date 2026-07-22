import type { ContentThemeId, PublicDomainSource } from './content';

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

/** Canonical, fully loaded catalog work presented by the data adapter. */
export interface Book {
  id: string;
  title: string;
  author: string;
  source: PublicDomainSource;
  includedFragmentCount: number;
  fragments: FragmentDef[];
}

/** Canonical excerpt definition after its public/content text has loaded. */
export interface FragmentDef {
  id: string;
  bookId: string;
  label: string;
  order: number;
  text: string;
  sourceLocation: string;
  themeAffinities: ContentThemeId[];
  editorialContext?: string;
}
