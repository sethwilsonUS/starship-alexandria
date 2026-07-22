# Contributing to Starship Alexandria

Contributions are welcome across code, public-domain content, accessibility, game feel, tests, and documentation.

## Set up

Starship Alexandria uses the Node.js version in `.nvmrc`.

```bash
git clone https://github.com/<your-username>/starship-alexandria.git
cd starship-alexandria
nvm use
npm ci
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

## Before opening a pull request

Keep the change focused and explain both its player-facing effect and how you verified it. Run:

```bash
npm run check
npm run test:e2e
```

When a browser test fails, include the relevant screenshot/trace or describe what you observed. Update a visual baseline with `npm run test:e2e:update` only after inspecting the change at the target viewport.

## Engineering boundaries

- TypeScript strict mode is enabled; avoid `any` and unchecked casts.
- React owns semantic HTML, overlays, focus, and non-canvas equivalents.
- Phaser owns world rendering and spatial presentation.
- Zustand owns progression, settings, and modal/game-phase state.
- React and Phaser communicate through the typed `EventBridge` and store actions.
- Expedition generation remains synchronous, deterministic, and independent of Phaser, React, Zustand, I/O, and `Math.random()`.
- Runtime content and assets are local; do not add remote production fetches.
- Clean up the exact event listener, timer, sound, or scene resource that a component/system registers.

Read [Architecture](docs/ARCHITECTURE.md) before changing a cross-boundary flow.

## Accessibility expectations

Every complete gameplay path must work with a keyboard. Canvas pixels, animation, color, and sound may enrich information but must not be its only carrier.

For UI/game changes:

- use semantic HTML and native controls where possible;
- preserve visible focus, logical focus order, modal focus trap, and focus return;
- prevent canvas/global shortcuts while an HTML control or modal owns input;
- send essential game events to the accessible event log;
- keep the textual map equivalent aligned with spatial state;
- honor narration, SFX, ambience, and `system | reduce | full` motion preferences;
- provide a motion-free equivalent for effects and a visible/spoken equivalent for sounds;
- test at 200% browser zoom as well as the supported desktop viewports.

Automated axe checks do not replace a keyboard-only screen-reader pass.

## Content contributions

`public/content/` is the sole narrative source. See [Content authoring](docs/CONTENT_AUTHORING.md) for the complete schemas and validation rules.

Literary excerpts must be public domain in the United States and preserve the recorded edition's wording. Include Project Gutenberg eBook/edition metadata and exact source location; do not include Gutenberg headers or footers. Never add `totalFragments`—the included count is derived.

Destination changes should also follow [Theme authoring](docs/THEME_AUTHORING.md). Each theme requires two NPCs, a journal pool, and one accessible clue/vault loop.

## Asset contributions

Runtime media must be compatible with the project's license policy and committed locally. Update the pinned refresh recipe, SHA-256 hash, transformation details, and license/source record for every asset. Run:

```bash
npm run refresh-assets
npm run validate-assets
```

Do not replace provenance with a generic credit or make builds depend on a network download. See [runtime asset provenance](public/game-assets/README.md).

## Reporting problems

Open a [GitHub issue](https://github.com/sethwilsonUS/starship-alexandria/issues) with:

- what you expected;
- what happened;
- reliable reproduction steps;
- browser, operating system, input method, and relevant accessibility settings;
- console output, screenshot, or Playwright trace when available.
