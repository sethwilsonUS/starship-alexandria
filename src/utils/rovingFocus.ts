/**
 * Roving-focus target for an arrow key over a wrapped grid of focusable items.
 *
 * Horizontal arrows stay in the current row and wrap within it (a shorter
 * final row wraps within itself; a single-item row returns null so native
 * behavior is preserved). Vertical arrows wrap modulo the item count, which
 * keeps single-column layouts and incomplete rows reachable in visual order.
 *
 * Returns null when the key is not an arrow, the active element is not one of
 * the items (native controls keep their arrow keys), or there is nothing to
 * move to.
 */
export function resolveRovingTarget(
  key: string,
  activeIndex: number,
  count: number,
  columns: number,
): number | null {
  if (activeIndex < 0 || activeIndex >= count || count <= 0 || columns <= 0) return null;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const rowStart = Math.floor(activeIndex / columns) * columns;
    const rowLength = Math.min(columns, count - rowStart);
    if (rowLength <= 1) return null;
    const step = key === 'ArrowRight' ? 1 : -1;
    const column = activeIndex - rowStart;
    return rowStart + ((column + step + rowLength) % rowLength);
  }

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    if (count <= 1) return null;
    const step = key === 'ArrowDown' ? columns : -columns;
    return ((activeIndex + step) % count + count) % count;
  }

  return null;
}
