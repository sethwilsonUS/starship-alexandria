# Editing Starship Alexandria

The maintained editing instructions have moved to two focused guides:

- [Content authoring](docs/CONTENT_AUTHORING.md) — excerpts, source metadata, NPCs, journals, vaults, dialogue, and validation.
- [Destination theme authoring](docs/THEME_AUTHORING.md) — registry data, topology, semantic tiles, assets/audio, content pools, and tests.

All runtime narrative content lives under `public/content/`. A root-level `content/` directory is intentionally invalid.

For a quick content-only check:

```bash
npm run validate-content
```

For the complete repository gate:

```bash
npm run check
```
