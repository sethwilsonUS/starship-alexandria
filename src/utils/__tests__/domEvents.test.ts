import { describe, expect, it } from 'vitest';
import { isNativeInteractiveTarget } from '../domEvents';

describe('isNativeInteractiveTarget', () => {
  it('recognizes an interactive Element-like event target', () => {
    const button = {
      closest: () => button,
    };

    expect(isNativeInteractiveTarget(button as unknown as EventTarget)).toBe(true);
  });

  it('recognizes a text-node-like target inside an interactive element', () => {
    const button = {
      closest: () => button,
    };
    const textNode = {
      parentElement: button,
    };

    expect(isNativeInteractiveTarget(textNode as unknown as EventTarget)).toBe(true);
  });

  it('rejects targets outside native interactive elements', () => {
    const textNode = {
      parentElement: {
        closest: () => null,
      },
    };

    expect(isNativeInteractiveTarget(textNode as unknown as EventTarget)).toBe(false);
    expect(isNativeInteractiveTarget(null)).toBe(false);
  });
});
