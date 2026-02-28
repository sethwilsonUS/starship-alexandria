# Starship Alexandria — Development Plan (Phases 1–2)

## Goal
Build a playable proof of concept: the player spawns on a procedurally generated map
representing a ruined Earth location, explores tile-by-tile, discovers a book fragment,
beams back to the Starship Alexandria, and sees the fragment added to their library shelf.

---

## Phase 1: Foundation & Scaffold

### 1.1 — Project Setup
- [x] Initialize project from the official Phaser + Next.js template:
      `npx create-next-app --example https://github.com/phaserjs/template-nextjs starship-alexandria`
- [x] Verify the template runs: `npm run dev` → Phaser game renders in the browser
- [x] Install additional dependencies:
      `npm install rot-js zustand uuid`
      `npm install -D @types/uuid`
- [x] Set up the folder structure:
```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx
│   └── page.tsx            # Main game page
├── components/             # React UI components
│   ├── GameContainer.tsx   # Wrapper that mounts Phaser + UI overlays
│   ├── HUD.tsx             # Top-level HUD (area name, fragment count)
│   ├── DialogueBox.tsx     # NPC / journal dialogue overlay
│   ├── LibraryShelf.tsx    # Library collection view (ship screen)
│   ├── BookDetail.tsx      # Reading a found book fragment
│   └── AccessibleLog.tsx   # ARIA live region for game events
├── game/                   # All Phaser code
│   ├── main.ts             # Phaser game config and initialization
│   ├── scenes/
│   │   ├── BootScene.ts    # Asset preloading
│   │   ├── ExploreScene.ts # Main exploration gameplay
│   │   └── ShipScene.ts    # Starship Alexandria (library view)
│   ├── entities/
│   │   ├── Player.ts       # Player entity (sprite + grid movement)
│   │   ├── NPC.ts          # NPC entity (sprite + dialogue trigger)
│   │   └── BookPickup.ts   # Collectible book fragment on map
│   ├── systems/
│   │   ├── GridMovement.ts # Grid-based movement controller
│   │   ├── MapGenerator.ts # rot.js → Phaser tilemap pipeline
│   │   ├── FOVSystem.ts    # Field of view / fog of war
│   │   └── Interaction.ts  # Proximity-based interaction detection
│   └── EventBridge.ts      # Phaser ↔ React event emitter
├── store/
│   └── gameStore.ts        # Zustand store (Convex-shaped schema)
├── data/
│   ├── books.ts            # Book catalog (titles, fragments, Gutenberg text)
│   ├── npcs.ts             # NPC definitions and dialogue trees
│   ├── journalEntries.ts   # Discoverable journal/lore entries
│   └── tilesets.ts         # Tileset configuration and mappings
├── types/
│   ├── game.ts             # Core game types (Position, Direction, Entity)
│   ├── books.ts            # Book/fragment types
│   └── store.ts            # Store state types
├── config/
│   └── gameConfig.ts       # Constants: tile size, map dims, movement speed, etc.
└── utils/
    ├── mapUtils.ts         # Helpers for map generation and tile math
    └── gutenberg.ts        # Helpers for formatting Gutenberg text
```
- [x] Create the `EventBridge.ts` singleton using a typed EventEmitter pattern
- [x] Create `gameConfig.ts` with initial constants:
  - TILE_SIZE: 32
  - MAP_WIDTH: 50 (tiles)
  - MAP_HEIGHT: 50 (tiles)
  - PLAYER_MOVE_DURATION: 150 (ms for tween)

### 1.2 — Zustand Store (Convex-Shaped)
- [x] Define the store with this shape (mirrors future Convex tables):
```typescript
interface GameState {
  // Player table
  player: {
    id: string;
    name: string;
    position: { x: number; y: number };
    currentMapId: string;
    flashlightBattery: number; // 0-100, dims but never kills
  };

  // Library table (collected fragments)
  library: BookFragment[];

  // Exploration progress table
  exploration: {
    visitedMaps: string[];
    discoveredNPCs: string[];
    readJournals: string[];
    totalFragmentsFound: number;
  };

  // Current session (not persisted to Convex later)
  session: {
    currentDialogue: DialogueLine[] | null;
    currentJournal: JournalEntry | null;
    isReadingBook: boolean;
    currentBookFragment: BookFragment | null;
    gamePhase: 'exploring' | 'ship' | 'dialogue' | 'reading';
  };

  // Actions (become Convex mutations later)
  actions: {
    movePlayer: (position: Position) => void;
    collectFragment: (fragment: BookFragment) => void;
    markMapVisited: (mapId: string) => void;
    discoverNPC: (npcId: string) => void;
    readJournal: (journalId: string) => void;
    openDialogue: (lines: DialogueLine[]) => void;
    closeDialogue: () => void;
    beamToShip: () => void;
    beamToSurface: (mapId: string) => void;
    saveToLocalStorage: () => void;
    loadFromLocalStorage: () => void;
  };
}
```
- [x] Implement localStorage persistence middleware in Zustand
- [x] Add a comment block at top of store showing the planned Convex schema equivalent

### 1.3 — Basic Tilemap Rendering
- [x] Source a free 32x32 post-apocalyptic/ruins tileset from itch.io (procedural placeholder used)
      (Suggestion: search for "post apocalyptic tileset 32x32" or "ruins tileset 32x32")
      Need at minimum: ground tiles, wall/rubble tiles, grass/overgrowth tiles,
      floor tiles (interior), decoration objects
- [x] Create BootScene.ts that preloads:
  - Tileset spritesheet
  - Player spritesheet (simple 4-direction character, 32x32)
  - Item sprites (book pickup glow, transporter pad)
  - NPC spritesheets
- [x] Create a static test tilemap (hardcoded 2D array) in ExploreScene.ts
  - Ground layer (floor, grass, dirt)
  - Wall/collision layer (rubble, walls, impassable terrain)
  - Decoration layer (non-blocking visual detail)
- [x] Render the tilemap in Phaser with proper layer ordering
- [x] Set up camera to follow player with smooth lerp
- [x] Configure world bounds to match map dimensions

### 1.4 — Player Entity & Grid Movement
- [x] Create Player.ts entity:
  - Sprite with 4-directional idle frames (or single frame to start)
  - Grid position (tile coordinates) separate from pixel position
  - Facing direction
- [x] Create GridMovement.ts system:
  - Listen for arrow keys and WASD
  - On input: calculate target tile → check collision → tween sprite to new position
  - Movement is discrete: one tile per input, with a short tween animation (150ms)
  - Block input during tween (prevent diagonal cheating)
  - Emit 'player-moved' event with new position
  - **Interface-based**: implement a `MovementController` interface so this can be
    swapped for `FreeMovementController` later without changing Player.ts
- [x] Add collision detection against wall layer tiles
- [x] Walking animation if spritesheet supports it (otherwise just face direction)

### 1.5 — Interaction System
- [x] Create Interaction.ts system:
  - Track interactive objects near the player (within 1 tile, in facing direction)
  - When player faces an interactive object, show a subtle prompt
  - On pressing E or Space, trigger the interaction
  - Interactive objects register themselves with the system
  - Each interactive has a type: 'book', 'npc', 'journal', 'transporter'
- [x] Emit 'interaction-available' and 'interaction-triggered' events via EventBridge

### 1.6 — React UI Shell
- [x] Create GameContainer.tsx:
  - Mounts the Phaser game canvas
  - Renders UI overlays on top of / beside the canvas
  - Subscribes to EventBridge for showing/hiding overlays
- [x] Create HUD.tsx:
  - Shows current area name
  - Shows fragment count (e.g., "📚 3/47 fragments recovered")
  - Positioned as a non-intrusive bar at top of screen
  - Semantic HTML: `<header role="banner">` with proper heading
- [x] Create AccessibleLog.tsx:
  - An `aria-live="polite"` region that receives text descriptions of game events
  - "You entered the Ruined Library of Congress"
  - "You found a book fragment nearby"
  - "You picked up Canto I of Dante's Inferno"
  - Visually hidden (CSS) but available to screen readers
  - This is the accessibility groundwork — every important game event gets a text log entry
- [x] Create DialogueBox.tsx (basic version):
  - Renders dialogue text in a styled box at bottom of screen
  - Advance with Space/Enter, close when dialogue ends
  - Semantic HTML with `role="dialog"` and `aria-modal="true"`

### 1.7 — Phase 1 Milestone ✅
**✅ Done when**: You can move a character on a tile-based map, bump into walls,
face an object and see an interaction prompt, and see a basic HUD overlay.
The accessible event log quietly captures movement and interaction events.

---

## Phase 2: Core Game Loop (Proof of Concept)

### 2.1 — Procedural Map Generation
- [x] Create MapGenerator.ts using rot.js:
  - Use `ROT.Map.Digger` for interior ruins (hallways, rooms)
  - (ROT.Map.Cellular for overgrown outdoor — deferred; Digger + decoration suffices)
  - Generate a 50x50 tile map as a 2D number array
  - Transform the rot.js output into Phaser tilemap-compatible data:
    - 0 (open) → random floor/ground tile indices
    - 1 (wall) → random wall/rubble tile indices
    - Apply variety: multiple tile indices per type for visual interest
  - Create the tilemap dynamically in Phaser using `this.make.tilemap({ data, tileWidth: 32, tileHeight: 32 })`
- [x] Add a decoration pass:
  - Scatter vegetation (vines) on floor tiles (low probability)
  - Add rubble/debris on tiles adjacent to walls (medium probability)
  - (Light sources deferred — tileset has no dedicated tile)
- [x] Implement room identification:
  - rot.js Digger provides room data (rectangles with coordinates)
  - Tag rooms with purposes: "library wing", "reading room", "archives", "courtyard", etc.
  - Room names feed into the HUD and accessible log via area-entered

### 2.2 — Field of View & Fog of War
- [x] Implement FOVSystem.ts using `ROT.FOV.PreciseShadowcasting`:
  - Calculate visible tiles from player position with radius 8
  - Three tile states: unexplored (black), explored-but-not-visible (dim), visible (full brightness)
  - Update FOV on every player move
  - Apply as alpha/tint on the Phaser tilemap layers
- [x] Store explored tiles in the game state so they persist within a session
- [x] When a new room is revealed, emit 'area-entered' event with the room name

### 2.3 — Book Fragment Placement & Collection
- [x] Define the book data model in `src/data/books.ts`:
```typescript
interface Book {
  id: string;
  title: string;           // "The Divine Comedy"
  author: string;          // "Dante Alighieri"
  totalFragments: number;  // 34 (for Inferno's 34 cantos)
  fragments: Fragment[];
}

interface Fragment {
  id: string;
  bookId: string;
  label: string;           // "Canto I"
  order: number;           // 1
  text: string;            // Full text from Project Gutenberg
  discovered: boolean;
}
```
- [x] Create an initial book catalog with 3-5 books, each with a few fragments loaded:
  - Dante's Inferno (select 3-4 cantos)
  - Shakespeare's The Tempest (5 acts)
  - One of Chaucer's Canterbury Tales (e.g., The Knight's Tale)
  - Edmund Spenser's Faerie Queene (2-3 cantos from Book I)
  - A shorter work: perhaps some of Emily Dickinson's poems as individual fragments
  - King James Bible (5-8 iconic chapters, e.g. Genesis 1, Psalm 23, Matthew 5-7, 1 Corinthians 13, Revelation 21 — KJV for thematic "preserving old texts" flavor; Gutenberg has it). (Strategies for adding the full Bible deferred to a later phase.)
  (Pull actual text from Project Gutenberg — these are all public domain)
- [x] Create BookPickup.ts entity:
  - A glowing sprite placed on the map in rot.js-generated rooms
  - Registers with the Interaction system as type 'book'
  - When interacted with: emit 'book-found' event, show book detail, add to store
  - Visual feedback: particle effect or glow animation on pickup (deferred; book-pickup sprite used)
- [x] Place 2-4 book fragments per generated map, always inside rooms
- [x] Placement algorithm:
  - Pick random rooms from the rot.js room list
  - Place fragment at a random open tile within the room
  - Ensure no two fragments in the same room
  - Ensure at least one fragment is in a room far from spawn

### 2.4 — NPCs & Journal Entries
- [x] Create 2-3 NPC definitions in `src/data/npcs.ts`:
  - Each NPC has a name, appearance (sprite index), and dialogue tree
  - Example NPCs:
    - **Martha** — A former librarian, sheltering in the ruins. Gives lore about what happened.
    - **Eli** — A scavenger who hints at where rare books might be found.
  - Dialogue is an array of lines, shown one at a time in DialogueBox
- [x] Create NPC entity (placed in ExploreScene, no separate file):
  - Static sprite placed in a room
  - Registers with Interaction system as type 'npc'
  - Shows dialogue via the React DialogueBox on interaction
  - Tracks whether this NPC has been spoken to (for first-meet vs return dialogue)
- [x] Create 3-4 journal entries in `src/data/journalEntries.ts`:
  - Found on the ground like books, but shorter flavor text
  - Example: a water-damaged diary page from before the cataclysm
  - Provides worldbuilding and hints
  - Registers as type 'journal' with Interaction system
  - Shown in a simpler overlay (or reuse DialogueBox)

### 2.5 — Low-Stakes Exploration Mechanics
- [x] **Flashlight battery**:
  - Starts at 100, decreases by 1 per 5 moves
  - As battery decreases, FOV radius shrinks (8 → 7 → 6 → 4 → 3)
  - At 0, FOV radius is 3 (dim but never blind)
  - Batteries can be found as pickups on the map (restore 50), same visual treatment as books
  - HUD shows battery level
  - Creates gentle tension without punishment
- [x] **Environmental obstacles**:
  - Some corridors have "rubble" tiles that are impassable — player must find alternate route
  - Some floors have "flooded" tiles that are passable but slow (movement tween = 300ms)
  - Rubble: dark gray tile; flooded: blue-gray overlay; both visually distinct
- [x] **Discovery score**:
  - Track percentage of map explored (FOV/flashlight touching tiles, not step-based)
  - Show in HUD as "🗺 X% explored"
  - Denominator = reachable tiles from spawn; numerator = tiles ever in FOV

### 2.6 — Transporter / Beam Mechanic
- [x] Place a "transporter pad" entity at the map spawn point:
  - Distinctive sprite (glowing pad, Starfleet-inspired)
  - Always visible on the minimap (future) and rememberable
  - Registers as type 'transporter' with Interaction system
- [x] On interaction with the transporter pad:
  - If player has found at least one new fragment: prompt "Beam up to Alexandria?"
  - On confirm: transition to ShipScene
  - Play a brief beam-up animation (screen fade or particle effect)
  - If no new fragments: "You haven't found any new texts. Keep searching?"
  - **If uncollected fragments remain on the map:** Soft narrative nudge instead of blocking — e.g. "The archives still hold a few. Sure you're ready to go?" [Yes] / [No]. Player can leave anytime; no mechanical penalty.
- [x] **After implementing:** Add transporter-dialogue variants (including the "fragments left behind" prompt) to EDITING.md

### 2.7 — Ship Scene & Library Shelf
- [x] Create ShipScene.ts:
  - A non-procedural, small, cozy interior: the Alexandria's library deck
  - Can be a static tilemap or even a simple illustrated background
  - A large bookshelf visualization is the centerpiece
- [x] Create LibraryShelf.tsx (React overlay on ShipScene):
  - Visual grid/shelf of collected book fragments
  - Organized by book title, showing which fragments you have
  - Example: "The Divine Comedy — Inferno: Canto I ✓, Canto II ✓, Canto III ✗, ..."
  - Clicking/selecting a collected fragment opens BookDetail.tsx
  - Semantic HTML: use a list structure with proper labels
  - Empty shelf slots show as grayed-out placeholders (motivation to collect more)
- [x] Create BookDetail.tsx:
  - Renders the actual text of a collected fragment
  - Styled as a readable document (good typography, comfortable line length)
  - Scrollable with keyboard
  - Close button returns to shelf view
  - This is where the Project Gutenberg text actually gets read
  - `role="article"` with proper heading for the fragment title
- [x] **New Mission** button on the ship:
  - "Beam down to Earth" — generates a fresh procedural map and starts ExploreScene
  - Each run is a new expedition with new fragment placements
  - The roguelike loop: beam down → explore → collect → beam up → admire library → repeat

### 2.8 — Game Flow Integration
- [x] Wire up the complete loop:
  1. Game starts → ShipScene (brief intro: "Welcome aboard the Alexandria")
  2. Player interacts with transporter → ExploreScene (procedural map generated)
  3. Player explores, finds fragments, talks to NPCs, reads journals
  4. Player returns to transporter pad → beams up → ShipScene
  5. Library shelf updates with new fragments
  6. Player can read collected fragments or beam down again
- [x] Auto-save to localStorage after each beam-up
- [x] Load from localStorage on game start (if save exists)
- [x] "New Game" option that clears localStorage

### 2.9 — Polish & Feel
- [ ] Screen transitions between scenes (fade to black, brief "beaming" animation)
- [ ] Subtle ambient background (even a solid color with vignette helps)
- [ ] Sound effects if time permits (footsteps, pickup chime, beam sound)
  - Phaser's audio system handles this; just need free SFX assets
  - Can be skipped for PoC and added immediately after
- [ ] Gentle camera shake or flash when picking up a book fragment
- [ ] Typewriter effect for dialogue text in DialogueBox
- [ ] **Map overlay polish**:
  - Smoother reveal animation when opening/closing the map (scale + fade)
  - Visual distinction between room types (different subtle tints or icons for "archives", "reading room", etc.)
  - Player position indicator with a gentle pulse or glow
  - Legend showing what the colors/symbols mean
  - "You are here" label or room name tooltip on hover/focus
  - Explored vs unexplored areas should feel more distinct (not just alpha — perhaps a subtle pattern or desaturation)
  - Consider a parchment/paper aesthetic to fit the literary theme

### 2.10 — Phase 2 Milestone
**✅ Done when**: The complete loop works — beam down, explore a procedurally generated
ruin with fog of war, find a fragment of Dante's Inferno, talk to an NPC, beam back
to the ship, see the fragment on your library shelf, tap it and read the actual text
of Canto I. Then beam down again to a fresh map and keep collecting.

---

## Data: Project Gutenberg Sources

These are all public domain and freely available:

| Book | Gutenberg URL | Fragment Unit |
|------|--------------|---------------|
| Dante — Inferno | gutenberg.org/ebooks/8800 | Canto (34 total) |
| Shakespeare — The Tempest | gutenberg.org/ebooks/23042 | Act (5 total) |
| Chaucer — Canterbury Tales | gutenberg.org/ebooks/2383 | Individual Tale |
| Spenser — Faerie Queene | gutenberg.org/ebooks/590 | Canto per Book |
| Dickinson — Poems | gutenberg.org/ebooks/12242 | Individual Poem |

For the PoC, hardcode 10-15 fragments total across 3+ books. Full Gutenberg integration
(fetching dynamically) can come in a future phase.

---

## Future Phases (Not Yet Planned in Detail)

- **Phase 3**: Clerk for user sign-in (better UX for casual players), Convex backend integration, persistent cloud saves, richer NPC dialogue trees
- **Phase 4**: Multiple biome types (university, library, forest, coastal ruins), themed tilesets. **After implementing:** Add instructions to EDITING.md for adding and editing biomes.
- **Phase 5**: Accessibility deep-dive — full screen reader support, audio descriptions, high contrast mode
- **Phase 6**: Multiplayer shared world via Convex real-time sync
- **Phase 7**: Mobile deployment via Capacitor.js
- **Phase 8**: Custom art, music, and audio design

---

## Suggested Free Assets to Start

### Tilesets (itch.io)
Search for these on itch.io — all have free versions:
- "Post-apocalyptic tileset 32x32" — for ruins and rubble
- "Nature/forest tileset 32x32" — for overgrown areas
- "Interior tileset 32x32" — for library/building interiors
- Popular creators: Cup Nooble, Szadi Art, Cainos

### Character Sprites
- Search "top down character 32x32" on itch.io
- Need: 4-direction walking animation (4 frames per direction minimum)

### UI
- Keep it simple: styled HTML/CSS via React components
- No need for fancy UI sprite sheets — semantic HTML looks good with decent CSS

---

## Notes for Cursor AI

When working on this project:

1. **Always check the store types** before creating new state. The Zustand store is the
   source of truth and its shape is intentional (Convex-ready).

2. **Use the EventBridge** for all Phaser → React communication. Never import React
   components into Phaser code or vice versa.

3. **rot.js generates data, Phaser renders it**. The MapGenerator should return plain
   data (2D arrays, room lists, entity positions). Phaser scenes consume this data.
   Keep generation logic framework-agnostic.

4. **Every user-facing string should also go to AccessibleLog**. If something appears
   on the canvas (area name, pickup notification), emit it to the accessible log too.

5. **Fragments are the core reward**. Every design decision should make finding and
   reading book fragments feel satisfying and meaningful.

6. **Test in browser with keyboard only**. All interactions must work without a mouse.
   Arrow keys / WASD for movement, Space/Enter/E for interaction, Escape to close overlays.
