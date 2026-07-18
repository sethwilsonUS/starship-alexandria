import { describe, expect, it } from 'vitest';
import { shouldUseMotion } from '../motionPolicy';

describe('shared motion policy', () => {
  it('always suppresses decorative motion when reduce is selected', () => {
    expect(shouldUseMotion('reduce', false)).toBe(false);
    expect(shouldUseMotion('reduce', true)).toBe(false);
  });

  it('allows decorative motion when full is selected', () => {
    expect(shouldUseMotion('full', false)).toBe(true);
    expect(shouldUseMotion('full', true)).toBe(true);
  });

  it('follows the operating-system preference in system mode', () => {
    expect(shouldUseMotion('system', false)).toBe(true);
    expect(shouldUseMotion('system', true)).toBe(false);
  });
});
