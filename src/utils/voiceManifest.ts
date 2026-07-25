export type VoiceClipFormat = {
  format: 'mp3' | 'ogg';
  path: string;
  bytes: number;
  sha256: string;
  provenance: {
    encoder: string;
    encoderVersion: string;
    sourceFormat: string;
  };
};

export type VoiceClip = {
  lineId: string;
  textHash: string;
  path: string;
  model: string;
  voice: string;
  durationMs: number | null;
  formats: VoiceClipFormat[];
};

export type VoiceManifest = {
  version: 1;
  generatedAt: string;
  clips: VoiceClip[];
};

let voiceManifestPromise: Promise<VoiceManifest | null> | null = null;

export function findVoiceClip(manifest: VoiceManifest, lineId: string): VoiceClip | null {
  return manifest.clips.find((clip) => clip.lineId === lineId) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPresentString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateVoiceManifest(manifest: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(manifest)) {
    return ['manifest must be an object'];
  }

  if (manifest.version !== 1) {
    errors.push('unsupported version');
  }

  if (typeof manifest.generatedAt !== 'string') {
    errors.push('generatedAt must be a string');
  }

  if (!Array.isArray(manifest.clips)) {
    errors.push('clips must be an array');
    return errors;
  }

  const seenLineIds = new Set<string>();

  manifest.clips.forEach((clip, index) => {
    if (!isRecord(clip)) {
      errors.push(`clip at index ${index} must be an object`);
      return;
    }

    if (!isPresentString(clip.lineId)) {
      errors.push(`missing clip lineId at index ${index}`);
    } else if (seenLineIds.has(clip.lineId)) {
      errors.push(`duplicate line id: ${clip.lineId}`);
    } else {
      seenLineIds.add(clip.lineId);
    }

    if (!isPresentString(clip.textHash)) {
      errors.push(`missing clip textHash at index ${index}`);
    }

    if (!isPresentString(clip.path)) {
      errors.push(`missing clip path at index ${index}`);
    }

    if (!isPresentString(clip.model)) {
      errors.push(`missing clip model at index ${index}`);
    }

    if (!isPresentString(clip.voice)) {
      errors.push(`missing clip voice at index ${index}`);
    }

    if (typeof clip.durationMs !== 'number' && clip.durationMs !== null) {
      errors.push(`clip durationMs must be a number or null at index ${index}`);
    }

    if (!Array.isArray(clip.formats)) {
      errors.push(`clip formats must be an array at index ${index}`);
      return;
    }

    const seenFormats = new Set<string>();
    clip.formats.forEach((format, formatIndex) => {
      if (!isRecord(format)) {
        errors.push(`clip format at index ${index}.${formatIndex} must be an object`);
        return;
      }
      if (format.format !== 'mp3' && format.format !== 'ogg') {
        errors.push(`unsupported clip format at index ${index}.${formatIndex}`);
      } else if (seenFormats.has(format.format)) {
        errors.push(`duplicate ${format.format} clip format at index ${index}`);
      } else {
        seenFormats.add(format.format);
      }
      if (!isPresentString(format.path)) {
        errors.push(`missing clip format path at index ${index}.${formatIndex}`);
      }
      if (!Number.isInteger(format.bytes) || (format.bytes as number) <= 0) {
        errors.push(`clip format bytes must be a positive integer at index ${index}.${formatIndex}`);
      }
      if (!isPresentString(format.sha256)) {
        errors.push(`missing clip format sha256 at index ${index}.${formatIndex}`);
      }
      if (!isRecord(format.provenance)) {
        errors.push(`missing clip format provenance at index ${index}.${formatIndex}`);
      } else {
        for (const field of ['encoder', 'encoderVersion', 'sourceFormat']) {
          if (!isPresentString(format.provenance[field])) {
            errors.push(`missing clip format provenance ${field} at index ${index}.${formatIndex}`);
          }
        }
      }
    });
    if (seenFormats.size !== 2 || !seenFormats.has('mp3') || !seenFormats.has('ogg')) {
      errors.push(`clip formats must contain exactly one MP3 and one OGG at index ${index}`);
    }
  });

  return errors;
}

async function fetchVoiceManifest(): Promise<VoiceManifest | null> {
  try {
    const response = await fetch('/audio/voices/manifest.json');

    if (!response.ok) {
      return null;
    }

    const manifest = await response.json();
    const errors = validateVoiceManifest(manifest);

    if (errors.length > 0) {
      console.warn('Invalid voice manifest:', errors);
      return null;
    }

    return manifest as VoiceManifest;
  } catch (error) {
    console.warn('Failed to load voice manifest:', error);
    return null;
  }
}

export async function loadVoiceManifest(): Promise<VoiceManifest | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  voiceManifestPromise ??= fetchVoiceManifest();
  return voiceManifestPromise;
}

export function clearVoiceManifestCacheForTests(): void {
  voiceManifestPromise = null;
}
