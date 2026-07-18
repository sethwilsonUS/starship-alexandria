# Content authoring

All runtime narrative content lives under `public/content/`. Edit that tree directly; do not create a second root-level `content/` directory. The validator rejects a legacy root tree so local play, tests, and production cannot read different versions of the archive.

No TypeScript change is required when editing an existing excerpt, NPC line, journal, or vault line. New themed NPC, journal, and vault IDs must also be referenced by the appropriate destination registry; see [Theme authoring](THEME_AUTHORING.md). New excerpt IDs enter generation through the loaded catalog and their `themeAffinities`.

## Files

| File | Purpose |
| --- | --- |
| `public/content/books.yaml` | Work, edition, source, and excerpt metadata |
| `public/content/texts/<work-id>/*.txt` | Displayed public-domain excerpt bodies |
| `public/content/npcs.yaml` | Destination NPC identity and dialogue states |
| `public/content/journals.yaml` | Themed environmental writing |
| `public/content/vaults.yaml` | One clue/vault narrative loop per destination |
| `public/content/dialogue.yaml` | Transporter choices and dynamic hint templates |
| `public/content/gameloop.yaml` | Ship welcome and collection-completion dialogue |
| `public/content/artifacts.yaml` | Persistent curiosity metadata |

## Add a public-domain excerpt

An excerpt has two parts: plain text and catalog metadata.

1. Confirm that the exact edition is public domain in the United States. Record the source before editing the excerpt.
2. Copy only the intended passage into a UTF-8 `.txt` file below `public/content/texts/`. Preserve the edition's wording, spelling, capitalization, lineation, and punctuation.
3. Remove Project Gutenberg headers, footers, transcriber boilerplate, and navigation material.
4. Add or update the work in `public/content/books.yaml`.
5. Run `npm run validate-content` and the catalog tests.

```yaml
books:
  - id: paradise-lost
    title: Paradise Lost
    author: John Milton
    source:
      provider: Project Gutenberg
      ebookNumber: 26
      edition: Twelve-book edition prepared from the Joseph Raben etext
      url: https://www.gutenberg.org/ebooks/26
      publicDomainNote: Public domain in the USA
    fragments:
      - id: paradise-lost-book-1
        label: Book I — The Invocation
        order: 1
        textFile: paradise-lost/book-1-invocation.txt
        sourceLocation: Book I, opening invocation
        themeAffinities: [cathedral, scriptorium]
```

### Work fields

- `id`: stable lowercase identifier; do not repurpose an existing ID for another work.
- `title`, `author`: reader-facing catalog copy.
- `source.provider`: currently must be exactly `Project Gutenberg`.
- `source.ebookNumber`: positive integer from the Gutenberg record.
- `source.edition`: specific translation, editor, publication, or edition represented by the text.
- `source.url`: exactly `https://www.gutenberg.org/ebooks/<ebookNumber>`.
- `source.publicDomainNote`: exactly `Public domain in the USA`.
- `fragments`: the excerpts included in this game.

Do not add `totalFragments`. Collection progress is the number of included `fragments`; the loader derives it.

### Fragment fields

- `id`: globally unique, stable save identifier.
- `label`: reader-facing passage title.
- `order`: integer used to sort excerpts within the work.
- `textFile`: path relative to `public/content/texts/`; it may not escape that directory.
- `sourceLocation`: exact book/chapter/canto/scene/line context for the selected edition.
- `themeAffinities`: one or more of `scriptorium`, `cathedral`, `university`, or `gardens`.
- `editorialContext`: optional concise context written by the project, clearly separate from the source text.

Theme affinity affects deterministic placement and vault reward preference; it does not make an excerpt exclusive to that destination. A vault first prefers an uncollected affiliated excerpt, then any uncollected excerpt.

Because fragment IDs are persisted, renaming one makes an older save lose that collected reference. If a rename is unavoidable, add an explicit migration and a regression test.

## Add or revise an NPC

Each destination has exactly two eligible NPCs. An expedition places one or two of them without duplication.

```yaml
npcs:
  - id: imani
    name: Imani Vale
    role: Choral historian
    themeIds: [cathedral]
    firstMeet:
      - speaker: Imani
        text: "Careful on the nave stones."
    return:
      - speaker: Imani
        text: "The hymnal's figures are not a page number."
    postVault:
      - speaker: Imani
        text: "The reliquary is open? Then the last note resolved after all."
```

- `firstMeet` is used before this NPC has been discovered.
- `return` is used for later conversations before the current expedition's vault opens.
- `postVault` is used after the current vault opens.
- `speaker` is optional; omit it for narration.

Keep each voice distinct and useful without making one NPC mandatory. A player may receive either eligible character, so both should point toward the destination's clue in their own way. After changing the pool, keep `EXPEDITION_THEMES[themeId].npcIds` synchronized.

## Add a journal

Every destination needs at least one eligible journal; registry entries name the preferred pool.

```yaml
journals:
  - id: journal-university-notes
    title: Lecture notes on forbidden knowledge
    themeIds: [university]
    lines:
      - text: "Discovery does not excuse the discoverer from consequence."
      - text: "Who is allowed to learn, and who benefits from calling the distinction natural?"
```

Journal IDs are durable progression identifiers except for vault clues. Do not use a general journal entry as a cross-expedition vault key.

## Author a vault loop

There must be exactly one vault record per destination and every vault and clue ID must be unique. The interaction is discovery-based: the player finds the clue, then interacts with the vault. The player never has to type or remember the four-digit value.

```yaml
vaults:
  - id: vault-university-special-collections
    themeId: university
    name: Special Collections Lockbox
    clue:
      id: clue-university-registrar-memo
      title: Registrar's emergency memo
      lines:
        - text: "The memo's retention code is circled in red: {code}."
    dialogue:
      locked:
        - text: "The lockbox is sealed behind a university inventory plate."
      opening:
        - text: "The registrar's memo supplies {code}. You align the manual tumblers."
      opened:
        - text: "The Special Collections lockbox remains open."
    exhaustedReward:
      journalTitle: Minutes of the last faculty meeting
      journalText: "Whatever survives us must remain available to students we will never meet."
      batteries: 2
```

At least one clue line and one opening line must include `{code}`. The runtime substitutes the expedition's deterministic code. `exhaustedReward` is used after every catalog excerpt has been collected; it supplies a lore note and batteries instead of inventing another excerpt.

The expedition registry also contains a structural vault definition—placement label, preferred zone, and content IDs. Keep it aligned with `vaults.yaml`.

## Transporter and game-loop dialogue

`dialogue.yaml` contains the three transporter states: no new fragments, fragments still present, and all fragments recovered. Choice `action` values are runtime contracts; reuse existing values instead of inventing prose-like action names.

`gameloop.yaml` contains the one-time narrative welcome and completion sequence. A line may include a stable `voiceLineId`:

```yaml
welcome:
  lines:
    - text: Welcome aboard the Starship Alexandria.
      voiceLineId: opening.welcome.01
```

Voice-line IDs must be unique across the file. Recorded clips are optional enhancements: every line must remain complete as visible text and browser narration. When welcome text changes, its existing clip's text hash no longer matches; regenerate and review the voice manifest intentionally.

## YAML style

- Indent with two spaces; do not use tabs.
- Quote strings when punctuation could be parsed as YAML syntax.
- Prefer `>-` for long prose that should display as one paragraph and `|` when line breaks are meaningful.
- Use typographic punctuation only when it belongs to the selected source edition or intentional project prose.
- Keep IDs lowercase and stable; use hyphens as separators.
- Do not place secrets, remote runtime URLs, or generated build output in content files.

## Validate a change

```bash
npm run validate-content
npm test
npm run typecheck
npm run build
```

Content validation rejects:

- missing or duplicate IDs;
- unknown or duplicate theme references;
- missing text files or paths outside `public/content/texts/`;
- empty excerpts and Gutenberg header/footer boilerplate;
- missing or inconsistent Project Gutenberg metadata;
- the deprecated `totalFragments` field;
- any destination without exactly two NPCs and one vault;
- vault clues/opening copy without `{code}`;
- duplicate recorded-narration IDs;
- a legacy root `content/` directory.

Finally, play the affected destination with narration on and off. Confirm the copy makes sense when read linearly, survives narrow layouts/200% zoom, and does not rely on color, audio, or canvas position alone.
