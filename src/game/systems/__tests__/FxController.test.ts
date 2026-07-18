import { describe, expect, it, vi } from 'vitest';
import { FxController } from '../FxController';

function makeScene(): {
  scene: Phaser.Scene;
  fireDelayedCall: (index: number) => void;
} {
  const delayedCallbacks: Array<() => void> = [];
  const graphics = {
    active: true,
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    destroy: vi.fn(function (this: { active: boolean }) {
      this.active = false;
    }),
  };
  const tween = { stop: vi.fn() };

  const scene = {
    add: { graphics: vi.fn(() => graphics) },
    cameras: { main: { scrollY: 0, height: 768 } },
    tweens: {
      addCounter: vi.fn(() => tween),
      killTweensOf: vi.fn(),
    },
    time: {
      delayedCall: vi.fn((_delay: number, callback: () => void) => {
        delayedCallbacks.push(callback);
        return { remove: vi.fn() };
      }),
    },
  } as unknown as Phaser.Scene;

  return {
    scene,
    fireDelayedCall: (index) => delayedCallbacks[index]?.(),
  };
}

describe('FxController', () => {
  it('ignores a queued beam fade callback after destruction', () => {
    const { scene, fireDelayedCall } = makeScene();
    const controller = new FxController(scene);
    const onFade = vi.fn();

    controller.playBeamColumn({ x: 100, y: 100 }, onFade, vi.fn());
    controller.destroy();

    // A browser callback may already be queued even after Phaser removes its timer.
    fireDelayedCall(0);

    expect(onFade).not.toHaveBeenCalled();
  });
});
