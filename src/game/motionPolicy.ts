import type { MotionPreference } from '@/store/saveMigration';

/** Resolve the shared CSS/Phaser motion preference without touching React state. */
export function shouldUseMotion(
  preference: MotionPreference,
  systemPrefersReducedMotion = readSystemMotionPreference(),
): boolean {
  if (preference === 'reduce') return false;
  if (preference === 'full') return true;
  return !systemPrefersReducedMotion;
}

function readSystemMotionPreference(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
