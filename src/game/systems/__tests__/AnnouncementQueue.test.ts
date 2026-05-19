import { describe, expect, it, vi } from 'vitest';
import { AnnouncementQueue, type AnnouncementScheduler } from '../AnnouncementQueue';

function makeScheduler(): {
  scheduler: AnnouncementScheduler;
  runNext: () => void;
  pendingCount: () => number;
} {
  const callbacks: Array<() => void> = [];

  return {
    scheduler: {
      delay: (_ms, callback) => {
        callbacks.push(callback);
        return {
          cancel: () => {
            const index = callbacks.indexOf(callback);
            if (index >= 0) callbacks.splice(index, 1);
          },
        };
      },
    },
    runNext: () => callbacks.shift()?.(),
    pendingCount: () => callbacks.length,
  };
}

describe('AnnouncementQueue', () => {
  it('runs announcements in order and calls complete once', () => {
    const { scheduler, runNext } = makeScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();
    const complete = vi.fn();

    queue.play(
      [
        { delayMs: 10, run: () => run('one') },
        { delayMs: 20, run: () => run('two') },
      ],
      complete
    );

    runNext();
    runNext();

    expect(run.mock.calls).toEqual([['one'], ['two']]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('cancels pending announcements', () => {
    const { scheduler, runNext, pendingCount } = makeScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();

    queue.play([
      { delayMs: 10, run: () => run('one') },
      { delayMs: 20, run: () => run('two') },
    ]);

    queue.cancel();
    expect(pendingCount()).toBe(0);
    runNext();

    expect(run).not.toHaveBeenCalled();
  });

  it('starting a new sequence cancels the previous sequence', () => {
    const { scheduler, runNext } = makeScheduler();
    const queue = new AnnouncementQueue(scheduler);
    const run = vi.fn();

    queue.play([{ delayMs: 10, run: () => run('old') }]);
    queue.play([{ delayMs: 10, run: () => run('new') }]);
    runNext();

    expect(run.mock.calls).toEqual([['new']]);
  });
});
