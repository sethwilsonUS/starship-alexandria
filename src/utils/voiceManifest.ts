export type VoiceClip = {
  lineId: string;
  textHash: string;
  path: string;
  model: string;
  voice: string;
  durationMs: number | null;
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
