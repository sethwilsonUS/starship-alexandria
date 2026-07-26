import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { handleKeyboardInput } from '../gameInput';

describe('handleKeyboardInput', () => {
  beforeEach(() => {
    useGameStore.getState().actions.resetGame();
  });

  afterEach(() => {
    useGameStore.getState().actions.resetGame();
  });

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
    const preventDefault = vi.fn();
    useGameStore.getState().actions.acceptLaunchGate();
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
  });

  it('does not open Options while typing in a native control', () => {
    const inputTarget = { closest: vi.fn(() => inputTarget) };
    const preventDefault = vi.fn();
    useGameStore.getState().actions.acceptLaunchGate();
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
  });
});
