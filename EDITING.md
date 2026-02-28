# Starship Alexandria — Content Editing Guide

Quick reference for editing game content. All narrative content lives in the `public/content/` folder as YAML and text files. No TypeScript knowledge required.

---

## Content Files Overview

| Content | File |
|---------|------|
| NPCs & dialogue | `public/content/npcs.yaml` |
| Journal entries | `public/content/journals.yaml` |
| Books & fragments | `public/content/books.yaml` |
| Book text | `public/content/texts/<book-id>/<fragment>.txt` |
| Room names | `public/content/rooms.yaml` |
| Transporter dialogue | `public/content/dialogue.yaml` |
| Vault artifacts | `public/content/artifacts.yaml` |
| Game loop (welcome, victory, vault) | `public/content/gameloop.yaml` |

---

## 1. NPCs (Dialogue & New Characters)

**File:** `public/content/npcs.yaml`

### Edit Existing Dialogue

Find the NPC by id and edit their dialogue lines:

```yaml
npcs:
  - id: martha
    name: Martha
    firstMeet:
      - speaker: Martha
        text: "Oh! A visitor. I didn't think anyone would find this place."
      - speaker: Martha
        text: "Your second line here."
    return:
      - speaker: Martha
        text: "What she says when you talk to her again."
```

- `firstMeet` plays the first time you talk to an NPC
- `return` plays on subsequent conversations
- `speaker` is optional; omit it for narration

### Add a New NPC

Add a new entry to the `npcs` list:

```yaml
  - id: sarah
    name: Sarah
    firstMeet:
      - speaker: Sarah
        text: "Hello!"
    return:
      - speaker: Sarah
        text: "Good to see you again."
```

No other changes needed. The game picks 1–2 NPCs per map from the catalog.

---

## 2. Journal Entries

**File:** `public/content/journals.yaml`

### Edit Existing Journals

```yaml
journals:
  - id: journal-diary-1
    title: Water-damaged diary page
    lines:
      - text: "First paragraph when you read it."
      - text: "Second paragraph. Advance with Space."
```

### Add a New Journal

Add to the `journals` list:

```yaml
  - id: journal-unique-id
    title: Short title (e.g. "Faded note")
    lines:
      - text: "Your lore or flavor text here."
```

1–2 random journals are placed per map.

---

## 3. Books & Fragments

Books have two parts:
1. **Metadata** in `public/content/books.yaml` (title, author, fragment list)
2. **Text** in separate `.txt` files under `public/content/texts/`

### Add a New Book

1. Create a folder for the book: `public/content/texts/mybook/`

2. Add the text file(s): `public/content/texts/mybook/chapter-1.txt`
   ```
   Just paste the text directly. No special formatting needed.
   
   Multiple paragraphs work fine.
   ```

3. Add the book metadata to `public/content/books.yaml`:
   ```yaml
     - id: mybook
       title: My Book Title
       author: Author Name
       totalFragments: 1
       fragments:
         - id: mybook-chapter-1
           label: Chapter 1
           order: 1
           textFile: mybook/chapter-1.txt
   ```

### Add a Fragment to an Existing Book

1. Add the text file: `public/content/texts/inferno/canto-5.txt`

2. Add the fragment to the book's `fragments` list in `books.yaml`:
   ```yaml
         - id: inferno-canto-5
           label: Canto V
           order: 5
           textFile: inferno/canto-5.txt
   ```

3. Update `totalFragments` if you want the HUD to show accurate counts

### Fragment Fields

- `id`: Unique identifier (e.g., `inferno-canto-1`)
- `label`: Display name (e.g., "Canto I")
- `order`: Sort order within the book
- `textFile`: Path relative to `public/content/texts/`

---

## 4. Room Names

**File:** `public/content/rooms.yaml`

Room names are randomly assigned to generated rooms:

```yaml
roomNames:
  - library wing
  - reading room
  - archives
  - courtyard
  - stacks
  - rotunda
```

Add, remove, or rename entries freely. These show in the HUD and in NPC dialogue hints.

---

## 5. Transporter Dialogue

**File:** `public/content/dialogue.yaml`

### Dialogue Variants

The transporter shows different messages based on expedition progress:

```yaml
transporter:
  noFragments:
    text: "You haven't recovered any new texts yet. The ruins may still hold knowledge worth preserving."
    choices:
      - label: Leave anyway
        key: y
        action: beam-up
      - label: Keep searching
        key: n
        action: stay

  fragmentsRemaining:
    text: "The archives still hold {count} {plural}. Ready to beam up to Alexandria?"
    choices:
      - label: Yes
        key: y
        action: beam-up
      - label: No
        key: n
        action: stay

  allCollected:
    text: "You've thoroughly explored this area. Beam up to Alexandria?"
    choices:
      - label: Yes
        key: y
        action: beam-up
      - label: No
        key: n
        action: stay
```

- `{count}` and `{plural}` are replaced with actual values
- `key` is the keyboard shortcut
- `action` must be `beam-up` or `stay`

### Martha's Contextual Hint

```yaml
marthaHint:
  template: "I've spotted fragments in {rooms}. That's where the remaining texts would be."
  fallback: "The archives had the rarest editions. If any room survived intact, it would be there."
```

- `{rooms}` is replaced with the actual room names where books are placed
- `fallback` is used when no rooms have books

---

## 6. Artifacts (Vault Collectibles)

**File:** `public/content/artifacts.yaml`

Artifacts are optional collectibles found inside locked vaults. Each vault contains one random artifact the player hasn't collected yet.

### Edit Existing Artifacts

```yaml
artifacts:
  - id: artifact-locket
    name: Tarnished Locket
    description: >-
      A silver locket, green with age. Inside, two faded photographs: a young
      couple on their wedding day. On the back, an inscription: "Until the
      stars go out."
```

### Add a New Artifact

Add to the `artifacts` list:

```yaml
  - id: artifact-unique-id
    name: Display Name
    description: >-
      A longer description that appears when the player finds the artifact
      in a vault. This should be evocative and tell a small story about who
      owned it and why they left it behind.
```

### Artifact Fields

- `id`: Unique identifier (must start with `artifact-`)
- `name`: Short display name (shown in ship's Curiosities shelf)
- `description`: Full description (shown when vault is opened)

**Note:** Use `>-` for multi-line descriptions to avoid awkward line breaks.

---

## 7. Game Loop Dialogue

**File:** `public/content/gameloop.yaml`

Core game messages: welcome screen, victory, and vault interactions.

### Welcome Message

Shown when a new player first boards the ship:

```yaml
welcome:
  lines:
    - text: "Welcome aboard the Starship Alexandria."
    - text: "Your mission: recover lost literature from the ruins."
```

### Victory Message

Shown when all fragments are collected:

```yaml
victory:
  lines:
    - text: "The final fragment has been recovered."
    - text: "Thank you, Librarian. Your mission is complete."
```

### Vault Dialogue

Four variants depending on vault state:

```yaml
vault:
  alreadyOpened:
    - text: "The vault stands open."

  openWithArtifact:
    - text: "Your fingers find the dial: {code}."
    - text: "Inside, you find: {artifactName}."
    - text: "{artifactDescription}"

  openEmpty:
    - text: "Your fingers find the dial: {code}."
    - text: "The vault is empty."

  locked:
    - text: "A sturdy vault, sealed tight."
    - text: "Someone around here might know the combination..."
```

### Vault Placeholders

- `{code}`: The vault's 4-digit code (e.g., "7-3-9-1")
- `{artifactName}`: Name of the artifact inside
- `{artifactDescription}`: Full artifact description

---

## YAML Tips

- **Strings with special characters** should be quoted: `text: "Hello! How are you?"`
- **Multi-line text** in YAML:
  ```yaml
  text: "First line.
    Second line continues here."
  ```
  Or use `|` for literal blocks:
  ```yaml
  text: |
    First paragraph.
    
    Second paragraph.
  ```
- **IDs must be unique** within their file
- **Indentation matters** — use 2 spaces (not tabs)

---

## Testing Your Changes

1. Save the YAML/text file
2. Run validation to check for errors:
   ```bash
   npm run validate-content
   ```
3. Refresh the game in your browser (hot reload should pick up changes)
4. If changes don't appear, hard refresh (Ctrl/Cmd + Shift + R)

### Content Validation

The validation script checks:
- YAML syntax is correct
- All required fields are present (`id`, `name`, `text`, etc.)
- No duplicate IDs
- All referenced text files exist (for book fragments)

Validation runs automatically when you build (`npm run build`). You can also run it manually anytime with `npm run validate-content`.

---

## File Reference

```
public/content/
├── npcs.yaml           # NPC definitions and dialogue
├── journals.yaml       # Journal entries (lore/worldbuilding)  
├── books.yaml          # Book metadata (title, author, fragments list)
├── rooms.yaml          # Room name vocabulary
├── dialogue.yaml       # Transporter and misc dialogue templates
├── artifacts.yaml      # Vault collectibles (optional treasures)
├── gameloop.yaml       # Welcome, victory, and vault dialogue
└── texts/              # Long-form book text (one file per fragment)
    ├── inferno/
    │   ├── canto-1.txt
    │   └── canto-3.txt
    ├── tempest/
    │   ├── act-1.txt
    │   └── act-4.txt
    ├── canterbury/
    │   └── knights-tale.txt
    ├── faerie-queene/
    │   └── book-1-canto-1.txt
    ├── dickinson/
    │   └── hope.txt
    └── bible-kjv/
        ├── genesis-1.txt
        ├── psalm-23.txt
        ├── matthew-5.txt
        ├── 1corinthians-13.txt
        └── revelation-21.txt
```

---

## Advanced: Game Configuration

For technical configuration (FOV radius, tile size, movement speed), see `src/config/gameConfig.ts`. These values require TypeScript knowledge and affect gameplay mechanics.

---

## Getting Book Text from Project Gutenberg

1. Go to [gutenberg.org](https://www.gutenberg.org/)
2. Find your book
3. Click "Plain Text UTF-8"
4. Copy the section you want
5. Paste into a new `.txt` file under `public/content/texts/`
6. Add the fragment metadata to `books.yaml`

Remember: Only use public domain texts (check the book's license on Gutenberg).
