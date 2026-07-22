import path from 'node:path';

export const PINNED_FFMPEG_VERSION = '8.1';

/**
 * @param {string} banner
 * @param {string} expectedVersion
 */
export function assertFfmpegVersion(banner, expectedVersion = PINNED_FFMPEG_VERSION) {
  const version = /^ffmpeg version\s+(\S+)/.exec(banner)?.[1];
  if (!version) throw new Error('Unable to determine ffmpeg version from its banner');
  if (version !== expectedVersion) {
    throw new Error(`Asset refresh requires ffmpeg ${expectedVersion}; received ${version}`);
  }
}

/**
 * Validate the logical OGG/MP3 pairs declared by the runtime asset manifest.
 * File existence, signatures, and hashes are checked by the CLI separately.
 *
 * @param {Array<{ kind?: unknown, path?: unknown, logicalName?: unknown }>} records
 * @returns {{ errors: string[], pairCount: number }}
 */
export function validateAudioFormatGroups(records) {
  const errors = [];
  const groups = new Map();

  for (const record of records) {
    if (record.kind !== 'audio') continue;
    const recordPath = typeof record.path === 'string' ? record.path : '(unknown path)';
    if (typeof record.logicalName !== 'string' || record.logicalName.trim().length === 0) {
      errors.push(`${recordPath}: audio assets require a non-empty logicalName`);
      continue;
    }

    const logicalName = record.logicalName.trim();
    const extension = path.extname(recordPath).slice(1) || '(none)';
    const counts = groups.get(logicalName) ?? { ogg: 0, mp3: 0, unexpected: [] };
    if (extension === 'ogg' || extension === 'mp3') counts[extension] += 1;
    else counts.unexpected.push(extension);
    groups.set(logicalName, counts);
  }

  for (const [logicalName, counts] of groups) {
    if (counts.ogg !== 1 || counts.mp3 !== 1 || counts.unexpected.length > 0) {
      const unexpected = counts.unexpected.length > 0
        ? counts.unexpected.join(',')
        : 'none';
      errors.push(
        `${logicalName}: audio must provide exactly one OGG and one MP3; `
        + `found ogg=${counts.ogg}, mp3=${counts.mp3}, unexpected=${unexpected}`
      );
    }
  }

  return { errors, pairCount: groups.size };
}
