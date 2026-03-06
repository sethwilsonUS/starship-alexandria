# Starship Alexandria

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Phaser 3](https://img.shields.io/badge/Phaser-3.90-8B5CF6)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![rot.js](https://img.shields.io/badge/rot.js-2.2-orange)
![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)
![CI](https://github.com/sethwilsonUS/starship-alexandria/actions/workflows/ci.yml/badge.svg)

![Starship Alexandria screenshot](screenshot.png)

A cozy roguelike about recovering lost literature from the ruins of post-apocalyptic Earth.

After a cataclysm, Earth's great works of literature were scattered across the ruins. You play as a crew member aboard the Starship Alexandria, a library ship orbiting what remains. Your mission: beam down to the surface, explore overgrown universities and collapsed libraries, recover fragments of lost classics, and rebuild humanity's library one page at a time.

No combat. No death. Just exploration, discovery, and the words that endure.

## Features

- **Procedural exploration** -- Every expedition generates a new ruin to explore using rot.js, with rooms, corridors, rubble, and flooded passages
- **Real literature** -- Collect fragments of actual public-domain texts: Dante's *Inferno*, Shakespeare's *The Tempest*, Chaucer's *Canterbury Tales*, Spenser's *Faerie Queene*, Dickinson's poetry, and passages from the King James Bible
- **Fog of war & flashlight** -- Limited visibility with a battery-powered flashlight that dims over time but never goes dark
- **Turn-based, no pressure** -- Move at your own pace on a tile grid; there is no player death and no time limit
- **NPCs & lore** -- Meet survivors sheltering in the ruins, read water-damaged journals, unlock vaults with hidden codes
- **Ship library** -- Return to the Alexandria to browse your growing collection and read the texts you've recovered
- **Accessibility-first** -- Full keyboard navigation, ARIA live regions for game events, text-to-speech for dialogue and book text, high-contrast player and interactive highlights

## Getting Started

**Prerequisites:** [Node.js](https://nodejs.org) (v20+)

```bash
git clone https://github.com/sethwilsonUS/starship-alexandria.git
cd starship-alexandria
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Validate content and create a production build |
| `npm run validate-content` | Check YAML content files for errors |
| `npm run clean` | Remove build artifacts |

## Project Structure

```
src/
├── app/                  # Next.js App Router (layout, page)
├── components/           # React UI overlays
│   ├── GameContainer     #   Mounts Phaser + wires events to React
│   ├── HUD               #   Battery, fragment count, controls
│   ├── DialogueBox       #   NPC and journal dialogue with TTS
│   ├── BookDetail        #   Paginated reading view for collected texts
│   ├── LibraryShelf      #   Ship library browser and beam-down trigger
│   ├── InteractionPrompt #   Context-sensitive action prompt
│   ├── MapOverlay        #   Area map with rooms and NPC markers
│   └── AccessibleLog     #   ARIA live region for screen readers
├── game/
│   ├── scenes/           # Phaser scenes (Boot, Ship, Explore, Map)
│   ├── entities/         # Player, NPC, BookPickup
│   ├── systems/          # GridMovement, FOV, MapGenerator, Interaction
│   └── EventBridge       # Typed event bus (Phaser <-> React)
├── store/                # Zustand state (designed for future Convex migration)
├── data/                 # Runtime loaders for YAML content
├── config/               # Game constants (tile size, FOV radius, speeds)
├── types/                # TypeScript type definitions
└── utils/                # Helpers (Gutenberg formatting, flashlight, speech)

content/
├── books.yaml            # Book and fragment catalog
├── npcs.yaml             # NPC definitions and dialogue
├── dialogue.yaml         # NPC dialogue trees
├── journals.yaml         # Discoverable journal entries
├── artifacts.yaml        # Vault artifact definitions
├── rooms.yaml            # Room name templates
├── gameloop.yaml         # Welcome, victory, and vault dialogue
└── texts/                # Public-domain literature fragments (Project Gutenberg)
```

## Game Content

All game content -- books, NPCs, dialogue, journal entries, and room names -- is defined in YAML files under `content/`. The build system validates these files before each production build.

See [EDITING.md](EDITING.md) for a guide to adding and modifying game content.

## Literature & Public Domain

All literature in this game comes from [Project Gutenberg](https://www.gutenberg.org/) and is in the **public domain** in the United States. These texts are not covered by the project's MIT license -- they belong to everyone. The included works are:

- Dante Alighieri -- *Inferno* (Henry Wadsworth Longfellow translation)
- William Shakespeare -- *The Tempest*
- Geoffrey Chaucer -- *The Canterbury Tales*
- Edmund Spenser -- *The Faerie Queene*
- Emily Dickinson -- selected poems
- *The King James Bible* -- selected chapters

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on setting up the project, submitting changes, and adding game content.

## License

This project is licensed under the [MIT License](LICENSE).

Literature texts in `content/texts/` are public domain and carry no license restrictions.
