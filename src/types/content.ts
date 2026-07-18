/** Destination identifiers shared by narrative content and expedition generation. */
export const CONTENT_THEME_IDS = [
  'scriptorium',
  'cathedral',
  'university',
  'gardens',
] as const;

export type ContentThemeId = (typeof CONTENT_THEME_IDS)[number];

/** Provenance retained with every public-domain work in the catalog. */
export interface PublicDomainSource {
  provider: 'Project Gutenberg';
  ebookNumber: number;
  edition: string;
  url: string;
  publicDomainNote: 'Public domain in the USA';
}
