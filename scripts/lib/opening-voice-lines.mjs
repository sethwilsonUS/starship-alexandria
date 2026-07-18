import crypto from 'node:crypto';

const SAFE_LINE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Extracts only opening lines with recorded clips while validating every line.
 * A missing voiceLineId is intentional: that line can use browser narration.
 */
export function getOpeningVoiceLines(gameloop) {
  const lines = gameloop?.welcome?.lines;

  if (lines == null) {
    return [];
  }

  if (!Array.isArray(lines)) {
    throw new Error('welcome.lines must be an array.');
  }

  const seenLineIndexes = new Map();
  const recordedLines = [];

  for (const [index, line] of lines.entries()) {
    const location = `welcome.lines[${index}]`;

    if (!isObjectRecord(line)) {
      throw new Error(`${location} must be an object.`);
    }

    if (typeof line.text !== 'string' || line.text.trim().length === 0) {
      throw new Error(`${location}.text must be a non-blank string.`);
    }

    if (!Object.hasOwn(line, 'voiceLineId')) {
      continue;
    }

    if (typeof line.voiceLineId !== 'string' || line.voiceLineId.trim().length === 0) {
      throw new Error(`${location}.voiceLineId must be a non-blank string when provided.`);
    }

    if (!SAFE_LINE_ID.test(line.voiceLineId)) {
      throw new Error(
        `${location}.voiceLineId "${line.voiceLineId}" is invalid; use lowercase letters, digits, dots, dashes, or underscores.`
      );
    }

    const previousIndex = seenLineIndexes.get(line.voiceLineId);
    if (previousIndex !== undefined) {
      throw new Error(
        `${location}.voiceLineId duplicates "${line.voiceLineId}" from welcome.lines[${previousIndex}].`
      );
    }

    seenLineIndexes.set(line.voiceLineId, index);
    recordedLines.push({
      lineId: line.voiceLineId,
      text: line.text,
      textHash: hashText(line.text),
    });
  }

  return recordedLines;
}
