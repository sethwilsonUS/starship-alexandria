import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
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

  it('opens Options with O during normal play', () => {
    const original = useGameStore.getState();
    const preventDefault = vi.fn();

    try {
      useGameStore.setState((state) => ({
        session: {
          ...state.session,
          launchGateOpen: false,
          gamePhase: 'ship',
          activeUtility: null,
        },
      }));
      const event = {
        code: 'KeyO',
        key: 'o',
        defaultPrevented: false,
        repeat: false,
        target: null,
        preventDefault,
      } as unknown as KeyboardEvent;

      expect(handleKeyboardInput(event)).toBe(true);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(useGameStore.getState().session.activeUtility).toBe('settings');
    } finally {
      useGameStore.setState(original);
    }
  });

  it('does not open Options while typing in a native control', () => {
    const original = useGameStore.getState();
    const inputTarget = { closest: vi.fn(() => inputTarget) };
    const preventDefault = vi.fn();

    try {
      useGameStore.setState((state) => ({
        session: {
          ...state.session,
          launchGateOpen: false,
          gamePhase: 'ship',
          activeUtility: null,
        },
      }));
      const event = {
        code: 'KeyO',
        key: 'o',
        defaultPrevented: false,
        repeat: false,
        target: inputTarget,
        preventDefault,
      } as unknown as KeyboardEvent;

      expect(handleKeyboardInput(event)).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useGameStore.getState().session.activeUtility).toBeNull();
    } finally {
      useGameStore.setState(original);
    }
  });
});
