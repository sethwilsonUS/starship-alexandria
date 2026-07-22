#!/usr/bin/env node

// Backward-compatible entry point retained for the existing package script.
// The importer owns both generation and provenance so the two cannot drift.
await import('./import-external-game-assets.mjs');
