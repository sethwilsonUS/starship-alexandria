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

  data.npcs.forEach((npc, index) => {
    const prefix = `npcs[${index}]`;

    if (!npc.id) addError('npcs.yaml', `${prefix}: Missing required field "id"`);
    if (!npc.name) addError('npcs.yaml', `${prefix}: Missing required field "name"`);

    if (npc.id && ids.has(npc.id)) {
      addError('npcs.yaml', `${prefix}: Duplicate id "${npc.id}"`);
    }
    if (npc.id) ids.add(npc.id);

    if (!npc.firstMeet || !Array.isArray(npc.firstMeet)) {
      addError('npcs.yaml', `${prefix}: Missing or invalid "firstMeet" array`);
    } else {
      npc.firstMeet.forEach((line, i) => {
        if (!line.text) {
          addError('npcs.yaml', `${prefix}.firstMeet[${i}]: Missing required field "text"`);
        }
      });
    }

    if (!npc.return || !Array.isArray(npc.return)) {
      addError('npcs.yaml', `${prefix}: Missing or invalid "return" array`);
    } else {
      npc.return.forEach((line, i) => {
        if (!line.text) {
          addError('npcs.yaml', `${prefix}.return[${i}]: Missing required field "text"`);
        }
      });
    }
  });
}

function validateJournals() {
  const data = loadYaml('journals.yaml');
  if (!data) return;

  if (!data.journals || !Array.isArray(data.journals)) {
    addError('journals.yaml', 'Missing or invalid "journals" array');
    return;
  }

  const ids = new Set();

  data.journals.forEach((journal, index) => {
    const prefix = `journals[${index}]`;

    if (!journal.id) addError('journals.yaml', `${prefix}: Missing required field "id"`);
    if (!journal.title) addError('journals.yaml', `${prefix}: Missing required field "title"`);

    if (journal.id && ids.has(journal.id)) {
      addError('journals.yaml', `${prefix}: Duplicate id "${journal.id}"`);
    }
    if (journal.id) ids.add(journal.id);

    if (!journal.lines || !Array.isArray(journal.lines)) {
      addError('journals.yaml', `${prefix}: Missing or invalid "lines" array`);
    } else {
      journal.lines.forEach((line, i) => {
        if (!line.text) {
          addError('journals.yaml', `${prefix}.lines[${i}]: Missing required field "text"`);
        }
      });
    }
  });
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

    if (!book.id) addError('books.yaml', `${prefix}: Missing required field "id"`);
    if (!book.title) addError('books.yaml', `${prefix}: Missing required field "title"`);
    if (!book.author) addError('books.yaml', `${prefix}: Missing required field "author"`);
    if (typeof book.totalFragments !== 'number') {
      addError('books.yaml', `${prefix}: Missing or invalid "totalFragments" (must be number)`);
    }

    if (book.id && bookIds.has(book.id)) {
      addError('books.yaml', `${prefix}: Duplicate book id "${book.id}"`);
    }
    if (book.id) bookIds.add(book.id);

    if (!book.fragments || !Array.isArray(book.fragments)) {
      addError('books.yaml', `${prefix}: Missing or invalid "fragments" array`);
    } else {
      book.fragments.forEach((frag, i) => {
        const fragPrefix = `${prefix}.fragments[${i}]`;

        if (!frag.id) addError('books.yaml', `${fragPrefix}: Missing required field "id"`);
        if (!frag.label) addError('books.yaml', `${fragPrefix}: Missing required field "label"`);
        if (typeof frag.order !== 'number') {
          addError('books.yaml', `${fragPrefix}: Missing or invalid "order" (must be number)`);
        }
        if (!frag.textFile) {
          addError('books.yaml', `${fragPrefix}: Missing required field "textFile"`);
        }

        if (frag.id && fragmentIds.has(frag.id)) {
          addError('books.yaml', `${fragPrefix}: Duplicate fragment id "${frag.id}"`);
        }
        if (frag.id) fragmentIds.add(frag.id);

        // Check that the text file exists
        if (frag.textFile) {
          const textPath = path.join(TEXTS_DIR, frag.textFile);
          if (!fileExists(textPath)) {
            addError('books.yaml', `${fragPrefix}: Text file not found: ${frag.textFile}`);
          }
        }
      });

      // Warning if fragment count doesn't match totalFragments
      if (book.fragments.length > book.totalFragments) {
        addWarning('books.yaml', `${prefix}: Has ${book.fragments.length} fragments but totalFragments is ${book.totalFragments}`);
      }
    }
  });
}

function validateRooms() {
  const data = loadYaml('rooms.yaml');
  if (!data) return;

  if (!data.roomNames || !Array.isArray(data.roomNames)) {
    addError('rooms.yaml', 'Missing or invalid "roomNames" array');
    return;
  }

  if (data.roomNames.length === 0) {
    addWarning('rooms.yaml', 'roomNames array is empty');
  }

  data.roomNames.forEach((name, index) => {
    if (typeof name !== 'string' || name.trim() === '') {
      addError('rooms.yaml', `roomNames[${index}]: Invalid or empty room name`);
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

  // Run all validators
  validateNPCs();
  validateJournals();
  validateBooks();
  validateRooms();
  validateDialogue();

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
