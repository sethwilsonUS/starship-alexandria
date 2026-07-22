# Destination theme authoring

A destination is more than a palette. It combines a registry record, a topology contract, semantic surfaces, local art/audio, themed content pools, and one clue/vault story. The React mission picker renders from the registry, so a complete theme appears there without adding another UI card.

This guide uses `observatory` as an illustrative fifth ID. Do not add the example verbatim; settle its narrative and spatial contract first.

## 1. Define the theme ID

Add the stable ID to the shared theme lists:

- `EXPEDITION_THEME_IDS` and `ThemeId` in `src/game/expeditions/types.ts`;
- `CONTENT_THEME_IDS` in `src/types/content.ts`;
- `SavedThemeId` and its runtime guard in `src/store/saveMigration.ts`;
- `THEME_IDS` in `scripts/validate-content.js`.

These lists intentionally make forgotten content/save/validation wiring a type or validation error instead of a destination that half-exists. Once published, treat the ID as persistent save data.

If the theme introduces a new structural family, extend `TopologyKind`; if it needs new named spatial categories, extend `ZoneKind`. Both live in `src/game/expeditions/types.ts`.

## 2. Register mission-facing data

Add one `ExpeditionTheme` entry in `src/game/expeditions/themes.ts`:

```ts
observatory: {
  id: 'observatory',
  title: 'The Fallen Orrery',
  kicker: 'The sky survived in brass',
  description: 'A ruined observatory whose instruments still track an absent horizon.',
  environment: 'Dome galleries, chart rooms, open roof',
  hazard: 'Broken mechanisms and exposed walkways',
  objective: 'Recover the final observations and their marginal poems.',
  topology: 'radial',
  atlasKey: 'tiles-observatory',
  ambienceKey: 'ambience-observatory',
  accentColor: '#a7b7d8',
  roomNames: [/* at least five topology-relevant names */],
  npcIds: ['npc-one', 'npc-two'],
  journalIds: ['journal-observatory-one', 'journal-observatory-two'],
  propIds: ['brass-orrery', 'fallen-chart-rack'],
  vault: {
    contentId: 'vault-observatory-chart-case',
    clueContentId: 'clue-observatory-ephemeris',
    label: 'Sealed chart case',
    clueLabel: 'Marked ephemeris',
    clueDescription: 'A chart annotation identifies the case sequence.',
    preferredZoneName: 'the meridian archive',
  },
}
```

The picker uses the title, kicker, description, environment, hazard, objective, and accent. Write copy that distinguishes play, not only lore. `roomNames` must include the exact `preferredZoneName` used for vault placement.

`chooseSurpriseTheme` draws uniformly from the ID list and removes the immediately previous theme when possible; no theme-specific picker logic is needed.

## 3. Build a topology contract

Add the theme branch to `buildLayout` in `src/game/expeditions/layouts.ts` and provide a deterministic fallback in `buildFallbackLayout`.

A valid layout must provide:

- a rectangular `SemanticCell[][]` matching `MAP_WIDTH × MAP_HEIGHT`;
- a walkable spawn and extraction point (currently the same transporter location);
- connected, named zones with bounds and centers;
- enough reachable floor to place all required entities;
- impassable cells that are opaque walls or rubble;
- a structural signature that differs from every existing destination.

Use semantic cells rather than frame numbers:

```ts
{
  terrain: 'stone-floor',
  walkable: true,
  opaque: false,
  surface: 'stone',
  renderRole: 'floor',
  zoneId: 'observatory-meridian-archive',
}
```

Choose `surface` for sound and movement meaning, and `renderRole` for visual meaning. Do not infer walkability from either one.

Every random decision must come from the `SeededRandom` instance passed to the builder. If using a rot.js map class, wrap the operation with `withRotSeed`; never leave rot.js's singleton state changed. Do not call `Math.random()` or read the clock in generation code.

Keep concerns on named streams. Layout changes may alter cells and zones; decoration changes should not relocate a clue, NPC, or vault. If a new concern would consume a variable number of random values, give it a separate seed suffix.

## 4. Add semantic art and sound

Runtime media is committed under `public/` and preloaded locally. The game must remain fully playable without a network connection after the page loads.

### Tiles

Add a theme sheet under `public/game-assets/tiles/` and register it in:

- `ASSET_KEYS.tilesets` and `THEME_TILESET_KEYS`;
- `IMAGE_ASSETS` in `src/game/assets/assetManifest.ts`;
- the maintainer refresh recipe and `public/game-assets/manifest.json`.

The current atlas contract is a 4×3 sheet of 32px runtime tiles (16px source art displayed at 2×). Tile indices are shared semantic roles:

| Index | Role |
| ---: | --- |
| 0 | base floor |
| 1 | grass/floor variant |
| 2 | dirt/path |
| 3 | stone or secondary floor |
| 4 | wall, blocking |
| 5 | rubble, blocking |
| 6 | vine/vegetation overlay |
| 7 | debris overlay |
| 8 | flooded/water overlay |

The roles are compatible across themes, but silhouettes, materials, hue/value structure, and props should make screenshots recognizably different. Verify collision-critical tiles at 100% and 200% zoom; decorative detail must not disguise walls, the player, or interactables.

### Audio

Register an OGG/MP3 ambience pair under `public/game-assets/audio/ambience/` and map the theme in `ASSET_KEYS.audio.ambience.byTheme`. Footsteps usually reuse the semantic surface library (`stone`, `dirt`, `grass`, `sand`, `water`, or another explicitly supported surface).

Every sound needs a visible or spoken equivalent. Ambience must loop cleanly, respect the launch gesture and settings, pause when the page is hidden, and stop during scene cleanup.

### Provenance

For every new file, record owner, title, source page, license, transformation, byte size, and SHA-256 hash in the asset manifest. Add the source and deterministic transformation to `scripts/import-external-game-assets.mjs`; do not make the production build download art.

Only compatible CC0/OFL media belongs in this refresh. Generated art should record the generation tool/model and editing steps in provenance even when the output's use terms do not require attribution.

Run:

```bash
npm run refresh-assets
npm run validate-assets
```

## 5. Add themed content

The registry's content IDs must resolve in `public/content/`:

1. Add exactly two NPCs with the new `themeIds` value and complete `firstMeet`, `return`, and `postVault` dialogue.
2. Add at least one themed journal; two provides useful deterministic variety.
3. Add exactly one vault with a unique clue ID, locked/opening/opened copy, `{code}` substitution, and exhausted-catalog reward.
4. Add theme affinities to excerpts that genuinely fit the destination.
5. Keep the registry's `npcIds`, `journalIds`, vault `contentId`, and `clueContentId` synchronized with YAML.

Both NPCs must be able to orient a player toward the clue because generation may place either one. Clue discovery must remain sufficient to open the vault; never require code entry, color matching, sound recognition, or prior knowledge of another expedition.

See [Content authoring](CONTENT_AUTHORING.md) for schemas.

## 6. Preserve map and accessibility equivalents

For each named zone, provide a short, understandable room name. Verify that the textual map can describe:

- the player's current zone;
- discovered zones and approximate directions/distances;
- known NPCs and interactables;
- the route back to extraction.

New hazards must have nonvisual feedback. New effects must honor `system | reduce | full`, including a motion-free state change with the same information. Test the complete theme with narration and game audio independently disabled.

## 7. Extend the tests

Adding an ID to `EXPEDITION_THEME_IDS` automatically includes it in the parameterized 250-seed contract test. Add theme-specific assertions for the topology's spatial signature.

At minimum, verify:

- same input produces a deeply equal expedition;
- layout/placement are independent from cosmetic or catalog selection changes;
- dimensions and every cell contract are valid;
- spawn, extraction, clue, entities, vault, and each zone are reachable;
- entities do not overlap and blocking entities have an accessible adjacent tile;
- one or two nonduplicate NPCs come only from the theme pool;
- fragment, journal, map, clue, and vault counts are in range;
- an affiliated uncollected fragment is preferred for the vault;
- exhausted catalogs yield their authored lore note;
- attempts are bounded at 20 and the fallback is valid;
- rot.js RNG seed/state are restored;
- the visual browser snapshot is distinct at both supported showcase sizes;
- the full expedition is completable with keyboard-only input.

Run the full gate:

```bash
npm run check
npm run test:e2e
```

## Completion checklist

- [ ] Theme ID is included in generation, content validation, and save migration.
- [ ] Mission card copy explains a distinct play experience.
- [ ] Primary and fallback layouts satisfy a unique topology contract.
- [ ] Semantic surfaces drive collision, FOV, and footsteps correctly.
- [ ] Local tiles, props, ambience, and provenance are registered.
- [ ] Exactly two NPCs, at least one journal, and one clue/vault loop validate.
- [ ] Textual map and reduced-motion equivalents communicate every essential state.
- [ ] Unit, 250-seed, accessibility, keyboard, and visual browser tests pass.
