# Runtime game assets

This directory is a committed, offline runtime bundle. The game does not fetch
art or audio from third-party hosts.

- `tiles/` contains one 128×96 semantic atlas per expedition theme. Each atlas
  uses the same nine 32px roles: floor, grass, dirt, stone floor, wall, rubble,
  vine, debris, and flooded.
- `sprites/` contains 32px nearest-neighbor character, pickup, and prop art.
- `audio/` contains OGG and MP3 pairs for every cue, footstep, and ambience loop.
- `manifest.json` records hashes, dimensions, transformations, and provenance.

The source art is 16px CC0 pixel art from Kenney, displayed at 2×. Alexandria-
specific icons are deterministic project-original pixel drawings. Audio is a
CC0 subset curated from Kenney, OpenGameArt, and the sibling Beowulf project.

For the human-readable license record, see [`../../ASSET_CREDITS.md`](../../ASSET_CREDITS.md).
For reproducible maintenance, run:

```sh
npm run import-external-assets
node scripts/validate-assets.mjs
```

The importer defaults to `~/dev/kenney` and `~/dev/beowulf`. Override those
locations with `KENNEY_ROOT` and `BEOWULF_ROOT`. It verifies every input hash
before writing outputs; `ffmpeg` is needed only to build MP3 fallbacks from
Kenney's OGG originals.
