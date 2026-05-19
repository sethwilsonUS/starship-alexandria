# Starship Alexandria / Build-in-Public Stream Ideas

Captured from Seth + SethBot brainstorming so we can come back to the good weird stuff later.

## Stream Persona / Content North Star

Seth does **not** want the stream to become overtly religious content, even though faith-adjacent projects can be meaningful. The stream should lean into Seth’s off-the-wall personality while still making the technical strengths obvious:

- thoughtful stack choice
- accessibility-first development
- education / nonprofit / public-good instincts
- AI-assisted development done with taste, not slop
- weird, literate, funny concepts that are actually buildable
- useful demos with enough chaos to be fun on Twitch

The target vibe is something like:

> “A legally blind dev uses AI thoughtfully to build accessible, literary, public-good software — but with goblins, cursed libraries, rogue UX gremlins, and occasional eldritch spreadsheet energy.”

## Existing Anchor Project: Starship Alexandria

Project path: `~/dev/starship-alexandria`

Current concept:

- Cozy roguelike about recovering lost literature from post-apocalyptic Earth
- Player beams down from the Starship Alexandria to explore ruins
- Collects fragments of public-domain literature
- No combat, no death — discovery and preservation instead
- Accessibility-first: keyboard nav, ARIA live regions, TTS, high contrast, readable UI
- Stack includes TypeScript, Next.js, Phaser, rot.js, Zustand, YAML content files

This is already a strong flagship stream project because it combines:

- game dev
- literature
- accessibility
- procedural generation
- public-domain education
- AI-friendly content tooling
- Seth’s personality

## Good Stream Positioning

Avoid “generic coding stream.” Aim for recurring framings like:

- **Building weird educational software in public**
- **AI-assisted dev without losing the plot**
- **Accessibility-first game dev**
- **Public-domain chaos engineering**
- **Making software for people, not just demos**
- **Cozy apocalypse library ship energy**

## One-Shot / Single-Stream Ideas

These should be completable or at least demoable in one stream.

### 1. The Accessibility Goblin Detector

Build a small dev/debug overlay for Starship Alexandria that warns when common accessibility problems appear:

- missing aria-labels
- low contrast colors
- focus traps
- keyboard unreachable controls
- unreadable event spam
- TTS queue overload

Stream hook: “Tonight we hunt accessibility goblins.”

Why it works:

- shows real accessibility expertise
- fits the game
- useful beyond the bit
- creates visible before/after improvements

### 2. Literary Loot Generator

Build a small tool that turns a public-domain text fragment into a game pickup:

- title
- author
- excerpt
- rarity / category
- room hint
- flavor text
- YAML output

Could include AI-assisted extraction, then human review.

Stream hook: “Turning Project Gutenberg into roguelike loot.”

Why it works:

- showcases AI workflow judgment
- educational but not lecture-y
- directly improves Starship Alexandria

### 3. Cursed Library Room Name Generator

Make procedural room names for ruins:

- “The Moldering Periodicals Annex”
- “The Dewey Decimal Catacombs”
- “The Children’s Section of Mild Peril”
- “The Reference Desk That Knows Too Much”

Implement as content YAML + validation.

Why it works:

- funny and highly streamable
- small scope
- easy chat participation
- improves game flavor fast

### 4. Screen Reader Expedition Mode

Add or improve an audio/log-first mode for exploration:

- announce room transitions
- announce nearby interactables
- summarize visible surroundings
- keep repeated movement messages concise
- support adjustable verbosity

Stream hook: “Can this roguelike be playable if you can’t see the map?”

Why it works:

- deeply aligned with Seth
- technically interesting
- meaningful accessibility content

### 5. The NPC Weirdness Pass

Add one new survivor NPC with a distinctive voice, dialogue tree, and accessible interaction.

Possible NPCs:

- a librarian who treats overdue books like war crimes
- a grad student who survived the apocalypse but not peer review
- a janitor-philosopher guarding the archive basement
- a book club that became a monastic order by accident

Why it works:

- funny writing + coding
- approachable for viewers
- expands the world

### 6. The Vault Puzzle of Unnecessary Drama

Build a small vault puzzle around literature fragments:

- clue from a recovered excerpt
- accessible hint system
- keyboard-only flow
- no fail state

Why it works:

- demonstrates game design restraint
- education/nonprofit vibe without feeling preachy
- very on-theme

### 7. Public Domain Artifact Cards

Create collectible artifact cards for recovered works:

- cover-ish visual treatment
- author bio snippet
- historical context
- “why this survived” flavor text
- accessibility-friendly reading layout

Why it works:

- visually satisfying
- educational
- can be scoped to one author/work

### 8. AI Pair-Programming Safety Rails

Build a small script/checklist that validates AI-generated content before it enters the game:

- YAML schema validation
- length limits
- forbidden placeholders
- duplicate IDs
- public-domain/source attribution checks
- accessibility text requirements

Stream hook: “Making the robot clean up after itself.”

Why it works:

- shows serious AI dev skill
- useful for real project maintenance
- teaches good process

### 9. Chat Picks the Next Ruin

Create a small configurable “expedition seed” system:

- ruin type
- mood
- literary theme
- difficulty/coziness
- NPC density

Viewers can vote or suggest values, then Seth codes the generated expedition config.

Why it works:

- interactive stream content
- keeps chat involved
- not too technically huge

### 10. The Readability Refactor

Take one dense UI panel and make it radically easier to read:

- larger type
- better contrast
- keyboard shortcuts
- less visual clutter
- screen reader labels
- responsive layout

Why it works:

- demonstrates accessibility-first frontend skill
- good “before and after” payoff

## Multi-Stream / Ambitious Projects

### 1. Starship Alexandria: Season One Roadmap

Turn the game into the flagship recurring project.

Possible arc:

1. content pipeline polish
2. improved expedition generation
3. better accessible exploration mode
4. richer NPC interactions
5. ship library UI upgrade
6. puzzle/vault system
7. save/progression system
8. public demo build
9. feedback/accessibility testing
10. release polish

Why it works:

- coherent long-running narrative
- builds a portfolio-worthy project
- aligns perfectly with Seth’s skills and personality

### 2. The Public Domain Rescue Engine

A reusable pipeline/toolkit for turning public-domain texts into interactive educational content.

Could power Starship Alexandria and future projects.

Features:

- import Project Gutenberg texts
- clean/segment excerpts
- metadata extraction
- reading-level/context notes
- YAML/JSON export
- attribution checks
- optional AI-assisted summaries
- human review workflow

Why it works:

- public-good / nonprofit energy
- serious technical architecture
- reusable beyond one game

### 3. Accessible Roguelike Toolkit

Extract reusable accessibility systems from Starship Alexandria:

- ARIA event bridge
- keyboard navigation helpers
- screen-reader-friendly spatial descriptions
- TTS queue manager
- high-contrast theme support
- input remapping
- reduced-motion / reduced-flash settings

Why it works:

- strong developer credibility
- niche but valuable
- could become open source

### 4. The Weird Little Digital Library

Build a standalone accessible web app for browsing recovered literature outside the game.

Features:

- bookshelf UI
- plain-language context
- original text excerpts
- annotations
- TTS/read-aloud
- dyslexia-friendly/low-vision modes
- “rabbit hole” recommendations

Why it works:

- education/nonprofit mission
- accessible frontend showcase
- natural companion to Starship Alexandria

### 5. Twitch-Integrated Expedition Control

Carefully add Twitch/chat interactivity without making the game chaotic or inaccessible.

Possible features:

- chat votes on next expedition theme
- chat names a room/NPC/artifact
- channel point redemption triggers lore flavor, not gameplay punishment
- accessibility-safe event moderation
- “librarian mode” to approve suggestions before import

Why it works:

- very stream-native
- lets chat participate
- still preserves design quality

### 6. AI Dungeon Master, But For Libraries

Build an AI-assisted content authoring assistant for Starship Alexandria.

Important: not “let AI generate random slop live.” The stream angle is thoughtful constraints:

- strict schema
- tone guide
- public-domain source requirements
- accessibility requirements
- human approval
- validation before merge

Why it works:

- demonstrates sophisticated AI dev
- avoids lazy AI content
- makes the workflow teachable

### 7. Nonprofit Microsite Generator

Separate from Starship Alexandria: build a tool that helps small nonprofits quickly create accessible, plain-language microsites.

Features:

- donation CTA blocks
- event pages
- volunteer signup
- accessibility checks
- readable templates
- AI-assisted copy suggestions with guardrails

Why it works:

- shows real-world impact
- aligns with education/nonprofit focus
- can be broken into many stream-sized chunks

### 8. Accessibility-First Starter Kit

Build a starter template for accessible AI-assisted apps:

- Next.js or Expo
- good defaults
- accessible components
- testing/linting
- keyboard/focus patterns
- docs written for real humans

Why it works:

- developer credibility
- useful artifact
- lots of natural teaching moments

### 9. The Museum of Bad UX

A funny educational project where each exhibit is an intentionally awful UI pattern, then Seth fixes it accessibly.

Exhibits:

- modal labyrinth
- contrast dungeon
- unlabeled icon crypt
- carousel of despair
- infinite scroll oubliette
- CAPTCHA hydra

Why it works:

- maximum personality
- teaches accessibility/design
- one exhibit per stream works beautifully

### 10. The Goblin-Powered Issue Triage Bot

Build a bot/tool that turns messy GitHub issues into prioritized, accessible work plans.

Features:

- labels by impact/effort
- accessibility impact detection
- nonprofit/user-impact scoring
- AI summaries
- suggested acceptance criteria

Why it works:

- highlights AI-assisted developer workflow
- practical for open-source/nonprofit work
- funny theming possible without hurting usefulness

## Recurring Stream Segments

### “Goblin Check”

Quick accessibility or quality audit at the start/end of stream.

### “Ship’s Log”

Summarize what changed in Starship Alexandria and what decisions were made.

### “AI, Explain Yourself”

Ask the AI for an implementation plan, then critique it live before coding.

### “The Council of Elrond, But It’s Stack Choices”

Compare 2–3 implementation options and explain tradeoffs.

### “Chat Names This Horrible Thing”

Let chat name an NPC, room, artifact, bug, or internal tool.

### “Accessibility Goblin of the Week”

Pick one subtle accessibility issue and fix it.

### “Slop or Not?”

Evaluate an AI-generated proposal/code/content sample and decide what survives.

## Strong Recommendation

The best flagship path is:

1. Keep **Starship Alexandria** as the main recurring project.
2. Use one-shots as self-contained improvements to it.
3. Occasionally branch into accessibility/nonprofit tooling when you want variety.
4. Keep the religious content optional/background unless a specific stream calls for it.
5. Brand the stream around weird, thoughtful, accessibility-first AI development — not generic tutorials.

Starship Alexandria is the strongest “this is unmistakably Seth” project: literary, weird, humane, technically interesting, accessible, and funny without needing to force a bit.

## Added Direction: Accessible Crossword Tooling

Seth is also interested in building accessible tooling around crosswords. This may be a strong stream direction alongside Starship Alexandria and the Public Domain Chaos Machine.

### Why Crosswords Fit

Crosswords are a very Seth-shaped space:

- intellectually playful
- puzzle/word/language adjacent
- stream-friendly because Seth already solves crosswords
- accessibility problems are real and interesting
- useful to indie crossword creators/solvers
- technically approachable through standardized formats like `.puz`
- potentially visible to the broader crossword community if the tools are genuinely good

Important constraint:

- Big publishers like NYT may not expose `.puz` files or open APIs, so avoid building around locked-down commercial sources.
- Focus on indie crossword files, public/example `.puz` puzzles, creator workflows, and accessibility tooling that could be adopted or copied elsewhere.

### Crossword One-Shot Ideas

#### 1. `.puz` Inspector

Build a small web tool that loads a `.puz` file and displays:

- puzzle title/author/copyright
- grid dimensions
- clue counts
- theme entries if detectable
- rebus/special cell warnings
- accessibility metadata gaps

Stream hook: “Tonight we interrogate a crossword file like it owes us money.”

#### 2. Accessible Crossword Reader Prototype

Prototype a keyboard/screen-reader-friendly crossword solving interface:

- announce current cell
- announce across/down clue
- announce filled/blank state
- let user jump between clues
- avoid noisy repeated announcements
- support high contrast and large text

Stream hook: “Can a crossword UI stop being hostile to screen readers?”

#### 3. Crossword Alt-Text / Description Generator

Generate a human-readable puzzle description:

- grid size
- symmetry
- blocked square density
- theme hints
- notable long entries
- accessible summary for non-visual users

Could combine deterministic parsing with AI-assisted plain-language summaries.

#### 4. Clue Difficulty / Vibe Analyzer

Analyze clues for approximate difficulty and style:

- trivia-heavy
- wordplay-heavy
- pop-culture-heavy
- cryptic-ish
- crosswordese density
- accessibility/readability concerns

This is good for creator tooling and live chat debate.

#### 5. Indie Constructor Accessibility Checklist

A small generator/checker that helps indie crossword creators publish more accessible puzzles:

- provide `.puz` plus accessible web version
- ensure clue list is navigable
- avoid visual-only gimmicks without text alternatives
- describe themes and special mechanics
- include keyboard instructions

### Crossword Multi-Stream Ideas

#### 1. Accessible Indie Crossword Player

A polished web crossword player designed around accessibility from day one.

Potential features:

- `.puz` import
- keyboard-first solving
- screen reader mode
- clue list navigation
- large-print/high-contrast themes
- progress saving
- optional TTS clue reading
- shareable local-only puzzle sessions

#### 2. Crossword Creator Accessibility Toolkit

A set of tools for constructors/publishers:

- `.puz` validation
- accessibility checklist
- embeddable accessible player
- export to accessible HTML
- puzzle metadata editor
- special-cell description support

#### 3. Crossword Stream Companion

A Twitch-friendly overlay/tool for crossword streams:

- displays current clue clearly
- shows progress without spoiling answers
- lets chat suggest guesses in a moderated queue
- supports “hint requested” state
- has large readable text for viewers

Need to be careful with copyrighted puzzles and publisher rules. Best for indie/open puzzles or Seth-created puzzles.

## Added Direction: Public Domain Chaos Machine

Seth likes the “Public Domain Chaos Machine” idea. This could be its own umbrella brand for tools that ingest public-domain texts and turn them into weird educational artifacts:

- Starship Alexandria content
- literary loot
- quote cards
- classroom handouts
- mini games
- puzzle prompts
- weird NPC dialogue seeds
- accessible reading experiences

This should feel playful and chaotic, not dry. Think Project Gutenberg meets gremlin laboratory.

## Vibe-Coding Downtime Ideas

When AI agents are working, the stream needs intentional “downtime texture” so viewers are not just watching terminals wait.

### Good Downtime Activities

#### 1. Tiny Chat Games

Short, casual, low-stakes games that can fit into 2–8 minute agent waits:

- Name this goblin/bug/NPC/tool
- Guess what the agent will break
- Two truths and a cursed dependency
- Public-domain quote: profound or nonsense?
- Is this error message real or AI hallucinated?
- Accessibility goblin spotting: viewers inspect a screenshot/UI
- “Stack Choice Council”: chat votes between two reasonable approaches

#### 2. Mini Crossword Breaks

Seth can solve a small crossword during longer waits, but avoid making it the default during every agent run because context switching could get janky.

Best use:

- only during longer background tasks
- use a puzzle Seth is allowed to stream
- keep it casual, not performance-pressure
- maybe use it as a recurring “loading screen” segment

#### 3. Agent Review Ritual

When the agent returns, do a structured review:

1. What did it claim to do?
2. What files changed?
3. What is suspicious?
4. What test proves it?
5. What should we keep, revert, or refactor?

This turns waiting into educational AI workflow content.

#### 4. Ship’s Log / Builder’s Log

During downtime, maintain a visible short log:

- current goal
- what the agent is doing
- what Seth is deciding
- next risk
- next test

This helps viewers join midstream and reinforces thoughtful dev practice.

#### 5. “Slop Court”

Put AI output on trial:

- Prosecutor: what is sloppy/dangerous?
- Defense: what is useful?
- Verdict: merge, revise, or throw into Mount Doom?

Very on-brand and genuinely educational.

### Downtime Recommendation

Do **not** rely on one fallback activity. Rotate between:

- quick chat prompts for short waits
- builder’s log / explanation for medium waits
- mini crossword or puzzle break for long waits
- structured AI review when work returns

The stream should make waiting feel like part of the craft: good AI-assisted development includes planning, supervising, reviewing, testing, and saying “absolutely not, robot” when needed.

## Elaborated Crossword MVPs

These are the four strongest crossword-tooling ideas from the brainstorm, with practical MVP scopes.

### 1. Accessible `.puz` Player

A web-based crossword player built from the start for keyboard, screen reader, low-vision, and stream-friendly use.

#### MVP Goal

Load a `.puz` file and let someone solve it comfortably with keyboard and screen reader support.

#### MVP Features

- Import/load one `.puz` file locally in the browser
- Render crossword grid with large readable cells
- Across/down clue lists
- Keyboard navigation:
  - arrow keys move cells
  - Tab/Shift+Tab moves between clues or UI regions
  - Enter/Space toggles across/down direction
  - typing fills a letter
  - Backspace clears and moves predictably
- Screen-reader sane announcements:
  - current cell coordinates
  - current direction
  - current clue
  - current entry progress, e.g. “3 letters filled of 7”
  - avoid re-reading the whole puzzle constantly
- Large print / high contrast theme
- Basic check/reveal controls, if puzzle data supports solution
- Local-only state persistence for current puzzle

#### Nice but Not MVP

- Rebus support
- Circled/shaded/special cells
- Timer
- Account sync
- Mobile polish
- Multiple puzzle library
- Advanced stats

#### Streamable First Build

1. Parse/load `.puz`
2. Display grid + clues
3. Add keyboard movement/fill
4. Add live region announcements
5. Test with VoiceOver/screen reader
6. Do an accessibility goblin pass live

#### Why It Has Legs

This could become a genuinely useful open-source tool for indie puzzle solvers and constructors. Most crossword players are visually usable first and accessibility is bolted on later, if at all.

### 2. `.puz` Inspector

A diagnostic tool for understanding what is inside a crossword file and whether it is likely to be accessible.

#### MVP Goal

Drop in a `.puz` file and get a readable report about puzzle structure, metadata, and accessibility concerns.

#### MVP Features

- Local `.puz` upload
- Parse and display:
  - title
  - author
  - copyright
  - dimensions
  - number of clues
  - number of black squares
  - percentage of blocks
  - longest entries
  - clue/answer length mismatches, if detectable
- Grid stats:
  - symmetry check
  - unchecked/singly checked cells if detectable
  - isolated regions/connectivity check
- Metadata warnings:
  - missing title
  - missing author
  - missing copyright/source
  - unsupported extensions present
- Accessibility warnings:
  - rebus/special cells need textual explanation
  - circled/shaded cells need description
  - visual theme/gimmick may need alt text
  - no notes field or notes field too vague
- Export report as Markdown or HTML

#### Nice but Not MVP

- Theme inference
- AI-assisted clue style analysis
- Batch processing many puzzles
- Constructor-specific recommendations
- CI integration for indie puzzle sites

#### Streamable First Build

1. Parse `.puz` header + grid + clues
2. Render metadata and grid stats
3. Add warning rules
4. Export Markdown report
5. Try it on a couple of sample/indie puzzles

#### Why It Has Legs

This is the smallest and most buildable entry point. It becomes the foundation for both the player and constructor accessibility toolkit.

### 3. Indie Constructor Accessibility Checklist / Exporter

A tool that helps crossword makers publish puzzles in accessible formats, not just as a visual grid or locked-down embed.

#### MVP Goal

Given puzzle metadata and/or a `.puz` file, generate a practical accessibility checklist and an accessible HTML export.

#### MVP Features

- Import `.puz`
- Show creator-focused checklist:
  - Is title present?
  - Is author/byline present?
  - Are notes/instructions included?
  - Are special cells explained textually?
  - Is there an accessible solving option?
  - Is the clue list keyboard navigable?
  - Is there a non-visual way to understand theme mechanics?
- Generate accessible static HTML:
  - title/author/notes
  - clue lists grouped by Across/Down
  - optional grid table with semantic labels
  - printable large-type view
  - high-contrast CSS
  - basic keyboard-friendly navigation if interactive mode is included
- Allow constructor to add/edit accessibility notes before export
- Export a zip or copyable HTML file

#### Nice but Not MVP

- Full interactive solving engine
- WordPress/Static site plugins
- Publisher integration
- Automated hosting
- Advanced theme detection

#### Streamable First Build

1. Start from `.puz` inspector parser
2. Add checklist generator
3. Add editable notes field
4. Export static accessible HTML clue sheet
5. Add basic high-contrast/large-print styling

#### Why It Has Legs

This helps creators without forcing them to adopt an entire platform. It is a “meet indie constructors where they are” tool.

### 4. Crossword Stream Companion

A Twitch-friendly companion for solving crosswords live without spoiling the puzzle and while making the stream more readable for viewers.

#### MVP Goal

Display the current clue, puzzle progress, and moderated chat guesses in a clean overlay while Seth solves.

#### MVP Features

- Load puzzle metadata/clues from `.puz`
- Overlay view with:
  - current clue only
  - direction and clue number
  - answer length pattern, e.g. `_ _ _ / _ _ _ _`
  - non-spoilery progress meter
  - optional “thinking / hint / solved” status
- Manual controls:
  - choose current clue
  - mark solved
  - hide/reveal answer pattern
- Chat guesses queue concept:
  - viewers submit guesses
  - guesses appear in moderator/Seth view first
  - Seth can approve/show selected guesses
  - avoid answer spoilers blasting directly onto stream
- Big readable text and high contrast
- Browser source friendly overlay URL/window

#### Nice but Not MVP

- Direct Twitch API integration
- Channel point redemptions
- Automated clue tracking from the player
- Team solve mode
- Guess scoring
- Multiple overlay themes

#### Streamable First Build

1. Build manual overlay first: current clue + pattern + progress
2. Add local control panel
3. Add fake/sample chat queue manually
4. Later wire to Twitch chat when ready
5. Eventually integrate with accessible `.puz` player so clue changes update automatically

#### Why It Has Legs

It solves an actual streaming problem: viewers need context, but the stream should not become a spoiler firehose. This also pairs naturally with Seth’s crossword streams.

## Suggested Build Order for Crossword Tools

Best practical order:

1. `.puz` Inspector
2. Accessible `.puz` Player prototype
3. Constructor checklist/exporter
4. Stream companion

Reason:

- The inspector gives the parser and understanding needed for everything else.
- The player proves the accessibility UX.
- The checklist/exporter packages that accessibility knowledge for creators.
- The stream companion becomes easier once player state and puzzle parsing exist.

A nice public story would be:

> “I started by asking what’s actually inside a crossword file. Then I built a player that doesn’t hate screen readers. Then I turned those lessons into tools indie constructors can use. Then I made it fun to solve on stream.”
