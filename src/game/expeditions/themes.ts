import {
  EXPEDITION_THEME_IDS,
  type ExpeditionFragmentRef,
  type ExpeditionTheme,
  type ThemeId,
} from './types';
import { SeededRandom } from './rng';

export { EXPEDITION_THEME_IDS } from './types';

export const EXPEDITION_THEMES: Readonly<Record<ThemeId, ExpeditionTheme>> = {
  scriptorium: {
    id: 'scriptorium',
    title: 'The Ruined Scriptorium',
    kicker: 'Ink, vellum, and broken vows',
    description: 'A monastic library whose copy rooms and leaning stacks survived beneath the dust.',
    environment: 'Stone corridors, timber floors, flooded stacks',
    hazard: 'Unstable shelves and waterlogged passages',
    objective: 'Recover leaves scattered through the old manuscript rooms.',
    topology: 'digger',
    atlasKey: 'tiles-scriptorium',
    ambienceKey: 'ambience-scriptorium',
    accentColor: '#c9a35f',
    roomNames: [
      'the scriptorium',
      'the chained stacks',
      'the reading room',
      'the refectory',
      'the illuminators’ workshop',
      'the sealed archives',
      'the west stacks',
      'the catalog room',
      'the old vestibule',
    ],
    npcIds: ['martha', 'eli'],
    journalIds: ['journal-diary-1', 'journal-memo'],
    propIds: ['bookshelf', 'writing-desk', 'paper-debris'],
    vault: {
      contentId: 'vault-scriptorium-archive-safe',
      clueContentId: 'clue-scriptorium-catalog-card',
      label: 'Archive safe',
      clueLabel: 'Catalog card',
      clueDescription: 'A catalog card names the shelf mark that releases the archive safe.',
      preferredZoneName: 'the sealed archives',
    },
  },
  cathedral: {
    id: 'cathedral',
    title: 'Cathedral of the Last Canticle',
    kicker: 'A hymn held under fallen stone',
    description: 'A roofless cathedral of shattered chapels, a mossy cloister, and a sealed crypt.',
    environment: 'Mosaic floors, broken arches, candle soot',
    hazard: 'Collapsed masonry and flooded undercrofts',
    objective: 'Trace the surviving hymnals from nave to crypt.',
    topology: 'cross-plan',
    atlasKey: 'tiles-cathedral',
    ambienceKey: 'ambience-cathedral',
    accentColor: '#9cb3c9',
    roomNames: [
      'the nave',
      'the crossing',
      'the choir',
      'the north chapel',
      'the south chapel',
      'the cloister',
      'the crypt',
      'the narthex',
    ],
    npcIds: ['imani', 'anselm'],
    journalIds: ['journal-cathedral-hymnal', 'journal-cathedral-memorial'],
    propIds: ['broken-pew', 'fallen-column', 'votive-stand'],
    vault: {
      contentId: 'vault-cathedral-reliquary',
      clueContentId: 'clue-cathedral-hymnal',
      label: 'Reliquary',
      clueLabel: 'Annotated hymnal',
      clueDescription: 'Marginal notes pair a memorial verse with the reliquary seal.',
      preferredZoneName: 'the crypt',
    },
  },
  university: {
    id: 'university',
    title: 'The Shattered Collegium',
    kicker: 'Dangerous knowledge keeps office hours',
    description: 'Lecture halls and laboratories encircle a courtyard reclaimed by wind and weeds.',
    environment: 'Academic halls, laboratories, open quadrangle',
    hazard: 'Chemical spills and collapsed galleries',
    objective: 'Search the faculties and special collections for forbidden research.',
    topology: 'courtyard',
    atlasKey: 'tiles-university',
    ambienceKey: 'ambience-university',
    accentColor: '#b98f67',
    roomNames: [
      'the great lecture hall',
      'the natural philosophy laboratory',
      'the registrar’s office',
      'the special collections room',
      'the north dormitory',
      'the student commons',
      'the observatory classroom',
      'the central quadrangle',
    ],
    npcIds: ['cora', 'rowan'],
    journalIds: ['journal-university-memo', 'journal-university-notes'],
    propIds: ['lecture-desk', 'laboratory-console', 'fallen-locker'],
    vault: {
      contentId: 'vault-university-special-collections',
      clueContentId: 'clue-university-registrar-memo',
      label: 'Special-collections lockbox',
      clueLabel: 'Registrar memo',
      clueDescription: 'A registrar memo records the accession mark used by the lockbox.',
      preferredZoneName: 'the special collections room',
    },
  },
  gardens: {
    id: 'gardens',
    title: 'The Overgrown Athenaeum',
    kicker: 'Every archive eventually puts down roots',
    description: 'An outdoor archive of gardens, greenhouses, and reading pavilions beneath the stars.',
    environment: 'Wild paths, glasshouses, flooded garden rooms',
    hazard: 'Deep water and dense overgrowth',
    objective: 'Recover texts preserved by the botanical seed keepers.',
    topology: 'cellular',
    atlasKey: 'tiles-gardens',
    ambienceKey: 'ambience-gardens',
    accentColor: '#79a879',
    roomNames: [
      'the botanical conservatory',
      'the sculpture garden',
      'the flooded pavilion',
      'the seed bank',
      'the observatory grove',
      'the archive orchard',
    ],
    npcIds: ['noor', 'theo'],
    journalIds: ['journal-garden-log', 'journal-garden-specimens'],
    propIds: ['planter', 'broken-statue', 'seed-crate'],
    vault: {
      contentId: 'vault-gardens-seed-bank',
      clueContentId: 'clue-gardens-greenhouse-log',
      label: 'Seed-bank cache',
      clueLabel: 'Greenhouse log',
      clueDescription: 'A greenhouse log matches specimen tags to the seed-bank cache.',
      preferredZoneName: 'the seed bank',
    },
  },
};

/** Defaults mirror the included catalog; callers can supply a runtime catalog instead. */
export const DEFAULT_FRAGMENT_CATALOG: readonly ExpeditionFragmentRef[] = [
  { id: 'inferno-canto-1', themeIds: ['gardens', 'scriptorium'] },
  { id: 'inferno-canto-3', themeIds: ['cathedral'] },
  { id: 'tempest-act-1', themeIds: ['gardens'] },
  { id: 'tempest-act-4', themeIds: ['university', 'cathedral'] },
  { id: 'canterbury-knights-tale', themeIds: ['scriptorium', 'cathedral'] },
  { id: 'canterbury-general-prologue', themeIds: ['gardens', 'cathedral'] },
  { id: 'canterbury-wife-of-bath', themeIds: ['university', 'scriptorium'] },
  { id: 'faerie-queene-1-1', themeIds: ['gardens', 'cathedral'] },
  { id: 'faerie-queene-1-2', themeIds: ['scriptorium', 'university'] },
  { id: 'faerie-queene-1-12', themeIds: ['cathedral', 'gardens'] },
  { id: 'dickinson-hope', themeIds: ['gardens'] },
  { id: 'bible-genesis-1', themeIds: ['cathedral', 'gardens'] },
  { id: 'bible-psalm-23', themeIds: ['cathedral', 'gardens'] },
  { id: 'bible-matthew-5', themeIds: ['cathedral'] },
  { id: 'bible-1corinthians-13', themeIds: ['cathedral'] },
  { id: 'bible-revelation-21', themeIds: ['cathedral', 'gardens'] },
  { id: 'paradise-lost-book-1', themeIds: ['cathedral', 'scriptorium'] },
  { id: 'paradise-lost-book-9', themeIds: ['cathedral', 'gardens'] },
  { id: 'frankenstein-chapter-4', themeIds: ['university'] },
  { id: 'vindication-national-education', themeIds: ['university'] },
  { id: 'douglass-bread-of-knowledge', themeIds: ['scriptorium', 'university'] },
];

export function isThemeId(value: string): value is ThemeId {
  return (EXPEDITION_THEME_IDS as readonly string[]).includes(value);
}

export function getExpeditionTheme(themeId: ThemeId): ExpeditionTheme {
  return EXPEDITION_THEMES[themeId];
}

export function chooseSurpriseTheme(seed: string, previousThemeId?: ThemeId | null): ThemeId {
  const eligible = previousThemeId
    ? EXPEDITION_THEME_IDS.filter((themeId) => themeId !== previousThemeId)
    : [...EXPEDITION_THEME_IDS];
  return new SeededRandom(`${seed}|surprise`).pick(eligible) ?? EXPEDITION_THEME_IDS[0];
}
