const ARROW_OFFSETS: Record<string, (columns: number) => number> = {
  ArrowLeft: () => -1,
  ArrowRight: () => 1,
  ArrowUp: (columns) => -columns,
  ArrowDown: (columns) => columns,
};

/**
 * Roving-focus target for an arrow key over a wrapped grid of focusable items.
 * Returns null when the key is not an arrow, the active element is not one of
 * the items (native controls keep their arrow keys), or there is nothing to
 * move to. Wrapping is modulo the item count, so single-column layouts and
 * incomplete rows stay reachable in a defined order.
 */
export function resolveRovingTarget(
  key: string,
  activeIndex: number,
  count: number,
  columns: number,
): number | null {
  if (activeIndex < 0 || count <= 0 || columns <= 0) return null;
  const offset = ARROW_OFFSETS[key]?.(columns);
  if (offset === undefined) return null;
  return ((activeIndex + offset) % count + count) % count;
}
