import { describe, expect, it } from 'vitest';
import { resolveRovingTarget } from '../rovingFocus';

describe('resolveRovingTarget', () => {
  it('wraps horizontal movement within the current row', () => {
    expect(resolveRovingTarget('ArrowRight', 0, 4, 2)).toBe(1);
    expect(resolveRovingTarget('ArrowRight', 1, 4, 2)).toBe(0);
    expect(resolveRovingTarget('ArrowLeft', 0, 4, 2)).toBe(1);
    expect(resolveRovingTarget('ArrowRight', 2, 4, 2)).toBe(3);
    expect(resolveRovingTarget('ArrowLeft', 3, 4, 2)).toBe(2);
  });

  it('wraps vertical movement across rows', () => {
    expect(resolveRovingTarget('ArrowDown', 1, 4, 2)).toBe(3);
    expect(resolveRovingTarget('ArrowUp', 0, 4, 2)).toBe(2);
  });

  it('keeps a single-column layout in visual order without horizontal moves', () => {
    expect(resolveRovingTarget('ArrowDown', 0, 4, 1)).toBe(1);
    expect(resolveRovingTarget('ArrowUp', 0, 4, 1)).toBe(3);
    expect(resolveRovingTarget('ArrowRight', 2, 4, 1)).toBeNull();
    expect(resolveRovingTarget('ArrowLeft', 2, 4, 1)).toBeNull();
  });

  it('defines behavior for a shorter final row', () => {
    // Five items in two columns: the final row holds only index 4.
    expect(resolveRovingTarget('ArrowRight', 4, 5, 2)).toBeNull();
    expect(resolveRovingTarget('ArrowLeft', 4, 5, 2)).toBeNull();
    expect(resolveRovingTarget('ArrowDown', 3, 5, 2)).toBe(0);
    expect(resolveRovingTarget('ArrowDown', 4, 5, 2)).toBe(1);
  });

  it('never hijacks focus that is not on a grid item', () => {
    expect(resolveRovingTarget('ArrowDown', -1, 4, 2)).toBeNull();
    expect(resolveRovingTarget('ArrowDown', 4, 4, 2)).toBeNull();
  });

  it('ignores non-arrow keys and degenerate grids', () => {
    expect(resolveRovingTarget('Enter', 0, 4, 2)).toBeNull();
    expect(resolveRovingTarget('ArrowDown', 0, 0, 2)).toBeNull();
    expect(resolveRovingTarget('ArrowDown', 0, 1, 1)).toBeNull();
  });
});
