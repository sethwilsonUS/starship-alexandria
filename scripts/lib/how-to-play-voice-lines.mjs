import crypto from 'node:crypto';

const SAFE_LINE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function requireString(value, location) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${location} must be a non-blank string.`);
  }
  return value;
}

export function getHowToPlayVoiceLines(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('How to Play content must be an object.');
  }

  const lineId = requireString(document.voiceLineId, 'voiceLineId');
  if (!SAFE_LINE_ID.test(lineId)) {
    throw new Error(
      `voiceLineId "${lineId}" is invalid; use lowercase letters, digits, dots, dashes, or underscores.`
    );
  }

  const parts = [
    `${requireString(document.title, 'title')}.`,
    requireString(document.intro, 'intro'),
  ];

  if (!Array.isArray(document.sections) || document.sections.length === 0) {
    throw new Error('sections must be a non-empty array.');
  }

  for (const [sectionIndex, section] of document.sections.entries()) {
    const location = `sections[${sectionIndex}]`;
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw new Error(`${location} must be an object.`);
    }
    parts.push(`${requireString(section.heading, `${location}.heading`)}.`);

    if (section.kind === 'ordered') {
      if (!Array.isArray(section.items) || section.items.length === 0) {
        throw new Error(`${location}.items must be a non-empty array.`);
      }
      parts.push(...section.items.map((item, index) => requireString(item, `${location}.items[${index}]`)));
      continue;
    }

    if (section.kind === 'controls') {
      if (!Array.isArray(section.items) || section.items.length === 0) {
        throw new Error(`${location}.items must be a non-empty array.`);
      }
      parts.push(
        ...section.items.map((item, index) =>
          requireString(item?.spoken, `${location}.items[${index}].spoken`)
        )
      );
      continue;
    }

    if (section.kind === 'prose') {
      if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0) {
        throw new Error(`${location}.paragraphs must be a non-empty array.`);
      }
      parts.push(
        ...section.paragraphs.map((paragraph, index) =>
          requireString(paragraph, `${location}.paragraphs[${index}]`)
        )
      );
      continue;
    }

    throw new Error(`${location}.kind must be ordered, controls, or prose.`);
  }

  const text = parts.join(' ');
  return [{ lineId, text, textHash: hashText(text) }];
}
