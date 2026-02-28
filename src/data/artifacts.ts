/**
 * Artifacts: Optional collectibles found in vaults.
 * Personal treasures that tell stories of the people who lived before.
 * 
 * Content is loaded from content/artifacts.yaml
 */

import { getArtifactCacheSync } from '@/utils/contentLoaderSync';

export interface Artifact {
  id: string;
  name: string;
  description: string;
}

/**
 * Get a random artifact that hasn't been collected yet.
 */
export function getRandomUncollectedArtifact(collectedIds: string[]): Artifact | null {
  const artifacts = getArtifactCacheSync();
  const available = artifacts.filter(a => !collectedIds.includes(a.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Get an artifact by ID.
 */
export function getArtifactById(id: string): Artifact | undefined {
  const artifacts = getArtifactCacheSync();
  return artifacts.find(a => a.id === id);
}

/**
 * Get all artifacts (for display purposes).
 */
export function getAllArtifacts(): Artifact[] {
  return [...getArtifactCacheSync()];
}

/**
 * Total number of artifacts in the game.
 */
export function getTotalArtifacts(): number {
  return getArtifactCacheSync().length;
}
