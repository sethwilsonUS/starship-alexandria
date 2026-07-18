const NATIVE_INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [contenteditable="true"], [contenteditable=""]';

export function isNativeInteractiveTarget(target: EventTarget | null): boolean {
  const targetWithParent = target as {
    closest?: unknown;
    parentElement?: { closest?: unknown } | null;
  } | null;
  const candidate =
    typeof targetWithParent?.closest === 'function'
      ? targetWithParent
      : targetWithParent?.parentElement;
  const closest = candidate?.closest;
  if (typeof closest !== 'function') return false;

  return Boolean(closest.call(candidate, NATIVE_INTERACTIVE_SELECTOR));
}
