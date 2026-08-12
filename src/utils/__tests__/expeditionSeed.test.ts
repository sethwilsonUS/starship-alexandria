import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveExpeditionSeed } from '../expeditionSeed';

const stubE2EWindow = (search: string) => {
  vi.stubEnv('NEXT_PUBLIC_E2E', '1');
  vi.stubGlobal('window', { location: { search } });
};

describe('resolveExpeditionSeed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('prefers a trimmed URL seed when the E2E flag is on', () => {
    stubE2EWindow('?seed=%20shared-run%20');
    expect(resolveExpeditionSeed('earth-expedition-1', 'scriptorium')).toBe('shared-run');
  });

  it('ignores blank URL seeds', () => {
    stubE2EWindow('?seed=%20%20');
    expect(resolveExpeditionSeed('earth-expedition-1', 'scriptorium')).toBe('earth-expedition-1');
  });

  it('ignores the URL entirely without the E2E flag', () => {
    vi.stubGlobal('window', { location: { search: '?seed=sneaky' } });
    expect(resolveExpeditionSeed('earth-expedition-1', 'scriptorium')).toBe('earth-expedition-1');
  });

  it('runs without a window (SSR) and falls back to the expedition id', () => {
    vi.stubEnv('NEXT_PUBLIC_E2E', '1');
    expect(resolveExpeditionSeed('earth-expedition-2', 'gardens')).toBe('earth-expedition-2');
  });

  it('falls back to the theme default, then to null', () => {
    expect(resolveExpeditionSeed(null, 'cathedral')).toBe('cathedral-expedition');
    expect(resolveExpeditionSeed(null, null)).toBeNull();
  });
});
