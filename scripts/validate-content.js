#!/usr/bin/env node
/**
 * Content validation script.
 * Validates all YAML content files before build/dev to catch errors early.
 * 
 * Run: npm run validate-content
 * Also runs automatically as part of: npm run build
 */

const fs = require('fs');
const path = require('path');
const { parse: parseYaml } = require('yaml');

const CONTENT_DIR = path.join(process.cwd(), 'public', 'content');
const TEXTS_DIR = path.join(CONTENT_DIR, 'texts');
const LEGACY_CONTENT_DIR = path.join(process.cwd(), 'content');
const THEME_IDS = ['scriptorium', 'cathedral', 'university', 'gardens'];
const THEME_ID_SET = new Set(THEME_IDS);

const errors = [];
const warnings = [];

function addError(file, message) {
  errors.push({ file, message });
}

function addWarning(file, message) {
  warnings.push({ file, message });
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateLines(file, location, lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    addError(file, `${location}: Missing or empty dialogue array`);
    return;
  }

  lines.forEach((line, index) => {
    if (!line || !isNonEmptyString(line.text)) {
      addError(file, `${location}[${index}]: Missing required field "text"`);
    }
  });
}

function loadYaml(filename) {
  const filePath = path.join(CONTENT_DIR, filename);
  
  if (!fileExists(filePath)) {
    addError(filename, `File not found: ${filePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseYaml(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    addError(filename, `YAML parse error: ${message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────────────

function validateNPCs() {
  const data = loadYaml('npcs.yaml');
  if (!data) return;

  if (!data.npcs || !Array.isArray(data.npcs)) {
    addError('npcs.yaml', 'Missing or invalid "npcs" array');
    return;
  }

  const ids = new Set();
  const themePools = new Map(THEME_IDS.map((themeId) => [themeId, []]));

  data.npcs.forEach((npc, index) => {
    const prefix = `npcs[${index}]`;

    if (!isNonEmptyString(npc.id)) addError('npcs.yaml', `${prefix}: Missing required field "id"`);
    if (!isNonEmptyString(npc.name)) addError('npcs.yaml', `${prefix}: Missing required field "name"`);
    if (!isNonEmptyString(npc.role)) addError('npcs.yaml', `${prefix}: Missing required field "role"`);

    if (npc.id && ids.has(npc.id)) {
      addError('npcs.yaml', `${prefix}: Duplicate id "${npc.id}"`);
    }
    if (npc.id) ids.add(npc.id);

    if (!Array.isArray(npc.themeIds) || npc.themeIds.length === 0) {
      addError('npcs.yaml', `${prefix}: Missing or empty "themeIds" array`);
    } else {
      const seenThemes = new Set();
      npc.themeIds.forEach((themeId, themeIndex) => {
        if (!THEME_ID_SET.has(themeId)) {
          addError('npcs.yaml', `${prefix}.themeIds[${themeIndex}]: Unknown theme "${themeId}"`);
        } else {
          themePools.get(themeId).push(npc.id);
        }
        if (seenThemes.has(themeId)) {
          addError('npcs.yaml', `${prefix}: Duplicate theme "${themeId}"`);
        }
        seenThemes.add(themeId);
      });
    }

    validateLines('npcs.yaml', `${prefix}.firstMeet`, npc.firstMeet);
    validateLines('npcs.yaml', `${prefix}.return`, npc.return);
    validateLines('npcs.yaml', `${prefix}.postVault`, npc.postVault);
  });

  for (const [themeId, npcIds] of themePools) {
    if (npcIds.length !== 2) {
      addError(
        'npcs.yaml',
        `Theme "${themeId}" must have exactly 2 NPCs; found ${npcIds.length}`
      );
    }
  }
}

function validateJournals() {
  const data = loadYaml('journals.yaml');
  if (!data) return;

  if (!data.journals || !Array.isArray(data.journals)) {
    addError('journals.yaml', 'Missing or invalid "journals" array');
    return;
  }

  const ids = new Set();
  const themeCounts = new Map(THEME_IDS.map((themeId) => [themeId, 0]));

  data.journals.forEach((journal, index) => {
    const prefix = `journals[${index}]`;

    if (!journal.id) addError('journals.yaml', `${prefix}: Missing required field "id"`);
    if (!journal.title) addError('journals.yaml', `${prefix}: Missing required field "title"`);

    if (journal.id && ids.has(journal.id)) {
      addError('journals.yaml', `${prefix}: Duplicate id "${journal.id}"`);
    }
    if (journal.id) ids.add(journal.id);

    if (!Array.isArray(journal.themeIds) || journal.themeIds.length === 0) {
      addError('journals.yaml', `${prefix}: Missing or empty "themeIds" array`);
    } else {
      const seenThemes = new Set();
      journal.themeIds.forEach((themeId, themeIndex) => {
        if (!THEME_ID_SET.has(themeId)) {
          addError('journals.yaml', `${prefix}.themeIds[${themeIndex}]: Unknown theme "${themeId}"`);
        } else {
          themeCounts.set(themeId, themeCounts.get(themeId) + 1);
        }
        if (seenThemes.has(themeId)) {
          addError('journals.yaml', `${prefix}: Duplicate theme "${themeId}"`);
        }
        seenThemes.add(themeId);
      });
    }

    validateLines('journals.yaml', `${prefix}.lines`, journal.lines);
  });

  for (const [themeId, count] of themeCounts) {
    if (count < 1) {
      addError('journals.yaml', `Theme "${themeId}" must have at least 1 journal; found ${count}`);
    }
  }
}

function validateBooks() {
  const data = loadYaml('books.yaml');
  if (!data) return;

  if (!data.books || !Array.isArray(data.books)) {
    addError('books.yaml', 'Missing or invalid "books" array');
    return;
  }

  const bookIds = new Set();
  const fragmentIds = new Set();

  data.books.forEach((book, index) => {
    const prefix = `books[${index}]`;

    if (!isNonEmptyString(book.id)) addError('books.yaml', `${prefix}: Missing required field "id"`);
    if (!isNonEmptyString(book.title)) addError('books.yaml', `${prefix}: Missing required field "title"`);
    if (!isNonEmptyString(book.author)) addError('books.yaml', `${prefix}: Missing required field "author"`);
    if (Object.prototype.hasOwnProperty.call(book, 'totalFragments')) {
      addError(
        'books.yaml',
        `${prefix}: Deprecated field "totalFragments"; included count is derived from fragments`
      );
    }

    if (book.id && bookIds.has(book.id)) {
      addError('books.yaml', `${prefix}: Duplicate book id "${book.id}"`);
    }
    if (book.id) bookIds.add(book.id);

    const source = book.source;
    if (!source || typeof source !== 'object') {
      addError('books.yaml', `${prefix}: Missing required "source" metadata`);
    } else {
      if (source.provider !== 'Project Gutenberg') {
        addError('books.yaml', `${prefix}.source.provider: Must be "Project Gutenberg"`);
      }
      if (!Number.isInteger(source.ebookNumber) || source.ebookNumber <= 0) {
        addError('books.yaml', `${prefix}.source.ebookNumber: Must be a positive integer`);
      }
      if (!isNonEmptyString(source.edition)) {
        addError('books.yaml', `${prefix}.source.edition: Missing edition description`);
      }
      const expectedUrl = `https://www.gutenberg.org/ebooks/${source.ebookNumber}`;
      if (source.url !== expectedUrl) {
        addError('books.yaml', `${prefix}.source.url: Must be "${expectedUrl}"`);
      }
      if (source.publicDomainNote !== 'Public domain in the USA') {
        addError(
          'books.yaml',
          `${prefix}.source.publicDomainNote: Must be "Public domain in the USA"`
        );
      }
    }

    if (!Array.isArray(book.fragments) || book.fragments.length === 0) {
      addError('books.yaml', `${prefix}: Missing or empty "fragments" array`);
    } else {
      book.fragments.forEach((frag, i) => {
        const fragPrefix = `${prefix}.fragments[${i}]`;

        if (!isNonEmptyString(frag.id)) addError('books.yaml', `${fragPrefix}: Missing required field "id"`);
        if (!isNonEmptyString(frag.label)) addError('books.yaml', `${fragPrefix}: Missing required field "label"`);
        if (!Number.isInteger(frag.order)) {
          addError('books.yaml', `${fragPrefix}: Missing or invalid "order" (must be an integer)`);
        }
        if (!isNonEmptyString(frag.textFile)) {
          addError('books.yaml', `${fragPrefix}: Missing required field "textFile"`);
        }
        if (!isNonEmptyString(frag.sourceLocation)) {
          addError('books.yaml', `${fragPrefix}: Missing required field "sourceLocation"`);
        }
        if (frag.editorialContext !== undefined && !isNonEmptyString(frag.editorialContext)) {
          addError('books.yaml', `${fragPrefix}: "editorialContext" must be a non-empty string`);
        }

        if (!Array.isArray(frag.themeAffinities) || frag.themeAffinities.length === 0) {
          addError('books.yaml', `${fragPrefix}: Missing or empty "themeAffinities" array`);
        } else {
          const affinities = new Set();
          frag.themeAffinities.forEach((themeId) => {
            if (!THEME_ID_SET.has(themeId)) {
              addError('books.yaml', `${fragPrefix}: Unknown theme affinity "${themeId}"`);
            }
            if (affinities.has(themeId)) {
              addError('books.yaml', `${fragPrefix}: Duplicate theme affinity "${themeId}"`);
            }
            affinities.add(themeId);
          });
        }

        if (frag.id && fragmentIds.has(frag.id)) {
          addError('books.yaml', `${fragPrefix}: Duplicate fragment id "${frag.id}"`);
        }
        if (frag.id) fragmentIds.add(frag.id);

        if (frag.textFile) {
          const textPath = path.resolve(TEXTS_DIR, frag.textFile);
          if (!textPath.startsWith(`${TEXTS_DIR}${path.sep}`)) {
            addError('books.yaml', `${fragPrefix}: textFile must stay inside content/texts`);
          } else if (!fileExists(textPath)) {
            addError('books.yaml', `${fragPrefix}: Text file not found: ${frag.textFile}`);
          } else {
            const text = fs.readFileSync(textPath, 'utf8');
            if (!isNonEmptyString(text)) {
              addError('books.yaml', `${fragPrefix}: Text file is empty: ${frag.textFile}`);
            }
            if (/START OF THE PROJECT GUTENBERG|END OF THE PROJECT GUTENBERG/i.test(text)) {
              addError(
                'books.yaml',
                `${fragPrefix}: Text file contains Project Gutenberg boilerplate: ${frag.textFile}`
              );
            }
          }
        }
      });
    }
  });
}

function validateDialogue() {
  const data = loadYaml('dialogue.yaml');
  if (!data) return;

  // Validate transporter dialogue
  if (!data.transporter) {
    addError('dialogue.yaml', 'Missing "transporter" section');
  } else {
    ['noFragments', 'fragmentsRemaining', 'allCollected'].forEach((key) => {
      const dialogue = data.transporter[key];
      if (!dialogue) {
        addError('dialogue.yaml', `transporter.${key}: Missing section`);
        return;
      }
      if (!dialogue.text) {
        addError('dialogue.yaml', `transporter.${key}: Missing required field "text"`);
      }
      if (!dialogue.choices || !Array.isArray(dialogue.choices)) {
        addError('dialogue.yaml', `transporter.${key}: Missing or invalid "choices" array`);
      } else {
        dialogue.choices.forEach((choice, i) => {
          if (!choice.label) addError('dialogue.yaml', `transporter.${key}.choices[${i}]: Missing "label"`);
          if (!choice.key) addError('dialogue.yaml', `transporter.${key}.choices[${i}]: Missing "key"`);
          if (!choice.action) addError('dialogue.yaml', `transporter.${key}.choices[${i}]: Missing "action"`);
        });
      }
    });
  }

  // Validate Martha hint
  if (!data.marthaHint) {
    addError('dialogue.yaml', 'Missing "marthaHint" section');
  } else {
    if (!data.marthaHint.template) {
      addError('dialogue.yaml', 'marthaHint: Missing required field "template"');
    }
    if (!data.marthaHint.fallback) {
      addError('dialogue.yaml', 'marthaHint: Missing required field "fallback"');
    }
  }
}

function validateArtifacts() {
  const data = loadYaml('artifacts.yaml');
  if (!data) return;

  if (!data.artifacts || !Array.isArray(data.artifacts)) {
    addError('artifacts.yaml', 'Missing or invalid "artifacts" array');
    return;
  }

  const ids = new Set();

  data.artifacts.forEach((artifact, index) => {
    const prefix = `artifacts[${index}]`;

    if (!artifact.id) addError('artifacts.yaml', `${prefix}: Missing required field "id"`);
    if (!artifact.name) addError('artifacts.yaml', `${prefix}: Missing required field "name"`);
    if (!artifact.description) addError('artifacts.yaml', `${prefix}: Missing required field "description"`);

    if (artifact.id && ids.has(artifact.id)) {
      addError('artifacts.yaml', `${prefix}: Duplicate id "${artifact.id}"`);
    }
    if (artifact.id) ids.add(artifact.id);

    // Recommend artifact- prefix for consistency
    if (artifact.id && !artifact.id.startsWith('artifact-')) {
      addWarning('artifacts.yaml', `${prefix}: ID "${artifact.id}" should start with "artifact-" for consistency`);
    }
  });
}

function validateVaults() {
  const data = loadYaml('vaults.yaml');
  if (!data) return;

  if (!Array.isArray(data.vaults)) {
    addError('vaults.yaml', 'Missing or invalid "vaults" array');
    return;
  }

  const vaultIds = new Set();
  const clueIds = new Set();
  const vaultsByTheme = new Map(THEME_IDS.map((themeId) => [themeId, 0]));

  data.vaults.forEach((vault, index) => {
    const prefix = `vaults[${index}]`;

    if (!isNonEmptyString(vault.id)) {
      addError('vaults.yaml', `${prefix}: Missing required field "id"`);
    } else if (vaultIds.has(vault.id)) {
      addError('vaults.yaml', `${prefix}: Duplicate vault id "${vault.id}"`);
    } else {
      vaultIds.add(vault.id);
    }

    if (!isNonEmptyString(vault.name)) {
      addError('vaults.yaml', `${prefix}: Missing required field "name"`);
    }
    if (!THEME_ID_SET.has(vault.themeId)) {
      addError('vaults.yaml', `${prefix}: Unknown theme "${vault.themeId}"`);
    } else {
      vaultsByTheme.set(vault.themeId, vaultsByTheme.get(vault.themeId) + 1);
    }

    if (!vault.clue || typeof vault.clue !== 'object') {
      addError('vaults.yaml', `${prefix}: Missing required "clue" definition`);
    } else {
      if (!isNonEmptyString(vault.clue.id)) {
        addError('vaults.yaml', `${prefix}.clue: Missing required field "id"`);
      } else if (clueIds.has(vault.clue.id)) {
        addError('vaults.yaml', `${prefix}.clue: Duplicate clue id "${vault.clue.id}"`);
      } else {
        clueIds.add(vault.clue.id);
      }
      if (!isNonEmptyString(vault.clue.title)) {
        addError('vaults.yaml', `${prefix}.clue: Missing required field "title"`);
      }
      validateLines('vaults.yaml', `${prefix}.clue.lines`, vault.clue.lines);
      if (
        Array.isArray(vault.clue.lines) &&
        !vault.clue.lines.some((line) => line?.text?.includes('{code}'))
      ) {
        addError('vaults.yaml', `${prefix}.clue.lines: At least one line must include "{code}"`);
      }
    }

    if (!vault.dialogue || typeof vault.dialogue !== 'object') {
      addError('vaults.yaml', `${prefix}: Missing required "dialogue" definition`);
    } else {
      validateLines('vaults.yaml', `${prefix}.dialogue.locked`, vault.dialogue.locked);
      validateLines('vaults.yaml', `${prefix}.dialogue.opening`, vault.dialogue.opening);
      validateLines('vaults.yaml', `${prefix}.dialogue.opened`, vault.dialogue.opened);
      if (
        Array.isArray(vault.dialogue.opening) &&
        !vault.dialogue.opening.some((line) => line?.text?.includes('{code}'))
      ) {
        addError(
          'vaults.yaml',
          `${prefix}.dialogue.opening: At least one line must include "{code}"`
        );
      }
    }

    const reward = vault.exhaustedReward;
    if (!reward || typeof reward !== 'object') {
      addError('vaults.yaml', `${prefix}: Missing required "exhaustedReward" definition`);
    } else {
      if (!isNonEmptyString(reward.journalTitle)) {
        addError('vaults.yaml', `${prefix}.exhaustedReward: Missing "journalTitle"`);
      }
      if (!isNonEmptyString(reward.journalText)) {
        addError('vaults.yaml', `${prefix}.exhaustedReward: Missing "journalText"`);
      }
      if (!Number.isInteger(reward.batteries) || reward.batteries < 0) {
        addError('vaults.yaml', `${prefix}.exhaustedReward: "batteries" must be a nonnegative integer`);
      }
    }
  });

  for (const [themeId, count] of vaultsByTheme) {
    if (count !== 1) {
      addError('vaults.yaml', `Theme "${themeId}" must have exactly 1 vault; found ${count}`);
    }
  }
}

function validateGameloop() {
  const data = loadYaml('gameloop.yaml');
  if (!data) return;

  const voiceLineIds = new Map();

  function validateVoiceLineId(line, location) {
    if (!line.voiceLineId) return;

    const existingLocation = voiceLineIds.get(line.voiceLineId);
    if (existingLocation) {
      addError(
        'gameloop.yaml',
        `${location}: Duplicate voiceLineId "${line.voiceLineId}" (already used at ${existingLocation})`
      );
      return;
    }

    voiceLineIds.set(line.voiceLineId, location);
  }

  // Validate welcome
  if (!data.welcome) {
    addError('gameloop.yaml', 'Missing "welcome" section');
  } else if (!data.welcome.lines || !Array.isArray(data.welcome.lines)) {
    addError('gameloop.yaml', 'welcome: Missing or invalid "lines" array');
  } else {
    data.welcome.lines.forEach((line, i) => {
      if (!line.text) {
        addError('gameloop.yaml', `welcome.lines[${i}]: Missing required field "text"`);
      }
      validateVoiceLineId(line, `welcome.lines[${i}]`);
    });
  }

  // Validate victory
  if (!data.victory) {
    addError('gameloop.yaml', 'Missing "victory" section');
  } else if (!data.victory.lines || !Array.isArray(data.victory.lines)) {
    addError('gameloop.yaml', 'victory: Missing or invalid "lines" array');
  } else {
    data.victory.lines.forEach((line, i) => {
      if (!line.text) {
        addError('gameloop.yaml', `victory.lines[${i}]: Missing required field "text"`);
      }
      validateVoiceLineId(line, `victory.lines[${i}]`);
    });
  }

}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('Validating content files...\n');

  // Check content directory exists
  if (!fileExists(CONTENT_DIR)) {
    console.error(`ERROR: Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  if (fileExists(LEGACY_CONTENT_DIR)) {
    addError(
      'content/',
      'Legacy root content directory exists; public/content is the sole canonical source'
    );
  }

  // Run all validators
  validateNPCs();
  validateJournals();
  validateBooks();
  validateDialogue();
  validateArtifacts();
  validateVaults();
  validateGameloop();

  // Report results
  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach((w) => {
      console.log(`  ${w.file}: ${w.message}`);
    });
    console.log('');
  }

  if (errors.length > 0) {
    console.log('ERRORS:');
    errors.forEach((e) => {
      console.log(`  ${e.file}: ${e.message}`);
    });
    console.log('');
    console.error(`\n❌ Validation failed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('✓ All content files valid\n');
}

main();
