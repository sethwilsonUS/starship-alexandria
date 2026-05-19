import { describe, expect, it } from 'vitest';
import { TransitionGuard } from '../TransitionGuard';

describe('TransitionGuard', () => {
  it('blocks actions during the transition cooldown', () => {
    const guard = new TransitionGuard({ cooldownMs: 350 });

    const epoch = guard.beginTransition(1000);

    expect(epoch).toBe(1);
    expect(guard.canAcceptAction(1000)).toBe(false);
    expect(guard.canAcceptAction(1349)).toBe(false);
    expect(guard.canAcceptAction(1350)).toBe(true);
  });

  it('increments epochs for stale action rejection', () => {
    const guard = new TransitionGuard({ cooldownMs: 100 });

    const first = guard.beginTransition(10);
    const second = guard.beginTransition(50);

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(guard.isCurrentEpoch(first)).toBe(false);
    expect(guard.isCurrentEpoch(second)).toBe(true);
  });

  it('can be manually released for tests and non-animated transitions', () => {
    const guard = new TransitionGuard({ cooldownMs: 500 });

    guard.beginTransition(100);
    guard.release(125);

    expect(guard.canAcceptAction(126)).toBe(true);
  });
});
