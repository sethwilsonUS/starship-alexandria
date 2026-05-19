# Phaser 4 Stabilization And Media Pipeline Design

Date: 2026-05-19
Status: Approved design, pending implementation plan
Repo: starship-alexandria

## Goal

Make Starship Alexandria easier to evolve by upgrading to Phaser 4 first, then stabilizing input, timing, and scene boundaries, then adding a visible polish slice: local generated voice playback for the opening cutscene plus better sprites and tiles.

The work should be one cohesive branch, but it will be implemented in controlled phases:

1. Phaser 4 migration
2. Game-loop and input stabilization
3. Opening polish slice with offline voices, better sprites, and better tiles

## Current Findings

The repo currently runs on Phaser 3.90.0. A temporary Phaser 4.1.0 canary typecheck found a small, concrete migration issue: `Tilemap.createLayer()` can now return `TilemapLayer | TilemapGPULayer`, so existing fields typed as `TilemapLayer` need narrowing or a helper.

The active runtime is the Next page mounting `GameContainer`, which mounts `PhaserGame`, which starts `src/game/main.ts` with `BootScene`, `ExploreScene`, and `ShipScene`.

The current uncommitted worktree is part of the intended baseline for this plan. It should be preserved and integrated rather than treated as unrelated noise. The notable baseline changes are:

- `MapScene` has been removed from the Phaser scene list, and `MapOverlay` is rendered from React through `GameContainer`.
- Map opening now routes through the store action rather than the old `open-map-scene` EventBridge event.
- `MapOverlay` has richer room/corridor rendering, visited/unvisited state, discovered NPC filtering, and defensive animation timing.
- Interaction prompt/log handlers tolerate empty payloads, and interaction prompts are cleared on system detach/shutdown.
- Returning to ship resets more expedition session state.
- The debug panel visibility now initializes from the query string without a post-render effect.
- `next.config.mjs` no longer ignores ESLint during builds.
- `STREAM_IDEAS.md` is project context and should be kept unless the user decides to move it elsewhere.

Generated brainstorming and playtest artifacts such as `.superpowers/` and `.codex-playtest-*.png` should not be included in implementation commits unless explicitly requested.

Important issues found during the audit:

- `ExploreScene` owns too many responsibilities: map setup, placement, tile layers, fog/FOV, announcements, pickups, effects, transitions, and event handling.
- Space/Enter can leak from the React ship library into the new Phaser expedition scene, causing immediate transporter activation after beam-down.
- Announcement and effect sequencing uses scattered `setTimeout` and 16ms delayed-call loops that are hard to cancel when scenes change.
- Sprites and tiles are mostly generated at runtime in `BootScene`. This is useful as a fallback, but it makes art direction and asset replacement harder.
- Browser-native speech is used through the Web Speech API, and Chrome voices are not acceptable as the default spoken experience.
- `npm test` currently fails before tests run because Vitest/Vite config loading hits an ESM/CJS issue. Typecheck, lint, content validation, and build passed during the audit.

## Phaser 4 Decision

The Phaser 4 upgrade is worth doing now, before deeper refactors.

Rationale:

- The canary migration looked small for this codebase.
- The game does not appear to rely on custom renderer pipelines, custom shaders, or advanced internals that would make Phaser 4 especially risky.
- Upgrading first avoids building new input, timer, asset, and audio abstractions around Phaser 3 assumptions.
- Doing it as a narrow first phase keeps migration problems separate from architecture changes.

Phase 1 must stay behavior-preserving. It should update Phaser, fix compile/runtime compatibility issues, and verify the same game flows still work. Broader cleanup waits for Phase 2.

## Phase 1: Phaser 4 Migration

### Scope

- Upgrade `phaser` to Phaser 4.1.x unless a fresh official check before implementation shows a newer stable Phaser 4 patch/minor release with no added migration risk.
- Fix TypeScript issues caused by API changes.
- Add a small tilemap layer helper or explicit narrowing for `TilemapLayer | TilemapGPULayer`.
- Verify `BootScene`, `ShipScene`, and `ExploreScene` still boot and play.
- Preserve the current React `MapOverlay` approach and do not reintroduce the old Phaser `MapScene`.
- Review Phaser config for Phaser 4-friendly settings, including `pixelArt`, scale behavior, and renderer compatibility.

### Non-Goals

- Do not split `ExploreScene` in this phase.
- Do not change gameplay behavior in this phase unless needed to preserve existing behavior.
- Do not add the voice or sprite pipelines in this phase.

### Acceptance

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Browser smoke test confirms ship UI, beam-down, exploration, interaction prompts, fog, pickups, and return transitions still function.
- Any Phaser 4 warnings or runtime errors are either fixed or documented before moving to Phase 2.

## Phase 2: Game-Loop And Input Stabilization

### InputActionRouter

Create a central input layer that turns raw keyboard, React overlay, and Phaser input events into semantic game actions:

- `move.up`
- `move.down`
- `move.left`
- `move.right`
- `interact`
- `openMap`
- `advanceDialogue`
- `beamDown`
- `useBattery`
- `hudSummary`

The router should understand the current interaction context: ship, expedition, dialogue, map overlay, transition, and disabled/focused states. Phaser systems and React overlays should consume semantic actions instead of adding independent global `keydown` listeners for the same behavior. The current React `MapOverlay` should become one of the router's consumers rather than being replaced by a Phaser scene.

### TransitionGuard / GameFlowController

Add a scene-transition guard that owns:

- transition epochs
- short input cooldowns around scene changes
- stale action rejection
- held/repeated key handling across React-to-Phaser boundaries

This should fix the Space-key beam-down/transporter activation bug by design. A key that triggered beam-down in the ship should not be able to immediately trigger `interact` in the new expedition scene.

### AnnouncementQueue

Replace scattered `setTimeout` narration chains with a cancellable queue that is aware of scene lifecycle and room changes.

Responsibilities:

- enqueue narration/caption events
- cancel by scene shutdown, room change, or explicit owner token
- avoid overlapping stale lines
- notify the local narrator service in Phase 3 when voice clips exist
- always preserve the accessible text/log path

### FxController

Move beam, pickup, and similar visual effects from hand-rolled 16ms loops into Phaser tweens, timelines, or update-driven controllers with explicit cleanup.

Responsibilities:

- start named effects
- cancel/cleanup on scene shutdown
- avoid orphan delayed calls
- keep effect timing deterministic enough for smoke testing

### ExploreScene Decomposition

Split the largest responsibilities into focused helpers while keeping the scene as the orchestration layer:

- `ExpeditionController`: owns expedition startup, map creation orchestration, store synchronization, and high-level scene state.
- `PlacementSystem`: owns player, robot, pickup, transporter, hazard, and room-content placement decisions.
- `FogRenderer`: owns FOV/fog overlay rendering and update triggers.
- `PickupController`: owns pickup view creation, interaction, and collection effects.
- `AnnouncementQueue`: owns room and interaction narration sequencing.
- `FxController`: owns visual effect timing and cleanup.

The exact file names can be adjusted during implementation to match the repo's conventions, but each unit should have one clear reason to change.

### Acceptance

- The Space-key leak is reproduced by a failing test or documented smoke step before the fix, then fixed.
- Input router tests cover held keys, repeated keys, overlays, scene transitions, and stale action rejection.
- Announcement queue tests cover cancellation on scene shutdown and room changes.
- Effects have explicit cleanup paths.
- Existing gameplay remains intact after the scene decomposition.

## Phase 3: Opening Polish Slice

Phase 3 includes both audio and visual polish. It is not voice-only.

### Voice Pipeline

Use OpenAI TTS as a development-time recording booth only. The shipped game must not call OpenAI or require an API key.

Design:

- Opening cutscene lines receive stable line IDs.
- A dev-only script reads the selected lines and calls OpenAI `gpt-4o-mini-tts`.
- Generated clips are written to local files under `public/audio/voices/opening/`.
- A generated or maintained voice manifest maps `lineId` to audio path, voice, model, duration if known, and source text hash.
- The runtime narrator asks for `lineId`, plays the local clip when present, and always updates captions/accessibility logs.
- Browser TTS fallback should be off by default once the local voice path exists. It can remain an opt-in setting for missing dynamic lines if needed.
- The game should include a concise disclosure in settings, credits, or an equivalent surface that generated voice clips are AI-generated.

The first implementation records only the opening cutscene. Later content can be added incrementally by adding line IDs and regenerating the manifest.

### Runtime Audio Behavior

The runtime narrator should degrade kindly:

- If a local clip exists, play it and show/log the text.
- If a clip is missing, show/log the text.
- If browser TTS fallback is enabled, use it only for missing clips or dynamic lines.
- If audio playback fails, log a clear warning and keep captions/log output working.

### Sprite And Tile Pipeline

Introduce an asset manifest for sprites, tiles, and audio keys. The manifest should let scenes refer to stable semantic asset names instead of scattered literal texture keys.

The procedural textures generated in `BootScene` can remain as development or missing-asset fallback, but the visible art path should move toward loaded files.

Initial sprite and tile priorities:

- player character
- robot companion
- transporter pad
- key pickups and batteries
- important hazards or interactables
- floor, wall, door, and room-boundary tiles
- one or two high-value room landmarks if they improve orientation

Art requirements:

- preserve high contrast
- keep silhouettes readable at game scale
- keep tile boundaries obvious under fog/FOV overlays
- avoid tiny details that disappear for low-vision play
- preserve or improve accessible affordances already present in the procedural sprites

### Acceptance

- Opening cutscene can play local generated voice clips.
- The game makes no OpenAI calls at runtime.
- Captions/accessibility logs work with and without audio.
- Missing voice clips and missing assets fall back gracefully.
- The most visible placeholder sprites/tiles are replaced or routed through the new manifest/fallback system.
- Browser playtest verifies sprites and tiles remain readable in ship and expedition contexts.

## Testing And Tooling

Fix the Vitest/Vite ESM config issue early so tests can run before relying on new coverage. The likely fix is to make the Vitest config load as ESM or align the config with the installed Vite/Vitest versions.

Recommended test targets:

- `InputActionRouter`
- `TransitionGuard` / `GameFlowController`
- `AnnouncementQueue`
- `PlacementSystem`
- voice manifest loader and local narrator fallback behavior

Recommended validation after each phase:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` after the test runner config is fixed
- browser smoke test through ship, beam-down, expedition interaction, map/dialogue overlays, pickup, and return transition

## Implementation Order

1. Treat the current code worktree as baseline and preserve its map/UI/reset behavior.
2. Fix test runner config if it blocks new tests.
3. Upgrade Phaser and complete Phase 1 acceptance.
4. Add regression coverage or a documented browser repro for the Space-key leak.
5. Build `InputActionRouter` and transition guard.
6. Route ship/React and Phaser controls through semantic actions.
7. Replace scattered announcement timing with `AnnouncementQueue`.
8. Replace hand-rolled visual effect loops with `FxController`.
9. Extract focused helpers from `ExploreScene`.
10. Add asset manifest and procedural fallbacks.
11. Add voice manifest and dev-only OpenAI TTS generation script.
12. Generate and wire opening cutscene voice clips.
13. Replace the highest-value sprites and tiles.
14. Run full validation and browser playtest.

## Open Questions Deferred To Implementation

These do not block the design:

- Exact voice choice and tone instructions for the opening cutscene.
- Exact art sourcing path: generated pixel art, hand-authored local assets, or an approved free asset pack normalized into the manifest.
- Exact line ID strategy: authored IDs in content files or deterministic IDs from content paths plus keys.

The implementation plan should choose conservative defaults and keep these decisions easy to revise.

## References

- Phaser 4 migration guide: https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md
- Phaser 3 vs Phaser 4 overview: https://phaser.io/news/2026/05/phaser-3-vs-phaser-4
- Phaser 4.1.0 release notes: https://phaser.io/news/2026/04/phaser-4-1-0-salusa-release
- OpenAI text-to-speech guide: https://platform.openai.com/docs/guides/text-to-speech
- OpenAI Audio API reference: https://platform.openai.com/docs/api-reference/audio/voice-object
