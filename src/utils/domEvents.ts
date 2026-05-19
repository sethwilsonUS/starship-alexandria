const NATIVE_INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [contenteditable="true"], [contenteditable=""]';

export function isNativeInteractiveTarget(target: EventTarget | null): boolean {
  const closest = (target as { closest?: unknown } | null)?.closest;
  if (typeof closest !== 'function') return false;

  return Boolean(closest.call(target, NATIVE_INTERACTIVE_SELECTOR));
}
