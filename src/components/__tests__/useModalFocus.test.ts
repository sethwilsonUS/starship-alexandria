import { describe, expect, it } from 'vitest';
import { resolveModalTabTarget } from '../useModalFocus';

describe('resolveModalTabTarget', () => {
  it('redirects focus into the modal when focus starts outside it', () => {
    expect(resolveModalTabTarget({ focusableCount: 3, activeIndex: -1, shiftKey: false })).toBe('first');
    expect(resolveModalTabTarget({ focusableCount: 3, activeIndex: -1, shiftKey: true })).toBe('last');
  });

  it('wraps at both ends of the modal tab order', () => {
    expect(resolveModalTabTarget({ focusableCount: 3, activeIndex: 2, shiftKey: false })).toBe('first');
    expect(resolveModalTabTarget({ focusableCount: 3, activeIndex: 0, shiftKey: true })).toBe('last');
  });

  it('focuses the dialog itself when it has no focusable descendants', () => {
    expect(resolveModalTabTarget({ focusableCount: 0, activeIndex: -1, shiftKey: false })).toBe('dialog');
  });

  it('allows native tabbing between interior controls', () => {
    expect(resolveModalTabTarget({ focusableCount: 3, activeIndex: 1, shiftKey: false })).toBeNull();
  });
});
