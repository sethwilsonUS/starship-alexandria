import { describe, expect, it, vi } from 'vitest';
import { handleKeyboardInput } from '../gameInput';

describe('handleKeyboardInput', () => {
  it('ignores keyboard events already handled by an overlay', () => {
    const preventDefault = vi.fn();
    const event = {
      code: 'Space',
      defaultPrevented: true,
      repeat: false,
      target: null,
      preventDefault,
    } as unknown as KeyboardEvent;

    expect(handleKeyboardInput(event)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not prevent native button keyboard activation', () => {
    const buttonTarget = {
      closest: vi.fn(() => buttonTarget),
    };
    const preventDefault = vi.fn();
    const event = {
      code: 'Space',
      repeat: false,
      target: buttonTarget,
      preventDefault,
    } as unknown as KeyboardEvent;

    expect(handleKeyboardInput(event)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
