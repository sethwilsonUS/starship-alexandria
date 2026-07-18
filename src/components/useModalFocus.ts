'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalTabTarget = 'dialog' | 'first' | 'last' | null;

export function resolveModalTabTarget({
  focusableCount,
  activeIndex,
  shiftKey,
}: {
  focusableCount: number;
  activeIndex: number;
  shiftKey: boolean;
}): ModalTabTarget {
  if (focusableCount === 0) return 'dialog';
  if (activeIndex < 0) return shiftKey ? 'last' : 'first';
  if (shiftKey && activeIndex === 0) return 'last';
  if (!shiftKey && activeIndex === focusableCount - 1) return 'first';
  return null;
}

/** Native-feeling focus entry, containment, Escape handling, and focus return. */
export function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? dialog;
    const frame = requestAnimationFrame(() => preferred.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        // A repeated Tab still performs the browser's default focus movement;
        // cancel it so a held key cannot walk out of the modal.
        if (event.key === 'Tab') event.preventDefault();
        return;
      }

      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      const target = resolveModalTabTarget({
        focusableCount: items.length,
        activeIndex: items.indexOf(document.activeElement as HTMLElement),
        shiftKey: event.shiftKey,
      });
      if (!target) return;

      event.preventDefault();
      if (target === 'dialog') dialog.focus();
      if (target === 'first') items[0].focus();
      if (target === 'last') items[items.length - 1].focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [dialogRef, onEscape, open]);
}
