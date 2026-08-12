import { describe, expect, it } from 'vitest';
import { resolveRovingTarget } from '../rovingFocus';

describe('resolveRovingTarget', () => {
  it('moves through a two-column grid with wrapping', () => {
    expect(resolveRovingTarget('ArrowRight', 0, 4, 2)).toBe(1);
    expect(resolveRovingTarget('ArrowDown', 1, 4, 2)).toBe(3);
    expect(resolveRovingTarget('ArrowLeft', 0, 4, 2)).toBe(3);
    expect(resolveRovingTarget('ArrowUp', 0, 4, 2)).toBe(2);
  });

  it('keeps a single-column layout in visual order', () => {
    expect(resolveRovingTarget('ArrowDown', 0, 4, 1)).toBe(1);
    expect(resolveRovingTarget('ArrowUp', 0, 4, 1)).toBe(3);
    expect(resolveRovingTarget('ArrowRight', 2, 4, 1)).toBe(3);
  });

  it('stays defined for incomplete rows', () => {
    // Five items in two columns: last row has one item.
    expect(resolveRovingTarget('ArrowDown', 3, 5, 2)).toBe(0);
    expect(resolveRovingTarget('ArrowDown', 4, 5, 2)).toBe(1);
  });

  it('never hijacks focus that is not on a grid item', () => {
    expect(resolveRovingTarget('ArrowDown', -1, 4, 2)).toBeNull();
  });

  it('ignores non-arrow keys and empty grids', () => {
    expect(resolveRovingTarget('Enter', 0, 4, 2)).toBeNull();
    expect(resolveRovingTarget('ArrowDown', 0, 0, 2)).toBeNull();
  });
});
