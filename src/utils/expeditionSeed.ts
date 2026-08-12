import type { SavedThemeId } from '@/store/saveMigration';

/**
 * The seed the active expedition actually uses: E2E URL override first, then
 * the saved expedition id, then the theme's deterministic default. Shared by
 * ExploreScene's generator call and every place that displays the seed, so
 * a shared seed always reproduces the same layout.
 */
export function resolveExpeditionSeed(
  activeExpeditionId: string | null,
  themeId: SavedThemeId | null,
): string | null {
  if (process.env.NEXT_PUBLIC_E2E === '1' && typeof window !== 'undefined') {
    const requested = new URLSearchParams(window.location.search).get('seed')?.trim();
    if (requested) return requested;
  }
  if (activeExpeditionId) return activeExpeditionId;
  return themeId ? `${themeId}-expedition` : null;
}
