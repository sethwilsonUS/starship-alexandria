import { describe, expect, it } from 'vitest';
import { resolveModalTabTarget, shouldApplyModalAutofocus } from '../useModalFocus';

describe('shouldApplyModalAutofocus', () => {
  it('moves focus into a newly opened modal when focus is still outside', () => {
    expect(shouldApplyModalAutofocus(false)).toBe(true);
  });

  it('preserves focus that has already moved inside the modal', () => {
    expect(shouldApplyModalAutofocus(true)).toBe(false);
  });
});

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
