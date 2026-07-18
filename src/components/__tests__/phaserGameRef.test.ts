import { describe, expect, it, vi } from 'vitest';
import type { IRefPhaserGame } from '../PhaserGame';
import { assignPhaserGameRef, transferPhaserGameRef } from '../PhaserGame';

vi.mock('@/game/main', () => ({ default: vi.fn() }));

describe('assignPhaserGameRef', () => {
  it('clears both callback and object refs during teardown', () => {
    const callbackRef = vi.fn();
    const objectRef: { current: IRefPhaserGame | null } = { current: { game: null, scene: null } };

    assignPhaserGameRef(callbackRef, null);
    assignPhaserGameRef(objectRef, null);

    expect(callbackRef).toHaveBeenCalledWith(null);
    expect(objectRef.current).toBeNull();
  });

  it('transfers a live game to a new ref without destroying it', () => {
    const oldRef = vi.fn();
    const nextRef = vi.fn();
    const game = { destroy: vi.fn() } as unknown as Phaser.Game;

    transferPhaserGameRef(oldRef, nextRef, game);

    expect(oldRef).toHaveBeenCalledWith(null);
    expect(nextRef).toHaveBeenCalledWith({ game, scene: null });
    expect(game.destroy).not.toHaveBeenCalled();
  });
});
