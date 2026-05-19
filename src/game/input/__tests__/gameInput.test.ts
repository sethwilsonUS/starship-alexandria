import { describe, expect, it, vi } from 'vitest';
import { handleKeyboardInput } from '../gameInput';

describe('handleKeyboardInput', () => {
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
